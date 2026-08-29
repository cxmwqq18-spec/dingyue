#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";

const repoRoot = process.cwd();
const prisma = new PrismaClient();
const packagePath = path.join(repoRoot, "package.json");
const siteRouteCanonicalPath = path.join(repoRoot, "src", "lib", "site-route-canonical.ts");
const middlewarePath = path.join(repoRoot, "src", "middleware.ts");
const hostCatchAllPath = path.join(repoRoot, "src", "app", "[...path]", "page.tsx");
const siteCatchAllPath = path.join(repoRoot, "src", "app", "site", "[siteSlug]", "[...path]", "page.tsx");

const storefrontSiteIds = ["site_dreamshoot", "site_aidreamcapes"];

const requiredDeployPrecheckCommands = [
  "npm run typecheck",
  "npm run guard:public-storefront-ssr",
  "npm run guard:live-storefront-ssr",
  "npm run guard:storefront-launch-seo-contract",
  "npm run guard:mydreamshoots-production-release",
  "npm run smoke:mydreamshoots-seo-indexing"
];
const requiredLaunchPrecheckCommands = [
  ...requiredDeployPrecheckCommands,
  "npm run smoke:public-seo-policy",
  "npm run smoke:storefront-sitemap-directory-coverage",
  "npm run smoke:storefront-head-title-order",
  "npm run smoke:storefront-seo-fingerprint"
];

const legacyPolicyAliases = [
  ["/privacy-policy", "/privacy"],
  ["/policies/privacy", "/privacy"],
  ["/policies/privacy-policy", "/privacy"],
  ["/terms-of-service", "/terms"],
  ["/policies/terms", "/terms"],
  ["/policies/terms-of-service", "/terms"],
  ["/cookie-policy", "/cookies"],
  ["/policies/cookies", "/cookies"],
  ["/policies/cookie-policy", "/cookies"],
  ["/refund-policy", "/refunds"],
  ["/policies/refund", "/refunds"],
  ["/policies/refunds", "/refunds"],
  ["/content-policy", "/content"],
  ["/policies/content", "/content"],
  ["/shipping-policy", "/shipping"],
  ["/delivery-policy", "/shipping"],
  ["/policies/shipping", "/shipping"],
  ["/policies/delivery", "/shipping"],
  ["/policies/delivery-policy", "/shipping"],
  ["/children-privacy-policy", "/children-privacy"],
  ["/childrens-privacy", "/children-privacy"],
  ["/policies/children-privacy", "/children-privacy"],
  ["/policies/children", "/children-privacy"],
  ["/policies/children-privacy-policy", "/children-privacy"],
  ["/policies/childrens-privacy", "/children-privacy"],
  ["/state-privacy-rights", "/state-privacy"],
  ["/california-privacy", "/state-privacy"],
  ["/ccpa", "/state-privacy"],
  ["/policies/state-privacy", "/state-privacy"],
  ["/policies/state-privacy-rights", "/state-privacy"],
  ["/policies/california-privacy", "/state-privacy"],
  ["/policies/ccpa", "/state-privacy"]
];

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function pageSeoValues(page) {
  const seo = (page?.draftJson ?? page?.publishedJson)?.seo ?? {};
  return {
    title: normalizeText(seo.title),
    description: normalizeText(seo.description),
    keywords: normalizeText(Array.isArray(seo.keywords) ? seo.keywords.join(",") : seo.keywords)
  };
}

async function assertRelationalLiveHomeTdk() {
  const pages = await prisma.themePage.findMany({
    where: { siteId: { in: storefrontSiteIds }, slug: "/" },
    select: { siteId: true, draftJson: true }
  });
  for (const siteId of storefrontSiteIds) {
    const page = pages.find((item) => item.siteId === siteId);
    assert.ok(page, `${siteId} relational live-draft homepage must exist`);
    const seo = pageSeoValues(page);
    assert.ok(seo.title, `${siteId} ThemePage.draftJson.seo.title must be present`);
    assert.ok(seo.description, `${siteId} ThemePage.draftJson.seo.description must be present`);
  }
}

function assertDeployPrecheck() {
  const packageJson = readJson(packagePath);
  const precheck = packageJson.scripts?.["deploy:precheck"] ?? "";
  for (const command of requiredDeployPrecheckCommands) {
    assert.ok(precheck.includes(command), `deploy:precheck must include ${command}`);
  }
  assert.ok(!/--skip-homepage-lock/.test(precheck), "deploy:precheck must not bypass the homepage lock");
  const launchPrecheck = packageJson.scripts?.["launch:storefront-precheck"] ?? "";
  for (const command of requiredLaunchPrecheckCommands) {
    assert.ok(launchPrecheck.includes(command), `launch:storefront-precheck must include ${command}`);
  }
  assert.ok(!/--skip-homepage-lock/.test(launchPrecheck), "launch:storefront-precheck must not bypass the homepage lock");
}

function assertLegacyPolicyAliases() {
  const canonicalSource = readText(siteRouteCanonicalPath);
  const middlewareSource = readText(middlewarePath);
  const hostCatchAllSource = readText(hostCatchAllPath);
  const siteCatchAllSource = readText(siteCatchAllPath);
  for (const [alias, target] of legacyPolicyAliases) {
    assert.ok(canonicalSource.includes(`"${alias}"`), `site-route-canonical must normalize ${alias}`);
    assert.ok(hostCatchAllSource.includes("legacyPublicPathTarget") && siteCatchAllSource.includes("legacyPublicPathTarget"), `published catch-all must validate ${alias} through the snapshot redirect gate`);
    assert.ok(canonicalSource.includes(`"${alias}": "${target}"`), `site-route-canonical must map ${alias} to ${target}`);
  }
  assert.ok(!/legacyPublicPathRedirect|directoryCanonicalRedirect|aidreamcapesCollectionRedirect/.test(middlewareSource), "middleware must not bypass published snapshot redirect validation");
}

await assertRelationalLiveHomeTdk();
assertDeployPrecheck();
assertLegacyPolicyAliases();

console.log(JSON.stringify({
  ok: true,
  checks: [
    "live-draft-theme-page-home-seo",
    "deploy-precheck-seo-commands",
    "legacy-policy-aliases"
  ]
}, null, 2));
process.on("exit", () => { void prisma.$disconnect(); });
