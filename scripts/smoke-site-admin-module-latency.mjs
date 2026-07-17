import { chromium } from "playwright";

const baseUrl = process.env.SITE_ADMIN_BASE_URL ?? process.env.SMOKE_BASE_URL ?? "http://localhost:3002";
const siteSlug = process.env.SITE_ADMIN_SITE_SLUG ?? "mydreamshoots";
const username = process.env.SITE_ADMIN_USER ?? "owner@mydreamshoots.localhost";
const password = process.env.SITE_ADMIN_PASSWORD ?? "mydreamshoots123";
const warnMs = Number(process.env.SITE_ADMIN_MODULE_WARN_MS ?? 2500);

const modules = [
  { path: `/site/${siteSlug}/admin`, h1: "概览工作台" },
  { path: `/site/${siteSlug}/admin/design`, h1: "店铺装修" },
  { path: `/site/${siteSlug}/admin/content`, h1: "内容运营" },
  { path: `/site/${siteSlug}/admin/products`, h1: "商品中心" },
  { path: `/site/${siteSlug}/admin/orders`, h1: "订单与订阅" },
  { path: `/site/${siteSlug}/admin/customers`, h1: "顾客管理" },
  { path: `/site/${siteSlug}/admin/ai-tools`, h1: "AI 工具" },
  { path: `/site/${siteSlug}/admin/email`, h1: "邮件管理" },
  { path: `/site/${siteSlug}/admin/settings`, h1: "设置收款" }
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
  await page.goto(`${baseUrl}/site/${siteSlug}/admin/login`, { waitUntil: "networkidle" });
  const inputs = page.locator("input");
  await inputs.nth(0).fill(username);
  await inputs.nth(1).fill(password);
  await page.getByRole("button", { name: /进入站点后台|登录|Sign/i }).click();
  await page.waitForURL((url) => url.pathname.includes(`/site/${siteSlug}/admin`) && !url.pathname.endsWith("/login"), { timeout: 15000 });

  for (const item of modules) {
    const startedAt = Date.now();
    const response = await page.goto(`${baseUrl}${item.path}`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForSelector("h1", { timeout: 15000 });
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => undefined);
    const elapsedMs = Date.now() - startedAt;
    const actualH1 = (await page.locator("h1").first().innerText()).trim();
    const bodyText = await page.locator("body").innerText();
    const ok = response?.ok() && actualH1 === item.h1 && !bodyText.includes("页面已响应") && !bodyText.includes("正在切换模块");
    results.push({
      path: item.path,
      h1: actualH1,
      status: response?.status(),
      elapsedMs,
      warning: elapsedMs > warnMs ? `>${warnMs}ms` : undefined,
      ok
    });
    if (!ok) {
      fail("Site admin module latency smoke failed", { expected: item, actualH1, status: response?.status() });
      break;
    }
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
