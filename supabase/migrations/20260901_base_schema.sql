-- Базова схема, що досі жила лише на хостингу.
--
-- Таблиці profiles, groups, results, їхні політики, current_user_role,
-- is_teacher_of_student, admin_list_users і тригер prevent_role_change
-- створено колись у панелі Supabase. У репозиторії їх не було — і проєкт не
-- можна було відновити з міграцій: уже перша з них (20260903) спирається на
-- is_teacher_of_student, а десятки політик — на current_user_role.
--
-- Тексти відновлено з поведінки, яку видно з коду й наступних міграцій, а не
-- скопійовано з хостингу. Тому все тут створюється ЛИШЕ ЯКЩО ЙОГО НЕМАЄ:
--
--   - таблиці — `create table if not exists`;
--   - функції — лише коли функції з таким підписом немає;
--   - політики — лише для таблиці, на якій політик немає зовсім.
--
-- На живому проєкті ця міграція нічого не змінює. На порожньому (новий
-- проєкт, локальна база, відновлення після катастрофи) вона дає робочу схему,
-- на яку лягають усі наступні. Перевірено саме так: усі міграції по черзі на
-- чистому Postgres 16 із заглушкою auth-схеми Supabase.
--
-- Звірити з хостингом (SQL-редактор панелі):
--
--   select proname, pg_get_functiondef(oid) from pg_proc
--    where pronamespace = 'public'::regnamespace
--      and proname in ('current_user_role', 'is_teacher_of_student',
--                      'admin_list_users', 'prevent_role_change');
--   select tablename, policyname, cmd, qual, with_check from pg_policies
--    where tablename in ('profiles', 'groups', 'results');
--
-- Якщо щось розходиться по суті — перенести сюди хостингову версію.


-- ───────────────────────── Таблиці ─────────────────────────

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  join_code text not null unique,
  teacher_id uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  group_id uuid references public.groups (id) on delete set null,
  role text not null default 'student',
  created_at timestamptz not null default now()
);

create index if not exists profiles_group_idx on public.profiles (group_id);

create table if not exists public.results (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  game_id text not null,
  level_id text,
  score integer not null,
  entries jsonb,
  played_at timestamptz not null default now()
);

create index if not exists results_user_idx on public.results (user_id, played_at desc);

alter table public.groups enable row level security;
alter table public.profiles enable row level security;
alter table public.results enable row level security;


-- ───────────────────────── Функції ─────────────────────────

do $migration$
begin
  -- Роль поточного користувача. security definer: інакше політика profiles,
  -- що кличе цю функцію, читала б profiles під власною ж політикою.
  if to_regprocedure('public.current_user_role()') is null then
    execute $f$
      create function public.current_user_role()
      returns text
      language sql
      stable
      security definer
      set search_path to 'public'
      as $body$
        select role from public.profiles where id = auth.uid();
      $body$
    $f$;
  end if;

  -- Чи веде поточний користувач групу цієї дитини. Наступна міграція з
  -- фахівцями групи (20261015_team_avatars.sql) розширює її зміст.
  if to_regprocedure('public.is_teacher_of_student(uuid)') is null then
    execute $f$
      create function public.is_teacher_of_student(p_student_id uuid)
      returns boolean
      language sql
      stable
      security definer
      set search_path to 'public'
      as $body$
        select exists (
          select 1
            from public.profiles p
            join public.groups g on g.id = p.group_id
           where p.id = p_student_id and g.teacher_id = auth.uid()
        );
      $body$
    $f$;
  end if;

  -- Усі користувачі для адмінки — колонки ті, що читає src/lib/admin.js.
  if to_regprocedure('public.admin_list_users()') is null then
    execute $f$
      create function public.admin_list_users()
      returns table (
        id uuid,
        email text,
        display_name text,
        is_anonymous boolean,
        group_name text,
        role text,
        created_at timestamptz
      )
      language plpgsql
      stable
      security definer
      set search_path to 'public'
      as $body$
      begin
        if coalesce(public.current_user_role(), '') <> 'moderator' then
          raise exception 'Only moderators can list users';
        end if;

        return query
          select u.id, u.email::text, p.display_name, coalesce(u.is_anonymous, false),
                 g.name, coalesce(p.role, 'student'), u.created_at
            from auth.users u
            left join public.profiles p on p.id = u.id
            left join public.groups g on g.id = p.group_id
           order by u.created_at desc;
      end;
      $body$
    $f$;
    execute 'revoke all on function public.admin_list_users() from public, anon';
    execute 'grant execute on function public.admin_list_users() to authenticated';
  end if;

  /*
   * Ніхто не призначає роль сам собі. Пропускає:
   *   - модератора (admin_set_role прапорця не ставить — отже, хостинговий
   *     тригер пропускає саме роль модератора);
   *   - функцію, що поставила app.role_change_allowed на час транзакції
   *     (admin_decide_parent_request);
   *   - сервер без користувача (SQL у панелі, pg_cron).
   * Новий профіль від самого користувача — лише 'student' (join_group) або
   * 'teacher' (реєстрація поштою в AuthContext).
   */
  if to_regprocedure('public.prevent_role_change()') is null then
    execute $f$
      create function public.prevent_role_change()
      returns trigger
      language plpgsql
      security definer
      set search_path to 'public'
      as $body$
      begin
        if auth.uid() is null
           or current_setting('app.role_change_allowed', true) = '1'
           or coalesce(public.current_user_role(), '') = 'moderator' then
          return new;
        end if;

        if tg_op = 'INSERT' then
          if coalesce(new.role, 'student') not in ('student', 'teacher') then
            raise exception 'Role % cannot be self-assigned', new.role;
          end if;
          return new;
        end if;

        if new.role is distinct from old.role then
          raise exception 'Changing role is not allowed';
        end if;
        return new;
      end;
      $body$
    $f$;
  end if;

  if not exists (
    select 1 from pg_trigger
     where tgrelid = 'public.profiles'::regclass and not tgisinternal
       and (tgname = 'profiles_prevent_role_change'
            or tgfoid = 'public.prevent_role_change()'::regprocedure)
  ) then
    execute $f$
      create trigger profiles_prevent_role_change
        before insert or update on public.profiles
        for each row execute function public.prevent_role_change()
    $f$;
  end if;
end;
$migration$;


-- ───────────────────────── Політики ─────────────────────────
--
-- Лише для таблиць без жодної політики, тобто лише на порожній базі. Зміст —
-- той, що видно з коду: дитина бачить себе й свої спроби, учитель — дітей і
-- спроби своїх груп, модератор — усе. Батьківські політики додає
-- 20260917_parent_role.sql.

do $migration$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'groups') then
    create policy groups_select on public.groups for select to authenticated
      using (
        teacher_id = (select auth.uid())
        or id = (select group_id from public.profiles where id = (select auth.uid()))
        or (select public.current_user_role()) = 'moderator'
      );
    create policy groups_insert on public.groups for insert to authenticated
      with check (
        teacher_id = (select auth.uid())
        and (select public.current_user_role()) in ('teacher', 'moderator')
      );
    create policy groups_update on public.groups for update to authenticated
      using (teacher_id = (select auth.uid()))
      with check (teacher_id = (select auth.uid()));
    create policy groups_delete on public.groups for delete to authenticated
      using (teacher_id = (select auth.uid()));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles') then
    create policy profiles_select on public.profiles for select to authenticated
      using (
        id = (select auth.uid())
        or public.is_teacher_of_student(id)
        or (select public.current_user_role()) = 'moderator'
      );
    create policy profiles_insert_own on public.profiles for insert to authenticated
      with check (id = (select auth.uid()));
    -- Свою роль змінити не дасть тригер; ім'я й групу дитина міняє через
    -- join_group, а вчитель — через teacher_rename_student.
    create policy profiles_update_own on public.profiles for update to authenticated
      using (id = (select auth.uid()))
      with check (id = (select auth.uid()));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'results') then
    create policy results_select on public.results for select to authenticated
      using (
        user_id = (select auth.uid())
        or public.is_teacher_of_student(user_id)
        or (select public.current_user_role()) = 'moderator'
      );
    create policy results_insert_own on public.results for insert to authenticated
      with check (user_id = (select auth.uid()));
  end if;
end;
$migration$;
