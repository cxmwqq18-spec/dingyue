// AIVideosUGC document-style blog articles — 2026-11-22.
// Two owner-provided pages published as blog articles on site_aidreamcapes:
// the AIVideosUGC launch press release and the company knowledge base. Body
// copy follows the source documents; only the site header, footer and route
// chrome come from the storefront shell.
//
// Covers are the two owner-provided posters, provisioned as responsive webp
// files under /assets/sites/site_aidreamcapes/blog/.

export const APPLY_DATE = "2026-11-22";
export const APPLY_DATETIME = "2026-11-22T00:00:00Z";

const COVER_DIR = "/assets/sites/site_aidreamcapes/blog";

const LAUNCH_COVER = {
  alt: "A creator in a cream sweater holds a pink serum bottle beside a product photo and a styled beauty table, under the AIVideosUGC wordmark.",
  src: `${COVER_DIR}/aivideosugc-launches-ai-ugc-video-generator-cover-640.webp`,
  width: 640,
  height: 1137
};

const KNOWLEDGE_COVER = {
  alt: "A smiling creator presents a pink serum bottle in a warm beauty setting, with the product photo and a violet backdrop under the AIVideosUGC wordmark.",
  src: `${COVER_DIR}/aivideosugc-company-knowledge-base-cover-640.webp`,
  width: 640,
  height: 1137
};

const FOOTER_NOTE = "AIVideosUGC is a brand of BLYDEYUS INC. Pricing, credit rules, and promotions are as published on the official website and are subject to change; refer to the pricing page for the latest terms.";

// /blog hub copy stores its counts as tokens; the index renders them from the
// live article list, so adding a card never leaves the page claiming an old
// number. Cards carry `kind`, and only `tutorial` cards count as tutorials.
export const BLOG_HUB_COPY = {
  eyebrow: "Workspace Tutorials, Product News & Company Reference · {articleCount} Articles",
  lead: "The workspace turns product photos into video ads, photo sets and launch clips. {tutorialCount} tutorials teach the workflows with real examples, real prompts, and the checks that keep them honest — alongside product news and the company reference."
};

// The six existing guide cards are tutorials. Company news and reference
// pages added later intentionally do not raise the tutorial count.
export const BLOG_TUTORIAL_HREFS = [
  "/blog/ai-product-photography-guide",
  "/blog/ai-ugc-video-ads-guide",
  "/blog/ai-video-review-checklist",
  "/blog/unboxing-videos-for-launches",
  "/blog/model-photos-without-a-photoshoot",
  "/blog/from-product-link-to-finished-ad"
];

export const ARTICLES = [
  {
    id: "aidreamcapes_v2_blog_aivideosugc_launches_ai_ugc_video_generator",
    slug: "/blog/aivideosugc-launches-ai-ugc-video-generator",
    pageType: "article",
    title: "AIVideosUGC Launches AI UGC Video Generator | Press Release",
    seoTitle: "AIVideosUGC Launches AI UGC Video Generator | Press Release",
    seoDescription: "AIVideosUGC launches an AI UGC video and image ad generator: turn a product link, image, or prompt into a UGC video in minutes.",
    keywords: "AIVideosUGC launch, AI UGC video generator, press release, BLYDEYUS INC, product link to video, AI actors",
    minutes: 4,
    cover: LAUNCH_COVER,
    card: {
      href: "/blog/aivideosugc-launches-ai-ugc-video-generator",
      kind: "news",
      image: LAUNCH_COVER,
      title: "AIVideosUGC Launches AI UGC Video Generator",
      minutes: 4,
      summary: "Turn a product link, an image, or a prompt into a UGC video in minutes — no camera crew, no actors, no subscription."
    },
    data: {
      variant: "press",
      kicker: "Press Release",
      h1: "AIVideosUGC Launches AI UGC Video Generator: Turn a Product Link, Image, or Prompt Into a Video in Minutes",
      byline: "BLYDEYUS INC · Official Announcement",
      lead: "BLYDEYUS INC has announced that [AIVideosUGC](/), its AI UGC video and image ad generation platform, is now available to ecommerce brands, marketing teams, and content creators. The core promise is simple: **input a product URL, an image, or a text prompt and receive HD, watermark-free, creator-style video in minutes — with no camera crew, no human actors, no editing software, and no subscription.**",
      sections: [
        {
          h2: "From product link to finished ad, in minutes",
          blocks: [
            {
              kind: "p",
              text: "AIVideosUGC does not require users to learn prompt engineering first. **URL to Video** turns a product page directly into an ad or demo video. **Image to Video** starts from a single product photo and adds a scene description to generate motion content. **Text to Video** converts a creative brief into an editable storyboard, then generates the selected shots."
            },
            {
              kind: "p",
              text: "On top of these inputs, **Video Ads Generator** handles the script, presenter, voice, and cut, delivering a finished ad ready to run. **Product Video Generator** delivers product video in minutes at a fraction of the cost of a traditional shoot day. **AI Video Generator** lets users choose scenes, compare shot versions, and assemble video for product pages or social channels."
            }
          ]
        },
        {
          h2: "AI actors — without the corporate stock-photo look",
          blocks: [
            {
              kind: "p",
              text: "The platform offers three presenter options. **AI Actor** lets users pick an avatar and pair it with a script and voiceover to generate UGC-style talking-head video, with no cameras, casting, or studios required. **AI Twin** creates a digital clone that looks, speaks, and moves like the user, suited to personal brands and founder-led content. **AI Presenter** covers product explanations, feature demos, and social content."
            },
            {
              kind: "p",
              text: "The goal is not to replace UGC with polished studio production, but to preserve the fast hook, conversational delivery, product proof, and clear call to action that make creator video work."
            }
          ]
        },
        {
          h2: "No subscription. Usage-based credits. Failed jobs refunded.",
          blocks: [
            {
              kind: "p",
              text: "AIVideosUGC does not require a monthly subscription. It uses a **buy once, delivered monthly** credit model: users purchase a 1-, 6-, or 12-month package, pay once, and receive credits monthly. The Starter plan is **$24/month** (200 credits), Pro is **$59/month** (500 credits), and Studio is **$129/month** (1,200 credits)."
            },
            {
              kind: "p",
              text: "**A 15-second video consumes 20 credits, a 30-second video consumes 40 credits, and a single product photo consumes 1 credit. Up to 7 reference photos can be added.** If a job fails, reserved credits return to the balance automatically — no support ticket required."
            },
            {
              kind: "p",
              text: "New users get a free trial and a one-time **$1** first product video. Creators who post with **#AIVideosUGC** can also earn free credits."
            }
          ]
        },
        {
          h2: "Who it is for",
          blocks: [
            {
              kind: "p",
              text: "AIVideosUGC currently serves ecommerce and D2C brands, dropshippers, small businesses, marketers and agencies, content creators, and app and SaaS teams. For stores testing new ads every week, it lowers the cost of each creative experiment. For small businesses on tight budgets, it removes the need for an expensive shoot to produce a product explainer. For agencies, it takes “waiting on assets” off the critical path of the media plan."
            }
          ]
        },
        {
          h2: "AI UGC video should start with a link, not a six-month pilot",
          blocks: [
            {
              kind: "p",
              text: "Producing a UGC-style product video has traditionally meant booking a shoot, casting a creator, and waiting on editing. AIVideosUGC compresses that into opening a link, uploading an image, or writing a sentence. For teams that need to ship more creative, test faster, and spend less on production, that is the difference between a campaign that waits on assets and one that ships on schedule."
            }
          ]
        }
      ],
      facts: [
        "**Website:** [https://www.aivideosugc.com/](/)",
        "**Free trial and $1 first video:** [https://www.aivideosugc.com/app/create/starter-offer](/app/create/starter-offer)",
        "**Pricing:** [https://www.aivideosugc.com/pricing](/pricing)",
        "**AI actors:** [https://www.aivideosugc.com/ai-actors](/ai-actors)"
      ],
      contacts: [
        "**Media and partnerships:** business@aivideosugc.com",
        "**Support:** support@aivideosugc.com"
      ],
      footerNote: FOOTER_NOTE
    }
  },
  {
    id: "aidreamcapes_v2_blog_aivideosugc_company_knowledge_base",
    slug: "/blog/aivideosugc-company-knowledge-base",
    pageType: "article",
    title: "AIVideosUGC — Company Knowledge Base | BLYDEYUS INC",
    seoTitle: "AIVideosUGC — Company Knowledge Base | BLYDEYUS INC",
    seoDescription: "Official company knowledge base for AIVideosUGC, an AI UGC video and image ad generator by BLYDEYUS INC.",
    keywords: "AIVideosUGC company, BLYDEYUS INC, company knowledge base, AI UGC video, AI actors, pricing, support contacts",
    minutes: 6,
    cover: KNOWLEDGE_COVER,
    card: {
      href: "/blog/aivideosugc-company-knowledge-base",
      kind: "reference",
      image: KNOWLEDGE_COVER,
      title: "AIVideosUGC — Company Knowledge Base",
      minutes: 6,
      summary: "The official reference for the company, product, team contacts, pricing, credit rules, core solutions and target users."
    },
    data: {
      variant: "knowledge",
      h1: "AIVideosUGC — Company Knowledge Base",
      byline: "BLYDEYUS INC · Official Reference",
      sections: [
        {
          h2: "Company Overview",
          blocks: [
            {
              kind: "p",
              text: "AIVideosUGC is an AI UGC video and image ad generator by BLYDEYUS INC. It turns a product URL, a product image, or a text prompt into creator-style short video ads in minutes — without a camera crew, human actors, a studio, or editing software. Output is HD and watermark-free, with no forced subscription."
            },
            {
              kind: "facts",
              items: [
                "**Company:** BLYDEYUS INC (also known as BLYDEY INC, BLYDEY)",
                "**Brand:** AIVideosUGC",
                "**Website:** [https://www.aivideosugc.com/](/)",
                "**CEO:** Naruebet Nakphong",
                "**Contact:** ceo_naruebet@aivideosugc.com",
                "**CTO:** Jim Doepker",
                "**Support:** cto_doepker@aivideosugc.com",
                "**Industry:** Software company; also in affiliate marketing services, business development services, software vendor, and video production services."
              ]
            },
            {
              kind: "p",
              text: "AIVideosUGC is an AI UGC video generation platform that converts a product link, image, or text into creator-style product ad videos within minutes, supports AI actors and digital twins, and bills by credits with no subscription, starting at $24 per month."
            }
          ]
        },
        {
          h2: "Website and Brand",
          blocks: [
            {
              kind: "list",
              items: [
                "**Website title:** AI UGC Video and Image Ads Generator",
                "**Website description:** Turn a product URL, image, or prompt into a UGC video in minutes with AIVideosUGC, actors and templates. Free trial; first video $1; HD, no watermark, no subscription.",
                "**Website tags:** AI Video Tools, AI UGC Video, UGC Video Generator, Make UGC Video, UGC Video Tools, TikTok AI Video, YouTube AI Video, Instagram AI Video, AI UGC Shorts, AI UGC image"
              ]
            }
          ]
        },
        {
          h2: "Team and Contacts",
          blocks: [
            {
              kind: "list",
              items: [
                "**CEO:** Naruebet Nakphong",
                "**CTO:** Jim Doepker",
                "**Support:** support@aivideosugc.com",
                "**Team members listed:** LaMarcus Chatman, Michael Maynard, Lewis Jones, Jim Michael",
                "**Partner Program:** business@aivideosugc.com"
              ]
            }
          ]
        },
        {
          h2: "Official Links",
          blocks: [
            {
              kind: "list",
              items: [
                "About the team: [https://www.aivideosugc.com/about-us](/about-us)",
                "Trust and safety: [https://www.aivideosugc.com/trust-and-safety](/trust-and-safety)",
                "Refund policy: [https://www.aivideosugc.com/refunds](/refunds)",
                "Solutions: [https://www.aivideosugc.com/ai-video-generation](/ai-video-generation)",
                "AI actors: [https://www.aivideosugc.com/ai-actors](/ai-actors)",
                "Guides: [https://www.aivideosugc.com/guides](/guides)",
                "Templates: [https://www.aivideosugc.com/templates](/templates)",
                "Pricing: [https://www.aivideosugc.com/pricing](/pricing)"
              ]
            }
          ]
        },
        {
          h2: "Core Solutions",
          blocks: [
            {
              kind: "table",
              head: ["Solution", "Description"],
              rows: [
                ["**URL to Video**", "Turn a product URL into an AI video for ads, social media, and product demonstrations. Upload photos, choose a creative direction, and create a product video without arranging a shoot."],
                ["**Image to Video**", "Create AI videos from a single product photo. Add a description to guide the scene and movement, then generate product video for ads, social posts, and launches without a camera crew."],
                ["**Text to Video**", "Turn a written idea into an AI video. Describe the product, audience, and key message, then refine an editable storyboard before generating the shots for the campaign."],
                ["**Product Video Generator**", "Start from a link or a photo and skip the studio and the crew. Get a product video in a few minutes for far less than a shoot day."],
                ["**Video Ads Generator**", "Build the script, presenter, voice, and cut. Begin with a product link or a short prompt. No creators, no shoots, no editing software. Output is a finished ad ready to run."],
                ["**AI Video Generator**", "Create product videos with AI presenters. Choose a scene, refine the brief, compare shot versions, and assemble video for product pages or social channels."]
              ]
            }
          ]
        },
        {
          h2: "AI Actors and Digital Humans",
          blocks: [
            {
              kind: "table",
              head: ["Option", "Description"],
              rows: [
                ["**AI Actor**", "Add a script, choose an avatar, and generate. Pair lifelike AI actors with a script and voiceover to produce UGC ads without creators — no cameras, casting, or studios required."],
                ["**AI Twin**", "Instantly create lifelike AI twins that look, speak, and move like the user. Generate unlimited professional talking videos using the digital twin — paste the script and publish."],
                ["**AI Presenter**", "AI Presenter/Explain helps marketers and brands produce professional avatar videos for ads, product explainers, and social media in minutes. Add the script, choose an avatar, and go live."]
              ]
            }
          ]
        },
        {
          h2: "Pricing",
          blocks: [
            { kind: "h3", text: "Promotions" },
            {
              kind: "list",
              items: [
                "**Free credits via #AIVideosUGC:** post a video with the hashtag to get free credits for creators. Submit at [https://www.aivideosugc.com/partners#free-credits](/partners#free-credits)",
                "**First video offer:** a one-time starter offer on the first product video for just $1. Offer page: [https://www.aivideosugc.com/app/create/starter-offer](/app/create/starter-offer)"
              ]
            },
            { kind: "h3", text: "Pricing Model" },
            {
              kind: "p",
              text: "**Top up any time: Pay Once, Create All Month — No subscription.** Buy a credit package for one, six, or twelve months — one payment, credits delivered monthly. The bigger the package and the longer its term, the deeper the pack discount."
            },
            { kind: "h3", text: "Plans" },
            {
              kind: "table",
              head: ["Plan", "Price", "Credits / Month", "Best For"],
              rows: [
                ["**Starter**", "**$24/month**", "200", "Trying video ads and product photos"],
                ["**Pro**", "**$59/month**", "500", "Stores testing new ads every week"],
                ["**Studio**", "**$129/month**", "1,200", "Brands and agencies with many products"]
              ]
            },
            { kind: "h3", text: "Credit Rules" },
            {
              kind: "list",
              items: [
                "One product photo uses 1 credit. A 15-second video uses 20 credits, and a 30-second video uses 40 credits. Up to 7 reference photos can be added. The amount appears before the job is confirmed.",
                "A job reserves its credits while it runs and charges them when the file is ready. When a job fails, the reserved credits return to the balance automatically — no support ticket required."
              ]
            }
          ]
        },
        {
          h2: "Target Users",
          blocks: [
            {
              kind: "table",
              head: ["User Type", "Description"],
              rows: [
                ["**Ecommerce and D2C brands**", "Create product-focused ads without arranging a traditional shoot. Prepare creative variations, review generated details, and test content in owned campaigns."],
                ["**Dropshippers**", "Prepare product-video drafts without arranging a creator shoot. Compare creative directions, generate the chosen versions, and review results before launch."],
                ["**Small businesses**", "Explain what they sell with an AI actor video, without an expensive shoot or an agency. Stay visible even on a small budget."],
                ["**Marketers and agencies**", "Make fresh ads every day, test faster, and spend less on production. Stay on the media plan while the files get made."],
                ["**Content creators**", "Create presenter-led product videos from their own photos and scripts. Save drafts, refine the storyboard, and review the result before posting."],
                ["**App and SaaS teams**", "Explain the product, show one real use case, and ask for the signup with a creator-style video. No heavy shoot required."]
              ]
            }
          ]
        }
      ],
      footerNote: FOOTER_NOTE
    }
  }
];
