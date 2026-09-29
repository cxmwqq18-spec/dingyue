function section(id, title, paragraphs) {
  return `<h2 id="${id}">${title}</h2>${paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join("")}`;
}

function list(items) {
  return `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}

function comparison(headers, rows) {
  return `<table><thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function faq(items) {
  return `<h2 id="faq">FAQ</h2>${items.map(([question, answer], index) => `<h3 id="faq-${index + 1}">${question}</h3><p>${answer}</p>`).join("")}`;
}

function body({ intro, sections, checklist, comparisonBlock, faqs, closing }) {
  return `<p>${intro}</p>${sections.map(({ id, title, paragraphs }) => section(id, title, paragraphs)).join("")}<h2 id="publishing-checklist">A practical publishing checklist</h2>${list(checklist)}<h2 id="choose-the-right-workflow">Choose the right workflow</h2>${comparisonBlock}${faq(faqs)}<p>${closing}</p>`;
}

const common = {
  author: "Aidreamcapes editorial team",
  readMinutes: "7"
};

export function aidreamcapesBlogArticles() {
  return [
    {
      ...common,
      slug: "/blog/ai-product-photography-guide",
      title: "AI Product Photography for Ecommerce",
      description: "Plan AI product photography for ecommerce with a clean source image, clear scene direction, review gates, and links to the right image workflow.",
      keywords: "AI product photography, ecommerce product photos, product image workflow, AI ecommerce images",
      imageAlt: "A product photo brief and source image prepared for an ecommerce workflow.",
      coverThemeHref: "/ai-image-generation/ecommerce-main-image",
      summary: "A practical workflow for turning an approved product reference into clear ecommerce images for product pages, ads, and campaigns.",
      entityName: "AI product photography workflow",
      userIntent: "Plan an ecommerce product photography workflow before creating or publishing AI images.",
      targetHref: "/ai-image-generation/ecommerce-main-image",
      targetLabel: "Open Ecommerce Main Image",
      primaryCta: "Start with a product image",
      primaryHref: "/ai-image-generation/ecommerce-main-image",
      relatedLinks: [
        ["/ai-image-generation/ecommerce-main-image", "Create an ecommerce main image"],
        ["/ai-image-generation/lifestyle-scene", "Explore lifestyle scenes"],
        ["/ai-image-generation/packaging-mockup", "Plan packaging mockups"]
      ],
      tags: "AI product photography|Ecommerce images|Product page workflow|Image review",
      body: body({
        intro: "AI product photography is most useful when the product reference, publishing job, and review standard are decided before generation. Start with an approved source image, describe only the scene you need, and keep a human check between the generated asset and the live product page. This approach helps a team create a consistent image set without allowing a polished background to change the product, packaging, included items, or claims. That sequence keeps creative decisions traceable.",
        sections: [
          { id: "photo-brief", title: "Start with the job the image must do", paragraphs: [
            "A product-page main image and a campaign image have different jobs. Write down the intended placement, crop, background, product angle, and must-show details before choosing a workflow. If the image will support a purchase decision, prioritize recognizability and readable product detail over an elaborate scene.",
            "Keep the brief tied to approved product information. Packaging text, dimensions, materials, colors, and included accessories should come from the product record. A generated image can arrange the scene, but it should not become the source of truth for what the item does or what comes in the box."
          ] },
          { id: "source-reference", title: "Prepare a source reference that gives the model less to guess", paragraphs: [
            "Use a sharp image with clean edges, a visible silhouette, and enough lighting to distinguish color and surface detail. Remove unrelated objects and avoid a crop that hides the feature you need to preserve. If scale matters, provide a second reference or a verified size cue rather than asking the scene to invent proportion.",
            "Permission is part of preparation. Use a product image, logo, person, or location only when your team has the right to use it. Save the approved source beside the brief so reviewers can compare the generated result with the input instead of relying on memory."
          ] },
          { id: "scene-direction", title: "Direct the scene without over-specifying the product", paragraphs: [
            "Describe the environment, light, camera distance, negative space, and intended mood in operational terms. For a lifestyle scene, explain where the product sits and what the viewer should understand. For a packaging mockup, explain which panels must remain readable and which parts are only presentation context.",
            "Avoid adding adjectives that imply unsupported performance. Words such as premium, durable, medical, certified, or safe can change what an image appears to promise. Let the approved product facts carry those claims, and use the visual brief to control composition and attention."
          ] },
          { id: "review-product", title: "Review the product before reviewing the polish", paragraphs: [
            "Watch for shape drift, changed color, missing parts, invented labels, altered logos, and reflections that hide a surface. Then check whether hands, props, shadows, or crops make the product harder to understand. A beautiful image is not ready if a shopper could infer the wrong size, finish, quantity, or use.",
            "Review the result at the size where it will be seen. Mobile thumbnails reveal contrast and crop problems that are easy to miss in an editor. Keep rejected outputs out of the publishing folder so an old draft cannot be selected by mistake."
          ] },
          { id: "build-an-image-set", title: "Build a small set with distinct roles", paragraphs: [
            "Use the <a href=\"/ai-image-generation/ecommerce-main-image\">Ecommerce Main Image</a> for the clearest product-first view, a <a href=\"/ai-image-generation/lifestyle-scene\">Lifestyle Scene</a> when context helps explain use, and a <a href=\"/ai-image-generation/packaging-mockup\">Packaging Mockup</a> when the package itself is part of the decision. Do not ask every asset to solve every question.",
            "Keep one approved reference and one fact sheet across the set. Consistency comes from repeating the product truth, not from making every frame look identical. Record which image answers which shopper question before sending the set to publishing."
          ] }
        ],
        checklist: [
          "The source image, product facts, and usage rights are approved.",
          "The crop and background match the page, ad, or campaign placement.",
          "Product shape, color, material cues, packaging, and included items remain accurate.",
          "Generated text, logos, claims, and decorative props have been checked or removed.",
          "The final image has been reviewed at mobile size and linked to the correct destination."
        ],
        comparisonBlock: comparison(["Need", "Best starting point", "Review priority"], [
          ["Clear product-first view", "Ecommerce Main Image", "Shape, color, crop, and recognizability"],
          ["Show use in context", "Lifestyle Scene", "Scale, setting, and implied claims"],
          ["Explain package presentation", "Packaging Mockup", "Panel text, proportions, and what is included"]
        ]),
        faqs: [
          ["What should I prepare before creating an AI product photo?", "Prepare an approved product reference, the details that must remain visible, the intended placement, and the facts reviewers will use to compare the result. Include permission for any person, logo, or source image in the brief."],
          ["Should the main product image include a lifestyle background?", "Use the clearest product-first view when the image must support identification or marketplace requirements. Add lifestyle context as a separate asset when the setting helps explain use without competing with the product."],
          ["How do I keep generated packaging text accurate?", "Treat packaging text as a fact that needs direct review. Compare the generated panel with the approved source, remove unreadable or invented text, and do not publish a mockup as proof of a label or certification."],
          ["What is the most important quality check?", "Check whether the generated image could make a shopper misunderstand the item. Shape, quantity, scale, color, included parts, and visible claims matter before lighting or decorative polish."],
          ["When should I use a separate image workflow?", "Use a separate workflow when the asset has a different job, such as explaining a feature, comparing variants, or showing a product in use. Distinct jobs make review criteria clearer and reduce overloaded briefs."]
        ],
        closing: "Use the Aidreamcapes image workflows to create the individual assets, but keep the product record and review decision outside the generated image. The final set should make the same product easier to understand at every point where a customer sees it."
      })
    },
    {
      ...common,
      slug: "/blog/ai-talking-photo-video-guide",
      title: "AI Talking Photo Video: Plan and Review Safely",
      description: "Plan an AI talking photo video with permission-safe portraits, a focused script, clear audio, captions, and a face-and-timing review before sharing.",
      keywords: "AI talking photo, talking portrait video, AI avatar video, talking photo safety",
      imageAlt: "A portrait frame prepared for a talking photo video review.",
      coverThemeHref: "/ai-video-generation/talking-photo-recs",
      summary: "A permission-safe planning guide for talking photo videos, including source portraits, scripts, audio, captions, and final review.",
      entityName: "AI talking photo video workflow",
      userIntent: "Plan a talking photo video from an approved portrait and review its face, voice, captions, and timing.",
      targetHref: "/ai-video-generation/talking-photo-recs",
      targetLabel: "Open Talking Photo Product Recs",
      primaryCta: "Try a talking photo",
      primaryHref: "/ai-video-generation/talking-photo-recs",
      relatedLinks: [
        ["/ai-video-generation/talking-photo-recs", "Create a talking photo recommendation"],
        ["/ai-video-generation/founder-update", "Explore presenter-led video"],
        ["/ai-video-generation/multilingual-video", "Plan a multilingual version"]
      ],
      tags: "AI talking photo|Talking portrait video|Synthetic media|Video review",
      body: body({
        intro: "A talking photo video uses a person’s likeness, so permission, context, and review belong in the workflow from the first upload. Choose an authorized portrait, write the exact script, check the voice and lip movement, and tell the audience enough about the generated media when misunderstanding is possible. The safest process separates what the source person approved from what the generated performance adds. That preparation makes the final clip easier to review and explain.",
        sections: [
          { id: "portrait-permission", title: "Start with a permission-safe portrait", paragraphs: [
            "Use a face you own or have permission to animate. Keep the permission record with the project and define the intended audience, channel, duration, and message. A portrait can be technically suitable and still be unsuitable for the planned use if the permission does not cover the message or placement.",
            "Choose a recent, front-facing image with readable eyes, mouth, hairline, and lighting. Avoid a crop where the mouth is hidden or a strong shadow changes the face. If the photo includes other people, private details, or a recognizable location, treat those elements as part of the rights review too."
          ] },
          { id: "talking-script", title: "Write the exact words before generating", paragraphs: [
            "Keep the script short enough to review line by line. Mark names, numbers, pronunciation, pauses, and the intended language. Short sentences make it easier to compare the audio, captions, lip timing, and meaning without losing track of a late edit.",
            "Do not write a script that makes the generated person appear to confess, endorse, report, or speak on a topic they did not approve. If a brand or organization is speaking, define who owns the message and how the viewer should understand the presenter."
          ] },
          { id: "talking-audio", title: "Treat audio and captions as first-class content", paragraphs: [
            "Review pronunciation, names, numbers, pauses, volume, background noise, and timing. Compare captions with the approved script rather than trusting automatic transcription. A clear face does not make an incorrect sentence acceptable.",
            "For a different language or audience, use the <a href=\"/ai-video-generation/multilingual-video\">Multilingual Video</a> workflow as a planning reference, then have a fluent reviewer check names, idioms, captions, and timing. Translation is a content change, not only an audio change."
          ] },
          { id: "talking-face-review", title: "Review identity and movement frame by frame", paragraphs: [
            "Watch for mouth shapes that do not match the audio, eye direction that changes unexpectedly, unstable hair or jewelry, skin-tone shifts, and face edges that break during movement. Pause at the beginning, end, and any sentence with a strong expression or turn.",
            "If the project needs a presenter-led message rather than an animated portrait, compare the result with the <a href=\"/ai-video-generation/founder-update\">Founder Update</a> workflow. Choose the format based on the communication job, not only on how easy the first generation looks."
          ] },
          { id: "talking-disclosure", title: "Decide what context the viewer needs", paragraphs: [
            "Disclosure should be clear enough for the audience and placement to understand when the media is generated or substantially altered. The exact wording depends on the channel and the situation, so keep the context honest and review it with the destination copy.",
            "Do not use a generated talking photo to make a real person appear to say something they did not authorize. Keep the approved portrait, permission, script, final export, and disclosure decision together so later edits remain traceable."
          ] }
        ],
        checklist: [
          "The portrait, voice, script, and intended use are authorized.",
          "Names, numbers, pronunciation, language, captions, and pauses match the approved script.",
          "Face, mouth, eyes, hair, skin tone, and framing remain stable through the clip.",
          "Disclosure and audience context do not imply an unapproved real-person statement.",
          "The final export and permission record are stored together with the review decision."
        ],
        comparisonBlock: comparison(["Need", "Workflow", "Primary review"], [
          ["Animate an approved portrait", "Talking Photo", "Likeness, permission, lip movement, and disclosure"],
          ["Present a direct-to-camera speaker", "Talking Head Video", "Identity, performance, framing, and message ownership"],
          ["Adapt the approved message for another language", "Multilingual Video", "Names, pronunciation, translation, captions, and timing"]
        ]),
        faqs: [
          ["Can I animate any portrait I find online?", "No. Use a portrait you own or have permission to animate for the intended use. Public availability is not the same as permission to create a speaking or endorsing likeness."],
          ["What makes a talking photo video ready to share?", "The source permission, script, audio, captions, face movement, disclosure, audience, and destination should all be reviewed. A technically smooth clip is not ready if its context or message is misleading."],
          ["How can I reduce lip-sync problems?", "Use a clear front-facing portrait, a focused script, and short sentences. Review the final audio and mouth movement together, especially around names, numbers, pauses, and translated words."],
          ["When should I use a talking head workflow instead?", "Use a talking head format when the communication needs a fuller presenter, direct-to-camera framing, or a different performance style. The choice should follow the message and permission available for the source."],
          ["Do I always need an AI disclosure?", "Review the expectations of the channel, audience, and applicable policy. Add clear context when viewers could reasonably mistake generated or substantially altered media for an unedited real statement or recording."]
        ],
        closing: "Aidreamcapes can help create the visual format, but permission and editorial responsibility stay with the publisher. Keep the workflow reviewable from source portrait to final share so the audience can understand what the video represents."
      })
    },
    {
      ...common,
      slug: "/blog/ecommerce-product-image-workflow",
      title: "Ecommerce Product Image Workflow",
      description: "Build an ecommerce product image workflow from an approved source to main image, lifestyle scene, feature graphic, and comparison asset with review gates.",
      keywords: "ecommerce product image workflow, product page images, AI product content, PDP image checklist",
      imageAlt: "An ecommerce product image workflow from source reference to approved gallery.",
      coverThemeHref: "/ai-image-generation/feature-infographic",
      summary: "Map the image set a product page needs, choose the right Aidreamcapes workflow for each asset, and review the complete set before publishing.",
      entityName: "Ecommerce product image workflow",
      userIntent: "Plan a complete ecommerce product image set from an approved product reference.",
      targetHref: "/ai-image-generation/ecommerce-main-image",
      targetLabel: "Open Ecommerce Main Image",
      primaryCta: "Plan a product image set",
      primaryHref: "/workflow",
      relatedLinks: [
        ["/ai-image-generation/ecommerce-main-image", "Create the main image"],
        ["/ai-image-generation/feature-infographic", "Add a feature infographic"],
        ["/ai-image-generation/comparison-chart", "Build a comparison chart"]
      ],
      tags: "Ecommerce workflow|Product page images|PDP optimization|Image planning",
      body: body({
        intro: "An ecommerce product page usually needs a set of images, not one oversized hero. Plan the questions the gallery must answer, assign each question to one asset, and use the same approved product reference across the set. This workflow keeps the main image clear, gives supporting images a distinct job, and creates review gates before the gallery reaches a PDP, marketplace listing, ad, or social campaign. It also keeps the gallery coherent from first click to checkout.",
        sections: [
          { id: "image-question-map", title: "Map shopper questions to image roles", paragraphs: [
            "Start with the decisions a shopper must make: what the item is, how it is used, what it includes, how large it is, which feature matters, and how variants compare. Do not create five versions of the same decorative scene when the page is missing a basic answer such as scale or included items.",
            "Write the role beside each planned asset. The role becomes the review criterion: a main image must identify the product, a feature graphic must explain only approved information, and a comparison chart must make the difference between options clear without changing their specifications."
          ] },
          { id: "single-source", title: "Keep one approved source of truth", paragraphs: [
            "Use one product reference and one fact sheet across the image set. Record colors, dimensions, materials, included items, variant names, and text that must remain exact. If the source changes, mark which outputs need review rather than quietly mixing old and new versions.",
            "A stable source does not mean every image must be identical. It means the object, package, and facts stay recognizable while the composition changes to answer a different question. Store the source ID or filename in the approval record for traceability."
          ] },
          { id: "sequence", title: "Create the set in a useful sequence", paragraphs: [
            "Create the clearest product-first image before adding context. Then fill information gaps with a lifestyle view, feature explanation, size cue, or comparison asset. Sequencing the work this way makes it easier to notice when a decorative image is compensating for a missing product fact.",
            "The <a href=\"/ai-image-generation/ecommerce-main-image\">Ecommerce Main Image</a> is a useful starting point. Add a <a href=\"/ai-image-generation/feature-infographic\">Feature Infographic</a> when a visual explanation helps, and use a <a href=\"/ai-image-generation/comparison-chart\">Comparison Chart</a> only when the variants and comparison facts are available."
          ] },
          { id: "mobile-review", title: "Review the gallery at the size shoppers see", paragraphs: [
            "Check the first frame, thumbnail sequence, mobile crop, and text legibility. A feature label that works on a large desktop canvas may be unreadable in a gallery. Make sure the image order tells a coherent story without forcing the viewer to infer what is included.",
            "Look for product drift between images: a handle changes shape, a color becomes warmer, a package gains an item, or a lifestyle prop makes the item appear larger than it is. Remove an asset when the visual suggestion is stronger than the verified product fact."
          ] },
          { id: "channel-variants", title: "Separate channel variants from product truth", paragraphs: [
            "A PDP, marketplace feed, paid social ad, and email may require different dimensions or crops. Create those variants from the approved set, and keep the product representation stable. Do not let a platform-specific crop remove the disclaimer, size cue, or product detail needed to understand the image.",
            "Record the destination for every exported asset. This makes it possible to update a campaign variant without accidentally replacing the main product image or carrying a promotional claim into an evergreen page."
          ] }
        ],
        checklist: [
          "Every planned image has one shopper question and one review criterion.",
          "The same approved source and fact sheet are used across the set.",
          "Main image, context, feature, size, and comparison assets are not redundant.",
          "Text, dimensions, colors, included items, and variant differences remain accurate.",
          "The complete set has been reviewed in the actual PDP, mobile crop, and campaign placement."
        ],
        comparisonBlock: comparison(["Gallery role", "Recommended workflow", "Do not use it to"], [
          ["Identify the product", "Ecommerce Main Image", "Add unsupported lifestyle or performance claims"],
          ["Explain a verified feature", "Feature Infographic", "Invent specifications or unreadable labels"],
          ["Clarify variant differences", "Comparison Chart", "Replace a missing fact sheet or current option data"]
        ]),
        faqs: [
          ["How many product images should an ecommerce page have?", "There is no universal number. Start with the shopper questions the page must answer and add only the assets that provide distinct information. A smaller accurate set is better than a larger set with repeated or misleading scenes."],
          ["Which image should I create first?", "Create the clearest product-first image first. It establishes the reference for later lifestyle, feature, size, and comparison assets and exposes source problems before more work is built on top of them."],
          ["When should I use a feature infographic?", "Use one when a verified feature is easier to understand visually than in a paragraph. Keep the text and visual labels tied to the product facts and review them at mobile size."],
          ["How do I avoid inconsistent AI product images?", "Keep one approved source and fact sheet, reuse the product reference, define the role of each asset, and compare outputs as a set. Reject any image that changes shape, color, scale, packaging, or included items."],
          ["Can the same image be used on a product page and in an ad?", "Sometimes, but review the crop, claims, destination, and channel requirements separately. A page image may need detail while an ad needs a faster visual hook; the product truth should remain the same."]
        ],
        closing: "Use the workflow to organize the gallery around shopper decisions, not around the number of generations available. The final collection should make the product clearer from the first thumbnail through the last supporting asset."
      })
    },
    {
      ...common,
      slug: "/blog/ai-video-review-checklist",
      title: "AI Video Review Checklist for Brands",
      description: "Review generated video for visual stability, audio, captions, product claims, crop, disclosure, and destination before publishing or sharing.",
      keywords: "AI video review checklist, AI video quality control, generated video review, video publishing checklist",
      imageAlt: "A review checklist beside a motion-ready video frame.",
      coverThemeHref: "/ai-video-generation/how-to-video",
      summary: "A practical final-pass checklist for generated video, covering visual stability, audio, captions, claims, disclosure, and delivery format.",
      entityName: "AI video review checklist",
      userIntent: "Review a generated video for visual, audio, factual, and publishing issues before sharing it.",
      targetHref: "/ai-video-generation/how-to-video",
      targetLabel: "Open How-to Video",
      primaryCta: "Choose a video workflow",
      primaryHref: "/ai-video-generation",
      relatedLinks: [
        ["/ai-video-generation/how-to-video", "Create a how-to video"],
        ["/ai-video-generation/tiktok-reels-shorts", "Plan short-form social video"],
        ["/ai-video-generation/talking-photo-recs", "Review a talking photo"]
      ],
      tags: "AI video review|Video quality control|Generated media|Publishing checklist",
      body: body({
        intro: "Generated video can look convincing while still containing small errors that change meaning or reduce trust. Review the exported clip after generation and before it is published, sent to a client, or placed in a paid campaign. Start with visual continuity, then check audio and captions, then verify claims, rights, disclosure, crop, destination, and the exact version that received approval. A repeatable pass makes small defects easier to catch before they travel.",
        sections: [
          { id: "visual-stability", title: "Inspect visual stability from start to finish", paragraphs: [
            "Watch the full clip at normal speed, then pause on transitions and close-ups. Look for faces, hands, teeth, hair, text, product edges, object continuity, lighting shifts, reflections, and background geometry. Errors often appear during a gesture or cut even when the opening frame looks clean.",
            "If the video contains a product, compare the result with the approved reference. Check shape, color, label, packaging, quantity, and scale. Do not treat a plausible generated prop as proof that the product includes an item or performs a function."
          ] },
          { id: "audio-captions", title: "Check audio and captions together", paragraphs: [
            "Listen for pronunciation, clipped words, timing drift, volume changes, unwanted sounds, and music that has not been cleared for the intended use. Then read captions against the approved script. Automatic captions can introduce a different claim even when the audio sounds correct.",
            "Review with sound on and off. The silent version should retain enough context to understand the action and CTA, while the audio version should not introduce a promise or name that is missing from the visual and text review."
          ] },
          { id: "identity-rights", title: "Review people, likeness, and source rights", paragraphs: [
            "Check that every face, voice, logo, image, and location is approved for the intended audience and placement. Generated movement does not expand the permission attached to a source portrait or voice. If the clip uses a talking portrait, compare it with the permission-safe guidance in the <a href=\"/ai-video-generation/talking-photo-recs\">Talking Photo Product Recs</a> workflow.",
            "Do not publish an output that makes a real person appear to endorse, report, or say something they did not authorize. Keep the source list and rights decision beside the final export so the review can be repeated after edits."
          ] },
          { id: "claims-context", title: "Verify claims and publishing context", paragraphs: [
            "Compare names, dates, prices, features, offers, destinations, and calls to action with the current approved source. Review the caption, thumbnail, landing page, and audience together because a context outside the video can change how the same sentence is understood.",
            "Add disclosure when generated or substantially altered media could be misunderstood. The <a href=\"/ai-video-generation/how-to-video\">How-to Video</a> workflow can help structure an explanation, but it does not decide whether a claim, source, or disclosure is approved."
          ] },
          { id: "delivery", title: "Check the export, not only the timeline", paragraphs: [
            "Confirm aspect ratio, resolution, duration, safe areas, thumbnail, file format, captions, and destination link in the delivered file. A late export can have a different crop, missing audio, or stale end card even when the editor preview passed review.",
            "Assign a version ID or filename to the approval record. Keep the approved source, script, export, destination, and reviewer together so a later request for a shorter or vertical cut does not silently replace the approved master."
          ] }
        ],
        checklist: [
          "Visual continuity, product identity, faces, hands, text, and background have been checked frame by frame.",
          "Audio, pronunciation, music, captions, timing, and safe areas match the approved script.",
          "All source likenesses, voices, logos, media, and locations have an approved use.",
          "Claims, prices, dates, CTA, destination, audience, and disclosure are current.",
          "The exact exported file has a reviewer, version, destination, and approval record."
        ],
        comparisonBlock: comparison(["Review focus", "Useful workflow", "Primary question"], [
          ["Explain a sequence or feature", "Explainer Video", "Does each scene support the approved explanation?"],
          ["Publish to social placements", "Social Media Video", "Are crop, pacing, captions, and CTA correct for the placement?"],
          ["Animate a permission-safe portrait", "Talking Photo", "Are likeness, script, audio, and disclosure accurate?"]
        ]),
        faqs: [
          ["When should I review an AI-generated video?", "Review after generation, after any material edit, and before each new placement or campaign. The exported file should receive the final check because crop, captions, audio, or end cards can change during export."],
          ["What is the most common visual problem to check first?", "Start with continuity: product edges, hands, faces, text, object identity, lighting, and background geometry. These errors can alter what the viewer thinks happened or what the product looks like."],
          ["Should captions be reviewed separately from audio?", "Yes. Compare captions with the approved script and audio. A transcription error can change a name, number, or claim even when the spoken track is correct."],
          ["Do I need to check the landing page too?", "Yes. The video, caption, CTA, offer, and destination form one publishing context. A current video can become misleading if the linked page has different product facts or terms."],
          ["What should an approval record contain?", "Keep the source references, script, final export, version, reviewer, date, destination, audience, rights notes, and disclosure decision. This makes later updates auditable without relying on memory."]
        ],
        closing: "Use the checklist as a release gate, not as a reason to approve every clip. If a review finds a misleading product detail, unstable identity, or unsupported claim, revise or reject the output before it reaches the audience."
      })
    },
    {
      ...common,
      slug: "/blog/ai-content-disclosure-safe-usage",
      title: "AI Content Disclosure and Safe Usage",
      description: "Review AI content responsibly with permission-safe sources, honest context, disclosure decisions, rights checks, and a record of final approval.",
      keywords: "AI content disclosure, safe AI usage, synthetic media policy, permission-safe AI content",
      imageAlt: "A private workspace for reviewing AI content and source permissions.",
      coverThemeHref: "/ai-image-generation/professional-headshot",
      summary: "A practical guide to permission-safe uploads, honest context, review records, and responsible sharing of AI-generated images and videos.",
      entityName: "AI content disclosure and safe usage",
      userIntent: "Understand how to review, label, and share AI-generated content responsibly.",
      targetHref: "/content",
      targetLabel: "Read the Content Policy",
      primaryCta: "Read the content policy",
      primaryHref: "/content",
      relatedLinks: [
        ["/ai-video-generation/talking-photo-recs", "Review talking photo disclosure"],
        ["/ai-video-generation/founder-update", "Plan a founder update"],
        ["/ai-image-generation/professional-headshot", "Prepare a permission-safe portrait"]
      ],
      tags: "AI disclosure|Safe AI usage|Synthetic media|Content policy",
      body: body({
        intro: "Responsible AI content starts before generation and continues after export. Use permission-safe source material, keep product and personal claims tied to approved facts, describe generated or substantially altered media honestly when context matters, and retain a review record. The goal is not a single label that solves every situation; it is a repeatable decision process that keeps the source, message, audience, and publishing context connected. The same record helps teams explain why a final asset was approved.",
        sections: [
          { id: "safe-sources", title: "Start with permission-safe source material", paragraphs: [
            "Use photos, voices, products, logos, text, and locations that you own or are authorized to use for the intended purpose. Keep the permission scope visible to the team. A source that is acceptable for an internal concept may not be approved for an advertisement, public profile, or impersonation-sensitive message.",
            "The <a href=\"/ai-image-generation/professional-headshot\">Professional Headshot</a> workflow can help organize a portrait task, but the workflow does not grant rights to a person’s likeness. Store the source and authorization together before generation."
          ] },
          { id: "message-ownership", title: "Separate the visual treatment from message ownership", paragraphs: [
            "AI can change a scene, animate a portrait, or create a campaign variation. It does not decide who is allowed to speak, endorse, promise, or disclose. Define the message owner and compare every visible or spoken claim with the approved source.",
            "Be careful with names, voices, faces, testimonials, product results, and institutional statements. A realistic presentation can increase the chance that a viewer mistakes a generated scene for a real record or an authorized statement."
          ] },
          { id: "disclosure-context", title: "Add the context the audience needs", paragraphs: [
            "Disclosure should be clear enough for the audience and placement to understand when content is generated or substantially altered and that difference could affect interpretation. Review the caption, thumbnail, surrounding copy, and destination rather than placing all responsibility on a small label.",
            "The right context depends on the channel and message. Avoid making a universal legal promise in the article; instead, direct the team to review the current <a href=\"/content\">Content Policy</a> and the requirements of the destination where the material will appear."
          ] },
          { id: "review-rights", title: "Review rights, accuracy, and audience expectations", paragraphs: [
            "Check factual claims, names, faces, voices, brand marks, private details, product appearance, and destination links. Consider what a reasonable viewer could infer from the complete presentation. If the generated result suggests a different product, relationship, location, or event, revise it even if no single sentence is technically false.",
            "For brand storytelling, the <a href=\"/ai-video-generation/founder-update\">Founder Update</a> workflow can organize the narrative, but the final review still belongs to the publisher. Generated polish should not replace a source check or rights review."
          ] },
          { id: "approval-record", title: "Keep a record that can survive the next edit", paragraphs: [
            "Keep the approved source, brief or script, final export, disclosure decision, audience, destination, reviewer, and date together. When a channel or product fact changes, the record tells the team which assets need another review.",
            "Remove content that is misleading, unsafe, outside the approved use, or impossible to explain clearly. A smaller approved library is easier to maintain than a large folder of files with unknown sources and uncertain context."
          ] }
        ],
        checklist: [
          "The source material, likenesses, voices, logos, and text are authorized for the intended use.",
          "The message owner has approved the factual claims and implied meaning.",
          "Disclosure and surrounding context match the audience, channel, and destination.",
          "The final asset has been checked for rights, accuracy, privacy, and misleading visual suggestions.",
          "The source, final export, reviewer, date, and decision are recorded together."
        ],
        comparisonBlock: comparison(["Question", "Use this reference", "Still required"], [
          ["What may be uploaded or published?", "Content Policy", "Check current permission and destination requirements"],
          ["How should a portrait be prepared?", "Professional Headshot", "Obtain and retain likeness authorization"],
          ["How should a brand story be structured?", "Brand Video", "Verify claims, rights, disclosure, and audience context"]
        ]),
        faqs: [
          ["What does permission-safe AI content mean?", "It means the source material and intended use are authorized, and the generated result does not extend that authorization into an unapproved statement, endorsement, or private disclosure."],
          ["When should AI-generated content be disclosed?", "Review whether the generated or altered nature could affect how the audience interprets the content, and follow the current policy and destination requirements. Include clear context when a viewer could reasonably mistake the result for an unedited real record or statement."],
          ["Is a generated person automatically a real endorsement?", "No. A generated performance should not be presented as a real customer, employee, spokesperson, or public figure unless the relationship and authorization are accurate. Avoid invented testimonials and implied approval."],
          ["Should the disclosure appear in the image or video itself?", "The placement depends on the channel and audience, but review the complete experience: asset, caption, surrounding copy, thumbnail, and destination. Do not hide material context where it could change interpretation."],
          ["What should I keep after publishing?", "Keep the approved source, brief or script, final export, rights notes, disclosure decision, reviewer, date, audience, and destination. This makes future edits and product changes easier to recheck."]
        ],
        closing: "Use Aidreamcapes workflows to create and organize content, then apply a human review that matches the stakes of the audience and message. Responsible publishing is a chain of decisions, not a single generated output."
      })
    },
    {
      ...common,
      slug: "/blog/motion-generator-video-guide",
      title: "AI Motion Generator Video Guide",
      description: "Plan motion-generator videos from one approved image with a focused action, continuity checks, product-safe movement, and final export review.",
      keywords: "AI motion generator, image to video workflow, product motion video, AI video review",
      imageAlt: "Motion frames reviewed for continuity before exporting a product video.",
      coverThemeHref: "/ai-video-generation/cinematic-video",
      summary: "A practical guide to turning one approved still into a reviewable motion clip without losing product identity or publishing context.",
      entityName: "AI motion generator video workflow",
      userIntent: "Plan a motion-generator video from one approved image and review it before sharing or publishing.",
      targetHref: "/ai-video-generation/cinematic-video",
      targetLabel: "Open Cinematic Video",
      primaryCta: "Create a motion video",
      primaryHref: "/ai-video-generation/cinematic-video",
      relatedLinks: [
        ["/ai-video-generation/cinematic-video", "Create a motion video"],
        ["/ai-video-generation/product-video", "Plan a product video"],
        ["/ai-video-generation/how-to-video", "Plan a how-to video"]
      ],
      tags: "AI motion video|Image to video|Product video|Video continuity",
      body: body({
        intro: "A motion-generator video starts with a still image, but a useful result needs more than movement. Choose one visible action, define what must stay fixed, and review the transition from the first frame to the last. The best brief gives the generator room to animate the scene while protecting the product’s identity, proportions, text, and intended context. Treat the output as a new video asset that still needs rights, claims, and export review.",
        sections: [
          { id: "motion-source", title: "Choose a still that can support motion", paragraphs: [
            "Use an approved image with a clear subject, stable edges, and enough separation between the product and background. A busy crop, hidden handle, reflective surface, or tiny label gives the motion workflow more ambiguity to resolve. If the product must remain exact, start with the clearest source rather than the most decorative one.",
            "Record the source file and the details that must not change: shape, color, logo, packaging, included parts, and relative scale. A motion clip can be visually engaging while still failing if the source product becomes a different object halfway through."
          ] },
          { id: "one-action", title: "Describe one readable action", paragraphs: [
            "Choose one movement such as a slow camera push, a controlled turn, a gentle fabric shift, or a small environmental change. Explain the direction, speed, start frame, end frame, and what remains still. A single action is easier to judge than a brief that asks the product, camera, background, and lighting to transform at once.",
            "Avoid movement that implies a product capability the source does not establish. A generated opening, pour, stretch, or interaction should not become evidence of how the item works unless the real product facts and review support that interpretation."
          ] },
          { id: "continuity", title: "Protect continuity across the clip", paragraphs: [
            "Review the product silhouette, edges, texture, reflections, labels, hands, and background at the beginning, middle, and end. Look for added parts, disappearing text, warped geometry, changing colors, and camera motion that makes the product appear to change size.",
            "For a more controlled product-first treatment, compare the brief with the <a href=\"/ai-video-generation/product-video\">Product Video</a> workflow. For a mood-led scene, the <a href=\"/ai-video-generation/cinematic-video\">Cinematic Video</a> workflow may be a better fit, but the same product continuity checks still apply."
          ] },
          { id: "motion-review", title: "Review motion at normal speed and frame by frame", paragraphs: [
            "Watch once for the viewer’s overall impression, then pause on the moments where the subject turns, intersects with a hand, or crosses a high-contrast edge. Check whether the motion communicates the intended idea and whether a viewer could infer a false feature, scale, or use.",
            "Check audio, captions, thumbnail, aspect ratio, and destination when they are part of the final package. Motion quality is only one part of publishing quality; an otherwise clean clip can still carry an outdated CTA or unsupported claim."
          ] },
          { id: "export", title: "Keep source, motion brief, and export connected", paragraphs: [
            "Save the approved still, motion description, selected output, reviewer, and destination together. If the team requests a shorter or vertical version, create it from the approved source and record a new review rather than overwriting the original decision.",
            "Use the Motion Generator as the direct starting point for a single-image movement concept. Move to a different video workflow when the job is a product demonstration, talking portrait, or multi-scene narrative so the brief and review criteria match the asset."
          ] }
        ],
        checklist: [
          "The source still, product facts, and intended use are approved.",
          "One readable action and one stable subject are defined in the motion brief.",
          "Product silhouette, color, label, packaging, scale, and included parts remain consistent.",
          "The exported file has been checked for claims, audio, captions, crop, thumbnail, and CTA.",
          "The source, brief, output, reviewer, destination, and version are recorded together."
        ],
        comparisonBlock: comparison(["Creative job", "Workflow", "Best fit"], [
          ["Animate one approved still", "Motion Generator", "A focused movement with a stable subject"],
          ["Show a product in a controlled sequence", "Product Video", "Product clarity and demonstration context"],
          ["Build a mood-led visual treatment", "Cinematic Video", "Atmosphere, camera language, and scene direction"]
        ]),
        faqs: [
          ["What image works best for a motion-generator video?", "Use an approved, clear image with a stable subject, visible edges, and enough separation from the background. Include the product details that must remain unchanged during movement."],
          ["How much movement should I request?", "Start with one readable action and define what remains still. A focused camera move or environmental change is easier to review than several simultaneous transformations."],
          ["How do I prevent product shape drift?", "Use a clear source, state the fixed details in the brief, avoid overloading the action, and review the silhouette, labels, reflections, and scale at several points in the clip."],
          ["When should I use Product Video instead?", "Use Product Video when the asset needs a controlled product demonstration, a sequence of product views, or stronger product-first framing than a single motion concept provides."],
          ["Can I publish the first good-looking output?", "Review the exported file first. Check continuity, claims, rights, captions, audio, crop, thumbnail, destination, and audience context before sharing or placing it in a campaign."]
        ],
        closing: "Motion Generator is most reliable as a focused transformation of an approved still. Keep the action legible, protect the product truth, and treat every export as a reviewable publishing asset."
      })
    },
    {
      ...common,
      slug: "/blog/ai-ugc-video-ads-guide",
      title: "AI UGC Video Ads: A Review-Ready Workflow",
      description: "Plan AI UGC video ads with a clear hook, approved product facts, creator-style scenes, disclosure, and review gates before paid distribution.",
      keywords: "AI UGC video ads, creator-style ads, product video ads, UGC ad review",
      imageAlt: "A creator-style video ad plan with product notes and a review checklist.",
      coverThemeHref: "/ai-video-generation/ugc-ad-video",
      summary: "Build creator-style ad concepts with one clear hook, controlled product claims, and a review pass before the video enters a campaign.",
      entityName: "AI UGC video ad workflow",
      userIntent: "Plan and review a creator-style AI video ad before publishing it to a campaign.",
      targetHref: "/ai-video-generation/ugc-ad-video",
      targetLabel: "Open UGC Ad Video",
      primaryCta: "Create a UGC ad concept",
      primaryHref: "/ai-video-generation/ugc-ad-video",
      relatedLinks: [
        ["/ai-video-generation/ugc-ad-video", "Create a UGC ad video"],
        ["/ai-video-generation/product-video", "Build a product video"],
        ["/ai-video-generation/tiktok-reels-shorts", "Plan a vertical social video"]
      ],
      tags: "AI UGC ads|Video advertising|Creator-style content|Ad review",
      body: body({
        intro: "AI UGC video ads work when the creator-style treatment makes one product idea easier to understand. Start with one audience problem, one approved proof point, and one action. Then review the full cut for product accuracy, voice, captions, disclosure, pacing, and destination before paid distribution. The format can feel informal without making the claim or the speaker ambiguous. A short approval trail also makes later edits safer before the ad goes live.",
        sections: [
          { id: "ugc-brief", title: "Define the audience moment before the hook", paragraphs: [
            "Write the situation the viewer recognizes: choosing between products, setting up a workflow, comparing a result, or deciding whether a feature matters. A focused situation gives the opening line a job. It also prevents the script from becoming a list of every capability the product might have.",
            "Record the audience, placement, aspect ratio, destination, and required disclosure in the brief. The same idea may need a different opening or crop for a feed placement and a short vertical placement, but the underlying product facts should remain consistent."
          ] },
          { id: "ugc-hook", title: "Use one clear opening hook", paragraphs: [
            "A good hook creates a question or names a problem without promising an outcome the product cannot guarantee. Keep the first line understandable with the sound off, and make the visual support the words rather than distract from them.",
            "Avoid borrowed testimonials, invented customer stories, and simulated certainty. If the creative uses a creator-style speaker, treat the performance as generated media and make the relationship between the speaker, brand, and product clear in the final placement."
          ] },
          { id: "ugc-proof", title: "Give the scene approved product proof", paragraphs: [
            "Provide the product reference, verified feature notes, current offer language, and the destination page. Ask the scene to demonstrate a workflow or visible interaction only when the product can support that interpretation. Generated props should not become evidence of a feature, result, or included accessory.",
            "Use the <a href=\"/ai-video-generation/product-video\">Product Video</a> workflow when the ad needs a more controlled product presentation. Use the creator-style workflow when the speaker, situation, and pacing are doing useful explanatory work."
          ] },
          { id: "ugc-review", title: "Review the speaker and product separately", paragraphs: [
            "First check the product: shape, packaging, logo treatment, color, accessories, and stated benefits. Then check the speaker: hands, face, eye line, gestures, timing, and whether the delivery implies a real endorsement. These are separate risks and should not be hidden by one overall approval label.",
            "Read the captions against the script and listen to the voiceover with the sound on. Review the opening frame, the final CTA, the landing page, and the disclosure as one journey. A compliant sentence can still be misleading if the visual immediately beside it suggests something else."
          ] },
          { id: "ugc-platform", title: "Adapt the cut to the placement", paragraphs: [
            "For vertical short-form placements, protect the first and last safe areas, make the product visible early, and keep captions readable without sound. The <a href=\"/ai-video-generation/tiktok-reels-shorts\">TikTok, Reels & Shorts workflow</a> can help organize the vertical version, but it does not replace review of the specific platform placement.",
            "Do not assume that a single export can be cropped everywhere. Save the approved master, placement variants, script, source facts, and destination link together so a later edit can be traced to the right review decision."
          ] }
        ],
        checklist: [
          "The hook names one audience problem or product moment.",
          "Every feature, offer, price, and result statement is approved and current.",
          "The product remains recognizable and no generated prop implies an unverified feature.",
          "Voice, face, captions, music, disclosure, and CTA have been reviewed together.",
          "The export, placement, landing page, and approval record refer to the same version."
        ],
        comparisonBlock: comparison(["Creative need", "Workflow", "Best review question"], [
          ["Creator-style problem and solution", "UGC Ad Video", "Does the performance clarify the product without implying a false endorsement?"],
          ["Controlled product demonstration", "Product Ad Video", "Is the product and its approved proof point unmistakable?"],
          ["Vertical short-form placement", "TikTok, Reels & Shorts", "Are hook, crop, captions, and CTA readable in the actual placement?"]
        ]),
        faqs: [
          ["What makes an AI UGC ad different from a product ad?", "A UGC ad uses a creator-style situation, voice, or performance to frame the product. A product ad usually gives more control to the product presentation. Either format still needs the same review of facts, rights, claims, disclosure, and destination."],
          ["Can an AI-generated creator give a testimonial?", "Do not present a generated speaker as a real customer or real endorser unless the relationship and source are accurate and authorized. Safer creative uses a clearly framed presenter or demonstrates a workflow without inventing personal experience."],
          ["How long should the hook be?", "Make it as short as the audience context allows, but do not remove the words needed to understand the claim. Test whether the first visual and caption communicate the same idea before optimizing for speed."],
          ["What should I check before running paid traffic?", "Check the final product representation, claims, captions, voice, music rights, disclosure, audience settings, destination page, and offer terms. Review the exported file rather than only the timeline preview."],
          ["Should I create separate cuts for TikTok and Reels?", "Create placement-specific versions when safe areas, pacing, captions, or CTA treatment differ. Keep one approved source brief so variants do not drift into different claims."]
        ],
        closing: "Use the UGC workflow to develop the creative treatment, then treat the exported video as an advertising asset that needs evidence, rights, and placement review. The goal is a creator-style ad that remains understandable when the viewer checks the product page."
      })
    }
  ];
}
