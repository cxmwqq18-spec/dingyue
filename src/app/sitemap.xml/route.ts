import { getStorefrontSitemapPayloadForHost } from "@/lib/seo-indexing";

export const dynamic = "force-dynamic";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function sitemapXml(entries: Array<{
  loc: string;
  images: Array<{ loc: string; title?: string; caption?: string }>;
  video?: {
    thumbnailLoc: string;
    title: string;
    description: string;
    contentLoc: string;
    publicationDate?: string;
    duration?: string;
  };
  lastmod?: string;
  changefreq?: string;
  priority?: string;
}>): string {
  const urlEntries = entries.map((entry) => {
    const imageEntries = entry.images.map((image) => [
      "    <image:image>",
      `      <image:loc>${escapeXml(image.loc)}</image:loc>`,
      ...(image.title ? [`      <image:title>${escapeXml(image.title)}</image:title>`] : []),
      ...(image.caption ? [`      <image:caption>${escapeXml(image.caption)}</image:caption>`] : []),
      "    </image:image>"
    ].join("\n"));
    const videoEntries = entry.video ? [
      "    <video:video>",
      `      <video:thumbnail_loc>${escapeXml(entry.video.thumbnailLoc)}</video:thumbnail_loc>`,
      `      <video:title>${escapeXml(entry.video.title)}</video:title>`,
      `      <video:description>${escapeXml(entry.video.description)}</video:description>`,
      `      <video:content_loc>${escapeXml(entry.video.contentLoc)}</video:content_loc>`,
      ...(entry.video.publicationDate ? [`      <video:publication_date>${escapeXml(entry.video.publicationDate)}</video:publication_date>`] : []),
      ...(entry.video.duration ? [`      <video:duration>${escapeXml(entry.video.duration)}</video:duration>`] : []),
      "    </video:video>"
    ].join("\n") : "";
    return [
      "  <url>",
      `    <loc>${escapeXml(entry.loc)}</loc>`,
      ...(entry.lastmod ? [`    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`] : []),
      ...(entry.changefreq ? [`    <changefreq>${escapeXml(entry.changefreq)}</changefreq>`] : []),
      ...(entry.priority ? [`    <priority>${escapeXml(entry.priority)}</priority>`] : []),
      ...imageEntries,
      ...(videoEntries ? [videoEntries] : []),
      "  </url>"
    ].join("\n");
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">',
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
  const { entries } = await getStorefrontSitemapPayloadForHost([forwardedHost, host]);

  return new Response(sitemapXml(entries), {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "vary": "Host, X-Forwarded-Host, RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Router-Segment-Prefetch",
      ...(isGrownstrideHost(forwardedHost) || isGrownstrideHost(host)
        ? { "x-robots-tag": "noindex, nofollow" }
        : {})
    }
  });
}

export async function HEAD(request: Request): Promise<Response> {
  const response = await GET(request);
  return new Response(null, { status: response.status, headers: response.headers });
}
