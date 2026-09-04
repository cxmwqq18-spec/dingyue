export type PhotoGuideHeadingSet = readonly [string, string, string, string];

export type SeasonalDuplicateTarget = {
  sectionIds: readonly string[];
  blockCount: number;
};

export const MYDREAMSHOOTS_P1_PHOTO_GUIDE_HEADINGS: Record<string, PhotoGuideHeadingSet> = {
  avatar: ["Rights and safe use", "Recognition check", "Style selection", "Publishing and permissions"],
  "background-changer": ["Rights and safe use", "Scene matching", "Background choice", "Publishing and permissions"],
  "background-remover": ["Rights and safe use", "Source photo setup", "Cutout review", "Context and disclosure"],
  bikini: ["Rights and safe use", "Tasteful styling", "Content boundaries", "Private review and sharing"],
  "black-friday": ["Rights and safe use", "Editable campaign text", "Offer readability", "Final ad review"],
  boudoir: ["Rights and safe use", "Tasteful styling", "Result review", "Private review and sharing"],
  cannes: ["Rights and safe use", "Festival-inspired styling", "Background direction", "Final realism review"],
  "christmas-photo": ["Rights and safe use", "Card-ready composition", "People and pet review", "Publishing and permissions"],
  "color-correction": ["Rights and safe use", "Natural color direction", "Cross-image consistency", "Final color review"],
  cyberpunk: ["Rights and safe use", "Neon composition", "Output format", "Publishing and permissions"],
  "edit-by-prompt": ["Rights and safe use", "Specific edit direction", "Prompt precision", "Final result review"],
  "engagement-photo": ["Rights and safe use", "Announcement composition", "Couple detail review", "Publishing and privacy"],
  "gala-photo": ["Rights and safe use", "Formal event styling", "Detail review", "Publishing and permissions"],
  "hairstyle-generator": ["Rights and safe use", "Source photo angles", "Comparison setup", "Use as inspiration"],
  "halloween-photo": ["Rights and safe use", "Original costume direction", "Channel fit", "Final format review"],
  headshot: ["Rights and safe use", "Professional styling", "Professional detail review", "Official document limits"],
  holiday: ["Rights and safe use", "Seasonal direction", "Text-safe composition", "Publishing and permissions"],
  mafia: ["Rights and safe use", "Fictional noir styling", "Safety review", "Final format review"],
  "magic-eraser": ["Rights and safe use", "Cleanup scope", "Repair review", "Context and disclosure"],
  nightlife: ["Rights and safe use", "After-dark composition", "Profile-safe styling", "Text-safe crop"],
  "old-photo-restoration": ["Rights and safe use", "Source scan quality", "Restoration review", "Archive the original"],
  "only-fans": ["Rights and safe use", "Creator-brand direction", "Platform-safe review", "Platform-safe publishing"],
  "photo-enhancer": ["Rights and safe use", "Natural enhancement", "Enhancement review", "Compare before publishing"],
  "portrait-photo": ["Rights and safe use", "Personal-brand direction", "Brand consistency", "Final portrait review"],
  "portrait-retouch": ["Rights and safe use", "Natural retouching", "Identity check", "Before-and-after review"],
  "rich-lifestyle": ["Rights and safe use", "Believable lifestyle direction", "Brand-safe details", "Truthful publishing"],
  "singles-awareness-day": ["Rights and safe use", "Solo confidence direction", "Solo portrait direction", "Publishing direction"],
  soccer: ["Rights and safe use", "Generic fan styling", "Rights-safe fan styling", "Output crops"],
  "street-style": ["Rights and safe use", "Outfit framing", "Brand-safe styling", "Output crops"],
  swimsuit: ["Rights and safe use", "Wardrobe preview setup", "Wardrobe comparison", "Private review and sharing"],
  "thanksgiving-photo": ["Rights and safe use", "Card-ready composition", "People and object review", "Final scene review"],
  travel: ["Rights and safe use", "Destination direction", "Realism and disclosure", "Output crops"],
  "unblur-image": ["Rights and safe use", "Blur severity", "Detail recovery review", "Limitations"],
  urban: ["Rights and safe use", "Urban scene direction", "Scene cleanup", "Rights-safe publishing"],
  "valentines-photo": ["Rights and safe use", "Card-ready composition", "Couple detail review", "Seasonal publishing"],
  "virtual-try-on": ["Rights and safe use", "Outfit direction", "Fit expectations", "Fit expectations"],
  "wedding-photo": ["Rights and safe use", "Editable wedding details", "Wedding composition", "Cultural and ceremonial review"]
};

export const MYDREAMSHOOTS_P1_SEASONAL_DUPLICATE_TARGETS: Record<string, SeasonalDuplicateTarget> = {
  "/ai-save-the-date/christmas": { sectionIds: ["christmas_scene_ideas"], blockCount: 11 },
  "/ai-save-the-date/engagement": { sectionIds: ["engagement_workflow_creates"], blockCount: 7 },
  "/ai-save-the-date/halloween": { sectionIds: ["halloween_use_cases"], blockCount: 8 },
  "/ai-save-the-date/mothers-day": { sectionIds: ["mothers_day_scene_ideas"], blockCount: 11 },
  "/ai-save-the-date/new-year": { sectionIds: ["new_year_workflow", "new_year_use_cases"], blockCount: 13 },
  "/ai-save-the-date/proposal": { sectionIds: ["proposal_use_cases", "proposal_workflow"], blockCount: 13 },
  "/ai-save-the-date/thanksgiving": { sectionIds: ["thanksgiving_use_cases", "thanksgiving_workflow", "thanksgiving_scene_ideas"], blockCount: 23 }
};

export const MYDREAMSHOOTS_P1_CHRISTMAS_QUALITY_DUPLICATE_BLOCKS = [
  {
    id: "christmas_quality_people",
    title: "Review people and objects",
    text: "Review people and objects — check faces, hands, pets, decorations, gift shapes, clothing, and scene continuity."
  },
  {
    id: "christmas_quality_text",
    title: "Keep important text editable",
    text: "Keep important text editable — names, dates, personal greetings, event details, and URLs should not depend on AI-generated image text."
  },
  {
    id: "christmas_quality_crop",
    title: "Prepare the final crop",
    text: "Prepare the final crop — keep enough safe space for desktop, mobile, social, card, or video output needs."
  }
] as const;

export const MYDREAMSHOOTS_P1_CHILDREN_PRIVACY = {
  seoTitle: "Children's Privacy Notice (KIDS Act) | myDreamshoots",
  h1: "Children's Privacy Notice (KIDS Act)",
  h2: "Children's Privacy Notice",
  intro: "This notice explains how myDreamshoots handles accounts, minor image uploads, parent or guardian requests, and COPPA-aware privacy questions.",
  jsonLdName: "Children's Privacy Notice (KIDS Act) | myDreamshoots"
} as const;

export const MYDREAMSHOOTS_P1_STATE_PRIVACY = {
  intro: "This notice explains privacy rights and request procedures for California and other U.S. residents, including access, deletion, correction, opt-out, and appeal requests where applicable.",
  address: "8 THE GREEN STE B, DOVER, DE, 19901, US"
} as const;

export const MYDREAMSHOOTS_P1_CONTACT = {
  oldAddress: "8 THE GREEN STE B,DOVER,DE 19901",
  address: "8 THE GREEN STE B, DOVER, DE, 19901, US"
} as const;

export const MYDREAMSHOOTS_P1_GALLERY_H1 = {
  image: "Best AI Image Gallery",
  video: "Best AI Video Gallery"
} as const;

export const MYDREAMSHOOTS_P1_PET_VIDEO_COPY = {
  owner: "A warm owner-and-pet portrait where the relationship, animal expression, and body position remain clear.",
  pet: "A clean pet portrait that keeps the face, coat, pose, and background easy to review."
} as const;

type PageLike = {
  sections?: Record<string, {
    blocks?: Array<{ id?: string; settings?: Record<string, unknown> }>;
  }>;
};

/** Remove only audited title-as-description duplicates from known seasonal sections. */
export function stripMydreamshootsP1SeasonalDuplicateText(pageJson: PageLike, pagePath: string): number {
  const target = MYDREAMSHOOTS_P1_SEASONAL_DUPLICATE_TARGETS[pagePath];
  if (!target) return 0;
  const candidates = [] as Array<{ settings: Record<string, unknown> }>;
  for (const sectionId of target.sectionIds) {
    const section = pageJson.sections?.[sectionId];
    for (const block of section?.blocks ?? []) {
      const settings = block.settings;
      if (!settings || typeof settings.title !== "string" || typeof settings.text !== "string") continue;
      if (settings.title.trim() !== settings.text.trim()) continue;
      candidates.push({ settings });
    }
  }
  if (!candidates.length) return 0;
  if (candidates.length !== target.blockCount) {
    throw new Error(`P1 seasonal duplicate count mismatch for ${pagePath}: expected ${target.blockCount}, found ${candidates.length}`);
  }
  for (const candidate of candidates) delete candidate.settings.text;
  return candidates.length;
}

/** Remove the three exact workflow duplicates from Christmas #quality only. */
export function stripMydreamshootsP1ChristmasQualityDuplicates(pageJson: PageLike, pagePath: string): number {
  if (pagePath !== "/ai-save-the-date/christmas") return 0;
  const section = pageJson.sections?.christmas_quality;
  if (!section?.blocks) return 0;
  const duplicateIds = new Set<string>(MYDREAMSHOOTS_P1_CHRISTMAS_QUALITY_DUPLICATE_BLOCKS.map((item) => item.id));
  const duplicateText = new Set<string>(MYDREAMSHOOTS_P1_CHRISTMAS_QUALITY_DUPLICATE_BLOCKS.map((item) => item.text));
  const before = section.blocks.length;
  section.blocks = section.blocks.filter((block) => {
    const title = typeof block?.settings?.title === "string" ? block.settings.title : "";
    const text = typeof block?.settings?.text === "string" ? block.settings.text : "";
    return !(duplicateIds.has(block.id || "") || (duplicateText.has(text) && duplicateText.has(title)));
  });
  return before - section.blocks.length;
}

export function mydreamshootsPhotoGuideHeadingsForSlug(slug: string, existing: readonly string[] = []): string[] | undefined {
  const aliases: Record<string, string> = {
    christmas: "christmas-photo",
    halloween: "halloween-photo",
    thanksgiving: "thanksgiving-photo",
    valentines: "valentines-photo",
    wedding: "wedding-photo"
  };
  const raw = slug.trim().toLowerCase().replace(/^\/+|\/+$/g, "");
  const normalized = aliases[raw] ?? raw;
  const replacement = MYDREAMSHOOTS_P1_PHOTO_GUIDE_HEADINGS[normalized];
  if (!replacement) return undefined;
  const first = existing[0] || "What this creates";
  const second = existing[1] || "Best use cases";
  return [first, second, ...replacement];
}

export function mydreamshootsPhotoGuideHeadingsForText(text: string): string[] | undefined {
  const normalized = text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const match = Object.keys(MYDREAMSHOOTS_P1_PHOTO_GUIDE_HEADINGS)
    .sort((left, right) => right.length - left.length)
    .find((slug) => normalized.includes(slug.replace(/-/g, " ")));
  return match ? mydreamshootsPhotoGuideHeadingsForSlug(match) : undefined;
}
