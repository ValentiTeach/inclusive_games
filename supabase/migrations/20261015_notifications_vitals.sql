-- Сповіщення поштою і швидкість сайту в реальних браузерах.
--
-- 1. Сповіщення. Про нову заявку батьків модератор дізнавався лише з
--    лічильника в шапці, а вчитель не дізнавався нічого, поки сам не відкриє
--    групу. Тепер кожен дорослий сам вмикає (у /account) лист раз на тиждень:
--    вчителю — підсумок його груп, модератору — заявки, що чекають. Лист
--    збирає й надсилає функція supabase/functions/weekly-digest; тут — що
--    саме вона бере з бази, і більше нічого. Без згоди людини листів немає.
-- 2. Web Vitals (web_vitals). Наскільки швидко сайт відкривається на
--    шкільних телефонах і планшетах — виміряно в браузерах дітей, а не на
--    комп'ютері розробника. Без користувача: лише показник, сторінка без
--    id, тип пристрою, тип мережі й версія сайту. Строк — 90 днів.


-- ───────────────────────── Налаштування сповіщень ─────────────────────────

create table if not exists public.notification_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  weekly_digest boolean not null default false,
  parent_requests boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.notification_settings enable row level security;

drop policy if exists notification_settings_own on public.notification_settings;
create policy notification_settings_own on public.notification_settings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));


/*
 * Що потрапляє в тижневий лист учителю. Лише для тих, хто ввімкнув лист сам,
 * і лише про групи, які він веде (власник чи фахівець). Імена дітей у листі —
 * лише тих, хто тиждень не грав, і не більше десяти: лист іде на пошту, а
 * пошта — не місце для повного списку класу.
 *
 * Кличе лише сервер (service_role у функції weekly-digest): жодному
 * користувачеві чужі адреси й групи не віддаються.
 */
create or replace function public.weekly_digest_payload()
returns table (user_id uuid, email text, display_name text, groups jsonb)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with teachers as (
    select n.user_id, u.email::text as email, p.display_name
      from public.notification_settings n
      join auth.users u on u.id = n.user_id
      join public.profiles p on p.id = n.user_id
     where n.weekly_digest and u.email is not null
  ),
  team as (
    select t.user_id, g.id as group_id, g.name
      from teachers t
      join public.groups g on g.teacher_id = t.user_id
    union
    select t.user_id, g.id, g.name
      from teachers t
      join public.group_specialists s on s.specialist_id = t.user_id
      join public.groups g on g.id = s.group_id
  ),
  per_group as (
    select tm.user_id,
           tm.name,
           count(distinct st.id) as students,
           count(distinct r.user_id) filter (where r.played_at > now() - interval '7 days') as active,
           count(r.id) filter (where r.played_at > now() - interval '7 days') as attempts,
           (
             select coalesce(jsonb_agg(q.display_name order by q.display_name), '[]'::jsonb)
               from (
                 select s2.display_name
                   from public.profiles s2
                  where s2.group_id = tm.group_id and s2.role = 'student'
                    and not exists (
                      select 1 from public.results r2
                       where r2.user_id = s2.id and r2.played_at > now() - interval '7 days'
                    )
                  order by s2.display_name
                  limit 10
               ) q
           ) as inactive
      from team tm
      left join public.profiles st on st.group_id = tm.group_id and st.role = 'student'
      left join public.results r on r.user_id = st.id
     group by tm.user_id, tm.group_id, tm.name
  )
  select t.user_id, t.email, t.display_name,
         coalesce(
           jsonb_agg(
             jsonb_build_object(
               'name', pg.name,
               'students', pg.students,
               'active', pg.active,
               'attempts', pg.attempts,
               'inactive', pg.inactive
             ) order by pg.name
           ) filter (where pg.name is not null),
           '[]'::jsonb
         )
    from teachers t
    left join per_group pg on pg.user_id = t.user_id
   group by t.user_id, t.email, t.display_name;
$function$;

revoke all on function public.weekly_digest_payload() from public, anon, authenticated;


/* Модератори, що ввімкнули сповіщення про заявки, і скільки заявок чекає. */
create or replace function public.moderator_digest_payload()
returns table (email text, pending integer)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select u.email::text,
         (select count(*)::integer from public.parent_requests where status = 'pending')
    from public.notification_settings n
    join public.profiles p on p.id = n.user_id and p.role = 'moderator'
    join auth.users u on u.id = n.user_id
   where n.parent_requests and u.email is not null
     and exists (select 1 from public.parent_requests where status = 'pending');
$function$;

revoke all on function public.moderator_digest_payload() from public, anon, authenticated;


-- ───────────────────────── Web Vitals ─────────────────────────

create table if not exists public.web_vitals (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  name text not null,
  value double precision not null,
  rating text,
  path text,
  device text,
  effective_type text,
  build text,
  constraint web_vitals_name_check check (name in ('LCP', 'INP', 'CLS', 'FCP', 'TTFB')),
  constraint web_vitals_value_check check (value >= 0 and value < 600000),
  constraint web_vitals_rating_check
    check (rating is null or rating in ('good', 'needs-improvement', 'poor')),
  constraint web_vitals_device_check check (device is null or device in ('phone', 'tablet', 'desktop')),
  constraint web_vitals_path_len check (path is null or char_length(path) <= 200),
  constraint web_vitals_type_len check (effective_type is null or char_length(effective_type) <= 20),
  constraint web_vitals_build_len check (build is null or char_length(build) <= 40)
);

create index if not exists web_vitals_time_idx on public.web_vitals (at desc);

alter table public.web_vitals enable row level security;

drop policy if exists web_vitals_insert on public.web_vitals;
create policy web_vitals_insert on public.web_vitals
  for insert to anon, authenticated
  with check (true);

drop policy if exists web_vitals_select_moderator on public.web_vitals;
create policy web_vitals_select_moderator on public.web_vitals
  for select to authenticated
  using ((select public.current_user_role()) = 'moderator');

-- Ліміт — на тій самій основі, що й журнал падінь (20261013). Новий вид дії
-- треба дописати в перелік дозволених.
alter table public.rate_limit_events drop constraint if exists rate_limit_events_action_check;
alter table public.rate_limit_events add constraint rate_limit_events_action_check
  check (action in ('join_group', 'parent_code', 'client_error', 'feedback', 'web_vital'));

/*
 * П'ять показників на сторінку, кілька сторінок за візит — 60 на годину з
 * адреси вистачає з запасом навіть класу; 5000 на годину загалом, щоб таблиця
 * не розрослася від чийогось скрипта. Зайве мовчки відкидається.
 */
create or replace function public.web_vitals_throttle()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if public.rate_limited('web_vital', 60, 300, interval '1 hour') then
    return null;
  end if;
  if (select count(*) from public.web_vitals where at > now() - interval '1 hour') >= 5000 then
    return null;
  end if;
  perform public.note_rate_event('web_vital');
  return new;
end;
$function$;

drop trigger if exists web_vitals_throttle on public.web_vitals;
create trigger web_vitals_throttle
  before insert on public.web_vitals
  for each row execute function public.web_vitals_throttle();


create or replace function public.purge_old_web_vitals(p_days integer default 90)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_count integer;
begin
  if auth.uid() is not null and coalesce(public.current_user_role(), '') <> 'moderator' then
    raise exception 'Only a moderator can purge web vitals';
  end if;
  delete from public.web_vitals where at < now() - make_interval(days => greatest(p_days, 14));
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

revoke all on function public.purge_old_web_vitals(integer) from public, anon;
grant execute on function public.purge_old_web_vitals(integer) to authenticated;


-- ───────────────────────── Розклад ─────────────────────────
--
-- Тижневий лист — функцією supabase/functions/weekly-digest (див. README),
-- щопонеділка о 06:00 UTC (09:00 за Києвом). Після ввімкнення pg_cron і pg_net:
--
--   select cron.schedule(
--     'weekly-digest',
--     '0 6 * * 1',
--     $$select net.http_post(
--         url := 'https://uwostumcmuxmocexpnic.supabase.co/functions/v1/weekly-digest',
--         headers := jsonb_build_object('x-digest-secret', '<DIGEST_SECRET>')
--       )$$
--   );
--   select cron.schedule('purge-old-web-vitals', '30 3 1 * *',
--     $$select public.purge_old_web_vitals(90)$$);
