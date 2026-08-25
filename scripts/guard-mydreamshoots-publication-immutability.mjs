#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const scripts = fs.readdirSync(path.join(repoRoot, "scripts"))
  .filter((name) => name !== "guard-mydreamshoots-publication-immutability.mjs" && name.endsWith(".mjs") && /(?:mydreamshoots|dreamshoot|save-the-date|seasonal|footer)/i.test(name))
  .sort()
  .map((name) => `scripts/${name}`);
const forbiddenPublication = /(?:\btx\.)?themePublication\.(?:update|updateMany|delete|deleteMany)\s*\(/g;
const publishedRecordWrite = /(?:themePage|themeSettings|storefrontProfile)\.(?:update|updateMany|upsert)\s*\(/g;
const forbiddenSnapshotMutation = /(?:syncPublicationSnapshots\s*\(|\bpublication\.snapshot(?:\.[a-zA-Z0-9_$]+)?\s*=)/g;
const forbiddenPublishedAssignment = /(?:\b(?:page|homePage|site\.themeSettings|themeSettings)\.publishedJson\s*=|\b(?:page|homePage)\.publishedJson\.[a-zA-Z0-9_$]+\s*=)/g;
const forbiddenPublicationIteration = /for\s*\(\s*const\s+publication\s+of\s+(?:state\.)?themePublications/g;
const forbiddenLegacyPublicationApi = /publishSeoSnapshotRelational\s*\(/g;
const failures = [];

for (const relative of scripts) {
  const absolute = path.join(repoRoot, relative);
  const source = fs.readFileSync(absolute, "utf8");
  for (const match of source.matchAll(forbiddenPublication)) {
    const line = source.slice(0, match.index).split("\n").length;
    failures.push({ file: relative, line, kind: "historical-publication-write", match: match[0] });
  }
  for (const match of source.matchAll(publishedRecordWrite)) {
    // The legacy snapshot-input API is not an allowlist. Only the reviewed
    // draft publication command may materialize published rows.
    if (relative !== "scripts/publish-draft-site.mjs") {
      const line = source.slice(0, match.index).split("\n").length;
      failures.push({ file: relative, line, kind: "published-record-write", match: match[0] });
      continue;
    }
    const call = source.slice(match.index, match.index + 3200);
    const end = call.search(/\n\s*\}\);/);
    const body = end >= 0 ? call.slice(0, end + 4) : call;
    if (!/(?:\bpublishedJson\s*:|\{\s*publishedJson\s*[,}])/.test(body)) continue;
    const line = source.slice(0, match.index).split("\n").length;
    failures.push({ file: relative, line, kind: "published-json-write", match: match[0] });
  }
  for (const match of source.matchAll(forbiddenSnapshotMutation)) {
    const line = source.slice(0, match.index).split("\n").length;
    failures.push({ file: relative, line, kind: "historical-snapshot-mutation", match: match[0] });
  }
  for (const match of source.matchAll(forbiddenPublishedAssignment)) {
    const line = source.slice(0, match.index).split("\n").length;
    failures.push({ file: relative, line, kind: "published-json-assignment", match: match[0] });
  }
  for (const match of source.matchAll(forbiddenPublicationIteration)) {
    const line = source.slice(0, match.index).split("\n").length;
    failures.push({ file: relative, line, kind: "historical-publication-iteration", match: match[0] });
  }
  for (const match of source.matchAll(forbiddenLegacyPublicationApi)) {
    const line = source.slice(0, match.index).split("\n").length;
    failures.push({ file: relative, line, kind: "legacy-publication-api", match: match[0] });
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
