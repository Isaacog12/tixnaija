import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-4xl mb-8">Terms of Service</h1>
      
      <div className="prose prose-sm md:prose-base dark:prose-invert">
        <p className="text-muted-foreground mb-8">Last updated: {new Date().toLocaleDateString()}</p>
        
        <div className="rounded-lg bg-yellow-500/10 p-4 border border-yellow-500/20 mb-8 text-yellow-600 dark:text-yellow-400 text-sm">
          <strong>Legal Disclaimer:</strong> These Terms of Service are a starting draft provided for informational purposes on this platform and must be reviewed by a qualified Nigerian lawyer before TixNaija handles real transactions at scale.
        </div>

        <h2>1. Overview</h2>
        <p>
          Welcome to TixNaija. TixNaija operates as a ticketing marketplace connecting event organizers with attendees. 
          Currently, TixNaija operates as a "Starter Business" (unregistered individual operator) facilitating transactions 
          using the Paystack payment gateway.
        </p>

        <h2>2. Role of TixNaija</h2>
        <p>
          TixNaija is solely a technology platform and marketplace. We provide the tools for organizers to sell tickets 
          and for attendees to purchase them. TixNaija is not the creator, organizer, or owner of the events listed 
          on the platform.
        </p>

        <h2>3. Organizer Responsibilities</h2>
        <p>
          If you create and list events on TixNaija, you are an Organizer. You agree to:
        </p>
        <ul>
          <li>Provide accurate, complete, and updated information about your event (date, time, venue, price, etc.).</li>
          <li>Honor all valid tickets purchased through TixNaija.</li>
          <li>Comply with all applicable local laws, regulations, and venue policies.</li>
          <li>Manage any disputes directly with attendees regarding the quality or execution of the event.</li>
        </ul>

        <h2>4. Buyer Responsibilities</h2>
        <p>
          If you purchase tickets on TixNaija, you are an Attendee/Buyer. You agree to:
        </p>
        <ul>
          <li>Provide accurate contact information so you can receive your tickets and event updates.</li>
          <li>Review the event details carefully before purchase.</li>
          <li>Bring a valid form of identification and your ticket QR code to the event for check-in.</li>
        </ul>

        <h2>5. Refunds, Cancellations, and Postponements</h2>
        <p>
          Because TixNaija only facilitates the transaction, all ticket sales are final unless otherwise stated by the Organizer. 
          If an Organizer cancels an event, TixNaija's platform provides tools to notify attendees and outline the refund process. 
          However, the responsibility for issuing refunds lies entirely with the Organizer. TixNaija does not hold ticket funds 
          in escrow indefinitely and cannot guarantee refunds if an Organizer fails to fulfill their obligations.
        </p>

        <h2>6. Limitation of Liability</h2>
        <p>
          TixNaija facilitates transactions but is strictly not responsible for:
        </p>
        <ul>
          <li>The execution, safety, quality, or existence of the event itself.</li>
          <li>The conduct or behavior of the Organizer, venue staff, or other attendees.</li>
          <li>Any personal injury, property damage, or loss that occurs at an event.</li>
          <li>Cancellations or postponements by the Organizer.</li>
        </ul>
        <p>
          You agree to release TixNaija from any damages, losses, or claims arising out of your attendance at any event 
          ticketed through our platform.
        </p>

        <h2>7. Account Termination</h2>
        <p>
          TixNaija reserves the right to suspend or terminate accounts (both Organizers and Buyers) that violate these terms, 
          engage in fraudulent activity, or misuse the platform, without prior notice.
        </p>
      </div>
    </div>
  );
}
