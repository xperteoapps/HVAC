// sitemap.xml generowany z kategorii, produktów i stron statycznych.
// Publiczny endpoint (verify_jwt = false). Front/hosting może proxy'ować /sitemap.xml na ten URL.
import { createAdminClient } from "../_shared/supabase.ts";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";

interface SlugRow {
  slug: string;
  updated_at: string;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  const base = (Deno.env.get("SHOP_URL") ?? new URL(req.url).origin).replace(/\/$/, "");
  const admin = createAdminClient();

  const [{ data: categories }, { data: products }, { data: pages }] = await Promise.all([
    admin.from("categories").select("slug, updated_at"),
    admin.from("products").select("slug, updated_at").eq("status", "active"),
    admin.from("static_pages").select("slug, updated_at").eq("published", true),
  ]);

  const urls: Array<{ loc: string; lastmod?: string; priority: string }> = [{ loc: `${base}/`, priority: "1.0" }];
  for (const c of (categories ?? []) as SlugRow[]) urls.push({ loc: `${base}/kategoria/${c.slug}`, lastmod: c.updated_at, priority: "0.8" });
  for (const p of (products ?? []) as SlugRow[]) urls.push({ loc: `${base}/produkt/${p.slug}`, lastmod: p.updated_at, priority: "0.6" });
  for (const s of (pages ?? []) as SlugRow[]) urls.push({ loc: `${base}/strona/${s.slug}`, lastmod: s.updated_at, priority: "0.3" });
  urls.push({ loc: `${base}/b2b`, priority: "0.5" });

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(
        (u) =>
          `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod.slice(0, 10)}</lastmod>` : ""}<priority>${u.priority}</priority></url>`,
      )
      .join("\n") +
    `\n</urlset>\n`;

  return new Response(xml, {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
});
