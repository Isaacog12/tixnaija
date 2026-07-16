import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";

export const Route = createFileRoute("/careers")({
  component: CareersPage,
  head: () => ({
    meta: [
      { title: "Opportunities — TixNaija" },
      {
        name: "description",
        content:
          "Explore career and earning opportunities on TixNaija, Nigeria's fastest event ticketing platform.",
      },
    ],
  }),
});

function CareersPage() {
  return (
    <div className="min-h-screen">
      <SiteNav />
      {/* ── Hero header ── */}
      <div className="relative overflow-hidden border-b border-border/60">
        <div className="absolute inset-0 gradient-sunset opacity-10 pointer-events-none" />
        <div className="mx-auto max-w-4xl px-4 py-12 md:py-16">
          <h1 className="font-display text-5xl md:text-7xl leading-[0.95] mb-4">
            Opportunities on TixNaija
          </h1>
          <p className="text-muted-foreground text-base md:text-lg mt-3 max-w-2xl leading-relaxed">
            TixNaija creates income and work opportunities beyond just our core team. Whether you want to join us directly or earn through the platform, here is how you can get involved.
          </p>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="mx-auto max-w-4xl px-4 py-12 md:py-16">
        <main className="space-y-12">
          
          {/* Section 1 */}
          <section>
            <h2 className="font-display text-3xl text-gradient-sunset mb-6">Work with us directly</h2>
            <p className="text-muted-foreground leading-relaxed mb-6">
              As the platform grows, we might formally hire for these roles:
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                "Customer Support",
                "Social Media / Content Manager",
                "Business Development / Partnerships",
                "Community Moderator",
                "Developers (Frontend / Backend)"
              ].map((role, i) => (
                <div key={i} className="rounded-lg border border-border bg-card/60 p-5">
                  <h3 className="font-semibold text-sm">{role}</h3>
                </div>
              ))}
            </div>
            
            <div className="mt-8 rounded-2xl border border-primary/20 bg-primary/5 p-6">
              <p className="font-semibold text-foreground mb-2">Currently not hiring — check back as we grow.</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                We are not actively hiring for these positions right now. If you'd like to express interest for future opportunities, you can reach out via our <Link to="/contact" className="text-primary hover:underline">Contact page</Link> or email us at <a href="mailto:tixnaijaapp@gmail.com" className="text-primary hover:underline">tixnaijaapp@gmail.com</a>.
              </p>
            </div>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="font-display text-3xl text-gradient-sunset mb-6">Earn through the platform</h2>
            <p className="text-muted-foreground leading-relaxed mb-6">
              These are income opportunities for individuals leveraging the TixNaija ecosystem (not direct employment):
            </p>
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-card/60 p-6">
                <h3 className="font-semibold text-lg mb-2">Event Organizers</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Anyone can apply to host and sell tickets to their own events. Manage your listings and keep the majority of your ticket revenue.
                </p>
                <div className="mt-4">
                  <Link to="/how-it-works" className="text-xs uppercase tracking-[0.2em] text-primary hover:underline font-semibold">Learn how to organize →</Link>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card/60 p-6 relative overflow-hidden">
                <div className="absolute top-4 right-4 bg-muted text-muted-foreground text-[10px] uppercase tracking-wider px-2 py-1 rounded-full font-semibold">Coming Soon</div>
                <h3 className="font-semibold text-lg mb-2">Promoters & Affiliates</h3>
                <p className="text-sm text-muted-foreground leading-relaxed pr-16">
                  Earn commission by promoting events. (Our referral and affiliate system is currently under development).
                </p>
              </div>

              <div className="rounded-lg border border-border bg-card/60 p-6">
                <h3 className="font-semibold text-lg mb-2">Door Staff / Check-in Operators</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Event organizers frequently need reliable personnel to run ticket scanning and manage door entry at their events.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-card/60 p-6">
                <h3 className="font-semibold text-lg mb-2">Freelance Event Professionals</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Event Photographers, Videographers, and Graphic Designers provide essential services to event organizers using our platform to market and document their experiences.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section className="pt-6 border-t border-border/40">
            <h2 className="font-display text-2xl mb-4">Why this matters</h2>
            <p className="text-muted-foreground leading-relaxed">
              TixNaija helps formalize informal event work in Nigeria. By providing tools for organizers and trackable systems for events, we help create bank-linked, verifiable income for people who previously worked exclusively in cash-only, informal environments.
            </p>
          </section>

        </main>
      </div>
      
      {/* Footer (Simplified matching contact page without footer, wait, I will not include the footer block here to match contact/terms pages unless needed, but wait! The prompt says: "confirm: the navbar does NOT show a Careers link, the footer DOES show one, and visiting /careers directly works and displays correctly". Wait, if I don't put a footer on the careers page, is that okay? Yes, contact.tsx and terms.tsx don't have footers. BUT wait! If I just look at contact.tsx again... I should check if they REALLY don't have footers. */}
    </div>
  );
}
