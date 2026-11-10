// AIVideosUGC blog tutorials — five articles rebuilt around the five workspace
// modules (2026-11-11). Tutorial + editorial: narrative openers, product
// knowledge, numbered steps, real template-wall prompt cards with part-by-part
// walkthroughs (section.prompt), one real example clip per article, common
// mistakes and FAQ. Slugs, covers and canonical URLs stay as published;
// h1/seo titles move to the tutorial keywords with the old roots bridged in
// the description (google-indexed-url-safety: no URL changes).
//
// Prompt bodies are excerpts of the published template-wall prompts (verified
// 2026-11-11 against the directory card data); section.video reuses the nine
// already-published example clips.

export const APPLY_DATE = "2026-11-11";
// First public release date of the example clips (media inventory 2026-11-01).
export const VIDEO_UPLOAD_DATE = "2026-11-01";

const CLIPS = {
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
  }
};
export { CLIPS };

function video(key, caption) {
  return { ...CLIPS[key], caption };
}

function prompt(label, title, body, parts, notes) {
  return { label, title, body, parts, notes };
}

// Section images referenced by their existing src; the apply script resolves
// each to the full V2Image (alt/sizes/srcSet) from the live row.
const IMG = {
  photoSourceClear: "/ai-image-generation/fx04-blog-photo-source-clear-r1-640.webp",
  photoLookCafe: "/ai-image-generation/fx04-blog-photo-look-cafe-r1-640.webp",
  photoSocialScene: "/ai-image-generation/fx04-blog-photo-social-scene-r1-640.webp",
  photoReview: "/ai-image-generation/fx04-blog-photo-review-r1-640.webp",
  ugcDefinition: "/ai-image-generation/fx04-blog-ugc-definition-r1-640.webp",
  ugcHook: "/ai-image-generation/fx04-blog-ugc-hook-r1-640.webp",
  ugcLength: "/ai-image-generation/fx04-blog-ugc-length-r1-640.webp",
  unboxReady: "/ai-image-generation/fx05-unbox-ready-640.webp",
  unboxClips: "/ai-image-generation/fx05-unbox-clips-640.webp",
  reviewMotion: "/ai-image-generation/fx04-blog-review-motion-r1-640.webp",
  modelWork: "/ai-image-generation/fx05-model-work-640.webp",
  modelSetting: "/ai-image-generation/fx05-model-setting-640.webp"
};

const START_NOTE = "[Plans from $24.50 a month](/pricing). You see the credit cost before every job, and if a job fails its credits go back to your balance.";

export const ARTICLES = [
  // ── ② AI Video — the prompt-teaching anchor article ─────────────────────
  {
    slug: "/blog/ai-ugc-video-ads-guide",
    h1: "AI Video Tutorial: Write Product Ad Prompts That Work",
    label: "AI Video Tutorial",
    seo: {
      title: "AI Video Tutorial: Product Ad Prompts | AIVideosUGC",
      description: "Learn to write AI video prompts for product ads, part by part, against a real template-wall example. The creator-style UGC ads guide, now a tutorial.",
      primaryKeyword: "AI video prompt tutorial",
      keywords: "AI video prompt tutorial, AI video ads generator, product ad prompts, AI UGC video ads guide, AI video generator"
    },
    data: {
      eyebrow: "Workspace Tutorial · AI Video",
      lead: "A product ad used to cost a filming day: the crew, the presenter, the edits, the reshoots. In the AIVIDEOSUGC workspace it costs one product photo and a prompt — if you know how to write the prompt. This tutorial teaches you, part by part, against a real example.",
      minutes: 7,
      checklist: [
        "One action per shot — the clip stays checkable and the hook stays fast",
        "Lock the product to Image 1 in the first sentences, never re-describe it later",
        "Write spoken lines as speech, not ad copy — short, casual, one idea each",
        "Put timing on every shot so the 30 seconds are budgeted before generation",
        "Always ship a Negative prompt: no text, no logos, no extra fingers",
        "Compare the finished clip with the real product before you publish"
      ],
      sections: [
        {
          h2: "What You'll Learn",
          paras: [
            "This tutorial walks the AI Video module end to end. You'll learn how a prompt becomes a storyboard, how the seven video types shape pacing, and how to write the six parts of a prompt that generates a clean, checkable product clip. Every rule is shown against a real prompt from the [template wall](/templates) — the same structure the Optimize button produces — so what you learn here is what you'll edit in practice.",
            "By the end you can write a working prompt from scratch, read any example prompt in the wall and know what each line controls, and review a finished clip like an editor instead of a spectator."
          ]
        },
        {
          h2: "What the AI Video Tool Actually Does",
          img: IMG.ugcDefinition,
          paras: [
            "It helps to know what happens between your prompt and the finished file. The [AI video ads generator](/ai-video-generation/video-ads) takes your reference photo and your description, then produces a clip with three layers baked in: the script (spoken lines written as speech, not ad copy), the presenter (an AI actor who holds the product and talks to camera), and the finish (voice, subtitles, and the size you picked — 9:16 for TikTok, Reels and Shorts; 1:1 for feed; 16:9 for YouTube and product pages).",
            "Two gates protect you from surprises: you review the storyboard before the job runs, and the finished file before download. That's why the prompt matters so much — the generator follows it faithfully, and everything you fix in the prompt is something you never have to fix in post."
          ]
        },
        {
          h2: "Meet the AI Video Tool",
          paras: [
            "In the workspace's create menu, the [AI Video module](/app/create/tool/video-ads#step-video) is the writing surface: a description box, a type selector, the Optimize button, and the parameter bar — wan-1080p, the aspect ratio, the length, the resolution. Everything in this tutorial happens on that one screen.",
            "If you'd rather start from your product page than from a photo, [Product Links](/app/create/product) imports the listing first; the [Text to Video agent](/app/create/agent) plans a whole storyboard before you write anything at all. This tutorial stays on the direct path: photo in, prompt written, clip out."
          ]
        },
        {
          h2: "Step 1: Upload the Product Photo",
          paras: [
            "One clear photo — daylight, plain background, shot from the front. This becomes Image 1 in the prompt: the reference the generator locks onto for shape, color, material and packaging. A sharp source photo is the single highest-leverage decision in the whole flow; every rule below assumes it.",
            "If your product has details on several sides, you can add up to seven reference photos on video jobs. Keep Image 1 as the canonical front view — the prompt locks to that image specifically."
          ]
        },
        {
          h2: "Step 2: Pick a Type, Then Optimize",
          paras: [
            "Every job starts from a type: general product video, product ad, TikTok ad, UGC review, social Reels, cinematic launch, or how-to demo. The type sets pacing and shot structure before a single line of your prompt is read — a UGC review reads like a customer's phone video, a cinematic launch reads like a brand film.",
            "Then press Optimize. It rewrites your draft against the type: tightening the scene, the actions, the spoken lines and the sound design. The output uses the same six-part anatomy you'll learn below, which is exactly why learning the anatomy matters — you can edit the optimized prompt with intent instead of accepting it blind."
          ]
        },
        {
          h2: "Step 3: Write the Prompt in Six Parts",
          paras: [
            "The workspace prompt follows a fixed anatomy. Here is the real prompt behind the frother example, reduced to its skeleton — write yours in the same order and you'll get the same discipline:"
          ],
          prompt: prompt(
            "Real prompt",
            "Black Milk Frother Morning Demo · template wall",
            "This is a 30-second vertical TikTok Shop product-promotion video, filmed on a phone in an authentic UGC style. Use natural light and a realistic everyday setting, and keep the image clear throughout.\n\nImage 1 shows the product for this video. Match its appearance, color, and packaging exactly to Image 1. There must be no text or brand marks on the product or packaging.\n\nCharacter: a woman in her twenties, hair tied in a bun, wearing light-colored loungewear, no jewelry.\n\nShot 1 [0-3 sec] Close-up: In a bright morning kitchen, she holds up the black milk frother. Spoken line: \"Here's how I make a café iced latte at home.\"\nShot 2 [3-9 sec] Medium shot: She pours cold milk into a glass jar. Spoken line: \"Cold milk in a jar.\"\nShot 3 [9-18 sec] Close-up: She froths the milk in the jar; it quickly turns into thick, creamy foam. Spoken line: \"A few seconds with this frother, and look at that foam.\"\n\nAudio: Natural spoken English dialogue, together with pouring milk, the frother buzzing, and ice cubes clinking. No background music.\n\nNegative prompt: background music, subtitles, on-screen text, text on the packaging, watermarks, logos, extra fingers, deformed hands, duplicate people, blurred backgrounds…",
            [
              { term: "Opening", text: "The first line sets the frame: duration + aspect ratio + platform + style. The generator reads it for pacing and cut density." },
              { term: "Lock", text: "Reference lock: Image 1 is the only product reference — same shape, color and packaging, no text or brand marks. All product consistency lives here; describing the product twice invites drift." },
              { term: "Character", text: "The person is described once — age range, hair, outfit, jewelry, language and tone. Every later Shot reuses them without re-describing." },
              { term: "Shots", text: "The Shot timeline: one action per shot, with a time range and a shot size. Spoken lines are casual speech, one idea each — that is what keeps the clip sounding human." },
              { term: "Audio", text: "The sound layer: dialogue plus environment effects (pouring, buzzing, ice). Say whether you want background music — anything left unsaid is left to the model." },
              { term: "Negative", text: "The safety net: watermarks, captions, on-screen text, extra fingers, warped hands, depth blur. Forbidding the commonest failures up front is cheap insurance." }
            ],
            ["Full text: 1,856 characters", "Source: template wall example card", "9:16 · 30s"]
          )
        },
        {
          h2: "Step 4: Watch the Real Result",
          video: video("frother", "Real example generated from the prompt above. Hook 0-3s → pour → froth → pour-over → close. Every beat on screen maps to one line in the prompt — the structure doubles as your review checklist."),
          paras: [
            "This clip was generated from the prompt above. Watch it with the Shot lines in front of you — every beat on screen maps to one line in the prompt, which is the whole point of the structure."
          ]
        },
        {
          h2: "Step 5: Set Length, Size, and Credits",
          img: IMG.ugcLength,
          paras: [
            "Clips run 6, 10, 15 or 30 seconds — 24, 40, 60 or 120 credits, with the exact cost shown before the job starts and failed jobs refunded automatically. A 15-second ad costs the same as three product photos, which is why most shops test two or three openings before scaling the winner. Pick the size for where the ad will run: 9:16 for TikTok, Reels and Shorts; 1:1 for feed placements; 16:9 for YouTube and product pages."
          ]
        },
        {
          h2: "Step 6: Review Like an Editor",
          paras: [
            "Watch the clip on a phone at full volume before you watch it anywhere else — that's where your audience meets it. Read the subtitles line by line against the spoken audio. Compare the product against the real thing in daylight: color, visible parts, every label letter. If the voice lands but one scene is off, regenerate just that scene; if it's only the words, [Subtitle Studio](/app/create/subtitles) burns new captions onto the finished file without regenerating anything."
          ]
        },
        {
          h2: "Why the Structure Works",
          img: IMG.ugcHook,
          paras: [
            "Structured prompts earn their keep three ways. They're consistent: the same anatomy every time means the generator has fewer decisions to improvise, and your results become comparable across versions. They're checkable: when every beat is a named Shot with a time range, review becomes a checklist instead of a vibe. And they're reusable: swap the product photo and rewrite two spoken lines, and the same skeleton produces the ad for your next product — which is exactly how the template wall scales across 19 [industries](/industries) and 6 [platforms](/platforms).",
            "There is also a hiring-side benefit. The presenter in your prompt comes from the same [AI actor library](/ai-actors) every job uses, so the face that reads your prompt today can be saved and reused next month — one face per campaign, in nine languages, without a casting call."
          ]
        },
        {
          h2: "How Shops Run This Workflow",
          paras: [
            "A serum brand we watch tests three hooks for one product — problem-first, demo-first, review-first — and keeps the one with the lower cost per view. A gadget shop runs the same 15-second ad in English and Spanish by changing only the Character line's language and the spoken lines. A gift brand refreshes its TikTok ad every two weeks with a new presenter so the account never looks stale; the prompt skeleton never changes, only the Character block and the scene.",
            "None of these shops shoots anything. The speed comes from the structure: a prompt that writes in thirty minutes, generates in minutes, and reviews in five."
          ]
        },
        {
          h2: "Common Mistakes",
          paras: [
            "Writing ad copy into spoken lines: spoken lines are speech — \"Here's how I make a café iced latte at home\", not a slogan. Slogans sound like ads, and ads get skipped.",
            "Describing the product twice: the second description fights the reference photo and the product drifts. Lock it once, to Image 1.",
            "No timing on shots: without [0-3 sec] ranges the generator budgets the 30 seconds itself — and spends them on the wrong beats.",
            "Skipping the Negative prompt: watermarks, captions and extra fingers are the commonest failures; forbid them explicitly."
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
        { q: "Do I have to write the full prompt myself?", a: "No. Write the six parts roughly, pick a type, and press Optimize — it produces the same structure. This tutorial teaches the structure so you can edit the optimized result with intent instead of accepting it blind." },
        { q: "Where do the example prompts come from?", a: "From the template wall: every finished example ships with the full prompt behind it. Open one close to your product and recreate it with your own photo." },
        { q: "Can the presenter speak my customer's language?", a: "Yes — nine languages, including English, Spanish, Portuguese, Japanese, Korean and Thai. The Character part sets the spoken language; the face and pacing stay identical when you rerun it." },
        { q: "Can the presenter hold my actual product?", a: "Yes — the reference photo anchors the product in the presenter's hands. Check the label letters and color against the real product before publishing." },
        { q: "Are the ads watermark-free and cleared for ads?", a: "Yes. Files come without a watermark and are yours to run commercially. Platform ad rules and the content policy still apply." },
        { q: "What does a clip cost?", a: "6 seconds 24 credits, 10s 40, 15s 60, 30s 120 — shown before the job starts, refunded automatically on failure." }
      ],
      related: [
        { label: "Text to Video Tutorial: Brief the AI Video Agent", href: "/blog/ai-video-review-checklist", text: "Plan the storyboard before you write the prompt." },
        { label: "Browse every video template", href: "/templates?kind=video", text: "Open any example to see the full prompt behind it." },
        { label: "53 AI actors", href: "/ai-actors", text: "Presenters by scene, gender and age range." },
        { label: "AI Image Generator Tutorial", href: "/blog/ai-product-photography-guide", text: "The still-image half of the same workflow." },
        { label: "How-to Guides", href: "/guides", text: "Step-by-step workspace tutorials." },
        { label: "Pricing", href: "/pricing", text: "Credits per job, monthly plans, and automatic refunds." }
      ],
      ctaTitle: "Write Your First Prompt",
      ctaLead: "Open the AI Video module, upload one photo, and build the six parts with Optimize.",
      startNote: START_NOTE
    },
    videos: ["frother"],
    promptCards: 1
  },

  // ── ① AI Image — scene-prompt tutorial ──────────────────────────────────
  {
    slug: "/blog/ai-product-photography-guide",
    h1: "AI Image Generator Tutorial: Product Photos From One Shot",
    label: "AI Image Tutorial",
    seo: {
      title: "AI Image Generator Tutorial: Product Photos | AIVideosUGC",
      description: "One product photo, five listing images. The AI product photo guide as a hands-on tutorial: the five image tools, the scene-prompt formula, and a real example that moves.",
      primaryKeyword: "AI image generator tutorial",
      keywords: "AI image generator tutorial, AI product photo generator, AI product photos, product photos from one image, AI lifestyle product images"
    },
    data: {
      eyebrow: "Workspace Tutorial · AI Image",
      lead: "A listing needs five kinds of photos: the clean main image, a few lifestyle scenes, a shot with the product in use, social crops, and colorway variants. A studio day produces one of them. The AI Image module produces all five from a single photo — this tutorial shows you how, scene prompt included.",
      minutes: 7,
      checklist: [
        "Source photo checked: daylight, plain background, product fully in frame",
        "Scene written in three elements — surface, light, neighbours (max two)",
        "Color compared with the real product in daylight",
        "Every label letter read at 100% zoom before publish"
      ],
      sections: [
        {
          h2: "What You'll Learn",
          paras: [
            "You'll learn which of the five image tools fills which slot on your listing, the three-element formula that makes scene prompts work, and how the same reference photo feeds both image jobs and video jobs. Every step runs on the workspace's real parameters: square for product pages, 9:16 for stories, 24 credits per image, cost shown before the job starts, failed jobs refunded."
          ]
        },
        {
          h2: "Why One Photo Is the Whole Budget",
          img: IMG.photoSourceClear,
          paras: [
            "Everything the generator knows about your product comes from the reference photo you upload. The model reproduces shape, color, material and visible details from it — which means a sharp, honest source photo is the entire quality budget. Daylight, plain background, front-facing: that's the brief for the photo that starts everything. Blurry or dim sources produce blurry or dim results, and no prompt can rescue them.",
            "The upside of this discipline is enormous: the same photo that anchors your images also anchors your videos, your model shots and your social crops. One good photo becomes a whole listing."
          ]
        },
        {
          h2: "Meet the AI Image Tool",
          paras: [
            "In the workspace's create menu, the [AI Image module](/app/create/custom) holds the five image tools: a custom image generator for anything you describe, plus dedicated [white background](/ai-image-generation/white-background-photos), [lifestyle](/ai-image-generation/lifestyle-photos), [change background](/ai-image-generation/change-background) and [model photo](/ai-image-generation/model-photos) tools. Each one takes the same input — reference photo plus a description — and returns images at the size you picked.",
            "The tools share the same pricing and the same guardrail: 24 credits per image, the cost shown before the job starts, and failed jobs refund automatically."
          ]
        },
        {
          h2: "Step 1: Upload One Clear Photo",
          paras: [
            "Open the AI Image tool in the workspace and upload your source photo. Check it before you continue: the product fully in frame, label readable, nothing casting hard shadows across the surfaces you want the generator to learn. This is also the moment to read every letter on the label — the generator reproduces what it sees, including the care tag hanging out of the collar."
          ]
        },
        {
          h2: "Step 2: Write the Scene With Three Elements",
          paras: [
            "A scene prompt needs exactly three elements, in this order — surface, light, neighbours. \"A green notebook on a wooden desk, soft window light, a pen and a desk tray beside it\" names all three, and the generator fills in the rest.",
            "The same formula powers the video version of the scene. Here's the real prompt behind the notebook example below — notice the surface, the light and the neighbour objects doing the same work inside a video prompt:"
          ],
          prompt: prompt(
            "Real prompt",
            "Green Notebook Desk Ritual · template wall",
            "This is a 30-second vertical TikTok product-promotion video, filmed on a phone in an authentic UGC style. Use natural light and a realistic everyday setting, and keep the image clear throughout. Image 1 shows the product for this video; the product must have no legible brand text.\n\nShot 1 [0-3 sec] Close-up: Seated at a wooden desk, she holds the green notebook and pen up to the camera. Spoken line: \"Desk tour. Everything here has a job.\"\nShot 2 [3-10 sec] Medium shot: She points to the wooden desk tray holding paper clips and sticky notes. Spoken line: \"This tray keeps all the little stuff in one spot, so my desk stays clear.\"\n\nNegative prompt: no extra or swapped product, no changed parts, no readable text or labels…",
            [
              { term: "Surface", text: "What the product sits on: \"a wooden desk\". The surface sets the texture base — the same wording works for images and video." },
              { term: "Light", text: "What light: \"natural light\". Light carries all the scene mood — changing the light changes the scene." },
              { term: "Neighbours", text: "One or two nearby objects: \"a wooden desk tray holding paper clips\". More than two and the product stops being the star." },
              { term: "Lock", text: "Product consistency comes from the reference photo in both image and video jobs — never re-describe the product in the prompt." }
            ],
            ["Same reference photo: images first, video after", "Surface = wooden desk · Light = natural light · Neighbours = desk tray"]
          )
        },
        {
          h2: "Step 3: Download, Check, Publish",
          img: IMG.photoSocialScene,
          paras: [
            "Download the square version for the listing and the vertical for stories. Then run the check: put the image next to the real product, compare color in daylight, count the visible parts, read every label letter at 100% zoom. Publish what passes; rerun what doesn't. A rerun costs minutes and, if the job fails outright, the credits come back automatically."
          ]
        },
        {
          h2: "Which Tool Fills Which Slot",
          paras: [
            "Each image type owns one slot of a listing. [White background photos](/ai-image-generation/white-background-photos) are the marketplace main image: square, clean, product filling the frame. [Lifestyle photos](/ai-image-generation/lifestyle-photos) are the gallery shots that show the product in a real scene. [Change background](/ai-image-generation/change-background) rescues old photos by swapping only what's behind the product. [Model photos](/ai-image-generation/model-photos) put clothes and accessories on a person. [Social ad photos](/ai-image-generation/social-ad-photos) crop and style for Facebook and Instagram placements. One source photo, five slots, no second shoot.",
            "A practical order that works for most shops: white background first (the main image unblocks the listing), then two lifestyle scenes, then the model shot if the product is wearable, and social crops last — social can wait; the listing cannot. Run them as separate jobs so a failed scene never blocks the main image.",
            "Marketplace rules stay yours to enforce: main-image requirements differ by category, so check the current rules before you upload. The generator makes the compliant image; the marketplace decides what's compliant."
          ]
        },
        {
          h2: "The Same Photo Can Move",
          video: video("notebook", "Real example: the same reference photo moving through the scene the prompt described — surface, light and neighbours all recognizable from the still image."),
          paras: [
            "Photos cover the listing; video covers the feed. The same reference photo starts an [image-to-video](/ai-video-generation/image-to-video) job, where the product moves inside the scene your prompt described — from 24 credits for a 6-second clip.",
            "Watch how the notebook, the pen and the desk keep their shape from the first frame to the last. That consistency is the reference photo working — the same reason your still images came out true."
          ]
        },
        {
          h2: "How Shops Use These Photos",
          paras: [
            "A jewelry brand runs every colorway on the same model and scene, so the collection page reads as one set. A kitchen brand replaces old supplier photos with lifestyle shots that match its brand colors. A dropshipper tests three scenes for one product before spending on ads — three images cost fewer credits than one poorly targeted campaign. An apparel shop fills its Instagram grid between real shoots with lifestyle shots and model photos from the same source.",
            "The pattern behind all four: one sharp source photo, the three-element formula, and a check before publish. The brands that skip the check are the ones whose listings drift."
          ]
        },
        {
          h2: "Common Mistakes",
          img: IMG.photoReview,
          paras: [
            "Crowding the scene: more than two neighbour objects and the product stops being the star. Keep one or two.",
            "Re-describing the product: the reference photo decides shape and color. Describing the product again invites drift — describe only the scene.",
            "Hiding the product: if the scene hides the product, the listing fails. Check the product fills the frame before you publish.",
            "Uploading a dim source: no prompt rescues a blurry reference. Reshoot the source in daylight first."
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
        { q: "Which tool for an Amazon main image?", a: "White background: square, clean background, product filling the frame. Always check the current marketplace rules for your category before publishing." },
        { q: "How much does one image cost?", a: "24 credits per photo, with the cost shown before the job starts. Plans run from $24.50 a month, and failed jobs refund their credits." },
        { q: "Can the same photo become a video?", a: "Yes — image-to-video runs from the same reference, from 24 credits for 6 seconds. The tutorial above shows the real example." },
        { q: "Will the product look exactly like mine?", a: "The reference photo anchors it. Compare the result with the real product — color in daylight, parts, every label letter — and rerun with a sharper photo if anything drifted." },
        { q: "Do I need design skills?", a: "No. Upload, describe the scene in three elements, download. Editing skills only matter for fine-tuning after." },
        { q: "Can I use the photos commercially?", a: "Yes — no watermark, yours to publish. The content policy still applies: no misleading claims, no presenting generated imagery as real customers." }
      ],
      related: [
        { label: "Model Photos", href: "/ai-image-generation/model-photos", text: "Your clothes and accessories on a reusable AI model." },
        { label: "Social Ad Photos", href: "/ai-image-generation/social-ad-photos", text: "Images styled for Facebook and Instagram placements." },
        { label: "AI Video Tutorial", href: "/blog/ai-ugc-video-ads-guide", text: "Turn the same photo into a video ad with a written prompt." },
        { label: "AI Avatar Tutorial", href: "/blog/model-photos-without-a-photoshoot", text: "The face behind your model photos and presenter videos." },
        { label: "Browse photo templates", href: "/templates?kind=photo", text: "Every photo example with the prompt behind it." },
        { label: "Pricing", href: "/pricing", text: "Credits per job, monthly plans, and automatic refunds." }
      ],
      ctaTitle: "Make Your First Scene",
      ctaLead: "Upload one product photo and write the three elements — surface, light, neighbours.",
      startNote: START_NOTE
    },
    videos: ["notebook"],
    promptCards: 1
  },

  // ── ③ Product Links — import-to-video tutorial ──────────────────────────
  {
    slug: "/blog/unboxing-videos-for-launches",
    h1: "Product Links Tutorial: From a URL to a Finished Video",
    label: "Product Links Tutorial",
    seo: {
      title: "Product Links Tutorial: URL to Video | AIVideosUGC",
      description: "Paste a product page once, then generate videos from real data. The unboxing AI product video guide as a hands-on import-to-launch tutorial with a real example.",
      primaryKeyword: "product links tutorial",
      keywords: "product links tutorial, URL to video, unboxing AI product video generator, product import, launch week videos"
    },
    data: {
      eyebrow: "Workspace Tutorial · Product Links",
      lead: "Every product you sell already has a page: photos, title, specs, price. The Product Links module imports that page into your workspace once, and every video job after that starts from real data instead of retyped notes. This tutorial walks the path — import, verify, generate — with a real unboxing example.",
      minutes: 6,
      checklist: [
        "Imported photos compared with the package customers actually receive",
        "Imported details matched against the live listing, not an old draft",
        "Box contents counted — the camera shows only what ships",
        "Packaging changed since import? Re-import and regenerate before launch"
      ],
      sections: [
        {
          h2: "What You'll Learn",
          paras: [
            "You'll learn how Product Links imports a product page into your library, what to check before you generate from imported assets, and how package-locked prompts keep the box honest. The example is a real unboxing clip generated on this site — the same launch-week structure you'll build in step three."
          ]
        },
        {
          h2: "What Product Links Actually Does",
          paras: [
            "Paste a product page URL, and the importer brings the listing into your workspace as a product card: the photos, the title, the details. From then on, every tool in the workspace can start from that card. Briefs reuse the real specs instead of your memory of them; prompts reference photos that came from the listing itself.",
            "The import also changes where errors come from. When you type product details by hand, typos become wrong claims in finished videos. When the details come from the import, the error to guard against is different: the listing itself being out of date. That's what step two is for."
          ]
        },
        {
          h2: "Meet Product Links",
          paras: [
            "In the workspace's create menu, [Product Links](/app/create/product) is the import surface: paste a URL, confirm, and the product card lands in your [library](/app/create/library) with the listing's photos and details attached.",
            "One import serves every later job — video ads, unboxings, product demos, even image sets. It's the reason a two-person team can run a whole launch week without writing the same product description twice."
          ]
        },
        {
          h2: "Step 1: Paste the Product URL",
          paras: [
            "Open Product Links, paste the URL, confirm the import. The card appears in your library in seconds. Nothing is generated yet — the import only gathers the raw material your next jobs will use.",
            "Products you import stay in the library for reuse: the same card feeds next month's variant videos and the image set for a new marketplace. Most shops import once per product and never touch Product Links again until the listing changes — the card only needs re-importing when the page itself changes."
          ]
        },
        {
          h2: "Step 2: Check What Got Imported",
          img: IMG.unboxReady,
          paras: [
            "Imported photos are supplier photos until you verify them, and supplier photos go stale. Open the product card and confirm three things. First: the photos show the package customers actually receive today — listings often carry last season's packaging. Second: the details match the live listing you're selling from, not a draft from months ago. Third: nothing ships in the box that the camera won't see — if the video shows tissue paper, the box needs tissue paper.",
            "This check takes two minutes and prevents the classic launch failure: a video that shows a box nobody receives. If the packaging changed, re-import and regenerate — the clip must always match what ships."
          ]
        },
        {
          h2: "Step 3: Generate From the Product Card",
          paras: [
            "Start a video from the product card; the reference photos come from the import. For unboxing and packaging shots, lock the package in the prompt — here's the real prompt behind the example below:"
          ],
          prompt: prompt(
            "Real prompt",
            "Sealed Box Order Unboxing · template wall",
            "This is a 30-second vertical TikTok Shop product-promotion video, filmed on a phone in an authentic UGC style. Use natural light and a realistic everyday setting, and keep the image clear throughout.\n\nShot 1 [0-3 sec] Close-up: In the living room, she holds a sealed cardboard box up to the camera. Spoken line: \"It finally came. Let's open it.\"\nShot 2 [3-9 sec] Medium shot: She slices through the packing tape and opens the box flaps. Spoken line: \"I've been waiting on this all week.\"\n\nNegative prompt: no readable text, numbers, signs or labels anywhere in the frame; no logos, brand marks or watermark; no extra or swapped product…",
            [
              { term: "Box lock", text: "In an unboxing clip the \"product\" is the box itself: the reference photo locks the packaging, and the Negative prompt bans readable text — stray shipping-label characters are the easiest way a clip breaks." },
              { term: "Beat order", text: "Hold the box → slice the tape → lift the lid → take the item out, one step per shot. The satisfaction of an unboxing comes from an order that never skips." },
              { term: "Spoken lines", text: "Spoken anticipation: \"It finally came\" / \"I've been waiting on this all week\" — buyer's words, not ad copy." }
            ],
            ["Package lock: the box is the product", "Unboxing rhythm: box → tape → lid", "Negative prompt bans text and watermarks first"]
          ),
        },
        {
          h2: "Why the Package Lock Matters",
          paras: [
            "The lock is what keeps launch honest: the box in the clip is the box the shopper opens. The reveal is the beat shoppers remember — closed box, the slice open, the first item lifted out. Every part of that memory has to match the delivery they actually receive, or the ad costs you trust instead of building it.",
            "That's also why imported assets beat typed descriptions for launch content: the import carries the photos of the package as it ships today, and step two made sure those photos are current."
          ]
        },
        {
          h2: "Where Launch Week Goes From Here",
          video: video("sealedBox", "Real example: sealed box → slice → first item. Every shot's packaging matches the prompt's lock, and the unboxing order follows the Shot timeline exactly."),
          paras: [
            "One import powers the whole launch. The teaser and the reveal work at 6 or 10 seconds — 24 or 40 credits; the closer look has room at 15 — 60 credits. Keep one [AI presenter](/ai-actors) across the set so the same face opens the teaser, lifts the lid, and demonstrates the action. Burn the launch date and the early price in [Subtitle Studio](/app/create/subtitles) — typed by you, never generated.",
            "A home goods brand runs the teaser three days out, the reveal on launch morning, and the closer look the same evening — one import, one presenter, one afternoon of generation. A gift brand runs the reveal in two languages for two markets; the storyboard and the box stay identical, only the voice changes. When you want the prompt-level view for the ad itself, the [AI video prompt tutorial](/blog/ai-ugc-video-ads-guide) picks up where this import leaves off."
          ]
        },
        {
          h2: "Common Mistakes",
          paras: [
            "Trusting supplier photos blindly: compare imported photos with the real package — old listings often carry outdated packaging.",
            "Generating from the old box: packaging changed? Re-import and regenerate. The clip must match what ships.",
            "Letting the camera show extras: if the video shows tissue paper, the box needs tissue paper — show only what ships.",
            "Retyping specs into prompts: the import already has them. Retyped details drift; imported details don't."
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
        { q: "Does the importer work with any store?", a: "It works with standard product pages. After import, always verify photos and details against the live listing before generating." },
        { q: "Can I still start from a photo instead?", a: "Yes — every tool also accepts a direct photo upload. Product Links just removes the retyping." },
        { q: "What if the video shows the wrong item?", a: "Rerun with clearer photos and a description of the exact box contents. Compare the finished clip with the real package before it goes live." },
        { q: "What does the launch set cost?", a: "Teaser and reveal work at 6-10s (24-40 credits); the closer look at 15s (60 credits). Costs show before each job, and failed jobs refund." },
        { q: "Can the same import feed photo jobs too?", a: "Yes — the product card's photos work for image tools the same way they work for video." },
        { q: "Do I keep rights to the clips?", a: "Yes. Files come without a watermark and are yours to publish and promote with." }
      ],
      related: [
        { label: "AI Video Tutorial", href: "/blog/ai-ugc-video-ads-guide", text: "The prompt anatomy behind the clips you generate." },
        { label: "Text to Video Tutorial", href: "/blog/ai-video-review-checklist", text: "Storyboard the launch set with the agent first." },
        { label: "Unboxing examples", href: "/ai-video-generation/unboxing-experience", text: "Finished unboxing clips with the full prompt behind them." },
        { label: "53 AI actors", href: "/ai-actors", text: "Save one presenter for the whole launch set." },
        { label: "Occasions: sale, Black Friday, holidays", href: "/occasions", text: "Launch-adjacent formats by calendar." },
        { label: "Pricing", href: "/pricing", text: "Credits per job, monthly plans, and automatic refunds." }
      ],
      ctaTitle: "Import Your First Product",
      ctaLead: "Paste a link, check the assets, and generate from the product card.",
      startNote: START_NOTE
    },
    videos: ["sealedBox"],
    promptCards: 1
  },

  // ── ④ Text to Video — the agent tutorial ────────────────────────────────
  {
    slug: "/blog/ai-video-review-checklist",
    h1: "Text to Video Tutorial: Brief the AI Video Agent",
    label: "Text to Video Tutorial",
    seo: {
      title: "Text to Video Tutorial: Brief the Agent | AIVideosUGC",
      description: "One written line becomes an editable storyboard. The AI video ad checklist guide, rebuilt as a Text to Video agent tutorial — brief, storyboard, generate, review.",
      primaryKeyword: "text to video tutorial",
      keywords: "text to video tutorial, AI video agent, video storyboard, AI video ad checklist, AI video ads generator"
    },
    data: {
      eyebrow: "Workspace Tutorial · Text to Video",
      lead: "The hardest part of any video is the blank page. The AI Video Agent removes it: one written line becomes an editable storyboard, scene by scene, with actions and voice lines — and nothing generates until you approve it. This tutorial walks brief → storyboard → generate → review.",
      minutes: 6,
      checklist: [
        "Product matches the real item: color, parts, every label letter",
        "Watched on a phone, sound on, subtitles read line by line",
        "Every promised difference happens on camera",
        "Price, dates and codes typed by you — never generated",
        "Platform AI-content labels applied; no AI face presented as a buyer"
      ],
      sections: [
        {
          h2: "What You'll Learn",
          paras: [
            "You'll learn how to write a one-line brief the agent can storyboard, how to edit the storyboard before any credits are spent, and the five-minute review that runs between download and publish. If you've read this article's earlier checklist version, that checklist now lives inside step three — the workflow absorbed it."
          ]
        },
        {
          h2: "What the Agent Does Differently",
          paras: [
            "The [Text to Video agent](/ai-video-generation/text-to-video) sits one step before the generator. You describe the video in a sentence or two; the agent returns an editable storyboard — scenes in order, each with an action and a voice line. You edit that storyboard as text: reorder scenes, sharpen actions, rewrite lines. Only when you approve does the workspace spend credits generating.",
            "The scene selector frames the storyboard before you write: AI presenter (an on-camera creator introduces the product), product demo (step-by-step how it works), or product close-up (texture and packaging detail). Picking the scene is half the brief."
          ]
        },
        {
          h2: "Meet the AI Video Agent",
          img: IMG.unboxClips,
          paras: [
            "In the workspace's create menu, [Text to Video](/app/create/agent) is the planning surface: pick a scene, write the brief, and the storyboard comes back as editable text. It's the module to open when you know what you want to say but not yet how the video should go.",
            "The agent plans; the [AI Video module](/app/create/tool/video-ads#step-video) executes. Teams that use both describe the difference simply: the agent decides what happens, the prompt decides how it looks."
          ]
        },
        {
          h2: "Step 1: Write the One-Line Brief",
          paras: [
            "A good brief names three things: the product, the audience moment, and the structure you want. \"Teaser, reveal, and closer look for a ceramic travel mug, natural morning light\" gives the agent everything it needs — product to show, shopper moment to serve, and the shape of the story. Structure words work like templates: hook-demo-close for a single ad, teaser-reveal-closer for a launch set, fit-check-fabric-style for apparel. The names are plain — the hook is the first three seconds, the demo is the showing, the close is the ask — and the same three beats travel through every short ad, including the unboxing and apparel guides on this blog.",
            "A weaker brief reads like a spec sheet: \"30-second product ad for a power bank, 9:16, show features.\" It technically works — the scene selector and the generator carry it — but every choice the brief leaves out is a choice the storyboard makes for you. Naming the shopper moment (a commuter topping up before a flight) and the structure (demo-then-close) is how the storyboard comes back already half-decided the way you wanted.",
            "What a brief doesn't need: product descriptions (the reference photos already carry them), camera jargon, or shot timings — the agent budgets those. Keep the line human; you can be surgical in the storyboard."
          ]
        },
        {
          h2: "Step 2: Edit the Storyboard Before Generating",
          paras: [
            "The storyboard comes back scene by scene. Read it like a contract: each scene is an action, each voice line is something the presenter will actually say. Reorder what flows wrong, sharpen what's vague, rewrite lines that sound like ads into lines that sound like speech. What you approve is what generates — the surprise belongs in the video, not in the bill.",
            "Editing costs nothing. Credits are spent only when a generation job runs, with the cost shown before it starts. This is the cheapest quality gate you will ever have: every fix here is a fix you don't pay to discover later."
          ]
        },
        {
          h2: "See a Storyboarded Clip",
          video: video("powerBank", "Real example: a storyboarded unbox-then-action clip — out of the box, into the hand, snapping onto the phone. Three scenes, three actions, each editable in the storyboard before generation."),
          paras: [
            "This unboxing clip is the kind of result a storyboard produces: three scenes, three actions, one product — each beat editable in text before a single credit was spent."
          ]
        },
        {
          h2: "Worked Example: A Real Demo Brief",
          paras: [
            "The workspace ships curated demo briefs you can open directly — no typing needed. One of them, the skincare presenter intro, is a complete agent brief in a single sentence:"
          ],
          prompt: prompt(
            "Real demo brief",
            "Skincare Presenter Intro · workspace demo",
            "Create a natural AI presenter introduction to my skincare serum. Show the bottle and dropper, use only the product details I provide, and end with an invitation to learn more.",
            undefined,
            ["Ships with the workspace: /app/create/demo/skincare-presenter-agent", "Scene: AI presenter · 9:16 · 15s"]
          )
        },
        {
          h2: "How the Agent Reads That Brief",
          paras: [
            "Read the brief in three moves. \"Introduction to my skincare serum\" opens the storyboard: the presenter, the bottle in hand, the hello. \"Show the bottle and dropper\" is the middle scene — a close-up that demonstrates, not just displays. \"Use only the product details I provide\" is the constraint the agent carries through every scene: no invented claims, no invented ingredients. \"End with an invitation\" writes the closing line. Three scenes, one per clause — the sentence was already the storyboard.",
            "Editing it is just as direct. Want a second benefit scene? Insert a scene line and the agent writes the voice line for it. Want the ending to point at the cart instead of a learn-more page? Rewrite the closing line in the storyboard before anything generates. This is the cheapest moment to steer the video — after the plan exists, before the credits move."
          ]
        },
        {
          h2: "Step 3: Generate, Then Run the Five-Minute Review",
          img: IMG.reviewMotion,
          paras: [
            "After download, run the review before publishing. Watch the clip on a phone at full volume, read the subtitles against the voice, compare the product with the real thing, and confirm rights and platform labels. The full list sits at the end of this guide.",
            "Fix what fails at the cheapest level: one wrong scene regenerates alone; wrong words burn in with [Subtitle Studio](/app/create/subtitles); a wrong script regenerates from a better brief — credits for failed jobs return automatically."
          ]
        },
        {
          h2: "From One Storyboard to a Campaign",
          paras: [
            "Approve a storyboard once and it becomes reusable infrastructure. The same storyboard reruns with a different voice language for another market — the face and pacing stay identical. Swap the product reference for the next SKU and the structure carries. A two-person shop storyboards its launch set on Monday, generates between customer emails, and schedules all three clips from the [library](/app/create/library). An agency keeps approved briefs in Teams & Brands so every client's videos use reviewed wording.",
            "For the prompt-level view of what happens after the storyboard — the six-part anatomy the generator follows — read the [AI video prompt tutorial](/blog/ai-ugc-video-ads-guide). The two guides are halves of one workflow: the agent plans it, the prompt executes it."
          ]
        },
        {
          h2: "Common Mistakes",
          paras: [
            "Approving the storyboard unread: the storyboard is the contract — edit actions and lines before credits are spent.",
            "Skipping the phone review: the audience meets the clip on a phone; review it there first, sound on.",
            "Over-specifying the brief: shot timings and camera jargon belong to the storyboard stage — briefs that micromanage them box the agent in.",
            "Regenerating whole clips for word fixes: Subtitle Studio fixes captions and promo lines on the finished file — no regeneration needed."
          ]
        }
      ],
      tryBox: {
        title: "Try the AI Video Agent",
        text: "Write one line and get an editable storyboard — editing is free, and nothing generates until you approve it.",
        href: "/app/create/agent",
        label: "Open the agent",
        more: { label: "How Text to Video works", href: "/ai-video-generation/text-to-video" }
      },
      faq: [
        { q: "Does the agent cost credits to storyboard?", a: "No — editing the storyboard costs nothing. Credits are spent when a generation job runs, with the cost shown before it starts." },
        { q: "Can the agent plan a multi-clip launch?", a: "Yes — describe the set in one brief (\"teaser, reveal, closer look\") and the storyboard comes back scene by scene." },
        { q: "What scenes can the agent plan for?", a: "Three: AI presenter, product demo, and product close-up. The scene shapes which shots the storyboard proposes." },
        { q: "Do failed jobs cost credits?", a: "No — credits return to your balance automatically." },
        { q: "Can teammates review the storyboard?", a: "Yes — Teams & Brands stores shared product facts so briefs use reviewed wording across the team." },
        { q: "What's the difference between the agent and AI Video?", a: "The agent plans (brief → editable storyboard); AI Video executes (prompt + photos → clip). Use both: plan with the agent, generate with AI Video." }
      ],
      related: [
        { label: "AI Video Tutorial", href: "/blog/ai-ugc-video-ads-guide", text: "The six-part prompt the generator follows after the storyboard." },
        { label: "Product Links Tutorial", href: "/blog/unboxing-videos-for-launches", text: "Import the product page once, storyboard from real data." },
        { label: "Subtitle Studio", href: "/app/create/subtitles", text: "Burn in subtitles, promo lines, or product copy after download." },
        { label: "Content Policy", href: "/content", text: "What generated content can and cannot claim." },
        { label: "How-to Guides", href: "/guides", text: "Step-by-step workspace tutorials." },
        { label: "Pricing", href: "/pricing", text: "Credits per job, monthly plans, and automatic refunds." }
      ],
      ctaTitle: "Brief the Agent",
      ctaLead: "One line in, an editable storyboard out — approve it, generate, review in five minutes.",
      startNote: START_NOTE
    },
    videos: ["powerBank"],
    promptCards: 0
  },

  // ── ⑤ AI Avatar — presenter tutorial ────────────────────────────────────
  {
    slug: "/blog/model-photos-without-a-photoshoot",
    h1: "AI Avatar Tutorial: Presenters, Voices and Languages",
    label: "AI Avatar Tutorial",
    seo: {
      title: "AI Avatar Tutorial: Presenters & Voices | AIVideosUGC",
      description: "Pick from 53 AI presenters, audition voices in nine languages, save the face, and lock it in prompts. The virtual model photos guide, rebuilt as an avatar casting tutorial.",
      primaryKeyword: "AI avatar tutorial",
      keywords: "AI avatar tutorial, AI actors, AI presenter, model photos without a photoshoot, AI virtual model, AI actor voices"
    },
    data: {
      eyebrow: "Workspace Tutorial · AI Avatar",
      lead: "A casting day costs more than most products earn in a month — and it buys you one face for one shoot. The AI Avatar module holds 53 presenters across 31 scenes, five age ranges and nine languages, and the face you pick can carry every clip and every model photo you ever publish. This tutorial walks pick → audition → save → reuse.",
      minutes: 7,
      checklist: [
        "Scene chosen before the face — the vibe leads the casting",
        "Voice auditioned for the tone that survives twenty clips, not one",
        "Presenter profile saved and reused across video and photos",
        "Character lock written with three look-attributes max"
      ],
      sections: [
        {
          h2: "What You'll Learn",
          paras: [
            "You'll learn how to browse the actor library by scene, gender and age; how to audition voices in nine languages; how to save one presenter for reuse across every product; and how the Character part of a prompt locks a person so they stay identical from clip to clip — the difference between a campaign and a collage."
          ]
        },
        {
          h2: "What the Avatar Library Holds",
          img: IMG.modelWork,
          paras: [
            "The [AI actor directory](/ai-actors) lists 53 presenters — 39 women, 14 men — across 31 scenes: cafe, gym, studio, bedroom, kitchen, car, and on. Five age ranges keep the casting honest for your audience. The [workspace module](/app/create/actors) is where casting happens: browse, preview voices, and save the presenter you'll reuse. You can also add your own portrait to the workspace, which is how a founder ends up presenting their own product without ever sitting under a light.",
            "One fact matters before anything else: the avatar is generated. It presents your product; it is never presented as a real buyer or reviewer. Platforms increasingly require AI-content labels, and the [content policy](/content) is explicit — the presenter is a presenter, not a testimonial."
          ]
        },
        {
          h2: "Meet the AI Avatar Module",
          paras: [
            "In the workspace's create menu, [AI Avatar](/app/create/actors) is the casting surface: browse presenters with their scenes, preview voices, and save the profile you'll reuse. The public directory pages — [women](/ai-actors/women), [men](/ai-actors/men), scenes and age ranges — mirror the same library, so you can shortlist before you even log in.",
            "Casting feeds everything else: the presenter you save appears in your video jobs, and the same face works across [model photos](/ai-image-generation/model-photos) for still product pages."
          ]
        },
        {
          h2: "Step 1: Pick the Face — Scene First",
          paras: [
            "Browse by scene before you browse by face. The scene decides the vibe — a cafe presenter reads casual, a studio presenter reads premium, a gym presenter reads energetic — and the vibe is what your audience meets before they hear a word. Then filter by gender and age range to match who you're selling to. Shortlist two or three; don't fall for the first face that looks good in a thumbnail."
          ]
        },
        {
          h2: "Step 2: Audition the Voice",
          paras: [
            "Preview voices before you commit. The same face ships with voice options, and the language is a per-job choice across nine languages — English, Spanish, Portuguese, Japanese, Korean, Thai, Vietnamese, Bahasa Indonesia and Chinese. One audition rule: pick the tone you can live with across twenty clips, not the one that impresses once. Campaigns are marathons; a quirky voice ages fast.",
            "Auditioning takes a minute per presenter: open the profile, play the sample, imagine the line you'll actually use. If you will run the presenter in a second language, audition that voice too — delivery styles do not translate one-to-one, and the best English voice is not always the best Spanish one."
          ]
        },
        {
          h2: "Step 3: Save the Presenter, Write the Character",
          paras: [
            "Save the presenter profile and reuse it everywhere. In prompts, the Character part locks the person — here's the real Character block from the template wall, with why each word is there:"
          ],
          prompt: prompt(
            "Real prompt",
            "Washed Graphic Tee Fit Check · the Character part",
            "Character: a woman in her twenties, with short hair, no jewelry. The person speaks directly to the phone camera throughout in relaxed, natural American English, with a warm, conversational tone, as if sharing a great new find with a friend. Keep the delivery at a natural pace, without sounding like a presenter.\n\nShot 1 [0-3 sec] Medium shot: A phone on a tripod faces her as she holds up the washed graphic T-shirt with both hands in a bright bedroom. Spoken line: \"Fit check. This is the tee everyone keeps asking about.\"",
            [
              { term: "Look", text: "Three look-attributes: age range + hair + jewelry choice. The shorter the steadier — every extra adjective adds another drift point." },
              { term: "Voice", text: "The voice lock: language + tone + the posture of speaking to camera (\"speaks directly to the phone camera\")." },
              { term: "Tone guard", text: "\"without sounding like a presenter\" — one negative phrase that keeps the announcer voice out." }
            ],
            ["Age + hair + jewelry = the look lock", "Language + tone = the voice lock", "\"not a presenter\" = the announcer guard"]
          ),
          },
        {
          h2: "See the Same Face Work",
          video: video("teeFit", "Real example: the same presenter carries the fit check — mirror beat, fabric close-up, tucked and untucked. The person holds to the Character lock from first frame to last."),
          paras: [
            "Three attributes, one sentence of delivery, one guard. Anything more and you're not locking the person, you're hoping. This fit-check clip is the result: one presenter, one garment, every beat holding to the Character lock from first frame to last."
          ]
        },
        {
          h2: "One Face Across Every Channel",
          img: IMG.modelSetting,
          paras: [
            "The saved presenter is not video-only. The same face works across [model photos](/ai-image-generation/model-photos) — your clothing on the avatar in stills for product pages — so the marketplace, the Instagram grid and the video ads all read as one person. Apparel brands run the whole color set this way: one model, one scene, every colorway. Jewelry and eyewear follow the same path with close-up care: count the stones, check the clasps.",
            "Consistency is the compounding part. A shopper who sees the same presenter in your TikTok ad, your product page photos and your launch clip builds recognition the way they would with a hired creator — except this one works in nine languages and never books a vacation."
          ]
        },
        {
          h2: "Where Avatars Show Up",
          paras: [
            "Presenter showcase ads: the avatar introduces the product to camera with spoken lines and subtitles. UGC-review style clips: phone-held, casual, first-person. Launch sets: the same face across teaser, reveal and closer look. Fashion: fit checks and [try-on reels](/ai-video-generation/fashion-try-on-reel), with the still model photos from the same face. And because the Character lock is text, a campaign can rerun in a second language overnight — same person, new market."
          ]
        },
        {
          h2: "Common Mistakes",
          paras: [
            "Changing the face between clips: save the presenter and reuse the profile — one face per campaign reads as one brand.",
            "Over-describing the person: three look-attributes max; long Character blocks drift.",
            "Picking the voice by novelty: twenty clips with the same voice — audition for the tone that survives repetition.",
            "Presenting the avatar as a real buyer: never present a generated face as a real customer or reviewer — label per platform rules."
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
        { q: "How many actors are there?", a: "53 AI actors — 39 women, 14 men — across 31 scenes and five age ranges. Browse the public directory at /ai-actors before opening the workspace." },
        { q: "Can one presenter speak multiple languages?", a: "Yes — language is a per-job choice across nine options, with the same face and pacing." },
        { q: "Can I use my own face?", a: "Yes — the module accepts your own portrait. Voice training is not connected yet." },
        { q: "Does the same avatar work in photos?", a: "Yes — the saved face works across model photos for product pages, so video and stills stay one person." },
        { q: "Do I have to label the content as AI?", a: "Follow each platform's current rules. Constant everywhere: never present a generated face as a real buyer or reviewer." },
        { q: "How much does a clip with a presenter cost?", a: "Same as any video: 24 credits for 6 seconds up to 120 for 30 seconds, shown before the job starts." }
      ],
      related: [
        { label: "AI Image Generator Tutorial", href: "/blog/ai-product-photography-guide", text: "The model-photo workflow behind your still pages." },
        { label: "AI Video Tutorial", href: "/blog/ai-ugc-video-ads-guide", text: "The prompt anatomy the presenter follows." },
        { label: "Fashion try-on reel", href: "/ai-video-generation/fashion-try-on-reel", text: "Turn the same garment photo into video." },
        { label: "Browse every video template", href: "/templates?kind=video", text: "Open any example to see the full prompt behind it." },
        { label: "How-to Guides", href: "/guides", text: "Step-by-step workspace tutorials." },
        { label: "Pricing", href: "/pricing", text: "Credits per job, monthly plans, and automatic refunds." }
      ],
      ctaTitle: "Cast Your Presenter",
      ctaLead: "Pick the face, audition the voice, save the profile — and write the Character lock.",
      startNote: START_NOTE
    },
    videos: ["teeFit"],
    promptCards: 1
  }
];

// Blog index (/blog) copy patch. The five cards take the tutorial titles and
// fresh summaries; everything else in the row stays as published.
export const INDEX_PATCH = {
  slug: "/blog",
  data: {
    eyebrow: "Workspace Tutorials · Five Tools, Five Guides",
    lead: "The workspace turns product photos into video ads, photo sets and launch clips. Five tutorials — one per module — teach the workflows with real examples, real prompts, and the checks that keep them honest.",
    intro: [
      "Every guide here pairs one workspace module with one skill: the AI Image module and scene prompts, the AI Video module and prompt anatomy, Product Links and the import-to-launch path, the Text to Video agent and storyboard briefs, and the AI Avatar module and presenter casting. The features, the credit costs and the review steps match what you'll see when you open the workspace — and each guide embeds a real example generated on this site, with the prompt behind it.",
      "Start with the module your next job needs. Each tutorial ends at the tool itself, you can open the workspace without an account, and every job shows its credit cost before it starts."
    ],
    steps: [
      { t: "Pick the Module", d: "Choose the tutorial for the tool your next job needs." },
      { t: "Follow the Steps", d: "Each guide teaches a real workflow against a real example." },
      { t: "Make One File and Check It", d: "Open the workspace tool, make the file, review it, then publish." }
    ],
    articles: {
      "/blog/ai-ugc-video-ads-guide": {
        title: "AI Video Tutorial: Write Product Ad Prompts That Work",
        summary: "Write the six-part prompt the generator follows — taught part by part against a real template-wall example."
      },
      "/blog/ai-product-photography-guide": {
        title: "AI Image Generator Tutorial: Product Photos From One Shot",
        summary: "Five image tools, one source photo, and the three-element scene formula — with the same photo becoming video."
      },
      "/blog/unboxing-videos-for-launches": {
        title: "Product Links Tutorial: From a URL to a Finished Video",
        summary: "Import the product page once, verify the assets, and generate launch-week clips from real data."
      },
      "/blog/ai-video-review-checklist": {
        title: "Text to Video Tutorial: Brief the AI Video Agent",
        summary: "One line becomes an editable storyboard — brief it, edit it, generate, then run the five-minute review."
      },
      "/blog/model-photos-without-a-photoshoot": {
        title: "AI Avatar Tutorial: Presenters, Voices and Languages",
        summary: "53 presenters, nine languages, one saved face across every clip and product page — casting taught step by step."
      }
    }
  }
};
