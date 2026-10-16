-- Кілька фахівців на групу, перенесення дитини між групами, аватар дитини.
--
-- 1. Фахівці групи (group_specialists). Досі доступ до дитини мав рівно один
--    дорослий — groups.teacher_id. Логопед, психолог і вчитель однієї дитини
--    не могли бачити спільних результатів. Власник групи додає колегу за
--    поштою; колега бачить дітей і результати, дає завдання, веде заняття й
--    свій власний щоденник (зашифрований його ключем — щоденники фахівців
--    одне одному не відкриваються). Незворотне — видалити дитину, прибрати з
--    групи, перейменувати — лишається за власником.
-- 2. Перенесення дитини в іншу групу (teacher_move_student) за кодом групи:
--    наступний клас, інший фахівець. Історія не губиться — спроби прив'язані
--    до дитини, а не до групи.
-- 3. Аватар-тваринка (profiles.avatar) — щоб дитина, яка не читає, впізнала
--    себе на спільному комп'ютері.


-- ───────────────────────── Фахівці групи ─────────────────────────

create table if not exists public.group_specialists (
  group_id uuid not null references public.groups (id) on delete cascade,
  specialist_id uuid not null references public.profiles (id) on delete cascade,
  added_by uuid references auth.users (id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (group_id, specialist_id)
);

create index if not exists group_specialists_specialist_idx
  on public.group_specialists (specialist_id);

alter table public.group_specialists enable row level security;

-- Писати напряму не може ніхто: лише add_/remove_group_specialist нижче.
revoke insert, update, delete on public.group_specialists from anon, authenticated;

drop policy if exists group_specialists_select on public.group_specialists;
create policy group_specialists_select on public.group_specialists
  for select to authenticated
  using (
    specialist_id = (select auth.uid())
    or exists (
      select 1 from public.groups g
       where g.id = group_id and g.teacher_id = (select auth.uid())
    )
  );


/* Власник групи — той самий зміст, що й досі мала is_teacher_of_group. */
create or replace function public.is_owner_of_group(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.groups where id = p_group_id and teacher_id = auth.uid()
  );
$function$;

create or replace function public.is_owner_of_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
      from public.profiles p
      join public.groups g on g.id = p.group_id
     where p.id = p_student_id and g.teacher_id = auth.uid()
  );
$function$;

/*
 * «Веде групу» тепер означає «власник або доданий фахівець». На цих двох
 * функціях стоять політики завдань, занять, цілей ІПР, щоденника, згоди й
 * кодів для батьків — тож фахівець отримує їх усі одним рядком.
 */
create or replace function public.is_teacher_of_group(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select public.is_owner_of_group(p_group_id)
      or exists (
        select 1 from public.group_specialists
         where group_id = p_group_id and specialist_id = auth.uid()
      );
$function$;

/*
 * Назву параметра хостингової версії з репозиторію не видно, а
 * `create or replace` з іншою назвою падає («cannot change name of input
 * parameter»). Видалити й створити наново не можна — на функції стоять
 * політики. Тож назва береться з тієї, що вже є.
 */
do $migration$
declare
  v_arg text;
begin
  select proargnames[1] into v_arg
    from pg_proc
   where oid = to_regprocedure('public.is_teacher_of_student(uuid)');

  execute format(
    $f$
      create or replace function public.is_teacher_of_student(%1$I uuid)
      returns boolean
      language sql
      stable
      security definer
      set search_path to 'public'
      as $body$
        select exists (
          select 1 from public.profiles p
           where p.id = %1$I
             and p.group_id is not null
             and public.is_teacher_of_group(p.group_id)
        );
      $body$
    $f$,
    coalesce(v_arg, 'p_student_id')
  );
end;
$migration$;

/*
 * Додаткові дозвільні політики. Хостингові політики groups, profiles і
 * results в репозиторії не видно (див. 20260901_base_schema.sql), тож тут
 * не правиться жодна наявна — лише додаються нові. Дозвільні політики
 * складаються через «або», тож доступу власника вони не звужують.
 */
drop policy if exists groups_select_specialist on public.groups;
create policy groups_select_specialist on public.groups
  for select to authenticated
  using (public.is_teacher_of_group(id));

drop policy if exists profiles_select_team on public.profiles;
create policy profiles_select_team on public.profiles
  for select to authenticated
  using (public.is_teacher_of_student(id));

drop policy if exists results_select_team on public.results;
create policy results_select_team on public.results
  for select to authenticated
  using (public.is_teacher_of_student(user_id));


/*
 * Додати колегу за поштою. Колега має бути зареєстрований поштою з роллю
 * вчителя чи модератора. Повертає id доданого.
 */
create or replace function public.add_group_specialist(p_group_id uuid, p_email text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_target uuid;
begin
  if not public.is_owner_of_group(p_group_id) then
    raise exception 'not_owner' using errcode = 'P0001', detail = 'not_owner';
  end if;

  select u.id into v_target
    from auth.users u
    join public.profiles p on p.id = u.id
   where lower(u.email) = lower(btrim(coalesce(p_email, '')))
     and p.role in ('teacher', 'moderator')
   limit 1;

  if v_target is null then
    raise exception 'teacher_not_found' using errcode = 'P0001', detail = 'teacher_not_found';
  end if;

  if v_target = auth.uid() then
    raise exception 'already_owner' using errcode = 'P0001', detail = 'already_owner';
  end if;

  insert into public.group_specialists (group_id, specialist_id, added_by)
  values (p_group_id, v_target, auth.uid())
  on conflict do nothing;

  return v_target;
end;
$function$;

revoke all on function public.add_group_specialist(uuid, text) from public, anon;
grant execute on function public.add_group_specialist(uuid, text) to authenticated;


/* Прибрати колегу може власник; вийти з групи — сам колега. */
create or replace function public.remove_group_specialist(p_group_id uuid, p_specialist_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not (public.is_owner_of_group(p_group_id) or p_specialist_id = auth.uid()) then
    raise exception 'not_owner' using errcode = 'P0001', detail = 'not_owner';
  end if;

  delete from public.group_specialists
   where group_id = p_group_id and specialist_id = p_specialist_id;
end;
$function$;

revoke all on function public.remove_group_specialist(uuid, uuid) from public, anon;
grant execute on function public.remove_group_specialist(uuid, uuid) to authenticated;


/*
 * Хто веде групу: власник і фахівці, з поштою — бо колег шукають і
 * впізнають саме за нею. Бачить лише той, хто сам веде групу.
 */
create or replace function public.list_group_team(p_group_id uuid)
returns table (user_id uuid, display_name text, email text, is_owner boolean, added_at timestamptz)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_teacher_of_group(p_group_id) then
    raise exception 'not_allowed' using errcode = 'P0001', detail = 'not_allowed';
  end if;

  return query
    select g.teacher_id, p.display_name, u.email::text, true, g.created_at
      from public.groups g
      left join public.profiles p on p.id = g.teacher_id
      left join auth.users u on u.id = g.teacher_id
     where g.id = p_group_id
    union all
    select s.specialist_id, p.display_name, u.email::text, false, s.added_at
      from public.group_specialists s
      left join public.profiles p on p.id = s.specialist_id
      left join auth.users u on u.id = s.specialist_id
     where s.group_id = p_group_id
    order by 4 desc, 5;
end;
$function$;

revoke all on function public.list_group_team(uuid) from public, anon;
grant execute on function public.list_group_team(uuid) to authenticated;


-- ───────────── Незворотне — лише власнику групи ─────────────
--
-- Ці три функції досі перевіряли is_teacher_of_student, яка тепер пускає й
-- фахівців. Тексти ті самі (20260903, 20261005), змінено лише перевірку.

create or replace function public.teacher_rename_student(p_student_id uuid, p_display_name text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_name text := btrim(coalesce(p_display_name, ''));
begin
  if not public.is_owner_of_student(p_student_id) then
    raise exception 'Only the teacher of this group can rename the student';
  end if;

  if coalesce((select role from public.profiles where id = p_student_id), '') <> 'student' then
    raise exception 'Only student profiles can be renamed';
  end if;

  if v_name = '' then
    raise exception 'Name cannot be empty';
  end if;

  if length(v_name) > 60 then
    raise exception 'Name is too long';
  end if;

  update public.profiles set display_name = v_name where id = p_student_id;
end;
$function$;

create or replace function public.teacher_remove_student(p_student_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_owner_of_student(p_student_id) then
    raise exception 'Only the teacher of this group can remove the student';
  end if;

  if coalesce((select role from public.profiles where id = p_student_id), '') <> 'student' then
    raise exception 'Only student profiles can be removed from a group';
  end if;

  update public.profiles set group_id = null where id = p_student_id;
end;
$function$;

create or replace function public.teacher_delete_student(p_student_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_owner_of_student(p_student_id) then
    raise exception 'Only the teacher of this group can delete the student';
  end if;

  perform public.purge_student(p_student_id);
end;
$function$;


-- ───────────────────────── Перенесення дитини ─────────────────────────

/*
 * Перевести дитину в іншу групу за кодом тієї групи. Кличе власник групи, де
 * дитина зараз, або модератор. Код — той самий, що дитина ввела б сама; тож
 * перенесення не відкриває нікому нічого понад те, що дав би її власний вхід.
 *
 * Разом із дитиною йдуть її спроби, профіль адаптацій, зв'язки з батьками й
 * відмітка згоди: усе це прив'язане до дитини. Заняття, призначені в старій
 * групі, лишаються там. Повертає id нової групи.
 */
create or replace function public.teacher_move_student(p_student_id uuid, p_target_code text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_target uuid;
  v_current uuid;
begin
  if not (public.is_owner_of_student(p_student_id)
          or coalesce(public.current_user_role(), '') = 'moderator') then
    raise exception 'not_allowed' using errcode = 'P0001', detail = 'not_allowed';
  end if;

  if coalesce((select role from public.profiles where id = p_student_id), '') <> 'student' then
    raise exception 'not_a_student' using errcode = 'P0001', detail = 'not_a_student';
  end if;

  select id into v_target from public.groups
   where join_code = upper(btrim(coalesce(p_target_code, '')));

  if v_target is null then
    raise exception 'invalid_code' using errcode = 'P0001', detail = 'invalid_code';
  end if;

  select group_id into v_current from public.profiles where id = p_student_id;
  if v_current = v_target then
    raise exception 'same_group' using errcode = 'P0001', detail = 'same_group';
  end if;

  update public.profiles set group_id = v_target where id = p_student_id;
  return v_target;
end;
$function$;

revoke all on function public.teacher_move_student(uuid, text) from public, anon;
grant execute on function public.teacher_move_student(uuid, text) to authenticated;


-- ───────────────────────── Передача груп ─────────────────────────
--
-- transfer_my_groups (20261013) лишав новому власнику його ж рядок
-- «фахівець цієї групи». Тепер такий рядок прибирається: власник і так бачить
-- усе. Решта тексту без змін.

create or replace function public.transfer_my_groups(p_email text)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_target uuid;
  v_count integer;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = 'P0001', detail = 'not_signed_in';
  end if;

  select u.id into v_target
    from auth.users u
    join public.profiles p on p.id = u.id
   where lower(u.email) = lower(btrim(coalesce(p_email, '')))
     and p.role in ('teacher', 'moderator')
   limit 1;

  if v_target is null then
    raise exception 'teacher_not_found' using errcode = 'P0001', detail = 'teacher_not_found';
  end if;

  if v_target = v_uid then
    raise exception 'cannot_transfer_to_self'
      using errcode = 'P0001', detail = 'cannot_transfer_to_self';
  end if;

  delete from public.group_specialists s
   using public.groups g
   where s.group_id = g.id and g.teacher_id = v_uid and s.specialist_id = v_target;

  update public.groups set teacher_id = v_target where teacher_id = v_uid;
  get diagnostics v_count = row_count;

  if v_count = 0 then
    raise exception 'no_groups' using errcode = 'P0001', detail = 'no_groups';
  end if;

  update public.assignments a
     set created_by = g.teacher_id
    from public.groups g
   where a.group_id = g.id and a.created_by = v_uid;

  update public.session_plans s
     set created_by = g.teacher_id
    from public.groups g
   where s.group_id = g.id and s.created_by = v_uid;

  update public.ipr_goals i
     set created_by = g.teacher_id
    from public.profiles p
    join public.groups g on g.id = p.group_id
   where i.student_id = p.id and i.created_by = v_uid;

  return v_count;
end;
$function$;


-- ───────────────────────── Аватар ─────────────────────────

alter table public.profiles add column if not exists avatar text;

do $migration$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_avatar_check') then
    -- Ключ тваринки з коду (src/data/avatars.js), а не довільний текст: нова
    -- тваринка не потребує міграції, але й рядок на півсторінки сюди не ляже.
    alter table public.profiles
      add constraint profiles_avatar_check check (avatar is null or avatar ~ '^[a-z]{2,16}$');
  end if;
end;
$migration$;

/*
 * Дитина обирає тваринку сама. Через функцію, а не update по таблиці:
 * хостингові політики profiles невідомо, чи дозволяють дитині писати у свій
 * рядок, — а тут змінюється рівно одна колонка рівно свого профілю.
 */
create or replace function public.set_my_avatar(p_avatar text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = 'P0001', detail = 'not_signed_in';
  end if;

  update public.profiles
     set avatar = nullif(btrim(coalesce(p_avatar, '')), '')
   where id = auth.uid();
end;
$function$;

revoke all on function public.set_my_avatar(text) from public, anon;
grant execute on function public.set_my_avatar(text) to authenticated;
