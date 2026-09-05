#!/usr/bin/env node
import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const SITE_ID = "site_dreamshoot";
const SLUG = "/contact-us";
const expectedPolicyHrefs = ["/privacy", "/terms", "/cookies", "/children-privacy", "/state-privacy", "/faq"];
const expectedBeforeTitles = ["Account or billing", "Upload or generation", "Privacy or content"];
const expectedProcessTitles = ["Describe the issue", "Review the details", "Follow up by email"];
const prisma = new PrismaClient();

function assertContactJson(json, label) {
  assert(json?.sections, `${label} sections are required`);
  assert.deepEqual(json.sectionsOrder, ["contact_intro_1", "contact_details_1", "conversion_1"], `${label} section order changed`);

  const intro = json.sections.contact_intro_1;
  assert.equal(intro.settings.title, "Contact myDreamshoots support.", `${label} H1 copy changed`);
  assert.equal(intro.settings.body, "Need help with an account, an upload, credits, billing, privacy, or a finished result? Contact myDreamshoots and include the details below so we can understand the request and route it to the right support path.", `${label} intro copy changed`);
  assert.equal(intro.settings.primaryCta, "Email support", `${label} primary CTA changed`);
  assert.equal(intro.settings.primaryHref, "mailto:support@mydreamshoots.com", `${label} primary href changed`);
  assert(!Object.hasOwn(intro.settings, "secondaryCta"), `${label} duplicate secondary CTA remains`);
  assert(!Object.hasOwn(intro.settings, "secondaryHref"), `${label} duplicate secondary href remains`);
  assert.deepEqual(intro.blocks.map((block) => [block.settings.meta, block.settings.title]), [
    ["Support", "support@mydreamshoots.com"],
    ["Company", "MRNARUEBET LLC"],
    ["Address", "8 THE GREEN STE B, DOVER, DE, 19901, US"]
  ], `${label} contact cards changed`);

  const details = json.sections.contact_details_1;
  assert.equal(details.settings.contactPageVariant, "support_guidance", `${label} contact renderer variant missing`);
  assert.equal(details.blocks.length, 6, `${label} support card count changed`);
  assert.deepEqual(details.blocks.slice(0, 3).map((block) => block.settings.title), expectedBeforeTitles, `${label} preparation cards changed`);
  assert.deepEqual(details.blocks.slice(3, 6).map((block) => block.settings.title), expectedProcessTitles, `${label} process cards changed`);
  assert(!JSON.stringify(details).includes("Contact information"), `${label} legacy contact information remains`);
  assert(!JSON.stringify(details).includes("LIVE_LEGAL_NAME"), `${label} unresolved legal binding remains`);

  const conversion = json.sections.conversion_1;
  assert.equal(conversion.settings.title, "Ready to create something from your photos?", `${label} conversion title changed`);
  assert.equal(conversion.settings.primaryCta, "Start creating", `${label} conversion primary CTA changed`);
  assert.equal(conversion.settings.primaryHref, "/login", `${label} conversion primary href changed`);
  assert.equal(conversion.settings.secondaryCta, "View pricing", `${label} conversion secondary CTA changed`);
  assert.equal(conversion.settings.secondaryHref, "/pricing", `${label} conversion secondary href changed`);
  assert.deepEqual(conversion.blocks.map((block) => [block.settings.value, block.settings.label]), [
    ["200", "starter credits"],
    ["15+", "live scene packs"],
    ["Private", "uploads and albums"]
  ], `${label} conversion metrics changed`);
}

try {
  const [themePage, livePage] = await Promise.all([
    prisma.themePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: SLUG } }, select: { publishedJson: true } }),
    prisma.livePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: SLUG } }, select: { contentJson: true } })
  ]);
  assert(themePage, `ThemePage missing: ${SITE_ID}${SLUG}`);
  assert(livePage, `LivePage missing: ${SITE_ID}${SLUG}`);
  assertContactJson(themePage.publishedJson, "ThemePage");
  assertContactJson(livePage.contentJson, "LivePage");

  const rendererPath = path.join(process.cwd(), "src", "components", "theme-renderer.tsx");
  const rendererSource = fs.readFileSync(rendererPath, "utf8");
  for (const href of expectedPolicyHrefs) assert(rendererSource.includes(`hrefFor(site, "${href}")`), `policy link missing from renderer: ${href}`);
  assert(rendererSource.includes('setting(section, "contactPageVariant", "") === "support_guidance"'), "contact renderer guard missing");
  console.log(JSON.stringify({ ok: true, siteId: SITE_ID, slug: SLUG, checked: ["ThemePage.publishedJson", "LivePage.contentJson", "renderer policy links"] }, null, 2));
} finally {
  await prisma.$disconnect();
}
