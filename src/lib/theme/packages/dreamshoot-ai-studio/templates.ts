import type { SectionBlockInstance, SectionInstance, SectionType, ThemePageJson, ThemeSettingValue } from "@/lib/types";
import type { ThemePackageSiteSettings, ThemePackageTemplateKey } from "../types";
import { isAidreamcapesSite as isAidreamcapesCapabilitySite } from "@/lib/storefront-context/capabilities";

export type MydreamShootsAiStudioTemplateKey =
  | ThemePackageTemplateKey
  | "tools"
  | "workflow"
  | "help"
  | "faq"
  | "creators-circle"
  | "partner-registration"
  | "about-us"
  | "contact-us"
  | "best-packages"
  | "best-ai-image"
  | "best-ai-video";

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

type DreamshootPublicSeoSiteSeed = { id: string; slug: string; name: string; primaryDomain: string; branding?: { logoText?: string } };

function seoForPublicPage(_path: string, _site?: DreamshootPublicSeoSiteSeed): ThemePageJson["seo"] {
  // SEO is authored on ThemePage and is intentionally absent from template defaults.
  return undefined;
}

function isAidreamcapesTemplateSite(site?: DreamshootPublicSeoSiteSeed): boolean {
  return Boolean(site && isAidreamcapesCapabilitySite(site));
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
  galleryChristmasCoupleCover: versionedAsset("/assets/dreamshoot/generated/pack-covers/christmas-couple/christmas-couple-cover.webp"),
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

const mydreamshootsTrustedLogoAssetBase = "/assets/dreamshoot/brand/trusted-creators-dark-v2";
const aidreamcapesTrustedLogoAssetBase = "/assets/sites/site_aidreamcapes/trusted-logos";
const mydreamshootsAboutBody = "myDreamshoots is an AI photo and video studio. Upload photos you are authorized to use, choose a supported workflow, review the current credit cost, and generate results inside your signed-in workspace.";
const aidreamcapesAboutBody = "Aidreamcapes is an AI photo and video studio: upload your photos, choose a theme, review the published price and credit cost, and download finished results from your private gallery.";
const mydreamshootsTrustedLogoDefinitions = [
  { key: "ikraddy", name: "iKraddy", file: "01__ikraddy.webp" },
  { key: "beer", name: "Beer", file: "02__beer.webp" },
  { key: "fumei", name: "FUMEI", file: "03__fumei.webp" },
  { key: "mrlin", name: "MRLIN", file: "04__mrlin.webp" },
  { key: "popo", name: "POPO", file: "05__popo.webp" },
  { key: "mr-sdm", name: "MR.SDM", file: "06__mr-sdm.webp" },
  { key: "ezzy", name: "EZZY", file: "07__ezzy.webp" },
  { key: "xraz", name: "XRAZ", file: "08__xraz.webp" },
  { key: "giantdc", name: "Giantdc", file: "09__giantdc.webp" },
  { key: "smart-check", name: "SMART Check", file: "10__smart-check.webp" },
  { key: "jo", name: "JO", file: "11__jo.webp" },
  { key: "mashtacore", name: "Mashtacore", file: "12__mashtacore.webp" },
  { key: "fb", name: "FB", file: "13__fb.webp" },
  { key: "shurong-lim", name: "SHURONG LIM", file: "14__shurong-lim.webp" },
  { key: "coffee-swap", name: "COFFEE SWAP", file: "15__coffee-swap.webp" },
  { key: "heart-beat", name: "HEART BEAT", file: "16__heart-beat.webp" },
  { key: "chinawuzhougem", name: "CHINAWUZHOUGEM", file: "17__chinawuzhougem.webp" },
  { key: "tosaco", name: "TOSACO", file: "18__tosaco.webp" },
  { key: "monkey", name: "Monkey", file: "19__monkey.webp" },
  { key: "yu-kidsrooms", name: "YU kidsrooms", file: "20__yu-kidsrooms.webp" },
  { key: "yx", name: "YX", file: "21__yx.webp" },
  { key: "laboom", name: "LABOOM", file: "22__laboom.webp" },
  { key: "moonpizza", name: "MOONPIZZA", file: "23__moonpizza.webp" },
  { key: "observer", name: "OBSERVER", file: "24__observer.webp" },
  { key: "anteater", name: "Anteater", file: "25__anteater.webp" },
  { key: "prevence", name: "Prevence", file: "26__prevence.webp" },
  { key: "bison", name: "BISON", file: "27__bison.webp" },
  { key: "hana-pet", name: "HANA PET", file: "28__hana-pet.webp" },
  { key: "oficina", name: "Oficina", file: "29__oficina.webp" },
  { key: "panda-ber", name: "Panda BER", file: "30__panda-ber.webp" }
];
const trustedLogoDefinitions = [
  { key: "wliano", name: "Wliano", file: "39__wliano__wliano.com.png" },
  { key: "hmaxio", name: "Hmaxio", file: "13__hmaxio__hmaxio.co.za.png" },
  { key: "invorae", name: "Invorae", file: "14__invorae__invorae.com.png" },
  { key: "bolvian", name: "Bolvian", file: "03__bolvian__bolvian.co.za.png" },
  { key: "ravinr", name: "Ravinr", file: "24__ravinr__ravinr.co.za.png" },
  { key: "luntra", name: "Luntra", file: "19__luntra__luntra.co.za.png" },
  { key: "yaveno", name: "Yaveno", file: "44__yaveno__yaveno.co.za.png" },
  { key: "vkovel", name: "Vkovel", file: "37__vkovel__vkovel.com.webp" },
  { key: "orvinoe", name: "Orvinoe", file: "21__orvinoe__orvinoe.com.png" },
  { key: "elvorae", name: "Elvorae", file: "06__elvorae__elvorae.co.za.png" },
  { key: "trovic", name: "Trovic", file: "31__trovic__trovic.co.za.png" },
  { key: "aroveno", name: "Aroveno", file: "02__aroveno__aroveno.co.za.png" },
  { key: "ulvanx", name: "Ulvanx", file: "33__ulvanx__ulvanx.com.png" },
  { key: "kernivo", name: "Kernivo", file: "17__kernivo__kernivo.com.png" },
  { key: "bpickr", name: "Bpickr", file: "04__bpickr__bpickr.co.za.png" },
  { key: "jurvina", name: "Jurvina", file: "15__jurvina__jurvina.com.png" },
  { key: "zervino", name: "Zervino", file: "45__zervino__zervino.co.za.png" },
  { key: "harlivo", name: "Harlivo", file: "12__harlivo__harlivo.com.png" },
  { key: "qervon", name: "Qervon", file: "22__qervon__qervon.com.png" },
  { key: "zuvric", name: "Zuvric", file: "46__zuvric__zuvric.com.png" },
  { key: "urmino", name: "Urmino", file: "34__urmino__urmino.com.png" },
  { key: "wlivon", name: "Wlivon", file: "41__wlivon__wlivon.com.png" },
  { key: "rpfira", name: "Rpfira", file: "25__rpfira__rpfira.com.png" },
  { key: "klnova", name: "Klnova", file: "42__klnova__klnova.com.png" },
  { key: "qmarto", name: "Qmarto", file: "47__qmarto__xn--qmarto-220j.co.za.png" },
  { key: "folvian", name: "Folvian", file: "09__folvian__folvian.com.webp" },
  { key: "gmarto", name: "Gmarto", file: "10__gmarto__gmarto.co.za.png" },
  { key: "tuzemo", name: "Tuzemo", file: "32__tuzemo__tuzemo.com.png" },
  { key: "ervanoe", name: "Ervanoe", file: "07__ervanoe__ervanoe.com.webp" }
] as const;

function trustedLogoBlocks(definitions: ReadonlyArray<{ key: string; name: string; file: string }>, basePath: string, prefix: string) {
  return definitions.map(({ key, name, file }) =>
    block(`${prefix}${key}`, "logo", { name, imageUrl: `${basePath}/${file}`, badge: "Creator proof" })
  );
}

const mydreamshootsTrustedLogoBlocks = trustedLogoBlocks(mydreamshootsTrustedLogoDefinitions, mydreamshootsTrustedLogoAssetBase, "trusted_logo_");
const aidreamcapesTrustedLogoBlocks = trustedLogoBlocks(trustedLogoDefinitions, aidreamcapesTrustedLogoAssetBase, "aidream_trusted_logo_");
const mydreamshootsWorkflowExampleBlocks: SectionBlockInstance[] = mydreamshootsTrustedLogoBlocks.map((logo) =>
  block(logo.id, "logo", { ...logo.settings, badge: "Workflow example" })
);

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
      headline: "Create Professional AI Headshots and Photo Sets Without a Studio",
      subheadline: "Upload a few approved photos and choose the result you want - from professional headshots and portraits to wedding, engagement, seasonal, creative, and supported video workflows. Review the examples and credit cost before generation, then check the finished results in your signed-in workspace before downloading.",
      imageUrl: assets.heroPackageWall,
      secondaryImageUrl: assets.heroCreditStudioCard,
      tertiaryImageUrl: assets.gala,
      heroGridImages: [assets.heroGridBusiness, assets.heroGridBeauty, assets.heroGridCyber, assets.heroGridTravel, assets.heroGridSports, assets.heroGridAvatar, assets.heroGridProduct, assets.heroGridVideo, assets.heroGridSocial, assets.heroGridNoir, assets.heroGridUpscale].join("|"),
      bulletList:
        "Training policy - {LIVE_TRAINING_POLICY_STATEMENT}|Source-photo retention - Input photos follow the published {LIVE_SOURCE_MEDIA_RETENTION_DAYS}-day retention period.|Refund policy - {LIVE_REFUND_REVIEW_POLICY_STATEMENT}|Secure account workflow - Uploads, requests, credit review, and galleries stay inside your signed-in account.",
      highlightWord: "AI Headshots",
      heroBadge: "AI Headshot Generators",
      authRibbon: "Review credits before generation",
      authPrimaryLabel: "Continue with Google",
      authEmailPlaceholder: "Email address",
      authButtonLabel: "Create my first photo set with Email",
      authPrimaryHref: "/login?mode=login",
      authEmailHref: "/login?mode=register",
      imageBadge: "{LIVE_AI_IMAGE_WORKFLOW_COUNT} AI image workflows",
      imageCaption: "Create a private AI photo set for professional profiles, portraits, couples, seasonal images, creative styles, or other supported workflows.",
      socialProofLabel: "Private uploads, requests, galleries",
      layout: "immersive_dark"
    },
    [
      block("hero_cta_primary", "cta", { label: "Create Now", href: "/login", style: "primary" }),
      block("hero_cta_secondary", "cta", { label: "Headshot Generator", href: "/ai-image-generation/headshot", style: "secondary" }),
      block("hero_stat_credits", "stat", { value: "Credits", label: "shown before generation" }),
      block("hero_stat_packs", "stat", { value: "{LIVE_AI_IMAGE_WORKFLOW_COUNT}", label: "AI image workflows" }),
      block("hero_stat_private", "stat", { value: "Private", label: "uploads, requests, galleries" })
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
      block("proof_worldcup", "proof_card", { title: "Soccer", description: "Stadium fan posters, match-day group shots, and social-ready supporter portraits.", category: "Lifestyle & Creative", badge: "Featured", imageUrl: assets.galleryWorldCupFanOne, href: "/ai-image-generation/soccer" }),
      block("proof_sports_meetup", "proof_card", { title: "Soccer fan scenes", description: "Create fan meetup scenes, tunnel portraits, and group-photo moments with permission-safe sports styling.", category: "Lifestyle & Creative", badge: "Soccer", imageUrl: assets.galleryWorldCupFanTwo, href: "/ai-image-generation/soccer" }),
      block("proof_vip", "proof_card", { title: "Red-carpet fan moments", description: "VIP-style portraits, creator gala looks, and red-carpet fan snapshots from approved source photos.", category: "VIP Looks", badge: "VIP Looks", imageUrl: assets.galleryGalaOne, href: "/ai-image-generation/gala-photo" }),
      block("proof_christmas", "proof_card", { title: "Christmas Photo", description: "Festive couple, family-style, and friend-group portraits for cards, posts, and private albums.", category: "Best Themes & Presets", badge: "Christmas", imageUrl: assets.galleryChristmasPhotosOne, href: "/ai-image-generation/christmas-photo" }),
      block("proof_seasonal", "proof_card", { title: "Seasonal holiday albums", description: "Holiday portraits for Christmas cards, Thanksgiving warmth, Halloween mood, and private group albums.", category: "Seasonal", badge: "Seasonal", imageUrl: assets.gallerySeasonalFallback, href: "/ai-image-generation/holiday" })
    ]
  ),
  featured_pack_1: section(
    "dreamshoot_featured_pack",
    {
      anchor: "featured-pack",
      label: "Featured seasonal pack",
      badge: "Match-day pack",
      title: "Soccer fan photos for match-day style moments.",
      subtitle: "Turn everyday selfies into fan meetups, stadium-style group photos, match-day posters, and private albums built for social sharing.",
      primaryCta: "Create Fan Photos",
      primaryHref: "/login",
      secondaryCta: "View Sports Packs",
      secondaryHref: "/ai-image-generation",
      photos: "Private gallery",
      credits: "",
      privacy: "Private album",
      includedTitle: "Included outputs",
      includedOutputs: "Fan meetup photos|Group-friendly shots for match day|Stadium portraits|Cinematic scenes with floodlights|Match-day avatars|Profile-ready square crops|Social banners|Wide cover images for sharing",
      safetyCopy: "Fan-safe styling: no real player or celebrity likenesses, official team logos, event marks, or protected brand assets without permission.",
      overlayTitle: "Soccer Pack",
      overlaySubtitle: "Sports-idol style fan photos without a studio.",
      overlayChips: "fan meetup|group shot|stadium|social-ready",
      bottomNote: "Seasonal packs rotate around tournaments, Christmas, Thanksgiving, Halloween, and personal fan-photo moments.",
      campaignLabel: "Current campaign: Soccer",
      nextCampaignLabel: "Next: Christmas / Thanksgiving / Halloween"
    },
    [
      block("seasonal_worldcup_1", "seasonal_image", { label: "Stadium Portrait", meta: "Cinematic fan look", imageUrl: assets.worldCupStadiumPortrait, collectionSlug: "soccer", shape: "tall" }),
      block("seasonal_worldcup_2", "seasonal_image", { label: "Fan Meetup Photos", meta: "Group-friendly shots", imageUrl: assets.worldCupFriendFans, collectionSlug: "gala-photo", shape: "wide" }),
      block("seasonal_worldcup_3", "seasonal_image", { label: "Match-day Avatar", meta: "Profile-ready crop", imageUrl: assets.worldCupAvatar, collectionSlug: "avatar", shape: "square" }),
      block("seasonal_worldcup_4", "seasonal_image", { label: "Fan Poster", meta: "Story and feed artwork", imageUrl: assets.worldCupFanPoster, collectionSlug: "soccer", shape: "tall" }),
      block("seasonal_worldcup_5", "seasonal_image", { label: "Social Story", meta: "Mobile-first layout", imageUrl: assets.worldCupSocialStory, collectionSlug: "thanksgiving-photo", shape: "tall" }),
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
      secondaryHref: "/ai-image-generation/christmas-photo",
      photos: "Holiday cards",
      credits: "",
      privacy: "Private album",
      includedTitle: "Included outputs",
      includedOutputs: "Christmas portraits|Festive group scenes|Greeting-card covers|Cozy card-ready crops|Private album images|Warm holiday downloads|Social posts|Square profile crops",
      safetyCopy: "Use photos you own or have permission to use. myDreamshoots does not recreate protected brand marks, official holiday artwork, celebrity likenesses, or public figures without permission.",
      overlayTitle: "Christmas Photos",
      overlaySubtitle: "Festive holiday portraits without a studio.",
      overlayChips: "Christmas cards|group portraits|cozy scenes|private",
      bottomNote: "Holiday packs can cover Christmas cards, group portraits, couple keepsakes, Thanksgiving warmth, and private seasonal albums.",
      campaignLabel: "Current campaign: Christmas Photos",
      nextCampaignLabel: "Next: Thanksgiving / Halloween / Seasonal"
    },
    [
      block("seasonal_christmas_1", "seasonal_image", { label: "Christmas Portraits", meta: "Card-ready mood", imageUrl: "/assets/dreamshoot/generated/pack-galleries/christmas-photos/christmas-photos-06.webp", collectionSlug: "christmas-photo", shape: "square" }),
      block("seasonal_christmas_2", "seasonal_image", { label: "Greeting Card Scene", meta: "Festive group crop", imageUrl: "/assets/dreamshoot/generated/pack-galleries/christmas-photos/christmas-photos-07.webp", collectionSlug: "christmas-photo", shape: "square" }),
      block("seasonal_christmas_3", "seasonal_image", { label: "Cozy Couple", meta: "Warm keepsake", imageUrl: "/assets/dreamshoot/generated/pack-galleries/christmas-couple/christmas-couple-04.webp", collectionSlug: "christmas-photo", shape: "square" }),
      block("seasonal_christmas_4", "seasonal_image", { label: "Holiday Cover", meta: "Private album art", imageUrl: assets.galleryChristmasCover, collectionSlug: "christmas-photo", shape: "square" }),
      block("seasonal_christmas_5", "seasonal_image", { label: "Seasonal Album", meta: "Family-style glow", imageUrl: "/assets/dreamshoot/generated/pack-galleries/christmas-photos/christmas-photos-08.webp", collectionSlug: "christmas-photo", shape: "square" }),
      block("seasonal_christmas_6", "seasonal_image", { label: "Giftable Keepsake", meta: "Social-ready crop", imageUrl: "/assets/dreamshoot/generated/pack-galleries/christmas-couple/christmas-couple-05.webp", collectionSlug: "christmas-photo", shape: "square" })
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
      secondaryHref: "/ai-image-generation/thanksgiving-photo",
      photos: "Group portraits",
      credits: "",
      privacy: "Private gallery",
      includedTitle: "Included outputs",
      includedOutputs: "Dinner-table portraits|Warm gathering scenes|Friendsgiving memories|Group-friendly crops|Gratitude cards|Seasonal notes|Private album covers|Download-ready images",
      safetyCopy: "Use clear photos you own or have permission to use. myDreamshoots keeps Thanksgiving sets private and avoids protected people, marks, or brand assets without permission.",
      overlayTitle: "Thanksgiving Photos",
      overlaySubtitle: "Warm gratitude scenes from approved photos.",
      overlayChips: "group portraits|gratitude cards|Friendsgiving|private",
      bottomNote: "Thanksgiving packs work best with clear group photos, warm setting cues, and simple album goals.",
      campaignLabel: "Current campaign: Thanksgiving Photo",
      nextCampaignLabel: "Next: Christmas / Halloween / Seasonal"
    },
    [
      block("seasonal_thanksgiving_1", "seasonal_image", { label: "Dinner Portraits", meta: "Warm table scene", imageUrl: versionedAsset("/assets/dreamshoot/generated/pack-galleries/thanksgiving-group-photos/thanksgiving-group-photos-05.webp"), collectionSlug: "thanksgiving-photo", shape: "square" }),
      block("seasonal_thanksgiving_2", "seasonal_image", { label: "Friendsgiving Set", meta: "Group-friendly crop", imageUrl: versionedAsset("/assets/dreamshoot/generated/pack-galleries/thanksgiving-group-photos/thanksgiving-group-photos-06.webp"), collectionSlug: "thanksgiving-photo", shape: "square" }),
      block("seasonal_thanksgiving_3", "seasonal_image", { label: "Gratitude Card", meta: "Seasonal note", imageUrl: versionedAsset("/assets/dreamshoot/generated/pack-galleries/thanksgiving-group-photos/thanksgiving-group-photos-07.webp"), collectionSlug: "thanksgiving-photo", shape: "square" }),
      block("seasonal_thanksgiving_4", "seasonal_image", { label: "Keepsake Cover", meta: "Private album art", imageUrl: assets.galleryThanksgivingFallback, collectionSlug: "thanksgiving-photo", shape: "square" }),
      block("seasonal_thanksgiving_5", "seasonal_image", { label: "Family-style Album", meta: "Harvest warmth", imageUrl: versionedAsset("/assets/dreamshoot/generated/pack-galleries/thanksgiving-group-photos/thanksgiving-group-photos-08.webp"), collectionSlug: "thanksgiving-photo", shape: "square" }),
      block("seasonal_thanksgiving_6", "seasonal_image", { label: "Host Story", meta: "Download-ready image", imageUrl: versionedAsset("/assets/dreamshoot/generated/pack-galleries/thanksgiving-group-photos/thanksgiving-group-photos-09.webp"), collectionSlug: "thanksgiving-photo", shape: "square" })
    ]
  ),
  package_catalog_1: section(
    "dreamshoot_package_catalog",
    {
      anchor: "packages",
      label: "AI PHOTO STUDIOS",
      title: "AI Photo Packages by Style and Use Case",
      subtitle: "Browse all {LIVE_AI_IMAGE_WORKFLOW_COUNT} active myDreamshoots themes before spending credits.",
      directoryLabel: "AI PHOTO THEMED",
      directorySubtitle: "Compare every active theme by category, title, cover, and route before starting a private photo package.",
      tabs: "All|Fan Photos|Sports Stars|VIP Looks|Christmas|Thanksgiving|Halloween|Seasonal|Creator|Video|Utility",
      steps: "Pick pack|See credit cost|Generate album",
      source: "creative_packs",
      featuredCount: 12
    },
    [
      block("catalog_worldcup", "catalog_pack", { title: "Soccer", description: "Create soccer fan portraits, match-day posters, stadium group shots, and social-ready avatars from your own selfies. For personal fan use only; no official logos, player likenesses, celebrity likenesses, or official marks without permission.", category: "Lifestyle & Creative", meta: "Fan meetups", credits: "", imageUrl: assets.galleryWorldCupFanFour, href: "/ai-image-generation/soccer" }),
      block("catalog_christmas", "catalog_pack", { title: "Christmas Photo", description: "Create festive group portraits, greeting-card visuals, cozy couple scenes, and warm seasonal images.", category: "Best Themes & Presets", meta: "Holiday cards", credits: "", imageUrl: assets.galleryChristmasPhotosOne, href: "/ai-image-generation/christmas-photo" }),
      block("catalog_nightlife", "catalog_pack", { title: "Nightlife", description: "Create polished night-out portraits, social profile crops, and neon-lit personal scenes from photos you own or can use.", category: "Lifestyle & Creative", meta: "Night-out looks", credits: "", imageUrl: assets.galleryChristmasCoupleOne, href: "/ai-image-generation/nightlife" }),
      block("catalog_holiday", "catalog_pack", { title: "Holiday", description: "Create seasonal portraits for Christmas, Thanksgiving, Halloween, family-style cards, and private group albums.", category: "Seasonal", meta: "Seasonal albums", credits: "", imageUrl: assets.galleryHolidayFallback, href: "/ai-image-generation/holiday" }),
      block("catalog_creator_vip", "catalog_pack", { title: "Portrait Photo", description: "Create VIP-style creator portraits, red-carpet fan snapshots, and polished personal-brand images from approved photos.", category: "Professional", meta: "Red-carpet looks", credits: "", imageUrl: assets.galleryGalaOne, href: "/ai-image-generation/portrait-photo" }),
      block("catalog_thanksgiving", "catalog_pack", { title: "Thanksgiving Photo", description: "Create warm family-style portraits, dinner-table keepsakes, gratitude cards, and private seasonal albums.", category: "Best Themes & Presets", meta: "Group portraits", credits: "", imageUrl: assets.galleryThanksgivingFallback, href: "/ai-image-generation/thanksgiving-photo" }),
      block("catalog_halloween", "catalog_pack", { title: "Halloween Photo", description: "Create costume-party portraits, spooky group cards, cinematic VIP looks, and seasonal social images.", category: "Best Themes & Presets", meta: "Party albums", credits: "", imageUrl: assets.galleryHalloweenFallback, href: "/ai-image-generation/halloween-photo" })
    ]
  ),
  generation_showcase_1: section(
    "dreamshoot_generation_showcase",
    {
      anchor: "generated-showcase",
      showTrustedLogoIntro: false,
      embeddedPricingSectionId: "pricing_1",
      eyebrow: "Customer-created examples",
      title: "Browse image and video themes customers have already created.",
      subtitle: "Scan photo themes and supported video workflows before you upload approved photos, review credits, and generate inside your signed-in workspace.",
      imageTitle: "Best Photo Generator",
      imageAllLabel: "VIEW ALL PHOTO",
      imageAllHref: "/best-ai-image",
      videoTitle: "Best Video Generator",
      videoAllLabel: "VIEW ALL VIDEO",
      videoAllHref: "/best-ai-video",
      imageSlugs: "world-cup-fan-photos|christmas-couple|christmas-photos|creator-portraits|gala-photos|holiday|professional-headshots|cyberpunk",
      videoSlugs: "cinematic-portrait-motion|social-profile-clip|travel-route-story|wedding-memory-film|holiday-card-motion|product-showcase-motion|prompt-directed-motion|creator-intro-motion",
      videoItemLimit: 8,
      primaryCta: "Start with your photos",
      primaryHref: "/app/create"
    },
    []
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
      block("flow_upload", "card", { title: "Private by default", text: "Your uploads stay private inside your signed-in myDreamshoots account with your jobs, albums, downloads, and credit history. Only upload photos you own or have permission to use.", meta: "01" }),
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
      title: "AI Photo Packages by Style and Use Case",
      subtitle: "Browse all {LIVE_AI_IMAGE_WORKFLOW_COUNT} active myDreamshoots themes before spending credits. Your uploads stay private by default.",
      layout: "editorial"
    },
    [
      block("taxonomy_headshot", "taxonomy_card", { title: "Headshot", description: "Profile photos for LinkedIn, founders, resumes, and teams. Not for official IDs or impersonation.", meta: "Professional", keywords: "headshot|linkedin|resume", imageUrl: assets.manPortrait, href: "/ai-image-generation/headshot" }),
      block("taxonomy_style", "taxonomy_card", { title: "Hairstyle Generator", description: "Hairstyles, beauty portraits, virtual try-on, and polished creator looks with visual previews, not exact fit guarantees.", meta: "Magic", keywords: "hairstyle|beauty|virtual try-on", imageUrl: assets.womanPortrait, href: "/ai-image-generation/hairstyle-generator" }),
      block("taxonomy_boudoir", "taxonomy_card", { title: "Boudoir", description: "Tasteful, private, non-explicit portrait concepts for consenting adults only. Do not upload minors, non-consenting people, stolen images, or unauthorized portraits.", meta: "Adult consent", keywords: "boudoir|private portraits|consent", imageUrl: assets.womanPortrait, href: "/ai-image-generation/boudoir" }),
      block("taxonomy_worlds", "taxonomy_card", { title: "Lifestyle & Creative", description: "Cyberpunk, mafia, travel, gala, and dramatic themed photos.", meta: "Creative", keywords: "cyberpunk|mafia|travel|gala", imageUrl: assets.cyberpunkSample, href: "/ai-image-generation" }),
      block("taxonomy_sports", "taxonomy_card", { title: "Soccer", description: "Stadium fan scenes, fan posters, and match-day profile photos for personal fan use without official logos or player likenesses.", meta: "Lifestyle & Creative", keywords: "soccer photos|football fan photo|match day avatar", imageUrl: assets.worldCupStadiumPortrait, href: "/ai-image-generation/soccer" }),
      block("taxonomy_video", "taxonomy_card", { title: "Motion Generator", description: "Turn finished package outputs into short social-friendly motion concepts.", meta: "Magic", keywords: "image to video|motion|social", imageUrl: assets.upscaler, href: "/ai-image-generation/motion-generator" }),
      block("taxonomy_creator", "taxonomy_card", { title: "Portrait Photo", description: "Portfolio, creator, campaign, and personal-brand scenes for everyday buyers.", meta: "Professional", keywords: "portrait photo|portfolio|personal brand", imageUrl: assets.avatarPortrait, href: "/ai-image-generation/portrait-photo" })
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
    subtitle: "Start with studio tools, choose a plan for premium generation, then receive finished images in a private myDreamshoots album.",
    source: "blocks",
    layout: "steps"
  }, [
    block("pkg_path_upload", "card", { title: "Private by default", text: "Your uploads stay private inside your signed-in myDreamshoots account with your jobs, albums, downloads, and credit history. Only upload photos you own or have permission to use.", meta: "Step 01", imageUrl: assets.upload }),
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
        description: "Start from a guided theme like headshot, soccer, cyberpunk, gala photo, travel, hairstyle generator, portrait photo, or photo-tool collections with credits shown before generation.",
        imageUrl: assets.worldCupFan,
        href: "/ai-image-generation"
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
      block("trust_no_training", "stat", { value: "Training policy", label: "{LIVE_TRAINING_POLICY_STATEMENT}" }),
      block("trust_auto_delete", "stat", { value: "Source-photo retention", label: "Input photos follow the published {LIVE_SOURCE_MEDIA_RETENTION_DAYS}-day retention period." }),
      block("trust_refund", "stat", { value: "Refund policy", label: "{LIVE_REFUND_REVIEW_POLICY_STATEMENT}", linkLabel: "Read the refund policy", href: "/refunds" }),
      block("trust_encryption", "stat", { value: "Secure account workflow", label: "Uploads, requests, credit review, and galleries stay inside your signed-in account." })
    ]
  ),
  plan_rules_1: section(
    "rich_text",
    {
      anchor: "plan-rules",
      eyebrow: "Plans and credits",
      title: "How credits work",
      body: "Credits are shown before generation starts, reserved when a request begins, used after successful delivery, and returned when a failed request releases the reservation. Your uploads stay private inside your signed-in myDreamshoots account with your jobs, albums, downloads, and credit history.",
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
      block("plan_rule_credits", "card", { meta: "How credits work", title: "Check credits before generation", description: "Credits are shown before generation starts, reserved when a request begins, used after successful delivery, and returned when a failed request releases the reservation." }),
      block("plan_rule_gallery", "card", { meta: "Private by default", title: "Your uploads stay private", description: "Your uploads stay private inside your signed-in myDreamshoots account with your jobs, albums, downloads, and credit history." })
    ]
  ),
  pricing_1: section("pricing_table", {
    anchor: "plans",
    title: "Subscription Plans",
    subtitle: "Compare the current price, included credits, renewal interval, and supported workflows before selecting a plan.",
    marketComparison: "Choose a monthly, quarterly, or semiannual plan based on the credits you expect to use. Compare the current price, included credits, renewal interval, and supported workflows before selecting a plan.",
    description: "Review the credit cost before each generation and use the current plan or top-up options when you need additional runs.",
    sidePanelEyebrow: "Why people subscribe",
    sidePanelTitle: "Plans start at {LIVE_LOWEST_ACTIVE_PLAN_PRICE}, with the current credit allowance and billing interval shown for each option.",
    sidePanelBody: "Review the credit cost before each generation and use the current plan or top-up options when you need additional runs.",
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
      title: "What Our Customers Say",
      subtitle: "Theme examples for fan meetup albums, VIP-style looks, Christmas cards, holiday groups, and short private clips.",
      summaryTitle: "Ways people use myDreamshoots",
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
        quote: "Pick a theme, check the credit cost, and keep every fan-photo or holiday result inside a private myDreamshoots gallery.",
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
        question: "Can I try myDreamshoots for free?",
        answer: "Some lightweight tools can be free. Private model creation and premium photo packages require credits because they use dedicated generation capacity."
      }),
      block("faq_credits", "faq_item", {
        question: "When are credits used?",
        answer: "Credit cost is shown before each generation. Different packages may use different credit amounts based on style, output size, and generation settings."
      }),
      block("faq_private", "faq_item", {
        question: "Are my uploaded photos private?",
        answer: "Yes. Source photos, generation jobs, albums, orders, and credits stay connected to your signed-in myDreamshoots account and are not public by default."
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
      eyebrow: "BEST AI MAKER",
      title: "Ready to try the myDreamshoots's Best AI Maker?",
      subtitle: "We've designed myDreamshoots to be as easy as possible to use, allowing you to focus on unleashing your creativity with complete peace of mind. Subscribe, upload, choose packages, generate results, and keep delivery in one workspace.",
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
    ctaLabel: "Headshot Generator",
    ctaHref: "/ai-image-generation/headshot"
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
    body: "myDreamshoots partners with creators, community builders, photographers, coaches, and niche publishers who can introduce private AI photo packages in a useful, trustworthy way. Share themed photo packs, source-photo tips, before-and-after stories, and seasonal campaign links while your audience keeps uploads, credits, and albums inside their own account.",
    headingLevel: "h1",
    tone: "dark",
    imageUrl: assets.heroGridSocial,
    primaryCta: "Apply as a partner",
    primaryHref: "/partner-registration",
    secondaryCta: "Explore photo packages",
    secondaryHref: "/ai-image-generation"
  }, [
    block("creator_intro_commission", "rich_text_card", { meta: "Channel", title: "Creator-ready campaigns", description: "Launch content around headshots, fan photos, gala portraits, avatars, and seasonal photo packs without building a photo product yourself." }),
    block("creator_intro_privacy", "rich_text_card", { meta: "Trust", title: "Private customer flow", description: "Followers sign in, upload, pay, generate, and download inside myDreamshoots, so you promote the experience without handling personal photos." }),
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
    body: "Tell us about your audience, preferred channels, publishing cadence, and the photo package angles you want to test. Approved partners receive a dedicated route, campaign notes, and a way to coordinate launch timing with the myDreamshoots team.",
    tone: "warm"
  }, [
    block("creator_step_apply", "rich_text_card", { meta: "01", title: "Apply", description: "Submit your creator profile, social links, audience notes, and the kind of campaign you want to run." }),
    block("creator_step_match", "rich_text_card", { meta: "02", title: "Match", description: "We review fit, confirm the channel, and suggest photo packages that make sense for your audience." }),
    block("creator_step_launch", "rich_text_card", { meta: "03", title: "Launch", description: "Publish with a partner route that sends customers to myDreamshoots packages, pricing, or a specific offer." }),
    block("creator_step_learn", "rich_text_card", { meta: "04", title: "Learn", description: "Track what resonates, refine the story, and plan follow-up drops around seasonal or niche photo themes." })
  ]),
  partner_form_1: section("rich_text", {
    eyebrow: "Partner application",
    title: "Apply for a reserved myDreamshoots promotion channel.",
    body: "Tell us who you reach, how you publish, and which myDreamshoots photo experiences would fit your audience. Approved partners can send customers to packages, pricing, or a specific private album offer.",
    headingLevel: "h1",
    layout: "application_form",
    tone: "dark",
    imageUrl: assets.proofCinematicWorlds,
    primaryCta: "Email partnership details",
    primaryHref: "mailto:partners@mydreamshoots.com?subject=myDreamshoots%20partner%20application",
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
    block("partner_expectation_compliance", "rich_text_card", { meta: "Rules", title: "Privacy and disclosure", description: "Partners should disclose AI use where appropriate and avoid collecting customer uploads outside myDreamshoots." }),
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
      authRibbon: "Plans start at {LIVE_LOWEST_ACTIVE_PLAN_PRICE}",
      authPrimaryLabel: "Continue with Google",
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
      block("aidream_catalog_fan", "catalog_pack", { title: "Private fan-scene album", description: "Create original fan-scene portraits and keepsake images from approved source photos without copying public figures, official marks, or protected logos.", category: "Fan Scenes", meta: "Fan albums", credits: "", imageUrl: aidreamcapesPublicAssets.fan, href: "/collections/private-fan-scene-album" }),
      block("aidream_catalog_game_day", "catalog_pack", { title: "Game-day group portraits", description: "Turn group photos into private game-day images, watch-party portraits, and personal supporter keepsakes.", category: "Game Day", meta: "Group portraits", credits: "", imageUrl: aidreamcapesPublicAssets.gameDay, href: "/collections/game-day-group-portraits" }),
      block("aidream_catalog_premiere", "catalog_pack", { title: "Premiere flash portraits", description: "Create polished premiere-inspired portraits, event-look images, and creator-ready gallery crops.", category: "Premiere", meta: "Flash portraits", credits: "", imageUrl: aidreamcapesPublicAssets.premiere, href: "/collections/premiere-flash-portraits" }),
      block("aidream_catalog_christmas", "catalog_pack", { title: "Christmas group album", description: "Build festive portraits, greeting-card images, warm group crops, and private holiday keepsakes.", category: "Christmas", meta: "Holiday album", credits: "", imageUrl: aidreamcapesPublicAssets.christmas, href: "/collections/christmas-group-album" }),
      block("aidream_catalog_thanksgiving", "catalog_pack", { title: "Thanksgiving keepsake table set", description: "Create warm table scenes, gratitude cards, Friendsgiving images, and family-style seasonal albums.", category: "Thanksgiving", meta: "Memory set", credits: "", imageUrl: aidreamcapesPublicAssets.thanksgiving, href: "/collections/thanksgiving-keepsake-table-set" }),
      block("aidream_catalog_halloween", "catalog_pack", { title: "Halloween party portrait set", description: "Create costume-party portraits, atmospheric group shots, and playful seasonal images from approved photos.", category: "Halloween", meta: "Party portraits", credits: "", imageUrl: aidreamcapesPublicAssets.halloween, href: "/collections/halloween-party-portrait-set" }),
      block("aidream_catalog_seasonal", "catalog_pack", { title: "Seasonal celebration photo set", description: "Plan occasion albums for parties, celebrations, gift notes, and private memory pages throughout the year.", category: "Seasonal", meta: "Celebrations", credits: "", imageUrl: aidreamcapesPublicAssets.seasonal, href: "/collections/seasonal-celebration-photo-set" })
    ]
  );
}

function mydreamshootsTutorialVideoSection(): SectionInstance {
  return section("video_feature", {
    anchor: "ai-video-tutorial",
    eyebrow: "AI video tutorial",
    title: "Turn selected images into a private AI video.",
    subtitle: "Watch the image-to-video flow: upload frame images, choose the video mode, set the aspect ratio and duration, generate the clip, and preview the finished motion result.",
    imageUrl: "/assets/dreamshoot/generated/homepage-showcase/posters/mydreamshoots-ai-video-tutorial-20260814.jpg",
    videoUrl: "/assets/dreamshoot/generated/homepage-showcase/videos/mydreamshoots-ai-video-tutorial-20260814.mp4",
    videoBadge: "AI image-to-video",
    playLabel: "Watch the myDreamshoots AI video tutorial"
  });
}

function mydreamshootsImageTutorialVideoSection(): SectionInstance {
  return section("video_feature", {
    anchor: "how-it-works",
    eyebrow: "How it works",
    title: "Watch the private photo package workflow.",
    subtitle: "Upload approved source photos, choose a workflow, review the credit cost, and generate inside your signed-in workspace.",
    supportingCopy: "Use a supported AI Video workflow when you want to turn an approved image or image set into a short motion result, then review the full clip before publishing.",
    imageUrl: "/assets/dreamshoot/generated/homepage-showcase/posters/mydreamshoots-ai-image-tutorial-20260814.jpg",
    imageAlt: "Homepage tutorial screenshot showing the AI headshot hero, navigation, and account signup panel.",
    videoUrl: "/assets/dreamshoot/generated/homepage-showcase/videos/mydreamshoots-ai-image-tutorial-20260814.mp4",
    videoBadge: "",
    playLabel: "Watch the myDreamshoots AI image tutorial"
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
    imageUrl: "/assets/sites/site_aidreamcapes/homepage-showcase/posters/aidreamcapes-ai-image-tutorial-55s.jpg?v=20260805imagepreview1",
    videoUrl: "/assets/sites/site_aidreamcapes/homepage-showcase/videos/aidreamcapes-ai-image-tutorial-55s.mp4?v=20260805imagepreview1",
    videoBadge: "AI image album workflow",
    playLabel: "Watch the Aidreamcapes AI image tutorial"
  });
}

function _mydreamshootsMobileVideoShowcaseSection(): SectionInstance {
  return section("mobile_video_showcase", {
    anchor: "mobile-video-tutorial",
    eyebrow: "Mobile tutorial",
    title: "Watch the private photo package workflow.",
    subtitle: "Upload approved source photos, choose a workflow, review the credit cost, and generate inside your signed-in workspace.",
    supportingCopy: "Use a supported AI Video workflow when you want to turn an approved image or image set into a short motion result, then review the full clip before publishing.",
    imageUrl: assets.flowPrivateAlbumWorkspace,
    imageAlt: "Mobile myDreamshoots workspace screen showing private source-photo setup, credit review, and finished AI photo gallery steps.",
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
  });
}

function aidreamcapesMobileVideoShowcaseSection(): SectionInstance {
  return section("mobile_video_showcase", {
    anchor: "mobile-video-tutorial",
    eyebrow: "Mobile tutorial",
    title: "Aidreamcapes mobile private album preview.",
    subtitle: "Compare portrait intake and album review steps in a vertical phone view.",
    imageUrl: aidreamcapesPublicAssets.gallery,
    imageAlt: "Mobile Aidreamcapes private album screen showing approved source-photo intake, fan-scene review, and finished gallery delivery.",
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
      mode: "use_cases",
      title: "Workflow examples from myDreamshoots use cases",
      subtitle: "Use-case examples for private photo packages, clear credit review, gallery delivery, and supported motion workflows.",
      summaryTitle: "Ways people use myDreamshoots",
      summaryBody: "Plan sports fan photos, VIP-style portraits, Christmas cards, professional headshots, creator scenes, and short motion previews before spending credits.",
      summaryRating: "",
      summaryMeta: "Private examples"
    },
    [
      block("review_ava", "testimonial", { quote: "Compare sports fan photo directions, credit cost, and private gallery delivery before creating a match-day album from approved personal photos.", name: "Sports fan workflow", role: "Sports fan photos", location: "Fan Photos", rating: "", avatarUrl: assets.reviewAvaAvatar, resultImageUrl: assets.galleryWorldCupFanThree }),
      block("review_lucas", "testimonial", { quote: "Plan VIP-style portraits and formal profile images from approved source photos, then review the finished options inside the signed-in workspace.", name: "VIP portrait workflow", role: "Formal portrait set", location: "VIP-style set", rating: "", avatarUrl: assets.reviewLucasAvatar, resultImageUrl: assets.galleryGalaTwo }),
      block("review_mia", "testimonial", { quote: "Compare Christmas couple, friend-card, and seasonal portrait directions before creating private card-ready images.", name: "Seasonal card workflow", role: "Holiday cards", location: "Christmas album", rating: "", avatarUrl: assets.reviewMiaAvatar, resultImageUrl: assets.galleryChristmasCoupleTwo }),
      block("review_noah", "testimonial", { quote: "Upload approved source photos, choose a package, review the visible credit cost, and keep finished results organized in one private gallery.", name: "Gallery workflow", role: "Private gallery delivery", location: "Credit planning", rating: "", avatarUrl: assets.reviewNoahAvatar, resultImageUrl: assets.flowPrivateAlbumWorkspace }),
      block("review_chloe", "testimonial", { quote: "Test creator portraits, holiday images, and supported motion ideas from the same approved source photos before choosing the next workflow.", name: "Creator workflow", role: "Creator scene planning", location: "Creator workflow", rating: "", avatarUrl: assets.womanPortrait, resultImageUrl: assets.galleryCreatorOne }),
      block("review_eli", "testimonial", { quote: "Use credit-aware headshot and card workflows when a small team needs private images without a studio appointment.", name: "Team workflow", role: "Headshots and cards", location: "Clear credits", rating: "", avatarUrl: assets.selfie, resultImageUrl: assets.galleryCreatorTwo })
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
    { anchor: "workflow-examples", title: "Creative workflow examples built with myDreamshoots.", style: "dark" },
    [
      block("workflow_creator_teams", "logo", { name: "Creator portrait sets", imageUrl: "", badge: "Content" }),
      block("workflow_headshots", "logo", { name: "Professional headshots", imageUrl: "", badge: "Profiles" }),
      block("workflow_product_scenes", "logo", { name: "Product lifestyle scenes", imageUrl: "", badge: "Commerce" }),
      block("workflow_fan_photos", "logo", { name: "Fan photo albums", imageUrl: "", badge: "Personal use" }),
      block("workflow_event_portraits", "logo", { name: "Event-style portraits", imageUrl: "", badge: "Campaigns" }),
      block("workflow_holiday_cards", "logo", { name: "Holiday card sets", imageUrl: "", badge: "Seasonal" }),
      block("workflow_photo_edits", "logo", { name: "Photo editing workflows", imageUrl: "", badge: "Prep" }),
      block("workflow_video_motion", "logo", { name: "Short motion results", imageUrl: "", badge: "Video" })
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
      subtitle: "Clear answers about source photos, packages, credits, AI images, short videos, styling tools, privacy, publishing, and delivery.",
      layout: "visual_faq",
      imageUrl: assets.galleryChristmasCoupleCover,
      imageAlt: "Warm festive portrait for a seasonal card album",
      imageList: [
        assets.galleryChristmasCover,
        assets.galleryChristmasPhotosThree,
        assets.galleryChristmasCoupleOne,
        assets.galleryThanksgivingFallback,
        assets.galleryHalloweenFallback,
        assets.gallerySeasonalFallback
      ].join("|"),
      imageListAlt: [
        "Festive portrait with warm seasonal styling",
        "Snowy Christmas couple portrait in a winter scene",
        "Christmas couple portrait with gift-ready framing",
        "Thanksgiving group portrait around a warm table",
        "Halloween party portrait with cinematic costume styling",
        "Seasonal holiday portrait set with festive lighting"
      ].join("|"),
      journeyTitle: "Your photo flow",
      journeyTitles: "Upload|Choose Pack|Generate|Download",
      journeyDescriptions: "Add clean source photos.|Pick a scene or style.|AI builds your set.|Download from the private gallery."
    },
    [
      block("faq_about", "faq_item", {
        question: "What is myDreamshoots?",
        answer: "myDreamshoots is a private AI photo and video studio for turning approved source photos into themed portraits, group images, profile assets, seasonal cards, and short motion-ready scenes.",
        body: "You choose a package or tool, review the visible credit cost, upload photos inside your account, and review the finished work in a private gallery.|It is designed for people who want to explore a visual direction before arranging a traditional shoot or commissioning repeated edits.",
        bulletList: "Private source-photo workflow|Package and tool choices before generation|Finished work organized in your account",
        linkList: "Browse photo collections::/ai-image-generation|Explore creative tools::/tools",
        imageUrl: assets.headshotLifestyle,
        imageAlt: "Lifestyle headshot with natural profile framing"
      }),
      block("faq_use", "faq_item", {
        question: "How do I use myDreamshoots?",
        answer: "Start by choosing a package or tool that matches the result you want, then follow the upload and generation steps shown in your signed-in workspace.",
        body: "The request flow keeps the important decisions together: source photos, package direction, selected files, credit cost, and generation status.|You can review the request before it starts, then return to the private gallery when the output is ready.",
        bulletList: "Choose a collection or tool|Upload photos you own or have permission to use|Confirm the request details and credits|Review and download finished results",
        linkList: "See the workflow::/workflow|Open your workspace::/login"
      }),
      block("faq_use_cases", "faq_item", {
        question: "What can I create with myDreamshoots?",
        answer: "The catalog covers personal portraits, professional headshots, creator images, couple and group scenes, fan-inspired moments, editorial looks, seasonal cards, and selected AI video add-ons.",
        body: "Different packages are organized around a visual goal, so the examples help you compare composition, wardrobe, lighting, crop, and intended channel before spending credits.",
        bulletList: "Profile and professional headshots|Creator and social content|Couple, friend, and group portraits|Christmas, Thanksgiving, Halloween, and seasonal albums|Short motion or video-ready add-ons",
        linkList: "Compare package themes::/ai-image-generation|View video tools::/tools"
      }),
      block("faq_free", "faq_item", {
        question: "Is myDreamshoots free?",
        answer: "Availability depends on the current tool and plan setup. Lightweight preview or utility tools may be offered without a subscription when enabled, while private model creation, premium packages, and video requests use credits.",
        body: "The request screen is the source of truth for what is available to your account and what a generation will cost.|There is no need to guess the charge: review the package, selected uploads, and credit requirement before starting.",
        bulletList: "Check the current plan and tool availability|Review credit cost before generation|Use the pricing page for current plan details",
        linkList: "View pricing and plans::/pricing|Review available tools::/tools"
      }),
      block("faq_plans", "faq_item", {
        question: "How do plans, credits, and promotions work?",
        answer: "Plans provide account access and recurring credits, while one-time top-ups or package options can cover additional generation needs when available.",
        body: "Credit amounts, package scope, and any active promotion are shown in the current pricing or checkout experience. Promotions can change, so this FAQ intentionally does not promise a fixed bonus or duration.|Credits are tied to the account that purchased or received them and should be reviewed before a request starts.",
        bulletList: "Plans and top-ups can serve different workloads|Current pricing controls the active offer|Read checkout details before confirming payment",
        linkList: "Compare plans::/pricing|Read terms before purchase::/terms"
      }),
      block("faq_credits", "faq_item", {
        question: "When are credits used?",
        answer: "The credit requirement is shown before a request starts. Credits are reserved when generation begins, settled after successful delivery, and released when a failed request returns its reservation.",
        body: "A request may take time because image and video generation use dedicated processing capacity. The workspace keeps the request status and account history together so you can tell whether a charge was completed or released.",
        bulletList: "Review the cost before starting|Reservations can remain while a job is processing|Failed requests can release reserved credits according to status",
        linkList: "Review plan details::/pricing|Contact support about a request::/contact-us"
      }),
      block("faq_uploads", "faq_item", {
        question: "What photos should I upload?",
        answer: "Use recent, sharp photos where your face is visible and not heavily filtered. A small set of varied source images usually gives the workflow more useful information than many near-duplicates.",
        body: "Good source photos do not need to be professional studio images. Natural phone photos can work well when the subject is well lit, unobstructed, and captured from several useful angles.",
        bulletList: "Use clear focus and even lighting|Include front, three-quarter, and natural-expression views|Avoid sunglasses, extreme filters, heavy blur, and cropped faces|Include wardrobe or hairstyle variety when the package calls for it",
        linkList: "Review the upload workflow::/workflow",
        imageUrl: assets.upload,
        imageAlt: "Clear source portrait with sharp lighting and visible face"
      }),
      block("faq_couples", "faq_item", {
        question: "Can I create couple or group photos?",
        answer: "Yes. Couple, friend, and group results work best when every person is clearly visible in approved source photos and the chosen package is designed for more than one subject.",
        body: "For a group set, keep the source images organized and make sure each person has given permission for the intended use. Results can vary when faces are small, hidden, or heavily overlapping.",
        bulletList: "Get permission from every person shown|Use clear group and individual reference photos|Choose a package that supports the number of subjects|Review faces and hands before sharing",
        linkList: "Browse couple and group themes::/ai-image-generation",
        imageUrl: assets.galleryChristmasCoupleTwo,
        imageAlt: "Couple portrait in a softly lit seasonal setting"
      }),
      block("faq_photo_generator", "faq_item", {
        question: "How does the AI photo generator work?",
        answer: "The generator combines your approved source photos with the selected package direction, then creates a new set of images that follows the package composition, styling, and scene cues.",
        body: "The examples show the intended visual language, but they are not a guarantee of an identical result. Source quality, pose, lighting, subject count, and model behavior all affect the finished images.",
        bulletList: "Choose a visual direction|Upload the source material|Review the request and credits|Inspect the delivered gallery and keep the strongest results",
        linkList: "Explore photo collections::/ai-image-generation",
        imageUrl: assets.galleryCreatorOne,
        imageAlt: "Creator portrait with polished social-ready framing"
      }),
      block("faq_video", "faq_item", {
        question: "How does the AI video workflow work?",
        answer: "Selected themes can turn approved images or a prepared visual direction into short AI motion outputs. The request screen explains the supported input, expected format, and credit requirement.",
        body: "Video generation is more sensitive to image composition and motion cues than a still image request. Start with a clear hero image, keep the brief focused, and review the preview or status in your account.",
        bulletList: "Choose a video-capable theme or add-on|Use a clean source image or finished still|Confirm the duration, format, and credits shown|Download the completed motion output from the private workspace",
        linkList: "See video-capable tools::/tools|Review the workflow::/workflow",
        imageUrl: assets.aiVideoAddonsPack,
        imageAlt: "Motion-ready portrait prepared for a short video add-on"
      }),
      block("faq_styling", "faq_item", {
        question: "How do virtual looks, hairstyle, and styling tools work?",
        answer: "Styling tools apply a focused visual change such as a hairstyle, virtual look, wardrobe direction, or presentation treatment while using your source photo as the starting point.",
        body: "These tools are useful when you want to compare a look before committing to a real appointment or shoot. They are visual explorations, so color, fit, texture, and facial details can vary in the generated result.",
        bulletList: "Upload a well-lit, unobstructed source image|Choose one styling direction at a time|Compare the result with the original before making decisions|Treat the output as a concept preview, not a product or fit guarantee",
        linkList: "Open styling tools::/tools",
        imageUrl: assets.virtualLooks,
        imageAlt: "Virtual styling portrait with hairstyle and outfit concept"
      }),
      block("faq_operator", "faq_item", {
        question: "Who operates myDreamshoots?",
        answer: "myDreamshoots is operated as a customer-facing AI photo studio with account, billing, generation, and gallery support handled through the site workspace.",
        body: "For a plan question, credit discrepancy, failed request, or delivery issue, include the account email, request details, and a short description so support can find the right record.|The site does not require customers to manage model providers or generation infrastructure themselves.",
        bulletList: "Use the signed-in account for request history|Keep the request or order details when contacting support|Do not send private source photos through an unrelated public channel",
        linkList: "Contact the support team::/contact-us"
      }),
      block("faq_publishing", "faq_item", {
        question: "Can I use AI photos on social media, profiles, or business pages?",
        answer: "You can use suitable finished images for personal profiles, social posts, creator pages, cards, campaign drafts, and other channels when you have the rights and follow the destination platform's rules.",
        body: "Before publishing, check that everyone shown has approved the use, that no protected logo or likeness is being misrepresented, and that any required AI disclosure is included.",
        bulletList: "Confirm subject and source-photo permissions|Review platform rules and disclosure requirements|Check crops, text, hands, and small details|Keep commercial claims accurate",
        linkList: "Read content guidance::/content|Review the terms::/terms"
      }),
      block("faq_privacy", "faq_item", {
        question: "Are my uploads and personal data private?",
        answer: "Uploads, generation requests, albums, orders, and credit activity are associated with your signed-in account and are not public by default.",
        body: "Privacy also depends on how you share or download a result. Use the private gallery for review, avoid uploading material you do not control, and remove content when you no longer need it where the account tools allow.",
        bulletList: "Upload only material you are allowed to use|Keep account access secure|Review sharing and download choices before publishing|Read the privacy policy for retention and rights details",
        linkList: "Read the privacy policy::/privacy|Review content rules::/content"
      }),
      block("faq_refunds", "faq_item", {
        question: "What is the refund policy?",
        answer: "Refund eligibility follows the current refund policy, checkout terms, and the status of the specific order or generation request.",
        body: "Credits used for a successfully delivered result are generally not refundable. A failed or interrupted request may release its reservation according to the recorded status, while subscription or payment questions should be reviewed against the applicable purchase terms.",
        bulletList: "Keep the order or request reference|Check whether the generation completed or failed|Contact support promptly when a charge or delivery looks incorrect",
        linkList: "Read the refund policy::/refunds|Review purchase terms::/terms"
      })
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
      subtitle: "Practical answers about approved source photos, fan-scene and game-day directions, holiday albums, protected likeness safety, credits, privacy, and private gallery delivery.",
      layout: "visual_faq",
      imageUrl: aidreamcapesPublicAssets.hero,
        imageAlt: "Aidreamcapes private fan-scene album cover showing approved supporters in an original celebration setting",
      imageList: [
        aidreamcapesPublicAssets.hero,
        aidreamcapesPublicAssets.gallery,
        aidreamcapesPublicAssets.gameDay,
        aidreamcapesPublicAssets.premiere,
        aidreamcapesPublicAssets.seasonal,
        aidreamcapesPublicAssets.christmas
      ].join("|"),
      imageListAlt: [
        "Private Aidreamcapes fan-scene album cover showing approved source photos and private gallery delivery",
        "Aidreamcapes private fan-scene gallery example showing a supporter mood and album layout",
        "Aidreamcapes game-day group portrait cover showing stadium energy and community photos",
        "Aidreamcapes premiere-inspired portrait cover showing flash-lit arrival styling",
        "Aidreamcapes seasonal celebration photo cover showing a warm private album scene",
        "Aidreamcapes Christmas group album cover showing a festive private holiday portrait"
      ].join("|"),
      journeyTitle: "Your private album flow",
      journeyTitles: "Upload|Choose Album|Review Credits|Download",
      journeyDescriptions: "Add approved source photos.|Pick a fan or holiday direction.|Confirm the credit cost.|Download from your gallery."
    },
    [
      block("aidream_faq_sources", "faq_item", {
        question: "What is Aidreamcapes?",
        answer: "Aidreamcapes is a private occasion-album studio for creating original fan-scene, game-day, premiere-inspired, and holiday images from approved source photos.",
        body: "The service is organized around an album direction rather than a single generic prompt. You choose the mood, upload photos you own or have permission to use, review credits, and receive the finished set in a private gallery.",
        bulletList: "Fan-scene and supporter moments|Game-day group portraits|Premiere-inspired flash looks|Christmas, Thanksgiving, Halloween, and seasonal keepsakes",
        linkList: "Explore album collections::/ai-image-generation|Open occasion tools::/tools",
        imageUrl: aidreamcapesPublicAssets.gallery,
        imageAlt: "Finished supporter album in an original celebration setting"
      }),
      block("aidream_faq_use", "faq_item", {
        question: "How do I build a private occasion album?",
        answer: "Choose an album direction, upload approved source photos, check the subjects and brief, review the credit cost, and start the request from your signed-in Aidreamcapes workspace.",
        body: "The private gallery keeps the request status and delivered images together. This makes it easier to compare a fan-scene, game-day, premiere, or holiday direction before sharing the final album.",
        bulletList: "Select one album mood|Upload approved source photos|Confirm group size and request details|Review the finished gallery before publishing",
        linkList: "See the album workflow::/workflow|Open your workspace::/login"
      }),
      block("aidream_faq_categories", "faq_item", {
        question: "Which fan-scene and holiday albums can I create?",
        answer: "Current directions include private fan-scene albums, game-day group portraits, premiere-inspired portraits, Christmas albums, Thanksgiving keepsakes, Halloween party portraits, and rotating seasonal celebrations.",
        body: "Each category changes the setting, lighting, wardrobe cues, composition, and delivery goal. Browse the examples to choose a direction that fits a personal memory, community event, creator post, or seasonal shop.",
        bulletList: "Fan-scene supporter moments|Game-day and watch-party group photos|Premiere and spotlight arrivals|Christmas and Thanksgiving memory sets|Halloween and seasonal celebration portraits",
        linkList: "Compare album categories::/ai-image-generation"
      }),
      block("aidream_faq_credits", "faq_item", {
        question: "Do Aidreamcapes albums require credits?",
        answer: "Album requests use credits when the current package or tool requires dedicated generation capacity. The credit cost is shown before you start.",
        body: "Plans, top-ups, and package availability can change over time. Use the pricing and request screens as the current source of truth instead of relying on a fixed promotion or a permanent free allowance.",
        bulletList: "Review the package cost before generation|Use the current pricing page for plan details|Keep the account that purchased the credits",
        linkList: "View pricing and plans::/pricing|Browse occasion tools::/tools"
      }),
      block("aidream_faq_sources_guidance", "faq_item", {
        question: "What should approved source photos look like?",
        answer: "Use clear photos with visible faces, useful lighting, and enough resolution for the chosen album. Upload only photos you own or have permission to use.",
        body: "For group albums, include both a group reference and individual photos when possible. Avoid heavy filters, tiny faces, deep shadows, and images where a person is partly hidden.",
        bulletList: "Use sharp, well-lit portraits|Include front and three-quarter views|Keep group members visible and identifiable|Do not upload unapproved or scraped images",
        linkList: "Review the workflow::/workflow",
        imageUrl: aidreamcapesPublicAssets.fan,
        imageAlt: "Aidreamcapes approved source-photo guide showing how reference portraits support an original private fan-scene album"
      }),
      block("aidream_faq_group_photos", "faq_item", {
        question: "Can I create couple, family, or group albums?",
        answer: "Yes. Aidreamcapes can support couple, family, friend, and community groups when the selected album direction fits the number of people and everyone shown has approved the use.",
        body: "Group results are more reliable when faces are not blocked and the source set includes consistent views of each person. Review the delivered images carefully before sharing them outside the private gallery.",
        bulletList: "Get permission from every person shown|Choose an album built for the group size|Use clear individual references for small faces|Check the final gallery before publishing",
        linkList: "Explore group album directions::/ai-image-generation",
        imageUrl: aidreamcapesPublicAssets.gameDay,
        imageAlt: "Aidreamcapes game-day group portrait showing friends gathered under energetic stadium lighting for a private album"
      }),
      block("aidream_faq_likeness", "faq_item", {
        question: "Can Aidreamcapes copy a real celebrity, athlete, logo, or official mark?",
        answer: "No. Aidreamcapes focuses on original fan atmosphere and occasion styling, not the unauthorized recreation of a real person's likeness, official team identity, logo, trademark, or protected mark.",
        body: "You can describe a mood such as stadium lights, premiere flashes, supporter colors, or a holiday celebration without asking the system to reproduce protected identity elements.|Use your own approved photos and keep the creative direction clearly original.",
        bulletList: "Avoid real celebrity or athlete likeness requests|Do not upload official logos or protected marks for recreation|Use original color, mood, and scene descriptions|Check rights before publishing a commercial result",
        linkList: "Read content guidance::/content|Review the terms::/terms"
      }),
      block("aidream_faq_album_credits", "faq_item", {
        question: "How are album credits reserved and settled?",
        answer: "The album cost is presented before generation. Credits can be reserved while a private request is processing, settled after successful delivery, or released when the recorded request status indicates a failure.",
        body: "Keep the request status and account history if you need help with a charge. A delayed request is not automatically the same as a completed delivery.",
        bulletList: "Review the cost before starting|Check processing status in the workspace|Keep the request reference for support questions",
        linkList: "Compare plans::/pricing|Contact support::/contact-us"
      }),
      block("aidream_faq_video", "faq_item", {
        question: "Can I turn an album image into a short video?",
        answer: "Some occasion themes include short motion examples or video add-ons. The request screen explains the supported source image, output format, and credit cost before a video request begins.",
        body: "Use a clear finished still with a simple composition when a theme supports motion. Video output can vary with faces, hands, overlapping people, and the amount of movement requested.",
        bulletList: "Choose a motion-capable occasion tool|Use a finished still from your private gallery|Review the format and cost first|Inspect the motion result before sharing",
        linkList: "Explore occasion tools::/tools",
        imageUrl: aidreamcapesPublicAssets.seasonal,
        imageAlt: "Aidreamcapes seasonal celebration portrait prepared as a clean source frame for a short private album video"
      }),
      block("aidream_faq_direction", "faq_item", {
        question: "How do I choose between game-day, premiere, and holiday directions?",
        answer: "Choose the direction based on the moment you want to communicate: energetic supporter scenes for game day, flash-lit arrival portraits for premiere styling, or warmer compositions for holiday memories.",
        body: "The category examples are useful for comparing background treatment, wardrobe cues, group composition, and the crop you may need for a card, post, invitation, or private album.",
        bulletList: "Game day: supporter energy and group framing|Premiere: flash, arrival, and spotlight styling|Holiday: warmth, cards, tables, and keepsake layouts",
        linkList: "Browse album examples::/ai-image-generation",
        imageUrl: aidreamcapesPublicAssets.premiere,
        imageAlt: "Aidreamcapes premiere-inspired portrait showing flash-lit arrival styling for an original private occasion album"
      }),
      block("aidream_faq_delivery", "faq_item", {
        question: "Where are finished albums delivered?",
        answer: "Finished images and supported motion outputs are delivered to the private gallery connected to your signed-in Aidreamcapes account.",
        body: "The gallery is the place to review status, compare results, download favorites, and decide what to share. A public post or external link is a separate action that you control.",
        bulletList: "Review requests inside your account|Download selected finished images|Keep private work in the gallery until it is ready to share",
        linkList: "Open your workspace::/login|Review the workflow::/workflow"
      }),
      block("aidream_faq_publishing", "faq_item", {
        question: "Can I publish album images on social or business pages?",
        answer: "You can publish suitable finished images when you have permission from the people shown, the creative direction respects third-party rights, and the destination platform's rules are followed.",
        body: "For a shop, event, or creator page, check the crop, caption, AI disclosure, and any claims about official affiliation before posting.",
        bulletList: "Confirm subject permissions|Avoid implying official sponsorship or endorsement|Follow platform and advertising rules|Disclose AI use when required",
        linkList: "Review content guidance::/content|Read the terms::/terms"
      }),
      block("aidream_faq_private", "faq_item", {
        question: "How does Aidreamcapes protect private uploads?",
        answer: "Source photos, album briefs, generation jobs, orders, and credit activity are associated with your signed-in account and are not public by default.",
        body: "Protect the account that contains the source photos, use the private gallery for review, and upload only material that you are authorized to process.",
        bulletList: "Use a secure account login|Upload only approved source photos|Review sharing choices before publishing|Read the privacy policy for retention details",
        linkList: "Read the privacy policy::/privacy|Review content rules::/content"
      }),
      block("aidream_faq_cancel", "faq_item", {
        question: "What happens if I cancel a plan?",
        answer: "Plan cancellation affects future plan access according to the purchase terms. Previous gallery access and any remaining credits follow the account and plan rules shown at checkout.",
        body: "Before cancelling, review the current billing page and download anything you need from the private gallery. New album requests may require an active plan or enough available credits.",
        bulletList: "Check the next billing date|Review remaining credits and gallery access|Download important finished work|Use support for account-specific questions",
        linkList: "View plan details::/pricing|Contact support::/contact-us"
      }),
      block("aidream_faq_refunds", "faq_item", {
        question: "What is the Aidreamcapes refund policy?",
        answer: "Refund eligibility follows the current refund policy, checkout terms, and the status of the specific album or generation request.",
        body: "Credits used for a successfully delivered result are generally not refundable. A failed request may release its reservation according to the recorded status, while subscription questions should be checked against the applicable purchase terms.",
        bulletList: "Keep the order or request reference|Check whether the album was delivered|Contact support when a charge or delivery looks incorrect",
        linkList: "Read the refund policy::/refunds|Review purchase terms::/terms"
      }),
    ]
  );
}

type PublicFaqKey = "pricing" | "tools" | "collections" | "best-packages" | "best-ai-image" | "best-ai-video" | "help" | "tool-detail";
type PublicFaqCopy = {
  eyebrow: string;
  title: string;
  subtitle: string;
  items: Array<[string, string]>;
};

function faqItemBlocks(prefix: string, items: PublicFaqCopy["items"]) {
  return items.map(([question, answer], index) =>
    block(`${prefix}_${index + 1}`, "faq_item", { question, answer })
  );
}

function publicPageFaqSection(prefix: string, copy: PublicFaqCopy): SectionInstance {
  return section("faq", {
    anchor: "faq",
    layout: "visual_faq",
    eyebrow: copy.eyebrow,
    title: copy.title,
    subtitle: copy.subtitle,
    journeyTitle: "Before you create",
    journeyTitles: "Plan|Upload|Review|Download",
    journeyDescriptions: "Choose the right page path.|Use approved source photos.|Check credits before generation.|Keep results in your private gallery."
  }, faqItemBlocks(prefix, copy.items));
}

function mydreamshootsPageFaqSection(key: PublicFaqKey): SectionInstance {
  const copy: Record<PublicFaqKey, PublicFaqCopy> = {
    pricing: {
      eyebrow: "Pricing FAQ",
      title: "Pricing questions before you buy",
      subtitle: "Detailed plan, credit, checkout, private gallery, refund, and AI photo generation answers for myDreamshoots customers.",
      items: [
        ["How do I choose a myDreamshoots plan for AI photo generation?", "Choose a plan by the number of private AI photo sets you expect to create each month. A light plan can fit occasional AI headshots or profile photos, while higher-credit plans are better for creator portraits, seasonal albums, product lifestyle images, fan photos, and AI video add-ons that need more generation attempts."],
        ["What are credits and when are they charged?", "Credits are the account balance used for paid AI generation. myDreamshoots shows the credit cost before a package, AI headshot generator, image editing tool, or video workflow starts; credits are reserved during processing and settled only according to the recorded request status."],
        ["Can I buy extra credits without changing my subscription?", "When one-time top-ups are available, they add extra generation capacity to the same private customer account without replacing the active plan. The checkout screen shows the current top-up amount, credit quantity, currency, and payment terms before purchase."],
        ["Does pricing include private galleries and downloads?", "Paid requests are connected to the signed-in workspace, so finished images or clips can be reviewed from a private gallery before download. Pricing is designed around visible credits, private delivery, and repeatable album organization rather than a public feed of generated images."],
        ["What happens if a paid AI generation fails?", "If a provider request fails or is interrupted before delivery, the platform records the job status and can release reserved credits according to that status. Keep the order, credit, or job reference when contacting support about a failed generation, duplicate charge, or missing gallery result."],
        ["Where should I check cancellation, refund, and renewal details?", "Use the live checkout, account workspace, Terms of Service, and Refund Policy for the current subscription, renewal, cancellation, refund, and credit rules. Promotional pricing and plan contents can change, so the pricing page and checkout confirmation are the source of truth before payment."]
      ]
    },
    tools: {
      eyebrow: "Tools FAQ",
      title: "AI tool questions before upload",
      subtitle: "Answers about myDreamshoots AI photo tools, source photos, credits, privacy, quality review, and publishing use.",
      items: [
        ["Which AI photo tool should I start with?", "Start with the tool that matches the final asset you need. Use headshot tools for LinkedIn, resumes, founder bios, and team pages; creator portrait tools for media kits and campaign images; edit tools for cleanup or enhancement; and AI video tools when you want a short motion concept from an approved still image."],
        ["What source photos work best for AI tools?", "Use sharp, recent, well-lit photos where the subject is visible and the intended edit is clear. Avoid screenshots, heavy beauty filters, tiny crops, sunglasses, blurred faces, extreme compression, and any photo you do not own or have permission to process."],
        ["Do myDreamshoots tools use a private upload flow?", "Yes. Customer-facing AI tools keep source photos, request settings, credit reservations, generation status, and finished images connected to the signed-in myDreamshoots workspace instead of publishing them publicly by default."],
        ["How are credits shown for AI photo and video tools?", "Paid tools show the credit requirement before generation begins, so you can compare an AI headshot, background edit, image enhancement, portrait style, or AI video request before credits are reserved. Failed requests can release reserved credits according to the recorded job status."],
        ["Can tool results be used for social media or business pages?", "You can use suitable results for social media, creator pages, LinkedIn, websites, ad drafts, or business profiles when you control the source photos, every person shown has approved the use, and the destination platform rules and AI disclosure requirements are followed."],
        ["What should I inspect before downloading or publishing results?", "Review identity details, facial consistency, hands, text-like marks, logos, background artifacts, crop quality, and overall realism. AI results should be checked before use in professional profiles, campaigns, printed material, or customer-facing business pages."]
      ]
    },
    collections: {
      eyebrow: "Package FAQ",
      title: "Photo package questions before you choose",
      subtitle: "How to compare AI photo package collections, upload requirements, credits, private delivery, and publishing rights before creating.",
      items: [
        ["How do I choose the right AI photo package collection?", "Choose by the final use of the gallery: professional headshots, creator portraits, dating profile photos, couple scenes, fan-inspired moments, seasonal cards, hairstyle previews, fashion editorials, product lifestyle images, or AI video-ready stills. Each collection helps you compare the visual direction before spending credits."],
        ["What source photos should I prepare before choosing a package?", "Prepare clear, permission-safe photos with good lighting, visible faces, and a few angles or expressions. For identity-heavy packages such as AI headshots or creator portraits, a varied source set usually works better than many near-duplicate selfies."],
        ["Are package examples exact guarantees?", "No. Examples show the intended style, framing, lighting, and use case, but final results depend on source-photo quality, pose, crop, subject count, prompt direction, and AI model behavior. Use examples as a comparison guide, not as an identical-output promise."],
        ["Can packages support couples, friends, teams, or groups?", "Some collections are designed for more than one person, while others work best with a single subject. For group or couple AI photos, upload approved source photos for every person, choose a package that fits the group size, and review faces and hands carefully before sharing."],
        ["Do package pages show credit costs and output expectations?", "Package pages and generation screens show credit requirements before a request starts, and many packages also describe the expected output count or album direction. This helps you compare private AI photo packages before reserving credits."],
        ["Where are finished package results delivered?", "Finished images are delivered to the private myDreamshoots gallery or workspace tied to the signed-in account. You can review the gallery, keep the strongest outputs, download files, and decide what is appropriate to publish or reuse."]
      ]
    },
    "best-packages": {
      eyebrow: "Best packages FAQ",
      title: "Best package questions for private albums",
      subtitle: "How featured myDreamshoots AI photo packages are selected, compared, updated, and delivered through private galleries.",
      items: [
        ["What makes a package appear on the Best Packages page?", "The page highlights high-intent AI photo packages that customers commonly compare before upload, such as professional headshots, creator portraits, seasonal albums, fan photos, beauty previews, fashion concepts, and motion-ready visual sets."],
        ["Which best package should I choose first?", "Start with the result you need most urgently. Choose professional headshots for work profiles, creator portraits for personal-brand content, seasonal packages for cards or holiday posts, and video-ready packages when you want a still image that can support short AI motion later."],
        ["Can I compare best packages before uploading photos?", "Yes. Review each package's style, sample images, intended use, source-photo guidance, output expectation, and visible credit cost before signing in or reserving credits. This makes the page useful for planning a private AI photo shoot in advance."],
        ["Are holiday and seasonal AI photo packages included?", "Yes. Active Christmas, Thanksgiving, Halloween, New Year, fan-event, and other seasonal packages can appear when they fit the current catalog. Seasonal availability can rotate, so the live page reflects the storefront's current best package selection."],
        ["Do best package recommendations change over time?", "They can change as examples, customer use cases, package quality, and catalog priorities evolve. The Best Packages page is designed as a curated comparison surface, not a permanent ranking that never changes."],
        ["How do credits and private delivery work for best packages?", "The selected package shows credit requirements before generation starts. Finished results stay in the private myDreamshoots workspace or gallery for review and download, so you can inspect quality before using the images publicly."]
      ]
    },
    "best-ai-image": {
      eyebrow: "AI image FAQ",
      title: "Best AI image questions",
      subtitle: "Guidance for choosing AI image themes, preparing source photos, reviewing quality, and using private results responsibly.",
      items: [
        ["What can the Best AI Image page help me create?", "The Best AI Image page helps you compare private AI image directions such as profile photos, professional portraits, creator images, seasonal albums, fashion concepts, beauty previews, product lifestyle shots, and social-ready visuals generated from approved source photos."],
        ["How do I choose the best AI image theme for my use case?", "Choose by destination and intent. LinkedIn headshots need a cleaner professional look, creator campaigns need expressive crops, seasonal cards need clear holiday context, and business or product images need realistic framing that matches the channel where the image will appear."],
        ["Which source photos produce the best AI image results?", "Use sharp, recent, well-lit photos with visible faces or subjects, natural skin detail, and minimal obstruction. Avoid heavy filters, screenshots, low-resolution crops, copyrighted references, and images of people who have not approved the intended use."],
        ["Are AI image results private by default?", "Generated image requests are tied to the signed-in myDreamshoots account and delivered through the private workspace or gallery. The images are not treated as a public portfolio by default, but privacy also depends on what you choose to download and share."],
        ["Can I use generated AI images on profiles, social media, or business pages?", "You can use suitable results when you control the source material, have permission from every person shown, follow platform rules, and include any required AI disclosure. Review commercial claims, endorsements, logos, and sensitive contexts before publishing."],
        ["How should I review final AI images before download?", "Check face identity, hands, teeth, eyes, text-like marks, background artifacts, clothing details, brand marks, and crop quality. Keep the strongest outputs and avoid using images that could misrepresent a person, location, product, or affiliation."]
      ]
    },
    "best-ai-video": {
      eyebrow: "AI video FAQ",
      title: "Best AI video questions",
      subtitle: "How myDreamshoots turns approved still images into private short motion concepts with visible credits and review steps.",
      items: [
        ["What can myDreamshoots AI video tools create?", "AI video tools can turn approved still images or finished package outputs into short motion concepts for profile clips, creator intros, product teasers, fan moments, holiday album scenes, and social content drafts."],
        ["When should I choose AI video instead of an AI image package?", "Choose an AI image package when you need a polished still gallery. Choose an AI video workflow when the goal is motion: a short intro, animated profile concept, product teaser, album moment, or social clip that starts from a strong approved image."],
        ["Which still image works best for AI video generation?", "Use a clean frame with a clear subject, balanced composition, visible face or product detail, and enough background space for movement. Avoid crowded group photos, tiny faces, heavy blur, text-heavy graphics, and images with complicated hands or overlapping objects."],
        ["Are AI video credits, format, and duration shown before generation?", "Yes. Supported video requests show the available format, credit requirement, and workflow details before generation starts. Video generation can cost more credits than still images because motion processing is more resource intensive."],
        ["Where do completed AI video clips appear?", "Completed clips stay inside the private customer workspace or gallery, where you can review playback, check quality, and download the output. Keep the job reference if a video request fails or does not appear as expected."],
        ["Can I publish AI video outputs on social media or business channels?", "You can publish suitable clips when the source image is approved, every person shown has consented, the content follows platform rules, and any required AI disclosure is included. Review faces, motion artifacts, brand marks, and implied endorsements before posting."]
      ]
    },
    help: {
      eyebrow: "Support FAQ",
      title: "Support questions for myDreamshoots customers",
      subtitle: "Detailed help for AI photo requests, account access, billing, credits, policies, private galleries, uploads, and delivery questions.",
      items: [
        ["How do I get help with an AI photo or AI video request?", "Contact support with the account email, order reference, job reference, package or tool name, and a short description of what happened. Those details help the team locate the generation request, credit reservation, payment event, or private gallery record faster."],
        ["What information should I include when reporting a bad result?", "Include the page or tool you used, the package direction, the approximate request time, and what looks wrong in the output, such as identity mismatch, crop issue, missing download, image artifact, or video motion problem. Do not send extra private source photos unless support asks for a specific reference."],
        ["Can support review credits, failed jobs, or refund questions?", "Support can review visible checkout records, credit reservations, settled credits, released credits, failed-request states, and private delivery status tied to the signed-in account. Refund eligibility still follows the current Refund Policy, Terms of Service, and the recorded order status."],
        ["Where can I read the rules before uploading photos?", "Use the Privacy Policy, Content Policy, Terms of Service, Refund Policy, and Cookie Policy before uploading source photos, buying credits, or publishing outputs. These pages explain privacy, acceptable content, billing, refund, and site-use rules."],
        ["Should I send private source photos through email or chat?", "Avoid sending unnecessary private photos through external channels. The workspace is the preferred place for source photos and private generation records; support usually needs identifiers and a description before any additional image reference."],
        ["What if my request involves another person, a brand, or sensitive content?", "Only upload photos you own or have permission to use, and make sure every person shown has approved the intended use. Avoid misleading endorsements, protected logos, public-figure likeness issues, sensitive contexts, or content that violates the Content Policy."]
      ]
    },
    "tool-detail": {
      eyebrow: "Tool detail FAQ",
      title: "AI tool questions for private generation",
      subtitle: "A fallback FAQ for new myDreamshoots tool pages before the page-specific FAQ sync writes questions based on the tool name, source-photo needs, and intended output.",
      items: [
        ["How should I choose a focused myDreamshoots AI tool?", "Choose the tool whose output matches the asset you need, such as a professional headshot, creator portrait, background edit, upscaled image, style preview, or short motion concept. Each tool page should explain the source-photo requirements, intended result, and private delivery path before credits are reserved."],
        ["Which source photos help a tool perform well?", "Use clear, recent, well-lit photos or references you own or have permission to process. A strong upload usually shows the subject, face, product, outfit, or scene without heavy filters, tiny crops, screenshots, blur, sunglasses, or confusing background clutter."],
        ["How do prompts and settings affect tool results?", "Short, specific direction works better than vague requests. Mention the intended channel, crop, mood, background, outfit, or motion goal when the tool supports it, then avoid requests involving unauthorized people, protected logos, official marks, or misleading affiliations."],
        ["How are credits handled for paid tool requests?", "Supported tools show the credit requirement before generation starts. Credits can be reserved while the request runs, then settled or released according to the recorded job status, so customers can compare tools before starting a paid request."],
        ["Where do generated tool results appear?", "Finished images or clips stay connected to the signed-in myDreamshoots workspace or private gallery for review, download, and account history. Results are not public by default, but customers still control anything they download or share outside the workspace."],
        ["What quality checks matter before publishing?", "Review face consistency, hands, eyes, teeth, text-like marks, logos, background artifacts, crop quality, and any motion issues before using outputs on LinkedIn, creator profiles, websites, ads, printed material, or social media."]
      ]
    }
  };
  return publicPageFaqSection(`mydreamshoots_${key.replace(/[^a-z0-9]+/g, "_")}_faq`, copy[key]);
}

function aidreamcapesPageFaqSection(key: PublicFaqKey): SectionInstance {
  const copy: Record<PublicFaqKey, PublicFaqCopy> = {
    pricing: {
      eyebrow: "Album pricing FAQ",
      title: "Aidreamcapes pricing questions",
      subtitle: "Detailed answers about Aidreamcapes credits, private album pricing, checkout, delivery, refunds, and occasion photo generation.",
      items: [
        ["How should I choose an Aidreamcapes plan?", "Choose by how often you expect to create private fan-scene albums, game-day group portraits, premiere-inspired sets, holiday cards, seasonal memories, or creator occasion albums. Higher-credit plans are better for repeated album experiments or motion-ready outputs."],
        ["Are album credits visible before a request?", "Yes. Aidreamcapes shows the credit requirement before a private album or occasion tool starts generation, so you can compare package direction, output expectations, and budget before credits are reserved."],
        ["Can I add credits for extra album requests?", "When top-ups are available, they add extra album generation capacity to the same signed-in account without replacing the active plan. Checkout shows the current credit quantity, price, and terms before purchase."],
        ["Can a failed album request return credits?", "If a provider request fails before delivery, reserved credits can be released according to the recorded job status. Keep the order or job reference when asking support to review a failed album, missing gallery, or billing question."],
        ["Does pricing include private gallery delivery?", "Aidreamcapes requests are designed around private upload, visible credit review, generation status, and private gallery delivery. Finished images or clips remain connected to the account so you can review and download them before sharing."],
        ["Do prices and package availability change?", "They can. The live pricing and checkout screens control the current offer, included credits, active album categories, subscription terms, and any seasonal package availability."]
      ]
    },
    tools: {
      eyebrow: "Occasion tools FAQ",
      title: "Aidreamcapes tool questions",
      subtitle: "How Aidreamcapes occasion tools handle approved photos, fan-scene boundaries, credits, private albums, and publishing safety.",
      items: [
        ["Which Aidreamcapes occasion tool should I use?", "Choose the tool that matches the private album moment: fan-scene atmosphere, game-day group energy, holiday cards, creator occasion portraits, premiere-inspired photos, or permission-safe content planning."],
        ["Do tools recreate real public figures or official marks?", "No. Aidreamcapes tools focus on original occasion atmosphere and approved source photos, not unauthorized celebrity likenesses, athlete identities, official logos, league marks, venue marks, or misleading affiliation."],
        ["What source photos work best for occasion tools?", "Use clear, well-lit photos with permission from every person shown. Group tools work better when faces are visible and not heavily overlapping; holiday and fan-scene tools work better when the source photos have enough detail for a private album concept."],
        ["Are source photos and finished albums private?", "Uploads, request details, credit records, generation status, and finished albums remain connected to the signed-in Aidreamcapes account. Results are delivered to a private gallery for review and download rather than a public listing."],
        ["How are credits handled for Aidreamcapes tools?", "Supported tools show the credit requirement before generation starts, reserve credits while processing, and settle or release credits according to the recorded request status. Review the cost before starting an album or motion request."],
        ["Can I use results on social pages?", "Yes, when every person shown approved the use, the content avoids misleading endorsement or official affiliation, and the post follows platform and AI disclosure rules."]
      ]
    },
    collections: {
      eyebrow: "Album collection FAQ",
      title: "Aidreamcapes collection questions",
      subtitle: "How to compare fan-scene, game-day, holiday, premiere, and occasion album collections before spending credits.",
      items: [
        ["How do I choose an Aidreamcapes album collection?", "Start with the occasion and publishing goal: supporter energy, game-day groups, holiday memories, premiere-style arrivals, creator portraits, fan-scene concepts, or private celebration albums."],
        ["Can groups use Aidreamcapes albums?", "Yes, when the selected album supports multiple people and every subject has approved the source photos and intended use. Clear group and individual references help the workflow preserve faces and reduce awkward overlaps."],
        ["Are collection examples final guarantees?", "No. Examples show creative direction, mood, crop, and use case, while source-photo quality, group size, composition, lighting, and AI model behavior affect final results. Use examples to compare album direction before reserving credits."],
        ["Do Aidreamcapes collections avoid official identity or logo issues?", "Aidreamcapes collections are designed for original fan-scene and occasion atmosphere. Do not upload or request unauthorized public-figure likenesses, official marks, protected logos, or content that implies a false endorsement."],
        ["How are album credits and output expectations shown?", "Album pages and generation screens show visible credit requirements before a request starts. When an output count or album scope is available, review it before choosing the direction."],
        ["Where are completed albums delivered?", "Finished albums are delivered to the private gallery connected to the signed-in account, where you can review, download, and decide which images are appropriate to share."]
      ]
    },
    "best-packages": {
      eyebrow: "Featured albums FAQ",
      title: "Best Aidreamcapes album questions",
      subtitle: "How featured Aidreamcapes private albums help customers compare occasion outputs, source-photo needs, credits, and safe use.",
      items: [
        ["What appears on the best Aidreamcapes albums page?", "The page highlights high-intent private album directions for fan moments, game-day groups, seasonal memories, holiday cards, premiere-inspired scenes, and creator-ready occasion photos."],
        ["How should I compare featured album directions?", "Compare the occasion, sample imagery, source-photo needs, group size, visible credit cost, private delivery path, and intended channel before starting an album request."],
        ["Can featured albums change?", "Yes. Featured selections can change as Aidreamcapes adds examples, seasonal directions, safer creative boundaries, and active album categories. The live page reflects the current storefront curation."],
        ["Do featured albums still require approved photos?", "Yes. Every album request should use source photos you own or have permission to process, with consent from every person shown. Avoid protected marks, official logos, and misleading affiliation."],
        ["Can I compare albums before spending credits?", "Yes. Review examples, use cases, upload guidance, policy boundaries, and pricing before starting a private request. This helps you choose the best album direction for the occasion."],
        ["Where do featured album results go?", "Finished images or clips stay in the private Aidreamcapes gallery tied to the signed-in account, where you can review quality and download the results that fit your event or campaign."]
      ]
    },
    "best-ai-image": {
      eyebrow: "AI image FAQ",
      title: "Best Aidreamcapes image questions",
      subtitle: "Quality, rights, source-photo, and private delivery guidance for Aidreamcapes AI occasion images.",
      items: [
        ["What makes an Aidreamcapes AI image direction useful?", "A useful direction has a clear occasion, safe creative boundary, practical crop, and source-photo guidance that matches the private album goal, whether it is a fan-scene memory, game-day group, holiday card, or creator occasion portrait."],
        ["Which images work best as sources?", "Use clear, well-lit photos with visible faces and permission from everyone shown. Avoid screenshots, tiny crops, heavy filters, unauthorized public-figure references, official logos, and images that imply a false endorsement."],
        ["How should I choose between image album styles?", "Choose by the scene you want to remember or share: group celebration, supporter atmosphere, seasonal card, premiere-style portrait, fan moment, or creator-ready occasion visual. The best image direction should match the final channel and privacy expectations."],
        ["Are finished Aidreamcapes images private?", "Finished images stay in the private gallery connected to the signed-in account for review and download. They are not public by default, but you should still decide carefully what to share outside the workspace."],
        ["Can I publish finished images?", "Publish only after checking subject permission, platform rules, affiliation claims, official marks, sensitive context, and any required AI disclosure. Avoid captions or use cases that suggest an official relationship that does not exist."],
        ["What should I inspect before download?", "Review faces, hands, marks, captions, crops, background details, logos, and realism before using a finished image publicly or in a campaign."]
      ]
    },
    "best-ai-video": {
      eyebrow: "Motion FAQ",
      title: "Aidreamcapes video questions",
      subtitle: "How private album images can become short occasion motion concepts with visible credits, review steps, and safe publishing guidance.",
      items: [
        ["What can Aidreamcapes motion tools create?", "Motion tools can turn a strong approved still or finished private album image into a short occasion video concept for celebrations, fan memories, group moments, holiday cards, premiere-style albums, or creator use."],
        ["Which still image works best for motion?", "Use a clean frame with a clear subject, balanced composition, visible faces, and minimal overlapping hands or objects. Avoid crowded group photos, tiny faces, heavy blur, and official marks that could create rights or affiliation issues."],
        ["When should I choose motion instead of still images?", "Choose still images when you need a gallery of downloadable album photos. Choose motion when you want a short clip, intro, celebration moment, or social draft that starts from one strong approved image."],
        ["Are video credits shown before generation?", "Yes. Supported motion requests show the format and credit requirement before the request starts. Motion generation can require more credits than still images because it uses additional processing."],
        ["Where do finished clips appear?", "Completed clips stay inside the signed-in private gallery or workspace for review and download. Keep the job reference if a clip fails, takes too long, or does not appear in the expected gallery."],
        ["Can I publish Aidreamcapes motion outputs?", "You can publish suitable clips when the source image is approved, every person shown has consented, the content avoids misleading official affiliation, and the post follows platform and AI disclosure rules."]
      ]
    },
    help: {
      eyebrow: "Support FAQ",
      title: "Aidreamcapes support questions",
      subtitle: "Account, album, credit, policy, rights, upload, and delivery help for private Aidreamcapes occasion albums.",
      items: [
        ["What should I include in an Aidreamcapes support request?", "Include the account email, order or job reference, album direction, request time, and a short description of the issue, such as missing gallery delivery, credit question, quality concern, or failed generation."],
        ["Where are policy rules explained?", "Use the Privacy Policy, Content Policy, Refund Policy, Terms of Service, and Cookie Policy before uploading source photos, buying credits, or publishing album images. These pages explain privacy, acceptable content, rights, billing, and site-use rules."],
        ["Can support review credit status?", "Support can review visible reservation, settlement, release, failed-request, checkout, and delivery records tied to the account. Refund eligibility still depends on the applicable policy and the recorded status of the request."],
        ["Should I send private photos through email?", "Do not send unnecessary private photos through external channels. Provide request details first, and use the private workspace for source photos unless support asks for a specific reference."],
        ["What if an album includes a group or fan-scene concept?", "Make sure every person shown has approved the source photos and intended use. Avoid unauthorized public figures, official marks, protected logos, and captions that imply a real endorsement or affiliation."],
        ["What happens if an album or motion request fails?", "Keep the job reference and contact support if the gallery does not appear, a clip fails, or credits look incorrect. Failed provider requests can release reserved credits according to the recorded status."]
      ]
    },
    "tool-detail": {
      eyebrow: "Tool detail FAQ",
      title: "Aidreamcapes occasion tool questions",
      subtitle: "A fallback FAQ for new Aidreamcapes tool pages before the page-specific FAQ sync writes questions based on the occasion, source-photo needs, and private album output.",
      items: [
        ["How should I choose an Aidreamcapes occasion tool?", "Choose the tool that matches the private album moment you want to create, such as fan-scene atmosphere, game-day group energy, holiday cards, creator occasion portraits, premiere-inspired photos, or a short motion concept from an approved still image."],
        ["Which source photos are best for occasion tools?", "Use clear, well-lit photos with permission from everyone shown. Group tools work better with visible faces and less overlap, while motion tools usually need one strong still image with a clear subject and room for movement."],
        ["How should I describe a fan-scene or holiday request?", "Keep the direction original and practical: describe mood, crop, setting, colors, group size, and album use. Avoid unauthorized public-figure likenesses, official team logos, venue marks, brand logos, trademarks, or captions that imply a real endorsement."],
        ["How do credits work for Aidreamcapes tools?", "Supported tools show the credit requirement before an album or motion request starts. Credits can be reserved during processing and settled or released according to the recorded request status, which helps customers compare still image and motion options."],
        ["Where are occasion tool results delivered?", "Finished images or motion outputs stay inside the signed-in Aidreamcapes account and private gallery for review, download, and account history rather than appearing as a public listing by default."],
        ["What should I inspect before sharing results?", "Check subject permission, face consistency, hands, marks, captions, crops, background details, logos, AI disclosure needs, and any wording that might suggest an official relationship before posting or using an output in a campaign."]
      ]
    }
  };
  return publicPageFaqSection(`aidreamcapes_${key.replace(/[^a-z0-9]+/g, "_")}_faq`, copy[key]);
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
      block("aidream_plan_credits", "card", { meta: "credit ledger", title: "Confirm album credits first", description: "Reservations, successful generations, releases, and top-ups remain visible in the customer account." }),
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
    showTrustedLogoIntro: true,
    trustedLogoTitle: "Trusted by Aidreamcapes creators worldwide",
    aboutTitle: "What is Aidreamcapes?",
    aboutBody: aidreamcapesAboutBody,
    embeddedPricingSectionId: "pricing_1",
    trustedLogoSplitIndex: 15,
    eyebrow: "Customer-created examples",
    title: "Browse Aidreamcapes image and video themes customers have already created.",
    subtitle: "These Aidreamcapes examples use materials customers created in private accounts. Scan the theme labels to choose a direction for your own set.",
    imageTitle: "Best Photo Generator",
    imageAllLabel: "View all photos",
    imageAllHref: "/best-ai-image",
    videoTitle: "Best Video Generator",
    videoAllLabel: "View all videos",
    videoAllHref: "/best-ai-video",
    imageSlugs: "world-cup-fan-photos|christmas-couple|christmas-photos|creator-portraits|gala-photos|holiday|professional-headshots|cyberpunk",
    videoSlugs: "cinematic-portrait-motion|social-profile-clip|travel-route-story|wedding-memory-film|holiday-card-motion|product-showcase-motion|prompt-directed-motion|creator-intro-motion",
    videoItemLimit: 8,
    primaryCta: "Start with your photos",
    primaryHref: "/app/create"
  }, aidreamcapesTrustedLogoBlocks);
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
      credits: "",
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

function aidreamcapesFeaturedChristmasSection(): SectionInstance {
  return section(
    "dreamshoot_featured_pack",
    {
      anchor: "christmas-holiday-albums",
      label: "Featured Aidreamcapes holiday album",
      badge: "Christmas albums",
      title: "Build a private Christmas album around the people in your own photos.",
      subtitle: "Create festive group portraits, card covers, winter greeting scenes, and cozy album crops from approved source photos.",
      primaryCta: "Create a Christmas album",
      primaryHref: "/tools/christmas-group-album-studio",
      secondaryCta: "Browse Christmas albums",
      secondaryHref: "/collections/christmas-holiday-albums",
      photos: "Group album",
      credits: "",
      privacy: "Permission-safe",
      includedTitle: "Included outputs",
      includedOutputs: "Festive group portraits|Christmas album scenes|Card cover images|Cozy winter crops|Greeting album visuals|Private downloads|Family-style keepsakes|Account-only gallery",
      safetyCopy: "Use photos you own or have permission to use. Aidreamcapes does not recreate public-figure likenesses, official marks, logos, or protected event artwork without permission.",
      overlayTitle: "Christmas Holiday Albums",
      overlaySubtitle: "Cozy festive sets with account-only delivery.",
      overlayChips: "Christmas|group album|card cover|private",
      bottomNote: "Aidreamcapes Christmas albums keep source-photo permission, visible credits, and private delivery clear before generation.",
      campaignLabel: "Current focus: Christmas holiday albums",
      nextCampaignLabel: "Next: Thanksgiving / Halloween / Seasonal"
    },
    [
      block("featured_christmas_album", "seasonal_image", { label: "Christmas album", meta: "Festive cover", imageUrl: aidreamcapesPublicAssets.christmas, collectionSlug: "christmas-group-albums", shape: "square" }),
      block("featured_christmas_category", "seasonal_image", { label: "Holiday category", meta: "Group-ready set", imageUrl: versionedAsset("/assets/sites/site_aidreamcapes/fan-holiday-theme/categories/christmas-holiday-albums.webp"), collectionSlug: "christmas-holiday-albums", shape: "square" }),
      block("featured_christmas_gallery_1", "seasonal_image", { label: "Card cover", meta: "Cozy crop", imageUrl: versionedAsset("/assets/sites/site_aidreamcapes/fan-holiday-theme/gallery/christmas-group-album-01.webp"), collectionSlug: "christmas-group-albums", shape: "square" }),
      block("featured_christmas_gallery_2", "seasonal_image", { label: "Winter greeting", meta: "Private album", imageUrl: versionedAsset("/assets/sites/site_aidreamcapes/fan-holiday-theme/gallery/christmas-group-album-02.webp"), collectionSlug: "winter-fan-greeting-albums", shape: "square" }),
      block("featured_christmas_group", "seasonal_image", { label: "Group album", meta: "Family-style mood", imageUrl: versionedAsset("/assets/sites/site_aidreamcapes/fan-holiday-theme/categories/christmas-group-albums.webp"), collectionSlug: "christmas-group-albums", shape: "square" }),
      block("featured_christmas_motion", "seasonal_image", { label: "Holiday story", meta: "Album-ready frame", imageUrl: versionedAsset("/assets/sites/site_aidreamcapes/fan-holiday-theme/posters/christmas-card-motion.webp"), collectionSlug: "christmas-holiday-albums", shape: "square" })
    ]
  );
}

function aidreamcapesFeaturedThanksgivingSection(): SectionInstance {
  return section(
    "dreamshoot_featured_pack",
    {
      anchor: "thanksgiving-memory-sets",
      label: "Featured Aidreamcapes occasion album",
      badge: "Thanksgiving sets",
      title: "Turn a gathering table into a permission-safe Thanksgiving keepsake set.",
      subtitle: "Create gratitude portraits, Friendsgiving memories, host-story crops, and warm dinner-table album images from approved photos.",
      primaryCta: "Create a Thanksgiving set",
      primaryHref: "/tools/thanksgiving-keepsake-set-maker",
      secondaryCta: "Browse Thanksgiving sets",
      secondaryHref: "/collections/thanksgiving-memory-sets",
      photos: "Keepsake set",
      credits: "",
      privacy: "Private delivery",
      includedTitle: "Included outputs",
      includedOutputs: "Gratitude portraits|Dinner-table warmth|Friendsgiving memories|Group-friendly keepsakes|Host story crops|Seasonal card images|Private album covers|Download-ready visuals",
      safetyCopy: "Use photos you own or have permission to use. Aidreamcapes does not recreate public-figure likenesses, official marks, logos, or protected event artwork without permission.",
      overlayTitle: "Thanksgiving Keepsake Sets",
      overlaySubtitle: "Warm occasion albums from approved source photos.",
      overlayChips: "Thanksgiving|keepsake|Friendsgiving|private",
      bottomNote: "Thanksgiving sets work best when each person is clear and the album mood stays simple, warm, and permission-safe.",
      campaignLabel: "Current focus: Thanksgiving keepsake sets",
      nextCampaignLabel: "Next: Christmas / Halloween / Seasonal"
    },
    [
      block("featured_thanksgiving_cover", "seasonal_image", { label: "Keepsake table", meta: "Warm cover", imageUrl: aidreamcapesPublicAssets.thanksgiving, collectionSlug: "thanksgiving-table-keepsakes", shape: "square" }),
      block("featured_thanksgiving_category", "seasonal_image", { label: "Memory sets", meta: "Occasion category", imageUrl: versionedAsset("/assets/sites/site_aidreamcapes/fan-holiday-theme/categories/thanksgiving-memory-sets.webp"), collectionSlug: "thanksgiving-memory-sets", shape: "square" }),
      block("featured_thanksgiving_gallery_1", "seasonal_image", { label: "Gratitude portrait", meta: "Private gallery", imageUrl: versionedAsset("/assets/sites/site_aidreamcapes/fan-holiday-theme/gallery/thanksgiving-keepsake-table-set-01.webp"), collectionSlug: "gratitude-group-portraits", shape: "square" }),
      block("featured_thanksgiving_gallery_2", "seasonal_image", { label: "Friendsgiving scene", meta: "Group crop", imageUrl: versionedAsset("/assets/sites/site_aidreamcapes/fan-holiday-theme/gallery/thanksgiving-keepsake-table-set-02.webp"), collectionSlug: "friendsgiving-memory-sets", shape: "square" }),
      block("featured_thanksgiving_table", "seasonal_image", { label: "Table keepsake", meta: "Seasonal card", imageUrl: versionedAsset("/assets/sites/site_aidreamcapes/fan-holiday-theme/categories/thanksgiving-table-keepsakes.webp"), collectionSlug: "thanksgiving-table-keepsakes", shape: "square" }),
      block("featured_thanksgiving_motion", "seasonal_image", { label: "Host story", meta: "Album-ready frame", imageUrl: versionedAsset("/assets/sites/site_aidreamcapes/fan-holiday-theme/posters/thanksgiving-keepsake-film.webp"), collectionSlug: "thanksgiving-memory-sets", shape: "square" })
    ]
  );
}

function bestMediaGallerySection(kind: "image" | "video", aidreamcapes: boolean): SectionInstance {
  return section("dreamshoot_media_gallery", {
    anchor: kind === "image" ? "best-ai-image" : "best-ai-video",
    kind,
    fullGallery: true,
    eyebrow: aidreamcapes ? "Aidreamcapes gallery" : "myDreamshoots gallery",
    title: kind === "image" ? "Best AI image" : "Best AI video",
    subtitle: aidreamcapes
      ? kind === "image"
        ? "Browse Aidreamcapes fan-scene, game-day, holiday, and occasion image themes in one simple grid."
        : "Browse Aidreamcapes motion cases for fan scenes, occasion moods, and celebration albums in one simple grid."
      : kind === "image"
        ? "Browse every myDreamshoots photo generator theme in one simple grid."
        : "Browse every myDreamshoots motion case in one simple grid.",
    imageSlugs: "",
    videoSlugs: ""
  });
}

function bestPackagesPage(
  featuredPackSection: SectionInstance,
  featuredChristmasSection: SectionInstance,
  featuredThanksgivingSection: SectionInstance,
  site?: DreamshootPublicSeoSiteSeed
): ThemePageJson {
  const aidreamcapes = isAidreamcapesTemplateSite(site);
  const introSection = section("rich_text", {
    anchor: "best-packages",
    eyebrow: aidreamcapes ? "Best occasion albums" : "Best AI photo packages",
    title: aidreamcapes
      ? "Best Private Occasion Albums for Fan Scenes, Holiday Memories, and Group Portraits"
      : "Best AI Photo Packages for Private Headshots, Albums, and Creative Sets",
    body: aidreamcapes
      ? "Compare featured Aidreamcapes album directions for fan-scene portraits, game-day groups, Christmas cards, Thanksgiving memories, and private occasion sets before uploading approved source photos or spending credits."
      : "Compare featured myDreamshoots packages for professional headshots, creator portraits, Christmas photos, Thanksgiving group albums, fan scenes, and private creative sets before uploading approved source photos or spending credits.",
    headingLevel: "h1",
    layout: "compact"
  });
  return page(
    "content",
    ["intro_1", "featured_pack_1", "featured_christmas_1", "featured_thanksgiving_1", "faq_1"],
    {
      intro_1: introSection,
      featured_pack_1: featuredPackSection,
      featured_christmas_1: featuredChristmasSection,
      featured_thanksgiving_1: featuredThanksgivingSection,
      faq_1: aidreamcapes ? aidreamcapesPageFaqSection("best-packages") : mydreamshootsPageFaqSection("best-packages")
    },
    1,
    seoForPublicPage("/best-packages", site)
  );
}

function bestMediaPage(kind: "image" | "video", aidreamcapes: boolean, site?: DreamshootPublicSeoSiteSeed): ThemePageJson {
  const path = kind === "image" ? "/best-ai-image" : "/best-ai-video";
  const faqKey = kind === "image" ? "best-ai-image" : "best-ai-video";
  return page(
    "content",
    [kind === "image" ? "best_ai_image_1" : "best_ai_video_1", "faq_1"],
    {
      [kind === "image" ? "best_ai_image_1" : "best_ai_video_1"]: bestMediaGallerySection(kind, aidreamcapes),
      faq_1: aidreamcapes ? aidreamcapesPageFaqSection(faqKey) : mydreamshootsPageFaqSection(faqKey)
    },
    1,
    seoForPublicPage(path, site)
  );
}

function aidreamcapesWorkflowPage(): ThemePageJson {
  return page(
    "content",
    ["workflow_intro_1", "tutorial_video_1", "tutorial_image_video_1", "mobile_video_1", "workflow_1", "plan_rules_1", "conversion_1"],
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
        primaryHref: "/contact-us",
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
  const supportEmail = "";
  const companyAddress = "";
  return page(
    "content",
    ["contact_intro_1", "contact_details_1", "conversion_1"],
    {
      contact_intro_1: section("rich_text", {
        eyebrow: "Contact us",
        title: "Contact Aidreamcapes support.",
        body: "Reach Aidreamcapes support for source photo guidance, fan or holiday album request status, account access, billing review, privacy questions, plan fit, or creator and business use cases.",
        headingLevel: "h1",
        tone: "dark",
        imageUrl: aidreamcapesPublicAssets.thanksgiving,
        primaryCta: "Email support",
        primaryHref: "/contact-us",
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
        lastUpdated: "{LIVE_POLICY_EFFECTIVE_DATE}",
        contactEmail: supportEmail,
        body: `<h3>Company</h3><p>Aidreamcapes.com</p><h3>Address</h3><p>${companyAddress}</p><h3>Contact Us</h3><p><a href="mailto:${supportEmail}">${supportEmail}</a></p>`
      }),
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
  const featuredChristmasSection = aidreamcapesTemplateSite ? aidreamcapesFeaturedChristmasSection() : homeSections.featured_christmas_1;
  const featuredThanksgivingSection = aidreamcapesTemplateSite ? aidreamcapesFeaturedThanksgivingSection() : homeSections.featured_thanksgiving_1;
  const generationShowcaseSection = aidreamcapesTemplateSite ? aidreamcapesGenerationShowcaseSection() : homeSections.generation_showcase_1;
  const firstTutorialVideoSection = aidreamcapesTemplateSite ? aidreamcapesTutorialVideoSection() : mydreamshootsImageTutorialVideoSection();
  const secondTutorialVideoSection = aidreamcapesTemplateSite ? aidreamcapesImageTutorialVideoSection() : mydreamshootsTutorialVideoSection();
  const mobileVideoSection = aidreamcapesTemplateSite ? aidreamcapesMobileVideoShowcaseSection() : undefined;
  const packageCatalogSection = aidreamcapesTemplateSite ? aidreamcapesPackageCatalogSection() : homeSections.package_catalog_1;
  const reviewSection = aidreamcapesTemplateSite ? aidreamcapesReviewSection() : mydreamshootsReviewSection();
  const faqSection = aidreamcapesTemplateSite ? aidreamcapesFaqSection() : mydreamshootsFaqSection();
  const partnerStripSection = aidreamcapesTemplateSite ? aidreamcapesPartnerStripSection() : undefined;
  const conversionSection = aidreamcapesTemplateSite ? aidreamcapesConversionSection() : homeSections.conversion_1;
  const homeSectionsOrder = aidreamcapesTemplateSite
    ? ["hero_1", "generation_showcase_1", "featured_thanksgiving_1", "tutorial_video_1", "tutorial_video_2", "mobile_video_1", "package_catalog_1", "proof_1", "faq_1", "conversion_1", "brand_strip_1"]
    : ["hero_1", "generation_showcase_1", "tutorial_video_1", "package_catalog_1", "proof_1", "faq_1", "conversion_1"];
  const homePageSections: ThemePageJson["sections"] = {
    hero_1: homeHeroSection,
    generation_showcase_1: generationShowcaseSection,
    ...(aidreamcapesTemplateSite ? { featured_thanksgiving_1: featuredThanksgivingSection } : {}),
    tutorial_video_1: firstTutorialVideoSection,
    ...(aidreamcapesTemplateSite ? { tutorial_video_2: secondTutorialVideoSection } : {}),
    ...(mobileVideoSection ? { mobile_video_1: mobileVideoSection } : {}),
    package_catalog_1: packageCatalogSection,
    proof_1: reviewSection,
    pricing_1: homeSections.pricing_1,
    faq_1: faqSection,
    conversion_1: conversionSection,
    ...(partnerStripSection ? { brand_strip_1: partnerStripSection } : {})
  };
  const templates: Record<MydreamShootsAiStudioTemplateKey, ThemePageJson> = {
  home: page(
    "home",
    homeSectionsOrder,
    homePageSections,
    1
  ),
  "best-packages": bestPackagesPage(featuredPackSection, featuredChristmasSection, featuredThanksgivingSection, site),
  "best-ai-image": bestMediaPage("image", aidreamcapesTemplateSite, site),
  "best-ai-video": bestMediaPage("video", aidreamcapesTemplateSite, site),
  pricing: page(
    "pricing",
    ["pricing_intro_1", "pricing_1", "plan_rules_1", "trust_1", "faq_1", "conversion_1"],
    {
      pricing_intro_1: templateSections.pricing_intro_1,
      pricing_1: homeSections.pricing_1,
      plan_rules_1: homeSections.plan_rules_1,
      trust_1: homeSections.trust_1,
      faq_1: aidreamcapesTemplateSite ? aidreamcapesPageFaqSection("pricing") : mydreamshootsPageFaqSection("pricing"),
      conversion_1: homeSections.conversion_1
    },
    1
  ),
  packages: page(
    "collection",
    ["taxonomy_1", "packages_1", "proof_pairs_1", "packages_strip_1", "trust_1", "faq_1", "conversion_1"],
    {
      taxonomy_1: homeSections.taxonomy_1,
      packages_1: homeSections.packages_1,
      sample_strip_1: homeSections.sample_strip_1,
      proof_pairs_1: homeSections.proof_pairs_1,
      packages_strip_1: homeSections.packages_strip_1,
      feature_tabs_1: homeSections.feature_tabs_1,
      trust_1: homeSections.trust_1,
      faq_1: aidreamcapesTemplateSite ? aidreamcapesPageFaqSection("collections") : mydreamshootsPageFaqSection("collections"),
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
      faq_1: aidreamcapesTemplateSite ? aidreamcapesPageFaqSection("tools") : mydreamshootsPageFaqSection("tools"),
      conversion_1: homeSections.conversion_1
    },
    1
  ),
  workflow: page(
    "content",
    ["workflow_intro_1", "tutorial_video_1", "tutorial_image_video_1", "workflow_1", "plan_rules_1", "conversion_1"],
    {
      workflow_intro_1: section("rich_text", {
        eyebrow: "How it works",
        title: "How myDreamshoots turns uploads into private AI photo sets.",
        body: "Upload photos you own, choose the photo package you want, review the visible credit cost, generate the private request, and download finished images from your account gallery.",
        headingLevel: "h1",
        tone: "dark",
        imageUrl: assets.heroPackageWall,
        primaryCta: "Headshot Generator",
        primaryHref: "/ai-image-generation/headshot",
        secondaryCta: "View pricing",
        secondaryHref: "/pricing"
      }, [
        block("workflow_intro_private", "rich_text_card", { meta: "Private", title: "Private source-photo workspace", description: "Uploads, generation requests, credits, and finished albums stay inside the customer's signed-in myDreamshoots account." }),
        block("workflow_intro_credits", "rich_text_card", { meta: "Credits", title: "Visible cost before generation", description: "Customers see the package cost before a private request reserves credits." }),
        block("workflow_intro_gallery", "rich_text_card", { meta: "Gallery", title: "Finished albums", description: "Generated images return to a private gallery for review and download." })
      ]),
      tutorial_video_1: mydreamshootsImageTutorialVideoSection(),
      tutorial_image_video_1: mydreamshootsTutorialVideoSection(),
      workflow_1: homeSections.workflow_1,
      plan_rules_1: homeSections.plan_rules_1,
      conversion_1: homeSections.conversion_1
    },
    1,
    {
      title: "How myDreamshoots AI photo generation works",
      description: "Learn how myDreamshoots customers upload source photos, choose AI photo packages, review credits, generate private results, and download finished galleries.",
      keywords: "myDreamshoots workflow, AI photo generation workflow, private AI photo packages, AI photo credits",
      canonicalPath: "/workflow",
      robots: { index: true, follow: true }
    }
  ),
  "package-detail": page(
    "package_detail",
    ["package_hero_1", "package_before_after_1", "packages_1", "packages_strip_1", "trust_1", "pricing_1", "conversion_1"],
    {
      package_hero_1: templateSections.package_hero_1,
      package_before_after_1: templateSections.package_before_after_1,
      packages_1: homeSections.packages_1,
      packages_strip_1: homeSections.packages_strip_1,
      trust_1: homeSections.trust_1,
      pricing_1: homeSections.pricing_1,
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
      faq_1: aidreamcapesTemplateSite ? aidreamcapesPageFaqSection("tool-detail") : mydreamshootsPageFaqSection("tool-detail")
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
    ["job_intro_1", "progress_1", "album_1", "trust_1"],
    {
      job_intro_1: templateSections.job_intro_1,
      progress_1: section("job_progress", { title: "Current generation status" }),
      album_1: section("album_gallery", { title: "Delivered outputs", showDownloads: true }),
      trust_1: homeSections.trust_1
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
      faq_1: aidreamcapesTemplateSite ? aidreamcapesPageFaqSection("help") : mydreamshootsPageFaqSection("help"),
      plan_rules_1: homeSections.plan_rules_1
    },
    1
  ),
  faq: page(
    "help",
    ["intro_1", "faq_1", "plan_rules_1"],
    {
      intro_1: section("rich_text", { eyebrow: "FAQ", title: "Frequently asked questions", body: "Find practical answers about photo uploads, AI package selection, credits, billing, refunds, privacy, cookies, and private album delivery.", headingLevel: "h1" }),
      faq_1: aidreamcapesTemplateSite ? aidreamcapesPageFaqSection("help") : mydreamshootsPageFaqSection("help"),
      plan_rules_1: homeSections.plan_rules_1
    },
    1
  ),
  policy: page(
    "policy",
    ["policy_1"],
    {
      policy_1: section("policy_content", {
        title: "myDreamshoots policy details",
        body: "<p>myDreamshoots policy pages cover customer account access, photo upload rights, private album delivery, credit usage, checkout records, refund review, content moderation, cookies, and privacy controls for AI photo customers.</p><p>Use the dedicated refund, content, privacy, terms, and cookie pages to review the rules that apply before uploading source photos, starting a generation job, buying credits, or downloading finished portraits.</p>"
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
        eyebrow: "About myDreamshoots",
        title: "Private AI photo packages with clear credits and real customer delivery.",
        body: "myDreamshoots helps you turn your own photos into private AI headshots, portraits, and themed albums. Upload photos you own, review credits before generation, and keep finished results in your signed-in gallery.",
        headingLevel: "h1",
        tone: "dark",
        imageUrl: assets.heroPackageWall,
        primaryCta: "Explore photo packages",
        primaryHref: "/ai-image-generation",
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
        body: "Our goal is simple: make AI photo creation feel organized, private, and understandable. myDreamshoots focuses on clear package choices, realistic expectations, account-scoped delivery, and responsive support for questions about uploads, credits, checkout, privacy, and finished albums.",
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
    ["contact_intro_1", "contact_details_1", "conversion_1"],
    {
      contact_intro_1: section("rich_text", {
        eyebrow: "Contact us",
        title: "Contact myDreamshoots support.",
        body: "Reach myDreamshoots for account help, billing review, AI photo package questions, private album support, privacy requests, creator use cases, or plan questions.",
        headingLevel: "h1",
        tone: "dark",
        imageUrl: assets.catalogHeadshotCard,
        primaryCta: "Email support",
        primaryHref: "/contact-us",
        secondaryCta: "Email support",
        secondaryHref: "/faq"
      }, [
        block("contact_support", "rich_text_card", { meta: "Support", title: "", description: "For account access, billing review, credit questions, upload help, privacy requests, and delivered album support." }),
        block("contact_account", "rich_text_card", { meta: "Company", title: "", description: "Published company identity for legal and account correspondence." }),
        block("contact_address", "rich_text_card", { meta: "Address", title: "", description: "Published address for business correspondence." })
      ]),
      contact_details_1: section("policy_content", {
        title: "Contact information",
        headingLevel: "h2",
        lastUpdated: "{LIVE_POLICY_EFFECTIVE_DATE}",
        contactEmail: "",
        body: "<h3>Company</h3><p>{LIVE_LEGAL_NAME}</p><h3>Address</h3><p>{LIVE_STORE_ADDRESS}</p><h3>Contact Us</h3><p>{LIVE_SUPPORT_EMAIL}</p>"
      }),
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
        title: "Search myDreamshoots AI photo tools and packages",
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
        title: "Your selected myDreamshoots plan",
        subtitle: "Your selected plan, credit amount, and checkout status stay connected to your myDreamshoots account. Credits are added after payment confirmation.",
        emptyTitle: "Choose a plan first",
        emptyBody: "Open pricing to select a monthly, quarterly, or semiannual subscription plan.",
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
        subtitle: "Return to AI photo packages, pricing, sign-in, or your private myDreamshoots workspace.",
        primaryCta: "Return home",
        primaryHref: "/",
        secondaryCta: "View packages",
        secondaryHref: "/ai-image-generation"
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
  packages: "Headshot Generator",
  "best-packages": "Best Packages",
  "best-ai-image": "Best AI image",
  "best-ai-video": "Best AI video",
  tools: "AI Tools Directory",
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
  faq: "FAQ",
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
    description: "myDreamshoots is a premium AI photo workspace for themed photo packages, personal AI models, paid studio tools, AI video-ready outputs, and private gallery delivery."
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
        { label: "AI Image Generation", href: "/ai-image-generation" },
        { label: "AI Video Generation", href: "/ai-video-generation" },
        { label: "Best Packages", href: "/best-packages" },
        { label: "How it works", href: "/workflow" },
        { label: "Blog", href: "/blog" },
        { label: "Pricing", href: "/pricing" },
        { label: "Workspace", href: "/app/create" }
      ],
      footerLinks: [
        { label: "AI Image Generation", href: "/ai-image-generation", group: "product" },
        { label: "AI Video Generation", href: "/ai-video-generation", group: "product" },
        { label: "Best Packages", href: "/best-packages", group: "product" },
        { label: "Best AI image", href: "/best-ai-image", group: "product" },
        { label: "Best AI video", href: "/best-ai-video", group: "product" },
        { label: "Pricing", href: "/pricing", group: "product" },
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
          logoAlt: "myDreamshoots heart camera logo"
        },
        blocks: [
          { id: "dreamshoot_header_packs", type: "menu_link", settings: { label: "AI Image Generation", href: "/ai-image-generation" } },
          { id: "dreamshoot_header_tools", type: "menu_link", settings: { label: "AI Video Generation", href: "/ai-video-generation" } },
          { id: "dreamshoot_header_best_packages", type: "menu_link", settings: { label: "Best Packages", href: "/best-packages" } },
          { id: "dreamshoot_header_workflow", type: "menu_link", settings: { label: "How it works", href: "/workflow" } },
          { id: "dreamshoot_header_blog", type: "menu_link", settings: { label: "Blog", href: "/blog" } },
          { id: "dreamshoot_header_pricing", type: "menu_link", settings: { label: "Pricing", href: "/pricing" } },
          { id: "dreamshoot_header_workspace", type: "menu_link", settings: { label: "Workspace", href: "/app/create" } },
          ...dreamshootMegaTools
        ]
      },
      footer: {
        settings: {
          title: "myᕲreamshoots",
          logoImageUrl: "/assets/dreamshoot/brand/dreamshootai-logo-refined.svg?v=20260621b",
          logoAlt: "myDreamshoots heart camera logo",
          tagline: "Private AI photo sets with visible credit costs and gallery delivery",
          body: "Upload your selfies, choose a style, review the credit cost, and download a private photo set.",
          productHeading: "Explore",
          companyHeading: "Content",
          supportHeading: "Support",
          socialHeading: "Why it works",
          socialBody: "myDreamshoots helps you turn your own photos into private AI headshots, portraits, and themed albums.",
          instagramUrl: "https://www.instagram.com/blydey_inc",
          facebookUrl: "https://www.facebook.com/blydeyinc",
          threadsUrl: "https://www.threads.com/@blydey_inc",
          pinterestUrl: "https://www.pinterest.com/Blydeyinc",
          youtubeUrl: "https://www.youtube.com/@blydey-inc",
          twitterUrl: "",
          showPaymentIcons: true,
          companyName: "",
          contactAddress: "",
          contactPhone: "",
          contactEmail: "",
          taxIdLabel: "",
          taxId: "",
          salesEmail: "",
          bottomLine: "Monthly credits, one-time top-ups, and private galleries in one photo workspace.",
          copyright: "© 2026 myDreamshoots.com. All rights reserved."
        },
        blocks: [
          { id: "dreamshoot_footer_ai_image_generation", type: "menu_link", settings: { label: "AI Image Generation", href: "/ai-image-generation", group: "product" } },
          { id: "dreamshoot_footer_ai_video_generation", type: "menu_link", settings: { label: "AI Video Generation", href: "/ai-video-generation", group: "product" } },
          { id: "dreamshoot_footer_best_packages", type: "menu_link", settings: { label: "Best Packages", href: "/best-packages", group: "product" } },
          { id: "dreamshoot_footer_best_ai_image", type: "menu_link", settings: { label: "Best AI image", href: "/best-ai-image", group: "product" } },
          { id: "dreamshoot_footer_best_ai_video", type: "menu_link", settings: { label: "Best AI video", href: "/best-ai-video", group: "product" } },
          { id: "dreamshoot_footer_pricing", type: "menu_link", settings: { label: "Pricing", href: "/pricing", group: "product" } },
          { id: "dreamshoot_footer_headshot", type: "menu_link", settings: { label: "Headshot", href: "/ai-image-generation/headshot", group: "product" } },
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
      siteTitle: "myDreamshoots",
      siteDescription: "AI photo package subscription with personal AI models, private uploads, paid tools, AI video-ready outputs, and customer-only galleries.",
      siteKeywords: "",
      titleTemplate: "%s | myDreamshoots",
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
      instagram_url: "https://www.instagram.com/blydey_inc",
      facebook_url: "https://www.facebook.com/blydeyinc",
      threads_url: "https://www.threads.com/@blydey_inc",
      pinterest_url: "https://www.pinterest.com/Blydeyinc",
      youtube_url: "https://www.youtube.com/@blydey-inc",
      twitter_url: "",
      sections: {
        header_plus: {
          type: "header_plus",
          version: "1",
          card_name: "myDreamshoots header",
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
          card_name: "myDreamshoots footer",
          settings: {
            footer_bg_color: "#111114",
            footer_text_color: "#d8d0c7"
          },
          blocks: [
            {
              type: "social",
              settings: {
                instagram_url: true,
                facebook_url: true,
                threads_url: true,
                twitter_url: false,
                pinterest_url: true,
                youtube_url: true
              }
            }
          ]
        }
      }
    }
  }
};
