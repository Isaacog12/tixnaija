-- Add a simple RPC to delete a job application
create or replace function public.admin_delete_job_application(p_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  -- Must be admin
  if not exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin') then
    raise exception 'Unauthorized';
  end if;

  delete from public.job_applications where id = p_id;
end;
$$;
