import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/api/sitemap/xml")({
  server: {
    handlers: {
      GET: async () => {
        const baseUrl = "https://www.tixnaija.name.ng";
        
        // Fetch active published events
        const { data: events } = await supabase
          .from("events")
          .select("slug, start_datetime, end_datetime, updated_at")
          .eq("status", "published");

        const now = new Date();
        const activeEvents = (events || []).filter((ev: any) => {
          const end = ev.end_datetime ? new Date(ev.end_datetime) : new Date(ev.start_datetime);
          return end >= now;
        });

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

        // Add dynamic active event routes
        activeEvents.forEach((event: any) => {
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

        xml += `</urlset>`;

        return new Response(xml, {
          status: 200,
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600, s-maxage=3600",
          },
        });
      },
    },
  },
});
