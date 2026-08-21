import type { Site, VideoThemeCategory } from "@/lib/types";

export const mydreamshootsVideoFrameworkSiteIds = ["site_dreamshoot", "site_grownstride_test"] as const;

export const mydreamshootsVideoGenerationCategories = [
  {
    slug: "text-to-video",
    label: "Text to video",
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
    slug: "cinematic-video",
    label: "Cinematic Video",
    description: "Plan story-driven cinematic clips with mood, shot design, lighting, pacing, and camera movement.",
    sortOrder: 40
  },
  {
    slug: "tiktok-video",
    label: "TikTok Video",
    description: "Create TikTok-first vertical video briefs with hooks, safe zones, captions, sound, and focused closes.",
    sortOrder: 50
  },
  {
    slug: "instagram-reels",
    label: "Instagram Reels",
    description: "Shape Reels around cover-aware framing, captions, visual story, audio, and profile consistency.",
    sortOrder: 60
  },
  {
    slug: "social-media-video",
    label: "Social Media Video",
    description: "Adapt one master story into platform-aware social cuts with safer text placement and CTAs.",
    sortOrder: 70
  },
  {
    slug: "youtube-video",
    label: "YouTube Video",
    description: "Plan long-form YouTube drafts around title promise, opening minute, chapters, depth, and next steps.",
    sortOrder: 80
  },
  {
    slug: "story-video",
    label: "Story Video",
    description: "Shape story-led videos around setup, tension, turning point, payoff, and meaning.",
    sortOrder: 90
  },
  {
    slug: "meme-video",
    label: "Meme Video",
    description: "Turn reactions, POV setups, everyday situations, and punchlines into clear meme video directions.",
    sortOrder: 100
  },
  {
    slug: "product-video",
    label: "Product Video",
    description: "Turn product photos into clear video directions that answer buyer questions about scale, detail, use, features, and packaging.",
    sortOrder: 110
  },
  {
    slug: "product-ad-video",
    label: "Product Ad Video",
    description: "Build product ads around one audience, product promise, visual proof, offer, and clear next action.",
    sortOrder: 120
  },
  {
    slug: "promo-video",
    label: "Promo Video",
    description: "Turn launches, offers, events, seasonal campaigns, and product updates into clear promotional video briefs.",
    sortOrder: 130
  },
  {
    slug: "ugc-ad-video",
    label: "UGC Ad Video",
    description: "Plan creator-style product ads around speaker status, hooks, product context, visible proof, and clear CTAs.",
    sortOrder: 140
  }
] as const;

export const mydreamshootsVideoGenerationParentCategories = [
  { slug: "core-ai-creation", label: "Core AI Creation", description: "Core AI video creation modes.", sortOrder: 10 },
  { slug: "social-creator", label: "Social & Creator", description: "Short-form social and creator video workflows.", sortOrder: 20 },
  { slug: "marketing-commerce", label: "Marketing & Commerce", description: "Product, advertising, and commerce video workflows.", sortOrder: 30 },
  { slug: "creative-lifestyle", label: "Creative & Lifestyle", description: "Creative, travel, fashion, food, fitness, and lifestyle video workflows.", sortOrder: 40 },
  { slug: "professional-business", label: "Professional & Business", description: "Explainers, tutorials, property, enterprise, and professional video workflows.", sortOrder: 50 }
] as const;

export const mydreamshootsVideoGenerationCategoryParentSlugBySlug: Record<string, string> = {
  "text-to-video": "core-ai-creation",
  "image-to-video": "core-ai-creation",
  "talking-photo": "core-ai-creation",
  "cinematic-video": "core-ai-creation",
  "tiktok-video": "social-creator",
  "instagram-reels": "social-creator",
  "social-media-video": "social-creator",
  "youtube-video": "social-creator",
  "story-video": "social-creator",
  "meme-video": "social-creator",
  "product-video": "marketing-commerce",
  "product-ad-video": "marketing-commerce",
  "promo-video": "marketing-commerce",
  "ugc-ad-video": "marketing-commerce"
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
    imageUrl: "/assets/dreamshoot/talking-photo/ai-talking-photo-older-woman-portrait.png",
    creditCost: 24,
    durationSeconds: 6,
    maxFrames: 1,
    sortOrder: 30
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
    imageUrl: "/assets/dreamshoot/tiktok-video/ai-tiktok-video-creator-phone-portrait.png",
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
    imageUrl: "/assets/dreamshoot/instagram-reels/ai-instagram-reels-creator-editorial-portrait.png",
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
    imageUrl: "/assets/dreamshoot/social-media-video/social-media-video-cross-platform-creator.png",
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
    imageUrl: "/assets/dreamshoot/story-video/story-video-hero-woman-sunset-reflection.png",
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
  }
] as const;

export function mydreamshootsVideoGenerationCategoriesForSite(siteId: string) {
  return siteId === "site_dreamshoot"
    ? mydreamshootsVideoGenerationCategories
    : mydreamshootsVideoGenerationCategories.slice(0, 2);
}

export function mydreamshootsVideoGenerationParentCategoriesForSite(siteId: string) {
  return siteId === "site_dreamshoot" ? mydreamshootsVideoGenerationParentCategories : mydreamshootsVideoGenerationParentCategories.slice(0, 1);
}

export function parentVideoGenerationCategorySlugForChild(slug: string): string | undefined {
  return mydreamshootsVideoGenerationCategoryParentSlugBySlug[slug];
}

export function mydreamshootsVideoGenerationThemeSeedsForSite(siteId: string) {
  return siteId === "site_dreamshoot"
    ? mydreamshootsVideoGenerationThemeSeeds
    : mydreamshootsVideoGenerationThemeSeeds.slice(0, 2);
}

export const mydreamshootsPublicVideoGenerationTopicSlugs = [
  "talking-photo",
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
  "ugc-ad-video"
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
