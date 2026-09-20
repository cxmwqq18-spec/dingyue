#!/usr/bin/env node
import assert from "node:assert/strict";
import { chromium } from "playwright";

const url = process.env.SMOKE_URL ?? "http://127.0.0.1:3002/site/aidreamshoots/ai-video-generation/talking-photo";
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage();
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  assert.equal(response?.status(), 200, `Expected 200 from ${url}`);

  const loadingModes = await page.locator('[data-video-topic-use-case-card] img').evaluateAll((images) =>
    images.map((image) => image.getAttribute("loading")),
  );

  assert.ok(loadingModes.length >= 2, "Expected at least two video-topic use-case images");
  assert.equal(loadingModes[0], "eager", "The first use-case image should remain eager");
  assert.ok(
    loadingModes.slice(1).every((loading) => loading === "lazy"),
    `Only the first use-case image may be eager; got ${loadingModes.join(", ")}`,
  );

  console.log(JSON.stringify({ ok: true, url, useCaseImages: loadingModes.length, loadingModes }));
} finally {
  await browser.close();
}
