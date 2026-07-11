
-- Drop the old signature so overload doesn't collide
DROP FUNCTION IF EXISTS public.process_test_checkout(uuid, text, text, text, jsonb);

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
