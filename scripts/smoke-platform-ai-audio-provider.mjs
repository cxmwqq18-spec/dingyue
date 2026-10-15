// Offline contract smoke: executes production API/store declarations against memory only.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

const root = process.cwd();
const require = createRequire(import.meta.url);
const modules = new Map();
const noNetwork = () => { throw new Error("Network/provider requests are forbidden in this smoke"); };
function evaluate(file, source, overrides = {}) {
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX
  }, fileName: file }).outputText;
  const evaluated = { exports: {} };
  vm.runInNewContext(compiled, {
    module: evaluated, exports: evaluated.exports, process: { env: {} }, URL, Date, console,
    fetch: noNetwork,
    require: (name) => {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (modules.has(name)) return modules.get(name);
      if (["react", "react/jsx-runtime", "lucide-react"].includes(name)) return require(name);
      throw new Error(`Unexpected dependency: ${name} in ${file}`);
    }
  }, { filename: file });
  return evaluated.exports;
}
function load(name, overrides = {}) {
  const file = path.join(root, name.replace("@/", "src/") + ".ts");
  const result = evaluate(file, fs.readFileSync(file, "utf8"), overrides);
  modules.set(name, result);
  return result;
}
// Select actual declarations through the TS AST, avoiding unrelated store/DB imports.
function declarations(file, names) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const selected = ast.statements.filter((node) => names.includes(node.name?.text) ||
    (ts.isVariableStatement(node) && node.declarationList.declarations.some((entry) => names.includes(entry.name.getText(ast)))));
  assert.equal(selected.length, names.length, `Missing declaration in ${file}`);
  return selected.map((node) => node.getText(ast)).join("\n");
}
load("@/lib/video-frame-config");
load("@/lib/video-provider-limits");
const providerTypes = load("@/lib/ai-provider-type");
load("@/lib/tokengo-image");
const family = load("@/lib/video-provider-family");
const config = load("@/lib/ai-provider-config", {
  "server-only": {}, "@/lib/fetch-timeout": { FetchTimeoutError: Error, fetchWithTimeout: noNetwork }
});
const mapper = evaluate("prisma-mappers.ts", `
const { normalizePlatformAiProviderType, inferPlatformAiProviderType } = require("@/lib/ai-provider-type");
const { normalizeAiProviderProtocol } = require("@/lib/video-provider-family");
const { normalizeImageProviderAspectRatio, normalizeImageProviderResolution, normalizeImageProviderQuality, normalizeImageProviderOutputFormat } = require("@/lib/tokengo-image");
${declarations("src/lib/stores/prisma-mappers.ts", ["toIsoString", "toPlatformAiProvider"])}
`);
const records = [];
function matches(record, where = {}) {
  return Object.entries(where).every(([key, value]) => value && typeof value === "object"
    ? record[key] !== value.not : record[key] === value);
}
function ordered(where, orderBy = []) {
  return records.filter((record) => matches(record, where)).sort((a, b) => {
    for (const order of orderBy) {
      const [key, direction] = Object.entries(order)[0];
      const comparison = a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0;
      if (comparison) return direction === "desc" ? -comparison : comparison;
    }
    return 0;
  });
}
const table = {
  findMany: async ({ where, orderBy } = {}) => ordered(where, orderBy),
  findUnique: async ({ where }) => records.find((record) => matches(record, where)) ?? null,
  findUniqueOrThrow: async ({ where }) => { const result = await table.findUnique({ where }); assert.ok(result); return result; },
  findFirst: async ({ where, orderBy } = {}) => ordered(where, orderBy)[0] ?? null,
  count: async ({ where } = {}) => ordered(where).length,
  create: async ({ data }) => { const record = { ...data, createdAt: new Date(), updatedAt: new Date() }; records.push(record); return record; },
  update: async ({ where, data }) => { const record = await table.findUniqueOrThrow({ where }); Object.assign(record, data); return record; },
  updateMany: async ({ where, data }) => { const matching = ordered(where); matching.forEach((record) => Object.assign(record, data)); return { count: matching.length }; }
};
const prisma = { platformAiProvider: table, $transaction: async (callback) => callback(prisma) };
let counter = 0;
const storeNames = ["normalizeProviderMaxImagesPerRequest", "normalizeProviderVideoDurations", "normalizeProviderVideoAspectRatios", "platformAiProviderOrderBy", "platformAiProviderTransactionOptions", "platformAiProviderTypeWhere", "setPreferredPlatformAiProviderForType", "repairPreferredPlatformAiProviderForType", "listPlatformAiProvidersRelational", "getPlatformAiProviderRelational", "normalizeProviderPriority", "nextPlatformAiProviderPriorityForType", "upsertPlatformAiProviderRelational"];
const store = evaluate("platform-store.ts", `
const { prisma, uid, runPrismaReadWithReconnect, clearPlatformReadCache, RelationalStoreError } = require("memory");
const { toPlatformAiProvider } = require("mapper");
const { normalizePlatformAiProviderType, inferPlatformAiProviderType } = require("@/lib/ai-provider-type");
const { normalizeAiProviderProtocol } = require("@/lib/video-provider-family");
const { normalizeImageProviderAspectRatio, normalizeImageProviderResolution, normalizeImageProviderQuality, normalizeImageProviderOutputFormat } = require("@/lib/tokengo-image");
${declarations("src/lib/stores/platform-store.ts", storeNames)}
`, { memory: { prisma, uid: () => `mock_${++counter}`, runPrismaReadWithReconnect: (callback) => callback(), clearPlatformReadCache() {}, RelationalStoreError: Error }, mapper });
let authenticated = true;
let authorized = true;
const routePath = "src/app/api/platform/ai-providers/route.ts";
const route = evaluate(routePath, fs.readFileSync(path.join(root, routePath), "utf8"), {
  "next/server": { NextResponse: { json: (data, options = {}) => ({ status: options.status ?? 200, json: async () => data }) } },
  "@/lib/api-auth": {
    getCurrentPlatformAdmin: async () => authenticated ? { platformAdmin: { id: "mock_admin" } } : null,
    requirePlatformMutation: async () => authorized ? { ok: true, current: { platformAdmin: { id: "mock_admin" } } } : { ok: false, response: { status: 403 } }
  },
  "@/lib/async-jobs": { createAsyncJob: noNetwork, toAsyncJobAcceptedPayload: noNetwork },
  "@/lib/security/rate-limit": { RATE_LIMITS: { adminProviderConfig: {} } },
  "@/lib/server-store": { StoreError: Error },
  "@/lib/stores/platform-store": store
});
async function put(body, expectedStatus = 200) {
  const response = await route.PUT({ json: async () => body });
  assert.equal(response.status, expectedStatus);
  return response.json();
}
const key = "mock-only-audio-secret-12345678";
const common = { aiUrl: "https://provider.invalid/v1", apiKey: key, apiProtocol: "auto", enabled: true, makeCurrent: true };
for (const providerType of ["image", "video", "text"]) {
  await put({ ...common, label: `Existing ${providerType}`, providerType,
    modelType: providerType === "video" ? "grok-imagine-video" : providerType === "image" ? "gpt-image-2" : "gpt-5.5" });
}
for (const existing of [...records]) {
  const result = await put({ id: existing.id, label: existing.label, modelType: existing.modelType, providerType: existing.providerType, priority: 2, apiKey: "" });
  assert.equal(result.providers.find((provider) => provider.id === existing.id).providerType, existing.providerType);
  assert.equal(records.find((provider) => provider.id === existing.id).apiKey, key);
}
const previous = JSON.parse(JSON.stringify(records));
const created = await put({ ...common, label: "Standalone audio", modelType: "vendor-audio-model", providerType: "audio" });
const audio = created.providers.find((provider) => provider.providerType === "audio");
assert.ok(audio?.id);
assert.equal(audio.status.protocol, "openai-compatible");
assert.equal(created.currentProviderIds.audio, audio.id);
assert.equal(created.summary.byType.audio.totalProviders, 1);
assert.equal(created.summary.byType.audio.configuredProviders, 1);
assert.equal(JSON.stringify(created).includes(key), false);
assert.equal(Object.hasOwn(audio, "apiKey"), false);
assert.deepEqual(JSON.parse(JSON.stringify(records.slice(0, 3))), previous, "Audio create must preserve existing records");
const updated = await put({ id: audio.id, label: "Updated audio", modelType: "vendor-audio-v2", apiKey: "", apiProtocol: "openai-compatible", priority: 4 });
assert.equal(updated.providers.find((provider) => provider.id === audio.id).providerType, "audio", "Omitted type must preserve audio on update");
assert.equal(records.find((provider) => provider.id === audio.id).apiKey, key, "Blank key must retain existing key");
const explicitUpdate = await put({ id: audio.id, label: "Updated audio", modelType: "vendor-audio-v2", providerType: "audio", apiProtocol: "openai-compatible", priority: 4 });
assert.equal(explicitUpdate.providers.find((provider) => provider.id === audio.id).priority, 4);
assert.equal(updated.currentProviderIds.image, created.currentProviderIds.image);
assert.equal(updated.currentProviderIds.video, created.currentProviderIds.video);
assert.equal(updated.currentProviderIds.text, created.currentProviderIds.text);
const listed = await (await route.GET()).json();
assert.equal(listed.providers.find((provider) => provider.id === audio.id).modelType, "vendor-audio-v2");
assert.equal((await store.listPlatformAiProvidersRelational({ providerType: "audio" })).length, 1);
assert.equal(JSON.stringify(listed).includes(key), false);
for (const apiProtocol of ["openai-videos", "lk888-media", "huitu-openapi", "tokengo-media", "tokengo-image"]) {
  const rejected = await put({ ...common, label: "Invalid audio", modelType: "audio-model", providerType: "audio", apiProtocol }, 400);
  assert.equal(rejected.error, "invalid_ai_provider_protocol_for_type");
}
assert.deepEqual(JSON.parse(JSON.stringify(records.slice(0, 3))), previous, "Audio updates must preserve existing records");
authenticated = false;
assert.equal((await route.GET()).status, 401);
authorized = false;
assert.equal((await route.PUT({ json: noNetwork })).status, 403);
for (const providerType of ["image", "video", "text", "audio"]) assert.equal(providerTypes.normalizePlatformAiProviderType(providerType), providerType);
assert.equal(providerTypes.normalizePlatformAiProviderType("unknown"), "image");
assert.equal(providerTypes.inferPlatformAiProviderType({ modelType: "gpt-image-2" }), "image");
assert.equal(providerTypes.inferPlatformAiProviderType({ modelType: "grok-imagine-video" }), "video");
for (const [aiUrl, protocol] of [["https://yinglingapi.com", "openai-videos"], ["https://api.smartpicklid.com", "openai-videos"], ["https://api.lk888.ai", "lk888-media"], ["https://sd2.huitu.xyz", "huitu-openapi"], ["https://buming.token6688.com", "tokengo-media"]]) {
  assert.equal(config.aiProviderProtocol({ providerType: "video", aiUrl, modelType: "grok-imagine-video" }), protocol);
  assert.equal(family.videoProviderProtocolForBaseUrl(aiUrl), protocol);
  assert.equal(config.aiProviderProtocol({ providerType: "audio", aiUrl, modelType: "audio-model" }), "openai-compatible");
}
assert.equal(config.aiProviderProtocol({ providerType: "image", aiUrl: "https://buming001.token6688.com", modelType: "gpt-image-2" }), "tokengo-image");
assert.equal(config.aiProviderProtocol({ providerType: "text", aiUrl: common.aiUrl, modelType: "gpt-5.5" }), "openai-compatible");
assert.equal(config.aiProviderProtocol({ providerType: "video", aiUrl: common.aiUrl, apiProtocol: "openai-videos" }), "openai-videos");

// Render the actual panel/editor with inert chrome; no browser/server/credential access.
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const primitive = ({ children, label, value, hint }) => React.createElement("div", null, label, value, hint, children);
const panelPath = "src/components/platform/platform-ai-provider-panel.tsx";
const panel = evaluate(panelPath, fs.readFileSync(path.join(root, panelPath), "utf8") + "\nexport { ProviderEditor, emptyProviderForm, providerForm };", {
  "next/navigation": { useRouter: () => ({ push: noNetwork }) },
  "@/lib/client-csrf": { platformJsonHeaders: noNetwork },
  "@/components/admin/design-workbench": Object.fromEntries(["WorkbenchActionButton", "WorkbenchTableHeader", "WorkbenchTableRow", "WorkbenchTableShell"].map((name) => [name, primitive])),
  "@/components/admin/erp-primitives": Object.fromEntries(["ErpCheckboxRow", "ErpField", "ErpFormGrid", "ErpInput", "ErpSection", "ErpSelect", "ErpStatGrid", "ErpToolbar", "ErpToolbarField"].map((name) => [name, name === "ErpSelect" ? ({ children, value }) => React.createElement("select", { value, onChange() {} }, children) : primitive])),
  "@/components/ui": { StatusPill: primitive }
});
const form = panel.providerForm(audio);
assert.equal(form.providerType, "audio");
assert.equal(form.apiKey, "");
assert.equal(panel.emptyProviderForm("audio").supportsEditN, false);
const editorHtml = renderToStaticMarkup(React.createElement(panel.ProviderEditor, { mode: "create", form: panel.emptyProviderForm("audio"), setForm() {}, modelTypes: [], onClose() {}, onSave() {}, onTest() {}, onReveal() {} }));
assert.match(editorHtml, /value="audio" selected=""/);
assert.match(editorHtml, /音频任务适配器尚未接入/);
assert.doesNotMatch(editorHtml, /视频模型能力|图片能力|文本模型能力|加入生成队列/);
assert.match(editorHtml, /value="openai-compatible"/);
assert.doesNotMatch(editorHtml, /value="openai-videos"|value="lk888-media"|value="tokengo-image"/);
const panelHtml = renderToStaticMarkup(React.createElement(panel.PlatformAiProviderPanel, { initialStatus: listed }));
assert.match(panelHtml, /新增AI 音频/);
assert.match(panelHtml, /独立音频供应商 · 仅配置/);
assert.equal(panelHtml.includes(key), false);
const schema = fs.readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
assert.match(schema, /providerType\s+String\s+@default\("image"\)/, "Existing string storage accepts audio without a migration");
console.log("PASS: offline audio API/store create/list/update, UI rendering, key masking, auth, type isolation, legacy protocols and Yingling regressions");
