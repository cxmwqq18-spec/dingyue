const html = (strings, ...values) => String.raw({ raw: strings }, ...values).replace(/\n\s+/g, "").trim();

const sharedDefaults = {
  author: "myDreamshoots editorial team",
  authorType: "Organization",
  publishedAt: "2026-09-27",
  updatedAt: "2026-09-27",
  reviewedAt: "2026-09-27",
  evidenceDate: "2026-09-27",
  evidenceType: "editorial-guidance",
  authorUrl: "/about-us",
  reviewOwner: "myDreamshoots editorial team",
  primaryCta: "Explore AI video themes",
  primaryHref: "/ai-video-generation",
  secondaryCta: "View pricing",
  secondaryHref: "/pricing"
};

export const MYDREAMSHOOTS_VIDEO_BLOG_SLUGS = [
  "/blog/talking-photo-video-guide",
  "/blog/motion-generator-video-guide",
  "/blog/cinematic-video-guide"
];

export const mydreamshootsVideoBlogArticles = [
  {
    ...sharedDefaults,
    slug: "/blog/talking-photo-video-guide",
    pageTitle: "Talking Photo video guide",
    title: "Talking Photo Videos: Plan the Portrait, Script, and Review",
    summary: "A practical Talking Photo guide for choosing one clear portrait, writing a focused message, checking facial motion, and deciding whether the result is ready to share.",
    imageUrl: "/assets/dreamshoot/generated/homepage-showcase/posters/first-frame-talking-photo.jpg",
    imageAlt: "Portrait source prepared for a talking photo video with a clear face and simple framing.",
    tags: "Talking Photo|AI video|Portrait animation|Script planning|Private review",
    seoTitle: "AI Talking Photo Guide: Script, Source, and Review | myDreamshoots",
    seoDescription: "Plan an AI talking photo with one clear portrait, a focused script, permission-safe inputs, and a practical review checklist before sharing.",
    seoKeywords: "AI talking photo guide, make a photo talk, portrait animation, talking photo script, myDreamshoots",
    targetLabel: "Open Talking Photo",
    targetHref: "/ai-video-generation/talking-photo",
    entityName: "Talking Photo",
    primaryKeyword: "AI talking photo guide",
    searchIntent: "Learn how to prepare a portrait and short message for a talking-photo video, then review the result for identity, delivery, and permission risks.",
    productSlug: "talking-photo",
    userIntent: "Create a short talking-photo direction from one clear portrait and a focused message.",
    suitableUses: ["birthday wishes", "personal messages", "social introductions", "product pitches", "holiday greetings"],
    unsuitableUses: ["identity verification", "unapproved impersonation", "official statements from another person"],
    inputRequirements: ["one clear portrait", "a short focused message", "permission to animate the source photo"],
    verifiedLimitations: ["Facial motion, lip alignment, expression, and delivery still require a human review before publishing."],
    comparisonTargets: ["Talking Photo", "Motion Generator", "Cinematic Video"],
    reviewChecklist: ["facial identity", "mouth and eye motion", "script delivery", "background and crop", "rights and consent"],
    rightsWarnings: ["Use a photo you own or have permission to animate. Do not make a person appear to endorse a message they did not approve."],
    relatedGuides: ["Motion Generator", "Cinematic Video", "Content policy"],
    relatedLinks: [
      { label: "Open Talking Photo", href: "/ai-video-generation/talking-photo" },
      { label: "Compare Motion Generator", href: "/blog/motion-generator-video-guide" },
      { label: "Compare Cinematic Video", href: "/blog/cinematic-video-guide" },
      { label: "Read the content policy", href: "/policies/content" }
    ],
    readMinutes: "8",
    body: html`
      <p><strong>Quick answer:</strong> Talking Photo works best when you start with one clear portrait and one short message that a real person could naturally deliver. The theme is suited to birthday wishes, personal notes, social introductions, product pitches, and holiday greetings. It is not a substitute for identity verification, a recorded statement, or permission from the person shown. Prepare the source and script first, then inspect the whole clip before you download or share it.</p>
      <h2 id="talking-photo-use-case">Decide what the talking photo needs to communicate</h2>
      <p>Begin with the viewer and the intended action. A birthday greeting may need warmth and a name. A social introduction may need one sentence about the person. A product pitch may need a clear benefit without implying a claim that has not been checked. Write the purpose in one line before you choose a portrait. If the purpose cannot be explained simply, the video brief is probably carrying too many jobs.</p>
      <p>Keep the message narrow enough to review. One greeting, one invitation, or one short explanation is easier to judge than a long script with several emotional changes. Avoid adding facts, promises, or opinions that the depicted person has not approved. For a brand or product use, verify the wording separately because a talking face can make uncertain copy feel more authoritative than it is.</p>
      <h2 id="talking-photo-source">Choose one clear portrait</h2>
      <p>Use a recent, permission-safe portrait where the face is large enough to inspect. Even lighting, a visible mouth, and a calm head position make the result easier to review. A simple background is useful because it leaves fewer unrelated edges moving around the face. Keep the original file so you can compare the output with the source instead of relying on memory.</p>
      <ul><li>Use one person who has approved the image and the intended message.</li><li>Keep the face unobstructed by sunglasses, hands, heavy shadows, or large accessories.</li><li>Prefer a natural expression that fits the tone of the script.</li><li>Avoid group photos when the output needs to make one speaker unambiguous.</li></ul>
      <p>Do not treat a sharper or more dramatic portrait as automatically better. A stylized image can be useful for a creative greeting, but it may make mouth, eyes, hair, or facial edges harder to assess. When the main goal is a believable message, source clarity is more valuable than visual complexity.</p>
      <h2 id="talking-photo-script">Write a script that sounds like one person</h2>
      <p>Draft the spoken line in ordinary language. Use one point of view, short sentences, and punctuation that shows where a speaker would pause. Names, dates, product terms, and unusual words deserve an extra read because pronunciation can change the meaning of an otherwise good message. If a word is essential, consider a simpler phrase rather than hiding a difficult pronunciation inside a long sentence.</p>
      <table><thead><tr><th>Script choice</th><th>Why it helps review</th></tr></thead><tbody><tr><td>One clear greeting or idea</td><td>Makes tone, pacing, and message accuracy easier to compare.</td></tr><tr><td>Short sentences</td><td>Reduces long mouth-motion sequences that are difficult to inspect.</td></tr><tr><td>Plain punctuation</td><td>Gives the delivery natural places to pause.</td></tr><tr><td>Verified names and claims</td><td>Prevents an animated portrait from carrying unchecked information.</td></tr></tbody></table>
      <p>Keep the written script beside the result. Watch once for the overall feeling, then watch again with the text open. This two-pass review catches a different class of problems: the first pass reveals whether the delivery feels coherent, while the second checks whether the spoken words match the approved copy.</p>
      <h2 id="talking-photo-review">Review the face, voice direction, and frame</h2>
      <p>The most important review is not whether the first second looks impressive. It is whether the whole clip remains understandable and permission-safe. Check the face from the opening frame through the final pause. Look for sudden identity drift, eyes that stop tracking naturally, mouth shapes that do not match the message, or a head movement that changes the apparent person.</p>
      <ul><li>Compare the face with the original portrait at the start, middle, and end.</li><li>Watch the mouth on names, numbers, and emphasized words.</li><li>Check eye direction, teeth, jaw edges, hair, and earrings for abrupt changes.</li><li>Confirm the crop does not cut off an important facial cue or add misleading context.</li><li>Listen or read along for an invented claim, altered meaning, or tone the person did not approve.</li></ul>
      <p>If the clip fails one of these checks, keep the source and script but change one variable at a time. A clearer portrait may address identity drift; a shorter sentence may address delivery; a simpler crop may address distracting background motion. Changing everything at once makes the next result harder to diagnose.</p>
      <h2 id="talking-photo-when-to-choose">Choose Talking Photo or another video theme</h2>
      <p>Choose <a href="/ai-video-generation/talking-photo">Talking Photo</a> when the face is the speaker and the message is the main event. Choose <a href="/blog/motion-generator-video-guide">Motion Generator</a> when a still image should gain deliberate subject or camera movement without a spoken message. Choose <a href="/blog/cinematic-video-guide">Cinematic Video</a> when the brief depends on shot design, lighting, atmosphere, and a scene arc rather than one portrait delivering a line.</p>
      <table><thead><tr><th>Need</th><th>Better starting direction</th><th>Review first</th></tr></thead><tbody><tr><td>A person delivering a short message</td><td>Talking Photo</td><td>Identity, mouth motion, wording, and consent.</td></tr><tr><td>A controlled move from an approved still</td><td>Motion Generator</td><td>Subject continuity, camera path, and crop.</td></tr><tr><td>A mood-led story scene</td><td>Cinematic Video</td><td>Shot logic, lighting continuity, and scene details.</td></tr></tbody></table>
      <p>Open the <a href="/ai-video-generation/talking-photo">Talking Photo theme page</a> before starting to see the current workflow and visible credit cost. Those details matter because the best choice depends on whether the input is one portrait, a movement concept, or a broader cinematic brief. Do not promise a fixed output length or cost in a blog post when the live theme page can change.</p>
      <h2 id="talking-photo-sharing">Prepare a safe handoff before sharing</h2>
      <p>Keep the approved portrait, the final script, and the reviewed video together until the message has been accepted by the person depicted. Remove drafts that contain an unintended likeness, private background detail, or unapproved brand reference. If the video appears in a marketing or public context, check the relevant permissions and disclosures before publication.</p>
      <p>The <a href="/policies/content">content policy</a> is the right place to review the boundary for likenesses, protected material, and misleading uses. The private gallery helps you compare versions, but privacy inside an account is not the same thing as permission to publish. Treat the final sharing decision as a separate editorial step.</p>
      <h2 id="talking-photo-faq">Talking Photo FAQ</h2>
      <h3 id="talking-photo-faq-photo">What kind of photo should I use?</h3>
      <p>Use one recent portrait with a visible face, readable mouth area, and permission for the intended animation. A calm expression and simple lighting make identity and facial motion easier to inspect.</p>
      <h3 id="talking-photo-faq-script">How long should the message be?</h3>
      <p>Keep it to one focused idea with short sentences. The live theme page determines the current workflow constraints, but a concise message is easier to compare with the output and less likely to drift in tone.</p>
      <h3 id="talking-photo-faq-endorsement">Can I make someone appear to endorse something?</h3>
      <p>Only with the person’s permission and accurate, approved wording. Do not use an animated portrait to create a statement, endorsement, or announcement that the depicted person did not authorize.</p>
      <h3 id="talking-photo-faq-review">What should I check before sharing?</h3>
      <p>Check identity at several points, mouth and eye motion, the script meaning, crop, background details, and permission. If any part is uncertain, keep the result private and revise one input at a time.</p>
    `
  },
  {
    ...sharedDefaults,
    slug: "/blog/motion-generator-video-guide",
    pageTitle: "Motion Generator video guide",
    title: "AI Motion Generator: Turn One Photo Into a Reviewable Video",
    summary: "Learn how to turn an approved still into a coherent motion concept by choosing one movement, protecting subject continuity, and reviewing the complete clip.",
    imageUrl: "/assets/dreamshoot/generated/homepage-showcase/posters/prompt-directed-motion.webp",
    imageAlt: "Still image prepared for prompt-directed motion with a clear subject and controlled camera idea.",
    tags: "Motion Generator|AI video|Image to video|Camera movement|Private review",
    seoTitle: "AI Motion Generator Guide: Animate One Photo | myDreamshoots",
    seoDescription: "Turn one approved still into a coherent AI video with a clear movement direction, camera plan, continuity checks, and a practical review workflow.",
    seoKeywords: "AI motion generator guide, animate a photo, image to video, camera movement, myDreamshoots",
    targetLabel: "Open Motion Generator",
    targetHref: "/ai-video-generation/motion-generator",
    entityName: "Motion Generator",
    primaryKeyword: "AI motion generator guide",
    searchIntent: "Learn how to animate one approved still with controlled subject movement, camera motion, pacing, and visual continuity.",
    productSlug: "motion-generator",
    userIntent: "Turn an approved still image into a short, coherent motion concept with deliberate movement and camera direction.",
    suitableUses: ["portrait motion studies", "social intros", "product atmosphere tests", "private album add-ons", "concept clips"],
    unsuitableUses: ["proof of a real event", "exact product demonstration without review", "unapproved likeness or brand promotion"],
    inputRequirements: ["one approved still image", "one primary movement direction", "permission to transform the source image"],
    verifiedLimitations: ["Generated subject movement, camera motion, pacing, and visual continuity require review across the complete clip."],
    comparisonTargets: ["Motion Generator", "Talking Photo", "Cinematic Video"],
    reviewChecklist: ["subject continuity", "camera path", "hands and hair", "background geometry", "crop and pacing"],
    rightsWarnings: ["Use images you own or have permission to animate. Review the full result before publishing or using it in a commercial context."],
    relatedGuides: ["Talking Photo", "Cinematic Video", "Content policy"],
    relatedLinks: [
      { label: "Open Motion Generator", href: "/ai-video-generation/motion-generator" },
      { label: "Compare Talking Photo", href: "/blog/talking-photo-video-guide" },
      { label: "Compare Cinematic Video", href: "/blog/cinematic-video-guide" },
      { label: "Read the content policy", href: "/policies/content" }
    ],
    readMinutes: "8",
    body: html`
      <p><strong>Quick answer:</strong> Motion Generator is a useful starting point when you already have an approved still and want one deliberate movement idea: a slow camera drift, a controlled subject turn, a reveal, or a restrained environmental cue. The reliable workflow is to define the subject, choose one dominant motion, keep the frame readable, and review the full result for continuity. It is not evidence that a real event happened, and it should not be used to make an unapproved person or product appear to do something.</p>
      <h2 id="motion-generator-brief">Start with the still image and the intended viewer</h2>
      <p>Before writing a motion direction, decide what the viewer should notice first. A portrait clip may need the face and wardrobe to remain stable. A product atmosphere test may need the object silhouette and surface to stay legible. A private album add-on may need a gentle camera move that adds life without changing the original mood. The first review question is therefore not “What can move?” but “What must remain recognizable?”</p>
      <p>Keep the approved still as the visual reference. Do not begin with a complicated scene change if the source image already contains the subject you want. A focused brief gives the motion pass a smaller continuity problem and gives you a clearer reason to keep or reject the result.</p>
      <h2 id="motion-generator-input">Prepare a source frame that can carry motion</h2>
      <p>Use one clear image with enough space around the main subject for the intended move. Check the face, hands, hair, clothing edges, product outline, and background geometry before generation. A source with a cropped hand, tiny face, busy text, or reflective surface may still be creative, but it gives the result more details to interpret.</p>
      <ul><li>Keep the subject and the most important edges in focus.</li><li>Remove unintended text, logos, or private background details before upload.</li><li>Choose a crop that leaves room for the camera direction you want to test.</li><li>Retain the original file and note the intended use of the output.</li></ul>
      <p>Permission is part of source preparation. Use an image you own or have permission to transform. If another person, a recognizable property, or a protected product mark appears in the frame, resolve that permission before you invest time in refining the movement.</p>
      <h2 id="motion-generator-direction">Describe one dominant movement</h2>
      <p>Motion becomes easier to judge when the prompt has a clear hierarchy. Name the subject first, then the primary motion, then the camera behavior, then the pace. For example: “Keep the approved portrait stable while the camera makes a slow side drift; let the background light shift subtly.” This gives the result one main task and one supporting task.</p>
      <table><thead><tr><th>Movement brief</th><th>What it is good for</th><th>What to inspect</th></tr></thead><tbody><tr><td>Slow camera drift</td><td>Adding life to a portrait or still scene.</td><td>Face stability, crop, and background geometry.</td></tr><tr><td>Controlled subject turn</td><td>Showing a little more profile or wardrobe.</td><td>Eyes, jawline, hands, and clothing joins.</td></tr><tr><td>Reveal from a fixed frame</td><td>Directing attention to an object or detail.</td><td>New edges, text, and whether the reveal invents context.</td></tr><tr><td>Subtle environment cue</td><td>Adding wind, light, or atmosphere without a scene change.</td><td>Hair, shadows, reflections, and consistency with the source.</td></tr></tbody></table>
      <p>Avoid asking for a camera orbit, a large pose change, a new wardrobe, a speaking performance, and a location transformation in the same first pass. Those are separate review questions. If the first result needs a different kind of movement, save the approved still and change only the movement concept.</p>
      <h2 id="motion-generator-continuity">Review continuity frame by frame</h2>
      <p>A motion clip can feel coherent at normal speed while still containing errors that matter when paused. Watch once at full speed for pacing and then pause at the opening, middle, and final moments. Compare the subject with the original still. Look for face drift, extra fingers, changing jewelry, hair that joins the background, impossible shadows, and perspective changes that the source does not support.</p>
      <ul><li>Does the main face or object remain the same across the clip?</li><li>Does the camera move in the direction described instead of adding a second move?</li><li>Do hands, hair, clothing, props, and product edges remain plausible?</li><li>Does the crop keep the subject visible and leave enough room for the intended channel?</li><li>Do reflections, shadows, text, and background lines stay consistent?</li></ul>
      <p>Rejecting a result is useful information. If the identity is stable but the background bends, keep the subject and simplify the camera direction. If the camera is right but the face changes, choose a clearer source frame or reduce the subject movement. A one-variable revision is easier to learn from than a complete restart.</p>
      <h2 id="motion-generator-comparison">Compare Motion Generator with Talking Photo and Cinematic Video</h2>
      <p>Use <a href="/ai-video-generation/motion-generator">Motion Generator</a> when the starting point is one approved still and the main question is how that still should move. Use <a href="/blog/talking-photo-video-guide">Talking Photo</a> when a portrait needs to deliver a focused message. Use <a href="/blog/cinematic-video-guide">Cinematic Video</a> when the brief needs a stronger scene, shot design, lighting plan, or story mood.</p>
      <table><thead><tr><th>Brief</th><th>Recommended direction</th><th>Core review</th></tr></thead><tbody><tr><td>Animate an existing portrait with a restrained move</td><td>Motion Generator</td><td>Continuity, camera motion, pacing, and crop.</td></tr><tr><td>Make one portrait deliver words</td><td>Talking Photo</td><td>Permission, facial motion, and message accuracy.</td></tr><tr><td>Build a mood-led sequence or scene</td><td>Cinematic Video</td><td>Shot logic, lighting, environment, and story rhythm.</td></tr></tbody></table>
      <p>Review the <a href="/ai-video-generation/motion-generator">Motion Generator theme page</a> for the current workflow and visible credit cost before starting. The live page is the source for changing operational details. This guide supplies the decision framework: one source frame, one dominant movement, and a review that protects the parts of the image the viewer must recognize.</p>
      <h2 id="motion-generator-use-cases">Match the movement to a real use</h2>
      <p>For a social intro, a slow camera move can preserve a recognizable face while adding a little presence. For a product atmosphere test, a small reveal can direct attention to the approved object without pretending that the generated clip is a technical demonstration. For a private album, a subtle environmental cue can make a still feel less static while keeping the original person and setting easy to identify.</p>
      <p>When the output leaves the private gallery, add the context a viewer needs. Do not present generated motion as documentary proof of a location, event, product capability, or personal action. If a scene contains a brand, recognizable person, or protected design, review the <a href="/policies/content">content policy</a> and the permissions that apply to your use.</p>
      <h2 id="motion-generator-faq">Motion Generator FAQ</h2>
      <h3 id="motion-generator-faq-photo">What is the best source photo?</h3>
      <p>Use one clear image with a readable subject, stable edges, and enough room for the intended camera or subject movement. Keep the original so you can compare the first, middle, and final moments of the video.</p>
      <h3 id="motion-generator-faq-prompt">How many movements should I request?</h3>
      <p>Start with one dominant movement and at most a small supporting cue. Combining several large changes makes continuity harder to diagnose and can hide which part of the brief caused an unwanted result.</p>
      <h3 id="motion-generator-faq-speech">Can Motion Generator make the portrait speak?</h3>
      <p>Choose Talking Photo when the portrait needs to deliver a message. Motion Generator is the clearer fit when subject movement, camera motion, pacing, and visual continuity matter more than speech.</p>
      <h3 id="motion-generator-faq-publish">What should I check before publishing?</h3>
      <p>Review identity, hands, hair, clothing, props, background lines, reflections, text, camera direction, crop, and permission. Watch both at full speed and at paused checkpoints before deciding that a result is ready.</p>
    `
  },
  {
    ...sharedDefaults,
    slug: "/blog/cinematic-video-guide",
    pageTitle: "Cinematic Video guide",
    title: "AI Cinematic Video: Build a Scene With Mood and Motion",
    summary: "Plan a cinematic video around a clear scene question, a small shot structure, consistent lighting, and a review that separates creative atmosphere from unsupported claims.",
    imageUrl: "/assets/dreamshoot/generated/homepage-showcase/posters/first-frame-cinematic-video.jpg",
    imageAlt: "Cinematic video scene with deliberate lighting, composition, and atmosphere for a short concept clip.",
    tags: "Cinematic Video|AI video|Shot design|Story scenes|Visual mood",
    seoTitle: "AI Cinematic Video Guide: Mood, Shots, and Motion | myDreamshoots",
    seoDescription: "Plan an AI cinematic video with a clear scene goal, compact shot structure, lighting direction, camera movement, and a careful final review.",
    seoKeywords: "AI cinematic video guide, cinematic AI video, shot design, story scene generator, myDreamshoots",
    targetLabel: "Open Cinematic Video",
    targetHref: "/ai-video-generation/cinematic-video",
    entityName: "Cinematic Video",
    primaryKeyword: "AI cinematic video guide",
    searchIntent: "Learn how to plan a short cinematic scene with mood, shot design, lighting, pacing, camera movement, and permission-safe source material.",
    productSlug: "cinematic-video",
    userIntent: "Create a short story-driven video concept with deliberate mood, shot design, lighting, pacing, and camera movement.",
    suitableUses: ["story scenes", "launch concepts", "music visual drafts", "sci-fi concepts", "brand storytelling with approval"],
    unsuitableUses: ["documentary evidence", "unapproved brand or celebrity promotion", "claims that depend on an exact real-world event"],
    inputRequirements: ["a clear scene goal", "approved source material or a text direction", "one coherent mood and shot plan"],
    verifiedLimitations: ["Lighting, text, hands, faces, product details, continuity, and generated scene facts require review before publishing."],
    comparisonTargets: ["Cinematic Video", "Motion Generator", "Talking Photo"],
    reviewChecklist: ["scene continuity", "lighting and shadows", "camera movement", "subject identity", "text and brand details"],
    rightsWarnings: ["Use only content you own or have permission to transform. Review the final result before publishing, especially for people, products, locations, and marks."],
    relatedGuides: ["Motion Generator", "Talking Photo", "Content policy"],
    relatedLinks: [
      { label: "Open Cinematic Video", href: "/ai-video-generation/cinematic-video" },
      { label: "Compare Motion Generator", href: "/blog/motion-generator-video-guide" },
      { label: "Compare Talking Photo", href: "/blog/talking-photo-video-guide" },
      { label: "Read the content policy", href: "/policies/content" }
    ],
    readMinutes: "9",
    body: html`
      <p><strong>Quick answer:</strong> Cinematic Video is the right starting point when the brief is about a scene rather than a single speaking portrait or one isolated camera move. Define the scene question, keep the shot plan compact, choose a consistent lighting and mood direction, and review every important detail before sharing. A cinematic look can suggest a story, but it does not prove that a location, event, product capability, or person’s action exists in the real world.</p>
      <h2 id="cinematic-video-purpose">Define the scene before choosing the style</h2>
      <p>Write the scene in one sentence: who or what is present, what changes, and what the viewer should feel or understand. “A lone traveler reaches a rain-lit station and notices a warm window” gives the video a subject, a change, and a visual focus. “Make it cinematic and dramatic” describes taste but does not tell the scene what to do.</p>
      <p>Choose a mood that supports the scene question. Noir lighting, a luxury launch, a sci-fi corridor, a period-inspired room, and a music visual can all be valid creative directions, but they carry different review needs. The more specific the mood, the more important it is to check signs, props, clothing, architecture, and other details that may accidentally imply a real place or affiliation.</p>
      <h2 id="cinematic-video-shot-plan">Use a compact shot plan</h2>
      <p>A short video usually benefits from a small number of readable beats. Start with an establishing view or a clear subject frame, move to the action or reveal, and finish on an image that gives the viewer a reason to remember the scene. You do not need a full screenplay to make the order clear; you do need to know which visual fact changes between the shots.</p>
      <table><thead><tr><th>Beat</th><th>Question to answer</th><th>Review focus</th></tr></thead><tbody><tr><td>Opening</td><td>Where are we, and what should the viewer notice?</td><td>Composition, readable subject, and background context.</td></tr><tr><td>Middle</td><td>What action, reveal, or change carries the scene?</td><td>Continuity, subject direction, and camera logic.</td></tr><tr><td>Closing</td><td>What image or feeling should remain?</td><td>Final crop, lighting, identity, text, and story clarity.</td></tr></tbody></table>
      <p>Keep the first version small. If the opening, middle, and closing all introduce new characters, locations, props, and lighting schemes, it becomes difficult to tell whether a weak result comes from the story or from continuity. A focused scene creates a better basis for a second version.</p>
      <h2 id="cinematic-video-lighting">Make lighting and camera movement agree</h2>
      <p>Lighting is not just a color preset. It tells the viewer where the subject is and why the scene feels calm, tense, intimate, distant, polished, or unfamiliar. Name the source and direction when it matters: a soft window from camera left, a hard overhead practical, a cool street reflection, or a warm pool of light behind the subject.</p>
      <ul><li>Choose one primary light direction for the opening and carry it through the action.</li><li>Use camera movement to reveal the scene, not to hide missing structure.</li><li>Keep the subject’s screen direction consistent unless a deliberate change is part of the story.</li><li>Reserve strong effects for moments where they add information or mood.</li></ul>
      <p>Watch for shadows that move independently from the subject, reflections that show the wrong angle, and backgrounds that change scale without a camera reason. These are not always reasons to abandon a concept, but they are reasons to revise the shot plan or keep the clip in a private concept stage.</p>
      <h2 id="cinematic-video-source-material">Choose source material that supports the story</h2>
      <p>If the scene uses a person, start from an approved image and decide whether identity should remain a central part of the story. If the scene uses a product, keep its silhouette, label, and important surfaces easy to inspect. If the direction is fully fictional, make that fictional framing clear in the brief and in the eventual presentation.</p>
      <p>Do not use a cinematic treatment to smuggle in a real person’s likeness, a protected logo, a private location, or a claim that has not been authorized. The <a href="/policies/content">content policy</a> is part of the creative workflow because a polished scene can still create a misleading impression. Keep source files, approvals, and the final review notes with the project.</p>
      <h2 id="cinematic-video-review">Review the story and the individual frames</h2>
      <p>Watch the clip once without pausing. Ask whether the scene has a beginning, a change, and an ending that can be understood without an explanation. Then pause the important moments. Check faces, hands, clothing, props, architecture, signs, product details, reflections, and shadows. A scene can be emotionally effective and still contain a detail that must be removed before public use.</p>
      <ul><li>Confirm that the same subject remains the same person or object.</li><li>Check that the camera path supports the shot purpose and does not introduce a confusing jump.</li><li>Inspect lettering, numbers, logos, uniforms, and interface-like details separately.</li><li>Compare light direction and shadow behavior between the opening, action, and closing.</li><li>Decide whether a viewer could mistake a fictional scene for a real report or endorsement.</li></ul>
      <p>When a scene needs revision, identify the failed beat instead of rewriting the entire idea. A stronger opening may fix context; a simpler middle may fix continuity; an approved text overlay added after generation may fix lettering. This keeps the creative decision and the technical correction visible.</p>
      <h2 id="cinematic-video-comparison">Choose Cinematic Video, Motion Generator, or Talking Photo</h2>
      <p>Choose <a href="/ai-video-generation/cinematic-video">Cinematic Video</a> when atmosphere, shot design, lighting, pacing, and a story moment lead the brief. Choose <a href="/blog/motion-generator-video-guide">Motion Generator</a> when one approved still should gain controlled motion. Choose <a href="/blog/talking-photo-video-guide">Talking Photo</a> when one portrait needs to deliver a focused message.</p>
      <table><thead><tr><th>Primary question</th><th>Best starting direction</th><th>Most important check</th></tr></thead><tbody><tr><td>What should this still do?</td><td>Motion Generator</td><td>Movement and continuity.</td></tr><tr><td>What should this portrait say?</td><td>Talking Photo</td><td>Permission, facial motion, and wording.</td></tr><tr><td>What scene should the viewer enter?</td><td>Cinematic Video</td><td>Shot order, mood, lighting, and scene facts.</td></tr></tbody></table>
      <p>Open the <a href="/ai-video-generation/cinematic-video">Cinematic Video theme page</a> to review the current workflow and visible credit cost. The live product page should own changing operational details. This guide helps you decide whether your idea actually needs a scene-led workflow and which details should be reviewed before you share the result.</p>
      <h2 id="cinematic-video-sharing">Separate visual mood from factual claims</h2>
      <p>A short cinematic clip can be used as a concept, moodboard, story fragment, launch direction, music visual draft, or approved brand idea. If the viewer could reasonably interpret the clip as evidence of a real place, event, product test, or endorsement, add clear context or change the presentation. A generated atmosphere should not carry a factual claim by implication.</p>
      <p>For brand storytelling, verify names, marks, people, and product details outside the generation step. For a private creative draft, keep the output in the account gallery while you decide whether it is accurate enough and authorized enough to leave that context.</p>
      <h2 id="cinematic-video-faq">Cinematic Video FAQ</h2>
      <h3 id="cinematic-video-faq-brief">What makes a brief cinematic?</h3>
      <p>A cinematic brief connects a scene goal with subject, shot order, lighting, camera behavior, pacing, and mood. A style adjective alone is not enough; the viewer needs a clear visual change to follow.</p>
      <h3 id="cinematic-video-faq-shots">How many shots should I plan?</h3>
      <p>Start with a compact opening, middle, and closing. Three readable beats are easier to review than a crowded sequence with too many new subjects, locations, props, and lighting changes.</p>
      <h3 id="cinematic-video-faq-brand">Can I use real brands or locations?</h3>
      <p>Only when you have the required permission and the presentation is accurate. Remove or replace unapproved marks, verify real-world details, and do not present a fictional scene as proof of a real location or event.</p>
      <h3 id="cinematic-video-faq-review">What should I inspect in the final clip?</h3>
      <p>Review story clarity, subject identity, shot continuity, lighting direction, shadows, hands, props, signs, product details, reflections, crop, and the risk of a misleading interpretation. Watch at full speed and pause the key frames.</p>
    `
  }
];
