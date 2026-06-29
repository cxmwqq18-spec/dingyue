import type { SectionInstance, SectionType, ThemePageJson, ThemeSettingValue } from "@/lib/types";
import { dreamshootPublicSeoPageMetadata } from "@/lib/dreamshoot-seo-content";
import type { ThemePackageSiteSettings, ThemePackageTemplateKey } from "../types";

export type MydreamShootsAiStudioTemplateKey = ThemePackageTemplateKey | "tools" | "creators-circle" | "partner-registration" | "about-us" | "contact-us";

function section(type: SectionType, settings: SectionInstance["settings"], blocks: SectionInstance["blocks"] = []): SectionInstance {
  return { type, settings, blocks };
}

function block(id: string, type: string, settings: Record<string, ThemeSettingValue>) {
  return { id, type, settings };
}

function toolHref(slug: string) {
  return `/tools/${slug}`;
}

function page(pageType: string, sectionsOrder: string[], sections: ThemePageJson["sections"], version: number, seo?: ThemePageJson["seo"]): ThemePageJson {
  return {
    pageType,
    version,
    sectionsOrder,
    sections,
    ...(seo ? { seo } : {})
  };
}

function seoForPublicPage(path: keyof typeof dreamshootPublicSeoPageMetadata): ThemePageJson["seo"] {
  const metadata = dreamshootPublicSeoPageMetadata[path];
  return {
    title: metadata.title,
    description: metadata.description,
    keywords: metadata.keywords,
    canonicalPath: metadata.canonicalPath,
    robots: {
      index: metadata.index,
      follow: metadata.follow
    }
  };
}

function pickSections(source: ThemePageJson["sections"], order: string[]): ThemePageJson["sections"] {
  return Object.fromEntries(order.map((id) => [id, source[id]]).filter(([, section]) => Boolean(section))) as ThemePageJson["sections"];
}

const assets = {
  desiWeddingPack: "/assets/dreamshoot/generated/20260622-pack-fill/desi-wedding-pack.png",
  holidayTravelPack: "/assets/dreamshoot/generated/20260622-pack-fill/holiday-travel-pack.png",
  aiVideoAddonsPack: "/assets/dreamshoot/generated/20260622-pack-fill/ai-video-addons-pack.png",
  magicUpscalerPack: "/assets/dreamshoot/generated/20260622-pack-fill/magic-upscaler-pack.png",
  proofWorldcupGallery: "/assets/dreamshoot/generated/20260622-homepage-unique/proof-worldcup-gallery.png",
  catalogWorldcupCard: "/assets/dreamshoot/generated/20260622-homepage-unique/catalog-worldcup-card.png",
  catalogHeadshotCard: "/assets/dreamshoot/generated/20260622-homepage-unique/catalog-headshot-card.png",
  heroGridBusiness: "/assets/dreamshoot/generated/20260622-homepage-unique/hero-grid-business.png",
  heroGridBeauty: "/assets/dreamshoot/generated/20260622-homepage-unique/hero-grid-beauty.png",
  heroGridCyber: "/assets/dreamshoot/generated/20260622-homepage-unique/hero-grid-cyber.png",
  heroGridTravel: "/assets/dreamshoot/generated/20260622-homepage-unique/hero-grid-travel.png",
  heroGridSports: "/assets/dreamshoot/generated/20260622-homepage-unique/hero-grid-sports.png",
  heroGridGala: "/assets/dreamshoot/generated/20260622-homepage-unique/hero-grid-gala.png",
  heroGridAvatar: "/assets/dreamshoot/generated/20260622-homepage-unique/hero-grid-avatar.png",
  heroGridProduct: "/assets/dreamshoot/generated/20260622-homepage-unique/hero-grid-product.png",
  heroGridVideo: "/assets/dreamshoot/generated/20260622-homepage-unique/hero-grid-video.png",
  heroGridSocial: "/assets/dreamshoot/generated/20260622-homepage-unique/hero-grid-social.png",
  heroGridNoir: "/assets/dreamshoot/generated/20260622-homepage-unique/hero-grid-noir.png",
  heroGridUpscale: "/assets/dreamshoot/generated/20260622-homepage-unique/hero-grid-upscale.png",
  heroPackageWall: "/assets/dreamshoot/generated/20260622-homepage-unique/hero-package-wall.png",
  heroCreditStudioCard: "/assets/dreamshoot/generated/20260622-homepage-unique/hero-credit-studio-card.png",
  proofBusinessFounder: "/assets/dreamshoot/generated/20260622-homepage-unique/proof-business-founder.png",
  proofBeautyHair: "/assets/dreamshoot/generated/20260622-homepage-unique/proof-beauty-hair.png",
  proofCinematicWorlds: "/assets/dreamshoot/generated/20260622-homepage-unique/proof-cinematic-worlds.png",
  proofCoupleEngagement: "/assets/dreamshoot/generated/20260622-homepage-unique/proof-couple-engagement.png",
  catalogHairstyleCard: "/assets/dreamshoot/generated/20260622-homepage-unique/catalog-hairstyle-card.png",
  catalogGalaCard: "/assets/dreamshoot/generated/20260622-homepage-unique/catalog-gala-card.png",
  flowBeforeUpload: "/assets/dreamshoot/generated/20260622-homepage-unique/flow-before-upload.png",
  flowPrivateAlbumWorkspace: "/assets/dreamshoot/generated/20260622-homepage-unique/flow-private-album-workspace.png",
  pricingCreditsVisual: "/assets/dreamshoot/generated/20260622-homepage-unique/pricing-credits-visual.png",
  reviewAvaAvatar: "/assets/dreamshoot/generated/20260622-homepage-unique/review-ava-avatar.png",
  reviewAvaResultGala: "/assets/dreamshoot/generated/20260622-homepage-unique/review-ava-result-gala.png",
  reviewLucasAvatar: "/assets/dreamshoot/generated/20260622-homepage-unique/review-lucas-avatar.png",
  reviewLucasResultHeadshot: "/assets/dreamshoot/generated/20260622-homepage-unique/review-lucas-result-headshot.png",
  reviewMiaAvatar: "/assets/dreamshoot/generated/20260622-homepage-unique/review-mia-avatar.png",
  reviewMiaResultBeautySports: "/assets/dreamshoot/generated/20260622-homepage-unique/review-mia-result-beauty-sports.png",
  reviewNoahAvatar: "/assets/dreamshoot/generated/20260622-homepage-unique/review-noah-avatar.png",
  reviewNoahResultSocialCard: "/assets/dreamshoot/generated/20260622-homepage-unique/review-noah-result-social-card.png",
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
  worldCupFan: "/assets/dreamshoot/generated/20260621-worldcup-pack/stadium-portrait.png",
  worldCupFanAlt: "/assets/dreamshoot/generated/20260621-worldcup-pack/friend-fan-photos.png",
  worldCupStadiumPortrait: "/assets/dreamshoot/generated/20260621-worldcup-pack/stadium-portrait.png",
  worldCupFriendFans: "/assets/dreamshoot/generated/20260621-worldcup-pack/friend-fan-photos.png",
  worldCupAvatar: "/assets/dreamshoot/generated/20260621-worldcup-pack/match-day-avatar.png",
  worldCupFanPoster: "/assets/dreamshoot/generated/20260621-worldcup-pack/fan-poster.png",
  worldCupSocialStory: "/assets/dreamshoot/generated/20260621-worldcup-pack/social-story.png",
  worldCupBanner: "/assets/dreamshoot/generated/20260621-worldcup-pack/banner-cover.png",
  mafiaNoir: "/assets/dreamshoot/generated/20260619/mafia-noir-single-v1.png",
  beautyPortraitSvg: "/assets/dreamshoot/beauty-portrait.svg",
  tryOn: "/assets/dreamshoot/generated/20260618/hairstyle-preview-v1.png",
  upload: "/assets/dreamshoot/frames/faq-intro-portrait.png",
  selfie: "/assets/dreamshoot/frames/faq-intro-portrait.png",
  socialCard: "/assets/dreamshoot/holiday-card-gpt2.png",
  cyberpunkSample: "/assets/dreamshoot/generated/20260619/cyberpunk-solo-city-v1.png",
  sampleCyberpunk: "/assets/dreamshoot/frames/sample-cyberpunk.png",
  sampleGala: "/assets/dreamshoot/frames/sample-gala.png",
  engagement: "/assets/dreamshoot/frames/sample-engagement.png",
  weddingTrip: "/assets/dreamshoot/frames/sample-wedding-trip.png",
  weddingLook: "/assets/dreamshoot/frames/story-wedding-look.png",
  christmasCouple: "/assets/dreamshoot/frames/sample-christmas-couple.png",
  christmasSolo: "/assets/dreamshoot/generated/20260619/christmas-solo-card-v1.png",
  dateNight: "/assets/dreamshoot/generated/20260618/city-date-night-v1.png",
  holidayCard: "/assets/dreamshoot/holiday-card-gpt2.png",
  virtualLooks: "/assets/dreamshoot/frames/tab-virtual-looks.png"
} as const;

const dreamshootMegaTools = [
  block("mega_tool_headshot", "tool_card", { title: "Professional headshot maker", description: "Create clean profile portraits for resumes, teams, and founder pages.", category: "Photo AI", badge: "Profile", imageUrl: assets.headshotLifestyle, href: toolHref("headshot") }),
  block("mega_tool_creator", "tool_card", { title: "Creator portrait studio", description: "Generate creator-ready profile photos, channel visuals, and campaign portraits.", category: "Photo AI", badge: "Creator", imageUrl: assets.avatarPortrait, href: toolHref("creator-portrait") }),
  block("mega_tool_worldcup", "tool_card", { title: "World Cup fan photos", description: "Build stadium scenes, fan posters, and match-day profile images.", category: "Photo AI", badge: "Sports", imageUrl: assets.worldCupStadiumPortrait, href: toolHref("world-cup-fan-photos") }),
  block("mega_tool_cyberpunk", "tool_card", { title: "Cyberpunk portrait maker", description: "Turn source selfies into neon city portraits and dramatic future looks.", category: "Photo AI", badge: "Scene", imageUrl: assets.cyberpunk, href: toolHref("cyberpunk-portrait") }),
  block("mega_tool_gala", "tool_card", { title: "Gala photo maker", description: "Create formal night-out portraits with polished editorial lighting.", category: "Photo AI", badge: "Style", imageUrl: assets.mafiaNoir, href: toolHref("gala-photo") }),
  block("mega_tool_noir", "tool_card", { title: "Noir character portraits", description: "Generate cinematic mafia, detective, and vintage city character looks.", category: "Photo AI", badge: "Noir", imageUrl: assets.gala, href: toolHref("noir-portrait") }),
  block("mega_tool_anime", "tool_card", { title: "Anime avatar builder", description: "Create stylized profile avatars and character-inspired social images.", category: "Photo AI", badge: "Avatar", imageUrl: assets.beauty, href: toolHref("anime-avatar") }),
  block("mega_tool_nature", "tool_card", { title: "Nature adventure photos", description: "Place the customer in scenic outdoor, hiking, and travel-inspired scenes.", category: "Photo AI", badge: "Outdoor", imageUrl: assets.natureSolo, href: toolHref("nature-adventure") }),
  block("mega_tool_fashion", "tool_card", { title: "Fashion editorial set", description: "Create magazine-style outfit stories and polished personal-brand images.", category: "Photo AI", badge: "Editorial", imageUrl: assets.manPortrait, href: toolHref("fashion-editorial") }),
  block("mega_tool_product", "tool_card", { title: "Product lifestyle photos", description: "Preview creator product shots, social commerce visuals, and campaign scenes.", category: "Photo AI", badge: "Commerce", imageUrl: assets.upscaler, href: toolHref("product-lifestyle") }),
  block("mega_edit_background", "tool_card", { title: "Background changer", description: "Replace a plain selfie background before ordering a full photo package.", category: "AI Photo Edit", badge: "Studio", imageUrl: assets.cyberpunk, href: toolHref("background-changer") }),
  block("mega_edit_remove_bg", "tool_card", { title: "Background remover", description: "Cut out product or portrait backgrounds for cleaner source images.", category: "AI Photo Edit", badge: "Utility", imageUrl: assets.upload, href: toolHref("background-remover") }),
  block("mega_edit_magic_eraser", "tool_card", { title: "Magic eraser", description: "Remove small distractions from portraits, cards, and generated scenes.", category: "AI Photo Edit", badge: "Utility", imageUrl: assets.hairstyle, href: toolHref("magic-eraser") }),
  block("mega_edit_enhancer", "tool_card", { title: "Photo enhancer", description: "Improve low-light uploads before using them for private model training.", category: "AI Photo Edit", badge: "Studio", imageUrl: assets.headshot, href: toolHref("photo-enhancer") }),
  block("mega_edit_retouch", "tool_card", { title: "Portrait retouch", description: "Clean skin, flyaways, and lighting without changing the customer's identity.", category: "AI Photo Edit", badge: "Retouch", imageUrl: assets.womanPortrait, href: toolHref("portrait-retouch") }),
  block("mega_edit_unblur", "tool_card", { title: "Unblur image", description: "Rescue soft phone shots before they enter a paid generation workflow.", category: "AI Photo Edit", badge: "Utility", imageUrl: assets.headshotLifestyle, href: toolHref("unblur-image") }),
  block("mega_edit_color", "tool_card", { title: "Color correction", description: "Balance tones for profile photos, posters, and package previews.", category: "AI Photo Edit", badge: "Color", imageUrl: assets.manPortrait, href: toolHref("color-correction") }),
  block("mega_edit_restore", "tool_card", { title: "Old photo restoration", description: "Repair faded family photos and prepare them for private album delivery.", category: "AI Photo Edit", badge: "Restore", imageUrl: assets.beauty, href: toolHref("old-photo-restoration") }),
  block("mega_edit_prompt", "tool_card", { title: "Edit by prompt", description: "Describe a focused edit and preview it before spending package credits.", category: "AI Photo Edit", badge: "Prompt", imageUrl: assets.cyberpunkSample, href: toolHref("edit-by-prompt") }),
  block("mega_edit_upscale", "tool_card", { title: "Magic upscaler", description: "Preview higher-resolution delivery for finished photos and profile images.", category: "AI Photo Edit", badge: "HD", imageUrl: assets.upscaler, href: toolHref("magic-upscaler") }),
  block("mega_video_image", "tool_card", { title: "Image to video concept", description: "Turn a finished photo package image into a short motion concept.", category: "Video AI", badge: "Preview", imageUrl: assets.upscaler, href: toolHref("image-to-video") }),
  block("mega_video_profile", "tool_card", { title: "Profile clip maker", description: "Create social profile motion from headshots or creator portraits.", category: "Video AI", badge: "Social", imageUrl: assets.headshotLifestyle, href: toolHref("profile-clip") }),
  block("mega_video_fan", "tool_card", { title: "Fan poster motion", description: "Animate World Cup fan posters and match-day profile scenes.", category: "Video AI", badge: "Sports", imageUrl: assets.catalogWorldcupCard, href: toolHref("fan-poster-motion") }),
  block("mega_video_intro", "tool_card", { title: "Creator intro video", description: "Turn creator portraits into short intro clips for profiles and reels.", category: "Video AI", badge: "Creator", imageUrl: assets.avatarPortrait, href: toolHref("creator-intro-video") }),
  block("mega_video_product", "tool_card", { title: "Product teaser clip", description: "Create simple motion ideas for product-style package outputs.", category: "Video AI", badge: "Commerce", imageUrl: assets.upscaler, href: toolHref("product-teaser-clip") }),
  block("mega_video_avatar", "tool_card", { title: "Animated avatar preview", description: "Preview avatar-style motion concepts for profile campaigns.", category: "Video AI", badge: "Avatar", imageUrl: assets.beauty, href: toolHref("animated-avatar") }),
  block("mega_video_fashion", "tool_card", { title: "Fashion reel starter", description: "Create short reel concepts from editorial and try-on package outputs.", category: "Video AI", badge: "Style", imageUrl: assets.manPortrait, href: toolHref("fashion-reel") }),
  block("mega_video_album", "tool_card", { title: "Album story video", description: "Turn favorite generated images into a compact customer album story.", category: "Video AI", badge: "Album", imageUrl: assets.mafiaNoir, href: toolHref("album-story-video") })
];

const homeSections: ThemePageJson["sections"] = {
  hero_1: section(
    "hero",
    {
      anchor: "home",
      eyebrow: "",
      headline: "AI photo packages that feel like a real shoot",
      subheadline: "Upload selfies, build a private model, then buy photo packages with monthly credits.",
      imageUrl: assets.heroPackageWall,
      secondaryImageUrl: assets.heroCreditStudioCard,
      tertiaryImageUrl: assets.gala,
      heroGridImages: [assets.heroGridBusiness, assets.heroGridBeauty, assets.heroGridCyber, assets.heroGridTravel, assets.heroGridSports, assets.heroGridAvatar, assets.heroGridProduct, assets.heroGridVideo, assets.heroGridSocial, assets.heroGridNoir, assets.heroGridUpscale].join("|"),
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
      block("hero_cta_primary", "cta", { label: "Start a photo set", href: "/login", style: "primary" }),
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
  visual_proof_1: section(
    "dreamshoot_visual_proof",
    {
      anchor: "proof-gallery",
      label: "Visual proof gallery",
      title: "See what your selfies can become.",
      subtitle: "Show finished outcomes first: sports posters, clean headshots, cinematic portraits, style previews, and seasonal albums.",
      tabs: "All|Sports|Headshots|Beauty|Creative|Travel|Seasonal|Video",
      badges: "Private model|Album-ready|Full package catalog",
      primaryCta: "Start this pack",
      primaryHref: "/login"
    },
    [
      block("proof_worldcup", "proof_card", { title: "World Cup fan photos", description: "Stadium posters, match-day portraits, and fan profile scenes.", category: "Sports", badge: "Featured", imageUrl: assets.proofWorldcupGallery, href: "/collections/sports" }),
      block("proof_headshots", "proof_card", { title: "Professional headshots", description: "Clean founder, LinkedIn, resume, and team-ready portraits.", category: "Headshots", badge: "Business", imageUrl: assets.proofBusinessFounder, href: "/collections/headshots" }),
      block("proof_hairstyle", "proof_card", { title: "Hairstyle previews", description: "Preview hair direction, beauty styling, and polished profile looks.", category: "Beauty", badge: "Beauty", imageUrl: assets.proofBeautyHair, href: "/collections/beauty" }),
      block("proof_cyberpunk", "proof_card", { title: "Cinematic worlds", description: "Cyberpunk, noir, gala, and editorial scene concepts.", category: "Creative", badge: "Creative", imageUrl: assets.proofCinematicWorlds, href: "/collections/creative" }),
      block("proof_travel", "proof_card", { title: "Travel-style portraits", description: "Destination-inspired profile photos, vacation scenes, and cinematic outdoor looks.", category: "Travel", badge: "Travel", imageUrl: assets.proofCoupleEngagement, href: "/collections/travel" })
    ]
  ),
  featured_pack_1: section(
    "dreamshoot_featured_pack",
    {
      anchor: "featured-pack",
      label: "Featured seasonal pack",
      badge: "Match-day pack",
      title: "World Cup fan photos for match-day moments.",
      subtitle: "Turn everyday selfies into fan posters, stadium-style portraits, match-day avatars, and private albums built for social sharing.",
      primaryCta: "Create Fan Photos",
      primaryHref: "/login",
      secondaryCta: "View Sports Packs",
      secondaryHref: "/collections",
      photos: "40 photos",
      credits: "26 credits",
      privacy: "Private album",
      includedTitle: "Included outputs",
      includedOutputs: "Fan posters|Large portrait graphics for match day|Stadium portraits|Cinematic scenes with floodlights|Match-day avatars|Profile-ready square crops|Social banners|Wide cover images for sharing",
      safetyCopy: "Safe styling: no real player likenesses, official team logos, or protected marks required.",
      overlayTitle: "World Cup Pack",
      overlaySubtitle: "Match-day looks without a studio.",
      overlayChips: "fan poster|avatar|stadium|social-ready",
      bottomNote: "Seasonal packs rotate around tournaments, holidays, and high-intent photo moments.",
      campaignLabel: "Current campaign: World Cup Fan Photos",
      nextCampaignLabel: "Next: Valentine / Graduation Season"
    },
    [
      block("seasonal_worldcup_1", "seasonal_image", { label: "Stadium Portrait", meta: "Cinematic fan look", imageUrl: assets.worldCupStadiumPortrait, shape: "tall" }),
      block("seasonal_worldcup_2", "seasonal_image", { label: "Friend Fan Photos", meta: "Group-friendly shots", imageUrl: assets.worldCupFriendFans, shape: "wide" }),
      block("seasonal_worldcup_3", "seasonal_image", { label: "Match-day Avatar", meta: "Profile-ready crop", imageUrl: assets.worldCupAvatar, shape: "square" }),
      block("seasonal_worldcup_4", "seasonal_image", { label: "Fan Poster", meta: "Story and feed artwork", imageUrl: assets.worldCupFanPoster, shape: "tall" }),
      block("seasonal_worldcup_5", "seasonal_image", { label: "Social Story", meta: "Mobile-first layout", imageUrl: assets.worldCupSocialStory, shape: "tall" }),
      block("seasonal_worldcup_6", "seasonal_image", { label: "Banner / Cover", meta: "Wide campaign image", imageUrl: assets.worldCupBanner, shape: "wide" })
    ]
  ),
  package_catalog_1: section(
    "dreamshoot_package_catalog",
    {
      anchor: "packages",
      label: "Photo package catalog",
      title: "Choose a photo package first.",
      subtitle: "Each package has a clear result, photo count, credit cost, and one next action. The full directory is powered by active creative packs.",
      tabs: "All|Headshots|Beauty|Creative|Sports|Creator|Avatar|Travel|Cultural|Seasonal|Video|Utility",
      steps: "Pick pack|See credit cost|Generate album",
      source: "creative_packs",
      featuredCount: 5
    },
    [
      block("catalog_worldcup", "catalog_pack", { title: "World Cup fan photos", description: "Match-day portraits, fan posters, and stadium-inspired profile images.", category: "Sports", meta: "40 photos", credits: "26 credits", imageUrl: assets.catalogWorldcupCard, href: "/collections/world-cup-fan-photos" }),
      block("catalog_headshot", "catalog_pack", { title: "Professional Headshots", description: "LinkedIn, founder, resume, and team-ready portraits.", category: "Headshots", meta: "20 photos", credits: "20 credits", imageUrl: assets.catalogHeadshotCard, href: "/collections/headshots" }),
      block("catalog_cyberpunk", "catalog_pack", { title: "Cyberpunk", description: "Neon city portraits and future-fashion scenes.", category: "Creative", meta: "20 photos", credits: "26 credits", imageUrl: assets.cyberpunk, href: "/collections/cyberpunk" }),
      block("catalog_hairstyle", "catalog_pack", { title: "Hairstyle", description: "Preview hair directions, colors, and beauty styling before choosing a full image package.", category: "Beauty", meta: "20 photos", credits: "18 credits", imageUrl: assets.catalogHairstyleCard, href: "/collections/hairstyle" }),
      block("catalog_gala", "catalog_pack", { title: "Gala Photos", description: "Formal night-out photos with editorial lighting and red-carpet energy.", category: "Creative", meta: "20 photos", credits: "24 credits", imageUrl: assets.catalogGalaCard, href: "/collections/gala-photos" }),
      block("catalog_travel", "catalog_pack", { title: "Travel portrait pack", description: "Destination-style portraits, outdoor profile photos, and vacation-ready album images.", category: "Travel", meta: "24 photos", credits: "24 credits", imageUrl: assets.holidayTravelPack, href: "/collections/travel" })
    ]
  ),
  flow_bridge_1: section(
    "dreamshoot_flow_bridge",
    {
      anchor: "workflow",
      label: "How it works + proof bridge",
      title: "From upload to private album.",
      subtitle: "After customers see results and packages, explain upload safety, credit usage, generation status, and album delivery.",
      beforeImage: assets.flowBeforeUpload,
      afterImage: assets.hairstyle,
      albumImageOne: assets.flowPrivateAlbumWorkspace,
      albumImageTwo: assets.manPortrait,
      albumImageThree: assets.sampleCyberpunk,
      bridgeCta: "Choose a plan for your photo set",
      bridgeHref: "/pricing"
    },
    [
      block("flow_upload", "card", { title: "Upload selfies", text: "Add clear phone photos for the people in the album.", meta: "01" }),
      block("flow_model", "card", { title: "Build private model", text: "Keep identity consistent across packages and styles.", meta: "02" }),
      block("flow_pack", "card", { title: "Pick a package", text: "Choose the outcome first, then view the credit cost.", meta: "03" }),
      block("flow_album", "card", { title: "Generate album", text: "Download finished results from the private gallery.", meta: "04" })
    ]
  ),
  taxonomy_1: section(
    "dreamshoot_package_taxonomy",
    {
      anchor: "package-taxonomy",
      eyebrow: "Photo package library",
      title: "AI photo packages by style, use case, and delivery goal.",
      subtitle: "Compare AI headshots, hairstyle previews, World Cup fan photos, cyberpunk portraits, nature scenes, gala looks, creator portraits, and video add-ons before you spend credits.",
      layout: "editorial"
    },
    [
      block("taxonomy_headshot", "taxonomy_card", { title: "Professional headshots", description: "Profile photos for LinkedIn, founders, resumes, and teams.", meta: "Professional", keywords: "headshot|linkedin|resume", imageUrl: assets.manPortrait, href: "/collections/headshots" }),
      block("taxonomy_style", "taxonomy_card", { title: "Style and beauty", description: "Hairstyles, beauty portraits, virtual try-on, and polished creator looks.", meta: "Beauty", keywords: "hairstyle|beauty|virtual try-on", imageUrl: assets.womanPortrait, href: "/collections/beauty" }),
      block("taxonomy_worlds", "taxonomy_card", { title: "Cinematic worlds", description: "Cyberpunk, mafia, nature, travel, gala, and dramatic themed photos.", meta: "Creative", keywords: "cyberpunk|mafia|nature|gala", imageUrl: assets.cyberpunkSample, href: "/collections/creative" }),
      block("taxonomy_sports", "taxonomy_card", { title: "World Cup fan photos", description: "Stadium fan scenes, fan posters, and match-day profile photos.", meta: "Sports", keywords: "world cup photos|football fan photo|match day avatar", imageUrl: assets.worldCupStadiumPortrait, href: "/collections/sports" }),
      block("taxonomy_video", "taxonomy_card", { title: "AI video add-ons", description: "Turn finished package outputs into short social-friendly motion concepts.", meta: "Video", keywords: "image to video|motion|social", imageUrl: assets.upscaler, href: "/collections/video" }),
      block("taxonomy_creator", "taxonomy_card", { title: "Creator lifestyle", description: "Portfolio, creator, campaign, and personal-brand scenes for everyday buyers.", meta: "Creator", keywords: "creator portraits|portfolio|personal brand", imageUrl: assets.avatarPortrait, href: "/collections/creator" })
    ]
  ),
  sample_strip_1: section(
    "sample_strip",
    {
      anchor: "samples",
      eyebrow: "Popular photo outcomes",
      title: "A visual catalogue with clear package intent.",
      subtitle: "Each image points to a different buyer outcome, not a one-off text request gallery.",
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
    title: "AI photo packages for every profile, post, and private album.",
    subtitle: "Compare credit costs, source-photo requirements, private model needs, and delivery expectations before starting a headshot, sports, beauty, creator, travel, or cinematic portrait pack.",
    source: "creative_packs",
    layout: "editorial",
    maxCount: "32"
  }),
  packages_strip_1: section("feature_grid", {
    anchor: "package-path",
    eyebrow: "Why customers buy",
    title: "A clear path from upload to finished gallery.",
    subtitle: "Try utility tools first, choose a plan when you need premium generation, then receive finished images in a private MydreamShoots album.",
    source: "blocks",
    layout: "steps"
  }, [
    block("pkg_path_upload", "card", { title: "Upload", text: "Add clear selfies, portraits, and style references to your private MydreamShoots workspace.", meta: "Step 01", imageUrl: assets.upload }),
    block("pkg_path_preview", "card", { title: "Preview", text: "Use studio tools to preview the look before paying for the full package.", meta: "Step 02", imageUrl: assets.hairstyle }),
    block("pkg_path_pay", "card", { title: "Generate", text: "Use credits for the package you selected, with the cost shown before the request starts.", meta: "Step 03", imageUrl: assets.socialCard }),
    block("pkg_path_deliver", "card", { title: "Deliver", text: "Finished outputs return to the private album and stay tied to the account.", meta: "Step 04", imageUrl: assets.avatarPortrait })
  ]),
  feature_tabs_1: section(
    "dreamshoot_feature_tabs",
    {
      anchor: "tools",
      eyebrow: "What you can create",
      title: "Studio tools are the on-ramp.",
      subtitle: "Simple edits stay useful. Serious package work moves into login, credits, and private delivery.",
      layout: "split"
    },
    [
      block("tab_packages", "feature_tab", {
        label: "Photo packages",
        title: "Pick a finished outcome",
        description: "Start from a known package like headshots, World Cup fan photos, cyberpunk, gala, nature, beauty, creator, or product-style scenes instead of writing a blank prompt.",
        imageUrl: assets.worldCupFan,
        href: "/collections"
      }),
      block("tab_video", "feature_tab", {
        label: "AI video",
        title: "Turn package results into motion",
        description: "Convert favorite generated photos into short video ideas without leaving the same customer account.",
        imageUrl: assets.travelScene,
        href: toolHref("image-to-video")
      }),
      block("tab_tryon", "feature_tab", {
        label: "Try-on and style",
        title: "Preview looks before a full package",
        description: "Test hairstyle, wardrobe, beauty, or gala directions before spending credits on a premium pack.",
        imageUrl: assets.tryOn,
        href: toolHref("virtual-try-on")
      })
    ]
  ),
  free_tools_1: section(
    "dreamshoot_tool_collection",
    {
      anchor: "tools",
      eyebrow: "AI tools",
      title: "Paid AI photo tools for better source images.",
      subtitle: "Use background changes, image enhancement, portrait cleanup, upscaling, and video previews before moving into paid AI photo packages and private albums.",
      categories: "Photo AI|AI Photo Edit|Video AI",
      primaryCta: "Start a photo set",
      primaryHref: "/login",
      secondaryCta: "View all tools",
      secondaryHref: "/tools",
      layout: "mega_menu",
      headingLevel: "h1"
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
    { anchor: "trust", title: "Private uploads, clear credits, secure checkout, and customer-only galleries." },
    [
      block("trust_private", "stat", { value: "Private", label: "source photos and albums stay inside the signed-in customer account" }),
      block("trust_credits", "stat", { value: "History", label: "credits are granted, reserved, used, or returned with visible history" }),
      block("trust_model", "stat", { value: "Model", label: "premium packages use a private identity model instead of a one-off text request" }),
      block("trust_checkout", "stat", { value: "Checkout", label: "subscriptions and one-time credit packs use secure checkout" })
    ]
  ),
  plan_rules_1: section(
    "rich_text",
    {
      anchor: "plan-rules",
      eyebrow: "Plans and credits",
      title: "Studio tools preview. Credits generate.",
      body: "Paid plans unlock private model creation, package generation, credit history, and gallery delivery from one account.",
      imageUrl: assets.manPortrait,
      primaryCta: "Choose a plan",
      primaryHref: "/pricing",
      secondaryCta: "Try a photo tool",
      secondaryHref: "/tools",
      tone: "dark",
      layout: "commerce_intro"
    },
    [
      block("plan_rule_tools", "card", { meta: "studio entry", title: "Use utility tools first", description: "Background edits, previews, upscaling, and simple try-on flows explain the value before checkout." }),
      block("plan_rule_model", "card", { meta: "paid model", title: "Train a private identity model", description: "Advanced packages need a customer model so results can stay consistent across headshots, gala, travel, and style sets." }),
      block("plan_rule_credits", "card", { meta: "credit history", title: "Spend credits only when generating", description: "Credits are visible before a request starts and remain tied to subscription or one-time pack purchases." }),
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
    backgroundImage: assets.pricingCreditsVisual
  }),
  proof_1: section(
    "testimonial_wall",
    {
      anchor: "reviews",
      title: "Customer stories from AI photo package buyers.",
      subtitle: "Creators, job seekers, sports fans, and solo buyers use MydreamShoots to turn everyday photos into polished private albums.",
      summaryTitle: "Loved by creators, job seekers, and solo buyers",
      summaryBody: "The strongest proof is simple: ordinary input photos, believable output sets, clear credits, and no studio booking.",
      summaryRating: "4.9/5",
      summaryMeta: "Realistic customer stories for AI photo package buyers"
    },
    [
      block("review_ava", "testimonial", {
        quote: "I started with basic phone photos and the gala package gave us a complete night-out set without booking a photographer.",
        name: "Ava Mercer",
        role: "Gala package subscriber",
        location: "California, USA",
        rating: "5",
        avatarUrl: assets.reviewAvaAvatar,
        resultImageUrl: assets.reviewAvaResultGala
      }),
      block("review_lucas", "testimonial", {
        quote: "The headshot pack was more useful than booking a last-minute studio. Clear pricing, clear credits, great results.",
        name: "Lucas Bennett",
        role: "Founder",
        location: "Toronto, Canada",
        rating: "5",
        avatarUrl: assets.reviewLucasAvatar,
        resultImageUrl: assets.reviewLucasResultHeadshot
      }),
      block("review_mia", "testimonial", {
        quote: "The photo enhancer helped me choose the right inputs, then I used credits for beauty portraits and a World Cup fan set.",
        name: "Mia Collins",
        role: "Creator",
        location: "London, UK",
        rating: "5",
        avatarUrl: assets.reviewMiaAvatar,
        resultImageUrl: assets.reviewMiaResultBeautySports
      }),
      block("review_noah", "testimonial", {
        quote: "I used the Pro plan for headshots and social cards. The credit usage was clear before every generation.",
        name: "Noah Reed",
        role: "Job seeker",
        location: "Austin, USA",
        rating: "5",
        avatarUrl: assets.reviewNoahAvatar,
        resultImageUrl: assets.reviewNoahResultSocialCard
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
        quote: "I tried studio tools first, then upgraded when I needed a private model and a full travel scene pack.",
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
    block("proof_strip_private", "stat", { value: "Private", label: "uploads and albums stay in your private account" }),
    block("proof_strip_credits", "stat", { value: "Credits", label: "visible before each generation" }),
    block("proof_strip_model", "stat", { value: "Model", label: "personal identity model for premium packs" }),
    block("proof_strip_delivery", "stat", { value: "Gallery", label: "download-ready delivery after your photo set is ready" })
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
        question: "Do MydreamShoots tools require payment?",
        answer: "Yes. MydreamShoots tools, private model creation, and premium packs require paid credits because they consume dedicated generation capacity."
      }),
      block("faq_uploads", "faq_item", {
        question: "What photos should I upload?",
        answer: "Recent, clear, high-quality phone photos work best. Use different angles, expressions, lighting, and outfits so the private model has enough visual range."
      }),
      block("faq_private", "faq_item", {
        question: "Are my uploads private?",
        answer: "Yes. Source photos, generation jobs, albums, orders, and credits stay connected to your signed-in MydreamShoots account and are not public by default."
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
      title: "Open your private MydreamShoots studio.",
      subtitle: "Subscribe, upload, choose packages, generate results, and keep delivery in one workspace.",
      primaryCta: "Start a photo set",
      primaryHref: "/login",
      secondaryCta: "Choose a plan",
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
    body: "Choose a plan based on how often you need AI headshots, creator portraits, fan photos, image cleanup, video previews, and private gallery delivery.",
    headingLevel: "h1"
  }),
  package_hero_1: section("media_banner", {
    anchor: "package",
    eyebrow: "Photo package",
    title: "Choose a themed photo pack with a clear result before checkout.",
    subtitle: "See the style, source-photo needs, credit cost, and private album delivery flow before starting generation.",
    imageUrl: assets.headshotLifestyle,
    ctaLabel: "Browse packages",
    ctaHref: "/collections"
  }),
  package_before_after_1: section(
    "before_after_gallery",
    {
      anchor: "results",
      title: "Preview the transformation before spending credits.",
      subtitle: "Compare everyday source photos with the polished AI portraits, profile images, and campaign-ready scenes each package can produce."
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
    subtitle: "Upload source photos, choose a style, confirm credits, generate AI portraits, and collect the final set in your private gallery.",
    imageUrl: assets.gala,
    ctaLabel: "Upload photos",
    ctaHref: "/app"
  }),
  job_intro_1: section("rich_text", {
    eyebrow: "Job status",
    title: "Track every generation request from queue to delivery.",
    body: "Follow each AI photo job as it moves through upload review, credit reservation, generation, quality checks, and private album delivery."
  }),
  album_intro_1: section("media_banner", {
    anchor: "album",
    eyebrow: "Private gallery",
    title: "Delivered images stay inside a customer-only album.",
    subtitle: "Open finished AI headshots, creator portraits, fan photos, and style packs in one signed-in gallery with download access.",
    imageUrl: assets.headshotLifestyle,
    ctaLabel: "View my albums",
    ctaHref: "/app"
  }),
  billing_intro_1: section("rich_text", {
    eyebrow: "Account and billing",
    title: "Manage credits, plans, and one-time top-ups from one place.",
    body: "Review your active plan, remaining credits, top-up options, checkout history, and package usage before starting the next AI photo set."
  }),
  blog_intro_1: section("rich_text", {
    eyebrow: "Guides",
    title: "AI photo guides for better source photos and stronger results.",
    body: "Learn how to prepare selfies, choose lighting, compare photo packages, manage credits, protect private albums, and get cleaner AI portraits from each generation."
  }),
  blog_detail_1: section("rich_text", {
    eyebrow: "Guide",
    title: "How to prepare your best source photos for AI scenes",
    body: "Explain lighting, angles, expressions, clothing variety, privacy expectations, and how stronger source photos produce cleaner final packs.",
    headingLevel: "h1"
  }),
  creators_intro_1: section("rich_text", {
    eyebrow: "Creator channel",
    title: "Earn with AI photo stories your audience can actually try.",
    body: "MydreamShoots partners with creators, community builders, photographers, coaches, and niche publishers who can introduce private AI photo packages in a useful, trustworthy way. Share themed photo packs, prompt ideas, before-and-after stories, and seasonal campaign links while your audience keeps their uploads and albums inside their own account.",
    headingLevel: "h1",
    tone: "dark",
    imageUrl: assets.heroGridSocial,
    primaryCta: "Apply as a partner",
    primaryHref: "/partner-registration",
    secondaryCta: "Explore photo packages",
    secondaryHref: "/collections"
  }, [
    block("creator_intro_commission", "rich_text_card", { meta: "Channel", title: "Creator-ready campaigns", description: "Launch content around headshots, fan photos, gala portraits, avatars, and seasonal photo packs without building a photo product yourself." }),
    block("creator_intro_privacy", "rich_text_card", { meta: "Trust", title: "Private customer flow", description: "Followers sign in, upload, pay, generate, and download inside MydreamShoots, so you promote the experience without handling personal photos." }),
    block("creator_intro_assets", "rich_text_card", { meta: "Assets", title: "Content angles included", description: "Use ready-made page links, package themes, talking points, and social story ideas that match our visual catalog." }),
    block("creator_intro_measurement", "rich_text_card", { meta: "Growth", title: "Room for paid channels", description: "We can reserve specific partner routes for influencers, newsletter operators, paid media tests, and community collaborations." })
  ]),
  creators_fit_1: section("rich_text", {
    eyebrow: "Who fits",
    title: "Built for creators who explain style, identity, and transformation.",
    body: "The strongest partners show real use cases: a founder updating a profile photo, a fan making match-day images, a creator testing avatar styles, or a small team refreshing campaign visuals. We care more about audience fit, clear storytelling, and consistent publishing than raw follower count.",
    imageUrl: assets.proofBusinessFounder,
    primaryCta: "Start the application",
    primaryHref: "/partner-registration",
    secondaryCta: "View pricing",
    secondaryHref: "/pricing"
  }, [
    block("creator_fit_social", "rich_text_card", { meta: "Social", title: "Short-form creators", description: "Reels, TikTok, Shorts, and carousel creators who can demonstrate package ideas clearly." }),
    block("creator_fit_newsletter", "rich_text_card", { meta: "Community", title: "Newsletter and group owners", description: "Operators with engaged audiences around careers, sports fandom, personal branding, or creative tools." }),
    block("creator_fit_photo", "rich_text_card", { meta: "Studio", title: "Photographers and consultants", description: "Professionals who want an AI add-on for profile refreshes, mood boards, and campaign concepts." }),
    block("creator_fit_paid", "rich_text_card", { meta: "Media", title: "Performance partners", description: "Paid media, SEO, and affiliate teams that can test a dedicated channel with clean attribution." })
  ]),
  creators_steps_1: section("rich_text", {
    eyebrow: "How it works",
    title: "A simple path from application to live campaign.",
    body: "Tell us about your audience, preferred channels, publishing cadence, and the photo package angles you want to test. Approved partners receive a dedicated route, campaign notes, and a way to coordinate launch timing with the MydreamShoots team.",
    tone: "warm"
  }, [
    block("creator_step_apply", "rich_text_card", { meta: "01", title: "Apply", description: "Submit your creator profile, social links, audience notes, and the kind of campaign you want to run." }),
    block("creator_step_match", "rich_text_card", { meta: "02", title: "Match", description: "We review fit, confirm the channel, and suggest photo packages that make sense for your audience." }),
    block("creator_step_launch", "rich_text_card", { meta: "03", title: "Launch", description: "Publish with a partner route that sends customers to MydreamShoots packages, pricing, or a specific offer." }),
    block("creator_step_learn", "rich_text_card", { meta: "04", title: "Learn", description: "Track what resonates, refine the story, and plan follow-up drops around seasonal or niche photo themes." })
  ]),
  partner_form_1: section("rich_text", {
    eyebrow: "Partner application",
    title: "Apply for a reserved MydreamShoots promotion channel.",
    body: "Use this application to tell us who you reach, how you publish, and which MydreamShoots photo experiences would fit your audience. This page is prepared as the partner-registration destination so campaigns can route applicants directly here.",
    headingLevel: "h1",
    layout: "application_form",
    tone: "dark",
    imageUrl: assets.proofCinematicWorlds,
    primaryCta: "Email partnership details",
    primaryHref: "mailto:partners@mydreamshoots.com?subject=MydreamShoots%20partner%20application",
    secondaryCta: "Back to Creators Circle",
    secondaryHref: "/creators-circle"
  }, [
    block("partner_field_name", "form_field", { label: "Full name", placeholder: "Your name", fieldType: "text", required: true }),
    block("partner_field_email", "form_field", { label: "Email address", placeholder: "you@example.com", fieldType: "email", required: true }),
    block("partner_field_website", "form_field", { label: "Website", placeholder: "https://your-site.com", fieldType: "text", required: false }),
    block("partner_field_channels", "form_field", { label: "Primary channel links", placeholder: "Instagram, TikTok, YouTube, newsletter, website, or community links", fieldType: "textarea", required: true }),
    block("partner_field_audience", "form_field", { label: "Audience and niche", placeholder: "Tell us who follows you and why AI photo packages fit them.", fieldType: "textarea", required: true }),
    block("partner_field_cadence", "form_field", { label: "Publishing cadence", placeholder: "Weekly videos, newsletter drops, paid campaigns, community posts...", fieldType: "text", required: false }),
    block("partner_field_ideas", "form_field", { label: "Campaign ideas", placeholder: "Which packages, stories, or seasonal angles would you promote first?", fieldType: "textarea", required: false }),
    block("partner_field_terms", "form_field", { label: "I confirm that my promotions will respect privacy, platform rules, and truthful AI disclosure.", fieldType: "checkbox", required: true })
  ]),
  partner_expectations_1: section("rich_text", {
    eyebrow: "Before you submit",
    title: "What we look for in partner channels.",
    body: "Great applications are specific. Include real channel links, the audience problem you solve, the content format you prefer, and how you would explain private AI photo generation without overstating results.",
    imageUrl: assets.catalogHeadshotCard
  }, [
    block("partner_expectation_fit", "rich_text_card", { meta: "Audience", title: "Clear audience fit", description: "Career, creator, sports, fashion, beauty, event, or personal-brand communities usually map well to our package catalog." }),
    block("partner_expectation_quality", "rich_text_card", { meta: "Quality", title: "Helpful creative framing", description: "We prefer educational demos, honest results, and practical package examples over hype-only promotions." }),
    block("partner_expectation_compliance", "rich_text_card", { meta: "Rules", title: "Privacy and disclosure", description: "Partners should disclose AI use where appropriate and avoid collecting customer uploads outside MydreamShoots." }),
    block("partner_expectation_launch", "rich_text_card", { meta: "Launch", title: "A testable plan", description: "Share when you can publish, what format you will use, and which route or offer would make the campaign easy to measure." })
  ])
};

export const dreamshootAiStudioTemplates: Record<MydreamShootsAiStudioTemplateKey, ThemePageJson> = {
  home: page(
    "home",
    ["hero_1", "brand_strip_1", "visual_proof_1", "featured_pack_1", "package_catalog_1", "flow_bridge_1", "pricing_1", "proof_1", "faq_1", "trust_1", "conversion_1"],
    pickSections(homeSections, ["hero_1", "brand_strip_1", "visual_proof_1", "featured_pack_1", "package_catalog_1", "flow_bridge_1", "pricing_1", "proof_1", "faq_1", "trust_1", "conversion_1"]),
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
      entry_1: section("ai_tool_entry", { aiAppSlug: "image_generator", title: "AI image studio for scenes, looks, and polished final sets", subtitle: "Upload source photos, choose a scene style, confirm credits, and receive finished AI portraits in a private album.", ctaLabel: "Start this photo set", imageUrl: assets.gala }),
      upload_1: section("upload_panel", { title: "Private source photo upload", helper: "Upload clear portraits, selfies, and references that belong to you before starting an AI photo package.", imageUrl: assets.upload }),
      form_1: section("generation_form", { aiAppSlug: "image_generator", title: "Generate a scene pack", helper: "Choose the style, confirm the credit cost, and start a private generation request." }),
      progress_1: section("job_progress", { title: "Generation progress" }),
      album_1: section("album_gallery", { title: "Private AI photo album", showDownloads: true }),
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
          headingLevel: "h1",
          title: "Sign in to create, track, and download your AI photos",
          subtitle: "Upload source photos, reserve credits before generation, track requests, and download finished albums from one secure account.",
          emailPlaceholder: "you@example.com",
          buttonLabel: "Continue with email",
          actionHref: "/login",
          imageUrl: assets.headshotLifestyle,
          secondaryImageUrl: assets.casualPortrait,
          imageBadge: "Private uploads",
          imageCaption: "Every source photo, credit, and gallery stays attached to your private account."
        },
        [
          block("login_google", "login_method", { label: "Continue with Google", helper: "Fast sign-in for returning customers.", kind: "google", href: "/login" }),
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
    ["launcher_1", "form_1", "upload_1", "progress_1", "album_1"],
    {
      launcher_1: section("ai_feature_launcher", {
        anchor: "features",
        eyebrow: "Studio features",
        title: "Your private AI photo workspace.",
        subtitle: "Upload source photos, start AI headshot and portrait packages, track progress, manage credits, and download private albums from one signed-in area.",
        ctaLabel: "Choose a tool",
        ctaHref: "/app/create"
      }, [
        block("feature_prepare", "feature", { title: "Choose a tool", description: "Pick the photo workflow first, then attach the source photos it needs.", meta: "Tool first", href: "/app/create" }),
        block("feature_upload", "feature", { title: "Upload photos", description: "Collect selfies and source images inside a private customer workspace.", meta: "Private intake", href: "/app/upload" }),
        block("feature_progress", "feature", { title: "Track progress", description: "Show queued, creating, delivered, review-needed, and returned-credit states.", meta: "Live progress", href: "/app/jobs/progress" }),
        block("feature_album", "feature", { title: "Download albums", description: "Open delivered images and private gallery downloads for this account.", meta: "Private delivery", href: "/album" })
      ]),
      form_1: section("generation_form", { aiAppSlug: "image_generator", title: "Choose a photo tool", helper: "Pick a headshot, creator, fan photo, retouch, or scene workflow, then upload the source photos it needs." }),
      upload_1: section("upload_panel", { title: "Upload source photos", helper: "Upload only the source photos needed for the selected tool.", imageUrl: assets.upload }),
      progress_1: section("job_progress", { title: "Recent generation status" }),
      album_1: section("album_gallery", { title: "Generated albums", showDownloads: true })
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
        subtitle: "Review the selected AI photo job, generation status, delivered images, and related credit activity from your private account.",
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
      intro_1: section("rich_text", { eyebrow: "Help", title: "Help center", body: "Find practical answers about photo uploads, AI package selection, credits, billing, refunds, privacy, cookies, and private album delivery.", headingLevel: "h1" }),
      faq_1: homeSections.faq_1,
      plan_rules_1: homeSections.plan_rules_1
    },
    1
  ),
  policy: page(
    "policy",
    ["policy_1"],
    {
      policy_1: section("policy_content", {
        title: "MydreamShoots policy details",
        body: "<p>MydreamShoots policy pages cover customer account access, photo upload rights, private album delivery, credit usage, checkout records, refund review, content moderation, cookies, and privacy controls for AI photo customers.</p><p>Use the dedicated refund, content, privacy, terms, and cookie pages to review the rules that apply before uploading source photos, starting a generation job, buying credits, or downloading finished portraits.</p>"
      })
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
      blog_list_1: section("blog_list", { title: "Related guides", body: "Read more about source photos, private models, credit usage, photo package planning, and album delivery.", guideType: "AI photo guide", headingLevel: "h2" }),
      conversion_1: homeSections.conversion_1
    },
    1
  ),
  "creators-circle": page(
    "content",
    ["creators_intro_1", "creators_fit_1", "creators_steps_1", "pricing_1", "conversion_1"],
    {
      creators_intro_1: templateSections.creators_intro_1,
      creators_fit_1: templateSections.creators_fit_1,
      creators_steps_1: templateSections.creators_steps_1,
      pricing_1: homeSections.pricing_1,
      conversion_1: homeSections.conversion_1
    },
    1,
    seoForPublicPage("/creators-circle")
  ),
  "partner-registration": page(
    "content",
    ["partner_form_1", "partner_expectations_1", "trust_1", "conversion_1"],
    {
      partner_form_1: templateSections.partner_form_1,
      partner_expectations_1: templateSections.partner_expectations_1,
      trust_1: homeSections.trust_1,
      conversion_1: homeSections.conversion_1
    },
    1,
    seoForPublicPage("/partner-registration")
  ),
  "about-us": page(
    "content",
    ["about_intro_1", "about_values_1", "trust_1", "conversion_1"],
    {
      about_intro_1: section("rich_text", {
        eyebrow: "About MyDreamShoots",
        title: "Private AI photo packages with clear credits and real customer delivery.",
        body: "MyDreamShoots helps customers turn everyday selfies into themed AI photo packages, professional headshots, creator portraits, beauty edits, travel scenes, and private albums without booking a studio session. Every order is built around a signed-in account, visible credit use, secure checkout, and customer-only gallery access.",
        headingLevel: "h1",
        tone: "dark",
        imageUrl: assets.heroPackageWall,
        primaryCta: "Explore photo packages",
        primaryHref: "/collections",
        secondaryCta: "Contact us",
        secondaryHref: "/contact-us"
      }, [
        block("about_private", "rich_text_card", { meta: "Private", title: "Customer-only workspace", description: "Uploads, generations, credit history, and albums stay connected to the customer's signed-in account." }),
        block("about_packages", "rich_text_card", { meta: "Packages", title: "Outcome-first catalog", description: "Customers choose a finished photo direction first, then see the credit cost before generation starts." }),
        block("about_delivery", "rich_text_card", { meta: "Delivery", title: "Album-ready results", description: "Finished images return to a private gallery for review, download, and reuse." })
      ]),
      about_values_1: section("rich_text", {
        eyebrow: "How we work",
        title: "A practical photo workspace for customers who want control.",
        body: "Our goal is simple: make AI photo creation feel organized, private, and understandable. MyDreamShoots focuses on clear package choices, realistic expectations, account-scoped delivery, and responsive support for questions about uploads, credits, checkout, privacy, and finished albums.",
        imageUrl: assets.flowPrivateAlbumWorkspace,
        primaryCta: "View pricing",
        primaryHref: "/pricing",
        secondaryCta: "Help center",
        secondaryHref: "/help"
      }, [
        block("about_value_transparency", "rich_text_card", { meta: "01", title: "Clear credit use", description: "Credit reservations, successful generations, returned credits, and billing events are visible in the customer account." }),
        block("about_value_support", "rich_text_card", { meta: "02", title: "Supportable workflow", description: "Customers can contact support for account, billing, privacy, upload, or album questions." }),
        block("about_value_safety", "rich_text_card", { meta: "03", title: "Respect for source photos", description: "Source photos should belong to the customer or be used with permission, and policy pages explain the rules before upload." })
      ]),
      trust_1: homeSections.trust_1,
      conversion_1: homeSections.conversion_1
    },
    1,
    seoForPublicPage("/about-us")
  ),
  "contact-us": page(
    "content",
    ["contact_intro_1", "contact_details_1", "faq_1", "conversion_1"],
    {
      contact_intro_1: section("rich_text", {
        eyebrow: "Contact us",
        title: "Contact MyDreamShoots support or sales.",
        body: "Reach MyDreamShoots for account help, billing review, AI photo package questions, private album support, privacy requests, business inquiries, or sales conversations.",
        headingLevel: "h1",
        tone: "dark",
        imageUrl: assets.catalogHeadshotCard,
        primaryCta: "Email support",
        primaryHref: "mailto:support@mydreamshoots.com",
        secondaryCta: "Email sales",
        secondaryHref: "mailto:sales@mydreamshoots.com"
      }, [
        block("contact_support", "rich_text_card", { meta: "Support", title: "support@mydreamshoots.com", description: "For account access, billing review, credit questions, upload help, privacy requests, and delivered album support." }),
        block("contact_sales", "rich_text_card", { meta: "Sales", title: "sales@mydreamshoots.com", description: "For plan questions, creator or team use cases, campaign planning, and business inquiries." }),
        block("contact_address", "rich_text_card", { meta: "Address", title: "8 THE GREEN STE B, DOVER, DE 19901", description: "Company mailing address for MyDreamShoots business correspondence." })
      ]),
      contact_details_1: section("policy_content", {
        title: "Contact information",
        headingLevel: "h2",
        lastUpdated: "June 28, 2026",
        contactEmail: "support@mydreamshoots.com",
        body: "<h3>Support</h3><p>Email <a href=\"mailto:support@mydreamshoots.com\">support@mydreamshoots.com</a> for account access, upload guidance, billing review, refunds, privacy requests, policy questions, credit history, generation status, or private album delivery help.</p><h3>Sales</h3><p>Email <a href=\"mailto:sales@mydreamshoots.com\">sales@mydreamshoots.com</a> for plan questions, business use, creator collaborations, team workflows, or campaign planning.</p><h3>Company address</h3><p>8 THE GREEN STE B, DOVER, DE 19901</p><h3>What to include</h3><p>For faster support, include the email address on your MyDreamShoots account, the page or package involved, order or checkout details if relevant, and a short description of what you need reviewed.</p>"
      }),
      faq_1: homeSections.faq_1,
      conversion_1: homeSections.conversion_1
    },
    1,
    seoForPublicPage("/contact-us")
  ),
  search: page(
    "search",
    ["search_intro_1", "search_1", "packages_1", "packages_strip_1", "conversion_1"],
    {
      search_intro_1: section("rich_text", {
        eyebrow: "Search",
        title: "Search tools, packs, pricing, and policies.",
        body: "Find AI headshots, creator portraits, World Cup fan photos, background changer tools, credit plans, privacy details, refund information, and upload guidance.",
        headingLevel: "h1"
      }),
      search_1: section("search_results", {
        eyebrow: "Site search",
        title: "Search MydreamShoots AI photo tools and packages",
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
        body: "Review your selected subscription or credit pack, confirm the included credits, and continue to checkout before starting premium AI photo generation.",
        headingLevel: "h1"
      }),
      cart_1: section("cart_summary", {
        eyebrow: "Checkout summary",
        title: "Your selected MydreamShoots plan",
        subtitle: "Your selected plan, credit amount, and checkout status stay connected to your MydreamShoots account. Credits are added after payment confirmation.",
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
        subtitle: "Return to AI photo packages, pricing, sign-in, or your private MydreamShoots workspace.",
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

export const dreamshootAiStudioTemplateLabels: Record<MydreamShootsAiStudioTemplateKey, string> = {
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
  "creators-circle": "Creators Circle",
  "partner-registration": "Partner Registration",
  "about-us": "About Us",
  "contact-us": "Contact Us",
  search: "Search",
  cart: "Cart",
  "404": "404"
};

export const dreamshootAiStudioSiteSettings: ThemePackageSiteSettings = {
  branding: {
    logoText: "MyDreamShoots",
    market: "AI photo packages, personal AI models, paid tools, credits, AI video, and private albums",
    description: "MyDreamShoots is a premium AI photo workspace for themed photo packages, personal AI models, paid utility tools, AI video-ready outputs, and private gallery delivery."
  },
  themeSettings: {
    colors: {
      background: "#05070E",
      foreground: "#F8FAFC",
      accent: "#EC4BDD",
      muted: "#10111A"
    },
    typography: {
      display: "var(--font-display-ui), var(--font-sans-ui), Helvetica Neue, ui-sans-serif, system-ui, sans-serif",
      body: "var(--font-sans-ui), Helvetica Neue, ui-sans-serif, system-ui, sans-serif"
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
        { label: "Privacy Policy", href: "/privacy", group: "support" },
        { label: "Terms of Service", href: "/terms", group: "support" },
        { label: "Cookie Policy", href: "/cookies", group: "support" },
        { label: "Refunds", href: "/refunds", group: "support" },
        { label: "Content policy", href: "/content", group: "support" },
        { label: "Help center", href: "/help", group: "support" },
        { label: "About us", href: "/about-us", group: "company" },
        { label: "Contact us", href: "/contact-us", group: "company" },
        { label: "Creators Circle", href: "/creators-circle", group: "company" },
        { label: "Guides", href: "/blog", group: "company" }
      ]
    },
    globalSections: {
      header: {
        settings: {
          title: "MyDreamShoots",
          sticky: true,
          ctaLabel: "Start a photo set",
          ctaHref: "/login",
          style: "dark_pills",
          mobileLabel: "Menu",
          logoImageUrl: "/assets/dreamshoot/brand/dreamshootai-logo-refined.svg?v=20260621b",
          logoAlt: "MyDreamShoots heart camera logo"
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
          title: "MyDreamShoots",
          tagline: "AI photo packages, personal models, paid tools, credits, and private gallery delivery",
          body: "Transform everyday selfies into themed photo packages, headshots, World Cup fan photos, cyberpunk portraits, gala scenes, AI motion ideas, and virtual try-on previews from one subscription.",
          productHeading: "Explore",
          companyHeading: "Content",
          supportHeading: "Support",
          socialHeading: "Why it works",
          socialBody: "Private uploads, live pricing, predictable credits, and finished delivery inside one customer account.",
          contactAddress: "8 THE GREEN STE B, DOVER, DE 19901",
          contactEmail: "support@mydreamshoots.com",
          salesEmail: "sales@mydreamshoots.com",
          bottomLine: "Monthly credits, one-time top-ups, and private galleries in one photo workspace.",
          copyright: "© 2026 MyDreamShoots. All rights reserved."
        },
        blocks: [
          { id: "dreamshoot_footer_pricing", type: "menu_link", settings: { label: "Pricing", href: "/pricing", group: "product" } },
          { id: "dreamshoot_footer_packs", type: "menu_link", settings: { label: "Packs", href: "/collections", group: "product" } },
          { id: "dreamshoot_footer_tools", type: "menu_link", settings: { label: "Tools", href: "/tools", group: "product" } },
          { id: "dreamshoot_footer_tool", type: "menu_link", settings: { label: "Image studio", href: toolHref("ai-image-studio"), group: "product" } },
          { id: "dreamshoot_footer_help", type: "menu_link", settings: { label: "Help center", href: "/help", group: "support" } },
          { id: "dreamshoot_footer_privacy", type: "menu_link", settings: { label: "Privacy Policy", href: "/privacy", group: "support" } },
          { id: "dreamshoot_footer_terms", type: "menu_link", settings: { label: "Terms of Service", href: "/terms", group: "support" } },
          { id: "dreamshoot_footer_cookies", type: "menu_link", settings: { label: "Cookie Policy", href: "/cookies", group: "support" } },
          { id: "dreamshoot_footer_refunds", type: "menu_link", settings: { label: "Refunds", href: "/refunds", group: "support" } },
          { id: "dreamshoot_footer_content", type: "menu_link", settings: { label: "Content policy", href: "/content", group: "support" } },
          { id: "dreamshoot_footer_about", type: "menu_link", settings: { label: "About us", href: "/about-us", group: "company" } },
          { id: "dreamshoot_footer_contact", type: "menu_link", settings: { label: "Contact us", href: "/contact-us", group: "company" } },
          { id: "dreamshoot_footer_creators", type: "menu_link", settings: { label: "Creators Circle", href: "/creators-circle", group: "company" } },
          { id: "dreamshoot_footer_guides", type: "menu_link", settings: { label: "Guides", href: "/blog", group: "company" } }
        ]
      }
    },
    seo: {
      siteTitle: "MyDreamShoots",
      siteDescription: "AI photo package subscription with personal AI models, private uploads, paid tools, AI video-ready outputs, and customer-only galleries.",
      siteKeywords: "MyDreamShoots, AI photo packages, AI portraits, personal AI model, private photo gallery, AI photo subscription",
      titleTemplate: "%s | MyDreamShoots",
      defaultOgImage: assets.hero
    },
    saasSettingsCurrent: {
      skin_bg: "#05070E",
      skin_title_color: "#F8FAFC",
      skin_text_color: "#CDD2E1",
      skin_price_color: "#FFA644",
      skin_primary_btn_bg_color: "linear-gradient(90deg,#FFA644 0%,#EC4BDD 38%,#7A4CFF 68%,#16DCF0 100%)",
      skin_primary_btn_text_color: "#FFFFFF",
      skin_secondary_btn_bg_color: "rgba(18,18,28,0.72)",
      skin_secondary_btn_text_color: "#F8FAFC",
      skin_title_font_family: "var(--font-display-ui), var(--font-sans-ui), Helvetica Neue, ui-sans-serif, system-ui, sans-serif",
      skin_text_font_family: "var(--font-sans-ui), Helvetica Neue, ui-sans-serif, system-ui, sans-serif",
      general_layout_width: 1280,
      general_layout_spacing: 56,
      sections: {
        header_plus: {
          type: "header_plus",
          version: "1",
          card_name: "MydreamShoots header",
          settings: {
            is_announce_show: true,
            announce_title: "Create realistic AI photo packages from everyday uploads.",
            announce_color: "#ffffff",
            announce_bg_color: "#05070E"
          },
          blocks: []
        },
        footer_plus: {
          type: "footer_plus",
          version: "1",
          card_name: "MydreamShoots footer",
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
