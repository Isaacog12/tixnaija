// @ts-expect-error - Virtual module resolved by Vite plugin
import { createAPIFileRoute } from "@tanstack/react-start/api";
import { supabase } from "@/integrations/supabase/client";

export const APIRoute = createAPIFileRoute("/api/sitemap.xml")({
  GET: async ({ request }: { request: any }) => {
    const baseUrl = "https://www.tixnaija.name.ng";
    
    // Fetch all public events (slugs)
    const { data: events } = await supabase
      .from("events")
      .select("slug, updated_at")
      .eq("status", "published");

    const staticRoutes = [
      "/",
      "/about",
      "/how-it-works",
      "/faq",
      "/browse",
      "/contact",
      "/careers",
      "/terms",
      "/privacy",
    ];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

    // Add static routes
    staticRoutes.forEach((route) => {
      xml += `  <url>
    <loc>${baseUrl}${route}</loc>
    <changefreq>weekly</changefreq>
    <priority>${route === "/" ? "1.0" : "0.8"}</priority>
  </url>
`;
    });

    // Add dynamic event routes
    if (events) {
      events.forEach((event) => {
        // Fallback to current date if updated_at is null
        const lastMod = event.updated_at 
          ? new Date(event.updated_at).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];
          
        xml += `  <url>
    <loc>${baseUrl}/e/${event.slug}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
`;
      });
    }

    xml += `</urlset>`;

    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  },
});
