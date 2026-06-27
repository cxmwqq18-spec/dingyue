import type { Metadata } from "next";
import type { Site, ThemePage, ThemeSettings } from "@/lib/types";
import { getMydreamshootsPolicySeo } from "@/lib/theme/policy-seo";

type PageSeo = NonNullable<ThemeSettings["seo"]>["pages"][string];
type PageJsonSeo = NonNullable<ThemePage["publishedJson"]["seo"]>;

function cleanText(value: string | undefined, fallback = ""): string {
  return (value ?? fallback).replace(/\s+/g, " ").trim();
}

function pickText(...values: Array<string | undefined>): string {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return "";
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

function defaultRobotsForPage(page: Pick<ThemePage, "slug" | "pageType">): { index: boolean; follow: boolean } {
  const slug = page.slug || "/";
  const blockedTypes = new Set(["account", "album", "cart", "job_detail", "job_progress", "login", "search", "workspace", "404"]);
  const blockedPrefixes = ["/account", "/admin", "/api", "/app", "/cart", "/dashboard", "/job", "/login", "/search"];
  const blocked = blockedTypes.has(page.pageType) || blockedPrefixes.some((prefix) => slug === prefix || slug.startsWith(`${prefix}/`));
  return { index: !blocked, follow: true };
}

function siteBaseUrl(site: Site): string {
  const domain = site.primaryDomain.trim();
  if (!domain) return `http://localhost:3000/site/${site.slug}`;
  if (domain.includes("localhost")) return `http://${domain}`;
  if (domain.startsWith("http://") || domain.startsWith("https://")) return domain;
  return `https://${domain}`;
}

function policySeoForSite(site: Site, slug: string) {
  const siteToken = `${site.id} ${site.slug} ${site.primaryDomain} ${site.name}`.toLowerCase();
  if (!siteToken.includes("mydreamshoots") && !siteToken.includes("dreamshoot")) return undefined;
  return getMydreamshootsPolicySeo(slug);
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
      const policySeo = policySeoForSite(site, page.slug);
      const jsonSeo = page.publishedJson.seo;
      const defaultRobots = defaultRobotsForPage(page);
      const title = pickText(jsonSeo?.title, policySeo?.title, existing?.title, pageFallbackTitle(site, page));
      const description = pickText(jsonSeo?.description, policySeo?.description, existing?.description, pageFallbackDescription(site, page));
      return [
        page.id,
        {
          title,
          description,
          keywords: pickText(jsonSeo?.keywords, policySeo?.keywords, existing?.keywords, current?.siteKeywords),
          ogImage: pickText(jsonSeo?.ogImage, existing?.ogImage),
          canonicalPath: normalizeCanonicalPath(pickText(jsonSeo?.canonical, jsonSeo?.canonicalPath, policySeo?.canonicalPath, existing?.canonicalPath), page.slug),
          index: jsonSeo?.robots?.index ?? jsonSeo?.index ?? policySeo?.index ?? existing?.index ?? (current?.robots?.index === false ? false : defaultRobots.index),
          follow: jsonSeo?.robots?.follow ?? jsonSeo?.follow ?? policySeo?.follow ?? existing?.follow ?? current?.robots?.follow ?? defaultRobots.follow
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
  const settingsPageSeo = seo.pages[page.id] ?? seo.pages[page.slug];
  const jsonSeo: PageJsonSeo | undefined = page.publishedJson.seo;
  const policySeo = policySeoForSite(site, page.slug);
  const fallbackPageSeo: PageSeo = settingsPageSeo ?? {
    title: pageFallbackTitle(site, page),
    description: pageFallbackDescription(site, page),
    keywords: seo.siteKeywords,
    canonicalPath: page.slug,
    index: defaultRobotsForPage(page).index,
    follow: defaultRobotsForPage(page).follow
  };
  const pageSeo: PageSeo = {
    title: pickText(jsonSeo?.title, policySeo?.title, fallbackPageSeo.title),
    description: pickText(jsonSeo?.description, policySeo?.description, fallbackPageSeo.description),
    keywords: pickText(jsonSeo?.keywords, policySeo?.keywords, fallbackPageSeo.keywords, seo.siteKeywords),
    ogImage: pickText(jsonSeo?.ogImage, fallbackPageSeo.ogImage, seo.defaultOgImage),
    canonicalPath: pickText(jsonSeo?.canonical, jsonSeo?.canonicalPath, policySeo?.canonicalPath, fallbackPageSeo.canonicalPath, page.slug),
    index: jsonSeo?.robots?.index ?? jsonSeo?.index ?? policySeo?.index ?? fallbackPageSeo.index ?? seo.robots.index,
    follow: jsonSeo?.robots?.follow ?? jsonSeo?.follow ?? policySeo?.follow ?? fallbackPageSeo.follow ?? seo.robots.follow
  };
  const defaultRobots = defaultRobotsForPage(page);
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
      index: defaultRobots.index ? pageSeo.index ?? seo.robots.index : false,
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

export function metadataForSingleThemePage(site: Site, page: ThemePage): Metadata {
  const settings = site.themeSettings.publishedJson;
  const currentSeo = settings.seo;
  const settingsPageSeo = currentSeo?.pages?.[page.id] ?? currentSeo?.pages?.[page.slug];
  const jsonSeo: PageJsonSeo | undefined = page.publishedJson.seo;
  const policySeo = policySeoForSite(site, page.slug);
  const defaultRobots = defaultRobotsForPage(page);
  const siteTitle = cleanText(currentSeo?.siteTitle, site.branding.logoText || site.name);
  const siteDescription = cleanText(currentSeo?.siteDescription, site.branding.description);
  const siteKeywords = cleanText(currentSeo?.siteKeywords);
  const titleTemplate = cleanText(currentSeo?.titleTemplate, defaultTitleTemplate(site));
  const defaultOgImage = cleanText(currentSeo?.defaultOgImage);
  const fallbackPageSeo: PageSeo = settingsPageSeo ?? {
    title: pageFallbackTitle(site, page),
    description: pageFallbackDescription(site, page),
    keywords: siteKeywords,
    canonicalPath: page.slug,
    index: defaultRobots.index,
    follow: defaultRobots.follow
  };
  const pageSeo: PageSeo = {
    title: pickText(jsonSeo?.title, policySeo?.title, fallbackPageSeo.title),
    description: pickText(jsonSeo?.description, policySeo?.description, fallbackPageSeo.description),
    keywords: pickText(jsonSeo?.keywords, policySeo?.keywords, fallbackPageSeo.keywords, siteKeywords),
    ogImage: pickText(jsonSeo?.ogImage, fallbackPageSeo.ogImage, defaultOgImage),
    canonicalPath: pickText(jsonSeo?.canonical, jsonSeo?.canonicalPath, policySeo?.canonicalPath, fallbackPageSeo.canonicalPath, page.slug),
    index: jsonSeo?.robots?.index ?? jsonSeo?.index ?? policySeo?.index ?? fallbackPageSeo.index ?? currentSeo?.robots?.index ?? true,
    follow: jsonSeo?.robots?.follow ?? jsonSeo?.follow ?? policySeo?.follow ?? fallbackPageSeo.follow ?? currentSeo?.robots?.follow ?? true
  };
  const title = applyTitleTemplate(pageSeo.title || siteTitle, titleTemplate, site);
  const description = cleanText(pageSeo.description, siteDescription);
  const keywords = cleanText(pageSeo.keywords, siteKeywords);
  const canonicalPath = normalizeCanonicalPath(pageSeo.canonicalPath, page.slug);
  const canonical = absoluteUrl(site, canonicalPath);
  const ogImage = absoluteUrl(site, pageSeo.ogImage || defaultOgImage);

  return {
    title,
    description,
    keywords: keywords ? keywords.split(",").map((keyword) => keyword.trim()).filter(Boolean) : undefined,
    alternates: canonical ? { canonical } : undefined,
    robots: {
      index: defaultRobots.index ? pageSeo.index ?? currentSeo?.robots?.index ?? true : false,
      follow: pageSeo.follow ?? currentSeo?.robots?.follow ?? true
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: siteTitle,
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
