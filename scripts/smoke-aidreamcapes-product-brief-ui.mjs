import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import Module from "node:module";
import ts from "typescript";

const root = process.cwd();
const componentPath = path.join(root, "src/components/aidreamcapes-workspace/product-url-import.tsx");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "aidreamcapes-product-brief-ui-"));
const originalLoad = Module._load;
let activeMount;
const reactStub = {
  useState(initial) {
    const mount = activeMount;
    const index = mount.cursor++;
    if (!Object.hasOwn(mount.state, index)) mount.state[index] = initial;
    return [mount.state[index], value => {
      mount.state[index] = typeof value === "function" ? value(mount.state[index]) : value;
    }];
  }
};
const jsxStub = {
  jsx: (type, props, key) => ({ type, props: props ?? {}, key }),
  jsxs: (type, props, key) => ({ type, props: props ?? {}, key }),
  Fragment: Symbol.for("react.fragment")
};
Module._load = function (request, parent, isMain) {
  if (request === "react") return reactStub;
  if (request === "react/jsx-runtime") return jsxStub;
  if (request === "next/image") return "img";
  if (request === "@/lib/client-csrf") return { customerJsonHeaders: () => ({ "content-type": "application/json", "x-csrf-token": "cookie-token" }) };
  if (request.endsWith("product-url-import.module.css")) return new Proxy({}, { get: (_target, key) => String(key) });
  return originalLoad.call(this, request, parent, isMain);
};

try {
  const result = ts.transpileModule(fs.readFileSync(componentPath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
  });
  fs.writeFileSync(path.join(temp, "product-url-import.js"), result.outputText);
  const require = createRequire(path.join(temp, "entry.cjs"));
  const { ProductUrlImport } = require("./product-url-import.js");
  const calls = [];
  const asset = { id: "asset-1", previewUrl: "/api/assets/asset-1", label: "Product photo" };
  const preview = {
    sourceUrl: "https://shop.example/products/item",
    fetchedPageUrl: "https://shop.example/products/item",
    draft: {
      title: { value: "Sample Item", sourceUrl: "https://shop.example/products/item", sourceLabel: "JSON-LD Product.name", confidence: "high", confirmed: false },
      description: { value: "A sample page description.", sourceUrl: "https://shop.example/products/item", sourceLabel: "JSON-LD Product.description", confidence: "high", confirmed: false },
      detectedImages: [{ value: "https://shop.example/images/item.jpg", sourceUrl: "https://shop.example/images/item.jpg", sourcePageUrl: "https://shop.example/products/item", sourceLabel: "JSON-LD Product.image", confidence: "high", confirmed: false }],
      possiblePrice: { value: { amount: "18.50", currency: "USD" }, sourceUrl: "https://shop.example/products/item", sourceLabel: "JSON-LD Offer.price", confidence: "high", confirmed: false },
      confirmed: false,
      reviewRequired: true
    }
  };
  function response(status, body) {
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  }
  function setFetch(handler) {
    calls.length = 0;
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      return handler(String(url), init, calls.length - 1);
    };
  }
  function mount(onImported = () => {}) {
    const state = [];
    const instance = { state, cursor: 0 };
    const props = { siteId: "site_aidreamcapes", customerId: "customer-1", csrfToken: "session-token", loginHref: "/login", onImported };
    return {
      render() {
        instance.cursor = 0;
        activeMount = instance;
        try { return ProductUrlImport(props); }
        finally { activeMount = undefined; }
      }
    };
  }
  function visit(node, predicate, found = []) {
    if (Array.isArray(node)) node.forEach(child => visit(child, predicate, found));
    else if (node && typeof node === "object") {
      if (predicate(node)) found.push(node);
      visit(node.props?.children, predicate, found);
    }
    return found;
  }
  function textContent(node) {
    if (Array.isArray(node)) return node.map(textContent).join("");
    if (node == null || typeof node === "boolean") return "";
    if (typeof node === "string" || typeof node === "number") return String(node);
    return textContent(node.props?.children);
  }
  function findButton(tree, label) {
    const button = visit(tree, node => node.type === "button" && textContent(node).includes(label))[0];
    assert.ok(button, `button ${label} exists`);
    return button;
  }
  function formAndInput(mounted) {
    const tree = mounted.render();
    const form = visit(tree, node => node.type === "form")[0];
    const input = visit(tree, node => node.type === "input" && node.props.name === "url")[0];
    assert.ok(form && input, "product URL form is rendered");
    return { tree, form, input };
  }

  // Malformed and non-HTTPS URLs fail in the submit handler before any request.
  const malformed = mount();
  setFetch(() => response(200, { ok: true, preview }));
  let fields = formAndInput(malformed);
  fields.input.props.onChange({ currentTarget: { value: "not a URL" } });
  fields = formAndInput(malformed);
  await fields.form.props.onSubmit({ preventDefault() {} });
  assert.equal(calls.length, 0, "malformed URL does not call preview or import API");
  assert.match(textContent(malformed.render()), /complete product page link/);

  // A failed preview has no route to import-url and leaves a readable error.
  const failedPreview = mount();
  setFetch(() => response(422, { ok: false, error: "product_url_fetch_failed" }));
  fields = formAndInput(failedPreview);
  fields.input.props.onChange({ currentTarget: { value: "https://shop.example/products/item" } });
  fields = formAndInput(failedPreview);
  await fields.form.props.onSubmit({ preventDefault() {} });
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/aivideosugc\/tasks\/product-brief$/);
  assert.equal(calls[0].init.headers["x-csrf-token"], "session-token");
  assert.equal(calls[0].init.credentials, "same-origin");
  assert.equal(calls.some(call => call.url.endsWith("/assets/import-url")), false, "preview failure cannot import a customer asset");
  assert.match(textContent(failedPreview.render()), /couldn’t load that product page/i);

  // Cancel returns to URL entry without calling the customer import endpoint.
  const cancelled = mount();
  setFetch(() => response(200, { ok: true, preview }));
  fields = formAndInput(cancelled);
  fields.input.props.onChange({ currentTarget: { value: preview.sourceUrl } });
  fields = formAndInput(cancelled);
  await fields.form.props.onSubmit({ preventDefault() {} });
  let previewTree = cancelled.render();
  assert.match(textContent(previewTree), /Sample Item/);
  assert.match(textContent(previewTree), /A sample page description/);
  assert.match(textContent(previewTree), /Possible price · unconfirmed/);
  assert.match(textContent(previewTree), /were read from this page and are unconfirmed/);
  assert.equal(calls.length, 1, "loading a preview does not import an asset");
  assert.equal(calls.some(call => call.url.endsWith("/assets/import-url") || call.init.method === "PATCH"), false, "an unconfirmed preview does not import or patch a task");
  findButton(previewTree, "Cancel").props.onClick();
  previewTree = cancelled.render();
  assert.ok(visit(previewTree, node => node.type === "form").length, "cancel returns to URL entry");
  assert.equal(calls.length, 1, "cancel never calls customer import");
  assert.equal(calls.some(call => call.url.endsWith("/assets/import-url") || call.init.method === "PATCH"), false, "cancel never imports or patches a task");

  // Confirmation is the only action that reaches the existing asset import API.
  const imported = [];
  const confirmed = mount((...args) => imported.push(args));
  setFetch((url, _init, index) => index === 0
    ? response(200, { ok: true, preview })
    : response(200, { ok: true, asset, product: { title: "Imported Item" } }));
  fields = formAndInput(confirmed);
  fields.input.props.onChange({ currentTarget: { value: preview.sourceUrl } });
  fields = formAndInput(confirmed);
  await fields.form.props.onSubmit({ preventDefault() {} });
  assert.equal(calls.length, 1, "customer import remains untouched while preview is waiting for confirmation");
  assert.equal(calls.some(call => call.url.endsWith("/assets/import-url") || call.init.method === "PATCH"), false, "confirmed preview still waits for explicit confirmation before import or task patch");
  previewTree = confirmed.render();
  const confirm = findButton(previewTree, "Confirm product photo");
  await confirm.props.onClick();
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /\/aivideosugc\/tasks\/product-brief$/);
  assert.match(calls[1].url, /\/customers\/customer-1\/assets\/import-url$/);
  assert.equal(JSON.parse(calls[1].init.body).url, preview.sourceUrl);
  assert.equal(calls[1].init.headers["x-csrf-token"], "session-token");
  assert.equal(imported.length, 1);
  assert.equal(imported[0][0].id, asset.id);
  assert.equal(imported[0][1], "Sample Item");
  assert.equal(imported[0][2].selectionConfirmed, true);
  assert.equal(imported[0][2].priceConfirmed, false, "customer confirmation never marks a scraped price verified");
  assert.equal(imported[0][2].description.value, "A sample page description.");
  assert.equal(imported[0][2].possiblePrice.value.amount, "18.50");
  assert.equal(imported[0][2].candidateImages[0].value, preview.draft.detectedImages[0].value);

  console.log("Aidreamcapes product brief UI contract passed (HTTPS validation, mocked preview, cancel, confirm-gated customer import, sourced unconfirmed fields).");
} finally {
  activeMount = undefined;
  Module._load = originalLoad;
  fs.rmSync(temp, { recursive: true, force: true });
}
