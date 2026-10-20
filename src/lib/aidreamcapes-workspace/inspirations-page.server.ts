import "server-only";
import { prisma } from "@/lib/prisma";
import { getAidreamcapesInspirationCardsFromRows, inspirationCategoryLookup } from "@/lib/aidreamcapes-inspirations";
import { inspirationExampleLinks, type InspirationPage } from "@/lib/aidreamcapes-inspirations-types";

// Project picker cards in PostgreSQL. Only one bounded batch crosses the DB
// connection; page bodies and the remainder of the gallery are never loaded.
export async function getWorkspaceInspirationPage(params: { offset?: number; kind?: string; category?: string; q?: string; basePath?: string } = {}): Promise<InspirationPage> {
  const offset = Number.isSafeInteger(params.offset) && params.offset! >= 0 ? Math.min(params.offset!, 100000) : 0;
  const kind = params.kind === "video" || params.kind === "photo" ? params.kind : "all";
  const category = params.category?.slice(0, 100) || "All";
  const q = params.q?.trim().toLowerCase().slice(0, 180) || "";
  const overrides = JSON.stringify(inspirationCategoryLookup());
  const [result] = await prisma.$queryRaw<Array<{
    rows: Array<{ slug: string; title: string; card: unknown; lead: string; cardIndex: number }>;
    total: number; counts: InspirationPage["counts"]; categories: string[];
  }>>`
    WITH lookup AS (SELECT ${overrides}::jsonb AS categories), raw AS (
      SELECT p.slug, p.title, c.card, (c.n - 1)::int AS "cardIndex", picker.value->>'lead' AS lead,
        COALESCE(NULLIF(c.card->>'ref', ''), 'src:' || NULLIF(c.card#>>'{image,src}', '')) AS ref,
        COALESCE(NULLIF(c.card->>'label', ''), c.card#>>'{image,alt}', p.title) AS label,
        CASE WHEN c.card->>'kind' IN ('video','photo') THEN c.card->>'kind'
          WHEN ltrim(p.slug, '/') LIKE 'ai-video-generation/%' THEN 'video' ELSE 'photo' END AS kind
      FROM "LivePage" p
      CROSS JOIN LATERAL (
        SELECT p."contentJson"->'sections'->sid.value->'settings'->'data'->'visual'->'picker' AS value
        FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(p."contentJson"->'sectionsOrder') = 'array' THEN p."contentJson"->'sectionsOrder' ELSE '[]'::jsonb END) WITH ORDINALITY AS sid(value,n)
        WHERE p."contentJson"->'sections'->sid.value->>'type' = 'aidreamcapes_v2_page'
          AND jsonb_typeof(p."contentJson"->'sections'->sid.value->'settings'->'data'->'visual'->'picker'->'cards') = 'array'
        ORDER BY sid.n LIMIT 1
      ) picker
      CROSS JOIN LATERAL jsonb_array_elements(picker.value->'cards') WITH ORDINALITY AS c(card,n)
      WHERE p."siteId" = 'site_aidreamcapes'
        AND (ltrim(p.slug, '/') LIKE 'ai-video-generation/%' OR ltrim(p.slug, '/') LIKE 'ai-image-generation/%')
        AND (NULLIF(c.card#>>'{image,src}', '') IS NOT NULL OR NULLIF(c.card->>'ref', '') IS NOT NULL)
    ), distinct_cards AS (
      SELECT DISTINCT ON (ref) raw.*, COALESCE(lookup.categories->>ref, lookup.categories->>regexp_replace(card#>>'{image,src}', '-{1,2}[0-9]+[.]webp$', ''), 'All') AS category
      FROM raw CROSS JOIN lookup WHERE ref IS NOT NULL ORDER BY ref, slug, "cardIndex"
    ), filtered AS (
      SELECT * FROM distinct_cards WHERE (${kind} = 'all' OR kind = ${kind})
        AND (${category} = 'All' OR category = ${category})
        AND (${q} = '' OR strpos(lower(concat_ws(' ', label, card#>>'{image,alt}', title, category)), ${q}) > 0)
    ), batch AS (
      SELECT slug, title, card, lead, "cardIndex", label, ref FROM filtered ORDER BY lower(label), ref LIMIT 24 OFFSET ${offset}
    )
    SELECT COALESCE((SELECT jsonb_agg(batch ORDER BY lower(label), ref) FROM batch), '[]'::jsonb) AS rows,
      (SELECT count(*)::int FROM filtered) AS total,
      (SELECT jsonb_build_object('all', count(*), 'video', count(*) FILTER (WHERE kind='video'), 'photo', count(*) FILTER (WHERE kind='photo')) FROM distinct_cards) AS counts,
      COALESCE((SELECT jsonb_agg(category ORDER BY category) FROM (SELECT DISTINCT category FROM distinct_cards WHERE (${kind}='all' OR kind=${kind}) AND category <> 'All') categories), '[]'::jsonb) AS categories
  `;
  const cards = getAidreamcapesInspirationCardsFromRows(result.rows.map(row => ({
    slug: row.slug, title: row.title, cardIndex: row.cardIndex,
    contentJson: { sectionsOrder: ['picker'], sections: { picker: { type: 'aidreamcapes_v2_page', settings: { data: { visual: { picker: { lead: row.lead, cards: [row.card] } } } } } } }
  }))).map(card => ({
    id: card.id, label: card.label, imageSrc: card.imageSrc, imageAlt: card.imageAlt,
    pageTitle: card.pageTitle, kind: card.kind, description: card.description, category: card.category,
    ...inspirationExampleLinks(card, params.basePath)
  }));
  return { cards, counts: result.counts, categories: ['All', ...result.categories], total: result.total,
    nextOffset: offset + result.rows.length < result.total ? offset + result.rows.length : null };
}
