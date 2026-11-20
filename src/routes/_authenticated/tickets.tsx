import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { formatNaira } from "@/lib/currency";
import { BackButton } from "@/components/back-button";
import {
  Ticket as TicketIcon,
  Calendar,
  MapPin,
  QrCode,
  RefreshCcw,
  Frown,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Edit2,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TicketStub } from "@/components/ticket-stub";
import { toast } from "@/lib/toast";

export const Route = createFileRoute("/_authenticated/tickets")({
  component: TicketsPage,
});

export interface TicketRecord {
  id: string;
  ticket_code: string;
  status: string;
  attendee_name: string | null;
  attendee_email: string | null;
  created_at: string;
  checked_in_at: string | null;
  order_items: any;
}

export interface NormalizedTicket {
  id: string;
  ticket_code: string;
  status: string;
  attendee_name: string | null;
  attendee_email: string | null;
  created_at: string;
  checked_in_at: string | null;
  item: any;
  order: any;
  event: any;
  ticketType: any;
}

export interface EventGroup {
  id: string;
  title: string;
  slug: string;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  venue_name?: string | null;
  start_datetime: string;
  end_datetime?: string | null;
  cover_image_url?: string | null;
  status: string;
  description?: string | null;
  tickets: NormalizedTicket[];
  orders: Array<{
    id: string;
    created_at: string;
    total_kobo: number;
    status: string;
    ticketCount: number;
  }>;
  ticketTypeCounts: Record<string, number>;
}

function normalizeOrderItem(t: TicketRecord) {
  const item = Array.isArray(t.order_items) ? t.order_items[0] : t.order_items;
  const order = Array.isArray(item?.orders) ? item.orders[0] : item?.orders;
  const event = Array.isArray(order?.events) ? order.events[0] : order?.events;
  const ticketType = Array.isArray(item?.ticket_types) ? item.ticket_types[0] : item?.ticket_types;
  return { item, order, event, ticketType };
}

async function fetchMyTickets(): Promise<TicketRecord[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Not signed in");

  const { data: tickets, error } = await supabase
    .from("tickets")
    .select(`
      id,
      ticket_code,
      status,
      attendee_name,
      attendee_email,
      created_at,
      checked_in_at,
      order_items!inner(
        id,
        order_id,
        quantity,
        unit_price_kobo,
        ticket_types(
          id,
          name,
          price_kobo,
          description
        ),
        orders!inner(
          id,
          user_id,
          buyer_name,
          buyer_email,
          total_kobo,
          status,
          created_at,
          access_code,
          events!inner(
            id,
            title,
            slug,
            city,
            state,
            address,
            venue_name,
            start_datetime,
            end_datetime,
            cover_image_url,
            status,
            description
          )
        )
      )
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (tickets || []) as unknown as TicketRecord[];
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
                  <span className={`leading-relaxed font-medium ${reason === r.value ? "text-foreground" : ""}`}>{r.label}</span>
                </label>
              ))}
            </div>
          </div>

          {reason === "other" && (
            <div className="space-y-3 overflow-hidden">
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

interface SupportCaseModalProps {
  open: boolean;
  onClose: () => void;
  event: {
    id: string;
    title: string;
  };
  orderId?: string;
}

function SupportCaseModal({ open, onClose, event, orderId }: SupportCaseModalProps) {
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<"missing_ticket" | "payment" | "refund" | "event_inquiry" | "other">("missing_ticket");
  const [description, setDescription] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!subject.trim()) throw new Error("Please enter a subject.");
      if (!description.trim() || description.trim().length < 5) throw new Error("Please describe your issue in detail.");

      const { data, error } = await (supabase.rpc as any)("open_support_case", {
        p_subject: subject.trim(),
        p_category: category,
        p_description: description.trim(),
        p_order_id: orderId || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(`Support case opened! Reference: ${data?.case_number || "Submitted"}. Our care team will reply shortly.`);
      setSubject("");
      setDescription("");
      onClose();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to open support case. Please try again.");
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md rounded-[2rem] p-6 border-border/50 shadow-2xl">
        <DialogHeader className="mb-2">
          <DialogTitle className="font-display text-2xl tracking-tight">Need Help with Your Order?</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            Open a support inquiry for <span className="font-medium text-foreground">{event.title}</span>. Our care team will respond directly.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Category</Label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full h-11 px-3 rounded-xl border border-border/60 bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="missing_ticket">Missing Ticket / Resend Issue</option>
              <option value="payment">Payment / Bank Transfer Issue</option>
              <option value="event_inquiry">Event Schedule / Venue Question</option>
              <option value="other">Other Inquiry</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Subject</Label>
            <input
              type="text"
              placeholder="e.g. Need ticket sent to another email"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={150}
              className="w-full h-11 px-3 rounded-xl border border-border/60 bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Message Details</Label>
            <Textarea
              placeholder="Please describe how we can assist you..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="rounded-xl text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              {mutation.isPending ? "Submitting..." : "Send to Support"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface ReassignModalProps {
  open: boolean;
  onClose: () => void;
  ticket: NormalizedTicket | null;
  onSuccess: () => void;
}

function ReassignTicketModal({ open, onClose, ticket, onSuccess }: ReassignModalProps) {
  const [attendeeName, setAttendeeName] = useState("");
  const [attendeeEmail, setAttendeeEmail] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Sync state when ticket changes
  useState(() => {
    if (ticket) {
      setAttendeeName(ticket.attendee_name || "");
      setAttendeeEmail(ticket.attendee_email || "");
    }
  });

  const handleOpenChange = (v: boolean) => {
    if (v && ticket) {
      setAttendeeName(ticket.attendee_name || "");
      setAttendeeEmail(ticket.attendee_email || "");
    }
    if (!v) onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase.rpc("update_ticket_attendee", {
        p_ticket_id: ticket.id,
        p_attendee_name: attendeeName.trim(),
        p_attendee_email: attendeeEmail.trim().toLowerCase(),
      });

      if (error) throw error;

      toast.success("Ticket reassigned! Attendee details updated successfully.");
      
      // Resend confirmation to new email. functions.invoke() resolves with
      // { error } on non-2xx, so it must be checked explicitly.
      const { error: emailError } = await supabase.functions.invoke("send-ticket-confirmation", {
        body: { orderId: ticket.order?.id, ticketId: ticket.id },
      });
      if (emailError) {
        console.error("Failed to email the reassigned ticket", emailError);
        toast.error("Ticket reassigned, but the confirmation email could not be sent.");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to update attendee.");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md rounded-[2rem] p-6 border-border/50 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl tracking-tight">Reassign Ticket</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            Update the attendee details for Ticket #{ticket?.ticket_code?.slice(0, 8) || "Pass"}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="attendee-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Attendee Full Name
            </Label>
            <Input
              id="attendee-name"
              required
              value={attendeeName}
              onChange={(e) => setAttendeeName(e.target.value)}
              placeholder="e.g. Chioma Adeyemi"
              className="h-11 rounded-xl bg-background text-foreground"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="attendee-email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Attendee Email Address
            </Label>
            <Input
              id="attendee-email"
              type="email"
              required
              value={attendeeEmail}
              onChange={(e) => setAttendeeEmail(e.target.value)}
              placeholder="e.g. chioma@example.com"
              className="h-11 rounded-xl bg-background text-foreground"
            />
          </div>

          <DialogFooter className="pt-4 flex gap-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={isUpdating} className="rounded-xl h-11 flex-1">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isUpdating}
              className="rounded-xl h-11 flex-1 gradient-sunset text-primary-foreground font-semibold shadow-md"
            >
              {isUpdating ? "Saving…" : "Save & Reassign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface EventTicketsModalProps {
  open: boolean;
  onClose: () => void;
  event: EventGroup | null;
  initialTicketIndex?: number;
  onReassign: (ticket: NormalizedTicket) => void;
}

function EventTicketsModal({ open, onClose, event, initialTicketIndex = 0, onReassign }: EventTicketsModalProps) {
  const [selectedIndex, setSelectedIndex] = useState(initialTicketIndex);

  // Keep selected index in bounds when event changes
  const activeIndex = event && event.tickets[selectedIndex] ? selectedIndex : 0;
  const activeTicket = event?.tickets[activeIndex] || null;

  if (!event || !activeTicket) return null;

  const totalTickets = event.tickets.length;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto rounded-[2.5rem] p-4 sm:p-6 md:p-8 border-border/60 shadow-2xl bg-card/95 backdrop-blur-2xl">
        <DialogHeader className="mb-4 text-left">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-3.5 py-1 text-xs font-bold text-primary tracking-wider uppercase">
              <TicketIcon className="h-3.5 w-3.5" />
              {totalTickets} {totalTickets === 1 ? "Ticket Pass" : "Ticket Passes"}
            </div>
            {event.orders.length > 1 && (
              <Badge variant="outline" className="rounded-full text-xs font-medium text-muted-foreground">
                Purchased in {event.orders.length} orders
              </Badge>
            )}
          </div>
          <DialogTitle className="font-display text-2xl sm:text-3xl tracking-tight text-foreground">
            {event.title}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground flex items-center gap-2 pt-1">
            <Calendar className="h-4 w-4 text-primary shrink-0" />
            <span>
              {new Date(event.start_datetime).toLocaleString("en-NG", {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
            {event.venue_name && (
              <>
                <span>•</span>
                <span className="truncate">{event.venue_name}</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Multi-Ticket Selector Strip */}
        {totalTickets > 1 && (
          <div className="mb-6">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1 flex items-center justify-between">
              <span>Select Ticket ({activeIndex + 1} of {totalTickets})</span>
              <span className="text-primary font-bold">Pass {activeIndex + 1}/{totalTickets}</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
              {event.tickets.map((t, idx) => {
                const isSelected = idx === activeIndex;
                const tierName = t.ticketType?.name || "General";
                const isCheckedIn = t.status === "checked_in";
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedIndex(idx)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold whitespace-nowrap transition-all duration-200 border ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20 scale-[1.02]"
                        : "bg-secondary/60 hover:bg-secondary text-foreground/80 border-border/50 hover:border-border"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full shrink-0 ${isCheckedIn ? "bg-emerald-400" : isSelected ? "bg-white" : "bg-primary"}`} />
                    <span>Pass {idx + 1}: {tierName}</span>
                    <span className="opacity-70 font-mono text-[11px] truncate max-w-[90px]">
                      • {t.attendee_name || "Guest"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Active Ticket Stub Pass */}
        <div className="my-2">
          <TicketStub
            ticket={activeTicket}
            event={event}
            order={activeTicket.order}
            ticketType={activeTicket.ticketType}
          />
        </div>

        {/* Ticket Actions & Details */}
        <div className="mt-4 pt-4 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
            <span>
              Ticket Status:{" "}
              <strong className="text-foreground capitalize">{activeTicket.status.replace("_", " ")}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onReassign(activeTicket)}
              className="rounded-xl flex-1 sm:flex-none border-border/60 hover:bg-secondary text-xs h-9"
            >
              <Edit2 className="h-3.5 w-3.5 mr-1.5" /> Reassign Attendee
            </Button>
            {activeTicket.order?.id && (
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="rounded-xl flex-1 sm:flex-none text-xs text-muted-foreground hover:text-foreground h-9"
              >
                <Link to="/orders/$orderId/tickets" params={{ orderId: activeTicket.order.id }}>
                  Order #{activeTicket.order.id.slice(0, 8)} <ExternalLink className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Multiple Orders Footer Callout */}
        {event.orders.length > 1 && (
          <div className="mt-4 rounded-2xl bg-secondary/30 border border-border/40 p-3.5 text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1.5">Purchased across {event.orders.length} orders:</p>
            <div className="flex flex-wrap gap-2">
              {event.orders.map((o) => (
                <Link
                  key={o.id}
                  to="/orders/$orderId/tickets"
                  params={{ orderId: o.id }}
                  className="inline-flex items-center gap-1 font-mono text-[11px] bg-background/80 hover:bg-background border border-border/60 px-2.5 py-1 rounded-lg text-foreground hover:border-primary/50 transition-colors"
                >
                  Order #{o.id.slice(0, 8)} ({o.ticketCount} {o.ticketCount === 1 ? "ticket" : "tickets"}) <ArrowUpRight className="h-3 w-3" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const STAGGER_MS = 80;

function TicketsPage() {
  const queryClient = useQueryClient();
  const { data: rawTickets, isLoading, error } = useQuery({
    queryKey: ["my-tickets"],
    queryFn: fetchMyTickets,
  });

  const now = new Date();
  
  // Group all tickets comprehensively by event
  const eventsMap = new Map<string, EventGroup>();
  
  if (rawTickets) {
    for (const t of rawTickets) {
      const { item, order, event, ticketType } = normalizeOrderItem(t);
      if (!event || !event.id) continue;

      if (!eventsMap.has(event.id)) {
        eventsMap.set(event.id, {
          ...event,
          tickets: [],
          orders: [],
          ticketTypeCounts: {},
        });
      }

      const group = eventsMap.get(event.id)!;
      group.tickets.push({
        ...t,
        item,
        order,
        event,
        ticketType,
      });

      // Track distinct orders
      if (order && order.id) {
        const existingOrder = group.orders.find((o) => o.id === order.id);
        if (existingOrder) {
          existingOrder.ticketCount += 1;
        } else {
          group.orders.push({
            id: order.id,
            created_at: order.created_at,
            total_kobo: order.total_kobo || 0,
            status: order.status,
            ticketCount: 1,
          });
        }
      }

      const typeName = ticketType?.name || "General Admission";
      group.ticketTypeCounts[typeName] = (group.ticketTypeCounts[typeName] || 0) + 1;
    }
  }

  const events = Array.from(eventsMap.values());
  const upcoming: EventGroup[] = [];
  const live: EventGroup[] = [];
  const past: EventGroup[] = [];

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

  const handleTicketsRefetch = () => {
    queryClient.invalidateQueries({ queryKey: ["my-tickets"] });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:py-20 min-h-dvh">
      <div className="mb-12">
        <div className="flex items-center gap-4 mb-4">
          <BackButton />
          <h1 className="font-display text-5xl md:text-6xl tracking-tight">Your Tickets</h1>
        </div>
        <p className="text-muted-foreground text-lg max-w-2xl">
          Manage your purchased tickets and passes. Every ticket you own is ready to scan, share, or download offline.
        </p>
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
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center text-destructive max-w-2xl mx-auto">
          <Frown className="h-10 w-10 mx-auto mb-4 opacity-50" />
          <h3 className="font-medium text-lg mb-1">Failed to load tickets</h3>
          <p className="text-destructive/80">{(error as Error).message}</p>
        </div>
      )}

      {rawTickets && rawTickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-border/60 bg-card/30 p-16 md:p-24 text-center rounded-[2.5rem] mt-8 shadow-sm max-w-3xl mx-auto backdrop-blur-sm stagger-card-in">
          <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-secondary/50 relative">
            <div className="absolute inset-0 bg-primary/10 rounded-full animate-ping opacity-20" />
            <TicketIcon className="h-12 w-12 text-muted-foreground/50" />
          </div>
          <h3 className="font-display text-4xl mb-4 text-foreground">Your ticket stash is empty. Let's fix that.</h3>
          <p className="text-muted-foreground text-lg max-w-md mx-auto mb-10 leading-relaxed">
            You haven't purchased any tickets. Discover amazing concerts, comedy shows, and parties happening near you.
          </p>
          <Button asChild size="lg" className="rounded-full h-14 px-10 gradient-sunset text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all font-semibold text-lg">
            <Link to="/browse">Explore events</Link>
          </Button>
        </div>
      ) : (
        rawTickets && (
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
                <EventList events={upcoming} emptyMessage="You don't have any upcoming events right now." type="upcoming" onRefetch={handleTicketsRefetch} />
              </TabsContent>
              
              <TabsContent value="live" className="mt-0 outline-none">
                <EventList events={live} emptyMessage="There are no events happening right now." type="live" onRefetch={handleTicketsRefetch} />
              </TabsContent>
              
              <TabsContent value="past" className="mt-0 outline-none">
                <EventList events={past} emptyMessage="No past events in your history." type="past" onRefetch={handleTicketsRefetch} />
              </TabsContent>
            </Tabs>
          </div>
        )
      )}
    </div>
  );
}

function EventList({
  events,
  emptyMessage,
  type,
  onRefetch,
}: {
  events: EventGroup[];
  emptyMessage: string;
  type: "upcoming" | "live" | "past";
  onRefetch: () => void;
}) {
  const [modalTarget, setModalTarget] = useState<{ event: EventGroup; initialIndex: number } | null>(null);
  const [reassignTarget, setReassignTarget] = useState<NormalizedTicket | null>(null);
  const [refundTarget, setRefundTarget] = useState<{ event: any; ticketId: string } | null>(null);
  const [supportTarget, setSupportTarget] = useState<{ event: any; orderId?: string } | null>(null);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const [userEmail, setUserEmail] = useState<string>("");
  const [userName, setUserName] = useState<string>("");

  useState(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? "");
      setUserName(data.user?.user_metadata?.full_name ?? "");
    });
  });

  const toggleExpand = (eventId: string) => {
    setExpandedCards((prev) => ({ ...prev, [eventId]: !prev[eventId] }));
  };

  if (events.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border/60 bg-card/30 py-20 text-center text-lg text-muted-foreground font-medium stagger-card-in">
        {emptyMessage}
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:gap-8">
        {events.map((ev, i) => {
          const isExpanded = !!expandedCards[ev.id];
          const ticketCount = ev.tickets.length;
          const primaryOrderId = ev.orders[0]?.id || "";

          return (
            <div
              key={ev.id}
              className="group relative flex flex-col overflow-hidden rounded-[2rem] bg-card border border-border/60 shadow-sm transition-all duration-300 hover:shadow-2xl hover:shadow-primary/10 hover:border-primary/30 stagger-card-in"
              style={{ animationDelay: `${i * STAGGER_MS}ms` }}
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
                {ev.cover_image_url ? (
                  <img
                    src={ev.cover_image_url}
                    alt={ev.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20" />
                )}
                
                {ev.status === "cancelled" && (
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center z-20">
                    <Badge variant="destructive" className="text-base px-6 py-2 uppercase tracking-widest font-bold shadow-xl border-0">
                      Cancelled
                    </Badge>
                  </div>
                )}
                {ev.status === "postponed" && (
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center z-20">
                    <Badge className="text-base px-6 py-2 bg-amber-500 text-white uppercase tracking-widest font-bold shadow-xl border-0">
                      Postponed
                    </Badge>
                  </div>
                )}
                
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-30 group-hover:opacity-70 transition-opacity duration-300 z-10" />
                
                <div className="absolute left-4 top-4 flex flex-wrap gap-2 z-20">
                  {ev.city && (
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-background/95 px-3 py-1.5 text-xs font-bold text-foreground shadow-sm backdrop-blur-md border border-border/50 uppercase tracking-wider">
                      <MapPin className="h-3 w-3 text-primary" />
                      {ev.city}
                    </div>
                  )}
                  {type === "live" && ev.status !== "cancelled" && (
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

                {/* Top Right: Ticket Count Chip */}
                <div className="absolute right-4 top-4 z-20">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-background/95 px-3.5 py-1.5 text-xs font-bold text-foreground shadow-md backdrop-blur-md border border-border/60">
                    <TicketIcon className="h-3.5 w-3.5 text-primary" />
                    <span>{ticketCount} {ticketCount === 1 ? "Ticket" : "Tickets"}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-1 flex-col p-6 lg:p-7 bg-card/80 backdrop-blur-sm z-20 relative -mt-4 rounded-t-3xl border-t border-white/5">
                <div className="mb-2.5 flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
                  <Calendar className="h-4 w-4" />
                  {new Date(ev.start_datetime).toLocaleString("en-NG", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </div>
                
                <h3 className="font-display text-2xl lg:text-3xl leading-tight group-hover:text-primary transition-colors line-clamp-2 mb-2">
                  {ev.title}
                </h3>
                
                {ev.venue_name && (
                  <p className="text-sm text-muted-foreground font-medium line-clamp-1 mb-4">
                    {ev.venue_name}
                  </p>
                )}

                {/* Tier and Order Pills */}
                <div className="flex flex-wrap items-center gap-1.5 mb-6">
                  {Object.entries(ev.ticketTypeCounts).map(([tier, count]) => (
                    <span
                      key={tier}
                      className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground"
                    >
                      {tier} × {count}
                    </span>
                  ))}
                  {ev.orders.length > 1 && (
                    <span className="inline-flex items-center rounded-full border border-border/60 bg-background/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {ev.orders.length} orders
                    </span>
                  )}
                  {ev.tickets.some((t) => !t.attendee_name) && (
                    <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600">
                      Unassigned attendee
                    </span>
                  )}
                </div>

                {/* Inline Collapsible List for multiple tickets */}
                {ticketCount > 1 && (
                  <div className="mb-4">
                    <button
                      type="button"
                      onClick={() => toggleExpand(ev.id)}
                      className="flex items-center justify-between w-full py-2 px-3 rounded-xl bg-secondary/40 hover:bg-secondary/70 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <TicketIcon className="h-3.5 w-3.5 text-primary" />
                        {isExpanded ? "Hide individual tickets" : `View all ${ticketCount} tickets breakdown`}
                      </span>
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>

                    {isExpanded && (
                      <div className="mt-2.5 space-y-2 max-h-56 overflow-y-auto pr-1 no-scrollbar animate-in fade-in-50 duration-200">
                        {ev.tickets.map((t, idx) => {
                          const tierName = t.ticketType?.name || "General";
                          const isCheckedIn = t.status === "checked_in";
                          return (
                            <div
                              key={t.id}
                              className="flex items-center justify-between p-2.5 rounded-xl border border-border/50 bg-background/60 text-xs hover:border-primary/40 transition-colors"
                            >
                              <div className="min-w-0 pr-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-foreground">Pass {idx + 1}: {tierName}</span>
                                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${isCheckedIn ? "bg-emerald-500/10 text-emerald-600" : "bg-primary/10 text-primary"}`}>
                                    {isCheckedIn ? "Checked in" : "Valid"}
                                  </span>
                                </div>
                                <p className="text-muted-foreground truncate text-[11px] mt-0.5">
                                  {t.attendee_name || "Guest"} • Code: {t.ticket_code?.slice(0, 8)}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setModalTarget({ event: ev, initialIndex: idx })}
                                className="h-7 px-2.5 text-[11px] rounded-lg shrink-0 gap-1 border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground"
                              >
                                <QrCode className="h-3 w-3" /> View Pass
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Footer Buttons */}
                <div className="mt-auto pt-4 flex flex-col gap-2.5 border-t border-border/60">
                  <Button
                    onClick={() => setModalTarget({ event: ev, initialIndex: 0 })}
                    className="w-full justify-between h-12 rounded-xl gradient-sunset text-primary-foreground font-semibold shadow-md hover:shadow-lg transition-all"
                  >
                    <span className="flex items-center gap-2">
                      <QrCode className="h-5 w-5" />
                      <span>{ticketCount > 1 ? `View All ${ticketCount} Tickets` : "View Ticket Pass"}</span>
                    </span>
                    <span className="text-xs bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full font-bold">
                      {ticketCount} {ticketCount === 1 ? "Pass" : "Passes"}
                    </span>
                  </Button>

                  {(ev.status === "cancelled" || ev.status === "postponed" || type === "upcoming") && (
                    <Button
                      variant="ghost"
                      className="w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs gap-2 font-medium h-9 rounded-xl"
                      onClick={() =>
                        setRefundTarget({ event: ev, ticketId: ev.tickets[0]?.id })
                      }
                    >
                      <RefreshCcw className="h-3.5 w-3.5" />
                      Request Refund
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    className="w-full text-muted-foreground hover:text-foreground text-xs gap-2 font-medium h-9 rounded-xl"
                    onClick={() =>
                      setSupportTarget({ event: ev, orderId: primaryOrderId })
                    }
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                    Need Help with Order?
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Apple-style Full Ticket Passes Modal */}
      {modalTarget && (
        <EventTicketsModal
          open={!!modalTarget}
          onClose={() => setModalTarget(null)}
          event={modalTarget.event}
          initialTicketIndex={modalTarget.initialIndex}
          onReassign={(ticket) => setReassignTarget(ticket)}
        />
      )}

      {/* Reassign Attendee Modal */}
      {reassignTarget && (
        <ReassignTicketModal
          open={!!reassignTarget}
          onClose={() => setReassignTarget(null)}
          ticket={reassignTarget}
          onSuccess={onRefetch}
        />
      )}

      {/* Refund Request Modal */}
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

      {/* Support Case Modal */}
      {supportTarget && (
        <SupportCaseModal
          open={!!supportTarget}
          onClose={() => setSupportTarget(null)}
          event={supportTarget.event}
          orderId={supportTarget.orderId}
        />
      )}
    </>
  );
}
