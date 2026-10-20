import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import "../load-runtime-env.mjs";

// Read-only release gate. Validate the deployed SSR against this database's
// current Aidreamcapes LivePage records, never a content export or snapshot.
const origin = process.env.AIDREAMCAPES_INSPIRATIONS_ORIGIN || "https://www.aivideosugc.com";
const mediaOrigin = process.env.AIDREAMCAPES_INSPIRATIONS_MEDIA_ORIGIN || origin;
const siteId = "site_aidreamcapes";
const prisma = new PrismaClient();
const headers = { "x-forwarded-host": "www.aivideosugc.com", "x-forwarded-proto": "https" };
const decode = (value) => value.replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#x27;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">");
const cardsFromHtml = (html) => [...html.matchAll(/<button\b[^>]*data-inspiration-card="([^"]+)"[\s\S]*?<\/button>/g)].map((match) => ({
  id: decode(match[1]), src: decode(match[0].match(/<img\b[^>]*\bsrc="([^"]+)"/)?.[1] || ""),
}));
function serializedValueFromHtml(html, field) {
  const prefix = "self.__next_f.push(";
  const flight = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((match) => match[1])
    .filter((script) => script.startsWith(prefix) && script.endsWith(")"))
    .map((script) => JSON.parse(script.slice(prefix.length, -1)))
    .filter((entry) => typeof entry[1] === "string").map((entry) => entry[1]).join("");
  const key = `"${field}":`;
  const keyIndex = flight.indexOf(key);
  assert(keyIndex >= 0, `SSR serializes ${field}`);
  const start = keyIndex + key.length;
  assert(["{", "["].includes(flight[start]));
  let depth = 0, quoted = false, escaped = false;
  for (let index = start; index < flight.length; index++) {
    const character = flight[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
    } else if (character === '"') quoted = true;
    else if (character === "{" || character === "[") depth++;
    else if ((character === "}" || character === "]") && --depth === 0) return JSON.parse(flight.slice(start, index + 1));
  }
  assert.fail(`${field} must be complete JSON`);
}
async function read(path, { workspace = false } = {}) {
  const response = await fetch(new URL(path, origin), { headers, signal: AbortSignal.timeout(45000) });
  assert.equal(response.status, 200, `${path} responds with HTTP 200`);
  const html = await response.text();
  // The standalone gallery owns its page marker; the embedded gallery uses
  // workspace chrome and exposes the same relational cards directly.
  if (workspace) assert.match(html, /aria-label="Workspace navigation"/);
  else assert.match(html, /data-aidreamcapes-inspirations="true"/);
  assert.match(html, /<meta[^>]*name="robots"[^>]*content="noindex, nofollow"/);
  if (workspace) assert.doesNotMatch(html, /<iframe\b/);
  else assert.doesNotMatch(html, /aria-label="Workspace navigation"|<iframe\b/);
  // Workspace quick starts and explicit entry transfers may carry editable
  // prompts. Inspiration cards must expose only the display projection, while
  // the card link opens the example's own page and the creation CTA is the
  // fixed workspace entry that owns the inert payload.
  const cards = workspace ? serializedValueFromHtml(html, "initialInspirations").cards : serializedValueFromHtml(html, "cards");
  assert(Array.isArray(cards) && cards.length > 0);
  const workspaceEntryPath = /^(?:\/site\/(?:aidreamcapes|aivideosugc))?\/app\/create(?:\/[a-z0-9-]+){1,2}$/;
  for (const card of cards) {
    assert(!Object.hasOwn(card, "prompt"), `Card ${card.id} has no raw prompt field`);
    const cta = new URL(card.workspaceHref, origin);
    assert.match(cta.pathname, workspaceEntryPath, `Card ${card.id} CTA enters a fixed workspace path`);
    assert.equal(cta.search, "", `Card ${card.id} CTA carries no query string`);
    assert(card.entry && ["video", "images"].includes(card.entry.view), `Card ${card.id} CTA payload targets a media workspace view`);
    assert(card.entry.query && typeof card.entry.query === "object" && !Array.isArray(card.entry.query), `Card ${card.id} CTA payload carries query inputs`);
    // React Flight serializes absent optional fields as the "$undefined" sentinel.
    const scene = card.entry.scene && card.entry.scene !== "$undefined" ? card.entry.scene : undefined;
    if (scene) assert.match(cta.pathname, /\/app\/create\/(?:scene\/[a-z0-9._-]+|ai-image-generation)$/i, `Card ${card.id} CTA enters its scene or media workspace view`);
    else assert.match(cta.pathname, /\/app\/create\/(?:ai-image-generation|ai-video-generation)$/, `Card ${card.id} CTA enters the media workspace view`);
    const cardLink = new URL(card.createHref, origin);
    assert(!cardLink.searchParams.has("prompt"), `Card ${card.id} has no prompt in its URL`);
    assert.match(cardLink.pathname, /^(?:\/site\/(?:aidreamcapes|aivideosugc))?\/(?:app\/create(?:\/[a-z0-9-]+){1,2}|ai-(?:image|video)-generation\/[a-z0-9-]+)$/, `Card ${card.id} link stays inside the site`);
  }
  if (workspace) assert.deepEqual(cards.map((card) => card.id), cardsFromHtml(html).map((card) => card.id));
  // Merge the two rendered destinations onto each HTML card so the relational
  // pass can prove card links open detail pages while CTAs enter the workspace.
  const serialized = new Map(cards.map((card) => [card.id, card]));
  return cardsFromHtml(html).map((card) => ({
    ...card,
    createHref: serialized.get(card.id)?.createHref,
    workspaceHref: serialized.get(card.id)?.workspaceHref,
  }));
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
  const embeddedCards = await read("/app/create/inspirations", { workspace: true });
  const cards = await read("/app/inspirations");
  assert(cards.length > 0, "Current relational examples must exist before releasing the gallery");
  assert(embeddedCards.length > 0, "The workspace gallery renders its first server page");
  assert(embeddedCards.length <= cards.length, "The workspace gallery is a page of the standalone gallery");
  const standaloneIds = new Set(cards.map((card) => card.id));
  for (const card of embeddedCards) assert(standaloneIds.has(card.id), `Workspace example ${card.id} exists in the standalone gallery`);
  const video = await read("/app/inspirations?kind=video");
  const photo = await read("/app/inspirations?kind=photo");
  assert.equal(video.length + photo.length, cards.length);
  assert(video.length > 0 && photo.length > 0);
  const photoIds = new Set(photo.map((card) => card.id));
  const creationTargets = new Set();
  for (const card of cards) {
    const pageSlug = [...currentSources.keys()].find((slug) => card.id.startsWith(`${slug}:`));
    assert(pageSlug, `Example ${card.id} has a current Aidreamcapes relational owner`);
    const index = Number(card.id.slice(pageSlug.length + 1).split(":")[0]);
    const source = currentSources.get(pageSlug)[index];
    assert(source, `Example ${card.id} resolves to its current picker card`);
    if (source.image?.src) assert.equal(card.src, source.image.src.trim(), "SSR uses the current relational image URL");
    else assert(source.ref, "Reference-only media must retain a current relational binding");
    if (source.publicSlug) {
      const detailPath = `/${photoIds.has(card.id) ? "ai-image-generation" : "ai-video-generation"}/${source.publicSlug}`;
      assert(new URL(card.createHref, origin).pathname.endsWith(detailPath), `Example ${card.id} card link opens its own detail page`);
      creationTargets.add(detailPath);
    } else {
      assert.equal(card.createHref, card.workspaceHref, `Example ${card.id} without a public page keeps the workspace destination on both links`);
    }
  }
  const targets = [...creationTargets];
  for (let start = 0; start < targets.length; start += 4) {
    await Promise.all(targets.slice(start, start + 4).map(async (target) => {
      const response = await fetch(new URL(target, origin), { headers, signal: AbortSignal.timeout(45000) });
      assert.equal(response.status, 200, `Current example creation target resolves: ${target}`);
      const html = await response.text();
      assert.doesNotMatch(html, /NEXT_HTTP_ERROR_FALLBACK;404/);
    }));
  }
  const urls = [...new Set(cards.map((card) => card.src))];
  for (let start = 0; start < urls.length; start += 8) {
    await Promise.all(urls.slice(start, start + 8).map(async (src) => {
      let response;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          response = await fetch(new URL(src, mediaOrigin), { headers, signal: AbortSignal.timeout(30000) });
          if (![429, 502, 503, 504].includes(response.status) || attempt === 2) break;
          await response.body?.cancel();
        } catch (error) { if (attempt === 2) throw error; }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
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
  console.log(JSON.stringify({ ok: true, origin, siteId, source: "LivePage.contentJson", sourcePages: pages.length, examples: cards.length, embeddedExamples: embeddedCards.length, videos: video.length, photos: photo.length, checkedImages: urls.length, checkedCreationTargets: targets.length, latestSourceRevision: pages.map((page) => page.updatedAt.toISOString()).sort().at(-1), derivedCacheConsumed: false, derivedState }, null, 2));
} finally {
  await prisma.$disconnect();
}
