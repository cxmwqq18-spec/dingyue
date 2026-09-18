import assert from "node:assert/strict";
import { existsSync } from "node:fs";

const siteBase = "/assets/sites/site_aidreamcapes";
const generatedBase = `${siteBase}/conversion-seeding-v1`;
const imageSize = { width: 400, height: 400 };
const productSizes = "(max-width: 1024px) 100vw, 560px";
const cardSizes = "(max-width: 1024px) 100vw, 760px";

const imageFiles = Object.fromEntries([
  "product-demo",
  "unboxing-experience",
  "how-to-tutorial",
  "feature-callout",
  "competitor-comparison",
  "social-proof-animation",
  "duet-reaction",
  "green-screen-speaking"
].map((key) => [key, [
  `${key}-product.webp`,
  `${key}-hero-output.webp`,
  ...Array.from({ length: 7 }, (_, index) => `${key}-example-${String(index + 1).padStart(2, "0")}.webp`)
]]));

const imageAlt = {
  "product-demo": [
    "Compact espresso machine product input prepared for an AI product demo video",
    "Hands operating a compact espresso machine while the product demo result is framed",
    "Espresso machine setup beside a cup before the product demonstration begins",
    "Hand pressing the espresso machine control during a product demo",
    "Fresh espresso flowing from the machine as visible product performance proof",
    "Close view of the machine controls and coffee extraction detail",
    "Finished espresso cup beside the machine in a realistic kitchen use moment",
    "Creator checking the espresso result after operating the product",
    "Product demo closing frame showing the machine ready for the next use"
  ],
  "unboxing-experience": [
    "Matte wireless headphones package prepared for an AI unboxing experience video",
    "Creator opening a wireless headphones package during a first-impression unboxing",
    "Sealed wireless headphones box arriving on a clean tabletop before opening",
    "Hands removing the outer sleeve from a wireless headphones package",
    "Headphones and accessories revealed in order inside the opened package",
    "Creator lifting the headphones for the first tactile product impression",
    "Charging case and accessories arranged as an unboxing contents check",
    "Creator inspecting the headphones immediately after the package reveal",
    "Wireless headphones ready for the first-use moment after unboxing"
  ],
  "how-to-tutorial": [
    "Portable garment steamer product input prepared for an AI how-to tutorial video",
    "Creator following a step-by-step portable garment steamer tutorial",
    "Garment steamer and wrinkled shirt prepared for a how-to setup shot",
    "Hand filling the portable garment steamer before the first tutorial step",
    "Creator switching on the garment steamer while following a numbered action",
    "Steam passing over fabric as visible feedback in a how-to tutorial",
    "Hand moving the steamer along a shirt in the correct tutorial direction",
    "Smooth fabric shown after the garment steamer steps are complete",
    "Creator checking the finished shirt at the end of the tutorial"
  ],
  "feature-callout": [
    "Foam facial cleanser dispenser prepared as an AI product feature callout input",
    "Close feature callout video showing a controlled foam cleanser dispenser action",
    "Facial cleanser dispenser positioned for a focused single-feature explanation",
    "Finger pressing the cleanser pump to reveal the feature being called out",
    "Dense foam emerging from the dispenser as observable feature proof",
    "Macro view of the cleanser pump and nozzle during the feature demonstration",
    "Foam amount shown in a hand for a clear product feature comparison",
    "Creator using the cleanser dispenser in a simple bathroom context",
    "Feature callout closing frame with the cleanser ready for everyday use"
  ],
  "competitor-comparison": [
    "Two unbranded insulated travel mugs prepared for an AI competitor comparison video",
    "Neutral side-by-side comparison of two insulated travel mugs during the same test",
    "Two unbranded travel mugs aligned on a table before the comparison begins",
    "Matching pour test comparing the lids and openings of two travel mugs",
    "Hands testing the grip and carry shape of two unbranded travel mugs",
    "Side-by-side temperature test setup for two insulated travel mugs",
    "Close comparison of travel mug seals and drinking openings without logos",
    "Two mugs used during the same commute scenario for a fit comparison",
    "Neutral comparison closing frame showing both travel mugs and decision criteria"
  ],
  "social-proof-animation": [
    "Reusable insulated bottle product input prepared for an AI social proof animation",
    "Reusable bottle shown beside abstract approved feedback cues in a social proof video",
    "Reusable bottle in an everyday desk scene ready for a usage signal story",
    "Creator using the bottle while a review highlight is introduced without fake text",
    "Bottle detail shown as product evidence alongside a neutral feedback context",
    "Hands filling the reusable bottle to connect a usage signal to a real action",
    "Bottle carried through a daily routine as an observable usage moment",
    "Creator reacting to a product experience with the bottle clearly visible",
    "Social proof animation closing frame connecting approved feedback to the product"
  ],
  "duet-reaction": [
    "Compact wireless microphone product input prepared for an AI duet reaction video",
    "Two original creators reacting to a compact wireless microphone in a split-screen video",
    "First creator introducing the wireless microphone before the duet response",
    "Second creator reacting to the microphone feature from a separate camera angle",
    "Two creators comparing the microphone size and setup in a timed response",
    "Creator testing the microphone while the other creator watches and responds",
    "Split-screen product close-up shared between two original adult presenters",
    "Creators agreeing on a useful microphone use case during a duet conversation",
    "Duet reaction closing frame with both creators and the product context clear"
  ],
  "green-screen-speaking": [
    "Portable air quality monitor product input prepared for an AI green screen speaking video",
    "Original adult presenter speaking in front of a product proof background with green screen composition",
    "Presenter standing in a clean green screen studio with the air monitor held at chest height",
    "Presenter pointing toward a clear background area reserved for product explanation",
    "Air quality monitor enlarged behind a presenter during a feature explanation",
    "Presenter demonstrating how the monitor is placed in a lived-in room",
    "Side-facing presenter leaving safe space for a product chart or workflow visual",
    "Presenter delivering a concise product explanation with the device visible",
    "Green screen speaking closing frame with presenter, product, and CTA safe area"
  ]
};

const commonRelated = [
  { title: "Product Demo", body: "Show the physical action and visible result when the viewer needs to understand how the product works.", href: "/ai-video-generation/product-video", linkLabel: "Open Product Demo" },
  { title: "Feature Callout", body: "Give one product capability a focused visual proof moment instead of stacking every feature in one cut.", href: "/ai-video-generation/feature-callout", linkLabel: "Open Feature Callout" },
  { title: "URL to Ad", body: "Start from a verified product page when the next creative decision depends on accurate product context.", href: "/ai-video-generation/url-to-ad", linkLabel: "Open URL to Ad" }
];

const pages = [
  {
    key: "product-demo",
    path: "product-video",
    menuLabel: "Product Demo",
    title: "AI Product Demo Video Generator | Aidreamcapes",
    description: "Show how a product works with an AI product demo video that captures the setup, action, visible result, and next step for clear customer understanding.",
    keywords: "AI product demo video, product demo video generator, how product works video, product walkthrough video, ecommerce demo video",
    twitterDescription: "Show how a product works with an AI product demo video that captures setup, action, visible result, and next step.",
    heroTitle: "Show the product working, not just sitting in frame.",
    heroBody: "Turn a product action into a clear demo sequence. Give the viewer enough setup to understand the task, then show the movement, feedback, and finished result that make the product useful.",
    outputLabel: "Product demo output",
    imageNote: "setup → action → feedback → result",
    focus: "product operation",
    outputCopy: ["The viewer sees what the product is for.", "The key action happens on screen.", "Feedback makes the result easy to judge.", "The final frame shows the next useful step."],
    workflowCards: [["Define the task", "Choose one product job the viewer should understand by the end of the video."], ["Stage the setup", "Place the product, hands, materials, and environment so the starting state is clear."], ["Show the action", "Capture the control, movement, or interaction that makes the product work."], ["Reveal the result", "Hold on the finished state long enough for the viewer to evaluate what changed."]],
    directionCards: [["Close-up proof", "Move close when a button, texture, control, or mechanism explains the product."], ["Use moment", "Show the product in the lived-in situation where the task actually matters."], ["Before and after action", "Keep the starting state visible so the result is not mistaken for a generic beauty shot."], ["One benefit per beat", "Let each shot answer one practical question instead of listing every feature."]],
    examples: [["SETUP", "Start with the product and task in the same frame."], ["ACTION", "Show the hand or control that makes the product work."], ["FEEDBACK", "Make the product response visible to the viewer."], ["RESULT", "End on a finished state that can be evaluated."]],
    exampleTitle: "Make the product action easy to follow.",
    exampleIntro: "A demo earns attention by showing the product doing a useful job. The sequence should teach before it sells.",
    adTitle: "Format the demo for the moment of understanding.",
    adIntro: "Use a vertical cut for social feeds, a wider cut for a product page, or a short proof loop when one action says enough.",
    requirementsIntro: "A useful product demo starts with a real task, a visible mechanism, and a result that does not depend on an unsupported claim.",
    requirementCards: [["One product task", "Choose the single action the viewer should understand."], ["Usable source image", "Provide a clear product view with the relevant control or structure visible."], ["Result definition", "Decide what observable state proves the task is complete."], ["Claim review", "Verify specifications, performance language, and any customer-facing promise before publishing."]],
    finalTitle: "Ready to show how it works?",
    finalBody: "Build a focused product demo around one task, one action, and one visible result your audience can understand.",
    faq: [["What is an AI product demo video?", "It is a short video concept that shows a product being set up, used, and checked through a visible result. It is designed to improve product understanding rather than repeat a list of features."], ["How is a product demo different from a product ad?", "A product demo prioritizes how the product works and what the viewer can observe. A product ad may use that proof, but usually gives more space to the buyer, offer, and conversion message."], ["Can I create a demo from one product image?", "A clear product image can establish the object and guide a demo direction. Review the generated action and result carefully; do not treat an invented motion or outcome as a verified product capability."], ["What should a demo show first?", "Start with the task and the product in context, then show the action that matters. The viewer should understand the purpose before the result appears."], ["Can I use the output on a product page?", "Yes, after reviewing the product facts, permissions, image quality, and final claims. Match the video to the product detail page so the demonstration does not promise something the page cannot support."]]
  },
  {
    key: "unboxing-experience",
    menuLabel: "Unboxing Experience",
    title: "AI Unboxing Experience Video Generator | Aidreamcapes",
    description: "Create an AI unboxing experience video that builds anticipation, reveals the product in sequence, and turns a first impression into a useful story.",
    keywords: "AI unboxing video, unboxing experience video, product reveal video, first impression video, ecommerce unboxing generator",
    twitterDescription: "Create an AI unboxing experience video that builds anticipation, reveals the product in sequence, and turns a first impression into a useful story.",
    heroTitle: "Make the first reveal feel worth watching.",
    heroBody: "Design the moment between delivery and first use. Set an ordered reveal, let the package create anticipation, and keep the first impression grounded in what the viewer can actually see.",
    outputLabel: "Unboxing experience output",
    imageNote: "arrival → opening → reveal → first touch",
    focus: "first-impression unboxing",
    outputCopy: ["The arrival creates a clear starting point.", "Each reveal answers what is inside.", "The product gets a deliberate first-touch moment.", "The closing beat points toward first use."],
    workflowCards: [["Set the arrival", "Establish the package, surface, and context before the box is opened."], ["Sequence the reveal", "Choose the order of sleeve, box, product, and accessories so the viewer can follow."], ["Hold the first look", "Give the main product a clean reveal before moving into details."], ["Bridge to first use", "End with the product ready for the first practical moment, not an invented review."]],
    directionCards: [["Package texture", "Use material, seals, folds, and opening movement to make the first beat tangible."], ["Ordered reveal", "Reveal contents in a deliberate sequence so the viewer knows what changed."], ["Reaction beat", "Use an original adult creator’s natural response without presenting it as a real customer testimonial."], ["What is included", "Show the product and accessories clearly, without adding items that are not verified."]],
    examples: [["ARRIVAL", "Let the package establish the first moment."], ["OPEN", "Show the hands and sequence of the reveal."], ["REVEAL", "Give the product a clean first-look frame."], ["FIRST TOUCH", "End at the moment before or during first use."]],
    exampleTitle: "Turn opening a package into a complete first impression.",
    exampleIntro: "Unboxing is about anticipation and discovery. The product should feel new to the viewer without making up a customer’s experience.",
    adTitle: "Shape the reveal for product pages and social feeds.",
    adIntro: "Use a tight vertical unboxing for a fast first look, or give the full sequence more room when the package contents are part of the buying decision.",
    requirementsIntro: "The sequence depends on an accurate contents list, a believable package state, and clear permission to show any person or packaging asset.",
    requirementCards: [["Verified contents", "Know which product, accessories, inserts, and packaging elements should appear."], ["Reveal order", "Decide what the viewer should see first, second, and last."], ["Original presenter", "Use a permitted creator or synthetic presenter and review any disclosure requirement."], ["First-use boundary", "Do not claim a real customer reaction or performance result without evidence."]],
    finalTitle: "Have a first reveal worth opening?",
    finalBody: "Build an unboxing sequence that earns attention through order, texture, and a clear bridge to first use.",
    faq: [["What makes an unboxing video different from a product demo?", "An unboxing video focuses on arrival, opening, contents, and first impression. A product demo focuses on how the product performs a specific task."], ["Can the generated presenter be described as a real customer?", "No. Use only an authorized real person or clearly disclose synthetic content. Do not invent a customer identity, review, purchase, or reaction."], ["Should every accessory appear in the video?", "Only if it is verified and useful to the story. Showing an inaccurate contents list can create a misleading product expectation."], ["Can I use an existing package photo?", "Yes, when you own or have permission to use it. Review the generated package details because labels, accessories, and physical features may need correction."], ["Where does an unboxing video work best?", "It can support product pages, launch content, short-form social posts, and creator seeding when the reveal order matches the audience’s buying questions."]]
  },
  {
    key: "how-to-tutorial",
    path: "how-to-video",
    menuLabel: "How-to Tutorial",
    title: "AI How-to Tutorial Video Generator | Aidreamcapes",
    description: "Turn product instructions into a clear AI how-to tutorial with numbered actions, visible feedback, and a finished state viewers can follow from setup through completion.",
    keywords: "AI tutorial video, how-to video generator, step-by-step product video, instructional video AI, product instruction video",
    twitterDescription: "Turn product instructions into a clear AI how-to tutorial with numbered actions, visible feedback, and a finish the viewer can follow.",
    heroTitle: "Turn a product task into steps someone can follow.",
    heroBody: "Build an instructional sequence around one outcome. Make the setup, action order, feedback, and finished state explicit so the viewer can follow the task without guessing.",
    outputLabel: "How-to tutorial output",
    imageNote: "goal → setup → steps → finished state",
    focus: "step-by-step instruction",
    outputCopy: ["The goal is named before the first action.", "Each step has one clear job.", "Feedback confirms whether the step worked.", "The finished state closes the loop."],
    workflowCards: [["Name the outcome", "Define what the viewer should be able to do after watching the tutorial."], ["Prepare the setup", "Show the product, materials, and starting state before step one."], ["Sequence the actions", "Keep the order explicit and avoid combining separate tasks into one vague beat."], ["Check the finish", "Show a visible result or check that confirms the tutorial is complete."]],
    directionCards: [["Numbered sequence", "Use one frame and one action for each step the viewer must perform."], ["Hands-on framing", "Keep hands, controls, and product orientation readable at the moment of action."], ["Visible feedback", "Show the signal that tells the viewer the step has worked or needs review."], ["Common-mistake check", "Add a short checkpoint when an incorrect setup would change the result."]],
    examples: [["GOAL", "Show the finished task before the steps begin."], ["STEP 01", "Prepare the product and starting materials."], ["ACTION", "Demonstrate the key movement or control."], ["CHECK", "Confirm the finished state the viewer should see."]],
    exampleTitle: "Make every instruction visible at the moment it matters.",
    exampleIntro: "A how-to video is successful when the viewer can pause, copy the action, and recognize the correct finished state.",
    adTitle: "Keep tutorials useful in every placement.",
    adIntro: "Use a vertical cut for quick social education, a longer version for support content, or a product-page version when the buyer needs confidence before purchase.",
    requirementsIntro: "Instructional accuracy matters more than cinematic novelty. Start with a verified procedure, product orientation, and outcome.",
    requirementCards: [["Verified procedure", "Use approved instructions rather than guessing how a product works."], ["One outcome", "Keep the tutorial focused on one task that can be completed in the available runtime."], ["Readable framing", "Keep the product, hands, controls, and important feedback visible."], ["Safety review", "Add or preserve safety, care, and limitation guidance where the task requires it."]],
    finalTitle: "Have a task people keep asking about?",
    finalBody: "Turn the answer into a step-by-step tutorial with a clear goal, visible actions, and a finish viewers can recognize.",
    faq: [["What is an AI how-to tutorial video?", "It is a structured instructional video concept that breaks one product task into a goal, setup, ordered actions, feedback, and a completed state."], ["Can AI invent missing product instructions?", "Treat generated steps as drafts only. Compare them with the manufacturer’s or owner’s approved instructions before publication, especially for safety-sensitive products."], ["How many steps should a tutorial include?", "Include only the steps needed for one clear outcome. Fewer, readable actions are more useful than a long sequence that compresses important details."], ["Should the tutorial include voiceover?", "Voiceover can help when the action needs context, but the visual sequence should still make the key step and feedback understandable."], ["Can a how-to tutorial support customer education?", "Yes. Review accuracy, accessibility, captions, product version, and any safety or care requirements before using it for support or onboarding."]]
  },
  {
    key: "feature-callout",
    menuLabel: "Feature Callout",
    title: "AI Product Feature Callout Video Generator | Aidreamcapes",
    description: "Explain one product feature at a time with an AI feature callout video that pairs a focused claim with a clear visual demonstration for buyers.",
    keywords: "product feature video, feature callout video, AI product explainer, product benefit demonstration, ecommerce feature video",
    twitterDescription: "Explain one product feature at a time with an AI feature callout video that pairs a focused claim with a clear visual demonstration.",
    heroTitle: "Give one feature the screen time it deserves.",
    heroBody: "Choose one capability, one customer question, and one proof moment. The page keeps the feature in focus so the viewer understands what it does and why it matters.",
    outputLabel: "Feature callout output",
    imageNote: "feature → action → effect → relevance",
    focus: "single-feature proof",
    outputCopy: ["The feature is named without a vague superlative.", "The action reveals what the feature changes.", "A close-up gives the viewer something concrete.", "The use case explains who should care."],
    workflowCards: [["Choose one feature", "Select the capability that answers the most important customer question."], ["Write the precise claim", "Use language that can be supported by the product, source page, or approved specification."], ["Stage the proof", "Show the feature in an action, close-up, state change, or relevant use moment."], ["Connect the relevance", "Explain when the feature helps without claiming it solves every problem."]],
    directionCards: [["Macro detail", "Move close to the physical or interface detail that carries the explanation."], ["State change", "Show before and after states when the feature creates a visible difference."], ["Motion cue", "Use a controlled movement to reveal how the feature behaves."], ["One claim / one proof", "Keep the visual evidence matched to the exact language on screen."]],
    examples: [["FEATURE", "Name the one capability being explained."], ["DETAIL", "Bring the relevant control or structure close to camera."], ["EFFECT", "Show the visible change created by the feature."], ["USE", "Place the feature in the customer situation where it matters."]],
    exampleTitle: "Make a single feature impossible to misunderstand.",
    exampleIntro: "Feature callouts work when the viewer can connect the words, the product detail, and the observed effect without decoding a crowded frame.",
    adTitle: "Keep feature proof clear across formats.",
    adIntro: "Use a short vertical callout for social, a product-page module for evaluation, or a compact cut inside a longer demonstration.",
    requirementsIntro: "A precise feature callout needs an approved fact, a suitable visual proof, and a clear boundary around what the feature does not claim.",
    requirementCards: [["One capability", "Do not combine unrelated features into a single callout."], ["Approved fact", "Verify the feature name, specification, compatibility, and limitation."], ["Proof shot", "Choose a product action or detail that lets the viewer observe the feature."], ["Readable message", "Keep on-screen text, captions, and voiceover aligned with the visual evidence."]],
    finalTitle: "Which feature deserves a clearer explanation?",
    finalBody: "Build a focused callout that connects one precise claim to one observable product moment.",
    faq: [["What is a product feature callout video?", "It is a short explanation focused on one product capability. The visual demonstrates the feature while the copy explains its practical relevance."], ["How many features should one callout cover?", "One is usually best. Separate callouts create clearer learning and make it easier to review whether each claim has matching evidence."], ["Can generated text be used as a product specification?", "No. Treat it as draft copy and verify the feature, compatibility, measurements, and limitations against approved product information."], ["Should the feature be shown in use?", "When possible, yes. A realistic use moment helps the viewer understand why the feature matters beyond seeing a close-up."], ["Can I add labels over the video?", "Yes, but keep labels concise, accessible, and accurate. The generated image should not be relied on to render readable text; add reviewed labels in the page or editing workflow."]]
  },
  {
    key: "competitor-comparison",
    menuLabel: "Competitor Comparison",
    title: "AI Competitor Comparison Video Generator | Aidreamcapes",
    description: "Build a balanced AI competitor comparison video around approved criteria, observable product differences, and a decision the viewer can evaluate.",
    keywords: "AI comparison video, competitor comparison video, product comparison generator, side-by-side product video, ecommerce comparison content",
    twitterDescription: "Build a balanced AI competitor comparison video around approved criteria, observable product differences, and a decision the viewer can evaluate.",
    heroTitle: "Make the buying decision easier to compare.",
    heroBody: "Create a side-by-side story around criteria your audience actually uses. Show the same task, the relevant difference, and the trade-off without turning comparison content into unsupported competitor claims.",
    outputLabel: "Competitor comparison output",
    imageNote: "criteria → same task → difference → fit",
    focus: "neutral comparison",
    outputCopy: ["The criteria are clear before the comparison.", "Both products face the same useful task.", "Differences are shown instead of exaggerated.", "The conclusion explains fit, not a blanket winner."],
    workflowCards: [["Choose the criteria", "Select the dimensions that influence the buyer’s decision and can be verified."], ["Match the task", "Put both products through a comparable use moment, setting, and viewing distance."], ["Show the difference", "Use close-ups, actions, or outcomes that make the contrast observable."], ["Explain the fit", "Help the viewer understand which option suits which need instead of inventing a universal winner."]],
    directionCards: [["Same task / two approaches", "Keep the goal stable while each product handles it in its own way."], ["Control versus speed", "Compare workflow trade-offs only when the underlying evidence is current."], ["Setup difference", "Show the preparation or learning curve that affects the buyer’s choice."], ["Best-fit conclusion", "End with an audience or use case, not an unsupported superiority claim."]],
    examples: [["CRITERIA", "Name the decision dimension before showing products."], ["MATCH", "Give both products the same task and context."], ["DIFFERENCE", "Show the product detail that creates the contrast."], ["FIT", "Close with who each option may suit."]],
    exampleTitle: "Compare the decision, not just the product shots.",
    exampleIntro: "Good comparison content makes the method visible. The viewer should understand what was compared, what changed, and what remains a trade-off.",
    adTitle: "Keep comparison content fair in every placement.",
    adIntro: "Use a vertical split-screen for social, a longer evaluation cut for a product page, or a concise criteria loop for a buying guide.",
    requirementsIntro: "Comparison content needs current evidence, permission to show both products, and a review process for claims that mention a competitor.",
    requirementCards: [["Approved criteria", "Choose measurable or observable dimensions that matter to the intended buyer."], ["Permission and marks", "Use only product images, names, logos, and claims you have rights to publish."], ["Matched conditions", "Keep the task, framing, and test conditions comparable enough to be fair."], ["Legal and factual review", "Check competitor references, numbers, and conclusions before distribution."]],
    finalTitle: "Have a decision buyers keep comparing?",
    finalBody: "Build a balanced comparison around the same task, clear evidence, and a conclusion that respects different customer needs.",
    faq: [["What makes a competitor comparison useful?", "It defines the criteria, gives comparable products the same task, shows observable differences, and explains which option may fit which buyer."], ["Can AI invent competitor specifications?", "No. Verify every specification, price, performance statement, compatibility claim, and product name before publication."], ["Should I show competitor logos?", "Only when you have the right to use them and the context is legally and factually appropriate. Unbranded comparison visuals are safer for a planning draft."], ["Does a comparison video need to pick one winner?", "No. A useful conclusion can explain trade-offs and fit. A universal winner claim is often less helpful and harder to substantiate."], ["Can one comparison be reused for paid social?", "After review, adapt the same evidence to each placement’s format, disclosure, destination, and platform policy requirements."]]
  },
  {
    key: "social-proof-animation",
    menuLabel: "Social Proof Animation",
    title: "AI Social Proof Animation Video Generator | Aidreamcapes",
    description: "Turn approved reviews, ratings, or usage signals into an AI social proof animation that adds context without inventing customer evidence or trust.",
    keywords: "social proof animation, AI review video, customer feedback animation, rating video generator, ecommerce social proof content",
    twitterDescription: "Turn approved reviews, ratings, or usage signals into an AI social proof animation that adds context without inventing customer evidence.",
    heroTitle: "Give approved proof a clearer rhythm.",
    heroBody: "Organize real feedback into a visual sequence people can understand. Start with the source, add product context, highlight the useful signal, and keep every claim traceable to approved evidence.",
    outputLabel: "Social proof animation output",
    imageNote: "source proof → context → highlight → next step",
    focus: "approved feedback signal",
    outputCopy: ["The source of the proof is kept clear.", "Feedback is connected to a real product moment.", "The highlight is specific rather than inflated.", "The next step does not imply more evidence than exists."],
    workflowCards: [["Collect approved proof", "Use reviews, ratings, usage signals, or customer language your team has permission to publish."], ["Add the context", "Show which product, version, use case, or time period the proof describes."], ["Animate the signal", "Give the most useful sentence, pattern, or detail a readable visual rhythm."], ["Review the conclusion", "Check that the final frame does not turn one experience into a universal promise."]],
    directionCards: [["Review highlight", "Bring one approved customer observation into focus with enough context to interpret it."], ["Rating context", "Show a rating or trend only with the source, date, sample, and scope your team can support."], ["Usage signal", "Connect repeat use, adoption, or a practical outcome to the product scene it belongs to."], ["Proof before promise", "Lead with what is known before asking the viewer to believe a larger conclusion."]],
    examples: [["SOURCE", "Keep the approved feedback origin visible in the plan."], ["CONTEXT", "Show the product and use situation behind the signal."], ["HIGHLIGHT", "Animate one useful proof detail without fake quotes."], ["NEXT STEP", "Invite the viewer to inspect the matching product information."]],
    exampleTitle: "Animate evidence without manufacturing trust.",
    exampleIntro: "Social proof becomes persuasive when viewers can tell what was said, by whom or what source, and how it relates to the product in front of them.",
    adTitle: "Make approved proof work across the feed.",
    adIntro: "Use a short vertical highlight for social, a product-page proof module, or a longer cut that gives the source and context more room.",
    requirementsIntro: "The creative depends on real approved source material. Animation can improve comprehension, but it cannot make missing evidence true.",
    requirementCards: [["Approved source", "Confirm the review, rating, usage data, or customer language can be published."], ["Attribution rules", "Use the correct name, anonymity, date, sample, and disclosure treatment."], ["Product context", "Connect the proof to the exact product, version, and use case it describes."], ["No invented evidence", "Do not add fake customer names, avatars, quotes, badges, or verified-purchase labels."]],
    finalTitle: "Have proof worth making easier to understand?",
    finalBody: "Turn approved customer evidence into a clear animated sequence that informs without overstating what the source proves.",
    faq: [["What can be used as social proof?", "Approved reviews, ratings, customer observations, usage signals, and other evidence your team is permitted to publish can be structured into a social proof animation."], ["Can AI create customer reviews for the video?", "No. Generated copy may help organize approved material, but it must not be presented as a real customer quote, identity, purchase, or verified result."], ["How should ratings be shown?", "Include enough source, date, scope, and sample context for the viewer to understand what the rating represents. Do not imply a broader result than the data supports."], ["Can anonymous feedback be used?", "It can be used when it is approved for publication and labeled honestly. Do not add a fictional face or name to make anonymous feedback look personally verified."], ["Where should the animation link?", "Send viewers to the matching product, review, or evidence destination so the context in the animation can be checked."]]
  },
  {
    key: "duet-reaction",
    menuLabel: "Duet / Reaction",
    title: "AI Duet & Reaction Video Generator | Aidreamcapes",
    description: "Create an AI duet or reaction video with two clear points of view, timed responses, and enough product context for the conversation to make sense.",
    keywords: "AI duet video, reaction video generator, split-screen product video, creator response video, social reaction content",
    twitterDescription: "Create an AI duet or reaction video with two clear points of view, timed responses, and enough product context for the conversation to make sense.",
    heroTitle: "Let the response carry the story forward.",
    heroBody: "Build a two-perspective video where each person has a clear role. Give the reaction a source, the response a reason, and the product enough screen time to remain part of the conversation.",
    outputLabel: "Duet reaction output",
    imageNote: "source moment → reaction → response → conclusion",
    focus: "two-perspective response",
    outputCopy: ["The source moment is understandable first.", "Each presenter has a distinct response job.", "Timing makes the exchange feel intentional.", "The product context remains visible through the conversation."],
    workflowCards: [["Define both roles", "Decide who introduces the source and who reacts, explains, tests, or challenges it."], ["Set the response beat", "Choose the exact visual or spoken moment that triggers the second perspective."], ["Match the timing", "Align the split-screen crops, pauses, expressions, and product visibility."], ["Close the exchange", "End with a useful conclusion, question, or next step rather than empty reaction."]],
    directionCards: [["Split-screen response", "Let both points of view remain visible so the viewer can read the exchange."], ["Agree / challenge", "Use a clear difference in perspective without manufacturing conflict or a fake source."], ["Try and react", "Show one person testing the product while the second person responds to the observed moment."], ["Question and answer", "Let the reaction answer a specific buyer question connected to the product."]],
    examples: [["SOURCE", "Make the original moment clear before the response."], ["REACT", "Give the second creator a specific response job."], ["EXCHANGE", "Use timing and product context to connect the two views."], ["CONCLUDE", "Finish with a useful answer or next action."]],
    exampleTitle: "Make two perspectives feel like one conversation.",
    exampleIntro: "A duet is more than two faces on screen. The source, timing, and roles should make the viewer understand why the second perspective is there.",
    adTitle: "Keep the exchange readable in a vertical frame.",
    adIntro: "Use a split-screen 9:16 layout, clear speaker hierarchy, and product-safe areas so the reaction does not hide the proof.",
    requirementsIntro: "Duet content needs permission for every source and person shown, plus a clear response structure that does not rely on impersonation.",
    requirementCards: [["Permitted source", "Use source content and likenesses you have the right to transform or respond to."], ["Two defined roles", "Give each presenter a distinct job in the exchange."], ["Timing plan", "Mark the trigger, pause, reaction, and response before production."], ["Identity review", "Use original or authorized adults and never imitate a real public figure without permission."]],
    finalTitle: "Have a product question worth answering together?",
    finalBody: "Create a duet where the response adds context, the product stays visible, and both perspectives move the viewer toward a useful conclusion.",
    faq: [["What is an AI duet or reaction video?", "It is a split-screen or paired-perspective video where one side provides a source moment and the other adds a reaction, test, explanation, or answer."], ["Can the AI imitate a famous creator?", "No. Use an authorized person or an original fictional adult presenter. Do not imitate a real public figure or copy a protected creator identity."], ["Do I need permission for the source clip?", "Yes. Only use source footage, audio, likenesses, music, and product material that your team is allowed to use in the intended context."], ["How do I keep the reaction useful?", "Give it a specific job: answer a question, test a feature, add context, or explain a trade-off. A general facial reaction is rarely enough on its own."], ["Can duet content be used for paid ads?", "After rights, disclosure, source attribution, product claims, and platform-format review. Keep the commercial relationship clear rather than hiding it behind a reaction format."]]
  },
  {
    key: "green-screen-speaking",
    menuLabel: "Green Screen Speaking",
    title: "AI Green Screen Speaking Video Generator | Aidreamcapes",
    description: "Create a speaking video with a green-screen presenter, a controlled product backdrop, and clean composition for explainers, demos, and social clips.",
    keywords: "green screen speaking video, AI presenter video, green screen product explainer, virtual background video, talking presenter generator",
    twitterDescription: "Create a speaking video with a green-screen presenter, a controlled product backdrop, and clean composition for explainers, demos, and social clips.",
    heroTitle: "Put the presenter in front of the proof.",
    heroBody: "Plan the speaker, the script beat, and the background cue together. The presenter should guide attention toward the product evidence while the composition leaves room for the final edit.",
    outputLabel: "Green screen speaking output",
    imageNote: "speaker role → script beat → backdrop → CTA",
    focus: "presenter-led explanation",
    outputCopy: ["The presenter has a clear communication role.", "The background supports the spoken beat.", "The product proof remains visible beside the speaker.", "Safe areas protect the final CTA and captions."],
    workflowCards: [["Choose the speaker role", "Set whether the presenter will explain, demonstrate, compare, or guide the viewer."], ["Write the script beats", "Keep the spoken message focused on one idea per shot."], ["Plan the background", "Reserve space for product close-ups, steps, charts, or a controlled use scene."], ["Review the composite", "Check edges, gaze direction, captions, product scale, and CTA safe areas before export."]],
    directionCards: [["Corner presenter", "Keep the presenter small enough to leave the main product proof open."], ["Full-height explainer", "Use the presenter as the guide while the background changes behind them."], ["Point and explain", "Direct the speaker’s gesture and gaze toward the exact evidence on screen."], ["Background swap", "Change the setting to match the script without implying a real location or event."]],
    examples: [["ROLE", "Make the presenter’s communication job clear."], ["SCRIPT", "Give the speaker one focused message beat."], ["PROOF", "Place the product evidence in the open background area."], ["SAFE AREA", "Protect captions and the final CTA from crop or interface overlap."]],
    exampleTitle: "Let the presenter guide attention, not compete with it.",
    exampleIntro: "Green-screen speaking works when the presenter, script, and background have a deliberate relationship. The background should answer the spoken message.",
    adTitle: "Build presenter cuts for social, explainers, and demos.",
    adIntro: "Use a vertical presenter cut for short-form social, a wider composition for explainers, or a product-page version with more room for evidence.",
    requirementsIntro: "A convincing composite needs an approved script, a permitted presenter identity, and a background plan that can be checked after rendering.",
    requirementCards: [["Presenter permission", "Use an authorized real person or clearly synthetic original adult presenter."], ["Focused script", "Write a short message with a clear product fact or teaching goal."], ["Background assets", "Prepare product images, diagrams, or scenes that are accurate and permitted."], ["Composite review", "Check edges, hands, gaze, captions, placement crop, disclosure, and final destination."]],
    finalTitle: "Have a product story that needs a guide?",
    finalBody: "Put an approved presenter in front of the right evidence and keep the script, background, and CTA working as one composition.",
    faq: [["What is a green-screen speaking video?", "It is a presenter-led video composed over a controlled background such as a product detail, use scene, diagram, or workflow visual."], ["Can the presenter be a synthetic person?", "Yes, when the synthetic identity is permitted and the content is disclosed where required. Do not present a generated presenter as a real customer, expert, or public figure."], ["What background works best?", "Use a background that directly supports the spoken beat: product proof, a step, a use context, or a comparison criterion. Avoid unrelated scenery."], ["How much text should the presenter cover?", "Keep each shot focused on one message beat and use reviewed captions for accessibility. Let the background carry visual proof rather than asking the speaker to explain everything."], ["Can this format be used for product demos?", "Yes. A presenter can guide a product demo, but the product action and result still need to be shown accurately rather than implied by the presenter’s words."]]
  }
];

const topicNarratives = {
  "product-demo": ["WHAT THIS CREATES", "A product action a buyer can understand.", "The output keeps setup, motion, feedback, and result connected so the demo teaches the product before asking for a decision."],
  "unboxing-experience": ["WHAT THIS CREATES", "A first reveal with a deliberate sequence.", "The output turns arrival, opening, contents, and first touch into a paced experience without inventing a customer review."],
  "how-to-tutorial": ["WHAT THIS CREATES", "A task broken into followable steps.", "The output makes the goal, setup, action order, feedback, and finished state visible enough to pause and copy."],
  "feature-callout": ["WHAT THIS CREATES", "One feature paired with one proof moment.", "The output keeps a precise capability, its visible effect, and its customer relevance in the same clear story."],
  "competitor-comparison": ["WHAT THIS CREATES", "A comparison built around a buyer decision.", "The output keeps the criteria, matched task, observable difference, and best-fit conclusion visible without unsupported superiority claims."],
  "social-proof-animation": ["WHAT THIS CREATES", "Approved evidence with a clearer visual rhythm.", "The output connects a real proof source to product context and a specific highlight without manufacturing customer trust."],
  "duet-reaction": ["WHAT THIS CREATES", "A two-perspective exchange with a reason to respond.", "The output gives the source, reaction, timing, product context, and conclusion distinct jobs inside one conversation."],
  "green-screen-speaking": ["WHAT THIS CREATES", "A presenter-led explanation with proof behind it.", "The output assigns the speaker, script beat, background cue, product evidence, and safe area a clear compositional role."]
};

function imageSet(key) {
  const files = imageFiles[key];
  const alts = imageAlt[key];
  assert.ok(files && alts && files.length === 9 && alts.length === 9, `incomplete image set: ${key}`);
  const create = (index, role) => ({
    src: `${generatedBase}/${key}/${files[index]}`,
    alt: alts[index],
    ...imageSize,
    loading: role === "product" || role === "hero" ? "eager" : "lazy",
    fetchPriority: role === "product" ? "high" : "auto",
    sizes: role === "product" ? productSizes : cardSizes
  });
  return {
    product: create(0, "product"),
    output: create(1, "hero"),
    examples: files.slice(2).map((_, index) => create(index + 2, "content"))
  };
}

function card(title, body, image) {
  return { title, body, ...(image ? { image } : {}) };
}

function guidance(eyebrow, title, intro, cards) {
  return { eyebrow, title, intro, cards };
}

function buildDetail(spec) {
  const narrative = topicNarratives[spec.key];
  assert.ok(narrative, `${spec.key}: missing topic narrative`);
  const images = imageSet(spec.key);
  const canonicalPath = `/ai-video-generation/${spec.path ?? spec.key}`;
  const exampleEntries = [
    ...spec.examples.map(([noteLabel, title]) => [noteLabel, title, `${spec.focus}: ${title.toLowerCase()}.`]),
    ["DETAIL", `Make the ${spec.focus} visible in the frame.`, `Keep the key ${spec.focus} readable enough for a viewer to understand the moment.`],
    ["CONTEXT", `Place the ${spec.menuLabel.toLowerCase()} in a believable use situation.`, `Use context to explain why this ${spec.focus} matters to the intended viewer.`],
    ["NEXT STEP", "Close with an action that matches the page promise.", "Keep the destination and the final message aligned with the evidence shown."]
  ];
  assert.equal(exampleEntries.length, 7, `${spec.key}: seven example entries`);
  const examples = exampleEntries.map(([noteLabel, title, body], index) => ({ title, body, noteLabel, image: images.examples[index] }));
  const cards = (entries) => entries.map(([title, body]) => card(title, body));
  const seo = {
    title: spec.title,
    description: spec.description,
    keywords: spec.keywords,
    canonicalPath,
    canonical: `https://www.aidreamcapes.com${canonicalPath}`,
    robots: { index: true, follow: true, maxImagePreview: "large" },
    twitterDescription: spec.twitterDescription,
    ogImage: images.output.src,
    ogImageAlt: images.output.alt
  };
  return {
    layoutVariant: "conversion-seeding-detail",
    seo,
    hero: {
      eyebrow: `AI VIDEO · ${spec.menuLabel}`,
      title: spec.heroTitle,
      body: spec.heroBody,
      primaryCta: `Create ${spec.menuLabel}`,
      primaryCtaHref: "/app/create?videoMode=product-video#step-video",
      secondaryCta: `See ${spec.menuLabel} examples`,
      secondaryCtaHref: "#topic-examples",
      availabilityNote: "Review the concept, credit cost, and output requirements before generation.",
      rightsCopy: "Use only product assets, claims, creator identities, and destinations you can verify and publish.",
      imageNote: spec.imageNote,
      productLabel: "01 · Product image",
      outputLabel: `02 · ${spec.outputLabel}`,
      productImage: images.product,
      outputImage: images.output
    },
    workflowOutput: guidance(narrative[0], narrative[1], narrative[2], cards(spec.outputCopy.map((item, index) => [`0${index + 1}`, item]))),
    workflow: guidance("THE WORKFLOW", `From ${spec.focus} to a reviewable video direction.`, `Each step gives the ${spec.menuLabel.toLowerCase()} a distinct production decision instead of defaulting to a generic product introduction.`, cards(spec.workflowCards)),
    creativeDirections: guidance("CREATIVE DIRECTIONS", `Creative directions for ${spec.menuLabel.toLowerCase()}.`, `Change the framing, sequence, or presenter job while keeping the core ${spec.focus} accurate and visible.`, cards(spec.directionCards)),
    examples: {
      eyebrow: "THEME EXAMPLES",
      title: spec.exampleTitle,
      intro: spec.exampleIntro,
      items: examples
    },
    adTesting: {
      eyebrow: "FORMAT & PLACEMENT",
      title: spec.adTitle,
      intro: spec.adIntro,
      platforms: ["Vertical · 9:16", "Product page · 16:9", "Short proof loop"],
      checklist: ["Theme task is clear in the opening", "Product evidence matches the copy", "Presenter or source permissions are reviewed", "Captions and safe areas are checked", "Credits and output settings are reviewed"]
    },
    requirements: guidance("BEFORE YOU CREATE", `Prepare the inputs for ${spec.menuLabel.toLowerCase()}.`, spec.requirementsIntro, cards(spec.requirementCards)),
    relatedWorkflows: {
      eyebrow: "CONTINUE THE WORKFLOW",
      title: `Move from ${spec.menuLabel.toLowerCase()} to the next useful step.`,
      intro: "Keep the current theme goal intact as you move into a product demo, focused feature proof, or verified product context.",
      items: commonRelated.map((item) => ({ ...item }))
    },
    faq: { eyebrow: "FAQ", title: `Questions about ${spec.menuLabel.toLowerCase()}.`, items: spec.faq.map(([question, answer]) => ({ question, answer })) },
    finalCta: {
      eyebrow: "READY TO BUILD THE RIGHT EXPLANATION?",
      title: spec.finalTitle,
      body: spec.finalBody,
      cta: `Create ${spec.menuLabel}`,
      ctaHref: "/app/create?videoMode=product-video#step-video",
      microcopy: `Start with the inputs for ${spec.menuLabel.toLowerCase()}. Review the direction before you generate.`
    }
  };
}

export const aidreamcapesConversionSeedingPageSpecs = pages.map((spec) => ({ ...spec, detail: buildDetail(spec) }));
export const aidreamcapesConversionSeedingPaths = aidreamcapesConversionSeedingPageSpecs.map((spec) => spec.detail.seo.canonicalPath);

export function aidreamcapesConversionSeedingPagesForMigration() {
  return aidreamcapesConversionSeedingPageSpecs.map((spec) => ({
    key: spec.key,
    menuLabel: spec.menuLabel,
    slug: spec.detail.seo.canonicalPath,
    title: spec.detail.seo.title,
    content: spec.detail
  }));
}

export function validateAidreamcapesConversionSeedingContent({ log = console.log, requireAssets = true } = {}) {
  assert.equal(aidreamcapesConversionSeedingPageSpecs.length, 8);
  const seenPaths = new Set();
  const seenMedia = new Set();
  for (const spec of aidreamcapesConversionSeedingPageSpecs) {
    const content = spec.detail;
    const seo = content.seo;
    assert.ok(seo.title.length >= 45 && seo.title.length <= 70, `${spec.key}: title length ${seo.title.length}`);
    assert.ok(seo.description.length >= 140 && seo.description.length <= 170, `${spec.key}: description length ${seo.description.length}`);
    assert.ok(!seenPaths.has(seo.canonicalPath), `duplicate path: ${seo.canonicalPath}`);
    seenPaths.add(seo.canonicalPath);
    assert.equal(content.layoutVariant, "conversion-seeding-detail");
    assert.match(seo.canonical, /^https:\/\/www\.aidreamcapes\.com\/ai-video-generation\//);
    assert.ok(seo.ogImage.startsWith(`${siteBase}/`), `${spec.key}: storefront image isolation`);
    const images = [content.hero.productImage, content.hero.outputImage, ...content.examples.items.map((item) => item.image)];
    assert.equal(images.length, 9, `${spec.key}: content image count`);
    assert.equal(new Set(images.map((image) => image.src)).size, 9, `${spec.key}: duplicate content images`);
    assert.equal(content.examples.items.length, 7, `${spec.key}: example image count`);
    assert.equal(content.faq.items.length, 5, `${spec.key}: faq count`);
    for (const [index, image] of images.entries()) {
      assert.ok(image.src.startsWith(`${generatedBase}/${spec.key}/`), `${spec.key}: image set isolation ${image.src}`);
      assert.match(image.src, /\.webp$/);
      assert.equal(image.width, imageSize.width, `${spec.key}: image ${index} width`);
      assert.equal(image.height, imageSize.height, `${spec.key}: image ${index} height`);
      assert.ok(image.alt.length >= 30, `${spec.key}: image ${index} alt quality`);
      assert.equal(image.loading, index < 2 ? "eager" : "lazy", `${spec.key}: image ${index} loading`);
      assert.equal(image.fetchPriority, index === 0 ? "high" : "auto", `${spec.key}: image ${index} priority`);
      if (requireAssets) assert.ok(existsSync(new URL(`../../public${image.src}`, import.meta.url)), `${spec.key}: missing image ${image.src}`);
      assert.ok(!seenMedia.has(image.src), `${spec.key}: image reused by another page ${image.src}`);
      seenMedia.add(image.src);
    }
    for (const value of [seo.title, seo.description, spec.heroTitle, spec.heroBody, ...spec.faq.flat()]) {
      assert.ok(!/\p{Script=Han}/u.test(value), `${spec.key}: customer copy must be English`);
    }
    log(`${spec.key}: title=${seo.title.length} description=${seo.description.length} media=${images.length}`);
  }
  return true;
}
