#!/usr/bin/env node
import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import { createHash } from "node:crypto";

const auditRoot = "/www/wwwroot/aidreamcapes.com/ops/aidreamcapes-static-media-20261018";
const mode = process.argv.includes("--public") ? "public" : "origin";
const manifest = JSON.parse(fs.readFileSync(path.join(auditRoot, "stage-current.json"), "utf8"));
if (manifest.siteId !== "site_aidreamcapes" || !manifest.files?.length) throw new Error("invalid_site_media_manifest");
const filesHash = createHash("sha256").update(JSON.stringify(manifest.files)).digest("hex");
const agent = new https.Agent({ keepAlive: true, maxSockets: 8 });

function request(file, range = false) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "www.aivideosugc.com", servername: "www.aivideosugc.com", port: 443,
      path: file.targetUrl, method: range ? "GET" : "HEAD", agent,
      ...(mode === "origin" ? { lookup: (_hostname, options, callback) => options.all ? callback(null, [{ address: "127.0.0.1", family: 4 }]) : callback(null, "127.0.0.1", 4) } : {}),
      headers: { "Accept-Encoding": "identity", ...(range ? { Range: "bytes=0-1023" } : {}) },
    }, (res) => {
      let bytes = 0;
      res.on("data", (chunk) => { bytes += chunk.length; });
      res.on("error", reject);
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, bytes }));
    });
    req.setTimeout(20000, () => req.destroy(new Error("http_timeout")));
    req.on("error", reject);
    req.end();
  });
}

async function verify(file) {
  if (!file.targetUrl.startsWith("/assets/sites/site_aidreamcapes/public-media/") || file.targetUrl.includes("?") || !file.targetUrl.includes(`--sha256-${file.sha256}.`)) throw new Error("invalid_static_media_target");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const head = await request(file);
      if (head.status !== 200) throw new Error(`head_status:${head.status}`);
      const mime = String(head.headers["content-type"] ?? "").split(";")[0];
      if (mime !== file.mimeType) throw new Error(`mime:${mime}:expected:${file.mimeType}`);
      if (Number(head.headers["content-length"]) !== file.bytes) throw new Error(`length:${head.headers["content-length"]}:expected:${file.bytes}`);
      if (!String(head.headers["cache-control"]).includes("immutable")) throw new Error("immutable_cache_header_missing");
      let rangeResult;
      if (file.mimeType.startsWith("video/")) {
        const range = await request(file, true);
        const expectedBytes = Math.min(file.bytes, 1024);
        if (range.status !== 206 || range.headers["content-range"] !== `bytes 0-${expectedBytes - 1}/${file.bytes}` || range.headers["accept-ranges"] !== "bytes" || range.bytes !== expectedBytes) {
          throw new Error(`range_failed:${JSON.stringify({ status: range.status, contentRange: range.headers["content-range"], bytes: range.bytes })}`);
        }
        rangeResult = { status: range.status, bytes: range.bytes, contentRange: range.headers["content-range"] };
      }
      return { targetUrl: file.targetUrl, ok: true, status: head.status, mimeType: mime, bytes: file.bytes, ...(rangeResult ? { range: rangeResult } : {}) };
    } catch (error) {
      if (attempt === 2) return { targetUrl: file.targetUrl, ok: false, error: error.message };
    }
  }
}

const results = new Array(manifest.files.length);
let next = 0;
let completed = 0;
await Promise.all(Array.from({ length: 8 }, async () => {
  while (next < manifest.files.length) {
    const index = next++;
    results[index] = await verify(manifest.files[index]);
    completed += 1;
    if (completed % 250 === 0) console.log(JSON.stringify({ mode, completed, total: results.length, failed: results.filter((item) => item && !item.ok).length }));
  }
}));
agent.destroy();
const report = {
  siteId: "site_aidreamcapes", mode, completedAt: new Date().toISOString(), filesHash,
  checked: results.length, passed: results.filter((item) => item.ok).length,
  failed: results.filter((item) => !item.ok).length,
  videosWithRange: results.filter((item) => item.range).length,
  results,
};
const reportPath = path.join(auditRoot, `http-${mode}-current.json`);
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
fs.chmodSync(reportPath, 0o600);
console.log(JSON.stringify({ ...report, results: undefined, reportPath }));
if (report.failed) process.exitCode = 1;
