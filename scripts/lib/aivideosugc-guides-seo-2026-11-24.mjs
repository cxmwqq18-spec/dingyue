// AIVideosUGC /guides SEO and internal-link rework — 2026-11-24.
//
// The guides previously used the same commercial keyword as the public tool
// pages ("URL to Video: ...", "Image to Video: ..."). These specs give every
// guide an intent-specific H1, an outcome H2, one commercial tool-page link,
// and a tool-page reverse link. URLs stay unchanged because the existing
// how-do-* slugs already match the new H1 wording.
//
// Apply with scripts/apply-aivideosugc-guides-seo-2026-11-24.mjs.

export const GUIDES = [
  {
    slug: "/guides/how-do-url-to-video",
    h1: "How to Convert a URL to Video: Step-by-Step Guide",
    subtitle: "Start an Editable Video Draft from a Product Page",
    toolCta: { label: "Convert a URL to Video", href: "/ai-video-generation/url-to-video" },
    ctaTitle: "Convert a URL to Video",
    seoTitle: "How to Convert URL to Video | AIVideosUGC"
  },
  {
    slug: "/guides/how-do-image-to-video",
    h1: "How to Use Image to Video: Step-by-Step Guide",
    subtitle: "Animate One Product Photo With a Single Clear Action",
    toolCta: { label: "Try our Image to Video Generator", href: "/ai-video-generation/image-to-video" },
    ctaTitle: "Try our Image to Video Generator",
    seoTitle: "How to Use Image to Video | AIVideosUGC"
  },
  {
    slug: "/guides/how-do-text-to-video",
    h1: "How to Use Text to Video: Prompts & Examples",
    subtitle: "How to Write a Prompt That Produces the Clip You Want",
    toolCta: { label: "Try our Text to Video Maker", href: "/ai-video-generation/text-to-video" },
    ctaTitle: "Try our Text to Video Maker",
    seoTitle: "How to Use Text to Video | AIVideosUGC"
  },
  {
    slug: "/guides/how-do-ai-video",
    h1: "How to Create AI Video: Step-by-Step Guide",
    subtitle: "Build One Product Clip From Several Reference Photos",
    toolCta: { label: "Create AI Video Online", href: "/ai-video-generation" },
    ctaTitle: "Create AI Video Online",
    seoTitle: "How to Create AI Video | AIVideosUGC"
  },
  {
    slug: "/guides/how-do-ai-image",
    h1: "How to Create AI Product Images: Best Practices",
    subtitle: "Turn a Product Reference Into a Lifestyle Photo",
    toolCta: { label: "Try our AI Image Generator", href: "/ai-image-generation/lifestyle-photos" },
    ctaTitle: "Try our AI Image Generator",
    seoTitle: "How to Create AI Product Images | AIVideosUGC"
  },
  {
    slug: "/guides/how-do-ai-avatar",
    h1: "How to Use AI Avatar: Step-by-Step Guide",
    subtitle: "Choose a Presenter and Voice Before You Write the Script",
    toolCta: { label: "Try our AI Avatar Generator", href: "/ai-video-generation/spokesperson-video" },
    ctaTitle: "Try our AI Avatar Generator",
    seoTitle: "How to Use AI Avatar | AIVideosUGC"
  },
  {
    slug: "/guides/how-do-product-links",
    h1: "How to Use Product Links: Step-by-Step Guide",
    subtitle: "Save a Product Page for Repeat Video Drafts",
    // No public Product Links landing page exists; decision A maps it to the
    // closest public tool page (product video from a product link or photo).
    toolCta: { label: "Try our Product Video Maker", href: "/ai-video-generation/product-video" },
    ctaTitle: "Try our Product Video Maker",
    seoTitle: "How to Use Product Links | AIVideosUGC"
  },
  {
    slug: "/guides/how-do-subtitle-studio",
    h1: "How to Add Subtitles: Step-by-Step Guide",
    subtitle: "Add Captions to a Finished Video Without Re-Editing",
    // No public Subtitle Studio landing page exists; decision A maps it to the
    // closest public tool page (finished video ads).
    toolCta: { label: "Explore the Video Ads Generator", href: "/ai-video-generation/video-ads" },
    ctaTitle: "Explore the Video Ads Generator",
    seoTitle: "How to Add Subtitles | AIVideosUGC"
  }
];

export const ARTICLES = [
  {
    slug: "/guides/first-tiktok-video-ad",
    h1: "How to Build a TikTok UGC Ad From a Product Link",
    subtitle: "A Step-by-Step Guide for Your First Vertical Ad",
    toolCta: { label: "Try our Video Ads Generator", href: "/ai-video-generation/video-ads" },
    appHref: "/app/create/tool/video-ads#step-video",
    seoTitle: "TikTok UGC Ad From a Product Link | AIVideosUGC"
  },
  {
    slug: "/guides/product-photo-tips",
    h1: "How to Take Product Photos With a Phone",
    subtitle: "Best Practices for Cleaner Source Images",
    toolCta: { label: "Explore the AI Image Generator", href: "/ai-image-generation" },
    appHref: "/app/create/tool/white-background",
    seoTitle: "How to Take Product Photos With a Phone | AIVideosUGC"
  },
  {
    slug: "/guides/testing-ad-versions",
    h1: "How to Test Video Ad Versions Without Wasting Credits",
    subtitle: "A Step-by-Step Guide to One-Variable Tests",
    toolCta: { label: "Try our Video Ads Generator", href: "/ai-video-generation/video-ads" },
    appHref: "/app/create/tool/video-ads#step-video",
    seoTitle: "How to Test Video Ad Versions | AIVideosUGC"
  },
  {
    slug: "/guides/white-background-amazon",
    h1: "Amazon Main Image Rules: A Step-by-Step Guide",
    subtitle: "Best Practices for a Clean White Background at Catalog Scale",
    toolCta: { label: "Try our White Background Photo Generator", href: "/ai-image-generation/white-background-photos" },
    appHref: "/app/create/tool/white-background",
    seoTitle: "Amazon Main Image Rules: Step-by-Step Guide | AIVideosUGC"
  },
  {
    slug: "/guides/ad-sizes-by-platform",
    h1: "Social Video Sizes: Best Practices for TikTok and Reels",
    subtitle: "Match Every Export to the Platform Before You Publish",
    toolCta: { label: "Try our Video Ads Generator", href: "/ai-video-generation/video-ads" },
    appHref: "/app/create/tool/social-ad-photos",
    seoTitle: "Social Video Sizes: Best Practices | AIVideosUGC"
  }
];

export const WORKSPACE = {
  slug: "/guides/workspace-guide",
  h1: "AI Video Workspace Tutorial: Step-by-Step Guide",
  subtitle: "Create, Review, and Download Product Videos in One Place",
  toolCta: { label: "Create AI Video Online", href: "/ai-video-generation" },
  seoTitle: "AI Video Workspace Tutorial | AIVideosUGC"
};

// Every inline guide link in these eight pages uses a tool name as its anchor
// ("use Image to Video", "compare it with AI Video"). They should point at the
// public tool page, not at another guide. The Related cards are data, not
// markdown, so they stay as guide cross-links.
export const LINK_REPLACEMENTS = [
  { from: "](/guides/how-do-image-to-video)", to: "](/ai-video-generation/image-to-video)" },
  { from: "](/guides/how-do-ai-video)", to: "](/ai-video-generation)" },
  { from: "](/guides/how-do-text-to-video)", to: "](/ai-video-generation/text-to-video)" },
  { from: "](/guides/how-do-url-to-video)", to: "](/ai-video-generation/url-to-video)" },
  { from: "](/guides/how-do-ai-avatar)", to: "](/ai-video-generation/spokesperson-video)" },
  { from: "](/guides/how-do-product-links)", to: "](/ai-video-generation/product-video)" }
];

export const HUB_CARDS = [
  { href: "/guides/how-do-text-to-video", title: "How to Use Text to Video: Prompts & Examples", kind: "Tutorial" },
  { href: "/guides/how-do-ai-video", title: "How to Create AI Video: Step-by-Step Guide", kind: "Tutorial" },
  { href: "/guides/how-do-ai-image", title: "How to Create AI Product Images: Best Practices", kind: "Tutorial" },
  { href: "/guides/how-do-product-links", title: "How to Use Product Links: Step-by-Step Guide", kind: "How-to" },
  { href: "/guides/how-do-ai-avatar", title: "How to Use AI Avatar: Step-by-Step Guide", kind: "Tutorial" },
  { href: "/guides/how-do-subtitle-studio", title: "How to Add Subtitles: Step-by-Step Guide", kind: "How-to" },
  { href: "/guides/how-do-url-to-video", title: "How to Convert a URL to Video: Step-by-Step Guide", kind: "How-to" },
  { href: "/guides/how-do-image-to-video", title: "How to Use Image to Video: Step-by-Step Guide", kind: "How-to" }
];

export const HUB_FIELD_GUIDES = [
  { href: "/guides/first-tiktok-video-ad", label: "How to Build a TikTok UGC Ad From a Product Link" },
  { href: "/guides/product-photo-tips", label: "How to Take Product Photos With a Phone" },
  { href: "/guides/ad-sizes-by-platform", label: "Social Video Sizes: Best Practices" },
  { href: "/guides/testing-ad-versions", label: "How to Test Video Ad Versions" },
  { href: "/guides/white-background-amazon", label: "Amazon Main Image Rules: Step-by-Step Guide" }
];

// Reverse links live after the tool-page FAQ. The two tools without a dedicated
// guide use the closest intent-matched guide; the owner can replace either with
// a new tutorial URL without changing the renderer.
export const TOOL_LINKS = [
  { slug: "/ai-video-generation/url-to-video", label: "Read our How to URL to Video", href: "/guides/how-do-url-to-video" },
  { slug: "/ai-video-generation/image-to-video", label: "Read our How to Image to Video", href: "/guides/how-do-image-to-video" },
  { slug: "/ai-video-generation/text-to-video", label: "Read our step-by-step guide", href: "/guides/how-do-text-to-video" },
  { slug: "/ai-video-generation/video-ads", label: "Read our How to Test Video Ad Versions", href: "/guides/testing-ad-versions" },
  { slug: "/ai-video-generation/product-video", label: "Read our How to Use Product Links", href: "/guides/how-do-product-links" },
  { slug: "/ai-video-generation/spokesperson-video", label: "Read our How to AI Avatar", href: "/guides/how-do-ai-avatar" },
  { slug: "/ai-video-generation/before-after-video", label: "Read our How to Image to Video", href: "/guides/how-do-image-to-video" },
  { slug: "/ai-video-generation/ai-twin", label: "Read our How to AI Avatar", href: "/guides/how-do-ai-avatar" },
  { slug: "/ai-video-generation", label: "Read our step-by-step guide", href: "/guides/workspace-guide" }
];
