const siteAssetRoot = "/assets/sites/site_aidreamcapes";

export const aidreamcapesVideoDirectoryContent = {
  eyebrow: "THE COMPLETE AI VIDEO INDEX",
  title: "Choose the video direction that fits the job.",
  subtitle: "Browse every Aidreamcapes video theme by intent—from testing an opening hook to building a cinematic product world, shipping a launch cut, or syncing an approved beat.",
  directoryNote: "LIVE VIDEO THEME DIRECTORY",
  statLabels: {
    lanes: "creative lanes",
    themes: "public themes",
    routes: "destination routes"
  },
  browseLabel: "Browse all themes",
  openLabel: "Open theme",
  laneCountLabel: "video lane",
  laneCopy: [
    {
      groupLabel: "Ads Testing",
      intro: "Compare the opening, proof, and delivery choices that help a product earn attention in a crowded feed.",
      focusLabel: "Focus:",
      focus: "hooks, proof, and variations built for comparison."
    },
    {
      groupLabel: "Conversion / Seeding",
      intro: "Turn product understanding into a useful sequence with demonstrations, explanations, reactions, and credible context.",
      focusLabel: "Focus:",
      focus: "product understanding, demonstrations, and credible context."
    },
    {
      groupLabel: "Promo / Category",
      intro: "Shape launch moments and category-specific stories around the offer, use case, and visual proof your audience needs.",
      focusLabel: "Focus:",
      focus: "launch moments, category storytelling, offers, and use cases."
    },
    {
      groupLabel: "Brand / Creator",
      intro: "Build a recognizable voice across founder updates, localized edits, cinematic product stories, and sound-led cuts.",
      focusLabel: "Focus:",
      focus: "founder perspective, localization, visual worlds, and sound-led cuts."
    }
  ],
  workflow: {
    eyebrow: "FROM BRIEF TO CUT",
    title: "Start with the job, then choose the format.",
    body: "The directory keeps the decision simple: name the job, choose a creative lane, open the matching workflow, and review the output against the audience, product facts, and destination.",
    steps: [
      { title: "Choose an intent", body: "Start with the outcome you need: attention, understanding, proof, promotion, or brand memory." },
      { title: "Pick a lane", body: "Use the grouped themes to narrow the creative direction before you open a specific workflow." },
      { title: "Review the route", body: "Each label opens its own Aidreamcapes page so the brief and use case stay specific." },
      { title: "Make the next cut", body: "Move into the workspace when the product, audience, and message are clear enough to test." }
    ]
  },
  finalCta: {
    eyebrow: "READY TO MAKE THE NEXT CUT",
    title: "Turn one clear idea into a reviewable video direction.",
    body: "Open the workspace when you know the product, audience, or story you want to test.",
    primaryLabel: "Open video workspace",
    primaryHref: "/app/create#step-video",
    secondaryLabel: "View marketing workflows",
    secondaryHref: "/ai-video-generation/ugc-ad-video"
  },
  seo: {
    title: "AI Video Generation Themes for Products | Aidreamcapes",
    description: "Explore Aidreamcapes AI video generation themes for product demos, UGC ads, launches, creator updates, cinematic films, and audio-synced social cuts.",
    keywords: "AI video generation themes, product video generator, UGC ads, creator video, cinematic product film, audio sync video",
    canonicalPath: "/ai-video-generation",
    canonical: "https://aidreamcapes.com/ai-video-generation",
    robots: { index: true, follow: true, maxImagePreview: "large" },
    twitterDescription: "Browse Aidreamcapes video themes for product demos, UGC ads, creator updates, cinematic films, launches, and audio-synced social cuts.",
    ogImage: `${siteAssetRoot}/homepage-seo/ai-product-url-to-ugc-ad-workflow.webp`,
    ogImageAlt: "Aidreamcapes AI video theme directory for product, marketing, and creator video workflows"
  }
};

export function validateAidreamcapesVideoDirectoryContent() {
  const content = aidreamcapesVideoDirectoryContent;
  if (content.laneCopy.length !== 4) throw new Error("Aidreamcapes video directory requires four lane descriptions.");
  if (content.workflow.steps.length !== 4) throw new Error("Aidreamcapes video directory requires four workflow steps.");
  if (content.seo.canonicalPath !== "/ai-video-generation") throw new Error("Video directory canonical path is incorrect.");
  if (!content.seo.canonical.startsWith("https://aidreamcapes.com/")) throw new Error("Video directory canonical host is incorrect.");
  return content;
}
