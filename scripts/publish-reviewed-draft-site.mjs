#!/usr/bin/env node
import createJiti from "jiti";
import "./load-runtime-env.mjs";

const { publishReviewedDraftSiteRelational } = createJiti(import.meta.url)("../src/lib/stores/theme-store.ts");

const siteId = process.env.SITE_ID?.trim() || process.argv[2]?.trim();
const actor = process.env.PUBLISH_ACTOR?.trim() || "publish:reviewed-draft-site";

if (!siteId) throw new Error("SITE_ID is required");
if (process.argv.includes("--snapshot") || process.argv.includes("--snapshot-file")) {
  throw new Error("This command never accepts a caller-provided snapshot");
}

const result = await publishReviewedDraftSiteRelational(siteId, actor);
console.log(JSON.stringify({
  ok: true,
  siteId,
  actor,
  publicationId: result.publication.id,
  publishedVersion: result.publishedVersion,
  snapshotHash: result.publication.snapshot.snapshotHash
}, null, 2));
