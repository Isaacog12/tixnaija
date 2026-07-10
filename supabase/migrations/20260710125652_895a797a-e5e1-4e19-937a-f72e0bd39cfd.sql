CREATE POLICY user_roles_self_become_organizer ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND role = 'organizer'::app_role);