import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";
import { BackButton } from "@/components/back-button";
import {
  UserPlus, Search, CreditCard, QrCode, ScanLine, LayoutDashboard,
  Ticket, BarChart3, MessageSquare, ShieldCheck, ChevronRight,
  ClipboardList, Lock, TicketCheck, Wallet, Zap,
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

/** Matches the entrance-animation cadence used elsewhere in the app. */
const STAGGER_MS = 80;

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

function HowItWorksPage() {
  return (
    <div className="min-h-dvh">
      <SiteNav />

      {/* ── Hero ── */}
      <div className="relative overflow-hidden border-b border-border/40 pt-6 pb-20 md:pb-28">
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.02]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl -z-10 pointer-events-none" />

        <div className="mx-auto max-w-7xl px-4 w-full relative z-20 mb-10 md:mb-16">
          <BackButton />
        </div>

        <div className="mx-auto max-w-6xl px-4 text-center relative z-10">
          <div className="inline-flex items-center gap-3 mb-8 bg-secondary/50 border border-border/50 backdrop-blur-md rounded-full px-5 py-2 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
              Platform Guide
            </span>
            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          </div>

          <h1 className="type-heading-xl mb-8">
            How <span className="text-gradient-sunset">TixNaija</span> works
          </h1>

          <p className="text-muted-foreground text-lg md:text-2xl max-w-2xl mx-auto leading-relaxed mb-12 font-medium">
            Whether you're going out or putting on a show — here's everything you
            need to get started in minutes.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={scrollTo("buyers")}
              className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-6 py-3 text-sm font-semibold hover:border-primary hover:text-primary transition-all duration-[120ms] shadow-sm press-sm cursor-pointer"
            >
              I want to buy tickets <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={scrollTo("organizers")}
              className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-6 py-3 text-sm font-semibold hover:border-primary hover:text-primary transition-all duration-[120ms] shadow-sm press-sm cursor-pointer"
            >
              I want to sell tickets <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Buyers Section ── */}
      <section id="buyers" className="scroll-mt-24 mx-auto max-w-6xl px-4 py-20 md:py-28 relative">
        <div className="absolute top-40 left-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10" />

        <div className="flex flex-col md:flex-row items-start md:items-baseline gap-6 mb-16">
          <span className="font-display text-6xl md:text-8xl leading-none text-muted-foreground/10 select-none hidden md:block">01</span>
          <div className="flex flex-col gap-3">
            <h2 className="type-heading-lg leading-tight">For Ticket Buyers</h2>
            <p className="text-xl text-muted-foreground font-medium">Find your event, pay, show up — that's it.</p>
          </div>
        </div>

        <div className="relative">
          <div className="absolute left-[27px] top-10 bottom-10 w-0.5 bg-gradient-to-b from-primary/50 via-primary/20 to-transparent hidden md:block rounded-full" aria-hidden />

          <div className="space-y-12">
            {BUYER_STEPS.map((step, i) => (
              <div key={step.title} className="flex gap-6 md:gap-10 stagger-card-in" style={{ animationDelay: `${i * STAGGER_MS}ms` }}>
                <div className="relative shrink-0 hidden md:block">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-primary bg-background shadow-lg shadow-primary/20 z-10 relative">
                    <step.icon className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <div className="flex-1 bg-card border border-border/50 rounded-3xl p-8 shadow-sm hover:shadow-xl hover:border-primary/20 hover:bg-card/50 transition-all duration-300 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -z-10 group-hover:scale-150 transition-transform duration-700" />
                  <div className="flex items-baseline gap-3 mb-4">
                    <span className="md:hidden flex h-10 w-10 items-center justify-center rounded-full border-2 border-primary bg-background text-primary shrink-0">
                      <step.icon className="h-5 w-5" />
                    </span>
                    <span className="font-display text-2xl text-primary/40 group-hover:text-primary transition-colors">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h3 className="type-heading-md tracking-tight">{step.title}</h3>
                  </div>
                  <p className="text-muted-foreground text-lg leading-relaxed">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 flex justify-center md:justify-start md:ml-[96px]">
          <Link
            to="/browse"
            className="inline-flex items-center justify-center gap-2 rounded-full h-14 px-8 gradient-sunset text-primary-foreground glow-primary shadow-lg font-semibold text-lg press-sm transition-all duration-[220ms] ease-out hover:-translate-y-1 w-full md:w-auto"
          >
            Browse Events Now <ChevronRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* ── Organizers Section ── */}
      <section id="organizers" className="scroll-mt-24 bg-card/30 border-y border-border/40 py-20 md:py-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.02]" />

        <div className="mx-auto max-w-6xl px-4 relative z-10">
          <div className="flex flex-col md:flex-row items-start md:items-baseline gap-6 mb-16">
            <span className="font-display text-6xl md:text-8xl leading-none text-muted-foreground/10 select-none hidden md:block">02</span>
            <div className="flex flex-col gap-3">
              <h2 className="type-heading-lg leading-tight">For Event Organizers</h2>
              <p className="text-xl text-muted-foreground font-medium">Set up, sell out, get paid — no listing fees.</p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {ORGANIZER_STEPS.map((step, i) => (
              <div
                key={step.title}
                className="rounded-3xl border border-border/50 bg-card p-8 hover:border-primary/20 hover:bg-card/50 hover:shadow-xl hover:shadow-primary/5 transition-all duration-[350ms] ease-out group flex flex-col stagger-card-in"
                style={{ animationDelay: `${i * STAGGER_MS}ms` }}
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="rounded-2xl bg-primary/10 p-4 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors shadow-sm">
                    <step.icon className="h-6 w-6" />
                  </div>
                  <span className="font-display text-4xl leading-none text-muted-foreground/20 group-hover:text-primary/30 transition-colors">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="type-heading-md mb-3">{step.title}</h3>
                <p className="text-base text-muted-foreground leading-relaxed flex-1">{step.body}</p>
              </div>
            ))}
          </div>

          {/* Payout + fee callout. This is where "get paid" lives, so the step
              grid above stays a clean 3×2 and no step overlaps on payouts. */}
          <div className="mt-12 rounded-[2.5rem] border-2 border-primary/20 bg-primary/5 p-8 md:p-12 relative overflow-hidden group stagger-card-in" style={{ animationDelay: `${ORGANIZER_STEPS.length * STAGGER_MS}ms` }}>
            <div className="absolute right-0 top-0 w-64 h-64 bg-primary/10 rounded-bl-full -z-10 group-hover:scale-110 transition-transform duration-700" />
            <div className="flex flex-col md:flex-row items-start md:items-center gap-8">
              <div className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-xl shrink-0 hidden md:block">
                <Wallet className="h-8 w-8" />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="rounded-xl bg-primary p-2 text-primary-foreground shadow-sm shrink-0 md:hidden">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <h3 className="type-heading-md">Get paid — the fee, in plain numbers</h3>
                </div>
                <p className="text-lg text-foreground/80 leading-relaxed font-medium max-w-3xl">
                  Connect your Paystack account in Settings and payouts settle automatically to your
                  Nigerian bank account. TixNaija retains{" "}
                  <strong className="text-primary font-bold bg-primary/10 px-1 rounded">10%</strong>{" "}
                  of each ticket sale and there's nothing to pay up front. So for a ₦10,000 ticket: the
                  buyer pays ₦10,000, TixNaija keeps ₦1,000, and{" "}
                  <strong className="text-primary font-bold">₦9,000</strong> settles to you (less
                  Paystack's processing charge).
                </p>
              </div>
            </div>
          </div>

          <div className="mt-12 flex flex-wrap gap-4">
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="inline-flex items-center justify-center gap-2 rounded-full h-14 px-8 gradient-sunset text-primary-foreground glow-primary font-semibold text-lg press-sm transition-all duration-[220ms] ease-out hover:-translate-y-1 w-full sm:w-auto"
            >
              Get started free <ChevronRight className="h-5 w-5" />
            </Link>
            <Link
              to="/about"
              className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-border bg-card h-14 px-8 text-lg font-semibold hover:border-primary hover:text-primary press-sm transition-all duration-[120ms] w-full sm:w-auto"
            >
              <MessageSquare className="h-5 w-5" /> Talk to us
            </Link>
          </div>
        </div>
      </section>

      {/* ── Assurance strip ── */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:py-20">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {ASSURANCES.map((item, i) => (
            <div
              key={item.title}
              className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-6 hover:border-primary/20 hover:bg-card transition-all duration-300 stagger-card-in"
              style={{ animationDelay: `${i * STAGGER_MS}ms` }}
            >
              <div className="rounded-xl bg-secondary p-2.5 text-primary w-fit mb-4">
                <item.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-base mb-1.5">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:py-24 relative">
        <div className="absolute right-0 bottom-40 w-[500px] h-[500px] bg-secondary rounded-full blur-3xl -z-10 opacity-50" />

        <div className="flex flex-col md:flex-row items-start md:items-baseline gap-6 mb-16">
          <span className="font-display text-6xl md:text-8xl leading-none text-muted-foreground/10 select-none hidden md:block">03</span>
          <div className="flex flex-col gap-3 w-full">
            <h2 className="type-heading-lg leading-tight">Frequently Asked Questions</h2>
            <p className="text-xl text-muted-foreground font-medium">Everything you need to know about the platform.</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {FAQ.map((item, i) => (
            <div
              key={item.q}
              className="rounded-3xl border border-border/60 bg-card/60 backdrop-blur-sm p-8 hover:bg-card hover:border-border transition-colors group stagger-card-in"
              style={{ animationDelay: `${i * STAGGER_MS}ms` }}
            >
              <h3 className="font-display text-xl mb-4 flex items-start gap-4">
                <div className="rounded-full bg-secondary p-2 group-hover:bg-primary/10 group-hover:text-primary transition-colors shrink-0">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <span className="mt-1">{item.q}</span>
              </h3>
              <p className="text-base text-muted-foreground leading-relaxed pl-14">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="relative overflow-hidden rounded-[3rem] border border-primary/20 p-10 md:p-20 shadow-2xl">
          <div className="absolute inset-0 gradient-sunset opacity-95" />
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative flex flex-col md:flex-row md:items-center gap-10 text-center md:text-left">
            <div className="flex-1">
              <h2 className="type-heading-xl text-primary-foreground mb-4">Ready to start?</h2>
              <p className="text-primary-foreground/90 text-lg md:text-xl leading-relaxed max-w-lg font-medium">
                Join thousands of Nigerians already buying and selling tickets on TixNaija.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/browse"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-background text-foreground h-14 px-8 text-lg font-bold hover:scale-105 transition-transform shadow-xl press-sm"
              >
                <ClipboardList className="h-5 w-5" /> Browse Events
              </Link>
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-primary-foreground/30 bg-transparent text-primary-foreground h-14 px-8 text-lg font-bold hover:bg-primary-foreground/10 transition-colors press-sm"
              >
                Create Account
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-10 bg-card/30">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 md:flex-row">
          <Link to="/" className="flex items-baseline gap-0 hover:opacity-80 transition-opacity">
            <span className="font-display text-2xl leading-none tracking-wide text-foreground">TIX</span>
            <span className="font-display text-2xl leading-none tracking-wide font-light text-gradient-sunset">NAIJA</span>
          </Link>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 text-sm font-medium text-muted-foreground">
            <Link to="/about" className="hover:text-foreground transition-colors">Contact</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link to="/careers" className="hover:text-foreground transition-colors">Careers</Link>
          </div>
          <p className="text-sm text-muted-foreground/70">© {new Date().getFullYear()} — Buy tickets. Turn up. Repeat.</p>
        </div>
      </footer>
    </div>
  );
}
