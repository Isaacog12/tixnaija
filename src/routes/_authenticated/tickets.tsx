import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Ticket as TicketIcon, Calendar, MapPin, QrCode, RefreshCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

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

// ── Refund Request Modal ──────────────────────────────────────────────────────

const REFUND_REASONS = [
  { value: "cancelled", label: "Event was cancelled by organizer" },
  { value: "postponed", label: "Event was postponed and I can't attend the new date" },
  { value: "other", label: "Other reason" },
] as const;

type RefundReason = (typeof REFUND_REASONS)[number]["value"];

interface RefundModalProps {
  open: boolean;
  onClose: () => void;
  event: {
    id: string;
    title: string;
    status: string;
  };
  ticketId: string;
  buyerEmail: string;
  buyerName?: string;
}

function RefundRequestModal({ open, onClose, event, ticketId, buyerEmail, buyerName }: RefundModalProps) {
  const [reason, setReason] = useState<RefundReason | "">("");
  const [otherText, setOtherText] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!reason) throw new Error("Please select a reason.");
      if (reason === "other" && !otherText.trim()) throw new Error("Please describe your reason.");

      const { error } = await supabase.from("refund_requests" as any).insert({
        ticket_id: ticketId,
        event_id: event.id,
        buyer_email: buyerEmail,
        buyer_name: buyerName ?? null,
        reason,
        other_reason: reason === "other" ? otherText.trim() : null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Refund request submitted. We'll be in touch within 2 business days.");
      setReason("");
      setOtherText("");
      onClose();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to submit request. Please try again.");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Request a Refund</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            For <span className="font-medium text-foreground">{event.title}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 space-y-5">
          {/* Reason selector */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Reason for refund request</Label>
            <div className="space-y-2">
              {REFUND_REASONS.map((r) => (
                <label
                  key={r.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-sm transition-colors ${
                    reason === r.value
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border bg-card/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                    className="mt-0.5 accent-primary"
                  />
                  <span className="leading-relaxed">{r.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Free-text for 'other' */}
          {reason === "other" && (
            <div className="space-y-2">
              <Label htmlFor="other-reason" className="text-sm font-medium">
                Please describe your reason
              </Label>
              <Textarea
                id="other-reason"
                rows={3}
                placeholder="Tell us more about why you need a refund…"
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                className="resize-none text-sm"
                maxLength={500}
              />
              <p className="text-right text-xs text-muted-foreground">{otherText.length}/500</p>
            </div>
          )}

          {/* Info note */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-muted-foreground">
            Refund requests are reviewed by the organizer and TixNaija within{" "}
            <strong className="text-foreground">2 business days</strong>. Approved refunds
            are returned to your original payment method within 3–7 days.
          </div>

          <div className="flex gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 gradient-sunset text-primary-foreground shadow-glow hover:opacity-90"
              disabled={mutation.isPending || !reason}
            >
              {mutation.isPending ? "Submitting…" : "Submit request"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

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

// ── Event List ────────────────────────────────────────────────────────────────

function EventList({ events, emptyMessage, type }: { events: any[]; emptyMessage: string; type: "upcoming" | "live" | "past" }) {
  const [refundTarget, setRefundTarget] = useState<{ event: any; ticketId: string } | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [userName, setUserName] = useState<string>("");

  // Fetch current user email once
  useState(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? "");
      setUserName(data.user?.user_metadata?.full_name ?? "");
    });
  });

  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <>
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
              {ev.status === 'postponed' && (
                <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
                  <Badge className="text-sm px-3 py-1 bg-amber-500 text-white border-0">Postponed</Badge>
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

                {/* Refund button — show when event is cancelled, postponed, or upcoming (allow other reasons) */}
                {(ev.status === "cancelled" || ev.status === "postponed" || type === "upcoming") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs gap-1.5"
                    onClick={() =>
                      setRefundTarget({ event: ev, ticketId: ev.tickets[0]?.id })
                    }
                  >
                    <RefreshCcw className="h-3.5 w-3.5" />
                    Request Refund
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Refund Modal */}
      {refundTarget && (
        <RefundRequestModal
          open={!!refundTarget}
          onClose={() => setRefundTarget(null)}
          event={refundTarget.event}
          ticketId={refundTarget.ticketId}
          buyerEmail={userEmail}
          buyerName={userName}
        />
      )}
    </>
  );
}
