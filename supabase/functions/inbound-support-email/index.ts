import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * Inbound support email -> case thread.
 *
 * Until now `email_outbox` only sent: a customer replying to
 * support.tixnaija@gmail.com was invisible to the portal. This endpoint accepts
 * a provider webhook (any JSON with `from` + `subject` + `text`) and appends the
 * message to the buyer's open case, or opens one if there is none.
 *
 * Security: the caller must present the shared secret from INBOUND_EMAIL_SECRET.
 * If that variable is missing the endpoint fails closed — it never accepts
 * unauthenticated mail, because the body is written into a customer's case.
 */

const MAX_BODY_CHARS = 3000;
const MAX_SUBJECT_CHARS = 150;

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey =
  Deno.env.get("APP_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const inboundSecret = Deno.env.get("INBOUND_EMAIL_SECRET") ?? "";

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

function rest(path: string, init: RequestInit = {}) {
  return fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {}),
    },
  });
}

/** Accepts "Name <a@b.com>", "a@b.com" and provider objects. */
function extractEmail(from: unknown): string | null {
  if (typeof from !== "string") return null;
  const angled = from.match(/<([^>]+)>/);
  const candidate = (angled ? angled[1] : from).trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(candidate) ? candidate : null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!supabaseUrl || !serviceKey) {
    console.error("inbound-support-email: missing Supabase configuration");
    return json({ error: "Support email is not configured." }, 503);
  }

  // Fail closed: without a configured secret nobody can inject mail into cases.
  if (!inboundSecret) {
    console.error("inbound-support-email: INBOUND_EMAIL_SECRET is not set");
    return json({ error: "Support email is not configured." }, 503);
  }

  const presented = req.headers.get("x-inbound-secret") ?? "";
  if (presented !== inboundSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const senderEmail = extractEmail(body?.from ?? body?.fromAddress ?? body?.sender);
  if (!senderEmail) {
    return json({ error: "Missing or invalid sender address" }, 400);
  }

  const rawText = String(body?.text ?? body?.textbody ?? body?.body ?? "").trim();
  if (!rawText) {
    return json({ error: "Empty message body" }, 400);
  }
  const messageText = rawText.slice(0, MAX_BODY_CHARS);

  const rawSubject = String(body?.subject ?? "").replace(/^(re|fw|fwd):\s*/i, "").trim();
  const subject = (rawSubject || "Email enquiry").slice(0, MAX_SUBJECT_CHARS);

  // Registered buyer? user_contacts maps the delivery address to an account.
  const contactRes = await rest(
    `user_contacts?select=user_id&email=ilike.${encodeURIComponent(senderEmail)}&limit=1`,
  );
  const contacts = contactRes.ok ? await contactRes.json() : [];
  const customerId: string | null = contacts?.[0]?.user_id ?? null;

  // One live case per person: replying to the thread keeps the history together.
  const caseFilter = customerId
    ? `support_cases?select=id,case_number,guest_message&status=in.(open,pending)&customer_id=eq.${customerId}&order=updated_at.desc&limit=1`
    : `support_cases?select=id,case_number,guest_message&status=in.(open,pending)&guest_email=eq.${encodeURIComponent(senderEmail)}&order=updated_at.desc&limit=1`;

  const caseRes = await rest(caseFilter);
  const existing = caseRes.ok ? await caseRes.json() : [];
  const openCase = existing?.[0] ?? null;

  if (openCase) {
    if (customerId) {
      const insertRes = await rest("support_case_messages", {
        method: "POST",
        body: JSON.stringify({
          case_id: openCase.id,
          sender_id: customerId,
          is_internal: false,
          content: messageText,
        }),
      });
      if (!insertRes.ok) {
        console.error("inbound-support-email: message insert failed", await insertRes.text());
        return json({ error: "Could not append message" }, 500);
      }
    } else {
      // Guests have no auth.users row, so support_case_messages cannot hold their
      // words (sender_id is NOT NULL and foreign-keyed). The opening column is the
      // guest-visible transcript, so append there.
      const combined = `${openCase.guest_message ?? ""}\n\n${messageText}`.trim();
      const updateRes = await rest(`support_cases?id=eq.${openCase.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          guest_message: combined.slice(-8000),
          updated_at: new Date().toISOString(),
        }),
      });
      if (!updateRes.ok) {
        console.error("inbound-support-email: case update failed", await updateRes.text());
        return json({ error: "Could not append message" }, 500);
      }
    }

    return json({
      ok: true,
      action: "appended",
      case_number: openCase.case_number,
    });
  }

  const createRes = await rest("support_cases", {
    method: "POST",
    body: JSON.stringify({
      customer_id: customerId,
      guest_email: customerId ? null : senderEmail,
      guest_message: customerId ? null : messageText,
      subject,
      category: "other",
      status: "open",
      priority: "medium",
    }),
  });

  if (!createRes.ok) {
    console.error("inbound-support-email: case insert failed", await createRes.text());
    return json({ error: "Could not open a case" }, 500);
  }

  const created = await createRes.json();
  const newCase = created?.[0];

  // A signed-in buyer has a user row, so their message can live in the thread.
  if (customerId && newCase?.id) {
    await rest("support_case_messages", {
      method: "POST",
      body: JSON.stringify({
        case_id: newCase.id,
        sender_id: customerId,
        is_internal: false,
        content: messageText,
      }),
    });
  }

  return json({
    ok: true,
    action: "created",
    case_number: newCase?.case_number ?? null,
  });
});
