import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowLeft, ImagePlus, Plus, Trash2 } from "lucide-react";
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
import { slugify } from "@/lib/slug";
import { nairaToKobo, formatNaira } from "@/lib/currency";

export const Route = createFileRoute("/_authenticated/events/new")({
  component: NewEventPage,
});

const CATEGORIES = [
  { value: "music", label: "Music / Concert" },
  { value: "comedy", label: "Comedy" },
  { value: "conference", label: "Conference" },
  { value: "church", label: "Church program" },
  { value: "campus", label: "Campus event" },
  { value: "party", label: "Party" },
  { value: "sport", label: "Sport" },
  { value: "other", label: "Other" },
] as const;

const eventSchema = z.object({
  title: z.string().trim().min(3, "Title is too short").max(120),
  description: z.string().trim().max(4000).optional(),
  category: z.enum(["music", "comedy", "conference", "church", "campus", "party", "sport", "other"]),
  venue_name: z.string().trim().max(120).optional(),
  address: z.string().trim().max(200).optional(),
  city: z.string().trim().min(2, "City is required").max(60),
  state: z.string().trim().max(60).optional(),
  start_datetime: z.string().min(1, "Pick a start date & time"),
  end_datetime: z.string().optional(),
});

interface TicketDraft {
  name: string;
  price_naira: string;
  quantity_available: string;
  max_per_order: string;
  description: string;
}

function emptyTicket(): TicketDraft {
  return { name: "", price_naira: "", quantity_available: "", max_per_order: "10", description: "" };
}

function NewEventPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "music" as (typeof CATEGORIES)[number]["value"],
    venue_name: "",
    address: "",
    city: "",
    state: "",
    start_datetime: "",
    end_datetime: "",
  });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>("");
  const [tickets, setTickets] = useState<TicketDraft[]>([
    { name: "Regular", price_naira: "5000", quantity_available: "100", max_per_order: "10", description: "" },
  ]);
  const [publish, setPublish] = useState(true);
  const [busy, setBusy] = useState(false);

  function updateTicket(idx: number, patch: Partial<TicketDraft>) {
    setTickets((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  }

  function onPickCover(f: File | null) {
    setCoverFile(f);
    if (f) setCoverPreview(URL.createObjectURL(f));
    else setCoverPreview("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = eventSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the event details");
      return;
    }
    if (tickets.length === 0) {
      toast.error("Add at least one ticket type");
      return;
    }
    const parsedTickets: {
      name: string;
      price_kobo: number;
      quantity_available: number;
      max_per_order: number;
      description: string | null;
      sort_order: number;
    }[] = [];
    for (let i = 0; i < tickets.length; i++) {
      const t = tickets[i];
      if (!t.name.trim()) return toast.error(`Ticket #${i + 1}: name required`);
      const price = Number(t.price_naira);
      const qty = Number(t.quantity_available);
      const max = Number(t.max_per_order || "10");
      if (Number.isNaN(price) || price < 0) return toast.error(`Ticket #${i + 1}: invalid price`);
      if (!Number.isInteger(qty) || qty < 1) return toast.error(`Ticket #${i + 1}: quantity must be ≥ 1`);
      if (!Number.isInteger(max) || max < 1) return toast.error(`Ticket #${i + 1}: max per order must be ≥ 1`);
      parsedTickets.push({
        name: t.name.trim(),
        price_kobo: nairaToKobo(price),
        quantity_available: qty,
        max_per_order: max,
        description: t.description.trim() || null,
        sort_order: i,
      });
    }

    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Not signed in");

      // Ensure organizer role — quietly upgrade if user hit this page directly.
      await supabase.from("profiles").update({ is_organizer: true }).eq("id", userId);
      await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: "organizer" })
        .then((r) => (r.error && !r.error.message.includes("duplicate") ? Promise.reject(r.error) : null))
        .catch(() => null);

      // Upload cover if any
      let coverUrl: string | null = null;
      if (coverFile) {
        const ext = coverFile.name.split(".").pop() ?? "jpg";
        const path = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("event-covers")
          .upload(path, coverFile, { cacheControl: "3600", upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("event-covers").getPublicUrl(path);
        coverUrl = pub.publicUrl;
      }

      const slug = slugify(parsed.data.title);
      const { data: event, error: evErr } = await supabase
        .from("events")
        .insert({
          organizer_id: userId,
          title: parsed.data.title,
          slug,
          description: parsed.data.description || null,
          category: parsed.data.category,
          cover_image_url: coverUrl,
          venue_name: parsed.data.venue_name || null,
          address: parsed.data.address || null,
          city: parsed.data.city,
          state: parsed.data.state || null,
          start_datetime: new Date(parsed.data.start_datetime).toISOString(),
          end_datetime: parsed.data.end_datetime ? new Date(parsed.data.end_datetime).toISOString() : null,
          status: publish ? "published" : "draft",
        })
        .select("id")
        .single();
      if (evErr) throw evErr;

      const { error: ttErr } = await supabase.from("ticket_types").insert(
        parsedTickets.map((t) => ({ event_id: event.id, ...t })),
      );
      if (ttErr) throw ttErr;

      toast.success(publish ? "Event published! 🎉" : "Event saved as draft");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create event");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <a href="/dashboard">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to dashboard
        </a>
      </Button>

      <h1 className="font-display text-4xl md:text-5xl">Create event</h1>
      <p className="text-muted-foreground">Fill it in, publish, and start selling.</p>

      <form onSubmit={submit} className="mt-8 space-y-6">
        {/* Cover */}
        <section className="rounded-2xl border border-border bg-card/60 p-6">
          <h2 className="mb-4 text-lg font-semibold">Cover image</h2>
          <label
            className="relative flex h-52 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-secondary/40 transition hover:border-primary/50"
            style={coverPreview ? { backgroundImage: `url(${coverPreview})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
          >
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onPickCover(e.target.files?.[0] ?? null)}
            />
            {!coverPreview && (
              <div className="text-center text-sm text-muted-foreground">
                <ImagePlus className="mx-auto mb-2 h-8 w-8" />
                Tap to upload a cover image
              </div>
            )}
          </label>
        </section>

        {/* Details */}
        <section className="rounded-2xl border border-border bg-card/60 p-6">
          <h2 className="mb-4 text-lg font-semibold">Details</h2>
          <div className="grid gap-4">
            <Field label="Event title">
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Detty December Concert 2026" />
            </Field>
            <Field label="Description">
              <Textarea rows={5} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Line-up, dress code, what to expect…" />
            </Field>
            <Field label="Category">
              <Select value={form.category} onValueChange={(v: typeof form.category) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </section>

        {/* Venue */}
        <section className="rounded-2xl border border-border bg-card/60 p-6">
          <h2 className="mb-4 text-lg font-semibold">Venue & date</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Venue name" className="md:col-span-2">
              <Input value={form.venue_name} onChange={(e) => setForm({ ...form, venue_name: e.target.value })} placeholder="Eko Hotel" />
            </Field>
            <Field label="Address" className="md:col-span-2">
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
            <Field label="City">
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Lagos" />
            </Field>
            <Field label="State">
              <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="Lagos" />
            </Field>
            <Field label="Starts">
              <Input type="datetime-local" value={form.start_datetime} onChange={(e) => setForm({ ...form, start_datetime: e.target.value })} />
            </Field>
            <Field label="Ends (optional)">
              <Input type="datetime-local" value={form.end_datetime} onChange={(e) => setForm({ ...form, end_datetime: e.target.value })} />
            </Field>
          </div>
        </section>

        {/* Tickets */}
        <section className="rounded-2xl border border-border bg-card/60 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Ticket types</h2>
            <Button type="button" size="sm" variant="outline" onClick={() => setTickets([...tickets, emptyTicket()])}>
              <Plus className="mr-1 h-4 w-4" /> Add ticket
            </Button>
          </div>
          <div className="space-y-4">
            {tickets.map((t, i) => (
              <div key={i} className="rounded-xl border border-border bg-background/50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-medium text-muted-foreground">Ticket #{i + 1}</div>
                  {tickets.length > 1 && (
                    <Button type="button" size="icon" variant="ghost" onClick={() => setTickets(tickets.filter((_, x) => x !== i))}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <Field label="Name" className="md:col-span-2">
                    <Input value={t.name} onChange={(e) => updateTicket(i, { name: e.target.value })} placeholder="Regular / VIP / Early Bird" />
                  </Field>
                  <Field label="Price (₦)">
                    <Input inputMode="decimal" value={t.price_naira} onChange={(e) => updateTicket(i, { price_naira: e.target.value })} placeholder="5000" />
                  </Field>
                  <Field label="Quantity">
                    <Input inputMode="numeric" value={t.quantity_available} onChange={(e) => updateTicket(i, { quantity_available: e.target.value })} placeholder="100" />
                  </Field>
                  <Field label="Max per order">
                    <Input inputMode="numeric" value={t.max_per_order} onChange={(e) => updateTicket(i, { max_per_order: e.target.value })} />
                  </Field>
                  <Field label="Description" className="md:col-span-3">
                    <Input value={t.description} onChange={(e) => updateTicket(i, { description: e.target.value })} placeholder="Includes welcome drink" />
                  </Field>
                </div>
                {t.price_naira && !Number.isNaN(Number(t.price_naira)) && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Preview: <span className="text-gradient-sunset font-semibold">{formatNaira(nairaToKobo(Number(t.price_naira)))}</span>
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Publish */}
        <section className="rounded-2xl border border-border bg-card/60 p-6">
          <div className="flex items-center gap-3">
            <input id="publish" type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} className="h-4 w-4 accent-primary" />
            <Label htmlFor="publish">Publish immediately (uncheck to save as draft)</Label>
          </div>
        </section>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/dashboard" })}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy} className="gradient-sunset text-primary-foreground shadow-glow hover:opacity-90">
            {busy ? "Creating…" : publish ? "Publish event" : "Save draft"}
          </Button>
        </div>
      </form>
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
