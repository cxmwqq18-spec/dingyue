import assert from "node:assert/strict";

const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:3002").replace(/\/$/, "");
const base = new URL(baseUrl);
const storefronts = [
  {
    host: "www.mydreamshoots.com",
    path: "/",
    title: "Professional AI Photo Generator Online - MyDreamShoots"
  },
  {
    host: "www.aidreamcapes.com",
    path: "/",
    title: "AIdreamcapes – the most advanced AI photo generator maker"
  }
];

function headContent(html) {
  const match = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
  assert.ok(match, "HTML source must contain a <head> element");
  return match[1];
}

function firstHeadTag(head) {
  return head.trimStart().match(/^<([a-z0-9:-]+)\b/i)?.[1]?.toLowerCase() ?? "";
}

function firstIndex(head, pattern) {
  const index = head.search(pattern);
  return index < 0 ? Number.POSITIVE_INFINITY : index;
}

async function checkStorefront({ host, path, title }) {
  const headers = {
    accept: "text/html,*/*",
    host,
    "x-forwarded-host": host,
    "user-agent": "storefront-head-title-order-smoke"
  };
  if (base.port) headers["x-forwarded-port"] = base.port;

  const response = await fetch(`${baseUrl}${path}`, {
    headers,
    redirect: "manual"
  });
  assert.equal(response.status, 200, `${host}${path} should return 200`);

  const html = await response.text();
  const head = headContent(html);
  const firstTag = firstHeadTag(head);
  assert.equal(firstTag, "title", `${host}${path} must keep <title> as the first effective tag after <head>`);

  const titleMatch = head.match(/^\s*<title\b[^>]*>([\s\S]*?)<\/title>/i);
  assert.ok(titleMatch, `${host}${path} must emit <title> immediately after <head>`);
  assert.equal(titleMatch[1].replace(/\s+/g, " ").trim(), title);

  const titleIndex = firstIndex(head, /<title\b/i);
  const resourceIndex = Math.min(
    firstIndex(head, /<link\b(?=[^>]*rel=["']preload["'])/i),
    firstIndex(head, /<link\b(?=[^>]*rel=["']stylesheet["'])/i),
    firstIndex(head, /<script\b/i)
  );
  assert.ok(titleIndex < resourceIndex, `${host}${path} must place <title> before preload, stylesheet, and script tags`);

  return { host, titleIndex, resourceIndex };
}

const results = [];
for (const storefront of storefronts) {
  results.push(await checkStorefront(storefront));
}

console.log(JSON.stringify({ ok: true, results }, null, 2));
