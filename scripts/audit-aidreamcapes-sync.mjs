import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const statePath = path.join(repoRoot, "data", "platform-state.json");
const customerAssetRoot = path.resolve(process.env.CUSTOMER_ASSET_STORAGE_ROOT || path.join(repoRoot, "data", "customer-assets"));
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));

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

function rows(table, siteId) {
  return (state[table] || []).filter((row) => row.siteId === siteId);
}

function siteById(siteId) {
  return (state.sites || []).find((site) => site.id === siteId);
}

function pageSlugSet(site) {
  return new Set((site.pages || []).map((page) => page.slug));
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
    ["privacy policy", ["/policies/privacy", "/privacy-policy"]],
    ["terms policy", ["/policies/terms", "/terms-of-service"]]
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

inspectStoreData();
inspectCodeSync();
inspectSmokeCoverage();
inspectEnvironmentHints();

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
