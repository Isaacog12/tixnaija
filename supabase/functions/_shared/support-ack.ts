/**
 * The customer's receipt for an escalated question.
 *
 * It carries a case number and fixed wording and nothing else. It used to print
 * the customer's own message back to them, which turned our trusted sender into
 * a way to deliver arbitrary text to any verified address — a stranger could
 * type whatever they liked into the chat and have it arrive from TixNaija. The
 * builder takes no message argument at all, so that cannot come back by
 * accident.
 */

import { escapeHtml } from "./html.ts";

export type AckPriority = "urgent" | "high" | "medium" | "low";

/**
 * Response times are stated per priority and as an aim, never a promise.
 * Every case used to be told "3 business days" even when it was urgent.
 */
export const ACK_RESPONSE_WINDOWS: Record<AckPriority, string> = {
  urgent: "We aim to reply to urgent cases within a few hours during support hours (Mon-Fri, 9am-6pm WAT).",
  high: "We aim to reply within one business day.",
  medium: "We usually reply within 1-3 business days.",
  low: "We usually reply within 3 business days.",
};

export function ackResponseWindow(priority?: string | null): string {
  const key = (priority ?? "medium") as AckPriority;
  return ACK_RESPONSE_WINDOWS[key] ?? ACK_RESPONSE_WINDOWS.medium;
}

export interface AcknowledgementEmail {
  subject: string;
  html: string;
}

export function buildSupportAcknowledgement(params: {
  caseNumber: string;
  priority?: string | null;
}): AcknowledgementEmail {
  const caseNumber = escapeHtml(String(params.caseNumber || "unassigned").replace(/[\r\n]+/g, " "));
  const window = ackResponseWindow(params.priority);

  return {
    subject: `[TixNaija Support] We received your question — ${String(params.caseNumber || "unassigned").replace(/[\r\n]+/g, " ")}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;">
        <div style="margin-bottom: 24px; border-bottom: 2px solid #111827; padding-bottom: 12px;">
          <h1 style="font-size: 20px; font-weight: bold; margin: 0; color: #111827;">We have your question</h1>
        </div>
        <p style="font-size: 15px; line-height: 1.6; margin-bottom: 16px;">
          The TixNaija assistant couldn't answer this one, so it has been passed to our support team.
        </p>
        <table style="width: 100%; font-size: 14px; line-height: 1.6; margin-bottom: 20px; border-collapse: collapse;">
          <tr><td style="padding: 6px 0; color: #6b7280; width: 150px;">Your case number</td><td style="padding: 6px 0; font-weight: 600;">${caseNumber}</td></tr>
        </table>
        <p style="font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
          ${escapeHtml(window)} We will reply to this email address.
        </p>
        <p style="font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
          Keep the case number handy &mdash; quoting it gets your answer faster.
        </p>
        <p style="font-size: 14px; line-height: 1.6;">
          If your question is about a missing ticket, you can resend the links yourself right now at
          <a href="https://tixnaija.name.ng/my-tickets" style="color: #111827; text-decoration: underline;">tixnaija.name.ng/my-tickets</a>.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="font-size: 12px; color: #9ca3af; text-align: center;">
          TixNaija · Independent Nigerian Ticketing Platform
        </p>
      </div>
    `,
  };
}
