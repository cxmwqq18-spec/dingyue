#!/usr/bin/env node
// Replace the /guides hub content (site_aidreamcapes) with the workspace
// tutorial: one `aidreamcapes_v2_page` section with layout "guides" rendered
// by GuidesTutorialPage. Field-level change to the single LivePage row:
//   - contentJson.sections.v2_main  (section payload, old value in manifest)
//   - contentJson.seo               (title/description/keywords/ogImageAlt/twitter*)
//   - LivePage.title                (admin label)
// Nothing else on the row is touched; the 5 child guide articles and the
// sitemap entry for /guides are unaffected. Restore: --restore replays the
// manifest captured from production.
// Manifest: scripts/manifests/aidreamcapes-guides-tutorial-production-2026-11-09.json
// Dry run by default. Apply with:
//   DATABASE_TARGET=production node scripts/apply-aidreamcapes-guides-tutorial.mjs \
//     --apply --confirm=site_aidreamcapes-guides-tutorial --base-hash=<hash from dry run>
import crypto from "node:crypto";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, hasArgument } from "./lib/database-target.mjs";

const siteId = "site_aidreamcapes";
const slug = "/guides";
const manifestPath = "scripts/manifests/aidreamcapes-guides-tutorial-production-2026-11-09.json";
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "";
assert.ok(target === "local" || target === "production", "Set DATABASE_TARGET=local or DATABASE_TARGET=production.");
const production = target === "production";
const apply = hasArgument("--apply");
const restore = hasArgument("--restore");
const confirm = argumentValue("--confirm");
if (apply) {
  assert.equal(confirm, `site_aidreamcapes-guides-tutorial`, "Apply requires --confirm=site_aidreamcapes-guides-tutorial.");
  assert.ok(argumentValue("--base-hash"), "Apply requires --base-hash=<hash from dry run>.");
}

const payload = JSON.parse(fs.readFileSync("scripts/data/aidreamcapes-guides-tutorial.json", "utf8"));
const hash = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);

const prisma = new PrismaClient();
try {
  const current = await prisma.livePage.findFirst({
    where: { siteId, slug },
    select: { id: true, siteId: true, slug: true, title: true, contentJson: true, updatedAt: true }
  });
  assert.ok(current, `LivePage ${slug} not found for ${siteId}.`);
  const baseHash = hash(current);

  const contentJson = current.contentJson;
  const sectionId = "v2_main";
  const section = contentJson?.sections?.[sectionId];
  assert.equal(section?.type, "aidreamcapes_v2_page", `Unexpected section type on ${slug}: ${section?.type}`);
  const seo = contentJson?.seo && typeof contentJson.seo === "object" ? { ...contentJson.seo } : undefined;
  assert.ok(seo, "contentJson.seo missing; refusing to guess the SEO shape.");

  const manifest = {
    siteId,
    slug,
    capturedAt: new Date().toISOString(),
    target: production ? "production" : "local",
    baseHash,
    original: {
      title: current.title,
      sectionId,
      section,
      seo
    }
  };

  if (restore) {
    assert.ok(production, "--restore is production-only.");
    const saved = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    assert.equal(saved.target, "production", "Manifest was not captured from production.");
    const restoredJson = {
      ...saved.original.section ? {
        ...contentJson,
        sections: { ...contentJson.sections, [sectionId]: saved.original.section }
      } : contentJson,
      seo: saved.original.seo
    };
    console.log(JSON.stringify({ ok: true, mode: "restore", slug, restores: { title: saved.original.title, seo: saved.original.seo, sectionId } }, null, 2));
    if (apply) {
      await prisma.livePage.update({
        where: { siteId_slug: { siteId, slug } },
        data: { title: saved.original.title, contentJson: restoredJson }
      });
      console.log("Restored. The storefront serves the previous page on the next request.");
    } else {
      console.log("Dry run only. Re-run with --apply to execute the restore.");
    }
    process.exit(0);
  }

  const nextSeo = {
    ...seo,
    title: "The Workspace Guide: Create Product Videos Step by Step",
    description: payload.description,
    ogImageAlt: payload.guide.h1,
    twitterDescription: payload.description,
    ...(typeof seo.twitterTitle === "string" ? { twitterTitle: "The Workspace Guide: Create Product Videos Step by Step" } : {})
  };
  const nextSection = {
    type: "aidreamcapes_v2_page",
    settings: {
      layout: "guides",
      data: { id: "guides", h1: payload.guide.h1, guide: payload.guide }
    }
  };
  const next = {
    ...contentJson,
    seo: nextSeo,
    sections: { ...contentJson.sections, [sectionId]: nextSection }
  };

  const changedFields = [];
  if (current.title !== payload.title) changedFields.push("title");
  if (JSON.stringify(contentJson.seo) !== JSON.stringify(nextSeo)) changedFields.push("contentJson.seo");
  if (JSON.stringify(section) !== JSON.stringify(nextSection)) changedFields.push(`contentJson.sections.${sectionId}`);

  console.log(JSON.stringify({
    ok: true,
    mode: apply ? "apply" : "dry-run",
    target: production ? "production" : "local",
    slug,
    baseHash,
    nextHash: hash({ ...current, contentJson: next }),
    changedFields,
    plan: {
      title: payload.title,
      seoTitle: nextSeo.title,
      chapterCount: payload.guide.chapters.length,
      mediaCount: payload.guide.chapters.reduce((sum, chapter) => sum + (chapter.media?.length ?? 0), 0),
      sectionKeys: Object.keys(contentJson.sections)
    }
  }, null, 2));

  if (production && !apply) {
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
    console.log(`Manifest captured: ${manifestPath} (commit it before applying).`);
  }
  if (!apply) {
    console.log(`Dry run only. Apply with DATABASE_TARGET=${production ? "production" : "local"} node scripts/apply-aidreamcapes-guides-tutorial.mjs --apply --confirm=site_aidreamcapes-guides-tutorial --base-hash=${baseHash}`);
  } else {
    assert.equal(argumentValue("--base-hash"), baseHash, "Production row changed since the dry run; rerun the dry run and review the new plan.");
    await prisma.livePage.update({
      where: { siteId_slug: { siteId, slug } },
      data: { title: payload.title, contentJson: next }
    });
    console.log("Applied. The storefront serves the updated page on the next request.");
  }
} finally {
  await prisma.$disconnect();
}
