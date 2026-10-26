-- Fix validate_promo_code: use active column, check expires_at, and return correct JSON structure
DROP FUNCTION IF EXISTS public.validate_promo_code(uuid, text);

CREATE OR REPLACE FUNCTION public.validate_promo_code(
  p_event_id uuid,
  p_code text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promo_code record;
  v_ip_address text;
  v_attempt_count integer;
  v_headers json;
BEGIN
  -- 1. Extract IP Address from Kong headers for rate limiting
  BEGIN
    v_headers := current_setting('request.headers', true)::json;
    v_ip_address := v_headers->>'x-forwarded-for';
  EXCEPTION WHEN OTHERS THEN
    v_ip_address := 'unknown';
  END;

  IF v_ip_address IS NULL THEN
    v_ip_address := 'unknown';
  END IF;

  v_ip_address := split_part(v_ip_address, ',', 1);

  -- 2. Log attempt in rate_limit_log if available
  BEGIN
    INSERT INTO public.rate_limit_log (ip_address, endpoint) 
    VALUES (v_ip_address, 'validate_promo_code');

    -- 3. Check rate limit (max 15 attempts per minute per IP)
    SELECT count(*) INTO v_attempt_count
    FROM public.rate_limit_log
    WHERE ip_address = v_ip_address
      AND endpoint = 'validate_promo_code'
      AND created_at > now() - interval '1 minute';

    IF v_attempt_count > 15 THEN
      RAISE EXCEPTION 'Too many attempts, please wait a moment and try again';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Too many attempts%' THEN
      RAISE;
    END IF;
    -- Ignore logging errors if rate_limit_log table is unavailable
  END;

  -- 4. Find the promo code using correct column names: 'active' and 'expires_at'
  SELECT *
  INTO v_promo_code
  FROM public.promo_codes
  WHERE event_id = p_event_id 
    AND UPPER(TRIM(code)) = UPPER(TRIM(p_code))
    AND active = true;
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid promo code';
  END IF;
  
  -- 5. Check expiration
  IF v_promo_code.expires_at IS NOT NULL AND now() > v_promo_code.expires_at THEN
    RAISE EXCEPTION 'This promo code has expired';
  END IF;

  -- 6. Check usage limits
  IF v_promo_code.max_uses IS NOT NULL AND v_promo_code.times_used >= v_promo_code.max_uses THEN
    RAISE EXCEPTION 'This promo code has reached its usage limit';
  END IF;
  
  -- 7. Return safe data for checkout computation
  RETURN json_build_object(
    'id', v_promo_code.id,
    'code', v_promo_code.code,
    'discount_type', v_promo_code.discount_type,
    'discount_value', v_promo_code.discount_value
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_promo_code(uuid, text) TO anon, authenticated, service_role;
