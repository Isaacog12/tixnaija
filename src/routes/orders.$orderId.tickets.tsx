import { createFileRoute, Link, notFound, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TicketStub } from "@/components/ticket-stub";
import { SiteNav } from "@/components/site-nav";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Ticket, ArrowLeft, Check, Edit2 } from "lucide-react";
import { formatNaira } from "@/lib/currency";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GlobalLoader } from "@/components/global-loader";
import { BackButton } from "@/components/back-button";
import { toast } from "sonner";
import { BUSINESS_DETAILS } from "@/lib/business";
import type { Tables } from "@/lib/database.types";

// This route is intentionally NOT under _authenticated —
// guests can reach it from /my-tickets with ?email=... query param.
export const Route = createFileRoute("/orders/$orderId/tickets")({
  component: OrderTicketsPage,
  validateSearch: (search: Record<string, unknown>): { email?: string; download?: boolean } => ({
    email: typeof search.email === "string" ? search.email : undefined,
    download: search.download === "true" || search.download === true,
  }),
});

/** Shape returned by the get_guest_order_full RPC (a JSON blob). */
interface GuestOrderFull {
  order: Tables<"orders"> & { events: Tables<"events"> };
  tickets: (Tables<"tickets"> & {
    order_items: { order_id: string; ticket_types: Tables<"ticket_types"> };
  })[];
}

async function fetchOrderTickets(orderId: string, guestEmail?: string) {
  // If guest mode: check email matches via RPC
  if (guestEmail) {
    const { data, error } = await supabase.rpc("get_guest_order_full", {
      p_order_id: orderId,
      p_email: guestEmail.toLowerCase(),
    });
    
    if (error || !data) {
      throw notFound();
    }
    
    const result = data as unknown as GuestOrderFull;

    return { order: result.order, tickets: result.tickets ?? [], isGuest: true };
  }

  // Fetch order and event for logged-in users via RLS
  const query = supabase
    .from("orders")
    .select(`*, events(*)`)
    .eq("id", orderId);

  const { data: order, error: orderErr } = await query.single();

  if (orderErr || !order) {
    // Check if the user is even logged in
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      // If not logged in and RLS failed, they need to log in to see their tickets!
      window.location.href = `/auth?mode=login&returnTo=/orders/${orderId}/tickets`;
      // Pause execution while redirect happens
      await new Promise(() => {});
    }
    throw notFound();
  }

  const { data: tickets, error: ticketsErr } = await supabase
    .from("tickets")
    .select(`
      *,
      order_items!inner(
        order_id,
        ticket_types(*)
      )
    `)
    .eq("order_items.order_id", orderId);

  if (ticketsErr) {
    throw ticketsErr;
  }

  return { order, tickets: tickets || [], isGuest: false };
}

import { useEffect, useState } from "react";

function OrderTicketsPage() {
  const { orderId } = Route.useParams();
  const { email: searchEmail, download: shouldDownload } = useSearch({ from: "/orders/$orderId/tickets" });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["order-tickets", orderId, searchEmail],
    queryFn: () => fetchOrderTickets(orderId, searchEmail),
  });

  const [editingTicket, setEditingTicket] = useState<GuestOrderFull["tickets"][number] | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const handleEditOpen = (ticket: GuestOrderFull["tickets"][number]) => {
    setEditingTicket(ticket);
    setEditName(ticket.attendee_name || "");
    setEditEmail(ticket.attendee_email || "");
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTicket) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase.rpc("update_ticket_attendee", {
        p_ticket_id: editingTicket.id,
        p_attendee_name: editName,
        p_attendee_email: editEmail,
      });

      if (error) throw error;
      
      toast.success("Ticket updated! An email with the ticket has been sent to the new address.");
      setEditingTicket(null);
      refetch();

      // Trigger the edge function to re-send the specific ticket to the new email
      await supabase.functions.invoke("send-ticket-confirmation", {
        body: { orderId: data?.order?.id, ticketId: editingTicket.id },
      });

    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update ticket.");
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    if (shouldDownload && data && !isLoading && !isError) {
      // Small delay to ensure images (like QR codes) are rendered
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [shouldDownload, data, isLoading, isError]);

  return (
    <div className="min-h-dvh bg-background">
      <SiteNav />
      
      {/* Order Summary Header / Hero */}
      <section className="bg-card border-b border-border shadow-sm mb-10 pt-8 pb-8 relative overflow-hidden">
        <div className="absolute inset-0 z-0 bg-gradient-to-r from-primary/5 to-transparent opacity-50" />
        <div className="mx-auto max-w-4xl px-4 relative z-10">
          {searchEmail && (
            <Button asChild variant="ghost" size="sm" className="-ml-2 mb-4">
              <Link to="/my-tickets">
                <ArrowLeft className="mr-1 h-4 w-4" /> Back to My Tickets
              </Link>
            </Button>
          )}

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/10">
                  <Check className="h-5 w-5 text-green-500" />
                </div>
                <span className="text-sm font-medium text-green-600 dark:text-green-500">Order Confirmed</span>
              </div>
              <div className="flex items-center gap-4 mb-1">
                <BackButton />
                <h1 className="type-heading-xl">Your Tickets</h1>
              </div>
              <p className="text-muted-foreground text-sm">
                Have these ready to scan at the door, or download them for offline use.
              </p>
            </div>

            {data && data.order && (
              <div className="bg-background/80 backdrop-blur-md rounded-xl p-4 border border-border/50 shadow-sm md:text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Paid</p>
                <p className="text-2xl font-bold font-mono">{formatNaira(data.order.total_kobo)}</p>
                <p className="text-xs text-muted-foreground mt-1">Order #{data.order.id.split("-")[0]}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 pb-32">

        {isLoading ? (
          <div className="space-y-8">
            <Skeleton className="h-[300px] w-full max-w-2xl mx-auto rounded-2xl" />
            <Skeleton className="h-[300px] w-full max-w-2xl mx-auto rounded-2xl" />
          </div>
        ) : isError || !data ? (
          <div className="text-center py-24 text-muted-foreground">
            <p>Failed to load tickets or order not found.</p>
            {searchEmail && (
              <Button asChild variant="outline" className="mt-4">
                <Link to="/my-tickets">Try again</Link>
              </Button>
            )}
          </div>
        ) : data.tickets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-24 text-center">
            <Ticket className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-semibold font-display text-xl text-foreground">Your ticket stash is empty. Let's fix that.</h3>
            <p className="text-sm text-muted-foreground">We couldn't find any tickets for this order.</p>
          </div>
        ) : (
          <div className="space-y-12">
            {data.tickets.map((ticket, index) => (
              <div 
                key={ticket.id} 
                className="animate-in fade-in slide-in-from-bottom-8 duration-700 fill-mode-both"
                style={{ animationDelay: `${index * 150}ms` }}
              >
                <div className="relative">
                  <TicketStub
                    ticket={ticket}
                    event={data.order.events}
                    order={data.order}
                    ticketType={ticket.order_items.ticket_types}
                  />
                  {!data.isGuest && (
                    <div className="absolute top-4 right-4 z-10 print:hidden">
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="bg-background/80 backdrop-blur shadow-sm hover:bg-background"
                        onClick={() => handleEditOpen(ticket)}
                      >
                        <Edit2 className="h-4 w-4 mr-2" />
                        Reassign Ticket
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Upsell for guests */}
            {data.isGuest && (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center">
                <h3 className="font-semibold">Create a free account</h3>
                <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
                  Sign up with this email to get your tickets in one place, receive notifications, and request refunds easily.
                </p>
                <Button asChild className="mt-4 gradient-sunset text-primary-foreground shadow-glow press-sm transition-all duration-[120ms]">
                   <Link to="/auth" search={{ mode: "signup" }}>Create free account</Link>
                 </Button>
              </div>
            )}

            {/* Need Help Support Banner */}
            <div className="rounded-2xl border border-border/70 bg-card/70 backdrop-blur-md p-4 text-center sm:text-left sm:flex sm:items-center sm:justify-between gap-4 shadow-sm">
              <div>
                <p className="text-sm font-semibold text-foreground">Need help or missing an email?</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Contact support directly on WhatsApp/Text ({BUSINESS_DETAILS.supportPhone}) or email ({BUSINESS_DETAILS.supportEmail}).
                </p>
              </div>
              <div className="mt-3 sm:mt-0 flex items-center justify-center gap-2 shrink-0">
                <a
                  href={`https://wa.me/${BUSINESS_DETAILS.supportPhone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`Hello TixNaija Support, I need assistance with Order ${data.order?.id || ""}.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-3 py-1.5 text-xs font-semibold transition-colors"
                >
                  WhatsApp
                </a>
                <a
                  href={`mailto:${BUSINESS_DETAILS.supportEmail}?subject=${encodeURIComponent(`Order Support - ${data.order?.id || ""}`)}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border px-3 py-1.5 text-xs font-medium transition-colors"
                >
                  Email
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!editingTicket} onOpenChange={(open) => !open && setEditingTicket(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign Ticket</DialogTitle>
            <DialogDescription>
              Update the attendee details for this ticket. The new attendee will receive their ticket via email automatically.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Attendee Name</Label>
              <Input
                id="edit-name"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Full Name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Attendee Email</Label>
              <Input
                id="edit-email"
                type="email"
                required
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="Email Address"
              />
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setEditingTicket(null)} disabled={isUpdating}>
                Cancel
              </Button>
              <Button type="submit" disabled={isUpdating} className="gradient-sunset text-primary-foreground shadow-glow press-sm transition-all duration-[120ms]">
                 {isUpdating ? "Saving..." : "Save & Resend"}
               </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
