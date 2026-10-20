import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync("src/lib/aidreamcapes-internal-fetch.ts", "utf8");
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
vm.runInNewContext(output, { exports, fetch, Response, URL });
const { fetchAidreamcapesInternal } = exports;
const reset = Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNRESET" } });
let checks = 0;
for (const method of ["GET", "HEAD"]) {
  let calls = 0;
  const init = { method, headers: { "x-storefront-head-seo-reorder-skip": "1" } };
  const response = await fetchAidreamcapesInternal(new URL("http://127.0.0.1:3013/example"), init, async (_url, actual) => {
    assert.equal(actual, init);
    if (++calls === 1) throw reset;
    return new Response("current relational HTML");
  });
  assert.equal(calls, 2);
  assert.equal(await response.text(), "current relational HTML");
  checks++;
}
for (const [url, init, error] of [
  ["https://www.aivideosugc.com/", {}, reset],
  ["http://127.0.0.1:3013/", { method: "POST" }, reset],
  ["http://127.0.0.1:3013/", { signal: AbortSignal.abort() }, reset],
  ["http://127.0.0.1:3013/", {}, new Error("application failure")],
]) {
  let calls = 0;
  await assert.rejects(fetchAidreamcapesInternal(new URL(url), init, async () => { calls++; throw error; }), (actual) => actual === error);
  assert.equal(calls, 1);
  checks++;
}
let calls = 0;
await assert.rejects(fetchAidreamcapesInternal(new URL("http://127.0.0.1:3013/"), {}, async () => { calls++; throw reset; }));
assert.equal(calls, 2); checks++;
calls = 0;
assert.equal((await fetchAidreamcapesInternal(new URL("http://127.0.0.1:3013/"), {}, async () => { calls++; return new Response("failure", { status: 500 }); })).status, 500);
assert.equal(calls, 1); checks++;
console.log(JSON.stringify({ ok: true, checks }));
