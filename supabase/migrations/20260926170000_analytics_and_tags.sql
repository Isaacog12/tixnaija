-- Add tags to events
ALTER TABLE public.events ADD COLUMN tags text[] DEFAULT '{}'::text[];

-- Create event_page_views table for basic analytics
CREATE TABLE public.event_page_views (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  viewer_ip text,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.event_page_views ENABLE ROW LEVEL SECURITY;

-- Anyone can insert a page view
CREATE POLICY "Public can insert page views" ON public.event_page_views
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Only organizers can see their event's page views
CREATE POLICY "Organizers can read their event page views" ON public.event_page_views
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.events e WHERE e.id = event_id AND e.organizer_id = auth.uid()
  ));

-- Create event_broadcasts table for Organizer Mass Emails
CREATE TABLE public.event_broadcasts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  organizer_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  recipient_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.event_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers can manage broadcasts" ON public.event_broadcasts
  FOR ALL TO authenticated
  USING (organizer_id = auth.uid());
