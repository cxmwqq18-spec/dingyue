import fs from "node:fs";
import path from "node:path";

import type { StorefrontContext } from "@/lib/storefront-context/types";
import { projectPublicCreativePacks, projectPublicPricingOffers } from "@/lib/storefront-context/core";
import { storefrontBaseUrl, storefrontOrigin } from "@/lib/storefront-context/seo-projection";
import { aiVideoTopicLandingContentByKey } from "@/lib/ai-video-topic-content";
import { dreamshootToolDetailFaqItems } from "@/lib/dreamshoot-tool-faq";
import { canonicalSeoDirectoryPathForSite, getSeoDirectoryContentForSite } from "@/lib/dreamshoot-seo-content";
import { isSpanishStorefrontSite } from "@/lib/spanish-storefronts";
import { isAidreamcapesSite as isAidreamcapesCapabilitySite, isPrimaryMydreamshootsSite as isPrimaryMydreamshootsCapabilitySite } from "@/lib/storefront-context/capabilities";
import type { CreativePack, Product, PublishedCollectionRef, SectionBlockInstance, Site, ThemePage, ThemePageJson, ThemeSettingValue, VideoTheme } from "@/lib/types";

export type JsonLdNode = Record<string, unknown>;

type JsonLdInput = {
  site: Site;
  page: Pick<ThemePage, "id" | "slug" | "title" | "pageType">;
  pageJson?: ThemePageJson;
  pagePath: string;
  routeMode: "host" | "path";
  creativePacks?: CreativePack[];
  products?: Product[];
  videoThemes?: VideoTheme[];
  context: StorefrontContext;
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

function collapseSpanishXbyBrandRepeats(value: string): string {
  return value
    .replace(/\bMyDreamShoots-xby(?:-xby)+\b/g, "MyDreamShoots-xby")
    .replace(/\bAidreamcapes-xby(?:-xby)+\b/g, "Aidreamcapes-xby");
}

function schemaServiceType(site: Site, pagePath: string): string {
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
  if (pagePath.includes("video")) return "AI image to video concept tool";
  if (pagePath.includes("headshot")) return "AI headshot and profile portrait tool";
  return "AI photo generation and editing tool";
}

function itemListName(site: Site, title: string): string {
  if (isSpanishXbySite(site)) return isAidreamcapesSite(site) ? `${title} opciones de album de viaje` : `${title} opciones de paquete`;
  if (isAidreamcapesSite(site)) return `${title} occasion album options`;
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

const storefrontPublicWatermarkCacheVersion = "20260811watermark30sync2";

function withStorefrontPublicWatermarkCacheVersion(value: string): string {
  const cleanValue = value.trim();
  if (!cleanValue) return value;
  const mediaPattern = /\.(?:avif|jpe?g|png|svg|webp|m4v|mov|mp4|webm)(?:[?#]|$)/i;
  if (!mediaPattern.test(cleanValue) || cleanValue.includes("/brand/")) return value;

  if (cleanValue.startsWith("http://") || cleanValue.startsWith("https://")) {
    try {
      const url = new URL(cleanValue);
      if (!url.pathname.startsWith("/assets/")) return value;
      url.searchParams.set("wm", storefrontPublicWatermarkCacheVersion);
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
  params.set("wm", storefrontPublicWatermarkCacheVersion);
  return `${pathname}?${params.toString()}${hash}`;
}

function absoluteUrl(site: Site, routeMode: "host" | "path", pathOrUrl = "/"): string {
  const value = withStorefrontPublicWatermarkCacheVersion(cleanText(pathOrUrl, "/"));
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  const base = storefrontOrigin(site).replace(/\/$/, "");
  return `${base}${value.startsWith("/") ? value : `/${value}`}`;
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

function organizationSchema(site: Site, routeMode: "host" | "path", context?: StorefrontContext): JsonLdNode {
  const profile = storefrontCompanyProfile(context);
  const address = companyAddressSchema(profile);
  const identifiers = companyIdentifiers(profile);
  const sameAs = (context?.profile?.identity.sameAs ?? []).filter((url) => /^https?:\/\//i.test(url));
  const logo = isPrimaryMyDreamShootsSite(site)
    ? absoluteUrl(site, routeMode, "/assets/dreamshoot/brand/dreamshootai-logo-refined.svg?v=20260621b")
    : undefined;
  return {
    "@type": "Organization",
    "@id": `${storefrontBaseUrl(site, routeMode)}#organization`,
    name: siteBrandName(site),
    ...(profile.legalName ? { legalName: profile.legalName } : {}),
    url: storefrontBaseUrl(site, routeMode),
    ...(logo ? { logo: { "@type": "ImageObject", url: logo, contentUrl: logo } } : {}),
    description: cleanSchemaText(site, site.branding.description),
    ...(profile.email ? { email: profile.email } : {}),
    ...(profile.phone ? { telephone: profile.phone } : {}),
    ...(address ? { address } : {}),
    ...(profile.taxId ? { taxID: profile.taxId } : {}),
    ...(identifiers.length ? { identifier: identifiers } : {}),
    ...(sameAs.length ? { sameAs } : {})
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

function breadcrumbs(site: Site, routeMode: "host" | "path", pagePath: string, title: string): JsonLdNode {
  const parts = pagePath.split("/").filter(Boolean);
  const items = [
    {
      "@type": "ListItem",
      position: 1,
      name: isSpanishXbySite(site) ? "Inicio" : "Home",
      item: absoluteUrl(site, routeMode, schemaPagePath(site, routeMode, "/"))
    }
  ];
  let current = "";
  parts.forEach((part, index) => {
    current += `/${part}`;
    items.push({
      "@type": "ListItem",
      position: index + 2,
      name: index === parts.length - 1 ? title : schemaPathLabel(site, part),
      item: absoluteUrl(site, routeMode, schemaPagePath(site, routeMode, current))
    });
  });
  return { "@type": "BreadcrumbList", itemListElement: items };
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
      const contentKey = cleanText(section.settings.contentKey, cleanText(section.settings.anchor));
      const content = aiVideoTopicLandingContentByKey[contentKey];
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
  return questions.length ? { "@type": "FAQPage", mainEntity: questions } : undefined;
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
    headline: articleSectionValue(pageJson, "title") || title,
    description: articleSectionValue(pageJson, "summary") || description,
    author: {
      "@type": authorType,
      name: cleanSchemaText(site, author),
      ...(authorUrl ? { url: absoluteUrl(site, routeMode, authorUrl) } : {})
    },
    publisher: {
      "@type": "Organization",
      name: siteBrandName(site),
      url: storefrontBaseUrl(site, routeMode),
      ...(isPrimaryMyDreamShootsSite(site) ? {
        logo: {
          "@type": "ImageObject",
          url: absoluteUrl(site, routeMode, "/assets/dreamshoot/brand/dreamshootai-logo-refined.svg?v=20260621b"),
          contentUrl: absoluteUrl(site, routeMode, "/assets/dreamshoot/brand/dreamshootai-logo-refined.svg?v=20260621b")
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

function serviceOrProductSchema(input: JsonLdInput, title: string, description: string): JsonLdNode[] {
  const path = input.pagePath;
  if (path.startsWith("/tools/") || path.startsWith("/ai-video-generation/")) {
    return [{
      "@type": "Service",
      name: title,
      description,
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
          : product.type === "subscription" ? "AI photo subscription" : "AI photo credit pack",
        description: isSpanishXbySite(input.site)
          ? `${price.creditsGranted} creditos${price.interval === "one_time" ? "" : ` por ${price.interval}`}`
          : `${price.creditsGranted} credits${price.interval === "one_time" ? "" : ` per ${price.interval}`}`,
        url
      }));
    const offerCatalog = offers.length
      ? {
          "@type": "OfferCatalog",
          "@id": `${url}#offers`,
          name: isSpanishXbySite(input.site) ? `${siteName} planes y paquetes de creditos` : `${siteName} plans and credit packs`,
          itemListElement: offers
        }
      : undefined;
    return [
      {
        "@type": "Service",
        name: title,
        description,
        provider: { "@type": "Organization", name: siteName },
        serviceType: isSpanishXbySite(input.site)
          ? isAidreamcapesSite(input.site) ? "servicio de retratos de viaje IA" : "servicio de generacion de fotos IA"
          : isAidreamcapesSite(input.site) ? "AI occasion portrait generation service" : "AI photo generation service",
        url,
        ...(offerCatalog ? { offers: { "@id": `${url}#offers` } } : {})
      },
      {
        "@type": "SoftwareApplication",
        name: siteName,
        description,
        applicationCategory: "PhotographyApplication",
        operatingSystem: "Web",
        url,
        provider: { "@type": "Organization", name: siteName },
        ...(offerCatalog ? { offers: { "@id": `${url}#offers` } } : {})
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
  return uniqueMediaPaths([pack.imageUrl, ...(pack.galleryImages ?? [])], imageMediaPath, 8);
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
  return candidates
    .map((candidate) => canonicalCollectionSlugForCandidate(site, candidate))
    .filter(Boolean)
    .includes(slug);
}

function packProductSchema({
  site,
  routeMode,
  pagePath,
  pack,
  context,
  description
}: {
  site: Site;
  routeMode: "host" | "path";
  pagePath: string;
  pack: CreativePack;
  context: StorefrontContext;
  description: string;
}): JsonLdNode | undefined {
  if (!isPrimaryMyDreamShootsSite(site)) return undefined;
  const imagePaths = packImagePaths(pack);
  const image = imagePaths[0];
  if (!image) return undefined;
  const subjectImage = subjectImageForPack(pack) || image;
  const url = absoluteUrl(site, routeMode, schemaPagePath(site, routeMode, pagePath));
  const subjectImageUrl = absoluteUrl(site, routeMode, subjectImage);
  const primaryImageUrl = absoluteUrl(site, routeMode, image);
  const productName = cleanSchemaText(site, pack.name, "MyDreamShoots AI photo package");
  const productDescription = cleanSchemaText(site, pack.description, description);
  const offerSource = context?.offers.lowestPublicMonthlySubscriptionPrice;
  const offerUrl = absoluteUrl(site, routeMode, schemaPagePath(site, routeMode, "/pricing"));
  const subjectImageDimensions = imageDimensions(subjectImage);
  const offer = offerSource ? {
    "@type": "Offer",
    "@id": `${url}#offer`,
    name: cleanSchemaText(site, offerSource.product.name, offerSource.price.label),
    url: offerUrl,
    priceCurrency: offerSource.price.currency.toUpperCase(),
    price: (offerSource.price.amountCents / 100).toFixed(2),
    availability: offerSource?.checkoutEnabled ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    itemCondition: "https://schema.org/NewCondition"
  } : undefined;
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
    category: cleanSchemaText(site, pack.categoryRecord?.label || pack.category, "AI photo package"),
    image: imagePaths.map((path) => absoluteUrl(site, routeMode, path)),
    url,
    mainEntityOfPage: url,
    ...(offer ? { offers: offer } : {}),
    additionalProperty,
    subjectOf: {
      "@type": "ImageObject",
      "@id": `${url}#image`,
      name: `${productName} preview image`,
      url: subjectImageUrl,
      contentUrl: subjectImageUrl,
      thumbnailUrl: primaryImageUrl,
      description: cleanSchemaText(site, `Example preview image for ${productName}`, productDescription),
      caption: `${productName} AI generated preview`,
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

function showcaseVideoSlugs(pageJson: ThemePageJson | undefined): string[] {
  const showcase = sectionOfType(pageJson, "dreamshoot_generation_showcase");
  return listText(showcase?.settings.videoSlugs).map(slugifySchemaPart).filter(Boolean);
}

const blockedPublicVideoThemeSlugs = new Set(["creator-scene-motion"]);

function isBlockedPublicVideoTheme(site: Site, theme: VideoTheme): boolean {
  if (site.id !== "site_dreamshoot" && site.id !== "site_aidreamcapes") return false;
  return blockedPublicVideoThemeSlugs.has(slugifySchemaPart(theme.slug));
}

function homeVideoObjectSchemas(input: JsonLdInput): JsonLdNode[] {
  if (!isPrimaryMyDreamShootsSite(input.site)) return [];
  // MyDreamShoots video content now has dedicated /ai-video-generation pages.
  // Keep homepage JSON-LD focused on the storefront instead of emitting legacy theme video objects.
  return [];
}

function collectionPageSchema(input: JsonLdInput, title: string, description: string): JsonLdNode[] {
  if (!input.pagePath.startsWith("/collections") && !input.pagePath.startsWith("/ai-image-generation")) return [];
  const path = schemaPagePath(input.site, input.routeMode, input.pagePath);
  const url = absoluteUrl(input.site, input.routeMode, path);
  const activePacks = projectPublicCreativePacks(input.context, input.creativePacks ?? input.context.catalog.activePacks);
  const itemListElement = activePacks.map((pack, index) => ({
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
  }));
  return [
    {
      "@type": "CollectionPage",
      name: title,
      description,
      url,
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

function websiteSchema(site: Site, routeMode: "host" | "path"): JsonLdNode {
  return {
    "@type": "WebSite",
    "@id": `${storefrontBaseUrl(site, routeMode)}#website`,
    name: siteBrandName(site),
    url: storefrontBaseUrl(site, routeMode)
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
    applicationCategory: "PhotographyApplication",
    operatingSystem: "Web",
    url: absoluteUrl(input.site, input.routeMode, schemaPagePath(input.site, input.routeMode, input.pagePath)),
    provider: { "@id": `${storefrontBaseUrl(input.site, input.routeMode)}#organization` },
    offers: {
      "@type": "OfferCatalog",
      "@id": `${storefrontBaseUrl(input.site, input.routeMode)}#plans`,
      name: isSpanishXbySite(input.site)
        ? isAidreamcapesSite(input.site) ? `Paquetes de retrato de viaje y creditos ${siteName}` : `Paquetes de fotos y creditos ${siteName}`
        : isAidreamcapesSite(input.site) ? "Aidreamcapes occasion portrait packages and credits" : "MyDreamShoots photo packages and credits",
      url: absoluteUrl(input.site, input.routeMode, schemaPagePath(input.site, input.routeMode, "/pricing"))
    }
  };
}

export function buildStorefrontJsonLd(input: JsonLdInput): JsonLdNode[] {
  const resolvedInput: JsonLdInput = input.context
    ? { ...input, pagePath: input.context.seo.canonicalPath }
    : input;
  const title = pageTitle(resolvedInput.site, resolvedInput.page, resolvedInput.context);
  const description = pageDescription(resolvedInput.site, resolvedInput.page, resolvedInput.context);
  const graph: Array<JsonLdNode | undefined> = [
    organizationSchema(resolvedInput.site, resolvedInput.routeMode, resolvedInput.context),
    websiteSchema(resolvedInput.site, resolvedInput.routeMode),
    storefrontApplicationSchema(resolvedInput, title, description),
    breadcrumbs(resolvedInput.site, resolvedInput.routeMode, resolvedInput.pagePath, title),
    faqSchema(resolvedInput.site, resolvedInput.pageJson, resolvedInput),
    articleSchema(resolvedInput.site, resolvedInput.routeMode, resolvedInput.pagePath, title, description, resolvedInput.pageJson),
    ...collectionPageSchema(resolvedInput, title, description),
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
  const item = getSeoDirectoryContentForSite(site, "tool", toolSlug);
  const pagePath = publicPath ?? item.canonicalPath;
  const path = schemaPagePath(site, routeMode, pagePath);
  const url = absoluteUrl(site, routeMode, path);
  const siteName = siteBrandName(site);
  const topicSection = sectionOfType(pageJson, "ai_video_topic_landing");
  const topicContentKey = cleanText(topicSection?.settings.contentKey, cleanText(topicSection?.settings.anchor));
  const topicContent = aiVideoTopicLandingContentByKey[topicContentKey];
  const faq = topicContent
    ? {
        "@type": "FAQPage",
        mainEntity: topicContent.faq.items
          .map((faqItem) => faqQuestionNode(site, faqItem.question, faqItem.answer))
          .filter(Boolean)
      }
    : toolDirectoryFaqSchema(site, item);
  const title = context.seo.title;
  const description = context.seo.description;
  const graph: JsonLdNode[] = [
    organizationSchema(site, routeMode, context),
    websiteSchema(site, routeMode),
    breadcrumbs(site, routeMode, pagePath, item.label),
    {
      "@type": "SoftwareApplication",
      name: title,
      description,
      applicationCategory: pagePath.includes("video") ? "MultimediaApplication" : "PhotographyApplication",
      operatingSystem: "Web",
      url,
      provider: {
        "@type": "Organization",
        name: siteName,
        url: storefrontBaseUrl(site, routeMode)
      },
      offers: {
        "@type": "Offer",
        availability: context.offers.active.some((offer) => offer.checkoutEnabled)
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
        category: isSpanishXbySite(site)
          ? isAidreamcapesSite(site) ? "herramienta de retratos de viaje IA" : "herramienta de fotos IA"
          : isAidreamcapesSite(site) ? "AI occasion portrait tool" : "AI photo tool",
        url
      }
    },
    {
      "@type": "Service",
      name: item.label,
      description,
      serviceType: schemaServiceType(site, pagePath),
      provider: {
        "@type": "Organization",
        name: siteName,
        url: storefrontBaseUrl(site, routeMode)
      },
      url
    },
    faq
  ];

  return [{ "@context": "https://schema.org", "@graph": graph }];
}

export function buildCollectionDirectoryJsonLd({
  site,
  collectionSlug,
  routeMode,
  collectionRefs,
  creativePacks = [],
  context
}: {
  site: Site;
  collectionSlug: string;
  routeMode: "host" | "path";
  collectionRefs?: PublishedCollectionRef[];
  creativePacks?: CreativePack[];
  context: StorefrontContext;
}): JsonLdNode[] {
  const pageSlug = canonicalCollectionSlugForCandidate(site, collectionSlug) || slugifySchemaPart(collectionSlug);
  const pagePath = pageSlug ? canonicalSeoDirectoryPathForSite(site, "collection", pageSlug) : canonicalSeoDirectoryPathForSite(site, "collection", "");
  const collectionLabel = cleanText(collectionSlug, pageSlug).replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Photo Packages";
  const fallbackCollectionLabel = isSpanishXbySite(site) ? "Paquetes de fotos" : collectionLabel;
  const item = (() => {
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
  const title = context.seo.title;
  const description = context.seo.description;
  const matchingRefs = collectionRefs?.filter((ref) => ref.status === "published" && ref.collectionSlug === pageSlug) ?? [];
  const matchingPacks = collectionRefs ? [] : projectPublicCreativePacks(context, creativePacks)
    .filter((pack) => packMatchesCollectionSlug(site, pack, item.slug));
  const faqPack = matchingPacks[0];
  const faqRef = matchingRefs[0];
  const faqLabel = cleanText(faqRef?.label ?? faqPack?.name, item.label);
  const faqOutputCount = faqRef?.outputCount ?? faqPack?.outputCount;
  const faqCreditCost = faqRef?.creditCost ?? faqPack?.creditCost;
  const collectionPageCopy = pageSlug && !isSpanishXbySite(site) && isPrimaryMyDreamShootsSite(site)
    ? context.pageCopy
    : undefined;
  const collectionFaqItems = collectionPageCopy
    ? collectionPageCopy.faqItems.map((faqItem) => [faqItem.question, faqItem.answer] as [string, string])
    : !faqPack && !faqRef ? [] : isSpanishXbySite(site)
    ? [
        [`Que es el paquete ${faqLabel}?`, isAidreamcapesSite(site)
          ? `${faqLabel} es un album privado que convierte fotos fuente aprobadas en una galeria de ocasion con creditos visibles y resultados listos para descargar.`
          : `${faqLabel} es un tema que convierte fotos fuente aprobadas en una galeria privada con estilo consistente, creditos visibles y resultados listos para descargar.`],
        [`Que fotos fuente funcionan mejor para ${faqLabel}?`, "Usa fotos claras, bien iluminadas y con permiso de uso. Evita capturas, recortes pequenos, filtros pesados e imagenes de personas sin consentimiento."],
        [`Cuantas imagenes crea ${faqLabel}?`, `Este paquete esta configurado para ${faqOutputCount} imagenes, y el coste de ${faqCreditCost} creditos se muestra antes de iniciar la solicitud.`],
        [isAidreamcapesSite(site) ? "Donde quedan los albumes terminados?" : "Donde quedan las imagenes terminadas?", "Los resultados terminados permanecen en tu galeria privada para revisar, conservar y descargar."],
        ["Que ocurre si falla la generacion?", "Si una solicitud del proveedor se interrumpe antes de la entrega, los creditos reservados se liberan o se devuelven segun el estado."]
      ]
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
  const itemListElement = matchingRefs.length ? matchingRefs.map((ref, index) => ({
    "@type": "ListItem",
    position: index + 1,
    item: {
      "@type": "Service",
      "@id": `${absoluteUrl(site, routeMode, schemaPagePath(site, routeMode, ref.canonicalPath))}#${ref.pageEntityId}`,
      name: ref.label,
      description: ref.summary,
      url: absoluteUrl(site, routeMode, schemaPagePath(site, routeMode, ref.canonicalPath)),
      image: absoluteUrl(site, routeMode, ref.image)
    }
  })) : matchingPacks.map((entry, index) => {
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
  });
  const graph: JsonLdNode[] = [
    breadcrumbs(site, routeMode, pagePath, item.label),
    {
      "@type": "CollectionPage",
      name: title,
      description,
      url,
      isPartOf: { "@id": `${storefrontBaseUrl(site, routeMode)}#website` },
      publisher: { "@type": "Organization", name: siteName, url: storefrontBaseUrl(site, routeMode) }
    },
    {
      "@type": "ItemList",
      name: isSpanishXbySite(site) ? `${item.label} opciones de foto` : `${item.label} photo options`,
      description: item.intro,
      url,
      itemListElement
    },
    {
      "@type": "FAQPage",
      mainEntity: collectionFaqItems
        .map(([question, answer]) => faqQuestionNode(site, question, answer))
        .filter(Boolean)
    },
    ...(matchingPacks.length === 1
      ? [packProductSchema({
          site,
          routeMode,
          pagePath,
          pack: matchingPacks[0],
          context,
          description: item.description
        })].filter(Boolean) as JsonLdNode[]
      : [])
  ];

  return [{ "@context": "https://schema.org", "@graph": graph }];
}
