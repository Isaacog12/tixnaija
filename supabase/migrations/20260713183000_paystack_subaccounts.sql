-- Add paystack_subaccount_code and subaccount_created_at to profiles
alter table public.profiles
  add column if not exists paystack_subaccount_code text,
  add column if not exists subaccount_created_at timestamptz;
