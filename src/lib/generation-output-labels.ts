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

export function generationThemeLabel(job: OutputLabelJob | undefined): string {
  const request = job?.requestJson ?? {};
  const fields = fieldsFromJob(job);
  const creativePack = request.creativePack && typeof request.creativePack === "object" && !Array.isArray(request.creativePack)
    ? request.creativePack as Record<string, unknown>
    : undefined;
  const prompt = request.prompt && typeof request.prompt === "object" && !Array.isArray(request.prompt)
    ? request.prompt as Record<string, unknown>
    : undefined;
  return (
    textValue(fields.creativePackName) ||
    textValue(creativePack?.name) ||
    textValue(prompt?.themeName) ||
    textValue(fields.packageName) ||
    textValue(fields.toolPresetTitle) ||
    "Photo Set"
  );
}

export function generationCategoryLabel(job: OutputLabelJob | undefined): string {
  const request = job?.requestJson ?? {};
  const fields = fieldsFromJob(job);
  const creativePack = request.creativePack && typeof request.creativePack === "object" && !Array.isArray(request.creativePack)
    ? request.creativePack as Record<string, unknown>
    : undefined;
  const category = textValue(fields.creativePackCategory) || textValue(creativePack?.category);
  return titleCase(category || generationThemeLabel(job));
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
    "trainingMode"
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
}) {
  const runNumber = generationRunNumber(params.job, params.jobs);
  const optionSummary = generationOptionSummary(params.job);
  const optionTitle = optionSummary === "Default options" ? undefined : optionSummary;
  const title = compactParts([
    generationThemeLabel(params.job),
    generationTimeLabel(params.job),
    `Generation ${runNumber}`,
    `Image ${params.imageIndex}`
  ]);
  const storedLabel = cleanStoredOutputLabel(params.asset?.label?.trim());
  const shouldUseStoredLabel = !params.job && storedLabel && !/^Output\s+\d+$/i.test(storedLabel);
  return {
    title: shouldUseStoredLabel ? storedLabel : title,
    description: compactParts([
      params.job ? `Package: ${generationThemeLabel(params.job)}` : undefined,
      params.job ? `Category: ${generationCategoryLabel(params.job)}` : undefined,
      optionTitle,
      `Created ${generationTimeLabel(params.job)}`,
      `Generation ${runNumber}`,
      `Image ${params.imageIndex}`
    ])
  };
}
