import assert from "node:assert/strict";
import createJiti from "jiti";
import fs from "node:fs";

const jiti = createJiti(import.meta.url);
const {
  defaultVideoThemeExamplePrompt,
  formatVideoPromptSections,
  providerReadyVideoThemePrompt,
  validateVideoPrompt,
  VIDEO_THEME_PROMPT_BLUEPRINT_SLUGS,
  videoThemePromptForEditor
} = jiti("../src/lib/video-prompt-format.ts");
const { COVER_ANCHORED_VIDEO_THEME_BLUEPRINTS } = jiti("../src/lib/video-theme-cover-blueprints.ts");

function hasContinuousFifteenSecondCoverage(action) {
  const beats = [...action.matchAll(/(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)s\b/gi)]
    .map((match) => ({ start: Number(match[1]), end: Number(match[2]) }));
  return beats.length > 0
    && beats[0].start === 0
    && beats.at(-1).end === 15
    && beats.every((beat, index) => index === 0 || beat.start === beats[index - 1].end);
}

const complete = validateVideoPrompt(defaultVideoThemeExamplePrompt);
assert.equal(complete.valid, true, complete.errors.join("; "));
assert.equal(Object.keys(complete.sections).length, 10);
assert.equal(hasContinuousFifteenSecondCoverage(complete.sections["Action / Motion"]), true);

const missingCamera = defaultVideoThemeExamplePrompt.replace(/Camera \/ Shot \/ Lens:[^\n]+/, "Camera / Shot / Lens: A medium shot.");
assert.equal(validateVideoPrompt(missingCamera).valid, false);

const missingAction = defaultVideoThemeExamplePrompt.replace(/Action \/ Motion:[^\n]+/, "Action / Motion: A subject is present.");
assert.equal(validateVideoPrompt(missingAction).valid, false);
const userEditedFifteenSecondPrompt = defaultVideoThemeExamplePrompt.replace(
  /Action \/ Motion:[^\n]+/,
  "Action / Motion: The subject turns toward the window, raises one hand, and takes one slow step."
);
assert.equal(validateVideoPrompt(userEditedFifteenSecondPrompt).valid, true, "user-edited 15-second prompts should not be blocked for omitting template timecodes");

const missingFinalFrame = defaultVideoThemeExamplePrompt.replace(/final frame ends on[^.]+\./i, "the subject remains consistent.");
assert.equal(validateVideoPrompt(missingFinalFrame).valid, false);

const missingMicroAction = formatVideoPromptSections({
  "Subject / Character": "A single adult subject with a blue coat.",
  "Action / Motion": "The subject turns and walks forward.",
  "Scene / Environment": "A rainy room with a cold draft and wet glass.",
  "Camera / Shot / Lens": "A slow dolly push-in, medium shot on a 35mm lens.",
  "Lighting / Atmosphere": "Soft window light and a quiet, cool atmosphere.",
  "Style / Mood / Palette": "Naturalistic cinematic realism in a blue palette.",
  "Sound / Audio": "Rain and a low room hum anchor the scene.",
  "Duration / Aspect Ratio / Resolution": "6 seconds, 16:9 aspect ratio, 720p resolution.",
  Continuity: "Keep the coat consistent; final frame ends on the window.",
  "Negative Constraints": "No text, logos, or watermarks."
});
assert.equal(validateVideoPrompt(missingMicroAction).valid, false);
assert.equal(validateVideoPrompt(`${defaultVideoThemeExamplePrompt}\nNo explicit sexual content or graphic gore.`).valid, false);

const providerReady = providerReadyVideoThemePrompt("An adult couple opens a date card while soft window light moves across the paper.");
assert.equal(validateVideoPrompt(providerReady).valid, true, validateVideoPrompt(providerReady).errors.join("; "));
assert.match(providerReady, /15 seconds/i);
assert.match(providerReady, /Final frame:/i);

const expectedThemeSlugs = [
  "creator-scene-motion", "text-to-video", "image-to-video", "motion-generator", "talking-photo", "photo-animation",
  "photo-slideshow-video", "cinematic-video", "tiktok-video", "instagram-reels", "youtube-shorts", "social-media-video",
  "youtube-video", "story-video", "meme-video", "product-video", "product-demo-video", "product-ad-video", "promo-video",
  "ugc-ad-video", "video-ad", "brand-video", "music-video", "travel-video", "fashion-video", "food-video", "fitness-video",
  "pet-video", "explainer-video", "how-to-video", "real-estate-video", "corporate-video", "ai-avatar-video", "talking-head-video",
  "valentines-day", "engagement", "proposal", "save-the-date", "wedding-invitation", "wedding-ceremony", "christmas",
  "halloween", "thanksgiving", "new-year", "mothers-day", "fathers-day", "cinematic-portrait-motion", "creator-intro-motion",
  "holiday-card-motion", "product-showcase-motion", "prompt-directed-motion", "social-profile-clip", "travel-route-story",
  "wedding-memory-film"
].toSorted();
assert.deepEqual([...VIDEO_THEME_PROMPT_BLUEPRINT_SLUGS].toSorted(), expectedThemeSlugs);
assert.equal(Object.keys(COVER_ANCHORED_VIDEO_THEME_BLUEPRINTS).length, 44, "Every database theme must have a cover-anchored prompt definition.");
assert.deepEqual(
  Object.entries(COVER_ANCHORED_VIDEO_THEME_BLUEPRINTS).filter(([, theme]) => !theme.coverImageUrl).map(([slug]) => slug).toSorted(),
  ["image-to-video", "text-to-video"],
  "Only the two source-driven themes may omit a cover image."
);
for (const [slug, theme] of Object.entries(COVER_ANCHORED_VIDEO_THEME_BLUEPRINTS)) {
  assert.ok(theme.visualEvidence.length > 60, `${slug}: cover evidence must name visible content`);
  if (theme.coverImageUrl) {
    assert.ok(fs.existsSync(`${process.cwd()}/public${theme.coverImageUrl.split("?")[0]}`), `${slug}: cover image is missing`);
  }
}

const editorPrompts = new Map();
for (const slug of VIDEO_THEME_PROMPT_BLUEPRINT_SLUGS) {
  const prompt = providerReadyVideoThemePrompt("User-supplied direction remains higher priority than the defaults.", slug);
  const validation = validateVideoPrompt(prompt);
  assert.equal(validation.valid, true, `${slug}: ${validation.errors.join("; ")}`);
  assert.equal(hasContinuousFifteenSecondCoverage(validation.sections["Action / Motion"]), true, `${slug}: example must cover a continuous 0s-15s arc`);
  assert.match(validation.sections["Action / Motion"], /\b0-\d+s/, `${slug}: missing opening time beat`);
  assert.match(validation.sections["Action / Motion"], /\b\d+(?:\.\d+)?-15s/, `${slug}: missing final time beat`);
  assert.match(prompt, /\[[^\]]+\]/, `${slug}: missing replaceable field`);
  assert.doesNotMatch(prompt, /Perform one readable move|Keep the source environment and physical surfaces stable/i, `${slug}: generic legacy wording returned`);

  const editor = videoThemePromptForEditor(prompt);
  assert.equal(editor.split("\n").length, 6, `${slug}: editor prompt must stay six lines`);
  assert.match(editor, /^Content:/);
  assert.match(editor, /\nAction: .*\b0-\d+s/);
  assert.match(editor, /\nEnding: \S+/);
  assert.doesNotMatch(editor, /Duration \/ Aspect Ratio|Negative Constraints/i);
  assert.ok(editor.length < 1800, `${slug}: editor prompt is too long (${editor.length})`);
  editorPrompts.set(slug, editor);
}
assert.equal(new Set(editorPrompts.values()).size, VIDEO_THEME_PROMPT_BLUEPRINT_SLUGS.length, "Every theme must have an independent editor prompt.");

assert.match(editorPrompts.get("brand-video"), /white lounge chair.*mustard ottoman/i);
assert.match(editorPrompts.get("talking-photo"), /tea at four/i);
assert.match(editorPrompts.get("talking-photo"), /2\.0 to 13\.5 seconds|2-5s.*5-9s.*9-12s.*12-13\.5s.*13\.5-15s/i);
assert.match(editorPrompts.get("talking-photo"), /kettle is small.*little ritual still brings you home/i);
assert.match(editorPrompts.get("music-video"), /turn the room blue.*burn pink/i);
assert.match(editorPrompts.get("travel-video"), /ferry terminal|fish market|harbor wall/i);
assert.match(editorPrompts.get("travel-route-story"), /rust-brown sweater.*mountain lake/i);
assert.match(editorPrompts.get("pet-video"), /white blouse.*brindle dog/i);
assert.match(editorPrompts.get("product-video"), /amber glass serum bottle.*dropper/i);
assert.match(editorPrompts.get("product-showcase-motion"), /forest-green ribbed sweater.*gold earrings/i);
assert.match(editorPrompts.get("prompt-directed-motion"), /rain-soaked neon fugitive/i);
assert.match(editorPrompts.get("save-the-date"), /June fourteenth.*Big Sur/i);
assert.match(editorPrompts.get("youtube-video"), /black sports coupe.*rain-wet industrial pavement/i);

console.log(JSON.stringify({
  ok: true,
  sections: Object.keys(complete.sections),
  rejectedCases: 5,
  auditedThemeBlueprints: VIDEO_THEME_PROMPT_BLUEPRINT_SLUGS.length,
  coverAnchoredDatabaseThemes: Object.keys(COVER_ANCHORED_VIDEO_THEME_BLUEPRINTS).length,
  uniqueEditorPrompts: new Set(editorPrompts.values()).size
}, null, 2));
