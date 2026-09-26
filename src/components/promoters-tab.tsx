import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/currency";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Users, Copy, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const promoterSchema = z.object({
  event_id: z.string().uuid(),
  name: z.string().min(2, "Name is required").max(100),
  contact_info: z.string().optional().nullable(),
  ticket_type_id: z.string().optional().nullable().transform(val => val === "all" ? null : val),
  unique_code: z.string().min(3).max(30).trim().toUpperCase(),
});

type PromoterFormValues = z.infer<typeof promoterSchema>;

export function PromotersTab({ events }: { events: { id: string; title: string; slug: string }[] }) {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch ticket types for the selected event to allow scoping
  const [selectedEventId, setSelectedEventId] = useState<string>(events.length === 1 ? events[0].id : "");
  
  const { data: ticketTypes } = useQuery({
    queryKey: ["ticket-types", selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const { data, error } = await supabase
        .from("ticket_types")
        .select("id, name")
        .eq("event_id", selectedEventId);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  const { data: promotersData, isLoading } = useQuery({
    queryKey: ["promoters", events.map(e => e.id)],
    queryFn: async () => {
      if (!events.length) return [];
      const { data, error } = await supabase
        .from("promoter_links")
        .select(`
          id, unique_code, active, event_id,
          promoters (name, contact_info),
          ticket_types (name),
          orders (id, total_kobo, status)
        `)
        .in("event_id", events.map((e) => e.id))
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: events.length > 0,
  });

  const form = useForm<PromoterFormValues>({
    resolver: zodResolver(promoterSchema),
    defaultValues: {
      event_id: events.length === 1 ? events[0].id : "",
      name: "",
      contact_info: "",
      ticket_type_id: "all",
      unique_code: "",
    },
  });

  const savePromoter = useMutation({
    mutationFn: async (values: PromoterFormValues) => {
      // 1. Create the promoter
      const { data: promoterData, error: pError } = await supabase
        .from("promoters")
        .insert([{ event_id: values.event_id, name: values.name, contact_info: values.contact_info }])
        .select("id")
        .single();
      
      if (pError) throw pError;

      // 2. Create the link
      const { error: lError } = await supabase
        .from("promoter_links")
        .insert([{
          promoter_id: promoterData.id,
          event_id: values.event_id,
          ticket_type_id: values.ticket_type_id,
          unique_code: values.unique_code,
          active: true,
        }]);
      
      if (lError) {
        if (lError.code === '23505') throw new Error("This referral code is already in use.");
        throw lError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promoters"] });
      toast.success("Promoter link created!");
      setIsCreateOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create promoter");
    },
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("promoter_links").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promoters"] });
      toast.success("Status updated");
    },
  });

  function openCreate() {
    form.reset({
      event_id: events.length === 1 ? events[0].id : "",
      name: "",
      contact_info: "",
      ticket_type_id: "all",
      unique_code: "",
    });
    generateCode();
    setIsCreateOpen(true);
  }

  function generateCode() {
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
    form.setValue("unique_code", `REF${randomStr}`);
  }

  function copyToClipboard(linkId: string, eventId: string, code: string) {
    const event = events.find(e => e.id === eventId);
    if (!event) return;
    
    // Construct full URL
    const url = `${window.location.origin}/e/${event.slug}?ref=${code}`;
    navigator.clipboard.writeText(url);
    
    setCopiedId(linkId);
    toast.success("Link copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-display">Promoters</h2>
          <p className="text-sm text-muted-foreground">Manage promoters and track attribution.</p>
        </div>
        <Button onClick={openCreate} className="h-9 px-4 rounded-md">
          <Plus className="mr-2 h-4 w-4" /> Add Promoter
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-secondary/30 text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-semibold">Promoter</th>
                <th className="px-5 py-3 font-semibold">Scope</th>
                <th className="px-5 py-3 font-semibold">Orders</th>
                <th className="px-5 py-3 font-semibold">Revenue</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : promotersData?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary mb-4">
                        <Users className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="font-medium text-foreground">No promoters yet</p>
                      <p className="text-sm text-muted-foreground mt-1">Generate a link for a promoter to start tracking.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                promotersData?.map((p: any) => {
                  const promoter = Array.isArray(p.promoters) ? p.promoters[0] : p.promoters;
                  const ticketType = Array.isArray(p.ticket_types) ? p.ticket_types[0] : p.ticket_types;
                  
                  const paidOrders = (p.orders || []).filter((o: any) => o.status === 'paid');
                  const totalRevenue = paidOrders.reduce((sum: number, o: any) => sum + (o.total_kobo || 0), 0);
                  
                  return (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-4">
                        <p className="font-medium">{promoter?.name}</p>
                        <p className="text-xs text-muted-foreground">{promoter?.contact_info || "No contact info"}</p>
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">
                        {ticketType ? ticketType.name : "All Tickets"}
                      </td>
                      <td className="px-5 py-4 font-medium">
                        {paidOrders.length}
                      </td>
                      <td className="px-5 py-4 font-medium text-primary">
                        {formatNaira(totalRevenue)}
                      </td>
                      <td className="px-5 py-4">
                        {p.active ? (
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-muted text-muted-foreground border-transparent">Inactive</Badge>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => copyToClipboard(p.id, p.event_id, p.unique_code)}
                          >
                            {copiedId === p.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>
                          <Button 
                            variant={p.active ? "destructive" : "secondary"} 
                            size="sm" 
                            onClick={() => toggleStatus.mutate({ id: p.id, active: !p.active })}
                            disabled={toggleStatus.isPending}
                          >
                            {p.active ? "Disable" : "Enable"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Add Promoter</DialogTitle>
            <DialogDescription>
              Create a unique referral link for a promoter to track their sales.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => savePromoter.mutate(v))} className="space-y-4 pt-4">
              <FormField
                control={form.control}
                name="event_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event</FormLabel>
                    <Select onValueChange={(val) => {
                      field.onChange(val);
                      setSelectedEventId(val);
                      form.setValue("ticket_type_id", "all");
                    }} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an event" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {events.map((e) => (
                          <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Promoter Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contact_info"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Info (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Email or Phone" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="ticket_type_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ticket Scope</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "all"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="all">All Ticket Types</SelectItem>
                        {ticketTypes?.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unique_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Referral Code (in URL)</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input placeholder="e.g. JDOEPARTY" className="font-mono uppercase" {...field} />
                      </FormControl>
                      <Button type="button" variant="outline" onClick={generateCode}>
                        Generate
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={savePromoter.isPending} className="w-full">
                {savePromoter.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create Promoter Link
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
