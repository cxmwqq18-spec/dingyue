#!/usr/bin/env node
// Align the /contact-us form control names with the isolated /api/contact
// payload (name/email/company/inquiry/subject/message). Labels stay unchanged.
// This is a field-level manifest against the current relational row.
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const CONFIRM_NAME = "aivideosugc-contact-field-names-2026-11-26";
const SLUG = "/contact-us";
const FIELD_NAMES = ["name", "email", "company", "inquiry", "subject", "message"];
const siteId = assertAllowedSite("site_aidreamcapes");
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply");
assertDatabaseTarget({ expectedTarget: target, requireProductionConfirmation: apply, productionConfirmed: hasArgument(`--confirm=${CONFIRM_NAME}`) });

function stable(value) {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
const hash = (value) => crypto.createHash("sha256").update(stable(value)).digest("hex");

const db = new PrismaClient();
try {
  const row = await db.livePage.findFirst({ where: { siteId, slug: SLUG }, select: { id: true, contentJson: true, updatedAt: true } });
  assert(row, `Contact row ${SLUG} not found on ${target}.`);
  const next = structuredClone(row.contentJson);
  const fields = next?.sections?.v2_main?.settings?.data?.form?.fields;
  assert(Array.isArray(fields) && fields.length === FIELD_NAMES.length, "Contact form field count changed.");
  fields.forEach((field, index) => { field.name = FIELD_NAMES[index]; });
  const changed = hash(next) !== hash(row.contentJson);
  const report = {
    ok: true,
    mode: apply ? "applied" : "plan",
    target,
    siteId,
    page: { slug: SLUG, action: changed ? "update" : "unchanged", changed, names: FIELD_NAMES, baseHash: hash(row.contentJson), nextHash: hash(next) }
  };
  if (apply && changed) {
    const update = await db.livePage.updateMany({ where: { id: row.id, siteId, slug: SLUG, updatedAt: row.updatedAt }, data: { contentJson: next } });
    assert.equal(update.count, 1, "Contact row changed during apply.");
    const readback = await db.livePage.findFirst({ where: { id: row.id, siteId }, select: { contentJson: true } });
    assert.equal(hash(readback?.contentJson), hash(next), "Readback mismatch on /contact-us.");
    report.applied = true;
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  await db.$disconnect();
}
