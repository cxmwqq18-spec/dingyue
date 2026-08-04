import type { SectionInstance, SectionType, ThemePageJson, ThemeSettingValue } from "@/lib/types";
import { getDreamshootPublicSeoPageMetadataForSite } from "@/lib/dreamshoot-seo-content";
import type { ThemePackageSiteSettings, ThemePackageTemplateKey } from "../types";

export type MydreamShootsAiStudioTemplateKey = ThemePackageTemplateKey | "tools" | "workflow" | "help" | "creators-circle" | "partner-registration" | "about-us" | "contact-us";

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

type DreamshootPublicSeoSiteSeed = Parameters<typeof getDreamshootPublicSeoPageMetadataForSite>[0];
type DreamshootPublicSeoPath = "/creators-circle" | "/partner-registration" | "/about-us" | "/contact-us";

function seoForPublicPage(path: DreamshootPublicSeoPath, site?: DreamshootPublicSeoSiteSeed): ThemePageJson["seo"] {
  const metadata = getDreamshootPublicSeoPageMetadataForSite(site, path);
  if (!metadata) return undefined;
  return {
    title: metadata.title,
    description: metadata.description,
    canonicalPath: metadata.canonicalPath,
    robots: {
      index: metadata.index,
      follow: metadata.follow
    }
  };
}

function isAidreamcapesTemplateSite(site?: DreamshootPublicSeoSiteSeed): boolean {
  return /aidreamcapes/i.test(`${site?.slug ?? ""} ${site?.name ?? ""} ${site?.primaryDomain ?? ""} ${site?.branding?.logoText ?? ""}`);
}

const storefrontAssetVersion = "20260801visualfix1";

function versionedAsset(pathname: string) {
  return `${pathname}?v=${storefrontAssetVersion}`;
}

const assets = {
  desiWeddingPack: "/assets/dreamshoot/generated/20260622-pack-fill/desi-wedding-pack.png",
  holidayTravelPack: "/assets/dreamshoot/generated/20260622-pack-fill/holiday-travel-pack.png",
  aiVideoAddonsPack: "/assets/dreamshoot/generated/20260622-pack-fill/ai-video-addons-pack.png",
  magicUpscalerPack: "/assets/dreamshoot/generated/20260622-pack-fill/magic-upscaler-pack.png",
  galleryWorldCupFanOne: "/assets/dreamshoot/generated/pack-galleries/world-cup-fan-photos/world-cup-fan-photos-01.webp",
  galleryWorldCupFanTwo: "/assets/dreamshoot/generated/pack-galleries/world-cup-fan-photos/world-cup-fan-photos-02.webp",
  galleryWorldCupFanThree: "/assets/dreamshoot/generated/pack-galleries/world-cup-fan-photos/world-cup-fan-photos-03.webp",
  galleryWorldCupFanFour: "/assets/dreamshoot/generated/pack-galleries/world-cup-fan-photos/world-cup-fan-photos-04.webp",
  galleryGalaOne: "/assets/dreamshoot/generated/pack-galleries/gala-photos/gala-photos-01.webp",
  galleryGalaTwo: "/assets/dreamshoot/generated/pack-galleries/gala-photos/gala-photos-02.webp",
  galleryChristmasPhotosOne: "/assets/dreamshoot/generated/pack-galleries/christmas-photos/christmas-photos-01.webp",
  galleryChristmasPhotosTwo: "/assets/dreamshoot/generated/pack-galleries/christmas-photos/christmas-photos-02.webp",
  galleryChristmasPhotosThree: "/assets/dreamshoot/generated/pack-galleries/christmas-photos/christmas-photos-03.webp",
  galleryChristmasPhotosFour: "/assets/dreamshoot/generated/pack-galleries/christmas-photos/christmas-photos-04.webp",
  galleryChristmasPhotosFive: "/assets/dreamshoot/generated/pack-galleries/christmas-photos/christmas-photos-05.webp",
  galleryChristmasCoupleOne: "/assets/dreamshoot/generated/pack-galleries/christmas-couple/christmas-couple-01.webp",
  galleryChristmasCoupleTwo: "/assets/dreamshoot/generated/pack-galleries/christmas-couple/christmas-couple-02.webp",
  galleryChristmasCoupleThree: "/assets/dreamshoot/generated/pack-galleries/christmas-couple/christmas-couple-03.webp",
  galleryChristmasCover: versionedAsset("/assets/dreamshoot/generated/pack-covers/christmas-photos/christmas-photos-cover.webp"),
  gallerySeasonalFallback: "/assets/dreamshoot/generated/pack-covers/holiday/holiday-cover.webp?v=20260803safecover1",
  galleryHolidayFallback: "/assets/dreamshoot/generated/pack-covers/holiday/holiday-cover.webp?v=20260803safecover1",
  galleryThanksgivingOne: "/assets/dreamshoot/generated/pack-galleries/thanksgiving-group-photos/thanksgiving-group-photos-01.webp",
  galleryThanksgivingTwo: "/assets/dreamshoot/generated/pack-galleries/thanksgiving-group-photos/thanksgiving-group-photos-02.webp",
  galleryThanksgivingThree: "/assets/dreamshoot/generated/pack-galleries/thanksgiving-group-photos/thanksgiving-group-photos-03.webp",
  galleryThanksgivingFour: "/assets/dreamshoot/generated/pack-galleries/thanksgiving-group-photos/thanksgiving-group-photos-04.webp",
  galleryThanksgivingFallback: versionedAsset("/assets/dreamshoot/generated/pack-covers/thanksgiving-group-photos/thanksgiving-group-photos-cover.webp"),
  galleryHalloweenFallback: "/assets/dreamshoot/generated/pack-covers/halloween-party-photos/halloween-party-photos-cover.webp?v=20260803safecover1",
  galleryCreatorOne: "/assets/dreamshoot/generated/pack-galleries/creator-portraits/creator-portraits-01.webp",
  galleryCreatorTwo: "/assets/dreamshoot/generated/pack-galleries/creator-portraits/creator-portraits-02.webp",
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
  block("mega_tool_headshot", "tool_card", { title: "Professional headshot maker", description: "Input: clear selfies or portraits you own or have permission to use. Output: private profile-ready headshot options. Best for: LinkedIn, resumes, founder bios, speaker pages, and team profiles. Cost: credits are shown before generation.", category: "Photo AI", badge: "Profile", imageUrl: assets.catalogHeadshotCard, href: toolHref("headshot") }),
  block("mega_tool_creator", "tool_card", { title: "Creator portrait studio", description: "Input: source portraits and creator references you own or can use. Output: private creator portraits for profiles, media kits, newsletters, and thumbnails. Best for: refreshing a public creator presence. Cost: credits are shown before generation.", category: "Photo AI", badge: "Creator", imageUrl: assets.heroGridSocial, href: toolHref("creator-portrait") }),
  block("mega_tool_worldcup", "tool_card", { title: "World Cup fan photos", description: "Input: your own selfies for personal fan use. Output: private fan portraits, posters, and profile avatars. Best for: match-day social posts without official marks, logos, or player likenesses. Cost: credits are shown before generation.", category: "Photo AI", badge: "Sports", imageUrl: assets.worldCupStadiumPortrait, href: toolHref("world-cup-fan-photos") }),
  block("mega_tool_cyberpunk", "tool_card", { title: "Cyberpunk portrait maker", description: "Input: a clear portrait you own or have permission to use. Output: private neon city portrait crops. Best for: cinematic profile images and poster-style scenes. Cost: credits are shown before generation.", category: "Photo AI", badge: "Scene", imageUrl: assets.heroGridCyber, href: toolHref("cyberpunk-portrait") }),
  block("mega_tool_gala", "tool_card", { title: "Gala photo maker", description: "Input: clear portraits and style direction you own or can use. Output: private formal evening portrait options. Best for: event-inspired profile images and polished album looks. Cost: credits are shown before generation.", category: "Photo AI", badge: "Style", imageUrl: assets.heroGridGala, href: toolHref("gala-photo") }),
  block("mega_tool_noir", "tool_card", { title: "Noir character portraits", description: "Input: your own portrait with character direction. Output: private noir-style character portraits. Best for: dramatic profile concepts and creative scenes. Cost: credits are shown before generation.", category: "Photo AI", badge: "Noir", imageUrl: assets.heroGridNoir, href: toolHref("noir-portrait") }),
  block("mega_tool_anime", "tool_card", { title: "Anime avatar builder", description: "Input: your own portrait or avatar reference. Output: private stylized avatar concepts. Best for: profile updates, fan communities, and playful identity ideas. Cost: credits are shown before generation.", category: "Photo AI", badge: "Avatar", imageUrl: assets.heroGridAvatar, href: toolHref("anime-avatar") }),
  block("mega_tool_nature", "tool_card", { title: "Nature adventure photos", description: "Input: your own portrait and outdoor mood direction. Output: private nature and adventure portrait scenes. Best for: outdoor creator profiles and lifestyle albums. Cost: credits are shown before generation.", category: "Photo AI", badge: "Outdoor", imageUrl: assets.natureSolo, href: toolHref("nature-adventure") }),
  block("mega_tool_fashion", "tool_card", { title: "Fashion editorial set", description: "Input: your own photo and style references. Output: private fashion editorial and visual try-on previews. Best for: outfit direction, creator looks, and adult consensual non-explicit styling. Cost: credits are shown before generation.", category: "Photo AI", badge: "Editorial", imageUrl: assets.manPortrait, href: toolHref("fashion-editorial") }),
  block("mega_tool_product", "tool_card", { title: "Product lifestyle photos", description: "Input: product or creator reference images you own or can use. Output: private product-style lifestyle image concepts. Best for: campaign drafts, social commerce visuals, and creator product scenes. Cost: credits are shown before generation.", category: "Photo AI", badge: "Commerce", imageUrl: assets.heroGridProduct, href: toolHref("product-lifestyle") }),
  block("mega_edit_background", "tool_card", { title: "Background changer", description: "Input: one portrait or product photo you own or can edit. Output: a private image with a cleaner replacement background. Best for: preparing source photos before a full package. Cost: credits are shown before paid edits.", category: "AI Photo Edit", badge: "Studio", imageUrl: assets.sampleCyberpunk, href: toolHref("background-changer") }),
  block("mega_edit_remove_bg", "tool_card", { title: "Background remover", description: "Input: one image you own or have permission to edit. Output: a private cutout or cleaner source image. Best for: profile, listing, and package-prep images. Cost: credits are shown before paid edits.", category: "AI Photo Edit", badge: "Utility", imageUrl: assets.upload, href: toolHref("background-remover") }),
  block("mega_edit_magic_eraser", "tool_card", { title: "Magic eraser", description: "Input: one photo you own or have permission to edit. Output: a private image with small distractions removed. Best for: cleaning portraits, cards, and generated scenes without misleading claims. Cost: credits are shown before paid edits.", category: "AI Photo Edit", badge: "Utility", imageUrl: assets.hairstyle, href: toolHref("magic-eraser") }),
  block("mega_edit_enhancer", "tool_card", { title: "Photo enhancer", description: "Input: a low-light or soft photo you own. Output: a private enhanced source image. Best for: improving uploads before premium generation. Cost: credits are shown before paid edits.", category: "AI Photo Edit", badge: "Studio", imageUrl: assets.headshot, href: toolHref("photo-enhancer") }),
  block("mega_edit_retouch", "tool_card", { title: "Portrait retouch", description: "Input: a portrait you own or have permission to retouch. Output: a private cleaned portrait that preserves identity. Best for: skin, flyaway, and lighting cleanup before delivery. Cost: credits are shown before paid edits.", category: "AI Photo Edit", badge: "Retouch", imageUrl: assets.womanPortrait, href: toolHref("portrait-retouch") }),
  block("mega_edit_unblur", "tool_card", { title: "Unblur image", description: "Input: a soft phone shot you own. Output: a private sharper source image. Best for: rescuing usable uploads before a package. Cost: credits are shown before paid edits.", category: "AI Photo Edit", badge: "Utility", imageUrl: assets.heroGridUpscale, href: toolHref("unblur-image") }),
  block("mega_edit_color", "tool_card", { title: "Color correction", description: "Input: a portrait, poster, or package preview you own. Output: a private image with cleaner tone balance. Best for: profile photos, posters, and package previews. Cost: credits are shown before paid edits.", category: "AI Photo Edit", badge: "Color", imageUrl: assets.proofBeautyHair, href: toolHref("color-correction") }),
  block("mega_edit_restore", "tool_card", { title: "Old photo restoration", description: "Input: an old photo you own or have permission to restore. Output: a private repaired image for album use. Best for: family-photo cleanup and private gallery delivery. Cost: credits are shown before paid edits.", category: "AI Photo Edit", badge: "Restore", imageUrl: assets.socialCard, href: toolHref("old-photo-restoration") }),
  block("mega_edit_prompt", "tool_card", { title: "Edit by prompt", description: "Input: one image you own plus a focused edit prompt. Output: a private edited preview. Best for: testing a specific change before spending package credits. Cost: credits are shown before paid edits.", category: "AI Photo Edit", badge: "Prompt", imageUrl: assets.flowBeforeUpload, href: toolHref("edit-by-prompt") }),
  block("mega_edit_upscale", "tool_card", { title: "Magic upscaler", description: "Input: a generated or uploaded image you own. Output: a private higher-resolution download. Best for: profile images, larger displays, and final album favorites. Cost: credits are shown before paid edits.", category: "AI Photo Edit", badge: "HD", imageUrl: assets.magicUpscalerPack, href: toolHref("magic-upscaler") }),
  block("mega_video_image", "tool_card", { title: "Image to video concept", description: "Input: one finished image you own or generated. Output: a private short motion concept. Best for: social posts, profile intros, and campaign previews. Cost: credits are shown before video generation.", category: "Video AI", badge: "Preview", imageUrl: assets.heroGridVideo, href: toolHref("image-to-video") }),
  block("mega_video_profile", "tool_card", { title: "Profile clip maker", description: "Input: headshots or creator portraits you own. Output: a private profile motion clip. Best for: social profiles and short intros. Cost: credits are shown before video generation.", category: "Video AI", badge: "Social", imageUrl: assets.reviewLucasResultHeadshot, href: toolHref("profile-clip") }),
  block("mega_video_fan", "tool_card", { title: "Fan poster motion", description: "Input: fan poster images from your own selfies. Output: a private match-day motion concept. Best for: personal fan posts without official marks, logos, or player likenesses. Cost: credits are shown before video generation.", category: "Video AI", badge: "Sports", imageUrl: assets.catalogWorldcupCard, href: toolHref("fan-poster-motion") }),
  block("mega_video_intro", "tool_card", { title: "Creator intro video", description: "Input: creator portraits you own or generated. Output: a private intro clip for profiles and reels. Best for: creator pages and media-kit motion. Cost: credits are shown before video generation.", category: "Video AI", badge: "Creator", imageUrl: assets.reviewNoahResultSocialCard, href: toolHref("creator-intro-video") }),
  block("mega_video_product", "tool_card", { title: "Product teaser clip", description: "Input: product-style package outputs you own. Output: a private teaser motion concept. Best for: campaign drafts and social commerce previews. Cost: credits are shown before video generation.", category: "Video AI", badge: "Commerce", imageUrl: assets.aiVideoAddonsPack, href: toolHref("product-teaser-clip") }),
  block("mega_video_avatar", "tool_card", { title: "Animated avatar preview", description: "Input: avatar-style images you own or generated. Output: a private animated avatar preview. Best for: profile campaigns and playful identity updates. Cost: credits are shown before video generation.", category: "Video AI", badge: "Avatar", imageUrl: assets.reviewAvaAvatar, href: toolHref("animated-avatar") }),
  block("mega_video_fashion", "tool_card", { title: "Fashion reel starter", description: "Input: editorial or try-on preview images you own. Output: a private fashion reel concept. Best for: style direction and creator content previews, not fit guarantees. Cost: credits are shown before video generation.", category: "Video AI", badge: "Style", imageUrl: assets.virtualLooks, href: toolHref("fashion-reel") }),
  block("mega_video_album", "tool_card", { title: "Album story video", description: "Input: favorite generated images from your private album. Output: a private compact album story video. Best for: sharing a finished set as a short motion recap. Cost: credits are shown before video generation.", category: "Video AI", badge: "Album", imageUrl: assets.flowPrivateAlbumWorkspace, href: toolHref("album-story-video") })
];

const homeSections: ThemePageJson["sections"] = {
  hero_1: section(
    "hero",
    {
      anchor: "home",
      eyebrow: "",
      headline: "Create sports fan meetups, VIP-style portraits, and holiday group photos from your selfies.",
      subheadline: "upload a few selfies and it generates photo-realistic couple, wedding, engagement, and boudoir photos that keep your real facial features. It doesn't need any skills, Turn ideas into videos instantly,just an idea that can add life to your images and make them in a motion. saving all your time & money. So, don't wait, create now! Private by default: your uploads stay private in your signed-in account.",
      imageUrl: assets.heroPackageWall,
      secondaryImageUrl: assets.heroCreditStudioCard,
      tertiaryImageUrl: assets.gala,
      heroGridImages: [assets.heroGridBusiness, assets.heroGridBeauty, assets.heroGridCyber, assets.heroGridTravel, assets.heroGridSports, assets.heroGridAvatar, assets.heroGridProduct, assets.heroGridVideo, assets.heroGridSocial, assets.heroGridNoir, assets.heroGridUpscale].join("|"),
      bulletList:
        "No AI training on your photos - Your inputs are never used to train models.|30-day auto-delete - Input photos automatically delete 30 days after generation.|100% money-back guarantee - If the shoot doesn't look like you, refund. Read the refund policy|AES-256 at rest · TLS 256-bit in transit - Encryption standards across the stack.",
      highlightWord: "sports fan",
      heroBadge: "AI photo package studio--AI Headshot Generators",
      authRibbon: "Plans start at $24.50/month",
      authPrimaryLabel: "Continue with email",
      authEmailPlaceholder: "Email address",
      authButtonLabel: "Create my first photo set with Email",
      authPrimaryHref: "/login?mode=login",
      authEmailHref: "/login?mode=register",
      imageBadge: "15+ package categories",
      imageCaption: "Upload selfies and create your own AI model - Professional headshots without a studio.",
      socialProofLabel: "Private uploads and clear credit costs",
      layout: "immersive_dark"
    },
    [
      block("hero_cta_primary", "cta", { label: "Create Now", href: "/login", style: "primary" }),
      block("hero_cta_secondary", "cta", { label: "Browse packages", href: "/collections", style: "secondary" }),
      block("hero_stat_credits", "stat", { value: "Credits", label: "shown before generation" }),
      block("hero_stat_packs", "stat", { value: "15+", label: "photo package themes" }),
      block("hero_stat_private", "stat", { value: "Private", label: "model, uploads, albums" })
    ]
  ),
  brand_strip_1: section(
    "brand_logo_strip",
    { anchor: "trusted", title: "Private photo sets for fan meetups, sports-idol style moments, VIP looks, Christmas cards, Thanksgiving portraits, and Halloween albums.", style: "dark" },
    [
      block("logo_reviews", "logo", { name: "Fan meetups", imageUrl: "", badge: "Private" }),
      block("logo_packages", "logo", { name: "Sports fan packs", imageUrl: "", badge: "Catalog" }),
      block("logo_model", "logo", { name: "VIP-style looks", imageUrl: "", badge: "Permission-safe" }),
      block("logo_video", "logo", { name: "Christmas albums", imageUrl: "", badge: "Seasonal" }),
      block("logo_tryon", "logo", { name: "Halloween & Thanksgiving", imageUrl: "", badge: "Holiday" })
    ]
  ),
  visual_proof_1: section(
    "dreamshoot_visual_proof",
    {
      anchor: "proof-gallery",
      label: "Visual proof gallery",
      title: "See what your selfies can become.",
      subtitle: "See examples of fan meetups, sports-idol style photos, VIP looks, Christmas group portraits, Thanksgiving albums, Halloween party shots, and seasonal cards.",
      tabs: "All|Fan Photos|Sports Stars|VIP Looks|Christmas|Thanksgiving|Halloween|Seasonal",
      badges: "Private model|Fan-safe styling|Holiday albums",
      primaryCta: "Start this pack",
      primaryHref: "/login"
    },
    [
      block("proof_worldcup", "proof_card", { title: "World Cup fan photos", description: "Stadium fan posters, match-day group shots, and social-ready supporter portraits.", category: "Fan Photos", badge: "Featured", imageUrl: assets.galleryWorldCupFanOne, href: "/collections/world-cup-fan-photos" }),
      block("proof_sports_meetup", "proof_card", { title: "Sports idol-style meetups", description: "Create fan meetup scenes, tunnel portraits, and group-photo moments with permission-safe sports styling.", category: "Sports Stars", badge: "Sports Stars", imageUrl: assets.galleryWorldCupFanTwo, href: "/collections/world-cup-fan-photos" }),
      block("proof_vip", "proof_card", { title: "Red-carpet fan moments", description: "VIP-style portraits, creator gala looks, and red-carpet fan snapshots from approved source photos.", category: "VIP Looks", badge: "VIP Looks", imageUrl: assets.galleryGalaOne, href: "/collections/gala-photos" }),
      block("proof_christmas", "proof_card", { title: "Christmas group photos", description: "Festive couple, family-style, and friend-group portraits for cards, posts, and private albums.", category: "Christmas", badge: "Christmas", imageUrl: assets.galleryChristmasPhotosOne, href: "/collections/christmas-photos" }),
      block("proof_seasonal", "proof_card", { title: "Seasonal holiday albums", description: "Holiday portraits for Christmas cards, Thanksgiving warmth, Halloween mood, and private group albums.", category: "Seasonal", badge: "Seasonal", imageUrl: assets.gallerySeasonalFallback, href: "/collections/holiday" })
    ]
  ),
  featured_pack_1: section(
    "dreamshoot_featured_pack",
    {
      anchor: "featured-pack",
      label: "Featured seasonal pack",
      badge: "Match-day pack",
      title: "World Cup fan photos for sports-idol style moments.",
      subtitle: "Turn everyday selfies into fan meetups, stadium-style group photos, match-day posters, and private albums built for social sharing.",
      primaryCta: "Create Fan Photos",
      primaryHref: "/login",
      secondaryCta: "View Sports Packs",
      secondaryHref: "/collections",
      photos: "Private gallery",
      credits: "26 credits",
      privacy: "Private album",
      includedTitle: "Included outputs",
      includedOutputs: "Fan meetup photos|Group-friendly shots for match day|Stadium portraits|Cinematic scenes with floodlights|Match-day avatars|Profile-ready square crops|Social banners|Wide cover images for sharing",
      safetyCopy: "Fan-safe styling: no real player or celebrity likenesses, official team logos, event marks, or protected brand assets without permission.",
      overlayTitle: "World Cup Pack",
      overlaySubtitle: "Sports-idol style fan photos without a studio.",
      overlayChips: "fan meetup|group shot|stadium|social-ready",
      bottomNote: "Seasonal packs rotate around tournaments, Christmas, Thanksgiving, Halloween, and personal fan-photo moments.",
      campaignLabel: "Current campaign: World Cup Fan Photos",
      nextCampaignLabel: "Next: Christmas / Thanksgiving / Halloween"
    },
    [
      block("seasonal_worldcup_1", "seasonal_image", { label: "Stadium Portrait", meta: "Cinematic fan look", imageUrl: assets.worldCupStadiumPortrait, collectionSlug: "world-cup-fan-photos", shape: "tall" }),
      block("seasonal_worldcup_2", "seasonal_image", { label: "Fan Meetup Photos", meta: "Group-friendly shots", imageUrl: assets.worldCupFriendFans, collectionSlug: "gala-photos", shape: "wide" }),
      block("seasonal_worldcup_3", "seasonal_image", { label: "Match-day Avatar", meta: "Profile-ready crop", imageUrl: assets.worldCupAvatar, collectionSlug: "christmas-couple", shape: "square" }),
      block("seasonal_worldcup_4", "seasonal_image", { label: "Fan Poster", meta: "Story and feed artwork", imageUrl: assets.worldCupFanPoster, collectionSlug: "creator-portraits", shape: "tall" }),
      block("seasonal_worldcup_5", "seasonal_image", { label: "Social Story", meta: "Mobile-first layout", imageUrl: assets.worldCupSocialStory, collectionSlug: "thanksgiving-group-photos", shape: "tall" }),
      block("seasonal_worldcup_6", "seasonal_image", { label: "Banner / Cover", meta: "Wide campaign image", imageUrl: assets.worldCupBanner, collectionSlug: "holiday", shape: "wide" })
    ]
  ),
  featured_christmas_1: section(
    "dreamshoot_featured_pack",
    {
      anchor: "christmas-holiday-pack",
      label: "Featured holiday pack",
      badge: "Christmas pack",
      title: "Christmas group photos for cards, posts, and private albums.",
      subtitle: "Create festive group portraits, cozy card scenes, warm couple images, and album-ready Christmas visuals from photos you own or can use.",
      primaryCta: "Create Christmas Photos",
      primaryHref: "/login",
      secondaryCta: "View Christmas Photos",
      secondaryHref: "/collections/christmas-photos",
      photos: "Holiday cards",
      credits: "20 credits",
      privacy: "Private album",
      includedTitle: "Included outputs",
      includedOutputs: "Christmas portraits|Festive group scenes|Greeting-card covers|Cozy card-ready crops|Private album images|Warm holiday downloads|Social posts|Square profile crops",
      safetyCopy: "Use photos you own or have permission to use. MyDreamShoots does not recreate protected brand marks, official holiday artwork, celebrity likenesses, or public figures without permission.",
      overlayTitle: "Christmas Photos",
      overlaySubtitle: "Festive holiday portraits without a studio.",
      overlayChips: "Christmas cards|group portraits|cozy scenes|private",
      bottomNote: "Holiday packs can cover Christmas cards, group portraits, couple keepsakes, Thanksgiving warmth, and private seasonal albums.",
      campaignLabel: "Current campaign: Christmas Photos",
      nextCampaignLabel: "Next: Thanksgiving / Halloween / Seasonal"
    },
    [
      block("seasonal_christmas_1", "seasonal_image", { label: "Christmas Portraits", meta: "Card-ready mood", imageUrl: "/assets/dreamshoot/generated/pack-galleries/christmas-photos/christmas-photos-06.webp", collectionSlug: "christmas-photos", shape: "square" }),
      block("seasonal_christmas_2", "seasonal_image", { label: "Greeting Card Scene", meta: "Festive group crop", imageUrl: "/assets/dreamshoot/generated/pack-galleries/christmas-photos/christmas-photos-07.webp", collectionSlug: "christmas-photos", shape: "square" }),
      block("seasonal_christmas_3", "seasonal_image", { label: "Cozy Couple", meta: "Warm keepsake", imageUrl: "/assets/dreamshoot/generated/pack-galleries/christmas-couple/christmas-couple-04.webp", collectionSlug: "christmas-couple", shape: "square" }),
      block("seasonal_christmas_4", "seasonal_image", { label: "Holiday Cover", meta: "Private album art", imageUrl: assets.galleryChristmasCover, collectionSlug: "christmas-photos", shape: "square" }),
      block("seasonal_christmas_5", "seasonal_image", { label: "Seasonal Album", meta: "Family-style glow", imageUrl: "/assets/dreamshoot/generated/pack-galleries/christmas-photos/christmas-photos-08.webp", collectionSlug: "christmas-photos", shape: "square" }),
      block("seasonal_christmas_6", "seasonal_image", { label: "Giftable Keepsake", meta: "Social-ready crop", imageUrl: "/assets/dreamshoot/generated/pack-galleries/christmas-couple/christmas-couple-05.webp", collectionSlug: "christmas-couple", shape: "square" })
    ]
  ),
  featured_thanksgiving_1: section(
    "dreamshoot_featured_pack",
    {
      anchor: "thanksgiving-pack",
      label: "Featured seasonal pack",
      badge: "Thanksgiving pack",
      title: "Thanksgiving group photos for warm private albums.",
      subtitle: "Create dinner-table portraits, Friendsgiving scenes, gratitude cards, and keepsake crops from photos you own or can use.",
      primaryCta: "Create Thanksgiving Photos",
      primaryHref: "/login",
      secondaryCta: "View Thanksgiving Photos",
      secondaryHref: "/collections/thanksgiving-group-photos",
      photos: "Group portraits",
      credits: "20 credits",
      privacy: "Private gallery",
      includedTitle: "Included outputs",
      includedOutputs: "Dinner-table portraits|Warm gathering scenes|Friendsgiving memories|Group-friendly crops|Gratitude cards|Seasonal notes|Private album covers|Download-ready images",
      safetyCopy: "Use clear photos you own or have permission to use. MyDreamShoots keeps Thanksgiving sets private and avoids protected people, marks, or brand assets without permission.",
      overlayTitle: "Thanksgiving Photos",
      overlaySubtitle: "Warm gratitude scenes from approved photos.",
      overlayChips: "group portraits|gratitude cards|Friendsgiving|private",
      bottomNote: "Thanksgiving packs work best with clear group photos, warm setting cues, and simple album goals.",
      campaignLabel: "Current campaign: Thanksgiving Group Photos",
      nextCampaignLabel: "Next: Christmas / Halloween / Seasonal"
    },
    [
      block("seasonal_thanksgiving_1", "seasonal_image", { label: "Dinner Portraits", meta: "Warm table scene", imageUrl: versionedAsset("/assets/dreamshoot/generated/pack-galleries/thanksgiving-group-photos/thanksgiving-group-photos-05.webp"), collectionSlug: "thanksgiving-group-photos", shape: "square" }),
      block("seasonal_thanksgiving_2", "seasonal_image", { label: "Friendsgiving Set", meta: "Group-friendly crop", imageUrl: versionedAsset("/assets/dreamshoot/generated/pack-galleries/thanksgiving-group-photos/thanksgiving-group-photos-06.webp"), collectionSlug: "thanksgiving-group-photos", shape: "square" }),
      block("seasonal_thanksgiving_3", "seasonal_image", { label: "Gratitude Card", meta: "Seasonal note", imageUrl: versionedAsset("/assets/dreamshoot/generated/pack-galleries/thanksgiving-group-photos/thanksgiving-group-photos-07.webp"), collectionSlug: "thanksgiving-group-photos", shape: "square" }),
      block("seasonal_thanksgiving_4", "seasonal_image", { label: "Keepsake Cover", meta: "Private album art", imageUrl: assets.galleryThanksgivingFallback, collectionSlug: "thanksgiving-group-photos", shape: "square" }),
      block("seasonal_thanksgiving_5", "seasonal_image", { label: "Family-style Album", meta: "Harvest warmth", imageUrl: versionedAsset("/assets/dreamshoot/generated/pack-galleries/thanksgiving-group-photos/thanksgiving-group-photos-08.webp"), collectionSlug: "thanksgiving-group-photos", shape: "square" }),
      block("seasonal_thanksgiving_6", "seasonal_image", { label: "Host Story", meta: "Download-ready image", imageUrl: versionedAsset("/assets/dreamshoot/generated/pack-galleries/thanksgiving-group-photos/thanksgiving-group-photos-09.webp"), collectionSlug: "thanksgiving-group-photos", shape: "square" })
    ]
  ),
  package_catalog_1: section(
    "dreamshoot_package_catalog",
    {
      anchor: "packages",
      label: "Photo package catalog",
      title: "Choose a photo package first.",
      subtitle: "Each package shows the finished look, photo count, credit cost, and boundaries before you start. Choose fan photos, VIP-style looks, Christmas cards, Thanksgiving portraits, Halloween party albums, or seasonal group photos from images you own or have permission to use.",
      tabs: "All|Fan Photos|Sports Stars|VIP Looks|Christmas|Thanksgiving|Halloween|Seasonal|Creator|Video|Utility",
      steps: "Pick pack|See credit cost|Generate album",
      source: "creative_packs",
      featuredCount: 12
    },
    [
      block("catalog_worldcup", "catalog_pack", { title: "World Cup fan photos", description: "Create fan meetup portraits, match-day posters, stadium group shots, and social-ready avatars from your own selfies. For personal fan use only; no official logos, player likenesses, celebrity likenesses, or official marks without permission.", category: "Fan Photos", meta: "Fan meetups", credits: "26 credits", imageUrl: assets.galleryWorldCupFanFour, href: "/collections/world-cup-fan-photos" }),
      block("catalog_christmas", "catalog_pack", { title: "Christmas Photos", description: "Create festive group portraits, greeting-card visuals, cozy couple scenes, and warm seasonal images.", category: "Christmas", meta: "Holiday cards", credits: "20 credits", imageUrl: assets.galleryChristmasPhotosOne, href: "/collections/christmas-photos" }),
      block("catalog_christmas_couple", "catalog_pack", { title: "Christmas Couple", description: "Create cozy Christmas couple portraits, friend-card moments, and giftable holiday keepsakes.", category: "Christmas", meta: "Couple cards", credits: "22 credits", imageUrl: assets.galleryChristmasCoupleOne, href: "/collections/christmas-couple" }),
      block("catalog_holiday", "catalog_pack", { title: "Holiday", description: "Create seasonal portraits for Christmas, Thanksgiving, Halloween, family-style cards, and private group albums.", category: "Seasonal", meta: "Seasonal albums", credits: "20 credits", imageUrl: assets.galleryHolidayFallback, href: "/collections/holiday" }),
      block("catalog_creator_vip", "catalog_pack", { title: "Creator red-carpet style", description: "Create VIP-style creator portraits, red-carpet fan snapshots, and polished personal-brand images from approved photos.", category: "VIP Looks", meta: "Red-carpet looks", credits: "24 credits", imageUrl: assets.galleryGalaOne, href: "/collections/creator-portraits" }),
      block("catalog_thanksgiving", "catalog_pack", { title: "Thanksgiving Group Photos", description: "Create warm family-style portraits, dinner-table keepsakes, gratitude cards, and private seasonal albums.", category: "Thanksgiving", meta: "Group portraits", credits: "20 credits", imageUrl: assets.galleryThanksgivingFallback, href: "/collections/thanksgiving-group-photos" }),
      block("catalog_halloween", "catalog_pack", { title: "Halloween Party Photos", description: "Create costume-party portraits, spooky group cards, cinematic VIP looks, and seasonal social images.", category: "Halloween", meta: "Party albums", credits: "20 credits", imageUrl: assets.galleryHalloweenFallback, href: "/collections/halloween-party-photos" })
    ]
  ),
  generation_showcase_1: section(
    "dreamshoot_generation_showcase",
    {
      anchor: "generated-showcase",
      eyebrow: "Customer-created examples",
      title: "Browse image and video themes customers have already created.",
      subtitle: "These examples use materials customers created in private accounts. Scan the theme labels to choose a direction for your own set.",
      imageTitle: "Customer image themes",
      videoTitle: "Customer video themes",
      imageSlugs: "world-cup-fan-photos|christmas-couple|christmas-photos|creator-portraits|gala-photos|holiday|professional-headshots|cyberpunk",
      videoSlugs: "cinematic-portrait-motion|social-profile-clip|travel-route-story|wedding-memory-film|holiday-card-motion|product-showcase-motion|prompt-directed-motion|creator-intro-motion",
      videoItemLimit: 8,
      primaryCta: "Start with your photos",
      primaryHref: "/login"
    }
  ),
  flow_bridge_1: section(
    "dreamshoot_flow_bridge",
    {
      anchor: "workflow",
      label: "Private album workflow",
      title: "From upload to private album.",
      subtitle: "Upload source photos, confirm the package and credits, then follow the request into a private gallery. Your uploads stay private by default.",
      beforeImage: assets.flowBeforeUpload,
      afterImage: assets.hairstyle,
      albumImageOne: assets.flowPrivateAlbumWorkspace,
      albumImageTwo: assets.manPortrait,
      albumImageThree: assets.sampleCyberpunk,
      bridgeCta: "Choose a plan for your photo set",
      bridgeHref: "/pricing"
    },
    [
      block("flow_upload", "card", { title: "Private by default", text: "Your uploads stay private inside your signed-in MyDreamShoots account with your jobs, albums, downloads, and credit history. Only upload photos you own or have permission to use.", meta: "01" }),
      block("flow_pack", "card", { title: "Choose a package", text: "Choose a photo package or quick AI tool.", meta: "02" }),
      block("flow_credits", "card", { title: "How credits work", text: "Credits are shown before generation starts, reserved when a request begins, used after successful delivery, and returned when a failed request releases the reservation.", meta: "03" }),
      block("flow_album", "card", { title: "Generate and download", text: "Generate your private results and download the photos you want to keep.", meta: "04" })
    ]
  ),
  taxonomy_1: section(
    "dreamshoot_package_taxonomy",
    {
      anchor: "package-taxonomy",
      eyebrow: "Photo package library",
      title: "AI photo packages by style, use case, and delivery goal.",
      subtitle: "Compare AI headshots, hairstyle previews, World Cup fan photos, fashion previews, adult consensual boudoir-inspired sets, and video add-ons before you spend credits. Your uploads stay private by default.",
      layout: "editorial"
    },
    [
      block("taxonomy_headshot", "taxonomy_card", { title: "Professional headshots", description: "Profile photos for LinkedIn, founders, resumes, and teams. Not for official IDs or impersonation.", meta: "Professional", keywords: "headshot|linkedin|resume", imageUrl: assets.manPortrait, href: "/collections/headshots" }),
      block("taxonomy_style", "taxonomy_card", { title: "Style and beauty", description: "Hairstyles, beauty portraits, virtual try-on, and polished creator looks with visual previews, not exact fit guarantees.", meta: "Beauty", keywords: "hairstyle|beauty|virtual try-on", imageUrl: assets.womanPortrait, href: "/collections/beauty" }),
      block("taxonomy_boudoir", "taxonomy_card", { title: "Boudoir", description: "Tasteful, private, non-explicit portrait concepts for consenting adults only. Do not upload minors, non-consenting people, stolen images, or unauthorized portraits.", meta: "Adult consent", keywords: "boudoir|private portraits|consent", imageUrl: assets.womanPortrait, href: "/collections/boudoir" }),
      block("taxonomy_worlds", "taxonomy_card", { title: "Cinematic worlds", description: "Cyberpunk, mafia, nature, gala, and dramatic themed photos.", meta: "Creative", keywords: "cyberpunk|mafia|nature|gala", imageUrl: assets.cyberpunkSample, href: "/collections/creative" }),
      block("taxonomy_sports", "taxonomy_card", { title: "World Cup fan photos", description: "Stadium fan scenes, fan posters, and match-day profile photos for personal fan use without official logos or player likenesses.", meta: "Sports", keywords: "world cup photos|football fan photo|match day avatar", imageUrl: assets.worldCupStadiumPortrait, href: "/collections/sports" }),
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
      subtitle: "Each image points to a finished album outcome with source-photo guidance, visible credits, and private delivery.",
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
    subtitle: "Compare credit costs, source-photo requirements, private model needs, and delivery expectations before starting a headshot, sports, beauty, creator, lifestyle, or cinematic portrait pack. Only upload photos you own or have permission to use.",
    source: "creative_packs",
    layout: "editorial",
    maxCount: "32"
  }),
  packages_strip_1: section("feature_grid", {
    anchor: "package-path",
    eyebrow: "Why customers buy",
    title: "A clear path from upload to finished gallery.",
    subtitle: "Start with studio tools, choose a plan for premium generation, then receive finished images in a private MyDreamShoots album.",
    source: "blocks",
    layout: "steps"
  }, [
    block("pkg_path_upload", "card", { title: "Private by default", text: "Your uploads stay private inside your signed-in MyDreamShoots account with your jobs, albums, downloads, and credit history. Only upload photos you own or have permission to use.", meta: "Step 01", imageUrl: assets.upload }),
    block("pkg_path_preview", "card", { title: "Preview", text: "Use studio tools to preview the look before paying for the full package.", meta: "Step 02", imageUrl: assets.hairstyle }),
    block("pkg_path_pay", "card", { title: "How credits work", text: "Credits are shown before generation starts, reserved when a request begins, used after successful delivery, and returned when a failed request releases the reservation.", meta: "Step 03", imageUrl: assets.socialCard }),
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
        description: "Start from a guided package like headshots, World Cup fan photos, cyberpunk, gala, nature, beauty, creator, or product-style scenes with credits shown before generation.",
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
        description: "Test hairstyle, wardrobe, beauty, or gala directions before spending credits on a premium pack. Try-on outputs are visual previews, not exact fit guarantees.",
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
      subtitle: "Use paid tools for background changes, image enhancement, portrait cleanup, upscaling, video previews, and visual try-on previews. Each card explains input, output, best use, and cost before you move into private photo packages.",
      categories: "Photo AI|AI Photo Edit|Video AI",
      primaryCta: "Create my first photo set",
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
      title: "Upload, choose, review credits, generate.",
      subtitle: "Use photos you own or have permission to use. Choose a package, review the credit cost, generate private results, and download favorites.",
      imageUrl: assets.upload
    },
    [
      block("step_upload", "card", { title: "Upload clear photos", text: "Use recent photos where the face or subject is visible. Only upload photos you own or have permission to use.", meta: "01" }),
      block("step_pack", "card", { title: "Choose a photo package", text: "Pick the outcome you want, such as headshots, fan posters, creator portraits, beauty previews, or themed albums.", meta: "02" }),
      block("step_credits", "card", { title: "Review the credit cost", text: "The request shows the credit cost before generation starts so you know what the package will reserve.", meta: "03" }),
      block("step_deliver", "card", { title: "Download from your gallery", text: "Finished sets land in your private gallery where you can review, approve, and download results.", meta: "04" })
    ]
  ),
  proof_pairs_1: section(
    "before_after_gallery",
    {
      anchor: "results",
      title: "Compare source photos with finished results.",
      subtitle: "Review the source photo, selected package direction, and finished private output before choosing another run.",
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
    { anchor: "trust", title: "Private safeguards for every AI photo shoot." },
    [
      block("trust_no_training", "stat", { value: "No AI training on your photos", label: "Your inputs are never used to train models." }),
      block("trust_auto_delete", "stat", { value: "30-day auto-delete", label: "Input photos automatically delete 30 days after generation." }),
      block("trust_refund", "stat", { value: "100% money-back guarantee", label: "If the shoot doesn't look like you, refund.", linkLabel: "Read the refund policy", href: "/refunds" }),
      block("trust_encryption", "stat", { value: "AES-256 at rest · TLS 256-bit in transit", label: "Encryption standards across the stack." })
    ]
  ),
  plan_rules_1: section(
    "rich_text",
    {
      anchor: "plan-rules",
      eyebrow: "Plans and credits",
      title: "How credits work",
      body: "Credits are shown before generation starts, reserved when a request begins, used after successful delivery, and returned when a failed request releases the reservation. Your uploads stay private inside your signed-in MyDreamShoots account with your jobs, albums, downloads, and credit history.",
      imageUrl: assets.manPortrait,
      primaryCta: "Choose a plan",
      primaryHref: "/pricing",
      secondaryCta: "Try a photo tool",
      secondaryHref: "/tools",
      tone: "dark",
      layout: "commerce_intro"
    },
    [
      block("plan_rule_tools", "card", { meta: "source prep", title: "Prepare better source photos", description: "Background edits, previews, upscaling, and try-on flows can help prepare clearer inputs before a full package." }),
      block("plan_rule_model", "card", { meta: "identity consistency", title: "Use a private identity flow", description: "Premium packages can use a private identity workflow so results stay more consistent across different scenes." }),
      block("plan_rule_credits", "card", { meta: "How credits work", title: "Review credits first", description: "Credits are shown before generation starts, reserved when a request begins, used after successful delivery, and returned when a failed request releases the reservation." }),
      block("plan_rule_gallery", "card", { meta: "Private by default", title: "Your uploads stay private", description: "Your uploads stay private inside your signed-in MyDreamShoots account with your jobs, albums, downloads, and credit history." })
    ]
  ),
  pricing_1: section("pricing_table", {
    anchor: "plans",
    title: "Plans & Pricing",
    subtitle: "Choose Starter, Pro, or Premium. Each package shows its credit cost before generation; failed requests can return reserved credits according to request status.",
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
      title: "Ways people use MyDreamShoots.",
      subtitle: "Theme examples for fan meetup albums, VIP-style looks, Christmas cards, holiday groups, and short private clips.",
      summaryTitle: "Ways people use MyDreamShoots",
      summaryBody: "Plan sports fan meetups, VIP-style red-carpet looks, Christmas cards, and holiday group albums before spending credits.",
      summaryRating: "",
      summaryMeta: "Narrative examples"
    },
    [
      block("review_fan_meetup", "testimonial", {
        quote: "Turn match-day selfies into sports fan photos, supporter portraits, and group-friendly fan meetup images without using official logos or real player likenesses.",
        name: "Fan meetup album",
        role: "Sports fan photos",
        location: "Fan Photos",
        rating: "",
        avatarUrl: assets.reviewAvaAvatar,
        resultImageUrl: assets.galleryWorldCupFanThree
      }),
      block("review_vip", "testimonial", {
        quote: "Plan VIP-style portraits and red-carpet fan moments from approved source photos before spending credits on a full private gallery.",
        name: "VIP-style portrait set",
        role: "Red-carpet style",
        location: "VIP Looks",
        rating: "",
        avatarUrl: assets.reviewLucasAvatar,
        resultImageUrl: assets.galleryGalaTwo
      }),
      block("review_christmas", "testimonial", {
        quote: "Compare Christmas couple, friend-card, and group portrait directions before creating card-ready favorites for a private album.",
        name: "Christmas card set",
        role: "Holiday cards",
        location: "Christmas photos",
        rating: "",
        avatarUrl: assets.reviewMiaAvatar,
        resultImageUrl: assets.galleryChristmasCoupleTwo
      }),
      block("review_holiday", "testimonial", {
        quote: "Build seasonal holiday albums around Christmas cards, Thanksgiving warmth, Halloween mood, and private family-style keepsakes.",
        name: "Holiday group album",
        role: "Seasonal albums",
        location: "Private gallery",
        rating: "",
        avatarUrl: assets.reviewNoahAvatar,
        resultImageUrl: assets.galleryChristmasPhotosTwo
      }),
      block("review_credit", "testimonial", {
        quote: "Pick a theme, check the credit cost, and keep every fan-photo or holiday result inside a private MyDreamShoots gallery.",
        name: "Credit planning",
        role: "Private workflow",
        location: "Clear credits",
        rating: "",
        avatarUrl: assets.womanPortrait,
        resultImageUrl: assets.galleryCreatorOne
      }),
      block("review_clip", "testimonial", {
        quote: "Turn finished fan portraits or VIP-style images into short private clips after reviewing the credit cost and source-frame guidance.",
        name: "Short motion preview",
        role: "Image-to-video ideas",
        location: "Private clips",
        rating: "",
        avatarUrl: assets.selfie,
        resultImageUrl: assets.galleryCreatorTwo
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
      subtitle: "Answers to pricing, privacy, uploads, credits, refunds, and photo quality.",
      journeyTitle: "Your photo flow",
      journeyTitles: "Upload|Choose Pack|Generate|Download",
      journeyDescriptions: "Add clean source photos.|Pick a scene or style.|AI builds your set.|Download from the private gallery."
    },
    [
      block("faq_free", "faq_item", {
        question: "Can I try MyDreamShoots for free?",
        answer: "Some lightweight tools can be free. Private model creation and premium photo packages require credits because they use dedicated generation capacity."
      }),
      block("faq_credits", "faq_item", {
        question: "When are credits used?",
        answer: "Credit cost is shown before each generation. Different packages may use different credit amounts based on style, output size, and generation settings."
      }),
      block("faq_private", "faq_item", {
        question: "Are my uploaded photos private?",
        answer: "Yes. Source photos, generation jobs, albums, orders, and credits stay connected to your signed-in MyDreamShoots account and are not public by default."
      }),
      block("faq_uploads", "faq_item", {
        question: "What photos should I upload?",
        answer: "Recent, clear, high-quality phone photos work best. Use different angles, expressions, lighting, and outfits so the private model has enough visual range."
      }),
      block("faq_delete", "faq_item", {
        question: "Can I delete my photos?",
        answer: "You can request deletion of uploaded or generated photos from your account. Some billing, security, and dispute records may be retained where required."
      }),
      block("faq_refunds", "faq_item", {
        question: "What is the refund policy?",
        answer: "Refund eligibility follows the site policy and checkout terms. Credits already spent on successful generations are not refundable, while failed requests can return reserved credits according to request status."
      }),
      block("faq_cancel", "faq_item", {
        question: "What happens if I cancel a plan?",
        answer: "Access to previous albums follows the account and gallery policy. New package requests may require an active plan or enough available credits."
      })
    ]
  ),
  conversion_1: section(
    "conversion_panel",
    {
      anchor: "start",
      eyebrow: "Start creating",
      title: "Open your private MyDreamShoots studio.",
      subtitle: "Subscribe, upload, choose packages, generate results, and keep delivery in one workspace.",
      primaryCta: "Create my first photo set",
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
    title: "How credits work for private AI photo packages.",
    body: "Choose a plan based on how often you need AI headshots, creator portraits, fan photos, image cleanup, video previews, and private gallery delivery. Credits are shown before generation starts, reserved when a request begins, used after successful delivery, and returned when a failed request releases the reservation.",
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
    eyebrow: "AI Headshot Generator",
    title: "AI headshots for LinkedIn, resumes, and founder profiles.",
    subtitle: "Create a private set of professional headshots from clear selfies. Not for official IDs, impersonation, or representing someone without permission.",
    imageUrl: assets.headshotLifestyle,
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
    body: "MyDreamShoots partners with creators, community builders, photographers, coaches, and niche publishers who can introduce private AI photo packages in a useful, trustworthy way. Share themed photo packs, source-photo tips, before-and-after stories, and seasonal campaign links while your audience keeps uploads, credits, and albums inside their own account.",
    headingLevel: "h1",
    tone: "dark",
    imageUrl: assets.heroGridSocial,
    primaryCta: "Apply as a partner",
    primaryHref: "/partner-registration",
    secondaryCta: "Explore photo packages",
    secondaryHref: "/collections"
  }, [
    block("creator_intro_commission", "rich_text_card", { meta: "Channel", title: "Creator-ready campaigns", description: "Launch content around headshots, fan photos, gala portraits, avatars, and seasonal photo packs without building a photo product yourself." }),
    block("creator_intro_privacy", "rich_text_card", { meta: "Trust", title: "Private customer flow", description: "Followers sign in, upload, pay, generate, and download inside MyDreamShoots, so you promote the experience without handling personal photos." }),
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
    body: "Tell us about your audience, preferred channels, publishing cadence, and the photo package angles you want to test. Approved partners receive a dedicated route, campaign notes, and a way to coordinate launch timing with the MyDreamShoots team.",
    tone: "warm"
  }, [
    block("creator_step_apply", "rich_text_card", { meta: "01", title: "Apply", description: "Submit your creator profile, social links, audience notes, and the kind of campaign you want to run." }),
    block("creator_step_match", "rich_text_card", { meta: "02", title: "Match", description: "We review fit, confirm the channel, and suggest photo packages that make sense for your audience." }),
    block("creator_step_launch", "rich_text_card", { meta: "03", title: "Launch", description: "Publish with a partner route that sends customers to MyDreamShoots packages, pricing, or a specific offer." }),
    block("creator_step_learn", "rich_text_card", { meta: "04", title: "Learn", description: "Track what resonates, refine the story, and plan follow-up drops around seasonal or niche photo themes." })
  ]),
  partner_form_1: section("rich_text", {
    eyebrow: "Partner application",
    title: "Apply for a reserved MyDreamShoots promotion channel.",
    body: "Tell us who you reach, how you publish, and which MyDreamShoots photo experiences would fit your audience. Approved partners can send customers to packages, pricing, or a specific private album offer.",
    headingLevel: "h1",
    layout: "application_form",
    tone: "dark",
    imageUrl: assets.proofCinematicWorlds,
    primaryCta: "Email partnership details",
    primaryHref: "mailto:partners@mydreamshoots.com?subject=MyDreamShoots%20partner%20application",
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
    block("partner_expectation_compliance", "rich_text_card", { meta: "Rules", title: "Privacy and disclosure", description: "Partners should disclose AI use where appropriate and avoid collecting customer uploads outside MyDreamShoots." }),
    block("partner_expectation_launch", "rich_text_card", { meta: "Launch", title: "A testable plan", description: "Share when you can publish, what format you will use, and which route or offer would make the campaign easy to measure." })
  ])
};

const aidreamcapesPublicAssets = {
  hero: versionedAsset("/assets/sites/site_aidreamcapes/fan-holiday-theme/covers/private-fan-scene-album.webp"),
  fan: versionedAsset("/assets/sites/site_aidreamcapes/fan-holiday-theme/covers/private-fan-scene-album.webp"),
  gameDay: versionedAsset("/assets/sites/site_aidreamcapes/fan-holiday-theme/covers/game-day-group-portraits.webp"),
  premiere: versionedAsset("/assets/sites/site_aidreamcapes/fan-holiday-theme/covers/premiere-flash-portraits.webp"),
  christmas: versionedAsset("/assets/sites/site_aidreamcapes/fan-holiday-theme/covers/christmas-group-album.webp"),
  thanksgiving: versionedAsset("/assets/sites/site_aidreamcapes/fan-holiday-theme/covers/thanksgiving-keepsake-table-set.webp"),
  halloween: versionedAsset("/assets/sites/site_aidreamcapes/fan-holiday-theme/covers/halloween-party-portrait-set.webp"),
  seasonal: versionedAsset("/assets/sites/site_aidreamcapes/fan-holiday-theme/covers/seasonal-celebration-photo-set.webp"),
  gallery: versionedAsset("/assets/sites/site_aidreamcapes/fan-holiday-theme/gallery/private-fan-scene-album-01.webp")
} as const;

function aidreamcapesHomeHeroSection(): SectionInstance {
  return section(
    "hero",
    {
      anchor: "home",
      eyebrow: "",
      headline: "Create private fan-scene, game-day, and holiday albums from approved photos.",
      subheadline: "Upload photos you own or have permission to use, then build private fan-scene albums, game-day group portraits, premiere-inspired looks, Christmas keepsakes, Thanksgiving table sets, Halloween party portraits, and seasonal celebration images. Credit costs are shown before generation starts, and finished albums stay in your signed-in Aidreamcapes gallery.",
      imageUrl: aidreamcapesPublicAssets.hero,
      secondaryImageUrl: aidreamcapesPublicAssets.gameDay,
      tertiaryImageUrl: aidreamcapesPublicAssets.premiere,
      heroGridImages: [aidreamcapesPublicAssets.fan, aidreamcapesPublicAssets.gameDay, aidreamcapesPublicAssets.premiere, aidreamcapesPublicAssets.christmas, aidreamcapesPublicAssets.thanksgiving, aidreamcapesPublicAssets.halloween, aidreamcapesPublicAssets.seasonal, aidreamcapesPublicAssets.gallery].join("|"),
      bulletList:
        "Upload approved source photos.|Choose fan-scene, game-day, premiere, or holiday albums.|Review credits before generation starts.|Download finished images from your private gallery.",
      highlightWord: "private",
      heroBadge: "AI occasion album studio",
      authRibbon: "Plans start at $24.50/month",
      authPrimaryLabel: "Continue with email",
      authEmailPlaceholder: "Email address",
      authButtonLabel: "Create account with email",
      authPrimaryHref: "/login?mode=login",
      authEmailHref: "/login?mode=register",
      imageBadge: "Fan and holiday album categories",
      imageCaption: "Choose an occasion album, then generate a private gallery.",
      socialProofLabel: "Approved uploads and visible credit costs",
      layout: "immersive_dark"
    },
    [
      block("aidream_hero_cta_primary", "cta", { label: "Create my first album", href: "/login", style: "primary" }),
      block("aidream_hero_cta_secondary", "cta", { label: "Browse albums", href: "/collections", style: "secondary" }),
      block("aidream_hero_stat_credits", "stat", { value: "Credits", label: "shown before generation" }),
      block("aidream_hero_stat_albums", "stat", { value: "7", label: "occasion categories" }),
      block("aidream_hero_stat_private", "stat", { value: "Private", label: "uploads and albums" })
    ]
  );
}

function aidreamcapesPackageCatalogSection(): SectionInstance {
  return section(
    "dreamshoot_package_catalog",
    {
      anchor: "packages",
      label: "Occasion album catalog",
      title: "Choose an Aidreamcapes album direction first.",
      subtitle: "Every album card explains the look, source-photo expectations, credit cost, and boundaries before you begin. Browse fan scenes, game-day portraits, premiere-inspired sets, Christmas albums, Thanksgiving memory sets, Halloween party portraits, and seasonal celebration photos.",
      tabs: "All|Fan Scenes|Game Day|Premiere|Christmas|Thanksgiving|Halloween|Seasonal",
      steps: "Pick album|See credit cost|Generate gallery",
      source: "creative_packs",
      featuredCount: 12
    },
    [
      block("aidream_catalog_fan", "catalog_pack", { title: "Private fan-scene album", description: "Create original fan-scene portraits and keepsake images from approved source photos without copying public figures, official marks, or protected logos.", category: "Fan Scenes", meta: "Fan albums", credits: "24 credits", imageUrl: aidreamcapesPublicAssets.fan, href: "/collections/private-fan-scene-album" }),
      block("aidream_catalog_game_day", "catalog_pack", { title: "Game-day group portraits", description: "Turn group photos into private game-day images, watch-party portraits, and personal supporter keepsakes.", category: "Game Day", meta: "Group portraits", credits: "22 credits", imageUrl: aidreamcapesPublicAssets.gameDay, href: "/collections/game-day-group-portraits" }),
      block("aidream_catalog_premiere", "catalog_pack", { title: "Premiere flash portraits", description: "Create polished premiere-inspired portraits, event-look images, and creator-ready gallery crops.", category: "Premiere", meta: "Flash portraits", credits: "24 credits", imageUrl: aidreamcapesPublicAssets.premiere, href: "/collections/premiere-flash-portraits" }),
      block("aidream_catalog_christmas", "catalog_pack", { title: "Christmas group album", description: "Build festive portraits, greeting-card images, warm group crops, and private holiday keepsakes.", category: "Christmas", meta: "Holiday album", credits: "20 credits", imageUrl: aidreamcapesPublicAssets.christmas, href: "/collections/christmas-group-album" }),
      block("aidream_catalog_thanksgiving", "catalog_pack", { title: "Thanksgiving keepsake table set", description: "Create warm table scenes, gratitude cards, Friendsgiving images, and family-style seasonal albums.", category: "Thanksgiving", meta: "Memory set", credits: "20 credits", imageUrl: aidreamcapesPublicAssets.thanksgiving, href: "/collections/thanksgiving-keepsake-table-set" }),
      block("aidream_catalog_halloween", "catalog_pack", { title: "Halloween party portrait set", description: "Create costume-party portraits, atmospheric group shots, and playful seasonal images from approved photos.", category: "Halloween", meta: "Party portraits", credits: "20 credits", imageUrl: aidreamcapesPublicAssets.halloween, href: "/collections/halloween-party-portrait-set" }),
      block("aidream_catalog_seasonal", "catalog_pack", { title: "Seasonal celebration photo set", description: "Plan occasion albums for parties, celebrations, gift notes, and private memory pages throughout the year.", category: "Seasonal", meta: "Celebrations", credits: "20 credits", imageUrl: aidreamcapesPublicAssets.seasonal, href: "/collections/seasonal-celebration-photo-set" })
    ]
  );
}

function mydreamshootsTutorialVideoSection(): SectionInstance {
  return section("video_feature", {
    anchor: "how-it-works",
    eyebrow: "How it works",
    title: "Watch the private photo package workflow.",
    subtitle: "Upload photos you own, choose an AI photo package, review credits, generate the album, and download finished images from your private MyDreamShoots gallery.",
    imageUrl: "/assets/dreamshoot/generated/homepage-showcase/posters/mydreamshoots-i2v-tutorial-45s.jpg?v=20260804resultfix2",
    videoUrl: "/assets/dreamshoot/generated/homepage-showcase/videos/mydreamshoots-i2v-tutorial-45s.mp4?v=20260804resultfix2",
    videoBadge: "Private gallery workflow",
    playLabel: "Watch the MyDreamShoots workflow"
  });
}

function mydreamshootsImageTutorialVideoSection(): SectionInstance {
  return section("video_feature", {
    anchor: "ai-image-tutorial",
    eyebrow: "AI image tutorial",
    title: "Create an AI photo set from source photos.",
    subtitle: "Watch the signed-in flow: choose a photo package, upload a clear source photo, review audience, credits, and selected uploads, start generation, refresh the workspace, and open the finished image.",
    imageUrl: "/assets/dreamshoot/generated/homepage-showcase/posters/mydreamshoots-ai-image-tutorial-55s.jpg?v=20260804resultfix2",
    videoUrl: "/assets/dreamshoot/generated/homepage-showcase/videos/mydreamshoots-ai-image-tutorial-55s.mp4?v=20260804resultfix2",
    videoBadge: "AI photo generation",
    playLabel: "Watch the MyDreamShoots AI image tutorial"
  });
}

function aidreamcapesTutorialVideoSection(): SectionInstance {
  return section("video_feature", {
    anchor: "how-it-works",
    eyebrow: "How it works",
    title: "See how an Aidreamcapes occasion album is planned.",
    subtitle: "Start with approved source photos, choose a fan-scene or holiday direction, confirm the visible credit cost, and keep finished images inside your private Aidreamcapes gallery.",
    imageUrl: "/assets/sites/site_aidreamcapes/homepage-showcase/posters/aidreamcapes-i2v-tutorial-55s.jpg?v=20260804resultfix2",
    videoUrl: "/assets/sites/site_aidreamcapes/homepage-showcase/videos/aidreamcapes-i2v-tutorial-55s.mp4?v=20260804resultfix2",
    videoBadge: "Occasion album workflow",
    playLabel: "Watch the Aidreamcapes workflow"
  });
}

function aidreamcapesImageTutorialVideoSection(): SectionInstance {
  return section("video_feature", {
    anchor: "ai-image-tutorial",
    eyebrow: "AI image tutorial",
    title: "Create a private fan-scene image album.",
    subtitle: "Follow the Aidreamcapes workspace flow: choose a fan-scene album, add approved source photos, review the album details and credit cost, start generation, refresh All assets, and open the finished image.",
    imageUrl: "/assets/sites/site_aidreamcapes/homepage-showcase/posters/aidreamcapes-ai-image-tutorial-55s.jpg?v=20260804resultfix2",
    videoUrl: "/assets/sites/site_aidreamcapes/homepage-showcase/videos/aidreamcapes-ai-image-tutorial-55s.mp4?v=20260804resultfix2",
    videoBadge: "AI image album workflow",
    playLabel: "Watch the Aidreamcapes AI image tutorial"
  });
}

function mydreamshootsMobileVideoShowcaseSection(): SectionInstance {
  return section("mobile_video_showcase", {
    anchor: "mobile-video-tutorial",
    eyebrow: "Mobile tutorial",
    title: "Mobile workflow preview for MyDreamShoots.",
    subtitle: "See the image tutorial and video tutorial side by side in a vertical phone layout.",
    imageUrl: assets.flowPrivateAlbumWorkspace,
    imageAlt: "MyDreamShoots private album workspace preview",
    videoUrl: "/assets/dreamshoot/generated/homepage-showcase/videos/mydreamshoots-i2v-mobile-tutorial-45s.mp4?v=20260804mobile1",
    videoPoster: "/assets/dreamshoot/generated/homepage-showcase/posters/mydreamshoots-i2v-mobile-tutorial-45s.jpg?v=20260804mobile1",
    videoBadge: "Mobile workflow",
    playLabel: "Watch the video tutorial",
    leftTitle: "AI image tutorial",
    leftVideoUrl: "/assets/dreamshoot/generated/homepage-showcase/videos/mydreamshoots-ai-image-mobile-tutorial-55s.mp4?v=20260804mobile1",
    leftVideoPoster: "/assets/dreamshoot/generated/homepage-showcase/posters/mydreamshoots-ai-image-mobile-tutorial-55s.jpg?v=20260804mobile1",
    leftPlayLabel: "Watch the image tutorial",
    rightTitle: "AI video tutorial",
    rightVideoUrl: "/assets/dreamshoot/generated/homepage-showcase/videos/mydreamshoots-i2v-mobile-tutorial-45s.mp4?v=20260804mobile1",
    rightVideoPoster: "/assets/dreamshoot/generated/homepage-showcase/posters/mydreamshoots-i2v-mobile-tutorial-45s.jpg?v=20260804mobile1",
    rightPlayLabel: "Watch the video tutorial",
    placeholderTitle: "Mobile tutorial coming soon",
    placeholderBody: "The vertical mobile walkthrough will appear here when the final video is ready."
  });
}

function aidreamcapesMobileVideoShowcaseSection(): SectionInstance {
  return section("mobile_video_showcase", {
    anchor: "mobile-video-tutorial",
    eyebrow: "Mobile tutorial",
    title: "Mobile workflow preview for Aidreamcapes.",
    subtitle: "See the image tutorial and video tutorial side by side in a vertical phone layout.",
    imageUrl: aidreamcapesPublicAssets.gallery,
    imageAlt: "Aidreamcapes private fan-scene album preview",
    videoUrl: "/assets/sites/site_aidreamcapes/homepage-showcase/videos/aidreamcapes-i2v-mobile-tutorial-55s.mp4?v=20260804mobile1",
    videoPoster: "/assets/sites/site_aidreamcapes/homepage-showcase/posters/aidreamcapes-i2v-mobile-tutorial-55s.jpg?v=20260804mobile1",
    videoBadge: "Mobile workflow",
    playLabel: "Watch the video tutorial",
    leftTitle: "AI image tutorial",
    leftVideoUrl: "/assets/sites/site_aidreamcapes/homepage-showcase/videos/aidreamcapes-ai-image-mobile-tutorial-55s.mp4?v=20260804mobile1",
    leftVideoPoster: "/assets/sites/site_aidreamcapes/homepage-showcase/posters/aidreamcapes-ai-image-mobile-tutorial-55s.jpg?v=20260804mobile1",
    leftPlayLabel: "Watch the image tutorial",
    rightTitle: "AI video tutorial",
    rightVideoUrl: "/assets/sites/site_aidreamcapes/homepage-showcase/videos/aidreamcapes-i2v-mobile-tutorial-55s.mp4?v=20260804mobile1",
    rightVideoPoster: "/assets/sites/site_aidreamcapes/homepage-showcase/posters/aidreamcapes-i2v-mobile-tutorial-55s.jpg?v=20260804mobile1",
    rightPlayLabel: "Watch the video tutorial",
    placeholderTitle: "Mobile tutorial coming soon",
    placeholderBody: "The vertical mobile walkthrough will appear here when the final video is ready."
  });
}

function mydreamshootsReviewSection(): SectionInstance {
  return section(
    "testimonial_wall",
    {
      anchor: "reviews",
      mode: "reviews",
      title: "What customers like about MyDreamShoots.",
      subtitle: "Clear credit costs, realistic-looking themes, private galleries, and quick planning keep showing up in customer feedback.",
      summaryTitle: "Customers love the private gallery flow.",
      summaryBody: "Creators, small teams, sports fans, and holiday-card buyers use MyDreamShoots to test polished AI photo ideas before booking a studio or building a campaign.",
      summaryRating: "4.9/5",
      summaryMeta: "Customer feedback"
    },
    [
      block("review_ava", "testimonial", { quote: "The package cards made it easy to pick a direction before I spent credits. My sports fan set looked polished and stayed organized in one private gallery.", name: "Ava M.", role: "Sports fan album", location: "Fan photos", rating: "5", avatarUrl: assets.reviewAvaAvatar, resultImageUrl: assets.galleryWorldCupFanThree }),
      block("review_lucas", "testimonial", { quote: "I needed profile images for a launch week. The VIP-style portraits gave me several usable looks without arranging a shoot or chasing edits.", name: "Lucas R.", role: "Creator portraits", location: "VIP-style set", rating: "5", avatarUrl: assets.reviewLucasAvatar, resultImageUrl: assets.galleryGalaTwo }),
      block("review_mia", "testimonial", { quote: "The Christmas couple pack saved a lot of time. We compared the theme first, checked credits, then downloaded card-ready images from the gallery.", name: "Mia C.", role: "Holiday cards", location: "Christmas album", rating: "5", avatarUrl: assets.reviewMiaAvatar, resultImageUrl: assets.galleryChristmasCoupleTwo }),
      block("review_noah", "testimonial", { quote: "My favorite part is the workflow. Upload, choose a package, approve the cost, and the finished set is easy to review with the rest of my account history.", name: "Noah P.", role: "Private gallery user", location: "Credit planning", rating: "5", avatarUrl: assets.reviewNoahAvatar, resultImageUrl: assets.flowPrivateAlbumWorkspace }),
      block("review_chloe", "testimonial", { quote: "The theme labels helped me explain options to a client. We tested creator portraits, holiday images, and short motion ideas from the same source photos.", name: "Chloe S.", role: "Social seller", location: "Creator workflow", rating: "5", avatarUrl: assets.womanPortrait, resultImageUrl: assets.galleryCreatorOne }),
      block("review_eli", "testimonial", { quote: "Good quality, clear wording, and no confusing checkout surprise. I knew what each generation would use before starting the album.", name: "Eli T.", role: "Small team admin", location: "Headshots and cards", rating: "5", avatarUrl: assets.selfie, resultImageUrl: assets.galleryCreatorTwo })
    ]
  );
}

function aidreamcapesReviewSection(): SectionInstance {
  return section(
    "testimonial_wall",
    {
      anchor: "reviews",
      mode: "reviews",
      title: "Positive words from Aidreamcapes customers.",
      subtitle: "Customers mention the private album flow, clear occasion categories, fan-safe boundaries, and simple credit review before generation.",
      summaryTitle: "Occasion albums feel easy to plan.",
      summaryBody: "Aidreamcapes helps fan communities, event planners, creators, and holiday sellers build private album ideas without handling protected marks or public-figure likenesses.",
      summaryRating: "4.8/5",
      summaryMeta: "Occasion album feedback"
    },
    [
      block("aidream_review_maya", "testimonial", { quote: "The fan-scene album made our group photos feel planned instead of random. I liked seeing the credit cost before the request started.", name: "Maya L.", role: "Fan community admin", location: "Private fan scene", rating: "5", avatarUrl: aidreamcapesPublicAssets.fan, resultImageUrl: aidreamcapesPublicAssets.gallery }),
      block("aidream_review_owen", "testimonial", { quote: "Game-day portraits were easy to brief. The site kept the boundaries clear, so we avoided logos and still got a strong match-day mood.", name: "Owen K.", role: "Event organizer", location: "Game day album", rating: "5", avatarUrl: aidreamcapesPublicAssets.gameDay, resultImageUrl: aidreamcapesPublicAssets.gameDay }),
      block("aidream_review_lena", "testimonial", { quote: "I used the premiere look for creator posts. The examples helped me choose the right direction before I uploaded source photos.", name: "Lena V.", role: "Creator", location: "Premiere portraits", rating: "5", avatarUrl: aidreamcapesPublicAssets.premiere, resultImageUrl: aidreamcapesPublicAssets.premiere }),
      block("aidream_review_sam", "testimonial", { quote: "Christmas albums came together quickly for our seasonal shop. The finished images were easy to review and download from one private space.", name: "Sam D.", role: "Holiday seller", location: "Christmas group album", rating: "5", avatarUrl: aidreamcapesPublicAssets.christmas, resultImageUrl: aidreamcapesPublicAssets.christmas }),
      block("aidream_review_nora", "testimonial", { quote: "The Thanksgiving set had the warm mood we wanted. It felt useful for planning cards, table scenes, and private keepsakes.", name: "Nora H.", role: "Family album planner", location: "Thanksgiving set", rating: "5", avatarUrl: aidreamcapesPublicAssets.thanksgiving, resultImageUrl: aidreamcapesPublicAssets.thanksgiving }),
      block("aidream_review_ian", "testimonial", { quote: "I appreciate that Aidreamcapes explains approved photos and protected-mark limits in plain language. It makes the creative brief much safer.", name: "Ian B.", role: "Community creator", location: "Seasonal albums", rating: "5", avatarUrl: aidreamcapesPublicAssets.seasonal, resultImageUrl: aidreamcapesPublicAssets.seasonal })
    ]
  );
}

function mydreamshootsPartnerStripSection(): SectionInstance {
  return section(
    "brand_logo_strip",
    { anchor: "trusted", title: "For creators, photographers, social sellers, studios, fan communities, and small teams.", style: "dark" },
    [
      block("partner_creator_teams", "logo", { name: "Creator teams", imageUrl: "", badge: "Content" }),
      block("partner_photo_studios", "logo", { name: "Photo studios", imageUrl: "", badge: "Studio" }),
      block("partner_social_sellers", "logo", { name: "Social sellers", imageUrl: "", badge: "Commerce" }),
      block("partner_fan_pages", "logo", { name: "Fan pages", imageUrl: "", badge: "Community" }),
      block("partner_event_marketers", "logo", { name: "Event marketers", imageUrl: "", badge: "Campaigns" }),
      block("partner_holiday_shops", "logo", { name: "Holiday shops", imageUrl: "", badge: "Seasonal" }),
      block("partner_creator_coaches", "logo", { name: "Creator coaches", imageUrl: "", badge: "Guides" }),
      block("partner_small_teams", "logo", { name: "Small teams", imageUrl: "", badge: "Profiles" })
    ]
  );
}

function aidreamcapesPartnerStripSection(): SectionInstance {
  return section(
    "brand_logo_strip",
    { anchor: "trusted", title: "For fan communities, event planners, holiday sellers, creator teams, and local studios.", style: "dark" },
    [
      block("aidream_partner_fan_communities", "logo", { name: "Fan communities", imageUrl: "", badge: "Groups" }),
      block("aidream_partner_event_planners", "logo", { name: "Event planners", imageUrl: "", badge: "Occasions" }),
      block("aidream_partner_holiday_sellers", "logo", { name: "Holiday sellers", imageUrl: "", badge: "Seasonal" }),
      block("aidream_partner_creator_teams", "logo", { name: "Creator teams", imageUrl: "", badge: "Content" }),
      block("aidream_partner_local_studios", "logo", { name: "Local studios", imageUrl: "", badge: "Photo" }),
      block("aidream_partner_newsletters", "logo", { name: "Newsletter teams", imageUrl: "", badge: "Audience" }),
      block("aidream_partner_watch_parties", "logo", { name: "Watch parties", imageUrl: "", badge: "Game day" }),
      block("aidream_partner_card_shops", "logo", { name: "Card shops", imageUrl: "", badge: "Keepsakes" })
    ]
  );
}

function mydreamshootsFaqSection(): SectionInstance {
  return section(
    "faq",
    {
      anchor: "faq",
      eyebrow: "Questions before upload",
      title: "FAQ",
      subtitle: "Answers to photo uploads, AI video examples, package themes, credits, privacy, refunds, subscriptions, quality, and gallery delivery.",
      journeyTitle: "Your photo flow",
      journeyTitles: "Upload|Choose Pack|Generate|Download",
      journeyDescriptions: "Add clean source photos.|Pick a scene or style.|AI builds your set.|Download from the private gallery."
    },
    [
      block("faq_free", "faq_item", { question: "Can I try MyDreamShoots for free?", answer: "Some lightweight tools can be free. Private model creation, premium photo packages, and AI video requests require credits because they use dedicated generation capacity." }),
      block("faq_credits", "faq_item", { question: "When are credits used?", answer: "The credit cost is shown before each generation. Credits are reserved when a request starts, used after successful delivery, and returned when a failed request releases the reservation." }),
      block("faq_private", "faq_item", { question: "Are my uploaded photos private?", answer: "Yes. Source photos, generation jobs, albums, orders, and credits stay connected to your signed-in MyDreamShoots account and are not public by default." }),
      block("faq_uploads", "faq_item", { question: "What photos should I upload?", answer: "Recent, clear, high-quality phone photos work best. Use different angles, expressions, lighting, and outfits so the private workflow has enough visual range." }),
      block("faq_videos", "faq_item", { question: "Can I create AI videos too?", answer: "Yes. Some themes include short AI video examples or video add-ons. The request screen shows source requirements and credit cost before video generation begins." }),
      block("faq_categories", "faq_item", { question: "Why are there so many package categories?", answer: "Each category represents a different output goal such as fan photos, VIP-style portraits, headshots, creator images, Christmas cards, Thanksgiving albums, Halloween portraits, or seasonal group photos." }),
      block("faq_faces", "faq_item", { question: "Will the images keep my facial features?", answer: "Results depend on source photo quality, lighting, pose, and model behavior. Clear source photos usually help the generated images stay more consistent, but AI output can vary." }),
      block("faq_safety", "faq_item", { question: "Can I use celebrity, athlete, or brand references?", answer: "Do not upload or request content that copies real celebrities, athletes, public figures, official marks, logos, trademarks, or protected materials without permission." }),
      block("faq_delete", "faq_item", { question: "Can I delete my photos?", answer: "You can request deletion of uploaded or generated photos from your account. Some billing, security, and dispute records may be retained where required." }),
      block("faq_refunds", "faq_item", { question: "What is the refund policy?", answer: "Refund eligibility follows the site policy and checkout terms. Credits already spent on successful generations are generally not refundable, while failed requests can return reserved credits according to request status." }),
      block("faq_cancel", "faq_item", { question: "What happens if I cancel a plan?", answer: "Access to previous albums follows the account and gallery policy. New package requests may require an active plan or enough available credits." }),
      block("faq_commercial", "faq_item", { question: "Can I use results for business or social content?", answer: "Many customers use finished images for profiles, social posts, cards, campaigns, or creator content. Review the output, rights, and platform rules before publishing or selling anything." })
    ]
  );
}

function aidreamcapesTrustSection(): SectionInstance {
  return section(
    "trust_signal_bar",
    { anchor: "trust", title: "Approved photos, visible credits, and no protected likeness or marks." },
    [
      block("aidream_trust_private", "stat", { value: "Private", label: "source photos and galleries stay in the signed-in customer account" }),
      block("aidream_trust_credits", "stat", { value: "Credits", label: "album costs are shown before each request reserves credits" }),
      block("aidream_trust_original", "stat", { value: "Original", label: "no real celebrity, athlete, public figure, logo, official mark, or trademark recreation" }),
      block("aidream_trust_delivery", "stat", { value: "Gallery", label: "finished fan and holiday photos return to a private review space" })
    ]
  );
}

function aidreamcapesFaqSection(): SectionInstance {
  return section(
    "faq",
    {
      anchor: "faq",
      eyebrow: "Questions before upload",
      title: "FAQ",
      subtitle: "Answers to approved source photos, fan-scene albums, game-day group portraits, holiday albums, credits, privacy, refunds, and gallery delivery.",
      journeyTitle: "Your private album flow",
      journeyTitles: "Upload|Choose Album|Review Credits|Download",
      journeyDescriptions: "Add approved source photos.|Pick a fan or holiday direction.|Confirm the credit cost.|Download from your gallery."
    },
    [
      block("aidream_faq_sources", "faq_item", {
        question: "What photos can I upload?",
        answer: "Upload only photos you own or have permission to use. Clear portraits and group photos work best for Aidreamcapes fan-scene and holiday albums."
      }),
      block("aidream_faq_likeness", "faq_item", {
        question: "Can Aidreamcapes recreate a real celebrity or athlete?",
        answer: "No. Aidreamcapes can create original fan-scene, game-day, premiere, and holiday atmosphere, but it does not promise or support copying real celebrities, real athletes, public figures, official marks, brand logos, trademarks, or protected materials."
      }),
      block("aidream_faq_credits", "faq_item", {
        question: "When are credits used?",
        answer: "The album cost is shown before generation. Credits are reserved when a private request starts, used after successful delivery, or released when a failed request returns the reservation."
      }),
      block("aidream_faq_private", "faq_item", {
        question: "Are my uploaded photos private?",
        answer: "Yes. Source photos, album briefs, generation jobs, finished images, orders, and credits stay connected to your signed-in Aidreamcapes account and are not public by default."
      }),
      block("aidream_faq_delete", "faq_item", {
        question: "Can I delete my photos?",
        answer: "You can request deletion of uploaded or generated photos from your account. Some billing, security, and dispute records may be retained where required."
      }),
      block("aidream_faq_refunds", "faq_item", {
        question: "What is the refund policy?",
        answer: "Refund eligibility follows the site policy and checkout terms. Credits spent on successful generations are generally not refundable, while failed requests can return reserved credits according to request status."
      }),
      block("aidream_faq_videos", "faq_item", {
        question: "Can I make AI videos from an album?",
        answer: "Some occasion themes include short motion examples or video add-ons. The generation screen explains the source-photo needs and credit cost before any video request starts."
      }),
      block("aidream_faq_categories", "faq_item", {
        question: "Which album categories are available?",
        answer: "Aidreamcapes focuses on fan-scene albums, game-day group portraits, premiere-inspired portraits, Christmas group albums, Thanksgiving memory sets, Halloween party portraits, and seasonal celebration photos."
      }),
      block("aidream_faq_group_photos", "faq_item", {
        question: "Can I create group albums?",
        answer: "Yes. Group source photos can work well for game-day, Christmas, Thanksgiving, Halloween, and seasonal celebration albums when every person in the upload is approved for that use."
      }),
      block("aidream_faq_quality", "faq_item", {
        question: "What affects final quality?",
        answer: "Lighting, focus, face visibility, pose variety, source-photo resolution, and the chosen album direction can all affect results. AI output can vary, so review finished images before sharing."
      }),
      block("aidream_faq_commercial", "faq_item", {
        question: "Can I use the images for business or social content?",
        answer: "Many customers use finished images for personal pages, creator posts, seasonal shops, or event previews. You are responsible for checking rights, platform rules, and any required AI disclosure before publishing."
      }),
      block("aidream_faq_cancel", "faq_item", {
        question: "What happens if I cancel a plan?",
        answer: "Access to previous albums follows the account and gallery policy. New album requests may require an active plan or enough available credits."
      })
    ]
  );
}

function aidreamcapesPlanRulesSection(): SectionInstance {
  return section(
    "rich_text",
    {
      anchor: "plan-rules",
      eyebrow: "Plans and credits",
      title: "How Aidreamcapes credits work",
      body: "Credits are shown before a fan-scene, game-day, premiere, Christmas, Thanksgiving, Halloween, or seasonal album request starts. Credits are reserved while generation runs, used after successful delivery, and returned when a failed request releases the reservation. Your source photos, album briefs, downloads, and credit history stay inside your signed-in Aidreamcapes account.",
      imageUrl: aidreamcapesPublicAssets.gameDay,
      primaryCta: "Choose a plan",
      primaryHref: "/pricing",
      secondaryCta: "Explore album tools",
      secondaryHref: "/tools",
      tone: "dark",
      layout: "commerce_intro"
    },
    [
      block("aidream_plan_source", "card", { meta: "source prep", title: "Prepare better source photos", description: "Upload clear photos you own or have permission to use before starting a full album." }),
      block("aidream_plan_album", "card", { meta: "album direction", title: "Pick a fan or holiday album", description: "Choose fan-scene, game-day, premiere, Christmas, Thanksgiving, Halloween, or seasonal styling before spending credits." }),
      block("aidream_plan_credits", "card", { meta: "credit ledger", title: "Review credits first", description: "Reservations, successful generations, releases, and top-ups remain visible in the customer account." }),
      block("aidream_plan_gallery", "card", { meta: "private delivery", title: "Download from your gallery", description: "Finished fan and holiday images return to an account-only gallery for review and download." })
    ]
  );
}

function aidreamcapesConversionSection(): SectionInstance {
  return section(
    "conversion_panel",
    {
      anchor: "start",
      eyebrow: "Start creating",
      title: "Open your private Aidreamcapes fan and holiday album studio.",
      subtitle: "Choose a fan-scene, game-day, premiere, Christmas, Thanksgiving, Halloween, or seasonal album, upload approved source photos, review credits, and keep finished images in one private workspace.",
      primaryCta: "Create an occasion album",
      primaryHref: "/login",
      secondaryCta: "Choose a plan",
      secondaryHref: "/pricing"
    },
    [
      block("aidream_cta_metric_credits", "stat", { value: "Credits", label: "shown before generation" }),
      block("aidream_cta_metric_themes", "stat", { value: "7", label: "fan and holiday album categories" }),
      block("aidream_cta_metric_private", "stat", { value: "Private", label: "uploads and galleries" })
    ]
  );
}

function aidreamcapesWorkflowStepsSection(): SectionInstance {
  return section(
    "studio_steps",
    {
      anchor: "workflow",
      eyebrow: "How it works",
      title: "Upload, choose an album direction, review credits, generate.",
      subtitle: "Use photos you own or have permission to use. Choose a fan or holiday direction, review the credit cost, generate private results, and download favorites.",
      imageUrl: aidreamcapesPublicAssets.premiere
    },
    [
      block("aidream_step_upload", "card", { title: "Upload clear photos", text: "Use recent portraits where the face or subject is visible. Only upload photos you own or have permission to use.", meta: "01" }),
      block("aidream_step_theme", "card", { title: "Choose a fan or holiday direction", text: "Pick fan-scene albums, game-day group portraits, premiere-inspired sets, Christmas, Thanksgiving, Halloween, or seasonal celebration photos.", meta: "02" }),
      block("aidream_step_credits", "card", { title: "Review the credit cost", text: "The request shows the credit cost before generation starts so you know what the album will reserve.", meta: "03" }),
      block("aidream_step_gallery", "card", { title: "Download from your gallery", text: "Finished sets land in your private gallery where you can review, approve, and download results.", meta: "04" })
    ]
  );
}

function aidreamcapesGenerationShowcaseSection(): SectionInstance {
  return section("dreamshoot_generation_showcase", {
    anchor: "generated-showcase",
    eyebrow: "Customer occasion examples",
    title: "Browse private fan-scene, game-day, and holiday themes customers can create.",
    subtitle: "These examples use Aidreamcapes-owned theme assets and approved source-photo assumptions. Scan fan-scene, game-day, premiere, Christmas, Thanksgiving, Halloween, and seasonal directions.",
    imageTitle: "Fan and holiday image themes",
    videoTitle: "Fan and holiday video themes",
    imageSlugs: "fan-scene-albums|game-day-group-photos|stadium-night-fan-sets|premiere-style-portraits|christmas-holiday-albums|thanksgiving-memory-sets|halloween-party-portraits|seasonal-celebration-photos",
    videoSlugs: "route-atlas-motion|coastal-memory-clip|old-quarter-walkthrough|resort-balcony-motion|scenic-overlook-pan|alpine-trail-motion|solo-traveler-profile-clip|heritage-celebration-film",
    videoItemLimit: 8,
    primaryCta: "Start with approved photos",
    primaryHref: "/login"
  });
}

function aidreamcapesFeaturedPackSection(): SectionInstance {
  return section(
    "dreamshoot_featured_pack",
    {
      anchor: "featured-pack",
      label: "Recommended occasion album",
      badge: "Current seasonal pick",
      title: "Christmas and game-day albums for the next campaign.",
      subtitle: "Compare a focused occasion direction before browsing the full catalog. Start with approved source photos, review the credit cost, and keep the finished gallery private.",
      primaryCta: "Create this album",
      primaryHref: "/login",
      secondaryCta: "View all themes",
      secondaryHref: "/collections",
      photos: "Private gallery",
      credits: "20-24 credits",
      privacy: "Approved uploads",
      includedTitle: "Recommended directions",
      includedOutputs: "Game-day group portraits|Watch-party and supporter scenes|Christmas holiday albums|Card-ready festive crops|Premiere-inspired portraits|Private occasion keepsakes",
      safetyCopy: "Use photos you own or have permission to use. Aidreamcapes does not recreate public-figure likenesses, official marks, logos, or protected event artwork without permission.",
      overlayTitle: "Occasion picks",
      overlaySubtitle: "A small set of seasonal directions to compare first.",
      overlayChips: "game day|Christmas|premiere|private",
      bottomNote: "Recommendations can rotate around tournaments, holidays, celebrations, and local campaign needs.",
      campaignLabel: "Current recommendation: Game day + Christmas",
      nextCampaignLabel: "Next: Premiere / Thanksgiving / Halloween"
    },
    [
      block("aidream_featured_game_day", "seasonal_image", { label: "Game-Day Group Portraits", meta: "Supporter scenes", imageUrl: aidreamcapesPublicAssets.gameDay, collectionSlug: "game-day-group-photos", shape: "square" }),
      block("aidream_featured_christmas", "seasonal_image", { label: "Christmas Holiday Albums", meta: "Card-ready mood", imageUrl: aidreamcapesPublicAssets.christmas, collectionSlug: "christmas-holiday-albums", shape: "square" }),
      block("aidream_featured_premiere", "seasonal_image", { label: "Premiere-Inspired Portraits", meta: "Spotlight arrivals", imageUrl: aidreamcapesPublicAssets.premiere, collectionSlug: "premiere-style-portraits", shape: "square" }),
      block("aidream_featured_fan", "seasonal_image", { label: "Private Fan-Scene Album", meta: "Approved group photos", imageUrl: aidreamcapesPublicAssets.fan, collectionSlug: "fan-scene-albums", shape: "square" }),
      block("aidream_featured_thanksgiving", "seasonal_image", { label: "Thanksgiving Keepsakes", meta: "Warm table scenes", imageUrl: aidreamcapesPublicAssets.thanksgiving, collectionSlug: "thanksgiving-memory-sets", shape: "square" }),
      block("aidream_featured_seasonal", "seasonal_image", { label: "Seasonal Celebration Photos", meta: "Rotating campaign pick", imageUrl: aidreamcapesPublicAssets.seasonal, collectionSlug: "seasonal-celebration-photos", shape: "square" })
    ]
  );
}

function aidreamcapesWorkflowPage(): ThemePageJson {
  return page(
    "content",
    ["workflow_intro_1", "tutorial_video_1", "tutorial_image_video_1", "mobile_video_1", "workflow_1", "plan_rules_1", "faq_1", "conversion_1"],
    {
      workflow_intro_1: section("rich_text", {
        eyebrow: "How it works",
        title: "How Aidreamcapes turns approved photos into private fan and holiday albums.",
        body: "Upload photos you own or have permission to use, choose the fan or holiday album direction you want, review the visible credit cost, generate the private request, and download finished images from your account gallery. Aidreamcapes does not recreate real celebrities, real athletes, public figures, official marks, brand logos, trademarks, or protected materials without permission.",
        headingLevel: "h1",
        tone: "dark",
        imageUrl: aidreamcapesPublicAssets.hero,
        primaryCta: "Browse occasion albums",
        primaryHref: "/collections",
        secondaryCta: "View pricing",
        secondaryHref: "/pricing"
      }, [
        block("aidream_workflow_private", "rich_text_card", { meta: "Private", title: "Account-scoped uploads", description: "Source photos, album briefs, jobs, credits, and albums stay attached to the signed-in customer account." }),
        block("aidream_workflow_credits", "rich_text_card", { meta: "Credits", title: "Visible cost before generation", description: "Customers see the album cost before a private request reserves credits." }),
        block("aidream_workflow_gallery", "rich_text_card", { meta: "Gallery", title: "Finished albums", description: "Generated fan and holiday photos return to a private gallery for review and download." })
      ]),
      tutorial_video_1: aidreamcapesTutorialVideoSection(),
      tutorial_image_video_1: aidreamcapesImageTutorialVideoSection(),
      mobile_video_1: aidreamcapesMobileVideoShowcaseSection(),
      workflow_1: aidreamcapesWorkflowStepsSection(),
      plan_rules_1: aidreamcapesPlanRulesSection(),
      faq_1: aidreamcapesFaqSection(),
      conversion_1: aidreamcapesConversionSection()
    },
    1,
    {
      title: "How Aidreamcapes works - private fan-scene and holiday albums",
      description: "Learn how Aidreamcapes customers upload approved source photos, choose fan-scene or holiday album directions, review credits, generate private results, and download finished galleries.",
      keywords: "Aidreamcapes workflow, fan-scene photo albums, game-day group portraits, holiday memory albums, private AI photo credits",
      canonicalPath: "/workflow",
      robots: { index: true, follow: true }
    }
  );
}

function aidreamcapesCreatorsCirclePage(site?: DreamshootPublicSeoSiteSeed): ThemePageJson {
  return page(
    "content",
    ["creators_intro_1", "creators_fit_1", "creators_steps_1", "pricing_1", "conversion_1"],
    {
      creators_intro_1: section("rich_text", {
        eyebrow: "Creator channel",
        title: "Share private fan-scene and holiday album ideas your audience can actually try.",
        body: "Aidreamcapes partners with creators, photographers, lifestyle editors, fan communities, and holiday planners who can introduce private fan-scene photo albums, game-day group portraits, premiere-inspired sets, and seasonal memory albums in a useful, trustworthy way. Share source-photo tips, before-and-after stories, and permission-safe occasion ideas while your audience keeps uploads, credits, and galleries inside their own account.",
        headingLevel: "h1",
        tone: "dark",
        imageUrl: aidreamcapesPublicAssets.premiere,
        primaryCta: "Apply as a partner",
        primaryHref: "/partner-registration",
        secondaryCta: "Explore occasion albums",
        secondaryHref: "/collections"
      }, [
        block("aidream_creator_campaigns", "rich_text_card", { meta: "Channel", title: "Occasion-ready campaigns", description: "Launch content around fan-scene albums, game-day group portraits, premiere-inspired sets, and holiday memory albums." }),
        block("aidream_creator_privacy", "rich_text_card", { meta: "Trust", title: "Private customer flow", description: "Followers sign in, upload, pay, generate, and download inside Aidreamcapes, so you promote the experience without handling personal photos." }),
        block("aidream_creator_assets", "rich_text_card", { meta: "Assets", title: "Story angles included", description: "Use page links, album themes, upload tips, and safety talking points that match the Aidreamcapes catalog." }),
        block("aidream_creator_growth", "rich_text_card", { meta: "Growth", title: "Room for paid channels", description: "We can reserve partner campaigns for creators, newsletters, paid media tests, fan communities, and seasonal collaborations." })
      ]),
      creators_fit_1: section("rich_text", {
        eyebrow: "Who fits",
        title: "Built for creators who explain fan moments, holidays, and permission-safe visual storytelling.",
        body: "The strongest partners show real use cases: a fan community creating private album images, a group preparing game-day portraits, a creator testing premiere-inspired visuals, or a family planning seasonal keepsakes. We care more about audience fit, clear storytelling, and consistent publishing than raw follower count.",
        imageUrl: aidreamcapesPublicAssets.gameDay,
        primaryCta: "Start the application",
        primaryHref: "/partner-registration",
        secondaryCta: "View pricing",
        secondaryHref: "/pricing"
      }, [
        block("aidream_fit_social", "rich_text_card", { meta: "Social", title: "Short-form creators", description: "Reels, TikTok, Shorts, and carousel creators who can demonstrate fan-scene or holiday album ideas clearly." }),
        block("aidream_fit_newsletter", "rich_text_card", { meta: "Community", title: "Newsletter and group owners", description: "Operators with engaged audiences around fandom, sports moments, holiday planning, creator tools, or personal branding." }),
        block("aidream_fit_photo", "rich_text_card", { meta: "Studio", title: "Photographers and consultants", description: "Professionals who want an AI add-on for permission-safe occasion portraits and campaign concepts." }),
        block("aidream_fit_paid", "rich_text_card", { meta: "Media", title: "Performance partners", description: "Paid media, SEO, and affiliate teams that can test a dedicated fan and holiday album channel with clean attribution." })
      ]),
      creators_steps_1: section("rich_text", {
        eyebrow: "How it works",
        title: "A simple path from application to live campaign.",
        body: "Tell us about your audience, preferred channels, publishing cadence, and the fan or holiday album angles you want to test. Approved partners receive campaign notes and a way to coordinate launch timing with the Aidreamcapes team.",
        tone: "warm"
      }, [
        block("aidream_step_apply", "rich_text_card", { meta: "01", title: "Apply", description: "Submit your creator profile, social links, audience notes, and the kind of fan or holiday album campaign you want to run." }),
        block("aidream_step_match", "rich_text_card", { meta: "02", title: "Match", description: "We review fit, confirm the channel, and suggest album categories that make sense for your audience." }),
        block("aidream_step_launch", "rich_text_card", { meta: "03", title: "Launch", description: "Publish with a partner offer that sends customers to Aidreamcapes albums, pricing, or a specific private-gallery flow." }),
        block("aidream_step_learn", "rich_text_card", { meta: "04", title: "Learn", description: "Track what resonates, refine the story, and plan follow-up drops around seasonal events or niche fan moments." })
      ]),
      pricing_1: homeSections.pricing_1,
      conversion_1: aidreamcapesConversionSection()
    },
    1,
    seoForPublicPage("/creators-circle", site)
  );
}

function aidreamcapesPartnerRegistrationPage(site?: DreamshootPublicSeoSiteSeed): ThemePageJson {
  return page(
    "content",
    ["partner_form_1", "partner_expectations_1", "trust_1", "conversion_1"],
    {
      partner_form_1: section("rich_text", {
        eyebrow: "Partner application",
        title: "Apply for a reserved Aidreamcapes creator channel.",
        body: "Tell us who you reach, how you publish, and which Aidreamcapes fan-scene or holiday album experiences would fit your audience. Approved partners can send customers to album categories, pricing, or a specific private gallery offer.",
        headingLevel: "h1",
        layout: "application_form",
        tone: "dark",
        imageUrl: aidreamcapesPublicAssets.seasonal,
        primaryCta: "Email partnership details",
        primaryHref: "mailto:support@aidreamcapes.com?subject=Aidreamcapes%20partner%20application",
        secondaryCta: "Back to Creators Circle",
        secondaryHref: "/creators-circle"
      }, [
        block("aidream_partner_field_name", "form_field", { label: "Full name", placeholder: "Your name", fieldType: "text", required: true }),
        block("aidream_partner_field_email", "form_field", { label: "Email address", placeholder: "you@example.com", fieldType: "email", required: true }),
        block("aidream_partner_field_website", "form_field", { label: "Website", placeholder: "https://your-site.com", fieldType: "text", required: false }),
        block("aidream_partner_field_channels", "form_field", { label: "Primary channel links", placeholder: "Instagram, TikTok, YouTube, newsletter, website, or community links", fieldType: "textarea", required: true }),
        block("aidream_partner_field_audience", "form_field", { label: "Audience and niche", placeholder: "Tell us who follows you and why private fan or holiday albums fit them.", fieldType: "textarea", required: true }),
        block("aidream_partner_field_cadence", "form_field", { label: "Publishing cadence", placeholder: "Weekly videos, newsletter drops, paid campaigns, community posts...", fieldType: "text", required: false }),
        block("aidream_partner_field_ideas", "form_field", { label: "Campaign ideas", placeholder: "Which fan-scene albums, game-day portraits, or holiday memory angles would you promote first?", fieldType: "textarea", required: false }),
        block("aidream_partner_field_terms", "form_field", { label: "I confirm that my promotions will respect privacy, platform rules, and truthful AI disclosure.", fieldType: "checkbox", required: true })
      ]),
      partner_expectations_1: section("rich_text", {
        eyebrow: "Before you submit",
        title: "What we look for in partner channels.",
        body: "Great applications are specific. Include real channel links, the audience problem you solve, the content format you prefer, and how you would explain private AI fan and holiday albums without overstating results.",
        imageUrl: aidreamcapesPublicAssets.gallery
      }, [
        block("aidream_partner_fit", "rich_text_card", { meta: "Audience", title: "Clear audience fit", description: "Fan, sports, lifestyle, creator, photography, holiday planning, and personal-brand communities usually map well to the Aidreamcapes catalog." }),
        block("aidream_partner_quality", "rich_text_card", { meta: "Quality", title: "Helpful creative framing", description: "We prefer educational demos, honest results, and practical album examples over hype-only promotions." }),
        block("aidream_partner_compliance", "rich_text_card", { meta: "Rules", title: "Privacy and disclosure", description: "Partners should disclose AI use where appropriate and avoid collecting customer uploads outside Aidreamcapes." }),
        block("aidream_partner_launch", "rich_text_card", { meta: "Launch", title: "A testable plan", description: "Share when you can publish, what format you will use, and which album offer would make the campaign easy to measure." })
      ]),
      trust_1: aidreamcapesTrustSection(),
      conversion_1: aidreamcapesConversionSection()
    },
    1,
    seoForPublicPage("/partner-registration", site)
  );
}

function aidreamcapesAboutPage(site?: DreamshootPublicSeoSiteSeed): ThemePageJson {
  return page(
    "content",
    ["about_intro_1", "about_values_1", "trust_1", "conversion_1"],
    {
      about_intro_1: section("rich_text", {
        eyebrow: "About Aidreamcapes",
        title: "Private fan-scene and holiday photo albums with clear boundaries.",
        body: "Aidreamcapes helps customers turn approved source photos into fan-scene albums, game-day group portraits, premiere-inspired photo sets, Christmas group albums, Thanksgiving keepsake sets, Halloween party portraits, and seasonal celebration photos with visible credits and account-only delivery.",
        headingLevel: "h1",
        tone: "dark",
        imageUrl: aidreamcapesPublicAssets.hero,
        primaryCta: "Explore occasion albums",
        primaryHref: "/collections",
        secondaryCta: "Contact us",
        secondaryHref: "/contact-us"
      }, [
        block("aidream_about_permission", "rich_text_card", { meta: "Permission", title: "Approved photos first", description: "Customers should upload only photos they own or have permission to use before the album request begins." }),
        block("aidream_about_ledger", "rich_text_card", { meta: "Credit ledger", title: "Visible credit holds", description: "Each package shows its credit cost, reservation state, and delivery outcome inside the account history." }),
        block("aidream_about_album", "rich_text_card", { meta: "Album delivery", title: "Occasion-ready selections", description: "Delivered portraits can be compared, downloaded, and kept as a private fan or holiday album." })
      ]),
      about_values_1: section("rich_text", {
        eyebrow: "What we focus on",
        title: "Source photos, album planning, visible credits, and private delivery.",
        body: "Each Aidreamcapes page is designed around a clear fan or holiday album outcome so customers know what to upload, what credits are reserved, and where finished images will arrive.",
        imageUrl: aidreamcapesPublicAssets.christmas,
        primaryCta: "View pricing",
        primaryHref: "/pricing",
        secondaryCta: "FAQ",
        secondaryHref: "/faq"
      }, [
        block("aidream_value_workspace", "rich_text_card", { meta: "Scoped workspace", title: "Account-bound albums", description: "Source photos, album briefs, generated portraits, and downloads remain tied to the signed-in Aidreamcapes account." }),
        block("aidream_value_credits", "rich_text_card", { meta: "Ledger clarity", title: "Album credit visibility", description: "Plan costs, reservations, releases, top-ups, and delivery states are visible before and after each album request." }),
        block("aidream_value_scenes", "rich_text_card", { meta: "Safety", title: "Original style guidance", description: "Fan-scene, game-day, premiere, and holiday packages keep public-figure likeness and protected-mark boundaries visible." })
      ]),
      trust_1: aidreamcapesTrustSection(),
      conversion_1: aidreamcapesConversionSection()
    },
    1,
    seoForPublicPage("/about-us", site)
  );
}

function aidreamcapesContactPage(site?: DreamshootPublicSeoSiteSeed): ThemePageJson {
  const supportEmail = "support@aidreamcapes.com";
  const companyAddress = "30 N GOULD ST STE R,SHERIDAN,WY 82801";
  return page(
    "content",
    ["contact_intro_1", "contact_details_1", "faq_1", "conversion_1"],
    {
      contact_intro_1: section("rich_text", {
        eyebrow: "Contact us",
        title: "Contact Aidreamcapes support.",
        body: "Reach Aidreamcapes support for source photo guidance, fan or holiday album request status, account access, billing review, privacy questions, plan fit, or creator and business use cases.",
        headingLevel: "h1",
        tone: "dark",
        imageUrl: aidreamcapesPublicAssets.thanksgiving,
        primaryCta: "Email support",
        primaryHref: `mailto:${supportEmail}`,
        secondaryCta: "View FAQ",
        secondaryHref: "/faq"
      }, [
        block("aidream_contact_support", "rich_text_card", { meta: "Support", title: supportEmail, description: "For account access, billing review, credit questions, upload help, privacy requests, and private album delivery support." }),
        block("aidream_contact_account", "rich_text_card", { meta: "Account help", title: supportEmail, description: "For plan questions, creator use cases, billing review, credits, and fan or holiday album delivery help." }),
        block("aidream_contact_address", "rich_text_card", { meta: "Address", title: companyAddress, description: "Address for Aidreamcapes.com business correspondence." })
      ]),
      contact_details_1: section("policy_content", {
        title: "Contact information",
        headingLevel: "h2",
        lastUpdated: "June 28, 2026",
        contactEmail: supportEmail,
        body: `<h3>Company</h3><p>Aidreamcapes.com</p><h3>Address</h3><p>${companyAddress}</p><h3>Contact Us</h3><p><a href="mailto:${supportEmail}">${supportEmail}</a></p>`
      }),
      faq_1: aidreamcapesFaqSection(),
      conversion_1: aidreamcapesConversionSection()
    },
    1,
    seoForPublicPage("/contact-us", site)
  );
}

export function dreamshootAiStudioTemplatesForSite(site?: DreamshootPublicSeoSiteSeed): Record<MydreamShootsAiStudioTemplateKey, ThemePageJson> {
  const aidreamcapesTemplateSite = isAidreamcapesTemplateSite(site);
  const homeHeroSection = aidreamcapesTemplateSite ? aidreamcapesHomeHeroSection() : homeSections.hero_1;
  const featuredPackSection = aidreamcapesTemplateSite ? aidreamcapesFeaturedPackSection() : homeSections.featured_pack_1;
  const generationShowcaseSection = aidreamcapesTemplateSite ? aidreamcapesGenerationShowcaseSection() : homeSections.generation_showcase_1;
  const tutorialVideoSection = aidreamcapesTemplateSite ? aidreamcapesTutorialVideoSection() : mydreamshootsTutorialVideoSection();
  const imageTutorialVideoSection = aidreamcapesTemplateSite ? aidreamcapesImageTutorialVideoSection() : mydreamshootsImageTutorialVideoSection();
  const mobileVideoSection = aidreamcapesTemplateSite ? aidreamcapesMobileVideoShowcaseSection() : mydreamshootsMobileVideoShowcaseSection();
  const packageCatalogSection = aidreamcapesTemplateSite ? aidreamcapesPackageCatalogSection() : homeSections.package_catalog_1;
  const reviewSection = aidreamcapesTemplateSite ? aidreamcapesReviewSection() : mydreamshootsReviewSection();
  const faqSection = aidreamcapesTemplateSite ? aidreamcapesFaqSection() : mydreamshootsFaqSection();
  const partnerStripSection = aidreamcapesTemplateSite ? aidreamcapesPartnerStripSection() : mydreamshootsPartnerStripSection();
  const conversionSection = aidreamcapesTemplateSite ? aidreamcapesConversionSection() : homeSections.conversion_1;
  const templates: Record<MydreamShootsAiStudioTemplateKey, ThemePageJson> = {
  home: page(
    "home",
    ["hero_1", "featured_pack_1", "featured_christmas_1", "featured_thanksgiving_1", "generation_showcase_1", "tutorial_video_1", "tutorial_video_2", "mobile_video_1", "package_catalog_1", "proof_1", "pricing_1", "faq_1", "conversion_1", "brand_strip_1"],
    {
      hero_1: homeHeroSection,
      featured_pack_1: featuredPackSection,
      featured_christmas_1: homeSections.featured_christmas_1,
      featured_thanksgiving_1: homeSections.featured_thanksgiving_1,
      generation_showcase_1: generationShowcaseSection,
      tutorial_video_1: tutorialVideoSection,
      tutorial_video_2: imageTutorialVideoSection,
      mobile_video_1: mobileVideoSection,
      package_catalog_1: packageCatalogSection,
      proof_1: reviewSection,
      pricing_1: homeSections.pricing_1,
      faq_1: faqSection,
      conversion_1: conversionSection,
      brand_strip_1: partnerStripSection
    },
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
  workflow: page(
    "content",
    ["workflow_intro_1", "tutorial_video_1", "tutorial_image_video_1", "mobile_video_1", "workflow_1", "plan_rules_1", "faq_1", "conversion_1"],
    {
      workflow_intro_1: section("rich_text", {
        eyebrow: "How it works",
        title: "How MyDreamShoots turns uploads into private AI photo sets.",
        body: "Upload photos you own, choose the photo package you want, review the visible credit cost, generate the private request, and download finished images from your account gallery.",
        headingLevel: "h1",
        tone: "dark",
        imageUrl: assets.heroPackageWall,
        primaryCta: "Browse packages",
        primaryHref: "/collections",
        secondaryCta: "View pricing",
        secondaryHref: "/pricing"
      }, [
        block("workflow_intro_private", "rich_text_card", { meta: "Private", title: "Account-scoped uploads", description: "Source photos, jobs, credits, and albums stay attached to the signed-in customer account." }),
        block("workflow_intro_credits", "rich_text_card", { meta: "Credits", title: "Visible cost before generation", description: "Customers see the package cost before a private request reserves credits." }),
        block("workflow_intro_gallery", "rich_text_card", { meta: "Gallery", title: "Finished albums", description: "Generated images return to a private gallery for review and download." })
      ]),
      tutorial_video_1: mydreamshootsTutorialVideoSection(),
      tutorial_image_video_1: mydreamshootsImageTutorialVideoSection(),
      mobile_video_1: mydreamshootsMobileVideoShowcaseSection(),
      workflow_1: homeSections.workflow_1,
      plan_rules_1: homeSections.plan_rules_1,
      faq_1: homeSections.faq_1,
      conversion_1: homeSections.conversion_1
    },
    1,
    {
      title: "How MyDreamShoots AI photo generation works",
      description: "Learn how MyDreamShoots customers upload source photos, choose AI photo packages, review credits, generate private results, and download finished galleries.",
      keywords: "MyDreamShoots workflow, AI photo generation workflow, private AI photo packages, AI photo credits",
      canonicalPath: "/workflow",
      robots: { index: true, follow: true }
    }
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
      entry_1: section("ai_tool_entry", { aiAppSlug: "image_generator", title: "Create professional headshots from selfies", subtitle: "Upload clear portraits you own, confirm the credit cost, and receive private headshot options for LinkedIn, resumes, team pages, and founder bios.", ctaLabel: "Start this headshot set", imageUrl: assets.headshotLifestyle }),
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
          block("login_email_access", "login_method", { label: "Use email access", helper: "Log in, register, or reset your password from one private account page.", kind: "email", href: "/login" }),
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
        ctaHref: "/app"
      }, [
        block("feature_prepare", "feature", { title: "Choose a tool", description: "Pick the photo workflow first, then attach the source photos it needs.", meta: "Tool first", href: "/app" }),
        block("feature_upload", "feature", { title: "Upload photos", description: "Collect selfies and source images inside a private customer workspace.", meta: "Private intake", href: "/app" }),
        block("feature_progress", "feature", { title: "Track progress", description: "Monitor each private job from request review through finished output readiness.", meta: "Live progress", href: "/app/jobs/progress" }),
        block("feature_album", "feature", { title: "Download albums", description: "Open delivered images and private gallery downloads for this account.", meta: "Private delivery", href: "/app/jobs/detail" })
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
        title: "MyDreamShoots policy details",
        body: "<p>MyDreamShoots policy pages cover customer account access, photo upload rights, private album delivery, credit usage, checkout records, refund review, content moderation, cookies, and privacy controls for AI photo customers.</p><p>Use the dedicated refund, content, privacy, terms, and cookie pages to review the rules that apply before uploading source photos, starting a generation job, buying credits, or downloading finished portraits.</p>"
      })
    },
    1
  ),
  "blog-list": page(
    "blog",
    ["blog_intro_1", "blog_list_1", "packages_strip_1", "conversion_1"],
    {
      blog_intro_1: templateSections.blog_intro_1,
      blog_list_1: section("blog_list", { title: "AI photo guides", body: "Guides for source photos, package planning, credits, delivery, privacy, and getting better private album results.", guideType: "AI photo guide" }),
      packages_strip_1: homeSections.packages_strip_1,
      conversion_1: homeSections.conversion_1
    },
    1
  ),
  "blog-detail": page(
    "article",
    ["blog_detail_1"],
    {
      blog_detail_1: templateSections.blog_detail_1
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
    seoForPublicPage("/creators-circle", site)
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
    seoForPublicPage("/partner-registration", site)
  ),
  "about-us": page(
    "content",
    ["about_intro_1", "about_values_1", "trust_1", "conversion_1"],
    {
      about_intro_1: section("rich_text", {
        eyebrow: "About MyDreamShoots",
        title: "Private AI photo packages with clear credits and real customer delivery.",
        body: "MyDreamShoots helps you turn your own photos into private AI headshots, portraits, and themed albums. Upload photos you own, review credits before generation, and keep finished results in your signed-in gallery.",
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
        secondaryCta: "FAQ",
        secondaryHref: "/faq"
      }, [
        block("about_value_transparency", "rich_text_card", { meta: "01", title: "Clear credit use", description: "Credit reservations, successful generations, returned credits, and billing events are visible in the customer account." }),
        block("about_value_support", "rich_text_card", { meta: "02", title: "Supportable workflow", description: "Customers can contact support for account, billing, privacy, upload, or album questions." }),
        block("about_value_safety", "rich_text_card", { meta: "03", title: "Respect for source photos", description: "Source photos should belong to the customer or be used with permission, and policy pages explain the rules before upload." })
      ]),
      trust_1: homeSections.trust_1,
      conversion_1: homeSections.conversion_1
    },
    1,
    seoForPublicPage("/about-us", site)
  ),
  "contact-us": page(
    "content",
    ["contact_intro_1", "contact_details_1", "faq_1", "conversion_1"],
    {
      contact_intro_1: section("rich_text", {
        eyebrow: "Contact us",
        title: "Contact MyDreamShoots support.",
        body: "Reach MyDreamShoots for account help, billing review, AI photo package questions, private album support, privacy requests, creator use cases, or plan questions.",
        headingLevel: "h1",
        tone: "dark",
        imageUrl: assets.catalogHeadshotCard,
        primaryCta: "Email support",
        primaryHref: "mailto:support@mydreamshoots.com",
        secondaryCta: "Email support",
        secondaryHref: "mailto:support@mydreamshoots.com"
      }, [
        block("contact_support", "rich_text_card", { meta: "Support", title: "support@mydreamshoots.com", description: "For account access, billing review, credit questions, upload help, privacy requests, and delivered album support." }),
        block("contact_account", "rich_text_card", { meta: "Account help", title: "support@mydreamshoots.com", description: "For plan questions, creator use cases, billing review, credits, and private album delivery help." }),
        block("contact_address", "rich_text_card", { meta: "Address", title: "8 THE GREEN STE B,DOVER,DE 19901", description: "Address for myDreamshoots.com business correspondence." })
      ]),
      contact_details_1: section("policy_content", {
        title: "Contact information",
        headingLevel: "h2",
        lastUpdated: "June 28, 2026",
        contactEmail: "support@mydreamshoots.com",
        body: "<h3>Company</h3><p>myDreamshoots.com</p><h3>Address</h3><p>8 THE GREEN STE B,DOVER,DE 19901</p><h3>Contact Us</h3><p><a href=\"mailto:support@mydreamshoots.com\">support@mydreamshoots.com</a></p>"
      }),
      faq_1: homeSections.faq_1,
      conversion_1: homeSections.conversion_1
    },
    1,
    seoForPublicPage("/contact-us", site)
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
        title: "Search MyDreamShoots AI photo tools and packages",
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
        body: "Review your selected subscription plan, confirm the included credits, and continue to checkout before starting premium AI photo generation.",
        headingLevel: "h1"
      }),
      cart_1: section("cart_summary", {
        eyebrow: "Checkout summary",
        title: "Your selected MyDreamShoots plan",
        subtitle: "Your selected plan, credit amount, and checkout status stay connected to your MyDreamShoots account. Credits are added after payment confirmation.",
        emptyTitle: "Choose a plan first",
        emptyBody: "Open pricing to select a monthly or yearly subscription plan.",
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
        subtitle: "Return to AI photo packages, pricing, sign-in, or your private MyDreamShoots workspace.",
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
  if (!isAidreamcapesTemplateSite(site)) return templates;
  return {
    ...templates,
    workflow: aidreamcapesWorkflowPage(),
    "creators-circle": aidreamcapesCreatorsCirclePage(site),
    "partner-registration": aidreamcapesPartnerRegistrationPage(site),
    "about-us": aidreamcapesAboutPage(site),
    "contact-us": aidreamcapesContactPage(site)
  };
}

export const dreamshootAiStudioTemplates: Record<MydreamShootsAiStudioTemplateKey, ThemePageJson> = dreamshootAiStudioTemplatesForSite();

export const dreamshootAiStudioTemplateLabels: Record<MydreamShootsAiStudioTemplateKey, string> = {
  home: "Home",
  pricing: "Pricing",
  packages: "Browse packages",
  tools: "Tools Directory",
  workflow: "How It Works",
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
    logoText: "myᕲreamshoots",
    market: "AI photo packages, personal AI models, paid tools, credits, AI video, and private albums",
    description: "MyDreamShoots is a premium AI photo workspace for themed photo packages, personal AI models, paid studio tools, AI video-ready outputs, and private gallery delivery."
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
        { label: "Browse packages", href: "/collections" },
        { label: "Tools", href: "/tools" },
        { label: "How it works", href: "/workflow" },
        { label: "Blog", href: "/blog" },
        { label: "Pricing", href: "/pricing" },
        { label: "FAQ", href: "/faq" }
      ],
      footerLinks: [
        { label: "Privacy Policy", href: "/privacy", group: "support" },
        { label: "Terms of Service", href: "/terms", group: "support" },
        { label: "Cookie Policy", href: "/cookies", group: "support" },
        { label: "KIDS Act", href: "/children-privacy", group: "support" },
        { label: "DPDPA", href: "/state-privacy", group: "support" },
        { label: "Content policy", href: "/content", group: "support" },
        { label: "FAQ", href: "/faq", group: "company" },
        { label: "Blog", href: "/blog", group: "company" },
        { label: "About us", href: "/about-us", group: "company" },
        { label: "Contact us", href: "/contact-us", group: "company" },
        { label: "Creators Circle", href: "/creators-circle", group: "company" },
        { label: "Refund Policy", href: "/refunds", group: "company" }
      ]
    },
    globalSections: {
      header: {
        settings: {
          title: "myᕲreamshoots",
          sticky: true,
          ctaLabel: "Create my first photo set",
          ctaHref: "/login",
          style: "dark_pills",
          mobileLabel: "Menu",
          logoImageUrl: "/assets/dreamshoot/brand/dreamshootai-logo-refined.svg?v=20260621b",
          logoAlt: "MyDreamShoots heart camera logo"
        },
        blocks: [
          { id: "dreamshoot_header_packs", type: "menu_link", settings: { label: "Browse packages", href: "/collections" } },
          { id: "dreamshoot_header_tools", type: "menu_link", settings: { label: "Tools", href: "/tools" } },
          { id: "dreamshoot_header_workflow", type: "menu_link", settings: { label: "How it works", href: "/workflow" } },
          { id: "dreamshoot_header_blog", type: "menu_link", settings: { label: "Blog", href: "/blog" } },
          { id: "dreamshoot_header_pricing", type: "menu_link", settings: { label: "Pricing", href: "/pricing" } },
          { id: "dreamshoot_header_faq", type: "menu_link", settings: { label: "FAQ", href: "/faq" } },
          ...dreamshootMegaTools
        ]
      },
      footer: {
        settings: {
          title: "myᕲreamshoots",
          logoImageUrl: "/assets/dreamshoot/brand/dreamshootai-logo-refined.svg?v=20260621b",
          logoAlt: "MyDreamShoots heart camera logo",
          tagline: "Private AI photo sets with visible credit costs and gallery delivery",
          body: "Upload your selfies, choose a style, review the credit cost, and download a private photo set.",
          productHeading: "Explore",
          companyHeading: "Content",
          supportHeading: "Support",
          socialHeading: "Why it works",
          socialBody: "MyDreamShoots helps you turn your own photos into private AI headshots, portraits, and themed albums.",
          instagramUrl: "https://www.instagram.com/mydreamshoots",
          facebookUrl: "https://www.facebook.com/mydreamshoots",
          pinterestUrl: "https://www.pinterest.com/mydreamshoots",
          youtubeUrl: "https://www.youtube.com/@mydreamshoots",
          twitterUrl: "https://x.com/mydreamshoots",
          showPaymentIcons: true,
          companyName: "myDreamshoots.com",
          contactAddress: "8 THE GREEN STE B,DOVER,DE 19901",
          contactPhone: "",
          contactEmail: "support@mydreamshoots.com",
          taxIdLabel: "",
          taxId: "",
          salesEmail: "",
          bottomLine: "Monthly credits, one-time top-ups, and private galleries in one photo workspace.",
          copyright: "© 2026 myDreamshoots.com. All rights reserved."
        },
        blocks: [
          { id: "dreamshoot_footer_pricing", type: "menu_link", settings: { label: "Pricing", href: "/pricing", group: "product" } },
          { id: "dreamshoot_footer_packs", type: "menu_link", settings: { label: "Packs", href: "/collections", group: "product" } },
          { id: "dreamshoot_footer_tools", type: "menu_link", settings: { label: "Tools", href: "/tools", group: "product" } },
          { id: "dreamshoot_footer_tool", type: "menu_link", settings: { label: "Headshot maker", href: toolHref("headshot"), group: "product" } },
          { id: "dreamshoot_footer_help", type: "menu_link", settings: { label: "FAQ", href: "/faq", group: "company" } },
          { id: "dreamshoot_footer_privacy", type: "menu_link", settings: { label: "Privacy Policy", href: "/privacy", group: "support" } },
          { id: "dreamshoot_footer_terms", type: "menu_link", settings: { label: "Terms of Service", href: "/terms", group: "support" } },
          { id: "dreamshoot_footer_cookies", type: "menu_link", settings: { label: "Cookie Policy", href: "/cookies", group: "support" } },
          { id: "dreamshoot_footer_children_privacy", type: "menu_link", settings: { label: "KIDS Act", href: "/children-privacy", group: "support" } },
          { id: "dreamshoot_footer_state_privacy", type: "menu_link", settings: { label: "DPDPA", href: "/state-privacy", group: "support" } },
          { id: "dreamshoot_footer_content", type: "menu_link", settings: { label: "Content policy", href: "/content", group: "support" } },
          { id: "dreamshoot_footer_guides", type: "menu_link", settings: { label: "Blog", href: "/blog", group: "company" } },
          { id: "dreamshoot_footer_about", type: "menu_link", settings: { label: "About us", href: "/about-us", group: "company" } },
          { id: "dreamshoot_footer_contact", type: "menu_link", settings: { label: "Contact us", href: "/contact-us", group: "company" } },
          { id: "dreamshoot_footer_creators", type: "menu_link", settings: { label: "Creators Circle", href: "/creators-circle", group: "company" } },
          { id: "dreamshoot_footer_refunds", type: "menu_link", settings: { label: "Refund Policy", href: "/refunds", group: "company" } }
        ]
      }
    },
    seo: {
      siteTitle: "MyDreamShoots",
      siteDescription: "AI photo package subscription with personal AI models, private uploads, paid tools, AI video-ready outputs, and customer-only galleries.",
      siteKeywords: "",
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
          card_name: "MyDreamShoots header",
          settings: {
            is_announce_show: true,
            announce_title: "Create private AI photo sets from everyday selfies.",
            announce_color: "#ffffff",
            announce_bg_color: "#05070E"
          },
          blocks: []
        },
        footer_plus: {
          type: "footer_plus",
          version: "1",
          card_name: "MyDreamShoots footer",
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
