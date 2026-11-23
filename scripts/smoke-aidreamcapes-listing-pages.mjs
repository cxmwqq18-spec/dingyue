#!/usr/bin/env node
// Release gate for the AIVideosUGC listing pagination contract.
//
// Listing pagination is a finite, path-owned identity:
//   - /templates/page2..last 200, canonical self, index/follow
//   - /templates/photo|video the kind catalogs, 200 and self canonical
//   - ?page=2 / ?kind=photo  308 to the path form (single hop)
//   - page 1, 0, negative, or an unparseable value
//                            308 to the base listing (filters kept)
//   - a page past the last   308 to the last real /pageN
//   - sitemap.xml lists only the path form, never ?page=
// A redirect target must answer 200 within one hop; no chains and no 404.
//
//   AIDREAMCAPES_AUDIT_ORIGIN=https://www.aivideosugc.com \
//     node scripts/smoke-aidreamcapes-listing-pages.mjs
import assert from "node:assert/strict";

const origin = String(process.env.AIDREAMCAPES_AUDIT_ORIGIN || "http://127.0.0.1:3113").replace(/\/$/, "");
const hostHeader = String(process.env.AIDREAMCAPES_AUDIT_HOST || "").trim();
const requestTimeout = Number(process.env.AIDREAMCAPES_AUDIT_TIMEOUT || 45000);
const report = { ok: true, origin, checks: [], errors: [], writes: false };

async function get(path) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const headers = { "user-agent": "AIVideosUGC release gate" };
      if (hostHeader) {
        headers["x-forwarded-host"] = hostHeader;
        headers["x-forwarded-proto"] = "https";
      }
      const response = await fetch(`${origin}${path}`, { headers, redirect: "manual", signal: AbortSignal.timeout(requestTimeout) });
      return { status: response.status, location: response.headers.get("location") ?? "", headers: response.headers, body: await response.text() };
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
  throw lastError;
}

async function check(name, run) {
  try {
    await run();
    report.checks.push(name);
  } catch (error) {
    report.ok = false;
    report.errors.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function canonical(body) {
  return (body.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i)?.[1] ?? "").replaceAll("&amp;", "&");
}

/** Canonical identity without the host, so the gate also runs on loopback. */
function canonicalPath(body) {
  const value = canonical(body);
  if (!value) return "";
  try {
    const parsed = new URL(value, origin);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return value;
  }
}

function robots(body) {
  return body.match(/<meta[^>]+name="robots"[^>]+content="([^"]*)"/i)?.[1] ?? "";
}

/** Expect a 308 whose target is the expected path (query included). */
async function expectRedirect(path, expectedPath) {
  const response = await get(path);
  assert.equal(response.status, 308, `expected 308, got ${response.status}`);
  const location = new URL(response.location, origin);
  assert.equal(`${location.pathname}${location.search}`, expectedPath, `redirected to ${location.pathname}${location.search}`);
  const target = await get(`${location.pathname}${location.search}`);
  assert.equal(target.status, 200, `redirect target answered ${target.status}`);
  return target;
}

/** Follow permanent redirects on the origin under test; returns the final
 * response plus the path it settled on. Bounded so a loop fails the gate. */
async function follow(path, maxHops = 3) {
  let current = path;
  const seen = new Set([path]);
  for (let hop = 0; hop <= maxHops; hop += 1) {
    const response = await get(current);
    if (response.status !== 308) return { response, path: current };
    const location = new URL(response.location, origin);
    const next = `${location.pathname}${location.search}`;
    if (seen.has(next)) throw new Error(`redirect loop at ${next}`);
    seen.add(next);
    current = next;
  }
  throw new Error(`redirect chain too long for ${path}`);
}

await check("page 1 answers 200 with a self canonical", async () => {
  const response = await get("/templates");
  assert.equal(response.status, 200);
  assert.equal(canonicalPath(response.body), "/templates");
  assert.match(robots(response.body), /index/i);
});

await check("page 2 answers 200 on its path with a self canonical", async () => {
  const response = await get("/templates/page2");
  assert.equal(response.status, 200);
  assert.equal(canonicalPath(response.body), "/templates/page2");
  assert.match(robots(response.body), /index/i);
});

await check("the legacy ?page=2 address redirects to the path", async () => {
  await expectRedirect("/templates?page=2", "/templates/page2");
});

await check("page=1 redirects to the base listing", async () => {
  await expectRedirect("/templates?page=1", "/templates");
});

await check("a path page segment of 1 redirects to the base listing", async () => {
  await expectRedirect("/templates/page1", "/templates");
});

await check("page=0 redirects to the base listing", async () => {
  await expectRedirect("/templates?page=0", "/templates");
});

await check("a negative page redirects to the base listing", async () => {
  await expectRedirect("/templates?page=-4", "/templates");
});

await check("an unparseable page redirects to the base listing", async () => {
  await expectRedirect("/templates?page=abc", "/templates");
});

await check("a fractional page redirects to the base listing", async () => {
  await expectRedirect("/templates?page=1.5", "/templates");
});

await check("page=1 keeps the kind filter", async () => {
  await expectRedirect("/templates?kind=video&page=1", "/templates/video");
});

await check("the legacy kind query redirects to the kind path", async () => {
  await expectRedirect("/templates?kind=video", "/templates/video");
  await expectRedirect("/templates?kind=photo", "/templates/photo");
  await expectRedirect("/templates?kind=photo&page=2", "/templates/photo/page2");
});

await check("a page past the last settles on the last real path", async () => {
  const { response, path } = await follow("/templates?page=999");
  assert.equal(response.status, 200, `last page answered ${response.status}`);
  const match = /^\/templates\/page(\d+)$/.exec(path);
  assert(match && Number(match[1]) >= 2, `last page resolved to ${path}`);
  assert.equal(canonicalPath(response.body), path);
});

await check("the video catalog keeps its kind path past the last page", async () => {
  const { response, path } = await follow("/templates?kind=video&page=999");
  assert.equal(response.status, 200, `last video page answered ${response.status}`);
  assert.match(path, /^\/templates\/video\/page\d+$/, `last video page resolved to ${path}`);
});

await check("tracking parameters keep the path canonical", async () => {
  await expectRedirect("/templates?page=2&utm_source=newsletter", "/templates/page2?utm_source=newsletter");
  const response = await get("/templates/page2?utm_source=newsletter");
  assert.equal(response.status, 200);
  assert.equal(canonicalPath(response.body), "/templates/page2");
});

await check("every paginated sitemap URL is indexable with a unique snippet", async () => {
  const response = await get("/sitemap.xml");
  assert.equal(response.status, 200);
  const paginated = [...response.body.matchAll(/<loc>([^<]*\/page\d+)<\/loc>/g)]
    .map((match) => match[1].replaceAll("&amp;", "&"))
    .filter((url) => /\/(?:templates|ai-video-generation|industries\/[^/?]+|platforms\/[^/?]+|occasions\/[^/?]+|tools\/[^/?]+)\/page\d+$/.test(url));
  assert(paginated.length > 0, "expected the paginated listing URLs in the sitemap");
  const seen = new Map();
  const baseDescription = new Map();
  for (const url of paginated) {
    const parsed = new URL(url, origin);
    const path = parsed.pathname;
    const page = await get(path);
    assert.equal(page.status, 200, `${path} answered ${page.status}`);
    assert.equal(canonicalPath(page.body), path, `${path} is not self canonical`);
    const robotsHeader = page.headers?.get("x-robots-tag") ?? "";
    assert(!/noindex/i.test(robots(page.body)) && !/noindex/i.test(robotsHeader), `${path} is not indexable`);
    const description = (page.body.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i)?.[1] ?? "").replaceAll("&amp;", "&");
    assert(description, `${path} has no meta description`);
    assert(description.length <= 160, `${path} description is ${description.length} characters`);
    if (seen.has(description)) throw new Error(`${path} repeats the description of ${seen.get(description)}`);
    seen.set(description, path);
    const title = page.body.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "";
    const pageNumber = /^\/page(\d+)$/.exec(path.slice(path.lastIndexOf("/")))?.[1] ?? "";
    assert(title.includes(`Page ${pageNumber}`), `${path} title lacks the page marker: ${title}`);
    const baseKey = path.replace(/\/page\d+$/, "");
    if (!baseDescription.has(baseKey)) {
      const base = await get(baseKey);
      assert.equal(base.status, 200, `${baseKey} answered ${base.status}`);
      baseDescription.set(baseKey, (base.body.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i)?.[1] ?? "").replaceAll("&amp;", "&"));
    }
    assert.notEqual(description, baseDescription.get(baseKey), `${path} repeats its page-1 description`);
  }
});

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
