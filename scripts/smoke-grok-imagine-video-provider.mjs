#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const baseUrl = String(process.env.GROK_VIDEO_BASE_URL || "https://magic666.top").trim().replace(/\/+$/, "");
const apiKey = String(process.env.GROK_VIDEO_API_KEY || "").trim();
const model = String(process.env.GROK_VIDEO_MODEL || "grok-imagine-video").trim();
const seconds = String(process.env.GROK_VIDEO_SECONDS || "6").trim();
const aspectRatioText = String(process.env.GROK_VIDEO_ASPECT_RATIO || "16:9").trim();
const resolution = String(process.env.GROK_VIDEO_RESOLUTION || "720P").trim();
const imagePath = path.resolve(process.cwd(), process.env.GROK_VIDEO_IMAGE_PATH || "public/assets/dreamshoot/frames/sample-engagement.webp");

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

function textToVideoPayload() {
  return {
    model,
    prompt: "A small red robot walks across a clean studio floor and waves at the camera. Natural motion, no text or overlays.",
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

async function runCase(name, payloadFactory) {
  const payload = await payloadFactory();
  const created = await postVideo(payload);
  const createTaskId = taskIdFrom(created.json);
  if (!created.response.ok || !createTaskId) {
    throw new Error(`${name}_create_failed_${created.response.status}_${JSON.stringify(created.json).slice(0, 500)}`);
  }
  const statusBody = await pollVideo(createTaskId);
  const downloaded = await downloadVideo(createTaskId, statusBody);
  return {
    taskId: createTaskId,
    status: statusFrom(statusBody),
    videoUrl: resultUrlFrom(statusBody, createTaskId),
    bytes: downloaded.bytes.length,
    contentType: downloaded.contentType
  };
}

const imageToVideo = await runCase("image_to_video", imageToVideoPayload);
const textToVideo = await runCase("text_to_video", textToVideoPayload);

console.log(JSON.stringify({
  ok: true,
  baseUrl,
  model,
  imageToVideo,
  textToVideo
}, null, 2));
