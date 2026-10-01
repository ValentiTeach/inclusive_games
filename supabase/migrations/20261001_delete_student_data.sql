-- Видалення дитини на запит — назавжди.
--
-- teacher_remove_student лише відв'язує дитину від групи: обліковий запис і
-- всі результати лишаються, і вчитель перестає їх бачити. Для переведення між
-- групами це правильно, але батьки мають право попросити саме видалити дані
-- дитини, і досі зробити це міг тільки адміністратор бази вручну.
--
-- Ця функція видаляє все, що платформа знає про дитину: спроби, доступи й
-- запрошення батьків, профіль і анонімний обліковий запис. Журнал падінь
-- (client_errors) посилається на користувача з `on delete set null`, тож
-- записи там лишаються вже знеособленими.
--
-- Видаляти може лише вчитель групи, у якій дитина зараз є. Тому видалити треба
-- ДО того, як прибрати дитину з групи: після «Прибрати» вона вже не його учень.

create or replace function public.teacher_delete_student(p_student_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_teacher_of_student(p_student_id) then
    raise exception 'Only the teacher of this group can delete the student';
  end if;

  if coalesce((select role from public.profiles where id = p_student_id), '') <> 'student' then
    raise exception 'Only student profiles can be deleted';
  end if;

  delete from public.results where user_id = p_student_id;
  delete from public.parent_links where student_id = p_student_id;
  delete from public.parent_invites where student_id = p_student_id;
  delete from public.profiles where id = p_student_id;
  -- Анонімний обліковий запис дитини. Без цього лишався б порожній, але живий
  -- користувач, прив'язаний до браузера, на якому вона грала.
  delete from auth.users where id = p_student_id;
end;
$function$;

revoke all on function public.teacher_delete_student(uuid) from public, anon;
grant execute on function public.teacher_delete_student(uuid) to authenticated;
