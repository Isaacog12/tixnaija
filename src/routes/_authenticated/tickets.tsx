import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Ticket as TicketIcon, Calendar, MapPin, QrCode } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/tickets")({
  component: TicketsPage,
});

async function fetchMyTickets() {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Not signed in");

  const { data: tickets, error } = await supabase
    .from("tickets")
    .select(`
      id,
      status,
      attendee_name,
      order_items!inner(
        orders!inner(
          events!inner(
            id,
            title,
            slug,
            city,
            venue_name,
            start_datetime,
            end_datetime,
            cover_image_url,
            status
          )
        )
      )
    `);

  if (error) throw error;
  return tickets || [];
}

function TicketsPage() {
  const { data: tickets, isLoading, error } = useQuery({
    queryKey: ["my-tickets"],
    queryFn: fetchMyTickets,
  });

  const now = new Date();

  // Deduplicate tickets by event_id so we show one card per event the user has tickets for.
  // We'll collect tickets under their event.
  const eventsMap = new Map<string, any>();
  
  if (tickets) {
    for (const t of tickets) {
      const event = t.order_items.orders.events;
      if (!eventsMap.has(event.id)) {
        eventsMap.set(event.id, {
          ...event,
          tickets: [],
        });
      }
      eventsMap.get(event.id).tickets.push(t);
    }
  }

  const events = Array.from(eventsMap.values());

  const upcoming = [];
  const live = [];
  const past = [];

  for (const ev of events) {
    const start = new Date(ev.start_datetime);
    const end = ev.end_datetime ? new Date(ev.end_datetime) : start;

    if (end < now) {
      past.push(ev);
    } else if (start <= now && end >= now) {
      live.push(ev);
    } else {
      upcoming.push(ev);
    }
  }

  // Sort: Upcoming soonest first, Past most recent first
  upcoming.sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime());
  past.sort((a, b) => new Date(b.start_datetime).getTime() - new Date(a.start_datetime).getTime());
  live.sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime());

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8">
        <h1 className="font-display text-4xl md:text-5xl">Tickets</h1>
        <p className="text-muted-foreground mt-2">Manage your purchased tickets and passes.</p>
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">Loading your tickets…</div>}
      {error && <div className="text-sm text-destructive">{(error as Error).message}</div>}

      {tickets && tickets.length === 0 ? (
        <div className="border border-dashed border-border bg-card/40 p-12 text-center rounded-2xl">
          <TicketIcon className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 font-display text-2xl">No tickets yet</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
            You haven't purchased any tickets. Discover events happening near you.
          </p>
          <Button asChild className="mt-6 gradient-sunset text-primary-foreground shadow-glow hover:opacity-90">
            <Link to="/browse">Browse events</Link>
          </Button>
        </div>
      ) : (
        tickets && (
          <Tabs defaultValue="upcoming" className="w-full">
            <TabsList className="mb-6 grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
              <TabsTrigger value="live">Live ({live.length})</TabsTrigger>
              <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
            </TabsList>
            
            <TabsContent value="upcoming">
              <EventList events={upcoming} emptyMessage="No upcoming events." type="upcoming" />
            </TabsContent>
            
            <TabsContent value="live">
              <EventList events={live} emptyMessage="No live events right now." type="live" />
            </TabsContent>
            
            <TabsContent value="past">
              <EventList events={past} emptyMessage="No past events." type="past" />
            </TabsContent>
          </Tabs>
        )
      )}
    </div>
  );
}

function EventList({ events, emptyMessage, type }: { events: any[]; emptyMessage: string; type: "upcoming" | "live" | "past" }) {
  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((ev) => (
        <div
          key={ev.id}
          className="group flex flex-col overflow-hidden rounded-2xl bg-card/60 transition-all hover:-translate-y-1 hover:shadow-glow border border-border/50 hover:border-primary/30"
        >
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
            {ev.cover_image_url && (
              <img
                src={ev.cover_image_url}
                alt={ev.title}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            )}
            {ev.status === 'cancelled' && (
              <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
                <Badge variant="destructive" className="text-sm px-3 py-1">Cancelled</Badge>
              </div>
            )}
            <div className="absolute left-3 top-3 flex gap-2">
              {ev.city && (
                <div className="inline-flex items-center gap-1 rounded-full bg-background/80 px-2.5 py-1 text-xs font-medium backdrop-blur-md">
                  <MapPin className="h-3 w-3 text-primary" />
                  {ev.city}
                </div>
              )}
              {type === "live" && ev.status !== 'cancelled' && (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-green-500/90 px-2.5 py-1 text-xs font-semibold text-white shadow-sm animate-pulse">
                  <div className="h-1.5 w-1.5 rounded-full bg-white" />
                  Live now
                </div>
              )}
              {type === "past" && (
                <div className="inline-flex items-center gap-1 rounded-full bg-background/80 px-2.5 py-1 text-xs font-medium backdrop-blur-md">
                  Ended
                </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-1 flex-col p-5">
            <div className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(ev.start_datetime).toLocaleString("en-NG", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit"
              })}
            </div>
            
            <h3 className="font-display text-xl leading-tight group-hover:text-primary line-clamp-2 mb-2">
              {ev.title}
            </h3>
            
            {ev.venue_name && (
              <p className="text-sm text-muted-foreground line-clamp-1 mb-4">
                {ev.venue_name}
              </p>
            )}
            
            <div className="mt-auto pt-4 flex flex-col gap-2 border-t border-border/50">
              <div className="text-sm text-muted-foreground flex justify-between items-center">
                <span>{ev.tickets.length} ticket{ev.tickets.length !== 1 ? 's' : ''}</span>
              </div>
              <Button asChild variant="outline" className="w-full justify-between group-hover:border-primary/50 group-hover:text-primary">
                <Link to="/e/$slug" params={{ slug: ev.slug }}>
                  View Event <QrCode className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
