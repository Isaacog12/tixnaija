// supabase/functions/_shared/notification-preferences.ts
//
// Shared utility to verify user notification preferences across all Edge Functions.

export type NotificationKey =
  | "ticket_confirmations"
  | "event_reminders"
  | "organizer_updates"
  | "marketing_emails";

export const DEFAULT_PREFERENCES: Record<NotificationKey, boolean> = {
  ticket_confirmations: true,
  event_reminders: true,
  organizer_updates: true,
  marketing_emails: false,
};

/**
 * Checks whether an individual user has opted in to receive a specific category of notification.
 * If user has explicitly opted out (value === false), returns false.
 * Otherwise returns the category default.
 */
export async function isNotificationOptedIn(
  supabase: any,
  identifier: { email?: string | null; userId?: string | null },
  prefKey: NotificationKey
): Promise<boolean> {
  try {
    const { email, userId } = identifier;
    let query = supabase.from("profiles").select("notification_preferences");

    if (userId) {
      query = query.eq("id", userId);
    } else if (email) {
      query = query.eq("email", email.trim().toLowerCase());
    } else {
      return DEFAULT_PREFERENCES[prefKey];
    }

    const { data, error } = await query.maybeSingle();
    if (error || !data || !data.notification_preferences) {
      return DEFAULT_PREFERENCES[prefKey];
    }

    const prefs = typeof data.notification_preferences === "string"
      ? JSON.parse(data.notification_preferences)
      : data.notification_preferences;

    if (typeof prefs[prefKey] === "boolean") {
      return prefs[prefKey];
    }

    return DEFAULT_PREFERENCES[prefKey];
  } catch (err) {
    console.error("Error checking notification preference:", err);
    return DEFAULT_PREFERENCES[prefKey];
  }
}

/**
 * Batch filters a list of emails according to their notification preferences.
 * Returns a Set of lowercase emails that are opted in and permitted to receive the notification.
 */
export async function filterOptedInEmails(
  supabase: any,
  emails: string[],
  prefKey: NotificationKey
): Promise<Set<string>> {
  const allowed = new Set<string>();
  const normalizedEmails = Array.from(
    new Set(emails.filter(Boolean).map((e) => e.trim().toLowerCase()))
  );

  if (normalizedEmails.length === 0) {
    return allowed;
  }

  try {
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("email, notification_preferences")
      .in("email", normalizedEmails);

    if (error) {
      console.warn("Could not query profiles for notification preferences, using defaults:", error.message);
      if (DEFAULT_PREFERENCES[prefKey]) {
        normalizedEmails.forEach((e) => allowed.add(e));
      }
      return allowed;
    }

    const prefsMap = new Map<string, boolean>();
    profiles?.forEach((p: any) => {
      if (p.email) {
        const raw = p.notification_preferences;
        const prefs = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (prefs && typeof prefs[prefKey] === "boolean") {
          prefsMap.set(p.email.trim().toLowerCase(), prefs[prefKey]);
        }
      }
    });

    normalizedEmails.forEach((email) => {
      const isExplicit = prefsMap.has(email);
      const isOptedIn = isExplicit ? prefsMap.get(email)! : DEFAULT_PREFERENCES[prefKey];
      if (isOptedIn) {
        allowed.add(email);
      }
    });

    return allowed;
  } catch (err) {
    console.error("Error in filterOptedInEmails:", err);
    if (DEFAULT_PREFERENCES[prefKey]) {
      normalizedEmails.forEach((e) => allowed.add(e));
    }
    return allowed;
  }
}
