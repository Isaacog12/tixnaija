-- 1. Create the bucket if it doesn't exist and make it PUBLIC
insert into storage.buckets (id, name, public)
values ('banners', 'banners', true)
on conflict (id) do update set public = true;

-- 2. Allow anyone to view/read the images
create policy "Public Access"
on storage.objects for select
to public
using ( bucket_id = 'banners' );

-- 3. Allow admins to upload banners
create policy "Admins can upload banners"
on storage.objects for insert
to authenticated
with check ( 
    bucket_id = 'banners' AND 
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

-- 4. Allow admins to update/delete
create policy "Admins can update banners"
on storage.objects for update
to authenticated
using ( 
    bucket_id = 'banners' AND 
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

create policy "Admins can delete banners"
on storage.objects for delete
to authenticated
using ( 
    bucket_id = 'banners' AND 
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);
