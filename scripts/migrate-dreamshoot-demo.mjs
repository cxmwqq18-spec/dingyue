import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import {
  dreamshootAiStudioSiteSettings,
  dreamshootAiStudioTemplates
} from "../src/lib/theme/packages/dreamshoot-ai-studio/templates.ts";

const workspaceRoot = process.cwd();
const dataPath = path.join(workspaceRoot, "data", "platform-state.json");
const siteId = "site_dreamshoot";
const siteSlug = "dreamshoot";
const now = "2026-06-18T00:00:00.000Z";
const siteName = "DreamShootAI";
const themeKey = "dreamshoot-ai-studio";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function hashPassword(password) {
  return `sha256:${crypto.createHash("sha256").update(password).digest("hex")}`;
}

function replaceWhere(items, predicate, nextItems) {
  return [...items.filter((item) => !predicate(item)), ...nextItems];
}

function sectionForSaas(section) {
  return {
    type: section.type,
    version: "1",
    card_name: section.type,
    settings: clone(section.settings ?? {}),
    blocks: clone(section.blocks ?? [])
  };
}

function templateForSaas(pageJson) {
  const sections = Object.fromEntries(
    Object.entries(pageJson.sections)
      .filter(([, section]) => Boolean(section?.type))
      .map(([id, section]) => [id, sectionForSaas(section)])
  );
  return {
    content_for_page: pageJson.sectionsOrder.filter((id) => Boolean(sections[id])),
    sections
  };
}

function normalizeGlobalSection(type, section) {
  return {
    type,
    settings: clone(section?.settings ?? {}),
    blocks: clone(section?.blocks ?? [])
  };
}

function buildThemeSettings() {
  const source = dreamshootAiStudioSiteSettings.themeSettings ?? {};
  const globalSections = clone(source.globalSections ?? {});
  globalSections.header = normalizeGlobalSection("header", globalSections.header);
  globalSections.footer = normalizeGlobalSection("footer", globalSections.footer);
  const seo = source.seo ?? {};

  return {
    colors: {
      background: source.colors?.background ?? "#09090b",
      foreground: source.colors?.foreground ?? "#f5f1eb",
      accent: source.colors?.accent ?? "#d7a36b",
      muted: source.colors?.muted ?? "#17181d"
    },
    typography: {
      display: source.typography?.display ?? "Manrope",
      body: source.typography?.body ?? "Geist"
    },
    radii: {
      section: source.radii?.section ?? 20,
      control: source.radii?.control ?? 14
    },
    navigation: {
      headerLinks: clone(source.navigation?.headerLinks ?? []),
      footerLinks: clone(source.navigation?.footerLinks ?? [])
    },
    globalSections,
    seo: {
      siteTitle: seo.siteTitle ?? siteName,
      siteDescription:
        seo.siteDescription ??
        "AI photo package subscription with private uploads, personal AI models, AI video, virtual try-on, credits, and customer-only galleries.",
      titleTemplate: seo.titleTemplate ?? `%s | ${siteName}`,
      defaultOgImage: seo.defaultOgImage ?? "/assets/dreamshoot/generated/20260619/cyberpunk-solo-city-v1.png",
      robots: { index: true, follow: true },
      pages: {}
    },
    saasSettingsCurrent: clone(source.saasSettingsCurrent ?? {})
  };
}

function buildSaasSettings(settings) {
  const current = clone(settings.saasSettingsCurrent ?? {});
  return {
    settings_data: {
      current: {
        ...current,
        navigation: clone(settings.navigation),
        seo: clone(settings.seo),
        general_layout_width: current.general_layout_width ?? 1280,
        general_layout_spacing: current.general_layout_spacing ?? 56,
        skin_bg: current.skin_bg ?? settings.colors.background,
        skin_title_color: current.skin_title_color ?? settings.colors.foreground,
        skin_text_color: current.skin_text_color ?? "#cfc5bb",
        skin_primary_btn_bg_color: current.skin_primary_btn_bg_color ?? settings.colors.foreground,
        skin_primary_btn_text_color: current.skin_primary_btn_text_color ?? "#111114",
        skin_accent_color: current.skin_accent_color ?? settings.colors.accent,
        skin_price_color: current.skin_price_color ?? settings.colors.accent,
        skin_muted_color: current.skin_muted_color ?? settings.colors.muted,
        skin_title_font_family: current.skin_title_font_family ?? settings.typography.display,
        skin_text_font_family: current.skin_text_font_family ?? settings.typography.body,
        sections: {
          ...((current.sections && typeof current.sections === "object" && !Array.isArray(current.sections)) ? current.sections : {}),
          header_plus: {
            ...sectionForSaas(settings.globalSections.header),
            type: "header_plus",
            card_name: "DreamShootAI header"
          },
          footer_plus: {
            ...sectionForSaas(settings.globalSections.footer),
            type: "footer_plus",
            card_name: "DreamShootAI footer"
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
  { idSuffix: "collections", packageTemplate: "packages", templateKey: "collection", slug: "/collections", title: "Photo packages", pageType: "collection" },
  { idSuffix: "tools", packageTemplate: "tools", templateKey: "tools", slug: "/tools", title: "Free AI tools", pageType: "tools" },
  { idSuffix: "tool_image", packageTemplate: "tool-detail", templateKey: "product", slug: "/tools/image-studio", title: "AI Image Studio", pageType: "ai_tool" },
  { idSuffix: "login", packageTemplate: "login", templateKey: "login", slug: "/login", title: "Customer login", pageType: "login" },
  { idSuffix: "app", packageTemplate: "app-home", templateKey: "app-home", slug: "/app", title: "Customer workspace", pageType: "workspace" },
  { idSuffix: "job_progress", packageTemplate: "job-progress", templateKey: "job-progress", slug: "/app/jobs/progress", title: "Job progress", pageType: "job_progress" },
  { idSuffix: "job_detail", packageTemplate: "job-detail", templateKey: "job-detail", slug: "/app/jobs/detail", title: "Job detail", pageType: "job_detail" },
  { idSuffix: "album", packageTemplate: "album", templateKey: "album", slug: "/album", title: "Private album", pageType: "album" },
  { idSuffix: "account", packageTemplate: "account-billing", templateKey: "account-billing", slug: "/account", title: "Account and billing", pageType: "account" },
  { idSuffix: "privacy", packageTemplate: "policy", templateKey: "privacy", slug: "/policies/privacy", title: "Privacy policy", pageType: "policy" },
  { idSuffix: "privacy_policy", packageTemplate: "policy", templateKey: "privacy", slug: "/privacy-policy", title: "Privacy policy", pageType: "policy" },
  { idSuffix: "refunds", packageTemplate: "policy", templateKey: "refunds", slug: "/policies/refunds", title: "Refund policy", pageType: "policy" },
  { idSuffix: "terms_service", packageTemplate: "policy", templateKey: "terms", slug: "/terms-of-service", title: "Terms of Service", pageType: "policy" },
  { idSuffix: "content", packageTemplate: "policy", templateKey: "content", slug: "/policies/content", title: "Content policy", pageType: "policy" },
  { idSuffix: "help", packageTemplate: "help", templateKey: "help", slug: "/help", title: "Help center", pageType: "help" },
  { idSuffix: "blog", packageTemplate: "blog-list", templateKey: "blog", slug: "/blog", title: "Guides", pageType: "blog" },
  { idSuffix: "blog_detail", packageTemplate: "blog-detail", templateKey: "blog-detail", slug: "/blog/preparing-source-photos", title: "Preparing source photos", pageType: "article" },
  { idSuffix: "search", packageTemplate: "search", templateKey: "search", slug: "/search", title: "Search", pageType: "search" },
  { idSuffix: "cart", packageTemplate: "cart", templateKey: "cart", slug: "/cart", title: "Cart", pageType: "cart" },
  { idSuffix: "404", packageTemplate: "404", templateKey: "404", slug: "/404", title: "404", pageType: "404" }
];

function pageJsonFor(mapping, version) {
  const pageJson = clone(dreamshootAiStudioTemplates[mapping.packageTemplate]);
  pageJson.pageType = mapping.pageType;
  pageJson.version = version;

  if (mapping.templateKey === "privacy" && pageJson.sections.policy_1) {
    pageJson.sections.policy_1.settings = {
      ...pageJson.sections.policy_1.settings,
      title: "Privacy policy",
      lastUpdated: "June 25, 2024",
      contactEmail: "support@dreamshootai.com",
      body: "<h3>1. Information we collect</h3><p>We collect the email address used for your account, source photos you upload, generation settings, payment status, credit movements, and delivered outputs needed to operate the service.</p><h3>2. How we use data</h3><p>We use your data to create AI photo packages, manage credits and subscriptions, deliver private galleries, provide support, prevent abuse, and improve product reliability.</p><h3>3. Photo privacy</h3><p>Uploads and generated images stay tied to the current site and customer account. We do not sell personal photos, and site data is kept separate from other storefronts.</p><h3>4. Payments</h3><p>Payments are processed by Stripe or the connected payment account for this storefront. We store billing state and ledger records, not full card numbers.</p><h3>5. Security</h3><p>The service is served over HTTPS. Access to private albums, customer assets, jobs, and billing records is scoped by site and customer session.</p><h3>6. Retention and deletion</h3><p>You may request deletion of uploaded assets or generated outputs. Some billing, ledger, and abuse-prevention records may be retained where legally or operationally required.</p><h3>7. Contact</h3><p>Email <a href=\"mailto:support@dreamshootai.com\">support@dreamshootai.com</a> for privacy, account, or deletion requests.</p>"
    };
  }

  if (mapping.templateKey === "refunds" && pageJson.sections.policy_1) {
    pageJson.sections.policy_1.settings = {
      ...pageJson.sections.policy_1.settings,
      title: "Refund policy",
      lastUpdated: "June 25, 2024",
      contactEmail: "support@dreamshootai.com",
      body: "<h3>Refund eligibility</h3><p>You may request a refund for purchased credits if none of the credits from that purchase have been used. Once credits have been spent on a successful generation, that purchase becomes non-refundable.</p><h3>Refund window</h3><p>Refund requests should be submitted within 30 days of the purchase date with your account email and purchase details.</p><h3>Subscriptions</h3><p>If a subscription is canceled, the customer keeps access to purchased credits until they are used or expire according to the plan rules. Cancellation does not automatically refund credits already used.</p><h3>Technical failures</h3><p>If a technical failure on our side prevents credit use or delivery, support may release credits, rerun the job, or approve a refund after review.</p><h3>Ledger handling</h3><p>Refunds and billing reversals are recorded against this storefront. Checkout completion never grants credits before payment confirmation, and every adjustment is written through the credit ledger.</p>"
    };
  }

  if (mapping.templateKey === "terms" && pageJson.sections.policy_1) {
    pageJson.sections.policy_1.settings = {
      ...pageJson.sections.policy_1.settings,
      title: "Terms of Service",
      lastUpdated: "June 25, 2024",
      contactEmail: "support@dreamshootai.com",
      body: "<h3>1. Acceptance</h3><p>By using this site, you agree to these terms and to the privacy policy that governs uploads, generated outputs, purchases, and private delivery.</p><h3>2. Accounts</h3><p>Customers must provide accurate account information and keep credentials secure. Each account belongs to the current storefront and cannot be shared across unrelated site customer records.</p><h3>3. Subscriptions and credits</h3><p>Subscriptions and one-time credit packs provide credits for AI photo generation. Credits are granted after confirmed payment, reserved when a job starts, consumed after successful delivery, and released when a job fails or times out.</p><h3>4. Refunds</h3><p>Unused credits may be reviewed for refund eligibility within 30 days. Credits already spent on successful generations are not refundable unless support confirms a service-side technical failure.</p><h3>5. Uploaded content</h3><p>You may only upload images and references you control or have permission to use. The site may reject, review, remove, or block content that violates law, platform rules, or safety policy.</p><h3>6. Delivery</h3><p>Completed jobs are delivered to the signed-in customer account. Delivery states, retries, credit releases, and refunds are handled by the backend and recorded in the ledger.</p><h3>7. Liability</h3><p>The service is provided as a software subscription. To the extent permitted by law, liability is limited to the fees paid for the current billing period or the affected credit purchase.</p><h3>8. Contact us</h3><p>Email <a href=\"mailto:support@dreamshootai.com\">support@dreamshootai.com</a> for account, billing, refund, or policy questions.</p>"
    };
  }

  if (mapping.templateKey === "content" && pageJson.sections.policy_1) {
    pageJson.sections.policy_1.settings = {
      ...pageJson.sections.policy_1.settings,
      title: "Content policy",
      body: "<p>Customers may upload only photos they control or have permission to use. DreamShootAI scene packs are for private customer galleries and storefront-approved creative categories.</p>"
    };
  }

  return pageJson;
}

function buildPages(version) {
  return pageMappings.map((mapping) => {
    const pageJson = pageJsonFor(mapping, version);
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

function buildThemeRecord({ id, status, name, themeId, pages, settings }) {
  return {
    id,
    siteId,
    name,
    themeId,
    themeKey,
    status,
    templates: Object.fromEntries(
      pages.map((sitePage) => [
        sitePage.templateKey || sitePage.pageType,
        templateForSaas(status === "active" ? sitePage.publishedJson : sitePage.draftJson)
      ])
    ),
    settings: buildSaasSettings(settings),
    source: "site",
    createdBy: "admin_dreamshoot_owner",
    createdAt: now,
    updatedAt: now
  };
}

const products = [
  ["prod_dreamshoot_starter", "Starter", "price_dreamshoot_starter", 3500, 200, false, "For one focused photo package", "Standard editing", 20, 2, 3],
  ["prod_dreamshoot_pro", "Pro", "price_dreamshoot_pro", 5000, 300, true, "Best for multiple package looks", "Advanced editing", 40, 4, 2],
  ["prod_dreamshoot_premium", "Premium", "price_dreamshoot_premium", 9000, 600, false, "For creators who want the full catalog", "Premium editing and retouching", 80, 8, 1]
].map(([id, name, priceId, amountCents, creditsGranted, featured, planSubtitle, editingLabel, generatedPhotos, destinationCount, deliveryDays]) => ({
  id,
  siteId,
  name,
  type: "subscription",
  status: "active",
  prices: [
    {
      id: priceId,
      siteId,
      productId: id,
      label: name,
      amountCents,
      currency: "usd",
      interval: "month",
      creditsGranted,
      stripePriceId: `manual_${priceId}`,
      metadata: {
        generatedPhotos,
        destinationCount,
        deliveryDays,
        featured,
        planSubtitle,
        editingLabel,
        publicReference: `DreamShootAI ${String(name).toLowerCase()} credit package`
      }
    }
  ]
}));

products.push({
  id: "prod_dreamshoot_boost",
  siteId,
  name: "Extra 150 Credits",
  type: "credit_pack",
  status: "active",
  prices: [
    {
      id: "price_dreamshoot_boost",
      siteId,
      productId: "prod_dreamshoot_boost",
      label: "Extra 150 credits",
      amountCents: 1800,
      currency: "usd",
      interval: "one_time",
      creditsGranted: 150,
      stripePriceId: "manual_dreamshoot_boost_150"
    }
  ]
});

const creativePacks = [
  ["pack_dreamshoot_headshots", "Professional Headshots", "Founder, LinkedIn, team, resume, and personal brand portraits from simple selfies.", "headshots", 20, 20, "/assets/dreamshoot/generated/20260618/headshot-lifestyle-v1.png"],
  ["pack_dreamshoot_hairstyle", "Hairstyle", "Preview hair directions, colors, and beauty styling before choosing a full image package.", "beauty", 20, 18, "/assets/dreamshoot/generated/20260618/hairstyle-preview-v1.png"],
  ["pack_dreamshoot_virtual_tryon", "Virtual Try-On", "Outfit and styling previews for polished scene planning before full-package generation.", "beauty", 36, 20, "/assets/dreamshoot/beauty-portrait-gpt2.png"],
  ["pack_dreamshoot_cyberpunk", "Cyberpunk", "Neon city portraits, future fashion, night-life looks, and high-contrast digital art scenes.", "creative", 20, 26, "/assets/dreamshoot/generated/20260619/cyberpunk-solo-city-v1.png"],
  ["pack_dreamshoot_gala", "Gala Photos", "Formal night-out photos with polished editorial lighting, black-tie styling, and red-carpet energy.", "creative", 20, 24, "/assets/dreamshoot/frames/sample-professional-headshot.png"],
  ["pack_dreamshoot_mafia", "Mafia", "Vintage noir styling, dramatic suits, classic portraits, and cinematic themed scenes.", "creative", 20, 22, "/assets/dreamshoot/generated/20260619/mafia-noir-single-v1.png"],
  ["pack_dreamshoot_nature", "Nature", "Outdoor adventure portraits, scenic backdrops, travel moments, and landscape-led profile images.", "creative", 20, 18, "/assets/dreamshoot/generated/20260619/nature-adventure-solo-v1.png"],
  ["pack_dreamshoot_travel", "Travel Scene Pack", "Cliffside, city, resort, and destination-style portraits without a studio booking.", "creative", 36, 22, "/assets/dreamshoot/generated/20260618/cliffside-holiday-v1.png"],
  ["pack_dreamshoot_worldcup", "World Cup Fan Photos", "Stadium tunnel meet-ups, football star-inspired portraits, fan posters, and match-day profile scenes.", "sports", 40, 26, "/assets/dreamshoot/generated/20260619/world-cup-fan-star-clean-v1.png"],
  ["pack_dreamshoot_social_cards", "Social Cards", "Announcement, profile, creator, fan-poster, and card-ready visuals from everyday uploads.", "creator", 40, 26, "/assets/dreamshoot/holiday-card-gpt2.png"],
  ["pack_dreamshoot_profile_cards", "Profile Cards", "Polished profile cards, newsletter portraits, and creator announcement visuals.", "creator", 20, 20, "/assets/dreamshoot/generated/20260618/holiday-portrait-v1.png"],
  ["pack_dreamshoot_creator_portraits", "Creator Portraits", "Solo creator portraits for personal brands, landing pages, newsletters, and profile refreshes.", "creator", 20, 24, "/assets/dreamshoot/avatar-nora-gpt2.png"],
  ["pack_dreamshoot_fashion_editorial", "Fashion Editorial", "Magazine-style outfit stories, dramatic styling, and polished editorial portraits.", "creator", 20, 24, "/assets/dreamshoot/editorial-headshot-gpt2.png"],
  ["pack_dreamshoot_anime_avatar", "Anime Avatar", "Stylized avatar concepts, profile art, and character-inspired portraits for social channels.", "avatar", 20, 24, "/assets/dreamshoot/frames/story-beauty-portrait.png"],
  ["pack_dreamshoot_product_style", "Product Style", "Creator product shots, lifestyle visuals, and campaign-ready image concepts.", "creator", 20, 22, "/assets/dreamshoot/generated/20260618/upscaler-utility-v1.png"]
].map(([id, name, description, category, outputCount, creditCost, imageUrl], index) => ({
  id,
  siteId,
  name,
  headline: name,
  description,
  category,
  aiAppSlug: "image_generator",
  status: "active",
  creditCost,
  outputCount,
  trainingRequired: true,
  generationCount: 120 + index * 17,
  conversionRate: Number((8.9 + index * 0.6).toFixed(1)),
  createdAt: now,
  imageUrl
}));

const mediaAssets = [
  ["media_dreamshoot_hero", "DreamShootAI hero", "sites/site_dreamshoot/theme/cyberpunk-solo-city-v1.png", "/assets/dreamshoot/generated/20260619/cyberpunk-solo-city-v1.png"],
  ["media_dreamshoot_alt_hero", "DreamShootAI hero alt", "sites/site_dreamshoot/theme/headshot-lifestyle-v1.png", "/assets/dreamshoot/generated/20260618/headshot-lifestyle-v1.png"],
  ["media_dreamshoot_lifestyle", "DreamShootAI creator portrait", "sites/site_dreamshoot/theme/avatar-nora-gpt2.png", "/assets/dreamshoot/avatar-nora-gpt2.png"],
  ["media_dreamshoot_social_cards", "DreamShootAI social cards", "sites/site_dreamshoot/theme/holiday-card-gpt2.png", "/assets/dreamshoot/holiday-card-gpt2.png"],
  ["media_dreamshoot_travel", "DreamShootAI travel scene", "sites/site_dreamshoot/theme/cliffside-holiday-v1.png", "/assets/dreamshoot/generated/20260618/cliffside-holiday-v1.png"],
  ["media_dreamshoot_avatar", "DreamShootAI avatar", "sites/site_dreamshoot/theme/avatar-nora-gpt2.png", "/assets/dreamshoot/avatar-nora-gpt2.png"],
  ["media_dreamshoot_headshot", "DreamShootAI headshot", "sites/site_dreamshoot/theme/editorial-headshot-gpt2.png", "/assets/dreamshoot/editorial-headshot-gpt2.png"],
  ["media_dreamshoot_beauty", "DreamShootAI beauty portrait", "sites/site_dreamshoot/theme/beauty-portrait-gpt2.png", "/assets/dreamshoot/beauty-portrait-gpt2.png"],
  ["media_dreamshoot_lifestyle_headshot", "DreamShootAI lifestyle headshot", "sites/site_dreamshoot/theme/headshot-lifestyle-v1.png", "/assets/dreamshoot/generated/20260618/headshot-lifestyle-v1.png"],
  ["media_dreamshoot_hairstyle_preview", "DreamShootAI hairstyle preview", "sites/site_dreamshoot/theme/hairstyle-preview-v1.png", "/assets/dreamshoot/generated/20260618/hairstyle-preview-v1.png"],
  ["media_dreamshoot_upscaler_utility", "DreamShootAI upscaler utility", "sites/site_dreamshoot/theme/upscaler-utility-v1.png", "/assets/dreamshoot/generated/20260618/upscaler-utility-v1.png"],
  ["media_dreamshoot_holiday_portrait", "DreamShootAI holiday portrait", "sites/site_dreamshoot/theme/holiday-portrait-v1.png", "/assets/dreamshoot/generated/20260618/holiday-portrait-v1.png"],
  ["media_dreamshoot_mafia_noir", "DreamShootAI mafia noir", "sites/site_dreamshoot/theme/mafia-noir-single-v1.png", "/assets/dreamshoot/generated/20260619/mafia-noir-single-v1.png"],
  ["media_dreamshoot_nature_adventure", "DreamShootAI nature adventure", "sites/site_dreamshoot/theme/nature-adventure-solo-v1.png", "/assets/dreamshoot/generated/20260619/nature-adventure-solo-v1.png"],
  ["media_dreamshoot_worldcup_fan", "DreamShootAI World Cup fan", "sites/site_dreamshoot/theme/world-cup-fan-star-clean-v1.png", "/assets/dreamshoot/generated/20260619/world-cup-fan-star-clean-v1.png"],
  ["media_dreamshoot_cyberpunk_solo", "DreamShootAI cyberpunk solo", "sites/site_dreamshoot/theme/cyberpunk-solo-city-v1.png", "/assets/dreamshoot/generated/20260619/cyberpunk-solo-city-v1.png"]
].map(([id, label, storageKey, previewUrl]) => ({
  id,
  siteId,
  label,
  storageKey,
  mimeType: "image/png",
  usage: "theme",
  sourceType: "theme_seed",
  previewUrl,
  originUrl: previewUrl,
  altText: label,
  createdAt: now
}));

const pages = buildPages(1);
const settings = buildThemeSettings();
const draftTheme = buildThemeRecord({
  id: "theme_site_dreamshoot_draft",
  status: "draft",
  name: "DreamShootAI Draft",
  themeId: "site_dreamshoot_draft",
  pages,
  settings
});
const activeTheme = buildThemeRecord({
  id: "theme_site_dreamshoot_active",
  status: "active",
  name: "DreamShootAI Live",
  themeId: "site_dreamshoot_active_v1",
  pages,
  settings
});

const state = JSON.parse(await fs.readFile(dataPath, "utf8"));
const site = {
  id: siteId,
  name: siteName,
  slug: siteSlug,
  status: "active",
  primaryDomain: "dreamshoot.localhost",
  currency: "usd",
  timezone: "America/New_York",
  branding: {
    logoText: siteName,
    market: "AI photo packages, personal AI models, free tools, credits, AI video, and private albums",
    description: dreamshootAiStudioSiteSettings.branding?.description ?? settings.seo.siteDescription
  },
  connect: {
    stripeAccountId: "acct_demo_dreamshoot",
    status: "enabled",
    chargesEnabled: true,
    payoutsEnabled: true
  },
  themeSettings: {
    draftJson: clone(settings),
    publishedJson: clone(settings)
  },
  pages
};

state.sites = replaceWhere(state.sites ?? [], (item) => item.id === siteId || item.slug === siteSlug, [site]);
state.siteDomains = replaceWhere(state.siteDomains ?? [], (item) => item.siteId === siteId || item.domain === "dreamshoot.localhost", [
  { id: "dom_dreamshoot_primary", siteId, domain: "dreamshoot.localhost", isPrimary: true, status: "active", createdAt: now }
]);
state.siteAdmins = replaceWhere(state.siteAdmins ?? [], (item) => item.siteId === siteId, [
  {
    id: "admin_dreamshoot_owner",
    siteId,
    email: "owner@dreamshoot.localhost",
    passwordHash: hashPassword("dreamshoot123"),
    displayName: "DreamShootAI Owner",
    role: "owner",
    createdAt: now
  }
]);
state.products = replaceWhere(state.products ?? [], (item) => item.siteId === siteId, products);
state.creativePacks = replaceWhere(state.creativePacks ?? [], (item) => item.siteId === siteId, creativePacks);
state.mediaAssets = replaceWhere(state.mediaAssets ?? [], (item) => item.siteId === siteId, mediaAssets);

const baseImageApp = (state.aiApps ?? []).find((app) => app.slug === "image_generator") ?? {
  id: "ai_image",
  slug: "image_generator",
  name: "Image Studio",
  description: "Private image generation with signed album delivery.",
  appType: "image",
};
const imageApp = {
  ...baseImageApp,
  name: "DreamShootAI Image Studio",
  description: "Private AI photo packs, scene generation, AI video-ready outputs, and customer-only gallery delivery.",
  parameterSchema: [
    { id: "style", label: "Style", type: "select", options: ["world-cup", "gala", "creator", "travel", "headshot", "beauty", "virtual-try-on", "sports"] },
    { id: "outputCount", label: "Output count", type: "select", options: ["8", "20", "40"] }
  ]
};
state.siteAiApps = replaceWhere(state.siteAiApps ?? [], (item) => item.siteId === siteId, [
  { id: "sai_dreamshoot_image", siteId, aiApp: imageApp, enabled: true, creditCost: 24, routeKey: "n8n.image.dreamshoot.v1" }
]);
state.aiGatewayGroups = replaceWhere(state.aiGatewayGroups ?? [], (item) => item.siteId === siteId, [
  {
    id: "gw_dreamshoot_primary",
    siteId,
    name: "DreamShootAI image quota",
    status: "active",
    modelAllowlist: ["gpt-image-2", "gpt-4.1-mini"],
    monthlyQuota: 10000,
    usedQuota: 0,
    retryStatusCodes: [429, 500, 502, 503],
    rateLimitPerMinute: 60,
    accountPoolMode: "dedicated"
  }
]);
state.customers = replaceWhere(state.customers ?? [], (item) => item.siteId === siteId, [
  {
    id: "cust_dreamshoot_nora",
    siteId,
    email: "nora@dreamshoot.localhost",
    passwordHash: hashPassword("nora123"),
    name: "Nora Whitman",
    status: "active",
    balance: { available: 276, reserved: 24 }
  }
]);
state.subscriptions = replaceWhere(state.subscriptions ?? [], (item) => item.siteId === siteId, [
  {
    id: "sub_dreamshoot_nora",
    siteId,
    customerId: "cust_dreamshoot_nora",
    productId: "prod_dreamshoot_pro",
    priceId: "price_dreamshoot_pro",
    stripeSubscriptionId: "sub_demo_dreamshoot_pro_300",
    status: "active",
    currentPeriodEnd: "2026-07-18T00:00:00.000Z",
    creditsPerCycle: 300,
    createdAt: now
  }
]);
state.orders = replaceWhere(state.orders ?? [], (item) => item.siteId === siteId, [
  {
    id: "order_dreamshoot_pro_001",
    siteId,
    customerId: "cust_dreamshoot_nora",
    status: "fulfilled",
    amountCents: 5000,
    currency: "usd",
    credits: 300,
    sourceId: "cs_demo_dreamshoot_pro_001",
    createdAt: now
  }
]);
state.jobs = replaceWhere(state.jobs ?? [], (item) => item.siteId === siteId, [
  {
    id: "job_dreamshoot_1001",
    siteId,
    customerId: "cust_dreamshoot_nora",
    aiAppId: "ai_image",
    status: "succeeded",
    creditsReserved: 24,
    createdAt: now,
    updatedAt: now,
    requestJson: { style: "gala", outputCount: 20, worker: "n8n.image.dreamshoot.v1" },
    resultJson: { outputCount: 20, albumId: "album_dreamshoot_nora_gala" }
  }
]);
state.albums = replaceWhere(state.albums ?? [], (item) => item.siteId === siteId, [
  {
    id: "album_dreamshoot_nora_gala",
    siteId,
    customerId: "cust_dreamshoot_nora",
    title: "Gala AI photo set",
    sourceJobId: "job_dreamshoot_1001",
    creativePackId: "pack_dreamshoot_gala",
    status: "ready",
    outputCount: 20,
    coverAssetId: "asset_dreamshoot_nora_out_001",
    createdAt: now,
    updatedAt: now
  }
]);
state.assetUploads = replaceWhere(state.assetUploads ?? [], (item) => item.siteId === siteId, [
  {
    id: "asset_dreamshoot_nora_out_001",
    siteId,
    customerId: "cust_dreamshoot_nora",
    jobId: "job_dreamshoot_1001",
    label: "Gala set cover",
    storageKey: "sites/site_dreamshoot/customers/cust_dreamshoot_nora/jobs/job_dreamshoot_1001/out_001.webp",
    mimeType: "image/webp",
    role: "output",
    visibility: "private",
    reviewStatus: "approved",
    createdAt: now
  }
]);
state.ledger = replaceWhere(state.ledger ?? [], (item) => item.siteId === siteId, [
  { id: "led_dreamshoot_grant", siteId, customerId: "cust_dreamshoot_nora", amount: 300, type: "grant", sourceType: "subscription", sourceId: "sub_dreamshoot_nora", createdAt: now },
  { id: "led_dreamshoot_consume", siteId, customerId: "cust_dreamshoot_nora", amount: -24, type: "consume", sourceType: "job", sourceId: "job_dreamshoot_1001", createdAt: now }
]);
state.siteThemes = replaceWhere(state.siteThemes ?? [], (item) => item.siteId === siteId, [draftTheme, activeTheme]);
state.themePublications = replaceWhere(state.themePublications ?? [], (item) => item.siteId === siteId, [
  {
    id: "pub_site_dreamshoot_v1",
    siteId,
    version: 1,
    snapshot: {
      pages: pages.map((sitePage) => ({ id: sitePage.id, slug: sitePage.slug, publishedJson: clone(sitePage.publishedJson) })),
      themeSettings: clone(settings),
      saasTheme: clone(activeTheme)
    },
    publishedBy: "admin_dreamshoot_owner",
    publishedAt: now
  }
]);
state.auditLogs = [
  {
    id: "audit_dreamshoot_demo_seeded",
    siteId,
    actorType: "site_admin",
    actorId: "admin_dreamshoot_owner",
    action: "dreamshoot_demo_seeded",
    targetType: "site",
    targetId: siteId,
    createdAt: now,
    metadata: { themeKey, pages: pages.length, productCount: products.length, packCount: creativePacks.length }
  },
  ...(state.auditLogs ?? []).filter((item) => item.id !== "audit_dreamshoot_demo_seeded")
];

await fs.writeFile(dataPath, `${JSON.stringify(state, null, 2)}\n`);
console.log(`Seeded ${siteId} with ${pages.length} pages, ${products.length} products, and ${creativePacks.length} creative packs.`);
