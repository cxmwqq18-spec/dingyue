export type AidreamcapesNavItem = { label: string; href: string };
export type AidreamcapesNavGroup = { label: string; items: AidreamcapesNavItem[] };

export const aidreamcapesZipVideoGroups: AidreamcapesNavGroup[] = [
  { label: "Ads Testing", items: [
    { label: "UGC Product Ad", href: "/ai-video-generation/ugc-ad-video" },
    { label: "URL to Ad", href: "/ai-video-generation/product-ad-video" },
    { label: "Hook Lab (First 3s)", href: "/ai-video-generation/video-ad" },
    { label: "PAS Formula Ads", href: "/ai-video-generation/product-ad-video" },
    { label: "Testimonial Ads", href: "/ai-video-generation/video-ad" },
    { label: "Before-After Showcases", href: "/ai-video-generation/product-ad-video" },
    { label: "Talking Photo Recs", href: "/ai-video-generation/talking-photo" },
    { label: "AI Actor Product Ads", href: "/ai-video-generation/talking-head-video" },
    { label: "TikTok / Reels / Shorts", href: "/ai-video-generation/tiktok-video" },
    { label: "Native Spark Ads", href: "/ai-video-generation/video-ad" },
    { label: "Carousel Storytelling", href: "/ai-video-generation/story-video" },
    { label: "Retargeting / Urgency", href: "/ai-video-generation/product-ad-video" }
  ] },
  { label: "Conversion / Seeding", items: [
    { label: "Product Demo", href: "/ai-video-generation/product-video" },
    { label: "Unboxing Experience", href: "/ai-video-generation/product-video" },
    { label: "How-to Tutorial", href: "/ai-video-generation/how-to-video" },
    { label: "Feature Callout", href: "/ai-video-generation/product-video" },
    { label: "Competitor Comparison", href: "/ai-video-generation/product-ad-video" },
    { label: "Social Proof Animation", href: "/ai-video-generation/video-ad" },
    { label: "Duet / Reaction", href: "/ai-video-generation/social-media-video" },
    { label: "Green Screen Speaking", href: "/ai-video-generation/talking-head-video" }
  ] },
  { label: "Promo / Category", items: [
    { label: "Promo / Launch / Sale", href: "/ai-video-generation/promo-video" },
    { label: "Black Friday Countdown", href: "/ai-video-generation/promo-video" },
    { label: "Limited Drop Alert", href: "/ai-video-generation/promo-video" },
    { label: "Discount & Free Shipping", href: "/ai-video-generation/product-ad-video" },
    { label: "Beauty Routine", href: "/ai-video-generation/ugc-ad-video" },
    { label: "Supplement Highlight", href: "/ai-video-generation/product-video" },
    { label: "Fashion Try-On Reel", href: "/ai-video-generation/fashion-video" },
    { label: "Food & Beverage", href: "/ai-video-generation/food-video" },
    { label: "Home Organization", href: "/ai-video-generation/product-video" },
    { label: "App / SaaS Demo", href: "/ai-video-generation/explainer-video" },
    { label: "Local Service Ad", href: "/ai-video-generation/video-ad" }
  ] },
  { label: "Brand / Creator", items: [
    { label: "Founder Update", href: "/ai-video-generation/talking-head-video" },
    { label: "Localization (Multi-language)", href: "/ai-video-generation/talking-head-video" },
    { label: "Cinematic Product Film", href: "/ai-video-generation/cinematic-video" },
    { label: "Trending Audio Sync", href: "/ai-video-generation/music-video" }
  ] }
];

export const aidreamcapesZipImageGroups: AidreamcapesNavGroup[] = [
  { label: "Listing / Store", items: [
    { label: "Ecommerce Main Image", href: "/ai-image-generation" },
    { label: "Lifestyle Scene", href: "/ai-image-generation/rich-lifestyle" },
    { label: "Packshot Multi-angle", href: "/ai-image-generation" },
    { label: "Macro Details", href: "/ai-image-generation" },
    { label: "Bundle Sets", href: "/ai-image-generation" },
    { label: "Size Reference", href: "/ai-image-generation" },
    { label: "Feature Infographic", href: "/ai-image-generation/social-cards" },
    { label: "Comparison Chart", href: "/ai-image-generation/social-cards" }
  ] },
  { label: "Static Ads / Feed", items: [
    { label: "Feed Ad Still", href: "/ai-image-generation/social-cards" },
    { label: "UGC Still Ad", href: "/ai-image-generation/social-cards" },
    { label: "Story 9:16 Ad", href: "/ai-image-generation/social-cards" },
    { label: "Carousel Set", href: "/ai-image-generation/social-cards" },
    { label: "Sale / BF Key Visual", href: "/ai-image-generation/black-friday" },
    { label: "Lookbook Cover", href: "/ai-image-generation/street-style" }
  ] },
  { label: "Model / Try-On", items: [
    { label: "On-Model Generation", href: "/ai-image-generation/virtual-try-on" },
    { label: "Virtual Try-On", href: "/ai-image-generation/virtual-try-on" },
    { label: "Hair / Makeup Preview", href: "/ai-image-generation/hairstyle-generator" },
    { label: "Jewelry Positioning", href: "/ai-image-generation/edit-by-prompt" },
    { label: "Ghost Mannequin", href: "/ai-image-generation/background-remover" },
    { label: "Colorway Variations", href: "/ai-image-generation/edit-by-prompt" }
  ] },
  { label: "AI Tools", items: [
    { label: "Background Remove / Replace", href: "/ai-image-generation/background-remover" },
    { label: "Enhance / Upscale", href: "/ai-image-generation/photo-enhancer" },
    { label: "Old Photo Restore", href: "/ai-image-generation/old-photo-restoration" },
    { label: "Commercial Lighting", href: "/ai-image-generation/edit-by-prompt" },
    { label: "Packaging Mockup", href: "/ai-image-generation/edit-by-prompt" }
  ] },
  { label: "Portrait / Brand", items: [
    { label: "Professional Headshot", href: "/ai-image-generation/headshot" },
    { label: "Creator Portrait", href: "/ai-image-generation/avatar" },
    { label: "Team Directory", href: "/ai-image-generation/headshot" },
    { label: "Social / Dating Profile", href: "/ai-image-generation/portrait-photo" },
    { label: "Fashion Editorial", href: "/ai-image-generation/street-style" }
  ] }
];

export const aidreamcapesZipMarketingGroups: AidreamcapesNavGroup[] = [
  { label: "Ad Testing", items: [
    { label: "UGC Ads", href: "/ai-video-generation/ugc-ad-video" },
    { label: "URL to Ad", href: "/ai-video-generation/product-ad-video" },
    { label: "Hook Lab", href: "/ai-video-generation/video-ad" },
    { label: "Testimonial Ads", href: "/ai-video-generation/video-ad" },
    { label: "Before-After Ads", href: "/ai-video-generation/product-ad-video" },
    { label: "Actors & Talking", href: "/ai-video-generation/talking-head-video" }
  ] },
  { label: "Product Videos", items: [
    { label: "Product Demo", href: "/ai-video-generation/product-video" },
    { label: "Unboxing", href: "/ai-video-generation/product-video" },
    { label: "How-to Guide", href: "/ai-video-generation/how-to-video" }
  ] },
  { label: "Listing Stills", items: [
    { label: "Main Image", href: "/ai-image-generation" },
    { label: "Lifestyle Scene", href: "/ai-image-generation/rich-lifestyle" },
    { label: "Packshot", href: "/ai-image-generation" },
    { label: "Feed / Story Static Ad", href: "/ai-image-generation/social-cards" }
  ] },
  { label: "Promo", items: [
    { label: "Launch / Sale", href: "/ai-video-generation/promo-video" },
    { label: "Black Friday", href: "/ai-image-generation/black-friday" },
    { label: "Drop Campaign", href: "/ai-video-generation/promo-video" }
  ] },
  { label: "Catalog / Try-On", items: [
    { label: "On-Model", href: "/ai-image-generation/virtual-try-on" },
    { label: "Virtual Try-On", href: "/ai-image-generation/virtual-try-on" },
    { label: "App / SaaS Ads", href: "/ai-video-generation/video-ad" }
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
export const aidreamcapesZipMarketingCollection: AidreamcapesNavItem = { label: "Open Marketing Hub →", href: "/ai-video-generation/product-ad-video" };
export const aidreamcapesZipScenarioCollection: AidreamcapesNavItem = { label: "View all scenarios →", href: "/ai-save-the-date/save-the-date" };

export const aidreamcapesZipFooterGroups: AidreamcapesNavGroup[] = [
  { label: "Product", items: [
    { label: "AI Video", href: "/ai-video-generation" },
    { label: "AI Image", href: "/ai-image-generation" },
    { label: "Marketing Hub", href: "/ai-video-generation/product-ad-video" },
    { label: "Pricing", href: "/pricing" }
  ] },
  { label: "Resources", items: [
    { label: "Workflow", href: "/workflow" },
    { label: "Prompt Guide", href: "/workflow" },
    { label: "Affiliate Program", href: "/creators-circle" },
    { label: "Blog", href: "/blog" }
  ] },
  { label: "Company", items: [
    { label: "About Us", href: "/about-us" },
    { label: "Contact Us", href: "/contact-us" },
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" }
  ] }
];
