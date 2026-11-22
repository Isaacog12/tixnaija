import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Mail, PhoneCall } from "lucide-react";
import { openCookieSettings } from "@/lib/cookie-consent";
import { BUSINESS_DETAILS } from "@/lib/business";

const LEGAL_LINKS = [
  { label: "Terms", to: "/terms" },
  { label: "Privacy", to: "/privacy" },
  { label: "Refunds", to: "/refunds" },
  { label: "Cookies", to: "/cookies" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-background text-foreground">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ── Wordmark, statement, contact ───────────────────────────── */}
        <div className="flex flex-col gap-6 py-7 sm:flex-row sm:items-start sm:justify-between sm:gap-10 md:py-9">
          <div className="min-w-0">
            <Link
              to="/"
              aria-label="TixNaija home"
              className="inline-flex items-baseline transition-opacity hover:opacity-80"
            >
              <span className="font-display text-[22px] leading-none tracking-[0.06em] text-foreground">
                TIX
              </span>
              <span className="font-display text-[22px] leading-none font-light tracking-[0.06em] text-gradient-sunset">
                NAIJA
              </span>
            </Link>

            <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
              An independent Nigerian ticketing platform — discovery, checkout and door scanning in
              one place.
            </p>
          </div>

          <div className="flex flex-col gap-1.5 text-[12.5px] sm:items-end">
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
            <a
              href="https://www.instagram.com/tixnaija/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-semibold text-foreground transition-colors hover:text-primary"
            >
              @tixnaija on Instagram
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </a>
          </div>
        </div>

        {/* ── Baseline ───────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2 border-t border-border/60 py-4 text-[11.5px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {BUSINESS_DETAILS.platformName}. All rights reserved.
          </p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-[11.5px] transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
            <span aria-hidden className="hidden h-3 w-px bg-border sm:inline-block" />
            <button
              type="button"
              onClick={openCookieSettings}
              className="cursor-pointer text-left text-[11.5px] transition-colors hover:text-foreground"
            >
              Cookie settings
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
