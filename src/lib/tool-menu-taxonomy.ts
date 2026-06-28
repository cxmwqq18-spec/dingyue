import "server-only";

import { normalizeCreativePackIconName, uniqueCreativePackIconName } from "@/lib/creative-pack-icons";
import { prisma } from "@/lib/prisma";
import { uid } from "@/lib/stores/prisma-mappers";
import type { SectionBlockInstance } from "@/lib/types";

type SiteToolBlocksInput = Parameters<typeof siteToolBlocks>[0];
type SiteToolBlocksThemeSettings = NonNullable<SiteToolBlocksInput["themeSettings"]>;

const preparedDefaultToolTaxonomySites = new Set<string>();

export function isMissingToolMenuTableError(error: unknown): boolean {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  const message = error instanceof Error ? error.message : String(error ?? "");
  return code === "P2021" || /ToolCategory|ToolMenuItem/.test(message) && /does not exist|findMany|count/i.test(message);
}

export function slugifyToolTaxonomy(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

export function titleFromToolSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function blockString(block: SectionBlockInstance, key: string, fallback = ""): string {
  const value = block.settings?.[key];
  return typeof value === "string" ? value.trim() || fallback : fallback;
}

function toolSlugFromHref(href: string, title: string) {
  const path = href.split("?")[0]?.replace(/\/+$/, "") ?? "";
  const last = path.split("/").filter(Boolean).pop();
  return slugifyToolTaxonomy(last || title) || slugifyToolTaxonomy(title) || "tool";
}

function toolDetailJsonFromBlock(block: SectionBlockInstance, title: string, categoryLabel: string) {
  const detailJson = block.settings?.detailJson;
  if (detailJson && typeof detailJson === "object" && !Array.isArray(detailJson)) return detailJson;
  const description = blockString(block, "description", `${title} for private AI photo packages.`);
  const ctaLabel = categoryLabel.toLowerCase().includes("video") ? "Preview motion" : "Start a photo set";
  return {
    title,
    subtitle: description,
    ctaLabel,
    guideTitle: `${title} guide`,
    guideBody: `${description} Use clear source photos, review the credit cost, and keep finished outputs in your private account gallery.`,
    detailTitle: `What ${title} is used for`,
    detailBody: `Use ${title} when you want a focused ${categoryLabel.toLowerCase()} workflow before committing to a larger private photo package.`,
    useCases: ["Cleaner profile photos", "Private gallery delivery", "Credit-aware package planning"],
    workflow: [
      "Upload clear source photos or choose finished gallery images.",
      "Review the style direction, credit cost, and private delivery settings.",
      "Generate, compare outputs, and keep favorites in your account gallery."
    ]
  };
}

function siteToolBlocks(site: {
  themeSettings?: {
    publishedJson?: {
      globalSections?: Record<string, { blocks?: SectionBlockInstance[] }>;
    };
  };
  pages?: Array<{ publishedJson?: { sections?: Record<string, { blocks?: SectionBlockInstance[] }> } }>;
}) {
  const headerBlocks = site.themeSettings?.publishedJson?.globalSections?.header?.blocks ?? [];
  const pageBlocks = (site.pages ?? []).flatMap((page) =>
    Object.values(page.publishedJson?.sections ?? {}).flatMap((section) => section.blocks ?? [])
  );
  const seen = new Set<string>();
  return [...headerBlocks, ...pageBlocks]
    .filter((block) => block.type === "tool_card")
    .filter((block) => {
      const title = blockString(block, "title", block.id);
      const href = blockString(block, "href", "/tools");
      const key = `${title}:${href}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export async function ensureDefaultToolMenuTaxonomy(siteId: string) {
  if (preparedDefaultToolTaxonomySites.has(siteId)) return;
  let existing = 0;
  try {
    existing = await prisma.toolCategory.count({ where: { siteId } });
  } catch (error) {
    if (isMissingToolMenuTableError(error)) return;
    throw error;
  }
  if (existing > 0) await backfillToolCategoryIcons(siteId);
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: {
      id: true,
      settings: { select: { publishedJson: true } },
      pages: { select: { publishedJson: true }, orderBy: { slug: "asc" } }
    }
  });
  if (!site) return;
  const themeSettings: SiteToolBlocksInput["themeSettings"] | undefined = site.settings
    ? { publishedJson: site.settings.publishedJson as SiteToolBlocksThemeSettings["publishedJson"] }
    : undefined;
  const blocks = siteToolBlocks({
    themeSettings,
    pages: site.pages as Parameters<typeof siteToolBlocks>[0]["pages"]
  });
  if (!blocks.length) {
    preparedDefaultToolTaxonomySites.add(siteId);
    return;
  }
  const usedRootIcons = new Set<string>();
  const usedChildIcons = new Map<string, Set<string>>();
  const parentBySlug = new Map<string, string>();
  for (const [index, block] of blocks.entries()) {
    const categoryLabel = blockString(block, "category", "AI Tools");
    const parentSlug = slugifyToolTaxonomy(categoryLabel) || "ai-tools";
    let parentId = parentBySlug.get(parentSlug);
    if (!parentId) {
      const parent = await prisma.toolCategory.upsert({
        where: { siteId_slug: { siteId, slug: parentSlug } },
        create: {
          id: uid("tool_cat"),
          siteId,
          slug: parentSlug,
          label: titleFromToolSlug(parentSlug),
          description: `${titleFromToolSlug(parentSlug)} tool category.`,
          icon: uniqueCreativePackIconName(parentSlug, usedRootIcons),
          sortOrder: parentBySlug.size
        },
        update: {}
      });
      parentId = parent.id;
      parentBySlug.set(parentSlug, parentId);
    }
    const badge = blockString(block, "badge", blockString(block, "title", "Tool"));
    const childSlug = slugifyToolTaxonomy(`${parentSlug}-${badge}`) || `${parentSlug}-${index + 1}`;
    const childUsed = usedChildIcons.get(parentId) ?? new Set<string>();
    usedChildIcons.set(parentId, childUsed);
    const child = await prisma.toolCategory.upsert({
      where: { siteId_slug: { siteId, slug: childSlug } },
      create: {
        id: uid("tool_cat"),
        siteId,
        parentId,
        slug: childSlug,
        label: badge,
        description: `${badge} tools.`,
        icon: uniqueCreativePackIconName(`${badge} ${childSlug}`, childUsed),
        sortOrder: index
      },
      update: {}
    });
    const title = blockString(block, "title", "AI photo tool");
    const href = blockString(block, "href", "/tools");
    const detailJson = toolDetailJsonFromBlock(block, title, categoryLabel);
    await prisma.toolMenuItem.upsert({
      where: { siteId_slug: { siteId, slug: toolSlugFromHref(href, title) } },
      create: {
        id: uid("tool_item"),
        siteId,
        categoryId: child.id,
        slug: toolSlugFromHref(href, title),
        title,
        description: blockString(block, "description") || null,
        badge: badge || null,
        icon: child.icon,
        imageUrl: blockString(block, "imageUrl") || null,
        href,
        detailJson,
        sortOrder: index
      },
      update: {}
    });
  }
  preparedDefaultToolTaxonomySites.add(siteId);
}

export async function backfillToolCategoryIcons(siteId: string) {
  let categories: Array<{ id: string; parentId: string | null; slug: string; label: string; icon: string | null }>;
  try {
    categories = await prisma.toolCategory.findMany({
      where: { siteId },
      select: { id: true, parentId: true, slug: true, label: true, icon: true },
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { label: "asc" }]
    });
  } catch (error) {
    if (isMissingToolMenuTableError(error)) return;
    throw error;
  }
  const byParent = new Map<string, typeof categories>();
  for (const category of categories) {
    const key = category.parentId ?? "root";
    byParent.set(key, [...(byParent.get(key) ?? []), category]);
  }
  for (const group of byParent.values()) {
    const used = new Set<string>();
    for (const category of group) {
      const normalized = category.icon ? normalizeCreativePackIconName(category.icon) : "";
      if (normalized && !used.has(normalized)) {
        used.add(normalized);
        if (category.icon !== normalized) await prisma.toolCategory.update({ where: { id: category.id }, data: { icon: normalized } });
        continue;
      }
      const icon = uniqueCreativePackIconName(`${category.label} ${category.slug}`, used);
      await prisma.toolCategory.update({ where: { id: category.id }, data: { icon } });
    }
  }
}
