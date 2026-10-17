#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

loadRuntimeEnv();
assertDatabaseTarget({ expectedTarget: "local" });

const APPLY = process.argv.includes("--apply-local");
const SITE_ID = "site_aidreamcapes";
const PAGE_ID = "site_aidreamcapes_home";
const db = new PrismaClient();

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}

function hash(value) {
  return crypto.createHash("sha256").update(value === undefined ? "<undefined>" : JSON.stringify(stable(value))).digest("hex");
}

function readPath(root, path) {
  return path.split("/").filter(Boolean).reduce((value, key) => value?.[key], root);
}

function writePath(root, path, value) {
  const keys = path.split("/").filter(Boolean);
  const last = keys.pop();
  const parent = keys.reduce((value, key) => value[key] ??= {}, root);
  parent[last] = value;
}

try {
  const report = await db.$transaction(async (tx) => {
    const protectedHash = async () => hash(await tx.livePage.findMany({
      where: { siteId: "site_dreamshoot" },
      orderBy: { id: "asc" },
      select: { id: true, contentJson: true }
    }));
    const myDreamShootsBefore = await protectedHash();
    const row = await tx.livePage.findFirstOrThrow({ where: { siteId: SITE_ID, id: PAGE_ID, slug: "/" } });
    const next = structuredClone(row.contentJson);
    const data = next?.sections?.v2_main?.settings?.data;
    assert.ok(data && typeof data === "object", "Aidreamcapes home content is missing its current v2 section");
    assert.equal(data.reviews?.h2, "From One Product Photo to a Scroll-Stopping Ad", "Homepage seller showcase changed; review current LivePage before applying");

    const featureIndexes = (data.homeExperience?.blocks ?? []).map((block, index) => block.after === "features" ? index : -1).filter((index) => index >= 0);
    assert.equal(featureIndexes.length, 1, "Expected one homepage storyboard block");
    const featureIndex = featureIndexes[0];
    const feature = data.homeExperience.blocks[featureIndex];
    assert.ok(feature.copy && typeof feature.copy === "object", "Homepage storyboard copy is missing");
    assert.ok(feature.href === "/guides" || (typeof feature.href === "string" && feature.href.startsWith("/app/create?view=agent&")), "Homepage storyboard destination changed; review current LivePage before applying");
    assert.ok(feature.copy.t033 === "Browse more video guides →" || feature.copy.t033 === "Start an editable video draft →", "Homepage storyboard CTA copy changed; review current LivePage before applying");

    const desired = [
      { path: "/sections/v2_main/settings/data/reviews/cta", value: { label: "Explore more inspiration", href: "/inspiration" }, accepted: [undefined, { label: "Explore more inspiration", href: "/inspiration" }] },
      { path: `/sections/v2_main/settings/data/homeExperience/blocks/${featureIndex}/href`, value: "/guides", accepted: ["/guides", feature.href] },
      { path: `/sections/v2_main/settings/data/homeExperience/blocks/${featureIndex}/copy/t033`, value: "Browse more video guides →", accepted: ["Browse more video guides →", feature.copy.t033] }
    ];
    const operations = [];
    for (const field of desired) {
      const current = readPath(next, field.path);
      if (hash(current) === hash(field.value)) continue;
      assert.ok(field.accepted.some((value) => hash(value) === hash(current)), `Current field changed; refusing to overwrite ${field.path}`);
      operations.push({ entityType: "live_page", id: PAGE_ID, field: "contentJson", path: field.path, baseHash: hash(current), ...(current === undefined ? {} : { previousValue: current }), value: field.value });
      writePath(next, field.path, field.value);
    }

    assert.deepEqual(next.mediaManifest, row.contentJson.mediaManifest, "Homepage media must remain untouched");
    assert.deepEqual(next.sections.v2_main.settings.data.visual, row.contentJson.sections.v2_main.settings.data.visual, "Homepage visual data must remain untouched");
    if (APPLY && operations.length) {
      const result = await tx.livePage.updateMany({ where: { siteId: SITE_ID, id: PAGE_ID, slug: "/", updatedAt: row.updatedAt }, data: { contentJson: next } });
      assert.equal(result.count, 1, "Homepage changed concurrently; no content was overwritten");
      const readback = await tx.livePage.findFirstOrThrow({ where: { siteId: SITE_ID, id: PAGE_ID, slug: "/" }, select: { contentJson: true } });
      assert.equal(hash(readback.contentJson), hash(next), "LivePage.contentJson readback mismatch");
    }

    const myDreamShootsAfter = await protectedHash();
    assert.equal(myDreamShootsAfter, myDreamShootsBefore, "MyDreamShoots data changed during Aidreamcapes update");
    const relation = await tx.$queryRaw`SELECT to_regclass('public."SitePublishedState"')::text AS relation`;
    const derivedState = relation[0]?.relation
      ? await tx.sitePublishedState.findUnique({ where: { siteId: SITE_ID }, select: { revision: true, contentHash: true, updatedAt: true } })
      : null;
    return {
      ok: true,
      mode: APPLY ? "apply-local" : "plan-local",
      target: "local",
      siteId: SITE_ID,
      pageId: PAGE_ID,
      owner: "LivePage.contentJson",
      operations,
      pageRevisionBefore: hash(row.contentJson),
      pageRevisionAfter: hash(next),
      myDreamShootsHashBefore: myDreamShootsBefore,
      myDreamShootsHashAfter: myDreamShootsAfter,
      derivedState: { relation: relation[0]?.relation ?? null, record: derivedState, runtimeSource: "current relational LivePage on each SSR request" },
      historicalStateActivated: false
    };
  }, { isolationLevel: "Serializable", timeout: 60000 });
  console.log(JSON.stringify(report, null, 2));
} finally {
  await db.$disconnect();
}
