import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, MapPin, Minus, Plus, Ticket as TicketIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNaira } from "@/lib/currency";

export const Route = createFileRoute("/e/$slug")({
  ssr: false,
  component: EventDetailPage,
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — TixNaija` },
      { name: "description", content: "Buy tickets to this event on TixNaija." },
      { property: "og:title", content: `${params.slug} — TixNaija` },
      { property: "og:description", content: "Buy tickets to this event on TixNaija." },
      { property: "og:type", content: "event" },
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
    .eq("status", "published")
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
  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-event", slug],
    queryFn: () => fetchEventBySlug(slug),
  });

  const [qty, setQty] = useState<Record<string, number>>({});

  const items = useMemo(() => {
    if (!data) return [] as { type: TicketType; count: number; subtotal: number }[];
    return data.types
      .map((t) => ({ type: t, count: qty[t.id] ?? 0, subtotal: (qty[t.id] ?? 0) * t.price_kobo }))
      .filter((i) => i.count > 0);
  }, [data, qty]);

  const totalKobo = items.reduce((sum, i) => sum + i.subtotal, 0);
  const totalCount = items.reduce((sum, i) => sum + i.count, 0);

  function setCount(t: TicketType, next: number) {
    const remaining = Math.max(0, t.quantity_available - t.quantity_sold);
    const cap = Math.min(t.max_per_order || 10, remaining);
    const clamped = Math.max(0, Math.min(cap, next));
    setQty((q) => ({ ...q, [t.id]: clamped }));
  }

  function onCheckout() {
    if (!totalCount) return;
    toast.info("Checkout is coming next — Paystack integration lands in the next stage.");
  }

  return (
    <div className="min-h-screen pb-32 md:pb-0">
      <SiteNav />

      {isLoading ? <EventSkeleton /> : isError || !data ? <EventMissing /> : (
        <EventBody event={data.event} types={data.types} qty={qty} setCount={setCount} />
      )}

      {/* Sticky mobile buy bar */}
      {data && (
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
    </div>
  );
}

function EventBody({
  event,
  types,
  qty,
  setCount,
}: {
  event: Awaited<ReturnType<typeof fetchEventBySlug>>["event"];
  types: TicketType[];
  qty: Record<string, number>;
  setCount: (t: TicketType, n: number) => void;
}) {
  const totalKobo = types.reduce((sum, t) => sum + (qty[t.id] ?? 0) * t.price_kobo, 0);
  const totalCount = types.reduce((sum, t) => sum + (qty[t.id] ?? 0), 0);
  const start = new Date(event.start_datetime);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 md:pt-10">
      <div className="grid gap-8 md:grid-cols-[1.4fr_1fr] md:gap-10">
        {/* Left: cover + details */}
        <div>
          <div className="relative overflow-hidden rounded-2xl border border-border">
            {event.cover_image_url ? (
              <img
                src={event.cover_image_url}
                alt={event.title}
                className="aspect-[16/10] w-full object-cover"
              />
            ) : (
              <div className="grid aspect-[16/10] w-full place-items-center gradient-sunset">
                <TicketIcon className="h-12 w-12 text-primary-foreground/80" />
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

        {/* Right: ticket picker */}
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
                const remaining = Math.max(0, t.quantity_available - t.quantity_sold);
                const soldOut = remaining === 0;
                const count = qty[t.id] ?? 0;
                return (
                  <div
                    key={t.id}
                    className="rounded-xl border border-border bg-background/40 p-4 transition hover:border-primary/40"
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
                          {soldOut ? "Sold out" : `${remaining} left`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          disabled={count === 0 || soldOut}
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
                          disabled={soldOut}
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
              onClick={() => toast.info("Checkout is coming next — Paystack lands in the next stage.")}
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
