// Extract the product facts a prompt can safely state.
//
// The storefront cards carry no product database. The only facts available are
// the card's own text: the image alternative text (the scene), the label, the
// chips and the original direction. This module turns them into the small fact
// set the prompt needs, and it never invents a claim that the card does not
// already contain.
//
// Shape:
//   product        "full-size bicycle"            noun phrase, no colour word
//   productFull    "full-size bicycle"            with the material adjective
//   colour         "sage" | ""                    adjective the alt already uses
//   subject        "An adult commuter"            person or hands, else ""
//   subjectRole    "commuter"                     short form for narration
//   setting        "beside a train platform"      where the scene happens
//   settingShort   "a train platform"             the place alone
//   verb           "folds"                        the action verb from the alt
//   actionTail     "before carrying it aboard"    what happens after the verb
//   scene          the full alternative text, one sentence
//   trait          "two large wheels"             a visible "with …" clause
//   person         boolean
//   category       "food" | "beauty" | "fashion" | "tech" | "home" | "accessory" | "other"

const PERSON = /\b(?:adult|man|woman|person|commuter|creator|hands?|presenter|customer|model|runner|parent|owner|user|teen|student|chef|barista|nurse|cyclist)\b/i;

const COLOURS = new Set([
  "sage", "teal", "coral", "charcoal", "white", "black", "navy", "cream", "ivory",
  "sand", "stone", "olive", "amber", "rust", "plum", "rose", "mint", "slate",
  "graphite", "silver", "gold", "copper", "bronze", "blue", "green", "grey", "gray",
  "red", "pink", "yellow", "orange", "purple", "brown", "beige", "taupe", "natural"
]);

// The preposition or participle that ends the product noun phrase.
const PHRASE_END = /\s+(?=(?:in|on|at|beside|onto|from|inside|into|after|with|under|over|behind|near|by|against|packed|resting|lifted|held|standing|sitting|lying|open(?:s|ed)?|raising|raised|applies|applied|folded|folds|clipped|worn|tucked|slid|set|placed|hanging|hangs|sits|rests|waiting|ready)\b)/i;

// Head nouns that name something a customer can sell. The extractor uses this
// list to find the product noun phrase in cards that do not use the plain /
// generic wording, and to reject noun phrases that describe a person or a mood.
const PRODUCT_HEADS = new Set(`bottle shaker pump cleanser moisturiser moisturizer serum cream lotion lipstick
mascara blush foundation toner perfume fragrance polish brush skincare sunscreen shampoo conditioner razor
snack berry berries chocolate nut nuts biscuit cookie drink juice smoothie bread cheese pasta sauce honey
granola protein meal bowl cup mug glass plate jar tin can box bag pouch packet scarf shirt tee dress jacket
coat cardigan knit sweater overshirt jeans trousers pants skirt shoe shoes sneaker sneakers boot boots hat cap
watch ring necklace earring bracelet sunglass sunglasses tote backpack wallet belt case strap umbrella charger
cable keyboard mouse phone tablet laptop earbud earbuds headphone headphones speaker camera monitor adapter
powerbank hub tripod grip stand lamp kettle pan pot steamer blender vacuum cushion blanket towel plant vase
candle diffuser humidifier appliance machine bicycle bike helmet harness leash collar mat dumbbell ball racket
yoga blender food skincare gadget tool set kit smartphone pen notebook tray organizer organizer-tray`.split(/\s+/).filter(Boolean));

function headOf(phrase) {
  const words = String(phrase).toLowerCase().split(/[\s-]+/).filter(Boolean);
  for (let index = words.length - 1; index >= 0 && index >= words.length - 5; index -= 1) {
    const word = words[index].replace(/[^a-z]/g, "");
    if (PRODUCT_HEADS.has(word)) return word;
    if (PRODUCT_HEADS.has(word.replace(/s$/, ""))) return word.replace(/s$/, "");
  }
  return "";
}

const NOT_A_PRODUCT = /\b(?:hair|curl|curls|pixie|bob|crop|fade|braid|coils|greeting|smile|smiling|laugh|look|glance|breath|pose|stance|expression|mood|setting|light|lighting|morning|evening|day|moment|update|story|reel|intro|outro|selfie|shot|frame|angle|view|backdrop|wall|floor|window|sky)\b/i;

function candidateProducts(text) {
  const out = [];
  const pattern = /\b(?:a|an|the)\s+((?:[a-z0-9][a-z0-9'-]*\s+){0,6}[a-z0-9][a-z0-9'-]*)/gi;
  let match;
  while ((match = pattern.exec(text))) {
    const raw = match[1].trim();
    if (NOT_A_PRODUCT.test(raw)) continue;
    const head = headOf(raw);
    if (!head) continue;
    // Keep the phrase, but stop it at the head noun: "protein shaker bottle in"
    // becomes "protein shaker bottle".
    const words = raw.split(/\s+/);
    const headIndex = words.findIndex((word) => word.toLowerCase().replace(/[^a-z-]/g, "") === head || word.toLowerCase().replace(/[^a-z-]/g, "").replace(/s$/, "") === head);
    let phrase = words.slice(0, headIndex >= 0 ? headIndex + 1 : words.length).join(" ");
    // Stop the phrase at a preposition or a verb that starts a new clause
    // ("man holds the pump bottle" only sells the bottle).
    const stop = phrase.search(/\s+(?:beside|onto|outside|inside|under|over|through|toward|towards|near|next to|against|in|on|at|to|of|from|with|for|after|before|while|holds|holding|holds|takes|taking|gives|giving|drinks|drinking|presents|points)\b/i);
    if (stop > 0) phrase = phrase.slice(0, stop);
    // After trimming, the phrase must still end on something sellable.
    if (!headOf(phrase)) continue;
    const start = match.index + match[0].indexOf(raw);
    out.push({ phrase, head: headOf(phrase), index: start, end: start + phrase.length });
  }
  return out;
}

const CATEGORY_RULES = [
  ["beauty", /\b(?:moisturis|moisturiz|serum|cream|lotion|lipstick|lip|mascara|blush|foundation|cleanser|toner|perfume|fragrance|nail|makeup|brush|skincare|sunscreen|shampoo|conditioner|razor|hair)\b/i],
  ["food", /\b(?:snack|berry|coffee|tea|matcha|chocolate|nut|biscuit|cookie|drink|bottle|juice|smoothie|bread|cheese|pasta|sauce|honey|granola|protein|meal|bowl|cup|mug)\b/i],
  ["fashion", /\b(?:shirt|tee|t-shirt|dress|jacket|coat|cardigan|knit|scarf|trouser|pants|jeans|skirt|shoe|sneaker|boot|bag|tote|hat|cap|overshirt|linen|denim|silk|wool|leather|jewel|ring|necklace|earring|watch|sunglass)\b/i],
  ["tech", /\b(?:charger|cable|keyboard|mouse|phone|tablet|laptop|earbud|headphone|speaker|camera|monitor|grip|stand|adapter|power|hub|tracker|watch|console|app)\b/i],
  ["home", /\b(?:steamer|kettle|pan|pot|appliance|blender|vacuum|lamp|chair|shelf|cushion|blanket|towel|bottle|jar|container|cutting|knife|board|plant|vase|candle|diffuser|humidifier)\b/i],
  ["accessory", /\b(?:bicycle|bike|helmet|harness|leash|collar|backpack|pouch|wallet|belt|case|strap|keyring|umbrella|yoga|mat|dumbbell|racket|ball)\b/i]
];

function categoryOf(text) {
  for (const [name, pattern] of CATEGORY_RULES) if (pattern.test(text)) return name;
  return "other";
}

function tidy(value) {
  return String(value ?? "").replace(/\s+/g, " ").replace(/^[ ,.;:]+|[ ,.;:]+$/g, "").trim();
}

/** Split the alternative text into subject, verb, product and setting. */
export function productFacts(card) {
  const alt = tidy(String(card.alt ?? "").replace(/\.$/, ""));
  const label = tidy(card.label ?? "");
  const detail = tidy(String(card.prompt ?? ""));
  const combined = `${alt} ${detail}`;

  // The product phrase sits after "plain", "smooth plain" or "generic".
  let product = "";
  let before = "";
  let after = "";
  const anchor = /\b(?:smooth\s+)?(?:plain|generic)\s+/i.exec(alt);
  if (anchor) {
    const tail = alt.slice(anchor.index + anchor[0].length);
    const end = PHRASE_END.exec(tail);
    const phrase = tidy(end ? tail.slice(0, end.index) : tail);
    const rest = end ? tail.slice(end.index) : "";
    product = phrase;
    before = tidy(alt.slice(0, anchor.index));
    after = tidy(rest);
  }
  if (product) {
    // The anchor can run past the product into a clause ("… linen shirt
    // displayed front and back", "… smartphone and points to the screen"), so
    // the phrase is cut where the product ends and the description begins.
    const words = product.split(/\s+/);
    const boundary = words.findIndex((word, index) => index > 0 && (
      /ed$/i.test(word)
      || /,$/.test(word)
      || /^(?:to|with|from|onto|beside|outside|inside|near|through|under|over|against|toward|towards|and|that|which|who|while|as|giving|holding|showing|using|taking|making|looking|speaking|standing|wearing)$/i.test(word)
      || /^(?:points|presents|shows|holds|gives|takes|speaks|rests|sits|stands|lies|hangs|opens|folds|clips|presses|pours|lifts|applies|tries|wears|reviews|unboxes|packs|sets|places|slides|wraps|cuts|turns|moves|reaches|looks|smiles|nods|asks|says|talks|walks|runs)$/i.test(word)
    ));
    if (boundary > 0) product = words.slice(0, boundary).join(" ");
  }
  if (!product) {
    // Cards written without "plain" / "generic": take the first noun phrase in
    // the scene whose head noun is something a customer can sell.
    const candidates = candidateProducts(alt);
    const pick = candidates[0];
    if (pick) {
      product = tidy(pick.phrase);
      before = tidy(alt.slice(0, pick.index));
      after = tidy(alt.slice(pick.end));
    }
  }
  if (!product) {
    // Last chance: the label, which is written as "Category: Detail".
    const labelTail = tidy(String(label).split(":").pop() ?? "");
    const pick = candidateProducts(`a ${labelTail}`)[0] ?? candidateProducts(`a ${label}`)[0];
    if (pick) product = tidy(pick.phrase);
  }

  // Final guard: a phrase longer than five words is not a product name, so it
  // is cut at its last head noun, or dropped so the prompt says "the product".
  if (product && product.split(/\s+/).length > 5) {
    const parts = product.split(/\s+/);
    let last = -1;
    parts.forEach((word, index) => {
      const clean = word.toLowerCase().replace(/[^a-z-]/g, "");
      if (PRODUCT_HEADS.has(clean) || PRODUCT_HEADS.has(clean.replace(/s$/, ""))) last = index;
    });
    let kept = last >= 0 ? parts.slice(0, last + 1).join(" ") : "";
    // Drop a leading subject clause: "man wears the sage bag" -> "sage bag".
    const determiner = kept.search(/\b(?:the|a|an)\s+/i);
    if (determiner > 0) kept = kept.slice(determiner).replace(/^(?:the|a|an)\s+/i, "");
    product = kept;
  }

  // Colour and material adjectives already present in the phrase.
  const words = product.split(" ");
  const colour = words.find((word) => COLOURS.has(word.toLowerCase())) ?? "";

  // The verb: the last word before the product for an active sentence, the
  // first word after it for a passive one.
  let verb = "";
  let subject = "";
  let setting = after;
  const beforeWords = before
    .split(" ")
    .filter((word) => !/^(?:a|an|the|smooth)$/i.test(word))
    .filter((word) => !/^(?:on|off|up|down|in|out|away|back|apart|over|into)$/i.test(word));
  const afterWords = after.split(" ").filter(Boolean);
  const looksVerb = (word) => /(?:s|es|ed|ing)$/i.test(word) && !/^(?:adult|hands?|man|woman|with|and|a|an|the|plain|generic|smooth)$/i.test(word);
  if (beforeWords.length && looksVerb(beforeWords[beforeWords.length - 1])) {
    verb = beforeWords[beforeWords.length - 1];
    subject = beforeWords.slice(0, -1).join(" ");
  } else if (afterWords.length && looksVerb(afterWords[0])) {
    verb = afterWords[0];
    setting = afterWords.slice(1).join(" ");
  }

  // A visible trait: the first "with …" clause that belongs to the product.
  let trait = "";
  const traitPattern = /\bwith\s+([a-z0-9][^.,;]{3,60}?)(?=\s+(?:beside|in|on|at|before|and|while|through|onto|from|under|near|by|against)\b|[,.;]|$)/i;
  const traitMatch = traitPattern.exec(detail);
  if (traitMatch) {
    const candidate = tidy(traitMatch[1]);
    // The alt also uses "with" for people ("with a short copper bob"), so keep
    // only a clause that does not describe a person's hair or skin.
    if (!/\b(?:hair|bob|crop|curls?|fade|pixie|skin|complexion|beard)\b/i.test(candidate)) trait = candidate;
  }

  const settingParts = (() => {
    const text = String(setting ?? "").trim();
    const lead = /^(in|on|at|beside|onto|inside|outside|near|by|against|from|through|under|over|after|before)\s+([\s\S]*)$/i.exec(text);
    if (/^with\b/i.test(text)) return { prep: "in", short: "a real room" };
    const prep = lead ? lead[1].toLowerCase() : "";
    const body = lead ? lead[2] : text;
    const short = tidy(
      body
        .split(",")[0]
        .replace(/\s+(?:before|then|while|as|after)\s+[\s\S]*$/i, "")
        .replace(/\s+(?:speaking|standing|looking|holding|giving|smiling|showing|presenting|wearing)\b[\s\S]*$/i, "")
        .replace(/\s+(?:with|together|tucked)\s+[\s\S]*$/i, "")
    );
    return { prep: prep || "in", short: short || "a real room" };
  })();
  const settingShort = settingParts.short;
  const settingPrep = settingParts.prep;

  const person = PERSON.test(alt) || PERSON.test(`${subject}`);
  const subjectRole = (() => {
    const words2 = subject.split(/\s+/).filter(Boolean);
    const role = words2
      .reverse()
      .find((word) => /[a-z]/i.test(word) && !/^(?:adult|a|an|the|with|and)$/i.test(word) && !/(?:ing|ed)$/i.test(word));
    return role ?? "";
  })();

  // A common noun is written in lower case inside a sentence.
  if (product && !/^[A-Z0-9]{2,}$/.test(product)) product = product.charAt(0).toLowerCase() + product.slice(1);

  return {
    product,
    colour,
    subject: subject ? `${subject.charAt(0).toUpperCase()}${subject.slice(1)}` : "",
    subjectRole: subjectRole ? subjectRole.toLowerCase() : "",
    setting,
    settingShort,
    settingPrep,
    verb,
    actionTail: "",
    scene: alt,
    trait,
    person,
    category: categoryOf(combined)
  };
}
