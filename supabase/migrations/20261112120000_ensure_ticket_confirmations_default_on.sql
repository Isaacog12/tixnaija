-- Migration: Guarantee ticket confirmation emails are ON for every new account.
--
-- Why: a buyer must never miss their tickets because a preferences value was
-- never written. Today that relies on two implicit layers (the column default
-- and one trigger function). Any new code path that inserts a profile row --
-- OAuth callback, client-side fallback insert, admin backfill, future signup
-- flow -- could bypass both and silently land on a partial preferences object.
--
-- This migration makes "ticket_confirmations = true" a guaranteed property of
-- account creation:
--   1. explicit column default on public.profiles.notification_preferences
--   2. a BEFORE INSERT guard on public.profiles that fills any missing key,
--      whichever code path performs the insert
--   3. a backfill for rows written before the guard existed
--
-- Existing explicit choices are preserved: the guard only fills MISSING keys,
-- so a deliberate opt-out (false) still wins.

-- 1. Column default (belt) --------------------------------------------------
ALTER TABLE public.profiles
  ALTER COLUMN notification_preferences
  SET DEFAULT '{"ticket_confirmations": true, "event_reminders": true, "organizer_updates": true, "marketing_emails": false}'::jsonb;

-- 2. Guard every profile INSERT (braces) ------------------------------------
-- Fires on INSERT only, not UPDATE, so a later deliberate opt-out and the
-- anonymisation performed during account deletion are never overwritten.
CREATE OR REPLACE FUNCTION public.ensure_notification_defaults()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.notification_preferences :=
    '{"ticket_confirmations": true, "event_reminders": true, "organizer_updates": true, "marketing_emails": false}'::jsonb
    || COALESCE(NEW.notification_preferences, '{}'::jsonb);

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_notification_defaults() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_ensure_notification_defaults ON public.profiles;
CREATE TRIGGER profiles_ensure_notification_defaults
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_notification_defaults();

-- 3. Backfill rows that predate the guard -----------------------------------
-- jsonb "||" keeps the right-hand values, so existing preferences win and only
-- absent keys are filled in.
UPDATE public.profiles
SET notification_preferences =
  '{"ticket_confirmations": true, "event_reminders": true, "organizer_updates": true, "marketing_emails": false}'::jsonb
  || notification_preferences
WHERE notification_preferences IS NULL
   OR NOT (notification_preferences ? 'ticket_confirmations');
