-- Завдання від учителя: «до п'ятниці зіграйте Шульте тричі».
--
-- Досі платформа була набором вправ без адресата: дитина сама вибирала, у що
-- грати, а вчитель міг лише подивитися, що з того вийшло. Найчастіше цього
-- достатньо вдома, але не на уроці — там потрібне рівно протилежне: назвати
-- одну гру всьому класу й побачити, хто її зробив.
--
-- Навмисно НЕ зроблено: нагадувань, балів за виконання, блокування інших ігор.
-- Завдання тут — це запис «що саме потрібно», а не механізм примусу; дитина й
-- далі може грати в будь-що.

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  game_id text not null,
  -- Рівень необов'язковий: іноді вчителю важливо саме «5×5», а іноді байдуже,
  -- аби дитина зіграла.
  level_id text,
  target_attempts integer not null default 1 check (target_attempts between 1 and 20),
  -- Дата, а не мітка часу: «до п'ятниці» не має години, і питання часових поясів
  -- тут узагалі не варто відкривати.
  due_on date,
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users (id)
);

comment on table public.assignments is
  'Що вчитель задав групі. Прогрес не зберігається: він рахується з results '
  'на льоту (див. src/lib/assignments.js), інакше довелося б тримати два '
  'джерела правди про те саме й стежити за їхньою узгодженістю.';

-- Учень читає свої завдання щоразу, коли відкриває каталог, а вчитель — список
-- групи; обидва запити ходять по group_id.
create index if not exists assignments_group_id_idx on public.assignments (group_id);

alter table public.assignments enable row level security;

/*
 * Хто такий «учитель цієї групи» — питання про groups, а не про assignments,
 * тож воно виноситься у функцію: інакше той самий підзапит довелося б
 * повторювати в кожній політиці й тримати їх синхронними вручну.
 */
create or replace function public.is_teacher_of_group(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.groups
    where id = p_group_id and teacher_id = auth.uid()
  );
$function$;

create or replace function public.is_member_of_group(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and group_id = p_group_id
  );
$function$;

drop policy if exists assignments_select on public.assignments;
create policy assignments_select on public.assignments
  for select
  to authenticated
  -- Учень бачить завдання своєї групи, вчитель — своєї. Чужі не бачить ніхто.
  using (public.is_teacher_of_group(group_id) or public.is_member_of_group(group_id));

drop policy if exists assignments_insert on public.assignments;
create policy assignments_insert on public.assignments
  for insert
  to authenticated
  -- created_by з auth.uid(): запис із чужим автором не пройде перевірку.
  with check (public.is_teacher_of_group(group_id) and created_by = auth.uid());

drop policy if exists assignments_delete on public.assignments;
create policy assignments_delete on public.assignments
  for delete
  to authenticated
  using (public.is_teacher_of_group(group_id));

-- Оновлення свідомо не дозволене: завдання або є, або немає. Змінене заднім
-- числом завдання зробило б уже порахований прогрес неправдою.
