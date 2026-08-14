import { chromium } from "playwright";

const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:3002").replace(/\/$/, "");
const pageTimeoutMs = Number(process.env.STOREFRONT_NAV_PAGE_TIMEOUT_MS ?? 90_000);
const networkIdleTimeoutMs = Number(process.env.STOREFRONT_NAV_NETWORK_IDLE_TIMEOUT_MS ?? 20_000);

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
      "/site/mydreamshoots/collections",
      "/site/mydreamshoots/collections/portrait-photo",
      "/site/mydreamshoots/tools",
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
    buttonName: /AI Photoshoot|Headshot Generator|Photoshoot Studio|Browse packages|Occasion Albums|Photo Packages|Ver paquetes|Paquetes de ocasion/i
  },
  {
    name: "tools",
    buttonName: /^(AI Tools|Tools|Herramientas)$/
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
    expectedToolCount: 28,
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
      Christmas: "/site/mydreamshoots/collections/christmas-photo",
      Thanksgiving: "/site/mydreamshoots/collections/thanksgiving-photo",
      Halloween: "/site/mydreamshoots/collections/halloween-photo",
      Seasonal: "/site/mydreamshoots/collections/holiday",
      Creator: "/site/mydreamshoots/collections/portrait-photo",
      Video: "/site/mydreamshoots/collections/motion-generator",
      Utility: "/site/mydreamshoots/collections/photo-enhancer"
    }
  },
  {
    site: "mydreamshoots",
    route: "/site/mydreamshoots/collections"
  },
  {
    site: "mydreamshoots",
    route: "/site/mydreamshoots/collections/thanksgiving-photo"
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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeHref(value) {
  return String(value || "").replace(baseUrl, "").replace(/\/$/, "");
}

function normalizeSignatureHref(value, siteSlug) {
  const href = normalizeHref(value);
  if (href.startsWith("/collections/") || href === "/collections") return `/site/${siteSlug}${href}`;
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
  const button = page.locator('nav button[aria-haspopup="dialog"]').filter({ hasText: menuCheck.buttonName }).first();
  await button.waitFor({ state: "visible", timeout: 30000 });
  const controlId = await button.getAttribute("aria-controls");
  const items = await page.evaluate(
    ({ currentSiteSlug, currentMenuName, currentControlId }) => {
      const panel = currentControlId
        ? document.getElementById(currentControlId)
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
            return item.href.includes(`/site/${currentSiteSlug}/collections/`) || item.href.startsWith("/collections/");
          }
          return item.href.includes(`/site/${currentSiteSlug}/tools/`) || item.href.startsWith("/tools/");
      });
      return links;
    },
    { currentSiteSlug: siteSlug, currentMenuName: menuCheck.name, currentControlId: controlId }
  );
  await page.keyboard.press("Escape").catch(() => undefined);
  const signature = signatureFromItems(items, siteSlug);
  assert(signature.length > 0, `${siteSlug} ${route} ${menuCheck.name}: no menu item links were found`);
  return signature;
}

async function assertBestPackagesDirectLink(page, siteSlug, route, failures) {
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

async function smokeWorkspaceOptionConsistency(context, failures) {
  const page = await context.newPage();
  try {
    for (const workspaceCheck of workspaceChecks) {
      if (!(await loginWorkspaceCustomer(context, workspaceCheck))) continue;
      await page.goto(`/site/${workspaceCheck.slug}`, { waitUntil: "domcontentloaded", timeout: pageTimeoutMs });
      await page.waitForLoadState("networkidle", { timeout: networkIdleTimeoutMs }).catch(() => undefined);
      const packageMenuSignature = await extractMenuSignature(page, workspaceCheck.slug, `/site/${workspaceCheck.slug}`, menuChecks[0]);
      const toolMenuSignature = await extractMenuSignature(page, workspaceCheck.slug, `/site/${workspaceCheck.slug}`, menuChecks[1]);
      const workspacePackageSignature = await extractWorkspacePackageSignature(page, workspaceCheck.slug);
      const workspaceToolSignature = await extractWorkspaceToolSignature(page, workspaceCheck.slug);

      if (workspacePackageSignature.length !== workspaceCheck.expectedPackageCount) {
        failures.push({ site: workspaceCheck.slug, surface: "workspace_packages_count", expected: workspaceCheck.expectedPackageCount, actual: workspacePackageSignature.length });
      }
      if (workspaceToolSignature.length !== workspaceCheck.expectedToolCount) {
        failures.push({ site: workspaceCheck.slug, surface: "workspace_tools_count", expected: workspaceCheck.expectedToolCount, actual: workspaceToolSignature.length });
      }
      pushSignatureFailure(failures, {
        site: workspaceCheck.slug,
        surface: "workspace_packages",
        expected: packageMenuSignature,
        actual: workspacePackageSignature,
        requireOrder: false,
        normalizeItem: normalizeWorkspaceSignatureItem
      });
      pushSignatureFailure(failures, {
        site: workspaceCheck.slug,
        surface: "workspace_tools",
        expected: toolMenuSignature,
        actual: workspaceToolSignature,
        requireOrder: false,
        normalizeItem: normalizeWorkspaceSignatureItem
      });
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
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await page.goto(route, { waitUntil: "domcontentloaded", timeout: pageTimeoutMs });
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

async function smokeFocusedStorefrontVisuals(context) {
  const failures = [];
  for (const routeCheck of focusedVisualRoutes) {
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

  for (const routeCheck of focusedVisualRoutes.filter((item) => item.route.endsWith(item.site))) {
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
  const browser = await chromium.launch({ headless: true });
  const failures = [];
  try {
    const context = await browser.newContext({
      baseURL: baseUrl,
      viewport: { width: 1440, height: 1000 }
    });
    const page = await context.newPage();

    for (const site of siteChecks) {
      for (const route of site.routes) {
        await gotoRoute(page, route);
        await page.waitForLoadState("networkidle", { timeout: networkIdleTimeoutMs }).catch(() => undefined);
        await assertBestPackagesDirectLink(page, site.slug, route, failures);
      }
      for (const menuCheck of menuChecks) {
        let expected;
        for (const route of site.routes) {
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

    await smokeFocusedStorefrontVisuals(context);
    await smokeWorkspaceOptionConsistency(context, failures);
  } finally {
    await browser.close();
  }

  assert(!failures.length, `Storefront navigation menu data drifted across routes:\n${JSON.stringify(failures, null, 2)}`);
}

smokeNavigationDataConsistency().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
