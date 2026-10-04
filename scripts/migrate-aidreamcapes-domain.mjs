#!/usr/bin/env node
// Moves the Aidreamcapes storefront (site_aidreamcapes only) to www.aivideosugc.com. Dry-run by default.
//   --phase=add     add the www.aivideosugc.com and aivideosugc.com domain records (needed before a release
//                   that serves the new address can pass its checks; nothing else changes)
//   --phase=switch  make www.aivideosugc.com the primary domain (Site.primaryDomain and SiteDomain.isPrimary);
//                   the former aidreamcapes.com records stay active so those requests still reach the site and redirect
// Local:      node scripts/migrate-aidreamcapes-domain.mjs --phase=add --apply-local --confirm=site_aidreamcapes
// Production: DINGYUE_ENV=production DATABASE_TARGET=production node scripts/migrate-aidreamcapes-domain.mjs --phase=add --apply-production --confirm=production
// Before any write the site row and its domain records are backed up; after the write they are read back.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertDatabaseTarget, assertNonProductionWriteTarget, hasArgument } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes";
const NEW_PRIMARY = "www.aivideosugc.com";
const NEW_DOMAINS = [
  { id: "dom_aidreamcapes_aivideosugc_www", domain: NEW_PRIMARY },
  { id: "dom_aidreamcapes_aivideosugc_apex", domain: "aivideosugc.com" }
];
const phase = argumentValue("--phase") ?? "";
assert(["add", "switch"].includes(phase), "Choose --phase=add or --phase=switch.");
const applyLocal = hasArgument("--apply-local");
const applyProduction = hasArgument("--apply-production");
assert(!(applyLocal && applyProduction), "Choose one database write target.");
const apply = applyLocal || applyProduction;
const confirmation = argumentValue("--confirm") ?? "";
const backupRoot = argumentValue("--backup-dir") ?? path.resolve("releases/backups/aidreamcapes");
const productionDryRun = !apply && String(process.env.DATABASE_TARGET || "").trim().toLowerCase() === "production";
if (applyProduction) {
  assertDatabaseTarget({ expectedTarget: "production", requireProductionConfirmation: true, productionConfirmed: confirmation === "production" });
  assert.equal(confirmation, "production", "Production apply requires --confirm=production.");
} else if (productionDryRun) {
  assertDatabaseTarget({ expectedTarget: "production" });
} else {
  assertDatabaseTarget({ expectedTarget: "local" });
  if (apply) {
    assert.equal(confirmation, SITE_ID, `Applying requires --confirm=${SITE_ID}.`);
    assertNonProductionWriteTarget();
  }
}

const prisma = new PrismaClient();
try {
  const site = await prisma.site.findUnique({ where: { id: SITE_ID }, select: { id: true, slug: true, primaryDomain: true } });
  assert(site, `Site not found: ${SITE_ID}`);
  const domains = await prisma.siteDomain.findMany({ where: { OR: [{ siteId: SITE_ID }, { domain: { in: NEW_DOMAINS.map((item) => item.domain) } }] }, orderBy: { id: "asc" } });
  for (const row of domains) assert.equal(row.siteId, SITE_ID, `${row.domain} already belongs to ${row.siteId}`);
  const have = new Map(domains.map((row) => [row.domain, row]));
  const plan = [];
  for (const item of NEW_DOMAINS) {
    const row = have.get(item.domain);
    if (!row) plan.push({ action: "create", domain: item.domain, id: item.id });
    else if (row.status !== "active") plan.push({ action: "activate", domain: item.domain, id: row.id });
  }
  if (phase === "switch") {
    for (const row of domains) {
      const primary = row.domain === NEW_PRIMARY;
      if (row.isPrimary !== primary) plan.push({ action: primary ? "set-primary" : "unset-primary", domain: row.domain, id: row.id });
    }
    if (!have.has(NEW_PRIMARY)) plan.push({ action: "set-primary", domain: NEW_PRIMARY, id: NEW_DOMAINS[0].id });
    if (site.primaryDomain !== NEW_PRIMARY) plan.push({ action: "site-primary-domain", from: site.primaryDomain, to: NEW_PRIMARY });
  }
  if (!apply) {
    console.log(JSON.stringify({ ok: true, mode: productionDryRun ? "production-dry-run" : "dry-run", phase, site, domains: domains.map(({ id, domain, isPrimary, status }) => ({ id, domain, isPrimary, status })), plan }, null, 2));
  } else {
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    const backupPath = path.resolve(backupRoot, `domain-${phase}-${applyProduction ? "production" : "local"}-${stamp}.json`);
    await mkdir(path.dirname(backupPath), { recursive: true });
    await writeFile(backupPath, JSON.stringify({ site, domains }, null, 2) + "\n", "utf8");
    await prisma.$transaction(async (tx) => {
      for (const step of plan) {
        if (step.action === "create") await tx.siteDomain.create({ data: { id: step.id, siteId: SITE_ID, domain: step.domain, isPrimary: phase === "switch" && step.domain === NEW_PRIMARY, status: "active" } });
        else if (step.action === "activate") await tx.siteDomain.update({ where: { id: step.id }, data: { status: "active" } });
        else if (step.action === "set-primary" || step.action === "unset-primary") await tx.siteDomain.update({ where: { domain: step.domain }, data: { isPrimary: step.action === "set-primary" } });
        else if (step.action === "site-primary-domain") await tx.site.update({ where: { id: SITE_ID }, data: { primaryDomain: NEW_PRIMARY } });
      }
    });
    const after = await prisma.siteDomain.findMany({ where: { siteId: SITE_ID }, orderBy: { id: "asc" } });
    const siteAfter = await prisma.site.findUnique({ where: { id: SITE_ID }, select: { primaryDomain: true } });
    for (const item of NEW_DOMAINS) assert(after.some((row) => row.domain === item.domain && row.status === "active"), `${item.domain} readback`);
    if (phase === "switch") {
      assert.equal(siteAfter.primaryDomain, NEW_PRIMARY, "primary domain readback");
      assert.deepEqual(after.filter((row) => row.isPrimary).map((row) => row.domain), [NEW_PRIMARY], "single primary domain readback");
    }
    console.log(JSON.stringify({ ok: true, mode: applyProduction ? "production-applied" : "local-applied", phase, backupPath, plan, readback: "PASS",
      site: siteAfter, domains: after.map(({ id, domain, isPrimary, status }) => ({ id, domain, isPrimary, status })) }, null, 2));
  }
} finally {
  await prisma.$disconnect();
}
