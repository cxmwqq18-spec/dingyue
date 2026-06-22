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

function cookieValue(cookie, name) {
  return cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

const anonymous = await request("/api/platform/ai-providers", { allowFailure: true });
if (anonymous.response.status !== 401 || anonymous.json.error !== "platform_login_required") {
  throw new Error(`ai provider API did not require auth: ${anonymous.response.status} ${JSON.stringify(anonymous.json)}`);
}

await request("/api/platform/state", {
  method: "POST",
  headers: { "x-smoke-reset": "true" },
  body: { reset: true }
});

const login = await request("/api/platform/auth/login", {
  method: "POST",
  body: { email: "platform@local.test", password: "platform123" }
});
const csrfCookie = cookieFrom(login.response, "platform_csrf");
const csrfToken = cookieValue(csrfCookie, "platform_csrf");
const cookie = [cookieFrom(login.response, "platform_session"), csrfCookie].join("; ");

const page = await request("/platform?module=gateway", { cookie });
const html = await page.text();
for (const marker of ["AI 配置面板", "供应商列表", "测试连通性", "AI 网关策略", "域名管理"]) {
  if (!html.includes(marker)) throw new Error(`platform gateway page missing marker: ${marker}`);
}

const missingCsrf = await request("/api/platform/ai-providers", {
  method: "PUT",
  cookie,
  body: { label: "Smoke AI", aiUrl: "https://example.com/v1/models", apiKey: "sk_smoke_secret", modelType: "gpt-image-2" },
  allowFailure: true
});
if (missingCsrf.response.status !== 403 || missingCsrf.json.error !== "csrf_token_required") {
  throw new Error(`ai provider PUT did not require csrf: ${missingCsrf.response.status} ${JSON.stringify(missingCsrf.json)}`);
}

const saved = await request("/api/platform/ai-providers", {
  method: "PUT",
  cookie,
  headers: { "x-csrf-token": csrfToken },
  body: { label: "Smoke AI", aiUrl: "https://example.com/v1/models", apiKey: "sk_smoke_secret", modelType: "gpt-image-2", makeCurrent: true }
});
const provider = saved.json.providers.find((item) => item.id === saved.json.currentProviderId);
if (!provider?.isCurrent || !provider.status.apiKeyConfigured || JSON.stringify(saved.json).includes("sk_smoke_secret")) {
  throw new Error(`ai provider save/mask failed: ${JSON.stringify(saved.json)}`);
}

const tested = await request("/api/platform/ai-providers", {
  method: "POST",
  cookie,
  headers: { "x-csrf-token": csrfToken },
  body: { action: "test", id: provider.id, aiUrl: provider.aiUrl, modelType: provider.modelType }
});
if (!tested.json.test?.ok || tested.json.test.message !== "mock provider reachable") {
  throw new Error(`ai provider mock test failed: ${JSON.stringify(tested.json.test)}`);
}

const fetched = await request("/api/platform/ai-providers", { cookie });
const fetchedProvider = fetched.json.providers.find((item) => item.id === provider.id);
if (!fetchedProvider?.status.apiKeyConfigured || JSON.stringify(fetched.json).includes("sk_smoke_secret")) {
  throw new Error(`ai provider GET did not preserve masked key state: ${JSON.stringify(fetched.json)}`);
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

console.log(JSON.stringify({
  ok: true,
  providerId: provider.id,
  currentProviderId: saved.json.currentProviderId,
  preview: provider.status.apiKeyPreview,
  modelType: provider.modelType,
  fallbackProviders: fallback.length
}, null, 2));
