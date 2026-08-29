import { normalizeCanonicalPath } from "@/lib/storefront-context/seo-projection";
import type { Site } from "@/lib/types";

type PageTdk = {
  title: string;
  description: string;
  keywords?: string;
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function isPrimaryMydreamshoots(
  site: Pick<Site, "id" | "slug" | "primaryDomain">,
): boolean {
  return (
    site.id === "site_dreamshoot" ||
    site.slug.trim().toLowerCase() === "mydreamshoots" ||
    /(?:^|\.)mydreamshoots\.com$/i.test(site.primaryDomain)
  );
}

function topicForPath(path: string): string {
  if (path === "/") return "AI video and photo generation";
  return path
    .replace(/^\/+/, "")
    .split("/")
    .filter(Boolean)
    .map((segment) => segment.replace(/[-_]+/g, " "))
    .join(" ");
}

function titleForTopic(topic: string): string {
  return topic.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const pathOverrides: Record<string, Pick<PageTdk, "title" | "description">> = {
  "/blog/profile-cards-photo-package-guide": {
    title: "AI Profile Cards and Personal Brand Images Guide | myDreamshoots",
    description:
      "Plan AI profile cards, creator bios, social headers, and polished personal-brand images from source photos you own or have permission to use.",
  },
  "/holidays-events/wedding-anniversary": {
    title: "AI Wedding Anniversary Photos and Video Ideas | myDreamshoots",
    description:
      "Create private AI wedding anniversary photos and video concepts from approved couple images for milestone messages, albums, and celebration keepsakes.",
  },
  "/faq": {
    title: "myDreamshoots FAQ for Uploads, Credits, and Private Galleries",
    description:
      "Find myDreamshoots answers about source photos, package selection, credits, billing, privacy, refunds, and private gallery delivery.",
  },
  "/help": {
    title: "myDreamshoots Help Center Redirect",
    description:
      "This legacy help address redirects visitors to the current myDreamshoots FAQ for account, upload, credit, and gallery guidance.",
  },
  "/privacy-policy": {
    title: "myDreamshoots Privacy Policy Redirect",
    description:
      "This legacy privacy-policy address redirects to the current myDreamshoots privacy policy for uploads, accounts, and private galleries.",
  },
  "/policies/privacy": {
    title: "myDreamshoots Legacy Privacy Policy Address",
    description:
      "This former policy address redirects to the canonical myDreamshoots privacy policy.",
  },
  "/terms-of-service": {
    title: "myDreamshoots Terms of Service Redirect",
    description:
      "This legacy terms-of-service address redirects to the current myDreamshoots terms for accounts, credits, uploads, and private galleries.",
  },
  "/policies/terms": {
    title: "myDreamshoots Legacy Terms Policy Address",
    description:
      "This former policy address redirects to the canonical myDreamshoots terms of service.",
  },
  "/cookie-policy": {
    title: "myDreamshoots Cookie Policy Redirect",
    description:
      "This legacy cookie-policy address redirects to the current myDreamshoots cookie policy.",
  },
  "/policies/cookies": {
    title: "myDreamshoots Legacy Cookie Policy Address",
    description:
      "This former policy address redirects to the canonical myDreamshoots cookie policy.",
  },
};

/**
 * Keywords are deliberately route-derived. A shared site-default keyword list
 * makes unrelated landing pages indistinguishable in the rendered document.
 */
export function mydreamshootsKeywordsForPath(
  path: string,
  title: string,
  description = "",
): string {
  const canonicalPath = normalizeCanonicalPath(path);
  const topic = topicForPath(canonicalPath);
  const titleTopic = clean(title)
    .replace(/\|\s*mydreamshoots\b/i, "")
    .trim();
  const descriptionLead = clean(description).split(/[.!?]/, 1)[0];
  return [topic, titleTopic, descriptionLead, `myDreamshoots ${topic}`]
    .filter(Boolean)
    .join(", ");
}

export function resolveMydreamshootsPageTdk(
  site: Pick<Site, "id" | "slug" | "primaryDomain">,
  path: string,
  tdk: PageTdk,
): PageTdk {
  if (!isPrimaryMydreamshoots(site)) return tdk;
  const canonicalPath = normalizeCanonicalPath(path);
  const override = pathOverrides[canonicalPath];
  const topic = topicForPath(canonicalPath);
  const title =
    clean(tdk.title) || clean(override?.title) ||
    `${titleForTopic(topic)} | myDreamshoots`;
  const description =
    clean(tdk.description) || clean(override?.description) ||
    `Explore ${topic} with myDreamshoots AI photo and video tools.`;
  return {
    title,
    description,
    keywords: clean(tdk.keywords) || mydreamshootsKeywordsForPath(canonicalPath, title, description),
  };
}
