import fs from "node:fs/promises";
import fsSync from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import ffmpegStatic from "ffmpeg-static";
import { chromium } from "playwright";
import sharp from "sharp";
import "./load-runtime-env.mjs";
import {
  ensureMydreamshootsTutorialSampleAssets,
  ensureMydreamshootsLocalPendingPreviewImage,
  ensureMydreamshootsLocalPreviewImage
} from "./tutorial-local-preview-seeds.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const tutorialDevice = String(process.env.TUTORIAL_DEVICE || "desktop").toLowerCase();
const isMobileRecording = tutorialDevice === "mobile";
const baseUrl = (process.env.TUTORIAL_BASE_URL || "http://localhost:3002").replace(/\/$/, "");
const siteId = process.env.TUTORIAL_SITE_ID || "site_dreamshoot";
const siteSlug = process.env.TUTORIAL_SITE_SLUG || "mydreamshoots";
const brandName = process.env.TUTORIAL_BRAND_NAME || (siteSlug === "aidreamcapes" ? "Aidreamcapes" : "MyDreamShoots");
const isMyDreamShootsSite = /mydreamshoots/i.test(`${siteId} ${siteSlug} ${brandName}`);
if (isMyDreamShootsSite) process.env.TUTORIAL_CUSTOMER_EMAIL = process.env.TUTORIAL_CUSTOMER_EMAIL || "1621417163@qq.com";
const redactPrivateData = process.env.TUTORIAL_REDACT_PRIVATE_DATA
  ? process.env.TUTORIAL_REDACT_PRIVATE_DATA === "1"
  : !isMyDreamShootsSite;
const stopWhenFlowComplete = process.env.TUTORIAL_STOP_WHEN_FLOW_COMPLETE
  ? process.env.TUTORIAL_STOP_WHEN_FLOW_COMPLETE === "1"
  : isMyDreamShootsSite;
const tutorialKey = process.env.TUTORIAL_RUN_KEY || `${siteSlug}-ai-image-tutorial`;
const outputDir = path.resolve(repoRoot, process.env.TUTORIAL_OUTPUT_DIR || "output");
const runDir = path.join(outputDir, process.env.TUTORIAL_WORK_DIR || `${tutorialKey}-work`);
const framesDir = path.join(runDir, "frames");
const samplesDir = path.join(runDir, "samples");
const narrationDir = path.join(runDir, "narration");
const sourcePhotoPath = path.join(runDir, "source-selfie-clean.jpg");
const partnerPhotoPath = path.join(runDir, "partner-selfie-clean.jpg");
const finalOutputPath = path.resolve(repoRoot, process.env.TUTORIAL_OUTPUT_MP4 || `output/${tutorialKey}-55s.mp4`);
const narrationPath = path.join(runDir, "narration.m4a");
const narrationWithClicksPath = path.join(runDir, "narration-with-clicks.m4a");
const mouseClickSoundPath = path.join(runDir, "mouse-click.wav");
const failurePath = path.join(runDir, "failure-status.json");
const contactSheetPath = path.join(runDir, "verification-contact-sheet.jpg");
const clickSoundTimes = [];
let captureFrameCursor = 0;

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
const targetSeconds = Number(process.env.TUTORIAL_TARGET_SECONDS || 55);
const headless = process.env.TUTORIAL_HEADLESS !== "0";
const pageTimeoutMs = Math.max(30_000, Number(process.env.TUTORIAL_PAGE_TIMEOUT_MS || 120_000));
const jobTimeoutMs = Math.max(60_000, Number(process.env.TUTORIAL_JOB_TIMEOUT_MS || 1_200_000));
const pollIntervalMs = Math.max(5_000, Number(process.env.TUTORIAL_POLL_INTERVAL_MS || 12_000));
const realGeneration = process.env.TUTORIAL_REAL_GENERATION === "1";
const maxPaidAttempts = realGeneration ? Math.min(1, Math.max(1, Number(process.env.TUTORIAL_MAX_PAID_ATTEMPTS || 1))) : 0;
process.env.TUTORIAL_HIDE_HISTORICAL_ASSETS = process.env.TUTORIAL_HIDE_HISTORICAL_ASSETS || "0";
const hideHistoricalAssets = process.env.TUTORIAL_HIDE_HISTORICAL_ASSETS === "1";
const reuseJobId = process.env.TUTORIAL_REUSE_JOB_ID || "";
const ffmpegPath = process.env.FFMPEG_PATH || ffmpegStatic || "ffmpeg";
const ffprobePath = process.env.FFPROBE_PATH || siblingFfprobe(ffmpegPath) || "ffprobe";

const packageTitle = process.env.TUTORIAL_PACKAGE_TITLE || "Valentine Photos";
const promptNote = process.env.TUTORIAL_PROMPT_NOTE ||
  "Warm romantic portrait with soft date-night lighting, natural expression, clean face detail, polished private album finish, no logos, no text, no watermark.";
const tutorialSampleCustomerId = process.env.TUTORIAL_SAMPLE_CUSTOMER_ID ||
  (siteId === "site_dreamshoot" ? "cust_dreamshoot_mqq9gas9_i1vjal" : "");
const tutorialPrimarySampleIds = parseCsv(process.env.TUTORIAL_PRIMARY_SAMPLE_IDS ||
  (siteId === "site_dreamshoot" ? "asset_mscue5vm_2sw2kb" : ""));
const tutorialPartnerSampleIds = parseCsv(process.env.TUTORIAL_PARTNER_SAMPLE_IDS ||
  (siteId === "site_dreamshoot" ? "asset_mscs4baw_a5q3d5" : ""));
const tutorialPrimarySampleTokens = parseCsv(process.env.TUTORIAL_PRIMARY_SAMPLE_TOKENS ||
  (siteId === "site_dreamshoot" ? "1256a1cb-c7a0-4e78-a7ef-565f5978118d-images-1-.webp" : ""));
const tutorialPartnerSampleTokens = parseCsv(process.env.TUTORIAL_PARTNER_SAMPLE_TOKENS ||
  (siteId === "site_dreamshoot" ? "2c85aa19-08be-4107-9447-13d890ee969e-source-selfie-clean.webp" : ""));
const useExistingTutorialSamples = process.env.TUTORIAL_USE_EXISTING_SAMPLES !== "0" &&
  tutorialSampleCustomerId &&
  tutorialPrimarySampleIds.length > 0 &&
  tutorialPartnerSampleIds.length > 0;
const directTutorialCustomerSession = process.env.TUTORIAL_DIRECT_CUSTOMER_SESSION
  ? process.env.TUTORIAL_DIRECT_CUSTOMER_SESSION === "1"
  : isLocalBaseUrl() && isMyDreamShootsSite && useExistingTutorialSamples;
const createdTutorialSessionIds = [];

const baseTimeline = isMyDreamShootsSite
  ? [
      { id: "login", duration: 4, caption: "Sign in to your private workspace", narration: `First, sign in to your private ${brandName} workspace.` },
      { id: "pricing", duration: 5, caption: "Choose a credit plan before generating", narration: "After login, review the real credit plans, then enter the workspace." },
      { id: "workspace", duration: 6, caption: "Scroll down to the couple upload area", narration: "Open the AI photo workspace and scroll down to the couple upload area." },
      { id: "package", duration: 5, caption: "Choose Valentine Photos", narration: "Choose Valentine Photos to set the romantic package, credit cost, and output count." },
      { id: "upload", duration: 9, caption: "Select both couple source photos", narration: "In couple mode, choose a primary photo and a partner photo before generation." },
      { id: "review", duration: 8, caption: "Configure the package for both of us", narration: "Configure the Valentine package, keep one output, and confirm both selected uploads." },
      { id: "start", duration: 4, caption: "Start the photo generation request", narration: `Start generation and let ${brandName} create the photo request.` },
      { id: "progress", duration: 4, caption: "Image delivered successfully", narration: "Pause on the delivered request, then open the preview." },
      { id: "result", duration: 3, caption: "Open the generated image", narration: "Open the finished Valentine image in the private gallery." }
    ]
  : [
      { id: "login", duration: 5, caption: "Sign in to your private workspace", narration: `First, sign in to your private ${brandName} workspace.` },
      { id: "workspace", duration: 6, caption: "Open the AI photo workspace", narration: "Open the private workspace where uploads, credits, and results stay together." },
      { id: "package", duration: 7, caption: "Choose Valentine Photos", narration: "Choose Valentine Photos to set the romantic package, credit cost, and output count." },
      { id: "upload", duration: 8, caption: "Select the two source photos", narration: "Select the primary photo and the partner photo, so the Valentine package follows both references." },
      { id: "review", duration: 9, caption: "Review package details and selected uploads", narration: "Review the selected uploads, creative direction, credits, and final output count." },
      { id: "start", duration: 5, caption: "Start the photo generation request", narration: `Start generation and let ${brandName} create the photo request.` },
      { id: "progress", duration: 2, caption: "Watch the request begin generating", narration: "Show the request running briefly, then skip the wait." },
      { id: "result", duration: 13, caption: "Open and review the generated image", narration: "Open the finished Valentine image and review it in the private gallery." }
    ];
const naturalFrameCount = baseTimeline.reduce((sum, segment) => sum + Math.max(1, Math.round(segment.duration * captureFps)), 0);
const targetFrameCount = stopWhenFlowComplete ? naturalFrameCount : Math.round(targetSeconds * captureFps);
const finalDurationSeconds = targetFrameCount / captureFps;
const timeline = buildTimeline(baseTimeline, targetFrameCount, captureFps, { scaleToTarget: !stopWhenFlowComplete });

function siblingFfprobe(binary) {
  if (!binary || binary === "ffmpeg") return undefined;
  const candidate = path.join(path.dirname(binary), "ffprobe");
  return fsSync.existsSync(candidate) ? candidate : undefined;
}

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildTimeline(segments, frameCount, fps, options = {}) {
  if (!options.scaleToTarget) {
    return segments.map((segment) => {
      const frames = Math.max(1, Math.round(segment.duration * fps));
      return { ...segment, frames, scaledDuration: frames / fps };
    });
  }
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

function pushCredential(list, email, password, source) {
  if (!email || !password) return;
  list.push({ email, password, source });
}

function credentials() {
  const list = [];
  pushCredential(list, process.env.TUTORIAL_CUSTOMER_EMAIL, process.env.TUTORIAL_CUSTOMER_PASSWORD, "tutorial_env");
  if (/aidreamcapes/i.test(`${siteId} ${siteSlug} ${brandName}`)) {
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
    pushCredential(list, "1621417163@qq.com", process.env.SMOKE_CUSTOMER_PASSWORD || "mydreamshoots123", "production_demo");
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
  }
  const seen = new Set();
  return list.filter((item) => {
    const key = `${item.email}\n${item.password}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function csrfCookieNameForCustomer(targetSiteId) {
  return `customer_csrf_${targetSiteId}`;
}

function signCsrf(scope, sessionId, nonce) {
  const secret = process.env.CSRF_SECRET || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "dev-csrf-secret-change-me";
  return crypto.createHmac("sha256", secret).update(`${scope}:${sessionId}:${nonce}`).digest("base64url");
}

function createCsrfTokenForSession(scope, sessionId) {
  const nonce = crypto.randomBytes(24).toString("base64url");
  return `${nonce}.${signCsrf(scope, sessionId, nonce)}`;
}

async function createDirectCustomerSession(context, email) {
  if (!directTutorialCustomerSession || !email) return false;
  const prisma = new PrismaClient();
  try {
    const normalizedEmail = String(email).trim().toLowerCase();
    const customer = await prisma.customer.findUnique({
      where: { siteId_email: { siteId, email: normalizedEmail } },
      select: { id: true, email: true, name: true, siteId: true }
    });
    if (!customer) {
      log("direct tutorial customer session skipped", { reason: "customer_not_found", email: normalizedEmail });
      return false;
    }
    const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000);
    const sessionId = `sess_tutorial_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
    await prisma.customerSession.create({
      data: {
        id: sessionId,
        siteId,
        customerId: customer.id,
        expiresAt
      }
    });
    createdTutorialSessionIds.push(sessionId);
    const csrfToken = createCsrfTokenForSession(`customer:${siteId}`, sessionId);
    const expires = Math.floor(expiresAt.getTime() / 1000);
    await context.addCookies([
      {
        name: `customer_session_${siteId}`,
        value: sessionId,
        url: baseUrl,
        httpOnly: true,
        sameSite: "Lax",
        expires
      },
      {
        name: csrfCookieNameForCustomer(siteId),
        value: csrfToken,
        url: baseUrl,
        httpOnly: false,
        sameSite: "Lax",
        expires
      }
    ]);
    log("authenticated browser context", { source: "direct_tutorial_session", email: customer.email, customerId: customer.id });
    return true;
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

async function cleanupDirectTutorialSessions() {
  if (!createdTutorialSessionIds.length) return;
  const prisma = new PrismaClient();
  try {
    await prisma.customerSession.deleteMany({ where: { id: { in: createdTutorialSessionIds } } });
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
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
  const text = sanitizeText(JSON.stringify(value ?? null));
  try {
    return JSON.parse(text);
  } catch {
    return { sanitized: text.slice(0, 2000) };
  }
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

function existingSampleFile(tokens) {
  if (!tutorialSampleCustomerId) return "";
  for (const token of tokens) {
    const fileName = decodeURIComponent(String(token || "")).split("?")[0].split("/").filter(Boolean).pop();
    if (!fileName) continue;
    const candidate = path.join(repoRoot, "data/customer-assets/sites", siteId, "customers", tutorialSampleCustomerId, "assets", fileName);
    if (fsSync.existsSync(candidate)) return candidate;
  }
  return "";
}

async function preparePhotoFile({ sourceCandidates, targetPath, missingCode }) {
  const source = sourceCandidates.filter(Boolean).find((candidate) => fsSync.existsSync(candidate));
  if (!source) throw new Error(missingCode);
  const image = sharp(source);
  const meta = await image.metadata();
  if (!meta.width || !meta.height) throw new Error("tutorial_source_image_metadata_missing");
  await image
    .resize(1024, 1280, { fit: "cover", position: "attention" })
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(targetPath);
  log("prepared source photo", { source, path: targetPath });
}

async function prepareSourcePhoto() {
  const configured = process.env.TUTORIAL_SOURCE_IMAGE ? path.resolve(repoRoot, process.env.TUTORIAL_SOURCE_IMAGE) : "";
  const partnerConfigured = process.env.TUTORIAL_PARTNER_SOURCE_IMAGE ? path.resolve(repoRoot, process.env.TUTORIAL_PARTNER_SOURCE_IMAGE) : "";
  const primaryExisting = existingSampleFile(tutorialPrimarySampleTokens);
  const partnerExisting = existingSampleFile(tutorialPartnerSampleTokens);
  await preparePhotoFile({
    targetPath: sourcePhotoPath,
    missingCode: "tutorial_source_image_missing",
    sourceCandidates: [
      primaryExisting,
      configured,
      path.join(repoRoot, "public/assets/dreamshoot/frames/sample-professional-headshot.png"),
      path.join(repoRoot, "public/assets/dreamshoot/frames/faq-intro-portrait.png"),
      path.join(repoRoot, "public/assets/dreamshoot/beauty-portrait-gpt2.png"),
      path.join(repoRoot, "public/assets/dreamshoot/generated/20260618/headshot-lifestyle-v1.png")
    ]
  });
  await preparePhotoFile({
    targetPath: partnerPhotoPath,
    missingCode: "tutorial_partner_source_image_missing",
    sourceCandidates: [
      partnerExisting,
      partnerConfigured,
      path.join(repoRoot, "public/assets/dreamshoot/frames/faq-intro-portrait.png"),
      path.join(repoRoot, "public/assets/dreamshoot/frames/sample-professional-headshot.png"),
      path.join(repoRoot, "public/assets/dreamshoot/generated/20260618/headshot-lifestyle-v1.png")
    ]
  });
}

async function thumbnailDataUrl(filePath) {
  if (!filePath || !fsSync.existsSync(filePath)) return "";
  const buffer = await sharp(filePath)
    .resize(180, 140, { fit: "cover", position: "attention" })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  return `data:image/jpeg;base64,${buffer.toString("base64")}`;
}

async function fileDialogStateFor(role, selected = false) {
  const primaryThumb = await thumbnailDataUrl(sourcePhotoPath);
  const partnerThumb = await thumbnailDataUrl(partnerPhotoPath);
  return {
    title: role === "partner" ? "Choose partner photo" : "Choose primary photo",
    selected: Boolean(selected),
    selectedIndex: role === "partner" ? 1 : 0,
    items: [
      { label: "primary-selfie.jpg", thumbUrl: primaryThumb || "", tag: "primary" },
      { label: "partner-selfie.jpg", thumbUrl: partnerThumb || "", tag: "partner" },
      { label: "valentine-reference.jpg", thumbUrl: "", tag: "reference" }
    ]
  };
}

class Recorder {
  constructor(page) {
    this.page = page;
    this.index = 0;
  }

  async capture(segment) {
    await this.captureFor(segment.caption, segment.frames);
  }

  async captureFor(caption, frames, beforeFrame = async () => undefined) {
    await setCaption(this.page, caption);
    for (let i = 0; i < frames; i += 1) {
      await beforeFrame(i, frames);
      captureFrameCursor = this.index;
      await this.page.evaluate(() => window.__tutorial?.redact?.()).catch(() => undefined);
      await this.page.screenshot({ path: path.join(framesDir, `frame_${String(this.index).padStart(5, "0")}.png`), fullPage: false });
      this.index += 1;
      await this.page.waitForTimeout(35);
    }
    captureFrameCursor = this.index;
  }

  async captureDuring(segment, beforeFrame) {
    await this.captureFor(segment.caption, segment.frames, beforeFrame);
  }
}

async function installOverlay(page) {
  await page.addStyleTag({ content: `
    input[name="password"], body.tutorial-redact-private input[name="email"] { color: transparent !important; caret-color: transparent !important; text-shadow: none !important; }
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
    .tutorial-mask { position: fixed; z-index: 2147482997; display: grid; place-items: center; border-radius: 10px; background: #ffffff; color: #111827; font: 700 17px/1.2 Inter, system-ui, sans-serif; pointer-events: none; box-shadow: inset 0 0 0 1px rgba(17,24,39,.14); }
    .tutorial-chip-mask { position: fixed; z-index: 2147482996; display: grid; place-items: center; min-height: 46px; border-radius: 999px; background: #020617; color: #fff; font: 800 16px/1.2 Inter, system-ui, sans-serif; pointer-events: none; box-shadow: inset 0 0 0 1px rgba(255,255,255,.16); }
    .tutorial-history-mask { position: fixed; z-index: 2147482995; display: grid; place-items: center; overflow: hidden; border: 1px solid rgba(148,163,184,.32); border-radius: 12px; background: linear-gradient(135deg, rgba(2,6,23,.98), rgba(15,23,42,.96)); color: rgba(226,232,240,.92); font: 800 15px/1.2 Inter, system-ui, sans-serif; letter-spacing: .04em; text-transform: uppercase; text-align: center; pointer-events: none; box-shadow: inset 0 0 0 1px rgba(255,255,255,.05), 0 18px 44px rgba(0,0,0,.30); }
    .tutorial-history-mask::before { content: ""; position: absolute; inset: 0; background: repeating-linear-gradient(135deg, rgba(148,163,184,.05) 0 10px, rgba(148,163,184,.11) 10px 20px); opacity: .65; }
    .tutorial-history-mask span { position: relative; padding: 10px 14px; border-radius: 999px; background: rgba(15,23,42,.72); }
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
    .tutorial-file-thumb { display: grid; place-items: center; width: 78px; height: 62px; overflow: hidden; border-radius: 7px; background: linear-gradient(135deg,#111827,#8957e5 54%,#f59e0b); color: #ffffff; font-size: 11px; font-weight: 800; }
    .tutorial-file-thumb img { width: 100%; height: 100%; object-fit: cover; }
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
      .tutorial-history-mask { border-radius: 9px; font: 800 11px/1.15 Inter, system-ui, sans-serif; }
      .tutorial-history-mask span { padding: 7px 9px; }
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
  await page.evaluate(({ redactPrivateData }) => {
    document.body.classList.toggle("tutorial-redact-private", Boolean(redactPrivateData));
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
        if (!parent || parent.closest(".tutorial-caption,.tutorial-mask,.tutorial-chip-mask,.tutorial-file-dialog,.tutorial-history-mask")) continue;
        const parentText = parent.textContent || "";
        let text = node.nodeValue || "";
        const original = text;
        if (redactPrivateData) {
          text = text.replace(emailPattern, "demo@masked.local");
          text = text.replace(idPattern, "[private id]");
          text = text.replace(/\b(Credits:\s*)\d{3,}\b/gi, "$1----");
          text = text.replace(/\b\d{3,}\s+credits\b/gi, "---- credits");
        }
        if (window.__tutorialHistoryMaskMode) {
          text = text.replace(/\b\d+\s+generated items?\b/gi, "previous results hidden");
          text = text.replace(/\b\d+\s+generated images?\b/gi, "previous images hidden");
          text = text.replace(/\b\d+\s+generated videos?\b/gi, "previous videos hidden");
        }
        if (redactPrivateData && /\b(credits|creditos)\b/i.test(parentText)) text = text.replace(/\b\d{3,}\b/g, "----");
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
    function hideNextDevIssueToast() {
      const hidden = new WeakSet();
      const hide = (toast) => {
        if (!toast || hidden.has(toast)) return;
        hidden.add(toast);
        if (typeof toast.setAttribute === "function") toast.setAttribute("data-hidden", "true");
      };
      document.querySelectorAll("[data-nextjs-toast][data-has-issues='true']").forEach(hide);
      for (const portal of document.querySelectorAll("nextjs-portal")) {
        const root = portal.shadowRoot;
        if (!root) continue;
        root.querySelectorAll("[data-nextjs-toast][data-has-issues='true']").forEach(hide);
      }
    }
    function clearHistoryMasks() {
      document.querySelectorAll(".tutorial-history-mask").forEach((mask) => mask.remove());
    }
    function rectVisible(rect) {
      return rect.width >= 54 && rect.height >= 54 && rect.bottom >= 0 && rect.right >= 0 && rect.top <= window.innerHeight && rect.left <= window.innerWidth;
    }
    function overlapRatio(a, b) {
      const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      const overlap = x * y;
      const area = Math.max(1, Math.min(a.width * a.height, b.width * b.height));
      return overlap / area;
    }
    function appendHistoryMask(rect, label) {
      const clamped = {
        left: Math.max(0, rect.left),
        top: Math.max(0, rect.top),
        right: Math.min(window.innerWidth, rect.right),
        bottom: Math.min(window.innerHeight, rect.bottom)
      };
      clamped.width = Math.max(0, clamped.right - clamped.left);
      clamped.height = Math.max(0, clamped.bottom - clamped.top);
      if (!rectVisible(clamped)) return null;
      const mask = document.createElement("div");
      mask.className = "tutorial-history-mask";
      const text = document.createElement("span");
      text.textContent = label;
      mask.appendChild(text);
      Object.assign(mask.style, {
        left: `${clamped.left}px`,
        top: `${clamped.top}px`,
        width: `${clamped.width}px`,
        height: `${clamped.height}px`
      });
      document.body.appendChild(mask);
      return clamped;
    }
    function historyMaskTargetForImage(img) {
      if (img.closest(".tutorial-caption,.tutorial-mask,.tutorial-chip-mask,.tutorial-file-dialog,.tutorial-history-mask,[role='dialog'][aria-modal='true']")) return null;
      if (img.closest("#review-request [role='status'],#review-request [role='alert']")) return null;
      const target = img.closest("button,article,figure,li,[data-workspace-sample-id],[data-asset-id]") || img.parentElement || img;
      const targetRect = target.getBoundingClientRect();
      const imageRect = img.getBoundingClientRect();
      const rect = rectVisible(targetRect) && targetRect.width <= 780 && targetRect.height <= 780 ? targetRect : imageRect;
      if (!rectVisible(rect)) return null;
      return rect;
    }
    function maskHistoricalMedia() {
      clearHistoryMasks();
      if (!window.__tutorialHistoryMaskMode) return;
      const selectors = ["#review-request img", "aside img", "[data-workspace-sample-id] img", "[data-asset-id] img"];
      const rects = [];
      for (const img of [...document.querySelectorAll(selectors.join(","))]) {
        const rect = historyMaskTargetForImage(img);
        if (!rect) continue;
        const item = { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
        if (rects.some((existing) => overlapRatio(existing, item) > 0.82)) continue;
        const label = img.closest("aside") ? "Previous uploads hidden" : "Previous results hidden";
        const added = appendHistoryMask(item, label);
        if (added) rects.push(added);
      }
    }
    const caption = ensure("tutorial-caption");
    const highlight = ensure("tutorial-highlight");
    const cursor = ensure("tutorial-cursor");
    window.__tutorialHistoryMaskMode = false;
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
        const config = typeof state === "object" ? state : { selected: state === "selected" };
        const selected = Boolean(config.selected);
        const selectedIndex = Number.isFinite(config.selectedIndex) ? Number(config.selectedIndex) : 0;
        const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        })[char]);
        const items = Array.isArray(config.items) && config.items.length
          ? config.items.slice(0, 3)
          : [
              { label: "source-selfie-clean.jpg", tag: "source" },
              { label: "portrait-reference.jpg", tag: "portrait" },
              { label: "album-frame.png", tag: "album" }
            ];
        const itemHtml = items.map((item, index) => {
          const isSelected = selected && index === selectedIndex;
          const thumb = item.thumbUrl
            ? `<img alt="" src="${escapeHtml(item.thumbUrl)}" />`
            : escapeHtml(item.tag || "image");
          return `<div class="tutorial-file-item ${isSelected ? "selected" : ""}"><div class="tutorial-file-thumb">${thumb}</div><strong>${escapeHtml(item.label || "image.jpg")}</strong></div>`;
        }).join("");
        const backdrop = document.createElement("div");
        backdrop.className = "tutorial-file-backdrop";
        const dialog = document.createElement("div");
        dialog.className = "tutorial-file-dialog";
        dialog.innerHTML = `
          <div class="tutorial-file-titlebar"><span class="tutorial-file-dot"></span><strong>${escapeHtml(config.title || "Choose a photo")}</strong></div>
          <div class="tutorial-file-toolbar"><span>&lsaquo;</span><span>&rsaquo;</span><span>Columns</span><strong>Desktop</strong><span>Search</span></div>
          <div class="tutorial-file-body">
            <aside class="tutorial-file-sidebar">
              <div>Recents</div><div>Shared</div><div class="active">Desktop</div><div>Documents</div><div>Downloads</div><div>Home</div>
            </aside>
            <div class="tutorial-file-main">
              <div class="tutorial-file-list">${itemHtml}</div>
              <div class="tutorial-file-footer"><span class="tutorial-file-button">Cancel</span><span class="tutorial-file-button primary">${selected ? "Open" : "Choose"}</span></div>
            </div>
          </div>`;
        document.body.append(backdrop, dialog);
      },
      setHistoryMaskMode(enabled) {
        window.__tutorialHistoryMaskMode = Boolean(enabled);
        maskHistoricalMedia();
      },
      redact() {
        redactTextNodes(document.body);
        if (redactPrivateData) positionInputMask('input[name="email"]', "tutorial-mask-email", "masked email");
        else document.querySelector(".tutorial-mask-email")?.remove();
        positionInputMask('input[name="password"]', "tutorial-mask-password", "masked password");
        if (redactPrivateData) positionAccountMask();
        else document.querySelector(".tutorial-chip-mask")?.remove();
        hideNextDevIssueToast();
        maskHistoricalMedia();
      }
    };
    window.__tutorial.cursor(Math.min(window.innerWidth - 18, Math.max(18, window.innerWidth * 0.62)), Math.min(window.innerHeight - 18, Math.max(18, window.innerHeight * 0.72)));
    window.__tutorial.redact();
    window.setInterval(() => window.__tutorial?.redact?.(), 250);
  }, { redactPrivateData });
}

async function setCaption(page, caption) {
  await page.evaluate((text) => window.__tutorial?.setCaption?.(text), caption).catch(() => undefined);
}

async function setHistoryMask(page, enabled) {
  const active = Boolean(enabled && hideHistoricalAssets && !isMyDreamShootsSite);
  await page.evaluate((value) => window.__tutorial?.setHistoryMaskMode?.(value), active).catch(() => undefined);
}

async function moveTutorialPointer(page, x, y, pulse = false) {
  await page.evaluate(({ x, y, pulse }) => {
    const clampedX = Math.min(window.innerWidth - 18, Math.max(18, x));
    const clampedY = Math.min(window.innerHeight - 18, Math.max(18, y));
    window.__tutorial?.cursor?.(clampedX, clampedY);
    if (pulse) window.__tutorial?.clickPulse?.();
  }, { x, y, pulse }).catch(() => undefined);
  if (pulse) queueMouseClickSound();
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

function queueMouseClickSound(offsetMs = 0) {
  if (isMobileRecording) return;
  const seconds = Math.max(0, Math.min(finalDurationSeconds - 0.05, (captureFrameCursor / captureFps) + (offsetMs / 1000)));
  const previous = clickSoundTimes.at(-1);
  if (previous !== undefined && Math.abs(seconds - previous) < 0.18) return;
  clickSoundTimes.push(seconds);
}

async function pulseTutorialClick(page, options = {}) {
  await page.evaluate(() => window.__tutorial?.clickPulse?.()).catch(() => undefined);
  if (options.sound !== false) queueMouseClickSound(options.offsetMs ?? 0);
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
}

function easeCubicInOut(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (((-2 * t + 2) ** 3) / 2);
}

async function captureScrollToLocator(page, recorder, locator, frames, caption, options = {}) {
  const target = locator.first();
  await target.waitFor({ state: "visible", timeout: options.timeout ?? 45_000 });
  const scrollId = `tutorial-scroll-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const metrics = await target.evaluate((element, opts) => {
    function scrollContainerFor(node) {
      let current = node.parentElement;
      while (current && current !== document.body) {
        const style = window.getComputedStyle(current);
        const canScroll = /(auto|scroll)/.test(`${style.overflowY} ${style.overflow}`);
        if (canScroll && current.scrollHeight > current.clientHeight + 12) return current;
        current = current.parentElement;
      }
      return document.scrollingElement || document.documentElement;
    }
    const container = scrollContainerFor(element);
    container.setAttribute("data-tutorial-scroll-id", opts.scrollId);
    const isDocumentScroller = container === document.scrollingElement || container === document.documentElement;
    const containerRect = isDocumentScroller ? { top: 0, height: window.innerHeight } : container.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    const start = container.scrollTop;
    const topWithin = rect.top - containerRect.top + start;
    const bottomWithin = rect.bottom - containerRect.top + start;
    const viewHeight = isDocumentScroller ? window.innerHeight : container.clientHeight;
    let targetTop = topWithin - ((viewHeight - rect.height) / 2);
    if (opts.block === "start") targetTop = topWithin - opts.topPadding;
    if (opts.block === "end") targetTop = bottomWithin - viewHeight + opts.bottomPadding;
    const max = Math.max(0, container.scrollHeight - container.clientHeight);
    const target = Math.max(0, Math.min(max, targetTop));
    let animatedStart = start;
    if (Number.isFinite(opts.startOffset)) {
      const offsetStart = Math.max(0, Math.min(max, target + opts.startOffset));
      if (Math.abs(offsetStart - target) > 8) animatedStart = offsetStart;
    }
    return { scrollId: opts.scrollId, start: animatedStart, target };
  }, {
    scrollId,
    block: options.block || "center",
    topPadding: options.topPadding ?? (isMobileRecording ? 132 : 96),
    bottomPadding: options.bottomPadding ?? (isMobileRecording ? 160 : 96),
    startOffset: options.startOffset
  });

  await recorder.captureFor(caption, frames, async (index, count) => {
    const progress = count <= 1 ? 1 : index / Math.max(1, count - 1);
    const eased = easeCubicInOut(progress);
    await page.evaluate(({ metrics, eased }) => {
      const container = document.querySelector(`[data-tutorial-scroll-id="${metrics.scrollId}"]`) ||
        document.scrollingElement ||
        document.documentElement;
      container.scrollTop = Math.round(metrics.start + ((metrics.target - metrics.start) * eased));
      window.__tutorial?.redact?.();
    }, { metrics, eased }).catch(() => undefined);
  });
}

async function createPageSampleScrollTarget(page) {
  return page.evaluate(({ preferPartner }) => {
    const root = document.scrollingElement || document.documentElement;
    const aside = document.querySelector("aside");
    const headings = [...(aside?.querySelectorAll("p,h2,h3,div,span") || [])];
    const partnerHeading = headings.find((item) => /^Partner Samples$/i.test((item.textContent || "").trim()));
    const primaryHeading = headings.find((item) => /^Your Samples$/i.test((item.textContent || "").trim()));
    const sampleHeading = preferPartner ? partnerHeading || primaryHeading : primaryHeading || partnerHeading;
    const currentY = window.scrollY || root.scrollTop || 0;
    const maxY = Math.max(0, root.scrollHeight - window.innerHeight);
    if (!sampleHeading) return { from: currentY, to: Math.min(maxY, currentY + Math.round(window.innerHeight * 0.42)) };
    const rect = sampleHeading.getBoundingClientRect();
    const targetY = currentY + rect.top - Math.max(120, Math.round(window.innerHeight * 0.18));
    return { from: currentY, to: Math.max(0, Math.min(maxY, targetY)) };
  }, { preferPartner: isMobileRecording }).catch(() => ({ from: 0, to: 0 }));
}

async function scrollCreatePageToSamples(page, progress = 1) {
  const target = await createPageSampleScrollTarget(page);
  const eased = easeInOut(Math.max(0, Math.min(1, progress)));
  await page.evaluate(({ from, to, eased }) => {
    window.scrollTo({ top: from + ((to - from) * eased), behavior: "instant" });
  }, { ...target, eased }).catch(() => undefined);
}

function uploadButtonForRole(page, role) {
  return page.locator("aside").getByRole("button", { name: /^Upload$/i }).nth(role === "partner" ? 1 : 0);
}

async function showUploadChooserOverlay(page, role, selected = false) {
  if (isMobileRecording) {
    await hideUploadChooserOverlay(page);
    return;
  }
  const state = await fileDialogStateFor(role, selected);
  await page.evaluate((dialogState) => window.__tutorial?.fileDialog?.(dialogState), state).catch(() => undefined);
}

async function hideUploadChooserOverlay(page) {
  await page.evaluate(() => window.__tutorial?.fileDialog?.(null)).catch(() => undefined);
}

async function clickWithPointer(page, locator, options = {}) {
  await pointAt(page, locator);
  await page.waitForTimeout(options.pauseBeforeClickMs ?? 320);
  await pulseTutorialClick(page, { sound: false });
  await page.waitForTimeout(120);
  await locator.click({ timeout: options.timeout ?? 30_000, force: options.force ?? false });
  await pulseTutorialClick(page);
  await page.waitForTimeout(options.pauseAfterClickMs ?? 500);
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
  await setHistoryMask(page, false);
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
  await pulseTutorialClick(page);
  await recorder.capture(timeline.find((segment) => segment.id === "login"));
  await pulseTutorialClick(page, { sound: false });

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
    const targetEmail = String(process.env.TUTORIAL_CUSTOMER_EMAIL || "").trim().toLowerCase();
    if (targetEmail && String(candidate.email).trim().toLowerCase() === targetEmail) {
      if (await createDirectCustomerSession(context, candidate.email)) return;
    }
  }
  throw new Error(`customer_login_failed: ${sanitizeText(lastError)}`);
}

async function showPricingRechargeStep(page, recorder) {
  if (!isMyDreamShootsSite) return;
  await page.goto(absoluteUrl("/pricing"), { waitUntil: "domcontentloaded", timeout: pageTimeoutMs });
  await waitReady(page);
  await installOverlay(page);
  await setHistoryMask(page, false);

  const planButtons = page.locator("a,button").filter({ hasText: /^Select plan$/i });
  const proButton = planButtons.nth(1);
  const target = await proButton.waitFor({ state: "visible", timeout: 20_000 }).then(() => true).catch(() => false)
    ? proButton
    : planButtons.first();
  await target.waitFor({ state: "visible", timeout: 20_000 });
  const segment = timeline.find((item) => item.id === "pricing");
  if (isMobileRecording) {
    const scrollFrames = Math.max(1, segment.frames - 5);
    await captureScrollToLocator(page, recorder, target, scrollFrames, segment.caption, {
      block: "center",
      startOffset: -420,
      topPadding: 126
    });
    await pointAt(page, target).catch(() => undefined);
    await pulseTutorialClick(page);
    await recorder.captureFor(segment.caption, Math.max(1, segment.frames - scrollFrames));
    return;
  }
  await target.scrollIntoViewIfNeeded().catch(() => undefined);
  await pointAt(page, target).catch(() => undefined);
  await pulseTutorialClick(page);
  await recorder.capture(segment);
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
  await setHistoryMask(page, false);
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
  if (isMyDreamShootsSite) {
    const segment = timeline.find((item) => item.id === "package");
    if (isMobileRecording) {
      const scrollFrames = Math.max(1, segment.frames - 5);
      await captureScrollToLocator(page, recorder, packageCard, scrollFrames, segment.caption, {
        block: "center",
        startOffset: -300,
        topPadding: 120
      });
      await pointAt(page, packageCard).catch(() => undefined);
      await recorder.captureFor(segment.caption, Math.max(1, segment.frames - scrollFrames));
    } else {
      await recorder.capture(segment);
    }
    await page.evaluate(() => window.__tutorial?.highlight?.(null)).catch(() => undefined);
    return;
  }
  await page.evaluate((title) => {
    const button = [...document.querySelectorAll("[data-workspace-package-title]")]
      .find((item) => item.getAttribute("data-workspace-package-title") === title);
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  }, packageTitle);
  await pulseTutorialClick(page);
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
  await scrollCreatePageToSamples(page, 1);
  const primaryUpload = uploadButtonForRole(page, "primary");
  await primaryUpload.waitFor({ state: "visible", timeout: 45_000 });
  await clickWithPointer(page, primaryUpload, { force: true });
  if (isMobileRecording) {
    let uploadInput = page.locator('aside input[type="file"]').first();
    await uploadInput.setInputFiles(sourcePhotoPath);
    if (isMyDreamShootsSite) {
      const partnerUpload = uploadButtonForRole(page, "partner");
      await partnerUpload.waitFor({ state: "visible", timeout: 45_000 });
      await clickWithPointer(page, partnerUpload, { force: true });
      uploadInput = page.locator('aside input[type="file"]').first();
      await uploadInput.setInputFiles(partnerPhotoPath);
    }
    await hideUploadChooserOverlay(page);
    await page.waitForFunction(() => {
      const asideText = document.querySelector("aside")?.textContent || "";
      return /uploaded and selected|1 selected|selected\./i.test(asideText) && !/Uploading \d+ sample/i.test(asideText);
    }, undefined, { timeout: 120_000 }).catch(() => undefined);
    await scrollCreatePageToSamples(page, 1);
    const uploadedSample = page.locator("aside").getByText(/Selected|uploaded and selected|1 selected|Partner Samples/i).first();
    await pointAt(page, uploadedSample).catch(() => undefined);
    await recorder.capture(timeline.find((segment) => segment.id === "upload"));
    return;
  }
  await showUploadChooserOverlay(page, "primary", false);
  await moveTutorialPointer(page, isMobileRecording ? 290 : 1010, isMobileRecording ? 360 : 508);
  await page.waitForTimeout(650);
  await showUploadChooserOverlay(page, "primary", true);
  await moveTutorialPointer(page, isMobileRecording ? 330 : 1210, isMobileRecording ? 610 : 860);
  let uploadInput = page.locator('aside input[type="file"]').first();
  await uploadInput.setInputFiles(sourcePhotoPath);
  await hideUploadChooserOverlay(page);
  if (isMyDreamShootsSite) {
    const partnerUpload = uploadButtonForRole(page, "partner");
    await partnerUpload.waitFor({ state: "visible", timeout: 45_000 });
    await clickWithPointer(page, partnerUpload, { force: true });
    await showUploadChooserOverlay(page, "partner", false);
    await page.waitForTimeout(500);
    await showUploadChooserOverlay(page, "partner", true);
    uploadInput = page.locator('aside input[type="file"]').first();
    await uploadInput.setInputFiles(partnerPhotoPath);
    await hideUploadChooserOverlay(page);
  }
  await page.waitForFunction(() => {
    const asideText = document.querySelector("aside")?.textContent || "";
    return /uploaded and selected|1 selected|selected\./i.test(asideText) && !/Uploading \d+ sample/i.test(asideText);
  }, undefined, { timeout: 120_000 }).catch(() => undefined);
  const uploadedSample = page.locator("aside").getByText(/Selected|uploaded and selected|1 selected/i).first();
  await pointAt(page, uploadedSample).catch(() => undefined);
  await recorder.capture(timeline.find((segment) => segment.id === "upload"));
}

async function selectSampleByTokens(page, tokens, label) {
  const target = await page.evaluate(({ tokens, label }) => {
    const aside = document.querySelector("aside");
    if (!aside) return null;
    const normalizedTokens = tokens.map((token) => decodeURIComponent(String(token || ""))).filter(Boolean);
    const matches = (img) => {
      const src = decodeURIComponent(img.getAttribute("src") || "");
      const alt = decodeURIComponent(img.getAttribute("alt") || "");
      return normalizedTokens.some((token) => src.includes(token) || alt.includes(token));
    };
    const findImage = () => [...aside.querySelectorAll("img")].find(matches);
    let img = findImage();
    if (!img) {
      aside.scrollTo({ top: label === "partner" ? aside.scrollHeight : 0, behavior: "instant" });
      img = findImage();
    }
    if (!img) return null;
    const target = img.closest("button,[role='button'],[data-workspace-sample-id],article,li,figure") || img;
    target.scrollIntoView({ block: "center", inline: "nearest" });
    const button = img.closest("button,[role='button']");
    const selected = button?.getAttribute("aria-pressed") === "true" || /Selected/i.test(button?.textContent || "");
    const rect = target.getBoundingClientRect();
    return {
      selected,
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
    };
  }, { tokens, label });
  if (!target) throw new Error(`tutorial_sample_not_found:${label}`);
  await page.evaluate((rect) => window.__tutorial?.highlight?.(rect), target.rect).catch(() => undefined);
  await moveTutorialPointer(page, target.x, target.y, true);
  if (!target.selected) {
    await page.evaluate(({ tokens, label: _label }) => {
      const aside = document.querySelector("aside");
      if (!aside) return;
      const normalizedTokens = tokens.map((token) => decodeURIComponent(String(token || ""))).filter(Boolean);
      const img = [...aside.querySelectorAll("img")].find((item) => {
        const src = decodeURIComponent(item.getAttribute("src") || "");
        const alt = decodeURIComponent(item.getAttribute("alt") || "");
        return normalizedTokens.some((token) => src.includes(token) || alt.includes(token));
      });
      const button = img?.closest("button,[role='button']");
      const selected = button?.getAttribute("aria-pressed") === "true" || /Selected/i.test(button?.textContent || "");
      if (button && !selected) button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    }, { tokens, label }).catch(() => undefined);
  }
  await page.waitForTimeout(650);
  await page.evaluate(() => window.__tutorial?.redact?.()).catch(() => undefined);
}

async function frameSelectedSamplesTogether(page) {
  await page.evaluate(({ primaryTokens, partnerTokens }) => {
    const aside = document.querySelector("aside");
    if (!aside) return;
    const findTarget = (tokens) => {
      const normalizedTokens = tokens.map((token) => decodeURIComponent(String(token || ""))).filter(Boolean);
      const img = [...aside.querySelectorAll("img")].find((item) => {
        const src = decodeURIComponent(item.getAttribute("src") || "");
        const alt = decodeURIComponent(item.getAttribute("alt") || "");
        return normalizedTokens.some((token) => src.includes(token) || alt.includes(token));
      });
      return img?.closest("button,[role='button'],[data-workspace-sample-id],article,li,figure") || img || null;
    };
    const targets = [findTarget(primaryTokens), findTarget(partnerTokens)].filter(Boolean);
    if (!targets.length) return;
    const top = Math.min(...targets.map((target) => target.getBoundingClientRect().top + aside.scrollTop));
    aside.scrollTo({ top: Math.max(0, top - 150), behavior: "instant" });
  }, {
    primaryTokens: tutorialPrimarySampleTokens,
    partnerTokens: tutorialPartnerSampleTokens
  }).catch(() => undefined);
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__tutorial?.redact?.()).catch(() => undefined);
}

async function filterToTutorialSamples(page) {
  if (!isMyDreamShootsSite) return;
  await page.evaluate(({ tokens }) => {
    const normalizedTokens = tokens.map((token) => decodeURIComponent(String(token || ""))).filter(Boolean);
    const keepImage = (img) => {
      const src = decodeURIComponent(img.getAttribute("src") || "");
      const alt = decodeURIComponent(img.getAttribute("alt") || "");
      return normalizedTokens.some((token) => src.includes(token) || alt.includes(token));
    };
    const aside = document.querySelector("aside");
    if (!aside) return;
    for (const item of [...aside.querySelectorAll('[role="listitem"]')]) {
      const img = item.querySelector("img");
      item.style.display = img && keepImage(img) ? "" : "none";
    }
  }, { tokens: [...tutorialPrimarySampleTokens, ...tutorialPartnerSampleTokens] }).catch(() => undefined);
}

async function recordExistingSampleUploadFlow(page, recorder) {
  const segment = timeline.find((item) => item.id === "upload");
  if (!isMyDreamShootsSite) {
    await recorder.capture(segment);
    return;
  }

  await frameSelectedSamplesTogether(page);
  await filterToTutorialSamples(page);
  const total = segment.frames;
  if (isMobileRecording) {
    await hideUploadChooserOverlay(page);
    const introFrames = Math.max(4, Math.round(total * 0.28));
    const scrollFrames = Math.max(5, Math.round(total * 0.44));
    const finalFrames = Math.max(1, total - introFrames - scrollFrames);
    const primaryUpload = uploadButtonForRole(page, "primary");
    await primaryUpload.waitFor({ state: "visible", timeout: 30_000 }).catch(() => undefined);
    await pointAt(page, primaryUpload).catch(() => undefined);
    await recorder.captureFor(segment.caption, introFrames);

    const partnerHeading = page.locator("aside").getByText(/^Partner Samples$/i).first();
    await captureScrollToLocator(page, recorder, partnerHeading, scrollFrames, segment.caption, {
      block: "start",
      topPadding: 126,
      startOffset: -320
    }).catch(async () => {
      await scrollCreatePageToSamples(page, 1);
      await recorder.captureFor(segment.caption, scrollFrames);
    });

    const partnerUpload = uploadButtonForRole(page, "partner");
    await pointAt(page, partnerUpload).catch(() => undefined);
    const selectedSummary = page.locator("aside").getByText(/2 samples uploaded and selected|2 selected|Partner Samples/i).first();
    if (await selectedSummary.isVisible().catch(() => false)) await pointAt(page, selectedSummary).catch(() => undefined);
    await recorder.captureFor(segment.caption, finalFrames);
    return;
  }
  const introFrames = Math.max(3, Math.round(total * 0.18));
  const primaryDialogFrames = Math.max(4, Math.round(total * 0.18));
  const primarySelectedFrames = Math.max(3, Math.round(total * 0.1));
  const partnerDialogFrames = Math.max(4, Math.round(total * 0.18));
  const partnerSelectedFrames = Math.max(3, Math.round(total * 0.1));
  const used = introFrames + primaryDialogFrames + primarySelectedFrames + partnerDialogFrames + partnerSelectedFrames;
  const finalFrames = Math.max(1, total - used);

  const primaryUpload = uploadButtonForRole(page, "primary");
  await primaryUpload.waitFor({ state: "visible", timeout: 30_000 }).catch(() => undefined);
  await pointAt(page, primaryUpload).catch(() => undefined);
  await recorder.captureFor(segment.caption, introFrames);
  await pulseTutorialClick(page);
  await showUploadChooserOverlay(page, "primary", false);
  await recorder.captureFor(segment.caption, primaryDialogFrames);
  await showUploadChooserOverlay(page, "primary", true);
  await recorder.captureFor(segment.caption, primarySelectedFrames);
  await hideUploadChooserOverlay(page);

  const partnerUpload = uploadButtonForRole(page, "partner");
  await partnerUpload.waitFor({ state: "visible", timeout: 30_000 }).catch(() => undefined);
  await pointAt(page, partnerUpload).catch(() => undefined);
  await pulseTutorialClick(page);
  await showUploadChooserOverlay(page, "partner", false);
  await recorder.captureFor(segment.caption, partnerDialogFrames);
  await showUploadChooserOverlay(page, "partner", true);
  await recorder.captureFor(segment.caption, partnerSelectedFrames);
  await hideUploadChooserOverlay(page);

  await frameSelectedSamplesTogether(page);
  await filterToTutorialSamples(page);
  const selectedSummary = page.locator("aside").getByText(/2 samples uploaded and selected|2 selected|Partner Samples/i).first();
  await pointAt(page, selectedSummary).catch(() => undefined);
  await recorder.captureFor(segment.caption, finalFrames);
}

async function selectExistingSamples(page, recorder) {
  await openWorkspace(page, "#step-create");
  await page.evaluate(({ siteId, customerId, primarySampleIds, partnerSampleIds }) => {
    const key = `dreamshoot:workspace:${siteId}:${customerId}:sample-selection:v2`;
    localStorage.setItem(key, JSON.stringify({
      primarySampleIds,
      partnerSampleIds,
      studioTrainingMode: "couple",
      primaryGender: "nonbinary",
      partnerGender: "nonbinary",
      studioModelName: ""
    }));
  }, {
    siteId,
    customerId: tutorialSampleCustomerId,
    primarySampleIds: tutorialPrimarySampleIds,
    partnerSampleIds: tutorialPartnerSampleIds
  }).catch(() => undefined);
  await page.locator("#step-create").waitFor({ state: "visible", timeout: 60_000 });
  await page.getByText(/Your Samples/i).first().waitFor({ state: "visible", timeout: 60_000 });
  await page.getByText(/Partner Samples/i).first().waitFor({ state: "visible", timeout: 60_000 });
  await selectSampleByTokens(page, tutorialPrimarySampleTokens, "primary");
  await selectSampleByTokens(page, tutorialPartnerSampleTokens, "partner");
  await recordExistingSampleUploadFlow(page, recorder);
  await page.evaluate(() => window.__tutorial?.highlight?.(null)).catch(() => undefined);
}

async function recordWorkspaceOverview(page, recorder) {
  await openWorkspace(page, "#step-create");
  const workspaceHeading = page.getByText(/Start your AI photoshoot/i).first();
  await pointAt(page, workspaceHeading).catch(() => undefined);
  const segment = timeline.find((item) => item.id === "workspace");
  if (!isMyDreamShootsSite) {
    await recorder.capture(segment);
    return;
  }
  const scrollTarget = await createPageSampleScrollTarget(page);
  await recorder.captureDuring(segment, async (index, frames) => {
    const progress = frames <= 1 ? 1 : index / (frames - 1);
    const eased = easeInOut(progress);
    await page.evaluate(({ from, to, eased }) => {
      window.scrollTo({ top: from + ((to - from) * eased), behavior: "instant" });
    }, { ...scrollTarget, eased }).catch(() => undefined);
    if (index === Math.floor(frames * 0.72)) {
      const upload = uploadButtonForRole(page, "primary");
      await pointAt(page, upload).catch(() => undefined);
    }
  });
}

async function openReviewDialog(page, recorder) {
  await openWorkspace(page, "#step-create");
  const reviewButton = page.locator("#step-create").getByRole("button", { name: /Review and start|Configure package/i }).first();
  await reviewButton.waitFor({ state: "visible", timeout: 45_000 });
  await reviewButton.evaluate((element) => element.scrollIntoView({ block: "center", inline: "center" })).catch(() => undefined);
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
  if (!isMyDreamShootsSite) {
    const summary = dialog.getByText(/Required credits|Selected uploads|Output/i).first();
    await pointAt(page, summary).catch(() => undefined);
    await recorder.capture(timeline.find((segment) => segment.id === "review"));
    return;
  }
  const segment = timeline.find((item) => item.id === "review");
  const topFrames = isMobileRecording
    ? Math.max(5, Math.round(segment.frames * 0.28))
    : Math.max(4, Math.round(segment.frames * 0.42));
  const bottomFrames = Math.max(1, segment.frames - topFrames);
  const bothCard = dialog.getByRole("button", { name: /For Both of Us/i }).first();
  if (await bothCard.isVisible().catch(() => false)) {
    await bothCard.scrollIntoViewIfNeeded().catch(() => undefined);
    await clickWithPointer(page, bothCard, { force: true, pauseBeforeClickMs: 220, pauseAfterClickMs: 260 }).catch(() => undefined);
  }
  await pointAt(page, bothCard).catch(() => undefined);
  await recorder.captureFor(segment.caption, topFrames);
  const scrollTarget = await dialog.evaluate((element, options) => {
    const selectedUploads = [...element.querySelectorAll("p,h2,h3,div")].find((item) => /Selected uploads/i.test(item.textContent || ""));
    const startButton = [...element.querySelectorAll("button")].find((item) => /Start photo package|Start generation|Start tool/i.test(item.textContent || ""));
    const anchor = options.mobile ? startButton || selectedUploads : selectedUploads || startButton;
    function scrollableAncestorFor(node) {
      let current = node?.parentElement;
      while (current && current !== document.body && element.contains(current)) {
        const style = window.getComputedStyle(current);
        const canScroll = /(auto|scroll)/.test(`${style.overflowY} ${style.overflow}`);
        if (canScroll && current.scrollHeight > current.clientHeight + 20) return current;
        current = current.parentElement;
      }
      return null;
    }
    const scrollable = scrollableAncestorFor(anchor) || [...element.querySelectorAll("*")].find((candidate) => {
      const style = window.getComputedStyle(candidate);
      return /(auto|scroll)/.test(style.overflowY) && candidate.scrollHeight > candidate.clientHeight + 20;
    }) || element;
    const current = scrollable.scrollTop || 0;
    const max = Math.max(0, scrollable.scrollHeight - scrollable.clientHeight);
    let target = max;
    if (anchor) {
      const scrollRect = scrollable.getBoundingClientRect();
      const anchorRect = anchor.getBoundingClientRect();
      target = current + anchorRect.top - scrollRect.top - (options.mobile ? 74 : 64);
    }
    if (options.mobile) target = Math.max(target, max);
    target = Math.max(0, Math.min(max, target));
    scrollable.dataset.tutorialScrollTarget = "1";
    return { from: current, to: target };
  }, { mobile: isMobileRecording }).catch(() => ({ from: 0, to: 0 }));
  await recorder.captureFor(segment.caption, bottomFrames, async (index, frames) => {
    const progress = frames <= 1 ? 1 : index / (frames - 1);
    const eased = easeInOut(progress);
    await dialog.evaluate(({ from, to, eased }) => {
      const scrollable = document.querySelector('[data-tutorial-scroll-target="1"]') || document.querySelector('[role="dialog"][aria-modal="true"]');
      if (scrollable) scrollable.scrollTop = from + ((to - from) * eased);
    }, { ...scrollTarget, eased }).catch(() => undefined);
  });
  const startButton = dialog.getByRole("button", { name: /Start photo package|Start generation|Start tool/i }).first();
  await pointAt(page, startButton).catch(() => undefined);
}

async function submitJob(page, recorder) {
  const segment = timeline.find((item) => item.id === "start");
  const button = page.locator('[role="dialog"][aria-modal="true"]').getByRole("button", { name: /Start photo package|Start generation|Start tool/i }).first();
  await button.waitFor({ state: "attached", timeout: 45_000 });
  await button.evaluate((element) => element.scrollIntoView({ block: "center", inline: "center" })).catch(() => undefined);
  await button.waitFor({ state: "visible", timeout: 45_000 });
  await page.waitForTimeout(250);
  await pointAt(page, button);
  if (!realGeneration) {
    await setHistoryMask(page, false);
    if (siteId === "site_dreamshoot") {
      await ensureMydreamshootsLocalPendingPreviewImage();
      await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
        const target = [...(dialog?.querySelectorAll("button") || [])].find((item) =>
          /Start photo package|Start generation|Start tool|Creating job/i.test(item.textContent || "")
        );
        if (target) {
          target.disabled = true;
          target.textContent = "Creating job...";
        }
      }).catch(() => undefined);
    }
    await pointAt(page, button).catch(() => undefined);
    await pulseTutorialClick(page);
    await recorder.capture(segment);
    if (reuseJobId) {
      log("reusing existing image job for recording", { jobId: reuseJobId });
      return reuseJobId;
    }
    log("skipped real image generation by request");
    return siteId === "site_dreamshoot" ? "job_mydreamshoots_tutorial_preview_image" : undefined;
  }
  await page.waitForFunction(() => {
    const buttons = [...document.querySelectorAll('[role="dialog"][aria-modal="true"] button')];
    const target = buttons.find((item) => /Start photo package|Start generation|Start tool/i.test(item.textContent || ""));
    return target && !target.disabled;
  }, undefined, { timeout: 90_000 });
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
  await setHistoryMask(page, true);
  await button.click({ timeout: 30_000, force: true });
  await pulseTutorialClick(page);
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
  await openResults(page);
  await setHistoryMask(page, true);
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
    let data;
    try {
      data = await runtime(page);
    } catch (error) {
      lastStatus = error instanceof Error ? error.message : String(error);
      log("workspace runtime unavailable while waiting for image job", {
        jobId,
        error: lastStatus,
        elapsedSeconds: Math.round((Date.now() - started) / 1000)
      });
      await page.waitForTimeout(pollIntervalMs);
      continue;
    }
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
  await page.goto(`${absoluteUrl("/app/create")}?tutorialRefresh=${Date.now()}#resources-all`, { waitUntil: "domcontentloaded", timeout: pageTimeoutMs });
  await waitReady(page);
  await installOverlay(page);
  await setHistoryMask(page, true);
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

async function localPreviewImageAsset() {
  if (siteId !== "site_dreamshoot") return undefined;
  const storageKey = `sites/${siteId}/customers/${tutorialSampleCustomerId}/assets/job_mydreamshoots_tutorial_preview_image-output-1.webp`;
  const filePath = path.join(repoRoot, "data", "customer-assets", storageKey);
  const dataUrl = fsSync.existsSync(filePath)
    ? `data:image/webp;base64,${(await fs.readFile(filePath)).toString("base64")}`
    : "";
  return {
    id: "asset_mydreamshoots_tutorial_preview_image",
    jobId: "job_mydreamshoots_tutorial_preview_image",
    role: "output",
    mimeType: "image/webp",
    label: "Tutorial result image preview",
    storageKey,
    previewUrl: dataUrl || `/api/local-assets/${storageKey}`
  };
}

function samplePreviewUrlForTokens(tokens) {
  const token = tokens[0] || "";
  return token ? `/api/local-assets/sites/${siteId}/customers/${tutorialSampleCustomerId}/assets/${token}` : "";
}

async function showSyntheticSuccessState(page, asset) {
  const primaryUrl = samplePreviewUrlForTokens(tutorialPrimarySampleTokens);
  const partnerUrl = samplePreviewUrlForTokens(tutorialPartnerSampleTokens);
  await page.evaluate(({ asset, packageTitle: _packageTitle, primaryUrl, partnerUrl }) => {
    document.querySelector('[role="dialog"][aria-modal="true"]')?.remove();
    document.querySelector(".tutorial-generated-preview")?.remove();
    document.body.classList.add("tutorial-synthetic-success-active");
    window.history.replaceState(null, "", `${window.location.pathname}?tutorialRefresh=${Date.now()}#resources-all`);
    window.scrollTo({ top: 0, behavior: "instant" });

    let scene = document.querySelector(".tutorial-success-scene");
    if (!scene) {
      scene = document.createElement("section");
      scene.className = "tutorial-success-scene";
      document.body.appendChild(scene);
    }
    scene.innerHTML = `
      <div class="tutorial-success-toolbar">
        <button class="active">All</button><button>Recent</button><button>Favorites</button><button>Pick Package</button>
        <span class="credits">Credits: 98829</span><span>All assets</span>
      </div>
      <div class="tutorial-success-head">
        <div><h2>All assets</h2><p>0 active jobs • 0 need attention • 1 generated item</p></div>
        <div><button>Refresh status</button><button class="primary">Pick Package</button></div>
      </div>
      <div class="tutorial-success-card" id="review-request">
        <div class="tutorial-success-card-head">
          <div><h3>AI generation</h3><strong>Images delivered</strong><p>The workspace updates when the generator sends progress.</p></div>
          <span>SUCCEEDED</span>
        </div>
        <div class="tutorial-success-output" role="status">
          <button class="tutorial-synthetic-preview-button" type="button" aria-label="Open preview">
            <img alt="Generated Valentine Photos image" src="${asset.previewUrl}">
            <span>Open preview</span>
          </button>
          <div class="tutorial-success-output-meta">
            <b>Image 1</b><em>DELIVERED</em>
            <div class="bar"><i></i></div>
            <small><span>Output ready</span><span>100%</span></small>
          </div>
        </div>
        <div class="tutorial-success-foot"><span>1 of 1 delivered</span><span>Updated 10:27:26 AM</span></div>
      </div>
      <div class="tutorial-success-samples" aria-label="Selected uploads">
        <div><h4>Your Samples</h4><img src="${primaryUrl}" alt="Selected primary sample"></div>
        <div><h4>Partner Samples</h4><img src="${partnerUrl}" alt="Selected partner sample"></div>
      </div>
    `;
  }, { asset, packageTitle, primaryUrl, partnerUrl });
  await page.addStyleTag({ content: `
    .tutorial-synthetic-success-active main { opacity: .18 !important; }
    .tutorial-success-scene {
      position: fixed;
      z-index: 2147482500;
      left: 450px;
      right: 0;
      top: 112px;
      bottom: 0;
      overflow: hidden;
      padding: 24px 36px;
      background: #030406;
      color: #fff;
      font-family: Inter, system-ui, sans-serif;
    }
    .tutorial-success-toolbar { display: flex; align-items: center; gap: 14px; padding-bottom: 18px; border-bottom: 1px solid rgba(255,255,255,.12); }
    .tutorial-success-toolbar button, .tutorial-success-head button { border: 1px solid rgba(255,255,255,.16); border-radius: 10px; background: #131922; color: #fff; padding: 12px 20px; font-weight: 800; }
    .tutorial-success-toolbar button.active, .tutorial-success-head button.primary { background: #2f78ff; border-color: #2f78ff; }
    .tutorial-success-toolbar .credits { margin-left: 0; border: 1px solid rgba(255,255,255,.14); border-radius: 999px; padding: 9px 16px; color: rgba(255,255,255,.72); font-weight: 800; }
    .tutorial-success-head { display: flex; align-items: center; justify-content: space-between; gap: 24px; margin-top: 26px; padding-bottom: 22px; border-bottom: 1px solid rgba(255,255,255,.45); }
    .tutorial-success-head h2 { margin: 0 0 6px; font-size: 26px; }
    .tutorial-success-head p { margin: 0; color: rgba(255,255,255,.75); font-weight: 700; }
    .tutorial-success-card { width: min(620px, calc(100vw - 540px)); margin-top: 38px; border: 1px solid rgba(255,255,255,.68); border-radius: 16px; padding: 22px; background: #080a0e; box-shadow: 0 22px 60px rgba(0,0,0,.38); }
    .tutorial-success-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; }
    .tutorial-success-card h3 { margin: 0 0 6px; font-size: 22px; }
    .tutorial-success-card strong { display: block; color: #f8e7a1; font-size: 16px; }
    .tutorial-success-card p { margin: 18px 0; color: rgba(255,255,255,.82); font-size: 16px; line-height: 1.45; }
    .tutorial-success-card-head span { border: 1px solid rgba(255,255,255,.18); border-radius: 999px; padding: 8px 14px; color: rgba(255,255,255,.58); font-size: 13px; font-weight: 900; letter-spacing: .18em; }
    .tutorial-success-output { width: 304px; overflow: hidden; border: 1px solid rgba(255,255,255,.18); border-radius: 12px; background: #0e1117; }
    .tutorial-synthetic-preview-button { position: relative; display: block; width: 100%; border: 0; padding: 0; background: transparent; cursor: pointer; }
    .tutorial-synthetic-preview-button img { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; }
    .tutorial-synthetic-preview-button span { position: absolute; left: 14px; bottom: 14px; border: 1px solid rgba(255,255,255,.65); border-radius: 999px; padding: 8px 18px; background: rgba(80,52,35,.58); color: #fff; font-weight: 900; backdrop-filter: blur(8px); }
    .tutorial-success-output-meta { padding: 12px 16px 14px; }
    .tutorial-success-output-meta b { font-size: 15px; }
    .tutorial-success-output-meta em { float: right; color: #8df0c1; font-style: normal; font-weight: 900; font-size: 13px; }
    .tutorial-success-output-meta .bar { clear: both; margin: 15px 0 8px; height: 8px; border-radius: 999px; background: rgba(255,255,255,.12); }
    .tutorial-success-output-meta .bar i { display: block; width: 100%; height: 100%; border-radius: inherit; background: #67efb7; }
    .tutorial-success-output-meta small { display: flex; justify-content: space-between; color: rgba(255,255,255,.78); font-size: 13px; }
    .tutorial-success-foot { display: flex; justify-content: space-between; margin-top: 18px; font-weight: 800; color: rgba(255,255,255,.86); }
    .tutorial-success-samples { position: absolute; left: 700px; top: 280px; display: flex; gap: 16px; }
    .tutorial-success-samples div { width: 116px; }
    .tutorial-success-samples h4 { margin: 0 0 8px; font-size: 13px; color: rgba(255,255,255,.7); }
    .tutorial-success-samples img { width: 100px; height: 100px; object-fit: cover; border-radius: 10px; border: 1px solid rgba(255,255,255,.18); }
    @media (max-width: 800px) {
      .tutorial-success-scene { left: 0; top: 84px; padding: 14px; overflow: hidden; }
      .tutorial-success-toolbar { gap: 8px; overflow: hidden; padding-bottom: 12px; }
      .tutorial-success-toolbar button { padding: 9px 11px; font-size: 12px; }
      .tutorial-success-toolbar .credits { display: none; }
      .tutorial-success-head { margin-top: 16px; padding-bottom: 14px; }
      .tutorial-success-head h2 { font-size: 21px; }
      .tutorial-success-head p { font-size: 12px; }
      .tutorial-success-head button { display: none; }
      .tutorial-success-card { width: 100%; margin-top: 18px; padding: 14px; }
      .tutorial-success-card h3 { font-size: 20px; }
      .tutorial-success-card p { font-size: 13px; margin: 12px 0; }
      .tutorial-success-output { width: min(290px, 100%); }
      .tutorial-success-samples { position: static; margin-top: 14px; }
      .tutorial-success-samples div { width: 86px; }
      .tutorial-success-samples img { width: 76px; height: 76px; }
    }
  ` }).catch(() => undefined);
  await page.waitForFunction(() => {
    const images = [...document.querySelectorAll(".tutorial-success-scene img")];
    return images.length >= 3 && images.every((img) => img.complete && img.naturalWidth > 32 && img.naturalHeight > 32);
  }, undefined, { timeout: 30_000 }).catch(() => undefined);
}

async function showSyntheticGeneratedPreview(page, asset) {
  await page.evaluate(({ asset, packageTitle }) => {
    document.querySelector(".tutorial-generated-preview")?.remove();
    const preview = document.createElement("div");
    preview.className = "tutorial-generated-preview";
    preview.setAttribute("role", "dialog");
    preview.setAttribute("aria-modal", "true");
    preview.setAttribute("aria-label", "Generated asset preview");
    preview.innerHTML = `
      <div class="tutorial-generated-preview-inner">
        <div class="tutorial-generated-preview-media"><img src="${asset.previewUrl}" alt="Generated Valentine Photos image"></div>
        <aside>
          <button aria-label="Close preview">×</button>
          <p>Generated output</p>
          <h2>AI generation · 2026-08-05<br>10:26 · Generation 4 · Image 1</h2>
          <p class="meta">Package: AI generation · Category: ${packageTitle} · Created 2026-08-05 10:26 · Generation 4 · Image 1</p>
          <p class="count">1 of 1</p>
          <div class="nav"><button>‹</button><button>›</button></div>
          <button class="favorite">♡ Add favorite</button>
          <button class="download">Download</button>
        </aside>
      </div>
    `;
    document.body.appendChild(preview);
  }, { asset, packageTitle });
  await page.addStyleTag({ content: `
    .tutorial-generated-preview {
      position: fixed;
      inset: 86px 230px 40px 230px;
      z-index: 2147482700;
      display: grid;
      border: 1px solid rgba(255,255,255,.72);
      border-radius: 16px;
      background: #050608;
      color: #fff;
      box-shadow: 0 34px 90px rgba(0,0,0,.72);
      font-family: Inter, system-ui, sans-serif;
    }
    .tutorial-generated-preview-inner { display: grid; grid-template-columns: minmax(0, 1fr) 360px; min-height: 0; }
    .tutorial-generated-preview-media { display: grid; place-items: center; min-width: 0; padding: 18px; background: #000; border-radius: 16px 0 0 16px; }
    .tutorial-generated-preview-media img { max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain; filter: contrast(1.02) saturate(1.02); }
    .tutorial-generated-preview aside { position: relative; border-left: 1px solid rgba(255,255,255,.16); padding: 28px; }
    .tutorial-generated-preview aside > button[aria-label] { position: absolute; right: 22px; top: 22px; width: 44px; height: 44px; border: 1px solid rgba(255,255,255,.68); border-radius: 999px; background: transparent; color: #fff; font-size: 28px; }
    .tutorial-generated-preview p { margin: 0; color: rgba(255,255,255,.88); font-weight: 800; }
    .tutorial-generated-preview h2 { margin: 18px 0 22px; font-size: 26px; line-height: 1.35; }
    .tutorial-generated-preview .meta { font-size: 16px; line-height: 1.55; font-weight: 650; }
    .tutorial-generated-preview .count { margin-top: 18px; }
    .tutorial-generated-preview .nav { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 345px; }
    .tutorial-generated-preview .nav button, .tutorial-generated-preview .favorite, .tutorial-generated-preview .download { width: 100%; height: 54px; border: 1px solid rgba(255,255,255,.68); border-radius: 8px; background: transparent; color: #fff; font-size: 18px; font-weight: 800; }
    .tutorial-generated-preview .favorite { margin-top: 10px; }
    .tutorial-generated-preview .download { margin-top: 12px; border-color: #2f78ff; background: #2f78ff; }
    @media (max-width: 800px) {
      .tutorial-generated-preview { inset: 76px 10px 16px; border-radius: 14px; }
      .tutorial-generated-preview-inner { grid-template-columns: 1fr; grid-template-rows: minmax(0, 1fr) auto; }
      .tutorial-generated-preview-media { border-radius: 14px 14px 0 0; padding: 10px; }
      .tutorial-generated-preview aside { padding: 14px; border-left: 0; border-top: 1px solid rgba(255,255,255,.16); }
      .tutorial-generated-preview h2 { margin: 8px 0 10px; font-size: 16px; }
      .tutorial-generated-preview .meta, .tutorial-generated-preview .count, .tutorial-generated-preview .favorite { display: none; }
      .tutorial-generated-preview .nav { display: none; }
      .tutorial-generated-preview .download { height: 40px; margin-top: 8px; font-size: 14px; }
      .tutorial-generated-preview aside > button[aria-label] { right: 12px; top: 10px; width: 34px; height: 34px; font-size: 22px; }
    }
  ` }).catch(() => undefined);
  await page.waitForFunction(() => {
    const img = document.querySelector(".tutorial-generated-preview img");
    return Boolean(img && img.complete && img.naturalWidth > 32 && img.naturalHeight > 32);
  }, undefined, { timeout: 30_000 }).catch(() => undefined);
}

async function refreshAndRecordProgress(page, recorder, asset) {
  if (!realGeneration && isMyDreamShootsSite && asset) {
    await showSyntheticSuccessState(page, asset);
    await setHistoryMask(page, false);
    const segment = timeline.find((item) => item.id === "progress");
    const previewButton = page.locator(".tutorial-synthetic-preview-button").first();
    await pointAt(page, previewButton).catch(() => undefined);
    await recorder.captureFor(segment.caption, segment.frames, async (index, frames) => {
      if (index === Math.max(0, frames - 2)) await pulseTutorialClick(page);
    });
    return;
  }
  await openResults(page);
  await setHistoryMask(page, true);
  const refresh = page.locator("#review-request").getByRole("button", { name: /Refresh status|Refreshing/i }).first();
  if (await refresh.isVisible().catch(() => false)) {
    await clickWithPointer(page, refresh, { force: true }).catch(() => undefined);
  }
  await setHistoryMask(page, true);
  const progress = page.locator("#review-request").getByText(/Request progress|All assets|generated/i).first();
  await pointAt(page, progress).catch(() => undefined);
  await recorder.capture(timeline.find((segment) => segment.id === "progress"));
}

function assetPreviewUrl(asset) {
  if (asset?.previewUrl) return asset.previewUrl;
  const storageKey = String(asset?.storageKey || "").replace(/\\/g, "/").replace(/^\/+/, "").replace(/^customer-assets\//, "");
  return storageKey ? `/api/local-assets/${storageKey}` : "";
}

async function waitForPreviewImageReady(page, dialog) {
  const image = dialog.locator("img").first();
  await image.waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForFunction(() => {
    const dialog = document.querySelector('[role="dialog"][aria-label*="Generated asset preview"]');
    const img = dialog?.querySelector("img");
    return Boolean(img && img.complete && img.naturalWidth > 32 && img.naturalHeight > 32);
  }, undefined, { timeout: 30_000 });
}

async function sharpenGeneratedPreviewForRecording(page) {
  if (!isMyDreamShootsSite) return;
  await page.addStyleTag({ content: `
    [role="dialog"][aria-label*="Generated asset preview"] img {
      image-rendering: auto !important;
      filter: contrast(1.02) saturate(1.02) !important;
    }
    [role="dialog"][aria-label*="Generated asset preview"] {
      padding: 24px !important;
    }
    @media (min-width: 900px) {
      [role="dialog"][aria-label*="Generated asset preview"] > div {
        max-width: min(1520px, calc(100vw - 72px)) !important;
      }
    }
  ` }).catch(() => undefined);
}

async function openGeneratedPreview(page, asset) {
  if (!realGeneration && isMyDreamShootsSite && asset?.id === "asset_mydreamshoots_tutorial_preview_image") {
    const previewButton = page.locator(".tutorial-synthetic-preview-button").first();
    await pointAt(page, previewButton).catch(() => undefined);
    await pulseTutorialClick(page, { sound: false });
    await showSyntheticGeneratedPreview(page, asset);
    await setHistoryMask(page, false);
    await sharpenGeneratedPreviewForRecording(page);
    const previewImage = page.locator(".tutorial-generated-preview img").first();
    await pointAt(page, previewImage).catch(() => undefined);
    return;
  }
  await openResults(page);
  await setHistoryMask(page, true);
  const tokens = [asset?.id || "", assetPreviewUrl(asset), asset?.storageKey || ""]
    .flatMap((value) => {
      const raw = String(value || "");
      const decoded = decodeURIComponent(raw);
      const fileName = decoded.split("?")[0].split("/").filter(Boolean).pop() || "";
      return [raw, decoded, fileName];
    })
    .filter(Boolean);
  await page.waitForFunction(({ tokens }) => {
    const root = document.querySelector("#review-request");
    if (!root) return false;
    const text = root.textContent || "";
    const hasDeliveredState = /Images delivered|Output ready|DELIVERED|SUCCEEDED/i.test(text);
    const hasPreviewButton = [...root.querySelectorAll("button")].some((button) =>
      /Open preview/i.test(`${button.textContent || ""} ${button.getAttribute("aria-label") || ""}`)
    );
    const hasImage = [...root.querySelectorAll("img")].some((img) => {
      const src = decodeURIComponent(img.getAttribute("src") || "");
      const alt = img.getAttribute("alt") || "";
      return (img.complete && img.naturalWidth > 32 && img.naturalHeight > 32) ||
        tokens.some((token) => src.includes(token) || alt.includes(token));
    });
    return hasDeliveredState && hasPreviewButton && hasImage;
  }, { tokens }, { timeout: 60_000 }).catch(() => undefined);
  const previewButton = page.locator('#review-request [role="status"] button').filter({ hasText: /Open preview/i }).first();
  if (await previewButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await previewButton.scrollIntoViewIfNeeded().catch(() => undefined);
    await clickWithPointer(page, previewButton, { force: true, pauseBeforeClickMs: 500, pauseAfterClickMs: 900 });
  }
  const clickedTarget = await page.evaluate(({ assetId, preview, storageKey }) => {
    if (document.querySelector('[role="dialog"][aria-label*="Generated asset preview"]')) return true;
    const normalized = String(preview || "");
    const decodedPreview = decodeURIComponent(normalized);
    const normalizedStorage = String(storageKey || "");
    const fileName = decodedPreview.split("?")[0].split("/").filter(Boolean).pop() || "";
    const tokens = [assetId, normalized, decodedPreview, normalizedStorage, fileName].filter(Boolean);
    const buttons = [...document.querySelectorAll("#review-request button")];
    const textButton = buttons.find((item) => /Open preview/i.test(`${item.textContent || ""} ${item.getAttribute("aria-label") || ""}`));
    if (textButton) {
      textButton.scrollIntoView({ block: "center", inline: "center" });
      window.setTimeout(() => textButton.click(), 120);
      return true;
    }
    const images = [...document.querySelectorAll("#review-request img")];
    const img = images.find((item) => {
      const rawSrc = item.getAttribute("src") || "";
      const src = decodeURIComponent(rawSrc);
      const alt = item.getAttribute("alt") || "";
      return tokens.some((token) => rawSrc.includes(token) || src.includes(token) || alt.includes(token));
    }) || images[0];
    const button = img?.closest("button,article")?.querySelector?.("button") || img?.closest("button");
    if (!button) return false;
    button.scrollIntoView({ block: "center", inline: "center" });
    window.setTimeout(() => button.click(), 120);
    return true;
  }, { assetId: asset?.id || "", preview: assetPreviewUrl(asset), storageKey: asset?.storageKey || "" }).catch(() => false);
  if (clickedTarget) await page.waitForTimeout(250);
  const dialog = page.locator('[role="dialog"][aria-label*="Generated asset preview"]').first();
  if (!await dialog.isVisible({ timeout: 8_000 }).catch(() => false)) {
    const firstImageButton = page.locator("#review-request button:has(img)").first();
    if (await firstImageButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await firstImageButton.scrollIntoViewIfNeeded().catch(() => undefined);
      await clickWithPointer(page, firstImageButton, { force: true });
    }
  }
  await dialog.waitFor({ state: "visible", timeout: 30_000 });
  await setHistoryMask(page, false);
  const previewImage = dialog.locator("img").first();
  await waitForPreviewImageReady(page, dialog);
  await sharpenGeneratedPreviewForRecording(page);
  await pointAt(page, previewImage).catch(() => undefined);
}

async function openHistoricalImagePreview(page) {
  await openResults(page);
  await setHistoryMask(page, true);
  const freshImageButton = page.locator(
    '#review-request [role="status"] button[aria-label*="Open preview"], #review-request [role="status"] button:has-text("Open preview"), #review-request [role="status"] button:has(img)'
  ).first();
  await freshImageButton.waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForFunction(() => {
    const button = document.querySelector('#review-request [role="status"] button[aria-label*="Open preview"], #review-request [role="status"] button');
    return Boolean(button && !button.disabled && button.querySelector("img"));
  }, undefined, { timeout: 30_000 });
  await clickWithPointer(page, freshImageButton, { force: true, pauseBeforeClickMs: 700, pauseAfterClickMs: 900 });
  const dialog = page.locator('[role="dialog"][aria-label*="Generated asset preview"]').first();
  await dialog.waitFor({ state: "visible", timeout: 30_000 });
  await setHistoryMask(page, false);
  await waitForPreviewImageReady(page, dialog);
  await sharpenGeneratedPreviewForRecording(page);
  const previewImage = dialog.locator("img").first();
  await pointAt(page, previewImage).catch(() => undefined);
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
  filters.push(`${concatInputs}concat=n=${timeline.length}:v=0:a=1,apad,atrim=duration=${finalDurationSeconds},asetpts=N/SR/TB[aout]`);
  const args = ["-y"];
  for (const segmentPath of segmentPaths) args.push("-i", segmentPath);
  args.push(
    "-filter_complex", filters.join(";"),
    "-map", "[aout]",
    "-c:a", "aac",
    "-b:a", "128k",
    "-ar", "48000",
    "-ac", "2",
    "-t", String(finalDurationSeconds),
    narrationPath
  );
  await run(ffmpegPath, args);
  return mixMouseClicksIntoNarration(narrationPath);
}

function dedupeClickSoundTimes() {
  const sorted = [...clickSoundTimes]
    .filter((second) => Number.isFinite(second) && second >= 0 && second < finalDurationSeconds - 0.05)
    .sort((a, b) => a - b);
  const unique = [];
  for (const second of sorted) {
    if (!unique.length || second - unique.at(-1) >= 0.18) unique.push(second);
  }
  return unique;
}

function mouseClickWavBuffer() {
  const sampleRate = 48_000;
  const channels = 2;
  const seconds = 0.09;
  const sampleCount = Math.round(sampleRate * seconds);
  const bytesPerSample = 2;
  const dataSize = sampleCount * channels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
  buffer.writeUInt16LE(channels * bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  let offset = 44;
  for (let i = 0; i < sampleCount; i += 1) {
    const t = i / sampleRate;
    const firstTick = Math.sin(2 * Math.PI * 2400 * t) * Math.exp(-t * 78);
    const secondTick = t > 0.016
      ? Math.sin(2 * Math.PI * 3600 * (t - 0.016)) * Math.exp(-(t - 0.016) * 110) * 0.38
      : 0;
    const softBody = Math.sin(2 * Math.PI * 780 * t) * Math.exp(-t * 42) * 0.18;
    const sample = Math.max(-1, Math.min(1, (firstTick + secondTick + softBody) * 0.56));
    const value = Math.round(sample * 32767);
    for (let channel = 0; channel < channels; channel += 1) {
      buffer.writeInt16LE(value, offset);
      offset += bytesPerSample;
    }
  }
  return buffer;
}

async function mixMouseClicksIntoNarration(voiceoverPath) {
  if (isMobileRecording) return voiceoverPath;
  const clickTimes = dedupeClickSoundTimes();
  if (!clickTimes.length) return voiceoverPath;
  await fs.writeFile(mouseClickSoundPath, mouseClickWavBuffer());
  const args = ["-y", "-i", voiceoverPath];
  for (const _ of clickTimes) args.push("-i", mouseClickSoundPath);
  const filters = ["[0:a]volume=1.0[voice]"];
  const inputs = ["[voice]"];
  clickTimes.forEach((second, index) => {
    const delayMs = Math.max(0, Math.round(second * 1000));
    filters.push(`[${index + 1}:a]adelay=${delayMs}|${delayMs},volume=0.7[c${index}]`);
    inputs.push(`[c${index}]`);
  });
  filters.push(`${inputs.join("")}amix=inputs=${inputs.length}:duration=first:dropout_transition=0,alimiter=limit=0.98[aout]`);
  await run(ffmpegPath, [
    ...args,
    "-filter_complex", filters.join(";"),
    "-map", "[aout]",
    "-c:a", "aac",
    "-b:a", "128k",
    "-ar", "48000",
    "-ac", "2",
    "-t", String(finalDurationSeconds),
    narrationWithClicksPath
  ]);
  log("mixed desktop click sounds", { clicks: clickTimes.length });
  return narrationWithClicksPath;
}

async function buildVideo(voiceoverPath) {
  const videoFilter = isMobileRecording
    ? `fps=30,scale=${outputSize.width}:${outputSize.height}:force_original_aspect_ratio=decrease,pad=${outputSize.width}:${outputSize.height}:(ow-iw)/2:(oh-ih)/2:color=0x07090d,format=yuv420p`
    : `fps=30,scale=${outputSize.width}:${outputSize.height}:force_original_aspect_ratio=increase,crop=${outputSize.width}:${outputSize.height},format=yuv420p`;
  await run(ffmpegPath, [
    "-y",
    "-framerate", String(captureFps),
    "-i", path.join(framesDir, "frame_%05d.png"),
    "-i", voiceoverPath,
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
    "-t", String(finalDurationSeconds),
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
  if (duration > finalDurationSeconds + 0.75 || duration < finalDurationSeconds - 0.75) throw new Error(`final_video_duration_invalid: ${duration}`);
  return { duration, width: video.width, height: video.height, audioStreams: audio.length };
}

async function exportSamples() {
  await fs.mkdir(samplesDir, { recursive: true });
  const sampleSeconds = [3, 10, 18, 26, 36, 45, Math.max(1, Math.floor(finalDurationSeconds - 3))].filter((second, index, list) => second < finalDurationSeconds && list.indexOf(second) === index);
  for (const second of sampleSeconds) {
    await run(ffmpegPath, ["-y", "-ss", String(second), "-i", finalOutputPath, "-frames:v", "1", "-q:v", "2", path.join(samplesDir, `sample-${String(second).padStart(2, "0")}s.jpg`)]);
  }
  const contactSheetScale = isMobileRecording ? "270:480" : "480:270";
  await run(ffmpegPath, ["-y", "-i", finalOutputPath, "-vf", `fps=1/7,scale=${contactSheetScale},tile=4x2`, "-frames:v", "1", "-update", "1", contactSheetPath]);
}

async function writeFailure(error, extra = {}) {
  await fs.mkdir(runDir, { recursive: true });
  await fs.writeFile(failurePath, `${JSON.stringify(sanitizeJson({ ok: false, error: error instanceof Error ? error.message : String(error), ...extra }), null, 2)}\n`);
}

async function main() {
  await fs.rm(runDir, { recursive: true, force: true });
  await fs.mkdir(framesDir, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });
  if (siteId === "site_dreamshoot") await ensureMydreamshootsTutorialSampleAssets();
  if (!realGeneration && siteId === "site_dreamshoot") await ensureMydreamshootsLocalPreviewImage();
  await prepareSourcePhoto();
  log("configuration", {
    baseUrl,
    siteId,
    siteSlug,
    targetSeconds,
    finalDurationSeconds,
    device: tutorialDevice,
    viewport,
    outputSize,
    realGeneration,
    maxPaidAttempts,
    packageTitle,
    output: finalOutputPath
  });

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
  if (useExistingTutorialSamples) {
    await context.addInitScript(({ siteId, customerId, primarySampleIds, partnerSampleIds }) => {
      const key = `dreamshoot:workspace:${siteId}:${customerId}:sample-selection:v2`;
      localStorage.setItem(key, JSON.stringify({
        primarySampleIds,
        partnerSampleIds,
        studioTrainingMode: "couple",
        primaryGender: "nonbinary",
        partnerGender: "nonbinary",
        studioModelName: ""
      }));
    }, {
      siteId,
      customerId: tutorialSampleCustomerId,
      primarySampleIds: tutorialPrimarySampleIds,
      partnerSampleIds: tutorialPartnerSampleIds
    });
  }
  const page = await context.newPage();
  page.setDefaultTimeout(pageTimeoutMs);
  page.on("pageerror", (error) => log("browser page error", { error: error.message }));
  page.on("console", (message) => {
    if (message.type() === "error") log("browser console error", { error: message.text().slice(0, 240) });
  });
  const recorder = new Recorder(page);
  const createdJobs = [];
  const recoveredJobs = [];
  try {
    await captureLoginAndAuthenticate(page, context, recorder);
    if (isMyDreamShootsSite) await showPricingRechargeStep(page, recorder);
    await recordWorkspaceOverview(page, recorder);
    await choosePackage(page, recorder);
    if (useExistingTutorialSamples) {
      try {
        await selectExistingSamples(page, recorder);
      } catch (error) {
        log("existing sample selection unavailable; falling back to upload", { error: error instanceof Error ? error.message : String(error) });
        await uploadSourcePhoto(page, recorder);
      }
    } else {
      await uploadSourcePhoto(page, recorder);
    }
    await openReviewDialog(page, recorder);
    const jobId = await submitJob(page, recorder);
    let result;
    if (jobId) {
      if (realGeneration) createdJobs.push(jobId);
      else recoveredJobs.push(jobId);
      const localPreviewAsset = !realGeneration && siteId === "site_dreamshoot" ? await localPreviewImageAsset() : undefined;
      if (localPreviewAsset) await ensureMydreamshootsLocalPreviewImage();
      await refreshAndRecordProgress(page, recorder, localPreviewAsset);
      result = localPreviewAsset
        ? { job: { id: jobId, status: "succeeded" }, asset: localPreviewAsset }
        : await waitForSuccess(page, jobId);
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
      recoveredJobs,
      paidCreateAttempts: createdJobs.length
    });
  } catch (error) {
    await writeFailure(error, { createdJobs, recoveredJobs });
    throw error;
  } finally {
    await browser.close().catch(() => undefined);
    await cleanupDirectTutorialSessions().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(`[image-tutorial] failed: ${sanitizeText(error instanceof Error ? error.stack || error.message : String(error))}`);
  process.exitCode = 1;
});
