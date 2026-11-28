-- Free tickets: an organizer or platform admin can send a real, scannable
-- ticket to a named email at no cost.
--
-- Free tickets are deliberately invisible to everything that measures sales:
-- quantity_sold is left untouched, the order is zero-value 'comp' stock, so
-- public stock, tickets-sold counters, revenue and analytics do not move.
-- Every issuance is written to free_tickets so staff can audit how many were
-- given out and to which addresses.

CREATE TABLE IF NOT EXISTS public.free_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  ticket_type_id uuid NOT NULL REFERENCES public.ticket_types(id) ON DELETE RESTRICT,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  recipient_name text,
  recipient_email text NOT NULL,
  issued_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS free_tickets_event_idx ON public.free_tickets(event_id);
CREATE INDEX IF NOT EXISTS free_tickets_email_idx ON public.free_tickets(recipient_email);

GRANT SELECT ON public.free_tickets TO authenticated;
GRANT ALL ON public.free_tickets TO service_role;

ALTER TABLE public.free_tickets ENABLE ROW LEVEL SECURITY;

-- The organizer of the event and platform staff can read the log. Nobody
-- inserts directly: issuance goes through the RPC below, which records who
-- sent the ticket.
DROP POLICY IF EXISTS "free_tickets_staff_read" ON public.free_tickets;
CREATE POLICY "free_tickets_staff_read" ON public.free_tickets
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = free_tickets.event_id AND e.organizer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles r
      WHERE r.user_id = auth.uid() AND r.role IN ('admin', 'customer_care')
    )
  );

CREATE OR REPLACE FUNCTION public.issue_free_tickets(
  p_event_id uuid,
  p_ticket_type_id uuid,
  p_recipients jsonb[] -- array of { name: '...', email: '...' }
)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event record;
  v_type record;
  v_recipient jsonb;
  v_email text;
  v_name text;
  v_order_id uuid;
  v_item_id uuid;
  v_ticket_id uuid;
  v_order_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in required';
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF NOT (
    v_event.organizer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles r
      WHERE r.user_id = auth.uid() AND r.role IN ('admin', 'customer_care')
    )
  ) THEN
    RAISE EXCEPTION 'Only the organizer or a platform admin can send free tickets';
  END IF;

  IF v_event.admin_cancelled THEN
    RAISE EXCEPTION 'This event was cancelled by a platform admin and cannot issue tickets';
  END IF;

  SELECT * INTO v_type
  FROM public.ticket_types
  WHERE id = p_ticket_type_id AND event_id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket type not found for this event';
  END IF;

  IF p_recipients IS NULL OR array_length(p_recipients, 1) IS NULL THEN
    RAISE EXCEPTION 'Add at least one recipient';
  END IF;

  FOREACH v_recipient IN ARRAY p_recipients LOOP
    v_email := lower(btrim(coalesce(v_recipient->>'email', '')));
    v_name := nullif(btrim(coalesce(v_recipient->>'name', '')), '');

    IF v_email = '' OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
      RAISE EXCEPTION 'Invalid recipient email: %', v_email;
    END IF;

    -- One zero-value order per recipient. Status 'comp' keeps it out of paid
    -- reporting; quantity_sold is never touched, so nothing looks sold.
    INSERT INTO public.orders (
      event_id, user_id, buyer_name, buyer_email,
      subtotal_kobo, discount_kobo, total_kobo,
      status, payment_reference,
      is_gift, recipient_name, recipient_email
    ) VALUES (
      p_event_id, NULL, coalesce(v_name, v_email), v_email,
      0, 0, 0,
      'comp', 'FREE_' || replace(gen_random_uuid()::text, '-', ''),
      true, v_name, v_email
    ) RETURNING id INTO v_order_id;

    INSERT INTO public.order_items (order_id, ticket_type_id, quantity, unit_price_kobo)
    VALUES (v_order_id, p_ticket_type_id, 1, 0)
    RETURNING id INTO v_item_id;

    INSERT INTO public.tickets (order_item_id, attendee_name, attendee_email, status)
    VALUES (v_item_id, v_name, v_email, 'valid')
    RETURNING id INTO v_ticket_id;

    INSERT INTO public.free_tickets (
      event_id, ticket_type_id, ticket_id, recipient_name, recipient_email, issued_by
    ) VALUES (
      p_event_id, p_ticket_type_id, v_ticket_id, v_name, v_email, auth.uid()
    );

    INSERT INTO public.messages (
      recipient_email, type, title, body, related_order_id, related_ticket_ids
    ) VALUES (
      v_email,
      'ticket_delivery',
      'Your free ticket for ' || v_event.title,
      'You have been given a free ticket to ' || v_event.title || '. Open the link to view and download it.',
      v_order_id,
      ARRAY[v_ticket_id]
    );

    v_order_ids := array_append(v_order_ids, v_order_id);
  END LOOP;

  RETURN v_order_ids;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_free_tickets(uuid, uuid, jsonb[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_free_tickets(uuid, uuid, jsonb[]) TO authenticated, service_role;
