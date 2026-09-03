export const MYDREAMSHOOTS_P0_COPY_REPLACEMENTS = [
  {
    slug: "brand-video",
    oldText: "Do not assume a dedicated brand-kit feature unless the product team confirms one exists.",
    newText: "Use only the brand-kit or brand-asset controls that are available in the current myDreamshoots workflow."
  },
  {
    slug: "fashion-video",
    oldText: "The public video directory supports verified video creation paths. This page must stay precise about what is generated and what still requires product confirmation.",
    newText: "Use the current myDreamshoots workflow to confirm supported inputs and review the generated fashion video before publishing."
  },
  {
    slug: "fashion-video",
    oldText: "No claim should be made that this page provides virtual try-on, garment transfer, size prediction, or fit simulation unless those capabilities are verified in the live product. The safe public claim is fashion-oriented visual generation through verified Text to Video and Image to Video paths.",
    newText: "Fashion Video creates fashion-oriented visual content through the supported Text to Video and Image to Video paths. It does not provide virtual try-on, garment transfer, size prediction, or fit simulation."
  },
  {
    slug: "food-video",
    oldText: "The public video directory supports verified video creation paths. This page must stay precise about what is generated and what still requires qualified verification.",
    newText: "Use the current myDreamshoots workflow to confirm supported inputs and review food, packaging, and prop continuity before publishing."
  },
  {
    slug: "music-video",
    oldText: "The public video directory supports verified video creation paths. This page must stay precise about what happens in the product and what belongs in a separate rights-cleared edit.",
    newText: "Use the current myDreamshoots workflow to generate and review music-video visuals; add audio only when you have the necessary rights."
  },
  {
    slug: "pet-video",
    oldText: "The public video directory supports verified video creation paths. This page must stay precise about what is generated and what still requires qualified verification.",
    newText: "Use the current myDreamshoots workflow to confirm supported inputs and review animal identity, anatomy, props, and continuity before publishing."
  },
  {
    slug: "talking-photo",
    oldText: "The live page must describe the real storage, retention, processing, and deletion behavior. Do not invent a privacy promise.",
    newText: "Review myDreamshoots' current storage, retention, processing, and deletion details before uploading a private photo or sharing a generated result."
  },
  {
    slug: "youtube-video",
    oldText: "There is no universal perfect length. The video should be as long as the subject needs and as structured as the audience requires. The live page should only promise durations the actual product supports.",
    newText: "There is no universal perfect length. Make the video as long as the subject needs and structure it around what the audience needs to understand. Review the current product options before promising a specific duration."
  },
  {
    slug: "promo-video",
    oldText: "The current video workspace is the verified creation path. This page does not claim a separate Promo-only generator or unverified campaign controls.",
    newText: "Use the current myDreamshoots video workspace for promo-video creation; the available controls and campaign options are shown there."
  },
  {
    slug: "ugc-ad-video",
    oldText: "The current video workspace is the verified creation path. This page does not claim a separate UGC-only generator or unverified creator controls.",
    newText: "Use the current myDreamshoots video workspace for UGC-style ad creation; the available creator and campaign controls are shown there."
  },
  {
    slug: "ugc-ad-video",
    oldText: "This page focuses on creator voice, speaker identity, conversational message design, product-in-context proof, and UGC-specific trust boundaries. A general video ad page should cover the broader paid-video job instead.",
    newText: "UGC Ad Video focuses on creator voice, speaker identity, conversational message design, product-in-context proof, and UGC-specific trust boundaries. Use Video Ad when the broader paid-video job is the priority."
  },
  {
    slug: "tiktok-video",
    oldText: "A useful TikTok page should not pretend every post follows the same recipe. A micro-lesson, a product proof clip, and a storytime opener need different hooks, pacing, and visual evidence.",
    newText: "A useful TikTok video should not follow one recipe for every post. A micro-lesson, a product proof clip, and a storytime opener need different hooks, pacing, and visual evidence."
  },
  {
    slug: "video-ad",
    oldText: "The current workflow should stay transparent about what the user provides, what the campaign objective is, when credits are used, and where the finished output is reviewed.",
    newText: "Before generating, confirm what you provide, the campaign objective, when credits are used, and where the finished output is reviewed."
  }
];

export const MYDREAMSHOOTS_P0_COPY_SLUGS = [...new Set(MYDREAMSHOOTS_P0_COPY_REPLACEMENTS.map((item) => item.slug))];
