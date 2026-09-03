-- Migration to allow admins to revoke an organizer by email
create or replace function public.admin_revoke_organizer_by_email(
  p_email text,
  p_reason text default null
)
returns void
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
begin
  -- Must be admin
  if not exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin') then
    raise exception 'Unauthorized';
  end if;

  -- Find user by email
  select id into v_user_id from auth.users where email = p_email;
  
  if v_user_id is null then
    raise exception 'User not found with email %', p_email;
  end if;

  -- Delete organizer role if it exists
  delete from public.user_roles
  where user_id = v_user_id and role = 'organizer';

  -- Update profile flag
  update public.profiles
  set is_organizer = false
  where id = v_user_id;

  -- Delete from organizer_applications so they have to apply again
  delete from public.organizer_applications
  where user_id = v_user_id;

  -- Log the revocation
  insert into public.organizer_revocations (user_id, revoked_by, reason)
  values (v_user_id, auth.uid(), p_reason);
end;
$$;
