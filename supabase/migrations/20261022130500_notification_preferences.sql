-- Migration: Add notification_preferences and event_reminders_log
-- Description: Adds user notification preferences, email syncing, and reminder idempotency tracking

-- 1. Add notification_preferences column to profiles with default JSON
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS notification_preferences jsonb 
DEFAULT '{"ticket_confirmations": true, "event_reminders": true, "organizer_updates": true, "marketing_emails": false}'::jsonb;

-- 2. Add email column to profiles and backfill from auth.users
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email text;

UPDATE public.profiles p
SET email = lower(u.email)
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email != lower(u.email));

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (lower(email));

-- 3. Grant authenticated users permission to update their notification preferences
GRANT UPDATE (notification_preferences) ON public.profiles TO authenticated;

-- 4. Update handle_new_user trigger function to populate email and default preferences
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, email, notification_preferences)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    new.raw_user_meta_data->>'avatar_url',
    lower(new.email),
    '{"ticket_confirmations": true, "event_reminders": true, "organizer_updates": true, "marketing_emails": false}'::jsonb
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(profiles.email, EXCLUDED.email);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'attendee')
  ON CONFLICT DO NOTHING;

  RETURN new;
END;
$$;

-- 5. Create event_reminders_log to ensure reminders are never duplicated
CREATE TABLE IF NOT EXISTS public.event_reminders_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  reminder_type text NOT NULL, -- e.g. '24h', '1h'
  sent_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_reminders_log_unique UNIQUE(event_id, recipient_email, reminder_type)
);

CREATE INDEX IF NOT EXISTS idx_event_reminders_log_lookup 
ON public.event_reminders_log (event_id, recipient_email, reminder_type);

ALTER TABLE public.event_reminders_log ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.event_reminders_log TO service_role;

-- 6. Helper function to check if an email opted in for a specific notification type
CREATE OR REPLACE FUNCTION public.check_user_notification_pref(
  p_email text,
  p_pref_key text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pref boolean;
  v_prefs jsonb;
BEGIN
  IF p_email IS NULL THEN
    RETURN true;
  END IF;

  SELECT notification_preferences INTO v_prefs
  FROM public.profiles
  WHERE lower(email) = lower(trim(p_email))
  LIMIT 1;

  IF v_prefs IS NULL THEN
    -- If no profile exists yet, use defaults:
    IF p_pref_key = 'marketing_emails' THEN
      RETURN false;
    ELSE
      RETURN true;
    END IF;
  END IF;

  v_pref := (v_prefs->>p_pref_key)::boolean;
  IF v_pref IS NULL THEN
    IF p_pref_key = 'marketing_emails' THEN
      RETURN false;
    ELSE
      RETURN true;
    END IF;
  END IF;

  RETURN v_pref;
END;
$$;
