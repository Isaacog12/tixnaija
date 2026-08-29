import { createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TicketStub } from "@/components/ticket-stub";
import { SiteNav } from "@/components/site-nav";
import { Skeleton } from "@/components/ui/skeleton";
import { Ticket } from "lucide-react";
import { useEffect } from "react";

export const Route = createFileRoute("/t/$ticketCode")({
  component: SingleTicketPage,
});

async function fetchSingleTicket(ticketCode: string) {
  const { data: ticket, error: ticketErr } = await supabase
    .from("tickets")
    .select(`
      *,
      order_items!inner(
        order_id,
        ticket_types(*),
        orders!inner(
          *,
          events(*)
        )
      )
    `)
    .eq("ticket_code", ticketCode)
    .maybeSingle();

  if (ticketErr || !ticket) {
    throw notFound();
  }

  return ticket;
}

function SingleTicketPage() {
  const { ticketCode } = Route.useParams();

  const { data: ticket, isLoading, isError } = useQuery({
    queryKey: ["single-ticket", ticketCode],
    queryFn: () => fetchSingleTicket(ticketCode),
  });

  useEffect(() => {
    // Optionally trigger print if URL has ?download=true
    if (window.location.search.includes("download=true") && ticket && !isLoading && !isError) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [ticket, isLoading, isError]);

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      
      <section className="bg-card border-b border-border shadow-sm mb-10 pt-8 pb-8 relative overflow-hidden">
        <div className="absolute inset-0 z-0 bg-gradient-to-r from-primary/5 to-transparent opacity-50" />
        <div className="mx-auto max-w-4xl px-4 relative z-10 text-center">
          <h1 className="font-display text-4xl mb-2">Your Ticket</h1>
          <p className="text-muted-foreground text-sm">
            Have this ready to scan at the door, or download it for offline use.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 pb-32">
        {isLoading ? (
          <Skeleton className="h-[300px] w-full max-w-2xl mx-auto rounded-2xl" />
        ) : isError || !ticket ? (
          <div className="text-center py-24 text-muted-foreground rounded-2xl border border-dashed border-border">
            <Ticket className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-semibold text-foreground">Ticket not found</h3>
            <p className="text-sm mt-2">We couldn't find a ticket with this code. It may be invalid or deleted.</p>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="w-full max-w-2xl">
              <TicketStub
                ticket={ticket}
                event={ticket.order_items.orders.events}
                order={ticket.order_items.orders}
                ticketType={ticket.order_items.ticket_types}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
