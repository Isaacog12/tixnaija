-- Rate-limit get_guest_orders to prevent brute-forcing guest access PINs.
-- Follows the same pattern used in validate_promo_code:
--   • Log each attempt to rate_limit_log with the caller's IP
--   • Reject after 5 attempts in a 10-minute window per IP

CREATE OR REPLACE FUNCTION public.get_guest_orders(p_email text, p_access_code text)
RETURNS TABLE (
  id           uuid,
  event_id     uuid,
  buyer_name   text,
  buyer_email  text,
  total_kobo   int,
  status       text,
  created_at   timestamptz,
  event_title  text,
  event_slug   text,
  event_city   text,
  event_cover  text,
  event_start  timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ip_address   text;
  v_attempt_count integer;
  v_headers      json;
BEGIN
  -- 1. Extract IP address from request headers (Kong / Supabase Gateway)
  BEGIN
    v_headers := current_setting('request.headers', true)::json;
    v_ip_address := v_headers->>'x-forwarded-for';
  EXCEPTION WHEN OTHERS THEN
    v_ip_address := 'unknown';
  END;

  IF v_ip_address IS NULL THEN
    v_ip_address := 'unknown';
  END IF;

  -- Grab just the first IP if comma-separated (proxies)
  v_ip_address := split_part(v_ip_address, ',', 1);

  -- 2. Log this attempt
  INSERT INTO public.rate_limit_log (ip_address, endpoint)
  VALUES (v_ip_address, 'get_guest_orders');

  -- 3. Check rate limit: max 5 attempts per 10 minutes per IP
  SELECT count(*) INTO v_attempt_count
  FROM public.rate_limit_log
  WHERE ip_address = v_ip_address
    AND endpoint = 'get_guest_orders'
    AND created_at > now() - interval '10 minutes';

  IF v_attempt_count > 5 THEN
    RAISE EXCEPTION 'Too many lookup attempts. Please wait a few minutes and try again.';
  END IF;

  -- 4. Perform the actual lookup
  RETURN QUERY
    SELECT
      o.id,
      o.event_id,
      o.buyer_name,
      o.buyer_email,
      o.total_kobo,
      o.status,
      o.created_at,
      e.title            AS event_title,
      e.slug             AS event_slug,
      e.city             AS event_city,
      e.cover_image_url  AS event_cover,
      e.start_datetime   AS event_start
    FROM orders o
    JOIN events e ON e.id = o.event_id
    WHERE lower(o.buyer_email) = lower(p_email)
      AND o.access_code = p_access_code
      AND o.status = 'paid'
    ORDER BY o.created_at DESC
    LIMIT 20;
END;
$$;
