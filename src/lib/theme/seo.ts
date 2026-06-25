import type { Metadata } from "next";
import type { Site, ThemePage, ThemeSettings } from "@/lib/types";

type PageSeo = NonNullable<ThemeSettings["seo"]>["pages"][string];

function cleanText(value: string | undefined, fallback = ""): string {
  return (value ?? fallback).replace(/\s+/g, " ").trim();
}

function stripHomeSlug(slug: string): string {
  return slug === "/" ? "" : slug.replace(/^\/+/, "");
}

function normalizeTitleToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function defaultTitleTemplate(site: Site): string {
  return `%s | ${site.branding.logoText || site.name}`;
}

function pageFallbackTitle(site: Site, page: Pick<ThemePage, "title" | "pageType" | "slug">): string {
  if (page.slug === "/") return site.branding.logoText || site.name;
  if (page.title) return page.title;
  return page.pageType
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function pageFallbackDescription(site: Site, page: Pick<ThemePage, "title" | "slug">): string {
  if (page.slug === "/") return site.branding.description;
  return `${page.title || site.branding.logoText} on ${site.branding.logoText || site.name}.`;
}

function normalizeCanonicalPath(value: string | undefined, fallbackSlug: string): string {
  const trimmed = cleanText(value);
  if (!trimmed) return fallbackSlug || "/";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("/")) return trimmed;
  return `/${trimmed}`;
}

function siteBaseUrl(site: Site): string {
  const domain = site.primaryDomain.trim();
  if (!domain) return `http://localhost:3000/site/${site.slug}`;
  if (domain.includes("localhost")) return `http://${domain}`;
  if (domain.startsWith("http://") || domain.startsWith("https://")) return domain;
  return `https://${domain}`;
}

function absoluteUrl(site: Site, pathOrUrl: string | undefined): string | undefined {
  const value = cleanText(pathOrUrl);
  if (!value) return undefined;
  const optimizedValue = preferOptimizedShareImage(value);
  if (optimizedValue.startsWith("http://") || optimizedValue.startsWith("https://")) return optimizedValue;
  const base = siteBaseUrl(site).replace(/\/$/, "");
  return `${base}${optimizedValue.startsWith("/") ? optimizedValue : `/${optimizedValue}`}`;
}

function preferOptimizedShareImage(pathOrUrl: string): string {
  return pathOrUrl.replace(/(\/assets\/dreamshoot\/[^?#]+)\.png([?#].*)?$/i, (_match, path, suffix = "") => `${path}.webp${suffix}`);
}

export function normalizeThemeSeo(site: Site, settings: ThemeSettings): NonNullable<ThemeSettings["seo"]> {
  const current = settings.seo;
  const pages = Object.fromEntries(
    site.pages.map((page) => {
      const existing = current?.pages?.[page.id] ?? current?.pages?.[page.slug];
      const title = cleanText(existing?.title, pageFallbackTitle(site, page));
      const description = cleanText(existing?.description, pageFallbackDescription(site, page));
      return [
        page.id,
        {
          title,
          description,
          keywords: cleanText(existing?.keywords, current?.siteKeywords),
          ogImage: cleanText(existing?.ogImage),
          canonicalPath: normalizeCanonicalPath(existing?.canonicalPath, page.slug),
          index: existing?.index ?? current?.robots?.index ?? true,
          follow: existing?.follow ?? current?.robots?.follow ?? true
        }
      ];
    })
  );

  return {
    siteTitle: cleanText(current?.siteTitle, site.branding.logoText || site.name),
    siteDescription: cleanText(current?.siteDescription, site.branding.description),
    siteKeywords: cleanText(current?.siteKeywords),
    titleTemplate: cleanText(current?.titleTemplate, defaultTitleTemplate(site)),
    defaultOgImage: cleanText(current?.defaultOgImage),
    robots: {
      index: current?.robots?.index ?? true,
      follow: current?.robots?.follow ?? true
    },
    pages
  };
}

export function withNormalizedSeo(site: Site, settings: ThemeSettings): ThemeSettings {
  return {
    ...settings,
    seo: normalizeThemeSeo(site, settings)
  };
}

export function applyTitleTemplate(title: string, template: string, site: Site): string {
  const cleanTitle = cleanText(title, site.branding.logoText || site.name);
  const cleanTemplate = cleanText(template, defaultTitleTemplate(site));
  const suffix = cleanTemplate.replace("%s", "").replace(/^[\s|:–-]+|[\s|:–-]+$/g, "");
  if (normalizeTitleToken(cleanTitle) === normalizeTitleToken(suffix)) return cleanTitle;
  if (cleanTemplate.includes("%s")) return cleanTemplate.replace("%s", cleanTitle);
  return cleanTitle === cleanTemplate ? cleanTitle : `${cleanTitle} | ${cleanTemplate}`;
}

export function metadataForThemePage(site: Site, page: ThemePage): Metadata {
  const settings = site.themeSettings.publishedJson;
  const seo = normalizeThemeSeo(site, settings);
  const pageSeo: PageSeo = seo.pages[page.id] ?? {
    title: pageFallbackTitle(site, page),
    description: pageFallbackDescription(site, page),
    keywords: seo.siteKeywords,
    canonicalPath: page.slug,
    index: seo.robots.index,
    follow: seo.robots.follow
  };
  const title = applyTitleTemplate(pageSeo.title || seo.siteTitle, seo.titleTemplate, site);
  const description = cleanText(pageSeo.description, seo.siteDescription);
  const keywords = cleanText(pageSeo.keywords, seo.siteKeywords);
  const canonicalPath = normalizeCanonicalPath(pageSeo.canonicalPath, page.slug);
  const canonical = absoluteUrl(site, canonicalPath);
  const ogImage = absoluteUrl(site, pageSeo.ogImage || seo.defaultOgImage);

  return {
    title,
    description,
    keywords: keywords ? keywords.split(",").map((keyword) => keyword.trim()).filter(Boolean) : undefined,
    alternates: canonical ? { canonical } : undefined,
    robots: {
      index: pageSeo.index ?? seo.robots.index,
      follow: pageSeo.follow ?? seo.robots.follow
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: seo.siteTitle,
      images: ogImage ? [{ url: ogImage }] : undefined
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title,
      description,
      images: ogImage ? [ogImage] : undefined
    }
  };
}

export function slugPathForPage(page: Pick<ThemePage, "slug">): string {
  return stripHomeSlug(page.slug);
}
