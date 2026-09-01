#!/usr/bin/env node
import assert from "node:assert/strict";

const baseUrl = (process.env.SMOKE_BASE_URL || "http://127.0.0.1:3002").replace(/\/$/, "");
const host = "www.mydreamshoots.com";
const aliasPath = "/ai-image-generation/motion-generator";
const targetPath = "/ai-video-generation/motion-generator";
const headers = { host, "x-forwarded-host": host };

const aliasResponse = await fetch(`${baseUrl}${aliasPath}`, { method: "HEAD", redirect: "manual", headers });
assert.equal(aliasResponse.status, 301, "legacy image-generation motion route must return a real HTTP 301");
assert.equal(new URL(aliasResponse.headers.get("location"), baseUrl).pathname, targetPath, "legacy motion route must target the published video page");
assert.doesNotMatch(aliasResponse.headers.get("location") ?? "", /(?:localhost|127\.0\.0\.1)/i, "legacy motion redirect must not expose an internal origin");

const targetHeadResponse = await fetch(`${baseUrl}${targetPath}`, { method: "HEAD", redirect: "manual", headers });
assert.equal(targetHeadResponse.status, 200, "published motion generator target HEAD must render");
const targetResponse = await fetch(`${baseUrl}${targetPath}`, { redirect: "manual", headers });
assert.equal(targetResponse.status, 200, "published motion generator target must render");
const targetHtml = await targetResponse.text();
assert.match(targetHtml, /<title>AI Motion Generator[^<]*<\/title>/, "published motion generator target must use its dedicated title");
assert.match(targetHtml, /rel="canonical" href="https:\/\/www\.mydreamshoots\.com\/ai-video-generation\/motion-generator"/, "published motion generator target must use its canonical URL");

console.log(JSON.stringify({ ok: true, host, aliasPath, aliasStatus: aliasResponse.status, targetPath, targetStatus: targetResponse.status }, null, 2));
