import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import ffmpegStatic from "ffmpeg-static";
import { chromium } from "playwright";
import sharp from "sharp";
import "./load-runtime-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const baseUrl = (process.env.TUTORIAL_BASE_URL || "https://www.mydreamshoots.com").replace(/\/$/, "");
const siteId = process.env.TUTORIAL_SITE_ID || "site_dreamshoot";
const siteSlug = process.env.TUTORIAL_SITE_SLUG || "mydreamshoots";
const outputDir = path.resolve(repoRoot, process.env.TUTORIAL_OUTPUT_DIR || "output");
const runDir = path.join(outputDir, "mydreamshoots-i2v-tutorial-real-work");
const framesDir = path.join(runDir, "frames");
const samplesDir = path.join(runDir, "samples");
const cleanFramePath = path.join(runDir, "source-frame-clean.jpg");
const finalOutputPath = path.resolve(repoRoot, process.env.TUTORIAL_OUTPUT_MP4 || "output/mydreamshoots-i2v-tutorial-20260802.mp4");
const providerResultPath = path.join(runDir, "supplier-result.mp4");
const failurePath = path.join(runDir, "failure-status.json");
const contactSheetPath = path.join(runDir, "verification-contact-sheet.jpg");

const viewport = { width: 1920, height: 1080 };
const captureFps = Number(process.env.TUTORIAL_CAPTURE_FPS || 10);
const headless = process.env.TUTORIAL_HEADLESS !== "0";
const maxAttempts = Math.max(1, Number(process.env.TUTORIAL_MAX_ATTEMPTS || 3));
const jobTimeoutMs = Math.max(60_000, Number(process.env.TUTORIAL_JOB_TIMEOUT_MS || 1_800_000));
const pollIntervalMs = Math.max(5_000, Number(process.env.TUTORIAL_POLL_INTERVAL_MS || 12_000));
const pageTimeoutMs = Math.max(30_000, Number(process.env.TUTORIAL_PAGE_TIMEOUT_MS || 120_000));
const skipRealGeneration = process.env.TUTORIAL_REAL_GENERATION !== "1";
const ffmpegPath = process.env.FFMPEG_PATH || ffmpegStatic || "ffmpeg";
const ffprobePath = process.env.FFPROBE_PATH || siblingFfprobe(ffmpegPath) || "ffprobe";

const promptText = `Create a 6-second image-to-video clip from the selected frame. Keep the adult creator's face, hair, outfit, warm studio lighting, microphone, laptop, and background consistent. Add a slow 35mm push-in, gentle hair movement, subtle lamp glow, natural blinking, and a calm confident expression. No extra people, no logos, no watermark, no captions, no distorted hands. End on a steady close frame.`;

const captions = {
  login: "Sign in to your private workspace",
  workspace: "Open the Image to Video workspace",
  upload: "Upload a frame image for motion",
  prompt: "Describe the clip with clear motion direction",
  generate: "Generate with the active video provider",
  progress: "Your request runs securely in your account",
  result: "Preview and download the finished video"
};

function siblingFfprobe(binary) {
  if (!binary || binary === "ffmpeg") return undefined;
  const candidate = path.join(path.dirname(binary), "ffprobe");
  return fsSync.existsSync(candidate) ? candidate : undefined;
}

function isLocalBaseUrl() {
  const hostname = new URL(baseUrl).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0" || hostname.endsWith(".localhost");
}

function sitePath(pathname) {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return isLocalBaseUrl() ? `/site/${siteSlug}${normalized}` : normalized;
}

function absoluteUrl(pathname) {
  return new URL(sitePath(pathname), `${baseUrl}/`).toString();
}

function apiUrl(pathname) {
  return new URL(pathname, `${baseUrl}/`).toString();
}

function pushCredential(list, email, password, source) {
  if (!email || !password) return;
  list.push({ email, password, source });
}

function credentials() {
  const list = [];
  pushCredential(list, process.env.TUTORIAL_CUSTOMER_EMAIL, process.env.TUTORIAL_CUSTOMER_PASSWORD, "tutorial_env");
  if (!isLocalBaseUrl()) pushCredential(list, "1621417163@qq.com", process.env.SMOKE_CUSTOMER_PASSWORD || "mydreamshoots123", "production_demo");
  pushCredential(
    list,
    process.env.SMOKE_MYDREAMSHOOTS_CUSTOMER_EMAIL || process.env.SMOKE_CUSTOMER_EMAIL,
    process.env.SMOKE_MYDREAMSHOOTS_CUSTOMER_PASSWORD || process.env.SMOKE_CUSTOMER_PASSWORD,
    "smoke_env"
  );
  pushCredential(
    list,
    "nora@mydreamshoots.localhost",
    process.env.SMOKE_MYDREAMSHOOTS_CUSTOMER_PASSWORD || process.env.SMOKE_CUSTOMER_PASSWORD || "nora123",
    "local_demo"
  );
  if (isLocalBaseUrl()) pushCredential(list, "1621417163@qq.com", process.env.SMOKE_CUSTOMER_PASSWORD || "mydreamshoots123", "production_demo");
  const seen = new Set();
  return list.filter((item) => {
    const key = `${item.email}\n${item.password}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sanitizeText(value) {
  return String(value ?? "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[url]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [secret]")
    .replace(/(api[_-]?key|token|authorization|password)(["'\s:=]+)[^"',}\s]+/gi, "$1$2[secret]")
    .replace(/\b(site|cust|asset|job|sess)_[A-Za-z0-9_-]{8,}\b/g, "[$1_id]");
}

function sanitizeJson(value) {
  return JSON.parse(sanitizeText(JSON.stringify(value ?? null)));
}

function log(message, details = {}) {
  const suffix = Object.keys(details).length ? ` ${JSON.stringify(sanitizeJson(details))}` : "";
  console.log(`[tutorial] ${message}${suffix}`);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: repoRoot, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${path.basename(command)} exited ${code}: ${sanitizeText(stderr || stdout)}`));
    });
  });
}

async function prepareCleanFrame() {
  const source = path.join(repoRoot, "public/assets/dreamshoot/generated/homepage-showcase/images/creator-portraits.webp");
  const meta = await sharp(source).metadata();
  if (!meta.width || !meta.height) throw new Error("source_frame_metadata_missing");
  const cropHeight = Math.floor(meta.height * 0.83);
  const cleanCrop = await sharp(source).extract({ left: 0, top: 0, width: meta.width, height: cropHeight }).toBuffer();
  const background = await sharp(cleanCrop)
    .resize(1280, 720, { fit: "cover" })
    .blur(18)
    .modulate({ brightness: 0.76, saturation: 0.82 })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
  const foreground = await sharp(cleanCrop)
    .resize({ width: 760, height: 720, fit: "contain", withoutEnlargement: false })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
  const fgMeta = await sharp(foreground).metadata();
  await sharp(background)
    .composite([{ input: foreground, left: Math.floor((1280 - (fgMeta.width || 760)) / 2), top: Math.floor((720 - (fgMeta.height || 720)) / 2) }])
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(cleanFramePath);
}

class Recorder {
  constructor(page) {
    this.page = page;
    this.index = 0;
  }

  async captureFor(seconds, caption) {
    await setCaption(this.page, caption);
    const count = Math.round(seconds * captureFps);
    for (let i = 0; i < count; i += 1) {
      await this.page.evaluate(() => window.__tutorial?.redact?.()).catch(() => undefined);
      await this.page.screenshot({ path: path.join(framesDir, `frame_${String(this.index).padStart(5, "0")}.png`), fullPage: false });
      this.index += 1;
      await this.page.waitForTimeout(35);
    }
  }
}

async function installOverlay(page) {
  await page.addStyleTag({ content: `
    input[name="email"], input[name="password"] { color: transparent !important; caret-color: transparent !important; text-shadow: none !important; }
    .tutorial-caption { position: fixed; left: 50%; bottom: 34px; transform: translateX(-50%); z-index: 2147483000; max-width: min(1280px, calc(100vw - 96px)); padding: 18px 28px; border: 1px solid rgba(255,255,255,.24); border-radius: 14px; background: rgba(5,8,14,.84); box-shadow: 0 22px 70px rgba(0,0,0,.44); color: white; font: 800 30px/1.22 Inter, system-ui, sans-serif; text-align: center; pointer-events: none; backdrop-filter: blur(12px); }
    .tutorial-caption::before { content: ""; display: inline-block; width: 12px; height: 12px; margin-right: 12px; border-radius: 999px; background: linear-gradient(135deg,#31d4ff,#ff61c7); vertical-align: 3px; }
    .tutorial-highlight { position: fixed; z-index: 2147482998; border: 3px solid #31d4ff; border-radius: 16px; box-shadow: 0 0 0 9999px rgba(0,0,0,.10), 0 0 34px rgba(49,212,255,.45); pointer-events: none; opacity: 0; transition: opacity 160ms ease, left 220ms ease, top 220ms ease, width 220ms ease, height 220ms ease; }
    .tutorial-cursor { position: fixed; z-index: 2147482999; width: 28px; height: 28px; transform: translate(-5px,-5px); pointer-events: none; filter: drop-shadow(0 8px 16px rgba(0,0,0,.46)); opacity: .94; transition: left 260ms ease, top 260ms ease, transform 160ms ease; }
    .tutorial-cursor::before { content: ""; display: block; width: 0; height: 0; border-right: 18px solid transparent; border-bottom: 28px solid #fff; }
    .tutorial-cursor.click { transform: translate(-5px,-5px) scale(.86); }
    .tutorial-mask { position: fixed; z-index: 2147482997; display: grid; place-items: center; border-radius: 10px; background: rgba(255,255,255,.94); color: #111827; font: 700 17px/1.2 Inter, system-ui, sans-serif; pointer-events: none; box-shadow: inset 0 0 0 1px rgba(17,24,39,.14); }
    .tutorial-chip-mask { position: fixed; z-index: 2147482996; display: grid; place-items: center; min-height: 46px; border-radius: 999px; background: rgba(2,6,23,.95); color: #fff; font: 800 16px/1.2 Inter, system-ui, sans-serif; pointer-events: none; box-shadow: inset 0 0 0 1px rgba(255,255,255,.16); }
  ` });
  await page.evaluate(() => {
    const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
    const names = ["Nora Whitman", "Nora"];
    function ensure(cls, text = "") {
      let el = document.querySelector(`.${cls}`);
      if (!el) {
        el = document.createElement("div");
        el.className = cls;
        document.body.appendChild(el);
      }
      if (text) el.textContent = text;
      return el;
    }
    function redactTextNodes(root) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const node of nodes) {
        const parent = node.parentElement;
        if (!parent || parent.closest(".tutorial-caption,.tutorial-mask,.tutorial-chip-mask")) continue;
        let text = node.nodeValue || "";
        const original = text;
        text = text.replace(emailPattern, "demo@masked.local");
        text = text.replace(/\b(Credits:\s*)\d{3,}\b/gi, "$1----");
        text = text.replace(/\b\d{3,}\s+credits\b/gi, "---- credits");
        for (const name of names) text = text.split(name).join("Demo Account");
        if (text !== original) node.nodeValue = text;
      }
    }
    function positionInputMask(selector, cls, label) {
      const input = document.querySelector(selector);
      let mask = document.querySelector(`.${cls}`);
      if (!input || input.offsetParent === null) {
        if (mask) mask.remove();
        return;
      }
      const rect = input.getBoundingClientRect();
      if (!mask) {
        mask = document.createElement("div");
        mask.className = `tutorial-mask ${cls}`;
        mask.textContent = label;
        document.body.appendChild(mask);
      }
      Object.assign(mask.style, { left: `${rect.left + 8}px`, top: `${rect.top + 8}px`, width: `${Math.max(80, rect.width - 16)}px`, height: `${Math.max(28, rect.height - 16)}px` });
    }
    function positionAccountMask() {
      const candidates = [...document.querySelectorAll("header *, nav *, [class]")].filter((el) => {
        if (el.closest(".tutorial-chip-mask")) return false;
        const text = (el.textContent || "").trim();
        return text.includes("Demo Account") || /demo@masked\.local/i.test(text);
      });
      const target = candidates.map((el) => ({ el, rect: el.getBoundingClientRect() }))
        .filter((item) => item.rect.width > 80 && item.rect.width < 440 && item.rect.height > 28 && item.rect.height < 120)
        .sort((a, b) => (b.rect.width * b.rect.height) - (a.rect.width * a.rect.height))[0];
      let mask = document.querySelector(".tutorial-chip-mask");
      if (!target) {
        if (mask) mask.remove();
        return;
      }
      if (!mask) {
        mask = document.createElement("div");
        mask.className = "tutorial-chip-mask";
        mask.textContent = "Demo Account";
        document.body.appendChild(mask);
      }
      Object.assign(mask.style, { left: `${target.rect.left}px`, top: `${target.rect.top}px`, width: `${target.rect.width}px`, height: `${target.rect.height}px` });
    }
    const caption = ensure("tutorial-caption");
    const highlight = ensure("tutorial-highlight");
    const cursor = ensure("tutorial-cursor");
    window.__tutorial = {
      setCaption(text) { caption.textContent = text; },
      highlight(rect) {
        if (!rect) {
          highlight.style.opacity = "0";
          return;
        }
        Object.assign(highlight.style, { left: `${Math.max(0, rect.x - 8)}px`, top: `${Math.max(0, rect.y - 8)}px`, width: `${Math.max(0, rect.width + 16)}px`, height: `${Math.max(0, rect.height + 16)}px`, opacity: "1" });
      },
      cursor(x, y) { cursor.style.left = `${x}px`; cursor.style.top = `${y}px`; },
      clickPulse() { cursor.classList.add("click"); window.setTimeout(() => cursor.classList.remove("click"), 180); },
      redact() {
        redactTextNodes(document.body);
        positionInputMask('input[name="email"]', "tutorial-mask-email", "masked email");
        positionInputMask('input[name="password"]', "tutorial-mask-password", "masked password");
        positionAccountMask();
      }
    };
    window.__tutorial.cursor(1160, 680);
    window.__tutorial.redact();
    window.setInterval(() => window.__tutorial?.redact?.(), 250);
  });
}

async function setCaption(page, caption) {
  await page.evaluate((text) => window.__tutorial?.setCaption?.(text), caption).catch(() => undefined);
}

async function pointAt(page, locator) {
  const box = await locator.boundingBox().catch(() => null);
  if (!box) return;
  await page.evaluate((rect) => {
    window.__tutorial?.highlight?.(rect);
    window.__tutorial?.cursor?.(rect.x + rect.width / 2, rect.y + rect.height / 2);
  }, { x: box.x, y: box.y, width: box.width, height: box.height }).catch(() => undefined);
}

async function clickWithPointer(page, locator, options = {}) {
  await pointAt(page, locator);
  await page.waitForTimeout(options.pauseBeforeClickMs ?? 220);
  await locator.click({ timeout: options.timeout ?? 30_000, force: options.force ?? false });
  await page.evaluate(() => window.__tutorial?.clickPulse?.()).catch(() => undefined);
  await page.waitForTimeout(options.pauseAfterClickMs ?? 250);
}

async function waitReady(page) {
  await page.waitForLoadState("domcontentloaded", { timeout: pageTimeoutMs }).catch(() => undefined);
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
  await page.evaluate(() => window.__tutorial?.redact?.()).catch(() => undefined);
}

async function openLogin(page) {
  let lastError = "";
  const attempts = Math.max(1, Number(process.env.TUTORIAL_LOGIN_RETRIES || 5));
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await page.goto(absoluteUrl("/login?mode=login"), { waitUntil: "domcontentloaded", timeout: pageTimeoutMs });
      await waitReady(page);
      await installOverlay(page);
      const email = page.locator('input[name="email"]').first();
      await email.waitFor({ state: "visible", timeout: 35_000 });
      return email;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      log("login page retry", { attempt, error: lastError });
      await page.waitForTimeout(10_000);
    }
  }
  throw new Error(`login_page_load_failed: ${sanitizeText(lastError)}`);
}

async function captureLoginAndAuthenticate(page, context, recorder) {
  const email = await openLogin(page);
  const password = page.locator('input[name="password"]').first();
  const submit = page.getByRole("button", { name: /^Log in$/ }).last();
  const candidates = credentials();
  if (!candidates.length) throw new Error("tutorial_credentials_missing");
  await email.fill(candidates[0].email);
  await password.fill(candidates[0].password);
  await page.evaluate(() => window.__tutorial?.redact?.()).catch(() => undefined);
  await pointAt(page, submit);
  await recorder.captureFor(4, captions.login);
  await page.evaluate(() => window.__tutorial?.clickPulse?.()).catch(() => undefined);

  let lastError = "login_failed";
  const authRounds = Math.max(1, Number(process.env.TUTORIAL_AUTH_RETRIES || 6));
  for (let round = 1; round <= authRounds; round += 1) {
    let sawTransient = false;
    for (const [index, candidate] of candidates.entries()) {
      const response = await context.request.post(apiUrl(`/api/sites/${siteId}/auth/login`), {
        data: { email: candidate.email, password: candidate.password },
        failOnStatusCode: false,
        timeout: 60_000
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok() && data.ok !== false) {
        log("authenticated browser context", { candidate: index + 1, source: candidate.source, round });
        return;
      }
      lastError = data.error || response.status();
      sawTransient = sawTransient || response.status() >= 500 || response.status() === 429;
      log(`credential candidate ${index + 1} failed`, { error: lastError, source: candidate.source, round });
    }
    if (!sawTransient) break;
    await page.waitForTimeout(10_000);
  }
  throw new Error(`customer_login_failed: ${sanitizeText(lastError)}`);
}

async function openWorkspace(page, hash = "#step-video") {
  let lastError = "";
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      await page.goto(`${absoluteUrl("/app/create")}${hash}`, { waitUntil: "domcontentloaded", timeout: pageTimeoutMs });
      await waitReady(page);
      await installOverlay(page);
      await page.locator("#studio-console-video").waitFor({ state: "visible", timeout: 60_000 });
      await page.locator("#video-step-generate").waitFor({ state: "visible", timeout: 60_000 });
      return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      log("workspace load retry", { attempt, error: lastError });
      await page.waitForTimeout(5_000);
    }
  }
  throw new Error(`workspace_load_failed: ${sanitizeText(lastError)}`);
}

async function clearSelectedFrames(page) {
  await page.waitForTimeout(1500);
  const text = await page.locator("#studio-console-video").textContent({ timeout: 10_000 }).catch(() => "");
  if (!/\b[1-7]\s+of\s+7\s+selected\b/i.test(text || "")) return;
  await clickWithPointer(page, page.getByLabel(/Clear selected video frames/i).first(), { force: true }).catch(() => undefined);
  await page.waitForFunction(() => /0\s+of\s+7\s+selected/i.test(document.querySelector("#studio-console-video")?.textContent || ""), undefined, { timeout: 10_000 }).catch(() => undefined);
}

async function uploadFrame(page) {
  await clearSelectedFrames(page);
  await clearSelectedFrames(page);
  const uploadResponsePromise = page.waitForResponse((response) =>
    response.url().includes(`/api/sites/${siteId}/customers/`) && response.url().includes("/assets") && response.request().method() === "POST",
  { timeout: 120_000 }).catch(() => null);
  await page.locator('#studio-console-video input[type="file"]').first().setInputFiles(cleanFramePath);
  await page.waitForFunction(() => {
    const text = `${document.querySelector("#studio-console-video")?.textContent || ""} ${document.querySelector("#video-step-generate")?.textContent || ""}`;
    return /[1-7]\s+of\s+7\s+selected/i.test(text) || /[1-7]\/7\s+(selected|frames)/i.test(text);
  }, undefined, { timeout: 120_000 });
  const uploadResponse = await Promise.race([
    uploadResponsePromise,
    page.waitForTimeout(1_000).then(() => null)
  ]);
  if (uploadResponse && !uploadResponse.ok()) {
    const data = await uploadResponse.json().catch(() => ({}));
    throw new Error(`video_frame_upload_failed: ${sanitizeText(data.error || uploadResponse.status())}`);
  }
}

async function configurePrompt(page) {
  const textarea = page.locator("#video-step-generate textarea").first();
  await textarea.waitFor({ state: "visible", timeout: 45_000 });
  await pointAt(page, textarea);
  await textarea.fill(promptText);
  const six = page.locator("#video-step-generate").getByRole("button", { name: /^6s$/ }).first();
  if (await six.isVisible().catch(() => false)) await clickWithPointer(page, six, { force: true }).catch(() => undefined);
}

async function submitJobViaApiFallback(page, reason) {
  const result = await page.evaluate(async ({ siteId, promptText, reason }) => {
    function cookieValue(name) {
      return document.cookie
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${name}=`))
        ?.split("=")
        .slice(1)
        .join("=");
    }
    async function jsonFetch(url, options = {}) {
      const response = await fetch(url, { cache: "no-store", credentials: "include", ...options });
      const data = await response.json().catch(() => ({}));
      return { response, data };
    }
    let runtimeResponse = await jsonFetch(`/api/sites/${siteId}/customer/runtime?profile=workspace&refresh=direct-${Date.now()}`);
    if (!runtimeResponse.response.ok) {
      return { ok: false, error: `runtime_${runtimeResponse.response.status}` };
    }
    const customer = runtimeResponse.data.customer || runtimeResponse.data.runtime?.customer;
    const assets = Array.isArray(runtimeResponse.data.runtime?.assets) ? runtimeResponse.data.runtime.assets : [];
    const frameAssets = assets
      .filter((asset) => asset?.subjectRole === "video_frame" && asset?.role === "input" && String(asset.mimeType || "").startsWith("image/"))
      .sort((a, b) => Date.parse(b.createdAt || "") - Date.parse(a.createdAt || ""));
    const frameAsset = frameAssets.find((asset) => /source-frame-clean/i.test(asset.label || "")) || frameAssets[0];
    if (!customer?.id) return { ok: false, error: "customer_missing" };
    if (!frameAsset?.id) return { ok: false, error: "frame_asset_missing" };

    const themeResponse = await jsonFetch(`/api/sites/${siteId}/video-themes?pageSize=100&includeCategories=1&refresh=${Date.now()}`);
    if (!themeResponse.response.ok) return { ok: false, error: `themes_${themeResponse.response.status}` };
    const themes = Array.isArray(themeResponse.data.themes) ? themeResponse.data.themes : [];
    const selectedTheme = themes.find((theme) => /automatic motion/i.test(`${theme.name || ""} ${theme.headline || ""}`)) || themes[0];
    if (!selectedTheme?.id) return { ok: false, error: "video_theme_missing" };

    const frameAssetIds = [frameAsset.id];
    const idempotencyKey = `tutorial-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const csrf = cookieValue(`customer_csrf_${siteId}`);
    const requestBody = {
      customerId: customer.id,
      aiAppSlug: "video_generator",
      idempotencyKey,
      params: {
        mode: "video",
        outputType: "video",
        videoModelFamily: "auto",
        modelFamily: "auto",
        videoThemeId: selectedTheme.id,
        videoThemeSlug: selectedTheme.slug,
        videoThemeCategorySlug: selectedTheme.category?.slug,
        videoThemeCategoryLabel: selectedTheme.category?.label,
        videoTheme: {
          id: selectedTheme.id,
          slug: selectedTheme.slug,
          name: selectedTheme.name,
          categorySlug: selectedTheme.category?.slug,
          categoryLabel: selectedTheme.category?.label
        },
        duration: "6",
        videoDuration: "6",
        durationSeconds: 6,
        videoDurationSeconds: 6,
        aspect_ratio: "16:9",
        aspectRatio: "16:9",
        resolution: "720p",
        estimatedCreditCost: 24,
        assetIds: frameAssetIds,
        fields: {
          mode: "video",
          outputType: "video",
          videoInputMode: "image_to_video",
          videoModelFamily: "auto",
          modelFamily: "auto",
          videoThemeId: selectedTheme.id,
          videoThemeSlug: selectedTheme.slug,
          videoThemeCategorySlug: selectedTheme.category?.slug,
          videoThemeCategoryLabel: selectedTheme.category?.label,
          videoThemeName: selectedTheme.name,
          videoThemePrompt: selectedTheme.prompt,
          frameAssetIds,
          duration: "6",
          videoDuration: "6",
          durationSeconds: 6,
          videoDurationSeconds: 6,
          aspect_ratio: "16:9",
          aspectRatio: "16:9",
          resolution: "720p",
          estimatedCreditCost: 24,
          promptNote: promptText,
          tutorialFallbackReason: reason
        }
      }
    };
    async function submit() {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 120_000);
      try {
        return await jsonFetch(`/api/sites/${siteId}/ai/jobs`, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
            ...(csrf ? { "x-csrf-token": decodeURIComponent(csrf) } : {})
          },
          body: JSON.stringify(requestBody)
        });
      } finally {
        window.clearTimeout(timeout);
      }
    }
    let submitResponse = await submit();
    if (!submitResponse.response.ok && /csrf/i.test(String(submitResponse.data.error || ""))) {
      await jsonFetch(`/api/sites/${siteId}/customer/runtime?profile=workspace&refresh=csrf-${Date.now()}`).catch(() => undefined);
      submitResponse = await submit();
    }
    if (!submitResponse.response.ok || !submitResponse.data.job?.id) {
      return { ok: false, status: submitResponse.response.status, error: submitResponse.data.error || "job_create_failed" };
    }
    return {
      ok: true,
      jobId: submitResponse.data.job.id,
      reused: Boolean(submitResponse.data.reused),
      workerDispatchStatus: submitResponse.data.workerDispatch?.status,
      frameAssetId: frameAsset.id
    };
  }, { siteId, promptText, reason });
  if (!result.ok || !result.jobId) throw new Error(`video_job_api_fallback_failed: ${sanitizeText(result.error || result.status || "unknown")}`);
  log("video job submitted via api fallback", {
    jobId: result.jobId,
    reused: Boolean(result.reused),
    workerDispatchStatus: result.workerDispatchStatus,
    reason
  });
  return String(result.jobId);
}

async function submitJob(page) {
  const button = page.locator("#video-step-generate").getByRole("button", { name: /Generate video/i }).first();
  await button.waitFor({ state: "visible", timeout: 45_000 });
  const responsePredicate = (response) =>
    response.url().includes(`/api/sites/${siteId}/ai/jobs`) && response.request().method() === "POST";
  let lastMessage = "";
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    await page.waitForFunction(() => {
      const button = [...document.querySelectorAll("#video-step-generate button")].find((el) => /Generate video/i.test(el.textContent || ""));
      return button && !button.disabled;
    }, undefined, { timeout: 60_000 });
    const responsePromise = page.waitForResponse(responsePredicate, { timeout: 120_000 }).catch((error) => ({ __error: error }));
    await clickWithPointer(page, button);
    const quickResponse = await Promise.race([
      responsePromise,
      page.waitForTimeout(4_000).then(() => null)
    ]);
    const response = quickResponse || await Promise.race([
      responsePromise,
      page.waitForTimeout(30_000).then(() => null)
    ]);
    if (response && !response.__error) {
      const data = await response.json().catch(() => ({}));
      if (!response.ok() || !data.ok || !data.job?.id) throw new Error(`video_job_create_failed: ${sanitizeText(data.error || response.status())}`);
      log("video job submitted", { jobId: data.job.id, reused: Boolean(data.reused), workerDispatchStatus: data.workerDispatch?.status });
      return String(data.job.id);
    }
    lastMessage = await page.locator("#video-step-generate").textContent({ timeout: 5_000 }).catch(() => "");
    if (/still checking your subscription|Frame uploads are still finishing|Video presets are still loading|Creating your video request/i.test(lastMessage)) {
      log("generate click deferred by frontend state", { attempt, message: lastMessage.slice(-180) });
      if (/still checking your subscription/i.test(lastMessage) && attempt >= 2) {
        return await submitJobViaApiFallback(page, "frontend_subscription_loading");
      }
      await page.waitForTimeout(8_000);
      continue;
    }
    log("generate click did not create request yet", { attempt, message: lastMessage.slice(-180) });
    await page.waitForTimeout(5_000);
  }
  return await submitJobViaApiFallback(page, "frontend_no_job_response");
}

async function openResults(page) {
  const resultsSection = page.locator("#video-workspace-videos").first();
  const tab = page.getByRole("button", { name: /Video results/i }).first();
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    if (await resultsSection.isVisible({ timeout: 2_000 }).catch(() => false)) return;
    if (await tab.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await clickWithPointer(page, tab, { force: true }).catch(() => undefined);
    } else if (attempt === 1) {
      await page.goto(`${absoluteUrl("/app/create")}#video-workspace-videos`, { waitUntil: "domcontentloaded", timeout: pageTimeoutMs });
    }
    await page.evaluate(() => {
      const buttons = [...document.querySelectorAll("button")];
      const resultsButton = buttons.find((button) => /Video results/i.test(button.textContent || ""));
      if (resultsButton) resultsButton.click();
      window.history.replaceState(null, "", "#video-workspace-videos");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
      document.getElementById("video-workspace-videos")?.scrollIntoView({ block: "start" });
    }).catch(() => undefined);
    await waitReady(page);
    await installOverlay(page);
    await page.waitForTimeout(1_000);
  }
  const state = await page.evaluate(() => ({
    hash: window.location.hash,
    url: window.location.href,
    hasResultsSection: Boolean(document.getElementById("video-workspace-videos")),
    visibleText: document.body.innerText.slice(0, 1200)
  })).catch(() => ({}));
  log("video results tab did not become visible", state);
  await resultsSection.waitFor({ state: "visible", timeout: 15_000 });
}

async function showGenerateClickOnly(page) {
  const button = page.locator("#video-step-generate").getByRole("button", { name: /Generate video/i }).first();
  await button.waitFor({ state: "visible", timeout: 45_000 });
  await pointAt(page, button);
  await page.evaluate(() => window.__tutorial?.clickPulse?.()).catch(() => undefined);
  log("skipped real supplier generation by request");
}

async function openHistoricalVideoPreview(page) {
  await openResults(page);
  const preview = page.getByRole("button", { name: /Open preview/i }).first();
  if (await preview.isVisible().catch(() => false)) {
    await clickWithPointer(page, preview, { force: true, timeout: 30_000 });
    const video = page.locator("video").first();
    if (await video.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await page.evaluate(() => {
        const video = document.querySelector("video");
        if (video) void video.play().catch(() => undefined);
      }).catch(() => undefined);
    }
  }
}

async function runtime(page) {
  const result = await page.evaluate(async ({ siteId }) => {
    const response = await fetch(`/api/sites/${siteId}/customer/runtime?profile=workspace&refresh=${Date.now()}`, { cache: "no-store", credentials: "include" });
    return { ok: response.ok, status: response.status, data: await response.json().catch(() => ({})) };
  }, { siteId });
  if (!result.ok) throw new Error(`runtime_fetch_failed: ${result.status}`);
  return result.data;
}

function jobFrom(runtimeData, jobId) {
  const jobs = Array.isArray(runtimeData?.runtime?.jobs) ? runtimeData.runtime.jobs : [];
  return jobs.find((job) => job?.id === jobId);
}

function videoAssetsForJob(runtimeData, jobId) {
  const assets = Array.isArray(runtimeData?.runtime?.assets) ? runtimeData.runtime.assets : [];
  return assets.filter((asset) => asset?.jobId === jobId && String(asset.mimeType || "").startsWith("video/"));
}

function providerError(job) {
  const result = job?.resultJson || {};
  const slots = Array.isArray(result.outputSlots) ? result.outputSlots : [];
  const failed = slots.find((slot) => slot?.status === "failed" || slot?.error || slot?.providerFailure);
  return failed?.error || failed?.providerFailure?.code || result.error || "video_provider_failed";
}

async function waitForSuccess(page, jobId) {
  const started = Date.now();
  let lastStatus = "unknown";
  while (Date.now() - started < jobTimeoutMs) {
    const data = await runtime(page);
    const job = jobFrom(data, jobId);
    const assets = videoAssetsForJob(data, jobId);
    if (job?.status) lastStatus = job.status;
    if (job?.status === "succeeded" && assets.length) {
      log("video job succeeded", { jobId, assetCount: assets.length });
      return { job, asset: assets[0] };
    }
    if (job?.status === "failed" || job?.status === "refunded" || job?.status === "partial") {
      throw new Error(`video_job_${job.status}: ${sanitizeText(providerError(job))}`);
    }
    log("waiting for video job", { jobId, status: lastStatus, elapsedSeconds: Math.round((Date.now() - started) / 1000) });
    await page.waitForTimeout(pollIntervalMs);
  }
  throw new Error(`video_job_timeout: ${sanitizeText(lastStatus)}`);
}

async function downloadResult(page, asset) {
  if (!asset?.downloadUrl) throw new Error("generated_video_download_url_missing");
  const response = await page.request.get(apiUrl(asset.downloadUrl), { failOnStatusCode: false });
  if (!response.ok()) throw new Error(`generated_video_download_failed: ${response.status()}`);
  const bytes = await response.body();
  await fs.writeFile(providerResultPath, bytes);
  const stats = await fs.stat(providerResultPath);
  if (stats.size < 10_000) throw new Error("generated_video_download_too_small");
}

async function buildVideo(frameCount) {
  await run(ffmpegPath, [
    "-y",
    "-framerate", String(captureFps),
    "-i", path.join(framesDir, "frame_%05d.png"),
    "-frames:v", String(Math.round(frameCount * (30 / captureFps))),
    "-vf", "fps=30,scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,format=yuv420p",
    "-an",
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "18",
    "-movflags", "+faststart",
    finalOutputPath
  ]);
}

async function probe(videoPath) {
  const { stdout } = await run(ffprobePath, ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", videoPath]);
  return JSON.parse(stdout);
}

function verifyProbe(info) {
  const streams = Array.isArray(info.streams) ? info.streams : [];
  const video = streams.find((stream) => stream.codec_type === "video");
  const audio = streams.filter((stream) => stream.codec_type === "audio");
  const duration = Number(info.format?.duration || video?.duration || 0);
  if (!video) throw new Error("final_video_stream_missing");
  if (Number(video.width) !== 1920 || Number(video.height) !== 1080) throw new Error(`final_video_dimensions_invalid: ${video.width}x${video.height}`);
  if (audio.length) throw new Error("final_video_should_be_muted");
  if (Math.abs(duration - 30) > 0.75) throw new Error(`final_video_duration_invalid: ${duration}`);
  return { duration, width: video.width, height: video.height, audioStreams: audio.length };
}

async function exportSamples() {
  await fs.mkdir(samplesDir, { recursive: true });
  for (const second of [3, 9, 15, 21, 27]) {
    await run(ffmpegPath, ["-y", "-ss", String(second), "-i", finalOutputPath, "-frames:v", "1", "-q:v", "2", path.join(samplesDir, `sample-${String(second).padStart(2, "0")}s.jpg`)]);
  }
  await run(ffmpegPath, ["-y", "-i", finalOutputPath, "-vf", "fps=1/6,scale=480:270,tile=3x2", "-frames:v", "1", "-update", "1", contactSheetPath]);
}

async function writeFailure(error, extra = {}) {
  await fs.mkdir(runDir, { recursive: true });
  await fs.writeFile(failurePath, `${JSON.stringify(sanitizeJson({ ok: false, error: error instanceof Error ? error.message : String(error), ...extra }), null, 2)}\n`);
}

async function main() {
  await fs.rm(runDir, { recursive: true, force: true });
  await fs.mkdir(framesDir, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });
  await prepareCleanFrame();
  log("prepared clean upload frame", { path: cleanFramePath });

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, baseURL: baseUrl, colorScheme: "dark", reducedMotion: "reduce", locale: "en-US" });
  const page = await context.newPage();
  page.setDefaultTimeout(pageTimeoutMs);
  page.on("pageerror", (error) => log("browser page error", { error: error.message }));
  page.on("console", (message) => {
    if (message.type() === "error") log("browser console error", { error: message.text().slice(0, 240) });
  });
  const recorder = new Recorder(page);
  const jobIds = [];
  try {
    await captureLoginAndAuthenticate(page, context, recorder);
    await openWorkspace(page, "#step-video");
    await pointAt(page, page.locator("#video-step-generate").getByText(/Create an AI video clip/i).first()).catch(() => undefined);
    await recorder.captureFor(4, captions.workspace);

    let success;
    let lastError;
    const captured = { upload: false, prompt: false, generate: false, progress: false };
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await openWorkspace(page, "#step-video");
        await uploadFrame(page);
        if (!captured.upload) {
          await recorder.captureFor(4, captions.upload);
          captured.upload = true;
        }
        await configurePrompt(page);
        if (!captured.prompt) {
          await recorder.captureFor(6, captions.prompt);
          captured.prompt = true;
        }
        if (skipRealGeneration) {
          await showGenerateClickOnly(page);
          if (!captured.generate) {
            await recorder.captureFor(4, captions.generate);
            captured.generate = true;
          }
          await openResults(page);
          if (!captured.progress) {
            await recorder.captureFor(3, captions.progress);
            captured.progress = true;
          }
          success = { skippedRealGeneration: true };
          break;
        }
        const jobId = await submitJob(page);
        jobIds.push(jobId);
        if (!captured.generate) {
          await openResults(page);
          await recorder.captureFor(4, captions.generate);
          captured.generate = true;
        }
        if (!captured.progress) {
          await recorder.captureFor(3, captions.progress);
          captured.progress = true;
        }
        success = await waitForSuccess(page, jobId);
        await downloadResult(page, success.asset);
        break;
      } catch (error) {
        lastError = error;
        log(`video generation attempt ${attempt} failed`, { error: error instanceof Error ? error.message : String(error) });
        if (/insufficient_credits|Choose a subscription|add enough credits/i.test(error instanceof Error ? error.message : String(error))) throw error;
        if (attempt >= maxAttempts) throw error;
        await page.waitForTimeout(2_000);
      }
    }
    if (!success) throw lastError || new Error("video_generation_failed_without_status");
    if (skipRealGeneration) await openHistoricalVideoPreview(page);
    else await openResults(page);
    await page.evaluate(() => window.__tutorial?.highlight?.(null)).catch(() => undefined);
    await recorder.captureFor(5, captions.result);
    if (recorder.index !== 300) throw new Error(`capture_frame_count_invalid: ${recorder.index}`);
    await buildVideo(recorder.index);
    const finalProbe = verifyProbe(await probe(finalOutputPath));
    if (!skipRealGeneration) await probe(providerResultPath);
    await exportSamples();
    const result = {
      ok: true,
      output: finalOutputPath,
      providerResult: skipRealGeneration ? undefined : providerResultPath,
      contactSheet: contactSheetPath,
      jobIds,
      skippedRealGeneration: skipRealGeneration,
      finalProbe
    };
    log("tutorial export complete", result);
    console.log(JSON.stringify(sanitizeJson(result), null, 2));
  } catch (error) {
    await page.screenshot({ path: path.join(runDir, "failure-screenshot.png"), fullPage: false }).catch(() => undefined);
    await writeFailure(error, { jobIds });
    throw error;
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(`[tutorial] failed: ${sanitizeText(error instanceof Error ? error.stack || error.message : String(error))}`);
  process.exitCode = 1;
});
