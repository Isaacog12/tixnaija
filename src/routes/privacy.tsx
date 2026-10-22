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
          "How TixNaija collects, uses, and protects your personal data in accordance with the Nigeria Data Protection Act 2023 (NDPA).",
      },
    ],
  }),
});

const SECTIONS = [
  { id: "intro", label: "Introduction" },
  { id: "legal-basis", label: "Lawful Basis & NDPA" },
  { id: "data-collected", label: "Data We Collect" },
  { id: "children", label: "Children's Privacy (Under 18)" },
  { id: "payments", label: "Payment Processing" },
  { id: "why", label: "Purpose of Processing" },
  { id: "cookies", label: "Cookies & Analytics" },
  { id: "sharing", label: "Third-Party Data Sharing" },
  { id: "retention", label: "Data Retention & Erasure" },
  { id: "rights", label: "Your NDPA Statutory Rights" },
  { id: "security", label: "Information Security" },
  { id: "complaints", label: "Regulatory Complaints" },
  { id: "contact", label: "Contact & DPO" },
];

const LAST_UPDATED = "October 22, 2026";

function PrivacyPage() {
  return (
    <div className="min-h-dvh flex flex-col bg-background text-foreground">
      <SiteNav />

      {/* Hero header */}
      <div className="border-b border-border/60 pb-10 pt-6">
        <div className="mx-auto max-w-6xl px-4 w-full mb-6">
          <BackButton />
        </div>
        <div className="mx-auto max-w-6xl px-4">
          <h1 className="font-display text-4xl md:text-6xl font-bold tracking-tight">
            Privacy Policy
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
              <Link to="/terms" className="text-xs text-muted-foreground hover:text-foreground transition">
                Terms of Service →
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
          {/* Section 1 — Introduction */}
          <section id="intro" className="scroll-mt-8 space-y-3">
            <SectionHeading number="01" title="Introduction" />
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              <strong className="text-foreground">TixNaija</strong> (referred to as "we", "us", or "our"), operated by <strong className="text-foreground">{"{{BUSINESS_LEGAL_NAME}}"}</strong> (RC/CAC: {"{{RC_NUMBER}}"}), is committed to safeguarding the personal data of our users. This Privacy Policy governs our data handling practices for ticket buyers, event attendees, event organizers, and platform visitors.
            </p>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              TixNaija is proudly independent and completely separate from Tix Africa. This platform operates under its own legal entity, data controllership, and technical architecture.
            </p>
          </section>

          {/* Section 2 — Lawful Basis & NDPA */}
          <section id="legal-basis" className="scroll-mt-8 space-y-3">
            <SectionHeading number="02" title="Lawful Basis & Governing Law" />
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              This policy is established in strict compliance with the <strong className="text-foreground">Nigeria Data Protection Act 2023 (NDPA)</strong> and general data protection standards. We process personal data solely on the following lawful bases under the NDPA:
            </p>
            <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1 leading-relaxed">
              <li><strong className="text-foreground">Contractual Necessity:</strong> To issue tickets, process registrations, confirm orders, and facilitate event entry.</li>
              <li><strong className="text-foreground">Consent:</strong> For voluntary opt-in marketing notifications, non-essential analytical cookies, and social proof attendee sharing.</li>
              <li><strong className="text-foreground">Legal & Regulatory Obligation:</strong> To maintain accounting and financial transaction records under Nigerian taxation statutes.</li>
              <li><strong className="text-foreground">Legitimate Interest:</strong> To secure the platform, prevent ticketing fraud, and defend against unauthorized automated scrapers.</li>
            </ul>
          </section>

          {/* Section 3 — Data Collected */}
          <section id="data-collected" className="scroll-mt-8 space-y-3">
            <SectionHeading number="03" title="Data We Collect" />
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              Under the principle of data minimisation, we collect only information that is adequate, relevant, and strictly necessary:
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-4 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">Ticket Buyers & Attendees</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Full name, email address, optional contact phone number, and optional recipient details for gift purchases. Used to deliver QR-coded tickets and issue event updates.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">Event Organizers</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Full name, email address, phone number, Nigerian settlement bank account details (for automated Paystack payouts), and an identity verification document/selfie stored in a private vault.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">Careers & Contact Inquiries</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Name, email address, optional phone number, resume/CV attachments, and message content submitted for customer support or job applications.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">System & Device Data</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  IP addresses (anonymized for analytics), device browser user-agents, and session authentication tokens required for cybersecurity and rate limiting.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4 — Children's Data */}
          <section id="children" className="scroll-mt-8 space-y-3">
            <SectionHeading number="04" title="Children's Data (Under 18 Years)" />
            <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground leading-relaxed space-y-2">
              <p>
                In compliance with <strong className="text-foreground">Section 31 of the Nigeria Data Protection Act 2023</strong>, TixNaija does not knowingly solicit or collect personal data directly from children under 18 years of age without prior parental or legal guardian consent.
              </p>
              <p>
                Users must be at least 18 years old to create an account or purchase tickets independently. If an event is designated for families or minors, tickets must be acquired by a parent or legal guardian on behalf of the minor attendee. If we become aware that a child under 18 has provided personal data without verified parental consent, we will promptly delete such records from our active systems.
              </p>
            </div>
          </section>

          {/* Section 5 — Payments */}
          <section id="payments" className="scroll-mt-8 space-y-3">
            <SectionHeading number="05" title="Payment Processing" />
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              <strong className="text-foreground">TixNaija never stores, processes, or handles your credit or debit card numbers, CVVs, or bank PINs.</strong> All payments are processed end-to-end by <strong className="text-foreground">Paystack</strong>, a PCI-DSS Level 1 certified payment infrastructure provider regulated by the Central Bank of Nigeria.
            </p>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              When you make a payment, your credentials go directly to Paystack's secure interface. TixNaija receives only a transaction token, payment reference, and settlement confirmation to issue your QR-coded ticket. Review{" "}
              <a href="https://paystack.com/privacy" target="_blank" rel="noopener noreferrer" className="text-foreground underline hover:text-primary">
                Paystack's Privacy Policy
              </a>
              .
            </p>
          </section>

          {/* Section 6 — Purpose of Processing */}
          <section id="why" className="scroll-mt-8 space-y-3">
            <SectionHeading number="06" title="Purpose of Processing" />
            <ul className="list-disc pl-5 text-sm md:text-base text-muted-foreground space-y-1.5 leading-relaxed">
              <li>To generate, deliver, and digitally validate your tickets at the venue entrance.</li>
              <li>To automatically notify you of event cancellations, emergency schedule revisions, or venue relocations.</li>
              <li>To remit ticket sale proceeds directly to verified organizers.</li>
              <li>To investigate fraud, counterfeit ticket duplication, and unauthorized chargebacks.</li>
              <li>To comply with regulatory audit requirements and lawful court directives under Nigerian law.</li>
            </ul>
          </section>

          {/* Section 7 — Cookies */}
          <section id="cookies" className="scroll-mt-8 space-y-3">
            <SectionHeading number="07" title="Cookies & Local Storage" />
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              We use strictly necessary cookies and local storage tokens to manage your sign-in sessions and preserve theme preferences. We do not use third-party advertising cookies. Optional performance analytics (Google Analytics) are strictly consent-gated.
            </p>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              For a full breakdown of specific identifiers, lifespans, and management controls, see our dedicated{" "}
              <Link to="/cookies" className="text-foreground underline font-medium hover:text-primary">
                Cookie Policy
              </Link>
              .
            </p>
          </section>

          {/* Section 8 — Third-Party Sharing */}
          <section id="sharing" className="scroll-mt-8 space-y-3">
            <SectionHeading number="08" title="Third-Party Data Sharing" />
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              We never sell or lease your personal information. Data is disclosed only to authorized third parties under strict processing safeguards:
            </p>
            <ul className="list-disc pl-5 text-sm md:text-base text-muted-foreground space-y-1.5 leading-relaxed">
              <li><strong className="text-foreground">Event Organizers:</strong> Attendee names and emails are shared with the specific organizer of an event you booked to enable entrance check-in and attendee management.</li>
              <li><strong className="text-foreground">Paystack Payments Limited:</strong> To initiate and reconcile ticket purchases and subaccount payouts.</li>
              <li><strong className="text-foreground">Supabase Inc.:</strong> Cloud infrastructure provider hosting our database, access-controlled storage vaults, and authentication services.</li>
              <li><strong className="text-foreground">ZeptoMail / Zoho Corporation:</strong> Transactional email infrastructure delivering QR tickets and critical event alerts.</li>
              <li><strong className="text-foreground">Law Enforcement:</strong> Only when compelled by a valid warrant, subpoena, or directive issued under Nigerian law.</li>
            </ul>
          </section>

          {/* Section 9 — Data Retention */}
          <section id="retention" className="scroll-mt-8 space-y-3">
            <SectionHeading number="09" title="Data Retention & Erasure" />
            <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground space-y-2 leading-relaxed">
              <p>
                We retain personal data only as long as necessary to provide ticketing services or satisfy statutory legal requirements:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong className="text-foreground">Active Account Data:</strong> Retained while your account remains active. Users may trigger self-serve account deletion in their Account settings at any time.</li>
                <li><strong className="text-foreground">Deleted Accounts:</strong> Upon an erasure request, personal profiles and marketing preferences are purged within thirty (30) days.</li>
                <li><strong className="text-foreground">Financial & Audit Records:</strong> Payment references, ticket sales, and settlement ledgers are retained in anonymized format for up to seven (7) years to comply with Nigerian corporate accounting and tax laws.</li>
                <li><strong className="text-foreground">Organizer Verification Media:</strong> Organizer identity photos are retained in a private vault during verification and permanently purged thirty (30) days after a review determination is reached.</li>
              </ul>
            </div>
          </section>

          {/* Section 10 — Rights */}
          <section id="rights" className="scroll-mt-8 space-y-3">
            <SectionHeading number="10" title="Your NDPA Statutory Rights" />
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              Under Sections 34–38 of the Nigeria Data Protection Act 2023, you have the following enforceable rights:
            </p>
            <div className="grid gap-3 sm:grid-cols-2 text-xs md:text-sm text-muted-foreground">
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="font-semibold text-foreground">Right of Access</p>
                <p className="mt-1">Request confirmation and a copy of personal data we hold about you.</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="font-semibold text-foreground">Right to Rectification</p>
                <p className="mt-1">Update or correct inaccurate or incomplete profile information.</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="font-semibold text-foreground">Right to Erasure ("Right to be Forgotten")</p>
                <p className="mt-1">Request complete deletion of your data when no longer needed.</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="font-semibold text-foreground">Right to Object & Restrict</p>
                <p className="mt-1">Object to processing for marketing or request restriction of data handling.</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="font-semibold text-foreground">Right to Data Portability</p>
                <p className="mt-1">Receive your personal data in a structured, machine-readable format.</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="font-semibold text-foreground">Right to Withdraw Consent</p>
                <p className="mt-1">Revoke any consent previously granted without affecting prior lawful processing.</p>
              </div>
            </div>
          </section>

          {/* Section 11 — Security */}
          <section id="security" className="scroll-mt-8 space-y-3">
            <SectionHeading number="11" title="Information Security" />
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              We implement rigorous technical and organizational measures to safeguard personal data, including TLS 1.3 encryption in transit, strict database Row Level Security (RLS) enforcement, short-lived signed URLs for verification media, and automated rate-limiting to defend against brute-force attacks.
            </p>
          </section>

          {/* Section 12 — Regulatory Complaints */}
          <section id="complaints" className="scroll-mt-8 space-y-3">
            <SectionHeading number="12" title="Right to Complain to the Regulator" />
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              If you have concerns about how your data has been handled and we have not resolved your concern satisfactorily, you have the statutory right under the NDPA to lodge a formal complaint with the:
            </p>
            <div className="rounded-xl border border-border bg-card p-4 text-xs md:text-sm text-muted-foreground space-y-1">
              <p><strong className="text-foreground">Regulatory Authority:</strong> Nigeria Data Protection Commission (NDPC)</p>
              <p><strong className="text-foreground">Official Website:</strong> <a href="https://ndpc.gov.ng" target="_blank" rel="noopener noreferrer" className="text-foreground underline hover:text-primary">ndpc.gov.ng</a></p>
              <p><strong className="text-foreground">Complaints Portal:</strong> info@ndpc.gov.ng</p>
            </div>
          </section>

          {/* Section 13 — Contact & DPO */}
          <section id="contact" className="scroll-mt-8 space-y-3 border-t border-border/40 pt-8">
            <SectionHeading number="13" title="Contact Us & Data Protection Officer" />
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              To exercise your statutory privacy rights, update your profile, or submit a data inquiry, contact our Data Protection Officer (DPO) and compliance team:
            </p>
            <div className="rounded-xl border border-border bg-card p-4 text-xs md:text-sm space-y-1 text-muted-foreground">
              <p><strong className="text-foreground">Data Controller:</strong> {"{{BUSINESS_LEGAL_NAME}}"}</p>
              <p><strong className="text-foreground">Corporate Registration:</strong> RC/CAC Number: {"{{RC_NUMBER}}"}</p>
              <p><strong className="text-foreground">Registered Office:</strong> {"{{REGISTERED_ADDRESS}}"}</p>
              <p><strong className="text-foreground">DPO Email:</strong> {"{{DPO_EMAIL}}"} / tixnaijaapp@gmail.com</p>
              <p><strong className="text-foreground">Contact Phone / WhatsApp:</strong> +234 901 127 5275</p>
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
