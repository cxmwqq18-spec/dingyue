import "server-only";
import { prisma } from "@/lib/prisma";
import { listAidreamcapesInspirationEntries } from "@/lib/aidreamcapes-workspace/media-cards.server";
import { resolveInspirationIndustryCategories } from "@/lib/aidreamcapes-workspace/media-placement.server";
import { mediaDetailIntro, mediaDetailPrompt } from "@/lib/aidreamcapes-workspace/media-detail";
import { inspirationCategoryLookup } from "@/lib/aidreamcapes-inspirations";
import { INSPIRATIONS_PAGE_SIZE, inspirationExampleLinks, type InspirationCard, type InspirationExample, type InspirationPage } from "@/lib/aidreamcapes-inspirations-types";

// The inspiration library projects the same relational detail cards that own
// the public media detail pages (single-owner enumeration, gallery order). It
// adds no content of its own: every label, prompt, video and category below is
// the example's current production data, so an online card edit is reflected
// here on the next request.
const CATEGORY_FALLBACK = "All";

/**
 * One-sentence card description. The card's own `line` when it has one;
 * otherwise the opening of the real prompt — text already published on the
 * example's public detail page. Never a section-level picker lead.
 */
function inspirationDescription(line: string | undefined, prompt: string, pageTitle: string): string {
  const intro = mediaDetailIntro({ line: line ?? "", prompt });
  if (intro) return intro;
  const head = (mediaDetailPrompt({ prompt }).split("\n\n")[0] ?? "").replace(/\n+/g, " ").trim();
  if (!head) return pageTitle;
  return head.length > 220 ? `${head.slice(0, 219).trimEnd()}…` : head;
}

function toolSlugFromOwner(ownerSlug: string, tool: string | undefined): string {
  if (tool?.trim()) return tool.trim();
  const segment = ownerSlug.split("/").filter(Boolean).at(-1);
  return segment && segment !== "ai-video-generation" && segment !== "ai-image-generation" ? segment : "video-ads";
}

export async function getWorkspaceInspirationPage(params: { offset?: number; kind?: string; category?: string; q?: string; basePath?: string } = {}): Promise<InspirationPage> {
  const offset = Number.isSafeInteger(params.offset) && params.offset! >= 0 ? Math.min(params.offset!, 100000) : 0;
  const kind = params.kind === "video" || params.kind === "photo" ? params.kind : "all";
  const category = params.category?.slice(0, 100) || "All";
  const q = params.q?.trim().toLowerCase().slice(0, 180) || "";

  const entries = await listAidreamcapesInspirationEntries();

  // Categories resolve like the detail page's industry group, then fall back to
  // the media-catalog override map, then to the uncategorized "All".
  const overrides = inspirationCategoryLookup();
  const industryCategories = await resolveInspirationIndustryCategories(entries.map((entry) => ({
    kind: entry.kind, image: entry.image, video: entry.video, placement: entry.placement
  })));

  const ownerSlugs = [...new Set(entries.map((entry) => entry.ownerSlug))];
  const ownerRows = await prisma.livePage.findMany({
    where: { siteId: "site_aidreamcapes", slug: { in: ownerSlugs } },
    select: { slug: true, title: true }
  });
  const ownerTitles = new Map(ownerRows.map((row) => [row.slug, row.title]));

  const cards: InspirationCard[] = entries.map((entry, index) => {
    const pageTitle = ownerTitles.get(entry.ownerSlug)?.trim() || entry.ownerSlug;
    const imageAlt = entry.image.alt?.trim() || entry.label;
    const category = industryCategories[index]
      ?? overrides[entry.image.src]
      ?? overrides[entry.image.src.replace(/-{1,2}[0-9]+[.]webp$/, "")]
      ?? CATEGORY_FALLBACK;
    return {
      id: `${entry.kind}:${entry.publicSlug}`,
      ref: `slug:${entry.publicSlug}`,
      label: entry.label,
      prompt: entry.prompt,
      imageSrc: entry.image.src,
      imageAlt,
      toolSlug: toolSlugFromOwner(entry.ownerSlug, entry.tool),
      pageSlug: entry.ownerSlug,
      sceneSlug: entry.sceneSlug,
      publicSlug: entry.publicSlug,
      pageTitle,
      kind: entry.kind,
      description: inspirationDescription(entry.line, entry.prompt, pageTitle),
      category
    };
  });

  const filtered = cards.filter((card) =>
    (kind === "all" || card.kind === kind)
    && (category === CATEGORY_FALLBACK || card.category === category)
    && (!q || `${card.label} ${card.imageAlt} ${card.pageTitle} ${card.category}`.toLowerCase().includes(q)));

  const counts = {
    all: cards.length,
    video: cards.filter((card) => card.kind === "video").length,
    photo: cards.filter((card) => card.kind === "photo").length
  };
  const categories = [...new Set(cards
    .filter((card) => (kind === "all" || card.kind === kind) && card.category !== CATEGORY_FALLBACK)
    .map((card) => card.category))].sort((left, right) => left.localeCompare(right));

  const batch = filtered.slice(offset, offset + INSPIRATIONS_PAGE_SIZE);
  const examples: InspirationExample[] = batch.map((card) => {
    const entry = entries.find((item) => `${item.kind}:${item.publicSlug}` === card.id)!;
    return {
      id: card.id, label: card.label, imageSrc: card.imageSrc, imageAlt: card.imageAlt,
      pageTitle: card.pageTitle, kind: card.kind, description: card.description, category: card.category,
      prompt: mediaDetailPrompt({ prompt: card.prompt }),
      ...(entry.video ? { video: entry.video } : {}),
      ...(entry.duration !== undefined ? { duration: entry.duration } : {}),
      ...inspirationExampleLinks(card, params.basePath)
    };
  });

  return { cards: examples, counts, categories: [CATEGORY_FALLBACK, ...categories], total: filtered.length,
    nextOffset: offset + batch.length < filtered.length ? offset + batch.length : null };
}
