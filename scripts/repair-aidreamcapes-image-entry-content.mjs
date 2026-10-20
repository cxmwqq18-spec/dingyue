#!/usr/bin/env node
// Field-level repair for the current /ai-image-generation example cards.
// The cards keep their existing media; title, product, alt, prompt, group
// labels, and the lead are aligned with what the media actually shows.
// This never reads historical content and writes exactly one LivePage.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import {
  argumentValue,
  assertAllowedSite,
  assertDatabaseTarget,
  assertNonProductionWriteTarget,
  buildTunneledDatabaseUrl,
  hasArgument,
  parseDatabaseUrl
} from "./lib/database-target.mjs";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";

loadRuntimeEnv();

const siteId = "site_aidreamcapes";
const slug = "/ai-image-generation";
const target = argumentValue("--target") ?? "local";
const apply = hasArgument("--apply");
const confirmation = argumentValue("--confirm");
const productionConfirmed = confirmation === "site_aidreamcapes-production";

assertAllowedSite(siteId);
assert(["local", "production"].includes(target), "--target must be local or production.");

function useProductionConnection() {
  const current = parseDatabaseUrl(process.env.DATABASE_URL);
  if (current.database === "dingyue_local" || current.port === 15433) {
    assert(process.env.REMOTE_DB_DATABASE_URL, "Production reads require REMOTE_DB_DATABASE_URL or an explicit tunnel DATABASE_URL.");
    process.env.DATABASE_URL = buildTunneledDatabaseUrl(process.env.REMOTE_DB_DATABASE_URL, { host: "127.0.0.1", port: 15432 });
  }
  const tunneled = parseDatabaseUrl(process.env.DATABASE_URL);
  assert.equal(tunneled.host, "127.0.0.1", "Production database access must use the protected local tunnel.");
  assert.equal(tunneled.port, 15432, "Production database access must use port 15432.");
}

if (target === "production") {
  useProductionConnection();
  assertDatabaseTarget({ expectedTarget: "production", requireProductionConfirmation: apply, productionConfirmed });
  if (apply) assert(productionConfirmed, "Production writes require --confirm=site_aidreamcapes-production.");
} else {
  assertDatabaseTarget({ expectedTarget: "local" });
  if (apply) assertNonProductionWriteTarget();
}

const out = `releases/aidreamcapes-image-entry-content-20261020/${target}`;

const oldPrompt = {
  "example-photo-hub-1-1": "A linen tote bag resting on pale beach sand beside calm water, soft coastal daylight, product-focused lifestyle photo.",
  "example-photo-hub-1-2": "A pair of summer sandals set down on warm sand near the shoreline, bright natural light, coastal product photo.",
  "example-photo-hub-2-1": "A sea-glass ceramic kettle placed on a flat desert stone, warm afternoon light, minimal product photo.",
  "example-photo-hub-2-2": "A woven hat and leather sandals arranged on a desert dune, warm sunlight, editorial product photo.",
  "example-photo-hub-3-1": "A stovetop kettle centered on a clean white studio background, soft shadows, ecommerce product photo.",
  "example-photo-hub-3-2": "A commuter backpack standing on a seamless white studio background, soft even lighting, ecommerce product photo.",
  "example-photo-hub-4-1": "A table lamp glowing on a wooden side table in a calm living room, warm evening light, lifestyle product photo.",
  "example-photo-hub-4-2": "A ceramic diffuser on a wooden table in a bright room, soft natural light, minimal lifestyle photo.",
};

const items = {
  "example-photo-hub-1-1": {
    title: { before: "Place a Tote on the Beach", after: "Set the Sauce Bottle with Tomatoes" },
    product: { before: "linen tote bag", after: "hot sauce bottle" },
    alt: { before: "A blank glass bottle of red sauce with a black cap among tomatoes on a dark wood table.", after: "A glass bottle of red sauce with a blank label and black cap among ripe tomatoes on a dark wood table." },
    prompt: { before: oldPrompt["example-photo-hub-1-1"], after: "A glass bottle of red sauce with a blank label and black cap among ripe tomatoes on a dark wood table, soft window light, rustic product photo." },
  },
  "example-photo-hub-1-2": {
    title: { before: "Set Sandals Down on Sand", after: "Show the Sauce Bottle on White" },
    product: { before: "summer sandals", after: "hot sauce bottle" },
    alt: { before: "The same blank hot-sauce bottle centered on a pure white background.", after: "A glass bottle of red sauce with a blank label and black cap centered on a white background." },
    prompt: { before: oldPrompt["example-photo-hub-1-2"], after: "A glass bottle of red sauce with a blank label and black cap centered on a seamless white studio background, soft shadows, ecommerce product photo." },
  },
  "example-photo-hub-2-1": {
    title: { before: "Set the Kettle on Stone", after: "Splash the Pump Bottle" },
    product: { before: "sea-glass ceramic kettle", after: "blush-pink pump bottle" },
    alt: { before: "A blank blush-pink pump bottle with a splash of water around its base.", after: "A blank blush-pink pump bottle with a splash of water around its base." },
    prompt: { before: oldPrompt["example-photo-hub-2-1"], after: "A blank blush-pink pump bottle standing in shallow water with a splash around its base, warm light on a neutral surface, fresh cosmetic product photo." },
  },
  "example-photo-hub-2-2": {
    title: { before: "Lay the Hat on a Dune", after: "Show the Pump Bottle on White" },
    product: { before: "woven hat and leather sandals", after: "blush-pink pump bottle" },
    alt: { before: "The same blank pink pump bottle centered on a pure white background.", after: "A blank blush-pink pump bottle centered on a white background." },
    prompt: { before: oldPrompt["example-photo-hub-2-2"], after: "A blank blush-pink pump bottle centered on a seamless white studio background, soft shadows, clean ecommerce product photo." },
  },
  "example-photo-hub-3-1": {
    title: { before: "Show the Kettle on White", after: "Place the Blue Bottle Underwater" },
    product: { before: "stovetop kettle", after: "cobalt-blue glass bottle" },
    alt: { before: "A round cobalt-blue glass bottle with a silver cap, underwater, no label.", after: "A round cobalt-blue glass bottle with a silver cap underwater." },
    prompt: { before: oldPrompt["example-photo-hub-3-1"], after: "A round cobalt-blue glass bottle with a silver cap submerged underwater, soft ripples and refracted light, clean editorial product photo." },
  },
  "example-photo-hub-3-2": {
    title: { before: "Show a Backpack in Studio", after: "Show the Blue Bottle on White" },
    product: { before: "commuter backpack", after: "cobalt-blue glass bottle" },
    alt: { before: "The same round cobalt-blue bottle standing on a pure white background.", after: "A round cobalt-blue glass bottle with a silver cap on a white background." },
    prompt: { before: oldPrompt["example-photo-hub-3-2"], after: "A round cobalt-blue glass bottle with a silver cap on a seamless white studio background, soft even lighting, ecommerce product photo." },
  },
  "example-photo-hub-4-1": {
    title: { before: "Light the Lamp in a Room", after: "Steam the Ceramic Canister" },
    product: { before: "table lamp", after: "cream ceramic canister" },
    alt: { before: "A cream ceramic canister with a wood lid ajar and steam rising, on a wood counter.", after: "A cream ceramic canister with an open wood lid and steam rising on a wood counter." },
    prompt: { before: oldPrompt["example-photo-hub-4-1"], after: "A cream ceramic canister with its wood lid ajar and steam rising, on a warm wood kitchen counter, soft morning light, lifestyle product photo." },
  },
  "example-photo-hub-4-2": {
    title: { before: "Set a Diffuser on a Table", after: "Show the Canister on White" },
    product: { before: "ceramic diffuser", after: "cream ceramic canister" },
    alt: { before: "The same cream canister with the wood lid closed, on a pure white background.", after: "A cream ceramic canister with a closed wood lid on a white background." },
    prompt: { before: oldPrompt["example-photo-hub-4-2"], after: "A cream ceramic canister with a closed wood lid centered on a seamless white studio background, soft shadows, ecommerce product photo." },
  },
};

const groupsExpected = [
  { before: "Coastal", after: "Tabletop" },
  { before: "Desert", after: "Fresh Water" },
  { before: "Plain Studio", after: "Underwater" },
  { before: "Indoor", after: "Indoor" },
];
const leadExpected = {
  before: "Give the product a new look. Coastal, desert, plain studio, or indoor. Upload your product and name the setting.",
  after: "Give the product a new look: a tabletop scene, a splash of water, underwater, or indoors. Upload your product and name the setting.",
};

const stable = (value) => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
    : value;
const hash = (value) => crypto.createHash("sha256").update(JSON.stringify(stable(value ?? null))).digest("hex");

function valueAt(root, path) {
  return path.split("/").slice(1).reduce((value, segment) => value?.[segment], root);
}

function setAt(root, path, value) {
  const segments = path.split("/").slice(1);
  const last = segments.pop();
  const parent = segments.reduce((current, segment) => current[segment], root);
  parent[last] = value;
}

const db = new PrismaClient();
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

    const addOperation = (path, key, before, after, { allowMissing = false } = {}) => {
      const current = valueAt(content, path);
      if (current === after) return;
      if (current !== before && !(allowMissing && (current === undefined || current === null))) {
        throw new Error(`Concurrent edit at ${path} (${key}); online edits win.`);
      }
      operations.push({
        id: page.id,
        slug: page.slug,
        path,
        key,
        baseHash: hash(current),
        before: current ?? null,
        value: after,
      });
      setAt(content, path, after);
    };

    if (Object.prototype.hasOwnProperty.call(examples, "lead")) {
      addOperation(`/sections/${sectionKey}/settings/data/examples/lead`, "examples.lead", leadExpected.before, leadExpected.after);
    }

    const groupByLabel = new Map(groups.map((group, index) => [group.label, { group, index }]));
    for (const expected of groupsExpected) {
      const match = groupByLabel.get(expected.before);
      assert(match, `Missing current example group ${expected.before}`);
      addOperation(`/sections/${sectionKey}/settings/data/examples/groups/${match.index}/label`, `examples.groups.${match.index}.label`, expected.before, expected.after);
    }

    const found = new Set();
    for (const [groupIndex, group] of groups.entries()) {
      const groupItems = Array.isArray(group.items) ? group.items : [];
      for (const [itemIndex, item] of groupItems.entries()) {
        const key = typeof item?.key === "string" ? item.key : "";
        const update = items[key];
        if (!update) continue;
        found.add(key);
        const base = `/sections/${sectionKey}/settings/data/examples/groups/${groupIndex}/items/${itemIndex}`;
        addOperation(`${base}/title`, key, update.title.before, update.title.after);
        addOperation(`${base}/product`, key, update.product.before, update.product.after);
        addOperation(`${base}/prompt`, key, update.prompt.before, update.prompt.after, { allowMissing: true });
        addOperation(`${base}/image/alt`, key, update.alt.before, update.alt.after);
      }
    }

    assert.deepEqual([...found].sort(), Object.keys(items).sort(), "Image example inventory changed; review the current cards");
    const changed = hash(content) !== hash(page.contentJson);
    const manifest = {
      siteId,
      target,
      apply,
      readAt: new Date().toISOString(),
      owner: "LivePage.contentJson",
      page: { id: page.id, slug: page.slug, updatedAt: page.updatedAt.toISOString() },
      contentHash: { before: hash(page.contentJson), after: hash(content) },
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
      const readback = await tx.livePage.findUnique({ where: { siteId_slug: { siteId, slug } }, select: { contentJson: true } });
      assert.equal(hash(readback?.contentJson), hash(content), `Readback mismatch on ${slug}.`);
    }

    return {
      siteId,
      target,
      applied: apply && changed,
      slug,
      fields: operations.length,
      changed,
      contentHash: manifest.contentHash,
      historicalStateUsed: false,
      readback: apply ? "passed" : "not-applied",
    };
  }, { isolationLevel: "Serializable", timeout: 60_000 });

  await fs.writeFile(`${out}/${apply ? "applied" : "plan"}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await db.$disconnect();
}
