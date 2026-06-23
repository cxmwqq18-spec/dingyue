function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeConfig(config) {
  if (!config || config.provider !== "resend") return undefined;
  return {
    provider: "resend",
    id: config.id,
    label: config.label,
    apiKey: config.apiKey,
    fromEmail: config.fromEmail,
    replyTo: config.replyTo,
    isDefault: Boolean(config.isDefault)
  };
}

function listEmailConfigs(state) {
  const configs = Array.isArray(state.platformEmailConfigs)
    ? state.platformEmailConfigs.map(normalizeConfig).filter(Boolean)
    : [];

  if (configs.length > 0) return configs;
  const legacy = normalizeConfig({
    id: "platform_email_settings",
    label: "Platform default",
    isDefault: true,
    ...state.platformEmailSettings
  });
  return legacy ? [legacy] : [{ provider: "resend", id: "platform_email_settings", label: "Platform default", isDefault: true }];
}

function defaultEmailConfig(state) {
  const configs = listEmailConfigs(state);
  return configs.find((config) => config.isDefault) ?? configs[0];
}

function emailConfigForSite(state, siteId) {
  const configs = listEmailConfigs(state);
  const assignment = Array.isArray(state.siteEmailConfigAssignments)
    ? state.siteEmailConfigAssignments.find((item) => item.siteId === siteId)
    : undefined;
  return configs.find((config) => config.id === assignment?.configId) ?? defaultEmailConfig(state);
}

const baseState = {
  platformEmailSettings: {
    provider: "resend",
    apiKey: "re_legacy_123456789012345678901234567890",
    fromEmail: "legacy@example.com",
    replyTo: "legacy-reply@example.com"
  },
  platformEmailConfigs: [
    {
      provider: "resend",
      id: "resend_primary",
      label: "Primary Resend",
      apiKey: "re_primary_123456789012345678901234567890",
      fromEmail: "verify@primary.example.com",
      replyTo: "support@primary.example.com",
      isDefault: true
    },
    {
      provider: "resend",
      id: "resend_store_a",
      label: "Store A Resend",
      apiKey: "re_store_a_123456789012345678901234567890",
      fromEmail: "verify@store-a.example.com",
      replyTo: "support@store-a.example.com"
    },
    {
      provider: "resend",
      id: "resend_store_b",
      label: "Store B Resend",
      apiKey: "re_store_b_123456789012345678901234567890",
      fromEmail: "verify@store-b.example.com",
      replyTo: "support@store-b.example.com"
    }
  ],
  siteEmailConfigAssignments: [
    { siteId: "site_a", configId: "resend_store_a" },
    { siteId: "site_b", configId: "resend_store_b" }
  ]
};

const configs = listEmailConfigs(baseState);
assert(configs.length === 3, `expected multiple resend configs to be preserved, got ${configs.length}`);
assert(configs.map((config) => config.id).join(",") === "resend_primary,resend_store_a,resend_store_b", "multi config order changed");

const defaultConfig = defaultEmailConfig(baseState);
assert(defaultConfig.id === "resend_primary", `expected explicit default config, got ${defaultConfig.id}`);
assert(emailConfigForSite(baseState, "site_unknown").id === "resend_primary", "unassigned site did not use default config");

const siteAConfig = emailConfigForSite(baseState, "site_a");
assert(siteAConfig.id === "resend_store_a", `site_a selected wrong config: ${siteAConfig.id}`);
assert(siteAConfig.fromEmail === "verify@store-a.example.com", "site_a did not use its bound sender");

const siteBConfig = emailConfigForSite(baseState, "site_b");
assert(siteBConfig.id === "resend_store_b", `site_b selected wrong config: ${siteBConfig.id}`);
assert(siteBConfig.apiKey !== siteAConfig.apiKey, "single-site config isolation failed: api keys overlapped");
assert(siteBConfig.fromEmail !== siteAConfig.fromEmail, "single-site config isolation failed: senders overlapped");

const invalidAssignmentState = {
  ...baseState,
  siteEmailConfigAssignments: [{ siteId: "site_a", configId: "missing_config" }]
};
assert(emailConfigForSite(invalidAssignmentState, "site_a").id === "resend_primary", "missing assignment target did not fall back to default");

const legacyState = {
  platformEmailSettings: baseState.platformEmailSettings,
  platformEmailConfigs: undefined,
  siteEmailConfigAssignments: [{ siteId: "site_a", configId: "resend_store_a" }]
};
const legacyConfig = emailConfigForSite(legacyState, "site_a");
assert(legacyConfig.id === "platform_email_settings", `legacy platformEmailSettings id mismatch: ${legacyConfig.id}`);
assert(legacyConfig.apiKey === baseState.platformEmailSettings.apiKey, "legacy platformEmailSettings api key was not preserved");
assert(legacyConfig.fromEmail === "legacy@example.com", "legacy platformEmailSettings sender was not preserved");

console.log(JSON.stringify({
  ok: true,
  configs: configs.map((config) => ({ id: config.id, default: config.isDefault })),
  defaultConfigId: defaultConfig.id,
  siteBindings: {
    site_a: siteAConfig.id,
    site_b: siteBConfig.id,
    unassigned: emailConfigForSite(baseState, "site_unknown").id,
    legacy: legacyConfig.id
  }
}, null, 2));
