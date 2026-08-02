import type { ThemeRuntimeAsset } from "@/lib/types";

type OutputLabelJob = {
  id: string;
  createdAt: string;
  requestJson?: Record<string, unknown>;
};

function textValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function compactParts(parts: Array<string | undefined>, separator = " · "): string {
  return parts.map((part) => part?.trim()).filter(Boolean).join(separator);
}

function humanizePrompt(value: unknown): string {
  const text = textValue(value);
  if (!text) return "";
  return text.replace(/\s+/g, " ").slice(0, 70);
}

function videoModelLabelFromValue(value: unknown): string {
  const normalized = textValue(value).toLowerCase();
  if (!normalized) return "";
  if (normalized.includes("gemini") || normalized.includes("huitu") || normalized.includes("veo")) return "Gemini";
  if (normalized.includes("grok") || normalized.includes("xai")) return "Grok";
  return titleCase(normalized);
}

function cleanStoredOutputLabel(value: string | undefined): string {
  if (!value) return "";
  const internalLabelPattern = /^(Training\s*Mode|TrainingMode|Package\s*Audience|PackageAudience|Customer\s*Model\s*Label|CustomerModelLabel|Primary\s*Asset\s*Ids|PrimaryAssetIds|Partner\s*Asset\s*Ids|PartnerAssetIds)\s*:/i;
  return value
    .split(" · ")
    .map((part) => part.trim())
    .filter((part) => part && !internalLabelPattern.test(part))
    .join(" · ")
    .trim();
}

function fieldsFromJob(job: OutputLabelJob | undefined): Record<string, unknown> {
  const fields = job?.requestJson?.fields;
  return fields && typeof fields === "object" && !Array.isArray(fields) ? fields as Record<string, unknown> : {};
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function isVideoJob(job: OutputLabelJob | undefined): boolean {
  const request = job?.requestJson ?? {};
  const fields = fieldsFromJob(job);
  const flow = recordValue(request.flow);
  return (
    textValue(flow?.aiAppSlug) === "video_generator" ||
    textValue(request.mode) === "video" ||
    textValue(request.outputType) === "video" ||
    textValue(fields.mode) === "video" ||
    textValue(fields.outputType) === "video" ||
    Boolean(recordValue(request.videoTheme))
  );
}

export function generationThemeLabel(job: OutputLabelJob | undefined): string {
  const request = job?.requestJson ?? {};
  const fields = fieldsFromJob(job);
  const creativePack = recordValue(request.creativePack);
  const videoTheme = recordValue(request.videoTheme);
  const prompt = recordValue(request.prompt);
  return (
    textValue(fields.videoThemeName) ||
    textValue(videoTheme?.name) ||
    textValue(fields.creativePackName) ||
    textValue(creativePack?.name) ||
    textValue(prompt?.themeName) ||
    textValue(fields.packageName) ||
    textValue(fields.toolPresetTitle) ||
    (isVideoJob(job) ? "Video Set" : "Photo Set")
  );
}

export function generationCategoryLabel(job: OutputLabelJob | undefined): string {
  const request = job?.requestJson ?? {};
  const fields = fieldsFromJob(job);
  const creativePack = recordValue(request.creativePack);
  const videoTheme = recordValue(request.videoTheme);
  const category = textValue(videoTheme?.categoryLabel) ||
    textValue(fields.videoThemeCategoryLabel) ||
    textValue(videoTheme?.categorySlug) ||
    textValue(fields.videoThemeCategorySlug) ||
    textValue(request.videoThemeCategoryLabel) ||
    textValue(request.videoThemeCategorySlug) ||
    textValue(fields.creativePackCategory) ||
    textValue(creativePack?.category);
  return titleCase(category || generationThemeLabel(job));
}

export function generationVideoModelLabel(job: OutputLabelJob | undefined): string {
  if (!isVideoJob(job)) return "";
  const request = job?.requestJson ?? {};
  const fields = fieldsFromJob(job);
  const providerSelection = recordValue(request.providerSelection);
  const modelLabel = videoModelLabelFromValue(fields.videoModelFamily) ||
    videoModelLabelFromValue(fields.modelFamily) ||
    videoModelLabelFromValue(request.videoModelFamily) ||
    videoModelLabelFromValue(request.modelFamily) ||
    videoModelLabelFromValue(providerSelection?.videoModelFamily) ||
    videoModelLabelFromValue(providerSelection?.modelFamily) ||
    videoModelLabelFromValue(fields.videoProviderFamily) ||
    videoModelLabelFromValue(request.videoProviderFamily) ||
    videoModelLabelFromValue(fields.modelType) ||
    videoModelLabelFromValue(request.modelType);
  return modelLabel || "Grok";
}

export function generationOptionSummary(job: OutputLabelJob | undefined): string {
  const fields = fieldsFromJob(job);
  const publicFieldLabels: Record<string, string> = {
    prompt: "Prompt",
    style: "Style",
    background: "Background",
    outfit: "Outfit",
    hairstyle: "Hairstyle",
    mood: "Mood",
    destination: "Destination",
    scene: "Scene",
    format: "Format",
    aspectRatio: "Aspect ratio",
    quality: "Quality"
  };
  const internalFields = new Set([
    "creativePackName",
    "creativePackPrompt",
    "customerModelLabel",
    "packageAudience",
    "packageName",
    "packagePrompt",
    "partnerAssetIds",
    "primaryAssetIds",
    "outputCount",
    "toolPresetId",
    "toolPresetTitle",
    "trainingMode",
    "frameAssetIds",
    "videoThemeId",
    "videoThemeName",
    "videoThemePrompt",
    "videoThemeSlug",
    "videoThemeCategoryLabel",
    "videoThemeCategorySlug",
    "videoInputMode",
    "videoModelFamily",
    "modelFamily",
    "videoDuration",
    "videoDurationSeconds"
  ]);
  const isToolRequest = job?.requestJson?.mode === "tool" || Boolean(textValue(fields.toolPresetTitle));
  const toolPrompt = humanizePrompt(fields.prompt);
  const parts = Object.entries(fields)
    .filter(([key, value]) => !internalFields.has(key) && publicFieldLabels[key] && textValue(value))
    .slice(0, 3)
    .map(([key, value]) => `${publicFieldLabels[key] ?? titleCase(key)}: ${textValue(value)}`);
  if (isToolRequest && toolPrompt && !parts.some((part) => part.startsWith("Prompt:"))) parts.unshift(`Prompt: ${toolPrompt}`);
  return compactParts(parts) || "Default options";
}

export function generationTimeLabel(job: OutputLabelJob | undefined): string {
  const value = job?.createdAt ? new Date(job.createdAt) : new Date();
  if (Number.isNaN(value.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

export function generationRunNumber(job: OutputLabelJob | undefined, jobs: OutputLabelJob[] = []): number {
  if (!job) return 1;
  const sorted = [...jobs]
    .filter((item) => item.requestJson?.mode === job.requestJson?.mode || generationThemeLabel(item) === generationThemeLabel(job))
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
  const index = sorted.findIndex((item) => item.id === job.id);
  return index >= 0 ? index + 1 : 1;
}

export function generatedOutputCopy(params: {
  asset?: Pick<ThemeRuntimeAsset, "label">;
  imageIndex: number;
  job?: OutputLabelJob;
  jobs?: OutputLabelJob[];
  runNumber?: number;
}) {
  const runNumber = Number.isFinite(params.runNumber) && Number(params.runNumber) > 0
    ? Math.trunc(Number(params.runNumber))
    : generationRunNumber(params.job, params.jobs);
  const optionSummary = generationOptionSummary(params.job);
  const optionTitle = optionSummary === "Default options" ? undefined : optionSummary;
  const videoJob = isVideoJob(params.job);
  const outputNoun = videoJob ? "Video" : "Image";
  const categoryLabel = params.job ? generationCategoryLabel(params.job) : "";
  const title = compactParts([
    generationThemeLabel(params.job),
    generationTimeLabel(params.job),
    `Generation ${runNumber}`,
    `${outputNoun} ${params.imageIndex}`
  ]);
  const storedLabel = cleanStoredOutputLabel(params.asset?.label?.trim());
  const shouldUseStoredLabel = !params.job && storedLabel && !/^Output\s+\d+$/i.test(storedLabel);
  return {
    title: shouldUseStoredLabel ? storedLabel : title,
    description: compactParts([
      params.job ? `Package: ${generationThemeLabel(params.job)}` : undefined,
      params.job && categoryLabel ? `Category: ${categoryLabel}` : undefined,
      optionTitle,
      `Created ${generationTimeLabel(params.job)}`,
      `Generation ${runNumber}`,
      `${outputNoun} ${params.imageIndex}`
    ]),
    tags: [
      params.job && categoryLabel ? `Category: ${categoryLabel}` : undefined
    ].filter((tag): tag is string => Boolean(tag))
  };
}
