import type { MetadataRoute } from "next";
import { getStorefrontSitemapUrls } from "@/lib/seo-indexing";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const urls = await getStorefrontSitemapUrls();

  return urls.map((url) => ({
    url,
    lastModified: now,
    changeFrequency: url.endsWith("/blog/preparing-source-photos") ? "weekly" : "daily",
    priority: url === "https://www.mydreamshoots.com" ? 1 : 0.7
  }));
}
