import { chromium } from "playwright";

const baseUrl = process.env.SITE_ADMIN_BASE_URL ?? process.env.SMOKE_BASE_URL ?? "http://localhost:3002";
const siteSlug = process.env.SITE_ADMIN_SITE_SLUG ?? "mydreamshoots";
const username = process.env.SITE_ADMIN_USER ?? "owner@mydreamshoots.localhost";
const password = process.env.SITE_ADMIN_PASSWORD ?? "mydreamshoots123";
const sampleDelayMs = Number(process.env.SITE_ADMIN_NAV_SAMPLE_MS ?? 80);
const repeat = Math.max(1, Math.floor(Number(process.env.SITE_ADMIN_NAV_REPEAT ?? 2)));

const loginUrl = `${baseUrl}/site/${siteSlug}/admin/login`;
const startUrl = `${baseUrl}/site/${siteSlug}/admin/orders`;
const targets = [
  { label: "顾客资产", title: "顾客管理", code: "customers", url: `/site/${siteSlug}/admin/customers` },
  { label: "AI 工厂", title: "AI 工具", code: "ai", url: `/site/${siteSlug}/admin/ai-tools` },
  { label: "进程管理", title: "进程管理", code: "processes", url: `/site/${siteSlug}/admin/processes` },
  { label: "邮件管理", title: "邮件管理", code: "email", url: `/site/${siteSlug}/admin/email` },
  { label: "设置收款", title: "设置收款", code: "settings", url: `/site/${siteSlug}/admin/settings` },
  { label: "内容运营", title: "内容运营", code: "content", url: `/site/${siteSlug}/admin/content` },
  { label: "商品套餐", title: "商品中心", code: "products", url: `/site/${siteSlug}/admin/products` }
];

function fail(message, details) {
  console.error(message);
  if (details) console.error(JSON.stringify(details, null, 2));
  process.exitCode = 1;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const results = [];

try {
  await page.goto(loginUrl, { waitUntil: "networkidle" });
  const inputs = page.locator("input");
  await inputs.nth(0).fill(username);
  await inputs.nth(1).fill(password);
  await page.getByRole("button", { name: /进入站点后台|登录|Sign/i }).click();
  await page.waitForURL((url) => url.pathname.includes(`/site/${siteSlug}/admin`) && !url.pathname.endsWith("/login"), { timeout: 15000 });

  for (let round = 1; round <= repeat; round += 1) {
    for (const target of targets) {
      await page.goto(startUrl, { waitUntil: "networkidle" });
      await page.waitForSelector('aside [data-admin-layout="saas-left-module-rail"] a', { timeout: 15000 });
      const link = page.locator('aside [data-admin-layout="saas-left-module-rail"] a', { hasText: target.label }).first();
      await link.waitFor({ state: "visible" });
      const startedAt = Date.now();
      await link.click();
      await page.waitForTimeout(sampleDelayMs);

      const early = await page.evaluate(() => ({
        preview: document.querySelector("[data-admin-route-pending-preview]")?.getAttribute("data-admin-route-pending-preview") || null,
        previewText: document.querySelector("[data-admin-route-pending-preview]")?.textContent?.trim() || "",
        h1: document.querySelector("h1")?.textContent?.trim() || "",
        oldText: document.body.innerText.includes("页面已响应") || document.body.innerText.includes("正在切换模块")
      }));

      await page.waitForURL((url) => url.pathname === target.url, { timeout: 10000 });
      const finalMs = Date.now() - startedAt;
      const finalTitle = await page.locator("h1").first().innerText();
      const reachedTargetEarly = (early.h1 === target.title || early.previewText.includes(target.title)) && !early.oldText;
      const passed = reachedTargetEarly && (early.preview === target.code || early.preview === null) && finalTitle.trim() === target.title;
      results.push({ target: target.label, round, early, finalMs, passed });
      if (!passed) {
        fail(`Admin navigation instant preview failed for ${target.label}`, { expected: target, early, finalTitle });
        break;
      }
    }
    if (process.exitCode) break;
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
