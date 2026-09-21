#!/usr/bin/env node

// Browser acceptance test for the local Aidreamcapes EU 12-topic scope.
import assert from "node:assert/strict";
import { chromium } from "playwright";

const argument = (name, fallback) => {
  const exact = process.argv.find((value) => value.startsWith(`${name}=`));
  return exact ? exact.slice(name.length + 1).replace(/\/$/, "") : fallback;
};
const BASE_URL = argument("--base-url", "http://127.0.0.1:3002/site/aidreamcapes-eu/ai-save-the-date");
const TOPICS = ["valentines-day", "engagement", "proposal", "save-the-date", "wedding-invitation", "wedding-ceremony", "christmas", "halloween", "thanksgiving", "new-year", "mothers-day", "fathers-day"];
const RETIRED_TOPICS = ["wedding-anniversary"];
const SUPPLIER = /\/vendor-api-gpt-image-2-4k-v1\/|\/valentines-day-4k-vendor-v1\//;

function faqNodes(value, found = []) {
  if (Array.isArray(value)) return value.forEach((item) => faqNodes(item, found)), found;
  if (!value || typeof value !== "object") return found;
  if (value["@type"] === "FAQPage") found.push(value);
  Object.values(value).forEach((item) => faqNodes(item, found));
  return found;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const reports = [];
try {
  for (const slug of TOPICS) {
    const consoleErrors = [];
    const requestFailures = [];
    const onConsole = (message) => { if (message.type() === "error") consoleErrors.push(message.text()); };
    const onRequestFailed = (request) => requestFailures.push({ url: request.url(), error: request.failure()?.errorText ?? "" });
    page.on("console", onConsole);
    page.on("requestfailed", onRequestFailed);
    const response = await page.goto(`${BASE_URL}/${slug}?browser-smoke=20260915`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.evaluate(async () => {
      for (const image of [...document.images]) {
        if (!image.getClientRects().length) continue;
        image.scrollIntoView({ block: "center", inline: "nearest" });
        await new Promise((resolve) => setTimeout(resolve, 180));
      }
    });
    await page.waitForFunction(
      () => [...document.images].filter((image) => image.getClientRects().length).every((image) => image.complete),
      { timeout: 15_000 }
    ).catch(() => {});
    await page.waitForTimeout(300);
    const data = await page.evaluate(() => ({
      title: document.title,
      h1: document.querySelectorAll("h1").length,
      lang: document.documentElement.lang,
      canonical: document.querySelector('link[rel="canonical"]')?.href ?? "",
      description: document.querySelector('meta[name="description"]')?.content ?? "",
      robots: document.querySelector('meta[name="robots"]')?.content ?? "",
      ogType: document.querySelector('meta[property="og:type"]')?.content ?? "",
      ogImage: document.querySelector('meta[property="og:image"]')?.content ?? "",
      twitterImage: document.querySelector('meta[name="twitter:image"]')?.content ?? "",
      images: [...document.images].map((image) => ({
        src: image.currentSrc || image.src,
        previewSrc: image.getAttribute("data-dreamshoot-preview-src") || "",
        alt: image.alt,
        width: image.naturalWidth,
        height: image.naturalHeight,
        responsive: Boolean(image.closest("picture")?.querySelector("source[srcset]"))
      })),
      sectionImageReports: [...document.querySelectorAll("main section[id]")].map((section) => {
        const images = [...section.querySelectorAll("article img")].map((image) => (image.currentSrc || image.src).split("?")[0].split("#")[0]);
        return { id: section.id, count: images.length, unique: new Set(images).size, images };
      }).filter((report) => report.count > 1),
      faq: [...document.querySelectorAll("[data-faq-answer]")].map((answer) => ({ answer: answer.textContent?.trim() ?? "", question: answer.previousElementSibling?.querySelector("h3")?.textContent?.trim() ?? "" })),
      schemas: [...document.querySelectorAll('script[type="application/ld+json"]')].map((script) => script.textContent ?? ""),
      mainText: document.querySelector("main")?.textContent ?? document.body.textContent ?? ""
    }));
    const supplierImage = (image) => SUPPLIER.test(image.previewSrc || image.src);
    const imageFailures = requestFailures.filter((item) => /\.(?:jpe?g|png|webp|avif)(?:\?|$)/i.test(item.url));
    const fatalFailures = requestFailures.filter((item) => !item.error.includes("ERR_ABORTED") && !/\.mp4(?:\?|$)/i.test(item.url));
    const jpegImages = data.images.filter((image) => /\.jpe?g(?:\?|$)/i.test(image.src));
    assert.equal(response?.status(), 200, `${slug}: HTTP status`);
    assert.equal(data.h1, 1, `${slug}: one H1`);
    assert.equal(data.lang, "fr", `${slug}: lang`);
    assert.equal(data.canonical, `https://aidreamcapes.eu/ai-save-the-date/${slug}`, `${slug}: canonical`);
    assert.match(data.robots, /^index, follow.*max-image-preview:large/i, `${slug}: robots`);
    assert.equal(data.ogType, "website", `${slug}: og:type`);
    assert(data.ogImage.includes("vendor-api-gpt-image-2-4k-v1") || data.ogImage.includes("valentines-day-4k-vendor-v1"), `${slug}: OG image is not supplier hero`);
    assert(data.twitterImage.includes("vendor-api-gpt-image-2-4k-v1") || data.twitterImage.includes("valentines-day-4k-vendor-v1"), `${slug}: Twitter image is not supplier hero`);
    assert.equal(jpegImages.filter((image) => !supplierImage(image)).length, 0, `${slug}: legacy JPEG in rendered page`);
    const supplierImages = data.images.filter(supplierImage);
    assert(supplierImages.length > 0, `${slug}: supplier preview images missing`);
    assert.equal(supplierImages.filter((image) => !image.previewSrc || /\/_responsive\//i.test(image.previewSrc)).length, 0, `${slug}: preview attribute must retain the original supplier image`);
    assert(supplierImages.some((image) => image.responsive && /\/_responsive\//i.test(image.src)), `${slug}: supplier images did not select a responsive variant`);
    assert.equal(supplierImages.filter((image) => image.width > 3840 || image.height > 2160).length, 0, `${slug}: responsive image upscaled beyond source`);
    assert.equal(data.images.filter((image) => !image.alt.trim()).length, 0, `${slug}: empty image alt`);
    assert.equal(imageFailures.length, 0, `${slug}: image request failures`);
    assert.equal(fatalFailures.length, 0, `${slug}: fatal request failures`);
    assert.equal(consoleErrors.length, 0, `${slug}: console errors ${JSON.stringify(consoleErrors.slice(0, 2))}`);
    assert.equal(data.sectionImageReports.filter((report) => report.unique !== report.count).length, 0, `${slug}: duplicate image in editorial card section`);
    assert(!/\b(?:undefined|null|Frequently Asked Questions|Create a|with AI|from photos|and | or )\b/i.test(data.mainText), `${slug}: English or undefined copy leaked into main content`);
    const schemas = data.schemas.flatMap((raw) => { try { return faqNodes(JSON.parse(raw)); } catch { return []; } });
    const faqSchema = schemas.find((schema) => schema.inLanguage === "fr-FR");
    assert(faqSchema, `${slug}: French FAQ schema`);
    const schemaFaq = (faqSchema.mainEntity ?? []).map((item) => ({ question: item.name?.trim() ?? "", answer: item.acceptedAnswer?.text?.trim() ?? "" }));
    assert.deepEqual(schemaFaq, data.faq, `${slug}: visible FAQ and JSON-LD FAQ differ`);
    reports.push({ slug, status: response.status(), images: data.images.length, supplierImages: supplierImages.length, responsiveImages: data.images.filter((image) => image.responsive).length, faqItems: data.faq.length, canonical: data.canonical });
    page.off("console", onConsole);
    page.off("requestfailed", onRequestFailed);
  }
  for (const slug of RETIRED_TOPICS) {
    const response = await page.goto(`${BASE_URL}/${slug}?browser-smoke=20260915`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const retired = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      robots: document.querySelector('meta[name="robots"]')?.content ?? "",
      canonical: document.querySelector('link[rel="canonical"]')?.href ?? "",
      images: [...document.images].map((image) => image.currentSrc || image.src),
      cardImages: [...document.querySelectorAll("main section[id] article img")].length
    }));
    assert.equal(response?.status(), 200, `${slug}: HTTP status`);
    assert.equal(retired.lang, "fr", `${slug}: lang`);
    assert.match(retired.robots, /^noindex, nofollow/i, `${slug}: retired route robots`);
    assert.equal(retired.canonical, `https://aidreamcapes.eu/ai-save-the-date/${slug}`, `${slug}: canonical`);
    assert.equal(retired.images.filter((src) => SUPPLIER.test(src)).length, 0, `${slug}: retired route should not render supplier images`);
    assert.equal(retired.cardImages, 0, `${slug}: retired route should not render card images`);
    reports.push({ slug, status: response.status(), retired: true, images: retired.images.length, cardImages: retired.cardImages, canonical: retired.canonical });
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify({ ok: true, baseUrl: BASE_URL, pages: reports, mode: "headless-browser" }, null, 2));
