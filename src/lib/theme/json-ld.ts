import { normalizeThemeSeo } from "@/lib/theme/seo";
import { getSeoDirectoryContentForSite } from "@/lib/dreamshoot-seo-content";
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
  if (token.includes("aidreamcapes")) return "Aidreamcapes";
  if (token.includes("mydreamshoots") || token.includes("dreamshoot")) return "MyDreamShoots";
  return cleanText(site.branding.logoText, site.name);
}

function isAidreamcapesSite(site: Site): boolean {
  return siteBrandName(site) === "Aidreamcapes";
}

function schemaServiceType(site: Site, pagePath: string): string {
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
  if (isAidreamcapesSite(site)) return `${title} travel album options`;
  return `${title} package options`;
}

function cleanSchemaText(site: Site, value: unknown, fallback = ""): string {
  const brandName = siteBrandName(site);
  return cleanPaidStorefrontText(value, fallback)
    .replace(/\bMydreamShoots\b/g, "MyDreamShoots")
    .replace(/\bMydreamshoots\b/g, "MyDreamShoots")
    .replace(/\bDreamShootAI\b/g, brandName)
    .replace(/\s+/g, " ")
    .trim();
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

function absoluteUrl(site: Site, routeMode: "host" | "path", pathOrUrl = "/"): string {
  const value = cleanText(pathOrUrl, "/");
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  const base = siteOriginUrl(site).replace(/\/$/, "");
  return `${base}${value.startsWith("/") ? value : `/${value}`}`;
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
      name: "Home",
      item: absoluteUrl(site, routeMode, schemaPagePath(site, routeMode, "/"))
    }
  ];
  let current = "";
  parts.forEach((part, index) => {
    current += `/${part}`;
    items.push({
      "@type": "ListItem",
      position: index + 2,
      name: index === parts.length - 1 ? title : part.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
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
  const image = sectionValue(pageJson, "imageUrl") || sectionValue(pageJson, "backgroundImage");
  return {
    "@type": "Article",
    headline: title,
    description,
    author: { "@type": "Organization", name: siteBrandName(site) },
    publisher: { "@type": "Organization", name: siteBrandName(site) },
    mainEntityOfPage: absoluteUrl(site, routeMode, schemaPagePath(site, routeMode, pagePath)),
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
        category: product.type === "subscription" ? "AI photo subscription" : "AI photo credit pack",
        description: `${price.creditsGranted} credits${price.interval === "one_time" ? "" : ` per ${price.interval}`}`,
        url
      }))
    );
    const offerCatalog = offers.length
      ? {
          "@type": "OfferCatalog",
          "@id": `${url}#offers`,
          name: `${siteName} plans and credit packs`,
          itemListElement: offers
        }
      : undefined;
    return [
      {
        "@type": "Service",
        name: title,
        description,
        provider: { "@type": "Organization", name: siteName },
        serviceType: isAidreamcapesSite(input.site) ? "AI travel portrait generation service" : "AI photo generation service",
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
      url: absoluteUrl(input.site, input.routeMode, schemaPagePath(input.site, input.routeMode, `/collections/${slugifySchemaPart(pack.categoryRecord?.slug || pack.category || pack.name)}`)),
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
      name: isAidreamcapesSite(input.site) ? "Aidreamcapes travel portrait packages and credits" : "MyDreamShoots photo packages and credits",
      url: absoluteUrl(input.site, input.routeMode, schemaPagePath(input.site, input.routeMode, "/pricing"))
    }
  };
}

export function buildStorefrontJsonLd(input: JsonLdInput): JsonLdNode[] {
  const title = pageTitle(input.site, input.page);
  const description = pageDescription(input.site, input.page);
  const path = schemaPagePath(input.site, input.routeMode, input.pagePath);
  const url = absoluteUrl(input.site, input.routeMode, path);
  const siteName = siteBrandName(input.site);
  const graph: Array<JsonLdNode | undefined> = [
    {
      "@type": "Organization",
      "@id": `${siteBaseUrl(input.site, input.routeMode)}#organization`,
      name: siteName,
      url: siteBaseUrl(input.site, input.routeMode),
      description: cleanSchemaText(input.site, input.site.branding.description)
    },
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
    {
	      "@type": "Organization",
	      "@id": `${siteBaseUrl(site, routeMode)}#organization`,
	      name: siteName,
	      url: siteBaseUrl(site, routeMode),
	      description: cleanSchemaText(site, site.branding.description)
	    },
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
        category: isAidreamcapesSite(site) ? "AI travel portrait tool" : "AI photo tool",
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
      const candidates = [pack.categoryRecord?.slug, pack.category, pack.name]
        .map((value) => cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))
        .filter(Boolean);
      return candidates.includes(item.slug);
    })
    .slice(0, 12);
  const itemListElement = (matchingPacks.length ? matchingPacks : item.useCases.map((useCase, index) => ({
    id: `${item.slug}_${index}`,
    name: useCase,
    description: item.description,
    imageUrl: ""
  }))).map((entry, index) => {
    const pack = entry as CreativePack;
    const name = cleanText(pack.name, item.useCases[index] ?? item.label);
    const image = cleanText(pack.imageUrl);
    return {
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Service",
        name,
        description: cleanText(pack.description, item.description),
        url,
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
      name: `${item.label} photo options`,
      description: item.intro,
      url,
      itemListElement
    }
  ];

  return [{ "@context": "https://schema.org", "@graph": graph, url }];
}
