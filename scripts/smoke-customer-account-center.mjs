#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function read(relativePath) {
  return fs.readFile(path.join(repoRoot, relativePath), "utf8");
}

async function main() {
  const [
    types,
    apiRoute,
    runtimeStore,
    assetStore,
    runtimeCache,
    dataIsland,
    shell,
    accountSurfaces
  ] = await Promise.all([
    read("src/lib/types.ts"),
    read("src/app/api/sites/[siteId]/customer/runtime/route.ts"),
    read("src/lib/stores/customer-account-runtime.ts"),
    read("src/lib/stores/asset-store.ts"),
    read("src/lib/customer-runtime-api-cache.ts"),
    read("src/components/storefront/customer-account-data-island.tsx"),
    read("src/components/storefront/customer-account-shell.tsx"),
    read("src/app/aidreamcapes-account-surfaces.css")
  ]);

  assert(types.includes("export interface ThemeRuntimePagination"), "account runtime should expose pagination metadata");
  assert(types.includes("pagination?: ThemeRuntimePagination"), "ThemeRuntimeData should carry account pagination metadata");
  assert(types.includes("fileAvailable?: boolean"), "download history entries should expose file availability");

  for (const token of [
    "function normalizeList",
    "function normalizePage",
    "function normalizePageSize",
    "pageSize === 10 || pageSize === 20 || pageSize === 50",
    "customerRuntimeApiCacheKey({ list, page, pageSize",
    "customerRuntimeSessionCache",
    "customerRuntimeSessionCacheKey",
    "createRuntimeTiming",
    "\"Server-Timing\"",
    "\"X-Account-Runtime-Cache\"",
    "timing.measure(\"adminAccess\"",
    "normalizedProfile === \"account\"",
    "result.current ?? currentForRefresh",
    "pagination: result.runtime.pagination",
    "getCustomerAccountSectionRuntimeRelational({ customer, list, measure, page, pageSize"
  ]) {
    assert(apiRoute.includes(token), `account runtime API should include ${token}`);
  }
  assert(apiRoute.includes("timing.measure(") && apiRoute.includes("\"runtime-cache\""), "account runtime API should time the runtime cache stage");

  assert(runtimeCache.includes("export const customerRuntimeSessionCache"), "customer runtime should cache session/customer lookups separately");
  assert(runtimeCache.includes("customerRuntimeSessionCache.clear"), "profile/password updates should clear cached session/customer account data");

  for (const list of ["subscriptions", "orders", "ledger", "jobs", "downloads", "albums", "models", "assets", "avatars"]) {
    assert(runtimeStore.includes(`| "${list}"`) || runtimeStore.includes(`list: "${list}"`) || runtimeStore.includes(`return "${list}"`), `runtime store should support ${list} pagination`);
  }
  for (const model of ["subscription", "order", "creditLedger", "generationJob", "album", "customerModel", "assetUpload"]) {
    assert(runtimeStore.includes(`prisma.${model}.count`), `runtime store should count ${model} before paginating`);
  }
  assert(runtimeStore.includes("type AccountRuntimeMeasure"), "runtime store should accept request-scoped timing");
  assert(runtimeStore.includes("function readPaginatedList"), "runtime store should share parallel pagination logic");
  assert(runtimeStore.includes("Promise.all(["), "runtime store should run list count and rows in parallel");
  assert(runtimeStore.includes("\"list-count\""), "runtime store should time list count");
  assert(runtimeStore.includes("\"list-rows\""), "runtime store should time list rows");
  assert(!runtimeStore.includes("const customerRecordPromise"), "paginated sections should reuse the session customer/profile instead of re-querying customer");
  assert(runtimeStore.includes("readCustomerDownloadsPageWithOptionalTable"), "download history should paginate through the optional download table");
  assert(runtimeStore.includes('orderBy: [{ createdAt: "desc" }, { id: "desc" }]'), "paginated account queries should use stable createdAt/id ordering");
  assert(runtimeStore.includes("const requestedSkip = (requestedPage - 1) * resolvedPageSize"), "paginated account queries should request the selected page immediately");
  assert(runtimeStore.includes("list-rows-corrected"), "paginated account queries should re-read only when a requested page is out of range");

  assert(assetStore.includes('asset.role === "output"'), "output asset previews should use the protected download endpoint");
  assert(assetStore.includes("download?preview=1"), "output image previews should request inline preview bytes");
  assert(assetStore.includes("&poster=1"), "output video previews should request generated posters");
  assert(assetStore.includes("`/api/local-assets/${storageKey}`"), "input and avatar previews should stay on local asset previews");

  for (const token of [
    "function PaginationControls",
    "function paginationItems",
    "aria-current",
    "Page numbers",
    "accountPrefetchTargets",
    "requestIdleCallback",
    "Showing {pagination.firstItem}-{pagination.lastItem} of {pagination.total}",
    "list=\"downloads\"",
    "list=\"assets\"",
    "list=\"avatars\"",
    "File unavailable",
    "Preview unavailable",
    "PlayCircle",
    "MediaThumb"
  ]) {
    assert(dataIsland.includes(token), `account UI should include ${token}`);
  }
  assert(!dataIsland.includes(".slice(0, 9)"), "ready assets should no longer be fixed to a client-side slice");
  assert(!dataIsland.includes("profileAssets.slice"), "profile avatar history should no longer be fixed to a client-side slice");

  for (const token of [
    "const ACCOUNT_THEME_KEY",
    "useState<\"light\" | \"dark\">",
    "data-cc-theme={mode}",
    "window.localStorage.getItem(ACCOUNT_THEME_KEY)",
    "window.localStorage.setItem(ACCOUNT_THEME_KEY",
    ">Light</button>",
    ">Dark</button>"
  ]) {
    assert(shell.includes(token), `account shell should include theme support token ${token}`);
  }
  for (const token of [
    "--account-page-bg",
    "--account-surface",
    "text-[var(--account-text)]"
  ]) {
    assert(accountSurfaces.includes(token) || shell.includes(token), `account surfaces should include theme token ${token}`);
  }
  assert(!shell.includes("bg-[#eef3f8]"), "account shell should not hard-code the light theme as the only workspace background");
}

async function runOptionalApiSmoke() {
  const origin = process.env.CUSTOMER_ACCOUNT_SMOKE_ORIGIN;
  const siteId = process.env.CUSTOMER_ACCOUNT_SMOKE_SITE_ID;
  const session = process.env.CUSTOMER_ACCOUNT_SMOKE_SESSION;
  if (!origin || !siteId || !session) return;
  const cookieName = process.env.CUSTOMER_ACCOUNT_SMOKE_COOKIE ?? `customer_session_${siteId}`;
  const sections = [
    ["credits", "ledger"],
    ["purchases", "orders"],
    ["generation", "jobs"],
    ["downloads", "downloads"],
    ["downloads", "assets"],
    ["albums", "albums"],
    ["models", "models"]
  ];
  for (const [section, list] of sections) {
    for (const page of [1, 2]) {
      const url = new URL(`/api/sites/${siteId}/customer/runtime`, origin);
      url.searchParams.set("profile", "account");
      url.searchParams.set("section", section);
      url.searchParams.set("list", list);
      url.searchParams.set("page", String(page));
      url.searchParams.set("pageSize", "20");
      const startedAt = performance.now();
      const response = await fetch(url, {
        headers: { cookie: `${cookieName}=${session}` }
      });
      const elapsed = Math.round(performance.now() - startedAt);
      assert(response.ok, `account API smoke should load ${section}/${list} page ${page}`);
      const serverTiming = response.headers.get("server-timing") ?? "";
      assert(serverTiming.includes("runtime-cache"), `account API should include Server-Timing runtime-cache for ${section}/${list}`);
      const data = await response.json();
      assert(data.ok && data.runtime, `account API should return runtime for ${section}/${list}`);
      assert(!JSON.stringify(data).includes("passwordHash"), "account API response must not expose passwordHash");
      console.log(`account api ${section}/${list} page ${page}: ${elapsed}ms; ${serverTiming}`);
    }
  }
}

main()
  .then(runOptionalApiSmoke)
  .then(() => {
    console.log("customer account center smoke passed");
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
