import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const env = {};
envContent.split(/\r?\n/).forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return;
  const idx = trimmed.indexOf("=");
  if (idx > -1) {
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function inspect() {
  const { data: tickets, error: ticketsErr } = await supabase
    .from("tickets")
    .select(`
      id,
      ticket_code,
      attendee_name,
      attendee_email,
      status,
      order_item_id,
      order_items(
        id,
        order_id,
        ticket_type_id,
        orders(
          id,
          user_id,
          buyer_name,
          buyer_email,
          total_kobo,
          events(
            id,
            title,
            start_datetime,
            venue_name
          )
        ),
        ticket_types(
          id,
          name,
          price_kobo
        )
      )
    `);

  console.log("Total tickets found:", tickets?.length, "error:", ticketsErr);
  if (tickets) {
    for (const t of tickets) {
      console.log({
        ticketId: t.id,
        ticket_code: t.ticket_code,
        order_item_id: t.order_item_id,
        order_id: t.order_items?.order_id,
        has_order: !!t.order_items?.orders,
        user_id: t.order_items?.orders?.user_id,
        buyer_email: t.order_items?.orders?.buyer_email,
        has_event: !!t.order_items?.orders?.events,
        event_title: t.order_items?.orders?.events?.title,
        ticket_type: t.order_items?.ticket_types?.name,
      });
    }
  }
}

inspect();
