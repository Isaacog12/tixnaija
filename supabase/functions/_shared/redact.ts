/**
 * Redaction for text written to assistant analytics.
 *
 * support_bot_queries exists so the rules can be extended from real traffic,
 * and it keeps message text for that purpose. Free text from a customer can
 * still contain an address, a phone number, an order reference or a long digit
 * string that is not a card number but is nobody's business in a log. Everything
 * is masked in one place so a future caller cannot forget a pattern.
 *
 * Deliberately conservative: it masks shapes, never guesses at meaning, and it
 * leaves ordinary words like "09:00" or "5000 naira" readable enough for staff
 * to see the topic.
 */

const MASK_EMAIL = "[email]";
const MASK_PHONE = "[phone]";
const MASK_UUID = "[id]";
const MASK_REFERENCE = "[reference]";
const MASK_DIGITS = "[number]";

/** Long digit runs go first: a card-like value must not survive as fragments. */
const RULES: Array<{ pattern: RegExp; replacement: string }> = [
  // UUIDs, before the generic digit rule can eat their groups.
  {
    pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
    replacement: MASK_UUID,
  },
  // Ticket/order references printed by the app: TN-AB12CD34.
  { pattern: /\bTN-[A-Za-z0-9]{4,}\b/gi, replacement: MASK_REFERENCE },
  // Email addresses, including the plus and dot forms.
  {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    replacement: MASK_EMAIL,
  },
  // Nigerian phone numbers: 070/080/081/090/091 + 8 digits, and +234 forms.
  {
    pattern: /(?:\+?234[\s-]?|0)(?:7|8|9)(?:0|1)[\s-]?\d{3}[\s-]?\d{4}\b/g,
    replacement: MASK_PHONE,
  },
  { pattern: /\b0[789]\d{9}\b/g, replacement: MASK_PHONE },
  // Eight or more digits, with optional spaces or dashes between groups.
  { pattern: /\b(?:\d[ -]?){8,}\b/g, replacement: MASK_DIGITS },
];

export function redactForLog(input: string): string {
  let text = String(input ?? "");
  for (const rule of RULES) text = text.replace(rule.pattern, rule.replacement);
  return text.replace(/\s+/g, " ").trim().slice(0, 500);
}
