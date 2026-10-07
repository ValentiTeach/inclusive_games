-- Доступ батьків лише за схваленням модератора.
--
-- Досі код від учителя відкривав дитину одразу: дорослий вводив код — і в ту ж
-- мить мав parent_links. Код диктують уголос і переписують на папір, тож
-- єдиним доказом, що це справді батько, було те, що код опинився в нього. Тепер
-- код лише подає заявку: дорослий називає дитину кодом, а модератор бачить
-- пошту заявника, дитину, клас, вчителя, який виписав код, — і вирішує.
--
-- Роль 'parent' теж призначається тільки тут (або вручну в admin_set_role):
-- redeem_parent_invite її більше не чіпає. Це заодно виправляє те, що доросла
-- людина, яка зареєструвалась поштою, отримувала роль 'teacher' і ніколи не
-- ставала 'parent' (redeem міняв роль лише в того, хто 'student').
--
-- Міграція застосовується окремо від викладки коду. Поки її немає, сторінка
-- модератора каже, що саме застосувати, а код батьків працює по-старому.


-- ───────────────────────── Заявки ─────────────────────────

create table if not exists public.parent_requests (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references auth.users (id) on delete cascade,
  -- Каскад по дитині: видалення учня (purge_student) прибирає і заявки на нього,
  -- і ім'я дитини в них, — окремого рядка в purge_student не потрібно.
  student_id uuid not null references public.profiles (id) on delete cascade,
  -- Код, яким подано заявку. Без зовнішнього ключа навмисно: purge_student
  -- видаляє parent_invites раніше за profiles, і ключ зупинив би видалення.
  invite_code text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users (id) on delete set null
);

comment on table public.parent_requests is
  'Заявка дорослого на доступ до результатів дитини. Подає redeem_parent_invite, '
  'вирішує лише модератор (admin_decide_parent_request). Доступ дає parent_links, '
  'який з''являється тільки після схвалення.';

-- Одна жива заявка на пару «дорослий — дитина»: повторне натискання не має
-- плодити рядки в черзі модератора.
create unique index if not exists parent_requests_one_pending_idx
  on public.parent_requests (parent_id, student_id)
  where status = 'pending';

create index if not exists parent_requests_status_idx
  on public.parent_requests (status, created_at);

alter table public.parent_requests enable row level security;

-- Писати в таблицю не може ніхто напряму: рядок створює redeem_parent_invite,
-- а вирішує admin_decide_parent_request. Тому ні INSERT, ні UPDATE, ні DELETE
-- не видані навіть authenticated.
revoke all on public.parent_requests from anon, authenticated;
grant select on public.parent_requests to authenticated;

-- Дорослий бачить власні заявки — щоб знати, що відповів модератор.
drop policy if exists parent_requests_select_own on public.parent_requests;
create policy parent_requests_select_own on public.parent_requests
  for select to authenticated
  using (parent_id = (select auth.uid()));

-- Модератор бачить усі: з цього рахується лічильник у шапці.
drop policy if exists parent_requests_select_moderator on public.parent_requests;
create policy parent_requests_select_moderator on public.parent_requests
  for select to authenticated
  using ((select public.current_user_role()) = 'moderator');


-- ───────────────────────── Код → заявка ─────────────────────────

/*
 * Дорослий уводить код. Перевірки ті самі, що й раніше, але замість доступу
 * з'являється заявка. Код при цьому згоряє одразу: один код — один дорослий,
 * інакше той, хто підслухав код, подав би другу заявку на ту саму дитину, коли
 * перша ще чекає. Відхилена заявка — це спалений код; учитель виписує новий.
 *
 * Повертає id заявки, а не дитини: дитина дорослому ще не відкрита, і знати її
 * id йому нема навіщо.
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
  v_invite public.parent_invites%rowtype;
  v_request uuid;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = 'P0001', detail = 'not_signed_in';
  end if;

  if (select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) then
    raise exception 'anonymous_not_allowed'
      using errcode = 'P0001', detail = 'anonymous_not_allowed';
  end if;

  -- for update: два одночасні виклики з одним кодом не мають обидва пройти
  -- перевірку used_at.
  select * into v_invite from public.parent_invites where code = v_code for update;

  if v_invite.code is null then
    raise exception 'invalid_code' using errcode = 'P0001', detail = 'invalid_code';
  end if;

  if v_invite.revoked_at is not null then
    raise exception 'code_revoked' using errcode = 'P0001', detail = 'code_revoked';
  end if;

  if v_invite.expires_at <= now() then
    raise exception 'code_expired' using errcode = 'P0001', detail = 'code_expired';
  end if;

  if v_invite.used_at is not null then
    raise exception 'code_already_used' using errcode = 'P0001', detail = 'code_already_used';
  end if;

  if v_invite.student_id = v_uid then
    raise exception 'cannot_watch_self' using errcode = 'P0001', detail = 'cannot_watch_self';
  end if;

  if exists (
    select 1 from public.parent_links
    where parent_id = v_uid and student_id = v_invite.student_id
  ) then
    raise exception 'already_linked' using errcode = 'P0001', detail = 'already_linked';
  end if;

  if exists (
    select 1 from public.parent_requests
    where parent_id = v_uid and student_id = v_invite.student_id and status = 'pending'
  ) then
    raise exception 'request_pending' using errcode = 'P0001', detail = 'request_pending';
  end if;

  insert into public.parent_requests (parent_id, student_id, invite_code)
  values (v_uid, v_invite.student_id, v_code)
  returning id into v_request;

  update public.parent_invites
     set used_at = now(), used_by = v_uid
   where code = v_code;

  return v_request;
end;
$function$;

revoke all on function public.redeem_parent_invite(text) from public, anon;
grant execute on function public.redeem_parent_invite(text) to authenticated;


-- ───────────────────────── Для модератора ─────────────────────────

/*
 * Черга заявок. Усе, за чим модератор вирішує, — одним рядком: хто просить
 * (пошта й поточна роль), про яку дитину, з якого класу, у якого вчителя і хто
 * саме виписав код. Пошта лежить в auth.users, куди клієнт не має ходу, тому
 * через RPC, як і admin_list_users.
 *
 * parent_has_groups — чи заявник сам веде групи: тоді схвалення не зробить його
 * 'parent' (див. нижче), і модератор має це знати до натискання.
 */
create or replace function public.admin_list_parent_requests()
returns table (
  request_id uuid,
  created_at timestamptz,
  parent_id uuid,
  parent_email text,
  parent_name text,
  parent_role text,
  parent_has_groups boolean,
  student_id uuid,
  student_name text,
  group_name text,
  teacher_name text,
  invited_by_name text
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if coalesce(public.current_user_role(), '') <> 'moderator' then
    raise exception 'Only moderators can list parent requests';
  end if;

  return query
    select r.id,
           r.created_at,
           r.parent_id,
           u.email::text,
           pp.display_name,
           coalesce(pp.role, 'student'),
           exists (select 1 from public.groups own where own.teacher_id = r.parent_id),
           r.student_id,
           s.display_name,
           g.name,
           tp.display_name,
           ip.display_name
      from public.parent_requests r
      join auth.users u on u.id = r.parent_id
      join public.profiles s on s.id = r.student_id
      left join public.profiles pp on pp.id = r.parent_id
      left join public.groups g on g.id = s.group_id
      left join public.profiles tp on tp.id = g.teacher_id
      left join public.parent_invites i on i.code = r.invite_code
      left join public.profiles ip on ip.id = i.created_by
     where r.status = 'pending'
     order by r.created_at;
end;
$function$;

revoke all on function public.admin_list_parent_requests() from public, anon;
grant execute on function public.admin_list_parent_requests() to authenticated;


/*
 * Рішення модератора. Схвалення створює parent_links — а з ним і доступ, бо
 * політики на results і profiles дивляться на зв'язок, а не на роль.
 *
 * Роль 'parent' ставиться тому, хто нею ще не є й не веде власних груп:
 *   - 'student' → 'parent' (так було й раніше);
 *   - 'teacher' без жодної групи → 'parent': це дорослий, що зареєструвався
 *     поштою, і AuthContext видав йому 'teacher' за замовчуванням;
 *   - вчитель із групами й модератор свою роль зберігають. Справжній вчитель,
 *     у якого теж є дитина в школі, не має втратити групи через заявку.
 * Доступ до дитини від ролі не залежить, тож він відкривається в усіх випадках.
 *
 * Прапорець app.role_change_allowed — єдиний спосіб для функції пройти тригер
 * prevent_role_change; він діє лише на час цієї транзакції.
 */
create or replace function public.admin_decide_parent_request(
  p_request_id uuid,
  p_approve boolean
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_request public.parent_requests%rowtype;
  v_role text;
  v_has_profile boolean;
  v_name text;
begin
  if coalesce(public.current_user_role(), '') <> 'moderator' then
    raise exception 'Only moderators can decide parent requests';
  end if;

  select * into v_request from public.parent_requests where id = p_request_id for update;

  if v_request.id is null then
    raise exception 'request_not_found' using errcode = 'P0001', detail = 'request_not_found';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'request_already_decided'
      using errcode = 'P0001', detail = 'request_already_decided';
  end if;

  if p_approve then
    insert into public.parent_links (parent_id, student_id)
    values (v_request.parent_id, v_request.student_id)
    on conflict do nothing;

    select role, true into v_role, v_has_profile
      from public.profiles where id = v_request.parent_id;

    if v_has_profile is null then
      -- Профілю ще немає (адмін-панель показує і таких): заводимо з тим, що є.
      select coalesce(u.raw_user_meta_data ->> 'display_name', split_part(u.email, '@', 1))
        into v_name
        from auth.users u where u.id = v_request.parent_id;

      insert into public.profiles (id, display_name, role)
      values (v_request.parent_id, v_name, 'parent');
    elsif v_role = 'student'
       or (v_role = 'teacher'
           and not exists (select 1 from public.groups where teacher_id = v_request.parent_id))
    then
      perform set_config('app.role_change_allowed', '1', true);
      update public.profiles set role = 'parent' where id = v_request.parent_id;
    end if;
  end if;

  update public.parent_requests
     set status = case when p_approve then 'approved' else 'rejected' end,
         decided_at = now(),
         decided_by = auth.uid()
   where id = v_request.id;
end;
$function$;

revoke all on function public.admin_decide_parent_request(uuid, boolean) from public, anon;
grant execute on function public.admin_decide_parent_request(uuid, boolean) to authenticated;


-- ───────────────────── Список для вчителя ─────────────────────

/*
 * Учитель має бачити, що з виписаним ним кодом: «чекає схвалення» — це не
 * «використано», доступу ще нема. Тому до списку додається статус заявки.
 *
 * Ім'я дорослого береться з used_by, а не зі зв'язку: поки заявка чекає,
 * зв'язку ще немає, а підпис «—» замість імені не каже вчителю, хто вводив код.
 * parent_id лишається зі зв'язку — відібрати можна лише те, що вже відкрито.
 *
 * Повертаєма таблиця змінилась, а create or replace цього не дозволяє, тому
 * drop.
 */
drop function if exists public.list_parent_access(uuid);

create function public.list_parent_access(p_student_id uuid)
returns table (
  code text,
  created_at timestamptz,
  expires_at timestamptz,
  used_at timestamptz,
  revoked_at timestamptz,
  parent_id uuid,
  parent_label text,
  request_status text
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not public.can_manage_student_access(p_student_id) then
    raise exception 'not_allowed' using errcode = 'P0001', detail = 'not_allowed';
  end if;

  return query
  select i.code,
         i.created_at,
         i.expires_at,
         i.used_at,
         i.revoked_at,
         l.parent_id,
         case when i.used_by is null then null
              else coalesce(p.display_name, u.email, '—') end as parent_label,
         r.status
    from public.parent_invites i
    left join public.parent_links l
      on l.student_id = i.student_id and l.parent_id = i.used_by
    left join public.parent_requests r
      on r.invite_code = i.code and r.student_id = i.student_id
    left join public.profiles p on p.id = i.used_by
    left join auth.users u on u.id = i.used_by
   where i.student_id = p_student_id
   order by i.created_at desc;
end;
$function$;

revoke all on function public.list_parent_access(uuid) from public, anon;
grant execute on function public.list_parent_access(uuid) to authenticated;


-- ───────────────────── Ролі вручну ─────────────────────

/*
 * Це та сама функція, що вже стоїть на хостингу (її не було в репозиторії; тут
 * вона нарешті під контролем версій), з двома змінами:
 *   - 'parent' тепер дозволений. Адмін-панель завжди пропонувала цю роль, а
 *     сервер відповідав «Invalid role» — вибір «Батьки» не спрацьовував ніколи;
 *   - модератор не міняє власну роль. Інакше один неуважний вибір у списку
 *     лишав платформу без модератора, а повернути роль можна було б лише
 *     SQL-запитом у панелі Supabase.
 * Решта — як було: лише модератор, профіль без рядка створюється.
 */
create or replace function public.admin_set_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if coalesce((select role from public.profiles where id = auth.uid()), '') <> 'moderator' then
    raise exception 'Only moderators can change roles';
  end if;

  if p_role not in ('student', 'teacher', 'moderator', 'parent') then
    raise exception 'Invalid role';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'cannot_change_own_role'
      using errcode = 'P0001', detail = 'cannot_change_own_role';
  end if;

  update public.profiles set role = p_role where id = p_user_id;

  if not found then
    insert into public.profiles (id, role) values (p_user_id, p_role);
  end if;
end;
$function$;
