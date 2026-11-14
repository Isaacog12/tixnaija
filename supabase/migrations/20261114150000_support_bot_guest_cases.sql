-- The public support assistant lets guests escalate a question. A guest has no
-- auth.users row, so a support case can no longer require customer_id.
ALTER TABLE public.support_cases ALTER COLUMN customer_id DROP NOT NULL;

-- Contact address supplied by a guest at escalation time (null for signed-in
-- customers, whose address is read from their account instead).
ALTER TABLE public.support_cases ADD COLUMN IF NOT EXISTS guest_email TEXT;

CREATE INDEX IF NOT EXISTS idx_support_cases_guest_email
  ON public.support_cases (guest_email)
  WHERE guest_email IS NOT NULL;

COMMENT ON COLUMN public.support_cases.guest_email IS
  'Email captured from a guest through the public support assistant. Null when the case belongs to a signed-in customer.';
