import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Calling validate_promo_code...");
  
  // Try with a random UUID
  const { data, error } = await supabase.rpc('validate_promo_code', {
    p_event_id: '4a2472c0-a58c-42b1-b53f-37b5a8d66592',
    p_code: 'TESTCODE'
  });
    
  if (error) {
    console.error("Error from RPC:", error);
    return;
  }
  
  console.log("Success:", data);
}

main();
