import type { Metadata } from "next";

import type { StorefrontContext } from "@/lib/storefront-context/types";
import { storefrontOrigin } from "@/lib/storefront-context/seo-projection";
import type { Site, ThemePage, ThemeSettings } from "@/lib/types";

function cleanText(value: string | undefined, fallback = ""): string {
  return (value ?? fallback).replace(/\s+/g, " ").trim();
}

function brandName(site: Pick<Site, "name" | "branding">): string {
  return cleanText(site.branding.logoText, site.name);
}

function titleTemplate(site: Site): string {
  return `%s | ${brandName(site)}`;
}

function pageTitle(site: Site, page: Pick<ThemePage, "title" | "pageType" | "slug">): string {
  if (page.slug === "/") return brandName(site);
  if (page.title) return page.title;
  return page.pageType
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function robotsForPage(page: Pick<ThemePage, "slug" | "pageType">): { index: boolean; follow: boolean } {
  const blockedTypes = new Set(["account", "album", "cart", "job_detail", "job_progress", "login", "search", "workspace", "404"]);
  const blockedPrefixes = ["/account", "/admin", "/api", "/app", "/cart", "/dashboard", "/job", "/login", "/search"];
  const blocked = blockedTypes.has(page.pageType) || blockedPrefixes.some((prefix) => page.slug === prefix || page.slug.startsWith(`${prefix}/`));
  return { index: !blocked, follow: true };
}

function absoluteUrl(site: Site, pathOrUrl: string | undefined): string | undefined {
  const value = cleanText(pathOrUrl);
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  return `${storefrontOrigin(site)}${value.startsWith("/") ? value : `/${value}`}`;
}

function settingText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function siteIcons(site: Site, settings: ThemeSettings): Metadata["icons"] | undefined {
  const icon = settingText((site.branding as { logoImageUrl?: string }).logoImageUrl)
    ?? settingText(settings.globalSections?.header?.settings.logoImageUrl)
    ?? settingText(settings.globalSections?.footer?.settings.logoImageUrl);
  return icon ? { icon, shortcut: icon, apple: icon } : undefined;
}

export type NormalizedThemeSeo = Omit<NonNullable<ThemeSettings["seo"]>, "pages">;

export function normalizeThemeSeo(site: Site, settings: ThemeSettings): NormalizedThemeSeo {
  const current = settings.seo;
  return {
    siteTitle: cleanText(current?.siteTitle, brandName(site)),
    siteDescription: cleanText(current?.siteDescription, site.branding.description),
    siteKeywords: cleanText(current?.siteKeywords),
    titleTemplate: cleanText(current?.titleTemplate, titleTemplate(site)),
    defaultOgImage: cleanText(current?.defaultOgImage),
    robots: {
      index: current?.robots?.index ?? true,
      follow: current?.robots?.follow ?? true
    }
  };
}

export function withNormalizedSeo(site: Site, settings: ThemeSettings): ThemeSettings {
  return { ...settings, seo: normalizeThemeSeo(site, settings) };
}

export function metadataForThemePage(site: Site, page: ThemePage, resolved: StorefrontContext): Metadata {
  return metadataForSingleThemePage(site, page, resolved);
}

export function metadataForSingleThemePage(site: Site, page: ThemePage, context: StorefrontContext): Metadata {
  const seo = context.seo;
  const canonical = seo.canonicalUrl;
  const ogImage = absoluteUrl(site, seo.ogImage);
  const articleSettings = page.publishedJson.sections?.blog_detail_1?.settings;
  const isArticle = page.slug.startsWith("/blog/") || page.pageType === "article";
  const articlePublishedTime = isArticle ? settingText(articleSettings?.publishedAt) : undefined;
  const articleModifiedTime = isArticle ? settingText(articleSettings?.updatedAt) : undefined;
  const articleImageAlt = isArticle ? settingText(articleSettings?.imageAlt) : undefined;
  return {
    title: seo.title,
    description: seo.description,
    keywords: seo.keywords || undefined,
    alternates: canonical ? { canonical } : undefined,
    robots: { index: seo.index, follow: seo.follow },
    openGraph: {
      title: seo.title,
      description: seo.description,
      url: canonical,
      siteName: cleanText(context.settings.seo?.siteTitle, brandName(site)),
      ...(isArticle ? { type: "article" as const } : {}),
      ...(articlePublishedTime ? { publishedTime: articlePublishedTime } : {}),
      ...(articleModifiedTime ? { modifiedTime: articleModifiedTime } : {}),
      images: ogImage ? [{ url: ogImage, ...(articleImageAlt ? { alt: articleImageAlt } : {}) }] : undefined
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title: seo.title,
      description: seo.description,
      images: ogImage ? [ogImage] : undefined
    },
    icons: siteIcons(site, context.settings),
    other: {
      "storefront-publication": context.revisions.publicationId ?? "unpublished",
      "storefront-facts-revision": context.revisions.factsRevision
    }
  };
}

export function slugPathForPage(page: Pick<ThemePage, "slug">): string {
  return page.slug === "/" ? "" : page.slug.replace(/^\/+/, "");
}
