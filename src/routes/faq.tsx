import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";
import { BackButton } from "@/components/back-button";
import { useState } from "react";
import { ChevronDown, LifeBuoy, Ticket, CreditCard, Calendar, MessageCircle, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/faq")({
  component: FAQPage,
  head: () => ({
    meta: [
      { title: "Help & FAQ — TixNaija" },
      {
        name: "description",
        content:
          "Get answers to common questions about buying tickets, refunds, event cancellations, and more on TixNaija.",
      },
    ],
  }),
});

interface FAQItem {
  q: string;
  a: string | React.ReactNode;
}

interface FAQSection {
  icon: React.ElementType;
  title: string;
  items: FAQItem[];
}

const FAQ_SECTIONS: FAQSection[] = [
  {
    icon: Ticket,
    title: "Buying Tickets",
    items: [
      {
        q: "How do I buy a ticket?",
        a: "Find an event on TixNaija, select your ticket type and quantity, then complete checkout via Paystack. You'll receive an email with a QR-coded ticket immediately after payment.",
      },
      {
        q: "Do I need to create an account to buy a ticket?",
        a: "No — you can check out as a guest using just your name and email. Creating an account lets you see all your tickets in one place under 'My Tickets'.",
      },
      {
        q: "Where do I find my tickets after purchase?",
        a: "Check your email for a confirmation with your QR tickets attached. If you created an account, you can also visit My Tickets at any time to view and download them.",
      },
      {
        q: "Can I buy tickets for someone else?",
        a: "Yes. During checkout you can enter the attendee name(s) separately from the buyer email. You'll receive the ticket to your email and can forward it on.",
      },
      {
        q: "What payment methods does TixNaija accept?",
        a: "We use Paystack, which supports debit/credit cards, bank transfer, USSD, and Opay/Palmpay. All payments are in Nigerian Naira (₦).",
      },
    ],
  },
  {
    icon: CreditCard,
    title: "Refunds & Cancellations",
    items: [
      {
        q: "How do refunds work?",
        a: "Refunds are processed back to your original payment method. Processing time is typically 3–7 business days depending on your bank. TixNaija charges no refund fee.",
      },
      {
        q: "What if my event is cancelled?",
        a: "If an organizer cancels an event, all ticket holders are eligible for a full refund. You'll receive an email notification and can request a refund directly from your My Tickets page.",
      },
      {
        q: "What if an event is postponed?",
        a: "If an event is postponed, you can choose to keep your ticket (it remains valid for the new date) or request a refund. The choice is yours — check your email for the notice and options.",
      },
      {
        q: "Can I get a refund if I just change my mind?",
        a: "Change-of-mind refunds are at the organizer's discretion and are not guaranteed. We recommend checking the event's refund policy before purchasing. If you have a special circumstance, use the 'Request Refund' button on your ticket and explain your situation.",
      },
      {
        q: "How do I request a refund?",
        a: (
          <>
            Go to <strong>My Tickets</strong>, find the event, and click the{" "}
            <strong>Request Refund</strong> button. Fill in the reason and submit — the
            organizer and TixNaija team will review it and get back to you within 2 business
            days.
          </>
        ),
      },
    ],
  },
  {
    icon: Calendar,
    title: "Events & Organizers",
    items: [
      {
        q: "How do I contact the event organizer?",
        a: "Each event page has an 'Ask a question' section in the inbox/messaging area. You can also find organizer contact details listed on the event page. TixNaija can't speak on behalf of organizers.",
      },
      {
        q: "Is the event I found on TixNaija legitimate?",
        a: "All organizers on TixNaija must apply and be approved before listing paid events. If you suspect a fraudulent listing, please contact us immediately via the Contact page and we'll investigate.",
      },
      {
        q: "Why has the event I bought tickets for disappeared?",
        a: "Events can be unpublished or cancelled by the organizer. If this happens to an event you have tickets for, you'll receive an email. If you didn't, reach out to us via the Contact page.",
      },
      {
        q: "How do I become an event organizer on TixNaija?",
        a: "Head to the Dashboard, click 'Become an Organizer' and complete the application form. Applications are typically reviewed within 24–48 hours.",
      },
    ],
  },
  {
    icon: MessageCircle,
    title: "Account & Access",
    items: [
      {
        q: "I forgot my password. How do I reset it?",
        a: "Click 'Forgot Password' on the login screen, enter your email, and you'll receive a reset link within a few minutes. Check your spam folder if it doesn't arrive.",
      },
      {
        q: "Can I change the email address on my account?",
        a: "Account email changes are not yet available self-serve. Contact us via the Contact page and we'll update it manually after verifying your identity.",
      },
      {
        q: "How do I delete my account?",
        a: "Contact us via the Contact page with a deletion request. We'll process it within 7 days. Note: if you have upcoming paid tickets, we recommend waiting until after those events.",
      },
    ],
  },
  {
    icon: AlertCircle,
    title: "Technical Issues",
    items: [
      {
        q: "I paid but never received my ticket email. What do I do?",
        a: "First, check your spam/junk folder. If it's not there, log into your account and visit My Tickets — your ticket should be there. If the problem persists, contact us with your order details.",
      },
      {
        q: "My QR code won't scan at the door. What happens?",
        a: "Show the door staff your ticket email or open the ticket on your phone. If still an issue, the organizer can manually look up your name on their attendee list. Contact us after the event if you were wrongly turned away.",
      },
      {
        q: "The ticket page is showing an error. What do I do?",
        a: "Try refreshing the page or clearing your browser cache. If the problem persists across devices, the service may be temporarily down — check our social media for updates, or contact us.",
      },
    ],
  },
];

function AccordionItem({ item, isOpen, onToggle }: { item: FAQItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-border/60 last:border-0">
      <button
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-4 py-5 text-left text-sm font-medium transition-colors hover:text-primary"
        aria-expanded={isOpen}
      >
        <span className="leading-relaxed">{item.q}</span>
        <ChevronDown
          className={`mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
            isOpen ? "rotate-180 text-primary" : ""
          }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? "max-h-96 pb-5" : "max-h-0"
        }`}
      >
        <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
      </div>
    </div>
  );
}

function FAQSection({ section }: { section: FAQSection }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const Icon = section.icon;

  return (
    <div className="rounded-2xl border border-border/40 bg-card/60 overflow-hidden shadow-sm">
      <div className="flex items-center gap-3 border-b border-border/50 bg-card/60 px-6 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-sunset">
          <Icon className="h-4 w-4 text-primary-foreground" />
        </div>
        <h2 className="font-semibold">{section.title}</h2>
      </div>
      <div className="px-6">
        {section.items.map((item, i) => (
          <AccordionItem
            key={i}
            item={item}
            isOpen={openIndex === i}
            onToggle={() => setOpenIndex(openIndex === i ? null : i)}
          />
        ))}
      </div>
    </div>
  );
}

function FAQPage() {
  return (
    <div className="min-h-dvh bg-background">
      <SiteNav />
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/50 bg-card/20 pb-16 pt-6 md:pb-24">
        <div className="mx-auto max-w-7xl px-4 w-full relative z-20 mb-8 md:mb-12">
          <BackButton />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_60%)]" />
        <div className="relative mx-auto max-w-3xl px-4 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl gradient-sunset shadow-glow">
            <LifeBuoy className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="type-heading-xl mt-6">
            Help &amp; FAQ
          </h1>
          <p className="mt-4 text-base text-muted-foreground md:text-lg max-w-xl mx-auto">
            Quick answers to common questions about tickets, refunds, and events on TixNaija.
          </p>
        </div>
      </section>

      {/* FAQ Sections */}
      <section className="mx-auto max-w-3xl px-4 py-12 md:py-16">
        <div className="space-y-6">
          {FAQ_SECTIONS.map((section) => (
            <FAQSection key={section.title} section={section} />
          ))}
        </div>

        {/* CTA — still can't find your answer? */}
        <div className="mt-12 rounded-2xl border border-primary/20 bg-primary/5 p-8 text-center">
          <h3 className="font-display text-2xl">Still need help?</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Our team typically responds within a few hours during working hours (Mon–Fri, 9am–6pm WAT).
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
               to="/about"
               className="inline-flex items-center justify-center rounded-full gradient-sunset px-6 py-3 text-sm font-semibold text-primary-foreground glow-primary press-sm transition-all duration-[120ms]"
             >
               Contact us
             </Link>
             <Link
               to="/browse"
               className="inline-flex items-center justify-center rounded-full border border-border bg-background px-6 py-3 text-sm font-medium press-sm transition-all duration-[120ms] hover:bg-secondary hover:text-foreground"
             >
               Browse events
             </Link>
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
            <Link to="/how-it-works" className="hover:text-primary transition">Guide</Link>
            <Link to="/faq" className="hover:text-primary transition text-primary font-medium">Help / FAQ</Link>
            <Link to="/about" className="hover:text-primary transition">Contact</Link>
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
