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
  providerConfig: fs.readFileSync(path.join(root, "src/lib/ai-provider-config.ts"), "utf8"),
  providerAvailability: fs.readFileSync(path.join(root, "src/lib/video-provider-availability.ts"), "utf8"),
  providerFallback: fs.readFileSync(path.join(root, "src/lib/video-provider-fallback.ts"), "utf8"),
  providerType: fs.readFileSync(path.join(root, "src/lib/ai-provider-type.ts"), "utf8"),
  tokengoAdapter: fs.readFileSync(path.join(root, "src/lib/tokengo-media-video.ts"), "utf8"),
  providerPrompt: fs.readFileSync(path.join(root, "src/lib/video-provider-prompt.ts"), "utf8"),
  providerTimeouts: fs.readFileSync(path.join(root, "src/lib/video-provider-timeouts.ts"), "utf8"),
  providerPanel: fs.readFileSync(path.join(root, "src/components/platform/platform-ai-provider-panel.tsx"), "utf8"),
  multiframeScript: fs.readFileSync(path.join(root, "scripts/enable-video-provider-multiframe.mjs"), "utf8"),
  seedanceConfigure: fs.readFileSync(path.join(root, "scripts/configure-seedance-special-video-provider.mjs"), "utf8"),
  packageJson: fs.readFileSync(path.join(root, "package.json"), "utf8")
};

const singleReferenceJsonPromptFunction = files.dispatch.match(/function buildSingleReferenceDirectJsonVideoPrompt[\s\S]*?\n}\n\nfunction buildDirectJsonVideoPrompt/)?.[0] ?? "";
const directJsonPromptFunction = files.dispatch.match(/function buildDirectJsonVideoPrompt[\s\S]*?\n}\n\nfunction buildVideoSceneImagePrompt/)?.[0] ?? "";
const minimalVideoPromptFunction = files.dispatch.match(/function buildMinimalVideoProviderPrompt[\s\S]*?\n}\n\nfunction buildVideoPrompt/)?.[0] ?? "";
const orderedVideoProvidersFunction = files.dispatch.match(/function orderedVideoProviders[\s\S]*?\n}\n\nfunction orderedVideoSceneImageProviders/)?.[0] ?? "";
const videoProviderModelCandidatesFunction = files.dispatch.match(/function videoProviderModelCandidates[\s\S]*?\n}\n\nfunction isVideoModelUnavailableError/)?.[0] ?? "";
const shouldTryNextVideoModelFunction = files.dispatch.match(/function shouldTryNextVideoModel[\s\S]*?\n}\n\nfunction isImageGenerationModel/)?.[0] ?? "";
const _createVideoTaskFunction = files.dispatch.match(/async function createVideoTask[\s\S]*?\n}\n\nasync function pollVideoTask/)?.[0] ?? "";

const checks = [
  {
    label: "worker can identify video generation models separately from image models",
    pass: files.dispatch.includes("function isVideoGenerationModel(") &&
      files.dispatch.includes("!isVideoGenerationModel(normalized)")
  },
  {
    label: "worker routes only explicit video-style requests to the video branch",
    pass: files.dispatch.includes("function isVideoGenerationRequest(") &&
      files.dispatch.includes("await runLocalVideoWorker(payload")
  },
  {
    label: "video provider supports LK888 media generate and status endpoints",
    pass: files.dispatch.includes("/v1/media/generate") &&
      files.dispatch.includes("/v1/skills/task-status") &&
      files.dispatch.includes("/v1/media/status") &&
      files.dispatch.includes("function lk888MediaVideoParams(") &&
      files.dispatch.includes("images: lk888MediaImagesPayload(imageUrls)") &&
      files.dispatch.includes("resolution: lk888MediaVideoResolution(videoParams.resolution)") &&
      files.dispatch.includes("is_final === true") &&
      files.dispatch.includes('body.state === "success"')
  },
  {
    label: "video provider supports Buming/TokenGo media generate and task-status endpoints",
    pass: files.dispatch.includes('"tokengo-media"') &&
      files.dispatch.includes("createTokengoMediaVideoTask") &&
      files.dispatch.includes("fetchTokengoMediaVideoTask") &&
      files.dispatch.includes('body.state === "success"') &&
      files.dispatch.includes("firstResultVideo") &&
      files.dispatch.includes('protocol === "lk888-media" || protocol === "tokengo-media"') &&
      files.providerConfig.includes("tokengoModelsCatalogUrl") &&
      files.providerConfig.includes('return "tokengo-media"') &&
      files.providerAvailability.includes('"tokengo-media"') &&
      files.tokengoAdapter.includes("/v1/media/generate") &&
      files.tokengoAdapter.includes("/v1/skills/task-status") &&
      files.tokengoAdapter.includes("tokengoMediaVideoParams") &&
      files.tokengoAdapter.includes("end_image_url") &&
      files.tokengoAdapter.includes('return model?.trim().toLowerCase() === "seedance-2-0-special";') &&
      files.tokengoAdapter.includes("const duration = seedanceSpecial ? 15") &&
      files.tokengoAdapter.includes('{ resolution: "720p", quality: "标准", count: 1 }') &&
      files.dispatch.includes('const usePreparedProviderDataUris = protocol === "lk888-media";') &&
      files.dispatch.includes('allowDataUriFallback: protocol !== "tokengo-media"') &&
      files.dispatch.includes("assertTokengoMediaPublicFrameUrls(protocol, imageUrls)") &&
      files.dispatch.includes("video_public_asset_url_required_tokengo_media") &&
      files.tokengoAdapter.includes("ai_provider_tokengo_insufficient_funds")
  },
  {
    label: "platform provider type inference recognizes Buming/TokenGo as video",
    pass: files.providerType.includes('text.includes("tokengo")') &&
      files.providerType.includes('text.includes("token6688")') &&
      files.providerType.includes('text.includes("buming")')
  },
  {
    label: "2Ken video provider uses OpenAI-compatible videos protocol and models connectivity checks",
    pass: files.dispatch.includes('hostname === "apis.2ken.com") return "openai-videos"') &&
      files.dispatch.includes("function is2KenBaseUrl(") &&
      files.dispatch.includes("is2KenBaseUrl(baseUrl)") &&
      files.dispatch.includes("function proxyOpenAiVideoBaseUrl(") &&
      files.dispatch.includes('trimmed.replace(/\\/v1$/, "")') &&
      files.dispatch.includes("openAiVideoStatusEndpoint(params.baseUrl, params.taskId)") &&
      files.providerConfig.includes('hostname === "apis.2ken.com") return "openai-videos"') &&
      files.providerConfig.includes("function openAiModelsUrl(") &&
      files.providerAvailability.includes('hostname === "apis.2ken.com") return "openai-videos"') &&
      files.dispatch.includes("/v1/videos/generations")
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
    label: "Grok proxy video channel guards preserve SmartPickLid default access and Magic666 opt-in access",
    pass: files.dispatch.includes("function shouldAllowMagic666VideoProvider()") &&
      files.dispatch.includes("function shouldAllowSmartPickLidVideoProvider()") &&
      files.dispatch.includes("function envFlag(") &&
      files.dispatch.includes("AI_WORKER_ALLOW_MAGIC666_UNVERIFIED_VIDEO") &&
      files.dispatch.includes("AI_WORKER_ALLOW_SMARTPICKLID_UNVERIFIED_VIDEO") &&
      files.dispatch.includes('envFlag("AI_WORKER_ALLOW_SMARTPICKLID_UNVERIFIED_VIDEO") ?? true') &&
      files.dispatch.includes('envFlag("AI_WORKER_ALLOW_SMARTPICKLID_REFERENCE_VIDEO") ?? true') &&
      files.providerAvailability.includes('envFlag("AI_WORKER_ALLOW_SMARTPICKLID_UNVERIFIED_VIDEO") ?? true') &&
      files.providerAvailability.includes('envFlag("AI_WORKER_ALLOW_SMARTPICKLID_REFERENCE_VIDEO") ?? true') &&
      files.providerAvailability.includes('envFlag("AI_WORKER_ALLOW_MAGIC666_UNVERIFIED_VIDEO") === true') &&
      files.dispatch.includes("ai_provider_video_content_unverified_magic666") &&
      files.dispatch.includes("ai_provider_video_content_unverified_smartpicklid")
  },
  {
    label: "preferred video providers respect explicit fallback settings and TokenGo single-frame priority",
    pass: orderedVideoProvidersFunction.includes("orderSelectableAiProviderFallbackCandidates(videoProviders, payload.providerSelection)") &&
      files.providerFallback.includes('selection.mode === "fixed_provider"') &&
      files.providerFallback.includes('selection.mode === "preferred_provider" && selection.fallbackEnabled === false && selectedProvider') &&
      orderedVideoProvidersFunction.includes("isTokengoGrokImagine15VideoProvider") &&
      orderedVideoProvidersFunction.includes("videoFrameAssets(payload).length <= 1") &&
      orderedVideoProvidersFunction.includes("? [...tokengoSingleReferenceProviders, ...otherVideoProviders]") &&
      orderedVideoProvidersFunction.includes(": [...otherVideoProviders, ...tokengoSingleReferenceProviders]") &&
      !orderedVideoProvidersFunction.toLowerCase().includes("seedance")
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
      files.dispatch.includes("? buildOpenAiJsonVideoPrompt(params.payload, assets, videoParams)") &&
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
    label: "video provider preserves references and does not drop direct JSON multi-reference requests to the first frame",
    pass: files.dispatch.includes("shouldCompressVideoReferenceImages") &&
      files.dispatch.includes('return explicit === "1";') &&
      files.dispatch.includes("forceCompression") &&
      files.dispatch.includes("video_frame_data_uri_too_large") &&
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
    label: "SmartPickLid video requests follow the provider documented JSON and multipart schemas",
    pass: files.dispatch.includes("function shouldUseOpenAiVideoJsonReference(") &&
      files.dispatch.includes("function shouldUseSmartPickLidJsonVideoRequest(") &&
      files.dispatch.includes('if (explicitMode === "multipart" || explicitMode === "form") return false;') &&
      files.dispatch.includes("function shouldBlockSmartPickLidReferenceVideo(") &&
      files.dispatch.includes("AI_WORKER_ALLOW_SMARTPICKLID_REFERENCE_VIDEO") &&
      files.dispatch.includes("ai_provider_video_reference_channel_unreliable_smartpicklid") &&
      files.dispatch.includes("function smartPickLidJsonVideoResolution(") &&
      files.dispatch.includes("function openAiVideoCreateEndpoint(") &&
      files.dispatch.includes("function proxyOpenAiVideoBaseUrl(") &&
      files.dispatch.includes('trimmed.replace(/\\/v1$/, "")') &&
      files.dispatch.includes("openAiVideoCreateEndpoint(params.baseUrl)") &&
      files.dispatch.includes("/v1/videos/generations") &&
      files.dispatch.includes("useOpenAiJsonReference = shouldUseOpenAiVideoJsonReference(params) && !useSmartPickLidJsonRequest") &&
      files.dispatch.includes("const useJsonReference = useSmartPickLidJsonRequest || useOpenAiJsonReference") &&
      files.dispatch.includes('!useJsonReference && params.referenceAssets.length') &&
      files.dispatch.includes("seconds: params.videoParams.duration") &&
      files.dispatch.includes("aspect_ratio: params.videoParams.aspect_ratio") &&
      files.dispatch.includes("resolution: smartPickLidJsonVideoResolution(params.videoParams.resolution)") &&
      files.dispatch.includes("openAiJsonVideoReferencePayload") &&
      files.dispatch.includes("const useProxyStringReferences = usesProxyOpenAiVideoEndpoint(params.baseUrl)") &&
      files.dispatch.includes("proxyStringReferences: useProxyStringReferences") &&
      files.dispatch.includes("if (imageUrls.length > 1) return { images: imageUrls };") &&
      files.dispatch.includes("return imageUrls.length ? { image: imageUrls[0] } : {};") &&
      files.dispatch.includes("return { image: { url: imageUrl } };") &&
      files.dispatch.includes("reference_images: urls.map((url) => ({ url }))") &&
      files.dispatch.includes("form.append(\"input_reference\"") &&
      files.dispatch.includes("form.append(\"aspect_ratio\", params.videoParams.aspect_ratio)") &&
      files.dispatch.includes("form.append(\"resolution\", smartPickLidJsonVideoResolution(params.videoParams.resolution))") &&
      files.dispatch.includes('AI_WORKER_GROK_IMAGINE_VIDEO_REFERENCE_MODE') &&
      files.dispatch.includes("usesProxyOpenAiVideoEndpoint(params.baseUrl)") &&
      files.dispatch.includes("isSmartPickLidJsonVideoModel(params.model)") &&
      videoProviderModelCandidatesFunction.includes('"grok-imagine-video-special"') &&
      videoProviderModelCandidatesFunction.includes('"grok-imagine-1.5-special"') &&
      videoProviderModelCandidatesFunction.includes('"grok-imagine-video"') &&
      videoProviderModelCandidatesFunction.includes('"grok-video-3-pro"') &&
      videoProviderModelCandidatesFunction.includes('"grok-video-3-max"') &&
      !videoProviderModelCandidatesFunction.includes("multipartReferenceCandidates") &&
      files.dispatch.includes("smartPickLidReferenceCandidates") &&
      files.dispatch.includes("const useProviderFrameUrls = protocol !== \"openai-videos\" || !preferJsonVideoRequest") &&
      files.dispatch.includes("videoProviderPreparedDataUriFrameUrls") &&
      files.dispatch.includes("smartpicklid_json_data_uri_image") &&
      files.dispatch.includes("function shouldUseSharpForVideoReferenceImages()") &&
      files.dispatch.includes("LOCAL_AI_WORKER_VIDEO_REFERENCE_USE_SHARP") &&
      files.dispatch.includes("shouldPreferSmartPickLidJsonModel")
  },
  {
    label: "video provider prompts use user text plus bounded fidelity locks",
    pass: files.dispatch.includes("function buildMinimalVideoProviderPrompt") &&
      minimalVideoPromptFunction.includes("videoProviderUserPrompt(payload)") &&
      files.providerPrompt.includes("minimalVideoReferenceInstruction") &&
      files.providerPrompt.includes("MINIMAL_VIDEO_CLEAN_OUTPUT_CONSTRAINT") &&
      files.providerPrompt.includes("Output format lock:") &&
      files.providerPrompt.includes("Style fidelity lock:") &&
      files.providerPrompt.includes("Treat it as binding visual evidence") &&
      files.providerPrompt.includes("Treat the uploaded frames as binding visual evidence") &&
      !singleReferenceJsonPromptFunction.includes("buildVideoSkillPackQualityPrompt") &&
      !singleReferenceJsonPromptFunction.includes("videoThemePrompt") &&
      !directJsonPromptFunction.includes("buildVideoSkillPackQualityPrompt") &&
      !directJsonPromptFunction.includes("videoThemePrompt") &&
      !minimalVideoPromptFunction.includes("videoThemePrompt") &&
      !minimalVideoPromptFunction.includes("buildOpeningPortraitVideoPrompt") &&
      files.dispatch.includes("function buildOpenAiJsonVideoPrompt") &&
      files.dispatch.includes("? buildOpenAiJsonVideoPrompt(params.payload, assets, videoParams)") &&
      files.dispatch.includes('referenceCount > 1 ? "smartpicklid_json_data_uri_images" : "smartpicklid_json_data_uri_image"')
  },
  {
    label: "video provider falls through to another model when a create channel returns a gateway error",
    pass: files.dispatch.includes("function shouldTryNextVideoModel(") &&
      files.dispatch.includes('message.includes("ai_provider_video_create_failed_404_")') &&
      files.dispatch.includes('message.includes("ai_provider_video_create_failed_502_")') &&
      files.dispatch.includes('message.includes("ai_provider_video_create_failed_524_")') &&
      files.dispatch.includes('message.includes("upstream_error")') &&
      files.dispatch.includes('message.includes("服务暂时不可用")') &&
      files.dispatch.includes('message.includes("failed_524")') &&
      files.dispatch.includes("if (!shouldTryNextVideoModel(error)) break")
  },
  {
    label: "paid video task creation does not retry ambiguous network failures by default",
    pass: files.dispatch.includes('LOCAL_AI_WORKER_ALLOW_PAID_VIDEO_RETRIES') &&
      files.dispatch.includes('process.env.LOCAL_AI_WORKER_ALLOW_PAID_VIDEO_RETRIES !== "1"') &&
      files.providerFallback.includes('LOCAL_AI_WORKER_ALLOW_PAID_VIDEO_PROVIDER_FALLBACK') &&
      files.dispatch.includes('AI_WORKER_ALLOW_PAID_CREATE_PROXY_FALLBACK') &&
      files.providerFallback.includes('if (!shouldAllowPaidVideoProviderFallback(env)) return false;') &&
      files.providerFallback.includes('function shouldTryNextPaidVideoProvider(') &&
      files.providerFallback.includes('timing?.providerTaskCreatedAt') &&
      files.dispatch.includes('if (!shouldTryNextPaidVideoProvider(error, lastProviderTiming)) break;') &&
      files.dispatch.includes("return 1;") &&
      files.dispatch.includes('if (process.env.LOCAL_AI_WORKER_ALLOW_PAID_VIDEO_RETRIES !== "1") return false;') &&
      shouldTryNextVideoModelFunction.includes('message.includes("ai_provider_video_create_failed_502_")') &&
      !shouldTryNextVideoModelFunction.includes('message.includes("fetch failed")') &&
      !shouldTryNextVideoModelFunction.includes('message.includes("econnreset")') &&
      !shouldTryNextVideoModelFunction.includes('message.includes("socket")') &&
      !shouldTryNextVideoModelFunction.includes('message.includes("terminated")')
  },
  {
    label: "OpenAI-compatible reference video uses provider-compatible image-to-video candidates",
    pass: videoProviderModelCandidatesFunction.includes("function videoProviderModelCandidates(") &&
      files.dispatch.includes("function isImageToVideoModel(") &&
      files.dispatch.includes("const imageToVideoCandidates") &&
      videoProviderModelCandidatesFunction.includes('protocol === "openai-videos" && isSmartPickLidBaseUrl') &&
      videoProviderModelCandidatesFunction.includes("smartPickLidReferenceCandidates") &&
      videoProviderModelCandidatesFunction.includes('"grok-imagine-video-special"') &&
      videoProviderModelCandidatesFunction.includes('"grok-imagine-1.5-special"') &&
      videoProviderModelCandidatesFunction.includes('"grok-imagine-video"') &&
      videoProviderModelCandidatesFunction.includes('"grok-video-3-pro"') &&
      videoProviderModelCandidatesFunction.includes("smartPickLidTextCandidates") &&
      videoProviderModelCandidatesFunction.includes("referenceAssetCount > 1") &&
      files.dispatch.includes('protocol === "openai-videos" && (referenceAssetCount > 0 || shouldPreferSmartPickLidJsonModel)') &&
      files.dispatch.includes("return Array.from(new Set(imageToVideoCandidates.filter(Boolean)))") &&
      files.dispatch.includes("videoProviderModelCandidates(model, { protocol, referenceAssetCount: taskReferenceAssets.length, baseUrl })")
  },
  {
    label: "video worker optimizes generated video files for playback before storage",
    pass: files.dispatch.includes("ffmpeg-static") &&
      files.dispatch.includes("function optimizeGeneratedVideoForPlayback(") &&
      files.dispatch.includes("AI_WORKER_OPTIMIZE_VIDEO_OUTPUTS") &&
      files.dispatch.includes("type GeneratedVideoOptimizeMode") &&
      files.dispatch.includes('return "async";') &&
      files.dispatch.includes("AI_WORKER_VIDEO_OPTIMIZE_CRF") &&
      files.dispatch.includes('"-movflags"') &&
      files.dispatch.includes('"+faststart"') &&
      files.dispatch.includes("const downloadedVideo = await downloadVideoResult") &&
      files.dispatch.includes("const optimizeMode = generatedVideoOptimizeMode()") &&
      files.dispatch.includes('optimizeMode === "sync"') &&
      files.dispatch.includes('const asyncVideoOptimization = optimizeMode === "async" ? async () =>') &&
      files.dispatch.includes("replaceSettledGenerationOutputStorageKeyRelational") &&
      files.dispatch.includes("writeCustomerAssetFileShared")
  },
  {
    label: "video worker supports text-to-video requests without frame images",
    pass: files.worker.includes("if (isVideoWorkerJob(params.job)) return []") &&
      files.dispatch.includes("buildTextToVideoPrompt") &&
      files.dispatch.includes("!assets.length") &&
      files.dispatch.includes("? buildTextToVideoPrompt(params.payload, videoParams)") &&
      files.dispatch.includes("return buildMinimalVideoProviderPrompt(payload, [], videoParams)") &&
      !files.dispatch.includes("if (!referenceAsset) throw new Error(\"ai_provider_video_first_frame_required\")")
  },
  {
    label: "video provider records configured capacity while keeping multi-image references direct",
    pass: files.dispatch.includes("configuredProviderReferenceLimit") &&
      files.dispatch.includes("providerReferenceLimit = directJsonReferences ? openAiJsonVideoReferenceLimit() : configuredProviderReferenceLimit") &&
      !files.dispatch.includes("Original selected frame count") &&
      files.dispatch.includes("buildVideoPrompt(params.payload, assets, videoParams)")
  },
  {
    label: "video provider create timeout is long enough for proxied reference uploads",
    pass: files.dispatch.includes("function videoProviderCreateTimeoutMs(") &&
      files.providerTimeouts.includes("LOCAL_AI_WORKER_VIDEO_CREATE_TIMEOUT_MS") &&
      files.providerTimeouts.includes("DEFAULT_VIDEO_PROVIDER_CREATE_TIMEOUT_MS = 180_000") &&
      files.providerTimeouts.includes("videoProviderCreateTimeoutMs") &&
      files.dispatch.includes("configuredVideoProviderCreateTimeoutMs") &&
      files.dispatch.includes("const createTimeoutMs = videoProviderCreateTimeoutMs(params.timeoutMs)") &&
      files.dispatch.includes("`ai_provider_video_create_timeout_${createTimeoutMs}`") &&
      !files.dispatch.includes("ai_provider_video_create_timeout_${Math.min(params.timeoutMs, 60_000)}")
  },
  {
    label: "video worker and stale-job recovery share the same provider timeout helpers",
    pass: files.dispatch.includes("videoProviderWorkerTimeoutMs") &&
      files.dispatch.includes("configuredVideoProviderCreateTimeoutMs") &&
      files.providerTimeouts.includes("DEFAULT_VIDEO_PROVIDER_WORKER_TIMEOUT_MS = 900_000") &&
      files.providerTimeouts.includes("VIDEO_PROVIDER_CREATE_TIMEOUT_DEFAULT_MS")
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
    label: "active video provider prompts include bounded fidelity locks without backend theme expansions",
    pass: files.providerPrompt.includes("Use the uploaded image as the visual reference and first-frame source.") &&
      files.providerPrompt.includes("Treat it as binding visual evidence") &&
      files.providerPrompt.includes("Use the uploaded images in the selected order as visual references.") &&
      files.providerPrompt.includes("Treat the uploaded frames as binding visual evidence") &&
      files.providerPrompt.includes("Output format lock:") &&
      files.providerPrompt.includes("Style fidelity lock:") &&
      files.providerPrompt.includes("Create one clean MP4 video clip. No unintended captions, text overlay, watermark, UI, collage, split screen, or storyboard panels.") &&
      files.providerPrompt.includes("Follow any explicit request for dialogue, captions, subtitles, shop names, phone numbers, or other on-screen text.") &&
      !minimalVideoPromptFunction.includes("buildVideoQualitySystemPrompt") &&
      !minimalVideoPromptFunction.includes("buildVideoReferenceContractPrompt") &&
      !minimalVideoPromptFunction.includes("buildExplicitUserDirectionPrompt") &&
      !minimalVideoPromptFunction.includes("buildVideoSkillPackQualityPrompt") &&
      !minimalVideoPromptFunction.includes("Theme prompt") &&
      !directJsonPromptFunction.includes("themePrompt") &&
      !directJsonPromptFunction.includes("videoThemePrompt") &&
      !directJsonPromptFunction.includes("Internal fallback video preset")
  },
  {
    label: "opening portrait helpers remain outside the active provider prompt",
    pass: files.dispatch.includes("userRequestsOpeningPortraitSequence") &&
      files.dispatch.includes("buildOpeningPortraitStarterScenePrompt") &&
      files.dispatch.includes("Opening-beat lock for the starter scene") &&
      files.dispatch.includes("not a summary of the full sequence") &&
      !minimalVideoPromptFunction.includes("buildOpeningPortraitVideoPrompt") &&
      !directJsonPromptFunction.includes("buildOpeningPortraitVideoPrompt")
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
    label: "platform provider model picker includes the Grok and Seedance special video models",
    pass: files.providers.includes("grok-video-3-pro") &&
      files.providers.includes("seedance-2-0-special") &&
      files.providers.includes("grok-imagine-video-special") &&
      files.providers.includes("grok-imagine-1.5-special") &&
      files.providers.includes("grok-imagine-video") &&
      files.providers.includes("grok-imagine-video-1.5-preview") &&
      files.providers.includes("grok-video-3.5-1015")
  },
  {
    label: "Seedance special configure script appends without changing provider priorities or site apps",
    pass: files.seedanceConfigure.includes("aiprov_tokengo_media_seedance_2_0_special") &&
      files.seedanceConfigure.includes("seedance-2-0-special") &&
      files.seedanceConfigure.includes('providerType: "video"') &&
      files.seedanceConfigure.includes("DEFAULT_VIDEO_PROVIDER_REFERENCE_LIMIT = 9") &&
      files.seedanceConfigure.includes("nextVideoProviderPriority") &&
      files.seedanceConfigure.includes("provider ? provider.priority + 1 : 0") &&
      files.seedanceConfigure.includes("preferred = existingProvider?.preferred ?? false") &&
      files.seedanceConfigure.includes("SEEDANCE_SPECIAL_VIDEO_API_KEY") &&
      files.seedanceConfigure.includes("TOKENGO_VIDEO_API_KEY") &&
      files.seedanceConfigure.includes("BUMING_VIDEO_API_KEY") &&
      files.seedanceConfigure.includes("billableCreateAttempts: 0") &&
      files.packageJson.includes('"configure:seedance-special-video-provider"') &&
      !files.seedanceConfigure.includes("siteAiApp.updateMany") &&
      !files.seedanceConfigure.includes("updateMany") &&
      !files.seedanceConfigure.includes("makeCurrent")
  },
  {
    label: "platform provider UI exposes the inferred provider protocol",
    pass: files.providerPanel.includes("providerProtocolText") &&
      files.providerPanel.includes("Media task API") &&
      files.providerPanel.includes("Buming / TokenGo media") &&
      files.providerPanel.includes("接口协议")
  },
  {
    label: "platform provider UI labels the request image limit as reference images",
    pass: files.providerPanel.includes("单次最多参考图") &&
      files.providerPanel.includes("单次参考图")
  },
  {
    label: "video provider data script defaults video reference capability to the global cap",
    pass: files.multiframeScript.includes("VIDEO_PROVIDER_MAX_IMAGES_PER_REQUEST") &&
      files.multiframeScript.includes("DEFAULT_VIDEO_PROVIDER_REFERENCE_LIMIT = 7") &&
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
  },
  {
    label: "local loopback worker callbacks persist directly and failures settle the job",
    pass: files.dispatch.includes("settleGenerationJobRelational") &&
      files.dispatch.includes("updateGenerationJobStatusRelational") &&
      files.dispatch.includes("function shouldUseDirectWorkerCallbacks(") &&
      files.dispatch.includes('process.env.LOCAL_AI_WORKER_DIRECT_DB_CALLBACKS?.trim()') &&
      files.dispatch.includes("isLoopbackCallbackUrl(payload.callbackUrl)") &&
      files.dispatch.includes("await updateGenerationJobStatusRelational(body).catch(() => null)") &&
      files.dispatch.includes("await settleGenerationJobRelational(resultBody)") &&
      files.dispatch.includes("local_ai_worker_dispatch_failure_settlement_failed")
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
