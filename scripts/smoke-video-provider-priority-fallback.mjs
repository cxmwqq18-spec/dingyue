import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const jiti = require("jiti")(path.join(__dirname, "smoke-video-provider-priority-fallback.mjs"), {
  alias: { "@": path.join(root, "src") },
  interopDefault: true
});

const paths = {
  fallback: path.join(root, "src/lib/video-provider-fallback.ts"),
  dispatch: path.join(root, "src/app/api/internal/ai-worker/dispatch/route.ts"),
  worker: path.join(root, "src/lib/worker.ts"),
  platformStore: path.join(root, "src/lib/stores/platform-store.ts"),
  serverStore: path.join(root, "src/lib/server-store.ts"),
  providerRoute: path.join(root, "src/app/api/platform/ai-providers/route.ts"),
  providerPanel: path.join(root, "src/components/platform/platform-ai-provider-panel.tsx")
};

const source = Object.fromEntries(Object.entries(paths).map(([key, filePath]) => [
  key,
  fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : ""
]));
const orderedVideoProvidersFunction = source.dispatch.match(/function orderedVideoProviders[\s\S]*?\n}\n\nfunction orderedVideoSceneImageProviders/)?.[0] ?? "";

const checks = [];

function check(label, pass) {
  checks.push({ label, pass: Boolean(pass) });
}

check(
  "video worker advertises priority-first fallback strategy",
  source.worker.includes('strategy: "priority_then_preferred"')
);
check(
  "dispatch orders platform video fallback by priority before preferred badge",
  orderedVideoProvidersFunction.includes("orderSelectableAiProviderFallbackCandidates(videoProviders, payload.providerSelection)") &&
    !orderedVideoProvidersFunction.includes("const preferredProviders = Array.from(new Map")
);
check(
  "explicit Grok dispatch keeps the TokenGo single-reference adapter ordering",
  orderedVideoProvidersFunction.includes("isTokengoGrokImagine15VideoProvider") &&
    orderedVideoProvidersFunction.includes("const referenceAssetCount = videoFrameAssets(payload).length") &&
    orderedVideoProvidersFunction.includes("const hasAtMostOneReference = referenceAssetCount <= 1") &&
    orderedVideoProvidersFunction.includes("? [...tokengoSingleReferenceProviders, ...otherVideoProviders]") &&
    orderedVideoProvidersFunction.includes(": [...otherVideoProviders, ...tokengoSingleReferenceProviders]") &&
    !orderedVideoProvidersFunction.toLowerCase().includes("seedance")
);
check(
  "automatic video dispatch preserves priority order while explicit Grok keeps adapter ordering",
  orderedVideoProvidersFunction.includes("requestedVideoModelPreference(payload)") &&
    orderedVideoProvidersFunction.includes("videoProviderMatchesModelPreference(provider, selectedModelPreference)") &&
    orderedVideoProvidersFunction.includes("videoProviderSupportsCurrentRequest(provider, referenceAssetCount)") &&
    orderedVideoProvidersFunction.includes('if (selectedModelPreference === "auto") return ordered;')
);
check(
  "platform provider model picker includes Seedance special without dispatch priority special-casing",
  source.providerRoute.includes('"seedance-2-0-special"') &&
    !orderedVideoProvidersFunction.toLowerCase().includes("seedance")
);
check(
  "worker uses paid-safe provider fallback gate after a failed create attempt",
  source.dispatch.includes("shouldTryNextPaidVideoProvider(error, lastProviderTiming)") &&
    source.fallback.includes("providerTaskCreatedAt") &&
    source.fallback.includes("LOCAL_AI_WORKER_ALLOW_PAID_VIDEO_PROVIDER_FALLBACK")
);
check(
  "platform provider queues are priority-first and exclude non-runnable providers",
  source.platformStore.includes('{ priority: "asc" }') &&
    source.platformStore.includes('{ preferred: "desc" }') &&
    source.platformStore.includes("aiProviderStatus(provider).runnable")
);
check(
  "legacy JSON provider queues are priority-first",
  source.serverStore.includes("comparePlatformAiProviderPriority")
);
check(
  "platform provider PUT API accepts priority",
  source.providerRoute.includes("priority?: unknown") &&
    source.providerRoute.includes("invalid_ai_provider_priority") &&
    source.providerRoute.includes("Number.isInteger(priority)") &&
    source.providerRoute.includes("priority: body.priority")
);
check(
  "platform provider UI lets admins edit priority",
  source.providerPanel.includes("priority: number") &&
    source.providerPanel.includes('label="调用优先级"') &&
    source.providerPanel.includes("normalizeProviderPriority(event.target.value)") &&
    source.providerPanel.includes("status.providers.filter((provider) => provider.providerType === providerType)")
);

if (source.fallback) {
  const fallback = jiti(paths.fallback);
  const providers = [
    { id: "p9", label: "P9 provider", priority: 9, preferred: true },
    { id: "p0", label: "P0 provider", priority: 0, preferred: false },
    { id: "p3", label: "P3 provider", priority: 3, preferred: false }
  ];
  const ordered = fallback.orderAiProviderFallbackCandidates(providers).map((provider) => provider.id);
  check("helper sorts P0 before P3 before preferred P9", ordered.join(",") === "p0,p3,p9");

  const fallbackEnv = { LOCAL_AI_WORKER_ALLOW_PAID_VIDEO_PROVIDER_FALLBACK: "1" };
  check(
    "helper falls back after confirmed upstream create rejection",
    fallback.shouldTryNextPaidVideoProvider(
      new Error('ai_provider_video_create_failed_400_{"code":"upstream_error","message":"服务暂时不可用"}'),
      {},
      fallbackEnv
    )
  );
  check(
    "helper does not fall back after provider task creation",
    !fallback.shouldTryNextPaidVideoProvider(
      new Error('ai_provider_video_create_failed_500_{"message":"poll failed"}'),
      { providerTaskCreatedAt: new Date(0).toISOString() },
      fallbackEnv
    )
  );
}

const failed = checks.filter((item) => !item.pass);
if (failed.length) {
  for (const item of failed) console.error(`FAIL ${item.label}`);
  process.exit(1);
}

for (const item of checks) console.log(`PASS ${item.label}`);
