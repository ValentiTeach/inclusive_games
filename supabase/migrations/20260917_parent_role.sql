-- Роль батьків: дорослий бачить одну свою дитину і більше нікого.
--
-- Код групи для цього не годиться: він спільний на весь клас, і будь-хто з
-- батьків, увівши його, побачив би результати всіх дітей. Тому запрошення
-- виписується на конкретну дитину, і виписує його вчитель — саме він знає, який
-- дорослий до якої дитини належить. Платформа цього знати не може.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('student', 'teacher', 'moderator', 'parent'));

create table if not exists public.parent_invites (
  code text primary key,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  used_by uuid references public.profiles(id) on delete set null
);

create index if not exists parent_invites_student_idx
  on public.parent_invites (student_id);

create table if not exists public.parent_links (
  parent_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (parent_id, student_id)
);

create index if not exists parent_links_student_idx
  on public.parent_links (student_id);

alter table public.parent_invites enable row level security;
alter table public.parent_links enable row level security;

/*
 * Чи дивиться цей дорослий саме за цією дитиною. Функція окрема й
 * security definer, бо політики на results і profiles інакше рекурсивно
 * читали б таблицю, захищену власною політикою.
 */
create or replace function public.is_parent_of(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.parent_links
    where parent_id = auth.uid() and student_id = p_student_id
  );
$function$;

create policy "Parents can view their child's results"
  on public.results for select
  using (public.is_parent_of(user_id));

create policy "Parents can view their child's profile"
  on public.profiles for select
  using (public.is_parent_of(id));

create policy "Parents can see their own links"
  on public.parent_links for select
  using (parent_id = auth.uid());

create policy "Teachers can see invites they wrote"
  on public.parent_invites for select
  using (created_by = auth.uid());

/*
 * Код запрошення. Виписати його може тільки вчитель тієї групи, де ця дитина,
 * або модератор — інакше будь-хто, знаючи чужий user_id, виписав би собі
 * доступ до чужої дитини.
 *
 * Алфавіт без 0/O та 1/I: код диктують уголос і переписують з паперу.
 */
create or replace function public.create_parent_invite(p_student_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_group uuid;
  v_code text;
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = 'P0001', detail = 'not_signed_in';
  end if;

  select group_id into v_group from public.profiles where id = p_student_id;

  if v_group is null then
    raise exception 'student_not_found' using errcode = 'P0001', detail = 'student_not_found';
  end if;

  if not public.is_teacher_of_group(v_group) and public.current_user_role() <> 'moderator' then
    raise exception 'not_allowed' using errcode = 'P0001', detail = 'not_allowed';
  end if;

  loop
    v_code := (
      select string_agg(substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1), '')
      from generate_series(1, 8)
    );
    exit when not exists (select 1 from public.parent_invites where code = v_code);
  end loop;

  insert into public.parent_invites (code, student_id, created_by)
  values (v_code, p_student_id, v_uid);

  return v_code;
end;
$function$;

/*
 * Дорослий уводить код. Роль стає 'parent' лише тому, хто ще учень: інакше
 * вчитель, який вводить код власної дитини, втратив би свої групи.
 *
 * Анонімний сеанс сюди не пускаємо. Батьківський доступ — це доступ до чужих
 * даних, і він має належати обліковому запису з поштою, який можна відкликати,
 * а не випадковому сеансу браузера.
 */
create or replace function public.redeem_parent_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_student uuid;
  v_used timestamptz;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = 'P0001', detail = 'not_signed_in';
  end if;

  if (select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) then
    raise exception 'anonymous_not_allowed'
      using errcode = 'P0001', detail = 'anonymous_not_allowed';
  end if;

  select student_id, used_at into v_student, v_used
  from public.parent_invites where code = v_code;

  if v_student is null then
    raise exception 'invalid_code' using errcode = 'P0001', detail = 'invalid_code';
  end if;

  if v_used is not null then
    raise exception 'code_already_used' using errcode = 'P0001', detail = 'code_already_used';
  end if;

  if v_student = v_uid then
    raise exception 'cannot_watch_self' using errcode = 'P0001', detail = 'cannot_watch_self';
  end if;

  insert into public.parent_links (parent_id, student_id)
  values (v_uid, v_student)
  on conflict do nothing;

  update public.parent_invites
     set used_at = now(), used_by = v_uid
   where code = v_code;

  update public.profiles set role = 'parent'
   where id = v_uid and role = 'student';

  return v_student;
end;
$function$;
