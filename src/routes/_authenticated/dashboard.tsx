import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Copy, MapPin, Plus, QrCode, Ticket, Zap, Users, BarChart2, Clock, XCircle } from "lucide-react";
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

  // Check admin via user_roles (consistent with the rest of the app)
  const { data: adminRole } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  // Fetch the user's most recent organizer application
  const { data: latestApp } = await supabase
    .from("organizer_applications" as any)
    .select("status, admin_note, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
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

  return {
    profile,
    isAdmin: !!adminRole,
    latestApp: latestApp as { status: "pending" | "approved" | "rejected"; admin_note: string | null; created_at: string } | null,
    events: events ?? [],
    statsByEvent,
  };
}

function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-events"],
    queryFn: fetchMyEvents,
  });

  const isOrganizer = data?.profile?.is_organizer ?? false;
  const isAdmin = data?.isAdmin ?? false;
  const latestApp = data?.latestApp ?? null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="font-display text-4xl md:text-5xl">
            Hey {data?.profile?.full_name?.split(" ")[0] || "there"}.
          </h1>
          <p className="text-muted-foreground">
            {isOrganizer ? "Your event organizer control room." : "Good to see you."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <>
              <Button asChild size="lg" variant="outline" className="border-primary/20 text-primary">
                <Link to="/admin">Admin Panel</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-amber-500/30 text-amber-500 hover:bg-amber-500/10">
                <Link to="/admin/organizer-applications">Applications</Link>
              </Button>
            </>
          )}
          {isOrganizer && (
            <Button asChild size="lg" className="gradient-sunset text-primary-foreground shadow-glow hover:opacity-90">
              <Link to="/events/new">
                <Plus className="mr-2 h-4 w-4" /> New event
              </Link>
            </Button>
          )}
        </div>
      </div>

      {!isOrganizer && (
        <div className="space-y-10">
          {/* Hero CTA */}
          <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-card/60 p-8 md:p-12">
            {/* Background gradient blobs */}
            <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-rose-500/10 blur-3xl" />

            <div className="relative grid gap-10 md:grid-cols-2 md:items-center">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
                  <Zap className="h-3 w-3" /> For organizers
                </span>
                <h2 className="mt-4 font-display text-4xl leading-tight md:text-5xl">
                  Start selling<br />
                  <span className="text-gradient-sunset">in minutes.</span>
                </h2>
                <p className="mt-4 text-base text-muted-foreground">
                  Create your event, set ticket tiers, track sales in real-time, and scan attendees at the door â€” all in one place.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  {latestApp?.status === "pending" ? (
                    <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-500">
                      <Clock className="h-4 w-4" />
                      Application pending review
                    </div>
                  ) : latestApp?.status === "rejected" ? (
                    <div className="flex flex-col gap-2">
                      <div className="inline-flex items-center gap-2 rounded-full border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive">
                        <XCircle className="h-4 w-4" />
                        Application not approved
                      </div>
                      <Button asChild size="lg" className="gradient-sunset text-primary-foreground shadow-glow hover:opacity-90">
                        <Link to="/account">Apply again</Link>
                      </Button>
                    </div>
                  ) : (
                    <Button asChild size="lg" className="gradient-sunset text-primary-foreground shadow-glow hover:opacity-90">
                      <Link to="/account">Apply to become an organizer</Link>
                    </Button>
                  )}
                  <Button asChild size="lg" variant="outline">
                    <Link to="/browse">See live events</Link>
                  </Button>
                </div>
              </div>

              {/* Sample event card mock */}
              <div className="relative">
                <div className="rounded-2xl border border-border bg-background/80 shadow-xl overflow-hidden">
                  <div className="h-36 w-full bg-gradient-to-br from-rose-500/30 via-orange-500/20 to-amber-500/30 relative flex items-end p-4">
                    <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "repeating-linear-gradient(135deg, transparent 0 22px, rgba(255,255,255,0.15) 22px 23px)" }} />
                    <span className="relative font-display text-xs uppercase tracking-[0.35em] text-white/70">Admit One</span>
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-widest text-primary font-semibold">Music Â· Lagos</p>
                        <h3 className="mt-1 font-display text-xl leading-tight">Afrobeats Live 2025</h3>
                        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CalendarDays className="h-3.5 w-3.5" /> Sat, Aug 23 Â· 7:00 PM
                        </p>
                      </div>
                      <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">Live</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feature grid */}
          <div>
            <p className="mb-5 text-sm font-semibold uppercase tracking-widest text-muted-foreground">Everything you get</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  icon: Ticket,
                  title: "Ticket tiers",
                  desc: "Create Early Bird, VIP, and General Admission tiers with custom pricing and limits.",
                  color: "text-primary",
                  bg: "bg-primary/10",
                },
                {
                  icon: BarChart2,
                  title: "Live analytics",
                  desc: "Track sales, revenue, and remaining capacity per tier in real-time.",
                  color: "text-orange-400",
                  bg: "bg-orange-400/10",
                },
                {
                  icon: QrCode,
                  title: "QR scanning",
                  desc: "Check in attendees instantly at the door with the built-in QR scanner.",
                  color: "text-rose-400",
                  bg: "bg-rose-400/10",
                },
                {
                  icon: Users,
                  title: "Comp tickets",
                  desc: "Issue free tickets to guests, press, or VIPs directly from your dashboard.",
                  color: "text-amber-400",
                  bg: "bg-amber-400/10",
                },
              ].map((f) => (
                <div key={f.title} className="rounded-2xl border border-border bg-card/50 p-5 transition hover:border-primary/30 hover:bg-card/80">
                  <div className={`inline-flex rounded-xl ${f.bg} p-2.5`}>
                    <f.icon className={`h-5 w-5 ${f.color}`} />
                  </div>
                  <h3 className="mt-3 font-semibold">{f.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>


        </div>
      )}


      {isLoading && <div className="text-sm text-muted-foreground">Loading your eventsâ€¦</div>}
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
