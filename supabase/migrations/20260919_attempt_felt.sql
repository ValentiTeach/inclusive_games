-- Дитина каже, як їй було: легко, нормально чи важко.
--
-- Двадцять змін поспіль вирішувалося, що корисно, без жодного питання до тих,
-- хто грає. Жодна метрика не відповідає на головне: чи відповідає рівень цій
-- дитині. Бал 90 може означати і «легко», і «ледве витягнула».
--
-- Оцінка не обов'язкова: екран результатів не тримає дитину, поки вона не
-- натисне. Порожньо — теж відповідь, просто мовчазна.

alter table public.results
  add column if not exists felt text;

alter table public.results
  drop constraint if exists results_felt_check;
alter table public.results
  add constraint results_felt_check check (felt is null or felt in ('easy', 'ok', 'hard'));

/*
 * Через функцію, а не через політику UPDATE на results: відкрити таблицю на
 * запис означало б дозволити переписати власний бал, і ніяка перевірка в
 * інтерфейсі цього не спинила б. Тут змінюється рівно одна колонка рівно в
 * одному рядку — своєму.
 */
create or replace function public.rate_attempt(
  p_game_id text,
  p_played_at timestamptz,
  p_felt text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = 'P0001', detail = 'not_signed_in';
  end if;

  if p_felt is not null and p_felt not in ('easy', 'ok', 'hard') then
    raise exception 'invalid_rating' using errcode = 'P0001', detail = 'invalid_rating';
  end if;

  update public.results
     set felt = p_felt
   where user_id = v_uid
     and game_id = p_game_id
     and played_at = p_played_at;
end;
$function$;
