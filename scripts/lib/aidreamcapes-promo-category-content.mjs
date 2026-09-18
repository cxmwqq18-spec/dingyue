import assert from "node:assert/strict";
import { existsSync } from "node:fs";

const siteBase = "/assets/sites/site_aidreamcapes";
const generatedBase = `${siteBase}/promo-category-v1`;
const imageSize = { width: 400, height: 400 };
const productSizes = "(max-width: 1024px) 100vw, 560px";
const cardSizes = "(max-width: 1024px) 100vw, 760px";

const topicNarratives = {
  "promo-video": ["WHAT THIS CAMPAIGN CLARIFIES", "Make a launch or offer easy to understand.", "A promotional video should connect the release, the reason to care, the verified terms, and the next action in one readable sequence."],
  "black-friday-countdown": ["WHAT THIS CAMPAIGN CLARIFIES", "Make the sale window impossible to misread.", "A countdown works when the real date, offer conditions, product focus, and final action remain visible as urgency builds."],
  "limited-drop-alert": ["WHAT THIS CAMPAIGN CLARIFIES", "Turn a product drop into a precise moment.", "A limited release needs a clear item, opening time, availability boundary, and action that does not exaggerate inventory."],
  "discount-free-shipping": ["WHAT THIS CAMPAIGN CLARIFIES", "Put the offer terms next to the product decision.", "A discount or shipping incentive is useful only when the conditions, deadline, product context, and next step are easy to verify."],
  "beauty-routine": ["WHAT THIS ROUTINE CLARIFIES", "Show the order and feel of a routine.", "A beauty routine video can make sequence, application, texture, and context visible while keeping results grounded in approved product information."],
  "supplement-highlight": ["WHAT THIS HIGHLIGHT CLARIFIES", "Explain the product without turning it into a medical promise.", "A supplement highlight should make format, ingredients, usage context, and label-approved information clear to the viewer."],
  "fashion-try-on-reel": ["WHAT THIS REEL CLARIFIES", "Let fit and movement do the explaining.", "A try-on reel should show silhouette, styling, fabric behavior, and useful garment details from angles that support product discovery."],
  "food-video": ["WHAT THIS VIDEO CLARIFIES", "Make taste and use context visible.", "A food or beverage video should move from preparation to serving and consumption cues without inventing ingredients, nutrition, or reactions."],
  "home-organization": ["WHAT THIS SYSTEM CLARIFIES", "Show the change from clutter to a usable space.", "An organization video needs a clear starting problem, the sorting or storage action, and a finished state that proves what became easier."],
  "app-saas-demo": ["WHAT THIS DEMO CLARIFIES", "Show the task, not just a polished screen.", "A SaaS demo should guide the viewer through a real interface flow, the action that matters, the output, and the boundary of any product claim."],
  "local-service-ad": ["WHAT THIS SERVICE CLARIFIES", "Make the service visit feel specific and trustworthy.", "A local service video should establish the area, appointment path, arrival, work performed, and next step without implying coverage that is not verified."]
};

const pages = [
  {
    key: "promo-video", path: "promo-video", menuLabel: "Promo / Launch / Sale",
    title: "AI Promo & Launch Video Generator | Aidreamcapes",
    description: "Create an AI promo or launch video that introduces an offer, product release, or seasonal sale with clear proof, useful context, and a next step.",
    keywords: "AI promo video, product launch video generator, sale video maker, promotional video AI, product release video",
    twitterDescription: "Create an AI promo or launch video that introduces an offer, product release, or seasonal sale with clear proof and a next step.",
    heroTitle: "Make the launch moment clear before the offer expires.",
    heroBody: "Turn a release, promotion, or seasonal sale into a readable campaign sequence. Lead with what is new, show the product in context, state the verified terms, and finish with an action the viewer can take.",
    outputLabel: "Promo launch output", imageNote: "release → reason → terms → action", focus: "launch communication",
    product: "unbranded portable desk lamp",
    outputCopy: ["The release or offer is visible in the opening.", "Product context gives the announcement a reason to matter.", "Verified terms stay readable instead of hiding behind urgency.", "The final frame gives the viewer one sensible next step."],
    workflowCards: [["Name the moment", "Choose whether the video is introducing a product, opening a launch, or communicating a sale."], ["Set the product context", "Show the product where its use, change, or occasion makes the campaign relevant."], ["State the terms", "Add only the date, price, stock, shipping, or offer conditions that have been verified."], ["Close with action", "Send the viewer to the approved product, signup, or campaign destination." ]],
    directionCards: [["Launch reveal", "Build from a clean product reveal into the first reason the release matters."], ["Offer-led cut", "Put the customer-facing offer beside the product without burying its conditions."], ["Seasonal context", "Use a timely setting while keeping the product and campaign terms in focus."], ["Founder or creator handoff", "Let a presenter introduce the moment, then return to product proof and action."]],
    examples: [["RELEASE", "Open on what is new and why it is being announced."], ["CONTEXT", "Put the product into the situation the launch is meant to serve."], ["TERMS", "Give the verified offer or timing a readable place in the sequence."], ["ACTION", "End on the destination that matches the campaign promise."]],
    exampleTitle: "Give every promotion a clear beginning, middle, and next step.", exampleIntro: "Launch content earns attention when the viewer can answer three questions quickly: what changed, why it matters, and what to do now.",
    adTitle: "Fit the launch story to the placement.", adIntro: "Use vertical cuts for short-form discovery, a wider version for a landing page, or a concise offer loop when the terms are the main message.",
    requirementsIntro: "Promotional accuracy starts with a real release or offer, a product asset that matches it, and terms that can be reviewed before publishing.",
    requirementCards: [["Campaign moment", "Define the launch, sale, or announcement the video is actually supporting."], ["Product source", "Use a clear product image or URL that represents the item being promoted."], ["Verified terms", "Confirm dates, price, stock, shipping, and eligibility before they appear on screen."], ["Approved destination", "Link the call to action to the current campaign or product destination."]],
    finalTitle: "Ready to make the launch understandable?", finalBody: "Build a promotion around one message, verified terms, useful product context, and a next action your audience can trust.",
    faq: [["What is an AI promo video generator?", "It helps turn a launch, sale, or product announcement into a structured video direction with product context, offer details, and a clear call to action."], ["Can I use the same video for a launch and a sale?", "You can reuse the production direction, but review the message and terms for each campaign. A launch announcement and a discount offer usually answer different buyer questions."], ["What information belongs in a sale video?", "Include only the verified product, price or discount, dates, shipping or eligibility conditions, and destination needed for the viewer to act."], ["Can I create a promo video from a product URL?", "Yes, when the URL is current and the product details are accurate. Review every generated claim and offer condition before publishing."], ["Which placements work for promo videos?", "Short-form feeds, product pages, launch pages, email, and campaign landing pages can work when the cut length and call to action match the placement."]]
  },
  {
    key: "black-friday-countdown", path: "black-friday-countdown", menuLabel: "Black Friday Countdown",
    title: "AI Black Friday Countdown Video Generator | Aidreamcapes",
    description: "Build an AI Black Friday countdown video with a verified date, offer terms, product focus, and a clear reason to act before the sale window closes.",
    keywords: "Black Friday countdown video, AI Black Friday video, sale countdown generator, Black Friday ad video, holiday sale video",
    twitterDescription: "Build a Black Friday countdown video with a verified date, offer terms, product focus, and a clear reason to act before the sale window closes.",
    heroTitle: "Create urgency without making the sale date hard to read.",
    heroBody: "Build a Black Friday countdown around the facts shoppers need. Show the product, make the opening or closing time legible, explain the real offer, and keep urgency tied to the actual sale window.",
    outputLabel: "Black Friday countdown output", imageNote: "date → offer → product → act", focus: "sale-window urgency",
    product: "unbranded folding electric bicycle",
    outputCopy: ["The sale window is established before the countdown takes over.", "The product remains recognizable through the urgency beats.", "Offer conditions are visible and tied to the correct item.", "The close gives shoppers a clear, time-aware action."],
    workflowCards: [["Verify the window", "Set the actual start, end, timezone, and any early-access boundary before writing urgency."], ["Choose the hero item", "Keep one product or product group central so the countdown does not become a generic sale graphic."], ["Sequence the urgency", "Move from date to offer to product proof, then give the viewer a reason to act."], ["Check the close", "Make the final frame accurate after the sale window changes or ends."]],
    directionCards: [["Calendar-led opening", "Start with the sale date and move immediately into the product shoppers came to see."], ["Offer unlock", "Reveal the discount or bundle after the viewer understands what is included."], ["Last-hours reminder", "Use a restrained final-window treatment without implying inventory or timing you cannot verify."], ["Gift-ready frame", "Show the product in a seasonal buying context while keeping terms legible."]],
    examples: [["DATE", "Establish the real Black Friday sale window."], ["OFFER", "Connect the discount or bundle to its verified condition."], ["FOCUS", "Keep the featured product visible during the countdown."], ["CLOSE", "End with a destination and action that remain valid."]],
    exampleTitle: "Make every countdown beat useful to the buyer.", exampleIntro: "Countdown creative works when urgency improves clarity. The viewer should know when the window is open, what is included, and where the action leads.",
    adTitle: "Build a countdown that survives every placement.", adIntro: "Use a vertical reminder for feeds, a high-contrast campaign cut for landing pages, or a short final-window version after the offer has been rechecked.",
    requirementsIntro: "A credible Black Friday video needs an approved date, accurate offer terms, a product source, and a process for updating time-sensitive frames.",
    requirementCards: [["Verified sale window", "Confirm date, timezone, launch time, end time, and early access rules."], ["Offer conditions", "Check discount, bundle, shipping, exclusions, and redemption requirements."], ["Featured product", "Choose a product that is truly included in the campaign."], ["Update owner", "Know who will review the creative when the countdown or terms change."]],
    finalTitle: "Ready to make the sale window count?", finalBody: "Turn a verified Black Friday date and offer into a product-led countdown shoppers can understand at a glance.",
    faq: [["What should a Black Friday countdown video include?", "It should include the verified sale window, the featured product or products, the real offer conditions, and a clear destination for the next action."], ["Can the countdown automatically update the date?", "The creative direction can be revised for a new window, but the published date and terms should be checked against the current campaign before release."], ["Should I show a large discount number?", "Only when the number is accurate for the featured product and its conditions are easy to find. A smaller but clear offer is better than an unsupported headline."], ["Can I use countdown creative before the sale starts?", "Yes, as a teaser or reminder, provided the start time, eligibility, and destination are accurate and remain current."], ["Where can I use the countdown video?", "It can support social feeds, campaign landing pages, email, product pages, and retargeting when each placement uses the correct sale state."]]
  },
  {
    key: "limited-drop-alert", path: "limited-drop-alert", menuLabel: "Limited Drop Alert",
    title: "AI Limited Drop Alert Video Generator | Aidreamcapes",
    description: "Create a limited drop alert video that makes the release time, available product, real urgency, and next action easy for shoppers to understand.",
    keywords: "limited drop video, product drop announcement, AI release alert video, limited edition product video, drop campaign generator",
    twitterDescription: "Create a limited drop alert video that makes the release time, product, real urgency, and next action easy to understand.",
    heroTitle: "Make a limited release feel precise, not noisy.",
    heroBody: "Turn a product drop into a focused alert. Establish what is releasing, when it opens, what availability actually means, and which action belongs at the end of the message.",
    outputLabel: "Limited drop alert output", imageNote: "item → release → availability → action", focus: "release precision",
    product: "unbranded coral trail running shoes",
    outputCopy: ["The item is identified before the alert creates urgency.", "The release time has a clear place in the story.", "Availability language stays grounded in known inventory facts.", "The final action points to the approved drop destination."],
    workflowCards: [["Define the drop", "Name the item, collection, or colorway that is genuinely part of the release."], ["Set the release moment", "Confirm the opening time, time zone, access rules, and destination before building the alert."], ["Show the scarce detail", "Use color, quantity, packaging, or access context only when it is true for this drop."], ["Close on access", "Send viewers to the correct waitlist, reminder, or purchase path without a fake stock promise."]],
    directionCards: [["Single-item reveal", "Keep the drop centered on one product so the alert is immediately recognizable."], ["Colorway focus", "Use close framing to make a new shade or variation feel specific without inventing scarcity."], ["Access reminder", "Explain how early access, signup, or launch timing works when those rules are real."], ["Post-drop follow-up", "Create a valid next step for viewers who arrive after the release moment."]],
    examples: [["ITEM", "Show exactly what is entering the drop."], ["TIME", "Make the release moment easy to locate and verify."], ["AVAILABILITY", "Use only supported language about quantity or access."], ["DESTINATION", "Close on the real page, reminder, or signup path."]],
    exampleTitle: "Give a product drop one unmistakable moment.", exampleIntro: "Limited releases need precision more than volume. A strong alert helps the viewer identify the item, understand the timing, and act without guessing.",
    adTitle: "Keep the drop alert sharp in every format.", adIntro: "Use a fast vertical alert for social discovery, a clean reminder for a launch page, or a follow-up cut that reflects the product’s current availability.",
    requirementsIntro: "The most important inputs are the actual item, release rules, inventory language, access path, and a review owner who can update the alert.",
    requirementCards: [["Drop identity", "Verify the exact product, colorway, collection, or package being released."], ["Release rules", "Confirm date, time zone, access, waitlist, and purchase conditions."], ["Scarcity evidence", "Use quantity or limited wording only when the business can support it."], ["Post-drop state", "Prepare a valid destination for shoppers who see the video later."]],
    finalTitle: "Ready to announce the drop clearly?", finalBody: "Build a release alert around a real item, a verified opening moment, and a next action that respects the buyer’s time.",
    faq: [["What is a limited drop alert video?", "It is a short release announcement that identifies a product, explains when access opens, and gives the viewer a valid way to join, remember, or shop the drop."], ["Can I say a product is almost sold out?", "Only when current inventory data supports that statement. Do not use urgency language as a substitute for a real availability check."], ["Should I show every product in a drop?", "Usually one hero item or a clearly defined set is easier to understand. Add more items only when the release structure requires them."], ["Can a drop video support a waitlist?", "Yes, when a real waitlist or reminder destination exists. The call to action should describe the actual access path."], ["What happens to the video after the drop?", "Review or replace it so the destination, stock language, and release timing do not remain misleading after the event."]]
  },
  {
    key: "discount-free-shipping", path: "discount-free-shipping", menuLabel: "Discount & Free Shipping",
    title: "AI Discount & Free Shipping Ad Video | Aidreamcapes",
    description: "Turn a real discount or free-shipping offer into an AI ad video with readable conditions, product context, a deadline, and a focused call to action.",
    keywords: "discount ad video, free shipping ad video, AI offer video, ecommerce promotion generator, sale terms video",
    twitterDescription: "Turn a real discount or free-shipping offer into an AI ad video with readable conditions, product context, a deadline, and a focused action.",
    heroTitle: "Put the value next to the conditions buyers need.",
    heroBody: "Create an offer-led video that shows the product before the promotion takes over. Make the discount or shipping threshold readable, give the deadline a clear role, and keep the call to action focused.",
    outputLabel: "Discount offer output", imageNote: "product → value → conditions → shop", focus: "offer clarity",
    product: "compact brushed-steel travel espresso scale",
    outputCopy: ["The product remains visible behind the offer.", "The value proposition is stated in plain language.", "Thresholds, exclusions, and deadlines are not hidden.", "The final action matches the current offer destination."],
    workflowCards: [["Select the offer", "Define the discount, shipping threshold, code, or eligibility rule the video will communicate."], ["Keep product proof", "Show the actual item and a useful context so the offer is not detached from the decision."], ["Make conditions readable", "Give deadlines, exclusions, and shipping rules enough space to be checked."], ["Match the destination", "Use a call to action that leads to the product or campaign page where the offer applies."]],
    directionCards: [["Threshold reveal", "Introduce free shipping after the product and the qualifying cart value are clear."], ["Code-led cut", "Use a real code only when its scope, expiry, and destination are verified."], ["Bundle value", "Show what is included in a bundle without implying savings that are not calculated."], ["Deadline reminder", "Use time pressure as a reminder of a real end date, not a permanent claim."]],
    examples: [["PRODUCT", "Show the item the offer is meant to move."], ["VALUE", "Make the discount or shipping benefit concrete."], ["TERMS", "Give conditions enough space to be understood."], ["SHOP", "Finish at the valid offer or product destination."]],
    exampleTitle: "Make the deal easy to evaluate, not merely loud.", exampleIntro: "Offer creative should reduce uncertainty. A buyer needs to see what they get, what qualifies, and what happens after the click.",
    adTitle: "Keep the offer legible from feed to checkout path.", adIntro: "Use vertical cuts for discovery, a product-page version for detail, or a short reminder that keeps the current threshold and deadline visible.",
    requirementsIntro: "Offer videos depend on current commercial terms. Confirm the product, qualifying rules, dates, code, shipping policy, and destination before production.",
    requirementCards: [["Current offer", "Verify the exact discount, bundle, code, or shipping benefit."], ["Qualification rules", "Confirm threshold, exclusions, geography, and product eligibility."], ["Time boundary", "Check start and end dates and who owns future updates."], ["Landing destination", "Make sure the click path applies the same offer the video describes."]],
    finalTitle: "Ready to make the offer make sense?", finalBody: "Build an offer video that earns the click by showing the product, the real value, and the conditions in the same clear story.",
    faq: [["What should a discount and free-shipping video show?", "Show the relevant product, the actual discount or shipping benefit, qualifying conditions, timing, and a destination where the viewer can use the offer."], ["Can I use a free-shipping message without a threshold?", "Only if the current shipping policy supports that wording. If a minimum order, region, or product exclusion applies, make it clear."], ["Should the promo code be on screen?", "Include it when it is required and verified. Also make the code scope and expiry understandable through the destination or supporting copy."], ["Can one video cover multiple products?", "Yes, if the offer applies consistently and the product set is easy to understand. Otherwise, a focused product cut is safer and clearer."], ["How often should offer creative be reviewed?", "Review it whenever price, inventory, shipping, code, eligibility, or deadline changes. Expired offer language should not remain live."]]
  },
  {
    key: "beauty-routine", path: "beauty-routine", menuLabel: "Beauty Routine",
    title: "AI Beauty Routine Video Generator | Aidreamcapes",
    description: "Create a beauty routine video that shows product order, application texture, usage context, and a careful result without unsupported skincare claims.",
    keywords: "AI beauty routine video, skincare video generator, makeup routine video, beauty product demo, cosmetic video AI",
    twitterDescription: "Create a beauty routine video showing product order, application texture, usage context, and a careful result without unsupported skincare claims.",
    heroTitle: "Show the routine in the order people actually use it.",
    heroBody: "Build a beauty routine around sequence and sensory detail. Show the product, the amount, the application motion, and the everyday context while keeping the result within approved cosmetic language.",
    outputLabel: "Beauty routine output", imageNote: "prepare → apply → layer → finish", focus: "routine sequence",
    product: "amber glass facial serum bottle with dropper",
    outputCopy: ["The routine order is clear before the result appears.", "Texture and application are visible at a useful scale.", "The product is shown in a believable care context.", "The final frame uses careful, supportable language."],
    workflowCards: [["Set the routine goal", "Choose the practical routine moment, such as morning layering, evening care, or pre-makeup preparation."], ["Order the products", "Show where the featured product sits in the sequence and what it is used with."], ["Show the application", "Use close framing for texture, amount, and motion without overpromising a result."], ["Review the finish", "Check claims, skin representation, rights, and any required cosmetic disclosure before publishing."]],
    directionCards: [["Dropper detail", "Use a precise close-up for amount and texture when the packaging supports it."], ["Layering sequence", "Show the product entering a routine rather than presenting it as an isolated miracle step."], ["Mirror moment", "Use a calm daily context to make the routine feel repeatable and specific."], ["Makeup prep", "Frame the product as part of preparation while keeping cosmetic claims within approved language."]],
    examples: [["PREPARE", "Start with the product and the routine context."], ["APPLY", "Show amount, texture, and movement without exaggeration."], ["LAYER", "Place the product in a realistic order with other steps."], ["FINISH", "Close on a careful, observable routine result."]],
    exampleTitle: "Make the beauty routine feel repeatable and real.", exampleIntro: "The strongest routine videos teach sequence and texture. They help viewers imagine the use moment without turning generated imagery into a clinical promise.",
    adTitle: "Choose a beauty format that leaves room for detail.", adIntro: "Use vertical close-ups for routine discovery, a slower product-page edit for application context, or a short texture cut when one sensory moment carries the story.",
    requirementsIntro: "Beauty creative needs an approved product description, accurate usage order, permitted representation, and a claims review that distinguishes cosmetic context from medical advice.",
    requirementCards: [["Approved product facts", "Verify format, ingredients, use directions, and packaging details."], ["Routine order", "Decide where the product belongs and what the viewer should do next."], ["Representation rights", "Review creator, model, skin, and likeness permissions before publication."], ["Claims review", "Remove medical, guaranteed, or before-and-after language that is not supported."]],
    finalTitle: "Ready to show the routine clearly?", finalBody: "Create a beauty video around order, texture, and everyday use—then review every claim before it reaches the audience.",
    faq: [["What is an AI beauty routine video?", "It is a structured beauty or skincare video direction that shows product order, application, texture, and context without turning generated results into unsupported claims."], ["Can the video show a before-and-after result?", "Only when the representation, timing, lighting, and claim are accurate and approved. Do not imply guaranteed or clinical results from generated imagery."], ["How many products should a routine include?", "Include the steps needed for the intended routine. A focused sequence is easier to follow than a crowded shelf of unrelated products."], ["Can I use a synthetic creator for a beauty routine?", "Yes, when the presentation is permitted and any required synthetic-content disclosure is followed. Do not present the person as a real customer without authorization."], ["What claims should I avoid?", "Avoid medical treatment, guaranteed outcomes, and unsupported transformations. Use approved cosmetic descriptions and direct viewers to the current product information."]]
  },
  {
    key: "supplement-highlight", path: "supplement-highlight", menuLabel: "Supplement Highlight",
    title: "AI Supplement Highlight Video Generator | Aidreamcapes",
    description: "Explain a supplement product with an AI highlight video focused on ingredients, format, usage context, and compliant product information—not medical promises.",
    keywords: "supplement product video, supplement ad generator, AI wellness product video, ingredient highlight video, compliant supplement marketing",
    twitterDescription: "Explain a supplement product with an AI highlight video focused on ingredients, format, usage context, and compliant product information—not medical promises.",
    heroTitle: "Explain the product facts before making a promise.",
    heroBody: "Create a supplement highlight that respects the difference between product information and medical advice. Show the format, label-approved ingredients, usage context, and a next step for further details.",
    outputLabel: "Supplement highlight output", imageNote: "format → facts → use → learn", focus: "label-led explanation",
    product: "unbranded lemon electrolyte powder pouch",
    outputCopy: ["The format and product identity are clear in the opening.", "Ingredient information is presented as approved product context.", "Usage is shown without inventing a dosage or health outcome.", "The close points viewers to current product details."],
    workflowCards: [["Define the information", "Choose the product facts the viewer needs, such as format, flavor, ingredients, or preparation context."], ["Check the label", "Use current, approved source information and do not infer health benefits from an ingredient name."], ["Show practical use", "Demonstrate preparation or placement only within the actual directions and product context."], ["Review compliance", "Check claims, disclosures, age or use restrictions, and the destination before publishing."]],
    directionCards: [["Ingredient macro", "Use a clean visual cue for an approved ingredient or format without turning it into a medical claim."], ["Preparation moment", "Show the product entering a real preparation routine when the directions support it."], ["On-the-go context", "Use a daily setting to explain when the product is used, not what it can cure."], ["Label-to-detail", "Move from package information to a destination where viewers can read the full facts."]],
    examples: [["FORMAT", "Identify the product form and what the viewer is seeing."], ["FACTS", "Show label-approved information without inflated benefits."], ["USE", "Place preparation or consumption in the correct context."], ["DETAIL", "Close on the source where the full information can be checked."]],
    exampleTitle: "Make a supplement easier to understand without overclaiming.", exampleIntro: "A responsible highlight gives the audience product facts and context. It does not convert a visual metaphor into a promise about health or treatment.",
    adTitle: "Keep product information clear across formats.", adIntro: "Use a concise vertical explanation for discovery, a product-page cut for label context, or a preparation moment that makes the format intuitive.",
    requirementsIntro: "Supplement content requires current labels, approved claims, accurate directions, and a careful distinction between general product information and medical advice.",
    requirementCards: [["Current label", "Confirm ingredients, format, flavor, package size, and other visible product facts."], ["Approved claims", "Use only claims cleared for the intended market and product."], ["Usage context", "Follow real directions and avoid invented dosage, timing, or outcomes."], ["Compliance review", "Check disclaimers, disclosures, audience restrictions, and destination details."]],
    finalTitle: "Ready to make the product facts clearer?", finalBody: "Build a supplement highlight around accurate information, practical context, and a next step that lets viewers verify more.",
    faq: [["What is a supplement highlight video?", "It is a product-information video that explains a supplement’s format, approved ingredients, usage context, and where to find more details."], ["Can the video promise a health result?", "No. Use only approved claims for the product and market. Generated imagery should never be treated as evidence of a medical outcome."], ["Can I show the supplement being prepared?", "Yes, when the preparation matches the product directions and the scene does not imply an unapproved dosage or result."], ["Should ingredients appear as floating graphics?", "Only when the information is accurate and readable. A label or product-detail destination can be safer than decorative claims that viewers may misread."], ["Who should review supplement creative?", "Use the product owner’s compliance or regulatory review process before publishing, especially when claims, markets, age groups, or usage restrictions differ."]]
  },
  {
    key: "fashion-try-on-reel", path: "fashion-try-on-reel", menuLabel: "Fashion Try-On Reel",
    title: "AI Fashion Try-On Reel Generator | Aidreamcapes",
    description: "Create an AI fashion try-on reel that shows fit, movement, styling, and garment details in a vertical format built for confident product discovery.",
    keywords: "AI fashion try-on reel, virtual try-on video, fashion product video, garment movement video, outfit styling generator",
    twitterDescription: "Create an AI fashion try-on reel showing fit, movement, styling, and garment details in a vertical format for product discovery.",
    heroTitle: "Let the garment move so shoppers can judge the fit.",
    heroBody: "Build a try-on reel around silhouette, movement, styling, and detail. Use deliberate angles and a consistent garment identity so the viewer can discover how the piece behaves beyond a static product shot.",
    outputLabel: "Fashion try-on output", imageNote: "fit → move → detail → style", focus: "garment discovery",
    product: "neutral sand overshirt jacket",
    outputCopy: ["The garment identity stays consistent from first frame to last.", "Fit and silhouette are visible from useful angles.", "Movement shows drape without inventing construction details.", "Styling context supports discovery without replacing product facts."],
    workflowCards: [["Lock the garment", "Start with a clear product source and confirm color, cut, material, and visible construction details."], ["Choose useful angles", "Plan front, side, movement, and detail moments that answer real fit questions."], ["Style the scene", "Use a setting and accessories that support the garment rather than distracting from it."], ["Review continuity", "Check body proportions, garment details, color, and fit before the reel is used for shopping."]],
    directionCards: [["Walk-through", "Use a controlled walk to show silhouette, hem, sleeve movement, and overall proportion."], ["Turn and hold", "Give the viewer front, side, and back context without rushing through the garment."], ["Material detail", "Move close to texture, seams, closures, or drape only when those details are accurate."], ["Styled look", "Show one complete outfit while keeping the featured garment easy to identify."]],
    examples: [["FIT", "Establish silhouette and proportion in a clean frame."], ["MOVE", "Show drape and garment behavior through a controlled action."], ["DETAIL", "Give fabric, seam, closure, or texture a useful close-up."], ["STYLE", "Close with a complete look that keeps the product identifiable."]],
    exampleTitle: "Make try-on content answer the questions a photo cannot.", exampleIntro: "A try-on reel is useful when movement adds information. Keep the garment consistent, the angles intentional, and the styling honest to the source product.",
    adTitle: "Design the reel for vertical discovery and deeper review.", adIntro: "Use a fast vertical cut for style discovery, a slower edit for product pages, or a detail loop when fabric and construction are the decision point.",
    requirementsIntro: "Fashion try-on quality depends on source accuracy, permitted model representation, consistent proportions, and a review of every garment detail the output suggests.",
    requirementCards: [["Garment source", "Use current images or a URL that clearly represents color, construction, and fit."], ["Model permission", "Confirm rights for the real or synthetic person and any required disclosure."], ["Fit intent", "Define the angles and movement that help the intended shopper evaluate the piece."], ["Continuity review", "Check color, length, sleeves, seams, closures, and body-garment proportion."]],
    finalTitle: "Ready to put the fit in motion?", finalBody: "Create a try-on reel that makes silhouette, movement, and garment detail easier to evaluate before the click.",
    faq: [["What is an AI fashion try-on reel?", "It is a vertical fashion video direction that shows a garment on a permitted model through fit, movement, styling, and detail moments."], ["Can the generated model represent a real customer?", "No, not without authorization. Use a permitted model or disclose synthetic content and avoid inventing a customer identity or experience."], ["Can the reel guarantee fit?", "No. Motion can add context, but fit varies by body, size, and construction. Keep sizing and material information connected to the product source."], ["How many angles should a try-on reel use?", "Use the fewest angles that answer the buying question: often front, side, movement, and one detail frame are enough."], ["Can I show accessories with the garment?", "Yes, when styling supports the featured item. Keep unfeatured items from creating a misleading expectation about what the shopper receives."]]
  },
  {
    key: "food-video", path: "food-video", menuLabel: "Food & Beverage",
    title: "AI Food & Beverage Video Generator | Aidreamcapes",
    description: "Create an AI food or beverage video that shows preparation, serving, texture, and consumption context with a clear product story for discovery and sale.",
    keywords: "AI food video generator, beverage product video, food ad video, recipe product video, restaurant promo video AI",
    twitterDescription: "Create an AI food or beverage video showing preparation, serving, texture, and consumption context with a clear product story.",
    heroTitle: "Make the serving moment as clear as the product.",
    heroBody: "Build a food or beverage video around preparation, pour, texture, serving, and context. Let the product look inviting while keeping ingredients, nutrition, portion, and reaction language grounded in approved facts.",
    outputLabel: "Food and beverage output", imageNote: "prepare → pour → serve → enjoy", focus: "consumption context",
    product: "unbranded citrus sparkling drink bottle",
    outputCopy: ["The product and serving context appear together.", "Preparation or pour gives the viewer a useful sensory cue.", "Texture and presentation support the story without fake claims.", "The close matches the real purchase or reservation action."],
    workflowCards: [["Define the occasion", "Choose the meal, serving, gathering, or everyday moment where the food or drink belongs."], ["Stage the preparation", "Show opening, mixing, pouring, plating, or serving actions that match the actual product."], ["Capture sensory detail", "Use close framing for texture, condensation, color, and movement without inventing ingredients."], ["Close on the next step", "Send viewers to the product, menu, order, or reservation destination that is actually available."]],
    directionCards: [["Pour and fizz", "Use controlled movement to show a beverage opening, pour, or carbonation cue when accurate."], ["Ingredient context", "Place approved ingredients or pairings around the product without implying an unverified recipe."], ["Table moment", "Show the product in a lived-in serving context that clarifies portion and occasion."], ["First taste boundary", "Use an authorized creator’s response or stay with product evidence instead of fabricating a review."]],
    examples: [["PREPARE", "Start with the product and its real serving action."], ["POUR", "Show motion, texture, temperature, or presentation cues."], ["SERVE", "Place the product in a believable eating or drinking moment."], ["NEXT", "Finish at the current menu, product, order, or reservation path."]],
    exampleTitle: "Use food motion to explain the moment, not invent the claim.", exampleIntro: "Food and beverage creative is strongest when preparation, texture, and context do the work. Keep the sensory story inviting and the product facts precise.",
    adTitle: "Give every placement the right appetite for detail.", adIntro: "Use a vertical serving cut for discovery, a wider product-page edit for context, or a short pour and texture loop for a campaign placement.",
    requirementsIntro: "Food and beverage visuals need an accurate product source, approved ingredients and serving context, permitted talent, and a review of claims around taste, nutrition, and results.",
    requirementCards: [["Product facts", "Verify ingredients, flavor, package, portion, and any visible serving details."], ["Serving action", "Use preparation or consumption steps that match the real product and instructions."], ["Talent rights", "Confirm creator, restaurant, location, and likeness permissions."], ["Claim review", "Check taste, nutrition, health, freshness, and reaction language before publishing."]],
    finalTitle: "Ready to make the serving moment vivid?", finalBody: "Create a food or beverage video that connects product, preparation, texture, and context to a real next action.",
    faq: [["What is an AI food and beverage video generator?", "It helps structure a food or drink video around preparation, serving, texture, context, and a destination such as a product page, menu, or order flow."], ["Can the video claim that a drink tastes a certain way?", "Use taste language only when it reflects approved product information or clearly belongs to an authorized creative concept. Do not fabricate customer testimony."], ["Should I show ingredients in the scene?", "Show them only when they are accurate, relevant, and permitted. A decorative ingredient that is not in the product can mislead the viewer."], ["Can I create restaurant promo videos with this workflow?", "Yes, when the menu, location, service availability, and booking or order destination are current and verified."], ["What makes food visuals feel credible?", "Consistent product identity, believable preparation, accurate serving context, and restrained claims usually matter more than adding extra effects."]]
  },
  {
    key: "home-organization", path: "home-organization", menuLabel: "Home Organization",
    title: "AI Home Organization Video Generator | Aidreamcapes",
    description: "Create an AI home organization video that shows the change from clutter to order, the storage action, visible capacity, and a finished space viewers can understand.",
    keywords: "AI home organization video, storage product video, decluttering video generator, organizing ad video, home storage demo",
    twitterDescription: "Create an AI home organization video showing the change from clutter to order, storage action, capacity, and a finished space.",
    heroTitle: "Show the storage system earning its place in the room.",
    heroBody: "Turn a home organization product into a visible before-and-after workflow. Establish the clutter, show sorting and placement, make capacity readable, and end with a finished space that still feels lived in.",
    outputLabel: "Home organization output", imageNote: "clutter → sort → store → reset", focus: "visible organization",
    product: "clear modular kitchen drawer organizer system",
    outputCopy: ["The starting clutter gives the organization a real job.", "Sorting and placement actions are easy to follow.", "Capacity and access are shown without inflated measurements.", "The finished space makes the improvement observable."],
    workflowCards: [["Show the problem", "Choose one drawer, shelf, desk, or room where the starting state is specific and recognizable."], ["Sort the items", "Make the categories and decisions visible before the storage product enters the frame."], ["Place and access", "Show how the organizer holds, separates, stacks, or retrieves the items in the real context."], ["Hold the reset", "Give the finished space enough time for the viewer to judge what changed and what remained."]],
    directionCards: [["Drawer transformation", "Use a top-down or front-facing view to show sorting, fit, and access in one contained area."], ["Shelf zoning", "Create visible categories without claiming a capacity or dimension the product does not have."], ["Desk reset", "Frame the organizer as part of a repeatable daily reset rather than a one-time perfect room."], ["Small-space proof", "Show how the product changes reach, visibility, or use of space in a believable home."]],
    examples: [["START", "Make the clutter and organization problem recognizable."], ["SORT", "Show the decision that prepares the space for the system."], ["STORE", "Demonstrate placement, access, and product capacity carefully."], ["RESET", "End on a finished space the viewer can evaluate."]],
    exampleTitle: "Make the change from clutter to order visible.", exampleIntro: "Organization creative works when the viewer can see the starting problem, copy the storage action, and understand the finished state without a perfect-room illusion.",
    adTitle: "Give the transformation enough room to read.", adIntro: "Use vertical before-and-after cuts for discovery, a wider demonstration for product pages, or a focused drawer loop when one storage action is the key proof.",
    requirementsIntro: "A useful organization video needs a real starting problem, accurate product dimensions and capacity, believable household context, and a finished state that does not overpromise.",
    requirementCards: [["Specific starting space", "Choose the drawer, shelf, desk, or room the product is meant to improve."], ["Accurate dimensions", "Verify size, capacity, materials, and compatibility before showing the fit."], ["Repeatable action", "Define how items are sorted, placed, accessed, and maintained."], ["Before-and-after review", "Check that the visible improvement comes from the product and action shown."]],
    finalTitle: "Ready to make the reset easy to see?", finalBody: "Build a home organization video around a real clutter problem, a clear storage action, and a finished state that earns confidence.",
    faq: [["What is an AI home organization video?", "It is a product-led visual sequence that shows a specific clutter problem, the organizing action, storage use, and a finished space viewers can assess."], ["Can the video promise that a product fits any drawer?", "No. Show or state dimensions and compatibility only when they are verified. Generated fit should be reviewed against the actual product."], ["Should the video always use a dramatic before-and-after?", "Not necessarily. A contained drawer, shelf, or desk reset can be more credible when it shows the product’s practical job clearly."], ["Can I show more items than the organizer holds?", "Avoid it. Capacity should be represented accurately so the finished state does not create a misleading expectation."], ["Where can organization videos work?", "They can support product pages, home feeds, short-form social, seasonal resets, and retail campaigns when the product facts remain current."]]
  },
  {
    key: "app-saas-demo", path: "app-saas-demo", menuLabel: "App / SaaS Demo",
    title: "AI App & SaaS Demo Video Generator | Aidreamcapes",
    description: "Create an AI app or SaaS demo video that shows a real interface flow, task completion, product value, and clear boundaries around the data and features shown.",
    keywords: "AI SaaS demo video, app demo generator, software product video, screen recording alternative, SaaS explainer video AI",
    twitterDescription: "Create an AI app or SaaS demo video showing a real interface flow, task completion, product value, and clear feature boundaries.",
    heroTitle: "Show the task getting done, not just a polished screen.",
    heroBody: "Build a SaaS demo around one user goal. Establish the starting problem, walk through the interface action, show the output, and keep data, integrations, and feature claims aligned with the real product.",
    outputLabel: "App demo output", imageNote: "task → flow → result → next", focus: "interface workflow",
    product: "unbranded analytics workspace on a laptop screen",
    outputCopy: ["The user task is clear before the interface appears.", "The key interaction has a readable beginning and end.", "The result is framed as product output, not invented data.", "The final action points to a real product entry point."],
    workflowCards: [["Choose one task", "Define the action a prospective user should understand by the end of the demo."], ["Map the interface", "Use current screens, labels, and navigation so the flow is recognizable and truthful."], ["Show the output", "Demonstrate the completed task or visible result without fabricating customer data or integrations."], ["Close on access", "Send the viewer to the correct signup, workspace, documentation, or product tour path."]],
    directionCards: [["Workflow walkthrough", "Guide from input to output with only the screens needed for one useful task."], ["Feature spotlight", "Zoom into one interaction while preserving enough surrounding context to understand it."], ["Role-based demo", "Frame the same workflow around a real role, such as marketer, analyst, or operator."], ["Integration boundary", "Show connected tools only when the integration and data flow are currently supported."]],
    examples: [["TASK", "Name the job the user needs the software to complete."], ["FLOW", "Show the real interaction and current interface state."], ["RESULT", "Make the completed output visible without fake data claims."], ["NEXT", "Finish at the correct signup, tour, or workspace path."]],
    exampleTitle: "Turn a feature list into a workflow people can picture.", exampleIntro: "A SaaS demo is persuasive when the viewer understands the task and sees the result. Keep the interface current, the data honest, and the path short enough to follow.",
    adTitle: "Choose the right screen density for the audience.", adIntro: "Use a vertical feature moment for discovery, a wider walkthrough for a landing page, or a short workflow loop when one action carries the value.",
    requirementsIntro: "Software demos require current UI, permission to show screens and data, a defined user task, and a technical review of feature and integration claims.",
    requirementCards: [["Current interface", "Confirm labels, navigation, permissions, and screens match the live product."], ["Safe demo data", "Use approved sample or anonymized data rather than fabricating customer results."], ["Task definition", "Choose one job with a clear starting state and completed output."], ["Feature review", "Verify availability, integrations, limits, and CTA destination before release."]],
    finalTitle: "Ready to show the workflow in motion?", finalBody: "Create a SaaS demo that makes one real task, one real result, and one clear next step easy to understand.",
    faq: [["What is an AI app or SaaS demo video?", "It is a structured software walkthrough that connects a user task to an interface flow, completed result, and product entry point."], ["Can I use generated UI text in a demo?", "Use current approved interface copy whenever possible. Review any generated screen carefully so labels, features, and data do not misrepresent the product."], ["Should a SaaS demo show real customer data?", "Use only data you have permission to show. Anonymized or approved sample data is usually safer for public creative."], ["Can one demo cover the whole platform?", "A focused task is usually clearer. Link to additional workflows or documentation when the buyer needs more depth."], ["How often should an app demo be updated?", "Update it when the interface, permissions, integrations, pricing, or core workflow changes enough to affect the viewer’s decision."]]
  },
  {
    key: "local-service-ad", path: "local-service-ad", menuLabel: "Local Service Ad",
    title: "AI Local Service Ad Video Generator | Aidreamcapes",
    description: "Create an AI local service ad video that shows the service area, booking path, arrival, work performed, and a trustworthy next step without unsupported coverage claims.",
    keywords: "AI local service ad, local business video generator, service area ad video, home service marketing, appointment ad video",
    twitterDescription: "Create an AI local service ad video showing service area, booking path, arrival, work performed, and a trustworthy next step.",
    heroTitle: "Make the service visit feel specific before the booking click.",
    heroBody: "Build a local service ad around the customer journey. Establish where the service is available, show the booking and arrival experience, make the work visible, and end with a destination the business can support.",
    outputLabel: "Local service output", imageNote: "area → book → arrive → complete", focus: "service visit",
    product: "professional residential window cleaning kit",
    outputCopy: ["The service and area are clear before the appointment ask.", "The booking path feels specific and easy to follow.", "Arrival and work steps create visible proof of the service.", "The final CTA matches actual availability and contact details."],
    workflowCards: [["Define the service area", "Confirm cities, neighborhoods, travel boundaries, and any service exclusions before writing the hook."], ["Show the booking path", "Explain the real way a customer requests a quote, books a slot, or contacts the team."], ["Stage the visit", "Show arrival, preparation, work, and cleanup only within the actual service process."], ["Close with trust", "Use verified contact, availability, guarantee, or review information and avoid invented credentials."]],
    directionCards: [["Before-and-after service", "Show an observable change when the service genuinely creates one and the representation is accurate."], ["Arrival window", "Make the visit process and timing understandable without promising an appointment that is not available."], ["Craft detail", "Use close framing for the work itself so the service is more than a logo or vehicle shot."], ["Neighborhood context", "Connect the service to a real location or customer need without implying coverage everywhere."]],
    examples: [["AREA", "Establish where the service is actually offered."], ["BOOK", "Show the real quote, call, or booking path."], ["WORK", "Make the service action visible and specific."], ["COMPLETE", "Close on verified next steps and availability."]],
    exampleTitle: "Show the service customers are actually booking.", exampleIntro: "Local service creative builds trust through specificity. Let the viewer see the area, process, arrival, work, and next step without overpromising coverage or results.",
    adTitle: "Keep the service message useful from feed to booking.", adIntro: "Use a vertical neighborhood-friendly cut for discovery, a longer process edit for a landing page, or a short proof moment that leads into the real booking path.",
    requirementsIntro: "A local service ad needs current service boundaries, booking details, permitted locations and people, a truthful process, and a CTA the team can answer.",
    requirementCards: [["Service boundary", "Verify cities, neighborhoods, travel fees, availability, and exclusions."], ["Booking path", "Use the current quote, phone, form, or appointment destination."], ["Process evidence", "Show real work steps, equipment, uniforms, and locations only with permission."], ["Trust claims", "Review reviews, guarantees, credentials, response times, and before-and-after language."]],
    finalTitle: "Ready to make the next visit feel clear?", finalBody: "Create a local service ad around a real area, a visible process, and a booking path customers can trust.",
    faq: [["What is an AI local service ad video?", "It is a service-focused video direction that explains coverage, booking, arrival, work performed, and the next step for a local customer."], ["Can I use a generic service area claim?", "Use only current, supportable coverage. A broad claim can mislead customers when travel boundaries or appointment availability vary."], ["Should the video show the real service team?", "Use real people, synthetic presenters, or licensed footage only with permission. Do not invent a technician identity, credential, or customer review."], ["Can a local service video include a price?", "Yes, when the price, estimate conditions, service scope, and destination are current and clear. Avoid a low headline that hides required fees."], ["Where should the CTA send viewers?", "Send them to the current booking form, quote request, phone number, or contact path that the service team can actually support."]]
  }
];

const imageAltByKey = Object.fromEntries(pages.map((page) => [page.key, [
  `${page.product} product input prepared for an AI ${page.menuLabel.toLowerCase()} video`,
  `${page.menuLabel} video output showing ${page.focus} in a clear product context`,
  `${page.menuLabel} opening frame establishing the product and campaign context`,
  `${page.menuLabel} action frame showing the main workflow decision`,
  `${page.menuLabel} detail frame showing visible proof for the intended viewer`,
  `${page.menuLabel} close-up focused on the product, service, or interface detail`,
  `${page.menuLabel} context frame showing the theme in a believable use situation`,
  `${page.menuLabel} review frame showing the result before the call to action`,
  `${page.menuLabel} closing frame prepared for the final campaign action`
]]));

function imageSet(key) {
  const names = ["product", "hero-output", ...Array.from({ length: 7 }, (_, index) => `example-${String(index + 1).padStart(2, "0")}`)];
  const page = pages.find((item) => item.key === key);
  const alts = imageAltByKey[key];
  assert(page && alts?.length === 9, `incomplete image set: ${key}`);
  const create = (index, role) => ({
    src: `${generatedBase}/${key}/${key}-${names[index]}.webp`,
    alt: alts[index],
    ...imageSize,
    loading: role === "product" || role === "hero" ? "eager" : "lazy",
    fetchPriority: role === "product" ? "high" : "auto",
    sizes: role === "product" ? productSizes : cardSizes
  });
  return { product: create(0, "product"), output: create(1, "hero"), examples: names.slice(2).map((_, index) => create(index + 2, "content")) };
}

function guidance(eyebrow, title, intro, entries) {
  return { eyebrow, title, intro, cards: entries.map(([title, body]) => ({ title, body })) };
}

function buildDetail(spec) {
  const narrative = topicNarratives[spec.key];
  const images = imageSet(spec.key);
  const canonicalPath = `/ai-video-generation/${spec.path}`;
  const exampleEntries = spec.examples.map(([noteLabel, title], index) => ({ title, body: `${noteLabel}: ${title} Keep the ${spec.focus} accurate and easy to understand in this frame.`, noteLabel, image: images.examples[index] }));
  assert.equal(exampleEntries.length, 4, `${spec.key}: four authored examples`);
  exampleEntries.push(
    { title: `Detail the ${spec.focus}.`, body: `Use a close, readable moment that helps the viewer judge ${spec.focus}.`, noteLabel: "DETAIL", image: images.examples[4] },
    { title: `Place the ${spec.menuLabel.toLowerCase()} in context.`, body: `Use context to explain why this ${spec.focus} matters to the intended audience.`, noteLabel: "CONTEXT", image: images.examples[5] },
    { title: "Close on the approved next step.", body: "Keep the destination and final message aligned with the evidence shown.", noteLabel: "NEXT STEP", image: images.examples[6] }
  );
  return {
    layoutVariant: "promo-category-detail",
    seo: {
      title: spec.title,
      description: spec.description,
      keywords: spec.keywords,
      canonicalPath,
      canonical: `https://www.aidreamcapes.com${canonicalPath}`,
      robots: { index: true, follow: true, maxImagePreview: "large" },
      twitterDescription: spec.twitterDescription,
      ogImage: images.output.src,
      ogImageAlt: images.output.alt
    },
    hero: {
      eyebrow: `AI VIDEO · ${spec.menuLabel}`,
      title: spec.heroTitle,
      body: spec.heroBody,
      primaryCta: `Create ${spec.menuLabel}`,
      primaryCtaHref: "/app/create?videoMode=product-video#step-video",
      secondaryCta: `See ${spec.menuLabel} examples`,
      secondaryCtaHref: "#topic-examples",
      availabilityNote: "Review the concept, credit cost, and output requirements before generation.",
      rightsCopy: "Use only product assets, claims, creator identities, locations, and destinations you can verify and publish.",
      imageNote: spec.imageNote,
      productLabel: "01 · Product input",
      outputLabel: `02 · ${spec.outputLabel}`,
      productImage: images.product,
      outputImage: images.output
    },
    workflowOutput: guidance(narrative[0], narrative[1], narrative[2], spec.outputCopy.map((item, index) => [`0${index + 1}`, item])),
    workflow: guidance("THE CAMPAIGN FLOW", `From ${spec.focus} to a reviewable video direction.`, `Each step gives ${spec.menuLabel.toLowerCase()} a distinct production decision instead of defaulting to a generic product introduction.`, spec.workflowCards),
    creativeDirections: guidance("CREATIVE DIRECTIONS", `Creative directions for ${spec.menuLabel.toLowerCase()}.`, `Change the framing, sequence, or presenter job while keeping ${spec.focus} accurate and visible.`, spec.directionCards),
    examples: { eyebrow: "THEME EXAMPLES", title: spec.exampleTitle, intro: spec.exampleIntro, items: exampleEntries },
    adTesting: { eyebrow: "FORMAT & PLACEMENT", title: spec.adTitle, intro: spec.adIntro, platforms: ["Vertical · 9:16", "Product page · 16:9", "Short proof loop"], checklist: ["Theme task is clear in the opening", "Product or service evidence matches the copy", "Presenter, location, or source permissions are reviewed", "Captions and safe areas are checked", "Credits and output settings are reviewed"] },
    requirements: guidance("BEFORE YOU CREATE", `Prepare the inputs for ${spec.menuLabel.toLowerCase()}.`, spec.requirementsIntro, spec.requirementCards),
    relatedWorkflows: { eyebrow: "CONTINUE THE WORKFLOW", title: `Move from ${spec.menuLabel.toLowerCase()} to the next useful step.`, intro: "Keep the campaign goal intact as you move into a product demo, focused product context, or UGC direction.", items: [
      { title: "Product Demo", body: "Show the physical or interface action when the viewer needs to understand how the product works.", href: "/ai-video-generation/product-video", linkLabel: "Open Product Demo" },
      { title: "URL to Ad", body: "Start from a verified product page when campaign facts should follow a current source.", href: "/ai-video-generation/url-to-ad", linkLabel: "Open URL to Ad" },
      { title: "UGC Product Ad", body: "Add a creator-led opening when the campaign needs a human point of view alongside product proof.", href: "/ai-video-generation/ugc-ad-video", linkLabel: "Open UGC Product Ad" }
    ] },
    faq: { eyebrow: "FAQ", title: `Questions about ${spec.menuLabel.toLowerCase()}.`, items: spec.faq.map(([question, answer]) => ({ question, answer })) },
    finalCta: { eyebrow: "READY TO BUILD THE RIGHT CAMPAIGN?", title: spec.finalTitle, body: spec.finalBody, cta: `Create ${spec.menuLabel}`, ctaHref: "/app/create?videoMode=product-video#step-video", microcopy: `Start with the inputs for ${spec.menuLabel.toLowerCase()}. Review the direction before you generate.` }
  };
}

export const aidreamcapesPromoCategoryPageSpecs = pages.map((spec) => ({ ...spec, detail: buildDetail(spec) }));
export const aidreamcapesPromoCategoryPaths = aidreamcapesPromoCategoryPageSpecs.map((spec) => spec.detail.seo.canonicalPath);

export function aidreamcapesPromoCategoryPagesForMigration() {
  return aidreamcapesPromoCategoryPageSpecs.map((spec) => ({ key: spec.key, menuLabel: spec.menuLabel, slug: spec.detail.seo.canonicalPath, title: spec.detail.seo.title, content: spec.detail }));
}

export function validateAidreamcapesPromoCategoryContent({ log = console.log, requireAssets = true } = {}) {
  assert.equal(aidreamcapesPromoCategoryPageSpecs.length, 11);
  const seenPaths = new Set();
  const seenMedia = new Set();
  for (const spec of aidreamcapesPromoCategoryPageSpecs) {
    const content = spec.detail;
    const seo = content.seo;
    assert.ok(seo.title.length >= 45 && seo.title.length <= 70, `${spec.key}: title length ${seo.title.length}`);
    assert.ok(seo.description.length >= 140 && seo.description.length <= 175, `${spec.key}: description length ${seo.description.length}`);
    assert.ok(!seenPaths.has(seo.canonicalPath), `duplicate path: ${seo.canonicalPath}`);
    seenPaths.add(seo.canonicalPath);
    assert.equal(content.layoutVariant, "promo-category-detail");
    assert.match(seo.canonical, /^https:\/\/www\.aidreamcapes\.com\/ai-video-generation\//);
    assert.ok(seo.ogImage.startsWith(`${siteBase}/`), `${spec.key}: storefront image isolation`);
    const images = [content.hero.productImage, content.hero.outputImage, ...content.examples.items.map((item) => item.image)];
    assert.equal(images.length, 9, `${spec.key}: content image count`);
    assert.equal(new Set(images.map((image) => image.src)).size, 9, `${spec.key}: duplicate content images`);
    assert.equal(content.examples.items.length, 7, `${spec.key}: example image count`);
    assert.equal(content.faq.items.length, 5, `${spec.key}: faq count`);
    for (const [index, image] of images.entries()) {
      assert.ok(image.src.startsWith(`${generatedBase}/${spec.key}/`), `${spec.key}: image set isolation`);
      assert.match(image.src, /\.webp$/);
      assert.equal(image.width, imageSize.width);
      assert.equal(image.height, imageSize.height);
      assert.ok(image.alt.length >= 30, `${spec.key}: image ${index} alt quality`);
      assert.equal(image.loading, index < 2 ? "eager" : "lazy");
      assert.equal(image.fetchPriority, index === 0 ? "high" : "auto");
      if (requireAssets) assert.ok(existsSync(new URL(`../../public${image.src}`, import.meta.url)), `${spec.key}: missing image ${image.src}`);
      assert.ok(!seenMedia.has(image.src), `${spec.key}: image reused by another page`);
      seenMedia.add(image.src);
    }
    for (const value of [seo.title, seo.description, spec.heroTitle, spec.heroBody, ...spec.faq.flat()]) assert.ok(!/\p{Script=Han}/u.test(value), `${spec.key}: customer copy must be English`);
    log(`${spec.key}: title=${seo.title.length} description=${seo.description.length} media=${images.length}`);
  }
  assert.equal(seenMedia.size, 99, "Promo / Category must have 99 unique media URLs");
  return true;
}
