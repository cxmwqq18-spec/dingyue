import type { Metadata } from "next";
import type { Site, ThemePage, ThemeSettings } from "@/lib/types";
import { getAidreamcapesPolicySeo, getMydreamshootsPolicySeo } from "@/lib/theme/policy-seo";

type PageSeo = NonNullable<ThemeSettings["seo"]>["pages"][string];
type PageJsonSeo = NonNullable<ThemePage["publishedJson"]["seo"]>;
const myDreamShootsSeoName = "MyDreamShoots";
const myDreamShootsBrandPattern = /(?:myᕲreamshoots|ʍʏƉʀɛǟʍֆhoots|MyÐreãm\$hoots)/g;

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

function pickSettingText(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function stripHomeSlug(slug: string): string {
  return slug === "/" ? "" : slug.replace(/^\/+/, "");
}

function normalizeTitleToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function storefrontSeoBrandName(site: Pick<Site, "id" | "slug" | "name" | "primaryDomain" | "branding">): string {
  const token = `${site.id} ${site.slug} ${site.name} ${site.primaryDomain} ${site.branding.logoText ?? ""}`.toLowerCase();
  if (token.includes("aidreamcapes")) return "Aidreamcapes";
  if (token.includes("mydreamshoots") || token.includes("dreamshoot")) return myDreamShootsSeoName;
  return site.branding.logoText || site.name;
}

function normalizeStorefrontBrandText(site: Site, value: string | undefined, fallback = ""): string {
  const brandName = storefrontSeoBrandName(site);
  return cleanText(value, fallback)
    .replace(myDreamShootsBrandPattern, brandName)
    .replace(/\bMyDreamShoots\b/g, brandName)
    .replace(/\bMydreamShoots\b/g, brandName)
    .replace(/\bMydreamshoots\b/g, brandName)
    .replace(/\bDreamShootAI\b/g, brandName);
}

function defaultTitleTemplate(site: Site): string {
  return `%s | ${storefrontSeoBrandName(site)}`;
}

function pageFallbackTitle(site: Site, page: Pick<ThemePage, "title" | "pageType" | "slug">): string {
  if (page.slug === "/") return storefrontSeoBrandName(site);
  if (page.title) return page.title;
  return page.pageType
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function pageFallbackDescription(site: Site, page: Pick<ThemePage, "title" | "slug">): string {
  if (page.slug === "/") return site.branding.description;
  return `${page.title || storefrontSeoBrandName(site)} on ${storefrontSeoBrandName(site)}.`;
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
  if (siteToken.includes("aidreamcapes")) return getAidreamcapesPolicySeo(slug);
  if (!siteToken.includes("mydreamshoots") && !siteToken.includes("dreamshoot")) return undefined;
  return getMydreamshootsPolicySeo(slug);
}

function isAidreamcapesSeoSite(site: Site): boolean {
  return `${site.id} ${site.slug} ${site.primaryDomain} ${site.name} ${site.branding.logoText}`.toLowerCase().includes("aidreamcapes");
}

function knownStorefrontSeoOverride(site: Site, slug: string): Partial<PageSeo> | undefined {
  const aidreamcapes = isAidreamcapesSeoSite(site);
  if (aidreamcapes) {
    const overrides: Record<string, Partial<PageSeo>> = {
      "/about-us": {
        title: "About Aidreamcapes",
        description: "Learn how Aidreamcapes turns private uploads into cinematic portraits, visible credit workflows, and customer-only galleries."
      },
      "/tools": {
        title: "Aidreamcapes AI Tools - route portraits and scenic travel builders",
        description: "Explore Aidreamcapes tools for route portraits, coastal light scenes, alpine trail frames, old quarter walks, route moodboards, and private travel gallery delivery."
      },
      "/terms": {
        title: "Aidreamcapes Terms of Service",
        description: "Review Aidreamcapes account, credit, upload, checkout, generation, private gallery, refund, and acceptable-use terms."
      },
      "/policies/terms": {
        title: "Aidreamcapes Terms of Service",
        description: "Review Aidreamcapes account, credit, upload, checkout, generation, private gallery, refund, and acceptable-use terms.",
        canonicalPath: "/terms"
      }
    };
    return overrides[slug];
  }
  const overrides: Record<string, Partial<PageSeo>> = {
    "/collections": {
      title: "Browse private AI photo packages | MyDreamShoots",
      description: "Browse MyDreamShoots packages for headshots, fan photos, creator portraits, beauty looks, AI shoot packages, and cinematic private albums with visible credit costs."
    },
    "/collections/headshots": {
      title: "AI Headshot Generator for LinkedIn, Resumes & Team Photos | MyDreamShoots",
      description: "Create work-ready AI headshots for LinkedIn, resumes, founder bios, speaker pages, and team profiles with private uploads and visible credit costs."
    },
    "/collections/world-cup-fan-photos": {
      title: "AI World Cup Fan Photos & Match-Day Posters | MyDreamShoots",
      description: "Create personal AI World Cup fan photos, match-day posters, and profile avatars from your own selfies for private fan use."
    },
    "/collections/boudoir": {
      title: "Private AI Boudoir Photo Package | MyDreamShoots",
      description: "Create private boudoir-inspired AI portraits for adult, consensual use from photos you own or have permission to use."
    },
    "/pricing": {
      title: "MyDreamShoots Pricing | Credits for Private AI Photo Packages",
      description: "Compare MyDreamShoots plans and credit packs for private AI photo packages, source-photo uploads, generation requests, secure checkout, and private gallery delivery."
    },
    "/tools": {
      title: "AI Photo Tools with Free Previews | Background, Headshots & Try-ons | MyDreamShoots",
      description: "Explore MyDreamShoots tools for headshots, background edits, video clips, try-on previews, private uploads, visible credits, and private albums."
    },
    "/help": {
      title: "MyDreamShoots Help Center",
      description: "Get help with source photos, package selection, credits, billing, refunds, privacy, cookies, and private album delivery."
    }
  };
  return overrides[slug];
}

function absoluteUrl(site: Site, pathOrUrl: string | undefined): string | undefined {
  const value = cleanText(pathOrUrl);
  if (!value) return undefined;
  let optimizedValue = preferOptimizedShareImage(value);
  if (optimizedValue.startsWith("http://") || optimizedValue.startsWith("https://")) {
    try {
      const url = new URL(optimizedValue);
      if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname)) return optimizedValue;
      optimizedValue = `${url.pathname}${url.search}`;
    } catch {
      return optimizedValue;
    }
  }
  const base = siteBaseUrl(site).replace(/\/$/, "");
  return `${base}${optimizedValue.startsWith("/") ? optimizedValue : `/${optimizedValue}`}`;
}

function localAssetUrl(pathOrUrl: string | undefined): string | undefined {
  const value = cleanText(pathOrUrl);
  if (!value) return undefined;
  let normalized = value;
  try {
    if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
      const url = new URL(normalized);
      normalized = `${url.pathname}${url.search}`;
    }
  } catch {
    return undefined;
  }
  if (normalized.includes("/assets/dreamshoot/brand/aidreamcapesai-logo-refined.svg")) {
    return "/assets/sites/site_aidreamcapes/brand/aidreamcapesai-logo-refined.svg?v=20260630a";
  }
  if (normalized.includes("/assets/sites/site_aidreamcapes/brand/aidreamcapes-wordmark.svg")) {
    return "/assets/sites/site_aidreamcapes/brand/aidreamcapesai-logo-refined.svg?v=20260630a";
  }
  if (!normalized.startsWith("/")) normalized = `/${normalized}`;
  return normalized;
}

function siteIconUrl(site: Site): string | undefined {
  const settings = site.themeSettings?.publishedJson;
  const headerLogo = pickSettingText(settings?.globalSections?.header?.settings?.logoImageUrl);
  const footerLogo = pickSettingText(settings?.globalSections?.footer?.settings?.logoImageUrl);
  const brandingLogo = (site.branding as { logoImageUrl?: string }).logoImageUrl;
  return localAssetUrl(pickText(headerLogo, brandingLogo, footerLogo));
}

function siteIcons(site: Site): Metadata["icons"] | undefined {
  const slug = site.slug.toLowerCase();
  if (slug.includes("aidreamcapes")) {
    return {
      icon: [
        { url: "/assets/sites/site_aidreamcapes/brand/aidreamcapes-icon-192.png?v=20260702", type: "image/png", sizes: "192x192" },
        { url: "/assets/sites/site_aidreamcapes/brand/aidreamcapesai-logo-refined.svg?v=20260702", type: "image/svg+xml" }
      ],
      shortcut: "/assets/sites/site_aidreamcapes/brand/aidreamcapes-icon-192.png?v=20260702",
      apple: [{ url: "/assets/sites/site_aidreamcapes/brand/aidreamcapes-icon-180.png?v=20260702", sizes: "180x180", type: "image/png" }]
    };
  }
  if (slug.includes("mydreamshoots")) {
    return {
      icon: [
        { url: "/assets/dreamshoot/brand/dreamshootai-icon-192.png?v=20260702", type: "image/png", sizes: "192x192" },
        { url: "/assets/dreamshoot/brand/dreamshootai-logo-refined.svg?v=20260702", type: "image/svg+xml" }
      ],
      shortcut: "/assets/dreamshoot/brand/dreamshootai-icon-192.png?v=20260702",
      apple: [{ url: "/assets/dreamshoot/brand/dreamshootai-icon-180.png?v=20260702", sizes: "180x180", type: "image/png" }]
    };
  }

  const icon = siteIconUrl(site);
  return icon ? { icon, shortcut: icon, apple: icon } : undefined;
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
      const knownSeo = knownStorefrontSeoOverride(site, page.slug);
      const jsonSeo = page.publishedJson.seo;
      const defaultRobots = defaultRobotsForPage(page);
      const title = normalizeStorefrontBrandText(site, pickText(knownSeo?.title, jsonSeo?.title, policySeo?.title, existing?.title, pageFallbackTitle(site, page)));
      const description = normalizeStorefrontBrandText(site, pickText(knownSeo?.description, jsonSeo?.description, policySeo?.description, existing?.description, pageFallbackDescription(site, page)));
      return [
        page.id,
        {
          title,
          description,
          keywords: pickText(knownSeo?.keywords, jsonSeo?.keywords, policySeo?.keywords, existing?.keywords, current?.siteKeywords),
          ogImage: pickText(jsonSeo?.ogImage, existing?.ogImage),
          canonicalPath: normalizeCanonicalPath(pickText(knownSeo?.canonicalPath, policySeo?.canonicalPath, jsonSeo?.canonical, jsonSeo?.canonicalPath, existing?.canonicalPath), page.slug),
          index: jsonSeo?.robots?.index ?? jsonSeo?.index ?? policySeo?.index ?? existing?.index ?? (current?.robots?.index === false ? false : defaultRobots.index),
          follow: jsonSeo?.robots?.follow ?? jsonSeo?.follow ?? policySeo?.follow ?? existing?.follow ?? current?.robots?.follow ?? defaultRobots.follow
        }
      ];
    })
  );

  return {
    siteTitle: normalizeStorefrontBrandText(site, current?.siteTitle, storefrontSeoBrandName(site)),
    siteDescription: normalizeStorefrontBrandText(site, current?.siteDescription, site.branding.description),
    siteKeywords: cleanText(current?.siteKeywords),
    titleTemplate: normalizeStorefrontBrandText(site, current?.titleTemplate, defaultTitleTemplate(site)),
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
  const cleanTitle = cleanText(title, storefrontSeoBrandName(site));
  const cleanTemplate = normalizeStorefrontBrandText(site, template, defaultTitleTemplate(site));
  const suffix = cleanTemplate.replace("%s", "").replace(/^[\s|:–-]+|[\s|:–-]+$/g, "");
  if (normalizeTitleToken(cleanTitle) === normalizeTitleToken(suffix)) return cleanTitle;
  if (suffix && normalizeTitleToken(cleanTitle).includes(normalizeTitleToken(suffix))) return cleanTitle;
  if (suffix && normalizeTitleToken(cleanTitle).endsWith(` | ${normalizeTitleToken(suffix)}`)) return cleanTitle;
  if (cleanTemplate.includes("%s")) return cleanTemplate.replace("%s", cleanTitle);
  return cleanTitle === cleanTemplate ? cleanTitle : `${cleanTitle} | ${cleanTemplate}`;
}

export function metadataForThemePage(site: Site, page: ThemePage): Metadata {
  const settings = site.themeSettings.publishedJson;
  const seo = normalizeThemeSeo(site, settings);
  const settingsPageSeo = seo.pages[page.id] ?? seo.pages[page.slug];
  const jsonSeo: PageJsonSeo | undefined = page.publishedJson.seo;
  const policySeo = policySeoForSite(site, page.slug);
  const knownSeo = knownStorefrontSeoOverride(site, page.slug);
  const fallbackPageSeo: PageSeo = settingsPageSeo ?? {
    title: pageFallbackTitle(site, page),
    description: pageFallbackDescription(site, page),
    keywords: seo.siteKeywords,
    canonicalPath: page.slug,
    index: defaultRobotsForPage(page).index,
    follow: defaultRobotsForPage(page).follow
  };
  const pageSeo: PageSeo = {
    title: pickText(knownSeo?.title, jsonSeo?.title, policySeo?.title, fallbackPageSeo.title),
    description: pickText(knownSeo?.description, jsonSeo?.description, policySeo?.description, fallbackPageSeo.description),
    keywords: pickText(knownSeo?.keywords, jsonSeo?.keywords, policySeo?.keywords, fallbackPageSeo.keywords, seo.siteKeywords),
    ogImage: pickText(jsonSeo?.ogImage, fallbackPageSeo.ogImage, seo.defaultOgImage),
    canonicalPath: pickText(knownSeo?.canonicalPath, policySeo?.canonicalPath, jsonSeo?.canonical, jsonSeo?.canonicalPath, fallbackPageSeo.canonicalPath, page.slug),
    index: jsonSeo?.robots?.index ?? jsonSeo?.index ?? policySeo?.index ?? fallbackPageSeo.index ?? seo.robots.index,
    follow: jsonSeo?.robots?.follow ?? jsonSeo?.follow ?? policySeo?.follow ?? fallbackPageSeo.follow ?? seo.robots.follow
  };
  const defaultRobots = defaultRobotsForPage(page);
  const title = applyTitleTemplate(normalizeStorefrontBrandText(site, pageSeo.title || seo.siteTitle), seo.titleTemplate, site);
  const description = normalizeStorefrontBrandText(site, pageSeo.description, seo.siteDescription);
  const canonicalPath = normalizeCanonicalPath(pageSeo.canonicalPath, page.slug);
  const canonical = absoluteUrl(site, canonicalPath);
  const ogImage = absoluteUrl(site, pageSeo.ogImage || seo.defaultOgImage);
  const icons = siteIcons(site);

  return {
    title,
    description,
    keywords: cleanText(pageSeo.keywords) || undefined,
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
    },
    icons
  };
}

export function metadataForSingleThemePage(site: Site, page: ThemePage): Metadata {
  const settings = site.themeSettings.publishedJson;
  const currentSeo = settings.seo;
  const settingsPageSeo = currentSeo?.pages?.[page.id] ?? currentSeo?.pages?.[page.slug];
  const jsonSeo: PageJsonSeo | undefined = page.publishedJson.seo;
  const policySeo = policySeoForSite(site, page.slug);
  const knownSeo = knownStorefrontSeoOverride(site, page.slug);
  const defaultRobots = defaultRobotsForPage(page);
  const siteTitle = normalizeStorefrontBrandText(site, currentSeo?.siteTitle, storefrontSeoBrandName(site));
  const siteDescription = normalizeStorefrontBrandText(site, currentSeo?.siteDescription, site.branding.description);
  const siteKeywords = cleanText(currentSeo?.siteKeywords);
  const titleTemplate = normalizeStorefrontBrandText(site, currentSeo?.titleTemplate, defaultTitleTemplate(site));
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
    title: pickText(knownSeo?.title, jsonSeo?.title, policySeo?.title, fallbackPageSeo.title),
    description: pickText(knownSeo?.description, jsonSeo?.description, policySeo?.description, fallbackPageSeo.description),
    keywords: pickText(knownSeo?.keywords, jsonSeo?.keywords, policySeo?.keywords, fallbackPageSeo.keywords, siteKeywords),
    ogImage: pickText(jsonSeo?.ogImage, fallbackPageSeo.ogImage, defaultOgImage),
    canonicalPath: pickText(knownSeo?.canonicalPath, policySeo?.canonicalPath, jsonSeo?.canonical, jsonSeo?.canonicalPath, fallbackPageSeo.canonicalPath, page.slug),
    index: jsonSeo?.robots?.index ?? jsonSeo?.index ?? policySeo?.index ?? fallbackPageSeo.index ?? currentSeo?.robots?.index ?? true,
    follow: jsonSeo?.robots?.follow ?? jsonSeo?.follow ?? policySeo?.follow ?? fallbackPageSeo.follow ?? currentSeo?.robots?.follow ?? true
  };
  const title = applyTitleTemplate(normalizeStorefrontBrandText(site, pageSeo.title || siteTitle), titleTemplate, site);
  const description = normalizeStorefrontBrandText(site, pageSeo.description, siteDescription);
  const canonicalPath = normalizeCanonicalPath(pageSeo.canonicalPath, page.slug);
  const canonical = absoluteUrl(site, canonicalPath);
  const ogImage = absoluteUrl(site, pageSeo.ogImage || defaultOgImage);
  const icons = siteIcons(site);

  return {
    title,
    description,
    keywords: cleanText(pageSeo.keywords) || undefined,
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
    },
    icons
  };
}

export function slugPathForPage(page: Pick<ThemePage, "slug">): string {
  return stripHomeSlug(page.slug);
}
