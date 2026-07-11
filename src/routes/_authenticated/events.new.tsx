import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowLeft, ImagePlus, Plus, Trash2, Loader2 } from "lucide-react";
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
  const [isCheckingRole, setIsCheckingRole] = useState(true);
  const [hasOrganizerRole, setHasOrganizerRole] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  
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

  useEffect(() => {
    async function checkRole() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setIsCheckingRole(false);
        return;
      }
      setUserId(userData.user.id);

      // Live role check directly from DB
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("*")
        .eq("user_id", userData.user.id)
        .eq("role", "organizer");
      
      if (!error && roles && roles.length > 0) {
        setHasOrganizerRole(true);
      }
      setIsCheckingRole(false);
    }
    checkRole();
  }, []);

  async function becomeOrganizer() {
    setBusy(true);
    try {
      if (!userId) throw new Error("Not signed in");
      
      // Grant organizer role
      const { error: roleErr } = await supabase
        .from("user_roles")
        .upsert({ user_id: userId, role: "organizer" }, { onConflict: "user_id,role", ignoreDuplicates: true });
      
      if (roleErr) throw new Error("Failed to grant organizer role: " + roleErr.message);

      // Update profiles using the secure RPC
      await supabase.rpc("set_organizer_status", { is_org: true });

      // Refresh session
      const { error: refreshErr } = await supabase.auth.refreshSession();
      if (refreshErr) console.warn("Failed to refresh session:", refreshErr);

      setHasOrganizerRole(true);
      toast.success("You are now an organizer!");
    } catch (err: any) {
      toast.error(err.message || "Failed to become organizer");
    } finally {
      setBusy(false);
    }
  }

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
      // Re-fetch user ID to be 100% sure we are using the current session
      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData.user?.id;
      if (!currentUserId) throw new Error("Not signed in");

      // Upload cover if any
      let coverUrl: string | null = null;
      if (coverFile) {
        const ext = coverFile.name.split(".").pop() ?? "jpg";
        const path = `${currentUserId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("event-covers")
          .upload(path, coverFile, { cacheControl: "3600", upsert: false });
        if (upErr) throw new Error(`Failed to upload cover: ${upErr.message}`);
        const { data: pub } = supabase.storage.from("event-covers").getPublicUrl(path);
        coverUrl = pub.publicUrl;
      }

      const slug = slugify(parsed.data.title);
      
      const payload = {
        organizer_id: currentUserId,
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
        status: (publish ? "published" : "draft") as "published" | "draft",
      };
      
      console.log("DEBUG: Inserting event payload", payload);

      const { data: event, error: evErr } = await supabase
        .from("events")
        .insert(payload)
        .select("id")
        .single();
      
      if (evErr) {
        console.error("Event insert failed", evErr);
        throw new Error(`Database error on events: ${evErr.message || evErr.details || evErr.hint}`);
      }

      const { error: ttErr } = await supabase.from("ticket_types").insert(
        parsedTickets.map((t) => ({ event_id: event.id, ...t })),
      );
      if (ttErr) {
        console.error("Ticket types insert failed", ttErr);
        throw new Error(`Database error on tickets: ${ttErr.message}`);
      }

      toast.success(publish ? "Event published! 🎉" : "Event saved as draft");
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err.message || "Failed to create event");
    } finally {
      setBusy(false);
    }
  }

  if (isCheckingRole) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasOrganizerRole) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="font-display text-4xl text-gradient-sunset">Become an Organizer</h1>
        <p className="mt-4 text-muted-foreground">
          You need an organizer profile to create events. It's free and instant.
        </p>
        <Button 
          onClick={becomeOrganizer} 
          disabled={busy}
          className="mt-8 gradient-sunset text-primary-foreground shadow-glow hover:opacity-90"
        >
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Setup Organizer Profile
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/dashboard">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to dashboard
        </Link>
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

        {/* Location & Time */}
        <section className="rounded-2xl border border-border bg-card/60 p-6">
          <h2 className="mb-4 text-lg font-semibold">Where & When</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Venue name (optional)">
              <Input value={form.venue_name} onChange={(e) => setForm({ ...form, venue_name: e.target.value })} placeholder="Eko Hotel" />
            </Field>
            <div className="hidden sm:block" />
            <Field label="Address (optional)">
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="1415 Adetokunbo Ademola St" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="City">
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Lagos" />
              </Field>
              <Field label="State (optional)">
                <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="LA" />
              </Field>
            </div>
            <Field label="Starts at">
              <Input type="datetime-local" value={form.start_datetime} onChange={(e) => setForm({ ...form, start_datetime: e.target.value })} />
            </Field>
            <Field label="Ends at (optional)">
              <Input type="datetime-local" value={form.end_datetime} onChange={(e) => setForm({ ...form, end_datetime: e.target.value })} />
            </Field>
          </div>
        </section>

        {/* Tickets */}
        <section className="rounded-2xl border border-border bg-card/60 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Tickets</h2>
            <Button type="button" variant="outline" size="sm" onClick={() => setTickets([...tickets, emptyTicket()])}>
              <Plus className="mr-1 h-4 w-4" /> Add tier
            </Button>
          </div>
          <div className="space-y-4">
            {tickets.map((t, i) => (
              <div key={i} className="relative rounded-xl border border-border bg-background/50 p-4 pt-8">
                {tickets.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-2 h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => setTickets(tickets.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Ticket name">
                    <Input value={t.name} onChange={(e) => updateTicket(i, { name: e.target.value })} placeholder="VIP, Early Bird…" />
                  </Field>
                  <Field label="Price (₦) - 0 for free">
                    <Input type="number" min="0" value={t.price_naira} onChange={(e) => updateTicket(i, { price_naira: e.target.value })} placeholder="5000" />
                  </Field>
                  <Field label="Total quantity available">
                    <Input type="number" min="1" value={t.quantity_available} onChange={(e) => updateTicket(i, { quantity_available: e.target.value })} placeholder="100" />
                  </Field>
                  <Field label="Max per order">
                    <Input type="number" min="1" value={t.max_per_order} onChange={(e) => updateTicket(i, { max_per_order: e.target.value })} placeholder="10" />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Description (optional)">
                      <Input value={t.description} onChange={(e) => updateTicket(i, { description: e.target.value })} placeholder="Includes drinks and backstage access" />
                    </Field>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Submit */}
        <div className="flex items-center gap-3 pt-4">
          <Button
            type="submit"
            disabled={busy}
            onClick={() => setPublish(true)}
            className="flex-1 gradient-sunset text-primary-foreground shadow-glow hover:opacity-90"
            size="lg"
          >
            {busy && publish ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Publish event
          </Button>
          <Button
            type="submit"
            disabled={busy}
            onClick={() => setPublish(false)}
            variant="outline"
            className="flex-1"
            size="lg"
          >
            {busy && !publish ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save as draft
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
