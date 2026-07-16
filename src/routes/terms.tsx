import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Terms of Service â€” TixNaija" },
      {
        name: "description",
        content:
          "Read TixNaija's Terms of Service. Understand your rights and responsibilities as a buyer or event organizer on Nigeria's ticket marketplace.",
      },
    ],
  }),
});

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "role", label: "Role of TixNaija" },
  { id: "organizers", label: "Organizer Responsibilities" },
  { id: "buyers", label: "Buyer Responsibilities" },
  { id: "refunds", label: "Refunds & Cancellations" },
  { id: "prohibited", label: "Prohibited Conduct" },
  { id: "liability", label: "Limitation of Liability" },
  { id: "termination", label: "Account Termination" },
  { id: "governing", label: "Governing Law" },
  { id: "changes", label: "Changes to Terms" },
];

const LAST_UPDATED = "July 14, 2025";

function TermsPage() {
  return (
    <div className="min-h-screen">
      <SiteNav />
      {/* â”€â”€ Hero header â”€â”€ */}
      <div className="relative overflow-hidden border-b border-border/60">
        <div className="absolute inset-0 gradient-sunset opacity-10 pointer-events-none" />
        <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
          <h1 className="font-display text-5xl md:text-7xl leading-[0.95] mb-4">
            Terms of Service
          </h1>
          <p className="text-muted-foreground text-sm mt-3">
            Last updated: <span className="text-foreground font-medium">{LAST_UPDATED}</span>
          </p>
        </div>
      </div>

      {/* â”€â”€ Body: sidebar + content â”€â”€ */}
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
                to="/privacy"
                className="text-xs text-muted-foreground hover:text-primary transition"
              >
                Privacy Policy â†’
              </Link>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0 space-y-1">

          {/* Section 1 â€” Overview */}
          <section id="overview" className="scroll-mt-8 pb-10 border-b border-border/40">
            <SectionHeading number="01" title="Overview" />
            <p className="text-muted-foreground leading-relaxed mt-4">
              Welcome to <strong className="text-foreground">TixNaija</strong>. By accessing or using our platform â€”
              whether as a ticket buyer, event organizer, or general visitor â€” you agree to be bound by these
              Terms of Service ("Terms"). If you do not agree, please do not use TixNaija.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-3">
              TixNaija operates as a ticketing marketplace that connects event organizers with attendees across Nigeria.
              We currently operate as an independent platform facilitating transactions through the{" "}
              <strong className="text-foreground">Paystack</strong> payment gateway.
            </p>
          </section>

          {/* Section 2 â€” Role */}
          <section id="role" className="scroll-mt-8 py-10 border-b border-border/40">
            <SectionHeading number="02" title="Role of TixNaija" />
            <p className="text-muted-foreground leading-relaxed mt-4">
              TixNaija is solely a <strong className="text-foreground">technology platform and marketplace</strong>.
              We provide the infrastructure for organizers to list and sell tickets, and for buyers to discover and
              purchase them. TixNaija is not the creator, owner, organizer, or promoter of any event listed on the platform.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-3">
              All agreements and responsibilities for event delivery lie strictly between the Organizer and the Attendee.
              TixNaija acts as a neutral facilitator and bears no liability for the execution of any event.
            </p>
          </section>

          {/* Section 3 â€” Organizers */}
          <section id="organizers" className="scroll-mt-8 py-10 border-b border-border/40">
            <SectionHeading number="03" title="Organizer Responsibilities" />
            <p className="text-muted-foreground leading-relaxed mt-4">
              By creating and listing events on TixNaija, you ("Organizer") agree to the following:
            </p>
            <ul className="mt-4 space-y-3">
              {[
                "Provide accurate, complete, and current event information â€” including date, time, venue, ticket types, and pricing.",
                "Honor all valid tickets purchased through TixNaija at the door without dispute.",
                "Comply with all applicable Nigerian laws, venue regulations, and public safety guidelines.",
                "Communicate all event changes (postponements, cancellations, venue changes) to TixNaija and your attendees promptly.",
                "Manage refunds and disputes with attendees directly. TixNaija provides the tooling but does not adjudicate disputes.",
                "Not misrepresent the nature, scale, or content of your event in listings.",
              ].map((item, i) => (
                <li key={i} className="flex gap-3 text-sm text-muted-foreground">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* Section 4 â€” Buyers */}
          <section id="buyers" className="scroll-mt-8 py-10 border-b border-border/40">
            <SectionHeading number="04" title="Buyer Responsibilities" />
            <p className="text-muted-foreground leading-relaxed mt-4">
              By purchasing tickets on TixNaija, you ("Attendee" or "Buyer") agree to:
            </p>
            <ul className="mt-4 space-y-3">
              {[
                "Provide accurate contact information (name, email, phone) so your tickets and event updates can reach you.",
                "Review all event details carefully before completing your purchase â€” all sales are final unless the Organizer states otherwise.",
                "Present your QR ticket code and a valid form of identification at the event entrance for check-in.",
                "Not resell or transfer tickets in ways that violate the Organizer's stated policy.",
                "Conduct yourself lawfully and respectfully at all events.",
              ].map((item, i) => (
                <li key={i} className="flex gap-3 text-sm text-muted-foreground">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* Section 5 â€” Refunds */}
          <section id="refunds" className="scroll-mt-8 py-10 border-b border-border/40">
            <SectionHeading number="05" title="Refunds, Cancellations & Postponements" />
            <p className="text-muted-foreground leading-relaxed mt-4">
              <strong className="text-foreground">All ticket sales are final</strong> unless the Organizer explicitly
              offers refunds in their event listing.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-3">
              If an Organizer cancels or postpones an event, TixNaija's platform provides tools for the Organizer to
              notify attendees. However, <strong className="text-foreground">the responsibility for issuing refunds
              lies entirely with the Organizer</strong>. TixNaija does not hold ticket funds in escrow and cannot
              guarantee refunds if an Organizer fails to fulfill their obligations.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-3">
              In the event of a cancellation, TixNaija will make reasonable efforts to contact affected buyers and
              provide available information, but accepts no financial liability for the Organizer's failure to perform.
            </p>
          </section>

          {/* Section 6 â€” Prohibited */}
          <section id="prohibited" className="scroll-mt-8 py-10 border-b border-border/40">
            <SectionHeading number="06" title="Prohibited Conduct" />
            <p className="text-muted-foreground leading-relaxed mt-4">
              The following activities are strictly prohibited on TixNaija:
            </p>
            <ul className="mt-4 space-y-3">
              {[
                "Creating fraudulent or fictitious events to collect payment from buyers.",
                "Purchasing tickets using stolen, cloned, or unauthorized payment credentials.",
                "Attempting to duplicate, counterfeit, or redistribute QR tickets.",
                "Using automated bots, scrapers, or scripts to bulk-purchase or access the platform.",
                "Uploading content that is unlawful, defamatory, discriminatory, or sexually explicit.",
                "Impersonating another person, organizer, or TixNaija staff in any capacity.",
              ].map((item, i) => (
                <li key={i} className="flex gap-3 text-sm text-muted-foreground">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              Violations may result in immediate account suspension and referral to the appropriate Nigerian authorities.
            </p>
          </section>

          {/* Section 7 â€” Liability */}
          <section id="liability" className="scroll-mt-8 py-10 border-b border-border/40">
            <SectionHeading number="07" title="Limitation of Liability" />
            <p className="text-muted-foreground leading-relaxed mt-4">
              To the maximum extent permitted by Nigerian law, TixNaija, its officers, employees, and affiliates
              shall not be held liable for:
            </p>
            <ul className="mt-4 space-y-3">
              {[
                "The quality, safety, existence, or execution of any event listed on the platform.",
                "The conduct, negligence, or actions of any Organizer, venue operator, or attendee.",
                "Any personal injury, property damage, financial loss, or other harm arising from attending an event.",
                "Event cancellations, postponements, or changes made by the Organizer.",
                "Technical outages, payment failures, or data loss caused by third-party services (e.g., Paystack, Supabase).",
              ].map((item, i) => (
                <li key={i} className="flex gap-3 text-sm text-muted-foreground">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              By using TixNaija, you agree to release and hold harmless TixNaija from any claims, damages, or
              losses arising from your use of the platform or attendance at any event facilitated through it.
            </p>
          </section>

          {/* Section 8 â€” Termination */}
          <section id="termination" className="scroll-mt-8 py-10 border-b border-border/40">
            <SectionHeading number="08" title="Account Termination" />
            <p className="text-muted-foreground leading-relaxed mt-4">
              TixNaija reserves the right to suspend, restrict, or permanently terminate any account â€”
              whether Organizer or Buyer â€” that:
            </p>
            <ul className="mt-4 space-y-3">
              {[
                "Violates any provision of these Terms of Service.",
                "Engages in fraudulent, deceptive, or criminal activity on or off the platform.",
                "Repeatedly receives verified complaints from other users.",
                "Poses a risk to the integrity, security, or reputation of TixNaija.",
              ].map((item, i) => (
                <li key={i} className="flex gap-3 text-sm text-muted-foreground">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              Terminations may be enacted without prior notice. Any outstanding payouts owed to an Organizer
              at the time of termination for cause may be withheld pending investigation.
            </p>
          </section>

          {/* Section 9 â€” Governing Law */}
          <section id="governing" className="scroll-mt-8 py-10 border-b border-border/40">
            <SectionHeading number="09" title="Governing Law" />
            <p className="text-muted-foreground leading-relaxed mt-4">
              These Terms are governed by and construed in accordance with the laws of the{" "}
              <strong className="text-foreground">Federal Republic of Nigeria</strong>, including but not limited to
              the Nigerian Data Protection Regulation (NDPR), the Consumer Protection Council Act, and any
              applicable CBN guidelines on electronic payments.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-3">
              Any disputes arising from these Terms shall first be attempted to be resolved amicably. Failing that,
              disputes shall be subject to the jurisdiction of the competent courts in Lagos State, Nigeria.
            </p>
          </section>

          {/* Section 10 â€” Changes */}
          <section id="changes" className="scroll-mt-8 py-10">
            <SectionHeading number="10" title="Changes to These Terms" />
            <p className="text-muted-foreground leading-relaxed mt-4">
              TixNaija reserves the right to update these Terms at any time. When we make material changes, we will
              update the "Last updated" date at the top of this page and, where appropriate, notify registered users
              via email.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-3">
              Your continued use of TixNaija after any changes constitutes your acceptance of the updated Terms.
              We encourage you to review this page periodically.
            </p>

            {/* CTA footer block */}
            <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-lg border border-border bg-card/60 p-6">
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Questions about these terms?</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Reach out to the TixNaija team and we'll be happy to clarify.
                </p>
              </div>
              <Link
                to="/privacy"
                className="shrink-0 text-xs font-semibold uppercase tracking-[0.2em] text-primary hover:underline"
              >
                View Privacy Policy â†’
              </Link>
            </div>
          </section>
        </main>
      </div>
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
