-- Applied to the hosted project (ref uwostumcmuxmocexpnic) as migration
-- `teacher_student_management`. Kept here so the schema history lives in the
-- repo rather than only in the dashboard.
--
-- Lets a teacher tidy up their own group: fix a name a child typed badly, or
-- detach someone who joined the wrong group. Both go through SECURITY DEFINER
-- RPCs because "the teacher of this student's group" is not something the
-- profiles RLS policies can express on their own.

create or replace function public.teacher_rename_student(
  p_student_id uuid,
  p_display_name text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_name text := btrim(coalesce(p_display_name, ''));
begin
  if not public.is_teacher_of_student(p_student_id) then
    raise exception 'Only the teacher of this group can rename the student';
  end if;

  -- Guards against a teacher being handed another teacher's or a moderator's
  -- id: this RPC is for pupils in one's own group and nothing else.
  if coalesce((select role from public.profiles where id = p_student_id), '') <> 'student' then
    raise exception 'Only student profiles can be renamed';
  end if;

  if v_name = '' then
    raise exception 'Name cannot be empty';
  end if;

  if length(v_name) > 60 then
    raise exception 'Name is too long';
  end if;

  update public.profiles set display_name = v_name where id = p_student_id;
end;
$function$;

create or replace function public.teacher_remove_student(p_student_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_teacher_of_student(p_student_id) then
    raise exception 'Only the teacher of this group can remove the student';
  end if;

  if coalesce((select role from public.profiles where id = p_student_id), '') <> 'student' then
    raise exception 'Only student profiles can be removed from a group';
  end if;

  -- Detach rather than delete. The account and its results survive, the teacher
  -- simply stops seeing them (results RLS follows group membership), and the
  -- child can rejoin later with the code. Deleting a child's history because
  -- they were moved between groups would be the wrong default.
  update public.profiles set group_id = null where id = p_student_id;
end;
$function$;

-- Unlike the older RPCs in this schema, these are not reachable by `anon`:
-- only a signed-in teacher has any business calling them.
revoke all on function public.teacher_rename_student(uuid, text) from public, anon;
revoke all on function public.teacher_remove_student(uuid) from public, anon;
grant execute on function public.teacher_rename_student(uuid, text) to authenticated;
grant execute on function public.teacher_remove_student(uuid) to authenticated;
