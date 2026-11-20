/**
 * One place that turns anything thrown into words a customer can act on.
 *
 * Supabase and Postgres hand back raw internals — constraint names, RLS policy
 * text, PGRST codes, "invalid input syntax for type uuid". None of that belongs
 * on screen: it leaks the schema and reads like a crash to the person using the
 * site. So we map what we recognise, leave our own human sentences untouched,
 * and fall back to a neutral line for everything else. The original error is
 * still logged for us, it just never reaches the UI.
 */

export const GENERIC_ERROR = "Something went wrong. Please try again.";
export const NETWORK_ERROR =
  "We couldn't reach the server. Check your internet connection and try again.";
export const SESSION_ERROR = "Your session has expired. Please sign in again.";

/** Postgres SQLSTATE / PostgREST codes worth naming. */
const BY_CODE: Record<string, string> = {
  // Integrity
  "23505": "That already exists. Please use a different name or value.",
  "23502": "Some required details are missing. Please fill them in and try again.",
  "23503": "This is still linked to other records, so it can't be changed yet.",
  "23514": "One of the values entered isn't allowed.",
  "22P02": "One of the values entered isn't valid.",
  // Permissions
  "42501": "You don't have permission to do that.",
  // Schema drift — our bug, never the customer's to read
  "42P01": GENERIC_ERROR,
  "42703": GENERIC_ERROR,
  "42883": GENERIC_ERROR,
  // PostgREST
  PGRST116: "That record no longer exists. It may have been removed already.",
  PGRST202: GENERIC_ERROR,
  PGRST301: SESSION_ERROR,
  PGRST302: SESSION_ERROR,
  // Connection / cancellation
  "08000": NETWORK_ERROR,
  "08003": NETWORK_ERROR,
  "08006": NETWORK_ERROR,
  "57014": "That took too long to finish. Please try again.",
  // HTTP surfaced through supabase-js
  "401": SESSION_ERROR,
  "403": "You don't have permission to do that.",
  "408": "That took too long. Please try again.",
  "429": "Too many attempts. Please wait a moment and try again.",
  "500": GENERIC_ERROR,
  "502": NETWORK_ERROR,
  "503": NETWORK_ERROR,
  "504": NETWORK_ERROR,
};

/** Recognisable text, for the many call sites that hand us a message string. */
const BY_TEXT: Array<[RegExp, string]> = [
  [/invalid login credentials/i, "That email or password isn't correct."],
  [/email not confirmed/i, "Please confirm your email address, then sign in."],
  [/user already registered/i, "An account with this email already exists. Try signing in instead."],
  [/password should be at least/i, "That password is too short. Use at least 6 characters."],
  [/failed to fetch|network ?error|load failed|err_network|err_internet|fetch failed/i, NETWORK_ERROR],
  [/jwt expired|invalid jwt|jwt is expired|token .*expired/i, SESSION_ERROR],
  [/duplicate key value/i, BY_CODE["23505"]],
  [/row-level security|permission denied/i, BY_CODE["42501"]],
  [/violates foreign key/i, BY_CODE["23503"]],
  [/null value in column/i, BY_CODE["23502"]],
  [/violates check constraint/i, BY_CODE["23514"]],
  [/invalid input syntax/i, BY_CODE["22P02"]],
  [/coerce the result to a single json object|0 rows|no rows/i, BY_CODE.PGRST116],
  [/timeout|timed out/i, "That took too long. Please try again."],
  [/rate limit|too many requests/i, BY_CODE["429"]],
];

/**
 * Anything matching these is machine text we never show, even if we have no
 * specific translation for it. Last line of defence before the fallback.
 */
const RAW_HINTS: RegExp[] = [
  /duplicate key value/i,
  /violates .*constraint/i,
  /row-level security/i,
  /pgrst\d+/i,
  /relation ".*" does not exist/i,
  /column ".*" does not exist/i,
  /function .* does not exist/i,
  /schema cache/i,
  /null value in column/i,
  /invalid input syntax/i,
  /permission denied for/i,
  /could not find the .* function/i,
  /\bjwt\b/i,
  /\bpostgres/i,
  /\bsupabase\b/i,
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readCode(input: unknown): string | undefined {
  if (!isRecord(input)) return undefined;
  const raw = input.code ?? input.error_code ?? input.status;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (typeof raw === "number") return String(raw);
  return undefined;
}

function readMessage(input: unknown): string {
  if (typeof input === "string") return input;
  if (input instanceof Error) return input.message;
  if (isRecord(input)) {
    for (const key of ["message", "error_description", "error", "msg", "details"] as const) {
      const value = input[key];
      if (typeof value === "string" && value.trim()) return value;
    }
  }
  return "";
}

/**
 * Map a thrown value (Error, supabase-js response error, or a bare string) to
 * copy we are willing to put in front of a customer.
 *
 * `fallback` is used when there is nothing usable to say — pass something
 * specific to the flow ("Couldn't save that macro.") where you can.
 */
export function friendlyError(input: unknown, fallback: string = GENERIC_ERROR): string {
  if (input == null) return fallback;

  const text = readMessage(input).trim();
  const code = readCode(input);

  if (!text && !code) return fallback;

  if (code && BY_CODE[code]) return BY_CODE[code];

  if (text) {
    for (const [pattern, message] of BY_TEXT) {
      if (pattern.test(text)) return message;
    }
    if (RAW_HINTS.some((pattern) => pattern.test(text))) return fallback;
    return text;
  }

  return fallback;
}

/**
 * Log the real thing for debugging, then hand back safe copy. Keeps call sites
 * to one line: `toast.error(reportError(err))`.
 */
export function reportError(input: unknown, context?: string): string {
  if (import.meta.env.DEV) {
    console.error(`[${context ?? "app"}]`, input);
  }
  return friendlyError(input);
}
