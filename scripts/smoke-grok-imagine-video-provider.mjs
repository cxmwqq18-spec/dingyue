#!/usr/bin/env node
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";

const baseUrl = String(process.env.GROK_VIDEO_BASE_URL || "https://magic666.top").trim().replace(/\/+$/, "");
const apiKey = String(process.env.GROK_VIDEO_API_KEY || "").trim();
const model = String(process.env.GROK_VIDEO_MODEL || "grok-imagine-video").trim();
const seconds = String(process.env.GROK_VIDEO_SECONDS || "6").trim();
const aspectRatioText = String(process.env.GROK_VIDEO_ASPECT_RATIO || "16:9").trim();
const resolution = String(process.env.GROK_VIDEO_RESOLUTION || "720P").trim();
const imagePath = path.resolve(process.cwd(), process.env.GROK_VIDEO_IMAGE_PATH || "public/assets/dreamshoot/frames/sample-engagement.webp");
const contentProbeEnabled = process.env.GROK_VIDEO_CONTENT_PROBE !== "0";
const execFileAsync = promisify(execFile);

if (!apiKey) {
  throw new Error("missing GROK_VIDEO_API_KEY");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function taskIdFrom(body) {
  return String(body?.task_id ?? body?.id ?? body?.request_id ?? body?.data?.task_id ?? "").trim();
}

function statusFrom(body) {
  return String(body?.status ?? body?.state ?? body?.status_group ?? "").trim().toLowerCase();
}

function resultUrlFrom(body, taskId) {
  return String(body?.video_url ?? body?.result_url ?? body?.video?.url ?? `${baseUrl}/v1/videos/${encodeURIComponent(taskId)}/content`).trim();
}

async function fetchJson(url, init = {}, timeoutMs = 30_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
    const json = await response.clone().json().catch(() => ({}));
    return { response, json };
  } finally {
    clearTimeout(timer);
  }
}

async function postVideo(payload) {
  return fetchJson(`${baseUrl}/v1/videos`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  }, 45_000);
}

async function pollVideo(taskId) {
  const startedAt = Date.now();
  let last = "";
  while (Date.now() - startedAt < 20 * 60 * 1000) {
    await sleep(8000);
    const { response, json } = await fetchJson(`${baseUrl}/v1/videos/${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    }, 45_000);
    last = JSON.stringify({ status: statusFrom(json), progress: json?.progress, state: json?.state }).slice(0, 240);
    if (!response.ok) {
      throw new Error(`poll_failed_${response.status}_${JSON.stringify(json).slice(0, 240)}`);
    }
    const status = statusFrom(json);
    if (status === "completed" || status === "succeeded" || status === "done") return json;
    if (status === "failed" || status === "cancelled" || status === "canceled") {
      throw new Error(`task_failed_${JSON.stringify(json).slice(0, 500)}`);
    }
  }
  throw new Error(`task_timeout_${last || "no_status"}`);
}

async function downloadVideo(taskId, statusBody) {
  const url = resultUrlFrom(statusBody, taskId);
  const { response } = await fetchJson(url, {
    headers: { Authorization: `Bearer ${apiKey}` }
  }, 120_000);
  const contentType = response.headers.get("content-type") || "";
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!response.ok) {
    throw new Error(`download_failed_${response.status}`);
  }
  if (!bytes.length) {
    throw new Error("download_empty");
  }
  return { contentType, bytes };
}

async function firstFrameStats(bytes) {
  if (!ffmpegPath) throw new Error("ffmpeg_static_missing");
  const tmpDir = await fs.mkdtemp(path.join("/tmp", "grok-video-smoke-"));
  const inputPath = path.join(tmpDir, "input.mp4");
  try {
    await fs.writeFile(inputPath, bytes);
    const { stdout } = await execFileAsync(
      ffmpegPath,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        "0",
        "-i",
        inputPath,
        "-frames:v",
        "1",
        "-vf",
        "scale=64:36",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        "-"
      ],
      { encoding: "buffer", maxBuffer: 64 * 36 * 3 + 1024 }
    );
    if (!stdout.length) throw new Error("first_frame_empty");
    let red = 0;
    let green = 0;
    let blue = 0;
    for (let index = 0; index < stdout.length; index += 3) {
      red += stdout[index];
      green += stdout[index + 1];
      blue += stdout[index + 2];
    }
    const pixels = stdout.length / 3;
    return {
      red: Math.round(red / pixels),
      green: Math.round(green / pixels),
      blue: Math.round(blue / pixels)
    };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

function textToVideoPayload() {
  return {
    model,
    prompt: "A small red robot walks across a clean studio floor and waves at the camera. Natural motion, no text or overlays.",
    seconds,
    aspect_ratio: aspectRatioText,
    resolution
  };
}

function redCardPayload() {
  return {
    model,
    prompt: "The entire video is a flat solid bright red color card. No objects, no people, no animals, no scenery, no text, no camera movement. Every frame should be overwhelmingly red.",
    seconds,
    aspect_ratio: aspectRatioText,
    resolution
  };
}

async function imageToVideoPayload() {
  const bytes = await fs.readFile(imagePath);
  return {
    model,
    prompt: "Keep the subject and background recognizable. Add gentle camera movement and subtle natural motion.",
    seconds,
    aspect_ratio: "1:1",
    resolution,
    image: `data:image/webp;base64,${bytes.toString("base64")}`
  };
}

async function runCase(name, payloadFactory, options = {}) {
  const payload = await payloadFactory();
  const created = await postVideo(payload);
  const createTaskId = taskIdFrom(created.json);
  if (!created.response.ok || !createTaskId) {
    throw new Error(`${name}_create_failed_${created.response.status}_${JSON.stringify(created.json).slice(0, 500)}`);
  }
  const statusBody = await pollVideo(createTaskId);
  const downloaded = await downloadVideo(createTaskId, statusBody);
  const frameStats = options.frameStats ? await firstFrameStats(downloaded.bytes) : undefined;
  if (options.expectRedDominant) {
    const stats = frameStats ?? await firstFrameStats(downloaded.bytes);
    if (!(stats.red >= 130 && stats.red >= stats.green + 35 && stats.red >= stats.blue + 35)) {
      throw new Error(`${name}_content_probe_failed_${JSON.stringify(stats)}`);
    }
  }
  return {
    taskId: createTaskId,
    status: statusFrom(statusBody),
    videoUrl: resultUrlFrom(statusBody, createTaskId),
    bytes: downloaded.bytes.length,
    contentType: downloaded.contentType,
    ...(frameStats ? { frameStats } : {})
  };
}

const imageToVideo = await runCase("image_to_video", imageToVideoPayload);
const textToVideo = await runCase("text_to_video", textToVideoPayload);
const redCard = contentProbeEnabled
  ? await runCase("red_card", redCardPayload, { frameStats: true, expectRedDominant: true })
  : undefined;

console.log(JSON.stringify({
  ok: true,
  baseUrl,
  model,
  imageToVideo,
  textToVideo,
  ...(redCard ? { redCard } : {})
}, null, 2));
