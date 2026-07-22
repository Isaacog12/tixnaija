-- ============================================================
-- JOB APPLICATIONS
-- ============================================================
-- Public (anon) INSERT allowed — no account required to apply.
-- SELECT / UPDATE restricted to admins via user_roles.

-- ---- 1. Status enum ----
create type public.job_application_status as enum ('new', 'reviewed', 'rejected', 'hired');

-- ---- 2. Table ----
create table public.job_applications (
  id               uuid        primary key default gen_random_uuid(),
  role_applied_for text        not null,
  full_name        text        not null,
  email            text        not null,
  phone_number     text        not null,
  cover_message    text,
  cv_url           text        not null,
  status           public.job_application_status not null default 'new',
  admin_note       text,
  created_at       timestamptz not null default now()
);

create index job_applications_status_idx   on public.job_applications (status);
create index job_applications_created_idx  on public.job_applications (created_at desc);

-- Grant INSERT to anon (public apply) and authenticated; full access to service_role
grant insert on public.job_applications to anon, authenticated;
grant select, update on public.job_applications to authenticated;
grant all on public.job_applications to service_role;

alter table public.job_applications enable row level security;

-- Anyone (including unauthenticated visitors) can submit an application
create policy "job_apps_insert_public" on public.job_applications
  for insert to anon, authenticated
  with check (true);

-- Only admins can read applications
create policy "job_apps_select_admin" on public.job_applications
  for select to authenticated
  using (
    exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- Only admins can update (status + note). Both using and with check to be safe.
create policy "job_apps_update_admin" on public.job_applications
  for update to authenticated
  using (
    exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- ---- 3. Storage bucket for CVs (private) ----
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'job-cvs',
  'job-cvs',
  false,
  5242880, -- 5 MB
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;

-- Applicants (anon or authenticated) can upload CVs.
-- Path is prefixed with a random UUID during upload so it's not guessable.
create policy "job_cvs_public_insert" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'job-cvs');

-- Only admins can read CVs
create policy "job_cvs_admin_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'job-cvs'
    and exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role = 'admin'
    )
  );
