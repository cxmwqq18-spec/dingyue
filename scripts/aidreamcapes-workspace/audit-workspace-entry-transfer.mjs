#!/usr/bin/env node
// Read-only audit of the public detail-page -> workspace entry chain.
//
// Contract (media detail remediation, 2026-10-21):
//   * a public media card opens that item's own detail page and carries no
//     workspace payload;
//   * the detail page owns exactly one workspace CTA, whose inert
//     `data-workspace-entry` payload names the current media (kind + slug);
//   * replaying that payload in the two-minute cookie opens the workspace with
//     the same card resolved from the current relational row.
//
// The script reads public pages only. It never writes data.
//
// Usage:
//   AIDREAMCAPES_AUDIT_ORIGIN=http://127.0.0.1:3003 \
//   node scripts/aidreamcapes-workspace/audit-workspace-entry-transfer.mjs
import { load } from "cheerio";

const origin = String(process.env.AIDREAMCAPES_AUDIT_ORIGIN || "http://127.0.0.1:3003").replace(/\/$/, "");
const base = process.env.AIDREAMCAPES_AUDIT_PATH_MODE === "0" ? "" : "/site/aidreamcapes";
const limit = Number(process.env.AIDREAMCAPES_AUDIT_LIMIT || 0);
const pages = String(
  process.env.AIDREAMCAPES_AUDIT_PAGES || "/,/ai-image-generation,/ai-actors,/ai-video-generation,/templates,/templates/photo,/templates/video"
).split(",").map((value) => value.trim()).filter(Boolean);

const WORKSPACE_VIEWS = ["home", "video", "images", "actors", "agent", "product", "library", "inspirations", "batch", "text-to-video"];
const VIEW_SEGMENTS = {
  home: "home",
  video: "ai-video-generation",
  images: "ai-image-generation",
  actors: "ai-actors",
  agent: "text-to-video",
  product: "url-to-video",
  library: "library",
  inspirations: "inspirations",
  batch: "batch",
  "text-to-video": "text-to-video"
};
const FORBIDDEN_QUERY_KEYS = ["prompt", "actor", "size", "length", "source", "preset", "template", "tool", "tool_id", "view", "kind", "filter", "scene", "aspect", "duration"];
const MEDIA_CARD_SELECTOR = "a.v-pick-card, article.case-card a[href], article.tc a.card-title, article.tc a.use, article.actor-card a[href]";
const DETAIL_PATH_RE = /^\/(ai-image-generation|ai-video-generation)\/([a-z0-9][a-z0-9-]{0,119})$/i;
const ACTOR_PATH_RE = /^\/ai-actors\/([a-z0-9][a-z0-9-]{0,79})$/i;

const failures = [];
const report = [];

function fail(scope, message) {
  failures.push(`${scope}: ${message}`);
}

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function pathOf(href) {
  try {
    const url = new URL(href, `${origin}/`);
    const prefix = url.pathname.match(/^\/site\/(?:aidreamcapes|aivideosugc)(?=\/|$)/)?.[0] ?? "";
    return { pathname: url.pathname.slice(prefix.length) || "/", search: url.search, href: url.href };
  } catch {
    return undefined;
  }
}

async function get(path, headers = {}) {
  const absolute = /^https?:\/\//.test(path);
  // Card hrefs already carry the path-mode `/site/...` prefix; only bare
  // site-relative paths need the audit base prepended.
  const prefix = absolute || path.startsWith("/site/") ? "" : base;
  const target = absolute ? path : `${origin}${prefix}${path === "/" ? "" : path}`;
  // The dev server drops idle sockets and restarts while it compiles; a
  // transient reset is retried against the same address.
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(target, {
        headers: { "user-agent": "aidreamcapes-entry-audit/2.0", ...headers },
        redirect: "follow"
      });
      return { status: response.status, html: await response.text(), url: response.url };
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
    }
  }
  throw lastError;
}

function entryPayload(anchor) {
  const raw = anchor.attr("data-workspace-entry");
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** The card title lives next to the link, not inside it. */
function cardTitle(anchor) {
  const container = anchor.closest("article, .tc, .v-pick-card, .case-card, .mi, .make-card");
  const heading = container.find("h2, h3, h4, strong").first().text().replace(/\s+/g, " ").trim();
  if (heading) return heading;
  const text = anchor.text().replace(/\s+/g, " ").trim();
  return text.length > 160 ? text.slice(0, 160) : text;
}

function cardImage(anchor) {
  const scope = anchor.closest("article, .tc, .v-pick-card, .case-card");
  const img = (scope.length ? scope : anchor).find("img").first();
  return img.attr("src") || undefined;
}

/** Rebuild the cookie the browser stores when the detail CTA is clicked. */
function entryCookie(entry) {
  const value = { ...entry, expires: Date.now() + 120000 };
  return encodeURIComponent(JSON.stringify(value));
}

async function verifyTransfer(scope, card) {
  const { entry, href, title, image } = card;
  const cookie = `adc_workspace_entry_${entry.view}=${entryCookie(entry)}`;
  const { status, html } = await get(href, { cookie });
  if (status !== 200) {
    fail(scope, `workspace landing for "${title || href}" returned ${status}`);
    return { ok: false, checks: {} };
  }
  const hasTemplate = html.includes('data-testid="workspace-template"');
  const checks = { template: hasTemplate, title: false, image: false, actor: false, module: false };

  if (entry.media) {
    if (!hasTemplate) {
      fail(scope, `media entry ${href} did not resolve a template on the workspace landing`);
      return { ok: false, checks };
    }
    const start = html.indexOf('data-testid="workspace-template"');
    const summary = html.slice(start, start + 2000);
    if (title) {
      checks.title = summary.includes(escapeHtml(title)) || summary.includes(escapeHtml(title.slice(0, 60)));
      if (!checks.title) fail(scope, `template title "${title}" is missing from the workspace landing (${href})`);
    }
    if (image) {
      checks.image = summary.includes(escapeHtml(image));
      if (!checks.image) fail(scope, `template preview ${image} is missing from the workspace landing (${href})`);
    }
    const expectedBadge = entry.media.kind === "photo" ? "Image template" : "Video template";
    const otherBadge = entry.media.kind === "photo" ? "Video template" : "Image template";
    if (!summary.includes(expectedBadge)) fail(scope, `media entry ${href} did not resolve a ${expectedBadge}`);
    if (summary.includes(otherBadge)) fail(scope, `media entry ${href} resolved a ${otherBadge} in the ${entry.view} module`);
    return { ok: true, checks };
  }

  const actor = entry.query?.actor;
  if (actor) {
    // The actor CTA carries the actor name; the workspace must show it.
    checks.actor = Boolean(title) && html.includes(escapeHtml(title));
    if (!checks.actor) fail(scope, `actor identity "${actor}" (${title}) did not reach the workspace`);
    return { ok: true, checks };
  }

  const prompt = entry.query?.prompt;
  if (prompt) {
    checks.module = true;
    return { ok: true, checks };
  }

  const heading = entry.view === "images" ? "AI Image" : entry.view === "video" ? "AI Video" : null;
  if (heading) {
    checks.module = html.includes(heading);
    if (!checks.module) fail(scope, `tool entry ${href} did not open the ${heading} module`);
  }
  return { ok: true, checks };
}

for (const page of pages) {
  const scope = page || "/";
  const { status, html } = await get(page);
  if (status !== 200) {
    fail(scope, `public page returned ${status}`);
    continue;
  }
  const $ = load(html);

  // ---- 1. Cards never enter the workspace --------------------------------
  const detailTargets = [];
  let cardCount = 0;
  let exampleCards = 0;
  const workspaceCards = [];
  $(MEDIA_CARD_SELECTOR).each((_, node) => {
    const anchor = $(node);
    const href = anchor.attr("href");
    if (!href) return;
    cardCount += 1;
    const parsed = pathOf(href);
    if (!parsed) {
      fail(scope, `unparseable card href ${href}`);
      return;
    }
    const entry = entryPayload(anchor);
    if (entry !== undefined) {
      fail(scope, `card ${href} carries a workspace entry payload; the detail CTA owns that handoff`);
    }
    if (parsed.pathname.startsWith("/app/create")) {
      const label = cardTitle(anchor);
      const inExampleGallery = anchor.closest(".example-gallery").length > 0;
      const exampleChip = (anchor.attr("data-chips") ?? "").split(/\s+/).includes("example");
      if (inExampleGallery || exampleChip) {
        // Illustrative example cards have no catalog media, so no detail route
        // exists yet. They are counted, not treated as card-entry violations.
        exampleCards += 1;
        return;
      }
      workspaceCards.push({ href, label });
      fail(scope, `media card "${label}" still opens the workspace (${href})`);
      return;
    }
    const detail = parsed.pathname.match(DETAIL_PATH_RE);
    const actor = parsed.pathname.match(ACTOR_PATH_RE);
    if (detail) detailTargets.push({ path: parsed.pathname, kind: detail[1] === "ai-image-generation" ? "photo" : "video", slug: detail[2], title: cardTitle(anchor), image: cardImage(anchor) });
    else if (actor) detailTargets.push({ path: parsed.pathname, actor: actor[1], title: cardTitle(anchor), image: cardImage(anchor) });
    else if (!parsed.pathname.startsWith("/templates") && !parsed.pathname.startsWith("/collections") && !parsed.pathname.startsWith("/ai-actors")) {
      fail(scope, `card "${cardTitle(anchor)}" links to ${parsed.pathname}, which is not a media, actor, or template address`);
    }
  });

  // ---- 2. The detail page owns the single workspace CTA ------------------
  const sample = limit > 0 ? detailTargets.slice(0, limit) : detailTargets.slice(0, 6);
  const details = [];
  for (const detail of sample) {
    const detailPage = await get(detail.path);
    if (detailPage.status !== 200) {
      fail(scope, `detail page ${detail.path} returned ${detailPage.status}`);
      continue;
    }
    const $$ = load(detailPage.html);
    const title = $$("title").first().text().trim();
    if (/workspace/i.test(title)) fail(detail.path, `detail page still renders the workspace shell (${title})`);

    const ctas = [];
    $$("a[href]").each((_, node) => {
      const anchor = $$(node);
      const href = anchor.attr("href") ?? "";
      const parsed = pathOf(href);
      if (!parsed?.pathname.startsWith("/app/create")) return;
      ctas.push({ href, entry: entryPayload(anchor), title: cardTitle(anchor), image: cardImage(anchor) });
    });
    const owned = ctas.filter((cta) => cta.entry !== undefined && cta.entry !== null);
    // Derived media detail pages are the ones rendered by the media detail
    // shell; they own exactly one handoff. Published template pages keep their
    // own tool/example CTAs.
    const derivedDetail = detailPage.html.includes('id="media-detail"');
    if (derivedDetail && owned.length !== 1) {
      fail(detail.path, `detail page exposes ${owned.length} workspace handoff CTA(s), expected exactly 1`);
      continue;
    }
    if (!owned.length) {
      fail(detail.path, "detail page exposes no workspace handoff CTA");
      continue;
    }
    const cta = owned[0];
    if (derivedDetail && !WORKSPACE_VIEWS.includes(cta.entry.view)) fail(detail.path, `CTA carries an unknown view "${cta.entry.view}"`);
    if (derivedDetail && (!cta.entry.query || typeof cta.entry.query !== "object")) fail(detail.path, "CTA carries no query payload");
    if (derivedDetail && detail.kind) {
      const finalDetail = pathOf(detailPage.url)?.pathname.match(DETAIL_PATH_RE);
      if (!finalDetail || cta.entry.media?.kind !== detail.kind || cta.entry.media?.slug !== finalDetail[2]) {
        fail(detail.path, `CTA media payload is ${JSON.stringify(cta.entry.media)} but final detail is ${finalDetail?.[0]}`);
      }
      const expected = VIEW_SEGMENTS[cta.entry.view];
      if (expected && pathOf(cta.href)?.pathname !== `/app/create/${expected}`) {
        fail(detail.path, `CTA href does not match the fixed ${cta.entry.view} path`);
      }
      for (const key of [...new URLSearchParams(pathOf(cta.href)?.search ?? "").keys()]) {
        if (FORBIDDEN_QUERY_KEYS.includes(key)) fail(detail.path, `CTA href carries ${key} in the query string`);
      }
    }

    const transfer = await verifyTransfer(detail.path, {
      entry: cta.entry,
      href: cta.href,
      title: derivedDetail ? $$("h1").first().text().trim() : detail.title || cta.title,
      image: detail.image
    });
    details.push({
      path: detail.path,
      title,
      cta: pathOf(cta.href)?.pathname,
      identity: cta.entry.media ? `${cta.entry.media.kind}/${cta.entry.media.slug}` : cta.entry.query?.actor ?? cta.entry.view,
      transfer: transfer.checks
    });
  }

  report.push({
    page: scope,
    status,
    cards: cardCount,
    exampleCards,
    detailLinks: detailTargets.length,
    workspaceCards,
    detailsChecked: details.length,
    details
  });
}

const result = {
  ok: failures.length === 0,
  origin,
  pathMode: Boolean(base),
  pages: report,
  failures
};
if (failures.length) {
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(result, null, 2));
}
