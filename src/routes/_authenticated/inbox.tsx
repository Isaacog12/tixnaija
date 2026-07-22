import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ticket, Mail, Clock, CheckCircle2, QrCode, Bell, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow, differenceInDays, format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/inbox")({
  component: InboxPage,
});

function InboxPage() {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["messages"],
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      const { data, error } = await supabase
        .from("messages" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .range(pageParam * 20, (pageParam + 1) * 20 - 1);
      if (error) throw error;
      return data as any[];
    },
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === 20 ? allPages.length : undefined;
    },
  });

  const messages = data?.pages.flat() || [];

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("messages" as any) as any).update({ is_read: true }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["messages"] });
      const previousData = queryClient.getQueryData(["messages"]);
      
      queryClient.setQueryData(["messages"], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: any[]) =>
            page.map((msg) => (msg.id === id ? { ...msg, is_read: true } : msg))
          ),
        };
      });
      
      queryClient.setQueryData(["unread-messages"], (old: any) => Math.max(0, (old || 0) - 1));
      
      return { previousData };
    },
    onError: (err, newTodo, context) => {
      queryClient.setQueryData(["messages"], context?.previousData);
      toast.error("Failed to mark message as read");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      queryClient.invalidateQueries({ queryKey: ["unread-messages"] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from("messages" as any) as any).update({ is_read: true }).eq("is_read", false);
      if (error) throw error;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["messages"] });
      const previousData = queryClient.getQueryData(["messages"]);
      
      queryClient.setQueryData(["messages"], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: any[]) =>
            page.map((msg) => ({ ...msg, is_read: true }))
          ),
        };
      });
      
      queryClient.setQueryData(["unread-messages"], 0);
      return { previousData };
    },
    onError: (err, newTodo, context) => {
      queryClient.setQueryData(["messages"], context?.previousData);
      toast.error("Failed to mark all as read");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      queryClient.invalidateQueries({ queryKey: ["unread-messages"] });
    },
  });

  const hasUnread = messages.some((m: any) => !m.is_read);

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    if (differenceInDays(new Date(), d) > 7) {
      return format(d, "MMM d, yyyy");
    }
    return formatDistanceToNow(d, { addSuffix: true });
  }

  function getIcon(type: string) {
    if (type === 'ticket_delivery') return <Ticket className="h-5 w-5" />;
    if (type === 'system') return <Bell className="h-5 w-5" />;
    return <Mail className="h-5 w-5" />;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-4xl">Inbox</h1>
          <p className="text-muted-foreground mt-2">Your tickets and system messages.</p>
        </div>
        {hasUnread && (
          <Button 
            variant="outline" 
            onClick={() => markAllRead.mutate()} 
            disabled={markAllRead.isPending}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Mark all as read
          </Button>
        )}
      </div>

      <div className="mt-8 space-y-4">
        {isLoading ? (
          <>
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </>
        ) : messages.length > 0 ? (
          <>
            {messages.map((msg: any) => {
              const isExpanded = expandedId === msg.id;
              return (
                <div
                  key={msg.id}
                  className={`cursor-pointer rounded-xl border p-5 transition-all ${
                    msg.is_read 
                      ? "border-border bg-card/40 opacity-80 hover:opacity-100 hover:bg-card" 
                      : "border-l-4 border-l-primary border-y-primary/20 border-r-primary/20 bg-primary/5 shadow-sm"
                  }`}
                  onClick={() => {
                    if (!msg.is_read) markRead.mutate(msg.id);
                    setExpandedId(isExpanded ? null : msg.id);
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-4 w-full">
                      <div className={`mt-1 flex-shrink-0 rounded-full p-2 ${msg.is_read ? 'bg-secondary' : 'bg-primary/20 text-primary'}`}>
                        {getIcon(msg.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className={`text-lg ${!msg.is_read ? 'font-bold text-foreground' : 'font-medium text-foreground/80'}`}>
                            {msg.title}
                          </h3>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(msg.created_at)}
                            </span>
                            <div className="hidden sm:block">
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </div>
                          </div>
                        </div>

                        {/* Collapsed content preview vs Expanded content */}
                        {isExpanded ? (
                          <div className="mt-3">
                            <p className="whitespace-pre-wrap text-sm text-foreground/90">
                              {msg.body}
                            </p>
                            {msg.type === 'ticket_delivery' && msg.related_order_id && (
                              <div className="mt-6">
                                <Button asChild size="sm" className="w-full sm:w-auto">
                                  <Link to="/orders/$orderId/tickets" params={{ orderId: msg.related_order_id }} search={{}} onClick={(e) => e.stopPropagation()}>
                                    <QrCode className="mr-2 h-4 w-4" /> View Ticket Details
                                  </Link>
                                </Button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                            {msg.body}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {hasNextPage && (
              <div className="pt-4 flex justify-center">
                <Button 
                  variant="outline" 
                  onClick={(e) => {
                    e.stopPropagation();
                    fetchNextPage();
                  }} 
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? "Loading..." : "Load more messages"}
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-border py-24 text-center">
            <Mail className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-semibold">No messages yet</h3>
            <p className="text-sm text-muted-foreground">When you buy tickets or receive updates, they'll show up here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
