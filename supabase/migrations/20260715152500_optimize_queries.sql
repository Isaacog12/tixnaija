-- Optimize queries for high traffic
-- Indexes for events table
CREATE INDEX IF NOT EXISTS idx_events_status ON public.events (status);
CREATE INDEX IF NOT EXISTS idx_events_start_datetime ON public.events (start_datetime);
CREATE INDEX IF NOT EXISTS idx_events_organizer_id ON public.events (organizer_id);

-- Indexes for orders table
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_event_id ON public.orders (event_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);

-- Indexes for ticket types
CREATE INDEX IF NOT EXISTS idx_ticket_types_event_id ON public.ticket_types (event_id);

-- Indexes for organizer applications
CREATE INDEX IF NOT EXISTS idx_organizer_applications_status ON public.organizer_applications (status);
