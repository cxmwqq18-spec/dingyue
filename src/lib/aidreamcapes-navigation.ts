export type AidreamcapesNavItem = { label: string; href: string };
export type AidreamcapesNavGroup = { label: string; items: AidreamcapesNavItem[] };

export const aidreamcapesZipVideoGroups: AidreamcapesNavGroup[] = [
  { label: "Ads Testing", items: [
    { label: "UGC Product Ad", href: "/ai-video-generation/ugc-ad-video" },
    { label: "URL to Ad", href: "/ai-video-generation/url-to-ad" },
    { label: "Hook Lab (First 3s)", href: "/ai-video-generation/hook-lab" },
    { label: "PAS Formula Ads", href: "/ai-video-generation/pas-formula-ads" },
    { label: "Testimonial Ads", href: "/ai-video-generation/testimonial-ads" },
    { label: "Before-After Showcases", href: "/ai-video-generation/before-after-showcases" },
    { label: "Talking Photo Recs", href: "/ai-video-generation/talking-photo-recs" },
    { label: "AI Actor Product Ads", href: "/ai-video-generation/ai-actor-product-ads" },
    { label: "TikTok / Reels / Shorts", href: "/ai-video-generation/tiktok-reels-shorts" },
    { label: "Native Spark Ads", href: "/ai-video-generation/native-spark-ads" },
    { label: "Carousel Storytelling", href: "/ai-video-generation/carousel-storytelling" },
    { label: "Retargeting / Urgency", href: "/ai-video-generation/retargeting-urgency" }
  ] },
  { label: "Conversion / Seeding", items: [
    { label: "Product Demo", href: "/ai-video-generation/product-video" },
    { label: "Unboxing Experience", href: "/ai-video-generation/unboxing-experience" },
    { label: "How-to Tutorial", href: "/ai-video-generation/how-to-video" },
    { label: "Feature Callout", href: "/ai-video-generation/feature-callout" },
    { label: "Competitor Comparison", href: "/ai-video-generation/competitor-comparison" },
    { label: "Social Proof Animation", href: "/ai-video-generation/social-proof-animation" },
    { label: "Duet / Reaction", href: "/ai-video-generation/duet-reaction" },
    { label: "Green Screen Speaking", href: "/ai-video-generation/green-screen-speaking" }
  ] },
  { label: "Promo / Category", items: [
    { label: "Promo / Launch / Sale", href: "/ai-video-generation/promo-video" },
    { label: "Black Friday Countdown", href: "/ai-video-generation/black-friday-countdown" },
    { label: "Limited Drop Alert", href: "/ai-video-generation/limited-drop-alert" },
    { label: "Discount & Free Shipping", href: "/ai-video-generation/discount-free-shipping" },
    { label: "Beauty Routine", href: "/ai-video-generation/beauty-routine" },
    { label: "Supplement Highlight", href: "/ai-video-generation/supplement-highlight" },
    { label: "Fashion Try-On Reel", href: "/ai-video-generation/fashion-try-on-reel" },
    { label: "Food & Beverage", href: "/ai-video-generation/food-video" },
    { label: "Home Organization", href: "/ai-video-generation/home-organization" },
    { label: "App / SaaS Demo", href: "/ai-video-generation/app-saas-demo" },
    { label: "Local Service Ad", href: "/ai-video-generation/local-service-ad" }
  ] },
  { label: "Brand / Creator", items: [
    { label: "Founder Update", href: "/ai-video-generation/founder-update" },
    { label: "Localization (Multi-language)", href: "/ai-video-generation/multilingual-video" },
    { label: "Cinematic Product Film", href: "/ai-video-generation/cinematic-video" },
    { label: "Trending Audio Sync", href: "/ai-video-generation/music-video" }
  ] }
];

// The public .com video directory is the source of truth for Aidreamcapes
// video detail routes. Keep route parsing and sitemap generation aligned with
// the visible directory instead of accepting arbitrary historical database
// slugs.
// Aidreamcapes.com v2 (2026-10): the public video detail routes are the v2 tool and
// template pages. Retired v1 topics are answered by 301 redirects in the middleware.
export const AIDREAMCAPES_PUBLIC_AI_VIDEO_GENERATION_SLUGS = [
  "image-to-video",
  "url-to-video",
  "ugc-ad-video",
  "product-video",
  "unboxing-experience",
  "before-after-showcases",
  "ai-actor-product-ads",
  "how-to-video",
  "cinematic-video",
  "beauty-routine",
  "food-video",
  "home-organization",
  "fashion-try-on-reel",
  "promo-video",
  "competitor-comparison",
  "black-friday-countdown",
  "limited-drop-alert-video",
  "product-feature-callout-video",
  "carousel-video-ad",
  "spark-ads-style-video",
  "retargeting-video-ad"
];

export function isAidreamcapesPublicVideoGenerationSlug(slug: string | undefined): boolean {
  return Boolean(slug && AIDREAMCAPES_PUBLIC_AI_VIDEO_GENERATION_SLUGS.includes(slug));
}

export const aidreamcapesZipImageGroups: AidreamcapesNavGroup[] = [
  { label: "Listing / Store", items: [
    { label: "Ecommerce Main Image", href: "/ai-image-generation/ecommerce-main-image" },
    { label: "Lifestyle Scene", href: "/ai-image-generation/lifestyle-scene" },
    { label: "Packshot Multi-angle", href: "/ai-image-generation/packshot-multi-angle" },
    { label: "Macro Details", href: "/ai-image-generation/macro-details" },
    { label: "Bundle Sets", href: "/ai-image-generation/bundle-sets" },
    { label: "Size Reference", href: "/ai-image-generation/size-reference" },
    { label: "Feature Infographic", href: "/ai-image-generation/feature-infographic" },
    { label: "Comparison Chart", href: "/ai-image-generation/comparison-chart" }
  ] },
  { label: "Static Ads / Feed", items: [
    { label: "Feed Ad Still", href: "/ai-image-generation/feed-ad-still" },
    { label: "UGC Still Ad", href: "/ai-image-generation/ugc-still-ad" },
    { label: "Story 9:16 Ad", href: "/ai-image-generation/story-ad-vertical" },
    { label: "Carousel Set", href: "/ai-image-generation/carousel-set" },
    { label: "Sale / BF Key Visual", href: "/ai-image-generation/sale-campaign-key-visual" },
    { label: "Lookbook Cover", href: "/ai-image-generation/lookbook-cover" }
  ] },
  { label: "Model / Try-On", items: [
    { label: "On-Model Generation", href: "/ai-image-generation/on-model-generation" },
    { label: "Virtual Try-On", href: "/ai-image-generation/virtual-try-on" },
    { label: "Hair / Makeup Preview", href: "/ai-image-generation/hair-makeup-preview" },
    { label: "Jewelry Positioning", href: "/ai-image-generation/jewelry-positioning" },
    { label: "Ghost Mannequin", href: "/ai-image-generation/ghost-mannequin" },
    { label: "Colorway Variations", href: "/ai-image-generation/colorway-variations" }
  ] },
  { label: "AI Tools", items: [
    { label: "Background Remove / Replace", href: "/ai-image-generation/background-remove-replace" },
    { label: "Enhance / Upscale", href: "/ai-image-generation/enhance-upscale" },
    { label: "Old Photo Restore", href: "/ai-image-generation/old-photo-restore" },
    { label: "Commercial Lighting", href: "/ai-image-generation/commercial-lighting" },
    { label: "Packaging Mockup", href: "/ai-image-generation/packaging-mockup" }
  ] },
  { label: "Portrait / Brand", items: [
    { label: "Professional Headshot", href: "/ai-image-generation/professional-headshot" },
    { label: "Creator Portrait", href: "/ai-image-generation/creator-portrait" },
    { label: "Team Directory", href: "/ai-image-generation/team-directory" },
    { label: "Social / Dating Profile", href: "/ai-image-generation/social-profile-photo" },
    { label: "Fashion Editorial", href: "/ai-image-generation/fashion-editorial" }
  ] }
];

export const aidreamcapesZipMarketingGroups: AidreamcapesNavGroup[] = [
  { label: "Ad Testing", items: [
    { label: "UGC Ads", href: "/ai-video-generation/ugc-ad-video" },
    { label: "URL to Ad", href: "/ai-video-generation/url-to-ad" },
    { label: "Hook Lab", href: "/ai-video-generation/hook-lab" },
    { label: "Testimonial Ads", href: "/ai-video-generation/testimonial-ads" },
    { label: "Before-After Ads", href: "/ai-video-generation/before-after-showcases" },
    { label: "Actors & Talking", href: "/ai-video-generation/ai-actor-product-ads" }
  ] },
  { label: "Product Videos", items: [
    { label: "Product Demo", href: "/ai-video-generation/product-video" },
    { label: "Unboxing", href: "/ai-video-generation/unboxing-experience" },
    { label: "How-to Guide", href: "/ai-video-generation/how-to-video" }
  ] },
  { label: "Listing Stills", items: [
    { label: "Main Image", href: "/ai-image-generation/ecommerce-main-image" },
    { label: "Lifestyle Scene", href: "/ai-image-generation/lifestyle-scene" },
    { label: "Packshot", href: "/ai-image-generation/packshot-multi-angle" },
    { label: "Feed / Story Static Ad", href: "/ai-image-generation/feed-ad-still" }
  ] },
  { label: "Promo", items: [
    { label: "Launch / Sale", href: "/ai-video-generation/promo-video" },
    { label: "Black Friday", href: "/ai-image-generation/sale-campaign-key-visual" },
    { label: "Drop Campaign", href: "/ai-video-generation/promo-video" }
  ] },
  { label: "Catalog / Try-On", items: [
    { label: "On-Model", href: "/ai-image-generation/on-model-generation" },
    { label: "Virtual Try-On", href: "/ai-image-generation/virtual-try-on" },
    { label: "App / SaaS Ads", href: "/ai-video-generation/app-saas-demo" }
  ] }
];

export const aidreamcapesZipScenarioGroups: AidreamcapesNavGroup[] = [
  { label: "Love & Wedding", items: [
    { label: "Engagement", href: "/ai-save-the-date/engagement" },
    { label: "Proposal", href: "/ai-save-the-date/proposal" },
    { label: "Wedding", href: "/ai-save-the-date/wedding-invitation" }
  ] },
  { label: "Celebrate", items: [
    { label: "Birthday", href: "/ai-save-the-date/birthday" },
    { label: "Anniversary", href: "/ai-save-the-date/wedding-anniversary" },
    { label: "Thank You", href: "/ai-save-the-date/thank-you" }
  ] },
  { label: "Seasonal", items: [
    { label: "Christmas / Holiday", href: "/ai-save-the-date/christmas" },
    { label: "Valentine's Day", href: "/ai-save-the-date/valentines-day" },
    { label: "Halloween", href: "/ai-save-the-date/halloween" },
    { label: "Thanksgiving", href: "/ai-save-the-date/thanksgiving" },
    { label: "Mother's Day", href: "/ai-save-the-date/mothers-day" },
    { label: "Father's Day", href: "/ai-save-the-date/fathers-day" }
  ] }
];

export const aidreamcapesZipVideoCollection: AidreamcapesNavItem = { label: "View all video →", href: "/ai-video-generation" };
export const aidreamcapesZipImageCollection: AidreamcapesNavItem = { label: "View all photo →", href: "/ai-image-generation" };
export const aidreamcapesZipMarketingCollection: AidreamcapesNavItem = { label: "Open Marketing Hub →", href: "/marketing" };
export const aidreamcapesZipScenarioCollection: AidreamcapesNavItem = { label: "View all scenarios →", href: "/ai-save-the-date/save-the-date" };

export const aidreamcapesZipFooterGroups: AidreamcapesNavGroup[] = [
  { label: "Product", items: [
    { label: "AI Video", href: "/ai-video-generation" },
    { label: "AI Image", href: "/ai-image-generation" },
    { label: "Marketing Hub", href: "/marketing" },
    { label: "Pricing", href: "/pricing" }
  ] },
  { label: "Resources", items: [
    { label: "Workflow", href: "/workflow" },
    { label: "Affiliate Program", href: "/creators-circle" },
    { label: "Blog", href: "/blog" }
  ] },
  { label: "Company", items: [
    { label: "About Us", href: "/about-us" },
    { label: "Contact Us", href: "/contact-us" }
  ] },
  { label: "Support", items: [
    { label: "Refund Policy", href: "/refunds" },
    { label: "Digital Delivery Policy", href: "/digital-delivery" },
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Content Policy", href: "/content" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Cookie Policy", href: "/cookies" }
  ] }
];
