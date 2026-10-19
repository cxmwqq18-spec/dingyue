#!/usr/bin/env node
import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import { createHash, X509Certificate } from "node:crypto";

const auditRoot = "/www/wwwroot/aidreamcapes.com/ops/aidreamcapes-static-media-20261018";
const mode = process.argv.includes("--public") ? "public" : "origin";
const manifest = JSON.parse(fs.readFileSync(path.join(auditRoot, "stage-current.json"), "utf8"));
if (manifest.siteId !== "site_aidreamcapes" || !manifest.files?.length) throw new Error("invalid_site_media_manifest");
const filesHash = createHash("sha256").update(JSON.stringify(manifest.files)).digest("hex");
const agent = new https.Agent({ keepAlive: true, maxSockets: 8 });
// The CDN uses a publicly trusted certificate. Direct loopback verification
// pins the origin's existing self-signed certificate obtained through SSH.
const originFingerprint = mode === "origin" ? new X509Certificate(fs.readFileSync("/www/server/panel/vhost/cert/aidreamcapes.com/fullchain.pem")).fingerprint256 : undefined;

function request(file, kind = "head") {
  return new Promise((resolve, reject) => {
    const range = kind === "range";
    const req = https.request({
      hostname: "www.aivideosugc.com", servername: "www.aivideosugc.com", port: 443,
      path: new URL(file.targetUrl, "https://www.aivideosugc.com").pathname, method: kind === "head" ? "HEAD" : "GET", agent,
      ...(mode === "origin" ? { rejectUnauthorized: false, lookup: (_hostname, options, callback) => options.all ? callback(null, [{ address: "127.0.0.1", family: 4 }]) : callback(null, "127.0.0.1", 4) } : {}),
      headers: { "Accept-Encoding": "identity", ...(range ? { Range: "bytes=0-1023" } : {}) },
    }, (res) => {
      if (originFingerprint && res.socket.getPeerCertificate().fingerprint256 !== originFingerprint) {
        res.destroy(new Error("origin_certificate_pin_mismatch"));
        reject(new Error("origin_certificate_pin_mismatch"));
        return;
      }
      let bytes = 0;
      const digest = createHash("sha256");
      res.on("data", (chunk) => { bytes += chunk.length; digest.update(chunk); });
      res.on("error", reject);
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, bytes, sha256: digest.digest("hex") }));
    });
    req.setTimeout(20000, () => req.destroy(new Error("http_timeout")));
    req.on("error", reject);
    req.end();
  });
}

async function verify(file) {
  const expectedPrefix = file.mimeType.startsWith("video/") ? "/ai-video-generation/" : file.mimeType.startsWith("audio/") ? "/ai-actors/" : "/ai-image-generation/";
  if (!file.targetUrl.startsWith(expectedPrefix) || file.targetUrl.includes("?") || /--sha256-[a-f0-9]{64}/i.test(file.targetUrl)) throw new Error("invalid_readable_static_media_target");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const head = await request(file);
      if (head.status !== 200) throw new Error(`head_status:${head.status}`);
      const mime = String(head.headers["content-type"] ?? "").split(";")[0];
      if (mime !== file.mimeType) throw new Error(`mime:${mime}:expected:${file.mimeType}`);
      if (head.headers["content-length"] !== undefined && Number(head.headers["content-length"]) !== file.bytes) throw new Error(`length:${head.headers["content-length"]}:expected:${file.bytes}`);
      if (head.headers["content-length"] === undefined) {
        const body = await request(file, "body");
        if (body.status !== 200 || body.bytes !== file.bytes || body.sha256 !== file.sha256) throw new Error(`body_digest_or_size_mismatch:${body.status}:${body.bytes}`);
      }
      if (!String(head.headers["cache-control"]).includes("immutable")) throw new Error("immutable_cache_header_missing");
      let rangeResult;
      if (file.mimeType.startsWith("video/")) {
        const range = await request(file, "range");
        const expectedBytes = Math.min(file.bytes, 1024);
        if (range.status !== 206 || range.headers["content-range"] !== `bytes 0-${expectedBytes - 1}/${file.bytes}` || (range.headers["accept-ranges"] ?? head.headers["accept-ranges"]) !== "bytes" || range.bytes !== expectedBytes) {
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
  tlsVerification: mode === "origin" ? { certificateFingerprint: originFingerprint, method: "SSH-installed origin certificate pin over loopback" } : { method: "public certificate chain and hostname" },
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
