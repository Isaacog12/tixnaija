-- Fix RPC signature to use text instead of enum to avoid PostgREST 400 Bad Request casting issues
create or replace function public.admin_update_job_application(
  p_id uuid,
  p_status text,
  p_admin_note text
)
returns void
language plpgsql
security definer
as $$
declare
  v_app public.job_applications%rowtype;
  v_user_id uuid;
  v_title text;
  v_body text;
begin
  -- Must be admin
  if not exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin') then
    raise exception 'Unauthorized';
  end if;

  -- Update job application
  update public.job_applications
  set status = p_status::public.job_application_status,
      admin_note = p_admin_note,
      updated_at = now()
  where id = p_id
  returning * into v_app;

  if not found then
    raise exception 'Job application not found';
  end if;

  -- Only send notification for final outcomes (Rejected or Hired)
  if p_status in ('rejected', 'hired') then
    -- Check if applicant is a registered user
    select u.id into v_user_id
    from auth.users u
    where lower(u.email) = lower(v_app.email)
    limit 1;

    if v_user_id is not null then
      -- Prepare message
      if p_status = 'rejected' then
        v_title := 'Update on your application';
        v_body := 'We appreciate your interest in the ' || v_app.role_applied_for || ' role, but we have decided not to move forward at this time.';
        if p_admin_note is not null and p_admin_note <> '' then
          v_body := v_body || ' Note: ' || p_admin_note;
        end if;
      elsif p_status = 'hired' then
        v_title := 'Application Approved! 🎉';
        v_body := 'Congratulations! Your application for ' || v_app.role_applied_for || ' has been approved. We will be in touch shortly to discuss next steps.';
      end if;

      if v_title is not null then
        insert into public.messages (recipient_id, type, title, body)
        values (v_user_id, 'system', v_title, v_body);
      end if;
    end if;
  end if;
end;
$$;
