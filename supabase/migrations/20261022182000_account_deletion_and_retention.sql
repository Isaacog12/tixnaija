-- ============================================================
-- MIGRATION: Account Deletion Anonymization & KYC Retention Rules
-- ============================================================
-- Purpose:
-- 1. Support self-serve account deletion per Nigeria Data Protection Act 2023 (NDPA).
-- 2. Anonymize personal data in public.profiles while preserving required accounting
--    records in orders, order_items, and payments.
-- 3. Define automated cleanup functions for expired KYC ID photos.
-- 4. Enforce SET search_path = public on all SECURITY DEFINER functions.
-- 5. Restrict execution permissions strictly to service_role.
--
-- Ready for review. DO NOT apply without user confirmation.

-- 1. Helper RPC to anonymize profile records when account is deleted
CREATE OR REPLACE FUNCTION public.anonymize_deleted_user_profile(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is service_role or the user themselves
  IF auth.role() <> 'service_role' AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Not authorized to delete this user profile';
  END IF;

  UPDATE public.profiles
  SET
    full_name = 'Deleted User',
    phone = NULL,
    avatar_url = NULL,
    bank_account_name = NULL,
    bank_account_number = NULL,
    bank_name = NULL,
    paystack_subaccount_code = NULL,
    is_organizer = false,
    is_verified_organizer = false,
    notification_preferences = '{}'::jsonb,
    updated_at = now()
  WHERE id = p_user_id;

  -- Anonymize organizer application records if any exist
  UPDATE public.organizer_applications
  SET
    full_name = 'Deleted User',
    phone_number = 'DELETED',
    social_media_link = NULL,
    reason = '[User requested account deletion]'
  WHERE user_id = p_user_id;
END;
$$;

-- 2. Cleanup function for organizer KYC identity photos older than 30 days post-review
CREATE OR REPLACE FUNCTION public.get_expired_id_photos_for_cleanup(p_retention_days int DEFAULT 30)
RETURNS TABLE (application_id uuid, id_photo_path text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT id, id_photo_url
  FROM public.organizer_applications
  WHERE status IN ('approved', 'rejected')
    AND reviewed_at IS NOT NULL
    AND reviewed_at < (now() - (p_retention_days || ' days')::interval)
    AND id_photo_url NOT LIKE 'DELETED%';
END;
$$;

-- 3. RPC to mark expired KYC photos as deleted in database
CREATE OR REPLACE FUNCTION public.mark_id_photos_deleted(p_application_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Only service_role can mark KYC photos deleted';
  END IF;

  UPDATE public.organizer_applications
  SET id_photo_url = 'DELETED_' || now()::text
  WHERE id = ANY(p_application_ids);
END;
$$;

-- 4. Permissions: Revoke execute from PUBLIC, anon, and authenticated; grant to service_role only
REVOKE EXECUTE ON FUNCTION public.anonymize_deleted_user_profile(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.anonymize_deleted_user_profile(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_expired_id_photos_for_cleanup(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_expired_id_photos_for_cleanup(int) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mark_id_photos_deleted(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_id_photos_deleted(uuid[]) TO service_role;
