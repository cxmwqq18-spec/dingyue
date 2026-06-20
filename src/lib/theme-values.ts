import type { ThemeSettingValue } from "@/lib/types";

export function themeValueToString(value: ThemeSettingValue | undefined, fallback = ""): string {
  if (value === undefined || value === null) return fallback;
  if (Array.isArray(value)) {
    return value
      .map((item) => themeValueToString(item, ""))
      .filter(Boolean)
      .join("\n");
  }
  if (typeof value === "object") {
    const family = value.family;
    const url = value.url;
    const title = value.title;
    const id = value.id;
    if (typeof family === "string") return family;
    if (typeof url === "string") return url;
    if (typeof title === "string") return title;
    if (typeof id === "string" || typeof id === "number") return String(id);
    return fallback;
  }
  return String(value);
}

export function themeValueToList(value: ThemeSettingValue | undefined, fallback: string[] = []): string[] {
  if (value === undefined || value === null) return fallback;
  if (Array.isArray(value)) return value.map((item) => themeValueToString(item)).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/\n|\|/g)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return fallback;
}
