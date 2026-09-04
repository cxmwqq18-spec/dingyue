#!/usr/bin/env node
import assert from "node:assert/strict";
import { MYDREAMSHOOTS_REASSESSMENT_P0_COPY, MYDREAMSHOOTS_REASSESSMENT_P1, MYDREAMSHOOTS_REASSESSMENT_VIDEO_PATHS } from "./lib/mydreamshoots-seo-reassessment.mjs";

const baseUrl = (process.env.SMOKE_BASE_URL || "http://127.0.0.1:3002").replace(/\/$/, "");
const publicOrigin = process.env.SMOKE_PUBLIC_ORIGIN || "https://www.mydreamshoots.com";
const host = new URL(publicOrigin).host;
const headers = { host, "x-forwarded-host": host, connection: "close" };
const requestedVideoPaths = String(process.env.MYDREAMSHOOTS_REASSESSMENT_VIDEO_PATHS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const videoPaths = requestedVideoPaths.length ? requestedVideoPaths : MYDREAMSHOOTS_REASSESSMENT_VIDEO_PATHS;
for (const path of videoPaths) assert(MYDREAMSHOOTS_REASSESSMENT_VIDEO_PATHS.includes(path), `unknown reassessment video path: ${path}`);

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

function visibleFaqItems(html) {
  return html.split(/<\/details>/i)
    .map((chunk) => chunk.slice(chunk.lastIndexOf("<details")))
    .map((chunk) => chunk.match(/<summary[\s\S]*?<(?:span|h3)[^>]*>([\s\S]*?)<\/(?:span|h3)>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i))
    .filter(Boolean)
    .map((match) => [match[1], match[2]])
    .map(([question, answer]) => [question.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(), answer.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()]);
}

function metaValue(html, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']*)["']`, "i"))?.[1] || "";
}

function assertOfferCatalogRelations(nodes, label) {
  const visit = (value, path = label) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    if (!value || typeof value !== "object") return;
    if ("offers" in value) {
      const offers = value.offers;
      assert.notEqual(offers?.["@type"], "OfferCatalog", `${path}.offers must not contain an OfferCatalog`);
      assert.notEqual(offers?.["@id"], `${label}#offers`, `${path}.offers must not point to the OfferCatalog node`);
    }
    Object.entries(value).forEach(([key, child]) => visit(child, `${path}.${key}`));
  };
  visit(nodes);
}

async function fetchHtml(path) {
  let lastError;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}${path}`, { headers });
      return { status: response.status, html: await response.text() };
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
    }
  }
  throw lastError;
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
for (const path of new Set(MYDREAMSHOOTS_REASSESSMENT_P0_COPY.map((item) => item.path))) {
  const { html } = await fetchHtml(path);
  const expected = MYDREAMSHOOTS_REASSESSMENT_P0_COPY.filter((item) => item.path === path).map((item) => [item.question, item.newText]);
  const visible = visibleFaqItems(html).filter(([question]) => expected.some(([expectedQuestion]) => expectedQuestion === question));
  const faq = graphNodes(html).find((node) => node?.["@type"] === "FAQPage");
  const jsonLd = (faq?.mainEntity ?? [])
    .filter((question) => expected.some(([expectedQuestion]) => expectedQuestion === question?.name))
    .map((question) => [question.name, question.acceptedAnswer?.text]);
  assert.deepEqual(visible, expected, `${path} visible audited FAQ order/value must match the registry`);
  assert.deepEqual(jsonLd, expected, `${path} JSON-LD audited FAQ order/value must match the registry`);
}

const [home, pricing, terms, statePrivacy, childrenPrivacy, youtube] = await Promise.all([
  fetchHtml("/"), fetchHtml("/pricing"), fetchHtml("/terms"), fetchHtml("/state-privacy"), fetchHtml("/children-privacy"), fetchHtml("/ai-video-generation/youtube-video")
]);
for (const [path, result] of [["/", home], ["/pricing", pricing], ["/terms", terms], ["/state-privacy", statePrivacy], ["/children-privacy", childrenPrivacy], ["/ai-video-generation/youtube-video", youtube]]) assert.equal(result.status, 200, `${path} must render with HTTP 200`);

const homeNodes = graphNodes(home.html);
const homeOrganization = homeNodes.find((node) => node?.["@type"] === "Organization");
const homeApplication = homeNodes.find((node) => node?.["@type"] === "SoftwareApplication");
assert.equal(homeOrganization?.hasOfferCatalog?.["@id"], "https://www.mydreamshoots.com/#plans", "homepage Organization must point to #plans");
assert.equal(homeApplication?.offers, undefined, "homepage SoftwareApplication must not own OfferCatalog through offers");
assertOfferCatalogRelations(homeNodes, "homepage JSON-LD");

const pricingNodes = graphNodes(pricing.html);
const pricingService = pricingNodes.find((node) => node?.["@type"] === "Service");
const pricingApplication = pricingNodes.find((node) => node?.["@type"] === "SoftwareApplication");
const pricingCatalog = pricingNodes.find((node) => node?.["@type"] === "OfferCatalog");
assert.equal(pricingService?.hasOfferCatalog?.["@id"], "https://www.mydreamshoots.com/pricing#offers", "pricing Service must point to #offers");
assert.equal(pricingService?.offers, undefined, "pricing Service must not use offers for OfferCatalog");
assert.equal(pricingApplication?.offers, undefined, "pricing SoftwareApplication must not use offers for OfferCatalog");
assert.equal(pricingCatalog?.itemListElement?.length, 9, "pricing OfferCatalog must retain all nine offers");
assertOfferCatalogRelations(pricingNodes, "pricing JSON-LD");
assert.equal(headingText(pricing.html, 1).includes(MYDREAMSHOOTS_REASSESSMENT_P1.pricingH1), true, "Pricing H1 must be exact");

const videoResults = await Promise.all(videoPaths.map(async (path) => ({ path, ...(await fetchHtml(path)) })));
for (const { path, status, html } of videoResults) {
  assert.equal(status, 200, `${path} must render with HTTP 200`);
  const nodes = graphNodes(html);
  assert.equal(nodes.find((node) => node?.["@type"] === "SoftwareApplication")?.offers?.category, "AI video tool", `${path} must identify its SoftwareApplication as an AI video tool`);
  assert.equal(nodes.find((node) => node?.["@type"] === "Service")?.serviceType, "AI video generation service", `${path} must identify its Service as AI video generation`);
}

assert.equal(terms.html.match(/<title>([\s\S]*?)<\/title>/i)?.[1], MYDREAMSHOOTS_REASSESSMENT_P1.termsTitle, "Terms title must be exact");
assert.equal(metaValue(terms.html, "og:title"), MYDREAMSHOOTS_REASSESSMENT_P1.termsTitle, "Terms og:title must be exact");
assert.equal(metaValue(terms.html, "twitter:title"), MYDREAMSHOOTS_REASSESSMENT_P1.termsTitle, "Terms twitter:title must be exact");
const termsWebPage = graphNodes(terms.html).find((node) => node?.["@type"] === "WebPage");
assert.equal(termsWebPage?.name, MYDREAMSHOOTS_REASSESSMENT_P1.termsTitle, "Terms WebPage.name must be exact");
const termsBreadcrumb = graphNodes(terms.html).find((node) => node?.["@type"] === "BreadcrumbList");
assert.equal(termsBreadcrumb?.itemListElement?.at(-1)?.name, MYDREAMSHOOTS_REASSESSMENT_P1.termsTitle, "Terms breadcrumb must be exact");
assert.equal(headingText(statePrivacy.html, 1).includes(MYDREAMSHOOTS_REASSESSMENT_P1.statePrivacyH1), true, "State Privacy H1 must identify California and other U.S. residents");
assert.equal(headingText(statePrivacy.html, 2).includes(MYDREAMSHOOTS_REASSESSMENT_P1.statePrivacyH2), true, "State Privacy H2 must use the concise notice label");
assert.equal(statePrivacy.html.match(/<title>([\s\S]*?)<\/title>/i)?.[1], MYDREAMSHOOTS_REASSESSMENT_P1.statePrivacyTitle, "State Privacy title must be exact");
assert.equal(metaValue(statePrivacy.html, "description"), MYDREAMSHOOTS_REASSESSMENT_P1.statePrivacyDescription, "State Privacy description must be exact");
assert.equal(graphNodes(statePrivacy.html).find((node) => node?.["@type"] === "WebPage")?.name, MYDREAMSHOOTS_REASSESSMENT_P1.statePrivacyTitle, "State Privacy WebPage.name must be exact");
assert.equal(statePrivacy.html.includes("DPDPA"), false, "MyDreamShoots State Privacy page must not expose DPDPA naming");
assert.equal(childrenPrivacy.html.includes(MYDREAMSHOOTS_REASSESSMENT_P1.childrenPrivacyH3), true, "Children's Privacy must use State privacy requests wording");
assert.equal(home.html.includes("State Privacy"), true, "MyDreamShoots footer must label the State Privacy route");
assert.equal(headingText(youtube.html, 1)[0], MYDREAMSHOOTS_REASSESSMENT_P1.youtubeH1, "YouTube Video H1 must be exact");
assert.equal(graphNodes(youtube.html).find((node) => node?.["@type"] === "Service")?.name, MYDREAMSHOOTS_REASSESSMENT_P1.youtubeH1, "YouTube Service.name must be exact");
assert.equal(graphNodes(youtube.html).find((node) => node?.["@type"] === "BreadcrumbList")?.itemListElement?.at(-1)?.name, MYDREAMSHOOTS_REASSESSMENT_P1.youtubeH1, "YouTube breadcrumb must be exact");

for (const [path, result] of [["/", home], ["/pricing", pricing], ["/state-privacy", statePrivacy], ["/terms", terms], ["/ai-video-generation/youtube-video", youtube]]) {
  assert.equal(result.html.includes("/cdn-cgi/l/email-protection"), false, `${path} must not expose Cloudflare email-protection links`);
  assert.equal(result.html.includes("__cf_email__"), false, `${path} must not expose Cloudflare email-protection markers`);
}

console.log(JSON.stringify({ ok: true, baseUrl, checkedP0Answers: MYDREAMSHOOTS_REASSESSMENT_P0_COPY.length, checkedVideoPages: videoResults.length, checkedP1Routes: 6 }, null, 2));
