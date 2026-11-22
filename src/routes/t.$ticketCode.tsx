import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TicketStub } from "@/components/ticket-stub";
import { SiteNav } from "@/components/site-nav";
import { BackButton } from "@/components/back-button";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

export const Route = createFileRoute("/t/$ticketCode")({
  component: SingleTicketPage,
});

interface TicketFull {
  id: string;
  ticket_code: string;
  order_items: {
    ticket_types: any;
    orders: {
      events: any;
      [key: string]: any;
    };
    [key: string]: any;
  };
  [key: string]: any;
}

async function fetchSingleTicket(ticketCode: string) {
  const { data: ticket, error: ticketErr } = await supabase.rpc("get_ticket_by_code", {
    p_ticket_code: ticketCode,
  });

  if (ticketErr || !ticket) {
    throw notFound();
  }

  return ticket as unknown as TicketFull;
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
    <div className="min-h-dvh bg-background">
      <SiteNav />

      <section className="border-b border-border/60">
        <div className="mx-auto max-w-4xl px-4 pb-8 pt-6 sm:px-6 md:pb-10">
          <BackButton />
          <div className="mt-6 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            <span className="h-px w-10 bg-border" aria-hidden />
            TixNaija / Ticket
          </div>
          <h1 className="mt-4 font-display text-4xl leading-none tracking-[-0.02em] text-foreground">
            Your ticket
          </h1>
          <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-muted-foreground">
            Have this ready to scan at the door, or download it for offline use.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 pb-32 pt-8 sm:px-6">
        {isLoading ? (
          <Skeleton className="mx-auto h-[320px] w-full max-w-2xl rounded-lg" />
        ) : isError || !ticket ? (
          <div className="mx-auto my-12 max-w-md rounded-lg border border-border/60 bg-card p-8 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Not found
            </p>
            <h2 className="mt-3 font-display text-2xl text-foreground">Ticket not found</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              We couldn't locate a ticket matching this verification code. It may have expired or
              been reissued.
            </p>
            <Button asChild className="mt-6 rounded-md">
              <Link to="/my-tickets">Email my tickets</Link>
            </Button>
          </div>
        ) : (
          <div className="flex justify-center">
            <TicketStub
              ticket={ticket}
              event={ticket.order_items.orders.events}
              order={ticket.order_items.orders}
              ticketType={ticket.order_items.ticket_types}
            />
          </div>
        )}
      </div>
    </div>
  );
}
