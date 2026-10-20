#!/usr/bin/env node
// Route gate for the flat AIVideosUGC actor pages.
//
// Contract (media detail remediation, 2026-10-21):
//   * the canonical actor address is flat: /ai-actors/<name>;
//   * the stored rows still live at /ai-actors/{men|women}/<name> and those
//     nested addresses are permanent (301) redirects to the flat address;
//   * the directory hubs /ai-actors/{men,women,scene,age-range} stay 200;
//   * the sitemap submits the 53 flat actor URLs and no nested actor URL.
//
// Everything is read from the relational LivePage rows (read-only) and the
// running server. If the server cannot be reached the script reports SKIP and
// exits 0; the database inventory is still printed.
//
// Usage:
//   node scripts/aidreamcapes-workspace/audit-actor-flat-routes.mjs
import "../load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";

const origin = String(process.env.AIDREAMCAPES_ROUTE_SMOKE_ORIGIN || "http://127.0.0.1:3003").replace(/\/$/, "");
const siteSlug = String(process.env.AIDREAMCAPES_AUDIT_SITE_SLUG || "aidreamcapes");
const pathMode = process.env.AIDREAMCAPES_AUDIT_PATH_MODE !== "0";
const base = pathMode ? `/site/${siteSlug}` : "";
const siteId = "site_aidreamcapes";
const requestTimeout = Number(process.env.AIDREAMCAPES_AUDIT_TIMEOUT || 60000);
const expectedActors = Number(process.env.AIDREAMCAPES_AUDIT_ACTORS || 53);

const HUBS = ["/ai-actors/men", "/ai-actors/women", "/ai-actors/scene", "/ai-actors/age-range"];
const RESERVED = new Set(["men", "women", "scene", "age-range", "age-range"]);
const NESTED_ACTOR_RE = /^\/ai-actors\/(men|women)\/([a-z0-9][a-z0-9-]{0,79})$/i;

const failures = [];
const skipped = [];

function fail(scope, message) {
  failures.push(`${scope}: ${message}`);
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}

function actorSlug(name) {
  return String(name || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function pathOf(value) {
  if (!value) return undefined;
  try {
    const url = new URL(value, `${origin}/`);
    let pathname = url.pathname;
    const prefix = pathname.match(/^\/site\/(?:aidreamcapes|aivideosugc)(?=\/|$)/)?.[0];
    if (prefix) pathname = pathname.slice(prefix.length) || "/";
    return `${pathname}${url.search}`;
  } catch {
    return undefined;
  }
}

/** The dev server drops idle sockets while it compiles; retry a reset once. */
async function fetchWithRetry(url, init = {}) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await fetch(url, init);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function request(path, { follow = false } = {}) {
  const response = await fetchWithRetry(`${origin}${base}${path}`, {
    redirect: follow ? "follow" : "manual",
    headers: { "user-agent": "aidreamcapes-actor-flat-route-audit/1.0" },
    signal: AbortSignal.timeout(requestTimeout)
  });
  await response.text();
  return { status: response.status, location: response.headers.get("location") || undefined, finalPath: follow ? pathOf(response.url) : undefined };
}

const prisma = new PrismaClient({ errorFormat: "minimal" });

try {
  const rows = await prisma.livePage.findMany({
    where: { siteId, slug: { startsWith: "/ai-actors/" } },
    select: { slug: true, contentJson: true }
  });

  const actors = [];
  for (const row of rows) {
    const nested = row.slug.match(NESTED_ACTOR_RE);
    if (!nested) continue;
    const sections = record(record(row.contentJson)?.sections);
    let actor;
    for (const section of Object.values(sections ?? {})) {
      const value = record(record(record(section)?.settings)?.data?.actor);
      if (value && typeof value.name === "string") {
        actor = value;
        break;
      }
    }
    if (!actor) continue; // scene / age-range detail row, not an actor
    const slug = actorSlug(actor.name);
    actors.push({ slug, name: actor.name, gender: nested[1], storedSlug: row.slug });
    if (slug !== nested[2]) fail(row.slug, `flat slug "${slug}" does not match the stored segment "${nested[2]}"`);
    if (RESERVED.has(slug)) fail(row.slug, `actor slug "${slug}" collides with a directory hub`);
  }
  actors.sort((a, b) => a.slug.localeCompare(b.slug));
  const slugs = new Set(actors.map((actor) => actor.slug));
  if (actors.length !== expectedActors) fail("/ai-actors", `expected ${expectedActors} actors, found ${actors.length}`);
  if (slugs.size !== actors.length) fail("/ai-actors", "actor flat slugs are not unique");

  let serverAvailable = true;
  const flatResults = [];
  const nestedResults = [];
  const hubResults = [];
  let sitemap = { status: 0, locs: [] };
  let sitemapActorPaths = [];

  try {
    for (const actor of actors) {
      const flat = `/ai-actors/${actor.slug}`;
      const flatResponse = await request(flat);
      flatResults.push({ path: flat, status: flatResponse.status });
      if (flatResponse.status !== 200) fail(flat, `flat actor page returned ${flatResponse.status}`);

      const nestedResponse = await request(actor.storedSlug);
      // Next's `permanentRedirect` answers 308, which is the permanent-redirect
      // status; accept either permanent code.
      const expectedLocation = `/ai-actors/${actor.slug}`;
      const actualLocation = pathOf(nestedResponse.location);
      nestedResults.push({ path: actor.storedSlug, status: nestedResponse.status, location: actualLocation });
      if (nestedResponse.status !== 301 && nestedResponse.status !== 308) fail(actor.storedSlug, `expected a permanent redirect to the flat actor page, got ${nestedResponse.status}`);
      if (actualLocation !== expectedLocation) fail(actor.storedSlug, `redirect Location is ${actualLocation ?? "missing"}, expected ${expectedLocation}`);
    }

    for (const hub of HUBS) {
      const result = await request(hub);
      hubResults.push({ path: hub, status: result.status });
      if (result.status !== 200) fail(hub, `actor directory hub returned ${result.status}`);
    }

    const sitemapResponse = await fetchWithRetry(`${origin}${base}/sitemap.xml`, {
      headers: { "user-agent": "aidreamcapes-actor-flat-route-audit/1.0" },
      signal: AbortSignal.timeout(requestTimeout)
    });
    sitemap = { status: sitemapResponse.status, locs: [] };
    const xml = await sitemapResponse.text();
    for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const path = pathOf(match[1].trim());
      if (path) sitemap.locs.push(path);
    }
    sitemapActorPaths = [...new Set(sitemap.locs.filter((path) => path.startsWith("/ai-actors")))].sort();

    const flatInSitemap = sitemapActorPaths
      .map((path) => path.match(/^\/ai-actors\/([a-z0-9][a-z0-9-]{0,79})$/i)?.[1])
      .filter((slug) => slug && !RESERVED.has(slug));
    const nestedInSitemap = sitemapActorPaths.filter((path) => NESTED_ACTOR_RE.test(path));

    if (sitemap.status !== 200) fail("/sitemap.xml", `sitemap returned ${sitemap.status}`);
    for (const path of nestedInSitemap) fail("/sitemap.xml", `nested actor URL must not be submitted (${path})`);
    if (flatInSitemap.length !== actors.length) {
      fail("/sitemap.xml", `expected ${actors.length} flat actor URLs, found ${flatInSitemap.length}`);
    }
    for (const slug of slugs) {
      if (!flatInSitemap.includes(slug)) fail("/sitemap.xml", `flat actor URL is missing from the sitemap (/ai-actors/${slug})`);
    }
    const extra = flatInSitemap.filter((slug) => !slugs.has(slug));
    for (const slug of extra) fail("/sitemap.xml", `sitemap submits an unknown actor (/ai-actors/${slug})`);

    for (const path of sitemapActorPaths) {
      const slug = path.match(/^\/ai-actors\/([a-z0-9][a-z0-9-]{0,79})$/i)?.[1];
      if (!slug || RESERVED.has(slug)) continue; // hubs and scene/age-range children keep their own gates
      const result = await request(path, { follow: true });
      if (result.status !== 200) fail(path, `sitemap actor URL returned ${result.status}`);
    }
  } catch (error) {
    serverAvailable = false;
    skipped.push({ check: "http", reason: error instanceof Error ? error.message : String(error) });
  }

  if (!serverAvailable) {
    // A server that cannot answer is a failed gate, never a pass.
    console.error(`FAIL: server unavailable at ${origin}${base}.`);
    console.error(JSON.stringify({
      ok: false,
      skipped: true,
      origin,
      database: { actors: actors.length, flatSlugs: slugs.size },
      skippedChecks: skipped,
      failures: ["server unavailable; the audit could not complete its readback"]
    }, null, 2));
    process.exitCode = 1;
  } else {
    const result = {
      ok: failures.length === 0,
      origin,
      pathMode,
      database: {
        actors: actors.length,
        expected: expectedActors,
        flatSlugs: slugs.size,
        sample: actors.slice(0, 5).map((actor) => ({ name: actor.name, flat: `/ai-actors/${actor.slug}`, stored: actor.storedSlug }))
      },
      checks: {
        flat200: flatResults.filter((entry) => entry.status === 200).length,
        nested301: nestedResults.filter((entry) => entry.status === 301 || entry.status === 308).length,
        hubs200: hubResults.filter((entry) => entry.status === 200).length,
        sitemapFlatActors: sitemapActorPaths.filter((path) => {
          const slug = path.match(/^\/ai-actors\/([a-z0-9][a-z0-9-]{0,79})$/i)?.[1];
          return slug && !RESERVED.has(slug);
        }).length,
        sitemapNestedActors: sitemapActorPaths.filter((path) => NESTED_ACTOR_RE.test(path)).length
      },
      sitemapActorPaths,
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
