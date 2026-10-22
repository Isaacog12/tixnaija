export interface CookieConsentState {
  essential: true;
  analytics: boolean;
  updatedAt: string;
}

export const COOKIE_STORAGE_KEY = "tixnaija_cookie_consent_v2";
export const OPEN_SETTINGS_EVENT = "tixnaija_open_cookie_settings";
export const CONSENT_UPDATED_EVENT = "tixnaija_consent_updated";

const GA_MEASUREMENT_ID = "G-PLT1VPPEQR";

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

export function getCookieConsent(): CookieConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(COOKIE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.analytics === "boolean") {
      return {
        essential: true,
        analytics: parsed.analytics,
        updatedAt: parsed.updatedAt || new Date().toISOString(),
      };
    }
  } catch (err) {
    console.error("Failed to parse cookie consent state", err);
  }
  return null;
}

export function saveCookieConsent(analytics: boolean): CookieConsentState {
  const state: CookieConsentState = {
    essential: true,
    analytics,
    updatedAt: new Date().toISOString(),
  };

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(COOKIE_STORAGE_KEY, JSON.stringify(state));
      // Sync Google Analytics consent based on user decision
      applyGoogleAnalyticsConsent(analytics);
      window.dispatchEvent(new CustomEvent(CONSENT_UPDATED_EVENT, { detail: state }));
    } catch (err) {
      console.error("Failed to save cookie consent", err);
    }
  }

  return state;
}

export function openCookieSettings(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT));
  }
}

export function applyGoogleAnalyticsConsent(granted: boolean): void {
  if (typeof window === "undefined") return;

  // Initialize dataLayer and default consent denied if not already set
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function () {
      window.dataLayer?.push(arguments);
    };
  }

  if (granted) {
    // Dynamically inject script if not present
    if (!document.getElementById("ga-gtag-script")) {
      const script = document.createElement("script");
      script.id = "ga-gtag-script";
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
      document.head.appendChild(script);

      window.gtag("js", new Date());
      window.gtag("config", GA_MEASUREMENT_ID, {
        anonymize_ip: true,
      });
    }

    window.gtag("consent", "update", {
      analytics_storage: "granted",
    });
  } else {
    window.gtag("consent", "update", {
      analytics_storage: "denied",
    });

    // Remove any analytics cookies created if rejected
    const cookies = document.cookie.split(";");
    for (const c of cookies) {
      const name = c.split("=")[0].trim();
      if (name.startsWith("_ga") || name === "_gid" || name === "_gat") {
        document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
        document.cookie = `${name}=; Path=/; Domain=.${window.location.hostname}; Expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
      }
    }
  }
}

export function initConsentMode(): void {
  if (typeof window === "undefined") return;

  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function () {
      window.dataLayer?.push(arguments);
    };
  }

  // Set default consent to denied before any tags run
  window.gtag("consent", "default", {
    analytics_storage: "denied",
    ad_storage: "denied",
  });

  const existing = getCookieConsent();
  if (existing) {
    applyGoogleAnalyticsConsent(existing.analytics);
  }
}
