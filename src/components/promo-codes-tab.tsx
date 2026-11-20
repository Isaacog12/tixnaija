import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/currency";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Tag, Trash2, Edit2, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
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

const promoSchema = z.object({
  event_id: z.string().uuid(),
  code: z.string().min(3, "Code must be at least 3 characters").max(30, "Code too long").trim().toUpperCase(),
  discount_type: z.enum(["percent", "fixed"]),
  discount_value: z.coerce.number().min(1, "Value must be greater than 0"),
  max_uses: z.coerce.number().optional().nullable(),
  expires_at: z.string().optional().nullable(),
});

type PromoFormValues = z.infer<typeof promoSchema>;

export function PromoCodesTab({ events }: { events: { id: string; title: string }[] }) {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<any>(null);

  const { data: promos, isLoading } = useQuery({
    queryKey: ["promo-codes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promo_codes")
        .select("*, events(title)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<PromoFormValues>({
    resolver: zodResolver(promoSchema),
    defaultValues: {
      event_id: "",
      code: "",
      discount_type: "percent",
      discount_value: 10,
      max_uses: null,
      expires_at: null,
    },
  });

  const savePromo = useMutation({
    mutationFn: async (values: PromoFormValues) => {
      if (values.discount_type === "percent" && values.discount_value > 100) {
        throw new Error("Percentage discount cannot exceed 100%");
      }
      const payload = {
        ...values,
        code: values.code.trim().toUpperCase(),
      };
      
      if (editingPromo) {
        const { error } = await supabase.from("promo_codes").update(payload).eq("id", editingPromo.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("promo_codes").insert([payload]);
        if (error) {
          if (error.code === '23505') throw new Error("A promo code with this name already exists for this event.");
          throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promo-codes"] });
      toast.success(editingPromo ? "Promo code updated" : "Promo code created");
      setIsCreateOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save promo code");
    },
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("promo_codes").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promo-codes"] });
      toast.success("Status updated");
    },
  });

  function openCreate() {
    setEditingPromo(null);
    form.reset({
      event_id: events.length === 1 ? events[0].id : "",
      code: "",
      discount_type: "percent",
      discount_value: 10,
      max_uses: null,
      expires_at: null,
    });
    setIsCreateOpen(true);
  }

  function openEdit(p: any) {
    setEditingPromo(p);
    form.reset({
      event_id: p.event_id,
      code: p.code,
      discount_type: p.discount_type,
      discount_value: p.discount_value,
      max_uses: p.max_uses,
      expires_at: p.expires_at ? new Date(p.expires_at).toISOString().slice(0, 16) : null,
    });
    setIsCreateOpen(true);
  }

  function generateCode() {
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
    form.setValue("code", `SAVE${randomStr}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-display">Promo Codes</h2>
          <p className="text-sm text-muted-foreground">Manage discount codes for your events.</p>
        </div>
        <Button onClick={openCreate} className="h-9 px-4 rounded-md">
          <Plus className="mr-2 h-4 w-4" /> New Promo Code
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-secondary/30 text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-semibold">Code</th>
                <th className="px-5 py-3 font-semibold">Event</th>
                <th className="px-5 py-3 font-semibold">Discount</th>
                <th className="px-5 py-3 font-semibold">Usage</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : promos?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary mb-4">
                        <Tag className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="font-medium text-foreground">No promo codes yet</p>
                      <p className="text-sm text-muted-foreground mt-1">Create your first code to offer discounts.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                promos?.map((p) => {
                  const isExpired = p.expires_at && new Date(p.expires_at) < new Date();
                  const isExhausted = p.max_uses && p.times_used >= p.max_uses;
                  let badge = <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Active</Badge>;
                  if (!p.active) badge = <Badge variant="outline" className="bg-muted text-muted-foreground border-transparent">Disabled</Badge>;
                  else if (isExpired) badge = <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">Expired</Badge>;
                  else if (isExhausted) badge = <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">Exhausted</Badge>;

                  return (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-4 font-mono font-bold">{p.code}</td>
                      <td className="px-5 py-4 text-muted-foreground truncate max-w-[200px]" title={p.events?.title}>
                        {p.events?.title || "Unknown Event"}
                      </td>
                      <td className="px-5 py-4 font-medium text-primary">
                        {p.discount_type === "percent" ? `${p.discount_value}%` : formatNaira(p.discount_value)}
                      </td>
                      <td className="px-5 py-4 text-xs">
                        {p.times_used} {p.max_uses ? `/ ${p.max_uses}` : "uses"}
                      </td>
                      <td className="px-5 py-4">{badge}</td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                            Edit
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
            <DialogTitle>{editingPromo ? "Edit Promo Code" : "Create Promo Code"}</DialogTitle>
            <DialogDescription>
              Discounts will be applied at checkout before payment.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => savePromo.mutate(v))} className="space-y-4 pt-4">
              <FormField
                control={form.control}
                name="event_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Applicable Event</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!!editingPromo}>
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

              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input placeholder="e.g. EARLYBIRD" className="font-mono uppercase" {...field} />
                      </FormControl>
                      <Button type="button" variant="outline" onClick={generateCode}>
                        Generate
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="discount_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="percent">Percentage (%)</SelectItem>
                          <SelectItem value="fixed">Fixed Amount</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="discount_value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Value</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="max_uses"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Uses (Optional)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="Unlimited" {...field} value={field.value || ""} onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : null)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="expires_at"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expires At (Optional)</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit" disabled={savePromo.isPending} className="w-full">
                {savePromo.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Promo Code
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
