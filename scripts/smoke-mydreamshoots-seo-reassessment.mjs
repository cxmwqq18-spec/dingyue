#!/usr/bin/env node
import assert from "node:assert/strict";
import { MYDREAMSHOOTS_REASSESSMENT_P0_COPY, MYDREAMSHOOTS_REASSESSMENT_P1, MYDREAMSHOOTS_REASSESSMENT_VIDEO_PATHS } from "./lib/mydreamshoots-seo-reassessment.mjs";

const baseUrl = (process.env.SMOKE_BASE_URL || "http://127.0.0.1:3002").replace(/\/$/, "");
const publicOrigin = process.env.SMOKE_PUBLIC_ORIGIN || "https://www.mydreamshoots.com";
const host = new URL(publicOrigin).host;
const headers = { host, "x-forwarded-host": host, connection: "close" };

function graphNodes(html) {
  return [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .flatMap((match) => {
      try { const parsed = JSON.parse(match[1]); return Array.isArray(parsed) ? parsed : [parsed]; } catch { return []; }
    })
    .flatMap((graph) => Array.isArray(graph?.["@graph"]) ? graph["@graph"] : [graph]);
}

function headingText(html, level) {
  return [...html.matchAll(new RegExp(`<h${level}\\b[^>]*>([\\s\\S]*?)<\\/h${level}>`, "gi"))]
    .map((match) => match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

async function fetchHtml(path) {
  const response = await fetch(`${baseUrl}${path}`, { headers });
  return { status: response.status, html: await response.text() };
}

for (const item of MYDREAMSHOOTS_REASSESSMENT_P0_COPY) {
  const { status, html } = await fetchHtml(item.path);
  assert.equal(status, 200, `${item.path} must render with HTTP 200`);
  assert.equal(html.includes(item.oldText), false, `${item.path} must not render the retired internal instruction`);
  assert.match(html, new RegExp(`<p[^>]*>${item.newText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</p>`, "i"), `${item.path} must render the approved visible answer`);
  const faq = graphNodes(html).find((node) => node?.["@type"] === "FAQPage");
  const answer = (faq?.mainEntity ?? []).find((question) => question?.name === item.question);
  assert.equal(answer?.acceptedAnswer?.text, item.newText, `${item.path} JSON-LD answer must match visible FAQ copy`);
}

const [home, pricing, terms, statePrivacy, childrenPrivacy, youtube] = await Promise.all([
  fetchHtml("/"), fetchHtml("/pricing"), fetchHtml("/terms"), fetchHtml("/state-privacy"), fetchHtml("/children-privacy"), fetchHtml("/ai-video-generation/youtube-video")
]);
for (const [path, result] of [["/", home], ["/pricing", pricing], ["/terms", terms], ["/state-privacy", statePrivacy], ["/children-privacy", childrenPrivacy], ["/ai-video-generation/youtube-video", youtube]]) assert.equal(result.status, 200, `${path} must render with HTTP 200`);

const homeNodes = graphNodes(home.html);
const homeOrganization = homeNodes.find((node) => node?.["@type"] === "Organization");
const homeApplication = homeNodes.find((node) => node?.["@type"] === "SoftwareApplication");
assert(homeOrganization?.hasOfferCatalog, "homepage Organization must expose hasOfferCatalog");
assert.equal(homeApplication?.offers, undefined, "homepage SoftwareApplication must not own OfferCatalog through offers");

const pricingNodes = graphNodes(pricing.html);
const pricingService = pricingNodes.find((node) => node?.["@type"] === "Service");
const pricingApplication = pricingNodes.find((node) => node?.["@type"] === "SoftwareApplication");
const pricingCatalog = pricingNodes.find((node) => node?.["@type"] === "OfferCatalog");
assert(pricingService?.hasOfferCatalog, "pricing Service must use hasOfferCatalog");
assert.equal(pricingService?.offers, undefined, "pricing Service must not use offers for OfferCatalog");
assert.equal(pricingApplication?.offers, undefined, "pricing SoftwareApplication must not use offers for OfferCatalog");
assert.equal(pricingCatalog?.itemListElement?.length, 9, "pricing OfferCatalog must retain all nine offers");

const videoResults = await Promise.all(MYDREAMSHOOTS_REASSESSMENT_VIDEO_PATHS.map(async (path) => ({ path, ...(await fetchHtml(path)) })));
for (const { path, status, html } of videoResults) {
  assert.equal(status, 200, `${path} must render with HTTP 200`);
  const nodes = graphNodes(html);
  assert.equal(nodes.find((node) => node?.["@type"] === "SoftwareApplication")?.offers?.category, "AI video tool", `${path} must identify its SoftwareApplication as an AI video tool`);
  assert.equal(nodes.find((node) => node?.["@type"] === "Service")?.serviceType, "AI video generation service", `${path} must identify its Service as AI video generation`);
}

assert.equal(terms.html.includes(MYDREAMSHOOTS_REASSESSMENT_P1.termsTitle), true, "Terms title must cover AI photo and video services");
assert.equal(headingText(statePrivacy.html, 1).includes(MYDREAMSHOOTS_REASSESSMENT_P1.statePrivacyH1), true, "State Privacy H1 must identify California and other U.S. residents");
assert.equal(headingText(statePrivacy.html, 2).includes(MYDREAMSHOOTS_REASSESSMENT_P1.statePrivacyH2), true, "State Privacy H2 must use the concise notice label");
assert.equal(statePrivacy.html.includes("DPDPA"), false, "MyDreamShoots State Privacy page must not expose DPDPA naming");
assert.equal(childrenPrivacy.html.includes(MYDREAMSHOOTS_REASSESSMENT_P1.childrenPrivacyH3), true, "Children's Privacy must use State privacy requests wording");
assert.equal(home.html.includes("State Privacy"), true, "MyDreamShoots footer must label the State Privacy route");
assert.equal(youtube.html.includes(MYDREAMSHOOTS_REASSESSMENT_P1.youtubeH1), true, "YouTube Video H1 must be complete");

console.log(JSON.stringify({ ok: true, baseUrl, checkedP0Answers: MYDREAMSHOOTS_REASSESSMENT_P0_COPY.length, checkedVideoPages: videoResults.length, checkedP1Routes: 6 }, null, 2));
