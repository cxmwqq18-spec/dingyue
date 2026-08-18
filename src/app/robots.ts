import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { storefrontSitemapUrlForHost } from "@/lib/seo-indexing";

function normalizeHost(value: string | null | undefined): string {
  return String(value ?? "").split(",")[0]?.trim().toLowerCase().split(":")[0] ?? "";
}

function isGrownstrideHost(value: string | null | undefined): boolean {
  const host = normalizeHost(value);
  return host === "grownstride.com" || host === "www.grownstride.com" || host === "test.grownstride.com";
}

export default async function robots(): Promise<MetadataRoute.Robots> {
  const requestHeaders = await headers();
  const hostCandidates = [
    requestHeaders.get("x-forwarded-host"),
    requestHeaders.get("host")
  ];
  if (hostCandidates.some(isGrownstrideHost)) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/"
      }
    };
  }

  const sitemap = storefrontSitemapUrlForHost([
    ...hostCandidates
  ]);
  if (!sitemap) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/"
      }
    };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/"
    },
    ...(sitemap ? { sitemap } : {})
  };
}
