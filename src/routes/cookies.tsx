import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { LegalHeader } from "@/components/legal-header";
import { Button } from "@/components/ui/button";
import { openCookieSettings } from "@/lib/cookie-consent";
import { BUSINESS_DETAILS } from "@/lib/business";

export const Route = createFileRoute("/cookies")({
  component: CookiePolicyPage,
  head: () => ({
    meta: [
      { title: "Cookie Policy — TixNaija" },
      {
        name: "description",
        content:
          "A short, plain-language explanation of the cookies TixNaija uses, why they exist, and how to change your choices.",
      },
    ],
  }),
});

const LAST_UPDATED = "November 22, 2026";

function CookiePolicyPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteNav />

      <LegalHeader eyebrow="TixNaija / Legal" title="Cookie Policy" updated={LAST_UPDATED} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 md:py-16 lg:px-8">
        <div className="space-y-12">
          <section className="space-y-4">
            <h2 className="font-display text-[22px] leading-tight tracking-[-0.01em] text-foreground md:text-[24px]">
              The short version
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground md:text-[15px]">
              A cookie is a small piece of information a website stores in your browser. TixNaija
              uses them for two things only: to keep you signed in and to remember a few of your
              choices. There are no advertising trackers, and we do not sell your data.
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground md:text-[15px]">
              Analytics is off until you say otherwise. This policy sits alongside our{" "}
              <Link
                to="/privacy"
                className="text-foreground underline underline-offset-4 hover:text-primary"
              >
                Privacy Policy
              </Link>{" "}
              and{" "}
              <Link
                to="/terms"
                className="text-foreground underline underline-offset-4 hover:text-primary"
              >
                Terms of Service
              </Link>
              .
            </p>
          </section>

          <section className="space-y-4 border-t border-border/60 pt-8">
            <h2 className="font-display text-[22px] leading-tight tracking-[-0.01em] text-foreground md:text-[24px]">
              What we store
            </h2>

            <div className="space-y-6">
              <div className="border-l border-border/60 pl-4">
                <h3 className="text-[15px] font-semibold text-foreground">
                  Keeping the site working
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  Your login session, the tickets you have bought, your light or dark theme, and
                  your cookie choice. Without these, signing in and opening your tickets is not
                  possible. They cannot be switched off.
                </p>
              </div>

              <div className="border-l border-border/60 pl-4">
                <h3 className="text-[15px] font-semibold text-foreground">
                  Understanding how the site is used
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  With your permission we load Google Analytics to see things like which pages
                  break or which steps people find slow. It is anonymous and aggregated — we never
                  use it to follow you around the internet. It stays off until you allow it.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-4 border-t border-border/60 pt-8">
            <h2 className="font-display text-[22px] leading-tight tracking-[-0.01em] text-foreground md:text-[24px]">
              Your choices
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground md:text-[15px]">
              Turn analytics on or off at any time — your choice is saved and can be changed
              whenever you like.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openCookieSettings}
              className="text-xs font-semibold"
            >
              Open cookie settings
            </Button>
            <p className="text-sm leading-relaxed text-muted-foreground md:text-[15px]">
              You can also clear or block cookies in your browser settings, under Privacy. Be aware
              that doing this will sign you out of TixNaija and you will need to log in again.
            </p>
          </section>

          <section className="space-y-3 border-t border-border/60 pt-8">
            <h2 className="font-display text-[22px] leading-tight tracking-[-0.01em] text-foreground md:text-[24px]">
              Questions
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground md:text-[15px]">
              Something here unclear? Write to{" "}
              <a
                href={`mailto:${BUSINESS_DETAILS.supportEmail}`}
                className="text-foreground underline underline-offset-4 hover:text-primary"
              >
                {BUSINESS_DETAILS.supportEmail}
              </a>{" "}
              and we will explain it plainly.
            </p>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
