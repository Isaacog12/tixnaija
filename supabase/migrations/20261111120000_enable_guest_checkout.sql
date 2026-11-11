-- ============================================================
-- Migration: 20261111120000_enable_guest_checkout.sql
-- Description: Enable guest checkout.
--   1. 100% free tiers can be claimed without an account, provided the guest
--      supplies a high-entropy access code so the order can be retrieved later
--      (email + access code, or email + payment reference).
--   2. Anonymous claims are throttled per IP to curb free-stock draining.
--   Paid orders already flow through Paystack -> process_checkout with a null
--   user_id, so nothing changes for them.
-- ============================================================

CREATE OR REPLACE FUNCTION public.process_free_checkout(
  p_event_id uuid,
  p_user_id uuid,
  p_buyer_name text,
  p_buyer_email text,
  p_buyer_phone text,
  p_tickets jsonb,
  p_promo_code_id uuid default null,
  p_is_gift boolean default false,
  p_recipient_name text default null,
  p_recipient_email text default null,
  p_gift_message text default null,
  p_access_code text default null,
  p_promoter_link_id uuid default null,
  p_checkout_answers jsonb default null
) returns uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_computed_subtotal integer := 0;
  v_computed_discount integer := 0;
  v_computed_total integer := 0;
  v_promo record;
  v_item jsonb;
  v_ticket_type record;
  v_ticket_type_id uuid;
  v_count integer;
  v_free_reference text;
  v_actual_user_id uuid;
  v_is_guest boolean;
  v_ip_address text;
  v_headers json;
  v_attempt_count integer;
BEGIN
  -- 1. Resolve the acting user. Never trust a caller-supplied user id.
  v_actual_user_id := auth.uid();
  v_is_guest := v_actual_user_id IS NULL;

  -- 2. Guest guard rails: the access code is the guest's only way back into
  --    the order, so require an email and a high-entropy code (the client
  --    sends a 32-char hex nonce), then throttle per IP.
  IF v_is_guest THEN
    IF p_buyer_email IS NULL OR trim(p_buyer_email) = '' THEN
      RAISE EXCEPTION 'An email address is required to claim free tickets.';
    END IF;

    IF p_access_code IS NULL OR length(trim(p_access_code)) < 16 THEN
      RAISE EXCEPTION 'A valid guest access code is required to claim free tickets.';
    END IF;

    BEGIN
      v_headers := current_setting('request.headers', true)::json;
      v_ip_address := v_headers->>'x-forwarded-for';
    EXCEPTION WHEN others THEN
      v_ip_address := 'unknown';
    END;

    IF v_ip_address IS NULL THEN
      v_ip_address := 'unknown';
    END IF;
    v_ip_address := split_part(v_ip_address, ',', 1);

    INSERT INTO public.rate_limit_log (ip_address, endpoint)
    VALUES (v_ip_address, 'process_free_checkout_guest');

    SELECT count(*) INTO v_attempt_count
    FROM public.rate_limit_log
    WHERE ip_address = v_ip_address
      AND endpoint = 'process_free_checkout_guest'
      AND created_at > now() - interval '1 hour';

    IF v_attempt_count > 5 THEN
      RAISE EXCEPTION 'Too many free ticket claims from this network. Please try again later.';
    END IF;
  END IF;

  -- 3. Validate that ticket items belong to the event and count is positive
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_tickets)
  LOOP
    v_ticket_type_id := (v_item->>'ticketTypeId')::uuid;
    v_count := (v_item->>'count')::integer;

    IF v_count IS NULL OR v_count <= 0 THEN
      RAISE EXCEPTION 'Ticket count must be a positive integer';
    END IF;

    SELECT price_kobo, event_id INTO v_ticket_type
    FROM public.ticket_types
    WHERE id = v_ticket_type_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ticket type % not found', v_ticket_type_id;
    END IF;

    IF v_ticket_type.event_id != p_event_id THEN
      RAISE EXCEPTION 'Ticket type does not belong to this event';
    END IF;

    v_computed_subtotal := v_computed_subtotal + (v_ticket_type.price_kobo * v_count);
  END LOOP;

  -- 4. Calculate promo code if provided
  IF p_promo_code_id IS NOT NULL THEN
    SELECT discount_type, discount_value INTO v_promo
    FROM public.promo_codes
    WHERE id = p_promo_code_id
      AND event_id = p_event_id
      AND active = true
      AND (expires_at IS NULL OR expires_at > now())
      AND (max_uses IS NULL OR times_used < max_uses);

    IF FOUND THEN
      IF v_promo.discount_type = 'percent' THEN
        v_computed_discount := (v_computed_subtotal * v_promo.discount_value) / 100;
      ELSE
        v_computed_discount := v_promo.discount_value;
      END IF;
    END IF;
  END IF;

  v_computed_total := greatest(0, v_computed_subtotal - v_computed_discount);

  -- STRICT SECURITY GUARD:
  -- Any order with a computed total above 0 MUST go through Paystack gateway verification!
  IF v_computed_total > 0 THEN
    RAISE EXCEPTION 'Security error: Paid orders must be processed and verified through the payment gateway.';
  END IF;

  v_free_reference := 'FREE_' || floor(extract(epoch from now()) * 1000)::text || '_' || substr(md5(random()::text), 1, 8);

  -- Call the internal process_checkout function
  RETURN public.process_checkout(
    p_event_id,
    v_actual_user_id,
    p_buyer_name,
    p_buyer_email,
    p_buyer_phone,
    p_tickets,
    0,
    v_free_reference,
    p_promo_code_id,
    p_is_gift,
    p_recipient_name,
    p_recipient_email,
    p_gift_message,
    p_access_code,
    p_promoter_link_id,
    p_checkout_answers
  );
END;
$$;

-- Guests (anon) may claim free tiers; paid tiers remain gateway-only.
REVOKE EXECUTE ON FUNCTION public.process_free_checkout FROM public;
GRANT EXECUTE ON FUNCTION public.process_free_checkout TO anon, authenticated, service_role;
