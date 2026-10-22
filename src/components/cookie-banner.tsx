import { useState, useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  getCookieConsent,
  saveCookieConsent,
  initConsentMode,
  OPEN_SETTINGS_EVENT,
} from "@/lib/cookie-consent";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize default denied consent mode
    initConsentMode();

    const saved = getCookieConsent();
    if (!saved) {
      const timer = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(timer);
    } else {
      setAnalyticsEnabled(saved.analytics);
    }
  }, []);

  // Listen for open settings event from footer
  useEffect(() => {
    function handleOpenSettings() {
      const current = getCookieConsent();
      setAnalyticsEnabled(current?.analytics ?? false);
      setShowManage(true);
      setVisible(true);
    }

    window.addEventListener(OPEN_SETTINGS_EVENT, handleOpenSettings);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, handleOpenSettings);
  }, []);

  // Keyboard navigation: Escape key closes if already consented, or toggles manage
  useEffect(() => {
    if (!visible) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (showManage) {
          setShowManage(false);
        } else if (getCookieConsent()) {
          setVisible(false);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [visible, showManage]);

  function handleAcceptAll() {
    saveCookieConsent(true);
    setAnalyticsEnabled(true);
    setShowManage(false);
    setVisible(false);
  }

  function handleRejectNonEssential() {
    saveCookieConsent(false);
    setAnalyticsEnabled(false);
    setShowManage(false);
    setVisible(false);
  }

  function handleSavePreferences() {
    saveCookieConsent(analyticsEnabled);
    setShowManage(false);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-banner-title"
      aria-describedby="cookie-banner-description"
      className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6"
    >
      <div
        ref={containerRef}
        className="mx-auto max-w-3xl rounded-xl border border-border bg-card p-5 text-card-foreground shadow-lg md:p-6"
      >
        {!showManage ? (
          <div>
            <h2 id="cookie-banner-title" className="text-base font-semibold text-foreground">
              Cookie and Data Privacy Settings
            </h2>
            <p id="cookie-banner-description" className="mt-1.5 text-xs md:text-sm text-muted-foreground leading-relaxed">
              We use strictly necessary cookies to keep you signed in and maintain secure sessions. With your permission, we also use anonymized analytical cookies to measure platform traffic and performance. We do not use third-party advertising cookies or sell your personal data. Read our{" "}
              <Link to="/cookies" className="text-foreground underline underline-offset-4 hover:text-primary">
                Cookie Policy
              </Link>{" "}
              and{" "}
              <Link to="/privacy" className="text-foreground underline underline-offset-4 hover:text-primary">
                Privacy Policy
              </Link>
              .
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2 pt-2 border-t border-border/40">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRejectNonEssential}
                className="h-9 px-4 text-xs font-medium border-border hover:bg-muted"
              >
                Reject non-essential
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowManage(true)}
                className="h-9 px-4 text-xs font-medium border-border hover:bg-muted"
              >
                Manage preferences
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAcceptAll}
                className="h-9 px-4 text-xs font-medium border-border hover:bg-muted"
              >
                Accept all
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h2 id="cookie-banner-title" className="text-base font-semibold text-foreground">
                Manage Cookie Preferences
              </h2>
              <button
                type="button"
                onClick={() => setShowManage(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
                aria-label="Back to overview"
              >
                Back
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="flex items-start justify-between gap-4 rounded-lg border border-border/50 bg-muted/20 p-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-semibold text-foreground">
                      Strictly Essential Cookies & Storage
                    </Label>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Always Active
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Required for core security, account authentication, and system preferences (theme and cookie choice storage). These cannot be deactivated.
                  </p>
                </div>
                <Switch checked disabled aria-label="Essential cookies always enabled" />
              </div>

              <div className="flex items-start justify-between gap-4 rounded-lg border border-border/50 bg-muted/20 p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="analytics-toggle" className="text-sm font-semibold text-foreground cursor-pointer">
                    Analytical Cookies (Google Analytics)
                  </Label>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Collects aggregated, IP-anonymized metrics on pages viewed and checkout completion rates so we can identify technical issues and improve usability.
                  </p>
                </div>
                <Switch
                  id="analytics-toggle"
                  checked={analyticsEnabled}
                  onCheckedChange={setAnalyticsEnabled}
                  aria-label="Toggle analytical cookies"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-border/40 pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRejectNonEssential}
                className="h-9 px-4 text-xs font-medium border-border hover:bg-muted"
              >
                Reject all non-essential
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSavePreferences}
                className="h-9 px-4 text-xs font-medium border-border hover:bg-muted font-semibold"
              >
                Save preferences
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAcceptAll}
                className="h-9 px-4 text-xs font-medium border-border hover:bg-muted"
              >
                Accept all
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
