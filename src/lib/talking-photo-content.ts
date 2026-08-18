export type TalkingPhotoImage = {
  src: string;
  alt: string;
  objectPosition?: string;
};

export type TalkingPhotoUseCase = {
  title: string;
  problem: string;
  body: string;
  script: string;
  cta: string;
  image: TalkingPhotoImage;
};

export type TalkingPhotoGuidanceGroup = {
  title: string;
  intro?: string;
  items?: string[];
  exampleTitle?: string;
  exampleBody?: string;
};

export type TalkingPhotoFaq = {
  question: string;
  answer: string;
};

export type TalkingPhotoContent = {
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
    rightsCopy: string;
    caption: string;
    availabilityNote: string;
    image: TalkingPhotoImage;
  };
  useCases: {
    eyebrow: string;
    title: string;
    intro: string;
    items: TalkingPhotoUseCase[];
  };
  sourcePhoto: {
    eyebrow: string;
    title: string;
    intro: string;
    useTitle: string;
    useItems: string[];
    avoidTitle: string;
    avoidItems: string[];
    expertTip: string;
  };
  script: {
    eyebrow: string;
    title: string;
    intro: string;
    rules: Array<{
      title: string;
      body: string;
      exampleTitle?: string;
      exampleBody?: string;
    }>;
  };
  steps: {
    eyebrow: string;
    title: string;
    items: Array<{ title: string; body: string }>;
    cta: string;
  };
  value: {
    eyebrow: string;
    title: string;
    items: Array<{ title: string; body: string }>;
  };
  trust: {
    eyebrow: string;
    title: string;
    body: string;
    items: Array<{ title: string; body: string }>;
  };
  faq: {
    eyebrow: string;
    title: string;
    items: TalkingPhotoFaq[];
  };
  finalCta: {
    eyebrow: string;
    title: string;
    body: string;
    cta: string;
    microcopy: string;
  };
};

const imageRoot = "/assets/dreamshoot/talking-photo";

export const talkingPhotoContent: TalkingPhotoContent = {
  seo: {
    title: "AI Talking Photo Generator – Make a Photo Talk | myDreamshoots",
    description:
      "Make a photo talk from one clear portrait and a short script. Create talking-photo videos for birthday wishes, personal messages, explainers, social intros, product pitches, and holiday greetings.",
    keywords:
      "AI talking photo generator, make a photo talk, talking photo AI, photo talking video, talking picture generator, speaking photo generator, animate a photo to talk, talking portrait",
    canonicalPath: "/ai-video-generation/talking-photo"
  },
  hero: {
    eyebrow: "AI TALKING PHOTO GENERATOR",
    title: "Make a Photo Talk Without Recording Another Take",
    body:
      "Need a face-to-camera message but do not want to set up a camera, repeat takes, or record the same line again? Explore how one clear portrait and a focused message can support a talking-photo workflow, then open the current video workspace to see the available creation tools.",
    primaryCta: "Make My Photo Talk",
    secondaryCta: "See Real Use Cases",
    rightsCopy: "Use a photo you own or have permission to animate. Review the full result before publishing.",
    caption: "One clear portrait + one focused message -> a talking-photo clip you can review.",
    availabilityNote:
      "Talking Photo is currently presented as a customer-first workflow guide. The button opens the existing video workspace; available generation options may vary.",
    image: {
      src: `${imageRoot}/ai-talking-photo-older-woman-portrait.png`,
      alt: "Older woman smiling at the camera in a clear portrait for a talking-photo video"
    }
  },
  useCases: {
    eyebrow: "WHAT DO YOU NEED THE PHOTO TO SAY?",
    title: "Six Real Reasons to Make a Photo Talk",
    intro:
      "Start with the message you need to deliver. A talking photo is useful when the face matters, but a new recording session does not.",
    items: [
      {
        title: "Send a Birthday Message That Feels More Personal Than a Text",
        problem: "Cannot record a birthday video today, or the person you want on screen is not available to film?",
        body:
          "Start with a clear portrait and write one short birthday message. Use the person's name, add one specific wish, and keep the script short enough to sound like something you would actually say.",
        script: "Happy birthday, Mia. I hope today feels easy, joyful, and full of the people you love.",
        cta: "Create a Birthday Greeting",
        image: {
          src: `${imageRoot}/talking-photo-birthday-greeting-woman-cake.png`,
          alt: "Woman holding a birthday cake for a personalized talking-photo greeting"
        }
      },
      {
        title: "Turn One Portrait Into a Short Personal Message",
        problem: "Need to say thank you, congratulations, or I am thinking of you, but do not want to record on camera?",
        body:
          "Use a familiar portrait for a focused thank-you, congratulations, family update, or personal note. One clear idea usually feels more believable than a long speech.",
        script: "Thank you for being there when I needed it. I will not forget what you did for me.",
        cta: "Create a Personal Message",
        image: {
          src: `${imageRoot}/talking-photo-personal-message-older-man.png`,
          alt: "Older man looking at the camera for a personal talking-photo message"
        }
      },
      {
        title: "Give a Lesson a Human Opening Without Recording It Again",
        problem: "Need a presenter-style introduction for a lesson, but do not want to re-record the same opening for every module?",
        body:
          "Use a clear instructor portrait and a one- or two-sentence script that tells learners exactly what they are about to understand. Keep the explanation concrete and move the detailed teaching into the lesson itself.",
        script: "In the next minute, I will show you why compound interest rewards time more than timing.",
        cta: "Create an Explainer Intro",
        image: {
          src: `${imageRoot}/talking-photo-education-explainer-teacher.png`,
          alt: "Teacher presenting in front of a chalkboard for a talking-photo explainer"
        }
      },
      {
        title: "Test More Social Hooks Without Repeating the Same Take",
        problem: "Need several face-to-camera hooks for short-form content, but do not want to record every variation?",
        body:
          "Turn one clear creator portrait into short introductions, series openers, pinned profile messages, or first-line hooks. Write the first sentence for retention: give the viewer one reason to keep watching.",
        script: "If viewers keep leaving in the first three seconds, change the opening, not the whole video.",
        cta: "Create a Social Intro",
        image: {
          src: `${imageRoot}/talking-photo-social-video-creator.png`,
          alt: "Content creator speaking toward the camera in a studio for a social video intro"
        }
      },
      {
        title: "Introduce the Product With a Face and One Clear Benefit",
        problem: "Need a human product introduction, but a new spokesperson shoot would slow down the launch?",
        body:
          "Use an authorized spokesperson portrait for a short product intro. Name the product, the problem it solves, and the single benefit the viewer should remember. Avoid vague superlatives and unsupported claims.",
        script: "This serum is designed for lightweight hydration that layers cleanly under makeup.",
        cta: "Create a Product Intro",
        image: {
          src: `${imageRoot}/talking-photo-product-intro-spokesperson.png`,
          alt: "Spokesperson holding a skincare bottle for a talking-photo product introduction"
        }
      },
      {
        title: "Create a Seasonal Greeting Without Organizing Another Shoot",
        problem: "Need a Christmas, New Year, or seasonal greeting at short notice?",
        body:
          "Use a warm portrait and a short message that sounds like a real greeting rather than an ad. Mention the holiday, wish the audience something specific, and stop before it turns into campaign copy.",
        script: "Wishing you a warm Christmas, a quiet break, and a fresh start for the year ahead.",
        cta: "Create a Holiday Greeting",
        image: {
          src: `${imageRoot}/talking-photo-holiday-greeting-woman-gift.png`,
          alt: "Woman holding a wrapped Christmas gift for a holiday talking-photo greeting"
        }
      }
    ]
  },
  sourcePhoto: {
    eyebrow: "START WITH A PHOTO THE MODEL CAN READ",
    title: "A Better Source Photo Gives the Talking Face More to Work With",
    intro:
      "You do not need a studio headshot. You do need enough facial information for the model to animate the eyes, mouth, and head without guessing.",
    useTitle: "Use a photo with",
    useItems: [
      "One clearly visible face",
      "Front-facing or a gentle three-quarter angle",
      "Eyes and mouth unobstructed",
      "Even lighting across the face",
      "Enough resolution to see facial details",
      "Shoulders or upper torso visible when possible",
      "A background that does not compete with the face"
    ],
    avoidTitle: "Avoid using",
    avoidItems: [
      "Heavy motion blur",
      "Very small faces inside a group photo",
      "Sunglasses covering the eyes",
      "Hair, hands, or objects covering the mouth",
      "Extreme side profiles",
      "Aggressive beauty filters that change facial structure",
      "Screenshots compressed several times"
    ],
    expertTip:
      "If the mouth or eyes are unclear in the source photo, a longer script will not fix the result. Start with a better portrait first."
  },
  script: {
    eyebrow: "WRITE FOR A VOICE, NOT A WEB PAGE",
    title: "Talking-Photo Scripts Sound Better When They Read Like Speech",
    intro:
      "The most common writing mistake is pasting polished marketing copy into a speaking face. Spoken sentences need fewer clauses, clearer pauses, and one destination.",
    rules: [
      {
        title: "Keep one idea per sentence",
        body: "Short sentences are easier to review and usually sound more natural than one dense paragraph.",
        exampleTitle: "Too dense",
        exampleBody:
          "Our platform helps teams create content faster while improving consistency and reducing production costs across every campaign."
      },
      {
        title: "Put the important noun early",
        body: "Make the subject and the useful point clear before the listener has to wait for the sentence to resolve.",
        exampleTitle: "Better for speech",
        exampleBody: "Our batch-generation feature lets you test several versions at once."
      },
      {
        title: "Use punctuation to create rhythm",
        body:
          "Use commas for short pauses and periods when the thought is complete. Do not force one long paragraph into one breath."
      },
      {
        title: "Make the first line immediately useful",
        body:
          "Avoid an empty welcome unless the audience already knows why they should stay. Start with the problem, promise, or next idea."
      },
      {
        title: "Read the script aloud once",
        body:
          "If you run out of breath or lose the point while reading it, shorten the sentence before generating."
      }
    ]
  },
  steps: {
    eyebrow: "FROM STILL PORTRAIT TO SPEAKING CLIP",
    title: "Four Steps. No Camera Retake.",
    items: [
      {
        title: "Upload a clear portrait",
        body: "Choose a photo where one face is easy to see and the mouth is unobstructed."
      },
      {
        title: "Add the words",
        body: "Type the exact message you want the person to deliver."
      },
      {
        title: "Generate the talking video",
        body: "The system turns the still portrait into a speaking clip using the available generation settings."
      },
      {
        title: "Review before sharing",
        body:
          "Watch the entire clip. Check the face, mouth movement, pronunciation, pacing, names, numbers, and whether the final message could be mistaken for a real recording."
      }
    ],
    cta: "Create My Talking Photo"
  },
  value: {
    eyebrow: "WHEN A NEW SHOOT IS THE SLOW PART",
    title: "Keep the Face. Change the Message. Skip the Re-Record.",
    items: [
      {
        title: "No reshoot for every short message",
        body: "Change the script instead of rebuilding the whole camera setup."
      },
      {
        title: "Keep a recognizable presenter",
        body:
          "Useful for recurring intros, authorized founder messages, explainers, and series where a consistent face helps the audience know who is speaking."
      },
      {
        title: "Test several openings",
        body: "Compare multiple hooks or short message angles before investing in a larger production."
      },
      {
        title: "Give one strong portrait more jobs",
        body:
          "A clear, authorized portrait can support greetings, explainers, product intros, and short social messages instead of remaining a static image."
      }
    ]
  },
  trust: {
    eyebrow: "CREATE IT RESPONSIBLY",
    title: "A Talking Photo Should Be Easy to Make—and Clear About What It Is",
    body:
      "Do not use synthetic video to make a real person appear to endorse, confess, promise, or say something they did not actually say. Use talking-photo generation for authorized creative work and review every final clip in context.",
    items: [
      {
        title: "Photo permission",
        body: "You own the portrait or have permission to animate it."
      },
      {
        title: "Message accuracy",
        body: "Names, dates, prices, product claims, and instructions are correct."
      },
      {
        title: "Face quality",
        body: "Watch the full clip rather than approving one still frame."
      },
      {
        title: "Voice rights",
        body: "Do not imitate or reuse another person's voice without the necessary permission."
      },
      {
        title: "Disclosure context",
        body:
          "When viewers could reasonably mistake the clip for an authentic recording, give appropriate context that it is AI-generated."
      }
    ]
  },
  faq: {
    eyebrow: "QUESTIONS BEFORE YOU START",
    title: "Talking Photo Questions, Answered",
    items: [
      {
        question: "What is an AI talking photo generator?",
        answer:
          "An AI talking photo generator turns a still portrait into a synthetic speaking video using a supplied script and the generation options available in the product."
      },
      {
        question: "What kind of photo works best?",
        answer:
          "Use one clear, well-lit face with the eyes and mouth visible. A front-facing or slight three-quarter portrait usually gives the model more usable facial information than a side profile or group photo."
      },
      {
        question: "Can I use a selfie?",
        answer:
          "Yes, when the selfie is sharp, evenly lit, and not heavily filtered. Avoid extremely close wide-angle selfies that distort facial proportions."
      },
      {
        question: "Can I make someone else's photo talk?",
        answer:
          "Only use a photo you own or have permission to animate. Do not use the feature to create deceptive statements or unauthorized endorsements."
      },
      {
        question: "Can I animate an older photo?",
        answer:
          "An older portrait can work when the face is large and clear enough. The generated result is synthetic and should not be presented as an authentic historical recording."
      },
      {
        question: "How long should my script be?",
        answer:
          "Start with one focused message. Short scripts are easier to review for pacing, pronunciation, and facial quality than dense multi-paragraph speeches."
      },
      {
        question: "What should I do if the result looks unnatural?",
        answer:
          "Try a clearer portrait, simplify the script, shorten complex phrases, check names or unusual pronunciations, and generate another version if the product supports it."
      },
      {
        question: "Can I use the result commercially?",
        answer:
          "The live page should state only the commercial permissions included in the actual myDreamshoots plan and current terms."
      },
      {
        question: "What happens to my uploaded photo?",
        answer:
          "The live page must describe the real storage, retention, processing, and deletion behavior. Do not invent a privacy promise."
      }
    ]
  },
  finalCta: {
    eyebrow: "READY TO HEAR THE PHOTO?",
    title: "Turn One Clear Portrait Into the Message You Need to Send",
    body:
      "Start with a face people recognize. Give it one useful thing to say. Then review the full result before you publish it.",
    cta: "Make My Photo Talk",
    microcopy: "Use only photos and voices you have the right to use."
  }
};
