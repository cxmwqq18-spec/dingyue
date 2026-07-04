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

function seoDirectoryIcons(site: Site): Metadata["icons"] {
  if (isAidreamcapesSite(site)) {
    return {
      icon: [
        { url: "/assets/sites/site_aidreamcapes/brand/aidreamcapes-icon-192.png?v=20260702", type: "image/png", sizes: "192x192" },
        { url: "/assets/sites/site_aidreamcapes/brand/aidreamcapesai-logo-refined.svg?v=20260702", type: "image/svg+xml" }
      ],
      shortcut: "/assets/sites/site_aidreamcapes/brand/aidreamcapes-icon-192.png?v=20260702",
      apple: [{ url: "/assets/sites/site_aidreamcapes/brand/aidreamcapes-icon-180.png?v=20260702", sizes: "180x180", type: "image/png" }]
    };
  }
  return {
    icon: [
      { url: "/assets/dreamshoot/brand/dreamshootai-icon-192.png?v=20260702", type: "image/png", sizes: "192x192" },
      { url: "/assets/dreamshoot/brand/dreamshootai-logo-refined.svg?v=20260702", type: "image/svg+xml" }
    ],
    shortcut: "/assets/dreamshoot/brand/dreamshootai-icon-192.png?v=20260702",
    apple: [{ url: "/assets/dreamshoot/brand/dreamshootai-icon-180.png?v=20260702", sizes: "180x180", type: "image/png" }]
  };
}

const dreamshootFallbackRouteMetadata: Record<string, DreamshootRouteMetadataSeed> = {
  "/login": {
    title: "Sign in to MyDreamShoots - private AI photo workspace",
    description:
      "Sign in to MyDreamShoots to manage private uploads, AI photo package requests, credits, checkout history, generated albums, and customer-only gallery downloads.",
    keywords: "MyDreamShoots login, AI photo account, private AI photo workspace, customer gallery sign in",
    canonicalPath: "/login",
    index: false,
    follow: true
  },
  "/pricing": {
    title: "MyDreamShoots Pricing - AI photo credits, plans, and top-ups",
    description:
      "Compare MyDreamShoots plans, monthly AI photo credits, one-time top-ups, private model access, package generation, secure checkout, and gallery delivery before you create.",
    keywords: "MyDreamShoots pricing, AI photo credits, AI portrait subscription, private photo package plans",
    canonicalPath: "/pricing",
    index: true,
    follow: true
  },
  "/tools": {
    title: "MyDreamShoots AI Photo Tools",
    description:
      "Explore MyDreamShoots tools for headshots, background edits, video clips, try-on previews, private uploads, credits, and album-ready results.",
    keywords: "MyDreamShoots tools, AI photo tools, AI headshot tool, background changer, image to video AI, virtual try-on",
    canonicalPath: "/tools",
    index: true,
    follow: true
  }
};

export const dreamshootPublicSeoPageMetadata: Record<string, DreamshootRouteMetadataSeed> = {
  "/creators-circle": {
    title: "MyDreamShoots Creators Circle - affiliate and creator AI photo program",
    description:
      "Join the MyDreamShoots Creators Circle for AI photo package campaigns, creator-ready assets, private galleries, credit-based workflows, and partner collaboration opportunities.",
    keywords: "MyDreamShoots creators circle, AI photo creator program, creator AI photo campaign, AI portrait affiliate program",
    canonicalPath: "/creators-circle",
    index: true,
    follow: true
  },
  "/partner-registration": {
    title: "MyDreamShoots Partner Registration - apply for creator collaborations",
    description:
      "Apply to partner with MyDreamShoots and share your audience, publishing channels, creator campaign fit, and AI photo package collaboration goals.",
    keywords: "MyDreamShoots partner registration, AI photo partner application, creator collaboration application, AI portrait campaign partner",
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

export const aidreamcapesPublicSeoPageMetadata: Record<string, DreamshootRouteMetadataSeed> = {
  "/about-us": {
    title: "About Aidreamcapes",
    description:
      "Learn about Aidreamcapes, a private AI travel portrait workspace for source photo planning, visible credits, destination scenes, and customer-only gallery delivery.",
    keywords: "About Aidreamcapes, AI travel portraits, private AI destination gallery, cinematic travel photos, portrait workspace",
    canonicalPath: "/about-us",
    index: true,
    follow: true
  },
  "/contact-us": {
    title: "Contact Aidreamcapes",
    description:
      "Contact Aidreamcapes for travel portrait support, source photo guidance, sales questions, billing review, privacy requests, or company address information.",
    keywords: "Contact Aidreamcapes, Aidreamcapes support, AI travel portrait support, Aidreamcapes sales, private gallery help",
    canonicalPath: "/contact-us",
    index: true,
    follow: true
  },
  "/creators-circle": {
    title: "Aidreamcapes Creators Circle - creator travel portrait program",
    description:
      "Join the Aidreamcapes Creators Circle for AI travel portrait campaigns, private galleries, visible credits, and creator collaboration opportunities.",
    keywords: "Aidreamcapes creators circle, AI travel creator program, creator portrait campaign, AI portrait affiliate program",
    canonicalPath: "/creators-circle",
    index: true,
    follow: true
  },
  "/partner-registration": {
    title: "Aidreamcapes Partner Registration - apply for creator collaborations",
    description:
      "Apply to partner with Aidreamcapes and share your audience, publishing channels, campaign fit, and travel portrait collaboration goals.",
    keywords: "Aidreamcapes partner registration, AI travel portrait partner application, creator collaboration application, AI portrait campaign partner",
    canonicalPath: "/partner-registration",
    index: true,
    follow: true
  }
};

export const dreamshootPublicSeoPagePaths = Object.keys(dreamshootPublicSeoPageMetadata);

export function getDreamshootPublicSeoPageMetadataForSite(
  site: (Pick<Site, "id" | "slug" | "name" | "primaryDomain"> & { branding?: Pick<Site["branding"], "logoText"> }) | undefined,
  path: string
): DreamshootRouteMetadataSeed | undefined {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return isAidreamcapesSite(site) ? aidreamcapesPublicSeoPageMetadata[normalizedPath] : dreamshootPublicSeoPageMetadata[normalizedPath];
}

const aidreamcapesFallbackRouteMetadata: Record<string, DreamshootRouteMetadataSeed> = {
  "/tools": {
    title: "Aidreamcapes Studio Tools",
    description:
      "Explore Aidreamcapes tools for destination portraits, coastal getaways, island resort scenes, old city walks, mountain trails, and private gallery delivery.",
    keywords: "Aidreamcapes tools, AI travel portrait tools, destination portrait tool, cinematic travel portrait generator",
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
    description: "Create polished AI beauty photos with MyDreamShoots: beauty portraits, skincare-ready profile images, soft glam looks, editorial crops, private albums, and optional video-ready outputs from everyday uploads.",
    keywords: "AI Beauty Photo Maker, AI beauty photos, beauty portrait generator, glam AI photos, MyDreamShoots beauty",
    h2: "beauty",
    h3: ["AI beauty portrait styles", "Private beauty photo workflow", "Beauty photos and video-ready outputs"],
    intro: "The Beauty collection is built for customers who want refined portraits without copying a studio template. MyDreamShoots turns ordinary selfies into soft glam, skincare-clean, editorial, and profile-ready images while keeping source uploads, credits, and final albums inside one private account.",
    details: [
      "Start with clear face-forward source photos for clean lighting, graceful crops, natural retouching, hairstyle previews, profile portraits, and beauty campaign images.",
      "Each package can support several visual directions, including minimal studio light, glossy editorial beauty, warm lifestyle portraits, and social-ready square crops.",
      "Beauty packages include source-photo guidance, visible credit expectations, and delivery formats for private album review."
    ],
    useCases: ["Profile refreshes for creators and founders", "Beauty portfolio concepts before a studio session", "Soft glam portraits for social posts", "Skincare, hairstyle, and makeup visual planning"],
    workflow: ["Upload clear selfies with natural expressions.", "Choose beauty, hairstyle, or editorial direction.", "Generate a private album with polished portrait options.", "Use favorites for profiles, campaigns, or video-ready motion ideas."],
    ctaLabel: "Create AI Beauty Photos",
    ctaHref: "/tools/virtual-try-on"
  },
  valentine: {
    label: "Valentine",
    title: "AI Valentine Photo Maker - romantic couple photos from private uploads",
    description: "Create Valentine AI photos for couples, proposals, gifts, and romantic albums with MyDreamShoots. Build private couple portraits, greeting-card looks, and seasonal images from everyday uploads.",
    keywords: "AI Valentine Photo Maker, AI couple photos, Valentine photo generator, romantic AI portraits, MyDreamShoots Valentine",
    h2: "valentine",
    h3: ["AI Valentine couple portraits", "Romantic gift-ready albums", "Private seasonal photo delivery"],
    intro: "The Valentine collection focuses on romantic images customers can use as gifts, keepsakes, profile updates, and seasonal posts. The experience starts with source portraits, relationship mood, credit review, and private album delivery.",
    details: [
      "Use Valentine for warm couple portraits, proposal-style images, anniversary looks, greeting-card crops, and cinematic date-night scenes.",
      "Upload source portraits, select the relationship moment, then review a private set before downloading.",
      "Valentine packages connect romantic photo ideas with the matching tool or album workflow."
    ],
    useCases: ["Couple profile photos", "Valentine cards and private gifts", "Engagement announcement concepts", "Romantic social story images"],
    workflow: ["Upload individual or couple source photos.", "Pick romantic, cinematic, card, or casual date-night styling.", "Generate a private album with multiple crops.", "Download images for gifts, posts, or keepsakes."],
    ctaLabel: "Make Valentine Photos",
    ctaHref: "/tools/wedding-portraits"
  },
  headshots: {
    label: "Headshots",
    title: "AI Headshot Generator for LinkedIn, Resumes & Team Photos | MyDreamShoots",
    description: "Generate AI headshots for LinkedIn, resumes, founder bios, speaker pages, and team profiles with private MyDreamShoots uploads and credit costs shown before generation.",
    keywords: "AI Headshot Maker, professional AI headshots, LinkedIn photo generator, business portrait AI, MyDreamShoots headshots",
    h2: "headshots",
    h3: ["Professional AI headshots", "Business profile photo structure", "Private delivery for teams and founders"],
    intro: "The Headshots collection is for customers who need sharp, trustworthy portraits without booking a studio. It explains business-photo outcomes, source-photo quality, and how credits convert into private album options.",
    details: [
      "Headshot packages focus on clear business uses: LinkedIn, resumes, founder bios, speaker pages, and team directories.",
      "MyDreamShoots keeps the workflow simple: upload varied selfies, select a professional look, generate, then choose the best portrait from a private gallery.",
      "Individuals and teams can choose the finished business-photo outcome before spending credits.",
      "Not for passports, official IDs, legal documents, impersonation, or creating headshots of someone who did not give permission."
    ],
    useCases: ["LinkedIn profile refresh", "Founder and operator bios", "Resume and job-search portraits", "Team page headshots"],
    workflow: ["Upload clear face photos with varied angles.", "Choose business, founder, or clean studio styling.", "Generate multiple realistic portrait options.", "Download final headshots for professional channels."],
    ctaLabel: "Create Headshots",
    ctaHref: "/tools/headshot"
  },
  sports: {
    label: "Sports",
    title: "AI World Cup Fan Photos & Match-Day Posters | MyDreamShoots",
    description: "Create personal AI World Cup fan photos, match-day posters, and profile avatars from your own selfies with MyDreamShoots private uploads.",
    keywords: "AI Sports Fan Photo Maker, World Cup fan photos, stadium portrait generator, fan poster AI, sports avatar maker",
    h2: "sports",
    h3: ["Sports fan photo categories", "Match-day avatar and poster outputs", "Private sports album workflow"],
    intro: "The Sports collection turns fan moments into stadium-style images, posters, avatars, and banners for personal use. It is built for match days and seasonal fan moments without relying on official logos or protected marks.",
    details: [
      "Sports pages need concrete outputs: fan posters, stadium portraits, square avatars, wide banners, friend-group scenes, and social story crops.",
      "The MyDreamShoots workflow keeps the result personal: customers upload their own images, choose fan energy, then receive a private album.",
      "Sports packages pair match-day outcomes with the matching tool so customers can move from source photos to a private album.",
      "For personal fan creativity only. Do not request official team logos, tournament marks, player likenesses, celebrity faces, or brand assets unless you have permission."
    ],
    useCases: ["World Cup and football fan photos", "Match-day profile images", "Tournament posters", "Sports creator social content"],
    workflow: ["Upload one or more fan portraits.", "Choose stadium, poster, avatar, or friend-scene styling.", "Generate private match-day images.", "Download social-ready crops and banners."],
    ctaLabel: "Create Fan Photos",
    ctaHref: "/tools/world-cup-fan-photos"
  },
  creative: {
    label: "Creative",
    title: "AI Creative Photo Maker - cinematic portraits and themed scenes",
    description: "Build cinematic AI photos with MyDreamShoots: cyberpunk portraits, noir characters, gala scenes, creator images, and dramatic private albums from everyday uploads.",
    keywords: "AI Creative Photo Maker, cinematic AI portraits, cyberpunk portrait generator, themed AI photos, MyDreamShoots creative",
    h2: "creative",
    h3: ["Cinematic AI photo themes", "Creator-ready image directions", "From selfie to private themed album"],
    intro: "The Creative collection is the place for customers who want a strong visual world. It groups cyberpunk, noir, gala, creator, fantasy, and editorial scenes into an outcome-driven product structure.",
    details: [
      "Creative packages explain the finished mood, setting, crop, persona, and private album delivery.",
      "Customers can use it for profile campaigns, content launches, character portraits, and high-impact social visuals.",
      "Each category connects to a matching creation flow with source-photo guidance and visible credit use."
    ],
    useCases: ["Cyberpunk and neon portraits", "Noir and character concepts", "Creator campaign visuals", "Editorial social images"],
    workflow: ["Upload strong source portraits.", "Select a cinematic or creator direction.", "Generate a private themed album.", "Choose final images for profile, campaign, or gallery use."],
    ctaLabel: "Create Cinematic Photos",
    ctaHref: "/tools/cyberpunk-portrait"
  },
  hairstyle: {
    label: "Hairstyle",
    title: "AI Hairstyle Photo Maker - preview polished hair and beauty looks",
    description: "Preview AI hairstyle photos with MyDreamShoots: color direction, length ideas, salon-ready portraits, beauty crops, and private package delivery from everyday uploads.",
    keywords: "AI Hairstyle Photo Maker, hairstyle preview AI, hair color photo generator, beauty hair portraits, MyDreamShoots hairstyle",
    h2: "hairstyle",
    h3: ["Hairstyle preview structure", "Color and cut planning", "Private beauty album delivery"],
    intro: "Preview haircut, color, and styling ideas before you commit to a real salon change or a full image package.",
    details: [
      "Use hairstyle previews for salon inspiration, creator refreshes, soft glam portraits, and planning before a paid package.",
      "The best inputs are clear face photos with visible hair shape, varied angles, and simple lighting.",
      "Outputs emphasize hairstyle differences while keeping identity, face shape, and private album delivery consistent."
    ],
    useCases: ["Hair color previews", "Salon consultation ideas", "Creator beauty refreshes", "Profile portraits with new styling"],
    workflow: ["Upload clear portraits with visible hair.", "Choose the hairstyle direction.", "Generate a private preview album.", "Save favorites before ordering a full package."],
    ctaLabel: "Create Hairstyle Photos",
    ctaHref: "/tools/virtual-try-on"
  },
  mafia: {
    label: "Mafia",
    title: "AI Mafia Photo Maker - cinematic noir character portraits",
    description: "Create AI mafia photos with MyDreamShoots: noir portraits, tailored character scenes, moody lighting, vintage interiors, and private cinematic albums from customer uploads.",
    keywords: "AI Mafia Photo Maker, noir portrait generator, cinematic character photos, mafia AI portraits, MyDreamShoots mafia",
    h2: "mafia",
    h3: ["Noir character structure", "Cinematic scene planning", "Private themed album delivery"],
    intro: "The Mafia package is a character-driven photo direction for customers who want polished noir styling, tailored wardrobe cues, dramatic interiors, and cinematic social images.",
    details: [
      "Mafia packages stay focused on noir outcomes, dramatic lighting, tailored styling, and private character albums.",
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
    description: "Create AI black party photos with MyDreamShoots: refined event portraits, evening wardrobe concepts, cinematic interiors, social-ready crops, and private album delivery.",
    keywords: "AI Black Party Photo Maker, event portrait AI, nightlife photo generator, black party portraits, MyDreamShoots event photos",
    h2: "black party",
    h3: ["Event portrait structure", "Evening wardrobe and lighting", "Private nightlife album delivery"],
    intro: "The Black Party package gives evening-event imagery its own workflow. Customers can preview refined wardrobe, moody light, polished poses, and private album outputs without seeing unrelated categories.",
    details: [
      "Black Party packages support formal nightlife portraits, private event concepts, creator party campaigns, and elegant social images.",
      "Recommended inputs include clear portraits, one full-body reference if available, and notes about wardrobe or mood.",
      "Customers can review lighting, styling, image count, credit use, and delivery expectations for this theme."
    ],
    useCases: ["Formal event portraits", "Nightlife profile images", "Creator party campaigns", "Private album concepts"],
    workflow: ["Upload clear portraits and wardrobe references.", "Choose the black party direction.", "Generate polished evening images.", "Download favorites for social or private use."],
    ctaLabel: "Create Black Party Photos",
    ctaHref: "/tools/noir-portrait"
  },
  cyberpunk: {
    label: "Cyberpunk",
    title: "AI Cyberpunk Photo Maker - neon city portraits from selfies",
    description: "Turn your selfie into a neon city portrait with night lights, futuristic styling, high-contrast poster crops, and private album delivery.",
    keywords: "AI Cyberpunk Photo Maker, cyberpunk portrait generator, neon AI photos, futuristic portrait AI, MyDreamShoots cyberpunk",
    h2: "cyberpunk",
    h3: ["Neon portrait structure", "Futuristic scene direction", "Private cyberpunk album delivery"],
    intro: "Turn your selfie into a neon city portrait with night lights, futuristic styling, and high-contrast poster crops.",
    details: [
      "Cyberpunk packages highlight neon lighting, wardrobe mood, portrait crops, and private album outputs.",
      "The strongest inputs are expressive face photos with enough detail for identity preservation.",
      "Finished images work for profile campaigns, music-style visuals, gaming avatars, and creator launches."
    ],
    useCases: ["Neon profile portraits", "Gaming and creator avatars", "Music campaign images", "Futuristic social posts"],
    workflow: ["Upload clean source portraits.", "Choose neon city styling.", "Generate a private cyberpunk album.", "Download favorites for profile or campaign use."],
    ctaLabel: "Create Cyberpunk Photos",
    ctaHref: "/tools/cyberpunk-portrait"
  },
  boudoir: {
    label: "Boudoir",
    title: "Private AI Boudoir Photo Package | MyDreamShoots",
    description: "Create private boudoir-inspired AI portraits for adult, consensual use from photos you own or have permission to use, with non-explicit styling and private album delivery.",
    keywords: "AI boudoir photo package, private boudoir portraits, adult consensual portrait AI, MyDreamShoots boudoir",
    h2: "boudoir",
    h3: ["Consensual adult portrait guidance", "Private non-explicit styling", "Boudoir-inspired album delivery"],
    intro: "The Boudoir collection is for consenting adults who want tasteful, private, non-explicit portrait concepts from photos they own or have permission to use.",
    details: [
      "Use Boudoir only for adult subjects who gave permission for this style of portrait.",
      "Outputs focus on lighting, wardrobe mood, confidence, and private album presentation rather than explicit content.",
      "Do not upload minors, non-consenting people, stolen images, or requests meant to shame, impersonate, or expose someone."
    ],
    useCases: ["Private confidence portraits", "Tasteful studio moodboards", "Anniversary keepsake concepts", "Adult personal album previews"],
    workflow: ["Upload adult source photos with clear consent.", "Choose tasteful studio or soft editorial styling.", "Generate a private non-explicit album.", "Review and download only the images you want to keep."],
    ctaLabel: "Create Private Portraits",
    ctaHref: "/tools/fashion-editorial"
  },
  travel: {
    label: "Lifestyle",
    title: "AI Lifestyle Photo Sets - creator portraits from everyday selfies",
    description: "Create AI lifestyle photos, outdoor profile scenes, creator albums, and polished personal-brand images with MyDreamShoots private uploads.",
    keywords: "AI lifestyle photos, creator portrait generator, outdoor AI portraits, personal brand photo set, MyDreamShoots lifestyle",
    h2: "lifestyle",
    h3: ["Creator lifestyle portraits", "Outdoor profile scene structure", "Private lifestyle albums"],
    intro: "The Lifestyle collection helps customers create polished creator, profile, and outdoor scene photos from everyday source images. It focuses on personal-brand use, mood, lighting, and album-ready crops.",
    details: [
      "Lifestyle packages focus on creator intent: profile refreshes, outdoor looks, editorial lighting, and social-ready portrait crops.",
      "MyDreamShoots keeps the experience practical by asking for usable source photos first, then generating consistent personal-brand looks.",
      "This category supports creators, dating profiles, newsletter portraits, and campaign images."
    ],
    useCases: ["Lifestyle profile photos", "Outdoor creator portraits", "Personal-brand campaigns", "Social album images"],
    workflow: ["Upload portraits with clean lighting.", "Choose creator, editorial, outdoor, or social styling.", "Generate a private lifestyle album.", "Download final images for profile or campaign use."],
    ctaLabel: "Create Lifestyle Photos",
    ctaHref: "/tools/nature-adventure"
  }
};

const toolDirectory: Record<string, SeoDirectorySeed> = {
  headshot: {
    label: "Headshot",
    title: "AI Headshot Generator for LinkedIn, Resumes & Team Photos | MyDreamShoots",
    description: "Use the MyDreamShoots AI Headshot Maker to create realistic LinkedIn, resume, founder, and team portraits from private source photos with visible credits.",
    keywords: "AI Headshot Maker, professional headshot AI, LinkedIn headshot generator, MyDreamShoots headshot",
    h2: "headshot",
    h3: ["Professional headshot input guide", "Business portrait outputs", "Private profile photo delivery"],
    intro: "Upload clear selfies or casual portraits and turn them into polished headshots for LinkedIn, resumes, founder pages, team bios, and creator profiles.",
    details: ["Best inputs include face-forward photos with varied angles, simple lighting, and natural expressions.", "Finished results include clean studio portraits, founder-style images, resume-ready crops, and team profile options.", "Start with a professional portrait set, review the credits, and create a private album from your selected source photos.", "Do not use headshot results for passports, government IDs, legal documents, impersonation, or representing someone without permission."],
    useCases: ["LinkedIn and resume portraits", "Founder pages", "Consultant bios", "Team profile images"],
    workflow: ["Upload source portraits.", "Choose professional styling.", "Generate headshot options.", "Download final profile-ready images."],
    ctaLabel: "Create Profile Headshots",
    ctaHref: "/app/create?tool_id=headshot"
  },
  "background-changer": {
    label: "Background Changer",
    title: "AI Background Changer - replace photo backgrounds with MyDreamShoots",
    description: "Use the MyDreamShoots AI Background Changer to replace distracting photo backgrounds with cleaner studio, lifestyle, creator, or brand-ready scenes.",
    keywords: "AI Background Changer, replace photo background AI, background editor, MyDreamShoots background changer",
    h2: "background changer",
    h3: ["Background changer input guide", "Clean background outputs", "Next steps for edited images"],
    intro: "Upload a clear subject photo and replace the setting behind it with a cleaner background for portraits, product shots, listings, and social images.",
    details: ["Best inputs have a visible person, product, or object with enough contrast from the background.", "Finished results can move a subject from cluttered rooms into studio, lifestyle, creator, or brand-friendly scenes.", "Use the edited image as a final asset or as stronger source material before creating a full photo package.", "Do not use background edits for deceptive advertising, fake evidence, misleading before-and-after claims, or images you do not have permission to edit."],
    useCases: ["Cleaner profile photos", "Product and listing images", "Creator post drafts", "Source-photo repair before a package"],
    workflow: ["Upload a clear subject photo.", "Choose the new background direction.", "Generate the edited image.", "Save or continue with a larger photo set."],
    ctaLabel: "Change a Background",
    ctaHref: "/app/create?tool_id=background-changer"
  },
  "image-to-video": {
    label: "Image to Video",
    title: "AI Image to Video - create short clips from still images with MyDreamShoots",
    description: "Turn a still image into a short AI video clip with MyDreamShoots: add motion, camera movement, mood, and private video output for social or campaign use.",
    keywords: "AI Image to Video, image to video AI, short video clip generator, photo animation AI, MyDreamShoots video",
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
    description: "Create personal World Cup fan photos, stadium portraits, match-day posters, avatars, and social banners with MyDreamShoots private AI generation.",
    keywords: "AI World Cup Fan Photo Maker, World Cup fan photos, stadium portrait AI, match-day poster generator",
    h2: "world cup fan photos",
    h3: ["Stadium fan photo inputs", "Match-day poster outputs", "Private sports image delivery"],
    intro: "Upload fan portraits and create personal match-day images with stadium scenes, fan posters, avatars, banners, and friend-group concepts that feel personal without needing official marks.",
    details: ["Use it for personal fan posts, profile updates, and sports creator content that you have permission to publish.", "The tool can create square avatars, poster-like compositions, and wide social banners.", "Customers stay inside the MyDreamShoots private upload and album flow.", "Do not use official marks, event logos, club badges, player likenesses, celebrity likenesses, or brand assets unless you have permission."],
    useCases: ["Football fan avatars", "Tournament posters", "Match-day social posts", "Friend fan-photo concepts"],
    workflow: ["Upload fan portraits.", "Choose stadium, poster, or avatar direction.", "Generate private sports images.", "Download social-ready crops."],
    ctaLabel: "Create Fan Photos",
    ctaHref: "/app/create?tool_id=world-cup-fan-photos"
  },
  "virtual-try-on": {
    label: "Virtual Try-On",
    title: "AI Outfit Generator - virtual try-on photos with MyDreamShoots",
    description: "Create virtual try-on photos, outfit previews, hairstyle ideas, and fashion-ready portraits with MyDreamShoots private AI tools.",
    keywords: "AI Outfit Generator, virtual try-on AI, outfit photo maker, hairstyle preview AI, MyDreamShoots fashion",
    h2: "virtual try-on",
    h3: ["Outfit and hairstyle previews", "Fashion portrait structure", "Private try-on workflow"],
    intro: "The virtual try-on tool helps customers preview wardrobe, hairstyle, and fashion directions before committing to a larger photo package.",
    details: ["It is useful for outfit planning, creator looks, beauty profiles, and editorial social images.", "Source portraits become try-on concepts and private album options.", "Customers can review the look, credit use, and next album step before starting.", "Only upload photos of yourself or people who gave permission. Try-on outputs are style previews, not identity documents, medical advice, or a guarantee of real-world fit."],
    useCases: ["Outfit previews", "Hairstyle concepts", "Beauty profile refreshes", "Fashion editorial tests"],
    workflow: ["Upload clear source portraits.", "Choose outfit, hairstyle, or fashion direction.", "Generate try-on images.", "Save favorites for a full package."],
    ctaLabel: "Try Outfit Looks",
    ctaHref: "/app/create?tool_id=virtual-try-on"
  }
};

const aidreamcapesCollectionDirectory: SeoDirectoryMap = {
  "route-portrait-albums": {
    label: "Route Portrait Albums",
    title: "AI Route Portrait Albums - cinematic travel photos with Aidreamcapes",
    description: "Create cinematic AI route portraits with Aidreamcapes: coast roads, old city lanes, resort light, private source uploads, credit-based generation, and gallery-ready travel imagery.",
    keywords: "Aidreamcapes route portraits, AI travel portraits, cinematic escape photos, private travel portrait gallery",
    h2: "route portrait albums",
    h3: ["Cinematic travel portrait styles", "Private escape-photo workflow", "Gallery-ready destination scenes"],
    intro: "Route Portrait Albums turn everyday uploads into travel stories: warm coastal roads, old city evenings, resort mornings, mountain lookouts, and itinerary-ready scenes that still feel personal.",
    details: [
      "Use this collection when the goal is atmosphere first: location, light, outfit mood, and story-led portraits rather than a standard studio look.",
      "Aidreamcapes keeps the workflow private, so source photos, credits, previews, and final downloads stay tied to the customer account.",
      "Choose this collection when you want dreamy portrait outcomes with clear source-photo guidance, credit expectations, and private delivery."
    ],
    useCases: ["Travel profile refreshes", "Destination album previews", "Creator trip portraits", "Private cinematic keepsake albums"],
    workflow: ["Upload clear portraits with natural expressions.", "Choose a destination direction.", "Generate a private travel album.", "Download favorites for profiles, stories, or keepsakes."],
    ctaLabel: "Create Route Portraits",
    ctaHref: "/tools/route-portrait-engine"
  },
  "coastal-light-sets": {
    label: "Coastal Light Sets",
    title: "AI Coastal Escape Photos - beach and island portraits with Aidreamcapes",
    description: "Generate AI coastal escape photos with Aidreamcapes: beach portraits, island light, resort-style scenes, soft travel albums, and private gallery delivery.",
    keywords: "AI coastal photos, beach portrait generator, Aidreamcapes coastal light sets, island AI portraits",
    h2: "coastal light sets",
    h3: ["Beach portrait directions", "Island-light source guidance", "Private coastal album delivery"],
    intro: "Coastal Light Sets are built for warm, relaxed portraits that feel like a seaside trip without needing a photographer, flight, or perfect weather.",
    details: [
      "Customers can choose beach, boardwalk, resort, sailboat, or cliffside mood while keeping their identity consistent.",
      "The best inputs are clear face photos and a few outfit references if the customer wants a specific vacation feel.",
      "Finished images work for profile refreshes, travel stories, private albums, and soft campaign visuals."
    ],
    useCases: ["Beach profile photos", "Vacation-style social posts", "Shared coastal albums", "Creator travel concepts"],
    workflow: ["Upload portraits with clean facial detail.", "Pick a coastal mood.", "Generate seaside variations.", "Save final images from the private gallery."],
    ctaLabel: "Create Coastal Photos",
    ctaHref: "/tools/coastal-portrait"
  },
  "island-resort-scenes": {
    label: "Island Resort Scenes",
    title: "AI Island Resort Scenes - vacation portraits with Aidreamcapes",
    description: "Create AI island resort scenes with Aidreamcapes for poolside portraits, white terrace light, soft vacation stories, and private travel galleries.",
    keywords: "AI island resort portraits, vacation portrait generator, Aidreamcapes resort scenes, private travel gallery",
    h2: "island resort scenes",
    h3: ["Resort portrait styles", "Vacation-safe profile outputs", "Private resort gallery workflow"],
    intro: "Island Resort Scenes give everyday photos a warm vacation setting: white terraces, quiet pools, linen textures, balcony mornings, and soft travel light.",
    details: [
      "This category is designed for expressive avatar art rather than realistic business portraits.",
      "Customers can generate several mood directions while keeping output review inside a private account.",
      "Use favorites for social profiles, creator banners, community avatars, or personal keepsakes."
    ],
    useCases: ["Vacation profile portraits", "Creator trip refreshes", "Resort campaign scenes", "Story-led social cards"],
    workflow: ["Upload clear face references.", "Choose a resort mood.", "Generate private vacation options.", "Download the strongest profile-ready crops."],
    ctaLabel: "Create Resort Scenes",
    ctaHref: "/tools/island-resort-scenes"
  },
  "golden-hour-route-stories": {
    label: "Golden Hour Route Stories",
    title: "AI Golden Hour Route Photos - warm travel portraits",
    description: "Create AI golden hour route photos with Aidreamcapes: soft sunset paths, travel-style portraits, scenic overlook images, and private route albums.",
    keywords: "AI route photos, golden hour portrait generator, Aidreamcapes route portraits, sunset travel portraits",
    h2: "golden hour route stories",
    h3: ["Warm sunset portraits", "Route source-photo planning", "Private route album delivery"],
    intro: "Golden Hour Route Stories focuses on warm scenic light for travelers who want dreamy route portraits without coordinating a full location shoot.",
    details: [
      "Use this collection for overlook paths, sunset streets, quiet terraces, vacation route portraits, and gallery-ready albums.",
      "Individual portraits work best when paired with simple outfit notes and destination mood references.",
      "Outputs are delivered in a private gallery so customers can review, choose, and download at their own pace."
    ],
    useCases: ["Sunset route portraits", "Scenic overlook albums", "Travel profile refreshes", "Private route galleries"],
    workflow: ["Upload clear source photos.", "Choose sunset, garden, coast, or city mood.", "Generate a private route album.", "Download favorites for profiles or albums."],
    ctaLabel: "Create Route Photos",
    ctaHref: "/tools/golden-hour-route-story"
  },
  "celestial-profile-stories": {
    label: "Celestial Profile Stories",
    title: "AI Celestial Profile Stories - warm professional portraits",
    description: "Generate warm AI celestial profile stories with Aidreamcapes for creators, founders, author bios, soft professional profiles, and private gallery delivery.",
    keywords: "celestial profile stories, warm AI profile story maker, Aidreamcapes professional portraits, creator profile stories",
    h2: "celestial profile stories",
    h3: ["Warm profile portrait styles", "Creator and author bio use cases", "Private profile story delivery"],
    intro: "Celestial Profile Stories keep the trust of a professional portrait while adding gentle atmosphere, warm backgrounds, and a more memorable editorial feel.",
    details: [
      "This is best for creators, coaches, authors, consultants, and founders who want approachable profile photos.",
      "The category avoids stiff studio repetition by pairing clean facial detail with soft narrative backgrounds.",
      "Customers can use the results across bios, landing pages, newsletters, and personal brand materials."
    ],
    useCases: ["Author bio portraits", "Creator profiles", "Founder pages", "Warm LinkedIn alternatives"],
    workflow: ["Upload clear face-forward photos.", "Choose a warm professional setting.", "Generate several polished portraits.", "Download profile-ready crops."],
    ctaLabel: "Create Celestial Profile Stories",
    ctaHref: "/tools/celestial-profile-story"
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
  "cafe-corner-stories": {
    label: "Cafe Corner Stories",
    title: "AI Cafe Corner Stories Photos - city travel portraits",
    description: "Create AI cafe street portraits with Aidreamcapes: city-light scenes, polished profile crops, journal-ready images, and private travel albums.",
    keywords: "AI cafe street photos, city portrait generator, Aidreamcapes cafe street, private travel portraits",
    h2: "cafe street studio",
    h3: ["Cafe portrait styles", "Street-journal outputs", "Private cafe street delivery"],
    intro: "Cafe Corner Stories creates refined travel portraits with city light, clean composition, and enough realism for profiles, albums, and creator pages.",
    details: [
      "The category focuses on quiet city atmosphere rather than heavy transformation.",
      "Useful source photos show the face clearly and include a few expression or angle variations.",
      "Outputs can support profile updates, travel moodboards, campaign previews, and private keepsake galleries."
    ],
    useCases: ["City profile refreshes", "Cafe journal visuals", "Creator travel portraits", "Private street albums"],
    workflow: ["Upload face-forward portraits.", "Choose cafe street lighting.", "Generate polished private options.", "Download the most natural favorites."],
    ctaLabel: "Create Cafe Street Photos",
    ctaHref: "/tools/cafe-street-story"
  },
  "cinematic-travel": {
    label: "Cinematic Travel",
    title: "AI Cinematic Travel Photos - route portraits with Aidreamcapes",
    description: "Generate cinematic AI travel photos with Aidreamcapes: route portraits, dramatic roads, dreamy cities, scenic albums, and private delivery.",
    keywords: "AI cinematic travel photos, route portrait generator, Aidreamcapes travel portraits, dream travel AI",
    h2: "cinematic travel",
    h3: ["Route portrait planning", "Cinematic scene variations", "Private travel gallery delivery"],
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
  "route-moodboard": {
    label: "Route Moodboard",
    title: "AI Route Moodboard Photos - travel planning visuals",
    description: "Create AI route moodboards with Aidreamcapes for itinerary ideas, scenic stops, outfit planning, creator stories, and private travel galleries.",
    keywords: "AI route moodboard photos, travel planning visuals, Aidreamcapes route moodboard, itinerary moodboard AI",
    h2: "route moodboard",
    h3: ["Travel moodboard styles", "Creator route visuals", "Private planning gallery workflow"],
    intro: "Route Moodboard helps creators turn trip notes, outfits, and scenic stops into story-led travel planning visuals.",
    details: [
      "Use it for city breaks, coastal routes, mountain days, journal covers, and creator itinerary concepts.",
      "Inputs can include route notes plus guidance about mood, color, outfits, and intended channel.",
      "The result is a private gallery of travel directions for planning, publishing, or personal reference."
    ],
    useCases: ["Creator route planning", "Itinerary moodboards", "Travel story concepts", "Private planning galleries"],
    workflow: ["Add route notes or references.", "Choose a travel scene direction.", "Generate private moodboard concepts.", "Select favorites for planning or social use."],
    ctaLabel: "Create Route Moodboard",
    ctaHref: "/tools/route-moodboard"
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

const aidreamcapesCollectionAliases: Record<string, string> = {
  adventure: "cinematic-travel",
  city: "cafe-corner-stories",
  coastal: "coastal-light-sets",
  destination: "route-portrait-albums",
  postcard: "social-keepsakes",
  "cafe-street-journals": "cafe-corner-stories",
  "destination-portrait-albums": "route-portrait-albums",
  "coastal-getaways": "coastal-light-sets",
  "old-city-walks": "cafe-corner-stories",
  "cafe-street-stories": "cafe-corner-stories",
  "scenic-overlooks": "golden-hour-route-stories",
  "mountain-trails": "cinematic-travel",
  "road-trip-frames": "cinematic-travel",
  "itinerary-moodboards": "route-moodboard",
  "postcard-social-sets": "social-keepsakes",
  "travel-profile-stories": "celestial-profile-stories",
  "lagoon-route-studys": "coastal-light-sets"
};

export function canonicalAidreamcapesDirectorySlug(kind: SeoDirectoryKind, slug: string): string {
  if (kind !== "collection") return slug;
  return aidreamcapesCollectionAliases[slug] ?? slug;
}

const dreamshootCollectionAliases: Record<string, string> = {
  "professional-headshots": "headshots"
};

const dreamshootToolAliases: Record<string, string> = {
  "headshot-generator": "headshot"
};

export function canonicalDreamshootDirectorySlug(kind: SeoDirectoryKind, slug: string): string {
  return kind === "collection" ? dreamshootCollectionAliases[slug] ?? slug : dreamshootToolAliases[slug] ?? slug;
}

export function canonicalSeoDirectorySlugForSite(site: Site | undefined, kind: SeoDirectoryKind, rawSlug: string): string {
  const slug = normalizeDirectorySlug(rawSlug);
  return isAidreamcapesSite(site) ? canonicalAidreamcapesDirectorySlug(kind, slug) : canonicalDreamshootDirectorySlug(kind, slug);
}

export function canonicalSeoDirectoryPathForSite(site: Site | undefined, kind: SeoDirectoryKind, rawSlug: string): string {
  const canonicalSlug = canonicalSeoDirectorySlugForSite(site, kind, rawSlug);
  return `/${kind === "collection" ? "collections" : "tools"}/${canonicalSlug}`;
}

export function canonicalAidreamcapesCollectionPath(rawSlug: string): string {
  const normalized = normalizeDirectorySlug(rawSlug);
  const canonicalSlug = canonicalAidreamcapesDirectorySlug("collection", normalized);
  return `/collections/${canonicalSlug}`;
}

const aidreamcapesToolDirectory: SeoDirectoryMap = {
  "route-portrait-engine": {
    label: "Route Portrait Engine",
    title: "AI Route Portrait Engine - create cinematic travel portraits",
    description: "Use Aidreamcapes to generate cinematic travel portraits from private uploads, with route moods, natural lighting, credits, and private gallery delivery.",
    keywords: "AI route portrait engine, Aidreamcapes travel tool, cinematic travel portrait generator, private route portrait AI",
    h2: "route portrait engine",
    h3: ["Route input guide", "Cinematic travel outputs", "Private generation workflow"],
    intro: "Route Portrait Engine helps turn a clear portrait into a travel scene while keeping the customer workflow private and credit-based.",
    details: [
      "Start with portraits that show the subject clearly and avoid heavy filters.",
      "Choose an escape mood such as coastal dawn, old-city evening, moon garden, or soft editorial interior.",
      "Results stay in the customer workspace for review, download, and follow-up generations."
    ],
    useCases: ["Travel profile photos", "Creator trip portraits", "Private destination albums", "Soft campaign visuals"],
    workflow: ["Review the destination mood.", "Upload source portraits.", "Choose the atmosphere.", "Generate and download private results."],
    ctaLabel: "Start Route Portrait Engine",
    ctaHref: "/app/create?tool_id=route-portrait-engine"
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
    useCases: ["Vacation-style profiles", "Travel social posts", "Shared beach concepts", "Creator destination visuals"],
    workflow: ["Upload portraits.", "Select a coastal mood.", "Generate beach-inspired results.", "Download favorites."],
    ctaLabel: "Create Coastal Portraits",
    ctaHref: "/app/create?tool_id=coastal-portrait"
  },
  "island-resort-scenes": {
    label: "Island Resort Scene Studio",
    title: "AI Island Resort Scene Studio - vacation portraits",
    description: "Generate island resort portraits with Aidreamcapes from private uploads, including terrace light, poolside scenes, and downloadable travel galleries.",
    keywords: "AI island resort portraits, Aidreamcapes resort tool, vacation portrait generator, private travel profile image",
    h2: "island resort scene studio",
    h3: ["Resort source guidance", "Vacation output ideas", "Private travel gallery delivery"],
    intro: "Island Resort Scene Studio creates polished vacation portraits for customers who want resort atmosphere without leaving the private workspace.",
    details: [
      "Use clean face references and describe the mood rather than overloading the request with props.",
      "Outputs can be square avatars, banner crops, or soft portrait cards.",
      "Customers choose what to download after reviewing the private gallery."
    ],
    useCases: ["Vacation profile images", "Creator trip visuals", "Resort social crops", "Personal travel keepsakes"],
    workflow: ["Upload face references.", "Choose the resort direction.", "Generate vacation options.", "Download profile-ready crops."],
    ctaLabel: "Create Resort Scenes",
    ctaHref: "/app/create?tool_id=island-resort-scenes"
  },
  "golden-hour-route-story": {
    label: "Golden Hour Route Story",
    title: "AI Golden Hour Route Story Tool - warm sunset travel portraits",
    description: "Create warm AI route portraits with Aidreamcapes using private uploads, golden-hour lighting, travel-inspired scenes, and private gallery delivery.",
    keywords: "AI golden hour route story, shared route portrait AI, Aidreamcapes route story tool, sunset travel portrait generator",
    h2: "golden hour route story tool",
    h3: ["Shared route source-photo tips", "Romantic scene directions", "Private album delivery"],
    intro: "Golden Hour Route Story creates sunset, garden, city, and coastal scenes for travelers who want polished route portraits without a full location shoot.",
    details: [
      "Best inputs show both people clearly, ideally with a few angle and expression options.",
      "Customers can guide the mood toward seaside dusk, garden glow, city evening, or soft travel romance.",
      "Finished shared route images stay in the private account for review, download, and future generations."
    ],
    useCases: ["Sunset travel portraits", "Scenic route concepts", "Private route albums", "Soft golden-hour profile posts"],
    workflow: ["Upload route references.", "Choose a golden-hour scene.", "Generate private warm-light options.", "Download the strongest travel portraits."],
    ctaLabel: "Create Golden Hour Route Stories",
    ctaHref: "/app/create?tool_id=golden-hour-route-story"
  },
  "celestial-profile-story": {
    label: "Celestial Profile Story",
    title: "AI Celestial Profile Story Tool - warm professional portraits",
    description: "Create warm profile stories with Aidreamcapes for author bios, creator profiles, founder pages, and private profile galleries.",
    keywords: "AI celestial profile story, warm professional portrait, Aidreamcapes profile story tool, creator profile photo",
    h2: "celestial profile story tool",
    h3: ["Professional source-photo tips", "Warm portrait outputs", "Private profile story gallery"],
    intro: "Celestial Profile Story balances professional clarity with a softer, more memorable setting.",
    details: [
      "Best inputs show the face clearly with natural expressions and varied angles.",
      "The tool is useful when a strict corporate profile feels too plain.",
      "Final images can support bios, newsletters, profile pages, and creator sites."
    ],
    useCases: ["Author bios", "Founder portraits", "Creator profiles", "Warm professional pages"],
    workflow: ["Upload clear portraits.", "Select a warm professional mood.", "Generate profile story options.", "Download final crops."],
    ctaLabel: "Create Celestial Profile Stories",
    ctaHref: "/app/create?tool_id=celestial-profile-story"
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
  "cafe-street-story": {
    label: "Cafe Street Story",
    title: "AI Cafe Street Story Tool - city travel portraits",
    description: "Create cafe and street travel portraits with Aidreamcapes using private source photos, city-light moods, polished crops, and private gallery delivery.",
    keywords: "AI cafe street story tool, city travel portrait AI, Aidreamcapes cafe portrait, private street photo generator",
    h2: "cafe street story tool",
    h3: ["City portrait inputs", "Cafe and street outputs", "Private profile-ready delivery"],
    intro: "Cafe Street Story creates refined city travel portraits with cafe corners, balcony light, street crossings, and clean crops for journals, creator pages, and private albums.",
    details: [
      "Use clear portraits with natural expressions and avoid heavy filters when possible.",
      "Customers can steer the result toward polished, romantic, editorial, or understated city moods.",
      "The private gallery makes it easy to compare crops before downloading profile-ready favorites."
    ],
    useCases: ["Profile refreshes", "Creator city portraits", "Street journal visuals", "Private cafe albums"],
    workflow: ["Upload clear portraits.", "Choose a cafe or street mood.", "Generate city-light options.", "Download polished favorites."],
    ctaLabel: "Create Cafe Street Stories",
    ctaHref: "/app/create?tool_id=cafe-street-story"
  },
  "cinematic-travel": {
    label: "Cinematic Travel",
    title: "AI Cinematic Travel Tool - destination-style escape portraits",
    description: "Generate cinematic travel portraits with Aidreamcapes from private uploads, scenic destination moods, story-led composition, and private gallery delivery.",
    keywords: "AI cinematic travel tool, route portrait AI, Aidreamcapes travel portraits, cinematic escape photo generator",
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
  "route-moodboard": {
    label: "Route Moodboard",
    title: "AI Route Moodboard Tool - travel planning visuals",
    description: "Create private route moodboards with Aidreamcapes for itinerary ideas, outfit notes, scenic stops, creator planning, and travel story galleries.",
    keywords: "AI route moodboard tool, travel planning visuals, Aidreamcapes itinerary moodboard, private trip moodboard AI",
    h2: "route moodboard tool",
    h3: ["Route reference inputs", "Itinerary mood outputs", "Private planning gallery"],
    intro: "Route Moodboard helps customers turn trip notes, outfit ideas, and scenic references into story-led visual plans.",
    details: [
      "Use short notes about destinations, colors, stops, outfits, and intended channel.",
      "The tool is for concepting, content planning, and private travel story direction.",
      "Customers review results privately before deciding what to publish."
    ],
    useCases: ["Trip visual planning", "Creator route stories", "Itinerary moodboards", "Private travel concepts"],
    workflow: ["Add route notes or references.", "Pick a travel mood.", "Generate private concepts.", "Download planning favorites."],
    ctaLabel: "Create Route Moodboards",
    ctaHref: "/app/create?tool_id=route-moodboard"
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
  const decoded = (() => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  })();
  return decoded
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
  const slug = canonicalSeoDirectorySlugForSite(site, kind, rawSlug);
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
  let value = imagePath.trim();
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) {
    try {
      const url = new URL(value);
      if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname)) return value;
      value = `${url.pathname}${url.search}`;
    } catch {
      return value;
    }
  }
  const domain = site.primaryDomain?.trim();
  if (!domain || domain.includes("localhost")) return value;
  const base = domain.startsWith("http://") || domain.startsWith("https://") ? domain.replace(/\/$/, "") : `https://${domain}`;
  return `${base}${value.startsWith("/") ? value : `/${value}`}`;
}

function absoluteRouteSeoImageUrl(options: { primaryDomain?: string; ogImage?: string }): string {
  let value = (options.ogImage ?? "").trim();
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) {
    try {
      const url = new URL(value);
      if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname)) return value;
      value = `${url.pathname}${url.search}`;
    } catch {
      return value;
    }
  }
  const domain = options.primaryDomain?.trim();
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
  return `${stripTrailingMediaNoun(label)} Travel Packages`;
}

function isAidreamcapesBrand(brandName: string): boolean {
  return brandName.toLowerCase().includes("aidreamcapes");
}

function brandPossessive(brandName: string): string {
  return brandName.endsWith("s") ? `${brandName}'` : `${brandName}'s`;
}

function fallbackCollection(slug: string, brandName = "MyDreamShoots"): SeoDirectorySeed {
  const label = singularTopicLabel(cleanDirectoryLabel(slug));
  const subject = stripTrailingMediaNoun(label);
  const lower = lowerTopic(subject);
  const pluralLabel = pluralTopicLabel(label);
  const packageTopic = collectionTitleTopic(label);
  if (isAidreamcapesBrand(brandName)) {
    return {
      label,
      title: `AI ${subject} Travel Gallery | ${brandName}`,
      description: `Explore ${brandName} ${lower} galleries for private source-photo planning, coastal and city scene directions, soft editorial crops, visible credits, and customer-only downloads.`,
      keywords: `AI ${subject} travel gallery, ${lower} portrait gallery, ${brandName} ${lower}, private editorial AI gallery`,
      h2: `${lower} travel gallery`,
      h3: [`${subject} scene direction`, `Source-photo planning`, `Private gallery delivery`],
      intro: `This ${subject} gallery frames the style, mood, and source-photo guidance customers need before choosing an Aidreamcapes scene.`,
      details: [
        `Customers can compare ${lower} scene ideas, crop choices, and atmosphere before starting a private generation.`,
        "Coastal, city, resort, trail, and editorial directions stay focused so customers can choose the right private gallery style.",
        "Finished images stay in a private gallery so customers can review, download, and choose what to share."
      ],
      useCases: [`${subject} travel portraits`, `${subject} soft-gallery images`, `${subject} editorial scenes`, `${subject} postcard keepsakes`],
      workflow: ["Choose a scene direction.", "Upload clear source photos.", "Review private gallery options.", "Download the final images you want to keep."],
      ctaLabel: `Open ${subject} Gallery`,
      ctaHref: "/tools/image-studio"
    };
  }
  return {
    label,
    title: `AI ${packageTopic} | ${brandName}`,
    description: `Plan private ${subject} shoots with ${brandName}: upload source photos, choose a creator-ready package direction, review credit use, and download polished gallery images.`,
    keywords: `AI ${subject} photo package, ${lower} portrait package, ${brandName} ${lower}, private creator photo gallery`,
    h2: `${lower} photo packages`,
    h3: [`${subject} package direction`, `Source-photo checklist`, `Private album delivery`],
    intro: `This ${subject} collection helps customers choose the right photo-package direction before uploading source images and spending credits.`,
    details: [
      `Customers can see what a ${lower} package is best for, which source photos usually work well, and how the final album is delivered.`,
      "Package navigation stays clear while active offers and creator-ready formats can change behind the scenes.",
      "Customers can compare styles, crops, delivery formats, and practical use cases before spending credits."
    ],
    useCases: [`${subject} profile images`, `${subject} social posts`, `${subject} private albums`, `${subject} campaign visuals`],
    workflow: ["Upload clear source photos.", `Choose a ${lower} package direction.`, "Review a private album.", "Download final images for the intended channel."],
    ctaLabel: `Create ${pluralLabel}`,
    ctaHref: "/tools/image-studio"
  };
}

function fallbackTool(slug: string, brandName = "MyDreamShoots"): SeoDirectorySeed {
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
        "Customers can compare scene fit, upload guidance, and the kind of private gallery result the tool is meant to produce."
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
      "Customers can compare the expected output, check the input guidance, and continue when the tool fits their goal."
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

function fallbackRouteSiteName(siteSlug: string, options: { primaryDomain?: string; siteName?: string }): string {
  const siteIdentity = `${siteSlug} ${options.primaryDomain ?? ""} ${options.siteName ?? ""}`.toLowerCase();
  if (siteIdentity.includes("aidreamcapes")) return "Aidreamcapes";
  if (siteIdentity.includes("mydreamshoots") || siteIdentity.includes("dreamshoot")) return "MyDreamShoots";
  return options.siteName?.trim() || "MyDreamShoots";
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
    title: "MyDreamShoots",
    description: "MyDreamShoots is a private AI photo workspace for uploads, credits, creator photo packages, AI tools, and customer-only galleries.",
    keywords: "MyDreamShoots, AI photo workspace, AI creator photo packages, private photo gallery",
    canonicalPath: normalizedPath,
    index: false,
    follow: true
  };
  const canonical = dreamshootFallbackMetadataCanonical(siteSlug, options.primaryDomain, seed.canonicalPath);
  const ogImage = absoluteRouteSeoImageUrl(options);
  const siteName = fallbackRouteSiteName(siteSlug, options);
  return {
    title: seed.title,
    description: seed.description,
    keywords: undefined,
    alternates: { canonical },
    robots: {
      index: seed.index,
      follow: seed.follow
    },
    openGraph: {
      title: seed.title,
      description: seed.description,
      url: canonical,
      siteName,
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
  const brandName = aidreamcapes ? "Aidreamcapes" : "MyDreamShoots";
  const canonicalSlug = canonicalSeoDirectorySlugForSite(site, kind, slug);
  const explicit = kind === "collection" ? Boolean(collectionSource[canonicalSlug]) : Boolean(toolSource[canonicalSlug]);
  const source = kind === "collection" ? collectionSource[canonicalSlug] ?? fallbackCollection(slug, brandName) : toolSource[canonicalSlug] ?? fallbackTool(slug, brandName);
  const canonicalPath = `/${kind === "collection" ? "collections" : "tools"}/${canonicalSlug}`;
  return {
    ...source,
    slug: canonicalSlug,
    explicit,
    canonicalPath,
    ctaHref: kind === "collection" ? `/app/create?tool_id=${canonicalSlug}` : source.ctaHref
  };
}

export function metadataForSeoDirectory(site: Site, kind: SeoDirectoryKind, rawSlug: string): Metadata {
  const item = getSeoDirectoryContentForSite(site, kind, rawSlug);
  const canonicalPath = kind === "tool" && !item.explicit ? "/tools" : item.canonicalPath;
  const base = site.primaryDomain && !site.primaryDomain.includes("localhost") ? `https://${site.primaryDomain}` : "";
  const canonical = base ? `${base}${canonicalPath}` : canonicalPath;
  const ogImage = absoluteSeoImageUrl(site, site.themeSettings.publishedJson.seo?.defaultOgImage);
  const siteName = fallbackRouteSiteName(site.slug, { primaryDomain: site.primaryDomain, siteName: site.branding.logoText || site.name });
  return {
    title: item.title,
    description: item.description,
    keywords: undefined,
    alternates: { canonical },
    robots: {
      index: item.explicit,
      follow: true
    },
	    openGraph: {
	      title: item.title,
	      description: item.description,
	      url: canonical,
	      siteName,
	      ...(ogImage ? { images: [ogImage] } : {})
	    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title: item.title,
      description: item.description,
      ...(ogImage ? { images: [ogImage] } : {})
    },
    icons: seoDirectoryIcons(site)
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
