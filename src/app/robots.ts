import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { storefrontSitemapUrlForHost } from "@/lib/seo-indexing";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const requestHeaders = await headers();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api",
        "/app",
        "/account",
        "/cart",
        "/dashboard",
        "/job",
        "/login",
        "/search",
        "/site/*/admin",
        "/site/*/admin/*",
        "/site/*/app",
        "/site/*/app/*",
        "/site/*/account",
        "/site/*/cart",
        "/site/*/cart/*",
        "/site/*/checkout",
        "/site/*/checkout/*",
        "/site/*/dashboard",
        "/site/*/job",
        "/site/*/job/*",
        "/site/*/login",
        "/site/*/search"
      ]
    },
    sitemap: storefrontSitemapUrlForHost([
      requestHeaders.get("x-forwarded-host"),
      requestHeaders.get("host")
    ])
  };
}
