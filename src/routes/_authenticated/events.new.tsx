import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowLeft, ImagePlus, Plus, Trash2, Loader2, Check, Calendar, MapPin, ChevronRight, ChevronLeft } from "lucide-react";
import { BackButton } from "@/components/back-button";
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
import { Switch } from "@/components/ui/switch";
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

const detailsSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(120),
  description: z.string().trim().max(4000).optional(),
  category: z.enum(["music", "comedy", "conference", "church", "campus", "party", "sport", "other"]),
  venue_name: z.string().trim().min(2, "Venue name is required").max(120),
  city: z.string().trim().min(2, "City is required").max(60),
  start_datetime: z.string().min(1, "Pick a start date & time"),
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

const STEPS = ["Details", "Cover Image", "Tickets", "Review"];

function NewEventPage() {
  const navigate = useNavigate();
  const [isCheckingRole, setIsCheckingRole] = useState(true);
  const [hasOrganizerRole, setHasOrganizerRole] = useState(false);
  const [hasPayoutAccount, setHasPayoutAccount] = useState(false);
  
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "music" as (typeof CATEGORIES)[number]["value"],
    venue_name: "",
    city: "",
    start_datetime: "",
    is_free: false,
  });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>("");
  const [isDraggingCover, setIsDraggingCover] = useState(false);
  const [tickets, setTickets] = useState<TicketDraft[]>([
    { name: "Regular", price_naira: "5000", quantity_available: "100", max_per_order: "10", description: "" },
  ]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function checkRole() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setIsCheckingRole(false);
        return;
      }
      const [rolesResult, profileResult] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userData.user.id).in("role", ["organizer", "admin"]).limit(1),
        supabase.from("profiles").select("paystack_subaccount_code").eq("id", userData.user.id).maybeSingle(),
      ]);
      if (!rolesResult.error && rolesResult.data && rolesResult.data.length > 0) {
        setHasOrganizerRole(true);
      }
      if (profileResult.data?.paystack_subaccount_code) {
        setHasPayoutAccount(true);
      }
      setIsCheckingRole(false);
    }
    checkRole();
  }, []);

  function updateTicket(idx: number, patch: Partial<TicketDraft>) {
    setTickets((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  }

  function handleCoverDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDraggingCover(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onPickCover(e.dataTransfer.files[0]);
    }
  }

  function onPickCover(f: File | null) {
    setCoverFile(f);
    if (f) setCoverPreview(URL.createObjectURL(f));
    else setCoverPreview("");
  }

  function nextStep() {
    if (step === 1) {
      const parsed = detailsSchema.safeParse(form);
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Check the event details");
        return;
      }
    }
    if (step === 3) {
      if (tickets.length === 0) {
        toast.error("Add at least one ticket type");
        return;
      }
      for (let i = 0; i < tickets.length; i++) {
        const t = tickets[i];
        if (!t.name.trim()) return toast.error(`Ticket #${i + 1}: name required`);
        const price = Number(t.price_naira);
        const qty = Number(t.quantity_available);
        const max = Number(t.max_per_order || "10");
        if (Number.isNaN(price) || price < 0) return toast.error(`Ticket #${i + 1}: invalid price`);
        if (!Number.isInteger(qty) || qty < 1) return toast.error(`Ticket #${i + 1}: quantity must be ≥ 1`);
        if (!Number.isInteger(max) || max < 1) return toast.error(`Ticket #${i + 1}: max per order must be ≥ 1`);
      }
    }
    setStep((s) => Math.min(s + 1, 4));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function prevStep() {
    setStep((s) => Math.max(s - 1, 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(publish: boolean) {
    if (publish && !hasPayoutAccount) {
      toast.error("Please connect your payout account in Settings to publish events.");
      return;
    }
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData.user?.id;
      if (!currentUserId) throw new Error("Not signed in");

      let coverUrl: string | null = null;
      if (coverFile) {
        const ext = coverFile.name.split(".").pop() ?? "jpg";
        const path = `${currentUserId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("event-covers").upload(path, coverFile, { cacheControl: "3600", upsert: false });
        if (upErr) throw new Error(`Failed to upload cover: ${upErr.message}`);
        const { data: pub } = supabase.storage.from("event-covers").getPublicUrl(path);
        coverUrl = pub.publicUrl;
      }

      const slug = slugify(form.title);
      const payload = {
        organizer_id: currentUserId,
        title: form.title,
        slug,
        description: form.description || null,
        category: form.category,
        cover_image_url: coverUrl,
        venue_name: form.venue_name,
        address: null,
        city: form.city,
        state: null,
        start_datetime: new Date(form.start_datetime).toISOString(),
        end_datetime: null,
        status: (publish ? "published" : "draft") as "published" | "draft",
      };
      
      const { data: event, error: evErr } = await supabase.from("events").insert(payload).select("id").single();
      if (evErr) throw new Error(`Database error: ${evErr.message}`);

      const parsedTickets = tickets.map((t, i) => ({
        event_id: event.id,
        name: t.name.trim(),
        price_kobo: nairaToKobo(Number(t.price_naira)),
        quantity_available: Number(t.quantity_available),
        max_per_order: Number(t.max_per_order),
        description: t.description.trim() || null,
        sort_order: i,
      }));

      const { error: ttErr } = await supabase.from("ticket_types").insert(parsedTickets);
      if (ttErr) throw new Error(`Ticket error: ${ttErr.message}`);

      toast.success(publish ? "Event published successfully" : "Event saved as draft");
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err.message || "Failed to create event");
    } finally {
      setBusy(false);
    }
  }

  if (isCheckingRole) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!hasOrganizerRole) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <div className="flex items-center gap-4 mb-4 justify-center">
          <BackButton />
          <h1 className="font-display text-4xl text-gradient-sunset">Organizer Access Required</h1>
        </div>
        <p className="mt-4 text-muted-foreground">You need an approved organizer account to create events. Submit an application from your Account Settings page.</p>
        <Button asChild className="mt-8 gradient-sunset text-primary-foreground shadow-glow hover:opacity-90"><Link to="/account">Go to Account Settings</Link></Button>
      </div>
    );
  }

  const livePreview = (
    <div className="group flex flex-col overflow-hidden rounded-2xl bg-card/60 transition-all border border-border/50 max-w-sm mx-auto shadow-glow">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
        {coverPreview ? (
          <img src={coverPreview} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground font-display text-2xl opacity-50 bg-gradient-to-br from-secondary to-background">No Cover Image</div>
        )}
        {form.city && (
          <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/80 px-2.5 py-1 text-xs font-medium backdrop-blur-md z-20">
            <MapPin className="h-3 w-3 text-primary" />
            {form.city}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary">
          <Calendar className="h-3.5 w-3.5" />
          {form.start_datetime ? new Date(form.start_datetime).toLocaleString("en-NG", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Date TBD"}
        </div>
        <h3 className="font-display text-xl leading-tight line-clamp-2 mb-2 group-hover:text-primary transition-colors">
          {form.title || "Your Event Title"}
        </h3>
        {form.venue_name && (
          <p className="text-sm text-muted-foreground line-clamp-1 mb-4">{form.venue_name}</p>
        )}
        <div className="mt-auto pt-4 flex items-center justify-between border-t border-border/50">
          <div className="text-xs text-muted-foreground">Tickets from</div>
          <div className="font-display text-lg text-gradient-sunset">
            {tickets.length ? formatNaira(Math.min(...tickets.map(t => Number(t.price_naira || 0) * 100))) : "Free"}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 pb-32">
      <div className="mb-12">
        <div className="flex items-center gap-4 mb-2">
          <BackButton />
          <h1 className="font-display text-4xl md:text-5xl text-gradient-sunset">Create Event</h1>
        </div>
        <p className="text-muted-foreground mt-2">Follow the steps to get your event published and ready for sales.</p>
      </div>

      {/* Stepper */}
      <div className="mb-12 flex items-center w-full max-w-2xl mx-auto px-4">
        {STEPS.map((label, idx) => {
          const stepNum = idx + 1;
          const isActive = stepNum === step;
          const isPast = stepNum < step;
          const isLast = idx === STEPS.length - 1;
          return (
            <div key={label} className={`flex items-center ${isLast ? "" : "flex-1"}`}>
              <div className="flex flex-col items-center gap-2 relative">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 font-bold transition-all duration-500 ${isActive ? "border-primary bg-primary text-primary-foreground shadow-glow scale-110" : isPast ? "border-primary bg-primary/20 text-primary" : "border-border bg-card text-muted-foreground"}`}>
                  {isPast ? <Check className="h-5 w-5" /> : stepNum}
                </div>
                <span className={`absolute -bottom-6 whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.15em] transition-colors duration-300 ${isActive ? "text-primary" : isPast ? "text-foreground" : "text-muted-foreground/60"}`}>
                  {label}
                </span>
              </div>
              {!isLast && <div className={`h-[2px] flex-1 mx-2 sm:mx-4 rounded-full transition-colors duration-500 ${isPast ? "bg-primary/50" : "bg-border"}`} />}
            </div>
          );
        })}
      </div>

      <div className="min-h-[400px]">
        {/* STEP 1: DETAILS */}
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
            <section className="rounded-3xl border border-border bg-card/40 p-6 md:p-8 shadow-sm backdrop-blur-sm">
              <h2 className="mb-6 font-display text-2xl">Event Details</h2>
              <div className="grid gap-6">
                <Field label="Event title" required>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Detty December Concert 2026" className="text-lg py-6" />
                </Field>
                <div className="grid gap-6 sm:grid-cols-2 items-end">
                  <Field label="Category" required>
                    <Select value={form.category} onValueChange={(v: typeof form.category) => setForm({ ...form, category: v })}>
                      <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <div className="flex items-center justify-between rounded-lg border border-border p-4 bg-background/50 h-11 mb-0 mt-auto">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-semibold">Free Event</Label>
                    </div>
                    <Switch 
                      checked={form.is_free} 
                      onCheckedChange={(c) => {
                        setForm({ ...form, is_free: c });
                        if (c) {
                          setTickets(prev => prev.map(t => ({ ...t, price_naira: "0" })));
                        }
                      }} 
                    />
                  </div>
                </div>
                <Field label="Description">
                  <Textarea rows={6} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Tell people what to expect: line-up, dress code, schedule..." className="resize-none" />
                </Field>
              </div>
            </section>

            <section className="rounded-3xl border border-border bg-card/40 p-6 md:p-8 shadow-sm backdrop-blur-sm">
              <h2 className="mb-6 font-display text-2xl">Where & When</h2>
              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Venue name" required>
                  <Input value={form.venue_name} onChange={(e) => setForm({ ...form, venue_name: e.target.value })} placeholder="e.g. Eko Hotel" className="h-11" />
                </Field>
                <Field label="City" required>
                  <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Lagos" className="h-11" />
                </Field>
                <Field label="Starts at" required>
                  <Input type="datetime-local" value={form.start_datetime} onChange={(e) => setForm({ ...form, start_datetime: e.target.value })} className="h-11" />
                </Field>
              </div>
            </section>
          </div>
        )}

        {/* STEP 2: COVER IMAGE */}
        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="rounded-3xl border border-border bg-card/40 p-6 md:p-8 shadow-sm backdrop-blur-sm">
              <div className="mb-6">
                <h2 className="font-display text-2xl">Cover Image</h2>
                <p className="text-muted-foreground mt-1 text-sm">Upload a high-quality image to make your event stand out. Recommended ratio is 16:9 or 4:3.</p>
              </div>
              <label
                onDragOver={(e) => { e.preventDefault(); setIsDraggingCover(true); }}
                onDragLeave={() => setIsDraggingCover(false)}
                onDrop={handleCoverDrop}
                className={`relative flex min-h-[300px] md:min-h-[400px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300 ${isDraggingCover ? "border-primary bg-primary/10" : coverPreview ? "border-border bg-secondary/20 hover:border-primary/50" : "border-border bg-secondary/40 hover:border-primary/50 hover:bg-secondary/60"}`}
                style={coverPreview ? { backgroundImage: `url(${coverPreview})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
              >
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onPickCover(e.target.files?.[0] ?? null)} />
                {!coverPreview && (
                  <div className="text-center p-6">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-background shadow-sm">
                      <ImagePlus className="h-8 w-8 text-primary" />
                    </div>
                    <p className="text-lg font-medium">Click to upload or drag and drop</p>
                    <p className="mt-1 text-sm text-muted-foreground">JPG, PNG, WEBP up to 5MB</p>
                  </div>
                )}
                {coverPreview && (
                  <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity hover:opacity-100 flex items-center justify-center backdrop-blur-sm">
                    <p className="text-white font-medium flex items-center gap-2"><ImagePlus className="h-5 w-5" /> Change cover image</p>
                  </div>
                )}
              </label>
            </section>
          </div>
        )}

        {/* STEP 3: TICKETS */}
        {step === 3 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="rounded-3xl border border-border bg-card/40 p-6 md:p-8 shadow-sm backdrop-blur-sm">
              <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl">Ticket Types</h2>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {form.is_free ? "Add the different tickets you want to offer. Since this is a free event, the price is automatically set to 0." : "Add the different tickets you want to sell. Set price to 0 for free events."}
                  </p>
                </div>
                <Button type="button" onClick={() => setTickets([...tickets, { ...emptyTicket(), price_naira: form.is_free ? "0" : "" }])} className="shrink-0 bg-secondary text-secondary-foreground hover:bg-secondary/80">
                  <Plus className="mr-2 h-4 w-4" /> Add Ticket Tier
                </Button>
              </div>

              <div className="space-y-6">
                {tickets.map((t, i) => (
                  <div key={i} className="relative rounded-2xl border border-primary/20 bg-background/50 p-5 pt-8 shadow-sm transition-all hover:border-primary/40 group">
                    <div className="absolute -top-3 left-4 bg-background px-2 text-xs font-bold uppercase tracking-widest text-primary">
                      Tier {i + 1}
                    </div>
                    {tickets.length > 1 && (
                      <Button
                        type="button" variant="ghost" size="icon"
                        className="absolute right-3 top-3 h-8 w-8 text-muted-foreground opacity-50 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 transition-opacity"
                        onClick={() => setTickets(tickets.filter((_, idx) => idx !== i))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    <div className="grid gap-5 sm:grid-cols-12">
                      <div className={form.is_free ? "sm:col-span-8" : "sm:col-span-5"}>
                        <Field label="Ticket name" required>
                          <Input value={t.name} onChange={(e) => updateTicket(i, { name: e.target.value })} placeholder="e.g. VIP, Early Bird" className="h-11" />
                        </Field>
                      </div>
                      {!form.is_free && (
                        <div className="sm:col-span-3">
                          <Field label="Price (₦)" required>
                            <Input type="number" min="0" value={t.price_naira} onChange={(e) => updateTicket(i, { price_naira: e.target.value })} placeholder="0 for free" className="h-11" />
                          </Field>
                        </div>
                      )}
                      <div className="sm:col-span-2">
                        <Field label="Available" required>
                          <Input type="number" min="1" value={t.quantity_available} onChange={(e) => updateTicket(i, { quantity_available: e.target.value })} placeholder="100" className="h-11" />
                        </Field>
                      </div>
                      <div className="sm:col-span-2">
                        <Field label="Max/Order">
                          <Input type="number" min="1" value={t.max_per_order} onChange={(e) => updateTicket(i, { max_per_order: e.target.value })} placeholder="10" className="h-11" />
                        </Field>
                      </div>
                      <div className="sm:col-span-12">
                        <Field label="Description (optional)">
                          <Input value={t.description} onChange={(e) => updateTicket(i, { description: e.target.value })} placeholder="What does this ticket include? e.g. Includes drinks and backstage access" className="h-11" />
                        </Field>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* STEP 4: REVIEW */}
        {step === 4 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="rounded-3xl border border-border bg-card/40 p-6 md:p-8 shadow-sm backdrop-blur-sm">
              <div className="mb-8 text-center">
                <h2 className="font-display text-3xl">Ready to go live?</h2>
                <p className="text-muted-foreground mt-2">Review how your event will appear to buyers.</p>
              </div>

              <div className="grid md:grid-cols-[1fr_auto_1fr] gap-10 items-center max-w-4xl mx-auto">
                {/* Details Summary */}
                <div className="space-y-6 bg-secondary/30 p-6 rounded-2xl border border-border/50">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Event Name</h4>
                    <p className="font-display text-2xl">{form.title}</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Timing</h4>
                    <p className="font-medium text-primary">
                      {form.start_datetime ? new Date(form.start_datetime).toLocaleString("en-NG", { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : "Not set"}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Location</h4>
                    <p className="font-medium">{[form.venue_name, form.city].filter(Boolean).join(", ")}</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Tickets ({tickets.length})</h4>
                    <div className="space-y-2">
                      {tickets.map((t, i) => (
                        <div key={i} className="flex justify-between items-center bg-background/60 p-2 px-3 rounded-md text-sm border border-border/50">
                          <span className="font-medium">{t.name}</span>
                          <span className="font-bold">{t.price_naira === "0" ? "Free" : formatNaira(Number(t.price_naira) * 100)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="hidden md:block w-px h-full bg-border/50" />

                {/* Preview Card */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4 text-center">Live Card Preview</h4>
                  {livePreview}
                </div>
              </div>

              {!hasPayoutAccount && (
                <div className="mt-8 rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
                  <p className="font-medium">⚠️ Payout Account Missing</p>
                  <p className="text-sm mt-1">You must connect your payout account in <Link to="/account" className="underline hover:text-destructive/80 font-bold">Account Settings</Link> before you can publish.</p>
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* Navigation Footer */}
      <div className="mt-8 flex items-center justify-between border-t border-border/50 pt-6">
        <Button variant="ghost" onClick={prevStep} disabled={step === 1} className="text-muted-foreground hover:text-foreground">
          <ChevronLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        
        {step < 4 ? (
          <Button onClick={nextStep} size="lg" className="gradient-sunset text-primary-foreground shadow-glow hover:opacity-90 min-w-[120px]">
            Continue <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <div className="flex gap-3">
            <Button disabled={busy} onClick={() => submit(false)} variant="outline" size="lg" className="bg-background">
              Save Draft
            </Button>
            <Button disabled={busy || !hasPayoutAccount} onClick={() => submit(true)} size="lg" className="gradient-sunset text-primary-foreground shadow-glow hover:opacity-90 min-w-[140px]">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Publish Now
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        {label} {required && <span className="text-primary">*</span>}
      </Label>
      {children}
    </div>
  );
}
