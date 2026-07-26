import assert from "node:assert/strict";
import http from "node:http";

const {
  createHuituOpenApiVideoTask,
  downloadHuituOpenApiVideoTaskFile,
  fetchHuituOpenApiVideoTask,
  huituClientRequestId,
  huituOpenApiVideoDuration,
  huituOpenApiVideoRatio
} = await import("../src/lib/huitu-openapi-video.ts");
const {
  normalizeVideoProviderFailure,
  videoProviderFailureCustomerMessage
} = await import("../src/lib/video-provider-policy.ts");

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
  if (request.method === "POST" && url.pathname === "/openapi/v1/videos") {
    const body = await readRequestBody(request);
    requests.push({ body, headers: request.headers, method: request.method, path: url.pathname });
    assert.equal(request.headers.authorization, "Bearer dk_test");
    assert.match(String(request.headers["content-type"] ?? ""), /^multipart\/form-data; boundary=/);
    if (body.includes("trigger-402")) {
      json(response, 402, { detail: "积分不足" });
      return;
    }
    json(response, 202, {
      id: "task-created",
      status: "queued",
      progress: 0,
      error: null,
      videoUrl: null,
      duration: 15,
      aspectRatio: "16:9",
      creditCost: 15
    });
    return;
  }
  if (request.method === "GET" && url.pathname === "/openapi/v1/videos/task-success") {
    requests.push({ headers: request.headers, method: request.method, path: url.pathname });
    json(response, 200, {
      id: "task-success",
      status: "success",
      progress: 100,
      error: null,
      videoUrl: "/media/videos/task-success.mp4",
      duration: 15,
      aspectRatio: "16:9",
      creditCost: 15
    });
    return;
  }
  if (request.method === "GET" && url.pathname === "/openapi/v1/videos/task-failed") {
    json(response, 200, {
      id: "task-failed",
      status: "failed",
      progress: 0,
      error: "参考图包含真实人物，平台不支持",
      videoUrl: null,
      duration: 10,
      aspectRatio: "9:16",
      creditCost: 10
    });
    return;
  }
  if (request.method === "GET" && url.pathname === "/media/videos/task-success.mp4") {
    requests.push({ headers: request.headers, method: request.method, path: url.pathname });
    response.writeHead(200, { "Content-Type": "video/mp4" });
    response.end(Buffer.from("mock-mp4"));
    return;
  }
  if (request.method === "GET" && url.pathname === "/openapi/v1/videos/task-success/file") {
    response.writeHead(200, { "Content-Type": "video/mp4" });
    response.end(Buffer.from("mock-file-mp4"));
    return;
  }
  json(response, 404, { detail: "not found" });
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert(address && typeof address === "object");
const baseUrl = `http://127.0.0.1:${address.port}`;
const fetchWithTimeout = (resource, init) => fetch(resource, init);

try {
  assert.equal(huituOpenApiVideoDuration("15"), "15");
  assert.equal(huituOpenApiVideoDuration("6"), "6");
  assert.equal(huituOpenApiVideoDuration("10"), "10");
  assert.equal(huituOpenApiVideoDuration("invalid"), "6");
  assert.equal(huituOpenApiVideoRatio("16:9"), "16:9");
  assert.equal(huituOpenApiVideoRatio("2:3"), "9:16");
  assert.equal(huituClientRequestId("x".repeat(80)).length, 64);

  await assert.rejects(
    createHuituOpenApiVideoTask({
      baseUrl,
      apiKey: "dk_test",
      prompt: "missing image",
      imageUrls: [],
      duration: "10",
      ratio: "16:9",
      clientRequestId: "job_missing",
      fetchWithTimeout,
      timeoutMs: 5000
    }),
    /ai_provider_video_reference_required_huitu/
  );

  const created = await createHuituOpenApiVideoTask({
    baseUrl,
    apiKey: "dk_test",
    prompt: "a subject walking",
    imageUrls: ["https://cdn.example/a.png", "https://cdn.example/b.png"],
    duration: "15",
    ratio: "16:9",
    clientRequestId: "job_123_request_456",
    fetchWithTimeout,
    timeoutMs: 5000
  });
  assert.equal(created.id, "task-created");
  const createBody = requests.find((item) => item.method === "POST")?.body ?? "";
  assert.match(createBody, /name="prompt"/);
  assert.match(createBody, /name="duration"/);
  assert.match(createBody, /name="ratio"/);
  assert.match(createBody, /name="client_request_id"/);
  assert.equal((createBody.match(/name="image_urls"/g) ?? []).length, 2);
  assert.equal((createBody.match(/name="model"/g) ?? []).length, 0);
  assert.equal((createBody.match(/name="resolution"/g) ?? []).length, 0);

  const succeeded = await fetchHuituOpenApiVideoTask({
    baseUrl,
    apiKey: "dk_test",
    taskId: "task-success",
    fetchWithTimeout,
    timeoutMs: 5000
  });
  assert.equal(succeeded.status, "success");
  assert.equal(succeeded.creditCost, 15);

  const failed = await fetchHuituOpenApiVideoTask({
    baseUrl,
    apiKey: "dk_test",
    taskId: "task-failed",
    fetchWithTimeout,
    timeoutMs: 5000
  });
  assert.equal(failed.status, "failed");
  assert.match(failed.error ?? "", /参考图/);
  const failure = normalizeVideoProviderFailure({
    error: failed.error,
    providerFamily: "gemini",
    providerProtocol: "huitu-openapi"
  });
  assert.equal(failure?.code, "real_person_reference_unsupported");
  assert.match(videoProviderFailureCustomerMessage(failure), /real or recognizable people/);

  const downloaded = await downloadHuituOpenApiVideoTaskFile({
    baseUrl,
    apiKey: "dk_test",
    taskId: "task-success",
    resultUrl: succeeded.videoUrl ?? undefined,
    fetchWithTimeout,
    timeoutMs: 5000
  });
  assert.equal(downloaded.status, 200);
  assert.equal(await downloaded.text(), "mock-mp4");

  await assert.rejects(
    createHuituOpenApiVideoTask({
      baseUrl,
      apiKey: "dk_test",
      prompt: "trigger-402",
      imageUrls: ["https://cdn.example/a.png"],
      duration: "10",
      ratio: "9:16",
      clientRequestId: "job_402",
      fetchWithTimeout,
      timeoutMs: 5000
    }),
    /ai_provider_huitu_insufficient_credits_402/
  );

  console.log("huitu_openapi_video_smoke_ok");
} finally {
  await new Promise((resolve) => server.close(resolve));
}
