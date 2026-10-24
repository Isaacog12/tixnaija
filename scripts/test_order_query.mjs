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
console.log("Using URL:", supabaseUrl);
const supabase = createClient(supabaseUrl, serviceKey);

async function test() {
  const { data: orders, error: ordersErr } = await supabase
    .from("orders")
    .select("*, events(*)")
    .order("created_at", { ascending: false })
    .limit(3);

  console.log("Orders count:", orders?.length, "error:", ordersErr);
  if (!orders || orders.length === 0) return;

  const order = orders[0];
  console.log("Sample order ID:", order.id);
  console.log("Order events field:", typeof order.events, Array.isArray(order.events), order.events ? Object.keys(order.events) : null);

  const { data: tickets, error: ticketsErr } = await supabase
    .from("tickets")
    .select(`
      *,
      order_items!inner(
        order_id,
        ticket_types(*)
      )
    `)
    .eq("order_items.order_id", order.id);

  console.log("Tickets count:", tickets?.length, "error:", ticketsErr);
  if (tickets && tickets.length > 0) {
    const t = tickets[0];
    console.log("Ticket sample:", JSON.stringify(t, null, 2));
  }
}

test();
