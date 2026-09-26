#!/usr/bin/env node

import assert from "node:assert/strict";
import { chromium } from "playwright";

const argument = (name, fallback) => {
  const exact = process.argv.find((value) => value.startsWith(`${name}=`));
  return exact ? exact.slice(name.length + 1).replace(/\/$/, "") : fallback;
};

const pages = [
  {
    key: "aidreamcapes-eu",
    url: argument("--capes-url", "https://aidreamcapes.eu/ai-image-generation"),
    locale: "fr",
    expectedColumns: { desktop: 4, tablet: 2, mobile: 1 }
  },
  {
    key: "aidreamshoots-eu",
    url: argument("--shoots-url", "https://aidreamshoots.eu/ai-image-generation"),
    locale: "es",
    expectedColumns: { desktop: 4, tablet: 2, mobile: 1 }
  }
];

const browser = await chromium.launch({ headless: true });
const reports = [];

function normalizedUrl(value) {
  try {
    const parsed = new URL(value);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return value.split(/[?#]/, 1)[0];
  }
}

function assertRowsAligned(records, label) {
  const rows = new Map();
  for (const record of records) {
    const row = Math.round(record.top);
    const current = rows.get(row) ?? [];
    current.push(record);
    rows.set(row, current);
  }
  for (const [row, current] of rows) {
    if (current.length < 2) continue;
    const cardHeights = current.map((record) => record.cardHeight);
    const mediaHeights = current.map((record) => record.mediaHeight);
    assert(Math.max(...cardHeights) - Math.min(...cardHeights) <= 2, `${label}: row ${row} card heights are not aligned`);
    assert(Math.max(...mediaHeights) - Math.min(...mediaHeights) <= 2, `${label}: row ${row} media heights are not aligned`);
  }
}

async function checkPage(page, target) {
  const imageFailures = [];
  page.on("requestfailed", (request) => {
    if (/\.(?:avif|webp|jpe?g|png)(?:[?#]|$)/i.test(request.url())) imageFailures.push(request.url());
  });
  page.on("response", (response) => {
    if (/\.(?:avif|webp|jpe?g|png)(?:[?#]|$)/i.test(response.url()) && response.status() >= 400) {
      imageFailures.push(`${response.status()} ${response.url()}`);
    }
  });

  const response = await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: 120_000 });
  assert.equal(response?.status(), 200, `${target.key}: page response`);
  await page.waitForFunction(() => document.querySelectorAll("[data-package-taxonomy-card]").length > 0, { timeout: 30_000 });
  await page.evaluate(async () => {
    for (const image of document.querySelectorAll("[data-package-taxonomy-card] img")) {
      image.scrollIntoView({ block: "center", inline: "nearest" });
      await new Promise((resolve) => {
        if (image.complete) {
          resolve();
          return;
        }
        const finish = () => {
          image.removeEventListener("load", finish);
          image.removeEventListener("error", finish);
          resolve();
        };
        image.addEventListener("load", finish, { once: true });
        image.addEventListener("error", finish, { once: true });
        setTimeout(finish, 10_000);
      });
    }
  });
  await page.waitForTimeout(250);

  const report = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("[data-package-taxonomy-card]")];
    const grids = [...document.querySelectorAll("[data-package-taxonomy-grid]")];
    const readCards = () => cards.map((card) => {
      const box = card.getBoundingClientRect();
      const media = card.querySelector("[data-package-card-media]")?.getBoundingClientRect();
      const image = card.querySelector("img");
      return {
        href: card.getAttribute("data-package-card-href") || card.querySelector("a")?.getAttribute("href") || "",
        image: image?.currentSrc || image?.src || "",
        loading: image?.getAttribute("loading") || "",
        hasDimensions: Boolean(image?.getAttribute("width") && image?.getAttribute("height")),
        hasLoadedImage: Boolean(image?.complete && image?.naturalWidth > 0 && image?.naturalHeight > 0),
        hasResponsiveSources: Boolean(image?.getAttribute("srcset") && image?.closest("picture")?.querySelector("source[srcset]")),
        top: box.top,
        cardHeight: box.height,
        mediaHeight: media?.height || 0
      };
    });
    return {
      cards: readCards(),
      grids: grids.map((grid) => ({ columns: getComputedStyle(grid).gridTemplateColumns.split(" ").length })),
      directoryImageUrls: cards.flatMap((card) => [...card.querySelectorAll("img, source")].flatMap((element) => [
        element.getAttribute("src") || "",
        element.getAttribute("srcset") || ""
      ])).flatMap((value) => value.split(",").map((item) => item.trim().split(/\s+/)[0]).filter(Boolean)),
      beforeAfter: [...document.querySelectorAll("[data-before-after-item]")].map((item) => ({
        source: item.getAttribute("data-before-after-source") || "",
        result: item.getAttribute("data-before-after-result") || ""
      }))
    };
  });

  assert(report.cards.length >= 10, `${target.key}: expected the complete directory card set`);
  assert.equal(new Set(report.cards.map((card) => card.href)).size, report.cards.length, `${target.key}: duplicate directory hrefs`);
  assert.equal(new Set(report.cards.map((card) => normalizedUrl(card.image))).size, report.cards.length, `${target.key}: duplicate directory cover URLs`);
  assert(report.cards.every((card) => card.hasLoadedImage), `${target.key}: every directory image must load successfully`);
  assert(report.cards.every((card) => card.hasDimensions), `${target.key}: every directory image needs intrinsic dimensions`);
  assert(report.cards.every((card) => card.hasResponsiveSources), `${target.key}: every directory image needs AVIF/WebP responsive sources`);
  const oppositeSiteMarker = target.key === "aidreamshoots-eu" ? "/assets/sites/site_aidreamcapes" : "/assets/sites/site_aidreamshoots";
  assert(report.cards.every((card) => !card.image.includes(oppositeSiteMarker)), `${target.key}: directory image points at the other EU site`);
  if (target.key === "aidreamshoots-eu") {
    assert(
      report.cards.every((card) => !card.image.includes("/assets/sites/site_aidreamshoots/visuals/generated/pack-galleries/")),
      `${target.key}: directory must not use legacy pack-gallery covers when current generated media exists`
    );
  }
  assert.equal(report.cards[0].loading, "eager", `${target.key}: first directory image should be eager`);
  assert(report.cards.slice(1).every((card) => card.loading === "lazy"), `${target.key}: below-fold directory images should be lazy`);
  assertRowsAligned(report.cards, target.key);
  assert(report.beforeAfter.every((item) => normalizedUrl(item.source) !== normalizedUrl(item.result)), `${target.key}: before/after source and result must differ`);
  const beforeAfterMedia = report.beforeAfter.flatMap((item) => [item.source, item.result]);
  assert.equal(
    new Set(beforeAfterMedia.map(normalizedUrl)).size,
    beforeAfterMedia.length,
    `${target.key}: before/after gallery must not reuse media across cards`
  );
  const directoryImageUrls = new Set(report.directoryImageUrls.map(normalizedUrl));
  const directoryImageFailures = imageFailures.filter((failure) => {
    const match = failure.match(/https?:\/\/\S+/)?.[0] || failure;
    return directoryImageUrls.has(normalizedUrl(match));
  });
  assert.equal(directoryImageFailures.length, 0, `${target.key}: directory image request failures ${JSON.stringify(directoryImageFailures)}`);

  const viewportChecks = [
    [1440, target.expectedColumns.desktop],
    [1024, target.expectedColumns.tablet],
    [390, target.expectedColumns.mobile]
  ];
  for (const [width, expectedColumns] of viewportChecks) {
    await page.setViewportSize({ width, height: 900 });
    const columns = await page.locator("[data-package-taxonomy-grid]").first().evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
    assert.equal(columns, expectedColumns, `${target.key}: expected ${expectedColumns} columns at ${width}px, got ${columns}`);
  }

  return {
    key: target.key,
    locale: target.locale,
    cards: report.cards.length,
    grids: report.grids,
    beforeAfter: report.beforeAfter.length
  };
}

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  for (const target of pages) reports.push(await checkPage(page, target));
} finally {
  await browser.close();
}

console.log(JSON.stringify({ ok: true, reports }, null, 2));
