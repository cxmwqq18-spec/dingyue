import fs from "fs/promises";
import path from "path";
import {
  weddingStoryHouseSiteSettings,
  weddingStoryHouseTemplates
} from "../src/lib/theme/packages/wedding-story-house/templates.ts";

const workspaceRoot = process.cwd();
const dataPath = path.join(workspaceRoot, "data", "platform-state.json");
const siteId = "site_lumen";
const siteSlug = "lumen";
const now = "2026-06-06T00:00:00.000Z";
const weddingSiteName = "AI Wedding";
const weddingDescription =
  weddingStoryHouseSiteSettings.branding?.description ??
  "Boutique wedding AI storefront for engagement previews, bridal portraits, ceremony stories, and reception recap albums.";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toSaasSection(section) {
  return {
    type: section.type,
    version: "1",
    card_name: section.type,
    settings: section.settings ?? {},
    blocks: section.blocks ?? []
  };
}

function toSaasTemplate(pageJson) {
  const sections = Object.fromEntries(
    Object.entries(pageJson.sections)
      .filter(([, section]) => section?.type)
      .map(([id, section]) => [id, toSaasSection(section)])
  );
  return {
    content_for_page: pageJson.sectionsOrder.filter((id) => sections[id]),
    sections
  };
}

function toSaasSettings(settings) {
  const current = clone(settings.saasSettingsCurrent ?? {});
  const header = settings.globalSections?.header ?? {
    type: "header",
    settings: { title: settings.navigation?.headerLinks?.[0]?.label ?? "AI Wedding" },
    blocks: []
  };
  const footer = settings.globalSections?.footer ?? {
    type: "footer",
    settings: { title: weddingSiteName },
    blocks: []
  };

  return {
    settings_data: {
      current: {
        ...current,
        navigation: clone(settings.navigation),
        seo: clone(settings.seo ?? {}),
        general_layout_width: current.general_layout_width ?? 1280,
        general_layout_spacing: current.general_layout_spacing ?? 56,
        skin_bg: current.skin_bg ?? settings.colors.background,
        skin_title_color: current.skin_title_color ?? settings.colors.foreground,
        skin_text_color: current.skin_text_color ?? settings.colors.foreground,
        skin_primary_btn_bg_color: current.skin_primary_btn_bg_color ?? settings.colors.foreground,
        skin_primary_btn_text_color: current.skin_primary_btn_text_color ?? "#ffffff",
        skin_accent_color: current.skin_accent_color ?? settings.colors.accent,
        skin_muted_color: current.skin_muted_color ?? settings.colors.muted,
        skin_title_font_family: current.skin_title_font_family ?? settings.typography.display,
        skin_text_font_family: current.skin_text_font_family ?? settings.typography.body,
        sections: {
          ...((current.sections && typeof current.sections === "object" && !Array.isArray(current.sections)) ? current.sections : {}),
          header_plus: {
            ...toSaasSection(header),
            type: "header_plus",
            card_name: "Wedding header"
          },
          footer_plus: {
            ...toSaasSection(footer),
            type: "footer_plus",
            card_name: "Wedding footer"
          }
        }
      },
      presets: []
    }
  };
}

const pageMappings = [
  { idSuffix: "home", packageTemplate: "home", templateKey: "index", slug: "/", title: "Home", pageType: "home" },
  { idSuffix: "pricing", packageTemplate: "pricing", templateKey: "page", slug: "/pricing", title: "Pricing", pageType: "pricing" },
  { idSuffix: "collections", packageTemplate: "packages", templateKey: "collection", slug: "/collections", title: "Wedding collections", pageType: "collection" },
  { idSuffix: "collection_signature", packageTemplate: "package-detail", templateKey: "package-detail", slug: "/collections/signature-ceremony", title: "Signature ceremony collection", pageType: "package_detail" },
  { idSuffix: "tool_image", packageTemplate: "tool-detail", templateKey: "product", slug: "/tools/image-studio", title: "Wedding generator", pageType: "ai_tool" },
  { idSuffix: "login", packageTemplate: "login", templateKey: "login", slug: "/login", title: "Customer login", pageType: "login" },
  { idSuffix: "app", packageTemplate: "app-home", templateKey: "app-home", slug: "/app", title: "Wedding workspace", pageType: "workspace" },
  { idSuffix: "job_progress", packageTemplate: "job-progress", templateKey: "job-progress", slug: "/app/jobs/progress", title: "Job progress", pageType: "job_progress" },
  { idSuffix: "job_detail", packageTemplate: "job-detail", templateKey: "job-detail", slug: "/app/jobs/detail", title: "Job detail", pageType: "job_detail" },
  { idSuffix: "album", packageTemplate: "album", templateKey: "album", slug: "/album", title: "Private album", pageType: "album" },
  { idSuffix: "account", packageTemplate: "account-billing", templateKey: "account-billing", slug: "/account", title: "Account and billing", pageType: "account" },
  { idSuffix: "privacy", packageTemplate: "policy", templateKey: "privacy", slug: "/policies/privacy", title: "Privacy policy", pageType: "policy" },
  { idSuffix: "refunds", packageTemplate: "policy", templateKey: "refunds", slug: "/policies/refunds", title: "Refunds policy", pageType: "policy" },
  { idSuffix: "content", packageTemplate: "policy", templateKey: "content", slug: "/policies/content", title: "Content policy", pageType: "policy" },
  { idSuffix: "help", packageTemplate: "help", templateKey: "help", slug: "/help", title: "Help center", pageType: "help" },
  { idSuffix: "blog", packageTemplate: "blog-list", templateKey: "blog", slug: "/blog", title: "Wedding journal", pageType: "blog" },
  { idSuffix: "blog_detail", packageTemplate: "blog-detail", templateKey: "blog-detail", slug: "/blog/preparing-source-photos", title: "Preparing source photos", pageType: "article" },
  { idSuffix: "search", packageTemplate: "search", templateKey: "search", slug: "/search", title: "Search", pageType: "search" },
  { idSuffix: "cart", packageTemplate: "cart", templateKey: "cart", slug: "/cart", title: "Cart", pageType: "cart" },
  { idSuffix: "404", packageTemplate: "404", templateKey: "404", slug: "/404", title: "404", pageType: "404" }
];

function weddingPageJson(mapping, version) {
  const pageJson = clone(weddingStoryHouseTemplates[mapping.packageTemplate]);
  pageJson.pageType = mapping.pageType;
  pageJson.version = version;

  if (mapping.templateKey === "privacy" && pageJson.sections.policy_1) {
    pageJson.sections.policy_1.settings = {
      ...pageJson.sections.policy_1.settings,
      title: "Privacy policy",
      body: "<p>Couple uploads, wedding source files, generation requests, generated albums, orders, subscriptions, and credit history remain tied to this storefront and customer account.</p>"
    };
  }

  if (mapping.templateKey === "refunds" && pageJson.sections.policy_1) {
    pageJson.sections.policy_1.settings = {
      ...pageJson.sections.policy_1.settings,
      title: "Refunds policy",
      body: "<p>Refunds and billing reversals are recorded against this storefront. Checkout completion never grants credits before the payment is confirmed.</p>"
    };
  }

  if (mapping.templateKey === "content" && pageJson.sections.policy_1) {
    pageJson.sections.policy_1.settings = {
      ...pageJson.sections.policy_1.settings,
      title: "Content policy",
      body: "<p>Customers may upload only wedding, couple, venue, wardrobe, and inspiration assets they have permission to use. Private album delivery remains restricted to the signed-in customer.</p>"
    };
  }

  if (mapping.templateKey === "404" && pageJson.sections.article_1) {
    pageJson.sections.article_1.settings = {
      ...pageJson.sections.article_1.settings,
      eyebrow: "404",
      title: "This wedding story page is not available.",
      body: "Send customers back to collections, pricing, login, or the private album workspace."
    };
  }

  return pageJson;
}

function buildPages(version) {
  return pageMappings.map((mapping) => {
    const pageJson = weddingPageJson(mapping, version);
    return {
      id: `${siteId}_${mapping.idSuffix}`,
      siteId,
      pageType: mapping.pageType,
      templateKey: mapping.templateKey,
      slug: mapping.slug,
      title: mapping.title,
      draftJson: clone(pageJson),
      publishedJson: clone(pageJson)
    };
  });
}

function buildWeddingSettings() {
  const themeSettings = weddingStoryHouseSiteSettings.themeSettings ?? {};
  const globalSections = clone(themeSettings.globalSections ?? {});
  globalSections.header = {
    type: "header",
    settings: globalSections.header?.settings ?? {},
    blocks: globalSections.header?.blocks ?? []
  };
  globalSections.footer = {
    type: "footer",
    settings: globalSections.footer?.settings ?? {},
    blocks: globalSections.footer?.blocks ?? []
  };

  return {
    colors: {
      background: themeSettings.colors?.background ?? "#f5f0e8",
      foreground: themeSettings.colors?.foreground ?? "#171514",
      accent: themeSettings.colors?.accent ?? "#b8744f",
      muted: themeSettings.colors?.muted ?? "#eadfce"
    },
    typography: {
      display: themeSettings.typography?.display ?? "Manrope",
      body: themeSettings.typography?.body ?? "Geist"
    },
    radii: {
      section: themeSettings.radii?.section ?? 18,
      control: themeSettings.radii?.control ?? 12
    },
    navigation: {
      headerLinks: clone(themeSettings.navigation?.headerLinks ?? []),
      footerLinks: clone(themeSettings.navigation?.footerLinks ?? [])
    },
    globalSections,
    seo: {
      siteTitle: themeSettings.seo?.siteTitle ?? weddingSiteName,
      siteDescription: themeSettings.seo?.siteDescription ?? weddingDescription,
      titleTemplate: themeSettings.seo?.titleTemplate ?? `%s | ${weddingSiteName}`,
      defaultOgImage: themeSettings.seo?.defaultOgImage,
      robots: { index: true, follow: true },
      pages: {}
    },
    saasSettingsCurrent: clone(themeSettings.saasSettingsCurrent ?? {})
  };
}

function buildThemeRecord({ id, status, name, themeId, pages, settings }) {
  return {
    id,
    siteId,
    name,
    themeId,
    themeKey: "wedding-story-house",
    status,
    templates: Object.fromEntries(pages.map((page) => [page.templateKey || page.pageType, toSaasTemplate(status === "active" ? page.publishedJson : page.draftJson)])),
    settings: toSaasSettings(settings),
    source: "imported",
    createdBy: "admin_lumen_owner",
    createdAt: now,
    updatedAt: now
  };
}

function replaceById(items, nextItem) {
  const index = items.findIndex((item) => item.id === nextItem.id);
  if (index >= 0) items[index] = { ...items[index], ...nextItem };
  else items.push(nextItem);
}

function migrate() {
  const state = JSON.parse(awaitedReadFile);
  const site = state.sites.find((item) => item.id === siteId);
  if (!site) throw new Error(`${siteId} not found`);

  const maxVersion = Math.max(0, ...(state.themePublications ?? []).filter((publication) => publication.siteId === siteId).map((publication) => publication.version ?? 0));
  const nextVersion = maxVersion + 1;
  const pages = buildPages(nextVersion);
  const settings = buildWeddingSettings();

  site.name = weddingSiteName;
  site.slug = siteSlug;
  site.status = "active";
  site.primaryDomain = "lumen.localhost";
  site.currency = "usd";
  site.timezone = "America/Chicago";
  site.branding = {
    logoText: weddingStoryHouseSiteSettings.branding?.logoText ?? "AI Wedding",
    market: weddingStoryHouseSiteSettings.branding?.market ?? "Wedding AI albums and private couple delivery",
    description: weddingDescription
  };
  site.connect = {
    stripeAccountId: "acct_lumen_42x",
    status: "enabled",
    chargesEnabled: true,
    payoutsEnabled: true
  };
  site.themeSettings = {
    draftJson: clone(settings),
    publishedJson: clone(settings)
  };
  site.pages = pages;

  state.siteAdmins = (state.siteAdmins ?? []).map((admin) =>
    admin.siteId === siteId && admin.id === "admin_lumen_owner" ? { ...admin, displayName: "AI Wedding Owner" } : admin
  );

  replaceById(state.products, {
    id: "prod_lumen_essential",
    siteId,
    name: "Essential",
    type: "subscription",
    status: "active",
    prices: [
      {
        id: "price_lumen_essential",
        siteId,
        productId: "prod_lumen_essential",
        label: "Essential",
        amountCents: 7900,
        currency: "usd",
        interval: "month",
        creditsGranted: 60,
        stripePriceId: "price_lumen_essential_60",
        metadata: {
          generatedPhotos: 15,
          destinationCount: 2,
          deliveryDays: 3,
          revisions: "basic",
          featured: false
        }
      }
    ]
  });
  replaceById(state.products, {
    id: "prod_lumen_premium",
    siteId,
    name: "Premium",
    type: "subscription",
    status: "active",
    prices: [
      {
        id: "price_lumen_premium",
        siteId,
        productId: "prod_lumen_premium",
        label: "Premium",
        amountCents: 14900,
        currency: "usd",
        interval: "month",
        creditsGranted: 120,
        stripePriceId: "price_lumen_premium_120",
        metadata: {
          generatedPhotos: 30,
          destinationCount: 4,
          deliveryDays: 2,
          revisions: "priority",
          featured: true
        }
      }
    ]
  });
  replaceById(state.products, {
    id: "prod_lumen_deluxe",
    siteId,
    name: "Deluxe",
    type: "subscription",
    status: "active",
    prices: [
      {
        id: "price_lumen_deluxe",
        siteId,
        productId: "prod_lumen_deluxe",
        label: "Deluxe",
        amountCents: 24900,
        currency: "usd",
        interval: "month",
        creditsGranted: 240,
        stripePriceId: "price_lumen_deluxe_240",
        metadata: {
          generatedPhotos: 60,
          destinationCount: 999,
          deliveryDays: 1,
          revisions: "unlimited",
          featured: false
        }
      }
    ]
  });
  replaceById(state.products, {
    id: "prod_lumen_pack",
    siteId,
    name: "Wedding Album Credit Pack",
    type: "credit_pack",
    status: "active",
    prices: [
      {
        id: "price_lumen_pack",
        siteId,
        productId: "prod_lumen_pack",
        label: "120 album credits",
        amountCents: 2400,
        currency: "usd",
        interval: "one_time",
        creditsGranted: 120,
        stripePriceId: "price_lumen_pack_120"
      }
    ]
  });

  replaceById(state.subscriptions, {
    id: "sub_lumen_mara",
    siteId,
    customerId: "cust_lumen_mara",
    productId: "prod_lumen_premium",
    priceId: "price_lumen_premium",
    stripeSubscriptionId: "sub_demo_lumen_mara_premium_120",
    status: "active",
    currentPeriodEnd: "2026-06-01T00:00:00.000Z",
    creditsPerCycle: 120,
    createdAt: "2026-05-01T00:00:00.000Z"
  });

  replaceById(state.orders, {
    id: "order_lumen_pack_118",
    siteId,
    customerId: "cust_lumen_mara",
    status: "fulfilled",
    amountCents: 2400,
    currency: "usd",
    credits: 120,
    sourceId: "cs_demo_lumen_pack_118",
    createdAt: "2026-05-18T10:12:00.000Z"
  });
  replaceById(state.orders, {
    id: "order_lumen_studio_042",
    siteId,
    customerId: "cust_lumen_ivo",
    status: "paid",
    amountCents: 14900,
    currency: "usd",
    credits: 120,
    sourceId: "cs_demo_lumen_studio_042",
    createdAt: "2026-05-26T16:40:00.000Z"
  });

  const customerBalances = new Map([
    ["cust_lumen_mara", { available: 276, reserved: 24 }],
    ["cust_lumen_ivo", { available: 112, reserved: 0 }]
  ]);
  state.customers = (state.customers ?? []).map((customer) =>
    customer.siteId === siteId && customerBalances.has(customer.id) ? { ...customer, balance: customerBalances.get(customer.id) } : customer
  );

  const lumenApps = new Map([
    ["sai_lumen_image", { enabled: true, creditCost: 24, routeKey: "n8n.image.wedding.v1" }],
    ["sai_lumen_avatar", { enabled: false, creditCost: 8, routeKey: "n8n.avatar.v1" }]
  ]);
  state.siteAiApps = (state.siteAiApps ?? []).map((siteAiApp) =>
    siteAiApp.siteId === siteId && lumenApps.has(siteAiApp.id) ? { ...siteAiApp, ...lumenApps.get(siteAiApp.id) } : siteAiApp
  );

  const gateway = (state.aiGatewayGroups ?? []).find((group) => group.id === "gw_lumen_primary");
  if (gateway) {
    gateway.name = "AI Wedding image quota";
    gateway.status = "active";
    gateway.modelAllowlist = ["gpt-image-2", "gpt-4.1-mini", "claude-3-7-sonnet"];
    gateway.monthlyQuota = 12000;
    gateway.rateLimitPerMinute = 60;
    gateway.accountPoolMode = "dedicated";
    delete gateway.unavailableReason;
  }

  const packById = new Map([
    ["pack_lumen_exec", {
      name: "Engagement Preview Collection",
      headline: "Save-the-date and proposal-ready story frames",
      description: "A polished 24-image preview set for announcements, couple story pages, and planner decks.",
      category: "wedding",
      aiAppSlug: "image_generator",
      status: "active",
      creditCost: 18,
      outputCount: 24,
      trainingRequired: true,
      generationCount: 312,
      conversionRate: 18.4,
      imageUrl: "media_lumen_pack_exec"
    }],
    ["pack_lumen_editorial", {
      name: "Editorial Bridal Set",
      headline: "Magazine-style bridal portraits and detail crops",
      description: "A refined bridal collection with fashion lighting, veil details, gown movement, and private gallery delivery.",
      category: "beauty",
      aiAppSlug: "image_generator",
      status: "active",
      creditCost: 22,
      outputCount: 32,
      trainingRequired: true,
      generationCount: 148,
      conversionRate: 11.7,
      imageUrl: "media_lumen_editorial_close"
    }],
    ["pack_lumen_wedding", {
      name: "Ceremony Story Album",
      headline: "Aisle, vow, portrait, and venue story frames",
      description: "A couple-focused ceremony album with editorial hero images, vow moments, and reception-ready follow-up frames.",
      category: "wedding",
      aiAppSlug: "image_generator",
      status: "active",
      creditCost: 28,
      outputCount: 40,
      trainingRequired: true,
      generationCount: 203,
      conversionRate: 15.2,
      imageUrl: "media_lumen_hero"
    }],
    ["pack_lumen_dating", {
      name: "Reception Recap Draft",
      headline: "Dance floor, toast, and after-party concept frames",
      description: "A draft reception package for planners testing after-party scenes before selling a larger collection.",
      category: "wedding",
      aiAppSlug: "image_generator",
      status: "draft",
      creditCost: 14,
      outputCount: 16,
      trainingRequired: false,
      generationCount: 42,
      conversionRate: 7.9,
      imageUrl: "media_lumen_story_square_two"
    }]
  ]);
  state.creativePacks = (state.creativePacks ?? []).map((pack) =>
    pack.siteId === siteId && packById.has(pack.id) ? { ...pack, ...packById.get(pack.id) } : pack
  );

  const mediaById = new Map([
    ["media_lumen_hero", { label: "Ceremony hero sample", storageKey: "sites/site_lumen/theme/ceremony-hero-sample.webp", altText: "Editorial wedding ceremony hero portrait" }],
    ["media_lumen_pack_exec", { label: "Engagement preview cover", storageKey: "sites/site_lumen/packs/engagement-preview-cover.webp", altText: "Engagement preview collection cover" }],
    [
      "media_lumen_editorial_hero",
      {
        label: "Santorini destination wedding hero",
        storageKey: "sites/site_lumen/theme/ref-crops/photo-santorini.png",
        previewUrl: "/assets/site-media/lumen/ref-crops/photo-santorini.png?v=20260607a",
        sourceType: "theme_seed",
        altText: "Luxury Santorini destination wedding portrait"
      }
    ],
    ["media_lumen_editorial_close", { label: "Bridal close crop", storageKey: "sites/site_lumen/theme/bridal-close-crop.png", altText: "Close crop bridal portrait" }],
    ["media_lumen_story_square", { label: "Wedding story square one", storageKey: "sites/site_lumen/theme/wedding-story-square-one.png", altText: "Wedding story square crop one" }],
    ["media_lumen_story_square_two", { label: "Reception story square", storageKey: "sites/site_lumen/theme/reception-story-square.png", altText: "Reception story square crop" }]
  ]);
  state.mediaAssets = (state.mediaAssets ?? []).map((asset) => {
    const item = mediaById.get(asset.id);
    if (!item) return asset;
    return { ...asset, ...item };
  });

  state.customerModels = (state.customerModels ?? []).map((model) => {
    if (model.id === "model_lumen_mara_couple") {
      return { ...model, label: "Mara and Ellis couple model", modelType: "couple", status: "training", inputAssetCount: 18, minInputAssets: 12 };
    }
    if (model.id === "model_lumen_ivo_headshot") {
      return {
        ...model,
        label: "Ivo and Rowan ceremony model",
        modelType: "couple",
        status: "ready",
        inputAssetCount: 14,
        minInputAssets: 12,
        providerModelId: "prov_lumen_ivo_rowan_ceremony_01"
      };
    }
    return model;
  });

  state.albums = (state.albums ?? []).map((album) => {
    if (album.id === "album_lumen_ivo_board") {
      return { ...album, title: "Ceremony detail album", creativePackId: "pack_lumen_wedding", outputCount: 24, status: "ready" };
    }
    if (album.id === "album_lumen_mara_pending") {
      return { ...album, title: "Editorial bridal draft", creativePackId: "pack_lumen_editorial", status: "processing" };
    }
    return album;
  });

  state.assetUploads = (state.assetUploads ?? []).map((asset) =>
    asset.id === "asset_lumen_ivo_out_001" ? { ...asset, label: "Ceremony detail cover" } : asset
  );

  state.jobs = (state.jobs ?? []).map((job) => {
    if (job.id === "job_lumen_4817") {
      return { ...job, aiAppId: "ai_image", creditsReserved: 24, requestJson: { style: "bridal editorial", outputCount: 20, worker: "n8n.image.wedding.v1" } };
    }
    if (job.id === "job_lumen_4772") {
      return {
        ...job,
        aiAppId: "ai_image",
        creditsReserved: 28,
        requestJson: { style: "ceremony editorial", outputCount: 24, worker: "n8n.image.wedding.v1" },
        resultJson: { outputCount: 24, albumId: "album_lumen_ivo_board" }
      };
    }
    return job;
  });

  state.ledger = (state.ledger ?? []).map((entry) => {
    if (entry.id === "led_1") return { ...entry, amount: 300 };
    if (entry.id === "led_2") return { ...entry, amount: -24 };
    return entry;
  });

  const draftTheme = buildThemeRecord({
    id: "theme_site_lumen_draft",
    status: "draft",
    name: `${weddingSiteName} Draft`,
    themeId: `${siteId}_draft`,
    pages,
    settings
  });
  const activeTheme = buildThemeRecord({
    id: "theme_site_lumen_active",
    status: "active",
    name: `${weddingSiteName} Live`,
    themeId: `${siteId}_active_v${nextVersion}`,
    pages,
    settings
  });
  state.siteThemes = [
    ...(state.siteThemes ?? []).filter((theme) => theme.siteId !== siteId),
    draftTheme,
    activeTheme
  ];

  const publication = {
    id: `pub_site_lumen_wedding_v${nextVersion}`,
    siteId,
    version: nextVersion,
    snapshot: {
      pages: pages.map((page) => ({ id: page.id, slug: page.slug, publishedJson: clone(page.publishedJson) })),
      themeSettings: clone(settings),
      saasTheme: clone(activeTheme)
    },
    publishedBy: "admin_lumen_owner",
    publishedAt: now
  };
  state.themePublications = [...(state.themePublications ?? []), publication];

  state.auditLogs ??= [];
  state.auditLogs.unshift({
    id: `audit_lumen_wedding_theme_${nextVersion}`,
    siteId,
    actorType: "site_admin",
    actorId: "admin_lumen_owner",
    action: "wedding_theme_demo_migrated",
    targetType: "theme",
    targetId: siteId,
    createdAt: now,
    metadata: { themeKey: "wedding-story-house", version: nextVersion, pages: pages.length }
  });

  return { state, nextVersion, pageCount: pages.length };
}

const awaitedReadFile = await fs.readFile(dataPath, "utf8");
const result = migrate();
await fs.writeFile(dataPath, `${JSON.stringify(result.state, null, 2)}\n`);
console.log(`Migrated ${siteId} to AI Wedding theme v${result.nextVersion} with ${result.pageCount} pages.`);
