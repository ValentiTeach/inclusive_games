-- Спільний комп'ютер: один анонімний сеанс — одна дитина.
--
-- Досі join_group писав профіль через `on conflict (id) do update`, а клієнт
-- заводив анонімний акаунт лише якщо сесії ще не було. У класі це означало:
-- друга дитина за тією ж машиною потрапляла в сеанс першої, її ім'я
-- перезаписувало попереднє, і всі результати першої дитини — вони прив'язані
-- до того самого user_id — ставали результатами другої. Перша зникала зі
-- списку групи.
--
-- Тепер функція відмовляється змінювати ім'я наявного профілю. Клієнт, який
-- бачить іншу дитину, має завершити попередній сеанс і завести новий
-- анонімний акаунт — тоді в кожної дитини свій user_id і свої результати.
-- Ця перевірка на сервері, а не лише в інтерфейсі: клієнт не є межею безпеки,
-- і будь-який обхідний шлях (стара вкладка, помилка в коді) без неї тихо
-- псував би дані вчителя.
--
-- Машинний код помилки їде і в MESSAGE, і в DETAIL. Нестандартний SQLSTATE не
-- підходить: PostgREST перетворює його на HTTP 500, тоді як P0001 дає 400.
-- Тексти тут англійські машинні токени, а не речення: користувач їх ніколи не
-- бачить — клієнт перекладає код в українське пояснення. Дублювання в двох
-- полях знімає залежність від того, яке саме поле донесе конверт PostgREST.

create or replace function public.join_group(p_code text, p_display_name text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  -- Пробіли згортаються так само, як на клієнті (normalizeStudentName у
  -- src/lib/groups.js). Інакше «Оля  Петренко» і «Оля Петренко» були б однією
  -- дитиною для інтерфейсу і різними для цієї перевірки.
  v_name text := regexp_replace(btrim(coalesce(p_display_name, '')), '\s+', ' ', 'g');
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_group_id uuid;
  v_role text;
  v_current_name text;
begin
  if v_uid is null then
    raise exception 'not_signed_in'
      using errcode = 'P0001', detail = 'not_signed_in';
  end if;

  if v_name = '' then
    raise exception 'empty_name'
      using errcode = 'P0001', detail = 'empty_name';
  end if;

  if length(v_name) > 60 then
    raise exception 'name_too_long'
      using errcode = 'P0001', detail = 'name_too_long';
  end if;

  select id into v_group_id from public.groups where join_code = v_code;

  if v_group_id is null then
    raise exception 'invalid_code'
      using errcode = 'P0001', detail = 'invalid_code';
  end if;

  select role, regexp_replace(btrim(coalesce(display_name, '')), '\s+', ' ', 'g')
    into v_role, v_current_name
    from public.profiles
   where id = v_uid;

  -- Свіжий анонімний акаунт: профілю ще немає, заводимо.
  if not found then
    insert into public.profiles (id, display_name, group_id, role)
    values (v_uid, v_name, v_group_id, 'student');
    return;
  end if;

  -- Вчитель або модератор помилково відкрив сторінку входу за кодом. Тригер
  -- profiles_prevent_role_change не дав би понизити роль, але ім'я і групу
  -- перезаписав би — і вчитель опинився б у власному списку учнів.
  if coalesce(v_role, 'student') <> 'student' then
    raise exception 'not_a_student'
      using errcode = 'P0001', detail = 'not_a_student';
  end if;

  -- Профіль без імені (наприклад, заведений admin_set_role) вважаємо вільним.
  if v_current_name <> '' and lower(v_current_name) <> lower(v_name) then
    raise exception 'session_belongs_to_other'
      using errcode = 'P0001', detail = 'session_belongs_to_other';
  end if;

  -- Та сама дитина на тому самому пристрої: переносимо в групу, названу кодом.
  -- Повернення за своїм кодом і перехід між групами мають працювати без
  -- створення другого акаунта.
  --
  -- Ім'я не чіпаємо, якщо воно вже є: вчитель міг перейменувати учня через
  -- teacher_rename_student («Петренко Оля, 3-Б»), і повторний вхід не має
  -- відкочувати це до того, що дитина набрала колись сама.
  update public.profiles
     set display_name = case when v_current_name = '' then v_name else display_name end,
         group_id = v_group_id
   where id = v_uid;
end;
$function$;

-- Функції потрібен auth.uid(); для anon вона все одно не працює, а PUBLIC їй
-- ніколи не був потрібен. Решта RPC уже звужені так само.
revoke all on function public.join_group(text, text) from public, anon;
grant execute on function public.join_group(text, text) to authenticated;
