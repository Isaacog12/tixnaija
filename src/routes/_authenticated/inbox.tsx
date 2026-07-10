import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ticket, Mail, Clock, CheckCircle2, QrCode } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/inbox")({
  component: InboxPage,
});

function InboxPage() {
  const queryClient = useQueryClient();

  const { data: messages, isLoading } = useQuery({
    queryKey: ["messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("messages").update({ is_read: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-display text-4xl">Inbox</h1>
      <p className="text-muted-foreground mt-2">Your tickets and system messages.</p>

      <div className="mt-8 space-y-4">
        {isLoading ? (
          <>
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </>
        ) : messages && messages.length > 0 ? (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-xl border p-5 transition ${
                msg.is_read ? "border-border bg-card/40" : "border-primary/50 bg-card shadow-sm"
              }`}
              onClick={() => {
                if (!msg.is_read) markRead.mutate(msg.id);
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-4">
                  <div className={`mt-1 rounded-full p-2 ${msg.is_read ? 'bg-secondary' : 'bg-primary/20 text-primary'}`}>
                    {msg.type === 'ticket_delivery' ? <Ticket className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
                  </div>
                  <div>
                    <h3 className={`text-lg ${!msg.is_read ? 'font-semibold' : 'font-medium text-foreground/80'}`}>
                      {msg.title}
                    </h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                      {msg.body}
                    </p>
                    {msg.type === 'ticket_delivery' && msg.related_order_id && (
                      <div className="mt-4">
                        <Button asChild variant="outline" size="sm">
                          <Link to={`/dashboard`}>
                            <QrCode className="mr-2 h-4 w-4" /> View Tickets
                          </Link>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                  </span>
                  {msg.is_read && (
                    <span className="flex items-center gap-1 text-green-500/80">
                      <CheckCircle2 className="h-3 w-3" /> Read
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-border py-24 text-center">
            <Mail className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-semibold">No messages yet</h3>
            <p className="text-sm text-muted-foreground">When you buy tickets, they'll show up here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
