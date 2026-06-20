import type { SectionInstance, SectionType, ThemePageJson, ThemeSettingValue } from "@/lib/types";
import type { ThemePackageSiteSettings, ThemePackageTemplateKey } from "../types";

export type DreamShootAiStudioTemplateKey = ThemePackageTemplateKey | "tools";

function section(type: SectionType, settings: SectionInstance["settings"], blocks: SectionInstance["blocks"] = []): SectionInstance {
  return { type, settings, blocks };
}

function block(id: string, type: string, settings: Record<string, ThemeSettingValue>) {
  return { id, type, settings };
}

function page(pageType: string, sectionsOrder: string[], sections: ThemePageJson["sections"], version: number): ThemePageJson {
  return {
    pageType,
    version,
    sectionsOrder,
    sections
  };
}

function pickSections(source: ThemePageJson["sections"], order: string[]): ThemePageJson["sections"] {
  return Object.fromEntries(order.map((id) => [id, source[id]]).filter(([, section]) => Boolean(section))) as ThemePageJson["sections"];
}

const assets = {
  hero: "/assets/dreamshoot/generated/20260619/cyberpunk-solo-city-v1.png",
  heroAlt: "/assets/dreamshoot/generated/20260618/headshot-lifestyle-v1.png",
  casualPortrait: "/assets/dreamshoot/avatar-nora-gpt2-fast.png",
  avatarPortrait: "/assets/dreamshoot/avatar-nora-gpt2.png",
  womanPortrait: "/assets/dreamshoot/beauty-portrait-gpt2.png",
  manPortrait: "/assets/dreamshoot/editorial-headshot-gpt2.png",
  gala: "/assets/dreamshoot/generated/20260619/mafia-noir-single-v1.png",
  cyberpunk: "/assets/dreamshoot/generated/20260619/cyberpunk-solo-city-v1.png",
  travelScene: "/assets/dreamshoot/generated/20260619/nature-adventure-solo-v1.png",
  natureSolo: "/assets/dreamshoot/generated/20260619/nature-adventure-solo-v1.png",
  headshot: "/assets/dreamshoot/frames/sample-professional-headshot.png",
  headshotLifestyle: "/assets/dreamshoot/generated/20260618/headshot-lifestyle-v1.png",
  beauty: "/assets/dreamshoot/frames/story-beauty-portrait.png",
  hairstyle: "/assets/dreamshoot/generated/20260618/hairstyle-preview-v1.png",
  upscaler: "/assets/dreamshoot/generated/20260618/upscaler-utility-v1.png",
  cleanPortrait: "/assets/dreamshoot/generated/20260618/headshot-lifestyle-v1.png",
  worldCupFan: "/assets/dreamshoot/generated/20260619/world-cup-fan-star-clean-v1.png",
  worldCupFanAlt: "/assets/dreamshoot/generated/20260619/world-cup-fan-star-v1.png",
  mafiaNoir: "/assets/dreamshoot/generated/20260619/mafia-noir-single-v1.png",
  beautyPortraitSvg: "/assets/dreamshoot/beauty-portrait.svg",
  tryOn: "/assets/dreamshoot/generated/20260618/hairstyle-preview-v1.png",
  upload: "/assets/dreamshoot/frames/faq-intro-portrait.png",
  selfie: "/assets/dreamshoot/frames/faq-intro-portrait.png",
  socialCard: "/assets/dreamshoot/generated/20260619/world-cup-fan-star-clean-v1.png",
  cyberpunkSample: "/assets/dreamshoot/generated/20260619/cyberpunk-solo-city-v1.png"
} as const;

const dreamshootMegaTools = [
  block("mega_tool_headshot", "tool_card", { title: "Professional headshot maker", description: "Create clean profile portraits for resumes, teams, and founder pages.", category: "Photo AI", badge: "Profile", imageUrl: assets.headshotLifestyle, href: "/tools/image-studio" }),
  block("mega_tool_creator", "tool_card", { title: "Creator portrait studio", description: "Generate creator-ready profile photos, channel visuals, and campaign portraits.", category: "Photo AI", badge: "Creator", imageUrl: assets.avatarPortrait, href: "/tools/image-studio" }),
  block("mega_tool_worldcup", "tool_card", { title: "World Cup fan photos", description: "Build stadium scenes, fan posters, and football-star-inspired profile images.", category: "Photo AI", badge: "Sports", imageUrl: assets.worldCupFan, href: "/tools/image-studio" }),
  block("mega_tool_cyberpunk", "tool_card", { title: "Cyberpunk portrait maker", description: "Turn source selfies into neon city portraits and dramatic future looks.", category: "Photo AI", badge: "Scene", imageUrl: assets.cyberpunk, href: "/tools/image-studio" }),
  block("mega_tool_gala", "tool_card", { title: "Gala photo maker", description: "Create formal night-out portraits with polished editorial lighting.", category: "Photo AI", badge: "Style", imageUrl: assets.mafiaNoir, href: "/tools/image-studio" }),
  block("mega_tool_noir", "tool_card", { title: "Noir character portraits", description: "Generate cinematic mafia, detective, and vintage city character looks.", category: "Photo AI", badge: "Noir", imageUrl: assets.gala, href: "/tools/image-studio" }),
  block("mega_tool_anime", "tool_card", { title: "Anime avatar builder", description: "Create stylized profile avatars and character-inspired social images.", category: "Photo AI", badge: "Avatar", imageUrl: assets.beauty, href: "/tools/image-studio" }),
  block("mega_tool_nature", "tool_card", { title: "Nature adventure photos", description: "Place the customer in scenic outdoor, hiking, and travel-inspired scenes.", category: "Photo AI", badge: "Outdoor", imageUrl: assets.natureSolo, href: "/tools/image-studio" }),
  block("mega_tool_fashion", "tool_card", { title: "Fashion editorial set", description: "Create magazine-style outfit stories and polished personal-brand images.", category: "Photo AI", badge: "Editorial", imageUrl: assets.manPortrait, href: "/tools/image-studio" }),
  block("mega_tool_product", "tool_card", { title: "Product lifestyle photos", description: "Preview creator product shots, social commerce visuals, and campaign scenes.", category: "Photo AI", badge: "Commerce", imageUrl: assets.upscaler, href: "/tools/image-studio" }),
  block("mega_edit_background", "tool_card", { title: "Background changer", description: "Replace a plain selfie background before ordering a full photo package.", category: "AI Photo Edit", badge: "Free", imageUrl: assets.cyberpunk, href: "/tools/image-studio" }),
  block("mega_edit_remove_bg", "tool_card", { title: "Background remover", description: "Cut out product or portrait backgrounds for cleaner source images.", category: "AI Photo Edit", badge: "Utility", imageUrl: assets.upload, href: "/tools/image-studio" }),
  block("mega_edit_magic_eraser", "tool_card", { title: "Magic eraser", description: "Remove small distractions from portraits, cards, and generated scenes.", category: "AI Photo Edit", badge: "Utility", imageUrl: assets.hairstyle, href: "/tools/image-studio" }),
  block("mega_edit_enhancer", "tool_card", { title: "Photo enhancer", description: "Improve low-light uploads before using them for private model training.", category: "AI Photo Edit", badge: "Free", imageUrl: assets.headshot, href: "/tools/image-studio" }),
  block("mega_edit_retouch", "tool_card", { title: "Portrait retouch", description: "Clean skin, flyaways, and lighting without changing the customer's identity.", category: "AI Photo Edit", badge: "Retouch", imageUrl: assets.womanPortrait, href: "/tools/image-studio" }),
  block("mega_edit_unblur", "tool_card", { title: "Unblur image", description: "Rescue soft phone shots before they enter a paid generation workflow.", category: "AI Photo Edit", badge: "Utility", imageUrl: assets.headshotLifestyle, href: "/tools/image-studio" }),
  block("mega_edit_color", "tool_card", { title: "Color correction", description: "Balance tones for profile photos, posters, and package previews.", category: "AI Photo Edit", badge: "Color", imageUrl: assets.manPortrait, href: "/tools/image-studio" }),
  block("mega_edit_restore", "tool_card", { title: "Old photo restoration", description: "Repair faded family photos and prepare them for private album delivery.", category: "AI Photo Edit", badge: "Restore", imageUrl: assets.beauty, href: "/tools/image-studio" }),
  block("mega_edit_prompt", "tool_card", { title: "Edit by prompt", description: "Describe a focused edit and preview it before spending package credits.", category: "AI Photo Edit", badge: "Prompt", imageUrl: assets.cyberpunkSample, href: "/tools/image-studio" }),
  block("mega_edit_upscale", "tool_card", { title: "Magic upscaler", description: "Preview higher-resolution delivery for finished photos and profile images.", category: "AI Photo Edit", badge: "HD", imageUrl: assets.upscaler, href: "/tools/image-studio" }),
  block("mega_video_image", "tool_card", { title: "Image to video concept", description: "Turn a finished photo package image into a short motion concept.", category: "Video AI", badge: "Preview", imageUrl: assets.upscaler, href: "/tools/image-studio" }),
  block("mega_video_profile", "tool_card", { title: "Profile clip maker", description: "Create social profile motion from headshots or creator portraits.", category: "Video AI", badge: "Social", imageUrl: assets.headshotLifestyle, href: "/tools/image-studio" }),
  block("mega_video_fan", "tool_card", { title: "Fan poster motion", description: "Animate World Cup fan posters and match-day profile scenes.", category: "Video AI", badge: "Sports", imageUrl: assets.worldCupFan, href: "/tools/image-studio" }),
  block("mega_video_intro", "tool_card", { title: "Creator intro video", description: "Turn creator portraits into short intro clips for profiles and reels.", category: "Video AI", badge: "Creator", imageUrl: assets.avatarPortrait, href: "/tools/image-studio" }),
  block("mega_video_product", "tool_card", { title: "Product teaser clip", description: "Create simple motion ideas for product-style package outputs.", category: "Video AI", badge: "Commerce", imageUrl: assets.upscaler, href: "/tools/image-studio" }),
  block("mega_video_avatar", "tool_card", { title: "Animated avatar preview", description: "Preview avatar-style motion concepts for profile campaigns.", category: "Video AI", badge: "Avatar", imageUrl: assets.beauty, href: "/tools/image-studio" }),
  block("mega_video_fashion", "tool_card", { title: "Fashion reel starter", description: "Create short reel concepts from editorial and try-on package outputs.", category: "Video AI", badge: "Style", imageUrl: assets.manPortrait, href: "/tools/image-studio" }),
  block("mega_video_album", "tool_card", { title: "Album story video", description: "Turn favorite generated images into a compact customer album story.", category: "Video AI", badge: "Album", imageUrl: assets.mafiaNoir, href: "/tools/image-studio" })
];

const homeSections: ThemePageJson["sections"] = {
  hero_1: section(
    "hero",
    {
      anchor: "home",
      eyebrow: "",
      headline: "AI photo packages that feel like a real shoot",
      subheadline: "Upload selfies, build a private model, then buy photo packages with monthly credits.",
      imageUrl: assets.hero,
      secondaryImageUrl: assets.headshotLifestyle,
      tertiaryImageUrl: assets.gala,
      heroGridImages: [assets.headshotLifestyle, assets.hairstyle, assets.cyberpunk, assets.natureSolo, assets.worldCupFan, assets.worldCupFanAlt, assets.travelScene, assets.mafiaNoir, assets.beauty, assets.avatarPortrait, assets.socialCard, assets.manPortrait, assets.womanPortrait, assets.headshot, assets.beautyPortraitSvg].join("|"),
      bulletList:
        "Upload selfies and create your own private AI model.|Themed photo packages from headshots to football fan photos.|Gala, cyberpunk, travel, beauty, and profile packs.|Magic upscaler, AI video concepts, and style preview flows.",
      highlightWord: "real",
      heroBadge: "AI photo package studio",
      authRibbon: "Plans start at $24.50/month",
      authPrimaryLabel: "Continue with Google",
      authEmailPlaceholder: "Enter your email",
      authButtonLabel: "Get Started with Email",
      imageBadge: "15+ package categories",
      imageCaption: "Choose a photo package first, then generate a private album.",
      socialProofLabel: "4.9/5 from creators using private photo packs",
      layout: "immersive_dark"
    },
    [
      block("hero_cta_primary", "cta", { label: "Start Making", href: "/login", style: "primary" }),
      block("hero_cta_secondary", "cta", { label: "Photo Packages", href: "/collections", style: "secondary" }),
      block("hero_stat_credits", "stat", { value: "200-600", label: "monthly credits" }),
      block("hero_stat_packs", "stat", { value: "15+", label: "photo package themes" }),
      block("hero_stat_private", "stat", { value: "Private", label: "model, uploads, albums" })
    ]
  ),
  brand_strip_1: section(
    "brand_logo_strip",
    { anchor: "trusted", title: "Trusted funnel signals for creators, job seekers, sports fans, and social buyers", style: "dark" },
    [
      block("logo_reviews", "logo", { name: "5-star reviews", imageUrl: "", badge: "Proof" }),
      block("logo_packages", "logo", { name: "Photo Packages", imageUrl: "", badge: "Catalog" }),
      block("logo_model", "logo", { name: "Personal AI Model", imageUrl: "", badge: "Private" }),
      block("logo_video", "logo", { name: "AI Video", imageUrl: "", badge: "Motion" }),
      block("logo_tryon", "logo", { name: "Virtual Try-On", imageUrl: "", badge: "Style" })
    ]
  ),
  taxonomy_1: section(
    "dreamshoot_package_taxonomy",
    {
      anchor: "package-taxonomy",
      eyebrow: "Photo package library",
      title: "Sell recognizable photo outcomes first.",
      subtitle: "Headshots, hairstyles, World Cup fan photos, cyberpunk, nature, gala, style previews, creator portraits, and video add-ons all stay editable as package blocks.",
      layout: "editorial"
    },
    [
      block("taxonomy_headshot", "taxonomy_card", { title: "Professional headshots", description: "Profile photos for LinkedIn, founders, resumes, and teams.", meta: "Professional", keywords: "headshot|linkedin|resume", imageUrl: assets.manPortrait, href: "/collections?category=headshots" }),
      block("taxonomy_style", "taxonomy_card", { title: "Style and beauty", description: "Hairstyles, beauty portraits, virtual try-on, and polished creator looks.", meta: "Beauty", keywords: "hairstyle|beauty|virtual try-on", imageUrl: assets.womanPortrait, href: "/collections?category=beauty" }),
      block("taxonomy_worlds", "taxonomy_card", { title: "Cinematic worlds", description: "Cyberpunk, mafia, nature, travel, gala, and dramatic themed photos.", meta: "Creative", keywords: "cyberpunk|mafia|nature|gala", imageUrl: assets.cyberpunkSample, href: "/collections?category=creative" }),
      block("taxonomy_sports", "taxonomy_card", { title: "World Cup fan photos", description: "Stadium tunnel meet-ups, football star-inspired scenes, fan posters, and match-day profile photos.", meta: "Sports", keywords: "world cup photos|football fan photo|sports star", imageUrl: assets.worldCupFan, href: "/collections?category=sports" }),
      block("taxonomy_video", "taxonomy_card", { title: "AI video add-ons", description: "Turn finished package outputs into short social-friendly motion concepts.", meta: "Video", keywords: "image to video|motion|social", imageUrl: assets.upscaler, href: "/tools/image-studio" }),
      block("taxonomy_creator", "taxonomy_card", { title: "Creator lifestyle", description: "Portfolio, creator, campaign, and personal-brand scenes for everyday buyers.", meta: "Creator", keywords: "creator portraits|portfolio|personal brand", imageUrl: assets.avatarPortrait, href: "/collections?category=creator" })
    ]
  ),
  sample_strip_1: section(
    "sample_strip",
    {
      anchor: "samples",
      eyebrow: "Popular photo outcomes",
      title: "A visual catalogue with clear package intent.",
      subtitle: "Each image points to a different buyer outcome, not a generic prompt gallery.",
      speed: "slow"
    },
    [
      block("sample_headshot", "sample", { label: "Headshots", imageUrl: assets.headshotLifestyle, meta: "Professional portrait" }),
      block("sample_hairstyle", "sample", { label: "Hairstyle", imageUrl: assets.hairstyle, meta: "Beauty preview" }),
      block("sample_cyberpunk", "sample", { label: "Cyberpunk", imageUrl: assets.cyberpunkSample, meta: "Neon city look" }),
      block("sample_nature", "sample", { label: "Nature", imageUrl: assets.natureSolo, meta: "Outdoor adventure" }),
      block("sample_mafia", "sample", { label: "Mafia", imageUrl: assets.mafiaNoir, meta: "Noir portrait" }),
      block("sample_worldcup", "sample", { label: "World Cup", imageUrl: assets.worldCupFan, meta: "Fan meet-up" })
    ]
  ),
  packages_1: section("photo_package_wall", {
    anchor: "packages",
    eyebrow: "AI photo packages",
    title: "Photo packages are the product catalogue.",
    subtitle: "Every package card stays tied to live creative packs, credit cost, training requirement, and checkout rules while the visual merchandising remains editable.",
    source: "creative_packs",
    layout: "editorial",
    maxCount: "8"
  }),
  packages_strip_1: section("feature_grid", {
    anchor: "package-path",
    eyebrow: "Why customers buy",
    title: "Make the path from upload to gallery obvious.",
    subtitle: "Free tools preview the idea. Plans unlock credits. Packages deliver private albums.",
    source: "blocks",
    layout: "steps"
  }, [
    block("pkg_path_upload", "card", { title: "Upload", text: "Collect source portraits and style references in one site-scoped workspace.", meta: "Step 01", imageUrl: assets.upload }),
    block("pkg_path_preview", "card", { title: "Preview", text: "Use free tools to preview the look before paying for the full package.", meta: "Step 02", imageUrl: assets.hairstyle }),
    block("pkg_path_pay", "card", { title: "Pay", text: "Choose a monthly plan or add-on credits from the live catalog.", meta: "Step 03", imageUrl: assets.socialCard }),
    block("pkg_path_deliver", "card", { title: "Deliver", text: "Finished outputs return to the private album and stay tied to the account.", meta: "Step 04", imageUrl: assets.avatarPortrait })
  ]),
  feature_tabs_1: section(
    "dreamshoot_feature_tabs",
    {
      anchor: "tools",
      eyebrow: "What you can create",
      title: "Free tools are the on-ramp.",
      subtitle: "Simple edits stay useful. Serious package work moves into login, credits, and private delivery.",
      layout: "split"
    },
    [
      block("tab_packages", "feature_tab", {
        label: "Photo packages",
        title: "Pick a finished outcome",
        description: "Start from a known package like headshots, World Cup fan photos, cyberpunk, gala, nature, beauty, creator, or product-style scenes instead of writing a blank prompt.",
        imageUrl: assets.worldCupFan,
        href: "/tools/image-studio"
      }),
      block("tab_video", "feature_tab", {
        label: "AI video",
        title: "Turn package results into motion",
        description: "Convert favorite generated photos into short video ideas without leaving the same customer account.",
        imageUrl: assets.travelScene,
        href: "/tools/image-studio"
      }),
      block("tab_tryon", "feature_tab", {
        label: "Try-on and style",
        title: "Preview looks before a full package",
        description: "Test hairstyle, wardrobe, beauty, or gala directions before spending credits on a premium pack.",
        imageUrl: assets.tryOn,
        href: "/tools/image-studio"
      })
    ]
  ),
  free_tools_1: section(
    "dreamshoot_tool_collection",
    {
      anchor: "free-tools",
      eyebrow: "Free AI tools",
      title: "AI tools that lead into private photo packs.",
      subtitle: "Let visitors try focused tools first, then route serious work into login, credits, model training, and private album delivery.",
      categories: "Photo AI|AI Photo Edit|Video AI",
      primaryCta: "Start private studio",
      primaryHref: "/login",
      secondaryCta: "View all tools",
      secondaryHref: "/tools",
      layout: "mega_menu"
    },
    dreamshootMegaTools
  ),
  workflow_1: section(
    "studio_steps",
    {
      anchor: "workflow",
      eyebrow: "How it works",
      title: "Upload, model, package, download.",
      subtitle: "A short customer journey: source photos, private model, credit-backed package, finished gallery.",
      imageUrl: assets.upload
    },
    [
      block("step_upload", "card", { title: "Upload your photos", text: "Use clean selfies or source portraits from your phone. The first model looks best with 8-12 photos per person.", meta: "01" }),
      block("step_train", "card", { title: "Build your private model", text: "The platform creates a private identity model before advanced packs run.", meta: "02" }),
      block("step_pack", "card", { title: "Choose a photo package", text: "Pick themed outcomes like World Cup fan photos, gala, travel, cyberpunk, beauty, creator, or headshots.", meta: "03" }),
      block("step_deliver", "card", { title: "Get your final gallery", text: "Finished sets land in a private album where customers can review and download results.", meta: "04" })
    ]
  ),
  proof_pairs_1: section(
    "before_after_gallery",
    {
      anchor: "results",
      title: "Show the transformation before checkout.",
      subtitle: "Normal source portrait, private model, themed output, and gallery-ready delivery.",
    },
    [
      block("proof_pair_headshot", "before_after", {
        beforeLabel: "Phone source",
        afterLabel: "Headshot pack",
        beforeImage: assets.selfie,
        afterImage: assets.manPortrait
      }),
      block("proof_pair_gala", "before_after", {
        beforeLabel: "Everyday portrait",
        afterLabel: "Gala result",
        beforeImage: assets.avatarPortrait,
        afterImage: assets.gala
      }),
      block("proof_pair_style", "before_after", {
        beforeLabel: "Style reference",
        afterLabel: "Beauty set",
        beforeImage: assets.hairstyle,
        afterImage: assets.womanPortrait
      })
    ]
  ),
  trust_1: section(
    "trust_signal_bar",
    { anchor: "trust", title: "Private uploads, clear credits, Stripe checkout, and customer-only galleries." },
    [
      block("trust_private", "stat", { value: "Private", label: "source photos and albums stay inside the signed-in customer account" }),
      block("trust_credits", "stat", { value: "Ledger", label: "credits are granted, reserved, consumed, or returned with visible history" }),
      block("trust_model", "stat", { value: "Model", label: "premium packages use a private identity model instead of a generic prompt" }),
      block("trust_checkout", "stat", { value: "Stripe", label: "subscriptions and one-time credit packs use the live product catalog" })
    ]
  ),
  plan_rules_1: section(
    "rich_text",
    {
      anchor: "plan-rules",
      eyebrow: "Plans and credits",
      title: "Free tools preview. Credits generate.",
      body: "Paid plans unlock private model creation, package generation, credit history, and gallery delivery from one account.",
      imageUrl: assets.manPortrait,
      primaryCta: "Compare plans",
      primaryHref: "/pricing",
      secondaryCta: "Open tools",
      secondaryHref: "/tools",
      tone: "dark",
      layout: "commerce_intro"
    },
    [
      block("plan_rule_free", "card", { meta: "free entry", title: "Use utility tools first", description: "Background edits, previews, upscaling, and simple try-on flows explain the value before checkout." }),
      block("plan_rule_model", "card", { meta: "paid model", title: "Train a private identity model", description: "Advanced packages need a customer model so results can stay consistent across headshots, gala, travel, and style sets." }),
      block("plan_rule_credits", "card", { meta: "credit ledger", title: "Spend credits only when generating", description: "Credits are visible before a request starts and remain tied to subscription or one-time pack purchases." }),
      block("plan_rule_gallery", "card", { meta: "private delivery", title: "Download from the gallery", description: "Finished outputs return to the signed-in customer's album instead of being delivered through a generic download page." })
    ]
  ),
  pricing_1: section("pricing_table", {
    anchor: "plans",
    title: "Plans & Pricing",
    subtitle: "Choose Starter, Pro, or Premium. Credits stay visible before every package run.",
    productType: "subscription",
    featuredProductId: "prod_dreamshoot_pro",
    featuredBadgeLabel: "Most Popular",
    showCheckoutNote: true,
    backgroundImage: assets.cyberpunk
  }),
  proof_1: section(
    "testimonial_wall",
    {
      anchor: "reviews",
      title: "Reviews should prove buyer intent.",
      subtitle: "Each review ties a normal customer identity to the package result they ordered.",
      summaryTitle: "Loved by creators, job seekers, and solo buyers",
      summaryBody: "The strongest proof is simple: ordinary input photos, believable output sets, clear credits, and no studio booking.",
      summaryRating: "4.9/5",
      summaryMeta: "Demo review wall aligned to the DreamShootAI direction"
    },
    [
      block("review_ava", "testimonial", {
        quote: "I started with basic phone photos and the gala package gave us a complete night-out set without booking a photographer.",
        name: "Ava Mercer",
        role: "Gala package subscriber",
        location: "California, USA",
        rating: "5",
        avatarUrl: assets.avatarPortrait,
        resultImageUrl: assets.gala
      }),
      block("review_lucas", "testimonial", {
        quote: "The headshot pack was more useful than booking a last-minute studio. Clear pricing, clear credits, great results.",
        name: "Lucas Bennett",
        role: "Founder",
        location: "Toronto, Canada",
        rating: "5",
        avatarUrl: assets.manPortrait,
        resultImageUrl: assets.headshotLifestyle
      }),
      block("review_mia", "testimonial", {
        quote: "The free enhancer helped me choose the right inputs, then I used credits for beauty portraits and a World Cup fan set.",
        name: "Mia Collins",
        role: "Creator",
        location: "London, UK",
        rating: "5",
        avatarUrl: assets.beauty,
        resultImageUrl: assets.worldCupFan
      }),
      block("review_noah", "testimonial", {
        quote: "I used the Pro plan for headshots and social cards. The credit usage was clear before every generation.",
        name: "Noah Reed",
        role: "Job seeker",
        location: "Austin, USA",
        rating: "5",
        avatarUrl: assets.casualPortrait,
        resultImageUrl: assets.headshotLifestyle
      }),
      block("review_elena", "testimonial", {
        quote: "The cyberpunk pack looked distinct from the creator portraits, so I could use both sets for different channels.",
        name: "Elena Fischer",
        role: "Solo creator",
        location: "Berlin, Germany",
        rating: "5",
        avatarUrl: assets.womanPortrait,
        resultImageUrl: assets.cyberpunk
      }),
      block("review_ryan", "testimonial", {
        quote: "I tried free tools first, then upgraded when I needed a private model and a full travel scene pack.",
        name: "Ryan Cole",
        role: "Travel buyer",
        location: "Melbourne, Australia",
        rating: "5",
        avatarUrl: assets.selfie,
        resultImageUrl: assets.travelScene
      })
    ]
  ),
  proof_strip_1: section("trust_signal_bar", {
    anchor: "proof-strip",
    title: "Private uploads, clear credits, and gallery delivery customers can trust."
  }, [
    block("proof_strip_private", "stat", { value: "Private", label: "site-scoped uploads and albums" }),
    block("proof_strip_credits", "stat", { value: "Credits", label: "visible before each generation" }),
    block("proof_strip_model", "stat", { value: "Model", label: "personal identity model for premium packs" }),
    block("proof_strip_delivery", "stat", { value: "Gallery", label: "download-ready delivery after fulfilment" })
  ]),
  faq_1: section(
    "faq",
    {
      anchor: "faq",
      eyebrow: "Questions before upload",
      title: "FAQ",
      subtitle: "Answer pricing, privacy, uploads, and plan questions before customers spend credits.",
      journeyTitle: "Your photo flow",
      journeyTitles: "Upload|Choose Pack|Generate|Download",
      journeyDescriptions: "Add clean source photos.|Pick a scene or style.|AI builds your set.|Download from the private gallery."
    },
    [
      block("faq_cost", "faq_item", {
        question: "Can I try DreamShootAI for free?",
        answer: "Some lightweight tools can be free, but private model creation and premium packs require a paid plan because they consume dedicated generation credits."
      }),
      block("faq_uploads", "faq_item", {
        question: "What photos should I upload?",
        answer: "Recent, clear, high-quality phone photos work best. Use different angles, expressions, lighting, and outfits so the private model has enough visual range."
      }),
      block("faq_private", "faq_item", {
        question: "Are my uploads private?",
        answer: "Yes. Uploads, jobs, albums, orders, and credits are scoped to the current site and the current customer account."
      }),
      block("faq_refunds", "faq_item", {
        question: "What is the refund policy?",
        answer: "Unused credits can be reviewed for refund eligibility within 30 days. Credits that have already been spent on successful generations are not refundable."
      }),
      block("faq_credits", "faq_item", {
        question: "How do credits work?",
        answer: "Monthly plans grant credits to the customer account. Creating a package reserves the needed credits first, successful results consume them, and failed requests can return them."
      }),
      block("faq_model", "faq_item", {
        question: "Why do premium packs need a private model?",
        answer: "A private model keeps the customer's face and style consistent across different photo packages. Simple utility tools can run without it, but premium albums need that model for better continuity."
      }),
      block("faq_expiry", "faq_item", {
        question: "What happens if I cancel a plan?",
        answer: "The account can keep access to previous albums and any credit rules configured for the site. New package requests can be blocked if the subscription is not active."
      })
    ]
  ),
  conversion_1: section(
    "conversion_panel",
    {
      anchor: "start",
      eyebrow: "Start creating",
      title: "Open your private DreamShootAI studio.",
      subtitle: "Subscribe, upload, choose packages, generate results, and keep delivery in one workspace.",
      primaryCta: "Start Making",
      primaryHref: "/login",
      secondaryCta: "View pricing",
      secondaryHref: "/pricing"
    },
    [
      block("cta_metric_credits", "stat", { value: "200", label: "starter credits" }),
      block("cta_metric_styles", "stat", { value: "15+", label: "live scene packs" }),
      block("cta_metric_private", "stat", { value: "Private", label: "uploads and albums" })
    ]
  )
};

const templateSections = {
  pricing_intro_1: section("rich_text", {
    eyebrow: "Pricing",
    title: "Monthly credits for photo packs, AI video, and virtual try-on.",
    body: "Starter, Pro, and Premium map to real product prices, credits, and checkout records.",
    headingLevel: "h1"
  }),
  package_hero_1: section("media_banner", {
    anchor: "package",
    eyebrow: "Photo package",
    title: "Choose a themed photo pack and make the result obvious before checkout.",
    subtitle: "This page should explain the outcome, show visual proof, and keep the live pack tied to the real billing catalog.",
    imageUrl: assets.headshotLifestyle,
    ctaLabel: "Browse packages",
    ctaHref: "/collections"
  }),
  package_before_after_1: section(
    "before_after_gallery",
    {
      anchor: "results",
      title: "Show the transformation before the customer buys.",
      subtitle: "Use a normal input portrait, then show the premium generated result side by side."
    },
    [
      block("package_before_after_1", "before_after", {
        beforeLabel: "Uploaded selfie",
        afterLabel: "Gala result",
        beforeImage: assets.casualPortrait,
        afterImage: assets.gala
      }),
      block("package_before_after_2", "before_after", {
        beforeLabel: "Phone portrait",
        afterLabel: "Beauty editorial",
        beforeImage: assets.selfie,
        afterImage: assets.beauty
      })
    ]
  ),
  tool_banner_1: section("media_banner", {
    anchor: "tool",
    eyebrow: "AI Image Studio",
    title: "Create polished AI photo sets from everyday uploads.",
    subtitle: "Customers should understand that this is one guided workflow: upload, hold credits, generate scenes, and receive a private gallery.",
    imageUrl: assets.gala,
    ctaLabel: "Open workspace",
    ctaHref: "/app"
  }),
  job_intro_1: section("rich_text", {
    eyebrow: "Job status",
    title: "Track every generation request from queue to delivery.",
    body: "The status page should explain what the platform is doing, how credits are held, and when the finished album becomes available."
  }),
  album_intro_1: section("media_banner", {
    anchor: "album",
    eyebrow: "Private gallery",
    title: "Delivered images stay inside a customer-only album.",
    subtitle: "A finished job should appear here automatically with download actions and site-scoped privacy.",
    imageUrl: assets.headshotLifestyle,
    ctaLabel: "Go to workspace",
    ctaHref: "/app"
  }),
  billing_intro_1: section("rich_text", {
    eyebrow: "Account and billing",
    title: "Manage credits, plans, and one-time top-ups from one place.",
    body: "Billing should stay simple: active plan, credit history, live product prices, and clear refill options."
  }),
  blog_intro_1: section("rich_text", {
    eyebrow: "Guides",
    title: "Planning content that supports the subscription funnel.",
    body: "Use content to answer upload, styling, privacy, and pricing questions so customers arrive at the pack wall with less friction."
  }),
  blog_detail_1: section("rich_text", {
    eyebrow: "Guide",
    title: "How to prepare your best source photos for AI scenes",
    body: "Explain lighting, angles, expressions, clothing variety, privacy expectations, and how stronger source photos produce cleaner final packs."
  })
};

export const dreamshootAiStudioTemplates: Record<DreamShootAiStudioTemplateKey, ThemePageJson> = {
  home: page(
    "home",
    ["hero_1", "brand_strip_1", "taxonomy_1", "sample_strip_1", "workflow_1", "packages_1", "pricing_1", "proof_1", "faq_1", "trust_1", "conversion_1"],
    pickSections(homeSections, ["hero_1", "brand_strip_1", "taxonomy_1", "sample_strip_1", "workflow_1", "packages_1", "pricing_1", "proof_1", "faq_1", "trust_1", "conversion_1"]),
    1
  ),
  pricing: page(
    "pricing",
    ["pricing_intro_1", "pricing_1", "plan_rules_1", "trust_1", "faq_1", "conversion_1"],
    {
      pricing_intro_1: templateSections.pricing_intro_1,
      pricing_1: homeSections.pricing_1,
      plan_rules_1: homeSections.plan_rules_1,
      trust_1: homeSections.trust_1,
      faq_1: homeSections.faq_1,
      conversion_1: homeSections.conversion_1
    },
    1
  ),
  packages: page(
    "collection",
    ["taxonomy_1", "packages_1", "proof_pairs_1", "packages_strip_1", "trust_1", "conversion_1"],
    {
      taxonomy_1: homeSections.taxonomy_1,
      packages_1: homeSections.packages_1,
      sample_strip_1: homeSections.sample_strip_1,
      proof_pairs_1: homeSections.proof_pairs_1,
      packages_strip_1: homeSections.packages_strip_1,
      feature_tabs_1: homeSections.feature_tabs_1,
      trust_1: homeSections.trust_1,
      conversion_1: homeSections.conversion_1
    },
    1
  ),
  tools: page(
    "tools",
    ["free_tools_1", "feature_tabs_1", "plan_rules_1", "packages_1", "trust_1", "pricing_1", "faq_1", "conversion_1"],
    {
      free_tools_1: homeSections.free_tools_1,
      feature_tabs_1: homeSections.feature_tabs_1,
      plan_rules_1: homeSections.plan_rules_1,
      packages_1: homeSections.packages_1,
      trust_1: homeSections.trust_1,
      pricing_1: homeSections.pricing_1,
      faq_1: homeSections.faq_1,
      conversion_1: homeSections.conversion_1
    },
    1
  ),
  "package-detail": page(
    "package_detail",
    ["package_hero_1", "package_before_after_1", "packages_1", "packages_strip_1", "trust_1", "pricing_1", "faq_1", "conversion_1"],
    {
      package_hero_1: templateSections.package_hero_1,
      package_before_after_1: templateSections.package_before_after_1,
      packages_1: homeSections.packages_1,
      packages_strip_1: homeSections.packages_strip_1,
      trust_1: homeSections.trust_1,
      pricing_1: homeSections.pricing_1,
      faq_1: homeSections.faq_1,
      conversion_1: homeSections.conversion_1
    },
    1
  ),
  "tool-detail": page(
    "ai_tool",
    ["tool_banner_1", "entry_1", "upload_1", "form_1", "progress_1", "album_1", "trust_1", "faq_1"],
    {
      tool_banner_1: templateSections.tool_banner_1,
      entry_1: section("ai_tool_entry", { aiAppSlug: "image_generator", title: "AI image studio for scenes, looks, and polished final sets", subtitle: "Open the site-enabled tool, upload source photos, hold credits, and receive your result in the private album.", ctaLabel: "Open workspace", imageUrl: assets.gala }),
      upload_1: section("upload_panel", { title: "Private upload intake", helper: "Uploads are scoped to the current customer and this site only.", imageUrl: assets.upload }),
      form_1: section("generation_form", { aiAppSlug: "image_generator", title: "Generate a scene pack", helper: "Choose an enabled pack, reserve credits, and send a signed worker job." }),
      progress_1: section("job_progress", { title: "Visible job state" }),
      album_1: section("album_gallery", { title: "Customer album", showDownloads: true }),
      trust_1: homeSections.trust_1,
      faq_1: homeSections.faq_1
    },
    1
  ),
  login: page(
    "login",
    ["login_1", "trust_1", "plan_rules_1"],
    {
      login_1: section(
        "login_method_panel",
        {
          anchor: "start",
          eyebrow: "Customer login",
          title: "Start with a private DreamShootAI account.",
          subtitle: "Customers sign in before upload, subscription, generation, progress, and private album access.",
          emailPlaceholder: "you@example.com",
          buttonLabel: "Continue with email",
          actionHref: "/login",
          imageUrl: assets.headshotLifestyle,
          secondaryImageUrl: assets.casualPortrait,
          imageBadge: "Private uploads",
          imageCaption: "Every source photo, credit, and gallery stays attached to this site account."
        },
        [
          block("login_google", "login_method", { label: "Continue with Google", helper: "OAuth-ready entry for production.", kind: "google", href: "/login" }),
          block("login_email", "login_method", { label: "Use email login", helper: "Password login is available for private gallery access.", kind: "email", href: "/login" })
        ]
      ),
      trust_1: homeSections.trust_1,
      plan_rules_1: homeSections.plan_rules_1
    },
    1
  ),
  "app-home": page(
    "workspace",
    ["launcher_1", "upload_1", "progress_1", "album_1", "trust_1"],
    {
      launcher_1: section("ai_feature_launcher", { anchor: "features", eyebrow: "Studio features", title: "A real customer workspace, not just a landing page.", subtitle: "Customers can upload, generate, track progress, view albums, and manage credits from one signed-in area." }),
      upload_1: section("upload_panel", { title: "Private upload intake", helper: "Upload source photos for the current customer only.", imageUrl: assets.upload }),
      progress_1: section("job_progress", { title: "Recent generation status" }),
      album_1: section("album_gallery", { title: "Generated albums", showDownloads: true }),
      trust_1: homeSections.trust_1
    },
    1
  ),
  "job-progress": page(
    "job_progress",
    ["job_intro_1", "progress_1", "album_1", "trust_1", "faq_1"],
    {
      job_intro_1: templateSections.job_intro_1,
      progress_1: section("job_progress", { title: "Current generation status" }),
      album_1: section("album_gallery", { title: "Delivered outputs", showDownloads: true }),
      trust_1: homeSections.trust_1,
      faq_1: homeSections.faq_1
    },
    1
  ),
  "job-detail": page(
    "job_detail",
    ["job_detail_1", "album_1", "trust_1", "conversion_1"],
    {
      job_detail_1: section("job_detail", {
        eyebrow: "Generation job",
        title: "Review one private generation request.",
        subtitle: "This page shows the selected customer job, worker payload, output assets, and the related credit ledger inside the current site runtime.",
        showRequestJson: true,
        showLedger: true,
        showAssets: true
      }),
      album_1: section("album_gallery", { title: "Related outputs", showDownloads: true }),
      trust_1: homeSections.trust_1,
      conversion_1: homeSections.conversion_1
    },
    1
  ),
  album: page(
    "album",
    ["album_intro_1", "album_1", "trust_1", "conversion_1"],
    {
      album_intro_1: templateSections.album_intro_1,
      album_1: section("album_gallery", { title: "Private generated albums", showDownloads: true }),
      trust_1: homeSections.trust_1,
      conversion_1: homeSections.conversion_1
    },
    1
  ),
  "account-billing": page(
    "account",
    ["billing_intro_1", "pricing_1", "plan_rules_1", "conversion_1"],
    {
      billing_intro_1: templateSections.billing_intro_1,
      pricing_1: homeSections.pricing_1,
      plan_rules_1: homeSections.plan_rules_1,
      conversion_1: homeSections.conversion_1
    },
    1
  ),
  help: page(
    "help",
    ["intro_1", "faq_1", "plan_rules_1"],
    {
      intro_1: section("rich_text", { eyebrow: "Help", title: "Help center", body: "Use this page for upload guidance, billing questions, privacy answers, and how scene packs actually work." }),
      faq_1: homeSections.faq_1,
      plan_rules_1: homeSections.plan_rules_1
    },
    1
  ),
  policy: page(
    "policy",
    ["policy_1"],
    {
      policy_1: section("policy_content", { title: "Policy page", body: "<p>Replace this draft policy with your site-specific privacy, refund, content, or terms copy.</p>" })
    },
    1
  ),
  "blog-list": page(
    "blog",
    ["blog_intro_1", "blog_list_1", "packages_strip_1", "conversion_1"],
    {
      blog_intro_1: templateSections.blog_intro_1,
      blog_list_1: section("blog_list", { title: "AI photo guides", body: "Guides for uploads, package planning, credits, delivery, privacy, and making stronger prompts.", guideType: "AI photo guide" }),
      packages_strip_1: homeSections.packages_strip_1,
      conversion_1: homeSections.conversion_1
    },
    1
  ),
  "blog-detail": page(
    "article",
    ["blog_detail_1", "packages_1", "packages_strip_1", "blog_list_1", "conversion_1"],
    {
      blog_detail_1: templateSections.blog_detail_1,
      packages_1: homeSections.packages_1,
      packages_strip_1: homeSections.packages_strip_1,
      blog_list_1: section("blog_list", { title: "Related guides", body: "Keep readers moving from educational content into real packages and pricing.", guideType: "AI photo guide" }),
      conversion_1: homeSections.conversion_1
    },
    1
  ),
  search: page(
    "search",
    ["search_intro_1", "search_1", "packages_1", "packages_strip_1", "conversion_1"],
    {
      search_intro_1: section("rich_text", {
        eyebrow: "Search",
        title: "Search tools, packs, pricing, and policies.",
        body: "Search is part of the same theme package, so the copy stays editable while results stay bound to live site data."
      }),
      search_1: section("search_results", {
        eyebrow: "Site search",
        title: "Search this AI photo storefront",
        emptyTitle: "No matching content yet.",
        emptyBody: "Try starter, pro, video, try-on, gala, privacy, uploads, or refunds.",
        resultLimit: 12
      }),
      packages_1: homeSections.packages_1,
      packages_strip_1: homeSections.packages_strip_1,
      conversion_1: homeSections.conversion_1
    },
    1
  ),
  cart: page(
    "cart",
    ["cart_intro_1", "cart_1", "pricing_1", "plan_rules_1", "conversion_1"],
    {
      cart_intro_1: section("rich_text", {
        eyebrow: "Cart",
        title: "Confirm the plan before checkout.",
        body: "The cart stays editable through the same theme system, while line items and prices are still read from live products."
      }),
      cart_1: section("cart_summary", {
        eyebrow: "Checkout summary",
        title: "Your selected DreamShootAI plan",
        subtitle: "Products, prices, credits, and checkout state are site-scoped. Credits are granted only after fulfilment.",
        emptyTitle: "Choose a plan first",
        emptyBody: "Open pricing to select a subscription or one-time credit pack.",
        returnLabel: "Back to pricing",
        returnHref: "/pricing"
      }),
      pricing_1: homeSections.pricing_1,
      plan_rules_1: homeSections.plan_rules_1,
      conversion_1: homeSections.conversion_1
    },
    1
  ),
  "404": page(
    "404",
    ["not_found_1", "packages_1", "packages_strip_1", "conversion_1"],
    {
      not_found_1: section("not_found", {
        eyebrow: "404",
        title: "This page is not available.",
        subtitle: "Send customers back to the pack wall, pricing, login, or the private workspace.",
        primaryCta: "Return home",
        primaryHref: "/",
        secondaryCta: "View packages",
        secondaryHref: "/collections"
      }),
      packages_1: homeSections.packages_1,
      packages_strip_1: homeSections.packages_strip_1,
      conversion_1: homeSections.conversion_1
    },
    1
  )
};

export const dreamshootAiStudioTemplateLabels: Record<DreamShootAiStudioTemplateKey, string> = {
  home: "Home",
  pricing: "Pricing",
  packages: "Photo Packages",
  tools: "Tools Directory",
  "package-detail": "Package Detail",
  "tool-detail": "AI Tool Detail",
  login: "Login",
  "app-home": "Customer Workspace",
  "job-progress": "Job Progress",
  "job-detail": "Job Detail",
  album: "Album",
  "account-billing": "Account Billing",
  help: "Help Center",
  policy: "Policy",
  "blog-list": "Blog List",
  "blog-detail": "Blog Detail",
  search: "Search",
  cart: "Cart",
  "404": "404"
};

export const dreamshootAiStudioSiteSettings: ThemePackageSiteSettings = {
  branding: {
    logoText: "DreamShootAI",
    market: "AI photo packages, personal AI models, free tools, credits, AI video, and private albums",
    description: "DreamShootAI is a premium AI photo subscription storefront for themed photo packages, personal AI models, free utility tools, AI video-ready outputs, and private gallery delivery."
  },
  themeSettings: {
    colors: {
      background: "#09090b",
      foreground: "#f5f1eb",
      accent: "#d7a36b",
      muted: "#17181d"
    },
    typography: {
      display: "Manrope",
      body: "Geist"
    },
    radii: {
      section: 20,
      control: 14
    },
    navigation: {
      headerLinks: [
        { label: "Photo Packages", href: "/collections" },
        { label: "Tools", href: "/tools" },
        { label: "How it works", href: "#workflow" },
        { label: "Pricing", href: "/pricing" },
        { label: "FAQ", href: "#faq" }
      ],
      footerLinks: [
        { label: "Privacy", href: "/policies/privacy", group: "support" },
        { label: "Refunds", href: "/policies/refunds", group: "support" },
        { label: "Content policy", href: "/policies/content", group: "support" },
        { label: "Help center", href: "/help", group: "support" },
        { label: "Guides", href: "/blog", group: "company" }
      ]
    },
    globalSections: {
      header: {
        settings: {
          title: "DreamShootAI",
          sticky: true,
          ctaLabel: "Start Making",
          ctaHref: "/login",
          style: "dark_pills",
          mobileLabel: "Menu"
        },
        blocks: [
          { id: "dreamshoot_header_packs", type: "menu_link", settings: { label: "Photo Packages", href: "/collections" } },
          { id: "dreamshoot_header_tools", type: "menu_link", settings: { label: "Tools", href: "/tools" } },
          { id: "dreamshoot_header_workflow", type: "menu_link", settings: { label: "How it works", href: "#workflow" } },
          { id: "dreamshoot_header_pricing", type: "menu_link", settings: { label: "Pricing", href: "/pricing" } },
          { id: "dreamshoot_header_faq", type: "menu_link", settings: { label: "FAQ", href: "#faq" } },
          ...dreamshootMegaTools
        ]
      },
      footer: {
        settings: {
          title: "DreamShootAI",
          tagline: "AI photo packages, personal models, free tools, credits, and private gallery delivery",
          body: "Transform everyday selfies into themed photo packages, headshots, World Cup fan photos, cyberpunk portraits, gala scenes, AI motion ideas, and virtual try-on previews from one subscription.",
          productHeading: "Explore",
          companyHeading: "Content",
          supportHeading: "Support",
          socialHeading: "Why it works",
          socialBody: "Private uploads, live pricing, predictable credits, and finished delivery inside one customer account.",
          bottomLine: "Monthly credits, one-time top-ups, and site-scoped galleries in one storefront.",
          copyright: "DreamShootAI demo. All rights reserved."
        },
        blocks: [
          { id: "dreamshoot_footer_pricing", type: "menu_link", settings: { label: "Pricing", href: "/pricing", group: "product" } },
          { id: "dreamshoot_footer_packs", type: "menu_link", settings: { label: "Packs", href: "/collections", group: "product" } },
          { id: "dreamshoot_footer_tools", type: "menu_link", settings: { label: "Free tools", href: "/tools", group: "product" } },
          { id: "dreamshoot_footer_tool", type: "menu_link", settings: { label: "Image studio", href: "/tools/image-studio", group: "product" } },
          { id: "dreamshoot_footer_help", type: "menu_link", settings: { label: "Help center", href: "/help", group: "support" } },
          { id: "dreamshoot_footer_privacy", type: "menu_link", settings: { label: "Privacy", href: "/policies/privacy", group: "support" } },
          { id: "dreamshoot_footer_refunds", type: "menu_link", settings: { label: "Refunds", href: "/policies/refunds", group: "support" } },
          { id: "dreamshoot_footer_guides", type: "menu_link", settings: { label: "Guides", href: "/blog", group: "company" } }
        ]
      }
    },
    seo: {
      siteTitle: "DreamShootAI",
      siteDescription: "AI photo package subscription with personal AI models, private uploads, free tools, AI video-ready outputs, and customer-only galleries.",
      titleTemplate: "%s | DreamShootAI",
      defaultOgImage: assets.hero
    },
    saasSettingsCurrent: {
      skin_bg: "#09090b",
      skin_title_color: "#f5f1eb",
      skin_text_color: "#cfc5bb",
      skin_price_color: "#d7a36b",
      skin_primary_btn_bg_color: "#f5f1eb",
      skin_primary_btn_text_color: "#111114",
      skin_secondary_btn_bg_color: "rgba(255,255,255,0.08)",
      skin_secondary_btn_text_color: "#f5f1eb",
      skin_title_font_family: "Manrope",
      skin_text_font_family: "Geist",
      general_layout_width: 1280,
      general_layout_spacing: 56,
      sections: {
        header_plus: {
          type: "header_plus",
          version: "1",
          card_name: "DreamShootAI header",
          settings: {
            is_announce_show: true,
            announce_title: "Create realistic AI photo packages from everyday uploads.",
            announce_color: "#ffffff",
            announce_bg_color: "#09090b"
          },
          blocks: []
        },
        footer_plus: {
          type: "footer_plus",
          version: "1",
          card_name: "DreamShootAI footer",
          settings: {
            footer_bg_color: "#111114",
            footer_text_color: "#d8d0c7"
          },
          blocks: []
        }
      }
    }
  }
};
