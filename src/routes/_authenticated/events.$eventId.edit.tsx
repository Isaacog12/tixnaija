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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

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

  const { data: promoCodes, error: e3 } = await supabase
    .from("promo_codes")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (e3) throw e3;

  const { data: profile } = await supabase
    .from("profiles")
    .select("paystack_subaccount_code")
    .eq("id", event.organizer_id)
    .maybeSingle();

  return { 
    event, 
    types: types ?? [], 
    promoCodes: promoCodes ?? [],
    hasPayoutAccount: !!profile?.paystack_subaccount_code
  };
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
    title: "", description: "", city: "", venue_name: "",
    start_datetime: "", status: "draft" as (typeof STATUSES)[number]["value"],
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
        start_datetime: ev.start_datetime ? new Date(ev.start_datetime).toISOString().slice(0, 16) : "",
        status: (ev.status as typeof form.status) ?? "draft",
      });
    }
  }, [data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (form.status === "published" && !data?.hasPayoutAccount) {
      toast.error("Please connect your payout account in Settings to publish events.");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("events")
      .update({
        title: form.title,
        description: form.description || null,
        city: form.city,
        venue_name: form.venue_name,
        address: null,
        state: null,
        start_datetime: new Date(form.start_datetime).toISOString(),
        end_datetime: null,
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
    const { count, error: countErr } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId);
      
    if (countErr) return toast.error(countErr.message);
    if (count && count > 0) {
      return toast.error("Can't delete an event with existing ticket sales — cancel it instead.");
    }

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
            <Field label="City"><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
            <Field label="Starts"><Input type="datetime-local" value={form.start_datetime} onChange={(e) => setForm({ ...form, start_datetime: e.target.value })} /></Field>
            <Field label="Status" className="md:col-span-2">
              <Select value={form.status} onValueChange={(v: typeof form.status) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft (hidden)</SelectItem>
                  <SelectItem value="published" disabled={!data?.hasPayoutAccount}>
                    Published {(!data?.hasPayoutAccount) && "(Requires Payout Account)"}
                  </SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              {!data?.hasPayoutAccount && form.status !== "published" && (
                <p className="mt-1 text-xs text-destructive">
                  ⚠️ Connect payout account in settings to publish.
                </p>
              )}
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

      {/* Advanced Actions (Comp / Cancel / Postpone) */}
      <section className="mt-10 rounded-2xl border border-border bg-card/60 p-6">
        <h2 className="mb-4 text-lg font-semibold">Event Actions</h2>
        <div className="flex flex-wrap gap-4">
          <CompTicketsDialog eventId={eventId} ticketTypes={data.types} />
          {data.event.status !== "cancelled" && (
            <>
              <PostponeEventDialog eventId={eventId} eventStart={data.event.start_datetime} eventEnd={data.event.end_datetime ?? undefined} />
              <CancelEventDialog eventId={eventId} />
            </>
          )}
        </div>
      </section>

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

      {/* Promo Codes */}
      <PromoCodesSection eventId={eventId} promoCodes={data.promoCodes} />
    </div>
  );
}

function TicketRow({
  row,
  eventId,
}: {
  row: any;
  eventId: string;
}) {
  const qc = useQueryClient();
  const [state, setState] = useState({
    name: row.name,
    price_naira: String(koboToNaira(row.price_kobo)),
    quantity_available: String(row.quantity_available),
    max_per_order: String(row.max_per_order),
    sales_start_at: row.sales_start_at ? new Date(row.sales_start_at).toISOString().slice(0, 16) : "",
    sales_end_at: row.sales_end_at ? new Date(row.sales_end_at).toISOString().slice(0, 16) : "",
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
      sales_start_at: state.sales_start_at ? new Date(state.sales_start_at).toISOString() : null,
      sales_end_at: state.sales_end_at ? new Date(state.sales_end_at).toISOString() : null,
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
        <div className="space-y-1.5 md:col-span-2">
          <Label>Sales Start (Optional)</Label>
          <Input type="datetime-local" value={state.sales_start_at} onChange={(e) => setState({ ...state, sales_start_at: e.target.value })} />
        </div>
        <div className="space-y-1.5 md:col-span-3">
          <Label>Sales End (Optional)</Label>
          <Input type="datetime-local" value={state.sales_end_at} onChange={(e) => setState({ ...state, sales_end_at: e.target.value })} />
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

function PromoCodesSection({ eventId, promoCodes }: { eventId: string; promoCodes: any[] }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    code: "", discount_type: "percent" as "percent"|"fixed", discount_value: "", max_uses: "", expires_at: ""
  });
  const [busy, setBusy] = useState(false);

  async function addCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    let val = Number(form.discount_value);
    if (form.discount_type === "fixed") val = nairaToKobo(val);
    
    const { error } = await supabase.from("promo_codes").insert({
      event_id: eventId,
      code: form.code.toUpperCase(),
      discount_type: form.discount_type,
      discount_value: val,
      max_uses: form.max_uses ? parseInt(form.max_uses) : null,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Promo code created");
      setAdding(false);
      qc.invalidateQueries({ queryKey: ["event", eventId] });
      setForm({ code: "", discount_type: "percent", discount_value: "", max_uses: "", expires_at: "" });
    }
  }

  async function toggleStatus(id: string, current: boolean) {
    const { error } = await supabase.from("promo_codes").update({ active: !current }).eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["event", eventId] });
  }

  async function removeCode(id: string) {
    if (!confirm("Delete promo code?")) return;
    const { error } = await supabase.from("promo_codes").delete().eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["event", eventId] });
  }

  return (
    <section className="mt-10 rounded-2xl border border-border bg-card/60 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Promo Codes</h2>
        {!adding && (
          <Button type="button" size="sm" variant="outline" onClick={() => setAdding(true)}>
            Add code
          </Button>
        )}
      </div>

      {adding && (
        <form onSubmit={addCode} className="mb-6 space-y-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Code Name"><Input required value={form.code} onChange={e => setForm({...form, code: e.target.value.toUpperCase()})} placeholder="SUMMER25" /></Field>
            <Field label="Discount Type">
              <Select value={form.discount_type} onValueChange={(v: "percent"|"fixed") => setForm({...form, discount_type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percentage (%)</SelectItem>
                  <SelectItem value="fixed">Fixed Amount (₦)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Discount Value"><Input required type="number" step="any" min="0" value={form.discount_value} onChange={e => setForm({...form, discount_value: e.target.value})} placeholder={form.discount_type === "percent" ? "10" : "5000"} /></Field>
            <Field label="Max Uses (Optional)"><Input type="number" min="1" value={form.max_uses} onChange={e => setForm({...form, max_uses: e.target.value})} placeholder="Unlimited" /></Field>
            <Field label="Expires At (Optional)" className="md:col-span-2"><Input type="datetime-local" value={form.expires_at} onChange={e => setForm({...form, expires_at: e.target.value})} /></Field>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={busy}>{busy ? "Adding..." : "Save Code"}</Button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {promoCodes.map((p) => (
          <div key={p.id} className={`flex items-center justify-between rounded-xl border p-4 ${p.active ? 'border-border bg-background/50' : 'border-muted bg-muted/20 opacity-60'}`}>
            <div>
              <p className="font-semibold">{p.code}</p>
              <p className="text-sm text-muted-foreground">
                {p.discount_type === "percent" ? `${p.discount_value}%` : formatNaira(p.discount_value)} off
                {" · "} 
                Used {p.times_used} {p.max_uses ? `/ ${p.max_uses}` : ""} times
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => toggleStatus(p.id, p.active)}>
                {p.active ? "Disable" : "Enable"}
              </Button>
              <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => removeCode(p.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
        {promoCodes.length === 0 && !adding && (
          <p className="text-sm text-muted-foreground">No promo codes active.</p>
        )}
      </div>
    </section>
  );
}

function CompTicketsDialog({ eventId, ticketTypes }: { eventId: string, ticketTypes: any[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ticketTypeId, setTicketTypeId] = useState("");
  const [recipientsText, setRecipientsText] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ticketTypeId) return toast.error("Select a ticket tier");
    
    const lines = recipientsText.split("\n").map(l => l.trim()).filter(Boolean);
    const recipients = [];
    for (const line of lines) {
      const parts = line.split(",");
      if (parts.length < 2) return toast.error(`Invalid line format: ${line}. Use "Name, Email"`);
      recipients.push(JSON.stringify({ name: parts[0].trim(), email: parts[1].trim() }));
    }
    
    if (recipients.length === 0) return toast.error("Enter at least one recipient");
    
    setBusy(true);
    const { error } = await supabase.rpc("issue_comp_tickets", {
      p_event_id: eventId,
      p_ticket_type_id: ticketTypeId,
      p_recipients: recipients,
    });
    setBusy(false);
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`${recipients.length} comp tickets issued!`);
      setOpen(false);
      setRecipientsText("");
      qc.invalidateQueries({ queryKey: ["event", eventId] });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Issue Comp Tickets</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Issue Complimentary Tickets</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Ticket Tier">
            <Select value={ticketTypeId} onValueChange={setTicketTypeId}>
              <SelectTrigger><SelectValue placeholder="Select ticket tier" /></SelectTrigger>
              <SelectContent>
                {ticketTypes.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Recipients (One per line: Name, Email)">
            <Textarea 
              rows={5} 
              required
              placeholder={`Chinedu Okafor, chinedu@company.com\nNneka Eze, nneka@company.com`}
              value={recipientsText} 
              onChange={e => setRecipientsText(e.target.value)} 
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Issuing..." : "Issue Tickets"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CancelEventDialog({ eventId }: { eventId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  async function handleCancel() {
    if (!confirm("Are you sure? This cannot be undone and buyers will be notified.")) return;
    setBusy(true);
    const { error } = await supabase.rpc("cancel_event", {
      p_event_id: eventId,
      p_note: note || "",
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Event cancelled and buyers notified");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["event", eventId] });
      qc.invalidateQueries({ queryKey: ["my-events"] });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="text-destructive hover:text-destructive border-destructive/50 hover:bg-destructive/10">Cancel Event</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel Event</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Cancelling an event will notify all valid ticket holders and update the event status to cancelled. You will still need to manually issue refunds through Paystack.
          </p>
          <Field label="Cancellation Note (Sent to buyers)">
            <Textarea 
              rows={3} 
              placeholder="e.g. Due to unforeseen circumstances..."
              value={note} 
              onChange={e => setNote(e.target.value)} 
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Back</Button>
            <Button variant="destructive" disabled={busy} onClick={handleCancel}>{busy ? "Cancelling..." : "Confirm Cancellation"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PostponeEventDialog({ eventId, eventStart, eventEnd }: { eventId: string, eventStart?: string, eventEnd?: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [start, setStart] = useState(eventStart ? new Date(eventStart).toISOString().slice(0, 16) : "");
  const [end, setEnd] = useState(eventEnd ? new Date(eventEnd).toISOString().slice(0, 16) : "");
  const [note, setNote] = useState("");

  async function handlePostpone() {
    if (!start) return toast.error("New start date is required");
    setBusy(true);
    const { error } = await supabase.rpc("postpone_event", {
      p_event_id: eventId,
      p_new_start: new Date(start).toISOString(),
      p_new_end: end ? new Date(end).toISOString() : null,
      p_note: note || "",
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Event postponed and buyers notified");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["event", eventId] });
      qc.invalidateQueries({ queryKey: ["my-events"] });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Postpone Event</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Postpone Event</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Postponing will update the event dates and automatically notify all valid ticket holders that their tickets remain valid.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="New Start Date"><Input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} /></Field>
            <Field label="New End Date"><Input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} /></Field>
          </div>
          <Field label="Note for Buyers">
            <Textarea 
              rows={3} 
              placeholder="e.g. We apologize for the delay..."
              value={note} 
              onChange={e => setNote(e.target.value)} 
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={busy} onClick={handlePostpone}>{busy ? "Postponing..." : "Confirm Postponement"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
