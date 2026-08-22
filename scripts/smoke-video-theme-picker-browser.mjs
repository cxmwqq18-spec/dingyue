import { chromium } from "playwright";

const base = "http://127.0.0.1:3002";
const oldPaths = [
  "/ai-video-generation/text-to-video",
  "/ai-video-generation/image-to-video",
  "/tools/image-to-video",
  "/app/create?videoMode=text-to-video",
  "/app/create?videoMode=image-to-video",
  "/site/mydreamshoots/ai-video-generation/text-to-video",
  "/site/mydreamshoots/ai-video-generation/image-to-video",
  "/site/mydreamshoots/tools/image-to-video",
  "/site/mydreamshoots/app/create?videoMode=text-to-video",
  "/site/mydreamshoots/app/create?videoMode=image-to-video"
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
async function gotoWithRetry(pathname, options = {}) {
  let lastResponse;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      lastResponse = await page.goto(`${base}${pathname}`, { waitUntil: "domcontentloaded", timeout: 30_000, ...options });
      if (lastResponse) return lastResponse;
    } catch (error) {
      if (attempt === 2) throw error;
    }
    await page.waitForTimeout(250 * (attempt + 1));
  }
  return lastResponse;
}
for (const pathname of oldPaths) {
  const response = await gotoWithRetry(pathname);
  if (!response || response.status() !== 404) throw new Error(`${pathname} returned ${response?.status() ?? "no response"}`);
}
const topicResponse = await gotoWithRetry("/site/mydreamshoots/ai-video-generation/tiktok-video", { waitUntil: "networkidle" });
if (!topicResponse || topicResponse.status() !== 200) throw new Error(`public topic returned ${topicResponse?.status() ?? "no response"}`);
const apiResponse = await page.request.get(`${base}/api/sites/site_dreamshoot/video-themes?includeCategories=1&pageSize=5000`);
const payload = await apiResponse.json();
if (apiResponse.status() !== 200 || payload.ok !== true) throw new Error("public video theme API failed");
const themes = payload.themes ?? [];
const slugs = new Set(themes.map((theme) => theme.slug));
if (slugs.has("text-to-video") || slugs.has("image-to-video")) throw new Error("legacy video theme leaked into public API");
const categorySlugs = new Set((payload.categories ?? []).map((category) => category.slug));
if (categorySlugs.has("text-to-video") || categorySlugs.has("image-to-video")) throw new Error("legacy video category leaked into public API");
if (themes.some((theme) => !theme.examples?.length)) throw new Error("public theme missing reference example");
console.log(JSON.stringify({ ok: true, oldRoutes: oldPaths.length, themes: themes.length, categories: payload.categories?.length ?? 0 }, null, 2));
await browser.close();
