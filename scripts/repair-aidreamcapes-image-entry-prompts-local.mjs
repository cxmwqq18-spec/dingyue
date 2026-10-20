#!/usr/bin/env node
// Field-level repair for the current /ai-image-generation example cards.
// This never reads historical content and never writes production.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

loadRuntimeEnv();
assertDatabaseTarget({ expectedTarget: "local" });

const siteId = "site_aidreamcapes";
const slug = "/ai-image-generation";
const apply = process.argv.includes("--apply-local");
const db = new PrismaClient();
const out = "releases/aidreamcapes-image-entry-prompts-20261020";

const prompts = {
  "example-photo-hub-1-1": "A linen tote bag resting on pale beach sand beside calm water, soft coastal daylight, product-focused lifestyle photo.",
  "example-photo-hub-1-2": "A pair of summer sandals set down on warm sand near the shoreline, bright natural light, coastal product photo.",
  "example-photo-hub-2-1": "A sea-glass ceramic kettle placed on a flat desert stone, warm afternoon light, minimal product photo.",
  "example-photo-hub-2-2": "A woven hat and leather sandals arranged on a desert dune, warm sunlight, editorial product photo.",
  "example-photo-hub-3-1": "A stovetop kettle centered on a clean white studio background, soft shadows, ecommerce product photo.",
  "example-photo-hub-3-2": "A commuter backpack standing on a seamless white studio background, soft even lighting, ecommerce product photo.",
  "example-photo-hub-4-1": "A table lamp glowing on a wooden side table in a calm living room, warm evening light, lifestyle product photo.",
  "example-photo-hub-4-2": "A ceramic diffuser on a wooden table in a bright room, soft natural light, minimal lifestyle photo.",
};

const stable = (value) => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
    : value;
const hash = (value) => crypto.createHash("sha256").update(JSON.stringify(stable(value ?? null))).digest("hex");

try {
  const report = await db.$transaction(async (tx) => {
    const page = await tx.livePage.findUnique({
      where: { siteId_slug: { siteId, slug } },
      select: { id: true, slug: true, updatedAt: true, contentJson: true },
    });
    assert(page, `Missing current LivePage ${slug}`);

    const content = structuredClone(page.contentJson);
    const sectionEntry = Object.entries(content.sections ?? {}).find(([, section]) => section?.settings?.data?.examples);
    assert(sectionEntry, `Missing examples data on ${slug}`);
    const [sectionKey, section] = sectionEntry;
    const examples = section.settings.data.examples;
    const groups = Array.isArray(examples.groups) ? examples.groups : [];
    const operations = [];

    for (const [groupIndex, group] of groups.entries()) {
      const items = Array.isArray(group.items) ? group.items : [];
      for (const [itemIndex, item] of items.entries()) {
        const key = typeof item?.key === "string" ? item.key : "";
        const nextPrompt = prompts[key];
        if (!nextPrompt) continue;
        if (typeof item.prompt === "string" && item.prompt !== nextPrompt) {
          throw new Error(`Concurrent edit at examples.groups[${groupIndex}].items[${itemIndex}] (${key}); online edits win.`);
        }
        const path = `/sections/${sectionKey}/settings/data/examples/groups/${groupIndex}/items/${itemIndex}/prompt`;
        operations.push({
          id: page.id,
          slug: page.slug,
          path,
          key,
          baseHash: hash(item.prompt),
          value: nextPrompt,
        });
        item.prompt = nextPrompt;
      }
    }

    assert.equal(operations.length, Object.keys(prompts).length, "Prompt inventory changed; review the current example cards");
    const changed = hash(content) !== hash(page.contentJson);
    const manifest = {
      siteId,
      apply,
      readAt: new Date().toISOString(),
      owner: "LivePage.contentJson",
      page: { id: page.id, slug: page.slug, updatedAt: page.updatedAt.toISOString() },
      operations,
      changed,
    };

    await fs.mkdir(out, { recursive: true });
    await fs.writeFile(`${out}/${apply ? "apply" : "plan"}-manifest.json`, JSON.stringify(manifest, null, 2));

    if (apply && changed) {
      const result = await tx.livePage.updateMany({
        where: { siteId, id: page.id, updatedAt: page.updatedAt },
        data: { contentJson: content },
      });
      assert.equal(result.count, 1, `Concurrent edit on ${slug}; no write applied.`);
    }

    return {
      siteId,
      applied: apply && changed,
      slug,
      fields: operations.length,
      changed,
      historicalStateUsed: false,
    };
  }, { isolationLevel: "Serializable", timeout: 60_000 });

  await fs.writeFile(`${out}/${apply ? "applied" : "plan"}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await db.$disconnect();
}
