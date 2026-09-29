import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const subject = "The TixNaija app is here — get it for Android";

const htmlBody = `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a; line-height: 1.6;">
  <p>Hi there,</p>
  <p>Good news — TixNaija now has a native Android app.</p>
  <p>Browse events, buy tickets, and keep your QR code ready to scan at the door, right from your phone — no need to open your browser every time.</p>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="https://tixnaija.name.ng/download" style="background-color: #ff6b00; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
      Download the App
    </a>
  </div>

  <p style="font-size: 14px; color: #555;">Since the app isn't on the Google Play Store yet, your phone will show a one-time "install from unknown sources" prompt the first time — that's normal, just approve it and the install continues right away. Full step-by-step instructions are on the download page if you'd like them.</p>

  <p>If you run into anything while using it, just reply to this email and let us know.</p>

  <p>See you at the next event,<br><strong>The TixNaija Team</strong></p>
</div>
`;

async function run() {
  console.log("Triggering broadcast...");
  
  const { data, error } = await supabase.functions.invoke("send-platform-broadcast", {
    body: { subject, htmlBody },
  });
  
  if (error) {
    console.error("Error triggering broadcast:", error);
  } else {
    console.log("Success!", data);
  }
}

run();
