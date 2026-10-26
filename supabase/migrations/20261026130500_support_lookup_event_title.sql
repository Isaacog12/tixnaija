-- Migration: Add event_id and event_title to support_lookup_customer orders and tickets
-- File: supabase/migrations/20261026130500_support_lookup_event_title.sql

CREATE OR REPLACE FUNCTION public.support_lookup_customer(p_query TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.assert_support_staff();
  v_actor_email TEXT;
  v_clean_query TEXT;
  v_escaped_name_prefix TEXT;
  v_recent_searches_min INT;
  v_recent_searches_day INT;
  v_normalized_phone TEXT;
  v_result JSONB;
BEGIN
  v_clean_query := trim(p_query);
  IF length(v_clean_query) < 3 THEN
    RAISE EXCEPTION 'Query must be at least 3 characters long';
  END IF;

  -- 1. Rate Limits: Max 30 lookups / min, max 200 lookups / day per agent
  SELECT COUNT(*) INTO v_recent_searches_min
  FROM public.support_audit_logs
  WHERE actor_id = v_actor AND action = 'lookup_customer' AND created_at > (now() - INTERVAL '1 minute');

  IF v_recent_searches_min >= 30 THEN
    RAISE EXCEPTION 'Lookup rate limit exceeded: maximum 30 searches per minute';
  END IF;

  SELECT COUNT(*) INTO v_recent_searches_day
  FROM public.support_audit_logs
  WHERE actor_id = v_actor AND action = 'lookup_customer' AND created_at > (now() - INTERVAL '24 hours');

  IF v_recent_searches_day >= 200 THEN
    RAISE EXCEPTION 'Daily lookup quota reached: maximum 200 customer searches per day';
  END IF;

  -- 2. Normalize Nigerian phone numbers to standard format (+234...)
  v_normalized_phone := v_clean_query;
  IF v_normalized_phone ~ '^0[789][01]\d{8}$' THEN
    v_normalized_phone := '+234' || substring(v_normalized_phone from 2);
  END IF;

  -- 3. Escape wildcard characters for name prefix search
  v_escaped_name_prefix := replace(replace(replace(v_clean_query, '\', '\\'), '%', '\%'), '_', '\_');

  -- 4. Atomic Audit Log
  SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor;
  INSERT INTO public.support_audit_logs (actor_id, actor_email, action, target_type, target_id, details)
  VALUES (v_actor, v_actor_email, 'lookup_customer', 'query', v_clean_query, jsonb_build_object('query', v_clean_query));

  -- 5. Subquery-wrapped LIMIT 10 Aggregation
  SELECT jsonb_build_object(
    'customers', COALESCE((
      SELECT jsonb_agg(s.x) FROM (
        SELECT jsonb_build_object(
          'id', p.id,
          'full_name', p.full_name,
          'email', CASE 
            WHEN uc.email = lower(v_clean_query) THEN uc.email 
            ELSE regexp_replace(uc.email, '(?<=.).(?=.*@)', '*', 'g') 
          END,
          'phone_number', CASE 
            WHEN uc.phone_number = v_clean_query OR uc.phone_number = v_normalized_phone THEN uc.phone_number 
            ELSE '••••••••' || RIGHT(COALESCE(uc.phone_number::text, '0000'), 4)
          END,
          'created_at', p.created_at
        ) AS x
        FROM public.profiles p
        JOIN public.user_contacts uc ON uc.user_id = p.id
        WHERE uc.email = lower(v_clean_query)                           -- EXACT MATCH
           OR uc.phone_number = v_clean_query                          -- EXACT MATCH
           OR uc.phone_number = v_normalized_phone                     -- EXACT MATCH
           OR p.full_name ILIKE v_escaped_name_prefix || '%'           -- Prefix Match
        ORDER BY p.created_at DESC
        LIMIT 10
      ) s
    ), '[]'::jsonb),
    'orders', COALESCE((
      SELECT jsonb_agg(s.x) FROM (
        SELECT jsonb_build_object(
          'id', o.id,
          'event_id', o.event_id,
          'event_title', e.title,
          'payment_reference', o.payment_reference,
          'buyer_name', o.buyer_name,
          'buyer_email', o.buyer_email,
          'total_kobo', o.total_kobo,
          'status', o.status,
          'created_at', o.created_at
        ) AS x
        FROM public.orders o
        LEFT JOIN public.events e ON e.id = o.event_id
        WHERE o.payment_reference = v_clean_query                      -- EXACT MATCH
           OR lower(o.buyer_email) = lower(v_clean_query)              -- EXACT MATCH
           OR o.buyer_phone = v_clean_query                            -- EXACT MATCH
           OR o.buyer_phone = v_normalized_phone                       -- EXACT MATCH
        ORDER BY o.created_at DESC
        LIMIT 10
      ) s
    ), '[]'::jsonb),
    'tickets', COALESCE((
      SELECT jsonb_agg(s.x) FROM (
        SELECT jsonb_build_object(
          'id', t.id,
          'event_title', e.title,
          'masked_code', '••••-••••-' || RIGHT(t.ticket_code::text, 4),
          'status', t.status,
          'attendee_name', t.attendee_name,
          'attendee_email', t.attendee_email,
          'order_id', oi.order_id
        ) AS x
        FROM public.tickets t
        JOIN public.order_items oi ON oi.id = t.order_item_id
        LEFT JOIN public.orders o ON o.id = oi.order_id
        LEFT JOIN public.events e ON e.id = o.event_id
        WHERE t.ticket_code::text = v_clean_query                      -- Safe TEXT MATCH
        ORDER BY t.created_at DESC
        LIMIT 10
      ) s
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.support_lookup_customer(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_lookup_customer(text) TO authenticated;
