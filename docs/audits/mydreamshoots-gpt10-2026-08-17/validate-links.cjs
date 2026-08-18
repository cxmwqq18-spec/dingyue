/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const outputDir = __dirname;
const evidence = require(path.join(outputDir, "page-evidence.json"));

const occurrences = evidence.pages.flatMap((page, pageIndex) =>
  page.anchors.map((anchor) => ({
    page: pageIndex + 1,
    sourceUrl: page.finalUrl,
    region: anchor.region,
    text: anchor.text,
    rawHref: anchor.rawHref,
    href: anchor.href,
    rel: anchor.rel,
    target: anchor.target,
    renderedInDefaultState: anchor.rendered,
    samePageHash: anchor.samePageHash,
    hashTargetExists: anchor.hashTargetExists,
  })),
);

const stripHash = (href) => {
  const url = new URL(href);
  url.hash = "";
  return url.href;
};

const groupedTargets = new Map();
for (const occurrence of occurrences) {
  if (!/^https?:/.test(occurrence.href)) continue;
  const targetUrl = stripHash(occurrence.href);
  if (!groupedTargets.has(targetUrl)) groupedTargets.set(targetUrl, []);
  groupedTargets.get(targetUrl).push(occurrence);
}

async function inspectTarget(browser, targetUrl, targetOccurrences) {
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (compatible; MyDreamShootsAudit/1.0; +https://www.mydreamshoots.com)",
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  await page.route("**/*", async (route) => {
    const type = route.request().resourceType();
    if (["image", "font", "media", "stylesheet"].includes(type)) {
      await route.abort();
    } else {
      await route.continue();
    }
  });

  const result = {
    targetUrl,
    internal: new URL(targetUrl).hostname === "www.mydreamshoots.com",
    occurrences: targetOccurrences,
  };

  try {
    const response = await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await page.waitForTimeout(400);
    result.http = response
      ? {
          status: response.status(),
          statusText: response.statusText(),
          responseUrl: response.url(),
          headers: await response.allHeaders(),
        }
      : null;
    result.finalUrl = page.url();
    result.redirected = result.finalUrl !== targetUrl;
    result.document = await page.evaluate(() => {
      const clean = (value) => (value || "").replace(/\s+/g, " ").trim();
      return {
        title: document.title,
        canonical: [...document.querySelectorAll('link[rel="canonical"]')].map((link) => link.href),
        robots: [...document.querySelectorAll('meta[name="robots"]')].map((meta) => meta.content),
        h1: [...document.querySelectorAll("h1")].map((heading) => clean(heading.textContent)),
        bodyText: clean(document.body?.innerText).slice(0, 500),
      };
    });
  } catch (error) {
    result.error = error.message;
    result.finalUrl = page.url();
  } finally {
    await context.close();
  }
  return result;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const entries = [...groupedTargets.entries()];
  const targets = new Array(entries.length);
  let cursor = 0;

  async function worker(workerIndex) {
    while (cursor < entries.length) {
      const current = cursor++;
      const [targetUrl, targetOccurrences] = entries[current];
      process.stdout.write(`[worker ${workerIndex}] ${current + 1}/${entries.length} ${targetUrl}\n`);
      targets[current] = await inspectTarget(browser, targetUrl, targetOccurrences);
    }
  }

  await Promise.all(Array.from({ length: 6 }, (_, index) => worker(index + 1)));
  await browser.close();

  const hashes = occurrences
    .filter((occurrence) => occurrence.samePageHash)
    .map((occurrence) => ({
      page: occurrence.page,
      sourceUrl: occurrence.sourceUrl,
      text: occurrence.text,
      href: occurrence.href,
      targetExists: occurrence.hashTargetExists,
    }));
  const mailto = occurrences
    .filter((occurrence) => occurrence.href.startsWith("mailto:"))
    .map((occurrence) => ({
      ...occurrence,
      syntacticallyValid: /^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/i.test(occurrence.href),
    }));

  const output = {
    checkedAt: new Date().toISOString(),
    methodology: "All a[href] occurrences inventoried; HTTP(S) targets de-duplicated without fragments and opened in Playwright; same-page IDs validated from each source DOM; mailto syntax checked without sending.",
    summary: {
      totalOccurrences: occurrences.length,
      uniqueExactHref: new Set(occurrences.map((occurrence) => occurrence.href)).size,
      uniqueHttpTargetsWithoutHash: entries.length,
      samePageHashOccurrences: hashes.length,
      mailtoOccurrences: mailto.length,
    },
    targets,
    hashes,
    mailto,
  };
  fs.writeFileSync(path.join(outputDir, "link-evidence.json"), `${JSON.stringify(output, null, 2)}\n`);
})();
