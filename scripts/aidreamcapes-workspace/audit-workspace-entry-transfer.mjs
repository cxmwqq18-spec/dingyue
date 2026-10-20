#!/usr/bin/env node
// Read-only audit of the public case -> workspace entry chain.
//
// Every public case card must point at a fixed workspace path (no query
// string) and must carry its own case identity outside the URL. The identity
// travels in the inert `data-workspace-entry` payload, which the browser
// stores in a two-minute cookie; the workspace resolves that payload
// server-side against the current relational card. This script replays that
// exact transfer with an HTTP request, so it verifies the real landing page
// instead of trusting the payload alone.
//
// Usage:
//   AIDREAMCAPES_AUDIT_ORIGIN=https://www.aivideosugc.com \
//   node scripts/aidreamcapes-workspace/audit-workspace-entry-transfer.mjs
import { load } from "cheerio";

const origin = String(process.env.AIDREAMCAPES_AUDIT_ORIGIN || "https://www.aivideosugc.com").replace(/\/$/, "");
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

const failures = [];
const report = [];

function fail(scope, message) {
  failures.push(`${scope}: ${message}`);
}

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

async function get(path, headers = {}) {
  const target = /^https?:\/\//.test(path) ? path : `${origin}${path}`;
  const response = await fetch(target, { headers: { "user-agent": "aidreamcapes-entry-audit/1.0", ...headers }, redirect: "follow" });
  return { status: response.status, html: await response.text(), url: response.url };
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

function viewSegment(view) {
  return VIEW_SEGMENTS[view];
}

/** Rebuild the cookie the browser stores on click. */
function entryCookie(entry) {
  const value = { ...entry, expires: Date.now() + 120000 };
  return encodeURIComponent(JSON.stringify(value));
}

function entryKind(entry) {
  if (entry.media || entry.scene) return "case";
  const query = entry.query || {};
  if (query.source && query.preset) return "case";
  if (query.prompt) return "case";
  if (query.actor) return "case";
  return "tool";
}

async function verifyTransfer(scope, card) {
  const { entry, href, title, image } = card;
  const kind = entryKind(entry);
  const cookie = `adc_workspace_entry_${entry.view}=${entryCookie(entry)}`;
  // The anchor href already carries the store base path in path mode.
  const landing = new URL(href, origin).href;
  const { status, html } = await get(landing, { cookie });
  if (status !== 200) {
    fail(scope, `workspace landing for "${title || href}" returned ${status}`);
    return { ok: false, kind };
  }
  const hasTemplate = html.includes('data-testid="workspace-template"');
  const checks = { kind, template: hasTemplate, title: false, image: false, prompt: false, actor: false, module: false };

  if (kind === "tool") {
    // A generic tool entry must open the module without inventing a case.
    if (hasTemplate) fail(scope, `tool entry ${href} showed a template that the card does not own`);
    const heading = entry.view === "images" ? "AI Image" : entry.view === "video" ? "AI Video" : null;
    if (heading) {
      checks.module = html.includes(heading);
      if (!checks.module) fail(scope, `tool entry ${href} did not open the ${heading} module`);
    }
    return { ok: true, kind, checks };
  }

  const prompt = entry.query?.prompt;
  const actor = entry.query?.actor;
  if (prompt) {
    checks.prompt = html.includes(escapeHtml(prompt.slice(0, 120)));
    if (!checks.prompt) fail(scope, `case prompt was not carried into the workspace (${title || href})`);
  }
  if (actor) {
    checks.actor = Boolean(title) && html.includes(escapeHtml(title));
    if (!checks.actor) fail(scope, `actor identity "${actor}" (${title}) did not reach the workspace`);
  }
  if (!prompt && !actor) {
    if (!hasTemplate) {
      fail(scope, `case entry ${href} did not resolve a template on the workspace landing`);
    } else {
      checks.template = true;
      // Only the selected-template summary is relevant here; the page also
      // ships the whole template gallery, whose category labels would
      // otherwise look like a cross-module template.
      const summary = html.slice(html.indexOf('data-testid="workspace-template"'), html.indexOf('data-testid="workspace-template"') + 2000);
      if (title) {
        checks.title = summary.includes(escapeHtml(title)) || summary.includes(escapeHtml(title.slice(0, 60)));
        if (!checks.title) fail(scope, `template title "${title}" is missing from the workspace landing (${href})`);
      }
      if (image) {
        checks.image = summary.includes(escapeHtml(image));
        if (!checks.image) fail(scope, `template preview ${image} is missing from the workspace landing (${href})`);
      }
      const expectedBadge = entry.view === "images" ? "Image template" : "Video template";
      const otherBadge = entry.view === "images" ? "Video template" : "Image template";
      if (!summary.includes(expectedBadge)) fail(scope, `case entry ${href} did not resolve a ${expectedBadge}`);
      if (summary.includes(otherBadge)) fail(scope, `case entry ${href} resolved a ${otherBadge} in the ${entry.view} module`);
    }
  }
  return { ok: true, kind, checks };
}

for (const page of pages) {
  const scope = page || "/";
  const { status, html } = await get(page);
  if (status !== 200) {
    fail(scope, `public page returned ${status}`);
    continue;
  }
  const $ = load(html);
  const cards = [];
  const plainLinks = [];
  $("a[href]").each((_, node) => {
    const anchor = $(node);
    const href = anchor.attr("href") || "";
    if (!href.includes("/app/create")) return;
    let url;
    try {
      url = new URL(href, origin);
    } catch {
      return;
    }
    const path = url.pathname.replace(/^\/site\/(?:aidreamcapes|aivideosugc)(?=\/|$)/, "");
    const entry = entryPayload(anchor);
    if (url.search) {
      const keys = [...new URLSearchParams(url.search).keys()];
      const leaked = keys.filter((key) => FORBIDDEN_QUERY_KEYS.includes(key));
      fail(scope, `workspace link ${href} carries a query string${leaked.length ? ` (${leaked.join(",")})` : ""}`);
    }
    if (entry === null) {
      fail(scope, `workspace link ${href} has an unreadable data-workspace-entry payload`);
      return;
    }
    if (!entry) {
      plainLinks.push(path);
      return;
    }
    if (!WORKSPACE_VIEWS.includes(entry.view)) {
      fail(scope, `workspace link ${href} carries an unknown view "${entry.view}"`);
      return;
    }
    if (!entry.query || typeof entry.query !== "object") {
      fail(scope, `workspace link ${href} carries no query payload`);
      return;
    }
    const expected = viewSegment(entry.view);
    if (expected && path !== `/app/create/${expected}`) {
      fail(scope, `workspace link ${href} does not match the fixed ${entry.view} path (/app/create/${expected})`);
    }
    cards.push({ href, path, entry, title: cardTitle(anchor), image: cardImage(anchor) });
  });

  const sample = limit > 0 ? cards.slice(0, limit) : cards;
  const transfers = [];
  for (const card of sample) {
    const result = await verifyTransfer(scope, card);
    transfers.push({
      href: card.href,
      view: card.entry.view,
      kind: result.kind,
      identity: card.entry.media?.slug ?? card.entry.scene ?? card.entry.query?.source ?? card.entry.query?.actor ?? card.entry.query?.prompt?.slice(0, 40) ?? card.entry.query?.tool ?? "unknown",
      title: card.title,
      checks: result.checks
    });
  }
  report.push({
    page: scope,
    status,
    cards: cards.length,
    caseCards: cards.filter((card) => entryKind(card.entry) === "case").length,
    toolCards: cards.filter((card) => entryKind(card.entry) === "tool").length,
    plainWorkspaceLinks: plainLinks.length,
    distinctPlainLinks: [...new Set(plainLinks)].sort(),
    transfers
  });
}

const summary = report.map((entry) => {
  const caseTransfers = entry.transfers.filter((transfer) => transfer.kind === "case");
  const toolTransfers = entry.transfers.filter((transfer) => transfer.kind === "tool");
  const withTitle = caseTransfers.filter((transfer) => transfer.checks.title).length;
  const withPreview = caseTransfers.filter((transfer) => transfer.checks.image).length;
  const withPrompt = caseTransfers.filter((transfer) => transfer.checks.prompt).length;
  const withActor = caseTransfers.filter((transfer) => transfer.checks.actor).length;
  const withTemplate = caseTransfers.filter((transfer) => transfer.checks.template).length;
  return {
    page: entry.page,
    cards: entry.cards,
    caseCards: entry.caseCards,
    toolCards: entry.toolCards,
    distinctPlainLinks: entry.distinctPlainLinks,
    caseTransfers: caseTransfers.length,
    caseTransfersWithTemplate: withTemplate,
    caseTransfersWithTitle: withTitle,
    caseTransfersWithPreview: withPreview,
    caseTransfersWithPrompt: withPrompt,
    caseTransfersWithActor: withActor,
    toolTransfers: toolTransfers.length,
    toolTransfersInModule: toolTransfers.filter((transfer) => transfer.checks.module).length
  };
});

console.log(JSON.stringify({ ok: failures.length === 0, origin, pages: summary, failures }, null, 2));
if (failures.length) process.exit(1);
