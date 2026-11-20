#!/usr/bin/env node
// Guides P2 (approved): beginner clarity pass — cost expectations, signup
// guidance, a "New here?" learning path on the hub, next-step cards on
// URL to Video and Product Links, and first-use jargon explanations.
//
// All content-level writes, zero credits.
//
// Run from the current production release directory:
//   node scripts/apply-aidreamcapes-guides-p2-beginner.mjs
//   node scripts/apply-aidreamcapes-guides-p2-beginner.mjs --apply-production \
//     --confirm=guides-p2-beginner
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

loadRuntimeEnv();
const applying = process.argv.includes("--apply-production");
const confirmed = process.argv.includes("--confirm=guides-p2-beginner");
assertDatabaseTarget({
  expectedTarget: "production",
  requireProductionConfirmation: applying,
  productionConfirmed: applying && confirmed
});

const SITE_ID = "site_aidreamcapes";
const SLUGS = [
  "/guides",
  "/guides/how-do-text-to-video",
  "/guides/how-do-ai-video",
  "/guides/how-do-image-to-video",
  "/guides/how-do-ai-image",
  "/guides/how-do-ai-avatar",
  "/guides/how-do-subtitle-studio",
  "/guides/how-do-url-to-video",
  "/guides/how-do-product-links"
];

const stable = (v) => Array.isArray(v) ? v.map(stable)
  : v && typeof v === "object"
    ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])]))
    : v;
const hash = (v) => crypto.createHash("sha256").update(JSON.stringify(stable(v))).digest("hex");

const edits = [];
const record = (slug, field, before, after) => {
  edits.push({ slug, field, beforeHash: hash(before), afterHash: hash(after) });
};

// --- signup + cost note (same on all tool tutorials) ------------------------
const SIGNUP_NOTE = "You can draft without an account. Sign up when you're ready to generate — creating an account is free, and credits are only spent when you confirm a generation.";
const COST_NOTE_VIDEO = "A 15-second clip typically costs about 30 credits and takes 3–5 minutes to generate. The exact estimate is shown before you confirm.";
const COST_NOTE_FREE = "Saving a product page is free — no credits are spent on the import or the preview.";
const COST_NOTE_IMAGE = "A lifestyle image typically costs a few credits. The exact estimate is shown before you confirm.";
const COST_NOTE_SUBTITLE = "Generating subtitles on a completed video costs a small number of credits. The exact estimate is shown before you confirm.";

// --- next-step cards ----------------------------------------------------------
const NEXT_STEP_URL = {
  href: "/guides/how-do-text-to-video",
  label: "Ready to generate from this draft?",
  text: "The draft is your starting point. Follow Text to Video or AI Video to review the scenes and generate the clip."
};
const NEXT_STEP_PL = {
  href: "/guides/how-do-ai-video",
  label: "Your product is saved. Now build a video.",
  text: "Select the saved product in AI Video or Text to Video, add a scene direction, and generate the clip."
};

// --- hub learning path ----------------------------------------------------------
const LEARNING_PATH = {
  label: "New here? Start with what you have.",
  items: [
    { body: "Have a product page link? Start with URL to Video.", href: "/guides/how-do-url-to-video", title: "Step 1 · You have a product link" },
    { body: "Only have an idea? Start with Text to Video.", href: "/guides/how-do-text-to-video", title: "Step 2 · You have an idea" },
    { body: "Have product photos? Start with AI Video.", href: "/guides/how-do-ai-video", title: "Step 3 · You have product photos" },
    { body: "Video done? Add captions with Subtitle Studio.", href: "/guides/how-do-subtitle-studio", title: "Step 4 · Finish with captions" }
  ]
};

// --- jargon explanations (injected into the first step that uses them) --------
const JARGON = {
  storyboard: "A storyboard is a scene-by-scene outline of your video — what happens in each shot, for how long, and what is said. You can edit it before generating.",
  optimize: "Optimize rewrites your one-sentence brief into a structured scene list the video model can use. You review and edit the result before moving on.",
  estimate: "The estimate shows how many credits this generation will cost before you confirm. You are never charged without seeing the price first.",
  draft: "A draft is an editable version of the video plan — the scenes, the product details, and the settings. You can change anything before spending credits on generation.",
  references: "Reference photos are the product images you upload so the model knows exactly what your product looks like — its shape, color, label, and proportions.",
  presenter: "A presenter is an AI actor who appears on camera and speaks your script. You choose the face and the voice before generating.",
  burnedIn: "Burned-in subtitles are permanently written into the video frames, not a separate subtitle file. They appear wherever the video is played."
};

function addBeginnerNotes(howto, slug) {
  // 1. Insert the signup + cost note as a new intro paragraph
  assert.equal(Array.isArray(howto.intro), true, `${slug}: intro not an array`);
  const hasSignup = howto.intro.some((p) => p.includes("You can draft without an account"));
  if (!hasSignup) {
    const costNote = slug === "/guides/how-do-product-links" || slug === "/guides/how-do-url-to-video"
      ? COST_NOTE_FREE
      : slug === "/guides/how-do-ai-image"
      ? COST_NOTE_IMAGE
      : slug === "/guides/how-do-subtitle-studio"
      ? COST_NOTE_SUBTITLE
      : COST_NOTE_VIDEO;
    const note = `${SIGNUP_NOTE} ${costNote}`;
    record(slug, "intro signup+cost note", "", note);
    howto.intro.push(note);
  }

  // 2. Add jargon explanations to the steps that use the terms
  const stepBodies = howto.steps.map((s) => s.body);
  for (const [term, explanation] of Object.entries(JARGON)) {
    const lowerTerm = term.toLowerCase();
    for (let i = 0; i < stepBodies.length; i++) {
      if (stepBodies[i].toLowerCase().includes(lowerTerm) && !stepBodies[i].includes(explanation.slice(0, 30))) {
        const updated = stepBodies[i].replace(
          new RegExp(`(${lowerTerm})`, "i"),
          `$1 (${explanation})`
        );
        if (updated !== stepBodies[i]) {
          record(slug, `steps[${i}] jargon: ${term}`, stepBodies[i], updated);
          howto.steps[i].body = updated;
          stepBodies[i] = updated;
          break; // only explain each term once per guide
        }
      }
    }
  }
}

function editHub(hub) {
  // Add the learning path if not present
  if (!hub.learningPath) {
    record("/guides", "hub.learningPath", "", LEARNING_PATH);
    hub.learningPath = structuredClone(LEARNING_PATH);
  }
}

function editUrlToVideoNext(howto) {
  if (!howto.nextStep) {
    record("/guides/how-do-url-to-video", "nextStep", "", NEXT_STEP_URL);
    howto.nextStep = structuredClone(NEXT_STEP_URL);
  }
}

function editProductLinksNext(howto) {
  if (!howto.nextStep) {
    record("/guides/how-do-product-links", "nextStep", "", NEXT_STEP_PL);
    howto.nextStep = structuredClone(NEXT_STEP_PL);
  }
}

const db = new PrismaClient();
try {
  const rows = await db.livePage.findMany({
    where: { siteId: SITE_ID, slug: { in: SLUGS } },
    orderBy: { slug: "asc" }
  });
  assert.equal(rows.length, SLUGS.length, `expected ${SLUGS.length} rows, found ${rows.length}`);

  const nextById = new Map();
  for (const row of rows) {
    const next = structuredClone(row.contentJson);
    const data = next.sections.v2_main.settings.data;

    if (row.slug === "/guides") {
      editHub(data.hub);
    } else {
      const howto = data.howto;
      addBeginnerNotes(howto, row.slug);
      if (row.slug === "/guides/how-do-url-to-video") editUrlToVideoNext(howto);
      if (row.slug === "/guides/how-do-product-links") editProductLinksNext(howto);
    }
    nextById.set(row.id, next);
  }

  // Sync seo.jsonLd HowTo steps with updated step text
  for (const row of rows) {
    if (row.slug === "/guides") continue;
    const next = nextById.get(row.id);
    const howto = next.sections.v2_main.settings.data.howto;
    const graph = next.seo.jsonLd["@graph"];
    const howtoNode = graph.find((n) => n["@type"] === "HowTo");
    if (howtoNode && howtoNode.step) {
      howtoNode.step = howto.steps.map((step) => ({
        ...(howtoNode.step.find((c) => c.name === step.title) ?? {}),
        name: step.title,
        text: step.body
      }));
    }
  }

  const manifestDoc = {
    siteId: SITE_ID,
    generatedAt: new Date().toISOString(),
    applying,
    editCount: edits.length,
    pages: SLUGS,
    edits
  };
  const manifestDir = process.env.MANIFEST_DIR
    ? path.resolve(process.env.MANIFEST_DIR)
    : path.join(process.cwd(), "scripts", "manifests");
  fs.mkdirSync(manifestDir, { recursive: true });
  const manifestPath = path.join(manifestDir, `aivideosugc-guides-p2-beginner-${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifestDoc, null, 2)}\n`);

  if (!applying) {
    console.log(JSON.stringify({ pages: SLUGS, editCount: edits.length, manifestPath }, null, 2));
    console.error(`dry run: ${edits.length} field edit(s) across ${SLUGS.length} page(s)`);
    process.exit(0);
  }

  const otherBefore = hash(await db.livePage.findMany({
    where: { siteId: { not: SITE_ID } },
    orderBy: { id: "asc" },
    select: { id: true, contentJson: true }
  }));
  let applied = 0;
  for (const row of rows) {
    const next = nextById.get(row.id);
    const result = await db.livePage.updateMany({
      where: { siteId: SITE_ID, id: row.id, updatedAt: row.updatedAt },
      data: { contentJson: next }
    });
    assert.equal(result.count, 1, `${row.slug}: CAS failed`);
    const readback = await db.livePage.findFirstOrThrow({ where: { siteId: SITE_ID, id: row.id } });
    assert.equal(hash(readback.contentJson), hash(next), `${row.slug}: readback mismatch`);
    applied += 1;
  }
  const otherAfter = hash(await db.livePage.findMany({
    where: { siteId: { not: SITE_ID } },
    orderBy: { id: "asc" },
    select: { id: true, contentJson: true }
  }));
  assert.equal(otherBefore, otherAfter, "other-site rows changed");

  console.log(JSON.stringify({ applied, editCount: edits.length, manifestPath }, null, 2));
} finally {
  await db.$disconnect();
}
