import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const twoDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  
  console.log("Checking events created in the last 3 days...");
  
  const { data: events, error } = await supabase
    .from("events")
    .select("id, title, status, start_datetime, end_datetime, created_at, ticket_types(id)")
    .gte("created_at", twoDaysAgo)
    .order("created_at", { ascending: false });
    
  if (error) {
    console.error("Error fetching events:", error);
    return;
  }
  
  console.log(JSON.stringify(events, null, 2));

  // Run the browse query
  console.log("\n\nRunning the exact browse query...");
  let query = supabase
    .from("events")
    .select("id, title, slug, city, venue_name, start_datetime, end_datetime, cover_image_url, description, status, category")
    .in("status", ["published", "cancelled"])
    // Fetch from a bit in the past, then rigorously filter out anything that has ended.
    .gte("start_datetime", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
    .order("start_datetime", { ascending: true })
    .limit(100);

  const { data: browseData, error: browseError } = await query;
  if (browseError) {
    console.error("Browse query error:", browseError);
  } else {
    console.log(`Browse query returned ${browseData.length} raw results.`);
    const now = new Date();
    const validEvents = (browseData ?? []).filter(ev => {
      const start = new Date(ev.start_datetime);
      const end = ev.end_datetime ? new Date(ev.end_datetime) : start;
      return end >= now;
    });
    console.log(`After client side filtering: ${validEvents.length} results.`);
    console.log("Event IDs returned:");
    console.log(validEvents.map(e => e.id));
  }
}

main();
