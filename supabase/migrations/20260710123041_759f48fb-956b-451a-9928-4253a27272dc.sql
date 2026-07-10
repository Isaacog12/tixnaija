
-- ============================================================
-- ENUMS
-- ============================================================
create type public.app_role as enum ('attendee', 'organizer', 'admin');
create type public.event_category as enum ('music','comedy','conference','church','campus','party','sport','other');
create type public.event_status as enum ('draft','published','cancelled','completed');
create type public.order_status as enum ('pending','paid','failed','refunded');
create type public.ticket_status as enum ('valid','checked_in','cancelled');
create type public.discount_type as enum ('percent','fixed');

-- ============================================================
-- UTIL: updated_at trigger
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- PROFILES
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  city text,
  is_organizer boolean not null default false,
  bank_name text,
  bank_account_number text,
  bank_account_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select to authenticated using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'attendee')
  on conflict do nothing;

  return new;
end;
$$;

-- ============================================================
-- USER ROLES (separate table — never store roles on profiles)
-- ============================================================
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

create policy "user_roles_select_own" on public.user_roles
  for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- Attach handle_new_user trigger AFTER user_roles table exists
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- EVENTS
-- ============================================================
create table public.events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  slug text not null unique,
  description text,
  category public.event_category not null default 'other',
  cover_image_url text,
  venue_name text,
  address text,
  city text,
  state text,
  start_datetime timestamptz not null,
  end_datetime timestamptz,
  status public.event_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index events_organizer_idx on public.events(organizer_id);
create index events_status_start_idx on public.events(status, start_datetime);
create index events_city_idx on public.events(city);
create index events_category_idx on public.events(category);

grant select, insert, update, delete on public.events to authenticated;
grant select on public.events to anon;
grant all on public.events to service_role;

alter table public.events enable row level security;

create policy "events_public_view_published" on public.events
  for select to anon, authenticated
  using (status = 'published');

create policy "events_organizer_view_own" on public.events
  for select to authenticated using (auth.uid() = organizer_id);

create policy "events_organizer_insert" on public.events
  for insert to authenticated
  with check (auth.uid() = organizer_id and public.has_role(auth.uid(), 'organizer'));

create policy "events_organizer_update_own" on public.events
  for update to authenticated
  using (auth.uid() = organizer_id) with check (auth.uid() = organizer_id);

create policy "events_organizer_delete_own" on public.events
  for delete to authenticated using (auth.uid() = organizer_id);

create trigger events_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

-- ============================================================
-- TICKET TYPES
-- ============================================================
create table public.ticket_types (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  description text,
  price_kobo integer not null default 0 check (price_kobo >= 0),
  quantity_available integer not null check (quantity_available > 0),
  quantity_sold integer not null default 0 check (quantity_sold >= 0),
  sales_start_at timestamptz,
  sales_end_at timestamptz,
  max_per_order integer not null default 10 check (max_per_order > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint ticket_types_not_oversold check (quantity_sold <= quantity_available)
);

create index ticket_types_event_idx on public.ticket_types(event_id);

grant select, insert, update, delete on public.ticket_types to authenticated;
grant select on public.ticket_types to anon;
grant all on public.ticket_types to service_role;

alter table public.ticket_types enable row level security;

create policy "ticket_types_public_view" on public.ticket_types
  for select to anon, authenticated
  using (exists (
    select 1 from public.events e
    where e.id = event_id and e.status = 'published'
  ));

create policy "ticket_types_organizer_manage" on public.ticket_types
  for all to authenticated
  using (exists (
    select 1 from public.events e
    where e.id = event_id and e.organizer_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.events e
    where e.id = event_id and e.organizer_id = auth.uid()
  ));

-- ============================================================
-- PROMO CODES
-- ============================================================
create table public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  code text not null,
  discount_type public.discount_type not null,
  discount_value integer not null check (discount_value > 0),
  max_uses integer,
  times_used integer not null default 0,
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (event_id, code)
);

create index promo_codes_event_idx on public.promo_codes(event_id);

grant select, insert, update, delete on public.promo_codes to authenticated;
grant all on public.promo_codes to service_role;

alter table public.promo_codes enable row level security;

create policy "promo_codes_organizer_manage" on public.promo_codes
  for all to authenticated
  using (exists (
    select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid()
  ));

-- ============================================================
-- ORDERS
-- ============================================================
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  buyer_name text not null,
  buyer_email text not null,
  buyer_phone text,
  subtotal_kobo integer not null default 0,
  discount_kobo integer not null default 0,
  total_kobo integer not null default 0,
  promo_code_id uuid references public.promo_codes(id) on delete set null,
  status public.order_status not null default 'pending',
  payment_reference text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_event_idx on public.orders(event_id);
create index orders_user_idx on public.orders(user_id);
create index orders_email_idx on public.orders(buyer_email);

grant select, insert, update on public.orders to authenticated;
grant all on public.orders to service_role;

alter table public.orders enable row level security;

create policy "orders_buyer_view_own" on public.orders
  for select to authenticated
  using (auth.uid() = user_id);

create policy "orders_organizer_view_event" on public.orders
  for select to authenticated
  using (exists (
    select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid()
  ));

create policy "orders_authenticated_insert" on public.orders
  for insert to authenticated with check (true);

create trigger orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ============================================================
-- ORDER ITEMS
-- ============================================================
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  ticket_type_id uuid not null references public.ticket_types(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price_kobo integer not null check (unit_price_kobo >= 0),
  created_at timestamptz not null default now()
);

create index order_items_order_idx on public.order_items(order_id);

grant select, insert on public.order_items to authenticated;
grant all on public.order_items to service_role;

alter table public.order_items enable row level security;

create policy "order_items_view_via_order" on public.order_items
  for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_id
    and (
      o.user_id = auth.uid()
      or exists (select 1 from public.events e where e.id = o.event_id and e.organizer_id = auth.uid())
    )
  ));

create policy "order_items_insert_via_order" on public.order_items
  for insert to authenticated with check (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
  );

-- ============================================================
-- TICKETS
-- ============================================================
create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  ticket_code uuid not null unique default gen_random_uuid(),
  attendee_name text,
  attendee_email text,
  status public.ticket_status not null default 'valid',
  checked_in_at timestamptz,
  checked_in_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index tickets_order_item_idx on public.tickets(order_item_id);
create index tickets_code_idx on public.tickets(ticket_code);

grant select, update on public.tickets to authenticated;
grant all on public.tickets to service_role;

alter table public.tickets enable row level security;

create policy "tickets_buyer_view_own" on public.tickets
  for select to authenticated
  using (exists (
    select 1 from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.id = order_item_id and o.user_id = auth.uid()
  ));

create policy "tickets_organizer_view_own" on public.tickets
  for select to authenticated
  using (exists (
    select 1 from public.order_items oi
    join public.orders o on o.id = oi.order_id
    join public.events e on e.id = o.event_id
    where oi.id = order_item_id and e.organizer_id = auth.uid()
  ));

create policy "tickets_organizer_checkin" on public.tickets
  for update to authenticated
  using (exists (
    select 1 from public.order_items oi
    join public.orders o on o.id = oi.order_id
    join public.events e on e.id = o.event_id
    where oi.id = order_item_id and e.organizer_id = auth.uid()
  ));
