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
    .select("is_organizer, is_admin, full_name")
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
      .select("event_id, quantity_sold")
      .in("event_id", eventIds);
      
    const { data: orders } = await supabase
      .from("orders")
      .select("event_id, total_kobo")
      .in("event_id", eventIds)
      .eq("status", "paid");

    for (const t of types ?? []) {
      const s = statsByEvent[t.event_id] ?? { sold: 0, revenueKobo: 0 };
      s.sold += t.quantity_sold;
      statsByEvent[t.event_id] = s;
    }
    
    for (const o of orders ?? []) {
      const s = statsByEvent[o.event_id] ?? { sold: 0, revenueKobo: 0 };
      s.revenueKobo += o.total_kobo || 0;
      statsByEvent[o.event_id] = s;
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
  const isAdmin = data?.profile?.is_admin ?? false;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="font-display text-4xl md:text-5xl">
            Hey {data?.profile?.full_name?.split(" ")[0] || "there"}.
          </h1>
          <p className="text-muted-foreground">Your event organizer control room.</p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Button asChild size="lg" variant="outline" className="border-primary/20 text-primary">
              <Link to="/admin">Admin Panel</Link>
            </Button>
          )}
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
        <div className="flex flex-col gap-4">
          {data.events.map((ev) => {
            const stats = data.statsByEvent[ev.id] ?? { sold: 0, revenueKobo: 0 };
            return (
              <div
                key={ev.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card/60 transition hover:border-primary/50 md:flex-row"
              >
                <Link to="/events/$eventId/edit" params={{ eventId: ev.id }} className="flex flex-1 flex-col md:flex-row">
                  <div
                    className="h-48 w-full shrink-0 bg-secondary bg-cover bg-center md:h-auto md:w-64"
                    style={ev.cover_image_url ? { backgroundImage: `url(${ev.cover_image_url})` } : undefined}
                  />
                  <div className="flex flex-1 flex-col justify-between p-5 md:p-6">
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-xl font-semibold leading-tight group-hover:text-primary">
                          {ev.title}
                        </h3>
                        <StatusBadge status={ev.status} />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="h-4 w-4" />
                          {new Date(ev.start_datetime).toLocaleString("en-NG", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </span>
                        {ev.city && (
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="h-4 w-4" /> {ev.city}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-6 flex items-center gap-8 border-t border-border pt-4">
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Tickets Sold</div>
                        <div className="mt-1 font-display text-2xl">{stats.sold}</div>
                      </div>
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Revenue</div>
                        <div className="mt-1 font-display text-2xl text-gradient-sunset">
                          {formatNaira(stats.revenueKobo)}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
                
                {ev.status === "published" && (
                  <div className="flex flex-row items-center justify-between gap-3 border-t border-border bg-background/40 p-5 md:w-48 md:flex-col md:items-stretch md:justify-center md:border-t-0 md:border-l">
                    <Button asChild variant="outline" className="w-full text-primary hover:text-primary">
                      <Link to="/events/$eventId/scan" params={{ eventId: ev.id }}>
                        Scan Tickets
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full"
                      onClick={() => {
                        const url = `${window.location.origin}/e/${ev.slug}`;
                        navigator.clipboard.writeText(url);
                        toast.success("Public link copied");
                      }}
                    >
                      <Copy className="mr-2 h-4 w-4" /> Copy link
                    </Button>
                  </div>
                )}
              </div>
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
