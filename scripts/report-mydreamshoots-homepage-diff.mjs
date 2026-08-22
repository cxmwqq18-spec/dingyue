#!/usr/bin/env node
import path from "node:path";
import { spawnSync } from "node:child_process";
import { assertDatabaseTarget } from "./lib/database-target.mjs";
import "./load-runtime-env.mjs";

const repoRoot = process.cwd();
const guardScript = path.join(repoRoot, "scripts", "guard-mydreamshoots-content-consistency.mjs");

assertDatabaseTarget({ expectedTarget: "remote-readonly" });

const args = [
  guardScript,
  "--skip-local-json",
  "--origin=https://www.mydreamshoots.com",
  "--local-origin=http://localhost:3002/site/mydreamshoots",
  "--paths=/,/pricing,/best-packages,/best-ai-image,/best-ai-video,/ai-image-generation,/ai-video-generation,/workflow,/faq",
  "--min-live-coverage=0.5"
];

const result = spawnSync(process.execPath, args, {
  cwd: repoRoot,
  env: process.env,
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
  stdio: ["ignore", "pipe", "pipe"]
});

const raw = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
let payload;
try {
  payload = JSON.parse(result.stdout || raw || "{}");
} catch {
  payload = {
    ok: false,
    error: "Unable to parse guard output",
    raw: raw.slice(0, 6000)
  };
}

const reportBySlug = new Map();
for (const entry of Array.isArray(payload.originReports) ? payload.originReports : []) {
  const slug = String(entry?.slug ?? "");
  if (!slug) continue;
  if (!reportBySlug.has(slug)) reportBySlug.set(slug, {});
  reportBySlug.get(slug)[String(entry?.originLabel ?? "origin")] = entry;
}

const pages = Array.isArray(payload.pages)
  ? payload.pages.map((page) => {
      const slug = String(page?.slug ?? "");
      const report = reportBySlug.get(slug) ?? {};
      return {
        slug,
        db: page?.db ?? null,
        publication: page?.publication ?? null,
        approvedHomepageLock: page?.approvedHomepageLock ?? null,
        live: report.production ?? null,
        local: report.local ?? null,
        localJson: page?.localJson ?? null
      };
    })
  : [];

const summary = {
  ok: Boolean(payload.ok),
  sourceOfTruth: payload.sourceOfTruth ?? "postgres",
  site: payload.site ?? null,
  latestPublication: payload.latestPublication ?? null,
  guardedPaths: payload.guardedPaths ?? [],
  pages,
  failures: Array.isArray(payload.failures)
    ? payload.failures.map((failure) => ({
        type: failure?.type ?? "unknown",
        message: failure?.message ?? "",
        slug: failure?.slug ?? null
      }))
    : [],
  warnings: Array.isArray(payload.warnings) ? payload.warnings : []
};

console.log(JSON.stringify(summary, null, 2));
if (result.status !== 0) process.exitCode = result.status ?? 1;
if (!raw && result.status !== 0) process.exitCode = 1;
