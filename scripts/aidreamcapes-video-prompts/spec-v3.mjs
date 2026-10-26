// Wan3.0 prompt structure for Aidreamcapes video templates.
//
// The structure follows the Wan3.0 creator manual:
//
//   生成一支约30秒、9:16竖版的高质感电商产品短片。          <- opening sentence
//   图1 @Image1 作为商品唯一外观参考；…                    <- reference binding
//   【整体风格】                                           <- overall style
//   【角色动作逻辑】                                        <- action logic
//   【0.0-4.0秒｜城市穿梭与女子登场】                       <- timed beats
//   【运镜要求】                                           <- camera rules
//   【负面限制】                                           <- negatives, always last
//
// The content follows the ecommerce/UGC prompt skill:
//
//   - 电商展示轨 (9:16, 10-30s): 远景陈列 → 正面特写 → 手入画翻背面 → 使用 → 卖点收尾
//   - UGC 真人轨 (9:16, 15s):    0-3 钩子 → 3-8 演示 → 8-12 证据 → 12-15 收口
//   - 品牌质感轨 (10-15s):        氛围 → 使用瞬间 → 材质微距 → 定格
//   - 口播五段: 钩子 / 痛点 / 演示 / 证据 / 收口, one short line per beat
//   - 声音公式: 人声 + 音效 + 背景音乐, written as three independent lines
//
// House rules:
//   - English only, 9:16 vertical, Wan3.0 model.
//   - Reference images are described by role; no @Image syntax.
//   - The templates are unbranded, so "readable text" becomes a negative
//     constraint instead of a positive beat.
//   - Captions and subtitles are the workspace's switch and a human decision,
//     so no prompt mentions them.
//   - The negative block is the last block, so a later step can append after it.

export const PROMPT_SPEC_VERSION = "aidreamcapes-video-prompt-spec-v3";
export const PROMPT_FORMAT = "wan3.0-blocks";
export const MODEL = "Wan3.0";
export const ASPECT = "9:16";
export const MAX_LENGTH = 3980;

/**
 * Template length per track, from the skill's own table:
 * the e-commerce display track runs 10-30 seconds, the UGC track 15 seconds,
 * the brand texture track 10-15 seconds. The workspace still offers 15 and 30
 * to the customer; this is only the length the beats are written for.
 */
export const TRACK_DURATION = {
  "product-display": 30,
  "ugc-action": 15,
  "ugc-talking": 15,
  "brand-texture": 15
};

/** Timed beat windows, in seconds, per track. */
const WINDOWS = {
  "product-display": [0, 5, 11, 17, 23, 27.5, 30],
  "ugc-action": [0, 3, 8, 12, 15],
  "ugc-talking": [0, 3, 8, 12, 15],
  "brand-texture": [0, 4, 8, 12, 15]
};

const GENRE = {
  "product-display": "e-commerce product display film",
  "ugc-action": "UGC creator demo",
  "ugc-talking": "UGC creator talk-to-camera",
  "brand-texture": "premium product texture film"
};

const STYLE = {
  "product-display": "E-commerce product display style, warm lifestyle tone, natural colour, the product clearly separated from the background. Information first: every beat adds a new angle or a new piece of the action.",
  "ugc-action": "Believable vertical UGC in a real room: handheld, slightly uneven window light, ordinary objects in the background, visible skin texture, one clumsy moment left in on purpose. Not a studio commercial, not a polished advert.",
  "ugc-talking": "Believable vertical UGC talk-to-camera in a real room: handheld at about one arm's length, window light only, brightness uneven across the face, ordinary objects behind, visible skin texture, one short focus hunt that recovers. Not an advert, not a studio set.",
  "brand-texture": "Premium product film, restrained palette taken from the product, quiet negative space, one controlled light source, no gloss exaggeration."
};

const CAMERA = {
  "product-display": "Controlled movement that serves the information: one slow push in, one gentle arc, one close follow of the hands and one locked hold. Every beat keeps the same light direction and the same screen direction, so the cuts read as one continuous action, and no beat invents an angle the product photo does not support.",
  "ugc-action": "Handheld at 26mm and 35mm, about one arm's length, gentle breathing sway, one reframe and one short focus hunt that recovers. The camera follows the hands and never leaves the product for long. The six rules of the track: handheld distance, window light with an uneven side, a real room with clutter allowed, a performance that may stumble, skin you can see, and one or two jump cuts that feel hand-edited.",
  "ugc-talking": "Handheld at 35mm and 85mm, about one arm's length, gentle sway, one short focus hunt that recovers, one small push in when the presenter leans forward. The presenter keeps the same eyeline and the same framing across the cuts.",
  "brand-texture": "Slow drift at 50mm, one 85mm push in and one arc that ends on the same side, all on one axis. No handheld, no whip pan, no speed ramp."
};

const LIGHT = {
  "product-display": "Soft product light from one large source at the left, one warm bounce from the right, a gentle shadow under the product, no hard strobe.",
  "ugc-action": "Window light or one modest lamp, uneven across the frame, warm bounce from the wall behind, no studio lighting.",
  "ugc-talking": "Window light only, brightness uneven across the face, warm bounce from the wall, no fill light.",
  "brand-texture": "One controlled key light raking across the surface, a cool rim separating the outline, deep shadow falling away from the product."
};

const NEGATIVE_BASE = [
  "no readable text, numbers, signs or labels anywhere in the frame",
  "no logos, brand marks or watermark",
  "no extra or swapped product and no changed parts",
  "no distorted hands or warped anatomy",
  "no flicker, colour shift or shape drift of the product",
  "no price, discount badge or promotional graphic"
];

const NEGATIVE_TRACK = {
  "product-display": ["no slow motion, no speed ramp, no lens flare"],
  "ugc-action": ["no studio lighting, no perfect skin, no presenter tone, no transition effect"],
  "ugc-talking": ["no studio lighting, no teleprompter delivery, no shouted sales line"],
  "brand-texture": ["no handheld shake, no fast cut, no lens flare, no invented surface"]
};

const round = (value) => Math.round(value * 10) / 10;
const cap = (value) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : value);
const article = (phrase) => (/^[aeiou]/i.test(phrase) ? "an" : "a");

/** Split the scene into the place and the rest of the tail. */
function placeOf(facts) {
  return facts.settingShort || "in a real room";
}

/** "the full-size bicycle", or "the product" when the card names none. */
function the(facts) {
  return facts.product ? `the ${facts.product}` : "the product";
}

/** "a full-size bicycle", or "the product" when the card names none. */
function aProduct(facts) {
  return facts.product ? `${article(facts.product)} ${facts.product}` : "the product";
}

/**
 * Present tense for the participles the scene lines use: "holding" becomes
 * "holds". A small table covers the corpus; anything else keeps the neutral
 * wording instead of inventing a conjugation.
 */
const THIRD_PERSON = {
  holding: "holds", using: "uses", applying: "applies", opening: "opens", packing: "packs",
  resting: "rests", lifting: "lifts", clipping: "clips", folding: "folds", pressing: "presses",
  pouring: "pours", cutting: "cuts", wrapping: "wraps", wearing: "wears", trying: "tries",
  showing: "shows", taking: "takes", giving: "gives", placing: "places", setting: "sets",
  filling: "fills", mixing: "mixes", drinking: "drinks", eating: "eats", standing: "stands",
  sitting: "sits", walking: "walks", speaking: "speaks", reviewing: "reviews", presenting: "presents",
  unboxing: "unboxes", testing: "tests", cleaning: "cleans", wiping: "wipes", hanging: "hangs",
  sliding: "slides", turning: "turns", twisting: "twists", carrying: "carries", pushing: "pushes",
  pulling: "pulls", unzipping: "unzips", zipping: "zips", screwing: "screws", tapping: "taps",
  typing: "types", stirring: "stirs", spreading: "spreads", spraying: "sprays", brushing: "brushes",
  rolling: "rolls", stacking: "stacks", arranging: "arranges", assembling: "assembles"
};

/**
 * The action sentence. A scene line that already reads as a sentence is reused
 * as it is; a fragment ("Adult holding a …") is turned into one.
 */
function actionSentence(facts) {
  const scene = String(facts.scene ?? "")
    .replace(/\b(?:smooth\s+)?(?:plain|generic)\s+/gi, "")
    .replace(/\.$/, "")
    .trim();
  const place = facts.settingShort ? ` ${facts.settingPrep} ${facts.settingShort}` : "";
  if (facts.verb && /ing$/i.test(facts.verb)) {
    const third = THIRD_PERSON[facts.verb.toLowerCase()];
    if (third) return `${cap(facts.subjectRole || "the creator")} ${third} ${the(facts)}${place}.`;
  }
  if (scene) return `${cap(scene)}.`;
  return `${cap(the(facts))} is used once, in one continuous action.`;
}

/** A short spoken form of the action: "The commuter folds it beside a train platform." */
function voiceAction(facts) {
  const place = facts.settingShort ? ` ${facts.settingPrep} ${facts.settingShort}` : "";
  if (!facts.verb) return `This is ${the(facts)} in one movement.`;
  if (facts.subjectRole && !/(?:ed|ing)$/i.test(facts.verb)) return `The ${facts.subjectRole} ${facts.verb} it${place}.`;
  if (/ing$/i.test(facts.verb)) {
    const third = THIRD_PERSON[facts.verb.toLowerCase()];
    if (third) return `The ${facts.subjectRole || "creator"} ${third} it${place}.`;
    return `This is ${the(facts)}${place}.`;
  }
  if (/ed$/i.test(facts.verb)) return `It is ${facts.verb}${place}.`;
  return `It ${facts.verb}${place}.`;
}

function traitLine(facts) {
  return facts.trait ? `${cap(facts.trait)}.` : "";
}

/**
 * The five voiceover lines of the skill: hook, point, demo, evidence, close.
 * Every line is built from the card's own facts; nothing is claimed.
 */
function voiceLines(track, facts) {
  const product = facts.product;
  const place = placeOf(facts);
  const trait = traitLine(facts);
  if (track === "product-display") {
    return [
      `${cap(article(product))} ${product}, ${facts.settingPrep} ${place}.`,
      voiceAction(facts),
      "The hands do the work, one movement at a time.",
      trait || "The same product from every angle.",
      "One action, start to finish."
    ];
  }
  if (track === "ugc-action") {
    return [
      `Can a ${product} actually work ${facts.settingPrep} ${place}?`,
      voiceAction(facts),
      "This is the clumsy part, every time.",
      trait || "Look at the surface, not the sales line.",
      "That is how I use it now."
    ];
  }
  if (track === "ugc-talking") {
    return [
      `Quick one about this ${facts.colour ? `${facts.colour} ` : ""}${product}.`,
      `Here is what it does ${facts.settingPrep} ${place}.`,
      "Look at this part with me.",
      trait || "Same product, same finish, every angle.",
      "That is the whole thing."
    ];
  }
  return [];
}

function voiceSection(track, facts) {
  const lines = voiceLines(track, facts);
  if (!lines.length) {
    return "Voice: no spoken dialogue in this film; the track carries the mood, not a claim.";
  }
  const delivery = track === "product-display"
    ? "a calm adult voice, mid-range, neutral accent, unhurried pace"
    : track === "ugc-talking"
      ? "the presenter's own voice, conversational pace, natural pauses and breaths"
      : "the creator's own voice, casual and close to the lens, one stumble allowed";
  const spoken = lines.map((line) => `"${line.replace(/\.$/, "")}"`).join(" / ");
  return `Voice: ${delivery}, five short lines across the film — ${spoken}.`;
}

function effectsSection(track) {
  return track === "product-display"
    ? "Effects: the handling sounds of the product, one surface rustle, the room tone."
    : track === "brand-texture"
      ? "Effects: a quiet room tone and one soft handling sound."
      : "Effects: handling and fabric sounds close to the camera, the room tone of the place.";
}

function bgmSection(track) {
  return track === "product-display"
    ? "BGM: a light modern retail bed, low, instrumental, no vocals."
    : track === "brand-texture"
      ? "BGM: a minimal ambient bed, low, instrumental, no vocals."
      : "BGM: none. The room tone and the voice carry the film.";
}

/** Timed beats for a track. */
function beats(track, facts) {
  const windows = WINDOWS[track];
  const product = the(facts);
  const place = placeOf(facts);
  const trait = facts.trait;
  const list = [];
  const push = (title, body) => {
    const index = list.length;
    list.push({ from: round(windows[index]), to: round(windows[index + 1]), title, body });
  };

  if (track === "product-display") {
    push("Wide display", `Wide shot at eye level: ${facts.subject ? `${article(facts.subject.toLowerCase())} ${facts.subject.toLowerCase()} stands with ${product}` : `${product} is set in place`} ${facts.settingPrep} ${place}, the whole shape readable against the background. Camera pushes in slowly from 35mm to 50mm, and the lines of the place keep their screen direction.`);
    push("Front close-up", `The front of ${product} fills the frame, the whole silhouette readable, and the light rakes across the surface so the material reads instead of being described. Camera arcs gently.${trait ? ` Visible here: ${trait}.` : ""}`);
    push("Hand turns it", `A hand enters from the top, lifts ${product} a little and turns it so the back and the far side come into view, then turns it back to the front. The grip stays relaxed and anatomically correct, and the product never leaves the frame.`);
    push("The action", `${actionSentence(facts)} Camera follows the hands closely with one small reframe and no cut, so the action reads as one movement.`);
    push("Point held", `The result of that action is held still in the frame: the same ${facts.product}, now in the state the action produced. The point is shown rather than claimed — no superimposed words, no price, no badge.`);
    push("Closing hold", `The product returns to a full front view, centred and complete. Camera locks off, and the last frame matches the first frame.`);
  } else if (track === "ugc-action") {
    push("Hook", `Handheld close, half a face entering the frame ${facts.settingPrep} ${place}: the creator asks one short question to the lens before ${product} is fully shown. The movement is already in progress when the shot starts.`);
    push("Demo", `${actionSentence(facts)} One real, slightly imperfect motion, with one small clumsy detail left in on purpose; the camera follows the hands.`);
    push("Evidence", `A close insert on the surface and on the result the motion produced: no claim, only what the frame shows.${trait ? ` Visible here: ${trait}.` : ""}`);
    push("Close", `The creator comes back to the lens with ${product} still in frame and says one natural line. No slogan, no call to action, no price.`);
  } else if (track === "ugc-talking") {
    push("Hook", `Handheld close on the creator at about one arm's length, already talking, ${product} held in one hand ${facts.settingPrep} ${place}.`);
    push("Show", `The creator lifts ${product} closer to the lens and turns it a few degrees while still talking; one small push in.`);
    push("Evidence", `The camera drops to a close insert on the surface while the voice continues over it, then rises back along the same path.${trait ? ` Visible here: ${trait}.` : ""}`);
    push("Close", `The same eyeline, the same light, ${product} still in frame; the creator finishes the line and the shot settles.`);
  } else {
    push("Ambience", `${cap(product)} at rest ${facts.settingPrep} ${place}, the key light travelling across its surface. Camera drifts slowly.`);
    push("Use moment", facts.person
      ? `${actionSentence(facts)} Camera moves with the hands, no cut.`
      : `The product turns slowly where it stands, the light crossing the surface as it moves. Camera moves with it, no cut.`);
    push("Material", `A macro of the material where the light reacts with it: the surface described by what the light does, not by an adjective.${trait ? ` Visible here: ${trait}.` : ""}`);
    push("Hold", `${cap(product)} returns to the opening light, centred and complete. Camera pulls back and holds.`);
  }
  return list;
}

function block(title, body) {
  return `【${title}】${body}`;
}

/**
 * Talking cards without a product (greetings, updates, mirror checks) are a
 * creator video, not a product demo. Nothing is claimed about a product that
 * the card does not have.
 */
function composePresenterPrompt({ facts, duration }) {
  const place = facts.settingShort ? `${facts.settingPrep} ${facts.settingShort}` : "in a real room";
  const scene = String(facts.scene ?? "")
    .replace(/\b(?:smooth\s+)?(?:plain|generic)\s+/gi, "")
    .replace(/\.$/, "")
    .trim();
  const lines = [
    "Quick one before I head out.",
    "Here is how it actually looks today.",
    "Same light, same spot, no filter.",
    "That is the whole update."
  ];
  return [
    `A ${duration}-second vertical 9:16 UGC creator video of one presenter talking to camera ${place}.`,
    "",
    block("Reference", "The uploaded photo is the only reference for the presenter and the place. Keep the same face, hair, skin tone, build, clothing and the same room in every frame, and never swap the person or the location."),
    block("Overall Style", STYLE["ugc-talking"]),
    block("Subject Lock", "The same person from the first frame to the last: same face, same hair, same clothing, same skin tone, same room. No face swap, no change of clothing, no new location."),
    block("Action Logic", `${scene ? `${cap(scene)}. ` : ""}One continuous take of the person talking; the only movement is natural posture, breathing and small hand gestures.`),
    block(`0.0-3.0s | Hook`, `Handheld close at about one arm's length, the presenter already talking to the lens, half a gesture in progress when the shot starts.`),
    block(`3.0-8.0s | Talk`, `The presenter keeps talking with a small natural gesture and one glance away, then back to the lens; one slight reframe.`),
    block(`8.0-12.0s | Insert`, `A short insert on the surroundings at the same light — hands, the surface in front of the presenter, the space behind — then back along the same path.`),
    block(`12.0-15.0s | Close`, `The presenter finishes the line, looks to the lens and settles; the framing does not change.`),
    block("Camera", CAMERA["ugc-talking"]),
    block("Sound", `Voice: the presenter's own voice, conversational pace, natural pauses and breaths, four short lines across the film — ${lines.map((line) => `"${line.replace(/\.$/, "")}"`).join(" / ")}. Effects: the room tone of the place and one clothing rustle. BGM: none.`),
    block("Continuity", "The same person, the same clothing and the same room from the first frame to the last; the same light direction and screen direction carry between beats, so nothing teleports. Final frame: the presenter still framed the same way, unchanged from the first frame."),
    block("Negative", [...NEGATIVE_BASE, ...(NEGATIVE_TRACK["ugc-talking"] ?? [])].join("; ") + ".")
  ].join("\n");
}

/** Build the prompt. The negative block is always last. */
export function composePromptV3({ track, facts }) {
  const duration = TRACK_DURATION[track] ?? 15;
  if (track === "ugc-talking" && !facts.product) return clampPrompt(composePresenterPrompt({ facts, duration }));
  const lines = [
    `A ${duration}-second vertical 9:16 ${GENRE[track]} for ${aProduct(facts)}${facts.settingShort ? ` ${facts.settingPrep} ${facts.settingShort}` : ""}.`,
    "",
    block("Reference", `The uploaded product photo is the only product reference. Reproduce ${the(facts)} exactly — same shape, proportions, colour, material, finish and details — and never show a second one or a changed part.`),
    block("Overall Style", track === "ugc-action" || track === "ugc-talking" ? STYLE[track] : `${STYLE[track]} ${LIGHT[track]}`),
    block("Product Lock", `${cap(the(facts))} keeps the same shape, colour, material, finish and details in every frame${facts.trait ? `, including ${facts.trait}` : ""}; nothing is added, removed or recoloured and the quantity never changes.`),
    block("Action Logic", "One real action, followed from start to finish in one place, with the product never leaving the frame. Each beat is a step of that action, and no beat invents a different event, a different place or a second product.")
  ];
  for (const beat of beats(track, facts)) {
    lines.push(block(`${beat.from.toFixed(1)}-${beat.to.toFixed(1)}s | ${beat.title}`, beat.body));
  }
  lines.push(block("Camera", CAMERA[track]));
  lines.push(block("Sound", `${voiceSection(track, facts)} ${effectsSection(track)} ${bgmSection(track)}`));
  lines.push(block("Continuity", `${cap(the(facts))} stays identical from the first frame to the last, the hands keep correct anatomy, and the same light and screen direction carry between beats, so nothing teleports. Final frame: the product centred and unchanged from the first frame.`));
  lines.push(block("Negative", [...NEGATIVE_BASE, ...(NEGATIVE_TRACK[track] ?? [])].join("; ") + "."));
  return lines.join("\n");
}

/**
 * Rewrite a prompt that overruns the workspace limit by trimming the two
 * descriptive blocks first, then the longest beat.
 */
export function clampPrompt(prompt) {
  if (prompt.length <= MAX_LENGTH) return prompt;
  let text = prompt;
  const shrink = (pattern, replacement) => { text = text.replace(pattern, replacement); };
  // Trim the descriptive tail first, so the light, the beats and the negative
  // block survive intact.
  shrink(/【Camera】[^\n]*/, "【Camera】Controlled movement only: one slow push in, one gentle arc, one close follow and one locked hold, all keeping the same light direction and screen direction.");
  if (text.length <= MAX_LENGTH) return text;
  shrink(/【Continuity】[^\n]*/, "【Continuity】The product stays identical from the first to the last frame, the hands keep correct anatomy, and the same light and screen direction carry between beats. Final frame: the product centred and unchanged from the first frame.");
  if (text.length <= MAX_LENGTH) return text;
  const blocks = text.split("\n");
  while (text.length > MAX_LENGTH && blocks.length) {
    const longest = blocks.reduce((best, line, index) => (line.length > blocks[best].length ? index : best), 0);
    if (longest === 0) break;
    blocks[longest] = `${blocks[longest].slice(0, Math.max(120, blocks[longest].length - 120)).replace(/[ ,;:]$/, "")}…`;
    text = blocks.join("\n");
  }
  return text;
}
