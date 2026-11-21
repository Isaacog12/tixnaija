import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { useState } from "react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Instagram,
  Send,
  PhoneCall,
  Mail,
  AlertCircle,
  CheckCircle2,
  Ticket,
  Mic2,
  Ban,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BUSINESS_DETAILS } from "@/lib/business";

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: "About Us — TixNaija" },
      {
        name: "description",
        content:
          "TixNaija is an independent Nigerian ticketing platform built to make event creation seamless. We are a distinct company, not affiliated with Tix Africa.",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "TixNaija",
          url: "https://www.tixnaija.name.ng",
          description:
            "TixNaija is a proudly independent Nigerian ticketing platform built to make event creation and attendance seamless.",
          foundingDate: "2026",
          founder: { "@type": "Person", name: "Ogbomo Isaac" },
          sameAs: ["https://www.instagram.com/tixnaija/"],
        }),
      },
    ],
  }),
});

const TOPICS = [
  "Ticket / Purchase Issue",
  "Event Organizer Support",
  "Refund Request",
  "Account & Login Help",
  "Report a Fraudulent Event",
  "Partnership / Business Enquiry",
  "Other",
];

const HELP_TOPICS = [
  {
    label: "Buyers & Attendees",
    desc: "Missing ticket? Wrong details? We'll sort it fast.",
    icon: Ticket,
  },
  {
    label: "Event Organizers",
    desc: "Questions about payouts, listings, or check-in tools.",
    icon: Mic2,
  },
  {
    label: "Refunds",
    desc: "Please note that all ticket sales are final and non-refundable.",
    icon: Ban,
  },
  {
    label: "Fraud Reports",
    desc: "Spotted a fake event? Report it and we'll investigate.",
    icon: ShieldAlert,
  },
];

const fieldClass =
  "h-12 rounded-xl border-border/70 bg-background/60 text-[15px] focus-visible:ring-primary/20";

function AboutPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    topic: "",
    message: "",
  });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  function update(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.name.trim()) {
      toast.error("Please enter your name.");
      return;
    }
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    if (form.phone.trim() && form.phone.replace(/\D/g, "").length < 10) {
      toast.error("Please enter a valid phone number (at least 10 digits).");
      return;
    }
    if (!form.message.trim() || form.message.trim().length < 10) {
      toast.error("Please enter a message (at least 10 characters).");
      return;
    }

    setBusy(true);

    const { error } = await supabase.from("contact_messages").insert({
      name: form.name.trim(),
      email: form.email.trim(),
      // The column is NOT NULL, so an empty phone is stored as "" rather than
      // null — sending null failed the insert and the form reported an error.
      phone: form.phone.trim(),
      topic: form.topic || "Other",
      message: form.message.trim(),
    });

    setBusy(false);

    if (error) {
      toast.error("Failed to send message. Please try again.");
      console.error(error);
      return;
    }

    setSent(true);
  }

  return (
    <div className="min-h-dvh bg-background">
      <SiteNav />

      {/* ── Editorial header ─────────────────────────────────────────── */}
      <section className="border-b border-border/60">
        <div className="mx-auto max-w-6xl px-4 pb-12 pt-10 sm:px-6 md:pb-16 md:pt-16 lg:px-8">
          <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            <span className="h-px w-10 bg-border" aria-hidden />
            TixNaija / Company
          </div>

          <h1 className="mt-5 max-w-3xl font-display text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.02] tracking-[-0.03em] text-foreground">
            About TixNaija
          </h1>

          <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-muted-foreground">
            A proudly independent Nigerian ticketing platform built to make event creation and
            attendance seamless.
          </p>
        </div>
      </section>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-14 px-4 py-14 sm:px-6 md:py-20 lg:grid-cols-[1fr_420px] lg:gap-16 lg:px-8">
        <div className="min-w-0 space-y-14">
          {/* Ownership */}
          <section>
            <h2 className="font-display text-[28px] leading-tight tracking-[-0.02em] text-foreground md:text-[32px]">
              Who owns TixNaija?
            </h2>
            <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-muted-foreground">
              TixNaija is an independent platform founded by Ogbomo Isaac in 2026. Our goal is to
              simplify event ticketing for organizers and attendees across Nigeria.
            </p>

            <div className="mt-7 rounded-2xl border border-border/70 bg-secondary/25 p-6">
              <h3 className="flex items-start gap-3 text-[15px] font-semibold text-foreground">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                Not affiliated with Tix Africa
              </h3>
              <p className="mt-3 pl-7 text-sm leading-relaxed text-muted-foreground">
                Please note that TixNaija is a completely standalone platform and is{" "}
                <strong className="font-semibold text-foreground">
                  not connected, affiliated, or associated with Tix Africa
                </strong>{" "}
                in any way.
              </p>
              <div className="mt-5 ml-7 rounded-xl border border-border/60 bg-background/60 p-4">
                <h4 className="text-[13px] font-semibold text-foreground">
                  Is TixNaija the same as Tix Africa?
                </h4>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                  No. TixNaija is a distinct and completely separate company, founded independently
                  by Ogbomo Isaac in 2026.
                </p>
              </div>
            </div>
          </section>

          {/* Contact */}
          <section>
            <h2 className="font-display text-[28px] leading-tight tracking-[-0.02em] text-foreground md:text-[32px]">
              Get in touch
            </h2>
            <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-muted-foreground">
              Whether you're an attendee with a ticket problem or an organizer needing support, our
              team is ready to help you succeed.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <a
                href={`tel:${BUSINESS_DETAILS.supportPhone.replace(/\s+/g, "")}`}
                className="group flex items-center gap-4 rounded-2xl border border-border/70 bg-card p-5 transition-[border-color,box-shadow] duration-[var(--duration-fast)] hover:border-border hover:shadow-[0_18px_40px_-28px_rgba(0,0,0,0.35)]"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary/70 text-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                  <PhoneCall className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Call / WhatsApp
                  </span>
                  <span className="mt-1 block truncate text-[15px] font-semibold text-foreground">
                    {BUSINESS_DETAILS.supportPhone}
                  </span>
                </span>
              </a>

              <a
                href={`mailto:${BUSINESS_DETAILS.supportEmail}`}
                className="group flex items-center gap-4 rounded-2xl border border-border/70 bg-card p-5 transition-[border-color,box-shadow] duration-[var(--duration-fast)] hover:border-border hover:shadow-[0_18px_40px_-28px_rgba(0,0,0,0.35)]"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary/70 text-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                  <Mail className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Email us
                  </span>
                  <span
                    className="mt-1 block truncate text-[15px] font-semibold text-foreground"
                    title={BUSINESS_DETAILS.supportEmail}
                  >
                    {BUSINESS_DETAILS.supportEmail}
                  </span>
                </span>
              </a>

              <a
                href="https://www.instagram.com/tixnaija/"
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-4 rounded-2xl border border-border/70 bg-card p-5 transition-[border-color,box-shadow] duration-[var(--duration-fast)] hover:border-border hover:shadow-[0_18px_40px_-28px_rgba(0,0,0,0.35)] sm:col-span-2"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary/70 text-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                  <Instagram className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Follow us
                  </span>
                  <span className="mt-1 block text-[15px] font-semibold text-foreground">
                    @tixnaija
                  </span>
                </span>
                <ArrowRight
                  className="h-4 w-4 text-muted-foreground transition-transform duration-[var(--duration-fast)] group-hover:translate-x-1"
                  aria-hidden
                />
              </a>
            </div>
          </section>

          {/* What we help with */}
          <section>
            <div className="grid gap-3 sm:grid-cols-2">
              {HELP_TOPICS.map(({ label, desc, icon: Icon }) => (
                <div
                  key={label}
                  className="rounded-2xl border border-border/60 bg-card/50 p-6 transition-colors hover:border-border hover:bg-card"
                >
                  <Icon className="h-5 w-5 text-primary" aria-hidden />
                  <p className="mt-4 text-[15px] font-semibold text-foreground">{label}</p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="flex flex-wrap gap-x-8 gap-y-3 border-t border-border/60 pt-7 text-[13px] font-medium text-muted-foreground">
            <Link to="/terms" className="transition-colors hover:text-foreground">
              Terms of Service
            </Link>
            <Link to="/privacy" className="transition-colors hover:text-foreground">
              Privacy Policy
            </Link>
            <Link to="/careers" className="transition-colors hover:text-foreground">
              Careers
            </Link>
          </div>
        </div>

        {/* ── Contact form ─────────────────────────────────────────── */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)] md:p-8">
            {sent ? (
              <div className="flex flex-col items-center gap-6 py-10 text-center">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-emerald-500/10 text-emerald-500">
                  <CheckCircle2 className="h-7 w-7" aria-hidden />
                </span>
                <div>
                  <h2 className="font-display text-[26px] leading-tight text-foreground">
                    Message sent
                  </h2>
                  <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
                    Thanks{form.name ? `, ${form.name.split(" ")[0]}` : ""}! We've received your
                    message and will get back to you within{" "}
                    <strong className="font-semibold text-foreground">1-2 business days</strong>.
                  </p>
                </div>
                <div className="mt-2 flex w-full flex-col gap-2.5">
                  <Button
                    asChild
                    className="h-11 w-full rounded-xl bg-primary text-[15px] font-semibold text-primary-foreground press-sm hover:bg-primary/90"
                  >
                    <Link to="/">Back to events</Link>
                  </Button>
                  <Button
                    onClick={() => {
                      setSent(false);
                      setForm({ name: "", email: "", phone: "", topic: "", message: "" });
                    }}
                    variant="outline"
                    className="h-11 w-full rounded-xl border-border/70 text-[15px] font-medium"
                  >
                    Send another message
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-5" noValidate>
                <div className="mb-6">
                  <h2 className="font-display text-[26px] leading-tight tracking-[-0.02em] text-foreground">
                    Drop a message
                  </h2>
                  <p className="mt-2 text-[13px] text-muted-foreground">
                    Fields marked <span className="font-semibold text-primary">*</span> are
                    required.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="contact-name"
                    className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                  >
                    Full name <span className="text-primary">*</span>
                  </Label>
                  <Input
                    id="contact-name"
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="Chidera Okoye"
                    autoComplete="name"
                    required
                    className={fieldClass}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="contact-email"
                    className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                  >
                    Email address <span className="text-primary">*</span>
                  </Label>
                  <Input
                    id="contact-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                    className={fieldClass}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="contact-phone"
                    className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                  >
                    Phone number (optional)
                  </Label>
                  <Input
                    id="contact-phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    placeholder="+234 800 000 0000"
                    autoComplete="tel"
                    className={fieldClass}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="contact-topic"
                    className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                  >
                    Topic
                  </Label>
                  <select
                    id="contact-topic"
                    value={form.topic}
                    onChange={(e) => update("topic", e.target.value)}
                    className="h-12 w-full appearance-none rounded-xl border border-border/70 bg-background/60 px-4 text-[15px] text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                      backgroundPosition: `right 1rem center`,
                      backgroundRepeat: `no-repeat`,
                      backgroundSize: `1.25em 1.25em`,
                    }}
                  >
                    <option value="" disabled>
                      Select a topic…
                    </option>
                    {TOPICS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="contact-message"
                    className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                  >
                    Message <span className="text-primary">*</span>
                  </Label>
                  <textarea
                    id="contact-message"
                    rows={5}
                    value={form.message}
                    onChange={(e) => update("message", e.target.value)}
                    placeholder="Tell us what's going on and we'll be in touch…"
                    required
                    className="w-full resize-none rounded-xl border border-border/70 bg-background/60 p-4 text-[15px] text-foreground placeholder:text-muted-foreground/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                  />
                </div>

                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  We use your information solely to reply to your inquiry in line with our{" "}
                  <Link to="/privacy" className="underline underline-offset-2 hover:text-foreground">
                    Privacy Policy
                  </Link>
                  .
                </p>

                <Button
                  type="submit"
                  disabled={busy}
                  className="mt-1 h-12 w-full rounded-xl bg-primary text-[15px] font-semibold text-primary-foreground press-sm transition-colors hover:bg-primary/90"
                >
                  {busy ? (
                    <span className="flex items-center gap-2">
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Sending…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Send message <Send className="h-4 w-4" aria-hidden />
                    </span>
                  )}
                </Button>
              </form>
            )}
          </div>
        </aside>
      </main>

      <SiteFooter />
    </div>
  );
}
