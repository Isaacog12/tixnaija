-- ============================================================
-- Support desk: SLA clocks, CSAT, bot gap analytics, dedupe
-- ============================================================
-- Four of these are new columns plus triggers so they are correct no matter
-- which path creates the row (portal RPC, assistant escalation, inbound email).
-- ============================================================

-- 1. SLA + CSAT columns -------------------------------------------------------
ALTER TABLE public.support_cases
  ADD COLUMN IF NOT EXISTS due_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS csat_rating       SMALLINT,
  ADD COLUMN IF NOT EXISTS csat_comment      TEXT,
  ADD COLUMN IF NOT EXISTS csat_token        UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS csat_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tags              TEXT[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'support_cases_csat_rating_range'
  ) THEN
    ALTER TABLE public.support_cases
      ADD CONSTRAINT support_cases_csat_rating_range
      CHECK (csat_rating IS NULL OR csat_rating BETWEEN 1 AND 5);
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS support_cases_csat_token_key
  ON public.support_cases (csat_token);

-- Due-at is derived from priority on insert, and recomputed from created_at if
-- the priority changes. Deriving from created_at (not now()) on update means
-- downgrading a case cannot buy it more time than it started with.
CREATE OR REPLACE FUNCTION private.support_case_set_due_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_base TIMESTAMPTZ := COALESCE(NEW.created_at, now());
BEGIN
  NEW.due_at := v_base + CASE NEW.priority
    WHEN 'urgent' THEN INTERVAL '2 hours'
    WHEN 'high'   THEN INTERVAL '4 hours'
    WHEN 'medium' THEN INTERVAL '8 hours'
    ELSE               INTERVAL '24 hours'
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_cases_set_due_at ON public.support_cases;
CREATE TRIGGER support_cases_set_due_at
  BEFORE INSERT ON public.support_cases
  FOR EACH ROW EXECUTE FUNCTION private.support_case_set_due_at();

DROP TRIGGER IF EXISTS support_cases_set_due_at_on_priority ON public.support_cases;
CREATE TRIGGER support_cases_set_due_at_on_priority
  BEFORE UPDATE OF priority ON public.support_cases
  FOR EACH ROW EXECUTE FUNCTION private.support_case_set_due_at();

-- First response = the first non-internal message that did not come from the
-- customer themselves. A bot echo of the customer's own words must not count.
CREATE OR REPLACE FUNCTION private.support_case_mark_first_response()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.is_internal THEN
    RETURN NEW;
  END IF;

  UPDATE public.support_cases c
     SET first_response_at = now()
   WHERE c.id = NEW.case_id
     AND c.first_response_at IS NULL
     AND (c.customer_id IS NULL OR NEW.sender_id <> c.customer_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_case_messages_first_response ON public.support_case_messages;
CREATE TRIGGER support_case_messages_first_response
  AFTER INSERT ON public.support_case_messages
  FOR EACH ROW EXECUTE FUNCTION private.support_case_mark_first_response();

-- Resolving a case queues exactly one CSAT email, with the token the public
-- rating page needs.
CREATE OR REPLACE FUNCTION private.support_case_queue_csat()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email TEXT;
BEGIN
  IF NEW.status <> 'resolved' OR OLD.status = 'resolved' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(sc.guest_email, u.email)
    INTO v_email
    FROM public.support_cases sc
    LEFT JOIN auth.users u ON u.id = sc.customer_id
   WHERE sc.id = NEW.id;

  IF v_email IS NOT NULL THEN
    INSERT INTO public.email_outbox (case_id, recipient_email, template, payload)
    VALUES (
      NEW.id,
      v_email,
      'support_csat',
      jsonb_build_object('case_number', NEW.case_number, 'csat_token', NEW.csat_token)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_cases_queue_csat ON public.support_cases;
CREATE TRIGGER support_cases_queue_csat
  AFTER UPDATE OF status ON public.support_cases
  FOR EACH ROW EXECUTE FUNCTION private.support_case_queue_csat();

-- 2. Bot gap analytics --------------------------------------------------------
-- What the rules-based assistant could not answer. Without this, extending the
-- intent list is guesswork. Message bodies are truncated and the edge function
-- never writes a message that looked like a card number, PIN or password.
CREATE TABLE IF NOT EXISTS public.support_bot_queries (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     TEXT NOT NULL,
  message        VARCHAR(500) NOT NULL,
  matched_intent TEXT,
  escalated      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_bot_queries_created_idx
  ON public.support_bot_queries (created_at DESC);
CREATE INDEX IF NOT EXISTS support_bot_queries_escalated_idx
  ON public.support_bot_queries (escalated, created_at DESC);

ALTER TABLE public.support_bot_queries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read bot queries" ON public.support_bot_queries;
CREATE POLICY "Staff can read bot queries"
  ON public.support_bot_queries FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'customer_care'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

GRANT SELECT ON public.support_bot_queries TO authenticated;
GRANT ALL ON public.support_bot_queries TO service_role;

-- 3. Macro dedupe + unique title ---------------------------------------------
-- The seed in 20261024234500 is a bare INSERT and the table had no unique
-- constraint, so every replay of that migration appended another full set.
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY title ORDER BY created_at ASC, id ASC) AS rn
    FROM public.support_macros
)
DELETE FROM public.support_macros m
 USING ranked r
 WHERE m.id = r.id
   AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS support_macros_title_key
  ON public.support_macros (title);

-- 4. Duplicate case guard -----------------------------------------------------
-- Same customer, same subject, case still live: append to the open thread and
-- return it instead of opening a second one. No unique index here on purpose —
-- the assistant inserts escalations directly, and a constraint violation would
-- turn a recoverable duplicate into a 503.
CREATE OR REPLACE FUNCTION public.support_create_case(
  p_customer_email TEXT DEFAULT NULL,
  p_customer_id UUID DEFAULT NULL,
  p_subject TEXT DEFAULT 'Customer Inquiry',
  p_category public.support_case_category DEFAULT 'other',
  p_priority public.support_case_priority DEFAULT 'medium',
  p_initial_message TEXT DEFAULT NULL,
  p_order_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.assert_support_staff();
  v_actor_email TEXT;
  v_resolved_customer_id UUID := p_customer_id;
  v_new_case_id UUID;
  v_case_number TEXT;
  v_seq INT;
  v_existing_id UUID;
  v_existing_number TEXT;
BEGIN
  IF length(trim(p_subject)) = 0 THEN
    RAISE EXCEPTION 'Subject cannot be empty';
  END IF;

  IF v_resolved_customer_id IS NULL AND p_customer_email IS NOT NULL THEN
    SELECT id INTO v_resolved_customer_id FROM auth.users WHERE lower(email) = lower(trim(p_customer_email)) LIMIT 1;
    IF v_resolved_customer_id IS NULL THEN
      SELECT user_id INTO v_resolved_customer_id FROM public.user_contacts WHERE lower(email) = lower(trim(p_customer_email)) LIMIT 1;
    END IF;
    IF v_resolved_customer_id IS NULL THEN
      SELECT user_id INTO v_resolved_customer_id FROM public.orders WHERE lower(buyer_email) = lower(trim(p_customer_email)) LIMIT 1;
    END IF;
  END IF;

  IF v_resolved_customer_id IS NULL THEN
    v_resolved_customer_id := v_actor;
  END IF;

  -- Duplicate guard
  SELECT sc.id, sc.case_number
    INTO v_existing_id, v_existing_number
    FROM public.support_cases sc
   WHERE lower(sc.subject) = lower(trim(p_subject))
     AND sc.status IN ('open', 'pending')
     AND (
       (p_customer_id IS NOT NULL AND sc.customer_id = v_resolved_customer_id)
       OR (p_customer_email IS NOT NULL AND lower(sc.guest_email) = lower(trim(p_customer_email)))
     )
   ORDER BY sc.created_at DESC
   LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    IF p_initial_message IS NOT NULL AND length(trim(p_initial_message)) > 0 THEN
      INSERT INTO public.support_case_messages (case_id, sender_id, is_internal, content)
      VALUES (v_existing_id, v_actor, FALSE, trim(p_initial_message));
    END IF;

    SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor;
    INSERT INTO public.support_audit_logs (actor_id, actor_email, action, target_type, target_id, details)
    VALUES (v_actor, v_actor_email, 'merge_duplicate_case', 'support_case', v_existing_id::text,
            jsonb_build_object('case_number', v_existing_number, 'subject', p_subject));

    RETURN jsonb_build_object(
      'success', true,
      'case_id', v_existing_id,
      'case_number', v_existing_number,
      'duplicate', true
    );
  END IF;

  SELECT COALESCE(MAX(SUBSTRING(case_number FROM 5)::INT), 1000) + 1 INTO v_seq
  FROM public.support_cases
  WHERE case_number ~ '^TIX-[0-9]+$';

  v_case_number := 'TIX-' || LPAD(v_seq::TEXT, 6, '0');

  INSERT INTO public.support_cases (
    customer_id, order_id, subject, category, status, priority, assigned_to
  ) VALUES (
    v_resolved_customer_id, p_order_id, trim(p_subject), p_category, 'open', p_priority, v_actor
  ) RETURNING id INTO v_new_case_id;

  IF p_initial_message IS NOT NULL AND length(trim(p_initial_message)) > 0 THEN
    INSERT INTO public.support_case_messages (case_id, sender_id, is_internal, content)
    VALUES (v_new_case_id, v_actor, FALSE, trim(p_initial_message));
  END IF;

  SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor;
  INSERT INTO public.support_audit_logs (actor_id, actor_email, action, target_type, target_id, details)
  VALUES (v_actor, v_actor_email, 'create_case_for_customer', 'support_case', v_new_case_id::text,
          jsonb_build_object('case_number', v_case_number, 'customer_id', v_resolved_customer_id, 'subject', p_subject));

  RETURN jsonb_build_object(
    'success', true,
    'case_id', v_new_case_id,
    'case_number', v_case_number,
    'duplicate', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.support_create_case(text, uuid, text, public.support_case_category, public.support_case_priority, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_create_case(text, uuid, text, public.support_case_category, public.support_case_priority, text, uuid) TO authenticated;

-- 5. CSAT: public read + submit, keyed by the unguessable token ----------------
CREATE OR REPLACE FUNCTION public.support_get_csat_case(p_token UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'case_number', sc.case_number,
    'subject', sc.subject,
    'status', sc.status,
    'already_rated', sc.csat_submitted_at IS NOT NULL,
    'rating', sc.csat_rating
  )
  FROM public.support_cases sc
  WHERE sc.csat_token = p_token;
$$;

REVOKE ALL ON FUNCTION public.support_get_csat_case(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.support_get_csat_case(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.support_submit_csat(
  p_token UUID,
  p_rating SMALLINT,
  p_comment TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RETURN jsonb_build_object('success', FALSE, 'reason', 'invalid_rating');
  END IF;

  UPDATE public.support_cases
     SET csat_rating = p_rating,
         csat_comment = NULLIF(left(coalesce(p_comment, ''), 1000), ''),
         csat_submitted_at = now()
   WHERE csat_token = p_token
     AND csat_submitted_at IS NULL
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'reason', 'already_rated');
  END IF;

  RETURN jsonb_build_object('success', TRUE);
END;
$$;

REVOKE ALL ON FUNCTION public.support_submit_csat(uuid, smallint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.support_submit_csat(uuid, smallint, text) TO anon, authenticated;

-- 6. Macro create/rename with a readable duplicate error ----------------------
-- The unique index above would otherwise surface as
-- "duplicate key value violates unique constraint support_macros_title_key".
CREATE OR REPLACE FUNCTION public.admin_manage_macro(
  p_action VARCHAR,
  p_id UUID DEFAULT NULL,
  p_title VARCHAR DEFAULT NULL,
  p_category VARCHAR DEFAULT 'general',
  p_content TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.assert_support_staff();
  v_new_id UUID;
BEGIN
  IF p_action = 'create' THEN
    IF length(trim(p_title)) = 0 OR length(trim(p_content)) = 0 THEN
      RAISE EXCEPTION 'Title and content cannot be empty';
    END IF;

    IF EXISTS (SELECT 1 FROM public.support_macros WHERE lower(title) = lower(trim(p_title))) THEN
      RAISE EXCEPTION 'A macro titled "%" already exists — edit that one instead.', trim(p_title);
    END IF;

    INSERT INTO public.support_macros (title, category, content, created_by)
    VALUES (trim(p_title), trim(p_category), trim(p_content), v_actor)
    RETURNING id INTO v_new_id;
    RETURN jsonb_build_object('success', true, 'id', v_new_id);

  ELSIF p_action = 'update' THEN
    IF p_title IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.support_macros
       WHERE lower(title) = lower(trim(p_title))
         AND id <> COALESCE(p_id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'Another macro already uses that title.';
    END IF;

    UPDATE public.support_macros
       SET title = COALESCE(trim(p_title), title),
           category = COALESCE(trim(p_category), category),
           content = COALESCE(trim(p_content), content)
     WHERE id = p_id;
    RETURN jsonb_build_object('success', true);

  ELSIF p_action = 'delete' THEN
    DELETE FROM public.support_macros WHERE id = p_id;
    RETURN jsonb_build_object('success', true);

  ELSE
    RAISE EXCEPTION 'Invalid action: %', p_action;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_manage_macro(varchar, uuid, varchar, varchar, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_manage_macro(varchar, uuid, varchar, varchar, text) TO authenticated;
