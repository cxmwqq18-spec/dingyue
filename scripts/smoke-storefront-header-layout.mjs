import { chromium } from "playwright";

const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:3002").replace(/\/$/, "");
const baseHost = (() => {
  try {
    return new URL(baseUrl).hostname.toLowerCase();
  } catch {
    return "";
  }
})();
const isGrownstrideTestBase = baseHost === "test.grownstride.com";
const pageTimeoutMs = Number(process.env.STOREFRONT_HEADER_PAGE_TIMEOUT_MS ?? 60_000);
const stores = [
  {
    slug: "mydreamshoots",
    siteId: "site_dreamshoot",
    publicLabels: ["AI Image Generation", "AI Video Generation", "Best Packages", "How it works", "Blog", "Pricing", "Workspace"],
    appLabels: ["AI Image Generation", "AI Video Generation", "Best Packages", "How it works", "Blog", "Pricing", "Workspace"],
    credentials: [
      {
        email: process.env.SMOKE_MYDREAMSHOOTS_CUSTOMER_EMAIL || process.env.SMOKE_CUSTOMER_EMAIL || "nora@mydreamshoots.localhost",
        password: process.env.SMOKE_MYDREAMSHOOTS_CUSTOMER_PASSWORD || process.env.SMOKE_CUSTOMER_PASSWORD || "nora123"
      },
      { email: "1621417163@qq.com", password: process.env.SMOKE_CUSTOMER_PASSWORD || "mydreamshoots123" }
    ]
  },
  {
    slug: "aidreamcapes",
    siteId: "site_aidreamcapes",
    publicLabels: ["Occasion Albums", "Tools", "Best Packages", "How it works", ["Guides", "Blog"], "Pricing", "Workspace"],
    appLabels: ["Occasion Albums", "Tools", "Best Packages", "How it works", "Workspace", "Pricing"],
    credentials: [
      {
        email: process.env.SMOKE_AIDREAMCAPES_CUSTOMER_EMAIL || "aria@aidreamcapes.localhost",
        password: process.env.SMOKE_AIDREAMCAPES_CUSTOMER_PASSWORD || "aria123"
      },
      { email: "1621417163@qq.com", password: process.env.SMOKE_AIDREAMCAPES_CUSTOMER_PASSWORD || "aidreamcapes123" }
    ]
  },
  {
    slug: "grownstride",
    siteId: "site_grownstride_test",
    routePrefix: isGrownstrideTestBase ? "" : "/site/grownstride",
    testHostOnly: true,
    publicLabels: ["AI Image Generation", "AI Video Generation", "Best Packages", "How it works", "Blog", "Pricing", "Workspace"],
    appLabels: ["AI Image Generation", "AI Video Generation", "Best Packages", "How it works", "Blog", "Pricing", "Workspace"],
    credentials: [
      {
        email: process.env.SMOKE_GROWNSTRIDE_CUSTOMER_EMAIL || process.env.GROWNSTRIDE_TEST_CUSTOMER_EMAIL || "nora@grownstride.localhost",
        password: process.env.SMOKE_GROWNSTRIDE_CUSTOMER_PASSWORD || process.env.GROWNSTRIDE_TEST_CUSTOMER_PASSWORD || "grownstride123"
      }
    ]
  }
];
const viewports = [
  { name: "desktop_1280", width: 1280, height: 900 },
  { name: "desktop_1440", width: 1440, height: 900 },
  { name: "desktop_1536", width: 1536, height: 900 },
  { name: "desktop_1920", width: 1920, height: 1000 },
  { name: "desktop_2048", width: 2048, height: 1100 },
  { name: "mobile_390", width: 390, height: 844 }
];
const requestedStoreSlugs = new Set(
  String(process.env.SMOKE_STORE_SLUGS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
);
const defaultStores = isGrownstrideTestBase
  ? stores.filter((store) => store.slug === "grownstride")
  : stores.filter((store) => !store.testHostOnly);
const selectedStores = requestedStoreSlugs.size ? stores.filter((store) => requestedStoreSlugs.has(store.slug)) : defaultStores;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesLabel(text, expected) {
  if (Array.isArray(expected)) return expected.some((option) => matchesLabel(text, option));
  return new RegExp(escapeRegExp(expected), "i").test(text);
}

function routePrefixForStore(store) {
  return store.routePrefix ?? `/site/${store.slug}`;
}

async function gotoPath(page, store, path = "") {
  const route = `${baseUrl}${routePrefixForStore(store)}${path}`;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(route, { waitUntil: "domcontentloaded", timeout: pageTimeoutMs });
      await page.waitForTimeout(500);
      return;
    } catch (error) {
      const message = String(error?.message ?? "");
      const retryable = message.includes("net::ERR_ABORTED") || message.includes("net::ERR_CONNECTION_REFUSED") || message.includes("Timeout");
      if (!retryable || attempt === 2) throw error;
      await page.waitForTimeout(800 + attempt * 1200);
    }
  }
}

async function headerSnapshot(page) {
  return page.evaluate(() => {
    const header = document.querySelector("header");
    const nav = header?.querySelector("nav");
    const visible = (element) => {
      if (!element || !element.getClientRects().length) return false;
      const style = window.getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || "1") !== 0;
    };
    const rect = (element) => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
    };
    const viewportWidth = document.documentElement.clientWidth;
    const controls = [...(header?.querySelectorAll("a, button, summary") ?? [])]
      .filter(visible)
      .map((element) => ({
        label: (element.textContent || element.getAttribute("aria-label") || element.getAttribute("title") || "").replace(/\s+/g, " ").trim(),
        rect: rect(element)
      }))
      .filter((item) => item.rect && item.rect.width > 0 && item.rect.height > 0);
    const overlaps = [];
    for (let a = 0; a < controls.length; a += 1) {
      for (let b = a + 1; b < controls.length; b += 1) {
        const first = controls[a];
        const second = controls[b];
        const horizontallyOverlaps = second.rect.left < first.rect.right - 1 && first.rect.left < second.rect.right - 1;
        const verticallyOverlaps = second.rect.top < first.rect.bottom - 1 && first.rect.top < second.rect.bottom - 1;
        if (horizontallyOverlaps && verticallyOverlaps) overlaps.push({ first, second });
      }
    }
    return {
      bodyScrollWidth: document.documentElement.scrollWidth,
      headerHeight: header?.getBoundingClientRect().height || 0,
      headerWidth: header?.clientWidth || 0,
      headerScrollWidth: header?.scrollWidth || 0,
      controls,
      controlTopRange: controls.length ? Math.max(...controls.map((item) => item.rect.top)) - Math.min(...controls.map((item) => item.rect.top)) : 0,
      overlaps,
      navText: (nav?.textContent || "").replace(/\s+/g, " ").trim(),
      navVisible: visible(nav),
      mobileMenuVisible: visible(header?.querySelector("[data-storefront-mobile-menu]")),
      moreVisible: visible(header?.querySelector("[data-storefront-header-more-menu]")) || /(^|\s)More(\s|$)/.test(nav?.textContent || ""),
      accountDropdownVisible: visible(header?.querySelector("[data-storefront-header-account-menu]")),
      headerText: (header?.textContent || "").replace(/\s+/g, " ").trim(),
      viewportWidth
    };
  });
}

function assertNoOverflowOrOverlap(snapshot, slug, viewport, scope) {
  assert(snapshot.headerWidth > 0, `${slug} ${scope} ${viewport.name}: header did not render`);
  assert(snapshot.headerScrollWidth <= snapshot.headerWidth + 1, `${slug} ${scope} ${viewport.name}: header overflow ${snapshot.headerScrollWidth} > ${snapshot.headerWidth}`);
  assert(snapshot.bodyScrollWidth <= snapshot.viewportWidth + 1, `${slug} ${scope} ${viewport.name}: page overflow ${snapshot.bodyScrollWidth} > ${snapshot.viewportWidth}`);
  assert(!snapshot.overlaps.length, `${slug} ${scope} ${viewport.name}: header controls overlap ${JSON.stringify(snapshot.overlaps.slice(0, 3))}`);
}

async function assertHeaderLayout(page, store, viewport, { scope = "public", expectedLabels = store.publicLabels } = {}) {
  const snapshot = await headerSnapshot(page);
  assertNoOverflowOrOverlap(snapshot, store.slug, viewport, scope);
  assert(!snapshot.moreVisible, `${store.slug} ${scope} ${viewport.name}: More menu should not be visible`);
  assert(!snapshot.accountDropdownVisible, `${store.slug} ${scope} ${viewport.name}: account dropdown should not be visible`);

  if (viewport.width < 1280) {
    assert(snapshot.mobileMenuVisible || snapshot.headerText.includes("Sign out"), `${store.slug} ${scope} ${viewport.name}: mobile menu or signed-in account controls are missing`);
    return;
  }

  assert(snapshot.navVisible, `${store.slug} ${scope} ${viewport.name}: desktop navigation is not visible`);
  assert(snapshot.controlTopRange <= 14, `${store.slug} ${scope} ${viewport.name}: desktop header controls should stay on one row, top range ${snapshot.controlTopRange}`);
  for (const label of expectedLabels) {
    assert(matchesLabel(snapshot.navText, label), `${store.slug} ${scope} ${viewport.name}: desktop navigation is missing ${Array.isArray(label) ? label.join(" / ") : label}; nav text: ${snapshot.navText}`);
  }
  assert(!/FAQ/.test(snapshot.navText), `${store.slug} ${scope} ${viewport.name}: FAQ returned to top navigation`);
  assert(snapshot.navText.indexOf("Tools") < snapshot.navText.indexOf("Best Packages"), `${store.slug} ${scope} ${viewport.name}: Best Packages is not after Tools`);
}

async function loginCustomer(context, store) {
  for (const credential of store.credentials) {
    const response = await context.request.post(`${baseUrl}/api/sites/${store.siteId}/auth/login`, {
      data: credential,
      failOnStatusCode: false
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok() && data.ok) {
      console.log(`✓ ${store.slug} authenticated header session: ${credential.email}`);
      return credential.email;
    }
  }
  return "";
}

async function assertAuthenticatedInlineAccount(page, store, viewport, { scope = "public", email = "" } = {}) {
  await page.waitForFunction(() => /Sign out|Cerrar sesion/.test(document.querySelector("header")?.textContent || ""), null, { timeout: 10_000 }).catch(() => undefined);
  const snapshot = await headerSnapshot(page);
  assertNoOverflowOrOverlap(snapshot, store.slug, viewport, scope);
  assert(!snapshot.accountDropdownVisible, `${store.slug} ${scope} ${viewport.name}: authenticated account should not be rendered as a dropdown`);
  assert(!snapshot.moreVisible, `${store.slug} ${scope} ${viewport.name}: More menu should not appear for authenticated header`);
  assert(/Sign out|Cerrar sesion/.test(snapshot.headerText), `${store.slug} ${scope} ${viewport.name}: inline sign out action is missing`);
  if (email) {
    assert(snapshot.headerText.includes(email), `${store.slug} ${scope} ${viewport.name}: inline customer email is missing`);
  }
}

async function main() {
  assert(selectedStores.length, `No storefront header smoke stores matched SMOKE_STORE_SLUGS=${[...requestedStoreSlugs].join(",")}`);
  const requireAuthenticatedHeader = process.env.STOREFRONT_HEADER_REQUIRE_AUTH === "1" || selectedStores.some((store) => store.slug === "grownstride");
  const browser = await chromium.launch({ headless: true });
  try {
    for (const store of selectedStores) {
      const guestContext = await browser.newContext();
      const guestPage = await guestContext.newPage();
      try {
        for (const viewport of viewports) {
          await guestPage.setViewportSize({ width: viewport.width, height: viewport.height });
          await gotoPath(guestPage, store);
          await assertHeaderLayout(guestPage, store, viewport);
        }
        console.log(`✓ ${store.slug} guest header full visibility checked`);
      } finally {
        await guestContext.close();
      }

      const authenticatedContext = await browser.newContext();
      try {
        const email = await loginCustomer(authenticatedContext, store);
        if (!email) {
          assert(!requireAuthenticatedHeader, `${store.slug}: demo customer login is unavailable, so authenticated header could not be checked`);
          console.log(`↷ ${store.slug} authenticated header check skipped because demo customer login is unavailable`);
          continue;
        }
        const authenticatedPage = await authenticatedContext.newPage();
        for (const viewport of viewports.filter((item) => item.width >= 1280)) {
          await authenticatedPage.setViewportSize({ width: viewport.width, height: viewport.height });
          await gotoPath(authenticatedPage, store);
          await assertHeaderLayout(authenticatedPage, store, viewport);
          await assertAuthenticatedInlineAccount(authenticatedPage, store, viewport, { email });
        }
        for (const viewport of viewports.filter((item) => item.width >= 1280)) {
          await authenticatedPage.setViewportSize({ width: viewport.width, height: viewport.height });
          await gotoPath(authenticatedPage, store, "/app/create");
          await assertHeaderLayout(authenticatedPage, store, viewport, { scope: "app", expectedLabels: store.appLabels });
          await assertAuthenticatedInlineAccount(authenticatedPage, store, viewport, { scope: "app", email });
        }
        console.log(`✓ ${store.slug} authenticated inline account and app header checked`);
      } finally {
        await authenticatedContext.close();
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
