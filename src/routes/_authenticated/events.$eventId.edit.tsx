import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatNaira, nairaToKobo, koboToNaira } from "@/lib/currency";

export const Route = createFileRoute("/_authenticated/events/$eventId/edit")({
  component: EditEventPage,
});

const STATUSES = [
  { value: "draft", label: "Draft (hidden)" },
  { value: "published", label: "Published (public)" },
  { value: "cancelled", label: "Cancelled" },
  { value: "completed", label: "Completed" },
] as const;

async function fetchEvent(eventId: string) {
  const { data: event, error: e1 } = await supabase.from("events").select("*").eq("id", eventId).maybeSingle();
  if (e1) throw e1;
  if (!event) throw new Error("Event not found");
  const { data: types, error: e2 } = await supabase
    .from("ticket_types")
    .select("*")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true });
  if (e2) throw e2;
  return { event, types: types ?? [] };
}

function EditEventPage() {
  const { eventId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => fetchEvent(eventId),
  });

  const [form, setForm] = useState({
    title: "", description: "", city: "", venue_name: "", address: "", state: "",
    start_datetime: "", end_datetime: "", status: "draft" as (typeof STATUSES)[number]["value"],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.event) {
      const ev = data.event;
      setForm({
        title: ev.title ?? "",
        description: ev.description ?? "",
        city: ev.city ?? "",
        venue_name: ev.venue_name ?? "",
        address: ev.address ?? "",
        state: ev.state ?? "",
        start_datetime: ev.start_datetime ? new Date(ev.start_datetime).toISOString().slice(0, 16) : "",
        end_datetime: ev.end_datetime ? new Date(ev.end_datetime).toISOString().slice(0, 16) : "",
        status: (ev.status as typeof form.status) ?? "draft",
      });
    }
  }, [data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase
      .from("events")
      .update({
        title: form.title,
        description: form.description || null,
        city: form.city,
        venue_name: form.venue_name || null,
        address: form.address || null,
        state: form.state || null,
        start_datetime: new Date(form.start_datetime).toISOString(),
        end_datetime: form.end_datetime ? new Date(form.end_datetime).toISOString() : null,
        status: form.status,
      })
      .eq("id", eventId);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Event updated");
      qc.invalidateQueries({ queryKey: ["event", eventId] });
      qc.invalidateQueries({ queryKey: ["my-events"] });
    }
  }

  async function deleteEvent() {
    if (!confirm("Delete this event? This cannot be undone.")) return;
    const { error } = await supabase.from("events").delete().eq("id", eventId);
    if (error) toast.error(error.message);
    else {
      toast.success("Event deleted");
      navigate({ to: "/dashboard" });
    }
  }

  async function addTicketType() {
    const { error } = await supabase.from("ticket_types").insert({
      event_id: eventId,
      name: "New tier",
      price_kobo: 0,
      quantity_available: 50,
      max_per_order: 10,
      sort_order: (data?.types.length ?? 0),
    });
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["event", eventId] });
  }

  if (isLoading || !data) {
    return <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <a href="/dashboard"><ArrowLeft className="mr-1 h-4 w-4" /> Back</a>
      </Button>
      <h1 className="font-display text-4xl md:text-5xl">{data.event.title}</h1>
      <p className="text-muted-foreground">Manage details, tickets, and status.</p>

      <form onSubmit={save} className="mt-8 space-y-6">
        <section className="rounded-2xl border border-border bg-card/60 p-6">
          <h2 className="mb-4 text-lg font-semibold">Details</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Title" className="md:col-span-2">
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </Field>
            <Field label="Description" className="md:col-span-2">
              <Textarea rows={5} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <Field label="Venue"><Input value={form.venue_name} onChange={(e) => setForm({ ...form, venue_name: e.target.value })} /></Field>
            <Field label="Address"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
            <Field label="City"><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
            <Field label="State"><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></Field>
            <Field label="Starts"><Input type="datetime-local" value={form.start_datetime} onChange={(e) => setForm({ ...form, start_datetime: e.target.value })} /></Field>
            <Field label="Ends"><Input type="datetime-local" value={form.end_datetime} onChange={(e) => setForm({ ...form, end_datetime: e.target.value })} /></Field>
            <Field label="Status" className="md:col-span-2">
              <Select value={form.status} onValueChange={(v: typeof form.status) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </section>

        <div className="flex flex-wrap justify-between gap-3">
          <Button type="button" variant="outline" onClick={deleteEvent} className="text-destructive hover:text-destructive">
            <Trash2 className="mr-2 h-4 w-4" /> Delete event
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => navigate({ to: "/dashboard" })}>Cancel</Button>
            <Button type="submit" disabled={saving} className="gradient-sunset text-primary-foreground shadow-glow hover:opacity-90">
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </form>

      {/* Ticket types */}
      <section className="mt-10 rounded-2xl border border-border bg-card/60 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Ticket types</h2>
          <Button type="button" size="sm" variant="outline" onClick={addTicketType}>
            Add tier
          </Button>
        </div>
        <div className="space-y-3">
          {data.types.map((t) => (
            <TicketRow key={t.id} row={t} eventId={eventId} />
          ))}
          {data.types.length === 0 && (
            <p className="text-sm text-muted-foreground">No ticket types yet. Add one to start selling.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function TicketRow({
  row,
  eventId,
}: {
  row: { id: string; name: string; price_kobo: number; quantity_available: number; quantity_sold: number; max_per_order: number };
  eventId: string;
}) {
  const qc = useQueryClient();
  const [state, setState] = useState({
    name: row.name,
    price_naira: String(koboToNaira(row.price_kobo)),
    quantity_available: String(row.quantity_available),
    max_per_order: String(row.max_per_order),
  });
  const [busy, setBusy] = useState(false);

  async function save() {
    const price = Number(state.price_naira);
    const qty = Number(state.quantity_available);
    const max = Number(state.max_per_order);
    if (Number.isNaN(price) || price < 0) return toast.error("Invalid price");
    if (!Number.isInteger(qty) || qty < row.quantity_sold) return toast.error(`Quantity must be ≥ sold (${row.quantity_sold})`);
    if (!Number.isInteger(max) || max < 1) return toast.error("Max per order must be ≥ 1");
    setBusy(true);
    const { error } = await supabase.from("ticket_types").update({
      name: state.name,
      price_kobo: nairaToKobo(price),
      quantity_available: qty,
      max_per_order: max,
    }).eq("id", row.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Ticket updated");
      qc.invalidateQueries({ queryKey: ["event", eventId] });
    }
  }

  async function remove() {
    if (row.quantity_sold > 0) return toast.error("Can't delete — tickets already sold");
    if (!confirm(`Delete "${row.name}" ticket type?`)) return;
    const { error } = await supabase.from("ticket_types").delete().eq("id", row.id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["event", eventId] });
  }

  return (
    <div className="rounded-xl border border-border bg-background/50 p-4">
      <div className="grid gap-3 md:grid-cols-5">
        <div className="md:col-span-2 space-y-1.5">
          <Label>Name</Label>
          <Input value={state.name} onChange={(e) => setState({ ...state, name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Price (₦)</Label>
          <Input inputMode="decimal" value={state.price_naira} onChange={(e) => setState({ ...state, price_naira: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Quantity</Label>
          <Input inputMode="numeric" value={state.quantity_available} onChange={(e) => setState({ ...state, quantity_available: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Max/order</Label>
          <Input inputMode="numeric" value={state.max_per_order} onChange={(e) => setState({ ...state, max_per_order: e.target.value })} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <div>
          Sold <span className="font-semibold text-foreground">{row.quantity_sold}</span> of {row.quantity_available} ·
          Revenue <span className="text-gradient-sunset font-semibold">{formatNaira(row.quantity_sold * row.price_kobo)}</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={remove} className="text-destructive hover:text-destructive">
            Remove
          </Button>
          <Button size="sm" onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
