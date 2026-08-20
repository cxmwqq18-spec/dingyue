export type AiVideoTopicImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** Focal point used by the shared 16:9 storefront media frame. */
  objectPosition?: string;
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

function image(src: string, alt: string, width: number, height: number, objectPosition?: string): AiVideoTopicImage {
  return { src, alt, width, height, ...(objectPosition ? { objectPosition } : {}) };
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

export const aiVideoTopicLandingContentByKey: Record<string, AiVideoTopicLandingContent> = {
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
      imageNote: "Slow tracking shot, warm practical lights, moody atmosphere.",
      image: image(`${cinematicImageRoot}/cinematic-video-hotel-corridor-mystery-scene.png`, "Woman in a dark coat walking through a warm-lit hotel corridor for a cinematic mystery scene", 1672, 941)
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
          answer: "Only state exact limits if they are confirmed by the actual product."
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
      imageNote: "9:16-first framing · hook -> body -> close · keep key information clear of interface overlays",
      image: image(`${tiktokImageRoot}/ai-tiktok-video-creator-phone-portrait.png`, "Creator holding a phone in a café for a TikTok-first vertical video concept", 1080, 1920)
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
      eyebrow: "RESPONSIBLE / E-E-A-T",
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
        { question: "Will this make my video go viral?", answer: "No tool can guarantee virality, reach, views, or conversions. The page should promise a more TikTok-aware creative process, not a guaranteed algorithmic outcome." },
        { question: "Do AI TikTok videos need to be labeled?", answer: "TikTok requires labeling for certain AI-generated content, including realistic AI-generated images, audio, or video. Review TikTok's current rules for the exact content you plan to publish." },
        { question: "Can I use the result commercially?", answer: "State only the commercial rights included in the actual myDreamshoots plan and current terms." }
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
      imageNote: "9:16-first · cover-aware · safe-zone thinking · captions when dialogue matters",
      image: image(`${instagramImageRoot}/ai-instagram-reels-creator-editorial-portrait.png`, "Female creator in an editorial café portrait for an Instagram Reels concept", 1080, 1920)
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
      eyebrow: "RESPONSIBLE / E-E-A-T",
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
        { question: "Can I use the result commercially?", answer: "State only the commercial rights supported by the real myDreamshoots plan and current terms." }
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
      image: image(`${socialImageRoot}/social-media-video-cross-platform-creator.png`, "Creator holding a phone for a polished vertical social video concept", 1080, 1920)
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
          image: image(`${socialImageRoot}/social-media-video-launch-campaign.png`, "Creator walking through a street-level vertical video concept at night", 1080, 1920)
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
          image: image(`${socialImageRoot}/social-media-video-product-proof-demo.png`, "Founder demonstrating a product for a social video", 1080, 1920)
        }),
        makeUseCaseCard({
          title: "Batch the Thinking, Not the Sameness",
          problem: "You need several social videos each week, but batching often turns into five versions of the same post.",
          body:
            "Give each video a different audience job: teach, show, answer, prove, invite, or recap. Reuse the same approved source library while changing the purpose, hook, and evidence.",
          noteLabel: "Structure",
          noteBody: "Weekly topic -> content roles -> platform variants -> review.",
          cta: "Create a Weekly Batch",
          image: image(`${socialImageRoot}/social-media-video-event-story.png`, "Speaker presenting an event insight for a social video", 1080, 1920)
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
        guidanceCard({ title: "Platform Cut", body: "Decide what the destination needs from the first seconds, frame, cover, or content structure." }),
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
      eyebrow: "RESPONSIBLE / E-E-A-T",
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
        { question: "Can I use the videos commercially?", answer: "Only state the commercial rights supported by the actual myDreamshoots plan and current terms." }
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
          image: image(`${youtubeImageRoot}/youtube-video-full-tutorial.png`, "Professor presenting a lesson in front of a blackboard", 1080, 1920)
        }),
        makeUseCaseCard({
          title: "Help the Viewer Reach a Decision, Not Just Watch a Demonstration",
          problem: "You review two options, but the audience has to guess which one fits their situation.",
          body:
            "A useful review sets the criteria early: who each option is for, what matters most, and where the differences actually show up. The verdict should feel earned by the evidence, not delayed for drama.",
          noteLabel: "Structure",
          noteBody: "Decision context -> criteria -> comparison -> verdict.",
          cta: "Create a Comparison Video",
          image: image(`${youtubeImageRoot}/youtube-video-review-comparison.png`, "Spokesperson presenting a product for a YouTube review", 1080, 1920)
        }),
        makeUseCaseCard({
          title: "Hook the Insight Before the Conversation Settles In",
          problem: "The guest is interesting, but the audience does not know what insight they will get if they stay.",
          body:
            "Lead with the most useful idea, strongest quote, or key tension. Then let the conversation unpack it. Viewers stay longer when the interview feels like a guided discovery instead of a raw recording.",
          noteLabel: "Structure",
          noteBody: "Insight hook -> guiding question -> answer -> takeaway.",
          cta: "Create an Interview",
          image: image(`${youtubeImageRoot}/youtube-video-interview-conversation.png`, "Live performer on stage in a cinematic conversation-style video scene", 1672, 941)
        }),
        makeUseCaseCard({
          title: "Move From Context to Decision to Result to Lesson",
          problem: "You have a strong example, but the lesson gets lost because the story is not organized.",
          body:
            "Case studies work best when the viewer understands what happened, why the choice mattered, and what changed afterward. The point is not just the story. It is what the viewer can apply.",
          noteLabel: "Structure",
          noteBody: "Context -> decision -> result -> lesson.",
          cta: "Create a Case Study",
          image: image(`${youtubeImageRoot}/youtube-video-case-study.png`, "Luxury vehicle reveal in a cinematic night scene", 1672, 941)
        }),
        makeUseCaseCard({
          title: "Extract the Lessons People Need Instead of Uploading the Whole Event Without Guidance",
          problem: "A full webinar exists, but the audience does not need all 45 minutes to get the value.",
          body:
            "Choose the main themes, compress the repetition, and turn a long event into a clear knowledge asset. A recap should reduce friction, not recreate it.",
          noteLabel: "Structure",
          noteBody: "Topic framing -> 3 key lessons -> practical takeaway -> deeper resource.",
          cta: "Create a Webinar Recap",
          image: image(`${youtubeImageRoot}/youtube-video-webinar-recap.png`, "Speaker presenting an insight to an event audience", 1080, 1920)
        }),
        makeUseCaseCard({
          title: "Make Each Episode Complete Enough - Then Let the Playlist Carry the Bigger Journey",
          problem: "You want content continuity, but every episode either feels too isolated or too dependent on the rest of the series.",
          body:
            "Each video should solve the immediate question while still fitting into a broader learning path. Series labels, recurring structure, and clear progression help viewers understand where they are and what comes next.",
          noteLabel: "Structure",
          noteBody: "Episode promise -> lesson depth -> recap -> next episode or playlist.",
          cta: "Create a Series Episode",
          image: image(`${youtubeImageRoot}/youtube-video-series-episode.png`, "Creator in an editorial street-style scene for a YouTube series", 1080, 1920)
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
      eyebrow: "RESPONSIBLE / E-E-A-T",
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
        { question: "Can I use the result commercially?", answer: "State only the rights supported by the actual myDreamshoots plan and current terms." }
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
        `${memeImageRoot}/meme-video-hero-relax-quick-favor.png`,
        "Surprised dog meme with captions about finally relaxing before someone asks for a quick favor",
        1086,
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
    gallery: {
      eyebrow: "MEME VIDEO EXAMPLES",
      title: "Meme Video Examples",
      intro: "Real meme structures that grab attention quickly. See the kind of finished visual the generator direction is meant to support before reading the method.",
      items: [
        {
          title: "Relax / Quick Favor",
          body: "A reaction setup that lands before the viewer has time to overthink it.",
          image: image(
            `${memeImageRoot}/meme-video-hero-relax-quick-favor.png`,
            "Surprised dog meme with captions about finally relaxing before someone asks for a quick favor",
            1086,
            1448
          )
        },
        {
          title: "Message Overload",
          body: "One message becomes ten more, with the reaction doing most of the work.",
          image: image(
            `${memeImageRoot}/meme-video-message-overload.png`,
            "Reaction meme about opening one message and finding ten more unread messages",
            1086,
            1448
          )
        },
        {
          title: "Expectation / Reality",
          body: "A split contrast makes the punchline readable without extra explanation.",
          image: image(
            `${memeImageRoot}/meme-video-expectation-vs-reality-dog.png`,
            "Expectation versus reality meme using contrasting dog reactions",
            1086,
            1448
          )
        },
        {
          title: "POV: One Tiny Change",
          body: "A specific workplace setup creates instant recognition.",
          image: image(
            `${memeImageRoot}/meme-video-pov-boss-tiny-change.png`,
            "POV reaction meme about a boss asking for one tiny change",
            1086,
            1448
          )
        },
        {
          title: "Printer Disagrees",
          body: "A deadpan caption becomes funnier when the visual refuses to cooperate.",
          image: image(
            `${memeImageRoot}/meme-video-printer-disagrees.png`,
            "Deadpan office meme with the caption I’m fine while the printer disagrees",
            1086,
            1448
          )
        },
        {
          title: "Zoom / Could Have Been an Email",
          body: "A familiar work moment turned into a clean reaction beat.",
          image: image(
            `${memeImageRoot}/meme-video-zoom-could-have-been-email.png`,
            "Reaction meme about a Zoom call that could have been an email",
            1086,
            1448
          )
        },
        {
          title: "Tiny Revision / Sure",
          body: "A short reply becomes the punchline when the setup is already understood.",
          image: image(
            `${memeImageRoot}/meme-video-tiny-revision-sure.png`,
            "Reaction meme replying sure to a request for one tiny revision",
            1086,
            1448
          )
        },
        {
          title: "Coffee / Adulting",
          body: "A simple brand-safe situational line that can stand on its own.",
          image: image(
            `${memeImageRoot}/meme-video-coffee-adulting.png`,
            "Coffee sign meme reading Coffee because adulting is hard",
            1086,
            1448
          )
        }
      ],
      cta: "See More Meme Examples",
      ctaHref: "#examples"
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
        { question: "Can you make memes for my brand?", answer: "Yes as a content direction, but the page should not promise specific brand-template or publishing features that the current product does not support." },
        { question: "What video formats will I receive?", answer: "List only the real export formats and resolutions supported by the current product." },
        { question: "How many revisions do I get?", answer: "Use the actual plan and generation workflow. Do not invent revision counts." },
        { question: "Can I make memes about real people?", answer: "Only with appropriate rights and context. Do not fabricate their speech, actions, endorsements, or humiliating behavior." },
        { question: "Can I use the result commercially?", answer: "State only the commercial-use rights supported by the actual myDreamshoots terms and plan." }
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
      imageNote: "A product video should answer the buyer's question before it asks for the sale.",
      image: image(
        `${productImageRoot}/ai-product-video-serum-texture-use.jpg`,
        "Hand using a dropper above an amber skincare serum bottle to show product texture and packaging",
        5184,
        3456
      ),
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
        `${productAdImageRoot}/ai-product-ad-video-new-product-unboxing-creative.jpg`,
        "Adult opening a delivered product package in warm light for a new-product ad creative concept",
        5184,
        3456
      )
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
          question: "Should I add VideoObject structured data?",
          answer: "Only when the live landing page contains a real, accessible video that meets Google's structured-data requirements. Do not mark a static ad mockup as a video."
        },
        {
          question: "Can I use the result commercially?",
          answer: "Only state commercial rights supported by the actual myDreamshoots plan and current terms."
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
      eyebrow: "SEARCH INTENT MATCH",
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
      eyebrow: "RESPONSIBLE / E-E-A-T",
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

export const aiVideoTopicLandingKeys = Object.keys(aiVideoTopicLandingContentByKey);
