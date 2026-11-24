// One dark, table-based shell for every transactional email TixNaija sends.
//
// A 600px column, hairline rules instead of nested cards, 16px body text at 1.65
// line height, one primary action. Flexbox and rounded cards were replaced
// because Outlook ignores them and Gmail rewrites them, which is how these
// emails ended up looking broken.
import { escapeHtml } from "./html.ts";

export const INK = "#f5f3ef";
export const BODY_TEXT = "#bdb7af";
export const MUTED = "#8f8981";
export const CANVAS = "#0e0e10";
export const SOFT = "#16161a";
export const LINE = "#26262a";
export const ACCENT = "#f97316";
export const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
export const SERIF = "Georgia, 'Times New Roman', serif";

export const SITE = "https://tixnaija.name.ng";

export const shell = (inner: string) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${CANVAS};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:${CANVAS};font-family:${SANS};">${inner}
      </table>
    </td>
  </tr>
</table>`;

/** Masthead: wordmark on the left, the one identifier that matters on the right. */
export const masthead = (right: string) => `
        <tr>
          <td style="padding:22px 32px;border-bottom:1px solid ${LINE};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="left" style="font-family:${SERIF};font-size:15px;letter-spacing:0.22em;text-transform:uppercase;color:${INK};">TixNaija</td>
                <td align="right" style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${MUTED};">${right}</td>
              </tr>
            </table>
          </td>
        </tr>`;

export const hero = (overline: string, heading: string, intro: string) => `
        <tr>
          <td style="padding:36px 32px 0;">
            <p style="margin:0 0 16px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${MUTED};">${overline}</p>
            <h1 style="margin:0 0 14px;font-family:${SERIF};font-weight:400;font-size:30px;line-height:1.2;letter-spacing:-0.01em;color:${INK};">${heading}</h1>
            <p style="margin:0 0 28px;font-size:16px;line-height:1.65;color:${BODY_TEXT};">${intro}</p>
          </td>
        </tr>`;

/** Banner when a cover image exists. Alt is empty: the title is right beside it. */
export const cover = (url?: string | null) =>
  url
    ? `
        <tr>
          <td style="padding:0 32px;">
            <img src="${escapeHtml(url)}" alt="" width="536" style="display:block;width:100%;max-width:536px;height:auto;border:1px solid ${LINE};" />
          </td>
        </tr>`
    : "";

/** Label/value rows read as a receipt; values are pre-escaped by the caller. */
export const details = (rows: Array<[string, string]>) => {
  const cells = rows
    .map(([label, value], index) => {
      const bottom = index === rows.length - 1 ? `border-bottom:1px solid ${LINE};` : "";
      return `
                <tr>
                  <td style="padding:14px 0;border-top:1px solid ${LINE};${bottom}width:120px;vertical-align:top;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:${MUTED};">${escapeHtml(label)}</td>
                  <td style="padding:14px 0;border-top:1px solid ${LINE};${bottom}vertical-align:top;font-size:16px;line-height:1.5;color:${INK};">${value}</td>
                </tr>`;
    })
    .join("");

  return `
        <tr>
          <td style="padding:28px 32px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${cells}
            </table>
          </td>
        </tr>`;
};

export const actions = (
  primaryHref: string,
  primaryLabel: string,
  secondaryHref: string,
  secondaryLabel: string,
) => `
        <tr>
          <td style="padding:28px 32px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding-bottom:10px;">
                  <a href="${escapeHtml(primaryHref)}" style="display:block;text-align:center;text-decoration:none;background-color:${INK};color:${CANVAS};font-size:16px;font-weight:600;padding:16px 24px;border-radius:2px;">${primaryLabel}</a>
                </td>
              </tr>
              <tr>
                <td>
                  <a href="${escapeHtml(secondaryHref)}" style="display:block;text-align:center;text-decoration:none;border:1px solid #35353a;color:${INK};font-size:16px;font-weight:600;padding:15px 24px;border-radius:2px;">${secondaryLabel}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;

export const organizerNote = (message?: string | null) =>
  message
    ? `
        <tr>
          <td style="padding:0 32px 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${SOFT};border:1px solid ${LINE};">
              <tr>
                <td style="padding:20px 22px;">
                  <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${MUTED};">Message from the organizer</p>
                  <p style="margin:0;font-size:15px;line-height:1.65;color:${INK};white-space:pre-wrap;">${escapeHtml(message)}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>`
    : "";

export const giftNote = (lines: { label: string; value: string; message?: string | null }) => `
        <tr>
          <td style="padding:0 32px 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="border-left:2px solid ${ACCENT};padding:2px 0 2px 16px;">
                  <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${MUTED};">${escapeHtml(lines.label)}</p>
                  <p style="margin:0 0 8px;font-size:17px;line-height:1.5;color:${INK};">${escapeHtml(lines.value)}</p>
                  ${
                    lines.message
                      ? `<p style="margin:0;font-size:15px;line-height:1.65;color:${BODY_TEXT};font-style:italic;">&ldquo;${escapeHtml(lines.message)}&rdquo;</p>`
                      : ""
                  }
                </td>
              </tr>
            </table>
          </td>
        </tr>`;

export const footer = (reason: string) => `
        <tr>
          <td style="padding:28px 32px 0;">
            <p style="margin:0;font-size:13px;line-height:1.6;color:${MUTED};">${escapeHtml(reason)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${LINE};">
              <tr>
                <td style="padding-top:20px;">
                  <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:${MUTED};">TixNaija &middot; Independent Nigerian ticketing platform</p>
                  <p style="margin:0;font-size:12px;line-height:1.6;color:${MUTED};">
                    <a href="${SITE}/terms" style="color:${ACCENT};text-decoration:underline;">Terms</a> &middot;
                    <a href="${SITE}/privacy" style="color:${ACCENT};text-decoration:underline;">Privacy</a> &middot;
                    <a href="${SITE}/refunds" style="color:${ACCENT};text-decoration:underline;">Refunds</a> &middot;
                    <a href="${SITE}/account?tab=notifications" style="color:${ACCENT};text-decoration:underline;">Email settings</a>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;

export const shortCode = (code: string) => (code || "").split("-")[0].toUpperCase();

/** One bordered card per ticket: type, code, QR, and its own downloads. */
export const ticketCard = (ticket: any) => {
  const code = shortCode(ticket.ticket_code);
  const singleUrl = `${SITE}/t/${encodeURIComponent(ticket.ticket_code)}`;
  const pdfUrl = `${singleUrl}?download=true`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=264x264&data=${encodeURIComponent(ticket.ticket_code)}&margin=0`;

  return `
        <tr>
          <td style="padding:22px 32px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${LINE};">
              <tr>
                <td align="center" style="padding:26px 24px 0;">
                  <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:${MUTED};">${escapeHtml(ticket.ticketTypeName)}</p>
                  <p style="margin:0 0 22px;font-family:${SERIF};font-size:22px;letter-spacing:0.12em;color:${INK};">${escapeHtml(code)}</p>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;">
                    <tr>
                      <td style="padding:12px;">
                        <img src="${escapeHtml(qrUrl)}" alt="Ticket QR code ${escapeHtml(code)}" width="132" height="132" style="display:block;width:132px;height:132px;" />
                      </td>
                    </tr>
                  </table>
                  <p style="margin:16px 0 24px;font-size:13px;line-height:1.6;color:${MUTED};">Scan at the entrance. One entry per ticket.</p>
                </td>
              </tr>
              <tr>
                <td style="padding:0 24px 26px;">
                  <a href="${escapeHtml(String(pdfUrl))}" style="display:block;text-align:center;text-decoration:none;background-color:${INK};color:${CANVAS};font-size:16px;font-weight:600;padding:16px 24px;border-radius:2px;">Download PDF ticket</a>
                  <div style="height:10px;"></div>
                  <a href="${escapeHtml(String(singleUrl))}" style="display:block;text-align:center;text-decoration:none;border:1px solid #35353a;color:${INK};font-size:16px;font-weight:600;padding:15px 24px;border-radius:2px;">View in browser</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
};
