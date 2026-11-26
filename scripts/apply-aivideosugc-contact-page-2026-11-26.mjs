#!/usr/bin/env node
// /contact-us adopts the reviewed Contact Us page: the reference form and
// direct contacts, plus the company card and FAQ from the reviewed screenshots.
// This writes page copy and form/contact data only; the component ships in code.
//
//   dry run:  node scripts/apply-aivideosugc-contact-page-2026-11-26.mjs --target=local
//   apply:    node scripts/apply-aivideosugc-contact-page-2026-11-26.mjs --target=production --apply --confirm=aivideosugc-contact-page-2026-11-26
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const CONFIRM_NAME = "aivideosugc-contact-page-2026-11-26";
const SLUG = "/contact-us";
const siteId = assertAllowedSite("site_aidreamcapes");
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply");
assertDatabaseTarget({ expectedTarget: target, requireProductionConfirmation: apply, productionConfirmed: hasArgument(`--confirm=${CONFIRM_NAME}`) });
if (apply && target === "production") assert(hasArgument(`--confirm=${CONFIRM_NAME}`), `Production update requires --confirm=${CONFIRM_NAME}`);

const CONTENT = {
  h1: "Contact Us",
  subtitle: "AIVideosUGC · BLYDEY INC",
  lead: "AIVideosUGC is an AI UGC video and image ads generator. Send us a message using the form below. Select the inquiry type and the message will be addressed to the matching contact.",
  form: {
    title: "Contact Form",
    fields: [
      { name: "Full name", label: "Full name", type: "text", required: true, autocomplete: "name" },
      { name: "Email", label: "Email", type: "email", required: true, autocomplete: "email" },
      { name: "Company", label: "Company", type: "text", autocomplete: "organization" },
      {
        name: "Inquiry type",
        label: "Inquiry type",
        type: "select",
        required: true,
        options: [
          { value: "support", label: "Customer Support" },
          { value: "business", label: "Business, Partnerships & Media" },
          { value: "technical", label: "Technical" }
        ]
      },
      { name: "Subject", label: "Subject", type: "text", required: true, span2: true },
      { name: "Message", label: "Message", type: "textarea", required: true, full: true }
    ],
    button: "Send Message",
    note: "This form opens your email client and sends the message to the address selected above. You can also email us directly using the addresses listed below.",
    recipients: {
      support: "support@aivideosugc.com",
      business: "business@aivideosugc.com",
      technical: "svcs_creator@aivideosugc.com"
    }
  },
  directContacts: [
    { role: "Support", name: "AIVideosUGC", email: "support@aivideosugc.com" },
    { role: "Services", name: "Sales & Operations", email: "services@aivideosugc.com" },
    { role: "Business", name: "Business, Partnerships & Media", email: "business@aivideosugc.com" },
    { role: "Technical", name: "Account & Operations", email: "svcs_creator@aivideosugc.com" }
  ],
  footerNote: "AIVideosUGC is a brand of BLYDEYUS INC. Pricing, credit rules, and promotions are as published on the official website and are subject to change; refer to the [pricing page](/pricing) for the latest terms."
};

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
  const data = row.contentJson?.sections?.v2_main?.settings?.data;
  assert(data && typeof data === "object", "Contact row has no page data.");
  const next = structuredClone(row.contentJson);
  const nextData = next.sections.v2_main.settings.data;
  Object.assign(nextData, CONTENT);
  const changed = hash(next) !== hash(row.contentJson);
  const report = {
    ok: true,
    mode: apply ? "applied" : "plan",
    target,
    siteId,
    confirm: CONFIRM_NAME,
    page: { slug: SLUG, action: changed ? "update" : "unchanged", changed, baseHash: hash(row.contentJson), nextHash: hash(next) }
  };
  if (apply && changed) {
    const update = await db.livePage.updateMany({
      where: { id: row.id, siteId, slug: SLUG, updatedAt: row.updatedAt },
      data: { contentJson: next }
    });
    assert.equal(update.count, 1, "Contact row changed during apply.");
    const readback = await db.livePage.findFirst({ where: { id: row.id, siteId }, select: { contentJson: true } });
    assert.equal(hash(readback?.contentJson), hash(next), "Readback mismatch on /contact-us.");
    report.applied = true;
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  await db.$disconnect();
}
