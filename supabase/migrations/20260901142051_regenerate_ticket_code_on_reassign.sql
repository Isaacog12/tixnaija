create or replace function public.update_ticket_attendee(
  p_ticket_id uuid,
  p_attendee_name text,
  p_attendee_email text
) returns void
language plpgsql security definer
as $$
declare
  v_order_user_id uuid;
begin
  -- Ensure the caller is authenticated
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- Verify the ticket belongs to an order owned by the caller
  select o.user_id into v_order_user_id
  from public.tickets t
  join public.order_items oi on oi.id = t.order_item_id
  join public.orders o on o.id = oi.order_id
  where t.id = p_ticket_id;

  if not found then
    raise exception 'Ticket not found';
  end if;

  if v_order_user_id != auth.uid() then
    raise exception 'Not authorized to modify this ticket';
  end if;

  -- Update the ticket
  update public.tickets
  set attendee_name = coalesce(nullif(trim(p_attendee_name), ''), attendee_name),
      -- Regenerate ticket_code to invalidate old QR codes if the email actually changes
      ticket_code = case 
        when nullif(trim(p_attendee_email), '') is not null 
             and nullif(trim(p_attendee_email), '') is distinct from attendee_email 
        then gen_random_uuid() 
        else ticket_code 
      end,
      attendee_email = coalesce(nullif(trim(p_attendee_email), ''), attendee_email)
  where id = p_ticket_id;
end;
$$;
