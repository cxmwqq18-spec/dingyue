import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const files = {
  dispatch: fs.readFileSync(path.join(root, "src/app/api/internal/ai-worker/dispatch/route.ts"), "utf8"),
  customerAssetsRoute: fs.readFileSync(path.join(root, "src/app/api/internal/customer-assets/route.ts"), "utf8"),
  worker: fs.readFileSync(path.join(root, "src/lib/worker.ts"), "utf8"),
  storage: fs.readFileSync(path.join(root, "src/lib/customer-asset-storage.ts"), "utf8"),
  providers: fs.readFileSync(path.join(root, "src/app/api/platform/ai-providers/route.ts"), "utf8"),
  providerPanel: fs.readFileSync(path.join(root, "src/components/platform/platform-ai-provider-panel.tsx"), "utf8"),
  multiframeScript: fs.readFileSync(path.join(root, "scripts/enable-video-provider-multiframe.mjs"), "utf8")
};

const directJsonPromptFunction = files.dispatch.match(/function buildDirectJsonVideoPrompt[\s\S]*?\n}\n\nfunction buildVideoSceneImagePrompt/)?.[0] ?? "";
const orderedVideoProvidersFunction = files.dispatch.match(/function orderedVideoProviders[\s\S]*?\n}\n\nfunction orderedVideoSceneImageProviders/)?.[0] ?? "";
const videoProviderModelCandidatesFunction = files.dispatch.match(/function videoProviderModelCandidates[\s\S]*?\n}\n\nfunction isVideoModelUnavailableError/)?.[0] ?? "";
const createVideoTaskFunction = files.dispatch.match(/async function createVideoTask[\s\S]*?\n}\n\nasync function pollVideoTask/)?.[0] ?? "";

const checks = [
  {
    label: "worker can identify video generation models separately from image models",
    pass: files.dispatch.includes("function isVideoGenerationModel(") &&
      files.dispatch.includes("!isVideoGenerationModel(normalized)")
  },
  {
    label: "worker routes only explicit video-style requests to the video branch",
    pass: files.dispatch.includes("function isVideoGenerationRequest(") &&
      files.dispatch.includes("await runLocalVideoWorker(payload)")
  },
  {
    label: "video provider supports the LK888 media generate and status endpoints",
    pass: files.dispatch.includes("/v1/media/generate") &&
      files.dispatch.includes("/v1/media/status") &&
      files.dispatch.includes("is_final === true") &&
      files.dispatch.includes('body.state === "success"')
  },
  {
    label: "video provider supports SmartPickLid OpenAI-compatible video endpoints",
    pass: files.dispatch.includes('return "openai-videos"') &&
      files.dispatch.includes('hostname.includes("magic666")') &&
      files.dispatch.includes("/v1/videos") &&
      files.dispatch.includes("body.status === \"completed\"") &&
      files.dispatch.includes("body.status === \"succeeded\"") &&
      files.dispatch.includes("/content")
  },
  {
    label: "preferred video providers keep fallback providers available for transient outages",
    pass: orderedVideoProvidersFunction.includes('selection?.mode === "fixed_provider"') &&
      orderedVideoProvidersFunction.includes("selectedProvider") &&
      orderedVideoProvidersFunction.includes("fallbackProviders") &&
      !orderedVideoProvidersFunction.includes('selection?.mode === "preferred_provider" && selection.fallbackEnabled === false')
  },
  {
    label: "video worker sends SmartPickLid Grok Imagine multi-frame uploads directly without scene composition fallback",
    pass: files.dispatch.includes("composeVideoSceneReference") &&
      files.dispatch.includes("buildVideoSceneImagePrompt") &&
      files.dispatch.includes("video_scene_composition_started") &&
      files.dispatch.includes("video_scene_reference_ready") &&
      files.dispatch.includes("shouldPreferDirectOpenAiJsonVideoReferences") &&
      files.dispatch.includes("buildDirectJsonVideoPrompt") &&
      files.dispatch.includes("openAiJsonVideoReferenceLimit") &&
      files.dispatch.includes("AI_WORKER_GROK_IMAGINE_VIDEO_REFERENCE_LIMIT") &&
      files.dispatch.includes("directJsonReferences ? openAiJsonVideoReferenceLimit() : configuredProviderReferenceLimit") &&
      !files.dispatch.includes("!directJsonReferences && requestedReferenceAssets.length > providerReferenceLimit") &&
      files.dispatch.includes("directJsonReferences") &&
      files.dispatch.includes("videoPromptForReferenceAssets") &&
      files.dispatch.includes("? buildDirectJsonVideoPrompt(params.payload, assets)") &&
      !files.dispatch.includes("shouldRetryDirectJsonVideoWithComposedScene") &&
      !files.dispatch.includes("video_provider_retry_composed_reference") &&
      files.dispatch.includes("_createSharedVideoSceneReferenceGetter") &&
      !files.dispatch.includes("getComposedSceneReference") &&
      !files.dispatch.includes("composedScene ? [composedScene.asset]") &&
      files.dispatch.includes("Identity preservation is the highest requirement") &&
      files.dispatch.includes("generic couple model") &&
      files.dispatch.includes("videoFrameReferenceFileLabel") &&
      files.dispatch.includes("ai_provider_video_first_frame_required")
  },
  {
    label: "video scene image composition uses reference edits only and fails cleanly without dirty fallbacks",
    pass: files.dispatch.includes("function shouldTryNextSceneImageProvider(") &&
      files.dispatch.includes("function orderedVideoSceneImageProviders(") &&
      files.dispatch.includes("editCapableProviders") &&
      files.dispatch.includes("provider.supportsEditN") &&
      files.dispatch.includes("candidateProviders") &&
      files.dispatch.includes("function videoSceneImageProviderAttempts()") &&
      files.dispatch.includes("LOCAL_AI_WORKER_VIDEO_SCENE_IMAGE_ATTEMPTS") &&
      files.dispatch.includes("generateVideoSceneImageWithEdit") &&
      files.dispatch.includes("/v1/images/edits") &&
      !files.dispatch.includes("shouldGenerateSceneImageAfterEditError") &&
      !files.dispatch.includes("generateVideoSceneImageWithGeneration") &&
      !files.dispatch.includes("video_scene_image_generation_started") &&
      !files.dispatch.includes("ai_provider_video_scene_image_text_fallback_rejected_reference_request") &&
      !files.dispatch.includes("video_scene_composition_skipped") &&
      !files.dispatch.includes("The multi-frame starter scene compositor was unavailable") &&
      !files.dispatch.includes("shouldUseLocalVideoFallback") &&
      !files.dispatch.includes("generateLocalFallbackVideo") &&
      !files.dispatch.includes("local_video_fallback_started") &&
      !files.dispatch.includes("Local video fallback") &&
      files.dispatch.includes('message.includes("failed_404")') &&
      files.dispatch.includes('message.includes("insufficient_balance")') &&
      files.dispatch.includes('message.includes("insufficient account balance")') &&
      files.dispatch.includes("if (!shouldTryNextSceneImageProvider(lastError)) break")
  },
  {
    label: "video provider compresses references and does not drop direct JSON multi-reference requests to the first frame",
    pass: files.dispatch.includes("shouldCompressVideoReferenceImages") &&
      files.dispatch.includes("return shouldUseSharpForWorkerImages();") &&
      files.dispatch.includes("if (!target || !shouldCompressVideoReferenceImages() || sourceMimeType.includes(\"gif\"))") &&
      files.dispatch.includes("LOCAL_AI_WORKER_VIDEO_REFERENCE_MAX_DIMENSION") &&
      !files.dispatch.includes("shouldRetryOpenAiVideoTaskWithFirstFrame") &&
      !files.dispatch.includes("directJsonReferences?: boolean") &&
      !files.dispatch.includes("if (params.directJsonReferences) return false") &&
      !files.dispatch.includes("video_provider_retry_first_frame")
  },
  {
    label: "OpenAI-compatible video references are normalized to the requested video size",
    pass: files.dispatch.includes("function parseVideoPixelSize(") &&
      files.dispatch.includes("prepareVideoReferenceImage(bytes, mimeType, params.videoParams.size)") &&
      files.dispatch.includes("video_reference_format_ready") &&
      files.dispatch.includes("targetSize")
  },
  {
    label: "OpenAI-compatible video requests use provider-supported size strings",
    pass: files.dispatch.includes("function openAiVideoProviderSize(") &&
      files.dispatch.includes("function openAiVideoRequestSize(") &&
      files.dispatch.includes('new Set(["720x1280", "1280x720", "1024x1792", "1792x1024"])') &&
      files.dispatch.includes("form.append(\"size\", openAiVideoRequestSize(params.videoParams))") &&
      files.dispatch.includes("size: providerRequestSize")
  },
  {
    label: "OpenAI-compatible video references use provider-compatible JSON fields and data URIs",
    pass: files.dispatch.includes("function shouldUseOpenAiVideoJsonReference(") &&
      files.dispatch.includes("function shouldUseOpenAiVideoStringReference(") &&
      !files.dispatch.includes("function shouldUseSmartPickLidLegacyVideoReferences(") &&
      files.dispatch.includes("function smartPickLidJsonVideoResolution(") &&
      files.dispatch.includes("function openAiVideoCreateEndpoint(") &&
      files.dispatch.includes('usesProxyOpenAiVideoEndpoint(baseUrl) ? "/v1/videos" : "/v1/videos/generations"') &&
      files.dispatch.includes("openAiVideoCreateEndpoint(params.baseUrl)") &&
      files.dispatch.includes("/v1/videos/generations") &&
      files.dispatch.includes("const useOpenAiJsonReference = shouldUseOpenAiVideoJsonReference(params)") &&
      files.dispatch.includes("duration: Number(params.videoParams.duration)") &&
      files.dispatch.includes("seconds: params.videoParams.duration") &&
      files.dispatch.includes("aspect_ratio: params.videoParams.aspect_ratio") &&
      files.dispatch.includes("resolution: smartPickLidJsonVideoResolution(params.videoParams.resolution)") &&
      files.dispatch.includes("openAiJsonVideoReferencePayload") &&
      files.dispatch.includes("stringReference ? urls : urls.map((url) => ({ url }))") &&
      files.dispatch.includes("image: stringReference ? imageUrl : { url: imageUrl }") &&
      files.dispatch.includes("shouldUseOpenAiVideoStringReference(params.baseUrl)") &&
      !createVideoTaskFunction.includes("image: firstImageUrl") &&
      !createVideoTaskFunction.includes("input_reference: firstImageUrl") &&
      !createVideoTaskFunction.includes('imageKind: useSmartPickLidLegacyReferences ? "smartpicklid_url_reference"') &&
      files.dispatch.includes('AI_WORKER_GROK_IMAGINE_VIDEO_REFERENCE_MODE') &&
      files.dispatch.includes("videoProviderPreparedDataUriFrameUrls") &&
      files.dispatch.includes("useProviderFrameUrls = protocol !== \"openai-videos\"") &&
      files.dispatch.includes("json_reference_images") &&
      files.dispatch.includes("json_image")
  },
  {
    label: "video provider falls through to another model when a create channel returns a gateway error",
    pass: files.dispatch.includes("function shouldTryNextVideoModel(") &&
      files.dispatch.includes('message.includes("ai_provider_video_create_failed_502_")') &&
      files.dispatch.includes('message.includes("ai_provider_video_create_failed_524_")') &&
      files.dispatch.includes('message.includes("upstream_error")') &&
      files.dispatch.includes('message.includes("服务暂时不可用")') &&
      files.dispatch.includes('message.includes("failed_524")') &&
      files.dispatch.includes("if (!shouldTryNextVideoModel(error)) break")
  },
  {
    label: "OpenAI-compatible reference video prefers image-to-video models over text-to-video models",
    pass: videoProviderModelCandidatesFunction.includes("function videoProviderModelCandidates(") &&
      files.dispatch.includes("function isImageToVideoModel(") &&
      files.dispatch.includes("const imageToVideoCandidates") &&
      videoProviderModelCandidatesFunction.includes('protocol === "openai-videos" && isSmartPickLidBaseUrl') &&
      videoProviderModelCandidatesFunction.includes("singleReferenceCandidates") &&
      videoProviderModelCandidatesFunction.includes("multiReferenceCandidates") &&
      videoProviderModelCandidatesFunction.includes("referenceAssetCount > 1") &&
      videoProviderModelCandidatesFunction.includes("referenceAssetCount === 1") &&
      videoProviderModelCandidatesFunction.indexOf('"grok-imagine-video"') < videoProviderModelCandidatesFunction.indexOf('"grok-video-3-max"') &&
      files.dispatch.includes('protocol === "openai-videos" && (referenceAssetCount > 0 || shouldPreferSmartPickLidJsonModel)') &&
      videoProviderModelCandidatesFunction.includes("return Array.from(new Set([") &&
      files.dispatch.includes("return Array.from(new Set(imageToVideoCandidates.filter(Boolean)))") &&
      files.dispatch.includes("videoProviderModelCandidates(model, { protocol, referenceAssetCount: taskReferenceAssets.length, baseUrl })")
  },
  {
    label: "video worker optimizes generated video files for playback before storage",
    pass: files.dispatch.includes("ffmpeg-static") &&
      files.dispatch.includes("function optimizeGeneratedVideoForPlayback(") &&
      files.dispatch.includes("AI_WORKER_OPTIMIZE_VIDEO_OUTPUTS") &&
      files.dispatch.includes("AI_WORKER_VIDEO_OPTIMIZE_CRF") &&
      files.dispatch.includes('"-movflags"') &&
      files.dispatch.includes('"+faststart"') &&
      files.dispatch.includes("const downloadedVideo = await downloadVideoResult") &&
      files.dispatch.includes("const video = await optimizeGeneratedVideoForPlayback(downloadedVideo)") &&
      files.dispatch.includes("writeCustomerAssetFileShared")
  },
  {
    label: "video worker supports text-to-video requests without frame images",
    pass: files.worker.includes("if (isVideoWorkerJob(params.job)) return []") &&
      files.dispatch.includes("buildTextToVideoPrompt") &&
      files.dispatch.includes("Text-to-video task") &&
      files.dispatch.includes("No reference images were uploaded") &&
      files.dispatch.includes("!assets.length") &&
      files.dispatch.includes("? buildTextToVideoPrompt(params.payload)") &&
      !files.dispatch.includes("const referenceAsset = referenceAssets[0]") &&
      !files.dispatch.includes("if (!referenceAsset) throw new Error(\"ai_provider_video_first_frame_required\")")
  },
  {
    label: "video provider records configured capacity while keeping multi-image references direct",
    pass: files.dispatch.includes("configuredProviderReferenceLimit") &&
      files.dispatch.includes("providerReferenceLimit = directJsonReferences ? openAiJsonVideoReferenceLimit() : configuredProviderReferenceLimit") &&
      !files.dispatch.includes("Original selected frame count") &&
      files.dispatch.includes("buildVideoPrompt(params.payload, assets)")
  },
  {
    label: "video provider create timeout is long enough for proxied reference uploads",
    pass: files.dispatch.includes("function videoProviderCreateTimeoutMs(") &&
      files.dispatch.includes("LOCAL_AI_WORKER_VIDEO_CREATE_TIMEOUT_MS") &&
      files.dispatch.includes('?? "180000"') &&
      files.dispatch.includes("const createTimeoutMs = videoProviderCreateTimeoutMs(params.timeoutMs)") &&
      files.dispatch.includes("`ai_provider_video_create_timeout_${createTimeoutMs}`") &&
      !files.dispatch.includes("ai_provider_video_create_timeout_${Math.min(params.timeoutMs, 60_000)}")
  },
  {
    label: "customer asset transfer allows generated video payloads above image upload limits",
    pass: files.customerAssetsRoute.includes("CUSTOMER_ASSET_VIDEO_TRANSFER_MAX_BYTES") &&
      files.customerAssetsRoute.includes("defaultMaxVideoTransferBytes") &&
      files.customerAssetsRoute.includes('mimeType.startsWith("video/")') &&
      files.customerAssetsRoute.includes("asset_data_too_large") &&
      files.customerAssetsRoute.includes("maxBytes")
  },
  {
    label: "video provider prompt keeps frame resources and explicit user direction ahead of theme wording",
    pass: files.dispatch.includes("buildVideoReferenceContractPrompt") &&
      files.dispatch.includes("Reference lock: uploaded frame images are binding visual evidence") &&
      files.dispatch.includes("Never solve a difficult request by ignoring the reference images") &&
      files.dispatch.includes("The uploaded images are the source of truth") &&
      files.dispatch.includes("Customer direction, highest priority") &&
      files.dispatch.includes("Highest priority user direction") &&
      files.dispatch.includes("Resource priority: frame image content defines visible source subjects") &&
      files.dispatch.includes("Cast continuity is mandatory") &&
      files.dispatch.includes("Direct reference rule") &&
      files.dispatch.includes("Do not output only one person") &&
      files.dispatch.includes("Do not replace the requested action with walking") &&
      files.dispatch.includes("Do not replace the source subject with a generic actor") &&
      directJsonPromptFunction.includes("Customer direction, highest priority") &&
      !directJsonPromptFunction.includes("themePrompt") &&
      !directJsonPromptFunction.includes("videoThemePrompt") &&
      !directJsonPromptFunction.includes("Internal fallback video preset")
  },
  {
    label: "video prompt preserves user-requested opening portrait beats before later actions",
    pass: files.dispatch.includes("userRequestsOpeningPortraitSequence") &&
      files.dispatch.includes("buildOpeningPortraitStarterScenePrompt") &&
      files.dispatch.includes("buildOpeningPortraitVideoPrompt") &&
      files.dispatch.includes("Opening-beat lock for the starter scene") &&
      files.dispatch.includes("not a summary of the full sequence") &&
      files.dispatch.includes("Treat the turn, kiss, embrace, or interaction as the later motion beat") &&
      files.dispatch.includes("buildOpeningPortraitVideoPrompt(userNote)")
  },
  {
    label: "worker payload preserves a public signed asset URL for external providers",
    pass: files.worker.includes("publicUrl?: string") &&
      files.worker.includes("publicAssetBaseUrl")
  },
  {
    label: "customer asset storage serves common video MIME types",
    pass: files.storage.includes('".mp4": "video/mp4"') &&
      files.storage.includes('".webm": "video/webm"') &&
      files.storage.includes("mimeType.includes(\"mp4\")")
  },
  {
    label: "platform provider model picker includes the Grok video model",
    pass: files.providers.includes("grok-video-3-pro") &&
      files.providers.includes("grok-imagine-video-1.5-preview")
  },
  {
    label: "platform provider UI labels the request image limit as reference images",
    pass: files.providerPanel.includes("单次最多参考图") &&
      files.providerPanel.includes("单次参考图")
  },
  {
    label: "video provider data script preserves the one-image upstream contract",
    pass: files.multiframeScript.includes("VIDEO_PROVIDER_MAX_IMAGES_PER_REQUEST") &&
      files.multiframeScript.includes('?? "1"') &&
      files.multiframeScript.includes("maxImagesPerRequest: targetLimit") &&
      files.multiframeScript.includes("modelType.trim().toLowerCase().includes(\"video\")")
  },
  {
    label: "provider fetch falls back when a stale local proxy refuses connections",
    pass: files.dispatch.includes("function shouldRetryProviderFetchWithoutProxy(") &&
      files.dispatch.includes('process.env.AI_WORKER_DISABLE_PROXY_FALLBACK === "1"') &&
      files.dispatch.includes("function loopbackProxyHost(") &&
      files.dispatch.includes("function isConfiguredLoopbackProxyReachable(") &&
      files.dispatch.includes("AI_WORKER_PROXY_PROBE_TIMEOUT_MS") &&
      files.dispatch.includes("isLoopbackProxyUrl(proxyUrl)") &&
      files.dispatch.includes("connectionInterrupted") &&
      files.dispatch.includes("message.includes(\"econnreset\")") &&
      files.dispatch.includes("Promise.race") &&
      files.dispatch.includes("reject(new Error(timeoutError))") &&
      files.dispatch.includes("return await runFetch();")
  },
  {
    label: "worker result callback retries transient persistence failures before abandoning settlement",
    pass: files.dispatch.includes("function workerCallbackRetryAttempts(") &&
      files.dispatch.includes("worker_result_callback_retry") &&
      files.dispatch.includes("await new Promise((resolve) => setTimeout(resolve, workerCallbackRetryDelayMs(attempt)))") &&
      files.dispatch.includes("worker_result_callback_failed_${lastStatus || \"network\"}")
  }
];

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  for (const check of failed) {
    console.error(`FAIL ${check.label}`);
  }
  process.exit(1);
}

for (const check of checks) {
  console.log(`PASS ${check.label}`);
}
