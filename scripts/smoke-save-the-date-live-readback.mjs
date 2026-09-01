#!/usr/bin/env node
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

const argument = (name, fallback) => {
  const exact = process.argv.find((item) => item.startsWith(`${name}=`));
  return exact ? exact.slice(name.length + 1) : fallback;
};
const BASE_URL = argument("--base-url", "http://127.0.0.1:3002").replace(/\/$/, "");
const HOST = argument("--host", "www.mydreamshoots.com");
const PATH_PREFIX = argument("--path-prefix", "").replace(/\/$/, "");
const DB_TARGET = argument("--db-target", process.env.DATABASE_TARGET || "local");
const SITE_ID = "site_dreamshoot";
const paths = [
  "/ai-save-the-date/valentines-day", "/ai-save-the-date/engagement", "/ai-save-the-date/proposal",
  "/ai-save-the-date/save-the-date", "/ai-save-the-date/wedding-ceremony",
  "/ai-save-the-date/christmas", "/ai-save-the-date/halloween", "/ai-save-the-date/thanksgiving",
  "/ai-save-the-date/new-year", "/ai-save-the-date/mothers-day", "/ai-save-the-date/fathers-day"
];
assertDatabaseTarget({ expectedTarget: DB_TARGET });

const decode = (value) => String(value || "")
  .replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)));
const cleanText = (value) => decode(String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
const attr = (tag, name) => decode(tag.match(new RegExp(`\\s${name}="([^"]*)"`, "i"))?.[1] || "");
const meta = (html, name) => {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  return attr(tags.find((tag) => attr(tag, "name") === name) || "", "content");
};
const link = (html, rel) => {
  const tags = html.match(/<link\b[^>]*>/gi) || [];
  return attr(tags.find((tag) => attr(tag, "rel") === rel) || "", "href");
};
const imageSource = (value) => {
  const source = String(value || "");
  if (!source.startsWith("/_next/image?")) return source;
  try {
    return new URL(source, "https://www.mydreamshoots.com").searchParams.get("url") || source;
  } catch {
    return source;
  }
};
const images = (html) => (html.match(/<img\b[^>]*>/gi) || []).map((tag) => ({ src: imageSource(attr(tag, "src")), alt: attr(tag, "alt") }));
const fetchHtml = async (url) => {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { Host: HOST, "Cache-Control": "no-cache", Connection: "close" }, redirect: "follow" });
      return { response, html: await response.text() };
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 250));
    }
  }
  throw lastError;
};

const prisma = new PrismaClient();
const rows = await prisma.themePage.findMany({
  where: { siteId: SITE_ID, slug: { in: paths } },
  select: { slug: true, draftJson: true }
});
await prisma.$disconnect();
assert.equal(rows.length, paths.length, "relational page inventory changed");
const pageByPath = new Map(rows.map((row) => [row.slug, row.draftJson]));
const reports = [];

for (const pagePath of paths) {
  const { response, html } = await fetchHtml(`${BASE_URL}${PATH_PREFIX}${pagePath}?relational-readback=${Date.now()}`);
  assert.equal(response.status, 200, `${pagePath}: HTTP status`);
  const json = pageByPath.get(pagePath);
  const imageTags = images(html);
  const title = cleanText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  const h1 = cleanText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
  const heroId = json.sectionsOrder.find((id) => json.sections[id]?.type === "editorial_hero");
  const heroTitle = String(json.sections[heroId]?.settings?.title || "").trim();

  assert.equal(title, json.seo.title, `${pagePath}: title readback`);
  assert.equal(meta(html, "description"), json.seo.description, `${pagePath}: description readback`);
  assert.equal(meta(html, "keywords"), json.seo.keywords, `${pagePath}: keywords readback`);
  assert.equal(link(html, "canonical"), json.seo.canonical, `${pagePath}: canonical readback`);
  assert.match(meta(html, "robots"), /^index, follow/, `${pagePath}: robots readback`);
  assert.equal(h1, heroTitle, `${pagePath}: H1 readback`);
  assert(!/<h3\b[^>]*>\s*<\/h3>/i.test(html), `${pagePath}: empty h3`);
  assert.doesNotMatch(cleanText(html.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ")), /\b(?:keyword ownership|search intent|query ownership|indexation|do not index|before launch|product evidence|same query|page owns|landing-page hero)\b/i, `${pagePath}: internal copy leakage`);
  for (const asset of json.mediaManifest || []) {
    assert(imageTags.some((image) => image.src.split("?")[0] === asset.src.split("?")[0] && image.alt === asset.alt), `${pagePath}: missing SSR image/alt ${asset.src}`);
  }
  reports.push({ path: pagePath, images: json.mediaManifest?.length || 0, robots: meta(html, "robots") });
}

console.log(JSON.stringify({ baseUrl: BASE_URL, host: HOST, siteId: SITE_ID, databaseTarget: DB_TARGET, source: "ThemePage.draftJson", pages: reports }, null, 2));
