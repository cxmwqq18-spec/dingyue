// Spec for Aidreamcapes (AIVideosUGC) video detail prompts.
//
// Three sources are combined here:
//
// 1. The Wan3.0 creator manual (3000课程21个skill/Wan3.0视频创作者手册.md).
//    It supplies the multi-shot formula, the timed shot blocks, the 30 second
//    long-form structure and the hard switches. The manual writes a shot
//    block as `镜头1[0-3秒]…`, and the timed block header
//    `【0.0-4.0秒｜标题】`; both are used here in English.
//
// 2. The ecommerce/UGC prompt skill
//    (3000课程21个skill/.agents/skills/ecommerce-ugc-prompt/SKILL.md).
//    It supplies the product lock, the three writing tracks, the shot
//    library, the voice and sound split, the compliance red lines and the
//    delivery checklist.
//
// 3. The platform prompt format (src/lib/video-prompt-format.ts).
//    It supplies the section labels the workspace already understands, the
//    order of those sections, and the validator. "Negative Constraints" is the
//    last section, which is the rule the storefront needs: the negative block
//    always closes the prompt, so a later concatenation step can append a
//    caption, voiceover or extra constraint block after it.
//
// House rules that differ from the sources:
//   - Every storefront template is vertical first, so all tracks run 9:16.
//   - The storefront products are generic and carry no readable packaging
//     text, so the skill rule "spell out readable text" becomes a negative
//     constraint instead of a positive line.
//   - Reference images are described by role in plain English. The platform
//     supplier rule forbids Seedance style @Image/@Video syntax.
//   - Captions, on-screen text and voiceover wording are not decided here.
//     The workspace owns a subtitle switch, and a human decides them later.

export const PROMPT_SPEC_VERSION = "aidreamcapes-video-prompt-spec-v2";
export const TRACK_WAN30 = "wan3.0";
export const ASPECT = "9:16";
export const DEFAULT_DURATION = 30;

export const SECTIONS = [
  "Subject / Character",
  "Action / Motion",
  "Scene / Environment",
  "Camera / Shot / Lens",
  "Lighting / Atmosphere",
  "Style / Mood / Palette",
  "Sound / Audio",
  "Duration / Aspect Ratio / Resolution",
  "Continuity",
  "Negative Constraints"
];

export const NEGATIVE_VISUAL = [
  "no readable text, numbers, symbols, signs, screens or labels anywhere in the frame",
  "no logos, no brand marks, no watermark",
  "no extra, duplicate or swapped products",
  "no distorted hands, extra fingers or warped anatomy",
  "no flicker, colour shift, morphing or shape drift of the product"
];

export const NEGATIVE_COMMERCE = [
  "no price, no discount badge, no promotional graphic, no packaging copy"
];

export const SUBJECT_LOCK = "The uploaded product photo is the only reference for the product. Reproduce it exactly: same shape, proportions, colour, material, surface texture and label area, with nothing added, removed, redesigned or recoloured, and no second product in frame.";

export const LOCK_SENTENCE = "The product's shape, colour, material and label area stay identical in every frame, its quantity never changes, and the hands keep correct anatomy.";

/** The flow rule that keeps the timed shots one continuous film. */
export const FLOW_RULE = "The same hands, room, light direction and screen direction carry from shot to shot, so the cut reads as one continuous action and nothing teleports.";

export const DURATION_SECTION = (duration) => `Use the externally selected duration, aspect ratio and resolution as the highest-priority output settings. Template default when nothing is selected: ${duration} seconds, 9:16 vertical, 1080p.`;

const TRACK_SHOTS = {
  /** E-commerce display track: information first, the product stays readable. */
  "product-display": [
    { title: "Establishing the product", action: "the product sits in place while the shot starts already in motion", camera: "a slow push in", transition: "the push continues into the next shot" },
    { title: "The front face", action: "the product fills the frame as a slow arc brings its front face to the lens", camera: "a gentle arc", transition: "match cut on the product silhouette" },
    { title: "Hands take over", action: "a hand lifts the product and turns it a few degrees so a second side comes into view, the grip relaxed and correct", camera: "a close-up, the hand in frame", transition: "the same hand carries the movement into the next shot" },
    { title: "Material close-up", action: "a macro of the surface, the light describing the material instead of an adjective", camera: "a macro, shallow focus", transition: "pull back along the same axis" },
    { title: "Closing hold", action: "the product returns to the centre, fully visible, and holds still for a beat", camera: "locked off", transition: "none, the film ends on this frame" }
  ],
  /** UGC action track: the action carries the message, with one clumsy detail. */
  "ugc-action": [
    { title: "Hook", action: "the product is brought into frame in a real room, the movement already in progress", camera: "handheld", transition: "the same hands continue into the next shot" },
    { title: "Real use", action: "the product is used once, in one real and slightly imperfect motion, with one small clumsy detail", camera: "handheld, following the hands", transition: "the grip and the eyeline stay continuous" },
    { title: "Visible result", action: "a close-up of the surface and of the result the motion produced, with no claim attached", camera: "a close insert", transition: "match cut on the hand position" },
    { title: "Second angle", action: "the same hands repeat the use from a slightly different angle, in the same room and the same light", camera: "handheld, one reframe", transition: "the movement eases out" },
    { title: "Settle", action: "the product rests back in frame and the movement slows to a stop", camera: "handheld, settling", transition: "none" }
  ],
  /** UGC talking track: creator to camera, the product shown while speaking. */
  "ugc-talking": [
    { title: "Presenter to camera", action: "the presenter is already talking when the shot starts, the product in their hand", camera: "handheld, gentle sway", transition: "the eyeline stays on the lens" },
    { title: "Show the product", action: "the product is lifted closer to the lens and turned a few degrees while the presenter keeps talking", camera: "handheld, a slight push in", transition: "the hand stays in frame" },
    { title: "Detail under the voice", action: "the camera drops to a macro of the product surface while the voice continues over it", camera: "a macro, rack focus", transition: "the camera rises back along the same path" },
    { title: "Back to the presenter", action: "the same eyeline and the same light, the product still in frame", camera: "matching the first shot", transition: "the framing matches, so the cut stays invisible" },
    { title: "Close", action: "the presenter finishes the line and the shot settles with the product still visible", camera: "a slow pull back", transition: "none" }
  ],
  /** Brand texture track: material and shape, no information load. */
  "brand-texture": [
    { title: "Light across the surface", action: "the product rests while the key light travels across its surface", camera: "a slow drift", transition: "the light movement continues" },
    { title: "Into the material", action: "the camera moves in until the material fills the frame", camera: "an 85mm push in", transition: "the push continues" },
    { title: "Outline revealed", action: "a slow arc separates the product outline from the background", camera: "an arc", transition: "the arc ends on the same side" },
    { title: "Same light", action: "the camera returns to the opening light and the product holds", camera: "a pull back", transition: "none" }
  ]
};

const TRACK_PARTS = {
  "product-display": {
    camera: "The camera moves on one axis only: a slow push in from 35mm to 50mm, a gentle arc, a locked hold and a 100mm macro. Every shot keeps the same light direction and the same screen direction, and no shot invents a new angle that the product photo does not support.",
    lighting: "Soft product light from a large window at the left, one warm bounce from the right, a gentle shadow under the product, no hard strobe.",
    style: "E-commerce product display style, warm lifestyle tone, natural colour, clean separation from the background, shallow depth of field.",
    sound: "Voice: no spoken dialogue. Effects: product handling sound, a light surface rustle, quiet room tone. BGM: light modern retail bed, low, instrumental, no vocals.",
    environment: "The background stays soft and out of focus, the light on the product stays controlled, and the surrounding place never competes with the product.",
    extraNegative: NEGATIVE_COMMERCE
  },
  "ugc-action": {
    camera: "The camera moves handheld at 26mm and 35mm, with gentle breathing sway, one reframe and one short focus hunt that recovers. No shot invents a new angle that the product photo does not support.",
    lighting: "Natural window light or a modest ring light, accurate product shade and skin texture.",
    style: "Vertical UGC in a believable room, minor recording imperfections, natural colour.",
    sound: "Voice: no spoken dialogue. Effects: handling and packaging sound with room tone. BGM: none.",
    environment: "A believable place with a real work surface, natural light from one side and everyday objects in the background.",
    extraNegative: []
  },
  "ugc-talking": {
    camera: "The camera moves handheld at 35mm and 85mm, at about one arm's length, with one short focus hunt that recovers. No shot invents a new angle that the product photo does not support.",
    lighting: "Window light only, uneven brightness across the face, a warm bounce from the wall, no studio lighting.",
    style: "Vertical UGC selfie in a real room, ordinary objects in the background, natural colour, visible skin texture, minor recording imperfections.",
    sound: "Voice: the presenter talks straight to the lens in a relaxed delivery, one short statement, with natural pauses and breaths. Effects: close handling sound and room tone. BGM: none.",
    environment: "A real place with natural light from one side, a plain surface behind, and ordinary objects in the background.",
    extraNegative: []
  },
  "brand-texture": {
    camera: "The camera moves on one axis only: a slow drift at 50mm, an 85mm push in and one arc, ending on the same side. No shot invents a new angle that the product photo does not support.",
    lighting: "One controlled key light raking across the surface, a cool rim separating the outline, deep shadow falling away from the product.",
    style: "Premium product film, restrained palette drawn from the product, quiet negative space, no gloss exaggeration.",
    sound: "Voice: no spoken dialogue. Effects: a quiet room tone and one soft handling sound. BGM: minimal ambient bed, low, instrumental, no vocals.",
    environment: "A quiet place with a plain background behind the product and one controlled light source.",
    extraNegative: []
  }
};

/** Shot window anchors, as a share of the total duration. */
const WINDOW_ANCHORS = {
  4: [0, 0.27, 0.53, 0.8, 1],
  5: [0, 0.2, 0.43, 0.67, 0.87, 1]
};

/** Timed shot windows for a track and a duration. */
export function shotWindows(track, duration) {
  const shots = TRACK_SHOTS[track];
  const anchors = WINDOW_ANCHORS[shots.length] ?? WINDOW_ANCHORS[5];
  const total = Math.max(6, Math.min(30, Number(duration) || DEFAULT_DURATION));
  return shots.map((shot, index) => {
    const from = Math.round(anchors[index] * total * 10) / 10;
    const to = Math.round(anchors[index + 1] * total * 10) / 10;
    return { shot, from, to };
  });
}

/** Build the final prompt. The negative section is always the last block. */
export function composePrompt({ track, scene, action, presenter, duration = DEFAULT_DURATION }) {
  const parts = TRACK_PARTS[track];
  const windows = shotWindows(track, duration);
  const subject = presenter
    ? `${SUBJECT_LOCK} ${presenter.charAt(0).toUpperCase()}${presenter.slice(1)} presents the product on camera; keep the presenter generic rather than tied to one specific person.`
    : SUBJECT_LOCK;
  const logic = action
    ? `Film logic: ${action} Every shot is part of this one action.`
    : "Film logic: the product is used exactly as the reference scene shows, in one continuous action. Every shot is part of it.";
  const shots = windows.map(({ shot, from, to }, index) =>
    `Shot ${index + 1} [${from.toFixed(1)}-${to.toFixed(1)}s] | ${shot.title}: ${shot.action}. Camera: ${shot.camera}. Transition: ${shot.transition}.`
  ).join("\n");
  const sections = {
    "Subject / Character": subject,
    "Action / Motion": `${logic}\n${shots}`,
    "Scene / Environment": `${scene} ${parts.environment}`,
    "Camera / Shot / Lens": parts.camera,
    "Lighting / Atmosphere": parts.lighting,
    "Style / Mood / Palette": parts.style,
    "Sound / Audio": parts.sound,
    "Duration / Aspect Ratio / Resolution": DURATION_SECTION(duration),
    "Continuity": `${LOCK_SENTENCE} ${FLOW_RULE} Final frame: the product centred, fully visible, unchanged from the first frame.`,
    "Negative Constraints": [...NEGATIVE_VISUAL, ...parts.extraNegative].join("; ") + "."
  };
  return SECTIONS.map((label) => `${label}: ${sections[label]}`).join("\n\n");
}
