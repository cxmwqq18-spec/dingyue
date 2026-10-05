import fs from "node:fs";
import path from "node:path";

import type { StorefrontContext } from "@/lib/storefront-context/types";
import { projectPublicCreativePacks, projectPublicPricingOffers } from "@/lib/storefront-context/core";
import { canonicalAbsoluteUrlForSite, canonicalOriginForSite, storefrontBaseUrl } from "@/lib/storefront-context/seo-projection";
import { aiVideoTopicLandingContentFromSection } from "@/lib/ai-video-topic-content";
import { talkingPhotoContentFromSection } from "@/lib/talking-photo-content";
import { imageThemeDetailContentFromSection } from "@/lib/aidreamcapes-image-theme-content";
import { AIDREAMCAPES_IMAGE_THEME_DEFINITIONS, isAidreamcapesImageThemePath } from "@/lib/aidreamcapes-image-theme-routes";
import { AIDREAMCAPES_EU_DIRECTORY_SLUGS, aidreamcapesEuSaveTheDateSeoFromPath, aidreamcapesEuSeoContentForSlug } from "@/lib/aidreamcapes-eu-seo-content";
import { aidreamcapesEuVideoTopic, aidreamcapesEuVideoTopicFromPath } from "@/lib/aidreamcapes-eu-video-media";
import { dreamshootToolDetailFaqItems } from "@/lib/dreamshoot-tool-faq";
import { AIDREAMCAPES_EU_TOOLS_FAQ } from "@/lib/aidreamcapes-eu-tools-faq";
import { aidreamcapesSeoQualityForPath, canonicalSeoDirectoryPathForSite, getSeoDirectoryContentForSite } from "@/lib/dreamshoot-seo-content";
import { isAidreamshootsStorefrontSite, isSpanishStorefrontSite } from "@/lib/spanish-storefronts";
import { storefrontOriginalLogoUrl } from "@/lib/storefront-brand-assets";
import { isAidreamcapesSite as isAidreamcapesCapabilitySite, isPrimaryMydreamshootsSite as isPrimaryMydreamshootsCapabilitySite } from "@/lib/storefront-context/capabilities";
import {
  AIDREAMSHOOTS_ENGAGEMENT_FRENCH_COPY,
  isAidreamshootsEngagementFrenchPage
} from "@/lib/aidreamshoots-engagement-photo-french";
import {
  AIDREAMSHOOTS_HOMEPAGE_VIDEO_MEDIA,
  AIDREAMSHOOTS_HOMEPAGE_VIDEO_SUBTITLES,
  AIDREAMSHOOTS_HOMEPAGE_VIDEO_TITLES,
  aidreamshootsVideoTopicSlugForPath
} from "@/lib/aidreamshoots-video-media";
import type { CreativePack, Product, SectionBlockInstance, Site, ThemePage, ThemePageJson, ThemeSettingValue, VideoTheme } from "@/lib/types";

export type JsonLdNode = Record<string, unknown>;

type JsonLdInput = {
  site: Site;
  page: Pick<ThemePage, "id" | "slug" | "title" | "pageType" | "updatedAt">;
  pageJson?: ThemePageJson;
  pagePath: string;
  routeMode: "host" | "path";
  creativePacks?: CreativePack[];
  products?: Product[];
  videoThemes?: VideoTheme[];
  context: StorefrontContext;
  publishedRoutePaths?: readonly string[];
};

function cleanText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() || fallback : fallback;
}

function cleanPaidStorefrontText(value: unknown, fallback = ""): string {
  return cleanText(value, fallback)
    .replace(/\bFree AI Tools Collection\b/g, "AI Tools Collection")
    .replace(/\b[Ff]ree utility tools\b/g, "paid studio tools")
    .replace(/\b[Ff]ree AI photo tools\b/g, "AI photo tools")
    .replace(/\b[Ff]ree AI tools\b/g, "AI tools")
    .replace(/\b[Ff]ree tools\b/g, "studio tools")
    .replace(/\b[Ff]ree tool\b/g, "studio tool")
    .replace(/\s+/g, " ")
    .trim();
}

function siteBrandName(site: Site): string {
  if (isPrimaryMydreamshootsCapabilitySite(site)) return "MyDreamShoots";
  return cleanText(site.branding.logoText, site.name);
}

function isAidreamcapesSite(site: Site): boolean {
  return isAidreamcapesCapabilitySite(site);
}

function isSpanishXbySite(site: Site): boolean {
  return isSpanishStorefrontSite(site);
}

function isPrimaryMyDreamShootsSite(site: Site): boolean {
  return isPrimaryMydreamshootsCapabilitySite(site);
}

function hasAidreamshootsBranding(site: Site): boolean {
  return isAidreamshootsStorefrontSite(site);
}

function isMydreamshootsComSite(site: Site): boolean {
  return site.id === "site_dreamshoot" || cleanText(site.primaryDomain).toLowerCase() === "www.mydreamshoots.com";
}

const MYDREAMSHOOTS_VIDEO_SCHEMA_PATHS = new Set([
  "/ai-video-generation/brand-video", "/ai-video-generation/cinematic-video", "/ai-video-generation/explainer-video",
  "/ai-video-generation/fashion-video", "/ai-video-generation/food-video", "/ai-video-generation/how-to-video",
  "/ai-video-generation/instagram-reels", "/ai-video-generation/meme-video", "/ai-video-generation/motion-generator",
  "/ai-video-generation/music-video", "/ai-video-generation/pet-video", "/ai-video-generation/product-ad-video",
  "/ai-video-generation/product-video", "/ai-video-generation/promo-video", "/ai-video-generation/social-media-video",
  "/ai-video-generation/story-video", "/ai-video-generation/talking-head-video", "/ai-video-generation/talking-photo",
  "/ai-video-generation/tiktok-video", "/ai-video-generation/ugc-ad-video", "/ai-video-generation/video-ad",
  "/ai-video-generation/youtube-video"
]);

const AIDREAMCAPES_ADS_TESTING_PATHS = new Set([
  "/ai-video-generation/ugc-ad-video",
  "/ai-video-generation/url-to-ad",
  "/ai-video-generation/hook-lab",
  "/ai-video-generation/pas-formula-ads",
  "/ai-video-generation/testimonial-ads",
  "/ai-video-generation/before-after-showcases",
  "/ai-video-generation/talking-photo-recs",
  "/ai-video-generation/ai-actor-product-ads",
  "/ai-video-generation/tiktok-reels-shorts",
  "/ai-video-generation/native-spark-ads",
  "/ai-video-generation/carousel-storytelling",
  "/ai-video-generation/retargeting-urgency"
]);

const AIDREAMCAPES_BRAND_CREATOR_PATHS = new Set([
  "/ai-video-generation/founder-update",
  "/ai-video-generation/multilingual-video",
  "/ai-video-generation/cinematic-video",
  "/ai-video-generation/music-video"
]);

function isAidreamcapesAdsTestingPage(site: Site, pagePath: string): boolean {
  return site.id === "site_aidreamcapes" && AIDREAMCAPES_ADS_TESTING_PATHS.has(pagePath);
}

function isAidreamcapesBrandCreatorPage(site: Site, pagePath: string): boolean {
  return site.id === "site_aidreamcapes" && AIDREAMCAPES_BRAND_CREATOR_PATHS.has(pagePath);
}

function toolOfferAvailability(site: Site, pagePath: string, context: StorefrontContext): string {
  const publishedVideoToolIsAvailable =
    isMydreamshootsComSite(site) &&
    MYDREAMSHOOTS_VIDEO_SCHEMA_PATHS.has(pagePath) &&
    context.capability.usesAiGenerationPublicRoutes;
  return publishedVideoToolIsAvailable || context.offers.active.some((offer) => offer.checkoutEnabled)
    ? "https://schema.org/InStock"
    : "https://schema.org/OutOfStock";
}

function collapseSpanishXbyBrandRepeats(value: string): string {
  return value
    .replace(/\bMyDreamShoots-xby(?:-xby)+\b/g, "MyDreamShoots-xby")
    .replace(/\bAidreamcapes-xby(?:-xby)+\b/g, "Aidreamcapes-xby");
}

function schemaServiceType(site: Site, pagePath: string): string {
  if (site.id === "site_aidreamcapes_xby") {
    const videoTopic = aidreamcapesEuVideoTopicFromPath(pagePath);
    if (videoTopic) return `service de création de ${videoTopic.label.toLowerCase()} avec l’IA`;
    if (pagePath.startsWith("/tools/")) return "service de création et de retouche photo avec l’IA";
    return "service de création visuelle avec l’IA";
  }
  if (isAidreamcapesAdsTestingPage(site, pagePath)) return "AI UGC product advertising video generation service";
  if (isAidreamcapesBrandCreatorPage(site, pagePath)) {
    if (pagePath.endsWith("/founder-update")) return "AI founder update video generation service";
    if (pagePath.endsWith("/multilingual-video")) return "AI multilingual video localization service";
    if (pagePath.endsWith("/cinematic-video")) return "AI cinematic product film generation service";
    return "AI audio-synced short-form video generation service";
  }
  if (isSpanishXbySite(site)) {
    if (isAidreamcapesSite(site)) {
      if (pagePath.includes("moodboard")) return "servicio de moodboard de viaje con IA";
      if (pagePath.includes("postcard") || pagePath.includes("journal")) return "servicio de album y postal de viaje con IA";
      return "servicio de retratos de viaje con IA";
    }
    if (pagePath.includes("video")) return "herramienta de imagen a video con IA";
    if (pagePath.includes("headshot")) return "herramienta de retratos profesionales con IA";
    return "herramienta de generacion y edicion de fotos con IA";
  }
  if (isAidreamcapesSite(site)) {
    if (pagePath.includes("moodboard")) return "AI fan-scene moodboard planning service";
    if (pagePath.includes("postcard") || pagePath.includes("journal")) return "AI occasion album and keepsake portrait service";
    return "AI occasion portrait generation service";
  }
  if (isMydreamshootsComSite(site) && MYDREAMSHOOTS_VIDEO_SCHEMA_PATHS.has(pagePath)) return "AI video generation service";
  if (pagePath.includes("video")) return "AI image to video concept tool";
  if (pagePath.includes("headshot")) return "AI headshot and profile portrait tool";
  return "AI photo generation and editing tool";
}

function itemListName(site: Site, title: string): string {
  if (isSpanishXbySite(site)) return isAidreamcapesSite(site) ? `${title} opciones de album de viaje` : `${title} opciones de paquete`;
  if (isAidreamcapesSite(site)) return site.id === "site_aidreamcapes_xby" ? `${title} options de création` : `${title} occasion album options`;
  return `${title} package options`;
}

function cleanSchemaText(site: Site, value: unknown, fallback = ""): string {
  const brandName = siteBrandName(site);
  const text = cleanPaidStorefrontText(value, fallback)
    .replace(/\bMydreamShoots\b/g, "MyDreamShoots")
    .replace(/\bMydreamshoots\b/g, "MyDreamShoots")
    .replace(/\bDreamShootAI\b/g, brandName)
    .replace(/\s+/g, " ")
    .trim();
  if (!isSpanishXbySite(site)) return text;
  const spanishBrandForDreamshoot = isAidreamcapesSite(site) ? "MyDreamShoots" : brandName;
  const spanishBrandForAidreamcapes = isAidreamcapesSite(site) ? brandName : "Aidreamcapes";
  return collapseSpanishXbyBrandRepeats(text
    .replace(/\bMyDreamShoots\b(?!-xby)/g, spanishBrandForDreamshoot)
    .replace(/\bAidreamcapes\b(?!-xby)/g, spanishBrandForAidreamcapes)
    .replace(/\bWhen are creditos used\?/gi, "Cuando se usan los creditos?")
    .replace(/\bWhen are credits used\?/gi, "Cuando se usan los creditos?")
    .replace(/\bWhen are creditos spent\?/gi, "Cuando se gastan los creditos?")
    .replace(/\bWhen are credits spent\?/gi, "Cuando se gastan los creditos?")
    .replace(/\bWhat happens if I cancel a plan\?/gi, "Que ocurre si cancelo un plan?")
    .replace(/\bCan unused creditos be reviewed\?/gi, "Se pueden revisar los creditos no usados?")
    .replace(/\bCan unused credits be reviewed\?/gi, "Se pueden revisar los creditos no usados?")
    .replace(/\bCredits are reserved when a generation starts, spent after successful delivery, and released or reviewed if a job cannot be completed\./gi, "Los creditos se reservan al iniciar una generacion, se consumen tras una entrega correcta y se liberan o revisan si el pedido no puede completarse.")
    .replace(/\bCanceling stops future renewals\. You keep access to previous albums, and remaining creditos follow the account and refund policy\./gi, "La cancelacion detiene renovaciones futuras. Conservas acceso a albumes anteriores y los creditos restantes siguen la politica de cuenta y reembolsos.")
    .replace(/\bUnused creditos can be reviewed from account history when a request fails, duplicates, or is canceled before rendering\./gi, "Los creditos no usados pueden revisarse desde el historial cuando una solicitud falla, se duplica o se cancela antes de renderizar.")
    .trim());
}

function schemaPathLabel(site: Site, part: string): string {
  const normalized = part.toLowerCase();
  if (site.id === "site_aidreamcapes_xby") {
    const frenchLabels: Record<string, string> = {
      "ai-image-generation": "Création photo IA",
      "ai-video-generation": "Création vidéo IA",
      tools: "Outils",
      collections: "Collections",
      pricing: "Tarifs",
      privacy: "Confidentialité",
      terms: "Conditions d’utilisation",
      cookies: "Cookies",
      refunds: "Remboursements",
      content: "Contenu",
      "digital-delivery": "Livraison numérique",
      help: "Aide",
      "about-us": "À propos",
      "contact-us": "Contact"
    };
    return frenchLabels[normalized] ?? part.replace(/[-_]+/g, " ");
  }
  if (!isSpanishXbySite(site)) {
    const englishLabels: Record<string, string> = {
      "ai-image-generation": "AI Image Generation",
      "ai-video-generation": "AI Video Generation"
    };
    return englishLabels[normalized] ?? part.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
  const labels: Record<string, string> = {
    tools: "Herramientas",
    collections: "Colecciones",
    "ai-image-generation": "AI Photoshoot",
    pricing: "Precios",
    login: "Acceso",
    cart: "Carrito",
    privacy: "Privacidad",
    terms: "Terminos",
    cookies: "Cookies",
    refunds: "Reembolsos",
    content: "Contenido",
    shipping: "Entrega",
    "digital-delivery": "Entrega digital",
    help: "Ayuda",
    "about-us": "Sobre nosotros",
    "contact-us": "Contacto"
  };
  return labels[normalized] ?? part.replace(/[-_]+/g, " ");
}

function slugifySchemaPart(value: string): string {
  return cleanText(value)
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function canonicalCollectionSlugForCandidate(site: Site, value: unknown): string {
  const slug = slugifySchemaPart(cleanText(value));
  if (!slug) return "";
  return canonicalSeoDirectoryPathForSite(site, "collection", slug).split("/").pop() || slug;
}

function listText(value: ThemeSettingValue | undefined): string[] {
  if (typeof value === "string") {
    return value
      .split(/\n|\|/)
      .map((item) => cleanText(item))
      .filter(Boolean);
  }
  if (Array.isArray(value)) return value.map((item) => cleanText(item)).filter(Boolean);
  return [];
}

function hasPageSections(pageJson: ThemePageJson | undefined): pageJson is ThemePageJson {
  return Boolean(pageJson?.sections && Array.isArray(pageJson.sectionsOrder));
}

function sectionValue(pageJson: ThemePageJson | undefined, key: string): string {
  if (!hasPageSections(pageJson)) return "";
  for (const sectionId of pageJson.sectionsOrder) {
    const value = pageJson.sections[sectionId]?.settings?.[key];
    const text = cleanText(value);
    if (text) return text;
  }
  return "";
}

function sectionOfType(pageJson: ThemePageJson | undefined, type: string) {
  if (!hasPageSections(pageJson)) return undefined;
  return pageJson.sectionsOrder
    .map((sectionId) => pageJson.sections[sectionId])
    .find((section) => section?.type === type);
}

function articleSectionValue(pageJson: ThemePageJson | undefined, key: string): string {
  const article = sectionOfType(pageJson, "blog_article");
  return cleanText(article?.settings?.[key]) || sectionValue(pageJson, key);
}

function blockValue(block: SectionBlockInstance, key: string, fallback = ""): string {
  return cleanText(block.settings[key], fallback);
}

function faqAnswerText(block: SectionBlockInstance): string {
  const answer = blockValue(block, "answer", blockValue(block, "description"));
  const body = listText(block.settings.body);
  const bulletList = listText(block.settings.bulletList);
  return [answer, ...body, ...bulletList.map((item) => `• ${item}`)]
    .filter(Boolean)
    .join(" ");
}

function withStorefrontPublicWatermarkCacheVersion(value: string): string {
  const cleanValue = value.trim();
  if (!cleanValue) return value;
  const mediaPattern = /\.(?:avif|jpe?g|png|svg|webp|m4v|mov|mp4|webm)(?:[?#]|$)/i;
  if (!mediaPattern.test(cleanValue) || cleanValue.includes("/brand/")) return value;

  if (cleanValue.startsWith("http://") || cleanValue.startsWith("https://")) {
    try {
      const url = new URL(cleanValue);
      if (!url.pathname.startsWith("/assets/")) return value;
      url.searchParams.delete("wm");
      return url.toString();
    } catch {
      return value;
    }
  }

  if (!cleanValue.startsWith("/assets/")) return value;
  const hashStart = cleanValue.indexOf("#");
  const withoutHash = hashStart >= 0 ? cleanValue.slice(0, hashStart) : cleanValue;
  const hash = hashStart >= 0 ? cleanValue.slice(hashStart) : "";
  const queryStart = withoutHash.indexOf("?");
  const pathname = queryStart >= 0 ? withoutHash.slice(0, queryStart) : withoutHash;
  const params = new URLSearchParams(queryStart >= 0 ? withoutHash.slice(queryStart + 1) : "");
  params.delete("wm");
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}${hash}`;
}

function absoluteUrl(site: Site, routeMode: "host" | "path", pathOrUrl = "/"): string {
  const value = withStorefrontPublicWatermarkCacheVersion(cleanText(pathOrUrl, "/"));
  return canonicalAbsoluteUrlForSite(site, value) ?? `${canonicalOriginForSite(site)}/`;
}

type StorefrontCompanyProfile = {
  legalName?: string;
  address?: string;
  streetAddress?: string;
  addressLocality?: string;
  addressRegion?: string;
  addressRegionName?: string;
  postalCode?: string;
  addressCountry?: string;
  phone?: string;
  email?: string;
  taxId?: string;
  taxIdLabel?: string;
  entityType?: string;
};

function storefrontCompanyProfile(context?: StorefrontContext): StorefrontCompanyProfile {
  const identity = context?.profile?.identity;
  const address = identity?.address;
  return {
    legalName: cleanText(identity?.legalName),
    streetAddress: cleanText(address?.line2 ? `${address.line1}, ${address.line2}` : address?.line1),
    addressLocality: cleanText(address?.city),
    addressRegion: cleanText(address?.region),
    postalCode: cleanText(address?.postalCode),
    addressCountry: cleanText(address?.country),
    phone: cleanText(identity?.phone),
    email: cleanText(identity?.supportEmail),
    entityType: cleanText(identity?.entityType)
  };
}

function companyAddressSchema(profile: StorefrontCompanyProfile): JsonLdNode | string | undefined {
  if (profile.streetAddress && profile.addressLocality && profile.addressRegion && profile.postalCode) {
    return {
      "@type": "PostalAddress",
      streetAddress: profile.streetAddress,
      addressLocality: profile.addressLocality,
      addressRegion: profile.addressRegion,
      postalCode: profile.postalCode,
      ...(profile.addressCountry ? { addressCountry: profile.addressCountry } : {})
    };
  }
  return profile.address;
}

function companyIdentifiers(profile: StorefrontCompanyProfile): JsonLdNode[] {
  const identifiers: JsonLdNode[] = [];
  if (profile.legalName) {
    identifiers.push({
      "@type": "PropertyValue",
      propertyID: "Legal entity",
      name: "Legal entity",
      value: profile.legalName
    });
  }
  if (profile.taxId) {
    const taxIdLabel = profile.taxIdLabel || "Tax ID";
    identifiers.push({
      "@type": "PropertyValue",
      propertyID: taxIdLabel,
      name: taxIdLabel,
      value: profile.taxId
    });
  }
  if (profile.addressRegionName && profile.addressRegion) {
    identifiers.push({
      "@type": "PropertyValue",
      propertyID: "U.S. state entity jurisdiction",
      name: "U.S. state entity jurisdiction",
      value: `${profile.addressRegionName} (${profile.addressRegion})`
    });
  }
  if (profile.entityType) {
    identifiers.push({
      "@type": "PropertyValue",
      propertyID: "Entity type",
      name: "Entity type",
      value: profile.entityType
    });
  }
  return identifiers;
}

function homepageOfferCatalogSchema(site: Site, routeMode: "host" | "path"): JsonLdNode {
  const siteName = siteBrandName(site);
  const baseUrl = storefrontBaseUrl(site, routeMode);
  return {
    "@type": "OfferCatalog",
    "@id": `${baseUrl}#plans`,
    name: isSpanishXbySite(site)
      ? isAidreamcapesSite(site) ? `Paquetes de retrato de viaje y creditos ${siteName}` : `Paquetes de fotos y creditos ${siteName}`
      : isAidreamcapesSite(site)
        ? site.id === "site_aidreamcapes_xby"
          ? "Forfaits photo et crédits Aidreamcapes"
          : site.id === "site_aidreamcapes"
          ? "AIVideosUGC AI image and video plans"
          : "Aidreamcapes occasion portrait packages and credits"
        : "MyDreamShoots photo packages and credits",
    url: absoluteUrl(site, routeMode, schemaPagePath(site, routeMode, "/pricing"))
  };
}

function organizationSchema(site: Site, routeMode: "host" | "path", context?: StorefrontContext, pagePath?: string): JsonLdNode {
  const profile = storefrontCompanyProfile(context);
  const address = companyAddressSchema(profile);
  const identifiers = companyIdentifiers(profile);
  const profileSameAs = (context?.profile?.identity.sameAs ?? []).filter((url) => /^https?:\/\//i.test(url));
  const footerSettings = context?.settings?.globalSections?.footer?.settings as Record<string, unknown> | undefined;
  const euFooterSocialKeys = ["instagramUrl", "facebookUrl", "pinterestUrl", "youtubeUrl", "twitterUrl", "xUrl", "tiktokUrl"];
  const footerSameAs = site.id === "site_aidreamcapes_xby"
    ? euFooterSocialKeys
      .map((key) => footerSettings?.[key])
      .filter((value): value is string => typeof value === "string" && /^https?:\/\//i.test(value.trim()))
      .map((value) => value.trim())
    : [];
  const aidreamcapesPublicSocialProfiles = site.id === "site_aidreamcapes"
    ? [
        "https://www.instagram.com/aidreamcapes",
        "https://www.facebook.com/aidreamcapes",
        "https://www.pinterest.com/aidreamcapes",
        "https://www.youtube.com/@aidreamcapes",
        "https://x.com/aidreamcapes",
        "https://www.tiktok.com/@aidreamcapes"
      ]
    : [];
  const sameAs = Array.from(new Set([...profileSameAs, ...footerSameAs, ...aidreamcapesPublicSocialProfiles]));
  const isAboutPage = pagePath === "/about-us" && isMydreamshootsComSite(site);
  const originalLogo = storefrontOriginalLogoUrl(site);
  const logo = originalLogo
    ? absoluteUrl(site, routeMode, originalLogo)
    : isPrimaryMyDreamShootsSite(site)
      ? absoluteUrl(site, routeMode, "/assets/dreamshoot/brand/dreamshootai-logo-refined.svg?v=20260621b")
      : hasAidreamshootsBranding(site)
        ? absoluteUrl(site, routeMode, "/assets/sites/site_aidreamshoots/brand/aidreamshoots-logo-refined.svg?v=20260919original")
        : undefined;
  return {
    "@type": "Organization",
    "@id": `${storefrontBaseUrl(site, routeMode)}#organization`,
    name: siteBrandName(site),
    ...(isAboutPage ? { legalName: "MRNARUEBET LLC" } : profile.legalName ? { legalName: profile.legalName } : {}),
    url: storefrontBaseUrl(site, routeMode),
    ...(logo ? { logo: { "@type": "ImageObject", url: logo, contentUrl: logo } } : {}),
    description: isAboutPage
      ? "myDreamshoots.com is an AI image and video creation tool for AI-generated images, short videos, personalized Save the Date videos, photo packages, and private digital delivery."
      : isAidreamshootsEngagementFrenchPage(site, pagePath)
        ? aidreamshootsEngagementSpanishSchemaText(cleanSchemaText(site, site.branding.description))
        : cleanSchemaText(site, site.branding.description),
    ...(isAboutPage ? { founder: { "@type": "Person", name: "NARUEBET NAKPHONG" } } : {}),
    ...(profile.email ? { email: profile.email } : {}),
    ...(profile.phone ? { telephone: profile.phone } : {}),
    ...(profile.email || profile.phone ? {
      contactPoint: {
        "@type": "ContactPoint",
        ...(profile.email ? { email: profile.email } : {}),
        ...(profile.phone ? { telephone: profile.phone } : {}),
        contactType: "customer support",
        availableLanguage: site.id === "site_aidreamcapes_xby"
          ? ["fr-FR"]
          : isAidreamshootsStorefrontSite(site) ? ["es-ES", "en"] : ["en"]
      }
    } : {}),
    ...(address ? { address } : {}),
    ...(profile.taxId ? { taxID: profile.taxId } : {}),
    ...(identifiers.length ? { identifier: identifiers } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    ...(pagePath === "/" && (isMydreamshootsComSite(site) || site.id === "site_aidreamcapes") ? { hasOfferCatalog: homepageOfferCatalogSchema(site, routeMode) } : {})
  };
}

function schemaPagePath(site: Site, routeMode: "host" | "path", pagePath: string): string {
  const cleanPath = pagePath === "/404" ? "/" : pagePath || "/";
  if (routeMode === "host") return cleanPath;
  const domain = cleanText(site.primaryDomain);
  const hasCanonicalDomain = Boolean(domain && !domain.includes("localhost"));
  if (hasCanonicalDomain) return cleanPath;
  return `/site/${site.slug}${cleanPath === "/" ? "" : cleanPath}`;
}

function pageTitle(site: Site, page: Pick<ThemePage, "id" | "slug" | "title" | "pageType">, context?: StorefrontContext): string {
  return context?.seo.title || cleanSchemaText(site, page.title || siteBrandName(site));
}

function pageDescription(site: Site, page: Pick<ThemePage, "id" | "title">, context?: StorefrontContext): string {
  return context?.seo.description || cleanSchemaText(site, page.title);
}

function aidreamcapesEuThemeSlug(site: Site, pagePath: string): string | undefined {
  if (site.id !== "site_aidreamcapes_xby") return undefined;
  const parts = pagePath.split("/").filter(Boolean);
  if (parts.length !== 2 || parts[0] !== "ai-image-generation") return undefined;
  const slug = parts[1].toLowerCase();
  return AIDREAMCAPES_EU_DIRECTORY_SLUGS.includes(slug) ? slug : undefined;
}

function isAidreamcapesEuSaveTheDatePage(site: Site, pagePath: string | undefined): boolean {
  return site.id === "site_aidreamcapes_xby" && Boolean(pagePath && /^\/ai-save-the-date\/[^/]+$/.test(pagePath));
}

function aidreamcapesEuThemePack(input: JsonLdInput, slug: string): CreativePack | undefined {
  const packs = input.creativePacks?.length ? input.creativePacks : input.context.catalog.activePacks;
  return packs.find((pack) => pack.status === "active" && packMatchesCollectionSlug(input.site, pack, slug));
}

function breadcrumbs(site: Site, routeMode: "host" | "path", pagePath: string, title: string, publishedRoutePaths: readonly string[] = []): JsonLdNode {
  const parts = pagePath.split("/").filter(Boolean);
  const frenchEngagementPage = isAidreamshootsEngagementFrenchPage(site, pagePath);
  const aidreamcapesEuPage = Boolean(aidreamcapesEuThemeSlug(site, pagePath));
  const finalLabel = isMydreamshootsComSite(site) && pagePath === "/digital-delivery" ? "Digital Delivery Policy" : title;
  const items = [
    {
      "@type": "ListItem",
      position: 1,
      name: frenchEngagementPage || aidreamcapesEuPage || site.id === "site_aidreamcapes_xby" ? "Accueil" : isSpanishXbySite(site) ? "Inicio" : "Home",
      item: absoluteUrl(site, routeMode, schemaPagePath(site, routeMode, "/"))
    }
  ];
  let current = "";
  parts.forEach((part, index) => {
    current += `/${part}`;
    const isFinal = index === parts.length - 1;
    if (!isFinal && !publishedRoutePaths.includes(current)) return;
    items.push({
      "@type": "ListItem",
      position: items.length + 1,
      name: isFinal
        ? finalLabel
        : frenchEngagementPage && part === "ai-image-generation"
          ? "Generación de imágenes con IA"
          : aidreamcapesEuPage && part === "ai-image-generation"
            ? "Création photo IA"
            : schemaPathLabel(site, part),
      item: absoluteUrl(site, routeMode, schemaPagePath(site, routeMode, current))
    });
  });
  return { "@type": "BreadcrumbList", ...(site.id === "site_aidreamcapes_xby" ? { inLanguage: "fr-FR" } : {}), itemListElement: items };
}

function faqQuestionNode(site: Site, question: string, answer: string): JsonLdNode | undefined {
  const name = cleanSchemaText(site, question);
  const text = cleanSchemaText(site, answer);
  if (!name || !text) return undefined;
  return {
    "@type": "Question",
    name,
    acceptedAnswer: {
      "@type": "Answer",
      text
    }
  };
}

function aidreamshootsEngagementSpanishSchemaText(value: string): string {
  return value
    .replace(/\bespanol\b/gi, "español")
    .replace(/\balbumes\b/gi, "álbumes")
    .replace(/\bgaleria\b/gi, "galería")
    .replace(/\bcreditos\b/gi, "créditos")
    .replace(/\bimagenes\b/gi, "imágenes")
    .replace(/\btematicos\b/gi, "temáticos")
    .replace(/\btematicas\b/gi, "temáticas")
    .replace(/\bdireccion\b/gi, "dirección")
    .replace(/\bsegun\b/gi, "según")
    .replace(/\bsesion\b/gi, "sesión");
}

function themeFaqQuestions(site: Site, input: JsonLdInput | undefined, section: ThemePageJson["sections"][string]): Array<[string, string]> {
  const pageSlug = input?.pagePath?.split("/").filter(Boolean).pop() ?? "";
  const selectedPack = input?.creativePacks
    ?.filter((pack) => pack.status === "active" && pack.outputCount > 0 && pack.creditCost > 0)
    .find((pack) => packMatchesCollectionSlug(site, pack, pageSlug));
  if (!selectedPack) return [];
  const label = cleanText(selectedPack?.name, cleanText(section.settings.label, "this package"));
  const outputCount = selectedPack.outputCount;
  const creditCost = selectedPack.creditCost;
  const aidreamcapes = isAidreamcapesSite(site);
  const spanishXby = isSpanishXbySite(site);
  if (spanishXby) {
    return [
      [`Que es el paquete ${label}?`, aidreamcapes
        ? `${label} es un album privado que convierte fotos fuente aprobadas en una galeria de ocasion con creditos visibles y resultados listos para descargar.`
        : `${label} es un tema que convierte fotos fuente aprobadas en una galeria privada con estilo consistente, creditos visibles y resultados listos para descargar.`],
      [`Que fotos fuente funcionan mejor para ${label}?`, "Usa fotos claras, bien iluminadas y con permiso de uso. Evita capturas, recortes pequenos, filtros pesados e imagenes de personas sin consentimiento."],
      [`Cuantas imagenes crea ${label}?`, `Este paquete esta configurado para ${outputCount} imagenes, y el coste de ${creditCost} creditos se muestra antes de iniciar la solicitud.`],
      [aidreamcapes ? "Donde quedan los albumes terminados?" : "Donde quedan las imagenes terminadas?", "Los resultados terminados permanecen en tu galeria privada para revisar, conservar y descargar."],
      ["Que ocurre si falla la generacion?", "Si una solicitud del proveedor se interrumpe antes de la entrega, los creditos reservados se liberan o se devuelven segun el estado."]
    ];
  }
  return [
    [`What is the ${label} package?`, aidreamcapes
      ? `${label} is a focused Aidreamcapes private album that turns approved source photos into fan, game-day, premiere, holiday, creator, or occasion imagery with visible credit cost and download-ready results. It is designed for customers who want a private gallery around one clear moment instead of a generic image generator.`
      : `${label} is a focused MyDreamShoots theme that turns approved source photos into a private gallery with consistent styling, visible credit cost, and download-ready results. Use it when you want a specific AI photo set for profiles, creator content, seasonal cards, personal-brand visuals, or social-ready albums.`],
    [`Which source photos work best for ${label}?`, aidreamcapes
      ? "Use clear, well-lit photos you own or have permission to use, with every person visible and approved for the intended album. Avoid screenshots, tiny crops, heavy filters, overlapping faces, official logos, public-figure references, and images that could imply a false endorsement."
      : "Use clear, well-lit photos you own or have permission to use, with faces or subjects visible from a few useful angles. Avoid screenshots, tiny crops, heavy filters, blurred selfies, text-heavy graphics, and images of people who have not consented."],
    [`How many images does ${label} create and how many credits does it use?`, `This package is configured for ${outputCount} images, and the ${creditCost}-credit cost is shown before the generation request starts. Review the output count, source-photo requirements, and gallery goal before reserving credits.`],
    [`Can I use ${label} results for social media or business content?`, aidreamcapes
      ? "You can share suitable results when everyone shown has approved the use, platform rules are followed, AI disclosure is handled where required, and the post does not imply an official relationship with a team, league, celebrity, venue, or brand."
      : "You can use suitable results for profiles, social posts, creator pages, cards, or business drafts when you control the source photos, every person shown has approved the use, and the destination platform rules and AI disclosure requirements are followed."],
    [aidreamcapes ? "Where do finished albums go?" : "Where do finished images go?", aidreamcapes ? "Finished Aidreamcapes images stay inside your signed-in private gallery, where you can review faces, hands, marks, crops, and overall realism before downloading the results that fit your occasion." : "Finished results stay inside your signed-in private gallery, where you can review identity details, hands, backgrounds, crops, and overall realism before downloading the images that fit your intended channel."],
    ["What happens if generation fails?", "If a provider request is interrupted before delivery, reserved credits are released or returned according to the request status so you can retry from the workspace. Keep the job reference if you contact support about a failed generation, missing gallery, or credit question."]
  ];
}

function faqSchema(site: Site, pageJson: ThemePageJson | undefined, input?: JsonLdInput): JsonLdNode | undefined {
  if (isAidreamshootsEngagementFrenchPage(site, input?.pagePath)) {
    const mainEntity = AIDREAMSHOOTS_ENGAGEMENT_FRENCH_COPY.faqItems
      .map(([question, answer]) => faqQuestionNode(site, question, answer))
      .filter(Boolean) as JsonLdNode[];
    return {
      "@type": "FAQPage",
      inLanguage: "es-ES",
      mainEntity
    };
  }
  if (site.id === "site_aidreamcapes_xby" && input?.pagePath === "/tools") {
    return {
      "@type": "FAQPage",
      inLanguage: "fr-FR",
      mainEntity: AIDREAMCAPES_EU_TOOLS_FAQ
        .map(([question, answer]) => faqQuestionNode(site, question, answer))
        .filter(Boolean) as JsonLdNode[]
    };
  }
  if (site.id === "site_aidreamcapes_xby" && isAidreamcapesEuSaveTheDatePage(site, input?.pagePath)) {
    return {
      "@type": "FAQPage",
      inLanguage: "fr-FR",
      mainEntity: [
        faqQuestionNode(site, "Que permet de créer cette vidéo d’annonce ?", "Créez une vidéo personnalisée à partir de vos photos et partagez un message clair pour votre occasion."),
        faqQuestionNode(site, "Quelles photos utiliser pour commencer ?", "Utilisez des photos nettes dont vous détenez les droits ou l’autorisation, avec les personnes clairement visibles.")
      ].filter(Boolean)
    };
  }
  const aidreamcapesEuVideo = input?.pagePath && site.id === "site_aidreamcapes_xby"
    ? aidreamcapesEuVideoTopicFromPath(input.pagePath)
    : undefined;
  if (aidreamcapesEuVideo) {
    const mainEntity = [
      faqQuestionNode(site, `Que permet de créer ${aidreamcapesEuVideo.label.toLowerCase()} ?`, aidreamcapesEuVideo.description),
      faqQuestionNode(site, "Quelles photos utiliser pour commencer ?", "Utilisez des images nettes dont vous détenez les droits ou l’autorisation, avec un sujet clairement visible et une intention visuelle précise.")
    ].filter(Boolean) as JsonLdNode[];
    return { "@type": "FAQPage", inLanguage: "fr-FR", mainEntity };
  }
  const aidreamcapesEuSlug = input?.pagePath ? aidreamcapesEuThemeSlug(site, input.pagePath) : undefined;
  if (aidreamcapesEuSlug) {
    const section = pageJson?.sectionsOrder
      ?.map((sectionId) => pageJson.sections[sectionId])
      .find((candidate) => candidate?.type === "faq");
    const visibleItems = section?.blocks?.map((block) => [
      blockValue(block, "question", blockValue(block, "title")),
      faqAnswerText(block)
    ] as [string, string]) ?? [];
    const content = aidreamcapesEuSeoContentForSlug(aidreamcapesEuSlug);
    const sourceItems = visibleItems.length ? visibleItems : (content?.faqItems ?? []);
    const seen = new Set<string>();
    const mainEntity = sourceItems
      .filter(([question, answer]) => {
        const signature = `${cleanText(question)}\n${cleanText(answer)}`;
        if (!question || !answer || seen.has(signature)) return false;
        seen.add(signature);
        return true;
      })
      .map(([question, answer]) => faqQuestionNode(site, question, answer))
      .filter(Boolean) as JsonLdNode[];
    return mainEntity.length ? { "@type": "FAQPage", inLanguage: "fr-FR", mainEntity } : undefined;
  }
  if (input?.pagePath && isAidreamcapesImageThemePath(site.slug, input.pagePath)) {
    const section = sectionOfType(pageJson, "ai_image_theme_landing");
    const content = section ? imageThemeDetailContentFromSection(section) : undefined;
    const mainEntity = (content?.faq.items ?? [])
      .map((item) => faqQuestionNode(site, item.question, item.answer))
      .filter(Boolean) as JsonLdNode[];
    return mainEntity.length ? { "@type": "FAQPage", inLanguage: "en", mainEntity } : undefined;
  }
  if (!hasPageSections(pageJson)) return undefined;
  if (input?.pagePath.startsWith("/blog/")) return undefined;
  const questions = pageJson.sectionsOrder.flatMap((sectionId) => {
    const section = pageJson.sections[sectionId];
    if (section?.type === "dreamshoot_theme_faq") {
      return themeFaqQuestions(site, input, section)
        .map(([question, answer]) => faqQuestionNode(site, question, answer))
        .filter(Boolean) as JsonLdNode[];
    }
    if (section?.type === "ai_video_topic_landing") {
      const content = aiVideoTopicLandingContentFromSection(section);
      return (content?.faq.items ?? [])
        .map((item) => faqQuestionNode(site, item.question, item.answer))
        .filter(Boolean) as JsonLdNode[];
    }
    if (section?.type === "talking_photo_landing") {
      const content = talkingPhotoContentFromSection(section);
      return (content?.faq.items ?? [])
        .map((item) => faqQuestionNode(site, item.question, item.answer))
        .filter(Boolean) as JsonLdNode[];
    }
    if (section?.type !== "faq") return [];
    const blocks = section.blocks?.length
      ? section.blocks
      : listText(section.settings.items).map((item, index) => {
          const [question = "", answer = ""] = item.split("::");
          return { id: `faq_${index}`, type: "faq_item", settings: { question, answer } };
        });
    return blocks
      .map((block) => faqQuestionNode(site, blockValue(block, "question", blockValue(block, "title")), faqAnswerText(block)))
      .filter(Boolean) as JsonLdNode[];
  });
  const seenNames = new Set<string>();
  const uniqueQuestions = questions.filter((question) => {
    const name = typeof question.name === "string" ? question.name : "";
    if (!name || seenNames.has(name)) return false;
    seenNames.add(name);
    return true;
  });
  return uniqueQuestions.length
    ? {
        "@type": "FAQPage",
        ...(site.id === "site_aidreamcapes_xby" ? { inLanguage: "fr-FR" } : {}),
        ...(isAidreamcapesEuSaveTheDatePage(site, input?.pagePath) ? { inLanguage: "fr-FR" } : {}),
        mainEntity: uniqueQuestions
      }
    : undefined;
}

function articleSchema(site: Site, routeMode: "host" | "path", pagePath: string, title: string, description: string, pageJson: ThemePageJson | undefined): JsonLdNode | undefined {
  const isArticle = pagePath.startsWith("/blog/") || /^(article|post)$/i.test(pageJson?.pageType ?? "");
  if (!isArticle) return undefined;
  const image = articleSectionValue(pageJson, "imageUrl") || sectionValue(pageJson, "backgroundImage");
  const author = articleSectionValue(pageJson, "author") || siteBrandName(site);
  const authorType = articleSectionValue(pageJson, "authorType") === "Organization" ? "Organization" : "Person";
  const authorUrl = articleSectionValue(pageJson, "authorUrl");
  const datePublished = articleSectionValue(pageJson, "publishedAt");
  const dateModified = articleSectionValue(pageJson, "updatedAt") || datePublished;
  const tags = listText(sectionOfType(pageJson, "blog_article")?.settings.tags);
  return {
    "@type": "BlogPosting",
    ...(site.id === "site_aidreamcapes_xby" ? { inLanguage: "fr-FR" } : {}),
    headline: articleSectionValue(pageJson, "title") || title,
    // Use the final page SEO description so BlogPosting stays aligned with
    // the document metadata and any route-specific SEO override.
    description,
    author: {
      "@type": authorType,
      name: cleanSchemaText(site, author),
      ...(authorUrl ? { url: absoluteUrl(site, routeMode, authorUrl) } : {})
    },
    publisher: {
      "@type": "Organization",
      name: siteBrandName(site),
      url: storefrontBaseUrl(site, routeMode),
      ...(storefrontOriginalLogoUrl(site) || isPrimaryMyDreamShootsSite(site) || hasAidreamshootsBranding(site) ? {
        logo: {
          "@type": "ImageObject",
          url: storefrontOriginalLogoUrl(site)
            ? absoluteUrl(site, routeMode, storefrontOriginalLogoUrl(site))
            : absoluteUrl(site, routeMode, hasAidreamshootsBranding(site)
              ? "/assets/sites/site_aidreamshoots/brand/aidreamshoots-logo-refined.svg?v=20260919original"
              : "/assets/dreamshoot/brand/dreamshootai-logo-refined.svg?v=20260621b"),
          contentUrl: storefrontOriginalLogoUrl(site)
            ? absoluteUrl(site, routeMode, storefrontOriginalLogoUrl(site))
            : absoluteUrl(site, routeMode, hasAidreamshootsBranding(site)
              ? "/assets/sites/site_aidreamshoots/brand/aidreamshoots-logo-refined.svg?v=20260919original"
              : "/assets/dreamshoot/brand/dreamshootai-logo-refined.svg?v=20260621b")
        }
      } : {})
    },
    mainEntityOfPage: absoluteUrl(site, routeMode, schemaPagePath(site, routeMode, pagePath)),
    ...(datePublished ? { datePublished } : {}),
    ...(dateModified ? { dateModified } : {}),
    ...(tags.length ? { keywords: tags.join(", ") } : {}),
    ...(image ? { image: absoluteUrl(site, routeMode, image) } : {})
  };
}

function publishedStandardPageSchema(input: JsonLdInput, title: string, description: string): JsonLdNode | undefined {
  const media = input.context.publishedStandardPageMedia;
  if (!media || media.status !== "ready") return undefined;
  const url = absoluteUrl(input.site, input.routeMode, schemaPagePath(input.site, input.routeMode, input.context.seo.canonicalPath));
  return {
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    name: title,
    description,
    url,
    ...(input.site.id === "site_aidreamcapes_xby" ? { inLanguage: "fr-FR" } : {}),
    primaryImageOfPage: {
      "@type": "ImageObject",
      "@id": `${url}#primaryimage`,
      url: absoluteUrl(input.site, input.routeMode, media.jsonLdImage),
      contentUrl: absoluteUrl(input.site, input.routeMode, media.jsonLdImage),
      caption: media.primaryImageAlt
    }
  };
}

function spanishStorefrontWebPageSchema(input: JsonLdInput, title: string, description: string): JsonLdNode | undefined {
  if (!isAidreamshootsStorefrontSite(input.site) || !input.context.seo.index) return undefined;
  const path = schemaPagePath(input.site, input.routeMode, input.pagePath);
  const url = absoluteUrl(input.site, input.routeMode, path);
  const media = input.context.publishedPageMedia?.status === "ready"
    ? input.context.publishedPageMedia.primaryImage
    : input.context.publishedStandardPageMedia?.status === "ready"
      ? input.context.publishedStandardPageMedia.jsonLdImage
      : input.context.seo.ogImage;
  return {
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    name: title,
    description,
    url,
    inLanguage: "es-ES",
    ...(media ? {
      primaryImageOfPage: {
        "@type": "ImageObject",
        "@id": `${url}#primaryimage`,
        url: absoluteUrl(input.site, input.routeMode, media),
        contentUrl: absoluteUrl(input.site, input.routeMode, media)
      }
    } : {}),
    isPartOf: { "@id": `${storefrontBaseUrl(input.site, input.routeMode)}#website` },
    publisher: { "@id": `${storefrontBaseUrl(input.site, input.routeMode)}#organization` },
    mainEntityOfPage: url
  };
}

function aidreamcapesEuPublicWebPageSchema(input: JsonLdInput, title: string, description: string): JsonLdNode | undefined {
  if (input.site.id !== "site_aidreamcapes_xby" || aidreamcapesEuThemeSlug(input.site, input.pagePath)) return undefined;
  const url = absoluteUrl(input.site, input.routeMode, schemaPagePath(input.site, input.routeMode, input.pagePath));
  return {
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    name: title,
    description,
    url,
    inLanguage: "fr-FR",
    isPartOf: { "@id": `${storefrontBaseUrl(input.site, input.routeMode)}#website` },
    publisher: { "@id": `${storefrontBaseUrl(input.site, input.routeMode)}#organization` }
  };
}

function policyWebPageSchema(input: JsonLdInput, title: string, description: string): JsonLdNode | undefined {
  if (!isMydreamshootsComSite(input.site) || !new Set(["/terms", "/state-privacy"]).has(input.pagePath)) return undefined;
  const url = absoluteUrl(input.site, input.routeMode, schemaPagePath(input.site, input.routeMode, input.pagePath));
  return {
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    name: title,
    description,
    url,
    isPartOf: { "@id": `${storefrontBaseUrl(input.site, input.routeMode)}#website` },
    publisher: { "@id": `${storefrontBaseUrl(input.site, input.routeMode)}#organization` }
  };
}

function serviceOrProductSchema(input: JsonLdInput, title: string, description: string): JsonLdNode[] {
  const path = input.pagePath;
  if (hasAidreamshootsBranding(input.site) && path.startsWith("/ai-save-the-date/")) {
    return [{
      "@type": "Service",
      name: title,
      description,
      provider: { "@id": `${storefrontBaseUrl(input.site, input.routeMode)}#organization` },
      serviceType: "servicio de fotos y vídeos para celebraciones con IA",
      url: absoluteUrl(input.site, input.routeMode, schemaPagePath(input.site, input.routeMode, path))
    }];
  }
  if (path.startsWith("/tools/") || path.startsWith("/ai-video-generation/")) {
    return [{
      "@type": "Service",
      name: title,
      description,
      ...(input.site.id === "site_aidreamcapes_xby" ? { inLanguage: "fr-FR" } : {}),
      provider: { "@type": "Organization", name: siteBrandName(input.site) },
      serviceType: schemaServiceType(input.site, path),
      url: absoluteUrl(input.site, input.routeMode, schemaPagePath(input.site, input.routeMode, path))
    }];
  }
  if (path.startsWith("/pricing")) {
    const siteName = siteBrandName(input.site);
    const url = absoluteUrl(input.site, input.routeMode, schemaPagePath(input.site, input.routeMode, path));
    const activeOffers = projectPublicPricingOffers(input.context);
    const offers = activeOffers.map(({ product, price, checkoutEnabled }) => ({
        "@type": "Offer",
        name: price.label || product.name,
        price: (price.amountCents / 100).toFixed(2),
        priceCurrency: price.currency.toUpperCase(),
        availability: checkoutEnabled ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        category: isSpanishXbySite(input.site)
          ? product.type === "subscription" ? "suscripcion de fotos IA" : "paquete de creditos IA"
          : input.site.id === "site_aidreamcapes_xby"
            ? product.type === "subscription" ? "abonnement de création photo IA" : "forfait de crédits IA"
          : product.type === "subscription" ? "AI photo subscription" : "AI photo credit pack",
        description: isSpanishXbySite(input.site)
          ? `${price.creditsGranted} creditos${price.interval === "one_time" ? "" : ` por ${price.interval}`}`
          : input.site.id === "site_aidreamcapes_xby"
            ? `${price.creditsGranted} crédits${price.interval === "one_time" ? "" : ` par ${price.interval}`}`
          : `${price.creditsGranted} credits${price.interval === "one_time" ? "" : ` per ${price.interval}`}`,
        url
      }));
    const offerCatalog = offers.length
      ? {
          "@type": "OfferCatalog",
          "@id": `${url}#offers`,
          name: isSpanishXbySite(input.site)
            ? `${siteName} planes y paquetes de creditos`
            : input.site.id === "site_aidreamcapes_xby" ? `${siteName} abonnements et forfaits de crédits` : `${siteName} plans and credit packs`,
          itemListElement: offers
        }
      : undefined;
    const catalogLink = offerCatalog
      ? isMydreamshootsComSite(input.site) || input.site.id === "site_aidreamcapes"
        ? { hasOfferCatalog: { "@id": `${url}#offers` } }
        : { offers: { "@id": `${url}#offers` } }
      : {};
    return [
      {
        "@type": "Service",
        name: title,
        description,
        ...(input.site.id === "site_aidreamcapes_xby" ? { inLanguage: "fr-FR" } : {}),
        provider: { "@type": "Organization", name: siteName },
        serviceType: isSpanishXbySite(input.site)
          ? isAidreamcapesSite(input.site) ? "servicio de retratos de viaje IA" : "servicio de generacion de fotos IA"
          : isAidreamcapesSite(input.site) ? "AI occasion portrait generation service" : "AI photo generation service",
        url,
        ...catalogLink
      },
      {
        "@type": "SoftwareApplication",
        name: siteName,
        description,
        ...(input.site.id === "site_aidreamcapes_xby" ? { inLanguage: "fr-FR" } : {}),
        applicationCategory: input.site.id === "site_aidreamcapes" ? "MultimediaApplication" : "PhotographyApplication",
        operatingSystem: "Web",
        url,
        provider: { "@type": "Organization", name: siteName },
        ...(input.site.id === "site_aidreamcapes" ? { offers } : offerCatalog && !isMydreamshootsComSite(input.site) ? { offers: { "@id": `${url}#offers` } } : {})
      },
      offerCatalog
    ].filter(Boolean) as JsonLdNode[];
  }
  return [];
}

function imageMediaPath(value: unknown): string {
  const text = cleanText(value);
  return /\.(?:avif|jpe?g|png|webp)(?:[?#]|$)/i.test(text) ? text : "";
}

function mediaEncodingFormat(value: unknown): string {
  const pathname = cleanText(value).split(/[?#]/)[0].toLowerCase();
  if (pathname.endsWith(".avif")) return "image/avif";
  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return "image/jpeg";
  if (pathname.endsWith(".png")) return "image/png";
  if (pathname.endsWith(".webp")) return "image/webp";
  if (pathname.endsWith(".mp4")) return "video/mp4";
  if (pathname.endsWith(".webm")) return "video/webm";
  return "";
}

type ImageDimensions = {
  width: number;
  height: number;
};

const imageDimensionsCache = new Map<string, ImageDimensions | undefined>();

function localPublicAssetPath(value: unknown): string {
  const text = cleanText(value).split(/[?#]/)[0];
  if (!text) return "";
  let pathname = "";
  if (text.startsWith("http://") || text.startsWith("https://")) {
    try {
      pathname = new URL(text).pathname;
    } catch {
      return "";
    }
  } else {
    pathname = text;
  }
  if (!pathname.startsWith("/assets/")) return "";
  return path.join(process.cwd(), "public", pathname.replace(/^\/+/, ""));
}

function imageDimensionsFromPng(buffer: Buffer): ImageDimensions | undefined {
  if (buffer.length < 24 || buffer.toString("ascii", 1, 4) !== "PNG") return undefined;
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return width > 0 && height > 0 ? { width, height } : undefined;
}

function imageDimensionsFromWebp(buffer: Buffer): ImageDimensions | undefined {
  if (buffer.length < 30 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") return undefined;
  const chunk = buffer.toString("ascii", 12, 16);
  if (chunk === "VP8X") {
    const width = buffer.readUIntLE(24, 3) + 1;
    const height = buffer.readUIntLE(27, 3) + 1;
    return width > 0 && height > 0 ? { width, height } : undefined;
  }
  if (chunk === "VP8L" && buffer.length >= 25 && buffer[20] === 0x2f) {
    const bits = buffer.readUInt32LE(21);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >> 14) & 0x3fff) + 1;
    return width > 0 && height > 0 ? { width, height } : undefined;
  }
  if (chunk === "VP8 " && buffer.length >= 30) {
    const width = buffer.readUInt16LE(26) & 0x3fff;
    const height = buffer.readUInt16LE(28) & 0x3fff;
    return width > 0 && height > 0 ? { width, height } : undefined;
  }
  return undefined;
}

function imageDimensionsFromJpeg(buffer: Buffer): ImageDimensions | undefined {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return undefined;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const segmentLength = buffer.readUInt16BE(offset + 2);
    if (segmentLength < 2 || offset + 2 + segmentLength > buffer.length) return undefined;
    const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isStartOfFrame) {
      const height = buffer.readUInt16BE(offset + 5);
      const width = buffer.readUInt16BE(offset + 7);
      return width > 0 && height > 0 ? { width, height } : undefined;
    }
    offset += 2 + segmentLength;
  }
  return undefined;
}

function imageDimensions(value: unknown): ImageDimensions | undefined {
  const filePath = localPublicAssetPath(value);
  if (!filePath) return undefined;
  if (imageDimensionsCache.has(filePath)) return imageDimensionsCache.get(filePath);
  let dimensions: ImageDimensions | undefined;
  try {
    const buffer = fs.readFileSync(filePath);
    dimensions = imageDimensionsFromPng(buffer) ?? imageDimensionsFromWebp(buffer) ?? imageDimensionsFromJpeg(buffer);
  } catch {
    dimensions = undefined;
  }
  imageDimensionsCache.set(filePath, dimensions);
  return dimensions;
}

function uniqueMediaPaths(values: unknown[], mediaPath: (value: unknown) => string, limit: number): string[] {
  const paths: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const path = mediaPath(value);
    if (!path || seen.has(path)) continue;
    seen.add(path);
    paths.push(path);
    if (paths.length >= limit) break;
  }
  return paths;
}

function packImagePaths(pack: CreativePack): string[] {
  return uniqueMediaPaths([pack.imageUrl, ...(pack.galleryImages ?? [])], imageMediaPath, 13);
}

function primaryPackImage(pack: CreativePack): string {
  return packImagePaths(pack)[0] || "";
}

function subjectImageForPack(pack: CreativePack): string {
  return (pack.galleryImages ?? []).map(imageMediaPath).find(Boolean) || primaryPackImage(pack);
}

function packMatchesCollectionSlug(site: Site, pack: CreativePack, slug: string): boolean {
  if (isPrimaryMyDreamShootsSite(site)) {
    return canonicalCollectionSlugForCandidate(site, pack.categoryRecord?.slug || pack.category) === slug;
  }
  const candidates = [
    pack.categoryRecord?.slug,
    pack.categoryRecord?.parent?.slug,
    pack.category,
    pack.name,
    pack.id
  ];
  const canonicalCandidates = candidates
    .map((candidate) => canonicalCollectionSlugForCandidate(site, candidate))
    .filter(Boolean)
  if (canonicalCandidates.includes(slug)) return true;
  return isSpanishXbySite(site) && candidates
    .map((candidate) => slugifySchemaPart(cleanText(candidate)))
    .filter(Boolean)
    .includes(slug);
}

function packProductSchema({
  site,
  routeMode,
  pagePath,
  pack,
  description
}: {
  site: Site;
  routeMode: "host" | "path";
  pagePath: string;
  pack: CreativePack;
  description: string;
}): JsonLdNode | undefined {
  if (!isPrimaryMyDreamShootsSite(site) && !isSpanishXbySite(site)) return undefined;
  const imagePaths = packImagePaths(pack);
  const image = imagePaths[0];
  if (!image) return undefined;
  const subjectImage = subjectImageForPack(pack) || image;
  const url = absoluteUrl(site, routeMode, schemaPagePath(site, routeMode, pagePath));
  const subjectImageUrl = absoluteUrl(site, routeMode, subjectImage);
  const primaryImageUrl = absoluteUrl(site, routeMode, image);
  const xbyContent = isSpanishXbySite(site)
    ? getSeoDirectoryContentForSite(site, "collection", pack.categoryRecord?.slug || pack.category)
    : undefined;
  const productName = cleanSchemaText(site, xbyContent?.label || pack.name, "MyDreamShoots AI photo package");
  const productDescription = cleanSchemaText(site, xbyContent?.description || pack.description, description);
  const subjectImageDimensions = imageDimensions(subjectImage);
  const additionalProperty: JsonLdNode[] = [
    {
      "@type": "PropertyValue",
      name: "Credit cost",
      value: pack.creditCost
    },
    {
      "@type": "PropertyValue",
      name: "Output count",
      value: pack.outputCount
    }
  ];
  return {
    "@type": "Product",
    "@id": `${url}#product`,
    name: productName,
    description: productDescription,
    sku: pack.id,
    brand: {
      "@type": "Brand",
      name: siteBrandName(site)
    },
    category: cleanSchemaText(site, xbyContent?.label || pack.categoryRecord?.label || pack.category, "AI photo package"),
    image: imagePaths.map((path) => absoluteUrl(site, routeMode, path)),
    url,
    ...(isSpanishXbySite(site) ? { inLanguage: "es-ES" } : {}),
    mainEntityOfPage: url,
    additionalProperty,
    subjectOf: {
      "@type": "ImageObject",
      "@id": `${url}#image`,
      name: `${productName} ${isSpanishXbySite(site) ? "imagen de muestra" : "preview image"}`,
      url: subjectImageUrl,
      contentUrl: subjectImageUrl,
      thumbnailUrl: primaryImageUrl,
      description: cleanSchemaText(site, isSpanishXbySite(site) ? `Imagen de muestra de ${productName}` : `Example preview image for ${productName}`, productDescription),
      caption: isSpanishXbySite(site) ? `Muestra visual de ${productName}` : `${productName} AI generated preview`,
      encodingFormat: mediaEncodingFormat(subjectImage) || mediaEncodingFormat(image),
      representativeOfPage: true,
      ...(subjectImageDimensions ? subjectImageDimensions : {})
    }
  };
}

// www.mydreamshoots.com theme packs are redeemed with credits, not sold as fiat SKUs, so the
// pack page no longer emits Product. These are the image fields Product used to carry; they move
// onto the page node so image structured data is not lost with it.
function packPageImagery({
  site,
  routeMode,
  pagePath,
  pack,
  description
}: {
  site: Site;
  routeMode: "host" | "path";
  pagePath: string;
  pack: CreativePack;
  description: string;
}): JsonLdNode | undefined {
  const imagePaths = packImagePaths(pack);
  const image = imagePaths[0];
  if (!image) return undefined;
  const subjectImage = subjectImageForPack(pack) || image;
  const url = absoluteUrl(site, routeMode, schemaPagePath(site, routeMode, pagePath));
  const subjectImageUrl = absoluteUrl(site, routeMode, subjectImage);
  const primaryImageUrl = absoluteUrl(site, routeMode, image);
  const packName = cleanSchemaText(site, pack.name, "MyDreamShoots AI photo package");
  const packDescription = cleanSchemaText(site, pack.description, description);
  const subjectImageDimensions = imageDimensions(subjectImage);
  return {
    image: imagePaths.map((path) => absoluteUrl(site, routeMode, path)),
    primaryImageOfPage: {
      "@type": "ImageObject",
      "@id": `${url}#image`,
      name: `${packName} preview image`,
      url: subjectImageUrl,
      contentUrl: subjectImageUrl,
      thumbnailUrl: primaryImageUrl,
      description: cleanSchemaText(site, `Example preview image for ${packName}`, packDescription),
      caption: `${packName} AI generated preview`,
      encodingFormat: mediaEncodingFormat(subjectImage) || mediaEncodingFormat(image),
      representativeOfPage: true,
      ...(subjectImageDimensions ? subjectImageDimensions : {})
    }
  };
}

function iso8601Duration(seconds: number): string {
  const totalSeconds = Math.max(1, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;
  return `PT${hours ? `${hours}H` : ""}${minutes ? `${minutes}M` : ""}${remainingSeconds || (!hours && !minutes) ? `${remainingSeconds}S` : ""}`;
}

function videoMediaPath(value: unknown): string {
  const text = cleanText(value);
  return /\.(?:mp4|webm)(?:[?#]|$)/i.test(text) ? text : "";
}

function normalizedUploadDate(value: unknown): string {
  const text = cleanText(value);
  if (!text) return "";
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function numericSetting(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(cleanText(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function showcaseVideoSlugs(pageJson: ThemePageJson | undefined): string[] {
  const showcase = sectionOfType(pageJson, "dreamshoot_generation_showcase");
  return listText(showcase?.settings.videoSlugs).map(slugifySchemaPart).filter(Boolean);
}

const blockedPublicVideoThemeSlugs = new Set(["creator-scene-motion"]);

function isBlockedPublicVideoTheme(site: Site, theme: VideoTheme): boolean {
  if (!isPrimaryMydreamshootsCapabilitySite(site) && site.id !== "site_aidreamcapes") return false;
  return blockedPublicVideoThemeSlugs.has(slugifySchemaPart(theme.slug));
}

function homeVideoObjectSchemas(input: JsonLdInput): JsonLdNode[] {
  if (!isPrimaryMyDreamShootsSite(input.site)) return [];
  // MyDreamShoots video content now has dedicated /ai-video-generation pages.
  // Keep homepage JSON-LD focused on the storefront instead of emitting legacy theme video objects.
  return [];
}

function editorialVideoObjectSchemas(input: JsonLdInput): JsonLdNode[] {
  if (!isPrimaryMyDreamShootsSite(input.site)) return [];
  const hero = sectionOfType(input.pageJson, "editorial_hero");
  if (!hero) return [];
  const firstVisual = hero.blocks?.find((block) => Boolean(blockValue(block, "imageUrl")));
  const videoUrl = videoMediaPath(hero.settings.videoUrl) || videoMediaPath(firstVisual?.settings.videoUrl);
  const thumbnailUrl = imageMediaPath(hero.settings.videoPosterUrl)
    || imageMediaPath(hero.settings.imageUrl)
    || imageMediaPath(firstVisual?.settings.imageUrl);
  if (!videoUrl || !thumbnailUrl) return [];
  const pageUrl = absoluteUrl(input.site, input.routeMode, schemaPagePath(input.site, input.routeMode, input.pagePath));
  const pageTitleValue = pageTitle(input.site, input.page, input.context);
  const pageDescriptionValue = pageDescription(input.site, input.page, input.context);
  const name = cleanSchemaText(input.site, hero.settings.videoTitle, pageTitleValue);
  const description = cleanSchemaText(input.site, hero.settings.videoDescription, pageDescriptionValue);
  const uploadDate = normalizedUploadDate(hero.settings.videoUploadDate) || normalizedUploadDate(input.page.updatedAt);
  if (!uploadDate) return [];
  const duration = iso8601Duration(numericSetting(hero.settings.videoDurationSeconds, 15));
  return [{
    "@type": "VideoObject",
    "@id": `${pageUrl}#video`,
    name,
    description,
    thumbnailUrl: [absoluteUrl(input.site, input.routeMode, thumbnailUrl)],
    uploadDate,
    duration,
    contentUrl: absoluteUrl(input.site, input.routeMode, videoUrl),
    url: pageUrl,
    mainEntityOfPage: pageUrl,
    isPartOf: { "@id": `${storefrontBaseUrl(input.site, input.routeMode)}#website` },
    publisher: { "@id": `${storefrontBaseUrl(input.site, input.routeMode)}#organization` },
    potentialAction: {
      "@type": "WatchAction",
      target: pageUrl
    }
  }];
}

function aidreamcapesEuVideoObjectSchemas(input: JsonLdInput): JsonLdNode[] {
  if (input.site.id !== "site_aidreamcapes_xby") return [];
  const media = aidreamcapesEuVideoTopicFromPath(input.pagePath);
  if (!media) return [];
  const pageUrl = absoluteUrl(input.site, input.routeMode, schemaPagePath(input.site, input.routeMode, input.pagePath));
  const uploadDate = normalizedUploadDate(input.page.updatedAt);
  return [{
    "@type": "VideoObject",
    "@id": `${pageUrl}#video`,
    name: media.title,
    description: media.description,
    inLanguage: "fr-FR",
    thumbnailUrl: [absoluteUrl(input.site, input.routeMode, media.posterUrl)],
    ...(uploadDate ? { uploadDate } : {}),
    duration: iso8601Duration(media.durationSeconds),
    contentUrl: absoluteUrl(input.site, input.routeMode, media.videoUrl),
    encodingFormat: "video/mp4",
    width: media.width,
    height: media.height,
    url: pageUrl,
    mainEntityOfPage: pageUrl,
    isPartOf: { "@id": `${storefrontBaseUrl(input.site, input.routeMode)}#website` },
    publisher: { "@id": `${storefrontBaseUrl(input.site, input.routeMode)}#organization` },
    potentialAction: { "@type": "WatchAction", target: pageUrl }
  }];
}

function aidreamcapesVideoFeatureObjectSchemas(input: JsonLdInput): JsonLdNode[] {
  if (!isAidreamcapesSite(input.site) || !hasPageSections(input.pageJson)) return [];
  const pageUrl = absoluteUrl(input.site, input.routeMode, schemaPagePath(input.site, input.routeMode, input.pagePath));
  const uploadDate = normalizedUploadDate(input.page.updatedAt);
  if (!pageUrl || !uploadDate) return [];
  const pageTitleValue = pageTitle(input.site, input.page, input.context);
  const pageDescriptionValue = pageDescription(input.site, input.page, input.context);
  return input.pageJson.sectionsOrder.flatMap((sectionId, index) => {
    const section = input.pageJson?.sections[sectionId];
    if (section?.type !== "video_feature") return [];
    const videoUrl = videoMediaPath(section.settings.videoUrl);
    const thumbnailUrl = imageMediaPath(section.settings.imageUrl) || imageMediaPath(section.settings.posterUrl);
    if (!videoUrl || !thumbnailUrl) return [];
    const name = cleanSchemaText(input.site, section.settings.title, pageTitleValue);
    const description = cleanSchemaText(input.site, section.settings.subtitle, pageDescriptionValue);
    return [{
      "@type": "VideoObject",
      "@id": `${pageUrl}#video-${index + 1}`,
      name,
      description,
      thumbnailUrl: [absoluteUrl(input.site, input.routeMode, thumbnailUrl)],
      uploadDate,
      duration: iso8601Duration(numericSetting(section.settings.videoDurationSeconds, 15)),
      contentUrl: absoluteUrl(input.site, input.routeMode, videoUrl),
      encodingFormat: mediaEncodingFormat(videoUrl),
      url: pageUrl,
      mainEntityOfPage: pageUrl,
      isPartOf: { "@id": `${storefrontBaseUrl(input.site, input.routeMode)}#website` },
      publisher: { "@id": `${storefrontBaseUrl(input.site, input.routeMode)}#organization` },
      potentialAction: { "@type": "WatchAction", target: pageUrl }
    }];
  });
}

function spanishVideoObjectSchemas(input: JsonLdInput): JsonLdNode[] {
  if (!isAidreamshootsStorefrontSite(input.site) || !input.context.seo.index) return [];
  const requestedSlug = aidreamshootsVideoTopicSlugForPath(input.pagePath);
  const slugs = input.pagePath === "/"
    ? Object.keys(AIDREAMSHOOTS_HOMEPAGE_VIDEO_MEDIA).filter((slug) => AIDREAMSHOOTS_HOMEPAGE_VIDEO_TITLES[slug])
    : requestedSlug ? [requestedSlug] : [];
  if (!slugs.length) return [];
  const pageUrl = absoluteUrl(input.site, input.routeMode, schemaPagePath(input.site, input.routeMode, input.pagePath));
  const pageDescriptionValue = pageDescription(input.site, input.page, input.context);
  const uploadDate = normalizedUploadDate(input.page.updatedAt);
  return slugs.flatMap((slug) => {
    const media = AIDREAMSHOOTS_HOMEPAGE_VIDEO_MEDIA[slug];
    if (!media || !uploadDate) return [];
    const name = cleanSchemaText(input.site, AIDREAMSHOOTS_HOMEPAGE_VIDEO_TITLES[slug], slug);
    const description = cleanSchemaText(input.site, AIDREAMSHOOTS_HOMEPAGE_VIDEO_SUBTITLES[slug], pageDescriptionValue);
    return [{
      "@type": "VideoObject",
      "@id": `${pageUrl}#video-${slug}`,
      name,
      description,
      thumbnailUrl: [absoluteUrl(input.site, input.routeMode, media.poster)],
      uploadDate,
      duration: iso8601Duration(media.durationSeconds),
      contentUrl: absoluteUrl(input.site, input.routeMode, media.video),
      url: pageUrl,
      mainEntityOfPage: pageUrl,
      inLanguage: "es-ES",
      isPartOf: { "@id": `${storefrontBaseUrl(input.site, input.routeMode)}#website` },
      publisher: { "@id": `${storefrontBaseUrl(input.site, input.routeMode)}#organization` },
      potentialAction: {
        "@type": "WatchAction",
        target: pageUrl
      }
    }];
  });
}

function collectionPageSchema(input: JsonLdInput, title: string, description: string): JsonLdNode[] {
  if (isAidreamcapesImageThemePath(input.site.slug, input.pagePath) || aidreamcapesEuThemeSlug(input.site, input.pagePath)) return [];
  if (!input.pagePath.startsWith("/collections") && !input.pagePath.startsWith("/ai-image-generation")) return [];
  const path = schemaPagePath(input.site, input.routeMode, input.pagePath);
  const url = absoluteUrl(input.site, input.routeMode, path);
  if (input.site.id === "site_aidreamcapes" && input.pagePath === "/ai-image-generation") {
    const itemListElement = AIDREAMCAPES_IMAGE_THEME_DEFINITIONS.map((definition, index) => {
      const themePath = `/ai-image-generation/${definition.slug}`;
      return {
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "Service",
          name: definition.label,
          description: `Aidreamcapes ${definition.label.toLowerCase()} workflow for ecommerce, campaign, and creator content.`,
          url: absoluteUrl(input.site, input.routeMode, schemaPagePath(input.site, input.routeMode, themePath))
        }
      };
    });
    return [
      {
        "@type": "CollectionPage",
        "@id": `${url}#aidreamcapes-image-directory`,
        name: title,
        description,
        url,
        inLanguage: "en",
        isPartOf: { "@id": `${storefrontBaseUrl(input.site, input.routeMode)}#website` },
        publisher: { "@id": `${storefrontBaseUrl(input.site, input.routeMode)}#organization` }
      },
      {
        "@type": "ItemList",
        "@id": `${url}#aidreamcapes-image-themes`,
        name: `${title} themes`,
        description,
        url,
        itemListElement
      }
    ];
  }
  const activePacks = projectPublicCreativePacks(input.context, input.creativePacks ?? input.context.catalog.activePacks);
  const engagementPage = isAidreamshootsEngagementFrenchPage(input.site, input.pagePath);
  const itemListElement = activePacks.length
    ? activePacks.map((pack, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "Service",
          name: cleanSchemaText(input.site, pack.name, title),
          description: cleanSchemaText(input.site, pack.description, description),
          url: absoluteUrl(
            input.site,
            input.routeMode,
            schemaPagePath(input.site, input.routeMode, canonicalSeoDirectoryPathForSite(input.site, "collection", slugifySchemaPart(pack.categoryRecord?.slug || pack.category || pack.name)))
          ),
          ...(pack.imageUrl ? { image: absoluteUrl(input.site, input.routeMode, pack.imageUrl) } : {})
        }
      }))
    : engagementPage
      ? [{
          "@type": "ListItem",
          position: 1,
          item: {
            "@type": "Service",
            name: "Fotos de compromiso con IA",
            description,
            url,
            image: absoluteUrl(input.site, input.routeMode, "/assets/sites/site_aidreamshoots/generated/regenerated/aidreamshoots-engagement-13-20260912-v1/occasion-2d7b23bf0f95.webp")
          }
        }]
      : [];
  return [
    {
      "@type": "CollectionPage",
      name: title,
      description,
      url,
      ...(input.site.id === "site_aidreamcapes_xby" ? { inLanguage: "fr-FR" } : engagementPage ? { inLanguage: "es-ES" } : {}),
      isPartOf: { "@id": `${storefrontBaseUrl(input.site, input.routeMode)}#website` },
      publisher: {
        "@type": "Organization",
        name: siteBrandName(input.site),
        url: storefrontBaseUrl(input.site, input.routeMode)
      }
    },
    {
      "@type": "ItemList",
      name: itemListName(input.site, title),
      description,
      url,
      itemListElement
    }
  ];
}

function aidreamcapesVideoDirectorySchema(input: JsonLdInput, title: string, description: string): JsonLdNode[] {
  if (input.site.id !== "site_aidreamcapes" || input.pagePath !== "/ai-video-generation") return [];
  const path = schemaPagePath(input.site, input.routeMode, input.pagePath);
  const url = absoluteUrl(input.site, input.routeMode, path);
  const groups = input.site.themeSettings.publishedJson.aidreamcapesZipNavigation?.video?.groups ?? [];
  const themes = groups.flatMap((group) => group.items ?? []);
  return [
    {
      "@type": "CollectionPage",
      "@id": `${url}#webpage`,
      name: title,
      description,
      url,
      inLanguage: "en",
      isPartOf: { "@id": `${storefrontBaseUrl(input.site, input.routeMode)}#website` },
      publisher: { "@id": `${storefrontBaseUrl(input.site, input.routeMode)}#organization` }
    },
    {
      "@type": "ItemList",
      "@id": `${url}#themes`,
      name: "Aidreamcapes AI video generation themes",
      description,
      url,
      numberOfItems: themes.length,
      itemListOrder: "https://schema.org/ItemListOrderAscending",
      itemListElement: themes.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.label,
        item: {
          "@type": "Service",
          name: item.label,
          url: absoluteUrl(input.site, input.routeMode, schemaPagePath(input.site, input.routeMode, item.href))
        }
      }))
    }
  ];
}

function aidreamcapesImageThemeDetailSchema(input: JsonLdInput, title: string, description: string): JsonLdNode[] {
  if (!isAidreamcapesImageThemePath(input.site.slug, input.pagePath)) return [];
  const path = schemaPagePath(input.site, input.routeMode, input.pagePath);
  const section = sectionOfType(input.pageJson, "ai_image_theme_landing");
  const content = section ? imageThemeDetailContentFromSection(section) : undefined;
  if (!content) return [];
  const configuredCanonical = canonicalAbsoluteUrlForSite(input.site, cleanText(content?.seo.canonical));
  const url = configuredCanonical && /^https?:\/\//i.test(configuredCanonical)
    ? configuredCanonical
    : absoluteUrl(input.site, input.routeMode, path);
  const primaryImage = content?.hero.outputImage;
  const primaryImageNode = primaryImage
    ? {
        "@type": "ImageObject",
        "@id": `${url}#primaryimage`,
        url: absoluteUrl(input.site, input.routeMode, primaryImage.src),
        contentUrl: absoluteUrl(input.site, input.routeMode, primaryImage.src),
        caption: primaryImage.alt,
        width: primaryImage.width,
        height: primaryImage.height
      }
    : undefined;
  return [
    {
      "@type": "WebPage",
      "@id": `${url}#webpage`,
      name: title,
      description,
      url,
      inLanguage: "en",
      ...(primaryImageNode ? { primaryImageOfPage: primaryImageNode } : {}),
      isPartOf: { "@id": `${storefrontBaseUrl(input.site, input.routeMode)}#website` },
      publisher: { "@id": `${storefrontBaseUrl(input.site, input.routeMode)}#organization` }
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${url}#application`,
      name: content.schema.applicationName,
      description,
      inLanguage: "fr-FR",
      applicationCategory: "BusinessApplication",
      applicationSubCategory: content.schema.applicationSubCategory,
      operatingSystem: "Web",
      url,
      provider: { "@id": `${storefrontBaseUrl(input.site, input.routeMode)}#organization` }
    },
    {
      "@type": "Service",
      "@id": `${url}#service`,
      name: title,
      description,
      inLanguage: "fr-FR",
      serviceType: content.schema.serviceType,
      provider: { "@id": `${storefrontBaseUrl(input.site, input.routeMode)}#organization` },
      url
    }
  ];
}

function aidreamcapesEuImageThemeDetailSchema(input: JsonLdInput, title: string, description: string): JsonLdNode[] {
  const slug = aidreamcapesEuThemeSlug(input.site, input.pagePath);
  if (!slug) return [];
  const content = aidreamcapesEuSeoContentForSlug(slug);
  if (!content) return [];
  const path = schemaPagePath(input.site, input.routeMode, input.pagePath);
  const url = absoluteUrl(input.site, input.routeMode, path);
  const pack = aidreamcapesEuThemePack(input, slug);
  const image = pack?.imageUrl?.trim();
  const primaryImage = image
    ? {
        "@type": "ImageObject",
        "@id": `${url}#primaryimage`,
        url: absoluteUrl(input.site, input.routeMode, image),
        contentUrl: absoluteUrl(input.site, input.routeMode, image),
        caption: content.label
      }
    : undefined;
  return [
    {
      "@type": "WebPage",
      "@id": `${url}#webpage`,
      name: content.title || title,
      description: content.description || description,
      url,
      inLanguage: "fr-FR",
      ...(primaryImage ? { primaryImageOfPage: primaryImage } : {}),
      isPartOf: { "@id": `${storefrontBaseUrl(input.site, input.routeMode)}#website` },
      publisher: { "@type": "Organization", name: siteBrandName(input.site), url: storefrontBaseUrl(input.site, input.routeMode) }
    }
  ];
}

function websiteSchema(site: Site, routeMode: "host" | "path"): JsonLdNode {
  const baseUrl = storefrontBaseUrl(site, routeMode);
  return {
    "@type": "WebSite",
    "@id": `${baseUrl}#website`,
    name: siteBrandName(site),
    url: baseUrl,
    ...(site.id === "site_aidreamcapes"
      ? {
          potentialAction: {
            "@type": "SearchAction",
            target: `${baseUrl}search?q={search_term_string}`,
            "query-input": "required name=search_term_string"
          }
        }
      : {}),
    ...(site.id === "site_aidreamcapes_xby"
      ? { inLanguage: "fr-FR" }
      : isAidreamshootsStorefrontSite(site) ? { inLanguage: "es-ES" } : {})
  };
}

function storefrontApplicationSchema(input: JsonLdInput, title: string, description: string): JsonLdNode | undefined {
  const isHome = input.pagePath === "/" || input.page.slug === "/";
  if (!isHome) return undefined;
  const siteName = siteBrandName(input.site);
  return {
    "@type": "SoftwareApplication",
    "@id": `${storefrontBaseUrl(input.site, input.routeMode)}#app`,
    name: siteName,
    description,
    ...(input.site.id === "site_aidreamcapes_xby" ? { inLanguage: "fr-FR" } : {}),
    applicationCategory: input.site.id === "site_aidreamcapes" ? "MultimediaApplication" : "PhotographyApplication",
    operatingSystem: "Web",
    url: absoluteUrl(input.site, input.routeMode, schemaPagePath(input.site, input.routeMode, input.pagePath)),
    provider: { "@id": `${storefrontBaseUrl(input.site, input.routeMode)}#organization` },
    ...(input.site.id === "site_aidreamcapes"
      ? { offers: projectPublicPricingOffers(input.context).map(({ product, price }) => ({
          "@type": "Offer",
          name: price.label || product.name,
          price: (price.amountCents / 100).toFixed(2),
          priceCurrency: price.currency.toUpperCase(),
          url: absoluteUrl(input.site, input.routeMode, schemaPagePath(input.site, input.routeMode, "/pricing"))
        })) }
      : !isMydreamshootsComSite(input.site) ? { offers: homepageOfferCatalogSchema(input.site, input.routeMode) } : {})
  };
}

// Aidreamcapes.com v2 pages carry their page-specific JSON-LD nodes in
// LivePage.contentJson.seo.jsonLd (built with the page copy), so the structured data
// always matches the visible page. The Organization node and the homepage #app node
// still come from the site profile, exactly as on every other storefront page.
// Other sites never match here.
function aidreamcapesV2StoredGraph(site: Site, pageJson: ThemePageJson | undefined): JsonLdNode[] | undefined {
  if (site.id !== "site_aidreamcapes" || !pageJson) return undefined;
  const isV2 = pageJson.sectionsOrder?.some((sectionId) => pageJson.sections?.[sectionId]?.type === "aidreamcapes_v2_page");
  const graph = (pageJson.seo as { jsonLd?: { "@graph"?: unknown } } | undefined)?.jsonLd?.["@graph"];
  return isV2 && Array.isArray(graph) ? (graph as JsonLdNode[]) : undefined;
}

// Stored v2 graphs written before the move to www.aivideosugc.com name the former address; show every URL at the current origin.
const AIDREAMCAPES_FORMER_ORIGIN_RE = /^https:\/\/(?:www\.)?(?:aidreamcapes|aivideosugc)\.com(?=\/|$)/i;
function withAidreamcapesOrigin<T>(value: T): T {
  if (typeof value === "string") return value.replace(AIDREAMCAPES_FORMER_ORIGIN_RE, "https://www.aivideosugc.com") as T;
  if (Array.isArray(value)) return value.map((item) => withAidreamcapesOrigin(item)) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, withAidreamcapesOrigin(item)])) as T;
  return value;
}

function aidreamcapesV2JsonLd(input: JsonLdInput, storedGraph: JsonLdNode[]): JsonLdNode[] {
  const seo = input.pageJson?.seo as { title?: unknown; description?: unknown } | undefined;
  const title = cleanText(seo?.title) || pageTitle(input.site, input.page, input.context);
  const description = cleanText(seo?.description) || pageDescription(input.site, input.page, input.context);
  const graph: Array<JsonLdNode | undefined> = [
    organizationSchema(input.site, input.routeMode, input.context, input.pagePath),
    storefrontApplicationSchema(input, title, description),
    ...withAidreamcapesOrigin(storedGraph.filter((node) => node["@type"] !== "Organization"))
  ];
  return [{ "@context": "https://schema.org", "@graph": graph.filter(Boolean) }];
}

export function buildStorefrontJsonLd(input: JsonLdInput): JsonLdNode[] {
  const aidreamcapesV2Graph = aidreamcapesV2StoredGraph(input.site, input.pageJson);
  if (aidreamcapesV2Graph) return aidreamcapesV2JsonLd(input, aidreamcapesV2Graph);
  const isImageThemeRoute = isAidreamcapesImageThemePath(input.site.slug, input.pagePath);
  const isAidreamcapesEuVideoRoute = input.site.id === "site_aidreamcapes_xby" && Boolean(aidreamcapesEuVideoTopicFromPath(input.pagePath));
  const routeInput: JsonLdInput = input.context && !isImageThemeRoute && !isAidreamcapesEuVideoRoute
    ? { ...input, pagePath: input.context.seo.canonicalPath }
    : input;
  const resolvedInput: JsonLdInput = isAidreamcapesImageThemePath(routeInput.site.slug, routeInput.pagePath)
    ? { ...routeInput, site: { ...routeInput.site, primaryDomain: "aidreamcapes.com" } }
    : routeInput;
  const euRouteSeo = resolvedInput.site.id === "site_aidreamcapes_xby"
    ? aidreamcapesEuSaveTheDateSeoFromPath(resolvedInput.pagePath)
    : undefined;
  const seoQualityOverride = aidreamcapesSeoQualityForPath(resolvedInput.site, resolvedInput.pagePath);
  const title = euRouteSeo?.title || seoQualityOverride?.title || pageTitle(resolvedInput.site, resolvedInput.page, resolvedInput.context);
  const description = euRouteSeo?.description || seoQualityOverride?.description || pageDescription(resolvedInput.site, resolvedInput.page, resolvedInput.context);
  const graph: Array<JsonLdNode | undefined> = [
    organizationSchema(resolvedInput.site, resolvedInput.routeMode, resolvedInput.context, resolvedInput.pagePath),
    websiteSchema(resolvedInput.site, resolvedInput.routeMode),
    storefrontApplicationSchema(resolvedInput, title, description),
    breadcrumbs(resolvedInput.site, resolvedInput.routeMode, resolvedInput.pagePath, title, resolvedInput.publishedRoutePaths),
    publishedStandardPageSchema(resolvedInput, title, description),
    spanishStorefrontWebPageSchema(resolvedInput, title, description),
    aidreamcapesEuPublicWebPageSchema(resolvedInput, title, description),
    policyWebPageSchema(resolvedInput, title, description),
    ...aidreamcapesImageThemeDetailSchema(resolvedInput, title, description),
    ...aidreamcapesEuImageThemeDetailSchema(resolvedInput, title, description),
    ...aidreamcapesVideoDirectorySchema(resolvedInput, title, description),
    faqSchema(resolvedInput.site, resolvedInput.pageJson, resolvedInput),
    articleSchema(resolvedInput.site, resolvedInput.routeMode, resolvedInput.pagePath, title, description, resolvedInput.pageJson),
    ...collectionPageSchema(resolvedInput, title, description),
    ...editorialVideoObjectSchemas(resolvedInput),
    ...aidreamcapesEuVideoObjectSchemas(resolvedInput),
    ...aidreamcapesVideoFeatureObjectSchemas(resolvedInput),
    ...spanishVideoObjectSchemas(resolvedInput),
    ...homeVideoObjectSchemas(resolvedInput),
    ...serviceOrProductSchema(resolvedInput, title, description)
  ];

  return [{ "@context": "https://schema.org", "@graph": graph.filter(Boolean) }];
}

function toolDirectoryFaqSchema(site: Site, item: ReturnType<typeof getSeoDirectoryContentForSite>): JsonLdNode {
  const items = dreamshootToolDetailFaqItems({
    site,
    toolSlug: item.slug,
    label: item.label,
    description: item.description,
    workflow: item.workflow,
    useCases: item.useCases
  });
  return {
    "@type": "FAQPage",
    ...(site.id === "site_aidreamcapes_xby" ? { inLanguage: "fr-FR" } : {}),
    mainEntity: items
      .map(([question, answer]) => faqQuestionNode(site, question, answer))
      .filter(Boolean)
  };
}

export function buildToolDirectoryJsonLd({
  site,
  toolSlug,
  publicPath,
  routeMode,
  pageJson,
  context
}: {
  site: Site;
  toolSlug: string;
  publicPath?: string;
  routeMode: "host" | "path";
  pageJson?: ThemePageJson;
  context: StorefrontContext;
}): JsonLdNode[] {
  const aidreamcapesV2Graph = aidreamcapesV2StoredGraph(site, pageJson);
  if (aidreamcapesV2Graph) {
    const pagePath = publicPath ?? `/ai-video-generation/${toolSlug}`;
    return aidreamcapesV2JsonLd({ site, routeMode, context, pageJson, pagePath, page: { id: toolSlug, slug: pagePath, title: siteBrandName(site), pageType: "ai_tool", updatedAt: "" } }, aidreamcapesV2Graph);
  }
  const topicSection = sectionOfType(pageJson, "ai_video_topic_landing");
  const talkingPhotoSection = sectionOfType(pageJson, "talking_photo_landing");
  const topicContent = topicSection
    ? aiVideoTopicLandingContentFromSection(topicSection)
    : talkingPhotoSection
      ? talkingPhotoContentFromSection(talkingPhotoSection)
      : undefined;
  const item = topicContent ? undefined : getSeoDirectoryContentForSite(site, "tool", toolSlug);
  const euVideoTopic = site.id === "site_aidreamcapes_xby" ? aidreamcapesEuVideoTopic(toolSlug) : undefined;
  const pagePath = publicPath ?? topicContent?.seo.canonicalPath ?? item?.canonicalPath ?? `/tools/${toolSlug}`;
  const path = schemaPagePath(site, routeMode, pagePath);
  const url = absoluteUrl(site, routeMode, path);
  const siteName = siteBrandName(site);
  const faq = topicContent
    ? {
        "@type": "FAQPage",
        ...(site.id === "site_aidreamcapes_xby" ? { inLanguage: "fr-FR" } : {}),
        mainEntity: topicContent.faq.items
          .map((faqItem) => faqQuestionNode(site, faqItem.question, faqItem.answer))
          .filter(Boolean)
      }
    : toolDirectoryFaqSchema(site, item!);
  const label = euVideoTopic?.label ?? topicContent?.hero.title ?? item!.label;
  // Dedicated video topic pages own their SEO copy in the landing section.
  // Keep JSON-LD aligned with the document metadata instead of falling back
  // to the older generic directory context.
  const seoQualityOverride = aidreamcapesSeoQualityForPath(site, pagePath);
  const title = euVideoTopic?.title || seoQualityOverride?.title || topicContent?.seo.title || context.seo.title;
  const description = euVideoTopic?.description || seoQualityOverride?.description || topicContent?.seo.description || context.seo.description;
  const isAdsTestingPage = isAidreamcapesAdsTestingPage(site, pagePath);
  const isAidreamcapesBrandCreator = isAidreamcapesBrandCreatorPage(site, pagePath);
  const softwareApplication: JsonLdNode = {
    "@type": "SoftwareApplication",
    name: title,
    description,
    ...(site.id === "site_aidreamcapes_xby" ? { inLanguage: "fr-FR" } : {}),
    applicationCategory: isAdsTestingPage
      ? "AI UGC and product advertising tool"
      : isAidreamcapesBrandCreator ? "AI brand and creator video tool"
      : pagePath.includes("video") ? "MultimediaApplication" : "PhotographyApplication",
    operatingSystem: "Web",
    url,
    provider: {
      "@type": "Organization",
      name: siteName,
      url: storefrontBaseUrl(site, routeMode)
    },
    // www.mydreamshoots.com tool/theme pages are redeemed with credits, not sold as fiat SKUs,
    // so they must not carry an Offer at all. An Offer with no price is invalid, and a price here
    // would contradict the page, which shows no fiat amount. Fiat pricing stays on /pricing.
    // Other storefronts keep their existing Offer unchanged.
    ...(!isAdsTestingPage && !isAidreamcapesBrandCreator && !isMydreamshootsComSite(site) ? {
      offers: {
        "@type": "Offer",
        availability: toolOfferAvailability(site, pagePath, context),
        category: site.id === "site_aidreamcapes_xby"
          ? "outil de portraits d’occasion avec l’IA"
          : isSpanishXbySite(site)
          ? isAidreamcapesSite(site) ? "herramienta de retratos de viaje IA" : "herramienta de fotos IA"
          : isAidreamcapesSite(site) ? "AI occasion portrait tool" : isMydreamshootsComSite(site) && MYDREAMSHOOTS_VIDEO_SCHEMA_PATHS.has(pagePath) ? "AI video tool" : "AI photo tool",
        url
      }
    } : {})
  };
  const graph: JsonLdNode[] = [
    organizationSchema(site, routeMode, context, pagePath),
    websiteSchema(site, routeMode),
    ...(isAidreamshootsStorefrontSite(site)
      ? [spanishStorefrontWebPageSchema({ site, page: context.page, pageJson, pagePath, routeMode, context }, title, description)].filter((node): node is JsonLdNode => Boolean(node))
      : []),
    ...(site.id === "site_aidreamcapes_xby" ? [{
      "@type": "WebPage",
      "@id": `${url}#webpage`,
      name: title,
      description,
      url,
      inLanguage: "fr-FR",
      isPartOf: { "@id": `${storefrontBaseUrl(site, routeMode)}#website` },
      publisher: { "@id": `${storefrontBaseUrl(site, routeMode)}#organization` }
    }] : []),
    breadcrumbs(site, routeMode, pagePath, label),
    softwareApplication,
    {
      "@type": "Service",
      name: label,
      description,
      ...(site.id === "site_aidreamcapes_xby" ? { inLanguage: "fr-FR" } : {}),
      serviceType: schemaServiceType(site, pagePath),
      provider: {
        "@type": "Organization",
        name: siteName,
        url: storefrontBaseUrl(site, routeMode)
      },
      url
    },
    faq,
    ...(site.id === "site_aidreamcapes_xby"
      ? aidreamcapesEuVideoObjectSchemas({ site, page: context.page, pageJson, pagePath, routeMode, context })
      : [])
  ];

  if (isAidreamshootsStorefrontSite(site)) {
    graph.push(...spanishVideoObjectSchemas({ site, page: context.page, pageJson, pagePath, routeMode, context }));
  }

  return [{ "@context": "https://schema.org", "@graph": graph }];
}

export function buildCollectionDirectoryJsonLd({
  site,
  collectionSlug,
  routeMode,
  creativePacks = [],
  context
}: {
  site: Site;
  collectionSlug: string;
  routeMode: "host" | "path";
  creativePacks?: CreativePack[];
  context: StorefrontContext;
}): JsonLdNode[] {
  const pageSlug = canonicalCollectionSlugForCandidate(site, collectionSlug) || slugifySchemaPart(collectionSlug);
  const aidreamcapesEuSlug = site.id === "site_aidreamcapes_xby" && AIDREAMCAPES_EU_DIRECTORY_SLUGS.includes(pageSlug)
    ? pageSlug
    : undefined;
  if (aidreamcapesEuSlug) {
    const content = aidreamcapesEuSeoContentForSlug(aidreamcapesEuSlug);
    if (!content) return [];
    const pagePath = content.canonicalPath;
    const url = absoluteUrl(site, routeMode, schemaPagePath(site, routeMode, pagePath));
    const packs = creativePacks.length ? creativePacks : context.catalog.activePacks;
    const pack = packs.find((candidate) => candidate.status === "active" && packMatchesCollectionSlug(site, candidate, aidreamcapesEuSlug));
    const image = pack?.imageUrl?.trim();
    const primaryImage = image
      ? {
          "@type": "ImageObject",
          "@id": `${url}#primaryimage`,
          url: absoluteUrl(site, routeMode, image),
          contentUrl: absoluteUrl(site, routeMode, image),
          caption: content.label
        }
      : undefined;
    const faq = content.faqItems
      .map(([question, answer]) => faqQuestionNode(site, question, answer))
      .filter(Boolean);
    return [{
      "@context": "https://schema.org",
      "@graph": [
        organizationSchema(site, routeMode, context, pagePath),
        websiteSchema(site, routeMode),
        breadcrumbs(site, routeMode, pagePath, content.label),
        {
          "@type": "WebPage",
          "@id": `${url}#webpage`,
          name: content.title,
          description: content.description,
          url,
          inLanguage: "fr-FR",
          ...(primaryImage ? { primaryImageOfPage: primaryImage } : {}),
          isPartOf: { "@id": `${storefrontBaseUrl(site, routeMode)}#website` },
          publisher: { "@type": "Organization", name: siteBrandName(site), url: storefrontBaseUrl(site, routeMode) }
        },
        {
          "@type": "Service",
          "@id": `${url}#service`,
          name: content.label,
          description: content.description,
          inLanguage: "fr-FR",
          serviceType: "service de création et retouche photo avec IA",
          provider: { "@id": `${storefrontBaseUrl(site, routeMode)}#organization` },
          url
        },
        ...(faq.length ? [{ "@type": "FAQPage", inLanguage: "fr-FR", mainEntity: faq }] : [])
      ]
    }];
  }
  const frenchEngagementPage = pageSlug === "engagement-photo" && isAidreamshootsEngagementFrenchPage(site, AIDREAMSHOOTS_ENGAGEMENT_FRENCH_COPY.canonicalPath);
  const pagePath = frenchEngagementPage
    ? AIDREAMSHOOTS_ENGAGEMENT_FRENCH_COPY.canonicalPath
    : pageSlug ? canonicalSeoDirectoryPathForSite(site, "collection", pageSlug) : canonicalSeoDirectoryPathForSite(site, "collection", "");
  if (isPrimaryMyDreamShootsSite(site) && !context.pageCopy) return [];
  const collectionLabel = cleanText(collectionSlug, pageSlug).replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Photo Packages";
  const fallbackCollectionLabel = isSpanishXbySite(site) ? "Paquetes de fotos" : collectionLabel;
  const item = frenchEngagementPage
    ? {
        slug: "engagement-photo",
        canonicalPath: AIDREAMSHOOTS_ENGAGEMENT_FRENCH_COPY.canonicalPath,
        label: AIDREAMSHOOTS_ENGAGEMENT_FRENCH_COPY.label,
        title: AIDREAMSHOOTS_ENGAGEMENT_FRENCH_COPY.seoTitle,
        description: AIDREAMSHOOTS_ENGAGEMENT_FRENCH_COPY.seoDescription,
        intro: AIDREAMSHOOTS_ENGAGEMENT_FRENCH_COPY.detailIntro,
        useCases: AIDREAMSHOOTS_ENGAGEMENT_FRENCH_COPY.bestFor
      }
    : context.pageCopy && isPrimaryMyDreamShootsSite(site)
    ? {
        slug: pageSlug,
        canonicalPath: context.seo.canonicalPath,
        label: context.pageCopy.headline,
        title: context.seo.title,
        description: context.seo.description,
        intro: context.pageCopy.detailIntro,
        useCases: context.pageCopy.bestFor
      }
    : (() => {
    try {
      return getSeoDirectoryContentForSite(site, "collection", collectionSlug);
    } catch {
      return {
        slug: pageSlug,
        canonicalPath: pagePath,
        label: fallbackCollectionLabel,
        title: `${fallbackCollectionLabel} | ${siteBrandName(site)}`,
        description: isSpanishXbySite(site)
          ? `${fallbackCollectionLabel} de ${siteBrandName(site)}`
          : `${fallbackCollectionLabel} from ${siteBrandName(site)}`,
        intro: isSpanishXbySite(site)
          ? `Explora ${fallbackCollectionLabel.toLowerCase()} antes de gastar creditos.`
          : `Browse ${fallbackCollectionLabel.toLowerCase()} before you spend credits.`,
        useCases: [isSpanishXbySite(site) ? `${fallbackCollectionLabel} opciones` : `${fallbackCollectionLabel} photo options`]
      };
    }
      })();
  const path = schemaPagePath(site, routeMode, pagePath);
  const url = absoluteUrl(site, routeMode, path);
  const siteName = siteBrandName(site);
  const title = frenchEngagementPage
    ? AIDREAMSHOOTS_ENGAGEMENT_FRENCH_COPY.seoTitle
    : isSpanishXbySite(site)
      ? item.title
      : context.seo.title;
  const description = frenchEngagementPage
    ? AIDREAMSHOOTS_ENGAGEMENT_FRENCH_COPY.seoDescription
    : isSpanishXbySite(site)
      ? item.description
      : context.seo.description;
  const pageMedia = isPrimaryMyDreamShootsSite(site) ? context.publishedPageMedia : undefined;
  const scopedCreativePacks = creativePacks.length ? creativePacks : context.catalog.activePacks;
  // Focused collection renders can contain a non-empty scoped projection that
  // belongs to a different legacy category. For XBY, use the full relational
  // catalogue whenever that projection cannot resolve the requested theme, so
  // the page still receives its real Product node instead of an empty list.
  const sourceCreativePacks = isSpanishXbySite(site) && !scopedCreativePacks.some((pack) => packMatchesCollectionSlug(site, pack, item.slug))
    ? context.catalog.activePacks
    : scopedCreativePacks;
  const projectedPacks = projectPublicCreativePacks(context, sourceCreativePacks);
  const publicPacks = isSpanishXbySite(site)
    ? sourceCreativePacks.filter((pack) => pack.status === "active" && pack.creditCost > 0 && pack.outputCount > 0)
    : projectedPacks;
  const matchingPacks = publicPacks
    .filter((pack) => packMatchesCollectionSlug(site, pack, item.slug))
    .filter((pack) => !pageMedia || pack.id === pageMedia.packId);
  const specialEngagementPack = frenchEngagementPage
    ? publicPacks.find((pack) => packMatchesCollectionSlug(site, pack, "engagement-photo"))
    : undefined;
  const schemaPacks = frenchEngagementPage
    ? specialEngagementPack ? [specialEngagementPack] : matchingPacks
    : matchingPacks;
  const faqPack = schemaPacks[0];
  const faqLabel = cleanText(faqPack?.name, item.label);
  const faqOutputCount = faqPack?.outputCount;
  const faqCreditCost = faqPack?.creditCost;
  const collectionPageCopy = frenchEngagementPage
    ? AIDREAMSHOOTS_ENGAGEMENT_FRENCH_COPY
    : pageSlug && !isSpanishXbySite(site) && isPrimaryMyDreamShootsSite(site)
    ? context.pageCopy
    : undefined;
  const collectionFaqItems = frenchEngagementPage
    ? AIDREAMSHOOTS_ENGAGEMENT_FRENCH_COPY.faqItems.map(([question, answer]) => [question, answer] as [string, string])
    : collectionPageCopy
    ? collectionPageCopy.faqItems.map((faqItem) => "question" in faqItem
      ? [faqItem.question, faqItem.answer] as [string, string]
      : [faqItem[0], faqItem[1]] as [string, string])
    : site.id === "site_aidreamcapes_xby"
    ? getSeoDirectoryContentForSite(site, "collection", item.slug).faqItems ?? []
    : isSpanishXbySite(site)
    ? getSeoDirectoryContentForSite(site, "collection", item.slug).faqItems ?? (!faqPack ? [] : [
        [`Que es el paquete ${faqLabel}?`, isAidreamcapesSite(site)
          ? `${faqLabel} es un album privado que convierte fotos fuente aprobadas en una galeria de ocasion con creditos visibles y resultados listos para descargar.`
          : `${faqLabel} es un tema que convierte fotos fuente aprobadas en una galeria privada con estilo consistente, creditos visibles y resultados listos para descargar.`],
        [`Que fotos fuente funcionan mejor para ${faqLabel}?`, "Usa fotos claras, bien iluminadas y con permiso de uso. Evita capturas, recortes pequenos, filtros pesados e imagenes de personas sin consentimiento."],
        [`Cuantas imagenes crea ${faqLabel}?`, `Este paquete esta configurado para ${faqOutputCount} imagenes, y el coste de ${faqCreditCost} creditos se muestra antes de iniciar la solicitud.`],
        [isAidreamcapesSite(site) ? "Donde quedan los albumes terminados?" : "Donde quedan las imagenes terminadas?", "Los resultados terminados permanecen en tu galeria privada para revisar, conservar y descargar."],
        ["Que ocurre si falla la generacion?", "Si una solicitud del proveedor se interrumpe antes de la entrega, los creditos reservados se liberan o se devuelven segun el estado."]
      ])
    : [
        [`What is the ${faqLabel} package?`, isAidreamcapesSite(site)
          ? `${faqLabel} is a focused Aidreamcapes private album that turns approved source photos into fan, game-day, premiere, holiday, creator, or occasion imagery with visible credit cost and download-ready results. It is designed for customers who want a private gallery around one clear moment instead of a generic image generator.`
          : `${faqLabel} is a focused MyDreamShoots theme that turns approved source photos into a private gallery with consistent styling, visible credit cost, and download-ready results. Use it when you want a specific AI photo set for profiles, creator content, seasonal cards, personal-brand visuals, or social-ready albums.`],
        [`Which source photos work best for ${faqLabel}?`, isAidreamcapesSite(site)
          ? "Use clear, well-lit photos you own or have permission to use, with every person visible and approved for the intended album. Avoid screenshots, tiny crops, heavy filters, overlapping faces, official logos, public-figure references, and images that could imply a false endorsement."
          : "Use clear, well-lit photos you own or have permission to use, with faces or subjects visible from a few useful angles. Avoid screenshots, tiny crops, heavy filters, blurred selfies, text-heavy graphics, and images of people who have not consented."],
        [`How many images does ${faqLabel} create and how many credits does it use?`, `This package is configured for ${faqOutputCount} images, and the ${faqCreditCost}-credit cost is shown before the generation request starts. Review the output count, source-photo requirements, and gallery goal before reserving credits.`],
        [`Can I use ${faqLabel} results for social media or business content?`, isAidreamcapesSite(site)
          ? "You can share suitable results when everyone shown has approved the use, platform rules are followed, AI disclosure is handled where required, and the post does not imply an official relationship with a team, league, celebrity, venue, or brand."
          : "You can use suitable results for profiles, social posts, creator pages, cards, or business drafts when you control the source photos, every person shown has approved the use, and the destination platform rules and AI disclosure requirements are followed."],
        [isAidreamcapesSite(site) ? "Where do finished albums go?" : "Where do finished images go?", isAidreamcapesSite(site) ? "Finished Aidreamcapes images stay inside your signed-in private gallery, where you can review faces, hands, marks, crops, and overall realism before downloading the results that fit your occasion." : "Finished results stay inside your signed-in private gallery, where you can review identity details, hands, backgrounds, crops, and overall realism before downloading the images that fit your intended channel."],
        ["What happens if generation fails?", "If a provider request is interrupted before delivery, reserved credits are released or returned according to the request status so you can retry from the workspace. Keep the job reference if you contact support about a failed generation, missing gallery, or credit question."]
      ];
  const uniqueCollectionFaqItems = Array.from(new Map(collectionFaqItems.map((entry) => [entry[0], entry])).values());
  const itemListElement = schemaPacks.length
    ? schemaPacks.map((entry, index) => {
    const pack = entry as CreativePack;
    const name = cleanText(pack.name, item.label);
    const image = cleanText(pack.imageUrl);
    const entrySlug = canonicalCollectionSlugForCandidate(site, pack.categoryRecord?.slug || pack.category || pack.name);
    const entryPagePath = entrySlug ? canonicalSeoDirectoryPathForSite(site, "collection", entrySlug) : pagePath;
    const entryPath = schemaPagePath(site, routeMode, entryPagePath);
    return {
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Service",
        name,
        description: cleanText(pack.description, item.description),
        url: absoluteUrl(site, routeMode, entryPath),
        ...(image ? { image: absoluteUrl(site, routeMode, image) } : {})
      }
    };
      })
    : frenchEngagementPage
      ? [{
          "@type": "ListItem",
          position: 1,
          item: {
            "@type": "Service",
            name: item.label,
            description: item.description,
            url,
            image: absoluteUrl(site, routeMode, "/assets/sites/site_aidreamshoots/generated/regenerated/aidreamshoots-engagement-13-20260912-v1/occasion-2d7b23bf0f95.webp")
          }
        }]
      : [];
  // Live www.mydreamshoots.com only: drop the credit-redeemed pack Product (it has no offers,
  // review, or aggregateRating and cannot truthfully get one) and keep its imagery on the page node.
  const dropPackProduct = isMydreamshootsComSite(site);
  const packImagery = dropPackProduct && schemaPacks.length === 1
    ? packPageImagery({ site, routeMode, pagePath, pack: schemaPacks[0], description: item.description })
    : undefined;
  const graph: JsonLdNode[] = [
    breadcrumbs(site, routeMode, pagePath, item.label),
    {
      "@type": "CollectionPage",
      name: title,
      description,
      url,
      ...(site.id === "site_aidreamcapes_xby" ? { inLanguage: "fr-FR" } : isSpanishXbySite(site) || frenchEngagementPage ? { inLanguage: "es-ES" } : {}),
      isPartOf: { "@id": `${storefrontBaseUrl(site, routeMode)}#website` },
      publisher: { "@type": "Organization", name: siteName, url: storefrontBaseUrl(site, routeMode) },
      ...(packImagery ?? {})
    },
    ...(itemListElement.length ? [{
      "@type": "ItemList",
      name: frenchEngagementPage ? `${item.label}: ejemplos y opciones` : site.id === "site_aidreamcapes_xby" ? `${item.label} : exemples et options` : isSpanishXbySite(site) ? `${item.label} opciones de foto` : `${item.label} photo options`,
      description: item.intro,
      url,
      itemListElement
    }] : []),
    ...(uniqueCollectionFaqItems.length ? [{
      "@type": "FAQPage",
      ...(site.id === "site_aidreamcapes_xby" ? { inLanguage: "fr-FR" } : {}),
      mainEntity: uniqueCollectionFaqItems
        .map(([question, answer]) => faqQuestionNode(site, question, answer))
        .filter(Boolean)
    }] : []),
    // AIdreamshoots packs are credit-based creative packs, not standalone
    // products with a persisted monetary offer. Do not emit Product markup
    // without a truthful Offer price/currency; the CollectionPage, Service
    // and ItemList nodes above describe the public page accurately.
    ...(site.id !== "site_mydreamshoots_xby" && schemaPacks.length === 1 && !dropPackProduct
      ? [packProductSchema({
          site,
          routeMode,
          pagePath,
          pack: schemaPacks[0],
          description: item.description
        })].filter(Boolean) as JsonLdNode[]
      : [])
  ];

  return [{ "@context": "https://schema.org", "@graph": graph }];
}
