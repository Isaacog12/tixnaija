import { Link } from "@tanstack/react-router";
import { openCookieSettings } from "@/lib/cookie-consent";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/40 bg-card/40 py-10 text-xs md:text-sm text-muted-foreground">
      <div className="mx-auto max-w-7xl px-4 space-y-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <Link to="/" className="flex items-baseline gap-0 hover:opacity-80 transition-opacity">
            <span className="font-display text-2xl leading-none tracking-wide text-foreground">TIX</span>
            <span className="font-display text-2xl leading-none tracking-wide font-light text-gradient-sunset">NAIJA</span>
          </Link>

          <nav aria-label="Footer navigation" className="flex flex-wrap justify-center gap-x-6 gap-y-2 font-medium">
            <Link to="/how-it-works" className="hover:text-foreground transition-colors">Guide</Link>
            <Link to="/about" className="hover:text-foreground transition-colors">Contact</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link to="/refunds" className="hover:text-foreground transition-colors">Refund Policy</Link>
            <Link to="/cookies" className="hover:text-foreground transition-colors">Cookie Policy</Link>
            <Link to="/careers" className="hover:text-foreground transition-colors">Careers</Link>
            <button
              type="button"
              onClick={openCookieSettings}
              className="hover:text-foreground transition-colors underline-offset-4 hover:underline text-left cursor-pointer"
            >
              Cookie settings
            </button>
          </nav>
        </div>

        <div className="border-t border-border/40 pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs leading-relaxed text-center md:text-left">
          <div className="space-y-1">
            <p className="font-semibold text-foreground">
              {"{{BUSINESS_LEGAL_NAME}}"} · RC/CAC: {"{{RC_NUMBER}}"}
            </p>
            <p>
              Registered Address: {"{{REGISTERED_ADDRESS}}"}
            </p>
            <p>
              Email: <a href="mailto:tixnaijaapp@gmail.com" className="hover:text-foreground underline">tixnaijaapp@gmail.com</a> · Phone: +234 901 127 5275
            </p>
          </div>

          <p className="font-medium text-muted-foreground shrink-0">
            © {new Date().getFullYear()} TixNaija. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
