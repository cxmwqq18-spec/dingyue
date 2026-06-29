import type { Metadata } from "next";
import type { SectionInstance, Site, ThemePageJson } from "@/lib/types";
import { publicSiteUrlFromParts } from "@/lib/domain-routing";

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

type DreamshootRouteMetadataSeed = {
  title: string;
  description: string;
  keywords: string;
  canonicalPath: string;
  index: boolean;
  follow: boolean;
};

type SeoDirectoryMap = Record<string, SeoDirectorySeed>;

function isAidreamcapesSite(site?: Pick<Site, "id" | "slug" | "name" | "primaryDomain"> & { branding?: Pick<Site["branding"], "logoText"> }): boolean {
  if (!site) return false;
  const value = `${site.id} ${site.slug} ${site.name} ${site.primaryDomain} ${site.branding?.logoText ?? ""}`.toLowerCase();
  return value.includes("aidreamcapes");
}

const dreamshootFallbackRouteMetadata: Record<string, DreamshootRouteMetadataSeed> = {
  "/login": {
    title: "Sign in to MydreamShoots - private AI photo workspace",
    description:
      "Sign in to MydreamShoots to manage private uploads, AI photo package requests, credits, checkout history, generated albums, and customer-only gallery downloads.",
    keywords: "MydreamShoots login, AI photo account, private AI photo workspace, customer gallery sign in",
    canonicalPath: "/login",
    index: false,
    follow: true
  },
  "/pricing": {
    title: "MydreamShoots Pricing - AI photo credits, plans, and top-ups",
    description:
      "Compare MydreamShoots plans, monthly AI photo credits, one-time top-ups, private model access, package generation, secure checkout, and gallery delivery before you create.",
    keywords: "MydreamShoots pricing, AI photo credits, AI portrait subscription, private photo package plans",
    canonicalPath: "/pricing",
    index: true,
    follow: true
  },
  "/tools": {
    title: "MydreamShoots AI Photo Tools",
    description:
      "Explore MydreamShoots tools for headshots, background edits, video clips, try-on previews, private uploads, credits, and album-ready results.",
    keywords: "MydreamShoots tools, AI photo tools, AI headshot tool, background changer, image to video AI, virtual try-on",
    canonicalPath: "/tools",
    index: true,
    follow: true
  }
};

export const dreamshootPublicSeoPageMetadata: Record<string, DreamshootRouteMetadataSeed> = {
  "/creators-circle": {
    title: "MydreamShoots Creators Circle - affiliate and creator AI photo program",
    description:
      "Join the MydreamShoots Creators Circle for AI photo package campaigns, creator-ready assets, private galleries, credit-based workflows, and partner collaboration opportunities.",
    keywords: "MydreamShoots creators circle, AI photo creator program, creator AI photo campaign, AI portrait affiliate program",
    canonicalPath: "/creators-circle",
    index: true,
    follow: true
  },
  "/partner-registration": {
    title: "MydreamShoots Partner Registration - apply for creator collaborations",
    description:
      "Apply to partner with MydreamShoots and share your audience, publishing channels, creator campaign fit, and AI photo package collaboration goals.",
    keywords: "MydreamShoots partner registration, AI photo partner application, creator collaboration application, AI portrait campaign partner",
    canonicalPath: "/partner-registration",
    index: true,
    follow: true
  },
  "/about-us": {
    title: "About MyDreamShoots",
    description:
      "Learn about MyDreamShoots, an AI photo package workspace for private uploads, personal AI models, clear credits, secure checkout, and customer-only gallery delivery.",
    keywords: "About MyDreamShoots, AI photo packages, private AI photo albums, personal AI model, AI portrait workspace",
    canonicalPath: "/about-us",
    index: true,
    follow: true
  },
  "/contact-us": {
    title: "Contact MyDreamShoots - support, sales, and company address",
    description:
      "Contact MyDreamShoots for AI photo package support, sales questions, account help, billing review, privacy requests, or company address information.",
    keywords: "Contact MyDreamShoots, MyDreamShoots support, AI photo support, MyDreamShoots sales, private album help",
    canonicalPath: "/contact-us",
    index: true,
    follow: true
  }
};

const aidreamcapesPublicSeoPageMetadata: Record<string, DreamshootRouteMetadataSeed> = {
  "/about-us": {
    title: "About Aidreamcapes",
    description:
      "Learn about Aidreamcapes, a private AI dreamscape portrait workspace for source photo planning, visible credits, cinematic scenes, and customer-only gallery delivery.",
    keywords: "About Aidreamcapes, AI dreamscape portraits, private AI portrait gallery, fantasy travel photos, cinematic portrait workspace",
    canonicalPath: "/about-us",
    index: true,
    follow: true
  },
  "/contact-us": {
    title: "Contact Aidreamcapes",
    description:
      "Contact Aidreamcapes for dreamscape portrait support, source photo guidance, sales questions, billing review, privacy requests, or company address information.",
    keywords: "Contact Aidreamcapes, Aidreamcapes support, AI dreamscape support, Aidreamcapes sales, private gallery help",
    canonicalPath: "/contact-us",
    index: true,
    follow: true
  },
  "/creators-circle": {
    title: "Aidreamcapes Creators Circle - creator dreamscape portrait program",
    description:
      "Join the Aidreamcapes Creators Circle for AI dreamscape portrait campaigns, private galleries, visible credits, and creator collaboration opportunities.",
    keywords: "Aidreamcapes creators circle, AI dreamscape creator program, creator portrait campaign, AI portrait affiliate program",
    canonicalPath: "/creators-circle",
    index: true,
    follow: true
  },
  "/partner-registration": {
    title: "Aidreamcapes Partner Registration - apply for creator collaborations",
    description:
      "Apply to partner with Aidreamcapes and share your audience, publishing channels, campaign fit, and dreamscape portrait collaboration goals.",
    keywords: "Aidreamcapes partner registration, AI dreamscape partner application, creator collaboration application, AI portrait campaign partner",
    canonicalPath: "/partner-registration",
    index: true,
    follow: true
  }
};

export const dreamshootPublicSeoPagePaths = Object.keys(dreamshootPublicSeoPageMetadata);

const aidreamcapesFallbackRouteMetadata: Record<string, DreamshootRouteMetadataSeed> = {
  "/tools": {
    title: "Aidreamcapes Studio Tools",
    description:
      "Explore Aidreamcapes tools for dreamscape portraits, coastal scenes, fantasy avatars, warm profile images, and private gallery delivery.",
    keywords: "Aidreamcapes tools, dreamscape portrait tools, fantasy avatar tool, cinematic portrait generator",
    canonicalPath: "/tools",
    index: true,
    follow: true
  },
  "/terms": {
    title: "Aidreamcapes Terms of Service",
    description:
      "Review Aidreamcapes account, credit, upload, checkout, generation, private gallery, refund, and acceptable-use terms before creating portraits.",
    keywords: "Aidreamcapes terms, AI portrait terms, private gallery terms, AI credit policy",
    canonicalPath: "/terms",
    index: true,
    follow: true
  }
};

const collectionDirectory: Record<string, SeoDirectorySeed> = {
  beauty: {
    label: "Beauty",
    title: "AI Beauty Photo Packages - polished portraits and soft glam albums",
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

const aidreamcapesCollectionDirectory: SeoDirectoryMap = {
  "dreamscape-portraits": {
    label: "Dreamscape Portraits",
    title: "AI Dreamscape Portraits - cinematic escape photos with Aidreamcapes",
    description: "Create cinematic AI dreamscape portraits with Aidreamcapes: surreal destinations, soft light, private source uploads, credit-based generation, and gallery-ready escape imagery.",
    keywords: "Aidreamcapes dreamscape portraits, AI dream portraits, cinematic escape photos, fantasy travel portraits",
    h2: "dreamscape portraits",
    h3: ["Cinematic dream portrait styles", "Private escape-photo workflow", "Gallery-ready fantasy scenes"],
    intro: "Dreamscape Portraits turn everyday uploads into imagined places: misty terraces, moonlit gardens, warm coastal roads, and painterly interiors that still feel personal.",
    details: [
      "Use this collection when the goal is atmosphere first: location, light, outfit mood, and story-led portraits rather than a standard studio look.",
      "Aidreamcapes keeps the workflow private, so source photos, credits, previews, and final downloads stay tied to the customer account.",
      "The page is written for searchers who want dreamy portrait outcomes, not generic AI photo packages."
    ],
    useCases: ["Fantasy profile refreshes", "Dreamlike dating photos", "Creator campaign portraits", "Private cinematic keepsake albums"],
    workflow: ["Upload clear portraits with natural expressions.", "Choose a dreamscape direction.", "Generate a private escape album.", "Download favorites for profiles, stories, or keepsakes."],
    ctaLabel: "Create Dreamscape Portraits",
    ctaHref: "/tools/dreamscape-generator"
  },
  "coastal-escapes": {
    label: "Coastal Escapes",
    title: "AI Coastal Escape Photos - beach and island portraits with Aidreamcapes",
    description: "Generate AI coastal escape photos with Aidreamcapes: beach portraits, island light, resort-style scenes, soft travel albums, and private gallery delivery.",
    keywords: "AI coastal photos, beach portrait generator, Aidreamcapes coastal escapes, island AI portraits",
    h2: "coastal escapes",
    h3: ["Beach portrait directions", "Island-light source guidance", "Private coastal album delivery"],
    intro: "Coastal Escapes are built for warm, relaxed portraits that feel like a seaside trip without needing a photographer, flight, or perfect weather.",
    details: [
      "Customers can choose beach, boardwalk, resort, sailboat, or cliffside mood while keeping their identity consistent.",
      "The best inputs are clear face photos and a few outfit references if the customer wants a specific vacation feel.",
      "Finished images work for profile refreshes, travel stories, private albums, and soft campaign visuals."
    ],
    useCases: ["Beach profile photos", "Vacation-style social posts", "Couple coastal albums", "Creator travel concepts"],
    workflow: ["Upload portraits with clean facial detail.", "Pick a coastal mood.", "Generate seaside variations.", "Save final images from the private gallery."],
    ctaLabel: "Create Coastal Photos",
    ctaHref: "/tools/coastal-portrait"
  },
  "fantasy-avatars": {
    label: "Fantasy Avatars",
    title: "AI Fantasy Avatar Maker - storybook profile art with Aidreamcapes",
    description: "Create AI fantasy avatars with Aidreamcapes for storybook profiles, character portraits, ethereal social images, and private avatar galleries.",
    keywords: "AI fantasy avatar maker, storybook avatar generator, Aidreamcapes avatars, fantasy profile art",
    h2: "fantasy avatars",
    h3: ["Storybook avatar styles", "Character-safe profile outputs", "Private avatar gallery workflow"],
    intro: "Fantasy Avatars give profile photos a softer fictional world: enchanted gardens, starry libraries, candlelit halls, and painterly travel scenes.",
    details: [
      "This category is designed for expressive avatar art rather than realistic business portraits.",
      "Customers can generate several mood directions while keeping output review inside a private account.",
      "Use favorites for social profiles, creator banners, community avatars, or personal keepsakes."
    ],
    useCases: ["Fantasy profile avatars", "Creator identity refreshes", "Community profile art", "Story-led social cards"],
    workflow: ["Upload clear face references.", "Choose a fantasy avatar mood.", "Generate private avatar options.", "Download the strongest profile-ready crops."],
    ctaLabel: "Make Fantasy Avatars",
    ctaHref: "/tools/fantasy-avatar"
  },
  "golden-hour-couples": {
    label: "Golden Hour Couples",
    title: "AI Golden Hour Couple Photos - romantic escape portraits",
    description: "Create romantic AI golden hour couple photos with Aidreamcapes: soft sunset scenes, travel-style portraits, announcement images, and private couple albums.",
    keywords: "AI couple photos, golden hour portrait generator, Aidreamcapes couple portraits, romantic AI photos",
    h2: "golden hour couples",
    h3: ["Romantic sunset portraits", "Couple source-photo planning", "Private couple album delivery"],
    intro: "Golden Hour Couples focuses on warm, romantic scenes for partners who want dreamy portraits without coordinating a full location shoot.",
    details: [
      "Use this collection for engagement-style imagery, anniversary concepts, vacation couple portraits, and gift-ready albums.",
      "Individual portraits can work, but couple references help preserve composition, height relationship, and natural interaction.",
      "Outputs are delivered in a private gallery so customers can review, choose, and download at their own pace."
    ],
    useCases: ["Anniversary images", "Engagement concepts", "Romantic travel portraits", "Private gift albums"],
    workflow: ["Upload couple or individual source photos.", "Choose sunset, garden, coast, or city mood.", "Generate a private couple album.", "Download favorites for gifts or posts."],
    ctaLabel: "Create Couple Photos",
    ctaHref: "/tools/golden-hour-couple"
  },
  "storybook-headshots": {
    label: "Storybook Headshots",
    title: "AI Storybook Headshots - warm professional portraits",
    description: "Generate warm AI storybook headshots with Aidreamcapes for creators, founders, author bios, soft professional profiles, and private gallery delivery.",
    keywords: "storybook headshots, warm AI headshot maker, Aidreamcapes professional portraits, creator headshots",
    h2: "storybook headshots",
    h3: ["Warm profile portrait styles", "Creator and author bio use cases", "Private headshot delivery"],
    intro: "Storybook Headshots keep the trust of a professional portrait while adding gentle atmosphere, warm backgrounds, and a more memorable editorial feel.",
    details: [
      "This is best for creators, coaches, authors, consultants, and founders who want approachable profile photos.",
      "The category avoids stiff studio repetition by pairing clean facial detail with soft narrative backgrounds.",
      "Customers can use the results across bios, landing pages, newsletters, and personal brand materials."
    ],
    useCases: ["Author bio portraits", "Creator profiles", "Founder pages", "Warm LinkedIn alternatives"],
    workflow: ["Upload clear face-forward photos.", "Choose a warm professional setting.", "Generate several polished portraits.", "Download profile-ready crops."],
    ctaLabel: "Create Storybook Headshots",
    ctaHref: "/tools/storybook-headshot"
  },
  "editorial-getaways": {
    label: "Editorial Getaways",
    title: "AI Editorial Getaway Photos - magazine-style travel portraits",
    description: "Create AI editorial getaway photos with Aidreamcapes: magazine-style travel portraits, fashion-led locations, elegant crops, and private image galleries.",
    keywords: "AI editorial travel portraits, getaway photo generator, Aidreamcapes editorial photos, fashion travel AI",
    h2: "editorial getaways",
    h3: ["Magazine-style travel portraits", "Fashion and location direction", "Private editorial gallery workflow"],
    intro: "Editorial Getaways blend fashion-page composition with imagined travel locations, giving customers a polished visual story from simple source photos.",
    details: [
      "Use this collection for outfit-forward portraits, launch visuals, travel-inspired campaigns, and elevated social images.",
      "Customers can request soft luxury, art-hotel, garden, city, or coastal editorial mood.",
      "Final galleries are private and credit-tracked so each generation fits the site's paid workflow."
    ],
    useCases: ["Fashion creator visuals", "Editorial profile campaigns", "Travel-inspired launches", "Magazine-style personal albums"],
    workflow: ["Upload clear portraits and outfit references.", "Pick an editorial getaway mood.", "Generate a styled private album.", "Download campaign-ready images."],
    ctaLabel: "Create Editorial Photos",
    ctaHref: "/tools/editorial-getaway"
  },
  "soft-glam-studio": {
    label: "Soft Glam Studio",
    title: "AI Soft Glam Studio Photos - gentle beauty portraits",
    description: "Create AI soft glam portraits with Aidreamcapes: gentle beauty lighting, polished profile crops, makeup-friendly images, and private photo albums.",
    keywords: "AI soft glam photos, beauty portrait generator, Aidreamcapes soft glam, private glam portraits",
    h2: "soft glam studio",
    h3: ["Gentle beauty portrait styles", "Makeup and hair-friendly outputs", "Private soft glam delivery"],
    intro: "Soft Glam Studio creates refined beauty portraits with creamy light, clean composition, and enough realism for profiles, albums, and creator pages.",
    details: [
      "The category focuses on subtle polish rather than heavy transformation.",
      "Useful source photos show the face clearly and include a few expression or angle variations.",
      "Outputs can support profile updates, beauty moodboards, campaign previews, and private keepsake galleries."
    ],
    useCases: ["Beauty profile refreshes", "Makeup inspiration", "Soft creator portraits", "Private glam albums"],
    workflow: ["Upload face-forward portraits.", "Choose soft glam lighting.", "Generate polished private options.", "Download the most natural favorites."],
    ctaLabel: "Create Soft Glam Photos",
    ctaHref: "/tools/soft-glam"
  },
  "cinematic-travel": {
    label: "Cinematic Travel",
    title: "AI Cinematic Travel Photos - destination portraits with Aidreamcapes",
    description: "Generate cinematic AI travel photos with Aidreamcapes: destination portraits, dramatic roads, dreamy cities, scenic albums, and private delivery.",
    keywords: "AI cinematic travel photos, destination portrait generator, Aidreamcapes travel portraits, dream travel AI",
    h2: "cinematic travel",
    h3: ["Destination portrait planning", "Cinematic scene variations", "Private travel gallery delivery"],
    intro: "Cinematic Travel turns ordinary uploads into destination-led portraits with a sense of movement, story, and place.",
    details: [
      "Customers can explore old-city streets, desert roads, mountain overlooks, rainy cafes, and coastlines without booking a trip.",
      "The page explains how source photos, credits, and private delivery work for travel-inspired outputs.",
      "This category is useful for social profiles, dating apps, creator campaigns, and personal albums."
    ],
    useCases: ["Destination profile images", "Travel creator concepts", "Dream-trip visual stories", "Private scenic portrait albums"],
    workflow: ["Upload portraits with usable lighting.", "Choose a destination mood.", "Generate cinematic travel scenes.", "Download favorites from the private gallery."],
    ctaLabel: "Create Travel Photos",
    ctaHref: "/tools/cinematic-travel"
  },
  "product-reverie": {
    label: "Product Reverie",
    title: "AI Product Reverie Photos - dreamy lifestyle visuals",
    description: "Create dreamy AI lifestyle product visuals with Aidreamcapes for creator launches, moodboards, product stories, and soft campaign imagery.",
    keywords: "AI product lifestyle photos, dreamy product visuals, Aidreamcapes product reverie, product moodboard AI",
    h2: "product reverie",
    h3: ["Dreamy product lifestyle styles", "Creator launch visuals", "Private campaign gallery workflow"],
    intro: "Product Reverie helps creators place products into soft, story-led scenes rather than plain ecommerce layouts.",
    details: [
      "Use it for candles, beauty items, accessories, journals, small gifts, and creator merchandise concepts.",
      "Inputs should include clear product references plus notes about mood, color, and intended channel.",
      "The result is a private gallery of campaign directions, not a replacement for regulated product photography."
    ],
    useCases: ["Creator product launches", "Moodboard imagery", "Soft social ads", "Lifestyle concept galleries"],
    workflow: ["Upload product references.", "Choose a dreamlike scene direction.", "Generate private lifestyle concepts.", "Select favorites for planning or social use."],
    ctaLabel: "Create Product Reverie",
    ctaHref: "/tools/product-reverie"
  },
  "social-keepsakes": {
    label: "Social Keepsakes",
    title: "AI Social Keepsake Maker - dreamy cards and profile visuals",
    description: "Create AI social keepsakes with Aidreamcapes: dreamy cards, profile images, announcement visuals, memory posts, and private downloadable galleries.",
    keywords: "AI social cards, keepsake photo generator, Aidreamcapes social keepsakes, dreamy announcement visuals",
    h2: "social keepsakes",
    h3: ["Dreamy social card formats", "Announcement and memory visuals", "Private keepsake album delivery"],
    intro: "Social Keepsakes create gentle, share-ready visuals for moments that deserve more atmosphere than a plain upload.",
    details: [
      "Customers can make birthday cards, trip memories, soft announcements, profile banners, and personal story images.",
      "The collection keeps the tone warm and personal rather than template-heavy.",
      "Finished images are delivered privately so customers can choose what to share."
    ],
    useCases: ["Dreamy announcement cards", "Personal memory posts", "Profile banners", "Private gift visuals"],
    workflow: ["Upload the source portrait or reference.", "Choose a keepsake format.", "Generate private card options.", "Download the strongest social-ready image."],
    ctaLabel: "Create Social Keepsakes",
    ctaHref: "/tools/social-keepsake"
  }
};

const aidreamcapesToolDirectory: SeoDirectoryMap = {
  "dreamscape-generator": {
    label: "Dreamscape Generator",
    title: "AI Dreamscape Generator - create cinematic escape portraits",
    description: "Use Aidreamcapes to generate cinematic dreamscape portraits from private uploads, with destination moods, soft lighting, credits, and private gallery delivery.",
    keywords: "AI dreamscape generator, Aidreamcapes tool, cinematic portrait generator, dream portrait AI",
    h2: "dreamscape generator",
    h3: ["Dreamscape input guide", "Cinematic escape outputs", "Private generation workflow"],
    intro: "The Dreamscape Generator helps turn a clear portrait into an imagined place while keeping the customer workflow private and credit-based.",
    details: [
      "Start with portraits that show the subject clearly and avoid heavy filters.",
      "Choose an escape mood such as coastal dawn, old-city evening, moon garden, or soft editorial interior.",
      "Results stay in the customer workspace for review, download, and follow-up generations."
    ],
    useCases: ["Dreamy profile photos", "Creator launch portraits", "Private fantasy albums", "Soft campaign visuals"],
    workflow: ["Review the dreamscape mood.", "Upload source portraits.", "Choose the atmosphere.", "Generate and download private results."],
    ctaLabel: "Start Dreamscape Generator",
    ctaHref: "/app/create?tool_id=dreamscape-generator"
  },
  "coastal-portrait": {
    label: "Coastal Portrait",
    title: "AI Coastal Portrait Tool - beach escape photos",
    description: "Create AI coastal portraits with Aidreamcapes using private uploads, beach-inspired moods, resort lighting, and private gallery delivery.",
    keywords: "AI coastal portrait, beach photo AI, Aidreamcapes coastal tool, island portrait generator",
    h2: "coastal portrait tool",
    h3: ["Beach portrait inputs", "Coastal scene outputs", "Private gallery delivery"],
    intro: "Coastal Portrait creates warm beach, island, resort, and cliffside images without needing a destination shoot.",
    details: [
      "Clear facial references help the tool keep the subject recognizable.",
      "Customers can guide the mood toward sunny, misty, romantic, editorial, or relaxed.",
      "Final images are delivered privately with credit history attached."
    ],
    useCases: ["Vacation-style profiles", "Travel social posts", "Couple beach concepts", "Creator destination visuals"],
    workflow: ["Upload portraits.", "Select a coastal mood.", "Generate beach-inspired results.", "Download favorites."],
    ctaLabel: "Create Coastal Portraits",
    ctaHref: "/app/create?tool_id=coastal-portrait"
  },
  "fantasy-avatar": {
    label: "Fantasy Avatar",
    title: "AI Fantasy Avatar Tool - storybook profile art",
    description: "Generate fantasy avatars with Aidreamcapes from private portraits, including storybook scenes, ethereal profile crops, and private downloadable galleries.",
    keywords: "AI fantasy avatar, storybook avatar tool, Aidreamcapes avatar generator, fantasy profile image",
    h2: "fantasy avatar tool",
    h3: ["Avatar source guidance", "Storybook output ideas", "Private avatar delivery"],
    intro: "Fantasy Avatar creates expressive profile art for customers who want a softer fictional identity without leaving the private workspace.",
    details: [
      "Use clean face references and describe the mood rather than overloading the request with props.",
      "Outputs can be square avatars, banner crops, or soft portrait cards.",
      "Customers choose what to download after reviewing the private gallery."
    ],
    useCases: ["Social avatars", "Creator identity art", "Community profile images", "Personal fantasy keepsakes"],
    workflow: ["Upload face references.", "Choose the fantasy direction.", "Generate avatar options.", "Download profile-ready crops."],
    ctaLabel: "Make Fantasy Avatars",
    ctaHref: "/app/create?tool_id=fantasy-avatar"
  },
  "golden-hour-couple": {
    label: "Golden Hour Couple",
    title: "AI Golden Hour Couple Tool - romantic sunset portraits",
    description: "Create warm AI couple portraits with Aidreamcapes using private uploads, golden-hour lighting, travel-inspired scenes, and private gallery delivery.",
    keywords: "AI golden hour couple, romantic couple portrait AI, Aidreamcapes couple tool, sunset couple photo generator",
    h2: "golden hour couple tool",
    h3: ["Couple source-photo tips", "Romantic scene directions", "Private album delivery"],
    intro: "Golden Hour Couple creates romantic sunset, garden, city, and coastal scenes for partners who want polished keepsake portraits without a full location shoot.",
    details: [
      "Best inputs show both people clearly, ideally with a few angle and expression options.",
      "Customers can guide the mood toward seaside dusk, garden glow, city evening, or soft travel romance.",
      "Finished couple images stay in the private account for review, download, and future generations."
    ],
    useCases: ["Anniversary portraits", "Engagement-style concepts", "Gift-ready couple albums", "Soft romantic social posts"],
    workflow: ["Upload couple references.", "Choose a golden-hour scene.", "Generate private romantic options.", "Download the strongest keepsake portraits."],
    ctaLabel: "Create Golden Hour Couples",
    ctaHref: "/app/create?tool_id=golden-hour-couple"
  },
  "storybook-headshot": {
    label: "Storybook Headshot",
    title: "AI Storybook Headshot Tool - warm professional portraits",
    description: "Create warm professional headshots with Aidreamcapes for author bios, creator profiles, founder pages, and private profile galleries.",
    keywords: "AI storybook headshot, warm professional portrait, Aidreamcapes headshot tool, creator profile photo",
    h2: "storybook headshot tool",
    h3: ["Professional source-photo tips", "Warm portrait outputs", "Private headshot gallery"],
    intro: "Storybook Headshot balances professional clarity with a softer, more memorable setting.",
    details: [
      "Best inputs show the face clearly with natural expressions and varied angles.",
      "The tool is useful when a strict corporate headshot feels too plain.",
      "Final images can support bios, newsletters, profile pages, and creator sites."
    ],
    useCases: ["Author bios", "Founder portraits", "Creator profiles", "Warm professional pages"],
    workflow: ["Upload clear portraits.", "Select a warm professional mood.", "Generate headshot options.", "Download final crops."],
    ctaLabel: "Create Storybook Headshots",
    ctaHref: "/app/create?tool_id=storybook-headshot"
  },
  "editorial-getaway": {
    label: "Editorial Getaway",
    title: "AI Editorial Getaway Tool - magazine-style travel portraits",
    description: "Use Aidreamcapes to create editorial getaway portraits with private uploads, fashion-led locations, cinematic crops, and gallery delivery.",
    keywords: "AI editorial getaway, travel portrait tool, Aidreamcapes editorial generator, magazine style AI portrait",
    h2: "editorial getaway tool",
    h3: ["Editorial input planning", "Travel-fashion outputs", "Private campaign gallery"],
    intro: "Editorial Getaway turns source portraits and outfit references into polished travel-inspired campaign images.",
    details: [
      "Upload clear subject photos plus outfit or mood references when possible.",
      "Choose a location style such as art hotel, old city, garden terrace, coast, or cinematic road.",
      "Use results for profile refreshes, social campaigns, or visual planning."
    ],
    useCases: ["Editorial profile sets", "Creator launches", "Travel-inspired campaigns", "Fashion moodboards"],
    workflow: ["Upload portraits and references.", "Choose a getaway mood.", "Generate private editorial images.", "Download campaign-ready favorites."],
    ctaLabel: "Create Editorial Getaways",
    ctaHref: "/app/create?tool_id=editorial-getaway"
  },
  "soft-glam": {
    label: "Soft Glam",
    title: "AI Soft Glam Tool - cream-light beauty portraits",
    description: "Create soft glam AI portraits with Aidreamcapes using private source photos, gentle beauty lighting, polished crops, and private gallery delivery.",
    keywords: "AI soft glam tool, cream light portrait AI, Aidreamcapes beauty portrait, soft glam photo generator",
    h2: "soft glam tool",
    h3: ["Beauty portrait inputs", "Cream-light glam outputs", "Private profile-ready delivery"],
    intro: "Soft Glam creates refined beauty portraits with creamy light, gentle styling, and clean crops for profiles, creator pages, and private albums.",
    details: [
      "Use clear portraits with natural expressions and avoid heavy filters when possible.",
      "Customers can steer the result toward polished, romantic, editorial, or understated beauty moods.",
      "The private gallery makes it easy to compare crops before downloading profile-ready favorites."
    ],
    useCases: ["Profile refreshes", "Creator beauty portraits", "Soft campaign visuals", "Private glam albums"],
    workflow: ["Upload clear portraits.", "Choose a soft glam mood.", "Generate cream-light options.", "Download polished favorites."],
    ctaLabel: "Create Soft Glam Photos",
    ctaHref: "/app/create?tool_id=soft-glam"
  },
  "cinematic-travel": {
    label: "Cinematic Travel",
    title: "AI Cinematic Travel Tool - destination-style escape portraits",
    description: "Generate cinematic travel portraits with Aidreamcapes from private uploads, scenic destination moods, story-led composition, and private gallery delivery.",
    keywords: "AI cinematic travel tool, destination portrait AI, Aidreamcapes travel portraits, cinematic escape photo generator",
    h2: "cinematic travel tool",
    h3: ["Travel portrait input planning", "Destination scene outputs", "Private cinematic gallery"],
    intro: "Cinematic Travel turns everyday portraits into destination-led images with movement, atmosphere, and a sense of story.",
    details: [
      "Customers can choose old-city streets, coastal roads, scenic overlooks, quiet cafes, or garden escapes.",
      "Clear subject photos help preserve identity while the scene changes around the portrait.",
      "Results are delivered privately for travel moodboards, social visuals, and personal albums."
    ],
    useCases: ["Travel-style profile photos", "Creator destination visuals", "Dream trip moodboards", "Private scenic albums"],
    workflow: ["Upload source portraits.", "Pick a destination mood.", "Generate cinematic travel scenes.", "Download private favorites."],
    ctaLabel: "Create Cinematic Travel Photos",
    ctaHref: "/app/create?tool_id=cinematic-travel"
  },
  "product-reverie": {
    label: "Product Reverie",
    title: "AI Product Reverie Tool - dreamy lifestyle product concepts",
    description: "Create dreamy lifestyle product concepts with Aidreamcapes for creator launches, moodboards, social visuals, and private planning galleries.",
    keywords: "AI product reverie tool, dreamy product photos, Aidreamcapes product images, lifestyle product AI",
    h2: "product reverie tool",
    h3: ["Product reference inputs", "Dreamy lifestyle outputs", "Private planning gallery"],
    intro: "Product Reverie helps small products and creator merchandise appear in soft, story-led scenes for planning and social use.",
    details: [
      "Use clear product references and short notes about color, mood, and intended channel.",
      "The tool is for concepting, content planning, and soft campaign visuals.",
      "Customers review results privately before deciding what to publish."
    ],
    useCases: ["Creator product launches", "Moodboard concepts", "Soft social ads", "Lifestyle planning visuals"],
    workflow: ["Upload product references.", "Pick a dreamy scene.", "Generate private concepts.", "Download planning favorites."],
    ctaLabel: "Create Product Reverie",
    ctaHref: "/app/create?tool_id=product-reverie"
  },
  "social-keepsake": {
    label: "Social Keepsake",
    title: "AI Social Keepsake Tool - dreamy cards and profile visuals",
    description: "Create dreamy social keepsakes with Aidreamcapes for announcements, memory posts, profile banners, private gifts, and share-ready visual cards.",
    keywords: "AI social keepsake tool, dreamy card generator, Aidreamcapes keepsake maker, social memory image AI",
    h2: "social keepsake tool",
    h3: ["Keepsake source guidance", "Share-ready card formats", "Private social delivery"],
    intro: "Social Keepsake creates gentle, share-ready visuals for moments that need more atmosphere than a plain upload.",
    details: [
      "Customers can create birthday cards, trip memories, soft announcements, profile banners, and private gift visuals.",
      "The tool keeps the look personal and dreamlike rather than template-heavy.",
      "Finished keepsakes are delivered privately so customers decide what to share."
    ],
    useCases: ["Dreamy announcement cards", "Personal memory posts", "Profile banners", "Private gift visuals"],
    workflow: ["Upload a portrait or reference.", "Choose a keepsake format.", "Generate private card options.", "Download the best share-ready image."],
    ctaLabel: "Create Social Keepsakes",
    ctaHref: "/app/create?tool_id=social-keepsake"
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

export function isExplicitSeoDirectoryContentForSite(site: Site | undefined, kind: SeoDirectoryKind, rawSlug: string): boolean {
  const slug = normalizeDirectorySlug(rawSlug);
  if (isAidreamcapesSite(site)) {
    return kind === "collection" ? Boolean(aidreamcapesCollectionDirectory[slug]) : Boolean(aidreamcapesToolDirectory[slug]);
  }
  return isExplicitSeoDirectoryContent(kind, slug);
}

export function getExplicitSeoDirectorySlugsForSite(site: Site | undefined, kind: SeoDirectoryKind): string[] {
  if (isAidreamcapesSite(site)) {
    return Object.keys(kind === "collection" ? aidreamcapesCollectionDirectory : aidreamcapesToolDirectory);
  }
  return Object.keys(kind === "collection" ? collectionDirectory : toolDirectory);
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
  return slug.split("-").filter(Boolean).map((part) => {
    const lower = part.toLowerCase();
    if (lower === "ai") return "AI";
    if (lower === "3d") return "3D";
    if (lower === "vr") return "VR";
    if (lower === "ugc") return "UGC";
    return `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`;
  }).join(" ") || "Photo";
}

function cleanDirectoryLabel(slug: string): string {
  return titleCase(slug)
    .replace(/\bAi\b/g, "AI")
    .replace(/\bAI\s+AI\b/g, "AI")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^AI\s+/i, "");
}

function singularTopicLabel(label: string): string {
  return label
    .replace(/\bPhotos\b$/i, "Photo")
    .replace(/\bImages\b$/i, "Image")
    .replace(/\bHeadshots\b$/i, "Headshot")
    .replace(/\bPortraits\b$/i, "Portrait")
    .replace(/\bAvatars\b$/i, "Avatar")
    .replace(/\bVideos\b$/i, "Video")
    .replace(/\bGalleries\b$/i, "Gallery")
    .replace(/\s+/g, " ")
    .trim();
}

function lowerTopic(label: string): string {
  return label.toLowerCase().replace(/\bai\b/g, "AI");
}

function stripTrailingMediaNoun(label: string): string {
  return label
    .replace(/\b(Photos?|Images?|Galleries?)$/i, "")
    .replace(/\s+/g, " ")
    .trim() || label;
}

function pluralTopicLabel(label: string): string {
  if (/\bPhoto$/i.test(label)) return label.replace(/\bPhoto$/i, "Photos");
  if (/\bImage$/i.test(label)) return label.replace(/\bImage$/i, "Images");
  if (/\bHeadshot$/i.test(label)) return label.replace(/\bHeadshot$/i, "Headshots");
  if (/\bPortrait$/i.test(label)) return label.replace(/\bPortrait$/i, "Portraits");
  if (/\bAvatar$/i.test(label)) return label.replace(/\bAvatar$/i, "Avatars");
  if (/\bVideo$/i.test(label)) return label.replace(/\bVideo$/i, "Videos");
  if (/\bGallery$/i.test(label)) return label.replace(/\bGallery$/i, "Galleries");
  return `${label} Photos`;
}

function collectionTitleTopic(label: string): string {
  if (/\bVideo$/i.test(label)) return `${label} Packages`;
  if (/\b(Headshot|Portrait)$/i.test(label)) return `${label} Packages`;
  return `${stripTrailingMediaNoun(label)} Photo Packages`;
}

function isAidreamcapesBrand(brandName: string): boolean {
  return brandName.toLowerCase().includes("aidreamcapes");
}

function brandPossessive(brandName: string): string {
  return brandName.endsWith("s") ? `${brandName}'` : `${brandName}'s`;
}

function fallbackCollection(slug: string, brandName = "MydreamShoots"): SeoDirectorySeed {
  const label = singularTopicLabel(cleanDirectoryLabel(slug));
  const subject = stripTrailingMediaNoun(label);
  const lower = lowerTopic(subject);
  const pluralLabel = pluralTopicLabel(label);
  const packageTopic = collectionTitleTopic(label);
  if (isAidreamcapesBrand(brandName)) {
    return {
      label,
      title: `AI ${subject} Dreamscape Gallery | ${brandName}`,
      description: `Explore ${brandName} ${lower} galleries for private source-photo planning, coastal and fantasy-inspired scene directions, soft editorial crops, visible credits, and customer-only downloads.`,
      keywords: `AI ${subject} dreamscape, ${lower} portrait gallery, ${brandName} ${lower}, private editorial AI gallery`,
      h2: `${lower} dreamscape gallery`,
      h3: [`${subject} scene direction`, `Source-photo planning`, `Private gallery delivery`],
      intro: `This ${subject} gallery frames the style, mood, and source-photo guidance customers need before choosing an Aidreamcapes scene.`,
      details: [
        `Customers can compare ${lower} scene ideas, crop choices, and atmosphere before starting a private generation.`,
        "The page keeps coastal, fantasy, and editorial directions separate from general photo-package copy.",
        "Finished images stay in a private gallery so customers can review, download, and choose what to share."
      ],
      useCases: [`${subject} dreamscape portraits`, `${subject} soft-gallery images`, `${subject} editorial scenes`, `${subject} fantasy keepsakes`],
      workflow: ["Choose a scene direction.", "Upload clear source photos.", "Review private gallery options.", "Download the final images you want to keep."],
      ctaLabel: `Open ${subject} Gallery`,
      ctaHref: "/tools/image-studio"
    };
  }
  return {
    label,
    title: `AI ${packageTopic} | ${brandName}`,
    description: `Plan private ${subject} shoots with ${brandName}: upload source photos, choose a creator-ready package direction, review credit use, and download polished gallery images.`,
    keywords: `AI ${subject} photo package, ${lower} AI photos, ${brandName} ${lower}, private creator photo gallery`,
    h2: `${lower} photo packages`,
    h3: [`${subject} package direction`, `Source-photo checklist`, `Private album delivery`],
    intro: `This ${subject} collection helps customers choose the right photo-package direction before uploading source images and spending credits.`,
    details: [
      `Customers can see what a ${lower} package is best for, which source photos usually work well, and how the final album is delivered.`,
      "The page keeps package navigation stable while active offers and creator-ready formats can change behind the scenes.",
      "Use this section to compare styles, crops, delivery formats, and practical customer use cases without repeating the homepage."
    ],
    useCases: [`${subject} profile images`, `${subject} social posts`, `${subject} private albums`, `${subject} campaign visuals`],
    workflow: ["Upload clear source photos.", `Choose a ${lower} package direction.`, "Review a private album.", "Download final images for the intended channel."],
    ctaLabel: `Create ${pluralLabel}`,
    ctaHref: "/tools/image-studio"
  };
}

function fallbackTool(slug: string, brandName = "MydreamShoots"): SeoDirectorySeed {
  const label = singularTopicLabel(cleanDirectoryLabel(slug));
  const lower = lowerTopic(label);
  if (isAidreamcapesBrand(brandName)) {
    return {
      label,
      title: `AI ${label} Studio | ${brandName}`,
      description: `Use ${brandPossessive(brandName)} ${label} studio to shape private dreamscape images with source-photo guidance, coastal or fantasy mood options, soft editorial framing, and gallery delivery.`,
      keywords: `AI ${label} studio, ${lower} dreamscape tool, ${brandName} ${lower}, private fantasy portrait editor`,
      h2: `${lower} studio`,
      h3: [`${label} source guide`, `${label} scene options`, `Private gallery review`],
      intro: `Use ${label} to turn source photos into private dreamscape images with a softer editorial feel and clear delivery expectations.`,
      details: [
        "Start with source photos or references that clearly show the subject, mood, and scene direction you want.",
        "Aidreamcapes keeps the result private so customers can review images before downloading or sharing.",
        "Use this page to compare scene fit, upload guidance, and the kind of gallery result the tool is meant to produce."
      ],
      useCases: [`${label} dream portraits`, `${label} coastal scenes`, `${label} fantasy editorials`, `${label} private keepsakes`],
      workflow: ["Review the scene direction.", "Upload clear source photos.", "Choose the mood or use case.", "Generate and download from your private gallery."],
      ctaLabel: `Start ${label}`,
      ctaHref: `/app/create?tool_id=${slug}`
    };
  }
  return {
    label,
    title: `AI ${label} Tool | ${brandName}`,
    description: `Use ${brandPossessive(brandName)} ${label} tool to turn everyday uploads into private creator visuals with clear input guidance, credit-aware generation, and gallery-ready downloads.`,
    keywords: `AI ${label} tool, ${label} generator, ${brandName} ${lower}, private creator photo editor`,
    h2: `${lower} tool`,
    h3: [`${label} input guide`, `${label} output ideas`, `Private ${label} delivery`],
    intro: `Upload clear source material and use ${label} for a private result that fits your next headshot, fan-photo, creator, or photo-package goal.`,
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

function normalizeRouteMetadataPath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "/") return "/";
  return `/${trimmed.replace(/^\/+/, "").replace(/\/+$/, "")}`;
}

function dreamshootFallbackMetadataCanonical(siteSlug: string, primaryDomain: string | undefined, canonicalPath: string): string {
  return publicSiteUrlFromParts({ slug: siteSlug, primaryDomain: primaryDomain ?? "" }, canonicalPath);
}

export function metadataForDreamshootFallbackRoute(
  siteSlug: string,
  path: string,
  options: { primaryDomain?: string; ogImage?: string; siteName?: string } = {}
): Metadata {
  const normalizedPath = normalizeRouteMetadataPath(path);
  const siteIdentity = `${siteSlug} ${options.primaryDomain ?? ""} ${options.siteName ?? ""}`.toLowerCase();
  const aidreamcapes = siteIdentity.includes("aidreamcapes");
  const publicMetadata = aidreamcapes ? aidreamcapesPublicSeoPageMetadata : dreamshootPublicSeoPageMetadata;
  const fallbackMetadata = aidreamcapes ? aidreamcapesFallbackRouteMetadata : dreamshootFallbackRouteMetadata;
  const seed = publicMetadata[normalizedPath] ?? fallbackMetadata[normalizedPath] ?? dreamshootPublicSeoPageMetadata[normalizedPath] ?? dreamshootFallbackRouteMetadata[normalizedPath] ?? {
    title: "MydreamShoots",
    description: "MydreamShoots is a private AI photo workspace for uploads, credits, photo packages, AI tools, and customer-only galleries.",
    keywords: "MydreamShoots, AI photo workspace, AI photo packages, private photo gallery",
    canonicalPath: normalizedPath,
    index: false,
    follow: true
  };
  const canonical = dreamshootFallbackMetadataCanonical(siteSlug, options.primaryDomain, seed.canonicalPath);
  const keywords = seed.keywords.split(",").map((keyword) => keyword.trim()).filter(Boolean);
  const ogImage = options.ogImage?.trim();
  return {
    title: seed.title,
    description: seed.description,
    keywords,
    alternates: { canonical },
    robots: {
      index: seed.index,
      follow: seed.follow
    },
    openGraph: {
      title: seed.title,
      description: seed.description,
      url: canonical,
      siteName: options.siteName?.trim() || "MydreamShoots",
      ...(ogImage ? { images: [{ url: ogImage }] } : {})
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title: seed.title,
      description: seed.description,
      ...(ogImage ? { images: [ogImage] } : {})
    }
  };
}

export function getSeoDirectoryContent(kind: SeoDirectoryKind, rawSlug: string): SeoDirectoryContent {
  return getSeoDirectoryContentForSite(undefined, kind, rawSlug);
}

export function getSeoDirectoryContentForSite(site: Site | undefined, kind: SeoDirectoryKind, rawSlug: string): SeoDirectoryContent {
  const slug = normalizeDirectorySlug(rawSlug);
  const aidreamcapes = isAidreamcapesSite(site);
  const collectionSource = aidreamcapes ? aidreamcapesCollectionDirectory : collectionDirectory;
  const toolSource = aidreamcapes ? aidreamcapesToolDirectory : toolDirectory;
  const brandName = aidreamcapes ? "Aidreamcapes" : "MydreamShoots";
  const explicit = kind === "collection" ? Boolean(collectionSource[slug]) : Boolean(toolSource[slug]);
  const source = kind === "collection" ? collectionSource[slug] ?? fallbackCollection(slug, brandName) : toolSource[slug] ?? fallbackTool(slug, brandName);
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
  const item = getSeoDirectoryContentForSite(site, kind, rawSlug);
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

export function withSeoDirectorySection(pageJson: ThemePageJson, kind: SeoDirectoryKind, rawSlug: string, options: { focused?: boolean; site?: Site } = {}): ThemePageJson {
  const item = getSeoDirectoryContentForSite(options.site, kind, rawSlug);
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
