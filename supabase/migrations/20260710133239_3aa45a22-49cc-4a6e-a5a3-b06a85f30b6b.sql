
-- Re-attach the new-user trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles for existing auth users
INSERT INTO public.profiles (id, full_name, avatar_url)
SELECT u.id,
       COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ''),
       u.raw_user_meta_data->>'avatar_url'
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- Backfill default attendee role for users missing any role
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'attendee'::app_role
FROM auth.users u
LEFT JOIN public.user_roles r ON r.user_id = u.id
WHERE r.user_id IS NULL;
