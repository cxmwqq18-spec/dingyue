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
        "/search"
      ]
    },
    sitemap: MYDREAMSHOOTS_SITEMAP_URL
  };
}
