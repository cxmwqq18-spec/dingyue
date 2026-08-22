export const VIDEO_PROMPT_SECTION_LABELS = [
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
] as const;

export type VideoPromptSectionLabel = (typeof VIDEO_PROMPT_SECTION_LABELS)[number];

export type VideoPromptValidation = {
  valid: boolean;
  errors: string[];
  sections: Partial<Record<VideoPromptSectionLabel, string>>;
};

const sectionAliases: Record<VideoPromptSectionLabel, string[]> = {
  "Subject / Character": ["subject", "character"],
  "Action / Motion": ["action", "motion"],
  "Scene / Environment": ["scene", "environment"],
  "Camera / Shot / Lens": ["camera", "shot", "lens"],
  "Lighting / Atmosphere": ["lighting", "atmosphere"],
  "Style / Mood / Palette": ["style", "mood", "palette"],
  "Sound / Audio": ["sound", "audio"],
  "Duration / Aspect Ratio / Resolution": ["duration", "aspect ratio", "resolution"],
  Continuity: ["continuity"],
  "Negative Constraints": ["negative constraints", "negative"]
};

const cameraMotionPattern = /\b(push[- ]?in|pull[- ]?out|dolly|track(?:ing)?|pan|tilt|zoom|orbit|crane|handheld|static|locked[- ]?off|rack focus|arc)\b/i;
const lensPattern = /\b(?:\d{1,3}\s*mm|wide[- ]?angle|telephoto|macro|anamorphic|lens)\b/i;
const environmentPressurePattern = /\b(?:rain|wind|snow|steam|smoke|heat|cold|dust|crowd|traffic|water|surface|reflection|shadow|weather|neon|flicker|sunlight|fog|humidity|pressure)\b/i;
const microActionPattern = /\b(?:hand|hands|finger|fingers|breath|breathing|blink|eyes|gaze|jaw|lips|shoulder|shoulders|wrist|grip|swallow|posture|hair|fabric)\b/i;
const soundAnchorPattern = /\b(?:sound|audio|music|hum|buzz|whisper|voice|footstep|footsteps|click|rustle|silence|echo|motif|reflection|chime|splash)\b/i;
const finalFramePattern = /\b(?:final (?:frame|image|shot)|ending (?:frame|image|shot)|ends? on|finish(?:es)? on|last frame)\b/i;
const unsafePromptPattern = /\b(?:child porn|sexual(?:ized)? minor|underage (?:sex|nude|nudity)|explicit sexual content|graphic gore)\b/i;

function headingPattern(label: VideoPromptSectionLabel): RegExp {
  const aliases = sectionAliases[label].map((alias) => alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  return new RegExp(`^\\s*(?:\\[?\\s*)?(?:${aliases})(?:\\s*[/|,&-]\\s*(?:${aliases}))*(?:\\s*\\])?\\s*:` , "im");
}

function sectionBody(prompt: string, label: VideoPromptSectionLabel): string {
  const heading = headingPattern(label);
  const match = heading.exec(prompt);
  if (!match || match.index === undefined) return "";
  const start = match.index + match[0].length;
  const rest = prompt.slice(start);
  const next = /^\s*(?:\[?\s*)?(?:subject(?:\s*[/|,&-]\s*character)?|action(?:\s*[/|,&-]\s*motion)?|scene(?:\s*[/|,&-]\s*environment)?|camera(?:\s*[/|,&-]\s*(?:shot|lens))+|lighting(?:\s*[/|,&-]\s*atmosphere)?|style(?:\s*[/|,&-]\s*(?:mood|palette))+|sound(?:\s*[/|,&-]\s*audio)?|duration(?:\s*[/|,&-]\s*(?:aspect ratio|resolution))+|continuity|negative(?:\s+constraints)?)(?:\s*\])?\s*:/im.exec(rest);
  return (next ? rest.slice(0, next.index) : rest).trim();
}

export function validateVideoPrompt(prompt: string): VideoPromptValidation {
  const value = prompt.trim();
  const errors: string[] = [];
  const sections: Partial<Record<VideoPromptSectionLabel, string>> = {};
  if (!value) return { valid: false, errors: ["Prompt is required."], sections };
  if (value.length > 6000) errors.push("Prompt must be 6000 characters or fewer.");
  if (unsafePromptPattern.test(value)) errors.push("Prompt contains disallowed sexual or graphic safety content.");

  for (const label of VIDEO_PROMPT_SECTION_LABELS) {
    const body = sectionBody(value, label);
    if (!body) errors.push(`Missing ${label} section.`);
    else sections[label] = body;
  }

  const camera = sections["Camera / Shot / Lens"] ?? "";
  const action = sections["Action / Motion"] ?? "";
  const environment = sections["Scene / Environment"] ?? "";
  const sound = sections["Sound / Audio"] ?? "";
  const continuity = sections.Continuity ?? "";
  if (action && !/\b(?:moves?|turns?|walks?|runs?|reaches?|looks?|shifts?|rises?|falls?|opens?|closes?|leans?|dances?|speaks?|breathes?|drifts?|pans?|tilts?|zooms?|tracks?)\b/i.test(action)) {
    errors.push("Action / Motion must describe a concrete first action.");
  }
  if (camera && (!cameraMotionPattern.test(camera) || !lensPattern.test(camera))) {
    errors.push("Camera / Shot / Lens must include explicit camera movement and lens or framing detail.");
  }
  if (environment && !environmentPressurePattern.test(environment)) errors.push("Scene / Environment must include a physical or environmental pressure/detail.");
  if (value && !microActionPattern.test(value)) errors.push("Prompt must include a body micro-action or tactile detail.");
  if (sound && !soundAnchorPattern.test(sound)) errors.push("Sound / Audio must include an audible or visual anchor.");
  if (value && !finalFramePattern.test(`${continuity} ${value}`)) errors.push("Continuity must describe the final frame or ending image.");
  return { valid: errors.length === 0, errors, sections };
}

export function formatVideoPromptSections(sections: Partial<Record<VideoPromptSectionLabel, string>>): string {
  return VIDEO_PROMPT_SECTION_LABELS
    .map((label) => `${label}: ${String(sections[label] ?? "").trim()}`)
    .join("\n\n");
}

export const defaultVideoThemeExamplePrompt = formatVideoPromptSections({
  "Subject / Character": "A single adult subject with clear wardrobe and grounded physical presence.",
  "Action / Motion": "The subject turns toward the window, raises one hand, and takes the first slow step into frame.",
  "Scene / Environment": "A rain-cooled apartment with wet glass, a draft moving the curtain, and reflections pooling on the floor.",
  "Camera / Shot / Lens": "Gentle dolly push-in with a slow pan, medium shot on a 35mm lens, shallow depth of field.",
  "Lighting / Atmosphere": "Overcast window light meets a warm practical lamp; humid, quiet, intimate atmosphere.",
  "Style / Mood / Palette": "Naturalistic cinematic realism, restrained blue and amber palette, reflective mood.",
  "Sound / Audio": "Soft rain against glass, curtain rustle, one measured breath, and a low room hum as the visual anchor.",
  "Duration / Aspect Ratio / Resolution": "6 seconds, 16:9 aspect ratio, 720p resolution.",
  Continuity: "Keep wardrobe, face, hand position, and light direction consistent; final frame ends on the hand touching the rain-streaked glass.",
  "Negative Constraints": "No text, logos, watermarks, extra limbs, face drift, abrupt cuts, or unrelated subjects."
});
