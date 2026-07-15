-- Allow admins to delete contact messages
CREATE POLICY "contact_messages_delete_admin" ON public.contact_messages
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Grant DELETE on contact_messages to authenticated users (RLS policy above restricts to admins)
GRANT DELETE ON public.contact_messages TO authenticated;
