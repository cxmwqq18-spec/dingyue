import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import ffmpegStatic from "ffmpeg-static";
import { chromium } from "playwright";
import sharp from "sharp";
import "./load-runtime-env.mjs";
import { ensureMydreamshootsLocalPreviewVideo } from "./tutorial-local-preview-seeds.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const tutorialDevice = String(process.env.TUTORIAL_DEVICE || "desktop").toLowerCase();
const isMobileRecording = tutorialDevice === "mobile";
const baseUrl = (process.env.TUTORIAL_BASE_URL || "https://www.mydreamshoots.com").replace(/\/$/, "");
const siteId = process.env.TUTORIAL_SITE_ID || "site_dreamshoot";
const siteSlug = process.env.TUTORIAL_SITE_SLUG || "mydreamshoots";
const tutorialBrandName = process.env.TUTORIAL_BRAND_NAME || "MyDreamShoots";
const outputDir = path.resolve(repoRoot, process.env.TUTORIAL_OUTPUT_DIR || "output");
const runDir = path.join(outputDir, process.env.TUTORIAL_RUN_SLUG || "mydreamshoots-i2v-tutorial-real-work");
const framesDir = path.join(runDir, "frames");
const samplesDir = path.join(runDir, "samples");
const narrationDir = path.join(runDir, "narration");
const cleanFramePath = path.join(runDir, "source-frame-clean.jpg");
const finalOutputPath = path.resolve(repoRoot, process.env.TUTORIAL_OUTPUT_MP4 || "output/mydreamshoots-i2v-tutorial-45s.mp4");
const providerResultPath = path.join(runDir, "supplier-result.mp4");
const narrationPath = path.join(runDir, "narration.m4a");
const narrationVoicePath = path.join(runDir, "narration-voice.m4a");
const musicBedPath = path.join(runDir, "background-bed.m4a");
const failurePath = path.join(runDir, "failure-status.json");
const contactSheetPath = path.join(runDir, "verification-contact-sheet.jpg");
const cleanFrameSourcePath = path.resolve(repoRoot, process.env.TUTORIAL_SOURCE_FRAME_IMAGE || "public/assets/dreamshoot/generated/homepage-showcase/images/creator-portraits.webp");

const viewport = {
  width: Number(process.env.TUTORIAL_VIEWPORT_WIDTH || (isMobileRecording ? 390 : 1920)),
  height: Number(process.env.TUTORIAL_VIEWPORT_HEIGHT || (isMobileRecording ? 844 : 1080))
};
const outputSize = {
  width: Number(process.env.TUTORIAL_OUTPUT_WIDTH || (isMobileRecording ? 1080 : 1920)),
  height: Number(process.env.TUTORIAL_OUTPUT_HEIGHT || (isMobileRecording ? 1920 : 1080))
};
const deviceScaleFactor = Number(process.env.TUTORIAL_DEVICE_SCALE_FACTOR || (isMobileRecording ? 2 : 1));
const mobileUserAgent = process.env.TUTORIAL_MOBILE_USER_AGENT ||
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const captureFps = Number(process.env.TUTORIAL_CAPTURE_FPS || 5);
const targetSeconds = Number(process.env.TUTORIAL_TARGET_SECONDS || 45);
const headless = process.env.TUTORIAL_HEADLESS !== "0";
const maxAttempts = Math.max(1, Number(process.env.TUTORIAL_MAX_ATTEMPTS || 3));
const jobTimeoutMs = Math.max(60_000, Number(process.env.TUTORIAL_JOB_TIMEOUT_MS || 1_800_000));
const pollIntervalMs = Math.max(5_000, Number(process.env.TUTORIAL_POLL_INTERVAL_MS || 12_000));
const pageTimeoutMs = Math.max(30_000, Number(process.env.TUTORIAL_PAGE_TIMEOUT_MS || 120_000));
process.env.TUTORIAL_HIDE_HISTORICAL_ASSETS = process.env.TUTORIAL_HIDE_HISTORICAL_ASSETS || "1";
const skipRealGeneration = process.env.TUTORIAL_REAL_GENERATION !== "1";
const ffmpegPath = process.env.FFMPEG_PATH || ffmpegStatic || "ffmpeg";
const ffprobePath = process.env.FFPROBE_PATH || siblingFfprobe(ffmpegPath) || "ffprobe";
const includeBackgroundMusic = process.env.TUTORIAL_BACKGROUND_MUSIC !== "0";
const backgroundMusicVolume = Math.max(0, Math.min(1, Number(process.env.TUTORIAL_BACKGROUND_VOLUME || 0.12)));

const promptText = process.env.TUTORIAL_PROMPT_TEXT || `Create a 6-second image-to-video clip from the selected frame. Keep the adult creator's face, hair, outfit, warm studio lighting, microphone, laptop, and background consistent. Add a slow 35mm push-in, gentle hair movement, subtle lamp glow, natural blinking, and a calm confident expression. No extra people, no logos, no watermark, no captions, no distorted hands. End on a steady close frame.`;

const narrationSegments = jsonEnv("TUTORIAL_NARRATION_JSON", [
  { duration: 3, text: `First, sign in to your private ${tutorialBrandName} workspace.` },
  { duration: 3, text: "Open the Image to Video workspace from your account." },
  { duration: 8, text: "Click Upload, choose a clean frame image, and open it in the workspace." },
  { duration: 4, text: "Wait for the frame to finish uploading before continuing." },
  { duration: 4, text: "Select the uploaded image as the reference frame for the clip." },
  { duration: 6, text: "Paste a clear motion prompt, then keep the format at sixteen by nine, seven twenty p, and six seconds." },
  { duration: 4, text: "Click Generate video to submit the request to the active provider." },
  { duration: 6, text: "Track the request in Video results while the provider prepares and delivers the video." },
  { duration: 7, text: "Open the preview, press play, and review the finished video before downloading it." }
]);

const captions = {
  login: "Sign in to your private workspace",
  workspace: "Open the Image to Video workspace",
  upload: "Click Upload and choose a frame image",
  uploaded: "Wait for the uploaded frame to appear",
  select: "Select the frame image to guide the video",
  prompt: "Paste the prompt and keep 16:9 / 720P / 6s",
  generate: "Click Generate video to submit",
  progress: "Track generation progress in Video results",
  result: "Open preview and play the finished video",
  ...jsonEnv("TUTORIAL_CAPTIONS_JSON", {})
};

const captureDurations = {
  login: 3,
  workspace: 3,
  uploadChooser: 4,
  uploadSelected: 4,
  uploaded: 4,
  select: 4,
  prompt: 6,
  generate: 4,
  progress: 6,
  result: 7,
  ...jsonEnv("TUTORIAL_CAPTURE_DURATIONS_JSON", {})
};

const maskNames = listEnv("TUTORIAL_MASK_NAMES", ["Nora Whitman", "Nora", "Aria", "Mira", "Lena", "Rowan"]);

function jsonEnv(name, fallback) {
  const value = process.env[name];
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function listEnv(name, fallback) {
  const value = process.env[name];
  if (!value) return fallback;
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

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
  if (/aidreamcapes/i.test(`${siteId} ${siteSlug} ${tutorialBrandName}`)) {
    pushCredential(
      list,
      process.env.SMOKE_AIDREAMCAPES_CUSTOMER_EMAIL || process.env.SMOKE_CUSTOMER_EMAIL,
      process.env.SMOKE_AIDREAMCAPES_CUSTOMER_PASSWORD || process.env.SMOKE_CUSTOMER_PASSWORD,
      "aidreamcapes_smoke_env"
    );
    pushCredential(
      list,
      "aria@aidreamcapes.localhost",
      process.env.SMOKE_AIDREAMCAPES_CUSTOMER_PASSWORD || process.env.SMOKE_CUSTOMER_PASSWORD || "aria123",
      "aidreamcapes_local_demo"
    );
    pushCredential(list, "1621417163@qq.com", process.env.SMOKE_AIDREAMCAPES_CUSTOMER_PASSWORD || process.env.SMOKE_CUSTOMER_PASSWORD || "aidreamcapes123", "aidreamcapes_demo");
  } else {
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
  }
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
  const text = sanitizeText(JSON.stringify(value ?? null));
  try {
    return JSON.parse(text);
  } catch {
    return { sanitized: text.slice(0, 2000) };
  }
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
  const meta = await sharp(cleanFrameSourcePath).metadata();
  if (!meta.width || !meta.height) throw new Error("source_frame_metadata_missing");
  const cropHeight = Math.floor(meta.height * 0.83);
  const cleanCrop = await sharp(cleanFrameSourcePath).extract({ left: 0, top: 0, width: meta.width, height: cropHeight }).toBuffer();
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
    .tutorial-highlight { display: none !important; position: fixed; z-index: 2147482998; pointer-events: none; opacity: 0; }
    .tutorial-cursor { position: fixed; z-index: 2147482999; width: 44px; height: 44px; transform: translate(-7px,-7px); pointer-events: none; filter: drop-shadow(0 10px 18px rgba(0,0,0,.62)); opacity: 0; transition: left 180ms ease, top 180ms ease, transform 170ms ease, opacity 120ms ease; }
    .tutorial-cursor.visible { opacity: .98; }
    .tutorial-cursor::before { content: ""; position: absolute; left: 0; top: 0; width: 0; height: 0; border-right: 24px solid transparent; border-bottom: 38px solid #ffffff; filter: drop-shadow(0 0 0 #0ea5e9) drop-shadow(0 0 8px rgba(14,165,233,.95)); }
    .tutorial-cursor::after { content: ""; position: absolute; left: 12px; top: 15px; width: 34px; height: 34px; border: 4px solid #38d9ff; border-radius: 999px; background: rgba(56,217,255,.18); box-shadow: 0 0 0 3px rgba(255,255,255,.82), 0 0 24px rgba(56,217,255,.72); opacity: .78; transform: scale(.8); }
    .tutorial-cursor.click { transform: translate(-7px,-7px) scale(.92); }
    .tutorial-cursor.click::after { animation: tutorial-click-ring 720ms ease-out; }
    @keyframes tutorial-click-ring { 0% { opacity: 1; transform: scale(.55); } 70% { opacity: .88; transform: scale(1.28); } 100% { opacity: 0; transform: scale(1.55); } }
    .tutorial-mask { position: fixed; z-index: 2147482997; display: grid; place-items: center; border-radius: 10px; background: rgba(255,255,255,.94); color: #111827; font: 700 17px/1.2 Inter, system-ui, sans-serif; pointer-events: none; box-shadow: inset 0 0 0 1px rgba(17,24,39,.14); }
    .tutorial-chip-mask { position: fixed; z-index: 2147482996; display: grid; place-items: center; min-height: 46px; border-radius: 999px; background: rgba(2,6,23,.95); color: #fff; font: 800 16px/1.2 Inter, system-ui, sans-serif; pointer-events: none; box-shadow: inset 0 0 0 1px rgba(255,255,255,.16); }
    .tutorial-file-backdrop { display: none !important; }
    .tutorial-file-dialog { position: fixed; right: 38px; top: 50%; z-index: 2147482992; width: min(760px, calc(100vw - 96px)); height: 430px; transform: translateY(-50%); overflow: hidden; border: 1px solid #b9bdc7; border-radius: 14px; background: #f5f6f8; color: #20242b; box-shadow: 0 24px 70px rgba(0,0,0,.34); font: 500 14px/1.3 -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif; pointer-events: none; }
    .tutorial-file-titlebar { display: flex; align-items: center; gap: 10px; height: 42px; padding: 0 16px; border-bottom: 1px solid #d7d9df; background: #fbfbfc; }
    .tutorial-file-dot { width: 11px; height: 11px; border-radius: 50%; background: #ff5f57; box-shadow: 19px 0 #febc2e, 38px 0 #28c840; }
    .tutorial-file-toolbar { display: flex; align-items: center; gap: 12px; height: 40px; padding: 0 16px; border-bottom: 1px solid #d7d9df; color: #626975; }
    .tutorial-file-toolbar strong { margin-left: auto; margin-right: auto; color: #303641; font-size: 15px; }
    .tutorial-file-body { display: grid; grid-template-columns: 150px 1fr; height: 348px; }
    .tutorial-file-sidebar { padding: 12px 10px; border-right: 1px solid #d7d9df; background: #eceef2; }
    .tutorial-file-sidebar div { padding: 8px 10px; border-radius: 8px; color: #5e6672; }
    .tutorial-file-sidebar .active { background: #d8e8ff; color: #1264c8; font-weight: 800; }
    .tutorial-file-main { display: grid; grid-template-rows: 1fr 52px; min-width: 0; }
    .tutorial-file-list { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; padding: 14px; align-content: start; background: #ffffff; }
    .tutorial-file-item { display: grid; gap: 6px; place-items: center; min-height: 112px; padding: 8px; border: 2px solid transparent; border-radius: 10px; background: #f3f4f6; color: #404753; }
    .tutorial-file-item.selected { border-color: #2575e8; background: #e7f0ff; color: #0f55a7; }
    .tutorial-file-thumb { display: grid; place-items: center; width: 78px; height: 62px; overflow: hidden; border-radius: 7px; background: linear-gradient(135deg,#2d5e52,#e5a26f 54%,#231a1d); color: #ffffff; font-size: 11px; font-weight: 800; }
    .tutorial-file-footer { display: flex; align-items: center; justify-content: flex-end; gap: 10px; padding: 8px 14px; border-top: 1px solid #d7d9df; background: #fbfbfc; }
    .tutorial-file-button { min-width: 98px; padding: 9px 18px; border: 1px solid #c4c8d0; border-radius: 8px; background: #ffffff; color: #4b5563; text-align: center; font-weight: 700; }
    .tutorial-file-button.primary { border-color: #2575e8; background: #2575e8; color: #ffffff; }
    @media (max-width: 600px) {
      .tutorial-caption { bottom: 12px; max-width: calc(100vw - 24px); padding: 10px 12px; border-radius: 12px; font: 800 15px/1.24 Inter, system-ui, sans-serif; box-shadow: 0 16px 44px rgba(0,0,0,.38); }
      .tutorial-caption::before { width: 8px; height: 8px; margin-right: 7px; vertical-align: 1px; }
      .tutorial-cursor { width: 30px; height: 30px; filter: drop-shadow(0 6px 12px rgba(0,0,0,.56)); }
      .tutorial-cursor::before { border-right-width: 17px; border-bottom-width: 27px; }
      .tutorial-cursor::after { left: 8px; top: 10px; width: 22px; height: 22px; border-width: 3px; }
      .tutorial-mask { border-radius: 8px; font: 700 12px/1.15 Inter, system-ui, sans-serif; }
      .tutorial-chip-mask { min-height: 34px; font: 800 11px/1.15 Inter, system-ui, sans-serif; }
      .tutorial-file-dialog { left: 10px; right: auto; top: 46%; width: calc(100vw - 20px); height: min(410px, calc(100vh - 164px)); transform: translateY(-50%); border-radius: 12px; font-size: 12px; box-shadow: 0 18px 52px rgba(0,0,0,.34); }
      .tutorial-file-titlebar { height: 34px; padding: 0 12px; }
      .tutorial-file-dot { width: 9px; height: 9px; box-shadow: 15px 0 #febc2e, 30px 0 #28c840; }
      .tutorial-file-toolbar { height: 34px; gap: 7px; padding: 0 10px; font-size: 11px; }
      .tutorial-file-toolbar strong { font-size: 12px; }
      .tutorial-file-body { grid-template-columns: 84px 1fr; height: calc(100% - 68px); }
      .tutorial-file-sidebar { padding: 8px 6px; }
      .tutorial-file-sidebar div { padding: 7px 6px; font-size: 11px; }
      .tutorial-file-sidebar div:nth-child(n+5) { display: none; }
      .tutorial-file-main { grid-template-rows: 1fr 44px; }
      .tutorial-file-list { grid-template-columns: 1fr; gap: 8px; padding: 10px; overflow: hidden; }
      .tutorial-file-item { min-height: 64px; grid-template-columns: 48px minmax(0,1fr); justify-items: start; gap: 8px; padding: 7px; }
      .tutorial-file-item:nth-child(n+3) { display: none; }
      .tutorial-file-thumb { width: 48px; height: 42px; font-size: 9px; }
      .tutorial-file-item strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .tutorial-file-footer { gap: 7px; padding: 6px 10px; }
      .tutorial-file-button { min-width: 70px; padding: 7px 10px; border-radius: 7px; }
    }
  ` });
  await page.evaluate(({ maskNames }) => {
    const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
    const names = maskNames;
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
        const parentText = parent.textContent || "";
        text = text.replace(emailPattern, "demo@masked.local");
        text = text.replace(/\b(Credits:\s*)\d{3,}\b/gi, "$1----");
        text = text.replace(/\b\d{3,}\s+credits\b/gi, "---- credits");
        if (/\b(credits|creditos)\b/i.test(parentText)) text = text.replace(/\b\d{3,}\b/g, "----");
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
      clickPulse() {
        cursor.classList.add("visible", "click");
        window.setTimeout(() => cursor.classList.remove("click"), 360);
        window.setTimeout(() => cursor.classList.remove("visible"), 1100);
      },
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
        const backdrop = document.createElement("div");
        backdrop.className = "tutorial-file-backdrop";
        const dialog = document.createElement("div");
        dialog.className = "tutorial-file-dialog";
        const selected = state === "selected";
        dialog.innerHTML = `
          <div class="tutorial-file-titlebar"><span class="tutorial-file-dot"></span><strong>Choose a file</strong></div>
          <div class="tutorial-file-toolbar"><span>&lsaquo;</span><span>&rsaquo;</span><span>Columns</span><strong>${state === "image" || selected ? "image" : "Desktop"}</strong><span>Search</span></div>
          <div class="tutorial-file-body">
            <aside class="tutorial-file-sidebar">
              <div>Recents</div><div>Shared</div><div class="active">Desktop</div><div>Documents</div><div>Downloads</div><div>Home</div>
            </aside>
            <div class="tutorial-file-main">
              <div class="tutorial-file-list">
                <div class="tutorial-file-item ${selected ? "selected" : ""}"><div class="tutorial-file-thumb">images.jpeg</div><strong>images.jpeg</strong></div>
                <div class="tutorial-file-item ${selected ? "selected" : ""}"><div class="tutorial-file-thumb">source-frame-clean.jpg</div><strong>source-frame-clean.jpg</strong></div>
                <div class="tutorial-file-item"><div class="tutorial-file-thumb">creator-frame.png</div><strong>creator-frame.png</strong></div>
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
    window.__tutorial.cursor(Math.min(window.innerWidth - 18, Math.max(18, window.innerWidth * 0.62)), Math.min(window.innerHeight - 18, Math.max(18, window.innerHeight * 0.72)));
    window.__tutorial.redact();
    window.setInterval(() => window.__tutorial?.redact?.(), 250);
  }, { maskNames });
}

async function setCaption(page, caption) {
  await page.evaluate((text) => window.__tutorial?.setCaption?.(text), caption).catch(() => undefined);
}

async function moveTutorialPointer(page, x, y, pulse = false) {
  await page.evaluate(({ x, y, pulse }) => {
    const clampedX = Math.min(window.innerWidth - 18, Math.max(18, x));
    const clampedY = Math.min(window.innerHeight - 18, Math.max(18, y));
    window.__tutorial?.cursor?.(clampedX, clampedY);
    if (pulse) window.__tutorial?.clickPulse?.();
  }, { x, y, pulse }).catch(() => undefined);
}

async function pointAt(page, locator) {
  const box = await locator.boundingBox().catch(() => null);
  if (!box) return;
  await page.evaluate((rect) => {
    window.__tutorial?.highlight?.(rect);
    const x = Math.min(window.innerWidth - 18, Math.max(18, rect.x + rect.width / 2));
    const y = Math.min(window.innerHeight - 18, Math.max(18, rect.y + rect.height / 2));
    window.__tutorial?.cursor?.(x, y);
  }, { x: box.x, y: box.y, width: box.width, height: box.height }).catch(() => undefined);
}

async function clickWithPointer(page, locator, options = {}) {
  await pointAt(page, locator);
  await page.waitForTimeout(options.pauseBeforeClickMs ?? 320);
  await page.evaluate(() => window.__tutorial?.clickPulse?.()).catch(() => undefined);
  await page.waitForTimeout(120);
  await locator.click({ timeout: options.timeout ?? 30_000, force: options.force ?? false });
  await page.evaluate(() => window.__tutorial?.clickPulse?.()).catch(() => undefined);
  await page.waitForTimeout(options.pauseAfterClickMs ?? 500);
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
  await page.evaluate(() => window.__tutorial?.clickPulse?.()).catch(() => undefined);
  await recorder.captureFor(captureDurations.login, captions.login);
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
  const clearButton = page.getByLabel(/Clear selected video frames/i).first();
  if (!await clearButton.isVisible().catch(() => false)) return;
  if (await clearButton.isDisabled().catch(() => true)) return;
  await clickWithPointer(page, clearButton, { force: true }).catch(() => undefined);
  await page.waitForFunction(() => {
    return !document.querySelector("#studio-console-video button[aria-pressed='true']");
  }, undefined, { timeout: 15_000 }).catch(() => undefined);
}

async function uploadFrame(page, recorder, recordChooser) {
  await clearSelectedFrames(page);
  await clearSelectedFrames(page);
  const uploadResponsePromise = page.waitForResponse((response) =>
    response.url().includes(`/api/sites/${siteId}/customers/`) && response.url().includes("/assets") && response.request().method() === "POST",
  { timeout: 120_000 }).catch(() => null);
  if (recordChooser) {
    const uploadButton = page.locator("#studio-console-video").getByRole("button", { name: /^Upload$/i }).first();
    await uploadButton.waitFor({ state: "visible", timeout: 45_000 });
    await clickWithPointer(page, uploadButton, { force: true });
    await page.evaluate(() => window.__tutorial?.fileDialog?.("desktop")).catch(() => undefined);
    await moveTutorialPointer(page, 1030, 510);
    await recorder.captureFor(captureDurations.uploadChooser, captions.upload);
    await page.evaluate(() => window.__tutorial?.fileDialog?.("selected")).catch(() => undefined);
    await moveTutorialPointer(page, 1210, 860);
    await recorder.captureFor(captureDurations.uploadSelected, captions.upload);
    await page.locator('#studio-console-video input[type="file"]').first().setInputFiles(cleanFramePath);
    await page.evaluate(() => window.__tutorial?.fileDialog?.(null)).catch(() => undefined);
  } else {
    await page.locator('#studio-console-video input[type="file"]').first().setInputFiles(cleanFramePath);
  }
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

async function selectUploadedFrame(page) {
  const selectionReady = async (timeout = 8_000) => page.waitForFunction(() => {
    const root = document.querySelector("#studio-console-video");
    if (!root) return false;
    const text = root.textContent || "";
    return Boolean(root.querySelector("button[aria-pressed='true']")) ||
      /[1-7]\s+of\s+7\s+selected/i.test(text) ||
      /[1-7]\/7\s+(selected|frames)/i.test(text) ||
      /Drag or use arrows/i.test(text);
  }, undefined, { timeout });

  const selectedButton = page.locator('#studio-console-video button[aria-pressed="true"]').first();
  if (await selectedButton.isVisible().catch(() => false)) {
    await pointAt(page, selectedButton).catch(() => undefined);
    await selectionReady().catch(() => undefined);
    return;
  }

  const preferredFrame = page
    .locator('#studio-console-video button[aria-pressed="false"]:not([disabled])')
    .filter({ hasText: /source-frame-clean|frame_/i })
    .first();
  const fallbackFrame = page.locator('#studio-console-video button[aria-pressed="false"]:not([disabled]):has(img)').first();
  const frameButton = await preferredFrame.isVisible().catch(() => false) ? preferredFrame : fallbackFrame;
  await frameButton.waitFor({ state: "visible", timeout: 45_000 });
  await frameButton.scrollIntoViewIfNeeded().catch(() => undefined);
  await clickWithPointer(page, frameButton, { force: true, pauseBeforeClickMs: 460, pauseAfterClickMs: 700 });

  try {
    await selectionReady(10_000);
  } catch {
    const clicked = await page.evaluate(() => {
      const root = document.querySelector("#studio-console-video");
      if (!root) return false;
      const buttons = Array.from(root.querySelectorAll("button[aria-pressed='false']:not([disabled])"));
      const preferred = buttons.find((button) => /source-frame-clean|frame_/i.test(button.textContent || "")) ||
        buttons.find((button) => button.querySelector("img"));
      if (!preferred) return false;
      preferred.scrollIntoView({ block: "center", inline: "center" });
      preferred.click();
      return true;
    });
    if (!clicked) throw new Error("video_frame_select_button_missing");
    await selectionReady(15_000);
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
    if (await resultsSection.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await installOverlay(page);
      await closeMegaMenus(page);
      return;
    }
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
    await closeMegaMenus(page);
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
  await closeMegaMenus(page);
}

async function showGenerateClickOnly(page) {
  const button = page.locator("#video-step-generate").getByRole("button", { name: /Generate video/i }).first();
  await button.waitFor({ state: "visible", timeout: 45_000 });
  await pointAt(page, button);
  await page.evaluate(() => window.__tutorial?.clickPulse?.()).catch(() => undefined);
  log("skipped real supplier generation by request");
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

async function focusGenerationProgress(page) {
  await openResults(page);
  const progressHeading = page.locator("#video-workspace-videos").getByText(/Video request progress/i).first();
  await progressHeading.scrollIntoViewIfNeeded().catch(() => undefined);
  await pointAt(page, progressHeading).catch(() => undefined);
  await page.evaluate(() => window.__tutorial?.redact?.()).catch(() => undefined);
}

async function openHistoricalVideoPreview(page) {
  await openResults(page);
  await closeMegaMenus(page);
  const resultsSection = page.locator("#video-workspace-videos").first();
  await resultsSection.scrollIntoViewIfNeeded().catch(() => undefined);
  const freshPreview = resultsSection.locator('button').filter({ hasText: /Fresh draft video preview/i }).first();
  if (await freshPreview.isVisible().catch(() => false)) {
    await clickWithPointer(page, freshPreview, { force: true, timeout: 30_000 });
  } else {
    const preview = resultsSection.locator('button:has-text("Open preview")').first();
    await preview.waitFor({ state: "visible", timeout: 20_000 });
    await clickWithPointer(page, preview, { force: true, timeout: 30_000 });
  }
  const dialog = page.locator('[role="dialog"][aria-label*="Generated asset preview"]').first();
  await dialog.waitFor({ state: "visible", timeout: 20_000 });
  const video = dialog.locator("video").first();
  await video.waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForFunction(() => {
    const dialog = document.querySelector('[role="dialog"][aria-label*="Generated asset preview"]');
    const video = dialog?.querySelector("video");
    return Boolean(video && video.readyState >= 1 && Number.isFinite(video.duration) && video.duration > 0);
  }, undefined, { timeout: 20_000 });
  const box = await video.boundingBox().catch(() => null);
  if (!box) throw new Error("historical_video_preview_missing_box");
  await moveTutorialPointer(page, box.x + box.width / 2, box.y + box.height / 2, true);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2).catch(() => undefined);
  await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"][aria-label*="Generated asset preview"]');
    const video = dialog?.querySelector("video");
    if (video) {
      video.muted = true;
      void video.play().catch(() => undefined);
    }
  }).catch(() => undefined);
  await page.waitForFunction(() => {
    const dialog = document.querySelector('[role="dialog"][aria-label*="Generated asset preview"]');
    const video = dialog?.querySelector("video");
    return Boolean(video && video.currentTime > 0.25 && !video.paused);
  }, undefined, { timeout: 10_000 });
  await closeMegaMenus(page);
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

async function generateNarration() {
  await fs.mkdir(narrationDir, { recursive: true });
  const sayPath = process.env.TUTORIAL_SAY_PATH || "say";
  const segmentPaths = [];
  for (const [index, segment] of narrationSegments.entries()) {
    const segmentPath = path.join(narrationDir, `segment-${String(index).padStart(2, "0")}.aiff`);
    await run(sayPath, ["-v", process.env.TUTORIAL_VOICE || "Samantha", "-r", process.env.TUTORIAL_VOICE_RATE || "195", "-o", segmentPath, segment.text]);
    segmentPaths.push(segmentPath);
  }
  const filters = narrationSegments.map((segment, index) =>
    `[${index}:a]apad,atrim=duration=${segment.duration},asetpts=N/SR/TB[a${index}]`
  );
  const concatInputs = narrationSegments.map((_, index) => `[a${index}]`).join("");
  filters.push(`${concatInputs}concat=n=${narrationSegments.length}:v=0:a=1,apad,atrim=duration=${targetSeconds},asetpts=N/SR/TB[aout]`);
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
    narrationVoicePath
  );
  await run(ffmpegPath, args);
  if (!includeBackgroundMusic || backgroundMusicVolume <= 0) {
    await fs.copyFile(narrationVoicePath, narrationPath);
    return narrationPath;
  }
  await generateBackgroundMusic();
  await run(ffmpegPath, [
    "-y",
    "-i", narrationVoicePath,
    "-i", musicBedPath,
    "-filter_complex", `[0:a]volume=1.0[voice];[1:a]volume=${backgroundMusicVolume}[music];[voice][music]amix=inputs=2:duration=first:dropout_transition=0,alimiter=limit=0.98[aout]`,
    "-map", "[aout]",
    "-c:a", "aac",
    "-b:a", "128k",
    "-ar", "48000",
    "-ac", "2",
    "-t", String(targetSeconds),
    narrationPath
  ]);
  return narrationPath;
}

async function generateBackgroundMusic() {
  const fadeOutStart = Math.max(0, targetSeconds - 3);
  const filters = [
    `[0:a]volume=0.34,afade=t=in:st=0:d=2,afade=t=out:st=${fadeOutStart}:d=3[a0]`,
    `[1:a]volume=0.22,afade=t=in:st=0:d=2,afade=t=out:st=${fadeOutStart}:d=3[a1]`,
    `[2:a]volume=0.18,afade=t=in:st=0:d=2,afade=t=out:st=${fadeOutStart}:d=3[a2]`,
    "[a0][a1][a2]amix=inputs=3:normalize=0,lowpass=f=1300,highpass=f=90,alimiter=limit=0.92[aout]"
  ];
  await run(ffmpegPath, [
    "-y",
    "-f", "lavfi",
    "-i", `sine=frequency=196:sample_rate=48000:duration=${targetSeconds}`,
    "-f", "lavfi",
    "-i", `sine=frequency=246.94:sample_rate=48000:duration=${targetSeconds}`,
    "-f", "lavfi",
    "-i", `sine=frequency=329.63:sample_rate=48000:duration=${targetSeconds}`,
    "-filter_complex", filters.join(";"),
    "-map", "[aout]",
    "-c:a", "aac",
    "-b:a", "96k",
    "-ar", "48000",
    "-ac", "2",
    "-t", String(targetSeconds),
    musicBedPath
  ]);
}

async function buildVideo(frameCount, voiceoverPath) {
  const videoFilter = isMobileRecording
    ? `fps=30,scale=${outputSize.width}:${outputSize.height}:force_original_aspect_ratio=decrease,pad=${outputSize.width}:${outputSize.height}:(ow-iw)/2:(oh-ih)/2:color=0x07090d,format=yuv420p`
    : `fps=30,scale=${outputSize.width}:${outputSize.height}:force_original_aspect_ratio=increase,crop=${outputSize.width}:${outputSize.height},format=yuv420p`;
  await run(ffmpegPath, [
    "-y",
    "-framerate", String(captureFps),
    "-i", path.join(framesDir, "frame_%05d.png"),
    "-i", voiceoverPath,
    "-frames:v", String(Math.round(frameCount * (30 / captureFps))),
    "-vf", videoFilter,
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
  if (Number(video.width) !== outputSize.width || Number(video.height) !== outputSize.height) throw new Error(`final_video_dimensions_invalid: ${video.width}x${video.height}`);
  if (!audio.length) throw new Error("final_video_narration_missing");
  if (Math.abs(duration - targetSeconds) > 0.75) throw new Error(`final_video_duration_invalid: ${duration}`);
  return { duration, width: video.width, height: video.height, audioStreams: audio.length };
}

async function exportSamples() {
  await fs.mkdir(samplesDir, { recursive: true });
  const sampleSeconds = [3, 10, 18, 25, 34, 41, Math.max(1, targetSeconds - 6), Math.max(1, targetSeconds - 2)]
    .map((second) => Math.min(Math.max(1, Math.round(second)), Math.max(1, Math.floor(targetSeconds - 1))))
    .filter((second, index, list) => list.indexOf(second) === index);
  for (const second of sampleSeconds) {
    await run(ffmpegPath, ["-y", "-ss", String(second), "-i", finalOutputPath, "-frames:v", "1", "-q:v", "2", path.join(samplesDir, `sample-${String(second).padStart(2, "0")}s.jpg`)]);
  }
  const contactSheetStep = Math.max(4, Math.ceil(targetSeconds / 8));
  const contactSheetScale = isMobileRecording ? "270:480" : "480:270";
  await run(ffmpegPath, ["-y", "-i", finalOutputPath, "-vf", `fps=1/${contactSheetStep},scale=${contactSheetScale},tile=4x2`, "-frames:v", "1", "-update", "1", contactSheetPath]);
}

async function writeFailure(error, extra = {}) {
  await fs.mkdir(runDir, { recursive: true });
  await fs.writeFile(failurePath, `${JSON.stringify(sanitizeJson({ ok: false, error: error instanceof Error ? error.message : String(error), ...extra }), null, 2)}\n`);
}

async function main() {
  await fs.rm(runDir, { recursive: true, force: true });
  await fs.mkdir(framesDir, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });
  if (skipRealGeneration && siteId === "site_dreamshoot") await ensureMydreamshootsLocalPreviewVideo();
  await prepareCleanFrame();
  log("prepared clean upload frame", { path: cleanFramePath, device: tutorialDevice, viewport, outputSize });

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor,
    isMobile: isMobileRecording,
    hasTouch: isMobileRecording,
    ...(isMobileRecording ? { userAgent: mobileUserAgent } : {}),
    baseURL: baseUrl,
    colorScheme: "dark",
    reducedMotion: "reduce",
    locale: "en-US"
  });
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
    await recorder.captureFor(captureDurations.workspace, captions.workspace);

    let success;
    let lastError;
    const captured = { upload: false, uploaded: false, select: false, prompt: false, generate: false, progress: false };
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await openWorkspace(page, "#step-video");
        await uploadFrame(page, recorder, !captured.upload);
        if (!captured.upload) {
          captured.upload = true;
        }
        if (!captured.uploaded) {
          await recorder.captureFor(captureDurations.uploaded, captions.uploaded);
          captured.uploaded = true;
        }
        await selectUploadedFrame(page);
        if (!captured.select) {
          await recorder.captureFor(captureDurations.select, captions.select);
          captured.select = true;
        }
        await configurePrompt(page);
        if (!captured.prompt) {
          await recorder.captureFor(captureDurations.prompt, captions.prompt);
          captured.prompt = true;
        }
        if (skipRealGeneration) {
          await showGenerateClickOnly(page);
          if (!captured.generate) {
            await recorder.captureFor(captureDurations.generate, captions.generate);
            captured.generate = true;
          }
          await focusGenerationProgress(page);
          if (!captured.progress) {
            await recorder.captureFor(captureDurations.progress, captions.progress);
            captured.progress = true;
          }
          success = { skippedRealGeneration: true };
          break;
        }
        const jobId = await submitJob(page);
        jobIds.push(jobId);
        if (!captured.generate) {
          await openResults(page);
          await recorder.captureFor(captureDurations.generate, captions.generate);
          captured.generate = true;
        }
        if (!captured.progress) {
          await focusGenerationProgress(page);
          await recorder.captureFor(captureDurations.progress, captions.progress);
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
    await recorder.captureFor(captureDurations.result, captions.result);
    const expectedFrameCount = Math.round(targetSeconds * captureFps);
    if (recorder.index !== expectedFrameCount) throw new Error(`capture_frame_count_invalid: ${recorder.index}`);
    const voiceover = await generateNarration();
    await buildVideo(recorder.index, voiceover);
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
