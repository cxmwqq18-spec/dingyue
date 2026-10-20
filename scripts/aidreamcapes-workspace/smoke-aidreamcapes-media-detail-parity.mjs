#!/usr/bin/env node
// Public-surface parity gate for the AIVideosUGC media detail remediation.
//
// The same public page must be served in every public entry mode:
//   * host mode -> /<path>                  (x-forwarded-host: www.aivideosugc.com)
//   * path mode -> /site/aidreamcapes/<path>
// A media card always opens its own detail page in every mode, the detail page
// owns exactly one workspace CTA that names the card, and a derived detail page
// is `noindex, follow` in every mode.
//
// The page inventory is discovered from the live pages, so the gate follows the
// current relational content instead of a frozen slug list. Read-only.
//
// Usage:
//   AIDREAMCAPES_ROUTE_SMOKE_ORIGIN=http://127.0.0.1:3003 \
//   node scripts/aidreamcapes-workspace/smoke-aidreamcapes-media-detail-parity.mjs
import assert from "node:assert/strict";
import { load } from "cheerio";

const origin = String(process.env.AIDREAMCAPES_ROUTE_SMOKE_ORIGIN || "http://127.0.0.1:3003").replace(/\/$/, "");
const siteSlug = String(process.env.AIDREAMCAPES_AUDIT_SITE_SLUG || "aidreamcapes");
const requestTimeout = Number(process.env.AIDREAMCAPES_AUDIT_TIMEOUT || 120000);

const MODES = [
  { name: "host", prefix: "", headers: { "x-forwarded-host": "www.aivideosugc.com", "x-forwarded-proto": "https" } },
  { name: "path", prefix: `/site/${siteSlug}`, headers: {} }
];

const MEDIA_DETAIL_RE = /^\/(ai-image-generation|ai-video-generation)\/([a-z0-9][a-z0-9-]{0,119})$/i;
const FLAT_ACTOR_RE = /^\/ai-actors\/([a-z0-9][a-z0-9-]{0,79})$/i;
const CARD_SELECTOR = "a.v-pick-card, article.tc a[href], article.actor-card a[href]";

const failures = [];
const pages = [];

function fail(scope, message) {
  failures.push(`${scope}: ${message}`);
}

/** Site-relative path: the path-mode prefix is not part of the public address. */
function publicPath(href) {
  try {
    const url = new URL(href, `${origin}/`);
    return url.pathname.replace(/^\/site\/(?:aidreamcapes|aivideosugc)(?=\/|$)/, "") || "/";
  } catch {
    return undefined;
  }
}

async function fetchPage(mode, path) {
  // The dev server closes idle keep-alive sockets and restarts while it
  // recompiles. A transient socket reset is retried against the same path.
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`${origin}${mode.prefix}${path === "/" ? "" : path}`, {
        redirect: "follow",
        headers: { "user-agent": "aidreamcapes-media-detail-parity/1.0", ...mode.headers },
        signal: AbortSignal.timeout(requestTimeout)
      });
      const html = await response.text();
      return { status: response.status, html };
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw lastError;
}

function metaContent(html, name) {
  return load(html)(`meta[name="${name}"]`).attr("content")?.trim() || "";
}

function canonicalOf(html) {
  return load(html)('link[rel="canonical"]').attr("href")?.trim() || "";
}

function titleOf(html) {
  return load(html)("title").first().text().trim();
}

/** The public card links of a page: plain paths, no query, no fragment. */
function cardLinks(html) {
  const $ = load(html);
  const links = [];
  $(CARD_SELECTOR).each((_, node) => {
    const anchor = $(node);
    const href = anchor.attr("href") || "";
    const url = new URL(href, `${origin}/`);
    links.push({
      path: publicPath(href),
      query: url.search,
      hash: url.hash,
      entry: anchor.attr("data-workspace-entry")
    });
  });
  return links;
}

/** The single workspace CTA of a detail page, with its decoded payload. */
function workspaceCta(html) {
  const $ = load(html);
  const ctas = $("a[data-workspace-entry]").toArray();
  if (ctas.length !== 1) return { count: ctas.length, payload: undefined };
  const raw = ctas[0].attribs["data-workspace-entry"];
  try {
    return { count: 1, payload: JSON.parse(raw) };
  } catch {
    return { count: 1, payload: undefined };
  }
}

async function checkPath(path) {
  const scope = path;
  const rendered = [];
  for (const mode of MODES) {
    let page;
    try {
      page = await fetchPage(mode, path);
    } catch (error) {
      fail(`${scope} [${mode.name}]`, `request failed (${error instanceof Error ? error.message : String(error)})`);
      return undefined;
    }
    if (page.status !== 200) {
      fail(`${scope} [${mode.name}]`, `status ${page.status}`);
      return undefined;
    }
    rendered.push({ mode, page });
  }

  const [reference, ...rest] = rendered;
  const referenceCanonical = canonicalOf(reference.page.html);
  const referenceRobots = metaContent(reference.page.html, "robots");
  const referenceTitle = titleOf(reference.page.html);
  const referenceCards = cardLinks(reference.page.html);
  const referenceCta = workspaceCta(reference.page.html);

  for (const { mode, page } of rest) {
    const canonical = canonicalOf(page.html);
    const robots = metaContent(page.html, "robots");
    const title = titleOf(page.html);
    assert.equal(canonical, referenceCanonical, `${scope} [${mode.name}]: canonical differs from host mode`);
    assert.equal(robots, referenceRobots, `${scope} [${mode.name}]: robots differs from host mode`);
    assert.equal(title, referenceTitle, `${scope} [${mode.name}]: title differs from host mode`);
    const cards = cardLinks(page.html);
    assert.equal(cards.length, referenceCards.length, `${scope} [${mode.name}]: card count differs from host mode`);
    for (const [index, card] of cards.entries()) {
      assert.equal(card.path, referenceCards[index].path, `${scope} [${mode.name}]: card ${index} opens a different page`);
      assert.equal(card.query, referenceCards[index].query, `${scope} [${mode.name}]: card ${index} query differs`);
      assert.equal(card.hash, referenceCards[index].hash, `${scope} [${mode.name}]: card ${index} fragment differs`);
      assert.equal(card.entry, referenceCards[index].entry, `${scope} [${mode.name}]: card ${index} entry payload differs`);
    }
    const cta = workspaceCta(page.html);
    assert.equal(cta.count, referenceCta.count, `${scope} [${mode.name}]: workspace CTA count differs`);
    assert.deepEqual(cta.payload, referenceCta.payload, `${scope} [${mode.name}]: workspace CTA payload differs`);
  }

  // The card contract itself, checked on the host-mode rendering.
  for (const card of referenceCards) {
    assert.equal(card.query, "", `${scope}: media card href carries a query string (${card.path})`);
    assert.equal(card.hash, "", `${scope}: media card href carries a fragment (${card.path})`);
    assert.equal(card.entry, undefined, `${scope}: media card carries a data-workspace-entry payload (${card.path})`);
    assert.ok(
      MEDIA_DETAIL_RE.test(card.path) || FLAT_ACTOR_RE.test(card.path),
      `${scope}: media card does not open a detail route (${card.path})`
    );
  }

  pages.push({
    path: scope,
    canonical: referenceCanonical,
    robots: referenceRobots || "(none)",
    cards: referenceCards.length,
    workspaceCtas: referenceCta.count,
    modes: rendered.map((entry) => entry.mode.name)
  });
  return { html: reference.page.html, cta: referenceCta };
}

// ---- Discover the public inventory from the live pages ----------------------
const videoListing = await fetchPage(MODES[0], "/ai-video-generation");
assert.equal(videoListing.status, 200, `/ai-video-generation: status ${videoListing.status}`);
const photoListing = await fetchPage(MODES[0], "/ai-image-generation");
assert.equal(photoListing.status, 200, `/ai-image-generation: status ${photoListing.status}`);
const actorDirectory = await fetchPage(MODES[0], "/ai-actors");
assert.equal(actorDirectory.status, 200, `/ai-actors: status ${actorDirectory.status}`);

const detailPaths = new Set();
for (const listing of [videoListing, photoListing]) {
  for (const card of cardLinks(listing.html)) {
    const match = card.path.match(MEDIA_DETAIL_RE);
    if (match) detailPaths.add(card.path);
  }
}
assert(detailPaths.size > 0, "no media detail route was discovered on the public listings");
const actorPaths = new Set();
for (const card of cardLinks(actorDirectory.html)) {
  if (FLAT_ACTOR_RE.test(card.path)) actorPaths.add(card.path);
}
assert(actorPaths.size > 0, "no flat actor page was discovered on the actor directory");

// The parity gate compares the two public entry modes; the per-page content
// coverage of every detail route belongs to the media detail audit.
const SAMPLE_PER_KIND = Number(process.env.AIDREAMCAPES_AUDIT_SAMPLE || 3);
const sampledDetailPaths = [];
for (const root of ["ai-video-generation", "ai-image-generation"]) {
  const ofKind = [...detailPaths].filter((path) => path.startsWith(`/${root}/`)).sort();
  sampledDetailPaths.push(...ofKind.slice(0, SAMPLE_PER_KIND));
}
assert(sampledDetailPaths.length > 0, "no media detail route was sampled");

const inventory = [
  "/ai-video-generation",
  "/ai-image-generation",
  "/ai-actors",
  ...sampledDetailPaths,
  ...[...actorPaths].sort().slice(0, 2)
];

const rendered = new Map();
for (const path of inventory) {
  const result = await checkPath(path);
  if (result) rendered.set(path, result);
}

// ---- Derived detail pages stay out of the index ----------------------------
for (const path of sampledDetailPaths) {
  const page = rendered.get(path);
  if (!page) continue;
  const robots = metaContent(page.html, "robots").toLowerCase();
  assert.match(robots, /noindex/, `${path}: robots is not noindex (${robots || "missing"})`);
  assert.match(robots, /follow/, `${path}: robots is not follow (${robots || "missing"})`);
  assert.doesNotMatch(robots, /nofollow/, `${path}: robots is nofollow (${robots})`);
  assert.doesNotMatch(titleOf(page.html), /workspace/i, `${path}: detail page renders the workspace shell`);
  assert.equal(page.cta.count, 1, `${path}: expected exactly one workspace CTA, found ${page.cta.count}`);
}

const result = {
  ok: failures.length === 0,
  origin,
  modes: MODES.map((mode) => mode.name),
  pages,
  detailPages: detailPaths.size,
  sampledDetailPages: sampledDetailPaths.length,
  actorPages: actorPaths.size,
  failures
};
if (failures.length) {
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(result, null, 2));
}
