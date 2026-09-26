-- Feature 2: Custom Box Office Profile Fields
alter table public.profiles 
  add column organizer_slug text unique,
  add column bio text,
  add column banner_url text;

-- Feature 1: Promoter System
create table public.promoters (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  contact_info text,
  created_at timestamptz not null default now()
);

create table public.promoter_links (
  id uuid primary key default gen_random_uuid(),
  promoter_id uuid not null references public.promoters(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  ticket_type_id uuid references public.ticket_types(id) on delete cascade,
  unique_code text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.orders 
  add column promoter_link_id uuid references public.promoter_links(id) on delete set null;

-- RLS for promoters
alter table public.promoters enable row level security;
create policy "organizers_manage_promoters" on public.promoters
  for all to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid()));

-- RLS for promoter_links
alter table public.promoter_links enable row level security;
create policy "organizers_manage_promoter_links" on public.promoter_links
  for all to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid()));

-- Public read for promoter links (needed to validate links/attribution)
create policy "public_read_promoter_links" on public.promoter_links
  for select to anon, authenticated
  using (active = true);
