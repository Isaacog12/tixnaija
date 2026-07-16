import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";
import {
  UserPlus, Search, CreditCard, QrCode, Ticket, LayoutDashboard,
  ClipboardList, ScanLine, BarChart3, MessageSquare, ShieldCheck,
  ChevronRight,
} from "lucide-react";

export const Route = createFileRoute("/how-it-works")({
  component: HowItWorksPage,
  head: () => ({
    meta: [
      { title: "How It Works — TixNaija" },
      {
        name: "description",
        content:
          "Learn how to buy tickets, sell tickets, and manage events on TixNaija — Nigeria's fastest ticket platform. Step-by-step guide for buyers and organizers.",
      },
    ],
  }),
});

const BUYER_STEPS = [
  {
    icon: UserPlus,
    title: "Create a free account",
    body: "Sign up with your email in under 30 seconds. No subscription, no hidden fees — your account is always free.",
  },
  {
    icon: Search,
    title: "Find an event",
    body: "Browse concerts, comedy shows, conferences, church programs, and campus events across Nigeria. Filter by city or category to find what you love.",
  },
  {
    icon: CreditCard,
    title: "Pay securely with Paystack",
    body: "Complete your purchase with cards, bank transfers, or USSD — powered by Paystack. Your payment is encrypted and secure.",
  },
  {
    icon: QrCode,
    title: "Get your QR ticket instantly",
    body: "Your ticket arrives in your inbox on TixNaija immediately after payment. Each ticket has a unique QR code that can't be duplicated.",
  },
  {
    icon: ScanLine,
    title: "Show up and scan in",
    body: "At the event, the organizer scans your QR code at the door. No printing needed — your phone screen is your ticket.",
  },
];

const ORGANIZER_STEPS = [
  {
    icon: UserPlus,
    title: "Apply to become an organizer",
    body: "Log in and go to your Account page. Fill out a quick application with your details and a selfie holding your NIN. Our team reviews applications promptly.",
  },
  {
    icon: LayoutDashboard,
    title: "Create your event",
    body: "Once approved, head to your dashboard and click 'Create Event'. Add the event title, date, venue, description, cover photo, and ticket tiers with prices.",
  },
  {
    icon: Ticket,
    title: "Publish and share",
    body: "Hit Publish and your event goes live instantly. Share your unique event link on WhatsApp, Instagram, X — anywhere your audience is.",
  },
  {
    icon: BarChart3,
    title: "Track sales in real time",
    body: "Watch ticket sales roll in from your organizer dashboard. See revenue totals, ticket type breakdowns, and buyer details at a glance.",
  },
  {
    icon: ScanLine,
    title: "Scan tickets at the door",
    body: "Use the built-in QR scanner on the event management page to check in attendees. Fast, reliable, works offline.",
  },
  {
    icon: CreditCard,
    title: "Get paid directly",
    body: "Connect your Nigerian bank account via your Account page. After your event, your earnings (minus the platform fee) are settled directly to your account.",
  },
];

const FAQ = [
  {
    q: "How much does TixNaija charge?",
    a: "TixNaija charges a 15% platform fee on each ticket sold. For example, if you sell a ticket for ₦5,000, you receive ₦4,250 and TixNaija retains ₦750. Paystack's processing fee (typically 1.5% + ₦100, capped at ₦2,000) is charged separately at checkout.",
  },
  {
    q: "Are free events supported?",
    a: "Yes! You can create events with ₦0 tickets at no charge. Free tickets go through the same QR delivery system so you can still scan attendees at the door.",
  },
  {
    q: "Can I issue complimentary tickets?",
    a: "Yes. Organizers can issue comp tickets to specific people directly from the event management dashboard — no payment required.",
  },
  {
    q: "What happens if I need to cancel or postpone an event?",
    a: "You can cancel or postpone from the event management page at any time. All ticket buyers are automatically notified via their TixNaija inbox. Refunds are your responsibility as the organizer.",
  },
  {
    q: "Is my payment information safe?",
    a: "Absolutely. TixNaija never stores your card details. All payment processing is handled end-to-end by Paystack, a PCI-DSS Level 1 certified payment processor.",
  },
  {
    q: "How do I contact support?",
    a: "Use the Contact page to send us a message. Our team responds within 24 hours on business days.",
  },
];

function HowItWorksPage() {
  return (
    <div className="min-h-screen">
      <SiteNav />

      {/* ── Hero ── */}
      <div className="relative overflow-hidden border-b border-border/60">
        <div className="absolute inset-0 gradient-sunset opacity-10 pointer-events-none" />
        <div className="mx-auto max-w-6xl px-4 py-14 md:py-20">
          <div className="inline-flex flex-col items-start gap-2 mb-6">
            <span className="text-[11px] font-semibold uppercase tracking-[0.35em] text-primary">
              Platform Guide
            </span>
            <span aria-hidden className="h-px w-12 gradient-sunset" />
          </div>
          <h1 className="font-display text-5xl md:text-7xl leading-[0.95] mb-5">
            How TixNaija works
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-xl leading-relaxed">
            Whether you're going out or putting on a show — here's everything you
            need to know to get started in minutes.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#buyers"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-sm hover:border-primary hover:text-primary transition"
            >
              I want to buy tickets <ChevronRight className="h-3.5 w-3.5" />
            </a>
            <a
              href="#organizers"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-sm hover:border-primary hover:text-primary transition"
            >
              I want to sell tickets <ChevronRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* ── Buyers Section ── */}
      <section id="buyers" className="scroll-mt-20 mx-auto max-w-6xl px-4 py-16 md:py-20">
        <div className="flex items-baseline gap-4 mb-10">
          <span className="font-display text-5xl leading-none text-gradient-sunset">01</span>
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-3xl md:text-4xl leading-tight">For Ticket Buyers</h2>
            <p className="text-sm text-muted-foreground">Find your event, pay, show up — that's it.</p>
          </div>
        </div>

        <div className="relative">
          {/* Connecting line */}
          <div className="absolute left-6 top-10 bottom-10 w-px bg-border hidden md:block" aria-hidden />

          <div className="space-y-8">
            {BUYER_STEPS.map((step, i) => (
              <div key={i} className="flex gap-6">
                <div className="relative shrink-0">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card shadow-sm z-10 relative">
                    <step.icon className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <div className="flex-1 pb-8">
                  <div className="flex items-baseline gap-2 mb-1.5">
                    <span className="font-display text-xs text-muted-foreground/50">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h3 className="font-semibold text-lg">{step.title}</h3>
                  </div>
                  <p className="text-foreground/90 text-base leading-relaxed">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <Link
            to="/browse"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition"
          >
            Browse Events Now <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Divider */}
      <div className="mx-auto max-w-6xl px-4">
        <div className="h-px bg-border" />
      </div>

      {/* ── Organizers Section ── */}
      <section id="organizers" className="scroll-mt-20 mx-auto max-w-6xl px-4 py-16 md:py-20">
        <div className="flex items-baseline gap-4 mb-10">
          <span className="font-display text-5xl leading-none text-gradient-sunset">02</span>
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-3xl md:text-4xl leading-tight">For Event Organizers</h2>
            <p className="text-sm text-muted-foreground">Set up, sell out, get paid — no listing fees.</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {ORGANIZER_STEPS.map((step, i) => (
            <div
              key={i}
              className="rounded-2xl border border-border bg-card/60 p-6 hover:border-primary/40 transition group"
            >
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-primary/10 p-3 text-primary group-hover:bg-primary/20 transition shrink-0">
                  <step.icon className="h-5 w-5" />
                </div>
                <span className="font-display text-3xl leading-none text-muted-foreground/30 group-hover:text-primary/30 transition">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="mt-4 font-semibold text-base">{step.title}</h3>
              <p className="mt-2 text-base text-foreground/90 leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>

        {/* Fee explainer card */}
        <div className="mt-10 rounded-2xl border border-primary/20 bg-primary/5 p-6 md:p-8">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-primary/10 p-3 text-primary shrink-0">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base">Platform fee breakdown</h3>
              <p className="mt-1 text-base text-foreground/90 leading-relaxed">
                TixNaija charges <strong className="text-foreground">15%</strong> of each ticket sale.
                So for a <strong className="text-foreground">₦10,000 ticket</strong>: the buyer pays ₦10,000,
                TixNaija retains <strong className="text-foreground">₦1,500</strong>, and you receive{" "}
                <strong className="text-foreground">₦8,500</strong> — settled directly to your bank account.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition"
          >
            Get started free <ChevronRight className="h-4 w-4" />
          </Link>
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/60 px-6 py-3 text-sm font-semibold hover:border-primary hover:text-primary transition"
          >
            <MessageSquare className="h-4 w-4" /> Talk to us
          </Link>
        </div>
      </section>

      {/* Divider */}
      <div className="mx-auto max-w-6xl px-4">
        <div className="h-px bg-border" />
      </div>

      {/* ── FAQ ── */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:py-20">
        <div className="flex items-baseline gap-4 mb-10">
          <span className="font-display text-5xl leading-none text-gradient-sunset">03</span>
          <div>
            <h2 className="font-display text-3xl md:text-4xl leading-tight">Frequently Asked Questions</h2>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {FAQ.map((item, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card/60 p-6">
              <h3 className="font-semibold text-sm flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                {item.q}
              </h3>
              <p className="mt-3 text-base text-foreground/90 leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="relative overflow-hidden rounded-2xl border border-primary/30 p-8 md:p-14">
          <div className="absolute inset-0 gradient-sunset opacity-90" />
          <div className="relative flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
            <div className="flex-1">
              <h2 className="font-display text-3xl md:text-4xl leading-tight text-primary-foreground">
                Ready to start?
              </h2>
              <p className="mt-2 text-primary-foreground/80 text-sm leading-relaxed max-w-md">
                Join thousands of Nigerians already buying and selling tickets on TixNaija.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/browse"
                className="inline-flex items-center gap-2 rounded-xl bg-background text-foreground px-5 py-3 text-sm font-semibold hover:bg-background/90 transition shadow-none border-0"
              >
                <ClipboardList className="h-4 w-4" /> Browse Events
              </Link>
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="inline-flex items-center gap-2 rounded-xl border border-primary-foreground/40 bg-transparent text-primary-foreground px-5 py-3 text-sm font-semibold hover:bg-primary-foreground/10 transition"
              >
                Create Account
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-xs text-muted-foreground md:flex-row">
          <div className="flex items-baseline gap-0">
            <span className="font-display text-xl leading-none tracking-[0.02em] text-foreground">TIX</span>
            <span className="font-display text-xl leading-none tracking-[0.02em] font-light text-gradient-sunset">NAIJA</span>
          </div>
          <div className="flex gap-4">
            <Link to="/contact" className="hover:text-primary transition">Contact</Link>
            <Link to="/terms" className="hover:text-primary transition">Terms</Link>
            <Link to="/privacy" className="hover:text-primary transition">Privacy</Link>
            <Link to="/careers" className="hover:text-primary transition">Careers</Link>
          </div>
          <p>© {new Date().getFullYear()} — Buy tickets. Turn up. Repeat.</p>
        </div>
      </footer>
    </div>
  );
}
