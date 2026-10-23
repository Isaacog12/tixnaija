// supabase/functions/_shared/zeptomail.ts
//
// Shared ZeptoMail sender. Every email-sending function imports this.
//
// Set these as Supabase secrets before deploying:
//   supabase secrets set ZEPTOMAIL_TOKEN=your_send_mail_token
//   supabase secrets set MAIL_FROM_ADDRESS=tixnaija@tixnaija.name.ng
//   supabase secrets set MAIL_FROM_NAME="TixNaija"
//
// Get ZEPTOMAIL_TOKEN from: ZeptoMail dashboard > your Agent > SMTP/API tab
// > Send Mail Token.

const ZEPTOMAIL_URL = "https://api.zeptomail.com/v1.1/email";

interface SendEmailParams {
  to: { address: string; name?: string };
  subject: string;
  htmlBody: string;
  textBody?: string;
  headers?: Array<{ name: string; value: string }>;
}

export async function sendEmail(
  { to, subject, htmlBody, textBody, headers }: SendEmailParams,
) {
  const token = Deno.env.get("ZEPTOMAIL_TOKEN");
  const fromAddress = Deno.env.get("MAIL_FROM_ADDRESS") ??
    "noreply@tixnaija.name.ng";
  "tixnaija@tixnaija.name.ng";
  const fromName = Deno.env.get("MAIL_FROM_NAME") ?? "TixNaija";

  if (!token) {
    throw new Error("ZEPTOMAIL_TOKEN env var is not set");
  }

  const payload: any = {
    from: { address: fromAddress, name: fromName },
    to: [{ email_address: { address: to.address, name: to.name ?? "" } }],
    subject,
    htmlbody: htmlBody,
    ...(textBody ? { textbody: textBody } : {}),
    ...(headers && headers.length > 0 ? { mail_format_headers: headers } : {}),
  };

  const res = await fetch(ZEPTOMAIL_URL, {
    method: "POST",
    headers: {
      "Authorization": token.startsWith("Zoho-enczapikey")
        ? token
        : `Zoho-enczapikey ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`ZeptoMail send failed (${res.status}): ${errBody}`);
  }

  return res.json();
}
