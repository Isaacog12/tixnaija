import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Simple in-memory rate limiting (per isolate)
const rateLimits = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const record = rateLimits.get(identifier);

  if (!record || now > record.resetTime) {
    rateLimits.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  record.count += 1;
  return true;
}

const SYSTEM_PROMPT = `You are the customer support assistant for TixNaija, a Nigerian event ticketing platform.
Be helpful, concise, and friendly. Answer questions based ONLY on the following FAQ and policies.
If you do not know the answer, politely say so and direct them to use the Contact page.

**FAQ & Policies:**
- **Buying Tickets:** Find an event, select type/qty, checkout via Paystack. QR ticket sent to email immediately.
- **Account Requirement:** Guest checkout is supported (needs name + email). Accounts allow viewing tickets in "My Tickets".
- **Finding Tickets:** Check email (including spam) or go to "My Tickets" if logged in.
- **Buying for others:** Yes, enter their name/email during checkout.
- **Payment Methods:** Handled by Paystack (debit/credit cards, bank transfer, USSD, Opay/Palmpay). All in Naira (₦).
- **Refunds:** Processed to original payment method in 3-7 business days. TixNaija charges no refund fee.
- **Event Cancelled:** Organizer refunds all money. Users get an email.
- **Event Postponed:** Ticket remains valid, or users can email to request a refund.
- **Change of Mind:** Organizer's discretion, not guaranteed. Must email to request.
- **Contact Organizer:** Use "Ask a question" on the event page or find their details there. TixNaija cannot speak on their behalf.
- **Legitimacy:** Organizers must be approved before listing paid events. If fraudulent, users should use the Contact page.
- **Event Disappeared:** Likely unpublished or cancelled. Users should have received an email.
- **Become Organizer:** Go to Dashboard -> "Become an Organizer". Reviewed in 24-48 hours.
- **Password Reset:** Use "Forgot Password" on login screen. Check spam.
- **Change Email/Delete Account:** Not self-serve yet. Must request via Contact page. Deletion takes 7 days.
- **QR Won't Scan:** Show ticket email on phone. Organizer can manually look up name on attendee list.

**Event Search Tool:**
You have access to a tool called `search_events` to find public events. 
- You MUST pass any date filters as explicit date bounds, category filters, and organizer names to the tool.
- For relative dates like "this weekend" or "tonight", calculate the dates yourself before passing to the tool. The current server date/time is provided below.
- After calling the tool, summarize the results naturally. Do not return raw JSON to the user.
- If zero results are found, say so plainly. Do not invent events!

Current Server Time: ${new Date().toISOString()}
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader || '' } } }
    );

    // Identify user or IP for rate limiting
    let identifier = req.headers.get("x-forwarded-for") || "anonymous";
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) {
      identifier = user.id;
    }

    if (!checkRateLimit(identifier)) {
      return new Response(JSON.stringify({ error: "You're sending messages too fast. Please wait a minute." }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    const { history, message } = await req.json();
    
    // Gemini 1.5 Flash - Free Tier API Call
    const apiKey = Deno.env.get("CHAT_AI_API_KEY");
    if (!apiKey) {
      throw new Error("Missing CHAT_AI_API_KEY");
    }

    const tools = [{
      function_declarations: [
        {
          name: "search_events",
          description: "Search for upcoming public events based on filters.",
          parameters: {
            type: "OBJECT",
            properties: {
              startDate: { type: "STRING", description: "ISO 8601 string for start date bound (e.g. 2026-09-30T00:00:00Z). Optional." },
              endDate: { type: "STRING", description: "ISO 8601 string for end date bound (e.g. 2026-10-02T23:59:59Z). Optional." },
              category: { type: "STRING", description: "Event category (e.g. music, conference, party). Optional." },
              organizerName: { type: "STRING", description: "Name of the event organizer to filter by. Optional." }
            }
          }
        }
      ]
    }];

    const callGemini = async (contents: any[]) => {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: SYSTEM_PROMPT }]
            },
            contents,
            tools
          })
        }
      );

      if (resp.status === 429) {
        throw new Error("RATE_LIMIT");
      }
      
      if (!resp.ok) {
        throw new Error(`Gemini API error: ${resp.status} ${resp.statusText}`);
      }

      return await resp.json();
    };

    let contents = [
      ...history.map((h: any) => ({
        role: h.role === "assistant" ? "model" : "user",
        parts: [{ text: h.content }]
      })),
      {
        role: "user",
        parts: [{ text: message }]
      }
    ];

    let geminiData;
    try {
      geminiData = await callGemini(contents);
    } catch (err: any) {
      if (err.message === "RATE_LIMIT") {
        return new Response(JSON.stringify({ text: "Our AI is a bit overwhelmed right now. Please try again in a moment." }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }
      throw err;
    }

    const candidate = geminiData.candidates?.[0];
    const part = candidate?.content?.parts?.[0];

    // Handle tool call
    if (part?.functionCall) {
      const { name, args } = part.functionCall;
      if (name === "search_events") {
        // Execute Supabase Query
        let query = supabaseClient.from("events").select(`
          title, venue_name, city, start_datetime, category,
          profiles!events_organizer_id_fkey(full_name),
          ticket_types(price_kobo)
        `).in("status", ["published", "completed"]);

        if (args.startDate) query = query.gte("start_datetime", args.startDate);
        if (args.endDate) query = query.lte("start_datetime", args.endDate);
        if (args.category) query = query.ilike("category", `%${args.category}%`);
        if (args.organizerName) query = query.ilike("profiles.full_name", `%${args.organizerName}%`);

        const { data: events, error } = await query.limit(5);

        if (error) {
          console.error("Supabase Error:", error);
        }

        const formattedEvents = (events || []).filter(e => e).map((e: any) => {
           let prices = "Free";
           if (e.ticket_types && e.ticket_types.length > 0) {
             const min = Math.min(...e.ticket_types.map((t:any) => t.price_kobo)) / 100;
             const max = Math.max(...e.ticket_types.map((t:any) => t.price_kobo)) / 100;
             prices = min === max ? `₦${min}` : `₦${min} - ₦${max}`;
           }
           return {
             title: e.title,
             date: e.start_datetime,
             venue: e.venue_name || e.city || "Online",
             organizer: e.profiles?.full_name || "Unknown",
             prices
           };
        });

        // Append function call and response to conversation and call again
        contents.push(candidate.content);
        contents.push({
          role: "user",
          parts: [{
            functionResponse: {
              name: "search_events",
              response: { events: formattedEvents }
            }
          }]
        });

        try {
          geminiData = await callGemini(contents);
        } catch (err: any) {
          if (err.message === "RATE_LIMIT") {
            return new Response(JSON.stringify({ text: "Our AI is a bit overwhelmed right now. Please try again in a moment." }), {
              headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            });
          }
          throw err;
        }
      }
    }

    const reply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "I'm having trouble thinking right now.";

    return new Response(
      JSON.stringify({ text: reply }),
      { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }
});
