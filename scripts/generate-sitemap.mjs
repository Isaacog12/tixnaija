import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const BASE_URL = "https://tixnaija.com"; // Change to your actual production domain

async function generateSitemap() {
  console.log("Generating sitemap.xml...");
  
  // Base static pages
  const staticPages = [
    "/",
    "/browse",
    "/how-it-works",
    "/faq",
    "/contact",
    "/auth",
    "/terms",
    "/privacy"
  ];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  // Add static pages
  for (const page of staticPages) {
    xml += `  <url>\n`;
    xml += `    <loc>${BASE_URL}${page}</loc>\n`;
    xml += `    <changefreq>weekly</changefreq>\n`;
    xml += `    <priority>${page === "/" ? "1.0" : "0.8"}</priority>\n`;
    xml += `  </url>\n`;
  }

  // Fetch dynamic events
  const { data: events, error } = await supabase
    .from("events")
    .select("slug, updated_at")
    .eq("status", "published");

  if (error) {
    console.error("Error fetching events:", error);
  } else if (events) {
    for (const event of events) {
      xml += `  <url>\n`;
      xml += `    <loc>${BASE_URL}/e/${event.slug}</loc>\n`;
      xml += `    <lastmod>${new Date(event.updated_at || Date.now()).toISOString()}</lastmod>\n`;
      xml += `    <changefreq>daily</changefreq>\n`;
      xml += `    <priority>0.9</priority>\n`;
      xml += `  </url>\n`;
    }
  }

  xml += `</urlset>\n`;

  // Write to public/sitemap.xml
  const publicDir = path.resolve(process.cwd(), "public");
  fs.writeFileSync(path.join(publicDir, "sitemap.xml"), xml);
  
  console.log("sitemap.xml successfully created!");
}

generateSitemap();
