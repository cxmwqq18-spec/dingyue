import type { Site, ThemePage, ThemeSettings } from "@/lib/types";

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

export function storefrontOrigin(site: Pick<Site, "primaryDomain">): string {
  const domain = clean(site.primaryDomain);
  if (!domain) return "http://localhost:3002";
  if (/^https?:\/\//i.test(domain)) return domain.replace(/\/$/, "");
  if (/localhost|127\.0\.0\.1/i.test(domain)) return `http://${domain}`;
  return `https://${domain}`;
}

export function storefrontBaseUrl(site: Pick<Site, "primaryDomain" | "slug">, routeMode: "host" | "path" = "host"): string {
  const origin = storefrontOrigin(site);
  if (routeMode === "host") return origin;
  const domain = clean(site.primaryDomain);
  return domain && !/localhost|127\.0\.0\.1/i.test(domain) ? origin : `${origin}/site/${site.slug}`;
}

export function normalizeCanonicalPath(value: unknown, fallback = "/"): string {
  const raw = clean(value) || fallback || "/";
  if (/^https?:\/\//i.test(raw)) {
    try {
      return normalizeCanonicalPath(new URL(raw).pathname, fallback);
    } catch {
      return normalizeCanonicalPath(fallback, "/");
    }
  }
  const path = raw.split("?")[0]?.split("#")[0] || fallback || "/";
  if (path === "/") return "/";
  return `/${path.replace(/^\/+|\/+$/g, "")}`;
}

export function canonicalPathForPage(page: Pick<ThemePage, "slug" | "publishedJson">): string {
  const seo = page.publishedJson.seo;
  return normalizeCanonicalPath(seo?.canonical ?? seo?.canonicalPath, page.slug);
}

export function canonicalUrlForSite(site: Pick<Site, "primaryDomain">, path: string): string {
  const canonicalPath = normalizeCanonicalPath(path);
  return `${storefrontOrigin(site)}${canonicalPath === "/" ? "" : canonicalPath}`;
}

export function applyTitleTemplate(title: string, settings: Pick<ThemeSettings, "seo">, brand: string): string {
  const template = clean(settings.seo?.titleTemplate);
  if (!template) return title || brand;
  if (template.includes("%s")) {
    const suffix = template.replace("%s", "").replace(/^[\s|:-]+|[\s|:-]+$/g, "");
    if (suffix && title.toLowerCase().includes(suffix.toLowerCase())) return title || brand;
    return template.replace("%s", title || brand);
  }
  return title === template ? title : `${title} | ${template}`;
}
