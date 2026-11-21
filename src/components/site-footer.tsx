import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Mail, PhoneCall } from "lucide-react";
import { openCookieSettings } from "@/lib/cookie-consent";
import { BUSINESS_DETAILS } from "@/lib/business";

/** One column of footer links. */
function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; to: string }[];
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        {title}
      </p>
      <ul className="mt-4 space-y-2.5">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              to={link.to}
              className="text-[14px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-background text-foreground">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ── Wordmark, statement, link columns ──────────────────────── */}
        <div className="grid gap-10 py-14 sm:grid-cols-2 md:py-20 lg:grid-cols-[1.5fr_1fr_1fr_1fr] lg:gap-12">
          <div className="min-w-0">
            <Link
              to="/"
              aria-label="TixNaija home"
              className="inline-flex items-baseline transition-opacity hover:opacity-80"
            >
              <span className="font-display text-[26px] leading-none tracking-[0.06em] text-foreground">
                TIX
              </span>
              <span className="font-display text-[26px] leading-none font-light tracking-[0.06em] text-gradient-sunset">
                NAIJA
              </span>
            </Link>

            <p className="mt-5 max-w-xs text-[14px] leading-relaxed text-muted-foreground">
              An independent Nigerian ticketing platform — discovery, checkout and door scanning in
              one place.
            </p>

            <div className="mt-6 flex flex-col gap-2 text-[13px]">
              <a
                href={`mailto:${BUSINESS_DETAILS.supportEmail}`}
                className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
              >
                <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {BUSINESS_DETAILS.supportEmail}
              </a>
              <a
                href={`tel:${BUSINESS_DETAILS.supportPhone.replace(/\s+/g, "")}`}
                className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
              >
                <PhoneCall className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {BUSINESS_DETAILS.supportPhone}
              </a>
            </div>

            <a
              href="https://www.instagram.com/tixnaija/"
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-semibold text-foreground transition-colors hover:text-primary"
            >
              @tixnaija on Instagram
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </a>
          </div>

          <FooterColumn
            title="Explore"
            links={[
              { label: "Browse events", to: "/browse" },
              { label: "How it works", to: "/how-it-works" },
              { label: "Help & FAQ", to: "/faq" },
              { label: "My tickets", to: "/my-tickets" },
            ]}
          />

          <FooterColumn
            title="Company"
            links={[
              { label: "About us", to: "/about" },
              { label: "Contact", to: "/about" },
              { label: "Careers", to: "/careers" },
              { label: "For organizers", to: "/dashboard" },
            ]}
          />

          <FooterColumn
            title="Legal"
            links={[
              { label: "Terms of Service", to: "/terms" },
              { label: "Privacy Policy", to: "/privacy" },
              { label: "Refund Policy", to: "/refunds" },
              { label: "Cookie Policy", to: "/cookies" },
            ]}
          />
        </div>

        {/* ── Baseline ───────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 border-t border-border/60 py-6 text-[12px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {BUSINESS_DETAILS.platformName}. All rights reserved.
          </p>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="hidden text-[11px] uppercase tracking-[0.16em] sm:inline">
              Built in Nigeria
            </span>
            <span aria-hidden className="hidden h-3 w-px bg-border sm:inline-block" />
            <button
              type="button"
              onClick={openCookieSettings}
              className="cursor-pointer text-left text-[12px] transition-colors hover:text-foreground"
            >
              Cookie settings
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
