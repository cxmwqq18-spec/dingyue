import { talkingHeadVideoContent } from "./seed-mydreamshoots-talking-head-video-content";

export type AiVideoTopicImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** Focal point used by the shared 16:9 storefront media frame. */
  objectPosition?: string;
};

export type AiVideoTopicVideo = {
  src: string;
  poster: string;
  label: string;
  width: number;
  height: number;
  fit: "cover" | "contain";
};

export type AiVideoTopicCard = {
  title: string;
  body: string;
  image?: AiVideoTopicImage;
  noteLabel?: string;
  noteBody?: string;
  exampleLabel?: string;
  exampleBody?: string;
  details?: Array<{ label: string; body: string }>;
  href?: string;
  linkLabel?: string;
};

export type AiVideoTopicUseCase = AiVideoTopicCard & {
  problem: string;
  cta: string;
  image: AiVideoTopicImage;
  scenarioLabel?: string;
};

export type AiVideoTopicFoundation = {
  eyebrow: string;
  title: string;
  intro: string;
  leftTitle: string;
  leftItems: string[];
  rightTitle: string;
  rightItems: string[];
  rightTone?: "avoid" | "neutral";
  expertLabel?: string;
  expertTip: string;
  cards?: AiVideoTopicCard[];
};

export type AiVideoTopicGuidance = {
  eyebrow: string;
  title: string;
  intro?: string;
  cards: AiVideoTopicCard[];
};

export type AiVideoTopicSection = {
  eyebrow: string;
  title: string;
  intro?: string;
  items: Array<{ title: string; body: string }>;
  image?: AiVideoTopicImage;
};

export type AiVideoTopicFaqItem = {
  question: string;
  answer: string;
};

export type AiVideoTopicLandingContent = {
  seo: {
    title: string;
    description: string;
    keywords: string;
    canonicalPath: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    body: string;
    primaryCta: string;
    secondaryCta: string;
    availabilityNote: string;
    rightsCopy: string;
    imageNote: string;
    image: AiVideoTopicImage;
    video?: AiVideoTopicVideo;
    images?: AiVideoTopicImage[];
    highlights?: string[];
    mediaAspectRatio?: string;
    imageFit?: "cover" | "contain";
  };
  quickAnswer?: AiVideoTopicGuidance;
  useCases: {
    eyebrow: string;
    title: string;
    intro: string;
    items: AiVideoTopicUseCase[];
  };
  /** @deprecated Legacy duplicate gallery content is intentionally not rendered. */
  gallery?: {
    eyebrow: string;
    title: string;
    intro: string;
    items: AiVideoTopicCard[];
    cta?: string;
    ctaHref?: string;
  };
  foundation: AiVideoTopicFoundation;
  guidance: AiVideoTopicGuidance;
  platformExamples?: {
    eyebrow: string;
    title: string;
    intro: string;
    items: AiVideoTopicCard[];
  };
  comparison?: {
    eyebrow: string;
    title: string;
    intro: string;
    items: AiVideoTopicCard[];
  };
  evidence?: AiVideoTopicGuidance;
  examples?: AiVideoTopicGuidance;
  steps: {
    eyebrow: string;
    title: string;
    items: Array<{ title: string; body: string }>;
    cta: string;
  };
  value: AiVideoTopicSection;
  trust: AiVideoTopicSection;
  faq: {
    eyebrow: string;
    title: string;
    items: AiVideoTopicFaqItem[];
  };
  finalCta: {
    eyebrow: string;
    title: string;
    body: string;
    cta: string;
    microcopy: string;
  };
};

function imageAlt(value: string): string {
  let cleaned = value
    .replace(/\s*,?\s*without (?:nutrition|diagnostic) claims\.?$/i, "")
    .replace(/\s*,?\s*used as (?:the )?(?:dedicated )?(?:an? )?[^.]+(?:reference|frame)\.?$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length > 118) {
    const firstClause = cleaned.split(",")[0]?.trim();
    cleaned = firstClause && firstClause.length >= 24 ? firstClause : `${cleaned.slice(0, 117).replace(/\s+\S*$/, "")}`;
  }
  return cleaned.replace(/[,.]+$/, "").trim();
}

const youtubeCardAssetMap: Record<string, string> = {
  "youtube-card-01": "/assets/dreamshoot/generated/video-topic-clean/youtube-video/youtube-card-01.webp",
  "youtube-card-02": "/assets/dreamshoot/generated/video-topic-clean/youtube-video/youtube-card-02.webp",
  "youtube-card-03": "/assets/dreamshoot/generated/video-topic-clean/youtube-video/youtube-card-03.webp",
  "youtube-card-04": "/assets/dreamshoot/generated/video-topic-clean/youtube-video/youtube-card-04.webp",
  "youtube-card-05": "/assets/dreamshoot/generated/video-topic-clean/youtube-video/youtube-card-05.webp",
  "youtube-card-06": "/assets/dreamshoot/generated/video-topic-clean/youtube-video/youtube-card-06.webp"
};
const youtubeAssetMap: Record<string, string> = {
  ...youtubeCardAssetMap,
  "youtube-video-full-tutorial": youtubeCardAssetMap["youtube-card-01"],
  "youtube-video-review-comparison": youtubeCardAssetMap["youtube-card-02"],
  "youtube-video-interview-conversation": youtubeCardAssetMap["youtube-card-03"],
  "youtube-video-case-study": youtubeCardAssetMap["youtube-card-04"],
  "youtube-video-webinar-recap": youtubeCardAssetMap["youtube-card-05"],
  "youtube-video-series-episode": youtubeCardAssetMap["youtube-card-06"],
  "youtube-video-01": youtubeCardAssetMap["youtube-card-04"],
  "youtube-video-02": youtubeCardAssetMap["youtube-card-01"],
  "youtube-video-03": youtubeCardAssetMap["youtube-card-01"],
  "youtube-video-04": youtubeCardAssetMap["youtube-card-03"],
  "youtube-video-05": youtubeCardAssetMap["youtube-card-02"],
  "youtube-video-06": youtubeCardAssetMap["youtube-card-06"],
  "youtube-video-07": youtubeCardAssetMap["youtube-card-05"]
};

function image(src: string, alt: string, width: number, height: number, objectPosition?: string): AiVideoTopicImage {
  const canonicalSrc = src.replace(
    /^\/assets\/dreamshoot\/(tiktok-video|instagram-reels|social-media-video|story-video)\/([^/?#]+)\.(?:png|jpe?g|webp)(?:[?#].*)?$/i,
    "/assets/dreamshoot/generated/video-topic-clean/$1/$2.webp"
  ).replace(
    /^\/assets\/dreamshoot\/generated\/video-topic-media\/social-media-video\/social-media-video-01\.webp(?:[?#].*)?$/i,
    "/assets/dreamshoot/generated/video-topic-clean/social-media-video/social-media-video-01.webp"
  ).replace(
    /^\/assets\/dreamshoot\/youtube-video\/([^/?#]+)\.(?:png|jpe?g|webp)(?:[?#].*)?$/i,
    (_match, assetName: string) => youtubeAssetMap[assetName.toLowerCase()] ?? src
  );
  return { src: canonicalSrc, alt: imageAlt(alt), width, height, ...(objectPosition ? { objectPosition } : {}) };
}

function makeUseCaseCard(card: AiVideoTopicUseCase): AiVideoTopicUseCase {
  return card;
}

function guidanceCard(card: AiVideoTopicCard): AiVideoTopicCard {
  return card;
}

const cinematicImageRoot = "/assets/dreamshoot/cinematic-video";
const tiktokImageRoot = "/assets/dreamshoot/tiktok-video";
const instagramImageRoot = "/assets/dreamshoot/instagram-reels";
const socialImageRoot = "/assets/dreamshoot/social-media-video";
const youtubeImageRoot = "/assets/dreamshoot/youtube-video";
const memeImageRoot = "/assets/dreamshoot/meme-video";
const productImageRoot = "/assets/dreamshoot/product-video";
const productAdImageRoot = "/assets/dreamshoot/product-ad-video";
const promoImageRoot = "/assets/dreamshoot/promo-video";
const videoAdImageRoot = "/assets/dreamshoot/video-ad";
const brandVideoImageRoot = "/assets/dreamshoot/brand-video";
const musicVideoImageRoot = "/assets/dreamshoot/music-video";
const fashionVideoImageRoot = "/assets/dreamshoot/fashion-video";
const foodVideoImageRoot = "/assets/dreamshoot/food-video";
const petVideoImageRoot = "/assets/dreamshoot/pet-video";

export const aiVideoTopicLandingContentByKey: Record<string, AiVideoTopicLandingContent> = {
  "motion-generator": {
    seo: {
      title: "AI Motion Generator – Animate Photos Into Short Videos | myDreamshoots",
      description: "Animate an approved photo into a short, coherent video with controlled subject movement, camera motion, pacing, and visual continuity.",
      keywords: "AI motion generator, photo motion generator, animate photo, image to video motion, AI photo animation, motion video maker",
      canonicalPath: "/ai-video-generation/motion-generator"
    },
    hero: {
      eyebrow: "AI MOTION GENERATOR",
      title: "Animate a Still Image With Deliberate Motion",
      body: "Start with one approved image, define the movement that matters, and review a short video that keeps the subject, framing, and visual details coherent.",
      primaryCta: "Open Motion Generator",
      secondaryCta: "Review Motion Examples",
      availabilityNote: "Review the current video tools and credit cost inside your signed-in workspace.",
      imageNote: "Controlled portrait motion with a clear subject anchor.",
      image: { src: "/assets/dreamshoot/generated/pack-galleries/ai-video-add-ons/ai-video-add-ons-01.webp", alt: "Portrait scene prepared for controlled AI motion generation", width: 1200, height: 1200 },
      caption: "One approved image, one motion direction, one reviewable clip.",
      rightsCopy: "Use images you own or have permission to animate. Review the full result before publishing."
    },
    foundation: {
      eyebrow: "START WITH A CLEAR MOTION FOUNDATION",
      title: "Define the Motion Before You Generate",
      intro: "A useful motion brief gives the subject, camera, environment, pace, and continuity rules a clear job.",
      leftTitle: "What makes motion useful",
      leftItems: ["One recognizable subject anchor", "One primary visible movement", "A camera move that supports the action"],
      rightTitle: "What to avoid",
      rightItems: ["Competing actions in one short clip", "Unclear camera direction", "Motion that changes identity or key details"],
      rightTone: "avoid",
      expertLabel: "Motion note",
      expertTip: "The best first draft has one movement that can be reviewed from the opening frame to the final frame.",
      items: [
        { title: "Subject anchor", body: "Name the person, product, place, or detail that must remain recognizable." },
        { title: "Visible movement", body: "Choose one primary action such as a turn, glance, walk, reveal, or gentle environmental motion." },
        { title: "Camera intent", body: "Specify a push-in, orbit, pan, tilt, or locked frame instead of asking for random movement." }
      ]
    },
    guidance: {
      eyebrow: "WRITE A REVIEWABLE DIRECTION",
      title: "Keep Motion Controlled and Reviewable",
      intro: "Short clips work best when the visual change is specific enough to inspect from the first frame to the last.",
      cards: [
        { title: "Start with a clean frame", body: "Use a clear source image with visible subject boundaries and readable details." },
        { title: "Limit the action", body: "One main movement is easier to keep believable than several competing actions." },
        { title: "Check continuity", body: "Inspect identity, hands, edges, lighting, props, and background geometry before publishing." }
      ]
    },
    steps: {
      eyebrow: "A PRACTICAL WORKFLOW",
      title: "A Practical Motion Workflow",
      items: [
        { title: "Choose the source", body: "Use an approved image that gives the model enough detail to preserve the subject." },
        { title: "Write the movement", body: "Describe the action, camera move, pace, lighting, and what must stay still." },
        { title: "Generate short clips", body: "Create a focused draft, then compare the opening, middle, and final frame." },
        { title: "Review before use", body: "Reject artifacts and regenerate when identity, anatomy, text, or scene continuity breaks." }
      ],
      cta: "Start a Motion Draft"
    },
    useCases: {
      title: "What Motion Generation Can Create",
      intro: "Use a single still as the anchor for short visual directions across personal, social, product, and editorial work.",
      items: [
        { title: "Portrait movement", problem: "Bring a still portrait to life with a glance, expression, or subtle camera move.", body: "Keep identity and facial proportions stable while adding restrained motion.", cta: "Animate a portrait", image: { src: "/assets/dreamshoot/generated/pack-galleries/ai-video-add-ons/ai-video-add-ons-01.webp", alt: "Portrait prepared for controlled motion", width: 1200, height: 1200 } },
        { title: "Product reveal", problem: "Show a product detail or angle change without building a full shoot.", body: "Use controlled movement to reveal shape, surface, scale, and context.", cta: "Create a product reveal", image: { src: "/assets/dreamshoot/generated/pack-galleries/ai-video-add-ons/ai-video-add-ons-02.webp", alt: "Product scene prepared for motion", width: 1200, height: 1200 } },
        { title: "Atmospheric scene", problem: "Add depth to a landscape, room, or editorial still.", body: "Use environmental motion, parallax, and pacing to support the original composition.", cta: "Animate a scene", image: { src: "/assets/dreamshoot/generated/pack-galleries/ai-video-add-ons/ai-video-add-ons-03.webp", alt: "Atmospheric scene prepared for motion", width: 1200, height: 1200 } }
      ]
    },
    value: { eyebrow: "WHY IT HELPS", title: "Why a Focused Motion Brief Helps", intro: "Specific movement makes the result easier to review, compare, and reuse.", items: [{ title: "Clearer continuity", body: "The source frame remains the visual anchor." }, { title: "More useful drafts", body: "Every clip has a defined movement and review goal." }, { title: "Safer publishing", body: "Artifacts and unsupported claims are easier to catch before release." }] },
    trust: { eyebrow: "USE MOTION RESPONSIBLY", title: "Review Every Frame Before You Publish", intro: "Use approved source media and inspect the complete clip for identity, rights, and continuity.", items: [{ title: "Use with permission", body: "Animate only images you own or have permission to use." }, { title: "Review the full clip", body: "Check motion, identity, anatomy, text, and edges from start to finish." }, { title: "Be clear about AI", body: "Add context when viewers could mistake generated motion for an authentic recording." }] },
    faq: { eyebrow: "MOTION GENERATOR FAQ", title: "Questions About Animating a Photo", items: [
      { question: "What is an AI motion generator?", answer: "It creates a short video from a still image and a defined movement direction. The image remains the starting visual reference while the system generates motion." },
      { question: "Can I animate any image?", answer: "Use an image you own or have permission to animate. Clear subject boundaries and readable details generally make review easier." },
      { question: "How should I describe the motion?", answer: "Describe one primary action, the camera move, the pace, and the details that should remain still so the finished clip is easier to review." },
      { question: "What should I review before publishing?", answer: "Check identity, anatomy, hands, text, logos, lighting, props, edges, and motion continuity across the full clip." }
    ] },
    finalCta: { eyebrow: "CREATE A REVIEWABLE MOTION DRAFT", title: "Turn One Still Into a Short Motion Concept", body: "Choose an approved source, describe one movement, and review the generated clip before using it publicly.", cta: "Open Motion Generator", microcopy: "Approved source. Focused motion. Full review." }
  },
  "cinematic-video": {
    seo: {
      title: "AI Cinematic Video Generator – Create Story-Driven Cinematic Clips | myDreamshoots",
      description:
        "Create cinematic videos with stronger mood, shot design, lighting, pacing, and camera movement. Turn ideas into short-film-style scenes for noir stories, luxury launches, music clips, sci-fi concepts, period moods, and brand storytelling.",
      keywords:
        "AI cinematic video generator, cinematic video maker, cinematic AI video, create cinematic video, story-driven video generator, cinematic scene generator, short film style AI video, AI video with camera movement and mood",
      canonicalPath: "/ai-video-generation/cinematic-video"
    },
    hero: {
      eyebrow: "AI CINEMATIC VIDEO GENERATOR",
      title: "Create a More Cinematic Video Without a Full Film Crew",
      body:
        "Need stronger mood, camera energy, and visual atmosphere from a simple idea or image? Build a cinematic video with story-driven motion, more intentional framing, and a look that feels closer to a short film than a standard clip.",
      primaryCta: "Create My Cinematic Video",
      secondaryCta: "See Real Use Cases",
      availabilityNote:
        "This page explains the intended creative direction. Open the current video workspace to review the creation tools available today.",
      rightsCopy: "Use only content you own or have permission to transform. Review the final result before publishing.",
      imageNote: "Cinematic tracking shot, neon rain, shifting headlights, and a tense over-the-shoulder reveal.",
      image: { src: `${cinematicImageRoot}/create-a-more-cinematic-video-without-a-full-film-crew.webp`, alt: "Man looking over his shoulder on a neon-lit street in the rain", width: 864, height: 496 },
      video: { src: `${cinematicImageRoot}/create-a-more-cinematic-video-without-a-full-film-crew.mp4`, poster: `${cinematicImageRoot}/create-a-more-cinematic-video-without-a-full-film-crew.webp`, label: "Create a More Cinematic Video Without a Full Film Crew", width: 864, height: 496, fit: "cover" }
    },
    useCases: {
      eyebrow: "WHAT KIND OF CINEMATIC VIDEO ARE YOU TRYING TO CREATE?",
      title: "Six Real Reasons People Use Cinematic Video",
      intro:
        "People ask for cinematic video when they need more than motion. They need mood, intention, pacing, and a visual world that feels deliberate.",
      items: [
        makeUseCaseCard({
          title: "Build a Scene That Feels Like a Thriller, Not Just a Night Shot",
          problem: "You want tension, mystery, and a strong visual hook, but a generic clip looks too flat and modern.",
          body:
            "Noir scenes work when light, shadow, rain, and silence all support the same emotional idea. The goal is not just dark video. The goal is suspense, ambiguity, and character presence.",
          noteLabel: "Direction focus",
          noteBody: "Low-key lighting -> slow reveal -> wet reflections -> restrained motion -> tension first.",
          cta: "Create a Noir Scene",
          image: image(`${cinematicImageRoot}/cinematic-video-noir-detective-rainy-alley.png`, "Detective in a fedora standing in a rainy neon alley for a noir cinematic video", 1672, 941)
        }),
        makeUseCaseCard({
          title: "Turn a Vehicle Reveal Into a Premium Cinematic Moment",
          problem: "You need a premium launch look, but ordinary product video does not feel expensive enough.",
          body:
            "Luxury auto video should present form, surface, motion, and atmosphere together. The scene needs dramatic highlights, controlled movement, and a reveal that feels aspirational rather than rushed.",
          noteLabel: "Direction focus",
          noteBody: "Hero angle -> reflective surfaces -> slow dolly or orbit -> selective highlights -> premium pacing.",
          cta: "Create an Auto Reveal",
          image: image(`${cinematicImageRoot}/cinematic-video-luxury-auto-night-reveal.png`, "Black luxury sports car on a wet city street at night for a cinematic reveal", 1672, 941)
        }),
        makeUseCaseCard({
          title: "Give a Performance More Feeling, Light, and Screen Presence",
          problem: "A basic performance clip records the song, but it may not communicate emotion, scale, or stage energy.",
          body:
            "Cinematic performance clips should carry emotional intensity. Light direction, haze, close performance detail, and controlled pacing help the audience feel the performance rather than just observe it.",
          noteLabel: "Direction focus",
          noteBody: "Emotion-led framing -> stage spotlight -> shallow depth -> expressive motion -> music-aware pacing.",
          cta: "Create a Performance Clip",
          image: image(`${cinematicImageRoot}/cinematic-video-live-music-performance-spotlight.png`, "Singer performing under a blue spotlight on stage for a cinematic music clip", 1672, 941)
        }),
        makeUseCaseCard({
          title: "Build a Futuristic World With Scale, Mood, and Imagination",
          problem: "You have a futuristic idea, but you need the world to feel larger, more believable, and more immersive.",
          body:
            "Sci-fi concept scenes rely on worldbuilding. Architecture, light sources, texture, and scale all need to support the story. A strong cinematic sci-fi scene feels intentional, not just techy.",
          noteLabel: "Direction focus",
          noteBody: "World scale -> light source logic -> atmosphere -> central focal object -> restrained camera movement.",
          cta: "Create a Sci-Fi Scene",
          image: image(`${cinematicImageRoot}/cinematic-video-sci-fi-concept-energy-chamber.png`, "Futuristic energy chamber with a central glowing core for a cinematic sci-fi concept", 1672, 941)
        }),
        makeUseCaseCard({
          title: "Create a Rich Period Mood Instead of a Costume Snapshot",
          problem: "You want a historical or literary tone, but most generic visuals lose emotional authenticity.",
          body:
            "A convincing period scene needs more than wardrobe. The room, lighting, texture, posture, and stillness all help build a believable emotional world.",
          noteLabel: "Direction focus",
          noteBody: "Warm interior light -> deliberate stillness -> expressive portrait framing -> historic textures -> emotional restraint.",
          cta: "Create a Period Scene",
          image: image(`${cinematicImageRoot}/cinematic-video-period-drama-candlelit-mansion.png`, "Woman in a candlelit mansion wearing a historical gown for a cinematic period drama scene", 1672, 941)
        }),
        makeUseCaseCard({
          title: "Open a Brand Story With More Authority and Atmosphere",
          problem: "You want a founder, vision, or launch video to feel more premium and intentional than a standard talking-head asset.",
          body:
            "Cinematic brand storytelling helps a message feel more considered and more memorable. The scene should support credibility, perspective, and emotional tone, not distract from the message.",
          noteLabel: "Direction focus",
          noteBody: "Controlled framing -> warm practical light -> premium environment -> calm motion -> authority without exaggeration.",
          cta: "Create a Brand Story Opener",
          image: image(`${cinematicImageRoot}/cinematic-video-brand-story-founder-studio.png`, "Founder seated in a warm studio office for a cinematic brand story opener", 1672, 941)
        })
      ]
    },
    foundation: {
      eyebrow: "START WITH A STRONG CINEMATIC FOUNDATION",
      title: "What Makes a Scene Feel Cinematic - And What to Avoid",
      intro:
        "A cinematic scene is not just a clip with movement. It needs a visual idea, a mood, and camera choices that support the same emotional direction.",
      leftTitle: "What makes it cinematic",
      leftItems: [
        "Clear mood and emotional intent",
        "Intentional framing and composition",
        "Camera movement that serves the story",
        "Lighting that shapes depth and tone",
        "Sound-aware pacing and rhythm",
        "Details that make the world feel real"
      ],
      rightTitle: "What to avoid",
      rightItems: [
        "Random or excessive camera movement",
        "Flat lighting with no contrast or direction",
        "Overly fast cuts that break emotion",
        "Vague prompts with no visual intent",
        "Generic settings that lack authenticity",
        "Claims or visuals that feel misleading"
      ],
      rightTone: "avoid",
      expertTip: "Every cinematic scene answers one question: What should the audience feel in this moment?"
    },
    guidance: {
      eyebrow: "WRITE BETTER DIRECTION",
      title: "Better Direction Creates Better Cinematic Results",
      intro: "Cinematic is too vague on its own. Better results come from explaining the mood, shot, movement, and light you want.",
      cards: [
        guidanceCard({
          title: "Define the mood",
          body: "Describe the feeling first.",
          exampleLabel: "Example",
          exampleBody: "Moody, mysterious, quietly tense."
        }),
        guidanceCard({
          title: "Choose the shot type",
          body: "Tell the system what kind of framing best supports the story.",
          exampleLabel: "Example",
          exampleBody: "Wide establishing shot."
        }),
        guidanceCard({
          title: "Set the pacing",
          body: "Control how fast or slow the moment unfolds.",
          exampleLabel: "Example",
          exampleBody: "Slow and deliberate."
        }),
        guidanceCard({
          title: "Add camera movement",
          body: "Motion should support emotion, not exist by itself.",
          exampleLabel: "Example",
          exampleBody: "Slow dolly forward."
        }),
        guidanceCard({
          title: "Guide the lighting",
          body: "Lighting defines tone, realism, and depth.",
          exampleLabel: "Example",
          exampleBody: "Low-key, warm practical lights."
        })
      ]
    },
    steps: {
      eyebrow: "FROM IDEA TO CINEMATIC VIDEO",
      title: "Four Steps. No Film Crew Required.",
      items: [
        { title: "Upload your source", body: "Add an image, script, or idea as the foundation." },
        { title: "Describe the scene", body: "Share mood, shot type, movement, lighting, and key details." },
        { title: "Generate the cinematic clip", body: "The AI builds a story-driven cinematic video." },
        { title: "Review before sharing", body: "Watch, refine if needed, and share with confidence." }
      ],
      cta: "Create My Cinematic Video"
    },
    value: {
      eyebrow: "CINEMATIC VIDEO THAT DELIVERS MORE VALUE",
      title: "More Mood. More Story. More Impact.",
      items: [
        { title: "Stronger atmosphere", body: "Create emotion and immersion that pulls viewers in." },
        { title: "Stronger visual storytelling", body: "Tell stories with intention, not just moving visuals." },
        { title: "More premium presentation", body: "Look more professional and more deliberate." },
        { title: "Easier content reuse", body: "Create assets that work across launches, campaigns, and social channels." }
      ]
    },
    trust: {
      eyebrow: "CREATE RESPONSIBLY",
      title: "Cinematic Video Should Be Honest, Respectful, and Responsible",
      intro: "Cinematic tools are powerful. Use them with integrity and respect for rights and reality.",
      items: [
        { title: "Use with permission", body: "Only transform content you own or have the rights to use." },
        { title: "Stay accurate", body: "Avoid misleading edits or false depictions of real events." },
        { title: "Be non-deceptive", body: "Do not create content intended to mislead or impersonate." },
        { title: "Avoid unverified claims", body: "Do not imply results, endorsements, or outcomes that are not real." }
      ]
    },
    faq: {
      eyebrow: "REAL QUESTIONS, REAL ANSWERS",
      title: "FAQ",
      items: [
        {
          question: "What is Cinematic Video?",
          answer: "It is a video style focused on mood, framing, pacing, movement, and atmosphere rather than simple motion alone."
        },
        {
          question: "What should I upload?",
          answer: "Use an image, concept, or story idea that gives the video a clear emotional and visual direction."
        },
        {
          question: "Can I control the camera movement?",
          answer: "Only say yes when the live product supports meaningful scene or movement guidance."
        },
        {
          question: "How long can my video be?",
          answer: "Check the live product details for exact limits before you choose a package."
        },
        {
          question: "What formats do you support?",
          answer: "Only publish verified output formats."
        },
        {
          question: "Is my content safe and private?",
          answer: "Only publish privacy, storage, and deletion claims that match real platform behavior."
        }
      ]
    },
    finalCta: {
      eyebrow: "READY TO CREATE YOUR CINEMATIC STORY?",
      title: "Ready to Create Your Cinematic Story?",
      body: "Turn your idea into a cinematic video that feels more like a short film than a standard clip.",
      cta: "Create My Cinematic Video",
      microcopy: "Use content you own or can license, and review the final result before publishing."
    }
  },
  "tiktok-video": {
    seo: {
      title: "AI TikTok Video Generator – Create TikTok-First Vertical Videos | myDreamshoots",
      description:
        "Turn photos and ideas into TikTok-first vertical videos with a clearer hook, mobile-safe framing, sound-aware structure, captions, and a focused close. Build short demos, micro-lessons, creator stories, event snippets, and campaign videos.",
      keywords:
        "AI TikTok video generator, TikTok video maker, AI TikTok video creator, make TikTok videos from photos, vertical video generator, TikTok content creator, TikTok video from images, short-form video maker",
      canonicalPath: "/ai-video-generation/tiktok-video"
    },
    hero: {
      eyebrow: "AI TIKTOK VIDEO GENERATOR",
      title: "Turn Your Photos and Ideas Into TikTok-First Videos",
      body:
        "Already have the idea, photo, or message, but not a TikTok-ready cut? Build a vertical video around a stronger opening, clear mobile framing, useful captions, sound-aware pacing, and one focused close.",
      primaryCta: "Create My TikTok Video",
      secondaryCta: "See TikTok Use Cases",
      availabilityNote:
        "This page explains the creative direction. Open the current video workspace to review the creation tools available today.",
      rightsCopy: "Use content you own or have permission to use. Review the final clip, text, audio, and AI disclosure needs before publishing.",
      imageNote: "Hand-cover transition · casual to polished · TikTok-first 9:16",
      image: { src: `${tiktokImageRoot}/turn-your-photos-and-ideas-into-tiktok-first-videos.webp`, alt: "Creator revealing a polished outfit after a hand-cover transition", width: 496, height: 864 },
      video: { src: `${tiktokImageRoot}/turn-your-photos-and-ideas-into-tiktok-first-videos.mp4`, poster: `${tiktokImageRoot}/turn-your-photos-and-ideas-into-tiktok-first-videos.webp`, label: "Turn Your Photos and Ideas Into TikTok-First Videos", width: 496, height: 864, fit: "contain" }
    },
    useCases: {
      eyebrow: "WHAT ARE YOU TRYING TO GET ACROSS IN ONE SHORT VIDEO?",
      title: "Six TikTok Tasks That Need Different Creative Decisions",
      intro:
        "A useful TikTok page should not pretend every post follows the same recipe. A micro-lesson, a product proof clip, and a storytime opener need different hooks, pacing, and visual evidence.",
      items: [
        makeUseCaseCard({
          title: "Start With the Moment That Makes People Ask What Happened Here?",
          problem: "You have a striking visual, but no clear first beat that makes someone stop and understand why they should keep watching.",
          body:
            "Use the strongest visual first. Then give context quickly instead of wasting the opening on a logo or long introduction. City, weather, transformation, and unusual-detail shots work best when the first frame already creates a question.",
          noteLabel: "Structure",
          noteBody: "Visual hook -> one-line context -> reveal or explanation -> close.",
          cta: "Create a Visual Hook",
          image: image(`${tiktokImageRoot}/tiktok-video-street-story-rainy-night-hook.png`, "Woman in a yellow raincoat on a neon rainy street for a visual TikTok hook", 1080, 1920)
        }),
        makeUseCaseCard({
          title: "Teach One Useful Thing Before the Viewer Loses the Thread",
          problem: "You know the answer, but your explanation is too long for a short-form feed.",
          body:
            "Open with the exact mistake, question, or outcome. Explain one principle, show one example, and stop. If the lesson needs five subtopics, it is probably five videos.",
          noteLabel: "Structure",
          noteBody: "Question or problem -> one principle -> example -> takeaway.",
          cta: "Create a Micro-Lesson",
          image: image(`${tiktokImageRoot}/tiktok-video-micro-lesson-professor-blackboard.png`, "Professor at a blackboard for a short educational TikTok lesson", 1080, 1920)
        }),
        makeUseCaseCard({
          title: "Tell the Consequence First, Then Earn the Backstory",
          problem: "The story matters, but the setup takes too long before the audience knows why it is worth hearing.",
          body:
            "Lead with the surprising result, mistake, or lesson. Then use the middle of the video to explain how it happened. This gives the viewer a reason to stay through the context.",
          noteLabel: "Structure",
          noteBody: "Outcome first -> what happened -> lesson -> close.",
          cta: "Create a Storytime Clip",
          image: image(`${tiktokImageRoot}/tiktok-video-storytime-advice-senior-portrait.png`, "Senior man in a warm study for a TikTok storytime or advice clip", 1080, 1920)
        }),
        makeUseCaseCard({
          title: "Turn a Long Event Into One Clear, Useful Clip",
          problem: "You have a full talk or event, but the audience only needs the one moment worth sharing.",
          body:
            "Choose a single claim, answer, demonstration, or audience reaction. Add enough context to make the clip understandable without the full event, but do not rebuild the whole presentation inside one TikTok.",
          noteLabel: "Structure",
          noteBody: "Strong quote -> context -> visual proof or reaction -> follow-up action.",
          cta: "Create an Event Insight",
          image: image(`${tiktokImageRoot}/tiktok-video-event-insight-stage-speaker.png`, "Speaker on a technology stage for a short TikTok event insight clip", 1080, 1920)
        }),
        makeUseCaseCard({
          title: "Show the Benefit Before You List the Features",
          problem: "A polished product image explains what the product looks like, but not why someone should care.",
          body:
            "Start with the use, result, or problem being solved. Then show the product in context. The viewer should understand the benefit before you ask them to remember specifications.",
          noteLabel: "Structure",
          noteBody: "Benefit or hook -> product in use -> one proof point -> natural CTA.",
          cta: "Create a Product Demo",
          image: image(`${tiktokImageRoot}/tiktok-video-product-proof-founder-demo.png`, "Founder holding a product for a TikTok product proof or demo video", 1080, 1920)
        }),
        makeUseCaseCard({
          title: "Make the Occasion Clear Early, Then Give People a Reason to Act",
          problem: "The offer has a deadline, but the video spends too long building atmosphere before people understand what is happening.",
          body:
            "State the seasonal reason or timing early, keep the visual theme recognizable, and make the close specific. Do not bury the relevant date, availability, or action behind decorative effects.",
          noteLabel: "Structure",
          noteBody: "Occasion -> value -> visual proof -> timing or CTA.",
          cta: "Create a Seasonal Campaign",
          image: image(`${tiktokImageRoot}/tiktok-video-seasonal-offer-gift-campaign.png`, "Woman holding a wrapped holiday gift for a TikTok seasonal campaign video", 1080, 1920)
        })
      ]
    },
    foundation: {
      eyebrow: "BUILD FOR THE FEED, NOT FOR A DESKTOP PLAYER",
      title: "What Makes a TikTok Video Easier to Watch - and What Gets in the Way",
      intro:
        "A good TikTok video is planned for vertical viewing from the beginning. The opening, the frame, the captions, and the sound should all help the viewer move forward.",
      leftTitle: "Do this",
      leftItems: [
        "Compose vertically at 9:16 when TikTok is the primary destination.",
        "Put key subject matter and important text where interface elements are less likely to cover them.",
        "Make the first seconds useful: show the result, ask the question, or reveal the problem.",
        "Keep each video focused on one main message.",
        "Use captions when speech or context matters.",
        "Let sound, voiceover, and visual rhythm support the same idea."
      ],
      rightTitle: "Avoid this",
      rightItems: [
        "Long logo animations before the viewer understands the value.",
        "Shrinking a horizontal composition into a tiny center box with unreadable detail.",
        "Placing essential text at the extreme edges or under common interface zones.",
        "Treating fast-paced as random cuts with no narrative purpose.",
        "Using a trend that does not fit the message or audience.",
        "Promising virality or reach that no creative tool can guarantee."
      ],
      rightTone: "avoid",
      expertTip: "A strong TikTok opening answers one question immediately: Why should I give this the next few seconds?"
    },
    guidance: {
      eyebrow: "STRUCTURE THE SHORT VIDEO",
      title: "Hook -> Body -> Close",
      intro: "A better TikTok brief tells the AI what happens first, what proves it, and how it ends.",
      cards: [
        guidanceCard({ title: "Hook", body: "Open with suspense, surprise, emotion, a question, a visible result, or the clearest benefit." }),
        guidanceCard({ title: "Body", body: "Deliver the explanation, demonstration, story, or proof without introducing unrelated ideas." }),
        guidanceCard({ title: "Stimulation", body: "Use movement, cuts, overlays, captions, sound, and B-roll to support attention, not to hide weak content." }),
        guidanceCard({ title: "Sound", body: "Use music, voiceover, narration, or effects deliberately. For business content, use audio you are allowed to use commercially." }),
        guidanceCard({ title: "Close", body: "End with the takeaway or next action. The CTA should feel like a natural continuation of the video." })
      ]
    },
    steps: {
      eyebrow: "HOW IT WORKS",
      title: "Four Steps From Idea to TikTok-Ready Draft",
      items: [
        { title: "Upload your source", body: "Add the approved photo, visual, or starting material." },
        { title: "Describe the TikTok task", body: "Tell us the hook, message, audience, tone, and desired close." },
        { title: "Generate the vertical video", body: "Create a short-form draft using the available settings." },
        { title: "Review before publishing", body: "Check crop, safe zones, text, audio rights, claims, and disclosure requirements." }
      ],
      cta: "Create My TikTok Video"
    },
    value: {
      eyebrow: "VALUE",
      title: "Make Existing Ideas Easier to Turn Into Short-Form Content",
      items: [
        { title: "Faster concept testing", body: "Try different hooks or closes without rebuilding the whole idea." },
        { title: "Clearer mobile framing", body: "Plan around a vertical destination instead of treating it as an afterthought." },
        { title: "More reusable source material", body: "Turn existing approved photos or concepts into several focused short-form directions." },
        { title: "Better creative discipline", body: "Keep one video centered on one audience problem or outcome." }
      ]
    },
    trust: {
      eyebrow: "RESPONSIBLE USE",
      title: "TikTok-First Should Still Mean Accurate, Authorized, and Clearly Presented",
      intro: "Before publishing:",
      items: [
        { title: "Confirm rights", body: "Confirm you own or can use the source content." },
        { title: "Check claims", body: "Check product, price, health, performance, event, and other factual claims." },
        { title: "Use audio you can use", body: "Use audio you have the right to use." },
        { title: "Review AI disclosure", body: "Review whether realistic AI-generated content requires an AI label or other platform disclosure." },
        { title: "Avoid impersonation", body: "Do not impersonate, fabricate endorsements, or imply events that did not occur." },
        { title: "Follow current rules", body: "Follow the current TikTok Community Guidelines and destination-market requirements." }
      ]
    },
    faq: {
      eyebrow: "FAQ",
      title: "FAQ",
      items: [
        { question: "What makes a video TikTok-first?", answer: "It is planned for the vertical feed from the beginning: mobile framing, an early hook, clear structure, readable text placement, sound-aware editing, and a focused close." },
        { question: "Should TikTok videos be 9:16?", answer: "For TikTok-first creative, vertical 9:16 is the primary format recommended for full-screen viewing. Use the actual export options supported by myDreamshoots." },
        { question: "Where should I put captions and important text?", answer: "Keep critical information away from interface-heavy edge areas and preview the finished post in its real destination context." },
        { question: "Do I need sound?", answer: "Use music, voiceover, or effects when they genuinely support the message and you have the required rights." },
        { question: "How do I make the opening stronger?", answer: "Show the result, problem, question, surprising fact, or strongest visual early. Avoid spending the first seconds on branding that gives the viewer no reason to continue." },
        { question: "Will this make my video go viral?", answer: "No tool can guarantee virality, reach, views, or conversions. Use the workflow to build a more TikTok-aware creative process, not a guaranteed algorithmic outcome." },
        { question: "Do AI TikTok videos need to be labeled?", answer: "TikTok requires labeling for certain AI-generated content, including realistic AI-generated images, audio, or video. Review TikTok's current rules for the exact content you plan to publish." },
        { question: "Can I use the result commercially?", answer: "Commercial use depends on your plan and the current myDreamshoots terms. Review those terms before publishing." }
      ]
    },
    finalCta: {
      eyebrow: "FINAL CTA",
      title: "Build the TikTok Cut Around the Message, Not Around Random Effects",
      body: "Start with one audience problem, one clear hook, and one useful next step. Then create the vertical draft and review it in context.",
      cta: "Create My TikTok Video",
      microcopy: "Use content you own or have permission to use, and review the final clip, text, audio, and disclosure needs before publishing."
    }
  },
  "instagram-reels": {
    seo: {
      title: "AI Instagram Reels Generator – Create Reels From Photos & Ideas | myDreamshoots",
      description:
        "Turn photos and ideas into Instagram Reels with 9:16 framing, safer text placement, stronger cover choices, captions, audio-aware pacing, and a clear visual story for tutorials, BTS, portfolios, launches, and product demos.",
      keywords:
        "AI Instagram Reels generator, Instagram Reels maker, create Instagram Reels from photos, AI Reels generator, Instagram video maker, vertical Reels creator, make Reels from images, Instagram short video generator",
      canonicalPath: "/ai-video-generation/instagram-reels"
    },
    hero: {
      eyebrow: "AI INSTAGRAM REELS GENERATOR",
      title: "Turn Photos and Ideas Into Reels That Fit Your Feed",
      body:
        "Already have strong photos or a clear idea? Build a vertical Reel around a better first frame, cleaner 9:16 composition, readable text placement, captions or audio where they matter, and a visual direction that still feels like your account.",
      primaryCta: "Create My Instagram Reel",
      secondaryCta: "See Reel Use Cases",
      availabilityNote:
        "This page explains the creative direction. Open the current video workspace to review the creation tools available today.",
      rightsCopy: "Use content you own or have permission to use. Review cover, crop, text, audio rights, claims, and AI disclosure needs before publishing.",
      imageNote: "Raw creator setup · cover-ready reveal · polished 9:16 Reel",
      image: { src: `${instagramImageRoot}/turn-photos-and-ideas-into-reels-that-fit-your-feed.webp`, alt: "Creator presenting a polished vertical Reel from a bedroom recording setup", width: 496, height: 864 },
      video: { src: `${instagramImageRoot}/turn-photos-and-ideas-into-reels-that-fit-your-feed.mp4`, poster: `${instagramImageRoot}/turn-photos-and-ideas-into-reels-that-fit-your-feed.webp`, label: "Turn Photos and Ideas Into Reels That Fit Your Feed", width: 496, height: 864, fit: "contain" }
    },
    useCases: {
      eyebrow: "SIX REAL REEL TASKS",
      title: "Six Reel Tasks That Need Different Visual Treatment",
      intro:
        "A portfolio Reel, a mini tutorial, and a behind-the-scenes Reel should not look or read the same. The useful question is not which transition should I use. It is what does the viewer need to understand from this Reel?",
      items: [
        makeUseCaseCard({
          title: "Show the Change Clearly - Without Making People Work to Find It",
          problem: "You have a strong transformation, but the result gets buried because the setup takes too long.",
          body:
            "Use the final result or strongest contrast early. Then show the before state, one or two meaningful steps, and the finished outcome again. The sequence should make the transformation obvious even with the sound off.",
          noteLabel: "Structure",
          noteBody: "Result teaser -> before -> key change -> final reveal.",
          cta: "Create a Transformation Reel",
          image: image(`${instagramImageRoot}/instagram-reels-before-after-visual-transformation.png`, "Bright modern living room for an Instagram Reels before-and-after transformation", 1080, 1920)
        }),
        makeUseCaseCard({
          title: "Teach One Repeatable Skill, Not an Entire Course",
          problem: "Your tip is useful, but there are too many steps for one short Reel.",
          body:
            "Start with the final outcome or the exact problem. Keep the tutorial to the smallest useful sequence and use readable captions for any step the viewer may want to save and repeat later.",
          noteLabel: "Structure",
          noteBody: "Outcome or problem -> 2 to 4 steps -> final check -> save-worthy takeaway.",
          cta: "Create a Mini Tutorial",
          image: image(`${instagramImageRoot}/instagram-reels-mini-tutorial-presenter.png`, "Presenter explaining a concept for an Instagram Reels mini tutorial", 1080, 1920)
        }),
        makeUseCaseCard({
          title: "Show Enough Process to Make the Finished Work More Valuable",
          problem: "Your finished work looks polished, but followers never see the process that makes it interesting.",
          body:
            "Use one or two setup moments, the most visually interesting part of the process, and the finished result. BTS works best when it reveals something the final post cannot show by itself.",
          noteLabel: "Structure",
          noteBody: "Setup -> process detail -> human moment -> result.",
          cta: "Create a BTS Reel",
          image: image(`${instagramImageRoot}/instagram-reels-behind-the-scenes-creator-studio.png`, "Creator in a studio setting for an Instagram Reels behind-the-scenes video", 1080, 1920)
        }),
        makeUseCaseCard({
          title: "Turn Individual Pieces Into a Visual Point of View",
          problem: "You have several strong images, but a simple slideshow does not communicate your style.",
          body:
            "Group work by mood, color, subject, or project rather than random upload order. Keep the transitions quiet enough that the work remains the focus.",
          noteLabel: "Structure",
          noteBody: "Cover image -> visual theme -> variations and details -> signature close.",
          cta: "Create a Portfolio Reel",
          image: image(`${instagramImageRoot}/instagram-reels-portfolio-editorial-street-style.png`, "Editorial street-style portrait for an Instagram Reels visual portfolio", 1080, 1920)
        }),
        makeUseCaseCard({
          title: "Make the Announcement Clear Before the Decoration Takes Over",
          problem: "The news matters, but the Reel spends too long looking pretty before viewers understand what is being announced.",
          body:
            "State the launch, milestone, event, or update early. Then use supporting visuals to create emotion and credibility. If there is a date or next action, make it readable and easy to find.",
          noteLabel: "Structure",
          noteBody: "Announcement -> why it matters -> supporting visuals -> date or CTA.",
          cta: "Create an Announcement Reel",
          image: image(`${instagramImageRoot}/instagram-reels-announcement-launch-celebration.png`, "Celebratory graduation portrait for an Instagram Reels announcement video", 1080, 1920)
        }),
        makeUseCaseCard({
          title: "Let the Reel Show the Product Doing Its Job",
          problem: "A polished product shot looks good in the grid, but viewers still need to understand the product in use.",
          body:
            "Open with the use case or benefit, then show the product in context. Keep feature text short and place proof or demonstration before the CTA.",
          noteLabel: "Structure",
          noteBody: "Use case -> demo -> proof or detail -> next step.",
          cta: "Create a Product Demo",
          image: image(`${instagramImageRoot}/instagram-reels-product-demo-spokesperson.png`, "Spokesperson holding a product for an Instagram Reels product demonstration", 1080, 1920)
        })
      ]
    },
    foundation: {
      eyebrow: "DESIGN FOR FULL-SCREEN REELS",
      title: "What Makes a Reel Easier to Watch - and Easier to Recognize as Yours",
      intro:
        "A Reel is not just a 9:16 file. It also has to work inside Instagram's viewer, around interface overlays, and often as part of a creator or brand profile.",
      leftTitle: "Do this",
      leftItems: [
        "Compose for vertical 9:16 when Reels is the primary destination.",
        "Keep essential text and logos inside safe areas rather than at the interface edges.",
        "Choose a cover that still makes sense when someone visits your profile.",
        "Add captions when dialogue carries meaning.",
        "Keep one clear visual idea per Reel.",
        "Use audio, voiceover, or music only when it supports the same story.",
        "Maintain recurring typography, color, pacing, or framing if consistency matters to your brand."
      ],
      rightTitle: "Avoid this",
      rightItems: [
        "Treating the cover as an afterthought.",
        "Putting critical text under common interface controls.",
        "Using busy transitions that overpower the work.",
        "Mixing unrelated visual styles in one Reel.",
        "Making dialogue essential but unreadable without sound.",
        "Copying a trend that clashes with the account's tone.",
        "Promising reach, saves, or sales that cannot be guaranteed."
      ],
      rightTone: "avoid",
      expertTip: "A strong Reel should work in two places: inside the full-screen viewer and as part of the visual identity of the account that published it."
    },
    guidance: {
      eyebrow: "PLAN THE REEL AS A VISUAL SYSTEM",
      title: "Cover -> Opening -> Visual Story -> Close",
      intro:
        "A better Reel brief explains what people see before they press play, and what they remember at the end.",
      cards: [
        guidanceCard({ title: "Cover", body: "Choose a frame or cover image that tells people what the Reel is about before playback." }),
        guidanceCard({ title: "Opening", body: "Start with the result, visual contrast, main subject, or clearest promise." }),
        guidanceCard({ title: "Visual Story", body: "Organize the middle by progression: steps, details, process, examples, or visual variations." }),
        guidanceCard({ title: "Captions & Audio", body: "Use captions for important dialogue. Use music, voiceover, or original audio when it supports the visual story." }),
        guidanceCard({ title: "Close", body: "Finish with the result, takeaway, save or share reason, or one natural next action." })
      ]
    },
    steps: {
      eyebrow: "HOW IT WORKS",
      title: "Four Steps From Source Material to Reel-Ready Draft",
      items: [
        { title: "Upload your source", body: "Add approved photos, clips, or visual starting material." },
        { title: "Describe the Reel", body: "Tell us the audience, cover idea, opening, visual sequence, tone, and close." },
        { title: "Generate the vertical draft", body: "Create the Reel using the available generation settings." },
        { title: "Review before publishing", body: "Check cover, crop, safe zones, captions, audio rights, factual claims, and AI disclosure needs." }
      ],
      cta: "Create My Instagram Reel"
    },
    value: {
      eyebrow: "VALUE",
      title: "Turn Existing Visual Work Into More Useful Instagram Content",
      items: [
        { title: "More coherent presentation", body: "Make several images feel like one intentional story." },
        { title: "Better profile consistency", body: "Plan the cover and visual direction with the account in mind." },
        { title: "More save-worthy utility", body: "Tutorials and process Reels can be structured so useful steps are easy to follow." },
        { title: "More reusable source material", body: "Turn existing approved work into tutorials, BTS, showcases, announcements, and demos." }
      ]
    },
    trust: {
      eyebrow: "RESPONSIBLE USE",
      title: "Polished Reels Still Need Accurate Claims, Proper Rights, and Clear Context",
      intro: "Before publishing:",
      items: [
        { title: "Confirm rights", body: "Confirm rights to photos, clips, logos, music, and voice." },
        { title: "Check claims", body: "Check product, price, health, performance, event, and other factual claims." },
        { title: "Do not fabricate", body: "Do not fabricate endorsements or imply real events that did not occur." },
        { title: "Review disclosure", body: "Review whether realistic AI-generated or AI-modified content needs platform disclosure." },
        { title: "Use captions", body: "Use captions and readable text where meaning would otherwise be lost." },
        { title: "Follow current rules", body: "Follow current Instagram and destination-market requirements." }
      ]
    },
    faq: {
      eyebrow: "FAQ",
      title: "FAQ",
      items: [
        { question: "What makes a Reel different from a normal vertical video?", answer: "A Reel is not just a 9:16 file. It also has to work inside Instagram's viewer, around interface overlays, and often as part of a creator or brand profile." },
        { question: "Should I use 9:16 for Instagram Reels?", answer: "Meta recommends 9:16 for Reels placements because it fills the vertical screen. Use the actual export options supported by myDreamshoots." },
        { question: "Does the cover matter?", answer: "Yes. Instagram lets creators choose a Reel cover, and that cover influences how the Reel appears before playback and within profile contexts." },
        { question: "Should I add captions?", answer: "When dialogue matters, captions improve clarity and accessibility. Instagram supports captions for Reels, and Meta recommends subtitles for dialogue in video ads." },
        { question: "What should I keep inside the safe zone?", answer: "Keep key messages, logos, faces, and CTA information away from interface-heavy edge areas so they remain readable." },
        { question: "Do I need audio?", answer: "Reels supports music, original audio, voiceover, text, and effects. Use sound when it supports the story and you have the necessary rights." },
        { question: "Will a better Reel guarantee reach or sales?", answer: "No. Creative structure can improve clarity and fit, but no tool can guarantee distribution, engagement, or business outcomes." },
        { question: "Can I use the result commercially?", answer: "Commercial use depends on your plan and the current myDreamshoots terms. Review those terms before publishing." }
      ]
    },
    finalCta: {
      eyebrow: "FINAL CTA",
      title: "Build the Reel Around the Visual Story, Then Make It Fit the Feed",
      body: "Start with one clear purpose, choose the right cover and opening, then create a vertical draft that still feels consistent with your account.",
      cta: "Create My Instagram Reel",
      microcopy: "Use content you own or have permission to use, and review cover, crop, text, audio rights, claims, and AI disclosure before publishing."
    }
  },
  "social-media-video": {
    seo: {
      title: "AI Social Media Video Maker – Adapt One Idea Across Platforms | myDreamshoots",
      description:
        "Turn one core idea into platform-aware social media videos. Adapt hooks, crops, captions, audio, pacing, safe zones, and CTAs for TikTok, Instagram Reels, YouTube Shorts, campaigns, testimonials, events, and weekly content.",
      keywords:
        "AI social media video maker, social media video generator, AI social video maker, create videos for social media, multi-platform video creator, social media content video maker, repurpose content into social videos, make vertical social media videos",
      canonicalPath: "/ai-video-generation/social-media-video"
    },
    hero: {
      eyebrow: "AI SOCIAL MEDIA VIDEO MAKER",
      title: "Create One Strong Story—Then Adapt It to the Social Feed It's Going Into",
      body:
        "Start with one clear message, approved source material, and one audience goal. Then adapt the opening, crop, captions, sound, pacing, safe zones, and CTA to the destination instead of uploading the exact same cut everywhere.",
      primaryCta: "Create My Social Video",
      secondaryCta: "See Cross-Platform Use Cases",
      availabilityNote:
        "This page explains the creative direction. Open the current video workspace to review the creation tools available today.",
      rightsCopy: "Use content you own or have permission to use. Review platform rules, audio rights, factual claims, and AI disclosure needs before publishing.",
      imageNote: "Master story -> platform cut -> text/safe zone -> audio -> CTA",
      image: image("/assets/dreamshoot/generated/video-topic-media/social-media-video/social-media-video-01.webp", "Smiling graduate holding a diploma for a social video story", 1600, 1200)
    },
    useCases: {
      eyebrow: "SIX SOCIAL VIDEO JOBS",
      title: "Six Social Video Jobs That Need Different Cuts",
      intro:
        "The useful question is not which platform should I post to first? It is what job does each version need to do for the audience and destination.",
      items: [
        makeUseCaseCard({
          title: "Give Every Launch Video a Job",
          problem: "You have one product, feature, collection, or announcement, but launch week needs more than one repeated video.",
          body:
            "Use one master message, then split the launch into teaser, demo, proof, and reminder cuts. TikTok may need a faster hook, Reels may need a stronger cover and visual consistency, while Shorts may need one self-contained idea that can connect to deeper content.",
          noteLabel: "Structure",
          noteBody: "Core launch promise -> teaser -> demonstration -> proof -> reminder.",
          cta: "Create a Launch Campaign",
          image: image(`${socialImageRoot}/social-media-video-launch-campaign.png`, "Creator shaping a launch campaign for a social video", 1080, 1920)
        }),
        makeUseCaseCard({
          title: "Turn Existing Knowledge Into Focused Social Videos Without Reducing It to Generic Summaries",
          problem: "Your blog, FAQ, podcast, or webinar already contains useful answers, but they are not packaged for social viewing.",
          body:
            "Pull out one answer, insight, quote, comparison, or lesson at a time. Rebuild the opening and visual context for the platform rather than simply cutting the source into arbitrary lengths.",
          noteLabel: "Structure",
          noteBody: "Source insight -> platform-specific opening -> proof or example -> takeaway.",
          cta: "Create a Repurposed Cut",
          image: image(`${socialImageRoot}/social-media-video-before-after-transformation.png`, "Creator presenting a before-and-after visual story for social media", 1080, 1920)
        }),
        makeUseCaseCard({
          title: "Separate the Human Quote, the Proof, and the Context",
          problem: "A customer quote is credible, but repeating the same quote card across every channel wastes the story.",
          body:
            "Create one cut around the customer's actual words, another around the visible result, and another around the problem they solved. Keep the original meaning intact and never make the customer appear to say more than they actually said.",
          noteLabel: "Structure",
          noteBody: "Quote -> context -> proof -> outcome.",
          cta: "Create a Testimonial Cut",
          image: image(`${socialImageRoot}/social-media-video-behind-scenes-creator.png`, "Creator preparing a behind-the-scenes social video in a studio", 1080, 1920)
        }),
        makeUseCaseCard({
          title: "Plan the Event as a Content Cycle, Not a Single Recap",
          problem: "Teams often treat an event as one recap video, even though the audience has different questions before, during, and after it.",
          body:
            "Before the event, answer why someone should care. During it, show what is happening now. After it, extract the moments, lessons, or reactions that still matter. Each phase needs a different social purpose.",
          noteLabel: "Structure",
          noteBody: "Before: invite -> During: live context -> After: takeaway or recap.",
          cta: "Create an Event Cycle",
          image: image(`${socialImageRoot}/social-media-video-product-proof-demo.png`, "Founder demonstrating product proof for a social video", 1080, 1920)
        }),
        makeUseCaseCard({
          title: "Batch the Thinking, Not the Sameness",
          problem: "You need several social videos each week, but batching often turns into five versions of the same post.",
          body:
            "Give each video a different audience job: teach, show, answer, prove, invite, or recap. Reuse the same approved source library while changing the purpose, hook, and evidence.",
          noteLabel: "Structure",
          noteBody: "Weekly topic -> content roles -> platform variants -> review.",
          cta: "Create a Weekly Batch",
          image: image(`${socialImageRoot}/social-media-video-event-story.png`, "Speaker presenting an event story for a social video", 1080, 1920)
        }),
        makeUseCaseCard({
          title: "Keep the Claim Consistent While Changing the Relevance",
          problem: "The same core message may be true for everyone, but prospects, customers, and community members do not need the same explanation.",
          body:
            "For prospects, explain why it matters. For current customers, show how to use it. For the broader community, explain what changed or what was learned. Adapt the angle without changing the underlying fact.",
          noteLabel: "Structure",
          noteBody: "Core truth -> audience question -> relevant evidence -> next action.",
          cta: "Create an Audience Adaptation",
          image: image(`${socialImageRoot}/social-media-video-announcement-launch.png`, "Creator celebrating a launch announcement in a vertical social video", 1080, 1920)
        })
      ]
    },
    foundation: {
      eyebrow: "DON'T CONFUSE MULTI-PLATFORM WITH ONE FILE EVERYWHERE",
      title: "What Should Stay Consistent - and What Should Change by Platform",
      intro:
        "Efficiency comes from reusing the idea, evidence, and source library, not from forcing one finished cut into every social platform.",
      leftTitle: "Keep consistent",
      leftItems: [
        "Core claim and factual meaning",
        "Brand identity and visual quality",
        "Product or event details",
        "Permissions and disclosure",
        "The evidence supporting the message"
      ],
      rightTitle: "Adapt",
      rightItems: [
        "Opening or hook",
        "Crop and aspect ratio",
        "Text placement and UI safe zones",
        "Caption density",
        "Sound or voiceover strategy",
        "Length and pacing",
        "CTA and destination"
      ],
      rightTone: "neutral",
      expertTip: "Efficiency comes from reusing the idea, evidence, and source library, not from forcing one finished cut into every social platform."
    },
    guidance: {
      eyebrow: "BUILD THE SYSTEM BEFORE THE VERSIONS",
      title: "Master Story -> Platform Cut -> Safe Zone -> Audio -> CTA",
      intro: "A better social video brief separates what must stay true from what can change.",
      cards: [
        guidanceCard({ title: "Master Story", body: "Define the core message, audience problem, proof, and desired outcome first." }),
        guidanceCard({ title: "Platform Cut", body: "Decide what the destination needs from the opening seconds, frame, cover, or sequence." }),
        guidanceCard({ title: "Safe Zone & Text", body: "Reposition important text, logos, faces, and product detail so platform UI does not cover the meaning." }),
        guidanceCard({ title: "Audio & Captions", body: "Use sound, voiceover, original audio, captions, or text based on the viewing context and rights you actually have." }),
        guidanceCard({ title: "CTA", body: "Change the next action to fit the platform and stage: watch more, save, comment, visit, compare, or learn." })
      ]
    },
    platformExamples: {
      eyebrow: "PLATFORM ADAPTATION EXAMPLES",
      title: "Three Destination Cuts for One Master Story",
      intro: "Keep the meaning aligned, then tune the opening, framing, and pacing to each platform's habits.",
      items: [
        guidanceCard({ title: "TikTok-first cut", body: "Use a 9:16 vertical composition, sound-aware creative, an early proposition, and UI-safe key content." }),
        guidanceCard({ title: "Instagram Reels cut", body: "Use vertical full-screen creative, plan the cover or first frame, and keep essential creative elements clear of interface-heavy edges." }),
        guidanceCard({ title: "YouTube Shorts cut", body: "Build around one self-contained idea. Keep the live product promise limited to the formats and durations it actually supports." })
      ]
    },
    steps: {
      eyebrow: "HOW IT WORKS",
      title: "Four Steps From One Core Idea to Platform-Aware Social Drafts",
      items: [
        { title: "Upload your source library", body: "Add approved photos, clips, product visuals, or campaign assets." },
        { title: "Define the master story", body: "State the message, audience, evidence, and outcome." },
        { title: "Create platform cuts", body: "Adapt the opening, format, text, audio, pacing, and CTA using the available settings." },
        { title: "Review in destination context", body: "Check crop, safe zones, captions, rights, claims, links, and AI disclosure before publishing." }
      ],
      cta: "Create My Social Video"
    },
    value: {
      eyebrow: "VALUE",
      title: "Reuse the Work That Should Be Shared - Adapt the Parts That Shouldn't",
      items: [
        { title: "Less duplicated planning", body: "Start from one master message instead of inventing every platform post from zero." },
        { title: "More platform-aware output", body: "Adapt the parts that actually affect viewing and usability." },
        { title: "Better use of source assets", body: "Turn one approved source library into launch, proof, education, event, and community content." },
        { title: "More consistent claims", body: "Keep facts and evidence aligned even when the presentation changes." }
      ]
    },
    trust: {
      eyebrow: "RESPONSIBLE USE",
      title: "Cross-Platform Efficiency Should Not Create Cross-Platform Misinformation",
      intro: "Before publishing:",
      items: [
        { title: "Confirm rights", body: "Confirm rights to images, clips, logos, voices, music, and customer quotes." },
        { title: "Keep facts aligned", body: "Keep factual claims consistent across versions." },
        { title: "Do not alter meaning", body: "Do not alter testimonials or real-person statements to make them stronger." },
        { title: "Review disclosure", body: "Review destination-platform AI disclosure and labeling requirements." },
        { title: "Check audio rights", body: "Check commercial music and audio rights separately from visual rights." },
        { title: "Use destination rules", body: "Do not assume one platform's crop, safe zone, or format rules apply unchanged to another." },
        { title: "Use current requirements", body: "Use current platform requirements as the final publishing source of truth." }
      ]
    },
    faq: {
      eyebrow: "FAQ",
      title: "FAQ",
      items: [
        { question: "What is an AI social media video maker?", answer: "It helps turn approved source material and a content idea into social video drafts, with the goal of adapting the presentation to different social destinations." },
        { question: "Should I post the same video to every platform?", answer: "You can reuse the same core story, but identical final cuts often ignore differences in aspect ratio, interface overlays, sound behavior, cover treatment, pacing, and audience context." },
        { question: "What should stay the same across versions?", answer: "Facts, claims, product details, customer meaning, brand identity, and the evidence behind the message should stay consistent." },
        { question: "What should change?", answer: "The opening, crop, text position, captions, sound treatment, pacing, length, and CTA may need to change by platform." },
        { question: "Do all social platforms use 9:16?", answer: "Vertical 9:16 is important for major phone-first formats such as TikTok and Reels, while YouTube Shorts currently accepts square or vertical videos. Always check current destination requirements." },
        { question: "Can I repurpose blogs, podcasts, webinars, and FAQs?", answer: "Yes, when you own or have rights to the source. Pull out one useful idea at a time rather than forcing the entire source into one short video." },
        { question: "Can I automate a full week of posts?", answer: "Only promise batch or automation behavior that the live myDreamshoots product actually supports. The content strategy can still be planned as a weekly batch." },
        { question: "Can I use the videos commercially?", answer: "Commercial use depends on your plan and the current myDreamshoots terms. Review those terms before publishing." }
      ]
    },
    finalCta: {
      eyebrow: "FINAL CTA",
      title: "Keep the Story Consistent. Make the Cut Fit the Platform.",
      body: "Start with one truthful message and one approved asset library. Then adapt only what should change: opening, frame, text, sound, pacing, and next action.",
      cta: "Create My Social Video",
      microcopy: "Do not promise one-click publishing everywhere unless the live product actually supports it."
    }
  },
  "youtube-video": {
    seo: {
      title: "AI YouTube Video Generator – Create Long-Form Videos From Photos & Ideas | myDreamshoots",
      description:
        "Create YouTube videos from photos and ideas with a stronger opening, clearer structure, chapter-ready sequencing, captions, and a better path to the next video, playlist, or deeper explanation.",
      keywords:
        "AI YouTube video generator, YouTube video maker, AI long-form video generator, create YouTube videos, make YouTube videos from photos, YouTube content creator, long-form YouTube video maker, video generator for YouTube channel",
      canonicalPath: "/ai-video-generation/youtube-video"
    },
    hero: {
      eyebrow: "AI YOUTUBE VIDEO GENERATOR",
      title: "Turn a Bigger Idea Into a Video Worth Watching Through",
      body:
        "Start from a tutorial topic, expert talk, case study, review, webinar, or series concept. Build a video around a clearer promise, a stronger opening minute, better structure, readable captions, and one logical next step - another episode, a related video, or a playlist path.",
      primaryCta: "Create My YouTube Video",
      secondaryCta: "See YouTube Video Use Cases",
      availabilityNote:
        "This page explains the creative direction. Open the current video workspace to review the creation tools available today.",
      rightsCopy: "Use content you own or have permission to use. Review captions, factual claims, rights, and AI disclosure needs before publishing.",
      imageNote: "Title promise -> opening minute -> chapters -> depth -> next video",
      image: image(`${youtubeImageRoot}/youtube-video-expert-presenter.png`, "Expert presenter seated in a warm studio for a long-form YouTube video concept", 1672, 941)
    },
    useCases: {
      eyebrow: "SIX LONG-FORM YOUTUBE TASKS",
      title: "Six Long-Form YouTube Tasks That Need Different Structure",
      intro:
        "A tutorial, review, interview, case study, recap, and playlist episode should not share the same structure. Each one serves a different reason for the viewer to stay.",
      items: [
        makeUseCaseCard({
          title: "Show the Result Early - Then Lead the Viewer Through the Whole Path",
          problem: "Your tutorial has the right topic, but the viewer cannot quickly tell what they will achieve or how the lesson is organized.",
          body:
            "A strong tutorial video does not hide the outcome. Show what the viewer will be able to do, then break the explanation into understandable phases. Chapters, checkpoints, and a final recap help the video feel complete instead of endless.",
          noteLabel: "Structure",
          noteBody: "Outcome -> chapter map -> process -> recap -> next step.",
          cta: "Create a Tutorial",
          image: image(`${youtubeImageRoot}/youtube-video-full-tutorial.webp`, "Presenter explaining a lesson in a YouTube tutorial", 1600, 900)
        }),
        makeUseCaseCard({
          title: "Help the Viewer Reach a Decision, Not Just Watch a Demonstration",
          problem: "You review two options, but the audience has to guess which one fits their situation.",
          body:
            "A useful review sets the criteria early: who each option is for, what matters most, and where the differences actually show up. The verdict should feel earned by the evidence, not delayed for drama.",
          noteLabel: "Structure",
          noteBody: "Decision context -> criteria -> comparison -> verdict.",
          cta: "Create a Comparison Video",
          image: image(`${youtubeImageRoot}/youtube-video-review-comparison.webp`, "Spokesperson presenting a product for a YouTube review", 1600, 900)
        }),
        makeUseCaseCard({
          title: "Hook the Insight Before the Conversation Settles In",
          problem: "The guest is interesting, but the audience does not know what insight they will get if they stay.",
          body:
            "Lead with the most useful idea, strongest quote, or key tension. Then let the conversation unpack it. Viewers stay longer when the interview feels like a guided discovery instead of a raw recording.",
          noteLabel: "Structure",
          noteBody: "Insight hook -> guiding question -> answer -> takeaway.",
          cta: "Create an Interview",
          image: image(`${youtubeImageRoot}/youtube-video-interview-conversation.webp`, "Host interviewing a guest for a YouTube conversation", 1600, 900)
        }),
        makeUseCaseCard({
          title: "Move From Context to Decision to Result to Lesson",
          problem: "You have a strong example, but the lesson gets lost because the story is not organized.",
          body:
            "Case studies work best when the viewer understands what happened, why the choice mattered, and what changed afterward. The point is not just the story. It is what the viewer can apply.",
          noteLabel: "Structure",
          noteBody: "Context -> decision -> result -> lesson.",
          cta: "Create a Case Study",
          image: image(`${youtubeImageRoot}/youtube-video-case-study.webp`, "Team reviewing a case study in a YouTube business video", 1600, 900)
        }),
        makeUseCaseCard({
          title: "Extract the Lessons People Need Instead of Uploading the Whole Event Without Guidance",
          problem: "A full webinar exists, but the audience does not need all 45 minutes to get the value.",
          body:
            "Choose the main themes, compress the repetition, and turn a long event into a clear knowledge asset. A recap should reduce friction, not recreate it.",
          noteLabel: "Structure",
          noteBody: "Topic framing -> 3 key lessons -> practical takeaway -> deeper resource.",
          cta: "Create a Webinar Recap",
          image: image(`${youtubeImageRoot}/youtube-video-webinar-recap.webp`, "Speaker presenting an insight in a YouTube webinar recap", 1600, 900)
        }),
        makeUseCaseCard({
          title: "Make Each Episode Complete Enough - Then Let the Playlist Carry the Bigger Journey",
          problem: "You want content continuity, but every episode either feels too isolated or too dependent on the rest of the series.",
          body:
            "Each video should solve the immediate question while still fitting into a broader learning path. Series labels, recurring structure, and clear progression help viewers understand where they are and what comes next.",
          noteLabel: "Structure",
          noteBody: "Episode promise -> lesson depth -> recap -> next episode or playlist.",
          cta: "Create a Series Episode",
          image: image(`${youtubeImageRoot}/youtube-video-series-episode.webp`, "Creator filming an editorial YouTube series episode", 1600, 900)
        })
      ]
    },
    foundation: {
      eyebrow: "EARN THE VIEWER'S TIME",
      title: "What Makes a YouTube Video Easier to Stay With From Start to Finish",
      intro:
        "A long-form YouTube video has to manage a bigger promise. The title, the opening minute, the structure, and the close all need to make that promise feel worth the viewer's time.",
      leftTitle: "Do this",
      leftItems: [
        "Make the title promise clear in the opening minute.",
        "Show viewers how the video is organized when the topic is complex.",
        "Let the depth match the topic instead of racing through everything.",
        "Use captions and on-screen text when clarity depends on them.",
        "Let each format have its own structure: tutorial, review, interview, recap, case study, or series episode.",
        "Use the end of the video to guide the next step only when it is relevant."
      ],
      rightTitle: "Avoid this",
      rightItems: [
        "Delaying the point for too long.",
        "Treating retention as filler, suspense, or repetition without value.",
        "Giving every long-form video the same intro regardless of the topic.",
        "Uploading a long event with no structure or takeaway.",
        "Pushing the next video so early that the current video feels unfinished.",
        "Promising views, subscribers, rankings, or monetization that cannot be guaranteed."
      ],
      rightTone: "avoid",
      expertTip: "A strong long-form video keeps answering the viewer's silent question: Why should I keep giving this video more time?"
    },
    guidance: {
      eyebrow: "PLAN THE WHOLE WATCHING EXPERIENCE",
      title: "Promise -> Opening Minute -> Chapters -> Depth -> Next Video",
      intro:
        "A better YouTube video brief explains what the viewer was promised, what they learn first, and what comes after.",
      cards: [
        guidanceCard({ title: "Promise", body: "Define the problem, result, comparison, conversation, or lesson the title and video are making." }),
        guidanceCard({ title: "Opening Minute", body: "Use the first minute to confirm the value, frame the journey, and reduce uncertainty." }),
        guidanceCard({ title: "Chapters", body: "When the topic is complex, show the major sections so the viewer can follow the logic." }),
        guidanceCard({ title: "Depth", body: "Give enough explanation, evidence, examples, or conversation to justify the video length." }),
        guidanceCard({ title: "Next Video", body: "If there is a logical continuation, point to the next episode, resource, or related video after the current promise is fulfilled." })
      ]
    },
    steps: {
      eyebrow: "HOW IT WORKS",
      title: "Four Steps From Idea to Long-Form YouTube Draft",
      items: [
        { title: "Upload your source", body: "Add an approved photo, clip, slide, topic, or concept." },
        { title: "Describe the video", body: "Tell us the viewer problem, structure, pacing, depth, captions, and logical next step." },
        { title: "Generate the video draft", body: "Create the long-form video using the available settings." },
        { title: "Review before publishing", body: "Check structure, captions, claims, rights, context, and AI disclosure requirements." }
      ],
      cta: "Create My YouTube Video"
    },
    value: {
      eyebrow: "VALUE",
      title: "Turn Bigger Topics Into Clearer Videos That Build Real Channel Value",
      items: [
        { title: "More useful structure", body: "Help the viewer understand where the video is going." },
        { title: "Better depth control", body: "Match the detail to the format instead of rushing or overloading." },
        { title: "More reusable ideas", body: "Turn one topic into a tutorial, recap, case study, interview, or series." },
        { title: "Better content continuity", body: "Use the end of the video to guide the next step in a way that feels natural." }
      ]
    },
    trust: {
      eyebrow: "RESPONSIBLE USE",
      title: "Long-Form Credibility Depends on Accuracy, Rights, and Honest Framing",
      intro: "Before publishing:",
      items: [
        { title: "Confirm rights", body: "Confirm rights to images, clips, music, voice, slides, and logos." },
        { title: "Check claims", body: "Check factual claims, statistics, pricing, timelines, and product details." },
        { title: "Do not fabricate", body: "Do not fabricate interviews, endorsements, quotes, or real-world events." },
        { title: "Review disclosure", body: "Review whether realistic altered or synthetic content requires disclosure." },
        { title: "Keep framing honest", body: "Keep the title, opening, and conclusion aligned - do not overpromise and underdeliver." },
        { title: "Make next steps honest", body: "Make the relationship between this video and the next video honest and relevant." }
      ]
    },
    faq: {
      eyebrow: "FAQ",
      title: "FAQ",
      items: [
        { question: "What makes a YouTube video different from a Short?", answer: "A long-form YouTube video has to manage a bigger promise: not just a hook, but also structure, depth, chapter flow, and what the viewer should do next." },
        { question: "How long should a YouTube video be?", answer: "There is no universal perfect length. The video should be as long as the subject needs and as structured as the audience requires. The live page should only promise durations the actual product supports." },
        { question: "Should I use captions?", answer: "Yes when dialogue, terminology, or explanations need extra clarity. Captions and on-screen text can also help viewers follow dense information." },
        { question: "Do I need chapters?", answer: "For complex topics, showing the structure helps viewers understand the path through the video. Use actual chapter support only if the product and publishing flow support it." },
        { question: "How should I open a long-form YouTube video?", answer: "Use the opening minute to confirm the value promised by the title and show where the video is going." },
        { question: "Should every video push another video?", answer: "No. The current video should first fulfill its own promise. Suggest another video only when it genuinely helps the viewer continue learning or deciding." },
        { question: "Do realistic AI-generated YouTube videos need disclosure?", answer: "YouTube requires creators to disclose certain realistic altered or synthetic content. Review the current YouTube requirements for the exact content you publish." },
        { question: "Can I use the result commercially?", answer: "Commercial use depends on your plan and the current myDreamshoots terms. Review those terms before publishing." }
      ]
    },
    finalCta: {
      eyebrow: "FINAL CTA",
      title: "Build the Whole Video Around the Viewer's Reason to Stay",
      body: "Start with one real viewer need, shape the opening minute carefully, organize the depth, and then guide the next step only after the video earns it.",
      cta: "Create My YouTube Video",
      microcopy: "Use content you own or have permission to use, and review captions, claims, rights, and disclosure before publishing."
    }
  },
  "story-video": {
    seo: {
      title: "AI Story Video Generator – Turn Photos & Moments Into a Clear Story | myDreamshoots",
      description:
        "Turn photos, clips, memories, and ideas into story-led videos with a clearer setup, tension, turning point, payoff, and meaning. Create origin stories, personal journeys, comeback stories, mini documentaries, community stories, and fictional shorts.",
      keywords:
        "AI story video generator, story video maker, AI storytelling video generator, turn photos into a story video, narrative video generator, create story videos from photos, short story video maker, AI video story creator",
      canonicalPath: "/ai-video-generation/story-video"
    },
    hero: {
      eyebrow: "AI STORY VIDEO GENERATOR",
      title: "Turn Photos, Clips, and Real Moments Into a Story Worth Watching",
      body:
        "Start with the person, memory, place, idea, or event you want to share. Build the video around what changes: the setup, the tension, the turning point, the payoff, and the meaning the viewer should leave with.",
      primaryCta: "Create My Story Video",
      secondaryCta: "See Story Types",
      availabilityNote:
        "This page explains the story direction. Open the current video workspace to review the creation tools available today.",
      rightsCopy: "Use photos, voices, quotes, and real-world claims you own or have permission to use. Keep factual stories faithful to what actually happened.",
      imageNote: "Setup -> Tension -> Turning Point -> Payoff -> Meaning",
      image: image(
        "/assets/dreamshoot/story-video/story-video-hero-woman-sunset-reflection.png",
        "Woman at sunset in a reflective outdoor scene for a story video opening",
        1080,
        1920
      )
    },
    useCases: {
      eyebrow: "WHAT KIND OF CHANGE IS THIS STORY ABOUT?",
      title: "Six Story Video Jobs That Need Different Narrative Decisions",
      intro: "Pick the story type that fits your purpose. The narrative should follow what changes, not just what happened next.",
      items: [
        makeUseCaseCard({
          title: "Show Why It Had to Begin",
          problem: "You know when something started, but a timeline of dates still does not explain why the beginning mattered.",
          body:
            "Start before the founding moment. Show what was missing, what someone tried first, and what early proof made the idea real. The date is context; the problem and first change are the story.",
          noteLabel: "Story shape",
          noteBody: "Before -> problem -> first step -> first proof -> today.",
          cta: "Create an Origin Story",
          image: image(
            "/assets/dreamshoot/story-video/story-video-origin-family-home-beginning.png",
            "Parent and child sharing a warm home moment for an origin story",
            1080,
            1920
          )
        }),
        makeUseCaseCard({
          title: "Build the Journey Around the Decision That Changes What Happens Next",
          problem: "You have many emotional moments, but no clear point where the direction changes.",
          body:
            "Choose the turning point first. Keep only the earlier moments that make that choice understandable and the later moments that show its consequence.",
          noteLabel: "Story shape",
          noteBody: "Old pattern -> pressure -> decision -> new direction -> reflection.",
          cta: "Create a Personal Journey",
          image: image(
            "/assets/dreamshoot/story-video/story-video-personal-journey-coastal-turning-point.png",
            "Person overlooking a coastline at sunset for a personal turning-point story",
            1080,
            1920
          )
        }),
        makeUseCaseCard({
          title: "Make the Response the Center of the Comeback",
          problem: "The setback is dramatic, but a simple failure-then-success edit feels generic or manipulative.",
          body:
            "Show what was expected, what went wrong, what changed in response, and what happened because of that response. The meaningful part is not the hardship itself; it is what the person did next.",
          noteLabel: "Story shape",
          noteBody: "Expectation -> setback -> response -> consequence -> lesson.",
          cta: "Create a Comeback Story",
          image: image(
            "/assets/dreamshoot/story-video/story-video-comeback-speaker-new-direction.png",
            "Speaker presenting on stage to represent a comeback and new direction",
            1080,
            1920
          )
        }),
        makeUseCaseCard({
          title: "Let Real Details Carry the Story",
          problem: "You have beautiful footage, but outsiders still do not understand the place, person, craft, routine, or issue.",
          body:
            "Show the place, introduce the people who experience it, capture details outsiders might miss, and use real voices or verifiable context when appropriate. Meaning should grow from observation, not generic narration.",
          noteLabel: "Story shape",
          noteBody: "Place -> person -> detail -> voice/evidence -> meaning.",
          cta: "Create a Mini Documentary",
          image: image(
            "/assets/dreamshoot/story-video/story-video-mini-documentary-interview-creator.png",
            "Creator speaking in a studio for a mini-documentary interview scene",
            1080,
            1920
          )
        }),
        makeUseCaseCard({
          title: "Keep People, Action, and Evidence at the Center",
          problem: "A cause or community matters, but emotional footage can accidentally turn the people involved into background scenery.",
          body:
            "Explain the real need, who defines it, what people are already doing, what has changed, what still has not, and what a viewer can realistically do next.",
          noteLabel: "Story shape",
          noteBody: "Need -> people -> action -> evidence -> realistic next step.",
          cta: "Create a Community Story",
          image: image(
            "/assets/dreamshoot/story-video/story-video-community-shared-milestone.png",
            "Graduate celebrating a shared milestone for a community story",
            1080,
            1920
          )
        }),
        makeUseCaseCard({
          title: "Give the Character Something to Want - and Something That Gets in the Way",
          problem: "You have a mood or visual world, but nothing forces the scene to move.",
          body:
            "A fictional short needs an objective, obstacle, turning point, and consequence. Atmosphere supports the story; it cannot replace it.",
          noteLabel: "Story shape",
          noteBody: "Character -> objective -> obstacle -> turn -> consequence.",
          cta: "Create a Fictional Story",
          image: image(
            "/assets/dreamshoot/story-video/story-video-fictional-noir-character-conflict.png",
            "Noir character in a rainy neon alley for a fictional story conflict",
            1080,
            1920
          )
        })
      ]
    },
    foundation: {
      eyebrow: "STORY FOUNDATION",
      title: "A Story Is Not Just What Happened Next",
      intro: "Use only the background, detail, and evidence that helps the viewer understand the change at the heart of the story.",
      leftTitle: "Do this",
      leftItems: [
        "Identify who is experiencing the story.",
        "Decide what changes between the beginning and the end.",
        "Use only background that helps the viewer understand that change.",
        "Let actions, details, evidence, and real words carry meaning.",
        "Make the turning point visible.",
        "End with a consequence or reflection that belongs to this story."
      ],
      rightTitle: "Avoid this",
      rightItems: [
        "Chronological timelines with no narrative reason.",
        "Generic inspirational narration over unrelated footage.",
        "Manufactured hardship or exaggerated conflict.",
        "A turning point that changes nothing.",
        "Using real people as emotional scenery.",
        "Fiction with atmosphere but no character objective."
      ],
      rightTone: "avoid",
      expertTip:
        "Finish this sentence before generating: \"At the beginning ___, but after ___, ___ changes.\" If it cannot be completed clearly, the story arc still needs work."
    },
    guidance: {
      eyebrow: "YOUR STORY, CLEARLY TOLD",
      title: "A Story That Moves People",
      intro: "Every powerful story follows a structure. Use each beat to make the change visible and the ending meaningful.",
      cards: [
        guidanceCard({
          title: "1. Setup",
          body: "Introduce the world, characters, and what matters most.",
          image: image(
            "/assets/dreamshoot/story-video/story-video-setup-memory-photo-selection.png",
            "Person organizing printed photographs to establish a story setup",
            1080,
            1920
          )
        }),
        guidanceCard({
          title: "2. Tension",
          body: "Show the challenge, doubt, or obstacle that raises the question.",
          image: image(
            "/assets/dreamshoot/story-video/story-video-tension-reflective-man-study.png",
            "Thoughtful man in a dim study representing tension and uncertainty",
            1080,
            1920
          )
        }),
        guidanceCard({
          title: "3. Turning Point",
          body: "Show the decision or event that changes what happens next.",
          image: image(
            "/assets/dreamshoot/story-video/story-video-turning-point-creator-decision.png",
            "Creator holding a phone in a cafe representing a decision and turning point",
            1080,
            1920
          )
        }),
        guidanceCard({
          title: "4. Payoff",
          body: "Reveal the consequence and the emotional resolution.",
          image: image(
            "/assets/dreamshoot/story-video/story-video-payoff-celebration-gift-moment.png",
            "Warm gift celebration scene representing a story payoff",
            1080,
            1920
          )
        }),
        guidanceCard({
          title: "5. Meaning",
          body: "Leave the viewer with what this story now means.",
          image: image(
            "/assets/dreamshoot/story-video/story-video-meaning-reflection-elder-portrait.png",
            "Older man in a study representing reflection and story meaning",
            1080,
            1920
          )
        })
      ]
    },
    steps: {
      eyebrow: "SIMPLE, GUIDED, POWERFUL",
      title: "How It Works",
      items: [
        { title: "Share the material", body: "Add approved photos, clips, quotes, notes, or a fictional concept." },
        { title: "Choose the story type", body: "Decide whether the story is an origin, journey, comeback, documentary, community story, or fiction." },
        { title: "Define the change", body: "Set the setup, tension, turning point, payoff, and meaning." },
        { title: "Generate the draft", body: "Build the story sequence using the available product settings." },
        { title: "Review before sharing", body: "Check whether anything invents, overstates, rearranges, or changes the real meaning." }
      ],
      cta: "Create My Story Video"
    },
    value: {
      eyebrow: "WHY CREATORS USE IT",
      title: "Stories People Remember",
      image: image(
        "/assets/dreamshoot/story-video/story-video-closing-memory-reflection.png",
        "Older woman smiling at home for a reflective closing story moment",
        1080,
        1920
      ),
      items: [
        { title: "Less filler", body: "Remove scenes that do not change what the viewer understands." },
        { title: "Stronger emotional logic", body: "Let emotion come from action, choice, detail, and consequence." },
        { title: "More useful real stories", body: "Origin, documentary, personal, and community content can explain rather than merely advertise." },
        { title: "Better fictional scenes", body: "Give strong visuals a character objective, obstacle, turn, and consequence." }
      ]
    },
    trust: {
      eyebrow: "RESPONSIBLE STORYTELLING",
      title: "A Stronger Story Should Not Mean a Less Accurate Story",
      intro: "For factual or real-person stories, keep the narrative faithful to what happened and transparent about what was created or changed.",
      items: [
        { title: "Confirm rights", body: "Confirm rights to photos, clips, voices, quotes, and documents." },
        { title: "Separate fact from interpretation", body: "Keep verified facts distinct from the meaning or interpretation you add." },
        { title: "Do not invent", body: "Do not invent hardship, conflict, quotes, endorsements, or outcomes." },
        { title: "Keep events faithful", body: "Do not reorder events in a way that materially changes their meaning." },
        { title: "Keep quotes faithful", body: "Keep customer, employee, and community quotes faithful to what was actually said." },
        { title: "Review disclosure", body: "Review realistic synthetic or altered content for disclosure requirements before publishing." }
      ]
    },
    faq: {
      eyebrow: "QUESTIONS? WE'VE GOT ANSWERS",
      title: "Frequently Asked Questions",
      items: [
        {
          question: "Do I need video editing experience?",
          answer: "This page focuses on the narrative decisions that make a story understandable. Open the current video workspace to review the creation tools and controls available today."
        },
        {
          question: "What kind of material can I use?",
          answer: "Start with approved photos, clips, quotes, notes, or a fictional concept that the current workspace accepts. Use only content you own or have permission to use."
        },
        {
          question: "How long does it take to get my story video?",
          answer: "Timing depends on current product availability and generation settings. Review the live workspace before making a timing commitment."
        },
        {
          question: "Can I customize the music and style?",
          answer: "Use only the music, style, and other controls shown in the current workspace. Do not assume an option is available unless the product exposes it."
        },
        {
          question: "Can I use my story video commercially?",
          answer: "Commercial use depends on your rights to the source material, the generated content terms, and the destination requirements. Review those before publishing."
        }
      ]
    },
    finalCta: {
      eyebrow: "READY TO CREATE YOUR STORY?",
      title: "Turn Your Moments Into a Story Worth Watching",
      body: "Start with the moment, memory, idea, or change you want people to understand.",
      cta: "Create My Story Video",
      microcopy: "Use content you own or have permission to use, and review the final story before publishing."
    }
  },
  "meme-video": {
    seo: {
      title: "AI Meme Video Generator – Make Reaction, POV & Relatable Meme Videos | myDreamshoots",
      description:
        "Turn photos, reactions, comments, awkward moments, and everyday situations into meme videos with bold captions, reaction timing, POV setups, expectation-vs-reality edits, and punchlines people instantly understand.",
      keywords:
        "AI meme video generator, meme video maker, reaction meme video, AI meme generator video, POV meme video maker, create meme videos from photos, funny reaction video maker, meme caption video, relatable meme video creator",
      canonicalPath: "/ai-video-generation/meme-video"
    },
    hero: {
      eyebrow: "AI MEME VIDEO GENERATOR",
      title: "Turn Everyday Moments Into Meme Videos That Everyone Instantly Gets",
      body:
        "Start with a reaction, awkward moment, comment, pet expression, work frustration, or everyday situation people already recognize. Add the setup, time the reaction, land one punchline, and stop before the joke needs explaining.",
      primaryCta: "Create My Meme Video",
      secondaryCta: "See Meme Examples",
      availabilityNote:
        "This page explains the meme direction. Open the current video workspace to review the creation tools available today.",
      rightsCopy:
        "Use source images, clips, voices, comments, and recognizable people only when you have the rights and context to do so. Do not fabricate a real person's actions, speech, endorsement, or embarrassing behavior.",
      imageNote: "WHEN YOU FINALLY SIT DOWN TO RELAX / AND SOMEONE ASKS FOR “A QUICK FAVOR”",
      image: image(
        `${memeImageRoot}/meme-video-message-overload.png`,
        "Creator reacting to an overloaded message thread for a meme video",
        1080,
        1448,
        "50% 50%"
      ),
      highlights: ["Relatable Concepts", "Smart Timing", "Punchy Captions", "Built to Share"],
      mediaAspectRatio: "16 / 9",
      imageFit: "contain"
    },
    useCases: {
      eyebrow: "SIX MEME VIDEO SCENARIOS",
      title: "Six Meme Video Scenarios",
      intro:
        "Different situations. Different laughs. Choose the meme structure that matches the moment instead of forcing every joke into the same template.",
      items: [
        makeUseCaseCard({
          title: "Reaction Meme",
          problem: "The expression is already funny. The problem is knowing how much context to add before the reaction.",
          body: "Capture instant reactions that everyone feels. Use one specific trigger, then let the face, gesture, pause, or zoom become the payoff.",
          noteLabel: "Structure",
          noteBody: "Trigger -> reaction -> hold -> cut.",
          cta: "Create a Reaction Meme",
          image: image(
            `${memeImageRoot}/meme-video-message-overload.png`,
            "Reaction meme about opening one message and finding ten more unread messages",
            1086,
            1448
          )
        }),
        makeUseCaseCard({
          title: "Expectation vs Reality",
          problem: "The joke depends on contrast, but the viewer needs to clearly see the expectation before reality breaks it.",
          body: "Make the expected side simple and recognizable, then switch decisively to the real result. The stronger the visual contrast, the less text the joke needs.",
          noteLabel: "Structure",
          noteBody: "Expectation -> beat -> reality -> stop.",
          cta: "Create an Expectation vs Reality Meme",
          image: image(
            `${memeImageRoot}/meme-video-expectation-vs-reality-dog.png`,
            "Expectation versus reality meme using contrasting dog reactions",
            1086,
            1448
          )
        }),
        makeUseCaseCard({
          title: "POV / Relatable Moment",
          problem: "The situation is familiar, but generic captions like “work is hard” do not create recognition.",
          body: "Write the setup as a specific moment the viewer is already living: your boss says one tiny change, the meeting starts before the coffee, or one message becomes ten.",
          noteLabel: "Structure",
          noteBody: "POV setup -> recognizable behavior -> reaction / twist.",
          cta: "Create a POV Meme",
          image: image(
            `${memeImageRoot}/meme-video-pov-boss-tiny-change.png`,
            "POV reaction meme about a boss asking for one tiny change",
            1086,
            1448
          )
        }),
        makeUseCaseCard({
          title: "Deadpan Caption Meme",
          problem: "The visual is already absurd, and too many effects weaken it.",
          body: "Pair a calm line with a clearly un-calm situation. Keep typography large, contrast high, and editing restrained. Let the mismatch create the joke.",
          noteLabel: "Structure",
          noteBody: "Visual problem -> deadpan line -> hold -> cut.",
          cta: "Create a Deadpan Meme",
          image: image(
            `${memeImageRoot}/meme-video-printer-disagrees.png`,
            "Deadpan office meme with the caption I’m fine while the printer disagrees",
            1086,
            1448
          )
        }),
        makeUseCaseCard({
          title: "Comment / Reply Meme",
          problem: "The audience has already written the setup, but the response becomes a long explanation instead of a meme.",
          body: "Use the comment as the opening beat, then answer with a reaction, side-eye, zoom, freeze frame, visual contrast, or short callback. Preserve the commenter's real meaning.",
          noteLabel: "Structure",
          noteBody: "Comment -> reaction / answer -> callback.",
          cta: "Create a Reply Meme",
          image: image(
            `${memeImageRoot}/meme-video-tiny-revision-sure.png`,
            "Reaction meme replying sure to a request for one tiny revision",
            1086,
            1448,
            "50% 50%"
          )
        }),
        makeUseCaseCard({
          title: "Brand-Safe Situational Meme",
          problem: "A brand wants to participate in meme culture without looking like a company forcing internet slang.",
          body: "Start from a real customer, team, product, or operational situation. Let the brand detail be part of the joke, not an interruption after the joke.",
          noteLabel: "Structure",
          noteBody: "Relatable situation -> brand detail -> punchline -> optional natural CTA.",
          cta: "Create a Brand-Safe Meme",
          image: image(
            `${memeImageRoot}/meme-video-coffee-adulting.png`,
            "Coffee sign meme reading Coffee because adulting is hard",
            1086,
            1448
          )
        })
      ]
    },
    foundation: {
      eyebrow: "WHAT MAKES A MEME SHAREABLE?",
      title: "Make the Joke Instantly Understandable",
      intro: "A meme earns the laugh by making the setup, contrast, and punchline easy to recognize in one quick pass.",
      leftTitle: "Make it land",
      leftItems: [
        "Relatable to a wide audience.",
        "Instantly understood.",
        "A clear setup and punchline.",
        "Visually engaging.",
        "Perfect timing."
      ],
      rightTitle: "Avoid these mistakes",
      rightItems: [
        "Too long or slow.",
        "Weak or unclear punchline.",
        "Hard-to-read text.",
        "Offensive or risky topics.",
        "Over-complicated edits."
      ],
      rightTone: "avoid",
      expertLabel: "BEST FOR / USE IN",
      expertTip: "Best for social media growth, engagement and reach, community building, and brand awareness. Use in TikTok, Reels, Shorts, Instagram Feed or Stories, YouTube Shorts, Facebook, X, communities, and DMs. These are use cases, not guaranteed outcomes."
    },
    guidance: {
      eyebrow: "THE MEME FORMULA THAT WORKS",
      title: "Recognize -> Expect -> Flip -> Punchline -> Stop",
      intro: "Follow this simple structure to create meme moments people can understand, feel, and share.",
      cards: [
        guidanceCard({ title: "1. Recognize", body: "Show a situation people instantly understand." }),
        guidanceCard({ title: "2. Expect", body: "Build a setup that creates a predictable expectation." }),
        guidanceCard({ title: "3. Flip", body: "Flip the expectation with an unexpected twist or contrast." }),
        guidanceCard({ title: "4. Punchline", body: "Deliver the joke clearly and in one beat." }),
        guidanceCard({ title: "5. Stop", body: "End right after the punchline and let it land." })
      ]
    },
    platformExamples: {
      eyebrow: "MEME USE GUIDANCE",
      title: "Choose the Right Moment for the Joke",
      intro: "The same meme structure can serve different creative jobs when the situation, audience, and tone are clear.",
      items: [
        { title: "Social content", body: "Use reactions, POVs, and expectation flips for short-form social drafts." },
        { title: "Community building", body: "Turn shared frustrations, comments, and inside jokes into recognizable conversation starters." },
        { title: "Brand awareness", body: "Use real product, team, customer, or operational moments without forcing internet slang." },
        { title: "Content series", body: "Repeat a clear structure with new situations so the audience knows what kind of laugh to expect." }
      ]
    },
    value: {
      eyebrow: "QUICK TIPS FOR MEME VIDEOS",
      title: "Keep the Setup Clear and the Punchline Tight",
      items: [
        { title: "Keep it short", body: "Use only the time needed to establish the setup and land the joke." },
        { title: "Use clear text", body: "Use big fonts, high contrast, and safe placement away from common interface overlays." },
        { title: "Cut fast", body: "Sharp cuts and jump cuts can help attention when they support the joke." },
        { title: "Add sound", body: "Trending audio, voice, or short sound hits may strengthen a meme, but only use audio you have the right to use." },
        { title: "End early", body: "Stop immediately after the punchline. Do not explain the joke twice." }
      ]
    },
    steps: {
      eyebrow: "FROM IDEA TO MEME VIDEO IN 5 STEPS",
      title: "How It Works",
      items: [
        { title: "Share your idea", body: "Describe the moment, reaction, photo, comment, or joke you want to turn into a meme." },
        { title: "Plan the setup", body: "Define the meme structure, caption, expectation, timing, and punchline." },
        { title: "Generate scenes", body: "Create the visual beats, expressions, reaction, or comparison using the actual available product settings." },
        { title: "Add text & sound", body: "Add captions, sound, and fast edits only where the product actually supports them." },
        { title: "Review & download", body: "Check readability, timing, rights, real-person context, factual claims, and AI disclosure needs before downloading or publishing." }
      ],
      cta: "Create My Meme Video"
    },
    trust: {
      eyebrow: "RESPONSIBLE MEME CREATION",
      title: "Funny Should Not Mean Misleading, Cruel, or Context-Free",
      intro: "A meme can be sharp without inventing a real person's behavior, exposing private information, or changing the meaning of a real comment.",
      items: [
        { title: "Confirm rights", body: "Confirm rights to source photos, clips, audio, comments, and recognizable characters." },
        { title: "Do not fabricate", body: "Do not fabricate a real person's quote, action, endorsement, or humiliating situation." },
        { title: "Preserve meaning", body: "Preserve the meaning of customer, employee, and audience comments." },
        { title: "Avoid harassment", body: "Avoid harassment, private information, or jokes built on protected or sensitive traits." },
        { title: "Keep claims accurate", body: "Keep product, price, service, and outcome claims accurate even in humorous content." },
        { title: "Review disclosure", body: "Review destination-platform rules for realistic AI-generated or materially altered media." },
        { title: "Make fiction clear", body: "If a meme is fictional or dramatized but could be mistaken for a real event, make the context clear." }
      ]
    },
    faq: {
      eyebrow: "QUESTIONS? WE'VE GOT ANSWERS",
      title: "Frequently Asked Questions",
      items: [
        { question: "How long should a meme video be?", answer: "Only as long as needed to establish the setup and land the punchline. Publish exact duration limits only if the actual myDreamshoots generator supports them." },
        { question: "Can you use trending audio?", answer: "Only promise built-in trending-audio access if the product actually provides it. Otherwise use audio you have permission to use." },
        { question: "Do you add captions to every meme?", answer: "Captions are useful when they carry the setup or punchline, but visual reaction memes may need very little text." },
        { question: "Can you make memes for my brand?", answer: "Yes as a content direction, but the workflow does not promise unsupported brand templates or publishing controls." },
        { question: "What video formats will I receive?", answer: "List only the real export formats and resolutions supported by the current product." },
        { question: "How many revisions do I get?", answer: "Use the actual plan and generation workflow. Do not invent revision counts." },
        { question: "Can I make memes about real people?", answer: "Only with appropriate rights and context. Do not fabricate their speech, actions, endorsements, or humiliating behavior." },
        { question: "Can I use the result commercially?", answer: "Commercial use depends on your plan and the current myDreamshoots terms. Review those terms before publishing." }
      ]
    },
    finalCta: {
      eyebrow: "READY TO MAKE PEOPLE LAUGH AND SHARE?",
      title: "Ready to Make People Laugh and Share?",
      body: "Turn simple moments into meme videos people instantly understand. Keep the setup clear, the reaction readable, and the punchline tight.",
      cta: "Create My Meme Video",
      microcopy: "Use content you own or have permission to use, and review the final meme before publishing."
    }
  },
  "product-video": {
    seo: {
      title: "AI Product Video Generator – Turn Product Photos Into Clear Videos | myDreamshoots",
      description:
        "Turn product photos and source images into videos that show scale, materials, features, real-world use, packaging, and the details buyers need before they decide.",
      keywords:
        "AI product video generator, product video maker, product showcase video, ecommerce product video, product video from images, product video generator from photos, product page video, product marketing video",
      canonicalPath: "/ai-video-generation/product-video"
    },
    hero: {
      eyebrow: "AI PRODUCT VIDEO GENERATOR",
      title: "Show the Product Clearly Before You Ask Someone to Buy It",
      body:
        "Turn approved product photos and source shots into a video that helps buyers understand scale, texture, important details, real-world use, what is included, and the questions a static product image often leaves unanswered.",
      primaryCta: "Create My Product Video",
      secondaryCta: "See Product Use Cases",
      availabilityNote:
        "This page explains the Product Video direction. Open the current video workspace to review the creation tools available today.",
      rightsCopy:
        "Use accurate product photos and claims. Do not invent materials, dimensions, performance, results, included items, or compatibility.",
      imageNote: "Feature-led showcase · detail-focused storytelling · AI-generated product video",
      image: image(
        `${productImageRoot}/feature-led-product-showcase.webp`,
        "Full-size keyboard shown with green backlighting in a product feature video",
        496,
        864
      ),
      video: {
        src: `${productImageRoot}/feature-led-product-showcase.mp4`,
        poster: `${productImageRoot}/feature-led-product-showcase.webp`,
        label: "Show the Product Clearly Before You Ask Someone to Buy It",
        width: 496,
        height: 864,
        fit: "cover"
      },
      highlights: ["Scale", "Material Detail", "Real Use", "What's Included"]
    },
    useCases: {
      eyebrow: "SIX BUYER QUESTIONS",
      title: "Six Buyer Questions a Product Video Can Answer",
      intro:
        "A useful product video makes the product easier to judge. Start with the question a static product image leaves unanswered, then choose shots that answer it honestly.",
      items: [
        makeUseCaseCard({
          title: "Give the Buyer a Scale Reference",
          problem: "A clean product photo looks polished, but the buyer still cannot tell how large the item actually is.",
          body:
            "Show the product in a hand, on a body, beside a familiar object, or in the space where it will be used. The goal is not dramatic motion; the goal is to make size easier to judge.",
          noteLabel: "Useful shots",
          noteBody: "Hand-held view -> side/profile view -> in-space view -> clean product end frame.",
          cta: "Create a Scale Video",
          image: image(
            `${productImageRoot}/product-video-size-scale-backpack.jpg`,
            "Hand holding a black backpack against a plain background to show product scale",
            4640,
            6960
          )
        }),
        makeUseCaseCard({
          title: "Move Close Enough to Show the Detail That Changes the Decision",
          problem: "The listing says premium, soft, matte, metal, or textured, but the product image does not show what that actually means.",
          body:
            "Use close-ups for finish, grain, seams, edge quality, controls, ports, closures, texture, reflective surfaces, or other material cues. Avoid visual effects that change the actual appearance.",
          noteLabel: "Useful shots",
          noteBody: "Macro detail -> slow angle shift -> edge or control detail -> accurate color hold.",
          cta: "Create a Detail Video",
          image: image(
            `${productImageRoot}/product-video-material-detail-earbuds.jpg`,
            "Wireless earbuds and charging case on a red background for close product detail",
            3999,
            2667
          )
        }),
        makeUseCaseCard({
          title: "Show the Product Doing Its Normal Job",
          problem: "The buyer understands what the item is, but not what normal use looks like.",
          body:
            "Use a real context shot: a coffee machine brewing, a bag being carried, skincare being opened, or an accessory being handled. Keep it at product-understanding level; save full step-by-step instruction for Product Demo Video.",
          noteLabel: "Useful shots",
          noteBody: "Context view -> normal use motion -> product detail -> clear resting view.",
          cta: "Create a Real-Use Video",
          image: image(
            `${productImageRoot}/product-video-real-use-coffee-machine.jpg`,
            "Barista using an espresso machine to show a kitchen product in normal use",
            4458,
            2903
          )
        }),
        makeUseCaseCard({
          title: "When a Feature Matters, Show It Visibly",
          problem: "A feature is mentioned in text, but the viewer cannot see whether it actually matters.",
          body:
            "If the product has a screen, closure, port, moving part, water-resistant detail, indicator, fit, capacity, or other visible feature, frame the video around evidence the viewer can inspect.",
          noteLabel: "Useful shots",
          noteBody: "Feature close-up -> visible state change -> normal context -> clean confirmation frame.",
          cta: "Create a Feature-Proof Video",
          image: image(
            `${productImageRoot}/product-video-feature-proof-smartwatch.jpg`,
            "Smartwatch close-up beside a charging case showing wearable product details",
            3916,
            2764
          )
        }),
        makeUseCaseCard({
          title: "Remove the Is This Included Question",
          problem: "The buyer does not know exactly what arrives in the package.",
          body:
            "Show the box, main product, included accessories, quantity, packaging layers, and anything that materially affects the purchase decision. Do not show accessories that are not actually included.",
          noteLabel: "Useful shots",
          noteBody: "Box view -> included items layout -> quantity/detail view -> complete package frame.",
          cta: "Create an Unboxing Video",
          image: image(
            `${productImageRoot}/product-video-unboxing-whats-in-box.jpg`,
            "Hands unboxing skincare products and packaging on a wooden table",
            6154,
            4103
          )
        }),
        makeUseCaseCard({
          title: "Keep the Product Easier to Judge Than It Was in the Original Photo",
          problem: "The video looks impressive, but the product is difficult to see because the edit prioritizes effects over the item.",
          body:
            "For ecommerce and product pages, use clean product-centered framing, readable detail, accurate color, and a clear final view. Motion should reveal information, not hide it.",
          noteLabel: "Useful shots",
          noteBody: "Listing frame -> slow reveal -> detail proof -> clean product-page end frame.",
          cta: "Create a Listing Video",
          image: image(
            `${productImageRoot}/product-video-ecommerce-listing-shoes.jpg`,
            "Sneakers positioned in the foreground while a seller photographs them for an online listing",
            6016,
            3614
          )
        })
      ]
    },
    foundation: {
      eyebrow: "WHAT A PRODUCT VIDEO SHOULD SHOW",
      title: "Answer the Buyer Before You Add Motion",
      intro:
        "The best product video is not the one with the most effects. It is the one that makes the product easier to understand than the still image did.",
      leftTitle: "Show",
      leftItems: [
        "True size and scale cues.",
        "Texture and material details.",
        "Normal use context.",
        "Visible feature evidence.",
        "What comes in the box.",
        "A clean final product view."
      ],
      rightTitle: "Avoid",
      rightItems: [
        "Motion that never lets the buyer inspect the product.",
        "Invented dimensions, materials, or included items.",
        "Fake before/after performance.",
        "Effects that materially change the product color.",
        "Showing sold-separately accessories as if included.",
        "Claims the visuals cannot support."
      ],
      rightTone: "avoid",
      expertLabel: "PRODUCT TRUTH",
      expertTip:
        "Product Video should make the product more inspectable. Keep color, scale, included items, visible features, compatibility, and claims faithful to what the buyer will actually receive."
    },
    guidance: {
      eyebrow: "PRODUCT VIDEO METHOD",
      title: "Buyer Question -> Visual Proof -> Real Context -> Important Detail -> Next Step",
      intro:
        "Use this structure when a product photo looks good but still leaves the buyer uncertain.",
      cards: [
        guidanceCard({ title: "1. Buyer Question", body: "Name the uncertainty that keeps someone from understanding the product." }),
        guidanceCard({ title: "2. Visual Proof", body: "Choose the shot that answers the question without relying only on marketing copy." }),
        guidanceCard({ title: "3. Real Context", body: "Show where or how a normal buyer would actually see or use the item." }),
        guidanceCard({ title: "4. Important Detail", body: "Add the close-up, feature, scale cue, or included item that affects the decision." }),
        guidanceCard({ title: "5. Next Step", body: "Finish with a clean product view and the appropriate product-page or campaign action." })
      ]
    },
    platformExamples: {
      eyebrow: "PRODUCT CATEGORY GUIDANCE",
      title: "Choose Shots That Fit the Product Category",
      intro:
        "Different products create different buyer questions. Match the proof shot to the category instead of forcing every product into the same showcase edit.",
      items: [
        { title: "Skincare & Beauty", body: "Show texture, dropper or dispensing behavior, packaging scale, container finish, and routine context. Do not manufacture skin results." },
        { title: "Electronics & Accessories", body: "Show screens, controls, ports, fit, charging cases, size in hand, and any visible feature state." },
        { title: "Fashion & Bags", body: "Show scale on body or in hand, material, stitching, capacity, closures, shape, and movement." },
        { title: "Home & Kitchen", body: "Show the item in the real room, normal-use motion, what fits, and which components come with it." },
        { title: "Packaged Goods", body: "Show package size, quantity, opening, serving or preparation context, and front/back details that matter." }
      ]
    },
    steps: {
      eyebrow: "FROM PRODUCT SOURCE TO VIDEO DRAFT",
      title: "How It Works",
      items: [
        { title: "Choose the product source", body: "Use accurate product images or approved source shots." },
        { title: "Name the buyer question", body: "Choose scale, material, use, feature, contents, or listing fit." },
        { title: "Describe the proof shots", body: "State what must be visible. Avoid vague instructions like make it cinematic when the buyer needs information." },
        { title: "Generate the draft", body: "Use only the actual controls and output options supported by myDreamshoots." },
        { title: "Review against reality", body: "Check color, proportions, included items, labels, visible features, claims, and disclosure needs." }
      ],
      cta: "Create My Product Video"
    },
    value: {
      eyebrow: "CREATION WORKFLOW",
      title: "Plan the Shot Before You Polish the Motion",
      intro:
        "A Product Video brief should be specific about the product question, the proof shot, and what must remain visually accurate.",
      image: image(
        `${productImageRoot}/product-video-creation-workflow-studio.jpg`,
        "Product video studio setup with lighting, camera, tablet, and an open package",
        4000,
        6000
      ),
      items: [
        { title: "Use approved sources", body: "Start with product photos, packaging shots, and detail images you are allowed to publish." },
        { title: "Keep the product visible", body: "Let movement reveal size, material, contents, or use. Do not hide the product behind effects." },
        { title: "Separate clarity from advertising", body: "Use Product Video to help the buyer understand the item. Use Product Ad Video when the job is a compressed campaign pitch." },
        { title: "Save step-by-step instruction for demos", body: "If the viewer needs to perform a task, plan a Product Demo Video rather than overloading a showcase video." }
      ]
    },
    trust: {
      eyebrow: "RESPONSIBLE PRODUCT STORYTELLING",
      title: "A Better Product Video Must Still Represent the Product Honestly",
      intro:
        "Useful product video reduces uncertainty. It should not create a more attractive version of the product than the buyer will receive.",
      items: [
        { title: "Use allowed product details", body: "Use product photos and product details you are allowed to publish." },
        { title: "Keep physical facts accurate", body: "Do not change product color, scale, included items, materials, or visible features in a misleading way." },
        { title: "Avoid fake performance", body: "Do not create fake before/after performance unless the comparison is real, representative, and supportable." },
        { title: "Do not fabricate proof", body: "Do not fabricate reviews, awards, endorsements, test results, or compatibility claims." },
        { title: "Check disclosure needs", body: "If an AI-generated product scene could be mistaken for literal footage of a real product test or event, review disclosure requirements for the destination." },
        { title: "Respect third-party references", body: "For third-party stock reference photography, do not imply that the person or brand shown endorses myDreamshoots." }
      ]
    },
    faq: {
      eyebrow: "QUESTIONS? WE'VE GOT ANSWERS",
      title: "Frequently Asked Questions",
      items: [
        { question: "What is an AI product video generator?", answer: "It helps turn product photos or approved source visuals into a video that makes the item easier to understand. The useful goal is product clarity: scale, detail, use, features, included items, and context." },
        { question: "How is Product Video different from Product Demo Video?", answer: "Product Video helps someone understand and evaluate the product. Product Demo Video focuses more deeply on how to perform a task or use a function step by step." },
        { question: "Can I create a product video from product photos?", answer: "Yes, when the actual myDreamshoots workflow supports the source files you have. Use high-quality product images that represent the item accurately." },
        { question: "What should a useful product video show first?", answer: "Start with the buyer's biggest unanswered question: what the product is, its scale, an important detail, the main visible use, or what comes in the box." },
        { question: "Should I show features or benefits?", answer: "Show the visual evidence first. If a feature creates a benefit, let the viewer see the feature or use case rather than relying only on a claim." },
        { question: "Can I use AI-generated scenes on ecommerce pages?", answer: "Only when they still represent the product accurately and do not mislead buyers about materials, size, performance, included items, or real-world results." }
      ]
    },
    finalCta: {
      eyebrow: "READY TO MAKE THE PRODUCT CLEARER?",
      title: "Create a Product Video That Answers the Buyer's Question",
      body: "Start with an approved product image, name the buying uncertainty, and turn the video brief toward visual proof.",
      cta: "Create My Product Video",
      microcopy: "Use product images and claims you are allowed to publish, and review the finished draft for accuracy before sharing."
    }
  },
  "product-ad-video": {
    seo: {
      title: "AI Product Ad Video Generator – Create Product Ads With Clear Proof & CTA | myDreamshoots",
      description:
        "Create product ad videos around a specific audience, problem or desire, product promise, visual proof, offer, and call to action. Plan launch ads, problem-solution ads, benefit ads, offers, comparison ads, and retargeting reminders.",
      keywords:
        "AI product ad video generator, product ad video maker, AI product advertising video, product video ad generator, ecommerce video ad maker, social media product ad video, product launch ad video, product marketing video generator",
      canonicalPath: "/ai-video-generation/product-ad-video"
    },
    hero: {
      eyebrow: "AI PRODUCT AD VIDEO GENERATOR",
      title: "Build the Ad Around One Buyer Decision—Not Every Product Feature",
      body:
        "Start with one audience and one reason they should care now. Then connect the problem or desire to a specific product promise, show proof the viewer can understand, state the offer accurately when there is one, and end with one clear next action.",
      primaryCta: "Create My Product Ad",
      secondaryCta: "See Ad Scenarios",
      availabilityNote:
        "This page explains the Product Ad direction. Open the current video workspace to review the creation tools available today.",
      rightsCopy:
        "Keep product claims, prices, discounts, availability, testimonials, and before/after evidence accurate. Do not promise outcomes the product or offer cannot support.",
      imageNote: "Audience -> Promise -> Proof -> Offer -> CTA",
      image: image(
        `${productAdImageRoot}/build-the-ad-around-one-buyer-decision.webp`,
        "Pet hair and debris on a living-room rug in a product ad opening scene",
        496,
        864
      ),
      video: {
        src: `${productAdImageRoot}/build-the-ad-around-one-buyer-decision.mp4`,
        poster: `${productAdImageRoot}/build-the-ad-around-one-buyer-decision.webp`,
        label: "Build the Ad Around One Buyer Decision—Not Every Product Feature",
        width: 496,
        height: 864,
        fit: "cover"
      }
    },
    useCases: {
      eyebrow: "PAID CREATIVE SCENARIOS",
      title: "Six Paid-Creative Problems That Need Different Ads",
      intro:
        "Launch, problem-solution, benefit, offer, comparison, and retargeting should not use the same message. Choose the ad job before you choose the edit.",
      items: [
        makeUseCaseCard({
          scenarioLabel: "New Product Launch Ad",
          title: "Lead With What Is New for the Buyer—Not Just the Release Date",
          problem: "The product is new, but “NEW” alone does not tell the right customer why this launch matters.",
          body:
            "Show the new product or collection quickly, then anchor the launch around the change the audience will notice: a new use case, design, bundle, size, category, workflow, or choice. Give the viewer enough context to understand why this release is relevant to them.",
          noteLabel: "Ad structure",
          noteBody: "Audience cue -> what is new -> why it matters -> proof or first look -> CTA.",
          cta: "Create a New Product Launch Ad",
          image: image(
            `${productAdImageRoot}/product-ad-video-new-product-launch-shoes.jpg`,
            "Blue and green running shoes on a bright background for a new-product launch ad concept",
            5184,
            3456
          )
        }),
        makeUseCaseCard({
          scenarioLabel: "Problem -> Solution Ad",
          title: "Show the Friction Clearly—Then Show the Product Changing That Specific Moment",
          problem: "The pain point is familiar, but many ads exaggerate it so much that the solution feels disconnected or manipulative.",
          body:
            "Use one real problem the audience already recognizes. Do not pile on several unrelated frustrations. Show how the product enters the situation, what changes, and what the viewer can actually observe.",
          noteLabel: "Ad structure",
          noteBody: "Recognizable friction -> product action -> visible change -> CTA.",
          cta: "Create a Problem-Solution Ad",
          image: image(
            `${productAdImageRoot}/product-ad-video-problem-solution-cleaning-scene.jpg`,
            "Adult woman using a spray cleaner on a mirror for a problem-solution product ad scenario",
            3183,
            4774
          )
        }),
        makeUseCaseCard({
          scenarioLabel: "Benefit / Feature Ad",
          title: "Translate the Feature Into the Buyer's Real Benefit",
          problem: "The product has a useful feature, but the ad only names it instead of showing why it matters.",
          body:
            "Show the feature in context. A control, material, capacity, fit, battery indicator, accessory, design choice, or workflow only becomes persuasive when the viewer understands what it helps them do.",
          noteLabel: "Ad structure",
          noteBody: "Audience need -> feature in use -> practical benefit -> proof -> CTA.",
          cta: "Create a Benefit or Feature Ad",
          image: image(
            `${productAdImageRoot}/product-ad-video-benefit-feature-headphones.jpg`,
            "Adult man presenting wireless headphones for a product feature and benefit ad",
            5192,
            3466
          )
        }),
        makeUseCaseCard({
          scenarioLabel: "Limited-Time Offer Ad",
          title: "Make the Offer Easy to Understand Without Hiding the Conditions",
          problem: "The offer is strong, but urgency overwhelms the product value or the terms are too vague.",
          body:
            "State the real offer, who or what it applies to, and the relevant timing or condition. The discount should accelerate an already understandable product decision—not replace the reason to buy.",
          noteLabel: "Keep accurate",
          noteBody: "Product relevance -> real offer -> condition or timing -> next action.",
          cta: "Create a Limited-Time Offer Ad",
          image: image(
            `${productAdImageRoot}/product-ad-video-limited-offer-shopping-response.jpg`,
            "Adult shopper reacting to a smartphone while holding shopping bags for an offer ad scenario",
            5184,
            2920
          )
        }),
        makeUseCaseCard({
          scenarioLabel: "Comparison / Why Choose It Ad",
          title: "Compare on the Decision the Buyer Is Actually Making",
          problem: "The customer is already comparing options, but the ad uses vague “better” language instead of a useful criterion.",
          body:
            "Choose one or two legitimate criteria: size, included accessories, workflow, material, compatibility, price structure, portability, maintenance, or another verifiable difference. Do not create a fake competitor weakness simply to make the product win.",
          noteLabel: "Ad structure",
          noteBody: "Decision context -> comparison criterion -> evidence -> who it fits -> CTA.",
          cta: "Create a Comparison Ad",
          image: image(
            `${productAdImageRoot}/product-ad-video-comparison-shopping-decision.jpg`,
            "Adults comparing products on a laptop and smartphone during an online shopping decision",
            6016,
            4016
          )
        }),
        makeUseCaseCard({
          scenarioLabel: "Retargeting / Reminder Ad",
          title: "Answer the Reason Someone Might Still Be Hesitating",
          problem: "The viewer already knows the product, so replaying the awareness ad wastes the second chance.",
          body:
            "Use the reminder to reduce remaining uncertainty: size, shipping, return terms, included items, compatibility, proof, price, availability, or a real offer. Retargeting creative should continue the decision instead of restarting the introduction.",
          noteLabel: "Ad structure",
          noteBody: "Recognition -> unresolved question -> proof or offer -> return to product.",
          cta: "Create a Retargeting Reminder Ad",
          image: image(
            `${productAdImageRoot}/product-ad-video-retargeting-purchase-reminder.jpg`,
            "Adult shopper using a smartphone and payment card beside personal-care products for a retargeting ad scenario",
            6720,
            4480
          )
        })
      ]
    },
    foundation: {
      eyebrow: "START WITH THE MEDIA DECISION, NOT THE EDIT",
      title: "A Strong Ad Brief Makes Six Choices Before the First Cut",
      intro:
        "Before generating, decide who the ad is for, what decision it should support, and what evidence can carry the message without adding unsupported claims.",
      leftTitle: "Decide first",
      leftItems: [
        "Audience: who is this specific version for?",
        "Problem or desire: what tension does this audience already understand?",
        "Product promise: what can the product accurately claim here?",
        "Proof: what visual or observable evidence supports the promise?",
        "Offer: is there a real reason to act now, and what are its conditions?",
        "CTA: what one next action fits this ad?"
      ],
      rightTitle: "Keep the brief focused",
      rightItems: [
        "Do not write one ad for every possible audience.",
        "Do not stack several unrelated problems into one opening.",
        "Do not make a promise that the product evidence cannot support.",
        "Do not separate the proof from the claim it is meant to support.",
        "Do not use urgency, discounts, or original prices that are not verified.",
        "Do not end with several competing destinations or CTAs."
      ],
      rightTone: "avoid",
      expertLabel: "EXPERT TIP",
      expertTip:
        "If the ad contains three audiences, five promises, four proofs, two offers, and several CTAs, it probably needs to become several ads—not one “complete” ad."
    },
    guidance: {
      eyebrow: "THE PRODUCT AD MESSAGE",
      title: "Audience -> Promise -> Proof -> Offer -> CTA",
      intro: "Make the message easy to follow before making the edit fast.",
      cards: [
        guidanceCard({
          title: "Audience cue",
          body: "Use the first visual or line to tell the right viewer that this ad is relevant to them."
        }),
        guidanceCard({
          title: "Promise",
          body: "State the product value in language that can be supported by the product and the approved evidence."
        }),
        guidanceCard({
          title: "Proof",
          body: "Show the evidence as close as possible to the claim it supports."
        }),
        guidanceCard({
          title: "Offer",
          body: "Use pricing or urgency only when the terms are real, clear, and relevant to the decision."
        }),
        guidanceCard({
          title: "CTA",
          body: "End on the next action—not another new selling point."
        })
      ]
    },
    platformExamples: {
      eyebrow: "PLACEMENT ADAPTATION",
      title: "One Campaign Idea Can Need More Than One Finished Cut",
      intro:
        "Keep the campaign claim and evidence consistent, but reframe the composition, opening, captions, text-safe areas, and CTA presentation for the intended placement. Validate the current destination requirements at publishing time.",
      items: [
        guidanceCard({
          title: "Vertical-first cut",
          body: "Use when the target placement is phone-first and vertical-friendly. Keep the main product, person, proof, and essential text readable in a tall frame."
        }),
        guidanceCard({
          title: "Square / flexible-feed cut",
          body: "Recompose rather than simply crop the vertical version. Make sure the proof and CTA still survive the tighter frame."
        }),
        guidanceCard({
          title: "Horizontal cut",
          body: "Use the added width intentionally for product context, comparison, demonstration, or scene information instead of leaving the subject isolated in the center."
        })
      ]
    },
    comparison: {
      eyebrow: "CHOOSE THE RIGHT VIDEO JOB",
      title: "Product Ad Is Not Product Video, Product Demo, or Promo",
      intro:
        "Keep these pages distinct by the customer decision they support. The right brief starts with the question the viewer still needs answered.",
      items: [
        {
          title: "Product Video",
          body: "Use Product Video when the viewer first needs to understand the product itself: scale, materials, features, use context, packaging, and important details."
        },
        {
          title: "Product Demo Video",
          body: "Use Product Demo Video when the viewer needs to understand how the product works: goal, setup, action, feedback, result, and the steps that connect them."
        },
        {
          title: "Product Ad Video",
          body: "Use Product Ad Video when a defined audience needs a campaign message built around a supported promise, visual proof, accurate offer, and one next action."
        },
        {
          title: "Promo Video",
          body: "Use Promo Video when the subject is broader than one product decision, such as a campaign, event, collection, announcement, seasonal push, or brand promotion."
        }
      ]
    },
    steps: {
      eyebrow: "FROM PRODUCT GOAL TO AD DRAFT",
      title: "Five Steps From Product Goal to Ad Draft",
      items: [
        { title: "Choose the ad job", body: "Launch, problem-solution, feature or benefit, offer, comparison, or retargeting." },
        { title: "Define audience and decision", body: "State who the ad is for and what decision or hesitation it should move." },
        { title: "Add approved product evidence", body: "Use product images, source clips, real specs, screenshots, offer terms, packaging, or other approved proof." },
        { title: "Generate the creative draft", body: "Build the ad using only actual myDreamshoots generation capabilities and the intended placement context." },
        { title: "Review before publishing", body: "Verify claims, price or discount, proof, CTA destination, rights, disclosure, and placement crop." }
      ],
      cta: "Create My Product Ad"
    },
    value: {
      eyebrow: "MESSAGE TESTING WITHOUT CHANGING THE FACTS",
      title: "Test the Angle—Not the Truth",
      image: image(
        `${productAdImageRoot}/product-ad-video-skincare-customer-context.jpg`,
        "Adult woman holding a skincare product in a studio customer-context scene",
        3648,
        5472
      ),
      items: [
        {
          title: "Good variables to test",
          body: "Opening audience cue, pain point versus aspiration, proof order, first product shot, comparison criterion, CTA wording, and placement crop."
        },
        {
          title: "Facts that must stay consistent",
          body: "Product functionality, price and offer terms, availability facts, customer quote meaning, before-and-after conditions, and specification data."
        },
        {
          title: "One source library, several angles",
          body: "Use the same approved product material to test different openings, proof sequences, and destinations without changing what the product actually does."
        },
        {
          title: "Separate variants when the decision changes",
          body: "If the audience, buying tension, promise, proof, or CTA changes substantially, make a focused variant instead of crowding every angle into one ad."
        }
      ]
    },
    trust: {
      eyebrow: "CREATE RESPONSIBLY",
      title: "An Ad Can Be Persuasive Without Making the Evidence Less Accurate",
      intro: "Before publishing:",
      items: [
        { title: "Verify product facts", body: "Verify product names, models, prices, discounts, availability, and offer dates." },
        { title: "Use supportable claims", body: "Use only claims the product and approved evidence can support." },
        { title: "Keep comparisons fair", body: "Show before-and-after evidence under fair, representative conditions and use verifiable comparison criteria." },
        { title: "Do not fabricate proof", body: "Do not fabricate reviews, ratings, testimonials, customer counts, awards, endorsements, or competitor weaknesses." },
        { title: "Label stock context honestly", body: "Do not imply that stock imagery shows actual customers, staff, or product results unless that is true." },
        { title: "Keep material conditions visible", body: "Keep subscription, compatibility, shipping, refill, accessories, returns, and exclusions visible when they affect the decision." },
        { title: "Review destination rules", body: "Review the destination platform's current rules for realistic AI-generated or altered advertising content." },
        { title: "Keep the CTA relevant", body: "Make the ad destination and CTA match the promise and decision in the creative." }
      ]
    },
    faq: {
      eyebrow: "QUESTIONS? WE'VE GOT ANSWERS",
      title: "Frequently Asked Questions",
      items: [
        {
          question: "What is an AI product ad video generator?",
          answer: "It helps turn approved product material, a defined audience, a supported product promise, proof, offer, and CTA into product advertising video drafts."
        },
        {
          question: "How is Product Ad Video different from Product Video?",
          answer: "Product Video helps someone understand the product. Product Ad Video is built around a specific campaign audience and decision, with a focused promise, evidence, and CTA."
        },
        {
          question: "Should every ad include a discount?",
          answer: "No. A discount is useful only when a real offer is part of the campaign. Product relevance and proof should still make sense without invented urgency."
        },
        {
          question: "How many benefits should one ad include?",
          answer: "Usually only the benefits needed to support the main buying decision. If several benefits compete for attention, create separate variants around different angles."
        },
        {
          question: "Can I make comparison ads?",
          answer: "Yes when the comparison uses accurate, verifiable criteria and does not misrepresent another product or brand."
        },
        {
          question: "Can the same ad run everywhere?",
          answer: "A campaign idea can be reused, but the finished creative may need different framing, text placement, crop, captions, and CTA presentation for different placements."
        },
        {
          question: "How should I review a product ad before publishing?",
          answer: "Check that the product, claims, offer, destination, and call to action are accurate, and do not present a static mockup as a finished product video."
        },
        {
          question: "Can I use the result commercially?",
          answer: "Commercial use depends on your plan and the current myDreamshoots terms. Review those terms before publishing."
        }
      ]
    },
    finalCta: {
      eyebrow: "MAKE THE NEXT DECISION CLEARER",
      title: "Make One Buyer Decision Easier",
      body: "Choose the audience, the real reason to care, the promise you can support, the proof that makes it believable, and the one next action this ad should earn.",
      cta: "Create My Product Ad",
      microcopy: "Use product material and claims you are allowed to publish, and review the finished ad for accuracy before sharing."
    }
  },
  "promo-video": {
    seo: {
      title: "AI Promo Video Maker for Launches, Offers & Announcements | myDreamshoots",
      description:
        "Create promotional videos for launches, limited-time offers, events, seasonal campaigns, and product updates with an AI promo video maker. Structure the message, proof, timing, terms, and CTA around verified product inputs and real generated outputs.",
      keywords:
        "AI promo video maker, AI promotional video maker, promo video generator, promotional video generator, AI marketing promo video, product launch video maker, sale promo video maker, event promo video generator, social media promo video maker",
      canonicalPath: "/ai-video-generation/promo-video"
    },
    hero: {
      eyebrow: "AI PROMO VIDEO MAKER",
      title: "AI Promo Video Maker for Launches, Offers & Announcements",
      body:
        "Turn one promotional moment into a video people can understand quickly: what is happening, who it is for, why it matters now, what evidence supports the message, when the offer or event is valid, and what the viewer should do next. Build the draft around verified product, campaign, event, and offer inputs—not invented urgency.",
      primaryCta: "Create a Promo Video",
      secondaryCta: "See Promo Examples",
      availabilityNote:
        "The current video workspace is the verified creation path. This page does not claim a separate Promo-only generator or unverified campaign controls.",
      rightsCopy:
        "Dates, discounts, prices, availability, eligibility, launch timing, event details, countdowns, and product claims must match the real destination and current campaign terms.",
      imageNote: "Goal -> Reason now -> Message -> Proof -> Timing / Terms -> CTA",
      highlights: ["Goal", "Reason now", "Message", "Proof", "Timing / Terms", "CTA"],
      image: image(
        `${promoImageRoot}/promo-video-product-launch-presentation.jpg`,
        "Presenter showcasing a product during a launch-style promotional event",
        4254,
        6381
      )
    },
    quickAnswer: {
      eyebrow: "WHAT TO MAKE CLEAR",
      title: "What Should an AI Promo Video Maker Help You Make Clear?",
      intro:
        "A promo video is usually tied to a moment that can expire: a launch, a sale, an event, a seasonal push, a feature release, or another announcement. The video therefore needs more than attractive footage. It needs a clear promotional fact pattern.",
      cards: [
        { title: "What is happening?", body: "Name the launch, offer, event, update, activation, or seasonal promotion without burying it behind generic hype." },
        { title: "Who is it for?", body: "Clarify the relevant audience or eligibility when the promotion does not apply to everyone." },
        { title: "Why now?", body: "State the real reason the message matters now: a verified date, availability window, launch state, event timing, or campaign condition." },
        { title: "What can the viewer verify?", body: "Show product, feature, venue, included items, price context, visible transformation, interface state, or another proof point that supports the promotional claim." },
        { title: "What should they do next?", body: "Use one CTA that matches the destination: learn more, register, shop the offer, join the launch, watch the reveal, or another real next step." }
      ]
    },
    useCases: {
      eyebrow: "SIX PROMO VIDEO JOBS",
      title: "Choose the Promotional Job Before You Choose the Look",
      intro:
        "A launch, sale, event, update, seasonal campaign, and social promo each need a different information sequence. Choose the job first so the creative keeps the facts visible.",
      items: [
        makeUseCaseCard({
          scenarioLabel: "01 - PRODUCT LAUNCH / REVEAL",
          title: "Build Anticipation Around a Real Reveal",
          problem: "A launch teaser creates suspense but never tells people what is launching or when they can act.",
          body: "Lead with the category, problem, or visible product cue, then reveal the actual product or release. Put the verified launch date or availability state close to the CTA.",
          noteLabel: "Structure",
          noteBody: "Teaser -> reveal -> key benefit -> visible proof -> launch timing -> CTA",
          cta: "Create a Launch Promo",
          image: image(`${promoImageRoot}/promo-video-product-launch-presentation.jpg`, "Presenter showcasing a product during a launch-style promotional event", 4254, 6381)
        }),
        makeUseCaseCard({
          scenarioLabel: "02 - LIMITED-TIME OFFER / SALE",
          title: "Make the Offer Understandable Before You Make It Urgent",
          problem: "Limited time becomes the whole message while the actual saving, eligible items, and conditions remain unclear.",
          body: "Show what changes for the customer, who or what qualifies, the condition that matters, and the real end date. Do not create a countdown unless it is tied to a real deadline.",
          noteLabel: "Structure",
          noteBody: "Offer -> qualification -> proof -> conditions -> deadline -> CTA",
          cta: "Create an Offer Promo",
          image: image(`${promoImageRoot}/promo-video-limited-time-offer-sale.jpg`, "Shopping bags with sale signage representing a limited-time promotional offer", 3740, 5610)
        }),
        makeUseCaseCard({
          scenarioLabel: "03 - EVENT ANNOUNCEMENT",
          title: "Put the Event Facts Where the Viewer Can Act on Them",
          problem: "The video looks exciting but makes the viewer search for the date, location, registration path, or reason to attend.",
          body: "Name the event, audience, date or time, location or format, and the strongest reason to attend. Use footage to support the experience, not replace logistical clarity.",
          noteLabel: "Structure",
          noteBody: "What -> who -> when / where -> reason to attend -> proof -> CTA",
          cta: "Create an Event Promo",
          image: image(`${promoImageRoot}/promo-video-event-announcement-conference.jpg`, "Speaker presenting on stage at an indoor event or conference", 4195, 6293)
        }),
        makeUseCaseCard({
          scenarioLabel: "04 - PRODUCT / FEATURE UPDATE",
          title: "Show the Change Before You Sell the Excitement",
          problem: "The video announces new without showing what actually changed.",
          body: "Start with the previous friction or use case, show the updated feature or product state, and explain who benefits. Avoid claiming availability before the release state is verified.",
          noteLabel: "Structure",
          noteBody: "Change -> use case -> visible proof -> availability -> CTA",
          cta: "Create an Update Promo",
          image: image(`${promoImageRoot}/promo-video-feature-release-laptop.jpg`, "Laptop screen displaying software code for a product or feature update concept", 4928, 3280)
        }),
        makeUseCaseCard({
          scenarioLabel: "05 - SEASONAL CAMPAIGN",
          title: "Use the Season as Context for a Specific Promotion",
          problem: "The season dominates the creative while the product, promotion, and next step remain generic.",
          body: "Tie the seasonal moment to one relevant need or behavior. Keep price, bundles, gift eligibility, shipping cutoffs, dates, and availability accurate.",
          noteLabel: "Structure",
          noteBody: "Seasonal moment -> relevant need -> product / offer -> terms -> timing -> CTA",
          cta: "Create a Seasonal Promo",
          image: image(`${promoImageRoot}/promo-video-seasonal-campaign-holiday-retail.jpg`, "Holiday retail display with gifts and seasonal products in a store", 4160, 6240)
        }),
        makeUseCaseCard({
          scenarioLabel: "06 - SOCIAL / SHORT-FORM PROMO",
          title: "Compress the Promotion to One Reason to Act",
          problem: "The edit contains too many messages for a short attention window.",
          body: "Use one hook, one promotional value proposition, one proof point, one real urgency signal, and one destination. Let platform-specific versions change framing—not the underlying facts.",
          noteLabel: "Structure",
          noteBody: "Hook -> value -> proof -> urgency -> CTA",
          cta: "Create a Social Promo",
          image: image(`${promoImageRoot}/promo-video-social-promo-creator-setup.jpg`, "Creator setting up a smartphone and ring light for a short-form promotional video", 5722, 3815)
        })
      ]
    },
    evidence: {
      eyebrow: "PROVE THE GENERATOR, NOT JUST THE PROMO CATEGORY",
      title: "Show What myDreamshoots Actually Accepts, Controls, and Generates",
      intro: "Stock campaign imagery explains promotional contexts, but it cannot prove the product itself. Replace these evidence-ready slots with verified myDreamshoots captures before publishing.",
      cards: [
        { title: "Real input", body: "Show an actual input state a user can provide today and caption the verified asset or input type supplied.", exampleLabel: "First-party evidence required", exampleBody: "No first-party input capture was included in the delivery package." },
        { title: "Real direction / controls", body: "Show only controls, settings, or prompt instructions that exist now. Do not add invented duration, ratio, voice, template, platform, music, caption, or export controls.", exampleLabel: "First-party evidence required", exampleBody: "Product and development verification is required before publishing control claims." },
        { title: "Real generated output", body: "Embed or show a verified output generated through the current product, with a matching thumbnail and concise Input -> Direction -> Output caption.", exampleLabel: "First-party evidence required", exampleBody: "A public generated Promo output was not supplied with this content package." },
        { title: "Product fact strip", body: "Publish only verified facts such as supported inputs, outputs, duration, audio, credits, export behavior, or commercial-use terms. Omit unverified fields.", exampleLabel: "Fact check required", exampleBody: "Fact-strip fields remain intentionally empty until product verification is complete." }
      ]
    },
    examples: {
      eyebrow: "REAL PROMO EXAMPLES",
      title: "Show What a Real Promotional Brief Becomes",
      intro: "Use first-party examples when available. Stock scene references explain the promotional context but must not be presented as myDreamshoots outputs.",
      cards: [
        {
          title: "Launch Promo",
          body: "Reserve this slot for a real myDreamshoots launch case with one verified product or campaign fact pattern.",
          details: [
            { label: "Input", body: "Verified source asset - pending capture." },
            { label: "Brief", body: "Product, launch state, proof, timing, and CTA - pending product record." },
            { label: "Output", body: "Real generated video and matching thumbnail - pending." },
            { label: "Why", body: "Launch fact appears early, proof supports the message, and timing matches the destination - pending review." }
          ],
          exampleLabel: "First-party proof required",
          exampleBody: "This card is an evidence-ready slot, not a fabricated customer result."
        },
        {
          title: "Limited-Time Offer",
          body: "Use a verified offer case where the discount, eligibility, conditions, and deadline all match the destination.",
          details: [
            { label: "Input", body: "Verified source asset - pending capture." },
            { label: "Facts", body: "Offer, eligibility, and deadline - pending campaign record." },
            { label: "Output", body: "Real generated video and matching thumbnail - pending." },
            { label: "Why", body: "The offer is legible, conditions are visible, and urgency is factual - pending review." }
          ],
          exampleLabel: "First-party proof required",
          exampleBody: "Do not turn a stock sale image into a verified product outcome."
        },
        {
          title: "Event or Seasonal Promo",
          body: "Use a verified event or seasonal campaign case where the viewer can understand what, when, why, and where to act.",
          details: [
            { label: "Input", body: "Verified event, product, or campaign asset - pending capture." },
            { label: "Facts", body: "Date, location or format, reason to attend, and terms - pending campaign record." },
            { label: "Output", body: "Real generated video and matching thumbnail - pending." },
            { label: "Why", body: "The message preserves the campaign facts while keeping the visual experience clear - pending review." }
          ],
          exampleLabel: "First-party proof required",
          exampleBody: "The package does not include a generated output, so no result is claimed here."
        }
      ]
    },
    foundation: {
      eyebrow: "PROMO BRIEF MODEL",
      title: "Write the Promotional Fact Pattern Before the Creative Brief",
      intro: "A Promo Video brief should make the campaign facts easy to verify before the edit adds pace, energy, or atmosphere.",
      leftTitle: "Decide first",
      leftItems: [
        "Goal: launch, offer, event, update, seasonal campaign, or social promotion.",
        "Audience: who is the message for and who is eligible?",
        "Reason now: what verified date, availability, release state, or campaign condition matters?",
        "Offer or announcement: what exactly is changing or being announced?",
        "Proof: what can the viewer see or verify?",
        "Timing, terms, and CTA: what conditions and next action must remain visible?"
      ],
      rightTitle: "Avoid",
      rightItems: [
        "Do not invent countdowns, discounts, stock levels, dates, or launch availability.",
        "Do not hide eligibility, exclusions, shipping cutoffs, or event logistics behind hype.",
        "Do not use generic seasonal language without a specific product, offer, or next step.",
        "Do not change the underlying campaign facts when adapting the crop or platform version.",
        "Do not claim the stock reference image is a real customer, event, or product result."
      ],
      rightTone: "avoid",
      expertLabel: "EXPERT TIP",
      expertTip: "If the promotion cannot be summarized in one verified fact pattern, split the campaign into focused versions before you choose a visual style."
    },
    guidance: {
      eyebrow: "MESSAGE HIERARCHY",
      title: "Goal -> Audience -> Reason Now -> Message -> Proof -> Terms -> CTA",
      intro: "Make the promotional logic easy to follow before making the edit fast.",
      cards: [
        guidanceCard({ title: "Goal", body: "Name the job: launch, offer, event, update, seasonal campaign, or social promotion." }),
        guidanceCard({ title: "Audience", body: "Tell the relevant viewer why this message applies to them and state eligibility when it matters." }),
        guidanceCard({ title: "Reason now", body: "Use a real date, release state, availability window, event timing, or campaign condition." }),
        guidanceCard({ title: "Message", body: "State what is launching, changing, offered, happening, or worth attending." }),
        guidanceCard({ title: "Proof", body: "Show product, feature, venue, included items, price context, interface state, or another supportable detail." }),
        guidanceCard({ title: "Terms and CTA", body: "Keep conditions visible and end with one action that matches the destination." })
      ]
    },
    platformExamples: {
      eyebrow: "URGENCY WITHOUT INVENTING SCARCITY",
      title: "Use Real Campaign Context as the Urgency Signal",
      intro: "A promo can feel timely without fake pressure. Anchor urgency to verified dates, event timing, launch state, offer terms, seasonal behavior, or a real reason to decide now.",
      items: [
        {
          title: "Retail sale context",
          body: "Use a real sale period, eligible product set, condition, and end date. Keep the offer readable before adding visual speed or countdown language.",
          image: image(`${promoImageRoot}/promo-video-retail-sale-shopping.jpg`, "Shoppers comparing clothing during a retail sale promotion", 5353, 3569)
        },
        {
          title: "Brand activation context",
          body: "Use a real event, location, audience, and registration or attendance path. Show the experience as context, not as proof of a result that did not happen.",
          image: image(`${promoImageRoot}/promo-video-brand-activation-booth.jpg`, "Branded trade show booth with product display for a promotional activation", 2976, 5290)
        },
        { title: "Launch timing", body: "Use a verified release or availability state. If the date is not confirmed, say what is known and avoid a fabricated launch countdown." },
        { title: "Seasonal timing", body: "Use the seasonal need, bundle, shipping cutoff, or eligibility condition that is actually true for the campaign." }
      ]
    },
    comparison: {
      eyebrow: "PAGE DIFFERENTIATION / INTERNAL LINKING",
      title: "Promo Video Is About a Time-Bound Promotional Moment",
      intro: "Keep adjacent pages distinct by the customer decision they support.",
      items: [
        { title: "Promo Video", body: "Use for launches, offers, events, seasonal campaigns, feature releases, and social promotions where timing, terms, and CTA are central." },
        { title: "Product Ad Video", body: "Use when the campaign is primarily a paid ad around one audience, product promise, proof hierarchy, offer, and purchase CTA.", href: "/ai-video-generation/product-ad-video", linkLabel: "Explore Product Ad Video" },
        { title: "Product Video", body: "Use when the viewer first needs product clarity: scale, materials, features, use context, packaging, and included items.", href: "/ai-video-generation/product-video", linkLabel: "Explore Product Video" },
        { title: "Social Media Video", body: "Use when the main job is adapting a core idea across social placements, crops, captions, pacing, and platform-safe framing.", href: "/ai-video-generation/social-media-video", linkLabel: "Explore Social Media Video" },
        { title: "AI Video Generation", body: "Return to the full video theme directory when the creative job is not yet clear.", href: "/ai-video-generation", linkLabel: "Browse AI Video Generation" }
      ]
    },
    steps: {
      eyebrow: "HOW IT WORKS",
      title: "From Verified Campaign Facts to a Promo Video Draft",
      items: [
        { title: "Choose the promotional job", body: "Launch, offer, event, update, seasonal campaign, or social promotion." },
        { title: "Write the fact pattern", body: "Define the goal, audience, reason now, announcement or offer, proof, timing, terms, and CTA." },
        { title: "Add approved source material", body: "Use product, event, venue, feature, offer, or campaign assets you are allowed to publish." },
        { title: "Generate with supported options", body: "Use only the current myDreamshoots workflow and verified controls. Do not assume Promo-specific settings." },
        { title: "Review before publishing", body: "Check every date, discount, eligibility rule, product detail, event fact, crop, disclosure, destination, and CTA against the real campaign." }
      ],
      cta: "Create a Promo Video"
    },
    value: {
      eyebrow: "CAMPAIGN FACT CHECK",
      title: "A Clear Promo Keeps the Facts Close to the Visual Moment",
      intro: "Keep the creative energetic while leaving the promotional decision easy to verify.",
      items: [
        { title: "Keep the announcement visible", body: "Do not make the viewer decode what is launching, changing, happening, or offered." },
        { title: "Put proof beside the claim", body: "Show the product, feature, venue, offer context, or interface state near the line it supports." },
        { title: "Treat timing as a fact", body: "Use dates, deadlines, launch states, and availability only when they match the live campaign." },
        { title: "Keep the destination consistent", body: "The CTA, landing page, price or terms, registration path, and final video message should agree." }
      ]
    },
    trust: {
      eyebrow: "RESPONSIBLE USE",
      title: "Urgency Should Come From the Campaign, Not the Copywriter",
      intro: "Before publishing:",
      items: [
        { title: "Verify dates and terms", body: "Verify launch dates, offer periods, event logistics, prices, discounts, eligibility, availability, shipping cutoffs, and exclusions." },
        { title: "Use supportable product claims", body: "Keep product, feature, performance, comparison, and before-and-after claims tied to approved evidence." },
        { title: "Do not fabricate scarcity", body: "Do not invent countdowns, stock levels, customer counts, waitlists, registrations, or expiring access." },
        { title: "Label stock context honestly", body: "Stock images can explain a campaign scenario. They cannot prove a real customer, event, product result, or endorsement." },
        { title: "Keep campaign conditions visible", body: "Do not hide qualifying products, terms, location, format, timing, compatibility, shipping, or returns when they affect the decision." },
        { title: "Review destination rules", body: "Review the destination platform's current rules for realistic AI-generated or altered promotional content." }
      ]
    },
    faq: {
      eyebrow: "QUESTIONS? WE'VE GOT ANSWERS",
      title: "Frequently Asked Questions",
      items: [
        { question: "What is an AI promo video maker?", answer: "It helps turn a verified launch, offer, event, seasonal campaign, product update, or social promotion into a short promotional video draft with a clear message, proof, timing, terms, and CTA." },
        { question: "How is Promo Video different from Product Ad Video?", answer: "Promo Video is organized around a time-bound promotional moment such as a launch, sale, event, or announcement. Product Ad Video is organized around one paid-campaign audience, product promise, proof hierarchy, offer, and purchase action." },
        { question: "Should every promo video include a discount or countdown?", answer: "No. Use a discount or countdown only when a real campaign has verified terms and a real deadline. A launch date, event time, release state, or seasonal cutoff can be the relevant reason now without fabricated scarcity." },
        { question: "What should I prepare before making a promo video?", answer: "Prepare the promotional goal, audience, verified reason now, announcement or offer, product or campaign proof, timing and conditions, destination, and one CTA. Confirm which input types and controls the current myDreamshoots workflow supports." },
        { question: "Can I use stock images as my generated promo examples?", answer: "Stock images can explain the promotional scenario, but they should not be presented as myDreamshoots generated output, a real customer result, or proof that a real event or offer happened." },
        { question: "Can one promo video run on every platform?", answer: "The campaign facts can stay consistent, but the finished creative may need different framing, crop, text placement, captions, pacing, and CTA presentation for each destination." },
        { question: "Can I use a fictional campaign or event in a promo concept?", answer: "You can use a clearly labeled concept for creative planning, but do not present fictional dates, discounts, availability, attendance, or results as real campaign facts." },
        { question: "Can I use the result commercially?", answer: "Commercial use depends on your plan and the current myDreamshoots terms. Review those terms, the finished creative, and all campaign claims before publishing." }
      ]
    },
    finalCta: {
      eyebrow: "MAKE THE PROMOTIONAL MOMENT CLEAR",
      title: "Create a Promo Video Around a Real Reason to Act",
      body: "Choose the promotional job, write the verified facts, show the proof, keep timing and terms visible, and end with the one next action this campaign should earn.",
      cta: "Create a Promo Video",
      microcopy: "Verified campaign facts. Supportable proof. Clear timing and terms. One relevant CTA."
    }
  },
  "video-ad": {
    seo: {
      title: "AI Video Ad Generator for Paid Social | myDreamshoots",
      description:
        "Create video ad concepts with AI for paid social, product campaigns, launches, retargeting, and creator-style placements. Start from text or an image, shape the hook, proof, and CTA, then review the output in your myDreamshoots workflow.",
      keywords:
        "ai video ad generator, paid social video ad generator, AI video ad maker, performance marketing video creator, paid social creative generator, campaign video variant creator",
      canonicalPath: "/ai-video-generation/video-ad"
    },
    hero: {
      eyebrow: "AI VIDEO AD GENERATOR",
      title: "AI Video Ad Generator for Paid Social Campaigns",
      body:
        "Create campaign-focused video ad concepts from a written brief or an approved image. Shape the hook, product moment, supportable proof, placement, and CTA before you review the output in the myDreamshoots workflow.",
      primaryCta: "Create a Video Ad",
      secondaryCta: "Explore AI Video Generation",
      availabilityNote:
        "Use the current myDreamshoots video workspace to confirm supported inputs, credit requirements, and available output controls before generation.",
      rightsCopy:
        "Use approved product assets and supportable campaign facts. Do not invent ratings, results, discounts, deadlines, prices, creator experiences, or platform performance.",
      imageNote: "Scene references for campaign planning, not claims of one-click presets or generated output.",
      highlights: ["Text or image input", "Paid social", "Placement-aware", "Campaign variants"],
      image: image(
        `${videoAdImageRoot}/video-ad-creator-phone-tripod.jpg`,
        "Creator filming a vertical product video with a phone on a tripod.",
        4000,
        6000,
        "50% 34%"
      )
    },
    quickAnswer: {
      eyebrow: "WHAT THIS CREATES",
      title: "Short Campaign-Focused Motion for One Clear Advertising Job",
      intro:
        "A useful video ad brief makes one campaign decision easy to understand. It helps teams choose the objective, audience stage, hook, proof, placement, and CTA without turning every ad into the same generic creative.",
      cards: [
        { title: "Paid social concept", body: "Plan a focused paid-social video direction around one offer, product moment, audience stage, and next action." },
        { title: "Product campaign angle", body: "Turn approved product photos or a written brief into a clearer ad concept without adding unsupported claims." },
        { title: "Retargeting direction", body: "Reframe the same product moment for viewers who already know the brand, product, or campaign context." },
        { title: "Creator-style placement", body: "Use a creator-aware framing idea while keeping speaker status, product facts, and CTA boundaries clear." }
      ]
    },
    useCases: {
      eyebrow: "VIDEO AD JOBS",
      title: "Choose the Ad Job Before You Choose the Look",
      intro:
        "Video Ad covers broader paid-video planning than a single product demo, UGC script, or promo announcement. Start with the customer decision and the placement, then choose the visual direction.",
      items: [
        makeUseCaseCard({
          scenarioLabel: "01 - CREATOR HOOK",
          title: "Open With a Specific Campaign Hook",
          problem: "The ad starts with movement but does not quickly explain why the viewer should care.",
          body: "Use one audience-specific hook and one product moment. Keep the first seconds tied to a real campaign job instead of generic attention language.",
          noteLabel: "Direction",
          noteBody: "Audience stage -> hook -> product moment -> supportable proof -> CTA.",
          cta: "Create a Creator Hook",
          image: image(
            `${videoAdImageRoot}/video-ad-creator-phone-tripod.jpg`,
            "Creator filming a vertical product video with a phone on a tripod.",
            4000,
            6000,
            "50% 34%"
          )
        }),
        makeUseCaseCard({
          scenarioLabel: "02 - SHOPPING INTENT",
          title: "Match the Ad to a Buying Question",
          problem: "The product appears, but the ad does not answer the question that made the viewer hesitate.",
          body: "Use a buying question, visible product proof, and one relevant next action so the ad feels useful before it feels promotional.",
          noteLabel: "Direction",
          noteBody: "Question -> product context -> proof -> decision cue -> CTA.",
          cta: "Create a Shopping-Intent Ad",
          image: image(
            `${videoAdImageRoot}/video-ad-ecommerce-shopping-intent.jpg`,
            "Online shopping scene illustrating product-led video ad intent.",
            4480,
            6720,
            "50% 35%"
          )
        }),
        makeUseCaseCard({
          scenarioLabel: "03 - VARIANT WORKFLOW",
          title: "Test the Angle Without Changing the Facts",
          problem: "Every variant invents a different promise, discount, or performance claim.",
          body: "Change the hook, proof order, crop, or CTA wording while keeping product facts, offer terms, and claim support stable.",
          noteLabel: "Direction",
          noteBody: "Stable facts -> hook test -> proof order -> placement fit -> review.",
          cta: "Create Ad Variants",
          image: image(
            `${videoAdImageRoot}/video-ad-editing-variant-workflow.jpg`,
            "Video editing workspace used to compare campaign creative variants.",
            5184,
            3456
          )
        }),
        makeUseCaseCard({
          scenarioLabel: "04 - SPEAKER-LED AD",
          title: "Use a Speaker Without Inventing a Testimonial",
          problem: "The creative sounds personal even when no real customer experience has been verified.",
          body: "Identify the speaker role and use lines that match that role. Keep claims connected to visible proof or approved product facts.",
          noteLabel: "Direction",
          noteBody: "Speaker role -> careful hook -> product context -> qualified proof -> CTA.",
          cta: "Create a Speaker-Led Ad",
          image: image(
            `${videoAdImageRoot}/video-ad-influencer-recording.jpg`,
            "Creator recording a speaker-led social video ad concept beside a product setup.",
            5720,
            3818
          )
        }),
        makeUseCaseCard({
          scenarioLabel: "05 - ITERATION",
          title: "Use Campaign Learning as Direction, Not a Result Claim",
          problem: "The ad copy implies performance outcomes the product page cannot prove.",
          body: "Use campaign learning to choose the next creative question. Avoid claiming conversion, ROAS, views, or lifts unless they are verified and allowed.",
          noteLabel: "Direction",
          noteBody: "Learning -> hypothesis -> next variant -> supportable claim -> review.",
          cta: "Create an Iteration Brief",
          image: image(
            `${videoAdImageRoot}/video-ad-performance-analytics.jpg`,
            "Campaign analytics screen used to inform the next video ad iteration.",
            5202,
            3468
          )
        }),
        makeUseCaseCard({
          scenarioLabel: "06 - PLACEMENT FIT",
          title: "Design for the Placement Before the Export",
          problem: "The same creative is reused everywhere and key product detail, captions, or CTA text become hard to read.",
          body: "Plan the frame, safe area, product scale, caption load, and final CTA around the placement before generation and review.",
          noteLabel: "Direction",
          noteBody: "Placement -> safe area -> product visibility -> message density -> CTA.",
          cta: "Create a Placement-Aware Ad",
          image: image(
            `${videoAdImageRoot}/video-ad-social-feed-placement.jpg`,
            "Mobile social feed context for placement-aware video ad design.",
            5484,
            3656
          )
        })
      ]
    },
    gallery: {
      eyebrow: "SCENE GALLERY EXAMPLES",
      title: "8 Video-Ad Scene Directions",
      intro:
        "Use the scene gallery as planning reference only. These images represent ad contexts and creative directions, not verified myDreamshoots outputs or proof of one-click presets.",
      cta: "Create a Video Ad",
      ctaHref: "/app/create?videoMode=video-ad#step-video",
      items: [
        {
          title: "Creator + phone tripod",
          body: "Use for a creator-style opening where the phone-first setup is part of the ad language.",
          image: image(
            `${videoAdImageRoot}/video-ad-creator-phone-tripod.jpg`,
            "Creator filming a vertical product video with a phone on a tripod.",
            4000,
            6000,
            "50% 34%"
          )
        },
        {
          title: "Ecommerce shopping intent",
          body: "Use when the ad needs to answer a product research or buying-confidence question.",
          image: image(
            `${videoAdImageRoot}/video-ad-ecommerce-shopping-intent.jpg`,
            "Online shopping scene illustrating product-led video ad intent.",
            4480,
            6720,
            "50% 35%"
          )
        },
        {
          title: "Editing / variant workflow",
          body: "Use when the campaign depends on comparing hooks, proof order, or placement variants.",
          image: image(
            `${videoAdImageRoot}/video-ad-editing-variant-workflow.jpg`,
            "Video editing workspace used to compare campaign creative variants.",
            5184,
            3456
          )
        },
        {
          title: "Influencer recording",
          body: "Use when the ad direction is speaker-led but must avoid fake testimonial language.",
          image: image(
            `${videoAdImageRoot}/video-ad-influencer-recording.jpg`,
            "Creator recording a speaker-led social video ad concept beside a product setup.",
            5720,
            3818
          )
        },
        {
          title: "Performance analytics",
          body: "Use when campaign learning informs the next creative question without becoming an unsupported result claim.",
          image: image(
            `${videoAdImageRoot}/video-ad-performance-analytics.jpg`,
            "Campaign analytics screen used to inform the next video ad iteration.",
            5202,
            3468
          )
        },
        {
          title: "Product studio proof",
          body: "Use when the ad needs close product detail, material context, scale, packaging, or visible proof.",
          image: image(
            `${videoAdImageRoot}/video-ad-product-studio-shoot.jpg`,
            "Product arranged in a studio setting for detail-focused advertising visuals.",
            2832,
            4256,
            "50% 43%"
          )
        },
        {
          title: "Social feed placement",
          body: "Use when safe area, caption load, CTA placement, and feed context matter to the creative.",
          image: image(
            `${videoAdImageRoot}/video-ad-social-feed-placement.jpg`,
            "Mobile social feed context for placement-aware video ad design.",
            5484,
            3656
          )
        },
        {
          title: "Mobile viewing context",
          body: "Use when the ad must be legible from a real phone viewing distance and attention window.",
          image: image(
            `${videoAdImageRoot}/video-ad-social-platform-phone.jpg`,
            "Person viewing short-form social content on a smartphone.",
            4160,
            6240,
            "50% 35%"
          )
        }
      ]
    },
    foundation: {
      eyebrow: "STYLE CUES + BEST FOR",
      title: "Make the First Seconds Carry One Clear Job",
      intro:
        "Video Ad should feel performance-aware without making performance claims. The strongest briefs separate the ad's style, audience stage, evidence, and next action before generation.",
      leftTitle: "Style cues",
      leftItems: [
        "Fast, readable hook that names one buyer tension or campaign promise.",
        "Product or offer appears early enough to anchor the ad.",
        "Proof is visible, supportable, and close to the line it supports.",
        "CTA matches the real destination page, campaign, or workspace action."
      ],
      rightTitle: "Best for",
      rightItems: [
        "Paid social campaign concepts.",
        "Product campaign tests.",
        "Launch and promo ad variants.",
        "Retargeting or reminder ads.",
        "Creator-style paid placements.",
        "Placement-aware ad planning."
      ],
      rightTone: "neutral",
      expertLabel: "EXPERT TIP",
      expertTip:
        "One ad should earn one next step. If the hook, proof, placement, and CTA each point to a different goal, split the concept before generating."
    },
    guidance: {
      eyebrow: "VIDEO AD GUIDE",
      title: "Design the Ad, Not Just the Motion",
      intro:
        "Use these planning cards before generation so the video concept stays tied to the campaign objective and supportable product information.",
      cards: [
        guidanceCard({
          title: "Campaign Objective",
          body: "Name the job first: prospecting, launch awareness, product education, retargeting, offer reminder, or another campaign stage."
        }),
        guidanceCard({
          title: "Hook System",
          body: "Choose one hook type, such as problem, contrast, question, product moment, offer, or proof-first opening. Do not stack every hook into one ad."
        }),
        guidanceCard({
          title: "Proof Boundary",
          body: "List what can actually be shown or claimed: product detail, approved image, visible workflow, factual offer, or verified campaign condition."
        }),
        guidanceCard({
          title: "Placement Fit",
          body: "Plan the frame, caption density, safe area, product scale, and CTA readability for the placement before reviewing the output."
        }),
        guidanceCard({
          title: "Variant Plan",
          body: "Decide what changes between variants and what must remain stable, such as claims, offer terms, price, product facts, speaker role, and destination."
        })
      ]
    },
    comparison: {
      eyebrow: "RELATED PAGES",
      title: "Keep Each Video Intent Distinct",
      intro:
        "Use Video Ad for broad paid-social creative planning. Use the adjacent pages when the job is specifically a product ad, UGC-style ad, promo announcement, or general video theme.",
      items: [
        { title: "AI Video Generation", body: "Browse all current video themes and choose the best-fit creative job before opening the workspace.", href: "/ai-video-generation", linkLabel: "View all video themes" },
        { title: "Product Ad Video", body: "Use when the paid ad is centered on one product promise, proof hierarchy, offer, and purchase CTA.", href: "/ai-video-generation/product-ad-video", linkLabel: "Explore Product Ad Video" },
        { title: "UGC Ad Video", body: "Use when the ad direction depends on creator role, speaker status, conversational script, and product-in-context proof.", href: "/ai-video-generation/ugc-ad-video", linkLabel: "Explore UGC Ad Video" },
        { title: "Promo Video", body: "Use when the campaign is tied to a launch, sale, event, seasonal moment, product update, timing, terms, and CTA.", href: "/ai-video-generation/promo-video", linkLabel: "Explore Promo Video" },
        { title: "Pricing", body: "Review current credit and plan information before starting paid campaign work.", href: "/pricing", linkLabel: "Review pricing" }
      ]
    },
    steps: {
      eyebrow: "HOW IT WORKS",
      title: "Build Around the Campaign Job",
      items: [
        { title: "Choose objective and audience stage", body: "Clarify whether the ad is for awareness, product education, launch, retargeting, offer reminder, or another stage." },
        { title: "Start with text or an approved image", body: "Use the live workspace to choose the supported input path that fits the campaign source material." },
        { title: "Define hook, proof, placement, and CTA", body: "Write the creative direction around one hook, one product moment, supportable proof, placement needs, and one next action." },
        { title: "Generate and review before campaign use", body: "Check the finished output against product facts, offer terms, rights, speaker status, placement readability, and destination accuracy." }
      ],
      cta: "Create a Video Ad"
    },
    value: {
      eyebrow: "START THIS VIDEO WORKFLOW",
      title: "Move From Approved Input to Reviewed Output",
      intro:
        "The current workflow should stay transparent about what the user provides, what the campaign objective is, when credits are used, and where the finished output is reviewed.",
      items: [
        { title: "Source", body: "Text prompt or approved image. Keep the supplied product, offer, and campaign facts traceable." },
        { title: "Objective", body: "One campaign job. Do not combine every funnel stage, product proof, and CTA into a single brief." },
        { title: "Credits", body: "Review the credit requirement before generation in the signed-in workflow." },
        { title: "Delivery", body: "Review the generated output in your signed-in myDreamshoots workflow before using it in a real campaign." }
      ]
    },
    trust: {
      eyebrow: "REVIEW BEFORE CAMPAIGN USE",
      title: "Keep Ad Creative Clear, Supportable, and Placement-Aware",
      intro:
        "A polished ad concept still needs human review before publishing. Check the creative against the actual product, offer, claim support, and campaign destination.",
      items: [
        { title: "Claims", body: "Do not invent reviews, ratings, performance results, discounts, deadlines, price claims, or availability states." },
        { title: "Speaker status", body: "Do not present a stock person, actor, fictional speaker, or AI-generated person as a real customer." },
        { title: "Destination match", body: "Make sure the CTA and offer match the page, product, or campaign where the viewer lands." },
        { title: "Placement readability", body: "Check safe areas, crop, product scale, caption load, and CTA text before campaign use." }
      ]
    },
    faq: {
      eyebrow: "FAQ",
      title: "Video Ad Questions",
      items: [
        {
          question: "What is an AI video ad generator?",
          answer:
            "An AI video ad generator helps turn a text brief or approved image into a video-ad concept. The useful part is not only motion; it is planning the hook, product moment, proof, placement, and CTA around one campaign objective."
        },
        {
          question: "Can I create a video ad from an image?",
          answer:
            "Use the live myDreamshoots workspace to choose the supported input path. If you start with an image, make sure it is approved, accurate, and suitable for the product or campaign claim you want the ad to support."
        },
        {
          question: "Can I create a video ad from text?",
          answer:
            "Use a clear text prompt that names the campaign objective, audience stage, hook, product moment, proof boundary, placement, and CTA. Review the available controls in the current workspace before generation."
        },
        {
          question: "Is Video Ad the same as Product Ad Video?",
          answer:
            "No. Video Ad is a broader paid-social creative planning page. Product Ad Video is more specific to product promise, proof hierarchy, offer, and purchase CTA."
        },
        {
          question: "Can I make multiple ad variants?",
          answer:
            "You can plan variants by changing hook, proof order, placement framing, or CTA wording. Keep product facts, offer terms, speaker status, and supportable claims stable across variants."
        },
        {
          question: "Should I review the ad before publishing?",
          answer:
            "Yes. Review every output for claim support, product accuracy, rights, speaker status, offer terms, crop, caption readability, CTA, and destination match before using it in a campaign."
        }
      ]
    },
    finalCta: {
      eyebrow: "CREATE A FOCUSED VIDEO-AD CONCEPT",
      title: "Create a Focused Video-Ad Concept",
      body: "Create a focused video-ad concept without turning every campaign page into the same template.",
      cta: "Create a Video Ad",
      microcopy:
        "Use approved campaign material and review the finished output for accuracy, rights, and destination fit before publishing."
    }
  },
  "brand-video": {
    seo: {
      title: "AI Brand Video Generator for Brand Stories | myDreamshoots",
      description:
        "Create brand-video concepts with AI for founder stories, company values, product origin, culture, community, and campaign identity. Start from text or an approved image, shape the narrative, then review the result in your myDreamshoots workflow.",
      keywords:
        "ai brand video generator, AI brand video maker, brand storytelling video generator, founder story video, brand identity video, company values video, product origin video, brand culture video",
      canonicalPath: "/ai-video-generation/brand-video"
    },
    hero: {
      eyebrow: "AI BRAND VIDEO GENERATOR",
      title: "AI Brand Video Generator for Brand Stories & Identity",
      body:
        "Turn an approved brand brief, story angle, or image into a short brand-video concept built around recognition and meaning. Explore founder stories, product origin, values, culture, community, and campaign mood without turning the page into another product-ad or corporate-video template.",
      primaryCta: "Create a Brand Video",
      secondaryCta: "Explore AI Video Generation",
      availabilityNote:
        "Use the current myDreamshoots video workspace to confirm supported inputs, credit requirements, and available output controls before generation.",
      rightsCopy:
        "Use approved brand assets and verifiable facts. Review people, products, logos, packaging, text, dates, claims, and visual continuity before publishing.",
      imageNote: "Scene references for brand-story planning, not claims of one-click presets or generated output.",
      highlights: ["Founder story", "Brand values", "Product origin", "Culture & community", "Text to Video", "Image to Video"],
      image: image(
        `${brandVideoImageRoot}/brand-video-founder-story.jpg`,
        "Speaker presenting a product story in an indoor brand or launch setting.",
        4254,
        6381,
        "50% 38%"
      )
    },
    quickAnswer: {
      eyebrow: "WHAT THIS CREATES",
      title: "Identity-Led Motion Around One Brand Memory",
      intro:
        "Brand Video is for founder introductions, origin stories, product-craft narratives, mission and values films, culture reels, customer-community moments, event identity pieces, and short cinematic brand stories.",
      cards: [
        { title: "Core idea", body: "Name what the brand wants people to remember after the film ends." },
        { title: "Voice", body: "Set an approved tone: direct, warm, premium, playful, technical, restrained, or another specific voice." },
        { title: "Visual anchors", body: "Use approved product, people, place, material, packaging, palette, or environment to make the story recognizable." },
        { title: "Proof boundary", body: "Use only origins, milestones, customer statements, claims, awards, dates, or impact facts that can be verified." }
      ]
    },
    useCases: {
      eyebrow: "BRAND VIDEO USE CASES",
      title: "Brand Stories With a Specific Point of View",
      intro: "Choose the brand memory first, then let the narrative and visual anchors support it.",
      items: []
    },
    platformExamples: {
      eyebrow: "BRAND STORY MAP",
      title: "Six Beats for a Stronger Brand Film",
      intro: "Not every brand video needs all six beats. Use the smallest arc that makes the story specific and credible.",
      items: [
        { title: "01 - Origin", body: "Where the story begins." },
        { title: "02 - Tension", body: "What problem, belief, or gap motivated the brand." },
        { title: "03 - Point of view", body: "What the brand believes should be different." },
        { title: "04 - Proof", body: "Product, process, people, place, or evidence that supports the point of view." },
        { title: "05 - People", body: "Who participates in the story: makers, team, customers, or community." },
        { title: "06 - Promise", body: "The memorable closing idea, not an unsupported guarantee." }
      ]
    },
    foundation: {
      eyebrow: "BRAND SIGNALS + BEST FOR",
      title: "Keep the Story Specific Enough to Be Recognizable",
      intro:
        "A brand film should not fit any competitor with the brand name swapped. Build around concrete, approved details rather than generic claims about innovation, quality, or community.",
      leftTitle: "Brand signals to preserve",
      leftItems: [
        "The one core idea the brand wants people to remember.",
        "An approved voice and a clear point of view.",
        "Concrete visual anchors: product, people, place, material, packaging, palette, or environment.",
        "Only claims, milestones, customer statements, dates, awards, and impact facts that can be verified.",
        "A recognizable narrative that belongs to this brand rather than any competitor."
      ],
      rightTitle: "Best for",
      rightItems: [
        "Founder or origin stories.",
        "Brand mission and values films.",
        "Product-craft and behind-the-scenes narratives.",
        "Culture and team stories.",
        "Customer or community storytelling.",
        "Brand launch identity films and event openers."
      ],
      rightTone: "neutral",
      expertLabel: "EXPERT TIP",
      expertTip:
        "Choose one lasting impression. Secondary details should support that memory instead of competing with it."
    },
    steps: {
      eyebrow: "HOW IT WORKS",
      title: "Start With the Story, Then Review Every Detail",
      items: [
        { title: "Define the brand story", body: "Choose the one idea viewers should remember." },
        { title: "Gather approved inputs", body: "Prepare the text brief, image references, product visuals, people, place, and verified facts." },
        { title: "Choose a starting path", body: "Use Text to Video or Image to Video based on the starting asset, then specify mood, motion, and story beat." },
        { title: "Generate and review", body: "Review brand consistency, factual accuracy, people, text, logos, and visual continuity before publishing." }
      ],
      cta: "Create a Brand Video"
    },
    gallery: {
      eyebrow: "SCENE GALLERY",
      title: "8 Brand-Video Scene Directions",
      intro:
        "Use these scene references to plan a brand story. They are editorial references only, not verified myDreamshoots outputs or proof of one-click presets.",
      cta: "Create a Brand Video",
      ctaHref: "/app/create?videoMode=brand-video#step-video",
      items: [
        {
          title: "Founder story",
          body: "Leadership or founder-led opening built around an approved origin narrative.",
          image: image(`${brandVideoImageRoot}/brand-video-founder-story.jpg`, "Speaker presenting a product story in an indoor brand or launch setting.", 4254, 6381, "50% 38%")
        },
        {
          title: "Craft & process",
          body: "Hands-on making, preparation, detail, or behind-the-scenes process.",
          image: image(`${brandVideoImageRoot}/brand-video-craft-process.jpg`, "Hands-on product or food demonstration recorded on a phone tripod.", 4160, 6240, "50% 40%")
        },
        {
          title: "Team culture",
          body: "Collaboration, creative energy, workplace culture, and the people behind the brand.",
          image: image(`${brandVideoImageRoot}/brand-video-team-culture.jpg`, "Two creators recording a collaborative conversation in a studio-like setting.", 4000, 6000, "50% 42%")
        },
        {
          title: "Customer community",
          body: "Lifestyle or community moments that show who the brand belongs with.",
          image: image(`${brandVideoImageRoot}/brand-video-customer-community.jpg`, "Shoppers browsing clothing together in a retail environment.", 5353, 3569, "50% 44%")
        },
        {
          title: "Product identity",
          body: "A recognizable product or brand object used as a visual anchor rather than a hard-sell ad.",
          image: image(`${brandVideoImageRoot}/brand-video-product-identity.jpg`, "Creator holding a beauty product close to camera as a recognizable visual anchor.", 2160, 3840, "50% 40%")
        },
        {
          title: "Values in action",
          body: "Concrete behavior, process, sourcing, care, service, or ritual that makes a value visible.",
          image: image(`${brandVideoImageRoot}/brand-video-values-in-action.jpg`, "Hands recording a food preparation scene for a process-focused brand story.", 3024, 4032, "50% 45%")
        },
        {
          title: "Brand activation",
          body: "Physical presence, installation, booth, pop-up, or branded environment.",
          image: image(`${brandVideoImageRoot}/brand-video-brand-activation.jpg`, "Modern branded trade-show booth illustrating a physical brand activation.", 2976, 5290, "50% 42%")
        },
        {
          title: "Cultural moment",
          body: "Event, talk, launch-stage, or public moment where the brand participates in a larger story.",
          image: image(`${brandVideoImageRoot}/brand-video-cultural-moment.jpg`, "Speaker on stage at an indoor conference or public brand event.", 4195, 6293, "50% 40%")
        }
      ]
    },
    guidance: {
      eyebrow: "BRAND CONSISTENCY GUIDE",
      title: "Make Every Scene Belong to the Same Brand",
      intro: "Use a clear story and recurring visual signals without claiming controls the current product does not publicly confirm.",
      cards: [
        { title: "One memory, not five messages", body: "Write the film around one lasting impression. Let secondary details support that memory instead of competing with it." },
        { title: "Use specific brand nouns", body: "Replace generic language with concrete products, materials, rituals, places, decisions, or behaviors that belong to the brand." },
        { title: "Separate story from claim", body: "A cinematic mood can be expressive. A factual claim must still be true and supportable." },
        { title: "Build a visual identity system", body: "Choose recurring anchors such as framing, lighting, palette, motion, product detail, people, texture, or environment." },
        { title: "Review logo and text accuracy", body: "Generative video can distort words and graphic marks. Review logos, labels, slogans, UI, and other text carefully." },
        { title: "End with a brand promise, not false urgency", body: "Close on a line, belief, invitation, or next step. Use scarcity only when it is a verified promotion." }
      ]
    },
    evidence: {
      eyebrow: "FIRST-PARTY PRODUCT EVIDENCE",
      title: "Product Evidence Is Required Before This Page Can Prove the Workflow",
      intro:
        "The eight editorial photos explain brand-story directions. They do not prove a generated result, customer outcome, or product capability.",
      cards: [
        { title: "Text to Video input", body: "Add a verified myDreamshoots Text to Video input state before treating it as product proof." },
        { title: "Image to Video input", body: "Add a verified Image to Video input state that reflects the current workflow." },
        { title: "Credit confirmation", body: "Use the real credit-confirmation state shown before generation, not a recreated UI." },
        { title: "Generation state", body: "Show a real current generation state when first-party evidence is available." },
        { title: "Reviewed brand-video output", body: "Use a real reviewed Brand Video-style output before presenting a result as myDreamshoots product evidence." }
      ]
    },
    value: {
      eyebrow: "START THIS VIDEO WORKFLOW",
      title: "Turn a Verified Brand Story Into a Reviewable Video Draft",
      intro:
        "The live workspace is the source of truth for supported inputs, credits, and output controls. Keep the brief specific before creating a request.",
      items: [
        { title: "Choose the starting asset", body: "Use Text to Video for a written brand brief or Image to Video when an approved visual is the anchor." },
        { title: "Define the story frame", body: "Set the core memory, story beat, subject, setting, visual mood, motion, and factual boundaries." },
        { title: "Create in the signed-in workflow", body: "Review the live credit requirement shown by the product before starting the request." },
        { title: "Review for brand integrity", body: "Check product appearance, people, logos, packaging, text, claims, locations, colors, and tone before publishing." }
      ]
    },
    trust: {
      eyebrow: "BRAND-INTEGRITY REVIEW",
      title: "Keep the Brand Story Expressive and Verifiable",
      intro: "Before publishing:",
      items: [
        { title: "Use approved assets", body: "Only use brand assets, people, locations, products, and third-party material you control or have permission to use." },
        { title: "Verify factual details", body: "Confirm origins, milestones, customer statements, awards, dates, impact facts, and product claims before they appear in a story." },
        { title: "Review people and consent", body: "Confirm that people are represented appropriately and that consent, likeness, and disclosure requirements are addressed." },
        { title: "Check logos and text", body: "Review every logo, label, slogan, packaging detail, UI string, and third-party mark for accuracy." },
        { title: "Keep the tone truthful", body: "A cinematic treatment should not imply a customer result, partnership, endorsement, or performance claim that cannot be supported." },
        { title: "Match the final destination", body: "Make sure the closing invitation and linked destination match the story rather than making a new unsupported promise." }
      ]
    },
    comparison: {
      eyebrow: "RELATED PAGES",
      title: "Choose the Video Job Before You Choose the Style",
      intro: "Brand Video owns identity, meaning, origin, values, culture, and recognition. Use a neighboring page when the job is paid media, product selling, or promotion.",
      items: [
        { title: "AI Video Generation", body: "Browse all current MyDreamShoots video themes and choose the clearest starting direction.", href: "/ai-video-generation", linkLabel: "Browse AI Video Generation" },
        { title: "Video Ad", body: "Use for paid-media objectives, placement, hooks, proof, CTA, and campaign testing.", href: "/ai-video-generation/video-ad", linkLabel: "Explore Video Ad" },
        { title: "Product Ad Video", body: "Use for product-selling narratives, feature and benefit communication, product proof, offer, and sales CTA.", href: "/ai-video-generation/product-ad-video", linkLabel: "Explore Product Ad Video" },
        { title: "Promo Video", body: "Use for time-bound launches, announcements, offers, events, timing, and promotional CTA.", href: "/ai-video-generation/promo-video", linkLabel: "Explore Promo Video" }
      ]
    },
    faq: {
      eyebrow: "FAQ",
      title: "Brand Video Questions",
      items: [
        { question: "What is an AI brand video generator?", answer: "It is a workflow for turning an approved brand brief, text prompt, or image into short motion designed around brand identity and story. A useful brand-video page helps define the narrative, visual anchors, factual boundaries, and review process instead of simply repeating generic AI-video features." },
        { question: "What should I include in a brand video prompt?", answer: "Start with the one idea viewers should remember, then add the subject, setting, mood, motion, visual anchors, and only the brand facts you can verify. If a product or person must remain recognizable, start from an approved image when that workflow fits the use case." },
        { question: "Can I make a brand video from an image?", answer: "myDreamshoots publicly lists an Image to Video workflow. Use an image you own or have permission to use and review the generated result for identity, product, logo, text, and background accuracy before publishing." },
        { question: "Can I start from text instead?", answer: "myDreamshoots publicly lists Text to Video. A concise brand brief can define the story beat, subject, environment, mood, motion, and intended use." },
        { question: "Is Brand Video the same as Video Ad?", answer: "No. Brand Video owns identity, meaning, origin, values, culture, and recognition. Video Ad owns the paid-media task: campaign objective, placement, hook, proof, CTA, and testing." },
        { question: "Is Brand Video the same as Corporate Video?", answer: "No. Brand Video is story- and identity-led. Corporate Video belongs to formal company profiles, institutional communications, leadership updates, business presentations, employer or investor information, and related communication jobs." },
        { question: "Can I show logos and packaging in AI-generated video?", answer: "Use only brand assets you control or have permission to use. Review generated logos, labels, slogans, and package text carefully because generative output may distort them. Do not assume a dedicated brand-kit feature unless the product team confirms one exists." },
        { question: "What should I review before publishing a brand video?", answer: "Check people and consent, product details, logos, text, claims, dates, locations, third-party marks, brand tone, disclosure requirements, and whether every factual statement can be supported." }
      ]
    },
    finalCta: {
      eyebrow: "CREATE WITH A VERIFIED BRAND BRIEF",
      title: "Turn a Verified Brand Story Into Motion",
      body: "Choose the core memory, make the visual anchors specific, keep facts supportable, and review the finished draft for brand integrity before publishing.",
      cta: "Create a Brand Video",
      microcopy: "Approved assets. Verifiable facts. One recognizable brand story."
    }
  },
  "music-video": {
    seo: {
      title: "AI Music Video Generator for Artist Visuals | myDreamshoots",
      description: "Create AI music-video visuals from text or images for performances, artist promos, dance, visualizers, and cinematic sequences. Plan the look, generate clips, review continuity, and pair approved visuals with properly licensed audio in your publishing workflow.",
      keywords: "ai music video generator, AI music video maker, artist visual generator, performance video generator, AI visualizer maker, dance video concept generator, music promo video maker",
      canonicalPath: "/ai-video-generation/music-video"
    },
    hero: {
      eyebrow: "AI MUSIC VIDEO GENERATOR",
      title: "AI Music Video Generator for Artist Visuals & Performance Concepts",
      body: "Turn a lyric idea, artist mood, visual reference, or approved image into short motion concepts for music-video development. Use myDreamshoots Text to Video or Image to Video to explore performance shots, visual motifs, dance-led scenes, atmospheric cutaways, and cinematic sequence ideas—without pretending the product automatically licenses, uploads, or beat-syncs music unless those capabilities are confirmed.",
      primaryCta: "Create Music Video Visuals",
      secondaryCta: "Explore AI Video Generation",
      availabilityNote: "Use the current myDreamshoots video workspace to confirm supported inputs, credit requirements, and output controls before generation.",
      rightsCopy: "Use approved artist references and properly licensed audio. Review identity, instruments, text, logos, motion continuity, and rights before publishing.",
      imageNote: "Artist identity -> Visual motif -> Performance or narrative -> Motion -> Sequence",
      highlights: ["Performance Visuals", "Artist Identity", "Narrative Scenes", "Dance & Motion", "Text to Video", "Image to Video"],
      image: { src: `${musicVideoImageRoot}/ai-music-video-generator-for-artist-visuals-and-performance-concepts.webp`, alt: "Male singer performing into a vintage microphone under blue and magenta stage lights", width: 864, height: 496 },
      video: { src: `${musicVideoImageRoot}/ai-music-video-generator-for-artist-visuals-and-performance-concepts.mp4`, poster: `${musicVideoImageRoot}/ai-music-video-generator-for-artist-visuals-and-performance-concepts.webp`, label: "AI Music Video Generator for Artist Visuals & Performance Concepts", width: 864, height: 496, fit: "cover" },
      images: [
        image(`${musicVideoImageRoot}/hero-music-video-performance.jpg`, "Female vocalist singing into a studio microphone under red and blue cinematic lighting, used as the dedicated hero performance frame.", 1800, 1200, "50% 42%"),
        image(`${musicVideoImageRoot}/hero-music-video-artist-frame.jpg`, "Indie music artist in a colorful jacket photographed under moody purple studio lighting, used as the dedicated hero artist identity frame.", 1067, 1600, "50% 38%"),
        image(`${musicVideoImageRoot}/hero-music-video-visual-motif.jpg`, "Empty microphone stage surrounded by haze, spotlights, and light beams, used as the dedicated hero visual motif frame.", 1800, 1200, "50% 48%")
      ]
    },
    quickAnswer: {
      eyebrow: "WHAT THIS CREATES",
      title: "Turn Musical Identity Into a Coherent Visual Language",
      intro: "Music Video is for visual development around a track or artist idea, not for claiming automatic audio production or music rights.",
      cards: [
        { title: "Performance-led", body: "Singer, rapper, band, instrumentalist, DJ, or creator performance framing." },
        { title: "Narrative-led", body: "Character, place, atmosphere, symbolic actions, and cinematic story beats." },
        { title: "Visual-led", body: "Lighting, projection, texture, color, motion, styling, and recurring motifs." },
        { title: "Best for", body: "Artist promos, album-era directions, dance sequences, visualizers, social cutdowns, and pre-shoot mood exploration." }
      ]
    },
    useCases: { eyebrow: "MUSIC VIDEO JOBS", title: "Choose the Visual Job Before the Style", intro: "Use the dedicated visual map, gallery, and workflow below to define a track-led concept.", items: [] },
    platformExamples: {
      eyebrow: "MUSIC VIDEO VISUAL MAP",
      title: "Six Decisions Before Generating Clips",
      intro: "A coherent music-video concept starts with a small set of repeatable visual decisions.",
      items: [
        { title: "Track mood", body: "Energy, tempo feel, emotional tone, contrast, and atmosphere." },
        { title: "Artist identity", body: "Styling, presence, point of view, era, and what must remain recognizable." },
        { title: "Visual motif", body: "One recurring color, prop, location, framing device, texture, or light behavior." },
        { title: "Performance or narrative", body: "Decide whether the clip is driven by the performer, a story beat, or visual rhythm." },
        { title: "Motion grammar", body: "Still, handheld, push-in, orbit, slow movement, fast cuts, or another intentional language." },
        { title: "Sequence logic", body: "Define what changes from opening image to closing image so clips cut together coherently." }
      ]
    },
    steps: {
      eyebrow: "HOW IT WORKS",
      title: "Start With the Visual Brief, Then Review the Draft",
      items: [
        { title: "Define the visual brief", body: "Set the artist, mood, scene job, and one image viewers should remember." },
        { title: "Choose the starting asset", body: "Use Text to Video for a written concept or Image to Video when an approved artist reference should anchor motion." },
        { title: "Generate short clips", body: "Review subject identity, hands, text-like marks, locations, props, lighting, and motion continuity." },
        { title: "Select approved clips", body: "Use audio only through a rights-cleared workflow where the product capability is confirmed." }
      ],
      cta: "Create Music Video Visuals"
    },
    gallery: {
      eyebrow: "8 MUSIC VIDEO SCENE DIRECTIONS",
      title: "Build the Next Shot Around a Clear Visual Job",
      intro: "These are photographic scene references, not claims that every image is a one-click preset or a real myDreamshoots output.",
      items: [
        { title: "Live performance frame", body: "Performer on a lit stage with silhouette, eyeline, and audience-facing energy.", image: image(`${musicVideoImageRoot}/music-video-live-performance-stage.jpg`, "Female singer performing live into a handheld microphone on an indoor stage, framed as a music-video live performance reference.", 6000, 4000) },
        { title: "Self-shot performance", body: "Phone and ring-light setup for intimate artist intros, rehearsal fragments, or vertical cutdowns.", image: image(`${musicVideoImageRoot}/music-video-self-shot-performance.jpg`, "Female guitarist recording a self-shot performance with a smartphone mounted inside a ring light in a home studio.", 6000, 4000) },
        { title: "Camera and lighting setup", body: "Production-space reference for controlled framing, practical light, and visual consistency.", image: image(`${musicVideoImageRoot}/music-video-camera-lighting-setup.jpg`, "Camera operator filming a performer on a neon-lit studio set with a cinema camera, slider, and LED tube lights.", 2792, 1861) },
        { title: "Practical set design", body: "A designed corner, prop environment, or color-led set that can become a recurring motif.", image: image(`${musicVideoImageRoot}/music-video-practical-set-design.jpg`, "Minimal studio set with a single chair, spotlight, softbox, camera, and overhead light arranged for a controlled music-video scene.", 4896, 3264) },
        { title: "Artist styling", body: "Wardrobe, silhouette, accessories, grooming, and body language as part of the visual system.", image: image(`${musicVideoImageRoot}/music-video-artist-styling.jpg`, "Performer seated backstage while a stylist adjusts her hair, used as an artist styling and pre-performance preparation reference.", 4633, 3089) },
        { title: "Duo or group frame", body: "Interaction, conversation, call-and-response, or group performance blocking.", image: image(`${musicVideoImageRoot}/music-video-duo-performance-frame.jpg`, "Two male vocalists performing together with handheld microphones on stage, used as a duo performance and blocking reference.", 6000, 4000) },
        { title: "Close performance frame", body: "Direct-to-camera intensity, lyric delivery, facial expression, and tight crop.", image: image(`${musicVideoImageRoot}/music-video-close-performance-frame.jpg`, "Close-up of a male singer at a microphone under green stage lighting, used as a tight performance framing reference.", 2000, 3008) },
        { title: "Artist intro stage", body: "A wider opening or reveal frame that establishes person, place, scale, or era.", image: image(`${musicVideoImageRoot}/music-video-artist-intro-stage.jpg`, "Back view of a singer at a microphone facing a bright spotlight on a dark stage, used as an artist entrance or reveal reference.", 6240, 4160) }
      ]
    },
    guidance: {
      eyebrow: "SEQUENCE GUIDE",
      title: "Make the Music Video Feel Intentional Across Clips",
      intro: "Use the same visual system from the first hook through the final cut.",
      cards: [
        { title: "Build a visual hook", body: "Choose one memorable opening rule: unusual crop, repeated movement, color contrast, silhouette, light cue, or prop." },
        { title: "Keep the artist recognizable", body: "Review face, hair, wardrobe, body proportions, tattoos, jewelry, instruments, and recurring details across clips." },
        { title: "Make one motif recur", body: "Repeat a color, reflection, doorway, spotlight, hand gesture, wardrobe accent, location texture, or camera move." },
        { title: "Separate clip generation from audio rights", body: "Visual generation does not automatically grant music rights. Use a track only when rights and workflow support are confirmed." },
        { title: "Review continuity before editing", body: "Check screen direction, wardrobe, props, time of day, location details, text, instrument shape, and motion direction." },
        { title: "Design for the final channel", body: "A full video, vertical teaser, visualizer, album announcement, and social cutdown need different framing and pacing." }
      ]
    },
    foundation: {
      eyebrow: "AUDIO / PRODUCT BOUNDARY",
      title: "Keep Visual Generation Separate From Unverified Audio Features",
      intro: "The public video directory supports verified video creation paths. This page must stay precise about what happens in the product and what belongs in a separate rights-cleared edit.",
      leftTitle: "Keep in the brief",
      leftItems: ["Artist identity and approved references", "Mood, visual motif, setting, framing, and motion", "Text to Video or Image to Video starting point", "Rights-cleared people, images, marks, and audio"],
      rightTitle: "Do not claim without proof",
      rightItems: ["Automatic song upload or beat sync", "Lyric extraction, stem separation, or beat detection", "Voice cloning, lip sync, or audio mastering", "Automatic music licensing or publishing"],
      rightTone: "avoid",
      expertLabel: "Expert tip",
      expertTip: "Write the visual system first. Treat audio synchronization as a separate production step unless the live workspace explicitly documents that control."
    },
    evidence: {
      eyebrow: "FIRST-PARTY PRODUCT EVIDENCE",
      title: "Evidence Is Required Before This Page Proves the Workflow",
      intro: "The eight editorial photos explain music-video directions. They do not prove a generated result, customer outcome, or product capability.",
      cards: [
        { title: "Text to Video input", body: "Add a verified current Text to Video input state before treating it as product proof." },
        { title: "Image to Video input", body: "Add a verified Image to Video input state that reflects the current workflow." },
        { title: "Credit confirmation", body: "Use the real credit-confirmation state shown before generation, not a recreated UI." },
        { title: "Generation state", body: "Show a real current generation state when first-party evidence is available." },
        { title: "Reviewed output", body: "Use a real reviewed music-video-style output before presenting a result as product evidence." }
      ]
    },
    value: {
      eyebrow: "START THIS VIDEO WORKFLOW",
      title: "Turn an Approved Music Brief Into a Reviewable Visual Draft",
      intro: "The live workspace is the source of truth for supported inputs, credits, and output controls.",
      items: [
        { title: "Choose the starting asset", body: "Use Text to Video for a written visual idea or Image to Video when an approved still should anchor motion." },
        { title: "Define the visual system", body: "Write the artist identity, motif, scene job, mood, framing, motion, and non-negotiable details." },
        { title: "Create in the signed-in workflow", body: "Review the live credit requirement shown by the product before starting the request." },
        { title: "Review before editing", body: "Inspect identity, lighting, text-like marks, hands, props, instruments, background artifacts, motion, and continuity." }
      ]
    },
    trust: {
      eyebrow: "MUSIC VIDEO REVIEW",
      title: "Keep the Visual Story Expressive and Rights-Cleared",
      intro: "Before publishing:",
      items: [
        { title: "Use approved assets", body: "Only use artist images, people, locations, music, and third-party material you control or have permission to use." },
        { title: "Keep identity accurate", body: "Review faces, hair, wardrobe, instruments, tattoos, jewelry, and other recognizable details." },
        { title: "Check text and marks", body: "Review every logo, lyric-like mark, title card, cover-art detail, and third-party mark." },
        { title: "Verify audio rights", body: "Do not upload, publish, or synchronize a track without the required rights and a supported workflow." },
        { title: "Review continuity", body: "Check screen direction, props, lighting, location, motion direction, and sequence logic." },
        { title: "Match the destination", body: "Make the crop, pacing, closing invitation, and disclosure fit the final channel." }
      ]
    },
    comparison: {
      eyebrow: "RELATED PAGES",
      title: "Choose the Primary Video Job",
      intro: "Music Video owns artist- and track-led visual storytelling. Use a neighboring page when identity, promotion, paid media, or fashion is the primary intent.",
      items: [
        { title: "AI Video Generation", body: "Browse all current MyDreamShoots video themes.", href: "/ai-video-generation", linkLabel: "Browse AI Video Generation" },
        { title: "Brand Video", body: "Use for company or artist-brand identity, origin, values, and recognition.", href: "/ai-video-generation/brand-video", linkLabel: "Explore Brand Video" },
        { title: "Promo Video", body: "Use for a release announcement, event, launch date, offer, or verified promotion.", href: "/ai-video-generation/promo-video", linkLabel: "Explore Promo Video" },
        { title: "Fashion Video", body: "Choose Fashion Video when wardrobe, styling, collection, or garment motion is the main focus.", href: "/ai-video-generation/fashion-video", linkLabel: "Explore Fashion Video" }
      ]
    },
    faq: {
      eyebrow: "FAQ",
      title: "Music Video Questions",
      items: [
        { question: "What is an AI music video generator?", answer: "An AI music video generator helps create motion visuals for an artist, song, performance, or music campaign. Here the useful job is visual generation and planning: define artist identity, mood, motif, scene type, and motion, then generate and review clips from text or approved images." },
        { question: "Can I create music-video visuals from a photo?", answer: "myDreamshoots publicly lists Image to Video as an AI Video Generation path. Use an approved image when the performer, styling, cover-art mood, or location should anchor motion, then review identity and continuity." },
        { question: "Can I create music-video visuals from text?", answer: "myDreamshoots also publicly lists Text to Video. Describe the subject, setting, motif, lighting, framing, motion, and role of the shot instead of relying only on words such as cinematic or music video." },
        { question: "Does myDreamshoots automatically sync video to my song?", answer: "Do not promise automatic music upload or beat synchronization unless that feature is confirmed in the live product. Audio synchronization should be described only when the actual product path supports it." },
        { question: "What should I review before using AI-generated clips?", answer: "Check artist identity, hands, instruments, clothing, text, logos, background details, motion continuity, and rights to every source image, person, brand element, and audio track used in the final edit." },
        { question: "How is this different from Brand Video?", answer: "Music Video owns artist, performance, and track-led visual storytelling. Brand Video owns company or artist-brand identity, origin, values, culture, and recognition." }
      ]
    },
    finalCta: { eyebrow: "CREATE WITH A VERIFIED MUSIC BRIEF", title: "Turn an Artist Idea Into Motion", body: "Choose the visual hook, make the motif specific, keep audio rights clear, and review the finished draft before editing or publishing.", cta: "Create Music Video Visuals", microcopy: "Approved references. Clear visual language. Rights-cleared final edit." }
  },
  "fashion-video": {
    seo: {
      title: "AI Fashion Video Generator for Editorial & Lookbook Visuals | myDreamshoots",
      description: "Create AI fashion-video visuals from text or approved images for editorials, lookbooks, runway concepts, styling, garment details, and campaign sequences. Define the look, generate clips, review garment and model continuity, and publish only with cleared source rights.",
      keywords: "ai fashion video generator, AI fashion video maker, fashion editorial video generator, lookbook video maker, runway video concept, styling video generator, garment detail video",
      canonicalPath: "/ai-video-generation/fashion-video"
    },
    hero: {
      eyebrow: "AI FASHION VIDEO GENERATOR",
      title: "AI Fashion Video Generator for Editorial, Lookbook & Runway Concepts",
      body: "Turn a collection idea, outfit reference, approved model image, styling direction, or visual mood into short fashion-motion concepts. Use myDreamshoots Text to Video or Image to Video to explore editorial movement, runway-style framing, lookbook shots, garment details, street-style moments, and campaign transitions—without claiming virtual try-on, exact garment transfer, or fabric-physics accuracy unless those capabilities are verified.",
      primaryCta: "Create Fashion Video Visuals",
      secondaryCta: "Explore AI Video Generation",
      availabilityNote: "Use the current myDreamshoots video workspace to confirm supported inputs, credit requirements, and output controls before generation.",
      rightsCopy: "Use approved model, garment, brand, and location references. Review wardrobe continuity, details, logos, body/garment boundaries, and rights before publishing.",
      imageNote: "Hero garment -> Styling -> Material -> Movement -> Continuity",
      highlights: ["Editorial Motion", "Lookbook Visuals", "Runway Concepts", "Styling & Detail", "Text to Video", "Image to Video"],
      image: image(`${fashionVideoImageRoot}/hero-fashion-video-editorial-frame.jpg`, "Fashion model in a textured neutral outfit posing against vertical rolls of vivid color, used as the dedicated hero editorial frame.", 1067, 1600, "50% 38%"),
      images: [
        image(`${fashionVideoImageRoot}/hero-fashion-video-editorial-frame.jpg`, "Fashion model in a textured neutral outfit posing against vertical rolls of vivid color, used as the dedicated hero editorial frame.", 1067, 1600, "50% 38%"),
        image(`${fashionVideoImageRoot}/hero-fashion-video-detail-frame.jpg`, "Close fashion detail of a model wearing a sheer white veil over black clothing with ornate gold jewelry, used as the dedicated hero styling-detail frame.", 1067, 1600, "50% 42%"),
        image(`${fashionVideoImageRoot}/hero-fashion-video-runway-frame.jpg`, "Model in a sparkling black dress walking toward the camera on an indoor fashion runway, used as the dedicated hero runway-motion frame.", 1067, 1600, "50% 45%")
      ]
    },
    quickAnswer: {
      eyebrow: "WHAT THIS CREATES",
      title: "Make Clothing, Styling, and Silhouette Read Clearly in Motion",
      intro: "Fashion Video is for garment-, styling-, and collection-led visual development, not for unverified virtual try-on or fit simulation claims.",
      cards: [
        { title: "Editorial-led", body: "Art direction, pose, styling, composition, color, and visual attitude." },
        { title: "Garment-led", body: "Silhouette, fit, fabric, layers, accessories, construction details, and angle changes." },
        { title: "Movement-led", body: "Runway walk, turn, coat swing, fabric motion, street-style stride, or a garment-revealing camera move." },
        { title: "Best for", body: "Editorials, lookbooks, runway concepts, collection stories, accessory close-ups, street-style clips, and pre-shoot direction." }
      ]
    },
    useCases: { eyebrow: "FASHION VIDEO JOBS", title: "Choose the Garment Job Before the Style", intro: "Use the dedicated fashion map, gallery, and workflow below to define a look-led concept.", items: [] },
    platformExamples: {
      eyebrow: "FASHION VISUAL SYSTEM",
      title: "Six Decisions Before Generating Clips",
      intro: "A fashion sequence becomes useful when the wardrobe has a visual priority and continuity rule.",
      items: [
        { title: "Hero garment", body: "Decide what piece or full look must remain visually dominant." },
        { title: "Silhouette and fit", body: "Define length, volume, proportion, layering, and what must not drift." },
        { title: "Styling stack", body: "Set hair, makeup, shoes, jewelry, bag, eyewear, and supporting details." },
        { title: "Material behavior", body: "Identify pleats, fringe, sheer layers, structured fabrics, seams, or textures needing review." },
        { title: "Movement choice", body: "Select walk, turn, pause, pose change, fabric lift, seated motion, or camera move based on the garment." },
        { title: "Scene continuity", body: "Keep model identity, outfit details, accessories, lighting, and location logic consistent." }
      ]
    },
    steps: {
      eyebrow: "HOW IT WORKS",
      title: "Start With the Fashion Brief, Then Review the Draft",
      items: [
        { title: "Define the fashion brief", body: "Set the collection or look, garment priority, styling, scene job, and intended channel." },
        { title: "Choose the starting asset", body: "Use Text to Video for a written concept or Image to Video when an approved look, model, garment, or location image anchors motion." },
        { title: "Generate short clips", body: "Review body/garment boundaries, hands, seams, fasteners, jewelry, logos, texture, lighting, and movement." },
        { title: "Select approved clips", body: "Choose clips only after continuity and source-rights review; do not present unverified try-on behavior as capability." }
      ],
      cta: "Create Fashion Video Visuals"
    },
    gallery: {
      eyebrow: "8 FASHION VIDEO SCENE DIRECTIONS",
      title: "Build the Next Shot Around the Garment",
      intro: "These are photographic scene references, not claims that every image is a one-click preset or a real myDreamshoots output.",
      items: [
        { title: "Runway walk frame", body: "Full-body motion with silhouette, stride, hemline, footwear, and audience-facing presentation.", image: image(`${fashionVideoImageRoot}/fashion-video-runway-walk.jpg`, "Fashion model in a white outfit and sunglasses walking on a dark indoor runway, used as a full-body runway movement reference.", 1067, 1600) },
        { title: "Studio lookbook frame", body: "Controlled lighting and clean background for outfit shape, styling, and pose.", image: image(`${fashionVideoImageRoot}/fashion-video-studio-lookbook.jpg`, "Fashion model in a black corset and skirt posing between professional studio lights, used as a controlled lookbook and styling reference.", 1067, 1600) },
        { title: "Garment fitting frame", body: "Pre-shoot adjustment and proportion review that makes construction part of the brief.", image: image(`${fashionVideoImageRoot}/fashion-video-garment-fitting.jpg`, "Fashion designer measuring a model's shoulder in a clothing studio, used as a garment fitting and proportion-review reference.", 1067, 1600) },
        { title: "Fabric detail frame", body: "Tight texture, seam, pleat, weave, or drape reference where material behavior matters.", image: image(`${fashionVideoImageRoot}/fashion-video-fabric-detail.jpg`, "Close view of a white linen dress showing seam, weave, and fabric texture, used as a material-detail reference.", 1068, 1600) },
        { title: "Accessory detail frame", body: "Jewelry, earrings, necklace, bag, eyewear, shoes, or another styling anchor in close framing.", image: image(`${fashionVideoImageRoot}/fashion-video-accessory-detail.jpg`, "Close-up fashion portrait of a model wearing layered necklaces, earrings, and a nose ring, used as an accessory styling reference.", 1200, 1600) },
        { title: "Duo fashion frame", body: "Two models or looks designed for contrast, collection rhythm, or coordinated styling.", image: image(`${fashionVideoImageRoot}/fashion-video-duo-frame.jpg`, "Two fashion models posed together in a modern studio with contrasting black and metallic looks, used as a duo styling reference.", 1600, 1067) },
        { title: "Street-style walk", body: "Wardrobe-led movement in a real urban environment with natural pace and location context.", image: image(`${fashionVideoImageRoot}/fashion-video-street-style.jpg`, "Fashionable woman in jeans and heels walking through a sunlit city street, used as an urban street-style movement reference.", 1201, 1600) },
        { title: "Campaign production frame", body: "Model, camera, lighting, and set working together as a controlled fashion-shoot reference.", image: image(`${fashionVideoImageRoot}/fashion-video-campaign-production.jpg`, "Model in a white dress photographed by a camera operator between large studio lights, used as a fashion campaign production reference.", 1067, 1600) }
      ]
    },
    guidance: {
      eyebrow: "FASHION SEQUENCE GUIDE",
      title: "Protect Wardrobe Continuity From the First Frame to the Final Cut",
      intro: "Use garment-specific checks instead of generic claims about fashion automation.",
      cards: [
        { title: "Start with the garment job", body: "Decide whether viewers should notice silhouette, print, texture, accessory, tailoring, movement, or the full look first." },
        { title: "Protect wardrobe continuity", body: "Review neckline, sleeves, hems, closures, pockets, straps, shoes, jewelry, bags, eyewear, prints, and layers." },
        { title: "Match motion to material", body: "A structured jacket, pleated skirt, sheer layer, long coat, fringe, or fitted dress should not all move the same way." },
        { title: "Do not overclaim virtual try-on", body: "Image-to-video motion is not verified virtual try-on, garment transfer, size prediction, or fit simulation." },
        { title: "Review people, details, and marks", body: "Check hands, fingers, body/garment edges, tattoos, jewelry, text, logos, zippers, buttons, seams, and backgrounds." },
        { title: "Design for the final format", body: "Runway recap, lookbook, campaign teaser, vertical social clip, PDP support, and editorial film need different crops and pacing." }
      ]
    },
    foundation: {
      eyebrow: "FASHION / PRODUCT BOUNDARY",
      title: "Keep Fashion Direction Precise Without Claiming a Virtual Try-On Product",
      intro: "The public video directory supports verified video creation paths. This page must stay precise about what is generated and what still requires product confirmation.",
      leftTitle: "Keep in the brief",
      leftItems: ["Hero garment, silhouette, styling, material, and movement", "Approved model, garment, moodboard, or location image", "Text to Video or Image to Video starting point", "Continuity and rights review before publishing"],
      rightTitle: "Do not claim without proof",
      rightItems: ["Virtual try-on or automatic garment swap", "Exact fabric physics, size, or fit prediction", "SKU ingestion or catalog publishing automation", "Perfect logo preservation or background removal"],
      rightTone: "avoid",
      expertLabel: "Expert tip",
      expertTip: "Choose movement that reveals the garment. Review the result for construction and identity instead of treating a fashion reference image as proof of a dedicated apparel-control feature."
    },
    evidence: {
      eyebrow: "FIRST-PARTY PRODUCT EVIDENCE",
      title: "Evidence Is Required Before This Page Proves the Workflow",
      intro: "The eight editorial photos explain fashion-video directions. They do not prove a generated result, customer outcome, or product capability.",
      cards: [
        { title: "Text to Video input", body: "Add a verified current Text to Video input state before treating it as product proof." },
        { title: "Image to Video input", body: "Add a verified Image to Video input state that reflects the current workflow." },
        { title: "Credit confirmation", body: "Use the real credit-confirmation state shown before generation, not a recreated UI." },
        { title: "Generation state", body: "Show a real current generation state when first-party evidence is available." },
        { title: "Reviewed output", body: "Use a real reviewed fashion-video-style output before presenting a result as product evidence." }
      ]
    },
    value: {
      eyebrow: "START THIS VIDEO WORKFLOW",
      title: "Turn an Approved Fashion Brief Into a Reviewable Visual Draft",
      intro: "The live workspace is the source of truth for supported inputs, credits, and output controls.",
      items: [
        { title: "Choose the starting asset", body: "Use Text to Video for a written editorial idea or Image to Video when an approved model, garment, look, or location anchors motion." },
        { title: "Define the fashion system", body: "Write the hero garment, silhouette, styling stack, material cues, movement, scene role, framing, and non-negotiable details." },
        { title: "Create in the signed-in workflow", body: "Review the live credit requirement shown by the product before starting the request." },
        { title: "Review and select clips", body: "Inspect model identity, garment shape, construction, accessories, text/logos, lighting, movement, and continuity." }
      ]
    },
    trust: {
      eyebrow: "FASHION INTEGRITY REVIEW",
      title: "Keep the Fashion Story Expressive and Verifiable",
      intro: "Before publishing:",
      items: [
        { title: "Use approved assets", body: "Only use model, garment, location, brand, and third-party material you control or have permission to use." },
        { title: "Review model identity", body: "Check face, body/garment boundaries, hands, hair, tattoos, jewelry, shoes, and accessories." },
        { title: "Check construction details", body: "Inspect neckline, sleeves, hems, closures, pockets, straps, seams, prints, labels, and logos." },
        { title: "Do not imply fit proof", body: "A generated fashion clip should not imply verified sizing, fit, try-on, or fabric performance without evidence." },
        { title: "Match the final destination", body: "Make crop, pacing, detail coverage, disclosure, and CTA fit the channel and intended use." },
        { title: "Review source rights", body: "Confirm permission for every person, garment, brand element, location, image, and music track used." }
      ]
    },
    comparison: {
      eyebrow: "RELATED PAGES",
      title: "Choose the Primary Video Job",
      intro: "Fashion Video owns garment-, styling-, collection-, and editorial-led motion. Use a neighboring page when the primary intent is artist identity, brand story, promotion, or paid media.",
      items: [
        { title: "AI Video Generation", body: "Browse all current MyDreamShoots video themes.", href: "/ai-video-generation", linkLabel: "Browse AI Video Generation" },
        { title: "Music Video", body: "Use for artist, performance, track-led, and visualizer concepts.", href: "/ai-video-generation/music-video", linkLabel: "Explore Music Video" },
        { title: "Brand Video", body: "Use for company or brand identity, founder story, values, and recognition.", href: "/ai-video-generation/brand-video", linkLabel: "Explore Brand Video" },
        { title: "Promo Video", body: "Use for a launch, drop, event, release date, offer, or verified promotion.", href: "/ai-video-generation/promo-video", linkLabel: "Explore Promo Video" }
      ]
    },
    faq: {
      eyebrow: "FAQ",
      title: "Fashion Video Questions",
      items: [
        { question: "What is an AI fashion video generator?", answer: "An AI fashion video generator helps create motion visuals around clothing, styling, models, collections, and fashion campaigns. Here the useful job is visual generation and planning: define garment priority, styling, movement, scene type, and continuity rules, then generate and review clips from text or approved images." },
        { question: "Can I create fashion-video visuals from a photo?", answer: "myDreamshoots publicly lists Image to Video as an AI Video Generation path. Use an approved image when a model, garment, full look, styling direction, or location should anchor motion, then review garment and identity continuity." },
        { question: "Can I create fashion-video visuals from text?", answer: "myDreamshoots also publicly lists Text to Video. Describe the garment or look, model, setting, styling, lighting, framing, movement, and role of the shot instead of relying only on words such as luxury or editorial." },
        { question: "Is this the same as virtual try-on?", answer: "No claim should be made that this page provides virtual try-on, garment transfer, size prediction, or fit simulation unless those capabilities are verified in the live product. The safe public claim is fashion-oriented visual generation through verified Text to Video and Image to Video paths." },
        { question: "What should I review before using AI-generated fashion clips?", answer: "Check model identity, body/garment edges, sleeves, hems, seams, fasteners, prints, logos, jewelry, shoes, bags, hands, texture, movement continuity, and rights to every source image, person, brand element, and garment design." },
        { question: "How is this different from Music Video?", answer: "Fashion Video owns garment-, styling-, collection-, and editorial-led motion. Music Video owns artist- and track-led performance and visual storytelling." }
      ]
    },
    finalCta: { eyebrow: "CREATE WITH A VERIFIED FASHION BRIEF", title: "Turn a Collection Idea Into Motion", body: "Choose the garment priority, make the styling specific, match motion to material, and review the finished draft before publishing.", cta: "Create Fashion Video Visuals", microcopy: "Approved references. Clear wardrobe priorities. Reviewed final cut." }
  },
  "food-video": {
    seo: {
      title: "AI Food Video Generator for Cooking & Culinary Visuals | myDreamshoots",
      description: "Create AI food-video visuals from text or approved images for cooking, plating, ingredient prep, restaurant scenes, beverage pours, and culinary social clips.",
      keywords: "ai food video generator, AI food video maker, cooking video generator, plating video maker, culinary video generator, food styling video, restaurant video concept",
      canonicalPath: "/ai-video-generation/food-video"
    },
    hero: {
      eyebrow: "AI FOOD VIDEO GENERATOR",
      title: "AI Food Video Generator for Cooking, Plating & Culinary Content",
      body: "Turn a dish idea, approved food image, recipe mood, restaurant concept, or culinary visual reference into short food-motion concepts. Use myDreamshoots Text to Video or Image to Video to explore ingredient preparation, cooking actions, plating details, food styling, restaurant service, beverage pours, and social-first culinary shots—without claiming recipe accuracy, food-safety verification, nutritional analysis, or exact ingredient recognition unless those capabilities are verified.",
      primaryCta: "Create Food Video Visuals",
      secondaryCta: "Explore AI Video Generation",
      availabilityNote: "Use the current myDreamshoots video workspace to confirm supported inputs, credit requirements, and output controls before generation.",
      rightsCopy: "Use approved food, packaging, restaurant, chef, location, and third-party references. Review ingredients, labels, hands, props, continuity, and rights before publishing.",
      imageNote: "Hero food -> Action -> Texture -> Camera -> Set -> Continuity",
      highlights: ["Cooking Action", "Plating & Styling", "Ingredient Prep", "Restaurant Scenes", "Text to Video", "Image to Video"],
      image: image(`${foodVideoImageRoot}/hero-food-video-creator-frame.jpg`, "Food creator standing behind a smartphone on a gimbal while recording herself in a bright home kitchen, used as the dedicated hero creator frame.", 6521, 4347, "50% 42%"),
      images: [
        image(`${foodVideoImageRoot}/hero-food-video-creator-frame.jpg`, "Food creator standing behind a smartphone on a gimbal while recording herself in a bright home kitchen, used as the dedicated hero creator frame.", 6521, 4347, "50% 42%"),
        image(`${foodVideoImageRoot}/hero-food-video-plating-frame.jpg`, "Chef's hand spooning a vivid red sauce onto a carefully plated gourmet dish in a professional kitchen, used as the dedicated hero plating-detail frame.", 4016, 6016, "50% 48%"),
        image(`${foodVideoImageRoot}/hero-food-video-sizzle-frame.jpg`, "Close-up of seasoned chicken and vegetables cooking in a black pan over a visible gas flame, used as the dedicated hero cooking-action frame.", 3648, 5472, "50% 48%")
      ]
    },
    quickAnswer: {
      eyebrow: "WHAT THIS CREATES",
      title: "Make Food, Preparation, and Presentation Read Clearly in Motion",
      intro: "Food Video is for food-, cooking-, and presentation-led visual development, not for unverified recipe, nutrition, allergen, doneness, or food-safety claims.",
      cards: [
        { title: "Process-led", body: "Chopping, mixing, pouring, searing, stirring, garnishing, plating, and other visible food actions." },
        { title: "Dish-led", body: "Hero dish, texture, color, layers, garnish, steam, sauce, table styling, and close detail." },
        { title: "Service-led", body: "Restaurant pass, table service, cafe moments, beverage preparation, hospitality context, and final presentation." },
        { title: "Best for", body: "Cooking-action clips, recipe-supporting B-roll, menu mood visuals, culinary social content, and pre-shoot direction." }
      ]
    },
    useCases: { eyebrow: "FOOD VIDEO JOBS", title: "Give Every Culinary Shot One Clear Job", intro: "Use the food visual system, scene board, and sequence guide below to shape a useful brief.", items: [] },
    platformExamples: {
      eyebrow: "FOOD VISUAL SYSTEM",
      title: "Six Decisions Before Generating Clips",
      intro: "A food sequence becomes useful when the hero dish, visible action, and continuity rules are clear before generation.",
      items: [
        { title: "Hero food", body: "Decide which dish, ingredient, beverage, or preparation stage must remain visually dominant." },
        { title: "Action beat", body: "Define one visible motion: chop, stir, sear, pour, garnish, plate, serve, or steam." },
        { title: "Texture and state", body: "Describe crisp, glossy, creamy, layered, bubbling, chilled, fresh, roasted, or another appearance cue." },
        { title: "Camera appetite", body: "Choose macro, overhead, three-quarter, table-level, hand-action, push-in, or another useful angle." },
        { title: "Set and props", body: "Specify plate, pan, board, utensils, glassware, napkin, surface, background, and practical light." },
        { title: "Continuity and claims", body: "Keep dish identity, ingredients, portions, props, hands, lighting, and action direction consistent; separate visuals from verified food claims." }
      ]
    },
    steps: {
      eyebrow: "HOW IT WORKS",
      title: "Start With the Food Brief, Then Review the Draft",
      items: [
        { title: "Define the food brief", body: "Set the hero dish or ingredient, visible action, texture/state, setting, scene job, and intended channel." },
        { title: "Choose the starting asset", body: "Use Text to Video for a written culinary concept or Image to Video when an approved dish, ingredient setup, table, packaging, or location image anchors motion." },
        { title: "Generate short clips", body: "Review food shape, ingredients, hands, utensils, steam/smoke, liquids, plates, labels, logos, text-like marks, and motion continuity." },
        { title: "Select approved clips", body: "Choose clips only after visual-continuity and source-rights review. Keep recipe accuracy, allergens, nutrition, doneness, and food-safety claims separately verified." }
      ],
      cta: "Create Food Video Visuals"
    },
    gallery: {
      eyebrow: "8 FOOD VIDEO SCENE DIRECTIONS",
      title: "Build the Next Shot Around the Food",
      intro: "These are photographic scene references, not claims that every image is a one-click preset or a real myDreamshoots output.",
      items: [
        { title: "Ingredient prep frame", body: "Chopping and mise en place with clear hands, knife, board, produce, and ingredient placement.", image: image(`${foodVideoImageRoot}/food-video-ingredient-prep.jpg`, "Chef chopping carrots on a wooden cutting board surrounded by fresh ingredients, used as an ingredient-preparation and hand-action reference.", 6048, 4024) },
        { title: "Camera setup frame", body: "Camera, kitchen, cookware, presenter, and ingredients arranged for a repeatable food-video shoot.", image: image(`${foodVideoImageRoot}/food-video-camera-setup.jpg`, "Tripod-mounted camera filming cooks at a kitchen counter with ingredients and cookware in view, used as a food-video production setup reference.", 6240, 4160) },
        { title: "Sauce pour frame", body: "A controlled liquid action where stream shape, plate position, garnish, and food texture matter.", image: image(`${foodVideoImageRoot}/food-video-sauce-pour.jpg`, "Hand pouring a dark sauce over a plated dish with greens and colorful garnish against a black background, used as a sauce-pour action reference.", 2666, 4000) },
        { title: "Food styling frame", body: "A hero dish composed for appetite, color balance, layers, garnish, and close visual inspection.", image: image(`${foodVideoImageRoot}/food-video-food-styling.jpg`, "Close-up of a carefully styled plated dish with layered vegetables, grains, sauce, and fresh greens, used as a food-styling hero-dish reference.", 2240, 2887) },
        { title: "Overhead ingredients frame", body: "Top-down layout that establishes ingredients, tools, color, and prep order without relying on text.", image: image(`${foodVideoImageRoot}/food-video-overhead-ingredients.jpg`, "Top view of tomatoes, cucumbers, chilies, spring onions, a knife, and a cutting board arranged for cooking, used as an overhead ingredient-layout reference.", 2268, 4032) },
        { title: "Plating action frame", body: "Professional finishing touches where hand position, utensil, portion, garnish, and plate continuity matter.", image: image(`${foodVideoImageRoot}/food-video-plating-action.jpg`, "Chef working under pass lights while placing finishing touches on a plated dish, used as a professional plating-action reference.", 4000, 6000) },
        { title: "Restaurant service frame", body: "The handoff from kitchen to table, with dish, glassware, table setting, and hospitality context.", image: image(`${foodVideoImageRoot}/food-video-restaurant-service.jpg`, "Waiter placing a plated fried-chicken dish on a restaurant table beside glassware and other courses, used as a restaurant-service reference.", 4672, 7008) },
        { title: "Beverage pour frame", body: "Coffee or another drink entering a glass, with liquid behavior, glass shape, condensation, and pairing context.", image: image(`${foodVideoImageRoot}/food-video-beverage-pour.jpg`, "Hand pouring iced coffee into a tall glass beside plated food on a warm cafe table, used as a beverage-pour and food-pairing reference.", 3448, 5172) }
      ]
    },
    guidance: {
      eyebrow: "FOOD SEQUENCE GUIDE",
      title: "Protect Food Continuity From the First Frame to the Final Cut",
      intro: "Use food-specific checks instead of generic claims about recipe or culinary automation.",
      cards: [
        { title: "Give every shot one food job", body: "Decide whether the shot reveals an ingredient, shows a transformation, creates texture appetite, establishes the dish, demonstrates serving, or connects two edit beats." },
        { title: "Protect ingredient and dish continuity", body: "Review ingredient count, cut size, garnish, sauce level, plate shape, utensil position, portion size, crumbs, table props, and apparent food stage." },
        { title: "Make texture and motion believable", body: "Liquids, steam, bubbling, crumbs, melted surfaces, knife cuts, pan movement, and garnish should remain consistent enough for the intended visual." },
        { title: "Separate visuals from recipe and safety claims", body: "A convincing food shot does not prove a recipe is correct, an ingredient is present or absent, a dish is safely cooked, or nutrition and allergen information is accurate." },
        { title: "Review hands, utensils, labels, and brands", body: "Check fingers, knife edges, tongs, spoons, plates, glass rims, packaging, printed labels, restaurant marks, logos, and text-like artifacts." },
        { title: "Design for the final format", body: "Restaurant reel, recipe B-roll, menu teaser, cafe social clip, food-brand mood film, vertical short, and longer culinary sequence need different crops and pacing." }
      ]
    },
    foundation: {
      eyebrow: "FOOD / PRODUCT BOUNDARY",
      title: "Keep Food Direction Appetizing Without Claiming a Recipe or Safety Product",
      intro: "The public video directory supports verified video creation paths. This page must stay precise about what is generated and what still requires qualified verification.",
      leftTitle: "Keep in the brief",
      leftItems: ["Hero food, visible action, texture/state, camera, set, props, and lighting", "Approved dish, ingredient, restaurant, packaging, table, or culinary reference image", "Text to Video or Image to Video starting point", "Continuity, source-rights, and final-channel review before publishing"],
      rightTitle: "Do not claim without proof",
      rightItems: ["Recipe generation or recipe correctness", "Ingredient recognition, allergen detection, or nutrition analysis", "Cooking-temperature, doneness, or food-safety verification", "Menu ingestion, restaurant publishing automation, or perfect label preservation"],
      rightTone: "avoid",
      expertLabel: "Expert tip",
      expertTip: "Choose one food action per shot and review ingredients, portions, hands, liquids, steam, labels, and props. Treat generated food visuals as creative material, not food-safety guidance."
    },
    evidence: {
      eyebrow: "FIRST-PARTY PRODUCT EVIDENCE",
      title: "Evidence Is Required Before This Page Proves the Workflow",
      intro: "The eleven culinary photographs explain food-video directions. They do not prove a generated result, customer outcome, recipe, or product capability.",
      cards: [
        { title: "Text to Video input", body: "Add a verified current Text to Video input state before treating it as product proof." },
        { title: "Image to Video input", body: "Add a verified Image to Video input state that reflects the current workflow." },
        { title: "Credit confirmation", body: "Use the real credit-confirmation state shown before generation, not a recreated UI." },
        { title: "Generation state", body: "Show a real current generation state when first-party evidence is available." },
        { title: "Reviewed output", body: "Use a real reviewed food-video-style output before presenting a result as product evidence." }
      ]
    },
    value: {
      eyebrow: "START THIS VIDEO WORKFLOW",
      title: "Turn an Approved Food Brief Into a Reviewable Visual Draft",
      intro: "The live workspace is the source of truth for supported inputs, credits, and output controls.",
      items: [
        { title: "Choose the starting asset", body: "Use Text to Video for a written food scene or Image to Video when an approved dish, ingredient setup, restaurant table, packaging image, or culinary reference anchors motion." },
        { title: "Define the food system", body: "Write the hero food, action beat, texture/state, camera angle, set/props, lighting, scene role, and continuity details that must not drift." },
        { title: "Create in the signed-in workflow", body: "Review the live credit requirement shown by the product before starting the request." },
        { title: "Review and select clips", body: "Inspect food identity, ingredients, hands, tools, plates, liquids, steam/smoke, packaging/text, lighting, movement, and continuity." }
      ]
    },
    trust: {
      eyebrow: "FOOD INTEGRITY REVIEW",
      title: "Keep the Culinary Story Appetizing and Verifiable",
      intro: "Before publishing:",
      items: [
        { title: "Use approved assets", body: "Only use food, packaging, restaurant, chef, location, and third-party material you control or have permission to use." },
        { title: "Review food identity", body: "Check dish identity, ingredient count, cut size, portions, garnish, sauce, plate shape, and apparent preparation stage." },
        { title: "Check hands and tools", body: "Inspect fingers, knives, tongs, spoons, pans, glassware, plates, labels, logos, and text-like artifacts." },
        { title: "Do not imply safety proof", body: "A generated food clip should not imply verified recipe accuracy, nutrition, allergens, temperature, doneness, or food safety." },
        { title: "Match the final destination", body: "Make crop, pacing, action coverage, disclosure, and CTA fit the channel and intended culinary use." },
        { title: "Review source rights", body: "Confirm permission for every person, food image, brand element, restaurant, location, packaging, and protected design used." }
      ]
    },
    comparison: {
      eyebrow: "RELATED PAGES",
      title: "Choose the Primary Video Job",
      intro: "Food Video owns food-, cooking-, plating-, service-, and culinary-atmosphere-led motion. Use a neighboring page when the primary intent is instruction, product presentation, promotion, or paid media.",
      items: [
        { title: "AI Video Generation", body: "Browse all current MyDreamShoots video themes.", href: "/ai-video-generation", linkLabel: "Browse AI Video Generation" },
        { title: "Product Video", body: "Use for instruction-first product demonstrations and clear buyer questions.", href: "/ai-video-generation/product-video", linkLabel: "Explore Product Video" },
        { title: "Product Video", body: "Use when the product, packaging, use, scale, or feature explanation is primary.", href: "/ai-video-generation/product-video", linkLabel: "Explore Product Video" },
        { title: "Promo Video", body: "Use for a menu launch, event, release, offer, or verified promotion.", href: "/ai-video-generation/promo-video", linkLabel: "Explore Promo Video" }
      ]
    },
    faq: {
      eyebrow: "FAQ",
      title: "Food Video Questions",
      items: [
        { question: "What is an AI food video generator?", answer: "An AI food video generator helps create motion visuals around dishes, ingredients, cooking actions, plating, serving, beverages, and culinary content. Here the useful job is visual planning and generation: define the food, action, texture, camera angle, set, and continuity rules, then generate and review clips from text or approved images." },
        { question: "Can I create food-video visuals from a photo?", answer: "myDreamshoots publicly lists Image to Video as an AI Video Generation path. Use an approved image when a dish, ingredient arrangement, restaurant table, packaging item, or food-styling reference should anchor the motion, then review food and prop continuity before publishing." },
        { question: "Can I create food-video visuals from text?", answer: "myDreamshoots also publicly lists Text to Video. A strong prompt should describe the food or beverage, visible action, texture/state, setting, lighting, camera angle, motion, and role of the shot instead of relying only on words such as delicious or cinematic." },
        { question: "Does this generate a correct recipe or verify food safety?", answer: "Do not claim recipe accuracy, safe cooking temperature, doneness verification, allergen detection, ingredient recognition, or nutrition analysis unless those capabilities are verified in the live product and supported by appropriate evidence. Generated visuals are visual content, not food-safety guidance." },
        { question: "What should I review before using AI-generated food clips?", answer: "Check food identity, ingredient continuity, hands, knives and utensils, plates, glassware, liquid behavior, steam or smoke, packaging, text, logos, portion changes, background details, and rights to every source image, person, brand element, and protected design used in the final edit." },
        { question: "How is this different from How-to Video?", answer: "Food Video owns food-first visual storytelling, cooking action, plating, service, and culinary atmosphere. How-to Video should own instruction-first content where the primary search task is completing a procedure step by step, even when the topic happens to be cooking." }
      ]
    },
    finalCta: { eyebrow: "CREATE WITH A VERIFIED FOOD BRIEF", title: "Turn a Culinary Idea Into Motion", body: "Choose the hero food, make the action specific, protect ingredient continuity, and review the finished draft before publishing.", cta: "Create Food Video Visuals", microcopy: "Approved references. Clear food action. Reviewed final cut." }
  },
  "pet-video": {
    seo: {
      title: "AI Pet Video Generator for Pet Portraits & Animal Content | myDreamshoots",
      description: "Create AI pet-video visuals from text or approved images for pet portraits, playful moments, owner interactions, walks, grooming, training, and animal lifestyle content.",
      keywords: "ai pet video generator, AI pet video maker, pet portrait video generator, animal video generator, pet lifestyle video, dog video generator, cat video maker, pet social video creator",
      canonicalPath: "/ai-video-generation/pet-video"
    },
    hero: {
      eyebrow: "AI PET VIDEO GENERATOR",
      title: "AI Pet Video Generator for Pet Portraits & Animal Content",
      body: "Turn a pet portrait, approved owner-and-pet photo, playful moment, training idea, home routine, or animal-content brief into short motion concepts for pet-video development. Use myDreamshoots Text to Video or Image to Video to explore pet portraits, playful actions, walking scenes, owner interactions, grooming, training moments, feeding routines, and lifestyle cutaways—without presenting generated visuals as veterinary diagnosis, nutrition advice, behavior assessment, or proof of animal welfare.",
      primaryCta: "Create Pet Video Visuals",
      secondaryCta: "Explore AI Video Generation",
      availabilityNote: "Use the current myDreamshoots video workspace to confirm supported inputs, credit requirements, and output controls before generation.",
      rightsCopy: "Use approved pet, owner, shelter, brand, location, and third-party references. Review animal identity, anatomy, props, continuity, health boundaries, and rights before publishing.",
      imageNote: "Identity -> Behavior -> Interaction -> Continuity",
      highlights: ["Pet Portraits", "Owner & Pet", "Play & Lifestyle", "Training & Routine", "Text to Video", "Image to Video"],
      image: image(`${petVideoImageRoot}/hero-pet-video-portrait-frame.jpg`, "Close studio portrait of a white Jack Russell Terrier against a black background, used as the dedicated Hero pet portrait frame.", 6000, 4000, "50% 42%"),
      images: [
        image(`${petVideoImageRoot}/hero-pet-video-portrait-frame.jpg`, "Close studio portrait of a white Jack Russell Terrier against a black background, used as the dedicated Hero pet portrait frame.", 6000, 4000, "50% 42%"),
        image(`${petVideoImageRoot}/hero-pet-video-training-frame.jpg`, "Girl giving a hand signal to a Corgi on a pink studio backdrop, used as the dedicated Hero pet-training interaction frame.", 4480, 6720, "50% 36%"),
        image(`${petVideoImageRoot}/hero-pet-video-owner-frame.jpg`, "Pet owner kneeling beside a large dog in a warm studio portrait, used as the dedicated Hero owner-and-pet relationship frame.", 4081, 6121, "50% 44%")
      ]
    },
    quickAnswer: {
      eyebrow: "WHAT THIS CREATES",
      title: "Make Pet Identity, Behavior, and Relationship Read Clearly in Motion",
      intro: "Pet Video is for animal-led visual development, not for unverified veterinary, nutrition, behavior, training, welfare, or product-safety claims.",
      cards: [
        { title: "Pet-led", body: "Portraits, playful actions, walks, grooming, training context, home routines, and personality-focused animal scenes." },
        { title: "Relationship-led", body: "Owner-and-pet interactions, bonding moments, handler cues, shelter storytelling, and shared routines." },
        { title: "Routine-led", body: "Feeding, grooming, urban walking, outdoor movement, indoor play, and other recognizable lifestyle beats." },
        { title: "Best for", body: "Pet creator content, animal lifestyle clips, shelter or adoption storytelling, pre-shoot direction, and social-first visual concepts." }
      ]
    },
    useCases: { eyebrow: "PET VIDEO JOBS", title: "Give Every Pet Scene One Clear Job", intro: "Use the Pet Visual Behavior System, scene board, and sequence guide below to shape a useful brief.", items: [] },
    platformExamples: {
      eyebrow: "PET VISUAL BEHAVIOR SYSTEM",
      title: "Six Pet Decisions Before Generating Clips",
      intro: "A pet sequence becomes useful when animal identity, visible behavior, interaction, and continuity are clear before generation.",
      items: [
        { title: "Animal identity", body: "Define species, breed or type, coat, markings, age impression, body scale, face shape, ears, tail, and other identity anchors." },
        { title: "Scene job", body: "Choose whether the shot introduces personality, shows play, captures routine, supports a bond story, establishes place, or connects two edit beats." },
        { title: "Visible behavior", body: "Describe one observable action such as running, sitting, looking, playing, being groomed, eating, walking, or responding to a cue." },
        { title: "Human interaction", body: "Specify owner, handler, groomer, volunteer, or no human; define hand position, leash, touch, eyeline, distance, and consent context." },
        { title: "Environment and props", body: "Set the home, studio, park, sidewalk, salon, clinic, training field, bed, bowl, toy, brush, leash, or other practical anchors." },
        { title: "Continuity and boundaries", body: "Review paws, limbs, eyes, ears, mouths, tails, collars, leashes, hands, props, coat patterns, and separate visuals from health or welfare claims." }
      ]
    },
    steps: {
      eyebrow: "HOW IT WORKS",
      title: "Start With the Pet Brief, Then Review the Draft",
      items: [
        { title: "Define the pet brief", body: "Set the animal identity, visible behavior, human interaction, environment, props, scene job, and intended channel." },
        { title: "Choose the starting asset", body: "Use Text to Video for a written pet concept or Image to Video when an approved portrait, owner-and-pet image, shelter reference, or location anchors motion." },
        { title: "Generate short clips", body: "Review animal identity, anatomy, paws, limbs, eyes, ears, mouths, tails, collars, leashes, hands, props, lighting, and motion continuity." },
        { title: "Select approved clips", body: "Choose clips only after visual-continuity and source-rights review. Keep veterinary, nutrition, behavior, training-efficacy, welfare, and product-safety claims separately verified." }
      ],
      cta: "Create Pet Video Visuals"
    },
    gallery: {
      eyebrow: "8 PET VIDEO SCENE DIRECTIONS",
      title: "Build the Next Shot Around the Animal",
      intro: "These are photographic scene references, not claims that every image is a one-click preset or a real myDreamshoots output.",
      items: [
        { title: "Outdoor action frame", body: "Energetic movement where animal identity, gait, paws, background, and owner position need to remain coherent.", image: image(`${petVideoImageRoot}/pet-video-outdoor-run.jpg`, "Labrador Retriever running toward the camera in a sunny park with its owner behind.", 7558, 5041) },
        { title: "Grooming detail frame", body: "Close pet-care action where coat, brush, hands, body position, and salon context carry the scene.", image: image(`${petVideoImageRoot}/pet-video-grooming.jpg`, "Yorkshire Terrier being combed by a groomer at a pet salon.", 5760, 3840) },
        { title: "Veterinary-context frame", body: "A clinic or volunteer setting that can establish context without turning a visual into a diagnosis or welfare claim.", image: image(`${petVideoImageRoot}/pet-video-vet-check.jpg`, "Veterinarian and volunteer examining a dog during a clinic check-up.", 4000, 6000) },
        { title: "Indoor play frame", body: "Bright home play with toy, bed, floor, and animal personality visible in one simple action.", image: image(`${petVideoImageRoot}/pet-video-cat-play.jpg`, "Calico cat playing with a toy beside a pet bed in a bright home interior.", 5644, 4000) },
        { title: "Urban walking frame", body: "Leash-led movement where person, dog, sidewalk, direction, collar, and public setting need continuity.", image: image(`${petVideoImageRoot}/pet-video-urban-walk.jpg`, "Person walking a dog on a leash along a city sidewalk.", 4096, 2730) },
        { title: "Feeding routine frame", body: "A home routine with bowl, hand, animal position, and setting kept clear without making nutrition claims.", image: image(`${petVideoImageRoot}/pet-video-feeding.jpg`, "Woman holding a food bowl for a tabby cat in a home setting.", 6048, 4024) },
        { title: "Training interaction frame", body: "Handler-and-animal interaction where the cue, body language, space, and visible response should be described precisely.", image: image(`${petVideoImageRoot}/pet-video-training-command.jpg`, "Belgian Malinois interacting closely with a handler during outdoor training.", 4000, 6016) },
        { title: "Owner bonding frame", body: "A relationship-led portrait that establishes personality, trust, human presence, and the emotional role of the shot.", image: image(`${petVideoImageRoot}/pet-video-owner-bond.jpg`, "Woman posing with a dog in a studio setting.", 4631, 3087) }
      ]
    },
    guidance: {
      eyebrow: "PET SEQUENCE GUIDE",
      title: "Protect Animal Continuity From the First Frame to the Final Cut",
      intro: "Use pet-specific checks instead of generic claims about animal health, behavior, or care automation.",
      cards: [
        { title: "Give every shot one pet job", body: "Decide whether the shot introduces the animal, reveals personality, shows a behavior, builds a relationship moment, establishes place, or connects two edit beats." },
        { title: "Protect identity and anatomy", body: "Review coat pattern, face, eyes, ears, mouth, paws, limbs, tail, body scale, breed cues, collar, and apparent age across every cut." },
        { title: "Make behavior visible", body: "Name one observable action and its direction. Avoid vague prompts that make the animal's movement, cue, reaction, or position impossible to review." },
        { title: "Separate visuals from care claims", body: "A convincing pet shot does not prove a diagnosis, pain state, nutrition fact, behavior assessment, training result, welfare condition, or product safety outcome." },
        { title: "Review people, props, and rights", body: "Check fingers, hands, leashes, bowls, toys, brushes, collars, labels, logos, clinic details, locations, people, and permission for every source reference." },
        { title: "Design for the final format", body: "Pet portrait, owner story, shelter short, grooming reel, training context, walking clip, food routine, and longer animal sequence need different crops and pacing." }
      ]
    },
    foundation: {
      eyebrow: "PET HEALTH / WELFARE BOUNDARY",
      title: "Keep Pet Direction Specific Without Turning It Into Care Advice",
      intro: "The public video directory supports verified video creation paths. This page must stay precise about what is generated and what still requires qualified verification.",
      leftTitle: "Keep in the brief",
      leftItems: ["Animal identity, visible behavior, human interaction, environment, props, camera, and lighting", "Approved pet, owner, shelter, brand, location, or animal-content reference image", "Text to Video or Image to Video starting point", "Continuity, source-rights, animal-safety, and final-channel review before publishing"],
      rightTitle: "Do not claim without proof",
      rightItems: ["Veterinary diagnosis, pain, illness, treatment, or medication guidance", "Nutrition, feeding suitability, allergen, or ingredient claims", "Behavior assessment, training efficacy, temperament, or adoption outcomes", "Welfare compliance, product safety, or proof that an animal is healthy or cared for"],
      rightTone: "avoid",
      expertLabel: "Expert tip",
      expertTip: "Choose one visible behavior per shot and review animal identity, anatomy, hands, props, and continuity. Treat generated pet visuals as creative material, not veterinary, nutrition, training, or welfare guidance."
    },
    evidence: {
      eyebrow: "FIRST-PARTY PRODUCT EVIDENCE",
      title: "Evidence Is Required Before This Page Proves the Workflow",
      intro: "The eleven pet photographs explain pet-video directions. They do not prove a generated result, customer outcome, veterinary fact, or product capability.",
      cards: [
        { title: "Text to Video input", body: "Add a verified current Text to Video input state before treating it as product proof." },
        { title: "Image to Video input", body: "Add a verified Image to Video input state that reflects the current workflow." },
        { title: "Credit confirmation", body: "Use the live workspace to confirm credit use and any output limits before promising a production workflow." },
        { title: "Pet identity review", body: "Show a verified before-and-after review of animal identity, anatomy, props, and continuity when first-party evidence is available." },
        { title: "Rights and welfare review", body: "Document source permission and a human review boundary for animal safety, health, nutrition, behavior, training, and welfare claims." }
      ]
    },
    value: {
      eyebrow: "WHY THIS STRUCTURE HELPS",
      title: "Move From a Pet Idea to a Reviewable Motion Brief",
      intro: "A useful pet-video page turns an open-ended animal idea into decisions a creator can inspect before publishing.",
      items: [
        { title: "Clear animal identity", body: "Keep the pet's visible identity and anatomy stable enough for a coherent sequence." },
        { title: "Observable behavior", body: "Make the action, cue, interaction, and scene job specific enough to review." },
        { title: "Practical scene direction", body: "Use references for place, props, framing, lighting, and pacing without claiming they are outputs." },
        { title: "Responsible review", body: "Separate creative visuals from veterinary, nutrition, behavior, training, welfare, and safety claims." }
      ]
    },
    trust: {
      eyebrow: "INTEGRITY REVIEW",
      title: "Review the Animal, the Relationship, and the Claim",
      intro: "Pet content is more trustworthy when the visual brief and the public claim are reviewed separately.",
      items: [
        { title: "Animal identity", body: "Does the animal remain recognizable across coat, face, eyes, ears, limbs, paws, tail, scale, collar, and apparent age?" },
        { title: "Visible behavior", body: "Can a viewer see the intended action without the page implying a diagnosis, temperament, training outcome, or welfare state?" },
        { title: "Human interaction", body: "Are owner, handler, groomer, volunteer, hands, touch, leash, distance, and consent context represented accurately?" },
        { title: "Scene continuity", body: "Do location, floor, bed, bowl, toy, brush, clinic, sidewalk, light, direction, and props stay coherent?" },
        { title: "Source rights", body: "Are pet, person, shelter, brand, location, image, and third-party references approved for the intended use?" },
        { title: "Claim boundary", body: "Are veterinary, nutrition, behavior, training, welfare, adoption, and product-safety claims separately verified or removed?" }
      ]
    },
    comparison: {
      eyebrow: "RELATED PAGES",
      title: "Choose the Primary Video Job",
      intro: "Pet Video owns animal-, pet-lifestyle-, relationship-, and routine-led motion. Use a neighboring page when the primary intent is instruction, food presentation, explanation, conversation, or brand communication.",
      items: [
        { title: "AI Video Generation", body: "Browse all current myDreamshoots video themes.", href: "/ai-video-generation", linkLabel: "Browse AI Video Generation" },
        { title: "Product Video", body: "Use for instruction-first product demonstrations and clear buyer questions.", href: "/ai-video-generation/product-video", linkLabel: "Explore Product Video" },
        { title: "Food Video", body: "Use when food, preparation, plating, or culinary presentation is primary.", href: "/ai-video-generation/food-video", linkLabel: "Explore Food Video" },
        { title: "Motion Generator", body: "Use when one approved image should anchor a controlled short motion concept.", href: "/ai-video-generation/motion-generator", linkLabel: "Explore Motion Generator" }
      ]
    },
    faq: {
      eyebrow: "FAQ",
      title: "Pet Video Questions",
      items: [
        { question: "What is an AI pet video generator?", answer: "An AI pet video generator helps create motion visuals around pet portraits, animal behavior, owner interactions, walks, grooming, training context, feeding routines, and pet lifestyle content. Here the useful job is visual planning and generation: define the animal, behavior, interaction, environment, and continuity rules, then generate and review clips from text or approved images." },
        { question: "Can I create pet-video visuals from a photo?", answer: "myDreamshoots publicly lists Image to Video as an AI Video Generation path. Use an approved pet portrait, owner-and-pet image, shelter reference, or location image when it should anchor motion, then review identity, anatomy, props, and continuity before publishing." },
        { question: "Can I create pet-video visuals from text?", answer: "myDreamshoots also publicly lists Text to Video. A strong prompt should describe the animal identity, visible action, human interaction, setting, props, lighting, camera angle, motion, and role of the shot instead of relying only on words such as cute or realistic." },
        { question: "Does this diagnose a pet or evaluate its behavior?", answer: "No. Do not claim veterinary diagnosis, pain or illness assessment, nutrition or allergen analysis, behavior evaluation, training efficacy, welfare compliance, adoption outcomes, or product safety unless those capabilities are verified in the live product and supported by appropriate evidence. Generated visuals are creative content, not animal-care guidance." },
        { question: "What should I review before using AI-generated pet clips?", answer: "Check animal identity, coat and anatomy, eyes, ears, mouth, paws, limbs, tail, collars, leashes, hands, props, location, lighting, action direction, continuity, source permission, and every health, nutrition, behavior, training, welfare, or safety claim." },
        { question: "How is this different from Food Video?", answer: "Pet Video owns animal-led visual storytelling, pet routines, owner relationships, and animal lifestyle content. Food Video owns food-first visual storytelling, cooking action, plating, service, and culinary atmosphere." }
      ]
    },
    finalCta: { eyebrow: "CREATE WITH A VERIFIED PET BRIEF", title: "Turn a Pet Idea Into Motion", body: "Choose the animal identity, make the behavior visible, protect continuity, and review the finished draft before publishing.", cta: "Create Pet Video Visuals", microcopy: "Approved references. Clear visible behavior. Reviewed final cut." }
  },
  "explainer-video": {
    seo: {
      title: "AI Explainer Video Generator for Concepts & Product Explanations | myDreamshoots",
      description: "Create AI explainer-video visuals for products, processes, data, technology, education, business frameworks, and user journeys from text or approved images.",
      keywords: "ai explainer video generator, explainer video maker, AI product explainer video, process visualization video, data storytelling video, educational video generator, technology explainer video, business framework video",
      canonicalPath: "/ai-video-generation/explainer-video"
    },
    hero: {
      eyebrow: "AI EXPLAINER VIDEO GENERATOR",
      title: "AI Explainer Video Generator for Concepts, Products & Processes",
      body: "Turn a complex product idea, workflow, dataset, technical concept, educational topic, or business framework into short visual explanation concepts. Use Text to Video or Image to Video while keeping factual claims, numbers, product capabilities, and source material independently verified.",
      primaryCta: "Create Explainer Video Visuals",
      secondaryCta: "Explore AI Video Generation",
      availabilityNote: "Use the live myDreamshoots workflow to confirm available inputs, credit requirements, generation state, and supported controls before creating.",
      rightsCopy: "Use only source material you own or are authorized to use. Generated charts, labels, screens, and presenter imagery are illustrative until reviewed.",
      imageNote: "These AI-generated editorial references are dedicated to this Explainer Video page and are not presented as verified product output.",
      image: image("/assets/dreamshoot/explainer-video/hero-explainer-video-product-concept.jpg", "Generated visual of an explainer video workspace connecting a product idea, data, and visual outputs", 1600, 1000),
      images: [
        image("/assets/dreamshoot/explainer-video/hero-explainer-video-product-concept.jpg", "Generated product and concept explanation workspace", 1600, 1000),
        image("/assets/dreamshoot/explainer-video/hero-explainer-video-data-charts.jpg", "Generated analytics dashboard used as an illustrative data explanation frame", 1600, 1000),
        image("/assets/dreamshoot/explainer-video/hero-explainer-video-expert-presentation.jpg", "Generated presenter-supported explanation with a simple visual flow", 1600, 1000)
      ],
      highlights: ["Product explanation", "Data and charts", "Process visualization", "Education and technology", "Text to Video", "Image to Video"]
    },
    quickAnswer: {
      eyebrow: "WHAT THIS CREATES",
      title: "Make an idea easier to understand visually",
      intro: "Explainer Video is for showing what something is, why it matters, or how a system works. It is distinct from procedural how-to content, presenter-only talking heads, and company culture video.",
      cards: [
        { title: "System-led", body: "Products, interfaces, workflows, architecture, feature relationships, and mechanisms." },
        { title: "Evidence-led", body: "Charts, metrics, comparisons, trends, and visual proof that must be verified before publication." },
        { title: "Narration-led", body: "Expert or presenter framing supported by diagrams, screens, illustrations, or visual structure." }
      ]
    },
    useCases: {
      eyebrow: "EXPLAINER DIRECTIONS",
      title: "Eight ways to explain a complex idea",
      intro: "Choose one explanatory job per sequence and keep the visual hierarchy aligned with the question the viewer needs answered.",
      items: [
        { title: "SaaS product explanation", problem: "Show features, workflows, states, and value without inventing UI behavior.", body: "Use interface-led scenes to explain one product relationship at a time.", cta: "Explain a Product", image: image("/assets/dreamshoot/explainer-video/explainer-video-saas-product.jpg", "Generated SaaS product interface showing workflow modules and feature relationships", 1600, 1000) },
        { title: "Process flow concept", problem: "Make inputs, transformation, decision points, and results readable.", body: "Connect stages with consistent nodes, labels, and causal order.", cta: "Map a Process", image: image("/assets/dreamshoot/explainer-video/explainer-video-process-flow.jpg", "Generated process flow connecting input analysis creation review and delivery stages", 1600, 1000) },
        { title: "Data insight showcase", problem: "Organize a chart or metric around one interpretable takeaway.", body: "Treat numbers, labels, and chart shapes as placeholders until checked against source data.", cta: "Explain Data", image: image("/assets/dreamshoot/explainer-video/explainer-video-data-insights.jpg", "Generated analytics dashboard with charts and insight cards for data storytelling", 1600, 1000) },
        { title: "Educational knowledge explanation", problem: "Break a topic into understandable components and relationships.", body: "Use diagrams and motion to support learning without presenting generated facts as verified.", cta: "Explain a Topic", image: image("/assets/dreamshoot/explainer-video/explainer-video-education-knowledge.jpg", "Generated educational knowledge diagram showing connected learning relationships", 1600, 1000) },
        { title: "Technology concept visualization", problem: "Simplify architecture, AI, cloud, software, or system relationships.", body: "Show the mechanism and boundaries clearly instead of adding decorative complexity.", cta: "Visualize Technology", image: image("/assets/dreamshoot/explainer-video/explainer-video-technology-concept.jpg", "Generated technology system diagram linking AI services and application endpoints", 1600, 1000) },
        { title: "Business strategy explanation", problem: "Make a framework, roadmap, matrix, funnel, or decision model scannable.", body: "Keep each layer tied to a defined strategic question and approved terminology.", cta: "Explain Strategy", image: image("/assets/dreamshoot/explainer-video/explainer-video-business-strategy.jpg", "Generated business strategy framework with layered priorities and decisions", 1600, 1000) },
        { title: "User journey explanation", problem: "Show sequential touchpoints from discovery through action and retention.", body: "Preserve touchpoint order and distinguish an illustrative journey from measured customer evidence.", cta: "Map a Journey", image: image("/assets/dreamshoot/explainer-video/explainer-video-user-journey.jpg", "Generated user journey map showing discovery signup creation sharing and return", 1600, 1000) },
        { title: "Whiteboard or presentation explanation", problem: "Let diagrams carry the message while a presenter provides context.", body: "Use presenter imagery as framing, never as proof of credentials or expertise.", cta: "Frame a Presentation", image: image("/assets/dreamshoot/explainer-video/explainer-video-whiteboard-presentation.jpg", "Generated whiteboard presentation explaining a problem model and value relationship", 1600, 1000) }
      ]
    },
    gallery: {
      eyebrow: "AI-GENERATED SCENE REFERENCES",
      title: "Eight explainer-video scene directions",
      intro: "These page-specific generated references are editorial visual directions, not claims that every scene is a one-click preset or a verified myDreamshoots output.",
      items: [
        { title: "SaaS product explanation", body: "Interface-led visual for features, workflows, states, and value.", image: image("/assets/dreamshoot/explainer-video/explainer-video-saas-product.jpg", "Generated SaaS product explanation interface with workflow feature callouts", 1600, 1000) },
        { title: "Process flow concept", body: "Connected stages showing input, transformation, review, and result.", image: image("/assets/dreamshoot/explainer-video/explainer-video-process-flow.jpg", "Generated process flow explanation with connected input and delivery stages", 1600, 1000) },
        { title: "Data insight showcase", body: "Charts and metrics organized around one interpretable takeaway.", image: image("/assets/dreamshoot/explainer-video/explainer-video-data-insights.jpg", "Generated data insight dashboard with charts and explanatory metric cards", 1600, 1000) },
        { title: "Educational knowledge explanation", body: "A concept broken into understandable components and relationships.", image: image("/assets/dreamshoot/explainer-video/explainer-video-education-knowledge.jpg", "Generated educational knowledge diagram showing related learning components", 1600, 1000) },
        { title: "Technology concept visualization", body: "Architecture and system relationships simplified visually.", image: image("/assets/dreamshoot/explainer-video/explainer-video-technology-concept.jpg", "Generated technology architecture diagram linking cloud and software endpoints", 1600, 1000) },
        { title: "Business strategy explanation", body: "Layered framework, funnel, matrix, roadmap, or decision model.", image: image("/assets/dreamshoot/explainer-video/explainer-video-business-strategy.jpg", "Generated business strategy framework with layered priorities and decisions", 1600, 1000) },
        { title: "User journey explanation", body: "Sequential touchpoints from awareness or discovery through action.", image: image("/assets/dreamshoot/explainer-video/explainer-video-user-journey.jpg", "Generated user journey map showing discovery creation sharing and return", 1600, 1000) },
        { title: "Whiteboard or presentation explanation", body: "Presenter-supported explanation where diagrams carry the information.", image: image("/assets/dreamshoot/explainer-video/explainer-video-whiteboard-presentation.jpg", "Generated whiteboard presentation explaining a problem model and value relationship", 1600, 1000) }
      ]
    },
    foundation: {
      eyebrow: "EXPLAINER CLARITY SYSTEM",
      title: "Six decisions before generating clips",
      intro: "Define the explanatory job before choosing a visual style or motion treatment.",
      leftTitle: "Clarify",
      leftItems: ["Question to answer", "Concept unit", "Visual grammar"],
      rightTitle: "Verify",
      rightItems: ["Evidence status", "Sequence logic", "Verification boundary"],
      rightTone: "avoid",
      expertLabel: "Expert tip",
      expertTip: "One clip should answer one question or explain one relationship. A professional-looking chart, diagram, or presenter does not prove the claim it appears to communicate."
    },
    guidance: {
      eyebrow: "SEQUENCE GUIDE",
      title: "Use visual hierarchy, consistency, and evidence boundaries",
      intro: "Generated text, numbers, labels, and UI-like marks can look plausible while being wrong.",
      cards: [
        { title: "One idea per shot", body: "Each clip should answer one question or explain one relationship; do not put a whole presentation into one frame." },
        { title: "Make the important thing dominant", body: "Prioritize the concept, node, chart, metric, or comparison that carries the explanation." },
        { title: "Treat generated text as a placeholder", body: "Replace generated labels, statistics, dates, equations, citations, and product UI with verified source material." },
        { title: "Preserve relationships between shots", body: "Keep node order, terminology, icons, colors, and causal relationships consistent when the content has not changed." },
        { title: "Do not manufacture authority", body: "Generated experts, charts, dashboards, and technical visuals do not establish credentials, evidence, or product truth." },
        { title: "Design for the destination", body: "A landing page, onboarding flow, classroom visual, investor concept, sales clip, and social explainer need different density and pacing." }
      ]
    },
    evidence: {
      eyebrow: "FIRST-PARTY PRODUCT EVIDENCE",
      title: "Verify the live workflow before publishing",
      intro: "The page must be backed by real myDreamshoots evidence before it is promoted as an indexable product page.",
      cards: [
        { title: "Text to Video input", body: "Add a real, internally reviewed capture of the supported text input path and its current controls." },
        { title: "Image to Video input", body: "Add a real capture showing how an approved diagram, interface, chart, or product image enters the workflow." },
        { title: "Credits and job state", body: "Document the real credit requirement, generation request, job state, and at least one reviewed explainer-style output." }
      ]
    },
    steps: {
      eyebrow: "HOW IT WORKS",
      title: "From one explainer question to a reviewed visual sequence",
      items: [
        { title: "Define the question", body: "Choose the audience and the one thing the viewer should understand after the shot." },
        { title: "Choose the source path", body: "Use Text to Video for a written concept or Image to Video when an approved visual should anchor the motion." },
        { title: "Generate short scenes", body: "Review diagrams, chart shapes, labels, text-like marks, UI relationships, arrows, and visual continuity." },
        { title: "Replace and verify", body: "Replace illustrative numbers or generated text with trusted source material before publication and check every factual claim." }
      ],
      cta: "Create Explainer Video Visuals"
    },
    value: {
      eyebrow: "ACCURACY BOUNDARY",
      title: "Generated visuals can explain; they cannot verify facts",
      intro: "Use the output as a visual draft and keep the evidence owner responsible for the final claim.",
      items: [
        { title: "Keep facts stable", body: "Product capabilities, technical behavior, scientific claims, legal or financial statements, statistics, and customer outcomes require real sources." },
        { title: "Replace illustrative marks", body: "Check every number, label, citation, equation, date, chart, and interface detail against approved source material." },
        { title: "Separate concept from proof", body: "An AI-generated dashboard or expert-looking presenter is not a product screenshot, credential, customer case, or research citation." },
        { title: "Match the destination", body: "Adjust density, text volume, crop, and pacing for landing pages, onboarding, education, sales enablement, and social formats." }
      ]
    },
    trust: {
      eyebrow: "RESPONSIBLE USE",
      title: "Keep explanation useful, distinct, and verifiable",
      intro: "Before publishing an explainer sequence:",
      items: [
        { title: "Verify product claims", body: "Do not imply automatic product verification, research, citation checking, or guaranteed explanation correctness without documented support." },
        { title: "Source every factual claim", body: "Use trusted source material for statistics, scientific information, financial or legal facts, product behavior, and customer outcomes." },
        { title: "Label generated references accurately", body: "Do not present generated artwork, dashboards, people, or charts as actual customers, experts, partners, product UI, or measured evidence." },
        { title: "Keep neighboring intents separate", body: "Explainer Video explains a concept or system; How-to Video teaches ordered actions; Talking Head Video is presenter-led; Corporate Video is organization-led." },
        { title: "Review rights and context", body: "Use approved images and diagrams, preserve source rights, and remove unsupported details before publishing." },
        { title: "Keep CTA and destination consistent", body: "The next action should match the explanatory promise and the live workflow the visitor can actually use." }
      ]
    },
    comparison: {
      eyebrow: "RELATED VIDEO TOPICS",
      title: "Choose the page that matches the viewer's job",
      intro: "Avoid intent overlap by sending visitors to the format that best answers their question.",
      items: [
        { title: "Product Video", body: "Product-led demonstrations with clear visual proof and buyer context.", href: "/ai-video-generation/product-video", linkLabel: "Explore Product Video" },
        { title: "Motion Generator", body: "Controlled movement from one approved source image.", href: "/ai-video-generation/motion-generator", linkLabel: "Explore Motion Generator" },
        { title: "AI Video Generation", body: "Browse the full directory when the creative job is not yet clear.", href: "/ai-video-generation", linkLabel: "Browse AI Video Generation" }
      ]
    },
    faq: {
      eyebrow: "FAQ",
      title: "Questions about AI explainer video generation",
      items: [
        { question: "What is an AI explainer video generator?", answer: "It helps turn a product, concept, process, dataset, technology topic, or educational idea into motion-based visual explanation concepts. Define the question, visual structure, sequence, and verified source material, then generate and review short clips." },
        { question: "Can I make an explainer from an existing diagram or product image?", answer: "Use Image to Video when an approved diagram, interface, chart, product screen, or other still should anchor the generated motion. Verify that relationships, labels, text, and visual details remain accurate." },
        { question: "Can I create an explainer from text?", answer: "Use Text to Video to describe the question, concept, objects or UI, visual hierarchy, sequence role, and motion. Do not rely on a vague generic explainer prompt." },
        { question: "Are generated charts and statistics accurate?", answer: "Do not assume so. Generated charts, numbers, labels, percentages, equations, citations, and UI text should be treated as illustrative until replaced or checked against trusted source material." },
        { question: "How is this different from How-to Video?", answer: "Explainer Video answers what something is, why it matters, or how a system works. How-to Video teaches the viewer to complete a task through ordered, actionable steps." },
        { question: "How is this different from Talking Head Video?", answer: "Talking Head Video is presenter-led. Explainer Video is information-led: the diagram, interface, chart, object relationship, or visual model carries the core explanation even when a presenter appears." }
      ]
    },
    finalCta: {
      eyebrow: "CREATE WITH VERIFIED SOURCE MATERIAL",
      title: "Turn one complex idea into a clearer visual explanation",
      body: "Define the question, choose the right visual grammar, generate short scenes, and review every factual detail against trusted source material before publishing.",
      cta: "Create Explainer Video Visuals",
      microcopy: "Generated visuals are drafts. Product facts, numbers, claims, and citations still need independent verification."
    }
  },
  "how-to-video": {
    seo: {
      title: "AI Tutorial Video Generator for Step-by-Step How-to Videos | myDreamshoots",
      description: "Create AI tutorial-video visuals from text or approved images for step-by-step instructions, software walkthroughs, assembly, demonstrations, checkpoints, and training content.",
      keywords: "ai tutorial video generator, how-to video maker, AI instructional video generator, step-by-step video maker, software tutorial video generator, assembly tutorial video, training video generator, product instruction video",
      canonicalPath: "/ai-video-generation/how-to-video"
    },
    hero: {
      eyebrow: "AI TUTORIAL VIDEO GENERATOR",
      title: "AI Tutorial Video Generator for Step-by-Step How-to Videos",
      body: "Create clear tutorial-video directions for setup, assembly, software walkthroughs, demonstrations, checkpoints, training, and final verification. Start from text or an approved image, show one ordered action at a time, and review every instruction against authoritative source material before publishing.",
      primaryCta: "Create How-to Video Visuals",
      secondaryCta: "Explore AI Video Generation",
      availabilityNote: "Use the live myDreamshoots workflow to confirm available inputs, credit requirements, generation state, and supported controls before creating tutorial visuals.",
      rightsCopy: "Use only manuals, interfaces, product references, and images you own or are authorized to use. Generated labels, measurements, warnings, and procedures are illustrative until reviewed.",
      imageNote: "These AI-generated editorial references illustrate tutorial direction and are not presented as verified product output or safety instructions.",
      image: image("/assets/dreamshoot/how-to-video/hero-how-to-video-hands-on-step.jpg", "Generated hands-on tutorial showing a screwdriver, desk-lamp joint, alignment, and verification cues", 1600, 1000),
      images: [
        image("/assets/dreamshoot/how-to-video/hero-how-to-video-hands-on-step.jpg", "Generated hands-on tutorial showing a screwdriver, desk-lamp joint, alignment, and verification cues", 1600, 1000),
        image("/assets/dreamshoot/how-to-video/hero-how-to-video-screen-tutorial.jpg", "Generated software tutorial screen showing numbered UI actions, highlighted control, cursor focus, and confirmation", 1600, 1000),
        image("/assets/dreamshoot/how-to-video/hero-how-to-video-overhead-demo.jpg", "Generated overhead tutorial workbench showing tools, parts, hands, preparation, action, and verification stages", 1600, 1000)
      ],
      highlights: ["Ordered actions", "Prerequisites", "Visual proof", "Checkpoints", "Text to Video", "Image to Video"]
    },
    quickAnswer: {
      eyebrow: "WHAT THIS CREATES",
      title: "Make the next action easy to see",
      intro: "How-to Video is for actionable ordered instruction. It answers what the viewer should do next, what should change, and how to check the result. It is distinct from concept-led Explainer Video and presenter-led Talking Head Video.",
      cards: [
        { title: "Hands-on", body: "Show tools, materials, hands, object orientation, one action, the expected state change, and a visible check." },
        { title: "Screen-led", body: "Show a software or device workflow with numbered actions, focused controls, state changes, and confirmation points." },
        { title: "Demonstration-led", body: "Show a task, product use, setup, or training routine with prerequisites, sequence, result, and verification boundary." }
      ]
    },
    useCases: {
      eyebrow: "TUTORIAL DIRECTIONS",
      title: "Choose the task before choosing the visual style",
      intro: "A useful tutorial starts with a defined job, not a generic cinematic treatment. Pick the task, the viewer's starting state, and the proof that shows the step worked.",
      items: [
        { title: "Tools and materials", problem: "The viewer cannot tell what must be ready before the first action.", body: "Open with a clean inventory of tools, parts, files, or permissions and label only details verified from the source procedure.", cta: "Show Prerequisites", image: image("/assets/dreamshoot/how-to-video/how-to-video-tools-materials.jpg", "Generated tutorial workbench with labeled tools parts and prepared materials before assembly", 1600, 1000) },
        { title: "Safety and prerequisites", problem: "A step begins without showing conditions that make it appropriate or safe.", body: "Show the required starting condition, protective equipment, access, power state, or other prerequisite without inventing official safety guidance.", cta: "Frame the Starting State", image: image("/assets/dreamshoot/how-to-video/how-to-video-prerequisite-safety.jpg", "Generated tutorial preparation scene showing gloves workspace clearance and prerequisite safety checks", 1600, 1000) },
        { title: "Ordered steps", problem: "The viewer sees an outcome but not the sequence that produces it.", body: "Use numbered shots and stable framing so one action leads visibly to the next instead of collapsing multiple instructions into a montage.", cta: "Build Ordered Steps", image: image("/assets/dreamshoot/how-to-video/how-to-video-ordered-steps.jpg", "Generated instructional sequence showing numbered setup actions progressing across a work surface", 1600, 1000) },
        { title: "Close action", problem: "The important manipulation is too small or obscured to inspect.", body: "Move closer to the hand, tool, control, connector, texture, or object orientation that carries the instruction.", cta: "Show the Key Action", image: image("/assets/dreamshoot/how-to-video/how-to-video-close-action.jpg", "Generated close-up tutorial view showing hands turning a tool at a small mechanical joint", 1600, 1000) },
        { title: "Software walkthrough", problem: "A screen recording lists clicks without showing the state change the user should expect.", body: "Frame the starting screen, focused control, action, resulting state, and confirmation while treating generated interface text as a placeholder.", cta: "Create a Screen Tutorial", image: image("/assets/dreamshoot/how-to-video/how-to-video-software-walkthrough.jpg", "Generated software walkthrough with numbered interface actions highlighted control and confirmation state", 1600, 1000) },
        { title: "Demonstration", problem: "A product or task appears in a lifestyle scene but the procedure is hard to follow.", body: "Keep the camera and object orientation stable enough for the viewer to compare each step and result.", cta: "Create a Demonstration", image: image("/assets/dreamshoot/how-to-video/hero-how-to-video-overhead-demo.jpg", "Generated overhead demonstration showing hands using prepared parts through an ordered tutorial task", 1600, 1000) },
        { title: "Measure and verify", problem: "The tutorial ends with an attractive result but no observable completion check.", body: "Show the measurement, alignment, screen status, fit, count, or other visible checkpoint that indicates the task is complete.", cta: "Add a Checkpoint", image: image("/assets/dreamshoot/how-to-video/how-to-video-measure-verify.jpg", "Generated tutorial checkpoint showing measurement tool alignment and a visible verification result", 1600, 1000) },
        { title: "Before and after", problem: "The viewer cannot compare the starting condition with the intended result.", body: "Use matched framing and clear labels to show what changed, while avoiding unsupported claims about performance or safety.", cta: "Show the Result", image: image("/assets/dreamshoot/how-to-video/how-to-video-before-after.jpg", "Generated before and after tutorial comparison showing a completed organized workspace result", 1600, 1000) }
      ]
    },
    gallery: {
      eyebrow: "AI-GENERATED SCENE REFERENCES",
      title: "Eight step-by-step tutorial scene directions",
      intro: "These page-specific generated references are editorial visual directions, not verified myDreamshoots outputs, official manuals, or safety procedures.",
      items: [
        { title: "Tools and materials", body: "Prepared tools, parts, and materials before the first action.", image: image("/assets/dreamshoot/how-to-video/how-to-video-tools-materials.jpg", "Generated tutorial workbench with tools parts and materials prepared before a step-by-step task", 1600, 1000) },
        { title: "Prerequisite and safety", body: "Starting conditions and contextual checks before action.", image: image("/assets/dreamshoot/how-to-video/how-to-video-prerequisite-safety.jpg", "Generated tutorial preparation showing workspace clearance gloves and prerequisite safety checks", 1600, 1000) },
        { title: "Ordered steps", body: "Numbered actions that preserve sequence and orientation.", image: image("/assets/dreamshoot/how-to-video/how-to-video-ordered-steps.jpg", "Generated instructional sequence showing numbered actions across a stable tutorial work surface", 1600, 1000) },
        { title: "Close action", body: "The manipulation that carries the key instruction.", image: image("/assets/dreamshoot/how-to-video/how-to-video-close-action.jpg", "Generated close-up tutorial action showing hands turning a tool at a small joint", 1600, 1000) },
        { title: "Software walkthrough", body: "Focused control, action, state change, and confirmation.", image: image("/assets/dreamshoot/how-to-video/how-to-video-software-walkthrough.jpg", "Generated software walkthrough showing numbered UI actions highlighted control and confirmation state", 1600, 1000) },
        { title: "Overhead demonstration", body: "A stable view of the full task and object orientation.", image: image("/assets/dreamshoot/how-to-video/hero-how-to-video-overhead-demo.jpg", "Generated overhead tutorial demonstration showing hands tools parts and ordered task stages", 1600, 1000) },
        { title: "Measure and verify", body: "An observable checkpoint that confirms the intended state.", image: image("/assets/dreamshoot/how-to-video/how-to-video-measure-verify.jpg", "Generated tutorial verification showing measurement alignment and a visible completion checkpoint", 1600, 1000) },
        { title: "Before and after", body: "Matched framing that makes the changed state legible.", image: image("/assets/dreamshoot/how-to-video/how-to-video-before-after.jpg", "Generated before and after tutorial comparison showing a completed organized workspace result", 1600, 1000) }
      ]
    },
    foundation: {
      eyebrow: "INSTRUCTION INTEGRITY SYSTEM",
      title: "Six decisions before generating tutorial clips",
      intro: "Define the instruction and its evidence boundary before choosing camera movement, pacing, or visual polish.",
      leftTitle: "Define",
      leftItems: ["Task goal", "Prerequisites", "Ordered action"],
      rightTitle: "Check",
      rightItems: ["Visual proof", "Failure path", "Verification boundary"],
      rightTone: "avoid",
      expertLabel: "Expert tip",
      expertTip: "A polished generated action is not an authoritative procedure. Anchor every high-risk, technical, product-specific, or safety-critical instruction to a real source before publication."
    },
    guidance: {
      eyebrow: "SEQUENCE GUIDE",
      title: "Make each instruction visible, ordered, and checkable",
      intro: "Tutorial visuals can look plausible while skipping a prerequisite, changing object orientation, or inventing a result.",
      cards: [
        { title: "Start from the real state", body: "Show what the viewer has before acting, including tools, materials, files, permissions, or device state." },
        { title: "One action per shot", body: "Keep each shot focused on one operation so the viewer knows what to do next." },
        { title: "Show the state change", body: "Make the expected result visible instead of relying on narration that says the step worked." },
        { title: "Preserve orientation", body: "Keep camera angle, object position, hand placement, and screen context stable across sequential steps." },
        { title: "Show what can go wrong", body: "Name or depict a failure path only when it is supported by the authoritative source; never invent warnings." },
        { title: "End with verification", body: "Close with a fit, alignment, measurement, status, count, or other observable checkpoint." }
      ]
    },
    evidence: {
      eyebrow: "FIRST-PARTY PRODUCT EVIDENCE",
      title: "Verify the live workflow before publishing",
      intro: "The page must be backed by real myDreamshoots evidence before it is promoted as an indexable product page.",
      cards: [
        { title: "Text to Video input", body: "Add a real, internally reviewed capture of the supported text input path and current controls for tutorial direction." },
        { title: "Image to Video input", body: "Add a real capture showing how an approved product, interface, diagram, or reference image enters the workflow." },
        { title: "Credits and job state", body: "Document the real credit requirement, generation request, job state, and at least one reviewed tutorial-style output." }
      ]
    },
    steps: {
      eyebrow: "HOW IT WORKS",
      title: "From one task to a reviewed tutorial sequence",
      items: [
        { title: "Define the task", body: "Name the audience, starting state, desired result, and one action the viewer should complete." },
        { title: "Choose the source path", body: "Use Text to Video for written instructions or Image to Video when an approved reference should anchor the visual." },
        { title: "Generate short scenes", body: "Review tools, hands, object orientation, UI states, labels, warnings, timing, and continuity." },
        { title: "Replace and verify", body: "Check every instruction against the manual, interface, source image, or other authoritative reference before publishing." }
      ],
      cta: "Create How-to Video Visuals"
    },
    value: {
      eyebrow: "INSTRUCTION / SAFETY BOUNDARY",
      title: "Generated visuals can demonstrate; they cannot authorize procedures",
      intro: "Use the output as a visual draft and keep the procedure owner responsible for the final instruction.",
      items: [
        { title: "Keep procedures sourced", body: "Manufacturer instructions, technical procedures, medical guidance, chemical handling, electrical work, and safety claims require authoritative sources." },
        { title: "Replace generated text", body: "Check every label, measurement, setting, command, warning, date, and product detail against approved material." },
        { title: "Separate reference from proof", body: "A generated hand, tool, interface, result, or checkpoint is not proof that the real task is safe or complete." },
        { title: "Match the learner", body: "Adjust shot density, pacing, captions, crop, and terminology for onboarding, training, support, classroom, or social use." }
      ]
    },
    trust: {
      eyebrow: "RESPONSIBLE USE",
      title: "Keep tutorial content useful, distinct, and verifiable",
      intro: "Before publishing a how-to sequence:",
      items: [
        { title: "Verify product instructions", body: "Do not imply that generated visuals are official manufacturer instructions or verified product behavior." },
        { title: "Source high-risk guidance", body: "Use qualified and authoritative sources for medical, chemical, electrical, mechanical, legal, financial, or safety-critical steps." },
        { title: "Label generated references accurately", body: "Do not present generated screens, tools, people, measurements, warnings, or results as real product evidence." },
        { title: "Keep neighboring intents separate", body: "How-to Video teaches ordered actions; Explainer Video explains concepts; Talking Head Video is presenter-led; Fitness and Food own their domain workflows." },
        { title: "Review rights and context", body: "Use approved references, preserve source rights, and remove unsupported details before publishing or training." },
        { title: "Keep CTA and destination consistent", body: "The next action should match the tutorial promise and the live workflow the visitor can actually use." }
      ]
    },
    comparison: {
      eyebrow: "RELATED VIDEO TOPICS",
      title: "Choose the page that matches the viewer's job",
      intro: "Avoid intent overlap by sending visitors to the format that best answers the question or task.",
      items: [
        { title: "Explainer Video", body: "Explain what something is, why it matters, or how a system works.", href: "/ai-video-generation/explainer-video", linkLabel: "Explore Explainer Video" },
        { title: "Talking Head Video", body: "Use a presenter-led format for direct explanation, commentary, or delivery.", href: "/ai-video-generation/talking-head-video", linkLabel: "Explore Talking Head Video" },
        { title: "Food Video", body: "Own cooking action, preparation, plating, service, and culinary visuals.", href: "/ai-video-generation/food-video", linkLabel: "Explore Food Video" },
        { title: "AI Video Generation", body: "Browse the full directory when the creative job is not yet clear.", href: "/ai-video-generation", linkLabel: "Browse AI Video Generation" }
      ]
    },
    faq: {
      eyebrow: "FAQ",
      title: "Questions about AI tutorial video generation",
      items: [
        { question: "What is an AI tutorial video generator?", answer: "It helps turn a defined task into visual instructions with a starting state, ordered actions, expected state changes, and observable checkpoints. Generate short scenes, then verify every instruction against authoritative source material." },
        { question: "Can I make a how-to video from an existing product image or screen?", answer: "Use Image to Video when an approved product, interface, diagram, or reference image should anchor the motion. Review object identity, UI states, labels, measurements, and continuity before publishing." },
        { question: "Can I create a how-to video from text?", answer: "Use Text to Video to describe the task goal, prerequisites, ordered actions, object or screen state, expected result, and verification checkpoint instead of relying on a vague generic prompt." },
        { question: "Are generated instructions and safety warnings accurate?", answer: "Do not assume so. Generated labels, measurements, settings, commands, warnings, procedures, and results should be treated as illustrative until checked against a manual, interface, or other trusted source." },
        { question: "How is this different from Explainer Video?", answer: "How-to Video teaches the viewer to complete a task through ordered, actionable steps. Explainer Video answers what something is, why it matters, or how a system works." },
        { question: "How is this different from Talking Head Video?", answer: "Talking Head Video is presenter-led. How-to Video is action-led: the hands, screen, object, sequence, and checkpoint carry the instruction even when a presenter appears." }
      ]
    },
    finalCta: {
      eyebrow: "CREATE WITH VERIFIED SOURCE MATERIAL",
      title: "Turn one task into a clearer visual tutorial",
      body: "Define the starting state, show ordered actions, add visible checkpoints, and review every instruction against trusted source material before publishing.",
      cta: "Create How-to Video Visuals",
      microcopy: "Generated visuals are drafts. Product procedures, safety claims, settings, and measurements still need independent verification."
    }
  },
  "ugc-ad-video": {
    seo: {
      title: "AI UGC Video Generator for Creator-Style Product Ads | myDreamshoots",
      description:
        "Create creator-style product ads with an AI UGC video generator. Plan hooks, speaker roles, product-in-use scenes, visible proof, voiceover, and clear CTAs—then validate every claim against your real product assets and generated output.",
      keywords:
        "AI UGC video generator, UGC ad video generator, AI UGC ad creator, UGC product video maker, creator-style product video, AI creator ad video, UGC style video ad, short-form creator ad generator",
      canonicalPath: "/ai-video-generation/ugc-ad-video"
    },
    hero: {
      eyebrow: "AI UGC VIDEO GENERATOR",
      title: "AI UGC Video Generator for Creator-Style Product Ads",
      body:
        "Build UGC-style product videos around a clear creator role, a scroll-stopping hook, a real product moment, and proof the viewer can actually see. Keep AI, actors, paid creators, and real customers accurately represented while turning approved product inputs into creator-native ad concepts.",
      primaryCta: "Create a UGC-Style Video",
      secondaryCta: "See UGC Examples",
      availabilityNote:
        "The current video workspace is the verified creation path. This page does not claim a separate UGC-only generator or unverified creator controls.",
      rightsCopy:
        "Use only product claims, speaker identities, offers, and outputs you can verify. Do not present AI-generated people, actors, stock people, or scripted experiences as verified customer testimonials.",
      imageNote: "Creator role -> Hook -> Product context -> Visible proof -> Output -> CTA",
      highlights: ["Creator role", "Hook", "Product context", "Visible proof", "Output", "CTA"],
      image: image(
        "/assets/dreamshoot/ugc-ad-video/ai-ugc-video-creator-lip-product-hook.jpg",
        "Creator filming a lip product with a smartphone and ring light for a UGC-style ad concept",
        2160,
        3840
      )
    },
    quickAnswer: {
      eyebrow: "WHAT TO MAKE CLEAR",
      title: "What Should an AI UGC Video Generator Help You Decide?",
      intro:
        "A useful UGC generator should do more than make footage look like it came from a phone. Before generation, the brief needs to define who is speaking, why the opening matters, where the product appears, which details prove the claim, and what the viewer should do next.",
      cards: [
        { title: "Creator role", body: "Real customer, paid creator, employee, actor, AI avatar, or fictional spokesperson. The role changes which first-person claims are appropriate." },
        { title: "Hook", body: "One question, observation, tension, contrast, or product moment that earns attention without inventing a result." },
        { title: "Product context", body: "Show the product inside the routine, task, fit, application, comparison, or use case the audience is actually evaluating." },
        { title: "Visible proof", body: "Put observable evidence close to the line it supports: product movement, screen state, size, texture, packaging, included items, workflow, fit, or another verifiable detail." },
        { title: "CTA", body: "End with one next action that matches the destination page and the offer the viewer will actually find there." }
      ]
    },
    useCases: {
      eyebrow: "UGC JOBS",
      title: "Choose the UGC Job Before You Choose the Style",
      intro:
        "Creator-native footage only works when the message has a clear job. Choose the moment the audience needs to understand before deciding how casual, polished, direct, or product-led the edit should feel.",
      items: [
        makeUseCaseCard({
          scenarioLabel: "01 - UNBOXING",
          title: "Give the Unboxing a Point of View",
          problem: "The video opens a package but never gives the viewer a reason to care.",
          body: "Start with the expectation or buying question. Show only the package details that change the decision: included items, size, setup, texture, fit, finish, or another visible detail.",
          noteLabel: "Structure",
          noteBody: "Expectation -> opening -> useful detail -> qualified reaction -> CTA",
          cta: "Create an Unboxing UGC Ad",
          image: image(
            "/assets/dreamshoot/ugc-ad-video/ugc-ad-video-unboxing-first-impression.jpg",
            "Adult filming a cosmetic product while opening an online order for an unboxing creator video",
            4103,
            6154
          )
        }),
        makeUseCaseCard({
          scenarioLabel: "02 - ROUTINE",
          title: "Put the Product Inside the Moment Where the Problem Happens",
          problem: "The creator mentions a pain point, then the product appears like a disconnected sponsor insert.",
          body: "Use one routine or friction the audience recognizes. Let the product enter at the point where it changes the action, and show the change rather than only describing it.",
          noteLabel: "Structure",
          noteBody: "Routine friction -> creator context -> product action -> observable change -> CTA",
          cta: "Create a Problem-in-Routine UGC Ad",
          image: image(
            "/assets/dreamshoot/ugc-ad-video/ugc-ad-video-product-review-direct-to-camera.jpg",
            "Adult woman presenting a personal-care product to a smartphone camera in a creator-style review setup",
            3886,
            5829
          )
        }),
        makeUseCaseCard({
          scenarioLabel: "03 - DEMO",
          title: "Let the Product Movement Carry Part of the Proof",
          problem: "The speaker says the product is easy or useful without showing enough of the actual use.",
          body: "Use hands, close shots, screens, application steps, or a short sequence to demonstrate the claim while the creator explains only what the footage cannot show by itself.",
          noteLabel: "Structure",
          noteBody: "Use case -> action -> visible detail -> takeaway -> CTA",
          cta: "Create a Demo-in-Use UGC Ad",
          image: image(
            "/assets/dreamshoot/ugc-ad-video/ugc-ad-video-kitchen-product-demo.jpg",
            "Smartphone on a tripod recording an adult woman demonstrating a task in a kitchen",
            4160,
            6240
          )
        }),
        makeUseCaseCard({
          scenarioLabel: "04 - TRY-ON",
          title: "Use Lifestyle Footage to Answer One Buying Question",
          problem: "The footage is attractive but does not answer the practical buying question.",
          body: "Choose one decision criterion—fit, scale, styling, application, portability, texture, convenience, or another visible attribute—and build the scene around that question.",
          noteLabel: "Structure",
          noteBody: "Question -> try/apply/use -> detail -> interpretation -> CTA",
          cta: "Create a Try-On UGC Ad",
          image: image(
            "/assets/dreamshoot/ugc-ad-video/ugc-ad-video-fashion-try-on-creator.jpg",
            "Adult woman filming a clothing try-on with a smartphone and ring light in front of a mirror",
            6000,
            4000
          )
        }),
        makeUseCaseCard({
          scenarioLabel: "05 - TALKING POINTS",
          title: "Write Talking Points for a Person, Not a Press Release",
          problem: "The creator reads brand copy word for word and the UGC feels less natural than a standard ad.",
          body: "Give the speaker one idea at a time. Keep objective product facts separate from subjective reactions. If the speaker is not a real customer, do not write verified-customer experience into the script.",
          noteLabel: "Structure",
          noteBody: "Hook -> context -> claim -> proof -> qualified opinion -> CTA",
          cta: "Create a Direct-to-Camera UGC Ad",
          image: image(
            "/assets/dreamshoot/ugc-ad-video/ugc-ad-video-scripted-talking-points.jpg",
            "Adult man using notes while recording a direct-to-camera video with a smartphone and ring light",
            5707,
            3805
          )
        }),
        makeUseCaseCard({
          scenarioLabel: "06 - B-ROLL + VOICEOVER",
          title: "Use Voiceover to Add Context the B-Roll Cannot Show",
          problem: "The voiceover repeats exactly what the viewer can already see.",
          body: "Let footage handle action, texture, environment, product detail, and sequence. Use voiceover for context, decision logic, comparison criteria, or a careful interpretation of what is visible.",
          noteLabel: "Structure",
          noteBody: "Hook -> useful B-roll -> context/proof -> takeaway -> CTA",
          cta: "Create a B-Roll UGC Ad",
          image: image(
            "/assets/dreamshoot/ugc-ad-video/ugc-ad-video-broll-phone-recording-food.jpg",
            "Hands holding a smartphone while recording food and product details for creator-style B-roll",
            3024,
            4032
          )
        })
      ]
    },
    evidence: {
      eyebrow: "V2 - FIRST-PARTY PRODUCT EVIDENCE",
      title: "Show the Real Generator, Not Just the Category",
      intro: "Stock creator photos explain the scenario. Real UI and real generated output prove the product.",
      cards: [
        { title: "Actual input state", body: "Replace this card with a verified myDreamshoots input screenshot and a caption describing the real asset type supplied.", exampleLabel: "Live product evidence required", exampleBody: "No first-party input capture was included in the delivery package." },
        { title: "Actual workflow / controls", body: "Name only controls or instructions that exist in the current product. Do not add mock creator selectors, voices, ratios, durations, or integrations.", exampleLabel: "Live product evidence required", exampleBody: "Product and development verification is required before publishing control claims." },
        { title: "Actual generated video", body: "Use a real output and matching thumbnail from the current myDreamshoots workflow. Do not use a stock creator photo as output evidence.", exampleLabel: "Live product evidence required", exampleBody: "A public generated UGC output was not supplied with this content package." },
        { title: "Verified product facts", body: "Add only verified input, output, ratio, voice, pricing, export, timing, or commercial-use facts. Omit any field that has not been confirmed.", exampleLabel: "Live product evidence required", exampleBody: "Fact-strip fields remain intentionally empty until product verification is complete." }
      ]
    },
    examples: {
      eyebrow: "V2 - REAL EXAMPLES",
      title: "Show What a Real UGC Brief Becomes",
      intro: "At least three first-party examples: Input -> Brief -> Output -> Why it works.",
      cards: [
        {
          title: "Product Demo UGC",
          body: "Reserve this slot for a real myDreamshoots product demo case. The source, direction, output, and observable reason must all refer to the same generation.",
          details: [
            { label: "Input", body: "Real product asset - pending verified capture." },
            { label: "Brief", body: "Actual direction used - pending product record." },
            { label: "Output", body: "Real generated video and matching thumbnail - pending." },
            { label: "Why", body: "One observable reason the product action and proof work together - pending review." }
          ],
          exampleLabel: "First-party proof required",
          exampleBody: "This card is an evidence-ready slot, not a fabricated customer result."
        },
        {
          title: "Direct-to-Camera UGC",
          body: "Use a verified direct-to-camera case and identify the speaker status accurately. A scripted actor, AI person, paid creator, and real customer require different wording.",
          details: [
            { label: "Input", body: "Real product asset and approved speaker direction - pending." },
            { label: "Brief", body: "Actual hook, context, proof, and CTA - pending." },
            { label: "Output", body: "Real generated video and matching thumbnail - pending." },
            { label: "Why", body: "Explain one visible proof or message decision - pending review." }
          ],
          exampleLabel: "First-party proof required",
          exampleBody: "Do not present a stock person or scripted experience as a verified testimonial."
        },
        {
          title: "B-Roll + Voiceover UGC",
          body: "Use a verified B-roll case where the footage adds action and the voiceover adds context instead of repeating the same line.",
          details: [
            { label: "Input", body: "Real product asset and approved source direction - pending." },
            { label: "Brief", body: "Actual B-roll sequence, context, and CTA - pending." },
            { label: "Output", body: "Real generated video and matching thumbnail - pending." },
            { label: "Why", body: "Explain how the visible sequence carries part of the claim - pending review." }
          ],
          exampleLabel: "First-party proof required",
          exampleBody: "The package does not include a generated output, so no result is claimed here."
        }
      ]
    },
    foundation: {
      eyebrow: "BRIEF MODEL",
      title: "Start With the Speaker and the Evidence",
      intro: "A UGC brief makes six decisions before generation. The speaker's status determines what the message can truthfully imply.",
      leftTitle: "Decisions",
      leftItems: [],
      rightTitle: "Boundaries",
      rightItems: [],
      rightTone: "avoid",
      expertLabel: "EXPERT TIP",
      expertTip: "If the script only works when the speaker pretends to be a real customer, rewrite the premise—not just the disclosure.",
      cards: [
        { title: "Creator Status", body: "Customer, creator, employee, actor, AI, or fictional spokesperson. State who is speaking and what that person can truthfully imply." },
        { title: "Audience Moment", body: "Name the situation the viewer is already in when the product message becomes relevant." },
        { title: "Hook", body: "Choose one question, observation, tension, contrast, or product moment that earns attention without a fake confession or invented result." },
        { title: "Product Moment", body: "Decide where the product enters and what the viewer should see it do." },
        { title: "Proof Boundary", body: "Separate product facts, observable evidence, and subjective opinion before writing the script." },
        { title: "CTA", body: "Choose one next action that matches the message and the destination page." }
      ]
    },
    guidance: {
      eyebrow: "NATURAL SCRIPT MODEL",
      title: "Make the Script Sound Human by Giving Every Line a Job",
      intro: "Natural does not mean unscripted. Give each line a clear role, then let framing and pacing carry the creator-native feel.",
      cards: [
        { title: "Hook", body: "One question, observation, tension, or specific context that earns attention without a fake confession." },
        { title: "Context", body: "Explain why this product matters in this moment and for this audience." },
        { title: "Product moment", body: "Show the action while it is discussed so the product does not feel like a disconnected sponsor insert." },
        { title: "Proof", body: "Keep visible evidence close to the claim it supports." },
        { title: "Reaction", body: "Keep personal reactions personal rather than turning a subjective response into a universal result." },
        { title: "CTA", body: "End with one next step, not a new unsupported promise." }
      ]
    },
    platformExamples: {
      eyebrow: "CREATOR-NATIVE FRAMING",
      title: "Native Style Comes From Framing and Pacing—Not Fake Imperfection",
      intro: "Choose a frame that makes the speaker, product, proof, captions, and next action readable. Keep the creative intentional even when it feels phone-first.",
      items: [
        { title: "Direct-to-camera", body: "Keep eye line, face, product, captions, and CTA readable. Identify the speaker status before using first-person language." },
        { title: "Hands / product close-up", body: "Use when handling or product detail is part of the proof. Let the movement answer part of the buying question." },
        { title: "B-roll sequence", body: "Build a visual progression instead of random lifestyle shots. Use voiceover for context the footage cannot show." },
        { title: "Screen / workflow", body: "Use real interface states and readable source screens. Do not invent product UI, controls, or app results." }
      ]
    },
    comparison: {
      eyebrow: "PAGE DIFFERENTIATION / INTERNAL LINKING",
      title: "UGC Ad Video Is a Specific Creator-Message Job",
      intro: "Keep adjacent pages distinct by the customer decision they support. Use the existing AI Video Generation hub and Product Ad Video page when those are the better fit.",
      items: [
        { title: "UGC Ad Video", body: "Creator role, creator-native hook, conversational script, product-in-context proof, and speaker-status boundaries." },
        { title: "Product Ad Video", body: "Campaign audience, product promise, offer, proof hierarchy, and purchase CTA.", href: "/ai-video-generation/product-ad-video", linkLabel: "Explore Product Ad Video" },
        { title: "Video Ad", body: "Broader paid-video format, placement, ad creative, and channel adaptation. Use a dedicated page when that workflow is available." },
        { title: "Talking Head Video", body: "Presenter or speaker delivery. A talking-head format is not automatically UGC and is not necessarily a product ad." },
        { title: "AI Video Generation", body: "Return to the full video theme directory when the creative job is not yet clear.", href: "/ai-video-generation", linkLabel: "Browse AI Video Generation" }
      ]
    },
    steps: {
      eyebrow: "HOW IT WORKS",
      title: "From UGC Brief to Generated Draft",
      items: [
        { title: "Choose the UGC job", body: "Unboxing, routine, demo, try-on, direct-to-camera, or B-roll + voiceover." },
        { title: "Define speaker + audience moment", body: "Clarify who is speaking, what the viewer is deciding, and what the speaker can truthfully say." },
        { title: "Add verified product inputs", body: "Use only input types the live myDreamshoots product actually accepts." },
        { title: "Use supported controls", body: "Generate using only current, product-verified controls. Do not assume upload URLs, avatar selection, voice cloning, auto captions, or one-click resizing." },
        { title: "Review the real output", body: "Check speaker identity, claim support, visible product detail, rights, disclosure, crop, captions, offer, and CTA before publishing." }
      ],
      cta: "Create a UGC-Style Video"
    },
    value: {
      eyebrow: "MESSAGE TESTING",
      title: "Test Hooks Without Inventing Experiences",
      intro: "Change the angle while keeping identity, claims, product facts, offer terms, and material limitations stable.",
      image: image(
        "/assets/dreamshoot/ugc-ad-video/ugc-ad-video-creator-conversation-recording.jpg",
        "Smartphone on a tripod recording two adults in a conversational creator-content setup",
        4000,
        6000
      ),
      items: [
        { title: "Good variables to test", body: "Question versus observation hook, direct-to-camera versus voiceover, product-first versus context-first, proof order, B-roll sequence, CTA wording, and supported crop adaptation." },
        { title: "Facts that must stay stable", body: "Whether the speaker is a real customer, what the speaker actually experienced, product functionality, specification data, price or offer terms, before-and-after conditions, and material limitations." },
        { title: "Keep the output honest", body: "A different hook can change attention and pacing. It must not change the speaker's identity, the product's capabilities, or the meaning of the evidence." },
        { title: "Review every variant", body: "Compare the finished drafts for claim support, product visibility, rights, disclosure, crop, captions, destination, and CTA consistency." }
      ]
    },
    trust: {
      eyebrow: "RESPONSIBLE USE",
      title: "Creator Style Should Make the Message Easier to Understand—Not Harder to Verify",
      intro: "Before publishing:",
      items: [
        { title: "Identify speaker status accurately", body: "Say whether the speaker is a customer, paid creator, employee, actor, AI-generated person, or fictional spokesperson." },
        { title: "Do not turn stock people into customer stories", body: "Stock imagery can explain a scenario. It cannot prove a real customer experience or endorsement." },
        { title: "Do not fabricate social proof", body: "Do not invent reviews, ratings, comments, likes, views, follower counts, or endorsements." },
        { title: "Tie claims to evidence", body: "Keep objective product claims close to supportable product facts or visible proof." },
        { title: "Keep opinions qualified", body: "A personal reaction should not become a guaranteed result for every viewer." },
        { title: "Use fair comparisons", body: "Use before-and-after or comparison evidence only under fair, representative, supportable conditions." },
        { title: "Do not invent commercial details", body: "Do not add packaging, UI, included items, shipping, price, availability, or offer terms that have not been verified." },
        { title: "Review disclosure requirements", body: "Check the destination's current rules for AI people, synthetic media, sponsorship, and endorsements." },
        { title: "Keep important conditions visible", body: "Keep limitations, exclusions, compatibility, returns, and material conditions visible when they affect the decision." },
        { title: "Make CTA and destination consistent", body: "The next action and destination page should match the promise and decision in the creative." }
      ]
    },
    faq: {
      eyebrow: "FAQ",
      title: "Questions That Belong on a UGC Generator Page",
      items: [
        { question: "What is an AI UGC video generator?", answer: "It is a tool or workflow for creating creator-style video ads from a defined product brief and supported source material. A useful workflow keeps the creator role, product context, visible proof, and CTA clear rather than only adding a phone-shot visual style." },
        { question: "Is UGC the same as an influencer ad?", answer: "No. UGC-style content may involve customers, paid creators, employees, actors, AI-generated people, or fictional spokespeople. An influencer ad usually involves a specific creator relationship and may require additional disclosure." },
        { question: "Can AI create testimonial-style ads?", answer: "AI can create the format, but it should not fabricate a real person's experience, rating, review, or endorsement and present it as genuine." },
        { question: "Does UGC have to look low quality?", answer: "No. Creator-native content can be phone-first while still using clear audio, readable captions, intentional framing, and accurate product detail." },
        { question: "Should the product appear in the first second?", answer: "Not always. The opening depends on the hook. The product should appear early enough that the story remains understandable and the viewer knows what the message is about." },
        { question: "What should I prepare before generating a UGC ad?", answer: "Prepare the real product assets the tool accepts, supported product facts, the speaker role, one audience moment, one hook, the product action you want to show, and one CTA. Use the live product documentation to confirm exactly which input types and controls are available." },
        { question: "What makes this page different from a general video ad generator page?", answer: "This page focuses on creator voice, speaker identity, conversational message design, product-in-context proof, and UGC-specific trust boundaries. A general video ad page should cover the broader paid-video job instead." }
      ]
    },
    finalCta: {
      eyebrow: "CREATE WITH VERIFIED PRODUCT INPUTS",
      title: "Build a UGC-Style Ad Around a Real Product Moment",
      body: "Choose who is speaking, what the viewer is deciding, what the product actually does on camera, which detail proves the claim, and one next action. Then generate with the current myDreamshoots workflow and review the real output before publishing.",
      cta: "Create a UGC-Style Video",
      microcopy: "Real inputs. Verifiable product claims. Clear speaker identity. Creator-native execution."
    }
  }
};

aiVideoTopicLandingContentByKey["talking-head-video"] = talkingHeadVideoContent;

export const aiVideoTopicLandingKeys = Object.keys(aiVideoTopicLandingContentByKey);
