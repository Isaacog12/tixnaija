-- Close unsafe public reads and scope public organizer data to an explicit allowlist.
DROP POLICY IF EXISTS "guests can read own orders by email" ON public.orders;
DROP POLICY IF EXISTS "promo_codes_read" ON public.promo_codes;
CREATE POLICY "promo_codes_read" ON public.promo_codes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = promo_codes.event_id
        AND e.organizer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles r
      WHERE r.user_id = auth.uid() AND r.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "event_staff_read" ON public.event_staff;
CREATE POLICY "event_staff_read" ON public.event_staff
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_staff.event_id AND e.organizer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles r
      WHERE r.user_id = auth.uid() AND r.role = 'admin'
    )
  );

CREATE OR REPLACE VIEW public.public_organizer_profiles AS
SELECT
  p.id,
  p.full_name,
  p.username,
  p.organizer_slug,
  p.avatar_url,
  p.banner_url,
  p.bio,
  p.is_verified_organizer
FROM public.profiles p
WHERE p.organizer_slug IS NOT NULL
   OR EXISTS (
     SELECT 1 FROM public.user_roles r
     WHERE r.user_id = p.id AND r.role = 'organizer'
   );

GRANT SELECT ON public.public_organizer_profiles TO anon, authenticated;

-- Restrict public waitlist writes and add server-side per-IP throttling.
DROP POLICY IF EXISTS "waitlist_insert" ON public.waitlist_entries;
CREATE POLICY "waitlist_insert" ON public.waitlist_entries
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    length(trim(name)) BETWEEN 1 AND 120
    AND length(trim(email)) BETWEEN 3 AND 254
    AND email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = waitlist_entries.event_id AND e.status = 'published'
    )
    AND (
      ticket_tier_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.ticket_types tt
        WHERE tt.id = waitlist_entries.ticket_tier_id
          AND tt.event_id = waitlist_entries.event_id
      )
    )
  );

CREATE OR REPLACE FUNCTION public.rate_limit_waitlist_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_headers json;
  v_ip_address text;
  v_attempt_count integer;
BEGIN
  BEGIN
    v_headers := current_setting('request.headers', true)::json;
    v_ip_address := v_headers->>'x-forwarded-for';
  EXCEPTION WHEN OTHERS THEN
    v_ip_address := NULL;
  END;

  v_ip_address := split_part(coalesce(nullif(v_ip_address, ''), 'unknown'), ',', 1);
  INSERT INTO public.rate_limit_log (ip_address, endpoint)
  VALUES (v_ip_address, 'waitlist_insert');

  SELECT count(*) INTO v_attempt_count
  FROM public.rate_limit_log
  WHERE ip_address = v_ip_address
    AND endpoint = 'waitlist_insert'
    AND created_at > now() - interval '1 hour';

  IF v_attempt_count > 5 THEN
    RAISE EXCEPTION 'Too many waitlist requests. Please try again later.';
  END IF;

  NEW.name := trim(NEW.name);
  NEW.email := lower(trim(NEW.email));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rate_limit_waitlist_insert ON public.waitlist_entries;
CREATE TRIGGER rate_limit_waitlist_insert
  BEFORE INSERT ON public.waitlist_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.rate_limit_waitlist_insert();

-- Never fall back to a credential embedded in a migration.
CREATE OR REPLACE FUNCTION public.trigger_waitlist_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_waitlist_count integer;
  v_supabase_url text;
  v_trigger_secret text;
BEGIN
  IF (NEW.quantity_available - (NEW.quantity_sold - NEW.quantity_cancelled))
       > (OLD.quantity_available - (OLD.quantity_sold - OLD.quantity_cancelled))
     AND (NEW.quantity_available - (NEW.quantity_sold - NEW.quantity_cancelled)) > 0 THEN
    SELECT count(*) INTO v_waitlist_count
    FROM public.waitlist_entries
    WHERE ticket_tier_id = NEW.id AND status = 'waiting';

    IF v_waitlist_count > 0 THEN
      v_supabase_url := coalesce(
        nullif(current_setting('app.settings.supabase_url', true), ''),
        'https://bjijftxksykbjknbleul.supabase.co'
      );
      v_trigger_secret := nullif(
        current_setting('app.settings.internal_trigger_secret', true),
        ''
      );
      IF v_trigger_secret IS NULL THEN
        SELECT decrypted_secret INTO v_trigger_secret
        FROM vault.decrypted_secrets
        WHERE name = 'waitlist_trigger_secret'
        LIMIT 1;
      END IF;

      IF v_trigger_secret IS NOT NULL THEN
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/notify-waitlist',
          headers := json_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_trigger_secret,
            'x-internal-trigger-secret', v_trigger_secret
          )::jsonb,
          body := json_build_object('ticket_tier_id', NEW.id)::jsonb
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Make suspension effective for new sessions and for row-level mutations.
CREATE OR REPLACE FUNCTION public.current_user_is_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.suspended
    );
$$;

REVOKE ALL ON FUNCTION public.current_user_is_active() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_is_active() TO authenticated;

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'profiles', 'events', 'ticket_types', 'orders', 'order_items',
    'tickets', 'promo_codes', 'event_staff', 'waitlist_entries'
  ]
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS suspended_accounts_cannot_insert ON public.%I',
      v_table
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS suspended_accounts_cannot_update ON public.%I',
      v_table
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS suspended_accounts_cannot_delete ON public.%I',
      v_table
    );
    EXECUTE format(
      'CREATE POLICY suspended_accounts_cannot_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.current_user_is_active())',
      v_table
    );
    EXECUTE format(
      'CREATE POLICY suspended_accounts_cannot_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.current_user_is_active()) WITH CHECK (public.current_user_is_active())',
      v_table
    );
    EXECUTE format(
      'CREATE POLICY suspended_accounts_cannot_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (public.current_user_is_active())',
      v_table
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_suspended_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = NEW.user_id AND p.suspended
  ) THEN
    RAISE EXCEPTION 'This account is suspended and cannot place orders.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reject_suspended_order ON public.orders;
CREATE TRIGGER reject_suspended_order
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_suspended_order();

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

  UPDATE auth.users
  SET banned_until = CASE
    WHEN p_suspended THEN now() + interval '100 years'
    ELSE NULL
  END
  WHERE id = p_user_id;
END;
$$;

-- Event-scoped online check-in prevents a valid ticket for a different event
-- from being accepted by a multi-event gate operator.
DROP FUNCTION IF EXISTS public.check_in_ticket(text);
CREATE FUNCTION public.check_in_ticket(p_ticket_code text, p_event_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ticket_id uuid;
  v_status public.ticket_status;
  v_checked_in_at timestamptz;
  v_organizer_id uuid;
  v_attendee_name text;
  v_ticket_name text;
  v_caller_uid uuid := auth.uid();
  v_is_admin boolean := false;
BEGIN
  IF v_caller_uid IS NULL OR NOT public.current_user_is_active() THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_caller_uid AND role = 'admin'
  ) INTO v_is_admin;

  SELECT t.id, t.status, t.checked_in_at, t.attendee_name, e.organizer_id, tt.name
  INTO v_ticket_id, v_status, v_checked_in_at, v_attendee_name, v_organizer_id, v_ticket_name
  FROM public.tickets t
  JOIN public.order_items oi ON oi.id = t.order_item_id
  JOIN public.ticket_types tt ON tt.id = oi.ticket_type_id
  JOIN public.events e ON e.id = tt.event_id
  WHERE t.ticket_code = p_ticket_code::uuid
    AND e.id = p_event_id
  FOR UPDATE OF t;

  IF v_ticket_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid ticket for selected event');
  END IF;

  IF v_caller_uid != v_organizer_id AND NOT v_is_admin THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized for selected event');
  END IF;
  IF v_status = 'cancelled' THEN
    RETURN json_build_object('success', false, 'error', 'This ticket has been cancelled');
  END IF;
  IF v_status = 'checked_in' THEN
    RETURN json_build_object(
      'success', true,
      'already_checked_in', true,
      'checked_in_at', v_checked_in_at,
      'attendee_name', v_attendee_name,
      'ticket_name', v_ticket_name
    );
  END IF;

  UPDATE public.tickets
  SET status = 'checked_in', checked_in_at = now(), checked_in_by = v_caller_uid
  WHERE id = v_ticket_id AND status = 'valid';

  RETURN json_build_object(
    'success', true,
    'already_checked_in', false,
    'checked_in_at', now(),
    'attendee_name', v_attendee_name,
    'ticket_name', v_ticket_name
  );
EXCEPTION WHEN invalid_text_representation THEN
  RETURN json_build_object('success', false, 'error', 'Invalid ticket code format');
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_in_ticket(text, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.check_in_ticket(text, uuid) FROM PUBLIC, anon;

-- Return item-level failures so the mobile scanner retains only scans that
-- have not been accepted by the server.
DROP FUNCTION IF EXISTS public.bulk_sync_offline_checkins(jsonb);
CREATE FUNCTION public.bulk_sync_offline_checkins(p_scans jsonb, p_event_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_uid uuid := auth.uid();
  v_is_admin boolean := false;
  v_scan jsonb;
  v_ticket_code text;
  v_scanned_at timestamptz;
  v_ticket_id uuid;
  v_status public.ticket_status;
  v_organizer_id uuid;
  v_ticket_event_id uuid;
  v_success_count integer := 0;
  v_fail_count integer := 0;
  v_synced_codes jsonb := '[]'::jsonb;
  v_failed_scans jsonb := '[]'::jsonb;
  v_failure_reason text;
BEGIN
  IF v_caller_uid IS NULL OR NOT public.current_user_is_active() THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized');
  END IF;
  IF jsonb_typeof(p_scans) <> 'array' OR jsonb_array_length(p_scans) > 500 THEN
    RAISE EXCEPTION 'Scan batch must be an array of no more than 500 items.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_caller_uid AND role = 'admin'
  ) INTO v_is_admin;

  FOR v_scan IN SELECT value FROM jsonb_array_elements(p_scans)
  LOOP
    v_ticket_code := v_scan->>'ticket_code';
    v_failure_reason := NULL;
    v_ticket_id := NULL;
    v_scanned_at := NULL;

    BEGIN
      v_scanned_at := coalesce(nullif(v_scan->>'scanned_at', '')::timestamptz, now());
    EXCEPTION WHEN OTHERS THEN
      v_failure_reason := 'Invalid scan timestamp';
    END;

    IF v_failure_reason IS NULL THEN
      SELECT t.id, t.status, e.organizer_id, e.id
      INTO v_ticket_id, v_status, v_organizer_id, v_ticket_event_id
      FROM public.tickets t
      JOIN public.order_items oi ON oi.id = t.order_item_id
      JOIN public.ticket_types tt ON tt.id = oi.ticket_type_id
      JOIN public.events e ON e.id = tt.event_id
      WHERE t.ticket_code::text = v_ticket_code
        AND e.id = p_event_id
      FOR UPDATE OF t;

      IF v_ticket_id IS NULL THEN
        v_failure_reason := 'Invalid ticket for selected event';
      ELSIF v_caller_uid != v_organizer_id AND NOT v_is_admin THEN
        v_failure_reason := 'Unauthorized for selected event';
      ELSIF v_status <> 'valid' THEN
        v_failure_reason := 'Ticket is not valid or is already checked in';
      END IF;
    END IF;

    IF v_failure_reason IS NULL THEN
      UPDATE public.tickets
      SET status = 'checked_in',
          checked_in_at = v_scanned_at,
          checked_in_by = v_caller_uid
      WHERE id = v_ticket_id AND status = 'valid';

      IF FOUND THEN
        v_success_count := v_success_count + 1;
        v_synced_codes := v_synced_codes || jsonb_build_array(v_ticket_code);
      ELSE
        v_failure_reason := 'Ticket was checked in by another scanner';
      END IF;
    END IF;

    IF v_failure_reason IS NOT NULL THEN
      v_fail_count := v_fail_count + 1;
      v_failed_scans := v_failed_scans || jsonb_build_array(
        jsonb_build_object(
          'ticket_code', v_ticket_code,
          'scanned_at', v_scan->>'scanned_at',
          'reason', v_failure_reason
        )
      );
    END IF;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'synced_count', v_success_count,
    'failed_count', v_fail_count,
    'synced_codes', v_synced_codes,
    'failed_scans', v_failed_scans
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_sync_offline_checkins(jsonb, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.bulk_sync_offline_checkins(jsonb, uuid) FROM PUBLIC, anon;
