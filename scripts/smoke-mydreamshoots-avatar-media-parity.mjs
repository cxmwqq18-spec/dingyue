#!/usr/bin/env node

import process from "node:process";

const origin = (process.env.SMOKE_ORIGIN || "https://www.mydreamshoots.com").replace(/\/$/, "");
const pathPrefix = (process.env.SMOKE_PATH_PREFIX || "").replace(/\/$/, "");
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 30_000);
const avatarPath = `${pathPrefix}/ai-image-generation/avatar` || "/ai-image-generation/avatar";
const catalogPath = `${pathPrefix}/ai-image-generation` || "/ai-image-generation";
const sitemapUrl = process.env.SMOKE_SITEMAP_URL || `${origin}${pathPrefix}/sitemap.xml`;
const sitemapHost = process.env.SMOKE_SITEMAP_HOST || new URL(origin).hostname;

function absolute(value) {
  return new URL(value, origin).toString();
}

function identity(value) {
  const url = new URL(value, origin);
  url.hash = "";
  url.search = "";
  return url.pathname;
}

function attr(tag, name) {
  return tag.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1] || "";
}

function imgTags(html) {
  return [...html.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0]);
}

async function fetchText(url) {
  const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
  return { response, body: await response.text() };
}

async function checkImage(url) {
  try {
    const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
    const contentType = response.headers.get("content-type") || "";
    const body = await response.arrayBuffer();
    return {
      url,
      status: response.status,
      contentType,
      bytes: body.byteLength,
      ok: response.status === 200 && /^image\//i.test(contentType) && body.byteLength > 0
    };
  } catch (error) {
    return { url, status: 0, contentType: "", bytes: 0, ok: false, error: String(error) };
  }
}

function fail(message, details = {}) {
  failures.push({ message, ...details });
}

const failures = [];
const avatar = await fetchText(absolute(avatarPath));
if (avatar.response.status !== 200) fail("Avatar page must return HTTP 200", { status: avatar.response.status });
const avatarTags = imgTags(avatar.body);
const avatarMediaTags = avatarTags.filter((tag) => /profile-cards-(?:cover|(?:0[1-9]|1[0-2]))\.webp/i.test(attr(tag, "src")));
const avatarImages = new Map(avatarMediaTags.map((tag) => {
  const url = absolute(attr(tag, "src"));
  return [identity(url), { url, alt: attr(tag, "alt").trim() }];
}));
if (!/Theme gallery examples/i.test(avatar.body)) fail("Avatar page must contain the gallery section");
if (avatarImages.size !== 13) fail("Avatar DOM must contain cover plus twelve gallery images", { count: avatarImages.size });
for (const [path, image] of avatarImages) if (!image.alt) fail("Avatar media image is missing alt", { url: image.url, path });

const sitemap = await fetchText(sitemapUrl);
if (sitemap.response.status !== 200) fail("Sitemap must return HTTP 200", { status: sitemap.response.status });
const sitemapAvatarMatch = [...sitemap.body.matchAll(/<url>([\s\S]*?)<\/url>/gi)]
  .map((match) => match[1])
  .find((block) => {
    const loc = block.match(/<loc>([^<]+)<\/loc>/i)?.[1] || "";
    return new URL(loc).hostname === sitemapHost && /\/ai-image-generation\/avatar\/?$/i.test(new URL(loc).pathname);
  });
const avatarUrlBlock = sitemapAvatarMatch || "";
const sitemapImages = new Set([...avatarUrlBlock.matchAll(/<image:loc>([^<]+)<\/image:loc>/gi)].map((match) => identity(match[1])));
if (sitemapImages.size !== 13) fail("Avatar sitemap must contain thirteen image entries", { count: sitemapImages.size });
if (avatarImages.size === 13 && sitemapImages.size === 13) {
  for (const path of avatarImages.keys()) if (!sitemapImages.has(path)) fail("Avatar image is missing from sitemap", { path });
  for (const path of sitemapImages) if (!avatarImages.has(path)) fail("Sitemap image is missing from Avatar DOM", { path });
}

const imageChecks = [];
for (const image of avatarImages.values()) imageChecks.push(await checkImage(image.url));
const catalog = await fetchText(absolute(catalogPath));
const requiredPreviewNames = ["outdoor-creator-scenes-01.webp", "outdoor-creator-scenes-02.webp", "color-correction-01.webp", "color-correction-02.webp"];
const previewUrls = new Set();
for (const tag of imgTags(catalog.body)) {
  const src = attr(tag, "src");
  if (requiredPreviewNames.some((name) => src.includes(name))) previewUrls.add(absolute(src));
}
for (const name of requiredPreviewNames) {
  const domUrl = [...previewUrls].find((url) => url.includes(name));
  if (!domUrl) {
    fail("Catalog DOM is missing required Urban/Color Correction preview", { name });
    continue;
  }
  imageChecks.push(await checkImage(domUrl));
  imageChecks.push(await checkImage(`${new URL(domUrl).origin}${new URL(domUrl).pathname}`));
}
for (const result of imageChecks) if (!result.ok) fail("Referenced media must return an image response", result);

const report = {
  ok: failures.length === 0,
  origin,
  avatar: { domImages: avatarImages.size, sitemapImages: sitemapImages.size, imageChecks: imageChecks.length },
  urbanColorCorrection: { required: requiredPreviewNames.length, found: previewUrls.size },
  failures
};
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
