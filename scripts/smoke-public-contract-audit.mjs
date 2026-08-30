#!/usr/bin/env node

import assert from "node:assert/strict";
import { evaluatePage, parseSitemap } from "./audit-mydreamshoots-public-contract.mjs";

const origin = "https://www.mydreamshoots.com";
const sitemap = parseSitemap(`
  <urlset>
    <url><loc>${origin}/</loc><image:image><image:loc>${origin}/hero.webp</image:loc></image:image></url>
    <url><loc>${origin}/ai-image-generation/avatar</loc></url>
  </urlset>
`, origin);
assert.equal(sitemap.normalizedUrls.length, 2);
assert.deepEqual(sitemap.issues, []);

const goodHtml = `<!doctype html><html lang="en"><head>
  <title>Avatar Photos | MyDreamShoots</title>
  <meta name="description" content="Create avatar photos for your profile.">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${origin}/ai-image-generation/avatar">
  <meta property="og:title" content="Avatar Photos | MyDreamShoots">
  <meta property="og:description" content="Create avatar photos for your profile.">
  <meta property="og:url" content="${origin}/ai-image-generation/avatar">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Avatar Photos | MyDreamShoots">
  <meta name="twitter:description" content="Create avatar photos for your profile.">
</head><body><main><h1>Avatar Photos</h1><p>Create avatar photos for your profile.</p></main>
<script src="/_next/static/chunks/app.js"></script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"position":1,"item":"${origin}/ai-image-generation/avatar"}]}</script></body></html>`;
const good = evaluatePage({
  requestedUrl: `${origin}/ai-image-generation/avatar`,
  status: 200,
  finalUrl: `${origin}/ai-image-generation/avatar`,
  html: goodHtml
});
assert.equal(good.state, "INDEXABLE");
assert.deepEqual(good.failures, []);
assert.equal(good.seoSummary.pageType, "theme-detail");
assert.equal(good.seoSummary.allowedIndexState, "INDEXABLE");

const graphSchema = evaluatePage({
  requestedUrl: `${origin}/ai-image-generation/avatar`,
  status: 200,
  finalUrl: `${origin}/ai-image-generation/avatar`,
  html: goodHtml.replace(
    /\{"@context":"https:\/\/schema\.org","@type":"BreadcrumbList","itemListElement":\[\{"position":1,"item":"([^"]+)"\}\]\}/,
    '{"@context":"https://schema.org","@graph":[{"@type":"BreadcrumbList","itemListElement":[{"position":1,"item":"$1"}]}]}'
  )
});
assert.equal(graphSchema.state, "INDEXABLE");
assert.deepEqual(graphSchema.jsonLdTypes, ["BreadcrumbList"]);

const leaked = evaluatePage({
  requestedUrl: origin,
  status: 200,
  finalUrl: origin,
  html: goodHtml.replace("</head>", '<meta name="release-commit" content="deadbeef"></head>')
});
assert.equal(leaked.state, "REVIEW_REQUIRED");
assert.ok(leaked.failures.includes("internal_information_leak"));

const missingSchema = evaluatePage({
  requestedUrl: `${origin}/pricing`,
  status: 200,
  finalUrl: `${origin}/pricing`,
  html: goodHtml
    .replaceAll(`${origin}/ai-image-generation/avatar`, `${origin}/pricing`)
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, "")
});
assert.equal(missingSchema.state, "REVIEW_REQUIRED");
assert.ok(missingSchema.failures.includes("missing_json_ld"));

console.log(JSON.stringify({ ok: true, contract: "public-contract-audit", states: [good.state, graphSchema.state, leaked.state, missingSchema.state] }, null, 2));
