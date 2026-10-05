-- Строк зберігання, згода батьків і видалення дітей, яких уже прибрано з групи.
--
-- Досі сторінка /privacy чесно казала: автоматичного видалення немає, а дитину,
-- яку прибрали з групи, видалити може «адміністратор платформи» — тобто
-- вручну, SQL-запитом у панелі Supabase. Школа чи центр, що підключає
-- платформу, питає про це першим ділом. Ця міграція дає три речі:
--
-- 1. Строк. Дані учня, який не грав і не проходив занять 12 місяців, більше не
--    потрібні ні дитині, ні фахівцю. purge_inactive_students видаляє їх; її
--    можна викликати вручну з адмін-панелі або раз на місяць через pg_cron
--    (див. унизу). Строк — параметр, але не менше 6 місяців: випадкове «0»
--    не має стерти всю платформу.
-- 2. Видалення модератором — moderator_delete_student. Закриває випадок
--    «дитину вже прибрали з групи, а батьки просять видалити»: учитель її
--    більше не бачить, а модератор бачить усіх.
-- 3. Позначка згоди батьків — parental_consents. Сама згода живе на папері
--    (зразок — /privacy/consent); тут лише відмітка вчителя «отримано такого
--    числа», щоб не тримати це в голові на тридцять дітей.
--
-- Усі три видалення йдуть через одну внутрішню функцію purge_student: перелік
-- таблиць, що належать дитині, має жити в одному місці. Досі він жив у
-- teacher_delete_student і переписувався з кожною новою таблицею.


-- ───────────────────────── Позначка згоди ─────────────────────────

create table if not exists public.parental_consents (
  student_id uuid primary key references public.profiles (id) on delete cascade,
  -- Дата на папері, а не дата натискання: учитель може відмітити згоду,
  -- зібрану тиждень тому.
  given_on date not null default current_date,
  recorded_at timestamptz not null default now(),
  recorded_by uuid default auth.uid() references auth.users (id) on delete set null
);

comment on table public.parental_consents is
  'Відмітка вчителя: згоду батьків на обробку даних дитини отримано. '
  'Самий документ зберігається в школі; тут лише дата. Видаляється разом з дитиною.';

alter table public.parental_consents enable row level security;

drop policy if exists parental_consents_select on public.parental_consents;
create policy parental_consents_select on public.parental_consents
  for select to authenticated
  using (public.is_teacher_of_student(student_id) or public.is_parent_of(student_id));

drop policy if exists parental_consents_insert on public.parental_consents;
create policy parental_consents_insert on public.parental_consents
  for insert to authenticated
  with check (public.is_teacher_of_student(student_id));

drop policy if exists parental_consents_update on public.parental_consents;
create policy parental_consents_update on public.parental_consents
  for update to authenticated
  using (public.is_teacher_of_student(student_id))
  with check (public.is_teacher_of_student(student_id));

-- Зняти відмітку — теж право вчителя: батьки відкликали згоду, або її
-- поставили не тій дитині.
drop policy if exists parental_consents_delete on public.parental_consents;
create policy parental_consents_delete on public.parental_consents
  for delete to authenticated
  using (public.is_teacher_of_student(student_id));


-- ───────────────────────── Одне місце для видалення ─────────────────────────

/*
 * Видаляє все, що платформа знає про дитину. Без жодних перевірок прав —
 * тому й не видана нікому: її кличуть лише функції нижче, кожна зі своєю
 * перевіркою.
 */
create or replace function public.purge_student(p_student_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if coalesce((select role from public.profiles where id = p_student_id), '') <> 'student' then
    raise exception 'Only student profiles can be deleted';
  end if;

  delete from public.parental_consents where student_id = p_student_id;
  delete from public.diary_entries where student_id = p_student_id;
  delete from public.ipr_goals where student_id = p_student_id;
  delete from public.session_runs where student_id = p_student_id;
  delete from public.session_plans where student_id = p_student_id;
  delete from public.student_adaptations where student_id = p_student_id;
  delete from public.results where user_id = p_student_id;
  delete from public.parent_links where student_id = p_student_id;
  delete from public.parent_invites where student_id = p_student_id;
  delete from public.profiles where id = p_student_id;
  -- Анонімний обліковий запис дитини. Без цього лишався б порожній, але живий
  -- користувач, прив'язаний до браузера, на якому вона грала.
  delete from auth.users where id = p_student_id;
end;
$function$;

revoke all on function public.purge_student(uuid) from public, anon, authenticated;


/* Вчитель групи — як і досі, лише поки дитина в його групі. */
create or replace function public.teacher_delete_student(p_student_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_teacher_of_student(p_student_id) then
    raise exception 'Only the teacher of this group can delete the student';
  end if;

  perform public.purge_student(p_student_id);
end;
$function$;

revoke all on function public.teacher_delete_student(uuid) from public, anon;
grant execute on function public.teacher_delete_student(uuid) to authenticated;


/* Модератор — будь-якого учня, зокрема вже прибраного з групи. */
create or replace function public.moderator_delete_student(p_student_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if coalesce(public.current_user_role(), '') <> 'moderator' then
    raise exception 'Only a moderator can delete any student';
  end if;

  perform public.purge_student(p_student_id);
end;
$function$;

revoke all on function public.moderator_delete_student(uuid) from public, anon;
grant execute on function public.moderator_delete_student(uuid) to authenticated;


-- ───────────────────────── Строк зберігання ─────────────────────────

/*
 * Остання активність учня: найпізніше з приєднання, гри й початку заняття.
 * Приєднання рахується теж — інакше дитина, яка щойно ввела код і ще не
 * встигла зіграти, вважалася б «неактивною відтоді, як світ стоїть».
 */
create or replace function public.student_last_activity(p_student_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path to 'public'
as $function$
  select greatest(
    (select created_at from public.profiles where id = p_student_id),
    (select max(played_at) from public.results where user_id = p_student_id),
    (select max(started_at) from public.session_runs where student_id = p_student_id)
  );
$function$;

revoke all on function public.student_last_activity(uuid) from public, anon, authenticated;


/*
 * Хто вже за межею строку — для перегляду перед видаленням. Модератор бачить
 * ім'я, групу й дату останньої активності, і нічого більше.
 */
create or replace function public.inactive_students(p_months integer default 12)
returns table (student_id uuid, display_name text, group_id uuid, last_activity timestamptz)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if coalesce(public.current_user_role(), '') <> 'moderator' then
    raise exception 'Only a moderator can list inactive students';
  end if;

  return query
    select p.id, p.display_name, p.group_id, public.student_last_activity(p.id)
      from public.profiles p
     where p.role = 'student'
       and public.student_last_activity(p.id) < now() - make_interval(months => greatest(p_months, 6))
     order by 4;
end;
$function$;

revoke all on function public.inactive_students(integer) from public, anon;
grant execute on function public.inactive_students(integer) to authenticated;


/*
 * Видаляє всіх учнів, неактивних довше за строк. Повертає, скільки видалено.
 *
 * Викликати може модератор (з адмін-панелі) або сам сервер — pg_cron чи SQL у
 * панелі Supabase, де auth.uid() порожній. Звичайному користувачу вхідний
 * виклик не відкритий: anon не має права execute, а в authenticated завжди є
 * auth.uid(), і тоді потрібна роль модератора.
 */
create or replace function public.purge_inactive_students(p_months integer default 12)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_count integer := 0;
begin
  if auth.uid() is not null and coalesce(public.current_user_role(), '') <> 'moderator' then
    raise exception 'Only a moderator can purge inactive students';
  end if;

  for v_id in
    select p.id
      from public.profiles p
     where p.role = 'student'
       and public.student_last_activity(p.id) < now() - make_interval(months => greatest(p_months, 6))
  loop
    perform public.purge_student(v_id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$function$;

revoke all on function public.purge_inactive_students(integer) from public, anon;
grant execute on function public.purge_inactive_students(integer) to authenticated;


-- Щомісячне очищення за розкладом (1-го числа о 03:00 UTC). Розширення pg_cron
-- вмикається в панелі Supabase (Database → Extensions); після цього виконати:
--
--   select cron.schedule(
--     'purge-inactive-students',
--     '0 3 1 * *',
--     $$select public.purge_inactive_students(12)$$
--   );
--
-- Свідомо не вмикається тут: перше очищення має запустити людина, подивившись
-- на список в адмін-панелі, а не міграція, яка спрацює в момент застосування.
