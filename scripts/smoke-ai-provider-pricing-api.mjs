import http from "node:http";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";

const base = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const prisma = new PrismaClient();

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
  return { response, json };
}

function cookieFrom(response, name) {
  const raw = response.headers.get("set-cookie") ?? "";
  const match = raw.match(new RegExp(`(?:^|,\\s*)(${name}=[^;]+)`));
  if (!match?.[1]) throw new Error(`missing ${name} cookie`);
  return match[1];
}

const login = await request("/api/platform/auth/login", {
  method: "POST",
  body: { email: "platform@local.test", password: "platform123" }
});
const cookie = ["platform_session", "platform_csrf"].map((name) => cookieFrom(login.response, name)).join("; ");
const csrf = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("platform_csrf="))?.slice("platform_csrf=".length);
const authHeaders = { "x-csrf-token": csrf };

const results = [];
const baselineProviderIds = process.env.SMOKE_BASELINE_PROVIDER_IDS?.split(",").map((id) => id.trim()).filter(Boolean) ?? [];
let testProviderId = "";

try {
  // 1. 通过后台接口给一条视频通道写入模型级价格
  const upstream = http.createServer((req, res) => {
    if (req.url?.startsWith("/v1/models")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ object: "list", data: [{ id: "grok-imagine-video-1.5", object: "model" }] }));
      return;
    }
    res.writeHead(404); res.end("{}");
  });
  await new Promise((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const upstreamBaseUrl = `http://127.0.0.1:${upstream.address().port}`;

  const created = await request("/api/platform/ai-providers", {
    method: "PUT",
    cookie,
    headers: authHeaders,
    body: {
      label: "Smoke Priced Video",
      aiUrl: upstreamBaseUrl,
      apiKey: "sk_smoke_priced",
      modelType: "grok-imagine-video-1.5",
      providerType: "video",
      apiProtocol: "openai-videos",
      enabled: true,
      videoDurations: [6, 10, 15],
      videoAspectRatios: ["9:16", "1:1", "16:9"],
      priceEnabled: true,
      priceCredits: 30,
      priceVideoDurations: { "6": 30, "10": 50, "15": 90 },
      priceVideoResolutions: { "1080p": 120 },
      priceImageInput: 4,
      priceVideoInput: 3,
      priceVideoInputPerSecond: 1,
      priceAudioInput: 2,
      priceAudioInputPerSecond: 1
    }
  });
  const priced = created.json.providers.find((row) => row.label === "Smoke Priced Video");
  if (!priced) throw new Error("priced provider not created");
  testProviderId = priced.id;
  results.push({ step: "priced_provider_created", ok: true, id: testProviderId });

  // 2. 回读必须与写入一致
  if (priced.priceEnabled !== true) throw new Error("priceEnabled not persisted");
  if (priced.priceCredits !== 30) throw new Error(`priceCredits mismatch: ${priced.priceCredits}`);
  if (priced.priceVideoDurations?.["15"] !== 90) throw new Error(`priceVideoDurations mismatch: ${JSON.stringify(priced.priceVideoDurations)}`);
  if (priced.priceVideoResolutions?.["1080p"] !== 120) throw new Error("priceVideoResolutions mismatch");
  if (priced.priceImageInput !== 4 || priced.priceVideoInput !== 3 || priced.priceAudioInput !== 2) {
    throw new Error("input prices mismatch");
  }
  results.push({ step: "price_readback", ok: true });

  // 3. 未定价的通道必须仍然返回 null（不得变成 0 分）
  const unpriced = created.json.providers.find((row) => row.label !== "Smoke Priced Video" && row.providerType === "image");
  if (unpriced && unpriced.priceEnabled) throw new Error("unpriced provider unexpectedly priced");
  results.push({ step: "unpriced_untouched", ok: true });

  // 4. 计价函数：按模型通道算出的价格必须与任务预扣费用同源
  const { resolveAiProviderPrice } = await import("../src/lib/ai-provider-pricing.ts");
  const price15 = resolveAiProviderPrice({
    priceEnabled: true, priceCredits: 30,
    priceVideoDurations: { "6": 30, "10": 50, "15": 90 },
    priceVideoResolutions: { "1080p": 120 },
    priceImageInput: 4,
    capabilityType: "video", durationSeconds: 15, resolution: "720p", imageInputCount: 2, outputCount: 1
  });
  if (price15.unitCredits !== 90 + 4 * 2) throw new Error(`duration price wrong: ${price15.unitCredits}`);
  const price1080 = resolveAiProviderPrice({
    priceEnabled: true, priceCredits: 30,
    priceVideoDurations: { "15": 90 },
    priceVideoResolutions: { "1080p": 120 },
    capabilityType: "video", durationSeconds: 15, resolution: "1080p", outputCount: 1
  });
  if (price1080.unitCredits !== 120) throw new Error(`resolution price wrong: ${price1080.unitCredits}`);
  results.push({ step: "price_math", ok: true, duration15: price15.unitCredits, resolution1080: price1080.unitCredits });

  // 5. 关闭模型级计价后必须回落到主题价口径
  const disabled = await request("/api/platform/ai-providers", {
    method: "PUT",
    cookie,
    headers: authHeaders,
    body: {
      id: testProviderId,
      label: "Smoke Priced Video",
      aiUrl: upstreamBaseUrl,
      modelType: "grok-imagine-video-1.5",
      providerType: "video",
      apiProtocol: "openai-videos",
      enabled: true,
      priceEnabled: false,
      priceCredits: 30,
      priceVideoDurations: { "15": 90 }
    }
  });
  const disabledRow = disabled.json.providers.find((row) => row.id === testProviderId);
  if (disabledRow?.priceEnabled !== false) throw new Error("priceEnabled not disabled");
  if (disabledRow?.priceCredits !== 30) throw new Error("priceCredits should persist after disabling");
  results.push({ step: "price_disable_falls_back", ok: true });

  upstream.close();
} finally {
  if (testProviderId) {
    await prisma.platformAiProvider.deleteMany({ where: { id: testProviderId } });
  }
  if (baselineProviderIds.length) {
    await prisma.platformAiProvider.deleteMany({ where: { id: { notIn: baselineProviderIds } } });
  }
  await prisma.$disconnect();
}

console.log(JSON.stringify({ ok: true, results }, null, 2));
