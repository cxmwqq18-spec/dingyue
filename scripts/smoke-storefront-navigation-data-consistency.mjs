import { chromium } from "playwright";

const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:3002").replace(/\/$/, "");

const siteChecks = [
  {
    slug: "aidreamcapes",
    routes: [
      "/site/aidreamcapes",
      "/site/aidreamcapes/collections",
      "/site/aidreamcapes/collections/island-resort-scenes",
      "/site/aidreamcapes/tools",
      "/site/aidreamcapes/pricing",
      "/site/aidreamcapes/faq",
      "/site/aidreamcapes/login"
    ]
  },
  {
    slug: "mydreamshoots",
    routes: [
      "/site/mydreamshoots",
      "/site/mydreamshoots/collections",
      "/site/mydreamshoots/collections/creator-portraits",
      "/site/mydreamshoots/tools",
      "/site/mydreamshoots/pricing",
      "/site/mydreamshoots/faq",
      "/site/mydreamshoots/login"
    ]
  }
];

const menuChecks = [
  {
    name: "packages",
    buttonName: /Browse packages|Travel Packages|Ver paquetes|Paquetes de viaje/i
  },
  {
    name: "tools",
    buttonName: /^Tools$|^Herramientas$/
  }
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function extractMenuSignature(page, siteSlug, route, menuCheck) {
  const button = page.getByRole("button", { name: menuCheck.buttonName }).first();
  await button.waitFor({ state: "visible", timeout: 30000 });
  await button.click({ timeout: 15000 });
  await page.waitForFunction(
    () => Boolean(document.querySelector('[data-storefront-mega-menu-panel][aria-hidden="false"]')),
    undefined,
    { timeout: 10000 }
  );
  const signature = await page.evaluate(
    ({ currentSiteSlug, currentMenuName }) => {
      const panel = document.querySelector('[data-storefront-mega-menu-panel][aria-hidden="false"]');
      if (!panel) return [];
      const links = [...panel.querySelectorAll("a[href]")]
        .map((anchor) => ({
          text: (anchor.textContent || "").replace(/\s+/g, " ").trim(),
          href: anchor.getAttribute("href") || ""
        }))
        .filter((item) => item.text)
        .filter((item) => {
          if (currentMenuName === "packages") {
            return item.href.includes(`/site/${currentSiteSlug}/collections/`) || item.href.startsWith("/collections/");
          }
          return item.href.includes(`/site/${currentSiteSlug}/tools/`) || item.href.startsWith("/tools/");
        });
      return links.map((item) => `${item.text} -> ${item.href}`);
    },
    { currentSiteSlug: siteSlug, currentMenuName: menuCheck.name }
  );
  await page.keyboard.press("Escape").catch(() => undefined);
  assert(signature.length > 0, `${siteSlug} ${route} ${menuCheck.name}: no menu item links were found`);
  return signature;
}

async function smokeNavigationDataConsistency() {
  const browser = await chromium.launch({ headless: true });
  const failures = [];
  try {
    const context = await browser.newContext({
      baseURL: baseUrl,
      viewport: { width: 1440, height: 1000 }
    });
    const page = await context.newPage();

    for (const site of siteChecks) {
      for (const menuCheck of menuChecks) {
        let expected;
        for (const route of site.routes) {
          await page.goto(route, { waitUntil: "domcontentloaded", timeout: 60000 });
          await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => undefined);
          const signature = await extractMenuSignature(page, site.slug, route, menuCheck);
          if (!expected) {
            expected = { route, signature };
            console.log(`✓ ${site.slug} ${menuCheck.name} baseline ${route}: ${signature.length} links`);
            continue;
          }
          const expectedJson = JSON.stringify(expected.signature);
          const actualJson = JSON.stringify(signature);
          if (actualJson !== expectedJson) {
            failures.push({
              site: site.slug,
              menu: menuCheck.name,
              baselineRoute: expected.route,
              route,
              expectedCount: expected.signature.length,
              actualCount: signature.length,
              missing: expected.signature.filter((item) => !signature.includes(item)).slice(0, 12),
              extra: signature.filter((item) => !expected.signature.includes(item)).slice(0, 12)
            });
            console.log(`✗ ${site.slug} ${menuCheck.name} ${route}: ${signature.length} links differ from ${expected.signature.length}`);
          } else {
            console.log(`✓ ${site.slug} ${menuCheck.name} ${route}: ${signature.length} links`);
          }
        }
      }
    }
  } finally {
    await browser.close();
  }

  assert(!failures.length, `Storefront navigation menu data drifted across routes:\n${JSON.stringify(failures, null, 2)}`);
}

smokeNavigationDataConsistency().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
