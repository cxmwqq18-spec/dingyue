#!/usr/bin/env node
import "./load-runtime-env.mjs";

function argValue(name) {
  const prefixed = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefixed));
  if (inline) return inline.slice(prefixed.length).trim();
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? String(process.argv[index + 1] ?? "").trim() : "";
}

function usage() {
  return [
    "Usage:",
    "  node scripts/recover-video-provider-output.mjs --site <siteId> --job <jobId> (--task <providerTaskId> | --url <videoUrl>) [--provider <providerId>] [--base http://127.0.0.1:3002]",
    "",
    "Safety:",
    "  This script only calls the internal recovery endpoint. It does not create a new provider video task."
  ].join("\n");
}

const siteId = argValue("site") || argValue("siteId");
const jobId = argValue("job") || argValue("jobId");
const providerTaskId = argValue("task") || argValue("taskId") || argValue("providerTaskId");
const videoUrl = argValue("url") || argValue("videoUrl") || argValue("resultUrl");
const providerId = argValue("provider") || argValue("providerId");
const baseUrl = (argValue("base") || process.env.RECOVER_VIDEO_BASE_URL || "http://127.0.0.1:3002").replace(/\/+$/, "");
const secret = String(process.env.AI_WORKER_SECRET || "dev-worker-secret").trim();

if (!siteId || !jobId || (!providerTaskId && !videoUrl)) {
  console.error(usage());
  process.exit(1);
}

const response = await fetch(`${baseUrl}/api/internal/ai-worker/recover-video-output`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-ai-worker-secret": secret
  },
  body: JSON.stringify({
    siteId,
    jobId,
    providerId: providerId || undefined,
    providerTaskId: providerTaskId || undefined,
    videoUrl: videoUrl || undefined
  }),
  cache: "no-store"
});

const text = await response.text();
let body;
try {
  body = JSON.parse(text);
} catch {
  body = { raw: text.slice(0, 1000) };
}

console.log(JSON.stringify({
  ok: response.ok && body.ok !== false,
  status: response.status,
  result: body
}, null, 2));

if (!response.ok || body.ok === false) process.exit(1);
