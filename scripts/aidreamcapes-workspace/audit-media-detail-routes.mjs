#!/usr/bin/env node
// Release gate for the public media detail pages of AIVideosUGC / site_aidreamcapes.
//
// Every public media card owns a detail page at
//   /ai-video-generation/<publicSlug>   (kind: video)
//   /ai-image-generation/<publicSlug>   (kind: photo)
// derived from its current LivePage card. This gate enumerates every distinct
// (kind, publicSlug) from the relational rows (read-only) and reads the pages
// back from the running server.
//
// A detail page must:
//   * answer 200 after following any canonical redirect;
//   * carry a <title> that is not the workspace shell title (no "Workspace");
//   * declare robots "noindex, follow" (derived case pages stay out of the index);
//   * show the card label and its media;
//   * expose exactly one workspace CTA — the only /app/create anchor that carries
//     `data-workspace-entry` — and that payload's `media` must be this card.
//     Plain /app/create links without a payload (global navigation, tool links)
//     are reported but are not CTAs.
//   * keep its "related" cards on detail routes (no cards into the workspace).
//
// Sampling: every 25th slug plus evenly spaced slugs, capped at 40 requests by
// default. Pass --all to audit the whole inventory.
//
// Usage:
//   node scripts/aidreamcapes-workspace/audit-media-detail-routes.mjs
//   node scripts/aidreamcapes-workspace/audit-media-detail-routes.mjs --all
import "../load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";
import { load } from "cheerio";

const origin = String(process.env.AIDREAMCAPES_ROUTE_SMOKE_ORIGIN || "http://127.0.0.1:3003").replace(/\/$/, "");
const siteSlug = String(process.env.AIDREAMCAPES_AUDIT_SITE_SLUG || "aidreamcapes");
const pathMode = process.env.AIDREAMCAPES_AUDIT_PATH_MODE !== "0";
const base = pathMode ? `/site/${siteSlug}` : "";
const siteId = "site_aidreamcapes";
const all = process.argv.includes("--all");
const limit = all ? Infinity : Math.max(1, Number(process.env.AIDREAMCAPES_AUDIT_LIMIT || 40));
const concurrency = Math.max(1, Math.min(16, Number(process.env.AIDREAMCAPES_AUDIT_CONCURRENCY || 4)));
const requestTimeout = Number(process.env.AIDREAMCAPES_AUDIT_TIMEOUT || 60000);

const MEDIA_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,119}$/i;
const MEDIA_ROOT = { photo: "ai-image-generation", video: "ai-video-generation" };
const DETAIL_HREF_RE = /^\/(ai-image-generation|ai-video-generation)\/[a-z0-9][a-z0-9-]{0,119}$/i;
// Navigation and tool links that legitimately live outside the media CTA.
const CHROME_WORKSPACE_PATHS = new Set([
  "/app/create",
  "/app/create/home",
  "/app/create/tools",
  "/app/create/library",
  "/app/create/inspirations",
  "/app/create/text-to-video",
  "/app/create/url-to-video",
  "/app/create/ai-actors",
  "/app/create/ai-image-generation",
  "/app/create/ai-video-generation",
  "/app/create/twin",
  "/app/create/analytics",
  "/app/create/teams",
  "/app/create/developer",
  "/app/create/rewards"
]);
const CARD_SELECTOR = "a.v-pick-card, article.case-card a[href], article.tc a[href], article.actor-card a[href]";

const failures = [];
const details = [];
const skipped = [];

function fail(scope, message) {
  failures.push(`${scope}: ${message}`);
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}

function detailPath(kind, slug) {
  return `/${MEDIA_ROOT[kind]}/${slug}`;
}

/** Same card shapes the public renderer reads from a LivePage. */
function pageCards(contentJson) {
  const out = [];
  const content = record(contentJson);
  const sections = record(content?.sections);
  const order = Array.isArray(content?.sectionsOrder) ? content.sectionsOrder : [];
  for (const sectionId of order) {
    const section = record(sections?.[sectionId]);
    if (section?.type !== "aidreamcapes_v2_page") continue;
    const data = record(record(section.settings)?.data);
    const definition = record(record(data?.templateDefinition)?.card);
    if (definition) out.push(definition);
    const picker = record(record(data?.visual)?.picker);
    if (Array.isArray(picker?.cards)) {
      for (const value of picker.cards) {
        const card = record(value);
        if (card) out.push(card);
      }
    }
    if (Array.isArray(data?.workspaceCases)) {
      for (const value of data.workspaceCases) {
        const card = record(value);
        if (card) out.push(card);
      }
    }
  }
  return out;
}

function mediaOf(card) {
  const kind = card.kind === "photo" || card.kind === "video" ? card.kind : undefined;
  const slug = typeof card.publicSlug === "string" && MEDIA_SLUG_RE.test(card.publicSlug) ? card.publicSlug : undefined;
  if (!kind || !slug) return undefined;
  const image = record(card.image);
  return {
    kind,
    slug,
    label: typeof card.label === "string" ? card.label : "",
    image: typeof image?.src === "string" ? image.src : ""
  };
}

function basename(value) {
  try {
    return decodeURIComponent(String(value).split("/").pop() || "");
  } catch {
    return String(value).split("/").pop() || "";
  }
}

function robotsTokens(content) {
  return String(content || "")
    .toLowerCase()
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function pathOf(href) {
  try {
    const url = new URL(href, `${origin}/`);
    let pathname = url.pathname;
    const prefix = pathname.match(/^\/site\/(?:aidreamcapes|aivideosugc)(?=\/|$)/)?.[0];
    if (prefix) pathname = pathname.slice(prefix.length) || "/";
    return { pathname, query: url.search, hash: url.hash };
  } catch {
    return undefined;
  }
}

async function fetchPage(path) {
  const response = await fetch(`${origin}${base}${path}`, {
    redirect: "follow",
    headers: { "user-agent": "aidreamcapes-media-detail-audit/1.0" },
    signal: AbortSignal.timeout(requestTimeout)
  });
  const html = await response.text();
  return { status: response.status, html, finalPath: new URL(response.url).pathname, redirected: new URL(response.url).pathname !== `${base}${path}` };
}

async function mapLimit(items, size, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, run));
  return results;
}

function sample(items) {
  if (all || items.length <= limit) return items;
  const picked = new Set();
  for (let index = 0; index < items.length; index += 25) picked.add(index);
  const even = Math.max(1, limit - picked.size);
  for (let step = 0; step < even && picked.size < limit; step += 1) {
    picked.add(Math.round((step * (items.length - 1)) / Math.max(1, even - 1)));
  }
  for (let index = 0; picked.size < limit && index < items.length; index += 1) picked.add(index);
  return [...picked].filter((index) => index < items.length).sort((a, b) => a - b).map((index) => items[index]);
}

async function auditOne(item) {
  const path = detailPath(item.kind, item.slug);
  const scope = path;
  let page;
  try {
    page = await fetchPage(path);
  } catch (error) {
    throw new Error(`server unavailable at ${origin}${base}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (page.status !== 200) {
    fail(scope, `status ${page.status}${page.redirected ? ` (final ${page.finalPath})` : ""}`);
    return { path, status: page.status };
  }
  const $ = load(page.html);
  const title = $("title").first().text().trim();
  if (/workspace/i.test(title)) fail(scope, `<title> still renders the workspace shell (${title})`);
  if (/^workspace\b/i.test($("h1").first().text().trim())) fail(scope, "h1 still renders the workspace shell");

  const robots = robotsTokens($('meta[name="robots"]').attr("content"));
  if (!robots.includes("noindex")) fail(scope, `robots is not noindex (${robots.join(",") || "missing"})`);
  if (!robots.includes("follow")) fail(scope, `robots is not follow (${robots.join(",") || "missing"})`);
  if (robots.includes("nofollow")) fail(scope, `robots is nofollow (${robots.join(",")})`);
  if (robots.includes("index")) fail(scope, `robots allows indexing (${robots.join(",")})`);

  if (item.label) {
    const needle = item.label.slice(0, 100);
    if (!$("h1").text().includes(needle)) fail(scope, `card label is missing from the page (${item.label.slice(0, 60)})`);
  }
  if (item.image) {
    const file = basename(item.image);
    if (file && !page.html.includes(file)) fail(scope, `card media is missing from the page (${file})`);
  }

  let entryCtas = 0;
  let ctaPayload;
  const plainWorkspace = [];
  const cardWorkspace = [];
  let cardLinks = 0;
  $("a[href]").each((_, node) => {
    const anchor = $(node);
    const href = anchor.attr("href");
    if (!href) return;
    const target = pathOf(href);
    if (!target) return;
    const isWorkspace = target.pathname === "/app/create" || target.pathname.startsWith("/app/create/");
    const entry = anchor.attr("data-workspace-entry");
    if (isWorkspace && entry) {
      entryCtas += 1;
      try {
        ctaPayload = JSON.parse(entry);
      } catch {
        fail(scope, "workspace CTA carries an unreadable data-workspace-entry");
      }
      if (target.query) fail(scope, `workspace CTA carries a query string (${target.query})`);
      return;
    }
    if (isWorkspace) {
      plainWorkspace.push(target.pathname);
      if (!CHROME_WORKSPACE_PATHS.has(target.pathname)) fail(scope, `unexpected workspace link outside the CTA (${target.pathname})`);
      return;
    }
    if (anchor.closest("article.tc, article.case-card, article.actor-card").length && !anchor.hasClass("card-title")) {
      cardLinks += 1;
      const detail = target.pathname.match(DETAIL_HREF_RE);
      if (!detail) {
        fail(scope, `related card does not link to a detail route (${target.pathname})`);
        cardWorkspace.push(target.pathname);
      }
    }
  });

  if (entryCtas !== 1) fail(scope, `expected exactly one workspace CTA with data-workspace-entry, found ${entryCtas}`);
  if (ctaPayload) {
    if (ctaPayload.view !== (item.kind === "photo" ? "images" : "video")) {
      fail(scope, `workspace CTA view is ${ctaPayload.view}, expected ${item.kind === "photo" ? "images" : "video"}`);
    }
    const media = record(ctaPayload.media);
    if (!media) fail(scope, "workspace CTA carries no media payload");
    else if (media.kind !== item.kind || media.slug !== item.slug) {
      fail(scope, `workspace CTA media is ${media.kind}/${media.slug}, expected ${item.kind}/${item.slug}`);
    }
  }

  return {
    path,
    status: page.status,
    redirected: page.redirected,
    title: title.slice(0, 80),
    robots: robots.join(","),
    cta: entryCtas,
    plainWorkspaceLinks: plainWorkspace.length,
    cardLinks
  };
}

const prisma = new PrismaClient({ errorFormat: "minimal" });

try {
  const rows = await prisma.livePage.findMany({ where: { siteId }, select: { slug: true, contentJson: true } });
  const inventory = new Map();
  for (const row of rows) {
    for (const card of pageCards(row.contentJson)) {
      const media = mediaOf(card);
      if (!media) continue;
      const key = `${media.kind}/${media.slug}`;
      const existing = inventory.get(key);
      if (!existing) inventory.set(key, media);
      else if (!existing.label && media.label) existing.label = media.label;
    }
  }
  const items = [...inventory.values()].sort((a, b) => (a.kind === b.kind ? a.slug.localeCompare(b.slug) : a.kind.localeCompare(b.kind)));
  const video = items.filter((item) => item.kind === "video").length;
  const photo = items.filter((item) => item.kind === "photo").length;
  const sampleItems = sample(items);

  let serverDown = false;
  const results = [];
  try {
    const batch = await mapLimit(sampleItems, concurrency, async (item) => {
      if (serverDown) return { path: detailPath(item.kind, item.slug), skipped: true };
      try {
        return await auditOne(item);
      } catch (error) {
        serverDown = true;
        skipped.push({ path: detailPath(item.kind, item.slug), reason: error instanceof Error ? error.message : String(error) });
        return { path: detailPath(item.kind, item.slug), skipped: true };
      }
    });
    results.push(...batch);
  } catch (error) {
    serverDown = true;
    skipped.push({ reason: error instanceof Error ? error.message : String(error) });
  }

  if (serverDown) {
    console.log(`SKIP: server unavailable at ${origin}${base}.`);
    console.log(JSON.stringify({
      ok: true,
      skipped: true,
      origin,
      inventory: { total: items.length, video, photo },
      requested: sampleItems.length,
      pages: [],
      failures: []
    }, null, 2));
    process.exitCode = 0;
  } else {
    const statusCounts = {};
    for (const result of results) {
      if (result.skipped) continue;
      statusCounts[result.status] = (statusCounts[result.status] || 0) + 1;
    }
    const result = {
      ok: failures.length === 0,
      origin,
      pathMode,
      mode: all ? "all" : `sample:${sampleItems.length}`,
      inventory: { total: items.length, video, photo },
      requested: sampleItems.length,
      statusCounts,
      redirected: results.filter((entry) => entry?.redirected).length,
      checks: {
        workspaceCta: "exactly one /app/create anchor carrying data-workspace-entry, media {kind, slug} of this card",
        title: "detail <title> never renders the workspace shell",
        robots: "noindex, follow",
        content: "card label and media are rendered",
        relatedCards: "related cards link to detail routes, never /app/create"
      },
      details: results.map((entry) => entry).filter(Boolean),
      skippedPages: skipped,
      failures
    };
    if (failures.length) {
      console.error(JSON.stringify(result, null, 2));
      process.exitCode = 1;
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
  }
} catch (error) {
  console.error(JSON.stringify({ ok: false, origin, error: error instanceof Error ? error.stack : String(error) }, null, 2));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
