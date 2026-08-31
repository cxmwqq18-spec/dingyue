#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import createJiti from "jiti";
import { assertDatabaseTarget } from "./lib/database-target.mjs";
import "./load-runtime-env.mjs";

const siteId = process.env.SITE_ID?.trim() || "site_dreamshoot";
const requireDatabase = process.argv.includes("--require-db");
const rawUrl = process.env.DATABASE_URL?.trim();
if (!rawUrl) {
  const result = { ok: !requireDatabase, skipped: true, reason: "DATABASE_URL is not configured; no database was touched" };
  console.log(JSON.stringify(result, null, 2));
  if (requireDatabase) process.exitCode = 1;
} else {
  const parsed = new URL(rawUrl);
  const expectedTarget = String(process.env.DATABASE_TARGET || "local").trim().toLowerCase();
  assertDatabaseTarget({ expectedTarget });
  const { PrismaClient } = await import("@prisma/client");
  const sourceRoot = path.resolve("src");
  const originalResolveFilename = Module._resolveFilename;
  const originalLoad = Module._load;
  Module._load = function load(request, ...args) {
    if (request === "server-only") return {};
    return originalLoad.call(this, request, ...args);
  };
  Module._resolveFilename = function resolveFilename(request, ...args) {
    if (request === "server-only") return path.join(sourceRoot, "lib/storefront-context/types.ts");
    let resolved = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : request;
    if (request.startsWith("@/") && fs.existsSync(`${resolved}.ts`)) resolved = `${resolved}.ts`;
    return originalResolveFilename.call(this, resolved, ...args);
  };
  const { publicationSnapshotHash } = createJiti(import.meta.url)("../src/lib/publication-snapshot-integrity.ts");
  const { compileCurrentPublishedPayloadRelational } = createJiti(import.meta.url)("../src/lib/stores/theme-store.ts");
  const prisma = new PrismaClient();
  try {
    const cookiePage = await prisma.themePage.findUnique({
      where: { siteId_slug: { siteId, slug: "/cookies" } },
      select: { id: true, slug: true, draftJson: true, updatedAt: true }
    });
    assert.ok(cookiePage, "current relational source must contain /cookies");
    const cookieSeo = cookiePage.draftJson?.seo ?? {};
    assert.equal(cookieSeo.canonicalPath, "/cookies", "/cookies must own its canonical path");
    assert.equal(cookieSeo.canonical, "https://www.mydreamshoots.com/cookies", "/cookies canonical must be the absolute production URL");

    const current = await compileCurrentPublishedPayloadRelational(siteId, prisma);
    const projectionHash = publicationSnapshotHash(current);
    assert.equal(projectionHash, current.snapshotHash, "compiled relational projection hash must verify");
    const policyRoutes = current.publishedRoutes.filter((route) => route.routeKind === "policy" || route.routeKind === "policy-alias");
    assert.deepEqual(policyRoutes.filter((route) => route.disposition === "render").map((route) => route.canonicalPath).sort(), [
      "/children-privacy", "/content", "/cookies", "/privacy", "/refunds", "/shipping", "/state-privacy", "/terms"
    ]);
    assert.deepEqual(policyRoutes.filter((route) => route.disposition === "redirect").map((route) => route.aliasPath).sort(), [
      "/california-privacy", "/ccpa", "/children-privacy-policy", "/childrens-privacy", "/content-policy", "/cookie-policy", "/delivery-policy", "/policies/children-privacy", "/policies/content", "/policies/cookies", "/policies/privacy", "/policies/privacy-policy", "/policies/refund", "/policies/refunds", "/policies/shipping", "/policies/state-privacy", "/policies/terms", "/policies/terms-of-service", "/privacy-policy", "/refund-policy", "/shipping-policy", "/state-privacy-rights", "/terms-of-service"
    ]);
    assert.ok(policyRoutes.filter((route) => route.disposition === "redirect").every((route) => route.statusCode === 308 && route.indexable === false && route.sitemapEligible === false));
    const cookieRoute = policyRoutes.find((route) => route.disposition === "render" && route.canonicalPath === "/cookies");
    assert.ok(cookieRoute, "compiled relational projection must contain the canonical /cookies route");
    assert.equal(cookieRoute.pageId, cookiePage.id);
    assert.equal(cookieRoute.pageEntityId, "mydreamshoots:policy:cookies");
    assert.equal(cookieRoute.indexable, true);
    assert.equal(cookieRoute.sitemapEligible, true);
    for (const field of ["publishedRoutes", "publishedPageEntities", "publishedPageCopy", "publishedPageMedia", "publishedStandardPageMedia", "publishedPackFacts", "publishedOffers", "publishedFacts", "publishedCollectionRefs", "publishedLinkRefs", "revisions", "snapshotHash", "buildId"]) {
      assert.ok(field in current, `compiled relational projection missing ${field}`);
    }
    console.log(JSON.stringify({
      ok: true,
      skipped: false,
      source: "postgres-relational-draft-projection",
      siteId,
      pageId: cookiePage.id,
      pageEntityId: cookieRoute.pageEntityId,
      pageUpdatedAt: cookiePage.updatedAt,
      projectionHash,
      routeRevision: current.revisions.routeRevision,
      policyRevision: current.revisions.policyRevision,
      buildId: current.buildId
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}
