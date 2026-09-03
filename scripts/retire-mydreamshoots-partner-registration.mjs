#!/usr/bin/env node
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { assertDatabaseTarget, assertNonProductionWriteTarget } from "./lib/database-target.mjs";

const siteId = "site_dreamshoot";
const creatorsSlug = "/creators-circle";
const partnerSlug = "/partner-registration";
const partnerAnchorHref = "/creators-circle#partner-application";
const apply = process.argv.includes("--apply") && !process.argv.includes("--dry-run");
assertDatabaseTarget({ expectedTarget: "local" });
if (apply) assertNonProductionWriteTarget();
if (apply && !process.argv.includes("--confirm-deletion")) throw new Error("Partner Registration deletion requires --confirm-deletion.");

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right); }

function rewritePartnerHref(value) {
  if (typeof value === "string") return value === partnerSlug ? partnerAnchorHref : value;
  if (Array.isArray(value)) return value.map(rewritePartnerHref);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, rewritePartnerHref(child)]));
  return value;
}

const prisma = new PrismaClient();
try {
  const pages = await prisma.livePage.findMany({
    where: { siteId, slug: { in: [creatorsSlug, partnerSlug] } },
    select: { id: true, slug: true, contentJson: true },
    orderBy: { slug: "asc" }
  });
  const creators = pages.find((page) => page.slug === creatorsSlug);
  const partner = pages.find((page) => page.slug === partnerSlug);
  assert(creators, `Missing LivePage ${creatorsSlug}`);
  const nextCreators = clone(creators.contentJson);
  const partnerJson = partner ? clone(partner.contentJson) : { sections: {} };
  const embeddedSectionIds = ["partner_form_1", "partner_expectations_1", "trust_1"];
  nextCreators.sections = nextCreators.sections ?? {};
  nextCreators.sectionsOrder = Array.isArray(nextCreators.sectionsOrder) ? nextCreators.sectionsOrder.filter((id) => !embeddedSectionIds.includes(id)) : [];
  for (const sectionId of embeddedSectionIds) {
    const section = partnerJson.sections?.[sectionId];
    if (!section) continue;
    const nextSection = clone(section);
    if (sectionId === "partner_form_1") {
      nextSection.settings = { ...(nextSection.settings ?? {}), anchor: "partner-application", headingLevel: "h2" };
    }
    nextCreators.sections[sectionId] = nextSection;
  }
  const insertAt = Math.max(0, nextCreators.sectionsOrder.indexOf("creators_steps_1") + 1);
  nextCreators.sectionsOrder.splice(insertAt, 0, ...embeddedSectionIds.filter((id) => nextCreators.sections[id]));
  const rewrittenCreators = rewritePartnerHref(nextCreators);
  const creatorsChanged = !sameJson(creators.contentJson, rewrittenCreators);
  const allPages = await prisma.livePage.findMany({ where: { siteId }, select: { id: true, slug: true, contentJson: true } });
  const changedCtaPages = allPages.filter((page) => !sameJson(page.contentJson, rewritePartnerHref(page.contentJson)));
  if (apply) {
    await prisma.$transaction(async (tx) => {
      if (creatorsChanged) await tx.livePage.update({ where: { id: creators.id }, data: { contentJson: rewrittenCreators, updatedAt: new Date() } });
      for (const page of changedCtaPages) {
        if (page.id === creators.id) continue;
        await tx.livePage.update({ where: { id: page.id }, data: { contentJson: rewritePartnerHref(page.contentJson), updatedAt: new Date() } });
      }
      if (partner) await tx.livePage.delete({ where: { id: partner.id } });
    });
  }
  console.log(JSON.stringify({ ok: true, mode: apply ? "apply" : "dry-run", siteId, creatorsCircle: { slug: creatorsSlug, changed: creatorsChanged, sections: rewrittenCreators.sectionsOrder }, retired: { slug: partnerSlug, livePageId: partner?.id ?? null, present: Boolean(partner), deleted: Boolean(apply && partner) }, ctaPagesChanged: changedCtaPages.length, sourceOfTruth: "LivePage.contentJson" }, null, 2));
} finally {
  await prisma.$disconnect();
}
