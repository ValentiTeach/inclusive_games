-- Журнал падінь зі строком, відгуки, ліміти спроб і видалення власного акаунта.
--
-- Чотири речі, кожна закриває дірку, яку видно з самого коду:
--
-- 1. Строк для client_errors. Дані дітей видаляються через 12 місяців, а
--    журнал падінь (user_id, шлях сторінки, браузер) ріс без кінця.
--    purge_old_client_errors видаляє записи, старші за 90 днів. Тут же колонка
--    `build` — версія збірки, у якій впало: без неї не видно, чи помилка
--    стара, чи її принесла вчорашня викладка.
-- 2. Відгуки (feedback): «Повідомити про проблему / ідею» з підвалу. Окрема
--    таблиця, а не ще один `kind` у журналі падінь: тут є контакт, який
--    людина лишила сама, статус «розібрано» і власний строк зберігання.
-- 3. Ліміти. join_group і redeem_parent_invite можна було викликати скільки
--    завгодно — коди груп і батьків перебиралися б. Вставка в client_errors
--    відкрита навіть гостю, і журнал можна було засмітити.
-- 4. Видалення власного акаунта для вчителя й батьків (delete_my_account) і
--    передача груп колезі перед тим (transfer_my_groups).
--
-- Перевірки прав — у функціях, а не в інтерфейсі: клієнт не є межею безпеки.


-- ───────────────────────── Ліміти: спільна основа ─────────────────────────

/*
 * Позначки «тут була спроба». Живуть добу: довше вони нічого не обмежують,
 * а зберігати їх без мети — зайві дані. Чистяться на кожному виклику
 * rate_limited, без окремого розкладу.
 *
 * Адреса — не сама IP, а її md5: рахувати спроби з однієї машини це дозволяє,
 * а прочитати адресу, заглянувши в таблицю, — ні. Це псевдонімізація, а не
 * анонімізація (IPv4 перебирається), тому й строк — доба.
 *
 * Політик немає взагалі: таблицю бачать і пишуть лише функції нижче.
 */
create table if not exists public.rate_limit_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  action text not null,
  -- Без зовнішнього ключа: позначка, що проживе добу, не має заважати
  -- видаленню користувача.
  user_id uuid,
  ip_hash text,
  constraint rate_limit_events_action_check
    check (action in ('join_group', 'parent_code', 'client_error', 'feedback'))
);

create index if not exists rate_limit_events_lookup_idx
  on public.rate_limit_events (action, at desc);

alter table public.rate_limit_events enable row level security;
revoke all on public.rate_limit_events from public, anon, authenticated;


/* md5 адреси, з якої прийшов запит, або null, якщо PostgREST її не передав. */
create or replace function public.request_ip_hash()
returns text
language plpgsql
stable
set search_path to 'public'
as $function$
declare
  v_headers json;
  v_ip text;
begin
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    return null;
  end;

  v_ip := btrim(split_part(coalesce(
    v_headers ->> 'cf-connecting-ip',
    v_headers ->> 'x-forwarded-for',
    v_headers ->> 'x-real-ip',
    ''
  ), ',', 1));

  return case when v_ip = '' then null else md5(v_ip) end;
end;
$function$;

revoke all on function public.request_ip_hash() from public, anon, authenticated;


/*
 * Чи вичерпано ліміт дії за вікно. Рахує окремо від користувача й від адреси:
 * у комп'ютерному класі тридцять дітей ходять з однієї IP, тож межа на адресу
 * завжди щедріша за межу на одного користувача. Нова анонімна сесія ліміт на
 * користувача обходить — тому й потрібна межа на адресу (а саме створення
 * анонімних сесій Supabase і так обмежує за IP).
 */
create or replace function public.rate_limited(
  p_action text,
  p_user_limit integer,
  p_ip_limit integer,
  p_window interval
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_ip text := public.request_ip_hash();
begin
  delete from public.rate_limit_events where at < now() - interval '1 day';

  if v_uid is not null and (
    select count(*) from public.rate_limit_events
     where action = p_action and user_id = v_uid and at > now() - p_window
  ) >= p_user_limit then
    return true;
  end if;

  if v_ip is not null and (
    select count(*) from public.rate_limit_events
     where action = p_action and ip_hash = v_ip and at > now() - p_window
  ) >= p_ip_limit then
    return true;
  end if;

  return false;
end;
$function$;

revoke all on function public.rate_limited(text, integer, integer, interval) from public, anon, authenticated;


create or replace function public.note_rate_event(p_action text)
returns void
language sql
security definer
set search_path to 'public'
as $function$
  insert into public.rate_limit_events (action, user_id, ip_hash)
  values (p_action, auth.uid(), public.request_ip_hash());
$function$;

revoke all on function public.note_rate_event(text) from public, anon, authenticated;


-- ───────────────────────── Код групи: try_join_group ─────────────────────────

/*
 * Чому нова функція, а не правка join_group.
 *
 * Невдалу спробу треба записати. Але join_group повідомляє про невірний код
 * винятком, а виняток відкочує всю транзакцію — разом із записом про спробу.
 * Лічильник, що рахує лише вдалі виклики, нічого не обмежує.
 *
 * Тому try_join_group викликає join_group усередині блоку з обробником: блок
 * — це вкладена транзакція, її відкат не зачіпає зовнішньої, і запис про
 * спробу лишається. Про невірний код і про ліміт функція каже **значенням**
 * (токен рядком), а не винятком — інакше відкотився б і запис. Решта помилок
 * (порожнє ім'я, чужий сеанс) летять далі як були: вони не про перебір.
 *
 * Повертає null, якщо дитина в групі.
 *
 * Ліміт: 10 невірних кодів за 15 хвилин з одного сеансу, 60 — з однієї
 * адреси (клас за спільним NAT, де хтось помиляється в літері).
 */
create or replace function public.try_join_group(p_code text, p_display_name text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_detail text;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = 'P0001', detail = 'not_signed_in';
  end if;

  if public.rate_limited('join_group', 10, 60, interval '15 minutes') then
    return 'too_many_attempts';
  end if;

  begin
    perform public.join_group(p_code, p_display_name);
  exception when raise_exception then
    get stacked diagnostics v_detail = pg_exception_detail;
    if v_detail = 'invalid_code' then
      perform public.note_rate_event('join_group');
      return 'invalid_code';
    end if;
    raise;
  end;

  return null;
end;
$function$;

revoke all on function public.try_join_group(text, text) from public, anon;
grant execute on function public.try_join_group(text, text) to authenticated;

-- Старий вхід без ліміту закривається: інакше перебір просто пішов би через
-- нього. Клієнт, що завантажився до викладки, отримає «не вдалося» замість
-- входу — до першого оновлення сторінки. try_join_group кличе join_group як
-- власник, тож право йому не потрібне.
revoke execute on function public.join_group(text, text) from authenticated;


-- ───────────────────────── Код батьків: try_redeem_parent_invite ─────────────────────────

/*
 * Те саме для коду батьків. Код довший (8 знаків із 32), живе 7 днів і дає
 * лише заявку модератору — перебір тут малоймовірний, але й ліміт нічого не
 * коштує дорослому, що вводить свій код.
 *
 * Повертає {"request_id": "…"} або {"error": "invalid_code" | "too_many_attempts"}.
 *
 * Ліміт: 5 невірних кодів за годину з акаунта, 20 — з адреси.
 */
create or replace function public.try_redeem_parent_invite(p_code text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_detail text;
  v_request uuid;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = 'P0001', detail = 'not_signed_in';
  end if;

  if public.rate_limited('parent_code', 5, 20, interval '1 hour') then
    return jsonb_build_object('error', 'too_many_attempts');
  end if;

  begin
    v_request := public.redeem_parent_invite(p_code);
  exception when raise_exception then
    get stacked diagnostics v_detail = pg_exception_detail;
    if v_detail = 'invalid_code' then
      perform public.note_rate_event('parent_code');
      return jsonb_build_object('error', 'invalid_code');
    end if;
    raise;
  end;

  return jsonb_build_object('request_id', v_request);
end;
$function$;

revoke all on function public.try_redeem_parent_invite(text) from public, anon;
grant execute on function public.try_redeem_parent_invite(text) to authenticated;

revoke execute on function public.redeem_parent_invite(text) from authenticated;


-- ───────────────────────── Журнал падінь ─────────────────────────

alter table public.client_errors add column if not exists build text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'client_errors_build_len'
  ) then
    alter table public.client_errors
      add constraint client_errors_build_len check (build is null or char_length(build) <= 40);
  end if;
end;
$$;

/*
 * Стеля на вставку. Повертає null — і рядок мовчки не пишеться, без помилки:
 * звіт про падіння не має сам падати. На клієнті вже є стеля «10 на сеанс»,
 * але клієнт — не межа безпеки.
 *
 * 20 на годину з сеансу, 60 з адреси (клас), 2000 на годину загалом — щоб
 * навіть розподілений потік не зробив журнал нечитним.
 */
create or replace function public.client_errors_throttle()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if public.rate_limited('client_error', 20, 60, interval '1 hour') then
    return null;
  end if;

  if (
    select count(*) from public.client_errors where occurred_at > now() - interval '1 hour'
  ) >= 2000 then
    return null;
  end if;

  perform public.note_rate_event('client_error');
  return new;
end;
$function$;

drop trigger if exists client_errors_throttle on public.client_errors;
create trigger client_errors_throttle
  before insert on public.client_errors
  for each row execute function public.client_errors_throttle();


/*
 * Строк журналу — 90 днів. Помилка, якій три місяці, або вже виправлена, або
 * повторилася й лежить свіжим рядком.
 *
 * Кличе модератор (з адмінки) або сервер (pg_cron, SQL у панелі — там
 * auth.uid() порожній). Менше 30 днів не приймається: випадкове «0» не має
 * стерти журнал, поки помилку ще розбирають.
 */
create or replace function public.purge_old_client_errors(p_days integer default 90)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_count integer;
begin
  if auth.uid() is not null and coalesce(public.current_user_role(), '') <> 'moderator' then
    raise exception 'Only a moderator can purge the error log';
  end if;

  delete from public.client_errors
   where occurred_at < now() - make_interval(days => greatest(p_days, 30));
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

revoke all on function public.purge_old_client_errors(integer) from public, anon;
grant execute on function public.purge_old_client_errors(integer) to authenticated;


-- ───────────────────────── Відгуки ─────────────────────────

create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  kind text not null,
  message text not null,
  -- Пошта чи телефон — лише якщо людина сама хоче відповіді.
  contact text,
  path text,
  user_agent text,
  build text,
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null,
  constraint feedback_kind_check check (kind in ('problem', 'idea', 'accessibility', 'other')),
  constraint feedback_message_len check (char_length(btrim(message)) between 1 and 2000),
  constraint feedback_contact_len check (contact is null or char_length(contact) <= 200),
  constraint feedback_path_len check (path is null or char_length(path) <= 500),
  constraint feedback_agent_len check (user_agent is null or char_length(user_agent) <= 500),
  constraint feedback_build_len check (build is null or char_length(build) <= 40)
);

create index if not exists feedback_time_idx on public.feedback (created_at desc);

comment on table public.feedback is
  'Повідомлення з форми «Повідомити про проблему / ідею». Видаляються через 12 місяців.';

alter table public.feedback enable row level security;

/* Писати може будь-хто, як і в журнал падінь, — але не чужим іменем і не
   одразу «розібраним». */
drop policy if exists feedback_insert on public.feedback;
create policy feedback_insert on public.feedback
  for insert to anon, authenticated
  with check (
    (user_id is null or user_id = (select auth.uid()))
    and resolved_at is null
    and resolved_by is null
  );

drop policy if exists feedback_select_moderator on public.feedback;
create policy feedback_select_moderator on public.feedback
  for select to authenticated
  using ((select public.current_user_role()) = 'moderator');

-- Модератор позначає «розібрано» і видаляє спам. Змінити сам текст не може
-- ніхто: колонки, відкриті на зміну, перелічено явно.
drop policy if exists feedback_update_moderator on public.feedback;
create policy feedback_update_moderator on public.feedback
  for update to authenticated
  using ((select public.current_user_role()) = 'moderator')
  with check ((select public.current_user_role()) = 'moderator');

drop policy if exists feedback_delete_moderator on public.feedback;
create policy feedback_delete_moderator on public.feedback
  for delete to authenticated
  using ((select public.current_user_role()) = 'moderator');

revoke update on public.feedback from anon, authenticated;
grant update (resolved_at, resolved_by) on public.feedback to authenticated;


create or replace function public.feedback_throttle()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if public.rate_limited('feedback', 5, 20, interval '1 hour') then
    raise exception 'too_many_attempts' using errcode = 'P0001', detail = 'too_many_attempts';
  end if;

  if (
    select count(*) from public.feedback where created_at > now() - interval '1 hour'
  ) >= 200 then
    raise exception 'too_many_attempts' using errcode = 'P0001', detail = 'too_many_attempts';
  end if;

  perform public.note_rate_event('feedback');
  return new;
end;
$function$;

drop trigger if exists feedback_throttle on public.feedback;
create trigger feedback_throttle
  before insert on public.feedback
  for each row execute function public.feedback_throttle();


/* Строк відгуків — 12 місяців, як і даних дітей: у відгуку буває контакт. */
create or replace function public.purge_old_feedback(p_days integer default 365)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_count integer;
begin
  if auth.uid() is not null and coalesce(public.current_user_role(), '') <> 'moderator' then
    raise exception 'Only a moderator can purge feedback';
  end if;

  delete from public.feedback
   where created_at < now() - make_interval(days => greatest(p_days, 90));
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

revoke all on function public.purge_old_feedback(integer) from public, anon;
grant execute on function public.purge_old_feedback(integer) to authenticated;


-- ───────────────────────── Власний акаунт ─────────────────────────

/*
 * Передати всі свої групи іншому вчителю — перед видаленням акаунта або коли
 * фахівець іде з закладу. Колега має вже бути зареєстрований поштою і мати
 * роль вчителя чи модератора.
 *
 * Разом із групами переходить авторство завдань, занять і цілей ІПР: інакше
 * новий учитель їх бачив би, але не міг редагувати, а видалення старого
 * акаунта впиралося б у зовнішні ключі.
 *
 * Щоденник і настрій дітей НЕ переходять: вони зашифровані ключем старого
 * вчителя, і новий їх не прочитає за жодних умов.
 *
 * Повертає кількість переданих груп.
 */
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

revoke all on function public.transfer_my_groups(text) from public, anon;
grant execute on function public.transfer_my_groups(text) to authenticated;


/*
 * Видалити власний акаунт — вчителю чи батькам.
 *
 * - Учень не може: його дані — під згодою батьків, і видаляє їх учитель
 *   або модератор (purge_student).
 * - Модератор не може: платформа лишилася б без модератора. Спершу інший
 *   модератор знімає з нього роль.
 * - Вчитель із групами — лише з явним p_delete_groups: тоді назавжди
 *   видаляються й усі діти цих груп. Інакше — 'has_groups', і інтерфейс
 *   пропонує спершу передати групи колезі.
 *
 * Сховище щоденника (specialist_vaults) видаляється разом з акаунтом, а з ним
 * і можливість будь-коли прочитати записи щоденника, — тому самі записи теж.
 */
create or replace function public.delete_my_account(p_delete_groups boolean default false)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_student uuid;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = 'P0001', detail = 'not_signed_in';
  end if;

  select role into v_role from public.profiles where id = v_uid;

  if (select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false))
     or v_role = 'student' then
    raise exception 'student_account' using errcode = 'P0001', detail = 'student_account';
  end if;

  if v_role = 'moderator' then
    raise exception 'moderator_account' using errcode = 'P0001', detail = 'moderator_account';
  end if;

  if exists (select 1 from public.groups where teacher_id = v_uid) then
    if not coalesce(p_delete_groups, false) then
      raise exception 'has_groups' using errcode = 'P0001', detail = 'has_groups';
    end if;

    for v_student in
      select p.id from public.profiles p
        join public.groups g on g.id = p.group_id
       where g.teacher_id = v_uid and p.role = 'student'
    loop
      perform public.purge_student(v_student);
    end loop;

    -- Не-учні в групі (рідкісний випадок ручної зміни ролі) лишаються, але
    -- без групи.
    update public.profiles set group_id = null
     where group_id in (select id from public.groups where teacher_id = v_uid);

    delete from public.groups where teacher_id = v_uid;
  end if;

  -- Те, що лишилося від колишніх груп і чужих дітей, яких колись вів.
  delete from public.assignments where created_by = v_uid;
  delete from public.session_plans where created_by = v_uid;
  delete from public.ipr_goals where created_by = v_uid;
  delete from public.diary_entries where created_by = v_uid;
  delete from public.session_templates where owner_id = v_uid;
  delete from public.specialist_vaults where owner_id = v_uid;
  delete from public.parent_invites where created_by = v_uid;

  -- Батьківський бік.
  delete from public.parent_links where parent_id = v_uid;
  delete from public.parent_requests where parent_id = v_uid;

  -- Власні спроби (вчитель теж буває грає).
  delete from public.results where user_id = v_uid;

  delete from public.profiles where id = v_uid;
  delete from auth.users where id = v_uid;
end;
$function$;

revoke all on function public.delete_my_account(boolean) from public, anon;
grant execute on function public.delete_my_account(boolean) to authenticated;


-- ───────────────────────── Розклад ─────────────────────────
--
-- Очищення журналу й відгуків — у тому самому щомісячному pg_cron, що й строк
-- зберігання дітей (див. 20261005_data_retention.sql). Після ввімкнення
-- розширення pg_cron:
--
--   select cron.schedule(
--     'purge-old-client-errors',
--     '10 3 1 * *',
--     $$select public.purge_old_client_errors(90)$$
--   );
--   select cron.schedule(
--     'purge-old-feedback',
--     '20 3 1 * *',
--     $$select public.purge_old_feedback(365)$$
--   );
--
-- На відміну від дітей, тут перший запуск без людини безпечний: журнал і
-- відгуки — службові дані, і рішення «що видалити» в них не потребує очей.
-- Але міграція все одно розклад не вмикає — pg_cron вмикається в панелі.
