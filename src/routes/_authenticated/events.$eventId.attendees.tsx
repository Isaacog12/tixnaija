import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { Ticket, ArrowLeft, XCircle, Search, ShieldAlert, CheckCircle, Mail } from "lucide-react";
import { toast } from "sonner";
import { BackButton } from "@/components/back-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { format } from "date-fns";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/events/$eventId/attendees")({
  beforeLoad: async ({ params: { eventId } }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/auth" });

    // Check if admin
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (adminRole) return;

    // Check if organizer
    const { data: event } = await supabase
      .from("events")
      .select("organizer_id")
      .eq("id", eventId)
      .maybeSingle();

    if (!event || (event as any).organizer_id !== session.user.id) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AttendeesPage,
});

function AttendeesPage() {
  const { eventId } = Route.useParams();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [cancellingTicket, setCancellingTicket] = useState<any>(null);
  const [editingTicket, setEditingTicket] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");

  const handleEditOpen = (ticket: any) => {
    setEditingTicket(ticket);
    setEditName(ticket.attendee_name || ticket.order_items.orders.buyer_name || "");
    setEditEmail(ticket.attendee_email || ticket.order_items.orders.buyer_email || "");
  };

  // Fetch event details
  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch tickets for this event
  const { data: tickets, isLoading: ticketsLoading } = useQuery({
    queryKey: ["event-tickets", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select(`
          *,
          order_items!inner (
            quantity,
            ticket_types ( name ),
            orders!inner (
              id,
              event_id,
              buyer_email,
              buyer_name,
              checkout_answers
            )
          )
        `)
        .eq("order_items.orders.event_id", eventId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Cancel ticket mutation
  const cancelTicketMutation = useMutation({
    mutationFn: async (ticketId: string) => {
      // @ts-ignore - Supabase type gen missing p_ticket_id
      const { error } = await supabase.rpc("cancel_ticket", { p_ticket_id: ticketId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ticket successfully cancelled.");
      qc.invalidateQueries({ queryKey: ["event-tickets", eventId] });
      setCancellingTicket(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to cancel ticket.");
    },
  });

  const updateTicketMutation = useMutation({
    mutationFn: async ({ ticketId, name, email }: { ticketId: string, name: string, email: string }) => {
      const { error } = await supabase.rpc("update_ticket_attendee" as any, {
        p_ticket_id: ticketId,
        p_attendee_name: name,
        p_attendee_email: email,
      });
      if (error) throw error;
      
      // We also trigger the edge function to re-send to the new email.
      // functions.invoke() resolves with { error } on non-2xx instead of
      // throwing, so the result has to be inspected explicitly.
      const ticket = filteredTickets?.find((t: any) => t.id === ticketId);
      if (ticket) {
        const { error: emailError } = await supabase.functions.invoke("send-ticket-confirmation", {
          body: { orderId: (ticket.order_items.orders as any).id, ticketId },
        });
        if (emailError) {
          console.error("Failed to email the updated ticket", emailError);
          toast.error("Ticket updated, but the confirmation email could not be sent.");
        }
      }
    },
    onSuccess: () => {
      toast.success("Ticket updated successfully!");
      qc.invalidateQueries({ queryKey: ["event-tickets", eventId] });
      setEditingTicket(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update ticket.");
    },
  });

  const filteredTickets = tickets?.filter((t: any) => {
    const q = search.toLowerCase();
    const name = (t.attendee_name || t.order_items.orders.buyer_name || "").toLowerCase();
    const email = (t.attendee_email || t.order_items.orders.buyer_email || "").toLowerCase();
    const code = t.ticket_code.split("-")[0].toLowerCase();
    return name.includes(q) || email.includes(q) || code.includes(q);
  });

  // Build a lookup: order_id -> { shortId, groupSize }
  const orderMeta = new Map<string, { shortId: string; groupSize: number }>();
  if (filteredTickets) {
    for (const t of filteredTickets as any[]) {
      const oid: string = t.order_items.orders.id;
      if (!orderMeta.has(oid)) {
        orderMeta.set(oid, {
          shortId: oid.split("-")[0].toUpperCase(),
          groupSize: t.order_items.quantity ?? 1,
        });
      }
    }
  }

  // Assign alternating stripe indices so consecutive tickets from the same order
  // share a tinted background that's distinct from the next order's rows.
  const orderStripeIndex = new Map<string, number>();
  let stripeCounter = 0;
  if (filteredTickets) {
    for (const t of filteredTickets as any[]) {
      const oid: string = t.order_items.orders.id;
      if (!orderStripeIndex.has(oid)) {
        orderStripeIndex.set(oid, stripeCounter++);
      }
    }
  }

  return (
    <div className="min-h-dvh bg-background">
      <section className="bg-card border-b border-border shadow-sm mb-8 pt-8 pb-8 relative overflow-hidden">
        <div className="absolute inset-0 z-0 bg-gradient-to-r from-primary/5 to-transparent opacity-50" />
        <div className="mx-auto max-w-7xl px-4 relative z-10">
          <div className="flex items-center gap-4 mb-2">
            <BackButton />
            <h1 className="font-display text-3xl md:text-4xl">Attendees</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            {(event as any)?.title ? `Manage attendees and tickets for ${(event as any).title}` : "Loading event..."}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 pb-32">
        <div className="flex flex-col sm:flex-row gap-4 justify-between mb-8">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or ticket code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <MassEmailDialog eventId={eventId} />
        </div>

        {ticketsLoading ? (
          <div className="text-center py-20 text-muted-foreground">Loading attendees...</div>
        ) : !filteredTickets || filteredTickets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-24 text-center">
            <Ticket className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-semibold">No attendees found</h3>
            <p className="text-sm text-muted-foreground">
              {search ? "No tickets matched your search." : "No attendees yet — check back once tickets start selling."}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-secondary/30 text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Attendee</th>
                    <th className="px-5 py-3 font-semibold">Code</th>
                    <th className="px-5 py-3 font-semibold">Tier</th>
                    <th className="px-5 py-3 font-semibold">Order</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Purchased</th>
                    <th className="px-5 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredTickets.map((t: any) => {
                    const name = t.attendee_name || t.order_items.orders.buyer_name || "Unknown";
                    const email = t.attendee_email || t.order_items.orders.buyer_email || "";
                    const tierName = t.order_items.ticket_types?.name || "General Admission";
                    const code = t.ticket_code.split("-")[0].toUpperCase();
                    const purchasedAt = format(new Date(t.created_at), "MMM d, yyyy");
                    const orderId: string = t.order_items.orders.id;
                    const meta = orderMeta.get(orderId);
                    const isGroup = (meta?.groupSize ?? 1) > 1;
                    const stripeIdx = orderStripeIndex.get(orderId) ?? 0;
                    const isStriped = stripeIdx % 2 === 1;

                    return (
                      <tr
                        key={t.id}
                        className={`transition-colors ${
                          isStriped ? "bg-muted/20 hover:bg-muted/40" : "hover:bg-muted/30"
                        }`}
                      >
                        <td className="px-5 py-4">
                          <p className="font-medium">{name}</p>
                          <p className="text-xs text-muted-foreground">{email}</p>
                        </td>
                        <td className="px-5 py-4 font-mono text-xs tracking-wider">{code}</td>
                        <td className="px-5 py-4">{tierName}</td>
                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-1">
                            <span className="font-mono text-xs text-muted-foreground">
                              {meta?.shortId ?? orderId.split("-")[0].toUpperCase()}
                            </span>
                            {isGroup && (
                              <span className="inline-flex w-fit items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                                Group of {meta?.groupSize}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          {t.status === "valid" ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2 py-1 text-xs font-medium text-green-500">
                              <CheckCircle className="h-3.5 w-3.5" /> Valid
                            </span>
                          ) : t.status === "checked_in" ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                              <CheckCircle className="h-3.5 w-3.5" /> Checked in
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
                              <XCircle className="h-3.5 w-3.5" /> Cancelled
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-muted-foreground">{purchasedAt}</td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={t.status === "cancelled"}
                              onClick={() => handleEditOpen(t)}
                              className={t.status === "cancelled" ? "opacity-50" : ""}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={t.status === "cancelled"}
                              onClick={() => setCancellingTicket(t)}
                              className={t.status === "cancelled" ? "opacity-50" : "hover:bg-destructive hover:text-destructive-foreground hover:border-destructive"}
                            >
                              Cancel
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
        )}
      </div>

      <Dialog open={!!cancellingTicket} onOpenChange={(open) => !open && setCancellingTicket(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" /> Cancel Ticket
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this ticket? 
            </DialogDescription>
          </DialogHeader>
          {cancellingTicket && (
            <div className="bg-muted/50 rounded-lg p-4 my-2 border border-border">
              <p className="font-medium">{cancellingTicket.attendee_name || cancellingTicket.order_items?.orders?.buyer_name}</p>
              <p className="text-sm text-muted-foreground mb-2">{cancellingTicket.attendee_email || cancellingTicket.order_items?.orders?.buyer_email}</p>
              <div className="flex justify-between items-center text-sm">
                <span className="font-mono text-xs">{cancellingTicket.ticket_code.split('-')[0].toUpperCase()}</span>
                <span className="text-muted-foreground">{cancellingTicket.order_items?.ticket_types?.name}</span>
              </div>
            </div>
          )}
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md mb-2">
            <strong>Warning:</strong> This action cannot be undone. The ticket will instantly become invalid at the door. You should ensure a refund has been issued if applicable.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancellingTicket(null)} disabled={cancelTicketMutation.isPending}>
              Keep Ticket
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => cancelTicketMutation.mutate(cancellingTicket.id)}
              disabled={cancelTicketMutation.isPending}
            >
              {cancelTicketMutation.isPending ? "Cancelling..." : "Cancel Ticket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Ticket Dialog */}
      <Dialog open={!!editingTicket} onOpenChange={(open) => !open && setEditingTicket(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Attendee Details</DialogTitle>
            <DialogDescription>
              Update the name or email for this ticket. If you change the email, the current ticket QR code will become invalid and a new one will be generated and emailed to the new address.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Attendee Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="e.g. Nneka Doe" />
            </div>
            <div className="space-y-2">
              <Label>Attendee Email</Label>
              <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="nneka@example.com" />
            </div>
            
            {editingTicket?.order_items?.orders?.checkout_answers && Object.keys(editingTicket.order_items.orders.checkout_answers).length > 0 && (
              <div className="space-y-2 pt-4 border-t border-border mt-4">
                <Label>Checkout Answers</Label>
                <div className="text-sm bg-muted/50 p-3 rounded-md space-y-2">
                  {Object.entries(editingTicket.order_items.orders.checkout_answers).map(([qid, ans]) => (
                    <div key={qid}>
                      <span className="font-medium text-muted-foreground">Question {qid}: </span>
                      <span>{Array.isArray(ans) ? ans.join(", ") : String(ans)}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Note: Question text not available here. Reference the form settings for question IDs.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTicket(null)} disabled={updateTicketMutation.isPending}>
              Cancel
            </Button>
            <Button 
              onClick={() => updateTicketMutation.mutate({ ticketId: editingTicket.id, name: editName, email: editEmail })} 
              disabled={updateTicketMutation.isPending || !editEmail.trim() || !editName.trim()}
            >
              {updateTicketMutation.isPending ? "Updating..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MassEmailDialog({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  async function handleSend() {
    if (!subject.trim() || !body.trim()) {
      toast.error("Subject and message are required.");
      return;
    }
    
    if (!confirm("Are you sure you want to send this to all attendees? This cannot be undone.")) return;

    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      // 1. Create broadcast record
      const { data: broadcast, error: insertErr } = await (supabase as any)
        .from("event_broadcasts")
        .insert({
          event_id: eventId,
          organizer_id: userData.user!.id,
          subject: subject.trim(),
          message: body.trim(),
        })
        .select("id")
        .single();
        
      if (insertErr || !broadcast) throw new Error(insertErr?.message || "Failed to create broadcast record");

      // 2. Trigger edge function to send emails
      const { error: invokeErr } = await supabase.functions.invoke("send-event-broadcast", {
        body: { broadcastId: broadcast.id }
      });

      if (invokeErr) throw new Error(invokeErr.message || "Failed to trigger email delivery");

      toast.success("Emails are being sent!");
      setOpen(false);
      setSubject("");
      setBody("");
      qc.invalidateQueries({ queryKey: ["event-broadcasts", eventId] });
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" onClick={() => setOpen(true)} className="shrink-0 gap-2">
        <Mail className="h-4 w-4" /> Message Attendees
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Message All Attendees</DialogTitle>
          <DialogDescription>
            Send an email update to everyone who purchased a ticket for this event.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Subject Line</Label>
            <Input 
              value={subject} 
              onChange={(e) => setSubject(e.target.value)} 
              placeholder="e.g. Venue Update: Doors open at 5 PM!" 
            />
          </div>
          <div className="space-y-2">
            <Label>Message Body</Label>
            <Textarea 
              rows={6}
              value={body} 
              onChange={(e) => setBody(e.target.value)} 
              placeholder="Write your message here. Attendees will receive this in their inbox." 
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={handleSend} disabled={busy || !subject.trim() || !body.trim()}>
            {busy ? "Sending..." : "Send to All"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
