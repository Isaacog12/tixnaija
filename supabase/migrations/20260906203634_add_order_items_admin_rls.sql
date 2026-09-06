CREATE POLICY "order_items_admin_view_all" ON "public"."order_items"
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'::app_role
  )
);
