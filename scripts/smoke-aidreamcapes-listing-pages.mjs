#!/usr/bin/env node
// Release gate for the AIVideosUGC listing pagination contract.
//
// The /templates pagination is a finite, canonical parameter space:
//   - page 2..last           200, canonical self, index/follow
//   - page 1, 0, negative, or an unparseable value
//                            308 to the base listing (filters kept)
//   - page past the last     308 to the last real page (filters kept)
//   - pagination never appears in /sitemap.xml
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
      return { status: response.status, location: response.headers.get("location") ?? "", body: await response.text() };
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

await check("page 1 answers 200 with a self canonical", async () => {
  const response = await get("/templates");
  assert.equal(response.status, 200);
  assert.equal(canonical(response.body), `${origin}/templates`);
  assert.match(robots(response.body), /index/i);
});

await check("page 2 answers 200 with a self canonical", async () => {
  const response = await get("/templates?page=2");
  assert.equal(response.status, 200);
  assert.equal(canonical(response.body), `${origin}/templates?page=2`);
});

await check("page=1 redirects to the base listing", async () => {
  await expectRedirect("/templates?page=1", "/templates");
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
  await expectRedirect("/templates?kind=video&page=1", "/templates?kind=video");
});

await check("a page past the last redirects to the last real page", async () => {
  const response = await get("/templates?page=999");
  assert.equal(response.status, 308);
  const location = new URL(response.location, origin);
  assert.equal(location.pathname, "/templates");
  const page = Number(location.searchParams.get("page"));
  assert(Number.isInteger(page) && page >= 2, `last page resolved to ${location.search}`);
  const target = await get(`${location.pathname}${location.search}`);
  assert.equal(target.status, 200);
  assert.equal(canonical(target.body), `${origin}${location.pathname}${location.search}`);
});

await check("the video catalog keeps the kind filter past the last page", async () => {
  const response = await get("/templates?kind=video&page=999");
  assert.equal(response.status, 308);
  const location = new URL(response.location, origin);
  assert.equal(location.pathname, "/templates");
  assert.equal(location.searchParams.get("kind"), "video");
  assert(Number(location.searchParams.get("page")) >= 2, `last video page resolved to ${location.search}`);
  const target = await get(`${location.pathname}${location.search}`);
  assert.equal(target.status, 200);
});

await check("tracking parameters do not create a pagination variant", async () => {
  const response = await get("/templates?page=2&utm_source=newsletter");
  assert.equal(response.status, 200);
  assert.equal(canonical(response.body), `${origin}/templates?page=2`);
});

await check("every paginated sitemap URL is indexable with a unique snippet", async () => {
  const response = await get("/sitemap.xml");
  assert.equal(response.status, 200);
  const paginated = [...response.body.matchAll(/<loc>([^<]*page=[^<]+)<\/loc>/g)]
    .map((match) => match[1].replaceAll("&amp;", "&"))
    .filter((url) => /\/(?:templates|ai-video-generation|industries\/[^/?]+|platforms\/[^/?]+|occasions\/[^/?]+|tools\/[^/?]+)\?/.test(url));
  assert(paginated.length > 0, "expected the paginated listing URLs in the sitemap");
  const seen = new Map();
  const baseDescription = new Map();
  for (const url of paginated) {
    const parsed = new URL(url, origin);
    const path = `${parsed.pathname}${parsed.search}`;
    const page = await get(path);
    assert.equal(page.status, 200, `${path} answered ${page.status}`);
    assert.equal(canonical(page.body), `${origin}${path}`, `${path} is not self canonical`);
    assert.match(robots(page.body), /index/i, `${path} is not indexable`);
    const description = (page.body.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i)?.[1] ?? "").replaceAll("&amp;", "&");
    assert(description, `${path} has no meta description`);
    assert(description.length <= 160, `${path} description is ${description.length} characters`);
    if (seen.has(description)) throw new Error(`${path} repeats the description of ${seen.get(description)}`);
    seen.set(description, path);
    const title = page.body.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "";
    const pageNumber = parsed.searchParams.get("page");
    assert(title.includes(`Page ${pageNumber}`), `${path} title lacks the page marker: ${title}`);
    const baseKey = `${parsed.pathname}?${[...parsed.searchParams].filter(([key]) => key !== "page").map(([key, value]) => `${key}=${value}`).join("&")}`;
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
