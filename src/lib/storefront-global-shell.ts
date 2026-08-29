export const GUARDED_STOREFRONT_FOOTER_PATHS = [
  "/children-privacy",
  "/content",
  "/cookies",
  "/creators-circle",
  "/privacy",
  "/refunds",
  "/state-privacy",
  "/terms"
] as const;

function normalizedInternalPath(href: string): string | undefined {
  const path = href.trim().split(/[?#]/)[0];
  if (!path.startsWith("/") || path.startsWith("//")) return undefined;
  return path === "/" ? "/" : `/${path.replace(/^\/+|\/+$/g, "")}`;
}

export function storefrontGlobalShellPageSlugs(settings: unknown): string[] {
  const hrefs: string[] = [...GUARDED_STOREFRONT_FOOTER_PATHS];
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return hrefs;
  const value = settings as {
    navigation?: { headerLinks?: unknown; footerLinks?: unknown };
    globalSections?: {
      header?: { blocks?: unknown };
      footer?: { blocks?: unknown };
    };
  };
  const collectHrefs = (entry: unknown) => {
    if (Array.isArray(entry)) {
      entry.forEach(collectHrefs);
      return;
    }
    if (!entry || typeof entry !== "object") return;
    for (const [key, nested] of Object.entries(entry)) {
      if (key === "href" && typeof nested === "string") hrefs.push(nested);
      else collectHrefs(nested);
    }
  };
  collectHrefs(value.navigation?.headerLinks);
  collectHrefs(value.navigation?.footerLinks);
  collectHrefs(value.globalSections?.header?.blocks);
  collectHrefs(value.globalSections?.footer?.blocks);
  return Array.from(new Set(hrefs.flatMap((href) => {
    const path = normalizedInternalPath(href);
    return path ? [path] : [];
  })));
}
