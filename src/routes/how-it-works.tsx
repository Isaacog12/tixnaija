import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";
import { BackButton } from "@/components/back-button";
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
    body: "Hit Publish and your event goes live instantly. Customize your event page with colors, tags, and checkout questions, then share your unique link anywhere.",
  },
  {
    icon: BarChart3,
    title: "Track sales & payouts",
    body: "Watch ticket sales roll in from your organizer dashboard. See real-time analytics, track conversion rates, and view your estimated net payouts.",
  },
  {
    icon: MessageSquare,
    title: "Message attendees",
    body: "Easily send announcements, venue changes, or thank-you emails to all your ticket buyers at once via the built-in mass email tool.",
  },
  {
    icon: ScanLine,
    title: "Scan tickets at the door",
    body: "Use the built-in QR scanner on the event management page to check in attendees. Fast, real-time validation ensures no duplicate tickets are used.",
  },
  {
    icon: CreditCard,
    title: "Get paid directly",
    body: "Connect your Paystack account via your Settings page. Payouts are automated and settled directly to your connected bank account.",
  },
];

const FAQ = [
  {
    q: "How much does TixNaija charge?",
    a: "TixNaija charges a 10% platform fee on each ticket sold. For example, if you sell a ticket for ₦5,000, you receive ₦4,500 and TixNaija retains ₦500. Paystack's processing fee (typically 1.5% + ₦100, capped at ₦2,000) is charged separately at checkout.",
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

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

function HowItWorksPage() {
  return (
    <div className="min-h-dvh">
      <SiteNav />
      {/* ── Hero ── */}
      <div className="relative overflow-hidden border-b border-border/40 pt-6 pb-20 md:pb-32">
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.02]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl -z-10 pointer-events-none" />
        
        <div className="mx-auto max-w-7xl px-4 w-full relative z-20 mb-10 md:mb-20">
          <BackButton />
        </div>

        <div  
          className="mx-auto max-w-6xl px-4 text-center relative z-10"
        >
          <div  className="inline-flex items-center gap-3 mb-8 bg-secondary/50 border border-border/50 backdrop-blur-md rounded-full px-5 py-2 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
              Platform Guide
            </span>
            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          </div>
          <h1 className="type-heading-xl mb-8">
            How <span className="text-gradient-sunset">TixNaija</span> works
          </h1>
          <p  className="text-muted-foreground text-lg md:text-2xl max-w-2xl mx-auto leading-relaxed mb-12 font-medium">
            Whether you're going out or putting on a show — here's everything you
            need to know to get started in minutes.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('buyers')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-6 py-3 text-sm font-semibold hover:border-primary hover:text-primary transition-all duration-[120ms] shadow-sm press-sm cursor-pointer"
            >
              I want to buy tickets <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('organizers')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
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
        
        <div 
          
          
          className="flex flex-col md:flex-row items-start md:items-baseline gap-6 mb-16"
        >
          <span className="font-display text-6xl md:text-8xl leading-none text-muted-foreground/10 select-none hidden md:block">01</span>
          <div className="flex flex-col gap-3">
            <h2 className="type-heading-lg leading-tight">For Ticket Buyers</h2>
            <p className="text-xl text-muted-foreground font-medium">Find your event, pay, show up — that's it.</p>
          </div>
        </div>

        <div className="relative">
          <div className="absolute left-[27px] top-10 bottom-10 w-0.5 bg-gradient-to-b from-primary/50 via-primary/20 to-transparent hidden md:block rounded-full" aria-hidden />

          <div 
            
            
            className="space-y-12"
          >
            {BUYER_STEPS.map((step, i) => (
              <div  key={i} className="flex gap-6 md:gap-10">
                <div className="relative shrink-0 hidden md:block">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-primary bg-background shadow-lg shadow-primary/20 z-10 relative">
                    <step.icon className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <div className="flex-1 bg-card border border-border/50 rounded-3xl p-8 shadow-sm hover:shadow-xl hover:border-primary/20 hover:bg-card/50 transition-all duration-300 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -z-10 group-hover:scale-150 transition-transform duration-700" />
                  <div className="flex items-baseline gap-3 mb-4">
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

        <div   className="mt-16 flex justify-center md:justify-start md:ml-[96px]">
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
          <div 
            
            
            className="flex flex-col md:flex-row items-start md:items-baseline gap-6 mb-16"
          >
            <span className="font-display text-6xl md:text-8xl leading-none text-muted-foreground/10 select-none hidden md:block">02</span>
            <div className="flex flex-col gap-3">
              <h2 className="type-heading-lg leading-tight">For Event Organizers</h2>
              <p className="text-xl text-muted-foreground font-medium">Set up, sell out, get paid — no listing fees.</p>
            </div>
          </div>

          <div 
            
            
            className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            {ORGANIZER_STEPS.map((step, i) => (
              <div
                
                key={i}
                className="rounded-3xl border border-border/50 bg-card p-8 hover:border-primary/20 hover:bg-card/50 hover:shadow-xl hover:shadow-primary/5 transition-all duration-[350ms] ease-out group flex flex-col"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="rounded-2xl bg-primary/10 p-4 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors shadow-sm">
                    <step.icon className="h-6 w-6" />
                  </div>
                  <span className="font-display text-4xl leading-none text-muted-foreground/20 group-hover:text-primary/30 transition-colors">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="type-heading-sm mb-3">{step.title}</h3>
                <p className="text-base text-muted-foreground leading-relaxed flex-1">{step.body}</p>
              </div>
            ))}
          </div>

          <div 
             
            className="mt-12 rounded-[2.5rem] border-2 border-primary/20 bg-primary/5 p-8 md:p-12 relative overflow-hidden group"
          >
            <div className="absolute right-0 top-0 w-64 h-64 bg-primary/10 rounded-bl-full -z-10 group-hover:scale-110 transition-transform duration-700" />
            <div className="flex flex-col md:flex-row items-start md:items-center gap-8">
              <div className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-xl shrink-0 hidden md:block">
                <BarChart3 className="h-8 w-8" />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="rounded-xl bg-primary p-2 text-primary-foreground shadow-sm shrink-0 md:hidden">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <h3 className="type-heading-md">Platform fee breakdown</h3>
                </div>
                <p className="text-lg text-foreground/80 leading-relaxed font-medium max-w-3xl">
                  TixNaija charges <strong className="text-primary font-bold bg-primary/10 px-1 rounded">10%</strong> of each ticket sale.
                  So for a ₦10,000 ticket: the buyer pays ₦10,000,
                  TixNaija retains ₦1,000, and you receive{" "}
                  <strong className="text-primary font-bold">₦9,000</strong> — settled directly to your bank account.
                </p>
              </div>
            </div>
          </div>

          <div   className="mt-12 flex flex-wrap gap-4">
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

      {/* ── FAQ ── */}
      <section className="mx-auto max-w-6xl px-4 py-20 md:py-28 relative">
        <div className="absolute right-0 bottom-40 w-[500px] h-[500px] bg-secondary rounded-full blur-3xl -z-10 opacity-50" />
        
        <div 
          
          
          className="flex flex-col md:flex-row items-start md:items-baseline gap-6 mb-16 text-center md:text-left"
        >
          <span className="font-display text-6xl md:text-8xl leading-none text-muted-foreground/10 select-none hidden md:block">03</span>
          <div className="flex flex-col gap-3 w-full">
            <h2 className="font-display text-4xl md:text-5xl leading-tight">Frequently Asked Questions</h2>
            <p className="text-xl text-muted-foreground font-medium">Everything you need to know about the platform.</p>
          </div>
        </div>

        <div 
          
          
          className="grid gap-6 md:grid-cols-2"
        >
          {FAQ.map((item, i) => (
            <div  key={i} className="rounded-3xl border border-border/60 bg-card/60 backdrop-blur-sm p-8 hover:bg-card hover:border-border transition-colors group">
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
        <div 
           
          className="relative overflow-hidden rounded-[3rem] border border-primary/20 p-10 md:p-20 shadow-2xl"
        >
          <div className="absolute inset-0 gradient-sunset opacity-95" />
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative flex flex-col md:flex-row md:items-center gap-10 text-center md:text-left">
            <div className="flex-1">
              <h2 className="type-heading-xl text-primary-foreground mb-4">
                Ready to start?
              </h2>
              <p className="text-primary-foreground/90 text-lg md:text-xl leading-relaxed max-w-lg font-medium">
                Join thousands of Nigerians already buying and selling tickets on TixNaija.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/browse"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-background text-foreground h-14 px-8 text-lg font-bold hover:scale-105 transition-transform shadow-xl"
              >
                <ClipboardList className="h-5 w-5" /> Browse Events
              </Link>
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-primary-foreground/30 bg-transparent text-primary-foreground h-14 px-8 text-lg font-bold hover:bg-primary-foreground/10 transition-colors"
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
