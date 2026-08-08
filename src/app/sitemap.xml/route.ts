import { getStorefrontSitemapEntriesForHost } from "@/lib/seo-indexing";

export const dynamic = "force-dynamic";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function sitemapXml(entries: Array<{ loc: string; images: Array<{ loc: string; title?: string; caption?: string }> }>): string {
  const now = new Date().toISOString();
  const urlEntries = entries.map((entry) => {
    const changeFrequency = entry.loc.endsWith("/blog/preparing-source-photos") ? "weekly" : "daily";
    const priority = new URL(entry.loc).pathname === "/" ? "1.0" : "0.7";
    const imageEntries = entry.images.map((image) => [
      "    <image:image>",
      `      <image:loc>${escapeXml(image.loc)}</image:loc>`,
      ...(image.title ? [`      <image:title>${escapeXml(image.title)}</image:title>`] : []),
      ...(image.caption ? [`      <image:caption>${escapeXml(image.caption)}</image:caption>`] : []),
      "    </image:image>"
    ].join("\n"));
    return [
      "  <url>",
      `    <loc>${escapeXml(entry.loc)}</loc>`,
      `    <lastmod>${now}</lastmod>`,
      `    <changefreq>${changeFrequency}</changefreq>`,
      `    <priority>${priority}</priority>`,
      ...imageEntries,
      "  </url>"
    ].join("\n");
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...urlEntries,
    "</urlset>"
  ].join("\n");
}

function isGrownstrideHost(value: string | null | undefined): boolean {
  const host = String(value ?? "").split(",")[0]?.trim().toLowerCase().split(":")[0] ?? "";
  return host === "grownstride.com" || host === "www.grownstride.com" || host === "test.grownstride.com";
}

export async function GET(request: Request): Promise<Response> {
  const host = request.headers.get("host");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const entries = await getStorefrontSitemapEntriesForHost([
    forwardedHost,
    host
  ]);
  const urlCount = entries.length;
  const imageCount = entries.reduce((total, entry) => total + entry.images.length, 0);

  return new Response(sitemapXml(entries), {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
      "vary": "Host, X-Forwarded-Host, RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Router-Segment-Prefetch",
      "x-sitemap-url-count": String(urlCount),
      "x-sitemap-image-count": String(imageCount),
      ...(isGrownstrideHost(forwardedHost) || isGrownstrideHost(host)
        ? { "x-robots-tag": "noindex, nofollow" }
        : {})
    }
  });
}
