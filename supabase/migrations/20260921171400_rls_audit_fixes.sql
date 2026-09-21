-- ============================================================
-- RLS AUDIT FIX 1: check_in_ticket RPC + revoke direct UPDATE
-- Branch: rls-audit
-- ============================================================

-- 1. Create a secure SECURITY DEFINER RPC for ticket check-in.
--    This is the ONLY way to mark a ticket as checked_in.
--    It validates:
--      a) Caller is authenticated
--      b) Ticket belongs to the given event
--      c) Caller is the event's organizer (or an admin)
--      d) Ticket is currently 'valid' (not already scanned or cancelled)
--    It writes ONLY status, checked_in_at, and checked_in_by.
--    No other column is touched.

CREATE OR REPLACE FUNCTION public.check_in_ticket(
  p_ticket_code uuid,
  p_event_id    uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller    uuid;
  v_ticket    RECORD;
  v_event     RECORD;
  v_is_admin  boolean;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: must be signed in';
  END IF;

  -- Check if caller is an admin
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_caller AND role = 'admin'
  ) INTO v_is_admin;

  -- Fetch event and verify caller is the organizer (or admin)
  SELECT id, organizer_id, title INTO v_event
  FROM public.events
  WHERE id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF NOT v_is_admin AND v_event.organizer_id != v_caller THEN
    RAISE EXCEPTION 'Unauthorized: you are not the organizer of this event';
  END IF;

  -- Fetch the ticket, confirming it belongs to this event
  SELECT t.id, t.status, t.checked_in_at INTO v_ticket
  FROM public.tickets t
  JOIN public.order_items oi ON oi.id = t.order_item_id
  JOIN public.orders o ON o.id = oi.order_id
  WHERE t.ticket_code = p_ticket_code
    AND o.event_id = p_event_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'invalid',
      'message', 'Ticket not found for this event'
    );
  END IF;

  IF v_ticket.status = 'checked_in' THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'already_scanned',
      'message', 'Ticket already checked in',
      'checked_in_at', v_ticket.checked_in_at
    );
  END IF;

  IF v_ticket.status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'cancelled',
      'message', 'Ticket is cancelled and invalid'
    );
  END IF;

  -- All checks passed — write ONLY status + checked_in_at + checked_in_by
  UPDATE public.tickets
  SET
    status        = 'checked_in',
    checked_in_at = now(),
    checked_in_by = v_caller
  WHERE id = v_ticket.id;

  RETURN jsonb_build_object(
    'success', true,
    'reason', 'ok',
    'message', 'Check-in successful'
  );
END;
$$;

-- Only organizers and admins (authenticated users) can call this.
-- anon cannot call it (they can't be verified as an organizer).
REVOKE ALL ON FUNCTION public.check_in_ticket(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_in_ticket(uuid, uuid) TO authenticated, service_role;


-- 2. Revoke direct client UPDATE on the tickets table.
--    The tickets_organizer_checkin RLS policy is now redundant and dangerous — remove it.
--    All check-in writes now go through check_in_ticket() above.
REVOKE UPDATE ON public.tickets FROM authenticated;
DROP POLICY IF EXISTS "tickets_organizer_checkin" ON public.tickets;


-- ============================================================
-- RLS AUDIT FIX 2: Drop process_test_checkout
-- This function is not called by any frontend code.
-- It is a leftover dev scaffold with an unfixed p_user_id
-- impersonation vulnerability. The real production checkout
-- function is process_checkout (separate function).
-- ============================================================

DROP FUNCTION IF EXISTS public.process_test_checkout(
  uuid, uuid, text, text, text, jsonb, integer, integer, integer, text
);


-- ============================================================
-- RLS AUDIT FIX 3: Tighten sponsored_banners SELECT policy
-- Previously USING (true) — exposed draft/inactive banners
-- to unauthenticated direct API queries.
-- ============================================================

DROP POLICY IF EXISTS "Anyone can view active banners" ON public.sponsored_banners;

CREATE POLICY "Anyone can view active banners" ON public.sponsored_banners
FOR SELECT TO public
USING (is_active = true);
