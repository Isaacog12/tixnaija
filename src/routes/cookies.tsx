import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { openCookieSettings } from "@/lib/cookie-consent";

export const Route = createFileRoute("/cookies")({
  component: CookiePolicyPage,
  head: () => ({
    meta: [
      { title: "Cookie Policy — TixNaija" },
      {
        name: "description",
        content:
          "Read TixNaija's Cookie Policy. Learn about the cookies and local storage tokens we use to keep your account secure and evaluate site performance.",
      },
    ],
  }),
});

const LAST_UPDATED = "October 22, 2026";

interface CookieItem {
  name: string;
  provider: string;
  purpose: string;
  storageType: "Cookie" | "Local Storage";
  category: "Strictly Essential" | "Analytics";
  lifespan: string;
}

const COOKIE_INVENTORY: CookieItem[] = [
  {
    name: "tixnaija_cookie_consent_v2",
    provider: "TixNaija",
    purpose: "Stores your cookie consent preferences and granular analytics permissions.",
    storageType: "Local Storage",
    category: "Strictly Essential",
    lifespan: "Persistent until manually cleared",
  },
  {
    name: "tixnaija-theme",
    provider: "TixNaija",
    purpose: "Preserves your chosen display mode (Dark or Light) to prevent interface flickering on page load.",
    storageType: "Local Storage",
    category: "Strictly Essential",
    lifespan: "Persistent until manually cleared",
  },
  {
    name: "sb-[project-id]-auth-token",
    provider: "TixNaija (via Supabase)",
    purpose: "Stores your encrypted authentication session token so you remain logged in across page reloads.",
    storageType: "Local Storage",
    category: "Strictly Essential",
    lifespan: "Session / until sign-out",
  },
  {
    name: "_ga",
    provider: "Google Analytics",
    purpose: "Distinguishes unique anonymous website visitors and calculates visits and session metrics. Blocked until explicit consent.",
    storageType: "Cookie",
    category: "Analytics",
    lifespan: "2 years",
  },
  {
    name: "_ga_[container-id]",
    provider: "Google Analytics",
    purpose: "Maintains session state across page views during an analytical session. Blocked until explicit consent.",
    storageType: "Cookie",
    category: "Analytics",
    lifespan: "2 years",
  },
];

function CookiePolicyPage() {
  return (
    <div className="min-h-dvh flex flex-col bg-background text-foreground">
      <SiteNav />

      {/* Header */}
      <div className="border-b border-border/60 pb-8 pt-6">
        <div className="mx-auto max-w-5xl px-4 w-full">
          <BackButton />
          <h1 className="mt-4 font-display text-3xl md:text-5xl font-bold tracking-tight">
            Cookie Policy
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Effective Date: <span className="text-foreground font-medium">{LAST_UPDATED}</span>
          </p>
        </div>
      </div>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-4 py-10 flex-1 w-full space-y-10">
        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">1. Overview</h2>
          <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
            This Cookie Policy explains how <strong className="text-foreground">TixNaija</strong> (operated by {{BUSINESS_LEGAL_NAME}}) uses cookies, local storage, and similar web technologies when you use our platform. This policy should be read alongside our{" "}
            <Link to="/privacy" className="text-foreground underline underline-offset-4 hover:text-primary">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link to="/terms" className="text-foreground underline underline-offset-4 hover:text-primary">
              Terms of Service
            </Link>
            .
          </p>
          <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
            We adhere to the Nigeria Data Protection Act 2023 (NDPA). We do not deploy third-party advertising trackers or sell your personal data. Non-essential analytical scripts are blocked by default until you grant permission.
          </p>
          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openCookieSettings}
              className="text-xs font-semibold"
            >
              Open Cookie Settings
            </Button>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">2. Technologies We Use</h2>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-left text-xs md:text-sm">
              <thead className="border-b border-border bg-muted/40 font-semibold text-foreground">
                <tr>
                  <th className="p-3">Identifier</th>
                  <th className="p-3">Provider</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Lifespan</th>
                  <th className="p-3">Purpose</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {COOKIE_INVENTORY.map((c) => (
                  <tr key={c.name} className="hover:bg-muted/10 transition-colors">
                    <td className="p-3 font-mono font-medium text-foreground">{c.name}</td>
                    <td className="p-3 text-muted-foreground">{c.provider}</td>
                    <td className="p-3 text-muted-foreground">{c.storageType}</td>
                    <td className="p-3">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-[11px] font-semibold ${
                          c.category === "Strictly Essential"
                            ? "bg-muted text-muted-foreground"
                            : "bg-primary/10 text-primary border border-primary/20"
                        }`}
                      >
                        {c.category}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground">{c.lifespan}</td>
                    <td className="p-3 text-muted-foreground leading-relaxed">{c.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">3. Strictly Essential Cookies & Local Storage</h2>
          <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
            Strictly essential identifiers are necessary for core functionality and cybersecurity. They enable you to log in, securely transact via Paystack, claim purchased tickets, and maintain selected interface preferences. These cannot be switched off through our banner as the service cannot function properly without them.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">4. Performance & Analytical Cookies</h2>
          <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
            With your explicit consent, we load Google Analytics to understand aggregate platform activity (such as error occurrences, navigation bottlenecks, and device responsiveness). IP anonymization is enforced. You may toggle this permission off at any time using the "Cookie settings" button below or in the site footer.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">5. How to Control Cookies in Your Browser</h2>
          <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
            In addition to our preference panel, modern browsers allow you to block or delete cookies through browser settings. Note that disabling local storage or essential authentication cookies will prevent you from signing in to your TixNaija account.
          </p>
          <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
            <li>Google Chrome: Settings → Privacy and security → Third-party cookies</li>
            <li>Mozilla Firefox: Settings → Privacy & Security → Cookies and Site Data</li>
            <li>Apple Safari: Settings → Safari → Advanced → Block All Cookies</li>
          </ul>
        </section>

        <section className="space-y-4 border-t border-border/40 pt-8">
          <h2 className="text-xl font-semibold tracking-tight">6. Inquiries and Contact</h2>
          <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
            For questions about this policy or our data handling practices, please contact our Data Protection Officer at:
          </p>
          <div className="rounded-xl border border-border bg-card p-4 text-xs md:text-sm space-y-1 text-muted-foreground">
            <p><strong className="text-foreground">Entity:</strong> {{BUSINESS_LEGAL_NAME}}</p>
            <p><strong className="text-foreground">Registration:</strong> RC/CAC Number: {{RC_NUMBER}}</p>
            <p><strong className="text-foreground">Address:</strong> {{REGISTERED_ADDRESS}}</p>
            <p><strong className="text-foreground">Email:</strong> {{DPO_EMAIL}} / tixnaijaapp@gmail.com</p>
            <p><strong className="text-foreground">Phone:</strong> +234 901 127 5275</p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
