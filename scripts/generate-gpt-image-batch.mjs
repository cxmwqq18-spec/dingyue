#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";

const args = parseArgs(process.argv.slice(2));
const manifestPath = args.manifest;
const concurrency = Math.max(1, Number(args.concurrency || process.env.IMAGE_BATCH_CONCURRENCY || 4));
const force = Boolean(args.force);
const savePrompts = Boolean(args.savePrompts);
const callScript = path.resolve("/Users/cxm/.codex/skills/sub2api-gpt-image-2/scripts/gpt_image_2_call.mjs");

if (!manifestPath) {
  console.error("Usage: node scripts/generate-gpt-image-batch.mjs --manifest ./image-jobs.json [--concurrency 6] [--force] [--save-prompts]");
  process.exit(2);
}

const apiKey = process.env.IMAGE_API_KEY;
if (!apiKey) {
  console.error("Missing IMAGE_API_KEY. Pass it only as an environment variable, never in the manifest.");
  process.exit(1);
}

const manifest = JSON.parse(await fs.readFile(path.resolve(manifestPath), "utf8"));
const jobs = Array.isArray(manifest) ? manifest : manifest.jobs;

if (!Array.isArray(jobs) || jobs.length === 0) {
  console.error("Manifest must be an array or an object with a non-empty jobs array.");
  process.exit(2);
}

const defaults = Array.isArray(manifest) ? {} : manifest.defaults || {};
const queue = jobs.map((job, index) => normalizeJob(job, defaults, index));
const results = [];
let cursor = 0;

console.log(`Starting ${queue.length} image jobs with concurrency=${concurrency}`);

await Promise.all(
  Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (cursor < queue.length) {
      const job = queue[cursor++];
      const result = await runJob(job);
      results.push(result);
      const status = result.ok ? "ok" : "failed";
      console.log(`${status}: ${job.name} -> ${job.out}`);
    }
  })
);

const failed = results.filter((result) => !result.ok);
const succeeded = results.filter((result) => result.ok);

console.log(
  JSON.stringify(
    {
      total: results.length,
      succeeded: succeeded.length,
      failed: failed.map((result) => ({ name: result.job.name, out: result.job.out, error: result.error }))
    },
    null,
    2
  )
);

if (failed.length > 0) {
  process.exitCode = 1;
}

async function runJob(job) {
  try {
    if (!force && (await exists(job.out))) {
      return { ok: true, skipped: true, job };
    }

    await fs.mkdir(path.dirname(path.resolve(job.out)), { recursive: true });
    if (savePrompts) {
      await fs.writeFile(replaceExtension(job.out, ".prompt.txt"), `${job.prompt}\n`);
    }

    const childArgs = [
      callScript,
      job.mode,
      "--prompt",
      job.prompt,
      "--out",
      job.out,
      "--timeout",
      String(job.timeout)
    ];

    if (job.baseUrl) childArgs.push("--base-url", job.baseUrl);
    if (job.model) childArgs.push("--model", job.model);
    if (job.size) childArgs.push("--size", job.size);
    if (job.quality) childArgs.push("--quality", job.quality);
    if (job.outputFormat) childArgs.push("--output-format", job.outputFormat);
    if (job.mode === "edit") childArgs.push("--image", job.image);

    await spawnNode(childArgs, job.timeout + 60);
    return { ok: true, skipped: false, job };
  } catch (error) {
    return { ok: false, job, error: error.message };
  }
}

function normalizeJob(job, defaults, index) {
  const merged = { ...defaults, ...job };
  const mode = merged.mode || (merged.image ? "edit" : "generate");
  const name = merged.name || `image-${index + 1}`;
  if (!["generate", "edit"].includes(mode)) failJob(name, "mode must be generate or edit");
  if (!merged.prompt) failJob(name, "missing prompt");
  if (!merged.out) failJob(name, "missing out");
  if (mode === "edit" && !merged.image) failJob(name, "edit mode requires image");

  return {
    name,
    mode,
    prompt: String(merged.prompt),
    out: path.resolve(merged.out),
    image: merged.image ? path.resolve(merged.image) : null,
    baseUrl: merged.baseUrl,
    model: merged.model || "gpt-image-2",
    size: merged.size || "1024x1024",
    quality: merged.quality || "low",
    outputFormat: merged.outputFormat || "png",
    timeout: Number(merged.timeout || 900)
  };
}

function spawnNode(childArgs, timeoutSeconds) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, childArgs, {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`timed out after ${timeoutSeconds}s`));
    }, timeoutSeconds * 1000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new Error((stderr || stdout || `node exited ${code}`).slice(0, 2000)));
    });
  });
}

async function exists(filePath) {
  try {
    await fs.access(path.resolve(filePath));
    return true;
  } catch {
    return false;
  }
}

function parseArgs(list) {
  const parsed = {};
  for (let index = 0; index < list.length; index += 1) {
    const item = list[index];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const next = list[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function replaceExtension(filePath, extension) {
  const parsed = path.parse(filePath);
  return path.join(parsed.dir, `${parsed.name}${extension}`);
}

function failJob(name, message) {
  console.error(`Invalid job "${name}": ${message}`);
  process.exit(2);
}
