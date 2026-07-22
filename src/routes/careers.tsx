import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";
import { Briefcase, MessageSquare, Users } from "lucide-react";

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

const OPEN_ROLES = [
  {
    title: "Customer Support",
    icon: MessageSquare,
    description:
      "Be the first point of contact for attendees and event organisers. Help resolve ticket issues, answer queries, and make sure every experience on TixNaija is smooth.",
  },
  {
    title: "Social Media / Content Manager",
    icon: Users,
    description:
      "Own TixNaija's voice on Instagram, X, and TikTok. Create content that gets people excited about events, grows our audience, and builds the brand.",
  },
  {
    title: "Business Development / Partnerships",
    icon: Briefcase,
    description:
      "Identify and onboard new event organisers, venues, and strategic partners. You'll be key to expanding TixNaija's footprint across Nigeria.",
  },
] as const;

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

          {/* Section 1 — Open Roles */}
          <section>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="font-display text-3xl text-gradient-sunset">Work with us directly</h2>
              <span className="inline-flex items-center rounded-full bg-green-500/10 border border-green-500/20 px-2.5 py-0.5 text-xs font-semibold text-green-500 uppercase tracking-wider">
                Now Hiring
              </span>
            </div>
            <p className="text-muted-foreground leading-relaxed mb-8">
              We're growing and actively looking for talented people to join the team. If any of these roles sound like you, we'd love to hear from you.
            </p>

            <div className="flex flex-col gap-5">
              {OPEN_ROLES.map((role) => {
                const Icon = role.icon;
                return (
                  <div
                    key={role.title}
                    className="group rounded-2xl border border-border bg-card/60 p-6 flex flex-col sm:flex-row sm:items-center gap-5 transition hover:border-primary/40 hover:bg-card/80"
                  >
                    <div className="flex-shrink-0 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary/20 transition">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground text-base mb-1">{role.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{role.description}</p>
                    </div>
                    <div className="flex-shrink-0">
                      <a
                        href={`/careers/apply?role=${encodeURIComponent(role.title)}`}
                        className="inline-flex items-center justify-center rounded-xl gradient-sunset px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 whitespace-nowrap"
                      >
                        Apply Now
                      </a>
                    </div>
                  </div>
                );
              })}
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
    </div>
  );
}
