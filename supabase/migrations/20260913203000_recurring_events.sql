CREATE TABLE public.event_series (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  recurrence_rule text not null, -- e.g., 'FREQ=WEEKLY;INTERVAL=1;COUNT=10' (RRULE format)
  created_at timestamptz not null default now()
);

ALTER TABLE public.event_series ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_series_organizer_select" ON public.event_series 
FOR SELECT TO authenticated 
USING (organizer_id = auth.uid());

CREATE POLICY "event_series_organizer_all" ON public.event_series 
FOR ALL TO authenticated 
USING (organizer_id = auth.uid()) 
WITH CHECK (organizer_id = auth.uid());

-- Add series_id to events
-- IMPORTANT: Use ON DELETE RESTRICT to satisfy user safety requirement
ALTER TABLE public.events ADD COLUMN series_id uuid references public.event_series(id) on delete restrict;

-- RPC to create an event series and return its ID
CREATE OR REPLACE FUNCTION public.create_event_series(
  p_title text,
  p_recurrence_rule text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_series_id uuid;
BEGIN
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  INSERT INTO public.event_series (organizer_id, title, recurrence_rule)
  VALUES (auth.uid(), p_title, p_recurrence_rule)
  RETURNING id INTO v_series_id;

  RETURN v_series_id;
END;
$$;
