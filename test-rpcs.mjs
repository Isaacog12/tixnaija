import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: user } = await supabase.auth.signUp({ email: "test_rpc@example.com", password: "password123" });
  console.log("user", user?.user?.id);
  
  // Try cancel_event
  const res1 = await supabase.rpc("cancel_event", {
    p_event_id: "00000000-0000-0000-0000-000000000000",
    p_note: null
  });
  console.log("cancel_event with null:", res1.error);

  const res2 = await supabase.rpc("cancel_event", {
    p_event_id: "00000000-0000-0000-0000-000000000000",
    p_note: "test"
  });
  console.log("cancel_event with string:", res2.error);

  // Try issue_comp_tickets
  const res3 = await supabase.rpc("issue_comp_tickets", {
    p_event_id: "00000000-0000-0000-0000-000000000000",
    p_ticket_type_id: "00000000-0000-0000-0000-000000000000",
    p_recipients: [{ name: "test", email: "test@test.com" }]
  });
  console.log("issue_comp_tickets:", res3.error);
}

run();
