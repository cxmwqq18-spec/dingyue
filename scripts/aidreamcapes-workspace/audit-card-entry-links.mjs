#!/usr/bin/env node
// Release gate for public catalog cards. The SSR HTML must carry a canonical
// fixed workspace path; prompt/actor/template identity travels in the inert
// data-workspace-entry payload, never in the href.
import assert from "node:assert/strict";
import { load } from "cheerio";

const origin = String(process.env.AIDREAMCAPES_ROUTE_SMOKE_ORIGIN || "http://127.0.0.1:3013").replace(/\/$/, "");
const mediaOrigin = String(process.env.AIDREAMCAPES_ROUTE_SMOKE_MEDIA_ORIGIN || "https://www.aivideosugc.com").replace(/\/$/, "");
const headers = { "x-forwarded-host": new URL(mediaOrigin).host, "x-forwarded-proto": "https" };
const forbidden = new Set(["prompt", "actor", "size", "length", "source", "preset", "template", "tool_id", "tool", "view", "kind", "filter"]);
const failures = [];
const checks = [];

function fail(scope, message) {
  failures.push(`${scope}: ${message}`);
}

async function page(path) {
  const response = await fetch(`${origin}${path}`, { headers, redirect: "follow" });
  assert.equal(response.status, 200, `${path}: status ${response.status}`);
  const html = await response.text();
  assert.match(html, /<html[\s>]/i, `${path}: HTML document`);
  return load(html);
}

function workspacePath(href) {
  try {
    const url = new URL(href, origin);
    const pathname = url.pathname.replace(/^\/site\/(?:aidreamcapes|aivideosugc)(?=\/|$)/, "");
    return pathname.startsWith("/app/create") ? { pathname, search: url.search } : undefined;
  } catch {
    return undefined;
  }
}

function entryOf(anchor) {
  const raw = anchor.attr("data-workspace-entry");
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function auditWorkspaceAnchors($, scope) {
  let count = 0;
  $("a[href]").each((_, node) => {
    const anchor = $(node);
    const href = anchor.attr("href");
    if (!href) return;
    const target = workspacePath(href);
    if (!target) return;
    count += 1;
    if (target.search) {
      const keys = [...new URLSearchParams(target.search).keys()];
      const leaked = keys.filter((key) => forbidden.has(key));
      fail(scope, `${href} carries query ${target.search}${leaked.length ? ` (${leaked.join(",")})` : ""}`);
    }
    if (anchor.attr("data-workspace-entry")) {
      const entry = entryOf(anchor);
      if (!entry || typeof entry !== "object" || !entry.view || !entry.query) {
        fail(scope, `${href} has an invalid data-workspace-entry`);
      }
    }
  });
  return count;
}

function expectFixed(anchor, expected, scope, label) {
  const href = anchor.attr("href") || "";
  const target = workspacePath(href);
  if (!target) return fail(scope, `${label} does not target /app/create (${href})`);
  if (target.pathname !== expected) fail(scope, `${label} targets ${target.pathname}, expected ${expected}`);
  if (target.search) fail(scope, `${label} leaks a query into the URL (${target.search})`);
}

const pages = [
  { path: "/", minWorkspaceLinks: 1 },
  { path: "/ai-image-generation", kind: "image" },
  { path: "/ai-actors", kind: "actor" },
  { path: "/templates", kind: "templates" },
  { path: "/templates/photo", kind: "templates", expectedType: "photo" },
  { path: "/templates/video", kind: "templates", expectedType: "video" },
  { path: "/ai-video-generation", minWorkspaceLinks: 1 },
];

for (const spec of pages) {
  const $ = await page(spec.path);
  const workspaceCount = auditWorkspaceAnchors($, spec.path);
  if (spec.minWorkspaceLinks) {
    assert.ok(workspaceCount >= spec.minWorkspaceLinks, `${spec.path}: expected at least ${spec.minWorkspaceLinks} workspace link(s), found ${workspaceCount}`);
    checks.push(`${spec.path}: ${workspaceCount} fixed workspace link(s)`);
  }

  if (spec.kind === "image") {
    const cards = $(".case-card a.use");
    assert.ok(cards.length >= 4, `${spec.path}: expected at least 4 case cards, found ${cards.length}`);
    cards.each((_, node) => {
      const anchor = $(node);
      expectFixed(anchor, "/app/create/ai-image-generation", spec.path, "case card");
      const entry = entryOf(anchor);
      assert.equal(entry?.view, "images", `${spec.path}: case card entry view`);
      assert.ok(typeof entry?.query?.prompt === "string" && entry.query.prompt.length > 20, `${spec.path}: case card entry prompt`);
    });
    checks.push(`${spec.path}: ${cards.length} case cards carry prompts outside the URL`);
  }

  if (spec.kind === "actor") {
    const cards = $("article.actor-card a[href]");
    assert.ok(cards.length >= 53, `${spec.path}: expected at least 53 actor links, found ${cards.length}`);
    const ids = new Set();
    cards.each((_, node) => {
      const anchor = $(node);
      expectFixed(anchor, "/app/create/ai-actors", spec.path, "actor card");
      const entry = entryOf(anchor);
      assert.equal(entry?.view, "actors", `${spec.path}: actor entry view`);
      assert.match(String(entry?.query?.actor || ""), /^[a-z0-9][a-z0-9-]{0,80}$/i, `${spec.path}: actor entry id`);
      ids.add(entry.query.actor);
    });
    assert.ok(ids.size >= 53, `${spec.path}: expected at least 53 unique actor IDs, found ${ids.size}`);
    checks.push(`${spec.path}: ${cards.length} actor links / ${ids.size} unique actors`);
  }

  if (spec.kind === "templates") {
    const cards = $(".tgrid article.tc");
    assert.ok(cards.length >= 9, `${spec.path}: expected at least 9 template cards, found ${cards.length}`);
    const ids = new Set();
    cards.each((_, node) => {
      const card = $(node);
      const type = card.attr("data-type");
      if (spec.expectedType) assert.equal(type, spec.expectedType, `${spec.path}: template type`);
      const id = card.attr("data-template-id");
      if (id) ids.add(id);
      const links = card.find("a[href]");
      assert.ok(links.length >= 1, `${spec.path}: template card has no link`);
      links.each((__, link) => {
        const anchor = $(link);
        expectFixed(anchor, type === "photo" ? "/app/create/ai-image-generation" : "/app/create/ai-video-generation", spec.path, "template card");
        const entry = entryOf(anchor);
        assert.ok(entry?.query?.source && entry?.query?.preset, `${spec.path}: template card must carry source and preset outside the URL`);
      });
    });
    assert.equal(ids.size, cards.length, `${spec.path}: template IDs must be unique`);
    checks.push(`${spec.path}: ${cards.length} ${spec.expectedType || "mixed"} template cards`);
  }
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, origin, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, origin, checks }, null, 2));
