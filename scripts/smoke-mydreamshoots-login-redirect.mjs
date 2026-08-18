import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { chromium } from "playwright";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";

loadRuntimeEnv();

const prisma = new PrismaClient();
const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:3002").replace(/\/$/, "");
const siteSlug = process.env.SMOKE_SITE_SLUG || "mydreamshoots";
const siteId = process.env.SMOKE_SITE_ID || "site_dreamshoot";
const hostModePublicHost = process.env.SMOKE_PUBLIC_HOST || "www.mydreamshoots.com";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertLoginMediaLayout(page) {
  const primaryImage = page.locator('section[id="start"] img').first();
  await primaryImage.waitFor({ state: "visible", timeout: 30000 });
  await page.waitForFunction(
    () => {
      const image = document.querySelector('section[id="start"] img');
      return Boolean(image && window.getComputedStyle(image).objectFit === "cover");
    },
    undefined,
    { timeout: 10000 }
  );
  const layout = await primaryImage.evaluate((image) => {
    const imageRect = image.getBoundingClientRect();
    const frame = image.closest("div.relative");
    const frameRect = frame?.getBoundingClientRect();
    return {
      objectFit: window.getComputedStyle(image).objectFit,
      imageWidth: imageRect.width,
      imageHeight: imageRect.height,
      frameWidth: frameRect?.width ?? 0,
      frameHeight: frameRect?.height ?? 0
    };
  });
  assert(layout.objectFit === "cover", `login media image should use object-fit: cover, received ${layout.objectFit}`);
  assert(
    layout.imageWidth >= layout.frameWidth - 2 && layout.imageHeight >= layout.frameHeight - 2,
    `login media image should fill its frame: image ${layout.imageWidth}x${layout.imageHeight}, frame ${layout.frameWidth}x${layout.frameHeight}`
  );
}

async function waitForWorkspaceUi(page, contextLabel) {
  await page.waitForFunction(
    () => /Generate Image|Create New AI Model|Pick Package|source photos/i.test(document.body.innerText),
    undefined,
    { timeout: 60000 }
  );
  const bodyText = await page.locator("body").innerText({ timeout: 10000 });
  assert(
    /Generate Image|Create New AI Model|Pick Package|source photos/i.test(bodyText),
    `${contextLabel} reached app/create, but the create workspace UI did not render`
  );
}

function hashPassword(password) {
  return `sha256:${crypto.createHash("sha256").update(password).digest("hex")}`;
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
}

async function waitForApprovedPath(page, pathName, timeout = 60000) {
  const accepted = new Set([pathName, `/site/${siteSlug}${pathName}`]);
  await page.waitForURL((url) => accepted.has(url.pathname), { timeout });
}

async function createSmokeCustomer() {
  const customerId = uid("cust_login");
  const email = `${customerId}@example.test`;
  const password = "SmokePass1!";
  await prisma.customer.create({
    data: {
      id: customerId,
      siteId,
      email,
      passwordHash: hashPassword(password),
      name: "Login Redirect Smoke",
      status: "active",
      balance: {
        create: {
          id: uid("bal_login"),
          siteId,
          balance: 0,
          reserved: 0
        }
      }
    }
  });
  return { customerId, email, password };
}

async function smokeLoginRedirect() {
  const smoke = await createSmokeCustomer();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ baseURL: baseUrl });
    const loginResponses = [];
    page.on("response", (response) => {
      if (response.url().includes("/auth/login")) loginResponses.push(`${response.status()} ${response.url()}`);
    });

    const expectedWorkspacePath = `/site/${siteSlug}/app/create`;
    const expectedNextPath = `${expectedWorkspacePath}?nextHash=step-video`;
    await page.goto(expectedNextPath, { waitUntil: "networkidle" });
    await page.waitForFunction((expectedPath) => window.location.pathname === expectedPath, `/site/${siteSlug}/login`, { timeout: 45000 });
    const loginUrl = new URL(page.url());
    assert(loginUrl.searchParams.get("next") === expectedNextPath, `protected route did not preserve the encoded workspace target: ${page.url()}`);
    await assertLoginMediaLayout(page);
    await page.getByLabel("Email").fill(smoke.email);
    await page.getByLabel("Password").fill(smoke.password);
    await page.locator('form button[type="submit"]').last().click({ noWaitAfter: true });
    await page.waitForFunction((expectedPath) => window.location.pathname === expectedPath, expectedWorkspacePath, { timeout: 45000 });
    await page.waitForFunction(() => window.location.hash === "#step-video" && !new URLSearchParams(window.location.search).has("nextHash"), undefined, { timeout: 45000 });
    await waitForWorkspaceUi(page, "login redirect");
    assert(loginResponses.some((entry) => entry.startsWith("200 ")), `login API did not return 200: ${loginResponses.join(", ")}`);
    console.log(`✓ login restores /site/${siteSlug}/app/create#step-video and renders the video workspace`);
    const customerCookies = (await page.context().cookies(baseUrl)).filter((cookie) => cookie.name.startsWith("customer_session_") || cookie.name.startsWith("customer_csrf_"));
    assert(customerCookies.some((cookie) => cookie.name === `customer_session_${siteId}`), "path-mode login did not set the customer session cookie");

    const hostContext = await browser.newContext({
      baseURL: baseUrl,
      viewport: { width: 1440, height: 900 },
      extraHTTPHeaders: { "x-forwarded-host": hostModePublicHost }
    });
    try {
      await hostContext.addCookies(customerCookies);
      const hostPage = await hostContext.newPage();

      await hostPage.goto("/", { waitUntil: "commit", timeout: 60000 });
      await hostPage.getByRole("link", { name: /^Workspace$/ }).first().waitFor({ state: "visible", timeout: 30000 });
      await hostPage.getByRole("link", { name: /^Workspace$/ }).first().click({ noWaitAfter: true });
      await waitForApprovedPath(hostPage, "/app/create");
      await hostPage.goto("/", { waitUntil: "commit", timeout: 60000 });
      await hostPage.getByRole("link", { name: /Open account/i }).first().waitFor({ state: "visible", timeout: 30000 });
      await hostPage.getByRole("link", { name: /Open account/i }).first().click({ noWaitAfter: true });
      await waitForApprovedPath(hostPage, "/account");
      await hostPage.getByRole("link", { name: /Open workspace/i }).first().waitFor({ state: "visible", timeout: 30000 });
      await hostPage.getByRole("link", { name: /Open workspace/i }).first().click({ noWaitAfter: true });
      await waitForApprovedPath(hostPage, "/app/create");
      console.log(`✓ host-mode Workspace, account, and account-center workspace clicks land on the approved paths for ${hostModePublicHost}`);
    } finally {
      await hostContext.close();
    }
  } finally {
    await browser.close();
    await prisma.customer.deleteMany({ where: { id: smoke.customerId } }).catch(() => undefined);
  }
}

smokeLoginRedirect()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
