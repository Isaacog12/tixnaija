-- ============================================================
-- ADMIN: Full-read RLS policies for all major tables
-- ============================================================

-- Helper: is the current user an admin? (used in all policies below)
-- We use EXISTS against user_roles — the single source of truth.

-- PROFILES — admins can read all profiles
CREATE POLICY "profiles_select_admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- EVENTS — admins can read ALL events (all statuses, all organizers)
CREATE POLICY "events_admin_view_all" ON public.events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- EVENTS — admins can update any event (needed for takedown)
CREATE POLICY "events_admin_update_all" ON public.events
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ORDERS — admins can read all orders
CREATE POLICY "orders_admin_view_all" ON public.orders
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- TICKETS — admins can read all tickets
CREATE POLICY "tickets_admin_view_all" ON public.tickets
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- USER_ROLES — NOTE: Do NOT add a SELECT policy here that queries user_roles itself.
-- That causes infinite recursion. The existing user_roles_select_own policy (auth.uid() = user_id)
-- already allows all admin subqueries like:
--   EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
-- because the WHERE clause satisfies user_roles_select_own.
-- Admin bulk user listing is done via the admin-list-users edge function (service role, bypasses RLS).

-- ============================================================
-- CONTACT_MESSAGES — fix RLS to use user_roles (not profiles.is_admin)
-- ============================================================
DROP POLICY IF EXISTS "contact_messages_select_admin" ON public.contact_messages;
DROP POLICY IF EXISTS "contact_messages_update_admin" ON public.contact_messages;

CREATE POLICY "contact_messages_select_admin" ON public.contact_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "contact_messages_update_admin" ON public.contact_messages
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- PROFILES — add suspended column for user management
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspended boolean NOT NULL DEFAULT false;

-- ============================================================
-- PROFILES — admins can update any profile (for suspend/unsuspend)
-- ============================================================
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- admin_cancel_event RPC — admin override, no organizer check
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_cancel_event(
  p_event_id uuid,
  p_note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer  record;
  v_event  record;
  v_caller uuid := auth.uid();
BEGIN
  -- Caller must be an admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_caller AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;
  IF v_event.status = 'cancelled' THEN RAISE EXCEPTION 'Event is already cancelled'; END IF;

  UPDATE public.events
  SET status        = 'cancelled',
      cancelled_at  = now(),
      organizer_note = COALESCE(p_note, 'Taken down by platform admin.')
  WHERE id = p_event_id;

  -- Notify all buyers with valid tickets
  FOR v_buyer IN
    SELECT DISTINCT o.buyer_email, o.id AS order_id
    FROM public.orders o
    JOIN public.tickets t ON t.order_id = o.id
    WHERE o.event_id = p_event_id AND t.status = 'valid'
  LOOP
    INSERT INTO public.messages (
      user_email, event_id, subject, body, action_url, action_text
    ) VALUES (
      v_buyer.buyer_email,
      p_event_id,
      'Event Cancelled: ' || v_event.title,
      'This event has been taken down by the platform. ' || COALESCE(p_note, '') ||
      ' Please expect a refund to your original payment method.',
      '/orders/' || v_buyer.order_id || '/tickets',
      'View Details'
    );
  END LOOP;
END;
$$;

-- ============================================================
-- admin_suspend_user RPC — toggle suspended on a profile
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_suspend_user(
  p_user_id uuid,
  p_suspended boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  UPDATE public.profiles
  SET suspended = p_suspended
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
END;
$$;
