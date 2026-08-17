import * as XLSX from "xlsx";
import type { VideoTheme, VideoThemeCategory } from "@/lib/types";

export type VideoThemeImportCategory = {
  slug: string;
  label: string;
  description?: string;
  icon?: string;
  accentColor?: string;
  imageUrl?: string;
  sortOrder: number;
  status: VideoThemeCategory["status"];
};

export type VideoThemeImportTheme = {
  categorySlug: string;
  slug: string;
  name: string;
  headline: string;
  description: string;
  prompt: string;
  creditCost: number;
  durationSeconds: number;
  maxFrames: number;
  sortOrder: number;
  status: VideoTheme["status"];
  imageUrl?: string;
  galleryImages: string[];
};

export type VideoThemeImportError = {
  row: number;
  field?: string;
  message: string;
};

export type VideoThemeImportPreview = {
  categories: VideoThemeImportCategory[];
  themes: VideoThemeImportTheme[];
  errors: VideoThemeImportError[];
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function numberValue(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function statusValue(value: unknown, fallback: VideoTheme["status"]): VideoTheme["status"] {
  const normalized = text(value).toLowerCase();
  return normalized === "active" || normalized === "draft" || normalized === "paused" ? normalized : fallback;
}

function galleryValue(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(text).filter(Boolean).slice(0, 12);
  return text(value).split(/[\n,|]/).map((item) => item.trim()).filter(Boolean).slice(0, 12);
}

function validSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function normalizedHeader(value: string): string {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [normalizedHeader(key), value]));
}

export function parseVideoThemeImport(buffer: Buffer): Array<Record<string, unknown>> {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" }).map(normalizeRow);
}

export function previewVideoThemeImport(
  rows: Array<Record<string, unknown>>,
  existingCategories: VideoThemeCategory[] = [],
  existingThemes: VideoTheme[] = []
): VideoThemeImportPreview {
  const categories: VideoThemeImportCategory[] = [];
  const themes: VideoThemeImportTheme[] = [];
  const errors: VideoThemeImportError[] = [];
  const categoryBySlug = new Map(existingCategories.map((category) => [category.slug, category]));
  const incomingCategoryRows = new Map<string, number>();
  const incomingThemeRows = new Map<string, number>();

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const categorySlug = text(row.categoryslug || row.category);
    const categoryLabel = text(row.categoryname || row.categorylabel);
    const themeSlug = text(row.themeslug || row.slug);
    const themeName = text(row.themename || row.name);
    const hasCategoryData = Boolean(categorySlug || categoryLabel);
    const hasThemeData = Boolean(themeSlug || themeName || row.description || row.prompt);

    if (!hasCategoryData && !hasThemeData) return;
    if (!categorySlug) errors.push({ row: rowNumber, field: "categorySlug", message: "缺少一级分类 slug。" });
    if (!categoryLabel && !categoryBySlug.has(categorySlug)) errors.push({ row: rowNumber, field: "categoryName", message: "新分类必须填写分类名称。" });
    if (categorySlug && !validSlug(categorySlug)) errors.push({ row: rowNumber, field: "categorySlug", message: "分类 slug 只能使用小写字母、数字和连字符。" });
    if (categorySlug && !incomingCategoryRows.has(categorySlug)) {
      incomingCategoryRows.set(categorySlug, rowNumber);
      const existing = categoryBySlug.get(categorySlug);
      categories.push({
        slug: categorySlug,
        label: categoryLabel || existing?.label || categorySlug,
        description: text(row.categorydescription) || existing?.description,
        icon: text(row.categoryicon) || existing?.icon,
        accentColor: text(row.categoryaccentcolor || row.accentcolor) || existing?.accentColor,
        imageUrl: text(row.categoryimageurl) || existing?.imageUrl,
        sortOrder: numberValue(row.categorysortorder, existing?.sortOrder ?? 0),
        status: statusValue(row.categorystatus, existing?.status ?? "draft")
      });
    }

    if (!hasThemeData) return;
    if (!themeSlug) errors.push({ row: rowNumber, field: "slug", message: "缺少二级主题 slug。" });
    if (themeSlug && !validSlug(themeSlug)) errors.push({ row: rowNumber, field: "slug", message: "主题 slug 只能使用小写字母、数字和连字符。" });
    if (!themeName) errors.push({ row: rowNumber, field: "name", message: "缺少二级主题名称。" });
    if (text(row.description).length < 8) errors.push({ row: rowNumber, field: "description", message: "主题描述至少需要 8 个字符。" });
    if (text(row.prompt).length < 12) errors.push({ row: rowNumber, field: "prompt", message: "主题提示词至少需要 12 个字符。" });
    if (themeSlug && incomingThemeRows.has(themeSlug)) {
      const firstRow = incomingThemeRows.get(themeSlug);
      if (firstRow !== rowNumber) errors.push({ row: rowNumber, field: "slug", message: `主题 slug 与第 ${firstRow} 行重复。` });
    } else if (themeSlug) {
      incomingThemeRows.set(themeSlug, rowNumber);
      const existing = existingThemes.find((theme) => theme.slug === themeSlug);
      const categoryExists = Boolean(categorySlug && (categoryBySlug.has(categorySlug) || incomingCategoryRows.has(categorySlug)));
      if (!categoryExists) errors.push({ row: rowNumber, field: "categorySlug", message: `找不到分类 ${categorySlug || "(空)"}。` });
      themes.push({
        categorySlug,
        slug: themeSlug,
        name: themeName,
        headline: text(row.headline) || themeName,
        description: text(row.description),
        prompt: text(row.prompt),
        creditCost: Math.max(1, numberValue(row.creditcost, existing?.creditCost ?? 24)),
        durationSeconds: Math.min(15, Math.max(1, numberValue(row.durationseconds, existing?.durationSeconds ?? 6))),
        maxFrames: Math.max(1, numberValue(row.maxframes, existing?.maxFrames ?? 10)),
        sortOrder: numberValue(row.sortorder, existing?.sortOrder ?? 0),
        status: statusValue(row.status, existing?.status ?? "draft"),
        imageUrl: text(row.imageurl) || existing?.imageUrl,
        galleryImages: galleryValue(row.galleryimages || row.gallery)
      });
    }
  });

  return { categories, themes, errors };
}
