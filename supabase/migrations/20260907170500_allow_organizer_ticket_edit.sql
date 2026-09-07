create or replace function public.update_ticket_attendee(
  p_ticket_id uuid,
  p_attendee_name text,
  p_attendee_email text
) returns void
language plpgsql security definer
as $$
declare
  v_order_user_id uuid;
  v_order_id uuid;
  v_old_attendee_email text;
  v_event_id uuid;
  v_organizer_id uuid;
begin
  -- Ensure the caller is authenticated
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- Verify the ticket belongs to an order owned by the caller or the event is owned by the caller
  select o.user_id, o.id, t.attendee_email, o.event_id, e.organizer_id
  into v_order_user_id, v_order_id, v_old_attendee_email, v_event_id, v_organizer_id
  from public.tickets t
  join public.order_items oi on oi.id = t.order_item_id
  join public.orders o on o.id = oi.order_id
  join public.events e on e.id = o.event_id
  where t.id = p_ticket_id;

  if not found then
    raise exception 'Ticket not found';
  end if;

  if v_order_user_id != auth.uid() and v_organizer_id != auth.uid() then
    raise exception 'Not authorized to modify this ticket';
  end if;

  -- Only perform the security cleanup if the email is actually changing
  if nullif(trim(p_attendee_email), '') is not null and lower(trim(p_attendee_email)) != lower(v_old_attendee_email) then
    
    -- 1. Revoke access from the old email by updating the order
    update public.orders
    set recipient_email = case when lower(recipient_email) = lower(v_old_attendee_email) then lower(trim(p_attendee_email)) else recipient_email end,
        buyer_email = case when lower(buyer_email) = lower(v_old_attendee_email) then lower(trim(p_attendee_email)) else buyer_email end
    where id = v_order_id;

    -- 2. Delete in-app notifications sent to the old wrong email
    delete from public.messages
    where related_order_id = v_order_id
      and lower(recipient_email) = lower(v_old_attendee_email);

  end if;

  -- Update the ticket and optionally regenerate ticket_code
  update public.tickets
  set attendee_name = coalesce(nullif(trim(p_attendee_name), ''), attendee_name),
      -- Regenerate ticket_code to invalidate old QR codes if the email actually changes
      ticket_code = case 
        when nullif(trim(p_attendee_email), '') is not null 
             and lower(trim(p_attendee_email)) != lower(v_old_attendee_email)
        then gen_random_uuid() 
        else ticket_code 
      end,
      attendee_email = coalesce(nullif(trim(p_attendee_email), ''), attendee_email)
  where id = p_ticket_id;
end;
$$;
