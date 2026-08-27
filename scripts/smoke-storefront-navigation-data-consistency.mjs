import { chromium } from "playwright";

const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:3002").replace(/\/$/, "");
const siteBaseUrls = {
  mydreamshoots: (process.env.STOREFRONT_NAV_MYDREAMSHOOTS_BASE_URL || baseUrl).replace(/\/$/, ""),
  aidreamcapes: (process.env.STOREFRONT_NAV_AIDREAMCAPES_BASE_URL || baseUrl).replace(/\/$/, "")
};
const pageTimeoutMs = Number(process.env.STOREFRONT_NAV_PAGE_TIMEOUT_MS ?? 90_000);
const networkIdleTimeoutMs = Number(process.env.STOREFRONT_NAV_NETWORK_IDLE_TIMEOUT_MS ?? 20_000);
const focusSiteSlug = process.env.STOREFRONT_NAV_FOCUS_SITE || "";
const skipFocusedVisuals = process.env.STOREFRONT_NAV_SKIP_VISUALS === "1";
const skipWorkspaceOptions = process.env.STOREFRONT_NAV_SKIP_WORKSPACE === "1";

const siteChecks = [
  {
    slug: "aidreamcapes",
    routes: [
      "/site/aidreamcapes",
      "/site/aidreamcapes/collections",
      "/site/aidreamcapes/collections/fan-scene-albums",
      "/site/aidreamcapes/collections/private-fan-scene-albums",
      "/site/aidreamcapes/collections/game-day-group-photos",
      "/site/aidreamcapes/collections/christmas-group-albums",
      "/site/aidreamcapes/tools",
      "/site/aidreamcapes/tools/fan-scene-album-builder",
      "/site/aidreamcapes/tools/new-year-countdown-album-maker",
      "/site/aidreamcapes/best-packages",
      "/site/aidreamcapes/best-ai-image",
      "/site/aidreamcapes/best-ai-video",
      "/site/aidreamcapes/pricing",
      "/site/aidreamcapes/faq",
      "/site/aidreamcapes/login"
    ]
  },
  {
    slug: "mydreamshoots",
    routes: [
      "/site/mydreamshoots",
      "/site/mydreamshoots/ai-image-generation",
      "/site/mydreamshoots/ai-image-generation/portrait-photo",
      "/site/mydreamshoots/ai-video-generation",
      "/site/mydreamshoots/ai-video-generation/talking-photo",
      "/site/mydreamshoots/ai-video-generation/cinematic-video",
      "/site/mydreamshoots/ai-video-generation/tiktok-video",
      "/site/mydreamshoots/ai-video-generation/instagram-reels",
      "/site/mydreamshoots/ai-video-generation/social-media-video",
      "/site/mydreamshoots/ai-video-generation/youtube-video",
      "/site/mydreamshoots/ai-video-generation/story-video",
      "/site/mydreamshoots/ai-video-generation/meme-video",
      "/site/mydreamshoots/ai-video-generation/product-video",
      "/site/mydreamshoots/ai-video-generation/product-ad-video",
      "/site/mydreamshoots/ai-video-generation/promo-video",
      "/site/mydreamshoots/ai-video-generation/ugc-ad-video",
      "/site/mydreamshoots/ai-video-generation/video-ad",
      "/site/mydreamshoots/best-packages",
      "/site/mydreamshoots/best-ai-image",
      "/site/mydreamshoots/best-ai-video",
      "/site/mydreamshoots/pricing",
      "/site/mydreamshoots/faq",
      "/site/mydreamshoots/login"
    ]
  }
];

const menuChecks = [
  {
    name: "packages",
    buttonName: /AI Image Generation|AI Photoshoot|Headshot Generator|Photoshoot Studio|Browse packages|Occasion Albums|Photo Packages|Ver paquetes|Paquetes de ocasion/i
  },
  {
    name: "tools",
    buttonName: /^(AI Video Generation|AI Tools|Tools|Herramientas)$/
  }
];

const workspaceChecks = [
  {
    slug: "aidreamcapes",
    siteId: "site_aidreamcapes",
    expectedPackageCount: 28,
    expectedToolCount: 20,
    credentials: [
      {
        email: process.env.SMOKE_AIDREAMCAPES_CUSTOMER_EMAIL || "aria@aidreamcapes.localhost",
        password: process.env.SMOKE_AIDREAMCAPES_CUSTOMER_PASSWORD || "aria123"
      },
      { email: "1621417163@qq.com", password: process.env.SMOKE_AIDREAMCAPES_CUSTOMER_PASSWORD || "aidreamcapes123" }
    ]
  },
  {
    slug: "mydreamshoots",
    siteId: "site_dreamshoot",
    expectedPackageCount: 38,
    expectedToolCount: 0,
    credentials: [
      {
        email: process.env.SMOKE_MYDREAMSHOOTS_CUSTOMER_EMAIL || process.env.SMOKE_CUSTOMER_EMAIL || "nora@mydreamshoots.localhost",
        password: process.env.SMOKE_MYDREAMSHOOTS_CUSTOMER_PASSWORD || process.env.SMOKE_CUSTOMER_PASSWORD || "nora123"
      },
      { email: "1621417163@qq.com", password: process.env.SMOKE_CUSTOMER_PASSWORD || "mydreamshoots123" }
    ]
  }
];

const focusedVisualRoutes = [
  {
    site: "mydreamshoots",
    route: "/site/mydreamshoots",
    footerText: "© 2026 myDreamshoots.com. All rights reserved.",
    categoryHrefs: {
      Christmas: "/site/mydreamshoots/ai-image-generation/christmas-photo",
      Thanksgiving: "/site/mydreamshoots/ai-image-generation/thanksgiving-photo",
      Halloween: "/site/mydreamshoots/ai-image-generation/halloween-photo",
      Seasonal: "/site/mydreamshoots/ai-image-generation/holiday",
      Creator: "/site/mydreamshoots/ai-image-generation/portrait-photo",
      Video: "/site/mydreamshoots/ai-video-generation/motion-generator",
      Utility: "/site/mydreamshoots/ai-image-generation/photo-enhancer"
    }
  },
  {
    site: "mydreamshoots",
    route: "/site/mydreamshoots/ai-image-generation"
  },
  {
    site: "mydreamshoots",
    route: "/site/mydreamshoots/ai-image-generation/thanksgiving-photo"
  },
  {
    site: "aidreamcapes",
    route: "/site/aidreamcapes",
    footerText: "© 2026 Aidreamcapes.com. All rights reserved.",
    categoryHrefs: {
      "Fan Scenes": "/site/aidreamcapes/collections/fan-scene-albums",
      "Game Day": "/site/aidreamcapes/collections/game-day-group-photos",
      Premiere: "/site/aidreamcapes/collections/premiere-style-portraits",
      Christmas: "/site/aidreamcapes/collections/christmas-holiday-albums",
      Thanksgiving: "/site/aidreamcapes/collections/thanksgiving-memory-sets",
      Halloween: "/site/aidreamcapes/collections/halloween-party-portraits",
      Seasonal: "/site/aidreamcapes/collections/seasonal-celebration-photos"
    },
    forbidPackageLoginCards: true,
    checkMotionVideos: true
  },
  {
    site: "aidreamcapes",
    route: "/site/aidreamcapes/collections"
  },
  {
    site: "aidreamcapes",
    route: "/site/aidreamcapes/collections/christmas-holiday-albums"
  }
];

function filterByFocusSite(items) {
  if (!focusSiteSlug) return items;
  return items.filter((item) => item.slug === focusSiteSlug || item.site === focusSiteSlug);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeHref(value) {
  let normalized = String(value || "");
  for (const origin of [baseUrl, ...Object.values(siteBaseUrls)]) normalized = normalized.replace(origin, "");
  return normalized.replace(/\/$/, "");
}

function normalizeSignatureHref(value, siteSlug) {
  const href = normalizeHref(value);
  if (href === "/app/create#step-video") return `/site/${siteSlug}${href}`;
  if (href.startsWith("/collections/") || href === "/collections") return `/site/${siteSlug}${href}`;
  if (href.startsWith("/ai-image-generation/") || href === "/ai-image-generation") return `/site/${siteSlug}${href}`;
  if (href.startsWith("/ai-video-generation/") || href === "/ai-video-generation") return `/site/${siteSlug}${href}`;
  if (href.startsWith("/tools/") || href === "/tools") return `/site/${siteSlug}${href}`;
  return href;
}

function signatureFromItems(items, siteSlug) {
  const seen = new Set();
  const signature = [];
  for (const item of items) {
    const text = String(item.text || "").replace(/\s+/g, " ").trim();
    const href = normalizeSignatureHref(item.href, siteSlug);
    if (!text || !href) continue;
    const key = `${text} -> ${href}`;
    if (seen.has(key)) continue;
    seen.add(key);
    signature.push(key);
  }
  return signature;
}

async function extractMenuSignature(page, siteSlug, route, menuCheck) {
  const trigger = page
    .locator('nav button[aria-haspopup="dialog"], nav details[data-native-mega-menu] > summary')
    .filter({ hasText: menuCheck.buttonName })
    .first();
  await trigger.waitFor({ state: "visible", timeout: 30000 });
  const controlId = await trigger.getAttribute("aria-controls");
  const nativeMenu = await trigger.evaluate((element) => Boolean(element.closest("details[data-native-mega-menu]")));
  await trigger.click();
  const items = await page.evaluate(
    ({ currentSiteSlug, currentMenuName, currentControlId, isNativeMenu }) => {
      const panel = currentControlId
        ? document.getElementById(currentControlId)
        : isNativeMenu
          ? document.querySelector("details[data-native-mega-menu][open] > div")
        : document.querySelector('[data-storefront-mega-menu-panel][aria-hidden="false"]');
      if (!panel) return [];
      const toolCardAnchors = currentMenuName === "tools"
        ? [...panel.querySelectorAll('a[data-xfcart-block-type="tool_card"][href]')]
        : [];
      const anchors = toolCardAnchors.length ? toolCardAnchors : [...panel.querySelectorAll("a[href]")];
      const links = anchors
        .map((anchor) => ({
          text: (anchor.textContent || "").replace(/\s+/g, " ").trim(),
          href: anchor.getAttribute("href") || ""
        }))
        .filter((item) => item.text)
        .filter((item) => {
          if (currentMenuName === "packages") {
            return item.href.includes(`/site/${currentSiteSlug}/collections/`) ||
              item.href.includes(`/site/${currentSiteSlug}/ai-image-generation/`) ||
              item.href.startsWith("/collections/") ||
              item.href.startsWith("/ai-image-generation/");
          }
          if (currentSiteSlug === "mydreamshoots") {
            return item.href.includes(`/site/${currentSiteSlug}/app/create#step-video`) ||
              item.href === "/app/create#step-video" ||
              item.href.startsWith("/app/create#step-video") ||
              item.href.includes(`/site/${currentSiteSlug}/ai-video-generation/`) ||
              item.href.startsWith("/ai-video-generation/");
          }
          return item.href.includes(`/site/${currentSiteSlug}/tools/`) || item.href.startsWith("/tools/");
      });
      return links;
    },
    { currentSiteSlug: siteSlug, currentMenuName: menuCheck.name, currentControlId: controlId, isNativeMenu: nativeMenu }
  );
  if (nativeMenu) await trigger.click().catch(() => undefined);
  else await page.keyboard.press("Escape").catch(() => undefined);
  const signature = signatureFromItems(items, siteSlug);
  assert(signature.length > 0, `${siteSlug} ${route} ${menuCheck.name}: no menu item links were found`);
  return signature;
}

async function assertBestPackagesDirectLink(page, siteSlug, route, failures) {
  if (siteSlug === "mydreamshoots") return;
  const result = await page.evaluate(() => {
    const nav = document.querySelector("header nav");
    const normalizeText = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const bestAnchors = [...(nav?.querySelectorAll("a[href]") ?? [])]
      .filter((anchor) => normalizeText(anchor.textContent) === "Best Packages")
      .map((anchor) => anchor.getAttribute("href") || "");
    const bestButtons = [...(nav?.querySelectorAll('button[aria-haspopup="dialog"]') ?? [])]
      .filter((button) => normalizeText(button.textContent) === "Best Packages")
      .map((button) => normalizeText(button.textContent));
    return { bestAnchors, bestButtons };
  });
  const expectedHref = `/site/${siteSlug}/best-packages`;
  if (!result.bestAnchors.some((href) => normalizeHref(href) === expectedHref) || result.bestButtons.length) {
    failures.push({
      site: siteSlug,
      route,
      surface: "best_packages_header_link",
      expectedHref,
      anchors: result.bestAnchors,
      buttons: result.bestButtons
    });
  }
}

async function loginWorkspaceCustomer(context, workspaceCheck) {
  for (const credential of workspaceCheck.credentials) {
    const response = await context.request.post(`/api/sites/${workspaceCheck.siteId}/auth/login`, {
      data: { email: credential.email, password: credential.password },
      failOnStatusCode: false
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok() && data.ok) {
      console.log(`✓ ${workspaceCheck.slug} workspace login: ${credential.email}`);
      return true;
    }
  }
  console.log(`↷ skipping ${workspaceCheck.slug} workspace signature check because demo customer login is unavailable`);
  return false;
}

async function openWorkspaceCreate(page, siteSlug) {
  await gotoRoute(page, `/site/${siteSlug}/app/create`);
  await page.waitForLoadState("networkidle", { timeout: networkIdleTimeoutMs }).catch(() => undefined);
  await page.waitForFunction(() => document.querySelectorAll("[data-workspace-package-option]").length > 0, undefined, { timeout: 30000 });
}

async function extractWorkspacePackageSignature(page, siteSlug) {
  await openWorkspaceCreate(page, siteSlug);
  const items = await page.evaluate(() => [...document.querySelectorAll("[data-workspace-package-option]")]
    .map((item) => ({
      text: item.getAttribute("data-workspace-package-title") || item.textContent || "",
      href: item.getAttribute("data-workspace-package-href") || ""
    })));
  return signatureFromItems(items, siteSlug);
}

async function extractDirectoryPackageSignature(page, siteSlug) {
  await gotoRoute(page, `/site/${siteSlug}/ai-image-generation`);
  await page.waitForLoadState("networkidle", { timeout: networkIdleTimeoutMs }).catch(() => undefined);
  await page.waitForFunction(
    () => document.querySelectorAll('#package-taxonomy [data-package-taxonomy-client="ready"] a[href]').length > 0,
    undefined,
    { timeout: 30000 }
  );
  const items = await page.evaluate(() => [...document.querySelectorAll('#package-taxonomy [data-package-taxonomy-client="ready"] a[href]')]
    .map((item) => ({
      text: item.querySelector("h2")?.textContent || item.textContent || "",
      href: item.getAttribute("href") || ""
    })));
  return signatureFromItems(items, siteSlug);
}

async function extractWorkspacePackageAssetState(page, siteSlug) {
  await openWorkspaceCreate(page, siteSlug);
  return page.evaluate(() => ({
    packages: [...document.querySelectorAll("[data-workspace-package-option]")].map((item) => {
      const image = item.querySelector("img");
      return {
        title: item.getAttribute("data-workspace-package-title") || "",
        src: image?.getAttribute("src") || "",
        complete: Boolean(image?.complete),
        naturalWidth: image?.naturalWidth || 0,
        naturalHeight: image?.naturalHeight || 0
      };
    }),
    categories: [...document.querySelectorAll("[data-workspace-package-category-option]")]
      .map((item) => ({
        slug: item.getAttribute("data-workspace-package-category-option") || "",
        count: Number(item.getAttribute("data-workspace-package-category-count") || 0)
      }))
  }));
}

async function extractWorkspaceToolSignature(page, siteSlug) {
  await openWorkspaceCreate(page, siteSlug);
  await page.locator("form").getByRole("button", { name: /^Tools$|^Herramientas$/ }).first().click({ timeout: 15000 });
  await page.waitForFunction(() => document.querySelectorAll("[data-workspace-tool-option]").length > 0, undefined, { timeout: 30000 });
  const items = await page.evaluate(() => [...document.querySelectorAll("[data-workspace-tool-option]")]
    .map((item) => ({
      text: item.getAttribute("data-workspace-tool-title") || item.textContent || "",
      href: item.getAttribute("data-workspace-tool-href") || ""
    })));
  return signatureFromItems(items, siteSlug);
}

function normalizeWorkspaceSignatureItem(value) {
  const separatorIndex = value.indexOf(" -> ");
  if (separatorIndex < 0) return value.toLowerCase();
  return `${value.slice(0, separatorIndex).toLowerCase()}${value.slice(separatorIndex)}`;
}

function pushSignatureFailure(failures, { site, surface, expected, actual, requireOrder = true, normalizeItem = (value) => value }) {
  const normalizedExpected = expected.map(normalizeItem);
  const normalizedActual = actual.map(normalizeItem);
  const missing = expected.filter((item) => !normalizedActual.includes(normalizeItem(item)));
  const extra = actual.filter((item) => !normalizedExpected.includes(normalizeItem(item)));
  if (missing.length || extra.length || (requireOrder && JSON.stringify(normalizedExpected) !== JSON.stringify(normalizedActual))) {
    failures.push({
      site,
      surface,
      expectedCount: expected.length,
      actualCount: actual.length,
      missing: missing.slice(0, 16),
      extra: extra.slice(0, 16),
      orderMatches: JSON.stringify(normalizedExpected) === JSON.stringify(normalizedActual)
    });
  }
}

async function smokeWorkspaceOptionConsistency(context, failures, checks = workspaceChecks) {
  const page = await context.newPage();
  try {
    for (const workspaceCheck of checks) {
      if (!(await loginWorkspaceCustomer(context, workspaceCheck))) continue;
      await gotoRoute(page, `/site/${workspaceCheck.slug}`);
      await page.waitForLoadState("networkidle", { timeout: networkIdleTimeoutMs }).catch(() => undefined);
      const packageMenuSignature = await extractMenuSignature(page, workspaceCheck.slug, `/site/${workspaceCheck.slug}`, menuChecks[0]);
      const toolMenuSignature = await extractMenuSignature(page, workspaceCheck.slug, `/site/${workspaceCheck.slug}`, menuChecks[1]);
      const directoryPackageSignature = workspaceCheck.slug === "mydreamshoots"
        ? await extractDirectoryPackageSignature(page, workspaceCheck.slug)
        : [];
      const workspacePackageSignature = await extractWorkspacePackageSignature(page, workspaceCheck.slug);
      const workspacePackageAssetState = await extractWorkspacePackageAssetState(page, workspaceCheck.slug);
      const workspaceToolSignature = workspaceCheck.expectedToolCount > 0
        ? await extractWorkspaceToolSignature(page, workspaceCheck.slug)
        : [];

      if (workspacePackageSignature.length !== workspaceCheck.expectedPackageCount) {
        failures.push({ site: workspaceCheck.slug, surface: "workspace_packages_count", expected: workspaceCheck.expectedPackageCount, actual: workspacePackageSignature.length });
      }
      if (workspaceToolSignature.length !== workspaceCheck.expectedToolCount) {
        failures.push({ site: workspaceCheck.slug, surface: "workspace_tools_count", expected: workspaceCheck.expectedToolCount, actual: workspaceToolSignature.length });
      }
      if (directoryPackageSignature.length !== workspaceCheck.expectedPackageCount && workspaceCheck.slug === "mydreamshoots") {
        failures.push({ site: workspaceCheck.slug, surface: "directory_packages_count", expected: workspaceCheck.expectedPackageCount, actual: directoryPackageSignature.length });
      }
      if (workspaceCheck.slug === "mydreamshoots") {
        pushSignatureFailure(failures, {
          site: workspaceCheck.slug,
          surface: "directory_packages",
          expected: packageMenuSignature,
          actual: directoryPackageSignature,
          requireOrder: false,
          normalizeItem: normalizeWorkspaceSignatureItem
        });
      }
      const invalidWorkspaceImages = workspacePackageAssetState.packages.filter((item) =>
        !item.src ||
        !item.complete ||
        item.naturalWidth < 64 ||
        item.naturalHeight < 64 ||
        !item.src.includes("/assets/")
      );
      if (workspacePackageAssetState.packages.length !== workspaceCheck.expectedPackageCount || invalidWorkspaceImages.length) {
        failures.push({
          site: workspaceCheck.slug,
          surface: "workspace_package_images",
          expectedCount: workspaceCheck.expectedPackageCount,
          actualCount: workspacePackageAssetState.packages.length,
          invalidImages: invalidWorkspaceImages.slice(0, 12)
        });
      }
      if (workspaceCheck.slug === "mydreamshoots") {
        const allPackages = workspacePackageAssetState.categories.find((item) => item.slug === "all");
        const categoryTotal = workspacePackageAssetState.categories
          .filter((item) => item.slug !== "all")
          .reduce((total, item) => total + item.count, 0);
        if (allPackages?.count !== workspaceCheck.expectedPackageCount || categoryTotal !== workspaceCheck.expectedPackageCount) {
          failures.push({
            site: workspaceCheck.slug,
            surface: "workspace_package_category_counts",
            expected: workspaceCheck.expectedPackageCount,
            allPackages: allPackages?.count ?? 0,
            categoryTotal
          });
        }
      }
      pushSignatureFailure(failures, {
        site: workspaceCheck.slug,
        surface: "workspace_packages",
        expected: packageMenuSignature,
        actual: workspacePackageSignature,
        requireOrder: false,
        normalizeItem: normalizeWorkspaceSignatureItem
      });
      if (workspaceCheck.expectedToolCount > 0) {
        pushSignatureFailure(failures, {
          site: workspaceCheck.slug,
          surface: "workspace_tools",
          expected: toolMenuSignature,
          actual: workspaceToolSignature,
          requireOrder: false,
          normalizeItem: normalizeWorkspaceSignatureItem
        });
      }
      console.log(`✓ ${workspaceCheck.slug} workspace packages/tools signatures checked`);
    }
  } finally {
    await page.close();
  }
}

async function scrollThroughPage(page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.evaluate(async () => {
        const height = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
        const stops = [0, 0.28, 0.56, 0.84, 1];
        for (const stop of stops) {
          window.scrollTo(0, Math.max(0, Math.round((height - window.innerHeight) * stop)));
          await new Promise((resolve) => window.setTimeout(resolve, 350));
        }
      });
      return;
    } catch (error) {
      const message = String(error?.message ?? "");
      const retryable =
        message.includes("Execution context was destroyed") ||
        message.includes("Cannot find context") ||
        message.includes("Most likely because of a navigation");
      if (!retryable || page.isClosed() || attempt === 2) throw error;
      await page.waitForLoadState("domcontentloaded", { timeout: pageTimeoutMs }).catch(() => undefined);
      await page.waitForTimeout(500 + attempt * 500);
    }
  }
}

async function gotoRoute(page, route) {
  const match = route.match(/^\/site\/([^/]+)(\/.*)?$/);
  const siteSlug = match?.[1];
  const siteBase = siteBaseUrls[siteSlug] || baseUrl;
  const target = siteBase !== baseUrl && match ? `${siteBase}${match[2] || "/"}` : `${baseUrl}${route}`;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await page.goto(target, { waitUntil: "domcontentloaded", timeout: pageTimeoutMs });
    } catch (error) {
      const message = String(error?.message ?? "");
      const retryable =
        message.includes("net::ERR_ABORTED") ||
        message.includes("net::ERR_CONNECTION_REFUSED") ||
        message.includes("net::ERR_EMPTY_RESPONSE") ||
        message.includes("ECONNRESET") ||
        message.includes("socket hang up") ||
        message.includes("Timeout");
      if (!retryable || attempt === 2) throw error;
      await page.waitForTimeout(800 + attempt * 1200);
    }
  }
}

async function visitRouteAndCollectAssetFailures(page, route) {
  const badAssets = [];
  const mediaResponses = [];
  const onResponse = (response) => {
    const url = response.url();
    if (url.includes("/assets/") && response.status() >= 400) {
      badAssets.push({ status: response.status(), url });
    }
    if (/\.mp4(?:[?#]|$)/i.test(url)) {
      mediaResponses.push({ status: response.status(), url });
    }
  };
  page.on("response", onResponse);
  try {
    await gotoRoute(page, route);
    await page.waitForLoadState("networkidle", { timeout: networkIdleTimeoutMs }).catch(() => undefined);
    await scrollThroughPage(page);
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => undefined);
  } finally {
    page.off("response", onResponse);
  }
  return { badAssets, mediaResponses };
}

async function assertHomepageRouteTargets(page, routeCheck, failures) {
  if (!routeCheck.categoryHrefs && !routeCheck.proofHrefs && !routeCheck.proofTabHrefs) return;
  const result = await page.evaluate((expectedHrefs) => {
    const packageSection = document.querySelector("#packages");
    const anchors = [...(packageSection?.querySelectorAll("a[href]") ?? [])];
    const categoryResults = Object.entries(expectedHrefs.categoryHrefs ?? {}).map(([label, expectedHref]) => {
      const anchor = anchors.find((item) => (item.textContent || "").replace(/\s+/g, " ").trim() === label);
      return {
        label,
        expectedHref,
        actualHref: anchor?.getAttribute("href") || ""
      };
    });
    const proofSection = document.querySelector("#proof-gallery");
    const proofAnchors = [...(proofSection?.querySelectorAll("a[href]") ?? [])];
    const proofTabResults = Object.entries(expectedHrefs.proofTabHrefs ?? {}).map(([label, expectedHref]) => {
      const anchor = proofAnchors.find((item) => (item.textContent || "").replace(/\s+/g, " ").trim() === label);
      return {
        label,
        expectedHref,
        actualHref: anchor?.getAttribute("href") || ""
      };
    });
    const proofResults = Object.entries(expectedHrefs.proofHrefs ?? {}).map(([label, expectedHref]) => {
      const anchor = proofAnchors.find((item) => (item.textContent || "").replace(/\s+/g, " ").trim().startsWith(label));
      return {
        label,
        expectedHref,
        actualHref: anchor?.getAttribute("href") || ""
      };
    });
    const packageLoginCards = anchors
      .filter((anchor) => /(?:^|\/)login(?:[/?#]|$)/i.test(anchor.getAttribute("href") || ""))
      .map((anchor) => ({
        text: (anchor.textContent || "").replace(/\s+/g, " ").trim().slice(0, 90),
        href: anchor.getAttribute("href") || ""
      }));
    const proofLoginCards = proofAnchors
      .filter((anchor) => /(?:^|\/)login(?:[/?#]|$)/i.test(anchor.getAttribute("href") || ""))
      .map((anchor) => ({
        text: (anchor.textContent || "").replace(/\s+/g, " ").trim().slice(0, 90),
        href: anchor.getAttribute("href") || ""
      }));
    return { categoryResults, proofTabResults, proofResults, packageLoginCards, proofLoginCards };
  }, { categoryHrefs: routeCheck.categoryHrefs, proofTabHrefs: routeCheck.proofTabHrefs, proofHrefs: routeCheck.proofHrefs });

  for (const item of result.categoryResults) {
    if (normalizeHref(item.actualHref) !== normalizeHref(item.expectedHref)) {
      failures.push({
        site: routeCheck.site,
        route: routeCheck.route,
        type: "category_href",
        label: item.label,
        expected: item.expectedHref,
        actual: item.actualHref
      });
    }
  }
  for (const item of result.proofResults) {
    if (normalizeHref(item.actualHref) !== normalizeHref(item.expectedHref)) {
      failures.push({
        site: routeCheck.site,
        route: routeCheck.route,
        type: "proof_card_href",
        label: item.label,
        expected: item.expectedHref,
        actual: item.actualHref
      });
    }
  }
  for (const item of result.proofTabResults) {
    if (normalizeHref(item.actualHref) !== normalizeHref(item.expectedHref)) {
      failures.push({
        site: routeCheck.site,
        route: routeCheck.route,
        type: "proof_tab_href",
        label: item.label,
        expected: item.expectedHref,
        actual: item.actualHref
      });
    }
  }
  if (routeCheck.forbidPackageLoginCards && result.packageLoginCards.length) {
    failures.push({
      site: routeCheck.site,
      route: routeCheck.route,
      type: "package_cards_link_to_login",
      cards: result.packageLoginCards.slice(0, 8)
    });
  }
  if (routeCheck.proofHrefs && result.proofLoginCards.length) {
    failures.push({
      site: routeCheck.site,
      route: routeCheck.route,
      type: "proof_cards_link_to_login",
      cards: result.proofLoginCards.slice(0, 8)
    });
  }
}

async function assertFooterText(page, routeCheck, failures) {
  if (!routeCheck.footerText) return;
  const footerText = await page.locator("footer").first().textContent().catch(() => "");
  if (!String(footerText || "").includes(routeCheck.footerText)) {
    failures.push({
      site: routeCheck.site,
      route: routeCheck.route,
      type: "footer_text",
      expected: routeCheck.footerText
    });
  }
}

async function assertWorkflowNavigationHref(page, routeCheck, failures) {
  if (!routeCheck.route.endsWith(routeCheck.site)) return;
  const expectedHref = `/site/${routeCheck.site}/workflow`;
  const actualHrefs = await page.locator("a").evaluateAll((anchors) => anchors
    .filter((anchor) => /^(How it works|Como funciona)$/i.test((anchor.textContent || "").replace(/\s+/g, " ").trim()))
    .map((anchor) => anchor.getAttribute("href") || ""));
  if (!actualHrefs.length || actualHrefs.some((href) => normalizeHref(href) !== expectedHref)) {
    failures.push({
      site: routeCheck.site,
      route: routeCheck.route,
      type: "workflow_navigation_href",
      expected: expectedHref,
      actual: actualHrefs
    });
  }
}

async function assertShowcaseImageRail(page, routeCheck, failures) {
  if (!routeCheck.route.endsWith(routeCheck.site)) return;
  const result = await page.evaluate(() => {
    const section = document.querySelector("#generated-showcase");
    const rails = [...(section?.querySelectorAll(".dreamshoot-showcase-rail") ?? [])];
    const productFigureSelector = 'figure[data-dreamshoot-showcase-preview="image"], figure[data-dreamshoot-image-product-card]';
    const rail = rails.find((item) => !item.querySelector("video") && item.querySelectorAll(productFigureSelector).length >= 4);
    const railFigures = [...(rail?.querySelectorAll(productFigureSelector) ?? [])];
    const gridFigures = [...(section?.querySelectorAll(productFigureSelector) ?? [])];
    const figures = railFigures.length >= 4 ? railFigures : gridFigures;
    const images = figures.map((figure) => figure.querySelector("img")).filter(Boolean).slice(0, 4);
    return images.map((image) => {
      const frame = image.parentElement || image.closest("figure");
      const imageRect = image?.getBoundingClientRect();
      const frameRect = frame?.getBoundingClientRect();
      return {
        complete: Boolean(image?.complete),
        naturalWidth: image?.naturalWidth || 0,
        naturalHeight: image?.naturalHeight || 0,
        frameHeight: frameRect?.height || 0,
        imageHeight: imageRect?.height || 0,
        blankHeight: Math.max(0, (frameRect?.height || 0) - (imageRect?.height || 0))
      };
    });
  });
  if (result.length < 4 || result.some((item) => !item.complete || item.naturalWidth < 64 || item.naturalHeight < 64 || item.blankHeight > 4)) {
    failures.push({
      site: routeCheck.site,
      route: routeCheck.route,
      type: "showcase_image_grid_or_rail_blank_or_unloaded",
      images: result
    });
  }
}

async function assertShowcaseMotionVideos(page, routeCheck, failures, mediaResponses) {
  if (!routeCheck.checkMotionVideos) return;
  await page.locator("#generated-showcase").scrollIntoViewIfNeeded({ timeout: 30000 });
  await page.waitForTimeout(4500);
  const result = await page.evaluate(async () => {
    const section = document.querySelector("#generated-showcase");
    const videos = [...(section?.querySelectorAll('[data-showcase-card-kind="video"] video') ?? [])];
    await Promise.all(videos.map((video) => new Promise((resolve) => {
      if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        resolve();
        return;
      }
      const done = () => resolve();
      video.addEventListener("loadeddata", done, { once: true });
      video.addEventListener("canplay", done, { once: true });
      window.setTimeout(done, 3000);
    })));
    await new Promise((resolve) => window.setTimeout(resolve, 900));
    return videos.map((video) => ({
      currentSrc: video.currentSrc || video.getAttribute("src") || "",
      paused: video.paused,
      readyState: video.readyState,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      currentTime: video.currentTime,
      preload: video.preload,
      autoplay: video.autoplay,
      muted: video.muted,
      playsInline: video.playsInline
    }));
  });
  const badStatuses = (mediaResponses ?? []).filter((item) => item.status !== 200 && item.status !== 206);
  const invalidVideos = result.filter((item) => {
    const playable = item.readyState >= 2 && item.videoWidth > 0 && item.videoHeight > 0;
    const active = !item.paused || item.currentTime > 0.05;
    return !/\.mp4(?:[?#]|$)/i.test(item.currentSrc) || !playable || !active || !item.autoplay || !item.muted || !item.playsInline;
  });
  if (result.length < 1 || badStatuses.length || invalidVideos.length) {
    failures.push({
      site: routeCheck.site,
      route: routeCheck.route,
      type: "showcase_motion_videos_not_playable",
      videos: result,
      mediaResponses: (mediaResponses ?? []).slice(0, 12),
      badStatuses: badStatuses.slice(0, 12),
      invalidVideos
    });
  }
}

async function assertFeaturedPackWhitespace(page, routeCheck, failures) {
  if (!routeCheck.route.endsWith(routeCheck.site)) return;
  const result = await page.evaluate(() => {
    const sections = [...document.querySelectorAll("#featured-pack, #christmas-holiday-pack, #thanksgiving-pack")];
    return sections.map((section) => {
      const grid = [...section.querySelectorAll("div")]
        .find((item) => String(item.className || "").includes("lg:grid-cols") && item.children.length >= 2);
      const left = grid?.children?.[0];
      const right = grid?.children?.[1];
      const leftRect = left?.getBoundingClientRect();
      const rightRect = right?.getBoundingClientRect();
      return {
        id: section.id,
        leftHeight: leftRect?.height || 0,
        rightHeight: rightRect?.height || 0,
        extraBottom: Math.max(0, (leftRect?.height || 0) - (left?.scrollHeight || 0))
      };
    });
  });
  if (result.length && result.some((item) => item.extraBottom > 24)) {
    failures.push({
      site: routeCheck.site,
      route: routeCheck.route,
      type: "featured_pack_left_whitespace",
      panels: result
    });
  }
}

async function smokeFocusedStorefrontVisuals(context, routes = focusedVisualRoutes) {
  const failures = [];
  for (const routeCheck of routes) {
    const page = await context.newPage();
    try {
      const { badAssets, mediaResponses } = await visitRouteAndCollectAssetFailures(page, routeCheck.route);
      if (badAssets.length) {
        failures.push({
          site: routeCheck.site,
          route: routeCheck.route,
          type: "asset_4xx_or_5xx",
          badAssets: badAssets.slice(0, 12)
        });
      }
      await assertFooterText(page, routeCheck, failures);
      await assertWorkflowNavigationHref(page, routeCheck, failures);
      await assertHomepageRouteTargets(page, routeCheck, failures);
      await assertShowcaseImageRail(page, routeCheck, failures);
      await assertShowcaseMotionVideos(page, routeCheck, failures, mediaResponses);
      await assertFeaturedPackWhitespace(page, routeCheck, failures);
    } finally {
      await page.close();
    }
  }

  for (const routeCheck of routes.filter((item) => item.route.endsWith(item.site))) {
    const mobilePage = await context.newPage();
    try {
      await mobilePage.setViewportSize({ width: 390, height: 844 });
      await visitRouteAndCollectAssetFailures(mobilePage, routeCheck.route);
      await assertFeaturedPackWhitespace(mobilePage, routeCheck, failures);
    } finally {
      await mobilePage.close();
    }
  }

  assert(!failures.length, `Focused storefront visual/link checks failed:\n${JSON.stringify(failures, null, 2)}`);
}

async function smokeNavigationDataConsistency() {
  for (const [siteSlug, origin] of Object.entries(siteBaseUrls)) {
    try {
      const response = await fetch(origin, { method: "GET", redirect: "manual" });
      // Any HTTP response proves TLS and host routing reached an application;
      // route semantics are validated by the navigation checks below.
      void response.status;
    } catch (error) {
      const message = String(error?.message ?? error);
      const category = /SSL|TLS|certificate|protocol/i.test(message) ? "tls" : /ENOTFOUND|DNS/i.test(message) ? "dns" : "routing";
      throw new Error(`tls_preflight_failed:${siteSlug}:${category}:${message}`);
    }
  }
  const browser = await chromium.launch({ headless: true });
  const failures = [];
  try {
    const context = await browser.newContext({
      baseURL: baseUrl,
      viewport: { width: 1440, height: 1000 }
    });
    const page = await context.newPage();
    const activeSiteChecks = filterByFocusSite(siteChecks);
    const activeFocusedVisualRoutes = filterByFocusSite(focusedVisualRoutes);
    const activeWorkspaceChecks = filterByFocusSite(workspaceChecks);

    for (const site of activeSiteChecks) {
      for (const route of site.routes) {
        await gotoRoute(page, route);
        await page.waitForLoadState("networkidle", { timeout: networkIdleTimeoutMs }).catch(() => undefined);
        await assertBestPackagesDirectLink(page, site.slug, route, failures);
      }
      for (const menuCheck of menuChecks) {
        let expected;
        for (const route of site.routes.filter((candidate) => candidate === `/site/${site.slug}` || candidate.endsWith("/ai-image-generation") || candidate.endsWith("/ai-video-generation"))) {
          await gotoRoute(page, route);
          await page.waitForLoadState("networkidle", { timeout: networkIdleTimeoutMs }).catch(() => undefined);
          const signature = await extractMenuSignature(page, site.slug, route, menuCheck);
          if (!expected) {
            expected = { route, signature };
            console.log(`✓ ${site.slug} ${menuCheck.name} baseline ${route}: ${signature.length} links`);
            continue;
          }
          const expectedJson = JSON.stringify(expected.signature);
          const actualJson = JSON.stringify(signature);
          const missing = expected.signature.filter((item) => !signature.includes(item));
          const extra = signature.filter((item) => !expected.signature.includes(item));
          if (missing.length || extra.length) {
            failures.push({
              site: site.slug,
              menu: menuCheck.name,
              baselineRoute: expected.route,
              route,
              expectedCount: expected.signature.length,
              actualCount: signature.length,
              missing: missing.slice(0, 12),
              extra: extra.slice(0, 12)
            });
            console.log(`✗ ${site.slug} ${menuCheck.name} ${route}: ${signature.length} links differ from ${expected.signature.length}`);
          } else if (actualJson !== expectedJson) {
            console.log(`⚠ ${site.slug} ${menuCheck.name} ${route}: ${signature.length} links match, order differs`);
          } else {
            console.log(`✓ ${site.slug} ${menuCheck.name} ${route}: ${signature.length} links`);
          }
        }
      }
    }

    if (!skipFocusedVisuals) await smokeFocusedStorefrontVisuals(context, activeFocusedVisualRoutes);
    if (!skipWorkspaceOptions) await smokeWorkspaceOptionConsistency(context, failures, activeWorkspaceChecks);
  } finally {
    await browser.close();
  }

  assert(!failures.length, `Storefront navigation menu data drifted across routes:\n${JSON.stringify(failures, null, 2)}`);
}

smokeNavigationDataConsistency().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
