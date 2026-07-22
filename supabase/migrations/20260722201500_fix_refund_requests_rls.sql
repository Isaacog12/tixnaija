-- Fix the RLS policy for buyers reading their own refund requests
-- because regular authenticated users cannot select from auth.users.
-- We use auth.jwt() ->> 'email' instead.

drop policy if exists "buyers can read own refund requests" on public.refund_requests;

create policy "buyers can read own refund requests"
  on public.refund_requests for select
  to authenticated
  using (
    buyer_email = (auth.jwt() ->> 'email')
  );

-- Also ensure that anon, authenticated and service_role have appropriate grants
grant select, insert, update, delete on table public.refund_requests to anon, authenticated, service_role;
