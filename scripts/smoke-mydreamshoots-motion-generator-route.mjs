#!/usr/bin/env node
import assert from "node:assert/strict";

const baseUrl = (process.env.SMOKE_BASE_URL || "http://127.0.0.1:3002").replace(/\/$/, "");
const aliasPath = "/site/mydreamshoots/ai-image-generation/motion-generator";
const targetPath = "/site/mydreamshoots/ai-video-generation/motion-generator";

const aliasResponse = await fetch(`${baseUrl}${aliasPath}`, { method: "HEAD", redirect: "manual" });
assert.equal(aliasResponse.status, 308, "legacy image-generation motion route must permanently redirect");
assert.equal(new URL(aliasResponse.headers.get("location"), baseUrl).pathname, targetPath, "legacy motion route must target the published video page");

const targetResponse = await fetch(`${baseUrl}${targetPath}`, { method: "HEAD", redirect: "manual" });
assert.equal(targetResponse.status, 200, "published motion generator target must render");

console.log(JSON.stringify({ ok: true, aliasPath, aliasStatus: aliasResponse.status, targetPath, targetStatus: targetResponse.status }, null, 2));
