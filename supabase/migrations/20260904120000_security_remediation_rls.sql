-- ============================================================
-- SECURITY REMEDIATION: RLS POLICIES & BUCKETS
-- ============================================================

-- 1. TICKETS
DROP POLICY IF EXISTS "tickets_view_own" ON public.tickets;
DROP POLICY IF EXISTS "tickets_view_organizer" ON public.tickets;
DROP POLICY IF EXISTS "tickets_update_organizer" ON public.tickets;

CREATE POLICY "tickets_view_own" ON public.tickets
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE oi.id = tickets.order_item_id
    AND o.user_id = auth.uid()
  )
);

CREATE POLICY "tickets_view_organizer" ON public.tickets
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    JOIN public.events e ON e.id = o.event_id
    WHERE oi.id = tickets.order_item_id
    AND e.organizer_id = auth.uid()
  )
);



-- 3. BANNERS
DROP POLICY IF EXISTS "Anyone can view active banners" ON public.sponsored_banners;
DROP POLICY IF EXISTS "Admins can manage banners" ON public.sponsored_banners;

CREATE POLICY "Anyone can view active banners" ON public.sponsored_banners
FOR SELECT TO public
USING (true);

CREATE POLICY "Admins can manage banners" ON public.sponsored_banners
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- 4. ORGANIZER_APPLICATIONS
DROP POLICY IF EXISTS "org_apps_select_own" ON public.organizer_applications;
DROP POLICY IF EXISTS "org_apps_select_admin" ON public.organizer_applications;
DROP POLICY IF EXISTS "org_apps_select_own_or_admin" ON public.organizer_applications;

CREATE POLICY "org_apps_select_own_or_admin" ON public.organizer_applications
FOR SELECT TO authenticated
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- 5. TICKET_TYPES
DROP POLICY IF EXISTS "ticket_types_organizer_manage" ON public.ticket_types;

CREATE POLICY "ticket_types_organizer_manage" ON public.ticket_types
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.events
    WHERE id = ticket_types.event_id
    AND organizer_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.events
    WHERE id = ticket_types.event_id
    AND organizer_id = auth.uid()
  )
);

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================

-- BANNERS BUCKET
DROP POLICY IF EXISTS "Public Access banners" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload banners" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update banners" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete banners" ON storage.objects;
DROP POLICY IF EXISTS "Admins manage banners" ON storage.objects;

CREATE POLICY "Public Access banners" ON storage.objects
FOR SELECT TO public
USING ( bucket_id = 'banners' );

CREATE POLICY "Admins manage banners" ON storage.objects
FOR ALL TO authenticated
USING (
  bucket_id = 'banners' AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  bucket_id = 'banners' AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- ID_PHOTOS BUCKET
DROP POLICY IF EXISTS "id_photos_user_insert" ON storage.objects;
DROP POLICY IF EXISTS "id_photos_user_select" ON storage.objects;
DROP POLICY IF EXISTS "id_photos_admin_select" ON storage.objects;
DROP POLICY IF EXISTS "id_photos_user_select_or_admin" ON storage.objects;

CREATE POLICY "id_photos_user_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK ( bucket_id = 'id_photos' AND (storage.foldername(name))[1] = auth.uid()::text );

CREATE POLICY "id_photos_user_select_or_admin" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'id_photos' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
);
