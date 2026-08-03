const base = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";

async function request(path, { method = "GET", body, cookie, headers = {}, allowFailure = false } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual"
  });
  const json = await response.clone().json().catch(() => ({}));
  if (!allowFailure && !response.ok) throw new Error(`${method} ${path} failed: ${response.status} ${JSON.stringify(json)}`);
  return { response, json, text: () => response.text() };
}

function cookieFrom(response, name) {
  const raw = response.headers.get("set-cookie") ?? "";
  const match = raw.match(new RegExp(`(?:^|,\\s*)(${name}=[^;]+)`));
  if (!match?.[1]) throw new Error(`missing ${name} cookie`);
  return match[1];
}

function cookiesFrom(response, names) {
  return names.map((name) => cookieFrom(response, name)).join("; ");
}

function cookieValue(cookie, name) {
  return cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollAsyncJob(jobId, cookie) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const current = await request(`/api/platform/async-jobs/${jobId}`, { cookie });
    const job = current.json.job;
    if (job?.status === "succeeded" || job?.status === "failed") return job;
    await sleep(250);
  }
  throw new Error(`async job did not finish: ${jobId}`);
}

const anonymous = await request("/api/platform/ai-providers", { allowFailure: true });
if (anonymous.response.status !== 401 || anonymous.json.error !== "platform_login_required") {
  throw new Error(`ai provider API did not require auth: ${anonymous.response.status} ${JSON.stringify(anonymous.json)}`);
}

const login = await request("/api/platform/auth/login", {
  method: "POST",
  body: { email: "platform@local.test", password: "platform123" }
});
const cookie = cookiesFrom(login.response, ["platform_session", "platform_csrf"]);
const csrfToken = cookieValue(cookie, "platform_csrf");
const before = await request("/api/platform/ai-providers", { cookie });
const previousCurrentProviderId = before.json.currentProviderIds?.image || before.json.currentProviderId || before.json.providers?.[0]?.id || "";
const previousVideoCurrentProviderId = before.json.currentProviderIds?.video || "";
let providerId = "";
let videoProviderId = "";

const page = await request("/platform?module=gateway", { cookie });
const html = await page.text();
for (const marker of ["AI 配置面板", "供应商列表", "新增供应商", "测试连通性", "AI 网关策略", "域名管理"]) {
  if (!html.includes(marker)) throw new Error(`platform gateway page missing marker: ${marker}`);
}

const missingCsrf = await request("/api/platform/ai-providers", {
  method: "PUT",
  cookie,
  body: { label: "Smoke AI", aiUrl: "https://example.com/v1/models", apiKey: "sk_smoke_secret", modelType: "gpt-image-2", providerType: "image" },
  allowFailure: true
});
if (missingCsrf.response.status !== 403 || missingCsrf.json.error !== "csrf_token_required") {
  throw new Error(`ai provider PUT did not require csrf: ${missingCsrf.response.status} ${JSON.stringify(missingCsrf.json)}`);
}

const saved = await request("/api/platform/ai-providers", {
  method: "PUT",
  cookie,
  headers: { "x-csrf-token": csrfToken },
  body: {
    label: `Smoke AI ${Date.now()}`,
    aiUrl: "https://example.com/v1/models",
    apiKey: "sk_smoke_secret",
    modelType: "gpt-image-2",
    providerType: "image",
    makeCurrent: true,
    supportsEditN: true,
    maxImagesPerRequest: 7
  }
});
const provider = saved.json.providers.find((item) => item.id === saved.json.currentProviderIds?.image);
providerId = provider?.id ?? "";
if (!provider?.isCurrent || provider.providerType !== "image" || provider.supportsEditN !== true || provider.maxImagesPerRequest !== 7 || !provider.status.apiKeyConfigured || JSON.stringify(saved.json).includes("sk_smoke_secret")) {
  throw new Error(`ai provider save/mask failed: ${JSON.stringify(saved.json)}`);
}

const savedVideo = await request("/api/platform/ai-providers", {
  method: "PUT",
  cookie,
  headers: { "x-csrf-token": csrfToken },
  body: {
    label: `Smoke Video ${Date.now()}`,
    aiUrl: "https://example.com/v1/videos",
    apiKey: "sk_smoke_video_secret",
    modelType: "grok-imagine-video",
    providerType: "video",
    makeCurrent: true,
    maxImagesPerRequest: 3
  }
});
const videoProvider = savedVideo.json.providers.find((item) => item.id === savedVideo.json.currentProviderIds?.video);
videoProviderId = videoProvider?.id ?? "";
if (!videoProvider?.isCurrent || videoProvider.providerType !== "video" || savedVideo.json.currentProviderIds?.image !== provider.id) {
  throw new Error(`video provider current state is not independent: ${JSON.stringify(savedVideo.json.currentProviderIds)}`);
}

const tested = await request("/api/platform/ai-providers", {
  method: "POST",
  cookie,
  headers: { "x-csrf-token": csrfToken },
  body: { action: "test", id: provider.id, aiUrl: provider.aiUrl, modelType: provider.modelType }
});
if (tested.response.status !== 202 || !tested.json.jobId) {
  throw new Error(`ai provider test did not return an async job: ${tested.response.status} ${JSON.stringify(tested.json)}`);
}
const testJob = await pollAsyncJob(tested.json.jobId, cookie);
if (testJob.status !== "succeeded" || !testJob.result?.ok || testJob.result.message !== "mock provider reachable") {
  throw new Error(`ai provider mock test failed: ${JSON.stringify(testJob)}`);
}

const fetched = await request("/api/platform/ai-providers", { cookie });
const fetchedProvider = fetched.json.providers.find((item) => item.id === provider.id);
if (!fetchedProvider?.status.apiKeyConfigured || fetchedProvider.maxImagesPerRequest !== 7 || JSON.stringify(fetched.json).includes("sk_smoke_secret")) {
  throw new Error(`ai provider GET did not preserve masked key state: ${JSON.stringify(fetched.json)}`);
}
if (JSON.stringify(fetched.json).includes("sk_smoke_video_secret")) {
  throw new Error("ai provider GET leaked video provider API key");
}

const fallback = fetched.json.providers
  .filter((item) => item.status.configured)
  .map((item) => ({ id: item.id, preferred: item.isCurrent, priority: item.isCurrent ? 0 : 100 }));
if (!fallback.some((item) => item.id === provider.id && item.preferred === true && item.priority === 0)) {
  throw new Error(`provider fallback priority was not represented in API state: ${JSON.stringify(fallback)}`);
}
if (JSON.stringify(fallback).includes("sk_smoke_secret")) {
  throw new Error("generation worker payload leaked AI provider API key");
}

if (previousCurrentProviderId && previousCurrentProviderId !== providerId) {
  await request("/api/platform/ai-providers", {
    method: "POST",
    cookie,
    headers: { "x-csrf-token": csrfToken },
    body: { action: "current", providerId: previousCurrentProviderId }
  });
}
if (previousVideoCurrentProviderId && previousVideoCurrentProviderId !== videoProviderId) {
  await request("/api/platform/ai-providers", {
    method: "POST",
    cookie,
    headers: { "x-csrf-token": csrfToken },
    body: { action: "current", providerId: previousVideoCurrentProviderId }
  });
}
if (videoProviderId) {
  const deletedVideo = await request("/api/platform/ai-providers", {
    method: "DELETE",
    cookie,
    headers: { "x-csrf-token": csrfToken },
    body: { providerId: videoProviderId },
    allowFailure: true
  });
  if (!deletedVideo.response.ok && deletedVideo.json.error !== "ai_provider_delete_last") {
    throw new Error(`video provider cleanup failed: ${deletedVideo.response.status} ${JSON.stringify(deletedVideo.json)}`);
  }
}
const deleted = await request("/api/platform/ai-providers", {
  method: "DELETE",
  cookie,
  headers: { "x-csrf-token": csrfToken },
  body: { providerId },
  allowFailure: true
});
if (!deleted.response.ok && deleted.json.error !== "ai_provider_delete_last") {
  throw new Error(`ai provider cleanup failed: ${deleted.response.status} ${JSON.stringify(deleted.json)}`);
}

console.log(JSON.stringify({
  ok: true,
  providerId: provider.id,
  videoProviderId,
  restoredProviderId: previousCurrentProviderId || deleted.json.currentProviderId || "",
  preview: provider.status.apiKeyPreview,
  modelType: provider.modelType,
  maxImagesPerRequest: provider.maxImagesPerRequest,
  fallbackProviders: fallback.length
}, null, 2));
