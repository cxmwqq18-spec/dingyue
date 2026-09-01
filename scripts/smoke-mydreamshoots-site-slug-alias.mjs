#!/usr/bin/env node
import assert from "node:assert/strict";

const baseUrl = String(process.env.SMOKE_BASE_URL || "http://127.0.0.1:3002").replace(/\/+$/, "");
const legacyUrl = `${baseUrl}/site/mydreamshoot?alias-smoke=1`;

const redirect = await fetch(legacyUrl, {
  redirect: "manual",
  headers: { accept: "text/html" }
});
assert.equal(redirect.status, 301, `legacy slug should redirect, got ${redirect.status}`);
const location = redirect.headers.get("location");
assert.ok(location, "legacy slug redirect should include a Location header");
const redirectUrl = new URL(location, legacyUrl);
assert.equal(`${redirectUrl.pathname}${redirectUrl.search}`, "/site/mydreamshoots?alias-smoke=1");

const canonical = await fetch(`${baseUrl}/site/mydreamshoots?alias-smoke=1`, {
  headers: { accept: "text/html" }
});
const html = await canonical.text();
assert.equal(canonical.status, 200, `canonical storefront should render, got ${canonical.status}`);
assert.ok(!html.includes("Storefront runtime for mydreamshoot"), "canonical storefront must not render the legacy database error");
assert.ok(html.includes("myDreamshoots"), "canonical storefront response should contain MyDreamShoots content");

console.log(JSON.stringify({
  ok: true,
  legacyStatus: redirect.status,
  location,
  canonicalStatus: canonical.status
}, null, 2));
