import type { Site, VideoThemeCategory } from "@/lib/types";
import { providerReadyVideoThemePrompt } from "./video-prompt-format";

export const mydreamshootsVideoFrameworkSiteIds = ["site_dreamshoot", "site_grownstride_test"] as const;

export const mydreamshootsVideoGenerationCategories = [
  {
    slug: "creator-scene-motion",
    label: "Creator Scene Motion",
    description: "Animate a creator scene with controlled camera and subject motion.",
    sortOrder: 5
  },
  {
    slug: "text-to-video",
    label: "Text to Video",
    description: "Video themes created from written prompts.",
    sortOrder: 10
  },
  {
    slug: "image-to-video",
    label: "Image to Video",
    description: "Video themes created from uploaded or selected images.",
    sortOrder: 20
  },
  {
    slug: "talking-photo",
    label: "Talking Photo",
    description: "Explore a talking-photo workflow from one clear portrait and a focused message.",
    sortOrder: 30
  },
  {
    slug: "photo-animation",
    label: "Photo Animation",
    description: "Animate a still photo with controlled subject and camera motion.",
    sortOrder: 40
  },
  {
    slug: "photo-slideshow-video",
    label: "Photo Slideshow Video",
    description: "Arrange multiple photos into a paced slideshow video.",
    sortOrder: 50
  },
  {
    slug: "cinematic-video",
    label: "Cinematic Video",
    description: "Plan story-driven cinematic clips with mood, shot design, lighting, pacing, and camera movement.",
    sortOrder: 60
  },
  {
    slug: "tiktok-video",
    label: "TikTok Video",
    description: "Create TikTok-first vertical video briefs with hooks, safe zones, captions, sound, and focused closes.",
    sortOrder: 70
  },
  {
    slug: "instagram-reels",
    label: "Instagram Reels",
    description: "Shape Reels around cover-aware framing, captions, visual story, audio, and profile consistency.",
    sortOrder: 80
  },
  {
    slug: "youtube-shorts",
    label: "YouTube Shorts",
    description: "Create concise vertical videos designed for YouTube Shorts.",
    sortOrder: 90
  },
  {
    slug: "social-media-video",
    label: "Social Media Video",
    description: "Adapt one master story into platform-aware social cuts with safer text placement and CTAs.",
    sortOrder: 110
  },
  {
    slug: "youtube-video",
    label: "YouTube Video",
    description: "Plan long-form YouTube drafts around title promise, opening minute, chapters, depth, and next steps.",
    sortOrder: 100
  },
  {
    slug: "story-video",
    label: "Story Video",
    description: "Shape story-led videos around setup, tension, turning point, payoff, and meaning.",
    sortOrder: 120
  },
  {
    slug: "meme-video",
    label: "Meme Video",
    description: "Turn reactions, POV setups, everyday situations, and punchlines into clear meme video directions.",
    sortOrder: 130
  },
  {
    slug: "product-video",
    label: "Product Video",
    description: "Turn product photos into clear video directions that answer buyer questions about scale, detail, use, features, and packaging.",
    sortOrder: 140
  },
  {
    slug: "product-demo-video",
    label: "Product Demo Video",
    description: "Demonstrate product features, details, and normal use clearly.",
    sortOrder: 150
  },
  {
    slug: "product-ad-video",
    label: "Product Ad Video",
    description: "Build product ads around one audience, product promise, visual proof, offer, and clear next action.",
    sortOrder: 160
  },
  {
    slug: "promo-video",
    label: "Promo Video",
    description: "Turn launches, offers, events, seasonal campaigns, and product updates into clear promotional video briefs.",
    sortOrder: 180
  },
  {
    slug: "ugc-ad-video",
    label: "UGC Ad Video",
    description: "Plan creator-style product ads around speaker status, hooks, product context, visible proof, and clear CTAs.",
    sortOrder: 170
  },
  {
    slug: "video-ad",
    label: "Video Ad",
    description: "Plan paid-social video ad concepts around objective, hook, proof, placement, CTA, and meaningful test variants.",
    sortOrder: 190
  },
  {
    slug: "brand-video",
    label: "Brand Video",
    description: "Present a company, brand story, or positioning through video.",
    sortOrder: 200
  },
  {
    slug: "music-video",
    label: "Music Video",
    description: "Develop artist-, performance-, and track-led visual concepts with a coherent visual language.",
    sortOrder: 210
  },
  {
    slug: "travel-video",
    label: "Travel Video",
    description: "Turn destination photos and route moments into travel video.",
    sortOrder: 220
  },
  {
    slug: "fashion-video",
    label: "Fashion Video",
    description: "Create fashion-focused motion for people, styling, and apparel.",
    sortOrder: 230
  },
  {
    slug: "food-video",
    label: "Food Video",
    description: "Create food-focused video with appetizing detail and pacing.",
    sortOrder: 240
  },
  {
    slug: "fitness-video",
    label: "Fitness Video",
    description: "Create fitness video with stable, readable movement.",
    sortOrder: 250
  },
  {
    slug: "pet-video",
    label: "Pet Video",
    description: "Create shareable pet and lifestyle video moments.",
    sortOrder: 260
  },
  {
    slug: "explainer-video",
    label: "Explainer Video",
    description: "Explain a product, service, or concept with clear visual structure.",
    sortOrder: 270
  },
  {
    slug: "how-to-video",
    label: "How-to Video",
    description: "Present a process as a clear step-by-step tutorial.",
    sortOrder: 280
  },
  {
    slug: "real-estate-video",
    label: "Real Estate Video",
    description: "Present property photos and spaces through a coherent tour.",
    sortOrder: 290
  },
  {
    slug: "corporate-video",
    label: "Corporate Video",
    description: "Create company introductions and internal business video.",
    sortOrder: 300
  },
  {
    slug: "ai-avatar-video",
    label: "AI Avatar Video",
    description: "Create presenter-led video with a consistent AI avatar.",
    sortOrder: 310
  },
  {
    slug: "talking-head-video",
    label: "Talking Head Video",
    description: "Create presenter video for education, explanation, and marketing.",
    sortOrder: 320
  }
] as const;

export const mydreamshootsVideoGenerationParentCategories = [
  { slug: "core-ai-creation", label: "Core AI Creation", description: "Core AI video creation modes.", sortOrder: 10 },
  { slug: "social-creator", label: "Social & Creator", description: "Short-form social and creator video workflows.", sortOrder: 20 },
  { slug: "marketing-commerce", label: "Marketing & Commerce", description: "Product, advertising, and commerce video workflows.", sortOrder: 30 },
  { slug: "creative-lifestyle", label: "Creative & Lifestyle", description: "Creative, travel, fashion, food, fitness, pet, and lifestyle video workflows.", sortOrder: 40 },
  { slug: "professional-business", label: "Professional & Business", description: "Explainers, tutorials, property, enterprise, and professional video workflows.", sortOrder: 50 }
] as const;

const saveTheDateRootCategory = {
  slug: "save-the-date",
  label: "Save the Date",
  description: "Save the Date, wedding, and seasonal announcement video themes.",
  sortOrder: 60
} as const;

const saveTheDateChildCategories = [
  { slug: "love-wedding", label: "Love & Wedding", description: "Engagement, proposal, invitation, and ceremony themes.", sortOrder: 10 },
  { slug: "seasonal-holidays", label: "Seasonal Holidays", description: "Seasonal celebration and holiday announcement themes.", sortOrder: 20 }
] as const;

const saveTheDateLeafCategories = [
  { slug: "valentines-day", label: "Valentine's Day", description: "A romantic Valentine's Day announcement or keepsake.", sortOrder: 10 },
  { slug: "engagement", label: "Engagement", description: "An intimate engagement announcement with a personal reveal.", sortOrder: 20 },
  { slug: "proposal", label: "Proposal", description: "A cinematic proposal moment with an emotional reveal.", sortOrder: 30 },
  { slug: "save-the-date", label: "Save the Date", description: "A date announcement with a clear celebratory finish.", sortOrder: 40 },
  { slug: "wedding-invitation", label: "Wedding Invitation", description: "A refined invitation reveal with legible event details.", sortOrder: 50 },
  { slug: "wedding-ceremony", label: "Wedding Ceremony", description: "A warm ceremony memory with a graceful final frame.", sortOrder: 60 },
  { slug: "christmas", label: "Christmas", description: "A warm Christmas greeting with seasonal texture and light.", sortOrder: 10 },
  { slug: "halloween", label: "Halloween", description: "A playful Halloween announcement with controlled atmosphere.", sortOrder: 20 },
  { slug: "thanksgiving", label: "Thanksgiving", description: "A welcoming Thanksgiving gathering and gratitude moment.", sortOrder: 30 },
  { slug: "new-year", label: "New Year", description: "A celebratory New Year countdown and reveal.", sortOrder: 40 },
  { slug: "mothers-day", label: "Mother's Day", description: "A tender Mother's Day tribute with a personal gesture.", sortOrder: 50 },
  { slug: "fathers-day", label: "Father's Day", description: "A warm Father's Day tribute with an authentic family detail.", sortOrder: 60 }
] as const;

const saveTheDateParentByChild: Record<string, string> = {
  "love-wedding": "save-the-date",
  "seasonal-holidays": "save-the-date"
};

const saveTheDateDirections: Record<string, string> = {
  "valentines-day": "An adult couple exchange a small red envelope at a candlelit cafe table, then lean closer as a heart-shaped reflection appears in the window.",
  engagement: "An adult couple walks through a sunlit garden; one partner notices a ring box, covers their mouth, and reaches for the other hand as the reveal lands.",
  proposal: "One adult partner kneels beside a quiet lakeside overlook, opens a ring box, and looks up while the other adult turns, gasps softly, and reaches forward.",
  "save-the-date": "An adult couple pins a cream date card to a linen board, smooths its edge, and smiles as the camera reveals the announced date and paired rings.",
  "wedding-invitation": "Adult hands open a textured wedding invitation, trace the embossed names, and place it beside two rings as the event date becomes the final visual anchor.",
  "wedding-ceremony": "An adult couple stands beneath a floral ceremony arch, exchanges a gentle glance and hand squeeze, then turns toward warm aisle light as guests remain softly blurred.",
  christmas: "An adult family hangs a paper ornament on a lit tree, hands pass a wrapped card forward, and warm window reflections shimmer across the room.",
  halloween: "An adult host lights a carved pumpkin on a porch as a light wind moves the leaves, then lifts a small invitation card toward the camera with a playful pause.",
  thanksgiving: "Adult family members pass a serving dish across a crowded Thanksgiving table, a hand rests on another shoulder, and steam rises into the amber dining-room light.",
  "new-year": "Adults gather on a rooftop as a countdown card turns over, a hand raises a champagne glass, and distant fireworks bloom behind the final celebratory date reveal.",
  "mothers-day": "An adult child places a handwritten card and flowers beside their mother, she touches the card and smiles, and petals shift in a soft window breeze.",
  "fathers-day": "An adult child sets a small keepsake beside their father's coffee, he runs a thumb across its surface and looks up with a restrained smile as morning light settles."
};

const saveTheDateCoverImages: Record<string, string> = {
  "valentines-day": "/assets/dreamshoot/save-the-date/valentines-day/hero-valentines-day-save-the-date-city-couple.jpg",
  engagement: "/assets/dreamshoot/save-the-date/engagement/hero-ai-engagement-couple-sunset.jpg",
  proposal: "/assets/dreamshoot/save-the-date/proposal/hero-ai-proposal-beach-sunset.jpg",
  "save-the-date": "/assets/dreamshoot/save-the-date/save-the-date/hero-ai-save-the-date-couple-sunset.jpg",
  "wedding-invitation": "/assets/dreamshoot/wedding-invitation/hero-ai-wedding-invitation-couple-reviewing.jpg",
  "wedding-ceremony": "/assets/dreamshoot/seasonal/wedding-ceremony/hero-ai-wedding-ceremony-first-kiss.jpg",
  christmas: "/assets/dreamshoot/seasonal/christmas/hero-ai-christmas-family-gift.jpg",
  halloween: "/assets/dreamshoot/seasonal/halloween/hero-ai-halloween-costume-party.jpg",
  thanksgiving: "/assets/dreamshoot/seasonal/thanksgiving/hero-ai-thanksgiving-family-dinner.jpg",
  "new-year": "/assets/dreamshoot/seasonal/new-year/hero-ai-new-year-city-fireworks.jpg",
  "mothers-day": "/assets/dreamshoot/seasonal/mothers-day/hero-ai-mothers-day-family-breakfast.jpg",
  "fathers-day": "/assets/dreamshoot/seasonal/fathers-day/hero-ai-fathers-day-family-portrait.jpg"
};

const saveTheDateThemeSeeds = saveTheDateLeafCategories.map((category) => ({
  slug: category.slug,
  categorySlug: ["christmas", "halloween", "thanksgiving", "new-year", "mothers-day", "fathers-day"].includes(category.slug)
    ? "seasonal-holidays"
    : "love-wedding",
  name: category.label,
  headline: category.description,
  description: category.description,
  prompt: providerReadyVideoThemePrompt(saveTheDateDirections[category.slug] ?? `An adult subject creates a clear ${category.label} announcement with a tactile keepsake and a warm final reveal.`, category.slug),
  imageUrl: saveTheDateCoverImages[category.slug] ?? "",
  creditCost: 24,
  durationSeconds: 15,
  maxFrames: 10,
  sortOrder: category.sortOrder + (category.slug === "christmas" ? 100 : 0)
}));

/**
 * The public header menu exposes the current DB-backed topic slice.
 * Legacy homepage showcase themes remain available for published showcase cards,
 * but must not leak back into the navigation taxonomy.
 */
export const mydreamshootsCurrentVideoMenuSlugs = [
  "talking-photo",
  "motion-generator",
  "cinematic-video",
  "tiktok-video",
  "instagram-reels",
  "social-media-video",
  "youtube-video",
  "story-video",
  "meme-video",
  "product-video",
  "product-ad-video",
  "promo-video",
  "ugc-ad-video",
  "video-ad",
  "brand-video",
  "music-video",
  "fashion-video",
  "food-video",
  "pet-video",
  "explainer-video",
  "how-to-video",
  "talking-head-video"
] as const;

const mydreamshootsCurrentVideoMenuSlugSet = new Set<string>(mydreamshootsCurrentVideoMenuSlugs);

export function isMydreamshootsCurrentVideoMenuSlug(slug: string | undefined): boolean {
  return mydreamshootsCurrentVideoMenuSlugSet.has(String(slug ?? ""));
}

export const mydreamshootsVideoGenerationCategoryParentSlugBySlug: Record<string, string> = {
  "creator-scene-motion": "social-creator",
  "text-to-video": "core-ai-creation",
  "image-to-video": "core-ai-creation",
  "talking-photo": "core-ai-creation",
  "motion-generator": "core-ai-creation",
  "photo-animation": "core-ai-creation",
  "photo-slideshow-video": "core-ai-creation",
  "cinematic-video": "core-ai-creation",
  "tiktok-video": "social-creator",
  "instagram-reels": "social-creator",
  "youtube-shorts": "social-creator",
  "social-media-video": "social-creator",
  "youtube-video": "social-creator",
  "story-video": "social-creator",
  "meme-video": "social-creator",
  "product-video": "marketing-commerce",
  "product-demo-video": "marketing-commerce",
  "product-ad-video": "marketing-commerce",
  "promo-video": "marketing-commerce",
  "ugc-ad-video": "marketing-commerce",
  "video-ad": "marketing-commerce",
  "brand-video": "marketing-commerce",
  "music-video": "creative-lifestyle",
  "travel-video": "creative-lifestyle",
  "fashion-video": "creative-lifestyle",
  "food-video": "creative-lifestyle",
  "fitness-video": "creative-lifestyle",
  "pet-video": "creative-lifestyle",
  "explainer-video": "professional-business",
  "how-to-video": "professional-business",
  "real-estate-video": "professional-business",
  "corporate-video": "professional-business",
  "ai-avatar-video": "professional-business",
  "talking-head-video": "professional-business",
  "portrait-motion": "core-ai-creation",
  "travel-story": "creative-lifestyle",
  "social-cards": "social-creator",
  "product-teaser": "marketing-commerce",
  "edit-by-prompt": "core-ai-creation",
  "wedding-memory": "creative-lifestyle",
  "creator-motion": "social-creator",
  "creator-intro-video": "social-creator",
  "fan-poster-motion": "social-creator"
};

export const mydreamshootsVideoGenerationThemeSeeds = [
  {
    slug: "text-to-video",
    categorySlug: "text-to-video",
    name: "Text to Video",
    headline: "Generate a video from a written prompt.",
    description: "Turn a clear written idea into a short AI video direction with controlled scene, motion, pacing, and output intent.",
    prompt: "Create a polished short video from the user's written prompt. Keep the scene coherent, use natural motion, preserve the requested subject and style, and avoid extra text or unrelated elements.",
    imageUrl: "",
    creditCost: 24,
    durationSeconds: 6,
    maxFrames: 1,
    sortOrder: 10
  },
  {
    slug: "image-to-video",
    categorySlug: "image-to-video",
    name: "Image to Video",
    headline: "Animate an uploaded image into a short video.",
    description: "Use one or more uploaded frames as the source for a realistic short video with stable identity, coherent camera movement, and controlled motion.",
    prompt: "Create a realistic short video from the uploaded image frames. Preserve the subject identity and scene details, add natural camera movement and believable motion, and keep the final clip clean and coherent.",
    imageUrl: "",
    creditCost: 24,
    durationSeconds: 6,
    maxFrames: 10,
    sortOrder: 20
  },
  {
    slug: "talking-photo",
    categorySlug: "talking-photo",
    name: "Talking Photo",
    headline: "Turn one portrait into a focused talking-photo video.",
    description: "Create a talking-photo direction from one clear portrait and a focused message, with stable facial identity and restrained natural delivery.",
    prompt: "Animate the provided portrait into a natural talking-photo video. Preserve identity, facial proportions, age, and expression while creating believable mouth movement and subtle head motion for the supplied message.",
    imageUrl: "/assets/dreamshoot/talking-photo/ai-talking-photo-older-woman-portrait.webp",
    creditCost: 24,
    durationSeconds: 6,
    maxFrames: 1,
    sortOrder: 30
  },
  {
    slug: "motion-generator",
    categorySlug: "motion-generator",
    name: "Motion Generator",
    headline: "Animate an approved photo into a short, controlled video.",
    description: "Turn an approved still image into a short, coherent motion concept with controlled subject movement, camera motion, pacing, and visual continuity.",
    prompt: "Animate the approved source image into a short video with one deliberate subject action and restrained camera movement. Preserve identity, composition, lighting, and important scene details while keeping motion physically coherent from the opening frame through the final hold.",
    imageUrl: "/assets/dreamshoot/generated/pack-galleries/ai-video-add-ons/ai-video-add-ons-01.webp",
    creditCost: 24,
    durationSeconds: 6,
    maxFrames: 1,
    sortOrder: 35
  },
  {
    slug: "cinematic-video",
    categorySlug: "cinematic-video",
    name: "Cinematic Video",
    headline: "Create story-driven cinematic clips with mood, light, pacing, and camera movement.",
    description: "Create cinematic videos with stronger mood, shot design, lighting, pacing, and camera movement for story scenes, launches, concepts, and brand moments.",
    prompt: "Create a cinematic short video with a clear mood, intentional framing, controlled lighting, and camera movement that supports the story. Keep the scene realistic, coherent, and emotionally focused.",
    imageUrl: "/assets/dreamshoot/cinematic-video/cinematic-video-hotel-corridor-mystery-scene.png",
    creditCost: 24,
    durationSeconds: 6,
    maxFrames: 10,
    sortOrder: 40
  },
  {
    slug: "tiktok-video",
    categorySlug: "tiktok-video",
    name: "TikTok Video",
    headline: "Create TikTok-first vertical videos with hooks, captions, and a focused close.",
    description: "Turn photos and ideas into TikTok-first vertical videos with clearer hooks, mobile-safe framing, captions, sound-aware structure, and one focused close.",
    prompt: "Create a TikTok-first vertical video. Start with a strong hook, keep the subject framed safely for mobile viewing, use clear pacing, and finish with a concise takeaway or call to action.",
    imageUrl: "/assets/dreamshoot/generated/video-topic-clean/tiktok-video/ai-tiktok-video-creator-phone-portrait.webp",
    creditCost: 24,
    durationSeconds: 6,
    maxFrames: 10,
    sortOrder: 50
  },
  {
    slug: "instagram-reels",
    categorySlug: "instagram-reels",
    name: "Instagram Reels",
    headline: "Create Reels from photos and ideas with cover-aware framing and captions.",
    description: "Turn photos and ideas into Instagram Reels with 9:16 framing, safer text placement, stronger cover choices, captions, audio-aware pacing, and a clear visual story.",
    prompt: "Create an Instagram Reels style vertical video with cover-aware framing, clear subject placement, safe caption zones, polished pacing, and a visual story that remains readable on mobile.",
    imageUrl: "/assets/dreamshoot/generated/video-topic-clean/instagram-reels/ai-instagram-reels-creator-editorial-portrait.webp",
    creditCost: 24,
    durationSeconds: 6,
    maxFrames: 10,
    sortOrder: 60
  },
  {
    slug: "social-media-video",
    categorySlug: "social-media-video",
    name: "Social Media Video",
    headline: "Adapt one core idea into platform-aware social video.",
    description: "Turn one core idea into platform-aware social media videos with stronger hooks, crops, captions, audio, pacing, safe zones, and CTAs.",
    prompt: "Create a platform-aware social media video from the provided idea and frames. Keep the message clear, use mobile-safe composition, include natural pacing, and make the ending suitable for a simple call to action.",
    imageUrl: "/assets/dreamshoot/generated/video-topic-clean/social-media-video/social-media-video-01.webp",
    creditCost: 24,
    durationSeconds: 6,
    maxFrames: 10,
    sortOrder: 70
  },
  {
    slug: "youtube-video",
    categorySlug: "youtube-video",
    name: "YouTube Video",
    headline: "Create YouTube video drafts with opening structure, chapters, and next steps.",
    description: "Create YouTube videos from photos and ideas with a stronger opening, clearer structure, chapter-ready sequencing, captions, and a better path to the next action.",
    prompt: "Create a YouTube-ready video draft with a clear opening promise, structured sequence, visual pacing, chapter-friendly beats, and a natural next step for the viewer.",
    imageUrl: "/assets/dreamshoot/youtube-video/youtube-video-expert-presenter.png",
    creditCost: 24,
    durationSeconds: 10,
    maxFrames: 10,
    sortOrder: 80
  },
  {
    slug: "story-video",
    categorySlug: "story-video",
    name: "Story Video",
    headline: "Turn photos and moments into a clear story arc.",
    description: "Turn photos, clips, memories, and ideas into story-led videos with setup, tension, turning point, payoff, and meaning.",
    prompt: "Create a story-led video with a clear setup, emotional progression, turning point, and payoff. Preserve the source subject and guide the visuals toward a coherent narrative.",
    imageUrl: "/assets/dreamshoot/generated/video-topic-clean/story-video/story-video-hero-woman-sunset-reflection.webp",
    creditCost: 24,
    durationSeconds: 6,
    maxFrames: 10,
    sortOrder: 90
  },
  {
    slug: "meme-video",
    categorySlug: "meme-video",
    name: "Meme Video",
    headline: "Make reaction, POV, and relatable meme videos.",
    description: "Turn reactions, comments, awkward moments, and everyday situations into meme videos with bold captions, reaction timing, POV setups, and punchlines.",
    prompt: "Create a short meme-style video with a clear setup, readable reaction timing, bold but tasteful caption direction, and a punchline that lands quickly without misleading claims.",
    imageUrl: "/assets/dreamshoot/meme-video/meme-video-message-overload.png",
    creditCost: 24,
    durationSeconds: 6,
    maxFrames: 10,
    sortOrder: 100
  },
  {
    slug: "product-video",
    categorySlug: "product-video",
    name: "Product Video",
    headline: "Turn product photos into clear buyer-question videos.",
    description: "Turn product photos and source images into videos that show scale, materials, features, real-world use, packaging, and product-page fit.",
    prompt: "Create a clear product video direction from approved product images. Answer the buyer's main question with truthful visual proof, accurate scale, material detail, normal use context, included items, and a clean final product view without inventing claims.",
    imageUrl: "/assets/dreamshoot/product-video/product-video-size-scale-backpack.jpg",
    creditCost: 24,
    durationSeconds: 6,
    maxFrames: 10,
    sortOrder: 110
  },
  {
    slug: "product-ad-video",
    categorySlug: "product-ad-video",
    name: "Product Ad Video",
    headline: "Build product ads around one buyer decision, proof, offer, and CTA.",
    description: "Create product ad video directions around a specific audience, supported promise, visual proof, real offer terms, and one clear next action.",
    prompt: "Create a product advertising video draft around one defined audience and buyer decision. Connect the problem or desire to a supported product promise, show clear visual proof, state only verified offer terms, and end with one relevant call to action without inventing claims or outcomes.",
    imageUrl: "/assets/dreamshoot/product-ad-video/ai-product-ad-video-new-product-unboxing-creative.jpg",
    creditCost: 24,
    durationSeconds: 6,
    maxFrames: 10,
    sortOrder: 120
  },
  {
    slug: "promo-video",
    categorySlug: "promo-video",
    name: "Promo Video",
    headline: "Turn launches, offers, events, and announcements into clear promotional videos.",
    description: "Plan promotional videos around the real campaign goal, audience, reason now, proof, timing, terms, and CTA without inventing urgency.",
    prompt: "Create a promotional video draft around one verified launch, offer, event, seasonal campaign, feature update, or social promotion. Make the promotional facts clear, show supportable proof, keep timing and terms accurate, and end with one relevant call to action without inventing discounts, deadlines, availability, or outcomes.",
    imageUrl: "/assets/dreamshoot/promo-video/promo-video-product-launch-presentation.jpg",
    creditCost: 24,
    durationSeconds: 6,
    maxFrames: 10,
    sortOrder: 130
  },
  {
    slug: "ugc-ad-video",
    categorySlug: "ugc-ad-video",
    name: "UGC Ad Video",
    headline: "Create creator-style product ads with clear speaker roles, hooks, product moments, proof, and CTAs.",
    description: "Plan UGC-style product ad directions without inventing customer experiences, product claims, or unsupported creator controls.",
    prompt: "Create a creator-style product advertising video draft from approved product inputs and a defined UGC brief. Clarify the speaker status, hook, product context, visible proof, qualified reaction, and CTA. Do not present actors, AI-generated people, stock people, or scripted experiences as verified customers, and do not invent product claims or unsupported controls.",
    imageUrl: "/assets/dreamshoot/ugc-ad-video/ai-ugc-video-creator-lip-product-hook.jpg",
    creditCost: 24,
    durationSeconds: 6,
    maxFrames: 10,
    sortOrder: 140
  },
  {
    slug: "video-ad",
    categorySlug: "video-ad",
    name: "Video Ad",
    headline: "Create paid-social video ad concepts around objective, hook, proof, placement, CTA, and testing.",
    description: "Create short paid-social video ad concepts from a written campaign brief or approved image, then review each output before campaign use.",
    prompt: "Create a short paid-social video ad concept around one verified campaign objective. Start with a clear hook, show the approved product moment and supportable proof, fit the planned placement, and end with one relevant call to action. Do not invent product claims, ratings, results, discounts, deadlines, prices, creator experiences, or platform performance.",
    imageUrl: "/assets/dreamshoot/video-ad/video-ad-creator-phone-tripod.jpg",
    creditCost: 24,
    durationSeconds: 6,
    maxFrames: 10,
    sortOrder: 150
  },
  {
    slug: "brand-video",
    categorySlug: "brand-video",
    name: "Brand Video",
    headline: "Turn an approved brand story into identity-led motion.",
    description: "Create brand-video concepts around founder stories, product origin, values, culture, community, and campaign identity without turning every business video into a sales template.",
    prompt: "Create a story-led brand video concept around one approved brand memory. Use the supplied brand brief or image reference, preserve approved visual anchors, build a clear origin or point of view, and use only verifiable facts. Do not invent awards, dates, testimonials, impact claims, logos, packaging text, brand-kit controls, or performance outcomes.",
    imageUrl: "/assets/dreamshoot/brand-video/brand-video-founder-story.jpg",
    creditCost: 24,
    durationSeconds: 6,
    maxFrames: 10,
    sortOrder: 160
  },
  {
    slug: "music-video",
    categorySlug: "music-video",
    name: "Music Video",
    headline: "Create artist-, performance-, and track-led visual concepts with a coherent visual language.",
    description: "Plan music-video visuals around artist identity, performance, narrative, motifs, motion, and reviewable continuity.",
    prompt: "Create a music-video visual concept around an approved artist brief or image reference. Define the mood, visual motif, performance or narrative job, framing, motion grammar, and sequence logic. Do not claim automatic song upload, beat synchronization, lyric extraction, music licensing, voice cloning, lip sync, or audio mastering without verified product support.",
    imageUrl: "/assets/dreamshoot/music-video/hero-music-video-performance.jpg",
    creditCost: 24,
    durationSeconds: 6,
    maxFrames: 10,
    sortOrder: 170
  },
  {
    slug: "fashion-video",
    categorySlug: "fashion-video",
    name: "Fashion Video",
    headline: "Create fashion motion concepts around garments, styling, silhouette, material, and movement.",
    description: "Plan editorial, lookbook, runway, styling, garment-detail, and fashion-campaign visual directions with continuity review.",
    prompt: "Create a fashion-video visual concept around an approved collection, garment, model, styling brief, or image reference. Define the hero garment, silhouette, styling stack, material cues, movement, framing, and continuity rules. Do not claim virtual try-on, automatic garment transfer, exact fabric physics, fit prediction, SKU ingestion, or catalog automation without verified product support.",
    imageUrl: "/assets/dreamshoot/fashion-video/hero-fashion-video-editorial-frame.jpg",
    creditCost: 24,
    durationSeconds: 6,
    maxFrames: 10,
    sortOrder: 180
  },
  {
    slug: "food-video",
    categorySlug: "food-video",
    name: "Food Video",
    headline: "Create food-motion concepts around cooking action, plating, texture, and culinary atmosphere.",
    description: "Plan food, cooking, plating, ingredient-prep, restaurant-service, beverage, and culinary-social visual directions with continuity review.",
    prompt: "Create a food-video visual concept around an approved dish, ingredient setup, restaurant scene, or culinary image reference. Define the hero food, one visible action, texture and state, camera angle, set and props, lighting, and continuity rules. Do not claim recipe accuracy, ingredient recognition, allergen detection, nutrition analysis, cooking-temperature verification, doneness detection, food-safety certification, menu ingestion, or perfect label preservation without verified product support.",
    imageUrl: "/assets/dreamshoot/food-video/hero-food-video-creator-frame.jpg",
    creditCost: 24,
    durationSeconds: 6,
    maxFrames: 10,
    sortOrder: 190
  },
  {
    slug: "pet-video",
    categorySlug: "pet-video",
    name: "Pet Video",
    headline: "Create pet-motion concepts around portraits, play, routine, and owner interaction.",
    description: "Plan pet-, animal-, owner-, and lifestyle-led video directions with identity, anatomy, prop, and welfare-boundary review.",
    prompt: "Create a pet-video visual concept around an approved pet portrait, owner-and-pet image, animal-content brief, shelter reference, or pet-lifestyle scene. Define the animal identity, visible behavior, human interaction, environment, props, framing, and continuity rules. Do not claim veterinary diagnosis, nutrition advice, behavior assessment, training efficacy, welfare compliance, product safety, or adoption outcomes without verified product support.",
    imageUrl: "/assets/dreamshoot/pet-video/hero-pet-video-portrait-frame.jpg",
    creditCost: 24,
    durationSeconds: 6,
    maxFrames: 10,
    sortOrder: 200
  },
  {
    slug: "explainer-video",
    categorySlug: "explainer-video",
    name: "Explainer Video",
    headline: "Explain products, processes, data, and concepts with clear visual structure.",
    description: "Create explainer-video directions for product walkthroughs, process maps, data stories, education, technology concepts, business frameworks, and user journeys.",
    prompt: "Create a clear explainer video direction for one defined question. Use system-led, evidence-led, or narration-led visuals with an intentional hierarchy and sequence. Treat generated labels, numbers, charts, citations, UI text, and claims as illustrative until replaced or verified; do not invent product capabilities, statistics, scientific facts, legal, medical, or financial claims.",
    imageUrl: "/assets/dreamshoot/explainer-video/hero-explainer-video-product-concept.jpg",
    creditCost: 24,
    durationSeconds: 6,
    maxFrames: 10,
    sortOrder: 270
  },
  {
    slug: "how-to-video",
    categorySlug: "how-to-video",
    name: "How-to Video",
    headline: "Create step-by-step tutorial visuals with clear actions and checkpoints.",
    description: "Create tutorial-video directions for setup, assembly, software walkthroughs, demonstrations, checkpoints, training, and final verification.",
    prompt: "Create an action-led tutorial video direction for one defined task. Show the starting state, prerequisites, one ordered action, the expected state change, and an observable checkpoint. Treat generated labels, measurements, settings, warnings, commands, safety statements, and product instructions as placeholders until verified against authoritative sources. Do not invent manufacturer-approved procedures, medical, chemical, electrical, mechanical, or other high-risk guidance.",
    imageUrl: "/assets/dreamshoot/how-to-video/hero-how-to-video-hands-on-step.jpg",
    creditCost: 24,
    durationSeconds: 6,
    maxFrames: 10,
    sortOrder: 280
  },
  {
    slug: "talking-head-video",
    categorySlug: "talking-head-video",
    name: "Talking Head Video",
    headline: "Create direct-to-camera presenter videos for clear spoken messages.",
    description: "Plan presenter-led videos for business updates, training, product introductions, thought leadership, and social clips with a focused script and reviewable delivery.",
    prompt: "Create a direct-to-camera talking-head video concept from the approved script or image reference. Keep one presenter as the main visual anchor, use a clear eye line and natural delivery, and do not invent identity, credentials, testimonials, product claims, or unsupported controls.",
    imageUrl: "/assets/dreamshoot/talking-head-video/hero-talking-head-video-professional-presenter.jpg",
    creditCost: 24,
    durationSeconds: 6,
    maxFrames: 10,
    sortOrder: 320
  }
] as const;

export function mydreamshootsVideoGenerationCategoriesForSite(siteId: string) {
  return siteId === "site_dreamshoot"
    ? [...mydreamshootsVideoGenerationCategories, saveTheDateChildCategories[0], saveTheDateChildCategories[1]]
    : mydreamshootsVideoGenerationCategories.slice(0, 2);
}

export function mydreamshootsVideoGenerationParentCategoriesForSite(siteId: string) {
  return siteId === "site_dreamshoot"
    ? [...mydreamshootsVideoGenerationParentCategories, saveTheDateRootCategory]
    : mydreamshootsVideoGenerationParentCategories.slice(0, 1);
}

export function parentVideoGenerationCategorySlugForChild(slug: string): string | undefined {
  return saveTheDateParentByChild[slug] ?? mydreamshootsVideoGenerationCategoryParentSlugBySlug[slug];
}

export function mydreamshootsVideoGenerationThemeSeedsForSite(siteId: string) {
  const frameworkSeeds = mydreamshootsVideoGenerationThemeSeeds.map((theme) => ({
    ...theme,
    prompt: providerReadyVideoThemePrompt(theme.prompt, theme.slug),
    durationSeconds: 15
  }));
  return siteId === "site_dreamshoot"
    ? [...frameworkSeeds, ...saveTheDateThemeSeeds]
    : frameworkSeeds.slice(0, 2);
}

export const mydreamshootsPublicVideoGenerationTopicSlugs = [
  "talking-photo",
  "motion-generator",
  "cinematic-video",
  "tiktok-video",
  "instagram-reels",
  "social-media-video",
  "youtube-video",
  "story-video",
  "meme-video",
  "product-video",
  "product-ad-video",
  "promo-video",
  "ugc-ad-video",
  "video-ad",
  "brand-video",
  "music-video",
  "fashion-video",
  "food-video",
  "pet-video",
  "explainer-video",
  "how-to-video",
  "talking-head-video"
] as const;

const publicVideoGenerationPageSlugs = new Set<string>(mydreamshootsPublicVideoGenerationTopicSlugs);

export function isMydreamshootsPublicVideoGenerationTopicSlug(slug: string | undefined): slug is (typeof mydreamshootsPublicVideoGenerationTopicSlugs)[number] {
  return publicVideoGenerationPageSlugs.has(String(slug ?? ""));
}

type VideoFrameworkSite = Pick<Site, "id" | "slug" | "name" | "branding" | "primaryDomain">;

export function isMydreamshootsVideoFrameworkSiteId(siteId: string | null | undefined): boolean {
  return mydreamshootsVideoFrameworkSiteIds.includes(String(siteId ?? "") as (typeof mydreamshootsVideoFrameworkSiteIds)[number]);
}

export function isMydreamshootsVideoFrameworkSite(site: VideoFrameworkSite): boolean {
  return isMydreamshootsVideoFrameworkSiteId(site.id) || site.slug.trim().toLowerCase() === "mydreamshoots";
}

export function videoGenerationCreatePath(slug?: string): string {
  if (slug && publicVideoGenerationPageSlugs.has(slug)) return `/ai-video-generation/${slug}`;
  return "/app/create#step-video";
}

export function activeVideoGenerationCategories(categories: VideoThemeCategory[] = []): Array<Pick<VideoThemeCategory, "id" | "slug" | "label" | "description" | "sortOrder"> & { href: string }> {
  const configuredBySlug = new Map(
    categories
      .filter((category) => category.status === "active")
      .map((category) => [category.slug, category])
  );
  const source = mydreamshootsVideoGenerationCategories
    .map((category) => {
      const configured = configuredBySlug.get(category.slug);
      return configured
        ? {
            ...configured,
            label: category.label,
            description: category.description,
            sortOrder: category.sortOrder
          }
        : {
            id: `video_framework_${category.slug}`,
            siteId: "site_dreamshoot",
            slug: category.slug,
            label: category.label,
            description: category.description,
            sortOrder: category.sortOrder,
            status: "active" as const,
            createdAt: new Date(0).toISOString()
          };
    })
    .sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label));
  return source.map((category) => ({
    id: category.id,
    slug: category.slug,
    label: category.label,
    description: category.description,
    sortOrder: category.sortOrder,
    href: videoGenerationCreatePath(category.slug)
  }));
}
