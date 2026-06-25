import type { Metadata } from "next";
import type { SectionInstance, Site, ThemePageJson } from "@/lib/types";

export type SeoDirectoryKind = "collection" | "tool";

export type SeoDirectoryContent = {
  slug: string;
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

type SeoDirectorySeed = Omit<SeoDirectoryContent, "slug" | "canonicalPath">;

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
    intro: "The Valentine directory focuses on romantic images customers can use as gifts, keepsakes, profile updates, and seasonal posts. Instead of generic prompt text, the page organizes the experience around couple identity, mood, delivery, and private album review.",
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
    intro: "This tool page is focused on professional portraits. It explains what to upload, what the headshot generator creates, and how the result moves into a private customer album.",
    details: ["Best inputs include clear face photos, varied angles, and simple lighting.", "Outputs can include clean studio portraits, founder-style images, and social profile crops.", "The page is unique to the headshot workflow rather than a copy of the tools directory."],
    useCases: ["LinkedIn and resume portraits", "Founder pages", "Consultant bios", "Team profile images"],
    workflow: ["Upload source portraits.", "Choose professional styling.", "Generate headshot options.", "Download final profile-ready images."],
    ctaLabel: "Open Headshot Maker",
    ctaHref: "/dashboard?tool_id=headshot"
  },
  "world-cup-fan-photos": {
    label: "World Cup Fan Photos",
    title: "AI World Cup Fan Photo Maker - stadium portraits and match-day posters",
    description: "Create World Cup fan photos, stadium portraits, match-day posters, avatars, and social banners with MydreamShoots private AI generation.",
    keywords: "AI World Cup Fan Photo Maker, World Cup fan photos, stadium portrait AI, match-day poster generator",
    h2: "world cup fan photos",
    h3: ["Stadium fan photo inputs", "Match-day poster outputs", "Private sports image delivery"],
    intro: "This tool page focuses on match-day images: stadium scenes, fan posters, avatars, banners, and friend-group concepts that feel personal without needing official marks.",
    details: ["Use it for tournament campaigns, profile updates, and sports creator content.", "The tool can create square avatars, poster-like compositions, and wide social banners.", "Customers stay inside the MydreamShoots private upload and album flow."],
    useCases: ["Football fan avatars", "Tournament posters", "Match-day social posts", "Friend fan-photo concepts"],
    workflow: ["Upload fan portraits.", "Choose stadium, poster, or avatar direction.", "Generate private sports images.", "Download social-ready crops."],
    ctaLabel: "Open Fan Photo Maker",
    ctaHref: "/dashboard?tool_id=world-cup-fan-photos"
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
    ctaLabel: "Open Outfit Generator",
    ctaHref: "/dashboard?tool_id=virtual-try-on"
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
    description: `Use the MydreamShoots AI ${label} tool to create private, detailed, share-ready images from everyday uploads with a clear editor workflow.`,
    keywords: `AI ${label}, ${label} generator, MydreamShoots ${lower}, private AI photo editor`,
    h2: lower,
    h3: [`${label} input guide`, `${label} output ideas`, `Private ${label} delivery`],
    intro: `This tool page explains the ${label} workflow with unique copy, source-photo guidance, and output expectations.`,
    details: [
      "Customers should know what to upload, what the tool changes, and where finished images appear after generation.",
      "The copy is specific to this tool URL, so it does not duplicate the general tools directory or homepage.",
      "The static path can be shared directly while the editor receives the matching tool identifier."
    ],
    useCases: [`${label} profile photos`, `${label} social images`, `${label} album concepts`, `${label} creator visuals`],
    workflow: ["Open the selected tool.", "Upload source photos.", "Choose the preset direction.", "Generate and download the private result."],
    ctaLabel: `Open ${label}`,
    ctaHref: `/dashboard?tool_id=${slug}`
  };
}

export function getSeoDirectoryContent(kind: SeoDirectoryKind, rawSlug: string): SeoDirectoryContent {
  const slug = normalizeDirectorySlug(rawSlug);
  const source = kind === "collection" ? collectionDirectory[slug] ?? fallbackCollection(slug) : toolDirectory[slug] ?? fallbackTool(slug);
  return {
    ...source,
    slug,
    canonicalPath: `/${kind === "collection" ? "collections" : "tools"}/${slug}`
  };
}

export function metadataForSeoDirectory(site: Site, kind: SeoDirectoryKind, rawSlug: string): Metadata {
  const item = getSeoDirectoryContent(kind, rawSlug);
  const base = site.primaryDomain && !site.primaryDomain.includes("localhost") ? `https://${site.primaryDomain}` : "";
  const canonical = base ? `${base}${item.canonicalPath}` : item.canonicalPath;
  return {
    title: item.title,
    description: item.description,
    keywords: item.keywords.split(",").map((keyword) => keyword.trim()).filter(Boolean),
    alternates: { canonical },
    openGraph: {
      title: item.title,
      description: item.description,
      url: canonical,
      siteName: site.branding.logoText || site.name
    },
    twitter: {
      card: "summary",
      title: item.title,
      description: item.description
    }
  };
}

export function withSeoDirectorySection(pageJson: ThemePageJson, kind: SeoDirectoryKind, rawSlug: string): ThemePageJson {
  const item = getSeoDirectoryContent(kind, rawSlug);
  const sectionId = `seo_${kind}_${item.slug}`;
  if (pageJson.sections[sectionId]) return pageJson;
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
  const sectionsOrder = firstSection ? [firstSection, sectionId, ...rest] : [sectionId];
  return {
    ...pageJson,
    sectionsOrder,
    sections: {
      ...pageJson.sections,
      [sectionId]: seoSection
    }
  };
}
