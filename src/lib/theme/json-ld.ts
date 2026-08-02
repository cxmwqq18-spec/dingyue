import { normalizeThemeSeo } from "@/lib/theme/seo";
import { canonicalSeoDirectoryPathForSite, getSeoDirectoryContentForSite } from "@/lib/dreamshoot-seo-content";
import { isSpanishStorefrontSite } from "@/lib/spanish-storefronts";
import type { CreativePack, Product, SectionBlockInstance, Site, ThemePage, ThemePageJson, ThemeSettingValue } from "@/lib/types";

export type JsonLdNode = Record<string, unknown>;

type JsonLdInput = {
  site: Site;
  page: Pick<ThemePage, "id" | "slug" | "title" | "pageType">;
  pageJson?: ThemePageJson;
  pagePath: string;
  routeMode: "host" | "path";
  creativePacks?: CreativePack[];
  products?: Product[];
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
  const token = `${site.id} ${site.slug} ${site.name} ${site.primaryDomain} ${site.branding.logoText}`.toLowerCase();
  if (isSpanishStorefrontSite(site)) return site.branding.logoText || site.name;
  if (token.includes("aidreamcapes")) return "Aidreamcapes";
  if (token.includes("mydreamshoots") || token.includes("dreamshoot")) return "MyDreamShoots";
  return cleanText(site.branding.logoText, site.name);
}

function isAidreamcapesSite(site: Site): boolean {
  return /aidreamcapes/i.test(`${site.id} ${site.slug} ${site.name} ${site.primaryDomain} ${site.branding.logoText}`);
}

function isSpanishXbySite(site: Site): boolean {
  return isSpanishStorefrontSite(site);
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
    if (pagePath.includes("moodboard")) return "AI travel moodboard planning service";
    if (pagePath.includes("postcard") || pagePath.includes("journal")) return "AI travel album and postcard portrait service";
    return "AI travel portrait generation service";
  }
  if (pagePath.includes("video")) return "AI image to video concept tool";
  if (pagePath.includes("headshot")) return "AI headshot and profile portrait tool";
  return "AI photo generation and editing tool";
}

function itemListName(site: Site, title: string): string {
  if (isSpanishXbySite(site)) return isAidreamcapesSite(site) ? `${title} opciones de album de viaje` : `${title} opciones de paquete`;
  if (isAidreamcapesSite(site)) return `${title} travel album options`;
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
  if (!isSpanishXbySite(site)) return part.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const normalized = part.toLowerCase();
  const labels: Record<string, string> = {
    tools: "Herramientas",
    collections: "Colecciones",
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

function siteOriginUrl(site: Site): string {
  const domain = cleanText(site.primaryDomain);
  if (!domain) return "http://localhost:3000";
  if (domain.includes("localhost")) return `http://${domain}`;
  if (domain.startsWith("http://") || domain.startsWith("https://")) return domain.replace(/\/$/, "");
  return `https://${domain}`;
}

function siteBaseUrl(site: Site, routeMode: "host" | "path"): string {
  const origin = siteOriginUrl(site);
  if (routeMode === "host") return origin;
  const domain = cleanText(site.primaryDomain);
  const hasCanonicalDomain = Boolean(domain && !domain.includes("localhost"));
  return hasCanonicalDomain ? origin : `${origin}/site/${site.slug}`;
}

const storefrontPublicWatermarkCacheVersion = "20260802subtlewatermark30";

function withStorefrontPublicWatermarkCacheVersion(value: string): string {
  const cleanValue = value.trim();
  if (!cleanValue) return value;
  const mediaPattern = /\.(?:avif|jpe?g|png|webp|m4v|mov|mp4|webm)(?:[?#]|$)/i;
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
  const base = siteOriginUrl(site).replace(/\/$/, "");
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

function storefrontCompanyProfile(site: Site): StorefrontCompanyProfile {
  const identity = `${site.id} ${site.slug} ${site.name} ${site.primaryDomain} ${site.branding.logoText}`;
  if (/aidreamcapes/i.test(identity) && !isSpanishStorefrontSite(site)) {
    return {
      legalName: "Aidreamcapes.com",
      address: "30 N GOULD ST STE R,SHERIDAN,WY 82801",
      streetAddress: "30 N GOULD ST STE R",
      addressLocality: "SHERIDAN",
      addressRegion: "WY",
      postalCode: "82801",
      addressCountry: "US",
      email: "support@aidreamcapes.com"
    };
  }
  if (/(mydreamshoots|dreamshoot)/i.test(identity) && !isSpanishStorefrontSite(site)) {
    return {
      legalName: "myDreamshoots.com",
      address: "8 THE GREEN STE B,DOVER,DE 19901",
      streetAddress: "8 THE GREEN STE B",
      addressLocality: "DOVER",
      addressRegion: "DE",
      postalCode: "19901",
      addressCountry: "US",
      email: "support@mydreamshoots.com"
    };
  }
  const footerSettings = site.themeSettings?.publishedJson?.globalSections?.footer?.settings as Record<string, unknown> | undefined;
  return {
    legalName: cleanText(footerSettings?.companyName),
    address: cleanText(footerSettings?.contactAddress),
    phone: cleanText(footerSettings?.contactPhone),
    email: cleanText(footerSettings?.contactEmail),
    taxId: cleanText(footerSettings?.taxId),
    taxIdLabel: cleanText(footerSettings?.taxIdLabel)
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
      addressCountry: profile.addressCountry || "US"
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

function organizationSchema(site: Site, routeMode: "host" | "path"): JsonLdNode {
  const profile = storefrontCompanyProfile(site);
  const address = companyAddressSchema(profile);
  const identifiers = companyIdentifiers(profile);
  return {
    "@type": "Organization",
    "@id": `${siteBaseUrl(site, routeMode)}#organization`,
    name: siteBrandName(site),
    ...(profile.legalName ? { legalName: profile.legalName } : {}),
    url: siteBaseUrl(site, routeMode),
    description: cleanSchemaText(site, site.branding.description),
    ...(profile.email ? { email: profile.email } : {}),
    ...(profile.phone ? { telephone: profile.phone } : {}),
    ...(address ? { address } : {}),
    ...(profile.taxId ? { taxID: profile.taxId } : {}),
    ...(identifiers.length ? { identifier: identifiers } : {})
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

function pageTitle(site: Site, page: Pick<ThemePage, "id" | "slug" | "title" | "pageType">): string {
  const seo = normalizeThemeSeo(site, site.themeSettings.publishedJson);
  return cleanSchemaText(site, seo.pages[page.id]?.title, page.title || siteBrandName(site));
}

function pageDescription(site: Site, page: Pick<ThemePage, "id" | "title">): string {
  const seo = normalizeThemeSeo(site, site.themeSettings.publishedJson);
  return cleanSchemaText(site, seo.pages[page.id]?.description, site.branding.description || page.title);
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

function faqSchema(site: Site, pageJson: ThemePageJson | undefined): JsonLdNode | undefined {
  if (!hasPageSections(pageJson)) return undefined;
  const questions = pageJson.sectionsOrder.flatMap((sectionId) => {
    const section = pageJson.sections[sectionId];
    if (section?.type !== "faq") return [];
    const blocks = section.blocks?.length
      ? section.blocks
      : listText(section.settings.items).map((item, index) => {
          const [question = "", answer = ""] = item.split("::");
          return { id: `faq_${index}`, type: "faq_item", settings: { question, answer } };
        });
    return blocks
      .map((block) => ({
	        "@type": "Question",
	        name: cleanSchemaText(site, blockValue(block, "question", blockValue(block, "title"))),
	        acceptedAnswer: {
	          "@type": "Answer",
	          text: cleanSchemaText(site, blockValue(block, "answer", blockValue(block, "description")))
	        }
	      }))
      .filter((item) => cleanText(item.name) && cleanText((item.acceptedAnswer as { text: string }).text));
  });
  return questions.length ? { "@type": "FAQPage", mainEntity: questions } : undefined;
}

function articleSchema(site: Site, routeMode: "host" | "path", pagePath: string, title: string, description: string, pageJson: ThemePageJson | undefined): JsonLdNode | undefined {
  const isArticle = pagePath.startsWith("/blog/") || /^(article|post)$/i.test(pageJson?.pageType ?? "");
  if (!isArticle) return undefined;
  const image = articleSectionValue(pageJson, "imageUrl") || sectionValue(pageJson, "backgroundImage");
  const author = articleSectionValue(pageJson, "author") || siteBrandName(site);
  const datePublished = articleSectionValue(pageJson, "publishedAt");
  const dateModified = articleSectionValue(pageJson, "updatedAt") || datePublished;
  const tags = listText(sectionOfType(pageJson, "blog_article")?.settings.tags);
  return {
    "@type": "BlogPosting",
    headline: articleSectionValue(pageJson, "title") || title,
    description: articleSectionValue(pageJson, "summary") || description,
    author: { "@type": "Person", name: cleanSchemaText(site, author) },
    publisher: {
      "@type": "Organization",
      name: siteBrandName(site),
      url: siteBaseUrl(site, routeMode)
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
  if (path.startsWith("/tools/")) {
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
    const activeProducts = input.products?.filter((product) => product.siteId === input.site.id && product.status === "active") ?? [];
    const offers = activeProducts.flatMap((product) =>
      product.prices.map((price) => ({
        "@type": "Offer",
        name: price.label || product.name,
        price: (price.amountCents / 100).toFixed(2),
        priceCurrency: price.currency.toUpperCase(),
        availability: "https://schema.org/InStock",
        category: isSpanishXbySite(input.site)
          ? product.type === "subscription" ? "suscripcion de fotos IA" : "paquete de creditos IA"
          : product.type === "subscription" ? "AI photo subscription" : "AI photo credit pack",
        description: isSpanishXbySite(input.site)
          ? `${price.creditsGranted} creditos${price.interval === "one_time" ? "" : ` por ${price.interval}`}`
          : `${price.creditsGranted} credits${price.interval === "one_time" ? "" : ` per ${price.interval}`}`,
        url
      }))
    );
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
          : isAidreamcapesSite(input.site) ? "AI travel portrait generation service" : "AI photo generation service",
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

function collectionPageSchema(input: JsonLdInput, title: string, description: string): JsonLdNode[] {
  if (!input.pagePath.startsWith("/collections")) return [];
  const path = schemaPagePath(input.site, input.routeMode, input.pagePath);
  const url = absoluteUrl(input.site, input.routeMode, path);
  const activePacks = (input.creativePacks ?? []).filter((pack) => pack.status === "active").slice(0, 24);
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
      isPartOf: { "@id": `${siteBaseUrl(input.site, input.routeMode)}#website` },
      publisher: {
        "@type": "Organization",
        name: siteBrandName(input.site),
        url: siteBaseUrl(input.site, input.routeMode)
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
    "@id": `${siteBaseUrl(site, routeMode)}#website`,
    name: siteBrandName(site),
    url: siteBaseUrl(site, routeMode)
  };
}

function storefrontApplicationSchema(input: JsonLdInput, title: string, description: string): JsonLdNode | undefined {
  const isHome = input.pagePath === "/" || input.page.slug === "/";
  if (!isHome) return undefined;
  const siteName = siteBrandName(input.site);
  return {
    "@type": "SoftwareApplication",
    "@id": `${siteBaseUrl(input.site, input.routeMode)}#app`,
    name: siteName,
    description,
    applicationCategory: "PhotographyApplication",
    operatingSystem: "Web",
    url: absoluteUrl(input.site, input.routeMode, schemaPagePath(input.site, input.routeMode, "/")),
    provider: { "@id": `${siteBaseUrl(input.site, input.routeMode)}#organization` },
    offers: {
      "@type": "OfferCatalog",
      "@id": `${siteBaseUrl(input.site, input.routeMode)}#plans`,
      name: isSpanishXbySite(input.site)
        ? isAidreamcapesSite(input.site) ? `Paquetes de retrato de viaje y creditos ${siteName}` : `Paquetes de fotos y creditos ${siteName}`
        : isAidreamcapesSite(input.site) ? "Aidreamcapes travel portrait packages and credits" : "MyDreamShoots photo packages and credits",
      url: absoluteUrl(input.site, input.routeMode, schemaPagePath(input.site, input.routeMode, "/pricing"))
    }
  };
}

export function buildStorefrontJsonLd(input: JsonLdInput): JsonLdNode[] {
  const title = pageTitle(input.site, input.page);
  const description = pageDescription(input.site, input.page);
  const path = schemaPagePath(input.site, input.routeMode, input.pagePath);
  const url = absoluteUrl(input.site, input.routeMode, path);
  const graph: Array<JsonLdNode | undefined> = [
    organizationSchema(input.site, input.routeMode),
    websiteSchema(input.site, input.routeMode),
    storefrontApplicationSchema(input, title, description),
    breadcrumbs(input.site, input.routeMode, input.pagePath, title),
    faqSchema(input.site, input.pageJson),
    articleSchema(input.site, input.routeMode, input.pagePath, title, description, input.pageJson),
    ...collectionPageSchema(input, title, description),
    ...serviceOrProductSchema(input, title, description)
  ];

  return [{ "@context": "https://schema.org", "@graph": graph.filter(Boolean), url }];
}

export function buildToolDirectoryJsonLd({
  site,
  toolSlug,
  routeMode
}: {
  site: Site;
  toolSlug: string;
  routeMode: "host" | "path";
}): JsonLdNode[] {
  const item = getSeoDirectoryContentForSite(site, "tool", toolSlug);
  const pagePath = item.canonicalPath;
  const path = schemaPagePath(site, routeMode, pagePath);
  const url = absoluteUrl(site, routeMode, path);
  const siteName = siteBrandName(site);
  const graph: JsonLdNode[] = [
    organizationSchema(site, routeMode),
    websiteSchema(site, routeMode),
    breadcrumbs(site, routeMode, pagePath, item.label),
    {
      "@type": "SoftwareApplication",
      name: item.title,
      description: item.description,
      applicationCategory: pagePath.includes("video") ? "MultimediaApplication" : "PhotographyApplication",
      operatingSystem: "Web",
      url,
      provider: {
        "@type": "Organization",
        name: siteName,
        url: siteBaseUrl(site, routeMode)
      },
      offers: {
        "@type": "Offer",
        availability: "https://schema.org/InStock",
        category: isSpanishXbySite(site)
          ? isAidreamcapesSite(site) ? "herramienta de retratos de viaje IA" : "herramienta de fotos IA"
          : isAidreamcapesSite(site) ? "AI travel portrait tool" : "AI photo tool",
        url
      }
    },
    {
      "@type": "Service",
      name: item.label,
      description: item.description,
      serviceType: schemaServiceType(site, pagePath),
      provider: {
        "@type": "Organization",
        name: siteName,
        url: siteBaseUrl(site, routeMode)
      },
      url
    }
  ];

  return [{ "@context": "https://schema.org", "@graph": graph, url }];
}

export function buildCollectionDirectoryJsonLd({
  site,
  collectionSlug,
  routeMode,
  creativePacks = []
}: {
  site: Site;
  collectionSlug: string;
  routeMode: "host" | "path";
  creativePacks?: CreativePack[];
}): JsonLdNode[] {
  const item = getSeoDirectoryContentForSite(site, "collection", collectionSlug);
  const pagePath = item.canonicalPath;
  const path = schemaPagePath(site, routeMode, pagePath);
  const url = absoluteUrl(site, routeMode, path);
  const siteName = siteBrandName(site);
  const matchingPacks = creativePacks
    .filter((pack) => pack.status === "active")
    .filter((pack) => {
      const candidates = [pack.categoryRecord?.slug, pack.categoryRecord?.parent?.slug, pack.category, pack.name]
        .map((value) => cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))
        .filter(Boolean);
      return candidates.includes(item.slug);
    })
    .slice(0, 12);
  const hasMatchingPacks = matchingPacks.length > 0;
  const itemListElement = (hasMatchingPacks ? matchingPacks : item.useCases.map((useCase, index) => ({
    id: `${item.slug}_${index}`,
    name: useCase,
    description: item.description,
    imageUrl: ""
  }))).map((entry, index) => {
    const pack = entry as CreativePack;
    const name = cleanText(pack.name, item.useCases[index] ?? item.label);
    const image = cleanText(pack.imageUrl);
    const entrySlug = cleanText(pack.categoryRecord?.slug || pack.category || pack.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const entryPagePath = hasMatchingPacks && entrySlug ? getSeoDirectoryContentForSite(site, "collection", entrySlug).canonicalPath : pagePath;
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
      name: item.title,
      description: item.description,
      url,
      isPartOf: { "@id": `${siteBaseUrl(site, routeMode)}#website` },
      publisher: { "@type": "Organization", name: siteName, url: siteBaseUrl(site, routeMode) }
    },
    {
      "@type": "ItemList",
      name: isSpanishXbySite(site) ? `${item.label} opciones de foto` : `${item.label} photo options`,
      description: item.intro,
      url,
      itemListElement
    }
  ];

  return [{ "@context": "https://schema.org", "@graph": graph, url }];
}
