"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Play, Sparkles, Trash2, UploadCloud } from "lucide-react";
import type { AiWorkflowConfig, AiWorkflowField, AiWorkflowStep, CreativePack, PublicCustomer, SiteAiApp, ThemeRuntimeAsset, ThemeRuntimeCustomerModel } from "@/lib/types";
import { csrfHeader, customerJsonHeaders } from "@/lib/client-csrf";
import { invalidateCustomerAssets, loadCustomerAssets } from "@/components/app/customer-assets-client-cache";

type CreateMode = "theme" | "tool";
type PackageAudience = "self" | "partner" | "both";
type UploadTarget = "primary" | "partner";
type OperationContext = {
  action?: string;
  note?: string;
  source?: string;
};
type SubscriptionStatus = "loading" | "active" | "required";

type CreatedJobFeedback = {
  workerDispatch?: {
    status?: "skipped" | "sent" | "failed";
    error?: string;
  };
  note?: string;
};

const DEFAULT_THEME_OUTPUT_COUNT = 1;
const DEFAULT_MAX_SOURCE_ASSETS = 15;
const COLLAPSED_CATEGORY_LIMIT = Number.POSITIVE_INFINITY;
const COLLAPSED_THEME_CARD_LIMIT = Number.POSITIVE_INFINITY;
const COLLAPSED_TOOL_CARD_LIMIT = Number.POSITIVE_INFINITY;
const TOOL_PROMPT_FIELD_ID = "prompt";
const TOOL_PROMPT_BLOCKLIST = [
  "child sexual",
  "csam",
  "exploit minor",
  "explicit minor",
  "nude child",
  "underage nude",
  "rape",
  "sexual assault",
  "non-consensual",
  "gore",
  "beheading",
  "terrorist",
  "bomb making",
  "kill yourself"
];

type ToolPreset = {
  id: string;
  title: string;
  description: string;
  category: string;
  creditCost?: number;
  backendSlug?: string;
  prompt: string;
};

const TOOL_PRESET_LIBRARY: ToolPreset[] = [
  {
    id: "headshot-generator",
    title: "Headshot Photo Generator",
    description: "Create polished work profiles, team portraits, and founder photos from clear selfies.",
    category: "Portrait makers",
    prompt: "Create a polished professional headshot with natural lighting, clean background, and a confident expression."
  },
  {
    id: "anime-avatar",
    title: "Anime Avatar Builder",
    description: "Convert a clear selfie into stylized avatar concepts for profiles, social handles, and campaigns.",
    category: "Portrait makers",
    prompt: "Create a stylized anime avatar inspired by the uploaded portrait while preserving recognizable facial features."
  },
  {
    id: "wedding-portraits",
    title: "Wedding Portraits",
    description: "Create elegant couple, ceremony, and celebration portrait concepts before building a full album.",
    category: "Portrait makers",
    prompt: "Create refined wedding portrait concepts with romantic lighting, elegant styling, and album-ready composition."
  },
  {
    id: "gala-photo",
    title: "Gala Photo Maker",
    description: "Preview formal night-out portraits with red-carpet lighting, polished outfits, and social-ready crops.",
    category: "Portrait makers",
    prompt: "Create a formal gala portrait with evening lighting, polished attire, and editorial composition."
  },
  {
    id: "nature-adventure",
    title: "Nature Adventure Photos",
    description: "Place the customer in scenic outdoor, hiking, and travel-inspired portrait scenes.",
    category: "Portrait makers",
    prompt: "Create an outdoor adventure portrait in a scenic natural landscape with cinematic but realistic lighting."
  },
  {
    id: "edit-by-prompt",
    title: "Edit by Prompt",
    description: "Describe a focused image edit and preview it before spending package credits.",
    category: "Cleanup tools",
    prompt: ""
  },
  {
    id: "background-changer",
    title: "Background Changer",
    description: "Replace a plain selfie background before ordering a full photo package.",
    category: "Cleanup tools",
    prompt: "Replace the background with a clean studio setting while keeping the subject natural and realistic."
  },
  {
    id: "background-remover",
    title: "Background Remover",
    description: "Cut out product or portrait backgrounds for cleaner private photos.",
    category: "Cleanup tools",
    prompt: "Remove the background cleanly and preserve the subject edges for a transparent or neutral-background result."
  },
  {
    id: "magic-eraser",
    title: "Magic Eraser",
    description: "Remove small distractions from portraits, cards, and generated scenes.",
    category: "Cleanup tools",
    prompt: "Remove distracting objects while keeping the surrounding image realistic and seamless."
  },
  {
    id: "photo-enhancer",
    title: "Photo Enhancer",
    description: "Improve low-light uploads before using them for private model training.",
    category: "Cleanup tools",
    prompt: "Enhance sharpness, exposure, and color balance while preserving a realistic photo look."
  },
  {
    id: "portrait-retouch",
    title: "Portrait Retouch",
    description: "Clean skin, flyaways, and lighting without changing the customer's identity.",
    category: "Cleanup tools",
    prompt: "Retouch the portrait lightly with natural skin texture, balanced lighting, and no identity change."
  },
  {
    id: "unblur-image",
    title: "Unblur Image",
    description: "Rescue soft phone shots before they enter a paid generation workflow.",
    category: "Cleanup tools",
    prompt: "Improve clarity and reduce blur while keeping the image realistic."
  },
  {
    id: "color-correction",
    title: "Color Correction",
    description: "Balance tones for profile photos, posters, and package previews.",
    category: "Cleanup tools",
    prompt: "Correct the color balance, exposure, and contrast for a clean natural result."
  },
  {
    id: "old-photo-restoration",
    title: "Old Photo Restoration",
    description: "Repair faded photos and prepare them for private album delivery.",
    category: "Cleanup tools",
    prompt: "Restore the old photo by reducing scratches, improving contrast, and preserving the original identity."
  },
  {
    id: "image-to-video",
    title: "Image to Video Concept",
    description: "Turn a finished photo package image into a short motion concept.",
    category: "Motion builders",
    prompt: "Create a short motion concept from the uploaded image with subtle camera movement and natural animation."
  },
  {
    id: "profile-clip",
    title: "Profile Clip Maker",
    description: "Create social profile motion from headshots or creator portraits.",
    category: "Motion builders",
    prompt: "Create a short social profile clip using the uploaded portrait with subtle motion and polished framing."
  },
  {
    id: "creator-intro-video",
    title: "Creator Intro Video",
    description: "Turn creator portraits into short intro clips for profiles and reels.",
    category: "Motion builders",
    prompt: "Create a compact creator intro motion concept with polished pacing and profile-ready framing."
  },
  {
    id: "fan-poster-motion",
    title: "Fan Poster Motion",
    description: "Animate fan posters and match-day profile scenes.",
    category: "Motion builders",
    prompt: "Create a short sports fan poster motion concept with energetic but realistic movement."
  },
  {
    id: "product-teaser-clip",
    title: "Product Teaser Clip",
    description: "Create simple motion ideas for product-style package outputs.",
    category: "Motion builders",
    prompt: "Create a short product teaser motion concept with clean framing and subtle commercial-style movement."
  }
];

const AIDREAMCAPES_TOOL_PRESET_LIBRARY: ToolPreset[] = [
  {
    id: "route-portrait-composer",
    title: "Route Portrait Composer",
    description: "Build scenic travel portraits from everyday travel reference photos and destination notes.",
    category: "Travel portrait tools",
    prompt: "Create a realistic travel portrait with route-ready styling, natural light, and destination atmosphere."
  },
  {
    id: "city-walk-editor",
    title: "City Walk Editor",
    description: "Shape street, cafe, plaza, and old-city portrait scenes without planning a physical shoot.",
    category: "Travel portrait tools",
    prompt: "Create an old-city walking portrait with natural street light, believable wardrobe, and editorial travel framing."
  },
  {
    id: "coastal-light-maker",
    title: "Coastal Light Maker",
    description: "Preview beach, cliffside, marina, and resort portrait lighting for private albums.",
    category: "Destination tools",
    prompt: "Create a coastal travel portrait with warm seaside light, realistic background depth, and relaxed vacation styling."
  },
  {
    id: "scenic-overlook-story",
    title: "Scenic Overlook Story",
    description: "Turn private portraits into mountain, terrace, and overlook scenes with postcard-ready framing.",
    category: "Destination tools",
    prompt: "Create a scenic overlook portrait with panoramic landscape context, natural pose, and cinematic but realistic light."
  },
  {
    id: "postcard-crop-set",
    title: "Postcard Crop Set",
    description: "Prepare profile, story, and memory-card crops from route portrait outputs.",
    category: "Delivery tools",
    prompt: "Create a travel postcard portrait crop set with consistent color, clean composition, and social-ready framing."
  },
  {
    id: "travel-motion-concept",
    title: "Travel Motion Concept",
    description: "Create short route-story motion ideas from finished travel portraits.",
    category: "Delivery tools",
    prompt: "Create a short travel portrait motion concept with subtle camera movement and natural destination atmosphere."
  }
];

function normalizeToolId(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/_/g, "-");
}

function fieldValueDefault(field: AiWorkflowField): string | number | boolean {
  if ("default" in field && field.default !== undefined) return field.default;
  if ((field.type === "select" || field.type === "radio") && field.options[0]) return field.options[0].value;
  if (field.type === "number") return field.min ?? 0;
  if (field.type === "boolean") return false;
  return "";
}

function fieldsFromParameterSchema(app: SiteAiApp): AiWorkflowField[] {
  return app.aiApp.parameterSchema.map((field) => (
    field.type === "select"
      ? {
          id: field.id,
          label: field.label,
          type: "select",
          required: true,
          options: (field.options ?? []).map((option) => ({ label: option, value: option })),
          default: field.options?.[0] ?? ""
        }
      : {
          id: field.id,
          label: field.label,
          type: "text",
          required: true,
          placeholder: field.label,
          default: ""
        }
  ));
}

function defaultWorkflow(app: SiteAiApp): AiWorkflowConfig {
  return {
    version: 1,
    flowName: app.aiApp.name,
    description: app.aiApp.description,
    submitLabel: "Start generation",
    materialRules: [
      "Use clear private photos where the face or product is visible.",
      "Attach 1-4 private uploads before starting the request.",
      "Only files in this signed-in customer account are available here."
    ],
    steps: [
      {
        id: "source_photos",
        title: "Select private photos",
        description: "Choose private uploads for this request.",
        kind: "asset_select",
        assetRules: { min: 1, max: 4, roles: ["input"], accept: ["image/*"], required: true }
      },
      {
        id: "generation_options",
        title: "Set generation options",
        description: "Choose the direction for the generated album.",
        kind: "fields",
        fields: fieldsFromParameterSchema(app)
      },
      {
        id: "review_request",
        title: "Review request",
        description: "Confirm credits, delivery and selected private photos.",
        kind: "review"
      }
    ]
  };
}

function workflowFor(app?: SiteAiApp): AiWorkflowConfig | undefined {
  if (!app) return undefined;
  const config = app.workflowConfig ?? defaultWorkflow(app);
  const hasAsset = config.steps.some((step) => step.kind === "asset_select");
  const hasFields = config.steps.some((step) => step.kind === "fields");
  return {
    ...config,
    steps: [
      ...(hasAsset ? [] : defaultWorkflow(app).steps.filter((step) => step.kind === "asset_select")),
      ...config.steps,
      ...(hasFields ? [] : [defaultWorkflow(app).steps.find((step) => step.kind === "fields") as AiWorkflowStep])
    ]
  };
}

function workflowFields(workflow?: AiWorkflowConfig): AiWorkflowField[] {
  return workflow?.steps.flatMap((step) => step.kind === "fields" ? step.fields ?? [] : []) ?? [];
}

function assetRules(workflow?: AiWorkflowConfig) {
  return workflow?.steps.find((step) => step.kind === "asset_select")?.assetRules ?? { min: 1, max: 4, roles: ["input"] };
}

function maxAssetsForWorkflow(workflow?: AiWorkflowConfig): number {
  const configuredMax = assetRules(workflow).max;
  return Math.min(configuredMax && configuredMax > 0 ? configuredMax : DEFAULT_MAX_SOURCE_ASSETS, DEFAULT_MAX_SOURCE_ASSETS);
}

function valuesFor(app?: SiteAiApp): Record<string, string | number | boolean> {
  return Object.fromEntries(workflowFields(workflowFor(app)).map((field) => [field.id, fieldValueDefault(field)]));
}

function assetsForRules(assets: ThemeRuntimeAsset[], workflow?: AiWorkflowConfig): ThemeRuntimeAsset[] {
  const roles = assetRules(workflow).roles ?? ["input"];
  return assets.filter((asset) => roles.includes(asset.role));
}

function initialSelectedAssets(assets: ThemeRuntimeAsset[], workflow?: AiWorkflowConfig): string[] {
  const maxAssets = maxAssetsForWorkflow(workflow);
  return assetsForRules(assets, workflow).slice(0, maxAssets).map((asset) => asset.id);
}

function mergeAssetLists(primary: ThemeRuntimeAsset[], secondary: ThemeRuntimeAsset[]): ThemeRuntimeAsset[] {
  const seen = new Set(primary.map((asset) => asset.id));
  return [...primary, ...secondary.filter((asset) => !seen.has(asset.id))];
}

function packsForApp(packs: CreativePack[], aiAppSlug: string): CreativePack[] {
  return packs.filter((pack) => pack.status === "active" && pack.aiAppSlug === aiAppSlug);
}

function modeForInitialState(initialCreativePackId: string | undefined, initialToolId: string | undefined, initialPack: CreativePack | undefined, creativePacks: CreativePack[]): CreateMode {
  if (initialCreativePackId) return "theme";
  if (initialToolId && !initialCreativePackId) return "tool";
  if (initialPack?.id) return "theme";
  return creativePacks.some((pack) => pack.status === "active") ? "theme" : "tool";
}

function fieldsForMode(fields: AiWorkflowField[], mode: CreateMode): AiWorkflowField[] {
  const filteredFields = fields.filter((field) => {
    const id = field.id.toLowerCase();
    const label = field.label.toLowerCase();
    return !["style", "prompt", "outputcount", "output_count"].includes(id) && !label.includes("style");
  });
  if (mode === "theme") return filteredFields;
  const hasPrompt = filteredFields.some((field) => field.id === TOOL_PROMPT_FIELD_ID);
  return hasPrompt
    ? filteredFields
    : [
        {
          id: TOOL_PROMPT_FIELD_ID,
          label: "Prompt",
          type: "textarea",
          required: true,
          placeholder: "Describe the exact edit or image direction you want.",
          default: "",
          helpText: "Keep it specific, lawful, and safe for private generation."
        },
        ...filteredFields
      ];
}

function valuesForMode(app: SiteAiApp | undefined, mode: CreateMode): Record<string, string | number | boolean> {
  const baseValues = valuesFor(app);
  delete baseValues.style;
  delete baseValues.outputCount;
  delete baseValues.output_count;
  if (mode === "theme") {
    const cleanValues = { ...baseValues };
    delete cleanValues.prompt;
    cleanValues.outputCount = DEFAULT_THEME_OUTPUT_COUNT;
    return cleanValues;
  }
  return { [TOOL_PROMPT_FIELD_ID]: "", ...baseValues };
}

function blockedPromptTerm(prompt: string): string | undefined {
  const normalized = prompt.toLowerCase().replace(/\s+/g, " ").trim();
  return TOOL_PROMPT_BLOCKLIST.find((term) => normalized.includes(term));
}

function uploadLabelForFile(file: File, index: number, total: number): string {
  const base = file.name.replace(/\.[^.]+$/, "").trim() || "private photo";
  return total > 1 ? `${base} ${index + 1}` : base;
}

function jobErrorMessage(error?: string, status?: number): string {
  if (status === 401 || error === "customer_login_required") {
    return "Please sign in again before starting this photo set.";
  }
  if (status === 403 || error?.includes("csrf")) {
    return "Your secure session expired. Refresh the page, then try again.";
  }
  if (error === "asset_not_found_for_customer") {
    return "One selected private photo is no longer available in this account. Reselect your photos and try again.";
  }
  if (error === "not_enough_source_assets") {
    return "Select the required private photos before starting this request.";
  }
  if (error === "too_many_source_assets") {
    return "Too many private photos are selected for this package. Reduce the selection and try again.";
  }
  if (error === "missing_required_prompt_input") {
    return "This tool is missing a required setting. Reopen the tool or choose a photo package and try again.";
  }
  if (error === "insufficient_credits") {
    return "You do not have enough credits for this request. Please add credits or choose a smaller package.";
  }
  if (error === "subscription_required") {
    return "Choose an active subscription before starting generation. Credits are your monthly balance, but generation also requires a current plan.";
  }
  if (error === "generation_job_already_running") {
    return "One photo request is already running. Wait for it to finish before starting a new one.";
  }
  if (error === "customer_past_due") {
    return "Your account needs billing attention before starting a new request.";
  }
  if (error === "customer_blocked") {
    return "This account cannot start new requests right now. Contact support for help.";
  }
  if (error === "site_ai_app_not_found" || error === "ai_app_not_found" || error === "ai_app_not_enabled_for_site") {
    return "This AI tool is no longer available. Choose another tool and try again.";
  }
  if (error === "creative_pack_not_found_for_site" || error === "creative_pack_tool_mismatch") {
    return "This photo package is no longer available for the selected tool. Choose the package again and retry.";
  }
  if (error === "job_create_timeout") {
    return "The job service timed out while creating this request. Please try again in a moment.";
  }
  return "We could not start this photo set. Please check your selection and try again.";
}

function displayMaterialRule(rule: string): string {
  return rule
    .replace(/source photos/gi, "private photos")
    .replace(/Attach\s+1[-–]4\s+private uploads before starting the request\./i, "Attach the private photos you want to use before starting the request.")
    .replace(/1[-–]4\s+private upload files/i, "one or more private upload files")
    .replace(/1\s*[-–]\s*4\s+uploaded images/i, "one or more uploaded images");
}

function buildToolPresets(siteAiApps: SiteAiApp[], siteSlug: string): ToolPreset[] {
  const firstBackendSlug = siteAiApps[0]?.aiApp.slug;
  const presetLibrary = /aidreamcapes/i.test(siteSlug) ? AIDREAMCAPES_TOOL_PRESET_LIBRARY : TOOL_PRESET_LIBRARY;
  const realTools = siteAiApps.map((app) => ({
    id: normalizeToolId(app.aiApp.slug),
    title: app.aiApp.name,
    description: app.aiApp.description,
    category: "Enabled tools",
    creditCost: app.creditCost,
    backendSlug: app.aiApp.slug,
    prompt: ""
  }));
  const library = presetLibrary.map((preset) => ({
    ...preset,
    backendSlug: siteAiApps.find((app) => normalizeToolId(app.aiApp.slug) === preset.id)?.aiApp.slug ?? firstBackendSlug,
    creditCost: siteAiApps.find((app) => normalizeToolId(app.aiApp.slug) === preset.id)?.creditCost ?? siteAiApps[0]?.creditCost
  })).filter((preset) => Boolean(preset.backendSlug));
  return Array.from(new Map([...realTools, ...library].map((preset) => [preset.id, preset])).values());
}

const packageAudienceOptions: Array<{ id: PackageAudience; title: string; description: string; helper: string }> = [
  { id: "self", title: "For Myself", description: "Generate photos of the primary person in this model.", helper: "Uses your selected photos as the main subject." },
  { id: "partner", title: "For My Partner", description: "Generate photos focused on the partner profile.", helper: "Uses partner photos as the main subject when partner samples are selected." },
  { id: "both", title: "For Both of Us", description: "Generate couple-style photos using both profiles.", helper: "Combines your photos and partner photos for couple-style outputs." }
];

export function JobCreateForm({
  siteId,
  siteSlug,
  customer,
  siteAiApps,
  creativePacks = [],
  initialCreativePackId,
  initialToolId,
  assets = [],
  externalSourceAssets,
  externalPrimaryAssetIds,
  externalPartnerAssetIds,
  customerModels = [],
  emptyTitle = "No enabled album experience.",
  emptyBody = "Enable an album experience for this site before publishing this form.",
  tone = "dark",
  preferProvidedAssets = false,
  preferredMode,
  preferredModeRequest,
  operationContext,
  subscriptionStatus = "active",
  trainingMode = "single",
  onJobCreated,
  onContinueToSources,
  onReviewCurrentRequest,
  onOpenUploadManager
}: {
  siteId: string;
  siteSlug: string;
  customer: PublicCustomer;
  siteAiApps: SiteAiApp[];
  creativePacks?: CreativePack[];
  initialCreativePackId?: string;
  initialToolId?: string;
  assets?: ThemeRuntimeAsset[];
  externalSourceAssets?: ThemeRuntimeAsset[];
  externalPrimaryAssetIds?: string[];
  externalPartnerAssetIds?: string[];
  customerModels?: ThemeRuntimeCustomerModel[];
  emptyTitle?: string;
  emptyBody?: string;
  tone?: "dark" | "light";
  preferProvidedAssets?: boolean;
  preferredMode?: CreateMode;
  preferredModeRequest?: number;
  operationContext?: OperationContext;
  subscriptionStatus?: SubscriptionStatus;
  trainingMode?: "single" | "couple";
  onJobCreated?: (jobId: string, feedback?: CreatedJobFeedback) => void;
  onContinueToSources?: () => void;
  onReviewCurrentRequest?: () => void;
  onOpenUploadManager?: () => void;
}) {
  const normalizedInitialToolId = normalizeToolId(initialToolId);
  const toolPresets = useMemo(() => buildToolPresets(siteAiApps, siteSlug), [siteAiApps, siteSlug]);
  const initialPack =
    creativePacks.find((pack) => pack.status === "active" && pack.id === initialCreativePackId) ??
    creativePacks.find((pack) => pack.status === "active" && (normalizeToolId(pack.aiAppSlug) === normalizedInitialToolId || pack.id === initialToolId));
  const initialToolPreset = toolPresets.find((preset) => preset.id === normalizedInitialToolId) ?? toolPresets[0];
  const initialApp =
    (initialToolPreset?.backendSlug ? siteAiApps.find((app) => app.aiApp.slug === initialToolPreset.backendSlug) : undefined) ??
    (initialToolId ? siteAiApps.find((app) => normalizeToolId(app.aiApp.slug) === normalizedInitialToolId || app.aiApp.slug === initialToolId) : undefined) ??
    (initialPack ? siteAiApps.find((app) => app.aiApp.slug === initialPack.aiAppSlug) ?? siteAiApps[0] : siteAiApps[0]);
  const initialMode = modeForInitialState(initialCreativePackId, initialToolId, initialPack, creativePacks);
  const [aiAppSlug, setAiAppSlug] = useState(initialApp?.aiApp.slug ?? "");
  const [selectedToolId, setSelectedToolId] = useState(() => initialToolPreset?.id ?? normalizeToolId(initialApp?.aiApp.slug));
  const [creativePackId, setCreativePackId] = useState(() => initialPack?.id ?? packsForApp(creativePacks, initialApp?.aiApp.slug ?? "")[0]?.id ?? "");
  const [createMode, setCreateMode] = useState<CreateMode>(initialMode);
  const [themeCategory, setThemeCategory] = useState("all");
  const [formValues, setFormValues] = useState<Record<string, string | number | boolean>>(() => valuesForMode(initialApp, initialMode));
  const [themeOutputCount, setThemeOutputCount] = useState(DEFAULT_THEME_OUTPUT_COUNT);
  const initialAvailableAssets = externalSourceAssets?.length ? mergeAssetLists(externalSourceAssets, assets) : assets;
  const [availableAssets, setAvailableAssets] = useState(initialAvailableAssets);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>(() => externalPrimaryAssetIds ?? initialSelectedAssets(initialAvailableAssets, workflowFor(initialApp)));
  const [partnerSelectedAssetIds, setPartnerSelectedAssetIds] = useState<string[]>(() => externalPartnerAssetIds ?? []);
  const [selectedCustomerModelId, setSelectedCustomerModelId] = useState(() => customerModels.find((model) => model.status === "ready")?.id ?? customerModels[0]?.id ?? "");
  const [packageAudience, setPackageAudience] = useState<PackageAudience>(() => customerModels[0]?.modelType === "couple" ? "both" : "self");
  const [message, setMessage] = useState("Choose a package, upload or select selfies, then review your private AI photoshoot.");
  const [dialogMessage, setDialogMessage] = useState("");
  const [dialogTone, setDialogTone] = useState<"info" | "success" | "error">("info");
  const [pending, setPending] = useState(false);
  const [uploadingSources, setUploadingSources] = useState(false);
  const [packageDialogOpen, setPackageDialogOpen] = useState(false);
  const [packagePromptDraft, setPackagePromptDraft] = useState("");
  const [deletingAssetIds, setDeletingAssetIds] = useState<string[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(() => !preferProvidedAssets && assets.length === 0);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showAllOptions, setShowAllOptions] = useState(false);
  const localAssetMutationRef = useRef(0);
  const sourceUploadInputRef = useRef<HTMLInputElement | null>(null);
  const pendingUploadTargetRef = useRef<UploadTarget>("primary");
  const selectedApp = siteAiApps.find((app) => app.aiApp.slug === aiAppSlug) ?? siteAiApps[0];
  const activeCreativePacks = creativePacks.filter((pack) => pack.status === "active");
  const themeCategories = Array.from(new Set(activeCreativePacks.map((pack) => pack.categoryRecord?.label || pack.category).filter(Boolean)));
  const visibleCreativePacks = themeCategory === "all"
    ? activeCreativePacks
    : activeCreativePacks.filter((pack) => (pack.categoryRecord?.label || pack.category) === themeCategory);
  const categoryOptions = ["all", ...themeCategories];
  const displayedCategoryOptions = showAllCategories ? categoryOptions : categoryOptions.slice(0, COLLAPSED_CATEGORY_LIMIT);
  const hasMoreCategories = categoryOptions.length > COLLAPSED_CATEGORY_LIMIT;
  const displayedCreativePacks = showAllOptions ? visibleCreativePacks : visibleCreativePacks.slice(0, COLLAPSED_THEME_CARD_LIMIT);
  const displayedToolPresets = showAllOptions ? toolPresets : toolPresets.slice(0, COLLAPSED_TOOL_CARD_LIMIT);
  const hiddenOptionCount = createMode === "theme"
    ? Math.max(visibleCreativePacks.length - displayedCreativePacks.length, 0)
    : Math.max(toolPresets.length - displayedToolPresets.length, 0);
  const appPacks = packsForApp(creativePacks, selectedApp?.aiApp.slug ?? "");
  const selectedPack = (createMode === "theme" ? activeCreativePacks : appPacks).find((pack) => pack.id === creativePackId) ?? (createMode === "theme" ? visibleCreativePacks[0] ?? activeCreativePacks[0] : appPacks[0]);
  const selectedWorkflow = workflowFor(selectedApp);
  const selectedToolPreset = toolPresets.find((preset) => preset.id === selectedToolId);
  const selectionPreviewImage = createMode === "theme" ? selectedPack?.imageUrl : undefined;
  const selectionTitle = createMode === "theme" ? selectedPack?.name ?? "Photo package" : selectedToolPreset?.title ?? selectedApp?.aiApp.name ?? "AI tool";
  const selectionDescription = createMode === "theme"
    ? selectedPack?.description || selectedPack?.headline || "Choose this package, attach selfies, then review credits before generation."
    : selectedToolPreset?.description ?? "Choose this focused tool, attach selfies, then review credits before generation.";
  const sourceAssets = assetsForRules(availableAssets, selectedWorkflow);
  const selectedCustomerModel = customerModels.find((model) => model.id === selectedCustomerModelId) ?? customerModels[0];
  const selectedFields = workflowFields(selectedWorkflow);
  const selectedAssetRules = assetRules(selectedWorkflow);
  const minAssets = 0;
  const effectiveMaxAssets = maxAssetsForWorkflow(selectedWorkflow);
  const materialRules = selectedWorkflow?.materialRules?.length ? selectedWorkflow.materialRules : selectedApp ? defaultWorkflow(selectedApp).materialRules ?? [] : [];
  const modeFields = fieldsForMode(selectedFields, createMode);
  const modeSubmitLabel = createMode === "theme" ? "Start photo package" : "Start tool";
  const requestOutputCount = createMode === "theme" ? themeOutputCount : selectedPack?.outputCount ?? 1;
  const unitCreditCost = createMode === "theme" ? selectedPack?.creditCost ?? selectedApp?.creditCost ?? 0 : selectedToolPreset?.creditCost ?? selectedApp?.creditCost ?? 0;
  const billableOutputCount = createMode === "theme" ? Math.max(1, requestOutputCount) : 1;
  const selectionCreditCost = unitCreditCost * billableOutputCount;
  const selectionUnitCostLabel = createMode === "theme" ? `${unitCreditCost} per image` : `${unitCreditCost} per request`;
  const selectionOutputLabel = createMode === "theme" ? String(requestOutputCount) : "Tool result";
  const configureSelectionLabel = createMode === "theme" ? "Configure package" : "Configure tool";
  const selectedRequestAssetIds = Array.from(new Set([...selectedAssetIds, ...partnerSelectedAssetIds])).slice(0, effectiveMaxAssets);
  const light = tone === "light";
  const pricingHref = `/site/${siteSlug}/pricing`;
  const subscriptionGateMessage = subscriptionStatus === "loading"
    ? "Checking your subscription before generation. You can keep preparing photos while this loads."
    : subscriptionStatus === "required"
      ? "Start a subscription before generating. Credits are your monthly balance; a current plan unlocks workspace requests."
      : "";
  const creditsUsageNote = createMode === "theme"
    ? `${unitCreditCost} credits are spent for each generated image. This request will spend ${selectionCreditCost} credits for ${requestOutputCount} image${requestOutputCount === 1 ? "" : "s"}.`
    : `${selectionCreditCost} credits are spent for this tool request.`;
  const subscriptionGateClass = subscriptionStatus === "required"
    ? (light ? "border-[#efb483] bg-[#fff5eb] text-[#8c4a13]" : "border-[#f59e0b]/35 bg-[#f59e0b]/10 text-[#ffdca8]")
    : (light ? "border-[#dfd3c4] bg-white text-[#625d56]" : "border-white/10 bg-white/[0.05] text-white/68");
  const canStartRequest = Boolean(aiAppSlug && selectedRequestAssetIds.length <= effectiveMaxAssets && subscriptionStatus === "active");
  const selectedSourceAssets = sourceAssets.filter((asset) => selectedRequestAssetIds.includes(asset.id));
  const primarySourceAssets = sourceAssets.filter((asset) => selectedAssetIds.includes(asset.id));
  const partnerSourceAssets = sourceAssets.filter((asset) => partnerSelectedAssetIds.includes(asset.id));
  const isCoupleFlow = trainingMode === "couple" || selectedCustomerModel?.modelType === "couple" || packageAudience === "both";
  const selectedModelLabel = selectedCustomerModel?.label ?? (selectedSourceAssets.length ? "Uploaded selfies" : "No model selected");
  const textClass = light ? "text-[#171514]" : "text-white";
  const mutedClass = light ? "text-[#6f675e]" : "text-white/62";
  const eyebrowClass = light ? "text-[#9b6b42]" : "text-white/48";
  const panelClass = light ? "border-[#eadfce] bg-white text-[#171514]" : "border-white/10 bg-white/[0.04] text-white";
  const subtlePanelClass = light ? "border-[#eadfce] bg-[#fffaf3]" : "border-white/10 bg-black/16";
  const dialogStatusClass = dialogTone === "error"
    ? (light ? "border-[#f0b7a5] bg-[#fff1ee] text-[#8d2d1b]" : "border-red-400/30 bg-red-500/10 text-red-100")
    : dialogTone === "success"
      ? (light ? "border-[#b9d8bd] bg-[#f1fff2] text-[#286139]" : "border-emerald-300/25 bg-emerald-400/10 text-emerald-100")
      : (light ? "border-[#dfd3c4] bg-white text-[#625d56]" : "border-white/10 bg-white/[0.05] text-white/72");
  const fieldClass = light
    ? "border-[#dfd3c4] bg-white text-[#171514] placeholder:text-[#9d9388]"
    : "border-white/10 bg-white/[0.05] text-white placeholder:text-white/35";
  const primaryButtonClass = light
    ? "bg-[linear-gradient(135deg,#ff8a5c_0%,#ec4bdd_52%,#16dcf0_100%)] text-white shadow-[0_14px_34px_-24px_rgba(236,75,221,0.75)] hover:brightness-105"
    : "bg-white text-[#14161a]";
  const selectedCardClass = light ? "border-[#ff8a5c]/55 bg-[linear-gradient(135deg,#fff1e7_0%,#fff8ef_58%,#edfaff_100%)] text-[#171514] shadow-[0_16px_42px_-34px_rgba(224,105,63,0.5)]" : "border-white bg-white text-[#14161a]";
  const neutralCardClass = light ? "border-[#eadfce] bg-white text-[#171514]" : "border-white/10 bg-white/[0.04] text-white";
  const selectedPillClass = light ? "bg-[#132329] text-white" : "bg-[#14161a] text-white";
  const selectedSoftPillClass = light ? "bg-white text-[#c65f32] ring-1 ring-[#ffd0b8]" : "bg-[#14161a]/10 text-[#14161a]";
  const neutralPillClass = light ? "bg-[#f1eadf] text-[#5f574f]" : "bg-white/[0.08] text-white/74";

  useEffect(() => {
    setAvailableAssets((current) => mergeAssetLists(current, assets));
  }, [assets]);

  useEffect(() => {
    if (!externalSourceAssets) return;
    setAvailableAssets((current) => mergeAssetLists(externalSourceAssets, current));
  }, [externalSourceAssets]);

  useEffect(() => {
    if (!externalPrimaryAssetIds) return;
    setSelectedAssetIds(externalPrimaryAssetIds.slice(0, DEFAULT_MAX_SOURCE_ASSETS));
  }, [externalPrimaryAssetIds]);

  useEffect(() => {
    if (!externalPartnerAssetIds) return;
    setPartnerSelectedAssetIds(externalPartnerAssetIds.slice(0, DEFAULT_MAX_SOURCE_ASSETS));
  }, [externalPartnerAssetIds]);

  useEffect(() => {
    if (selectedCustomerModelId && customerModels.some((model) => model.id === selectedCustomerModelId)) return;
    const nextModel = customerModels.find((model) => model.status === "ready") ?? customerModels[0];
    if (nextModel) {
      setSelectedCustomerModelId(nextModel.id);
      setPackageAudience(nextModel.modelType === "couple" ? "both" : "self");
    }
  }, [customerModels, selectedCustomerModelId]);

  useEffect(() => {
    let cancelled = false;
    const loadAssets = (refresh = false) => {
      if (refresh) invalidateCustomerAssets(siteId, customer.id);
      const mutationVersion = localAssetMutationRef.current;
      setLoadingAssets(true);
      loadCustomerAssets(siteId, customer.id, 100, "source-picker")
        .then((result) => {
          if (!cancelled) {
            let nextAssets = result;
            setAvailableAssets((current) => {
              nextAssets = mutationVersion === localAssetMutationRef.current ? result : mergeAssetLists(current, result);
              return nextAssets;
            });
            setSelectedAssetIds((current) => current.filter((id) => nextAssets.some((asset) => asset.id === id)));
            setPartnerSelectedAssetIds((current) => current.filter((id) => nextAssets.some((asset) => asset.id === id)));
            setLoadingAssets(false);
          }
        })
        .catch(() => {
          if (!cancelled) setLoadingAssets(false);
        });
    };
    const handleAssetsUpdated = () => loadAssets(true);
    if (preferProvidedAssets) {
      setLoadingAssets(false);
    } else {
      loadAssets();
    }
    window.addEventListener("customer-assets:updated", handleAssetsUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener("customer-assets:updated", handleAssetsUpdated);
    };
  }, [customer.id, preferProvidedAssets, siteId]);

  function selectedTotalAfterToggle(assetId: string, target: "primary" | "partner", currentTargetIds: string[]): number {
    const nextTargetIds = currentTargetIds.includes(assetId)
      ? currentTargetIds.filter((id) => id !== assetId)
      : [...currentTargetIds, assetId];
    const otherIds = target === "primary" ? partnerSelectedAssetIds : selectedAssetIds;
    return new Set([...nextTargetIds, ...otherIds]).size;
  }

  function toggleAsset(assetId: string, target: "primary" | "partner" = "primary") {
    const setter = target === "primary" ? setSelectedAssetIds : setPartnerSelectedAssetIds;
    setter((current) => {
      if (!current.includes(assetId) && selectedTotalAfterToggle(assetId, target, current) > effectiveMaxAssets) return current;
      return current.includes(assetId) ? current.filter((id) => id !== assetId) : [...current, assetId];
    });
  }

  function updateAiApp(nextSlug: string, nextMode: CreateMode = createMode) {
    setAiAppSlug(nextSlug);
    const nextApp = siteAiApps.find((app) => app.aiApp.slug === nextSlug);
    setCreativePackId(packsForApp(creativePacks, nextSlug)[0]?.id ?? "");
    setFormValues(valuesForMode(nextApp, nextMode));
    setSelectedAssetIds(initialSelectedAssets(availableAssets, workflowFor(nextApp)).slice(0, DEFAULT_MAX_SOURCE_ASSETS));
    setPartnerSelectedAssetIds([]);
  }

  function updateCreativePack(pack: CreativePack) {
    setCreateMode("theme");
    setThemeCategory(pack.categoryRecord?.label || pack.category || "all");
    setCreativePackId(pack.id);
    setPackagePromptDraft(pack.prompt?.trim() || pack.description || pack.headline || "");
    if (pack.aiAppSlug !== aiAppSlug) {
      updateAiApp(pack.aiAppSlug, "theme");
      setCreativePackId(pack.id);
    }
  }

  function updateField(id: string, value: string | number | boolean) {
    setFormValues((current) => ({ ...current, [id]: value }));
  }

  function updateCreateMode(nextMode: CreateMode) {
    setCreateMode(nextMode);
    setMessage(nextMode === "theme" ? "Choose a package, upload or select selfies, then review your private AI photoshoot." : "Describe the result you want, attach selfies, then review this tool request.");
    setFormValues((current) => {
      if (nextMode === "theme") {
        const next: Record<string, string | number | boolean> = { ...current, outputCount: themeOutputCount };
        delete next.prompt;
        delete next.style;
        delete next.output_count;
        return next;
      }
      return {
        ...current,
        [TOOL_PROMPT_FIELD_ID]: String(current[TOOL_PROMPT_FIELD_ID] || toolPresets.find((preset) => preset.id === selectedToolId)?.prompt || "")
      };
    });
    if (nextMode === "theme" && !creativePackId) {
      setCreativePackId(appPacks[0]?.id ?? creativePacks.find((pack) => pack.status === "active")?.id ?? "");
    }
  }

  function updateToolPreset(preset: ToolPreset) {
    if (!preset.backendSlug) return;
    setCreateMode("tool");
    setSelectedToolId(preset.id);
    if (preset.backendSlug !== aiAppSlug) {
      setAiAppSlug(preset.backendSlug);
      const nextApp = siteAiApps.find((app) => app.aiApp.slug === preset.backendSlug);
      setSelectedAssetIds(initialSelectedAssets(availableAssets, workflowFor(nextApp)).slice(0, DEFAULT_MAX_SOURCE_ASSETS));
    }
    setFormValues((current) => ({
      ...valuesForMode(siteAiApps.find((app) => app.aiApp.slug === preset.backendSlug), "tool"),
      ...current,
      [TOOL_PROMPT_FIELD_ID]: String(current[TOOL_PROMPT_FIELD_ID] || preset.prompt)
    }));
    setMessage("Describe the result you want, attach selfies, then review this tool request.");
  }

  function openPackageDialog() {
    setDialogMessage("");
    setDialogTone("info");
    if (createMode === "theme" && selectedPack) {
      setPackagePromptDraft((current) => current || selectedPack.prompt?.trim() || selectedPack.description || selectedPack.headline || "");
    }
    if (createMode === "tool" && selectedToolPreset) {
      setPackagePromptDraft((current) => current || String(formValues[TOOL_PROMPT_FIELD_ID] || selectedToolPreset.prompt || ""));
    }
    setPackageDialogOpen(true);
  }

  function selectCreativePackAndOpen(pack: CreativePack) {
    updateCreativePack(pack);
    setDialogMessage("");
    setDialogTone("info");
    setPackagePromptDraft(pack.prompt?.trim() || pack.description || pack.headline || "");
    setPackageDialogOpen(true);
  }

  function selectToolPresetAndOpen(preset: ToolPreset) {
    updateToolPreset(preset);
    setDialogMessage("");
    setDialogTone("info");
    setPackagePromptDraft(String(formValues[TOOL_PROMPT_FIELD_ID] || preset.prompt || ""));
    setPackageDialogOpen(true);
  }

  function updateThemeCategory(nextCategory: string) {
    setThemeCategory(nextCategory);
    const nextPacks = nextCategory === "all"
      ? activeCreativePacks
      : activeCreativePacks.filter((pack) => (pack.categoryRecord?.label || pack.category) === nextCategory);
    if (nextPacks.length && !nextPacks.some((pack) => pack.id === creativePackId)) {
      updateCreativePack(nextPacks[0]);
      setThemeCategory(nextCategory);
    }
  }

  function reviewCurrentRequest() {
    if (onReviewCurrentRequest) {
      onReviewCurrentRequest();
      return;
    }
    if (typeof window === "undefined") return;
    window.history.replaceState(null, "", "#review-current-request");
    window.setTimeout(() => {
      document.getElementById("review-current-request")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function continueToReviewOrSelfies() {
    openPackageDialog();
  }

  function openSourceUploadPicker() {
    sourceUploadInputRef.current?.click();
  }

  useEffect(() => {
    const handleOpenUpload = (event: Event) => {
      const target = (event as CustomEvent<{ target?: UploadTarget }>).detail?.target;
      pendingUploadTargetRef.current = target === "partner" ? "partner" : "primary";
      openSourceUploadPicker();
    };
    window.addEventListener("customer-workspace:open-source-upload", handleOpenUpload);
    return () => window.removeEventListener("customer-workspace:open-source-upload", handleOpenUpload);
  }, []);

  useEffect(() => {
    if (!preferredMode || preferredMode === createMode) return;
    if (preferredMode === "tool") {
      const nextPreset = toolPresets.find((preset) => preset.id === selectedToolId) ?? toolPresets[0];
      updateCreateMode("tool");
      if (nextPreset) updateToolPreset(nextPreset);
      return;
    }
    const nextPack = activeCreativePacks.find((pack) => pack.id === creativePackId) ?? visibleCreativePacks[0] ?? activeCreativePacks[0];
    updateCreateMode("theme");
    if (nextPack) updateCreativePack(nextPack);
  }, [preferredMode, preferredModeRequest]);

  useEffect(() => {
    const action = operationContext?.action?.trim();
    const note = operationContext?.note?.trim();
    if (!action && !note) return;
    const summary = [action ? `Selected operation: ${action}.` : "", note ? `Direction: ${note}` : ""].filter(Boolean).join(" ");
    if (createMode === "tool" && summary) {
      setFormValues((current) => {
        const currentPrompt = String(current[TOOL_PROMPT_FIELD_ID] ?? "").trim();
        if (currentPrompt.includes(summary)) return current;
        return {
          ...current,
          [TOOL_PROMPT_FIELD_ID]: currentPrompt ? `${summary}\n\n${currentPrompt}` : summary
        };
      });
    }
  }, [operationContext?.action, operationContext?.note, preferredModeRequest, createMode]);

  async function uploadSourceFiles(files: FileList | null) {
    const imageFiles = Array.from(files ?? []).filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) {
      setMessage("Choose one or more image files before uploading.");
      return;
    }
    setUploadingSources(true);
    setMessage(`Uploading ${imageFiles.length} private photo${imageFiles.length === 1 ? "" : "s"}...`);
    const createdAssets: ThemeRuntimeAsset[] = [];
    for (const [index, file] of imageFiles.entries()) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("label", uploadLabelForFile(file, index, imageFiles.length));
      formData.append("role", "input");
      const response = await fetch(`/api/sites/${siteId}/customers/${customer.id}/assets`, {
        method: "POST",
        headers: csrfHeader(`customer_csrf_${siteId}`),
        body: formData
      });
      const result = (await response.json().catch(() => ({}))) as { asset?: ThemeRuntimeAsset; error?: string };
      if (!response.ok || !result.asset) {
        setMessage(`We could not upload ${file.name}. Please check the file and try again.`);
        setUploadingSources(false);
        return;
      }
      createdAssets.push(result.asset);
    }
    invalidateCustomerAssets(siteId, customer.id);
    localAssetMutationRef.current += 1;
    setAvailableAssets((current) => [...createdAssets, ...current.filter((asset) => !createdAssets.some((created) => created.id === asset.id))]);
    const createdIds = createdAssets.map((asset) => asset.id);
    if (pendingUploadTargetRef.current === "partner") {
      setPartnerSelectedAssetIds((current) => [...createdIds, ...current].slice(0, effectiveMaxAssets));
    } else {
      setSelectedAssetIds((current) => [...createdIds, ...current].slice(0, effectiveMaxAssets));
    }
    setMessage(`${createdAssets.length} private photo${createdAssets.length === 1 ? "" : "s"} uploaded. Select the selfies you want to use.`);
    setUploadingSources(false);
  }

  async function deleteSourceAsset(asset: ThemeRuntimeAsset) {
    if (deletingAssetIds.includes(asset.id)) return;
    const confirmed = window.confirm(`Delete "${asset.label}" from your private model photos?`);
    if (!confirmed) return;
    setDeletingAssetIds((current) => [...current, asset.id]);
    setMessage("Deleting private photo...");
    const response = await fetch(`/api/sites/${siteId}/customers/${customer.id}/assets/${asset.id}`, {
      method: "DELETE",
      headers: csrfHeader(`customer_csrf_${siteId}`)
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    setDeletingAssetIds((current) => current.filter((id) => id !== asset.id));
    if (!response.ok) {
      setMessage(result.error?.includes("csrf") ? "Your secure session expired. Refresh the page, then try again." : "We could not delete this private photo. Please try again.");
      return;
    }
    invalidateCustomerAssets(siteId, customer.id);
    localAssetMutationRef.current += 1;
    setAvailableAssets((current) => current.filter((item) => item.id !== asset.id));
    setSelectedAssetIds((current) => current.filter((id) => id !== asset.id));
    setPartnerSelectedAssetIds((current) => current.filter((id) => id !== asset.id));
    setMessage("Private photo deleted.");
  }

  async function createJob(event?: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>) {
    event?.preventDefault();
    const showDialogError = (text: string) => {
      setDialogTone("error");
      setDialogMessage(text);
      setMessage(text);
    };
    if (createMode === "theme" && !selectedPack) {
      showDialogError("Choose a photo package before starting.");
      return;
    }
    if (subscriptionStatus === "loading") {
      showDialogError("We are still checking your subscription. Try again in a moment.");
      return;
    }
    if (subscriptionStatus === "required") {
      showDialogError("Choose a subscription before starting generation. Your workspace setup stays saved.");
      return;
    }
    if (selectedRequestAssetIds.length > effectiveMaxAssets) {
      showDialogError(`Use up to ${effectiveMaxAssets} private photos for this photo set.`);
      return;
    }
    if (selectionCreditCost > customer.balance.available) {
      showDialogError(`This request needs ${selectionCreditCost} credits, but ${customer.balance.available} are available. Add credits or choose a smaller package.`);
      return;
    }
    const missingField = modeFields.find((field) => field.required && (formValues[field.id] === "" || formValues[field.id] === undefined || formValues[field.id] === null));
    if (missingField) {
      showDialogError(`Complete ${missingField.label} before starting.`);
      return;
    }
    if (createMode === "tool") {
      const prompt = String(formValues[TOOL_PROMPT_FIELD_ID] ?? "").trim();
      const blockedTerm = blockedPromptTerm(prompt);
      if (blockedTerm) {
        showDialogError("This prompt includes unsafe or disallowed content. Please revise it before starting.");
        return;
      }
    }
    const requestFields: Record<string, unknown> = Object.fromEntries(modeFields.map((field) => [field.id, formValues[field.id] ?? fieldValueDefault(field)]));
    if (createMode === "theme") {
      requestFields.outputCount = themeOutputCount;
      requestFields.packageAudience = packageAudience;
      requestFields.customerModelLabel = selectedModelLabel;
      requestFields.creativePackName = selectedPack?.name ?? "";
      requestFields.creativePackPrompt = selectedPack?.prompt ?? "";
      requestFields.packagePrompt = packagePromptDraft.trim();
      requestFields.primaryAssetIds = selectedAssetIds;
      requestFields.partnerAssetIds = isCoupleFlow ? partnerSelectedAssetIds : [];
      requestFields.trainingMode = trainingMode;
      delete requestFields.style;
    } else {
      requestFields.toolPresetId = selectedToolId;
      requestFields.toolPresetTitle = toolPresets.find((preset) => preset.id === selectedToolId)?.title ?? "";
      requestFields.customerModelLabel = selectedModelLabel;
      requestFields.prompt = packagePromptDraft.trim() || String(formValues[TOOL_PROMPT_FIELD_ID] ?? "");
      requestFields.primaryAssetIds = selectedAssetIds;
      requestFields.partnerAssetIds = isCoupleFlow ? partnerSelectedAssetIds : [];
      requestFields.trainingMode = trainingMode;
    }
    setPending(true);
    setDialogTone("info");
    setDialogMessage("Creating the job and reserving credits. Keep this window open until the request status page opens.");
    setMessage("Starting your photo set and holding credits...");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30_000);
    let response: Response;
    try {
      response = await fetch(`/api/sites/${siteId}/ai/jobs`, {
        method: "POST",
        headers: customerJsonHeaders(siteId),
        signal: controller.signal,
        body: JSON.stringify({
          customerId: customer.id,
          aiAppSlug,
          params: {
            mode: createMode,
            creativePackId: createMode === "theme" ? selectedPack?.id : undefined,
            fields: requestFields,
            workflowVersion: selectedWorkflow?.version ?? 1,
            customerModelId: selectedCustomerModel?.id,
            assetIds: selectedRequestAssetIds,
            primaryAssetIds: selectedAssetIds,
            partnerAssetIds: isCoupleFlow ? partnerSelectedAssetIds : []
          }
        })
      });
    } catch (error) {
      window.clearTimeout(timeout);
      setPending(false);
      const text = error instanceof DOMException && error.name === "AbortError"
        ? "This request is taking longer than expected. Refresh the All tab before retrying so you do not duplicate a request that may have started."
        : "The network failed while starting this request. Please check the connection and try again.";
      showDialogError(text);
      return;
    }
    window.clearTimeout(timeout);
    const result = (await response.json().catch(() => ({}))) as { error?: string; job?: { id: string }; workerDispatch?: CreatedJobFeedback["workerDispatch"]; note?: string };
    if (!response.ok || !result.job) {
      setPending(false);
      showDialogError(jobErrorMessage(result.error, response.status));
      return;
    }
    const dispatchStatus = result.workerDispatch?.status;
    const dispatchMessage =
      dispatchStatus === "failed"
        ? `Job created, but the generator did not accept it: ${result.workerDispatch?.error ?? "worker_dispatch_failed"}. Opening the request status page.`
        : dispatchStatus === "skipped"
          ? "Job created and credits are held, but no generator is configured for this environment. Opening the request status page."
          : "Job created. Opening the request status page so you can follow generation progress.";
    setDialogTone("success");
    setDialogMessage(dispatchMessage);
    setMessage(dispatchMessage);
    setPending(false);
    setPackageDialogOpen(false);
    onJobCreated?.(result.job.id, { workerDispatch: result.workerDispatch, note: result.note });
  }

  function renderPhotoPicker(title: string, description: string, target: "primary" | "partner", selectedIds: string[]) {
    return (
      <div className={`grid gap-3 rounded-[16px] border p-3 ${subtlePanelClass}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={`text-sm font-semibold ${textClass}`}>{title}</p>
            <p className={`mt-1 text-xs leading-5 ${mutedClass}`}>{description}</p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${light ? "border-[#eadfce] bg-white text-[#625d56]" : "border-white/10 bg-white/[0.05] text-white/62"}`}>
            {selectedIds.length} selected
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {sourceAssets.map((asset) => {
            const checked = selectedIds.includes(asset.id);
            const deleting = deletingAssetIds.includes(asset.id);
            return (
              <div className={`group relative overflow-hidden rounded-[14px] border transition ${checked ? (light ? "border-[#ff8a5c] bg-[#fff1e7] text-[#171514] shadow-[0_12px_30px_-24px_rgba(224,105,63,0.58)]" : "border-white bg-white text-[#14161a]") : (light ? "border-[#eadfce] bg-white text-[#171514]" : "border-white/10 bg-black/18 text-white")} ${deleting ? "opacity-55" : ""}`} key={`${target}_${asset.id}`}>
                <img className="aspect-[4/5] w-full object-cover" src={asset.previewUrl} alt={asset.label} />
                <button
                  aria-label={`Delete ${asset.label}`}
                  className="absolute left-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/62 text-white opacity-90 shadow-sm transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={deleting}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void deleteSourceAsset(asset);
                  }}
                  title="Delete private photo"
                  type="button"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
                <button
                  aria-pressed={checked}
                  className="absolute inset-0 cursor-pointer"
                  disabled={deleting}
                  onClick={() => toggleAsset(asset.id, target)}
                  type="button"
                >
                  <span className="sr-only">{checked ? "Deselect" : "Select"} {asset.label}</span>
                </button>
                <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/76 to-transparent p-2 text-white">
                  <span className="block truncate text-xs font-semibold">{asset.label}</span>
                </span>
                <input aria-label={`Use ${asset.label}`} checked={checked} className="absolute right-2 top-2 z-10 h-4 w-4" disabled={deleting} onChange={() => toggleAsset(asset.id, target)} type="checkbox" />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (!siteAiApps.length) {
    return (
      <div className={`rounded-[20px] border border-dashed p-5 text-sm ${light ? "border-[#d8cab9] bg-[#fffaf3] text-[#706961]" : "border-white/12 bg-white/[0.03] text-white/68"}`}>
        <p className={`font-semibold ${textClass}`}>{emptyTitle}</p>
        <p className="mt-2 leading-6">{emptyBody}</p>
      </div>
    );
  }

  return (
    <form className="grid gap-5" onSubmit={createJob}>
      <div className="grid gap-5">
        <div className="grid gap-3">
        {operationContext?.action || operationContext?.note ? (
          <div className={`rounded-[16px] border p-4 ${light ? "border-[#eadfce] bg-[#fffaf3]" : "border-[#31d4ff]/35 bg-[#31d4ff]/8"}`}>
            <p className={`font-mono text-[10px] uppercase tracking-[0.16em] ${eyebrowClass}`}>Applied workspace action</p>
            <p className={`mt-2 text-sm font-semibold ${textClass}`}>{operationContext.action ?? "Custom operation"}</p>
            {operationContext.source ? <p className={`mt-1 text-xs leading-5 ${mutedClass}`}>{operationContext.source}</p> : null}
            {operationContext.note ? (
              <p className={`mt-2 text-sm leading-6 ${mutedClass}`}>{operationContext.note}</p>
            ) : (
              <p className={`mt-2 text-sm leading-6 ${mutedClass}`}>Choose a package or tool using the operation selected in the left panel.</p>
            )}
          </div>
        ) : null}
        <div>
          <p className={`font-mono text-[10px] uppercase tracking-[0.16em] ${eyebrowClass}`}>Step 01</p>
          <h3 className={`mt-2 text-xl font-semibold ${textClass}`}>{createMode === "theme" ? "Choose a photo package" : "Choose a tool"}</h3>
          <p className={`mt-2 text-sm leading-6 ${mutedClass}`}>
            {createMode === "theme"
              ? "Photo packages set the style direction, estimated outputs, credit use, and selfie needs before you upload or select images."
              : "Tools use your selfies and notes to create a focused private result."}
          </p>
        </div>
        <div className={`inline-flex w-fit max-w-full rounded-full border p-1 text-xs font-semibold ${light ? "border-[#dfd3c4] bg-[#f8f1e6]" : "border-white/10 bg-white/[0.04]"}`}>
          {[
            { mode: "theme" as const, label: "Photo packages" },
            { mode: "tool" as const, label: "Tools" }
          ].map((item) => {
            const active = createMode === item.mode;
            return (
              <button
                className={`rounded-full px-4 py-2 transition ${
                  active ? (light ? "bg-[linear-gradient(135deg,#ff8a5c_0%,#ec4bdd_55%,#16dcf0_100%)] text-white shadow-[0_10px_26px_-20px_rgba(236,75,221,0.75)]" : "bg-white text-[#14161a]") : (light ? "text-[#706961] hover:bg-white hover:text-[#171514] disabled:pointer-events-none disabled:opacity-40" : "text-white/64 hover:bg-white/[0.06] hover:text-white disabled:pointer-events-none disabled:opacity-40")
                }`}
                disabled={item.mode === "theme" ? !activeCreativePacks.length : !toolPresets.length}
                key={item.mode}
                onClick={() => {
                  if (item.mode === "theme") {
                    const nextPack = activeCreativePacks.find((pack) => pack.id === creativePackId) ?? visibleCreativePacks[0] ?? activeCreativePacks[0];
                    updateCreateMode("theme");
                    if (nextPack) updateCreativePack(nextPack);
                    return;
                  }
                  updateCreateMode("tool");
                  const nextPreset = toolPresets.find((preset) => preset.id === selectedToolId) ?? toolPresets[0];
                  if (nextPreset) updateToolPreset(nextPreset);
                }}
                type="button"
              >
                {item.label}
              </button>
            );
          })}
        </div>
        {createMode === "theme" && themeCategories.length > 1 ? (
          <div className={`rounded-[18px] border p-2 ${light ? "border-[#eadfce] bg-[#fffaf3]" : "border-white/10 bg-black/10"}`}>
            <div className="flex flex-wrap gap-2">
            {displayedCategoryOptions.map((category) => {
              const active = themeCategory === category;
              return (
                <button
                  className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                    active ? (light ? "border-[#ff8a5c] bg-[#fff1e7] text-[#b9542d] shadow-[0_10px_28px_-22px_rgba(255,138,92,0.8)]" : "border-white bg-white text-[#14161a]") : (light ? "border-[#dfd3c4] bg-white text-[#706961] hover:border-[#bcae9f] hover:text-[#171514]" : "border-white/10 bg-white/[0.04] text-white/68 hover:text-white")
                  }`}
                  key={category}
                  onClick={() => updateThemeCategory(category)}
                  type="button"
                >
                  {category === "all" ? "All packages" : category}
                </button>
              );
            })}
            {hasMoreCategories ? (
              <button
                className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${light ? "border-[#dfd3c4] bg-white text-[#706961] hover:border-[#bcae9f] hover:text-[#171514]" : "border-white/10 bg-white/[0.04] text-white/68 hover:text-white"}`}
                onClick={() => setShowAllCategories((current) => !current)}
                type="button"
              >
                {showAllCategories ? "Show less" : `View ${categoryOptions.length - displayedCategoryOptions.length} more`}
              </button>
            ) : null}
            </div>
          </div>
        ) : null}
        <div className={`grid overflow-hidden rounded-[18px] border ${light ? "border-[#eadfce] bg-white" : "border-white/10 bg-black/20"} ${createMode === "theme" ? "lg:grid-cols-[minmax(360px,1.25fr)_minmax(320px,0.75fr)]" : ""}`}>
          {createMode === "theme" ? (
            <div className={`relative min-h-[340px] ${light ? "bg-[#f7f0e7]" : "bg-white/[0.04]"}`}>
              {selectionPreviewImage ? (
                <img alt={selectionTitle} className="absolute inset-0 h-full w-full object-cover" src={selectionPreviewImage} />
              ) : (
                <div className="absolute inset-0 grid place-items-center">
                  <Sparkles className="h-8 w-8 opacity-60" strokeWidth={1.8} />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-white">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">Current selection</p>
                <p className="mt-2 text-lg font-semibold leading-tight">{selectionTitle}</p>
              </div>
            </div>
          ) : null}
          <div className="grid content-between gap-5 p-4">
            <div>
              <p className={`font-mono text-[10px] uppercase tracking-[0.16em] ${eyebrowClass}`}>{createMode === "theme" ? "Selected package" : "Selected tool"}</p>
              <h4 className={`mt-3 text-xl font-semibold ${textClass}`}>{selectionTitle}</h4>
              <p className={`mt-3 text-sm leading-6 ${mutedClass}`}>{selectionDescription}</p>
              {createMode === "tool" ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${neutralPillClass}`}>{selectedToolPreset?.category ?? "Tool"}</span>
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${neutralPillClass}`}>{selectedApp?.aiApp.name ?? "AI tool"}</span>
                </div>
              ) : null}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className={`rounded-[14px] border p-3 ${subtlePanelClass}`}>
                <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${eyebrowClass}`}>Required credits</p>
                <p className={`mt-2 text-xl font-semibold ${textClass}`}>{selectionCreditCost}</p>
                <p className={`mt-1 text-[11px] leading-4 ${mutedClass}`}>{selectionUnitCostLabel}</p>
              </div>
              <div className={`rounded-[14px] border p-3 ${subtlePanelClass}`}>
                <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${eyebrowClass}`}>Selfies</p>
                <p className={`mt-2 text-xl font-semibold ${textClass}`}>{selectedRequestAssetIds.length}/{effectiveMaxAssets}</p>
              </div>
              <div className={`rounded-[14px] border p-3 ${subtlePanelClass}`}>
                <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${eyebrowClass}`}>Output</p>
                <p className={`mt-2 text-xl font-semibold ${textClass}`}>{selectionOutputLabel}</p>
              </div>
            </div>
            <p className={`text-xs leading-5 ${mutedClass}`}>{creditsUsageNote}</p>
            {subscriptionGateMessage ? (
              <div className={`rounded-[12px] border px-3 py-2 text-xs leading-5 ${subscriptionGateClass}`} role={subscriptionStatus === "required" ? "alert" : "status"}>
                <span>{subscriptionGateMessage}</span>
                {subscriptionStatus === "required" ? (
                  <a className="ml-2 inline-flex font-semibold underline underline-offset-4" href={pricingHref}>
                    Choose a plan
                  </a>
                ) : null}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                className={`inline-flex items-center justify-center gap-2 rounded-[14px] px-4 py-2.5 text-xs font-semibold transition active:scale-[0.98] ${primaryButtonClass}`}
                onClick={openPackageDialog}
                type="button"
              >
                {configureSelectionLabel}
                <Play className="h-4 w-4" strokeWidth={1.8} />
              </button>
              <button
                className={`inline-flex items-center justify-center gap-2 rounded-[14px] border px-4 py-2.5 text-xs font-semibold transition ${
                  light ? "border-[#dfd3c4] bg-white text-[#706961] hover:border-[#bcae9f] hover:text-[#171514]" : "border-white/10 bg-white/[0.06] text-white/70 hover:bg-white/[0.1] hover:text-white"
                }`}
                onClick={openPackageDialog}
                type="button"
              >
                Review and start
              </button>
            </div>
          </div>
        </div>
        <div className={createMode === "theme" ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" : "grid gap-3 md:grid-cols-2 xl:grid-cols-3"}>
          {createMode === "theme" ? displayedCreativePacks.map((pack) => {
            const active = pack.id === selectedPack?.id;
            return (
              <button
                className={`grid min-h-[268px] content-start gap-3 rounded-[16px] border p-3 text-left transition hover:-translate-y-0.5 ${
                  active ? selectedCardClass : neutralCardClass
                }`}
                key={pack.id}
                onClick={() => selectCreativePackAndOpen(pack)}
                type="button"
              >
                <span className="overflow-hidden rounded-[12px] bg-white/[0.08]">
                  {pack.imageUrl ? (
                    <img className="aspect-[4/3] w-full object-cover" src={pack.imageUrl} alt={pack.name} />
                  ) : (
                    <span className="flex aspect-[4/3] items-center justify-center">
                      <Sparkles className="h-6 w-6 opacity-60" strokeWidth={1.8} />
                    </span>
                  )}
                </span>
                <span className="min-w-0">
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block text-base font-semibold leading-5">{pack.name}</span>
                      <span className={active ? "mt-2 line-clamp-2 block text-sm leading-5 text-[#5f5a54]" : `mt-2 line-clamp-2 block text-sm leading-5 ${mutedClass}`}>
                        {pack.headline}
                      </span>
                      <span className={active ? "mt-2 line-clamp-3 block text-xs leading-5 text-[#6b655f]" : `mt-2 line-clamp-3 block text-xs leading-5 ${light ? "text-[#776f66]" : "text-white/54"}`}>
                        {pack.description}
                      </span>
                    </span>
                    {active ? <CheckCircle2 className="h-5 w-5 shrink-0" strokeWidth={1.8} /> : null}
                  </span>
                  <span className="mt-3 flex flex-wrap gap-2">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${active ? selectedPillClass : neutralPillClass}`}>
                      {pack.creditCost} credits per image
                    </span>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${active ? selectedSoftPillClass : neutralPillClass}`}>
                      {pack.outputCount} outputs
                    </span>
                  </span>
                </span>
              </button>
            );
          }) : displayedToolPresets.map((preset) => {
            const active = preset.id === selectedToolId;
            const presetCreditCost = preset.creditCost ?? selectedApp?.creditCost ?? 0;
            return (
              <button
                className={`grid min-h-[188px] content-start gap-3 rounded-[16px] border p-4 text-left transition hover:-translate-y-0.5 ${
                  active ? selectedCardClass : neutralCardClass
                }`}
                key={preset.id}
                onClick={() => selectToolPresetAndOpen(preset)}
                type="button"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-base font-semibold leading-5">{preset.title}</span>
                    <span className={active ? "mt-2 line-clamp-2 block text-sm leading-6 text-[#5f5a54]" : `mt-2 line-clamp-2 block text-sm leading-6 ${mutedClass}`}>
                      {preset.description}
                    </span>
                  </span>
                  {active ? <CheckCircle2 className="h-5 w-5 shrink-0" strokeWidth={1.8} /> : null}
                </span>
                <span className="mt-1 flex flex-wrap gap-2">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${active ? selectedSoftPillClass : neutralPillClass}`}>
                    {preset.category}
                  </span>
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${active ? selectedPillClass : neutralPillClass}`}>
                    {presetCreditCost} credits
                  </span>
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${active ? selectedSoftPillClass : neutralPillClass}`}>
                    Tool result
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {hiddenOptionCount > 0 || showAllOptions ? (
          <div className="flex justify-center">
            <button
              className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${light ? "border-[#dfd3c4] bg-white text-[#706961] hover:border-[#bcae9f] hover:text-[#171514]" : "border-white/10 bg-white/[0.04] text-white/68 hover:border-white/24 hover:text-white"}`}
              onClick={() => setShowAllOptions((current) => !current)}
              type="button"
            >
              {showAllOptions ? "Show fewer options" : `View ${hiddenOptionCount} more ${createMode === "theme" ? "packages" : "tools"}`}
            </button>
          </div>
        ) : null}
      </div>
      <div className={`grid gap-4 rounded-[16px] border p-4 ${panelClass}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className={`font-mono text-[10px] uppercase tracking-[0.16em] ${eyebrowClass}`}>Request setup</p>
            <h4 className={`mt-2 text-base font-semibold ${textClass}`}>
              {createMode === "theme" ? "Confirm the package rules before uploading selfies." : "Confirm the tool rules before uploading selfies."}
            </h4>
          </div>
          {createMode === "theme" ? (
            <label className={`grid min-w-[150px] gap-2 text-sm font-medium ${textClass}`}>
              Estimated outputs
              <input
                className={`rounded-[14px] border px-4 py-2.5 ${fieldClass}`}
                min={1}
                onChange={(event) => setThemeOutputCount(Math.max(1, Number(event.target.value) || DEFAULT_THEME_OUTPUT_COUNT))}
                type="number"
                value={themeOutputCount}
              />
            </label>
          ) : null}
        </div>
        {createMode === "theme" && selectedPack ? (
          <div className={`rounded-[14px] border p-3 ${subtlePanelClass}`}>
            <p className={`text-sm font-semibold ${textClass}`}>{selectedPack.name}</p>
            <p className={`mt-1 text-sm leading-6 ${mutedClass}`}>{selectedPack.description || selectedPack.headline}</p>
          </div>
        ) : null}
        <div className="grid gap-2 md:grid-cols-2">
          {materialRules.map((rule) => (
            <div className={`flex gap-2 text-sm leading-6 ${light ? "text-[#625d56]" : "text-white/68"}`} key={rule}>
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#75d89a]" strokeWidth={1.8} />
              <span>{displayMaterialRule(rule)}</span>
            </div>
          ))}
        </div>
        <p className={`text-xs leading-5 ${light ? "text-[#776f66]" : "text-white/52"}`}>
          {createMode === "theme" ? "Default is 5 images. Adjust this number if you want a different delivery estimate." : "Tool requests use one focused result type. Add clear notes and selected selfies before review."}
        </p>
      </div>
      {createMode === "tool" ? (
      <div className="grid gap-4 md:grid-cols-2">
        {modeFields.map((field) => (
          <label className={`grid gap-2 text-sm font-medium ${textClass}`} key={field.id}>
            {field.label}
            {field.type === "select" || field.type === "radio" ? (
              <select
                className={`rounded-[18px] border px-4 py-3 ${fieldClass}`}
                onChange={(event) => updateField(field.id, event.target.value)}
                value={String(formValues[field.id] ?? field.options[0]?.value ?? "")}
              >
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : field.type === "textarea" ? (
              <textarea
                className={`min-h-[104px] rounded-[18px] border px-4 py-3 ${fieldClass}`}
                onChange={(event) => updateField(field.id, event.target.value)}
                placeholder={field.placeholder ?? field.label}
                value={String(formValues[field.id] ?? "")}
              />
            ) : field.type === "number" ? (
              <input
                className={`rounded-[18px] border px-4 py-3 ${fieldClass}`}
                max={field.max}
                min={field.min}
                onChange={(event) => updateField(field.id, Number(event.target.value))}
                step={field.step}
                type="number"
                value={Number(formValues[field.id] ?? field.min ?? 0)}
              />
            ) : field.type === "boolean" ? (
              <span className={`inline-flex items-center gap-2 rounded-[18px] border px-4 py-3 ${fieldClass}`}>
                <input checked={Boolean(formValues[field.id])} onChange={(event) => updateField(field.id, event.target.checked)} type="checkbox" />
                <span>{field.helpText ?? "Enabled"}</span>
              </span>
            ) : field.type === "text" ? (
              <input
                className={`rounded-[18px] border px-4 py-3 ${fieldClass}`}
                onChange={(event) => updateField(field.id, event.target.value)}
                placeholder={field.placeholder ?? field.label}
                value={String(formValues[field.id] ?? "")}
              />
            ) : null}
            {field.helpText ? <span className={`text-xs leading-5 ${light ? "text-[#776f66]" : "text-white/52"}`}>{field.helpText}</span> : null}
          </label>
        ))}
      </div>
      ) : null}
      <div className="sr-only" id="source-photos">
        <input
          accept="image/*"
          multiple
          onChange={(event) => {
            void uploadSourceFiles(event.target.files);
            event.target.value = "";
          }}
          ref={sourceUploadInputRef}
          type="file"
        />
      </div>
      <div className="hidden" id="legacy-source-photos">
        <div>
          <p className={`font-mono text-[10px] uppercase tracking-[0.16em] ${eyebrowClass}`}>Step 02 · Private model</p>
          <h3 className={`mt-2 text-xl font-semibold ${textClass}`}>Upload selfies for your private model</h3>
          <p className={`mt-2 text-sm leading-6 ${light ? "text-[#625d56]" : "text-white/68"}`}>
            Add clear selfies or reference photos when available. There is no minimum photo count; each request can use up to {effectiveMaxAssets} photos inside this signed-in workspace.
          </p>
          <label className={`mt-3 inline-flex cursor-pointer items-center gap-2 rounded-[14px] px-4 py-2 text-xs font-semibold active:scale-[0.98] ${primaryButtonClass} ${uploadingSources ? "pointer-events-none opacity-55" : ""}`}>
            <UploadCloud className="h-4 w-4" strokeWidth={1.8} />
            {uploadingSources ? "Uploading selfies" : "Upload selfies in batch"}
            <input
              accept="image/*"
              className="sr-only"
              multiple
              onChange={(event) => {
                void uploadSourceFiles(event.target.files);
                event.target.value = "";
              }}
              type="file"
            />
          </label>
          <p className={`mt-2 text-xs leading-5 ${light ? "text-[#776f66]" : "text-white/52"}`}>
            Select multiple image files at once. Uploaded photos appear below for browsing, selection, and removal before generation.
          </p>
        </div>
        {sourceAssets.length ? (
          <div className="grid gap-3">
            {isCoupleFlow ? (
              <>
                {renderPhotoPicker("Your photos", "Select photos for the primary person. Use any number up to the 15-photo request limit.", "primary", selectedAssetIds)}
                {renderPhotoPicker("Partner photos", "Select photos for the partner. These are combined with your photos before generation.", "partner", partnerSelectedAssetIds)}
              </>
            ) : (
              renderPhotoPicker("Browse uploaded photos", `${sourceAssets.length} private photos are ready. Select any images that should drive this request, up to 15 total.`, "primary", selectedAssetIds)
            )}
          </div>
        ) : loadingAssets ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6" aria-busy="true" aria-label="Loading private photos">
            {[0, 1, 2, 3].map((item) => (
              <div className={`overflow-hidden rounded-[14px] border ${light ? "border-[#eadfce] bg-white" : "border-white/10 bg-black/18"}`} key={item}>
                <div className={`aspect-[4/5] animate-pulse ${light ? "bg-[#f1eadf]" : "bg-white/[0.07]"}`} />
                <div className="p-2">
                  <div className={`h-3 w-20 rounded-full ${light ? "bg-[#eadfce]" : "bg-white/[0.08]"}`} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={`rounded-[18px] border border-dashed p-4 text-sm leading-6 ${light ? "border-[#d8cab9] bg-[#fffaf3] text-[#706961]" : "border-white/12 bg-black/16 text-white/68"}`}>
            <p>No selfies are ready yet. Upload private photos here to keep this request in one flow.</p>
            <p className={`mt-3 text-xs leading-5 ${light ? "text-[#776f66]" : "text-white/52"}`}>
              Use the Upload selfies button above to stay in this generation flow.
            </p>
          </div>
        )}
        <div className={`flex flex-wrap items-center justify-between gap-3 rounded-[16px] border p-4 ${subtlePanelClass}`}>
          <div>
            <p className={`text-sm font-semibold ${textClass}`}>Selected model photos</p>
            <p className={`mt-1 text-xs leading-5 ${mutedClass}`}>
              {selectedRequestAssetIds.length} selected, no minimum required, up to {effectiveMaxAssets} for this request.
            </p>
          </div>
          <button
            className={`inline-flex items-center justify-center gap-2 rounded-[14px] px-4 py-2.5 text-xs font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 ${primaryButtonClass}`}
            disabled={selectedRequestAssetIds.length > effectiveMaxAssets}
            onClick={reviewCurrentRequest}
            type="button"
          >
            Continue to review
          </button>
        </div>
      </div>
      <div className="hidden" id="review-current-request">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className={`font-mono text-[10px] uppercase tracking-[0.16em] ${eyebrowClass}`}>Step 03 · Confirm package</p>
            <h3 className={`mt-2 text-xl font-semibold ${textClass}`}>Choose model, audience, credits, then generate.</h3>
            <p className={`mt-2 max-w-2xl text-sm leading-6 ${mutedClass}`}>
              Match the target Studio flow: select the model that should drive this request, choose who the package is for, confirm credits and outputs, then start generation.
            </p>
          </div>
          <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${light ? "border-[#eadfce] bg-[#fffaf3] text-[#625d56]" : "border-white/10 bg-white/[0.05] text-white/62"}`}>
            {customer.balance.available} credits available
          </span>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(340px,0.75fr)]">
          <div className={`grid gap-4 rounded-[16px] border p-4 ${subtlePanelClass}`}>
            <div>
              <p className={`text-sm font-semibold ${textClass}`}>Select your model</p>
              <p className={`mt-1 text-xs leading-5 ${mutedClass}`}>
                Use a trained model when available, or continue with the uploaded selfies selected in this request.
              </p>
            </div>
            {customerModels.length ? (
              <select
                className={`rounded-[14px] border px-4 py-3 text-sm ${fieldClass}`}
                onChange={(event) => setSelectedCustomerModelId(event.target.value)}
                value={selectedCustomerModelId}
              >
                {customerModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label} · {model.status.replace(/_/g, " ")} · {model.inputAssetCount}/{model.minInputAssets} photos
                  </option>
                ))}
              </select>
            ) : (
              <div className={`rounded-[14px] border border-dashed p-3 text-sm leading-6 ${light ? "border-[#d8cab9] bg-white text-[#706961]" : "border-white/12 bg-black/18 text-white/64"}`}>
                No trained model is ready yet. This request will use the selected private selfies.
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-3">
              {packageAudienceOptions.map((option) => {
                const active = packageAudience === option.id;
                return (
                  <button
                    className={`min-h-[104px] rounded-[14px] border p-3 text-left transition ${
                      active ? selectedCardClass : neutralCardClass
                    }`}
                    key={option.id}
                    onClick={() => setPackageAudience(option.id)}
                    type="button"
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold">{option.title}</span>
                      {active ? <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={1.8} /> : null}
                    </span>
                    <span className={`mt-2 block text-xs leading-5 ${active ? (light ? "text-[#5f5a54]" : "text-[#30343a]") : mutedClass}`}>
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
            {selectedSourceAssets.length ? (
              <div className="grid gap-2">
                <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${eyebrowClass}`}>Selected selfies</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {selectedSourceAssets.slice(0, 10).map((asset) => (
                    <div className={`overflow-hidden rounded-[12px] border ${light ? "border-[#eadfce] bg-white" : "border-white/10 bg-black/18"}`} key={asset.id}>
                      <img alt={asset.label} className="aspect-[4/5] w-full object-cover" src={asset.previewUrl} />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className={`grid content-between gap-4 rounded-[16px] border p-4 ${light ? "border-[#eadfce] bg-white" : "border-white/10 bg-black/24"}`}>
            <div className="grid gap-3">
              <div>
                <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${eyebrowClass}`}>{createMode === "theme" ? "Package" : "Tool"}</p>
                <p className={`mt-2 text-lg font-semibold ${textClass}`}>{selectionTitle}</p>
                <p className={`mt-1 text-xs leading-5 ${mutedClass}`}>{selectionDescription}</p>
              </div>
              {[
                { label: "Model", value: selectedModelLabel },
                { label: "Audience", value: packageAudienceOptions.find((option) => option.id === packageAudience)?.title ?? "For Myself" },
                { label: "Selfies", value: `${selectedRequestAssetIds.length}/${effectiveMaxAssets} selected` },
                { label: "Required credits", value: `${selectionCreditCost}` },
                { label: "Price per image", value: `${unitCreditCost}` },
                { label: "Output", value: createMode === "theme" ? `${requestOutputCount} images` : "Tool result" }
              ].map((item) => (
                <div className={`flex items-center justify-between gap-3 rounded-[12px] border px-3 py-2 ${subtlePanelClass}`} key={item.label}>
                  <span className={`text-xs font-semibold uppercase tracking-[0.12em] ${eyebrowClass}`}>{item.label}</span>
                  <span className={`max-w-[58%] truncate text-right text-sm font-semibold ${textClass}`}>{item.value}</span>
                </div>
              ))}
              <p className={`text-xs leading-5 ${mutedClass}`}>{creditsUsageNote}</p>
              {operationContext?.action || operationContext?.note ? (
                <div className={`rounded-[12px] border p-3 ${subtlePanelClass}`}>
                  <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${eyebrowClass}`}>Workspace action</p>
                  <p className={`mt-2 text-sm font-semibold ${textClass}`}>{operationContext.action ?? "Custom operation"}</p>
                  {operationContext.note ? <p className={`mt-1 text-xs leading-5 ${mutedClass}`}>{operationContext.note}</p> : null}
                </div>
              ) : null}
            </div>
            <div className="grid gap-3">
              <p className={`text-xs leading-5 ${mutedClass}`}>
                {selectedRequestAssetIds.length > effectiveMaxAssets ? `Use up to ${effectiveMaxAssets} private photos before starting.` : "You can start without a minimum photo count, or add photos for stronger results."}
              </p>
              {subscriptionGateMessage ? (
                <div className={`rounded-[12px] border px-3 py-2 text-xs leading-5 ${subscriptionGateClass}`} role={subscriptionStatus === "required" ? "alert" : "status"}>
                  <span>{subscriptionGateMessage}</span>
                  {subscriptionStatus === "required" ? (
                    <a className="ml-2 inline-flex font-semibold underline underline-offset-4" href={pricingHref}>
                      Choose a plan
                    </a>
                  ) : null}
                </div>
              ) : null}
              <button
                className={`inline-flex w-full items-center justify-center gap-2 rounded-[14px] px-4 py-3 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 ${primaryButtonClass}`}
                disabled={pending || !canStartRequest}
                onClick={openPackageDialog}
                type="button"
              >
                <Play className="h-4 w-4" strokeWidth={1.8} />
                Review and start
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>
      {packageDialogOpen ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/72 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Photo package generation settings">
          <div className={`max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[18px] border p-5 shadow-[0_30px_100px_-40px_rgba(0,0,0,0.95)] ${light ? "border-[#eadfce] bg-white text-[#171514]" : "border-white/14 bg-[#121821] text-white"}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={`font-mono text-[10px] uppercase tracking-[0.18em] ${eyebrowClass}`}>{createMode === "theme" ? "Photo package" : "AI tool"}</p>
                <h3 className={`mt-2 text-2xl font-semibold ${textClass}`}>{selectionTitle}</h3>
                <p className={`mt-2 text-sm leading-6 ${mutedClass}`}>{selectionDescription}</p>
              </div>
              <button
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${light ? "border-[#dfd3c4] text-[#706961] hover:bg-[#fffaf3]" : "border-white/12 text-white/64 hover:bg-white/[0.06] hover:text-white"}`}
                onClick={() => setPackageDialogOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
              <div className="grid gap-4">
                <label className={`grid gap-2 text-sm font-medium ${textClass}`}>
                  Select your model
                  {customerModels.length ? (
                    <select
                      className={`rounded-[14px] border px-4 py-3 ${fieldClass}`}
                      onChange={(event) => setSelectedCustomerModelId(event.target.value)}
                      value={selectedCustomerModelId}
                    >
                      {customerModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.label} · {model.status.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={`rounded-[14px] border border-dashed p-3 text-sm leading-6 ${light ? "border-[#d8cab9] bg-[#fffaf3] text-[#706961]" : "border-white/12 bg-black/18 text-white/64"}`}>
                      No trained model is ready yet. This request will use the selected uploaded selfies.
                    </span>
                  )}
                </label>

                <div className="grid gap-2 sm:grid-cols-3">
                  {packageAudienceOptions.map((option) => {
                    const active = packageAudience === option.id;
                    return (
                      <button
                        className={`min-h-[112px] rounded-[14px] border p-3 text-left transition ${active ? selectedCardClass : neutralCardClass}`}
                        key={option.id}
                        onClick={() => setPackageAudience(option.id)}
                        type="button"
                      >
                        <span className="flex items-start justify-between gap-2">
                          <span className="text-sm font-semibold">{option.title}</span>
                          {active ? <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={1.8} /> : null}
                        </span>
                        <span className={`mt-2 block text-xs leading-5 ${active ? (light ? "text-[#5f5a54]" : "text-[#30343a]") : mutedClass}`}>
                          {option.description}
                        </span>
                        <span className={`mt-2 block text-[11px] leading-4 ${active ? (light ? "text-[#756b63]" : "text-[#4b525c]") : mutedClass}`}>
                          {option.helper}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {createMode === "theme" ? (
                  <label className={`grid gap-2 text-sm font-medium ${textClass}`}>
                    Estimated outputs
                    <input
                      className={`rounded-[14px] border px-4 py-3 ${fieldClass}`}
                      min={1}
                      onChange={(event) => setThemeOutputCount(Math.max(1, Number(event.target.value) || DEFAULT_THEME_OUTPUT_COUNT))}
                      type="number"
                      value={themeOutputCount}
                    />
                  </label>
                ) : null}

                <label className={`grid gap-2 text-sm font-medium ${textClass}`}>
                  Generation prompt and package notes
                  <textarea
                    className={`min-h-[120px] rounded-[14px] border px-4 py-3 ${fieldClass}`}
                    onChange={(event) => {
                      setPackagePromptDraft(event.target.value);
                      if (createMode === "tool") updateField(TOOL_PROMPT_FIELD_ID, event.target.value);
                    }}
                    placeholder="Confirm the package prompt, styling notes, or generation direction."
                    value={packagePromptDraft}
                  />
                </label>

                <div className={`grid gap-3 rounded-[14px] border p-3 ${subtlePanelClass}`}>
                  <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${eyebrowClass}`}>Selected uploads</p>
                  {isCoupleFlow ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        { title: "Your photos", assets: primarySourceAssets },
                        { title: "Partner photos", assets: partnerSourceAssets }
                      ].map((group) => (
                        <div key={group.title}>
                          <p className={`text-sm font-semibold ${textClass}`}>{group.title} · {group.assets.length}</p>
                          <div className="mt-2 grid grid-cols-4 gap-2">
                            {group.assets.slice(0, 8).map((asset) => (
                              <img alt={asset.label} className="aspect-square rounded-[8px] object-cover" key={asset.id} src={asset.previewUrl} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-5 gap-2">
                      {primarySourceAssets.slice(0, 10).map((asset) => (
                        <img alt={asset.label} className="aspect-square rounded-[8px] object-cover" key={asset.id} src={asset.previewUrl} />
                      ))}
                    </div>
                  )}
                  {!selectedRequestAssetIds.length ? (
                    <p className={`text-xs leading-5 ${mutedClass}`}>No photos are selected. You can still start without a minimum, or upload samples from the left panel for stronger results.</p>
                  ) : null}
                </div>
              </div>

              <div className={`grid content-between gap-4 rounded-[16px] border p-4 ${light ? "border-[#eadfce] bg-[#fffaf3]" : "border-white/10 bg-black/24"}`}>
                <div className="grid gap-3">
                  {[
                    { label: "Model", value: selectedModelLabel },
                    { label: "Audience", value: packageAudienceOptions.find((option) => option.id === packageAudience)?.title ?? "For Myself" },
                    { label: "Primary", value: `${selectedAssetIds.length} photos` },
                    { label: "Partner", value: isCoupleFlow ? `${partnerSelectedAssetIds.length} photos` : "Not used" },
                    { label: "Required credits", value: `${selectionCreditCost}` },
                    { label: "Price per image", value: `${unitCreditCost}` },
                    { label: "Output", value: createMode === "theme" ? `${requestOutputCount} images` : "Tool result" }
                  ].map((item) => (
                    <div className={`flex items-center justify-between gap-3 rounded-[12px] border px-3 py-2 ${subtlePanelClass}`} key={item.label}>
                      <span className={`text-xs font-semibold uppercase tracking-[0.12em] ${eyebrowClass}`}>{item.label}</span>
                      <span className={`max-w-[58%] truncate text-right text-sm font-semibold ${textClass}`}>{item.value}</span>
                    </div>
                  ))}
                  <p className={`text-xs leading-5 ${mutedClass}`}>{creditsUsageNote}</p>
                </div>
                <div className="grid gap-3">
                  <p className={`text-xs leading-5 ${mutedClass}`}>
                    The request sends the selected package, prompt notes, primary photos, partner photos, audience, model, and output count to the generation job.
                  </p>
                  {subscriptionGateMessage ? (
                    <div className={`rounded-[12px] border px-3 py-2 text-xs leading-5 ${subscriptionGateClass}`} role={subscriptionStatus === "required" ? "alert" : "status"}>
                      <span>{subscriptionGateMessage}</span>
                      {subscriptionStatus === "required" ? (
                        <a className="ml-2 inline-flex font-semibold underline underline-offset-4" href={pricingHref}>
                          Choose a plan
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                  {dialogMessage ? (
                    <div className={`rounded-[12px] border px-3 py-2 text-xs leading-5 ${dialogStatusClass}`} role={dialogTone === "error" ? "alert" : "status"}>
                      {dialogMessage}
                    </div>
                  ) : null}
                  <button
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-[14px] px-4 py-3 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 ${primaryButtonClass}`}
                    disabled={pending || !canStartRequest}
                    onClick={(event) => {
                      event.preventDefault();
                      void createJob(event);
                    }}
                    type="button"
                  >
                    <Play className="h-4 w-4" strokeWidth={1.8} />
                    {pending ? "Creating job..." : modeSubmitLabel}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className={`flex flex-wrap items-center justify-between gap-3 rounded-[16px] border p-4 ${panelClass}`}>
        <div>
          <p className={`text-sm font-semibold ${textClass}`}>{createMode === "theme" ? "Photo package mode" : "Tool mode"}</p>
          <p className={`mt-1 text-xs leading-5 ${mutedClass}`}>{message}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${light ? "border-[#dfd3c4] bg-[#fffaf3] text-[#625d56]" : "border-white/10 bg-white/[0.04] text-white/68"}`}>
            {selectionCreditCost} credits
          </span>
          <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${light ? "border-[#dfd3c4] bg-[#fffaf3] text-[#625d56]" : "border-white/10 bg-white/[0.04] text-white/68"}`}>
            {customer.balance.available} available
          </span>
          <button className={`rounded-[14px] px-4 py-2.5 text-xs font-semibold active:scale-[0.98] ${primaryButtonClass}`} onClick={continueToReviewOrSelfies} type="button">
            Review request
          </button>
        </div>
      </div>
    </form>
  );
}
