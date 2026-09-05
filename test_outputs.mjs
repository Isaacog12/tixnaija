import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config();
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const { data: events, error } = await supabase
  .from("events")
  .select("slug, start_datetime, end_datetime, title, city, venue_name, description, cover_image_url, status, state");

if (error) { console.error(error); process.exit(1); }

console.log("=== JSON-LD FOR FIRST EVENT ===");
const ev = events[0];
const dateStr = ev.start_datetime ? new Date(ev.start_datetime).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
const cityPart = ev.city ? ` — ${ev.city}` : '';
const title = `${ev.title}${cityPart} | TixNaija`;
let desc = `Get tickets for ${ev.title}`;
if (dateStr) desc += ` on ${dateStr}`;
if (ev.city) desc += ` in ${ev.city}`;
if (ev.description) {
  let snippet = ev.description;
  if (snippet.length > 90) {
    snippet = snippet.substring(0, 90);
    const lastSpace = snippet.lastIndexOf(" ");
    if (lastSpace > 0) snippet = snippet.substring(0, lastSpace);
    snippet += "...";
  }
  desc += `. ${snippet}`;
} else {
  desc += ".";
}

let eventStatus = "https://schema.org/EventScheduled";
if (ev.status === "cancelled") eventStatus = "https://schema.org/EventCancelled";
else if (ev.postponed_at) eventStatus = "https://schema.org/EventPostponed";

const ld = {
  "@context": "https://schema.org",
  "@type": "Event",
  "name": ev.title,
  "description": desc,
  "startDate": ev.start_datetime,
  "endDate": ev.end_datetime || ev.start_datetime,
  "eventStatus": eventStatus,
  "location": {
    "@type": "Place",
    "name": ev.venue_name || ev.city || "TBD",
    "address": [ev.city, ev.state].filter(Boolean).join(", ") || "Nigeria"
  },
  "image": ev.cover_image_url ? [ev.cover_image_url] : [],
  "offers": {
    "@type": "Offer",
    "price": 5000,
    "priceCurrency": "NGN",
    "availability": "https://schema.org/InStock",
    "url": `https://www.tixnaija.name.ng/e/${ev.slug}`
  }
};
console.log(JSON.stringify(ld, null, 2));

console.log("\n=== SITEMAP.XML ===");
const now = new Date();
const activeEvents = events.filter(ev => {
  if (ev.status !== 'published') return false;
  const end = ev.end_datetime ? new Date(ev.end_datetime) : new Date(ev.start_datetime);
  return end >= now;
});
console.log(`Included Events: ${activeEvents.map(e => e.slug).join(", ")}`);
console.log(`Excluded Events: ${events.filter(e => !activeEvents.includes(e)).map(e => e.slug).join(", ")}`);
