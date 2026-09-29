import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const assetRoot = "/assets/sites/site_aidreamcapes/brand-creator-v1";

const topics = [
  {
    key: "founder-update",
    slug: "/ai-video-generation/founder-update",
    title: "AI Founder Update Video Generator | Aidreamcapes",
    description: "Create a founder update video that turns a real company milestone, product decision, or behind-the-scenes moment into a clear message with credible proof and a next step.",
    keywords: "AI founder update video, founder announcement video, startup update video, founder story generator, company update video",
    twitterDescription: "Turn a real company update into a focused founder video with one clear point of view, visible proof, and a useful next step.",
    hero: {
      eyebrow: "AI VIDEO · FOUNDER UPDATE",
      title: "Make the founder’s point of view worth following.",
      body: "Turn a real company update into a focused video with a clear point of view, one useful proof moment, and a next step the audience can understand.",
      imageNote: "point of view → proof → next step",
      productLabel: "01 · Source message",
      outputLabel: "02 · Founder update",
      primaryCta: "Create Founder Update",
      secondaryCta: "See Founder Update examples",
      availabilityNote: "Use a verified update, approved source material, and a destination that is current before you publish.",
      rightsCopy: "Keep founder identity, company claims, product details, and behind-the-scenes footage permission-safe.",
      product: "unbranded matte-silver desk microphone beside a notebook",
      output: "original adult founder speaking at a calm studio desk with the microphone visible"
    },
    workflowOutput: {
      eyebrow: "WHAT THIS CREATOR WORKFLOW MAKES CLEAR",
      title: "Give the update a point of view people can verify.",
      intro: "A founder update earns attention when the audience understands what changed, why it matters, and what they can do next.",
      cards: [
        ["Message", "State the milestone, decision, or behind-the-scenes change in one sentence before adding context."],
        ["Context", "Explain why the update matters now without inflating a claim or hiding the useful qualification."],
        ["Proof", "Use one visible product, process, or approved working moment that supports the point being made."],
        ["Handoff", "Finish at the real product, announcement, community, or signup destination the viewer can use."]
      ]
    },
    workflow: {
      eyebrow: "THE WORKFLOW",
      title: "Build the update around one accountable message.",
      intro: "Keep the narrative narrow enough that a viewer can follow the decision from first frame to final handoff.",
      cards: [
        ["Define the update", "Choose a real milestone, product decision, build-in-public moment, or next step."],
        ["Choose the proof", "Select a scene the audience can actually see or check, such as a product detail or permitted process."],
        ["Shape the delivery", "Set the founder’s tone, pace, camera distance, and the single idea that should remain after the video ends."],
        ["Close with the next step", "Use a current destination and make clear whether the audience should learn, try, join, or wait."]
      ]
    },
    creativeDirections: {
      eyebrow: "CREATIVE DIRECTIONS",
      title: "Choose a founder format that fits the truth of the update.",
      intro: "The visual direction should make the update easier to understand, not make an unverified claim feel more official.",
      cards: [
        ["Milestone reveal", "Open on the concrete change and let the founder add the context that makes the moment meaningful."],
        ["Build in public", "Show a permitted test, sketch, setup, or iteration so the audience can see the work behind the statement."],
        ["Decision breakdown", "Explain one product or process choice and the user problem it is intended to address."],
        ["Founder desk update", "Use a close, direct setup when clarity and accountability matter more than spectacle."]
      ]
    },
    examples: [
      ["MESSAGE", "Open with the change the audience should remember.", "A founder at a desk points to the source message beside the microphone."],
      ["CONTEXT", "Give the update a reason to matter now.", "The founder reviews a simple product sketch in a quiet studio setting."],
      ["PROOF", "Put one visible, verifiable moment behind the statement.", "A close product detail and a permitted test setup support the spoken point."],
      ["DECISION", "Explain the choice without turning it into a guarantee.", "The founder compares two prototype directions with the product in frame."],
      ["BEHIND THE SCENES", "Make the work feel observable, not staged as a claim.", "A small team prepares a real-looking studio setup with restrained detail."],
      ["HANDOFF", "Move from the founder’s voice to a useful destination.", "The founder turns from the desk toward a product sample ready for the next step."],
      ["NEXT STEP", "End with an action the audience can understand.", "A calm closing portrait leaves clean space for an approved call to action."]
    ],
    adTesting: {
      eyebrow: "BUILT FOR CREATOR-LED DISTRIBUTION",
      title: "Keep the founder credible in every cut.",
      intro: "Use the same approved update across short-form discovery, a company page, or a product announcement while preserving the facts that need review.",
      checklist: ["One accountable message", "Visible proof moment", "Founder identity permission", "No invented metrics or claims", "Current destination", "Disclosure where required"]
    },
    requirements: {
      eyebrow: "BEFORE YOU CREATE",
      title: "Bring the source facts before the polish.",
      intro: "A strong founder video begins with an update the company can stand behind and a visual source that does not imply more than it proves.",
      cards: [
        ["Verified update", "Confirm the milestone, decision, or process detail with the people responsible for publishing it."],
        ["Approved likeness", "Use a permitted founder image, voice, performance, or clearly disclosed synthetic presentation."],
        ["Evidence boundary", "Choose product and process details that support the message without inventing performance or customer outcomes."],
        ["Release destination", "Check the announcement, product page, community link, or signup route before the CTA goes live."]
      ]
    },
    relatedWorkflows: {
      eyebrow: "CONTINUE THE WORKFLOW",
      title: "Move from point of view to production.",
      intro: "Use a related Aidreamcapes video workflow when the update needs a different kind of delivery.",
      items: [
        ["AI actor", "Use a controlled presenter format when the message needs a clear speaker and a simple handoff.", "/ai-video-generation/ai-actor-product-ads", "Explore AI actors"],
        ["Product demo", "Show the product action after the founder has explained why it matters.", "/ai-video-generation/product-video", "Explore product demo"],
        ["Cinematic film", "Give a launch moment more visual atmosphere while keeping the source facts precise.", "/ai-video-generation/cinematic-video", "Explore cinematic film"]
      ]
    },
    faq: [
      ["What is a Founder Update video?", "It is a focused video for a real company milestone, product decision, behind-the-scenes moment, or next step, presented with a clear founder point of view."],
      ["How do I avoid making a false company announcement?", "Start with an update that has been approved by the responsible team, show only supportable proof, and remove invented metrics, customers, funding, or growth claims."],
      ["Can I use a script or synthetic presenter?", "Yes, when the source identity and presentation rights are clear. Disclose synthetic content where required and never imply that a person made a statement they did not approve."],
      ["What proof should appear in the video?", "Use one observable product detail, permitted workflow moment, or documented decision that directly supports the message."],
      ["How should I handle an old founder update?", "Review the destination and facts before reusing it. Update or retire claims that no longer describe the current product, team, timing, or offer."]
    ],
    finalCta: {
      eyebrow: "READY TO SHARE THE NEXT UPDATE?",
      title: "Make the point clear before you make it polished.",
      body: "Create a founder update that connects a real point of view to visible proof and a next step your audience can trust.",
      cta: "Create Founder Update",
      microcopy: "Review identity, claims, proof, disclosure, and destination before publishing."
    }
  },
  {
    key: "multilingual-video",
    slug: "/ai-video-generation/multilingual-video",
    title: "AI Multilingual Video Generator for Localization | Aidreamcapes",
    description: "Adapt an approved video message for multiple languages and markets with clear presenter timing, subtitle-safe framing, localized context, and a reviewable final CTA.",
    keywords: "AI multilingual video, video localization generator, localized marketing video, multilingual product video, translated video workflow",
    twitterDescription: "Adapt one approved video message for different markets with intentional timing, subtitle-safe framing, and a review step before publishing.",
    hero: {
      eyebrow: "AI VIDEO · LOCALIZATION",
      title: "Make one message feel native in every market.",
      body: "Adapt an approved video for different languages with intentional timing, subtitle-safe framing, localized context, and a review step before the next market sees it.",
      imageNote: "source intent → market fit → reviewed version",
      productLabel: "01 · Source message",
      outputLabel: "02 · Market version",
      primaryCta: "Create Multilingual Video",
      secondaryCta: "See Localization examples",
      availabilityNote: "Start with approved source copy and have a qualified reviewer check each market version before release.",
      rightsCopy: "Do not present an unreviewed translation, voice, likeness, or cultural adaptation as final market-approved content.",
      product: "unbranded teal travel charger and printed blank storyboard cards",
      output: "original adult presenter explaining the travel charger in a bright market-neutral studio"
    },
    workflowOutput: {
      eyebrow: "WHAT THIS LOCALIZATION WORKFLOW MAKES CLEAR",
      title: "Protect the meaning while the delivery changes.",
      intro: "Localization is more than swapping words. The viewer should understand the same approved intent in a language, rhythm, and context that can be reviewed.",
      cards: [
        ["Source intent", "Lock what the original video actually promises, demonstrates, and asks the viewer to do."],
        ["Market fit", "Define the language, region, context, terminology, and CTA for each destination."],
        ["Delivery match", "Account for voice, mouth timing, pauses, text length, and subtitle-safe composition."],
        ["Review state", "Record what has been checked before a localized version becomes publishable."]
      ]
    },
    workflow: {
      eyebrow: "THE WORKFLOW",
      title: "Localize the message in a reviewable sequence.",
      intro: "Keep source intent, market adaptation, and final approval visible as separate decisions.",
      cards: [
        ["Lock the source message", "Confirm the original script, facts, product details, and CTA before adapting the delivery."],
        ["Choose target markets", "Specify languages and regions, including phrases, names, and references that should not be translated literally."],
        ["Adapt the delivery", "Adjust timing, subtitle length, camera safe areas, voice direction, and market context."],
        ["Review before export", "Check pronunciation, mouth timing, text, terminology, facts, and brand tone with a qualified reviewer."]
      ]
    },
    creativeDirections: {
      eyebrow: "CREATIVE DIRECTIONS",
      title: "Design for the moment a local viewer reads and hears it.",
      intro: "Use composition and pacing to give each market version enough room for language review and clear product context.",
      cards: [
        ["Same scene, new market", "Keep the core visual while changing approved language and context for a specific destination."],
        ["Subtitle-safe presenter", "Leave a clean lower-third area so translated text can be checked without covering the product or face."],
        ["Localized opening", "Adapt the first line to the market’s approved context without changing the product fact underneath."],
        ["Market-specific close", "Use a destination and CTA that are actually available for the audience receiving that version."]
      ]
    },
    examples: [
      ["SOURCE", "Keep the original intent visible before translation begins.", "A presenter reviews blank storyboard cards beside the same teal travel product."],
      ["LANGUAGE", "Create room for the approved language version.", "A market-neutral presenter speaks toward a clean frame with space for reviewed text."],
      ["TIMING", "Match pauses and mouth movement to the adapted delivery.", "A close presenter frame emphasizes calm pacing and clear speech preparation."],
      ["SUBTITLE SAFE", "Protect the lower frame for readable reviewed subtitles.", "The product sits high in frame while the presenter leaves a clean lower safe area."],
      ["LOCAL CONTEXT", "Use familiar context without inventing local facts.", "The travel product appears in a simple transit-ready setting with neutral cues."],
      ["REVIEW", "Make language and brand checks part of the visual workflow.", "A reviewer and presenter compare a blank script card and the product setup."],
      ["MARKET CTA", "Finish at the destination for that market.", "The presenter closes beside the product with clean space for a verified localized CTA."]
    ],
    adTesting: {
      eyebrow: "BUILT FOR MARKET VERSIONING",
      title: "Ship language variants without losing the source truth.",
      intro: "Use localized versions for regional feeds, product pages, partner campaigns, or internal review while preserving a clear approval trail.",
      checklist: ["Approved source script", "Target language and region", "Subtitle-safe framing", "Pronunciation and timing review", "Market-specific destination", "Required disclosure"]
    },
    requirements: {
      eyebrow: "BEFORE YOU CREATE",
      title: "Bring a message that is ready to be reviewed.",
      intro: "Localization quality depends on source clarity, language review, and a destination that matches the audience—not on claiming that every translation is perfect.",
      cards: [
        ["Source approval", "Confirm the original words, product facts, visual claims, and CTA are current."],
        ["Market brief", "Name the target language, region, audience, terminology, and cultural constraints."],
        ["Voice and likeness rights", "Verify the presenter, voice, performance, and any synthetic-content disclosure requirements."],
        ["Human review", "Have a qualified reviewer check language, pronunciation, timing, subtitles, and market fit before release."]
      ]
    },
    relatedWorkflows: {
      eyebrow: "CONTINUE THE WORKFLOW",
      title: "Use the right format for the next market question.",
      intro: "Move from localization into a related Aidreamcapes workflow when the story needs a different production focus.",
      items: [
        ["AI actor", "Start from a controlled presenter format when voice, pacing, and translation review are central.", "/ai-video-generation/ai-actor-product-ads", "Explore AI actors"],
        ["Product demo", "Keep the localized message grounded in a visible product action.", "/ai-video-generation/product-video", "Explore product demo"],
        ["Founder update", "Adapt an approved company message for a new team, region, or community.", "/ai-video-generation/founder-update", "Explore founder update"]
      ]
    },
    faq: [
      ["What is a multilingual video workflow?", "It adapts an approved video message for another language or market while keeping source intent, product facts, timing, subtitles, and review status clear."],
      ["Does localization guarantee a perfect translation?", "No. AI can help create a version, but language, pronunciation, terminology, cultural context, and brand tone should be reviewed before publishing."],
      ["Can I localize the presenter’s voice or face?", "Only when you have the required rights and follow disclosure rules. Do not make a real person appear to say something they did not approve."],
      ["Why does subtitle-safe framing matter?", "Translated text can be longer than the source. Leaving a clean safe area prevents subtitles from covering the speaker, product, or important action."],
      ["Should every market use the same CTA?", "Not necessarily. The CTA should lead to a current destination available to that market and match any regional offer or support path."]
    ],
    finalCta: {
      eyebrow: "READY TO LOCALIZE THE MESSAGE?",
      title: "Make every market version easy to review.",
      body: "Create a multilingual video that keeps source intent intact while giving language, timing, context, and CTA the attention each market needs.",
      cta: "Create Multilingual Video",
      microcopy: "Review language, likeness, product facts, subtitles, and destination before publishing."
    }
  },
  {
    key: "cinematic-product-film",
    slug: "/ai-video-generation/cinematic-video",
    title: "AI Cinematic Product Film Generator | Aidreamcapes",
    description: "Create a cinematic product film with deliberate camera movement, light, texture, pacing, and product detail for launches, brand stories, and premium campaigns.",
    keywords: "AI cinematic product film, cinematic product video, product launch film generator, brand story video AI, cinematic ecommerce video",
    twitterDescription: "Create a cinematic product film with intentional camera movement, lighting, texture, pacing, and product detail for launches and brand stories.",
    hero: {
      eyebrow: "AI VIDEO · CINEMATIC PRODUCT FILM",
      title: "Give the product a world, not just a close-up.",
      body: "Build a cinematic product film around camera movement, light, texture, pacing, and product detail so a launch or brand story feels considered from first frame to last.",
      imageNote: "world → material → detail → reveal",
      productLabel: "01 · Product source",
      outputLabel: "02 · Cinematic film",
      primaryCta: "Create Cinematic Film",
      secondaryCta: "See Cinematic Film examples",
      availabilityNote: "Use current product references and review every visual detail before the film represents the real product.",
      rightsCopy: "Cinematic styling can heighten perception, but it must not invent product materials, performance, certifications, or brand relationships.",
      product: "unbranded obsidian sculptural wireless speaker on a neutral plinth",
      output: "obsidian wireless speaker in a dark architectural room with a precise blue rim light"
    },
    workflowOutput: {
      eyebrow: "WHAT THIS FILM WORKFLOW MAKES CLEAR",
      title: "Let atmosphere support the product decision.",
      intro: "A cinematic film is strongest when the visual world adds meaning while the product remains identifiable and honest.",
      cards: [
        ["World", "Establish a setting, temperature, and visual language that frame the product’s intended role."],
        ["Material", "Use light and texture to make observable surfaces, edges, and construction easier to notice."],
        ["Human scale", "Introduce a hand, room, or use moment when it helps the viewer understand proportion and context."],
        ["Reveal", "Finish on a product and next step that match the actual launch, campaign, or product destination."]
      ]
    },
    workflow: {
      eyebrow: "THE WORKFLOW",
      title: "Direct the visual language before adding spectacle.",
      intro: "Plan the film as a sequence of intentional visual decisions rather than a collection of dramatic effects.",
      cards: [
        ["Set the world", "Choose the space, light direction, palette, and atmosphere that make sense for the product."],
        ["Map the camera", "Define the reveal, movement, distance, and speed so each shot has a purpose."],
        ["Protect product detail", "Keep shape, finish, controls, ports, texture, and color aligned with the approved source."],
        ["Time the close", "Build toward a final frame and CTA that the launch or product page can actually support."]
      ]
    },
    creativeDirections: {
      eyebrow: "CREATIVE DIRECTIONS",
      title: "Make the product feel placed, not pasted in.",
      intro: "Use visual restraint to create distinction without turning cinematic treatment into an unsupported product promise.",
      cards: [
        ["Material study", "Let controlled light travel across the actual finish, texture, edge, or control the source supports."],
        ["Architectural reveal", "Introduce the product through a deliberate camera move in a space that reinforces its role."],
        ["Human scale", "Use a hand or lived-in context to make size, interaction, and use easier to understand."],
        ["Quiet final frame", "Hold the product and destination long enough for the audience to identify what they should do next."]
      ]
    },
    examples: [
      ["WORLD", "Create a setting with a distinct visual temperature.", "The obsidian speaker sits on a sculptural plinth in an architectural room."],
      ["MATERIAL", "Use light to reveal the surface the source actually shows.", "A controlled side light traces the speaker’s matte surface and edge."],
      ["MOVEMENT", "Give the camera a reason to move.", "A slow lateral camera path reveals the speaker from shadow into blue rim light."],
      ["DETAIL", "Bring one product detail close enough to judge.", "The control surface and grille texture appear in a restrained macro frame."],
      ["HUMAN SCALE", "Show how the object belongs in a real environment.", "An original adult hand places the speaker on a console without adding a false claim."],
      ["REVEAL", "Build toward a clear product reveal.", "The room opens around the speaker while the product stays consistent and recognizable."],
      ["CLOSE", "End with the approved product and next step.", "A clean final product frame leaves negative space for a verified launch CTA."]
    ],
    adTesting: {
      eyebrow: "BUILT FOR LAUNCH AND BRAND STORY",
      title: "Keep cinematic polish tied to a real product source.",
      intro: "Create a hero film, product-page cut, or short social edit from the same approved visual language while checking each representation before release.",
      checklist: ["Current product reference", "Consistent shape and finish", "Deliberate camera path", "Readable product detail", "Rights-cleared setting and talent", "Verified launch destination"]
    },
    requirements: {
      eyebrow: "BEFORE YOU CREATE",
      title: "Bring the product truth into the film set.",
      intro: "Cinematic quality should clarify the product’s role, material, and context—not replace product information with mood alone.",
      cards: [
        ["Current source", "Use product images or a URL that accurately represents form, finish, controls, and visible construction."],
        ["Visual brief", "Define the world, camera movement, light, pacing, and detail the audience needs to notice."],
        ["Rights-cleared scene", "Confirm permission for locations, people, props, music, and any recognizable visual references."],
        ["Detail review", "Check every output for shape, color, controls, texture, and claims before it is used commercially."]
      ]
    },
    relatedWorkflows: {
      eyebrow: "CONTINUE THE WORKFLOW",
      title: "Choose the next cut for the decision.",
      intro: "Use a related Aidreamcapes workflow when the product needs more explanation, proof, or creator context.",
      items: [
        ["Product demo", "Move from atmosphere into a clear feature or use moment.", "/ai-video-generation/product-video", "Explore product demo"],
        ["Founder update", "Pair a launch film with the point of view behind the product decision.", "/ai-video-generation/founder-update", "Explore founder update"],
        ["Audio sync", "Shape a short-form cut around approved audio timing and deliberate movement.", "/ai-video-generation/music-video", "Explore audio sync"]
      ]
    },
    faq: [
      ["What is a cinematic product film?", "It is a product video direction that uses camera movement, light, texture, pacing, space, and detail to build a visual world around an identifiable product."],
      ["Does cinematic treatment prove a product is premium?", "No. Atmosphere can shape perception, but it is not evidence of material quality, performance, certification, price, or brand status."],
      ["How do I keep the product accurate?", "Use current source references, define the details that must remain consistent, and review shape, color, controls, finish, and proportions in every output."],
      ["Can I use a real person or location?", "Only with the necessary permissions. Review talent, location, prop, music, and recognizable reference rights before publishing."],
      ["Where does a cinematic product film work best?", "It can support a launch page, brand story, product page, presentation, or social cut when the destination and product facts are current."]
    ],
    finalCta: {
      eyebrow: "READY TO DIRECT THE REVEAL?",
      title: "Give the product a world that still tells the truth.",
      body: "Create a cinematic product film with deliberate movement, light, texture, and pacing—then review the details that make the product real.",
      cta: "Create Cinematic Film",
      microcopy: "Review product accuracy, rights, claims, and destination before publishing."
    }
  },
  {
    key: "trending-audio-sync",
    slug: "/ai-video-generation/music-video",
    title: "AI Music Video & Trending Audio Sync Generator | Aidreamcapes",
    description: "Build an AI music video around approved audio beats with deliberate cuts, movement, product moments, and safe publishing checks for social channels.",
    keywords: "audio sync video generator, AI music video editing, beat sync short video, social audio video, product video beat edit",
    twitterDescription: "Shape a short-form video around approved audio beats with deliberate cuts, movement, product moments, and safe publishing checks.",
    hero: {
      eyebrow: "AI VIDEO · TRENDING AUDIO SYNC",
      title: "Make the music video serve the beat.",
      body: "Build a short-form video around approved audio timing, deliberate cuts, movement, product moments, and safe publishing checks for the channels you actually use.",
      imageNote: "rights check → beat map → visual match",
      productLabel: "01 · Audio brief",
      outputLabel: "02 · Synced cut",
      primaryCta: "Create Audio Sync Video",
      secondaryCta: "See Audio Sync examples",
      availabilityNote: "Use audio you are authorized to publish and review every platform version before release.",
      rightsCopy: "Trending is a creative direction, not a promise of current popularity or a substitute for music rights.",
      product: "unbranded translucent portable synthesizer and headphones on a color-lit studio table",
      output: "original adult creator moving a translucent synthesizer through a color-lit music studio"
    },
    workflowOutput: {
      eyebrow: "WHAT THIS AUDIO WORKFLOW MAKES CLEAR",
      title: "Make the beat serve the visual idea.",
      intro: "A good sync cut is not random motion on music. Every timing choice should help the audience notice the creator, product, movement, or next step.",
      cards: [
        ["Rights check", "Confirm the audio source, license, platform scope, and any usage limits before editing."],
        ["Beat map", "Mark the moments where a cut, gesture, product reveal, or change in framing earns its place."],
        ["Visual match", "Choose movement and product moments that respond to the beat without obscuring the subject."],
        ["Safe export", "Check aspect ratio, audio treatment, disclosure, and platform-specific publishing requirements."]
      ]
    },
    workflow: {
      eyebrow: "THE WORKFLOW",
      title: "Build the edit from a beat map, not a trend claim.",
      intro: "Keep audio permission, visual timing, and platform output as separate reviewable steps.",
      cards: [
        ["Confirm the audio", "Identify the approved file, source, rights, duration, and platforms where it may be used."],
        ["Mark the beats", "Pick the intro, impact, transition, hold, and closing beats that carry the visual story."],
        ["Place the subject", "Match creator gesture, product motion, camera movement, and text-safe space to the timing."],
        ["Export and review", "Check sync, crop, loudness, captions, disclosure, and the destination before publishing."]
      ]
    },
    creativeDirections: {
      eyebrow: "CREATIVE DIRECTIONS",
      title: "Turn timing into a visual point of view.",
      intro: "Use the audio to organize attention while keeping the subject, product, and publishing boundaries legible.",
      cards: [
        ["Beat-led reveal", "Hold the subject back, then reveal the product or scene on a deliberate approved beat."],
        ["Movement phrase", "Use one repeatable gesture or camera move so the rhythm feels designed rather than frantic."],
        ["Texture cut", "Switch between creator, material, and detail frames when the audio gives the change a clear reason."],
        ["Quiet close", "Let the final beat create enough space for a product detail, disclosure, or next step to be understood."]
      ]
    },
    examples: [
      ["RIGHTS", "Start from audio that is cleared for the intended use.", "The creator reviews headphones and a portable synthesizer before recording."],
      ["BEAT MAP", "Give each major beat a visual job.", "Blank beat cards sit beside the synthesizer while the creator plans the cut."],
      ["REVEAL", "Use timing to introduce the subject or product.", "A color-lit studio reveal brings the translucent synthesizer into focus on the impact beat."],
      ["MOVEMENT", "Repeat a simple motion that the viewer can read.", "An original adult creator turns the instrument in a controlled movement phrase."],
      ["TEXTURE", "Use a detail cut to change the visual texture.", "The transparent controls and material catch colored light in a close frame."],
      ["PLATFORM CUT", "Keep framing safe for the chosen vertical placement.", "The creator and product remain inside a clean 9:16-safe composition."],
      ["CLOSE", "Leave the final beat useful for the next step.", "The synthesizer rests on the studio table with negative space for approved CTA copy."]
    ],
    adTesting: {
      eyebrow: "BUILT FOR SHORT-FORM CUTS",
      title: "Test rhythm without losing publishing discipline.",
      intro: "Use a single approved audio brief to explore different openings, product moments, and platform-safe endings without implying live trend data.",
      checklist: ["Audio permission checked", "Beat map reviewed", "Product stays identifiable", "9:16 framing", "Caption and disclosure review", "Platform destination checked"]
    },
    requirements: {
      eyebrow: "BEFORE YOU CREATE",
      title: "Bring the audio rights and the visual idea together.",
      intro: "The fastest edit is still the wrong edit if the audio is not cleared, the product disappears, or the final export cannot be published safely.",
      cards: [
        ["Authorized audio", "Confirm the file, license, source, term, region, and platforms covered by the intended use."],
        ["Visual brief", "Define what the beat should reveal, move, hold, or transition instead of asking for generic energy."],
        ["Creator and product rights", "Review talent, likeness, product, location, and any recognizable music or brand references."],
        ["Platform review", "Check aspect ratio, sound treatment, captions, disclosure, moderation, and the final publishing path."]
      ]
    },
    relatedWorkflows: {
      eyebrow: "CONTINUE THE WORKFLOW",
      title: "Move from rhythm to a fuller story.",
      intro: "Pair the sync cut with another Aidreamcapes video direction when the audience needs more context or proof.",
      items: [
        ["Cinematic film", "Use a slower visual world when the product needs atmosphere before the beat takes over.", "/ai-video-generation/cinematic-video", "Explore cinematic film"],
        ["UGC ad", "Add a creator-led hook, product proof, and a direct next step after the opening beat.", "/ai-video-generation/ugc-ad-video", "Explore UGC ads"],
        ["Hook Lab", "Test the first three seconds before building the full platform cut.", "/ai-video-generation/hook-lab", "Explore Hook Lab"]
      ]
    },
    faq: [
      ["What is Trending Audio Sync?", "It is a short-form video direction that maps approved audio beats to deliberate cuts, movement, product moments, and a reviewed platform export."],
      ["Does this workflow use live trending audio automatically?", "No. The name describes the creative direction. Use audio you are authorized to publish and do not treat the workflow as proof that a track is currently trending."],
      ["Can I use any song from a social platform?", "Only when the audio is licensed or otherwise authorized for the intended account, region, campaign, and placement. Platform availability does not automatically grant every commercial use."],
      ["What should happen on the strongest beat?", "Give it a clear visual job such as revealing the product, changing the frame, showing a useful action, or creating a deliberate hold."],
      ["Which formats should I review before publishing?", "Review the intended 9:16 cut and any platform-specific variants for sync, crop, captions, disclosure, sound, and the final destination."]
    ],
    finalCta: {
      eyebrow: "READY TO CUT TO THE BEAT?",
      title: "Make the rhythm intentional before it becomes loud.",
      body: "Create an audio-sync video that gives every beat a visual job while keeping rights, product context, and platform review in the workflow.",
      cta: "Create Audio Sync Video",
      microcopy: "Review audio rights, sync, crop, disclosure, and destination before publishing."
    }
  }
];

function imageFor(topic, fileName, alt, role) {
  const isHero = role === "product" || role === "hero";
  return {
    src: `${assetRoot}/${topic.key}/${topic.key}-${fileName}.webp`,
    alt,
    width: 400,
    height: 400,
    role,
    loading: isHero ? "eager" : "lazy",
    fetchPriority: role === "product" ? "high" : "auto",
    sizes: role === "product" || role === "hero" ? "(max-width: 1024px) 100vw, 560px" : "(max-width: 760px) 100vw, (max-width: 1200px) 50vw, 420px"
  };
}

function makeGuidance(section) {
  return { ...section, cards: section.cards.map(([title, body]) => ({ title, body })) };
}

const examplesTitleByKey = {
  "founder-update": "Show the update people can understand and verify.",
  "multilingual-video": "Give every market version room to be understood.",
  "cinematic-product-film": "Build a visual world that keeps the product real.",
  "trending-audio-sync": "Give every beat a job in the final cut."
};

function buildTopic(topic) {
  const productImage = imageFor(topic, "product", `${topic.hero.product} product source image for ${topic.hero.eyebrow.toLowerCase()}`, "product");
  const outputImage = imageFor(topic, "hero-output", `${topic.hero.output} for the Aidreamcapes ${topic.key.replaceAll("-", " ")} workflow`, "hero");
  const examples = topic.examples.map(([label, title, body], index) => ({
    title,
    body,
    noteLabel: label,
    image: imageFor(topic, `example-${String(index + 1).padStart(2, "0")}`, `${label.toLowerCase()} example for the Aidreamcapes ${topic.key.replaceAll("-", " ")} video workflow`, "content")
  }));
  const canonical = `https://www.aidreamcapes.com${topic.slug}`;
  return {
    layoutVariant: "brand-creator-detail",
    contentKey: `brand-creator-${topic.key}`,
    seo: {
      title: topic.title,
      description: topic.description,
      keywords: topic.keywords,
      canonicalPath: topic.slug,
      canonical,
      index: true,
      follow: true,
      robots: { index: true, follow: true, maxImagePreview: "large" },
      twitterDescription: topic.twitterDescription,
      ogImage: outputImage.src,
      ogImageAlt: outputImage.alt
    },
    hero: {
      eyebrow: topic.hero.eyebrow,
      title: topic.hero.title,
      body: topic.hero.body,
      primaryCta: topic.hero.primaryCta,
      primaryCtaHref: "/app/create",
      secondaryCta: topic.hero.secondaryCta,
      secondaryCtaHref: "#topic-examples",
      availabilityNote: topic.hero.availabilityNote,
      rightsCopy: topic.hero.rightsCopy,
      imageNote: topic.hero.imageNote,
      productLabel: topic.hero.productLabel,
      outputLabel: topic.hero.outputLabel,
      productImage,
      outputImage
    },
    workflowOutput: makeGuidance(topic.workflowOutput),
    workflow: makeGuidance(topic.workflow),
    creativeDirections: makeGuidance(topic.creativeDirections),
    examples: {
      eyebrow: "EXAMPLES",
      title: examplesTitleByKey[topic.key],
      intro: topic.hero.body,
      items: examples
    },
    adTesting: {
      ...topic.adTesting,
      platforms: ["Vertical · 9:16", "Product page · 16:9", "Short proof loop"]
    },
    requirements: makeGuidance(topic.requirements),
    relatedWorkflows: {
      eyebrow: topic.relatedWorkflows.eyebrow,
      title: topic.relatedWorkflows.title,
      intro: topic.relatedWorkflows.intro,
      items: topic.relatedWorkflows.items.map(([title, body, href, linkLabel]) => ({ title, body, href, linkLabel }))
    },
    faq: {
      eyebrow: "FAQ",
      title: `Questions about ${topic.hero.eyebrow.toLowerCase()}`,
      items: topic.faq.map(([question, answer]) => ({ question, answer }))
    },
    finalCta: {
      eyebrow: topic.finalCta.eyebrow,
      title: topic.finalCta.title,
      body: topic.finalCta.body,
      cta: topic.finalCta.cta,
      ctaHref: "/app/create",
      microcopy: topic.finalCta.microcopy
    }
  };
}

export const aidreamcapesBrandCreatorPageSpecs = topics.map((topic) => ({ ...topic, content: buildTopic(topic) }));
export const aidreamcapesBrandCreatorPaths = aidreamcapesBrandCreatorPageSpecs.map((page) => page.slug);

export function aidreamcapesBrandCreatorPagesForMigration() {
  return aidreamcapesBrandCreatorPageSpecs.map((page) => ({ key: page.key, slug: page.slug, title: page.title, content: page.content }));
}

function assertText(value, label) {
  assert.equal(typeof value, "string", `${label}: expected text`);
  assert.ok(value.trim(), `${label}: expected non-empty text`);
}

export async function validateAidreamcapesBrandCreatorContent({ log = console.log, requireAssets = true } = {}) {
  assert.equal(aidreamcapesBrandCreatorPageSpecs.length, 4, "Brand / Creator must contain four pages");
  const seenSourcePaths = new Set();
  for (const page of aidreamcapesBrandCreatorPageSpecs) {
    const content = page.content;
    assert.equal(content.layoutVariant, "brand-creator-detail", `${page.key}: layout variant`);
    assert.equal(content.seo.canonicalPath, page.slug, `${page.key}: canonical path`);
    assert.equal(content.seo.canonical, `https://www.aidreamcapes.com${page.slug}`, `${page.key}: canonical URL`);
    for (const [field, value] of Object.entries(content.seo)) if (field !== "robots" && field !== "index" && field !== "follow") assertText(value, `${page.key}:seo.${field}`);
    const images = [content.hero.productImage, content.hero.outputImage, ...content.examples.items.map((item) => item.image)];
    assert.equal(images.length, 9, `${page.key}: expected 9 images`);
    assert.equal(new Set(images.map((image) => image.src)).size, images.length, `${page.key}: image paths must be unique`);
    for (const image of images) {
      assert.ok(image.src.startsWith(`${assetRoot}/${page.key}/`), `${page.key}: image must stay in storefront namespace`);
      assert.ok(image.src.endsWith(".webp"), `${page.key}: image must be WebP`);
      assertText(image.alt, `${page.key}:image.alt`);
      assert.equal(image.width, 400, `${page.key}: image width`);
      assert.equal(image.height, 400, `${page.key}: image height`);
      seenSourcePaths.add(image.src);
      if (requireAssets) {
        const diskPath = path.resolve(".", "public", image.src.replace(/^\//, ""));
        const stat = await fs.stat(diskPath);
        assert.ok(stat.size > 0, `${page.key}: missing asset ${image.src}`);
      }
    }
    assert.equal(content.workflowOutput.cards.length, 4, `${page.key}: workflow output cards`);
    assert.equal(content.workflow.cards.length, 4, `${page.key}: workflow cards`);
    assert.equal(content.creativeDirections.cards.length, 4, `${page.key}: creative direction cards`);
    assert.equal(content.requirements.cards.length, 4, `${page.key}: requirements cards`);
    assert.equal(content.faq.items.length, 5, `${page.key}: FAQ items`);
    assert.equal(content.relatedWorkflows.items.length, 3, `${page.key}: related workflow items`);
    assert.equal(content.hero.secondaryCtaHref, "#topic-examples", `${page.key}: example CTA target`);
    assert.equal(content.finalCta.ctaHref, "/app/create", `${page.key}: final CTA target`);
    log(`${page.key}: seo, copy, 9 unique media records, workflow, FAQ, and CTA contract passed`);
  }
  assert.equal(seenSourcePaths.size, 36, "Brand / Creator assets must be unique across all page records");
  return true;
}
