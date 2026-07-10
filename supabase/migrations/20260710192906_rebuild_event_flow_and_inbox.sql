drop table if exists public.messages cascade;
drop type if exists public.message_type cascade;

create type public.message_type as enum ('ticket_delivery', 'system', 'event_update');

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

create index messages_recipient_id_idx on public.messages(recipient_id);
create index messages_recipient_email_idx on public.messages(recipient_email);

alter table public.messages enable row level security;

create policy "messages_select_own" on public.messages
  for select to authenticated
  using (recipient_id = auth.uid());

create policy "messages_update_own" on public.messages
  for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

grant select, update on public.messages to authenticated;
grant all on public.messages to service_role;

-- Patch events policy exactly as requested
drop policy if exists "events_organizer_insert" on public.events;
create policy "events_organizer_insert" on public.events
  for insert to authenticated
  with check (
    auth.uid() = organizer_id 
    and exists (
      select 1 from public.user_roles 
      where user_id = auth.uid() and role = 'organizer'
    )
  );

-- Create RPC to claim guest messages
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
  if _uid is null then
    return;
  end if;

  select email into _email from auth.users where id = _uid;

  if _email is not null then
    update public.messages
    set recipient_id = _uid
    where recipient_email = _email and recipient_id is null;
  end if;
end;
$$;

grant execute on function public.claim_guest_messages() to authenticated;
