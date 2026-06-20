import fs from "fs/promises";
import path from "path";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";

const workspaceRoot = process.cwd();
const briefPath = path.join(workspaceRoot, "tmp", "page-design-prompts", "design-briefs.json");
const outDir = path.join(workspaceRoot, "tmp", "page-design-renders");
const optimizedInputDir = path.join(outDir, "_optimized-inputs");
const rawResponseDir = path.join(outDir, "_raw-responses");
const execFileAsync = promisify(execFile);

const model = process.env.IMAGE_MODEL ?? "gpt-image-2";
const size = process.env.IMAGE_SIZE ?? "1536x1024";
const mode = process.env.IMAGE_MODE ?? "edit";
const requestRetries = Number(process.env.IMAGE_RETRIES ?? 4);
const requestRetryDelayMs = Number(process.env.IMAGE_RETRY_DELAY_MS ?? 2000);
const inputImageRateLimitCooldownMs = Number(process.env.IMAGE_INPUT_RATE_LIMIT_COOLDOWN_MS ?? 20000);
const inputMaxDimension = Number(process.env.IMAGE_INPUT_MAX_DIM ?? 1024);
const requestTimeoutMs = Number(process.env.IMAGE_REQUEST_TIMEOUT_MS ?? 180000);
const imageStart = Number(process.env.IMAGE_START ?? 0);
const interRequestDelayMs = Number(process.env.IMAGE_INTER_REQUEST_DELAY_MS ?? 0);
const continueOnError = process.env.IMAGE_CONTINUE_ON_ERROR !== "false";
const skipExisting = process.env.IMAGE_SKIP_EXISTING !== "false";
const imageFilter = (process.env.IMAGE_FILTER ?? "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readCodexAuth() {
  const authPath = path.join(os.homedir(), ".codex", "auth.json");
  if (!(await fileExists(authPath))) {
    return null;
  }

  try {
    const raw = await fs.readFile(authPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function readCodexProviderBaseUrl() {
  const configPath = path.join(os.homedir(), ".codex", "config.toml");
  if (!(await fileExists(configPath))) {
    return "";
  }

  try {
    const raw = await fs.readFile(configPath, "utf8");
    const match = raw.match(/base_url\s*=\s*"([^"]+)"/);
    return match ? match[1] : "";
  } catch {
    return "";
  }
}

async function resolveApiConfig() {
  const codexAuth = await readCodexAuth();
  const codexBaseUrl = await readCodexProviderBaseUrl();

  return {
    apiBaseUrl:
      process.env.IMAGE_API_BASE_URL ??
      process.env.OPENAI_BASE_URL ??
      codexBaseUrl ??
      "",
    apiKey:
      process.env.IMAGE_API_KEY ??
      process.env.OPENAI_API_KEY ??
      codexAuth?.OPENAI_API_KEY ??
      ""
  };
}

function normalizeBaseUrl(url) {
  const trimmed = url.replace(/\/$/, "");
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

function isRateLimit(body, response) {
  return response.status === 429 || body?.error?.code === "rate_limit_exceeded";
}

function isInputImageRateLimit(body) {
  return body?.error?.type === "input-images";
}

function isRetriableServerError(body, response) {
  return (
    response.status >= 500 ||
    body?.error?.code === "server_is_overloaded" ||
    body?.error?.type === "service_unavailable_error"
  );
}

function hasImagePayload(body) {
  return Boolean(
    body?.data?.[0]?.b64_json ??
      body?.data?.[0]?.image_base64 ??
      body?.output?.[0]?.b64_json ??
      body?.output?.[0]?.image_base64 ??
      body?.image_base64
  );
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDuration(ms) {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

function buildPrompt(entry) {
  return [
    "Use case: ui-mockup",
    "Asset type: premium product page redesign reference",
    `Primary request: ${entry.prompt}`,
    `Reference screenshot name: ${entry.name}`,
    "Preserve the same information architecture, the same module intent, and the same product flow.",
    "Do not introduce unrelated new modules.",
    "Upgrade typography, spacing, hierarchy, color discipline, and visual confidence.",
    "The result must feel like a premium SaaS or premium AI storefront depending on the page type.",
    "Avoid generic AI gradients, random blobs, tiny unreadable text, fake dashboard clutter, or card spam.",
    "Output a clean, implementation-friendly product mockup image."
  ].join("\n");
}

async function ensureDir() {
  await fs.mkdir(outDir, { recursive: true });
  await fs.mkdir(optimizedInputDir, { recursive: true });
  await fs.mkdir(rawResponseDir, { recursive: true });
}

async function readBriefs() {
  const raw = await fs.readFile(briefPath, "utf8");
  return JSON.parse(raw);
}

async function performRequest(entry, requestFactory, failureLabel) {
  for (let attempt = 1; attempt <= requestRetries; attempt += 1) {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(`timeout:${requestTimeoutMs}`), requestTimeoutMs);

    try {
      console.log(`${entry.name}: request started (attempt ${attempt}/${requestRetries})`);
      const response = await requestFactory(controller.signal);
      const body = await response.json().catch(() => ({}));
      const elapsed = Date.now() - startedAt;
      if (response.ok) {
        if (!hasImagePayload(body) && attempt < requestRetries) {
          const backoff = requestRetryDelayMs * attempt;
          console.warn(
            `${entry.name}: empty image payload after ${formatDuration(elapsed)}, retrying in ${backoff}ms (attempt ${attempt}/${requestRetries})`
          );
          await sleep(backoff);
          continue;
        }
        console.log(`${entry.name}: request completed in ${formatDuration(elapsed)}`);
        return body;
      }

      if (attempt < requestRetries && (isRateLimit(body, response) || isRetriableServerError(body, response))) {
        const backoff = isInputImageRateLimit(body)
          ? Math.max(requestRetryDelayMs * attempt, inputImageRateLimitCooldownMs)
          : requestRetryDelayMs * attempt;
        const reason = isInputImageRateLimit(body)
          ? "input-image rate limited"
          : isRateLimit(body, response)
            ? "rate limited"
            : "server busy";
        console.warn(
          `${entry.name}: ${reason} after ${formatDuration(elapsed)}, retrying in ${backoff}ms (attempt ${attempt}/${requestRetries})`
        );
        await sleep(backoff);
        continue;
      }

      throw new Error(`${entry.name}: ${failureLabel} ${response.status} ${JSON.stringify(body)}`);
    } catch (error) {
      const elapsed = Date.now() - startedAt;
      const isTimeout =
        error instanceof Error &&
        (error.name === "AbortError" || String(error.message).includes(`timeout:${requestTimeoutMs}`));
      const shouldRetry = attempt < requestRetries && isTimeout;

      if (shouldRetry) {
        const backoff = requestRetryDelayMs * attempt;
        console.warn(
          `${entry.name}: request timed out after ${formatDuration(elapsed)}, retrying in ${backoff}ms (attempt ${attempt}/${requestRetries})`
        );
        await sleep(backoff);
        continue;
      }

      if (isTimeout) {
        throw new Error(`${entry.name}: ${failureLabel} timeout after ${formatDuration(elapsed)}`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

async function createGeneration(entry, apiConfig) {
  return performRequest(
    entry,
    (signal) =>
      fetch(`${normalizeBaseUrl(apiConfig.apiBaseUrl)}/images/generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiConfig.apiKey}`
        },
        signal,
        body: JSON.stringify({
          model,
          prompt: buildPrompt(entry),
          size,
          response_format: "b64_json"
        })
      }),
    "generation failed"
  );
}

async function optimizeInputImage(sourceImagePath) {
  if (inputMaxDimension <= 0) {
    return sourceImagePath;
  }

  const parsed = path.parse(sourceImagePath);
  const optimizedPath = path.join(optimizedInputDir, `${parsed.name}-${inputMaxDimension}.png`);

  if (await fileExists(optimizedPath)) {
    return optimizedPath;
  }

  try {
    await execFileAsync("sips", [
      "-Z",
      String(inputMaxDimension),
      "--setProperty",
      "format",
      "png",
      sourceImagePath,
      "--out",
      optimizedPath
    ]);
    return optimizedPath;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Failed to optimize ${sourceImagePath}, using original input: ${message}`);
    return sourceImagePath;
  }
}

async function createEdit(entry, apiConfig) {
  const sourceImagePath = entry.designInputFile ?? entry.file;
  const optimizedImagePath = await optimizeInputImage(sourceImagePath);
  const imageBuffer = await fs.readFile(optimizedImagePath);
  const form = new FormData();
  form.set("model", model);
  form.set("prompt", buildPrompt(entry));
  form.set("size", size);
  form.set("response_format", "b64_json");
  form.append("image[]", new Blob([imageBuffer], { type: "image/png" }), path.basename(optimizedImagePath));

  return performRequest(
    entry,
    (signal) =>
      fetch(`${normalizeBaseUrl(apiConfig.apiBaseUrl)}/images/edits`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiConfig.apiKey}`
        },
        signal,
        body: form
      }),
    "edit failed"
  );
}

async function saveImage(entry, body) {
  const rawPath = path.join(rawResponseDir, `${entry.name}.json`);
  await fs.writeFile(rawPath, `${JSON.stringify(body, null, 2)}\n`);

  const candidate =
    body?.data?.[0]?.b64_json ??
    body?.data?.[0]?.image_base64 ??
    body?.output?.[0]?.b64_json ??
    body?.output?.[0]?.image_base64 ??
    body?.image_base64 ??
    null;
  const b64 = typeof candidate === "string" ? candidate : null;
  if (!b64) {
    throw new Error(`${entry.name}: no image data returned (raw: ${rawPath})`);
  }
  const imagePath = path.join(outDir, `${entry.name}.png`);
  const metaPath = path.join(outDir, `${entry.name}.json`);
  await fs.writeFile(imagePath, Buffer.from(b64, "base64"));
  await fs.writeFile(
    metaPath,
    `${JSON.stringify(
      {
        name: entry.name,
        route: entry.url,
        family: entry.family,
        template: entry.template,
        sourceImage: entry.designInputFile ?? entry.file,
        prompt: buildPrompt(entry),
        revisedPrompt: body?.data?.[0]?.revised_prompt ?? null,
        model: body?.model ?? model,
        size: body?.size ?? size,
        mode,
        rawResponse: rawPath
      },
      null,
      2
    )}\n`
  );
  return { imagePath, metaPath };
}

async function existingRender(entry) {
  const imagePath = path.join(outDir, `${entry.name}.png`);
  const metaPath = path.join(outDir, `${entry.name}.json`);
  if ((await fileExists(imagePath)) && (await fileExists(metaPath))) {
    return { imagePath, metaPath };
  }
  return null;
}

async function main() {
  const apiConfig = await resolveApiConfig();

  if (!apiConfig.apiBaseUrl || !apiConfig.apiKey) {
    throw new Error("Missing IMAGE_API_BASE_URL/IMAGE_API_KEY or OPENAI_BASE_URL/OPENAI_API_KEY");
  }

  await ensureDir();
  const briefs = await readBriefs();
  const filtered = imageFilter.length ? briefs.filter((entry) => imageFilter.includes(entry.name)) : briefs;
  const limit = Number(process.env.IMAGE_LIMIT ?? filtered.length);
  const selected = filtered.slice(imageStart, imageStart + limit);
  const results = [];
  const errors = [];

  console.log(
    `Using ${normalizeBaseUrl(apiConfig.apiBaseUrl)} with ${selected.length} page(s), mode=${mode}, start=${imageStart}, retries=${requestRetries}, timeout=${requestTimeoutMs}ms`
  );

  for (const entry of selected) {
    try {
      if (skipExisting) {
        const existing = await existingRender(entry);
        if (existing) {
          results.push({ name: entry.name, image: existing.imagePath, meta: existing.metaPath, skipped: true });
          console.log(`skipped ${entry.name}`);
          continue;
        }
      }

      const body = mode === "generate" ? await createGeneration(entry, apiConfig) : await createEdit(entry, apiConfig);
      const saved = await saveImage(entry, body);
      results.push({ name: entry.name, image: saved.imagePath, meta: saved.metaPath });
      console.log(`generated ${entry.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ name: entry.name, route: entry.url, error: message });
      console.error(`failed ${entry.name}: ${message}`);
      if (!continueOnError) {
        throw error;
      }
    }

    if (interRequestDelayMs > 0) {
      await sleep(interRequestDelayMs);
    }
  }

  await fs.writeFile(path.join(outDir, "render-results.json"), `${JSON.stringify(results, null, 2)}\n`);
  await fs.writeFile(path.join(outDir, "render-errors.json"), `${JSON.stringify(errors, null, 2)}\n`);
  console.log(`Wrote ${results.length} redesign renders to ${outDir}`);
  if (errors.length) {
    console.log(`Encountered ${errors.length} error(s); see render-errors.json`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
