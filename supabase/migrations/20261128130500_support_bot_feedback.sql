-- Thumbs up / down on assistant replies.
--
-- Deliberately stores no message text: the intent, a boolean, the chat session
-- and a timestamp are enough to see which answers help, and adding the text
-- would duplicate support_bot_queries with more personal data.
--
-- Writes happen only through the support-bot Edge Function, which holds the
-- service role and therefore bypasses RLS. There is intentionally no INSERT
-- policy: a browser cannot write a rating row directly and cannot rate a reply
-- it never received.

CREATE TABLE IF NOT EXISTS public.support_bot_feedback (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     TEXT NOT NULL,
  matched_intent TEXT,
  helpful        BOOLEAN NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_bot_feedback_created_idx
  ON public.support_bot_feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS support_bot_feedback_intent_idx
  ON public.support_bot_feedback (matched_intent, helpful);

ALTER TABLE public.support_bot_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read bot feedback" ON public.support_bot_feedback;
CREATE POLICY "Staff can read bot feedback"
  ON public.support_bot_feedback FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'customer_care'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

REVOKE ALL ON public.support_bot_feedback FROM PUBLIC, anon;
GRANT SELECT ON public.support_bot_feedback TO authenticated;
GRANT ALL ON public.support_bot_feedback TO service_role;

COMMENT ON TABLE public.support_bot_feedback IS
  'Reply ratings from the website assistant. No message text is stored; rows are written by the support-bot Edge Function and readable by customer care and admins.';
