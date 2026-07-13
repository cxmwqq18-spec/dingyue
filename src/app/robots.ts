import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { storefrontSitemapUrlForHost } from "@/lib/seo-indexing";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const requestHeaders = await headers();
  const sitemap = storefrontSitemapUrlForHost([
    requestHeaders.get("x-forwarded-host"),
    requestHeaders.get("host")
  ]);
  return {
    rules: {
      userAgent: "*",
      allow: "/"
    },
    ...(sitemap ? { sitemap } : {})
  };
}
