// Offline UI smoke: render the real provider editor with inert primitives and synthetic data.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

const root = process.cwd();
const require = createRequire(import.meta.url);
const sourcePath = "src/components/platform/platform-ai-provider-panel.tsx";
const source = fs.readFileSync(path.join(root, sourcePath), "utf8");
const compiled = ts.transpileModule(`${source}\nexport { ProviderEditor, emptyProviderForm };`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  fileName: sourcePath
}).outputText;
const React = require("react");
const primitive = ({ children, label, value, hint, checked, onChange }) => React.createElement("div", null,
  label, value, hint, children,
  checked === undefined ? null : React.createElement("input", { type: "checkbox", checked, onChange: () => onChange?.(!checked) })
);
const field = ({ children, label, hint }) => React.createElement("label", null, React.createElement("span", null, label), hint, children);
const editorPrimitives = Object.fromEntries(["ErpCheckboxRow", "ErpField", "ErpFormGrid", "ErpInput", "ErpSection", "ErpSelect", "ErpStatGrid", "ErpToolbar", "ErpToolbarField"].map((key) => [
  key,
  key === "ErpInput" ? (props) => React.createElement("input", props) :
    key === "ErpSelect" ? ({ children, ...props }) => React.createElement("select", props, children) :
      key === "ErpField" ? field : primitive
]));
const exports = {};
vm.runInNewContext(compiled, {
  module: { exports }, exports, process: { env: {} }, URL, Date, console,
  require: (name) => {
    if (["react", "react/jsx-runtime", "lucide-react"].includes(name)) return require(name);
    if (name === "next/navigation") return { useRouter: () => ({ push() { throw new Error("Unexpected navigation") } }) };
    if (name === "@/lib/client-csrf") return { platformJsonHeaders() { throw new Error("Unexpected request") } };
    if (name === "@/components/admin/design-workbench") return Object.fromEntries(["WorkbenchActionButton", "WorkbenchTableHeader", "WorkbenchTableRow", "WorkbenchTableShell"].map((key) => [key, primitive]));
    if (name === "@/components/admin/erp-primitives") return editorPrimitives;
    if (name === "@/components/ui") return { StatusPill: primitive };
    if (name === "@/lib/ai-provider-type") return { platformAiProviderTypes: ["image", "video", "text", "audio"], platformAiProviderTypeLabel: (type) => type };
    if (name === "@/lib/tokengo-image") return {
      IMAGE_PROVIDER_ASPECT_RATIOS: ["auto", "1:1", "16:9"], IMAGE_PROVIDER_OUTPUT_FORMATS: ["png", "jpeg"],
      IMAGE_PROVIDER_QUALITIES: ["auto", "low", "medium", "high"], IMAGE_PROVIDER_RESOLUTIONS: ["1K", "2K"]
    };
    if (name === "@/lib/video-provider-family") return {};
    throw new Error(`Unexpected dependency: ${name}`);
  }
}, { filename: sourcePath });

const { ProviderEditor, emptyProviderForm } = exports;
const renderEditor = (providerType) => require("react-dom/server").renderToStaticMarkup(
  React.createElement(ProviderEditor, {
    mode: "create", form: emptyProviderForm(providerType), setForm() {}, modelTypes: ["fixture-model"],
    saving: false, testing: false, keyVisible: false, revealingKey: false, message: "",
    onClose() {}, onSave() {}, onTest() {}, onReveal() {}
  })
);

const formValidator = source.match(/function validateForm\(form: ProviderFormState, action: "save" \| "test"\) \{([\s\S]*?)\n  \}/)?.[1] ?? "";
assert.match(formValidator, /!form\.label\.trim\(\)/, "Provider label must be required locally");
assert.match(formValidator, /!form\.modelType\.trim\(\)/, "Model ID must be required locally");
assert.match(formValidator, /new URL\(form\.aiUrl\.trim\(\)\)/, "Base URL must be validated locally");
assert.match(formValidator, /action === "save" && !form\.apiKey\.trim\(\) && !form\.id/, "Create must require an API key before save");
assert.match(formValidator, /action === "test" && !form\.apiKey\.trim\(\) && !form\.id/, "Connection test must require an API key before request");

const imageHtml = renderEditor("image");
assert.match(imageHtml, /图片能力/);
assert.match(imageHtml, /platform-ai-provider-models/);
assert.match(imageHtml, /placeholder="https:\/\/api\.example\.com\/v1"/);
assert.match(imageHtml, /API Key/);
assert.doesNotMatch(imageHtml, /视频模型能力|音频供应商配置|文本模型能力/);
const videoHtml = renderEditor("video");
assert.match(videoHtml, /视频模型能力/);
assert.match(videoHtml, /value="huitu-openapi"/);
assert.match(videoHtml, /支持时长/);
assert.match(videoHtml, /支持画幅/);
const textHtml = renderEditor("text");
assert.match(textHtml, /文本模型能力/);
assert.doesNotMatch(textHtml, /视频模型能力|图片能力|音频供应商配置/);
const audioHtml = renderEditor("audio");
assert.match(audioHtml, /音频供应商配置/);
assert.match(audioHtml, /音频任务适配器尚未接入/);
assert.doesNotMatch(audioHtml, /视频模型能力|图片能力|文本模型能力/);

const gatewayPath = "src/components/platform/gateway-editor.tsx";
const gatewaySource = fs.readFileSync(path.join(root, gatewayPath), "utf8");
const gatewayCompiled = ts.transpileModule(gatewaySource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  fileName: gatewayPath
}).outputText;
const gatewayExports = {};
vm.runInNewContext(gatewayCompiled, {
  module: { exports: gatewayExports }, exports: gatewayExports, process: { env: {} }, URL, Date, console,
  require: (name) => {
    if (["react", "react/jsx-runtime"].includes(name)) return require(name);
    if (name === "@/lib/client-csrf") return { platformJsonHeaders() { throw new Error("Unexpected request") } };
    throw new Error(`Unexpected dependency: ${name}`);
  }
}, { filename: gatewayPath });
const gatewayHtml = require("react-dom/server").renderToStaticMarkup(React.createElement(gatewayExports.GatewayEditor, {
  siteId: "smoke-site",
  group: { id: "smoke-group", name: "Smoke group", status: "active", accountPoolMode: "shared", monthlyQuota: 100,
    rateLimitPerMinute: 20, modelAllowlist: ["allowlisted-model"], retryStatusCodes: [429, 500] },
  providers: [
    { id: "enabled-provider", label: "Enabled provider", aiUrl: "https://provider.example.invalid/v1", modelType: "enabled-model", preferred: true, enabled: true },
    { id: "disabled-provider", label: "Disabled provider", aiUrl: "https://disabled.example.invalid/v1", modelType: "disabled-model", preferred: false, enabled: false }
  ]
}));
assert.match(gatewayHtml, /enabled-model/);
assert.match(gatewayHtml, /allowlisted-model/);
assert.match(gatewayHtml, /gpt-image-2/);
assert.doesNotMatch(gatewayHtml, /disabled-model/);
assert.doesNotMatch(gatewayHtml, /API Key|apiKey|secret/i);

console.log("PASS: provider form required-field contract, provider-type editors, gateway model selector/read projection; no requests, DB, keys or network used");
