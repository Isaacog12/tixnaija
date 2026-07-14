create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text not null,
  topic text,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.contact_messages enable row level security;

-- Allow anyone (anon or authenticated) to insert a contact message
create policy "contact_messages_insert_any" on public.contact_messages
  for insert to anon, authenticated
  with check (true);

-- Allow only admins to view contact messages
create policy "contact_messages_select_admin" on public.contact_messages
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- Allow only admins to update contact messages (e.g., mark as read)
create policy "contact_messages_update_admin" on public.contact_messages
  for update to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

grant select, insert, update on public.contact_messages to anon, authenticated;
grant all on public.contact_messages to service_role;
