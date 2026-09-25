create table public.app_version (
  id uuid default gen_random_uuid() primary key,
  version text not null,
  apk_url text not null,
  release_notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.app_version enable row level security;

-- Policy: Anyone can read app versions
create policy "Anyone can read app_version"
on public.app_version
for select
to public
using (true);
