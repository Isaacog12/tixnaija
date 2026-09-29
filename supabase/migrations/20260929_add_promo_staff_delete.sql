-- Promo Codes
CREATE TABLE IF NOT EXISTS public.promo_codes (
    id uuid default gen_random_uuid() primary key,
    code text not null,
    discount_percentage integer not null check (discount_percentage > 0 and discount_percentage <= 100),
    event_id uuid references public.events(id) on delete cascade not null,
    expires_at timestamp with time zone,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    UNIQUE(code, event_id)
);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promo_codes_read" ON public.promo_codes FOR SELECT USING (true);
CREATE POLICY "promo_codes_organizer" ON public.promo_codes FOR ALL USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = promo_codes.event_id AND e.organizer_id = auth.uid())
);

-- Event Staff
CREATE TABLE IF NOT EXISTS public.event_staff (
    id uuid default gen_random_uuid() primary key,
    event_id uuid references public.events(id) on delete cascade not null,
    user_id uuid references auth.users(id) on delete cascade not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    UNIQUE(event_id, user_id)
);

ALTER TABLE public.event_staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "event_staff_read" ON public.event_staff FOR SELECT USING (true);
CREATE POLICY "event_staff_organizer" ON public.event_staff FOR ALL USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_staff.event_id AND e.organizer_id = auth.uid())
);

-- RPC for Account Deletion (Requires superuser / postgres bypass)
-- We'll create a function that users can call to delete themselves.
CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete the user from auth.users (triggers ON DELETE CASCADE for profiles, etc.)
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;
