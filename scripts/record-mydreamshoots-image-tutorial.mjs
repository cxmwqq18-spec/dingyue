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

const baseUrl = (process.env.TUTORIAL_BASE_URL || "http://localhost:3002").replace(/\/$/, "");
const siteId = process.env.TUTORIAL_SITE_ID || "site_dreamshoot";
const siteSlug = process.env.TUTORIAL_SITE_SLUG || "mydreamshoots";
const outputDir = path.resolve(repoRoot, process.env.TUTORIAL_OUTPUT_DIR || "output");
const runDir = path.join(outputDir, "mydreamshoots-ai-image-tutorial-real-work");
const framesDir = path.join(runDir, "frames");
const samplesDir = path.join(runDir, "samples");
const narrationDir = path.join(runDir, "narration");
const sourcePhotoPath = path.join(runDir, "source-selfie-clean.jpg");
const finalOutputPath = path.resolve(repoRoot, process.env.TUTORIAL_OUTPUT_MP4 || "output/mydreamshoots-ai-image-tutorial-55s.mp4");
const narrationPath = path.join(runDir, "narration.m4a");
const failurePath = path.join(runDir, "failure-status.json");
const contactSheetPath = path.join(runDir, "verification-contact-sheet.jpg");

const viewport = { width: 1920, height: 1080 };
const captureFps = Number(process.env.TUTORIAL_CAPTURE_FPS || 10);
const targetSeconds = Number(process.env.TUTORIAL_TARGET_SECONDS || 55);
const targetFrameCount = Math.round(targetSeconds * captureFps);
const headless = process.env.TUTORIAL_HEADLESS !== "0";
const pageTimeoutMs = Math.max(30_000, Number(process.env.TUTORIAL_PAGE_TIMEOUT_MS || 120_000));
const jobTimeoutMs = Math.max(60_000, Number(process.env.TUTORIAL_JOB_TIMEOUT_MS || 1_200_000));
const pollIntervalMs = Math.max(5_000, Number(process.env.TUTORIAL_POLL_INTERVAL_MS || 12_000));
const realGeneration = process.env.TUTORIAL_REAL_GENERATION === "1";
const maxPaidAttempts = realGeneration ? Math.min(1, Math.max(1, Number(process.env.TUTORIAL_MAX_PAID_ATTEMPTS || 1))) : 0;
const ffmpegPath = process.env.FFMPEG_PATH || ffmpegStatic || "ffmpeg";
const ffprobePath = process.env.FFPROBE_PATH || siblingFfprobe(ffmpegPath) || "ffprobe";

const packageTitle = process.env.TUTORIAL_PACKAGE_TITLE || "Valentine Photos";
const promptNote = process.env.TUTORIAL_PROMPT_NOTE ||
  "Warm romantic portrait with soft date-night lighting, natural expression, clean face detail, polished private album finish, no logos, no text, no watermark.";

const baseTimeline = [
  { id: "login", duration: 5, caption: "Sign in to your private workspace", narration: "First, sign in to your private MyDreamShoots workspace." },
  { id: "workspace", duration: 6, caption: "Open the AI photo workspace", narration: "Open the private workspace where uploads, credits, and results stay together." },
  { id: "package", duration: 7, caption: "Choose a Photo package", narration: "Choose a photo package to set the style, credit cost, and output count." },
  { id: "upload", duration: 8, caption: "Upload or select clear source photos", narration: "Upload or select clear source photos for the private model." },
  { id: "review", duration: 9, caption: "Review model, audience, credits, and uploads", narration: "Review the package, audience, credits, and selected uploads." },
  { id: "start", duration: 5, caption: "Start the photo generation request", narration: "Start generation and let MyDreamShoots create the photo request." },
  { id: "progress", duration: 8, caption: "Refresh status in All assets", narration: "Refresh the workspace to track the request and load the latest results." },
  { id: "result", duration: 7, caption: "Open and review the generated image", narration: "Open the finished result and review the generated image." }
];
const timeline = buildTimeline(baseTimeline, targetFrameCount, captureFps);

function siblingFfprobe(binary) {
  if (!binary || binary === "ffmpeg") return undefined;
  const candidate = path.join(path.dirname(binary), "ffprobe");
  return fsSync.existsSync(candidate) ? candidate : undefined;
}

function buildTimeline(segments, frameCount, fps) {
  const total = segments.reduce((sum, segment) => sum + segment.duration, 0);
  let previous = 0;
  return segments.map((segment, index) => {
    const cumulative = segments.slice(0, index + 1).reduce((sum, item) => sum + item.duration, 0);
    const next = index === segments.length - 1 ? frameCount : Math.round((cumulative / total) * frameCount);
    const frames = Math.max(1, next - previous);
    previous = next;
    return { ...segment, frames, scaledDuration: frames / fps };
  });
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

function credentials() {
  const email = process.env.TUTORIAL_CUSTOMER_EMAIL || process.env.SMOKE_MYDREAMSHOOTS_CUSTOMER_EMAIL || process.env.SMOKE_CUSTOMER_EMAIL || "";
  const password = process.env.TUTORIAL_CUSTOMER_PASSWORD || process.env.SMOKE_MYDREAMSHOOTS_CUSTOMER_PASSWORD || process.env.SMOKE_CUSTOMER_PASSWORD || "";
  if (!email || !password) return [];
  return [{ email, password, source: process.env.TUTORIAL_CUSTOMER_EMAIL ? "tutorial_env" : "smoke_env" }];
}

function sanitizeText(value) {
  return String(value ?? "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[url]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [secret]")
    .replace(/(api[_-]?key|token|authorization|password)(["'\s:=]+)[^"',}\s]+/gi, "$1$2[secret]")
    .replace(/\b(site|cust|asset|job|sess|model|album)_[A-Za-z0-9_-]{8,}\b/g, "[$1_id]");
}

function sanitizeJson(value) {
  return JSON.parse(sanitizeText(JSON.stringify(value ?? null)));
}

function log(message, details = {}) {
  const suffix = Object.keys(details).length ? ` ${JSON.stringify(sanitizeJson(details))}` : "";
  console.log(`[image-tutorial] ${message}${suffix}`);
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

async function prepareSourcePhoto() {
  const configured = process.env.TUTORIAL_SOURCE_IMAGE ? path.resolve(repoRoot, process.env.TUTORIAL_SOURCE_IMAGE) : "";
  const candidates = [
    configured,
    path.join(repoRoot, "public/assets/dreamshoot/frames/sample-professional-headshot.png"),
    path.join(repoRoot, "public/assets/dreamshoot/frames/faq-intro-portrait.png"),
    path.join(repoRoot, "public/assets/dreamshoot/beauty-portrait-gpt2.png"),
    path.join(repoRoot, "public/assets/dreamshoot/generated/20260618/headshot-lifestyle-v1.png")
  ].filter(Boolean);
  const source = candidates.find((candidate) => fsSync.existsSync(candidate));
  if (!source) throw new Error("tutorial_source_image_missing");
  const image = sharp(source);
  const meta = await image.metadata();
  if (!meta.width || !meta.height) throw new Error("tutorial_source_image_metadata_missing");
  await image
    .resize(1024, 1280, { fit: "cover", position: "attention" })
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(sourcePhotoPath);
  log("prepared source photo", { source, path: sourcePhotoPath });
}

class Recorder {
  constructor(page) {
    this.page = page;
    this.index = 0;
  }

  async capture(segment) {
    await setCaption(this.page, segment.caption);
    for (let i = 0; i < segment.frames; i += 1) {
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
    .tutorial-mask { position: fixed; z-index: 2147482997; display: grid; place-items: center; border-radius: 10px; background: #ffffff; color: #111827; font: 700 17px/1.2 Inter, system-ui, sans-serif; pointer-events: none; box-shadow: inset 0 0 0 1px rgba(17,24,39,.14); }
    .tutorial-chip-mask { position: fixed; z-index: 2147482996; display: grid; place-items: center; min-height: 46px; border-radius: 999px; background: rgba(2,6,23,.95); color: #fff; font: 800 16px/1.2 Inter, system-ui, sans-serif; pointer-events: none; box-shadow: inset 0 0 0 1px rgba(255,255,255,.16); }
    .tutorial-file-backdrop { position: fixed; inset: 0; z-index: 2147482990; background: rgba(8,12,20,.42); backdrop-filter: blur(3px); pointer-events: none; }
    .tutorial-file-dialog { position: fixed; left: 50%; top: 50%; z-index: 2147482992; width: min(1120px, calc(100vw - 120px)); height: 610px; transform: translate(-50%,-50%); overflow: hidden; border: 1px solid #b9bdc7; border-radius: 16px; background: #f5f6f8; color: #20242b; box-shadow: 0 30px 90px rgba(0,0,0,.46); font: 500 16px/1.3 -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif; pointer-events: none; }
    .tutorial-file-titlebar { display: flex; align-items: center; gap: 10px; height: 58px; padding: 0 22px; border-bottom: 1px solid #d7d9df; background: #fbfbfc; }
    .tutorial-file-dot { width: 13px; height: 13px; border-radius: 50%; background: #ff5f57; box-shadow: 23px 0 #febc2e, 46px 0 #28c840; }
    .tutorial-file-toolbar { display: flex; align-items: center; gap: 14px; height: 54px; padding: 0 24px; border-bottom: 1px solid #d7d9df; color: #626975; }
    .tutorial-file-toolbar strong { margin-left: auto; margin-right: auto; color: #303641; font-size: 15px; }
    .tutorial-file-body { display: grid; grid-template-columns: 220px 1fr; height: 498px; }
    .tutorial-file-sidebar { padding: 24px 16px; border-right: 1px solid #d7d9df; background: #eceef2; }
    .tutorial-file-sidebar div { padding: 11px 14px; border-radius: 8px; color: #5e6672; }
    .tutorial-file-sidebar .active { background: #d8e8ff; color: #1264c8; font-weight: 800; }
    .tutorial-file-main { display: grid; grid-template-rows: 1fr 64px; min-width: 0; }
    .tutorial-file-list { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; padding: 24px; align-content: start; background: #ffffff; }
    .tutorial-file-item { display: grid; gap: 8px; place-items: center; min-height: 155px; padding: 12px; border: 2px solid transparent; border-radius: 10px; background: #f3f4f6; color: #404753; }
    .tutorial-file-item.selected { border-color: #2575e8; background: #e7f0ff; color: #0f55a7; }
    .tutorial-file-thumb { display: grid; place-items: center; width: 112px; height: 94px; overflow: hidden; border-radius: 7px; background: linear-gradient(135deg,#111827,#8957e5 54%,#f59e0b); color: #ffffff; font-size: 12px; font-weight: 800; }
    .tutorial-file-footer { display: flex; align-items: center; justify-content: flex-end; gap: 12px; padding: 12px 24px; border-top: 1px solid #d7d9df; background: #fbfbfc; }
    .tutorial-file-button { min-width: 98px; padding: 9px 18px; border: 1px solid #c4c8d0; border-radius: 8px; background: #ffffff; color: #4b5563; text-align: center; font-weight: 700; }
    .tutorial-file-button.primary { border-color: #2575e8; background: #2575e8; color: #ffffff; }
  ` });
  await page.evaluate(() => {
    const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
    const idPattern = /\b(?:site|cust|asset|job|sess|model|album)_[A-Za-z0-9_-]{8,}\b/g;
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
        if (!parent || parent.closest(".tutorial-caption,.tutorial-mask,.tutorial-chip-mask,.tutorial-file-dialog")) continue;
        const parentText = parent.textContent || "";
        let text = node.nodeValue || "";
        const original = text;
        text = text.replace(emailPattern, "demo@masked.local");
        text = text.replace(idPattern, "[private id]");
        text = text.replace(/\b(Credits:\s*)\d{3,}\b/gi, "$1----");
        text = text.replace(/\b\d{3,}\s+credits\b/gi, "---- credits");
        if (/\b(credits|creditos)\b/i.test(parentText)) text = text.replace(/\b\d{3,}\b/g, "----");
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
      Object.assign(mask.style, {
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${Math.max(80, rect.width)}px`,
        height: `${Math.max(28, rect.height)}px`
      });
    }
    function positionAccountMask() {
      const candidates = [...document.querySelectorAll("header *, nav *, [class]")].filter((el) => {
        if (el.closest(".tutorial-chip-mask")) return false;
        const text = (el.textContent || "").trim();
        return text.includes("Demo Account") || /demo@masked\.local/i.test(text);
      });
      const target = candidates.map((el) => ({ el, rect: el.getBoundingClientRect() }))
        .filter((item) => item.rect.width > 80 && item.rect.width < 460 && item.rect.height > 28 && item.rect.height < 128)
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
        Object.assign(highlight.style, {
          left: `${Math.max(0, rect.x - 8)}px`,
          top: `${Math.max(0, rect.y - 8)}px`,
          width: `${Math.max(0, rect.width + 16)}px`,
          height: `${Math.max(0, rect.height + 16)}px`,
          opacity: "1"
        });
      },
      cursor(x, y) { cursor.style.left = `${x}px`; cursor.style.top = `${y}px`; },
      clickPulse() { cursor.classList.add("click"); window.setTimeout(() => cursor.classList.remove("click"), 180); },
      fileDialog(state) {
        const oldBackdrop = document.querySelector(".tutorial-file-backdrop");
        const oldDialog = document.querySelector(".tutorial-file-dialog");
        if (!state) {
          oldBackdrop?.remove();
          oldDialog?.remove();
          return;
        }
        oldBackdrop?.remove();
        oldDialog?.remove();
        const selected = state === "selected";
        const backdrop = document.createElement("div");
        backdrop.className = "tutorial-file-backdrop";
        const dialog = document.createElement("div");
        dialog.className = "tutorial-file-dialog";
        dialog.innerHTML = `
          <div class="tutorial-file-titlebar"><span class="tutorial-file-dot"></span><strong>Choose a photo</strong></div>
          <div class="tutorial-file-toolbar"><span>&lsaquo;</span><span>&rsaquo;</span><span>Columns</span><strong>Desktop</strong><span>Search</span></div>
          <div class="tutorial-file-body">
            <aside class="tutorial-file-sidebar">
              <div>Recents</div><div>Shared</div><div class="active">Desktop</div><div>Documents</div><div>Downloads</div><div>Home</div>
            </aside>
            <div class="tutorial-file-main">
              <div class="tutorial-file-list">
                <div class="tutorial-file-item ${selected ? "selected" : ""}"><div class="tutorial-file-thumb">source</div><strong>source-selfie-clean.jpg</strong></div>
                <div class="tutorial-file-item"><div class="tutorial-file-thumb">portrait</div><strong>portrait-reference.jpg</strong></div>
                <div class="tutorial-file-item"><div class="tutorial-file-thumb">album</div><strong>album-frame.png</strong></div>
              </div>
              <div class="tutorial-file-footer"><span class="tutorial-file-button">Cancel</span><span class="tutorial-file-button primary">${selected ? "Open" : "Choose"}</span></div>
            </div>
          </div>`;
        document.body.append(backdrop, dialog);
      },
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

async function moveTutorialPointer(page, x, y, pulse = false) {
  await page.evaluate(({ x, y, pulse }) => {
    window.__tutorial?.cursor?.(x, y);
    if (pulse) window.__tutorial?.clickPulse?.();
  }, { x, y, pulse }).catch(() => undefined);
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
  await page.goto(absoluteUrl("/login?mode=login"), { waitUntil: "domcontentloaded", timeout: pageTimeoutMs });
  await waitReady(page);
  await installOverlay(page);
  const email = page.locator('input[name="email"]').first();
  await email.waitFor({ state: "visible", timeout: 35_000 });
  return email;
}

async function captureLoginAndAuthenticate(page, context, recorder) {
  const email = await openLogin(page);
  const password = page.locator('input[name="password"]').first();
  const submit = page.locator("form").getByRole("button", { name: /log in|sign in|continue/i }).last();
  const candidates = credentials();
  if (!candidates.length) throw new Error("tutorial_credentials_missing");
  await email.fill(candidates[0].email);
  await password.fill(candidates[0].password);
  await page.evaluate(() => window.__tutorial?.redact?.()).catch(() => undefined);
  await pointAt(page, submit);
  await recorder.capture(timeline.find((segment) => segment.id === "login"));
  await page.evaluate(() => window.__tutorial?.clickPulse?.()).catch(() => undefined);

  let lastError = "login_failed";
  for (const [index, candidate] of candidates.entries()) {
    const response = await context.request.post(apiUrl(`/api/sites/${siteId}/auth/login`), {
      data: { email: candidate.email, password: candidate.password },
      failOnStatusCode: false,
      timeout: 60_000
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok() && data.ok !== false) {
      log("authenticated browser context", { candidate: index + 1, source: candidate.source });
      return;
    }
    lastError = data.error || response.status();
    log(`credential candidate ${index + 1} failed`, { error: lastError, source: candidate.source });
  }
  throw new Error(`customer_login_failed: ${sanitizeText(lastError)}`);
}

async function closeMegaMenus(page) {
  await page.evaluate(() => {
    const closeButtons = [...document.querySelectorAll("button[aria-label]")].filter((button) =>
      /^Close .+ menu$/i.test(button.getAttribute("aria-label") || "")
    );
    closeButtons.forEach((button) => button.click());
  }).catch(() => undefined);
  await page.waitForTimeout(250);
  await page.evaluate(() => window.__tutorial?.redact?.()).catch(() => undefined);
}

async function closePreviewOverlay(page) {
  const closePreview = page.getByRole("button", { name: /^Close preview$/i }).first();
  if (await closePreview.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await closePreview.click({ force: true, timeout: 5_000 }).catch(() => undefined);
    await page.waitForTimeout(250);
  }
  await page.keyboard.press("Escape").catch(() => undefined);
  await page.waitForTimeout(150);
  await page.evaluate(() => window.__tutorial?.redact?.()).catch(() => undefined);
}

async function openWorkspace(page, hash = "#step-create") {
  await page.goto(`${absoluteUrl("/app/create")}${hash}`, { waitUntil: "domcontentloaded", timeout: pageTimeoutMs });
  await waitReady(page);
  await installOverlay(page);
  await closeMegaMenus(page);
  await closePreviewOverlay(page);
  await page.locator("#step-create").waitFor({ state: "visible", timeout: 60_000 });
  await page.getByText(/Choose a photo package/i).first().waitFor({ state: "visible", timeout: 60_000 });
  await page.evaluate(() => document.getElementById("step-create")?.scrollIntoView({ block: "start" })).catch(() => undefined);
}

async function choosePackage(page, recorder) {
  await openWorkspace(page, "#step-create");
  const photoPackages = page.getByRole("button", { name: /^Photo packages$/i }).first();
  if (await photoPackages.isVisible().catch(() => false)) await pointAt(page, photoPackages);
  const packageCard = page.locator(`[data-workspace-package-title="${packageTitle}"]`).first();
  await packageCard.waitFor({ state: "visible", timeout: 60_000 });
  await packageCard.scrollIntoViewIfNeeded().catch(() => undefined);
  await pointAt(page, packageCard);
  await page.evaluate((title) => {
    const button = [...document.querySelectorAll("[data-workspace-package-title]")]
      .find((item) => item.getAttribute("data-workspace-package-title") === title);
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  }, packageTitle);
  await page.evaluate(() => window.__tutorial?.clickPulse?.()).catch(() => undefined);
  await page.waitForTimeout(500);
  const packageDialog = page.locator('[role="dialog"][aria-modal="true"]').filter({ hasText: packageTitle }).first();
  const dialogTitle = packageDialog.getByText(new RegExp(packageTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")).first();
  await dialogTitle.waitFor({ state: "visible", timeout: 30_000 }).catch(() => undefined);
  await pointAt(page, dialogTitle).catch(() => undefined);
  await recorder.capture(timeline.find((segment) => segment.id === "package"));
  const close = packageDialog.getByRole("button", { name: /^Close$/i }).first();
  if (await close.isVisible().catch(() => false)) await clickWithPointer(page, close, { force: true, pauseAfterClickMs: 500 });
}

async function uploadSourcePhoto(page, recorder) {
  await openWorkspace(page, "#step-create");
  const uploadButton = page.locator("aside").getByRole("button", { name: /^Upload$/i }).first();
  await uploadButton.waitFor({ state: "visible", timeout: 45_000 });
  await clickWithPointer(page, uploadButton, { force: true });
  await page.evaluate(() => window.__tutorial?.fileDialog?.("desktop")).catch(() => undefined);
  await moveTutorialPointer(page, 1010, 508);
  await page.waitForTimeout(650);
  await page.evaluate(() => window.__tutorial?.fileDialog?.("selected")).catch(() => undefined);
  await moveTutorialPointer(page, 1210, 860);
  const uploadInput = page.locator('aside input[type="file"]').first();
  await uploadInput.setInputFiles(sourcePhotoPath);
  await page.evaluate(() => window.__tutorial?.fileDialog?.(null)).catch(() => undefined);
  await page.waitForFunction(() => {
    const asideText = document.querySelector("aside")?.textContent || "";
    return /uploaded and selected|1 selected|selected\./i.test(asideText) && !/Uploading 1 sample/i.test(asideText);
  }, undefined, { timeout: 120_000 }).catch(() => undefined);
  const uploadedSample = page.locator("aside").getByText(/Selected|uploaded and selected|1 selected/i).first();
  await pointAt(page, uploadedSample).catch(() => undefined);
  await recorder.capture(timeline.find((segment) => segment.id === "upload"));
}

async function recordWorkspaceOverview(page, recorder) {
  await openWorkspace(page, "#step-create");
  const workspaceHeading = page.getByText(/Start your AI photoshoot/i).first();
  await pointAt(page, workspaceHeading).catch(() => undefined);
  await recorder.capture(timeline.find((segment) => segment.id === "workspace"));
}

async function openReviewDialog(page, recorder) {
  await openWorkspace(page, "#step-create");
  const reviewButton = page.locator("#step-create").getByRole("button", { name: /Review and start|Configure package/i }).first();
  await reviewButton.waitFor({ state: "visible", timeout: 45_000 });
  await clickWithPointer(page, reviewButton, { force: true, pauseAfterClickMs: 500 });
  const dialog = page.locator('[role="dialog"][aria-modal="true"]').filter({ hasText: /Selected uploads|Required credits|Estimated outputs|Photo package/i }).first();
  await dialog.waitFor({ state: "visible", timeout: 45_000 });
  const outputInput = dialog.locator('input[type="number"]').first();
  if (await outputInput.isVisible().catch(() => false)) {
    await outputInput.fill("1");
    await outputInput.blur().catch(() => undefined);
  }
  const promptBox = dialog.locator("textarea").first();
  if (await promptBox.isVisible().catch(() => false)) {
    await pointAt(page, promptBox);
    await promptBox.fill(promptNote);
  }
  const summary = dialog.getByText(/Required credits|Selected uploads|Output/i).first();
  await pointAt(page, summary).catch(() => undefined);
  await recorder.capture(timeline.find((segment) => segment.id === "review"));
}

async function submitJob(page, recorder) {
  const segment = timeline.find((item) => item.id === "start");
  const button = page.locator('[role="dialog"][aria-modal="true"]').getByRole("button", { name: /Start photo package|Start generation|Start tool/i }).first();
  await button.waitFor({ state: "visible", timeout: 45_000 });
  await page.waitForFunction(() => {
    const buttons = [...document.querySelectorAll('[role="dialog"][aria-modal="true"] button')];
    const target = buttons.find((item) => /Start photo package|Start generation|Start tool/i.test(item.textContent || ""));
    return target && !target.disabled;
  }, undefined, { timeout: 90_000 });
  await pointAt(page, button);
  if (!realGeneration) {
    await page.evaluate(() => window.__tutorial?.clickPulse?.()).catch(() => undefined);
    await recorder.capture(segment);
    log("skipped real image generation by request");
    return undefined;
  }
  log("paid create guard", {
    endpoint: `/api/sites/${siteId}/ai/jobs`,
    method: "POST",
    packageTitle,
    outputCount: 1,
    maxPaidAttempts,
    stopCondition: "one accepted job or first create error"
  });
  if (maxPaidAttempts !== 1) throw new Error("paid_attempt_guard_invalid");
  const responsePromise = page.waitForResponse((response) =>
    response.url().includes(`/api/sites/${siteId}/ai/jobs`) && response.request().method() === "POST",
  { timeout: 150_000 });
  await button.click({ timeout: 30_000, force: true });
  await page.evaluate(() => window.__tutorial?.clickPulse?.()).catch(() => undefined);
  const response = await responsePromise;
  const data = await response.json().catch(() => ({}));
  if (!response.ok() || !data.job?.id) {
    throw new Error(`image_job_create_failed: ${sanitizeText(data.error || response.status())}`);
  }
  if (data.workerDispatch?.status === "skipped" || data.workerDispatch?.status === "failed") {
    throw new Error(`image_worker_dispatch_${data.workerDispatch.status}: ${sanitizeText(data.workerDispatch?.error || "generator_not_ready")}`);
  }
  log("image job submitted", {
    jobId: data.job.id,
    reused: Boolean(data.reused),
    workerDispatchStatus: data.workerDispatch?.status,
    creditsReserved: data.job.creditsReserved
  });
  await recorder.capture(segment);
  return String(data.job.id);
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

function imageAssetsForJob(runtimeData, jobId) {
  const assets = Array.isArray(runtimeData?.runtime?.assets) ? runtimeData.runtime.assets : [];
  return assets.filter((asset) => asset?.jobId === jobId && asset?.role === "output" && String(asset.mimeType || "").startsWith("image/"));
}

function providerError(job) {
  const result = job?.resultJson || {};
  const slots = Array.isArray(result.outputSlots) ? result.outputSlots : [];
  const failed = slots.find((slot) => slot?.status === "failed" || slot?.error || slot?.providerFailure);
  return failed?.error || failed?.providerFailure?.code || result.error || result.failure || "image_provider_failed";
}

async function waitForSuccess(page, jobId) {
  const started = Date.now();
  let lastStatus = "unknown";
  while (Date.now() - started < jobTimeoutMs) {
    const data = await runtime(page);
    const job = jobFrom(data, jobId);
    const assets = imageAssetsForJob(data, jobId);
    if (job?.status) lastStatus = job.status;
    if ((job?.status === "succeeded" || job?.status === "partial") && assets.length) {
      log("image job produced output", { jobId, status: job.status, assetCount: assets.length });
      return { job, asset: assets[0] };
    }
    if (job?.status === "failed" || job?.status === "refunded") {
      throw new Error(`image_job_${job.status}: ${sanitizeText(providerError(job))}`);
    }
    log("waiting for image job", { jobId, status: lastStatus, elapsedSeconds: Math.round((Date.now() - started) / 1000) });
    await page.waitForTimeout(pollIntervalMs);
  }
  throw new Error(`image_job_timeout: ${sanitizeText(lastStatus)}`);
}

async function openResults(page) {
  await page.goto(`${absoluteUrl("/app/create")}#resources-all`, { waitUntil: "domcontentloaded", timeout: pageTimeoutMs });
  await waitReady(page);
  await installOverlay(page);
  await closeMegaMenus(page);
  await closePreviewOverlay(page);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (await page.locator("#review-request").isVisible({ timeout: 2_000 }).catch(() => false)) break;
    await page.evaluate(() => {
      const buttons = [...document.querySelectorAll("button")];
      const allButton = buttons.find((button) => /^\s*All\s*$/i.test(button.textContent || ""));
      allButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      window.history.replaceState(null, "", "#resources-all");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
      document.getElementById("resources-all")?.scrollIntoView({ block: "start" });
    }).catch(() => undefined);
    await waitReady(page);
    await page.waitForTimeout(800);
  }
  await page.locator("#review-request").waitFor({ state: "visible", timeout: 30_000 });
}

async function refreshAndRecordProgress(page, recorder) {
  await openResults(page);
  const refresh = page.locator("#review-request").getByRole("button", { name: /Refresh status|Refreshing/i }).first();
  if (await refresh.isVisible().catch(() => false)) {
    await clickWithPointer(page, refresh, { force: true }).catch(() => undefined);
  }
  const progress = page.locator("#review-request").getByText(/Request progress|All assets|generated/i).first();
  await pointAt(page, progress).catch(() => undefined);
  await recorder.capture(timeline.find((segment) => segment.id === "progress"));
}

function assetPreviewUrl(asset) {
  if (asset?.previewUrl) return asset.previewUrl;
  const storageKey = String(asset?.storageKey || "").replace(/\\/g, "/").replace(/^\/+/, "").replace(/^customer-assets\//, "");
  return storageKey ? `/api/local-assets/${storageKey}` : "";
}

async function openGeneratedPreview(page, asset) {
  await openResults(page);
  await page.evaluate((preview) => {
    const normalized = String(preview || "");
    const fileName = normalized.split("?")[0].split("/").filter(Boolean).pop() || "";
    const images = [...document.querySelectorAll("#review-request img")];
    const img = images.find((item) => {
      const src = item.getAttribute("src") || "";
      return (normalized && src.includes(normalized)) || (fileName && src.includes(fileName));
    }) || images[0];
    const button = img?.closest("button");
    if (button) button.click();
  }, assetPreviewUrl(asset)).catch(() => undefined);
  const dialog = page.locator('[role="dialog"][aria-label*="Generated asset preview"]').first();
  if (!await dialog.isVisible({ timeout: 8_000 }).catch(() => false)) {
    const firstImageButton = page.locator("#review-request button:has(img)").first();
    if (await firstImageButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await clickWithPointer(page, firstImageButton, { force: true });
    }
  }
  await dialog.waitFor({ state: "visible", timeout: 30_000 });
  const previewImage = dialog.locator("img").first();
  await pointAt(page, previewImage).catch(() => undefined);
}

async function openHistoricalImagePreview(page) {
  await openResults(page);
  const firstImageButton = page.locator("#review-request button:has(img)").first();
  if (await firstImageButton.isVisible({ timeout: 20_000 }).catch(() => false)) {
    await clickWithPointer(page, firstImageButton, { force: true });
    await page.locator('[role="dialog"][aria-label*="Generated asset preview"]').first().waitFor({ state: "visible", timeout: 20_000 }).catch(() => undefined);
  }
}

async function generateNarration() {
  await fs.mkdir(narrationDir, { recursive: true });
  const sayPath = process.env.TUTORIAL_SAY_PATH || "say";
  const segmentPaths = [];
  for (const [index, segment] of timeline.entries()) {
    const segmentPath = path.join(narrationDir, `segment-${String(index).padStart(2, "0")}.aiff`);
    await run(sayPath, ["-v", process.env.TUTORIAL_VOICE || "Samantha", "-r", process.env.TUTORIAL_VOICE_RATE || "190", "-o", segmentPath, segment.narration]);
    segmentPaths.push(segmentPath);
  }
  const filters = timeline.map((segment, index) =>
    `[${index}:a]apad,atrim=duration=${segment.scaledDuration},asetpts=N/SR/TB[a${index}]`
  );
  const concatInputs = timeline.map((_, index) => `[a${index}]`).join("");
  filters.push(`${concatInputs}concat=n=${timeline.length}:v=0:a=1,apad,atrim=duration=${targetSeconds},asetpts=N/SR/TB[aout]`);
  const args = ["-y"];
  for (const segmentPath of segmentPaths) args.push("-i", segmentPath);
  args.push(
    "-filter_complex", filters.join(";"),
    "-map", "[aout]",
    "-c:a", "aac",
    "-b:a", "128k",
    "-ar", "48000",
    "-ac", "2",
    "-t", String(targetSeconds),
    narrationPath
  );
  await run(ffmpegPath, args);
  return narrationPath;
}

async function buildVideo(voiceoverPath) {
  await run(ffmpegPath, [
    "-y",
    "-framerate", String(captureFps),
    "-i", path.join(framesDir, "frame_%05d.png"),
    "-i", voiceoverPath,
    "-vf", "fps=30,scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,format=yuv420p",
    "-map", "0:v:0",
    "-map", "1:a:0",
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "18",
    "-c:a", "aac",
    "-b:a", "128k",
    "-ar", "48000",
    "-ac", "2",
    "-t", String(targetSeconds),
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
  if (!audio.length) throw new Error("final_video_narration_missing");
  if (duration > targetSeconds + 0.75 || duration < targetSeconds - 0.75) throw new Error(`final_video_duration_invalid: ${duration}`);
  return { duration, width: video.width, height: video.height, audioStreams: audio.length };
}

async function exportSamples() {
  await fs.mkdir(samplesDir, { recursive: true });
  const sampleSeconds = [3, 10, 18, 26, 36, 45, Math.max(1, Math.floor(targetSeconds - 3))].filter((second, index, list) => second < targetSeconds && list.indexOf(second) === index);
  for (const second of sampleSeconds) {
    await run(ffmpegPath, ["-y", "-ss", String(second), "-i", finalOutputPath, "-frames:v", "1", "-q:v", "2", path.join(samplesDir, `sample-${String(second).padStart(2, "0")}s.jpg`)]);
  }
  await run(ffmpegPath, ["-y", "-i", finalOutputPath, "-vf", "fps=1/7,scale=480:270,tile=4x2", "-frames:v", "1", "-update", "1", contactSheetPath]);
}

async function writeFailure(error, extra = {}) {
  await fs.mkdir(runDir, { recursive: true });
  await fs.writeFile(failurePath, `${JSON.stringify(sanitizeJson({ ok: false, error: error instanceof Error ? error.message : String(error), ...extra }), null, 2)}\n`);
}

async function main() {
  await fs.rm(runDir, { recursive: true, force: true });
  await fs.mkdir(framesDir, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });
  await prepareSourcePhoto();
  log("configuration", {
    baseUrl,
    siteId,
    siteSlug,
    targetSeconds,
    realGeneration,
    maxPaidAttempts,
    packageTitle,
    output: finalOutputPath
  });

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, baseURL: baseUrl, colorScheme: "dark", reducedMotion: "reduce", locale: "en-US" });
  const page = await context.newPage();
  page.setDefaultTimeout(pageTimeoutMs);
  page.on("pageerror", (error) => log("browser page error", { error: error.message }));
  page.on("console", (message) => {
    if (message.type() === "error") log("browser console error", { error: message.text().slice(0, 240) });
  });
  const recorder = new Recorder(page);
  const createdJobs = [];
  try {
    await captureLoginAndAuthenticate(page, context, recorder);
    await recordWorkspaceOverview(page, recorder);
    await choosePackage(page, recorder);
    await uploadSourcePhoto(page, recorder);
    await openReviewDialog(page, recorder);
    const jobId = await submitJob(page, recorder);
    let result;
    if (jobId) {
      createdJobs.push(jobId);
      await refreshAndRecordProgress(page, recorder);
      result = await waitForSuccess(page, jobId);
      await openGeneratedPreview(page, result.asset);
    } else {
      await refreshAndRecordProgress(page, recorder);
      await openHistoricalImagePreview(page);
    }
    await page.evaluate(() => window.__tutorial?.highlight?.(null)).catch(() => undefined);
    await recorder.capture(timeline.find((segment) => segment.id === "result"));
    if (recorder.index !== targetFrameCount) throw new Error(`capture_frame_count_invalid: ${recorder.index}`);
    const voiceover = await generateNarration();
    await buildVideo(voiceover);
    const finalProbe = verifyProbe(await probe(finalOutputPath));
    await exportSamples();
    log("tutorial video ready", {
      path: finalOutputPath,
      probe: finalProbe,
      contactSheet: contactSheetPath,
      createdJobs,
      paidCreateAttempts: createdJobs.length
    });
  } catch (error) {
    await writeFailure(error, { createdJobs });
    throw error;
  } finally {
    await browser.close().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(`[image-tutorial] failed: ${sanitizeText(error instanceof Error ? error.stack || error.message : String(error))}`);
  process.exitCode = 1;
});
