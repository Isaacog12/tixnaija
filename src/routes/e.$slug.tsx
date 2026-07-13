import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, MapPin, Minus, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatNaira } from "@/lib/currency";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/e/$slug")({
  ssr: false,
  component: EventDetailPage,
  head: ({ params }: { params: { slug: string } }) => ({
    meta: [
      { title: `${params.slug} — TixNaija` },
      { name: "description", content: "Buy tickets to this event on TixNaija." },
    ],
  }),
});

type TicketType = {
  id: string;
  name: string;
  description: string | null;
  price_kobo: number;
  quantity_available: number;
  quantity_sold: number;
  max_per_order: number;
  sales_start_at: string | null;
  sales_end_at: string | null;
  sort_order: number;
};

async function fetchEventBySlug(slug: string) {
  const { data: event, error } = await supabase
    .from("events")
    .select("*")
    .eq("slug", slug)
    .in("status", ["published", "cancelled"])
    .maybeSingle();
  if (error) throw error;
  if (!event) throw notFound();

  const { data: types, error: e2 } = await supabase
    .from("ticket_types")
    .select("*")
    .eq("event_id", event.id)
    .order("sort_order", { ascending: true });
  if (e2) throw e2;

  return { event, types: (types ?? []) as TicketType[] };
}

function EventDetailPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-event", slug],
    queryFn: () => fetchEventBySlug(slug),
  });

  const [qty, setQty] = useState<Record<string, number>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  // attendee names keyed by ticketTypeId -> array of names (one per ticket in that tier)
  const [attendeeNames, setAttendeeNames] = useState<Record<string, string[]>>({});
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{ id: string; discount_type: string; discount_value: number } | null>(null);
  const [validatingPromo, setValidatingPromo] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Pre-fill user data if logged in
  useQuery({
    queryKey: ["user-session-checkout"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        setUserId(userData.user.id);
        setBuyerEmail(userData.user.email || "");
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", userData.user.id).single();
        if (profile?.full_name) setBuyerName(profile.full_name);
      }
      return userData?.user ?? null;
    },
  });

  const items = useMemo(() => {
    if (!data) return [] as { type: TicketType; count: number; subtotal: number }[];
    return data.types
      .map((t: TicketType) => ({ type: t, count: qty[t.id] ?? 0, subtotal: (qty[t.id] ?? 0) * t.price_kobo }))
      .filter((i: { count: number }) => i.count > 0);
  }, [data, qty]);

  const subtotalKobo = items.reduce((sum: number, i: { subtotal: number }) => sum + i.subtotal, 0);
  let discountKobo = 0;
  if (appliedPromo) {
    if (appliedPromo.discount_type === "percent") {
      discountKobo = Math.floor(subtotalKobo * appliedPromo.discount_value / 100);
    } else {
      discountKobo = appliedPromo.discount_value;
    }
    if (discountKobo > subtotalKobo) discountKobo = subtotalKobo;
  }
  const totalKobo = subtotalKobo - discountKobo;
  const totalCount = items.reduce((sum: number, i: { count: number }) => sum + i.count, 0);

  async function applyPromo() {
    if (!promoCode.trim() || !data) return;
    setValidatingPromo(true);
    try {
      const { data: res, error } = await supabase.rpc('validate_promo_code', {
        p_event_id: data.event.id,
        p_code: promoCode.trim()
      });
      if (error) throw error;
      if (!res) throw new Error("Invalid promo code");
      setAppliedPromo(res as any);
      toast.success("Promo code applied!");
    } catch (err: any) {
      toast.error(err.message || "Invalid promo code");
      setAppliedPromo(null);
    } finally {
      setValidatingPromo(false);
    }
  }

  function setCount(t: TicketType, next: number) {
    const remaining = Math.max(0, t.quantity_available - t.quantity_sold);
    const cap = Math.min(t.max_per_order || 10, remaining);
    const clamped = Math.max(0, Math.min(cap, next));
    setQty((q) => ({ ...q, [t.id]: clamped }));
    setAttendeeNames((prev) => {
      const existing = prev[t.id] ?? [];
      const next = existing.slice(0, clamped);
      while (next.length < clamped) next.push("");
      return { ...prev, [t.id]: next };
    });
  }

  function setAttendeeName(ticketTypeId: string, index: number, value: string) {
    setAttendeeNames((prev) => {
      const arr = [...(prev[ticketTypeId] ?? [])];
      arr[index] = value;
      return { ...prev, [ticketTypeId]: arr };
    });
  }

  function onCheckout() {
    if (!totalCount) return;
    setCheckoutOpen(true);
  }

  async function handleCheckoutSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!buyerName || !buyerEmail) {
      toast.error("Please fill in your name and email.");
      return;
    }
    if (!termsAccepted) {
      toast.error("You must agree to the Terms of Service and Privacy Policy.");
      return;
    }

    setCheckoutBusy(true);
    try {
      const ticketsPayload = items.map((i: { type: TicketType; count: number }) => ({
        ticketTypeId: i.type.id,
        count: i.count,
        attendee_names: (attendeeNames[i.type.id] ?? []).slice(0, i.count),
      }));

      if (totalKobo === 0) {
        // Handle free tickets locally
        const { data: orderId, error: checkoutError } = await supabase.rpc('process_checkout', {
          p_event_id: data!.event.id,
          p_user_id: (userId || null) as string,
          p_buyer_name: buyerName,
          p_buyer_email: buyerEmail,
          p_buyer_phone: (buyerPhone || null) as string,
          p_tickets: ticketsPayload,
          p_amount_paid: 0,
          p_payment_reference: `FREE_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          p_promo_code_id: appliedPromo?.id || null,
        });

        if (checkoutError) {
          throw new Error(`Database error: ${checkoutError.message}`);
        }

        if (!userId) {
          toast.success("Free ticket claimed! Please sign up or log in to view your tickets.", { duration: 6000 });
          navigate({ to: "/auth" });
        } else {
          toast.success("Free ticket claimed successfully!");
          navigate({ to: "/inbox" });
        }
        return;
      }

      const metadata = {
        eventId: data!.event.id,
        userId,
        buyerName,
        buyerEmail,
        buyerPhone: buyerPhone || null,
        tickets: ticketsPayload,
        promoCodeId: appliedPromo?.id || null,
      };

      const { data: initData, error: initErr } = await supabase.functions.invoke("initialize-payment", {
        body: {
          email: buyerEmail,
          amount: totalKobo / 100, // edge fn multiplies by 100
          metadata,
        },
      });
      if (initErr) throw initErr;
      if (initData?.error) throw new Error(initData.error);
      if (!initData?.authorization_url) throw new Error("Could not start payment.");

      window.location.href = initData.authorization_url;
    } catch (err: any) {
      toast.error(err.message || "Checkout failed");
    } finally {
      setCheckoutBusy(false);
    }
  }


  return (
    <div className="min-h-screen pb-32 md:pb-0">
      <SiteNav />

      {isLoading ? <EventSkeleton /> : isError || !data ? <EventMissing /> : (
        <EventBody event={data.event} types={data.types} qty={qty} setCount={setCount} onCheckout={onCheckout} totalCount={totalCount} totalKobo={totalKobo} />
      )}

      {/* Sticky mobile buy bar */}
      {data && data.event.status !== "cancelled" && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/95 backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                {totalCount ? `${totalCount} ticket${totalCount === 1 ? "" : "s"}` : "No tickets yet"}
              </p>
              <p className="truncate font-display text-xl leading-none">
                {totalKobo ? formatNaira(totalKobo) : "Pick a tier"}
              </p>
            </div>
            <Button
              onClick={onCheckout}
              disabled={!totalCount}
              size="lg"
              className="gradient-sunset text-primary-foreground shadow-glow hover:opacity-90 disabled:opacity-40"
            >
              Buy tickets
            </Button>
          </div>
        </div>
      )}

      {/* Checkout Dialog */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Complete Checkout</DialogTitle>
            <DialogDescription>
              You're buying {totalCount} ticket{totalCount === 1 ? "" : "s"} for {formatNaira(totalKobo)}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCheckoutSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Your Full Name</Label>
              <Input id="name" required value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="Jane Doe" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" required value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} placeholder="jane@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number (Optional)</Label>
              <Input id="phone" type="tel" value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)} placeholder="08012345678" />
            </div>

            <div className="space-y-2 border-t border-border pt-4">
              <Label>Promo Code</Label>
              <div className="flex gap-2">
                <Input 
                  value={promoCode} 
                  onChange={(e) => setPromoCode(e.target.value)} 
                  placeholder="e.g. EARLYBIRD" 
                  disabled={!!appliedPromo}
                />
                {!appliedPromo ? (
                  <Button type="button" variant="secondary" onClick={applyPromo} disabled={validatingPromo || !promoCode.trim()}>
                    {validatingPromo ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                  </Button>
                ) : (
                  <Button type="button" variant="destructive" onClick={() => { setAppliedPromo(null); setPromoCode(""); }}>
                    Remove
                  </Button>
                )}
              </div>
              {appliedPromo && (
                <p className="text-xs text-green-500 font-medium">
                  {appliedPromo.discount_type === "percent" ? `${appliedPromo.discount_value}%` : formatNaira(appliedPromo.discount_value)} discount applied!
                </p>
              )}
            </div>

            {totalCount > 1 && (
              <div className="space-y-3 border-t border-border pt-4">
                <div>
                  <p className="text-sm font-semibold">Attendee names</p>
                  <p className="text-xs text-muted-foreground">
                    Add a name for each ticket (optional — blanks use your name).
                  </p>
                </div>
                {items.map((it) => (
                  <div key={it.type.id} className="space-y-2">
                    <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                      {it.type.name}
                    </p>
                    {Array.from({ length: it.count }).map((_, idx) => (
                      <Input
                        key={idx}
                        value={attendeeNames[it.type.id]?.[idx] ?? ""}
                        onChange={(e) => setAttendeeName(it.type.id, idx, e.target.value)}
                        placeholder={`Attendee ${idx + 1} full name`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-start gap-2 border-t border-border pt-4">
              <input 
                type="checkbox" 
                id="terms" 
                required
                className="mt-1"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
              />
              <Label htmlFor="terms" className="text-xs text-muted-foreground leading-relaxed">
                I agree to the <Link to="/terms" target="_blank" className="text-primary hover:underline">Terms of Service</Link> and <Link to="/privacy" target="_blank" className="text-primary hover:underline">Privacy Policy</Link>.
              </Label>
            </div>

            <Button type="submit" disabled={checkoutBusy || !termsAccepted} className="w-full gradient-sunset text-primary-foreground shadow-glow">
              {checkoutBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {totalKobo === 0 ? "Get free tickets" : `Pay ${formatNaira(totalKobo)}`}
            </Button>
          </form>
        </DialogContent>

      </Dialog>
    </div>
  );
}

function EventBody({
  event,
  types,
  qty,
  setCount,
  onCheckout,
  totalCount,
  totalKobo,
}: {
  event: Awaited<ReturnType<typeof fetchEventBySlug>>["event"];
  types: TicketType[];
  qty: Record<string, number>;
  setCount: (t: TicketType, n: number) => void;
  onCheckout: () => void;
  totalCount: number;
  totalKobo: number;
}) {
  const start = new Date(event.start_datetime);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 md:pt-10">
      {event.status === "cancelled" && (
        <div className="mb-8 rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <h2 className="font-semibold text-lg">Event Cancelled</h2>
          <p className="text-sm mt-1">{event.organizer_note || "This event has been cancelled by the organizer. Ticket holders have been notified regarding refunds."}</p>
        </div>
      )}
      {event.postponed_at && event.status !== "cancelled" && (
        <div className="mb-8 rounded-xl border border-amber-500/50 bg-amber-500/10 p-4 text-amber-600 dark:text-amber-400">
          <h2 className="font-semibold text-lg">Event Postponed</h2>
          <p className="text-sm mt-1">{event.organizer_note || "This event has been postponed to a new date. Previously purchased tickets remain valid."}</p>
        </div>
      )}
      <div className="grid gap-8 md:grid-cols-[1.4fr_1fr] md:gap-10">
        <div>
          <div className="relative overflow-hidden rounded-2xl border border-border">
            {event.cover_image_url ? (
              <img
                src={event.cover_image_url}
                alt={event.title}
                className="aspect-[16/10] w-full object-cover"
              />
            ) : (
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-card">
                <div
                  aria-hidden
                  className="absolute inset-0 opacity-30"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(135deg, transparent 0 22px, color-mix(in oklab, var(--primary) 40%, transparent) 22px 23px)",
                  }}
                />
                <div className="absolute inset-x-6 bottom-6 flex items-end justify-between gap-4">
                  <span className="font-display text-2xl leading-none text-foreground/80 md:text-3xl">
                    {event.title}
                  </span>
                  <span className="font-display text-[11px] uppercase tracking-[0.35em] text-primary">
                    Admit One
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6">
            <span className="text-[11px] font-semibold uppercase tracking-[0.35em] text-primary">
              {event.category}
            </span>
            <h1 className="mt-2 font-display text-4xl leading-[0.95] md:text-6xl">{event.title}</h1>
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                {start.toLocaleString("en-NG", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
              {(event.venue_name || event.city) && (
                <span className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  {[event.venue_name, event.city, event.state].filter(Boolean).join(", ")}
                </span>
              )}
            </div>
          </div>

          {event.description && (
            <div className="mt-8 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/90">
              {event.description}
            </div>
          )}
        </div>

        <aside className="md:sticky md:top-24 md:self-start">
          <div className="rounded-2xl border border-border bg-card/70 p-5 backdrop-blur">
            <h2 className="font-display text-2xl">Tickets</h2>
            <p className="text-xs text-muted-foreground">Select how many of each tier.</p>

            <div className="mt-4 space-y-3">
              {types.length === 0 && (
                <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Tickets aren't on sale yet. Check back soon.
                </p>
              )}
              {types.map((t) => {
                const now = new Date();
                const salesStart = t.sales_start_at ? new Date(t.sales_start_at) : null;
                const salesEnd = t.sales_end_at ? new Date(t.sales_end_at) : null;
                const isStarted = !salesStart || now >= salesStart;
                const isEnded = salesEnd && now >= salesEnd;
                const remaining = Math.max(0, t.quantity_available - t.quantity_sold);
                const soldOut = remaining === 0;
                const unavailable = !isStarted || isEnded || soldOut || event.status === "cancelled";
                const count = qty[t.id] ?? 0;
                
                let statusText = `${remaining} left`;
                if (event.status === "cancelled") statusText = "Sales closed";
                else if (!isStarted) statusText = "Sales not started";
                else if (isEnded) statusText = "Sales ended";
                else if (soldOut) statusText = "Sold out";

                return (
                  <div
                    key={t.id}
                    className={`rounded-xl border border-border p-4 transition ${unavailable ? 'bg-muted/30 opacity-75' : 'bg-background/40 hover:border-primary/40'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold">{t.name}</p>
                        {t.description && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>
                        )}
                        <p className="mt-1 font-display text-2xl text-gradient-sunset">
                          {t.price_kobo === 0 ? "Free" : formatNaira(t.price_kobo)}
                        </p>
                        <p className="mt-1 text-[11px] uppercase tracking-widest text-muted-foreground">
                          {statusText}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          disabled={count === 0}
                          onClick={() => setCount(t, count - 1)}
                          aria-label={`Remove one ${t.name}`}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-6 text-center font-semibold tabular-nums">{count}</span>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          disabled={unavailable}
                          onClick={() => setCount(t, count + 1)}
                          aria-label={`Add one ${t.name}`}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex items-baseline justify-between border-t border-border pt-4">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="font-display text-3xl text-gradient-sunset">
                {totalKobo ? formatNaira(totalKobo) : "—"}
              </span>
            </div>
            <Button
              disabled={!totalCount}
              onClick={onCheckout}
              className="mt-4 hidden w-full gradient-sunset text-primary-foreground shadow-glow hover:opacity-90 disabled:opacity-40 md:inline-flex"
              size="lg"
            >
              Buy tickets
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function EventSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-10">
      <div className="grid gap-8 md:grid-cols-[1.4fr_1fr]">
        <div>
          <Skeleton className="aspect-[16/10] w-full rounded-2xl" />
          <Skeleton className="mt-6 h-10 w-2/3" />
          <Skeleton className="mt-3 h-4 w-1/2" />
        </div>
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    </div>
  );
}

function EventMissing() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="font-display text-4xl text-gradient-sunset">Event unavailable</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This event may have been unpublished or removed.
      </p>
      <Button asChild className="mt-6 gradient-sunset text-primary-foreground shadow-glow hover:opacity-90">
        <Link to="/">Back to events</Link>
      </Button>
    </div>
  );
}
