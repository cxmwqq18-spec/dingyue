import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { readPlatformStateFromSql } from "./lib/platform-state-sql.mjs";

const repoRoot = process.cwd();
const customerAssetRoot = path.resolve(process.env.CUSTOMER_ASSET_STORAGE_ROOT || path.join(repoRoot, "data", "customer-assets"));
const state = await readPlatformStateFromSql();

const failures = [];
const warnings = [];
const evidence = {};

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function addFailure(message, detail) {
  failures.push(detail ? { message, detail } : { message });
}

function addWarning(message, detail) {
  warnings.push(detail ? { message, detail } : { message });
}

function assert(condition, message, detail) {
  if (!condition) addFailure(message, detail);
}

function normalizeStorageKey(storageKey) {
  return String(storageKey || "").replace(/\\/g, "/").replace(/^\/+/, "").replace(/^customer-assets\//, "");
}

function assetFileExists(storageKey) {
  const normalized = normalizeStorageKey(storageKey);
  if (!normalized || normalized.includes("..")) return false;
  const filePath = path.join(customerAssetRoot, normalized);
  return filePath.startsWith(`${customerAssetRoot}${path.sep}`) && fs.existsSync(filePath);
}

function listFilesRecursively(root) {
  const files = [];
  function walk(current, relative = "") {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      const nextRelative = path.join(relative, entry.name).replace(/\\/g, "/");
      if (entry.isDirectory()) {
        walk(absolute, nextRelative);
      } else if (entry.isFile()) {
        files.push(nextRelative);
      }
    }
  }
  walk(root);
  return files.sort();
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function rows(table, siteId) {
  return (state[table] || []).filter((row) => row.siteId === siteId);
}

function siteById(siteId) {
  return (state.sites || []).find((site) => site.id === siteId);
}

function pageSlugSet(site) {
  const slugs = new Set((site.pages || []).map((page) => page.slug));
  if (/mydreamshoots|dreamshoot|aidreamcapes/i.test(`${site.slug ?? ""} ${site.name ?? ""} ${site.primaryDomain ?? ""}`)) {
    for (const slug of ["/privacy", "/terms", "/cookies", "/refunds", "/content", "/shipping", "/children-privacy", "/state-privacy"]) {
      slugs.add(slug);
    }
  }
  return slugs;
}

function requirePageGroup(site, label, slugs) {
  const pageSlugs = pageSlugSet(site);
  assert(slugs.some((slug) => pageSlugs.has(slug)), `${site.id} missing ${label} page`, { acceptedSlugs: slugs });
}

function summarizeSite(siteId) {
  const site = siteById(siteId);
  const activeAssets = rows("assetUploads", siteId).filter((asset) => !asset.deletedAt);
  const missingAssets = activeAssets.filter((asset) => !assetFileExists(asset.storageKey));
  return {
    site: site ? {
      id: site.id,
      slug: site.slug,
      name: site.name,
      primaryDomain: site.primaryDomain,
      status: site.status,
      pages: site.pages?.length || 0
    } : undefined,
    domains: rows("siteDomains", siteId).map((domain) => ({
      domain: domain.domain,
      status: domain.status,
      isPrimary: Boolean(domain.isPrimary)
    })),
    activeCreativePacks: rows("creativePacks", siteId).filter((pack) => pack.status === "active").length,
    activeToolMenuItems: rows("toolMenuItems", siteId).filter((item) => item.status !== "inactive").length,
    activeProducts: rows("products", siteId).filter((product) => product.status === "active").length,
    enabledAiApps: rows("siteAiApps", siteId).filter((app) => app.enabled).length,
    customers: rows("customers", siteId).length,
    activeAssets: activeAssets.length,
    missingAssets: missingAssets.length,
    missingAssetSamples: missingAssets.slice(0, 8).map((asset) => ({
      id: asset.id,
      customerId: asset.customerId,
      role: asset.role,
      subjectRole: asset.subjectRole || "",
      storageKey: normalizeStorageKey(asset.storageKey)
    }))
  };
}

function inspectStoreData() {
  const dreamshoot = siteById("site_dreamshoot");
  const aidreamcapes = siteById("site_aidreamcapes");
  assert(dreamshoot, "missing mydreamshoots reference site");
  assert(aidreamcapes, "missing aidreamcapes site");
  if (!dreamshoot || !aidreamcapes) return;

  evidence.storeSummary = {
    site_dreamshoot: summarizeSite("site_dreamshoot"),
    site_aidreamcapes: summarizeSite("site_aidreamcapes")
  };

  assert(dreamshoot.status === "active", "site_dreamshoot is not active", { status: dreamshoot.status });
  assert(aidreamcapes.status === "active", "site_aidreamcapes is not active", { status: aidreamcapes.status });
  assert(aidreamcapes.primaryDomain === "www.aidreamcapes.com", "aidreamcapes primary domain is not www.aidreamcapes.com", {
    primaryDomain: aidreamcapes.primaryDomain
  });

  const aidreamcapesDomains = rows("siteDomains", "site_aidreamcapes");
  for (const domain of ["www.aidreamcapes.com", "aidreamcapes.com", "aidreamcapes.localhost"]) {
    const row = aidreamcapesDomains.find((item) => item.domain === domain);
    assert(row?.status === "active", `aidreamcapes missing active domain ${domain}`, row);
  }

  const requiredPageGroups = [
    ["home", ["/"]],
    ["login", ["/login"]],
    ["private app shell", ["/app"]],
    ["private account", ["/account"]],
    ["job progress", ["/app/jobs/progress"]],
    ["pricing", ["/pricing"]],
    ["collections", ["/collections"]],
    ["tools", ["/tools"]],
    ["workflow", ["/workflow"]],
    ["faq/help", ["/faq", "/help"]],
    ["privacy policy", ["/privacy", "/policies/privacy", "/privacy-policy"]],
    ["terms policy", ["/terms", "/policies/terms", "/terms-of-service"]]
  ];
  for (const [label, slugs] of requiredPageGroups) {
    requirePageGroup(dreamshoot, label, slugs);
    requirePageGroup(aidreamcapes, label, slugs);
  }

  const dreamshootAiApp = rows("siteAiApps", "site_dreamshoot").find((app) => app.enabled);
  const aidreamcapesAiApp = rows("siteAiApps", "site_aidreamcapes").find((app) => app.enabled);
  assert(dreamshootAiApp, "site_dreamshoot missing enabled AI app");
  assert(aidreamcapesAiApp, "site_aidreamcapes missing enabled AI app");
  if (dreamshootAiApp && aidreamcapesAiApp) {
    assert(dreamshootAiApp.creditCost === aidreamcapesAiApp.creditCost, "aidreamcapes AI app credit cost diverges from reference site", {
      dreamshoot: dreamshootAiApp.creditCost,
      aidreamcapes: aidreamcapesAiApp.creditCost
    });
    assert(Boolean(aidreamcapesAiApp.routeKey), "aidreamcapes AI app routeKey is empty");
    assert(
      aidreamcapesAiApp.aiApp?.parameterSchema?.some((field) => field.id === "outputCount" && field.options?.includes("40")),
      "aidreamcapes AI app is missing synced outputCount options"
    );
  }

  assert(evidence.storeSummary.site_aidreamcapes.activeCreativePacks >= 24, "aidreamcapes active package catalog looks under-synced", {
    activeCreativePacks: evidence.storeSummary.site_aidreamcapes.activeCreativePacks
  });
  assert(evidence.storeSummary.site_aidreamcapes.activeProducts >= 3, "aidreamcapes active products look under-synced", {
    activeProducts: evidence.storeSummary.site_aidreamcapes.activeProducts
  });

  const liveCustomer = rows("customers", "site_aidreamcapes").find((customer) => customer.email === "1621417163@qq.com");
  assert(liveCustomer, "missing aidreamcapes live customer 1621417163@qq.com");
  if (liveCustomer) {
    const liveAssets = rows("assetUploads", "site_aidreamcapes").filter((asset) => asset.customerId === liveCustomer.id && !asset.deletedAt);
    const missingLiveAssets = liveAssets.filter((asset) => !assetFileExists(asset.storageKey));
    const videoFrames = liveAssets.filter((asset) => asset.subjectRole === "video_frame");
    evidence.liveAidreamcapesCustomerAssetHealth = {
      customerId: liveCustomer.id,
      email: liveCustomer.email,
      activeAssets: liveAssets.length,
      videoFrameAssets: videoFrames.length,
      missingAssets: missingLiveAssets.length,
      missingAssetSamples: missingLiveAssets.slice(0, 8).map((asset) => ({
        id: asset.id,
        storageKey: normalizeStorageKey(asset.storageKey)
      }))
    };
    assert(liveAssets.length > 0, "aidreamcapes live customer has no asset records");
    assert(videoFrames.length > 0, "aidreamcapes live customer has no video_frame asset records");
    assert(missingLiveAssets.length === 0, "aidreamcapes live customer has DB asset records without local files", evidence.liveAidreamcapesCustomerAssetHealth);
  }
}

function inspectCodeSync() {
  const checks = [];
  function codeCheck(name, relativePath, predicate, detail) {
    const source = read(relativePath);
    const ok = Boolean(predicate(source));
    checks.push({ name, ok, file: relativePath, detail });
    assert(ok, `code sync check failed: ${name}`, { file: relativePath, detail });
  }

  codeCheck(
    "customer app upload route writes shared customer asset storage",
    "src/app/api/sites/[siteId]/customers/[customerId]/assets/route.ts",
    (source) => source.includes("writeCustomerAssetFileShared({") && source.includes("deleteCustomerAssetFileShared"),
    "Prevents aidreamcapes uploads from being stranded on one production instance."
  );
  codeCheck(
    "external v1 asset route writes shared customer asset storage",
    "src/app/api/v1/sites/[siteId]/customers/[customerId]/assets/route.ts",
    (source) => source.includes("writeCustomerAssetFileShared({"),
    "Keeps API-key upload behavior aligned with storefront uploads."
  );
  codeCheck(
    "local asset proxy supports session-scoped private reads and remote fallback",
    "src/app/api/local-assets/[...path]/route.ts",
    (source) =>
      source.includes("customerSessionCookie(siteId)") &&
      source.includes("siteAdminSessionCookie(siteId)") &&
      source.includes("hasRemoteCustomerAssetReadSource") &&
      source.includes("readRemoteAssetIntoLocalCache"),
    "Required for private aidreamcapes thumbnails on host routes."
  );
  codeCheck(
    "host storefront route renders private workspace by resolved site",
    "src/app/[...path]/page.tsx",
    (source) => source.includes("renderCustomerWorkspacePageBySlug({ siteSlug: site.slug") && source.includes('firstSegment === "app"'),
    "Required for aidreamcapes.com/app/create host-mode routing."
  );
  codeCheck(
    "customer workspace preserves uploaded video frames",
    "src/components/storefront/customer-workspace-shell.tsx",
    (source) => source.includes('subjectRole: "video_frame"') && source.includes("uploadVideoFrameFiles") && source.includes("renderFrameImagePreview"),
    "Required for the video frame UI shown in the reported screenshot."
  );
  codeCheck(
    "worker outputs use shared customer asset storage",
    "src/app/api/internal/ai-worker/dispatch/route.ts",
    (source) => source.includes("writeCustomerAssetFileShared({"),
    "Keeps generated outputs aligned with uploaded input asset storage."
  );
  codeCheck(
    "domain routing can resolve aidreamcapes hosts from siteDomains",
    "src/lib/domain-routing.ts",
    (source) => source.includes("getSiteByHostFromState") && source.includes("hostDomainCandidates"),
    "Allows aidreamcapes.com and www.aidreamcapes.com to resolve the same site."
  );
  codeCheck(
    "prebuild syncs aidreamcapes trusted logos",
    "package.json",
    (source) =>
      source.includes("\"prebuild\": \"npm run sync:aidreamcapes-trusted-logos\"") &&
      source.includes("\"sync:aidreamcapes-trusted-logos\": \"node scripts/sync-aidreamcapes-trusted-logos.mjs\""),
    "Ensures clean builds recreate the site-specific trusted-logo directory."
  );
  codeCheck(
    "trusted logo sync script mirrors the canonical source",
    "scripts/sync-aidreamcapes-trusted-logos.mjs",
    (source) =>
      source.includes("public/assets/dreamshoot/generated/trusted-logos") &&
      source.includes("public/assets/sites/site_aidreamcapes/trusted-logos"),
    "The build hook should copy the canonical logo set into the Aidreamcapes path."
  );

  const apiLatency = read("scripts/smoke-api-latency.mjs");
  if (apiLatency.includes("site_dreamshoot") && !apiLatency.includes("site_aidreamcapes")) {
    addWarning("generic API latency smoke defaults only cover site_dreamshoot", {
      file: "scripts/smoke-api-latency.mjs",
      recommendation: "Pass SMOKE_ENDPOINTS for aidreamcapes or add aidreamcapes defaults."
    });
  }

  evidence.codeSyncChecks = checks;
}

function inspectSmokeCoverage() {
  const packageJson = JSON.parse(read("package.json"));
  const scripts = packageJson.scripts || {};
  const requiredScripts = [
    "smoke:aidreamcapes-brand-links",
    "smoke:aidreamcapes-admin-workspace",
    "smoke:aidreamcapes-backend",
    "smoke:storefront-navigation-data",
    "smoke:video-workspace",
    "smoke:mydreamshoots-seo-indexing"
  ];
  const coverage = {};
  for (const script of requiredScripts) {
    coverage[script] = Boolean(scripts[script]);
    assert(coverage[script], `missing smoke script ${script}`);
  }
  evidence.smokeCoverage = coverage;
}

function inspectEnvironmentHints() {
  const envHints = {
    customerAssetStorageRoot: Boolean(process.env.CUSTOMER_ASSET_STORAGE_ROOT),
    customerAssetSharedBaseUrl: Boolean(process.env.CUSTOMER_ASSET_SHARED_BASE_URL),
    customerAssetReadBaseUrl: Boolean(process.env.CUSTOMER_ASSET_READ_BASE_URL || process.env.NEXT_PUBLIC_CUSTOMER_ASSET_READ_BASE_URL),
    customerAssetWriteBaseUrl: Boolean(process.env.CUSTOMER_ASSET_WRITE_BASE_URL),
    customerAssetTransferSecret: Boolean(process.env.CUSTOMER_ASSET_TRANSFER_SECRET || process.env.AI_WORKER_SECRET),
    nodeEnv: process.env.NODE_ENV || ""
  };
  evidence.environmentHints = envHints;
  if (!envHints.customerAssetStorageRoot && !envHints.customerAssetSharedBaseUrl && !envHints.customerAssetReadBaseUrl && !envHints.customerAssetWriteBaseUrl) {
    addWarning("no explicit customer asset shared/read/write storage env is set in this local shell", {
      recommendation: "Production should set CUSTOMER_ASSET_STORAGE_ROOT or CUSTOMER_ASSET_SHARED_BASE_URL/CUSTOMER_ASSET_READ_BASE_URL/CUSTOMER_ASSET_WRITE_BASE_URL."
    });
  }
}

function inspectTrustedLogoMirror() {
  const sourceRoot = path.join(repoRoot, "public/assets/dreamshoot/generated/trusted-logos");
  const targetRoot = path.join(repoRoot, "public/assets/sites/site_aidreamcapes/trusted-logos");
  assert(fs.existsSync(sourceRoot), "missing shared trusted-logo source directory", { sourceRoot });
  assert(fs.existsSync(targetRoot), "missing aidreamcapes trusted-logo directory", { targetRoot });
  if (!fs.existsSync(sourceRoot) || !fs.existsSync(targetRoot)) return;

  const sourceFiles = listFilesRecursively(sourceRoot);
  const targetFiles = listFilesRecursively(targetRoot);
  assert(JSON.stringify(sourceFiles) === JSON.stringify(targetFiles), "aidreamcapes trusted-logo file list diverges", {
    sourceCount: sourceFiles.length,
    targetCount: targetFiles.length,
    sourceSample: sourceFiles.slice(0, 8),
    targetSample: targetFiles.slice(0, 8)
  });

  const mismatches = [];
  for (const relative of sourceFiles) {
    const sourceFile = path.join(sourceRoot, relative);
    const targetFile = path.join(targetRoot, relative);
    if (!fs.existsSync(targetFile)) {
      mismatches.push({ relative, error: "missing_target_file" });
      continue;
    }
    if (sha256(sourceFile) !== sha256(targetFile)) {
      mismatches.push({ relative, error: "content_mismatch" });
    }
  }
  assert(mismatches.length === 0, "aidreamcapes trusted-logo contents diverge from the canonical source", {
    mismatches: mismatches.slice(0, 6)
  });
}

inspectStoreData();
inspectCodeSync();
inspectSmokeCoverage();
inspectEnvironmentHints();
inspectTrustedLogoMirror();

const report = {
  ok: failures.length === 0,
  failures,
  warnings,
  evidence,
  recommendedCommands: [
    "npm run audit:aidreamcapes-sync",
    "npm run smoke:video-workspace",
    "npm run smoke:aidreamcapes-brand-links",
    "AIDREAMCAPES_BACKEND_DB_SLOW_MS=8000 npm run smoke:aidreamcapes-backend",
    "SMOKE_ENDPOINTS='GET /api/sites/site_aidreamcapes/email,GET /site/aidreamcapes,GET /site/aidreamcapes/pricing' npm run smoke:api-latency"
  ]
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
