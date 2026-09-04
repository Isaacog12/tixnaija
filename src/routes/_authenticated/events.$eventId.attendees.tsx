import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { Ticket, ArrowLeft, XCircle, Search, ShieldAlert, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { BackButton } from "@/components/back-button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { format } from "date-fns";
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
            ticket_types ( name ),
            orders!inner (
              event_id,
              buyer_email,
              buyer_name
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

  const filteredTickets = tickets?.filter((t: any) => {
    const q = search.toLowerCase();
    const name = (t.attendee_name || t.order_items.orders.buyer_name || "").toLowerCase();
    const email = (t.attendee_email || t.order_items.orders.buyer_email || "").toLowerCase();
    const code = t.ticket_code.split("-")[0].toLowerCase();
    return name.includes(q) || email.includes(q) || code.includes(q);
  });

  return (
    <div className="min-h-screen bg-background">
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
        </div>

        {ticketsLoading ? (
          <div className="text-center py-20 text-muted-foreground">Loading attendees...</div>
        ) : !filteredTickets || filteredTickets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-24 text-center">
            <Ticket className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-semibold">No attendees found</h3>
            <p className="text-sm text-muted-foreground">
              {search ? "No tickets matched your search." : "No one has purchased a ticket yet."}
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

                    return (
                      <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-medium">{name}</p>
                          <p className="text-xs text-muted-foreground">{email}</p>
                        </td>
                        <td className="px-5 py-4 font-mono text-xs tracking-wider">{code}</td>
                        <td className="px-5 py-4">{tierName}</td>
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
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={t.status === "cancelled"}
                            onClick={() => setCancellingTicket(t)}
                            className={t.status === "cancelled" ? "opacity-50" : "hover:bg-destructive hover:text-destructive-foreground hover:border-destructive"}
                          >
                            Cancel Ticket
                          </Button>
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
              {cancelTicketMutation.isPending ? "Cancelling..." : "Yes, Cancel Ticket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
