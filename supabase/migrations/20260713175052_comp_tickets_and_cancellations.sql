-- Add 'comp' to order_status enum
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'comp';

-- Add cancellation/postponement fields to events table
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
ADD COLUMN IF NOT EXISTS postponed_at timestamptz,
ADD COLUMN IF NOT EXISTS organizer_note text;

-- Replace process_checkout to ensure comp orders work. We already accept p_amount_paid.
-- We can add logic specifically for comp if needed, but the current RPC handles total = 0.
-- Wait, the issue_comp_tickets is a separate RPC.

CREATE OR REPLACE FUNCTION public.issue_comp_tickets(
  p_event_id uuid,
  p_ticket_type_id uuid,
  p_recipients jsonb[] -- array of { name: '...', email: '...' }
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id uuid;
  v_recipient jsonb;
  v_ticket_count integer := array_length(p_recipients, 1);
  v_ticket_type record;
BEGIN
  -- Validate ticket type exists and is for this event
  SELECT * INTO v_ticket_type
  FROM public.ticket_types
  WHERE id = p_ticket_type_id AND event_id = p_event_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket type not found';
  END IF;

  -- Create order with 'comp' status and 0 amount
  INSERT INTO public.orders (
    event_id,
    buyer_name,
    buyer_email,
    subtotal_kobo,
    discount_kobo,
    total_kobo,
    status,
    payment_reference
  ) VALUES (
    p_event_id,
    'Comp Issue - Organizer',
    'comp@tixnaija.local',
    0, 0, 0,
    'comp',
    'COMP_' || extract(epoch from now())::text
  ) RETURNING id INTO v_order_id;

  -- Create order item
  INSERT INTO public.order_items (
    order_id,
    ticket_type_id,
    quantity,
    unit_price_kobo,
    subtotal_kobo
  ) VALUES (
    v_order_id,
    p_ticket_type_id,
    v_ticket_count,
    0, 0
  );

  -- Update quantity sold
  UPDATE public.ticket_types
  SET quantity_sold = quantity_sold + v_ticket_count
  WHERE id = p_ticket_type_id;

  -- Generate tickets and messages
  FOREACH v_recipient IN ARRAY p_recipients
  LOOP
    -- Insert ticket
    INSERT INTO public.tickets (
      order_id,
      ticket_type_id,
      ticket_code,
      attendee_name,
      status
    ) VALUES (
      v_order_id,
      p_ticket_type_id,
      gen_random_uuid()::text,
      v_recipient->>'name',
      'valid'
    );

    -- Insert inbox message
    INSERT INTO public.messages (
      user_email,
      event_id,
      subject,
      body,
      action_url,
      action_text
    ) VALUES (
      v_recipient->>'email',
      p_event_id,
      'Your Complimentary Ticket',
      'You have been issued a complimentary ticket to ' || (SELECT title FROM public.events WHERE id = p_event_id) || '. Click the link below to view and download your ticket QR code.',
      '/orders/' || v_order_id || '/tickets',
      'View Ticket'
    );
  END LOOP;

  RETURN v_order_id;
END;
$$;


CREATE OR REPLACE FUNCTION public.cancel_event(
  p_event_id uuid,
  p_note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_buyer record;
  v_event record;
BEGIN
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;

  UPDATE public.events
  SET status = 'cancelled',
      cancelled_at = now(),
      organizer_note = p_note
  WHERE id = p_event_id;

  -- Notify buyers (only those with valid tickets)
  FOR v_buyer IN
    SELECT DISTINCT o.buyer_email, o.id as order_id
    FROM public.orders o
    JOIN public.tickets t ON t.order_id = o.id
    WHERE o.event_id = p_event_id AND t.status = 'valid'
  LOOP
    INSERT INTO public.messages (
      user_email,
      event_id,
      subject,
      body,
      action_url,
      action_text
    ) VALUES (
      v_buyer.buyer_email,
      p_event_id,
      'Event Cancelled: ' || v_event.title,
      'This event has been cancelled by the organizer. ' || COALESCE(p_note, 'No further details were provided.') || ' Please expect a refund to your original payment method in accordance with our terms.',
      '/orders/' || v_buyer.order_id || '/tickets',
      'View Details'
    );
  END LOOP;
END;
$$;


CREATE OR REPLACE FUNCTION public.postpone_event(
  p_event_id uuid,
  p_new_start timestamptz,
  p_new_end timestamptz,
  p_note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_buyer record;
  v_event record;
BEGIN
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;

  UPDATE public.events
  SET start_datetime = p_new_start,
      end_datetime = p_new_end,
      postponed_at = now(),
      organizer_note = p_note
  WHERE id = p_event_id;

  -- Notify buyers
  FOR v_buyer IN
    SELECT DISTINCT o.buyer_email, o.id as order_id
    FROM public.orders o
    JOIN public.tickets t ON t.order_id = o.id
    WHERE o.event_id = p_event_id AND t.status = 'valid'
  LOOP
    INSERT INTO public.messages (
      user_email,
      event_id,
      subject,
      body,
      action_url,
      action_text
    ) VALUES (
      v_buyer.buyer_email,
      p_event_id,
      'Event Postponed: ' || v_event.title,
      'This event has been postponed. The new start date is ' || to_char(p_new_start, 'FMMonth FMDD, YYYY') || '. ' || COALESCE(p_note, '') || ' Your existing ticket remains valid for the new date.',
      '/orders/' || v_buyer.order_id || '/tickets',
      'View Ticket'
    );
  END LOOP;
END;
$$;
