-- Create refund_requests table
create table if not exists public.refund_requests (
  id           uuid primary key default gen_random_uuid(),
  ticket_id    uuid references public.tickets(id) on delete set null,
  event_id     uuid references public.events(id) on delete set null,
  buyer_email  text not null,
  buyer_name   text,
  reason       text not null check (reason in ('cancelled', 'postponed', 'other')),
  other_reason text,                     -- free-text when reason = 'other'
  status       text not null default 'pending'
                 check (status in ('pending', 'approved', 'rejected', 'processed')),
  admin_note   text,                     -- internal note from admin/organizer
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Index for admin dashboard lookups
create index if not exists refund_requests_status_idx  on public.refund_requests (status);
create index if not exists refund_requests_event_idx   on public.refund_requests (event_id);
create index if not exists refund_requests_ticket_idx  on public.refund_requests (ticket_id);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists refund_requests_updated_at on public.refund_requests;
create trigger refund_requests_updated_at
  before update on public.refund_requests
  for each row execute procedure public.set_updated_at();

-- RLS
alter table public.refund_requests enable row level security;

-- Authenticated buyers can insert their own requests (no restriction on read — 
-- actual ownership enforced via ticket_id & buyer_email in the application layer)
create policy "buyers can insert refund requests"
  on public.refund_requests for insert
  to authenticated
  with check (true);

-- Authenticated users can read their own requests (matched by buyer_email)
create policy "buyers can read own refund requests"
  on public.refund_requests for select
  to authenticated
  using (
    buyer_email = (select email from auth.users where id = auth.uid())
  );

-- Admins can read and update all
create policy "admins can manage refund requests"
  on public.refund_requests for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles where id = auth.uid() and is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles where id = auth.uid() and is_admin = true
    )
  );
