-- ============================================================
-- JOB APPLICATIONS ADMIN RPCs
-- ============================================================

-- 1. Get job applications with `is_registered_user` flag
create or replace function public.admin_get_job_applications()
returns table (
  id uuid,
  role_applied_for text,
  full_name text,
  email text,
  phone_number text,
  cover_message text,
  cv_url text,
  status public.job_application_status,
  admin_note text,
  created_at timestamptz,
  is_registered_user boolean
)
language plpgsql
security definer
as $$
begin
  -- Must be admin
  if not exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin') then
    raise exception 'Unauthorized';
  end if;

  return query
  select 
    ja.id,
    ja.role_applied_for,
    ja.full_name,
    ja.email,
    ja.phone_number,
    ja.cover_message,
    ja.cv_url,
    ja.status,
    ja.admin_note,
    ja.created_at,
    (exists (select 1 from auth.users u where lower(u.email) = lower(ja.email))) as is_registered_user
  from public.job_applications ja
  order by ja.created_at desc;
end;
$$;

-- 2. Update job application and send inbox notification if registered
create or replace function public.admin_update_job_application(
  p_id uuid,
  p_status public.job_application_status,
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
  set status = p_status,
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

-- ============================================================
-- ORGANIZER REVOCATION
-- ============================================================

-- 1. Organizer Revocations Audit Table
create table if not exists public.organizer_revocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  revoked_by uuid not null references public.profiles(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

-- RLS: Only admins can read revocations
alter table public.organizer_revocations enable row level security;

create policy "admin_read_revocations" on public.organizer_revocations
  for select to authenticated
  using (
    exists (
      select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'
    )
  );

-- 2. Revoke organizer access RPC
create or replace function public.admin_revoke_organizer(
  p_user_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
as $$
begin
  -- Must be admin
  if not exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin') then
    raise exception 'Unauthorized';
  end if;

  -- Ensure target is an organizer
  if not exists (select 1 from public.user_roles where user_id = p_user_id and role = 'organizer') then
    raise exception 'Target user is not an organizer';
  end if;

  -- Delete organizer role
  delete from public.user_roles
  where user_id = p_user_id and role = 'organizer';

  -- Update profile flag
  update public.profiles
  set is_organizer = false
  where id = p_user_id;

  -- Log the revocation
  insert into public.organizer_revocations (user_id, revoked_by, reason)
  values (p_user_id, auth.uid(), p_reason);
end;
$$;
