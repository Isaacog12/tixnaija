import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import {
  UserPlus,
  Search,
  CreditCard,
  QrCode,
  ScanLine,
  LayoutDashboard,
  Ticket,
  BarChart3,
  MessageSquare,
  ChevronRight,
  ClipboardList,
  Lock,
  TicketCheck,
  Wallet,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/how-it-works")({
  component: HowItWorksPage,
  head: () => ({
    meta: [
      { title: "How It Works — TixNaija" },
      {
        name: "description",
        content:
          "Learn how to buy tickets, sell tickets, and manage events on TixNaija — Nigeria's straightforward event ticketing platform. Step-by-step guide for buyers and organizers.",
      },
    ],
  }),
});

const BUYER_STEPS = [
  {
    icon: UserPlus,
    title: "Create a free account",
    body: "Sign up with your email in under a minute. Your account is free forever — no subscription, no hidden charges.",
  },
  {
    icon: Search,
    title: "Find your event",
    body: "Browse concerts, comedy, conferences, church programs and campus events across Nigeria. Filter by city or category to find your thing.",
  },
  {
    icon: CreditCard,
    title: "Pay securely",
    body: "Check out with your card, bank transfer or USSD through Paystack. You pay exactly the listed price — TixNaija never adds surprise fees at checkout.",
  },
  {
    icon: QrCode,
    title: "Get your ticket instantly",
    body: "Your QR ticket is emailed to you the moment payment lands, and saved in your account under My Tickets. Every ticket carries a unique code that can't be duplicated.",
  },
  {
    icon: ScanLine,
    title: "Show up and scan in",
    body: "At the gate, the organizer scans your QR code. No printing, no paper — your phone screen is your ticket.",
  },
];

const ORGANIZER_STEPS = [
  {
    icon: UserPlus,
    title: "Apply to become an organizer",
    body: "From your dashboard, submit a short application with your details and a selfie holding your NIN. Applications are typically reviewed within 24–48 hours.",
  },
  {
    icon: LayoutDashboard,
    title: "Create your event",
    body: "Add the title, date, venue, description and cover photo, then set your ticket tiers and prices. Free (₦0) tickets are supported too.",
  },
  {
    icon: Ticket,
    title: "Publish and share",
    body: "Hit Publish and your event page goes live instantly. Customize it with colors, tags and checkout questions, then share your unique link anywhere.",
  },
  {
    icon: BarChart3,
    title: "Track sales in real time",
    body: "Watch tickets sell from your dashboard — live sales, check-in counts and conversion. There's no listing fee to pay up front.",
  },
  {
    icon: MessageSquare,
    title: "Message your attendees",
    body: "Send announcements, venue changes or thank-yous to every ticket buyer at once with the built-in broadcast tool.",
  },
  {
    icon: ScanLine,
    title: "Scan tickets at the door",
    body: "Check attendees in with the built-in QR scanner on the event page. Fast, real-time validation stops duplicate tickets at the gate.",
  },
];

const ASSURANCES = [
  {
    icon: Lock,
    title: "Bank-grade security",
    body: "Payments are handled end-to-end by Paystack, PCI-DSS Level 1 certified. TixNaija never stores your card details.",
  },
  {
    icon: TicketCheck,
    title: "Unfakeable tickets",
    body: "Every ticket carries a unique QR code, validated live at the door so no one gets in twice.",
  },
  {
    icon: Wallet,
    title: "No listing fees",
    body: "Organizers pay nothing up front — just a flat 10% platform fee when a ticket actually sells.",
  },
  {
    icon: Zap,
    title: "Instant delivery",
    body: "Tickets land in your inbox the moment payment succeeds, and stay in your account for good.",
  },
];

const FAQ = [
  {
    q: "How much does TixNaija charge?",
    a: "Buyers pay exactly the listed ticket price — no added processing fees at checkout. Organizers pay a flat 10% platform fee from each paid ticket sale; Paystack's processing charge is deducted on settlement. Free events cost nothing.",
  },
  {
    q: "Are free events supported?",
    a: "Yes. You can create events with ₦0 tickets at no charge. Free tickets go through the same QR delivery and door-scanning system as paid ones.",
  },
  {
    q: "Can I give out complimentary tickets?",
    a: "Yes. Organizers can issue comp tickets to specific people straight from the event dashboard — no payment required.",
  },
  {
    q: "What if I need to cancel or postpone an event?",
    a: "You can cancel or postpone from the event page at any time. Every ticket buyer is notified automatically by email and in-app. Organizer obligations and attendee refund rights are set out in our Refund Policy.",
  },
  {
    q: "Is my payment information safe?",
    a: "Absolutely. TixNaija never stores your card details. All payment processing is handled end-to-end by Paystack, a PCI-DSS Level 1 certified payment processor.",
  },
  {
    q: "How do I contact support?",
    a: "Use the in-app support assistant or the Contact page. Our team typically replies within a few hours during working hours (Mon–Fri, 9am–6pm WAT).",
  },
];

function scrollTo(id: string) {
  return (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
}

function SectionHeading({
  index,
  title,
  lede,
}: {
  index: string;
  title: string;
  lede: string;
}) {
  return (
    <div className="mb-12 grid gap-4 border-b border-border/60 pb-8 md:grid-cols-[auto_1fr] md:items-end md:gap-8">
      <span className="font-display text-5xl leading-none text-muted-foreground/25 md:text-6xl">
        {index}
      </span>
      <div>
        <h2 className="font-display text-[30px] leading-tight tracking-[-0.02em] text-foreground md:text-[36px]">
          {title}
        </h2>
        <p className="mt-2 text-[15px] text-muted-foreground">{lede}</p>
      </div>
    </div>
  );
}

function HowItWorksPage() {
  return (
    <div className="min-h-dvh bg-background">
      <SiteNav />

      {/* ── Editorial header ─────────────────────────────────────────── */}
      <section className="border-b border-border/60">
        <div className="mx-auto max-w-6xl px-4 pb-12 pt-10 sm:px-6 md:pb-16 md:pt-16 lg:px-8">
          <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            <span className="h-px w-10 bg-border" aria-hidden />
            Platform guide
          </div>

          <h1 className="mt-5 max-w-3xl font-display text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.02] tracking-[-0.03em] text-foreground">
            How TixNaija works
          </h1>

          <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-muted-foreground">
            Whether you're going out or putting on a show — here's everything you need to get
            started in minutes.
          </p>

          <div className="mt-8 flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={scrollTo("buyers")}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border/70 bg-card px-5 py-2.5 text-[13px] font-semibold text-foreground transition-colors hover:border-border hover:bg-secondary/50 press-sm"
            >
              I want to buy tickets <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={scrollTo("organizers")}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border/70 bg-card px-5 py-2.5 text-[13px] font-semibold text-foreground transition-colors hover:border-border hover:bg-secondary/50 press-sm"
            >
              I want to sell tickets <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>
      </section>

      {/* ── Buyers ───────────────────────────────────────────────────── */}
      <section id="buyers" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6 md:py-24 lg:px-8">
        <SectionHeading index="01" title="For ticket buyers" lede="Find your event, pay, show up — that's it." />

        <ol className="space-y-3">
          {BUYER_STEPS.map((step, i) => (
            <li
              key={step.title}
              className="group grid gap-5 rounded-2xl border border-border/60 bg-card p-6 transition-colors hover:border-border md:grid-cols-[auto_1fr] md:items-start md:gap-7 md:p-7"
            >
              <div className="flex items-center gap-3 md:flex-col md:items-start md:gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary/70 text-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                  <step.icon className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <span className="font-display text-sm text-muted-foreground/70 md:pl-2.5">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <div>
                <h3 className="text-[17px] font-semibold leading-snug text-foreground">
                  {step.title}
                </h3>
                <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-10">
          <Link
            to="/browse"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-[15px] font-semibold text-primary-foreground press-sm transition-colors hover:bg-primary/90"
          >
            Browse events <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>

      {/* ── Organizers ───────────────────────────────────────────────── */}
      <section id="organizers" className="scroll-mt-24 border-y border-border/60 bg-secondary/20 py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            index="02"
            title="For event organizers"
            lede="Set up, sell out, get paid — no listing fees."
          />

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {ORGANIZER_STEPS.map((step, i) => (
              <div
                key={step.title}
                className="group flex flex-col rounded-2xl border border-border/60 bg-card p-6 transition-colors hover:border-border"
              >
                <div className="mb-5 flex items-start justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary/70 text-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                    <step.icon className="h-[18px] w-[18px]" aria-hidden />
                  </span>
                  <span className="font-display text-sm text-muted-foreground/50">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="text-[16px] font-semibold leading-snug text-foreground">{step.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            ))}
          </div>

          {/* Payout callout */}
          <div className="mt-8 rounded-2xl border border-primary/25 bg-primary/[0.06] p-6 md:p-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:gap-7">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
                <Wallet className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h3 className="text-[17px] font-semibold text-foreground">
                  Get paid — the fee, in plain numbers
                </h3>
                <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-foreground/80">
                  Connect your Paystack account in Settings and payouts settle automatically to your
                  Nigerian bank account. TixNaija retains{" "}
                  <strong className="font-semibold text-primary">10%</strong> of each ticket sale and
                  there's nothing to pay up front. So for a ₦10,000 ticket: the buyer pays ₦10,000,
                  TixNaija keeps ₦1,000, and{" "}
                  <strong className="font-semibold text-foreground">₦9,000</strong> settles to you
                  (less Paystack's processing charge).
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-[15px] font-semibold text-primary-foreground press-sm transition-colors hover:bg-primary/90"
            >
              Get started free <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              to="/about"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border/70 bg-card px-6 text-[15px] font-semibold text-foreground transition-colors hover:bg-secondary/50 press-sm"
            >
              <MessageSquare className="h-4 w-4" aria-hidden /> Talk to us
            </Link>
          </div>
        </div>
      </section>

      {/* ── Assurances ───────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-14 md:py-20 sm:px-6 lg:px-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ASSURANCES.map((item) => (
            <div key={item.title} className="rounded-2xl border border-border/60 bg-card p-6">
              <item.icon className="h-5 w-5 text-primary" aria-hidden />
              <h3 className="mt-4 text-[15px] font-semibold text-foreground">{item.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 md:pb-24 lg:px-8">
        <SectionHeading
          index="03"
          title="Frequently asked questions"
          lede="Everything you need to know about the platform."
        />

        <dl className="divide-y divide-border/60 border-y border-border/60">
          {FAQ.map((item, i) => (
            <div key={item.q} className="grid gap-3 py-6 md:grid-cols-[auto_1fr_2fr] md:gap-8">
              <span className="font-display text-sm text-muted-foreground/60">
                {String(i + 1).padStart(2, "0")}
              </span>
              <dt className="text-[15px] font-semibold leading-snug text-foreground">{item.q}</dt>
              <dd className="text-[14px] leading-relaxed text-muted-foreground">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl">
          <div className="absolute inset-0 gradient-sunset" aria-hidden />
          <div className="relative flex flex-col gap-8 p-8 md:flex-row md:items-center md:justify-between md:p-14">
            <div>
              <h2 className="font-display text-[30px] leading-[1.05] tracking-[-0.02em] text-primary-foreground md:text-[40px]">
                Ready to start?
              </h2>
              <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-primary-foreground/90">
                Join thousands of Nigerians already buying and selling tickets on TixNaija.
              </p>
            </div>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <Link
                to="/browse"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-background px-6 text-[15px] font-semibold text-foreground press-sm transition-transform hover:scale-[1.02]"
              >
                <ClipboardList className="h-4 w-4" aria-hidden /> Browse events
              </Link>
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-primary-foreground/40 px-6 text-[15px] font-semibold text-primary-foreground transition-colors hover:bg-primary-foreground/10 press-sm"
              >
                Create account
              </Link>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
