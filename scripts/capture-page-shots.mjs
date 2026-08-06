import fs from "fs/promises";
import path from "path";
import { chromium } from "playwright";

const workspaceRoot = process.cwd();
const baseUrl = process.env.CAPTURE_BASE_URL ?? "http://localhost:3000";
const outDir = path.join(workspaceRoot, "tmp", "page-shots");
const designInputDir = path.join(outDir, "design-inputs");
const manifestPath = path.join(outDir, "page-manifest.json");
const capturePath = path.join(outDir, "capture-results.json");

const platformLogin = {
  email: "platform@local.test",
  password: "platform123"
};

const siteAdmins = {
  lumen: { email: "owner@lumen.localhost", password: "lumen123" },
  atlas: { email: "owner@atlas.localhost", password: "atlas123" }
};

const siteCustomers = {
  lumen: { email: "mara@northpier.studio", password: "mara123", name: "Mara Voss" }
};

function joinUrl(route) {
  return `${baseUrl}${route}`;
}

function shot(name, route, options = {}) {
  return {
    name,
    route,
    url: joinUrl(route),
    file: path.join(outDir, `${name}.png`),
    designInputFile: path.join(designInputDir, `${name}.png`),
    fullPage: options.fullPage ?? true,
    viewport: options.viewport ?? { width: 1440, height: 1080 },
    designViewport: options.designViewport ?? { width: 1440, height: 1024 },
    auth: options.auth ?? null
  };
}

function buildManifest() {
  const publicShots = [
    shot("home", "/"),
    shot("platform-login", "/platform/login", { fullPage: false }),
    shot("platform-dashboard", "/platform", { auth: { type: "platform" } }),
    shot("lumen-home", "/site/lumen"),
    shot("lumen-login", "/site/lumen/login", { fullPage: false }),
    shot("lumen-pricing", "/site/lumen/pricing"),
    shot("lumen-tool-image-studio", "/site/lumen/tools/image-studio"),
    shot("lumen-help", "/site/lumen/help"),
    shot("lumen-blog", "/site/lumen/blog"),
    shot("lumen-policy-privacy", "/site/lumen/policies/privacy"),
    shot("lumen-policy-refunds", "/site/lumen/policies/refunds"),
    shot("lumen-policy-content", "/site/lumen/policies/content"),
    shot("lumen-collections", "/site/lumen/collections"),
    shot("lumen-search", "/site/lumen/search"),
    shot("lumen-cart", "/site/lumen/cart"),
    shot("atlas-home", "/site/atlas"),
    shot("atlas-pricing", "/site/atlas/pricing"),
    shot("atlas-tool-image-studio", "/site/atlas/tools/image-studio"),
    shot("atlas-help", "/site/atlas/help"),
    shot("atlas-blog", "/site/atlas/blog"),
    shot("atlas-policy-privacy", "/site/atlas/policies/privacy"),
    shot("atlas-policy-refunds", "/site/atlas/policies/refunds"),
    shot("atlas-policy-content", "/site/atlas/policies/content"),
    shot("atlas-collections", "/site/atlas/collections"),
    shot("atlas-search", "/site/atlas/search"),
    shot("atlas-cart", "/site/atlas/cart")
  ];

  const adminShots = [
    shot("lumen-admin-login", "/site/lumen/admin/login", { fullPage: false }),
    shot("atlas-admin-login", "/site/atlas/admin/login", { fullPage: false }),
    shot("lumen-admin-dashboard", "/site/lumen/admin", { auth: { type: "site-admin", siteSlug: "lumen" } }),
    shot("lumen-admin-design", "/site/lumen/admin/design", { auth: { type: "site-admin", siteSlug: "lumen" } }),
    shot("lumen-admin-design-pages", "/site/lumen/admin/design/pages", { auth: { type: "site-admin", siteSlug: "lumen" } }),
    shot("lumen-admin-design-navigation", "/site/lumen/admin/design/navigation", { auth: { type: "site-admin", siteSlug: "lumen" } }),
    shot("lumen-admin-design-seo", "/site/lumen/admin/design/seo", { auth: { type: "site-admin", siteSlug: "lumen" } }),
    shot("lumen-admin-design-publications", "/site/lumen/admin/design/publications", { auth: { type: "site-admin", siteSlug: "lumen" } }),
    shot("lumen-admin-themes", "/site/lumen/admin/themes", { auth: { type: "site-admin", siteSlug: "lumen" } }),
    shot("lumen-admin-products", "/site/lumen/admin/products", { auth: { type: "site-admin", siteSlug: "lumen" } }),
    shot("lumen-admin-customers", "/site/lumen/admin/customers", { auth: { type: "site-admin", siteSlug: "lumen" } }),
    shot("lumen-admin-orders", "/site/lumen/admin/orders", { auth: { type: "site-admin", siteSlug: "lumen" } }),
    shot("lumen-admin-ai-tools", "/site/lumen/admin/ai-tools", { auth: { type: "site-admin", siteSlug: "lumen" } }),
    shot("lumen-admin-content", "/site/lumen/admin/content", { auth: { type: "site-admin", siteSlug: "lumen" } }),
    shot("lumen-admin-media", "/site/lumen/admin/media", { auth: { type: "site-admin", siteSlug: "lumen" } }),
    shot("lumen-admin-settings", "/site/lumen/admin/settings", { auth: { type: "site-admin", siteSlug: "lumen" } }),
    shot("atlas-admin-dashboard", "/site/atlas/admin", { auth: { type: "site-admin", siteSlug: "atlas" } }),
    shot("atlas-admin-themes", "/site/atlas/admin/themes", { auth: { type: "site-admin", siteSlug: "atlas" } }),
    shot("atlas-admin-settings", "/site/atlas/admin/settings", { auth: { type: "site-admin", siteSlug: "atlas" } })
  ];

  const appShots = [
    shot("lumen-app", "/site/lumen/app", { auth: { type: "customer", siteSlug: "lumen" } }),
    shot("lumen-app-job-detail", "/site/lumen/app/jobs/job_lumen_4817", { auth: { type: "customer", siteSlug: "lumen" }, fullPage: false }),
    shot("lumen-app-running-job", "/site/lumen/app/jobs/job_lumen_4817", { auth: { type: "customer", siteSlug: "lumen" }, fullPage: false })
  ];

  return [...publicShots, ...adminShots, ...appShots];
}

async function ensureDir() {
  await fs.mkdir(outDir, { recursive: true });
  await fs.mkdir(designInputDir, { recursive: true });
}

async function loginPlatform(page) {
  await page.goto(joinUrl("/platform/login"), { waitUntil: "networkidle" });
  await page.locator('input[name="email"]').fill(platformLogin.email);
  await page.locator('input[name="password"]').fill(platformLogin.password);
  await Promise.all([
    page.waitForURL("**/platform", { waitUntil: "networkidle" }),
    page.locator('button[type="submit"]').click()
  ]);
}

async function loginSiteAdmin(page, siteSlug) {
  const account = siteAdmins[siteSlug];
  await page.goto(joinUrl(`/site/${siteSlug}/admin/login`), { waitUntil: "networkidle" });
  await page.locator('input[name="email"]').fill(account.email);
  await page.locator('input[name="password"]').fill(account.password);
  await Promise.all([
    page.waitForURL(`**/site/${siteSlug}/admin`, { waitUntil: "networkidle" }),
    page.locator('button[type="submit"]').click()
  ]);
}

async function loginCustomer(page, siteSlug) {
  const account = siteCustomers[siteSlug];
  await page.goto(joinUrl(`/site/${siteSlug}/login`), { waitUntil: "networkidle" });
  await page.locator('input[name="email"]').fill(account.email);
  await page.locator('input[name="password"]').fill(account.password);
  const nameInput = page.locator('input[name="name"]');
  if (await nameInput.count()) {
    await nameInput.fill(account.name);
  }
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(`**/site/${siteSlug}/app`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForLoadState("networkidle");
}

async function captureShot(browser, entry) {
  const context = await browser.newContext({ viewport: entry.viewport });
  const page = await context.newPage();

  try {
    if (entry.auth?.type === "platform") {
      await loginPlatform(page);
    } else if (entry.auth?.type === "site-admin") {
      await loginSiteAdmin(page, entry.auth.siteSlug);
    } else if (entry.auth?.type === "customer") {
      await loginCustomer(page, entry.auth.siteSlug);
    }

    if (page.url() !== entry.url) {
      await page.goto(entry.url, { waitUntil: "networkidle" });
    } else {
      await page.waitForLoadState("networkidle");
    }

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({ path: entry.file, fullPage: entry.fullPage });
    await page.setViewportSize(entry.designViewport);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(150);
    await page.screenshot({ path: entry.designInputFile, fullPage: false });
    return { name: entry.name, url: entry.url, file: entry.file, designInputFile: entry.designInputFile };
  } finally {
    await context.close();
  }
}

async function main() {
  await ensureDir();
  const manifest = buildManifest();
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest.map(({ name: _name, route }) => route), null, 2)}\n`);

  const browser = await chromium.launch({ headless: true });
  try {
    const results = [];
    for (const entry of manifest) {
      const result = await captureShot(browser, entry);
      results.push(result);
      console.log(`captured ${entry.name}`);
    }
    await fs.writeFile(capturePath, `${JSON.stringify(results, null, 2)}\n`);
    console.log(`Wrote ${results.length} screenshots to ${outDir}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
