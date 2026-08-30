import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Ticket as TicketIcon, Calendar, MapPin, QrCode, RefreshCcw, Frown } from "lucide-react";
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
      <DialogContent className="sm:max-w-md rounded-[2rem] p-6 border-border/50 shadow-2xl">
        <DialogHeader className="mb-4">
          <DialogTitle className="font-display text-2xl tracking-tight">Request a Refund</DialogTitle>
          <DialogDescription className="text-base text-muted-foreground mt-2">
            For <span className="font-medium text-foreground">{event.title}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3">
            <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Reason for refund request</Label>
            <div className="space-y-3">
              {REFUND_REASONS.map((r) => (
                <label
                  key={r.value}
                  className={`flex cursor-pointer items-start gap-4 rounded-2xl border p-4 text-sm transition-all duration-200 ${
                    reason === r.value
                      ? "border-primary bg-primary/5 text-primary shadow-sm"
                      : "border-border/60 bg-card/40 text-muted-foreground hover:border-border hover:bg-secondary/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                    className="mt-1 h-4 w-4 accent-primary"
                  />
                  <span className={`leading-relaxed font-medium ${reason === r.value ? 'text-foreground' : ''}`}>{r.label}</span>
                </label>
              ))}
            </div>
          </div>

          
            {reason === "other" && (
              <div 
                
                
                
                className="space-y-3 overflow-hidden"
              >
                <Label htmlFor="other-reason" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Please describe your reason
                </Label>
                <Textarea
                  id="other-reason"
                  rows={4}
                  placeholder="Tell us more about why you need a refund…"
                  value={otherText}
                  onChange={(e) => setOtherText(e.target.value)}
                  className="resize-none text-base rounded-xl border-border/60 focus-visible:ring-primary/20 bg-background/50"
                  maxLength={500}
                />
                <p className="text-right text-xs text-muted-foreground font-medium">{otherText.length}/500</p>
              </div>
            )}
          

          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-600/90 leading-relaxed font-medium">
            Refund requests are reviewed by the organizer and TixNaija within{" "}
            <strong className="text-amber-600">2 business days</strong>. Approved refunds
            are returned to your original payment method within 3–7 days.
          </div>

          <div className="flex gap-4 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-xl h-12 font-medium border-border/60 hover:bg-secondary text-base"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 rounded-xl h-12 gradient-sunset text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-primary/40 font-semibold text-base transition-all"
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

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const cardVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  show: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

function TicketsPage() {
  const { data: tickets, isLoading, error } = useQuery({
    queryKey: ["my-tickets"],
    queryFn: fetchMyTickets,
  });

  const now = new Date();
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

  upcoming.sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime());
  past.sort((a, b) => new Date(b.start_datetime).getTime() - new Date(a.start_datetime).getTime());
  live.sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime());

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:py-20 min-h-screen">
      <div 
        
        
        
        className="mb-12"
      >
        <h1 className="font-display text-5xl md:text-6xl tracking-tight mb-4">Your Tickets</h1>
        <p className="text-muted-foreground text-lg max-w-2xl">Manage your purchased tickets and passes. Get ready for your next unforgettable experience.</p>
      </div>

      {isLoading && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-8">
           {[1, 2, 3].map((i) => (
             <div key={i} className="animate-pulse rounded-[2rem] bg-card border border-border/40 overflow-hidden shadow-sm h-[380px]">
               <div className="h-48 bg-muted/60 relative overflow-hidden">
                 <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-background/20 to-transparent" />
               </div>
               <div className="p-6 space-y-4">
                 <div className="h-5 w-2/3 bg-muted/80 rounded-md" />
                 <div className="h-4 w-1/3 bg-muted/80 rounded-md" />
                 <div className="pt-4 mt-4 border-t border-border/40">
                   <div className="h-12 w-full bg-muted/80 rounded-xl" />
                 </div>
               </div>
             </div>
           ))}
        </div>
      )}

      {error && (
        <div 
           
           
          className="rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center text-destructive max-w-2xl mx-auto"
        >
          <Frown className="h-10 w-10 mx-auto mb-4 opacity-50" />
          <h3 className="font-medium text-lg mb-1">Failed to load tickets</h3>
          <p className="text-destructive/80">{(error as Error).message}</p>
        </div>
      )}

      {tickets && tickets.length === 0 ? (
        <div 
          
          
          className="flex flex-col items-center justify-center border border-dashed border-border/60 bg-card/30 p-16 md:p-24 text-center rounded-[2.5rem] mt-8 shadow-sm max-w-3xl mx-auto backdrop-blur-sm"
        >
          <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-secondary/50 relative">
            <div className="absolute inset-0 bg-primary/10 rounded-full animate-ping opacity-20" />
            <TicketIcon className="h-12 w-12 text-muted-foreground/50" />
          </div>
          <h3 className="font-display text-4xl mb-4 text-foreground">No tickets yet</h3>
          <p className="text-muted-foreground text-lg max-w-md mx-auto mb-10 leading-relaxed">
            You haven't purchased any tickets. Discover amazing concerts, comedy shows, and parties happening near you.
          </p>
          <Button asChild size="lg" className="rounded-full h-14 px-10 gradient-sunset text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all font-semibold text-lg">
            <Link to="/browse">Explore events</Link>
          </Button>
        </div>
      ) : (
        tickets && (
          <div>
            <Tabs defaultValue={live.length > 0 ? "live" : upcoming.length > 0 ? "upcoming" : "past"} className="w-full mt-2">
              <TabsList className="mb-10 inline-flex h-14 items-center justify-center rounded-full bg-secondary/50 p-1.5 text-muted-foreground border border-border/40 shadow-inner overflow-x-auto overflow-y-hidden max-w-full no-scrollbar">
                <TabsTrigger value="upcoming" className="rounded-full px-6 py-2.5 text-base font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md transition-all">
                  Upcoming ({upcoming.length})
                </TabsTrigger>
                <TabsTrigger value="live" className="rounded-full px-6 py-2.5 text-base font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md transition-all">
                  Live ({live.length})
                </TabsTrigger>
                <TabsTrigger value="past" className="rounded-full px-6 py-2.5 text-base font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md transition-all">
                  Past ({past.length})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="upcoming" className="mt-0 outline-none">
                <EventList events={upcoming} emptyMessage="You don't have any upcoming events right now." type="upcoming" />
              </TabsContent>
              
              <TabsContent value="live" className="mt-0 outline-none">
                <EventList events={live} emptyMessage="There are no events happening right now." type="live" />
              </TabsContent>
              
              <TabsContent value="past" className="mt-0 outline-none">
                <EventList events={past} emptyMessage="No past events in your history." type="past" />
              </TabsContent>
            </Tabs>
          </div>
        )
      )}
    </div>
  );
}

function EventList({ events, emptyMessage, type }: { events: any[]; emptyMessage: string; type: "upcoming" | "live" | "past" }) {
  const [refundTarget, setRefundTarget] = useState<{ event: any; ticketId: string } | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [userName, setUserName] = useState<string>("");

  useState(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? "");
      setUserName(data.user?.user_metadata?.full_name ?? "");
    });
  });

  if (events.length === 0) {
    return (
      <div 
         
        className="rounded-3xl border border-dashed border-border/60 bg-card/30 py-20 text-center text-lg text-muted-foreground font-medium"
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <>
      <div 
        
        initial="hidden"
        animate="show"
        className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:gap-8"
      >
        {events.map((ev) => (
          <div
            
            key={ev.id}
            className="group relative flex flex-col overflow-hidden rounded-[2rem] bg-card border border-border/60 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary/10 hover:border-primary/30"
          >
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
              {ev.cover_image_url ? (
                <img
                  src={ev.cover_image_url}
                  alt={ev.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-purple-500/20" />
              )}
              
              {ev.status === 'cancelled' && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center z-20">
                  <Badge variant="destructive" className="text-base px-6 py-2 uppercase tracking-widest font-bold shadow-xl border-0">Cancelled</Badge>
                </div>
              )}
              {ev.status === 'postponed' && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center z-20">
                  <Badge className="text-base px-6 py-2 bg-amber-500 text-white uppercase tracking-widest font-bold shadow-xl border-0">Postponed</Badge>
                </div>
              )}
              
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-30 group-hover:opacity-70 transition-opacity duration-300 z-10" />
              
              <div className="absolute left-4 top-4 flex gap-2 z-20">
                {ev.city && (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-background/95 px-3 py-1.5 text-xs font-bold text-foreground shadow-sm backdrop-blur-md border border-border/50 uppercase tracking-wider">
                    <MapPin className="h-3 w-3 text-primary" />
                    {ev.city}
                  </div>
                )}
                {type === "live" && ev.status !== 'cancelled' && (
                  <div className="inline-flex items-center gap-2 rounded-full bg-green-500 px-3 py-1.5 text-xs font-bold text-white shadow-lg shadow-green-500/30 uppercase tracking-wider">
                    <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                    Live now
                  </div>
                )}
                {type === "past" && (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-background/95 px-3 py-1.5 text-xs font-bold text-muted-foreground shadow-sm backdrop-blur-md border border-border/50 uppercase tracking-wider">
                    Ended
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex flex-1 flex-col p-6 lg:p-8 bg-card/80 backdrop-blur-sm z-20 relative -mt-4 rounded-t-3xl border-t border-white/5">
              <div className="mb-3 flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
                <Calendar className="h-4 w-4" />
                {new Date(ev.start_datetime).toLocaleString("en-NG", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit"
                })}
              </div>
              
              <h3 className="font-display text-2xl lg:text-3xl leading-tight group-hover:text-primary transition-colors line-clamp-2 mb-3">
                {ev.title}
              </h3>
              
              {ev.venue_name && (
                <p className="text-sm text-muted-foreground font-medium line-clamp-1 mb-6">
                  {ev.venue_name}
                </p>
              )}
              
              <div className="mt-auto pt-6 flex flex-col gap-3 border-t border-border/60">
                <div className="text-sm text-muted-foreground flex justify-between items-center font-bold uppercase tracking-wider">
                  <span>Admit: {ev.tickets.length} {ev.tickets.length !== 1 ? 'tickets' : 'ticket'}</span>
                </div>
                <Button asChild className="w-full justify-between h-12 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground font-semibold transition-all shadow-none mt-2">
                  <Link to="/e/$slug" params={{ slug: ev.slug }}>
                    View Tickets <QrCode className="h-5 w-5 ml-2" />
                  </Link>
                </Button>

                {(ev.status === "cancelled" || ev.status === "postponed" || type === "upcoming") && (
                  <Button
                    variant="ghost"
                    className="w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-sm gap-2 font-medium h-10 mt-1 rounded-xl"
                    onClick={() =>
                      setRefundTarget({ event: ev, ticketId: ev.tickets[0]?.id })
                    }
                  >
                    <RefreshCcw className="h-4 w-4" />
                    Request Refund
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      
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
