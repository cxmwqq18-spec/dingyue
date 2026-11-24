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
    h1: "How do URL to Video",
    subtitle: "Start an Editable Video Draft from a Product Page",
    toolCta: { label: "Try our URL to Video Generator", href: "/ai-video-generation/url-to-video" },
    ctaTitle: "Try our URL to Video Generator",
    seoTitle: "How do URL to Video: Draft From a Product Page | AIVideosUGC",
    seoDescription: "Import a public product page into an editable video draft, review the product photos and details, and stop before generation until the draft looks right."
  },
  {
    slug: "/guides/how-do-image-to-video",
    h1: "How do Image to Video",
    subtitle: "Animate One Product Photo With a Single Clear Action",
    toolCta: { label: "Try our Image to Video Generator", href: "/ai-video-generation/image-to-video" },
    ctaTitle: "Try our Image to Video Generator",
    seoTitle: "How do Image to Video: One Photo, One Action | AIVideosUGC",
    seoDescription: "Animate one product photo with a clear motion prompt, then check whether the clip preserves the product's shape, label, and color before you use it."
  },
  {
    slug: "/guides/how-do-text-to-video",
    h1: "How do Text to Video",
    subtitle: "How to Write a Prompt That Produces the Clip You Want",
    toolCta: { label: "Try our Text to Video Generator", href: "/ai-video-generation/text-to-video" },
    ctaTitle: "Try our Text to Video Generator",
    seoTitle: "How do Text to Video: Prompt Guide & Examples | AIVideosUGC",
    seoDescription: "Learn how to write a Text to Video prompt: name the product, setting, action, camera, look, and length, then generate and review the clip before you download it."
  },
  {
    slug: "/guides/how-do-ai-video",
    h1: "How do AI Video",
    subtitle: "Build One Product Clip From Several Reference Photos",
    toolCta: { label: "Explore the AI Video Generator", href: "/ai-video-generation" },
    ctaTitle: "Explore the AI Video Generator",
    seoTitle: "How do AI Video: Build From Product References | AIVideosUGC",
    seoDescription: "Add product reference photos, describe the scene, review the estimate, and compare the generated clip with your references before you keep it."
  },
  {
    slug: "/guides/how-do-ai-image",
    h1: "How do AI Image",
    subtitle: "Turn a Product Reference Into a Lifestyle Photo",
    toolCta: { label: "Try our AI Image Generator", href: "/ai-image-generation/lifestyle-photos" },
    ctaTitle: "Try our AI Image Generator",
    seoTitle: "How do AI Image: Reference to Lifestyle Photo | AIVideosUGC",
    seoDescription: "Use one clear product photo with a lifestyle preset to create a still, then check the product shape, label, and color at full size before download."
  },
  {
    slug: "/guides/how-do-ai-avatar",
    h1: "How do AI Avatar",
    subtitle: "Choose a Presenter and Voice Before You Write the Script",
    toolCta: { label: "Try our AI Avatar Generator", href: "/ai-video-generation/spokesperson-video" },
    ctaTitle: "Try our AI Avatar Generator",
    seoTitle: "How do AI Avatar: Choose a Presenter and Voice | AIVideosUGC",
    seoDescription: "Learn how to choose an AI presenter, preview the voice, add product photos and a script, then review the finished video before you download it."
  },
  {
    slug: "/guides/how-do-product-links",
    h1: "How do Product Links",
    subtitle: "Save a Product Page for Repeat Video Drafts",
    // No public Product Links landing page exists; decision A maps it to the
    // closest public tool page (product video from a product link or photo).
    toolCta: { label: "Explore the Product Video Generator", href: "/ai-video-generation/product-video" },
    ctaTitle: "Explore the Product Video Generator",
    seoTitle: "How do Product Links: Save Pages for Reuse | AIVideosUGC",
    seoDescription: "Import a public product page, verify its photo and details, then confirm the product entry so you can reuse it in future video drafts and campaigns."
  },
  {
    slug: "/guides/how-do-subtitle-studio",
    h1: "How do Subtitle Studio",
    subtitle: "Add Captions to a Finished Video Without Re-Editing",
    // No public Subtitle Studio landing page exists; decision A maps it to the
    // closest public tool page (finished video ads).
    toolCta: { label: "Explore the Video Ads Generator", href: "/ai-video-generation/video-ads" },
    ctaTitle: "Explore the Video Ads Generator",
    seoTitle: "How do Subtitle Studio: Caption a Video | AIVideosUGC",
    seoDescription: "Choose a completed video, generate captions in Subtitle Studio, and compare the new captioned version with the original before you download it."
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
  toolCta: { label: "Explore the AI Video Generator", href: "/ai-video-generation" },
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

// The guide hub uses the same title as the detail-page H1. The card no longer
// carries a separate "How to" tag, so the list and the destination match.
export const HUB_CARDS = [
  { href: "/guides/how-do-text-to-video", title: "How do Text to Video", kind: "Tutorial" },
  { href: "/guides/how-do-ai-video", title: "How do AI Video", kind: "Tutorial" },
  { href: "/guides/how-do-ai-image", title: "How do AI Image", kind: "Tutorial" },
  { href: "/guides/how-do-product-links", title: "How do Product Links", kind: "How-to" },
  { href: "/guides/how-do-ai-avatar", title: "How do AI Avatar", kind: "Tutorial" },
  { href: "/guides/how-do-subtitle-studio", title: "How do Subtitle Studio", kind: "How-to" },
  { href: "/guides/how-do-url-to-video", title: "How do URL to Video", kind: "How-to" },
  { href: "/guides/how-do-image-to-video", title: "How do Image to Video", kind: "How-to" }
];

export const HUB_FIELD_GUIDES = [
  { href: "/guides/first-tiktok-video-ad", label: "How to Build a TikTok UGC Ad From a Product Link" },
  { href: "/guides/product-photo-tips", label: "How to Take Product Photos With a Phone" },
  { href: "/guides/ad-sizes-by-platform", label: "Social Video Sizes: Best Practices for TikTok and Reels" },
  { href: "/guides/testing-ad-versions", label: "How to Test Video Ad Versions Without Wasting Credits" },
  { href: "/guides/white-background-amazon", label: "Amazon Main Image Rules: A Step-by-Step Guide" }
];

// Reverse links live after the tool-page FAQ. Before & After Video and AI Twin
// intentionally have no entry because no matching guide exists yet.
export const TOOL_LINKS = [
  { slug: "/ai-video-generation/url-to-video", label: "Read our step-by-step URL to Video guide", href: "/guides/how-do-url-to-video" },
  { slug: "/ai-video-generation/image-to-video", label: "Read our step-by-step Image to Video guide", href: "/guides/how-do-image-to-video" },
  { slug: "/ai-video-generation/text-to-video", label: "Read our step-by-step guide", href: "/guides/how-do-text-to-video" },
  { slug: "/ai-video-generation/video-ads", label: "Read our Video Ads tutorial", href: "/guides/testing-ad-versions" },
  { slug: "/ai-video-generation/product-video", label: "Read our Product Links guide", href: "/guides/how-do-product-links" },
  { slug: "/ai-video-generation/spokesperson-video", label: "Read our AI Avatar tutorial", href: "/guides/how-do-ai-avatar" },
  { slug: "/ai-video-generation", label: "Read the Workspace Guide", href: "/guides/workspace-guide" }
];

// Tool pages that must not carry a reverse guide link. They have no dedicated
// guide, so an earlier pass pointed them at unrelated tutorials; remove that
// field instead of inventing a mapping.
export const REMOVED_TOOL_LINKS = [
  "/ai-video-generation/before-after-video",
  "/ai-video-generation/ai-twin"
];

// Answer pages keep only their own module/tool destinations. This prevents a
// tutorial from passing authority to a different tool page or to another guide.
// `/app/create...` is the same product workspace action and is allowed.
export const OWN_LINKS = {
  "/guides/how-do-url-to-video": ["/ai-video-generation", "/ai-video-generation/url-to-video"],
  "/guides/how-do-image-to-video": ["/ai-video-generation/image-to-video"],
  "/guides/how-do-text-to-video": ["/ai-video-generation/text-to-video"],
  "/guides/how-do-ai-video": ["/ai-video-generation"],
  "/guides/how-do-ai-image": ["/ai-image-generation", "/ai-image-generation/lifestyle-photos"],
  "/guides/how-do-ai-avatar": ["/ai-video-generation/spokesperson-video"],
  "/guides/how-do-product-links": ["/ai-video-generation/product-video"],
  "/guides/how-do-subtitle-studio": ["/ai-video-generation/video-ads"],
  "/guides/first-tiktok-video-ad": ["/ai-video-generation", "/ai-video-generation/video-ads"],
  "/guides/product-photo-tips": ["/ai-image-generation"],
  "/guides/testing-ad-versions": ["/ai-video-generation", "/ai-video-generation/video-ads"],
  "/guides/white-background-amazon": ["/ai-image-generation", "/ai-image-generation/white-background-photos"],
  "/guides/ad-sizes-by-platform": ["/ai-video-generation", "/ai-video-generation/video-ads"]
};

// The workspace guide's hub card uses the detail-page H1 as well.
export const HUB_WORKSPACE_TITLE = "AI Video Workspace Tutorial: Step-by-Step Guide";

// Rewrite the remaining cross-tool suggestions so a guide never tells the
// reader to use a page it deliberately does not link to. Each `from` is the
// exact current string on the published row.
export const COPY_REPLACEMENTS = [
  {
    slug: "/guides/how-do-url-to-video",
    from: "URL to Video starts from one public product page and opens an editable video draft. A draft is an editable plan; nothing is generated until you choose. Use Product Links when you want to keep a product entry for repeated use.",
    to: "URL to Video starts from one public product page and opens an editable video draft. A draft is an editable plan; nothing is generated until you choose. Use this workflow when you need one draft from one page; a saved-product library is a separate workflow."
  },
  {
    slug: "/guides/how-do-url-to-video",
    from: "When should I use Product Links?",
    to: "When should I keep a product entry for reuse?"
  },
  {
    slug: "/guides/how-do-url-to-video",
    from: "Use Product Links when you want to confirm a product entry and reuse it later. URL to Video is the direct route into one video draft.",
    to: "Use the saved-product workflow when you want to reuse a confirmed product entry. URL to Video is the direct route into one video draft."
  },
  {
    slug: "/guides/how-do-url-to-video",
    from: "upload product photos through AI Video.",
    to: "start from your own product photos in a separate video workflow."
  },
  {
    slug: "/guides/how-do-image-to-video",
    from: "For several reference photos and a broader scene, use AI Video.",
    to: "For several reference photos and a broader scene, use a separate multi-reference workflow."
  },
  {
    slug: "/guides/how-do-image-to-video",
    from: "This walkthrough uses one photo because Image to Video is the single-image route. Use AI Video when you need several product references.",
    to: "This walkthrough uses one photo because Image to Video is the single-image route. A multi-reference workflow is a separate guide."
  },
  {
    slug: "/guides/how-do-text-to-video",
    from: "If you want to build from product photos, compare it with AI Video; if you are starting from a public listing, use URL to Video.",
    to: "If you want to build from product photos, a multi-reference workflow is a separate guide; if you are starting from a public listing, a one-page import workflow is separate."
  },
  {
    slug: "/guides/how-do-ai-image",
    from: "If you need movement, use Image to Video; if you need a clean white main image, choose the matching image tool.",
    to: "If you need movement, animation is a separate workflow; if you need a clean white main image, choose the matching image preset."
  },
  {
    slug: "/guides/how-do-ai-image",
    from: "No. AI Image creates still images. Use Image to Video when you want to animate a single photo.",
    to: "No. AI Image creates still images. Animation is a separate workflow."
  },
  {
    slug: "/guides/how-do-product-links",
    from: "Product Links keeps a library of saved products: confirm a product page once, then select it again when you start another video. Use URL to Video when you only want to import one page into a draft.",
    to: "Product Links keeps a library of saved products: confirm a product page once, then select it again when you start another video. Use it when you want to reuse a confirmed product; a one-page import is a separate workflow."
  },
  {
    slug: "/guides/how-do-product-links",
    from: "When should I use URL to Video instead?",
    to: "When should I import one page into a draft instead?"
  },
  {
    slug: "/guides/how-do-product-links",
    from: "Use URL to Video when you want to import a product page into one editable video draft rather than keep it in a reusable library.",
    to: "Use the one-page import workflow when you want a single editable video draft rather than a reusable library."
  },
  {
    slug: "/guides/how-do-product-links",
    from: "start from product photos in AI Video; do not describe an unverified import as saved.",
    to: "start from your own product photos in a separate video workflow; do not describe an unverified import as saved."
  },
  {
    slug: "/guides/how-do-subtitle-studio",
    from: "If the video itself needs a new scene, return to AI Video or AI Avatar first.",
    to: "If the video itself needs a new scene, edit the source video in a separate video workflow first."
  },
  {
    slug: "/guides/how-do-ai-avatar",
    from: "For a clip that should move without a presenter, use Image to Video; for a broader scene built from product references, use AI Video.",
    to: "For a clip without a presenter, animation is a separate workflow; for a broader scene built from product references, a multi-reference workflow is separate."
  },
  {
    slug: "/guides/how-do-ai-video",
    from: "It is different from Text to Video, which starts from words, and Image to Video, which starts from one photo and one movement.",
    to: "It is different from a text-only brief, which starts from words, and a single-photo workflow, which starts from one image and one movement."
  },
  {
    slug: "/guides/how-do-ai-video",
    from: "How is AI Video different from Image to Video?",
    to: "How is AI Video different from a single-photo workflow?"
  },
  {
    slug: "/guides/how-do-ai-video",
    from: "AI Video uses product references with a broader scene description. Image to Video starts with one photo and a specific motion prompt.",
    to: "AI Video uses product references with a broader scene description. A single-photo workflow starts with one image and a specific motion prompt."
  }
];
