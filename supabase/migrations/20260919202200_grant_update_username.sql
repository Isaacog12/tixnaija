-- Grant update permission on the new username column
-- (Required because a previous security fix revoked general UPDATE and only granted it per-column)

GRANT UPDATE (username) ON public.profiles TO authenticated;
