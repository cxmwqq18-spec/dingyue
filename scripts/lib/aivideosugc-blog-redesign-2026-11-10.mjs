// AIVideosUGC blog redesign — five articles rewritten against the current
// workspace (2026-11-10). Content-only release: slugs, covers and inline
// images stay exactly as published; each article gains a teaching opener,
// embedded real example clips (section.video) and refreshed SEO copy.
//
// Media facts (all verified 2026-11-10):
//   - preview clips (-p10.mp4) exist in public/ai-video-generation/
//   - full clips are served in production (referenced by live tool pages)
//   - posters exist via public/image/ + the /ai-image-generation asset route
//   - example detail pages resolve from directory card data (card projection)

export const APPLY_DATE = "2026-11-10";
// JSON-LD wants full ISO 8601 datetimes with a timezone; Google reports a bare
// date for VideoObject.uploadDate as missing the timezone information.
export const APPLY_DATETIME = "2026-11-10T00:00:00Z";
// First public release date of the example clips (media inventory 2026-11-01).
// Google requires a full ISO 8601 datetime with a timezone for
// VideoObject.uploadDate; a bare date is reported as missing the timezone.
export const VIDEO_UPLOAD_DATE = "2026-11-01T00:00:00Z";
// Example clip table keyed for the apply script's JSON-LD lookup.
export { CLIPS };

const V = {
  notebook: {
    src: "/ai-video-generation/green-notebook-desk-ritual.mp4",
    previewSrc: "/ai-video-generation/green-notebook-desk-ritual-p10.mp4",
    poster: "/ai-image-generation/green-notebook-desk-ritual-640.webp",
    alt: "At a wooden desk she pairs a green notebook with its pen and shows the layout she uses to plan her week.",
    width: 1080, height: 1920, duration: 30,
    href: "/ai-video-generation/green-notebook-desk-ritual",
    label: "Green Notebook Desk Ritual"
  },
  frother: {
    src: "/ai-video-generation/black-milk-frother-morning-demo.mp4",
    previewSrc: "/ai-video-generation/black-milk-frother-morning-demo-p10.mp4",
    poster: "/ai-image-generation/black-milk-frother-morning-demo-640.webp",
    alt: "She froths milk in a black handheld frother and pours a cafe-style foam over her morning coffee at the kitchen counter.",
    width: 720, height: 1280, duration: 29,
    href: "/ai-video-generation/black-milk-frother-morning-demo",
    label: "Black Milk Frother Morning Demo"
  },
  ring: {
    src: "/ai-video-generation/silver-magnetic-ring-snap-on-demo.mp4",
    previewSrc: "/ai-video-generation/silver-magnetic-ring-snap-on-demo-p10.mp4",
    poster: "/ai-image-generation/silver-magnetic-ring-snap-on-demo-640.webp",
    alt: "The same silver magnetic ring grip in a second desk take: the snap-on moment, the stand angle and a one-handed scroll, closer to the product.",
    width: 1080, height: 1920, duration: 30,
    href: "/ai-video-generation/silver-magnetic-ring-snap-on-demo",
    label: "Silver Magnetic Ring Snap-On Demo"
  },
  fabric: {
    src: "/ai-video-generation/washed-graphic-tee-fabric-close-up.mp4",
    previewSrc: "/ai-video-generation/washed-graphic-tee-fabric-close-up-p10.mp4",
    poster: "/ai-image-generation/washed-graphic-tee-fabric-close-up-640.webp",
    alt: "A second bedroom session with the washed-graphic cotton tee, this time lingering on the faded sunset print and the softness of the washed cotton.",
    width: 1080, height: 1920, duration: 30,
    href: "/ai-video-generation/washed-graphic-tee-fabric-close-up",
    label: "Washed Graphic Tee Fabric Close-Up"
  },
  beforeAfter: {
    src: "/ai-video-generation/cable-organizer-desk-before-after.mp4",
    previewSrc: "/ai-video-generation/cable-organizer-desk-before-after-p10.mp4",
    poster: "/ai-image-generation/cable-organizer-desk-before-after-640.webp",
    alt: "A tangle of charging cables behind the desk becomes one clipped, labeled setup with a cable organizer kit.",
    width: 1080, height: 1920, duration: 30,
    href: "/ai-video-generation/cable-organizer-desk-before-after",
    label: "Cable Organizer Desk Before After"
  },
  sealedBox: {
    src: "/ai-video-generation/sealed-box-order-unboxing.mp4",
    previewSrc: "/ai-video-generation/sealed-box-order-unboxing-p10.mp4",
    poster: "/ai-image-generation/sealed-box-order-unboxing-640.webp",
    alt: "On her living-room table she slices open a sealed shipping box she has waited all week for and lifts the first item out.",
    width: 1080, height: 1920, duration: 30,
    href: "/ai-video-generation/sealed-box-order-unboxing",
    label: "Sealed Box Order Unboxing"
  },
  powerBank: {
    src: "/ai-video-generation/magnetic-power-bank-snap-on-unboxing.mp4",
    previewSrc: "/ai-video-generation/magnetic-power-bank-snap-on-unboxing-p10.mp4",
    poster: "/ai-image-generation/magnetic-power-bank-snap-on-unboxing-640.webp",
    alt: "A second desk unboxing for the slim lavender magnetic power bank, with a tighter shot of it snapping onto the back of the phone.",
    width: 1080, height: 1920, duration: 30,
    href: "/ai-video-generation/magnetic-power-bank-snap-on-unboxing",
    label: "Magnetic Power Bank Snap-On Unboxing"
  },
  teeFit: {
    src: "/ai-video-generation/washed-graphic-tee-fit-check.mp4",
    previewSrc: "/ai-video-generation/washed-graphic-tee-fit-check-p10.mp4",
    poster: "/ai-image-generation/washed-graphic-tee-fit-check-640.webp",
    alt: "A short-haired creator shows off a washed-graphic cotton tee in her bedroom: fit check, fabric close-up, tucked and untucked styling, ending on her cart link.",
    width: 1080, height: 1920, duration: 30,
    href: "/ai-video-generation/washed-graphic-tee-fit-check",
    label: "Washed Graphic Tee Fit Check"
  },
  cardigan: {
    src: "/ai-video-generation/cream-chunky-cardigan-two-ways.mp4",
    previewSrc: "/ai-video-generation/cream-chunky-cardigan-two-ways-p10.mp4",
    poster: "/ai-image-generation/cream-chunky-cardigan-two-ways-640.webp",
    alt: "In front of a full-length mirror she styles a cream chunky-knit cardigan two ways: open over a tee, then belted.",
    width: 720, height: 1280, duration: 30,
    href: "/ai-video-generation/cream-chunky-cardigan-two-ways",
    label: "Cream Chunky Cardigan Two Ways"
  }
};

const CLIPS = V;

function video(key, caption) {
  const v = V[key];
  return { ...v, caption };
}

// Section images are referenced by their existing src; the apply script
// resolves each to the full V2Image (alt/sizes/srcSet) from the live row so
// nothing about the published media contract changes.
const IMG = {
  photoSocialScene: "/ai-image-generation/fx04-blog-photo-social-scene-r1-640.webp",
  photoSourceClear: "/ai-image-generation/fx04-blog-photo-source-clear-r1-640.webp",
  photoLookCafe: "/ai-image-generation/fx04-blog-photo-look-cafe-r1-640.webp",
  photoShopScene: "/ai-image-generation/fx04-blog-photo-shop-scene-r1-640.webp",
  photoMarketplace: "/ai-image-generation/fx04-blog-photo-marketplace-r1-640.webp",
  photoReview: "/ai-image-generation/fx04-blog-photo-review-r1-640.webp",
  ugcDefinition: "/ai-image-generation/fx04-blog-ugc-definition-r1-640.webp",
  ugcVertical: "/ai-image-generation/img2-blog-ai-ugc-video-ads-guide-1-r1-640.webp",
  ugcScene: "/ai-image-generation/fx04-blog-ugc-scene-r1-640.webp",
  ugcHook: "/ai-image-generation/fx04-blog-ugc-hook-r1-640.webp",
  ugcLength: "/ai-image-generation/fx04-blog-ugc-length-r1-640.webp",
  ugcEdit: "/ai-image-generation/fx04-blog-ugc-edit-r1-640.webp",
  reviewRules: "/ai-image-generation/b2f12-blog-review-rules-r1-640.webp",
  reviewWhy: "/ai-image-generation/fx04-blog-review-why-r2-640.webp",
  reviewProduct: "/ai-image-generation/fx04-blog-review-product-r1-640.webp",
  reviewMotion: "/ai-image-generation/fx04-blog-review-motion-r1-640.webp",
  reviewCopy: "/ai-image-generation/fx04-blog-review-copy-r1-640.webp",
  reviewRights: "/ai-image-generation/fx04-blog-review-rights-r1-640.webp",
  unboxDetails: "/ai-image-generation/fx05-unbox-details-640.webp",
  unboxClips: "/ai-image-generation/fx05-unbox-clips-640.webp",
  unboxReady: "/ai-image-generation/fx05-unbox-ready-640.webp",
  unboxSentence: "/ai-image-generation/fx05-unbox-sentence-640.webp",
  unboxAfter: "/ai-image-generation/fx05-unbox-after-640.webp",
  modelWork: "/ai-image-generation/fx05-model-work-640.webp",
  modelWhen: "/ai-image-generation/fx05-model-when-640.webp",
  modelGarment: "/ai-image-generation/fx05-model-garment-640.webp",
  modelFit: "/ai-image-generation/fx05-model-fit-640.webp",
  modelSetting: "/ai-image-generation/fx05-model-setting-640.webp"
};

const START_NOTE = "[Plans from $24.50 a month](/pricing). You see the credit cost before every job, and if a job fails its credits go back to your balance.";

export const ARTICLES = [
  // ────────────────────────────────────────────────────────────────────────
  {
    slug: "/blog/ai-product-photography-guide",
    h1: "AI Product Photo Generator: Listings and Scenes",
    label: "AI Product Photo Generator",
    seo: {
      title: "AI Product Photo Generator: Listings and Scenes | AIVideosUGC",
      description: "Turn one product photo into white-background listing shots, lifestyle scenes, model photos and social ads — and see a real example move. Costs shown before every job.",
      primaryKeyword: "AI Product Photo Generator Guide"
    },
    data: {
      eyebrow: "One Photo, One Full Listing Set",
      lead: "Start from one product photo. The AI Image workspace turns it into white-background listing shots, lifestyle scenes, model photos and social ads — the five image types a full listing needs.",
      minutes: 5,
      sections: [
        {
          h2: "What This Guide Covers",
          paras: [
            "This guide walks the photo half of the workspace: what the five image tools make, what one product photo can cover, and the checks that keep a generated photo safe to publish. Every tool runs on the same three steps — upload, describe, download — and every job shows its credit cost before it starts.",
            "By the end you'll know which tool fills which slot on your listing, what a photo costs, and what to look at before it goes live."
          ]
        },
        {
          h2: "One Photo Starts the Whole Set",
          img: IMG.photoSourceClear,
          paras: [
            "Open the AI Image tool in your workspace, upload one photo of your product, and describe the shot you want. The generator keeps the shape, the color and the visible details from your reference photo, then places the product in the scene you described.",
            "Every image costs 24 credits, and the exact cost shows before the job starts. If a job fails, the credits go back to your balance. The same photo can run through a different scene in the next minute — no booking, no props, no reshoot."
          ]
        },
        {
          h2: "Five Photo Tools Cover a Full Listing",
          img: IMG.photoLookCafe,
          paras: [
            "The workspace groups product images into five tools. [White background photos](/ai-image-generation/white-background-photos) give you the clean main image marketplaces expect. [Lifestyle photos](/ai-image-generation/lifestyle-photos) place the product in a real scene — a cafe table, a kitchen counter, a desk by the window. [Change background](/ai-image-generation/change-background) keeps the product untouched and swaps only what is behind it.",
            "[Model photos](/ai-image-generation/model-photos) put clothes and accessories on a reusable AI model, and [social ad photos](/ai-image-generation/social-ad-photos) style images for Facebook and Instagram placements. Start with whichever photo your listing is missing today; the same product photo feeds all five."
          ]
        },
        {
          h2: "Make a Product Photo in Three Steps",
          paras: [
            "Upload one clear photo of your product — daylight, plain background, shot from the front works best. Describe the scene in one or two sentences: the setting, the light, what sits around the product. Pick the size: square for product pages, 9:16 for stories, 16:9 for banners.",
            "The cost appears before you confirm the job. Download the finished image, check it against the real product, then publish. If the first version is not right, change one line of the description and run it again — a rerun costs minutes, not a shoot."
          ]
        },
        {
          h2: "Scenes the Generator Can Build",
          img: IMG.photoSocialScene,
          paras: [
            "A coffee table with a magazine and a cup. A windowsill in soft morning light. A bathroom shelf, a gym bag, a picnic table, a marble vanity. Write the scene like a stage direction: \"a serum bottle on a marble vanity, soft window light, a small plant in the background.\"",
            "The reference photo anchors the product. If the generated product drifts — the label shifts, the color changes, the shape rounds off — drop that version and rerun with a clearer reference photo. A scene that hides the product is a scene that fails the listing."
          ]
        },
        {
          h2: "The Same Photo Can Move",
          video: video("notebook", "Real example, generated from one photo: a green notebook becomes a weekly-planning scene. Watch how the notebook, the pen and the desk keep their shape from the first frame to the last."),
          paras: [
            "A photo set covers the listing; a video covers the feed. The same reference photo that builds your images also starts an image-to-video job, where the product moves inside the scene you described — a hand picks it up, sets it down, shows it in use.",
            "Nothing extra to prepare: the video job takes the same photo, runs from 24 credits for a 6-second clip, and shows its cost before it starts."
          ]
        },
        {
          h2: "Listing Photos vs Social Ad Photos",
          img: IMG.photoMarketplace,
          paras: [
            "Marketplace main images follow strict rules: square, clean background, no text overlays, product filling the frame. The [white background](/ai-image-generation/white-background-photos) tool is built for that job. Social placements have room to move: 9:16 for Reels and TikTok covers, 1:1 for feed posts, 16:9 for wide placements.",
            "The [social ad photos](/ai-image-generation/social-ad-photos) tool crops and styles images for Facebook and Instagram ad sizes, so one product photo feeds both your listing and your ad account without a second shoot."
          ]
        },
        {
          h2: "Put the Product on a Model",
          img: IMG.photoShopScene,
          paras: [
            "Clothes, bags, jewelry and eyewear read differently on a person. The [model photos](/ai-image-generation/model-photos) tool puts your product on an AI model from one garment photo — no casting, no studio day. Save the model you like and reuse the same face across product pages and social posts, so the collection reads as one brand.",
            "The full workflow — source photos, fit checks, color sets — lives in [AI Fashion Model Photos Without a Photoshoot](/blog/model-photos-without-a-photoshoot)."
          ]
        },
        {
          h2: "What One Product Photo Can Cover",
          paras: [
            "From one reference photo you can build the whole set: the white-background main image, two or three lifestyle scenes, a model shot, and social crops. Each image costs 24 credits, so a Starter plan at 200 credits a month covers about eight images — a full listing refresh without a photoshoot.",
            "Plans start at $24.50 a month. You see the credit cost before every job, and if a job fails its credits go back to your balance."
          ]
        },
        {
          h2: "How Shops Use These Photos",
          paras: [
            "A jewelry brand runs every colorway on the same model and scene, so the collection page reads as one set. A kitchen brand replaces old supplier photos with lifestyle shots that match its brand colors. A dropshipper tests three scenes for one product before spending on ads. An apparel shop fills its Instagram grid between real shoots."
          ]
        },
        {
          h2: "Check the Photo Before You Publish",
          img: IMG.photoReview,
          paras: [
            "Put the generated photo next to the real product. Compare the color in daylight, count the visible parts, and read every letter on the label — small text is where generation drifts first. Enlarge the image to 100% before it goes live.",
            "Generated images follow the [content policy](/content): no misleading claims, no real people's faces presented as buyers. Your uploads and results stay private to your workspace."
          ]
        },
        {
          h2: "A Set You Can Publish Today",
          paras: [
            "One clear product photo is enough to start. Open the workspace, pick the tool your listing is missing, and generate the first image in minutes — then let the same photo finish the set."
          ]
        }
      ],
      tryBox: {
        title: "Try Lifestyle Photos",
        text: "Place your product in a real-life scene from one photo. You see the cost before the job starts.",
        href: "/app/create/tool/lifestyle-photos",
        label: "Make my photo",
        more: { label: "How Lifestyle Photos works", href: "/ai-image-generation/lifestyle-photos" }
      },
      faq: [
        { q: "How much does one AI product photo cost?", a: "Every photo costs 24 credits. The exact cost shows before the job starts, and a failed job returns its credits to your balance." },
        { q: "Do I need more than one product photo?", a: "One clear reference photo is enough to start. Extra angles help for products with details on several sides, and video jobs accept up to seven reference photos." },
        { q: "Can the main image go on Amazon and Shopify?", a: "Yes. The white background tool makes square, clean-background images for marketplace main slots. Always check the current marketplace rules for your category before publishing." },
        { q: "Will the product look exactly like mine?", a: "The reference photo anchors shape, color and visible details. Still compare the result with the real product — color in daylight, parts, and every label letter — and rerun with a clearer photo if anything drifted." },
        { q: "Can I put my product on a model?", a: "Yes. The model photos tool works from one garment photo, and you can save the model's face to reuse across your whole catalog." },
        { q: "Can my product photo become a video too?", a: "Yes. The same reference photo starts an image-to-video job: the product moves inside the scene you described, from 24 credits for a 6-second clip." },
        { q: "Can I use the photos in listings and ads?", a: "Yes. The files come without a watermark and are yours to publish. The content policy still applies: no misleading claims and no presenting generated imagery as real customers." },
        { q: "What happens if a job fails?", a: "The credits go back to your balance automatically, so a rerun never costs extra." },
        { q: "Do I need design skills?", a: "No. The flow is three steps: upload a product photo, describe the scene, download the image. Editing skills only matter if you want to fine-tune after." }
      ],
      related: [
        { label: "Model Photos", href: "/ai-image-generation/model-photos", text: "Your clothes and accessories on a reusable AI model." },
        { label: "White Background Photos", href: "/ai-image-generation/white-background-photos", text: "The clean main image marketplaces expect." },
        { label: "Social Ad Photos", href: "/ai-image-generation/social-ad-photos", text: "Images styled for Facebook and Instagram placements." },
        { label: "AI Fashion Model Photos Without a Photoshoot", href: "/blog/model-photos-without-a-photoshoot", text: "The full model-photo workflow, from flat lay to color set." },
        { label: "AI Video Ads Generator: Creator-Style Clips for Your Shop", href: "/blog/ai-ugc-video-ads-guide", text: "Turn the same product photo into video ads." }
      ],
      ctaTitle: "Make the Listing Set",
      ctaLead: "Turn one product photo into the images your listing is missing — and the clip that moves it.",
      startNote: START_NOTE
    },
    videos: ["notebook"]
  },

  // ────────────────────────────────────────────────────────────────────────
  {
    slug: "/blog/ai-ugc-video-ads-guide",
    h1: "AI Video Ads Generator: Creator-Style Clips for Your Shop",
    label: "AI Video Ads Generator",
    seo: {
      title: "AI Video Ads Generator: Creator-Style Clips for Your Shop | AIVideosUGC",
      description: "Turn a product photo into creator-style video ads with script, AI presenter, voice and subtitles. Watch real generated examples before you spend credits.",
      primaryKeyword: "AI UGC video ads guide"
    },
    data: {
      eyebrow: "Creator-Style Ads From One Photo",
      lead: "One product photo is enough to start. The video ads generator writes the script, puts your product in an AI presenter's hands, adds voice and subtitles, and hands you a clip ready for TikTok, Reels and Shorts.",
      minutes: 5,
      sections: [
        {
          h2: "What This Guide Covers",
          paras: [
            "This guide walks the video ads generator end to end: how a brief becomes a storyboard, how the seven video types and the Optimize button shape the clip, and what the presenter, the voice and the subtitles add. Two real examples generated on this site show the structure before you spend a single credit.",
            "By the end you'll know what an ad costs by length, which tools finish it, and how to keep one presenter consistent across a whole campaign."
          ]
        },
        {
          h2: "What the Video Ads Generator Makes",
          img: IMG.ugcDefinition,
          paras: [
            "The video ads generator turns a product photo or an imported product page into a creator-style video ad. The script explains the product in plain language, an AI presenter holds it and talks to the camera, and the clip comes out with voice and subtitles in sizes for TikTok, Instagram Reels, YouTube Shorts and your product page.",
            "You review the storyboard before the job runs and the finished file before you download. No camera, no crew, no editing timeline."
          ]
        },
        {
          h2: "Start From a Photo, a Link, or One Line",
          img: IMG.ugcVertical,
          paras: [
            "Upload one product photo and the generator builds the ad around it. Or import a product page through Product Links: the workspace pulls in the product's photos and details, so the brief writes itself without retyping specs.",
            "The workspace also ships quickstarts for the most common jobs — a TikTok ad for your brand, a UGC testimonial for your product, an Instagram Reel for your campaign. Pick one, replace the product, and edit the brief until it sounds like you."
          ]
        },
        {
          h2: "A Real Example, From One Photo",
          video: video("frother", "Real example generated on this site: a creator-style morning demo built around one product photo. Watch the structure — a hook in the first seconds, one action (froth, pour), and the product never leaving the frame."),
          paras: [
            "The clearest way to understand the output is to watch one. This clip was generated around a single product photo: a morning coffee routine for a kitchen brand, with the voiceover and the subtitles part of the file."
          ]
        },
        {
          h2: "Pick a Video Type, Then Optimize the Prompt",
          img: IMG.ugcScene,
          paras: [
            "Every job starts from a type: general product video, product ad, TikTok ad, UGC review, social Reels, cinematic launch, or how-to demo. The type sets the pacing and the shot structure — a UGC review reads like a customer's phone video, a cinematic launch reads like a brand film.",
            "The Optimize button rewrites your prompt against the type before you spend credits: it tightens the scene, the actions and the sound design. Edit the suggested version or run it as is."
          ]
        },
        {
          h2: "Choose the Face That Fits Your Brand",
          img: IMG.ugcHook,
          paras: [
            "Pick from 53 AI actors across 31 scenes and five age ranges. Preview voices, choose one of nine languages, and save the presenter — the same face can carry every ad for the product, which keeps a campaign consistent from first test to retargeting.",
            "The presenter holds your real product and performs one clear action per clip: the lid lift, the click, the pour, the try-on. One action per clip keeps the motion checkable and the hook fast."
          ]
        },
        {
          h2: "One Clear Action Per Clip",
          video: video("ring", "Real example: one action, start to finish. The ring snaps on, the angle changes, one hand scrolls. Nothing else happens — which is exactly what makes the clip easy to follow and easy to check."),
          paras: [
            "The generator follows one action per clip, and that discipline is what makes a clip feel real instead of busy. This example stays on a single moment — the snap-on — from grip to scroll."
          ]
        },
        {
          h2: "Lengths, Sizes, and Credits",
          img: IMG.ugcLength,
          paras: [
            "Clips run 6, 10, 15 or 30 seconds — 24, 40, 60 or 120 credits. Sizes: 9:16 for TikTok, Reels and Shorts; 1:1 for feed placements; 16:9 for YouTube and your product page. The exact cost shows before the job starts, and a failed job returns its credits.",
            "A 15-second ad costs the same as three product photos. Most shops test two or three openings before they scale the winner — that is the point of a workspace: versions are cheap."
          ]
        },
        {
          h2: "Subtitles and Sound",
          img: IMG.ugcEdit,
          paras: [
            "Every ad comes with voice and subtitles. The [Subtitle Studio](/app/create/subtitles) burns in subtitles, promo lines, or product copy on a finished video — change the wording without regenerating the clip.",
            "Keep captions in the upper safe area so platform buttons don't cover them. The voiceover language is a choice you make per job: pick the language your audience speaks and the presenter speaks it."
          ]
        },
        {
          h2: "Start From a Proven Template",
          paras: [
            "The [template wall](/templates) shows every finished example with the full prompt behind it. Filter by [industry](/industries), [platform](/platforms) or [occasion](/occasions), open a clip close to what you sell, and recreate it with your own product photo.",
            "Spark-ads-style and retargeting formats are already in the wall, so paid placements start from structures platforms reward instead of a blank prompt."
          ]
        },
        {
          h2: "AI Ads vs a Filming Day",
          paras: [
            "A filming day buys one set of footage. An AI workspace buys versions: new openings, new presenters, new languages, new hooks — each in minutes, each from the same product photo. The wording stays under your control because the script is text you can edit.",
            "There is no usage-rights negotiation, no reshoot when the angle changes, and no archive dig when the next product ships."
          ]
        },
        {
          h2: "How Shops Use These Ads",
          paras: [
            "A serum brand tests three hooks for one product and keeps the one with the lower cost per view. A gadget shop runs the same 15-second ad in English and Spanish. A gift brand refreshes its TikTok ad every two weeks with a new presenter so the account never looks stale."
          ]
        },
        {
          h2: "Make Your First Ad Today",
          paras: [
            "One product photo, one sentence about the product, one presenter. The generator handles the script, the voice, the subtitles and the cut — you keep the final say on what ships."
          ]
        }
      ],
      tryBox: {
        title: "Try Video Ads",
        text: "Short ads for TikTok, Reels and Shorts. Upload one product photo and see the cost before the job starts.",
        href: "/app/create/tool/video-ads#step-video",
        label: "Make my video",
        more: { label: "How Video Ads works", href: "/ai-video-generation/video-ads" }
      },
      faq: [
        { q: "What is the AI video ads generator?", a: "It turns a product photo or an imported product page into a creator-style video ad with a script, an AI presenter, voice and subtitles, in sizes for TikTok, Reels, Shorts and your product page." },
        { q: "How much does an ad cost?", a: "A 6-second clip costs 24 credits, 10 seconds 40, 15 seconds 60 and 30 seconds 120. The exact cost shows before the job starts, and failed jobs return their credits." },
        { q: "Can the presenter speak my customer's language?", a: "Yes. Voiceover comes in nine languages, including English, Spanish, Portuguese, Japanese, Korean and Thai. You pick the language per job." },
        { q: "Can the presenter hold my actual product?", a: "Yes. Your reference photo anchors the product in the presenter's hands. Check the label letters and the color against the real product before you publish." },
        { q: "Which platforms are the sizes for?", a: "9:16 fits TikTok, Instagram Reels and YouTube Shorts; 1:1 fits feed placements; 16:9 fits YouTube and product pages." },
        { q: "Can I start from a product link?", a: "Yes. Product Links imports the product's photos and details into your workspace, so the brief uses the real specs without retyping." },
        { q: "Do I need editing skills?", a: "No. You review the storyboard before generation and the file after. Subtitle Studio burns in captions or promo lines without regenerating the clip." },
        { q: "Are the ads watermark-free and cleared for ads?", a: "Yes. Files come without a watermark and are yours to run commercially. Platform ad rules and the content policy still apply." },
        { q: "Can the AI presenter be presented as a real buyer?", a: "No. Never present a generated face as a real customer or reviewer, and label AI content the way each platform currently requires." },
        { q: "What if the generation fails?", a: "The credits go back to your balance automatically. Rerun with a clearer description — a rerun never costs extra." }
      ],
      related: [
        { label: "AI Video Ads Generator: A Pre-Publish Checklist", href: "/blog/ai-video-review-checklist", text: "The five-minute pass before any ad goes live." },
        { label: "AI Product Videos for a Launch Unboxing", href: "/blog/unboxing-videos-for-launches", text: "Teaser, reveal and closer look from one package photo." },
        { label: "Browse every video template", href: "/templates?kind=video", text: "Open any example to see the full prompt behind it." },
        { label: "53 AI actors", href: "/ai-actors", text: "Presenters by scene, gender and age range." },
        { label: "How-to Guides", href: "/guides", text: "Step-by-step workspace tutorials." }
      ],
      ctaTitle: "Make the Ad From Your Photo",
      ctaLead: "Upload one product photo and get a creator-style clip with voice and subtitles.",
      startNote: START_NOTE
    },
    videos: ["frother", "ring"]
  },

  // ────────────────────────────────────────────────────────────────────────
  {
    slug: "/blog/ai-video-review-checklist",
    h1: "AI Video Ads Generator: A Pre-Publish Checklist",
    label: "AI Video Ad Pre-Publish Checklist",
    seo: {
      title: "AI Video Ads Generator: Pre-Publish Checklist | AIVideosUGC",
      description: "Run this five-minute pre-publish checklist on every AI video ad: product accuracy, close-up details, motion, typed captions, rights, and platform AI-content labels.",
      primaryKeyword: "AI Video Ads Generator"
    },
    data: {
      eyebrow: "Five Minutes Before You Publish",
      lead: "Generation is fast, so the final check is where quality lives. Run this five-minute pass on every AI video ad before it goes live — product, motion, words, rights, and platform labels.",
      minutes: 5,
      checklist: [
        "Product matches the real item: color, parts, and every label letter",
        "Close-up details checked: print placement, texture, finish",
        "Clip watched on a phone, sound on, subtitles read line by line",
        "Price, dates and discount codes typed by you, not drawn by the generator",
        "Any promise the clip makes — a difference, a result — happens on camera",
        "Photos, logos and music cleared for advertising use",
        "Platform AI-content labels applied; no AI face presented as a buyer",
        "Cost confirmed before the job; failed jobs refunded automatically"
      ],
      sections: [
        {
          h2: "What This Guide Covers",
          paras: [
            "This guide is the pre-publish pass for AI video ads: what to look at, in what order, and what to do when something is off. Two real clips generated on this site show exactly where accuracy problems hide — in the close-up details and in the promise the clip makes.",
            "Run it as a list at the end; the whole pass takes about five minutes on a 15-second ad."
          ]
        },
        {
          h2: "Why Every AI Ad Gets a Final Check",
          img: IMG.reviewWhy,
          paras: [
            "An AI workspace lets you produce ads at the speed you used to save for one shoot a quarter. Speed cuts both ways: the same afternoon can ship five versions, and the check decides which of them deserve your audience.",
            "The workspace already gates two steps — you review the storyboard before the job runs, and the file before download. This checklist covers the last five minutes between download and publish."
          ]
        },
        {
          h2: "Check the Product First",
          img: IMG.reviewProduct,
          paras: [
            "Put the real product next to your screen. Compare the color in daylight, count the visible parts, and read every letter on the label — small text is where generation drifts first. If the label is wrong, fix the reference photo or the description and rerun.",
            "Hands deserve a second look: check the grip, the proportions, and whatever the presenter does with the product. One clear action per clip is easier to verify than three."
          ]
        },
        {
          h2: "Check the Close-Up Details",
          video: video("fabric", "Real example: the close-up is where accuracy lives. Watch the print placement and the fabric texture — this is the level of detail to compare against the real product before you publish."),
          paras: [
            "Close-ups reward scrutiny. This example is built around a fabric-and-print close-up, which makes it the perfect practice clip: at this zoom you can see whether the print sits where it sits on the real garment, whether the texture reads true, and whether anything drifted."
          ]
        },
        {
          h2: "Check the Motion and the Voice",
          img: IMG.reviewMotion,
          paras: [
            "Watch the clip on a phone at full volume before you watch it anywhere else — that is where your audience meets it. Listen to the voiceover while reading the subtitles line by line: the spoken words and the burned-in text must match.",
            "If the voice lands but one scene is off, you don't need to start over — regenerate the one scene, or keep the file and fix the words in [Subtitle Studio](/app/create/subtitles)."
          ]
        },
        {
          h2: "Check the Words You Typed Yourself",
          img: IMG.reviewCopy,
          paras: [
            "Prices, dates, discount codes and shipping claims are yours to type. Add them in the caption or in Subtitle Studio — not as text you asked the generator to draw, because generated letters break and misread. A discount code that reads wrong costs more than any reshoot ever did."
          ]
        },
        {
          h2: "Check the Claim the Clip Makes",
          video: video("beforeAfter", "Real example: a before/after claim in motion. The tangle becomes the clipped setup on camera — if your clip promises a difference, the difference has to happen in the frame."),
          paras: [
            "If the ad promises a difference, the difference has to happen on camera. Before-and-after clips are the clearest case: the promise is the edit itself, and the viewer can verify it frame by frame — exactly what a reviewer should do."
          ]
        },
        {
          h2: "Check Your Rights",
          img: IMG.reviewRights,
          paras: [
            "Only photos and logos you own the rights to go into a job. Supplier images need an agreement that covers advertising use. Music comes from the built-in library or tracks you licensed. If a teammate sent the product photo, confirm where it came from before it feeds a paid ad."
          ]
        },
        {
          h2: "Check the Platform Labels",
          img: IMG.reviewRules,
          paras: [
            "Each platform sets its own rules for labeling AI-generated content — check the current policy for TikTok, Meta and YouTube before the ad goes live. Two rules are constant everywhere: never present a generated face as a real buyer or reviewer, and never promise health outcomes your product doesn't have."
          ]
        },
        {
          h2: "Fix One Scene or Regenerate the Clip?",
          paras: [
            "A wrong label, a drifting color, an awkward hand: regenerate just that scene with a sharper reference photo and keep the rest. A wrong script, a wrong language, a wrong product: regenerate the whole clip from a better brief.",
            "Failed jobs return their credits, so a rerun never costs extra — the only real cost is the minute you spend writing a clearer description."
          ]
        },
        {
          h2: "How Teams Run the Check",
          paras: [
            "A two-person shop checks every ad against the physical product on the desk. A bigger team stores reviewed product facts in Teams & Brands so every brief uses the same approved wording. An agency keeps this checklist in the client's onboarding doc and archives each approved file in the library with the version that shipped."
          ]
        },
        {
          h2: "Ship It, Then Test the Next Version",
          paras: [
            "Publish the checked ad, then let the workspace make the next test cheap: a new hook, a new presenter, a new language. The checklist stays the same; the versions get better."
          ]
        }
      ],
      tryBox: {
        title: "Try Image to Video",
        text: "Animate one product photo into a short clip. You review the storyboard and the file before anything ships.",
        href: "/app/create/tool/image-to-video#step-video",
        label: "Make my video",
        more: { label: "How Image to Video works", href: "/ai-video-generation/image-to-video" }
      },
      faq: [
        { q: "How long does the pre-publish check take?", a: "About five minutes for a 15-second ad: watch it once on a phone, compare the product, read the subtitles, confirm rights and labels." },
        { q: "The product looks slightly off — publish or rerun?", a: "Rerun. An ad must match the product customers receive. A clearer reference photo and a sharper description usually fix it in one run." },
        { q: "The label text is unreadable — what do I do?", a: "Rerun the scene with a sharper reference photo, or frame the shot so the label is not the focus. Never publish wrong product text." },
        { q: "Can I edit the video after download?", a: "Yes for words: Subtitle Studio burns in captions and promo lines on the finished file. Scene fixes need a regeneration of that scene." },
        { q: "Who owns the finished ad?", a: "You do. Files come without a watermark and are yours to run commercially, within the content policy." },
        { q: "Do I have to label AI content?", a: "Follow each platform's current rules. Two constants: never present a generated face as a real buyer or reviewer, and never promise outcomes the product doesn't have." },
        { q: "What music can I use?", a: "The built-in library or tracks you have licensed. Don't drop in commercial songs you haven't cleared for ads." },
        { q: "Who types the price and the discount code?", a: "You do, in the caption or in Subtitle Studio. Generated text breaks on small letters, so numbers and codes are always typed." },
        { q: "Do failed jobs cost credits?", a: "No. Credits return to your balance automatically when a job fails." },
        { q: "Does the same checklist work for photos?", a: "Yes. Color, parts, label letters, rights and platform rules — the same checks, minus motion and voice." },
        { q: "Can teammates review before publish?", a: "Yes. Teams & Brands stores shared product facts, and the library keeps every version so reviewers compare files, not links." },
        { q: "What if the ad could still mislead someone?", a: "Don't publish it. Fix the claim, the scene or the wording first — the rerun costs minutes, the misleading ad costs trust." }
      ],
      related: [
        { label: "Subtitle Studio", href: "/app/create/subtitles", text: "Burn in subtitles, promo lines, or product copy after download." },
        { label: "AI Video Ads Generator: Creator-Style Clips for Your Shop", href: "/blog/ai-ugc-video-ads-guide", text: "What the ads generator builds before the check." },
        { label: "AI Product Videos for a Launch Unboxing", href: "/blog/unboxing-videos-for-launches", text: "Launch-week clips that pass the same check." },
        { label: "Content Policy", href: "/content", text: "What generated content can and cannot claim." },
        { label: "Pricing", href: "/pricing", text: "Credits per job, monthly plans, and automatic refunds." }
      ],
      ctaTitle: "Put the Checklist Into Practice",
      ctaLead: "Animate a product photo, review it against the real thing, and publish with confidence.",
      startNote: START_NOTE
    },
    videos: ["fabric", "beforeAfter"]
  },

  // ────────────────────────────────────────────────────────────────────────
  {
    slug: "/blog/unboxing-videos-for-launches",
    h1: "AI Product Videos for a Launch Unboxing",
    label: "Unboxing Videos for Product Launches",
    seo: {
      title: "Unboxing AI Product Video Generator | AIVideosUGC",
      description: "Build launch week's three unboxing clips — teaser, reveal, closer look — from one package photo, and watch real generated unboxing examples before you make yours.",
      primaryKeyword: "unboxing AI Product Video Generator"
    },
    data: {
      eyebrow: "Teaser, Reveal, Closer Look",
      lead: "Launch week needs three clips: the teaser, the reveal, and the closer look. One package photo and one saved presenter cover all three — no studio, no crew, no editing day.",
      minutes: 5,
      sections: [
        {
          h2: "What This Guide Covers",
          paras: [
            "This guide walks launch week's three unboxing clips: what each clip shows, how the AI Video Agent plans them as one storyboard, and what the real examples look like. It also covers the practical details — lengths, credits, subtitles, and where the launch date goes.",
            "By the end you'll have a three-clip plan you can generate in one afternoon from one package photo."
          ]
        },
        {
          h2: "The Three Clips Launch Week Needs",
          img: IMG.unboxDetails,
          paras: [
            "A teaser shows the closed box and promises the open. The reveal is the lid lift — the moment the product appears. The closer look shows one action: the pour, the click, the try-on. Three short clips carry a launch better than one long video, because each earns its own post slot.",
            "All three start from the same photo of the final package, and all three can share the same presenter."
          ]
        },
        {
          h2: "Plan the Storyboard With the AI Video Agent",
          img: IMG.unboxClips,
          paras: [
            "Open the [AI Video Agent](/app/create/agent), paste your product details, and describe the launch in one line — \"teaser, reveal, and closer look for a ceramic travel mug, natural morning light.\" The agent turns it into an editable storyboard, scene by scene, with actions and voice lines.",
            "Edit the storyboard before any credits are spent. What you approve is what generates — the surprise belongs in the video, not in the bill."
          ]
        },
        {
          h2: "Start From the Real Package",
          img: IMG.unboxReady,
          paras: [
            "Use a photo of the package customers will actually receive: final artwork, daylight, shot from the front. Count what ships in the box and show only what the camera will see — if the video shows tissue paper, the box needs tissue paper.",
            "If the packaging changes before launch day, make the clips again. Shoppers remember the box they open; the video must match it."
          ]
        },
        {
          h2: "The Reveal: A Real Unboxing Example",
          video: video("sealedBox", "Real example generated on this site: the reveal. Closed box, the slice open, the first item lifted out — the same teaser-to-reveal structure launch week needs."),
          paras: [
            "The reveal is the beat shoppers remember. This example runs the full structure: the sealed box on the table, the slice open, the first item lifted out — all of it generated from package photos."
          ]
        },
        {
          h2: "Make the Three Clips in Three Steps",
          img: IMG.unboxSentence,
          paras: [
            "Upload the package photo. Choose your saved presenter and describe one action per clip: the closed box held to camera; the lid lift; one use action. Set the size — 9:16 for launch-day platforms — and the length.",
            "The teaser and the reveal work at 6 or 10 seconds — 24 or 40 credits. The closer look has room at 15 seconds — 60 credits. The cost shows before each job starts, and failed jobs return their credits."
          ]
        },
        {
          h2: "Unbox, Then Show One Action",
          video: video("powerBank", "Real example: unbox, then one action. The power bank comes out of the box and snaps onto the phone in the same clip — the 'closer look' beat that follows the reveal."),
          paras: [
            "After the reveal, the closer look earns its slot: the product out of the box and straight into one real action. This example pairs the unboxing with the snap-on, so the clip teaches the product instead of just showing it."
          ]
        },
        {
          h2: "Keep One Presenter Across the Set",
          paras: [
            "Save the presenter profile once and reuse it: the same face opens the teaser, lifts the lid, and demonstrates the action. Pick from 53 AI actors, preview voices, and set the voiceover language from nine options.",
            "Launching in more than one market? The same storyboard runs again with a different language — the face and the pacing stay identical."
          ]
        },
        {
          h2: "Subtitles, Price, and the Launch Date",
          img: IMG.unboxAfter,
          paras: [
            "Voice and subtitles come with every clip. Burn the launch date, the early price, or the drop time in [Subtitle Studio](/app/create/subtitles) — and type them yourself. Keep captions in the upper safe area.",
            "Countdown text changes on launch day: Subtitle Studio edits the finished file without regenerating the clips."
          ]
        },
        {
          h2: "Start From a Template",
          paras: [
            "The [template wall](/templates) has finished unboxing examples with the full prompt behind each one — open the one closest to your product and recreate it with your package photo. The [occasions](/occasions) filter groups launch-adjacent formats: sale and discount, Black Friday, holidays."
          ]
        },
        {
          h2: "How Shops Run Launch Week",
          paras: [
            "A home goods brand posts the teaser three days out, the reveal on launch morning, and the closer look the same evening — one photo, one presenter, one afternoon of generation. A gift brand runs the reveal in two languages for two markets. A two-person team schedules all three clips from the library between customer emails."
          ]
        },
        {
          h2: "The Launch Unboxing in Short",
          paras: [
            "One photo of the real package. One saved presenter. Three short clips: tease, reveal, closer. Type the date and the price yourself, check every clip against the box, and post."
          ]
        }
      ],
      tryBox: {
        title: "Try Unboxing Videos",
        text: "Start from the real package photo and build the teaser, the reveal, and the closer look.",
        href: "/app/create/tool/unboxing-videos",
        label: "Make my video",
        more: { label: "See unboxing examples", href: "/ai-video-generation/unboxing-experience" }
      },
      faq: [
        { q: "How is an AI unboxing different from filming one?", a: "It starts from your package photo, so the teaser, the reveal and the closer look are ready in minutes. Versions are cheap: a new opening or a new presenter takes minutes, not a reshoot." },
        { q: "Can I start from a product link?", a: "Yes. Product Links imports the product's photos and details into your workspace. Still check that the package in the video matches the box you ship." },
        { q: "What if the video shows the wrong item?", a: "Rerun with clearer photos and a description of the exact box contents. Compare the finished clip with the real package before it goes live." },
        { q: "What if my packaging changes before launch?", a: "Make the clips again from the new package photo. Shoppers remember the box they open, so the video must match it." },
        { q: "Can the clips show how the product works?", a: "Yes — that is the closer look. Describe one action per clip and let the reveal stay focused on the open." },
        { q: "How long should each clip be?", a: "Teaser and reveal work at 6 or 10 seconds. The closer look has room at 15 seconds. Thirty seconds suits a single combined cut." },
        { q: "How much does the set cost?", a: "At typical lengths: 24 credits for the teaser, 40 for the reveal, 60 for the closer look — about 124 credits, within a Starter month of 200. Costs show before every job." },
        { q: "Can the same presenter appear in all three clips?", a: "Yes. Save the presenter profile once and reuse it across the set — the same face and voice in every clip." },
        { q: "Can I add the launch date and the price?", a: "Yes. Type them in the caption or burn them in Subtitle Studio. Don't ask the generator to draw numbers or codes." },
        { q: "Can the voiceover run in another language?", a: "Yes, nine languages. The same storyboard reruns with a different language while the face and pacing stay identical." },
        { q: "Do I keep rights to the clips?", a: "Yes. Files come without a watermark and are yours to publish and promote with." },
        { q: "What if a clip fails to generate?", a: "The credits return to your balance automatically, and you can rerun right away." }
      ],
      related: [
        { label: "AI Video Ads Generator: Creator-Style Clips for Your Shop", href: "/blog/ai-ugc-video-ads-guide", text: "The ad-side workflow for launch week." },
        { label: "AI Video Ads Generator: A Pre-Publish Checklist", href: "/blog/ai-video-review-checklist", text: "Check every launch clip against the real box." },
        { label: "Unboxing examples", href: "/ai-video-generation/unboxing-experience", text: "Finished unboxing clips with the full prompt behind them." },
        { label: "53 AI actors", href: "/ai-actors", text: "Save one presenter for the whole launch set." },
        { label: "Occasions: sale, Black Friday, holidays", href: "/occasions", text: "Launch-adjacent formats by calendar." }
      ],
      ctaTitle: "Make the Launch Unboxing",
      ctaLead: "Turn one package photo into a teaser, a reveal, or a closer look, then check it against the real box.",
      startNote: START_NOTE
    },
    videos: ["sealedBox", "powerBank"]
  },

  // ────────────────────────────────────────────────────────────────────────
  {
    slug: "/blog/model-photos-without-a-photoshoot",
    h1: "AI Fashion Model Photos Without a Photoshoot",
    label: "AI Model Photos Without a Photoshoot",
    seo: {
      title: "AI Virtual Model Photos, No Photoshoot | AIVideosUGC",
      description: "Put your clothing on an AI model from one garment photo — and watch real generated try-on clips. Keep the same face across your color set, product pages and social posts.",
      primaryKeyword: "model photos without a photoshoot"
    },
    data: {
      eyebrow: "Your Garment, Your Model, No Studio",
      lead: "Upload one garment photo and put it on an AI model — the same face across your whole color set, your product pages, and your social posts. No casting, no studio day, no reshoots.",
      minutes: 5,
      sections: [
        {
          h2: "What This Guide Covers",
          paras: [
            "This guide walks the model photo workflow: which source photo works, how to pick and keep a model, and how one garment photo becomes a whole set — model shots, lifestyle scenes and video. Two real clips generated on this site show what a finished set looks like in motion.",
            "By the end you'll know how to launch an entire color set in one afternoon, and what to check before each photo goes live."
          ]
        },
        {
          h2: "Your Clothes on a Model, Without the Shoot",
          img: IMG.modelWork,
          paras: [
            "The [model photos](/ai-image-generation/model-photos) tool turns a flat-lay or hanger shot into a model photo. Choose the model, the pose and the background; the generator drapes your garment and keeps its color, print and visible details.",
            "Each photo costs 24 credits, the cost shows before the job starts, and failed jobs return their credits."
          ]
        },
        {
          h2: "Start From a Flat Lay or Hanger Shot",
          img: IMG.modelGarment,
          paras: [
            "One clear photo of the garment is enough: daylight, full front, laid flat or on a hanger. Smooth the wrinkles first — folds in the source photo become folds on the model. Make sure the collar, the cuffs and the hem are fully in frame.",
            "Read every label before upload: the generator reproduces what it sees, including the care tag hanging out of the collar."
          ]
        },
        {
          h2: "Pick the Model and Keep the Face",
          paras: [
            "Choose from 53 AI actors across five age ranges and 31 scenes. Save the model you like and reuse the same face on every product page, marketplace and social post — the collection reads as one brand, not a collage.",
            "Jewelry and eyewear follow the same path: clear close-ups, count the stones, check the clasps. The saved face works across accessories too."
          ]
        },
        {
          h2: "Show the Fit, the Drape, the Fabric",
          video: video("teeFit", "Real example: a fit check from one garment photo. Watch the beats — the mirror check, the fabric close-up, tucked and untucked — that turn one photo into a whole set of posts."),
          paras: [
            "A model photo has to show how the garment sits. The fit check is the standard format — and it works just as well generated as filmed, straight from the garment photo you already have."
          ]
        },
        {
          h2: "Build the Whole Color Set Together",
          img: IMG.modelFit,
          paras: [
            "Run every colorway on the same model and the same scene: the set looks intentional, and shoppers compare colors instead of comparing photos. Generate the white-background main image for the marketplace, the model photo for the page, and the lifestyle shot for social — all from the same garment photo.",
            "If the print drifted or the collar shape changed, rerun with a sharper source photo instead of shipping a version that doesn't match."
          ]
        },
        {
          h2: "Style It More Than One Way",
          video: video("cardigan", "Real example: one garment, two outfits. Open over a tee, then belted — styling variety from a single source photo, with the same model kept across both looks."),
          paras: [
            "One garment, two outfits doubles the feed without a second garment: the same knit worn open over a tee, then belted, keeps the model and the room identical while the look changes."
          ]
        },
        {
          h2: "Make Model Photos in Three Steps",
          img: IMG.modelWhen,
          paras: [
            "Upload the garment photo. Pick the model, the pose and the background — and save the person for next time. Download the square version for the listing and the vertical for stories, then check the collar, the length and the closures before you publish."
          ]
        },
        {
          h2: "Where Each Photo Goes",
          img: IMG.modelSetting,
          paras: [
            "Marketplace main images follow strict rules — use the [white background](/ai-image-generation/white-background-photos) tool for those. Product pages take the model photo and the lifestyle shot. Stories and Reels covers take 9:16. The same source photo feeds all three."
          ]
        },
        {
          h2: "Check Before You Post",
          paras: [
            "Check the collar, the hem and the closures against the real garment; enlarge to 100% and read every printed letter. Follow the [content policy](/content): the model is generated, so never present her as a real customer or reviewer."
          ]
        }
      ],
      tryBox: {
        title: "Try Model Photos",
        text: "Your clothes and accessories on an AI model, from one garment photo. The face saves for your whole catalog.",
        href: "/app/create/tool/model-photos",
        label: "Make my photo",
        more: { label: "How Model Photos works", href: "/ai-image-generation/model-photos" }
      },
      faq: [
        { q: "Do I still need a photoshoot?", a: "Not for listing coverage: one garment photo generates model photos, lifestyle scenes and white-background images. Real shoots still earn their place for hero campaigns." },
        { q: "What photo works as the source?", a: "A daylight flat lay or hanger shot, full front, wrinkles smoothed, collar to hem fully in frame." },
        { q: "Can I keep the same model across products?", a: "Yes. Save the model and reuse the same face across your catalog, marketplaces and social posts." },
        { q: "Does it work for jewelry and eyewear?", a: "Yes. Keep close-ups sharp, count the stones, and check clasps against the real piece before publishing." },
        { q: "Can the model appear in video too?", a: "Yes. The same garment photo starts a fashion try-on reel: fit check, fabric close-up, styling — a full clip from the photo you already have." },
        { q: "Will the fit look accurate?", a: "The model shows drape and scale. The size chart stays the source of truth for fit — compare every photo with the real garment before publish." },
        { q: "Can marketplace main images be generated?", a: "Yes, with the white background tool: square, clean background, product filling the frame. Check your marketplace's current rules for the category." },
        { q: "How much does it cost?", a: "24 credits per photo, with the cost shown before the job starts. Plans run from $24.50 a month, and failed jobs refund their credits." },
        { q: "Can the AI model be presented as a real customer?", a: "No. The model is generated, so never present her as a real buyer or reviewer, and follow each platform's AI-content labeling rules." }
      ],
      related: [
        { label: "Lifestyle Photos", href: "/ai-image-generation/lifestyle-photos", text: "Your product in real-life scenes." },
        { label: "White Background Photos", href: "/ai-image-generation/white-background-photos", text: "Marketplace-ready main images." },
        { label: "AI Product Photo Generator: Listings and Scenes", href: "/blog/ai-product-photography-guide", text: "The full photo workflow from one product photo." },
        { label: "53 AI actors", href: "/ai-actors", text: "Browse models by scene, gender and age range." },
        { label: "Fashion try-on reel", href: "/ai-video-generation/fashion-try-on-reel", text: "Turn the same garment photo into video." }
      ],
      ctaTitle: "Your Next Set Is One Photo Away",
      ctaLead: "Put your garment on an AI model and launch the whole color set together.",
      startNote: START_NOTE
    },
    videos: ["teeFit", "cardigan"]
  }
];

// Blog index (/blog) copy patch. Only the listed keys change; every other
// field of the row stays exactly as published.
export const INDEX_PATCH = {
  slug: "/blog",
  data: {
    eyebrow: "Inside the AI UGC Workspace",
    lead: "The workspace turns product photos into video ads, photo sets and launch clips. These guides walk the workflows — with real examples generated on the site and the checks that keep them honest.",
    intro: [
      "Every guide here mirrors a tool in the workspace: photo generators for listings, the video ads generator for creator-style clips, the launch unboxing for product videos, and model photos for apparel. The features, the credit costs and the review steps match what you'll see when you open the workspace — and each guide embeds real examples generated on this site.",
      "Start with the article closest to your next job. Each one ends at a workspace tool you can open without an account, and every job shows its credit cost before it starts."
    ],
    articlesSummary: {
      "/blog/ai-product-photography-guide": "Start from one product photo. The AI Image workspace builds white-background shots, lifestyle scenes, model photos and social ads — and the same photo can move.",
      "/blog/ai-ugc-video-ads-guide": "One product photo is enough. The generator writes the script, picks the presenter, and hands you a clip ready for TikTok, Reels and Shorts — real examples included.",
      "/blog/ai-video-review-checklist": "Generation is fast, so the final check is where quality lives. A five-minute pass before every ad goes live.",
      "/blog/unboxing-videos-for-launches": "Three clips carry launch week: the teaser, the reveal, and the closer look. One package photo covers all three.",
      "/blog/model-photos-without-a-photoshoot": "Put your clothing on an AI model from one garment photo, and keep the same face across the whole color set."
    }
  }
};
