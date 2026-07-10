import { createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TicketStub } from "@/components/ticket-stub";
import { SiteNav } from "@/components/site-nav";
import { Skeleton } from "@/components/ui/skeleton";
import { Ticket } from "lucide-react";

export const Route = createFileRoute("/_authenticated/orders/$orderId/tickets")({
  component: OrderTicketsPage,
});

async function fetchOrderTickets(orderId: string) {
  // Fetch order and event
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select(`*, events(*)`)
    .eq("id", orderId)
    .single();

  if (orderErr || !order) {
    console.error("Error fetching order:", orderErr);
    throw notFound();
  }

  // Fetch tickets with order_items and ticket_types
  // We need to join tickets -> order_items -> ticket_types
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
    console.error("Error fetching tickets:", ticketsErr);
    throw ticketsErr;
  }

  return { order, tickets: tickets || [] };
}

function OrderTicketsPage() {
  const { orderId } = Route.useParams();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["order-tickets", orderId],
    queryFn: () => fetchOrderTickets(orderId),
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <div className="mx-auto max-w-4xl px-4 py-10 pb-32">
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
          </div>
        )}
      </div>
    </div>
  );
}
