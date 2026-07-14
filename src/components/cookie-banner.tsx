import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "tixnaija_cookie_consent";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Small delay so the page renders first, then banner slides in
    const timer = setTimeout(() => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) setVisible(true);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  function accept() {
    localStorage.setItem(STORAGE_KEY, "accepted");
    setVisible(false);
  }

  function decline() {
    localStorage.setItem(STORAGE_KEY, "declined");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-live="polite"
      className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 md:px-6 md:pb-6 animate-in slide-in-from-bottom-4 duration-500"
    >
      <div className="mx-auto max-w-4xl rounded-2xl border border-border bg-card/95 p-5 shadow-glow backdrop-blur-md md:flex md:items-center md:gap-6">
        {/* Cookie icon */}
        <div className="mb-3 shrink-0 md:mb-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-full gradient-sunset shadow-glow text-primary-foreground text-lg">
            🍪
          </div>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            We use cookies to improve your experience
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
            TixNaija uses essential cookies to keep you signed in and analytical
            cookies (e.g. Google Analytics) to understand platform usage. No data
            is sold to advertisers.{" "}
            <Link
              to="/privacy"
              className="text-primary underline underline-offset-2 hover:opacity-80"
            >
              Learn more
            </Link>
          </p>
        </div>

        {/* Actions */}
        <div className="mt-4 flex shrink-0 flex-wrap gap-2 md:mt-0 md:flex-nowrap">
          <Button
            id="cookie-decline"
            variant="outline"
            size="sm"
            onClick={decline}
            className="border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
          >
            Decline optional
          </Button>
          <Button
            id="cookie-accept"
            size="sm"
            onClick={accept}
            className="gradient-sunset text-primary-foreground shadow-glow hover:opacity-90"
          >
            Accept all
          </Button>
        </div>
      </div>
    </div>
  );
}
