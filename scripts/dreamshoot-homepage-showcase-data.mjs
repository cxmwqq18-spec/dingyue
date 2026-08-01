export const SHOWCASE_VERSION = "20260801visualfix1";

function showcaseSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function titleFromSlug(slug) {
  return showcaseSlug(slug)
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export const showcaseStores = [
  {
    key: "mydreamshoots",
    siteId: "site_dreamshoot",
    siteSlug: "mydreamshoots",
    imageSlugs: [
      "world-cup-fan-photos",
      "christmas-couple",
      "christmas-photos",
      "creator-portraits",
      "gala-photos",
      "holiday",
      "professional-headshots",
      "cyberpunk"
    ],
    imageThemes: [
      {
        slug: "world-cup-fan-photos",
        name: "World Cup Fan Photos",
        meta: "Sports",
        prompt: "a generic football fan portrait result in stadium light with scarf or jersey-inspired wardrobe, celebration energy, cinematic crowd depth, no real team marks, no real players, and no event logos"
      },
      {
        slug: "christmas-couple",
        name: "Christmas Couple",
        meta: "Christmas",
        prompt: "a cozy Christmas couple portrait result with warm lights, festive interior detail, greeting-card composition, natural expressions, and private keepsake polish"
      },
      {
        slug: "christmas-photos",
        name: "Christmas Photos",
        meta: "Christmas",
        prompt: "a festive Christmas group photo or card-ready portrait result with decorated interior, winter glow, cheerful seasonal styling, clear faces, and private album polish"
      },
      {
        slug: "creator-portraits",
        name: "Creator Portraits",
        meta: "VIP Looks",
        prompt: "a VIP-style creator portrait result for red-carpet style fan moments, media kits, thumbnails, and social profiles, with polished event light and personal-brand framing"
      },
      {
        slug: "gala-photos",
        name: "Gala Photos",
        meta: "Red Carpet",
        prompt: "a formal gala portrait result with black-tie styling, evening gown or tailored suit cues, warm event lighting, polished luxury venue atmosphere, and red-carpet editorial framing"
      },
      {
        slug: "holiday",
        name: "Holiday",
        meta: "Seasonal",
        prompt: "a polished seasonal holiday album image with warm greeting-card composition, winter or celebration atmosphere, clear portrait focus, and private family-style keepsake mood"
      },
      {
        slug: "professional-headshots",
        name: "Professional Headshots",
        meta: "Headshots",
        prompt: "a credible business portrait result for LinkedIn, resumes, founders, and team pages, with polished office or studio light, realistic skin texture, confident adult subject, and clean professional wardrobe"
      },
      {
        slug: "cyberpunk",
        name: "Cyberpunk",
        meta: "Creative",
        prompt: "a cinematic cyberpunk portrait result in a neon night city with rain reflections, colored rim light, futuristic wardrobe cues, and a dramatic but realistic editorial finish"
      }
    ],
    section: {
      anchor: "generated-showcase",
      eyebrow: "Customer-created examples",
      title: "Browse image and video themes customers have already created.",
      subtitle: "These examples use materials customers created in private accounts. Scan the theme labels to choose a direction for your own set.",
      imageTitle: "Customer image themes",
      videoTitle: "Customer video themes",
      primaryCta: "Start with your photos",
      primaryHref: "/login"
    },
    assetRoot: "public/assets/dreamshoot/generated/homepage-showcase",
    publicRoot: "/assets/dreamshoot/generated/homepage-showcase",
    videoCategories: [
      { slug: "portrait-motion", label: "Portrait Motion", description: "Short moving portraits for headshots, creators, and personal profile scenes." },
      { slug: "creator-motion", label: "Creator Motion", description: "Cinematic motion for creator portraits, profile updates, and everyday album moments." },
      { slug: "social-cards", label: "Social Clips", description: "Compact profile, announcement, and story-ready short clips." },
      { slug: "wedding-memory", label: "Keepsake Film", description: "Romantic, seasonal, and celebration clips from finished image frames." },
      { slug: "product-teaser", label: "Product Motion", description: "Product and creator-commerce clips with clean studio movement." }
    ],
    videoThemes: [
      {
        slug: "cinematic-portrait-motion",
        posterSlug: "professional-headshots",
        categorySlug: "portrait-motion",
        name: "Cinematic Portrait Motion",
        headline: "A refined moving portrait with subtle camera drift.",
        description: "Turns a finished portrait into a realistic short profile clip with gentle movement.",
        prompt: "Create one polished realistic short professional headshot video from the supplied image frame. Preserve the visible business portrait subject, office or studio portrait setting, wardrobe color, lighting direction, face-safe broad likeness cues, and clean headshot composition while adding subtle breathing motion, natural expression, soft parallax, and a slow cinematic push-in. Do not change into a market, mountain, pet, wedding, travel, cyberpunk, or empty landscape scene. No text, logos, UI, subtitles, watermarks, split screens, or collage layouts.",
        creditCost: 24,
        durationSeconds: 6
      },
      {
        slug: "social-profile-clip",
        posterSlug: "world-cup-fan-photos",
        categorySlug: "social-cards",
        name: "Social Profile Clip",
        headline: "A crisp clip for profile headers and creator cards.",
        description: "Adds clean expression movement and editorial light for social-ready profile moments.",
        prompt: "Create one clean social profile video from the supplied fan portrait frame. Keep the visible stadium or fan-photo subject realistic and confident, preserve the outfit, pose, celebratory expression, and sports-fan atmosphere, and add a controlled camera slide with natural expression movement and crisp editorial lighting. Do not turn the frame into a mountain lake, empty landscape, market, pet scene, office headshot, or wedding. Keep the output uncluttered with no text overlays, logos, borders, UI, or watermarks.",
        creditCost: 22,
        durationSeconds: 5
      },
      {
        slug: "creator-scene-motion",
        posterSlug: "creator-portraits",
        categorySlug: "creator-motion",
        name: "Creator Scene Motion",
        headline: "A short creator portrait motion scene.",
        description: "Uses a finished creator frame as the opening beat for a natural moving scene.",
        prompt: "Create one realistic creator portrait motion clip from the supplied image frame. Preserve the main visible person, wardrobe, scene facts, lighting direction, and camera angle while adding subtle environmental movement and a smooth creator-profile camera drift. The subject must remain visible and recognizable as the source portrait; do not output an empty landscape, market, pet room, studio headshot, or unrelated postcard scene. Keep it continuous and realistic without text, logos, UI, or slideshow behavior.",
        creditCost: 28,
        durationSeconds: 6
      },
      {
        slug: "wedding-memory-film",
        posterSlug: "wedding-portraits",
        categorySlug: "wedding-memory",
        name: "Wedding Memory Film",
        headline: "A soft keepsake clip from a romantic image frame.",
        description: "Adds warm motion for wedding-inspired, couple, or announcement-ready scenes.",
        prompt: "Create one tasteful romantic wedding keepsake video from the supplied wedding portrait frame. Preserve the visible couple or wedding subject, clothing cues, flowers or venue details, warm lighting, and intimate composition while adding gentle fabric movement, soft background motion, and elegant camera drift. Do not replace the wedding frame with an empty mountain, lake, market, pet, or cyberpunk scene. Keep the scene respectful, realistic, and free of text, logos, UI, watermarks, or collage panels.",
        creditCost: 30,
        durationSeconds: 6
      },
      {
        slug: "holiday-card-motion",
        posterSlug: "gala-photos",
        categorySlug: "wedding-memory",
        name: "Holiday Card Motion",
        headline: "A warm seasonal clip from a finished card image.",
        description: "Adds tasteful festive motion while keeping the private portrait frame stable.",
        prompt: "Create one warm gala or celebration keepsake video from the supplied formal portrait frame. Preserve the visible person, formal outfit, pose, venue lighting, and card-like portrait composition while adding gentle festive atmosphere, soft light movement, and cozy cinematic camera drift. Do not output cats, window seats, mountains, markets, food stalls, empty landscapes, or unrelated characters. No text overlays, logos, UI, watermarks, or extra unrelated characters.",
        creditCost: 24,
        durationSeconds: 6
      },
      {
        slug: "product-showcase-motion",
        posterSlug: "creator-portraits",
        categorySlug: "product-teaser",
        name: "Product Showcase Motion",
        headline: "A compact product or creator-commerce reveal.",
        description: "Animates a product-style frame with controlled light and smooth camera movement.",
        prompt: "Create one realistic creator-commerce or media-kit motion video from the supplied creator portrait frame. Preserve the visible creator subject, studio or desk props, microphone or camera-adjacent cues if present, wardrobe, colors, and composition while adding controlled studio light movement, soft reflections, and a smooth reveal camera move. Do not invent a produce market, food stall, shoppers, grocery baskets, labels, claims, logos, text, or unrelated product details not shown in the reference.",
        creditCost: 26,
        durationSeconds: 6
      },
      {
        slug: "prompt-directed-motion",
        posterSlug: "cyberpunk",
        categorySlug: "portrait-motion",
        name: "Prompt Directed Motion",
        headline: "A neutral motion preset that follows the image and note.",
        description: "Keeps the source frame as the creative lead for flexible image-to-video ideas.",
        prompt: "Create one realistic cyberpunk portrait motion video from the supplied neon city portrait frame. Preserve the visible subject, action, pose, futuristic wardrobe cues, rain or neon lighting, scene facts, and lighting before adding subtle camera motion. Do not output an empty mountain lake, nature scene, market, pet room, wedding, office, or generic travel clip. No text, logos, UI, subtitles, watermarks, split screens, or collage panels.",
        creditCost: 24,
        durationSeconds: 6
      },
      {
        slug: "creator-intro-motion",
        posterSlug: "hairstyle",
        categorySlug: "social-cards",
        name: "Creator Intro Motion",
        headline: "A compact intro clip for creator profiles and reels.",
        description: "Adds polished motion to creator portraits, media-kit frames, and social intros.",
        prompt: "Create one polished beauty or hairstyle intro video from the supplied salon-style portrait frame. Preserve the subject, hairstyle, wardrobe, beauty lighting, and clean profile composition while adding subtle camera travel, natural expression movement, and a confident intro-like visual rhythm. Do not turn it into a wedding couple, landscape, market, cat room, product stall, or travel scene. Keep it realistic and free of captions, logos, UI, borders, watermarks, or collage layouts.",
        creditCost: 24,
        durationSeconds: 6
      }
    ]
  },
  {
    key: "aidreamcapes",
    siteId: "site_aidreamcapes",
    siteSlug: "aidreamcapes",
    imageSlugs: [
      "fan-scene-albums",
      "game-day-group-photos",
      "stadium-night-fan-sets",
      "premiere-style-portraits",
      "christmas-holiday-albums",
      "thanksgiving-memory-sets",
      "halloween-party-portraits",
      "seasonal-celebration-photos"
    ],
    imageThemes: [
      {
        slug: "fan-scene-albums",
        name: "Fan-Scene Albums",
        meta: "Private Fan Scenes",
        prompt: "a private fan-scene album example with meetup atmosphere, supporter photo wall styling, spotlight portrait energy, original scene design, no real celebrity copy, and no protected logos"
      },
      {
        slug: "game-day-group-photos",
        name: "Game-Day Group Portraits",
        meta: "Sports Energy",
        prompt: "a game-day group portrait example with arena-inspired light, supporter celebration mood, private group album polish, no official team marks, no event logos, and no real athlete recreation"
      },
      {
        slug: "stadium-night-fan-sets",
        name: "Stadium Night Fan Sets",
        meta: "Stadium Energy",
        prompt: "a stadium-night fan set example with floodlight drama, original supporter styling, private group album polish, no official team marks, and no real athlete recreation"
      },
      {
        slug: "premiere-style-portraits",
        name: "Premiere-Inspired Portrait Sets",
        meta: "VIP Mood",
        prompt: "a premiere-inspired portrait example with camera flash, polished arrival styling, formal evening atmosphere, original step-and-repeat feel, no public figure copying, and no brand logos"
      },
      {
        slug: "christmas-holiday-albums",
        name: "Christmas Holiday Albums",
        meta: "Christmas",
        prompt: "a Christmas holiday album example with cozy lights, fan-safe group styling, greeting-card warmth, private seasonal gallery polish, no protected characters, and no branded decorations"
      },
      {
        slug: "thanksgiving-memory-sets",
        name: "Thanksgiving Keepsake Sets",
        meta: "Gratitude",
        prompt: "a Thanksgiving keepsake set example with warm table light, gratitude gathering mood, family-style private album crops, approved source-photo feel, and no protected marks"
      },
      {
        slug: "halloween-party-portraits",
        name: "Halloween Party Portraits",
        meta: "Halloween",
        prompt: "a Halloween party portrait example with moody color, original costume-friendly styling, playful group energy, private seasonal album polish, no protected characters, and no branded costumes"
      },
      {
        slug: "seasonal-celebration-photos",
        name: "Seasonal Celebration Photos",
        meta: "Rotating Occasions",
        prompt: "a seasonal celebration photo example with birthday or New Year group energy, private occasion album continuity, polished cover crop, approved source-photo mood, and no protected branding"
      }
    ],
    section: {
      anchor: "generated-showcase",
      eyebrow: "Customer occasion examples",
      title: "Browse private fan-scene, game-day, and holiday themes customers can create.",
      subtitle: "These examples use Aidreamcapes-owned theme assets and approved source-photo assumptions. Scan fan-scene, game-day, premiere, Christmas, Thanksgiving, Halloween, and seasonal directions.",
      imageTitle: "Fan and holiday image themes",
      videoTitle: "Customer travel video themes",
      primaryCta: "Start with approved photos",
      primaryHref: "/login"
    },
    assetRoot: "public/assets/sites/site_aidreamcapes/fan-holiday-theme",
    publicRoot: "/assets/sites/site_aidreamcapes/fan-holiday-theme",
    videoAssetRoot: "public/assets/sites/site_aidreamcapes/homepage-showcase",
    videoPublicRoot: "/assets/sites/site_aidreamcapes/homepage-showcase",
    videoVersion: "20260717motionDiversity",
    videoCategories: [
      { slug: "route-motion", label: "Route Motion", description: "Scenic travel clips for route portraits, lookouts, and city walks." },
      { slug: "coastal-motion", label: "Coastal Motion", description: "Sea light, resort, and breezy private-gallery travel clips." },
      { slug: "memory-film", label: "Memory Film", description: "Short keepsake clips for personal destination stories." },
      { slug: "profile-travel", label: "Profile Travel", description: "Creator, solo, and personal-atlas travel profile clips." }
    ],
    videoThemes: [
      {
        slug: "route-atlas-motion",
        posterSlug: "route-portrait-albums",
        categorySlug: "route-motion",
        name: "Route Atlas Motion",
        headline: "A cinematic route portrait with soft destination movement.",
        description: "Animates a route portrait frame into a compact travel-gallery clip.",
        prompt: "Create one refined route-atlas travel portrait video from the supplied image frame. Preserve the visible traveler, wardrobe, destination-route details, luggage or camera/notebook cues if visible, lighting, and camera angle while adding a slow atlas-like camera move, subtle environmental motion, and realistic depth. Do not output an empty lighthouse, empty beach, market, pet room, office headshot, or generic landscape without the traveler. Keep the private-gallery tone calm and polished with no text, map labels, logos, UI, watermarks, split screens, or collage panels.",
        creditCost: 28,
        durationSeconds: 6
      },
      {
        slug: "coastal-memory-clip",
        posterSlug: "coastal-light-sets",
        categorySlug: "coastal-motion",
        name: "Coastal Memory Clip",
        headline: "A breezy seaside scene from a finished travel frame.",
        description: "Adds sea-light motion to coastal, cliffside, and resort portrait images.",
        prompt: "Create one realistic coastal travel video from the supplied image frame. Preserve the person, outfit, horizon, architecture, water, and warm light cues while adding gentle breeze, soft water movement, and a smooth scenic camera drift. Keep it natural, elegant, and free of captions, logos, UI, watermarks, or unrelated extra people.",
        creditCost: 28,
        durationSeconds: 6
      },
      {
        slug: "old-quarter-walkthrough",
        posterSlug: "old-quarter-walks",
        categorySlug: "route-motion",
        name: "Old Quarter Walkthrough",
        headline: "A warm city-lane motion clip for travel portraits.",
        description: "Turns old-town portrait frames into subtle city-break movement.",
        prompt: "Create one cinematic old-quarter city-lane travel clip from the supplied image frame. Preserve the visible traveler, stone lane, old street architecture, cafe textures, wardrobe colors, and lighting while adding a gentle walking-camera feel, small background movement, and natural city atmosphere. Do not turn it into a forest path, autumn road, market, pet room, empty landscape, or resort balcony. No text, logos, UI, watermarks, split panels, or slideshow cuts.",
        creditCost: 28,
        durationSeconds: 6
      },
      {
        slug: "resort-balcony-motion",
        posterSlug: "island-resort-scenes",
        categorySlug: "coastal-motion",
        name: "Resort Balcony Motion",
        headline: "A relaxed resort clip with warm private-gallery polish.",
        description: "Adds pool, terrace, linen, or balcony motion to travel keepsake images.",
        prompt: "Create one relaxed island resort travel video from the supplied image frame. Preserve the traveler, balcony or terrace composition, tropical resort architecture, wardrobe, warm light, and relaxed vacation mood while adding subtle fabric movement, soft reflections, and a slow vacation-memory camera drift. Do not replace the source with markets, cats, office portraits, old-quarter streets, or empty landscapes. Keep it realistic, private-gallery ready, and free of text, logos, UI, watermarks, or extra invented branding.",
        creditCost: 28,
        durationSeconds: 6
      },
      {
        slug: "scenic-overlook-pan",
        posterSlug: "scenic-overlooks",
        categorySlug: "route-motion",
        name: "Scenic Overlook Pan",
        headline: "A panoramic route clip from a lookout portrait.",
        description: "Adds open-sky and viewpoint movement to scenic travel images.",
        prompt: "Create one realistic scenic overlook travel video from the supplied image frame. Preserve the traveler, railing or ridge details, horizon, wardrobe, coastal or mountain overlook, and golden light while adding a slow panoramic camera move, breeze, and subtle sky or landscape motion. Keep the subject stable, centered with safe margins for a square crop, and do not add text, logos, UI, watermarks, or collage framing.",
        creditCost: 28,
        durationSeconds: 6
      },
      {
        slug: "alpine-trail-motion",
        posterSlug: "alpine-trail-frames",
        categorySlug: "memory-film",
        name: "Alpine Trail Motion",
        headline: "A crisp outdoor motion scene for mountain route albums.",
        description: "Animates alpine, lake, cabin, or trail portrait frames with natural movement.",
        prompt: "Create one crisp alpine travel video from the supplied image frame. Preserve the traveler, outdoor layers, trail or mountain details, lake or cabin cues, and natural light while adding breeze, soft depth movement, and a gentle adventure-camera drift. Keep it realistic with no text, logos, UI, watermarks, split screens, or unrelated scene changes.",
        creditCost: 28,
        durationSeconds: 6
      },
      {
        slug: "solo-traveler-profile-clip",
        posterSlug: "solo-traveler-profiles",
        categorySlug: "profile-travel",
        name: "Solo Traveler Profile Clip",
        headline: "A polished travel profile clip for personal pages.",
        description: "Adds confident, subtle movement to solo-traveler portraits and creator route frames.",
        prompt: "Create one polished solo traveler profile video from the supplied image frame. Preserve the traveler, expression, wardrobe, destination backdrop, notebook or camera props if visible, and personal-atlas mood while adding subtle expression movement and a smooth profile-card camera slide. No captions, logos, UI, watermarks, borders, or collage layouts.",
        creditCost: 24,
        durationSeconds: 6
      },
      {
        slug: "heritage-celebration-film",
        posterSlug: "heritage-celebration-portraits",
        categorySlug: "memory-film",
        name: "Heritage Celebration Film",
        headline: "A respectful celebration clip from a finished portrait frame.",
        description: "Adds gentle motion to heritage, festival, and milestone travel-gallery images.",
        prompt: "Create one respectful celebration video from the supplied image frame. Preserve the visible people, traditional attire or rich textiles, jewelry, warm gathering details, and elegant composition while adding subtle fabric movement, soft background atmosphere, and a dignified camera drift. Keep it tasteful and free of text, logos, UI, watermarks, or invented official marks.",
        creditCost: 30,
        durationSeconds: 6
      }
    ]
  }
];

export function showcaseStoreBySlug(slug) {
  const normalized = String(slug || "").trim().toLowerCase();
  return showcaseStores.find((store) => store.siteSlug === normalized || store.key === normalized || store.siteId === normalized);
}

export function publicShowcasePosterPath(store, videoSlug) {
  const root = store.videoPublicRoot ?? store.publicRoot;
  const version = store.videoVersion ?? SHOWCASE_VERSION;
  return `${root}/posters/${videoSlug}.webp?v=${version}`;
}

export function publicShowcaseVideoPath(store, videoSlug) {
  const root = store.videoPublicRoot ?? store.publicRoot;
  const version = store.videoVersion ?? SHOWCASE_VERSION;
  return `${root}/videos/${videoSlug}.mp4?v=${version}`;
}

export function publicShowcaseImagePath(store, imageSlug) {
  return `${store.publicRoot}/images/${showcaseSlug(imageSlug)}.webp?v=${SHOWCASE_VERSION}`;
}

export function localShowcasePosterPath(store, videoSlug) {
  return `${store.videoAssetRoot ?? store.assetRoot}/posters/${videoSlug}.webp`;
}

export function localShowcaseVideoPath(store, videoSlug) {
  return `${store.videoAssetRoot ?? store.assetRoot}/videos/${videoSlug}.mp4`;
}

export function localShowcaseImagePath(store, imageSlug) {
  return `${store.assetRoot}/images/${showcaseSlug(imageSlug)}.webp`;
}

export function showcaseVideoPosterSlug(store, theme, index = 0) {
  return showcaseSlug(theme?.posterSlug ?? store.imageSlugs?.[index] ?? store.imageSlugs?.[0] ?? theme?.slug ?? "");
}

export function showcaseImageThemesForStore(store) {
  const themeBySlug = new Map((store.imageThemes ?? []).map((theme) => [showcaseSlug(theme.slug), theme]));
  return (store.imageSlugs ?? []).map((slug) => {
    const normalizedSlug = showcaseSlug(slug);
    return themeBySlug.get(normalizedSlug) ?? {
      slug: normalizedSlug,
      name: titleFromSlug(normalizedSlug),
      meta: titleFromSlug(normalizedSlug),
      prompt: `a polished customer-created example image for the ${titleFromSlug(normalizedSlug)} theme`
    };
  });
}

export function homepageShowcaseSection(store, images = 8, videos = 8) {
  return {
    type: "dreamshoot_generation_showcase",
    settings: {
      ...store.section,
      imageSlugs: store.imageSlugs.slice(0, images).join("|"),
      videoSlugs: store.videoThemes.slice(0, videos).map((theme) => theme.slug).join("|"),
      itemLimit: Math.min(8, Math.max(images, videos))
    },
    blocks: []
  };
}
