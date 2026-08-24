import assert from "node:assert/strict";

const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:3002").replace(/\/$/, "");
const siteBaseUrls = {
  mydreamshoots: (process.env.STOREFRONT_HEAD_MYDREAMSHOOTS_BASE_URL || baseUrl).replace(/\/$/, ""),
  aidreamcapes: (process.env.STOREFRONT_HEAD_AIDREAMCAPES_BASE_URL || baseUrl).replace(/\/$/, "")
};
const storefronts = [
  {
    key: "mydreamshoots",
    host: "www.mydreamshoots.com",
    path: "/",
    title: "AI Video & Photo Generator | myDreamshoots"
  },
  {
    key: "aidreamcapes",
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

function decodeHtml(value) {
  return value.replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"');
}

async function checkStorefront({ key, host, path, title }) {
  const storefrontBaseUrl = siteBaseUrls[key];
  const base = new URL(storefrontBaseUrl);
  const headers = {
    accept: "text/html,*/*",
    host,
    "x-forwarded-host": host,
    "user-agent": "storefront-head-title-order-smoke"
  };
  if (base.port) headers["x-forwarded-port"] = base.port;

  const response = await fetch(`${storefrontBaseUrl}${path}`, {
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
  assert.equal(decodeHtml(titleMatch[1].replace(/\s+/g, " ").trim()), title);

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
