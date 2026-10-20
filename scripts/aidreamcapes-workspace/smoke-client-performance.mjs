import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Runs the actual client component with synthetic hooks/HTTP. No server, DB or providers.
const source = fs.readFileSync("src/components/aidreamcapes-workspace/workspace.tsx", "utf8");
const pollingSource = fs.readFileSync("src/components/aidreamcapes-workspace/polling.ts", "utf8");
const transpile = (code) => ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
const catalog = { scenes: [], models: [], actors: [], durations: [], aspects: ["9:16"], languages: [], quickStarts: [] };
const task = { taskId: "synthetic-task", revision: 1, title: "Draft", status: "draft", sceneId: "process_demo", storyboardHistory: [], input: { images: {}, fields: {}, options: { duration: 15, aspect: "9:16", language: "en", subtitle: false } } };

function harness(props, search = "", responses = new Map()) {
  const states = [], refs = [], effects = [], calls = [], timers = new Map(), listeners = new Map();
  let cursor = 0, refCursor = 0, timerId = 0;
  const document = { hidden: false, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: (name, fn) => { if (listeners.get(name) === fn) listeners.delete(name); } };
  const window = { location: { search, href: `http://synthetic.test/app/create${search}` }, history: { state: {}, replaceState: (_state, _title, url) => { window.location.href = String(url); } }, addEventListener() {}, removeEventListener() {}, scrollTo() {} };
  const react = {
    useState(value) { const index = cursor++; if (!(index in states)) states[index] = value; return [states[index], (next) => { states[index] = typeof next === "function" ? next(states[index]) : next; }]; },
    useRef(value) { const index = refCursor++; if (!refs[index]) refs[index] = { current: value }; return refs[index]; },
    useCallback: (fn) => fn,
    useEffect: (fn) => effects.push(fn),
  };
  const sandbox = {
    exports: {}, AbortController, URL, URLSearchParams, console, crypto: { randomUUID: () => "synthetic-id" }, document, window,
    setInterval: (fn) => { const id = ++timerId; timers.set(id, fn); return id; }, clearInterval: (id) => timers.delete(id),
    setTimeout: (fn) => { const id = ++timerId; timers.set(id, fn); return id; }, clearTimeout: (id) => timers.delete(id),
    fetch: async (url, init) => {
      const path = String(url).split("/aivideosugc")[1]; calls.push({ path, init });
      const handler = responses.get(`${init.method ?? "GET"} ${path}`);
      const body = handler ? await handler(init) : path === "/catalog" ? { catalog } : path === "/tasks" ? { tasks: [] } : { task };
      return { ok: !body.error, status: body.error ? 409 : 200, json: async () => body };
    },
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(transpile(pollingSource), context);
  const startWorkspacePolling = sandbox.exports.startWorkspacePolling;
  const navigation = {};
  vm.runInContext(`(function(exports) { ${transpile(fs.readFileSync("src/lib/aidreamcapes-workspace/navigation.ts", "utf8"))} })`, context)(navigation);
  sandbox.exports = {};
  sandbox.require = (name) => {
    if (name === "react") return react;
    if (name === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: "fragment" };
    if (name === "./polling") return { startWorkspacePolling };
    if (name.endsWith("/navigation")) return navigation;
    if (name.endsWith("/handoff")) return { workspaceHandoffFromSearchParams: () => ({}) };
    if (name.endsWith("/aidreamcapes-create-intent")) return { aidreamcapesCreateIntentFromSearchParams: () => undefined };
    if (name.endsWith("/inspirations-embedded")) return { EmbeddedInspirations: () => null };
    if (name.endsWith("/catalogs")) return { WORKSPACE_ASPECTS: ["9:16", "1:1", "16:9"] };
    if (name === "./use-image-draft") return { useImageDraft() {} };
    if (name.includes("client-csrf")) return { customerJsonHeaders: () => ({}), csrfHeader: () => ({}) };
    if (name.endsWith(".css")) return { default: {} };
    return new Proxy({}, { get: () => () => null });
  };
  vm.runInContext(transpile(source), context);
  const render = () => { cursor = 0; refCursor = 0; effects.length = 0; return sandbox.exports.AidreamcapesWorkspace({ siteId: "site_aidreamcapes", basePath: "", customer: { id: "synthetic-customer", balance: 50 }, ...props }); };
  return { render, states, effects, calls, document, timers, listeners, startWorkspacePolling };
}

function find(tree, predicate) {
  if (!tree || typeof tree !== "object") return undefined;
  if (predicate(tree)) return tree;
  for (const child of [tree.props?.children].flat(Infinity)) { const result = find(child, predicate); if (result) return result; }
}

{
  const h = harness({ initialCatalog: catalog, initialTaskId: task.taskId, initialView: "agent" });
  h.render(); const stop = h.effects[0](); await flush();
  assert.deepEqual(h.calls.map((call) => call.path), [`/tasks/${task.taskId}`]);
  assert.equal(h.states.find((state) => state && typeof state === "object" && state.taskId === task.taskId)?.taskId, task.taskId); stop();
}
{
  const pendingCatalog = deferred(), pendingTask = deferred();
  const h = harness({ initialTaskId: task.taskId, initialView: "agent" }, "", new Map([
    ["GET /catalog", () => pendingCatalog.promise], [`GET /tasks/${task.taskId}`, () => pendingTask.promise],
  ]));
  h.render(); const stop = h.effects[0]();
  assert.deepEqual(h.calls.map((call) => call.path), ["/catalog", `/tasks/${task.taskId}`], "task starts without waiting for catalog");
  pendingTask.resolve({ task }); pendingCatalog.resolve({ catalog }); await flush(); stop();
}
{
  const h = harness({ initialCatalog: catalog, initialView: "actors" }, "?view=actors");
  h.render(); const stop = h.effects[0](); await flush();
  assert.equal(h.calls.length, 0, "avatar view reuses SSR customer catalog"); stop();
}
{
  const pendingSave = deferred();
  const h = harness({ initialCatalog: catalog, initialTaskId: task.taskId, initialView: "agent" }, "", new Map([[`PATCH /tasks/${task.taskId}`, () => pendingSave.promise]]));
  h.render(); const stop = h.effects[0](); await flush();
  let tree = h.render();
  find(tree, (node) => node.type === "input" && node.props["aria-label"] === "Video title").props.onChange({ target: { value: "Updated draft" } });
  tree = h.render();
  find(tree, (node) => node.type === "a" && node.props.children?.some?.((child) => child?.type === "span" && child.props.children === "Home")).props.onClick({ preventDefault() {} });
  assert.equal(h.states[2], "home", "navigation displays next module before slow draft save");
  await flush(); assert.equal(h.calls.filter((call) => call.init.method === "PATCH").length, 1);
  pendingSave.resolve({ error: "revision_conflict" }); await flush();
  assert.equal(h.states[2], "agent", "failed save returns to editable draft");
  assert.equal(h.states[3].title, "Updated draft", "failed save retains unsaved edit");
  assert.equal(h.states[10], "Not saved — retry below"); stop();
}
{
  const pendingSave = deferred();
  const h = harness({ initialCatalog: catalog, initialTaskId: task.taskId, initialView: "agent" }, "", new Map([[`PATCH /tasks/${task.taskId}`, () => pendingSave.promise]]));
  h.render(); const stop = h.effects[0](); await flush();
  let tree = h.render();
  find(tree, (node) => node.type === "input" && node.props["aria-label"] === "Video title").props.onChange({ target: { value: "Saved draft" } });
  tree = h.render();
  find(tree, (node) => node.type === "a" && node.props.children?.some?.((child) => child?.type === "span" && child.props.children === "Home")).props.onClick({ preventDefault() {} });
  await flush();
  pendingSave.resolve({ task: { ...task, title: "Saved draft", revision: 2 } }); await flush();
  assert.equal(h.states[2], "home"); assert.equal(h.states[3], null, "background save does not reopen the old task");
  assert.equal(h.states[4][0].revision, 2, "saved draft revision is retained in task cards"); stop();
}
{
  const pendingTask = deferred();
  const h = harness({ initialCatalog: catalog, initialTaskId: task.taskId, initialView: "agent" }, "", new Map([[`GET /tasks/${task.taskId}`, () => pendingTask.promise]]));
  const tree = h.render(); const stop = h.effects[0]();
  find(tree, (node) => node.type === "a" && node.props.children?.some?.((child) => child?.type === "span" && child.props.children === "Home")).props.onClick({ preventDefault() {} });
  await flush(); pendingTask.resolve({ task }); await flush();
  assert.equal(h.states[2], "home"); assert.equal(h.states[3], null, "late initial detail does not override later navigation"); stop();
}
{
  const pendingList = deferred();
  const h = harness({ initialCatalog: catalog, initialView: "agent" }, "", new Map([["GET /tasks", () => pendingList.promise]]));
  let tree = h.render(); const stop = h.effects[0](); await flush();
  find(tree, (node) => node.type === "a" && node.props.children?.some?.((child) => child?.type === "span" && child.props.children === "Library")).props.onClick({ preventDefault() {} });
  tree = h.render();
  find(tree, (node) => node.type === "a" && node.props.children?.some?.((child) => child?.type === "span" && child.props.children === "Home")).props.onClick({ preventDefault() {} });
  await flush(); pendingList.resolve({ tasks: [task] }); await flush();
  assert.equal(h.states[2], "home"); assert.equal(h.states[4].length, 0, "late Library response is ignored after a later click"); stop();
}
{
  const h = harness({ initialCatalog: catalog });
  const pending = deferred(); let count = 0, signal;
  const stop = h.startWorkspacePolling(async (value) => { count++; signal = value; await pending.promise; }, 100, true);
  const tick = [...h.timers.values()][0]; tick(); tick();
  assert.equal(count, 1, "slow requests never overlap");
  pending.resolve(); await flush(); h.document.hidden = true; tick(); assert.equal(count, 1);
  h.document.hidden = false; h.listeners.get("visibilitychange")(); await flush(); assert.equal(count, 2);
  stop(); assert.equal(signal.aborted, true); assert.equal(h.timers.size, 0); assert.equal(h.listeners.size, 0);
}
console.log("PASS client performance: parallel bootstrap, no duplicate actors/list on detail, responsive navigation with save recovery, nonoverlapping visible polling.");
