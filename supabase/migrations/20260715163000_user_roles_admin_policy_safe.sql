-- Add safe admin SELECT policy on user_roles using has_role() SECURITY DEFINER function.
-- has_role() is SECURITY DEFINER so it bypasses RLS internally — no infinite recursion.
CREATE POLICY "user_roles_select_admin" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
