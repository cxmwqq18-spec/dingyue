#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const statePath = path.join(repoRoot, "data", "platform-state.json");
const packagePath = path.join(repoRoot, "package.json");
const homepageLockPath = path.join(repoRoot, "docs", "content-locks", "mydreamshoots-homepage-approved.json");
const launchChecklistPath = path.join(repoRoot, "docs", "storefront-launch-checklist.md");
const siteRouteCanonicalPath = path.join(repoRoot, "src", "lib", "site-route-canonical.ts");
const middlewarePath = path.join(repoRoot, "src", "middleware.ts");

const approvedHomeSeo = {
  site_dreamshoot: {
    title: "Professional AI Photo Generator Online - myDreamshoots",
    description: "Turn your selfies into stunning couple photos in seconds with myDreamshoots – the most advanced AI photo generator maker. No studio, no outfits, just magic.",
    keywords: "Dream Shoots,Wedding Photoshoot,Travel Selfies,Free AI Photos,Free Photo Generator,AI Couple Photo,AI Headshot"
  },
  site_aidreamcapes: {
    title: "AIdreamcapes – the most advanced AI photo generator maker",
    description: "Transform your favorite moments into professional-grade photos and stunning memories with AIdreamcapes. Choose any setting, outfit, or vibe – all from home.",
    keywords: "Dream Photos,Dream Photoshoot,Wedding Photoshoot,Wedding Photos,AI Photos,AI Photoshoot,Couple Photos"
  }
};

const requiredDeployPrecheckCommands = [
  "npm run typecheck",
  "npm run guard:storefront-launch-seo-contract",
  "npm run smoke:mydreamshoots-seo-indexing",
  "npm run guard:mydreamshoots-content"
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

function homePageForSite(site) {
  return (site.pages ?? []).find((page) => page.slug === "/" || page.pageType === "home");
}

function pageSeoValues(page) {
  const seo = page?.publishedJson?.seo ?? {};
  return {
    title: normalizeText(seo.title),
    description: normalizeText(seo.description),
    keywords: normalizeText(Array.isArray(seo.keywords) ? seo.keywords.join(",") : seo.keywords)
  };
}

function settingsSeoValues(site, page) {
  const seo = site.themeSettings?.publishedJson?.seo?.pages?.[page?.id] ?? site.themeSettings?.publishedJson?.seo?.pages?.[page?.slug] ?? {};
  return {
    title: normalizeText(seo.title),
    description: normalizeText(seo.description),
    keywords: normalizeText(Array.isArray(seo.keywords) ? seo.keywords.join(",") : seo.keywords)
  };
}

function assertSeoMatches(siteId, sourceLabel, actual) {
  const expected = approvedHomeSeo[siteId];
  assert.deepEqual(actual, expected, `${sourceLabel} must match the approved homepage TDK baseline`);
}

function assertApprovedHomeTdk(state) {
  for (const [siteId] of Object.entries(approvedHomeSeo)) {
    const site = (state.sites ?? []).find((item) => item.id === siteId);
    assert.ok(site, `${siteId} must exist in platform-state`);
    const home = homePageForSite(site);
    assert.ok(home, `${siteId} homepage must exist in platform-state`);
    assertSeoMatches(siteId, `${siteId} page.publishedJson.seo`, pageSeoValues(home));
    assertSeoMatches(siteId, `${siteId} themeSettings seo.pages`, settingsSeoValues(site, home));
  }
}

function latestPublicationForSite(state, siteId) {
  return (state.themePublications ?? [])
    .filter((publication) => publication.siteId === siteId)
    .sort((left, right) => Number(right.version ?? 0) - Number(left.version ?? 0))[0];
}

function assertPublicationHomeTdk(state) {
  for (const [siteId] of Object.entries(approvedHomeSeo)) {
    const publication = latestPublicationForSite(state, siteId);
    assert.ok(publication, `${siteId} latest ThemePublication snapshot must exist`);
    const home = homePageForSite({ pages: publication.snapshot?.pages ?? [] });
    assert.ok(home, `${siteId} latest ThemePublication snapshot must include homepage`);
    assertSeoMatches(siteId, `${siteId} latest ThemePublication homepage seo`, pageSeoValues(home));
  }
}

function assertHomepageLock() {
  const lock = readJson(homepageLockPath);
  assert.equal(lock.site?.id, "site_dreamshoot", "MyDreamShoots homepage lock must belong to site_dreamshoot");
  assert.equal(lock.page?.slug, "/", "MyDreamShoots homepage lock must describe the homepage");
  assert.match(lock.fingerprints?.publishedJsonSha256 ?? "", /^[0-9a-f]{64}$/i, "MyDreamShoots homepage lock must contain a publishedJson hash");
  assert.match(lock.fingerprints?.visibleTextSha256 ?? "", /^[0-9a-f]{64}$/i, "MyDreamShoots homepage lock must contain a visible text hash");
  assert.deepEqual(
    {
      title: normalizeText(lock.seo?.title),
      description: normalizeText(lock.seo?.description),
      keywords: normalizeText(lock.seo?.keywords)
    },
    approvedHomeSeo.site_dreamshoot,
    "MyDreamShoots homepage lock TDK must match the approved launch TDK"
  );
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

function assertLaunchChecklistRules() {
  const checklist = readText(launchChecklistPath);
  const lock = readJson(homepageLockPath);
  assert.ok(checklist.includes("没有站点负责人明确允许，不得随意改动网站文案、SEO 文案、TDK"), "launch checklist must keep the copy and TDK approval rule");
  assert.ok(checklist.includes("MyDreamShoots 首页 `/` 的当前线上已批准文案已锁定"), "launch checklist must keep the MyDreamShoots homepage lock rule");
  assert.ok(checklist.includes("active 但当前 robots 为 `noindex` 的详情目录必须保留页面 `noindex`，并从 sitemap 排除"), "launch checklist must keep sitemap/noindex separation");
  assert.ok(checklist.includes(lock.fingerprints?.publishedJsonSha256 ?? ""), "launch checklist homepage publishedJson hash must match the current lock file");
  assert.ok(checklist.includes(lock.fingerprints?.visibleTextSha256 ?? ""), "launch checklist homepage visible text hash must match the current lock file");
}

function assertLegacyPolicyAliases() {
  const canonicalSource = readText(siteRouteCanonicalPath);
  const middlewareSource = readText(middlewarePath);
  for (const [alias, target] of legacyPolicyAliases) {
    assert.ok(canonicalSource.includes(`"${alias}"`), `site-route-canonical must normalize ${alias}`);
    assert.ok(middlewareSource.includes(`"${alias}": "${target}"`) || middlewareSource.includes(`"${alias}"`), `middleware must redirect ${alias} to ${target}`);
  }
}

const state = readJson(statePath);
assertApprovedHomeTdk(state);
assertPublicationHomeTdk(state);
assertHomepageLock();
assertDeployPrecheck();
assertLaunchChecklistRules();
assertLegacyPolicyAliases();

console.log(JSON.stringify({
  ok: true,
  checks: [
    "approved-home-tdk",
    "publication-home-tdk",
    "homepage-lock-hashes",
    "deploy-precheck-seo-commands",
    "launch-checklist-contract",
    "legacy-policy-aliases"
  ]
}, null, 2));
