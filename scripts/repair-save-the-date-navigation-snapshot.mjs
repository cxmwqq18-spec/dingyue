#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import createJiti from "jiti";

import "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

const siteId = "site_dreamshoot";
const apply = process.argv.includes("--apply");
assertDatabaseTarget({ expectedTarget: "local" });

const sourceRoot = path.resolve("src");
const originalResolveFilename = Module._resolveFilename;
const originalLoad = Module._load;
Module._load = function load(request, ...args) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...args);
};
Module._resolveFilename = function resolveFilename(request, ...args) {
  if (request === "server-only") return path.join(sourceRoot, "lib/storefront-context/types.ts");
  const resolved = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : request;
  if (request.startsWith("@/") && fs.existsSync(`${resolved}.ts`)) return originalResolveFilename.call(this, `${resolved}.ts`, ...args);
  return originalResolveFilename.call(this, resolved, ...args);
};

const jiti = createJiti(import.meta.url);
const { publicationSnapshotHash, publicationSnapshotIntegrity } = jiti("../src/lib/publication-snapshot-integrity.ts");
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

const navigationGroups = [
  {
    label: "Love & Wedding",
    slug: "love-wedding",
    paths: [
      ["/ai-save-the-date/valentines-day", "Valentine's Day"],
      ["/holidays-events/engagement", "Engagement"],
      ["/holidays-events/proposal", "Proposal"],
      ["/holidays-events/save-the-date", "Save the Date"],
      ["/holidays-events/wedding-invitation", "Wedding Invitation"],
      ["/ai-video-generation/wedding-ceremony", "Wedding Ceremony"]
    ]
  },
  {
    label: "Seasonal Holidays",
    slug: "seasonal-holidays",
    paths: [
      ["/holidays-events/christmas", "Christmas"],
      ["/holidays-events/halloween", "Halloween"],
      ["/holidays-events/thanksgiving", "Thanksgiving"],
      ["/holidays-events/new-year", "New Year"],
      ["/holidays-events/mothers-day", "Mother's Day"],
      ["/holidays-events/fathers-day", "Father's Day"]
    ]
  }
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => [key, stable(item)]));
}

function revision(value) {
  return crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex").slice(0, 20);
}

function navigationFromSnapshot(snapshot) {
  const entities = new Map(snapshot.publishedPageEntities.map((entity) => [entity.canonicalPath, entity]));
  const media = new Map(snapshot.publishedStandardPageMedia.map((item) => [item.canonicalPath, item]));
  const navigation = navigationGroups.map((group, groupIndex) => ({
    label: group.label,
    slug: group.slug,
    sortOrder: groupIndex + 1,
    items: group.paths.map(([href, label], index) => {
      const entity = entities.get(href);
      const pageMedia = media.get(href);
      assert(entity?.status === "published", `missing_published_navigation_route:${href}`);
      assert(pageMedia?.status === "ready" && pageMedia.primaryImage && pageMedia.primaryImageAlt, `missing_navigation_media:${href}`);
      return {
        label,
        slug: href.split("/").filter(Boolean).at(-1),
        href,
        status: "published",
        sortOrder: index + 1,
        description: entity.metadata.description,
        imageUrl: pageMedia.primaryImage,
        imageAlt: pageMedia.primaryImageAlt
      };
    })
  }));
  return navigation;
}

function updateHomepageShowcases(snapshot, navigation) {
  const entities = new Map(snapshot.publishedPageEntities.map((entity) => [entity.canonicalPath, entity]));
  const media = new Map(snapshot.publishedStandardPageMedia.map((item) => [item.canonicalPath, item]));
  const saveTheDate = navigation.flatMap((group) => group.items.flatMap((item) => {
    const entity = entities.get(item.href);
    const pageMedia = media.get(item.href);
    assert(entity && pageMedia, `missing_showcase_projection:${item.href}`);
    if (!entity.indexable || !entity.sitemapEligible) return [];
    return [{
      id: `homepage-save-the-date-${item.slug}`,
      kind: "save_the_date",
      pageEntityId: entity.pageEntityId,
      canonicalPath: item.href,
      title: item.label,
      subtitle: entity.metadata.description,
      category: group.label,
      sortOrder: item.sortOrder,
      imageUrl: pageMedia.primaryImage,
      imageAlt: pageMedia.primaryImageAlt,
      status: "published",
      indexable: true,
      sitemapEligible: true,
      entityRevision: entity.pageRevision,
      mediaRevision: pageMedia.revision
    }];
  }));
  const current = snapshot.publishedHomepageShowcases ?? [];
  snapshot.publishedHomepageShowcases = [
    ...current.filter((item) => item.kind === "video"),
    ...saveTheDate,
    ...current.filter((item) => item.kind === "photo")
  ];
  snapshot.revisions.homepageShowcaseRevision = revision(snapshot.publishedHomepageShowcases);
}

function repairedSnapshot(activeSnapshot) {
  const snapshot = clone(activeSnapshot);
  const groups = navigationFromSnapshot(snapshot);
  snapshot.themeSettings = {
    ...snapshot.themeSettings,
    saveTheDateNavigation: { menuLabel: "Save the Date", groups }
  };
  updateHomepageShowcases(snapshot, groups);
  snapshot.snapshotHash = "";
  snapshot.revisions.snapshotHash = "";
  snapshot.snapshotHash = publicationSnapshotHash(snapshot);
  snapshot.revisions.snapshotHash = snapshot.snapshotHash;
  assert.equal(publicationSnapshotIntegrity(snapshot), "valid", "repaired snapshot must satisfy the immutable publication contract");
  return { snapshot, groups };
}

try {
  const active = await prisma.activeThemePublication.findUnique({
    where: { siteId },
    include: { publication: true }
  });
  assert(active?.publication, "active_publication_required");
  assert.equal(publicationSnapshotIntegrity(active.publication.snapshot), "valid", "active publication must be valid before repair");
  const { snapshot, groups } = repairedSnapshot(active.publication.snapshot);
  const summary = {
    ok: true,
    mode: apply ? "applied" : "dry-run",
    siteId,
    sourcePublication: { id: active.publication.id, version: active.publication.version, snapshotHash: active.publication.snapshot.snapshotHash },
    navigation: groups.map((group) => ({ label: group.label, items: group.items.map((item) => [item.label, item.href]) })),
    targetSnapshotHash: snapshot.snapshotHash
  };

  if (apply) {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "siteId" FROM "ActiveThemePublication" WHERE "siteId" = ${siteId} FOR UPDATE`;
      const current = await tx.activeThemePublication.findUnique({ where: { siteId }, include: { publication: true } });
      assert.equal(current?.publicationId, active.publication.id, "active publication changed while repair was prepared");
      assert.equal(current?.publication.snapshot.snapshotHash, active.publication.snapshot.snapshotHash, "active snapshot changed while repair was prepared");

      const settings = await tx.themeSettings.findUnique({ where: { siteId } });
      assert(settings, "theme_settings_required");
      const nextSettings = clone(settings.publishedJson);
      nextSettings.saveTheDateNavigation = snapshot.themeSettings.saveTheDateNavigation;
      await tx.themeSettings.update({ where: { siteId }, data: { draftJson: nextSettings, publishedJson: nextSettings } });

      const latest = await tx.themePublication.findFirst({ where: { siteId }, orderBy: [{ version: "desc" }, { publishedAt: "desc" }], select: { version: true } });
      const version = (latest?.version ?? active.publication.version) + 1;
      const publicationId = `pub_${siteId}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
      const navigationHash = crypto.createHash("sha256").update(JSON.stringify(stable(snapshot.themeSettings.saveTheDateNavigation))).digest("hex");
      const approvalId = `approval_${siteId}_navigation_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
      await tx.themePublishApproval.create({
        data: {
          id: approvalId,
          siteId,
          manifestHash: `scoped-navigation-repair:${navigationHash}`,
          approvedBy: "codex:save-the-date-navigation-repair",
          items: {
            create: [{
              id: `${approvalId}_navigation`,
              objectType: "navigation",
              objectId: siteId,
              ownerId: siteId,
              revision: navigationHash,
              etag: navigationHash,
              valueHash: navigationHash
            }]
          }
        }
      });
      await tx.themePublication.create({
        data: {
          id: publicationId,
          siteId,
          version,
          snapshot,
          pageCount: snapshot.pages.length,
          sectionCount: snapshot.pages.reduce((sum, page) => sum + (page.publishedJson.sectionsOrder?.length ?? 0), 0),
          snapshotBytes: Buffer.byteLength(JSON.stringify(snapshot), "utf8"),
          scope: { type: "site", pageIds: [], includeThemeSettings: true, includeStorefrontProfile: false, repair: "save-the-date-navigation" },
          manifestHash: `scoped-navigation-repair:${navigationHash}`,
          factsRevision: snapshot.revisions.factsRevision,
          approvalId,
          publishedBy: "codex:save-the-date-navigation-repair"
        }
      });
      await tx.activeThemePublication.update({ where: { siteId }, data: { publicationId, activatedAt: new Date(), activatedBy: "codex:save-the-date-navigation-repair" } });
      await tx.themePublishApproval.update({ where: { id: approvalId }, data: { status: "consumed", consumedAt: new Date(), consumedPublicationId: publicationId } });
      await tx.auditLog.create({
        data: {
          id: `audit_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`,
          siteId,
          actorType: "site_admin",
          actorId: "codex:save-the-date-navigation-repair",
          action: "theme_save_the_date_navigation_repaired",
          targetType: "theme_publication",
          targetId: publicationId,
          metadata: { sourcePublicationId: active.publication.id, version, itemCount: 12, snapshotHash: snapshot.snapshotHash }
        }
      });
      return { publicationId, version };
    }, { timeout: 120000 });
    summary.publication = result;
  }

  console.log(JSON.stringify(summary, null, 2));
} finally {
  await prisma.$disconnect();
  Module._resolveFilename = originalResolveFilename;
  Module._load = originalLoad;
}
