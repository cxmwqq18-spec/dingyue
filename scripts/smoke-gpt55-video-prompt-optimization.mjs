#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import createJiti from "jiti";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";

delete process.env.AI_TEXT_PROVIDER_MOCK;
delete process.env.SMOKE_PROVIDER_MOCK;
process.env.NODE_ENV = "test";

const originalLoad = Module._load;
Module._load = function load(request, ...args) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...args);
};
const sourceRoot = path.join(process.cwd(), "src");
const jiti = createJiti(import.meta.url, {
  alias: {
    "@": sourceRoot,
    "server-only": path.join(sourceRoot, "lib/storefront-context/types.ts"),
  },
});
const { callPlatformTextProvider, platformTextChatCompletionsUrl } = jiti("../src/lib/platform-text-provider.ts");
const optimizerSource = fs.readFileSync(path.join(sourceRoot, "lib/video-prompt-optimizer.ts"), "utf8");
assert.match(optimizerSource, /generatePlatformText/);
assert.equal(platformTextChatCompletionsUrl("https://api.example.com/v1/models"), "https://api.example.com/v1/chat/completions");

const prisma = new PrismaClient();
const requests = [];
const fetcher = async (url, init) => {
  requests.push({ url: String(url), init });
  return new Response(JSON.stringify({
    choices: [{ message: { content: "mocked optimized prompt" } }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });
};

try {
  const provider = await prisma.platformAiProvider.findFirst({
    where: { providerType: "text", enabled: true, apiKey: { not: null } },
    orderBy: [{ priority: "asc" }, { preferred: "desc" }],
  });
  assert.ok(provider, "an enabled text provider must be configured");
  assert.equal(provider.modelType, "gpt-5.5");

  const text = await callPlatformTextProvider({
    provider,
    messages: [{ role: "user", content: "Optimize this video prompt." }],
    temperature: 0.2,
    idempotencyKey: "smoke-gpt55-video-prompt-optimization",
    fetcher,
  });

  assert.equal(text, "mocked optimized prompt");
  assert.equal(requests.length, 1, "a valid response must use exactly one mocked provider call");
  const request = requests[0];
  assert.match(request.url, /\/v1\/chat\/completions$/);
  const body = JSON.parse(String(request.init?.body));
  assert.equal(body.model, "gpt-5.5");
  assert.equal(new Headers(request.init?.headers).get("Idempotency-Key")?.length > 0, true);
  assert.equal(new Headers(request.init?.headers).has("Authorization"), true);

  console.log(JSON.stringify({
    ok: true,
    selectedModel: body.model,
    endpointPath: new URL(request.url).pathname,
    mockedProviderCalls: requests.length,
    paidProviderCalls: 0,
  }, null, 2));
} finally {
  await prisma.$disconnect();
  Module._load = originalLoad;
}
