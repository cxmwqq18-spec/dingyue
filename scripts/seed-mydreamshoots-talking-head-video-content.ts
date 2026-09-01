import type { AiVideoTopicLandingContent } from "./seed-mydreamshoots-ai-video-topic-content";

const imageRoot = "/assets/dreamshoot/talking-head-video";

function image(src: string, alt: string): { src: string; alt: string; width: number; height: number } {
  return { src: `${imageRoot}/${src}`, alt, width: 1600, height: 1000 };
}

export const talkingHeadVideoContent: AiVideoTopicLandingContent = {
  seo: {
    title: "AI Talking Head Video Generator for Business & Social | myDreamshoots",
    description: "Create AI talking head videos for business updates, training, product introductions, thought leadership, and social clips from a script or approved image.",
    keywords: "ai talking head video generator, talking head video maker, direct-to-camera video generator, presenter video generator, business update video maker, training video generator, thought leadership video maker, social talking head video",
    canonicalPath: "/ai-video-generation/talking-head-video"
  },
  hero: {
    eyebrow: "AI TALKING HEAD VIDEO GENERATOR",
    title: "AI Talking Head Video Generator for Direct-to-Camera Content",
    body: "Create presenter-led video concepts in which one person speaks directly to the viewer. Start with a focused script or an approved portrait, define the setting and delivery style, generate short scenes, and review identity, expression, timing, framing, subtitles, and every factual claim before publishing.",
    primaryCta: "Create a Talking Head Video",
    secondaryCta: "Explore AI Video Generation",
    availabilityNote: "Use the live myDreamshoots workflow to confirm supported inputs, credit requirements, generation states, output states, and controls before creating presenter visuals.",
    rightsCopy: "Use a created, licensed, or explicitly approved presenter identity. Do not use a real person's image or voice without permission, and review every result before publishing.",
    imageNote: "These AI-generated editorial references show direct-to-camera formats. They are not live product screenshots, real employees, customers, experts, or endorsements.",
    image: image("hero-talking-head-video-professional-presenter.jpg", "Professional woman presenter delivering a direct-to-camera talking head video in a modern studio."),
    images: [
      image("hero-talking-head-video-professional-presenter.jpg", "Professional woman presenter delivering a direct-to-camera talking head video in a modern studio."),
      image("hero-talking-head-video-business-message.jpg", "Business executive speaking directly to camera for a company update video."),
      image("hero-talking-head-video-social-content.jpg", "Content creator recording a social media talking head video in a home studio.")
    ],
    highlights: ["Business updates", "Training and education", "Product introductions", "Thought leadership", "Social short-form", "Text to Video", "Image to Video"]
  },
  quickAnswer: {
    eyebrow: "WHAT THIS FORMAT CREATES",
    title: "Let one presenter carry one clear message",
    intro: "Talking Head Video is a direct-to-camera format. The speaker remains the main visual and narrative anchor while captions, graphics, product visuals, and B-roll provide support.",
    cards: [
      { title: "Presenter-led", body: "Keep the speaker's face, eye line, expression, voice, and message at the center of the scene." },
      { title: "Direct-to-camera", body: "Choose a shot size, camera-facing delivery, pace, and gesture level that match the viewer's context." },
      { title: "Business-ready", body: "Use the format for updates, training, product introductions, expert commentary, webinars, and social clips without inventing authority." }
    ]
  },
  useCases: {
    eyebrow: "TALKING HEAD DIRECTIONS",
    title: "Choose the message before the visual treatment",
    intro: "A useful presenter video begins with a defined audience, outcome, script, and evidence boundary. Pick the job first, then choose framing, setting, and delivery.",
    items: [
      { title: "Founder or executive message", problem: "A company update needs a human delivery without implying an unverified spokesperson relationship.", body: "Frame an announcement, vision statement, or internal update around an approved speaker identity, clear message, and accurate company facts.", cta: "Create an Executive Message", image: image("talking-head-video-founder-message.jpg", "Female founder recording a direct-to-camera leadership message in a professional office.") },
      { title: "Training and education", problem: "A lesson or onboarding topic is difficult to follow when the presenter has no clear sequence or visual support.", body: "Use a trainer-led structure with short spoken sections, visible terminology, supporting examples, and a review pass for every instruction or claim.", cta: "Create a Training Video", image: image("talking-head-video-training-education.jpg", "Trainer speaking to camera for an educational talking head video.") },
      { title: "Marketing and thought leadership", problem: "An expert-style message can sound authoritative even when the source, credentials, or evidence are unclear.", body: "Give the speaker one point of view, one audience problem, and one supported takeaway. Do not present a generated person as a real expert or measured authority.", cta: "Create a Thought Leadership Clip", image: image("talking-head-video-marketing-thought-leadership.jpg", "Industry expert presenting a thought leadership talking head video in a modern workspace.") },
      { title: "Product introduction", problem: "The presenter explains a product while the viewer still cannot see the relevant context or product detail.", body: "Let the speaker frame the problem, audience, value, and next step while approved product visuals remain close to the claim they support.", cta: "Create a Product Introduction", image: image("talking-head-video-product-introduction.jpg", "Woman presenter introducing a product in a direct-to-camera marketing video.") },
      { title: "Remote or home-office recording", problem: "A remote setting can feel generic when the environment does not support the speaker's message or crop.", body: "Choose a realistic home-office or remote-work frame, then review background detail, lighting, eye line, captions, and safe areas in the final aspect ratio.", cta: "Create a Remote Presenter Video", image: image("talking-head-video-remote-home-office.jpg", "Professional presenter recording a talking head video from a home office.") },
      { title: "Camera and teleprompter setup", problem: "A script delivery looks stiff when the presenter, camera, and eye line are not designed together.", body: "Use short spoken lines, intentional pauses, and a camera-facing eye line. Treat teleprompter or script controls as product claims until verified in the live workflow.", cta: "Create a Scripted Presenter Video", image: image("talking-head-video-camera-teleprompter-setup.jpg", "Male presenter speaking through a teleprompter during a professional talking head video shoot.") },
      { title: "Short-form social content", problem: "A direct-to-camera idea loses clarity when the face, captions, hook, and CTA compete inside a vertical crop.", body: "Keep the opening focused, protect the face and captions from platform controls, and review the same message in the final 9:16 placement.", cta: "Create a Social Presenter Clip", image: image("talking-head-video-social-short-form.jpg", "Creator speaking close to camera for a short-form social talking head video.") },
      { title: "Branded studio production", problem: "A repeatable campaign needs consistent presenter framing and visual treatment without turning style into unsupported brand evidence.", body: "Define approved lighting, background, wardrobe, lower-third, and crop rules, then review identity and factual content for every variant.", cta: "Create a Branded Presenter Video", image: image("talking-head-video-branded-studio-production.jpg", "Woman presenter recording a branded talking head video in a blue and purple studio.") }
    ]
  },
  foundation: {
    eyebrow: "TALKING HEAD PLANNING FRAMEWORK",
    title: "Make six decisions before generating",
    intro: "The presenter format becomes easier to review when the audience, spoken message, identity, frame, delivery, and evidence boundary are explicit.",
    leftTitle: "Define",
    leftItems: ["Viewer and outcome", "Spoken script", "Presenter identity", "Framing and eye line"],
    rightTitle: "Review",
    rightItems: ["Delivery and gesture", "Claims and pronunciation", "Face, hands, and mouth movement", "Captions, crop, and disclosure"],
    rightTone: "avoid",
    expertLabel: "DIRECT-TO-CAMERA NOTE",
    expertTip: "One message per clip is easier to review than a long presentation that asks the presenter to carry every claim, feature, and CTA at once.",
    cards: [
      { title: "Viewer and outcome", body: "Decide who should watch, what they should understand, and what they should do next." },
      { title: "Spoken script", body: "Write short sentences with natural transitions, verified claims, pronunciation notes, and intentional pauses." },
      { title: "Presenter identity", body: "Use a created, licensed, or explicitly approved identity and document what the speaker is allowed to imply." },
      { title: "Framing and eye line", body: "Specify close-up, chest-up, waist-up, seated, or standing framing with a camera-facing eye line when direct address is the goal." },
      { title: "Delivery direction", body: "Define tone, pace, emphasis, expression, and gesture level before adding visual polish." },
      { title: "Evidence boundary", body: "Keep product facts, credentials, testimonials, numbers, titles, and customer outcomes tied to real source material." }
    ]
  },
  guidance: {
    eyebrow: "DIRECT-TO-CAMERA QUALITY GUIDE",
    title: "Keep the presenter natural and reviewable",
    intro: "Polish should help the viewer understand the message, not hide identity, timing, claims, or unsupported authority.",
    cards: [
      { title: "Write for speech", body: "Use a spoken hook, concise sentences, clear transitions, verified claims, pronunciation notes, and pauses." },
      { title: "Protect consistency", body: "Review face, eyes, hairstyle, clothing, lighting, body proportions, and background across related shots." },
      { title: "Check mouth movement", body: "Judge audio and facial motion together, especially for names, numbers, technical terms, and captions." },
      { title: "Use B-roll as support", body: "Product visuals, charts, interfaces, and cutaways should clarify the message without replacing the presenter-led format." },
      { title: "Design for crop safety", body: "Protect the face, captions, lower thirds, and CTA in 16:9, 9:16, and 1:1 placements." },
      { title: "Do not manufacture authority", body: "A polished generated presenter is not proof of a real employee, customer, expert, endorsement, or measured outcome." }
    ]
  },
  comparison: {
    eyebrow: "RELATED VIDEO TOPICS",
    title: "Choose the page that matches the viewer's job",
    intro: "Keep neighboring formats distinct so the viewer lands on the format that actually answers the question.",
    items: [
      { title: "Explainer Video", body: "Owns diagrams, interfaces, charts, system relationships, and information-led explanation.", href: "/ai-video-generation/explainer-video", linkLabel: "Explore Explainer Video" },
      { title: "How-to Video", body: "Owns ordered task instruction, prerequisites, demonstrations, and visible checkpoints.", href: "/ai-video-generation/how-to-video", linkLabel: "Explore How-to Video" },
      { title: "AI Video Generation", body: "Browse the full directory when the creative job is not yet clear.", href: "/ai-video-generation", linkLabel: "Browse AI Video Generation" }
    ]
  },
  evidence: {
    eyebrow: "FIRST-PARTY PRODUCT EVIDENCE",
    title: "Show the real workflow before publishing",
    intro: "Editorial presenter images explain the format. They do not prove a current myDreamshoots capability or control.",
    cards: [
      { title: "Actual input path", body: "Document the current Text to Video and Image to Video paths with a verified product capture and source description.", exampleLabel: "Live product evidence required", exampleBody: "No first-party input capture is included in this editorial package." },
      { title: "Actual controls", body: "Name only controls that exist in the current product. Do not imply teleprompter, voice, avatar, duration, subtitle, or multilingual controls without proof.", exampleLabel: "Live product evidence required", exampleBody: "Product verification is required before publishing control claims." },
      { title: "Actual generated output", body: "Add a real talking-head-style output and matching thumbnail from the current workflow, not a stock or editorial presenter image.", exampleLabel: "Live product evidence required", exampleBody: "A public generated output was not supplied with this package." },
      { title: "Verified usage facts", body: "Confirm credits, generation states, output states, supported aspect ratios, crop behavior, and any disclosure or rights terms.", exampleLabel: "Live product details", exampleBody: "Keep the page aligned with the current generation workflow and published usage terms." }
    ]
  },
  steps: {
    eyebrow: "HOW IT WORKS",
    title: "From presenter brief to reviewed draft",
    items: [
      { title: "Define the viewer and outcome", body: "Choose the audience, platform, message, and one call to action." },
      { title: "Prepare the spoken script", body: "Use concise lines, natural pauses, pronunciation notes, and claims that can be checked against source material." },
      { title: "Choose the presenter identity", body: "Use a created, licensed, or explicitly approved identity and record the likeness, disclosure, and speaker-status boundary." },
      { title: "Set frame and delivery", body: "Describe shot size, eye line, setting, tone, pace, expression, gesture, lighting, and what must remain stable." },
      { title: "Generate short scenes", body: "Use the supported text or image path and create reviewable sections instead of requesting one unsupported long-form presentation." },
      { title: "Review the real output", body: "Check identity, face, hands, mouth movement, timing, names, titles, numbers, captions, crop, lighting, and background continuity." },
      { title: "Publish with context", body: "Add approved product visuals, captions, disclosure, rights language, and a CTA that matches the destination and verified capability." }
    ],
    cta: "Create a Talking Head Video"
  },
  value: {
    eyebrow: "MESSAGE AND EVIDENCE BOUNDARY",
    title: "A presenter can deliver a message; source material must carry the proof",
    intro: "Use the format to make a message clear while keeping claims, credentials, product facts, and outcomes independently verifiable.",
    items: [
      { title: "Keep one message per clip", body: "Introduce, explain, prove, or close rather than forcing every feature and claim into one scene." },
      { title: "Keep facts close to evidence", body: "Product capabilities, titles, numbers, dates, customer outcomes, and technical behavior need approved source material." },
      { title: "Separate presenter from proof", body: "A generated face or polished delivery does not verify identity, expertise, employment, customer experience, or endorsement." },
      { title: "Match the final crop", body: "Review face, captions, lower thirds, B-roll, and CTA after adapting to the final 16:9, 9:16, or 1:1 placement." }
    ]
  },
  trust: {
    eyebrow: "RESPONSIBLE USE",
    title: "Keep presenter-led content accurate and clearly identified",
    intro: "Before publishing a talking head video:",
    items: [
      { title: "Confirm identity rights", body: "Use only a created, licensed, or explicitly approved presenter identity, likeness, and voice source." },
      { title: "Identify speaker status", body: "Do not describe a generated or scripted person as a real employee, customer, expert, or endorser without a genuine authorized relationship." },
      { title: "Verify factual claims", body: "Check names, titles, product behavior, statistics, dates, technical statements, and customer outcomes against trusted sources." },
      { title: "Review synthetic-media disclosure", body: "Follow the destination's current disclosure requirements for generated people, voices, sponsorship, and endorsements." },
      { title: "Review mouth movement and captions", body: "Plausible facial motion does not guarantee the correct words, names, numbers, or subtitle timing." },
      { title: "Keep CTA and destination consistent", body: "The next action should match the message promise and the live workflow the visitor can actually use." }
    ]
  },
  faq: {
    eyebrow: "FAQ",
    title: "Questions about AI talking head video generation",
    items: [
      { question: "What is an AI talking head video generator?", answer: "It is a workflow for creating direct-to-camera presenter scenes from a written description, an approved image, or other supported inputs. The presenter remains the main visual and carries the spoken message." },
      { question: "Can I create a talking head video from a script?", answer: "Use Text to Video when the script, presenter description, camera framing, setting, delivery style, and scene role can be described in words. Generate short sections and compare each result with the approved script." },
      { question: "Can I create a talking head video from a photo?", answer: "Use Image to Video when an approved portrait should anchor the presenter's appearance. Confirm likeness rights, review facial consistency and mouth movement, and do not use a real person's image without permission." },
      { question: "How do I make a talking head video look natural?", answer: "Use a concise spoken script, clear eye line, realistic pauses, restrained gestures, consistent lighting, and a background that supports the message. Review the face, hands, voice, timing, and captions together." },
      { question: "What can a talking head video be used for?", answer: "Common uses include business updates, founder messages, employee training, product introductions, expert commentary, customer education, webinars, and social media clips." },
      { question: "How is Talking Head Video different from AI Avatar Video?", answer: "Talking Head Video owns the direct-to-camera content format. AI Avatar Video owns synthetic presenter identity, avatar selection, voice, lip-sync, and multilingual virtual-presenter workflows." }
    ]
  },
  finalCta: {
    eyebrow: "CREATE WITH VERIFIED SOURCE MATERIAL",
    title: "Turn one clear message into a reviewable presenter video",
    body: "Define the audience, script, presenter identity, eye line, delivery, and evidence boundary. Generate short scenes, inspect the real output, and publish only after claims, rights, captions, crop, and disclosure are checked.",
    cta: "Create a Talking Head Video",
    microcopy: "Generated presenter references are editorial examples. Product capability, identity, claims, and output quality still require independent review."
  }
};
