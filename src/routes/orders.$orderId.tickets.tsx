import { createFileRoute, Link, notFound, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TicketStub } from "@/components/ticket-stub";
import { SiteNav } from "@/components/site-nav";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Ticket, ArrowLeft, Edit2 } from "lucide-react";
import { formatNaira } from "@/lib/currency";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GlobalLoader } from "@/components/global-loader";
import { BackButton } from "@/components/back-button";
import { toast } from "@/lib/toast";
import { BUSINESS_DETAILS } from "@/lib/business";
import type { Tables } from "@/lib/database.types";

// This route is intentionally NOT under _authenticated.
// Guests unlock an order with the link we email them: order id + their email.
const GUEST_TICKET_CREDENTIALS_PREFIX = "tixnaija:guest-ticket-credentials:";

export const Route = createFileRoute("/orders/$orderId/tickets")({
  ssr: false,
  component: OrderTicketsPage,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { download?: boolean } => ({
    download: search.download === "true" || search.download === true,
  }),
  errorComponent: ({ error }) => (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background p-6 text-center">
      <div className="w-full max-w-md rounded-lg border border-border/60 bg-card p-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Not available
        </p>
        <h2 className="mt-3 font-display text-2xl text-foreground">Unable to load tickets</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {error instanceof Error ? error.message : "The requested order could not be retrieved."}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild variant="outline" className="rounded-md">
            <Link to="/tickets">My tickets</Link>
          </Button>
          <Button asChild className="rounded-md">
            <Link to="/">Go home</Link>
          </Button>
        </div>
      </div>
    </div>
  ),
});

/** Shape returned by the get_guest_order_full RPC (a JSON blob). */
interface GuestOrderFull {
  order: Tables<"orders"> & { events: Tables<"events"> };
  tickets: (Tables<"tickets"> & {
    order_items: { order_id: string; ticket_types: Tables<"ticket_types"> };
  })[];
}

async function fetchOrderTickets(orderId: string, guestEmail?: string) {
  // Guest mode: the order id plus the buyer/recipient email unlock the order.
  if (guestEmail) {
    const { data, error } = await supabase.rpc("get_guest_order_full", {
      p_order_id: orderId,
      p_email: guestEmail.trim().toLowerCase(),
    });
    
    if (error || !data) {
      return null;
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
    return null;
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

  let siblingOrders: any[] = [];
  if (order.user_id && order.event_id) {
    const { data: siblings } = await supabase
      .from("orders")
      .select("id, created_at, total_kobo, status")
      .eq("user_id", order.user_id)
      .eq("event_id", order.event_id)
      .neq("id", orderId)
      .order("created_at", { ascending: false });
    siblingOrders = siblings || [];
  }

  return { order, tickets: tickets || [], isGuest: false, siblingOrders };
}

import { useEffect, useState } from "react";

function OrderTicketsPage() {
  const { orderId } = Route.useParams();
  const { download: shouldDownload } = useSearch({ from: "/orders/$orderId/tickets" });
  const [guestCredentials, setGuestCredentials] = useState<{ email: string } | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
    const legacyEmail = url.searchParams.get("email");
    const email = hashParams.get("email") || legacyEmail;
    const credentialsKey = `${GUEST_TICKET_CREDENTIALS_PREFIX}${orderId}`;

    if (email) {
      sessionStorage.setItem(credentialsKey, JSON.stringify({ email }));
    }

    try {
      const stored = sessionStorage.getItem(credentialsKey);
      setGuestCredentials(stored ? JSON.parse(stored) : null);
    } catch {
      sessionStorage.removeItem(credentialsKey);
      setGuestCredentials(null);
    }

    if (email || legacyEmail || url.searchParams.has("code") || url.searchParams.has("accessCode")) {
      url.searchParams.delete("email");
      url.searchParams.delete("code");
      url.searchParams.delete("accessCode");
      url.hash = "";
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
    }
  }, [orderId]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["order-tickets", orderId, guestCredentials?.email],
    queryFn: () => fetchOrderTickets(orderId, guestCredentials?.email),
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
      
      toast.success(
        data?.isGuest
          ? "Ticket updated! It's live on your ticket link right away."
          : "Ticket updated! An email with the ticket has been sent to the new address.",
      );
      setEditingTicket(null);
      refetch();

      // Trigger the edge function to re-send the specific ticket to the new email.
      // Guests have no session, so their order link keeps working either way.
      if (!data?.isGuest) {
        const { error: emailError } = await supabase.functions.invoke("send-ticket-confirmation", {
          body: { orderId: data?.order?.id, ticketId: editingTicket.id },
        });
        if (emailError) {
          console.error("Failed to email the updated ticket", emailError);
          toast.error("Ticket updated, but we couldn't email it. Try resending from your tickets list.");
        }
      }

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
      
      <section className="border-b border-border/60">
        <div className="mx-auto max-w-4xl px-4 pb-8 pt-6 sm:px-6 md:pb-10">
          <BackButton />
          {guestCredentials && (
            <Button asChild variant="ghost" size="sm" className="-ml-2 mt-2 text-muted-foreground">
              <Link to="/my-tickets">
                <ArrowLeft className="mr-1 h-4 w-4" aria-hidden /> Email my tickets again
              </Link>
            </Button>
          )}
          <div className="mt-6 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            <span className="h-px w-10 bg-border" aria-hidden />
            TixNaija / Order
          </div>
          <h1 className="mt-4 font-display text-4xl leading-none tracking-[-0.02em] text-foreground">
            Your tickets
          </h1>
          <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-muted-foreground">
            Have these ready to scan at the door, or download them for offline use.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 pb-32 pt-8 sm:px-6">

        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="mx-auto h-24 w-full max-w-2xl rounded-lg" />
            <Skeleton className="mx-auto h-[300px] w-full max-w-2xl rounded-lg" />
          </div>
        ) : isError || !data || !data.order ? (
          <div className="mx-auto my-12 max-w-md rounded-lg border border-border/60 bg-card p-8 text-center">
            <Ticket className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden />
            <h2 className="mt-4 font-display text-2xl text-foreground">Tickets unavailable</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              We couldn't retrieve these tickets. If you checked out as a guest, open the ticket link
              from your confirmation email or have it sent again.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
              <Button asChild variant="outline" className="rounded-md">
                <Link to="/tickets">My account</Link>
              </Button>
              <Button asChild className="rounded-md">
                <Link to="/my-tickets">Email my tickets</Link>
              </Button>
            </div>
          </div>
        ) : data.tickets.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-20 text-center">
            <Ticket className="mx-auto h-8 w-8 text-muted-foreground/60" aria-hidden />
            <h3 className="mt-3 font-display text-xl text-foreground">No tickets on this order</h3>
            <p className="mt-2 text-sm text-muted-foreground">We couldn't find any tickets for this order.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Order summary */}
            <div className="rounded-lg border border-border/60 bg-card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3 sm:px-5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Order summary
                </span>
                <span className="inline-flex items-center gap-2 rounded-md border border-border/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-foreground">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
                  {String(data.order.status || "pending").replace(/_/g, " ")}
                </span>
              </div>
              <dl className="grid gap-4 px-4 py-4 sm:grid-cols-3 sm:px-5">
                <div className="min-w-0">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Reference
                  </dt>
                  <dd className="mt-1 truncate font-mono text-[13px] text-foreground">
                    #{String(data.order.id).includes("-") ? String(data.order.id).split("-")[0] : String(data.order.id).slice(0, 8)}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Placed
                  </dt>
                  <dd className="mt-1 text-[13px] text-foreground">
                    {data.order.created_at
                      ? new Date(data.order.created_at).toLocaleDateString("en-NG", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Total paid
                  </dt>
                  <dd className="mt-1 text-[13px] font-semibold text-foreground">
                    {formatNaira(data.order.total_kobo || 0)}
                  </dd>
                </div>
              </dl>
            </div>
            {data.siblingOrders && data.siblingOrders.length > 0 && (
              <div className="flex flex-col justify-between gap-4 rounded-lg border border-border/60 bg-card p-4 sm:flex-row sm:items-center sm:p-5">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-foreground">
                    You have tickets from {data.siblingOrders.length} other order
                    {data.siblingOrders.length > 1 ? "s" : ""} for this event
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                    View all your passes together in My tickets, or switch directly to another
                    order.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {data.siblingOrders.map((sib: any) => (
                    <Button
                      key={sib.id}
                      asChild
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-md font-mono text-[11px]"
                    >
                      <Link to="/orders/$orderId/tickets" params={{ orderId: sib.id }}>
                        #{sib.id.slice(0, 8)}
                      </Link>
                    </Button>
                  ))}
                  <Button asChild size="sm" className="h-8 rounded-md text-[11px] font-semibold">
                    <Link to="/tickets">All my tickets</Link>
                  </Button>
                </div>
              </div>
            )}
            {data.tickets.map((ticket, index) => {
              const ticketType = Array.isArray(ticket.order_items)
                ? (ticket.order_items[0]?.ticket_types || {})
                : (ticket.order_items?.ticket_types || (ticket as any).ticket_types || { name: "General Admission", price_kobo: 0 });

              const event = Array.isArray(data.order?.events) ? data.order.events[0] : (data.order?.events || {});

              return (
                <div 
                  key={ticket.id || index} 
                  className="animate-in fade-in slide-in-from-bottom-8 duration-700 fill-mode-both"
                  style={{ animationDelay: `${index * 150}ms` }}
                >
                  <div className="relative">
                    <TicketStub
                      ticket={ticket}
                      event={event}
                      order={data.order}
                      ticketType={ticketType}
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
              );
            })}

            {/* Upsell for guests */}
            {data.isGuest && (
              <div className="rounded-lg border border-border/60 bg-secondary/20 p-5 text-center">
                <h3 className="font-display text-lg text-foreground">Create a free account</h3>
                <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
                  Sign up with this email to keep your tickets in one place, get notifications and
                  request refunds without digging through your inbox.
                </p>
                <Button asChild className="mt-4 rounded-md press-sm">
                  <Link to="/auth" search={{ mode: "signup" }}>
                    Create free account
                  </Link>
                </Button>
              </div>
            )}

            {/* Need help */}
            <div className="flex flex-col justify-between gap-4 rounded-lg border border-border/60 bg-card p-4 sm:flex-row sm:items-center">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-foreground">Need help or missing an email?</p>
                <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                  Reach support on WhatsApp ({BUSINESS_DETAILS.supportPhone}) or email (
                  {BUSINESS_DETAILS.supportEmail}).
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={`https://wa.me/${BUSINESS_DETAILS.supportPhone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`Hello TixNaija Support, I need assistance with Order ${data.order?.id || ""}.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-md border border-border/70 px-3 py-1.5 text-[12px] font-semibold text-foreground transition-colors hover:bg-secondary/50"
                >
                  WhatsApp
                </a>
                <a
                  href={`mailto:${BUSINESS_DETAILS.supportEmail}?subject=${encodeURIComponent(`Order Support - ${data.order?.id || ""}`)}`}
                  className="inline-flex items-center rounded-md border border-border/70 px-3 py-1.5 text-[12px] font-semibold text-foreground transition-colors hover:bg-secondary/50"
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
              <Button type="button" variant="outline" onClick={() => setEditingTicket(null)} disabled={isUpdating} className="rounded-md">
                Cancel
              </Button>
              <Button type="submit" disabled={isUpdating} className="rounded-md press-sm">
                {isUpdating ? "Saving..." : "Save & resend"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
