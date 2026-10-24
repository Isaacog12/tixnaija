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

async function testAllOrders() {
  const { data: orders } = await supabase.from("orders").select("id, event_id, buyer_email");
  console.log("Total orders:", orders?.length);
  for (const o of orders || []) {
    const { data: ord, error: ordErr } = await supabase
      .from("orders")
      .select("*, events(*)")
      .eq("id", o.id)
      .single();

    if (ordErr || !ord) {
      console.log(`Order ${o.id} failed query:`, ordErr);
      continue;
    }

    if (!ord.events) {
      console.log(`Order ${o.id} has NULL events! event_id is:`, ord.event_id);
    }

    const { data: tickets, error: tErr } = await supabase
      .from("tickets")
      .select(`
        *,
        order_items!inner(
          order_id,
          ticket_types(*)
        )
      `)
      .eq("order_items.order_id", o.id);

    if (tErr) {
      console.log(`Order ${o.id} tickets query failed:`, tErr);
      continue;
    }

    for (const t of tickets || []) {
      if (!t.order_items) {
        console.log(`Ticket ${t.id} has NULL order_items`);
      } else if (!t.order_items.ticket_types) {
        console.log(`Ticket ${t.id} has NULL ticket_types`);
      }
      if (!t.ticket_code) {
        console.log(`Ticket ${t.id} has NULL ticket_code`);
      }
    }
  }
  console.log("Finished testing all orders.");
}

testAllOrders();
