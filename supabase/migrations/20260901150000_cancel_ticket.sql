-- Create RPC to cancel a single ticket
create or replace function public.cancel_ticket(p_ticket_id uuid)
returns void
language plpgsql security definer
as $$
declare
  v_organizer_id uuid;
begin
  -- Ensure the caller is authenticated
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- Verify the ticket belongs to an event owned by the caller
  select e.organizer_id into v_organizer_id
  from public.tickets t
  join public.order_items oi on oi.id = t.order_item_id
  join public.orders o on o.id = oi.order_id
  join public.events e on e.id = o.event_id
  where t.id = p_ticket_id;

  if not found then
    raise exception 'Ticket not found';
  end if;

  if v_organizer_id != auth.uid() then
    raise exception 'Not authorized to modify this ticket';
  end if;

  -- Update the ticket status to cancelled
  update public.tickets
  set status = 'cancelled'
  where id = p_ticket_id;

end;
$$;
