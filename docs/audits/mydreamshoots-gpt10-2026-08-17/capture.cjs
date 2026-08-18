/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const urls = [
  "https://www.mydreamshoots.com/blog/cyberpunk-photo-package-guide",
  "https://www.mydreamshoots.com/blog/mafia-photo-package-guide",
  "https://www.mydreamshoots.com/blog/magic-upscaler-photo-package-guide",
  "https://www.mydreamshoots.com/blog/nature-photo-package-guide",
  "https://www.mydreamshoots.com/blog/outdoor-creator-scenes-photo-package-guide",
  "https://www.mydreamshoots.com/blog/valentine-photos-photo-package-guide",
  "https://www.mydreamshoots.com/blog/virtual-try-on-photo-package-guide",
  "https://www.mydreamshoots.com/blog/wedding-portraits-photo-package-guide",
  "https://www.mydreamshoots.com/blog/world-cup-fan-photos-photo-package-guide",
];

const outputDir = __dirname;
const screenshotDir = path.join(outputDir, "screenshots");
fs.mkdirSync(screenshotDir, { recursive: true });

async function capturePage(page, requestedUrl, index) {
  const consoleMessages = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type())) {
      consoleMessages.push({ type: message.type(), text: message.text() });
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const response = await page.goto(requestedUrl, {
    waitUntil: "networkidle",
    timeout: 90_000,
  });

  const evidence = await page.evaluate(() => {
    const clean = (value) => (value || "").replace(/\s+/g, " ").trim();
    const regionOf = (element) => {
      if (element.closest("header")) return "header";
      if (element.closest("footer")) return "footer";
      if (element.closest("article")) return "article";
      if (element.closest("main")) return "main";
      return "other";
    };
    const rendered = (element) => {
      let current = element;
      while (current && current.nodeType === Node.ELEMENT_NODE) {
        const style = getComputedStyle(current);
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          Number.parseFloat(style.opacity || "1") === 0
        ) return false;
        current = current.parentElement;
      }
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const elementText = (element) => {
      const imageAlt = [...element.querySelectorAll("img")]
        .map((image) => clean(image.alt))
        .filter(Boolean)
        .join(" | ");
      const svgLabel = [...element.querySelectorAll("svg")]
        .map((svg) => clean(svg.getAttribute("aria-label")))
        .filter(Boolean)
        .join(" | ");
      return clean(
        element.innerText ||
        element.textContent ||
        element.getAttribute("aria-label") ||
        element.getAttribute("title") ||
        imageAlt ||
        svgLabel,
      );
    };
    const metadata = (selector, attribute = "content") =>
      [...document.querySelectorAll(selector)].map((element) => element.getAttribute(attribute));

    const structuredData = [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map((script, scriptIndex) => {
        try {
          return { scriptIndex, parsed: JSON.parse(script.textContent) };
        } catch (error) {
          return { scriptIndex, parseError: error.message, raw: script.textContent };
        }
      });

    const anchors = [...document.querySelectorAll("a[href]")].map((anchor, anchorIndex) => {
      const rect = anchor.getBoundingClientRect();
      let parsed;
      try {
        parsed = new URL(anchor.href);
      } catch {
        parsed = null;
      }
      const sameDocument = parsed && parsed.origin === location.origin && parsed.pathname === location.pathname;
      return {
        anchorIndex,
        region: regionOf(anchor),
        text: elementText(anchor),
        rawHref: anchor.getAttribute("href"),
        href: anchor.href,
        rel: anchor.getAttribute("rel") || "",
        target: anchor.getAttribute("target") || "",
        rendered: rendered(anchor),
        bbox: {
          x: Math.round(rect.x),
          y: Math.round(rect.y + scrollY),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
        samePageHash: sameDocument && parsed.hash ? parsed.hash : "",
        hashTargetExists: sameDocument && parsed.hash
          ? Boolean(document.getElementById(decodeURIComponent(parsed.hash.slice(1))))
          : null,
        html: anchor.outerHTML.slice(0, 1200),
      };
    });

    const article = document.querySelector("article");
    const main = document.querySelector("main");
    const contentRoot = article || main;
    const orderedContent = contentRoot
      ? [...contentRoot.querySelectorAll("h1,h2,h3,p,li,table")].map((element, contentIndex) => ({
          contentIndex,
          tag: element.tagName,
          id: element.id || "",
          text: clean(element.innerText),
        }))
      : [];

    const factPattern = /(?:\$|\b(?:credit|credits|price|pricing|refund|money.back|guarantee|private|privacy|delete|days?|hours?|minutes?|images?|photos?|downloads?|train|training|encrypt|aes|tls|review|rating|stars?|best|instant|viral)\b)/i;
    const visibleFacts = orderedContent.filter((item) => factPattern.test(item.text));

    return {
      finalUrl: location.href,
      documentReadyState: document.readyState,
      html: {
        lang: document.documentElement.lang,
        translate: document.documentElement.getAttribute("translate"),
        className: document.documentElement.className,
      },
      head: {
        title: document.title,
        titleCount: document.querySelectorAll("title").length,
        metaDescription: metadata('meta[name="description"]'),
        robots: metadata('meta[name="robots"]'),
        googlebot: metadata('meta[name="googlebot"]'),
        googleTranslate: metadata('meta[name="google"]'),
        canonical: metadata('link[rel="canonical"]', "href"),
        hreflang: [...document.querySelectorAll('link[rel="alternate"][hreflang]')].map((link) => ({
          hreflang: link.hreflang,
          href: link.href,
        })),
        openGraph: [...document.querySelectorAll('meta[property^="og:"]')].map((meta) => ({
          property: meta.getAttribute("property"),
          content: meta.content,
        })),
        twitter: [...document.querySelectorAll('meta[name^="twitter:"]')].map((meta) => ({
          name: meta.name,
          content: meta.content,
        })),
      },
      headings: [...document.querySelectorAll("h1,h2,h3")].map((heading) => ({
        tag: heading.tagName,
        id: heading.id,
        text: clean(heading.innerText),
        region: regionOf(heading),
      })),
      article: article ? {
        text: clean(article.innerText),
        wordCount: clean(article.innerText).split(/\s+/).filter(Boolean).length,
        orderedContent,
      } : null,
      mainText: main ? clean(main.innerText) : "",
      visibleFacts,
      anchors,
      buttons: [...document.querySelectorAll("button")].map((button, buttonIndex) => ({
        buttonIndex,
        region: regionOf(button),
        text: elementText(button),
        type: button.type,
        disabled: button.disabled,
        rendered: rendered(button),
        html: button.outerHTML.slice(0, 1200),
      })),
      images: [...document.querySelectorAll("img")].map((image, imageIndex) => ({
        imageIndex,
        region: regionOf(image),
        alt: image.alt,
        src: image.src,
        currentSrc: image.currentSrc,
        width: image.width,
        height: image.height,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        loading: image.loading,
        rendered: rendered(image),
      })),
      times: [...document.querySelectorAll("time")].map((time) => ({
        text: clean(time.innerText),
        dateTime: time.dateTime,
      })),
      structuredData,
    };
  });

  evidence.requestedUrl = requestedUrl;
  evidence.http = response
    ? {
        status: response.status(),
        statusText: response.statusText(),
        url: response.url(),
        headers: await response.allHeaders(),
      }
    : null;
  evidence.consoleMessages = consoleMessages;
  evidence.pageErrors = pageErrors;

  const slug = new URL(requestedUrl).pathname.split("/").filter(Boolean).pop();
  const screenshot = `${String(index + 1).padStart(2, "0")}-${slug}.png`;
  await page.screenshot({ path: path.join(screenshotDir, screenshot), fullPage: true });
  evidence.screenshot = `screenshots/${screenshot}`;
  return evidence;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    userAgent: "Mozilla/5.0 (compatible; MyDreamShootsAudit/1.0; +https://www.mydreamshoots.com)",
  });

  const pages = [];
  for (const [index, url] of urls.entries()) {
    const page = await context.newPage();
    process.stdout.write(`[${index + 1}/${urls.length}] ${url}\n`);
    try {
      pages.push(await capturePage(page, url, index));
    } catch (error) {
      pages.push({ requestedUrl: url, captureError: error.stack || error.message });
    } finally {
      await page.close();
    }
  }
  await browser.close();

  const output = {
    capturedAt: new Date().toISOString(),
    methodology: "Playwright Chromium, desktop viewport 1440x1000, strict list order",
    pages,
  };
  fs.writeFileSync(path.join(outputDir, "page-evidence.json"), `${JSON.stringify(output, null, 2)}\n`);
})();
