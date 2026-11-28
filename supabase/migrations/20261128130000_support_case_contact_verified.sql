-- Whether the contact address on a case is actually tied to an account or order.
--
-- The assistant invites a guest to type any address, and a typed address is not
-- proof of ownership: someone can enter a stranger's email and open a case under
-- it. contact_verified records the same check the assistant already runs before
-- sending a receipt, so staff can see "unverified contact" and verify before
-- acting on it.
--
-- Additive and idempotent: existing rows default to false, which is the honest
-- value for a case nobody has checked.

ALTER TABLE public.support_cases
  ADD COLUMN IF NOT EXISTS contact_verified BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.support_cases.contact_verified IS
  'True when the case contact is a signed-in customer or an address with an order on this platform. False means the address was typed in chat and must be verified by staff before it is trusted.';

-- ---------------------------------------------------------------------------
-- support_view_case: surface contact_verified in the staff case view
-- ---------------------------------------------------------------------------
-- Same body as 20261116120000_support_bot_escalation_fixes.sql with one added
-- key. CREATE OR REPLACE keeps the existing grants and signature.

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
        'customer_email', COALESCE(uc.email, sc.guest_email),
        'customer_name', p.full_name,
        'is_guest', sc.customer_id IS NULL,
        'contact_verified', sc.contact_verified,
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
