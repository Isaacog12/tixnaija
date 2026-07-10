import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const email = `test_${Date.now()}@example.com`;
  const password = "password123";

  console.log("Signing up user:", email);
  const { data: authData, error: authErr } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authErr) {
    console.error("Auth Error:", authErr.message);
    process.exit(1);
  }

  const userId = authData.user.id;
  console.log("Signed up user ID:", userId);

  // Wait a little bit for triggers to run
  await new Promise((r) => setTimeout(r, 1000));

  console.log("Becoming organizer via upsert...");
  const roleRes = await supabase
    .from("user_roles")
    .upsert({ user_id: userId, role: "organizer" }, { onConflict: "user_id,role", ignoreDuplicates: true });

  if (roleRes.error) {
    console.error("Role Upsert Error:", roleRes.error.message);
    // don't exit, let's see what happens next
  } else {
    console.log("Role Upsert Success!");
  }

  // Check roles
  const { data: roles } = await supabase.from("user_roles").select("*").eq("user_id", userId);
  console.log("Current user roles:", roles);

  // Attempt to create event
  console.log("Creating event...");
  const { data: event, error: evErr } = await supabase
    .from("events")
    .insert({
      organizer_id: userId,
      title: "Test Event",
      slug: `test-event-${Date.now()}`,
      category: "music",
      city: "Lagos",
      start_datetime: new Date().toISOString(),
      status: "draft",
    })
    .select("id")
    .single();

  if (evErr) {
    console.error("Event Insert Error:", evErr.message, evErr);
  } else {
    console.log("Event created successfully!", event);
  }
}

run();
