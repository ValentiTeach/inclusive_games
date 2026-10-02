-- Інструменти фахівця: профіль адаптацій, заняття, щоденник, цілі ІПР,
-- і захищене сховище ключа для шифрування в браузері.
--
-- Загальні правила для всіх таблиць нижче:
--
-- - Діагнозів тут немає. Профіль адаптацій зберігає лише перемикачі («без
--   обмеження часу»), а не причину. Дані про здоров'я дитини, яких не
--   зберігали, не можуть і витекти.
-- - Найчутливіше (нотатки щоденника, настрій дитини, її «як тобі було»)
--   шифрується в браузері ключем фахівця (src/lib/vault.js). База приймає в цих
--   колонках лише шифротекст формату `s1.…` — перевірка `check` нижче. Навіть
--   помилка в клієнті не може покласти туди відкритий текст.
-- - Усе прив'язане до дитини видаляється разом із нею (`on delete cascade` і
--   оновлена teacher_delete_student унизу).

-- ───────────────────────── Профіль адаптацій ─────────────────────────

create table if not exists public.student_adaptations (
  student_id uuid primary key references public.profiles (id) on delete cascade,
  settings jsonb not null default '{}'::jsonb
    check (jsonb_typeof(settings) = 'object' and pg_column_size(settings) < 2048),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references auth.users (id) on delete set null
);

comment on table public.student_adaptations is
  'Адаптації, які фахівець задав дитині. Лише перемикачі, без діагнозу. '
  'Клієнт нормалізує значення (src/lib/adaptations.js).';

alter table public.student_adaptations enable row level security;

drop policy if exists student_adaptations_select on public.student_adaptations;
create policy student_adaptations_select on public.student_adaptations
  for select to authenticated
  using (
    student_id = auth.uid()
    or public.is_teacher_of_student(student_id)
    or public.is_parent_of(student_id)
  );

drop policy if exists student_adaptations_insert on public.student_adaptations;
create policy student_adaptations_insert on public.student_adaptations
  for insert to authenticated
  with check (public.is_teacher_of_student(student_id));

drop policy if exists student_adaptations_update on public.student_adaptations;
create policy student_adaptations_update on public.student_adaptations
  for update to authenticated
  using (public.is_teacher_of_student(student_id))
  with check (public.is_teacher_of_student(student_id));

create or replace function public.touch_student_adaptations()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$function$;

drop trigger if exists student_adaptations_touch on public.student_adaptations;
create trigger student_adaptations_touch
  before insert or update on public.student_adaptations
  for each row execute function public.touch_student_adaptations();

-- ──────────────────── Сховище ключа фахівця ────────────────────
--
-- Відкритий ключ — відкрито: ним шифрують для фахівця. Закритий — лише під
-- паролем фахівця (PBKDF2 → AES-GCM у браузері). Сервер не бачить ні пароля,
-- ні закритого ключа.

create table if not exists public.specialist_vaults (
  owner_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  public_key text not null check (length(public_key) between 60 and 400),
  wrapped_key text not null check (wrapped_key like 'w1.%' and length(wrapped_key) < 1000),
  salt text not null check (length(salt) between 16 and 64),
  iterations integer not null check (iterations >= 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.specialist_vaults enable row level security;

drop policy if exists specialist_vaults_select on public.specialist_vaults;
create policy specialist_vaults_select on public.specialist_vaults
  for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists specialist_vaults_insert on public.specialist_vaults;
create policy specialist_vaults_insert on public.specialist_vaults
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and public.current_user_role() in ('teacher', 'moderator')
  );

-- Оновлюється лише обгортка ключа (новий пароль). Сам відкритий ключ не
-- змінюється ніколи: інакше всі старі записи стали б нечитабельними.
drop policy if exists specialist_vaults_update on public.specialist_vaults;
create policy specialist_vaults_update on public.specialist_vaults
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

revoke update on public.specialist_vaults from authenticated;
grant update (wrapped_key, salt, iterations, updated_at) on public.specialist_vaults to authenticated;

/*
 * Відкритий ключ учителя групи — для дитини цієї групи, щоб зашифрувати свій
 * настрій. Дитина не бачить таблицю specialist_vaults і не мусить: їй
 * потрібен рівно один рядок, і тільки відкритий ключ.
 */
create or replace function public.group_vault_key(p_group_id uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $function$
  select v.public_key
  from public.groups g
  join public.specialist_vaults v on v.owner_id = g.teacher_id
  where g.id = p_group_id
    and (public.is_member_of_group(p_group_id) or public.is_teacher_of_group(p_group_id));
$function$;

revoke all on function public.group_vault_key(uuid) from public, anon;
grant execute on function public.group_vault_key(uuid) to authenticated;

-- ─────────────────────────── Заняття ───────────────────────────

-- Власні шаблони фахівця. Бібліотека готових шаблонів живе в коді
-- (src/data/sessionTemplates.js), а не тут: вона однакова для всіх.
create table if not exists public.session_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 120),
  steps jsonb not null
    check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) between 1 and 20
           and pg_column_size(steps) < 16384),
  max_minutes integer check (max_minutes between 5 and 120),
  break_every_minutes integer check (break_every_minutes between 3 and 60),
  created_at timestamptz not null default now()
);

alter table public.session_templates enable row level security;

drop policy if exists session_templates_owner on public.session_templates;
create policy session_templates_owner on public.session_templates
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

/*
 * Призначене заняття. Кроки копіюються в момент призначення: шаблон потім
 * можна правити, а вже проведені заняття мають лишитися такими, якими були.
 * student_id null — заняття всій групі.
 */
create table if not exists public.session_plans (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  student_id uuid references public.profiles (id) on delete cascade,
  kind text not null default 'session' check (kind in ('session', 'battery')),
  title text not null check (length(btrim(title)) between 1 and 120),
  steps jsonb not null
    check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) between 1 and 20
           and pg_column_size(steps) < 16384),
  max_minutes integer check (max_minutes between 5 and 120),
  break_every_minutes integer check (break_every_minutes between 3 and 60),
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists session_plans_group_idx on public.session_plans (group_id);

alter table public.session_plans enable row level security;

drop policy if exists session_plans_select on public.session_plans;
create policy session_plans_select on public.session_plans
  for select to authenticated
  using (
    public.is_teacher_of_group(group_id)
    or (
      public.is_member_of_group(group_id)
      and (student_id is null or student_id = auth.uid())
    )
  );

drop policy if exists session_plans_insert on public.session_plans;
create policy session_plans_insert on public.session_plans
  for insert to authenticated
  with check (
    public.is_teacher_of_group(group_id)
    and created_by = auth.uid()
    and (
      student_id is null
      or exists (select 1 from public.profiles p where p.id = student_id and p.group_id = session_plans.group_id)
    )
  );

-- «Зняти» заняття — це позначка, а не видалення: звіти про вже проведені
-- заняття лишаються.
drop policy if exists session_plans_archive on public.session_plans;
create policy session_plans_archive on public.session_plans
  for update to authenticated
  using (public.is_teacher_of_group(group_id))
  with check (public.is_teacher_of_group(group_id));

revoke update on public.session_plans from authenticated;
grant update (archived_at) on public.session_plans to authenticated;

/*
 * Одне проходження заняття дитиною. Бали тут не дублюються: звіт бере їх із
 * results за вікном started_at…finished_at (див. src/lib/sessions.js), бо
 * друге джерело правди про ту саму спробу рано чи пізно розійшлося б з першим.
 */
create table if not exists public.session_runs (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.session_plans (id) on delete cascade,
  student_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  steps_done jsonb not null default '[]'::jsonb
    check (jsonb_typeof(steps_done) = 'array' and pg_column_size(steps_done) < 8192),
  -- Профіль адаптацій у мить заняття: зріз «до/після» чесно порівнювати лише
  -- за однакових умов, і звіт має бачити, якщо вони змінилися.
  adaptations jsonb check (adaptations is null or pg_column_size(adaptations) < 2048),
  mood_before text check (mood_before is null or (mood_before like 's1.%' and length(mood_before) < 2000)),
  mood_after text check (mood_after is null or (mood_after like 's1.%' and length(mood_after) < 2000)),
  reflection text check (reflection is null or (reflection like 's1.%' and length(reflection) < 2000))
);

create index if not exists session_runs_plan_idx on public.session_runs (plan_id);
create index if not exists session_runs_student_idx on public.session_runs (student_id);

alter table public.session_runs enable row level security;

drop policy if exists session_runs_select on public.session_runs;
create policy session_runs_select on public.session_runs
  for select to authenticated
  using (student_id = auth.uid() or public.is_teacher_of_student(student_id));

drop policy if exists session_runs_insert on public.session_runs;
create policy session_runs_insert on public.session_runs
  for insert to authenticated
  with check (
    student_id = auth.uid()
    and exists (
      select 1 from public.session_plans p
      where p.id = plan_id
        and p.archived_at is null
        and public.is_member_of_group(p.group_id)
        and (p.student_id is null or p.student_id = auth.uid())
    )
  );

drop policy if exists session_runs_update on public.session_runs;
create policy session_runs_update on public.session_runs
  for update to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

-- Дитина дописує хід свого заняття, але не може переписати, чиє воно і коли
-- почалося.
revoke update on public.session_runs from authenticated;
grant update (finished_at, steps_done, mood_before, mood_after, reflection)
  on public.session_runs to authenticated;

-- ─────────────────────── Цілі ІПР і щоденник ───────────────────────

create table if not exists public.ipr_goals (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  game_id text not null check (game_id ~ '^[a-z0-9-]{1,40}$'),
  level_id text check (level_id is null or level_id ~ '^[a-z0-9-]{1,40}$'),
  metric text not null check (metric ~ '^[a-z_]{1,40}$'),
  target numeric not null,
  direction text not null check (direction in ('at_least', 'at_most')),
  due_on date,
  -- Необов'язкове пояснення цілі — зашифроване, як і щоденник.
  note text check (note is null or (note like 's1.%' and length(note) < 4000)),
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists ipr_goals_student_idx on public.ipr_goals (student_id);

alter table public.ipr_goals enable row level security;

drop policy if exists ipr_goals_select on public.ipr_goals;
create policy ipr_goals_select on public.ipr_goals
  for select to authenticated
  using (public.is_teacher_of_student(student_id));

drop policy if exists ipr_goals_insert on public.ipr_goals;
create policy ipr_goals_insert on public.ipr_goals
  for insert to authenticated
  with check (public.is_teacher_of_student(student_id) and created_by = auth.uid());

drop policy if exists ipr_goals_update on public.ipr_goals;
create policy ipr_goals_update on public.ipr_goals
  for update to authenticated
  using (public.is_teacher_of_student(student_id))
  with check (public.is_teacher_of_student(student_id));

revoke update on public.ipr_goals from authenticated;
grant update (closed_at) on public.ipr_goals to authenticated;

drop policy if exists ipr_goals_delete on public.ipr_goals;
create policy ipr_goals_delete on public.ipr_goals
  for delete to authenticated
  using (public.is_teacher_of_student(student_id));

/*
 * Щоденник фахівця. Увесь запис — рівень допомоги, поведінка, нотатка — лежить
 * в одному шифротексті: навіть «тривожний» без тексту — це вже відомості про
 * дитину. Бачить і пише лише автор.
 */
create table if not exists public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  run_id uuid references public.session_runs (id) on delete set null,
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  sealed text not null check (sealed like 's1.%' and length(sealed) < 20000)
);

create index if not exists diary_entries_student_idx on public.diary_entries (student_id);

alter table public.diary_entries enable row level security;

drop policy if exists diary_entries_select on public.diary_entries;
create policy diary_entries_select on public.diary_entries
  for select to authenticated
  using (created_by = auth.uid() and public.is_teacher_of_student(student_id));

drop policy if exists diary_entries_insert on public.diary_entries;
create policy diary_entries_insert on public.diary_entries
  for insert to authenticated
  with check (created_by = auth.uid() and public.is_teacher_of_student(student_id));

drop policy if exists diary_entries_delete on public.diary_entries;
create policy diary_entries_delete on public.diary_entries
  for delete to authenticated
  using (created_by = auth.uid());

-- ───────────────── Видалення дитини: і нові таблиці теж ─────────────────
--
-- Каскад із profiles і так забрав би все нижче, але явний перелік — це те, що
-- читають, коли питають «що саме видаляється»: він має бути повним.

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

  if coalesce((select role from public.profiles where id = p_student_id), '') <> 'student' then
    raise exception 'Only student profiles can be deleted';
  end if;

  delete from public.diary_entries where student_id = p_student_id;
  delete from public.ipr_goals where student_id = p_student_id;
  delete from public.session_runs where student_id = p_student_id;
  delete from public.session_plans where student_id = p_student_id;
  delete from public.student_adaptations where student_id = p_student_id;
  delete from public.results where user_id = p_student_id;
  delete from public.parent_links where student_id = p_student_id;
  delete from public.parent_invites where student_id = p_student_id;
  delete from public.profiles where id = p_student_id;
  delete from auth.users where id = p_student_id;
end;
$function$;

revoke all on function public.teacher_delete_student(uuid) from public, anon;
grant execute on function public.teacher_delete_student(uuid) to authenticated;
