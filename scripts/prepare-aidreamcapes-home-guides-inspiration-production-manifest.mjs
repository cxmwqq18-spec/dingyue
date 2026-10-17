#!/usr/bin/env node
// Read current Aidreamcapes homepage fields and create a narrow forward-only manifest.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

loadRuntimeEnv();
const args = process.argv.slice(2);
const value = (key) => args.find((arg) => arg.startsWith(`${key}=`))?.slice(key.length + 1);
assertDatabaseTarget({ expectedTarget: "production", requireProductionConfirmation: true, productionConfirmed: args.includes("--confirm-production") });

const siteId = "site_aidreamcapes";
const pageId = "site_aidreamcapes_home";
const desiredTitle = "From One Product Photo to a Scroll-Stopping Ad";
const desired = [
  { path: "/sections/v2_main/settings/data/reviews/cta", value: { label: "Explore more inspiration", href: "/inspiration" }, accepted: [undefined, { label: "Explore more inspiration", href: "/inspiration" }] },
  { path: "/sections/v2_main/settings/data/homeExperience/blocks/{feature}/href", value: "/guides", accepted: (current) => current === "/guides" || (typeof current === "string" && current.startsWith("/app/create?view=agent&")) },
  { path: "/sections/v2_main/settings/data/homeExperience/blocks/{feature}/copy/t033", value: "Browse more video guides →", accepted: ["Browse more video guides →", "Start an editable video draft →"] }
];
const stable = (input) => Array.isArray(input) ? input.map(stable) : input && typeof input === "object" ? Object.fromEntries(Object.keys(input).sort().map((key) => [key, stable(input[key])])) : input;
const hash = (input) => crypto.createHash("sha256").update(input === undefined ? "<undefined>" : JSON.stringify(stable(input))).digest("hex");
const read = (root, pointer) => pointer.split("/").filter(Boolean).reduce((current, key) => current?.[key], root);

const deployedCommit = (await fs.readFile(".deployed-commit", "utf8")).trim();
assert(/^[a-f0-9]{40}$/.test(deployedCommit), "The current Aidreamcapes release commit is required.");
const output = path.resolve(value("--out") || `/tmp/aidreamcapes-home-guides-inspiration-${deployedCommit}.json`);
const db = new PrismaClient();
try {
  const row = await db.livePage.findFirst({ where: { id: pageId, siteId, slug: "/" }, select: { id: true, siteId: true, slug: true, contentJson: true } });
  assert(row, "Current Aidreamcapes homepage LivePage is required.");
  const data = row.contentJson?.sections?.v2_main?.settings?.data;
  assert(data && typeof data === "object", "Current Aidreamcapes V2 homepage data is missing.");
  assert.equal(data.reviews?.h2, desiredTitle, "The seller showcase changed; review the current production page before applying.");
  const featureIndexes = (data.homeExperience?.blocks ?? []).map((block, index) => block.after === "features" ? index : -1).filter((index) => index >= 0);
  assert.equal(featureIndexes.length, 1, "Expected exactly one homepage storyboard block.");

  const operations = [];
  for (const field of desired) {
    const pointer = field.path.replace("{feature}", String(featureIndexes[0]));
    const current = read(row.contentJson, pointer);
    const allowed = typeof field.accepted === "function" ? field.accepted(current) : field.accepted.some((candidate) => hash(candidate) === hash(current));
    assert(allowed, `Production copy changed; refusing to overwrite ${pointer}.`);
    if (hash(current) === hash(field.value)) continue;
    operations.push({ entityType: "live_page", id: pageId, field: "contentJson", path: pointer, baseHash: hash(current), ...(current === undefined ? {} : { previousValue: current }), value: field.value });
  }

  if (operations.length) {
    const manifest = { siteId, target: "production", codeCommit: deployedCommit, operations };
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  }
  console.log(JSON.stringify({ ok: true, target: "production", siteId, pageId, codeCommit: deployedCommit, operationCount: operations.length, paths: operations.map(({ path: pointer }) => pointer), manifest: operations.length ? output : null, noOp: operations.length === 0, historicalStateActivated: false }, null, 2));
} finally {
  await db.$disconnect();
}
