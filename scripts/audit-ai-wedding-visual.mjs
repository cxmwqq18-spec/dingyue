import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = process.env.AUDIT_BASE_URL ?? "http://localhost:3000";
const outputDir = path.join(repoRoot, "output", "playwright");

const customer = {
  email: "mara@northpier.studio",
  password: "mara123",
  name: "Mara Voss"
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function screenshotPath(name) {
  return path.join(outputDir, `${name}.png`);
}

async function loginCustomer(page) {
  await page.goto(`${baseUrl}/site/lumen/login`, { waitUntil: "networkidle" });
  await page.locator('input[name="email"]').fill(customer.email);
  await page.locator('input[name="password"]').fill(customer.password);
  const nameInput = page.locator('input[name="name"]');
  if (await nameInput.count()) {
    await nameInput.fill(customer.name);
  }
  await page.locator('button[type="submit"]').click();
  await page.waitForURL("**/site/lumen/app", { waitUntil: "networkidle", timeout: 45000 });
}

async function capturePage(page, route, shotName, viewport, fullPage = true) {
  await page.setViewportSize(viewport);
  await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: screenshotPath(shotName), fullPage, timeout: 0 });
  return screenshotPath(shotName);
}

async function visibleImageCount(page) {
  return page.locator("img").evaluateAll((nodes) =>
    nodes.filter((img) => {
      const rect = img.getBoundingClientRect();
      return rect.width > 80 && rect.height > 80 && (img.getAttribute("src") || "").trim();
    }).length
  );
}

async function ensureNoDemoCopy(page, route) {
  const body = await page.locator("body").innerText();
  for (const marker of ["SaaS iframe patch", "Nothing here yet.", "Opening soon"]) {
    assert(!body.includes(marker), `${route} still contains demo marker: ${marker}`);
  }
}

async function ensureCommercialHome(page) {
  const body = await page.locator("body").innerText();
  for (const marker of [
    "AI-Powered Wedding Photos in Any Destination",
    "Tired of These Wedding Photo Problems?",
    "AI Makes It Possible.",
    "How It Works",
    "Popular Destinations",
    "Inspiring Examples",
    "Loved by Couples Worldwide",
    "Your Love Story, Anywhere."
  ]) {
    assert(body.includes(marker), `home missing commercial module copy: ${marker}`);
  }
  const imageCount = await visibleImageCount(page);
  assert(imageCount >= 12, `home should render many wedding images, got ${imageCount}`);
  const pricingCards = await page.locator('section[id="plans"] a, section[id="plans"] button').count();
  assert(pricingCards >= 3, `home pricing section should render checkout actions, got ${pricingCards}`);
}

async function ensurePricing(page) {
  const body = await page.locator("body").innerText();
  for (const marker of ["Essential", "Premium", "Deluxe", "$79", "$149", "$249", "credits"]) {
    assert(body.includes(marker), `pricing missing marker ${marker}`);
  }
  assert(await page.locator('section[id="plans"]').count(), "pricing page missing pricing section");
}

async function ensureToolPage(page) {
  const body = await page.locator("body").innerText();
  for (const marker of [
    "Wedding Story Generator",
    "Wedding photo intake",
    "Collection generator",
    "Album progress",
    "Delivered wedding album"
  ]) {
    assert(body.includes(marker), `tool page missing marker ${marker}`);
  }
  for (const heading of ["Wedding photo intake", "Collection generator", "Album progress", "Delivered wedding album"]) {
    assert(await page.getByText(heading, { exact: true }).count(), `tool page missing section heading ${heading}`);
  }
}

async function ensureLoginPage(page) {
  const body = await page.locator("body").innerText();
  assert(body.includes("Sign into your private wedding story workspace."), "login page missing title");
  const hasEntryState = body.includes("Continue with email") || body.includes("Continue with Google");
  const hasRealFormState = body.includes("进入婚礼工作台") && body.includes("Email") && body.includes("Password");
  assert(hasEntryState || hasRealFormState, "login page is missing both the quick entry state and the real customer form state");
  const imageCount = await visibleImageCount(page);
  assert(imageCount >= 1, `login page should include at least one strong image, got ${imageCount}`);
}

async function ensureWorkspacePage(page, route) {
  const body = await page.locator("body").innerText();
  if (route.endsWith("/app")) {
    for (const marker of ["WEDDING WORKSPACE", "Private wedding uploads", "Start a wedding album request"]) {
      assert(body.includes(marker), `${route} missing workspace marker ${marker}`);
    }
  }
  if (route.endsWith("/progress")) {
    assert(
      body.includes("ALBUM PROGRESS") || body.includes("Album progress"),
      `${route} missing progress marker ALBUM PROGRESS`
    );
    for (const marker of ["Current wedding generation status", "Delivered wedding images"]) {
      assert(body.includes(marker), `${route} missing progress marker ${marker}`);
    }
  }
  await ensureNoDemoCopy(page, route);
}

async function ensureAlbumPage(page) {
  const body = await page.locator("body").innerText();
  for (const marker of ["Your finished wedding images, ready in a private album.", "Wedding gallery"]) {
    assert(body.includes(marker), `album page missing marker ${marker}`);
  }
  const imageCount = await visibleImageCount(page);
  assert(imageCount >= 3, `album page should render gallery imagery, got ${imageCount}`);
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const publicContext = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    const publicPage = await publicContext.newPage();

    const captures = {};
    captures.homeDesktop = await capturePage(publicPage, "/site/lumen", "lumen-visual-home-desktop-20260607", { width: 1440, height: 1100 });
    await ensureCommercialHome(publicPage);
    await ensureNoDemoCopy(publicPage, "/site/lumen");

    captures.homeMobile = await capturePage(publicPage, "/site/lumen", "lumen-visual-home-mobile-20260607", { width: 430, height: 932 }, false);

    captures.pricing = await capturePage(publicPage, "/site/lumen/pricing", "lumen-visual-pricing-20260607", { width: 1440, height: 1200 });
    await ensurePricing(publicPage);
    await ensureNoDemoCopy(publicPage, "/site/lumen/pricing");

    captures.tool = await capturePage(publicPage, "/site/lumen/tools/image-studio", "lumen-visual-tool-20260607", { width: 1440, height: 1200 });
    await ensureToolPage(publicPage);
    await ensureNoDemoCopy(publicPage, "/site/lumen/tools/image-studio");

    captures.login = await capturePage(publicPage, "/site/lumen/login", "lumen-visual-login-20260607", { width: 1440, height: 1100 }, false);
    await ensureLoginPage(publicPage);
    await ensureNoDemoCopy(publicPage, "/site/lumen/login");

    await publicContext.close();

    const authContext = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    const authPage = await authContext.newPage();
    await loginCustomer(authPage);

    captures.workspace = await capturePage(authPage, "/site/lumen/app", "lumen-visual-workspace-20260607", { width: 1440, height: 1280 });
    await ensureWorkspacePage(authPage, "/site/lumen/app");

    captures.jobs = await capturePage(authPage, "/site/lumen/app/jobs/progress", "lumen-visual-jobs-20260607", { width: 1440, height: 1280 });
    await ensureWorkspacePage(authPage, "/site/lumen/app/jobs/progress");

    captures.album = await capturePage(authPage, "/site/lumen/album", "lumen-visual-album-20260607", { width: 1440, height: 1280 });
    await ensureAlbumPage(authPage);
    await ensureNoDemoCopy(authPage, "/site/lumen/album");

    await authContext.close();

    console.log(JSON.stringify({
      site: "lumen",
      visualQa: "ok",
      captures,
      checkedRoutes: [
        "/site/lumen",
        "/site/lumen/pricing",
        "/site/lumen/tools/image-studio",
        "/site/lumen/login",
        "/site/lumen/app",
        "/site/lumen/app/jobs/progress",
        "/site/lumen/album"
      ]
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
