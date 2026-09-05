import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import createJiti from "jiti";

const jiti = createJiti(import.meta.url, { alias: { "@": path.join(process.cwd(), "src") } });
const {
  dreamshootAiStudioSiteSettings,
  dreamshootAiStudioTemplates
} = jiti("../src/lib/theme/packages/dreamshoot-ai-studio/templates.ts");

const workspaceRoot = process.cwd();
const dataPath = path.join(workspaceRoot, "data", "platform-state.json");
const siteId = "site_dreamshoot";
const siteSlug = "mydreamshoots";
const now = "2026-06-18T00:00:00.000Z";
const siteName = "MyDreamShoots";
const themeKey = "dreamshoot-ai-studio";
const logoImageUrl = "/assets/dreamshoot/brand/dreamshootai-logo-refined.svg?v=20260621b";
const displayFontStack = "var(--font-display-ui), var(--font-sans-ui), Helvetica Neue, ui-sans-serif, system-ui, sans-serif";
const bodyFontStack = "var(--font-sans-ui), Helvetica Neue, ui-sans-serif, system-ui, sans-serif";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function hashPassword(password) {
  return `sha256:${crypto.createHash("sha256").update(password).digest("hex")}`;
}

function envOrManualPrice(envName, fallback) {
  return process.env[envName]?.trim() || fallback;
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
  globalSections.header.settings.logoImageUrl = globalSections.header.settings.logoImageUrl ?? logoImageUrl;
  globalSections.header.settings.logoAlt = globalSections.header.settings.logoAlt ?? "MyDreamShoots heart camera logo";
  const seo = source.seo ?? {};

  return {
    colors: {
      background: source.colors?.background ?? "#05070E",
      foreground: source.colors?.foreground ?? "#F8FAFC",
      accent: source.colors?.accent ?? "#EC4BDD",
      muted: source.colors?.muted ?? "#10111A"
    },
    typography: {
      display: source.typography?.display ?? displayFontStack,
      body: source.typography?.body ?? bodyFontStack
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
            card_name: "MyDreamShoots header"
          },
          footer_plus: {
            ...sectionForSaas(settings.globalSections.footer),
            type: "footer_plus",
            card_name: "MyDreamShoots footer"
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
  { idSuffix: "workflow", packageTemplate: "workflow", templateKey: "workflow", slug: "/workflow", title: "How it works", pageType: "content" },
  { idSuffix: "tool_image", packageTemplate: "tool-detail", templateKey: "product", slug: "/tools/headshot", title: "Headshot Generator", pageType: "ai_tool" },
  { idSuffix: "login", packageTemplate: "login", templateKey: "login", slug: "/login", title: "Customer login", pageType: "login" },
  { idSuffix: "app", packageTemplate: "app-home", templateKey: "app-home", slug: "/app", title: "Customer workspace", pageType: "workspace" },
  { idSuffix: "job_progress", packageTemplate: "job-progress", templateKey: "job-progress", slug: "/app/jobs/progress", title: "Job progress", pageType: "job_progress" },
  { idSuffix: "job_detail", packageTemplate: "job-detail", templateKey: "job-detail", slug: "/app/jobs/detail", title: "Job detail", pageType: "job_detail" },
  { idSuffix: "album", packageTemplate: "album", templateKey: "album", slug: "/album", title: "Private album", pageType: "album" },
  { idSuffix: "account", packageTemplate: "account-billing", templateKey: "account-billing", slug: "/account", title: "Account and billing", pageType: "account" },
  { idSuffix: "privacy", packageTemplate: "policy", templateKey: "privacy", slug: "/policies/privacy", title: "Privacy policy", pageType: "policy" },
  { idSuffix: "privacy_policy", packageTemplate: "policy", templateKey: "privacy", slug: "/privacy-policy", title: "Privacy policy", pageType: "policy" },
  { idSuffix: "refunds", packageTemplate: "policy", templateKey: "refunds", slug: "/policies/refunds", title: "Refund policy", pageType: "policy" },
  { idSuffix: "shipping", packageTemplate: "policy", templateKey: "shipping", slug: "/policies/shipping", title: "Shipping and Digital Delivery Policy", pageType: "policy" },
  { idSuffix: "terms_service", packageTemplate: "policy", templateKey: "terms", slug: "/terms-of-service", title: "Terms of Service", pageType: "policy" },
  { idSuffix: "content", packageTemplate: "policy", templateKey: "content", slug: "/policies/content", title: "Content policy", pageType: "policy" },
  { idSuffix: "help", packageTemplate: "help", templateKey: "help", slug: "/faq", title: "Help center", pageType: "help" },
  { idSuffix: "about_us", packageTemplate: "about-us", templateKey: "about-us", slug: "/about-us", title: "About Us", pageType: "content" },
  { idSuffix: "contact_us", packageTemplate: "contact-us", templateKey: "contact-us", slug: "/contact-us", title: "Contact Us", pageType: "content" },
  { idSuffix: "blog", packageTemplate: "blog-list", templateKey: "blog", slug: "/blog", title: "Guides", pageType: "blog" },
  { idSuffix: "blog_detail", packageTemplate: "blog-detail", templateKey: "blog-detail", slug: "/blog/preparing-source-photos", title: "Preparing source photos", pageType: "article" },
  { idSuffix: "search", packageTemplate: "search", templateKey: "search", slug: "/search", title: "Search", pageType: "search" },
  { idSuffix: "cart", packageTemplate: "cart", templateKey: "cart", slug: "/cart", title: "Cart", pageType: "cart" },
  { idSuffix: "404", packageTemplate: "404", templateKey: "404", slug: "/404", title: "404", pageType: "404" }
];

const dreamshootSeoPages = {
  index: {
    title: "Professional AI Photo Generator Online - MyDreamShoots",
    description: "Turn your selfies into stunning couple photos in seconds with MyDreamShoots – the most advanced AI photo generator maker. No studio, no outfits, just magic.",
    keywords: "Dream Shoots,Wedding Photoshoot,Travel Selfies,Free AI Photos,Free Photo Generator,AI Couple Photo,AI Headshot",
    canonicalPath: "/",
    index: true,
    follow: true
  },
  pricing: {
    title: "Credits for AI photo packages",
    description: "Compare MyDreamShoots monthly credits, creator photo package plans, one-time top-ups, private model workflows, and gallery delivery options.",
    keywords: "MyDreamShoots pricing, AI photo credits, creator portrait subscription, private AI photo plans",
    canonicalPath: "/pricing",
    index: true,
    follow: true
  },
  collection: {
    title: "Photo packages for headshots, fan photos, and style sets",
    description: "Browse MyDreamShoots packages for professional headshots, World Cup fan photos, cyberpunk portraits, gala scenes, beauty styling, and creator albums.",
    keywords: "AI photo packages, MyDreamShoots collections, AI headshots, fan photo generator, creator portraits",
    canonicalPath: "/collections",
    index: true,
    follow: true
  },
  tools: {
    title: "AI tools for photo edits, previews, and motion ideas",
    description: "Use MyDreamShoots tools for headshots, background edits, retouching, upscaling, prompt edits, fan posters, and image-to-video concepts.",
    keywords: "MyDreamShoots tools, AI photo editor, headshot maker, background changer, AI video preview",
    canonicalPath: "/tools",
    index: true,
    follow: true
  },
  workflow: {
    title: "How MyDreamShoots works - private AI photo generation workflow",
    description: "Learn how MyDreamShoots customers upload source photos, choose AI photo packages, review credits, generate private results, and download finished galleries.",
    keywords: "MyDreamShoots workflow, AI photo generation workflow, private AI photo packages, AI photo credits",
    canonicalPath: "/workflow",
    index: true,
    follow: true
  },
  product: {
    title: "Headshot generator for private AI profile portraits",
    description: "Create clean AI headshots and profile portraits with MyDreamShoots source-photo guidance, visible credits, and private gallery delivery.",
    keywords: "AI headshot generator, MyDreamShoots headshots, private profile portraits",
    canonicalPath: "/tools/headshot",
    index: true,
    follow: true
  },
  login: {
    title: "Sign in to manage private AI photo albums",
    description: "Sign in to MyDreamShoots to manage source photos, credits, private AI photo jobs, downloads, and customer-only generated albums.",
    keywords: "MyDreamShoots login, private AI photo workspace, AI photo gallery sign in",
    canonicalPath: "/login",
    index: false,
    follow: true
  },
  "app-home": {
    title: "Workspace for uploads, credits, and generated albums",
    description: "Manage MyDreamShoots source photos, credit activity, package requests, generated portraits, and private delivery inside the customer workspace.",
    keywords: "MyDreamShoots workspace, AI photo uploads, private AI gallery, credit history",
    canonicalPath: "/app",
    index: false,
    follow: true
  },
  "job-progress": {
    title: "Job progress for AI photo generation",
    description: "Track MyDreamShoots generation status, reserved credits, package progress, and private album delivery from the customer workspace.",
    keywords: "MyDreamShoots job progress, AI photo generation status, private album delivery",
    canonicalPath: "/app/jobs/progress",
    index: false,
    follow: true
  },
  "job-detail": {
    title: "Job detail for generated photo outputs",
    description: "Review MyDreamShoots generated outputs, credit activity, package settings, and private image delivery details in the workspace.",
    keywords: "MyDreamShoots job detail, AI photo outputs, private generated album",
    canonicalPath: "/app/jobs/detail",
    index: false,
    follow: true
  },
  album: {
    title: "Creator photo album downloads and review",
    description: "Open MyDreamShoots private albums to review, compare, and download generated headshots, creator portraits, style sets, and fan photos.",
    keywords: "MyDreamShoots private album, AI photo downloads, generated photo gallery",
    canonicalPath: "/album",
    index: false,
    follow: true
  },
  "account-billing": {
    title: "Account and billing for plans, credits, and receipts",
    description: "Review MyDreamShoots plan status, credit balance, payment history, top-ups, subscriptions, and account settings.",
    keywords: "MyDreamShoots account, AI photo billing, credits, subscription",
    canonicalPath: "/account",
    index: false,
    follow: true
  },
  privacy: {
    title: "Privacy policy for uploads, accounts, and galleries",
    description: "Learn how MyDreamShoots handles customer accounts, uploaded source photos, AI generation settings, credits, payments, and private gallery delivery.",
    keywords: "MyDreamShoots privacy, AI photo upload privacy, private gallery data",
    canonicalPath: "/privacy",
    index: true,
    follow: true
  },
  refunds: {
    title: "Refund policy for credits, jobs, and billing review",
    description: "Review MyDreamShoots refund rules for unused credits, failed generation jobs, subscriptions, technical failures, and support review.",
    keywords: "MyDreamShoots refunds, AI photo credits refund, failed generation credit return",
    canonicalPath: "/refunds",
    index: true,
    follow: true
  },
  shipping: {
    title: "Digital delivery for AI photo albums and downloads",
    description: "Review how MyDreamShoots delivers credits for AI photo and video generation, generated image packages, video outputs, downloads, and private galleries digitally without physical shipping.",
    keywords: "MyDreamShoots digital delivery, AI photo delivery, private gallery downloads",
    canonicalPath: "/shipping",
    index: true,
    follow: true
  },
  terms: {
    title: "Terms of service for accounts, credits, and photo outputs",
    description: "Read MyDreamShoots terms for customer accounts, source photo rights, AI photo credits, private album delivery, acceptable use, and support contact.",
    keywords: "MyDreamShoots terms, AI photo terms, source photo rights, generated portrait policy",
    canonicalPath: "/terms",
    index: true,
    follow: true
  },
  content: {
    title: "Content policy for safe source photos and requests",
    description: "Review MyDreamShoots rules for allowed uploads, source photo permission, generated outputs, moderation, unsafe requests, and reporting concerns.",
    keywords: "MyDreamShoots content policy, AI photo safety, allowed uploads",
    canonicalPath: "/content",
    index: true,
    follow: true
  },
  help: {
    title: "FAQ for uploads, credits, tools, and private albums",
    description: "Get MyDreamShoots FAQ answers for source photo preparation, package selection, credits, checkout, privacy, refunds, and private album delivery.",
    keywords: "MyDreamShoots FAQ, AI photo upload guide, photo package support",
    canonicalPath: "/faq",
    index: true,
    follow: true
  },
  "about-us": {
    title: "About private AI photo packages and galleries",
    description: "Learn about MyDreamShoots, a private AI photo package workspace for creator portraits, headshots, fan photos, style sets, credits, and gallery delivery.",
    keywords: "About MyDreamShoots, AI photo packages, private AI photo gallery",
    canonicalPath: "/about-us",
    index: true,
    follow: true
  },
  "contact-us": {
    title: "Contact account, billing, and photo package support",
    description: "Contact MyDreamShoots for account access, upload guidance, billing questions, credit review, privacy requests, or creator photo package support.",
    keywords: "Contact MyDreamShoots, MyDreamShoots support, AI photo package help",
    canonicalPath: "/contact-us",
    index: true,
    follow: true
  },
  blog: {
    title: "Guides for AI photo package planning and source photos",
    description: "Read MyDreamShoots guides for source photo preparation, creator portraits, headshots, style packs, credits, private albums, and gallery review.",
    keywords: "MyDreamShoots guides, AI photo tips, source photo planning, creator portrait workflow",
    canonicalPath: "/blog",
    index: true,
    follow: true
  },
  "blog-detail": {
    title: "Preparing source photos for better AI photo packages",
    description: "Learn how to choose selfies, lighting, angles, and reference notes before starting MyDreamShoots headshot, creator, fan photo, or style packages.",
    keywords: "AI photo source photos, MyDreamShoots source photo guide, better AI portraits",
    canonicalPath: "/blog/preparing-source-photos",
    index: true,
    follow: true
  },
  search: {
    title: "Search creator packages, AI tools, guides, and support",
    description: "Search MyDreamShoots for AI photo packages, tools, pricing, upload help, source photo guides, privacy details, refunds, and account support.",
    keywords: "MyDreamShoots search, AI photo packages, headshot tools, photo package support",
    canonicalPath: "/search",
    index: true,
    follow: true
  },
  cart: {
    title: "Cart review for credits and checkout",
    description: "Review selected MyDreamShoots credits, plan details, price, and package access before completing secure checkout.",
    keywords: "MyDreamShoots cart, AI photo credits checkout, photo package plan",
    canonicalPath: "/cart",
    index: false,
    follow: true
  },
  404: {
    title: "Page not found - return to photo packages",
    description: "This MyDreamShoots page is not available. Return to AI photo packages, tools, pricing, help, or the private customer workspace.",
    keywords: "MyDreamShoots 404, photo packages, MyDreamShoots help",
    canonicalPath: "/404",
    index: false,
    follow: true
  }
};

function pageJsonFor(mapping, version) {
  const pageJson = clone(dreamshootAiStudioTemplates[mapping.packageTemplate]);
  pageJson.pageType = mapping.pageType;
  pageJson.version = version;

  if (mapping.templateKey === "privacy" && pageJson.sections.policy_1) {
    pageJson.sections.policy_1.settings = {
      ...pageJson.sections.policy_1.settings,
      title: "Privacy policy",
      lastUpdated: "June 25, 2024",
      contactEmail: "support@mydreamshoots.com",
      body: "<h3>1. Information we collect</h3><p>We collect the email address used for your account, source photos you upload, generation settings, payment status, credit movements, and delivered outputs needed to operate the service.</p><h3>2. How we use data</h3><p>We use your data to create AI photo packages, manage credits and subscriptions, deliver private galleries, provide support, prevent abuse, and improve product reliability.</p><h3>3. Photo privacy</h3><p>Uploads and generated images stay tied to the current site and customer account. We do not sell personal photos, and site data is kept separate from other storefronts.</p><h3>4. Payments</h3><p>Payments are processed by Stripe or the connected payment account for this storefront. We store billing state and ledger records, not full card numbers.</p><h3>5. Security</h3><p>The service is served over HTTPS. Access to private albums, customer assets, jobs, and billing records is scoped by site and customer session.</p><h3>6. Retention and deletion</h3><p>You may request deletion of uploaded assets or generated outputs. Some billing, ledger, and abuse-prevention records may be retained where legally or operationally required.</p><h3>7. Contact</h3><p>Email <a href=\"mailto:support@mydreamshoots.com\">support@mydreamshoots.com</a> for privacy, account, or deletion requests.</p>"
    };
  }

  if (mapping.templateKey === "refunds" && pageJson.sections.policy_1) {
    pageJson.sections.policy_1.settings = {
      ...pageJson.sections.policy_1.settings,
      title: "Refund policy",
      lastUpdated: "June 25, 2024",
      contactEmail: "support@mydreamshoots.com",
      body: "<h3>Refund eligibility</h3><p>You may request a refund for purchased credits if none of the credits from that purchase have been used. Once credits have been spent on a successful generation, that purchase becomes non-refundable.</p><h3>Refund window</h3><p>Refund requests should be submitted within 30 days of the purchase date with your account email and purchase details.</p><h3>Subscriptions</h3><p>If a subscription is canceled, the customer keeps access to purchased credits until they are used or expire according to the plan rules. Cancellation does not automatically refund credits already used.</p><h3>Technical failures</h3><p>If a technical failure on our side prevents credit use or delivery, support may release credits, rerun the job, or approve a refund after review.</p><h3>Credit history</h3><p>Refunds and billing reversals appear in the customer's credit history. Checkout completion never grants credits before payment confirmation, and every adjustment is recorded for account support.</p>"
    };
  }

  if (mapping.templateKey === "shipping" && pageJson.sections.policy_1) {
    pageJson.sections.policy_1.settings = {
      ...pageJson.sections.policy_1.settings,
      title: "Shipping and Digital Delivery Policy",
      lastUpdated: "June 28, 2026",
      contactEmail: "support@mydreamshoots.com",
      body: "<h3>No physical shipping</h3><p>MyDreamShoots sells digital credits for AI photo and video generation, generated image packages, video outputs, downloads, and private gallery access. We do not ship physical products, printed photos, USB drives, or mailed merchandise from this storefront.</p><h3>Digital delivery</h3><p>Credits are added after payment confirmation. Generated images and videos are delivered inside the signed-in customer workspace or private gallery when a job completes. Delivery timing can vary based on source photo quality, selected package settings, provider availability, moderation review, and system load.</p><h3>Failed or delayed jobs</h3><p>If a service-side issue prevents delivery, support may release reserved credits, rerun the job, troubleshoot the account, or review refund eligibility under the refund policy.</p><h3>No carrier tracking or customs</h3><p>Because orders are digital, customers do not receive carrier tracking numbers and are not charged shipping, customs, duties, or physical handling fees by MyDreamShoots.</p><h3>Contact</h3><p>Email <a href=\"mailto:support@mydreamshoots.com\">support@mydreamshoots.com</a> with the account email, order or job details, and a short description if a digital delivery does not appear in the workspace.</p>"
    };
    pageJson.seo = {
      title: "MyDreamShoots Shipping and Digital Delivery Policy",
      description: "Review how MyDreamShoots delivers AI photo credits, generated images, downloads, and private galleries digitally without physical shipping.",
      keywords: "MyDreamShoots shipping policy, MyDreamShoots digital delivery, AI photo delivery, private gallery delivery",
      canonicalPath: "/shipping",
      robots: { index: true, follow: true }
    };
  }

  if (mapping.templateKey === "terms" && pageJson.sections.policy_1) {
    pageJson.sections.policy_1.settings = {
      ...pageJson.sections.policy_1.settings,
      title: "Terms of Service",
      lastUpdated: "June 25, 2024",
      contactEmail: "support@mydreamshoots.com",
      body: "<h3>1. Acceptance</h3><p>By using this site, you agree to these terms and to the privacy policy that governs uploads, generated outputs, purchases, and private delivery.</p><h3>2. Accounts</h3><p>Customers must provide accurate account information and keep credentials secure. Each account belongs to the current storefront and cannot be shared across unrelated site customer records.</p><h3>3. Subscriptions and credits</h3><p>Subscriptions and one-time credit packs provide credits for AI photo generation. Credits are granted after confirmed payment, reserved when a job starts, consumed after successful delivery, and released when a job fails or times out.</p><h3>4. Refunds</h3><p>Unused credits may be reviewed for refund eligibility within 30 days. Credits already spent on successful generations are not refundable unless support confirms a service-side technical failure.</p><h3>5. Uploaded content</h3><p>You may only upload images and references you control or have permission to use. The site may reject, review, remove, or block content that violates law, platform rules, or safety policy.</p><h3>6. Delivery</h3><p>Completed jobs are delivered to the signed-in customer account. Delivery states, retries, credit releases, and refunds are handled by the backend and recorded in the ledger.</p><h3>7. Liability</h3><p>The service is provided as a software subscription. To the extent permitted by law, liability is limited to the fees paid for the current billing period or the affected credit purchase.</p><h3>8. Contact us</h3><p>Email <a href=\"mailto:support@mydreamshoots.com\">support@mydreamshoots.com</a> for account, billing, refund, or policy questions.</p>"
    };
  }

  if (mapping.templateKey === "content" && pageJson.sections.policy_1) {
    pageJson.sections.policy_1.settings = {
      ...pageJson.sections.policy_1.settings,
      title: "Content policy",
      body: "<p>Customers may upload only photos they control or have permission to use. MyDreamShoots scene packs are for private customer galleries and storefront-approved creative categories.</p>"
    };
  }

  const seo = dreamshootSeoPages[mapping.templateKey] ?? dreamshootSeoPages[mapping.idSuffix];
  if (seo) {
    pageJson.seo = {
      title: seo.title,
      description: seo.description,
      keywords: seo.keywords,
      canonicalPath: seo.canonicalPath,
      robots: {
        index: seo.index,
        follow: seo.follow
      }
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

const subscriptionPlans = [
  { id: "prod_dreamshoot_starter", family: "starter", name: "Starter", monthlyPriceId: "price_dreamshoot_starter_monthly", yearlyPriceId: "price_dreamshoot_starter_yearly", monthlyAmountCents: 2450, originalAmountCents: 3500, monthlyCredits: 200, yearlyAmountCents: 18000, yearlyCredits: 2400, yearlyEquivalentMonthlyCents: 1500, featured: false, bestValue: false, planSubtitle: "A practical starting plan for first private albums and quick profile sets.", editingLabel: "Standard editing", generatedPhotos: 20, destinationCount: 2, deliveryDays: 3 },
  { id: "prod_dreamshoot_pro", family: "pro", name: "Pro", monthlyPriceId: "price_dreamshoot_pro_monthly", yearlyPriceId: "price_dreamshoot_pro_yearly", monthlyAmountCents: 3500, originalAmountCents: 5000, monthlyCredits: 300, yearlyAmountCents: 24000, yearlyCredits: 3600, yearlyEquivalentMonthlyCents: 2000, featured: true, bestValue: false, planSubtitle: "More monthly credits for several albums, edits, and style tests.", editingLabel: "Advanced editing", generatedPhotos: 40, destinationCount: 4, deliveryDays: 2 },
  { id: "prod_dreamshoot_premium", family: "premium", name: "Premium", monthlyPriceId: "price_dreamshoot_premium_monthly", yearlyPriceId: "price_dreamshoot_premium_yearly", monthlyAmountCents: 6300, originalAmountCents: 9000, monthlyCredits: 600, yearlyAmountCents: 40000, yearlyCredits: 7200, yearlyEquivalentMonthlyCents: 3333, featured: false, bestValue: true, planSubtitle: "The highest credit allowance for repeat albums, video ideas, and premium outputs.", editingLabel: "Premium editing and retouching", generatedPhotos: 80, destinationCount: 8, deliveryDays: 1 }
];

const products = subscriptionPlans.map((plan) => ({
  id: plan.id,
  siteId,
  name: plan.name,
  type: "subscription",
  status: "active",
  prices: [
    {
      id: plan.monthlyPriceId,
      siteId,
      productId: plan.id,
      label: plan.name,
      amountCents: plan.monthlyAmountCents,
      currency: "usd",
      interval: "month",
      creditsGranted: plan.monthlyCredits,
      stripePriceId: envOrManualPrice(`MYDREAMSHOOTS_STRIPE_PRICE_${plan.family.toUpperCase()}_MONTHLY`, `manual_${plan.monthlyPriceId}`),
      metadata: {
        generatedPhotos: plan.generatedPhotos,
        destinationCount: plan.destinationCount,
        deliveryDays: plan.deliveryDays,
        featured: plan.featured,
        planSubtitle: plan.planSubtitle,
        editingLabel: plan.editingLabel,
        originalAmountCents: plan.originalAmountCents,
        discountLabel: "30% off",
        billingCadence: "monthly",
        planFamily: plan.family,
        bestValue: plan.bestValue,
        publicReference: `MyDreamShoots ${String(plan.name).toLowerCase()} credit package`
      }
    },
    {
      id: plan.yearlyPriceId,
      siteId,
      productId: plan.id,
      label: `${plan.name} yearly`,
      amountCents: plan.yearlyAmountCents,
      currency: "usd",
      interval: "year",
      creditsGranted: plan.yearlyCredits,
      stripePriceId: envOrManualPrice(`MYDREAMSHOOTS_STRIPE_PRICE_${plan.family.toUpperCase()}_YEARLY`, `manual_${plan.yearlyPriceId}`),
      metadata: {
        generatedPhotos: plan.generatedPhotos,
        destinationCount: plan.destinationCount,
        deliveryDays: plan.deliveryDays,
        featured: plan.featured,
        planSubtitle: plan.planSubtitle,
        editingLabel: plan.editingLabel,
        originalAmountCents: plan.originalAmountCents * 12,
        discountLabel: "Pay 6, get 12",
        billingCadence: "yearly",
        yearlyEquivalentMonthlyCents: plan.yearlyEquivalentMonthlyCents,
        yearlySavingsLabel: "Annual savings shown at checkout",
        planFamily: plan.family,
        bestValue: plan.bestValue,
        publicReference: `MyDreamShoots ${String(plan.name).toLowerCase()} yearly credit package`
      }
    }
  ]
}));

products.push(
  {
    id: "prod_dreamshoot_one_shot",
    siteId,
    name: "One-shot trial",
    type: "credit_pack",
    status: "active",
    prices: [
      {
        id: "price_dreamshoot_one_shot",
        siteId,
        productId: "prod_dreamshoot_one_shot",
        label: "One-shot trial",
        amountCents: 999,
        currency: "usd",
        interval: "one_time",
        creditsGranted: 40,
        stripePriceId: envOrManualPrice("MYDREAMSHOOTS_STRIPE_PRICE_ONE_SHOT", "manual_dreamshoot_one_shot"),
        metadata: { oneShot: true, publicReference: "MyDreamShoots one-shot trial" }
      }
    ]
  },
  {
    id: "prod_dreamshoot_credits_small",
    siteId,
    name: "Small credit pack",
    type: "credit_pack",
    status: "active",
    prices: [
      {
        id: "price_dreamshoot_credits_small",
        siteId,
        productId: "prod_dreamshoot_credits_small",
        label: "Small credit pack",
        amountCents: 1200,
        currency: "usd",
        interval: "one_time",
        creditsGranted: 100,
        stripePriceId: envOrManualPrice("MYDREAMSHOOTS_STRIPE_PRICE_CREDITS_SMALL", "manual_dreamshoot_credits_small"),
        metadata: { packSize: "small", publicReference: "MyDreamShoots small credit pack" }
      }
    ]
  },
  {
    id: "prod_dreamshoot_credits_medium",
    siteId,
    name: "Medium credit pack",
    type: "credit_pack",
    status: "active",
    prices: [
      {
        id: "price_dreamshoot_credits_medium",
        siteId,
        productId: "prod_dreamshoot_credits_medium",
        label: "Medium credit pack",
        amountCents: 2000,
        currency: "usd",
        interval: "one_time",
        creditsGranted: 200,
        stripePriceId: envOrManualPrice("MYDREAMSHOOTS_STRIPE_PRICE_CREDITS_MEDIUM", "manual_dreamshoot_credits_medium"),
        metadata: { packSize: "medium", publicReference: "MyDreamShoots medium credit pack" }
      }
    ]
  },
  {
    id: "prod_dreamshoot_credits_large",
    siteId,
    name: "Large credit pack",
    type: "credit_pack",
    status: "active",
    prices: [
      {
        id: "price_dreamshoot_credits_large",
        siteId,
        productId: "prod_dreamshoot_credits_large",
        label: "Large credit pack",
        amountCents: 3200,
        currency: "usd",
        interval: "one_time",
        creditsGranted: 350,
        stripePriceId: envOrManualPrice("MYDREAMSHOOTS_STRIPE_PRICE_CREDITS_LARGE", "manual_dreamshoot_credits_large"),
        metadata: { packSize: "large", publicReference: "MyDreamShoots large credit pack" }
      }
    ]
  }
);

const creativePacks = [
  ["pack_dreamshoot_headshots", "Professional Headshots", "Create work-ready headshots for LinkedIn, resumes, founder bios, speaker pages, and team profiles. Credit cost is shown before generation.", "headshots", 20, 20, "/assets/dreamshoot/generated/20260618/headshot-lifestyle-v1.png"],
  ["pack_dreamshoot_worldcup", "World Cup Fan Photos", "Create personal fan portraits, match-day posters, and profile avatars from your own selfies. For personal fan use only; do not use official marks or player likenesses without permission.", "sports", 40, 26, "/assets/dreamshoot/generated/20260621-worldcup-pack/stadium-portrait.png"],
  ["pack_dreamshoot_hairstyle", "Hairstyle", "Preview haircut, color, and styling ideas before you commit to a real salon change or a full image package.", "beauty", 20, 18, "/assets/dreamshoot/generated/20260618/hairstyle-preview-v1.png"],
  ["pack_dreamshoot_cyberpunk", "Cyberpunk", "Turn your selfie into a neon city portrait with night lights, futuristic styling, and high-contrast poster crops.", "creative", 20, 26, "/assets/dreamshoot/generated/20260619/cyberpunk-solo-city-v1.png"],
  ["pack_dreamshoot_gala", "Gala Photos", "Formal night-out photos with polished editorial lighting, black-tie styling, and red-carpet energy.", "creative", 20, 24, "/assets/dreamshoot/frames/sample-gala.png"],
  ["pack_dreamshoot_mafia", "Mafia", "Vintage noir styling, dramatic suits, classic portraits, and cinematic themed scenes.", "creative", 20, 22, "/assets/dreamshoot/generated/20260619/mafia-noir-single-v1.png"],
  ["pack_dreamshoot_nature", "Nature", "Outdoor adventure portraits, scenic backdrops, travel moments, and landscape-led profile images.", "creative", 20, 18, "/assets/dreamshoot/generated/20260619/nature-adventure-solo-v1.png"],
  ["pack_dreamshoot_travel", "Travel Scene Pack", "Cliffside, city, resort, and destination-style portraits without a studio booking.", "creative", 36, 22, "/assets/dreamshoot/generated/20260618/cliffside-holiday-v1.png"],
  ["pack_dreamshoot_virtual_tryon", "Virtual Try-On", "Outfit and styling previews for polished scene planning before full-package generation.", "beauty", 36, 20, "/assets/dreamshoot/frames/tab-virtual-looks.png"],
  ["pack_dreamshoot_profile_cards", "Profile Cards", "Polished profile cards, newsletter portraits, and creator announcement visuals.", "creator", 20, 20, "/assets/dreamshoot/generated/20260618/holiday-portrait-v1.png"],
  ["pack_dreamshoot_creator_portraits", "Creator Portraits", "Generate fresh profile portraits for newsletters, landing pages, thumbnails, media kits, and social profiles.", "creator", 20, 24, "/assets/dreamshoot/avatar-nora-gpt2.png"],
  ["pack_dreamshoot_fashion_editorial", "Fashion Editorial", "Magazine-style outfit stories, dramatic styling, and polished editorial portraits.", "creator", 20, 24, "/assets/dreamshoot/editorial-headshot-gpt2.png"],
  ["pack_dreamshoot_anime_avatar", "Anime Avatar", "Stylized avatar concepts, profile art, and character-inspired portraits for social channels.", "avatar", 20, 24, "/assets/dreamshoot/frames/story-beauty-portrait.png"],
  ["pack_dreamshoot_product_style", "Product Style", "Creator product shots, lifestyle visuals, and campaign-ready image concepts.", "creator", 20, 22, "/assets/dreamshoot/generated/20260618/upscaler-utility-v1.png"],
  ["pack_dreamshoot_social_cards", "Social Cards", "Announcement, profile, creator, fan-poster, and card-ready visuals from everyday uploads.", "creator", 40, 26, "/assets/dreamshoot/holiday-card-gpt2.png"],
  ["pack_dreamshoot_wedding", "Wedding Portraits", "Wedding-style albums, couple portraits, save-the-date scenes, and ceremony-inspired photo sets.", "wedding", 24, 24, "/assets/dreamshoot/frames/sample-wedding-trip.png"],
  ["pack_dreamshoot_indian_wedding", "Indian Wedding", "Traditional Indian wedding looks with lehenga, saree, sherwani, jewelry, and album-ready portraits.", "cultural", 20, 24, "/assets/dreamshoot/frames/story-wedding-look.png"],
  ["pack_dreamshoot_desi_wedding", "Desi Wedding", "South Asian wedding portraits, festive styling, formal couple poses, and celebration-ready album scenes.", "cultural", 20, 24, "/assets/dreamshoot/couple-studio-hero.svg"],
  ["pack_dreamshoot_valentine", "Valentine Photos", "Romantic card-ready portraits, gift visuals, couple moments, and soft social media scenes.", "couple", 20, 20, "/assets/dreamshoot/generated/20260618/city-date-night-v1.png"],
  ["pack_dreamshoot_engagement", "Engagement", "Proposal scenes, announcement images, save-the-date looks, and romantic portrait sets.", "couple", 20, 22, "/assets/dreamshoot/frames/sample-engagement.png"],
  ["pack_dreamshoot_boudoir", "Boudoir", "Create a private boudoir-inspired portrait set from photos you own and have permission to use. Adult, consensual use only.", "boudoir", 20, 24, "/assets/dreamshoot/beauty-portrait-gpt2.png"],
  ["pack_dreamshoot_holiday", "Holiday", "Travel, vacation, family-card, resort, and festive album scenes for seasonal sharing.", "seasonal", 20, 20, "/assets/dreamshoot/date-night.svg"],
  ["pack_dreamshoot_christmas_couple", "Christmas Couple", "Cozy festive couple portraits, holiday-card scenes, fireplace looks, and winter album moments.", "couple", 20, 22, "/assets/dreamshoot/frames/sample-christmas-couple.png"],
  ["pack_dreamshoot_christmas", "Christmas Photos", "Solo festive portraits, greeting-card visuals, market scenes, and warm seasonal images.", "seasonal", 20, 20, "/assets/dreamshoot/generated/20260619/christmas-solo-card-v1.png"],
  ["pack_dreamshoot_ai_video", "AI Video Add-ons", "Turn finished package images into short motion concepts for reels, profile clips, and social campaigns.", "video", 8, 18, "/assets/dreamshoot/editorial-headshot.svg"],
  ["pack_dreamshoot_upscaler", "Magic Upscaler", "Sharpen a favorite generated image for cleaner downloads, profile use, and larger display sizes.", "utility", 8, 10, "/assets/dreamshoot/beauty-portrait.svg"]
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
  ["media_dreamshoot_hero", "MyDreamShoots homepage hero portrait with neon city lighting and a polished private photo-studio introduction", "sites/site_dreamshoot/theme/cyberpunk-solo-city-v1.png", "/assets/dreamshoot/generated/20260619/cyberpunk-solo-city-v1.png"],
  ["media_dreamshoot_alt_hero", "MyDreamShoots alternate homepage portrait showing clean lifestyle lighting for professional and creator profile packages", "sites/site_dreamshoot/theme/headshot-lifestyle-v1.png", "/assets/dreamshoot/generated/20260618/headshot-lifestyle-v1.png"],
  ["media_dreamshoot_lifestyle", "MyDreamShoots creator portrait with a relaxed expression for social profile and personal-brand content", "sites/site_dreamshoot/theme/avatar-nora-gpt2.png", "/assets/dreamshoot/avatar-nora-gpt2.png"],
  ["media_dreamshoot_social_cards", "MyDreamShoots seasonal portrait arranged as a polished social card for creator posts and digital greetings", "sites/site_dreamshoot/theme/holiday-card-gpt2.png", "/assets/dreamshoot/holiday-card-gpt2.png"],
  ["media_dreamshoot_travel", "MyDreamShoots traveler portrait in a bright cliffside destination scene for holiday and lifestyle collections", "sites/site_dreamshoot/theme/cliffside-holiday-v1.png", "/assets/dreamshoot/generated/20260618/cliffside-holiday-v1.png"],
  ["media_dreamshoot_avatar", "MyDreamShoots square creator avatar portrait with clear facial framing for social profiles and account branding", "sites/site_dreamshoot/theme/avatar-nora-gpt2.png", "/assets/dreamshoot/avatar-nora-gpt2.png"],
  ["media_dreamshoot_headshot", "MyDreamShoots professional headshot with clean studio lighting for LinkedIn, resumes, and business profiles", "sites/site_dreamshoot/theme/editorial-headshot-gpt2.png", "/assets/dreamshoot/editorial-headshot-gpt2.png"],
  ["media_dreamshoot_beauty", "MyDreamShoots beauty portrait with soft studio lighting for editorial styling and polished profile content", "sites/site_dreamshoot/theme/beauty-portrait-gpt2.png", "/assets/dreamshoot/beauty-portrait-gpt2.png"],
  ["media_dreamshoot_lifestyle_headshot", "MyDreamShoots lifestyle headshot with natural framing for creator introductions and social media profile updates", "sites/site_dreamshoot/theme/headshot-lifestyle-v1.png", "/assets/dreamshoot/generated/20260618/headshot-lifestyle-v1.png"],
  ["media_dreamshoot_hairstyle_preview", "MyDreamShoots hairstyle portrait showing a polished hair direction before a creator or beauty photo session", "sites/site_dreamshoot/theme/hairstyle-preview-v1.png", "/assets/dreamshoot/generated/20260618/hairstyle-preview-v1.png"],
  ["media_dreamshoot_upscaler_utility", "MyDreamShoots AI upscaler result showing sharper portrait detail for downloads and polished creator assets", "sites/site_dreamshoot/theme/upscaler-utility-v1.png", "/assets/dreamshoot/generated/20260618/upscaler-utility-v1.png"],
  ["media_dreamshoot_holiday_portrait", "MyDreamShoots holiday portrait with warm seasonal styling for greeting cards and private celebration albums", "sites/site_dreamshoot/theme/holiday-portrait-v1.png", "/assets/dreamshoot/generated/20260618/holiday-portrait-v1.png"],
  ["media_dreamshoot_mafia_noir", "MyDreamShoots cinematic noir character portrait with dramatic contrast for an original themed photo package", "sites/site_dreamshoot/theme/mafia-noir-single-v1.png", "/assets/dreamshoot/generated/20260619/mafia-noir-single-v1.png"],
  ["media_dreamshoot_nature_adventure", "MyDreamShoots outdoor adventure portrait set against a natural landscape for travel and nature storytelling", "sites/site_dreamshoot/theme/nature-adventure-solo-v1.png", "/assets/dreamshoot/generated/20260619/nature-adventure-solo-v1.png"],
  ["media_dreamshoot_worldcup_stadium", "MyDreamShoots football fan portrait beneath stadium floodlights for a World Cup match-day photo package", "sites/site_dreamshoot/theme/worldcup-stadium-portrait.png", "/assets/dreamshoot/generated/20260621-worldcup-pack/stadium-portrait.png"],
  ["media_dreamshoot_worldcup_friends", "MyDreamShoots group of friends in football supporter outfits celebrating together for a World Cup fan album", "sites/site_dreamshoot/theme/worldcup-friend-fan-photos.png", "/assets/dreamshoot/generated/20260621-worldcup-pack/friend-fan-photos.png"],
  ["media_dreamshoot_worldcup_avatar", "MyDreamShoots square match-day football fan avatar with bold supporter styling for social profiles", "sites/site_dreamshoot/theme/worldcup-match-day-avatar.png", "/assets/dreamshoot/generated/20260621-worldcup-pack/match-day-avatar.png"],
  ["media_dreamshoot_worldcup_poster", "MyDreamShoots football fan poster with stadium lights and supporter colors for match-day sharing", "sites/site_dreamshoot/theme/worldcup-fan-poster.png", "/assets/dreamshoot/generated/20260621-worldcup-pack/fan-poster.png"],
  ["media_dreamshoot_worldcup_story", "MyDreamShoots vertical World Cup fan story layout designed for mobile social sharing and match-day updates", "sites/site_dreamshoot/theme/worldcup-social-story.png", "/assets/dreamshoot/generated/20260621-worldcup-pack/social-story.png"],
  ["media_dreamshoot_worldcup_banner", "MyDreamShoots wide football supporter banner for World Cup profile covers and campaign posts", "sites/site_dreamshoot/theme/worldcup-banner-cover.png", "/assets/dreamshoot/generated/20260621-worldcup-pack/banner-cover.png"],
  ["media_dreamshoot_cyberpunk_solo", "MyDreamShoots solo cyberpunk portrait with neon city color and futuristic styling for creative profile content", "sites/site_dreamshoot/theme/cyberpunk-solo-city-v1.png", "/assets/dreamshoot/generated/20260619/cyberpunk-solo-city-v1.png"]
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
settings.seo.pages = Object.fromEntries(
  pages
    .map((page) => {
      const mapping = pageMappings.find((item) => `${siteId}_${item.idSuffix}` === page.id);
      const seo = mapping ? dreamshootSeoPages[mapping.templateKey] ?? dreamshootSeoPages[mapping.idSuffix] : undefined;
      return seo ? [page.id, { ...seo, ogImage: settings.seo.defaultOgImage }] : undefined;
    })
    .filter(Boolean)
);
const draftTheme = buildThemeRecord({
  id: "theme_site_dreamshoot_draft",
  status: "draft",
  name: "MyDreamShoots Draft",
  themeId: "site_dreamshoot_draft",
  pages,
  settings
});
const activeTheme = buildThemeRecord({
  id: "theme_site_dreamshoot_active",
  status: "active",
  name: "MyDreamShoots Live",
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
  primaryDomain: "www.mydreamshoots.com",
  currency: "usd",
  timezone: "America/New_York",
  branding: {
    logoText: siteName,
    market: "AI photo packages, personal AI models, free tools, credits, AI video, and private albums",
    description: dreamshootAiStudioSiteSettings.branding?.description ?? settings.seo.siteDescription,
    logoImageUrl
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
state.siteDomains = replaceWhere(state.siteDomains ?? [], (item) => item.siteId === siteId || item.domain === "mydreamshoots.localhost" || item.domain === "www.mydreamshoots.com", [
  { id: "dom_dreamshoot_primary", siteId, domain: "www.mydreamshoots.com", isPrimary: true, status: "active", createdAt: now },
  { id: "dom_dreamshoot_localhost", siteId, domain: "mydreamshoots.localhost", isPrimary: false, status: "active", createdAt: now }
]);
state.siteAdmins = replaceWhere(state.siteAdmins ?? [], (item) => item.siteId === siteId, [
  {
    id: "admin_dreamshoot_owner",
    siteId,
    email: "owner@mydreamshoots.localhost",
    passwordHash: hashPassword("mydreamshoots123"),
    displayName: "MyDreamShoots Owner",
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
const baseVideoApp = (state.aiApps ?? []).find((app) => app.slug === "video_generator") ?? {
  id: "ai_video_generator",
  slug: "video_generator",
  name: "Image to Video",
  description: "Generate a private video clip from ordered customer frame images and a maintained video theme.",
  appType: "video",
};
const imageApp = {
  ...baseImageApp,
  name: "MyDreamShoots Image Studio",
  description: "Private AI photo packs, scene generation, AI video-ready outputs, and customer-only gallery delivery.",
  parameterSchema: [
    { id: "style", label: "Style", type: "select", options: ["world-cup", "gala", "creator", "travel", "headshot", "beauty", "virtual-try-on", "sports"] },
    { id: "outputCount", label: "Output count", type: "select", options: ["8", "20", "40"] }
  ]
};
const videoApp = {
  ...baseVideoApp,
  name: "Image to Video",
  description: "Generate a private video clip from ordered customer frame images and a maintained video theme.",
  appType: "video",
  parameterSchema: []
};
state.aiApps = (() => {
  const next = (state.aiApps ?? []).map((app) => {
    if (app.id === imageApp.id || app.slug === imageApp.slug) return imageApp;
    if (app.id === videoApp.id || app.slug === videoApp.slug) return videoApp;
    return app;
  });
  if (!next.some((app) => app.id === imageApp.id)) next.push(imageApp);
  if (!next.some((app) => app.id === videoApp.id)) next.push(videoApp);
  return next;
})();
state.siteAiApps = replaceWhere(state.siteAiApps ?? [], (item) => item.siteId === siteId, [
  { id: "sai_dreamshoot_image", siteId, aiApp: imageApp, enabled: true, creditCost: 24, routeKey: "n8n.image.dreamshoot.v1" }
]);
state.aiGatewayGroups = replaceWhere(state.aiGatewayGroups ?? [], (item) => item.siteId === siteId, [
  {
    id: "gw_dreamshoot_primary",
    siteId,
    name: "MyDreamShoots image quota",
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
    email: "nora@mydreamshoots.localhost",
    passwordHash: hashPassword("nora123"),
    name: "Nora Whitman",
    status: "active",
    balance: { available: 276, reserved: 24 }
  },
  {
    id: "cust_dreamshoot_mqq9gas9_i1vjal",
    siteId,
    email: "1621417163@qq.com",
    passwordHash: hashPassword("mydreamshoots123"),
    name: "Nora Whitman",
    status: "active",
    balance: { available: 312, reserved: 0 }
  }
]);
state.subscriptions = replaceWhere(state.subscriptions ?? [], (item) => item.siteId === siteId, [
  {
    id: "sub_dreamshoot_nora",
    siteId,
    customerId: "cust_dreamshoot_nora",
    productId: "prod_dreamshoot_pro",
    priceId: "price_dreamshoot_pro_monthly",
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
    amountCents: 3500,
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
