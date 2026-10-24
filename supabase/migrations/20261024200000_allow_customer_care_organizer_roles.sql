-- Migration: Allow users to hold both customer_care and organizer roles, and relax AAL2 MFA requirement for admin/support operations

-- 1. Remove conflict-of-interest triggers preventing dual roles (organizer + customer_care)
DROP TRIGGER IF EXISTS trg_check_user_role_conflict ON public.user_roles;
DROP FUNCTION IF EXISTS public.check_user_role_conflict();

DROP TRIGGER IF EXISTS trg_check_profile_organizer_conflict ON public.profiles;
DROP FUNCTION IF EXISTS public.check_profile_organizer_conflict();

-- 2. Relax private.assert_admin() to allow authenticated admins without strict AAL2 MFA
CREATE OR REPLACE FUNCTION private.assert_admin()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.has_role(v_actor, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;

  RETURN v_actor;
END;
$$;

-- 3. Relax private.assert_support_staff() to allow support staff without strict AAL2 MFA
CREATE OR REPLACE FUNCTION private.assert_support_staff()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.has_role(v_actor, 'customer_care'::public.app_role) 
     AND NOT public.has_role(v_actor, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Access denied: Customer care or admin role required';
  END IF;

  RETURN v_actor;
END;
$$;

-- 4. Update audit logs and payment events policies to allow admin role without strict AAL2 MFA
DROP POLICY IF EXISTS "Admins with MFA can view audit logs" ON public.support_audit_logs;
CREATE POLICY "Admins can view audit logs"
ON public.support_audit_logs FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Admins with MFA can view payment events" ON public.payment_events;
CREATE POLICY "Admins can view payment events"
ON public.payment_events FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);
