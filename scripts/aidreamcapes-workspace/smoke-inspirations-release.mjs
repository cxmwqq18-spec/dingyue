import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import "../load-runtime-env.mjs";

// Read-only release gate. Validate the deployed SSR against this database's
// current Aidreamcapes LivePage records, never a content export or snapshot.
const origin = process.env.AIDREAMCAPES_INSPIRATIONS_ORIGIN || "https://www.aivideosugc.com";
const siteId = "site_aidreamcapes";
const prisma = new PrismaClient();
const headers = { "x-forwarded-host": "www.aivideosugc.com", "x-forwarded-proto": "https" };
const decode = (value) => value.replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#x27;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">");
const cardsFromHtml = (html) => [...html.matchAll(/<button\b[^>]*data-inspiration-card="([^"]+)"[\s\S]*?<\/button>/g)].map((match) => ({
  id: decode(match[1]), src: decode(match[0].match(/<img\b[^>]*\bsrc="([^"]+)"/)?.[1] || ""),
}));
async function read(path) {
  const response = await fetch(new URL(path, origin), { headers, signal: AbortSignal.timeout(45000) });
  assert.equal(response.status, 200, `${path} responds with HTTP 200`);
  const html = await response.text();
  assert.match(html, /data-aidreamcapes-inspirations="true"/);
  assert.match(html, /<meta[^>]*name="robots"[^>]*content="noindex, nofollow"/);
  assert.doesNotMatch(html, /aria-label="Workspace navigation"|<iframe\b/);
  assert.doesNotMatch(html, /\\"prompt\\":/);
  return cardsFromHtml(html);
}

try {
  const pages = await prisma.livePage.findMany({
    where: { siteId, OR: [{ slug: { startsWith: "/ai-video-generation/" } }, { slug: { startsWith: "/ai-image-generation/" } }, { slug: { startsWith: "ai-video-generation/" } }, { slug: { startsWith: "ai-image-generation/" } }] },
    select: { slug: true, contentJson: true, updatedAt: true }, orderBy: { slug: "asc" },
  });
  const currentSources = new Map(pages.map((page) => {
    const content = page.contentJson;
    const picker = (content?.sectionsOrder || []).map((id) => content.sections?.[id]).find((section) => section?.type === "aidreamcapes_v2_page" && Array.isArray(section.settings?.data?.visual?.picker?.cards));
    return [page.slug, picker?.settings?.data?.visual?.picker?.cards || []];
  }));
  const cards = await read("/app/create/inspirations");
  assert(cards.length > 0, "Current relational examples must exist before releasing the gallery");
  assert.deepEqual(await read("/app/inspirations"), cards, "Both standalone entries expose the same current examples");
  const video = await read("/app/inspirations?kind=video");
  const photo = await read("/app/inspirations?kind=photo");
  assert.equal(video.length + photo.length, cards.length);
  assert(video.length > 0 && photo.length > 0);
  for (const card of cards) {
    const pageSlug = [...currentSources.keys()].find((slug) => card.id.startsWith(`${slug}:`));
    assert(pageSlug, `Example ${card.id} has a current Aidreamcapes relational owner`);
    const index = Number(card.id.slice(pageSlug.length + 1).split(":")[0]);
    const source = currentSources.get(pageSlug)[index];
    assert(source, `Example ${card.id} resolves to its current picker card`);
    if (source.image?.src) assert.equal(card.src, source.image.src.trim(), "SSR uses the current relational image URL");
    else assert(source.ref, "Reference-only media must retain a current relational binding");
  }
  const urls = [...new Set(cards.map((card) => card.src))];
  for (let start = 0; start < urls.length; start += 8) {
    await Promise.all(urls.slice(start, start + 8).map(async (src) => {
      const response = await fetch(new URL(src, origin), { headers, signal: AbortSignal.timeout(30000) });
      assert.equal(response.status, 200, `Example image loads: ${src}`);
      assert.match(response.headers.get("content-type") || "", /^image\//);
      const image = await response.arrayBuffer();
      assert(image.byteLength > 0, "The example media is nonempty");
    }));
  }
  const stateTable = await prisma.$queryRaw`SELECT to_regclass('public."SitePublishedState"')::text AS name`;
  const derivedState = stateTable[0]?.name
    ? await prisma.sitePublishedState.findUnique({ where: { siteId }, select: { revision: true, contentHash: true } })
    : null;
  console.log(JSON.stringify({ ok: true, origin, siteId, source: "LivePage.contentJson", sourcePages: pages.length, examples: cards.length, videos: video.length, photos: photo.length, checkedImages: urls.length, latestSourceRevision: pages.map((page) => page.updatedAt.toISOString()).sort().at(-1), derivedCacheConsumed: false, derivedState }, null, 2));
} finally {
  await prisma.$disconnect();
}
