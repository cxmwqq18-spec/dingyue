import type { MetadataRoute } from "next";
import { MYDREAMSHOOTS_SITEMAP_URL } from "@/lib/seo-indexing";

export default function robots(): MetadataRoute.Robots {
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
    sitemap: MYDREAMSHOOTS_SITEMAP_URL
  };
}
