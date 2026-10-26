// Compiles AIVideosUGC video detail cards into skill compliant prompts.
//
// The compiler never invents product facts. Every sentence it writes comes
// from the card's own stored copy: the current prompt, the image alternative
// text, the label and the chips. The image alternative text is the scene
// record, the prompt is the action record.

const TEMPLATE_PREFIX = /^Use the uploaded product image as the subject and preserve its shape(?:,? color)?(?:,? and (?:its )?label area)?(?: exactly)?\.\s*/i;
const TEMPLATE_SUFFIX = /\s*Realistic vertical product video framing, no readable text, logos, or watermark; natural hands and lighting\.?$/i;
const HANDWRITTEN_TAIL = [
  /\s*Keep the [^.]*?'s shape, color,? and label as in your photo\.?/gi,
  /\s*Add background music if you want it\.?/gi,
  /\s*Add a short voiceover and captions\.?/gi,
  /\s*Leave the price off\.?/gi,
  /\s*You hear a quiet room\.?/gi
];

const LABEL_ROLE_WORDS = /\b(video|reel|clip|promo|ad|ugc|demo|demonstration|detail|review|explainer|walkthrough|how to|how-to|tutorial|lesson|unboxing|showcase|hook|film|comparison|compare|layout|shot|scene|pack|guide|story|update|greeting|check|moment|fit|spin|turn|reveal|swatch|lineup|before and after|before-after|launch|black friday|brand|every angle|template|collection)\b/gi;

const PRESENTER = /^(?:An?\s+)?(?:adult\s+|older\s+|elderly\s+)?(?:[A-Z][a-z]+\s+){0,2}(man|woman)\b/i;

/** Sentences that belong to another section, or to a human decision. */
const DROP_SENTENCE = [
  /^(?:vertical|horizontal)\s+\d+:\d+/i,
  /\b(?:handheld selfie framing|framing with natural light|selfie framing)\b/i,
  /\b(?:talks|talking|speaks|speaking) (?:naturally |directly )?to camera\b/i,
  /^you hear\b/i,
  /^add (?:a short )?(?:voiceover|captions|background music)/i,
  /^keep the .* as in your photo\.?$/i,
  /^leave the price off\.?$/i,
  /^realistic vertical product video framing/i,
  /^use the uploaded product image as the subject/i
];

function tidy(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
}

function sentences(value) {
  return String(value ?? "")
    .split(/(?<=\.)\s+/)
    .map(tidy)
    .filter(Boolean);
}

function dropSentences(list) {
  return list.filter((part) => !DROP_SENTENCE.some((pattern) => pattern.test(part)));
}

function youToThe(value) {
  return String(value ?? "")
    .replace(/\byour uploaded product\b/gi, "the product")
    .replace(/\byour product\b/gi, "the product")
    .replace(/\byour\s+/gi, "the ");
}

/** Normalised comparison key, so a repeated sentence is only written once. */
function key(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Classify the card into one of the skill's writing tracks. */
export function classifyTrack(card) {
  const prompt = String(card.prompt ?? "").trim();
  const label = String(card.label ?? "").toLowerCase();
  const alt = String(card.alt ?? "");
  if (!prompt) {
    // A card without a stored prompt still shows a scene. A person in the
    // frame means a creator track, a product alone means a display track.
    return /\b(man|woman|adult|presenter|creator|hand|hands)\b/i.test(alt) ? "ugc-action" : "product-display";
  }
  if (TEMPLATE_PREFIX.test(prompt)) return "product-display";
  if (/talks directly to camera|speaking to camera|talking to camera|speaks to camera/i.test(prompt)) return "ugc-talking";
  const subject = `${label} ${prompt}`;
  // Material and shape close-ups are the brand texture track.
  if (/\b(?:macro|close-up|close up|detail|reveal|texture|finish|material|brand film|spin|rotate|360|showcase|turn)\b/i.test(subject)) return "brand-texture";
  // Arranged, compared or held product shots are the e-commerce display track.
  if (/\b(?:lineup|line up|comparison|compare|swatch|options|variants?|colours?|colors?|hold |holds |sits? on|displayed|arranged|packshot|still life|collection|range)\b/i.test(subject)) return "product-display";
  // A creator, a pair of hands or a person using the product is the UGC track.
  if (/^(?:a creator|an? [a-z-]* creator|let a creator|ask |show |build a|take |start with|open from|lead with|ask for|use a |film a|recreate|a hand|hands |a (?:man|woman|male|female|gym|trainer|parent|dog owner|pet owner|runner|trail runner|teacher|realtor|home workout|street|fan|seller|close))/i.test(prompt)) {
    return "ugc-action";
  }
  return "product-display";
}

/** The scene record of a card, taken from the stored image alternative text. */
export function cardScene(card) {
  const alt = tidy(card.alt);
  if (alt) {
    const cleaned = tidy(alt.replace(/\b(?:speaking|talks|talking) (?:naturally |directly )?to camera\b/gi, ""));
    return cleaned.replace(/[.]?$/, ".");
  }
  const prompt = String(card.prompt ?? "");
  const stripped = prompt.replace(TEMPLATE_PREFIX, "").replace(TEMPLATE_SUFFIX, "").trim();
  const kept = dropSentences(sentences(stripped));
  return youToThe(kept.join(" ") || card.label).replace(/[.]?$/, ".");
}

/** The presenter phrase, when the card shows a person. */
export function cardPresenter(card) {
  const alt = tidy(card.alt);
  const match = PRESENTER.exec(alt);
  if (!match) return "";
  const phrase = alt.slice(0, match[0].length).trim();
  return phrase.replace(/^An?\s/, "an ").replace(/^an Adult/, "an adult");
}

/** Content words, used to compare a sentence with the scene record. */
const STOPWORDS = new Set(["a", "an", "the", "and", "or", "of", "in", "on", "at", "to", "with", "is", "are", "it", "its", "as", "by", "for", "from", "that", "this", "his", "her", "their", "be", "so", "up", "out", "into", "over", "while", "no", "not"]);

function contentWords(value) {
  return new Set(key(value).split(" ").filter((word) => word.length > 2 && !STOPWORDS.has(word)));
}

/** How much of a sentence the scene already carries. */
function overlap(sentence, sceneWords) {
  const words = contentWords(sentence);
  if (!words.size || !sceneWords.size) return 0;
  let shared = 0;
  for (const word of words) if (sceneWords.has(word)) shared += 1;
  return shared / words.size;
}

/** The action record of a card, taken from the stored prompt. */
export function cardAction(card, scene, track) {
  const prompt = String(card.prompt ?? "");
  if (!prompt.trim()) return "";
  let parts;
  if (TEMPLATE_PREFIX.test(prompt)) {
    parts = sentences(prompt.replace(TEMPLATE_PREFIX, "").replace(TEMPLATE_SUFFIX, "").trim());
  } else {
    let stripped = prompt;
    for (const pattern of HANDWRITTEN_TAIL) stripped = stripped.replace(pattern, " ");
    parts = sentences(stripped);
  }
  const sceneWords = contentWords(scene);
  const kept = dropSentences(parts)
    .map((part) => youToThe(part))
    .map((part) => part.replace(/^(?:He|She) is /i, ""))
    .map((part) => part.replace(/[.]?$/, "."))
    // A sentence the scene already carries is not written twice.
    .filter((part) => overlap(part, sceneWords) < 0.5)
    // The appearance sentence of a creator card is written once, in the scene.
    .filter((part) => !(track === "ugc-talking" && /^(?:a|an)\s+(?:man|woman)\b/i.test(part)));
  return kept.join(" ").trim();
}

/** The product phrase used by the asset image prompts. */
export function productPhrase(card) {
  const source = `${card.alt ?? ""} ${card.prompt ?? ""}`;
  const plain = /\bplain ([a-z][a-z-]*(?: [a-z][a-z-]*){0,2})/i.exec(source);
  if (plain) return `the ${plain[1].trim()}`;
  const label = String(card.label ?? "").replace(LABEL_ROLE_WORDS, " ").replace(/\s+/g, " ").trim();
  return label ? `the ${label.toLowerCase()}` : "the product";
}

/** The image prompt for a reference photo role. */
export function assetImagePrompt(role, phrase) {
  if (role === "product-back") {
    return `Vertical 9:16 studio product reference photo of ${phrase}, back and side view, the whole item visible and centred, plain seamless light grey background, soft even light with one gentle shadow, sharp focus, no text, no logo, no watermark, no props, photorealistic commercial product photography.`;
  }
  if (role === "product-macro") {
    return `Vertical 9:16 macro detail photo of ${phrase}, close crop on the surface and construction, raking soft light describing the texture, shallow depth of field, plain background, no text, no logo, no watermark, photorealistic macro product photography.`;
  }
  return `Vertical 9:16 reference photo of ${phrase}, the full item visible and centred, plain seamless light grey background, soft even light, sharp focus, no text, no logo, no watermark, photorealistic commercial product photography.`;
}

/** The asset set a template needs, and the image prompt for each new asset. */
export function assetPlan(card) {
  const phrase = productPhrase(card);
  const known = Boolean(card.imageW && card.imageH);
  // Taller than wide is a vertical frame; square or wide frames disagree with
  // a 9:16 template.
  const vertical = known ? card.imageH / card.imageW > 1.15 : false;
  const assets = [
    {
      role: "scene",
      file: card.image ?? "",
      status: !known ? "check" : vertical ? "existing" : "recut",
      why: !known
        ? "The stored preview has no recorded size, so its frame has to be checked before the template is published."
        : vertical
          ? "The scene reference already fits the 9:16 frame and anchors the template preview."
          : "The scene reference is not vertical, so the template preview and the generated frame disagree.",
      phrase
    },
    {
      role: "product-back",
      file: `/ai-image-generation/${card.slug}-a2-back-r1-640.webp`,
      status: "missing",
      why: "One product photo cannot show the back or the label area, so the model invents a second product.",
      phrase
    },
    {
      role: "product-macro",
      file: `/ai-image-generation/${card.slug}-a3-macro-r1-640.webp`,
      status: "missing",
      why: "One product photo cannot hold a true material close-up, so the model invents the surface.",
      phrase
    }
  ];
  return assets;
}
