-- Add username to profiles (must be unique)
ALTER TABLE public.profiles ADD COLUMN username text UNIQUE;

-- Update the handle_new_user trigger to extract username from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, username)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'username'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'attendee')
  ON CONFLICT DO NOTHING;

  RETURN new;
END;
$$;
