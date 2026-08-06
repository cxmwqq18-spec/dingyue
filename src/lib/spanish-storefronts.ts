type SpanishStorefrontIdentity = {
  id?: string | null;
  slug?: string | null;
  name?: string | null;
  primaryDomain?: string | null;
  branding?: {
    logoText?: string | null;
  } | null;
};

export const SPANISH_STOREFRONT_SITE_IDS = new Set([
  "site_mydreamshoots_xby",
  "site_aidreamcapes_xby"
]);

export const SPANISH_STOREFRONT_SLUGS = new Set([
  "aidreamshoots",
  "aidreamshoots-eu",
  "aidreamcapes-eu",
  "mydreamshoots-xby",
  "aidreamcapes-xby"
]);

export const SPANISH_STOREFRONT_DOMAINS = new Set([
  "aidreamshoots.eu",
  "www.aidreamshoots.eu",
  "aidreamcapes.eu",
  "www.aidreamcapes.eu"
]);

export const SPANISH_STOREFRONT_SLUG_ALIASES: Record<string, string> = {
  "mydreamshoots-xby": "aidreamshoots",
  "aidreamshoots-eu": "aidreamshoots",
  "aidreamcapes-xby": "aidreamcapes-eu"
};

export const SPANISH_XBY_COLLECTION_ALIASES: Record<string, string> = {
  belleza: "beauty",
  creativo: "creative",
  deportes: "world-cup-fan-photos",
  "estilo-de-vida": "outdoor-creator-scenes",
  "outdoor-creator-scenes": "estilo-y-fantasia",
  "travel-scene-pack": "estilo-y-fantasia",
  travel: "estilo-y-fantasia",
  lifestyle: "estilo-y-fantasia",
  creador: "creator",
  retratos: "retratos-y-perfiles",
  temporada: "seasonal",
  utilidades: "video-y-utilidades",
  video: "ai-video-add-ons"
};

export function canonicalSpanishXbyCollectionSlug(value: string): string {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  let canonical = normalized;
  const seen = new Set<string>();
  while (!seen.has(canonical)) {
    seen.add(canonical);
    const next = SPANISH_XBY_COLLECTION_ALIASES[canonical];
    if (!next) break;
    canonical = next;
  }
  return canonical;
}

export function cleanStorefrontHost(value: string | null | undefined): string {
  return String(value ?? "")
    .split(",")[0]
    .trim()
    .replace(/^https?:\/\//i, "")
    .split("/")[0]
    .split(":")[0]
    .toLowerCase();
}

export function spanishStorefrontIdentity(site: SpanishStorefrontIdentity | undefined): string {
  if (!site) return "";
  return `${site.id ?? ""} ${site.slug ?? ""} ${site.name ?? ""} ${site.primaryDomain ?? ""} ${site.branding?.logoText ?? ""}`.toLowerCase();
}

export function isSpanishStorefrontSite(site: SpanishStorefrontIdentity | undefined): boolean {
  if (!site) return false;
  const host = cleanStorefrontHost(site.primaryDomain);
  const identity = spanishStorefrontIdentity(site);
  return (
    Boolean(site.id && SPANISH_STOREFRONT_SITE_IDS.has(site.id)) ||
    Boolean(site.slug && SPANISH_STOREFRONT_SLUGS.has(site.slug.toLowerCase())) ||
    SPANISH_STOREFRONT_DOMAINS.has(host) ||
    /(?:-xby|_xby)/i.test(identity)
  );
}

export function isSpanishStorefrontRequestIdentity(identity: string): boolean {
  const normalized = identity.toLowerCase();
  return (
    /\b(?:aidreamcapes|mydreamshoots)-xby\b/.test(normalized) ||
    /(?:^|[\s/])aidreamshoots(?:-eu)?(?:[\s/]|$)/.test(normalized) ||
    /(?:^|[\s/])aidreamcapes-eu(?:[\s/]|$)/.test(normalized) ||
    /\baidreamshoots(?:\.eu|\.localhost)\b/.test(normalized) ||
    /\baidreamcapes\.eu\b/.test(normalized)
  );
}
