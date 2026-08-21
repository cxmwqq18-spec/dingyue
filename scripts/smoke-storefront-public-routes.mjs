import { chromium } from "playwright";

const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:3002").replace(/\/$/, "");
const base = new URL(baseUrl);
const focusHost = process.env.STOREFRONT_PUBLIC_ROUTES_FOCUS_HOST || "";
const skipMediaChecks = process.env.STOREFRONT_PUBLIC_ROUTES_SKIP_MEDIA === "1";
// This change set is scoped to the two .com storefronts; .eu remains covered by the language/SSR smokes.
const routeChecks = [
  { host: "www.mydreamshoots.com", paths: ["/", "/workflow", "/ai-image-generation", "/ai-image-generation/portrait-photo", "/ai-image-generation/headshot", "/ai-image-generation/avatar", "/ai-image-generation/background-changer", "/ai-image-generation/motion-generator", "/ai-video-generation", "/ai-video-generation/talking-photo", "/ai-video-generation/story-video", "/ai-video-generation/product-ad-video", "/ai-video-generation/promo-video", "/ai-video-generation/ugc-ad-video", "/ai-video-generation/video-ad", "/best-packages", "/best-ai-image", "/best-ai-video", "/pricing", "/faq", "/login", "/about-us", "/contact-us", "/privacy", "/cookies", "/terms", "/refunds"] },
  { host: "www.aidreamcapes.com", paths: ["/", "/workflow", "/collections", "/collections/fan-scene-albums", "/collections/private-fan-scene-albums", "/collections/game-day-group-photos", "/collections/game-day-group-portraits", "/collections/christmas-holiday-albums", "/collections/christmas-group-albums", "/collections/new-year-countdown-albums", "/tools", "/tools/fan-scene-album-builder", "/tools/game-day-group-portrait-maker", "/tools/christmas-group-album-studio", "/tools/new-year-countdown-album-maker", "/tools/permission-safe-photo-planner", "/best-packages", "/best-ai-image", "/best-ai-video", "/blog/private-fan-scene-album-photo-package-guide", "/pricing", "/faq", "/login", "/about-us", "/contact-us", "/privacy", "/terms", "/cookies", "/refunds"] }
];
const imageAltRouteChecks = [
  { host: "www.mydreamshoots.com", paths: ["/", "/ai-image-generation", "/ai-image-generation/soccer", "/ai-image-generation/christmas-photo", "/ai-image-generation/avatar", "/ai-image-generation/portrait-photo", "/ai-image-generation/background-changer", "/ai-image-generation/motion-generator", "/ai-image-generation/cyberpunk", "/ai-video-generation", "/ai-video-generation/talking-photo", "/ai-video-generation/product-ad-video", "/ai-video-generation/promo-video", "/ai-video-generation/ugc-ad-video", "/ai-video-generation/video-ad", "/best-packages", "/best-ai-image", "/best-ai-video"] },
  { host: "www.aidreamcapes.com", paths: ["/", "/collections", "/collections/fan-scene-albums", "/collections/private-fan-scene-albums", "/collections/game-day-group-photos", "/collections/stadium-night-fan-sets", "/collections/christmas-group-albums", "/collections/christmas-holiday-albums", "/collections/premiere-style-portraits", "/tools", "/tools/fan-scene-album-builder", "/tools/new-year-countdown-album-maker", "/best-packages", "/best-ai-image", "/best-ai-video"] },
  { host: "aidreamshoots.eu", paths: ["/", "/collections", "/collections/world-cup-fan-photos", "/collections/anime-avatar", "/collections/profile-cards", "/collections/product-style", "/collections/ai-video-add-ons", "/tools"] },
  { host: "aidreamcapes.eu", paths: ["/", "/collections", "/collections/fan-scene-albums", "/collections/game-day-group-photos", "/collections/christmas-group-albums", "/collections/premiere-style-portraits", "/tools"] }
];
const videoLabelRouteChecks = [
  { host: "www.mydreamshoots.com", paths: ["/", "/best-ai-video"] },
  { host: "www.aidreamcapes.com", paths: ["/", "/best-ai-video"] },
  { host: "aidreamshoots.eu", paths: ["/"] },
  { host: "aidreamcapes.eu", paths: ["/"] }
];
const pathModeRouteChecks = [
  { host: "localhost", paths: ["/site/mydreamshoots/best-packages", "/site/mydreamshoots/best-ai-image", "/site/mydreamshoots/best-ai-video"] },
  { host: "localhost", paths: ["/site/aidreamcapes/best-packages", "/site/aidreamcapes/best-ai-image", "/site/aidreamcapes/best-ai-video"] }
];
const legacyRedirectChecks = [
  { host: "www.mydreamshoots.com", path: "/collections", target: "/ai-image-generation" },
  { host: "www.mydreamshoots.com", path: "/collections/engagement-photo", target: "/ai-image-generation/engagement-photo" },
  { host: "www.mydreamshoots.com", path: "/collections/headshot", target: "/ai-image-generation/headshot" },
  { host: "www.aidreamcapes.com", path: "/collections/route-portrait-albums", target: "/collections/fan-scene-albums" },
  { host: "www.aidreamcapes.com", path: "/collections/coastal-light-sets", target: "/collections/christmas-group-albums" },
  { host: "www.aidreamcapes.com", path: "/collections/old-quarter-walks", target: "/collections/premiere-style-portraits" },
  { host: "www.aidreamcapes.com", path: "/tools/route-portrait-engine", target: "/tools/fan-scene-album-builder" },
  { host: "www.aidreamcapes.com", path: "/tools/coastal-portrait", target: "/tools/christmas-group-album-studio" },
  { host: "www.aidreamcapes.com", path: "/tools/seasonal-celebration-album-maker", target: "/tools/new-year-countdown-album-maker" },
  { host: "www.aidreamcapes.com", path: "/blog/fan-scene-photo-albums-guide", target: "/blog/private-fan-scene-album-photo-package-guide" },
  { host: "www.aidreamcapes.com", path: "/blog/game-day-group-portraits-guide", target: "/blog/game-day-group-portraits-photo-package-guide" },
  { host: "www.aidreamcapes.com", path: "/blog/holiday-memory-albums-guide", target: "/blog/christmas-group-album-photo-package-guide" }
];
const legacyGoneChecks = [
  { host: "www.mydreamshoots.com", path: "/tools" },
  { host: "www.mydreamshoots.com", path: "/collections/wedding-portraits" },
  { host: "www.mydreamshoots.com", path: "/collections/profile-cards" },
  { host: "www.mydreamshoots.com", path: "/collections/headshots" },
  { host: "www.mydreamshoots.com", path: "/collections/ai-video-add-ons" },
  { host: "www.mydreamshoots.com", path: "/ai-photoshoot" },
  { host: "www.mydreamshoots.com", path: "/ai-photoshoot/professional/headshot" },
  { host: "www.mydreamshoots.com", path: "/ai-image-generation/professional" },
  { host: "www.mydreamshoots.com", path: "/ai-image-generation/professional/headshot" },
  { host: "www.mydreamshoots.com", path: "/ai-video-generation/text-to-video" },
  { host: "www.mydreamshoots.com", path: "/ai-video-generation/image-to-video" },
  { host: "www.mydreamshoots.com", path: "/ai-video-generation/profile-clip" },
  { host: "www.mydreamshoots.com", path: "/tools/image-to-video" },
  { host: "www.mydreamshoots.com", path: "/tool" }
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hostMatchesFocus(host) {
  return !focusHost || host === focusHost;
}

function pathModeMatchesFocus(pathName) {
  if (!focusHost) return true;
  if (focusHost === "www.mydreamshoots.com") return pathName.startsWith("/site/mydreamshoots/");
  if (focusHost === "www.aidreamcapes.com") return pathName.startsWith("/site/aidreamcapes/");
  return true;
}

function requestHeadersForHost(host) {
  const headers = { Host: host, "x-forwarded-host": host };
  if (base.port) headers["x-forwarded-port"] = base.port;
  return headers;
}

async function requestGetWithRetry(request, url, options, attempts = 5) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await request.get(url, options);
    } catch (error) {
      lastError = error;
      const message = String(error?.message ?? error);
      const retryable = /ECONNREFUSED|ECONNRESET|socket hang up|Target page, context or browser has been closed|Timeout/i.test(message);
      if (!retryable || attempt === attempts - 1) throw error;
      await wait(900 * (attempt + 1));
    }
  }
  throw lastError;
}

function normalizeHostPath(host, href) {
  try {
    const url = new URL(href, `https://${host}`);
    if (url.hostname !== host) return undefined;
    return `${url.pathname}${url.search}`;
  } catch {
    return undefined;
  }
}

function redirectLocationUsesPublicHost(host, location) {
  if (!/^https?:\/\//i.test(location)) return true;
  try {
    return new URL(location).hostname === host;
  } catch {
    return false;
  }
}

function canonicalMediaSrc(value) {
  const src = decodeHtmlAttribute(value);
  try {
    return new URL(src, baseUrl).pathname;
  } catch {
    return src.split(/[?#]/)[0] || src;
  }
}

async function statusForPath(request, host, path) {
  const response = await requestGetWithRetry(request, `${baseUrl}${path}`, {
    headers: requestHeadersForHost(host),
    maxRedirects: 0,
    timeout: 60000
  });
  return response.status();
}

async function redirectForPath(request, host, path) {
  return requestGetWithRetry(request, `${baseUrl}${path}`, {
    headers: requestHeadersForHost(host),
    maxRedirects: 0,
    timeout: 60000
  });
}

async function collectInternalLinks(request, host, path) {
  const response = await requestGetWithRetry(request, `${baseUrl}${path}`, {
    headers: requestHeadersForHost(host),
    timeout: 60000
  });
  if (response.status() >= 400) return [];
  const html = await response.text();
  const paths = new Set();
  for (const match of html.matchAll(/\bhref=["']([^"']+)["']/g)) {
    const href = match[1];
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) continue;
    const linkPath = normalizeHostPath(host, href);
    if (linkPath) paths.add(linkPath);
  }
  return Array.from(paths);
}

function decodeHtmlAttribute(value) {
  return String(value ?? "")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function attributesForTag(tag) {
  const attrs = new Map();
  for (const match of tag.matchAll(/([A-Za-z_:][-A-Za-z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    const [, name, doubleValue, singleValue, bareValue] = match;
    attrs.set(name.toLowerCase(), decodeHtmlAttribute(doubleValue ?? singleValue ?? bareValue ?? ""));
  }
  return attrs;
}

function isDecorativeImage(attrs) {
  const role = String(attrs.get("role") ?? "").toLowerCase();
  return attrs.get("aria-hidden") === "true" || role === "presentation" || role === "none";
}

function isSeoMediaImage(src) {
  const normalized = String(src ?? "");
  if (/\/brand(?:\/|$)/i.test(normalized)) return false;
  return /\/assets\/(?:dreamshoot\/generated|sites\/site_aidreamcapes(?:_eu)?\/(?:creative-packs|fan-holiday-theme)|sites\/site_mydreamshoots|sites\/site_aidreamshoots)/i.test(normalized);
}

function isSpanishSeoHost(host) {
  return /\.eu$/i.test(String(host ?? ""));
}

function imageSourceThemeKey(value) {
  const path = String(value ?? "").split("?")[0]?.split("#")[0] ?? "";
  const filename = path.split("/").filter(Boolean).at(-1) ?? "";
  return filename
    .replace(/\.(?:png|jpe?g|webp|avif|svg)$/i, "")
    .replace(/-\d{2}$/i, "")
    .toLowerCase();
}

const themedSeoAltRules = [
  {
    forbidden: /\b(?:football|stadium|world cup|match-day|holiday album|wedding)\b/i,
    required: /\b(?:anime|avatar|stylized|character)\b/i,
    source: /anime-avatar/i
  },
  {
    forbidden: /\b(?:football|stadium|world cup|match-day)\b/i,
    required: /\b(?:profile|avatar|personal-brand|social)\b/i,
    source: /profile-cards/i
  },
  {
    forbidden: /\b(?:football|stadium|world cup|match-day)\b/i,
    required: /\b(?:product|producto|commerce|comercio|studio|estudio|lifestyle|estilo de vida)\b/i,
    source: /product-style/i
  },
  {
    forbidden: /\b(?:football|stadium|world cup|wedding)\b/i,
    required: /\b(?:video|motion|clip|starter frame)\b/i,
    source: /ai-video-add-ons/i
  },
  {
    forbidden: /\b(?:product-style|anime|wedding)\b/i,
    required: /\b(?:soccer|world cup|football|stadium|fan|supporter|mundial|futbol|hincha|aficionado)\b/i,
    source: /world-cup-fan-photos/i
  },
  {
    forbidden: /\b(?:seasonal celebration|holiday album|world cup)\b/i,
    required: /\b(?:premiere|red-carpet|event|alfombra roja|estreno|vip)\b/i,
    source: /premiere-style-portraits|premiere-flash-portraits|vip-arrival|award-night|spotlight/i
  },
  {
    forbidden: /\b(?:football fan portrait|stadium supporter|world cup)\b/i,
    required: /\b(?:christmas|holiday|seasonal|thanksgiving|halloween|winter|festive|navidad|temporada|celebracion)\b/i,
    source: /christmas|holiday|thanksgiving|friendsgiving|gratitude|halloween|spooky|costume|cozy|winter|new-year|family-occasion/i
  },
  {
    forbidden: /\b(?:world cup|football fan portrait in a stadium crowd)\b/i,
    required: /\b(?:fan-scene|supporter|aficionados|seguidor|private fan|album)\b/i,
    source: /fan-scene|supporter-photo|fan-letter|fan-keepsake|backstage|birthday-fan|fan-card/i
  },
  {
    forbidden: /\b(?:seasonal celebration|holiday album|red-carpet)\b/i,
    required: /\b(?:football|stadium|game-day|supporter)\b/i,
    source: /stadium-night-fan-sets|game-day-group|watch-party|championship|tunnel-entrance/i
  }
];

function invalidThemeAltReason(attrs) {
  if (isDecorativeImage(attrs)) return undefined;
  const src = attrs.get("src") || attrs.get("data-src") || "";
  if (!isSeoMediaImage(src)) return undefined;
  const normalized = String(attrs.get("alt") ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return undefined;
  const sourceKey = imageSourceThemeKey(src);
  const rule = themedSeoAltRules.find((candidate) => candidate.source.test(sourceKey));
  if (!rule) return undefined;
  if (rule.forbidden.test(normalized)) return "theme_conflict_alt";
  if (!rule.required.test(normalized)) return "theme_missing_alt";
  return undefined;
}

function invalidAltReason(host, attrs) {
  const alt = attrs.get("alt");
  const src = attrs.get("src") || attrs.get("data-src") || "";
  const normalized = String(alt ?? "").replace(/\s+/g, " ").trim();
  const seoMedia = isSeoMediaImage(src);
  if (!normalized) return isDecorativeImage(attrs) ? undefined : "empty_alt";
  if (/https?:\/\/|\/assets\//i.test(normalized)) return "url_in_alt";
  if (/background layer/i.test(normalized)) return "decorative_background_alt";
  if (/^(?:image|photo|picture|preview|thumbnail|hero|undefined|null|n\/a)$/i.test(normalized)) return "placeholder_alt";
  if (/(?:^|,)\s*(?:featured pack image|package image|gallery image|image preview|photo preview|gallery preview|package preview)\s*\.?$/i.test(normalized)) return "placeholder_alt";
  if (/\b(?:visual reference|gallery image|gallery example|package gallery|image\s+\d+|for browsing|for review)\b/i.test(normalized)) return "template_alt";
  if (seoMedia && /\b(?:mydreamshoots|mydreamshoots\.com|aidreamshoots|aidreamcapes)\b/i.test(normalized)) return "brand_in_alt";
  if (isSpanishSeoHost(host) && /\b(?:AI-generated|customer-created|featured package image|gallery example|package gallery example|package preview|private gallery)\b/i.test(normalized)) return "mixed_language_alt";
  if (host.includes("aidreamcapes") && /MyDreamShoots|DreamShootAI|DreamShoot/i.test(normalized)) return "cross_brand_alt";
  if (host.includes("aidreamshoots") && /MyDreamShoots|AIdreamcapes|Aidreamcapes|DreamShootAI/i.test(normalized)) return "cross_brand_alt";
  if (host.includes("mydreamshoots") && /Aidreamcapes/i.test(normalized)) return "cross_brand_alt";
  return undefined;
}

function invalidVideoLabelReason(host, attrs) {
  const label = attrs.get("aria-label") || attrs.get("title");
  const normalized = String(label ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return "empty_video_label";
  if (/https?:\/\/|\/assets\//i.test(normalized)) return "url_in_video_label";
  if (/background layer/i.test(normalized)) return "decorative_background_label";
  if (/^(?:play|reproducir)$/i.test(normalized)) return "placeholder_video_label";
  if (isSpanishSeoHost(host)) {
    if (/\b(?:AI-generated|Play|with sound|private gallery preview|customer frames|Cinematic Portrait Motion|Holiday Card Motion|Product Showcase Motion|Prompt Directed Motion|Social Profile Clip|Travel Route Story|Wedding Memory Film)\b/i.test(normalized)) {
      return "mixed_language_video_label";
    }
  }
  return undefined;
}

async function imageAltFailuresForPath(request, host, path) {
  const response = await requestGetWithRetry(request, `${baseUrl}${path}`, {
    headers: requestHeadersForHost(host),
    timeout: 60000
  });
  if (response.status() >= 400) return [{ host, path, status: response.status(), reason: "image_alt_page_unavailable" }];
  const html = await response.text();
  const failures = [];
  const seenMediaAlts = new Map();
  let index = 0;
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    index += 1;
    const attrs = attributesForTag(match[0]);
    const alt = attrs.get("alt");
    const src = attrs.get("src") || attrs.get("data-src") || "";
    const reason = attrs.has("alt")
      ? invalidAltReason(host, attrs) ?? invalidThemeAltReason(attrs)
      : "missing_alt";
    if (reason) {
      failures.push({
        host,
        path,
        index,
        src,
        alt: alt ?? "",
        reason
      });
      continue;
    }
    const normalizedAlt = String(alt ?? "").replace(/\s+/g, " ").trim().toLowerCase();
    if (!normalizedAlt || !isSeoMediaImage(src) || isDecorativeImage(attrs)) continue;
    const existing = seenMediaAlts.get(normalizedAlt);
    const canonicalSrc = canonicalMediaSrc(src);
    if (existing && existing.canonicalSrc !== canonicalSrc) {
      failures.push({
        host,
        path,
        index,
        src,
        alt,
        reason: "duplicate_media_alt",
        duplicateOf: existing.src
      });
    } else {
      seenMediaAlts.set(normalizedAlt, { src, canonicalSrc, index });
    }
  }
  return failures;
}

async function videoLabelFailuresForPath(request, host, path) {
  const response = await requestGetWithRetry(request, `${baseUrl}${path}`, {
    headers: requestHeadersForHost(host),
    timeout: 60000
  });
  if (response.status() >= 400) return [{ host, path, status: response.status(), reason: "video_label_page_unavailable" }];
  const html = await response.text();
  const failures = [];
  let index = 0;
  for (const match of html.matchAll(/<(video|figure)\b[^>]*>/gi)) {
    const tag = match[0];
    if (!/^\<figure\b/i.test(tag) && !/^\<video\b/i.test(tag)) continue;
    if (/^\<figure\b/i.test(tag) && !/data-dreamshoot-showcase-preview=["']video["']/i.test(tag)) continue;
    index += 1;
    const attrs = attributesForTag(tag);
    const reason = invalidVideoLabelReason(host, attrs);
    if (reason) {
      failures.push({
        host,
        path,
        index,
        label: attrs.get("aria-label") || attrs.get("title") || "",
        reason
      });
    }
  }
  return failures;
}

async function smokeStorefrontPublicRoutes() {
  const browser = await chromium.launch({ headless: true });
  const failures = [];
  try {
    const context = await browser.newContext({ baseURL: baseUrl, viewport: { width: 1440, height: 900 } });
    const request = context.request;

    for (const check of routeChecks.filter((item) => hostMatchesFocus(item.host))) {
      const paths = new Set(check.paths);
      for (const path of check.paths.slice(0, 6)) {
        for (const linkPath of await collectInternalLinks(request, check.host, path).catch(() => [])) {
          if (/^\/(?:site|api|platform|_next)(?:\/|$)/.test(linkPath)) continue;
          paths.add(linkPath);
        }
      }
      for (const path of Array.from(paths).sort()) {
        const status = await statusForPath(request, check.host, path).catch(() => 599);
        if (status === 404) failures.push({ host: check.host, path, status });
        if (status < 400 || [301, 302, 303, 307, 308, 401].includes(status)) {
          console.log(`✓ ${check.host}${path} -> ${status}`);
        } else {
          console.log(`✗ ${check.host}${path} -> ${status}`);
        }
      }
    }
    for (const check of legacyRedirectChecks.filter((item) => hostMatchesFocus(item.host))) {
      const response = await redirectForPath(request, check.host, check.path).catch(() => undefined);
      const status = response?.status() ?? 599;
      const location = response?.headers().location ?? "";
      if (![301, 302, 307, 308].includes(status) || !location.includes(check.target) || !redirectLocationUsesPublicHost(check.host, location)) {
        failures.push({ host: check.host, path: check.path, status, expectedRedirect: check.target, location });
        console.log(`✗ ${check.host}${check.path} -> ${status} ${location}`);
      } else {
        console.log(`✓ ${check.host}${check.path} -> ${status} ${location}`);
      }
    }
    for (const check of legacyGoneChecks.filter((item) => hostMatchesFocus(item.host))) {
      const status = await statusForPath(request, check.host, check.path).catch(() => 599);
      if (status !== 404) {
        failures.push({ host: check.host, path: check.path, status, expected: 404 });
        console.log(`✗ ${check.host}${check.path} -> ${status}`);
      } else {
        console.log(`✓ ${check.host}${check.path} -> 404`);
      }
    }
    for (const check of pathModeRouteChecks.filter((item) => hostMatchesFocus(item.host) || item.host === "localhost")) {
      for (const path of check.paths.filter(pathModeMatchesFocus)) {
        const status = await statusForPath(request, check.host, path).catch(() => 599);
        if (status >= 400 && ![401].includes(status)) failures.push({ host: check.host, path, status });
        if (status < 400 || status === 401) {
          console.log(`✓ ${check.host}${path} -> ${status}`);
        } else {
          console.log(`✗ ${check.host}${path} -> ${status}`);
        }
      }
    }
    if (!skipMediaChecks) {
      for (const check of imageAltRouteChecks.filter((item) => hostMatchesFocus(item.host))) {
        for (const path of check.paths) {
          const imageFailures = await imageAltFailuresForPath(request, check.host, path).catch((error) => [{ host: check.host, path, status: 599, reason: error.message }]);
          failures.push(...imageFailures);
          if (imageFailures.length) {
            console.log(`✗ ${check.host}${path} image alt -> ${imageFailures.length} failure(s)`);
          } else {
            console.log(`✓ ${check.host}${path} image alt`);
          }
        }
      }
      for (const check of videoLabelRouteChecks.filter((item) => hostMatchesFocus(item.host))) {
        for (const path of check.paths) {
          const videoFailures = await videoLabelFailuresForPath(request, check.host, path).catch((error) => [{ host: check.host, path, status: 599, reason: error.message }]);
          failures.push(...videoFailures);
          if (videoFailures.length) {
            console.log(`✗ ${check.host}${path} video label -> ${videoFailures.length} failure(s)`);
          } else {
            console.log(`✓ ${check.host}${path} video label`);
          }
        }
      }
    }
  } finally {
    await browser.close();
  }

  assert(!failures.length, `Found storefront route failures: ${JSON.stringify(failures, null, 2)}`);
}

smokeStorefrontPublicRoutes().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
