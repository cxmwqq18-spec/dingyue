import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import "../load-runtime-env.mjs";

// Read-only release gate. Validate the deployed SSR against this database's
// current Aidreamcapes LivePage records, never a content export or snapshot.
//
// The inspiration library projects the same relational detail cards that own
// the public media detail pages, so this gate proves three things:
//   1. every rendered card resolves to a current single-owner detail card;
//   2. the display projection carries the card's real image, video, display
//      prompt and detail-page link (no picker-lead placeholders);
//   3. the creation CTA stays the fixed workspace entry with an inert payload.
const origin = process.env.AIDREAMCAPES_INSPIRATIONS_ORIGIN || "https://www.aivideosugc.com";
const mediaOrigin = process.env.AIDREAMCAPES_INSPIRATIONS_MEDIA_ORIGIN || origin;
const siteId = "site_aidreamcapes";
const prisma = new PrismaClient();
const headers = { "x-forwarded-host": "www.aivideosugc.com", "x-forwarded-proto": "https" };
const decode = (value) => value.replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#x27;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">");
const cardsFromHtml = (html) => [...html.matchAll(/<button\b[^>]*data-inspiration-card="([^"]+)"[\s\S]*?<\/button>/g)].map((match) => ({
  id: decode(match[1]), src: decode(match[0].match(/<img\b[^>]*\bsrc="([^"]+)"/)?.[1] || ""),
}));

/** The full flight stream, as sent by the SSR response. */
function flightStream(html) {
  const prefix = "self.__next_f.push(";
  return [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((match) => match[1])
    .filter((script) => script.startsWith(prefix) && script.endsWith(")"))
    .map((script) => JSON.parse(script.slice(prefix.length, -1)))
    .filter((entry) => typeof entry?.[1] === "string").map((entry) => entry[1]).join("");
}

/** Flight row table. Long strings (prompts) ship as text rows
 * `id:T<hexByteLength>,<content>` (see emitTextChunk in React Flight: the
 * length is hexadecimal and counts UTF-8 bytes, so the content is sliced from
 * the byte stream and can contain raw newlines). */
function flightRows(html) {
  const map = new Map();
  const stream = flightStream(html);
  const bytes = Buffer.from(stream, "utf8");
  const textRow = /([0-9a-f]{1,8}):T([0-9a-f]+),/g;
  const charIndexForByte = (endByte, fromChar) => {
    let low = fromChar, high = stream.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (Buffer.byteLength(stream.slice(0, middle)) < endByte) low = middle + 1;
      else high = middle;
    }
    return low;
  };
  for (let match = textRow.exec(stream); match; match = textRow.exec(stream)) {
    const contentStartChar = match.index + match[0].length;
    const contentStartByte = Buffer.byteLength(stream.slice(0, contentStartChar));
    const length = parseInt(match[2], 16);
    map.set(match[1], bytes.subarray(contentStartByte, contentStartByte + length).toString("utf8"));
    textRow.lastIndex = charIndexForByte(contentStartByte + length, contentStartChar);
  }
  return map;
}

function resolveFlightReference(rows, value) {
  if (typeof value !== "string") return value;
  const match = value.match(/^\$L?([0-9a-f]+)$/);
  if (!match || !rows.has(match[1])) return value;
  return resolveFlightReference(rows, rows.get(match[1]));
}

function resolveFlightValue(rows, value) {
  if (Array.isArray(value)) return value.map((item) => resolveFlightValue(rows, item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveFlightValue(rows, item)]));
  }
  return resolveFlightReference(rows, value);
}

function serializedValueFromHtml(html, field) {
  const rows = flightRows(html);
  const stream = flightStream(html);
  const key = `"${field}":`;
  const keyIndex = stream.indexOf(key);
  assert(keyIndex >= 0, `SSR serializes ${field}`);
  const start = keyIndex + key.length;
  assert(["{", "["].includes(stream[start]));
  let depth = 0, quoted = false, escaped = false;
  for (let index = start; index < stream.length; index++) {
    const character = stream[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
    } else if (character === '"') quoted = true;
    else if (character === "{" || character === "[") depth++;
    else if ((character === "}" || character === "]") && --depth === 0) {
      return resolveFlightValue(rows, JSON.parse(stream.slice(start, index + 1)));
    }
  }
  assert.fail(`${field} must be complete JSON`);
}

async function read(path, { workspace = false } = {}) {
  const response = await fetch(new URL(path, origin), { headers, signal: AbortSignal.timeout(45000) });
  assert.equal(response.status, 200, `${path} responds with HTTP 200`);
  const html = await response.text();
  // The embedded gallery uses the workspace chrome and exposes the same
  // relational cards directly.
  assert.match(html, /aria-label="Workspace navigation"/);
  assert.match(html, /<meta[^>]*name="robots"[^>]*content="noindex, nofollow"/);
  assert.doesNotMatch(html, /<iframe\b/);
  // Workspace quick starts and explicit entry transfers may carry editable
  // prompts. The card's prompt field is its public display prompt: the exact
  // text the example's own detail page publishes, validated against the
  // relational rows below. The creation CTA is the fixed workspace entry that
  // owns the inert payload.
  const cards = workspace ? serializedValueFromHtml(html, "initialInspirations").cards : serializedValueFromHtml(html, "cards");
  assert(Array.isArray(cards) && cards.length > 0);
  const workspaceEntryPath = /^(?:\/site\/(?:aidreamcapes|aivideosugc))?\/app\/create(?:\/[a-z0-9-]+){1,2}$/;
  for (const card of cards) {
    assert.equal(typeof card.prompt, "string", `Card ${card.id} carries its display prompt`);
    assert(card.prompt.length > 0 && card.prompt.length <= 4000, `Card ${card.id} prompt is the capped display prompt`);
    const cta = new URL(card.workspaceHref, origin);
    assert.match(cta.pathname, workspaceEntryPath, `Card ${card.id} CTA enters a fixed workspace path`);
    assert.equal(cta.search, "", `Card ${card.id} CTA carries no query string`);
    assert(card.entry && ["video", "images"].includes(card.entry.view), `Card ${card.id} CTA payload targets a media workspace view`);
    assert(card.entry.query && typeof card.entry.query === "object" && !Array.isArray(card.entry.query), `Card ${card.id} CTA payload carries query inputs`);
    // React Flight serializes absent optional fields as the "$undefined" sentinel.
    const scene = card.entry.scene && card.entry.scene !== "$undefined" ? card.entry.scene : undefined;
    if (scene) assert.match(cta.pathname, /\/app\/create\/(?:scene\/[a-z0-9._-]+|ai-image-generation|ai-video-generation)$/i, `Card ${card.id} CTA enters its scene or media workspace view`);
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
    prompt: serialized.get(card.id)?.prompt,
    createHref: serialized.get(card.id)?.createHref,
    workspaceHref: serialized.get(card.id)?.workspaceHref,
    entry: serialized.get(card.id)?.entry,
    video: serialized.get(card.id)?.video,
  }));
}

/** The detail-card shapes that can own a public detail page (runtime parity). */
function* detailCards(contentJson) {
  const sections = contentJson?.sections;
  const order = Array.isArray(contentJson?.sectionsOrder) ? contentJson.sectionsOrder : [];
  if (!sections || typeof sections !== "object") return;
  for (const sectionId of order) {
    const section = sections[sectionId];
    if (section?.type !== "aidreamcapes_v2_page") continue;
    const data = section.settings?.data;
    if (data?.templateDefinition?.card) yield data.templateDefinition.card;
    const pickerCards = data?.visual?.picker?.cards;
    if (Array.isArray(pickerCards)) yield* pickerCards;
    if (Array.isArray(data?.workspaceCases)) yield* data.workspaceCases;
    const groups = data?.examples?.groups;
    if (Array.isArray(groups)) for (const group of groups) if (Array.isArray(group?.items)) yield* group.items;
  }
}

function mediaKindOf(value) {
  if (value === "photo") return "photo";
  if (value === "video" || value === "clip" || value === "scene") return "video";
  return undefined;
}

/** The display prompt exactly as the runtime caps and normalizes it. */
function displayPrompt(prompt) {
  const text = String(prompt ?? "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/[ \t]+/g, " ").replace(/[ \t]*\n[ \t]*/g, "\n").trim())
    .filter(Boolean).join("\n\n");
  return text.length > 4000 ? `${text.slice(0, 3999).trimEnd()}…` : text;
}

try {
  const rows = await prisma.livePage.findMany({ where: { siteId }, select: { slug: true, contentJson: true, updatedAt: true } });
  // Current single-owner detail cards: the same ownership rules the public
  // detail pages and the sitemap apply (exactly one owning row, no aliases).
  const aliasClaims = new Set();
  const owners = new Map();
  const sources = new Map();
  for (const row of rows) {
    for (const card of detailCards(row.contentJson)) {
      if (!card || typeof card !== "object") continue;
      const publicSlug = typeof card.publicSlug === "string" ? card.publicSlug.trim() : "";
      const kind = mediaKindOf(card.kind);
      if (!publicSlug || !kind) continue;
      if (typeof card.detailAliasOf === "string" && card.detailAliasOf.trim()) continue;
      const key = `${kind}:${publicSlug}`;
      sources.set(key, card);
      owners.set(key, [...(owners.get(key) ?? []), row.slug]);
      const aliases = Array.isArray(card.publicAliases) ? card.publicAliases : [];
      for (const alias of aliases) if (typeof alias === "string" && alias.trim()) aliasClaims.add(alias.trim());
    }
  }
  const enumerated = new Map([...sources].filter(([key]) => {
    const slug = key.slice(key.indexOf(":") + 1);
    return owners.get(key)?.length === 1 && !aliasClaims.has(slug);
  }));
  assert([...enumerated].length > 0, "Current relational detail cards must exist before releasing the gallery");

  // The standalone gallery retired (308 to this page): the embedded gallery is
  // the only remaining render and the baseline set.
  const cards = await read("/app/create/inspirations", { workspace: true });
  assert(cards.length > 0, "Current relational examples must exist before releasing the gallery");
  const creationTargets = new Set();
  for (const card of cards) {
    const key = card.id;
    const source = enumerated.get(key);
    assert(source, `Example ${card.id} resolves to a current single-owner detail card`);
    if (source.image?.src) assert.equal(card.src, source.image.src.trim(), "SSR uses the current relational image URL");
    else assert.fail(`Example ${card.id} has no current relational image`);
    assert.equal(card.prompt, displayPrompt(source.prompt), `Example ${card.id} prompt matches its detail card's published prompt`);
    const detailPath = `/${key.startsWith("photo:") ? "ai-image-generation" : "ai-video-generation"}/${key.slice(key.indexOf(":") + 1)}`;
    assert(new URL(card.createHref, origin).pathname.endsWith(detailPath), `Example ${card.id} card link opens its own detail page`);
    creationTargets.add(detailPath);
    const relationalVideo = source.video?.src;
    if (relationalVideo) {
      assert(card.video && (card.video.previewSrc ?? card.video.src) === (source.video.previewSrc ?? relationalVideo), `Example ${card.id} carries its real result video`);
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
  console.log(JSON.stringify({ ok: true, origin, siteId, source: "LivePage.contentJson", sourcePages: rows.length, examples: cards.length, checkedImages: urls.length, checkedCreationTargets: targets.length, latestSourceRevision: rows.map((page) => page.updatedAt.toISOString()).sort().at(-1), derivedCacheConsumed: false, derivedState }, null, 2));
} finally {
  await prisma.$disconnect();
}
