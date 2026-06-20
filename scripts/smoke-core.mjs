const base = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";

function isTransientFetchError(error) {
  const code = error?.cause?.code ?? error?.code;
  const message = String(error?.message ?? "");
  return (
    error instanceof TypeError &&
    ["ECONNRESET", "ECONNREFUSED", "UND_ERR_SOCKET"].includes(code) &&
    (message.includes("fetch failed") || message.includes("terminated"))
  );
}

async function request(path, { method = "GET", body, cookie, headers = {}, allowFailure = false, transientRetries = 0 } = {}) {
  const normalizedMethod = method.toUpperCase();
  const maxAttempts = normalizedMethod === "GET" || normalizedMethod === "HEAD" ? 4 : Math.max(1, transientRetries + 1);
  let response;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      response = await fetch(`${base}${path}`, {
        method: normalizedMethod,
        headers: {
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(cookie ? { cookie } : {}),
          ...headers
        },
        body: body ? JSON.stringify(body) : undefined,
        redirect: "manual"
      });
      break;
    } catch (error) {
      if (attempt >= maxAttempts || !isTransientFetchError(error)) throw error;
      await sleep(350 * attempt);
    }
  }
  if (!response) throw new Error(`${normalizedMethod} ${path} did not return a response`);
  const json = await response.clone().json().catch(() => ({}));
  if (!allowFailure && !response.ok) {
    throw new Error(`${normalizedMethod} ${path} failed: ${response.status} ${JSON.stringify(json)}`);
  }
  return { response, json };
}

async function post(path, body, options = {}) {
  return request(path, { ...options, method: "POST", body });
}

async function put(path, body, options = {}) {
  return request(path, { ...options, method: "PUT", body });
}

async function patch(path, body, options = {}) {
  return request(path, { ...options, method: "PATCH", body });
}

async function del(path, body, options = {}) {
  return request(path, { ...options, method: "DELETE", body, transientRetries: options.transientRetries ?? 3 });
}

async function get(path, options = {}) {
  return request(path, options);
}

function cookieFrom(response, name) {
  const raw = response.headers.get("set-cookie") ?? "";
  const cookie = raw.split(",").find((part) => part.trim().startsWith(`${name}=`))?.trim().split(";")[0] ?? raw.split(";")[0];
  if (!cookie || !cookie.includes("=")) throw new Error(`missing ${name} cookie`);
  return cookie;
}

async function expectStatus(path, status, options = {}) {
  const { response, json } = await request(path, { ...options, allowFailure: true });
  if (response.status !== status) {
    throw new Error(`${path} expected ${status}, got ${response.status} ${JSON.stringify(json)}`);
  }
  return { response, json };
}

async function expectHtml(path, markers, options = {}) {
  const result = await get(path, options);
  if (!result.response.ok) throw new Error(`${path} did not render`);
  const html = await result.response.text();
  for (const marker of markers) {
    if (!html.includes(marker)) throw new Error(`${path} missing marker: ${marker}`);
  }
  return html;
}

function expectNoHtmlMarkers(html, markers, context) {
  for (const marker of markers) {
    if (html.includes(marker)) throw new Error(`${context} leaked internal customer-facing marker: ${marker}`);
  }
}

function stableStorefrontHtml(html) {
  return html
    .replace(/<script>self\.__next_f\.push\([\s\S]*?<\/script>/g, "")
    .replace(/\?v=\d+/g, "?v=[dev-build]")
    .replace(/:N\d+(?:\.\d+)?/g, ":N[dev-render]")
    .replace(/"start":-?\d+(?:\.\d+)?,"end":-?\d+(?:\.\d+)?/g, "\"start\":[dev-timing],\"end\":[dev-timing]")
    .replace(/\\"start\\":-?\d+(?:\.\d+)?,\\"end\\":-?\d+(?:\.\d+)?/g, "\\\"start\\\":[dev-timing],\\\"end\\\":[dev-timing]");
}

const themeWorkspaceMarkers = [
  "data-theme-sections-root",
  "data-section-type=\"ai_feature_launcher\"",
  "data-section-type=\"upload_panel\"",
  "data-section-type=\"generation_form\"",
  "data-section-type=\"job_progress\"",
  "data-section-type=\"album_gallery\""
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resetPlatformStateWithRetry(attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await post("/api/platform/state", { reset: true }, { headers: { "x-smoke-reset": "true" } });
      return;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(300 * attempt);
    }
  }
  throw lastError;
}

async function runSmoke() {
const report = {};

await resetPlatformStateWithRetry();
report.reset = "ok";

const atlasFront = await get("/site/atlas");
if (!atlasFront.response.ok) {
  throw new Error("atlas storefront did not render after reset");
}
const atlasFrontHtml = await atlasFront.response.text();
for (const marker of ["<title>Atlas</title>", "/site/atlas", "--site-bg:#f4f7f1", "--site-accent:#4f6f52", "Atlas Copy Foundry"]) {
  if (!atlasFrontHtml.includes(marker)) throw new Error(`atlas storefront missing site-isolated marker: ${marker}`);
}
if (atlasFrontHtml.includes(">Lumen</span>")) {
  throw new Error("atlas storefront leaked Lumen brand text into the site header");
}
report.atlasIsolation = {
  title: "Atlas",
  accent: "#4f6f52"
};

await expectStatus("/platform", 307);
await expectStatus("/api/platform/sites", 401);
const { response: platformLoginResponse, json: platformLogin } = await post("/api/platform/auth/login", {
  email: "platform@local.test",
  password: "platform123"
});
const platformCookie = cookieFrom(platformLoginResponse, "platform_session");
if (platformLogin.platformAdmin?.email !== "platform@local.test" || platformLogin.platformAdmin?.passwordHash) {
  throw new Error("platform login did not return a safe platform admin");
}
const platformPage = await get("/platform", { cookie: platformCookie });
if (!platformPage.response.ok) throw new Error("platform route did not open after login");
const platformHtml = await platformPage.response.text();
for (const marker of ["Operate every DreamShoot-style AI studio", "SaaS operating model", "Tenant factory", "Create a new client studio", "Connect readiness", "Recent platform activity", "data-admin-command-bar=\"saas-style\"", "data-admin-layout=\"saas-advanced-admin-shell\"", "data-admin-layout=\"saas-command-workspace\"", "data-admin-layout=\"saas-left-module-rail\"", "data-admin-layout=\"saas-premium-backoffice-grid\"", "data-admin-layout=\"xfcart-module-tree\"", "data-admin-toolbar=\"xfcart-modern-topbar\"", "data-admin-tabs=\"xfcart-workspace-tabs\"", "current operating module", "module index", "高级店铺后台矩阵", "站点边界", "收款账本", "装修发布", "AI 工厂", "平台后台", "平台总览", "站点工厂", "收款订阅", "AI 网关", "审计风控"]) {
  if (!platformHtml.includes(marker)) throw new Error(`platform dashboard missing marker: ${marker}`);
}
report.platformAuth = { email: platformLogin.platformAdmin.email };

const { response: bridgedAdminResponse, json: bridgedAdmin } = await post(
  "/api/platform/sites/site_lumen/admin-bridge",
  {},
  { cookie: platformCookie }
);
if (bridgedAdmin.siteSlug !== "lumen" || bridgedAdmin.siteAdmin?.email !== "owner@lumen.localhost") {
  throw new Error("platform to site admin bridge did not resolve a target site admin");
}
const bridgedAdminCookie = cookieFrom(bridgedAdminResponse, "site_admin_session_site_lumen");
await expectHtml("/site/lumen/admin", ["AI Wedding 店铺后台", "概览工作台"], {
  cookie: `${platformCookie}; ${bridgedAdminCookie}`
});
const bridgedSettings = await get("/api/platform/sites/site_lumen/admin-bridge?path=%2Fadmin%2Fsettings", {
  cookie: platformCookie,
  allowFailure: true
});
if (bridgedSettings.response.status !== 307) {
  throw new Error("platform to site admin settings bridge did not redirect");
}
const bridgedSettingsCookie = cookieFrom(bridgedSettings.response, "site_admin_session_site_lumen");
await expectHtml("/site/lumen/admin/settings", ["站点设置", "站点配置中心", "新增后台账号"], {
  cookie: `${platformCookie}; ${bridgedSettingsCookie}`
});
report.platformSiteAdminBridge = {
  siteSlug: bridgedAdmin.siteSlug,
  adminEmail: bridgedAdmin.siteAdmin.email,
  settingsPath: "/admin/settings"
};

const { json: newSite } = await post(
  "/api/platform/sites",
  {
    name: "Nova Image Studio",
    slug: "nova-smoke",
    ownerEmail: "owner@nova-smoke.localhost",
    ownerPassword: "nova-smoke123",
    sourceSiteId: "site_lumen"
  },
  { cookie: platformCookie }
);
if (newSite.site?.id !== "site_nova-smoke" || newSite.products?.length < 1 || newSite.siteAiApps?.length < 1) {
  throw new Error("platform site clone did not initialize products and AI apps");
}
const clonedState = await get("/api/platform/sites", { cookie: platformCookie });
const clonedSiteSummary = clonedState.json.sites?.find((site) => site.id === newSite.site.id);
if (!clonedSiteSummary?.pages?.length && !newSite.site.pages?.length) {
  throw new Error("platform site clone did not copy theme pages");
}
const clonedPages = clonedSiteSummary?.pages ?? newSite.site.pages ?? [];
if (clonedPages.length) {
  const uniquePageIds = new Set(clonedPages.map((page) => page.id));
  if (uniquePageIds.size !== clonedPages.length) {
    throw new Error("cloned site page ids are not unique");
  }
}
if (newSite.admin?.passwordHash) {
  throw new Error("site create leaked admin password hash");
}
const newSiteFront = await get(`/site/${newSite.site.slug}`);
const newSiteAdminBlocked = await get(`/site/${newSite.site.slug}/admin`, { allowFailure: true });
if (!newSiteFront.response.ok || newSiteAdminBlocked.response.status !== 307) {
  throw new Error("new cloned site front/admin auth routing is wrong");
}
const newSiteFrontHtml = await newSiteFront.response.text();
for (const marker of ["AI-Powered Wedding Photos in Any Destination", "Tired of These Wedding Photo Problems?", "Loved by Couples Worldwide", "Your Love Story, Anywhere.", "data-section-type=\"pricing_table\"", "Choose your wedding story package.", "Essential", "Premium", "Deluxe"]) {
  if (!newSiteFrontHtml.includes(marker)) throw new Error(`cloned storefront missing wedding storefront module: ${marker}`);
}
for (const marker of ["Site pricing records", "Connected to current pricing", ">Settlement<", "Total grant volume"]) {
  if (newSiteFrontHtml.includes(marker)) throw new Error(`cloned storefront leaked backend pricing copy: ${marker}`);
}
const clonedSubscriptionProducts = newSite.products?.filter((product) => product.type === "subscription") ?? [];
const clonedPriceMetadata = clonedSubscriptionProducts.map((product) => product.prices?.[0]?.metadata ?? {});
for (const marker of [
  ["generatedPhotos", 15],
  ["generatedPhotos", 30],
  ["generatedPhotos", 60],
  ["destinationCount", 999],
  ["deliveryDays", 1],
  ["revisions", "priority"]
]) {
  if (!clonedPriceMetadata.some((metadata) => metadata?.[marker[0]] === marker[1])) {
    throw new Error(`cloned storefront pricing data did not copy price metadata: ${marker[0]}=${marker[1]}`);
  }
}
for (const marker of ["Nova", `/site/${newSite.site.slug}`]) {
  if (!newSiteFrontHtml.includes(marker)) throw new Error(`cloned storefront missing cloned-site marker: ${marker}`);
}
if (newSiteFrontHtml.includes(">Lumen</span>")) {
  throw new Error("cloned storefront leaked source-site Lumen brand text into the site header");
}
const { json: newDomain } = await post(
  `/api/platform/sites/${newSite.site.id}/domains`,
  { domain: "nova-smoke.example.com", isPrimary: false },
  { cookie: platformCookie }
);
if (newDomain.domain?.domain !== "nova-smoke.example.com") {
  throw new Error("new site domain was not persisted");
}
report.platformSiteClone = {
  siteId: newSite.site.id,
  slug: newSite.site.slug,
  products: newSite.products.length,
  aiApps: newSite.siteAiApps.length,
  domain: newDomain.domain.domain
};

const platformSiteSettingsPayload = {
  name: "Nova Control Studio",
  status: "active",
  currency: "EUR",
  timezone: "Europe/Berlin",
  branding: {
    logoText: "Nova Control",
    market: "AI portrait subscriptions",
    description: "Platform-managed storefront for smoke coverage."
  },
  connect: {
    stripeAccountId: "acct_nova_control_ready",
    status: "enabled",
    chargesEnabled: true,
    payoutsEnabled: true
  }
};
const { json: platformSettingsUpdate } = await put(
  `/api/platform/sites/${newSite.site.id}/settings`,
  platformSiteSettingsPayload,
  { cookie: platformCookie }
);
if (
  platformSettingsUpdate.site?.name !== platformSiteSettingsPayload.name ||
  platformSettingsUpdate.site?.branding?.logoText !== platformSiteSettingsPayload.branding.logoText ||
  platformSettingsUpdate.site?.connect?.stripeAccountId !== platformSiteSettingsPayload.connect.stripeAccountId ||
  platformSettingsUpdate.site?.connect?.chargesEnabled !== true ||
  platformSettingsUpdate.site?.currency !== "EUR"
) {
  throw new Error("platform site settings update did not persist");
}
const refreshedPlatformState = await get("/api/platform/sites", { cookie: platformCookie });
const refreshedPlatformSite = refreshedPlatformState.json.sites?.find((site) => site.id === newSite.site.id);
if (
  refreshedPlatformSite?.name !== platformSiteSettingsPayload.name ||
  refreshedPlatformSite?.branding?.logoText !== platformSiteSettingsPayload.branding.logoText ||
  refreshedPlatformSite?.connect?.status !== "enabled" ||
  refreshedPlatformSite?.connect?.payoutsEnabled !== true
) {
  throw new Error("platform site registry did not reflect updated site settings");
}
report.platformSiteSettings = {
  siteId: newSite.site.id,
  name: platformSettingsUpdate.site.name,
  logoText: platformSettingsUpdate.site.branding.logoText,
  connectStatus: platformSettingsUpdate.site.connect.status,
  currency: platformSettingsUpdate.site.currency
};

await expectStatus(`/site/${newSite.site.slug}/admin`, 307);
const { response: newSiteAdminLoginResponse, json: newSiteAdminLogin } = await post(`/api/sites/${newSite.site.id}/admin/auth/login`, {
  email: "owner@nova-smoke.localhost",
  password: "nova-smoke123"
});
const newSiteAdminCookie = cookieFrom(newSiteAdminLoginResponse, `site_admin_session_${newSite.site.id}`);
if (newSiteAdminLogin.siteAdmin?.email !== "owner@nova-smoke.localhost" || newSiteAdminLogin.siteAdmin?.passwordHash) {
  throw new Error("new site admin login did not return a safe admin");
}
const newSiteAdminPage = await get(`/site/${newSite.site.slug}/admin`, { cookie: newSiteAdminCookie });
const newSiteAdminHtml = await newSiteAdminPage.response.text();
if (
  !newSiteAdminHtml.includes("Nova Control Studio 店铺后台") ||
  !newSiteAdminHtml.includes("概览工作台") ||
  !newSiteAdminHtml.includes("店铺装修") ||
  !newSiteAdminHtml.includes("商品套餐") ||
  !newSiteAdminHtml.includes("订单订阅") ||
  !newSiteAdminHtml.includes("顾客资产") ||
  !newSiteAdminHtml.includes("data-admin-layout=\"saas-command-workspace\"") ||
  !newSiteAdminHtml.includes("data-admin-layout=\"saas-left-module-rail\"") ||
  !newSiteAdminHtml.includes("data-admin-layout=\"xfcart-module-tree\"")
) {
  throw new Error("new site admin dashboard did not render the improved backend shell");
}
const { json: gatewayUpdate } = await put(
  `/api/sites/${newSite.site.id}/gateway-groups/${newSite.gatewayGroup.id}`,
  {
    ...newSite.gatewayGroup,
    status: "active",
    monthlyQuota: 9000,
    modelAllowlist: ["gpt-image-2", "gpt-4.1-mini", "claude-3-7-sonnet"],
    retryStatusCodes: [429, 500, 502, 503],
    rateLimitPerMinute: 45,
    accountPoolMode: "dedicated",
    unavailableReason: ""
  },
  { cookie: newSiteAdminCookie }
);
if (gatewayUpdate.gatewayGroup?.monthlyQuota !== 9000 || gatewayUpdate.gatewayGroup?.accountPoolMode !== "dedicated") {
  throw new Error("gateway policy update did not persist");
}
report.newSiteAdminAuth = {
  adminEmail: newSiteAdminLogin.siteAdmin.email,
  gatewayQuota: gatewayUpdate.gatewayGroup.monthlyQuota
};

const { json: adminAddedDomain } = await post(
  `/api/sites/${newSite.site.id}/domains`,
  { domain: "admin-nova.example.com", isPrimary: false },
  { cookie: newSiteAdminCookie }
);
if (adminAddedDomain.domain?.domain !== "admin-nova.example.com") {
  throw new Error("site admin domain add did not persist");
}
const { json: primaryDomainUpdate } = await patch(
  `/api/sites/${newSite.site.id}/domains/${adminAddedDomain.domain.id}`,
  { isPrimary: true },
  { cookie: newSiteAdminCookie }
);
if (!primaryDomainUpdate.domain?.isPrimary || primaryDomainUpdate.site?.primaryDomain !== "admin-nova.example.com") {
  throw new Error("site admin primary domain switch did not persist");
}
const { json: deletedDomain } = await request(
  `/api/sites/${newSite.site.id}/domains/${adminAddedDomain.domain.id}`,
  { method: "DELETE", cookie: newSiteAdminCookie }
);
if (deletedDomain.deletedDomain?.domain !== "admin-nova.example.com") {
  throw new Error("site admin domain delete did not persist");
}
const clonedPrice = newSite.products?.[0]?.prices?.[0];
if (!clonedPrice) {
  throw new Error("new cloned site is missing a seed price for admin CRUD smoke");
}
const clonedPriceLabel = `${clonedPrice.label} Clone Smoke`;
const { json: clonedPriceUpdate } = await put(
  `/api/sites/${newSite.site.id}/products/${clonedPrice.productId}/prices/${clonedPrice.id}`,
  {
    ...clonedPrice,
    label: clonedPriceLabel,
    amountCents: clonedPrice.amountCents + 200,
    creditsGranted: clonedPrice.creditsGranted + 1
  },
  { cookie: newSiteAdminCookie }
);
if (clonedPriceUpdate.price?.label !== clonedPriceLabel || clonedPriceUpdate.price?.creditsGranted !== clonedPrice.creditsGranted + 1) {
  throw new Error("cloned site product price update did not persist");
}

const newSiteStorefrontRoutes = [
  {
    path: `/site/${newSite.site.slug}/pricing`,
    markers: ["data-theme-sections-root", "Credits", "xfcart-section-header_plus"]
  },
  {
    path: `/site/${newSite.site.slug}/help`,
    markers: ["data-theme-sections-root", "xfcart-section-footer_plus"]
  },
  {
    path: `/site/${newSite.site.slug}/blog`,
    markers: ["data-theme-sections-root", "xfcart-section-header_plus"]
  },
  {
    path: `/site/${newSite.site.slug}/tools/image-studio`,
    markers: ["data-theme-sections-root", "xfcart-section-header_plus"]
  },
  {
    path: `/site/${newSite.site.slug}/collections`,
    markers: ["data-theme-sections-root", "xfcart-section-header_plus"]
  },
  {
    path: `/site/${newSite.site.slug}/search`,
    markers: ["data-theme-sections-root", "xfcart-section-header_plus"]
  },
  {
    path: `/site/${newSite.site.slug}/cart`,
    markers: ["data-theme-sections-root", "xfcart-section-header_plus"]
  }
];
for (const route of newSiteStorefrontRoutes) {
  await expectHtml(route.path, route.markers);
}
const newSiteAdminRouteChecks = [
  { path: `/site/${newSite.site.slug}/admin/themes`, markers: ["SaaS fc_themes control room", "data-admin-layout=\"saas-command-workspace\""] },
  { path: `/site/${newSite.site.slug}/admin/settings`, markers: ["站点设置", "站点配置中心", "新增后台账号", "后台账号列表"] }
];
for (const route of newSiteAdminRouteChecks) {
  await expectHtml(route.path, route.markers, { cookie: newSiteAdminCookie });
}
const { json: createdScopedAdmin } = await post(
  `/api/sites/${newSite.site.id}/admins`,
  {
    email: "ops@nova-smoke.localhost",
    displayName: "Ops",
    role: "admin",
    password: "ops12345",
    actor: "site_admin_demo"
  },
  { cookie: newSiteAdminCookie }
);
if (createdScopedAdmin.admin?.email !== "ops@nova-smoke.localhost" || createdScopedAdmin.admin?.role !== "admin") {
  throw new Error("site admin create did not persist");
}
const { json: updatedScopedAdmin } = await patch(
  `/api/sites/${newSite.site.id}/admins/${createdScopedAdmin.admin.id}`,
  {
    displayName: "Ops Lead",
    role: "support",
    password: "ops54321",
    actor: "site_admin_demo"
  },
  { cookie: newSiteAdminCookie }
);
if (updatedScopedAdmin.admin?.displayName !== "Ops Lead" || updatedScopedAdmin.admin?.role !== "support") {
  throw new Error("site admin update did not persist");
}
const { json: deletedScopedAdmin } = await request(
  `/api/sites/${newSite.site.id}/admins/${createdScopedAdmin.admin.id}`,
  {
    method: "DELETE",
    body: { actor: "site_admin_demo" },
    cookie: newSiteAdminCookie
  }
);
if (deletedScopedAdmin.deletedAdmin?.email !== "ops@nova-smoke.localhost") {
  throw new Error("site admin delete did not persist");
}
const { response: newSiteCustomerLoginResponse, json: newSiteCustomerLogin } = await post(`/api/sites/${newSite.site.id}/auth/login`, {
  email: "mara@northpier.studio",
  password: "nova-smoke123",
  name: "Mara Voss"
});
const newSiteCustomerCookie = cookieFrom(newSiteCustomerLoginResponse, `customer_session_${newSite.site.id}`);
if (
  !newSiteCustomerLogin.createdCustomer ||
  !newSiteCustomerLogin.customer?.id ||
  newSiteCustomerLogin.customer.id === "cust_lumen_mara" ||
  newSiteCustomerLogin.customer.passwordHash
) {
  throw new Error("new cloned site did not create a site-scoped customer for the same email");
}
await expectHtml(`/site/${newSite.site.slug}/app`, themeWorkspaceMarkers, {
  cookie: newSiteCustomerCookie
});
report.newSiteCustomerIsolation = {
  customerId: newSiteCustomerLogin.customer.id,
  createdCustomer: newSiteCustomerLogin.createdCustomer,
  balance: newSiteCustomerLogin.customer.balance
};

await expectStatus("/site/lumen/admin", 307);
await expectStatus("/api/sites/site_lumen/ai/apps/sai_lumen_image", 401, {
  method: "PUT",
  body: { enabled: true, creditCost: 18, routeKey: "n8n.image.v2" }
});
const { response: lumenAdminLoginResponse, json: lumenAdminLogin } = await post("/api/sites/site_lumen/admin/auth/login", {
  email: "owner@lumen.localhost",
  password: "lumen123"
});
const lumenAdminCookie = cookieFrom(lumenAdminLoginResponse, "site_admin_session_site_lumen");
if (lumenAdminLogin.siteAdmin?.passwordHash) throw new Error("lumen admin login leaked password hash");
const lumenAdminPage = await get("/site/lumen/admin", { cookie: lumenAdminCookie });
const lumenAdminHtml = await lumenAdminPage.response.text();
for (const marker of ["Launch checklist", "Business lanes", "经营控制台", "模块工作台", "像店铺 SaaS 一样分模块操作", "订单、支付和 AI 任务趋势", "当前站点隔离状态", "data-admin-command-bar=\"saas-style\"", "data-admin-layout=\"saas-advanced-admin-shell\"", "data-admin-layout=\"saas-command-workspace\"", "data-admin-layout=\"saas-left-module-rail\"", "data-admin-layout=\"saas-premium-backoffice-grid\"", "data-admin-layout=\"xfcart-module-tree\"", "data-admin-layout=\"saas-mobile-module-switcher\"", "data-admin-toolbar=\"xfcart-modern-topbar\"", "data-admin-tabs=\"xfcart-workspace-tabs\"", "current operating module", "module index", "高级店铺后台矩阵", "站点边界", "收款账本", "装修发布", "AI 工厂", "概览工作台", "店铺装修", "商品套餐", "订单订阅", "顾客资产", "内容运营", "设置收款", "AI 工厂"]) {
  if (!lumenAdminHtml.includes(marker)) throw new Error(`lumen admin dashboard missing marker: ${marker}`);
}
for (const marker of ["Stripe Connect", "主题发布", "真实套餐", "AI worker", "客户交付", "Credits", "Jobs", "Albums", "Audit"]) {
  if (!lumenAdminHtml.includes(marker)) throw new Error(`lumen admin operational panel missing marker: ${marker}`);
}
if (lumenAdminHtml.includes("passwordHash")) {
  throw new Error("site admin page leaked password hashes into rendered HTML");
}
await get("/site/lumen/admin/design", { cookie: lumenAdminCookie });
report.lumenAdminAuth = { email: lumenAdminLogin.siteAdmin.email };

const lumenThemesPage = await get("/site/lumen/admin/themes", { cookie: lumenAdminCookie });
const lumenThemesHtml = await lumenThemesPage.response.text();
for (const marker of ["SaaS fc_themes control room", "Draft theme", "Active storefront theme", "Publication history", "Theme copies", "installed themes", "Original SaaS theme library", "Add default SaaS theme", "data-admin-command-bar=\"saas-style\""]) {
  if (!lumenThemesHtml.includes(marker)) throw new Error(`theme manager page missing marker: ${marker}`);
}
const lumenMediaPage = await get("/site/lumen/admin/media", { cookie: lumenAdminCookie });
const lumenMediaHtml = await lumenMediaPage.response.text();
for (const marker of ["Theme media library", "SaaS media library", "site media operations", "资源列表", "装修素材", "添加资源", "当前资源预览", "data-admin-media=\"saas-source-library\"", "data-admin-media-grid=\"saas-source-cards\""]) {
  if (!lumenMediaHtml.includes(marker)) throw new Error(`media library page missing marker: ${marker}`);
}
const adminRouteChecks = [
  { path: "/site/lumen/admin/products", markers: ["商品与套餐", "套餐与价格中心"] },
  { path: "/site/lumen/admin/orders", markers: ["订单与订阅", "Credits 账本与支付事件"] },
  { path: "/site/lumen/admin/customers", markers: ["顾客管理", "会员运营列表"] },
  { path: "/site/lumen/admin/content", markers: ["内容运营", "内容草稿编辑"] },
  { path: "/site/lumen/admin/settings", markers: ["站点设置", "站点配置中心"] },
  { path: "/site/lumen/admin/design/navigation", markers: ["导航菜单", "站点导航"] },
  { path: "/site/lumen/admin/design/pages", markers: ["页面管理", "全站页面树"] },
  { path: "/site/lumen/admin/design/seo", markers: ["SEO 设置", "站点搜索资料"] },
  { path: "/site/lumen/admin/design/publications", markers: ["发布历史", "草稿发布与历史快照"] },
  { path: "/site/lumen/admin/ai-tools", markers: ["AI 工具", "工具配置"] }
];
for (const route of adminRouteChecks) {
  const response = await get(route.path, { cookie: lumenAdminCookie });
  if (!response.response.ok) throw new Error(`${route.path} did not render for site admin`);
  const html = await response.response.text();
  for (const marker of route.markers) {
    if (!html.includes(marker)) throw new Error(`${route.path} missing admin page marker: ${marker}`);
  }
}
const { json: themeRecords } = await get("/api/sites/site_lumen/theme/records", { cookie: lumenAdminCookie });
if (!themeRecords.draft?.templates?.index || !themeRecords.active?.templates?.index || !Array.isArray(themeRecords.publications) || !Array.isArray(themeRecords.themes)) {
  throw new Error("theme records API did not return draft, active, and publication data");
}
for (const templateName of ["404", "account-billing", "album", "app-home", "blog", "blog-detail", "cart", "collection", "index", "job-detail", "job-progress", "login", "package-detail", "page", "privacy", "product", "refunds", "search"]) {
  if (!themeRecords.draft.templates[templateName]) throw new Error(`theme records draft missing SaaS template ${templateName}`);
}
const themePages = themeRecords.site?.pages ?? [];
if (themePages.length && !themePages.some((page) => page.templateKey === "collection")) {
  throw new Error("theme records did not expose collection template page metadata");
}
if (themePages.length < 20 || !themePages.some((page) => page.templateKey === "job-detail") || !themePages.some((page) => page.slug === "/cart")) {
  throw new Error("theme records did not expose the full wedding storefront page set");
}
if (!themeRecords.themes.some((theme) => theme.status === "active") || !themeRecords.themes.some((theme) => theme.status === "draft")) {
  throw new Error("theme records API did not return installed active/draft themes");
}
const { json: installedTheme } = await post(
  "/api/sites/site_lumen/theme/install",
  { name: "Smoke imported SaaS theme1", actor: "smoke" },
  { cookie: lumenAdminCookie }
);
if (installedTheme.theme?.source !== "saas-theme1" || installedTheme.theme?.status !== "draft") {
  throw new Error("theme install API did not create an imported draft theme");
}
const { json: installedTheme4 } = await post(
  "/api/sites/site_lumen/theme/install",
  { name: "Smoke imported SaaS theme4", actor: "smoke", themeKey: "theme4" },
  { cookie: lumenAdminCookie }
);
if (installedTheme4.theme?.source !== "saas-theme" || installedTheme4.theme?.themeKey !== "theme4" || installedTheme4.theme?.status !== "draft") {
  throw new Error("theme install API did not create a non-theme1 imported draft theme");
}
if (installedTheme4.theme?.settings?.settings_data?.current?.skin_primary_btn_bg_color !== "rgba(209, 183, 129, 1)") {
  throw new Error("theme4 install did not preserve its own settings_data.current defaults");
}
const { json: installedDefaultTheme } = await post(
  "/api/sites/site_lumen/theme/install",
  { name: "Smoke imported SaaS default theme", actor: "smoke", themeKey: "default" },
  { cookie: lumenAdminCookie }
);
if (installedDefaultTheme.theme?.source !== "saas-theme" || installedDefaultTheme.theme?.themeKey !== "default" || installedDefaultTheme.theme?.status !== "draft") {
  throw new Error("theme install API did not create a default imported draft theme");
}
if (installedDefaultTheme.theme?.settings?.settings_data?.current?.skin_title_color !== "#1d1f21") {
  throw new Error("default theme install did not preserve its own settings_data.current defaults");
}
const { json: appliedTheme } = await post(
  `/api/sites/site_lumen/theme/${installedTheme.theme.id}/apply-to-draft`,
  { actor: "smoke" },
  { cookie: lumenAdminCookie }
);
if (!appliedTheme.ok || appliedTheme.theme?.id !== installedTheme.theme.id) {
  throw new Error("theme apply-to-draft API did not apply the imported theme");
}
const { json: activatedTheme } = await post(
  `/api/sites/site_lumen/theme/${installedTheme.theme.id}/activate`,
  { actor: "smoke" },
  { cookie: lumenAdminCookie }
);
if (activatedTheme.theme?.status !== "active" || !activatedTheme.publication?.version) {
  throw new Error("theme activate API did not publish the selected installed theme");
}
const legacySaasRoutes = [
  { path: "/site/lumen", markers: ["data-saas-section-renderer=\"slide_plus\"", "data-saas-section-renderer=\"products_plus\"", "data-saas-section-renderer=\"collection_list_plus\"", "data-saas-section-renderer=\"feature_columns\"", "data-saas-section-renderer=\"logo_bar\""] },
  { path: "/site/lumen/tools/image-studio", markers: ["data-saas-section-renderer=\"product_detail\""] },
  { path: "/site/lumen/collections", markers: ["data-saas-section-renderer=\"collection_detail\""] },
  { path: "/site/lumen/search", markers: ["data-saas-section-renderer=\"search\""] },
  { path: "/site/lumen/cart", markers: ["data-saas-section-renderer=\"cart\""] },
  { path: "/site/lumen/404", markers: ["data-saas-section-renderer=\"not_found\""] },
  { path: "/site/lumen/pricing", markers: ["data-saas-section-renderer=\"page_detail\""] }
];
for (const route of legacySaasRoutes) {
  const result = await get(route.path);
  if (!result.response.ok) throw new Error(`${route.path} did not render after imported SaaS theme activation`);
  const html = await result.response.text();
  for (const marker of route.markers) {
    if (!html.includes(marker)) throw new Error(`${route.path} missing imported SaaS renderer marker: ${marker}`);
  }
}
const { json: appliedTheme4 } = await post(
  `/api/sites/site_lumen/theme/${installedTheme4.theme.id}/apply-to-draft`,
  { actor: "smoke" },
  { cookie: lumenAdminCookie }
);
if (!appliedTheme4.ok || appliedTheme4.theme?.id !== installedTheme4.theme.id) {
  throw new Error("theme4 apply-to-draft API did not apply the imported theme");
}
const theme4Preview = await get("/site/lumen/admin/design/preview/site_lumen_home", { cookie: lumenAdminCookie });
const theme4PreviewHtml = await theme4Preview.response.text();
for (const marker of ["data-saas-section-renderer=\"html\"", "data-saas-section-renderer=\"overlay_image\"", "data-saas-section-renderer=\"two_images\""]) {
  if (!theme4PreviewHtml.includes(marker)) throw new Error(`theme4 designer preview missing imported SaaS renderer marker: ${marker}`);
}
const stateAfterTheme4Apply = await get("/api/platform/sites", { cookie: platformCookie });
const lumenAfterTheme4Apply = stateAfterTheme4Apply.json.sites?.find((site) => site.id === "site_lumen");
if (lumenAfterTheme4Apply?.themeSettings?.draftJson?.saasSettingsCurrent?.skin_primary_btn_bg_color !== "rgba(209, 183, 129, 1)") {
  throw new Error("theme4 apply-to-draft did not load theme4 settings_data.current into site draft settings");
}
const { json: appliedDefaultTheme } = await post(
  `/api/sites/site_lumen/theme/${installedDefaultTheme.theme.id}/apply-to-draft`,
  { actor: "smoke" },
  { cookie: lumenAdminCookie }
);
if (!appliedDefaultTheme.ok || appliedDefaultTheme.theme?.id !== installedDefaultTheme.theme.id) {
  throw new Error("default theme apply-to-draft API did not apply the imported theme");
}
const { json: themeCopy } = await post(
  "/api/sites/site_lumen/theme/duplicate",
  { source: "draft", name: "Smoke draft theme copy", actor: "smoke" },
  { cookie: lumenAdminCookie }
);
if (!themeCopy.themeCopy?.id || themeCopy.themeCopy?.source !== "draft" || !themeCopy.siteTheme?.id) {
  throw new Error("theme duplicate API did not create a draft copy and installed theme");
}
const deleteActive = await del(
  `/api/sites/site_lumen/theme/${installedTheme.theme.id}`,
  { actor: "smoke" },
  { cookie: lumenAdminCookie, allowFailure: true }
);
if (deleteActive.response.status !== 409) {
  throw new Error(`active theme delete should be blocked, got ${deleteActive.response.status}`);
}
const deletedCopy = await del(`/api/sites/site_lumen/theme/${themeCopy.siteTheme.id}`, { actor: "smoke" }, { cookie: lumenAdminCookie });
if (!deletedCopy.response.ok) {
  throw new Error(`draft theme delete failed: ${deletedCopy.response.status}`);
}
const deletedTheme4 = await del(`/api/sites/site_lumen/theme/${installedTheme4.theme.id}`, { actor: "smoke" }, { cookie: lumenAdminCookie });
if (!deletedTheme4.response.ok) {
  throw new Error(`non-theme1 draft theme delete failed: ${deletedTheme4.response.status}`);
}
const { json: exportedTheme } = await get("/api/sites/site_lumen/theme/export?source=active", { cookie: lumenAdminCookie });
if (!exportedTheme.package?.theme?.templates?.index || !exportedTheme.package?.theme?.settings?.settings_data?.current) {
  throw new Error("theme export API did not include templates and settings_data.current");
}
for (const templateName of ["404", "cart", "collection", "index", "page", "product", "search"]) {
  if (!exportedTheme.package.theme.templates[templateName]) throw new Error(`theme export missing SaaS template ${templateName}`);
}
const { json: resetTheme } = await post(
  "/api/sites/site_lumen/theme/reset-draft",
  { actor: "smoke" },
  { cookie: lumenAdminCookie }
);
if (!resetTheme.ok || !resetTheme.sourceVersion) {
  throw new Error("theme reset API did not restore draft from active");
}
report.themeManager = {
  templates: Object.keys(themeRecords.draft.templates).length,
  installedThemeId: installedTheme.theme.id,
  installedTheme4Id: installedTheme4.theme.id,
  activatedVersion: activatedTheme.publication.version,
  legacyRenderers: legacySaasRoutes.reduce((total, route) => total + route.markers.length, 0) + 7,
  copyId: themeCopy.themeCopy.id,
  deletedCopy: themeCopy.siteTheme.id,
  resetVersion: resetTheme.sourceVersion
};

const saasSectionId = `smoke_slide_${Date.now().toString(36)}`;
const stateBeforeSaasAction = await get("/api/platform/sites", { cookie: platformCookie });
const lumenBeforeSaasAction = stateBeforeSaasAction.json.sites?.find((site) => site.id === "site_lumen");
const lumenHomePageId = lumenBeforeSaasAction?.pages?.find((page) => page.pageType === "home")?.id;
if (!lumenHomePageId) {
  throw new Error("could not resolve Lumen home page id for SaaS action smoke");
}
const { json: saasAddition } = await post(
  "/api/sites/site_lumen/theme/saas-action",
  { action: { type: "addition", pageId: lumenHomePageId, sectionType: "slide_plus", sectionId: saasSectionId }, actor: "smoke" },
  { cookie: lumenAdminCookie }
);
if (!saasAddition.ok || saasAddition.action !== "addition") {
  throw new Error("SaaS addition action did not return ok");
}
if (saasAddition.types !== "add" || saasAddition.id !== saasSectionId || !saasAddition.html?.includes(`xfcart-section-${saasSectionId}`)) {
  throw new Error("SaaS addition action did not return iframe patch HTML");
}
const stateAfterSaasAddition = await get("/api/platform/sites", { cookie: platformCookie });
const lumenAfterSaasAddition = stateAfterSaasAddition.json.sites?.find((site) => site.id === "site_lumen");
const homeAfterSaasAddition = lumenAfterSaasAddition?.pages?.find((page) => page.id === lumenHomePageId);
const addedSlideBlockId = homeAfterSaasAddition?.draftJson?.sections?.[saasSectionId]?.blocks?.[0]?.id;
if (!addedSlideBlockId) {
  throw new Error("SaaS addition did not create slide block data");
}
const { json: saasChange } = await post(
  "/api/sites/site_lumen/theme/saas-action",
  {
    action: {
      type: "change",
      pageId: lumenHomePageId,
      scope: "page_block",
      sectionId: saasSectionId,
      blockId: addedSlideBlockId,
      name: "title",
      value: "Smoke imported SaaS slide"
    },
    actor: "smoke"
  },
  { cookie: lumenAdminCookie }
);
if (!saasChange.ok || saasChange.action !== "change") {
  throw new Error("SaaS change action did not return ok");
}
if (saasChange.types !== "th1" || saasChange.id !== saasSectionId || !saasChange.html?.includes("Smoke imported SaaS slide")) {
  throw new Error("SaaS change action did not return updated iframe patch HTML");
}
const stateAfterSaasAction = await get("/api/platform/sites", { cookie: platformCookie });
const lumenAfterSaasAction = stateAfterSaasAction.json.sites?.find((site) => site.id === "site_lumen");
const homeAfterSaasAction = lumenAfterSaasAction?.pages?.find((page) => page.id === lumenHomePageId);
if (!homeAfterSaasAction?.draftJson?.sections?.[saasSectionId]?.blocks?.find((block) => block.id === addedSlideBlockId && block.settings.title === "Smoke imported SaaS slide")) {
  throw new Error("SaaS action API did not mutate Lumen home draft");
}
const headerSectionId = `smoke_header_${Date.now().toString(36)}`;
const footerSectionId = `smoke_footer_${Date.now().toString(36)}`;
for (const action of [
  { sectionType: "reveal_slide", sectionId: `smoke_reveal_${Date.now().toString(36)}`, marker: "data-saas-section-renderer=\"reveal_slide\"", themeKey: "default" },
  { sectionType: "vertical_showcase_slider", sectionId: `smoke_vertical_${Date.now().toString(36)}`, marker: "data-saas-section-renderer=\"vertical_showcase_slider\"", themeKey: "default" },
  { sectionType: "header_plus", sectionId: headerSectionId, marker: "data-saas-section-renderer=\"header_plus\"" },
  { sectionType: "footer_plus", sectionId: footerSectionId, marker: "data-saas-section-renderer=\"footer_plus\"" }
]) {
  const { json } = await post(
    "/api/sites/site_lumen/theme/saas-action",
    { action: { type: "addition", pageId: lumenHomePageId, sectionType: action.sectionType, sectionId: action.sectionId, themeKey: action.themeKey, theme_key: action.themeKey }, actor: "smoke" },
    { cookie: lumenAdminCookie }
  );
  if (json.types !== "add" || json.id !== action.sectionId || !json.html?.includes(action.marker)) {
    throw new Error(`${action.sectionType} addition did not render a legacy SaaS section marker`);
  }
}
const { json: saasGlobalSetting } = await post(
  "/api/sites/site_lumen/theme/saas-action",
  {
    action: {
      type: "change",
      scope: "global_setting",
      name: "skin_bg",
      value: "#f2eee7"
    },
    actor: "smoke"
  },
  { cookie: lumenAdminCookie, transientRetries: 2 }
);
if (saasGlobalSetting.types !== "reload") {
  throw new Error("SaaS global setting action did not request iframe reload");
}
const stateAfterSaasGlobalSetting = await get("/api/platform/sites", { cookie: platformCookie });
const lumenAfterSaasGlobalSetting = stateAfterSaasGlobalSetting.json.sites?.find((site) => site.id === "site_lumen");
if (lumenAfterSaasGlobalSetting?.themeSettings?.draftJson?.saasSettingsCurrent?.skin_bg !== "#f2eee7") {
  throw new Error("SaaS global setting did not persist settings_data.current skin_bg");
}
const { json: xfcartEdit } = await post(
  "/api/sites/site_lumen/theme/xfcart-edit",
  {
    t: "change",
    page: "index",
    theme_id: "smoke_xfcart_draft",
    x: "slide_plus",
    i: saasSectionId,
    k: 1,
    n: "title",
    v: "Smoke XFCart protocol slide"
  },
  { cookie: lumenAdminCookie, transientRetries: 2 }
);
if (xfcartEdit.state !== "ok" || xfcartEdit.types !== "th1" || xfcartEdit.id !== saasSectionId || !xfcartEdit.html?.includes("Smoke XFCart protocol slide")) {
  throw new Error("XFCart-compatible edit endpoint did not mutate and render section patch");
}
const theme10SectionId = `smoke_banner_${Date.now().toString(36)}`;
const { json: xfcartTheme10Addition } = await post(
  "/api/sites/site_lumen/theme/xfcart-edit",
  {
    t: "addition",
    page: "index",
    theme_id: "smoke_theme10_draft",
    themeKey: "theme10",
    theme_key: "theme10",
    x: "slide_banner",
    i: theme10SectionId
  },
  { cookie: lumenAdminCookie }
);
if (xfcartTheme10Addition.state !== "ok" || xfcartTheme10Addition.types !== "add" || xfcartTheme10Addition.id !== theme10SectionId || xfcartTheme10Addition.themeKey !== "theme10") {
  throw new Error("XFCart-compatible edit endpoint did not accept a non-theme1 section schema");
}
const stateAfterTheme10Addition = await get("/api/platform/sites", { cookie: platformCookie });
const lumenAfterTheme10Addition = stateAfterTheme10Addition.json.sites?.find((site) => site.id === "site_lumen");
const homeAfterTheme10Addition = lumenAfterTheme10Addition?.pages?.find((page) => page.id === lumenHomePageId);
const theme10BlockId = homeAfterTheme10Addition?.draftJson?.sections?.[theme10SectionId]?.blocks?.[0]?.id;
if (!theme10BlockId) {
  throw new Error("theme10 slide_banner addition did not use theme-scoped preset blocks");
}
const { json: xfcartTheme10Block } = await post(
  "/api/sites/site_lumen/theme/xfcart-edit",
  {
    t: "additem",
    page: "index",
    theme_id: "smoke_theme10_draft",
    themeKey: "theme10",
    theme_key: "theme10",
    x: "slide_banner",
    i: theme10SectionId,
    v: "banner"
  },
  { cookie: lumenAdminCookie }
);
if (xfcartTheme10Block.state !== "ok" || xfcartTheme10Block.types !== "th1" || xfcartTheme10Block.id !== theme10SectionId) {
  throw new Error("theme10 additem did not resolve the theme-scoped block schema");
}
const stateAfterTheme10Block = await get("/api/platform/sites", { cookie: platformCookie });
const lumenAfterTheme10Block = stateAfterTheme10Block.json.sites?.find((site) => site.id === "site_lumen");
const homeAfterTheme10Block = lumenAfterTheme10Block?.pages?.find((page) => page.id === lumenHomePageId);
const theme10BlocksAfterAdd = homeAfterTheme10Block?.draftJson?.sections?.[theme10SectionId]?.blocks ?? [];
if (theme10BlocksAfterAdd.length < 2) {
  throw new Error("theme10 additem did not create a second block for XFCart strict reorder parity");
}
const theme10SecondBlockId = theme10BlocksAfterAdd[1]?.id;
const { json: xfcartTheme10DropItem } = await post(
  "/api/sites/site_lumen/theme/xfcart-edit",
  {
    t: "dropitem",
    page: "index",
    theme_id: "smoke_theme10_draft",
    themeKey: "theme10",
    theme_key: "theme10",
    x: "slide_banner",
    i: theme10SectionId,
    v: JSON.stringify([2])
  },
  { cookie: lumenAdminCookie }
);
if (xfcartTheme10DropItem.state !== "ok" || xfcartTheme10DropItem.types !== "th1" || xfcartTheme10DropItem.id !== theme10SectionId) {
  throw new Error("theme10 dropitem did not return the XFCart section patch contract");
}
const stateAfterTheme10DropItem = await get("/api/platform/sites", { cookie: platformCookie });
const lumenAfterTheme10DropItem = stateAfterTheme10DropItem.json.sites?.find((site) => site.id === "site_lumen");
const homeAfterTheme10DropItem = lumenAfterTheme10DropItem?.pages?.find((page) => page.id === lumenHomePageId);
const theme10BlocksAfterDropItem = homeAfterTheme10DropItem?.draftJson?.sections?.[theme10SectionId]?.blocks ?? [];
if (theme10BlocksAfterDropItem.length !== 1 || theme10BlocksAfterDropItem[0]?.id !== theme10SecondBlockId) {
  throw new Error("XFCart dropitem parity failed: blocks were not strictly rebuilt from the submitted sort array");
}
const { json: xfcartBooleanChange } = await post(
  "/api/sites/site_lumen/theme/xfcart-edit",
  {
    t: "change",
    page: "index",
    theme_id: "smoke_theme10_draft",
    themeKey: "theme10",
    theme_key: "theme10",
    x: "slide_banner",
    i: theme10SectionId,
    n: "smoke_boolean_flag",
    v: "false"
  },
  { cookie: lumenAdminCookie }
);
if (xfcartBooleanChange.state !== "ok" || xfcartBooleanChange.types !== "th1") {
  throw new Error("XFCart boolean change did not return a section patch");
}
const stateAfterXfcartBoolean = await get("/api/platform/sites", { cookie: platformCookie });
const lumenAfterXfcartBoolean = stateAfterXfcartBoolean.json.sites?.find((site) => site.id === "site_lumen");
const homeAfterXfcartBoolean = lumenAfterXfcartBoolean?.pages?.find((page) => page.id === lumenHomePageId);
if (homeAfterXfcartBoolean?.draftJson?.sections?.[theme10SectionId]?.settings?.smoke_boolean_flag !== false) {
  throw new Error("XFCart change parity failed: string false was not stored as boolean false");
}
const saasFontObject = {
  family: "Lato",
  weight: 700,
  varin: "粗体",
  style: "normal",
  fallback_families: "sans-serif",
  font_face: "@font-face {  font-family:'Lato'; font-style:normal; font-weight:700; font-display:swap; src: url(https://fonts.gstatic.com/s/lato/v22/S6u9w4BMUTPHh6UVSwiPGQ.woff2) format('woff2'); };"
};
const { json: xfcartFontChange } = await post(
  "/api/sites/site_lumen/theme/xfcart-edit",
  {
    t: "change",
    page: "index",
    theme_id: "smoke_theme10_draft",
    themeKey: "theme10",
    theme_key: "theme10",
    x: "global_setting",
    n: "skin_title_font_family",
    v: saasFontObject
  },
  { cookie: lumenAdminCookie }
);
if (xfcartFontChange.state !== "ok" || xfcartFontChange.types !== "reload") {
  throw new Error("XFCart font picker object change did not return reload");
}
const stateAfterXfcartFont = await get("/api/platform/sites", { cookie: platformCookie });
const lumenAfterXfcartFont = stateAfterXfcartFont.json.sites?.find((site) => site.id === "site_lumen");
if (lumenAfterXfcartFont?.themeSettings?.draftJson?.saasSettingsCurrent?.skin_bg !== "rgba(250, 250, 250, 1)") {
  throw new Error("theme10 XFCart edit did not preserve theme10 settings_data.current defaults");
}
if (lumenAfterXfcartFont?.themeSettings?.draftJson?.saasSettingsCurrent?.skin_title_font_family?.family !== "Lato") {
  throw new Error("XFCart font picker parity failed: font object was not stored in settings_data.current");
}
if (lumenAfterXfcartFont?.themeSettings?.draftJson?.typography?.display !== "Lato") {
  throw new Error("XFCart font picker parity failed: typography display was not synced from font object family");
}
const productSelectorValue = {
  id: "prod_lumen_premium",
  title: "Premium",
  url: "/pricing",
  type: "product"
};
const { json: xfcartProductSelector } = await post(
  "/api/sites/site_lumen/theme/xfcart-edit",
  {
    t: "change",
    page: "index",
    theme_id: "smoke_theme10_draft",
    themeKey: "theme10",
    theme_key: "theme10",
    x: "slide_banner",
    i: theme10SectionId,
    n: "product",
    v: productSelectorValue
  },
  { cookie: lumenAdminCookie }
);
if (xfcartProductSelector.state !== "ok" || xfcartProductSelector.types !== "th1") {
  throw new Error("XFCart product selector object change did not return a section patch");
}
const urlSelectorValue = {
  id: "site_lumen_pricing",
  title: "Pricing",
  url: "/pricing",
  type: "pages"
};
const { json: xfcartUrlSelector } = await post(
  "/api/sites/site_lumen/theme/xfcart-edit",
  {
    t: "change",
    page: "index",
    theme_id: "smoke_theme10_draft",
    themeKey: "theme10",
    theme_key: "theme10",
    x: "slide_banner",
    i: theme10SectionId,
    n: "url",
    v: urlSelectorValue
  },
  { cookie: lumenAdminCookie }
);
if (xfcartUrlSelector.state !== "ok" || xfcartUrlSelector.types !== "th1") {
  throw new Error("XFCart url selector object change did not return a section patch");
}
const stateAfterXfcartSelectors = await get("/api/platform/sites", { cookie: platformCookie });
const lumenAfterXfcartSelectors = stateAfterXfcartSelectors.json.sites?.find((site) => site.id === "site_lumen");
const homeAfterXfcartSelectors = lumenAfterXfcartSelectors?.pages?.find((page) => page.id === lumenHomePageId);
const selectorSection = homeAfterXfcartSelectors?.draftJson?.sections?.[theme10SectionId];
if (selectorSection?.settings?.product?.id !== "prod_lumen_premium" || selectorSection?.settings?.product?.type !== "product") {
  throw new Error("XFCart product selector parity failed: selector object was not stored");
}
if (selectorSection?.settings?.url?.url !== "/pricing" || selectorSection?.settings?.url?.type !== "pages") {
  throw new Error("XFCart URL selector parity failed: selector object was not stored");
}
const liveBeforeDraftIsolationHtml = await expectHtml("/site/lumen", ['data-saas-section-renderer="slide_plus"']);
if (liveBeforeDraftIsolationHtml.includes("Smoke draft-only headline")) {
  throw new Error("live storefront already contains the draft-only isolation marker before draft edit");
}
const draftIsolationSectionId = saasSectionId;
const heroDraftSection = homeAfterXfcartSelectors?.draftJson?.sections?.[draftIsolationSectionId];
if (!heroDraftSection) {
  throw new Error("home draft missing the smoke slide_plus section for draft isolation check");
}
const { json: draftPageUpdate } = await put(
  `/api/sites/site_lumen/theme/pages/${lumenHomePageId}/draft`,
  {
    draftJson: {
      ...homeAfterXfcartSelectors.draftJson,
      sections: {
        ...homeAfterXfcartSelectors.draftJson.sections,
        [draftIsolationSectionId]: {
          ...heroDraftSection,
          settings: {
            ...heroDraftSection.settings,
            title: "Smoke draft-only headline"
          }
        }
      }
    }
  },
  { cookie: lumenAdminCookie }
);
if (!draftPageUpdate.ok) {
  throw new Error("home page draft save for isolation check failed");
}
const liveAfterDraftIsolationHtml = await expectHtml("/site/lumen", ['data-saas-section-renderer="slide_plus"']);
if (liveAfterDraftIsolationHtml.includes("Smoke draft-only headline")) {
  throw new Error("draft-only homepage edit leaked into the live storefront before publish");
}
await post(
  `/api/sites/site_lumen/theme/pages/${lumenHomePageId}/rollback`,
  { actor: "smoke" },
  { cookie: lumenAdminCookie }
);
const designerPageAfterGlobal = await get("/site/lumen/admin/design", { cookie: lumenAdminCookie });
const designerHtmlAfterGlobal = await designerPageAfterGlobal.response.text();
for (const marker of ["高级：SaaS 原主题导入", "SaaS", "settings_schema", "Color", "Product", "Social media", "XFCart edit protocol", "xfcart-edit", "data-designer-layout=\"saas-store-builder xfcart-fullscreen-section-editor saas-three-pane-builder\"", "data-designer-contract=\"saas-right-decoration-workbench saas-left-decoration-workbench\"", "data-designer-layout=\"saas-property-inspector-panel\"", "data-designer-layout=\"saas-theme-package-strip\"", "data-designer-contract=\"xfcart-section-block-tree\"", "data-designer-layout=\"xfcart-collapsible-block-tree\"", "data-designer-contract=\"xfcart-collapsible-global-block-tree\"", "data-designer-section-expanded=\"true\"", "data-designer-contract=\"global-expanded\"", "data-designer-contract=\"xfcart-preset-category-library\"", "data-designer-contract=\"xfcart-iframe-selection-sync\"", "data-designer-contract=\"xfcart-preview-click-select\"", "data-designer-contract=\"xfcart-iframe-scroll-highlight\"", "Iframe section selection sync", "Preview click selection", "previewSelect", "content_for_page", "种子块", "个预设", "商品", "素材", "导航", "营销", "基础", "AI 订阅业务积木", "header_plus", "footer_plus", "theme10", "default", "data-designer-contract=\"saas-designer-flow-map\"", "data-designer-layout=\"saas-visible-page-switcher\"", "data-designer-layout=\"saas-full-site-page-directory\"", "全站页面装修目录", "门店首页", "商品/套餐", "AI 工作流", "客户中心", "内容/政策", "系统页面", "data-designer-action=\"industry-template-apply\"", "data-designer-action=\"industry-template-apply-all\"", "套当前页", "套全站", "发布全站", "回滚全站", "当前页", "全站", "Wedding Story House", "DreamShootAI Studio", "Portrait Clean Studio", "Executive Headshot Pro"]) {
  if (!designerHtmlAfterGlobal.includes(marker)) throw new Error(`designer missing SaaS settings marker: ${marker}`);
}
const designerPreviewAfterGlobal = await get("/site/lumen/admin/design/preview/site_lumen_home", { cookie: lumenAdminCookie });
const designerPreviewAfterGlobalHtml = await designerPreviewAfterGlobal.response.text();
for (const marker of ["data-xfcart-preview-selection-listener", "data-xfcart-preview-click-select", "data-xfcart-block-selected", "data-xfcart-block-id", "data-xfcart-block-type", "header_nav_", "footer_nav_", "Selected in designer", "previewSelect", "data-theme-sections-root", "xfcart-section-header_plus", "xfcart-section-footer_plus"]) {
  if (!designerPreviewAfterGlobalHtml.includes(marker)) throw new Error(`designer preview missing iframe selection marker: ${marker}`);
}
if (!designerHtmlAfterGlobal.includes("data-admin-command-bar=\"saas-style\"")) {
  throw new Error("designer missing SaaS-style admin command bar");
}
for (const marker of ["SaaS media picker", "SaaS collection binding", "SaaS product binding", "SaaS link selector", "SaaS resource selector", "SaaS media resource modal", "SaaS product resource modal", "SaaS collection resource modal", "SaaS page/url resource modal", "data-designer-contract=\"saas-resource-selector-modal\"", "data-designer-contract=\"saas-media-resource-selector\"", "SaaS custom image select", "SaaS range slider", "SaaS switch", "SaaS menu picker", "SaaS font picker", "SaaS html editor", "SaaS richtext editor", "SaaS video_url editor", "SaaS popover notice"]) {
  if (!designerHtmlAfterGlobal.includes(marker)) throw new Error(`designer missing SaaS field editor marker: ${marker}`);
}
for (const marker of ["专辑页 - /collections - Wedding collections", "搜索页 - /search - Search", "购物车 - /cart - Cart", "404 - /404 - 404", "任务详情页 - /app/jobs/detail - Job detail", "客户工作台 - /app - Wedding workspace", "账户订阅页 - /account - Account and billing"]) {
  if (!designerHtmlAfterGlobal.includes(marker)) throw new Error(`designer missing full-site SaaS page option: ${marker}`);
}
for (const path of ["/site/lumen/collections", "/site/lumen/search", "/site/lumen/cart", "/site/lumen/404", "/site/lumen/account", "/site/lumen/album"]) {
  const response = await get(path);
  if (!response.response.ok) throw new Error(`${path} did not render as a published SaaS template page`);
}
const { json: saasDelete } = await post(
  "/api/sites/site_lumen/theme/saas-action",
  { action: { type: "delition", pageId: lumenHomePageId, sectionId: saasSectionId }, actor: "smoke" },
  { cookie: lumenAdminCookie }
);
if (saasDelete.types !== "del" || saasDelete.id !== saasSectionId) {
  throw new Error("SaaS delete action did not return iframe delete patch");
}
const { json: theme10Delete } = await post(
  "/api/sites/site_lumen/theme/saas-action",
  { action: { type: "delition", pageId: lumenHomePageId, sectionId: theme10SectionId, themeKey: "theme10" }, actor: "smoke" },
  { cookie: lumenAdminCookie }
);
if (theme10Delete.types !== "del" || theme10Delete.id !== theme10SectionId) {
  throw new Error("theme10 delete action did not remove the non-theme1 section");
}
report.saasThemeAction = {
  added: "slide_plus",
  themeScopedAdded: "theme10/slide_banner",
  changed: "title",
  strictDropitem: true,
  booleanCoercion: true,
  fontObject: true,
  selectorObject: true,
  globalSetting: "skin_bg",
  xfcartEdit: "change",
  deleted: true,
  draftIsolation: true
};

const customerLoginPage = await get("/site/lumen/login");
const customerLoginHtml = await customerLoginPage.response.text();
for (const marker of ["Sign into your private wedding story workspace.", "Private customer access", "Private uploads stay inside this wedding site."]) {
  if (!customerLoginHtml.includes(marker)) throw new Error(`customer login page missing marker: ${marker}`);
}

await expectStatus("/site/lumen/app", 307);
await expectStatus("/api/sites/site_lumen/auth/login", 401, {
  method: "POST",
  body: { email: "mara@northpier.studio", password: "wrongpass", name: "Mara Voss" }
});
const { response: loginResponse, json: login } = await post("/api/sites/site_lumen/auth/login", {
  email: "mara@northpier.studio",
  password: "mara123",
  name: "Mara Voss"
});
const customerCookie = cookieFrom(loginResponse, "customer_session_site_lumen");
if (!login.customer?.id || login.customer.id !== "cust_lumen_mara" || login.customer?.passwordHash) {
  throw new Error("customer login did not create a safe site-scoped session");
}
report.login = { customerId: login.customer.id, balance: login.customer.balance };

const workspacePage = await get("/site/lumen/app", { cookie: customerCookie });
const workspaceHtml = await workspacePage.response.text();
for (const marker of themeWorkspaceMarkers) {
  if (!workspaceHtml.includes(marker)) throw new Error(`customer workspace page missing marker: ${marker}`);
}
await expectHtml("/site/lumen/app/jobs/progress", ["data-theme-sections-root", "data-section-type=\"job_progress\"", "data-section-type=\"album_gallery\""], {
  cookie: customerCookie
});
report.workspace = "ok";

await expectStatus("/site/atlas/admin", 307);
const { response: atlasAdminLoginResponse, json: atlasAdminLogin } = await post("/api/sites/site_atlas/admin/auth/login", {
  email: "owner@atlas.localhost",
  password: "atlas123"
});
const atlasAdminCookie = cookieFrom(atlasAdminLoginResponse, "site_admin_session_site_atlas");
if (atlasAdminLogin.siteAdmin?.email !== "owner@atlas.localhost" || atlasAdminLogin.siteAdmin?.passwordHash) {
  throw new Error("atlas admin login did not return a safe site admin");
}
await expectHtml("/site/atlas/admin", ["Atlas Copy Foundry 店铺后台", "概览工作台", "店铺装修", "商品套餐", "订单订阅", "顾客资产"], {
  cookie: atlasAdminCookie
});
for (const route of [
  { path: "/site/atlas/admin/themes", markers: ["SaaS fc_themes control room", "data-admin-layout=\"saas-command-workspace\""] },
  { path: "/site/atlas/admin/settings", markers: ["站点设置", "站点配置中心"] }
]) {
  await expectHtml(route.path, route.markers, { cookie: atlasAdminCookie });
}
for (const route of [
  { path: "/site/atlas/pricing", markers: ["data-theme-sections-root", "xfcart-section-header_plus", "Atlas"] },
  { path: "/site/atlas/help", markers: ["data-theme-sections-root", "xfcart-section-footer_plus", "Atlas"] },
  { path: "/site/atlas/blog", markers: ["data-theme-sections-root", "xfcart-section-header_plus", "Atlas"] },
  { path: "/site/atlas/policies/privacy", markers: ["data-theme-sections-root", "xfcart-section-header_plus", "Atlas"] },
  { path: "/site/atlas/policies/refunds", markers: ["data-theme-sections-root", "xfcart-section-header_plus", "Atlas"] },
  { path: "/site/atlas/policies/content", markers: ["data-theme-sections-root", 'data-section-type="policy_content"', "Atlas"] },
  { path: "/site/atlas/tools/image-studio", markers: ["data-theme-sections-root", "xfcart-section-header_plus", "Atlas"] },
  { path: "/site/atlas/collections", markers: ["data-theme-sections-root", "xfcart-section-header_plus", "Atlas"] },
  { path: "/site/atlas/search", markers: ["data-theme-sections-root", "xfcart-section-header_plus", "Atlas"] },
  { path: "/site/atlas/cart", markers: ["data-theme-sections-root", "xfcart-section-header_plus", "Atlas"] }
]) {
  await expectHtml(route.path, route.markers);
}
const { response: atlasLoginResponse, json: atlasLogin } = await post("/api/sites/site_atlas/auth/login", {
  email: "mara@northpier.studio",
  password: "mara123",
  name: "Mara Voss"
});
const atlasCustomerCookie = cookieFrom(atlasLoginResponse, "customer_session_site_atlas");
if (!atlasLogin.customer?.id || atlasLogin.customer.id !== "cust_atlas_mara" || atlasLogin.createdCustomer || atlasLogin.customer?.passwordHash) {
  throw new Error("atlas customer login did not stay site-scoped for the same email");
}
await expectHtml("/site/atlas/app", themeWorkspaceMarkers, {
  cookie: atlasCustomerCookie
});
const atlasJobBlocked = await request("/api/sites/site_atlas/ai/jobs", {
  method: "POST",
  cookie: atlasCustomerCookie,
  body: { customerId: "cust_atlas_mara", aiAppSlug: "copy_generator", params: { tone: "editorial" } },
  allowFailure: true
});
if (atlasJobBlocked.response.status !== 402 || atlasJobBlocked.json?.error !== "customer_past_due") {
  throw new Error("atlas past_due customer was not blocked from creating a new job");
}
report.atlasCustomerIsolation = {
  customerId: atlasLogin.customer.id,
  createdCustomer: atlasLogin.createdCustomer,
  status: atlasLogin.customer.status,
  balance: atlasLogin.customer.balance,
  jobBlocked: atlasJobBlocked.json.error
};

await expectStatus(`/api/sites/site_lumen/customers/${login.customer.id}/assets`, 401, {
  method: "POST",
  body: { label: "blocked input", mimeType: "image/jpeg", role: "input" }
});
const { json: inputAsset } = await post(
  `/api/sites/site_lumen/customers/${login.customer.id}/assets`,
  { label: "smoke input portrait", mimeType: "image/jpeg", role: "input" },
  { cookie: customerCookie }
);
if (inputAsset.asset?.role !== "input" || !inputAsset.asset?.previewUrl) {
  throw new Error("input asset public response did not include a usable preview");
}
if (inputAsset.asset?.storageKey || inputAsset.asset?.customerId || inputAsset.asset?.siteId) {
  throw new Error("customer asset API leaked internal storage or tenant fields");
}
const { json: inputDownload } = await post(
  `/api/sites/site_lumen/customers/${login.customer.id}/assets/${inputAsset.asset.id}/download`,
  {},
  { cookie: customerCookie }
);
if (!inputDownload.downloadUrl || !inputDownload.expiresAt) {
  throw new Error("input asset signed download link was not created");
}
const deletedInput = await del(`/api/sites/site_lumen/customers/${login.customer.id}/assets/${inputAsset.asset.id}`, undefined, { cookie: customerCookie });
if (!deletedInput.response.ok) {
  throw new Error(`input asset delete failed: ${deletedInput.response.status}`);
}
report.inputAsset = { assetId: inputAsset.asset.id, deleted: true };

const { json: created } = await post(
  "/api/sites/site_lumen/ai/jobs",
  { customerId: login.customer.id, aiAppSlug: "image_generator", params: { style: "editorial", outputCount: 4 } },
  { cookie: customerCookie }
);
if (created.ledgerAction?.type !== "reserve" || created.customerBalance.available !== 168) {
  throw new Error("job create did not reserve credits as expected");
}
report.createJob = {
  jobId: created.job.id,
  status: created.job.status,
  balance: created.customerBalance
};
const jobDetailPage = await get(`/site/lumen/app/jobs/${created.job.id}`, { cookie: customerCookie });
const jobDetailHtml = await jobDetailPage.response.text();
for (const marker of ["Album request", "Credit history", "Delivered images", "Credits held"]) {
  if (!jobDetailHtml.includes(marker)) throw new Error(`job detail page missing marker: ${marker}`);
}

const { json: toolUpdate } = await put(
  "/api/sites/site_lumen/ai/apps/sai_lumen_image",
  { enabled: true, creditCost: 18, routeKey: "n8n.image.v2" },
  { cookie: lumenAdminCookie }
);
if (toolUpdate.siteAiApp?.creditCost !== 18 || toolUpdate.siteAiApp?.routeKey !== "n8n.image.v2") {
  throw new Error("AI tool update did not persist expected values");
}
report.aiToolUpdate = {
  creditCost: toolUpdate.siteAiApp.creditCost,
  routeKey: toolUpdate.siteAiApp.routeKey
};

const { json: packUpdate } = await put(
  "/api/sites/site_lumen/creative-packs/pack_lumen_editorial",
  {
    id: "pack_lumen_editorial",
    name: "Editorial Studio Set",
    headline: "40-image editorial album from selfies",
    description: "Updated smoke-test description for a DreamShoot-style editorial photo package.",
    category: "fashion",
    aiAppSlug: "image_generator",
    status: "active",
    creditCost: 22,
    outputCount: 40,
    trainingRequired: true
  },
  { cookie: lumenAdminCookie }
);
if (packUpdate.pack?.creditCost !== 22 || packUpdate.pack?.outputCount !== 40 || packUpdate.pack?.headline !== "40-image editorial album from selfies") {
  throw new Error("creative pack update did not persist");
}

const { json: mediaUpdate } = await put(
  "/api/sites/site_lumen/media-assets/media_lumen_pack_exec",
  {
    id: "media_lumen_pack_exec",
    label: "Executive pack cover updated",
    storageKey: "sites/site_lumen/packs/executive-cover-updated.webp",
    mimeType: "image/webp",
    usage: "pack_cover"
  },
  { cookie: lumenAdminCookie }
);
if (mediaUpdate.asset?.label !== "Executive pack cover updated" || !mediaUpdate.asset?.storageKey?.startsWith("sites/site_lumen/")) {
  throw new Error("theme media update did not persist as site-scoped media");
}
const { json: mediaCreate } = await post(
  "/api/sites/site_lumen/media-assets",
  {
    label: "Smoke site media card",
    storageKey: "sites/site_lumen/theme/smoke-site-media-card.webp",
    mimeType: "image/webp",
    usage: "theme",
    sourceType: "external_url",
    previewUrl: "/assets/dreamshoot/date-night.svg",
    altText: "Smoke site media preview"
  },
  { cookie: lumenAdminCookie }
);
if (mediaCreate.asset?.label !== "Smoke site media card" || mediaCreate.asset?.sourceType !== "external_url" || mediaCreate.asset?.previewUrl !== "/assets/dreamshoot/date-night.svg") {
  throw new Error("theme media create did not persist preview/source metadata");
}
const deletedMedia = await del(`/api/sites/site_lumen/media-assets/${mediaCreate.asset.id}`, undefined, { cookie: lumenAdminCookie });
if (!deletedMedia.response.ok) {
  throw new Error(`theme media delete failed: ${deletedMedia.response.status}`);
}

const settingsPayload = {
  actor: "smoke",
  name: "Lumen Smoke Studio",
  status: "active",
  currency: "USD",
  timezone: "America/Los_Angeles",
  branding: {
    logoText: "Lumen Smoke",
    market: "AI portrait studio",
    description: "Smoke test brand copy for published storefront verification."
  },
  connect: {
    stripeAccountId: "acct_lumen_42x",
    status: "enabled",
    chargesEnabled: true,
    payoutsEnabled: true
  }
};
const { json: settingsUpdate } = await put("/api/sites/site_lumen/settings", settingsPayload, { cookie: lumenAdminCookie });
if (settingsUpdate.site?.branding?.logoText !== "Lumen Smoke" || settingsUpdate.site?.name !== "Lumen Smoke Studio") {
  throw new Error("site settings update did not persist brand identity");
}

const { json: navSave } = await put(
  "/api/sites/site_lumen/theme/settings/draft",
  {
    draftJson: {
      ...settingsUpdate.site.themeSettings.draftJson,
      navigation: {
        headerLinks: [
          { label: "Smoke Pricing", href: "/pricing" },
          { label: "Smoke Help", href: "/help" }
        ],
        footerLinks: [
          { label: "Smoke Privacy", href: "/policies/privacy" },
          { label: "Smoke Blog", href: "/blog" }
        ]
      }
    }
  },
  { cookie: lumenAdminCookie }
);
if (!navSave.ok) {
  throw new Error("navigation draft save failed");
}

const contentPageRecord = themeRecords.site.pages.find((page) => page.id === "site_lumen_content");
if (!contentPageRecord?.draftJson) {
  throw new Error("content policy page record missing from theme records");
}
const contentTargetSectionId =
  contentPageRecord.draftJson.sectionsOrder.find((sectionId) => {
    const section = contentPageRecord.draftJson.sections[sectionId];
    return section && section.type !== "footer" && section.settings && typeof section.settings.title !== "undefined";
  }) ?? contentPageRecord.draftJson.sectionsOrder[0];
if (!contentTargetSectionId || !contentPageRecord.draftJson.sections[contentTargetSectionId]) {
  throw new Error("content policy page does not expose an editable title section");
}
const contentTargetSection = contentPageRecord.draftJson.sections[contentTargetSectionId];
const { json: contentDraftSave } = await put(
  "/api/sites/site_lumen/theme/pages/site_lumen_content/draft",
  {
    draftJson: {
      ...contentPageRecord.draftJson,
      sections: {
        ...contentPageRecord.draftJson.sections,
        [contentTargetSectionId]: {
          ...contentTargetSection,
          settings: {
            ...contentTargetSection.settings,
            title: "Smoke content policy title"
          }
        }
      }
    }
  },
  { cookie: lumenAdminCookie }
);
if (!contentDraftSave.ok) {
  throw new Error("content page draft save failed");
}

const { json: contentPublish } = await post(
  "/api/sites/site_lumen/theme/pages/site_lumen_content/publish",
  { actor: "smoke" },
  { cookie: lumenAdminCookie }
);
if (!contentPublish.publishedVersion) {
  throw new Error("content page publish did not create a storefront snapshot");
}

const storefrontAfterSettings = await get("/site/lumen");
const storefrontAfterSettingsHtml = await storefrontAfterSettings.response.text();
for (const marker of ["Lumen Smoke", "Smoke Pricing", "Smoke Help", "Smoke Privacy", "Smoke Blog", "Smoke test brand copy for published storefront verification."]) {
  if (!storefrontAfterSettingsHtml.includes(marker)) throw new Error(`storefront did not reflect settings/navigation publish marker: ${marker}`);
}
const contentPolicyAfterPublish = await get("/site/lumen/policies/content");
const contentPolicyAfterPublishHtml = await contentPolicyAfterPublish.response.text();
if (!contentPolicyAfterPublishHtml.includes("Smoke content policy title")) {
  throw new Error("content policy page did not reflect published draft change");
}

const internalThemeChecks = [
  {
    key: "dreamshoot-ai-studio",
    markers: [
      "AI couple photo maker that feels real",
      "DreamShootAI",
      "Professional AI Photo Packages"
    ],
    global: {
      logoText: "DreamShootAI",
      headerTitle: "DreamShootAI",
      footerTitle: "DreamShootAI Studio",
      seoTitle: "DreamShootAI Studio",
      background: "#f6f8fb",
      announce: "Private AI photo subscriptions with site-scoped credits and albums."
    }
  },
  {
    key: "wedding-story-house",
    markers: [
      "AI-Powered Wedding Photos in Any Destination",
      "AI Wedding",
      "Your Love Story, Anywhere."
    ],
    global: {
      logoText: "AI Wedding",
      headerTitle: "AI Wedding",
      footerTitle: "AI Wedding",
      seoTitle: "AI Wedding",
      background: "#f5f0e8",
      announce: "Wedding collections are private until you publish them to your couple gallery."
    }
  },
  {
    key: "executive-headshot-pro",
    markers: [
      "Executive headshots with a boardroom-grade finish",
      "Executive Headshot Pro",
      "Headshot packages buyers understand immediately"
    ],
    global: {
      logoText: "Executive Headshot Pro",
      headerTitle: "Executive Headshot Pro",
      footerTitle: "Executive Headshot Pro",
      seoTitle: "Executive Headshot Pro",
      background: "#eef2f7",
      announce: "Team portrait intake, billing, and private galleries stay scoped to this storefront."
    }
  },
  {
    key: "portrait-clean-studio",
    markers: [
      "Polished portrait sessions for modern personal brands",
      "Clean Portrait Studio",
      "Themed portrait packs from founder shots to dating profiles"
    ],
    global: {
      logoText: "Portrait Clean",
      headerTitle: "Portrait Clean",
      footerTitle: "Portrait Clean Studio",
      seoTitle: "Portrait Clean Studio",
      background: "#f8fafc",
      announce: "Clean portrait sets for profiles, bios, dating apps, and creator pages."
    }
  }
];
const activatedInternalThemes = [];
for (const themeCheck of internalThemeChecks) {
  const { json: internalThemeInstall } = await post(
    "/api/sites/site_lumen/theme/install",
    { actor: "smoke", themeKey: themeCheck.key, installType: "internal" },
    { cookie: lumenAdminCookie }
  );
  if (internalThemeInstall.theme?.source !== "imported" || internalThemeInstall.theme?.themeKey !== themeCheck.key) {
    throw new Error(`internal theme install did not create an imported theme record for ${themeCheck.key}`);
  }
  const stateBeforeInternalApply = await get("/api/platform/sites", { cookie: platformCookie });
  const lumenBeforeInternalApply = stateBeforeInternalApply.json.sites?.find((site) => site.id === "site_lumen");
  const liveBeforeInternalApplyHtml = await (await get("/site/lumen")).response.text();
  const preApplyIdentity = {
    name: lumenBeforeInternalApply?.name,
    logoText: lumenBeforeInternalApply?.branding?.logoText,
    market: lumenBeforeInternalApply?.branding?.market,
    description: lumenBeforeInternalApply?.branding?.description
  };
  const preApplyPublishedSettings = JSON.stringify(lumenBeforeInternalApply?.themeSettings?.publishedJson ?? {});

  const { json: internalThemeApply } = await post(
    `/api/sites/site_lumen/theme/${internalThemeInstall.theme.id}/apply-to-draft`,
    { actor: "smoke" },
    { cookie: lumenAdminCookie }
  );
  if (internalThemeApply.theme?.id !== internalThemeInstall.theme.id) {
    throw new Error(`internal theme apply-to-draft failed for ${themeCheck.key}`);
  }
  const stateAfterInternalApply = await get("/api/platform/sites", { cookie: platformCookie });
  const lumenAfterInternalApply = stateAfterInternalApply.json.sites?.find((site) => site.id === "site_lumen");
  const draftSettingsAfterInternalApply = lumenAfterInternalApply?.themeSettings?.draftJson;
  if (
    draftSettingsAfterInternalApply?.colors?.background !== themeCheck.global.background ||
    draftSettingsAfterInternalApply?.globalSections?.header?.settings?.title !== themeCheck.global.headerTitle ||
    draftSettingsAfterInternalApply?.globalSections?.footer?.settings?.title !== themeCheck.global.footerTitle ||
    draftSettingsAfterInternalApply?.seo?.siteTitle !== themeCheck.global.seoTitle ||
    draftSettingsAfterInternalApply?.saasSettingsCurrent?.sections?.header_plus?.settings?.announce_title !== themeCheck.global.announce
  ) {
    throw new Error(`internal theme ${themeCheck.key} did not apply full global draft settings`);
  }
  if (
    lumenAfterInternalApply?.name !== preApplyIdentity.name ||
    lumenAfterInternalApply?.branding?.logoText !== preApplyIdentity.logoText ||
    lumenAfterInternalApply?.branding?.market !== preApplyIdentity.market ||
    lumenAfterInternalApply?.branding?.description !== preApplyIdentity.description ||
    JSON.stringify(lumenAfterInternalApply?.themeSettings?.publishedJson ?? {}) !== preApplyPublishedSettings
  ) {
    throw new Error(`internal theme ${themeCheck.key} apply-to-draft leaked into site identity or published settings`);
  }
  const liveAfterInternalApplyHtml = await (await get("/site/lumen")).response.text();
  if (stableStorefrontHtml(liveAfterInternalApplyHtml) !== stableStorefrontHtml(liveBeforeInternalApplyHtml)) {
    throw new Error(`internal theme ${themeCheck.key} apply-to-draft changed the live storefront before activation`);
  }

  const { json: internalThemeActivate } = await post(
    `/api/sites/site_lumen/theme/${internalThemeInstall.theme.id}/activate`,
    { actor: "smoke" },
    { cookie: lumenAdminCookie }
  );
  if (internalThemeActivate.theme?.status !== "active") {
    throw new Error(`internal theme activate failed for ${themeCheck.key}`);
  }
  const stateAfterInternalActivate = await get("/api/platform/sites", { cookie: platformCookie });
  const lumenAfterInternalActivate = stateAfterInternalActivate.json.sites?.find((site) => site.id === "site_lumen");
  const publishedSettingsAfterInternalActivate = lumenAfterInternalActivate?.themeSettings?.publishedJson;
  if (
    lumenAfterInternalActivate?.name !== themeCheck.global.seoTitle ||
    lumenAfterInternalActivate?.branding?.logoText !== themeCheck.global.logoText ||
    publishedSettingsAfterInternalActivate?.colors?.background !== themeCheck.global.background ||
    publishedSettingsAfterInternalActivate?.globalSections?.header?.settings?.title !== themeCheck.global.headerTitle ||
    publishedSettingsAfterInternalActivate?.globalSections?.footer?.settings?.title !== themeCheck.global.footerTitle ||
    publishedSettingsAfterInternalActivate?.seo?.siteTitle !== themeCheck.global.seoTitle
  ) {
    throw new Error(`internal theme ${themeCheck.key} did not publish full global settings`);
  }
  const storefrontAfterInternalTheme = await get("/site/lumen");
  const storefrontAfterInternalThemeHtml = await storefrontAfterInternalTheme.response.text();
  for (const marker of themeCheck.markers) {
    if (!storefrontAfterInternalThemeHtml.includes(marker)) {
      throw new Error(`internal theme ${themeCheck.key} did not change storefront content: ${marker}`);
    }
  }
  if (themeCheck.key === "wedding-story-house") {
    for (const marker of [
      "Choose your wedding story package.",
      "Essential",
      "Premium",
      "Deluxe",
      "15 AI-generated photos",
      "30 AI-generated photos",
      "60 AI-generated photos",
      "Private gallery delivery",
      "Start your journey"
    ]) {
      if (!storefrontAfterInternalThemeHtml.includes(marker)) {
        throw new Error(`wedding storefront missing pricing module marker: ${marker}`);
      }
    }
    expectNoHtmlMarkers(
      storefrontAfterInternalThemeHtml,
      [
        "Site pricing records",
        "Connected to current pricing",
        ">Settlement<",
        "Total grant volume",
        "real site products",
        "This wall binds",
        "binds to",
        "product logic",
        "settings_schema",
        "XFCart edit protocol",
        "worker payload",
        "standard AI business",
        "payment settlement",
        "requestJson",
        "resultJson",
        "storageKey"
      ],
      "wedding storefront"
    );
    for (const marker of [
      "photo-santorini.png?v=20260607a",
      "photo-paris.png?v=20260607a",
      "photo-bali.png?v=20260607a",
      "Tired of These Wedding Photo Problems?",
      "AI Makes It Possible.",
      "How It Works",
      "Popular Destinations",
      "Inspiring Examples",
      "Loved by Couples Worldwide",
      "Choose your wedding story package.",
      "Private by design. Clear from checkout to gallery.",
      "Frequently Asked Questions",
      "Your Love Story, Anywhere.",
      "data-section-type=\"metric_strip\"",
      "data-section-type=\"sample_strip\"",
      "data-section-type=\"luxury_highlight\"",
      "data-section-type=\"studio_steps\"",
      "data-section-type=\"destination_showcase\"",
      "data-section-type=\"example_gallery\"",
      "data-section-type=\"testimonial_wall\"",
      "data-section-type=\"pricing_table\"",
      "data-section-type=\"trust_signal_bar\"",
      "data-section-type=\"faq\"",
      "data-section-type=\"final_cta\""
    ]) {
      if (!storefrontAfterInternalThemeHtml.includes(marker)) {
        throw new Error(`wedding storefront missing commercial theme marker: ${marker}`);
      }
    }
    for (const marker of ["gpt-image-2-wedding-hero-wide-20260606.png", "gpt-image-2-wedding-hero-20260606.png"]) {
      if (storefrontAfterInternalThemeHtml.includes(marker)) {
        throw new Error(`wedding storefront kept old generated hero asset: ${marker}`);
      }
    }
    const weddingDesignerPage = await get("/site/lumen/admin/design", { cookie: lumenAdminCookie });
    const weddingDesignerHtml = await weddingDesignerPage.response.text();
    for (const marker of [
      "首屏横幅",
      "数据指标条",
      "目的地展示",
      "灵感案例墙",
      "收尾转化",
      "子块",
      "按钮 · See Examples",
      "指标 · Dream Destinations",
      "data-designer-layout=\"xfcart-collapsible-block-tree\""
    ]) {
      if (!weddingDesignerHtml.includes(marker)) {
        throw new Error(`wedding designer tree missing readable SaaS decorator marker: ${marker}`);
      }
    }
    if (weddingDesignerHtml.includes(">Final CTA<") || weddingDesignerHtml.includes("Final CTA#journey")) {
      throw new Error("wedding designer tree still shows the final CTA section in English");
    }
	    const weddingHomePage = lumenAfterInternalActivate?.pages?.find((page) => page.pageType === "home");
	    const weddingPublishedHome = weddingHomePage?.publishedJson;
      const expectedWeddingHomeOrder = [
        "hero_1",
        "metrics_1",
        "pain_points_1",
        "luxury_highlight_1",
        "workflow_1",
        "destinations_1",
        "examples_1",
        "proof_1",
        "pricing_1",
        "trust_1",
        "faq_1",
        "final_cta_1"
      ];
      if (!weddingPublishedHome) {
        throw new Error("wedding published home snapshot was not available");
      }
      if (JSON.stringify(weddingPublishedHome.sectionsOrder) !== JSON.stringify(expectedWeddingHomeOrder)) {
        throw new Error(`wedding published home order is not the full commercial order: ${JSON.stringify(weddingPublishedHome.sectionsOrder)}`);
      }
	    const weddingRequiredSectionTypes = new Map([
	      ["hero_1", "hero"],
	      ["metrics_1", "metric_strip"],
        ["pain_points_1", "sample_strip"],
        ["luxury_highlight_1", "luxury_highlight"],
        ["workflow_1", "studio_steps"],
	      ["destinations_1", "destination_showcase"],
        ["examples_1", "example_gallery"],
	      ["proof_1", "testimonial_wall"],
        ["pricing_1", "pricing_table"],
        ["trust_1", "trust_signal_bar"],
	      ["faq_1", "faq"],
        ["final_cta_1", "final_cta"]
	    ]);
	    for (const [sectionId, sectionType] of weddingRequiredSectionTypes) {
	      if (weddingPublishedHome.sections?.[sectionId]?.type !== sectionType) {
	        throw new Error(`wedding published home missing ${sectionId} ${sectionType} section`);
	      }
	    }
	    const weddingProofBlocks = weddingPublishedHome?.sections?.proof_1?.blocks ?? [];
	    if (weddingProofBlocks.length !== 10) {
	      throw new Error(`wedding testimonial wall expected 10 customer proof blocks, got ${weddingProofBlocks.length}`);
	    }
	    const weddingProofBlocksMissingMedia = weddingProofBlocks
	      .filter((block) => !block?.settings?.avatarUrl || !block?.settings?.resultImageUrl)
	      .map((block) => block?.id ?? "unknown");
	    if (weddingProofBlocksMissingMedia.length) {
	      throw new Error(`wedding testimonial blocks missing avatar/result media: ${weddingProofBlocksMissingMedia.join(", ")}`);
	    }
	    const weddingHeroSectionId = weddingHomePage?.draftJson?.sectionsOrder?.find((sectionId) => weddingHomePage.draftJson.sections?.[sectionId]?.type === "hero");
	    const weddingHeroSection = weddingHeroSectionId ? weddingHomePage?.draftJson?.sections?.[weddingHeroSectionId] : undefined;
	    const weddingLuxurySectionId = weddingHomePage?.draftJson?.sectionsOrder?.find((sectionId) => weddingHomePage.draftJson.sections?.[sectionId]?.type === "luxury_highlight");
	    const weddingLuxurySection = weddingLuxurySectionId ? weddingHomePage?.draftJson?.sections?.[weddingLuxurySectionId] : undefined;
	    const weddingSampleSectionId = weddingHomePage?.draftJson?.sectionsOrder?.find((sectionId) => weddingHomePage.draftJson.sections?.[sectionId]?.type === "sample_strip");
	    const weddingSampleSection = weddingSampleSectionId ? weddingHomePage?.draftJson?.sections?.[weddingSampleSectionId] : undefined;
	    const weddingFinalCtaSectionId = weddingHomePage?.draftJson?.sectionsOrder?.find((sectionId) => weddingHomePage.draftJson.sections?.[sectionId]?.type === "final_cta");
	    const weddingFinalCtaSection = weddingFinalCtaSectionId ? weddingHomePage?.draftJson?.sections?.[weddingFinalCtaSectionId] : undefined;
	    if (!weddingHomePage || !weddingHeroSectionId || !weddingHeroSection || !weddingLuxurySectionId || !weddingLuxurySection || !weddingSampleSectionId || !weddingSampleSection || !weddingFinalCtaSectionId || !weddingFinalCtaSection) {
	      throw new Error("wedding theme designer cycle could not resolve editable home sections");
	    }

	    const draftOnlyHeadline = `Smoke wedding draft hero ${Date.now().toString(36)}`;
	    const draftOnlyLeadTitle = `Smoke wedding lead card ${Date.now().toString(36)}`;
	    const draftOnlySampleFooter = `Smoke wedding sample footer ${Date.now().toString(36)}`;
	    const draftOnlySampleCta = `Smoke wedding sample CTA ${Date.now().toString(36)}`;
	    const draftOnlyFinalBadge = `Smoke wedding final badge ${Date.now().toString(36)}`;
	    const rollbackOnlyHeadline = `Smoke wedding rollback draft ${Date.now().toString(36)}`;
	    const rollbackOnlyLeadTitle = `Smoke wedding rollback lead ${Date.now().toString(36)}`;
	    const rollbackOnlySampleFooter = `Smoke wedding rollback footer ${Date.now().toString(36)}`;
	    const rollbackOnlyFinalBadge = `Smoke wedding rollback badge ${Date.now().toString(36)}`;
	    const draftOnlyMarkers = [draftOnlyHeadline, draftOnlyLeadTitle, draftOnlySampleFooter, draftOnlySampleCta, draftOnlyFinalBadge];
	    const rollbackOnlyMarkers = [rollbackOnlyHeadline, rollbackOnlyLeadTitle, rollbackOnlySampleFooter, rollbackOnlyFinalBadge];
	    if ([...draftOnlyMarkers, ...rollbackOnlyMarkers].some((marker) => storefrontAfterInternalThemeHtml.includes(marker))) {
	      throw new Error("wedding storefront unexpectedly contained smoke designer markers before draft edit");
	    }

    const { json: weddingDraftSave } = await put(
      `/api/sites/site_lumen/theme/pages/${weddingHomePage.id}/draft`,
      {
        draftJson: {
          ...weddingHomePage.draftJson,
          sections: {
            ...weddingHomePage.draftJson.sections,
	            [weddingHeroSectionId]: {
	              ...weddingHeroSection,
	              settings: {
	                ...weddingHeroSection.settings,
	                headline: draftOnlyHeadline
	              }
	            },
	            [weddingLuxurySectionId]: {
	              ...weddingLuxurySection,
	              settings: {
	                ...weddingLuxurySection.settings,
	                leadTitle: draftOnlyLeadTitle
	              }
	            },
	            [weddingSampleSectionId]: {
	              ...weddingSampleSection,
	              settings: {
	                ...weddingSampleSection.settings,
	                footerBody: draftOnlySampleFooter,
	                footerCtaLabel: draftOnlySampleCta
	              }
	            },
	            [weddingFinalCtaSectionId]: {
	              ...weddingFinalCtaSection,
	              settings: {
	                ...weddingFinalCtaSection.settings,
	                badgeLabel: draftOnlyFinalBadge
	              }
	            }
	          }
	        }
      },
      { cookie: lumenAdminCookie }
    );
    if (!weddingDraftSave.ok) {
      throw new Error("wedding theme home hero draft save failed");
    }

	    const weddingLiveAfterDraft = await (await get("/site/lumen")).response.text();
	    if (draftOnlyMarkers.some((marker) => weddingLiveAfterDraft.includes(marker))) {
	      throw new Error("wedding theme draft edit leaked into the live storefront before publish");
	    }
	    const weddingPreviewAfterDraft = await get(`/site/lumen/admin/design/preview/${weddingHomePage.id}`, { cookie: lumenAdminCookie });
	    const weddingPreviewAfterDraftHtml = await weddingPreviewAfterDraft.response.text();
	    for (const marker of draftOnlyMarkers) {
	      if (!weddingPreviewAfterDraftHtml.includes(marker)) {
	        throw new Error(`wedding theme designer preview did not reflect saved draft marker: ${marker}`);
	      }
	    }

    const { json: weddingPublish } = await post(
      `/api/sites/site_lumen/theme/pages/${weddingHomePage.id}/publish`,
      { actor: "smoke_wedding_designer" },
      { cookie: lumenAdminCookie }
    );
    if (!weddingPublish.publishedVersion) {
      throw new Error("wedding theme home hero publish did not create a published version");
	    }
	    const weddingLiveAfterPublish = await (await get("/site/lumen")).response.text();
	    for (const marker of draftOnlyMarkers) {
	      if (!weddingLiveAfterPublish.includes(marker)) {
	        throw new Error(`wedding theme published storefront did not reflect draft marker after publish: ${marker}`);
	      }
	    }

	    const stateAfterWeddingPublish = await get("/api/platform/sites", { cookie: platformCookie });
	    const lumenAfterWeddingPublish = stateAfterWeddingPublish.json.sites?.find((site) => site.id === "site_lumen");
	    const weddingHomeAfterPublish = lumenAfterWeddingPublish?.pages?.find((page) => page.id === weddingHomePage.id);
	    const weddingHeroAfterPublish = weddingHomeAfterPublish?.draftJson?.sections?.[weddingHeroSectionId];
	    const weddingLuxuryAfterPublish = weddingHomeAfterPublish?.draftJson?.sections?.[weddingLuxurySectionId];
	    const weddingSampleAfterPublish = weddingHomeAfterPublish?.draftJson?.sections?.[weddingSampleSectionId];
	    const weddingFinalCtaAfterPublish = weddingHomeAfterPublish?.draftJson?.sections?.[weddingFinalCtaSectionId];
	    if (!weddingHomeAfterPublish || !weddingHeroAfterPublish || !weddingLuxuryAfterPublish || !weddingSampleAfterPublish || !weddingFinalCtaAfterPublish) {
	      throw new Error("wedding theme designer cycle could not resolve the published home sections");
	    }
	    const { json: weddingRollbackDraftSave } = await put(
      `/api/sites/site_lumen/theme/pages/${weddingHomePage.id}/draft`,
      {
        draftJson: {
          ...weddingHomeAfterPublish.draftJson,
          sections: {
            ...weddingHomeAfterPublish.draftJson.sections,
	            [weddingHeroSectionId]: {
	              ...weddingHeroAfterPublish,
	              settings: {
	                ...weddingHeroAfterPublish.settings,
	                headline: rollbackOnlyHeadline
	              }
	            },
	            [weddingLuxurySectionId]: {
	              ...weddingLuxuryAfterPublish,
	              settings: {
	                ...weddingLuxuryAfterPublish.settings,
	                leadTitle: rollbackOnlyLeadTitle
	              }
	            },
	            [weddingSampleSectionId]: {
	              ...weddingSampleAfterPublish,
	              settings: {
	                ...weddingSampleAfterPublish.settings,
	                footerBody: rollbackOnlySampleFooter
	              }
	            },
	            [weddingFinalCtaSectionId]: {
	              ...weddingFinalCtaAfterPublish,
	              settings: {
	                ...weddingFinalCtaAfterPublish.settings,
	                badgeLabel: rollbackOnlyFinalBadge
	              }
	            }
	          }
	        }
      },
      { cookie: lumenAdminCookie }
    );
    if (!weddingRollbackDraftSave.ok) {
      throw new Error("wedding theme rollback-only draft save failed");
	    }
	    const weddingLiveBeforeRollback = await (await get("/site/lumen")).response.text();
	    if (rollbackOnlyMarkers.some((marker) => weddingLiveBeforeRollback.includes(marker))) {
	      throw new Error("wedding theme rollback-only draft leaked into the live storefront");
	    }
    await post(
      `/api/sites/site_lumen/theme/pages/${weddingHomePage.id}/rollback`,
      { actor: "smoke_wedding_designer" },
      { cookie: lumenAdminCookie }
    );
    const stateAfterWeddingRollback = await get("/api/platform/sites", { cookie: platformCookie });
	    const lumenAfterWeddingRollback = stateAfterWeddingRollback.json.sites?.find((site) => site.id === "site_lumen");
	    const weddingHomeAfterRollback = lumenAfterWeddingRollback?.pages?.find((page) => page.id === weddingHomePage.id);
	    const rolledBackHeadline = weddingHomeAfterRollback?.draftJson?.sections?.[weddingHeroSectionId]?.settings?.headline;
	    const rolledBackLeadTitle = weddingHomeAfterRollback?.draftJson?.sections?.[weddingLuxurySectionId]?.settings?.leadTitle;
	    const rolledBackSampleFooter = weddingHomeAfterRollback?.draftJson?.sections?.[weddingSampleSectionId]?.settings?.footerBody;
	    const rolledBackFinalBadge = weddingHomeAfterRollback?.draftJson?.sections?.[weddingFinalCtaSectionId]?.settings?.badgeLabel;
	    if (
	      rolledBackHeadline !== draftOnlyHeadline ||
	      rolledBackLeadTitle !== draftOnlyLeadTitle ||
	      rolledBackSampleFooter !== draftOnlySampleFooter ||
	      rolledBackFinalBadge !== draftOnlyFinalBadge ||
	      rollbackOnlyMarkers.some((marker) =>
	        [rolledBackHeadline, rolledBackLeadTitle, rolledBackSampleFooter, rolledBackFinalBadge].includes(marker)
	      )
	    ) {
	      throw new Error("wedding theme rollback did not restore the draft from the published snapshot");
	    }
	    report.weddingDesignerCycle = {
	      pageId: weddingHomePage.id,
	      sectionId: weddingHeroSectionId,
	      editableSections: {
	        hero: weddingHeroSectionId,
	        luxuryHighlight: weddingLuxurySectionId,
	        sampleStrip: weddingSampleSectionId,
	        finalCta: weddingFinalCtaSectionId
	      },
	      draftPreview: true,
	      draftIsolation: true,
	      publish: true,
      rollback: true
    };
  }
  activatedInternalThemes.push(themeCheck.key);
}
const { json: atlasInternalThemeInstall } = await post(
  "/api/sites/site_atlas/theme/install",
  { actor: "smoke", themeKey: "executive-headshot-pro", installType: "internal" },
  { cookie: atlasAdminCookie }
);
if (atlasInternalThemeInstall.theme?.themeKey !== "executive-headshot-pro") {
  throw new Error("atlas internal theme install did not create the expected imported theme");
}
await post(
  `/api/sites/site_atlas/theme/${atlasInternalThemeInstall.theme.id}/apply-to-draft`,
  { actor: "smoke" },
  { cookie: atlasAdminCookie }
);
await post(
  `/api/sites/site_atlas/theme/${atlasInternalThemeInstall.theme.id}/activate`,
  { actor: "smoke" },
  { cookie: atlasAdminCookie }
);
const atlasAfterThemeHtml = await expectHtml("/site/atlas", [
  "Executive headshots with a boardroom-grade finish",
  "Executive Headshot Pro",
  "Headshot packages buyers understand immediately"
]);
if (atlasAfterThemeHtml.includes(">Lumen</span>")) {
  throw new Error("atlas storefront leaked Lumen brand text after internal theme activation");
}
const lumenAfterAtlasThemeHtml = await expectHtml("/site/lumen", [
  "Polished portrait sessions for modern personal brands",
  "Clean Portrait Studio",
  "Themed portrait packs from founder shots to dating profiles"
]);
if (lumenAfterAtlasThemeHtml.includes("Executive Headshot Pro")) {
  throw new Error("atlas theme activation polluted the Lumen storefront");
}
report.crossSiteThemeIsolation = {
  atlasTheme: "executive-headshot-pro",
  lumenThemeUnaffected: true
};

const { json: modelUpdate } = await patch(
  "/api/sites/site_lumen/customer-models/model_lumen_mara_couple",
  {
    status: "ready",
    providerModelId: "prov_smoke_couple_ready",
    inputAssetCount: 18
  },
  { cookie: lumenAdminCookie }
);
if (modelUpdate.model?.status !== "ready" || modelUpdate.model?.providerModelId !== "prov_smoke_couple_ready") {
  throw new Error("customer model update did not persist");
}

const { json: albumUpdate } = await patch(
  "/api/sites/site_lumen/albums/album_lumen_mara_pending",
  {
    title: "Wedding portrait client review",
    status: "hidden",
    outputCount: 3
  },
  { cookie: lumenAdminCookie }
);
if (albumUpdate.album?.status !== "hidden" || albumUpdate.album?.title !== "Wedding portrait client review") {
  throw new Error("album update did not persist");
}

report.dreamShootOps = {
  packCredits: packUpdate.pack.creditCost,
  mediaLabel: mediaUpdate.asset.label,
  modelStatus: modelUpdate.model.status,
  albumStatus: albumUpdate.album.status,
  storefrontBrandingPublished: true,
  contentPolicyPublished: true,
  internalThemesActivated: activatedInternalThemes
};
const publicRouteChecks = [
  { path: "/site/lumen/pricing", markers: ["data-theme-sections-root", "xfcart-section-header_plus"] },
  { path: "/site/lumen/help", markers: ["data-theme-sections-root", "xfcart-section-footer_plus"] },
  { path: "/site/lumen/blog", markers: ["data-theme-sections-root", "xfcart-section-header_plus"] },
  { path: "/site/lumen/policies/privacy", markers: ["data-theme-sections-root", "xfcart-section-header_plus"] },
  { path: "/site/lumen/policies/refunds", markers: ["data-theme-sections-root", "xfcart-section-header_plus"] },
  {
    path: "/site/lumen/policies/content",
    markers: ["data-theme-sections-root", 'data-section-type="policy_content"']
  }
];
for (const route of publicRouteChecks) {
  const response = await get(route.path);
  if (!response.response.ok) throw new Error(`${route.path} did not render as a storefront page`);
  const html = await response.response.text();
  for (const marker of route.markers) {
    if (!html.includes(marker)) throw new Error(`${route.path} missing storefront page marker: ${marker}`);
  }
}
report.pageCoverage = {
  adminPages: adminRouteChecks.length + newSiteAdminRouteChecks.length + 6,
  storefrontPages: publicRouteChecks.length + newSiteStorefrontRoutes.length + 12,
  authenticatedPages: 4
};

const { json: statusUpdate } = await patch(
  `/api/sites/site_lumen/customers/${login.customer.id}/status`,
  { status: "blocked" },
  { cookie: lumenAdminCookie }
);
if (statusUpdate.customer?.status !== "blocked" || statusUpdate.customer?.passwordHash) {
  throw new Error("customer status update did not persist safely");
}
await patch(`/api/sites/site_lumen/customers/${login.customer.id}/status`, { status: "active" }, { cookie: lumenAdminCookie });
report.customerStatus = "blocked_then_active";

const { json: adjustment } = await post(
  `/api/sites/site_lumen/customers/${login.customer.id}/credits/adjust`,
  { amount: 11, reason: "smoke adjustment", actor: "smoke" },
  { cookie: lumenAdminCookie }
);
if (adjustment.ledgerAction?.type !== "adjustment" || adjustment.customer?.balance?.available !== 179 || adjustment.customer?.passwordHash) {
  throw new Error("manual credit adjustment failed or leaked auth data");
}
report.creditAdjustment = {
  amount: adjustment.ledgerAction.amount,
  balance: adjustment.customer.balance
};

await post(`/api/internal/ai-worker/jobs/${created.job.id}/status`, {
  siteId: "site_lumen",
  requestId: `req_${created.job.id}`,
  status: "running",
  stage: "smoke_started"
}, { transientRetries: 3 });

const resultPayload = {
  jobId: created.job.id,
  siteId: "site_lumen",
  requestId: `req_${created.job.id}`,
  status: "succeeded",
  outputs: [
    {
      storageKey: `sites/site_lumen/customers/${login.customer.id}/jobs/${created.job.id}/out_001.webp`,
      mimeType: "image/webp"
    }
  ],
  providerTrace: [{ provider: "n8n.dev.worker", attempts: 1 }],
  costTrace: { estimatedCostUsd: 0.12 }
};
const { json: settled } = await post(`/api/internal/ai-worker/jobs/${created.job.id}/result`, resultPayload, { transientRetries: 3 });
if (settled.ledgerAction?.type !== "consume" || settled.customerBalance.reserved !== 24 || settled.customer?.passwordHash) {
  throw new Error("worker result did not consume reserved credits safely");
}
const { json: assetsAfterResult } = await get(`/api/sites/site_lumen/customers/${login.customer.id}/assets`, {
  cookie: customerCookie
});
const outputAsset = assetsAfterResult.assets?.find((asset) => asset.jobId === created.job.id && asset.role === "output");
if (!outputAsset) {
  throw new Error("worker output was not converted into an album asset");
}
if (!outputAsset.previewUrl || outputAsset.storageKey || outputAsset.customerId || outputAsset.siteId) {
  throw new Error("worker output asset public response leaked internal fields");
}
const stateAfterWorker = await get("/api/platform/sites", { cookie: platformCookie });
const lumenAfterWorker = stateAfterWorker.json.sites?.find((site) => site.id === "site_lumen");
if (!lumenAfterWorker) {
  throw new Error("platform sites API did not include Lumen after worker");
}
const { json: outputDownload } = await post(
  `/api/sites/site_lumen/customers/${login.customer.id}/assets/${outputAsset.id}/download`,
  {},
  { cookie: customerCookie }
);
if (!outputDownload.downloadUrl) {
  throw new Error("output asset signed download link was not created");
}
const { json: replay } = await post(`/api/internal/ai-worker/jobs/${created.job.id}/result`, resultPayload, { transientRetries: 3 });
if (!replay.alreadyProcessed || replay.ledgerAction !== null) {
  throw new Error("duplicate worker result was not idempotent");
}
report.workerResult = {
  status: settled.job.status,
  balance: settled.customerBalance,
  outputAssetId: outputAsset.id,
  replayAlreadyProcessed: replay.alreadyProcessed
};

const failed = await post(
  "/api/sites/site_lumen/ai/jobs",
  { customerId: login.customer.id, aiAppSlug: "image_generator", params: { style: "studio", outputCount: 4 } },
  { cookie: customerCookie }
);
const failedJobId = failed.json.job.id;
await post(`/api/internal/ai-worker/jobs/${failedJobId}/result`, {
  jobId: failedJobId,
  siteId: "site_lumen",
  requestId: `req_${failedJobId}`,
  status: "failed",
  outputs: [],
  providerTrace: [{ provider: "n8n.dev.worker", attempts: 1 }],
  costTrace: { estimatedCostUsd: 0.02 },
  error: "smoke failure"
});
const { json: rerun } = await post(
  `/api/sites/site_lumen/ai/jobs/${failedJobId}/rerun`,
  { actor: "smoke" },
  { cookie: lumenAdminCookie }
);
if (rerun.sourceJob?.id !== failedJobId || rerun.job?.requestJson?.rerunOf !== failedJobId || rerun.ledgerAction?.type !== "reserve") {
  throw new Error("failed job rerun did not create a reserved follow-up job");
}
report.rerun = {
  sourceJob: rerun.sourceJob.id,
  rerunJob: rerun.job.id,
  balance: rerun.customerBalance
};

const stripePayload = {
  id: "evt_smoke_credit_001",
  type: "checkout.session.completed",
  account: "acct_lumen_42x",
  data: {
    object: {
      metadata: {
        siteId: "site_lumen",
        customerId: login.customer.id,
        priceId: "price_lumen_pack"
      }
    }
  }
};
const { json: webhook } = await post("/api/stripe/connect/webhook", stripePayload, { transientRetries: 3 });
const { json: webhookReplay } = await post("/api/stripe/connect/webhook", stripePayload, { transientRetries: 3 });
const webhookGranted = webhook.ledgerAction?.type === "grant";
const webhookAlreadyProcessed = webhook.ledgerAction === null && webhook.alreadyProcessed;
if ((!webhookGranted && !webhookAlreadyProcessed) || webhookReplay.ledgerAction !== null || !webhookReplay.alreadyProcessed) {
  throw new Error("stripe webhook idempotency failed");
}
report.webhook = {
  ledgerType: webhook.ledgerAction?.type ?? "already_processed",
  amount: webhook.ledgerAction?.amount ?? 0,
  replayAlreadyProcessed: webhookReplay.alreadyProcessed
};

console.log(JSON.stringify(report, null, 2));
}

try {
  await runSmoke();
} finally {
  await resetPlatformStateWithRetry().catch((error) => {
    console.error(`final smoke reset failed: ${error.message}`);
  });
}
