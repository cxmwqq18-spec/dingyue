import fontsData from "../../../data/saas-fonts.json";
import type { ThemeSettingValue } from "@/lib/types";

export type SaasFontVariant = {
  key: string;
  label: string;
  weight: number;
  style: "normal" | "italic";
  fontFace: string;
};

export type SaasFontOption = {
  family: string;
  category: string;
  variants: SaasFontVariant[];
};

type RawSaasFont = {
  family: string;
  variants: string[];
  category?: string;
  files: Record<string, string>;
};

type RawSaasFonts = {
  itemcn?: Record<string, string>;
  items: RawSaasFont[];
};

const rawFonts = fontsData as RawSaasFonts;

function variantStyle(variant: string): { weight: number; style: "normal" | "italic" } {
  if (variant === "regular") return { weight: 400, style: "normal" };
  if (variant === "italic") return { weight: 400, style: "italic" };
  if (variant.endsWith("italic")) return { weight: Number.parseInt(variant, 10) || 400, style: "italic" };
  return { weight: Number.parseInt(variant, 10) || 400, style: "normal" };
}

function fontFace(font: RawSaasFont, variant: string, weight: number, style: "normal" | "italic"): string {
  const file = font.files[variant] ?? font.files.regular ?? Object.values(font.files)[0] ?? "";
  return `@font-face {  font-family:'${font.family}'; font-style:${style}; font-weight:${weight}; font-display:swap; src: url(${file}) format('woff2'); };`;
}

const fontMap = new Map<string, SaasFontOption>();

for (const font of rawFonts.items) {
  if (fontMap.has(font.family)) {
    continue;
  }
  fontMap.set(font.family, {
    family: font.family,
    category: font.category ?? "sans-serif",
    variants: font.variants.map((variant) => {
      const parsed = variantStyle(variant);
      return {
        key: variant,
        label: rawFonts.itemcn?.[variant] ?? variant,
        weight: parsed.weight,
        style: parsed.style,
        fontFace: fontFace(font, variant, parsed.weight, parsed.style)
      };
    })
  });
}

export const saasFontOptions: SaasFontOption[] = Array.from(fontMap.values());

export function saasFontValue(family: string, variantKey = "regular"): ThemeSettingValue {
  const font = saasFontOptions.find((item) => item.family === family) ?? saasFontOptions[0];
  const variant = font.variants.find((item) => item.key === variantKey) ?? font.variants[0];
  return {
    family: font.family,
    weight: variant.weight,
    varin: variant.label,
    style: variant.style,
    fallback_families: font.category,
    font_face: variant.fontFace
  };
}

export function saasFontFamily(value: ThemeSettingValue | undefined, fallback = saasFontOptions[0]?.family ?? "Lato"): string {
  if (typeof value === "string" && value.trim()) return value;
  if (value && typeof value === "object" && !Array.isArray(value) && typeof value.family === "string" && value.family.trim()) return value.family;
  return fallback;
}

export function saasFontVariantKey(value: ThemeSettingValue | undefined, family: string): string {
  const font = saasFontOptions.find((item) => item.family === family) ?? saasFontOptions[0];
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const weight = Number(value.weight);
    const style = value.style === "italic" ? "italic" : "normal";
    const match = font.variants.find((variant) => variant.weight === weight && variant.style === style);
    if (match) return match.key;
  }
  return font.variants[0]?.key ?? "regular";
}
