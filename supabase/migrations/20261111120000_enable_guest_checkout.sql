-- ============================================================
-- Migration: 20261111120000_enable_guest_checkout.sql
-- Description: Enable guest checkout with email-only ticket access.
--   1. 100% free tiers can be claimed without an account (email + per-IP
--      throttle only, no access codes).
--   2. Guest tickets are reopened from the emailed ticket link: the link
--      carries the order UUID plus the buyer/recipient email, and
--      get_guest_order_full unlocks on those two values alone.
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

  -- 2. Guest guard rails: an email is required (it is how the buyer receives
  --    and re-opens their tickets) and anonymous claims are throttled per IP.
  IF v_is_guest THEN
    IF p_buyer_email IS NULL OR trim(p_buyer_email) = '' THEN
      RAISE EXCEPTION 'An email address is required to claim free tickets.';
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


-- ============================================================
-- Guest ticket retrieval without access codes.
-- The emailed ticket link carries the order UUID plus the buyer/recipient
-- email, so possession of the link is what unlocks the order. The UUID is an
-- unguessable 122-bit value and the email check keeps cross-account leaks out.
-- ============================================================
DROP FUNCTION IF EXISTS public.get_guest_order_full(uuid, text, text);
DROP FUNCTION IF EXISTS public.get_guest_order_full(uuid, text);

CREATE OR REPLACE FUNCTION public.get_guest_order_full(
  p_order_id uuid,
  p_email text
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_ip_address text;
  v_attempt_count integer;
  v_headers json;
  v_result jsonb;
begin
  if p_email is null or trim(p_email) = '' then
    raise exception 'An email address is required to view this order.';
  end if;

  -- Extract IP address
  begin
    v_headers := current_setting('request.headers', true)::json;
    v_ip_address := v_headers->>'x-forwarded-for';
  exception when others then
    v_ip_address := 'unknown';
  end;

  if v_ip_address is null then
    v_ip_address := 'unknown';
  end if;
  v_ip_address := split_part(v_ip_address, ',', 1);

  -- Log attempt
  insert into public.rate_limit_log (ip_address, endpoint)
  values (v_ip_address, 'get_guest_order_full');

  -- Rate limit check: ticket pages get refreshed, so the window is generous.
  select count(*) into v_attempt_count
  from public.rate_limit_log
  where ip_address = v_ip_address
    and endpoint = 'get_guest_order_full'
    and created_at > now() - interval '10 minutes';

  if v_attempt_count > 30 then
    raise exception 'Too many ticket lookup attempts. Please wait 10 minutes.';
  end if;

  select jsonb_build_object(
    'order', (
      select jsonb_build_object(
        'id', o.id,
        'event_id', o.event_id,
        'user_id', o.user_id,
        'buyer_name', o.buyer_name,
        'buyer_email', o.buyer_email,
        'buyer_phone', o.buyer_phone,
        'subtotal_kobo', o.subtotal_kobo,
        'discount_kobo', o.discount_kobo,
        'total_kobo', o.total_kobo,
        'promo_code_id', o.promo_code_id,
        'status', o.status,
        'payment_reference', o.payment_reference,
        'access_code', o.access_code,
        'created_at', o.created_at,
        'updated_at', o.updated_at,
        'events', (select row_to_json(e) from events e where e.id = o.event_id)
      )
    ),
    'tickets', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'ticket_code', t.ticket_code,
          'attendee_name', t.attendee_name,
          'status', t.status,
          'order_items', jsonb_build_object(
            'order_id', oi.order_id,
            'ticket_types', (select row_to_json(tt) from ticket_types tt where tt.id = oi.ticket_type_id)
          )
        )
      )
      from tickets t
      join order_items oi on oi.id = t.order_item_id
      where oi.order_id = p_order_id
    ), '[]'::jsonb)
  ) into v_result
  from orders o
  where o.id = p_order_id
    and (
      lower(o.buyer_email) = lower(trim(p_email))
      or lower(coalesce(o.recipient_email, '')) = lower(trim(p_email))
    )
    and o.status in ('paid', 'comp');

  if v_result is null then
    raise exception 'Order not found for this email address.';
  end if;

  return v_result;
end;
$$;

GRANT EXECUTE ON FUNCTION public.get_guest_order_full(uuid, text) TO anon, authenticated, service_role;
