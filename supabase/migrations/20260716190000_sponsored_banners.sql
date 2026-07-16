-- Create sponsored_banners table
CREATE TABLE public.sponsored_banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    image_url TEXT NOT NULL,
    link_url TEXT,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.sponsored_banners ENABLE ROW LEVEL SECURITY;

-- Anyone can view active banners
CREATE POLICY "Anyone can view active banners" ON public.sponsored_banners
    FOR SELECT
    USING (is_active = true AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at >= now()));

-- Only admins can manage banners
CREATE POLICY "Admins can manage banners" ON public.sponsored_banners
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- Create RPC to safely increment banner clicks without exposing UPDATE permission
CREATE OR REPLACE FUNCTION public.increment_banner_click(banner_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.sponsored_banners
    SET click_count = click_count + 1
    WHERE id = banner_id;
END;
$$;
