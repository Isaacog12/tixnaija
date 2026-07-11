-- 1. Create the bucket if it doesn't exist and make it PUBLIC
insert into storage.buckets (id, name, public)
values ('event-covers', 'event-covers', true)
on conflict (id) do update set public = true;

-- 2. Allow anyone to view/read the images (necessary for the images to show up!)
create policy "Public Access"
on storage.objects for select
to public
using ( bucket_id = 'event-covers' );

-- 3. Allow authenticated organizers to upload images
create policy "Authenticated users can upload covers"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'event-covers' );

-- 4. Allow organizers to update their own uploads
create policy "Organizers can update their covers"
on storage.objects for update
to authenticated
using ( bucket_id = 'event-covers' and auth.uid() = owner );

-- 5. Allow organizers to delete their own uploads
create policy "Organizers can delete their covers"
on storage.objects for delete
to authenticated
using ( bucket_id = 'event-covers' and auth.uid() = owner );
