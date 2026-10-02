import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { Calendar, MapPin, Loader2, Minus, Plus, Share2, Facebook, Twitter, MessageCircle, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

import { BackButton } from "@/components/back-button";
import { formatNaira } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { SiteNav } from "@/components/site-nav";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { z } from "zod";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/e/$slug")({
  component: EventDetailPage,
  validateSearch: z.object({
    ref: z.string().optional(),
  }),
  loader: async ({ params }) => {
    return await fetchEventBySlug(params.slug);
  },
  head: ({ loaderData, params }) => {
    if (!loaderData || !loaderData.event) {
      return { meta: [{ title: "Event - TixNaija" }] };
    }
    const { event, types } = loaderData;

    const dateStr = event.start_datetime
      ? new Date(event.start_datetime).toLocaleDateString("en-NG", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "";
    const cityPart = event.city ? ` — ${event.city}` : "";
    const title = `${event.title}${cityPart} | TixNaija`;

    let desc = `Get tickets for ${event.title}`;
    if (dateStr) desc += ` on ${dateStr}`;
    if (event.city) desc += ` in ${event.city}`;
    if (event.description) {
      let snippet = event.description;
      if (snippet.length > 90) {
        snippet = snippet.substring(0, 90);
        const lastSpace = snippet.lastIndexOf(" ");
        if (lastSpace > 0) snippet = snippet.substring(0, lastSpace);
        snippet += "...";
      }
      desc += `. ${snippet}`;
    } else {
      desc += ".";
    }

    let minPrice = 0;
    let availability = "https://schema.org/SoldOut";
    if (types && types.length > 0) {
      const availableTypes = types.filter((t: any) => t.quantity_available > t.quantity_sold);
      if (availableTypes.length > 0) {
        availability = "https://schema.org/InStock";
        minPrice = Math.min(...availableTypes.map((t: any) => t.price_kobo)) / 100;
      } else {
        minPrice = Math.min(...types.map((t: any) => t.price_kobo)) / 100;
      }
    }

    let eventStatus = "https://schema.org/EventScheduled";
    if (event.status === "cancelled") eventStatus = "https://schema.org/EventCancelled";
    else if (event.postponed_at) eventStatus = "https://schema.org/EventPostponed";
    else if (
      event.status === "completed" ||
      new Date(event.end_datetime || event.start_datetime) < new Date()
    ) {
      availability = "https://schema.org/OutOfStock";
    }

    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        {
          property: "og:image",
          content: event.cover_image_url || "https://www.tixnaija.name.ng/preview.jpg",
        },
        { property: "twitter:card", content: "summary_large_image" },
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Event",
            name: event.title,
            description: desc,
            startDate: event.start_datetime,
            endDate: event.end_datetime || event.start_datetime,
            eventStatus: eventStatus,
            location: {
              "@type": "Place",
              name: event.venue_name || event.city || "TBD",
              address: [event.city, event.state].filter(Boolean).join(", ") || "Nigeria",
            },
            image: event.cover_image_url ? [event.cover_image_url] : [],
            offers: {
              "@type": "Offer",
              price: minPrice,
              priceCurrency: "NGN",
              availability: availability,
              url: `https://www.tixnaija.name.ng/e/${params.slug}`,
            },
          }),
        },
      ],
    };
  },
});

// Helper for Supabase image transformations
function optimizeImage(url: string | null | undefined, width: number): string | undefined {
  if (!url) return undefined;
  if (url.includes("/storage/v1/object/public/")) {
    return (
      url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/") +
      `?width=${width}&format=webp`
    );
  }
  return url;
}

type TicketType = {
  id: string;
  name: string;
  description: string | null;
  price_kobo: number;
  quantity_available: number;
  quantity_sold: number;
  quantity_cancelled?: number;
  max_per_order: number | null;
  sales_start_at: string | null;
  sales_end_at: string | null;
};

async function fetchEventBySlug(slug: string) {
  // We fetch event and ticket types in a single query via join
  const { data: _ev, error: eventErr } = await supabase
    .from("events")
    .select(
      `
      id, title, slug, description, category, tags, cover_image_url, venue_name, city, state, 
      start_datetime, end_datetime, status, postponed_at, organizer_note, theme_color,
      checkout_questions(id, question_text, type, options, required, position),
      profiles!events_organizer_id_fkey(full_name, organizer_slug, avatar_url),
      ticket_types(id, name, description, price_kobo, quantity_available, quantity_sold, max_per_order, sales_start_at, sales_end_at)
    `,
    )
    .eq("slug", slug)
    .maybeSingle();

  if (eventErr) throw eventErr;
  if (!_ev) return null;
  const ev = _ev as any;
  const types = ev.ticket_types || [];
  const questions = ev.checkout_questions || [];
  delete ev.ticket_types; // keep structure identical for rest of code
  delete ev.checkout_questions;

  // Fetch Social Proof
  const { data: socialProof } = await supabase.rpc("get_event_attendees" as any, { p_event_id: ev.id });

  // Sort tickets by price locally since we fetched via join
  types.sort((a: any, b: any) => a.price_kobo - b.price_kobo);

  return {
    event: ev,
    types: types as TicketType[],
    questions: questions.sort((a: any, b: any) => a.position - b.position),
    socialProof: socialProof || null,
  };
}

const checkoutSchema = z
  .object({
    buyerName: z.string().min(1, "Full name is required"),
    buyerEmail: z.string().email("Invalid email address"),
    buyerPhone: z.string().optional(),
    isGift: z.boolean(),
    recipientName: z.string().optional(),
    recipientEmail: z.string().optional(),
    giftMessage: z.string().optional(),
    promoCode: z.string().optional(),
    termsAccepted: z
      .boolean()
      .refine((val) => val === true, "You must agree to the Terms of Service and Privacy Policy"),
    attendees: z.record(
      z.string(),
      z.array(
        z.object({
          name: z.string(),
          email: z.string(),
        }),
      ),
    ),
    answers: z.record(z.string(), z.any()).optional(),
  })
  .superRefine((data, ctx) => {
    // Only validate gift recipient fields — per-attendee name/email are optional.
    // The RPC defaults to the buyer's own name/email for any blank attendee entries,
    // and tickets can be reassigned later via the Reassign Ticket flow.
    if (data.isGift) {
      if (!data.recipientName || data.recipientName.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Recipient name is required",
          path: ["recipientName"],
        });
      }
      if (!data.recipientEmail || !/^\S+@\S+\.\S+$/.test(data.recipientEmail)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Valid recipient email is required",
          path: ["recipientEmail"],
        });
      }
    }
  });

type CheckoutFormValues = z.infer<typeof checkoutSchema>;

function EventDetailPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["event", slug],
    queryFn: () => fetchEventBySlug(slug),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const { data: similarEvents } = useQuery({
    queryKey: ["similar-events", data?.event?.category],
    queryFn: async () => {
      if (!data?.event?.category) return [];
      const { data: evs } = await supabase
        .from("events")
        .select("id, title, slug, cover_image_url, start_datetime, city, venue_name, status")
        .in("status", ["published", "cancelled", "completed"])
        .eq("category", data.event.category)
        .neq("id", data.event.id)
        .limit(4);
      return evs || [];
    },
    enabled: !!data?.event,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const [qty, setQty] = useState<Record<string, number>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  const [waitlistTier, setWaitlistTier] = useState<TicketType | null>(null);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistBusy, setWaitlistBusy] = useState(false);

  const waitlistForm = useForm({
    defaultValues: { name: "", email: "" },
  });

  const [appliedPromo, setAppliedPromo] = useState<{
    id: string;
    discount_type: string;
    discount_value: number;
  } | null>(null);
  const [validatingPromo, setValidatingPromo] = useState(false);

  const { ref } = Route.useSearch();
  const [appliedPromoterLink, setAppliedPromoterLink] = useState<{
    link_id: string;
    ticket_type_id: string | null;
  } | null>(null);

  useEffect(() => {
    async function validatePromoter() {
      if (!ref || !data?.event) return;
      const { data: res, error } = await supabase.rpc("validate_promoter_code" as any, {
        p_event_id: data.event.id,
        p_code: ref.trim(),
      });
      if (!error && res && (res as any).length > 0) {
        setAppliedPromoterLink((res as any)[0]);
      }
    }
    validatePromoter();
  }, [ref, data?.event]);

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      buyerName: "",
      buyerEmail: "",
      buyerPhone: "",
      isGift: false,
      recipientName: "",
      recipientEmail: "",
      giftMessage: "",
      promoCode: "",
      termsAccepted: false,
      attendees: {},
      answers: {},
    },
  });

  const isGift = form.watch("isGift");
  const promoCodeValue = form.watch("promoCode");

  // Pre-fill user data if logged in
  const { data: sessionUser } = useQuery({
    queryKey: ["user-session-checkout"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        form.setValue("buyerEmail", userData.user.email || "");
        waitlistForm.setValue("email", userData.user.email || "");
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", userData.user.id)
          .maybeSingle();
        if ((profile as any)?.full_name) {
          form.setValue("buyerName", (profile as any).full_name);
          waitlistForm.setValue("name", (profile as any).full_name);
        }
      }
      return userData?.user ?? null;
    },
    staleTime: 1000 * 60 * 5,
  });

  const userId = sessionUser?.id || null;

  const items = useMemo(() => {
    if (!data) return [] as { type: TicketType; count: number; subtotal: number }[];
    return data.types
      .map((t: TicketType) => ({
        type: t,
        count: qty[t.id] ?? 0,
        subtotal: (qty[t.id] ?? 0) * t.price_kobo,
      }))
      .filter((i: { count: number }) => i.count > 0);
  }, [data, qty]);

  const subtotalKobo = items.reduce((sum: number, i: { subtotal: number }) => sum + i.subtotal, 0);
  let discountKobo = 0;
  if (appliedPromo) {
    if (appliedPromo.discount_type === "percent") {
      discountKobo = Math.floor((subtotalKobo * appliedPromo.discount_value) / 100);
    } else {
      discountKobo = appliedPromo.discount_value;
    }
    if (discountKobo > subtotalKobo) discountKobo = subtotalKobo;
  }
  const totalKobo = subtotalKobo - discountKobo;
  const totalCount = items.reduce((sum: number, i: { count: number }) => sum + i.count, 0);

  // Sync qty to form attendees
  useEffect(() => {
    if (checkoutOpen) {
      const currentAttendees = form.getValues("attendees");
      const newAttendees: Record<string, { name: string; email: string }[]> = {};
      items.forEach((it) => {
        const existing = currentAttendees[it.type.id] || [];
        const next = existing.slice(0, it.count);
        while (next.length < it.count) next.push({ name: "", email: "" });
        newAttendees[it.type.id] = next;
      });
      form.setValue("attendees", newAttendees);
    }
  }, [checkoutOpen, items]);

  async function applyPromo() {
    if (!promoCodeValue || !promoCodeValue.trim() || !data) return;
    setValidatingPromo(true);
    try {
      const { data: res, error } = await supabase.rpc("validate_promo_code", {
        p_event_id: data.event.id,
        p_code: promoCodeValue.trim(),
      } as any);
      if (error) throw error;
      if (!res) throw new Error("Invalid promo code");
      setAppliedPromo(res as any);
      toast.success("Promo code applied!");
    } catch (err: any) {
      toast.error(err.message || "Hmm, that promo code doesn't seem right.");
      setAppliedPromo(null);
    } finally {
      setValidatingPromo(false);
    }
  }

  function setCount(t: TicketType, next: number) {
    const remaining = Math.max(0, t.quantity_available - t.quantity_sold);
    const cap = Math.min(t.max_per_order || 10, remaining);
    const clamped = Math.max(0, Math.min(cap, next));
    setQty((q) => ({ ...q, [t.id]: clamped }));
  }

  function onCheckout() {
    if (!totalCount) return;
    if (!sessionUser) {
      toast.error("You must create an account or sign in to buy tickets.", { duration: 5000 });
      navigate({ to: "/auth", search: { mode: "signup", redirect: `/e/${slug}` } });
      return;
    }
    setCheckoutOpen(true);
  }

  async function handleJoinWaitlist(values: { name: string; email: string }) {
    if (!waitlistTier || !data?.event) return;
    setWaitlistBusy(true);
    try {
      const { error } = await (supabase.from("waitlist_entries" as any) as any).insert({
        event_id: data.event.id,
        ticket_tier_id: waitlistTier.id,
        user_id: userId,
        name: values.name,
        email: values.email,
        status: "waiting",
      });
      if (error) {
        if (error.code === "23505")
          throw new Error("You are already on the waitlist for this ticket tier.");
        throw error;
      }
      toast.success("You've been added to the waitlist!");
      setWaitlistOpen(false);
      setWaitlistTier(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to join waitlist");
    } finally {
      setWaitlistBusy(false);
    }
  }

  async function handleCheckoutSubmit(values: CheckoutFormValues) {
    // Validate custom questions
    if (data?.questions && data.questions.length > 0) {
      const answers = values.answers || {};
      for (const q of data.questions) {
        if (q.required) {
          const ans = answers[q.id];
          if (ans === undefined || ans === null || ans === "" || (Array.isArray(ans) && ans.length === 0)) {
            toast.error(`Please answer the required question: ${q.question_text}`);
            return;
          }
        }
      }
    }
    setCheckoutBusy(true);
    try {
      const ticketsPayload = items.map((i: { type: TicketType; count: number }) => ({
        ticketTypeId: i.type.id,
        count: i.count,
        attendee_names: (values.attendees[i.type.id] ?? []).map((a) => a.name || values.buyerName),
        attendee_emails: (values.attendees[i.type.id] ?? []).map(
          (a) => a.email || values.buyerEmail,
        ),
      }));

      if (totalKobo === 0) {
        // Handle free tickets locally
        const { data: orderId, error: checkoutError } = await supabase.rpc("process_checkout", {
          p_event_id: data!.event.id,
          p_user_id: (userId || null) as string,
          p_buyer_name: values.buyerName,
          p_buyer_email: values.buyerEmail,
          p_buyer_phone: (values.buyerPhone || null) as string,
          p_tickets: ticketsPayload,
          p_amount_paid: 0,
          p_payment_reference: `FREE_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          p_promo_code_id: appliedPromo?.id ?? undefined,
          p_is_gift: values.isGift,
          p_recipient_name: values.isGift ? values.recipientName : null,
          p_recipient_email: values.isGift ? values.recipientEmail : null,
          p_gift_message: values.isGift ? values.giftMessage : null,
          p_promoter_link_id: appliedPromoterLink?.link_id ?? undefined,
          p_checkout_answers: values.answers || {},
        } as any);

        if (checkoutError) {
          throw new Error(`Database error: ${checkoutError.message}`);
        }

        try {
          await supabase.functions.invoke("send-ticket-confirmation", {
            body: { orderId },
          });
        } catch (emailErr) {
          console.error("Failed to send free ticket email", emailErr);
        }

        if (!userId) {
          toast.success("Free ticket claimed! View your ticket using the email you provided.", {
            duration: 6000,
          });
          navigate({ to: "/my-tickets" });
        } else {
          toast.success("Free ticket claimed successfully!");
          navigate({ to: "/notifications" });
        }
        return;
      }

      const metadata = {
        eventId: data!.event.id,
        userId,
        buyerName: values.buyerName,
        buyerEmail: values.buyerEmail,
        buyerPhone: values.buyerPhone || null,
        tickets: ticketsPayload,
        promoCodeId: appliedPromo?.id || null,
        isGift: values.isGift,
        recipientName: values.isGift ? values.recipientName : null,
        recipientEmail: values.isGift ? values.recipientEmail : null,
        giftMessage: values.isGift ? values.giftMessage : null,
        promoterLinkId: appliedPromoterLink?.link_id || null,
        checkoutAnswers: values.answers || {},
      };

      const { data: initData, error: initErr } = await supabase.functions.invoke(
        "initialize-payment",
        {
          body: {
            email: values.buyerEmail,
            amount: totalKobo / 100, // edge fn multiplies by 100
            metadata,
          },
        },
      );
      if (initErr) throw initErr;
      if (initData?.error) throw new Error(initData.error);
      if (!initData?.authorization_url) throw new Error("Could not start payment.");

      window.location.href = initData.authorization_url;
    } catch (err: any) {
      toast.error(err.message || "We couldn't process your payment. Please try again or use a different payment method.");
    } finally {
      setCheckoutBusy(false);
    }
  }

  return (
    <div className="min-h-dvh pb-32 md:pb-0" style={data?.event?.theme_color ? { "--primary": data.event.theme_color } as React.CSSProperties : undefined}>
      <SiteNav />

      {isLoading ? (
        <EventSkeleton />
      ) : isError || !data ? (
        <EventMissing />
      ) : (
        <>
          <EventBody
            event={data.event}
            types={data.types}
            qty={qty}
            setCount={setCount}
            onCheckout={onCheckout}
            totalCount={totalCount}
            totalKobo={totalKobo}
            onJoinWaitlist={(t) => {
              setWaitlistTier(t);
              setWaitlistOpen(true);
            }}
            socialProof={(data as any).socialProof}
          />
          {similarEvents && similarEvents.length > 0 && <SimilarEvents events={similarEvents} />}
        </>
      )}

      {data &&
        data.event.status !== "cancelled" &&
        (() => {
          const start = new Date(data.event.start_datetime);
          const end = data.event.end_datetime ? new Date(data.event.end_datetime) : start;
          const isPastEvent = end < new Date() || data.event.status === "completed";
          if (isPastEvent) return null;
          return (
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/95 backdrop-blur md:hidden pb-[env(safe-area-inset-bottom)]">
              <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    {totalCount
                      ? `${totalCount} ticket${totalCount === 1 ? "" : "s"}`
                      : "No tickets yet"}
                  </p>
                  <p className="truncate font-display text-xl leading-none">
                    {totalKobo ? formatNaira(totalKobo) : "Pick a tier"}
                  </p>
                </div>
                <Button
                  onClick={onCheckout}
                  disabled={!totalCount}
                  size="lg"
                  className="gradient-sunset text-primary-foreground shadow-glow hover:opacity-90 disabled:opacity-40"
                >
                  Buy tickets
                </Button>
              </div>
            </div>
          );
        })()}

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Complete Checkout</DialogTitle>
            <DialogDescription>
              You're buying {totalCount} ticket{totalCount === 1 ? "" : "s"} for{" "}
              {formatNaira(totalKobo)}.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCheckoutSubmit)} className="space-y-4 pt-4">
              <FormField
                control={form.control}
                name="buyerName"
                render={({ field }: { field: any }) => (
                  <FormItem>
                    <FormLabel>Your Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Nneka Okafor" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="buyerEmail"
                render={({ field }: { field: any }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="nneka@company.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="buyerPhone"
                render={({ field }: { field: any }) => (
                  <FormItem>
                    <FormLabel>Phone Number (Optional)</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="08012345678" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4 border-t border-border pt-4">
                <FormField
                  control={form.control}
                  name="isGift"
                  render={({ field }: { field: any }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-2">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Buy as a gift</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />

                {isGift && (
                  <div className="space-y-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <FormField
                      control={form.control}
                      name="recipientName"
                      render={({ field }: { field: any }) => (
                        <FormItem>
                          <FormLabel>Recipient Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Gift recipient's full name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="recipientEmail"
                      render={({ field }: { field: any }) => (
                        <FormItem>
                          <FormLabel>Recipient Email</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="Where to send the tickets"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="giftMessage"
                      render={({ field }: { field: any }) => (
                        <FormItem>
                          <FormLabel>Gift Message (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Happy Birthday!" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2 border-t border-border pt-4">
                <FormField
                  control={form.control}
                  name="promoCode"
                  render={({ field }: { field: any }) => (
                    <FormItem>
                      <FormLabel>Promo Code</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input
                            placeholder="e.g. EARLYBIRD"
                            disabled={!!appliedPromo}
                            {...field}
                          />
                        </FormControl>
                        {!appliedPromo ? (
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={applyPromo}
                            disabled={validatingPromo || !field.value?.trim()}
                          >
                            {validatingPromo ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Apply"
                            )}
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={() => {
                              setAppliedPromo(null);
                              form.setValue("promoCode", "");
                            }}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {appliedPromo && (
                  <p className="text-xs text-green-500 font-medium">
                    {appliedPromo.discount_type === "percent"
                      ? `${appliedPromo.discount_value}%`
                      : formatNaira(appliedPromo.discount_value)}{" "}
                    discount applied!
                  </p>
                )}
              </div>

              {totalCount > 1 && (
                <div className="space-y-4 border-t border-border pt-4">
                  <div>
                    <p className="text-sm font-semibold">Ticket Assignments <span className="text-muted-foreground font-normal">(Optional)</span></p>
                    <p className="text-xs text-muted-foreground">
                      You're buying {totalCount} tickets. Optionally assign each ticket to an attendee now — or leave them blank and fill in the names later from your ticket page.
                    </p>
                  </div>
                  {items.map((it) => (
                    <div key={it.type.id} className="space-y-3">
                      <p className="text-xs uppercase tracking-widest text-muted-foreground border-b border-border/50 pb-1">
                        {it.type.name}
                      </p>
                      {Array.from({ length: it.count }).map((_, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col gap-2 rounded-lg bg-secondary/20 p-3"
                        >
                          <p className="text-xs font-medium text-foreground/80">Ticket {idx + 1}</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <FormField
                              control={form.control}
                              name={`attendees.${it.type.id}.${idx}.name` as const}
                              render={({ field }: { field: any }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input placeholder="Attendee Name" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`attendees.${it.type.id}.${idx}.email` as const}
                              render={({ field }: { field: any }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input type="email" placeholder="Attendee Email" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {data?.questions && data.questions.length > 0 && (
                <div className="space-y-4 border-t border-border pt-4">
                  <div>
                    <p className="text-sm font-semibold">Additional Information</p>
                    <p className="text-xs text-muted-foreground">
                      The organizer requires some extra details for this event.
                    </p>
                  </div>
                  {data.questions.map((q: any) => (
                    <FormField
                      key={q.id}
                      control={form.control}
                      name={`answers.${q.id}` as const}
                      render={({ field }: { field: any }) => (
                        <FormItem>
                          <FormLabel>{q.question_text} {q.required && <span className="text-destructive">*</span>}</FormLabel>
                          <FormControl>
                            {q.type === 'long_text' ? (
                               <Textarea placeholder="Your answer" {...field} value={field.value || ""} />
                            ) : q.type === 'select' ? (
                               <Select onValueChange={field.onChange} defaultValue={field.value}>
                                 <FormControl>
                                   <SelectTrigger>
                                     <SelectValue placeholder="Select an option" />
                                   </SelectTrigger>
                                 </FormControl>
                                 <SelectContent>
                                   {(q.options || []).map((opt: string) => (
                                     <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                   ))}
                                 </SelectContent>
                               </Select>
                            ) : q.type === 'checkbox' ? (
                               <div className="flex flex-col gap-2 mt-2">
                                 {(q.options || []).map((opt: string) => {
                                   const isChecked = Array.isArray(field.value) && field.value.includes(opt);
                                   return (
                                     <div key={opt} className="flex items-center space-x-2">
                                       <Checkbox 
                                          checked={isChecked}
                                          onCheckedChange={(checked) => {
                                            const current = Array.isArray(field.value) ? field.value : [];
                                            const updated = checked ? [...current, opt] : current.filter((c: string) => c !== opt);
                                            field.onChange(updated);
                                          }}
                                       />
                                       <Label className="text-sm font-normal cursor-pointer">{opt}</Label>
                                     </div>
                                   );
                                 })}
                               </div>
                            ) : (
                               <Input placeholder="Your answer" {...field} value={field.value || ""} />
                            )}
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
              )}

              <div className="border-t border-border pt-4">
                <FormField
                  control={form.control}
                  name="termsAccepted"
                  render={({ field }: { field: any }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-2">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-xs text-muted-foreground font-normal leading-relaxed">
                          I agree to the{" "}
                          <Link
                            to="/terms"
                            target="_blank"
                            className="text-primary hover:underline"
                          >
                            Terms of Service
                          </Link>{" "}
                          and{" "}
                          <Link
                            to="/privacy"
                            target="_blank"
                            className="text-primary hover:underline"
                          >
                            Privacy Policy
                          </Link>
                          .
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              <Button
                type="submit"
                disabled={checkoutBusy}
                className="w-full gradient-sunset text-primary-foreground shadow-glow mt-4"
              >
                {checkoutBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {totalKobo === 0 ? "Get free tickets" : `Pay ${formatNaira(totalKobo)}`}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={waitlistOpen} onOpenChange={setWaitlistOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Join Waitlist</DialogTitle>
            <DialogDescription>
              {waitlistTier?.name} is currently sold out. Join the waitlist to be notified if
              tickets become available.
            </DialogDescription>
          </DialogHeader>
          <Form {...waitlistForm}>
            <form
              onSubmit={waitlistForm.handleSubmit(handleJoinWaitlist)}
              className="space-y-4 pt-4"
            >
              <FormField
                control={waitlistForm.control}
                name="name"
                render={({ field }: { field: any }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your name" required {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={waitlistForm.control}
                name="email"
                render={({ field }: { field: any }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="Your email" required {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={waitlistBusy} className="w-full mt-4">
                {waitlistBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Join Waitlist
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EventBody({
  event,
  types,
  qty,
  setCount,
  onCheckout,
  totalCount,
  totalKobo,
  onJoinWaitlist,
  socialProof,
}: {
  event: NonNullable<Awaited<ReturnType<typeof fetchEventBySlug>>>["event"];
  types: TicketType[];
  qty: Record<string, number>;
  setCount: (t: TicketType, n: number) => void;
  onCheckout: () => void;
  totalCount: number;
  totalKobo: number;
  onJoinWaitlist: (tier: TicketType) => void;
  socialProof: any;
}) {
  const start = new Date(event.start_datetime);
  const end = event.end_datetime
    ? new Date(event.end_datetime)
    : new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const now = new Date();
  const isPastEvent = end < now || event.status === "completed";

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 md:pt-10">
      {event.status === "cancelled" && (
        <div className="mb-8 rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <h2 className="font-semibold text-lg">Event Cancelled</h2>
          <p className="text-sm mt-1">
            {event.organizer_note ||
              "This event has been cancelled by the organizer. Ticket holders have been notified regarding refunds."}
          </p>
        </div>
      )}
      {isPastEvent && event.status !== "cancelled" && (
        <div className="mb-8 rounded-xl border border-muted-foreground/30 bg-muted/20 p-4 text-muted-foreground">
          <h2 className="font-semibold text-lg">Event Ended</h2>
          <p className="text-sm mt-1">
            This event has already ended. Tickets are no longer available for purchase.
          </p>
        </div>
      )}
      {event.postponed_at && event.status !== "cancelled" && !isPastEvent && (
        <div className="mb-8 rounded-xl border border-amber-500/50 bg-amber-500/10 p-4 text-amber-600 dark:text-amber-400">
          <h2 className="font-semibold text-lg">Event Postponed</h2>
          <p className="text-sm mt-1">
            {event.organizer_note ||
              "This event has been postponed to a new date. Previously purchased tickets remain valid."}
          </p>
        </div>
      )}
      <div className="grid gap-8 md:grid-cols-[1.4fr_1fr] md:gap-10">
        <div>
          <div className="relative overflow-hidden rounded-2xl border border-border">
            {event.cover_image_url ? (
              <img
                src={optimizeImage(event.cover_image_url, 1200)}
                alt={event.title}
                fetchPriority="high"
                decoding="async"
                className="aspect-[16/10] w-full object-cover"
              />
            ) : (
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-card">
                <div
                  aria-hidden
                  className="absolute inset-0 opacity-30"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(135deg, transparent 0 22px, color-mix(in oklab, var(--primary) 40%, transparent) 22px 23px)",
                  }}
                />
                <div className="absolute inset-x-6 bottom-6 flex items-end justify-between gap-4">
                  <span className="font-display text-2xl leading-none text-foreground/80 md:text-3xl">
                    {event.title}
                  </span>
                  <span className="font-display text-xs uppercase tracking-[0.35em] text-primary">
                    Admit One
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6">
            <span className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">
              {event.category}
            </span>
            {event.tags && event.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {event.tags.map((tag: string) => (
                  <span key={tag} className="text-xs font-medium text-muted-foreground bg-muted/80 px-2.5 py-1 rounded-full border border-border/50">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-2 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <BackButton />
                <h1 className="font-display text-3xl leading-[0.95] md:text-5xl lg:text-6xl">
                  {event.title}
                </h1>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="shrink-0" aria-label="Share Event">
                    <Share2 className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={() => {
                      const url = encodeURIComponent(window.location.href);
                      window.open(`https://wa.me/?text=${url}`, "_blank");
                    }}
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    WhatsApp
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      const url = encodeURIComponent(window.location.href);
                      window.open(`https://twitter.com/intent/tweet?url=${url}`, "_blank");
                    }}
                  >
                    <Twitter className="mr-2 h-4 w-4" />
                    X (Twitter)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      const url = encodeURIComponent(window.location.href);
                      window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, "_blank");
                    }}
                  >
                    <Facebook className="mr-2 h-4 w-4" />
                    Facebook
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: event.title,
                          url: window.location.href,
                        }).catch(() => {});
                      } else {
                        navigator.clipboard.writeText(window.location.href);
                        toast.success("Link copied to clipboard");
                      }
                    }}
                  >
                    <Link2 className="mr-2 h-4 w-4" />
                    More / Copy Link
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                {start.toLocaleString("en-NG", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
              {(event.venue_name || event.city) && (
                <span className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  {[event.venue_name, event.city, event.state].filter(Boolean).join(", ")}
                </span>
              )}
            </div>
          </div>
          {event.profiles && (
            <div className="mt-8 flex items-center gap-3 rounded-xl border border-border bg-card/50 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                {event.profiles.avatar_url ? (
                  <img src={event.profiles.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                ) : (
                  <span className="font-display font-bold uppercase">{event.profiles.full_name?.charAt(0) || "O"}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Organized by</p>
                <p className="truncate font-semibold">{event.profiles.full_name}</p>
              </div>
              {event.profiles.organizer_slug && (
                <Link
                  to="/box-office/$organizerSlug"
                  params={{ organizerSlug: event.profiles.organizer_slug }}
                  className="shrink-0 text-sm font-medium text-primary hover:underline press-sm"
                >
                  View Profile
                </Link>
              )}
            </div>
          )}

          {event.description && (
            <div className="mt-8 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/90">
              {event.description}
            </div>
          )}
        </div>

        <aside className="md:sticky md:top-24 md:self-start flex flex-col gap-6">
          {socialProof && socialProof.total_count > 0 && (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 backdrop-blur flex flex-col items-center text-center shadow-sm">
              {socialProof.can_view_avatars && socialProof.attendees?.length > 0 ? (
                <>
                  <div className="flex -space-x-3 mb-3">
                    {socialProof.attendees.map((a: any, idx: number) => (
                      <div key={a.user_id} className="relative z-10 w-10 h-10 rounded-full border-2 border-background overflow-hidden bg-primary text-primary-foreground flex items-center justify-center font-bold" style={{ zIndex: 10 - idx }}>
                        {a.avatar_url ? (
                          <img src={a.avatar_url} alt={a.first_name} className="w-full h-full object-cover" />
                        ) : (
                          a.first_name.charAt(0).toUpperCase()
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-foreground/90 font-medium">
                    Joined by {socialProof.attendees.map((a: any) => a.first_name).join(', ')}
                    {socialProof.total_count > socialProof.attendees.length ? ` and ${socialProof.total_count - socialProof.attendees.length} others` : ''}
                  </p>
                </>
              ) : (
                <>
                  <div className="flex -space-x-3 mb-3">
                    <div className="relative z-[10] w-10 h-10 rounded-full border-2 border-background bg-muted flex items-center justify-center font-bold text-muted-foreground">?</div>
                    <div className="relative z-[9] w-10 h-10 rounded-full border-2 border-background bg-muted flex items-center justify-center font-bold text-muted-foreground">?</div>
                  </div>
                  <p className="text-sm text-foreground/90 font-medium">
                    {socialProof.total_count} {socialProof.total_count === 1 ? 'person is' : 'people are'} attending.
                  </p>
                  {!socialProof.can_view_avatars && (
                    <p className="text-xs text-primary mt-1 font-medium">
                      Enable "Guest Lists" in Settings to see who!
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card/70 p-5 backdrop-blur">
            <h2 className="font-display text-xl md:text-2xl">Tickets</h2>
            <p className="text-xs text-muted-foreground">Select how many of each tier.</p>

            <div className="mt-4 space-y-3">
              {types.length === 0 && (
                <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Tickets aren't on sale yet. Check back soon.
                </p>
              )}
              {types.map((t) => {
                const now = new Date();
                const salesStart = t.sales_start_at ? new Date(t.sales_start_at) : null;
                const salesEnd = t.sales_end_at ? new Date(t.sales_end_at) : null;
                const isStarted = !salesStart || now >= salesStart;
                const isEnded = salesEnd && now >= salesEnd;
                const remaining = Math.max(
                  0,
                  t.quantity_available - (t.quantity_sold - (t.quantity_cancelled || 0)),
                );
                const soldOut = remaining <= 0;
                const unavailable =
                  !isStarted || isEnded || soldOut || event.status === "cancelled" || isPastEvent;
                const count = qty[t.id] ?? 0;

                let statusText = `${remaining} left`;
                if (event.status === "cancelled") statusText = "Sales closed";
                else if (isPastEvent) statusText = "Event ended";
                else if (!isStarted) statusText = "Sales not started";
                else if (isEnded) statusText = "Sales ended";
                else if (soldOut) statusText = "Sold out";

                return (
                  <div
                    key={t.id}
                    className={`rounded-xl border border-border p-4 transition ${unavailable ? "bg-muted/30 opacity-75" : "bg-background/40 hover:border-primary/40"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold">{t.name}</p>
                        {t.description && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>
                        )}
                        <p className="mt-1 font-display text-xl md:text-2xl text-gradient-sunset">
                          {t.price_kobo === 0 ? "Free" : formatNaira(t.price_kobo)}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
                          {statusText}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {soldOut && event.status !== "cancelled" && !isPastEvent ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="h-8 text-xs font-semibold"
                            onClick={() => onJoinWaitlist(t)}
                          >
                            Join Waitlist
                          </Button>
                        ) : (
                          <>
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              disabled={count === 0}
                              onClick={() => setCount(t, count - 1)}
                              aria-label={`Remove one ${t.name}`}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="w-6 text-center font-semibold tabular-nums">
                              {count}
                            </span>
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              disabled={unavailable}
                              onClick={() => setCount(t, count + 1)}
                              aria-label={`Add one ${t.name}`}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex items-baseline justify-between border-t border-border pt-4">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="font-display text-2xl md:text-3xl text-gradient-sunset">
                {totalKobo ? formatNaira(totalKobo) : "—"}
              </span>
            </div>
            <Button
              disabled={!totalCount || isPastEvent || event.status === "cancelled"}
              onClick={onCheckout}
              className="mt-4 hidden w-full gradient-sunset text-primary-foreground shadow-glow hover:opacity-90 disabled:opacity-40 md:inline-flex"
              size="lg"
            >
              {isPastEvent
                ? "Event ended"
                : event.status === "cancelled"
                  ? "Sales closed"
                  : "Buy tickets"}
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function EventSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-10">
      <div className="grid gap-8 md:grid-cols-[1.4fr_1fr]">
        <div>
          <Skeleton className="aspect-[16/10] w-full rounded-2xl" />
          <Skeleton className="mt-6 h-10 w-2/3" />
          <Skeleton className="mt-3 h-4 w-1/2" />
        </div>
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    </div>
  );
}

function EventMissing() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="font-display text-4xl text-gradient-sunset">Event unavailable</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This event may have been unpublished or removed.
      </p>
      <Button
        asChild
        className="mt-6 gradient-sunset text-primary-foreground shadow-glow hover:opacity-90"
      >
        <Link to="/">Back to events</Link>
      </Button>
    </div>
  );
}

function SimilarEvents({ events }: { events: any[] }) {
  if (!events || events.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-16 md:py-24 border-t border-border/40 mt-12 md:mt-20">
      <h2 className="font-display text-3xl md:text-4xl mb-8">You might also like</h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {events.map((ev) => (
          <Link
            key={ev.id}
            to="/e/$slug"
            params={{ slug: ev.slug }}
            className="group flex flex-col overflow-hidden rounded-2xl bg-card/60 transition-all hover:-translate-y-1 hover:shadow-glow border border-border/50 hover:border-primary/30"
          >
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
              {ev.cover_image_url && (
                <img
                  src={optimizeImage(ev.cover_image_url, 400)}
                  alt={ev.title}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              )}
              {ev.city && (
                <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/80 px-2.5 py-1 text-xs font-medium backdrop-blur-md">
                  <MapPin className="h-3 w-3 text-primary" />
                  {ev.city}
                </div>
              )}
            </div>

            <div className="flex flex-1 flex-col p-5">
              <div className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(ev.start_datetime).toLocaleString("en-NG", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </div>

              <h3 className="font-display text-lg leading-tight group-hover:text-primary line-clamp-2">
                {ev.title}
              </h3>

              {ev.venue_name && (
                <p className="mt-2 text-sm text-muted-foreground line-clamp-1">{ev.venue_name}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
