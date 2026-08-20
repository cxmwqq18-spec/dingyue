#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const scripts = fs.readdirSync(path.join(repoRoot, "scripts"))
  .filter((name) => /^(?:sync|rectify|enrich|migrate)-(?:mydreamshoots|dreamshoot)/.test(name) && name.endsWith(".mjs"))
  .sort()
  .map((name) => `scripts/${name}`);
const forbiddenPublication = /(?:\btx\.)?themePublication\.(?:update|updateMany|delete|deleteMany)\s*\(/g;
const forbiddenPublishedJsonWrite = /(?:themePage|themeSettings|storefrontProfile)\.(?:update|updateMany|upsert|create)\s*\(\s*\{[\s\S]{0,500}?\bdata\s*:\s*\{[^}]*\bpublishedJson\s*:/g;
const failures = [];

for (const relative of scripts) {
  const absolute = path.join(repoRoot, relative);
  const source = fs.readFileSync(absolute, "utf8");
  for (const match of source.matchAll(forbiddenPublication)) {
    const line = source.slice(0, match.index).split("\n").length;
    failures.push({ file: relative, line, kind: "historical-publication-write", match: match[0] });
  }
  for (const match of source.matchAll(forbiddenPublishedJsonWrite)) {
    const line = source.slice(0, match.index).split("\n").length;
    failures.push({ file: relative, line, kind: "published-json-write", match: match[0].split("\n")[0] });
  }
}

const result = {
  ok: failures.length === 0,
  rule: "MyDreamShoots source sync scripts may write draft/source only; publication is created by the formal publish service",
  checked: scripts,
  failures
};
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exitCode = 1;
