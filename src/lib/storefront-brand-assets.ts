import type { Site } from "@/lib/types";

type BrandSite = Pick<Site, "id" | "slug" | "primaryDomain">;

const ORIGINAL_BRAND_VERSION = "20260919original";
const FAVICON_VERSION = "20260920favicon";

function versioned(path: string): string {
  return `${path}?v=${ORIGINAL_BRAND_VERSION}`;
}

function brandKey(site: BrandSite): "aidreamcapes" | "aidreamcapes-eu" | "aidreamshoots" | undefined {
  const id = site.id.trim().toLowerCase();
  const slug = site.slug.trim().toLowerCase();
  const domain = (site.primaryDomain ?? "").trim().toLowerCase();

  if (id === "site_mydreamshoots_xby" || slug === "aidreamshoots" || slug === "aidreamshoots-eu" || domain.endsWith("aidreamshoots.eu")) {
    return "aidreamshoots";
  }
  if (id === "site_aidreamcapes_xby" || slug === "aidreamcapes-eu" || domain.endsWith("aidreamcapes.eu")) {
    return "aidreamcapes-eu";
  }
  if (id === "site_aidreamcapes" || slug === "aidreamcapes" || domain.endsWith("aidreamcapes.com")) {
    return "aidreamcapes";
  }
  return undefined;
}

export function storefrontOriginalLogoUrl(site: BrandSite): string | undefined {
  switch (brandKey(site)) {
    case "aidreamshoots":
      return versioned("/assets/sites/site_aidreamshoots/brand/aidreamshoots-logo-refined.svg");
    case "aidreamcapes-eu":
      return versioned("/assets/sites/site_aidreamcapes_eu/brand/aidreamcapes-logo-refined.svg");
    case "aidreamcapes":
      return versioned("/assets/sites/site_aidreamcapes/brand/aidreamcapesai-logo-refined.svg");
    default:
      return undefined;
  }
}

export function storefrontOriginalIconUrl(site: BrandSite): string | undefined {
  return storefrontOriginalLogoUrl(site)?.replace(`?v=${ORIGINAL_BRAND_VERSION}`, `?v=${FAVICON_VERSION}`);
}

export function storefrontOriginalAppleIconUrl(site: BrandSite): string | undefined {
  switch (brandKey(site)) {
    case "aidreamshoots":
      return versioned("/assets/sites/site_aidreamshoots/brand/aidreamshoots-icon-180.png");
    case "aidreamcapes-eu":
      return versioned("/assets/sites/site_aidreamcapes_eu/brand/aidreamcapes-icon-180.png");
    case "aidreamcapes":
      return versioned("/assets/sites/site_aidreamcapes/brand/aidreamcapes-icon-180.png");
    default:
      return undefined;
  }
}

export function storefrontOriginalIconSet(site: BrandSite): {
  icon: string;
  apple: string;
} | undefined {
  const icon = storefrontOriginalIconUrl(site);
  const apple = storefrontOriginalAppleIconUrl(site);
  if (!icon || !apple) return undefined;
  return { icon, apple };
}
