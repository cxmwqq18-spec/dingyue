import assert from "node:assert/strict";
import { defaultVideoThemeExamplePrompt, formatVideoPromptSections, providerReadyVideoThemePrompt, validateVideoPrompt } from "../src/lib/video-prompt-format.ts";

const complete = validateVideoPrompt(defaultVideoThemeExamplePrompt);
assert.equal(complete.valid, true, complete.errors.join("; "));
assert.equal(Object.keys(complete.sections).length, 10);

const missingCamera = defaultVideoThemeExamplePrompt.replace(/Camera \/ Shot \/ Lens:[^\n]+/, "Camera / Shot / Lens: A medium shot.");
assert.equal(validateVideoPrompt(missingCamera).valid, false);

const missingAction = defaultVideoThemeExamplePrompt.replace(/Action \/ Motion:[^\n]+/, "Action / Motion: A subject is present.");
assert.equal(validateVideoPrompt(missingAction).valid, false);

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
assert.match(providerReady, /first-frame reference/i);

console.log(JSON.stringify({ ok: true, sections: Object.keys(complete.sections), rejectedCases: 5 }, null, 2));
