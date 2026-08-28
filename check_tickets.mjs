import { createClient } from "@supabase/supabase-js";
const supabaseUrl = "https://bjijftxksykbjknbleul.supabase.co";
const supabaseKey = "sb_publishable_RfXOHwPhaVxfcVhVX-UzvA_2GoeqbfZ";
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from("ticket_types").select("*").eq("event_id", "d74bf80e-302f-4704-8f3a-ac9c72418bb3");
  console.log(data);
}
run();
