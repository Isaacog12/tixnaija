import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { BackButton } from "@/components/back-button";
import { useState } from "react";
import { ChevronDown, Ticket, CreditCard, Calendar, MessageCircle, AlertCircle } from "lucide-react";

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
        a: "Yes. To protect your tickets from unauthorized access, prevent fraud, and ensure easy recovery, an account is required before checkout. Creating an account takes less than a minute and lets you access your tickets anytime under 'My Tickets'.",
      },
      {
        q: "Where do I find my tickets after purchase?",
        a: "Your tickets are sent immediately to your registered email address with QR codes attached. You can also log into your TixNaija account and view or download them anytime in My Tickets.",
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
        a: "If an event gets cancelled, the organizer will refund all money back to the ticket holders. You will receive an email notification regarding the cancellation and refund process.",
      },
      {
        q: "What if an event is postponed?",
        a: "If an event is postponed, you can choose to keep your ticket (it remains valid for the new date) or contact us via email to request a refund.",
      },
      {
        q: "Can I get a refund if I just change my mind?",
        a: "Change-of-mind refunds are at the organizer's discretion and are not guaranteed. We recommend checking the event's refund policy before purchasing. If you have a special circumstance, please send us an email explaining your situation.",
      },
      {
        q: "How do I request a refund?",
        a: "To request a refund, please send us an email with your order details and reason. Full terms, cancellation timeframes, and organizer requirements are detailed in our official Refund Policy at /refunds.",
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
        a: "You can delete your account at any time directly in your Account Settings under the Danger Zone. This removes your personal profile, credentials, and uploads in accordance with the NDPA 2023. Financial transaction records are retained strictly as required by law.",
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
        className="flex w-full items-start justify-between gap-4 py-5 text-left text-[15px] font-medium transition-colors hover:text-primary"
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
        <p className="text-[14px] leading-relaxed text-muted-foreground">{item.a}</p>
      </div>
    </div>
  );
}

function FAQSection({ section }: { section: FAQSection }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const Icon = section.icon;

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
      <div className="flex items-center gap-3 border-b border-border/60 px-6 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/70 text-foreground">
          <Icon className="h-4 w-4" aria-hidden />
        </div>
        <h2 className="font-display text-[18px] leading-tight tracking-[-0.01em]">{section.title}</h2>
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
      <section className="border-b border-border/60">
        <div className="mx-auto w-full max-w-6xl px-4 pb-12 pt-6 sm:px-6 md:pb-16 lg:px-8">
          <BackButton />
          <div className="mt-8 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            <span className="h-px w-10 bg-border" aria-hidden />
            Support
          </div>
          <h1 className="mt-5 font-display text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.05] tracking-[-0.03em] text-foreground">
            Help &amp; FAQ
          </h1>
          <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-muted-foreground">
            Quick answers to common questions about tickets, refunds, and events on TixNaija.
          </p>
        </div>
      </section>

      {/* FAQ Sections */}
      <section className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 md:py-16">
        <div className="space-y-4">
          {FAQ_SECTIONS.map((section) => (
            <FAQSection key={section.title} section={section} />
          ))}
        </div>

        {/* CTA — still can't find your answer? */}
        <div className="mt-12 rounded-2xl border border-primary/20 bg-primary/[0.06] p-8 text-center">
          <h3 className="font-display text-[26px] leading-tight tracking-[-0.02em]">Still need help?</h3>
          <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
            Our team typically responds within a few hours during working hours (Mon–Fri, 9am–6pm WAT).
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2.5">
            <Link
               to="/about"
               className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-[14px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 press-sm"
             >
               Contact us
             </Link>
             <Link
               to="/browse"
               className="inline-flex h-11 items-center justify-center rounded-xl border border-border/70 bg-card px-5 text-[14px] font-semibold text-foreground transition-colors hover:bg-secondary/50 press-sm"
             >
               Browse events
             </Link>
          </div>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
