import type { Site } from "@/lib/types";

export type StorefrontLocale = "en" | "es" | "fr";

const FRENCH_SITE_IDS = new Set(["site_aidreamcapes_xby"]);
const FRENCH_SLUGS = new Set(["aidreamcapes-eu"]);
const FRENCH_HOSTS = new Set(["aidreamcapes.eu", "www.aidreamcapes.eu"]);

function cleanHost(value: string | null | undefined): string {
  return String(value ?? "")
    .split(",")[0]
    .trim()
    .replace(/^https?:\/\//i, "")
    .split("/")[0]
    .split(":")[0]
    .toLowerCase();
}

export function isFrenchStorefrontSite(site: Pick<Site, "id" | "slug" | "primaryDomain"> | undefined): boolean {
  if (!site) return false;
  return FRENCH_SITE_IDS.has(site.id) || FRENCH_SLUGS.has(site.slug.trim().toLowerCase()) || FRENCH_HOSTS.has(cleanHost(site.primaryDomain));
}

export function storefrontLocaleForSite(site: Pick<Site, "id" | "slug" | "primaryDomain"> | undefined): StorefrontLocale {
  if (isFrenchStorefrontSite(site)) return "fr";
  const identity = `${site?.id ?? ""} ${site?.slug ?? ""} ${site?.primaryDomain ?? ""}`.toLowerCase();
  if (/(?:aidreamshoots|mydreamshoots-xby|aidreamcapes-xby)/.test(identity)) return "es";
  return "en";
}

export function storefrontLocaleForRequestIdentity(identity: string | null | undefined): StorefrontLocale {
  const normalized = String(identity ?? "").toLowerCase();
  if (/(?:aidreamcapes\.eu|aidreamcapes-eu|site_aidreamcapes_xby)/.test(normalized)) return "fr";
  if (/(?:aidreamshoots\.eu|aidreamshoots|mydreamshoots-xby)/.test(normalized)) return "es";
  return "en";
}
