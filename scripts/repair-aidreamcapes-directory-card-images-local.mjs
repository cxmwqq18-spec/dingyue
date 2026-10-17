import "./load-runtime-env.mjs";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

assertDatabaseTarget({ expectedTarget: "local" });

const prisma = new PrismaClient();
const siteId = "site_aidreamcapes";
const pageId = "site_aidreamcapes_text_to_video";
const expectedSlug = "/text-to-video";
const expectedRevision = "aidreamcapes-directory-pages-20261017-v1";
const mediaBase = "/assets/sites/site_aidreamcapes/site-v2/guide/";
const mediaGen = "/assets/sites/site_aidreamcapes/site-v2/gen/";
const imageForCard = new Map([
  ["Write a clear brief", { src: `${mediaBase}im03-home-picker-bottle-r1--640.webp`, alt: "Product details gathered as the foundation for a clear video brief" }],
  ["Choose your shots", { src: `${mediaBase}im03-home-picker-earbuds-r1--640.webp`, alt: "Selected product shots arranged for review" }],
  ["Compare versions", { src: `${mediaBase}ac1-actor-card-home-1-r1--640.webp`, alt: "Presenter direction compared across video versions" }],
  ["Review the final cut", { src: `${mediaGen}im01-video-hub-og-r1.webp`, alt: "Finished product video preview ready for review" }]
]);
const imageExists = (src) => existsSync(path.join(process.cwd(), "public", src.replace(/^\//, "")));
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

try {
  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true, slug: true } });
  if (site?.slug !== "aidreamcapes") throw new Error("Aidreamcapes site ownership mismatch; refusing update.");
  for (const media of imageForCard.values()) {
    if (!imageExists(media.src)) throw new Error(`Required local Aidreamcapes asset is missing: ${media.src}`);
  }

  const [row, dreamshootBefore] = await Promise.all([
    prisma.livePage.findUnique({ where: { id: pageId }, select: { id: true, siteId: true, slug: true, updatedAt: true, contentJson: true } }),
    prisma.livePage.findMany({ where: { siteId: "site_dreamshoot" }, select: { id: true, slug: true, title: true, contentJson: true, updatedAt: true }, orderBy: { slug: "asc" } })
  ]);
  if (!row || row.siteId !== siteId || row.slug !== expectedSlug) throw new Error("Target page identity mismatch; refusing update.");
  if (row.contentJson?.contentContract?.sourceRevision !== expectedRevision) throw new Error("Target page revision changed; refusing update.");

  const next = structuredClone(row.contentJson);
  const data = next?.sections?.v2_main?.settings?.data;
  const workflow = data?.landingSections?.find((section) => section.id === "text-video-features");
  if (!workflow || workflow.kind !== "cards" || workflow.cards?.length !== 6) throw new Error("Expected six workflow cards; refusing update.");
  const added = [];
  for (const card of workflow.cards) {
    const media = imageForCard.get(card.title);
    if (media && !card.image) {
      card.image = media;
      added.push(card.title);
    }
  }
  if (added.length !== imageForCard.size) throw new Error(`Expected to fill four missing card images; filled ${added.length}. Refusing update.`);

  const beforeHash = hash(dreamshootBefore);
  console.log(JSON.stringify({ mode: process.argv.includes("--apply-local") ? "apply-local" : "dry-run", target: { siteId, pageId, slug: row.slug }, imagesAdded: added, localAssetsExist: true, protectedMydreamshootRows: dreamshootBefore.length, protectedMydreamshootHash: beforeHash }, null, 2));
  if (process.argv.includes("--apply-local")) {
    await prisma.$transaction(async (tx) => {
      const result = await tx.livePage.updateMany({
        where: { id: pageId, siteId, slug: expectedSlug, updatedAt: row.updatedAt },
        data: { contentJson: next }
      });
      if (result.count !== 1) throw new Error("Target page changed during update; refusing overwrite.");
    }, { isolationLevel: "Serializable" });

    const [readback, dreamshootAfter] = await Promise.all([
      prisma.livePage.findUnique({ where: { id: pageId }, select: { id: true, siteId: true, slug: true, updatedAt: true, contentJson: true } }),
      prisma.livePage.findMany({ where: { siteId: "site_dreamshoot" }, select: { id: true, slug: true, title: true, contentJson: true, updatedAt: true }, orderBy: { slug: "asc" } })
    ]);
    const cards = readback?.contentJson?.sections?.v2_main?.settings?.data?.landingSections?.find((section) => section.id === "text-video-features")?.cards ?? [];
    if (!readback || readback.siteId !== siteId || readback.slug !== expectedSlug || cards.length !== 6 || cards.some((card) => !card.image || !imageExists(card.image.src))) throw new Error("Post-write image readback failed.");
    if (hash(dreamshootAfter) !== beforeHash) throw new Error("MyDreamShoots readback changed unexpectedly.");
    console.log(JSON.stringify({ updated: { id: readback.id, slug: readback.slug, updatedAt: readback.updatedAt }, workflowCards: cards.map((card) => ({ title: card.title, src: card.image.src, exists: imageExists(card.image.src) })), mydreamshootsUnchanged: true }, null, 2));
  }
} finally {
  await prisma.$disconnect();
}
