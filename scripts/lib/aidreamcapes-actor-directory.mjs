// Derived AI-actor directory for site_aidreamcapes: /ai-actors/scene…, /ai-actors/men…,
// /ai-actors/women…, /ai-actors/age-range… category pages plus one canonical detail
// page per actor under their gender folder. Everything is generated in memory from the
// ai-actors source content; master.json, the media plan and the content map are extended
// by withAidreamcapesActorDirectorySource() and never written back to disk.
//
// Copy rules (re-checked by validateSiteV2):
// - client-facing copy only; generation internals (action/ambient/prompt) never render,
// - titles at most 60 characters, descriptions 140-160, every title/description/h1 unique,
// - no banned wording; the demo line an actor says already ships inside the workspace.
import assert from "node:assert/strict";

export const AIDREAMCAPES_ACTORS_ROOT = "/ai-actors";
export const AIDREAMCAPES_ACTOR_SCENE_DIRECTORY = "/ai-actors/scene";
export const AIDREAMCAPES_ACTOR_AGE_DIRECTORY = "/ai-actors/age-range";
export const AIDREAMCAPES_ACTOR_GENDER_DIRECTORY = { Men: "/ai-actors/men", Women: "/ai-actors/women" };

export const AIDREAMCAPES_ACTOR_DIRECTORY_KIND = {
  sceneHub: "ai-actors-scene-hub",
  scene: "ai-actors-scene",
  ageHub: "ai-actors-age-hub",
  age: "ai-actors-age",
  gender: "ai-actors-gender",
  detail: "ai-actors-detail"
};
export const AIDREAMCAPES_ACTOR_DIRECTORY_KINDS = new Set(Object.values(AIDREAMCAPES_ACTOR_DIRECTORY_KIND));
export const isAidreamcapesActorDirectoryKind = (value) => AIDREAMCAPES_ACTOR_DIRECTORY_KINDS.has(String(value ?? ""));
export const AIDREAMCAPES_ACTOR_CATEGORY_KINDS = new Set([
  AIDREAMCAPES_ACTOR_DIRECTORY_KIND.scene,
  AIDREAMCAPES_ACTOR_DIRECTORY_KIND.gender,
  AIDREAMCAPES_ACTOR_DIRECTORY_KIND.age
]);

// A short setting phrase per scene: "presents from a kitchen counter scene". Written as
// customer-facing copy; the scene names come from the ai-actors content file itself.
export const AIDREAMCAPES_ACTOR_SCENE_SETTINGS = {
  Indoor: "an indoor doorway scene",
  Home: "a home living space",
  Outdoor: "an outdoor city scene",
  "Living Room": "a living-room couch scene",
  Studio: "a studio recording desk",
  Office: "an office desk scene",
  Garden: "a backyard garden",
  Gym: "a gym training area",
  Cafe: "a cafe table scene",
  Kitchen: "a kitchen counter scene",
  Podcast: "a podcast recording corner",
  Fitness: "a fitness training space",
  Beach: "a beach shoreline scene",
  Car: "a parked car seat",
  Hospital: "a hospital or clinic corridor",
  Balcony: "an open-air balcony",
  Pet: "an at-home pet scene",
  Shopping: "a retail shopping aisle",
  Sports: "a playing court or field",
  "Study Room": "a study desk",
  Classroom: "a classroom scene",
  Terrace: "a rooftop terrace",
  Bathroom: "a bathroom counter scene",
  Exercise: "an outdoor exercise scene",
  Bedroom: "a bedroom morning routine",
  Garage: "a home garage workshop",
  Interview: "a street interview scene",
  Pool: "a sunny poolside scene",
  Reporting: "a reporter-style city scene",
  Travel: "an airplane cabin seat",
  Yoga: "a yoga studio mat"
};

// Short scene word for phrases like "an indoor AI actor". Hand-written so the article is right.
const AIDREAMCAPES_ACTOR_SCENE_WORDS = {
  Indoor: "indoor",
  Home: "home",
  Outdoor: "outdoor",
  "Living Room": "living-room",
  Studio: "studio",
  Office: "office",
  Garden: "garden",
  Gym: "gym",
  Cafe: "cafe",
  Kitchen: "kitchen",
  Podcast: "podcast",
  Fitness: "fitness",
  Beach: "beach",
  Car: "car",
  Hospital: "hospital",
  Balcony: "balcony",
  Pet: "pet",
  Shopping: "shopping",
  Sports: "sports",
  "Study Room": "study-room",
  Classroom: "classroom",
  Terrace: "terrace",
  Bathroom: "bathroom",
  Exercise: "exercise",
  Bedroom: "bedroom",
  Garage: "garage",
  Interview: "street-interview",
  Pool: "poolside",
  Reporting: "news-report",
  Travel: "in-flight",
  Yoga: "yoga"
};

// Age ranges in source order, each with their customer copy. The label matches the actor.age value.
export const AIDREAMCAPES_ACTOR_AGE_RANGES = [
  { slug: "20s", label: "20s", word: "twenties", title: "AI Actors in Their 20s for Product Ads | AIVideosUGC", h1: "AI Actors in Their 20s" },
  { slug: "30s", label: "30s", word: "thirties", title: "AI Actors in Their 30s for Product Ads | AIVideosUGC", h1: "AI Actors in Their 30s" },
  { slug: "40s", label: "40s", word: "forties", title: "AI Actors in Their 40s for Product Ads | AIVideosUGC", h1: "AI Actors in Their 40s" },
  { slug: "50s", label: "50s", word: "fifties", title: "AI Actors in Their 50s for Product Ads | AIVideosUGC", h1: "AI Actors in Their 50s" },
  { slug: "60s-plus", label: "60s+", word: "sixties and older", title: "AI Actors Aged 60 Plus for Product Ads | AIVideosUGC", h1: "AI Actors Aged 60 and Up" }
];

export const AIDREAMCAPES_ACTOR_GENDERS = [
  { slug: "women", label: "Women", title: "Women AI Actors for Product Ads | AIVideosUGC", h1: "Women AI Actors" },
  { slug: "men", label: "Men", title: "Men AI Actors for Product Ads | AIVideosUGC", h1: "Men AI Actors" }
];

const IMAGE_KEY = "presenter-r2";

const slugify = (value) => String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export const aidreamcapesActorSceneSlug = (scene) => slugify(scene);
export const aidreamcapesActorScenePageId = (scene) => `ai-actors-scene-${aidreamcapesActorSceneSlug(scene)}`;
export const aidreamcapesActorSceneHref = (scene) => `${AIDREAMCAPES_ACTOR_SCENE_DIRECTORY}/${aidreamcapesActorSceneSlug(scene)}`;
export const aidreamcapesActorAgeRange = (age) => AIDREAMCAPES_ACTOR_AGE_RANGES.find((range) => range.label === age);
export const aidreamcapesActorAgePageId = (range) => `ai-actors-age-range-${range.slug}`;
export const aidreamcapesActorAgeHref = (rangeOrSlug) => `${AIDREAMCAPES_ACTOR_AGE_DIRECTORY}/${
  typeof rangeOrSlug === "string" ? rangeOrSlug : rangeOrSlug.slug
}`;
export const aidreamcapesActorGenderPageKey = (gender) => {
  const entry = AIDREAMCAPES_ACTOR_GENDERS.find((candidate) => candidate.label === gender);
  assert.ok(entry, `unknown actor gender ${gender}`);
  return entry.slug;
};
export const aidreamcapesActorGenderPageId = (gender) => `ai-actors-${aidreamcapesActorGenderPageKey(gender)}`;
export const aidreamcapesActorGenderPageHref = (gender) => AIDREAMCAPES_ACTOR_GENDER_DIRECTORY[gender];
export const aidreamcapesActorDetailPageId = (actor) => `ai-actors-${aidreamcapesActorGenderPageKey(actor.gender)}-${slugify(actor.name)}`;
export const aidreamcapesActorDetailHref = (actor) => `${AIDREAMCAPES_ACTOR_GENDER_DIRECTORY[actor.gender]}/${slugify(actor.name)}`;
export const aidreamcapesActorDetailSlugFor = (actor) => slugify(actor.name);

const article = (word) => (/^[aeiou]/i.test(String(word)) ? "an" : "a");
const lowerFirst = (value) => String(value ?? "").replace(/^./, (letter) => letter.toLowerCase());
const pluralizeScenes = (count) => `${count} scene${count === 1 ? "" : "s"}`;

// A length picker keeps every generated description inside the site SEO range without
// hand-tuning 93 strings. Heads may be a single string or a ladder of variants, longest
// first; the first (head, closer) pair inside 140-160 wins, so most pages keep their
// richest wording and only unusually long names/talents fall back to a shorter variant.
const descriptionInRange = (heads, closers, where) => {
  const headList = (Array.isArray(heads) ? heads : [heads]).filter(Boolean);
  for (const head of headList) {
    for (const closer of closers) {
      const value = `${head}${closer}`;
      if (value.length >= 140 && value.length <= 160) return value;
    }
  }
  assert.fail(`${where}: generated description is outside the 140-160 range (${headList.join("|")} + ${closers.join("|")})`);
};

function assertTitle(value, where) {
  assert.ok(typeof value === "string" && value.length >= 20 && value.length <= 60, `${where}: title out of range (${value ?? "missing"})`);
  return value;
}

const countPhrase = (count, noun, plural) => (count === 1 ? `1 ${noun}` : `${count} ${plural ?? `${noun}s`}`);

// The scene hub shows the first actor of each scene; the age hub then picks an actor who
// leads no scene column and is not already shown on the /ai-actors workflow steps, so no
// hub card repeats a portrait another rendered page already shows. A scene with a single
// actor may still land twice (Garage) — the image-reuse baseline documents that pair.
const workflowRefsOnActorsHome = (source) => {
  const cards = source.content["ai-actors"].actor_visual?.steps?.actor_cards ?? [];
  return new Set(cards.map((card) => card?.ref).filter(Boolean));
};
const sceneFirstRefs = (actors) => new Set(byScene(actors).map((group) => group[0].ref));

function byScene(actors) {
  const map = new Map();
  for (const actor of actors) {
    if (!map.has(actor.scene)) map.set(actor.scene, []);
    map.get(actor.scene).push(actor);
  }
  return [...map.values()];
}

// -- Copy for the category pages (scene / gender / age) -----------------------------
function sceneHubContent(scenes, actors, actorCount) {
  const groups = byScene(actors);
  assert.equal(scenes.length, 31, `scene hub expects 31 scenes, got ${scenes.length}`);
  const items = groups.map((group) => {
    const scene = group[0].scene;
    assert.ok(scene, "scene hub group is empty");
    const names = group.map((actor) => actor.name).join(" and ");
    return {
      label: scene,
      page: aidreamcapesActorScenePageId(scene),
      text: `${countPhrase(group.length, "actor")} in this scene: ${names}.`,
      imageRef: group[0].ref
    };
  });
  return {
    kind: AIDREAMCAPES_ACTOR_DIRECTORY_KIND.sceneHub,
    title: assertTitle("AI Actors by Scene for Product Videos | AIVideosUGC", "scene hub"),
    description: descriptionInRange(
      "Browse AI actors across 31 product scenes. Open a scene to meet the presenters who work there",
      [
        ", then send one to camera with your product line.",
        " and cast one with your product photo.",
        " and pick the face for your next ad."
      ],
      "scene hub"
    ),
    h1: "AI Actors by Scene",
    label: "AI Actors by Scene",
    eyebrow: "AI actor directory",
    keyword: "AI actors by scene",
    lead: "AI actors by scene: open a setting to meet the presenters who work there, then pick one for your next product ad.",
    intro: [
      `The library has ${actorCount} presenters across 31 scenes. Open a scene to see the actors who work there. Every card leads to an actor's own page with their setup and a button for the workspace.`
    ],
    items,
    cta_title: "Make the Next Product Ad With One of Them",
    cta_lead: "Pick an actor in the scene you sell in, upload one product photo, and the price shows before you start.",
    relatedChips: [
      { label: "AI Actors by Age Range", page: "ai-actors-age-range" },
      { label: "Women AI Actors", page: "ai-actors-women" },
      { label: "Men AI Actors", page: "ai-actors-men" },
      { label: "All AI Actors", page: "ai-actors" }
    ],
    faq: [
      { q: "How do I pick a scene for my product?", a: "Match the place the product is really used, such as a kitchen for food or a gym for fitness gear. Each scene page shows the actors who present from that setting." },
      { q: "Can one actor work in another scene?", a: "Every actor presents from their own scene. Open another scene from this page to find a presenter in the other places your product is used." },
      { q: "What happens on an actor's page?", a: "You see their scene, age range and setup, the line they can carry on camera, and a button that opens the workspace with them." }
    ]
  };
}

function ageHubContent(ranges, actors, actorCount, source) {
  const takenRefs = new Set([...sceneFirstRefs(actors), ...workflowRefsOnActorsHome(source)]);
  const byAgeMap = new Map();
  for (const actor of actors) {
    if (!byAgeMap.has(actor.age)) byAgeMap.set(actor.age, []);
    byAgeMap.get(actor.age).push(actor);
  }
  const items = ranges.map((range) => {
    const group = byAgeMap.get(range.label) ?? [];
    assert.ok(group.length, `age hub has no actor in range ${range.label}`);
    const sceneSet = new Set(group.map((actor) => actor.scene));
    const notTaken = group.find((actor) => !takenRefs.has(actor.ref));
    const pick = notTaken ?? group[0];
    const text = range.slug === "60s-plus"
      ? `${countPhrase(group.length, "actor")} aged 60 and up, in ${pluralizeScenes(sceneSet.size)}.`
      : `${countPhrase(group.length, "actor")} in their ${range.word}, across ${pluralizeScenes(sceneSet.size)}.`;
    return { label: range.label, page: aidreamcapesActorAgePageId(range), text, imageRef: pick.ref };
  });
  return {
    kind: AIDREAMCAPES_ACTOR_DIRECTORY_KIND.ageHub,
    title: assertTitle("AI Actors by Age Range for Product Ads | AIVideosUGC", "age hub"),
    description: descriptionInRange(
      "Browse AI actors by the decade on screen, from 20s up. Every age-range page lists the actors in that bracket",
      [
        " and links to their own pages.",
        ", with a page for each actor to open.",
        ", and their scene list on every card."
      ],
      "age hub"
    ),
    h1: "AI Actors by Age Range",
    label: "AI Actors by Age Range",
    eyebrow: "AI actor directory",
    keyword: "AI actors by age range",
    lead: "AI actors by age range: pick the decade that fits your buyer, then meet the presenters who read that age on camera.",
    intro: [
      `All ${actorCount} actors split into five age ranges. Open a range to see who fits it, then start the ad with one of them. Each card names the scene the actor works from.`
    ],
    items,
    cta_title: "Cast the Face Your Buyer Believes",
    cta_lead: "Pick an actor by age range and scene, upload one product photo, and see the credits before you start.",
    relatedChips: [
      { label: "AI Actors by Scene", page: "ai-actors-scene" },
      { label: "Women AI Actors", page: "ai-actors-women" },
      { label: "Men AI Actors", page: "ai-actors-men" },
      { label: "All AI Actors", page: "ai-actors" }
    ],
    faq: [
      { q: "Why does the actor's age matter?", a: "Shoppers respond to presenters who look like the person they buy for. Testing two decades is how shops find their best-matching face." },
      { q: "How many actors sit in each range?", a: "The count is on each card. Their thirties is the biggest group, and every range has at least one actor to cast." },
      { q: "Can I mix ages and scenes?", a: "Each presenter works from one scene, so pick a scene first and the range choices narrow on their own. The card text names both." }
    ]
  };
}

// -- Copy for the category pages (scene / gender / age) -----------------------------
function sceneContent(scene, group) {
  const count = group.length;
  const names = group.map((actor) => actor.name).join(" and ");
  const setting = AIDREAMCAPES_ACTOR_SCENE_SETTINGS[scene];
  const word = AIDREAMCAPES_ACTOR_SCENE_WORDS[scene];
  const owners = count === 1 ? `${names} is the presenter for this scene` : `${names} are the presenters for this scene`;
  return {
    kind: AIDREAMCAPES_ACTOR_DIRECTORY_KIND.scene,
    id: aidreamcapesActorScenePageId(scene),
    title: assertTitle(`${scene} AI Actors for Product Videos | AIVideosUGC`, `scene ${scene}`),
    description: descriptionInRange(
      `${scene} AI actor${count === 1 ? "" : "s"} who ${count === 1 ? "presents" : "present"} products from ${setting}. This page lists ${countPhrase(count, "actor")} here. Open an actor's page below`,
      [
        " and make the next ad with them.",
        ", add your product photo, and start.",
        " and pick your presenter.",
        ", then open the workspace with your product photo."
      ],
      `scene ${scene}`
    ),
    h1: `${scene} AI Actors`,
    label: scene,
    eyebrow: `${scene} scene`,
    keyword: `${word} AI actors for product videos`,
    lead: `AI actors who present your product from ${setting}. Open an actor's page to see their setup, then open the workspace.`,
    intro: [
      `${owners} — ${setting} is the ${word} setting this column covers. Open a card below for each one's setup, then use its button to start the video with your product photo.`
    ],
    actorIds: group.map((actor) => actor.id),
    cta_title: `Make a ${scene} Video With Your Product`,
    cta_lead: "Pick an actor on this page, upload one product photo, and the credit cost shows before you start.",
    faq: [
      { q: `How do I make a product video in ${article(word)} ${word} scene?`, a: "Pick an actor on this page and open the workspace. Upload one product photo, write the line, and choose a voice. You see the credit cost before the job starts." },
      { q: "Will the actor say my exact words?", a: `Yes. The actor speaks the line you wrote, in the voice you choose, on camera in ${setting}.` },
      { q: "Where can I post the finished clip?", a: "Download it without a watermark and post it as a paid ad, a social post, or a video on your store page." }
    ],
    relatedChips: [
      { label: "Women AI Actors", page: "ai-actors-women" },
      { label: "Men AI Actors", page: "ai-actors-men" },
      { label: "AI Actors by Age Range", page: "ai-actors-age-range" },
      { label: "All AI Actors", page: "ai-actors" }
    ]
  };
}

function genderContent(entry, group, actorCount) {
  const lower = entry.label.toLowerCase();
  const womenCount = lower === "women";
  return {
    kind: AIDREAMCAPES_ACTOR_DIRECTORY_KIND.gender,
    id: aidreamcapesActorGenderPageId(entry.label),
    title: assertTitle(entry.title, `gender ${entry.label}`),
    description: descriptionInRange(
      `Meet ${group.length} ${lower} AI actors for product ads. Each presenter shows or holds your product on camera from one of the library's scenes`,
      [
        ". Pick one and open their page.",
        " and open the workspace from there.",
        ", then start the ad with your product photo."
      ],
      `gender ${entry.label}`
    ),
    h1: entry.h1,
    label: `${entry.label} AI Actors`,
    eyebrow: womenCount ? "Women AI actors" : "Men AI actors",
    keyword: `${lower} AI actors for product ads`,
    lead: `${entry.label} AI actors for product ads: ${group.length} of the site's ${actorCount} presenters. Open a card to see each one's scene and setup.`,
    intro: [
      `Each of these ${group.length} presenters works from one scene, from a home kitchen to a city rooftop. Open a card for that actor's setting, then start the video with your own product photo.`
    ],
    actorIds: group.map((actor) => actor.id),
    cta_title: "Put One of Them in the Next Ad",
    cta_lead: "Pick an actor, upload one product photo, and the credit cost shows before you start.",
    faq: [
      { q: `How many ${lower} actors are on this page?`, a: `${group.length}. Every card opens that actor's own page, with the scene they present from and the setup of their shot.` },
      { q: "How do I give an actor the line?", a: `Open one of the ${lower} actors below, then open the workspace from their page. Write what they should say, or let the draft help you start; the voice you pick says it on camera.` },
      { q: "Can I run these clips as ads?", a: "Yes. Downloads have no watermark, so the clip works as a paid ad, a social post, or a store video." }
    ],
    relatedChips: [
      { label: "AI Actors by Scene", page: "ai-actors-scene" },
      { label: "AI Actors by Age Range", page: "ai-actors-age-range" },
      { label: "All AI Actors", page: "ai-actors" }
    ]
  };
}

function ageContent(range, group, actorCount) {
  const sceneSet = new Set(group.map((actor) => actor.scene));
  const isOldest = range.slug === "60s-plus";
  const countText = countPhrase(group.length, "actor");
  const keyword = isOldest ? "AI actors aged 60 and up" : `AI actors in their ${range.word}`;
  return {
    kind: AIDREAMCAPES_ACTOR_DIRECTORY_KIND.age,
    id: aidreamcapesActorAgePageId(range),
    title: assertTitle(range.title, `age ${range.label}`),
    description: descriptionInRange(
      isOldest
        ? `${countText} aged 60 and up for product videos, in ${pluralizeScenes(sceneSet.size)}. Open an actor's page below, add your product photo`
        : `${countText} in their ${range.word} for product videos, across ${pluralizeScenes(sceneSet.size)}. Open an actor's page below, add your product photo`,
      [
        ", and the actor presents it from their scene.",
        " and start the video with your line.",
        ", write the line, and start."
      ],
      `age ${range.label}`
    ),
    h1: range.h1,
    label: range.h1,
    eyebrow: `${range.label} age range`,
    keyword,
    lead: isOldest
      ? `AI actors aged 60 and up for product videos: this range has ${group.length} presenter${group.length === 1 ? "" : "s"}, working from ${pluralizeScenes(sceneSet.size)}.`
      : `AI actors in their ${range.word} for product videos: ${group.length} presenters who match buyers in that decade.`,
    intro: [
      isOldest
        ? `${group.length === 1 ? "This presenter reads" : "These presenters read"} as 60 or older on camera across ${pluralizeScenes(sceneSet.size)}. ${group.length === 1 ? "Their" : "Each of their cards opens"} its actor page, where the button starts the video with your product photo.`
        : `These ${group.length} presenters read as ${range.word} on camera across ${pluralizeScenes(sceneSet.size)}. Each card opens that actor's page, where the button starts the video with your product photo.`
    ],
    actorIds: group.map((actor) => actor.id),
    cta_title: "Cast the Decade Your Buyer Reads",
    cta_lead: "Pick an actor on this page, upload one product photo, and the credit cost shows before you start.",
    faq: [
      { q: "Why choose an actor by age range?", a: `Shoppers respond to presenters who look like the person buying from them. ${group.length === 1 ? "This presenter matches buyers" : "These presenters match buyers"} who are ${isOldest ? "60 or older" : `in their ${range.word}`}.` },
      { q: "What can a presenter of this age sell?", a: "Anything you photograph. The setting stays theirs, the product photo is yours, and the line comes from you before the job starts." },
      { q: "How do I start a video here?", a: "Open an actor's page and use its button. Upload one product photo, write the line, and you see the credits first." }
    ],
    relatedChips: [
      { label: "AI Actors by Scene", page: "ai-actors-scene" },
      { label: "Women AI Actors", page: "ai-actors-women" },
      { label: "Men AI Actors", page: "ai-actors-men" },
      { label: "All AI Actors", page: "ai-actors" }
    ]
  };
}

// -- Copy for the per-actor detail pages --------------------------------------------
function detailContent(actor, actorCount, sceneSiblings) {
  const sceneWord = AIDREAMCAPES_ACTOR_SCENE_WORDS[actor.scene];
  const setting = AIDREAMCAPES_ACTOR_SCENE_SETTINGS[actor.scene];
  // Long look descriptions are cut back to "an adult … woman in her thirties" so the
  // sentence still ends on a complete phrase inside the length range.
  const talentCore = actor.talent.match(/^(an adult .*?\b(?:woman|man) in (?:her|his) \w+)\b/i)?.[1];
  const description = descriptionInRange([
    `${actor.name}: ${actor.talent}, showing a product in ${setting}.`,
    `${actor.name}: ${actor.talent}, showing a product on camera.`,
    talentCore ? `${actor.name}: ${talentCore}, showing a product in ${setting}.` : null,
    talentCore ? `${actor.name}: ${talentCore}, showing a product on camera.` : null,
    `${actor.name} shows a product from ${setting}.`
  ], [
    " Upload one product photo, choose a voice, and post the finished clip.",
    " Upload one product photo and pick a voice; the credit cost shows first.",
    " Add your product photo, pick a voice, and start.",
    " Upload your product photo, write the line, and see the credit cost first."
  ], `actor ${actor.name}`);
  const title = assertTitle(`${actor.name} · ${actor.scene} AI Actor | AIVideosUGC`, `actor ${actor.name}`);
  const siblingLine = sceneSiblings.length
    ? `${sceneSiblings[0].name} works the same scene if you want a second take.`
    : "This scene has one presenter in the library.";
  const intro = [
    `${actor.name} presents from ${setting}. Upload your product photo and the line you want, then ${actor.name} says it on camera from this scene. ${siblingLine}`
  ];
  return {
    kind: AIDREAMCAPES_ACTOR_DIRECTORY_KIND.detail,
    id: aidreamcapesActorDetailPageId(actor),
    title,
    description,
    h1: `${actor.name} · ${actor.scene} AI Actor`,
    label: actor.name,
    eyebrow: `${actor.scene} scene`,
    keyword: `${sceneWord} AI actor ${actor.name.toLowerCase()}`,
    lead: `${actor.name}, ${article(sceneWord)} ${sceneWord} AI actor, ${lowerFirst(actor.use)}.`,
    intro,
    actorId: actor.id,
    cta_title: `Put ${actor.name} in Your Next Product Ad`,
    cta_lead: `Upload one product photo, choose a voice, and let ${actor.name} carry the line on camera.`,
    faq: [
      { q: `How does ${actor.name} introduce my product?`, a: `Upload one product photo, write the line, and ${actor.name} says it on camera from ${setting}. The credit cost shows before the job starts.` },
      { q: `Which voice does ${actor.name} use?`, a: "You choose the voice in the workspace. Write the line in the language your shoppers use, and the voice you picked speaks it." },
      { q: `Can I put ${actor.name} in more than one video?`, a: `Yes. Keep the product photo and change the line, or ${sceneSiblings.length ? `try ${sceneSiblings[0].name} from the same scene` : "keep the same scene with a new opening"} for the next cut.` }
    ],
    relatedChips: [
      { label: `${actor.scene} AI Actors`, page: aidreamcapesActorScenePageId(actor.scene) },
      { label: `${actor.gender === "Men" ? "Men" : "Women"} AI Actors`, page: aidreamcapesActorGenderPageId(actor.gender) },
      ...(sceneSiblings.length
        ? [{ label: `Same scene: ${sceneSiblings[0].name}`, page: aidreamcapesActorDetailPageId(sceneSiblings[0]) }]
        : [{ label: "All AI Actors", page: "ai-actors" }])
    ]
  };
}

function groupBy(list, keyOf) {
  const map = new Map();
  for (const item of list) {
    const key = keyOf(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

// -- Page registry -------------------------------------------------------------------
function masterEntries(source) {
  const shared = source.content["ai-actors"];
  const scenes = shared.actor_scenes.map(String).filter(Boolean);
  const actors = shared.actor_cards;
  const sceneGroups = groupBy(actors, (actor) => actor.scene);
  const byAge = groupBy(actors, (actor) => actor.age);
  const entries = [];
  const push = (kind, url, id, label, keyword, copy) => entries.push({ id, url, label, keyword, kind, copy });

  push(AIDREAMCAPES_ACTOR_DIRECTORY_KIND.sceneHub, AIDREAMCAPES_ACTOR_SCENE_DIRECTORY, "ai-actors-scene", "AI Actors by Scene", "AI actors by scene", sceneHubContent(scenes, actors, actors.length));
  for (const scene of scenes) {
    const group = sceneGroups.get(scene) ?? [];
    assert.ok(group.length, `scene ${scene} has no actors`);
    push(AIDREAMCAPES_ACTOR_DIRECTORY_KIND.scene, aidreamcapesActorSceneHref(scene), aidreamcapesActorScenePageId(scene), scene, `${AIDREAMCAPES_ACTOR_SCENE_WORDS[scene]} AI actors for product videos`, sceneContent(scene, group));
  }
  for (const entry of AIDREAMCAPES_ACTOR_GENDERS) {
    const group = actors.filter((actor) => actor.gender === entry.label);
    push(AIDREAMCAPES_ACTOR_DIRECTORY_KIND.gender, aidreamcapesActorGenderPageHref(entry.label), aidreamcapesActorGenderPageId(entry.label), `${entry.label} AI Actors`, `${entry.label.toLowerCase()} AI actors for product ads`, genderContent(entry, group, actors.length));
  }
  push(AIDREAMCAPES_ACTOR_DIRECTORY_KIND.ageHub, AIDREAMCAPES_ACTOR_AGE_DIRECTORY, "ai-actors-age-range", "AI Actors by Age Range", "AI actors by age range", ageHubContent(AIDREAMCAPES_ACTOR_AGE_RANGES, actors, actors.length, source));
  for (const range of AIDREAMCAPES_ACTOR_AGE_RANGES) {
    const group = byAge.get(range.label) ?? [];
    assert.ok(group.length, `age range ${range.label} has no actors`);
    push(AIDREAMCAPES_ACTOR_DIRECTORY_KIND.age, aidreamcapesActorAgeHref(range), aidreamcapesActorAgePageId(range), range.h1, range.slug === "60s-plus" ? "AI actors aged 60 and up" : `AI actors in their ${range.word}`, ageContent(range, group, actors.length));
  }
  for (const actor of actors) {
    const siblings = (sceneGroups.get(actor.scene) ?? []).filter((sibling) => sibling.id !== actor.id);
    push(AIDREAMCAPES_ACTOR_DIRECTORY_KIND.detail, aidreamcapesActorDetailHref(actor), aidreamcapesActorDetailPageId(actor), actor.name, `${AIDREAMCAPES_ACTOR_SCENE_WORDS[actor.scene]} AI actor ${actor.name.toLowerCase()}`, detailContent(actor, actors.length, siblings));
  }
  return entries;
}

// The media-plan og entry per derived page: category pages share their first actor's
// portrait, detail pages use their own. og images stay outside the reuse accounting.
function ogEntries(source, registrations) {
  const guide = source.media.catalog.guide?.items ?? {};
  const actors = source.content["ai-actors"].actor_cards;
  const hubKinds = new Set([AIDREAMCAPES_ACTOR_DIRECTORY_KIND.sceneHub, AIDREAMCAPES_ACTOR_DIRECTORY_KIND.ageHub]);
  const entries = [];
  for (const entry of registrations) {
    if (hubKinds.has(entry.kind)) continue;
    const actorId = entry.kind === AIDREAMCAPES_ACTOR_DIRECTORY_KIND.detail ? entry.copy.actorId : entry.copy.actorIds?.[0];
    const actor = actors.find((candidate) => candidate.id === actorId);
    const ref = actor?.ref;
    assert.ok(ref, `derived og actor missing for ${entry.id}`);
    assert.ok(guide[ref.slice("n:guide:".length)], `derived og ref missing in catalog: ${ref} (${entry.id})`);
    entries.push([entry.id, ref]);
  }
  return entries;
}

// The header menu: three link groups like the Templates menu, with the scene column
// split in two inside its own column, and one footer link back to the full library.
export function aidreamcapesActorNavigationMenu(scenes, actorCount) {
  const count = Number(actorCount) || 53;
  return {
    label: "AI Actors",
    groups: [
      { label: "Browse by scene", columns: "2", items: scenes.map((scene) => ({ label: scene, href: aidreamcapesActorSceneHref(scene) })) },
      { label: "Browse by gender", items: [
        { label: "Women", href: AIDREAMCAPES_ACTOR_GENDER_DIRECTORY.Women },
        { label: "Men", href: AIDREAMCAPES_ACTOR_GENDER_DIRECTORY.Men }
      ] },
      { label: "Browse by age range", items: AIDREAMCAPES_ACTOR_AGE_RANGES.map((range) => ({ label: range.label, href: aidreamcapesActorAgeHref(range) })) }
    ],
    footerLink: { label: `View all ${count} AI actors →`, href: AIDREAMCAPES_ACTORS_ROOT }
  };
}

/** Extend the site-v2 source with the derived AI-actor directory pages, copy and og plan. */
export function withAidreamcapesActorDirectorySource(source) {
  const shared = source.content["ai-actors"];
  assert.ok(shared && Array.isArray(shared.actor_scenes) && Array.isArray(shared.actor_cards), "the ai-actors content is required for the derived actor directory");
  const actors = shared.actor_cards;
  assert.equal(new Set(actors.map((actor) => actor.name)).size, actors.length, "actor names must be unique");
  assert.equal(new Set(actors.map((actor) => actor.id)).size, actors.length, "actor ids must be unique");
  const existingUrls = new Set(source.master.pages.map((page) => page.url));
  const registrations = masterEntries(source);
  const existingIds = new Set(source.master.pages.map((page) => page.id));
  for (const registration of registrations) {
    assert.ok(!existingUrls.has(registration.url), `derived actor url already exists: ${registration.url}`);
    existingUrls.add(registration.url);
    assert.ok(!existingIds.has(registration.id), `derived actor page id already exists: ${registration.id}`);
    source.master.pages.push({
      id: registration.id, type: "index", url: registration.url, label: registration.label,
      primary_keyword: registration.keyword, img: IMAGE_KEY, status: "new", group: null, kind: registration.kind
    });
    existingIds.add(registration.id);
    assert.ok(!source.content[registration.id], `derived actor content id already exists: ${registration.id}`);
    source.content[registration.id] = { ...registration.copy, id: registration.id };
  }
  for (const [pageId, og] of ogEntries(source, registrations)) {
    const existing = source.media.plan.pages[pageId] ?? {};
    assert.ok(!existing.og, `derived og already set for ${pageId}`);
    source.media.plan.pages[pageId] = { ...existing, og };
  }
  return source;
}
