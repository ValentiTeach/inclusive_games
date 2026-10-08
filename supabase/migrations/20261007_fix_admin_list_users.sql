-- Адмін-панель не завантажувала список користувачів.
--
-- admin_list_users оголошує колонку email як text, а auth.users.email у
-- Supabase — varchar(255). plpgsql у RETURN QUERY вимагає точного збігу типів
-- і відповідає SQLSTATE 42804 «structure of query does not match function
-- result type». Клієнт бачив лише «Не вдалося завантажити список
-- користувачів», хоча користувачі й групи в базі були.
--
-- Функція нарешті під контролем версій (раніше жила лише на хостингу). Права
-- ті самі: лише модератор. Змінено одне — u.email::text.

create or replace function public.admin_list_users()
returns table (
  id uuid,
  email text,
  display_name text,
  role text,
  is_anonymous boolean,
  group_id uuid,
  group_name text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if coalesce((select p.role from public.profiles p where p.id = auth.uid()), '') <> 'moderator' then
    raise exception 'Only moderators can list users';
  end if;

  return query
    select
      u.id,
      u.email::text,
      p.display_name,
      coalesce(p.role, 'student'),
      u.is_anonymous,
      p.group_id,
      g.name,
      u.created_at
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join public.groups g on g.id = p.group_id
    order by u.created_at desc;
end;
$function$;

revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;
