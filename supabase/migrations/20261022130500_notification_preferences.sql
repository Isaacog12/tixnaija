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

-- 7. Auto-configure Box Office for organizers (auto-carry name and profile picture as banner)
UPDATE public.profiles
SET 
  organizer_slug = COALESCE(
    NULLIF(organizer_slug, ''),
    NULLIF(lower(regexp_replace(trim(COALESCE(username, full_name, 'organizer')), '[^a-zA-Z0-9]+', '-', 'g')), ''),
    'org-' || substr(id::text, 1, 8)
  ),
  banner_url = COALESCE(banner_url, avatar_url)
WHERE is_organizer = true;

-- Update approve_organizer_application to auto-initialize box office with name & avatar
CREATE OR REPLACE FUNCTION public.approve_organizer_application(
  p_application_id uuid,
  p_note text default null
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app  public.organizer_applications%rowtype;
  v_admin uuid;
  v_slug text;
BEGIN
  v_admin := auth.uid();
  if v_admin is null or not public.is_admin(v_admin) then
    raise exception 'Unauthorized: admin access required';
  end if;

  select * into v_app
  from public.organizer_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'Application not found';
  end if;

  if v_app.status <> 'pending' then
    raise exception 'Application has already been reviewed';
  end if;

  -- Mark as approved
  update public.organizer_applications
  set
    status      = 'approved',
    admin_note  = p_note,
    reviewed_by = v_admin,
    reviewed_at = now()
  where id = p_application_id;

  -- Grant the organizer role
  insert into public.user_roles (user_id, role)
  values (v_app.user_id, 'organizer')
  on conflict (user_id, role) do nothing;

  -- Generate default slug from organization name, full name, or username
  v_slug := lower(regexp_replace(trim(COALESCE(v_app.organization_name, v_app.full_name, 'organizer')), '[^a-zA-Z0-9]+', '-', 'g'));
  if v_slug is null or v_slug = '' then
    v_slug := 'org-' || substr(v_app.user_id::text, 1, 8);
  end if;

  -- Auto-configure profiles: is_organizer, organizer_slug, and banner_url from avatar_url
  update public.profiles
  set 
    is_organizer = true,
    organizer_slug = COALESCE(NULLIF(organizer_slug, ''), v_slug),
    banner_url = COALESCE(banner_url, avatar_url)
  where id = v_app.user_id;

  -- Send inbox notification
  insert into public.messages (
    recipient_id, recipient_email, type, title, body
  ) values (
    v_app.user_id,
    v_app.email,
    'system',
    'Your organizer application has been approved! 🎉',
    'Great news! Your organizer application has been approved. ' ||
    'Your Box Office page is already active and ready to use.' || E'\n\n' ||
    'Head to your dashboard to create your first event: /events/new' ||
    case when p_note is not null and p_note <> ''
      then E'\n\nNote from our team: ' || p_note
      else ''
    end
  );
END;
$$;

