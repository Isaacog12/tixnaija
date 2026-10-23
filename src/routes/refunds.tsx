import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { BackButton } from "@/components/back-button";
import { BUSINESS_DETAILS } from "@/lib/business";

export const Route = createFileRoute("/refunds")({
  component: RefundsPage,
  head: () => ({
    meta: [
      { title: "Refund & Cancellation Policy — TixNaija" },
      {
        name: "description",
        content:
          "TixNaija's official Refund, Cancellation, and Postponement Policy. Understand your rights and organizer obligations under Nigerian consumer protection standards.",
      },
    ],
  }),
});

const LAST_UPDATED = "October 22, 2026";

function RefundsPage() {
  return (
    <div className="min-h-dvh flex flex-col bg-background text-foreground">
      <SiteNav />

      {/* Header */}
      <div className="border-b border-border/60 pb-8 pt-6">
        <div className="mx-auto max-w-5xl px-4 w-full">
          <BackButton />
          <h1 className="mt-4 font-display text-3xl md:text-5xl font-bold tracking-tight">
            Refund & Cancellation Policy
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Effective Date: <span className="text-foreground font-medium">{LAST_UPDATED}</span>
          </p>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-5xl px-4 py-10 flex-1 w-full space-y-10">
        {/* Section 1 */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">1. Platform Role & Foundation</h2>
          <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
            <strong className="text-foreground">TixNaija</strong> provides ticketing software and booking infrastructure connecting event organizers with ticket buyers across Nigeria. TixNaija is not the producer, venue owner, or promoter of events listed on the marketplace.
          </p>
          <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
            This Policy outlines the rules governing refunds, ticket cancellations, and postponements in accordance with the Federal Competition and Consumer Protection Act (FCCPA) 2018 and the consumer protection guidelines of the Federal Competition and Consumer Protection Commission (FCCPC).
          </p>
        </section>

        {/* Section 2 */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">2. Event Cancellations</h2>
          <div className="rounded-xl border border-border bg-card p-5 space-y-3 text-sm md:text-base text-muted-foreground leading-relaxed">
            <p>
              If an event is cancelled by the organizer prior to its commencement:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-foreground">Automatic Notification:</strong> All registered buyers and attendees will receive an email notice specifying the cancellation.
              </li>
              <li>
                <strong className="text-foreground">Full Ticket Refund:</strong> Ticket purchasers are entitled to a refund of the full ticket face value.
              </li>
              <li>
                <strong className="text-foreground">Organizer Responsibility:</strong> Because event ticket proceeds are settled to the event organizer via Paystack, the financial responsibility for authorizing and funding attendee refunds rests with the event organizer. TixNaija assists buyers by coordinating communication and enforcing organizer merchant agreements.
              </li>
            </ul>
          </div>
        </section>

        {/* Section 3 */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">3. Event Postponements & Venue Relocations</h2>
          <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
            If an organizer reschedules an event date or significantly alters the venue location:
          </p>
          <ul className="list-disc pl-5 text-sm md:text-base text-muted-foreground space-y-2 leading-relaxed">
            <li>
              <strong className="text-foreground">Ticket Rollover:</strong> Your original ticket and scannable QR code automatically remain valid for the new date and location.
            </li>
            <li>
              <strong className="text-foreground">Refund Window:</strong> If you cannot attend the rescheduled date, you may request a refund within fourteen (14) calendar days of the postponement notice being issued.
            </li>
          </ul>
        </section>

        {/* Section 4 */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">4. Change of Mind & Non-Attendance</h2>
          <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
            Except where an event is cancelled, postponed, or materially misrepresented:
          </p>
          <div className="rounded-xl border border-border bg-card p-5 text-sm md:text-base text-muted-foreground space-y-2">
            <p>
              <strong className="text-foreground">All ticket sales are final.</strong> Refunds are not guaranteed for personal scheduling conflicts, failure to attend, or simple change of mind unless the individual organizer explicitly specifies a flexible return policy in their event description.
            </p>
            <p>
              If you cannot attend, you may reassign your ticket to a friend or colleague free of charge through your TixNaija account or by contacting support before the event door opening.
            </p>
          </div>
        </section>

        {/* Section 5 */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">5. How to Request a Refund</h2>
          <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
            To submit a refund request for an eligible event, follow these steps:
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4 space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">Step 1</span>
              <p className="font-semibold text-foreground text-sm">Gather Details</p>
              <p className="text-xs text-muted-foreground">Locate your Order Reference (e.g. ORD-1234) and the email address used during purchase.</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">Step 2</span>
              <p className="font-semibold text-foreground text-sm">Send Email</p>
              <p className="text-xs text-muted-foreground">Email support at <a href={`mailto:${BUSINESS_DETAILS.supportEmail}`} className="text-foreground font-medium underline">{BUSINESS_DETAILS.supportEmail}</a> with subject: "Refund Request - [Order Reference]".</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">Step 3</span>
              <p className="font-semibold text-foreground text-sm">Settlement</p>
              <p className="text-xs text-muted-foreground">Requests are reviewed within 3 business days. Approved refunds credit your bank card/account in 3–7 business days via Paystack.</p>
            </div>
          </div>
        </section>

        {/* Section 6 */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">6. Consumer Protection & Escalation</h2>
          <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
            We are dedicated to fair trading and transparent resolution of disputes. If you believe an organizer has acted fraudulently or failed to honor a mandated cancellation refund:
          </p>
          <ol className="list-decimal pl-5 text-sm md:text-base text-muted-foreground space-y-2 leading-relaxed">
            <li>
              Submit a formal grievance to <a href={`mailto:${BUSINESS_DETAILS.supportEmail}`} className="text-foreground font-semibold underline">{BUSINESS_DETAILS.supportEmail}</a>. We will freeze pending organizer payouts and initiate an internal compliance inquiry.
            </li>
            <li>
              In accordance with Nigerian consumer protection standards, consumers retain the right to escalate unresolved grievances to the <strong className="text-foreground">Federal Competition and Consumer Protection Commission (FCCPC)</strong> via their online portal at <a href="https://fccpc.gov.ng" target="_blank" rel="noopener noreferrer" className="text-foreground underline hover:text-primary">fccpc.gov.ng</a>.
            </li>
          </ol>
        </section>

        {/* Contact details */}
        <section className="space-y-4 border-t border-border/40 pt-8">
          <h2 className="text-xl font-semibold tracking-tight">7. Contact Information</h2>
          <div className="rounded-xl border border-border bg-card p-4 text-xs md:text-sm space-y-1 text-muted-foreground">
            <p><strong className="text-foreground">Platform:</strong> {BUSINESS_DETAILS.platformName}</p>
            <p><strong className="text-foreground">Email:</strong> <a href={`mailto:${BUSINESS_DETAILS.supportEmail}`} className="text-foreground underline">{BUSINESS_DETAILS.supportEmail}</a></p>
            <p><strong className="text-foreground">Phone:</strong> {BUSINESS_DETAILS.supportPhone}</p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
