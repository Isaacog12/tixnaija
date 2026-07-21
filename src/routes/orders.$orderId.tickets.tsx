import { createFileRoute, Link, notFound, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TicketStub } from "@/components/ticket-stub";
import { SiteNav } from "@/components/site-nav";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Ticket, ArrowLeft } from "lucide-react";

// This route is intentionally NOT under _authenticated —
// guests can reach it from /my-tickets with ?email=... query param.
export const Route = createFileRoute("/orders/$orderId/tickets")({
  component: OrderTicketsPage,
  validateSearch: (search: Record<string, unknown>) => ({
    email: typeof search.email === "string" ? search.email : undefined,
    accessCode: typeof search.accessCode === "string" ? search.accessCode : undefined,
  }),
});

async function fetchOrderTickets(orderId: string, guestEmail?: string, guestAccessCode?: string) {
  // Fetch order and event — works for logged-in users via RLS,
  // and for guests if they supply the correct buyer_email.
  const query = supabase
    .from("orders")
    .select(`*, events(*)`)
    .eq("id", orderId);

  const { data: order, error: orderErr } = await query.single();

  if (orderErr || !order) {
    // For guests: verify email matches before throwing notFound
    throw notFound();
  }

  // If guest mode: check email and accessCode match
  if (guestEmail && guestAccessCode) {
    if (
      order.buyer_email?.toLowerCase() !== guestEmail.toLowerCase() ||
      order.access_code !== guestAccessCode
    ) {
      throw notFound();
    }
  } else if (guestEmail) {
    // Missing access code
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

  return { order, tickets: tickets || [], isGuest: !!(guestEmail) };
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
      <div className="mx-auto max-w-4xl px-4 py-10 pb-32">
        {/* Back link for guests */}
        {guestEmail && (
          <div className="mb-6">
            <Button asChild variant="ghost" size="sm" className="-ml-2">
              <Link to="/my-tickets">
                <ArrowLeft className="mr-1 h-4 w-4" /> Back to My Tickets
              </Link>
            </Button>
          </div>
        )}

        <div className="mb-10 text-center">
          <h1 className="font-display text-4xl mb-2">Your Tickets</h1>
          <p className="text-muted-foreground">
            Have these ready to scan at the door. You can also download them for offline use.
          </p>
        </div>

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
            {data.tickets.map((ticket: any) => (
              <TicketStub
                key={ticket.id}
                ticket={ticket}
                event={data.order.events}
                order={data.order}
                ticketType={ticket.order_items.ticket_types}
              />
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
