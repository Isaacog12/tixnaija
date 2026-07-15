-- ============================================================
-- ORGANIZER APPLICATIONS
-- ============================================================
-- NOTE: 'admin' is already a formal member of public.app_role
-- enum ('attendee', 'organizer', 'admin') — no enum change needed.
-- Admin status is checked via:
--   EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')

-- ---- 1. Application status enum ----
create type public.application_status as enum ('pending', 'approved', 'rejected');

-- ---- 2. Applications table ----
create table public.organizer_applications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  full_name    text not null,
  phone_number text not null,
  email        text not null,
  social_media_link text,
  reason       text not null,
  id_photo_url text not null,
  status       public.application_status not null default 'pending',
  admin_note   text,
  reviewed_by  uuid references public.profiles(id) on delete set null,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);

-- Prevent a user from having more than one pending application at a time.
-- A partial unique index is the correct tool here (not a plain unique constraint).
create unique index organizer_applications_one_pending_per_user
  on public.organizer_applications (user_id)
  where (status = 'pending');

create index organizer_applications_user_idx   on public.organizer_applications (user_id);
create index organizer_applications_status_idx on public.organizer_applications (status);

grant select, insert on public.organizer_applications to authenticated;
grant all                on public.organizer_applications to service_role;

alter table public.organizer_applications enable row level security;

-- Users can see their own applications
create policy "org_apps_select_own" on public.organizer_applications
  for select to authenticated
  using (user_id = auth.uid());

-- Admins can see all applications (checked via user_roles, consistent with app_role enum)
create policy "org_apps_select_admin" on public.organizer_applications
  for select to authenticated
  using (
    exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- Users can only insert their own applications
create policy "org_apps_insert_own" on public.organizer_applications
  for insert to authenticated
  with check (user_id = auth.uid());

-- Only service_role / SECURITY DEFINER functions can update (approve/reject)
-- No direct UPDATE grant to authenticated — updates go through RPCs.

-- ---- 3. Storage bucket for ID photos ----
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'id-photos',
  'id-photos',
  false,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

-- Applicants can upload to their own folder only
create policy "id_photos_user_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'id-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Applicants can read their own uploads
create policy "id_photos_user_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'id-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Admins can read all uploads in this bucket
create policy "id_photos_admin_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'id-photos'
    and exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- ---- 4. Drop the old self-service organizer-grant RLS policy ----
-- This is the key security fix: no user can self-grant the organizer role.
drop policy if exists "user_roles_self_become_organizer" on public.user_roles;

-- ---- 5. APPROVE RPC ----
create or replace function public.approve_organizer_application(
  p_application_id uuid,
  p_note           text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app   public.organizer_applications;
  v_admin uuid;
begin
  -- Verify caller is an admin
  v_admin := auth.uid();
  if not exists (
    select 1 from public.user_roles
    where user_id = v_admin and role = 'admin'
  ) then
    raise exception 'Unauthorized: admin access required';
  end if;

  -- Fetch the application
  select * into v_app
  from public.organizer_applications
  where id = p_application_id;

  if not found then
    raise exception 'Application not found';
  end if;

  if v_app.status <> 'pending' then
    raise exception 'Application has already been reviewed';
  end if;

  -- Mark as approved
  update public.organizer_applications
  set
    status      = 'approved',
    admin_note  = p_note,
    reviewed_by = v_admin,
    reviewed_at = now()
  where id = p_application_id;

  -- Grant the organizer role (idempotent)
  insert into public.user_roles (user_id, role)
  values (v_app.user_id, 'organizer')
  on conflict (user_id, role) do nothing;

  -- Keep profiles.is_organizer in sync (existing UI reads this column)
  update public.profiles
  set is_organizer = true
  where id = v_app.user_id;

  -- Send inbox notification
  insert into public.messages (
    recipient_id, recipient_email, type, title, body
  ) values (
    v_app.user_id,
    v_app.email,
    'system',
    'Your organizer application has been approved! 🎉',
    'Great news! Your organizer application has been approved. ' ||
    'You can now create and publish events on TixNaija.' || E'\n\n' ||
    'Head to your dashboard to create your first event: /events/new' ||
    case when p_note is not null and p_note <> ''
      then E'\n\nNote from our team: ' || p_note
      else ''
    end
  );
end;
$$;

revoke execute on function public.approve_organizer_application(uuid, text) from public, anon;
grant  execute on function public.approve_organizer_application(uuid, text) to authenticated, service_role;

-- ---- 6. REJECT RPC ----
create or replace function public.reject_organizer_application(
  p_application_id uuid,
  p_note           text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app   public.organizer_applications;
  v_admin uuid;
begin
  -- Verify caller is an admin
  v_admin := auth.uid();
  if not exists (
    select 1 from public.user_roles
    where user_id = v_admin and role = 'admin'
  ) then
    raise exception 'Unauthorized: admin access required';
  end if;

  -- Fetch the application
  select * into v_app
  from public.organizer_applications
  where id = p_application_id;

  if not found then
    raise exception 'Application not found';
  end if;

  if v_app.status <> 'pending' then
    raise exception 'Application has already been reviewed';
  end if;

  -- Mark as rejected
  update public.organizer_applications
  set
    status      = 'rejected',
    admin_note  = p_note,
    reviewed_by = v_admin,
    reviewed_at = now()
  where id = p_application_id;

  -- Send inbox notification
  insert into public.messages (
    recipient_id, recipient_email, type, title, body
  ) values (
    v_app.user_id,
    v_app.email,
    'system',
    'Update on your organizer application',
    'Thank you for applying to become an organizer on TixNaija. ' ||
    'After reviewing your application, we''re unable to approve it at this time.' ||
    case when p_note is not null and p_note <> ''
      then E'\n\nReason: ' || p_note
      else ''
    end ||
    E'\n\nYou''re welcome to apply again in the future. If you have questions, please contact our support team.'
  );
end;
$$;

revoke execute on function public.reject_organizer_application(uuid, text) from public, anon;
grant  execute on function public.reject_organizer_application(uuid, text) to authenticated, service_role;
