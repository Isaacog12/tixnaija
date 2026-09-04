-- Fix ID-Photos bucket ID typo from underscore to hyphen
DROP POLICY IF EXISTS "id_photos_user_insert" ON storage.objects;
DROP POLICY IF EXISTS "id_photos_user_select_or_admin" ON storage.objects;

CREATE POLICY "id_photos_user_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK ( bucket_id = 'id-photos' AND (storage.foldername(name))[1] = auth.uid()::text );

CREATE POLICY "id_photos_user_select_or_admin" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'id-photos' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    )
  )
);

-- Disambiguate user_id in organizer_applications policy
DROP POLICY IF EXISTS "org_apps_select_own_or_admin" ON public.organizer_applications;

CREATE POLICY "org_apps_select_own_or_admin" ON public.organizer_applications
FOR SELECT TO authenticated
USING (
  organizer_applications.user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
  )
);
