import { getStorefrontSitemapUrlsForHost } from "@/lib/seo-indexing";

export const dynamic = "force-dynamic";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function sitemapXml(urls: string[]): string {
  const now = new Date().toISOString();
  const entries = urls.map((url) => {
    const changeFrequency = url.endsWith("/blog/preparing-source-photos") ? "weekly" : "daily";
    const priority = new URL(url).pathname === "/" ? "1.0" : "0.7";
    return [
      "  <url>",
      `    <loc>${escapeXml(url)}</loc>`,
      `    <lastmod>${now}</lastmod>`,
      `    <changefreq>${changeFrequency}</changefreq>`,
      `    <priority>${priority}</priority>`,
      "  </url>"
    ].join("\n");
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    "</urlset>"
  ].join("\n");
}

export async function GET(request: Request): Promise<Response> {
  const host = request.headers.get("host");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const urls = await getStorefrontSitemapUrlsForHost([
    forwardedHost,
    host
  ]);

  return new Response(sitemapXml(urls), {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
      "vary": "Host, X-Forwarded-Host, RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Router-Segment-Prefetch",
      "x-sitemap-url-count": String(urls.length)
    }
  });
}
