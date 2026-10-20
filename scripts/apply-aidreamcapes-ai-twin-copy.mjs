#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.join(here, "manifests", "aidreamcapes-ai-twin-copy-2026-10-20.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const siteId = assertAllowedSite(manifest.siteId);
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "";
assert(new Set(["local", "production"]).has(target), "Use --target=local or --target=production.");
const apply = hasArgument("--apply");
const confirmed = hasArgument("--confirm=site_aidreamcapes-ai-twin-copy");
assertDatabaseTarget({
  expectedTarget: target,
  requireProductionConfirmation: apply && target === "production",
  productionConfirmed: confirmed
});
if (apply) assert(confirmed, "Content apply requires --confirm=site_aidreamcapes-ai-twin-copy.");

function stable(value) {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
function hash(value) {
  return crypto.createHash("sha256").update(stable(value)).digest("hex");
}
function sectionById(sections, id) {
  const section = sections.find((item) => item?.id === id);
  assert(section, `LivePage section ${id} is missing.`);
  return section;
}

const db = new PrismaClient();
try {
  const current = await db.livePage.findUnique({
    where: { id: manifest.id },
    select: {
      id: true,
      siteId: true,
      slug: true,
      title: true,
      pageType: true,
      templateKey: true,
      contentJson: true,
      updatedAt: true
    }
  });
  assert(current, `LivePage ${manifest.id} does not exist.`);
  assert.equal(current.siteId, siteId, "LivePage site does not match the manifest.");
  assert.equal(current.slug, manifest.slug, "LivePage slug does not match the manifest.");
  const baseHash = hash(current);
  const expectedBaseHash = argumentValue("--base-hash");
  if (apply) assert.equal(expectedBaseHash, baseHash, "LivePage changed since the reviewed dry run; create a new plan.");

  const nextContentJson = structuredClone(current.contentJson ?? {});
  const data = nextContentJson?.sections?.v2_main?.settings?.data;
  assert(data && Array.isArray(data.landingSections), "LivePage is missing sections.v2_main.settings.data.landingSections.");

  for (const [key, value] of Object.entries(manifest.data)) data[key] = structuredClone(value);

  const replaceWholeCards = new Set(["twin-faq", "twin-related"]);
  for (const [id, patch] of Object.entries(manifest.sections)) {
    const section = sectionById(data.landingSections, id);
    for (const [key, value] of Object.entries(patch)) {
      if (key === "cards") {
        if (replaceWholeCards.has(id)) {
          section.cards = structuredClone(value);
          continue;
        }
        assert(Array.isArray(section.cards), `LivePage section ${id} has no cards.`);
        assert.equal(section.cards.length, value.length, `LivePage section ${id} card count changed.`);
        section.cards = section.cards.map((card, index) => ({ ...card, ...structuredClone(value[index]) }));
        continue;
      }
      section[key] = structuredClone(value);
    }
  }

  assert(nextContentJson.seo, "LivePage is missing seo.");
  assert.equal(nextContentJson.seo.canonical, current.contentJson?.seo?.canonical, "Canonical changed unexpectedly.");
  assert.equal(nextContentJson.seo.ogImage, current.contentJson?.seo?.ogImage, "OG image changed unexpectedly.");
  for (const key of ["title", "description", "keywords", "primaryKeyword", "ogImageAlt"]) {
    assert.equal(typeof manifest.seo[key], "string", `Manifest seo.${key} must be a string.`);
    nextContentJson.seo[key] = manifest.seo[key];
  }

  const canonical = nextContentJson.seo.canonical;
  const graph = Array.isArray(nextContentJson.seo.jsonLd?.["@graph"])
    ? nextContentJson.seo.jsonLd["@graph"]
    : [];
  const webpage = graph.find((node) => node?.["@type"] === "WebPage");
  if (webpage) {
    webpage.name = manifest.seo.title;
    webpage.description = manifest.seo.description;
  }
  const faqCards = sectionById(data.landingSections, "twin-faq").cards;
  const faqNode = {
    "@id": `${canonical}#faq`,
    "@type": "FAQPage",
    mainEntity: faqCards.map((card) => ({
      "@type": "Question",
      name: card.title,
      acceptedAnswer: { "@type": "Answer", text: card.body }
    }))
  };
  nextContentJson.seo.jsonLd = {
    "@graph": [...graph.filter((node) => node?.["@type"] !== "FAQPage"), faqNode]
  };
  nextContentJson.contentContract = {
    ...(nextContentJson.contentContract ?? {}),
    sourceRevision: manifest.contentContract.sourceRevision
  };

  assert.deepEqual(nextContentJson.sections.v2_main.settings.data.heroImage, current.contentJson?.sections?.v2_main?.settings?.data?.heroImage, "Hero image changed unexpectedly.");
  assert.deepEqual(nextContentJson.sections.v2_main.settings.data.secondaryImage, current.contentJson?.sections?.v2_main?.settings?.data?.secondaryImage, "Secondary image changed unexpectedly.");

  const next = { ...current, title: manifest.title, contentJson: nextContentJson };
  const changedFields = [
    ...(current.title === next.title ? [] : ["title"]),
    ...(stable(current.contentJson?.seo) === stable(nextContentJson.seo) ? [] : ["contentJson.seo"]),
    ...(stable(current.contentJson?.sections?.v2_main?.settings?.data) === stable(data) ? [] : ["contentJson.sections.v2_main.settings.data"]),
    ...(stable(current.contentJson?.contentContract) === stable(nextContentJson.contentContract) ? [] : ["contentJson.contentContract"])
  ];
  const result = {
    ok: true,
    mode: apply ? "applied" : "plan",
    target,
    siteId,
    id: current.id,
    slug: current.slug,
    liveDataOwner: "LivePage.contentJson",
    baseHash,
    nextHash: hash(next),
    changedFields,
    faqItems: faqCards.length,
    writes: apply && changedFields.length ? 1 : 0,
    derivedCache: "not written; public SSR reads the relational LivePage directly",
    preserved: ["canonical", "ogImage", "heroImage", "secondaryImage", "section images"]
  };

  if (apply && changedFields.length) {
    const update = await db.livePage.updateMany({
      where: {
        id: current.id,
        siteId,
        slug: current.slug,
        updatedAt: current.updatedAt
      },
      data: {
        title: manifest.title,
        contentJson: nextContentJson
      }
    });
    assert.equal(update.count, 1, "LivePage changed during apply; no row was updated.");
    const readback = await db.livePage.findUnique({
      where: { id: current.id },
      select: {
        id: true,
        siteId: true,
        slug: true,
        title: true,
        pageType: true,
        templateKey: true,
        contentJson: true,
        updatedAt: true
      }
    });
    assert(readback, "LivePage readback is missing.");
    assert.equal(hash({ ...readback, updatedAt: current.updatedAt }), hash(next), "LivePage readback did not match the planned content.");
    result.readback = {
      title: readback.title,
      updatedAt: readback.updatedAt,
      faqItems: readback.contentJson?.sections?.v2_main?.settings?.data?.landingSections?.find((section) => section.id === "twin-faq")?.cards?.length ?? 0
    };
  }

  console.log(JSON.stringify(result, null, 2));
} finally {
  await db.$disconnect();
}
