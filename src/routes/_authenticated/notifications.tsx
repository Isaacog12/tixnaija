import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ticket, Mail, Clock, CheckCircle, QrCode, Bell, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/back-button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow, differenceInDays, format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
});

function NotificationsPage() {
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
      toast.error("Failed to mark notification as read");
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

  function getIcon(type: string, isRead: boolean) {
    const baseClass = "h-5 w-5";
    if (type === 'ticket_delivery') return <Ticket className={`${baseClass} ${!isRead ? 'text-primary' : 'text-muted-foreground'}`} />;
    if (type === 'system') return <Bell className={`${baseClass} ${!isRead ? 'text-blue-500' : 'text-muted-foreground'}`} />;
    return <Mail className={`${baseClass} ${!isRead ? 'text-rose-500' : 'text-muted-foreground'}`} />;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 md:py-20 min-h-screen">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between mb-12">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary mb-4 shadow-sm">
            <Bell className="h-3.5 w-3.5" /> Updates & Alerts
          </div>
          <div className="flex items-center gap-4 mb-2">
            <BackButton />
            <h1 className="font-display text-5xl md:text-6xl tracking-tight">
              Your <span className="text-primary">Notifications</span>
            </h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-md">Stay on top of your upcoming events, new tickets, and system announcements.</p>
        </div>
        
        {hasUnread && (
          <div>
            <Button 
              size="lg"
              variant="outline" 
              className="border-primary/20 hover:bg-primary/5 text-foreground shadow-sm rounded-xl h-12 px-6"
              onClick={() => markAllRead.mutate()} 
              disabled={markAllRead.isPending}
            >
              <CheckCircle className="mr-2 h-4 w-4 text-primary" />
              Mark all as read
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-[2rem] bg-card/60" />
            ))}
          </div>
        ) : messages.length > 0 ? (
          <div className="space-y-4 relative">
            {messages.map((msg: any) => {
              const isExpanded = expandedId === msg.id;
              return (
                <div
                  key={msg.id}
                  className={`group cursor-pointer rounded-[1.5rem] border transition-all duration-300 overflow-hidden relative ${
                    msg.is_read 
                      ? "border-border/60 bg-card/40 hover:bg-card/80 hover:shadow-md" 
                      : "border-primary/30 bg-primary/5 shadow-sm shadow-primary/5 hover:bg-primary/10"
                  }`}
                  onClick={() => {
                    if (!msg.is_read) markRead.mutate(msg.id);
                    setExpandedId(isExpanded ? null : msg.id);
                  }}
                >
                  {!msg.is_read && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-[1.5rem]" />
                  )}
                  
                  <div className="p-6 sm:p-8">
                    <div className="flex items-start gap-5 w-full">
                      <div className={`mt-1 flex-shrink-0 rounded-2xl p-3.5 transition-colors ${
                        msg.is_read 
                          ? 'bg-secondary text-muted-foreground' 
                          : 'bg-background shadow-sm border border-primary/20'
                      }`}>
                        {getIcon(msg.type, msg.is_read)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                          <h3 className={`text-lg sm:text-xl font-semibold truncate pr-4 ${!msg.is_read ? 'text-foreground' : 'text-foreground/80'}`}>
                            {msg.title}
                          </h3>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-secondary/50 px-2.5 py-1 rounded-full">
                              <Clock className="h-3 w-3" />
                              {formatDate(msg.created_at)}
                            </span>
                            <div className={`rounded-full p-1 transition-colors ${isExpanded ? 'bg-secondary' : 'group-hover:bg-secondary'}`}>
                              {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                            </div>
                          </div>
                        </div>

                        {isExpanded ? (
                          <div className="pt-3">
                            <p className="whitespace-pre-wrap text-sm sm:text-base text-foreground/90 leading-relaxed">
                              {msg.body}
                            </p>
                            {msg.type === 'ticket_delivery' && msg.related_order_id && (
                              <div className="mt-6">
                                <Button asChild className="rounded-xl h-11 px-6 font-semibold">
                                  <Link to="/orders/$orderId/tickets" params={{ orderId: msg.related_order_id }} search={{}} onClick={(e) => e.stopPropagation()}>
                                    <QrCode className="mr-2 h-4 w-4" /> View Ticket Details
                                  </Link>
                                </Button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="line-clamp-1 text-sm sm:text-base text-muted-foreground pr-8">
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
              <div className="pt-8 flex justify-center">
                <Button 
                  variant="outline" 
                  size="lg"
                  className="rounded-full px-8 border-border/60 hover:bg-secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    fetchNextPage();
                  }} 
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? "Loading..." : "Load more notifications"}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-[2.5rem] border border-dashed border-border/60 bg-card/40 py-24 px-6 text-center shadow-sm max-w-3xl mx-auto mt-8">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-secondary/50 mb-8 relative">
              <Bell className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <h3 className="font-display text-4xl mb-4">All caught up!</h3>
            <p className="max-w-md text-muted-foreground text-lg mb-8 leading-relaxed">
              You don't have any notifications yet. When you buy tickets or receive important updates, they'll appear here.
            </p>
            <Button asChild size="lg" className="rounded-xl h-12 px-8">
              <Link to="/browse">Browse events</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
