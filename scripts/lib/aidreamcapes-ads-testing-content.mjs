import assert from "node:assert/strict";
import { existsSync } from "node:fs";

const siteBase = "/assets/sites/site_aidreamcapes";
const generatedBase = `${siteBase}/ads-testing-v3`;
const imageSize = { width: 400, height: 400 };
const productSizes = "(max-width: 1024px) 100vw, 560px";
const cardSizes = "(max-width: 1024px) 100vw, 760px";

const imageFiles = {
  "url-to-ad": ["url-to-ad-product.webp", "url-to-ad-hero-output.webp", "url-to-ad-example-01.webp", "url-to-ad-example-02.webp", "url-to-ad-example-03.webp", "url-to-ad-example-04.webp", "url-to-ad-example-05.webp", "url-to-ad-example-06.webp", "url-to-ad-example-07.webp"],
  "hook-lab": ["hook-lab-product.webp", "hook-lab-hero-output.webp", "hook-lab-example-01.webp", "hook-lab-example-02.webp", "hook-lab-example-03.webp", "hook-lab-example-04.webp", "hook-lab-example-05.webp", "hook-lab-example-06.webp", "hook-lab-example-07.webp"],
  "pas-formula-ads": ["pas-formula-ads-product.webp", "pas-formula-ads-hero-output.webp", "pas-formula-ads-example-01.webp", "pas-formula-ads-example-02.webp", "pas-formula-ads-example-03.webp", "pas-formula-ads-example-04.webp", "pas-formula-ads-example-05.webp", "pas-formula-ads-example-06.webp", "pas-formula-ads-example-07.webp"],
  "testimonial-ads": ["testimonial-ads-product.webp", "testimonial-ads-hero-output.webp", "testimonial-ads-example-01.webp", "testimonial-ads-example-02.webp", "testimonial-ads-example-03.webp", "testimonial-ads-example-04.webp", "testimonial-ads-example-05.webp", "testimonial-ads-example-06.webp", "testimonial-ads-example-07.webp"],
  "before-after-showcases": ["before-after-showcases-product.webp", "before-after-showcases-hero-output.webp", "before-after-showcases-example-01.webp", "before-after-showcases-example-02.webp", "before-after-showcases-example-03.webp", "before-after-showcases-example-04.webp", "before-after-showcases-example-05.webp", "before-after-showcases-example-06.webp", "before-after-showcases-example-07.webp"],
  "talking-photo-recs": ["talking-photo-recs-product.webp", "talking-photo-recs-hero-output.webp", "talking-photo-recs-example-01.webp", "talking-photo-recs-example-02.webp", "talking-photo-recs-example-03.webp", "talking-photo-recs-example-04.webp", "talking-photo-recs-example-05.webp", "talking-photo-recs-example-06.webp", "talking-photo-recs-example-07.webp"],
  "ai-actor-product-ads": ["ai-actor-product-ads-product.webp", "ai-actor-product-ads-hero-output.webp", "ai-actor-product-ads-example-01.webp", "ai-actor-product-ads-example-02.webp", "ai-actor-product-ads-example-03.webp", "ai-actor-product-ads-example-04.webp", "ai-actor-product-ads-example-05.webp", "ai-actor-product-ads-example-06.webp", "ai-actor-product-ads-example-07.webp"],
  "tiktok-reels-shorts": ["tiktok-reels-shorts-product.webp", "tiktok-reels-shorts-hero-output.webp", "tiktok-reels-shorts-example-01.webp", "tiktok-reels-shorts-example-02.webp", "tiktok-reels-shorts-example-03.webp", "tiktok-reels-shorts-example-04.webp", "tiktok-reels-shorts-example-05.webp", "tiktok-reels-shorts-example-06.webp", "tiktok-reels-shorts-example-07.webp"],
  "native-spark-ads": ["native-spark-ads-product.webp", "native-spark-ads-hero-output.webp", "native-spark-ads-example-01.webp", "native-spark-ads-example-02.webp", "native-spark-ads-example-03.webp", "native-spark-ads-example-04.webp", "native-spark-ads-example-05.webp", "native-spark-ads-example-06.webp", "native-spark-ads-example-07.webp"],
  "carousel-storytelling": ["carousel-storytelling-product.webp", "carousel-storytelling-hero-output.webp", "carousel-storytelling-example-01.webp", "carousel-storytelling-example-02.webp", "carousel-storytelling-example-03.webp", "carousel-storytelling-example-04.webp", "carousel-storytelling-example-05.webp", "carousel-storytelling-example-06.webp", "carousel-storytelling-example-07.webp"],
  "retargeting-urgency": ["retargeting-urgency-product.webp", "retargeting-urgency-hero-output.webp", "retargeting-urgency-example-01.webp", "retargeting-urgency-example-02.webp", "retargeting-urgency-example-03.webp", "retargeting-urgency-example-04.webp", "retargeting-urgency-example-05.webp", "retargeting-urgency-example-06.webp", "retargeting-urgency-example-07.webp"]
};

const imageAlt = {
  "url-to-ad": ["Matte ceramic travel mug product input for a URL-to-ad brief", "Creator filming a travel mug ad beside an ecommerce product page", "Shopper reviewing a travel mug product page before the ad brief", "Creator identifying a travel mug use moment at a work desk", "Travel mug lid detail used as visible product proof", "Travel mug used during a real commuter morning", "Creator explaining travel mug context in a natural home scene", "Travel mug detail review for a product-page ad concept", "Creator recommending a travel mug after reviewing product context"],
  "hook-lab": ["Coral-cap facial serum product input for first-three-second hook tests", "Creator holding skincare serum for a fast opening hook", "Skincare serum entering frame as a visual pattern interrupt", "Creator asking a direct skincare question with serum visible", "Creator using a hand gesture to stop the scroll in a serum hook", "Serum application paying off the opening promise", "Skincare serum close-up used as a hook payoff detail", "Creator holding serum after the winning hook beat", "Creator giving a clear skincare recommendation after the hook"],
  "pas-formula-ads": ["White desktop air purifier product input for a PAS ad", "PAS product ad output showing a home office problem and solution", "Crowded home office establishing the air quality problem", "Creator reacting to an uncomfortable stuffy workspace", "Dust visible in window light for the PAS agitation beat", "Creator recognizing the office problem before the solution", "Hand switching on a white desktop air purifier", "Air purifier filter and airflow shown as solution proof", "Creator explaining the practical air purifier solution"],
  "testimonial-ads": ["Teal portable blender product input for a testimonial ad", "Customer speaking to camera with a portable blender testimonial", "Customer describing the morning problem before using the blender", "Smoothie ingredients prepared for a specific customer use case", "Customer adding ingredients to a portable blender in the kitchen", "Portable blender mixing a smoothie as experience evidence", "Customer tasting the smoothie in a real testimonial moment", "Customer reacting honestly after using the portable blender", "Customer recommending the portable blender with product visible"],
  "before-after-showcases": ["Bamboo closet organizer parts prepared for a before-and-after ad", "Matched closet transformation output showing clutter become organized", "Messy closet shelf establishing the before state", "Clothing pile showing the starting organization problem", "Creator measuring the closet before installing the organizer", "Hands assembling a bamboo closet organizer", "Bamboo organizer installed inside the same closet", "Matched organized closet shelf showing the after state", "Creator presenting the completed closet transformation"],
  "talking-photo-recs": ["Matte black sunglasses product input for a talking recommendation", "Creator speaking to camera while recommending black sunglasses", "Close-up black sunglasses frame detail for a recommendation hook", "Creator pointing out sunglasses fit beside their face", "Creator putting on black sunglasses in a natural outdoor moment", "Amber sunglasses lens detail shown as recommendation proof", "Creator wearing sunglasses during a casual café moment", "Creator giving a point-of-view sunglasses recommendation", "Creator showing sunglasses in a conversational final frame"],
  "ai-actor-product-ads": ["Charcoal smart-home speaker product input for a presenter-led ad", "Presenter holding a smart-home speaker in a controlled product ad", "Expert presenter explaining a smart-home speaker at a desk", "Creator presenter recommending a speaker in a living room", "Presenter demonstrating a voice interaction with the speaker", "Close-up smart-home speaker controls during a product demo", "Presenter showing the speaker in an everyday home use case", "Alternate presenter persona holding the smart-home speaker", "Presenter delivering a clear speaker recommendation to camera"],
  "tiktok-reels-shorts": ["White running sneakers with coral accents for a vertical ad input", "Creator filming running sneakers in a mobile vertical social frame", "Running shoe stepping into frame for a fast vertical hook", "Runner showing sneaker motion on a city sidewalk", "Creator tying running shoe laces in a vertical-safe composition", "Running shoe sole detail used as mobile product proof", "Runner moving through a city scene with shoes centered", "Creator speaking about running shoes inside the safe frame", "Creator presenting running shoes in a final vertical CTA frame"],
  "native-spark-ads": ["Sage reusable water bottle product input for a native feed ad", "Creator casually introducing a reusable bottle in a native feed moment", "Creator showing a tired daily routine before a bottle tip", "Reusable bottle appearing beside a laptop in a useful workspace", "Reusable bottle being filled during an everyday kitchen routine", "Bottle lid and matte texture shown as practical proof", "Creator carrying the bottle outdoors in a daily routine", "Reusable bottle beside a gym bag in a candid feed scene", "Creator giving a direct low-pressure bottle recommendation"],
  "carousel-storytelling": ["Structured black travel backpack product input for a carousel story", "Traveler opening a packed backpack as the carousel story output", "Traveler preparing to leave with a black backpack and essentials", "Laptop and travel items organized inside backpack compartments", "Backpack compartments and zippers shown as a story proof frame", "Traveler wearing the backpack while leaving home", "Traveler carrying the backpack through a station", "Black backpack supporting a useful café work moment", "Traveler ready to depart in the final carousel frame"],
  "retargeting-urgency": ["Navy wireless headphones product input for a retargeting ad", "Returning shopper revisiting wireless headphones in a creator-style frame", "Shopper considering wireless headphones after a decision pause", "Returning shopper reviewing the headphone product context", "Creator answering a wireless headphone purchase objection", "Headphone cushion and hinge detail resolving a hesitation", "Shopper using wireless headphones during focused work", "Wireless headphones beside a commute bag for a timely reminder", "Creator inviting a returning shopper to reconsider headphones"]
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

const commonRelated = [
  { title: "URL to Ad", body: "Start with a product page and turn its useful details into a creator-style ad brief.", href: "/ai-video-generation/url-to-ad", linkLabel: "Open URL to Ad" },
  { title: "Hook Lab", body: "Create several opening directions so the first three seconds have a clear testing job.", href: "/ai-video-generation/hook-lab", linkLabel: "Open Hook Lab" },
  { title: "AI Actor Product Ads", body: "Add a consistent on-camera presenter when the campaign needs a more controlled delivery.", href: "/ai-video-generation/ai-actor-product-ads", linkLabel: "Explore AI actors" }
];

const pages = [
  {
    key: "url-to-ad",
    menuLabel: "URL to Ad",
    title: "AI UGC Product Ad Generator from a URL | Aidreamcapes",
    description: "Turn a product URL into a creator-style UGC ad brief with hooks, product proof, and vertical cuts ready for TikTok, Reels, and Shorts for ecommerce.",
    keywords: "product URL to ad, URL to UGC ad, AI product ad generator, ecommerce UGC video, product page to video ad",
    twitterDescription: "Turn a product URL into a creator-style UGC ad brief with hooks, proof, and vertical cuts ready for TikTok, Reels, and Shorts for ecommerce.",
    heroTitle: "Turn a product URL into a UGC ad people can understand fast.",
    heroBody: "Start with a product page instead of a blank brief. Pull the useful details into a creator-style ad direction, then compare the hook, proof, and next step before you generate.",
    outputLabel: "UGC ad concept",
    imageNote: "URL → product context → creator ad",
    focus: "product-page context",
    outputCopy: ["A clear opening names the buyer situation.", "Product details become visible proof.", "The CTA gives the viewer one next action."],
    workflowCards: [
      ["Paste the product URL", "Use a public product page with the claims, features, and offer details you want the ad to reflect."],
      ["Select the buyer angle", "Choose the problem, use moment, comparison, or offer that matters most for this campaign."],
      ["Review the brief", "Check the extracted product context and edit anything that should not appear in the creative."],
      ["Generate vertical cuts", "Create a focused UGC direction for a 9:16 placement and export the version you want to test."]
    ],
    directionCards: [
      ["Lead with the use case", "Open on the moment the buyer recognizes, then let the product enter as the practical answer."],
      ["Make proof observable", "Translate features into actions, close-ups, or outcomes a viewer can understand without rereading the page."],
      ["Keep the claim grounded", "Use only product information that is visible and supportable on the source page."],
      ["Close with one action", "Choose a single next step such as learn more, try it, or shop the product."]
    ],
    exampleTitle: "Product pages become ad directions, not generic slides.",
    exampleIntro: "Use the page context to guide the creator, the product proof, and the CTA. The finished concept should still feel native to a feed.",
    examples: [["HOOK", "Name the buyer problem before showing the product."], ["DEMO", "Show the feature in the moment it is useful."], ["PROOF", "Put the relevant product detail on screen."], ["CTA", "End with a next step that matches the page." ]],
    adTitle: "Build URL-led concepts for every vertical placement.",
    adIntro: "One product page can support several ad tests when each cut has a different opening and a clearly defined proof moment.",
    requirementsIntro: "A clean source page helps the workflow separate useful product context from copy that needs review.",
    requirementCards: [["Public product URL", "Use a page the workflow can read and that contains the product details you are permitted to use."], ["One campaign goal", "Decide whether the cut is meant to explain, compare, launch, or drive a click."], ["Claim review", "Confirm prices, results, testimonials, and offer language before publishing an ad."], ["Rights and approvals", "Only use product assets, creator identities, and destinations your team has permission to use."]],
    finalTitle: "Have a product page worth testing?",
    finalBody: "Turn its strongest product context into a focused UGC ad direction and compare the first three seconds before you spend on media.",
    faq: [["Can I use any product URL?", "Use a public product page that your team is allowed to analyze and whose claims you can verify. Pages behind a login or blocked by access controls may not provide usable context."], ["Does the workflow copy my product page word for word?", "No. It uses the page as context for a creative direction. Review every claim, price, offer, and destination before using the generated ad."], ["What makes a URL-to-ad brief useful?", "It connects a buyer problem to an observable product proof moment and one clear CTA instead of repeating a product description."], ["Can I make different cuts from one URL?", "Yes. Start with different buyer angles or hooks, then review each concept and choose the vertical versions that fit your campaign."], ["Which placements are supported?", "The page is designed for vertical UGC concepts that can be adapted for TikTok, Instagram Reels, and YouTube Shorts."]]
  },
  {
    key: "hook-lab",
    menuLabel: "Hook Lab (First 3s)",
    title: "AI Hook Lab for UGC Ads | First 3 Seconds | Aidreamcapes",
    description: "Test sharper first-three-second hooks for UGC product ads with creator delivery, visible product proof, and vertical concepts built for social feeds.",
    keywords: "AI hook generator, UGC ad hooks, first three seconds ad, product video hook testing, short-form ad creative",
    twitterDescription: "Test sharper first-three-second hooks for UGC product ads with creator delivery, visible product proof, and vertical concepts built for social feeds.",
    heroTitle: "Give the first three seconds a job to do.",
    heroBody: "Build a set of hook directions around one product and one buyer situation. Compare the opening promise, creator delivery, and proof cue before you commit the rest of the cut.",
    outputLabel: "Hook variations",
    imageNote: "hook → context → proof",
    focus: "first-three-second hook",
    outputCopy: ["Each opening has a distinct audience tension.", "The product appears early enough to orient the viewer.", "The rest of the ad pays off the selected hook."],
    workflowCards: [["Choose one buyer tension", "Start with a real question, frustration, desire, or decision the audience already recognizes."], ["Generate opening directions", "Create different hook patterns without changing the product promise underneath."], ["Review the first frame", "Check whether the opening communicates its subject before the viewer has to decode the scene."], ["Carry the winner forward", "Use the strongest opening to guide product proof, creator delivery, and the CTA."]],
    directionCards: [["Question hook", "Ask the question the buyer is already asking, then answer it with a concrete product moment."], ["Pattern interrupt", "Change the visual or spoken rhythm quickly, while keeping the product context understandable."], ["Specific promise", "Make one precise promise that the following shot can visibly support."], ["Curiosity with a payoff", "Create a reason to keep watching without hiding what product the ad is about."]],
    exampleTitle: "Compare openings before polishing the whole ad.",
    exampleIntro: "A strong hook is not just louder copy. It gives the viewer a reason to stay and gives the edit a clear promise to pay off.",
    examples: [["QUESTION", "Start with the buyer question the product answers."], ["PATTERN", "Interrupt the scroll with a purposeful visual change."], ["PROMISE", "State one outcome the next shot can prove."], ["PAYOFF", "Resolve the opening tension with the product in use."]],
    adTitle: "Make hook testing a repeatable creative step.",
    adIntro: "Keep the product, audience, and offer stable while you compare different opening jobs across vertical placements.",
    requirementsIntro: "Hook quality improves when the creative brief identifies the buyer and the proof before it asks for a dramatic opening.",
    requirementCards: [["One audience tension", "Name the moment or objection the hook is meant to surface."], ["Product context", "Know which feature, use moment, or outcome the hook will introduce."], ["Proof plan", "Choose a visible action, detail, or comparison that can pay off the opening."], ["Fast review", "Reject hooks that need too much setup before the viewer knows what is being offered."]],
    finalTitle: "Ready to test the opening?",
    finalBody: "Create several purposeful first-three-second directions, then build the rest of the UGC ad around the hook that earns attention honestly.",
    faq: [["What is a hook in a UGC ad?", "A hook is the opening idea, line, or visual that gives a viewer a reason to keep watching. It should make the product context clear enough to support the next beat."], ["How many hooks should I compare?", "Compare a small set of distinct directions with the same product and audience. The goal is useful contrast, not a large list of near-duplicates."], ["Should the product appear in the first three seconds?", "Usually the viewer should understand the product context early. The exact timing depends on the creative direction, but mystery should not replace clarity."], ["Can Hook Lab change my product claims?", "Treat generated language as a draft. Verify claims, outcomes, pricing, and testimonials against the product information you own before publishing."], ["Where can I use the resulting hooks?", "The concepts are designed for vertical short-form ads and can be adapted for TikTok, Instagram Reels, and YouTube Shorts."]]
  },
  {
    key: "pas-formula-ads",
    menuLabel: "PAS Formula Ads",
    title: "PAS Formula Ad Video Generator | Aidreamcapes",
    description: "Create problem-agitate-solution UGC product ads that connect a real buyer frustration to product proof and a clear next step for social campaigns.",
    keywords: "PAS formula ads, problem agitate solution video, AI UGC ad formula, ecommerce problem solution ad, product advertising video",
    twitterDescription: "Create problem-agitate-solution UGC product ads that connect a real buyer frustration to product proof and a clear next step for social campaigns.",
    heroTitle: "Turn a real product problem into a clearer ad story.",
    heroBody: "Use the problem–agitate–solution structure to give a creator-style ad a useful narrative arc: recognize the frustration, make the cost of inaction concrete, and show how the product helps.",
    outputLabel: "PAS ad structure",
    imageNote: "problem → tension → solution",
    focus: "problem-agitate-solution structure",
    outputCopy: ["The problem mirrors a recognizable buyer moment.", "Agitation adds stakes without inventing fear.", "The solution is demonstrated through product proof."],
    workflowCards: [["Define the problem", "Describe one specific situation the intended buyer already wants to solve."], ["Set the stakes", "Show what becomes harder, slower, or less satisfying when the problem remains unresolved."], ["Introduce the solution", "Bring the product into the situation and show the feature doing useful work."], ["End with the next step", "Connect the solution to a CTA that fits the campaign and landing page."]],
    directionCards: [["Problem in frame", "Use a familiar action or environment so the audience recognizes the situation before the pitch begins."], ["Agitate with evidence", "Use a consequence, friction point, or missed opportunity instead of exaggerated anxiety."], ["Solution in use", "Show the product changing the moment rather than relying only on a feature list."], ["Offer with context", "Let the CTA follow the solution naturally and avoid introducing a new promise at the end."]],
    exampleTitle: "A formula is useful when every beat has evidence.",
    exampleIntro: "PAS should clarify the buyer’s decision, not pressure the viewer. Give each stage a visual or spoken job that the product can support.",
    examples: [["PROBLEM", "Show the friction in a moment the audience knows."], ["AGITATE", "Make the consequence specific and observable."], ["SOLUTION", "Demonstrate the product feature in use."], ["CTA", "Invite one relevant next action."]],
    adTitle: "Build PAS cuts that stay useful in the feed.",
    adIntro: "A compact problem–agitate–solution arc helps the viewer understand why this product matters before the CTA arrives.",
    requirementsIntro: "The PAS structure needs one credible problem and one product-supported answer. More pressure does not make an unsupported claim safer.",
    requirementCards: [["Specific buyer problem", "Avoid combining several unrelated frustrations into one opening."], ["Supportable stakes", "Use consequences your team can explain or demonstrate without exaggeration."], ["Feature-to-benefit link", "Show exactly how the product enters the situation and what changes."], ["Aligned destination", "Make sure the landing page continues the promise made by the ad."]],
    finalTitle: "Have a real problem worth solving?",
    finalBody: "Shape it into a grounded PAS ad with a visible solution, then review the claim and destination before you put budget behind it.",
    faq: [["What does PAS stand for in advertising?", "PAS means problem, agitate, solution. The structure starts with a recognizable problem, explains why it matters, and shows the product as a practical solution."], ["Can PAS ads use emotional language?", "Yes, when the emotion comes from a real buyer situation and stays accurate. Avoid fear, urgency, or outcomes that the product cannot support."], ["How long should a PAS UGC ad be?", "Use the shortest cut that makes the problem, product proof, and next step understandable for the placement. The right duration depends on the campaign and audience."], ["Does PAS work for ecommerce products?", "It can work well when the product solves a concrete use-case problem and the ad can demonstrate the relevant feature or outcome."], ["What should I review before publishing?", "Check product claims, demonstrations, pricing, testimonials, rights, and the match between the CTA and the destination page."]]
  },
  {
    key: "testimonial-ads",
    menuLabel: "Testimonial Ads",
    title: "AI Testimonial Ad Video Generator | Aidreamcapes",
    description: "Create testimonial-style UGC product ad concepts with a clear customer perspective, believable product proof, and review-safe language for social video.",
    keywords: "AI testimonial ads, testimonial UGC video, customer story ad, product review video generator, social proof advertising",
    twitterDescription: "Create testimonial-style UGC product ad concepts with a clear customer perspective, believable product proof, and review-safe language for social video.",
    heroTitle: "Make the customer perspective clear without faking proof.",
    heroBody: "Build a testimonial-style ad around a specific experience: what the buyer needed, what they noticed, and what changed. Keep the story useful, reviewable, and grounded in evidence you can publish.",
    outputLabel: "Testimonial concept",
    imageNote: "experience → proof → recommendation",
    focus: "testimonial-style social proof",
    outputCopy: ["The speaker has a clear reason to care.", "The product proof supports the experience described.", "The recommendation does not overreach the evidence."],
    workflowCards: [["Choose the experience", "Start with one real use case, buyer need, or decision the testimonial should illuminate."], ["Map the proof", "Pair the speaker’s observation with a product action, detail, or result viewers can see."], ["Draft the delivery", "Give the creator a natural point of view instead of a generic superlative."], ["Review the claim", "Confirm that every quote, outcome, identity, and endorsement is permitted and accurate."]],
    directionCards: [["Specific moment", "Anchor the story in when, where, or why the product became useful."], ["Observed benefit", "Describe what the person could actually notice rather than promising an unsupported result."], ["Balanced voice", "Let the delivery sound human and specific without turning uncertainty into certainty."], ["Evidence-led CTA", "Continue to a product page or offer that can substantiate the recommendation."]],
    exampleTitle: "Social proof works when the proof is traceable.",
    exampleIntro: "Use testimonial language to add perspective, not to manufacture a customer. Treat every testimonial, likeness, and result as an approval item.",
    examples: [["NEED", "Explain what the customer wanted to solve."], ["EXPERIENCE", "Describe the moment the product was used."], ["PROOF", "Show the detail that supports the observation."], ["RECOMMEND", "Close with a qualified, accurate next step."]],
    adTitle: "Test different testimonial angles with the same standard of proof.",
    adIntro: "Compare a use-case story, feature reaction, and outcome explanation without changing what the underlying evidence actually supports.",
    requirementsIntro: "Testimonial creative needs more than a good script. Identity, consent, claims, and source evidence all need a clear owner.",
    requirementCards: [["Verified source", "Use an approved customer statement, review, or brief that your team can substantiate."], ["Consent and likeness", "Confirm permission for the speaker identity, image, voice, and distribution channel."], ["Claim boundaries", "Do not turn a personal experience into a universal guarantee."], ["Review destination", "Make sure the landing page contains the same product and offer context as the ad."]],
    finalTitle: "Have a customer perspective to share?",
    finalBody: "Turn a verified experience into a focused testimonial ad concept with product proof that the viewer can understand and your team can approve.",
    faq: [["Can AI create a real customer testimonial?", "It can help structure a testimonial-style concept, but it cannot make an invented statement, identity, or result a real customer testimonial. Use only approved evidence and disclose synthetic content where required."], ["What makes a testimonial ad credible?", "Specific context, observable product proof, accurate language, and a clear permission trail make a testimonial more credible than broad praise alone."], ["Can I use customer reviews as input?", "Use reviews only when your team has permission to reuse them and can preserve their meaning. Check platform, privacy, and advertising requirements before publishing."], ["Should every testimonial include a result?", "No. A clear use moment or observed feature can be useful without promising a quantified outcome that the source does not support."], ["What should I approve before publishing?", "Approve the speaker, likeness, words, claims, product footage, offer, destination, and any required disclosure."]]
  },
  {
    key: "before-after-showcases",
    menuLabel: "Before-After Showcases",
    title: "Before-and-After Product Ad Video Generator | Aidreamcapes",
    description: "Build before-and-after UGC product ads that show a clear starting point, product-led change, and honest context for ecommerce and social campaigns.",
    keywords: "before and after ads, transformation product video, UGC before after showcase, product comparison ad, AI ecommerce ad video",
    twitterDescription: "Build before-and-after UGC product ads that show a clear starting point, product-led change, and honest context for ecommerce and social campaigns.",
    heroTitle: "Show the change, not just the promise.",
    heroBody: "Create a before-and-after direction with a defined starting point, a product-led action, and a result the viewer can interpret. Keep the comparison fair, clear, and appropriate for the claim.",
    outputLabel: "Before / after cut",
    imageNote: "before → product action → after",
    focus: "before-and-after product proof",
    outputCopy: ["The starting condition is easy to recognize.", "The product action explains what caused the change.", "The comparison keeps the context honest."],
    workflowCards: [["Define the before", "Describe the starting condition with enough context that the viewer knows what is being compared."], ["Show the action", "Put the product, feature, or workflow between the two states so the change has a reason."], ["Frame the after", "Show the relevant improvement without hiding the conditions that produced it."], ["Check the claim", "Review whether the comparison is representative, supportable, and allowed for your category."]],
    directionCards: [["Matched framing", "Keep the camera, crop, lighting, and context consistent when the comparison needs visual fairness."], ["Visible mechanism", "Show what the product did instead of cutting directly from a problem to an unexplained result."], ["Specific outcome", "Focus on one observable difference rather than implying every buyer will see the same result."], ["Contextual disclaimer", "Add required qualifiers when timing, usage, condition, or results vary."]],
    exampleTitle: "A comparison earns trust when the difference has context.",
    exampleIntro: "Before-and-after creative can be compelling, but the edit should make the setup, product action, and limits of the comparison easy to understand.",
    examples: [["BEFORE", "Make the starting state specific and legible."], ["ACTION", "Show the product feature doing the work."], ["AFTER", "Reveal the relevant change in the same context."], ["NOTE", "Preserve any qualifier needed to interpret the result."]],
    adTitle: "Turn transformations into reviewable ad tests.",
    adIntro: "Compare different ways to stage the before, demonstrate the product action, and frame the after without changing the underlying evidence.",
    requirementsIntro: "The more dramatic the comparison, the more important the source, setup, usage conditions, and claim review become.",
    requirementCards: [["Comparable source", "Capture or supply a before state that can be fairly compared with the after state."], ["Documented usage", "Know how the product was used, for how long, and under what conditions."], ["Category review", "Check rules for appearance, health, financial, performance, or other sensitive claims."], ["Clear qualifier", "Explain material limitations instead of letting the edit imply a universal result."]],
    finalTitle: "Have a real transformation to explain?",
    finalBody: "Build a before-and-after ad concept that shows the mechanism, keeps the comparison honest, and gives the viewer a clear next step.",
    faq: [["What makes a before-and-after ad credible?", "A credible comparison shows the starting context, the product action, the resulting state, and any conditions that affect how the result should be interpreted."], ["Can I use AI-generated before-and-after images?", "Only use synthetic comparisons when your advertising and platform policies allow them, and do not present an invented result as documented customer evidence."], ["Do before-and-after ads need disclaimers?", "Some categories and claims require qualifiers or disclosures. Review applicable advertising rules and your internal approval requirements before publishing."], ["Should the before and after use the same framing?", "Matched framing helps viewers understand the difference, especially when the claim depends on visual comparison. The correct setup depends on the product and evidence."], ["Can I test different transformations?", "Yes, if each concept remains accurate and clearly explains what product action or use condition produced the depicted change."]]
  },
  {
    key: "talking-photo-recs",
    menuLabel: "Talking Photo Recs",
    title: "Talking Photo Product Recs for UGC Ads | Aidreamcapes",
    description: "Turn a product photo into a talking recommendation concept with clear product context, creator-style delivery, and reviewable claims for vertical social ads.",
    keywords: "talking photo product recommendation, AI talking product ad, photo to UGC video, product recommendation video, creator-style ad",
    twitterDescription: "Turn a product photo into a talking recommendation concept with clear product context, creator-style delivery, and reviewable claims for vertical social ads.",
    heroTitle: "Give a product photo a useful point of view.",
    heroBody: "Start from a strong product image and shape a talking recommendation around who it helps, what to notice, and why the next step is worth taking. Keep the delivery natural and the claims reviewable.",
    outputLabel: "Talking recommendation",
    imageNote: "product photo → voice → recommendation",
    focus: "talking product recommendation",
    outputCopy: ["The recommendation starts from a visible product detail.", "The delivery explains who the product is for.", "The CTA remains clear without implying a real endorsement."],
    workflowCards: [["Choose the product frame", "Use a photo where the product, packaging, or key detail is clear enough to discuss."], ["Set the point of view", "Define the buyer, use moment, and reason this product deserves attention."], ["Write talking points", "Organize the delivery around a hook, proof detail, honest context, and next action."], ["Review the presentation", "Check voice, likeness, disclosure, claims, and the final destination before publishing."]],
    directionCards: [["Detail-led opening", "Start on the physical feature the recommendation is about, then explain why it matters."], ["Use-case recommendation", "Frame the product for a specific buyer or situation instead of recommending it to everyone."], ["Natural delivery", "Use conversational pacing and concrete observations rather than a wall of superlatives."], ["Transparent synthetic media", "Make the presentation and any required disclosure clear when the speaker is generated."]],
    exampleTitle: "A talking photo should add context, not noise.",
    exampleIntro: "The image supplies the product anchor. The recommendation supplies the buyer perspective, usage context, and reason to continue.",
    examples: [["DETAIL", "Open on the product feature worth noticing."], ["POV", "Explain who would find the product useful."], ["PROOF", "Show the product in a relevant use moment."], ["NEXT", "Give the viewer one honest action to take."]],
    adTitle: "Make product-photo recommendations easy to test.",
    adIntro: "Keep the product image stable while you compare different buyer perspectives, talking points, and opening deliveries for vertical placements.",
    requirementsIntro: "A strong source photo and a defined presenter brief help keep talking recommendations specific and safe to review.",
    requirementCards: [["Clear product image", "Use an image that shows the product and avoids details that could be misrepresented."], ["Presenter permission", "Confirm rights for any real person, likeness, voice, or identity used in the concept."], ["Point of view", "Define the buyer and situation so the recommendation has a meaningful reason to exist."], ["Disclosure plan", "Follow applicable disclosure requirements for generated speakers or synthetic presentations."]],
    finalTitle: "Have a product photo ready?",
    finalBody: "Turn it into a focused talking recommendation with a clear buyer point of view, then review the presentation and claims before publishing.",
    faq: [["What is a talking photo recommendation?", "It is a product recommendation concept built from a still image and a spoken or presenter-style delivery. The image anchors the product while the script adds context."], ["Can a talking photo be presented as a real customer?", "Do not imply a generated speaker is a real customer or endorsement. Use only approved identities and follow any required synthetic-media disclosure rules."], ["What should the script include?", "A useful script usually includes the buyer situation, a visible product detail, a practical reason it matters, and one clear next step."], ["Can I start with one product image?", "Yes, when the image clearly shows the product. Additional approved images or product context can make the recommendation more specific."], ["Where can I use these concepts?", "They are intended for vertical social ad concepts and should be adapted to the policies, disclosures, and creative requirements of each platform."]]
  },
  {
    key: "ai-actor-product-ads",
    menuLabel: "AI Actor Product Ads",
    title: "AI Actor Product Ad Video Generator | Aidreamcapes",
    description: "Create AI actor product ads with controlled presenter direction, visible product proof, and vertical cuts for testing across TikTok, Reels, and Shorts.",
    keywords: "AI actor product ads, AI presenter video, virtual actor ecommerce ad, product spokesperson generator, UGC actor ad",
    twitterDescription: "Create AI actor product ads with controlled presenter direction, visible product proof, and vertical cuts for testing across TikTok, Reels, and Shorts.",
    heroTitle: "Put the right presenter in front of the product.",
    heroBody: "Build a product ad around a consistent AI actor direction, a clear script, and proof that stays visible. Choose the presenter for the audience and message—not as a substitute for evidence.",
    outputLabel: "AI actor ad",
    imageNote: "actor → product proof → CTA",
    focus: "AI presenter product ad",
    outputCopy: ["The presenter has a defined role and audience fit.", "Product proof remains visible during the delivery.", "The synthetic presentation is reviewed before distribution."],
    workflowCards: [["Define the presenter role", "Choose the tone, audience, language, and context the actor should represent."], ["Prepare the product brief", "Give the presenter one product promise, one proof moment, and one next action."], ["Direct the delivery", "Set pacing, framing, gestures, and emphasis so the actor supports the product story."], ["Review rights and output", "Check likeness permissions, disclosure, pronunciation, claims, and destination before publishing."]],
    directionCards: [["Expert explainer", "Use a calm, specific delivery when the audience needs help understanding a feature or workflow."], ["Creator recommendation", "Use conversational language and a defined use case without implying a real personal experience."], ["Product demonstrator", "Let the actor guide attention to the action the viewer needs to see."], ["Localized presenter", "Adapt language and pacing for the target audience while keeping the product facts consistent."]],
    exampleTitle: "The actor is the delivery system; the product is the proof.",
    exampleIntro: "A controlled presenter helps test tone and audience fit, but the ad still needs an observable product reason to believe.",
    examples: [["ROLE", "Give the actor a specific job in the story."], ["SCRIPT", "Keep the delivery focused on one product promise."], ["PROOF", "Show the feature or use moment while the actor speaks."], ["DISCLOSE", "Review synthetic identity and distribution requirements."]],
    adTitle: "Test presenter fit without losing product clarity.",
    adIntro: "Compare delivery style, tone, language, and framing while keeping the product context and proof standard consistent.",
    requirementsIntro: "AI actor creative needs a presenter brief, product brief, permission check, and a review path for synthetic media.",
    requirementCards: [["Presenter direction", "Define audience, tone, language, framing, and the role the actor plays."], ["Approved likeness", "Use only actor assets and identities your team has permission to distribute."], ["Product proof", "Plan a visible action or detail that supports the words being spoken."], ["Disclosure and review", "Check synthetic-media, platform, and advertising requirements before publishing."]],
    finalTitle: "Need a presenter for the next product test?",
    finalBody: "Create an AI actor direction with a clear role, visible proof, and a reviewable path from script to vertical ad output.",
    faq: [["What is an AI actor product ad?", "It is a product advertising concept delivered by a generated presenter or actor. The presenter provides delivery and context; the product proof still needs to be accurate and visible."], ["Can an AI actor claim to have used the product?", "Do not present generated personal experience as a real customer or actor endorsement. Use accurate framing and any required synthetic-media disclosure."], ["How should I choose an AI actor?", "Choose based on audience fit, tone, language, framing, and the delivery job. A presenter should make the product easier to understand, not distract from it."], ["Can I create localized actor ads?", "You can adapt language and delivery when the product facts, claims, pronunciation, and approvals remain consistent for each market."], ["What rights should I check?", "Review likeness, voice, music, product assets, testimonials, destination, and platform-specific synthetic-media requirements."]]
  },
  {
    key: "tiktok-reels-shorts",
    menuLabel: "TikTok / Reels / Shorts",
    title: "TikTok, Reels & Shorts UGC Ad Generator | Aidreamcapes",
    description: "Create vertical UGC product ad concepts for TikTok, Instagram Reels, and YouTube Shorts with platform-ready hooks, proof, pacing, and CTAs for social.",
    keywords: "TikTok UGC ads, Instagram Reels product ads, YouTube Shorts ads, vertical video ad generator, short-form ecommerce video",
    twitterDescription: "Create vertical UGC product ad concepts for TikTok, Instagram Reels, and YouTube Shorts with platform-ready hooks, proof, pacing, and CTAs for social.",
    heroTitle: "Design one product story for the vertical feed.",
    heroBody: "Build a 9:16 UGC ad direction that can be adapted across TikTok, Reels, and Shorts. Keep the hook, product proof, pacing, and CTA legible inside the feed experience.",
    outputLabel: "9:16 social cut",
    imageNote: "vertical frame → native delivery",
    focus: "TikTok, Reels, and Shorts placement",
    outputCopy: ["The product stays legible in a vertical frame.", "The opening earns attention without hiding the message.", "The CTA survives platform UI and safe areas."],
    workflowCards: [["Set the placement", "Choose the 9:16 frame, safe areas, duration, and audience context before writing the cut."], ["Build the opening", "Use a hook that feels native to short-form viewing while keeping the product subject clear."], ["Plan the proof beat", "Use product action, detail, or creator context to make the message easy to understand quickly."], ["Export for review", "Check captions, crop, sound, pacing, and CTA placement before adapting the concept per platform."]],
    directionCards: [["Native creator rhythm", "Use a direct, conversational opening and purposeful changes in visual attention."], ["Product in frame", "Keep the product or its relevant outcome visible enough for the viewer to orient quickly."], ["Caption-safe layout", "Leave room for platform UI, captions, and accessibility without hiding the proof."], ["One clear CTA", "Give the viewer a single next step that matches the destination and campaign goal."]],
    exampleTitle: "A vertical ad needs to work inside the feed, not beside it.",
    exampleIntro: "Use the same product story with placement-aware framing, readable overlays, creator context, and a CTA that survives the scroll.",
    examples: [["9:16", "Keep the product and proof inside the safe frame."], ["HOOK", "Earn attention without delaying the subject."], ["CAPTIONS", "Make the message readable with sound off."], ["CTA", "Reserve a clear action area at the end."]],
    adTitle: "Prepare one concept for three short-form destinations.",
    adIntro: "Test the creative idea across TikTok, Reels, and Shorts while adapting the crop, caption treatment, pacing, and platform requirements.",
    requirementsIntro: "Short-form production benefits from a defined frame, message hierarchy, caption plan, and placement review before export.",
    requirementCards: [["9:16 source", "Start from a vertical composition with the product and creator readable on mobile."], ["Safe-area plan", "Protect the hook, product proof, captions, and CTA from platform controls."], ["Sound-off fallback", "Make the core message understandable with captions and visual context."], ["Platform review", "Check current placement specifications, music rights, disclosure, and ad policies."]],
    finalTitle: "Ready to make the idea scroll-native?",
    finalBody: "Create a focused vertical UGC concept, then adapt its hook, proof, and CTA for the short-form placements your campaign actually uses.",
    faq: [["Can one video work on TikTok, Reels, and Shorts?", "One core concept can be adapted across the three placements, but crop, captions, safe areas, audio, duration, and platform requirements should be reviewed separately."], ["What aspect ratio should I use?", "This workflow is designed around vertical 9:16 creative. Keep key product information within the safe area for each destination."], ["Should the ad include captions?", "Captions help viewers understand the message with sound off and improve accessibility. Review their placement against platform UI and the visual proof."], ["How quickly should the product appear?", "Show enough product context early for the viewer to understand the ad, then use the remaining cut to demonstrate the relevant proof and CTA."], ["Can I use trending audio?", "Only use audio with the rights and commercial permissions required for the placement and campaign."]]
  },
  {
    key: "native-spark-ads",
    menuLabel: "Native Spark Ads",
    title: "Native Spark Ad Video Generator | Aidreamcapes",
    description: "Create native-style product ad concepts that feel like useful creator posts while keeping product context, proof, disclosure, and the CTA clear.",
    keywords: "native spark ads, creator-style product ads, organic-looking UGC ad, social spark ad creative, native ecommerce video",
    twitterDescription: "Create native-style product ad concepts that feel like useful creator posts while keeping product context, proof, disclosure, and the CTA clear.",
    heroTitle: "Make the ad feel native without making it unclear.",
    heroBody: "Shape a creator-style product post with the pacing and context people expect in a social feed. Keep the commercial relationship, product proof, and next action easy to understand.",
    outputLabel: "Native-style cut",
    imageNote: "creator context → product proof",
    focus: "native creator-style advertising",
    outputCopy: ["The opening belongs in the feed context.", "The creator perspective adds useful context.", "The commercial message stays transparent."],
    workflowCards: [["Set the native context", "Choose the creator setting, audience moment, and post style that make the product relevant."], ["Lead with usefulness", "Open with a real question, tip, reaction, or demonstration instead of an unexplained sales line."], ["Reveal the product proof", "Connect the creator context to a detail or action viewers can evaluate."], ["Keep disclosure visible", "Review paid, sponsored, affiliate, synthetic-media, and CTA requirements before distribution."]],
    directionCards: [["Useful tip", "Give the viewer a practical idea first, then show the product that supports it."], ["First impression", "Use an honest reaction or discovery moment without inventing a customer experience."], ["Creator walkthrough", "Let the creator guide the viewer through the product decision in a natural sequence."], ["Native CTA", "Keep the next action direct while preserving the tone and disclosure expected for an ad."]],
    exampleTitle: "Native does not mean invisible.",
    exampleIntro: "The strongest native-style ad feels at home in the feed and remains honest about what it is, who made it, and what the product can do.",
    examples: [["CONTEXT", "Start in a feed-native situation."], ["VALUE", "Give the viewer a useful reason to watch."], ["PROOF", "Show the product detail that supports the message."], ["DISCLOSE", "Keep the commercial relationship clear."]],
    adTitle: "Test native openings while keeping the standard of clarity.",
    adIntro: "Compare tips, reactions, demos, and creator explanations without relying on confusion or undisclosed commercial context to earn attention.",
    requirementsIntro: "Native-style creative needs a clear post context, a useful message, and a distribution review that covers disclosure and rights.",
    requirementCards: [["Feed context", "Define the creator setting and viewer situation before choosing the opening."], ["Useful message", "Give the audience a practical reason to watch beyond a sales claim."], ["Commercial disclosure", "Follow the disclosure requirements for sponsorship, affiliate, paid, and synthetic content."], ["Rights check", "Confirm creator, music, product, and destination permissions before export."]],
    finalTitle: "Ready to make the ad belong in the feed?",
    finalBody: "Create a native-style product concept that is useful, transparent, and clear enough for the viewer to make an informed next decision.",
    faq: [["What is a native-style ad?", "It is an ad designed to fit the visual and conversational context of its placement. Native style should improve relevance without hiding the commercial nature of the content."], ["Are Spark Ads the same as organic posts?", "No. A paid placement or boosted creator post remains advertising. Follow the applicable platform, sponsorship, and disclosure requirements."], ["How do I keep native creative honest?", "Make the product context, commercial relationship, creator identity, and claims clear while using a useful feed-native structure."], ["Can native ads use creator reactions?", "Yes, when the reaction is authentic, approved, and not presented as a real experience if it was generated or scripted without that basis."], ["What should the CTA do?", "It should name one relevant next action and lead to a destination that continues the same product and offer context."]]
  },
  {
    key: "carousel-storytelling",
    menuLabel: "Carousel Storytelling",
    title: "Carousel Storytelling Video Ads | Aidreamcapes",
    description: "Build sequential product storytelling ads that move from hook to product proof to CTA across swipeable frames and short-form motion concepts.",
    keywords: "carousel storytelling ads, sequential product ad, ecommerce carousel video, swipeable ad creative, AI product story",
    twitterDescription: "Build sequential product storytelling ads that move from hook to product proof to CTA across swipeable frames and short-form motion concepts.",
    heroTitle: "Make every frame earn the next swipe.",
    heroBody: "Plan a product story as a sequence: open with a clear reason to continue, reveal useful context frame by frame, and close with a CTA that makes the next action obvious.",
    outputLabel: "Carousel story",
    imageNote: "frame 01 → proof → next step",
    focus: "sequential carousel storytelling",
    outputCopy: ["The first frame establishes the story promise.", "Each frame adds new product context.", "The final frame gives the sequence a useful next step."],
    workflowCards: [["Map the sequence", "Decide what the viewer should understand after each frame before adding decoration or motion."], ["Assign frame jobs", "Give each frame one job: hook, problem, detail, demo, proof, comparison, or CTA."], ["Create visual continuity", "Use a consistent product, creator, crop, and message hierarchy across the sequence."], ["Review the swipe path", "Check whether a viewer can follow the story quickly and whether every frame earns its place."]],
    directionCards: [["Question to answer", "Open with a buyer question and use later frames to answer it with product context."], ["Feature sequence", "Reveal one feature at a time and show how each relates to the decision."], ["Use-case progression", "Move from the situation to the product action to the observable result."], ["Proof to CTA", "Place the strongest evidence before the final action instead of adding a new promise at the end."]],
    exampleTitle: "A carousel is a story with multiple first impressions.",
    exampleIntro: "Give each frame a reason to exist. The sequence should reward the swipe with new information, not repeat the same headline in different crops.",
    examples: [["FRAME 01", "Set the question or promise."], ["FRAME 02", "Introduce the product context."], ["FRAME 03", "Show the feature in use."], ["FRAME 04", "Close with proof and action."]],
    adTitle: "Turn product education into a swipeable test.",
    adIntro: "Compare sequence order, opening frames, proof moments, and CTA placement while keeping the product story coherent from first view to final swipe.",
    requirementsIntro: "Carousel storytelling works best when the team defines the sequence, frame hierarchy, and destination before producing variations.",
    requirementCards: [["Frame objective", "Give every card or scene one clear communication job."], ["Consistent product", "Keep the product, offer, and visual identity stable across the sequence."], ["Readable copy", "Write for fast scanning and preserve space for platform UI and accessibility."], ["Destination match", "Make sure the final CTA and landing page continue the same story."]],
    finalTitle: "Have a story that deserves more than one frame?",
    finalBody: "Build a swipeable product narrative with a clear opening, useful proof, and a final CTA that makes the next step feel earned.",
    faq: [["What is carousel storytelling?", "It is a sequential ad structure where each frame adds information to move the viewer from a hook through product context and proof to a CTA."], ["How many frames should a carousel use?", "Use the shortest sequence that explains the decision. A frame should add a distinct piece of information rather than repeat the previous one."], ["Can carousel storytelling include video?", "Yes. Still frames, motion, and short video can be combined when the sequence remains understandable and the destination supports the same story."], ["Should the CTA appear on every frame?", "A consistent action cue can help, but the sequence should not crowd every frame with the same CTA. Prioritize clarity at the decision point."], ["How do I test a carousel?", "Compare opening frame, sequence order, proof placement, and CTA treatment while holding the product promise and audience constant."]]
  },
  {
    key: "retargeting-urgency",
    menuLabel: "Retargeting / Urgency",
    title: "Retargeting & Urgency Ad Video Generator | Aidreamcapes",
    description: "Create retargeting product ad concepts with timely reminders, honest urgency, visible proof, and a focused CTA for shoppers who need a reason to return.",
    keywords: "retargeting video ads, urgency product ads, ecommerce reminder ad, abandoned browse ad, UGC retargeting creative",
    twitterDescription: "Create retargeting product ad concepts with timely reminders, honest urgency, visible proof, and a focused CTA for shoppers who need a reason to return.",
    heroTitle: "Give a returning shopper a useful reason to act.",
    heroBody: "Build a retargeting or urgency concept around the context a returning viewer already has. Remind them what matters, resolve the remaining hesitation, and use only offers or deadlines you can verify.",
    outputLabel: "Retargeting cut",
    imageNote: "reminder → proof → action",
    focus: "retargeting and verified urgency",
    outputCopy: ["The reminder respects the viewer’s existing context.", "The proof answers a likely hesitation.", "The urgency is tied to a real condition."],
    workflowCards: [["Name the return context", "Decide whether the viewer saw the product, started a decision, or needs a reminder about a use case."], ["Resolve one hesitation", "Use product proof, comparison, delivery information, or a clear answer to reduce uncertainty."], ["Verify the urgency", "Only use inventory, price, deadline, or offer language that is current and approved."], ["Give one action", "Send the viewer to the relevant product, offer, or checkout destination without adding friction."]],
    directionCards: [["Reminder with proof", "Bring back the product detail the viewer may have noticed and show it in a useful context."], ["Objection answer", "Address one real question such as fit, setup, delivery, or value with specific information."], ["Offer window", "Use a verified promotion or deadline and make its conditions visible."], ["Last-step clarity", "End with the exact next action the returning viewer can take now."]],
    exampleTitle: "Urgency should clarify timing, not manufacture pressure.",
    exampleIntro: "Retargeting works when it remembers the decision context and makes the next step easier. Every deadline, offer, and scarcity cue needs a source.",
    examples: [["REMIND", "Reconnect to the product or use case."], ["ANSWER", "Resolve one likely purchase hesitation."], ["VERIFY", "Show the real offer or timing condition."], ["RETURN", "Make the next action direct and relevant."]],
    adTitle: "Build retargeting variations around real decision states.",
    adIntro: "Compare reminder, objection-answer, offer, and deadline directions without treating every returning viewer as the same audience.",
    requirementsIntro: "Retargeting and urgency creative needs current product, offer, audience, and frequency information before the message is approved.",
    requirementCards: [["Audience context", "Know what the viewer has seen or done so the reminder is relevant rather than repetitive."], ["Current offer", "Verify prices, inventory, shipping, deadlines, and conditions at the time of publishing."], ["Frequency plan", "Avoid showing the same urgency message so often that it becomes misleading or fatiguing."], ["Destination match", "Send the viewer to the exact product or offer promised by the creative."]],
    finalTitle: "Have a real reason for the shopper to return?",
    finalBody: "Create a retargeting cut that respects the decision context, proves what matters, and uses urgency only when the condition is real.",
    faq: [["What is a retargeting product ad?", "It is an ad shown to an audience with an earlier interaction or decision context. The creative should use that context to provide a relevant reminder or answer."], ["Can I use countdowns or scarcity language?", "Only when the deadline, inventory, or offer condition is real, current, and clearly communicated. Do not use false countdowns or invented scarcity."], ["What should a retargeting ad address?", "A relevant product reminder, unresolved question, proof detail, delivery concern, comparison, or verified offer can help the viewer continue the decision."], ["How often should people see urgency creative?", "Set frequency and audience rules based on the campaign and platform. Review performance and user experience so urgency does not become repetitive pressure."], ["Where should the CTA send people?", "Send returning viewers to the matching product, offer, or checkout destination and keep the promised context consistent."]]
  }
];

const topicNarratives = {
  "url-to-ad": {
    outputTitle: "A product page translated into a testable ad brief.",
    outputIntro: "The output keeps source-page context visible: the buyer situation, the product detail that supports it, and the destination the viewer should reach.",
    workflowTitle: "From page evidence to a publishable ad hypothesis.",
    workflowIntro: "Each step turns product-page information into a creative decision that a marketer can review before production.",
    directionsTitle: "Creative directions that start from page evidence.",
    directionsIntro: "Change the buyer angle and the proof moment—not the facts—so every concept can be traced back to the product source.",
    requirementsTitle: "Provide the source material the ad can trust.",
    relatedTitle: "Connect product context to the next test.",
    relatedIntro: "Once the page context is clear, move into hook testing or presenter-led variations without losing the original product evidence."
  },
  "hook-lab": {
    outputTitle: "A ranked set of first-three-second openings.",
    outputIntro: "Each output isolates an opening job—question, pattern interrupt, promise, or payoff—so the team can learn which first frame earns attention.",
    workflowTitle: "From audience tension to a first-frame test.",
    workflowIntro: "Keep the product and audience stable while the opening changes, then carry the strongest promise into the rest of the cut.",
    directionsTitle: "Opening jobs worth testing.",
    directionsIntro: "A hook is useful when it creates a precise expectation that the product scene can answer within the next beat.",
    requirementsTitle: "Define the tension before the hook.",
    relatedTitle: "Carry the winning hook into production.",
    relatedIntro: "Use the selected opening as the starting point for a URL-led brief or a controlled presenter variation."
  },
  "pas-formula-ads": {
    outputTitle: "A three-beat problem-to-solution ad.",
    outputIntro: "The concept makes the audience recognize a problem, feel why it matters, and see the product solve one part of it without overstating the result.",
    workflowTitle: "From friction to a credible solution sequence.",
    workflowIntro: "Build the ad in order: establish the situation, make the consequence concrete, then demonstrate the product action that changes it.",
    directionsTitle: "PAS angles that keep the story honest.",
    directionsIntro: "The problem should be recognizable, the agitation should add meaning, and the solution should be visible—not just announced.",
    requirementsTitle: "Bring a real problem and a provable mechanism.",
    relatedTitle: "Turn the PAS structure into more tests.",
    relatedIntro: "After the problem and solution are clear, compare a stronger opening hook or a testimonial-style version of the same evidence."
  },
  "testimonial-ads": {
    outputTitle: "A review-shaped ad with evidence gates.",
    outputIntro: "The concept separates what a customer experienced from what the product can objectively show, so the recommendation stays specific and reviewable.",
    workflowTitle: "From customer experience to supportable social proof.",
    workflowIntro: "Define the speaker, the use moment, the observed benefit, and the evidence before turning a perspective into a public-facing ad.",
    directionsTitle: "Testimonial angles with a standard of proof.",
    directionsIntro: "Compare needs, experiences, and recommendations while keeping consent, identity, product use, and claim review visible.",
    requirementsTitle: "Protect the customer story before production.",
    relatedTitle: "Extend social proof without inventing it.",
    relatedIntro: "Use a product-page brief for factual context or an AI actor when the campaign needs a controlled presenter rather than a fabricated customer."
  },
  "before-after-showcases": {
    outputTitle: "A matched-frame transformation story.",
    outputIntro: "The output makes the starting state, the product mechanism, and the changed state easy to compare from the same useful perspective.",
    workflowTitle: "From baseline to observable change.",
    workflowIntro: "Capture the before state, show the action that creates the change, and reveal the after state with enough context to judge it fairly.",
    directionsTitle: "Transformation directions that viewers can evaluate.",
    directionsIntro: "Hold framing and conditions steady so the comparison teaches the viewer what changed instead of relying on a dramatic reveal.",
    requirementsTitle: "Document the baseline before showing the result.",
    relatedTitle: "Make the transformation useful across formats.",
    relatedIntro: "Turn the same evidence into a short vertical cut, a testimonial explanation, or a product-page-led variation."
  },
  "talking-photo-recs": {
    outputTitle: "A point-of-view recommendation from one product photo.",
    outputIntro: "The output gives a still image a speaking perspective: who the product suits, which detail matters, and what the viewer should consider next.",
    workflowTitle: "From still product image to useful spoken POV.",
    workflowIntro: "Choose the recommender’s point of view, anchor it in a visible detail, and keep the spoken delivery connected to a real use moment.",
    directionsTitle: "Recommendation angles that sound like a person.",
    directionsIntro: "A talking photo works when the speaker has a specific reason to recommend—not when a generic voice is placed over a packshot.",
    requirementsTitle: "Give the recommendation a real point of view.",
    relatedTitle: "Move from recommendation to demonstration.",
    relatedIntro: "If the still-image POV needs more control, continue with an AI actor or build a hook-led UGC cut around the same product detail."
  },
  "ai-actor-product-ads": {
    outputTitle: "A presenter-led concept with a defined role.",
    outputIntro: "The output assigns the presenter a clear job—explain, recommend, demonstrate, or localize—so the human delivery supports the product instead of becoming the subject.",
    workflowTitle: "From presenter role to controlled product demonstration.",
    workflowIntro: "Choose the role, write one focused promise, stage one observable product action, and review disclosure before the concept is distributed.",
    directionsTitle: "Presenter roles with different campaign jobs.",
    directionsIntro: "Compare expert explanation, creator recommendation, hands-on demonstration, and localized delivery while holding the product facts steady.",
    requirementsTitle: "Define the presenter and the product action.",
    relatedTitle: "Connect presenter delivery to ad testing.",
    relatedIntro: "Use Hook Lab to test the opening or URL to Ad to ground the presenter’s script in verified product-page context."
  },
  "tiktok-reels-shorts": {
    outputTitle: "Vertical cuts that survive the scroll.",
    outputIntro: "The concept is built for a mobile frame: the product enters early, the message survives sound-off viewing, and the final action stays clear around platform UI.",
    workflowTitle: "From placement rules to a mobile-first cut.",
    workflowIntro: "Set the vertical crop, protect the safe areas, sequence the quick beats, and review the export as it will actually appear in the feed.",
    directionsTitle: "Short-form variations with a clear mobile job.",
    directionsIntro: "Test rhythm, framing, captions, and opening action without letting speed hide the product or make the message impossible to follow.",
    requirementsTitle: "Prepare the creative for the vertical frame.",
    relatedTitle: "Reuse the vertical idea across placements.",
    relatedIntro: "Once the mobile cut is clear, compare a native-feed version or a carousel sequence that expands the same product story."
  },
  "native-spark-ads": {
    outputTitle: "A useful feed moment with transparent commercial context.",
    outputIntro: "The output begins with a believable creator situation, introduces the product as part of the solution, and keeps the paid message understandable.",
    workflowTitle: "From everyday context to native-feeling clarity.",
    workflowIntro: "Start with a useful moment, reveal the product naturally, show the detail that matters, and make the commercial next step explicit.",
    directionsTitle: "Native openings that still communicate the ad.",
    directionsIntro: "Native style is about relevance and rhythm—not hiding the relationship between the creator, the product, and the destination.",
    requirementsTitle: "Find the useful moment before the product.",
    relatedTitle: "Turn native attention into a structured test.",
    relatedIntro: "Use the same useful moment for a vertical platform cut or a direct testimonial when the campaign needs more explicit proof."
  },
  "carousel-storytelling": {
    outputTitle: "A sequence that makes the next swipe worthwhile.",
    outputIntro: "Each frame advances the viewer from a question to product context, useful proof, and an action instead of repeating one product introduction nine times.",
    workflowTitle: "From opening frame to a complete swipe path.",
    workflowIntro: "Plan the frame jobs, keep the product story continuous, and place the strongest proof before the final destination cue.",
    directionsTitle: "Story sequences with a reason to continue.",
    directionsIntro: "Test frame order and proof placement while keeping every swipe legible, useful, and connected to the same buyer decision.",
    requirementsTitle: "Plan the story before you design the frames.",
    relatedTitle: "Expand the story without losing the thread.",
    relatedIntro: "Convert the strongest frame into a Hook Lab opening or use a URL-led brief to keep every product detail anchored to its source."
  },
  "retargeting-urgency": {
    outputTitle: "A return-path reminder with verified timing.",
    outputIntro: "The output respects what a returning shopper already knows, answers one remaining hesitation, and uses timing only when the condition is current and supportable.",
    workflowTitle: "From decision state to a relevant return message.",
    workflowIntro: "Identify the earlier interaction, resolve one friction point, verify the offer or deadline, and send the viewer to the matching destination.",
    directionsTitle: "Retargeting angles for different decision states.",
    directionsIntro: "A reminder, objection answer, verified offer, and final-step cue each serve a different audience context; do not collapse them into generic urgency.",
    requirementsTitle: "Verify the context before adding urgency.",
    relatedTitle: "Continue the decision without manufacturing pressure.",
    relatedIntro: "Use a product-page brief to answer factual questions or a testimonial direction to add experience-based reassurance."
  }
};

const additionalExamples = {
  "url-to-ad": [
    ["CONTEXT", "Put the product into the buyer’s everyday setting.", "Show where the product earns attention beyond the product page."],
    ["DETAIL", "Use one feature close-up as proof.", "Let one useful product detail carry the explanation."],
    ["REVIEW", "Let the creator summarize the decision in one grounded line.", "Close the story with a specific observation rather than a generic superlative."]
  ],
  "hook-lab": [
    ["PRODUCT", "Bring the product into the frame before the hook gets vague.", "Keep the subject recognizable while the opening earns attention."],
    ["RHYTHM", "Change the visual rhythm with a reason.", "Use a purposeful movement or cut that strengthens the opening idea."],
    ["RETAIN", "Carry the winning opening into the product payoff.", "Make the second beat answer the promise made in the first three seconds."]
  ],
  "pas-formula-ads": [
    ["CONTEXT", "Show the buyer situation before the product enters.", "Make the starting problem concrete enough to recognize immediately."],
    ["PROOF", "Connect the solution to one visible product action.", "Show what the product changes instead of relying on a claim alone."],
    ["TRANSITION", "Move from tension to solution without a new promise.", "Keep the narrative handoff clear so the final beat feels earned."]
  ],
  "testimonial-ads": [
    ["CONSENT", "Make the speaker and use context reviewable.", "Keep identity, likeness, permissions, and the described experience aligned."],
    ["DETAIL", "Show the product detail behind the recommendation.", "Give the viewer something concrete to evaluate alongside the story."],
    ["CTA", "Continue to a destination that supports the experience.", "Match the recommendation to a product page or offer with the same context."]
  ],
  "before-after-showcases": [
    ["PRODUCT", "Show the product that makes the change possible.", "Keep the transformation tied to a visible feature or use action."],
    ["PROOF", "Repeat the comparison from the same useful angle.", "Make the changed state easy to evaluate without exaggeration."],
    ["CTA", "Invite the viewer to explore the transformation.", "Use a next step that matches the product and the evidence shown."]
  ],
  "talking-photo-recs": [
    ["POINT OF VIEW", "Give the creator a specific reason to recommend.", "Anchor the delivery in an audience, setting, or decision moment."],
    ["DETAIL", "Let the creator point out one visible product detail.", "Use a close-up or action that makes the recommendation concrete."],
    ["CTA", "Finish with a clear next step for the viewer.", "Keep the invitation relevant to the product information provided."]
  ],
  "ai-actor-product-ads": [
    ["SCENE", "Put the actor in a setting that explains the use case.", "The environment should help the viewer understand why the product is present."],
    ["PROOF", "Give the presenter one feature to demonstrate.", "Use an observable action instead of stacking several abstract benefits."],
    ["DISCLOSURE", "Keep synthetic identity and commercial context reviewable.", "Check the required disclosure and approval steps before distribution."]
  ],
  "tiktok-reels-shorts": [
    ["FORMAT", "Compose the product for a clean vertical crop.", "Keep faces, product proof, and important action inside the safe frame."],
    ["RHYTHM", "Use a fast cut that still preserves product context.", "Speed should improve comprehension rather than hide the subject."],
    ["EXPORT", "Leave the final frame ready for the placement.", "Review safe areas, captions, sound-off clarity, and the destination CTA."]
  ],
  "native-spark-ads": [
    ["CREATOR", "Let the creator context carry the opening.", "Start with a useful situation that belongs in the feed."],
    ["PRODUCT", "Reveal the product as part of the useful moment.", "Keep the commercial message clear as the product enters the story."],
    ["CTA", "Close with a direct but native-feeling next action.", "Preserve the creator tone without hiding the ad or destination."]
  ],
  "carousel-storytelling": [
    ["DETAIL", "Give the next frame one new product detail.", "A useful reveal should reward the swipe instead of repeating the opener."],
    ["PROOF", "Show the product resolving the buyer question.", "Use a feature, action, or use case that advances the story."],
    ["CTA", "Make the final frame’s action easy to follow.", "End the sequence with the destination and promise still aligned."]
  ],
  "retargeting-urgency": [
    ["CONTEXT", "Reconnect to what the returning shopper already saw.", "Use the earlier decision state to make the reminder relevant."],
    ["PROOF", "Answer the hesitation with a concrete product detail.", "Reduce uncertainty with information the viewer can evaluate."],
    ["OFFER", "Show only a current and supportable offer condition.", "Tie timing or promotion language to a verified source before publishing."]
  ]
};

function buildDetail(spec) {
  const narrative = topicNarratives[spec.key];
  assert.ok(narrative, `${spec.key}: missing topic narrative`);
  const faq = spec.faq.map(([question, answer]) => ({ question, answer }));
  const images = imageSet(spec.key);
  const exampleEntries = [
    ...spec.examples.map(([noteLabel, title]) => [noteLabel, title, `${spec.focus}: ${title.toLowerCase()}.`]),
    ...additionalExamples[spec.key]
  ];
  assert.equal(exampleEntries.length, 7, `${spec.key}: seven example entries`);
  const examples = exampleEntries.map(([noteLabel, title, body], index) => ({ title, body, noteLabel, image: images.examples[index] }));
  const cards = (entries) => entries.map(([title, body]) => card(title, body));
  const seo = {
    title: spec.title,
    description: spec.description,
    keywords: spec.keywords,
    canonicalPath: `/ai-video-generation/${spec.key}`,
    canonical: `https://www.aidreamcapes.com/ai-video-generation/${spec.key}`,
    robots: { index: true, follow: true, maxImagePreview: "large" },
    twitterDescription: spec.twitterDescription,
    ogImage: images.output.src,
    ogImageAlt: images.output.alt
  };
  return {
    layoutVariant: "ads-testing-detail",
    seo,
    hero: {
      eyebrow: `AI UGC Ads · ${spec.menuLabel}`,
      title: spec.heroTitle,
      body: spec.heroBody,
      primaryCta: "Create UGC ad",
      primaryCtaHref: "/app/create?videoMode=ugc-ad#step-video",
      secondaryCta: "See UGC examples",
      secondaryCtaHref: "#ugc-examples",
      availabilityNote: "Review the concept, credit cost, and output requirements before generation.",
      rightsCopy: "Use only product assets, claims, creator identities, and offers you can verify and publish.",
      imageNote: spec.imageNote,
      productLabel: "01 · Product image",
      outputLabel: `02 · ${spec.outputLabel}`,
      productImage: images.product,
      outputImage: images.output
    },
    workflowOutput: guidance("WHAT THIS CREATES", narrative.outputTitle, narrative.outputIntro, cards(spec.outputCopy.map((item, index) => [`0${index + 1}`, item]))),
    workflow: guidance("THE WORKFLOW", narrative.workflowTitle, narrative.workflowIntro, cards(spec.workflowCards)),
    creativeDirections: guidance("CREATIVE DIRECTIONS", narrative.directionsTitle, narrative.directionsIntro, cards(spec.directionCards)),
    examples: {
      eyebrow: "UGC EXAMPLES",
      title: spec.exampleTitle,
      intro: spec.exampleIntro,
      items: examples
    },
    adTesting: {
      eyebrow: "BUILT FOR AD TESTING",
      title: spec.adTitle,
      intro: spec.adIntro,
      platforms: ["TikTok · 9:16", "Instagram Reels · 9:16", "YouTube Shorts · 9:16"],
      checklist: ["Hook is legible before the scroll", "Product proof is visible in the cut", "Creator context supports the message", "CTA matches the landing destination", "Credits and output settings are reviewed"]
    },
    requirements: guidance("BEFORE YOU CREATE", narrative.requirementsTitle, spec.requirementsIntro, cards(spec.requirementCards)),
    relatedWorkflows: {
      eyebrow: "CONTINUE THE WORKFLOW",
      title: narrative.relatedTitle,
      intro: narrative.relatedIntro,
      items: commonRelated.map((item) => ({ ...item }))
    },
    faq: { eyebrow: "FAQ", title: `Questions about ${spec.menuLabel.toLowerCase()}.`, items: faq },
    finalCta: {
      eyebrow: "READY TO TEST THE IDEA?",
      title: spec.finalTitle,
      body: spec.finalBody,
      cta: "Create UGC ad",
      ctaHref: "/app/create?videoMode=ugc-ad#step-video",
      microcopy: "Start with your product image or URL. Review the brief before you generate."
    }
  };
}

export const aidreamcapesAdsTestingPageSpecs = pages.map((spec) => ({
  ...spec,
  detail: buildDetail(spec)
}));

export const aidreamcapesAdsTestingPaths = aidreamcapesAdsTestingPageSpecs.map((spec) => spec.detail.seo.canonicalPath);

export function aidreamcapesAdsTestingPagesForMigration() {
  return aidreamcapesAdsTestingPageSpecs.map((spec) => ({
    key: spec.key,
    menuLabel: spec.menuLabel,
    slug: spec.detail.seo.canonicalPath,
    title: spec.detail.seo.title,
    content: spec.detail
  }));
}

export function validateAidreamcapesAdsTestingContent({ log = console.log } = {}) {
  assert.equal(aidreamcapesAdsTestingPageSpecs.length, 11);
  const seenPaths = new Set();
  const seenMedia = new Set();
  for (const spec of aidreamcapesAdsTestingPageSpecs) {
    const seo = spec.detail.seo;
    assert.ok(seo.title.length >= 45 && seo.title.length <= 70, `${spec.key}: title length ${seo.title.length}`);
    assert.ok(seo.description.length >= 140 && seo.description.length <= 170, `${spec.key}: description length ${seo.description.length}`);
    assert.ok(!seenPaths.has(seo.canonicalPath), `duplicate path: ${seo.canonicalPath}`);
    seenPaths.add(seo.canonicalPath);
    assert.match(seo.canonical, /^https:\/\/www\.aidreamcapes\.com\/ai-video-generation\//);
    assert.ok(seo.ogImage.startsWith(`${siteBase}/`), `${spec.key}: storefront image isolation`);
    const contentImages = [spec.detail.hero.productImage, spec.detail.hero.outputImage, ...spec.detail.examples.items.map((item) => item.image)];
    assert.equal(contentImages.length, 9, `${spec.key}: content image count`);
    assert.equal(new Set(contentImages.map((image) => image.src)).size, 9, `${spec.key}: duplicate content images`);
    assert.equal(spec.detail.examples.items.length, 7, `${spec.key}: example image count`);
    for (const [index, image] of contentImages.entries()) {
      assert.ok(image.src.startsWith(`${generatedBase}/${spec.key}/`), `${spec.key}: image set isolation ${image.src}`);
      assert.match(image.src, /\.webp$/);
      assert.equal(image.width, imageSize.width, `${spec.key}: image ${index} width`);
      assert.equal(image.height, imageSize.height, `${spec.key}: image ${index} height`);
      assert.ok(image.alt.length >= 30, `${spec.key}: image ${index} alt quality`);
      assert.equal(image.loading, index < 2 ? "eager" : "lazy", `${spec.key}: image ${index} loading`);
      assert.equal(image.fetchPriority, index === 0 ? "high" : "auto", `${spec.key}: image ${index} priority`);
      assert.ok(existsSync(new URL(`../../public${image.src}`, import.meta.url)), `${spec.key}: missing image file ${image.src}`);
      assert.ok(!seenMedia.has(image.src), `${spec.key}: image reused by another Ads Testing page ${image.src}`);
      seenMedia.add(image.src);
    }
    const media = [seo.ogImage, ...contentImages.map((image) => image.src)];
    for (const src of media) assert.ok(src.startsWith(`${siteBase}/`), `${spec.key}: media isolation ${src}`);
    assert.equal(spec.detail.faq.items.length, 5, `${spec.key}: FAQ count`);
    log(`${spec.key}: title=${seo.title.length} description=${seo.description.length} media=${contentImages.length}`);
  }
  return true;
}
