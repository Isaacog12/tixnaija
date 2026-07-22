-- Update refund_requests admin RLS policies to use user_roles instead of profiles.is_admin
drop policy if exists "admins can manage refund requests" on public.refund_requests;

create policy "admins can manage refund requests"
  on public.refund_requests for all
  to authenticated
  using (
    exists (
      select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'
    )
  );
