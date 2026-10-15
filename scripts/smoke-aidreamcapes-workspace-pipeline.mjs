import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

// Run the pure compiler in isolation: no database, provider traffic or credits.
const source = path.join(process.cwd(), "src/lib/aidreamcapes-workspace");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "aivideosugc-compiler-"));
try {
  for (const name of ["types", "catalogs", "capabilities", "pipeline"]) {
    const result = ts.transpileModule(fs.readFileSync(path.join(source, `${name}.ts`), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
    fs.writeFileSync(path.join(temp, `${name}.js`), result.outputText);
  }
  const require = createRequire(path.join(temp, "entry.cjs"));
  const catalogs = require("./catalogs.js"), compiler = require("./pipeline.js");
  const input = catalogs.defaultTaskInput("process_demo");
  input.fields.steps = "Open the lid\nPlace the product";
  input.images.productImages = ["/api/local-assets/sites/site_aidreamcapes/customers/customer_test/assets/product.png"];
  compiler.validateTaskInput("process_demo", input);
  assert.throws(() => catalogs.assertWorkspaceSite("site_dreamshoot"), /workspace_site_not_allowed/);
  for (const [property, value, error] of [["duration", 18, "workspace_duration_invalid"], ["aspect", "4:3", "workspace_aspect_invalid"], ["language", "fr", "workspace_language_invalid"], ["style", "invented", "workspace_style_invalid"]]) {
    const changed = structuredClone(input); changed.options[property] = value;
    assert.throws(() => compiler.validateTaskInput("process_demo", changed), new RegExp(error));
  }
  const withActor = { ...structuredClone(input), actorId: "lin" };
  assert.throws(() => compiler.validateTaskInput("process_demo", withActor, [], false), /workspace_scene_has_no_actor/);
  const makeShot = (id, start, end) => ({ shotId: id, start, end, duration: end - start, environment: "A clean table", visual: "The product lid opens.", voiceover: "", locked: false,
    refKinds: ["product"], refImgs: {}, camera: "push_in", framing: "close", lighting: "professional", expression: "", genStatus: "pending", versions: [], prompt: "" });
  const storyboard = { scenePlan: { strategy: "single", scenes: ["A clean table"], mainScene: "A clean table", reason: "One setting" }, lang: "en", source: "auto", shots: [makeShot("a", 0, 5), makeShot("b", 5, 10), makeShot("c", 10, 15)], colorGrade: "professional", musicGenre: "none", version: "1" };
  const args = { sceneId: "process_demo", input, storyboard };
  const first = compiler.compileStoryboard(args), second = compiler.compileStoryboard(args);
  assert.deepEqual(first, second, "Same inputs produce byte-identical prompt text");
  assert.equal(storyboard.shots[0].prompt, "", "Compiler must not mutate persisted prior inputs");
  assert(first.shots[0].prompt.includes("Image 1: the exact product"));
  assert(!first.shots[0].prompt.includes("{}"));
  assert(!first.shots[0].prompt.includes("【"));
  const discontinuous = structuredClone(storyboard); discontinuous.shots[1].start = 6;
  assert.throws(() => compiler.compileStoryboard({ ...args, storyboard: discontinuous }), /workspace_timeline_discontinuous/);
  assert.throws(() => compiler.compileStoryboard({ ...args, input: { ...input, options: { ...input.options, duration: 20 } } }), /workspace_timeline_duration_mismatch/);
  assert.throws(() => compiler.compileStoryboard({ ...args, storyboard: { ...storyboard, lang: "es" } }), /workspace_language_rewrite_required/);
  assert.throws(() => compiler.compileStoryboard({ ...args, storyboard: { ...storyboard, colorGrade: "natural" } }), /workspace_style_boundary_invalid/);
  assert.equal(compiler.speechUnitCount("这是五个字", "zh"), 5);
  assert.equal(compiler.speechUnitCount("one two three", "en"), 3);
  const foreignRef = structuredClone(first.shots[0]); foreignRef.refImgs.product = "/another-customer.png";
  assert.throws(() => compiler.resolveShotReferences({ sceneId: "process_demo", input, shot: foreignRef }), /workspace_reference_not_in_task/);
  const presenter = catalogs.defaultTaskInput("presenter_showcase");
  presenter.fields.sellingPoints = "The supplied product is blue"; presenter.images.productImages = input.images.productImages;
  assert.throws(() => compiler.validateTaskInput("presenter_showcase", presenter), /workspace_actor_selection_required/);
  const actor = { actorId: "lin", name: "Lin", imageUrl: "/actor.png", gender: "female", ageRange: "25–30", identityPrompt: "The exact reference person", voice: { voiceId: "mock:aidreamcapes:female:lin:v1", gender: "female", timbre: "warm", language: "en", vocalProfile: "A warm female voice", refAudio: "", speed: 1, pitch: 0 } };
  presenter.actorId = "lin";
  const presenterShot = { ...makeShot("d", 0, 5), refKinds: ["actor", "product", "composite"], actorId: "lin", voiceover: "See the blue product.", vocalTimbre: "warm", lighting: "relaxed_daily" };
  const presenterBoard = { ...storyboard, colorGrade: "relaxed_daily", shots: [presenterShot] };
  const preview = compiler.compileShot({ sceneId: "presenter_showcase", input: presenter, shot: presenterShot, storyboard: presenterBoard, actors: [actor] });
  assert(preview.includes("Image 1: the person's identity"));
  assert(preview.includes("Image 2: the exact product"));
  assert(!preview.includes("Audio reference follows"), "Do not claim a missing audio reference was uploaded");
  assert.throws(() => compiler.resolveShotReferences({ sceneId: "presenter_showcase", input: presenter, shot: presenterShot, actors: [actor] }), /workspace_reference_missing/);
  const reversed = { ...presenterShot, refKinds: ["product", "actor"] };
  assert.throws(() => compiler.compileShot({ sceneId: "presenter_showcase", input: presenter, shot: reversed, storyboard: presenterBoard, actors: [actor] }), /workspace_actor_product_references_required/);
  // Exercise real reroll/rewrite orchestration with a deterministic LLM transport fixture. No HTTP requests are sent.
  const priorFetch = globalThis.fetch;
  let decisionCalls = 0;
  const decisionRequests = [];
  let verifyBriefPrompt = false;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://invalid.test/v1/chat/completions");
    decisionCalls++;
    const request = JSON.parse(options.body);
    decisionRequests.push(request);
    const isStyle = request.messages[0].content.startsWith("Choose camera");
    const data = JSON.parse(request.messages[1].content);
    const count = data.shotCount ?? data.shots?.length ?? 3;
    const output = isStyle ? { shots: Array.from({ length: count }, () => ({ camera: "slide", framing: "macro" })) } : {
      environment: "A clean table", shots: Array.from({ length: count }, () => ({ visual: verifyBriefPrompt ? "The sample item sits on a clean table." : "The product lid opens.", voiceover: "", factSources: [verifyBriefPrompt ? "confirmed_product_title" : "steps"] }))
    };
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(output) } }] }), { status: 200 });
  };
  try {
    const sourceCode = ts.transpileModule(fs.readFileSync(path.join(source, "provider.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const providerModule = { exports: {} };
    const scopedRequire = (id) => {
      if (id === "./provider-catalog-read") return { listWorkspaceProviderRows: async () => [{ id: "test", enabled: true, apiKey: "test-only-key", aiUrl: "https://invalid.test", modelType: "test-model" }] };
      if (id === "server-only") return {};
      if (id === "./dispatch") return { dispatchWorkspaceJob: async () => { throw new Error("Workspace compiler smoke must not dispatch jobs"); } };
      if (id === "./stability") return { isWorkspaceStabilityMockMode: () => false, mockStructuredDecision: () => { throw new Error("Unexpected workspace mock mode"); }, assertWorkspaceExternalOperation: () => {} };
      if (id === "./asset-contracts") return {};
      if (id === "./actors.json") return { actors: [] };
      if (id === "@/lib/stores/platform-store") return { listPlatformAiProvidersRelational: async () => [{ id: "test", enabled: true, apiKey: "test-only-key", aiUrl: "https://invalid.test", modelType: "test-model" }] };
      if (id.startsWith("@/lib/")) return {};
      return require(id);
    };
    new Function("require", "module", "exports", sourceCode)(scopedRequire, providerModule, providerModule.exports);
    verifyBriefPrompt = true;
    const briefStoryboard = await providerModule.exports.generateStoryboard({ siteId: "site_aidreamcapes", sceneId: "process_demo", input, actors: [], productBrief: {
      sourceUrl: "https://shop.example/products/item", fetchedPageUrl: "https://shop.example/products/item",
      title: { value: "Sample Item", sourceUrl: "https://shop.example/products/item", sourceLabel: "Product.name", confidence: "high", userConfirmed: true },
      description: { value: "A useful sample product.", sourceUrl: "https://shop.example/products/item", sourceLabel: "Product.description", confidence: "medium", userConfirmed: true },
      possiblePrice: { amount: "987.65", currency: "USD", sourceUrl: "https://shop.example/products/item", sourceLabel: "Offer.price", confidence: "high", userConfirmed: false },
      userConfirmed: true, confirmedAt: "2026-10-14T09:40:12.000Z"
    } });
    assert.equal(briefStoryboard.shots.length, 1);
    const briefRequest = decisionRequests.find(request => !request.messages[0].content.startsWith("Choose camera"));
    assert.ok(briefRequest, "Storyboard planning uses the deterministic mock request contract");
    const briefData = JSON.parse(briefRequest.messages[1].content);
    assert(briefData.facts.some(fact => fact.id === "confirmed_product_title" && fact.value === "Sample Item"));
    assert(briefData.facts.some(fact => fact.id === "confirmed_product_description" && fact.value === "A useful sample product."));
    assert(!briefRequest.messages[1].content.includes("987.65"), "Unconfirmed possible price is omitted from the storyboard request");
    assert(briefRequest.messages[0].content.includes("Any product page price is unconfirmed"));
    verifyBriefPrompt = false;
    const old = structuredClone(first);
    old.shots[1].locked = true;
    for (const shot of old.shots) {
      shot.curVer = `old-${shot.shotId}`;
      shot.genStatus = "done";
      shot.versions = [{ ...compiler.snapshotShot(shot), vid: shot.curVer, ts: "2026-01-01T00:00:00Z", prompt: shot.prompt, clipUrl: "/test-only.mp4", status: "done", origin: "auto" }];
    }
    const rerolled = await providerModule.exports.generateStoryboard({ siteId: "site_aidreamcapes", sceneId: "process_demo", input, actors: [], existing: old });
    assert.deepEqual(rerolled.shots[1], old.shots[1], "Locked shot inputs, selected version and history remain exactly intact");
    assert.equal(rerolled.shots[0].shotId, old.shots[0].shotId);
    assert.equal(rerolled.shots[0].versions[0].origin, "before_reroll");
    assert.equal(rerolled.shots[0].genStatus, "pending");
    assert.equal(rerolled.shots[0].curVer, undefined);
    const priorCalls = decisionCalls;
    const rewritten = await providerModule.exports.generateStoryboard({ siteId: "site_aidreamcapes", sceneId: "process_demo", input, actors: [], existing: old, rewriteOnly: true });
    assert.equal(decisionCalls, priorCalls + 1, "Dialogue rewrite must skip visual style decisions");
    for (let index = 0; index < old.shots.length; index++) {
      assert.equal(rewritten.shots[index].visual, old.shots[index].visual);
      assert.equal(rewritten.shots[index].camera, old.shots[index].camera);
      assert.equal(rewritten.shots[index].locked, old.shots[index].locked);
      assert.deepEqual(rewritten.shots[index].refImgs, old.shots[index].refImgs);
      assert.equal(rewritten.shots[index].versions[0].origin, "before_rewrite");
    }
    await assert.rejects(providerModule.exports.generateStoryboard({ siteId: "site_aidreamcapes", sceneId: "process_demo", input: { ...input, options: { ...input.options, duration: 30 } }, actors: [], existing: old }), /workspace_locked_timeline_duration_conflict/);
  } finally { globalThis.fetch = priorFetch; }
  console.log("PASS: isolated workspace compiler invariants, parameter rejection, fact input fields, actor/reference order, deterministic prompts and speech budgeting.");
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
