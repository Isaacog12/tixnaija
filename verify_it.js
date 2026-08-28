const url = "https://bjijftxksykbjknbleul.supabase.co/functions/v1/verify-payment";
const anonKey = "sb_publishable_RfXOHwPhaVxfcVhVX-UzvA_2GoeqbfZ"; // from .env

async function verify() {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${anonKey}`
    },
    body: JSON.stringify({ reference: "T987067415698804" })
  });
  const data = await res.json();
  console.log("Status:", res.status);
  console.log("Response:", data);
}

verify();
