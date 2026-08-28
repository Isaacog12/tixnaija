import { createFileRoute, Link, notFound, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TicketStub } from "@/components/ticket-stub";
import { SiteNav } from "@/components/site-nav";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Ticket, ArrowLeft, Check } from "lucide-react";
import { formatNaira } from "@/lib/currency";

// This route is intentionally NOT under _authenticated —
// guests can reach it from /my-tickets with ?email=... query param.
export const Route = createFileRoute("/orders/$orderId/tickets")({
  component: OrderTicketsPage,
  validateSearch: (search: Record<string, unknown>): { email?: string; accessCode?: string } => ({
    email: typeof search.email === "string" ? search.email : undefined,
    accessCode: typeof search.accessCode === "string" ? search.accessCode : undefined,
  }),
});

async function fetchOrderTickets(orderId: string, guestEmail?: string, guestAccessCode?: string) {
  // If guest mode: check email and accessCode match via RPC
  if (guestEmail && guestAccessCode) {
    const { data, error } = await supabase.rpc("get_guest_order_full" as any, {
      p_order_id: orderId,
      p_email: guestEmail.toLowerCase(),
      p_access_code: guestAccessCode,
    });
    
    if (error || !data) {
      throw notFound();
    }
    
    return { order: data.order, tickets: data.tickets || [], isGuest: true };
  } else if (guestEmail) {
    // Missing access code
    throw notFound();
  }

  // Fetch order and event for logged-in users via RLS
  const query = supabase
    .from("orders")
    .select(`*, events(*)`)
    .eq("id", orderId);

  const { data: order, error: orderErr } = await query.single();

  if (orderErr || !order) {
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

function OrderTicketsPage() {
  const { orderId } = Route.useParams();
  const { email: guestEmail, accessCode: guestAccessCode } = useSearch({ from: "/orders/$orderId/tickets" });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["order-tickets", orderId, guestEmail, guestAccessCode],
    queryFn: () => fetchOrderTickets(orderId, guestEmail, guestAccessCode),
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      
      {/* Order Summary Header / Hero */}
      <section className="bg-card border-b border-border shadow-sm mb-10 pt-8 pb-8 relative overflow-hidden">
        <div className="absolute inset-0 z-0 bg-gradient-to-r from-primary/5 to-transparent opacity-50" />
        <div className="mx-auto max-w-4xl px-4 relative z-10">
          {guestEmail && (
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
              <h1 className="font-display text-4xl mb-1">Your Tickets</h1>
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
            {guestEmail && (
              <Button asChild variant="outline" className="mt-4">
                <Link to="/my-tickets">Try again</Link>
              </Button>
            )}
          </div>
        ) : data.tickets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-24 text-center">
            <Ticket className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-semibold">No tickets found</h3>
            <p className="text-sm text-muted-foreground">We couldn't find any tickets for this order.</p>
          </div>
        ) : (
          <div className="space-y-12">
            {data.tickets.map((ticket: any, index: number) => (
              <div 
                key={ticket.id} 
                className="animate-in fade-in slide-in-from-bottom-8 duration-700 fill-mode-both"
                style={{ animationDelay: `${index * 150}ms` }}
              >
                <TicketStub
                  ticket={ticket}
                  event={data.order.events}
                  order={data.order}
                  ticketType={ticket.order_items.ticket_types}
                />
              </div>
            ))}

            {/* Upsell for guests */}
            {data.isGuest && (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center">
                <h3 className="font-semibold">Create a free account</h3>
                <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
                  Sign up with this email to get your tickets in one place, receive inbox notifications, and request refunds easily.
                </p>
                <Button asChild className="mt-4 gradient-sunset text-primary-foreground shadow-glow hover:opacity-90">
                  <Link to="/auth" search={{ mode: "signup" }}>Create free account</Link>
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
