import type { ContextualLink } from "@/lib/types";

export function contextualLinksFromValue(value: unknown, currentPath?: string): ContextualLink[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const label = typeof entry.label === "string" ? entry.label.trim() : "";
    const href = typeof entry.href === "string" ? entry.href.trim() : "";
    if (!label || !/^\/(?!\/)/.test(href) || /[\\\s]/.test(href)) return [];
    const path = href.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
    if (path === currentPath || seen.has(href)) return [];
    seen.add(href);
    return [{
      label,
      href,
      before: typeof entry.before === "string" ? entry.before.trim() : undefined,
      after: typeof entry.after === "string" ? entry.after.trim() : undefined
    }];
  });
}
