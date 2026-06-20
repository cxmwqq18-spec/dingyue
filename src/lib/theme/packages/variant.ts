import type { ThemePageJson } from "@/lib/types";
import type { ThemePackageTemplateKey } from "./types";

type Replacement = {
  from: string;
  to: string;
  mode?: "contains" | "exact";
};

function replaceText(value: string, replacements: Replacement[]): string {
  return replacements.reduce((current, replacement) => {
    if (!replacement.from || replacement.from === replacement.to) return current;
    if (replacement.mode === "exact") return current === replacement.from ? replacement.to : current;
    return current.split(replacement.from).join(replacement.to);
  }, value);
}

function deepReplace<T>(value: T, replacements: Replacement[]): T {
  if (typeof value === "string") return replaceText(value, replacements) as T;
  if (Array.isArray(value)) return value.map((item) => deepReplace(item, replacements)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [key, deepReplace(entryValue, replacements)])
    ) as T;
  }
  return value;
}

export function createThemeTemplateVariant(
  base: Record<ThemePackageTemplateKey, ThemePageJson>,
  replacements: Replacement[]
): Record<ThemePackageTemplateKey, ThemePageJson> {
  return deepReplace(base, replacements);
}
