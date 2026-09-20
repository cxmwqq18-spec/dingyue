#!/usr/bin/env node
import assert from "node:assert/strict";
import { chromium } from "playwright";

const url = process.env.SMOKE_URL ?? "http://127.0.0.1:3002/site/aidreamshoots/ai-video-generation/talking-photo";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(String(error)));

  const response = await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
  assert.equal(response?.status(), 200, `Expected 200 from ${url}`);

  const questions = await page.locator('[data-video-topic-section="faq"] summary').allTextContents();
  assert.ok(questions.length > 0, "Expected the talking-photo FAQ section to render");
  assert.equal(new Set(questions.map((question) => question.trim())).size, questions.length, "FAQ questions must be unique");
  assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(" | ")}`);
  assert.deepEqual(consoleErrors, [], `Unexpected browser console errors: ${consoleErrors.join(" | ")}`);

  console.log(JSON.stringify({ ok: true, url, faqCount: questions.length }));
} finally {
  await browser.close();
}
