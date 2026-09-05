import { createClient } from "@supabase/supabase-js";

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  // Use environment variables available in Vercel
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    return new Response("Missing Supabase configuration", { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Fetch only published events (or completed ones) that haven't ended yet?
  // Wait, the requirement: "once an event's startDate (or end_datetime) has passed, remove it from sitemap.xml entirely"
  // "Queries all events where status is published/active"
  
  const { data: events, error } = await supabase
    .from("events")
    .select("slug, start_datetime, end_datetime")
    .eq("status", "published");

  if (error) {
    return new Response(`Error fetching events: ${error.message}`, { status: 500 });
  }

  const now = new Date();
  
  // Filter out past events
  const activeEvents = events.filter((ev: any) => {
    const end = ev.end_datetime ? new Date(ev.end_datetime) : new Date(ev.start_datetime);
    return end >= now;
  });

  const baseUrl = "https://www.tixnaija.name.ng";

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Static Pages -->
  <url>
    <loc>${baseUrl}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/browse</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/how-it-works</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/faq</loc>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>${baseUrl}/about</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>${baseUrl}/terms</loc>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>${baseUrl}/privacy</loc>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>${baseUrl}/careers</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  
  <!-- Dynamic Event Pages -->
  ${activeEvents.map((ev: any) => `
  <url>
    <loc>${baseUrl}/e/${ev.slug}</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`).join("")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
