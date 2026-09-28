const siteAssetRoot = "/assets/sites/site_aidreamcapes";

export const aidreamcapesMarketingDirectoryContent = {
  eyebrow: "THE MARKETING WORKSPACE",
  title: "Build the campaign one clear frame at a time.",
  subtitle: "Browse campaign-ready AI image and video workflows for product launches, listing pages, social ads, creator-led stories, and the moments that need a sharper next step.",
  directoryNote: "MARKETING ROUTES",
  openLabel: "Open workflow",
  featuredLabel: "Featured workflow",
  filterLabels: {
    all: "All work",
    image: "Image workflows",
    video: "Video workflows"
  },
  imageSection: {
    eyebrow: "CAMPAIGN IMAGES",
    title: "Start with a frame that earns the click.",
    body: "Use product-led stills for listings, launch moments, vertical placements, and the visual details that make an offer easier to understand."
  },
  videoSection: {
    eyebrow: "CAMPAIGN VIDEO",
    title: "Give the message a useful rhythm.",
    body: "Choose a video workflow for the job at hand—from the first hook and product proof to a launch cut, a creator story, or a focused demo."
  },
  workflow: {
    eyebrow: "FROM BRIEF TO ASSET",
    title: "Choose the job before you choose the format.",
    body: "A good campaign route starts with one audience decision. Pick the moment you need to clarify, open the matching workflow, and review every visible claim before publishing.",
    steps: [
      { title: "Name the decision", body: "Decide whether the next asset needs to attract attention, explain a product, show proof, or move a ready buyer." },
      { title: "Pick the surface", body: "Choose an image or video route that matches the placement, crop, speed, and amount of detail the audience can absorb." },
      { title: "Review the source", body: "Check product identity, people, permissions, prices, offers, interface details, and any words that appear in the output." },
      { title: "Make the next cut", body: "Move into the workspace when the brief is clear enough to generate, compare, and refine a reviewable variation." }
    ]
  },
  finalCta: {
    eyebrow: "READY TO MAKE THE NEXT ASSET",
    title: "Turn the campaign brief into something your team can review.",
    body: "Start with the product, audience, and destination you already know. Aidreamcapes helps you explore the visual direction while keeping the final decision in your hands.",
    primaryLabel: "Open the workspace",
    primaryHref: "/app/create?tool_id=image_generator",
    secondaryLabel: "See the full video index",
    secondaryHref: "/ai-video-generation"
  },
  fallbackImages: {
    "/ai-video-generation/promo-video": `${siteAssetRoot}/promo-category-v1/promo-video/promo-video-hero-output.webp`,
    "/ai-image-generation/sale-campaign-key-visual": `${siteAssetRoot}/sale-campaign-key-visual-v1/sale-campaign-key-visual/hero-output.webp`,
    "/ai-image-generation/on-model-generation": `${siteAssetRoot}/on-model-generation-v1/on-model-generation/hero-output.webp`,
    "/ai-image-generation/virtual-try-on": `${siteAssetRoot}/virtual-try-on-v1/virtual-try-on/hero-output.webp`,
    "/ai-video-generation/video-ad": `${siteAssetRoot}/mirror/aidreamcapes/dreamshoot/generated/video-topic-media/video-ad/video-ad-01.webp`
  },
  seo: {
    title: "AI Marketing Workflows for Ecommerce | Aidreamcapes",
    description: "Browse Aidreamcapes AI marketing workflows for product images, listing stills, UGC ads, product videos, launch campaigns, creator stories, and social content.",
    keywords: "AI marketing workflows, AI product images, AI product video, UGC ads, ecommerce creative, launch campaign assets",
    canonicalPath: "/marketing",
    canonical: "https://aidreamcapes.com/marketing",
    robots: { index: true, follow: true, maxImagePreview: "large" },
    twitterDescription: "Browse AI marketing workflows for product images, UGC ads, product videos, launch campaigns, creator stories, and social content.",
    ogImage: `${siteAssetRoot}/homepage-seo/ai-product-url-to-ugc-ad-workflow.webp`,
    ogImageAlt: "Product page transforming into a set of AI marketing image and video directions"
  }
};

export function validateAidreamcapesMarketingDirectoryContent() {
  const content = aidreamcapesMarketingDirectoryContent;
  if (content.workflow.steps.length !== 4) throw new Error("Aidreamcapes marketing directory requires four workflow steps.");
  if (content.seo.canonicalPath !== "/marketing") throw new Error("Marketing directory canonical path is incorrect.");
  if (!content.seo.canonical.startsWith("https://aidreamcapes.com/")) throw new Error("Marketing directory canonical host is incorrect.");
  return content;
}
