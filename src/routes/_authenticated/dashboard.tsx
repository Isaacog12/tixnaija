import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Copy, MapPin, Plus, QrCode, Ticket, Zap, Users, BarChart2, Clock, XCircle, ArrowRight, FileEdit } from "lucide-react";
import { toast } from "@/lib/toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatNaira } from "@/lib/currency";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PromoCodesTab } from "@/components/promo-codes-tab";
import { PromotersTab } from "@/components/promoters-tab";
import { PayoutsTab } from "@/components/payouts-tab";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

async function fetchMyEvents() {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Not signed in");

  const { data: profile } = (await supabase
    .from("profiles")
    .select("is_organizer, is_admin, full_name, paystack_subaccount_code")
    .eq("id", userId)
    .maybeSingle()) as { data: any };

  const { data: roleRows } = (await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)) as { data: any[] | null };
  const userRoles = (roleRows ?? []).map((r: any) => r.role);
  const isAdmin = userRoles.includes("admin");
  const isCustomerCare = userRoles.includes("customer_care");

  const { data: latestApp } = (await supabase
    .from("organizer_applications")
    .select("status, admin_note, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: any };

  const { data: events, error } = (await supabase
    .from("events")
    .select("id, title, slug, city, start_datetime, status, cover_image_url, event_series(title)")
    .is("deleted_at", null)
    .eq("organizer_id", userId)
    .order("start_datetime", { ascending: true })) as { data: any[] | null, error: any };
  if (error) throw error;

  const eventIds = (events ?? []).map((e: any) => e.id);
  let statsByEvent: Record<string, { sold: number; revenueKobo: number }> = {};
  if (eventIds.length) {
    const { data: types } = (await supabase
      .from("ticket_types")
      .select("event_id, quantity_sold")
      .in("event_id", eventIds)) as { data: any[] | null };
      
    const { data: orders } = (await supabase
      .from("orders")
      .select("event_id, total_kobo")
      .in("event_id", eventIds)
      .eq("status", "paid")) as { data: any[] | null };

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
    isAdmin,
    isCustomerCare,
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
  const isCustomerCare = data?.isCustomerCare ?? false;
  const latestApp = data?.latestApp ?? null;

  return (
    <div className="mx-auto min-h-dvh w-full max-w-6xl px-4 py-10 sm:px-6 md:py-14 lg:px-8">
      <header className="mb-10 border-b border-border/60 pb-8">
        <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          <span className="h-px w-10 bg-border" aria-hidden />
          TixNaija / Workspace
        </div>
        <div className="mt-5 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <h1 className="font-display text-[clamp(2rem,4.5vw,3rem)] leading-[1.05] tracking-[-0.025em] text-foreground">
              Dashboard
            </h1>
            <p className="mt-2.5 text-[14px] text-muted-foreground">
              Welcome back{data?.profile?.full_name ? `, ${data.profile.full_name}` : ""}.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
          {(isCustomerCare || isAdmin) && (
            <Button asChild variant="outline" className="h-10 rounded-xl border-border/70 px-4 text-[13px] font-medium text-foreground hover:bg-secondary/60">
              <Link to="/support">Support portal</Link>
            </Button>
          )}
          {isAdmin && (
            <>
              <Button asChild variant="outline" className="h-10 rounded-xl border-border/70 px-4 text-[13px] font-medium text-foreground hover:bg-secondary/60">
                <Link to="/admin">Admin panel</Link>
              </Button>
              <Button asChild variant="outline" className="h-10 rounded-xl border-border/70 px-4 text-[13px] font-medium text-foreground hover:bg-secondary/60">
                <Link to="/admin/organizer-applications">Review apps</Link>
              </Button>
            </>
          )}
          {isOrganizer && (
            <Button asChild className="h-10 rounded-xl bg-primary px-4 text-[13px] font-semibold text-primary-foreground press-sm hover:bg-primary/90">
              <Link to="/events/new">
                <Plus className="mr-1.5 h-4 w-4" /> New event
              </Link>
            </Button>
          )}
        </div>
        </div>
      </header>

      {isLoading && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-8">
           {[1, 2, 3].map((i) => (
             <div key={i} className="animate-pulse rounded-[2rem] bg-card border border-border/40 overflow-hidden shadow-sm h-[400px]">
               <div className="h-48 bg-muted/60" />
               <div className="p-6 space-y-4">
                 <div className="h-5 w-2/3 bg-muted/80 rounded-md" />
                 <div className="h-4 w-1/3 bg-muted/80 rounded-md" />
                 <div className="pt-6 mt-6 border-t border-border/40 flex justify-between">
                   <div className="h-10 w-24 bg-muted/80 rounded-lg" />
                   <div className="h-10 w-24 bg-muted/80 rounded-lg" />
                 </div>
               </div>
             </div>
           ))}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center text-destructive max-w-2xl mx-auto mt-8">
          <XCircle className="h-10 w-10 mx-auto mb-4 opacity-50" />
          <h3 className="font-medium text-lg mb-1">Failed to load dashboard</h3>
          <p className="text-destructive/80">{(error as Error).message}</p>
        </div>
      )}

      {!isLoading && !error && (
        <>
          {isOrganizer ? (
            <Tabs defaultValue="events" className="space-y-6 w-full max-w-full">
              <TabsList className="h-auto flex-wrap justify-start gap-1 rounded-xl border border-border/60 bg-secondary/30 p-1">
                <TabsTrigger value="overview" className="rounded-lg px-4 text-[13px] font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">Overview</TabsTrigger>
                <TabsTrigger value="events" className="rounded-lg px-4 text-[13px] font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">Events</TabsTrigger>
                <TabsTrigger value="promo-codes" className="rounded-lg px-4 text-[13px] font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">Promo codes</TabsTrigger>
                <TabsTrigger value="promoters" className="rounded-lg px-4 text-[13px] font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">Promoters</TabsTrigger>
                <TabsTrigger value="payouts" className="rounded-lg px-4 text-[13px] font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">Payouts</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview">
                {renderOverview()}
              </TabsContent>
              <TabsContent value="events">
                {renderEvents()}
              </TabsContent>
              <TabsContent value="promo-codes">
                <PromoCodesTab events={data?.events || []} />
              </TabsContent>
              <TabsContent value="promoters">
                <PromotersTab events={data?.events || []} />
              </TabsContent>
              <TabsContent value="payouts">
                <PayoutsTab events={data?.events || []} statsByEvent={data?.statsByEvent || {}} hasPayoutAccount={!!data?.profile?.paystack_subaccount_code} />
              </TabsContent>
            </Tabs>
          ) : (
            renderOverview()
          )}
        </>
      )}
    </div>
  );

  function renderOverview() {
    return (
      <div className="space-y-12 mt-2">
        <div className="rounded-3xl border border-border/60 bg-card p-7 md:p-10">
          <div className="relative grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/[0.07] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                <Zap className="h-3 w-3" aria-hidden /> For creators
              </span>
               <h2 className="font-display text-[30px] leading-[1.08] tracking-[-0.02em] text-foreground md:text-[36px]">
                 Start selling <span className="text-primary">in minutes.</span>
               </h2>
              <p className="mt-4 mb-7 max-w-md text-[15px] leading-relaxed text-muted-foreground">
                Create your event, set ticket tiers, track sales in real-time, and scan attendees seamlessly at the door.
              </p>
              
              <div className="flex flex-col sm:flex-row flex-wrap gap-4">
                {latestApp?.status === "pending" ? (
                  <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-5 py-3 text-sm font-semibold text-amber-500">
                    <Clock className="h-4 w-4" />
                    Application pending review
                  </div>
                ) : latestApp?.status === "rejected" ? (
                  <div className="flex flex-col gap-3">
                    <div className="inline-flex items-center gap-2 rounded-full border border-destructive/30 bg-destructive/10 px-5 py-3 text-sm font-semibold text-destructive">
                      <XCircle className="h-4 w-4" />
                      Application not approved
                    </div>
                    <Button asChild size="lg" className="w-fit">
                      <Link to="/account">Apply again</Link>
                    </Button>
                  </div>
                ) : (
                  <Button asChild className="h-11 rounded-xl bg-primary px-5 text-[14px] font-semibold text-primary-foreground press-sm hover:bg-primary/90">
                     <Link to="/account">Become an organizer</Link>
                   </Button>
                )}
                <Button asChild variant="outline" className="group h-11 rounded-xl border-border/70 px-5 text-[14px] font-medium hover:bg-secondary/60">
                  <Link to="/browse">
                    Explore events <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-sm lg:max-w-md">
              <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
                <div className="relative flex h-36 w-full items-end bg-secondary/60 p-6">
                  <span className="relative font-display text-[13px] uppercase tracking-[0.4em] text-secondary-foreground">Admit One</span>
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-primary font-bold mb-1">Music · Lagos</p>
                      <h3 className="font-display text-xl leading-tight">Afrobeats Live 2025</h3>
                    </div>
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary border border-primary/20">Live</span>
                  </div>
                  <p className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                    <CalendarDays className="h-3 w-3" /> Sat, Aug 23 · 7:00 PM
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-6 flex items-center gap-4">
            <h3 className="font-display text-xl tracking-[-0.01em]">Toolkit</h3>
            <div className="h-px flex-1 bg-border/60" aria-hidden />
          </div>
          
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { icon: Ticket, title: "Ticket Tiers", desc: "Create Early Bird, VIP, and GA tiers with custom pricing." },
              { icon: BarChart2, title: "Live Analytics", desc: "Track sales, revenue, and capacity in real-time." },
              { icon: QrCode, title: "QR Scanning", desc: "Check in attendees instantly with our built-in scanner." },
              { icon: Users, title: "Comp Tickets", desc: "Issue free tickets to guests, press, or VIPs easily." },
            ].map((f) => (
              <div key={f.title} className="rounded-2xl border border-border/60 bg-card p-5 transition-colors hover:border-border">
                <span className="mb-4 inline-grid h-9 w-9 place-items-center rounded-lg bg-secondary/70 text-foreground">
                  <f.icon className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <h3 className="text-[14px] font-semibold text-foreground">{f.title}</h3>
                <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function renderEvents() {
    if (data?.events.length === 0) {
      return (
        <div className="mx-auto mt-2 flex max-w-xl flex-col items-center rounded-2xl border border-dashed border-border px-6 py-16 text-center">
          <Ticket className="mb-5 h-7 w-7 text-muted-foreground/50" aria-hidden />
          <h3 className="font-display text-2xl leading-snug text-foreground">Your stage is empty</h3>
          <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-muted-foreground">
            Create your first event and start selling tickets.
          </p>
          <Button asChild className="mt-6 h-11 rounded-xl bg-primary px-5 text-[14px] font-semibold text-primary-foreground press-sm hover:bg-primary/90">
            <Link to="/events/new">
              <Plus className="mr-1.5 h-4 w-4" /> Create your first event
            </Link>
          </Button>
        </div>
      );
    }

    return (
      <div className="mb-8 mt-2 overflow-hidden rounded-2xl border border-border/60 bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="border-b border-border/60 bg-secondary/30 text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-semibold w-12"></th>
                <th className="px-5 py-3 font-semibold">Event</th>
                <th className="px-5 py-3 font-semibold">Date</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold text-right">Sold</th>
                <th className="px-5 py-3 font-semibold text-right">Revenue</th>
                <th className="px-5 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data?.events.map((ev) => {
                const stats = data.statsByEvent[ev.id] ?? { sold: 0, revenueKobo: 0 };
                const evDate = new Date(ev.start_datetime);
                return (
                  <tr key={ev.id} className="group transition-colors hover:bg-secondary/30">
                    <td className="px-5 py-4">
                      <div className="h-10 w-10 shrink-0 rounded bg-secondary border border-border overflow-hidden">
                        {ev.cover_image_url ? (
                          <img src={ev.cover_image_url} alt={ev.title} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center bg-muted">
                            <Ticket className="h-4 w-4 text-muted-foreground/50" />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-0.5">
                        <Link to="/events/$eventId/edit" params={{ eventId: ev.id }} className="font-semibold text-sm hover:text-primary transition-colors line-clamp-1">
                          {ev.title}
                        </Link>
                        {ev.event_series?.title && (
                          <div className="text-[10px] font-bold text-primary/80 uppercase tracking-wider">Series: {ev.event_series.title}</div>
                        )}
                        {ev.city && <div className="text-muted-foreground text-xs">{ev.city}</div>}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground text-xs">
                      {evDate.toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" })}
                      <div className="text-[10px] mt-0.5">{evDate.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })}</div>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={ev.status} />
                    </td>
                    <td className="px-5 py-4 text-right font-medium">
                      {stats.sold}
                    </td>
                    <td className="px-5 py-4 text-right font-medium text-primary">
                      {formatNaira(stats.revenueKobo)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        {ev.status === "published" && (
                          <>
                            <Button asChild variant="outline" size="icon" className="h-8 w-8 rounded hover:bg-primary/10 hover:text-primary hover:border-primary/20 transition-colors" title="Scan Tickets">
                              <Link to="/events/$eventId/scan" params={{ eventId: ev.id }}>
                                <QrCode className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 rounded hover:bg-secondary transition-colors"
                              title="Copy public link"
                              onClick={() => {
                                const url = `${window.location.origin}/e/${ev.slug}`;
                                navigator.clipboard.writeText(url);
                                toast.success("Link copied");
                              }}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button asChild variant="outline" size="icon" className="h-8 w-8 rounded hover:bg-secondary transition-colors" title="Manage Attendees">
                          <Link to="/events/$eventId/attendees" params={{ eventId: ev.id }}>
                            <Users className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button asChild variant="outline" size="icon" className="h-8 w-8 rounded hover:bg-secondary transition-colors" title="Analytics">
                          <Link to="/events/$eventId/analytics" params={{ eventId: ev.id }}>
                            <BarChart2 className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button asChild variant="outline" size="icon" className="h-8 w-8 rounded hover:bg-secondary transition-colors" title="Edit Event">
                          <Link to="/events/$eventId/edit" params={{ eventId: ev.id }}>
                            <FileEdit className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    draft: { label: "Draft", className: "bg-muted text-muted-foreground border-transparent" },
    published: { label: "Live", className: "bg-primary/10 text-primary border-primary/20" },
    cancelled: { label: "Cancelled", className: "bg-destructive/10 text-destructive border-destructive/20" },
    postponed: { label: "Postponed", className: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
    completed: { label: "Ended", className: "bg-secondary text-secondary-foreground border-transparent" },
  };
  const cfg = map[status] ?? map.draft;
  return <Badge className={`font-semibold text-[10px] tracking-wider uppercase px-2 py-0.5 border ${cfg.className}`} variant="outline">{cfg.label}</Badge>;
}
