import type { Metadata } from "next";

import { isMydreamshootsVideoGenerationSlug, publicCollectionPathForSite, publicVideoGenerationPathForSite } from "@/lib/photo-package-taxonomy";
import type { StorefrontContext } from "@/lib/storefront-context/types";
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

function canonicalPath(value: string | undefined, fallback: string): string {
  const path = cleanText(value) || fallback || "/";
  if (/^https?:\/\//i.test(path)) return path;
  return path.startsWith("/") ? path : `/${path}`;
}

function canonicalPathForSite(site: Site, path: string): string {
  if (path === "/collections" || path === "/ai-image-generation") return publicCollectionPathForSite(site, "");
  if (path.startsWith("/collections/")) return publicCollectionPathForSite(site, path.slice("/collections/".length));
  if (path.startsWith("/ai-image-generation/")) return publicCollectionPathForSite(site, path.slice("/ai-image-generation/".length));
  const siteToken = `${site.id} ${site.slug} ${site.primaryDomain}`.toLowerCase();
  if (siteToken.includes("dreamshoot") && path === "/tools") return publicVideoGenerationPathForSite(site, "");
  if (siteToken.includes("dreamshoot") && path.startsWith("/tools/")) {
    const slug = path.slice("/tools/".length);
    if (isMydreamshootsVideoGenerationSlug(slug)) return publicVideoGenerationPathForSite(site, slug);
  }
  return path;
}

function robotsForPage(page: Pick<ThemePage, "slug" | "pageType">): { index: boolean; follow: boolean } {
  const blockedTypes = new Set(["account", "album", "cart", "job_detail", "job_progress", "login", "search", "workspace", "404"]);
  const blockedPrefixes = ["/account", "/admin", "/api", "/app", "/cart", "/dashboard", "/job", "/login", "/search"];
  const blocked = blockedTypes.has(page.pageType) || blockedPrefixes.some((prefix) => page.slug === prefix || page.slug.startsWith(`${prefix}/`));
  return { index: !blocked, follow: true };
}

function siteBaseUrl(site: Site): string {
  const domain = site.primaryDomain.trim();
  if (!domain) return `http://localhost:3002/site/${site.slug}`;
  if (/^https?:\/\//i.test(domain)) return domain.replace(/\/$/, "");
  if (/localhost|127\.0\.0\.1/i.test(domain)) return `http://${domain}`;
  return `https://${domain}`;
}

function absoluteUrl(site: Site, pathOrUrl: string | undefined): string | undefined {
  const value = cleanText(pathOrUrl);
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  return `${siteBaseUrl(site)}${value.startsWith("/") ? value : `/${value}`}`;
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

export function applyTitleTemplate(title: string, template: string, site: Site): string {
  const normalizedTitle = cleanText(title, brandName(site));
  const normalizedTemplate = cleanText(template, titleTemplate(site));
  if (!normalizedTemplate || normalizedTemplate === normalizedTitle) return normalizedTitle;
  if (!normalizedTemplate.includes("%s")) return `${normalizedTitle} | ${normalizedTemplate}`;
  const suffix = normalizedTemplate.replace("%s", "").replace(/^[\s|:-]+|[\s|:-]+$/g, "");
  if (suffix && normalizedTitle.toLowerCase().includes(suffix.toLowerCase())) return normalizedTitle;
  return normalizedTemplate.replace("%s", normalizedTitle);
}

export function metadataForThemePage(site: Site, page: ThemePage, resolved: StorefrontContext): Metadata {
  return metadataForSingleThemePage(site, page, resolved);
}

export function metadataForSingleThemePage(site: Site, page: ThemePage, context: StorefrontContext): Metadata {
  const seo = context.seo;
  const canonical = absoluteUrl(site, canonicalPathForSite(site, seo.canonicalPath)) ?? seo.canonicalUrl;
  const ogImage = absoluteUrl(site, seo.ogImage);
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
      images: ogImage ? [{ url: ogImage }] : undefined
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
