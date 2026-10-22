import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { BackButton } from "@/components/back-button";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Terms of Service — TixNaija" },
      {
        name: "description",
        content:
          "Read TixNaija's Terms of Service. Understand your rights and responsibilities as a buyer or event organizer on Nigeria's ticketing marketplace.",
      },
    ],
  }),
});

const SECTIONS = [
  { id: "overview", label: "Overview & Capacity" },
  { id: "age", label: "Age & Legal Capacity" },
  { id: "role", label: "Role of TixNaija" },
  { id: "organizers", label: "Organizer Obligations" },
  { id: "buyers", label: "Buyer Obligations" },
  { id: "refunds", label: "Refunds & Cancellations" },
  { id: "fees", label: "Platform Fees & Settlement" },
  { id: "prohibited", label: "Prohibited Activities" },
  { id: "liability", label: "Limitation of Liability" },
  { id: "complaints", label: "Disputes & Complaints" },
  { id: "termination", label: "Account Termination" },
  { id: "governing", label: "Governing Law" },
  { id: "contact", label: "Business Details" },
];

const LAST_UPDATED = "October 22, 2026";

function TermsPage() {
  return (
    <div className="min-h-dvh flex flex-col bg-background text-foreground">
      <SiteNav />

      {/* Header */}
      <div className="border-b border-border/60 pb-10 pt-6">
        <div className="mx-auto max-w-6xl px-4 w-full mb-6">
          <BackButton />
        </div>
        <div className="mx-auto max-w-6xl px-4">
          <h1 className="font-display text-4xl md:text-6xl font-bold tracking-tight">
            Terms of Service
          </h1>
          <p className="text-muted-foreground text-sm mt-3">
            Last updated: <span className="text-foreground font-medium">{LAST_UPDATED}</span>
          </p>
        </div>
      </div>

      {/* Body: sidebar + content */}
      <div className="mx-auto max-w-6xl px-4 py-12 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-12 flex-1 w-full">
        {/* Sticky sidebar TOC */}
        <aside className="hidden md:block">
          <div className="sticky top-8">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4 font-semibold">
              Contents
            </p>
            <nav className="flex flex-col gap-1">
              {SECTIONS.map((s, i) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition"
                >
                  <span className="font-mono text-[10px] text-muted-foreground/60 w-4 shrink-0">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {s.label}
                </a>
              ))}
            </nav>

            <div className="mt-8 pt-6 border-t border-border/50 flex flex-col gap-2">
              <Link to="/privacy" className="text-xs text-muted-foreground hover:text-foreground transition">
                Privacy Policy →
              </Link>
              <Link to="/refunds" className="text-xs text-muted-foreground hover:text-foreground transition">
                Refund Policy →
              </Link>
              <Link to="/cookies" className="text-xs text-muted-foreground hover:text-foreground transition">
                Cookie Policy →
              </Link>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0 space-y-12">
          {/* Section 1 — Overview */}
          <section id="overview" className="scroll-mt-8 space-y-3">
            <SectionHeading number="01" title="Overview" />
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              These Terms of Service ("Terms") constitute a legally binding agreement between you and <strong className="text-foreground">{"{{BUSINESS_LEGAL_NAME}}"}</strong> (RC/CAC: {"{{RC_NUMBER}}"}), trading as <strong className="text-foreground">TixNaija</strong>.
            </p>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              By accessing, browsing, creating an account, publishing an event, or purchasing tickets on TixNaija, you acknowledge that you have read, understood, and agree to be bound by these Terms and our{" "}
              <Link to="/privacy" className="text-foreground underline hover:text-primary">
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          {/* Section 2 — Age & Legal Capacity */}
          <section id="age" className="scroll-mt-8 space-y-3">
            <SectionHeading number="02" title="Age & Legal Capacity" />
            <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground space-y-2 leading-relaxed">
              <p>
                To use TixNaija, register an account, list an event, or purchase tickets, you must be at least <strong className="text-foreground">eighteen (18) years of age</strong> and have the legal capacity to enter into binding commercial contracts under Nigerian law.
              </p>
              <p>
                Individuals under 18 may only attend events and access our platform under the direct supervision, consent, and authorization of a parent or legal guardian who agrees to be bound by these Terms.
              </p>
            </div>
          </section>

          {/* Section 3 — Role of TixNaija */}
          <section id="role" className="scroll-mt-8 space-y-3">
            <SectionHeading number="03" title="Role of TixNaija" />
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              TixNaija operates strictly as an independent software intermediary and ticketing marketplace. We are not an event promoter, producer, organizer, or venue operator. We do not set ticket prices, establish event door rules, or manage event logistics.
            </p>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              When a buyer purchases a ticket, the contract for event admission is entered into directly between the buyer and the organizer. TixNaija facilitates ticket issuance, check-in validation tools, and payment settlement.
            </p>
          </section>

          {/* Section 4 — Organizer Obligations */}
          <section id="organizers" className="scroll-mt-8 space-y-3">
            <SectionHeading number="04" title="Organizer Obligations" />
            <ul className="list-disc pl-5 text-sm md:text-base text-muted-foreground space-y-1.5 leading-relaxed">
              <li>Organizers must provide accurate, non-misleading event details, venues, start times, and ticket tier rules.</li>
              <li>Organizers must complete identity verification and connect a legitimate Nigerian bank account via Paystack before receiving payouts.</li>
              <li>Organizers agree to honor all legitimate tickets issued through TixNaija and scan QR codes using our check-in software.</li>
              <li>Organizers bear sole legal and financial responsibility for event delivery, attendee safety, and issuing refunds for cancelled or postponed events.</li>
            </ul>
          </section>

          {/* Section 5 — Buyer Obligations */}
          <section id="buyers" className="scroll-mt-8 space-y-3">
            <SectionHeading number="05" title="Buyer Obligations" />
            <ul className="list-disc pl-5 text-sm md:text-base text-muted-foreground space-y-1.5 leading-relaxed">
              <li>Buyers must provide an accurate email address to ensure ticket delivery.</li>
              <li>Each QR ticket is valid for one (1) admission. Counterfeiting, unauthorized duplication, or reselling above face value is strictly prohibited.</li>
              <li>Buyers are responsible for presenting their ticket code at entry and complying with the organizer's venue rules.</li>
            </ul>
          </section>

          {/* Section 6 — Refunds */}
          <section id="refunds" className="scroll-mt-8 space-y-3">
            <SectionHeading number="06" title="Refunds, Cancellations & Postponements" />
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              Our refund rules are set in accordance with Nigerian consumer protection standards and the Federal Competition and Consumer Protection Act (FCCPA).
            </p>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              Please review our full, dedicated{" "}
              <Link to="/refunds" className="text-foreground font-semibold underline hover:text-primary">
                Refund & Cancellation Policy
              </Link>
              , which governs cancelled events, postponements, change-of-mind requests, and escalation timelines.
            </p>
          </section>

          {/* Section 7 — Fees */}
          <section id="fees" className="scroll-mt-8 space-y-3">
            <SectionHeading number="07" title="Platform Fees & Settlement" />
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Transparent Checkout:</strong> The ticket price displayed to buyers at checkout is the full price paid. There are no hidden fees or unexpected checkout surcharges added to ticket buyers.
            </p>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              For paid events, TixNaija retains a 10% platform fee from gross ticket sales. Payment processing charges levied by Paystack (typically 1.5% + ₦100, capped at ₦2,000) are deducted upon settlement to the organizer's connected bank account.
            </p>
          </section>

          {/* Section 8 — Prohibited Conduct */}
          <section id="prohibited" className="scroll-mt-8 space-y-3">
            <SectionHeading number="08" title="Prohibited Activities" />
            <ul className="list-disc pl-5 text-sm md:text-base text-muted-foreground space-y-1.5 leading-relaxed">
              <li>Listing fraudulent, non-existent, or unlawfully duplicated events.</li>
              <li>Using stolen, compromised, or unauthorized credit cards, bank accounts, or USSD credentials.</li>
              <li>Deploying automated bots, web scrapers, or excessive requests to game ticket availability.</li>
              <li>Uploading defamatory, abusive, infringing, or illegal promotional materials.</li>
            </ul>
          </section>

          {/* Section 9 — Limitation of Liability */}
          <section id="liability" className="scroll-mt-8 space-y-3">
            <SectionHeading number="09" title="Limitation of Liability" />
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              To the maximum extent permitted under Nigerian law, TixNaija shall not be liable for any indirect, incidental, or consequential damages resulting from event cancellations, organizer insolvency, technical downtime of third-party networks (Paystack, telecommunications providers), or personal injury occurring at an event venue.
            </p>
          </section>

          {/* Section 10 — Complaints & Consumer Rights */}
          <section id="complaints" className="scroll-mt-8 space-y-3">
            <SectionHeading number="10" title="Consumer Protection & Complaint Escalation" />
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              In accordance with FCCPC directives, consumers with grievances regarding unfulfilled services or dispute resolutions should follow our escalation procedure:
            </p>
            <ol className="list-decimal pl-5 text-sm text-muted-foreground space-y-1.5 leading-relaxed">
              <li>Directly contact the organizer using the messaging tools or email provided on the event page.</li>
              <li>If unresolved within 48 hours, contact TixNaija support at <strong className="text-foreground">tixnaijaapp@gmail.com</strong>. Our team mediates disputes and may withhold unremitted payouts pending inquiry.</li>
              <li>Unresolved consumer rights claims may be submitted to the <strong className="text-foreground">Federal Competition and Consumer Protection Commission (FCCPC)</strong> at <a href="https://fccpc.gov.ng" target="_blank" rel="noopener noreferrer" className="text-foreground underline hover:text-primary">fccpc.gov.ng</a>.</li>
            </ol>
          </section>

          {/* Section 11 — Account Termination */}
          <section id="termination" className="scroll-mt-8 space-y-3">
            <SectionHeading number="11" title="Account Termination" />
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              Users may terminate their account at any time using the self-serve "Delete Account" option in Account Settings. We reserve the right to suspend or terminate accounts that breach these Terms, commit ticketing fraud, or abuse other users.
            </p>
          </section>

          {/* Section 12 — Governing Law */}
          <section id="governing" className="scroll-mt-8 space-y-3">
            <SectionHeading number="12" title="Governing Law & Jurisdiction" />
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              These Terms are governed by and construed in accordance with the laws of the <strong className="text-foreground">Federal Republic of Nigeria</strong>. Any disputes arising out of these Terms shall be submitted to the exclusive jurisdiction of the competent courts of Nigeria.
            </p>
          </section>

          {/* Section 13 — Contact Details */}
          <section id="contact" className="scroll-mt-8 space-y-3 border-t border-border/40 pt-8">
            <SectionHeading number="13" title="Corporate & Contact Information" />
            <div className="rounded-xl border border-border bg-card p-4 text-xs md:text-sm space-y-1 text-muted-foreground">
              <p><strong className="text-foreground">Entity:</strong> {"{{BUSINESS_LEGAL_NAME}}"}</p>
              <p><strong className="text-foreground">Registration:</strong> RC/CAC Number: {"{{RC_NUMBER}}"}</p>
              <p><strong className="text-foreground">Registered Office:</strong> {"{{REGISTERED_ADDRESS}}"}</p>
              <p><strong className="text-foreground">Email:</strong> tixnaijaapp@gmail.com</p>
              <p><strong className="text-foreground">Phone:</strong> +234 901 127 5275</p>
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
      <span className="font-mono text-xs font-bold text-primary shrink-0">{number}</span>
      <div className="flex flex-1 items-baseline gap-3">
        <h2 className="text-xl md:text-2xl font-bold tracking-tight">{title}</h2>
        <span className="h-px flex-1 bg-border/60 hidden sm:block" />
      </div>
    </div>
  );
}
