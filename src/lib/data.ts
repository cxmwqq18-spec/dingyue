import type {
  AiApp,
  CreditLedgerEntry,
  Customer,
  GenerationJob,
  PlatformAdmin,
  PlatformState,
  Product,
  Subscription,
  SectionInstance,
  SectionType,
  Site,
  SiteAiApp,
  CreativePack,
  MediaAsset,
  SiteTheme,
  ThemePublication,
  AuditLogEntry,
  CustomerModel,
  Album,
  ThemePage,
  ThemePageJson,
  ThemeSettings,
  ThemeSettingValue
} from "./types";
import { sectionDefinitions } from "./section-schema";
import { normalizeSaasSettingsCurrent } from "./theme/saas-theme-package";
import {
  buildSaasThemeDraft,
  buildSaasThemePublication
} from "./theme/saas-theme-model";
import {
  weddingStoryHouseTemplates
} from "./theme/packages/wedding-story-house";
import { dreamshootAiStudioSiteSettings, dreamshootAiStudioTemplates } from "./theme/packages/dreamshoot-ai-studio";
import { canonicalSiteSlug, legacySiteSlugCandidates } from "./domain-routing";
import { getMydreamshootsPolicySeo } from "./theme/policy-seo";
import type { ThemePackageTemplateKey } from "./theme/packages/types";

function cloneSeed<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const publishedSettings: ThemeSettings = {
  colors: {
    background: "#f4f1eb",
    foreground: "#14161a",
    accent: "#2f6fed",
    muted: "#e7e0d5"
  },
  typography: {
    display: "Manrope",
    body: "Geist"
  },
  radii: {
    section: 16,
    control: 10
  },
  navigation: {
    headerLinks: [
      { label: "Packages", href: "#packages" },
      { label: "How it works", href: "/workflow" },
      { label: "Pricing", href: "/pricing" },
      { label: "Studio", href: "/app" }
    ],
    footerLinks: [
      { label: "Privacy", href: "/policies/privacy" },
      { label: "Refunds", href: "/policies/refunds" },
      { label: "Content policy", href: "/policies/content" },
      { label: "Help center", href: "/help" },
      { label: "Blog", href: "/blog" }
    ]
  },
  globalSections: {
    header: section("header", {
      title: "Lumen",
      sticky: true,
      ctaLabel: "Pricing",
      ctaHref: "/pricing",
      style: "dark_pills",
      mobileLabel: "Menu"
    }, [
      { id: "global_header_tools", type: "menu_link", settings: { label: "Tools", href: "#tools" } },
      { id: "global_header_packages", type: "menu_link", settings: { label: "Browse packages", href: "#packages" } },
      { id: "global_header_blog", type: "menu_link", settings: { label: "Blog", href: "/policies/privacy" } }
    ]),
    footer: section("footer", {
      title: "Lumen Portrait Works",
      tagline: "Private AI portrait commerce",
      body: "Transform personal photo libraries into private AI albums with site-owned billing, credits, and delivery.",
      productHeading: "Product",
      companyHeading: "Company",
      supportHeading: "Support",
      socialHeading: "Follow Us",
      instagramUrl: "",
      facebookUrl: "",
      pinterestUrl: "",
      youtubeUrl: "",
      copyright: "Lumen Portrait Works. All rights reserved."
    }, [
      { id: "global_footer_product_packages", type: "menu_link", settings: { label: "Packages", href: "#packages", group: "product" } },
      { id: "global_footer_product_pricing", type: "menu_link", settings: { label: "Pricing", href: "/pricing", group: "product" } },
      { id: "global_footer_company_blog", type: "menu_link", settings: { label: "Blog", href: "/blog", group: "company" } },
      { id: "global_footer_support_privacy", type: "menu_link", settings: { label: "Privacy", href: "/policies/privacy", group: "support" } },
      { id: "global_footer_support_refunds", type: "menu_link", settings: { label: "Refunds", href: "/policies/refunds", group: "support" } },
      { id: "global_footer_support_content", type: "menu_link", settings: { label: "Content policy", href: "/policies/content", group: "support" } },
      { id: "global_footer_support_help", type: "menu_link", settings: { label: "Help center", href: "/help", group: "support" } }
    ])
  },
  saasSettingsCurrent: normalizeSaasSettingsCurrent({
    skin_bg: "#f4f1eb",
    skin_title_color: "#14161a",
    skin_text_color: "#6f716f",
    skin_price_color: "#2f6fed",
    skin_primary_btn_bg_color: "#ffffff",
    skin_primary_btn_text_color: "#0a0a0b",
    skin_primary_btn_border_color: "#ffffff",
    skin_secondary_btn_bg_color: "#f4f1eb",
    skin_secondary_btn_text_color: "#14161a",
    skin_title_font_family: "Manrope",
    skin_text_font_family: "Geist",
    general_layout_width: 1280,
    general_layout_spacing: 56,
    sections: {
      header_plus: {
        type: "header_plus",
        version: "1",
        card_name: "AI studio header",
        settings: {
          is_announce_show: false,
          announce_title: "",
          announce_color: "#ffffff",
          announce_bg_color: "#171717"
        },
        blocks: []
      }
    }
  })
};

function section(type: SectionType, settings: SectionInstance["settings"], blocks: SectionInstance["blocks"] = []): SectionInstance {
  return { type, settings, blocks };
}

function buildThemeSettings(params: {
  siteName: string;
  logoText: string;
  description: string;
  colors?: Partial<ThemeSettings["colors"]>;
  typography?: Partial<ThemeSettings["typography"]>;
  radii?: Partial<ThemeSettings["radii"]>;
}): ThemeSettings {
  const next = cloneSeed(publishedSettings);
  next.colors = { ...next.colors, ...params.colors };
  next.typography = { ...next.typography, ...params.typography };
  next.radii = { ...next.radii, ...params.radii };

  if (next.globalSections?.header) {
    next.globalSections.header.settings = {
      ...next.globalSections.header.settings,
      title: params.logoText
    };
  }

  if (next.globalSections?.footer) {
    next.globalSections.footer.settings = {
      ...next.globalSections.footer.settings,
      title: params.siteName,
      tagline: next.globalSections.footer.settings.tagline ?? params.logoText,
      body: params.description,
      copyright: `${params.siteName}. All rights reserved.`
    };
  }

  next.saasSettingsCurrent = normalizeSaasSettingsCurrent({
    ...(next.saasSettingsCurrent ?? {}),
    skin_bg: next.colors.background,
    skin_title_color: next.colors.foreground,
    skin_text_color: next.colors.foreground,
    skin_price_color: next.colors.accent,
    skin_muted_color: next.colors.muted,
    skin_title_font_family: next.typography.display,
    skin_text_font_family: next.typography.body
  });

  return next;
}

const weddingSiteName = dreamshootAiStudioSiteSettings.branding?.logoText ?? "MyDreamShoots";
const weddingSiteDescription =
  dreamshootAiStudioSiteSettings.branding?.description ??
  "MyDreamShoots is a premium AI photo workspace for themed photo packages, personal AI models, paid studio tools, AI video-ready outputs, and private gallery delivery.";

function packageGlobalSection(
  type: "header" | "footer",
  globalSection?: {
    settings?: Record<string, ThemeSettingValue>;
    blocks?: SectionInstance["blocks"];
  }
): SectionInstance {
  return section(
    type,
    cloneSeed(globalSection?.settings ?? {}),
    cloneSeed(globalSection?.blocks ?? []) as SectionInstance["blocks"]
  );
}

function buildWeddingThemeSettings(): ThemeSettings {
  const branding = dreamshootAiStudioSiteSettings.branding;
  const themeSettings = dreamshootAiStudioSiteSettings.themeSettings;
  const next = buildThemeSettings({
    siteName: weddingSiteName,
    logoText: branding?.logoText ?? "AI Wedding",
    description: weddingSiteDescription,
    colors: themeSettings?.colors,
    typography: themeSettings?.typography,
    radii: themeSettings?.radii
  });

  if (themeSettings?.navigation) {
    next.navigation = {
      headerLinks: cloneSeed(themeSettings.navigation.headerLinks ?? next.navigation.headerLinks),
      footerLinks: cloneSeed(themeSettings.navigation.footerLinks ?? next.navigation.footerLinks)
    };
  }

  if (themeSettings?.globalSections) {
    next.globalSections = {
      header: packageGlobalSection("header", themeSettings.globalSections.header),
      footer: packageGlobalSection("footer", themeSettings.globalSections.footer)
    };
  }

  if (themeSettings?.saasSettingsCurrent) {
    next.saasSettingsCurrent = normalizeSaasSettingsCurrent({
      ...(next.saasSettingsCurrent ?? {}),
      ...(cloneSeed(themeSettings.saasSettingsCurrent) as Record<string, ThemeSettingValue>)
    });
  }

  if (next.typography.display === "Playfair Display") {
    next.saasSettingsCurrent = normalizeSaasSettingsCurrent({
      ...(next.saasSettingsCurrent ?? {}),
      skin_title_font_family: "Playfair Display"
    });
  }

  if (themeSettings?.seo) {
    next.seo = {
      siteTitle: themeSettings.seo.siteTitle ?? weddingSiteName,
      siteDescription: themeSettings.seo.siteDescription ?? weddingSiteDescription,
      titleTemplate: themeSettings.seo.titleTemplate ?? `%s | ${weddingSiteName}`,
      defaultOgImage: themeSettings.seo.defaultOgImage,
      robots: { index: true, follow: true },
      pages: {}
    };
  }

  return next;
}

const _dreamShootHomeSections = {
  email_start_1: section("email_start_panel", {
    anchor: "start",
    eyebrow: "Start your AI shoot",
    title: "Begin with email, then choose a private photo package.",
    subtitle: "Enter with email, then continue to login, checkout, credits, and private album delivery.",
    placeholder: "you@example.com",
    buttonLabel: "Continue",
    actionHref: "/login"
  }, [
    { id: "start_metric_credits", type: "stat", settings: { value: "Credits", label: "subscription or pack checkout" } },
    { id: "start_metric_private", type: "stat", settings: { value: "Private", label: "uploads stay in your account" } },
    { id: "start_metric_albums", type: "stat", settings: { value: "Albums", label: "download-ready delivery" } }
  ]),
  login_methods_1: section("login_method_panel", {
    anchor: "start",
    eyebrow: "Start studio",
    title: "Upload selfies after a secure customer login.",
    subtitle: "Each site owns its customer accounts, secure checkout, credits, and private albums.",
    emailPlaceholder: "you@example.com",
    buttonLabel: "Continue with email",
    actionHref: "/login"
  }, [
    { id: "login_email_access", type: "login_method", settings: { label: "Use email access", helper: "Log in, register, or reset your password from one private account page.", kind: "email", href: "/login" } },
    { id: "login_email", type: "login_method", settings: { label: "Use email login", helper: "Password login is available for private album access.", kind: "email", href: "/login" } }
  ]),
  trust_bar_1: section("trust_signal_bar", {
    anchor: "trust",
    title: "Built for private AI photo delivery."
  }, [
    { id: "trust_private", type: "stat", settings: { value: "Private", label: "uploads stay in your account" } },
    { id: "trust_credits", type: "stat", settings: { value: "History", label: "clear credit timing" } },
    { id: "trust_albums", type: "stat", settings: { value: "Albums", label: "download-ready outputs" } },
    { id: "trust_connect", type: "stat", settings: { value: "Secure", label: "checkout-ready plans" } }
  ]),
  feature_tabs_1: section("dreamshoot_feature_tabs", {
    anchor: "features",
    eyebrow: "AI photo tools",
    title: "Choose the photo flow before signup.",
    subtitle: "Present each AI photo offer as a clear package, tool, or private album workflow.",
    layout: "split"
  }, [
    { id: "tab_headshots", type: "feature_tab", settings: { label: "Headshots", title: "Professional headshot packs", description: "Create profile, founder, resume, and team portraits from everyday uploads.", imageUrl: "/assets/dreamshoot/generated/20260618/headshot-lifestyle-v1.png", href: "/tools/headshot" } },
    { id: "tab_video", type: "feature_tab", settings: { label: "AI video", title: "Short-form photo video packs", description: "Package generated portraits into social-ready motion concepts for campaigns and personal channels.", imageUrl: "/assets/dreamshoot/generated/20260618/upscaler-utility-v1.png", href: "/tools/image-to-video" } },
    { id: "tab_tryon", type: "feature_tab", settings: { label: "Virtual try-on", title: "Preview outfits and themed looks", description: "Use style prompts and pack rules to simulate editorial looks before generation starts.", imageUrl: "/assets/dreamshoot/frames/tab-virtual-looks.png", href: "/tools/virtual-try-on" } }
  ]),
  sample_strip_1: section("sample_strip", {
    anchor: "samples",
    eyebrow: "Generated looks",
    title: "One upload set can become travel, headshot, beauty, and fashion photos.",
    subtitle: "Preview concrete photo outcomes before creating an account.",
    speed: "slow"
  }, [
    { id: "sample_creator", type: "sample", settings: { label: "Creator", imageUrl: "/assets/dreamshoot/avatar-nora-gpt2-fast.png", meta: "Profile album" } },
    { id: "sample_headshot", type: "sample", settings: { label: "Headshot", imageUrl: "/assets/dreamshoot/generated/20260618/headshot-lifestyle-v1.png", meta: "Profile pack" } },
    { id: "sample_editorial", type: "sample", settings: { label: "Editorial", imageUrl: "/assets/dreamshoot/editorial-headshot-gpt2.png", meta: "Studio set" } },
    { id: "sample_worldcup", type: "sample", settings: { label: "World Cup", imageUrl: "/assets/dreamshoot/generated/20260619/world-cup-fan-star-clean-v1.png", meta: "Fan photo pack" } }
  ]),
  studio_steps_1: section("studio_steps", {
    anchor: "workflow",
    eyebrow: "How it works",
    title: "Customers know exactly what happens after signup.",
    subtitle: "Upload source photos, create a private model, choose a package, and receive the finished album.",
    imageUrl: "/assets/dreamshoot/frames/workflow-upload-source.png"
  }, [
    { id: "step_upload", type: "card", settings: { title: "Upload selfies", text: "Add clear photos for each person. Your images stay in your private account.", meta: "01", imageUrl: "" } },
    { id: "step_train", type: "card", settings: { title: "Train model", text: "A private customer model keeps faces and style consistent before generation starts.", meta: "02", imageUrl: "" } },
    { id: "step_choose", type: "card", settings: { title: "Choose a pack", text: "Each package shows the result, photo count, and credit cost before checkout.", meta: "03", imageUrl: "" } },
    { id: "step_deliver", type: "card", settings: { title: "Deliver album", text: "Finished images appear in the private album, with credits settled after generation.", meta: "04", imageUrl: "" } }
  ]),
  occasions_1: section("occasion_showcase", {
    anchor: "occasions",
    eyebrow: "Photo occasions",
    title: "Choose the story your AI shoot should tell.",
    subtitle: "Merchandise concrete customer outcomes: creator portraits, World Cup fan photos, headshots, beauty, travel, and editorial sets."
  }, [
    { id: "occasion_creator", type: "occasion", settings: { title: "Creator portraits", description: "Profile, portfolio, and social channel visuals for solo creators.", tag: "Creator", imageUrl: "/assets/dreamshoot/avatar-nora-gpt2-fast.png", href: "/tools/creator-portrait" } },
    { id: "occasion_worldcup", type: "occasion", settings: { title: "World Cup fan photos", description: "Stadium meet-ups, fan posters, and sports profile scenes.", tag: "Sports", imageUrl: "/assets/dreamshoot/generated/20260619/world-cup-fan-star-clean-v1.png", href: "/tools/world-cup-fan-photos" } },
    { id: "occasion_headshot", type: "occasion", settings: { title: "Headshots", description: "Professional photos for founders, job search, and teams.", tag: "Professional", imageUrl: "/assets/dreamshoot/generated/20260618/headshot-lifestyle-v1.png", href: "/tools/headshot" } }
  ]),
  pack_marquee_1: section("shoot_pack_marquee", {
    anchor: "packs",
    eyebrow: "Popular packs",
    title: "Sell clear photo packages.",
    subtitle: "World Cup, gala, travel, headshot, beauty, try-on, creator, and editorial packs give customers clear outcomes to choose from.",
    source: "creative_packs"
  }, [
    { id: "marquee_headshots", type: "package", settings: { title: "Professional Headshots", description: "Founder, LinkedIn, resume, and profile-ready portraits.", meta: "Private gallery", credits: "20 credits", imageUrl: "/assets/dreamshoot/generated/20260618/headshot-lifestyle-v1.png", href: "/tools/headshot" } },
    { id: "marquee_worldcup", type: "package", settings: { title: "World Cup Fan Photos", description: "Stadium meet-ups, fan posters, and sports profile visuals.", meta: "Private gallery", credits: "26 credits", imageUrl: "/assets/dreamshoot/generated/20260619/world-cup-fan-star-clean-v1.png", href: "/tools/world-cup-fan-photos" } },
    { id: "marquee_gala", type: "package", settings: { title: "Gala Photos", description: "Formal night-out scenes and editorial lighting.", meta: "Private gallery", credits: "24 credits", imageUrl: "/assets/dreamshoot/frames/sample-gala.png", href: "/tools/gala-photo" } }
  ]),
  launcher_1: section("ai_feature_launcher", {
    anchor: "features",
    eyebrow: "AI studio features",
    title: "A real product frontend, not just a landing page.",
    subtitle: "Customers can log in, upload, run jobs, check progress, view albums, and manage credits."
  }, [
    { id: "launcher_uploads", type: "feature", settings: { title: "Upload photos", description: "Collect selfies and source images inside your private photo workspace.", meta: "Private intake", href: "/app" } },
    { id: "launcher_train", type: "feature", settings: { title: "Train models", description: "Prepare private customer or brand models before package generation.", meta: "Model state", href: "/app" } },
    { id: "launcher_progress", type: "feature", settings: { title: "Track jobs", description: "Show queued, running, succeeded, failed, and rerun states.", meta: "Worker callbacks", href: "/app" } },
    { id: "launcher_albums", type: "feature", settings: { title: "Download albums", description: "Deliver generated outputs to private customer galleries.", meta: "Signed assets", href: "/app" } }
  ]),
  conversion_1: section("conversion_panel", {
    anchor: "start",
    eyebrow: "Start creating",
    title: "Open a private AI studio account.",
    subtitle: "Registration, subscription, credit packs, and customer albums all stay isolated to this site.",
    primaryCta: "Create account",
    primaryHref: "/login",
    secondaryCta: "Choose a plan",
    secondaryHref: "/pricing"
  }, [
    { id: "cta_metric_outputs", type: "stat", settings: { value: "40", label: "outputs in premium packs" } },
    { id: "cta_metric_private", type: "stat", settings: { value: "Private", label: "customer albums" } },
    { id: "cta_metric_credits", type: "stat", settings: { value: "History", label: "secure checkout" } }
  ])
};

const homeJson: ThemePageJson = {
  pageType: "home",
  version: 1,
  sectionsOrder: [
    "hero_1",
    "brand_strip_1",
    "sample_strip_1",
    "story_1",
    "video_1",
    "trust_bar_1",
    "packages_1",
    "feature_tabs_1",
    "workflow_1",
    "pricing_1",
    "conversion_1",
    "proof_1",
    "faq_1",
    "footer_1"
  ],
  sections: {
    hero_1: section("hero", {
      eyebrow: "",
      headline: "Studio-quality AI photos from the selfies on your phone.",
      subheadline:
        "Turn everyday uploads into headshots, creator portraits, World Cup fan photos, gala scenes, travel looks, and short video-ready images.",
      mediaAssetId: "media_lumen_editorial_hero",
      imageUrl: "media_lumen_editorial_hero",
      secondaryImageUrl: "media_lumen_hero",
      tertiaryImageUrl: "media_lumen_editorial_close",
      bulletList:
        "Upload selfies and create your own AI model.|Themed photo packs from headshots to World Cup fan photos.|Magic upscaler for cleaner delivery.|AI video concepts from finished images.",
      highlightWord: "real",
      heroBadge: "AI photo package studio",
      authRibbon: "World Cup and gala packs live",
      authPrimaryLabel: "Continue with Google",
      authEmailPlaceholder: "Email address",
      authButtonLabel: "Create account with email",
      authPrimaryHref: "/login?mode=login",
      authEmailHref: "/login?mode=register",
      socialProofLabel: "Creators use MyDreamShoots Pro for private photo packs",
      layout: "immersive_dark"
    }, [
      { id: "hero_cta_primary", type: "cta", settings: { label: "Get Started", href: "/login", style: "primary" } }
    ]),
    brand_strip_1: section("brand_logo_strip", {
      anchor: "trusted",
      title: "Trusted by customers creating headshots, fan photos, and private albums",
      style: "dark"
    }, [
      { id: "logo_reviews", type: "logo", settings: { name: "Use cases", imageUrl: "", badge: "Proof" } },
      { id: "logo_packages", type: "logo", settings: { name: "Photo Packages", imageUrl: "", badge: "Catalog" } },
      { id: "logo_model", type: "logo", settings: { name: "Personal AI Model", imageUrl: "", badge: "Private" } },
      { id: "logo_video", type: "logo", settings: { name: "AI Video", imageUrl: "", badge: "Motion" } },
      { id: "logo_tryon", type: "logo", settings: { name: "Virtual Try-On", imageUrl: "", badge: "Style" } }
    ]),
    sample_strip_1: section("sample_strip", {
      anchor: "samples",
      eyebrow: "Generated looks",
      title: "One upload set can become travel, headshot, beauty, and editorial photos.",
      subtitle: "A visual shelf gives customers confidence before they create an account or buy credits.",
      speed: "slow"
    }, [
      { id: "sample_creator", type: "sample", settings: { label: "Creator", imageUrl: "media_lumen_hero", meta: "Profile album" } },
      { id: "sample_headshot", type: "sample", settings: { label: "Headshot", imageUrl: "media_lumen_pack_exec", meta: "Profile pack" } },
      { id: "sample_editorial", type: "sample", settings: { label: "Editorial", imageUrl: "media_lumen_editorial_hero", meta: "Studio set" } },
      { id: "sample_worldcup", type: "sample", settings: { label: "World Cup", imageUrl: "/assets/dreamshoot/generated/20260619/world-cup-fan-star-clean-v1.png", meta: "Fan photo pack" } }
    ]),
    story_1: section("story_mosaic", {
      anchor: "story",
      eyebrow: "Featured story",
      title: "AI World Cup fan photos and creator portraits",
      subtitle:
        "Make sports fan and profile campaigns easy to understand. One themed story block lets an admin swap imagery, headline, and CTA without code.",
      ctaLabel: "Create My Fan Photos",
      ctaHref: "/login",
      tone: "dark"
    }, [
      { id: "story_card_lead", type: "story_card", settings: { label: "Sports feature", imageUrl: "/assets/dreamshoot/generated/20260619/world-cup-fan-star-clean-v1.png", meta: "Featured", href: "/login" } },
      { id: "story_card_two", type: "story_card", settings: { label: "Creator portrait", imageUrl: "media_lumen_editorial_close", meta: "Campaign", href: "/login" } },
      { id: "story_card_three", type: "story_card", settings: { label: "Editorial look", imageUrl: "media_lumen_editorial_hero", meta: "Premium", href: "/login" } },
      { id: "story_card_four", type: "story_card", settings: { label: "Headshot mood", imageUrl: "media_lumen_pack_exec", meta: "Headshot", href: "/login" } },
      { id: "story_card_five", type: "story_card", settings: { label: "Fan poster", imageUrl: "/assets/dreamshoot/generated/20260619/world-cup-fan-star-clean-v1.png", meta: "Sports", href: "/login" } },
      { id: "story_card_six", type: "story_card", settings: { label: "Studio style", imageUrl: "media_lumen_story_square_two", meta: "Studio", href: "/login" } }
    ]),
    video_1: section("video_feature", {
      anchor: "how-it-works",
      eyebrow: "AI photo and video package maker",
      title: "See how it works",
      subtitle: "Frame a featured walkthrough module that can later bind to a real tutorial video or campaign explainer.",
      imageUrl: "media_lumen_editorial_hero",
      videoBadge: "HAPPY NEW YEAR",
      playLabel: "Watch tutorial"
    }),
    packages_1: section("photo_package_wall", {
      anchor: "packages",
      eyebrow: "Professional AI Photo Packages",
      title: "Photo packs customers can understand immediately.",
      subtitle:
        "Customers can compare finished photo directions before they choose a package.",
      source: "creative_packs",
      layout: "editorial"
    }),
    trust_bar_1: section("trust_signal_bar", {
      anchor: "trust",
      title: "Built for private AI photo delivery."
    }, [
      { id: "trust_private", type: "stat", settings: { value: "Private", label: "uploads stay in your account" } },
      { id: "trust_credits", type: "stat", settings: { value: "History", label: "clear credit timing" } },
      { id: "trust_albums", type: "stat", settings: { value: "Albums", label: "download-ready outputs" } },
      { id: "trust_connect", type: "stat", settings: { value: "Secure", label: "checkout-ready plans" } }
    ]),
    workflow_1: section("feature_grid", {
      anchor: "workflow",
      source: "blocks",
      layout: "steps",
      eyebrow: "Upload selfies and start creating your AI photoshoot",
      title: "A storefront flow customers can understand in seconds.",
      subtitle: "Every step is a child block. Store admins can edit, reorder, delete, and publish it without touching code."
    }, [
      { id: "workflow_upload", type: "card", settings: { title: "Upload", text: "Add clear selfies for each person. Files stay in the customer's private account.", meta: "Step 01", imageUrl: "media_lumen_story_square" } },
      { id: "workflow_train", type: "card", settings: { title: "Train", text: "Build a private customer model before generating themed albums.", meta: "Step 02", imageUrl: "media_lumen_story_square_two" } },
      { id: "workflow_generate", type: "card", settings: { title: "Generate", text: "Pick a pack, confirm the credit cost, and start the private photo request.", meta: "Step 03", imageUrl: "media_lumen_hero" } },
      { id: "workflow_download", type: "card", settings: { title: "Download", text: "Results land in the customer's album with private delivery and audit history.", meta: "Step 04", imageUrl: "media_lumen_editorial_close" } }
    ]),
    pricing_1: section("pricing_table", {
      anchor: "plans",
      title: "Plans & Pricing",
      subtitle: "This section reads active product and price records. Store admins cannot publish a fake number that drifts from billing.",
      productType: "all",
      showCheckoutNote: true
    }),
    conversion_1: section("conversion_panel", {
      anchor: "start",
      eyebrow: "Start creating",
      title: "Open a private AI studio account.",
      subtitle: "Registration, subscription, credit packs, and customer albums all stay isolated to this site.",
      primaryCta: "Create account",
      primaryHref: "/login",
      secondaryCta: "Choose a plan",
      secondaryHref: "/pricing"
    }, [
      { id: "cta_metric_outputs", type: "stat", settings: { value: "40", label: "outputs in premium packs" } },
      { id: "cta_metric_private", type: "stat", settings: { value: "Private", label: "customer albums" } },
      { id: "cta_metric_credits", type: "stat", settings: { value: "History", label: "secure checkout" } }
    ]),
    feature_tabs_1: section("dreamshoot_feature_tabs", {
      anchor: "tools",
      eyebrow: "Professional AI photo flows",
      title: "Choose the photo flow before signup.",
      subtitle: "Present each AI photo offer as a clear package, tool, or private album workflow.",
      layout: "split"
    }, [
      { id: "tab_creator", type: "feature_tab", settings: { label: "Creator photos", title: "AI creator portrait maker", description: "Profile, portfolio, social, and fan-poster image sets.", imageUrl: "media_lumen_hero", href: "/tools/creator-portrait" } },
      { id: "tab_headshots", type: "feature_tab", settings: { label: "Headshots", title: "Executive profile packs", description: "Professional portraits for founders, teams, and consultants.", imageUrl: "media_lumen_pack_exec", href: "/tools/headshot" } },
      { id: "tab_editorial", type: "feature_tab", settings: { label: "Editorial", title: "Studio editorial looks", description: "Magazine-style fashion and premium social profile imagery.", imageUrl: "media_lumen_editorial_close", href: "/tools/fashion-editorial" } }
    ]),
    proof_1: section("testimonial_wall", {
      anchor: "proof",
      title: "What Our Customers Say",
      subtitle: "Real customer stories show how private albums, credits, and polished photo packages work together."
    }, [
      { id: "proof_mara", type: "testimonial", settings: { quote: "The first headshot pack gave me enough polished options for LinkedIn and a founder page.", name: "Mara Voss", role: "Pro plan customer" } },
      { id: "proof_ivo", type: "testimonial", settings: { quote: "Credits, billing, and albums were easy to follow from checkout to delivery.", name: "Ivo Renard", role: "Studio customer" } },
      { id: "proof_admin", type: "testimonial", settings: { quote: "The package page made it clear what I would get before I uploaded photos.", name: "Sera Delon", role: "Photo package buyer" } }
    ]),
    faq_1: section("faq", {
      title: "Frequently asked questions",
      subtitle: "Answer the objections customers have before uploading private photos."
    }, [
      { id: "faq_uploads", type: "faq_item", settings: { question: "What photos should customers upload?", answer: "Clear, recent selfies with varied angles, expressions, lighting, and outfits work best for private model quality." } },
      { id: "faq_worker", type: "faq_item", settings: { question: "When are credits used?", answer: "Credits are reserved when a generation starts, spent after successful delivery, and released or reviewed if a job cannot be completed." } },
      { id: "faq_draft", type: "faq_item", settings: { question: "Can I review before buying?", answer: "Yes. Package pages explain the expected result, credit cost, and upload guidance before checkout." } },
      { id: "faq_reorder", type: "faq_item", settings: { question: "Can I choose different photo styles?", answer: "Yes. Browse packages for headshots, creator portraits, beauty, travel, sports, and editorial looks." } }
    ]),
    footer_1: section("footer", {
      title: "Lumen Portrait Works",
      body: "Transform personal photo libraries into private AI albums with site-owned billing, credits, and delivery."
    })
  }
};

const pricingJson: ThemePageJson = {
  pageType: "pricing",
  version: 1,
  sectionsOrder: ["header_1", "pricing_1", "faq_1", "footer_1"],
  sections: {
    header_1: section("rich_text", {
      eyebrow: "Credits and albums",
      title: "Choose the studio capacity for your next photo set.",
      body: "Monthly plans grant credits for private AI albums. One-time packs extend capacity without changing subscription state."
    }),
    pricing_1: section("pricing_table", {
      title: "Choose the studio capacity",
      subtitle: "Plan and credit-pack pricing is shown before checkout.",
      productType: "all",
      showCheckoutNote: true
    }),
    faq_1: section("faq", {
      title: "Billing rules"
    }, [
      { id: "billing_faq_grant", type: "faq_item", settings: { question: "When are credits granted?", answer: "Credits are added after secure payment confirmation." } },
      { id: "billing_faq_pack", type: "faq_item", settings: { question: "Can customers buy more credits?", answer: "Yes. Credit packs add capacity without changing the subscription." } },
      { id: "billing_faq_past_due", type: "faq_item", settings: { question: "What happens when a subscription is past due?", answer: "The customer keeps login, album, and download access, but cannot create new generation jobs." } }
    ]),
    footer_1: section("footer", {
      title: "Lumen Portrait Works",
      body: "Every plan and credit pack shows its current checkout price before purchase."
    })
  }
};

const toolJson: ThemePageJson = {
  pageType: "ai_tool",
  version: 1,
  sectionsOrder: ["entry_1", "upload_1", "form_1", "progress_1", "album_1", "footer_1"],
  sections: {
    entry_1: section("ai_tool_entry", {
      title: "Image Studio",
      subtitle: "Create a themed photo album from a private model and credits in your account."
    }),
    upload_1: section("upload_panel", {
      title: "Private upload intake",
      helper: "Uploads stay in the signed-in customer's private account."
    }),
    form_1: section("generation_form", {
      aiAppSlug: "image_generator",
      title: "Generation form"
    }),
    progress_1: section("job_progress", {
      title: "Visible job state"
    }),
    album_1: section("album_gallery", {
      title: "Customer album"
    }),
    footer_1: section("footer", {
      title: "Lumen Portrait Works",
      body: "Tool pages guide customers from upload to generation and private album delivery."
    })
  }
};

const collectionJson: ThemePageJson = {
  pageType: "collection",
  version: 1,
  sectionsOrder: ["header_1", "grid_1", "footer_1"],
  sections: {
    header_1: section("rich_text", {
      eyebrow: "Collection template",
      title: "Browse active AI photo packages.",
      body: "Browse themed AI photo packages with clear results, photo counts, and credit expectations."
    }),
    grid_1: section("photo_package_wall", {
      anchor: "packages",
      eyebrow: "Packages",
      title: "Choose a themed AI shoot.",
      subtitle: "Browse available photo packages and choose the style that fits your next private album.",
      source: "creative_packs",
      layout: "editorial"
    }),
    footer_1: section("footer", {
      title: "Lumen Portrait Works",
      body: "Package pages help customers compare photo styles before starting a private shoot."
    })
  }
};

const searchJson: ThemePageJson = {
  pageType: "search",
  version: 1,
  sectionsOrder: ["header_1", "results_1", "footer_1"],
  sections: {
    header_1: section("rich_text", {
      eyebrow: "Search template",
      title: "Find packages, tools, and help content.",
      body: "Search helps customers find photo packages, pricing, tools, privacy details, and help articles.",
      headingLevel: "h1"
    }),
    results_1: section("ai_tool_grid", {
      title: "Suggested AI tools",
      subtitle: "Search pages can fall back to active AI tools and package routes."
    }),
    footer_1: section("footer", {
      title: "Search",
      body: "Draft edits stay isolated until the template is published."
    })
  }
};

const cartJson: ThemePageJson = {
  pageType: "cart",
  version: 1,
  sectionsOrder: ["header_1", "cart_1", "pricing_1", "footer_1"],
  sections: {
    header_1: section("rich_text", {
      eyebrow: "Cart template",
      title: "Review subscription plans and credit packs.",
      body: "Review selected plans, credit packs, and checkout details before continuing.",
      headingLevel: "h1"
    }),
    cart_1: section("conversion_panel", {
      anchor: "checkout",
      eyebrow: "Checkout",
      title: "Continue to secure site-owned checkout.",
      subtitle: "This template routes customers toward secure checkout and account actions.",
      primaryCta: "Choose a plan",
      primaryHref: "/pricing",
      secondaryCta: "Sign in to continue",
      secondaryHref: "/login"
    }),
    pricing_1: section("pricing_table", {
      title: "Available plans",
      subtitle: "Current prices appear before secure checkout.",
      productType: "all",
      showCheckoutNote: true
    }),
    footer_1: section("footer", {
      title: "Cart",
      body: "Review your selected plan or credit pack before checkout."
    })
  }
};

const loginJson: ThemePageJson = {
  pageType: "login",
  version: 1,
  sectionsOrder: ["intro_1", "login_1", "trust_1", "footer_1"],
  sections: {
    intro_1: section("rich_text", {
      eyebrow: "Customer login",
      headingLevel: "h2",
      title: "Sign in to create, track, and download your AI photos",
      body: "Use one private account for uploads, subscriptions, photo requests, credits, and finished albums.",
      primaryCta: "Start creating",
      primaryHref: "/pricing",
      secondaryCta: "View privacy",
      secondaryHref: "/privacy"
    }),
    login_1: section("login_method_panel", {
      anchor: "start",
      eyebrow: "Customer login",
      headingLevel: "h1",
      title: "Open your private photo workspace.",
      subtitle: "Sign in to upload source photos, reserve credits before generation, track requests, and download finished albums.",
      emailPlaceholder: "you@example.com",
      buttonLabel: "Continue with email",
      actionHref: "/login",
      imageBadge: "Private customer access",
      imageCaption: "Every source photo, credit, and gallery stays attached to your private account.",
      imageMeta: "Use email access to open the private customer workspace."
    }, [
      { id: "login_email_access", type: "login_method", settings: { label: "Use email access", helper: "Log in, register, or reset your password from one private account page.", kind: "email", href: "/login" } },
      { id: "login_email", type: "login_method", settings: { label: "Use email login", helper: "Password login for private album access.", kind: "email", href: "/login" } }
    ]),
    trust_1: section("trust_signal_bar", {
      anchor: "trust",
      title: "Private, credit-safe, and easy to return to."
    }, [
      { id: "trust_private", type: "stat", settings: { value: "Private", label: "customer uploads" } },
      { id: "trust_credits", type: "stat", settings: { value: "History", label: "credits and reservations" } },
      { id: "trust_albums", type: "stat", settings: { value: "Albums", label: "customer delivery" } }
    ]),
    footer_1: section("footer", {
      title: "MyDreamShoots",
      body: "Private uploads, billing, and albums stay inside your account."
    }, [
      { id: "login_footer_terms", type: "menu_link", settings: { label: "Terms of Service", href: "/terms", group: "support" } },
      { id: "login_footer_privacy", type: "menu_link", settings: { label: "Privacy Policy", href: "/privacy", group: "support" } }
    ])
  }
};

const workspaceJson: ThemePageJson = {
  pageType: "workspace",
  version: 1,
  sectionsOrder: ["workspace_1", "upload_1", "form_1", "progress_1", "album_1"],
  sections: {
    workspace_1: section("ai_feature_launcher", {
      anchor: "workspace",
      eyebrow: "Customer workspace",
      title: "A real account area for uploads, jobs, and delivered albums.",
      subtitle: "This page gives signed-in customers a clear place to upload photos, start requests, track progress, and download albums.",
      ctaLabel: "Start with uploads",
      ctaHref: "/app/upload"
    }, [
      { id: "feature_upload", type: "feature", settings: { title: "Upload photos", description: "Collect selfies and source images inside a private customer workspace.", meta: "Private intake", href: "/app/upload" } },
      { id: "feature_prepare", type: "feature", settings: { title: "Prepare portraits", description: "Choose style prompts and attach uploaded source photos before generation.", meta: "Consistent look", href: "/app/create" } },
      { id: "feature_progress", type: "feature", settings: { title: "Track progress", description: "Show queued, creating, delivered, review-needed, and returned-credit states.", meta: "Live progress", href: "/app/jobs/progress" } },
      { id: "feature_album", type: "feature", settings: { title: "Download albums", description: "Open delivered images and private gallery downloads for this account.", meta: "Private delivery", href: "/album" } }
    ]),
    upload_1: section("upload_panel", {
      title: "Private uploads",
      helper: "Upload source photos into the current customer's private site library."
    }),
    form_1: section("generation_form", {
      title: "Create a generation job",
      helper: "Reserve credits and submit a signed worker job for the current customer.",
      aiAppSlug: "image_generator"
    }),
    progress_1: section("job_progress", { title: "Recent jobs" }),
    album_1: section("album_gallery", { title: "Delivered albums", showDownloads: true })
  }
};

const jobProgressJson: ThemePageJson = {
  pageType: "job_progress",
  version: 1,
  sectionsOrder: ["intro_1", "progress_1", "album_1", "faq_1"],
  sections: {
    intro_1: section("rich_text", {
      eyebrow: "Job progress",
      title: "Show customers what is happening after they submit a job.",
      body: "Queued, running, succeeded, failed, and refunded jobs are read from the current customer runtime."
    }),
    progress_1: section("job_progress", { title: "Current generation status" }),
    album_1: section("album_gallery", { title: "Delivered outputs", showDownloads: true }),
    faq_1: section("faq", {
      title: "Job questions",
      subtitle: "Explain worker states without exposing another customer's data."
    }, [
      { id: "job_faq_queued", type: "faq_item", settings: { question: "Why is a job queued?", answer: "Your request is waiting for generation capacity after credits have been reserved." } },
      { id: "job_faq_failed", type: "faq_item", settings: { question: "What happens when a job fails?", answer: "Reserved credits are released or refunded through your credit history, and the customer can start again." } }
    ])
  }
};

const albumJson: ThemePageJson = {
  pageType: "album",
  version: 1,
  sectionsOrder: ["intro_1", "album_1", "conversion_1"],
  sections: {
    intro_1: section("media_banner", {
      anchor: "album",
      eyebrow: "Private gallery",
      title: "Deliver finished images inside a private customer album.",
      subtitle: "The gallery is editable as a theme page but still constrained to the current customer.",
      imageUrl: "media_lumen_editorial_close",
      ctaLabel: "Upload photos",
      ctaHref: "/app"
    }),
    album_1: section("album_gallery", { title: "Customer gallery", showDownloads: true }),
    conversion_1: section("conversion_panel", {
      anchor: "start",
      eyebrow: "Create more",
      title: "Start another private album.",
      subtitle: "Customers can return to the workspace, upload more source photos, and reserve credits for another generation.",
      primaryCta: "Upload photos",
      primaryHref: "/app",
      secondaryCta: "Choose a plan",
      secondaryHref: "/pricing"
    })
  }
};

const accountJson: ThemePageJson = {
  pageType: "account",
  version: 1,
  sectionsOrder: ["intro_1", "pricing_1", "conversion_1"],
  sections: {
    intro_1: section("rich_text", {
      eyebrow: "Account and billing",
      title: "Credits, subscriptions, and add-ons stay visible after login.",
      body: "Use this page for customer billing education, credit-pack upsells, and subscription management links."
    }),
    pricing_1: section("pricing_table", {
      title: "Available plans and credit packs",
      subtitle: "This section uses the active plans, credit packs, and prices customers can actually buy.",
      productType: "all",
      showCheckoutNote: true
    }),
    conversion_1: section("conversion_panel", {
      anchor: "workspace",
      eyebrow: "Account action",
      title: "Return to the private workspace.",
      subtitle: "Create jobs, check progress, and open delivered albums from the customer account area.",
      primaryCta: "Upload photos",
      primaryHref: "/app",
      secondaryCta: "View gallery",
      secondaryHref: "/album"
    })
  }
};

const notFoundJson: ThemePageJson = {
  pageType: "404",
  version: 1,
  sectionsOrder: ["header_1", "fallback_1", "footer_1"],
  sections: {
    header_1: section("rich_text", {
      eyebrow: "404 template",
      title: "This page is not available.",
      body: "The original SaaS 404.liquid template is editable and published with the rest of the theme."
    }),
    fallback_1: section("ai_feature_launcher", {
      anchor: "tools",
      eyebrow: "Try instead",
      title: "Open an AI studio workflow.",
      subtitle: "Guide customers back to packages, tools, login, or pricing."
    }),
    footer_1: section("footer", {
      title: "Lumen Portrait Works",
      body: "Return to packages, pricing, or your private studio workspace."
    })
  }
};

const privacyJson: ThemePageJson = {
  pageType: "policy",
  version: 1,
  seo: getMydreamshootsPolicySeo("/privacy"),
  sectionsOrder: ["header_1", "policy_1", "footer_1"],
  sections: {
    header_1: section("rich_text", {
      eyebrow: "Privacy policy",
      title: "How MyDreamShoots handles your photo and account data.",
      body: "This policy is written for MyDreamShoots customers using www.mydreamshoots.com, our AI photo package tools, credits, and private album delivery."
    }),
    policy_1: section("policy_content", {
      title: "Privacy policy",
      lastUpdated: "June 25, 2026",
      contactEmail: "support@mydreamshoots.com",
      body: "<h3>1. Scope of this policy</h3><p>This Privacy Policy explains how MyDreamShoots handles information when customers visit www.mydreamshoots.com, create an account, upload source photos, buy credits or subscriptions, use AI photo packages, open private albums, contact support, or use connected checkout and generation tools.</p><h3>2. Information we collect</h3><p>We collect account information such as your email address, authentication method, session records, customer profile details, support messages, and communication preferences. We also process uploaded source photos, reference images, package selections, prompts or style choices you submit, generated previews, delivered images, albums, order records, subscription status, credit ledger events, checkout references, device signals, browser type, approximate request metadata, and security logs.</p><h3>3. How we use information</h3><p>MyDreamShoots uses this information to operate customer accounts, generate requested AI photo results, reserve and settle credits, deliver private albums, process checkout, detect failed jobs, provide customer support, secure the service, prevent misuse, improve reliability, test new package workflows, and show the correct pages after you sign in.</p><h3>4. Uploaded photos and generated images</h3><p>Your uploads and generated results are treated as private customer assets. They are connected to your signed-in account and are not sold as stock images, published in public galleries, or transferred to unrelated storefronts by default. You decide whether to download, share, or reuse your delivered images. We may temporarily process uploads and outputs with infrastructure or AI providers only to complete the service you requested.</p><h3>5. Payments, credits, and checkout records</h3><p>Payments may be processed by Stripe or another connected payment provider. MyDreamShoots stores order IDs, checkout status, plan names, credit purchases, credit reservations, refunds, reversals, and subscription events so your account balance remains accurate. We do not store full card numbers on our own servers.</p><h3>6. Cookies and similar technology</h3><p>We use cookies, local storage, and similar tools for sign-in, session security, CSRF protection, checkout continuity, preference memory, rate limiting, diagnostics, and limited analytics. See the <a href=\"/cookies\">Cookie Policy</a> for more detail.</p><h3>7. Service providers</h3><p>We may use hosting, database, storage, email, analytics, payment, moderation, and AI infrastructure providers. These providers may process limited customer data only for the purpose of running, securing, generating, storing, or delivering the MyDreamShoots service.</p><h3>8. Retention and deletion</h3><p>Uploads, generated results, albums, order records, and credit history may remain available while your account is active so you can revisit past work. You may request deletion of uploaded or generated photos. Some billing, fraud-prevention, tax, security, dispute, and account integrity records may be retained where required or reasonably necessary.</p><h3>9. Your choices</h3><p>You may contact us to request access, correction, export, deletion, or help with account privacy. We may need to verify your identity or account ownership before acting on sensitive requests. Browser controls may also let you manage cookies and local storage.</p><h3>10. Security</h3><p>We use account-scoped sessions, private customer routes, access checks, security cookies, and operational monitoring to reduce unauthorized access. No online service can guarantee perfect security, so customers should protect their login method and contact us quickly if they suspect unauthorized account use.</p><h3>11. Children</h3><p>MyDreamShoots is not intended for children under the age required to consent to online services in their location. Customers should not upload photos of minors unless they have the legal right and consent to do so.</p><h3>12. Changes and contact</h3><p>We may update this policy as features, providers, or legal requirements change. Email <a href=\"mailto:support@mydreamshoots.com\">support@mydreamshoots.com</a> for privacy, account, deletion, or data-use questions.</p>",
      sections: "privacy"
    }),
    footer_1: section("footer", {
      title: "Privacy",
      body: "This page is editable through the same theme system."
    })
  }
};

const cookiePolicyJson: ThemePageJson = {
  pageType: "policy",
  version: 1,
  seo: getMydreamshootsPolicySeo("/cookies"),
  sectionsOrder: ["header_1", "policy_1", "footer_1"],
  sections: {
    header_1: section("rich_text", {
      eyebrow: "Cookie policy",
      title: "How cookies support sign-in, checkout, and private albums.",
      body: "This policy explains the cookies and local storage used on www.mydreamshoots.com for the MyDreamShoots AI photo service."
    }),
    policy_1: section("policy_content", {
      title: "Cookie policy",
      lastUpdated: "June 25, 2026",
      contactEmail: "support@mydreamshoots.com",
      body: "<h3>1. What cookies are</h3><p>Cookies are small files stored by your browser. MyDreamShoots also uses similar browser storage, such as local storage, to keep the AI photo service secure, usable, and consistent while you move between packages, checkout, your account, and private albums.</p><h3>2. Essential cookies</h3><p>Essential cookies support customer sign-in, scoped sessions, CSRF protection, checkout continuity, credit reservation flows, private album access, rate limiting, fraud prevention, and secure admin or customer authentication. These cookies are required for the core service and cannot be switched off inside the site without breaking key features.</p><h3>3. Preference storage</h3><p>We may remember practical preferences such as menu state, recently opened workspace views, selected package context, language or display choices if available, and browser-side UI settings. This helps MyDreamShoots open the right customer workspace more quickly.</p><h3>4. Performance and diagnostics</h3><p>We may collect limited technical signals to understand slow pages, failed requests, broken checkout steps, job submission errors, and account access issues. These signals help us improve route speed, generation reliability, and customer support.</p><h3>5. Analytics and measurement</h3><p>If analytics tools are enabled, they may help us understand aggregated usage such as popular package categories, tool discovery, pricing page visits, and conversion paths. Analytics should not be used to sell your uploaded photos or generated images.</p><h3>6. Payment, email, hosting, and AI providers</h3><p>Connected providers may set or read cookies or similar identifiers when needed for checkout, anti-fraud checks, email delivery, hosting security, media storage, or AI generation. Their use is limited to providing and protecting the requested service.</p><h3>7. Your browser controls</h3><p>You can block, delete, or limit cookies in your browser settings. If you block essential cookies, MyDreamShoots may not be able to keep you signed in, complete checkout, reserve credits, start generation jobs, or open private albums.</p><h3>8. Relationship to privacy policy</h3><p>Cookie data is handled together with the privacy practices described in our <a href=\"/privacy\">Privacy Policy</a>. The <a href=\"/terms\">Terms of Service</a> explain customer responsibilities when using accounts, credits, uploads, and generated outputs.</p><h3>9. Updates and contact</h3><p>We may update this Cookie Policy as we add or remove providers, analytics, checkout methods, or security features. Email <a href=\"mailto:support@mydreamshoots.com\">support@mydreamshoots.com</a> with cookie or tracking questions.</p>",
      sections: "cookies"
    }),
    footer_1: section("footer", {
      title: "Cookie policy",
      body: "Cookie and storage details for MyDreamShoots customers."
    }, [
      { id: "cookies_footer_privacy", type: "menu_link", settings: { label: "Privacy Policy", href: "/privacy", group: "support" } },
      { id: "cookies_footer_terms", type: "menu_link", settings: { label: "Terms of Service", href: "/terms", group: "support" } }
    ])
  }
};

const refundsJson: ThemePageJson = {
  pageType: "policy",
  version: 1,
  sectionsOrder: ["header_1", "policy_1", "footer_1"],
  sections: {
    header_1: section("rich_text", {
      eyebrow: "Refunds",
      title: "How billing reversals are handled.",
      body: "Refunds are tracked with clear billing events so the customer's credit history stays correct."
    }),
    policy_1: section("policy_content", {
      title: "Refunds and reversals",
      lastUpdated: "June 25, 2024",
      contactEmail: "support@mydreamshoots.com",
      body: "<h3>Refund eligibility</h3><p>You may request a refund for purchased credits if none of the credits from that purchase have been used. Once credits have been spent on a successful generation, that purchase becomes non-refundable.</p><h3>Refund window</h3><p>Refund requests should be submitted within 30 days of the purchase date with your account email and purchase details.</p><h3>Subscriptions</h3><p>If a subscription is canceled, the customer keeps access to purchased credits until they are used or expire according to the plan rules. Cancellation does not automatically refund credits already used.</p><h3>Technical failures</h3><p>If a technical failure on our side prevents credit use or delivery, support may release credits, rerun the job, or approve a refund after review.</p><h3>Credit history</h3><p>Refunds and billing reversals appear in the customer's credit history. Checkout completion never grants credits before payment confirmation, and every adjustment is recorded for account support.</p>",
      sections: "refunds"
    }),
    footer_1: section("footer", {
      title: "Refunds",
      body: "Review refund rules before purchasing credits or starting a generation."
    })
  }
};

const contentPolicyJson: ThemePageJson = {
  pageType: "policy",
  version: 1,
  sectionsOrder: ["header_1", "policy_1", "footer_1"],
  sections: {
    header_1: section("rich_text", {
      eyebrow: "Content policy",
      title: "What types of uploads and outputs are allowed.",
      body: "The customer-facing policy page explains upload rules, generation boundaries, and the behavior of private albums."
    }),
    policy_1: section("policy_content", {
      title: "Content policy",
      lastUpdated: "June 25, 2024",
      contactEmail: "support@mydreamshoots.com",
      body: "Customers may only upload assets they control or have permission to use. Generated output remains within the site's account scope, and moderation or review states can block publication when needed.",
      sections: "content"
    }),
    footer_1: section("footer", {
      title: "Content policy",
      body: "Site admins can update policy copy without touching application code."
    })
  }
};

const helpJson: ThemePageJson = {
  pageType: "help",
  version: 1,
  sectionsOrder: ["header_1", "faq_1", "blog_1", "footer_1"],
  sections: {
    header_1: section("rich_text", {
      eyebrow: "Help center",
      title: "Answers for customers, site owners, and support teams.",
      body: "This page gives the site a real support surface instead of a dead footer link.",
      headingLevel: "h1"
    }),
    faq_1: section("faq", {
      title: "Common questions"
    }, [
      { id: "help_uploads", type: "faq_item", settings: { question: "How do customers start a job?", answer: "They log in, upload private photos, select an enabled AI tool, and submit the generation form with credits reserved first." } },
      { id: "help_billing", type: "faq_item", settings: { question: "When do credits update?", answer: "Credits move through the credit history after checkout, reservation, settlement, or release events." } },
      { id: "help_assets", type: "faq_item", settings: { question: "Can a customer see another customer's album?", answer: "No. Every asset and album is private to the signed-in customer account." } }
    ]),
    blog_1: section("blog_list", {
      title: "Guides and walkthroughs",
      subtitle: "Short articles help customers understand packages, uploads, and delivery."
    }),
    footer_1: section("footer", {
      title: "Help center",
      body: "Find guidance for uploads, credits, packages, and private album delivery."
    })
  }
};

const workflowJson: ThemePageJson = {
  pageType: "content",
  version: 1,
  sectionsOrder: ["intro_1", "tutorial_video_1", "tutorial_image_video_1", "mobile_video_1", "workflow_1", "rules_1", "faq_1", "conversion_1", "footer_1"],
  sections: {
    intro_1: section("rich_text", {
      eyebrow: "How it works",
      title: "How customers create a private AI photo set.",
      body: "Use this page to explain the full workflow as a standalone route: upload source photos, choose a package, review credits, start generation, and download the finished private gallery.",
      headingLevel: "h1",
      tone: "dark",
      imageUrl: "/assets/dreamshoot/frames/workflow-upload-source.png",
      primaryCta: "Headshot Generator",
      primaryHref: "/collections/headshots",
      secondaryCta: "View pricing",
      secondaryHref: "/pricing"
    }),
    tutorial_video_1: section("video_feature", {
      anchor: "how-it-works",
      eyebrow: "How it works",
      title: "Watch the private photo package workflow.",
      subtitle: "Upload photos you own, choose an AI photo package, review credits, generate the album, and download finished images from your private gallery.",
      imageUrl: "/assets/dreamshoot/generated/homepage-showcase/posters/mydreamshoots-i2v-tutorial-55s.jpg?v=20260805i2vselect3",
      videoUrl: "/assets/dreamshoot/generated/homepage-showcase/videos/mydreamshoots-i2v-tutorial-55s.mp4?v=20260805i2vselect3",
      videoBadge: "Private gallery workflow",
      playLabel: "Watch the private photo package workflow"
    }),
    tutorial_image_video_1: section("video_feature", {
      anchor: "ai-image-tutorial",
      eyebrow: "AI image tutorial",
      title: "Create an AI photo set from source photos.",
      subtitle: "Choose a package, upload a clear source photo, review credits, start generation, and open the finished private image.",
      imageUrl: "/assets/dreamshoot/generated/homepage-showcase/posters/mydreamshoots-ai-image-tutorial-55s.jpg?v=20260806chooserfix1",
      videoUrl: "/assets/dreamshoot/generated/homepage-showcase/videos/mydreamshoots-ai-image-tutorial-55s.mp4?v=20260806chooserfix1",
      videoBadge: "AI photo generation",
      playLabel: "Watch the AI image tutorial"
    }),
    mobile_video_1: section("mobile_video_showcase", {
      anchor: "mobile-video-tutorial",
      eyebrow: "Mobile tutorial",
      title: "Mobile workflow preview.",
      subtitle: "Compare image setup and motion-preview steps in a vertical phone view.",
      imageUrl: "/assets/dreamshoot/generated/20260622-homepage-unique/flow-private-album-workspace.png",
      imageAlt: "Private album workspace preview",
      videoUrl: "/assets/dreamshoot/generated/homepage-showcase/videos/mydreamshoots-i2v-mobile-tutorial-45s.mp4?v=20260806mobile45a",
      videoPoster: "/assets/dreamshoot/generated/homepage-showcase/posters/mydreamshoots-i2v-mobile-tutorial-45s.jpg?v=20260806mobile45a",
      videoBadge: "Mobile workflow",
      playLabel: "Watch the video tutorial",
      leftTitle: "AI image tutorial",
      leftVideoUrl: "/assets/dreamshoot/generated/homepage-showcase/videos/mydreamshoots-ai-image-mobile-tutorial-55s.mp4?v=20260806chooserfix1",
      leftVideoPoster: "/assets/dreamshoot/generated/homepage-showcase/posters/mydreamshoots-ai-image-mobile-tutorial-55s.jpg?v=20260806chooserfix1",
      leftPlayLabel: "Watch the image tutorial",
      rightTitle: "AI video tutorial",
      rightVideoUrl: "/assets/dreamshoot/generated/homepage-showcase/videos/mydreamshoots-i2v-mobile-tutorial-55s.mp4?v=20260806mobile55a",
      rightVideoPoster: "/assets/dreamshoot/generated/homepage-showcase/posters/mydreamshoots-i2v-mobile-tutorial-55s.jpg?v=20260806mobile55a",
      rightPlayLabel: "Watch the video tutorial",
      placeholderTitle: "Mobile tutorial coming soon",
      placeholderBody: "The vertical mobile walkthrough will appear here when the final video is ready."
    }),
    workflow_1: section("studio_steps", {
      anchor: "workflow",
      eyebrow: "Photo set workflow",
      title: "Upload, choose, review, generate.",
      subtitle: "Each step is designed so customers understand what happens before credits are reserved and where finished results appear."
    }, [
      { id: "workflow_upload", type: "card", settings: { title: "Upload clear photos", text: "Add source photos you own or have permission to use inside the signed-in customer account.", meta: "01" } },
      { id: "workflow_choose", type: "card", settings: { title: "Choose a package", text: "Pick the outcome you want, such as headshots, creator portraits, fan photos, or themed albums.", meta: "02" } },
      { id: "workflow_credits", type: "card", settings: { title: "Review credits", text: "The request shows the credit cost before generation starts so the account history stays understandable.", meta: "03" } },
      { id: "workflow_gallery", type: "card", settings: { title: "Download favorites", text: "Finished images return to the private gallery for review, download, and future account access.", meta: "04" } }
    ]),
    rules_1: section("rich_text", {
      eyebrow: "Before you generate",
      title: "Source photos, credits, and albums stay tied to one account.",
      body: "The workflow is built around private uploads, visible credit use, secure checkout, account-scoped jobs, and downloadable galleries. Customers should upload only photos they own or have permission to use.",
      imageUrl: "/assets/dreamshoot/frames/faq-intro-portrait.png",
      primaryCta: "Start creating",
      primaryHref: "/login",
      secondaryCta: "Read FAQ",
      secondaryHref: "/faq"
    }, [
      { id: "workflow_rule_private", type: "rich_text_card", settings: { meta: "Private", title: "Account-scoped uploads", description: "Source photos and generated outputs stay connected to the signed-in customer account." } },
      { id: "workflow_rule_credit", type: "rich_text_card", settings: { meta: "Credits", title: "Visible credit cost", description: "Customers see the credit cost before each package request begins." } },
      { id: "workflow_rule_delivery", type: "rich_text_card", settings: { meta: "Gallery", title: "Private delivery", description: "Finished results appear in the customer gallery instead of a public showcase." } }
    ]),
    faq_1: section("faq", {
      title: "Workflow questions"
    }, [
      { id: "workflow_faq_uploads", type: "faq_item", settings: { question: "What photos should customers upload?", answer: "Use clear recent photos where the face or subject is visible. Customers should only upload photos they own or have permission to use." } },
      { id: "workflow_faq_credits", type: "faq_item", settings: { question: "When are credits used?", answer: "Credits are shown before generation starts, then reserved or settled through the account credit history based on the job result." } },
      { id: "workflow_faq_delivery", type: "faq_item", settings: { question: "Where do finished images appear?", answer: "Finished images appear in the signed-in customer's private gallery for review and download." } }
    ]),
    conversion_1: section("conversion_panel", {
      eyebrow: "Start the workflow",
      title: "Choose a photo package and create a private set.",
      subtitle: "Open the Headshot Generator, compare credit costs, then sign in to upload photos and start the generation request.",
      primaryCta: "Headshot Generator",
      primaryHref: "/collections/headshots",
      secondaryCta: "View pricing",
      secondaryHref: "/pricing"
    }),
    footer_1: section("footer", {
      title: "How it works",
      body: "The workflow route is a standalone page for source photos, credits, generation, and private gallery delivery."
    })
  },
  seo: {
    title: "How AI photo generation works",
    description: "Learn how customers upload source photos, choose AI photo packages, review credits, generate private results, and download finished galleries.",
    keywords: "AI photo workflow, private AI photo generation, source photo upload, AI photo credits",
    canonicalPath: "/workflow",
    robots: { index: true, follow: true }
  }
};

const mydreamshootsTermsPolicyBody =
  "<h3>1. Agreement to these terms</h3><p>These Terms of Service apply when you visit www.mydreamshoots.com, create a MyDreamShoots account, upload photos, buy credits or subscriptions, use AI photo tools, start generation jobs, download outputs, or access private albums.</p><h3>2. Accounts, credits, and checkout</h3><p>You are responsible for accurate account information and secure sign-in. Credits are added after payment confirmation, displayed before generation, reserved when a request begins, used after successful delivery, and released or reviewed when a request fails.</p><h3>3. Upload rights and consent</h3><p>You may upload only photos, reference images, prompts, or other materials that you own or have permission to use. Do not upload minors, non-consenting people, public figures, protected marks, stolen images, or materials that violate law, platform rules, or third-party rights.</p><h3>4. No AI training on your photos</h3><p>Your inputs are never used to train models. 30-day auto-delete applies to input photos after generation. Private uploads and account records are protected with AES-256 at rest and TLS 256-bit in transit. Some billing, security, tax, dispute, refund, and account-integrity records may be retained where required or reasonably necessary.</p><h3>5. AI output variability</h3><p>AI photo results can vary based on source photo quality, pose, lighting, package settings, moderation review, provider availability, and model behavior. MyDreamShoots may reject, rerun, delay, moderate, or remove jobs that violate rules or cannot be completed reliably.</p><h3>6. Private albums and use of outputs</h3><p>Generated images and albums are designed for private customer access unless you choose to share, publish, or download them. You are responsible for reviewing outputs before using them in advertising, profiles, documents, merchandise, social media, or other public settings.</p><h3>7. Refunds and guarantee review</h3><p>Refunds and credit adjustments follow the Refund Policy, including the 100% money-back guarantee when the shoot does not look like you, subject to support review, account history, and the details of the affected request.</p><h3>8. Contact</h3><p>Email <a href=\"mailto:support@mydreamshoots.com\">support@mydreamshoots.com</a> for account, billing, refund, policy, or legal questions.</p>";

const termsJson: ThemePageJson = {
  pageType: "policy",
  version: 1,
  seo: getMydreamshootsPolicySeo("/terms"),
  sectionsOrder: ["header_1", "policy_1", "footer_1"],
  sections: {
    header_1: section("rich_text", {
      eyebrow: "Terms of service",
      title: "Terms for using MyDreamShoots photo packages, credits, and albums.",
      body: "These terms apply when you use www.mydreamshoots.com, create an account, buy credits, start AI photo jobs, or access private generated albums."
    }),
    policy_1: section("policy_content", {
      title: "Terms of service",
      lastUpdated: "June 25, 2026",
      contactEmail: "support@mydreamshoots.com",
      body: "<h3>1. Agreement to these terms</h3><p>These Terms of Service apply when you visit www.mydreamshoots.com, create a MyDreamShoots account, upload photos, buy credits or subscriptions, use AI photo tools, start generation jobs, download outputs, or access private albums. By using the service, you agree to these terms and to the related Privacy Policy, Cookie Policy, Refund Policy, and Content Policy.</p><h3>2. Accounts and eligibility</h3><p>You are responsible for the accuracy of your account information and for keeping your login method secure. Account access, credits, jobs, generated images, and private albums are intended for the customer account that created or purchased them. You may not share access in a way that bypasses plan limits or harms other users.</p><h3>3. Credits, subscriptions, and billing</h3><p>MyDreamShoots may offer subscriptions, one-time credit packs, promotional credits, or package-specific credit costs. Credits are added after payment confirmation, reserved when a generation job starts, settled when a job succeeds, and released or reviewed when a job fails or expires. Prices, credit amounts, package availability, and plan features may change over time, but checkout pages should show the current offer before purchase.</p><h3>4. Upload rights and customer content</h3><p>You may upload only photos, reference images, logos, prompts, or other materials that you own or have permission to use. You must not upload content that violates privacy, publicity, intellectual property, contractual rights, platform rules, or applicable law. You remain responsible for the materials you submit and the way you use generated outputs.</p><h3>5. AI generation and output variability</h3><p>AI photo results vary based on source image quality, pose, lighting, package settings, provider availability, moderation checks, and model behavior. MyDreamShoots does not guarantee that every output will match a specific expectation, identity detail, style reference, or commercial requirement. We may reject, rerun, delay, moderate, or remove jobs that violate rules or cannot be completed reliably.</p><h3>6. Private albums and downloads</h3><p>Generated images and albums are designed for private customer access unless you choose to share, publish, or download them. You are responsible for reviewing outputs before using them in advertising, profiles, documents, merchandise, social media, or other public settings.</p><h3>7. Acceptable use</h3><p>You may not use MyDreamShoots to impersonate someone without permission, create unlawful or harmful content, exploit minors, harass others, violate intellectual property, upload stolen images, attack or scrape the service, bypass access controls, resell unauthorized access, interfere with other accounts, or overload generation capacity.</p><h3>8. Refunds, failed jobs, and support review</h3><p>Refunds and credit adjustments are handled under the Refund Policy. Successfully delivered generation jobs are generally not refundable unless MyDreamShoots confirms a service-side technical failure. Failed or timed-out jobs may result in credit release, rerun, or manual support review depending on the issue.</p><h3>9. Service changes and availability</h3><p>We may update packages, tools, providers, pricing, credit costs, policy pages, UI flows, and feature availability. We may also suspend access to protect customers, investigate abuse, perform maintenance, comply with law, or respond to provider outages.</p><h3>10. Intellectual property</h3><p>The MyDreamShoots website, brand, software, templates, interface, package structure, and documentation belong to MyDreamShoots or its licensors. Customer uploads remain subject to the rights of the customer or original owner. Your rights in generated outputs may depend on law, provider rules, your uploaded materials, and the way you use the results.</p><h3>11. Disclaimers</h3><p>MyDreamShoots is provided as an AI photo software service. Outputs may contain errors, artifacts, inaccurate details, or unexpected results. You should not rely on generated images as official identity documents, professional credentials, legal evidence, or factual records.</p><h3>12. Limitation of liability</h3><p>To the fullest extent permitted by law, MyDreamShoots is not liable for indirect, incidental, special, consequential, or punitive damages. Our total liability for a claim is limited to the amount you paid for the affected billing period, subscription, or credit purchase.</p><h3>13. Changes to these terms</h3><p>We may update these terms as the service changes. Continued use of MyDreamShoots after changes means you accept the updated terms.</p><h3>14. Contact</h3><p>Email <a href=\"mailto:support@mydreamshoots.com\">support@mydreamshoots.com</a> for account, billing, refund, policy, or legal questions.</p>"
    }),
    footer_1: section("footer", {
      title: "Terms",
      body: "This page is editable through the same theme system."
    }, [
      { id: "terms_footer_privacy", type: "menu_link", settings: { label: "Privacy Policy", href: "/privacy", group: "support" } },
      { id: "terms_footer_cookies", type: "menu_link", settings: { label: "Cookie Policy", href: "/cookies", group: "support" } },
      { id: "terms_footer_refunds", type: "menu_link", settings: { label: "Refunds", href: "/refunds", group: "support" } }
    ])
  }
};

termsJson.sections.policy_1.settings = {
  ...termsJson.sections.policy_1.settings,
  lastUpdated: "August 5, 2026",
  body: mydreamshootsTermsPolicyBody
};

const blogJson: ThemePageJson = {
  pageType: "blog",
  version: 1,
  sectionsOrder: ["header_1", "posts_1", "footer_1"],
  sections: {
    header_1: section("rich_text", {
      eyebrow: "Blog",
      title: "Articles for customer onboarding and store operations.",
      body: "Use this page to publish guide content, launch notes, and product education."
    }),
    posts_1: section("blog_list", {
      title: "Recent articles",
      subtitle: "A first version article grid ready for editorial copy."
    }),
    footer_1: section("footer", {
      title: "Blog",
      body: "Blog content lives inside the site theme, not in a separate CMS."
    })
  }
};

const sharedPages = (siteId: string): ThemePage[] => [
  {
    id: `${siteId}_home`,
    siteId,
    pageType: "home",
    templateKey: "index",
    slug: "/",
    title: "Home",
    draftJson: cloneSeed(homeJson),
    publishedJson: cloneSeed(homeJson)
  },
  {
    id: `${siteId}_pricing`,
    siteId,
    pageType: "pricing",
    templateKey: "page",
    slug: "/pricing",
    title: "Pricing",
    draftJson: cloneSeed(pricingJson),
    publishedJson: cloneSeed(pricingJson)
  },
  {
    id: `${siteId}_tool_image`,
    siteId,
    pageType: "ai_tool",
    templateKey: "product",
    slug: "/tools/headshot",
    title: "Headshot Generator",
    draftJson: cloneSeed(toolJson),
    publishedJson: cloneSeed(toolJson)
  },
  {
    id: `${siteId}_privacy`,
    siteId,
    pageType: "policy",
    templateKey: "privacy",
    slug: "/privacy",
    title: "Privacy policy",
    draftJson: cloneSeed(privacyJson),
    publishedJson: cloneSeed(privacyJson)
  },
  {
    id: `${siteId}_terms`,
    siteId,
    pageType: "policy",
    templateKey: "terms",
    slug: "/terms",
    title: "Terms of service",
    draftJson: cloneSeed(termsJson),
    publishedJson: cloneSeed(termsJson)
  },
  {
    id: `${siteId}_cookies`,
    siteId,
    pageType: "policy",
    templateKey: "cookies",
    slug: "/cookies",
    title: "Cookie policy",
    draftJson: cloneSeed(cookiePolicyJson),
    publishedJson: cloneSeed(cookiePolicyJson)
  },
  {
    id: `${siteId}_refunds`,
    siteId,
    pageType: "policy",
    templateKey: "refunds",
    slug: "/refunds",
    title: "Refunds policy",
    draftJson: cloneSeed(refundsJson),
    publishedJson: cloneSeed(refundsJson)
  },
  {
    id: `${siteId}_content`,
    siteId,
    pageType: "policy",
    templateKey: "content",
    slug: "/content",
    title: "Content policy",
    draftJson: cloneSeed(contentPolicyJson),
    publishedJson: cloneSeed(contentPolicyJson)
  },
  {
    id: `${siteId}_help`,
    siteId,
    pageType: "help",
    templateKey: "help",
    slug: "/help",
    title: "Help center",
    draftJson: cloneSeed(helpJson),
    publishedJson: cloneSeed(helpJson)
  },
  {
    id: `${siteId}_workflow`,
    siteId,
    pageType: "content",
    templateKey: "workflow",
    slug: "/workflow",
    title: "How it works",
    draftJson: cloneSeed(workflowJson),
    publishedJson: cloneSeed(workflowJson)
  },
  {
    id: `${siteId}_blog`,
    siteId,
    pageType: "blog",
    templateKey: "blog",
    slug: "/blog",
    title: "Blog",
    draftJson: cloneSeed(blogJson),
    publishedJson: cloneSeed(blogJson)
  },
  {
    id: `${siteId}_collection`,
    siteId,
    pageType: "collection",
    templateKey: "collection",
    slug: "/collections",
    title: "Collection",
    draftJson: cloneSeed(collectionJson),
    publishedJson: cloneSeed(collectionJson)
  },
  {
    id: `${siteId}_search`,
    siteId,
    pageType: "search",
    templateKey: "search",
    slug: "/search",
    title: "Search",
    draftJson: cloneSeed(searchJson),
    publishedJson: cloneSeed(searchJson)
  },
  {
    id: `${siteId}_cart`,
    siteId,
    pageType: "cart",
    templateKey: "cart",
    slug: "/cart",
    title: "Cart",
    draftJson: cloneSeed(cartJson),
    publishedJson: cloneSeed(cartJson)
  },
  {
    id: `${siteId}_login`,
    siteId,
    pageType: "login",
    templateKey: "login",
    slug: "/login",
    title: "Login",
    draftJson: cloneSeed(loginJson),
    publishedJson: cloneSeed(loginJson)
  },
  {
    id: `${siteId}_app`,
    siteId,
    pageType: "workspace",
    templateKey: "app-home",
    slug: "/app",
    title: "Customer workspace",
    draftJson: cloneSeed(workspaceJson),
    publishedJson: cloneSeed(workspaceJson)
  },
  {
    id: `${siteId}_job_progress`,
    siteId,
    pageType: "job_progress",
    templateKey: "job-progress",
    slug: "/app/jobs/progress",
    title: "Job progress",
    draftJson: cloneSeed(jobProgressJson),
    publishedJson: cloneSeed(jobProgressJson)
  },
  {
    id: `${siteId}_album`,
    siteId,
    pageType: "album",
    templateKey: "album",
    slug: "/album",
    title: "Album",
    draftJson: cloneSeed(albumJson),
    publishedJson: cloneSeed(albumJson)
  },
  {
    id: `${siteId}_account`,
    siteId,
    pageType: "account",
    templateKey: "account-billing",
    slug: "/account",
    title: "Account and billing",
    draftJson: cloneSeed(accountJson),
    publishedJson: cloneSeed(accountJson)
  },
  {
    id: `${siteId}_404`,
    siteId,
    pageType: "404",
    templateKey: "404",
    slug: "/404",
    title: "404",
    draftJson: cloneSeed(notFoundJson),
    publishedJson: cloneSeed(notFoundJson)
  }
];

type WeddingTemplateKey = ThemePackageTemplateKey | "creators-circle" | "partner-registration" | "about-us" | "contact-us";
type WeddingDreamshootTemplateKey = Extract<WeddingTemplateKey, "creators-circle" | "partner-registration" | "about-us" | "contact-us">;

type WeddingPageMapping = {
  idSuffix: string;
  packageTemplate: WeddingTemplateKey;
  templateKey: string;
  slug: string;
  title: string;
  pageType: string;
};

const weddingPageMappings: WeddingPageMapping[] = [
  { idSuffix: "home", packageTemplate: "home", templateKey: "index", slug: "/", title: "Home", pageType: "home" },
  { idSuffix: "pricing", packageTemplate: "pricing", templateKey: "page", slug: "/pricing", title: "Pricing", pageType: "pricing" },
  { idSuffix: "collections", packageTemplate: "packages", templateKey: "collection", slug: "/collections", title: "Wedding collections", pageType: "collection" },
  { idSuffix: "collection_signature", packageTemplate: "package-detail", templateKey: "package-detail", slug: "/collections/signature-ceremony", title: "Signature ceremony collection", pageType: "package_detail" },
  { idSuffix: "tool_image", packageTemplate: "tool-detail", templateKey: "product", slug: "/tools/wedding-portraits", title: "Wedding generator", pageType: "ai_tool" },
  { idSuffix: "login", packageTemplate: "login", templateKey: "login", slug: "/login", title: "Customer login", pageType: "login" },
  { idSuffix: "app", packageTemplate: "app-home", templateKey: "app-home", slug: "/app", title: "Wedding workspace", pageType: "workspace" },
  { idSuffix: "job_progress", packageTemplate: "job-progress", templateKey: "job-progress", slug: "/app/jobs/progress", title: "Job progress", pageType: "job_progress" },
  { idSuffix: "job_detail", packageTemplate: "job-detail", templateKey: "job-detail", slug: "/app/jobs/detail", title: "Job detail", pageType: "job_detail" },
  { idSuffix: "album", packageTemplate: "album", templateKey: "album", slug: "/album", title: "Private album", pageType: "album" },
  { idSuffix: "account", packageTemplate: "account-billing", templateKey: "account-billing", slug: "/account", title: "Account and billing", pageType: "account" },
  { idSuffix: "privacy", packageTemplate: "policy", templateKey: "privacy", slug: "/policies/privacy", title: "Privacy policy", pageType: "policy" },
  { idSuffix: "privacy_policy", packageTemplate: "policy", templateKey: "privacy", slug: "/privacy-policy", title: "Privacy policy", pageType: "policy" },
  { idSuffix: "refunds", packageTemplate: "policy", templateKey: "refunds", slug: "/policies/refunds", title: "Refunds policy", pageType: "policy" },
  { idSuffix: "terms", packageTemplate: "policy", templateKey: "terms", slug: "/policies/terms", title: "Terms of Service", pageType: "policy" },
  { idSuffix: "terms_service", packageTemplate: "policy", templateKey: "terms", slug: "/terms-of-service", title: "Terms of Service", pageType: "policy" },
  { idSuffix: "cookie_policy", packageTemplate: "policy", templateKey: "cookies", slug: "/cookie-policy", title: "Cookie policy", pageType: "policy" },
  { idSuffix: "cookies", packageTemplate: "policy", templateKey: "cookies", slug: "/policies/cookies", title: "Cookie policy", pageType: "policy" },
  { idSuffix: "content", packageTemplate: "policy", templateKey: "content", slug: "/policies/content", title: "Content policy", pageType: "policy" },
  { idSuffix: "help", packageTemplate: "help", templateKey: "help", slug: "/help", title: "Help center", pageType: "help" },
  { idSuffix: "blog", packageTemplate: "blog-list", templateKey: "blog", slug: "/blog", title: "Wedding journal", pageType: "blog" },
  { idSuffix: "blog_detail", packageTemplate: "blog-detail", templateKey: "blog-detail", slug: "/blog/preparing-source-photos", title: "Preparing source photos", pageType: "article" },
  { idSuffix: "creators_circle", packageTemplate: "creators-circle", templateKey: "creators-circle", slug: "/creators-circle", title: "Creators Circle", pageType: "content" },
  { idSuffix: "partner_registration", packageTemplate: "partner-registration", templateKey: "partner-registration", slug: "/partner-registration", title: "Partner Registration", pageType: "content" },
  { idSuffix: "about_us", packageTemplate: "about-us", templateKey: "about-us", slug: "/about-us", title: "About Us", pageType: "content" },
  { idSuffix: "contact_us", packageTemplate: "contact-us", templateKey: "contact-us", slug: "/contact-us", title: "Contact Us", pageType: "content" },
  { idSuffix: "search", packageTemplate: "search", templateKey: "search", slug: "/search", title: "Search", pageType: "search" },
  { idSuffix: "cart", packageTemplate: "cart", templateKey: "cart", slug: "/cart", title: "Cart", pageType: "cart" },
  { idSuffix: "404", packageTemplate: "404", templateKey: "404", slug: "/404", title: "404", pageType: "404" }
];

function isWeddingDreamshootTemplateKey(packageTemplate: WeddingTemplateKey): packageTemplate is WeddingDreamshootTemplateKey {
  return packageTemplate === "creators-circle" || packageTemplate === "partner-registration" || packageTemplate === "about-us" || packageTemplate === "contact-us";
}

function weddingPageJson(packageTemplate: ThemePackageTemplateKey, pageType: string, templateKey: string): ThemePageJson {
  const pageJson = cloneSeed(weddingStoryHouseTemplates[packageTemplate]);
  pageJson.pageType = pageType;

  if (templateKey === "privacy" && pageJson.sections.policy_1) {
    return cloneSeed(privacyJson);
  }

  if (templateKey === "terms") {
    return cloneSeed(termsJson);
  }

  if (templateKey === "cookies") {
    return cloneSeed(cookiePolicyJson);
  }

  if (templateKey === "refunds" && pageJson.sections.policy_1) {
    pageJson.sections.policy_1.settings = {
      ...pageJson.sections.policy_1.settings,
      title: "Refunds policy",
      body: "<p>Refunds and billing reversals appear in the customer's credit history. Checkout completion never grants credits before the payment is confirmed.</p>"
    };
  }

  if (templateKey === "content" && pageJson.sections.policy_1) {
    pageJson.sections.policy_1.settings = {
      ...pageJson.sections.policy_1.settings,
      title: "Content policy",
      body: "<p>Customers may upload only wedding, couple, venue, wardrobe, and inspiration assets they have permission to use. Private album delivery remains restricted to the signed-in customer.</p>"
    };
  }

  if (templateKey === "search") {
    pageJson.pageType = "search";
  }

  if (templateKey === "cart") {
    pageJson.pageType = "cart";
  }

  if (templateKey === "404") {
    pageJson.pageType = "404";
    if (pageJson.sections.article_1) {
      pageJson.sections.article_1.settings = {
        ...pageJson.sections.article_1.settings,
        eyebrow: "404",
        title: "This wedding story page is not available.",
        body: "Send customers back to collections, pricing, login, or the private album workspace."
      };
    }
  }

  return pageJson;
}

const _weddingPages = (siteId: string): ThemePage[] =>
  weddingPageMappings.map((mapping) => {
    const pageJson =
      isWeddingDreamshootTemplateKey(mapping.packageTemplate)
        ? cloneSeed(dreamshootAiStudioTemplates[mapping.packageTemplate])
        : weddingPageJson(mapping.packageTemplate, mapping.pageType, mapping.templateKey);
    return {
      id: `${siteId}_${mapping.idSuffix}`,
      siteId,
      pageType: mapping.pageType,
      templateKey: mapping.templateKey,
      slug: mapping.slug,
      title: mapping.title,
      draftJson: cloneSeed(pageJson),
      publishedJson: cloneSeed(pageJson)
    };
  });

const weddingSeedSite: Site = {
  id: "site_lumen",
  name: dreamshootAiStudioSiteSettings.branding?.logoText ?? "MyDreamShoots",
  slug: "lumen",
  status: "active",
  primaryDomain: "lumen.localhost",
  currency: "usd",
  timezone: "America/Chicago",
  signupCreditGrant: 0,
  branding: {
    logoText: dreamshootAiStudioSiteSettings.branding?.logoText ?? "MyDreamShoots",
    market: dreamshootAiStudioSiteSettings.branding?.market ?? "AI photo packages, personal AI models, paid tools, credits, AI video, and private albums",
    description: weddingSiteDescription
  },
  connect: {
    stripeAccountId: "acct_lumen_42x",
    status: "enabled",
    chargesEnabled: true,
    payoutsEnabled: true
  },
  themeSettings: {
    draftJson: buildWeddingThemeSettings(),
    publishedJson: buildWeddingThemeSettings()
  },
  pages: sharedPages("site_lumen")
};

const atlasSeedSite: Site = {
  id: "site_atlas",
  name: "Atlas Copy Foundry",
  slug: "atlas",
  status: "draft",
  primaryDomain: "atlas.localhost",
  currency: "usd",
  timezone: "Europe/London",
  signupCreditGrant: 0,
  branding: {
    logoText: "Atlas",
    market: "AI copy systems for boutique stores",
    description: "A second site proving customer and billing isolation across stores."
  },
  connect: {
    stripeAccountId: "acct_pending_atlas",
    status: "pending",
    chargesEnabled: false,
    payoutsEnabled: false
  },
  themeSettings: {
    draftJson: buildThemeSettings({
      siteName: "Atlas Copy Foundry",
      logoText: "Atlas",
      description: "A second site proving customer and billing isolation across stores.",
      colors: {
        background: "#f4f7f1",
        foreground: "#1d241d",
        accent: "#4f6f52",
        muted: "#dfe8d9"
      },
      typography: {
        display: "Geist",
        body: "Geist"
      }
    }),
    publishedJson: buildThemeSettings({
      siteName: "Atlas Copy Foundry",
      logoText: "Atlas",
      description: "A second site proving customer and billing isolation across stores.",
      colors: {
        background: "#f4f7f1",
        foreground: "#1d241d",
        accent: "#4f6f52",
        muted: "#dfe8d9"
      },
      typography: {
        display: "Geist",
        body: "Geist"
      }
    })
  },
  pages: sharedPages("site_atlas")
};

function siteThemeSeed(params: {
  id: string;
  siteId: string;
  record: ReturnType<typeof buildSaasThemeDraft>;
  source: SiteTheme["source"];
  createdBy: string;
  createdAt: string;
}): SiteTheme {
  return {
    id: params.id,
    siteId: params.siteId,
    name: params.record.name,
    themeId: params.record.themeId,
    themeKey: params.record.themeKey,
    status: params.record.status,
    templates: cloneSeed(params.record.templates),
    settings: cloneSeed(params.record.settings),
    source: params.source,
    createdBy: params.createdBy,
    createdAt: params.createdAt,
    updatedAt: params.createdAt
  };
}

const weddingSeedDraftTheme = buildSaasThemeDraft(weddingSeedSite, "wedding-story-house");
const weddingSeedPublishedTheme = buildSaasThemePublication(weddingSeedSite, 1, "wedding-story-house");

export { sectionDefinitions };

const demoHashes = {
  platform: "sha256:cd23f89259b4144eaf6bed74fee6bee9f5b5bb94c87667d391323b3a8efe4fea",
  lumenAdmin: "sha256:6ae61d617fe66d7469d670f89c769c85e5a06a49b208bceac45cdf9594add4f4",
  atlasAdmin: "sha256:c55c523cd7beebd238b6ea09888a3090961e048bec6de3a24e2aa37432103f59",
  maraCustomer: "sha256:0fc624568b4455da6bcf60c9b2b3f534692f3159b077732c21c9a7c4523598bc"
};

const platformAdmins: PlatformAdmin[] = [
  {
    id: "platform_admin_root",
    email: "platform@local.test",
    passwordHash: demoHashes.platform,
    displayName: "Platform Root",
    role: "super_admin",
    createdAt: "2026-05-28T00:00:00.000Z"
  }
];

export const platformState: PlatformState = {
  platformAdmins,
  platformSessions: [],
  sites: [weddingSeedSite, atlasSeedSite],
  siteDomains: [
    {
      id: "dom_lumen_primary",
      siteId: "site_lumen",
      domain: "lumen.localhost",
      isPrimary: true,
      status: "active",
      createdAt: "2026-05-28T00:00:00.000Z"
    },
    {
      id: "dom_atlas_primary",
      siteId: "site_atlas",
      domain: "atlas.localhost",
      isPrimary: true,
      status: "pending",
      createdAt: "2026-05-28T00:00:00.000Z"
    }
  ],
  siteAdmins: [
    {
      id: "admin_lumen_owner",
      siteId: "site_lumen",
      email: "owner@lumen.localhost",
      passwordHash: demoHashes.lumenAdmin,
      displayName: "AI Wedding Owner",
      role: "owner",
      createdAt: "2026-05-28T00:00:00.000Z"
    },
    {
      id: "admin_atlas_owner",
      siteId: "site_atlas",
      email: "owner@atlas.localhost",
      passwordHash: demoHashes.atlasAdmin,
      displayName: "Atlas Owner",
      role: "owner",
      createdAt: "2026-05-28T00:00:00.000Z"
    }
  ],
  siteAdminSessions: [],
  customers: [
    {
      id: "cust_lumen_mara",
      siteId: "site_lumen",
      email: "mara@northpier.studio",
      passwordHash: demoHashes.maraCustomer,
      name: "Mara Voss",
      status: "active",
      balance: { available: 276, reserved: 24 }
    },
    {
      id: "cust_atlas_mara",
      siteId: "site_atlas",
      email: "mara@northpier.studio",
      passwordHash: demoHashes.maraCustomer,
      name: "Mara Voss",
      status: "past_due",
      balance: { available: 28, reserved: 0 }
    },
    {
      id: "cust_lumen_ivo",
      siteId: "site_lumen",
      email: "ivo@cedarbay.co",
      passwordHash: demoHashes.maraCustomer,
      name: "Ivo Renard",
      status: "active",
      balance: { available: 112, reserved: 0 }
    }
  ],
  customerSessions: [],
  products: [
    {
      id: "prod_lumen_essential",
      siteId: "site_lumen",
      name: "Essential",
      type: "subscription",
      status: "active",
      prices: [
        {
          id: "price_lumen_essential",
          siteId: "site_lumen",
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
    },
    {
      id: "prod_lumen_premium",
      siteId: "site_lumen",
      name: "Premium",
      type: "subscription",
      status: "active",
      prices: [
        {
          id: "price_lumen_premium",
          siteId: "site_lumen",
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
    },
    {
      id: "prod_lumen_deluxe",
      siteId: "site_lumen",
      name: "Deluxe",
      type: "subscription",
      status: "active",
      prices: [
        {
          id: "price_lumen_deluxe",
          siteId: "site_lumen",
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
    },
    {
      id: "prod_lumen_pack",
      siteId: "site_lumen",
      name: "Wedding Album Credit Pack",
      type: "credit_pack",
      status: "active",
      prices: [
        {
          id: "price_lumen_pack",
          siteId: "site_lumen",
          productId: "prod_lumen_pack",
          label: "120 album credits",
          amountCents: 2400,
          currency: "usd",
          interval: "one_time",
          creditsGranted: 120,
          stripePriceId: "price_lumen_pack_120"
        }
      ]
    },
    {
      id: "prod_atlas_launch",
      siteId: "site_atlas",
      name: "Launch Monthly",
      type: "subscription",
      status: "draft",
      prices: [
        {
          id: "price_atlas_launch",
          siteId: "site_atlas",
          productId: "prod_atlas_launch",
          label: "Launch",
          amountCents: 1900,
          currency: "usd",
          interval: "month",
          creditsGranted: 140,
          stripePriceId: "price_atlas_140"
        }
      ]
    }
  ],
  subscriptions: [
    {
      id: "sub_lumen_mara",
      siteId: "site_lumen",
      customerId: "cust_lumen_mara",
      productId: "prod_lumen_premium",
      priceId: "price_lumen_premium",
      stripeSubscriptionId: "sub_demo_lumen_mara_premium_120",
      status: "active",
      currentPeriodEnd: "2026-06-01T00:00:00.000Z",
      creditsPerCycle: 120,
      createdAt: "2026-05-01T00:00:00.000Z"
    },
    {
      id: "sub_atlas_mara",
      siteId: "site_atlas",
      customerId: "cust_atlas_mara",
      productId: "prod_atlas_launch",
      priceId: "price_atlas_launch",
      stripeSubscriptionId: "sub_demo_atlas_past_due",
      status: "past_due",
      currentPeriodEnd: "2026-05-24T00:00:00.000Z",
      creditsPerCycle: 140,
      createdAt: "2026-04-24T00:00:00.000Z"
    }
  ] satisfies Subscription[],
  orders: [
    {
      id: "order_lumen_pack_118",
      siteId: "site_lumen",
      customerId: "cust_lumen_mara",
      status: "fulfilled",
      amountCents: 2400,
      currency: "usd",
      credits: 120,
      sourceId: "cs_demo_lumen_pack_118",
      createdAt: "2026-05-18T10:12:00.000Z"
    },
    {
      id: "order_lumen_premium_042",
      siteId: "site_lumen",
      customerId: "cust_lumen_ivo",
      status: "paid",
      amountCents: 14900,
      currency: "usd",
      credits: 120,
      sourceId: "cs_demo_lumen_premium_042",
      createdAt: "2026-05-26T16:40:00.000Z"
    },
    {
      id: "order_atlas_211",
      siteId: "site_atlas",
      customerId: "cust_atlas_mara",
      status: "fulfilled",
      amountCents: 900,
      currency: "usd",
      credits: 28,
      sourceId: "cs_demo_atlas_211",
      createdAt: "2026-05-18T10:00:00.000Z"
    }
  ],
  paymentEvents: [],
  aiApps: [
    {
      id: "ai_image",
      slug: "image_generator",
      name: "Image Studio",
      description: "Private image generation with signed album delivery.",
      appType: "image",
      parameterSchema: [
        { id: "style", label: "Style", type: "select", options: ["wedding", "studio", "editorial"] },
        { id: "outputCount", label: "Output count", type: "select", options: ["4", "12", "20"] }
      ]
    },
    {
      id: "ai_copy",
      slug: "copy_generator",
      name: "Copy Foundry",
      description: "Campaign copy and product story generation.",
      appType: "copy",
      parameterSchema: [{ id: "brief", label: "Brief", type: "text" }]
    },
    {
      id: "ai_avatar",
      slug: "avatar_generator",
      name: "Avatar Atelier",
      description: "Profile and team avatar packs for paid customers.",
      appType: "avatar",
      parameterSchema: [{ id: "persona", label: "Persona", type: "text" }]
    }
  ],
  siteAiApps: [
    { id: "sai_lumen_image", siteId: "site_lumen", aiApp: {} as AiApp, enabled: true, creditCost: 108, routeKey: "n8n.image.wedding.v1" },
    { id: "sai_lumen_avatar", siteId: "site_lumen", aiApp: {} as AiApp, enabled: false, creditCost: 8, routeKey: "n8n.avatar.v1" },
    { id: "sai_atlas_copy", siteId: "site_atlas", aiApp: {} as AiApp, enabled: true, creditCost: 3, routeKey: "n8n.copy.v1" }
  ],
  toolCategories: [],
  toolMenuItems: [],
  aiGatewayGroups: [
    {
      id: "gw_lumen_primary",
      siteId: "site_lumen",
      name: "AI Wedding image quota",
      status: "active",
      modelAllowlist: ["gpt-image-2", "gpt-4.1-mini", "claude-3-7-sonnet"],
      monthlyQuota: 12000,
      usedQuota: 1840,
      retryStatusCodes: [429, 500, 502, 503],
      rateLimitPerMinute: 60,
      accountPoolMode: "dedicated"
    },
    {
      id: "gw_atlas_primary",
      siteId: "site_atlas",
      name: "Atlas copy quota",
      status: "paused",
      modelAllowlist: ["gpt-4.1-mini", "claude-3-5-haiku"],
      monthlyQuota: 3000,
      usedQuota: 242,
      retryStatusCodes: [429, 500, 503],
      rateLimitPerMinute: 30,
      accountPoolMode: "shared",
      unavailableReason: "Stripe Connect pending"
    }
  ],
  creativePacks: [
    {
      id: "pack_lumen_exec",
      siteId: "site_lumen",
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
      createdAt: "2026-05-02T10:00:00.000Z",
      imageUrl: "media_lumen_pack_exec"
    },
    {
      id: "pack_lumen_editorial",
      siteId: "site_lumen",
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
      createdAt: "2026-05-08T12:00:00.000Z",
      imageUrl: "media_lumen_editorial_close"
    },
    {
      id: "pack_lumen_wedding",
      siteId: "site_lumen",
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
      createdAt: "2026-05-12T11:00:00.000Z",
      imageUrl: "media_lumen_hero"
    },
    {
      id: "pack_lumen_dating",
      siteId: "site_lumen",
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
      createdAt: "2026-05-20T09:00:00.000Z"
    },
    {
      id: "pack_atlas_launch",
      siteId: "site_atlas",
      name: "Boutique Launch Copy",
      headline: "Launch copy for boutique catalogs",
      description: "A copy pack for boutique catalog launches with the same credit-based checkout flow.",
      category: "copy",
      aiAppSlug: "copy_generator",
      status: "active",
      creditCost: 3,
      outputCount: 6,
      trainingRequired: false,
      generationCount: 91,
      conversionRate: 9.6,
      createdAt: "2026-05-11T09:30:00.000Z"
    }
  ] satisfies CreativePack[],
  mediaAssets: [
    {
      id: "media_lumen_hero",
      siteId: "site_lumen",
      label: "Ceremony hero sample",
      storageKey: "sites/site_lumen/theme/ref-crops/photo-paris.png",
      mimeType: "image/png",
      usage: "theme",
      sourceType: "theme_seed",
      previewUrl: "/assets/site-media/lumen/ref-crops/photo-paris.png?v=20260607a",
      altText: "Paris destination wedding example",
      createdAt: "2026-05-03T12:00:00.000Z"
    },
    {
      id: "media_lumen_pack_exec",
      siteId: "site_lumen",
      label: "Engagement preview cover",
      storageKey: "sites/site_lumen/packs/ref-crops/photo-bali.png",
      mimeType: "image/png",
      usage: "pack_cover",
      sourceType: "theme_seed",
      previewUrl: "/assets/site-media/lumen/ref-crops/photo-bali.png?v=20260607a",
      altText: "Bali wedding collection cover",
      createdAt: "2026-05-04T13:00:00.000Z"
    },
    {
      id: "media_lumen_editorial_hero",
      siteId: "site_lumen",
      label: "Santorini destination wedding hero",
      storageKey: "sites/site_lumen/theme/ref-crops/photo-santorini.png",
      mimeType: "image/png",
      usage: "theme",
      sourceType: "theme_seed",
      previewUrl: "/assets/site-media/lumen/ref-crops/photo-santorini.png?v=20260607a",
      altText: "Luxury Santorini destination wedding hero",
      createdAt: "2026-05-04T15:00:00.000Z"
    },
    {
      id: "media_lumen_editorial_close",
      siteId: "site_lumen",
      label: "Bridal close crop",
      storageKey: "sites/site_lumen/theme/ref-crops/photo-marrakech.png",
      mimeType: "image/png",
      usage: "theme",
      sourceType: "theme_seed",
      previewUrl: "/assets/site-media/lumen/ref-crops/photo-marrakech.png?v=20260607a",
      altText: "Marrakech bridal editorial example",
      createdAt: "2026-05-04T16:00:00.000Z"
    },
    {
      id: "media_lumen_story_square",
      siteId: "site_lumen",
      label: "Wedding story square one",
      storageKey: "sites/site_lumen/theme/ref-crops/photo-cappadocia.png",
      mimeType: "image/png",
      usage: "theme",
      sourceType: "theme_seed",
      previewUrl: "/assets/site-media/lumen/ref-crops/photo-cappadocia.png?v=20260607a",
      altText: "Cappadocia destination wedding example",
      createdAt: "2026-05-04T16:10:00.000Z"
    },
    {
      id: "media_lumen_story_square_two",
      siteId: "site_lumen",
      label: "Reception story square",
      storageKey: "sites/site_lumen/theme/ref-crops/photo-bali.png",
      mimeType: "image/png",
      usage: "theme",
      sourceType: "theme_seed",
      previewUrl: "/assets/site-media/lumen/ref-crops/photo-bali.png?v=20260607a",
      altText: "Bali tropical destination wedding example",
      createdAt: "2026-05-04T13:00:00.000Z"
    },
    {
      id: "media_atlas_policy",
      siteId: "site_atlas",
      label: "Policy header",
      storageKey: "sites/site_atlas/theme/policy-header.webp",
      mimeType: "image/webp",
      usage: "policy",
      sourceType: "theme_seed",
      previewUrl: "/assets/dreamshoot/generated/20260619/world-cup-fan-star-clean-v1.png",
      altText: "Policy page header image",
      createdAt: "2026-05-13T15:00:00.000Z"
    }
  ] satisfies MediaAsset[],
  siteThemes: [
    siteThemeSeed({
      id: "theme_site_lumen_draft",
      siteId: "site_lumen",
      record: {
        ...weddingSeedDraftTheme,
        name: `${weddingSiteName} Draft`,
        status: "draft"
      },
      source: "imported",
      createdBy: "admin_lumen_owner",
      createdAt: "2026-06-06T00:00:00.000Z"
    }),
    siteThemeSeed({
      id: "theme_site_lumen_active",
      siteId: "site_lumen",
      record: {
        ...weddingSeedPublishedTheme.theme,
        name: `${weddingSiteName} Live`,
        status: "active"
      },
      source: "imported",
      createdBy: "admin_lumen_owner",
      createdAt: "2026-06-06T00:00:00.000Z"
    })
  ] satisfies SiteTheme[],
  themeCopies: [],
  themePublications: [
    {
      id: "pub_site_lumen_v1",
      siteId: "site_lumen",
      version: 1,
      snapshot: {
        pages: weddingSeedSite.pages.map((page) => ({
          id: page.id,
          slug: page.slug,
          publishedJson: cloneSeed(page.publishedJson)
        })),
        themeSettings: cloneSeed(weddingSeedSite.themeSettings.publishedJson),
        saasTheme: cloneSeed(weddingSeedPublishedTheme.theme)
      },
      publishedBy: "admin_lumen_owner",
      publishedAt: "2026-06-06T00:00:00.000Z"
    }
  ] satisfies ThemePublication[],
  auditLogs: [
    {
      id: "audit_lumen_theme_publish",
      siteId: "site_lumen",
      actorType: "site_admin",
      actorId: "admin_lumen_owner",
      action: "theme_published",
      targetType: "theme",
      targetId: "site_lumen",
      createdAt: "2026-05-03T09:20:00.000Z",
      metadata: { version: 1 }
    },
    {
      id: "audit_lumen_credit_adjust",
      siteId: "site_lumen",
      actorType: "site_admin",
      actorId: "admin_lumen_owner",
      action: "credits_adjusted",
      targetType: "customer",
      targetId: "cust_lumen_ivo",
      createdAt: "2026-05-27T18:30:00.000Z",
      metadata: { amount: 12 }
    },
    {
      id: "audit_platform_site_create",
      actorType: "platform_admin",
      actorId: "platform_admin_root",
      action: "site_created",
      targetType: "site",
      targetId: "site_atlas",
      createdAt: "2026-05-01T08:00:00.000Z",
      metadata: { template: weddingSiteName }
    }
  ] satisfies AuditLogEntry[],
  customerModels: [
    {
      id: "model_lumen_mara_couple",
      siteId: "site_lumen",
      customerId: "cust_lumen_mara",
      label: "Mara and Ellis couple model",
      modelType: "couple",
      status: "training",
      inputAssetCount: 18,
      minInputAssets: 12,
      trainingJobId: "job_lumen_4817",
      createdAt: "2026-05-28T08:00:00.000Z",
      updatedAt: "2026-05-28T08:21:12.000Z"
    },
    {
      id: "model_lumen_ivo_headshot",
      siteId: "site_lumen",
      customerId: "cust_lumen_ivo",
      label: "Ivo and Rowan ceremony model",
      modelType: "couple",
      status: "ready",
      inputAssetCount: 14,
      minInputAssets: 12,
      providerModelId: "prov_lumen_ivo_rowan_ceremony_01",
      createdAt: "2026-05-27T17:30:00.000Z",
      updatedAt: "2026-05-27T18:05:00.000Z"
    },
    {
      id: "model_atlas_mara_copy",
      siteId: "site_atlas",
      customerId: "cust_atlas_mara",
      label: "Mara brand voice",
      modelType: "brand",
      status: "failed",
      inputAssetCount: 3,
      minInputAssets: 5,
      failureReason: "Need more source examples before training.",
      createdAt: "2026-05-27T13:30:00.000Z",
      updatedAt: "2026-05-27T14:04:00.000Z"
    }
  ] satisfies CustomerModel[],
  albums: [
    {
      id: "album_lumen_ivo_board",
      siteId: "site_lumen",
      customerId: "cust_lumen_ivo",
      title: "Ceremony detail album",
      sourceJobId: "job_lumen_4772",
      creativePackId: "pack_lumen_wedding",
      status: "ready",
      outputCount: 24,
      coverAssetId: "asset_lumen_ivo_out_001",
      createdAt: "2026-05-27T18:22:00.000Z",
      updatedAt: "2026-05-27T18:22:00.000Z"
    },
    {
      id: "album_lumen_mara_story_ready",
      siteId: "site_lumen",
      customerId: "cust_lumen_mara",
      title: "Santorini wedding story",
      sourceJobId: "job_lumen_4804",
      creativePackId: "pack_lumen_wedding",
      status: "ready",
      outputCount: 18,
      coverAssetId: "asset_lumen_mara_out_001",
      createdAt: "2026-05-27T16:40:00.000Z",
      updatedAt: "2026-05-27T16:55:00.000Z"
    },
    {
      id: "album_lumen_mara_pending",
      siteId: "site_lumen",
      customerId: "cust_lumen_mara",
      title: "Editorial bridal draft",
      sourceJobId: "job_lumen_4817",
      creativePackId: "pack_lumen_editorial",
      status: "processing",
      outputCount: 0,
      createdAt: "2026-05-28T08:18:00.000Z",
      updatedAt: "2026-05-28T08:21:12.000Z"
    }
  ] satisfies Album[],
  assetUploads: [
    {
      id: "asset_lumen_mara_input_001",
      siteId: "site_lumen",
      customerId: "cust_lumen_mara",
      label: "Couple reference portrait",
      storageKey: "/assets/site-media/lumen/ref-crops/example-paris-clean.png?v=20260607a",
      mimeType: "image/png",
      role: "input",
      visibility: "private",
      reviewStatus: "approved",
      createdAt: "2026-05-27T15:40:00.000Z"
    },
    {
      id: "asset_lumen_mara_input_002",
      siteId: "site_lumen",
      customerId: "cust_lumen_mara",
      label: "Venue inspiration",
      storageKey: "/assets/site-media/lumen/ref-crops/photo-santorini.png?v=20260607a",
      mimeType: "image/png",
      role: "input",
      visibility: "private",
      reviewStatus: "approved",
      createdAt: "2026-05-27T15:45:00.000Z"
    },
    {
      id: "asset_lumen_ivo_out_001",
      siteId: "site_lumen",
      customerId: "cust_lumen_ivo",
      jobId: "job_lumen_4772",
      label: "Ceremony detail cover",
      storageKey: "sites/site_lumen/customers/cust_lumen_ivo/jobs/job_lumen_4772/out_001.webp",
      mimeType: "image/webp",
      role: "output",
      visibility: "private",
      reviewStatus: "approved",
      createdAt: "2026-05-27T18:22:00.000Z"
    },
    {
      id: "asset_lumen_mara_out_001",
      siteId: "site_lumen",
      customerId: "cust_lumen_mara",
      jobId: "job_lumen_4804",
      label: "Santorini ceremony hero",
      storageKey: "/assets/site-media/lumen/ref-crops/photo-santorini.png?v=20260607a",
      mimeType: "image/png",
      role: "output",
      visibility: "private",
      reviewStatus: "approved",
      createdAt: "2026-05-27T16:55:00.000Z"
    },
    {
      id: "asset_lumen_mara_out_002",
      siteId: "site_lumen",
      customerId: "cust_lumen_mara",
      jobId: "job_lumen_4804",
      label: "Paris editorial frame",
      storageKey: "/assets/site-media/lumen/ref-crops/photo-paris.png?v=20260607a",
      mimeType: "image/png",
      role: "output",
      visibility: "private",
      reviewStatus: "approved",
      createdAt: "2026-05-27T16:56:00.000Z"
    }
  ],
  jobs: [
    {
      id: "job_lumen_4804",
      siteId: "site_lumen",
      customerId: "cust_lumen_mara",
      aiAppId: "ai_image",
      status: "succeeded",
      creditsReserved: 18,
      createdAt: "2026-05-27T16:30:00.000Z",
      updatedAt: "2026-05-27T16:55:00.000Z",
      requestJson: { style: "santorini wedding", outputCount: 18, worker: "n8n.image.wedding.v1" },
      resultJson: { outputCount: 18, albumId: "album_lumen_mara_story_ready" }
    },
    {
      id: "job_lumen_4817",
      siteId: "site_lumen",
      customerId: "cust_lumen_mara",
      aiAppId: "ai_image",
      status: "running",
      creditsReserved: 24,
      createdAt: "2026-05-28T08:18:00.000Z",
      updatedAt: "2026-05-28T08:21:12.000Z",
      requestJson: { style: "wedding", outputCount: 20, worker: "n8n.image.v1" }
    },
    {
      id: "job_lumen_4772",
      siteId: "site_lumen",
      customerId: "cust_lumen_ivo",
      aiAppId: "ai_image",
      status: "succeeded",
      creditsReserved: 28,
      createdAt: "2026-05-27T18:10:00.000Z",
      updatedAt: "2026-05-27T18:22:00.000Z",
      requestJson: { style: "ceremony editorial", outputCount: 24, worker: "n8n.image.wedding.v1" },
      resultJson: { outputCount: 24, albumId: "album_lumen_ivo_board" }
    },
    {
      id: "job_atlas_1012",
      siteId: "site_atlas",
      customerId: "cust_atlas_mara",
      aiAppId: "ai_copy",
      status: "failed",
      creditsReserved: 3,
      createdAt: "2026-05-27T14:02:00.000Z",
      updatedAt: "2026-05-27T14:04:00.000Z",
      requestJson: { brief: "launch copy for a niche collection" },
      resultJson: { failure: "past_due_customer_blocked" }
    }
  ],
  ledger: [
    {
      id: "led_1",
      siteId: "site_lumen",
      customerId: "cust_lumen_mara",
      amount: 300,
      type: "grant",
      sourceType: "subscription",
      sourceId: "sub_lumen_mara",
      createdAt: "2026-05-01T00:00:00.000Z"
    },
    {
      id: "led_2",
      siteId: "site_lumen",
      customerId: "cust_lumen_mara",
      amount: -24,
      type: "reserve",
      sourceType: "generation_job",
      sourceId: "job_lumen_4817",
      createdAt: "2026-05-28T08:18:00.000Z"
    },
    {
      id: "led_3",
      siteId: "site_atlas",
      customerId: "cust_atlas_mara",
      amount: 28,
      type: "grant",
      sourceType: "credit_pack",
      sourceId: "order_atlas_211",
      createdAt: "2026-05-18T10:00:00.000Z"
    }
  ]
};

platformState.siteAiApps = platformState.siteAiApps.map((siteAiApp) => ({
  ...siteAiApp,
  aiApp: platformState.aiApps.find((app) => app.id === siteAiApp.id.split("_").slice(-1)[0]) ?? platformState.aiApps[0]
}));

platformState.siteAiApps[0].aiApp = platformState.aiApps[0];
platformState.siteAiApps[1].aiApp = platformState.aiApps[2];
platformState.siteAiApps[2].aiApp = platformState.aiApps[1];

export function getSiteBySlug(slug: string): Site | undefined {
  const canonicalSlug = canonicalSiteSlug(slug);
  const candidates = legacySiteSlugCandidates(slug);
  return platformState.sites.find((site) => site.slug === canonicalSlug) ?? platformState.sites.find((site) => candidates.includes(site.slug));
}

export function getSiteByHost(host: string): Site {
  const cleanHost = host.split(":")[0].toLowerCase();
  return (
    platformState.sites.find((site) => site.primaryDomain === cleanHost || cleanHost.includes(site.slug) || cleanHost.includes(canonicalSiteSlug(site.slug))) ??
    platformState.sites[0]
  );
}

export function getSiteProducts(siteId: string): Product[] {
  return platformState.products.filter((product) => product.siteId === siteId);
}

export function getSiteCustomers(siteId: string): Customer[] {
  return platformState.customers.filter((customer) => customer.siteId === siteId);
}

export function getSiteAiApps(siteId: string): SiteAiApp[] {
  return platformState.siteAiApps.filter((app) => app.siteId === siteId);
}

export function getSiteJobs(siteId: string): GenerationJob[] {
  return platformState.jobs.filter((job) => job.siteId === siteId);
}

export function getSiteLedger(siteId: string): CreditLedgerEntry[] {
  return platformState.ledger.filter((entry) => entry.siteId === siteId);
}

export function getPage(site: Site, slug: string): ThemePage {
  return site.pages.find((page) => page.slug === slug) ?? site.pages[0];
}

export function findPage(site: Site, slug: string): ThemePage | undefined {
  const directPage = site.pages.find((page) => page.slug === slug);
  if (directPage) return directPage;
  if (slug === "/faq" && /dreamshoot|aidreamcapes/i.test(`${site.slug} ${site.name} ${site.primaryDomain ?? ""} ${site.branding.logoText}`)) {
    return site.pages.find((page) => page.slug === "/help");
  }
  return undefined;
}

export function formatCurrency(amountCents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: amountCents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: amountCents % 100 === 0 ? 0 : 2
  }).format(amountCents / 100);
}
