import "server-only";
import { prisma } from "@/lib/prisma";
import { cardsFromContent, toDetailCard } from "./media-cards.server";
import { MEDIA_DETAIL_SLUG_PATTERN, type MediaDetailKind } from "./media-detail";

/** Exact persisted aliases only; never infer a redirect from a slug prefix. */
export async function mediaAliasTarget(kind: MediaDetailKind, alias: string): Promise<string | undefined> {
  if (!MEDIA_DETAIL_SLUG_PATTERN.test(alias)) return;
  const rows = await prisma.$queryRaw<Array<{ contentJson: unknown }>>`
    SELECT "contentJson" FROM "LivePage" WHERE "siteId" = 'site_aidreamcapes'
      AND jsonb_path_exists("contentJson", '$.**.publicAliases[*] ? (@ == $alias)', jsonb_build_object('alias', ${alias}))
      AND NOT EXISTS (SELECT 1 FROM "LivePage" existing WHERE existing."siteId" = 'site_aidreamcapes'
        AND existing."slug" = ${`/${kind === "photo" ? "ai-image-generation" : "ai-video-generation"}/${alias}`})
    LIMIT 3
  `;
  const targets = new Set<string>();
  for (const row of rows) for (const value of cardsFromContent(row.contentJson)) {
    if (!Array.isArray(value.publicAliases) || !value.publicAliases.includes(alias)) continue;
    const card = toDetailCard(value);
    if (card?.kind === kind && card.publicSlug && card.publicSlug !== alias && MEDIA_DETAIL_SLUG_PATTERN.test(card.publicSlug)) targets.add(card.publicSlug);
  }
  return targets.size === 1 ? [...targets][0] : undefined;
}
