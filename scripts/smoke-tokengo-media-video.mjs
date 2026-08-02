import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const jiti = require("jiti")(path.join(__dirname, "smoke-tokengo-media-video.mjs"), {
  alias: { "@": path.resolve(__dirname, "..", "src") },
  interopDefault: true
});
const {
  createTokengoMediaVideoTask,
  fetchTokengoMediaVideoTask,
  tokengoMediaResultUrlFromBody,
  tokengoMediaVideoParams,
  resolveTokengoMediaResultUrl
} = jiti(path.join(__dirname, "..", "src/lib/tokengo-media-video.ts"));

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

const requests = [];
const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  if (request.method === "POST" && url.pathname === "/v1/media/generate") {
    const bodyText = await readRequestBody(request);
    const body = JSON.parse(bodyText);
    requests.push({ body, headers: request.headers, method: request.method, path: url.pathname });
    assert.equal(request.headers.authorization, "Bearer sk_test_tokengo");
    assert.match(String(request.headers["content-type"] ?? ""), /^application\/json/);
    if (body.prompt === "trigger-402") {
      json(response, 402, { error: { code: "insufficient_funds", message: "余额不足" } });
      return;
    }
    if (body.prompt === "trigger-403") {
      json(response, 403, { error: { code: "insufficient_funds", message: "余额不足" } });
      return;
    }
    json(response, 200, { task_id: "task-created" });
    return;
  }
  if (request.method === "GET" && url.pathname === "/v1/skills/task-status") {
    requests.push({ headers: request.headers, method: request.method, path: url.pathname, taskId: url.searchParams.get("task_id") });
    assert.equal(request.headers.authorization, "Bearer sk_test_tokengo");
    const taskId = url.searchParams.get("task_id");
    if (taskId === "task-success") {
      json(response, 200, {
        task_id: taskId,
        is_final: true,
        state: "success",
        status: "生成成功",
        progress: 100,
        result: { videos: [{ url: "/videos/task-success.mp4" }] },
        cost: 0.12
      });
      return;
    }
    if (taskId === "task-pending") {
      json(response, 200, {
        is_final: false,
        state: "running",
        status: "生成中",
        progress: null
      });
      return;
    }
    if (taskId === "task-failed") {
      json(response, 200, {
        task_id: taskId,
        is_final: true,
        state: "failed",
        status: "生成失败",
        error: "内容安全策略拦截"
      });
      return;
    }
    if (taskId === "task-nonfinal-failed") {
      json(response, 200, {
        task_id: taskId,
        is_final: false,
        state: "failed",
        status: "暂时重试",
        error: "上游暂时不可用"
      });
      return;
    }
  }
  json(response, 404, { error: { code: "not_found", message: "not found" } });
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert(address && typeof address === "object");
const baseUrl = `http://127.0.0.1:${address.port}`;
const fetchWithTimeout = (resource, init) => fetch(resource, init);

try {
  assert.deepEqual(
    tokengoMediaVideoParams({ aspect_ratio: "16:9", duration: "8" }, ["data:image/jpeg;base64,aaa"], "https://cdn.example/end.jpg"),
    {
      aspect_ratio: "16:9",
      duration: 8,
      images: ["data:image/jpeg;base64,aaa"],
      end_image_url: "https://cdn.example/end.jpg"
    }
  );
  assert.deepEqual(
    tokengoMediaVideoParams({ aspect_ratio: "16:9", duration: "8" }, ["https://cdn.example/first.jpg"], "https://cdn.example/end.jpg", "grok-video-3"),
    {
      aspect_ratio: "16:9",
      duration: 8,
      images: ["https://cdn.example/first.jpg"],
      end_image_url: "https://cdn.example/end.jpg",
      mode: "first-last"
    }
  );
  assert.deepEqual(
    tokengoMediaVideoParams({ aspect_ratio: "9:16", duration: "10" }, ["https://cdn.example/1.jpg", "https://cdn.example/2.jpg"], undefined, "grok-imagine-video"),
    {
      aspect_ratio: "9:16",
      duration: 10,
      images: ["https://cdn.example/1.jpg", "https://cdn.example/2.jpg"],
      mode: "reference"
    }
  );
  assert.deepEqual(
    tokengoMediaVideoParams({ aspect_ratio: "16:9", duration: "15", resolution: "720p" }, ["https://cdn.example/first.jpg"], undefined, "grok-imagine-1.5"),
    {
      aspect_ratio: "16:9",
      duration: 15,
      resolution: "720p",
      count: 1,
      images: ["https://cdn.example/first.jpg"]
    }
  );
  assert.deepEqual(
    tokengoMediaVideoParams({ aspect_ratio: "16:9", duration: "15", resolution: "720p" }, [], undefined, "grok-imagine-1.5"),
    {
      aspect_ratio: "16:9",
      duration: 15,
      resolution: "720p",
      count: 1
    }
  );
  assert.deepEqual(
    tokengoMediaVideoParams(
      { aspect_ratio: "9:16", duration: "10", resolution: "1080p", count: 3 },
      ["https://cdn.example/1.jpg", "https://cdn.example/2.jpg"],
      undefined,
      "seedance-2-0-special"
    ),
    {
      aspect_ratio: "9:16",
      duration: 15,
      resolution: "720p",
      quality: "标准",
      count: 1,
      images: ["https://cdn.example/1.jpg", "https://cdn.example/2.jpg"],
      mode: "reference"
    }
  );
  assert.deepEqual(
    tokengoMediaVideoParams(
      { aspect_ratio: "16:9", duration: "6", resolution: "480p" },
      ["https://cdn.example/first.jpg"],
      undefined,
      "seedance-2-0-special"
    ),
    {
      aspect_ratio: "16:9",
      duration: 15,
      resolution: "720p",
      quality: "标准",
      count: 1,
      images: ["https://cdn.example/first.jpg"],
      mode: "first-frame"
    }
  );
  assert.deepEqual(
    tokengoMediaVideoParams(
      { aspect_ratio: "16:9", duration: "6", resolution: "480p" },
      ["https://cdn.example/first.jpg"],
      "https://cdn.example/end.jpg",
      "seedance-2-0-special"
    ),
    {
      aspect_ratio: "16:9",
      duration: 15,
      resolution: "720p",
      quality: "标准",
      count: 1,
      images: ["https://cdn.example/first.jpg"],
      end_image_url: "https://cdn.example/end.jpg",
      mode: "first-last"
    }
  );
  assert.deepEqual(
    tokengoMediaVideoParams({ aspect_ratio: "16:9", duration: "6", resolution: "480p" }, [], undefined, "seedance-2-0-special"),
    {
      aspect_ratio: "16:9",
      duration: 15,
      resolution: "720p",
      quality: "标准",
      count: 1,
      mode: "text-to-video"
    }
  );
  assert.deepEqual(tokengoMediaVideoParams({ aspect_ratio: "9:16", duration: "bad" }, []), {
    aspect_ratio: "9:16",
    duration: 6
  });

  const created = await createTokengoMediaVideoTask({
    baseUrl,
    apiKey: "sk_test_tokengo",
    model: "veo-3.1",
    prompt: "a cat running",
    imageUrls: ["data:image/jpeg;base64,aaa"],
    endImageUrl: "https://cdn.example/end.jpg",
    videoParams: { aspect_ratio: "16:9", duration: "8" },
    fetchWithTimeout,
    timeoutMs: 5000
  });
  assert.equal(created.id, "task-created");
  const createBody = requests.find((item) => item.method === "POST")?.body;
  assert.equal(createBody.model, "veo-3.1");
  assert.equal(createBody.prompt, "a cat running");
  assert.deepEqual(createBody.params, {
    aspect_ratio: "16:9",
    duration: 8,
    images: ["data:image/jpeg;base64,aaa"],
    end_image_url: "https://cdn.example/end.jpg",
    mode: "first-last"
  });
  assert.equal("resolution" in createBody.params, false);
  const createRequest = requests.find((item) => item.method === "POST");
  assert.equal(createRequest?.headers["x-schedule-strategy"], "reliability_first");

  requests.length = 0;
  const grok15Created = await createTokengoMediaVideoTask({
    baseUrl,
    apiKey: "sk_test_tokengo",
    model: "grok-imagine-1.5",
    prompt: "single image motion",
    imageUrls: ["https://cdn.example/first.jpg"],
    videoParams: { aspect_ratio: "16:9", duration: "15", resolution: "720p" },
    fetchWithTimeout,
    timeoutMs: 5000
  });
  assert.equal(grok15Created.id, "task-created");
  const grok15Body = requests.find((item) => item.method === "POST")?.body;
  assert.deepEqual(grok15Body.params, {
    aspect_ratio: "16:9",
    duration: 15,
    resolution: "720p",
    count: 1,
    images: ["https://cdn.example/first.jpg"]
  });
  assert.equal("mode" in grok15Body.params, false);

  const seedanceCreated = await createTokengoMediaVideoTask({
    baseUrl,
    apiKey: "sk_test_tokengo",
    model: "seedance-2-0-special",
    prompt: "seedance references",
    imageUrls: ["https://cdn.example/1.jpg", "https://cdn.example/2.jpg"],
    videoParams: { aspect_ratio: "9:16", duration: "10", resolution: "1080p", count: 3 },
    fetchWithTimeout,
    timeoutMs: 5000
  });
  assert.equal(seedanceCreated.id, "task-created");
  const seedanceBody = requests.filter((item) => item.method === "POST").at(-1)?.body;
  assert.deepEqual(seedanceBody.params, {
    aspect_ratio: "9:16",
    duration: 15,
    resolution: "720p",
    quality: "标准",
    count: 1,
    images: ["https://cdn.example/1.jpg", "https://cdn.example/2.jpg"],
    mode: "reference"
  });

  const success = await fetchTokengoMediaVideoTask({
    baseUrl,
    apiKey: "sk_test_tokengo",
    taskId: "task-success",
    fetchWithTimeout,
    timeoutMs: 5000
  });
  assert.equal(success.state, "success");
  assert.equal(success.isFinal, true);
  assert.equal(success.resultUrl, "/videos/task-success.mp4");
  assert.equal(success.cost, 0.12);
  assert.equal(resolveTokengoMediaResultUrl(baseUrl, success.resultUrl), `${baseUrl}/videos/task-success.mp4`);
  const successStatusRequest = requests.find((item) => item.method === "GET" && item.taskId === "task-success");
  assert.equal(successStatusRequest?.headers["x-schedule-strategy"], "reliability_first");

  const pending = await fetchTokengoMediaVideoTask({
    baseUrl,
    apiKey: "sk_test_tokengo",
    taskId: "task-pending",
    fetchWithTimeout,
    timeoutMs: 5000
  });
  assert.equal(pending.id, "task-pending");
  assert.equal(pending.state, "running");
  assert.equal(pending.isFinal, false);

  const failed = await fetchTokengoMediaVideoTask({
    baseUrl,
    apiKey: "sk_test_tokengo",
    taskId: "task-failed",
    fetchWithTimeout,
    timeoutMs: 5000
  });
  assert.equal(failed.state, "failed");
  assert.match(failed.error ?? "", /安全/);

  const nonFinalFailed = await fetchTokengoMediaVideoTask({
    baseUrl,
    apiKey: "sk_test_tokengo",
    taskId: "task-nonfinal-failed",
    fetchWithTimeout,
    timeoutMs: 5000
  });
  assert.equal(nonFinalFailed.isFinal, false);
  assert.equal(nonFinalFailed.state, "failed");

  assert.equal(tokengoMediaResultUrlFromBody({ result: { images: [{ url: "https://cdn.example/result.png" }] } }), "https://cdn.example/result.png");

  await assert.rejects(
    createTokengoMediaVideoTask({
      baseUrl,
      apiKey: "sk_test_tokengo",
      model: "veo-3.1",
      prompt: "trigger-402",
      imageUrls: [],
      videoParams: { aspect_ratio: "16:9", duration: "8" },
      fetchWithTimeout,
      timeoutMs: 5000
    }),
    /ai_provider_tokengo_insufficient_funds_402/
  );

  await assert.rejects(
    createTokengoMediaVideoTask({
      baseUrl,
      apiKey: "sk_test_tokengo",
      model: "veo-3.1",
      prompt: "trigger-403",
      imageUrls: [],
      videoParams: { aspect_ratio: "16:9", duration: "8" },
      fetchWithTimeout,
      timeoutMs: 5000
    }),
    /ai_provider_tokengo_insufficient_funds_403/
  );

  assert.equal(requests.filter((item) => item.method === "POST").length, 4);
  console.log("tokengo_media_video_smoke_ok");
} finally {
  await new Promise((resolve) => server.close(resolve));
}
