import assert from "node:assert/strict";
import crypto from "node:crypto";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";
import { assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";
import { PrismaClient } from "@prisma/client";

loadRuntimeEnv();
assertDatabaseTarget({ expectedTarget: "local" });

const SITE_ID = "site_aidreamcapes";
const PAGE_ID = "site_aidreamcapes_home";
const APPLY = hasArgument("--apply-local");
const prisma = new PrismaClient();

function digest(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

function prepareContent(contentJson) {
  const next = structuredClone(contentJson);
  const section = next?.sections?.v2_main;
  assert.equal(section?.type, "aidreamcapes_v2_page", "home must be owned by the Aidreamcapes v2 page section");
  const settings = section.settings;
  assert.equal(settings?.layout, "home", "expected the Aidreamcapes home layout");
  const data = settings?.data;
  assert.equal(data?.id, "home", "expected home page relational content");
  assert.ok(Array.isArray(data.blockOrder), "home block order must be present");
  assert.ok(data.blockOrder.includes("closing") || data.blockOrder.includes("pricing"), "home pricing copy block was not found");

  const priceFaq = data.faq?.find((item) => item.q === "How much does it cost to make an AI UGC ad?");
  assert.ok(priceFaq, "expected the existing homepage pricing FAQ");

  data.blockOrder = data.blockOrder.map((id) => id === "closing" ? "pricing" : id);
  if (!data.blockOrder.includes("pricing")) data.blockOrder.push("pricing");
  data.blockOrder = data.blockOrder.filter((id, index, all) => id !== "pricing" || all.indexOf(id) === index);
  delete data.plans;
  delete data.closing;
  data.startNote = "[See monthly and yearly plans](/pricing). You see the credit cost before every job, and if a job fails its credits go back to your balance.";
  priceFaq.a = "Choose a monthly or yearly plan based on the credits you expect to use. Each plan shows its price and included credits, and the cost of each photo or video appears before you start.";
  return next;
}

try {
  const current = await prisma.livePage.findUnique({
    where: { id: PAGE_ID },
    select: { id: true, siteId: true, slug: true, updatedAt: true, contentJson: true }
  });
  assert.ok(current, `missing Aidreamcapes home LivePage ${PAGE_ID}`);
  assert.equal(current.siteId, SITE_ID, "home page is not owned by site_aidreamcapes");
  assert.equal(current.slug, "/", "expected the Aidreamcapes home route");
  const nextContent = prepareContent(current.contentJson);
  const beforeRevision = digest(current.contentJson);
  const afterRevision = digest(nextContent);

  if (beforeRevision === afterRevision) {
    console.log(JSON.stringify({ ok: true, applied: false, unchanged: true, siteId: SITE_ID, pageId: PAGE_ID, revision: beforeRevision }, null, 2));
  } else if (!APPLY) {
    console.log(JSON.stringify({ ok: true, applied: false, dryRun: true, siteId: SITE_ID, pageId: PAGE_ID, beforeRevision, afterRevision, updatedAt: current.updatedAt }, null, 2));
  } else {
    const count = await prisma.livePage.updateMany({
      where: { id: PAGE_ID, siteId: SITE_ID, slug: "/", updatedAt: current.updatedAt },
      data: { contentJson: nextContent }
    });
    assert.equal(count.count, 1, "Aidreamcapes home changed concurrently; rerun after reviewing current data");
    const updated = await prisma.livePage.findUnique({
      where: { id: PAGE_ID },
      select: { id: true, siteId: true, slug: true, updatedAt: true, contentJson: true }
    });
    assert.ok(updated);
    assert.equal(updated.siteId, SITE_ID);
    assert.equal(digest(updated.contentJson), afterRevision, "updated LivePage did not read back the intended content");
    console.log(JSON.stringify({ ok: true, applied: true, siteId: SITE_ID, pageId: PAGE_ID, beforeRevision, afterRevision, updatedAt: updated.updatedAt }, null, 2));
  }
} finally {
  await prisma.$disconnect();
}
