-- Журнал падінь у браузері дитини.
--
-- Досі про будь-яку помилку в застосунку ніхто не дізнавався: дитина бачила
-- білий екран, закривала вкладку, і на цьому все. Вчителька могла зателефонувати
-- через тиждень і сказати «щось не працює» — без жодної підказки, що саме.
--
-- Чому таблиця, а не Sentry: @sentry/react важить близько 25 КБ стисненим, це
-- +22% до бандла; сліди стека нерідко містять дані дитини, і відправляти їх
-- сторонньому обробнику — окреме рішення, якого ніхто не ухвалював. На
-- теперішньому масштабі групування й сповіщення Sentry просто нікому. Усе йде
-- через одну функцію на клієнті, тож перехід на Sentry потім — зміна в одному
-- файлі, а не переробка.

create table if not exists public.client_errors (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  kind text not null,
  message text not null,
  stack text,
  path text,
  user_agent text,
  constraint client_errors_kind_check check (kind in ('render', 'window', 'promise')),
  -- Довжина обмежена не для краси: запис відкритий на вставку всім, і без
  -- стелі одна вкладка могла б залити сюди мегабайти.
  constraint client_errors_message_len check (char_length(message) <= 2000),
  constraint client_errors_stack_len check (stack is null or char_length(stack) <= 8000),
  constraint client_errors_path_len check (path is null or char_length(path) <= 500),
  constraint client_errors_agent_len check (user_agent is null or char_length(user_agent) <= 500)
);

create index if not exists client_errors_time_idx on public.client_errors (occurred_at desc);

alter table public.client_errors enable row level security;

/*
 * Писати може будь-хто, включно з гостем: падіння трапляється і до входу, і
 * саме тоді воно найнеприємніше. Але підписатися чужим ім'ям не можна — або
 * запис анонімний, або від себе.
 */
drop policy if exists "Anyone can report an error" on public.client_errors;
create policy "Anyone can report an error"
  on public.client_errors for insert
  with check (user_id is null or user_id = (select auth.uid()));

/* Читати — тільки модератор. Політик на UPDATE і DELETE немає взагалі: журнал
   падінь, який можна підчистити, нічого не вартий. */
drop policy if exists "Moderators can read errors" on public.client_errors;
create policy "Moderators can read errors"
  on public.client_errors for select
  using ((select public.current_user_role()) = 'moderator');
