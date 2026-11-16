-- Migration: make support-bot escalations reachable.
--
-- Three defects in the guest escalation path, all confirmed against the schema:
--
-- 1. support_reply_case resolves the customer address with
--    `SELECT email FROM user_contacts WHERE user_id = v_case.customer_id`.
--    Guest cases created by the public assistant have customer_id = NULL (see
--    20261114150000_support_bot_guest_cases.sql), so the lookup returns no row
--    and no reply email is ever queued. Staff replies to a guest case were
--    written to the thread and delivered to nobody.
--
-- 2. support_cases.guest_email, added specifically to hold the guest's contact
--    address, was written by the bot and read by nothing.
--
-- 3. The assistant cannot insert into support_case_messages because sender_id
--    is NOT NULL and foreign-keyed to auth.users, which a guest has no row in.
--    The customer's question therefore only survived as support_cases.subject,
--    truncated to 150 characters of an allowed 500, and the portal's message
--    timeline rendered empty.
--
-- Approach: store the guest's full question on the case itself and have
-- support_view_case present it as the opening message of the thread. This keeps
-- support_case_messages, its sender_id foreign key and its AFTER INSERT trigger
-- (handle_customer_case_reply) untouched, so staff-authored replies continue to
-- flow through the existing path unchanged.

-- ---------------------------------------------------------------------------
-- 1. Full guest question, stored on the case
-- ---------------------------------------------------------------------------

ALTER TABLE public.support_cases ADD COLUMN IF NOT EXISTS guest_message TEXT;

COMMENT ON COLUMN public.support_cases.guest_message IS
  'Untruncated question captured from a guest by the public support assistant. Presented as the opening thread message by support_view_case, because a guest has no auth.users row to author a support_case_messages row with. Null for cases opened by signed-in customers or by staff.';

-- ---------------------------------------------------------------------------
-- 2. support_view_case: surface the guest address and the opening message
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.support_view_case(p_case_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.assert_support_staff();
  v_actor_email TEXT;
  v_result JSONB;
BEGIN
  SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor;
  INSERT INTO public.support_audit_logs (actor_id, actor_email, action, target_type, target_id, details)
  VALUES (v_actor, v_actor_email, 'view_case', 'support_case', p_case_id::text, jsonb_build_object('case_id', p_case_id));

  SELECT jsonb_build_object(
    'case', (
      SELECT jsonb_build_object(
        'id', sc.id,
        'case_number', sc.case_number,
        'customer_id', sc.customer_id,
        -- A guest case has no user_contacts row, so fall back to the address the
        -- assistant captured. Without this the portal shows no way to contact
        -- the person the case belongs to.
        'customer_email', COALESCE(uc.email, sc.guest_email),
        'customer_name', p.full_name,
        'is_guest', sc.customer_id IS NULL,
        'order_id', sc.order_id,
        'subject', sc.subject,
        'category', sc.category,
        'status', sc.status,
        'priority', sc.priority,
        'assigned_to', sc.assigned_to,
        'is_escalated', sc.is_escalated,
        'escalated_reason', sc.escalated_reason,
        'created_at', sc.created_at,
        'updated_at', sc.updated_at,
        'resolved_at', sc.resolved_at
      )
      FROM public.support_cases sc
      LEFT JOIN public.user_contacts uc ON uc.user_id = sc.customer_id
      LEFT JOIN public.profiles p ON p.id = sc.customer_id
      WHERE sc.id = p_case_id
    ),
    'messages', COALESCE((
      SELECT jsonb_agg(combined.msg ORDER BY combined.sort_at ASC)
      FROM (
        -- The guest's original question, synthesised as the opening message.
        -- sort_at is the case creation time, which always precedes any reply.
        SELECT
          sc.created_at AS sort_at,
          jsonb_build_object(
            'id', sc.id,
            'sender_id', NULL::uuid,
            'sender_name', 'Guest customer',
            'is_internal', FALSE,
            'content', sc.guest_message,
            'created_at', sc.created_at,
            'is_guest_opening', TRUE
          ) AS msg
        FROM public.support_cases sc
        WHERE sc.id = p_case_id
          AND sc.guest_message IS NOT NULL
          AND length(trim(sc.guest_message)) > 0

        UNION ALL

        SELECT
          scm.created_at AS sort_at,
          jsonb_build_object(
            'id', scm.id,
            'sender_id', scm.sender_id,
            'sender_name', p.full_name,
            'is_internal', scm.is_internal,
            'content', scm.content,
            'created_at', scm.created_at,
            'is_guest_opening', FALSE
          ) AS msg
        FROM public.support_case_messages scm
        LEFT JOIN public.profiles p ON p.id = scm.sender_id
        WHERE scm.case_id = p_case_id
      ) AS combined
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.support_view_case(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_view_case(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. support_reply_case: deliver replies to guests
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.support_reply_case(
  p_case_id UUID,
  p_content TEXT,
  p_is_internal BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.assert_support_staff();
  v_actor_email TEXT;
  v_case RECORD;
  v_customer_email TEXT;
  v_new_msg_id UUID;
BEGIN
  SELECT id, customer_id, status, subject, guest_email
    INTO v_case
    FROM public.support_cases
   WHERE id = p_case_id;

  IF v_case.id IS NULL THEN
    RAISE EXCEPTION 'Case not found';
  END IF;

  IF length(trim(p_content)) = 0 THEN
    RAISE EXCEPTION 'Message content cannot be empty';
  END IF;

  INSERT INTO public.support_case_messages (case_id, sender_id, is_internal, content)
  VALUES (p_case_id, v_actor, p_is_internal, trim(p_content))
  RETURNING id INTO v_new_msg_id;

  IF NOT p_is_internal THEN
    -- Signed-in customers are reached through user_contacts; guests through the
    -- address they left with the assistant. Reading only user_contacts meant a
    -- reply to a guest case was silently dropped: the lookup returns no row, so
    -- SELECT INTO leaves v_customer_email null and the fallback below runs.
    SELECT email INTO v_customer_email
      FROM public.user_contacts
     WHERE user_id = v_case.customer_id;

    IF v_customer_email IS NULL THEN
      v_customer_email := v_case.guest_email;
    END IF;

    IF v_customer_email IS NOT NULL THEN
      INSERT INTO public.email_outbox (case_id, recipient_email, template, payload, status)
      VALUES (
        p_case_id,
        v_customer_email,
        'case_reply',
        jsonb_build_object('case_id', p_case_id, 'subject', v_case.subject, 'reply', trim(p_content)),
        'pending'
      );
    END IF;
  END IF;

  SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor;
  INSERT INTO public.support_audit_logs (actor_id, actor_email, action, target_type, target_id, details)
  VALUES (v_actor, v_actor_email, 'reply_case', 'support_case', p_case_id::text,
          jsonb_build_object('is_internal', p_is_internal, 'message_id', v_new_msg_id));

  RETURN jsonb_build_object('success', true, 'message_id', v_new_msg_id);
END;
$$;

REVOKE ALL ON FUNCTION public.support_reply_case(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_reply_case(uuid, text, boolean) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Purge rate_limit_log
-- ---------------------------------------------------------------------------
-- Every consumer of rate_limit_log reads a window of one hour or less
-- (validate_promo_code 1 minute, guest order lookups 10 minutes, waitlist and
-- free checkout 1 hour, support bot 10 minutes and 1 hour), so rows older than
-- a day can never affect a decision. The table had no purge job and grew on
-- every promo validation, guest lookup and assistant message since
-- 20260713175051_rate_limiting.sql.
--
-- Unscheduled first, mirroring 20261112120500_schedule_email_outbox_worker.sql,
-- so re-running this migration cannot leave two competing jobs behind.
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE
  v_job record;
BEGIN
  FOR v_job IN
    SELECT jobid FROM cron.job WHERE jobname = 'purge_rate_limit_log_daily'
  LOOP
    PERFORM cron.unschedule(v_job.jobid);
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'purge_rate_limit_log_daily',
  '30 3 * * *',
  $job$
    DELETE FROM public.rate_limit_log
     WHERE created_at < now() - interval '24 hours';
  $job$
);
