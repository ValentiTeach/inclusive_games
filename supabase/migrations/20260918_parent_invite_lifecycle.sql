-- Код для батьків має строк дії і його можна погасити.
--
-- Досі виписаний код жив вічно і ніде не показувався: учитель не бачив, які
-- коди він роздав, і не міг скасувати жодного. Код диктують уголос і
-- переписують на папір — загублений аркуш означав безстроковий доступ до
-- дитини для того, хто його підняв.
--
-- Друга, гірша половина тієї самої діри: навіть скасований код нічого не
-- повертав, якщо ним уже скористалися. Доступ живе у parent_links, і відібрати
-- його не було чим узагалі.

alter table public.parent_invites
  add column if not exists expires_at timestamptz,
  add column if not exists revoked_at timestamptz;

-- Уже виписаним кодам строк призначається заднім числом від дня видачі: інакше
-- вони лишилися б безстроковими — рівно тим, що ця міграція й прибирає.
update public.parent_invites
   set expires_at = created_at + interval '7 days'
 where expires_at is null;

alter table public.parent_invites
  alter column expires_at set not null,
  alter column expires_at set default (now() + interval '7 days');

/*
 * Учитель має бачити всі коди своєї групи, а не лише ті, які виписав сам:
 * групу нерідко веде не та сама людина, що видала код, а замінити вчителя не
 * повинно означати втратити керування доступом до дітей.
 */
drop policy if exists "Teachers can see invites they wrote" on public.parent_invites;
create policy "Teachers can see invites for their group"
  on public.parent_invites for select
  using (
    created_by = auth.uid()
    or public.is_teacher_of_group(
      (select group_id from public.profiles where id = parent_invites.student_id)
    )
    or public.current_user_role() = 'moderator'
  );

/*
 * Хто саме має право чіпати доступ до цієї дитини. Одна перевірка на всі три
 * дії — виписати, скасувати, відібрати — щоб вони не розійшлися.
 */
create or replace function public.can_manage_student_access(p_student_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_group uuid;
begin
  if auth.uid() is null then
    return false;
  end if;

  select group_id into v_group from public.profiles where id = p_student_id;
  if v_group is null then
    return false;
  end if;

  return public.is_teacher_of_group(v_group) or public.current_user_role() = 'moderator';
end;
$function$;

create or replace function public.create_parent_invite(p_student_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = 'P0001', detail = 'not_signed_in';
  end if;

  if not exists (select 1 from public.profiles where id = p_student_id) then
    raise exception 'student_not_found' using errcode = 'P0001', detail = 'student_not_found';
  end if;

  if not public.can_manage_student_access(p_student_id) then
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
 * Скасування коду. Працює лише на невикористаному: погасити код, яким уже
 * скористалися, означало б удавати, що доступ відібрано, — а він лишався б.
 * Для такого випадку є revoke_parent_access нижче, і повідомлення веде саме
 * туди.
 */
create or replace function public.revoke_parent_invite(p_code text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_student uuid;
  v_used timestamptz;
begin
  select student_id, used_at into v_student, v_used
  from public.parent_invites where code = v_code;

  if v_student is null then
    raise exception 'invalid_code' using errcode = 'P0001', detail = 'invalid_code';
  end if;

  if not public.can_manage_student_access(v_student) then
    raise exception 'not_allowed' using errcode = 'P0001', detail = 'not_allowed';
  end if;

  if v_used is not null then
    raise exception 'code_already_used' using errcode = 'P0001', detail = 'code_already_used';
  end if;

  update public.parent_invites set revoked_at = now()
   where code = v_code and revoked_at is null;
end;
$function$;

/*
 * Відібрати доступ у дорослого, який уже ввійшов. Це і є справжнє скасування:
 * зв'язок зникає, і батьківські політики на results та profiles перестають
 * бачити цю дитину тієї ж миті.
 */
create or replace function public.revoke_parent_access(p_parent_id uuid, p_student_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.can_manage_student_access(p_student_id) then
    raise exception 'not_allowed' using errcode = 'P0001', detail = 'not_allowed';
  end if;

  delete from public.parent_links
   where parent_id = p_parent_id and student_id = p_student_id;
end;
$function$;

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
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = 'P0001', detail = 'not_signed_in';
  end if;

  if (select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) then
    raise exception 'anonymous_not_allowed'
      using errcode = 'P0001', detail = 'anonymous_not_allowed';
  end if;

  select * into v_invite from public.parent_invites where code = v_code;

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

  insert into public.parent_links (parent_id, student_id)
  values (v_uid, v_invite.student_id)
  on conflict do nothing;

  update public.parent_invites
     set used_at = now(), used_by = v_uid
   where code = v_code;

  update public.profiles set role = 'parent'
   where id = v_uid and role = 'student';

  return v_invite.student_id;
end;
$function$;

/*
 * Список для вчителя: коди і дорослі, що вже мають доступ, — одним запитом.
 * Через RPC, а не через RLS на parent_links: щоб показати ім'я дорослого,
 * учителю довелося б читати чужий профіль, а відкривати для цього всю таблицю
 * profiles означало б віддати більше, ніж потрібно.
 */
create or replace function public.list_parent_access(p_student_id uuid)
returns table (
  code text,
  created_at timestamptz,
  expires_at timestamptz,
  used_at timestamptz,
  revoked_at timestamptz,
  parent_id uuid,
  parent_label text
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
         coalesce(p.display_name, u.email, '—') as parent_label
    from public.parent_invites i
    left join public.parent_links l
      on l.student_id = i.student_id and l.parent_id = i.used_by
    left join public.profiles p on p.id = l.parent_id
    left join auth.users u on u.id = l.parent_id
   where i.student_id = p_student_id
   order by i.created_at desc;
end;
$function$;
