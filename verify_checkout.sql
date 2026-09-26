BEGIN;

-- 1. Create a dummy organizer profile
WITH new_org AS (
  INSERT INTO public.profiles (id, email, full_name, organizer_slug)
  VALUES (gen_random_uuid(), 'test_org_checkout@example.com', 'Test Organizer', 'test-org-' || substr(md5(random()::text), 1, 6))
  RETURNING id
),
-- 2. Create Event A and Event B
new_events AS (
  INSERT INTO public.events (id, title, organizer_id, status, start_datetime, end_datetime)
  SELECT
    gen_random_uuid(), 'Event A (Has Promoter)', id, 'published', now() + interval '1 day', now() + interval '2 days'
  FROM new_org
  UNION ALL
  SELECT
    gen_random_uuid(), 'Event B (Being Purchased)', id, 'published', now() + interval '1 day', now() + interval '2 days'
  FROM new_org
  RETURNING id, title
),
-- 3. Create Ticket Type for Event B
new_ticket_type AS (
  INSERT INTO public.ticket_types (id, event_id, name, price_kobo, quantity_available)
  SELECT gen_random_uuid(), id, 'General Admission', 100000, 100
  FROM new_events WHERE title = 'Event B (Being Purchased)'
  RETURNING id
),
-- 4. Create a Promoter for Event A
new_promoter AS (
  INSERT INTO public.promoters (id, event_id, name)
  SELECT gen_random_uuid(), id, 'Test Promoter'
  FROM new_events WHERE title = 'Event A (Has Promoter)'
  RETURNING id, event_id
),
-- 5. Create a Promoter Link for Event A
new_promoter_link AS (
  INSERT INTO public.promoter_links (id, promoter_id, event_id, unique_code, active)
  SELECT gen_random_uuid(), id, event_id, 'PROMOA', true
  FROM new_promoter
  RETURNING id
)
-- 6. Attempt Checkout for Event B using the Promoter Link from Event A
SELECT public.process_checkout(
  (SELECT id FROM new_events WHERE title = 'Event B (Being Purchased)'), -- Event B
  NULL, -- user_id (guest)
  'Buyer Name',
  'buyer@example.com',
  '08000000000',
  jsonb_build_array(jsonb_build_object('ticketTypeId', (SELECT id FROM new_ticket_type), 'count', 1)),
  100000, -- 1000 Naira in kobo
  'test_ref_123',
  NULL, -- promo_code_id
  false, -- is_gift
  NULL, NULL, NULL, NULL,
  (SELECT id FROM new_promoter_link) -- promoter_link_id from Event A
);

-- 7. Check the resulting order
SELECT id, event_id, promoter_link_id, payment_reference
FROM public.orders 
WHERE payment_reference = 'test_ref_123';

ROLLBACK;
