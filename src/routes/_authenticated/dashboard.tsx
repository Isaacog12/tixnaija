import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Copy, MapPin, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatNaira } from "@/lib/currency";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

async function fetchMyEvents() {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Not signed in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_organizer, full_name")
    .eq("id", userId)
    .maybeSingle();

  const { data: events, error } = await supabase
    .from("events")
    .select("id, title, slug, city, start_datetime, status, cover_image_url")
    .eq("organizer_id", userId)
    .order("start_datetime", { ascending: true });
  if (error) throw error;

  // Fetch ticket stats per event
  const eventIds = (events ?? []).map((e) => e.id);
  let statsByEvent: Record<string, { sold: number; revenueKobo: number }> = {};
  if (eventIds.length) {
    const { data: types } = await supabase
      .from("ticket_types")
      .select("event_id, quantity_sold, price_kobo")
      .in("event_id", eventIds);
    for (const t of types ?? []) {
      const s = statsByEvent[t.event_id] ?? { sold: 0, revenueKobo: 0 };
      s.sold += t.quantity_sold;
      s.revenueKobo += t.quantity_sold * t.price_kobo;
      statsByEvent[t.event_id] = s;
    }
  }

  return { profile, events: events ?? [], statsByEvent };
}

function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-events"],
    queryFn: fetchMyEvents,
  });

  const isOrganizer = data?.profile?.is_organizer ?? false;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="font-display text-4xl md:text-5xl">
            Hey {data?.profile?.full_name?.split(" ")[0] || "there"}.
          </h1>
          <p className="text-muted-foreground">Your event organizer control room.</p>
        </div>
        {isOrganizer ? (
          <Button asChild size="lg" className="gradient-sunset text-primary-foreground shadow-glow hover:opacity-90">
            <Link to="/events/new">
              <Plus className="mr-2 h-4 w-4" /> New event
            </Link>
          </Button>
        ) : (
          <Button asChild size="lg" variant="outline">
            <Link to="/account">Become an organizer</Link>
          </Button>
        )}
      </div>

      {!isOrganizer && (
        <div className="mb-8 rounded-2xl border border-primary/30 bg-primary/5 p-6">
          <h2 className="text-lg font-semibold">Sell tickets on TixNaija</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Turn on organizer mode in your account settings to start creating events, adding
            ticket tiers, and tracking sales.
          </p>
          <Button asChild className="mt-4" variant="secondary">
            <Link to="/account">Turn on organizer mode</Link>
          </Button>
        </div>
      )}

      {isLoading && <div className="text-sm text-muted-foreground">Loading your events…</div>}
      {error && <div className="text-sm text-destructive">{(error as Error).message}</div>}

      {isOrganizer && data && data.events.length === 0 && (
        <div className="border border-dashed border-border bg-card/40 p-12">
          <div className="flex items-baseline gap-4">
            <span className="font-display text-6xl leading-none text-gradient-sunset">00</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <h3 className="mt-6 font-display text-3xl">No events yet</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Create your first event and start selling tickets in minutes.
          </p>
          <Button asChild className="mt-6 gradient-sunset text-primary-foreground shadow-glow hover:opacity-90">
            <Link to="/events/new">
              <Plus className="mr-2 h-4 w-4" /> Create your first event
            </Link>
          </Button>
        </div>
      )}

      {isOrganizer && data && data.events.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {data.events.map((ev) => {
            const stats = data.statsByEvent[ev.id] ?? { sold: 0, revenueKobo: 0 };
            return (
              <Link
                key={ev.id}
                to="/events/$eventId/edit"
                params={{ eventId: ev.id }}
                className="group overflow-hidden rounded-2xl border border-border bg-card/60 transition hover:border-primary/50 hover:shadow-glow"
              >
                <div
                  className="h-40 w-full bg-secondary bg-cover bg-center"
                  style={ev.cover_image_url ? { backgroundImage: `url(${ev.cover_image_url})` } : undefined}
                />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold leading-tight group-hover:text-primary">
                      {ev.title}
                    </h3>
                    <StatusBadge status={ev.status} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {new Date(ev.start_datetime).toLocaleString("en-NG", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                    {ev.city && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" /> {ev.city}
                      </span>
                    )}
                  </div>
                  <div className="mt-4 flex items-center gap-6 border-t border-border pt-4 text-sm">
                    <div>
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">Sold</div>
                      <div className="font-display text-xl">{stats.sold}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">Revenue</div>
                      <div className="font-display text-xl text-gradient-sunset">
                        {formatNaira(stats.revenueKobo)}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
    published: { label: "Live", className: "bg-primary/20 text-primary" },
    cancelled: { label: "Cancelled", className: "bg-destructive/20 text-destructive" },
    completed: { label: "Ended", className: "bg-secondary text-secondary-foreground" },
  };
  const cfg = map[status] ?? map.draft;
  return <Badge className={cfg.className} variant="secondary">{cfg.label}</Badge>;
}
