#!/usr/bin/env node
// AIVideosUGC /about-us team portraits — 2026-11-24.
//
// The page shipped with the earlier preview portraits (profile-portraits /
// profile-close-portraits). The reviewed final set lives in
// about-us-preview/latest-team-portraits and is copied into public/ under
// `-20261124` names: the team images are served with
// `cache-control: public, max-age=31536000, immutable`, so replacing the bytes
// under the old names would keep every returning browser on the old photo.
//
// This is a field-level update: it only rewrites the nine team `photo` paths
// (and the matching mediaManifest entries) with compare-and-set checks, so an
// online edit made after this manifest was reviewed cannot be overwritten.
//
//   dry run:  node scripts/apply-aivideosugc-about-team-portraits-2026-11-24.mjs --target=local
//   apply:    node scripts/apply-aivideosugc-about-team-portraits-2026-11-24.mjs --target=local --apply
//   production additionally requires --confirm=aivideosugc-about-team-portraits-2026-11-24
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const CONFIRM_NAME = "aivideosugc-about-team-portraits-2026-11-24";
const MANIFEST_PATH = new URL("./manifests/aivideosugc-about-team-portraits-2026-11-24.json", import.meta.url);
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
const siteId = assertAllowedSite(manifest.siteId);
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply");
assertDatabaseTarget({
  expectedTarget: target,
  requireProductionConfirmation: apply,
  productionConfirmed: hasArgument(`--confirm=${CONFIRM_NAME}`)
});
assert.equal(manifest.confirm, CONFIRM_NAME);
assert.equal(manifest.slug, "/about-us");
assert.equal(manifest.siteId, siteId);
assert.equal(manifest.members.length, 9, "Manifest must carry all nine team members.");

function stable(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
function hash(value) {
  return crypto.createHash("sha256").update(stable(value)).digest("hex");
}

for (const member of manifest.members) {
  assert.ok(member.name && member.before && member.after, "Every member needs name/before/after.");
  assert.notEqual(member.before, member.after, `${member.name} has no new path.`);
  const asset = path.join(process.cwd(), "public", member.after);
  assert.ok(fs.existsSync(asset), `New portrait ${member.after} is not present in public/.`);
}

const prisma = new PrismaClient();
try {
  const rows = await prisma.livePage.findMany({
    where: { siteId, slug: manifest.slug },
    select: { id: true, siteId: true, slug: true, title: true, contentJson: true }
  });
  assert.equal(rows.length, 1, `Expected exactly one ${siteId} LivePage at ${manifest.slug} on ${target}; found ${rows.length}.`);
  const row = rows[0];
  assert.equal(row.siteId, siteId, "Refusing to write outside site_aidreamcapes.");
  assert.ok(row.contentJson && typeof row.contentJson === "object", "About page contentJson is missing.");

  const current = row.contentJson;
  const groups = current?.sections?.v2_main?.settings?.data?.team?.groups;
  assert.ok(Array.isArray(groups), "About page team groups are missing.");

  const byName = new Map();
  for (const group of groups) {
    for (const member of group?.members ?? []) {
      if (member && typeof member.name === "string") byName.set(member.name, member);
    }
  }

  const plan = [];
  for (const desired of manifest.members) {
    const member = byName.get(desired.name);
    assert.ok(member, `Team member ${desired.name} is not in the published team groups.`);
    assert.ok(
      member.photo === desired.before || member.photo === desired.after,
      `${desired.name} photo changed since the reviewed dry run (${String(member.photo)}); refusing to overwrite.`
    );
    plan.push({ desired, member, changes: member.photo !== desired.after });
  }

  const media = Array.isArray(current.mediaManifest) ? current.mediaManifest : [];
  const mediaPlan = manifest.members.flatMap((desired) => {
    const item = media.find((entry) => entry && entry.src === desired.before);
    return item ? [{ desired, item, changes: item.src !== desired.after }] : [];
  });

  const next = JSON.parse(JSON.stringify(current));
  const nextGroups = next.sections.v2_main.settings.data.team.groups;
  for (const group of nextGroups) {
    for (const member of group?.members ?? []) {
      const desired = manifest.members.find((entry) => entry.name === member?.name);
      if (desired) member.photo = desired.after;
    }
  }
  if (Array.isArray(next.mediaManifest)) {
    for (const entry of next.mediaManifest) {
      const desired = manifest.members.find((member) => member.before === entry?.src);
      if (desired) entry.src = desired.after;
    }
  }
  if (next.contentContract && typeof next.contentContract === "object") {
    next.contentContract.sourceRevision = "aivideosugc-about-us-2026-11-23-team-2026-11-24";
  }

  const currentHash = hash(current);
  const nextHash = hash(next);
  const pending = plan.filter((entry) => entry.changes).length + mediaPlan.filter((entry) => entry.changes).length;

  console.log(`[about-team] mode: ${apply ? "apply" : "dry run"}; target: ${target}`);
  console.log(`[about-team] row: ${row.id} (${row.slug}) "${row.title}"`);
  console.log(`[about-team] current hash: ${currentHash}`);
  console.log(`[about-team] next hash:    ${nextHash}`);
  console.log(`[about-team] members: ${plan.length}; portraits to repoint: ${plan.filter((entry) => entry.changes).length}; media manifest rows: ${mediaPlan.length}`);
  for (const entry of plan) {
    console.log(`  ${entry.changes ? "update" : "  keep"}  ${entry.desired.name}: ${entry.member.photo.split("/").pop()} -> ${entry.desired.after.split("/").pop()}`);
  }
  for (const entry of mediaPlan) {
    if (entry.changes) console.log(`  media   ${entry.desired.name}: ${entry.desired.before.split("/").pop()} -> ${entry.desired.after.split("/").pop()}`);
  }

  if (argumentValue("--base-hash")) {
    assert.equal(currentHash, argumentValue("--base-hash"), `${manifest.slug} changed since the reviewed dry run; refusing to apply.`);
  }

  if (nextHash === currentHash || pending === 0) {
    console.log("[about-team] already in the planned state; nothing to write.");
  } else if (!apply) {
    console.log("[about-team] dry run only. Re-run with --apply to write the relational LivePage row.");
  } else {
    const updated = await prisma.livePage.update({ where: { id: row.id }, data: { contentJson: next } });
    const readback = await prisma.livePage.findUnique({ where: { id: row.id }, select: { contentJson: true } });
    assert.equal(hash(readback.contentJson), nextHash, "Readback content hash does not match the planned payload.");
    const readGroups = readback.contentJson?.sections?.v2_main?.settings?.data?.team?.groups ?? [];
    const readMembers = new Map();
    for (const group of readGroups) for (const member of group?.members ?? []) if (member?.name) readMembers.set(member.name, member);
    for (const desired of manifest.members) {
      assert.equal(readMembers.get(desired.name)?.photo, desired.after, `${desired.name} readback photo mismatch.`);
    }
    console.log(`[about-team] wrote ${row.id} at ${updated.updatedAt.toISOString()}; readback verified.`);
  }
} finally {
  await prisma.$disconnect();
}
