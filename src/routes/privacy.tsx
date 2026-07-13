import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-4xl mb-8">Privacy Policy</h1>
      
      <div className="prose prose-sm md:prose-base dark:prose-invert">
        <p className="text-muted-foreground mb-8">Last updated: {new Date().toLocaleDateString()}</p>

        <div className="rounded-lg bg-yellow-500/10 p-4 border border-yellow-500/20 mb-8 text-yellow-600 dark:text-yellow-400 text-sm">
          <strong>Legal Disclaimer:</strong> This Privacy Policy is a starting draft intended to comply with the Nigeria Data Protection Regulation (NDPR) for informational purposes. It must be reviewed by a qualified Nigerian lawyer before handling real data at scale.
        </div>

        <h2>1. Introduction</h2>
        <p>
          TixNaija respects your privacy and is committed to protecting your personal data in accordance with the 
          Nigeria Data Protection Regulation (NDPR) and other applicable laws. This policy explains how we collect, 
          use, and safeguard your information.
        </p>

        <h2>2. What Personal Data We Collect</h2>
        <p>We only collect the data necessary to provide our ticketing services:</p>
        <ul>
          <li><strong>Buyers/Attendees:</strong> Name, email address, and phone number (to deliver tickets and important updates).</li>
          <li><strong>Organizers:</strong> Name, email, phone number, and bank account details (to process payouts).</li>
          <li><strong>Usage Data:</strong> We collect basic, anonymized analytics (such as IP addresses and browser types) to improve platform performance.</li>
        </ul>

        <h2>3. Payment Processing</h2>
        <p>
          <strong>TixNaija does not store or process your credit/debit card information.</strong> All payments are handled 
          securely by our third-party payment gateway, <strong>Paystack</strong>. When you make a purchase, you are subject 
          to Paystack's privacy policy and security measures.
        </p>

        <h2>4. Why We Collect This Data</h2>
        <p>Your data is used strictly for the following purposes:</p>
        <ul>
          <li>To generate, deliver, and verify event tickets.</li>
          <li>To process organizer payouts.</li>
          <li>To send critical updates (e.g., event cancellations or postponements).</li>
          <li>To provide customer support and respond to inquiries.</li>
          <li>To comply with legal and regulatory obligations.</li>
        </ul>

        <h2>5. Cookies and Analytics Disclosure</h2>
        <p>
          TixNaija uses cookies and standard analytics tools (like Google Analytics) to collect anonymized usage data. 
          This helps us understand how users interact with our website, identify bugs, and improve the user experience. 
          By using our platform, you consent to the use of these essential and analytical cookies.
        </p>

        <h2>6. Data Retention</h2>
        <p>
          We retain your personal data only as long as necessary to fulfill the purposes outlined in this policy, 
          manage your account, or comply with legal obligations. If you delete your account, your data will be removed 
          from our active systems within a reasonable timeframe.
        </p>

        <h2>7. Your NDPR Rights</h2>
        <p>Under the NDPR, you have the right to:</p>
        <ul>
          <li>Request access to the personal data we hold about you.</li>
          <li>Request correction of inaccurate or incomplete data.</li>
          <li>Request the deletion or erasure of your personal data.</li>
          <li>Withdraw your consent at any time (where applicable).</li>
        </ul>

        <h2>8. Contact Us</h2>
        <p>
          If you have any questions, privacy requests, or concerns about how your data is handled, please contact 
          the TixNaija administration team.
        </p>
      </div>
    </div>
  );
}
