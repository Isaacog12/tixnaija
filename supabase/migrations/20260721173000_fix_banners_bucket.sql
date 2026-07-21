-- Run this in Supabase Studio → SQL Editor to create the banners storage bucket
-- and its access policies. This is a safe re-run if already applied.

-- 1. Create the bucket (public so images load without auth)
insert into storage.buckets (id, name, public)
values ('banners', 'banners', true)
on conflict (id) do update set public = true;

-- 2. Public read access (so the homepage can display banner images)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Public Access banners'
  ) then
    execute $policy$
      create policy "Public Access banners"
      on storage.objects for select
      to public
      using ( bucket_id = 'banners' )
    $policy$;
  end if;
end $$;

-- 3. Admins can upload
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Admins can upload banners'
  ) then
    execute $policy$
      create policy "Admins can upload banners"
      on storage.objects for insert
      to authenticated
      with check (
        bucket_id = 'banners'
        AND EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
        )
      )
    $policy$;
  end if;
end $$;

-- 4. Admins can update
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Admins can update banners'
  ) then
    execute $policy$
      create policy "Admins can update banners"
      on storage.objects for update
      to authenticated
      using (
        bucket_id = 'banners'
        AND EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
        )
      )
    $policy$;
  end if;
end $$;

-- 5. Admins can delete
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Admins can delete banners'
  ) then
    execute $policy$
      create policy "Admins can delete banners"
      on storage.objects for delete
      to authenticated
      using (
        bucket_id = 'banners'
        AND EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
        )
      )
    $policy$;
  end if;
end $$;
