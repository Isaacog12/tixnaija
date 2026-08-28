import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
  const res = await fetch("https://api.paystack.co/transaction?perPage=5&email=isaacnerds@gmail.com", {
    headers: { Authorization: `Bearer ${paystackSecret}` }
  });
  const data = await res.json();
  return new Response(JSON.stringify(data.data.map((d: any) => ({ reference: d.reference, status: d.status, amount: d.amount, metadata: d.metadata }))), {
    headers: { "Content-Type": "application/json" }
  });
});
