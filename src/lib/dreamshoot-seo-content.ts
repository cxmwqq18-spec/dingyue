import type { Metadata } from "next";
import type { SectionInstance, Site, ThemePageJson } from "@/lib/types";

export type SeoDirectoryKind = "collection" | "tool";

export type SeoDirectoryContent = {
  slug: string;
  explicit: boolean;
  label: string;
  title: string;
  description: string;
  keywords: string;
  canonicalPath: string;
  h2: string;
  h3: string[];
  intro: string;
  details: string[];
  useCases: string[];
  workflow: string[];
  ctaLabel: string;
  ctaHref: string;
};

type SeoDirectorySeed = Omit<SeoDirectoryContent, "slug" | "explicit" | "canonicalPath">;

const collectionDirectory: Record<string, SeoDirectorySeed> = {
  beauty: {
    label: "Beauty",
    title: "AI Beauty Photo Maker - photos and videos with AI. Create stunning AI Beauty",
    description: "Create polished AI beauty photos with MydreamShoots: beauty portraits, skincare-ready profile images, soft glam looks, editorial crops, private albums, and optional video-ready outputs from everyday uploads.",
    keywords: "AI Beauty Photo Maker, AI beauty photos, beauty portrait generator, glam AI photos, MydreamShoots beauty",
    h2: "beauty",
    h3: ["AI beauty portrait styles", "Private beauty photo workflow", "Beauty photos and video-ready outputs"],
    intro: "The Beauty collection is built for customers who want refined portraits without copying a studio template. MydreamShoots turns ordinary selfies into soft glam, skincare-clean, editorial, and profile-ready images while keeping source uploads, credits, and final albums inside one private account.",
    details: [
      "Use this directory when the customer wants face-forward results: clean lighting, graceful crops, natural retouching, hairstyle previews, profile portraits, and beauty campaign images.",
      "Each package can support several visual directions, including minimal studio light, glossy editorial beauty, warm lifestyle portraits, and social-ready square crops.",
      "The page is intentionally different from the homepage: it explains beauty-specific outcomes, the source-photo checklist, and the delivery formats customers should expect."
    ],
    useCases: ["Profile refreshes for creators and founders", "Beauty portfolio concepts before a real shoot", "Soft glam portraits for social posts", "Skincare, hairstyle, and makeup visual planning"],
    workflow: ["Upload clear selfies with natural expressions.", "Choose beauty, hairstyle, or editorial direction.", "Generate a private album with polished portrait options.", "Use favorites for profiles, campaigns, or video-ready motion ideas."],
    ctaLabel: "Create AI Beauty Photos",
    ctaHref: "/tools/virtual-try-on"
  },
  valentine: {
    label: "Valentine",
    title: "AI Valentine Photo Maker - romantic couple photos from private uploads",
    description: "Create Valentine AI photos for couples, proposals, gifts, and romantic albums with MydreamShoots. Build private couple portraits, greeting-card looks, and seasonal images from everyday uploads.",
    keywords: "AI Valentine Photo Maker, AI couple photos, Valentine photo generator, romantic AI portraits, MydreamShoots Valentine",
    h2: "valentine",
    h3: ["AI Valentine couple portraits", "Romantic gift-ready albums", "Private seasonal photo delivery"],
    intro: "The Valentine directory focuses on romantic images customers can use as gifts, keepsakes, profile updates, and seasonal posts. Instead of a one-off text request, the page organizes the experience around couple identity, mood, delivery, and private album review.",
    details: [
      "Use Valentine for warm couple portraits, proposal-style images, anniversary looks, greeting-card crops, and cinematic date-night scenes.",
      "The copy is written for MydreamShoots customers: upload source portraits, select the relationship moment, then review a private set before downloading.",
      "This directory can sit under /collections/valentine as a second-level product category and link into the matching tool or package."
    ],
    useCases: ["Couple profile photos", "Valentine cards and private gifts", "Engagement announcement concepts", "Romantic social story images"],
    workflow: ["Upload individual or couple source photos.", "Pick romantic, cinematic, card, or casual date-night styling.", "Generate a private album with multiple crops.", "Download images for gifts, posts, or keepsakes."],
    ctaLabel: "Make Valentine Photos",
    ctaHref: "/tools/wedding-portraits"
  },
  headshots: {
    label: "Headshots",
    title: "AI Headshot Maker - professional profile photos from selfies",
    description: "Generate professional AI headshots for LinkedIn, resumes, founder profiles, teams, and creator pages with private MydreamShoots uploads and album delivery.",
    keywords: "AI Headshot Maker, professional AI headshots, LinkedIn photo generator, business portrait AI, MydreamShoots headshots",
    h2: "headshots",
    h3: ["Professional AI headshots", "Business profile photo structure", "Private delivery for teams and founders"],
    intro: "The Headshots collection is for customers who need sharp, trustworthy portraits without booking a studio. It explains business-photo outcomes, source-photo quality, and how credits convert into private album options.",
    details: [
      "Headshot pages should not repeat the homepage. They need clear business intent: LinkedIn, resumes, founder bios, consulting profiles, hiring pages, and team directories.",
      "MydreamShoots keeps the workflow simple: upload varied selfies, select a professional look, generate, then choose the best portrait from a private gallery.",
      "The directory supports individual users and teams because the product structure is outcome-based rather than prompt-based."
    ],
    useCases: ["LinkedIn profile refresh", "Founder and operator bios", "Resume and job-search portraits", "Team page headshots"],
    workflow: ["Upload clear face photos with varied angles.", "Choose business, founder, or clean studio styling.", "Generate multiple realistic portrait options.", "Download final headshots for professional channels."],
    ctaLabel: "Create Headshots",
    ctaHref: "/tools/headshot"
  },
  sports: {
    label: "Sports",
    title: "AI Sports Fan Photo Maker - stadium portraits and fan posters",
    description: "Create AI sports fan photos, stadium portraits, fan posters, match-day avatars, and social banners with MydreamShoots private uploads.",
    keywords: "AI Sports Fan Photo Maker, World Cup fan photos, stadium portrait generator, fan poster AI, sports avatar maker",
    h2: "sports",
    h3: ["Sports fan photo categories", "Match-day avatar and poster outputs", "Private sports album workflow"],
    intro: "The Sports collection turns fan moments into stadium-style images, posters, avatars, and banners. It is built for match days, tournaments, and seasonal campaigns without relying on official logos or protected marks.",
    details: [
      "Sports pages need concrete outputs: fan posters, stadium portraits, square avatars, wide banners, friend-group scenes, and social story crops.",
      "The MydreamShoots workflow keeps the result personal: customers upload their own images, choose fan energy, then receive a private album.",
      "This content makes /collections/sports distinct from /tools/world-cup-fan-photos while still linking customers to the matching tool."
    ],
    useCases: ["World Cup and football fan photos", "Match-day profile images", "Tournament posters", "Sports creator social content"],
    workflow: ["Upload one or more fan portraits.", "Choose stadium, poster, avatar, or friend-scene styling.", "Generate private match-day images.", "Download social-ready crops and banners."],
    ctaLabel: "Create Fan Photos",
    ctaHref: "/tools/world-cup-fan-photos"
  },
  creative: {
    label: "Creative",
    title: "AI Creative Photo Maker - cinematic portraits and themed scenes",
    description: "Build cinematic AI photos with MydreamShoots: cyberpunk portraits, noir characters, gala scenes, creator images, and dramatic private albums from everyday uploads.",
    keywords: "AI Creative Photo Maker, cinematic AI portraits, cyberpunk portrait generator, themed AI photos, MydreamShoots creative",
    h2: "creative",
    h3: ["Cinematic AI photo themes", "Creator-ready image directions", "From selfie to private themed album"],
    intro: "The Creative collection is the place for customers who want a strong visual world. It groups cyberpunk, noir, gala, creator, fantasy, and editorial scenes into an outcome-driven product structure.",
    details: [
      "This page intentionally goes beyond tool labels. It explains the creative promise: mood, setting, crop, persona, and album delivery.",
      "Customers can use it for profile campaigns, content launches, character portraits, and high-impact social visuals.",
      "Each category links back into a static tool URL so the navigation remains clean and shareable."
    ],
    useCases: ["Cyberpunk and neon portraits", "Noir and character concepts", "Creator campaign visuals", "Editorial social images"],
    workflow: ["Upload strong source portraits.", "Select a cinematic or creator direction.", "Generate a private themed album.", "Choose final images for profile, campaign, or gallery use."],
    ctaLabel: "Create Cinematic Photos",
    ctaHref: "/tools/cyberpunk-portrait"
  },
  hairstyle: {
    label: "Hairstyle",
    title: "AI Hairstyle Photo Maker - preview polished hair and beauty looks",
    description: "Preview AI hairstyle photos with MydreamShoots: color direction, length ideas, salon-ready portraits, beauty crops, and private package delivery from everyday uploads.",
    keywords: "AI Hairstyle Photo Maker, hairstyle preview AI, hair color photo generator, beauty hair portraits, MydreamShoots hairstyle",
    h2: "hairstyle",
    h3: ["Hairstyle preview structure", "Color and cut planning", "Private beauty album delivery"],
    intro: "The Hairstyle package focuses on hair direction before a full portrait set. Customers can compare length, color, styling, lighting, and beauty crops without mixing in unrelated package categories.",
    details: [
      "Use this page for salon inspiration, creator refreshes, soft glam portraits, and hairstyle planning before a paid package.",
      "The best inputs are clear face photos with visible hair shape, varied angles, and simple lighting.",
      "Outputs should emphasize hairstyle differences while keeping identity, face shape, and private album delivery consistent."
    ],
    useCases: ["Hair color previews", "Salon consultation ideas", "Creator beauty refreshes", "Profile portraits with new styling"],
    workflow: ["Upload clear portraits with visible hair.", "Choose the hairstyle direction.", "Generate a private preview album.", "Save favorites before ordering a full package."],
    ctaLabel: "Create Hairstyle Photos",
    ctaHref: "/tools/virtual-try-on"
  },
  mafia: {
    label: "Mafia",
    title: "AI Mafia Photo Maker - cinematic noir character portraits",
    description: "Create AI mafia photos with MydreamShoots: noir portraits, tailored character scenes, moody lighting, vintage interiors, and private cinematic albums from customer uploads.",
    keywords: "AI Mafia Photo Maker, noir portrait generator, cinematic character photos, mafia AI portraits, MydreamShoots mafia",
    h2: "mafia",
    h3: ["Noir character structure", "Cinematic scene planning", "Private themed album delivery"],
    intro: "The Mafia package is a character-driven photo direction for customers who want polished noir styling, tailored wardrobe cues, dramatic interiors, and cinematic social images.",
    details: [
      "This page should stay focused on mafia and noir outcomes instead of showing broad public catalog content.",
      "The package works best with expressive portraits, clean face visibility, and customer approval of a dramatic character direction.",
      "Finished images can be used for private albums, campaign visuals, profile concepts, or story-led creator content."
    ],
    useCases: ["Noir character portraits", "Cinematic social posts", "Creator campaign images", "Private themed albums"],
    workflow: ["Upload source portraits with clear facial detail.", "Select the noir or mafia direction.", "Generate a private character album.", "Download final images for the chosen channel."],
    ctaLabel: "Create Mafia Photos",
    ctaHref: "/tools/noir-portrait"
  },
  "black-party": {
    label: "Black Party",
    title: "AI Black Party Photo Maker - refined event and nightlife portraits",
    description: "Create AI black party photos with MydreamShoots: refined event portraits, evening wardrobe concepts, cinematic interiors, social-ready crops, and private album delivery.",
    keywords: "AI Black Party Photo Maker, event portrait AI, nightlife photo generator, black party portraits, MydreamShoots event photos",
    h2: "black party",
    h3: ["Event portrait structure", "Evening wardrobe and lighting", "Private nightlife album delivery"],
    intro: "The Black Party package gives evening-event imagery its own workflow. Customers can preview refined wardrobe, moody light, polished poses, and private album outputs without seeing unrelated categories.",
    details: [
      "Use this package for formal nightlife portraits, private event concepts, creator party campaigns, and elegant social images.",
      "Recommended inputs include clear portraits, one full-body reference if available, and notes about wardrobe or mood.",
      "The page can explain lighting, styling, image count, and delivery expectations for this specific theme."
    ],
    useCases: ["Formal event portraits", "Nightlife profile images", "Creator party campaigns", "Private album concepts"],
    workflow: ["Upload clear portraits and wardrobe references.", "Choose the black party direction.", "Generate polished evening images.", "Download favorites for social or private use."],
    ctaLabel: "Create Black Party Photos",
    ctaHref: "/tools/noir-portrait"
  },
  cyberpunk: {
    label: "Cyberpunk",
    title: "AI Cyberpunk Photo Maker - neon city portraits from selfies",
    description: "Generate AI cyberpunk portraits with MydreamShoots: neon city lighting, futuristic wardrobe, cinematic street scenes, and private album delivery.",
    keywords: "AI Cyberpunk Photo Maker, cyberpunk portrait generator, neon AI photos, futuristic portrait AI, MydreamShoots cyberpunk",
    h2: "cyberpunk",
    h3: ["Neon portrait structure", "Futuristic scene direction", "Private cyberpunk album delivery"],
    intro: "The Cyberpunk package is for customers who want high-impact neon portraits, dramatic street scenes, and futuristic styling from private uploads.",
    details: [
      "This page should describe neon lighting, wardrobe mood, portrait crop, and album outputs specific to cyberpunk results.",
      "The strongest inputs are expressive face photos with enough detail for identity preservation.",
      "Finished images work for profile campaigns, music-style visuals, gaming avatars, and creator launches."
    ],
    useCases: ["Neon profile portraits", "Gaming and creator avatars", "Music campaign images", "Futuristic social posts"],
    workflow: ["Upload clean source portraits.", "Choose neon city styling.", "Generate a private cyberpunk album.", "Download favorites for profile or campaign use."],
    ctaLabel: "Create Cyberpunk Photos",
    ctaHref: "/tools/cyberpunk-portrait"
  },
  travel: {
    label: "Travel",
    title: "AI Travel Photo Maker - destination portraits without a studio trip",
    description: "Create AI travel photos, destination portraits, outdoor scenes, vacation-style albums, and adventure images with MydreamShoots private uploads.",
    keywords: "AI Travel Photo Maker, destination portrait generator, AI vacation photos, outdoor AI portraits, travel scene photos",
    h2: "travel",
    h3: ["Destination-style AI portraits", "Outdoor and vacation scene structure", "Travel albums from private uploads"],
    intro: "The Travel collection helps customers create destination-style photos even when they only have everyday source images. It is built around places, mood, lighting, and album-ready crops.",
    details: [
      "Travel pages should show destination intent: beaches, mountains, city streets, outdoor adventures, and scenic portraits.",
      "MydreamShoots keeps the experience practical by asking for usable source photos first, then generating consistent destination looks.",
      "This category supports creators, dating profiles, travel memories, and campaign images."
    ],
    useCases: ["Vacation-style profile photos", "Outdoor adventure portraits", "Creator destination campaigns", "Lifestyle album images"],
    workflow: ["Upload portraits with clean lighting.", "Choose beach, city, mountain, or outdoor styling.", "Generate a private destination album.", "Download final images for profile or social use."],
    ctaLabel: "Create Travel Photos",
    ctaHref: "/tools/nature-adventure"
  }
};

const toolDirectory: Record<string, SeoDirectorySeed> = {
  headshot: {
    label: "Headshot",
    title: "AI Headshot Maker - Create professional profile photos with MydreamShoots",
    description: "Use the MydreamShoots AI Headshot Maker to create realistic LinkedIn, resume, founder, and team portraits from private source photos.",
    keywords: "AI Headshot Maker, professional headshot AI, LinkedIn headshot generator, MydreamShoots headshot",
    h2: "headshot",
    h3: ["Professional headshot input guide", "Business portrait outputs", "Private profile photo delivery"],
    intro: "Upload clear selfies or casual portraits and turn them into polished headshots for LinkedIn, resumes, founder pages, team bios, and creator profiles.",
    details: ["Best inputs include face-forward photos with varied angles, simple lighting, and natural expressions.", "Finished results include clean studio portraits, founder-style images, resume-ready crops, and team profile options.", "Start here when you need a professional portrait set, then continue to the editor to review credits and create your private album."],
    useCases: ["LinkedIn and resume portraits", "Founder pages", "Consultant bios", "Team profile images"],
    workflow: ["Upload source portraits.", "Choose professional styling.", "Generate headshot options.", "Download final profile-ready images."],
    ctaLabel: "Create Profile Headshots",
    ctaHref: "/app/create?tool_id=headshot"
  },
  "background-changer": {
    label: "Background Changer",
    title: "AI Background Changer - replace photo backgrounds with MydreamShoots",
    description: "Use the MydreamShoots AI Background Changer to replace distracting photo backgrounds with cleaner studio, lifestyle, travel, or brand-ready scenes.",
    keywords: "AI Background Changer, replace photo background AI, background editor, MydreamShoots background changer",
    h2: "background changer",
    h3: ["Background changer input guide", "Clean background outputs", "Next steps for edited images"],
    intro: "Upload a clear subject photo and replace the setting behind it with a cleaner background for portraits, product shots, listings, and social images.",
    details: ["Best inputs have a visible person, product, or object with enough contrast from the background.", "Finished results can move a subject from cluttered rooms into studio, lifestyle, travel, or brand-friendly scenes.", "Use the edited image as a final asset or as stronger source material before creating a full photo package."],
    useCases: ["Cleaner profile photos", "Product and listing images", "Creator post drafts", "Source-photo repair before a package"],
    workflow: ["Upload a clear subject photo.", "Choose the new background direction.", "Generate the edited image.", "Save or continue with a larger photo set."],
    ctaLabel: "Change a Background",
    ctaHref: "/app/create?tool_id=background-changer"
  },
  "image-to-video": {
    label: "Image to Video",
    title: "AI Image to Video - create short clips from still images with MydreamShoots",
    description: "Turn a still image into a short AI video clip with MydreamShoots: add motion, camera movement, mood, and private video output for social or campaign use.",
    keywords: "AI Image to Video, image to video AI, short video clip generator, photo animation AI, MydreamShoots video",
    h2: "image to video",
    h3: ["Image to video input guide", "Motion and short clip outputs", "Private video delivery"],
    intro: "Upload one strong still image and turn it into a short video output with motion for creator intros, product teasers, social clips, and campaign previews.",
    details: ["Best inputs are sharp portraits, product shots, or finished scene images with a clear subject and strong composition.", "Finished results add motion such as gentle camera movement, atmosphere, pacing, and short-form video direction instead of creating another still image.", "Review the private clip, use it as a social-ready video draft, or continue with a larger motion package when the direction works."],
    useCases: ["Creator intro clips", "Product teaser videos", "Social motion posts", "Campaign video previews"],
    workflow: ["Upload one finished image.", "Choose the motion idea and clip use case.", "Generate a private short video draft.", "Download or use the result to plan the next video package."],
    ctaLabel: "Create a Short Video",
    ctaHref: "/app/create?tool_id=image-to-video"
  },
  "world-cup-fan-photos": {
    label: "World Cup Fan Photos",
    title: "AI World Cup Fan Photo Maker - stadium portraits and match-day posters",
    description: "Create World Cup fan photos, stadium portraits, match-day posters, avatars, and social banners with MydreamShoots private AI generation.",
    keywords: "AI World Cup Fan Photo Maker, World Cup fan photos, stadium portrait AI, match-day poster generator",
    h2: "world cup fan photos",
    h3: ["Stadium fan photo inputs", "Match-day poster outputs", "Private sports image delivery"],
    intro: "Upload fan portraits and create match-day images with stadium scenes, fan posters, avatars, banners, and friend-group concepts that feel personal without needing official marks.",
    details: ["Use it for tournament campaigns, profile updates, and sports creator content.", "The tool can create square avatars, poster-like compositions, and wide social banners.", "Customers stay inside the MydreamShoots private upload and album flow."],
    useCases: ["Football fan avatars", "Tournament posters", "Match-day social posts", "Friend fan-photo concepts"],
    workflow: ["Upload fan portraits.", "Choose stadium, poster, or avatar direction.", "Generate private sports images.", "Download social-ready crops."],
    ctaLabel: "Create Fan Photos",
    ctaHref: "/app/create?tool_id=world-cup-fan-photos"
  },
  "virtual-try-on": {
    label: "Virtual Try-On",
    title: "AI Outfit Generator - virtual try-on photos with MydreamShoots",
    description: "Create virtual try-on photos, outfit previews, hairstyle ideas, and fashion-ready portraits with MydreamShoots private AI tools.",
    keywords: "AI Outfit Generator, virtual try-on AI, outfit photo maker, hairstyle preview AI, MydreamShoots fashion",
    h2: "virtual try-on",
    h3: ["Outfit and hairstyle previews", "Fashion portrait structure", "Private try-on workflow"],
    intro: "The virtual try-on tool helps customers preview wardrobe, hairstyle, and fashion directions before committing to a larger photo package.",
    details: ["It is useful for outfit planning, creator looks, beauty profiles, and editorial social images.", "The page explains how source portraits become try-on concepts and private album options.", "Static URL structure keeps the tool shareable at /tools/virtual-try-on."],
    useCases: ["Outfit previews", "Hairstyle concepts", "Beauty profile refreshes", "Fashion editorial tests"],
    workflow: ["Upload clear source portraits.", "Choose outfit, hairstyle, or fashion direction.", "Generate try-on images.", "Save favorites for a full package."],
    ctaLabel: "Try Outfit Looks",
    ctaHref: "/app/create?tool_id=virtual-try-on"
  }
};

function normalizeDirectorySlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "")
    .replace(/^collections\//, "")
    .replace(/^tools\//, "")
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function isExplicitSeoDirectoryContent(kind: SeoDirectoryKind, rawSlug: string): boolean {
  const slug = normalizeDirectorySlug(rawSlug);
  return kind === "collection" ? Boolean(collectionDirectory[slug]) : Boolean(toolDirectory[slug]);
}

function absoluteSeoImageUrl(site: Site, imagePath = ""): string {
  const value = imagePath.trim();
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  const domain = site.primaryDomain?.trim();
  if (!domain || domain.includes("localhost")) return value;
  const base = domain.startsWith("http://") || domain.startsWith("https://") ? domain.replace(/\/$/, "") : `https://${domain}`;
  return `${base}${value.startsWith("/") ? value : `/${value}`}`;
}

function titleCase(slug: string): string {
  return slug.split("-").filter(Boolean).map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`).join(" ") || "AI Photo";
}

function fallbackCollection(slug: string): SeoDirectorySeed {
  const label = titleCase(slug);
  const lower = label.toLowerCase();
  return {
    label,
    title: `AI ${label} Photo Maker - Create detailed ${label} photos with MydreamShoots`,
    description: `Create detailed AI ${lower} photos with MydreamShoots. Explore private uploads, outcome-based photo packages, editable albums, credit-safe generation, and share-ready image directions.`,
    keywords: `AI ${label} Photo Maker, ${label} AI photos, MydreamShoots ${lower}, private AI photo package`,
    h2: lower,
    h3: [`AI ${lower} photo structure`, `${label} package workflow`, `Private ${lower} album delivery`],
    intro: `The ${label} directory gives this product category its own search intent, page copy, and customer workflow instead of reusing the homepage.`,
    details: [
      `Customers can understand what a ${lower} package creates, which source photos work best, and how the final album is delivered.`,
      "The page keeps navigation static and memorable while allowing the storefront to filter active packages behind the scenes.",
      "Use this content area to describe styles, crops, delivery formats, and practical customer use cases in detail."
    ],
    useCases: [`${label} profile images`, `${label} social posts`, `${label} private albums`, `${label} campaign visuals`],
    workflow: ["Upload clear source photos.", `Choose a ${lower} direction.`, "Generate a private album.", "Download final images for the intended channel."],
    ctaLabel: `Create ${label} Photos`,
    ctaHref: "/tools/image-studio"
  };
}

function fallbackTool(slug: string): SeoDirectorySeed {
  const label = titleCase(slug);
  const lower = label.toLowerCase();
  return {
    label,
    title: `AI ${label} - Create detailed photos with MydreamShoots`,
    description: `Use the MydreamShoots AI ${label} tool to turn everyday uploads into private, share-ready images with clear guidance before you create.`,
    keywords: `AI ${label}, ${label} generator, MydreamShoots ${lower}, private AI photo editor`,
    h2: lower,
    h3: [`${label} input guide`, `${label} output ideas`, `Private ${label} delivery`],
    intro: `Upload clear source material and use ${label} to create a private result that matches your next photo or video goal.`,
    details: [
      "Start with source photos or references that clearly show the subject, style, and use case you want.",
      "The finished result appears in your private account for review, download, and follow-up edits.",
      "Use this page to compare the expected output, check the input guidance, and continue when the tool fits your goal."
    ],
    useCases: [`${label} profile photos`, `${label} social images`, `${label} album concepts`, `${label} creator visuals`],
    workflow: ["Review the result this tool is best for.", "Upload clear source photos.", "Choose the look or use case you need.", "Create and download the private result."],
    ctaLabel: `Start ${label}`,
    ctaHref: `/app/create?tool_id=${slug}`
  };
}

export function getSeoDirectoryContent(kind: SeoDirectoryKind, rawSlug: string): SeoDirectoryContent {
  const slug = normalizeDirectorySlug(rawSlug);
  const explicit = isExplicitSeoDirectoryContent(kind, slug);
  const source = kind === "collection" ? collectionDirectory[slug] ?? fallbackCollection(slug) : toolDirectory[slug] ?? fallbackTool(slug);
  const canonicalPath = `/${kind === "collection" ? "collections" : "tools"}/${slug}`;
  return {
    ...source,
    slug,
    explicit,
    canonicalPath,
    ctaHref: kind === "collection" ? `/app/create?tool_id=${slug}` : source.ctaHref
  };
}

export function metadataForSeoDirectory(site: Site, kind: SeoDirectoryKind, rawSlug: string): Metadata {
  const item = getSeoDirectoryContent(kind, rawSlug);
  const base = site.primaryDomain && !site.primaryDomain.includes("localhost") ? `https://${site.primaryDomain}` : "";
  const canonical = base ? `${base}${item.canonicalPath}` : item.canonicalPath;
  const ogImage = absoluteSeoImageUrl(site, site.themeSettings.publishedJson.seo?.defaultOgImage);
  return {
    title: item.title,
    description: item.description,
    keywords: item.keywords.split(",").map((keyword) => keyword.trim()).filter(Boolean),
    alternates: { canonical },
    robots: {
      index: item.explicit,
      follow: true
    },
    openGraph: {
      title: item.title,
      description: item.description,
      url: canonical,
      siteName: site.branding.logoText || site.name,
      ...(ogImage ? { images: [ogImage] } : {})
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title: item.title,
      description: item.description,
      ...(ogImage ? { images: [ogImage] } : {})
    }
  };
}

export function withSeoDirectorySection(pageJson: ThemePageJson, kind: SeoDirectoryKind, rawSlug: string, options: { focused?: boolean } = {}): ThemePageJson {
  const item = getSeoDirectoryContent(kind, rawSlug);
  const sectionId = `seo_${kind}_${item.slug}`;
  const seoSection: SectionInstance = {
    type: "seo_directory_content",
    settings: {
      anchor: `${kind}-${item.slug}`,
      kind,
      label: item.label,
      title: item.h2,
      subtitle: item.intro,
      detailList: item.details.join("|"),
      h3List: item.h3.join("|"),
      useCases: item.useCases.join("|"),
      workflow: item.workflow.join("|"),
      ctaLabel: item.ctaLabel,
      ctaHref: item.ctaHref
    },
    blocks: []
  };
  const [firstSection, ...rest] = pageJson.sectionsOrder;
  const sectionsOrder = options.focused
    ? (firstSection ? [firstSection, sectionId] : [sectionId])
    : (firstSection ? [firstSection, sectionId, ...rest.filter((id) => id !== sectionId)] : [sectionId]);
  const focusedFirstSection = firstSection && pageJson.sections[firstSection]
    ? {
        ...pageJson.sections[firstSection],
        blocks: [],
        settings: {
          anchor: pageJson.sections[firstSection].settings.anchor,
          eyebrow: pageJson.sections[firstSection].settings.eyebrow,
          headingLevel: pageJson.sections[firstSection].settings.headingLevel,
          layout: pageJson.sections[firstSection].settings.layout,
          subtitle: pageJson.sections[firstSection].settings.subtitle,
          title: pageJson.sections[firstSection].settings.title
        }
      }
    : undefined;
  const existingSections = options.focused && firstSection
    ? { [firstSection]: focusedFirstSection ?? pageJson.sections[firstSection] }
    : pageJson.sections;
  return {
    ...pageJson,
    sectionsOrder,
    sections: {
      ...existingSections,
      [sectionId]: seoSection
    }
  };
}
