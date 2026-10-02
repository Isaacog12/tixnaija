-- ============================================================
-- full_schema_export.sql
-- ============================================================
-- Complete schema definition for migrating off Lovable's managed Supabase.
-- Note: Execute this in the SQL Editor of your independent Supabase project.
-- ============================================================

-- ===== SECTION =====
-- Types
-- ============================================================
create type public.app_role as enum ('attendee', 'organizer', 'admin');
create type public.event_category as enum ('music','comedy','conference','church','campus','party','sport','other');
create type public.event_status as enum ('draft','published','cancelled','completed');
create type public.order_status as enum ('pending','paid','failed','refunded');
create type public.ticket_status as enum ('valid','checked_in','cancelled');
create type public.discount_type as enum ('percent','fixed');
create type public.message_type as enum ('ticket_delivery', 'system', 'event_update');

-- ===== SECTION =====
-- Tables
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

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

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

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  ticket_type_id uuid not null references public.ticket_types(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price_kobo integer not null check (unit_price_kobo >= 0),
  created_at timestamptz not null default now()
);

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

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references auth.users(id) on delete cascade,
  recipient_email text,
  type public.message_type not null,
  title text not null,
  body text not null,
  related_order_id uuid references public.orders(id) on delete set null,
  related_ticket_ids uuid[] default array[]::uuid[],
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ===== SECTION =====
-- Indexes
-- ============================================================
create index events_organizer_idx on public.events(organizer_id);
create index events_status_start_idx on public.events(status, start_datetime);
create index events_city_idx on public.events(city);
create index events_category_idx on public.events(category);
create index ticket_types_event_idx on public.ticket_types(event_id);
create index promo_codes_event_idx on public.promo_codes(event_id);
create index orders_event_idx on public.orders(event_id);
create index orders_user_idx on public.orders(user_id);
create index orders_email_idx on public.orders(buyer_email);
create index order_items_order_idx on public.order_items(order_id);
create index tickets_order_item_idx on public.tickets(order_item_id);
create index tickets_code_idx on public.tickets(ticket_code);
create index messages_recipient_id_idx on public.messages(recipient_id);
create index messages_recipient_email_idx on public.messages(recipient_email);

-- ===== SECTION =====
-- Functions
-- ============================================================

-- Function: set_updated_at
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

-- Function: handle_new_user
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

-- Function: private.has_role (Core evaluation logic)
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Function: public.has_role (Public invoker wrapper)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  select private.has_role(_user_id, _role)
$$;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Function: test_has_role
create or replace function public.test_has_role()
returns boolean
language sql
stable
security invoker
as $$
  select public.has_role(auth.uid(), 'organizer'::public.app_role);
$$;
grant execute on function public.test_has_role() to authenticated;

-- Function: claim_guest_messages
create or replace function public.claim_guest_messages()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid;
  _email text;
begin
  _uid := auth.uid();
  if _uid is null then return; end if;

  select email into _email from auth.users where id = _uid;

  if _email is not null then
    update public.messages
    set recipient_id = _uid
    where recipient_email = _email and recipient_id is null;
  end if;
end;
$$;
grant execute on function public.claim_guest_messages() to authenticated;

-- Function: process_test_checkout
CREATE OR REPLACE FUNCTION public.process_test_checkout(
  p_event_id uuid,
  p_user_id uuid,
  p_buyer_name text,
  p_buyer_email text,
  p_buyer_phone text,
  p_tickets jsonb,
  p_subtotal_kobo integer,
  p_discount_kobo integer,
  p_total_kobo integer,
  p_payment_reference text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
declare
  v_order_id uuid;
  v_ticket_type record;
  v_item jsonb;
  v_count integer;
  v_ticket_type_id uuid;
  v_event record;
  v_ticket_ids uuid[] := array[]::uuid[];
  v_new_ticket_id uuid;
  v_order_item_id uuid;
  v_names jsonb;
  v_attendee_name text;
begin
  select * into v_event from public.events where id = p_event_id;
  if not found then raise exception 'Event not found'; end if;

  -- Validate inventory
  for v_item in select * from jsonb_array_elements(p_tickets) loop
    v_ticket_type_id := (v_item->>'ticketTypeId')::uuid;
    v_count := (v_item->>'count')::integer;
    select * into v_ticket_type from public.ticket_types where id = v_ticket_type_id;
    if not found then raise exception 'Ticket type % not found', v_ticket_type_id; end if;
    if v_ticket_type.quantity_available - v_ticket_type.quantity_sold < v_count then
      raise exception 'Not enough tickets available for %', v_ticket_type.name;
    end if;
  end loop;

  insert into public.orders (
    event_id, user_id, buyer_name, buyer_email, buyer_phone,
    subtotal_kobo, discount_kobo, total_kobo, status, payment_reference
  ) values (
    p_event_id, p_user_id, p_buyer_name, p_buyer_email, p_buyer_phone,
    p_subtotal_kobo, coalesce(p_discount_kobo, 0), p_total_kobo, 'paid', p_payment_reference
  ) returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_tickets) loop
    v_ticket_type_id := (v_item->>'ticketTypeId')::uuid;
    v_count := (v_item->>'count')::integer;
    v_names := coalesce(v_item->'attendee_names', '[]'::jsonb);

    select * into v_ticket_type from public.ticket_types where id = v_ticket_type_id;

    update public.ticket_types
    set quantity_sold = quantity_sold + v_count
    where id = v_ticket_type_id;

    insert into public.order_items (
      order_id, ticket_type_id, quantity, unit_price_kobo
    ) values (
      v_order_id, v_ticket_type_id, v_count, v_ticket_type.price_kobo
    ) returning id into v_order_item_id;

    for i in 1..v_count loop
      v_attendee_name := nullif(trim(coalesce(v_names->>(i - 1), '')), '');
      if v_attendee_name is null then
        v_attendee_name := p_buyer_name;
      end if;

      insert into public.tickets (
        order_item_id, status, attendee_name, attendee_email
      ) values (
        v_order_item_id, 'valid', v_attendee_name, p_buyer_email
      ) returning id into v_new_ticket_id;

      v_ticket_ids := array_append(v_ticket_ids, v_new_ticket_id);
    end loop;
  end loop;

  insert into public.messages (
    recipient_id, recipient_email, type, title, body, related_order_id, related_ticket_ids
  ) values (
    p_user_id, p_buyer_email, 'ticket_delivery',
    'Your tickets for ' || v_event.title || ' are ready 🎟️',
    'Your tickets for ' || v_event.title || ' are ready!' || E'\n\n' ||
    'Date: ' || v_event.start_datetime::date || E'\n' ||
    'Location: ' || coalesce(v_event.venue_name, 'Online') || E'\n\n' ||
    'Click the link below to view your tickets.',
    v_order_id, v_ticket_ids
  );

  return v_order_id;
end;
$function$;
REVOKE EXECUTE ON FUNCTION public.process_test_checkout(uuid, uuid, text, text, text, jsonb, integer, integer, integer, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_test_checkout(uuid, uuid, text, text, text, jsonb, integer, integer, integer, text) TO service_role;

-- Function: set_organizer_status
create or replace function public.set_organizer_status(is_org boolean)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  update public.profiles set is_organizer = is_org where id = auth.uid();
  
  if is_org then
    insert into public.user_roles (user_id, role)
    values (auth.uid(), 'organizer')
    on conflict do nothing;
  else
    delete from public.user_roles where user_id = auth.uid() and role = 'organizer';
  end if;
end;
$$;
revoke execute on function public.set_organizer_status from public;
grant execute on function public.set_organizer_status to authenticated;


-- Lock down SECURITY DEFINER helpers
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ===== SECTION =====
-- Triggers
-- ============================================================
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger events_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

create trigger orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== SECTION =====
-- RLS Policies
-- ============================================================
-- Apply explicit grants
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
revoke update on public.profiles from authenticated;
grant update (full_name, phone, avatar_url, city, bank_name, bank_account_number, bank_account_name, is_public, username, organizer_slug, bio, banner_url) on public.profiles to authenticated;

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

grant select, insert, update, delete on public.events to authenticated;
grant select on public.events to anon;
grant all on public.events to service_role;

grant select, insert, update, delete on public.ticket_types to authenticated;
grant select on public.ticket_types to anon;
grant all on public.ticket_types to service_role;

grant select, insert, update, delete on public.promo_codes to authenticated;
grant all on public.promo_codes to service_role;

grant select, insert, update on public.orders to authenticated;
grant all on public.orders to service_role;

grant select, insert on public.order_items to authenticated;
grant all on public.order_items to service_role;

grant select, update on public.tickets to authenticated;
grant all on public.tickets to service_role;

grant select, update on public.messages to authenticated;
grant all on public.messages to service_role;

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.events enable row level security;
alter table public.ticket_types enable row level security;
alter table public.promo_codes enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.tickets enable row level security;
alter table public.messages enable row level security;

-- PROFILES
create policy "profiles_select_own" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- USER ROLES
create policy "user_roles_select_own" on public.user_roles for select to authenticated using (auth.uid() = user_id);
CREATE POLICY "user_roles_self_become_organizer" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND role = 'organizer'::app_role);

-- EVENTS
create policy "events_public_view_published" on public.events for select to anon, authenticated using (status = 'published');
create policy "events_organizer_view_own" on public.events for select to authenticated using (auth.uid() = organizer_id);
create policy "events_organizer_insert" on public.events for insert to authenticated with check (auth.uid() = organizer_id and exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'organizer'));
create policy "events_organizer_update_own" on public.events for update to authenticated using (auth.uid() = organizer_id) with check (auth.uid() = organizer_id);
create policy "events_organizer_delete_own" on public.events for delete to authenticated using (auth.uid() = organizer_id);

-- TICKET TYPES
create policy "ticket_types_public_view" on public.ticket_types for select to anon, authenticated using (exists (select 1 from public.events e where e.id = event_id and e.status = 'published'));
create policy "ticket_types_organizer_manage" on public.ticket_types for all to authenticated using (exists (select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid())) with check (exists (select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid()));

-- PROMO CODES
create policy "promo_codes_organizer_manage" on public.promo_codes for all to authenticated using (exists (select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid())) with check (exists (select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid()));

-- ORDERS
create policy "orders_buyer_view_own" on public.orders for select to authenticated using (user_id = auth.uid() or lower(buyer_email) = lower(auth.jwt()->>'email'));
create policy "orders_organizer_view_event" on public.orders for select to authenticated using (exists (select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid()));
create policy "orders_authenticated_insert" on public.orders for insert to authenticated with check (auth.uid() = user_id);

-- ORDER ITEMS
create policy "order_items_view_via_order" on public.order_items for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or lower(o.buyer_email) = lower(auth.jwt()->>'email') or exists (select 1 from public.events e where e.id = o.event_id and e.organizer_id = auth.uid()))));
create policy "order_items_insert_via_order" on public.order_items for insert to authenticated with check (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));

-- TICKETS
create policy "tickets_view_own" on public.tickets for select to authenticated using (lower(attendee_email) = lower(auth.jwt()->>'email') or exists (select 1 from public.order_items oi join public.orders o on o.id = oi.order_id where oi.id = public.tickets.order_item_id and (o.user_id = auth.uid() or lower(o.buyer_email) = lower(auth.jwt()->>'email'))));
create policy "tickets_organizer_view_own" on public.tickets for select to authenticated using (exists (select 1 from public.order_items oi join public.orders o on o.id = oi.order_id join public.events e on e.id = o.event_id where oi.id = order_item_id and e.organizer_id = auth.uid()));
create policy "tickets_organizer_checkin" on public.tickets for update to authenticated using (exists (select 1 from public.order_items oi join public.orders o on o.id = oi.order_id join public.events e on e.id = o.event_id where oi.id = order_item_id and e.organizer_id = auth.uid()));

-- MESSAGES
create policy "prevent_frontend_insert_messages" on public.messages for insert to authenticated with check (false);
create policy "messages_select_own" on public.messages for select to authenticated using (recipient_id = auth.uid());
create policy "messages_update_own" on public.messages for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- ===== SECTION =====
-- Storage
-- ============================================================
insert into storage.buckets (id, name, public) values ('event-covers', 'event-covers', true) on conflict (id) do update set public = true;
create policy "Public Access" on storage.objects for select to public using ( bucket_id = 'event-covers' );
create policy "Authenticated users can upload covers" on storage.objects for insert to authenticated with check ( bucket_id = 'event-covers' and (storage.foldername(name))[1] = auth.uid()::text );
create policy "Organizers can update their covers" on storage.objects for update to authenticated using ( bucket_id = 'event-covers' and (storage.foldername(name))[1] = auth.uid()::text );
create policy "Organizers can delete their covers" on storage.objects for delete to authenticated using ( bucket_id = 'event-covers' and (storage.foldername(name))[1] = auth.uid()::text );
