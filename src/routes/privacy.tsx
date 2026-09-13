import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { BackButton } from "@/components/back-button";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Privacy Policy — TixNaija" },
      {
        name: "description",
        content:
          "How TixNaija collects, uses, and protects your personal data in accordance with the Nigeria Data Protection Regulation (NDPR).",
      },
    ],
  }),
});

const SECTIONS = [
  { id: "intro", label: "Introduction" },
  { id: "data-collected", label: "Data We Collect" },
  { id: "payments", label: "Payment Processing" },
  { id: "why", label: "Why We Collect Data" },
  { id: "cookies", label: "Cookies & Analytics" },
  { id: "sharing", label: "Data Sharing" },
  { id: "retention", label: "Data Retention" },
  { id: "rights", label: "Your NDPR Rights" },
  { id: "security", label: "Security" },
  { id: "contact", label: "Contact Us" },
];

const LAST_UPDATED = "July 14, 2025";

function PrivacyPage() {
  return (
    <div className="min-h-dvh">
      <SiteNav />
      {/* ── Hero header ── */}
      <div className="relative overflow-hidden border-b border-border/60 pb-12 pt-6 md:pb-16">
        <div className="mx-auto max-w-7xl px-4 w-full relative z-20 mb-6 md:mb-10">
          <BackButton />
        </div>
        <div className="absolute inset-0 gradient-sunset opacity-10 pointer-events-none" />
        <div className="mx-auto max-w-6xl px-4">
          <h1 className="font-display text-5xl md:text-7xl leading-[0.95] mb-4">
            Privacy Policy
          </h1>
          <p className="text-muted-foreground text-sm mt-3">
            Last updated: <span className="text-foreground font-medium">{LAST_UPDATED}</span>
          </p>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="mx-auto max-w-6xl px-4 py-12 md:py-16 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-12">

        {/* Sticky sidebar TOC */}
        <aside className="hidden md:block">
          <div className="sticky top-8">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-4 font-semibold">
              Contents
            </p>
            <nav className="flex flex-col gap-1">
              {SECTIONS.map((s, i) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="flex items-center gap-2.5 rounded px-2 py-1.5 text-sm text-muted-foreground hover:text-primary hover:bg-primary/5 transition group"
                >
                  <span className="font-display text-xs text-muted-foreground/50 group-hover:text-primary/60 w-5 shrink-0">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {s.label}
                </a>
              ))}
            </nav>

            <div className="mt-8 pt-6 border-t border-border/50">
              <Link
                to="/terms"
                className="text-xs text-muted-foreground hover:text-primary transition"
              >
                Terms of Service →
              </Link>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0 space-y-1">

          {/* Section 1 — Introduction */}
          <section id="intro" className="scroll-mt-8 pb-10 border-b border-border/40">
            <SectionHeading number="01" title="Introduction" />
            <p className="text-muted-foreground leading-relaxed mt-4">
              <strong className="text-foreground">TixNaija</strong> respects your privacy and is committed to protecting
              your personal data. This Privacy Policy explains how we collect, use, store, and protect information you
              provide when using our platform — whether as a ticket buyer, event organizer, or visitor.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-3">
              This policy is informed by the <strong className="text-foreground">Nigeria Data Protection Regulation (NDPR)</strong>
              {" "}and other applicable Nigerian data protection laws. By using TixNaija, you consent to the practices
              described in this policy.
            </p>
          </section>

          {/* Section 2 — Data Collected */}
          <section id="data-collected" className="scroll-mt-8 py-10 border-b border-border/40">
            <SectionHeading number="02" title="Data We Collect" />
            <p className="text-muted-foreground leading-relaxed mt-4">
              We only collect data that is strictly necessary to deliver our ticketing services:
            </p>

            <div className="mt-5 grid gap-4">
              {[
                {
                  role: "Buyers & Attendees",
                  data: "Full name, email address, and phone number — used to generate, deliver, and validate your tickets.",
                },
                {
                  role: "Event Organizers",
                  data: "Full name, email address, phone number, and Nigerian bank account details for processing payouts via Paystack.",
                },
                {
                  role: "All Users",
                  data: "Basic usage data such as IP address, browser type, and pages visited — collected in anonymized form to improve platform performance.",
                },
              ].map(({ role, data }) => (
                <div key={role} className="rounded-lg border border-border bg-card/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary mb-1">{role}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{data}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Section 3 — Payments */}
          <section id="payments" className="scroll-mt-8 py-10 border-b border-border/40">
            <SectionHeading number="03" title="Payment Processing" />
            <p className="text-muted-foreground leading-relaxed mt-4">
              <strong className="text-foreground">TixNaija does not store, process, or have access to your payment
              card details</strong>. All payments on the platform are handled securely by{" "}
              <strong className="text-foreground">Paystack</strong>, a PCI-DSS compliant payment gateway.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-3">
              When you make a purchase, your card or bank transfer details are entered directly on Paystack's secure
              infrastructure and are subject to{" "}
              <a
                href="https://paystack.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-4 hover:opacity-80"
              >
                Paystack's Privacy Policy
              </a>
              . TixNaija only receives a transaction reference and confirmation status from Paystack to issue your ticket.
            </p>
          </section>

          {/* Section 4 — Why */}
          <section id="why" className="scroll-mt-8 py-10 border-b border-border/40">
            <SectionHeading number="04" title="Why We Collect Data" />
            <p className="text-muted-foreground leading-relaxed mt-4">
              Your data is used strictly for the following purposes:
            </p>
            <ul className="mt-4 space-y-3">
              {[
                "To generate, deliver, and validate your QR-coded event tickets.",
                "To process payouts to event organizers after successful ticket sales.",
                "To send critical event notifications — including cancellations, postponements, or venue changes.",
                "To provide customer support and respond to inquiries or disputes.",
                "To detect and prevent fraudulent activity on the platform.",
                "To comply with our legal and regulatory obligations under Nigerian law.",
              ].map((item, i) => (
                <li key={i} className="flex gap-3 text-sm text-muted-foreground">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              We do <strong className="text-foreground">not</strong> sell, rent, or trade your personal data to
              third-party advertisers under any circumstances.
            </p>
          </section>

          {/* Section 5 — Cookies */}
          <section id="cookies" className="scroll-mt-8 py-10 border-b border-border/40">
            <SectionHeading number="05" title="Cookies & Analytics" />
            <p className="text-muted-foreground leading-relaxed mt-4">
              TixNaija uses cookies and standard analytics tools to understand how users interact with our platform
              and to improve the experience over time. The types of cookies we use:
            </p>
            <ul className="mt-4 space-y-3">
              {[
                {
                  name: "Essential Cookies",
                  desc: "Required for the platform to function — managing your session, authentication state, and security tokens.",
                },
                {
                  name: "Analytical Cookies",
                  desc: "Anonymized data (e.g., Google Analytics) that helps us understand traffic patterns and feature usage.",
                },
              ].map(({ name, desc }) => (
                <li key={name} className="flex gap-3 text-sm text-muted-foreground">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  <span>
                    <strong className="text-foreground">{name}: </strong>
                    {desc}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              By continuing to use TixNaija, you consent to our use of these cookies. You may disable non-essential
              cookies through your browser settings at any time.
            </p>
          </section>

          {/* Section 6 — Sharing */}
          <section id="sharing" className="scroll-mt-8 py-10 border-b border-border/40">
            <SectionHeading number="06" title="Data Sharing" />
            <p className="text-muted-foreground leading-relaxed mt-4">
              TixNaija shares your personal data only in the following limited circumstances:
            </p>
            <ul className="mt-4 space-y-3">
              {[
                "With the Event Organizer — your name and contact details are shared so the organizer can manage check-in, notify you of updates, and resolve disputes.",
                "With Paystack — your transaction details are processed under Paystack's data governance framework.",
                "With Supabase — our backend infrastructure provider, which stores your data securely under their data processing terms.",
                "With law enforcement or regulatory authorities — only when required by a valid court order or Nigerian regulatory directive.",
              ].map((item, i) => (
                <li key={i} className="flex gap-3 text-sm text-muted-foreground">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* Section 7 — Retention */}
          <section id="retention" className="scroll-mt-8 py-10 border-b border-border/40">
            <SectionHeading number="07" title="Data Retention" />
            <p className="text-muted-foreground leading-relaxed mt-4">
              We retain your personal data only for as long as necessary to fulfill the purposes outlined in this
              policy, to maintain your account, or to comply with applicable legal obligations.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-3">
              If you delete your TixNaija account, your personal data will be removed from our active systems
              within <strong className="text-foreground">30 days</strong>, except where retention is required by law
              (e.g., transaction records for tax or regulatory purposes, which may be retained for up to 7 years).
            </p>
          </section>

          {/* Section 8 — Rights */}
          <section id="rights" className="scroll-mt-8 py-10 border-b border-border/40">
            <SectionHeading number="08" title="Your NDPR Rights" />
            <p className="text-muted-foreground leading-relaxed mt-4">
              Under the Nigeria Data Protection Regulation (NDPR), you have the following rights regarding your
              personal data held by TixNaija:
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                { right: "Right of Access", desc: "Request a copy of all personal data we hold about you." },
                { right: "Right to Rectification", desc: "Request correction of inaccurate or incomplete data." },
                { right: "Right to Erasure", desc: "Request deletion of your personal data (subject to legal retention obligations)." },
                { right: "Right to Withdraw Consent", desc: "Withdraw consent for any processing based on consent at any time." },
                { right: "Right to Object", desc: "Object to processing of your data for certain purposes, including direct marketing." },
                { right: "Right to Portability", desc: "Request your data in a structured, machine-readable format." },
              ].map(({ right, desc }) => (
                <div key={right} className="rounded-lg border border-border bg-card/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary mb-1">{right}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
            <p className="text-muted-foreground leading-relaxed mt-5">
              To exercise any of these rights, contact us at the details in Section 10 below. We will respond within
              a reasonable timeframe in accordance with the NDPR.
            </p>
          </section>

          {/* Section 9 — Security */}
          <section id="security" className="scroll-mt-8 py-10 border-b border-border/40">
            <SectionHeading number="09" title="Security" />
            <p className="text-muted-foreground leading-relaxed mt-4">
              We implement industry-standard security measures to protect your personal data:
            </p>
            <ul className="mt-4 space-y-3">
              {[
                "All data is encrypted in transit using TLS/HTTPS.",
                "Database access is restricted using row-level security (RLS) policies.",
                "Authentication is managed through Supabase Auth with secure session tokens.",
                "Payment credentials are never stored on TixNaija's servers.",
              ].map((item, i) => (
                <li key={i} className="flex gap-3 text-sm text-muted-foreground">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              While we take all reasonable precautions, no online system is 100% secure. We encourage you to use a
              strong, unique password for your TixNaija account and to report any suspicious activity immediately.
            </p>
          </section>

          {/* Section 10 — Contact */}
          <section id="contact" className="scroll-mt-8 py-10">
            <SectionHeading number="10" title="Contact Us" />
            <p className="text-muted-foreground leading-relaxed mt-4">
              If you have any questions, requests, or concerns about this Privacy Policy or how your data is
              handled, please contact the TixNaija team. We are committed to resolving any privacy concerns promptly
              and transparently.
            </p>

            {/* CTA footer block */}
            <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-lg border border-border bg-card/60 p-6">
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Want to understand your rights further?</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Read our Terms of Service or visit the Nigeria Data Protection Commission website.
                </p>
              </div>
              <div className="flex gap-4 shrink-0">
                <Link
                  to="/terms"
                  className="text-xs font-semibold uppercase tracking-[0.2em] text-primary hover:underline"
                >
                  Terms of Service →
                </Link>
              </div>
            </div>
          </section>
        </main>
      </div>
      <SiteFooter />
    </div>
  );
}

function SectionHeading({ number, title }: { number: string; title: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="font-display text-3xl leading-none text-gradient-sunset shrink-0">{number}</span>
      <div className="flex flex-1 items-baseline gap-3">
        <h2 className="font-display text-2xl md:text-3xl leading-tight">{title}</h2>
        <span className="h-px flex-1 bg-border hidden sm:block" />
      </div>
    </div>
  );
}
