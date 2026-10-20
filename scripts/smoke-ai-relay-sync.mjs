import http from "node:http";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";

const base = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";

// 直连数据库清理 smoke 产生的行：平台删除接口要求每类至少保留一条供应商，
// 同步出来的新增模型无法通过接口删除，必须由 smoke 自行回收，避免污染共享数据库。
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

function cookiesFrom(response, names) {
  return names.map((name) => cookieFrom(response, name)).join("; ");
}

function cookieValue(cookie, name) {
  return cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

// 本地上游中转模拟：返回 OpenAI 兼容的 /v1/models 目录。
const upstreamModels = [
  "gpt-image-2",
  "nano-banana",
  "grok-imagine-video-1.5",
  "veo-4-omni",
  "whisper-1",
  "gpt-5.5"
];

const upstream = http.createServer((request, response) => {
  if (request.url?.startsWith("/v1/models")) {
    if (request.headers.authorization !== "Bearer sk_relay_smoke") {
      response.writeHead(401, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: { message: "Invalid token" } }));
      return;
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({
      object: "list",
      data: upstreamModels.map((id) => ({ id, object: "model", created: 0, owned_by: "relay" }))
    }));
    return;
  }
  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: { message: "not found" } }));
});

await new Promise((resolve) => upstream.listen(0, "127.0.0.1", resolve));
const upstreamBaseUrl = `http://127.0.0.1:${upstream.address().port}`;

const login = await request("/api/platform/auth/login", {
  method: "POST",
  body: { email: "platform@local.test", password: "platform123" }
});
const cookie = cookiesFrom(login.response, ["platform_session", "platform_csrf"]);
const csrfToken = cookieValue(cookie, "platform_csrf");
const authHeaders = { "x-csrf-token": csrfToken };

let relayId = "";
let createdProviderId = "";
const results = [];

try {
  // 1. 新建中转平台
  const createdRelay = await request("/api/platform/ai-relays", {
    method: "PUT",
    cookie,
    headers: authHeaders,
    body: { label: "Smoke Relay", baseUrl: upstreamBaseUrl, apiKey: "sk_relay_smoke" }
  });
  relayId = createdRelay.json.relay.id;
  results.push({ step: "relay_created", ok: Boolean(relayId) });

  // 2. 预览差异：应识别图片/视频/音频/对话四类
  const preview = await request("/api/platform/ai-relays", {
    method: "POST",
    cookie,
    headers: authHeaders,
    body: { action: "preview", relayId }
  });
  const entries = preview.json.plan.entries;
  const byCapability = Object.fromEntries(entries.map((entry) => [entry.upstreamModelId, entry.providerType]));
  if (byCapability["grok-imagine-video-1.5"] !== "video") throw new Error(`video classification failed: ${JSON.stringify(byCapability)}`);
  if (byCapability["veo-4-omni"] !== "video") throw new Error(`veo classification failed: ${JSON.stringify(byCapability)}`);
  if (byCapability["gpt-image-2"] !== "image") throw new Error(`image classification failed: ${JSON.stringify(byCapability)}`);
  if (byCapability["nano-banana"] !== "image") throw new Error(`nano-banana classification failed: ${JSON.stringify(byCapability)}`);
  if (byCapability["whisper-1"] !== "audio") throw new Error(`audio classification failed: ${JSON.stringify(byCapability)}`);
  if (byCapability["gpt-5.5"] !== "text") throw new Error(`text classification failed: ${JSON.stringify(byCapability)}`);
  if (preview.json.plan.created !== upstreamModels.length) throw new Error(`preview create count mismatch: ${preview.json.plan.created}`);
  results.push({ step: "preview_classified", ok: true, capabilities: byCapability });

  // 3. 执行同步
  const synced = await request("/api/platform/ai-relays", {
    method: "POST",
    cookie,
    headers: authHeaders,
    body: { action: "sync", relayId }
  });
  if (synced.json.applied.created !== upstreamModels.length) throw new Error(`sync create count mismatch: ${JSON.stringify(synced.json.applied)}`);
  results.push({ step: "synced", ok: true, applied: synced.json.applied });

  // 4. 同步后通道应归属该中转，且默认停用（不自动进入生产队列）
  const relayRows = await request("/api/platform/ai-relays", { cookie });
  const rows = relayRows.json.providers[relayId] ?? [];
  if (rows.length !== upstreamModels.length) throw new Error(`relay provider rows mismatch: ${rows.length}`);
  if (rows.some((row) => row.enabled)) throw new Error("synced providers must not be auto-enabled");
  if (rows.some((row) => row.syncState !== "synced")) throw new Error(`unexpected sync state: ${JSON.stringify(rows.map((row) => row.syncState))}`);
  const videoRow = rows.find((row) => row.modelType === "grok-imagine-video-1.5");
  if (!videoRow || videoRow.providerType !== "video") throw new Error(`video row missing: ${JSON.stringify(rows)}`);
  if (videoRow.apiProtocol !== "openai-videos") throw new Error(`video protocol mismatch: ${videoRow.apiProtocol}`);
  createdProviderId = videoRow.id;
  results.push({ step: "relay_rows", ok: true, count: rows.length });

  // 5. 幂等：再次同步不应重复创建
  const resynced = await request("/api/platform/ai-relays", {
    method: "POST",
    cookie,
    headers: authHeaders,
    body: { action: "sync", relayId }
  });
  if (resynced.json.applied.created !== 0) throw new Error(`resync created duplicates: ${JSON.stringify(resynced.json.applied)}`);
  if (resynced.json.applied.unchanged !== upstreamModels.length) throw new Error(`resync unchanged mismatch: ${JSON.stringify(resynced.json.applied)}`);
  results.push({ step: "resync_idempotent", ok: true, applied: resynced.json.applied });

  // 6. 人工编辑过的字段在同步时必须保留（compare-and-set）
  const edited = await request("/api/platform/ai-providers", {
    method: "PUT",
    cookie,
    headers: authHeaders,
    body: { id: createdProviderId, label: "Manual Video", aiUrl: "https://example.com/v1", modelType: "grok-imagine-video-1.5", providerType: "video", priority: 5, makeCurrent: false, enabled: true, videoDurations: [6, 10, 15], videoAspectRatios: ["9:16", "1:1", "16:9"] }
  });
  const editedRow = edited.json.providers.find((row) => row.id === createdProviderId);
  if (!editedRow) throw new Error("edited provider row missing");
  if (editedRow.label !== "Manual Video" || editedRow.priority !== 5) throw new Error(`manual edit not applied: ${JSON.stringify(editedRow)}`);

  const resyncedAfterEdit = await request("/api/platform/ai-relays", {
    method: "POST",
    cookie,
    headers: authHeaders,
    body: { action: "sync", relayId }
  });
  const afterEdit = await request("/api/platform/ai-relays", { cookie });
  const afterEditRow = (afterEdit.json.providers[relayId] ?? []).find((row) => row.id === createdProviderId);
  if (!afterEditRow) throw new Error("edited provider row disappeared after sync");
  if (afterEditRow.label !== "Manual Video") throw new Error(`sync overwrote manual label: ${afterEditRow.label}`);
  if (afterEditRow.priority !== 5) throw new Error(`sync overwrote manual priority: ${afterEditRow.priority}`);
  if (afterEditRow.enabled !== true) throw new Error("sync disabled a manually enabled provider");
  if (resyncedAfterEdit.json.applied.removed !== 0) throw new Error("sync removed live providers unexpectedly");
  results.push({ step: "manual_fields_preserved", ok: true });

  // 7. “设为优先”必须真正成为该类型当前通道（历史缺陷回归）
  const imageProvider = (await request("/api/platform/ai-providers", { cookie })).json.providers.find((row) => row.providerType === "image");
  if (!imageProvider) throw new Error("no image provider available for priority check");
  const previousImagePreferredId = (await request("/api/platform/ai-providers", { cookie })).json.currentProviderIds.image;
  const promoted = await request("/api/platform/ai-providers", {
    method: "PUT",
    cookie,
    headers: authHeaders,
    body: {
      id: imageProvider.id,
      label: imageProvider.label,
      aiUrl: imageProvider.aiUrl,
      modelType: imageProvider.modelType,
      providerType: "image",
      priority: 99,
      makeCurrent: true,
      enabled: true
    }
  });
  const promotedId = promoted.json.currentProviderIds.image;
  if (promotedId !== imageProvider.id) throw new Error(`makeCurrent did not switch current image provider: ${promotedId} vs ${imageProvider.id}`);
  const promotedRow = promoted.json.providers.find((row) => row.id === imageProvider.id);
  if (!promotedRow?.preferred) throw new Error("makeCurrent did not set preferred flag");
  results.push({ step: "make_current_switches", ok: true, currentImageProviderId: promotedId });

  // 恢复原有的生图优先通道，避免 smoke 改变共享数据库的调度状态
  if (previousImagePreferredId && previousImagePreferredId !== promotedId) {
    await request("/api/platform/ai-providers", {
      method: "POST",
      cookie,
      headers: authHeaders,
      body: { providerId: previousImagePreferredId },
      allowFailure: true
    });
  }

  // 8. 新增视频通道并设为优先后，视频类型应存在当前通道
  const videoProvider = await request("/api/platform/ai-providers", {
    method: "PUT",
    cookie,
    headers: authHeaders,
    body: {
      label: "Smoke Video Channel",
      aiUrl: "https://yinglingapi.com",
      apiKey: "sk_smoke_video",
      modelType: "grok-imagine-video-1.5",
      providerType: "video",
      apiProtocol: "openai-videos",
      priority: 42,
      makeCurrent: true,
      enabled: true,
      videoDurations: [6, 10, 15],
      videoAspectRatios: ["9:16", "1:1", "16:9"]
    }
  });
  const currentVideoId = videoProvider.json.currentProviderIds.video;
  if (currentVideoId !== videoProvider.json.providers.find((row) => row.label === "Smoke Video Channel")?.id) {
    throw new Error(`video makeCurrent did not switch current video provider: ${currentVideoId}`);
  }
  const currentVideoRow = videoProvider.json.providers.find((row) => row.id === currentVideoId);
  if (currentVideoRow?.priority !== 0) throw new Error(`current video provider priority should be 0: ${currentVideoRow?.priority}`);
  results.push({ step: "video_current_channel", ok: true, currentVideoProviderId: currentVideoId });

  // 8. 删除中转后，其同步通道必须解除归属、清空凭据并回到人工维护状态
  const removedRelay = await request("/api/platform/ai-relays", {
    method: "DELETE",
    cookie,
    headers: authHeaders,
    body: { relayId }
  });
  if (!removedRelay.response.ok) throw new Error(`relay delete failed: ${removedRelay.response.status}`);
  const afterDelete = await request("/api/platform/ai-relays", { cookie });
  const orphanRows = afterDelete.json.providers?.[relayId] ?? [];
  if (orphanRows.length) throw new Error(`relay delete left orphan rows: ${JSON.stringify(orphanRows)}`);
  const orphanCheck = await request("/api/platform/ai-relays", { cookie });
  const allRows = Object.values(orphanCheck.json.providers ?? {}).flat();
  if (allRows.some((row) => row.syncState === "synced")) throw new Error(`stale sync state after relay delete: ${JSON.stringify(allRows)}`);
  const providerAfterDelete = (await request("/api/platform/ai-providers", { cookie })).json.providers.find((row) => row.id === createdProviderId);
  if (providerAfterDelete?.syncState === "synced") throw new Error("provider kept synced state after relay delete");
  if (providerAfterDelete?.status?.apiKeyConfigured) throw new Error("provider kept relay credential after relay delete");
  results.push({ step: "relay_delete_clears_ownership", ok: true });

  // 清理：删除本次创建的通道
  const cleanupIds = [createdProviderId, videoProvider.json.providers.find((row) => row.label === "Smoke Video Channel")?.id].filter(Boolean);
  for (const providerId of cleanupIds) {
    const removed = await request("/api/platform/ai-providers", {
      method: "DELETE",
      cookie,
      headers: authHeaders,
      body: { providerId },
      allowFailure: true
    });
    if (!removed.response.ok && removed.json.error !== "ai_provider_delete_last") {
      throw new Error(`cleanup failed: ${removed.response.status} ${JSON.stringify(removed.json)}`);
    }
  }
  results.push({ step: "cleanup", ok: true, removed: cleanupIds.length });
} finally {
  if (relayId) {
    await request("/api/platform/ai-relays", {
      method: "DELETE",
      cookie,
      headers: authHeaders,
      body: { relayId },
      allowFailure: true
    });
  }
  // 兜底回收：同步产生的通道在接口层删不掉（每类需保留一条），这里按中转归属直接清理。
  const baselineProviderIds = process.env.SMOKE_BASELINE_PROVIDER_IDS?.split(",").map((id) => id.trim()).filter(Boolean) ?? [];
  await prisma.platformAiProvider.deleteMany({
    where: baselineProviderIds.length
      ? { id: { notIn: baselineProviderIds } }
      : { label: { startsWith: "Smoke " } }
  });
  await prisma.platformAiRelay.deleteMany({ where: { id: relayId || "__none__" } });
  await prisma.$disconnect();
  upstream.close();
}

console.log(JSON.stringify({ ok: true, results }, null, 2));
