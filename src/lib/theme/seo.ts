import type { Metadata } from "next";
import type { Site, ThemePage, ThemeSettings } from "@/lib/types";
import { getAidreamcapesPolicySeo, getMydreamshootsPolicySeo, getSpanishXbyPolicySeo } from "@/lib/theme/policy-seo";
import { isSpanishStorefrontSite } from "@/lib/spanish-storefronts";

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
  if (isSpanishStorefrontSite(site)) return site.branding.logoText || site.name;
  if (token.includes("aidreamcapes")) return "Aidreamcapes";
  if (token.includes("mydreamshoots") || token.includes("dreamshoot")) return myDreamShootsSeoName;
  return site.branding.logoText || site.name;
}

function normalizeStorefrontBrandText(site: Site, value: string | undefined, fallback = ""): string {
  const brandName = storefrontSeoBrandName(site);
  const text = cleanText(value, fallback);
  if (isSpanishStorefrontSite(site) && text.toLowerCase().includes(brandName.toLowerCase())) {
    return text;
  }
  return text
    .replace(myDreamShootsBrandPattern, brandName)
    .replace(/\bMyDreamShoots\b/g, brandName)
    .replace(/\bMydreamShoots\b/g, brandName)
    .replace(/\bMydreamshoots\b/g, brandName)
    .replace(/\bDreamShootAI\b/g, brandName)
    .replace(/\bMyDreamShoots-xby-xby\b/g, "MyDreamShoots-xby")
    .replace(/\bAidreamcapes-xby-xby\b/g, "Aidreamcapes-xby");
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
  if (isSpanishXbySeoSite(site)) return getSpanishXbyPolicySeo(site, slug);
  if (siteToken.includes("aidreamcapes")) return getAidreamcapesPolicySeo(slug);
  if (!siteToken.includes("mydreamshoots") && !siteToken.includes("dreamshoot")) return undefined;
  return getMydreamshootsPolicySeo(slug);
}

function isAidreamcapesSeoSite(site: Site): boolean {
  return `${site.id} ${site.slug} ${site.primaryDomain} ${site.name} ${site.branding.logoText}`.toLowerCase().includes("aidreamcapes");
}

function isMyDreamShootsSeoSite(site: Site): boolean {
  const token = `${site.id} ${site.slug} ${site.primaryDomain} ${site.name} ${site.branding.logoText}`.toLowerCase();
  return token.includes("mydreamshoots") || site.id === "site_dreamshoot";
}

function isSpanishXbySeoSite(site: Site): boolean {
  return isSpanishStorefrontSite(site);
}

function isSpanishAidreamcapesXbySeoSite(site: Site): boolean {
  return isSpanishXbySeoSite(site) && isAidreamcapesSeoSite(site);
}

function isSpanishMyDreamShootsXbySeoSite(site: Site): boolean {
  return isSpanishXbySeoSite(site) && isMyDreamShootsSeoSite(site);
}

function spanishXbyBrandName(site: Site): string {
  return site.branding.logoText || site.name || storefrontSeoBrandName(site);
}

function spanishXbySeoOverride(site: Site, slug: string): Partial<PageSeo> | undefined {
  const brand = spanishXbyBrandName(site);
  const aidreamcapes = isSpanishAidreamcapesXbySeoSite(site);
  const supportKeywords = aidreamcapes
    ? `soporte ${brand}, retratos de viaje IA, creditos IA, galeria privada`
    : `soporte ${brand}, fotos IA privadas, creditos IA, galeria privada`;
  const policyKeywords = aidreamcapes
    ? `politica ${brand}, privacidad retratos IA, creditos IA, galeria privada`
    : `politica ${brand}, privacidad fotos IA, creditos IA, galeria privada`;
  const common: Record<string, Partial<PageSeo>> = {
    "/pricing": {
      title: `${brand} precios - planes y creditos con IA`,
      description: `Compara planes, creditos mensuales, recargas puntuales, pago seguro y entrega privada antes de crear imagenes con ${brand}.`,
      keywords: aidreamcapes
        ? `precios ${brand}, creditos retratos de viaje, planes IA, pago seguro`
        : `precios ${brand}, creditos fotos IA, planes retratos IA, pago seguro`
    },
    "/tools": {
      title: aidreamcapes ? `${brand} herramientas de retratos de viaje con IA` : `${brand} herramientas de fotos con IA`,
      description: aidreamcapes
        ? `Explora herramientas de ${brand} para retratos de ruta, luz costera, escenas de viaje, postales y galerias privadas.`
        : `Explora herramientas de ${brand} para retratos profesionales, fondos, retoque, video, probador virtual, paquetes privados y galerias con creditos visibles.`,
      keywords: aidreamcapes
        ? `herramientas ${brand}, retratos de viaje IA, escenas de destino, galeria privada`
        : `herramientas ${brand}, fotos IA, retratos profesionales IA, probador virtual`
    },
    "/collections": {
      title: aidreamcapes ? `Paquetes de retratos de viaje con IA | ${brand}` : `Paquetes privados de fotos con IA | ${brand}`,
      description: aidreamcapes
        ? `Explora paquetes de ${brand} para costa, ciudad, ruta, balcones, retiros, postales y albumes privados de viaje.`
        : `Explora paquetes de ${brand} para retratos profesionales, pareja, belleza, creador, deporte, bodas y albumes privados con IA.`,
      keywords: aidreamcapes
        ? `paquetes ${brand}, retratos de viaje IA, albumes destino, galeria privada`
        : `paquetes ${brand}, fotos IA privadas, retratos profesionales IA, album privado`
    },
    "/about-us": {
      title: `Sobre ${brand}`,
      description: `${brand} ofrece una experiencia privada para subir fotos, revisar creditos, crear imagenes con IA y recibir galerias de cliente.`,
      keywords: aidreamcapes
        ? `sobre ${brand}, retratos de viaje IA, albumes privados, fotos destino`
        : `sobre ${brand}, fotos IA privadas, retratos IA, albumes privados`
    },
    "/contact-us": {
      title: `Contacto | ${brand}`,
      description: `Contacta con ${brand} para soporte de cuenta, creditos, facturacion, privacidad, paquetes y entrega de galerias.`,
      keywords: supportKeywords
    },
    "/help": {
      title: `Centro de ayuda | ${brand}`,
      description: `Resuelve dudas sobre fotos fuente, creditos, pago, privacidad, reembolsos, paquetes y entrega privada en ${brand}.`,
      keywords: supportKeywords,
      canonicalPath: "/faq"
    },
    "/terms": {
      title: `Terminos de servicio | ${brand}`,
      description: `Revisa los terminos de cuenta, creditos, subidas, pago, generacion, galerias privadas, reembolsos y uso aceptable de ${brand}.`,
      keywords: policyKeywords
    },
    "/policies/terms": {
      title: `Terminos de servicio | ${brand}`,
      description: `Revisa los terminos de cuenta, creditos, subidas, pago, generacion, galerias privadas, reembolsos y uso aceptable de ${brand}.`,
      keywords: policyKeywords,
      canonicalPath: "/terms"
    },
    "/privacy": {
      title: `Politica de privacidad | ${brand}`,
      description: `Consulta como ${brand} gestiona cuentas, fotos subidas, pedidos, creditos, datos de pago y galerias privadas.`,
      keywords: policyKeywords
    },
    "/policies/privacy": {
      title: `Politica de privacidad | ${brand}`,
      description: `Consulta como ${brand} gestiona cuentas, fotos subidas, pedidos, creditos, datos de pago y galerias privadas.`,
      keywords: policyKeywords,
      canonicalPath: "/privacy"
    },
    "/cookies": {
      title: `Politica de cookies | ${brand}`,
      description: `Consulta como ${brand} usa cookies para sesiones, pago, seguridad, preferencias y analitica operativa.`,
      keywords: policyKeywords
    },
    "/policies/cookies": {
      title: `Politica de cookies | ${brand}`,
      description: `Consulta como ${brand} usa cookies para sesiones, pago, seguridad, preferencias y analitica operativa.`,
      keywords: policyKeywords,
      canonicalPath: "/cookies"
    },
    "/content": {
      title: `Politica de contenido | ${brand}`,
      description: `Revisa las reglas de contenido, consentimiento, fotos fuente, seguridad creativa y uso aceptable de ${brand}.`,
      keywords: policyKeywords
    },
    "/policies/content": {
      title: `Politica de contenido | ${brand}`,
      description: `Revisa las reglas de contenido, consentimiento, fotos fuente, seguridad creativa y uso aceptable de ${brand}.`,
      keywords: policyKeywords,
      canonicalPath: "/content"
    }
  };
  return common[slug] ?? (slug === "/faq" ? common["/help"] : undefined);
}

function storefrontLaunchChecklistSeo(
  site: Site,
  slug: string,
  seo: Pick<PageSeo, "title" | "description" | "keywords">
): Pick<PageSeo, "title" | "description" | "keywords"> {
  if (slug !== "/") return seo;
  if (isSpanishAidreamcapesXbySeoSite(site)) {
    const brand = spanishXbyBrandName(site);
    return {
      title: `${brand} - generador de retratos de viaje con IA`,
      description:
        `Transforma tus fotos favoritas en retratos de viaje profesionales con ${brand}. Elige destino, ambiente y estilo desde casa con galerias privadas.`,
      keywords: `retratos de viaje IA,fotos de viaje IA,generador de fotos IA,albumes de destino,retratos cinematicos,${brand}`
    };
  }
  if (isSpanishMyDreamShootsXbySeoSite(site)) {
    const brand = spanishXbyBrandName(site);
    return {
      title: `${brand} - generador de fotos con IA online`,
      description:
        `Convierte tus selfies en retratos profesionales, fotos de pareja y albumes privados con ${brand}. Sube tus fotos, revisa creditos y crea resultados con IA desde casa.`,
      keywords: `generador de fotos IA,retratos profesionales IA,fotos de pareja IA,album privado IA,selfies,${brand}`
    };
  }
  if (isAidreamcapesSeoSite(site)) {
    return {
      title: "AIdreamcapes – the most advanced AI photo generator maker",
      description:
        "Transform your favorite moments into professional-grade photos and stunning memories with AIdreamcapes. Choose any setting, outfit, or vibe – all from home.",
      keywords: "Dream Photos,Dream Photoshoot,Wedding Photoshoot,Wedding Photos,AI Photos,AI Photoshoot,Couple Photos"
    };
  }
  if (!isMyDreamShootsSeoSite(site)) return seo;
  return {
    title: "Professional AI Photo Generator Online - MyDreamShoots",
    description:
      "Create sports fan photos, VIP-style portraits, Christmas group photos, Thanksgiving portraits, and Halloween party albums from your selfies with MyDreamShoots.",
    keywords: "Dream Shoots,Sports Fan Photos,VIP Style Portraits,Christmas Group Photos,Thanksgiving Photos,Halloween Party Photos,AI Photo Generator"
  };
}

function knownStorefrontSeoOverride(site: Site, slug: string): Partial<PageSeo> | undefined {
  if (isSpanishXbySeoSite(site)) return spanishXbySeoOverride(site, slug);
  const aidreamcapes = isAidreamcapesSeoSite(site);
  if (aidreamcapes) {
    const overrides: Record<string, Partial<PageSeo>> = {
      "/about-us": {
        title: "About Aidreamcapes",
        description: "Learn how Aidreamcapes turns private uploads into cinematic portraits, visible credit workflows, and customer-only galleries."
      },
      "/tools": {
        title: "Aidreamcapes AI Tools - fan-scene and holiday album builders",
        description: "Explore Aidreamcapes tools for fan-scene albums, game-day group portraits, premiere-inspired sets, Christmas group albums, Thanksgiving keepsakes, Halloween party portraits, and private gallery delivery."
      },
      "/help": {
        title: "Aidreamcapes FAQ",
        description: "Find answers about source photos, fan-scene albums, holiday memory sets, credits, private galleries, delivery, privacy, and support.",
        canonicalPath: "/faq"
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
    return overrides[slug] ?? (slug === "/faq" ? overrides["/help"] : undefined);
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
      title: "MyDreamShoots Pricing | Credits for Private AI Headshot Generator",
      description: "Compare MyDreamShoots plans and credit packs for private AI photo packages, source-photo uploads, generation requests, secure checkout, and private gallery delivery."
    },
    "/tools": {
      title: "AI Photo Tools with Free Previews | Background, Headshots & Try-ons | MyDreamShoots",
      description: "Explore MyDreamShoots tools for headshots, background edits, video clips, try-on previews, private uploads, visible credits, and private albums."
    },
    "/help": {
      title: "MyDreamShoots FAQ",
      description: "Get FAQ answers for source photos, package selection, credits, billing, refunds, privacy, cookies, and private album delivery.",
      canonicalPath: "/faq"
    }
  };
  return overrides[slug] ?? (slug === "/faq" ? overrides["/help"] : undefined);
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
  if (normalized.includes("/assets/sites/site_aidreamcapes/brand/aidreamcapes-wordmark.svg")) {
    return "/assets/sites/site_aidreamcapes/brand/aidreamcapesai-logo-refined.svg?v=20260708c";
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
  if (isSpanishStorefrontSite(site)) {
    const identity = `${site.id} ${site.slug} ${site.name} ${site.primaryDomain} ${site.branding.logoText ?? ""}`.toLowerCase();
    const aidreamcapes = identity.includes("aidreamcapes");
    const basePath = aidreamcapes ? "/assets/sites/site_aidreamcapes_eu/brand" : "/assets/sites/site_aidreamshoots/brand";
    const prefix = aidreamcapes ? "aidreamcapes" : "aidreamshoots";
    const logo = aidreamcapes ? "aidreamcapes-logo-refined.svg" : "aidreamshoots-logo-refined.svg";
    return {
      icon: [
        { url: `${basePath}/${prefix}-icon-192.png?v=20260717a`, type: "image/png", sizes: "192x192" },
        { url: `${basePath}/${logo}?v=20260717a`, type: "image/svg+xml" }
      ],
      shortcut: `${basePath}/${prefix}-icon-192.png?v=20260717a`,
      apple: [{ url: `${basePath}/${prefix}-icon-180.png?v=20260717a`, sizes: "180x180", type: "image/png" }]
    };
  }
  if (slug.includes("aidreamcapes")) {
    return {
      icon: [
        { url: "/assets/sites/site_aidreamcapes/brand/aidreamcapes-icon-192.png?v=20260708c", type: "image/png", sizes: "192x192" },
        { url: "/assets/sites/site_aidreamcapes/brand/aidreamcapesai-logo-refined.svg?v=20260708c", type: "image/svg+xml" }
      ],
      shortcut: "/assets/sites/site_aidreamcapes/brand/aidreamcapes-icon-192.png?v=20260708c",
      apple: [{ url: "/assets/sites/site_aidreamcapes/brand/aidreamcapes-icon-180.png?v=20260708c", sizes: "180x180", type: "image/png" }]
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
  const launchChecklistSeo = storefrontLaunchChecklistSeo(site, page.slug, { title, description, keywords: pageSeo.keywords });
  const finalTitle = launchChecklistSeo.title;
  const finalDescription = launchChecklistSeo.description;
  const finalKeywords = launchChecklistSeo.keywords;

  return {
    title: finalTitle,
    description: finalDescription,
    keywords: finalKeywords || undefined,
    alternates: canonical ? { canonical } : undefined,
    robots: {
      index: defaultRobots.index ? pageSeo.index ?? seo.robots.index : false,
      follow: pageSeo.follow ?? seo.robots.follow
    },
    openGraph: {
      title: finalTitle,
      description: finalDescription,
      url: canonical,
      siteName: seo.siteTitle,
      images: ogImage ? [{ url: ogImage }] : undefined
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title: finalTitle,
      description: finalDescription,
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
  const launchChecklistSeo = storefrontLaunchChecklistSeo(site, page.slug, { title, description, keywords: pageSeo.keywords });
  const finalTitle = launchChecklistSeo.title;
  const finalDescription = launchChecklistSeo.description;
  const finalKeywords = launchChecklistSeo.keywords;

  return {
    title: finalTitle,
    description: finalDescription,
    keywords: finalKeywords || undefined,
    alternates: canonical ? { canonical } : undefined,
    robots: {
      index: defaultRobots.index ? pageSeo.index ?? currentSeo?.robots?.index ?? true : false,
      follow: pageSeo.follow ?? currentSeo?.robots?.follow ?? true
    },
    openGraph: {
      title: finalTitle,
      description: finalDescription,
      url: canonical,
      siteName: siteTitle,
      images: ogImage ? [{ url: ogImage }] : undefined
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title: finalTitle,
      description: finalDescription,
      images: ogImage ? [ogImage] : undefined
    },
    icons
  };
}

export function slugPathForPage(page: Pick<ThemePage, "slug">): string {
  return stripHomeSlug(page.slug);
}
