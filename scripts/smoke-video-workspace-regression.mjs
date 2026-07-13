import fs from "fs";
import path from "path";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const config = read("src/lib/video-frame-config.ts");
assert(config.includes("DEFAULT_VIDEO_FRAME_LIMIT = 30"), "video frame default limit should be 30");
assert(config.includes("MAX_VIDEO_FRAME_LIMIT = 30"), "video frame max limit should be 30");
assert(config.includes("return Math.max(1, Math.min(MAX_VIDEO_FRAME_LIMIT, count));"), "explicit lower theme frame limits should be preserved inside the shared cap");
assert(!config.includes("return Math.max(minimum"), "video frame normalization should not force every theme up to the default limit");
assert(config.includes("VIDEO_DURATION_OPTIONS"), "video duration options should be shared between UI and backend");
assert(config.includes("videoDurationCreditCost"), "video duration pricing should use a shared helper");
assert(config.includes("trimVideoFrameSelection"), "video frame selection trimming should be shared between UI components");
assert(config.includes("frameIds.slice(-limit)"), "provider-aware frame trimming should keep the latest clicked frame when over limit");

const videoWorkspace = read("src/components/storefront/customer-video-workspace.tsx");
assert(videoWorkspace.includes("status === 403 || error?.includes(\"csrf\")"), "video workspace should identify CSRF failures instead of blaming frame images");
assert(videoWorkspace.includes("Your secure session expired. Refresh the page, then try again."), "video workspace should show a secure-session message for CSRF failures");
assert(videoWorkspace.includes("function isCsrfError"), "video workspace should centralize CSRF error detection");
assert(videoWorkspace.includes("refresh=csrf-"), "video workspace should refresh customer runtime to self-heal stale CSRF cookies");
assert(videoWorkspace.includes("response = await submitRequest();"), "video workspace should retry video creation once after CSRF self-heal");
assert(videoWorkspace.includes("selectedTheme?.effectiveMaxFrames ?? selectedTheme?.maxFrames"), "video workspace should use the resolved video preset frame limit");
assert(videoWorkspace.includes("trimVideoFrameSelection(current, maxFrames)"), "video workspace should trim over-limit selections by keeping the latest clicked frames");
assert(videoWorkspace.includes("Selected frames are first composed into one AI starter scene"), "video workspace should explain multi-frame scene composition before provider dispatch");
assert(videoWorkspace.includes("customerBalance?: PublicCustomer[\"balance\"]"), "video workspace should accept updated customer balance from job creation");
assert(videoWorkspace.includes("onJobCreated(result.job.id, { customerBalance: result.customerBalance })"), "video job creation should return updated balance to the workspace shell");
assert(videoWorkspace.includes('PROMPT_DIRECTED_VIDEO_THEME_SLUG = "prompt-directed-motion"'), "video workspace should prefer the neutral prompt-directed video preset");
assert(videoWorkspace.includes("function defaultVideoTheme"), "video workspace should resolve a neutral default video preset explicitly");
assert(videoWorkspace.includes("defaultVideoTheme(nextThemes)?.id"), "video workspace should not default to the first active video theme");
assert(!videoWorkspace.includes("nextThemes[0]?.id"), "video workspace should not silently select the first active video theme");
assert(!videoWorkspace.includes("themes.find((theme) => theme.id === selectedThemeId) ?? themes[0]"), "video workspace should not fall back to the first active video theme inline");
assert(videoWorkspace.includes("VIDEO_DURATION_OPTIONS.map"), "video workspace should render selectable duration options");
assert(videoWorkspace.includes("selectedDurationSeconds"), "video workspace should track the selected duration");
assert(videoWorkspace.includes("videoDurationCreditCost(selectedTheme.creditCost"), "video workspace should price the selected duration dynamically");
assert(!videoWorkspace.includes('onJobCreated(result.job.id, "videos")'), "video jobs should not route through the resource Videos tab");
assert(!videoWorkspace.includes("Math.min(4"), "video workspace should not clamp frame count to 4");
assert(!videoWorkspace.includes('id="video-step-themes"'), "video theme selection should stay hidden from the customer workspace");
assert(videoWorkspace.includes("Agent video composer"), "video input should use the simplified composer module");
assert(!videoWorkspace.includes('"Add frames"'), "right-side video composer should not duplicate the left frame selector");
assert(!videoWorkspace.includes('"Agregar fotogramas"'), "right-side video composer should not duplicate the left frame selector in Spanish");
assert(!videoWorkspace.includes('"Manage frames"'), "right-side video composer should not duplicate frame management");
assert(!videoWorkspace.includes('"Gestionar fotogramas"'), "right-side video composer should not duplicate frame management in Spanish");
assert(videoWorkspace.includes("VIDEO_ASPECT_OPTIONS"), "video composer should expose aspect ratio options");
assert(videoWorkspace.includes("VIDEO_RESOLUTION_OPTIONS"), "video composer should expose resolution options");
assert(videoWorkspace.includes("formatPanelOpen"), "video format options should render as a compact dropdown panel");
assert(videoWorkspace.includes("aspect_ratio: selectedAspectRatio"), "video jobs should submit the selected aspect ratio");
assert(videoWorkspace.includes("resolution: selectedResolution"), "video jobs should submit the selected resolution");
assert(videoWorkspace.includes("text-xs font-semibold leading-5 text-red-400"), "video composer operation messages should render in red for visibility");

const customerAdminAccess = read("src/lib/customer-admin-access.ts");
assert(customerAdminAccess.includes("getCurrentPlatformAdmin"), "customer admin access should recognize platform admin sessions");
assert(customerAdminAccess.includes('source: "platform_admin_session"'), "platform admins should be marked as billing bypass admins");

const jobStore = read("src/lib/stores/job-store.ts");
assert(jobStore.includes("normalizeVideoDurationSeconds"), "job store should normalize requested video durations");
assert(jobStore.includes("videoDurationCreditCost(videoTheme.creditCost"), "job store should bill video duration choices dynamically");
assert(jobStore.includes("selectedDurationSeconds"), "job store should snapshot the selected video duration");
assert(jobStore.includes("requestedAssetIdsForRequest(params.requestJson, videoMode)"), "job store should accept video frame ids from either assetIds or fields.frameAssetIds");
assert(jobStore.includes("effectiveVideoFrameLimit(videoProviders, videoTheme.maxFrames)"), "job store should validate video frames against the preset frame limit");
assert(jobStore.includes("providerMaxFrames: videoProviderMaxFrames"), "job store should snapshot provider frame capacity for transparency");
assert(jobStore.includes("function videoReferenceContractInstruction"), "job store should add a video reference contract before provider dispatch");
assert(jobStore.includes("Video reference contract: treat the selected frame images as binding source resources"), "video job prompts should treat selected frames as binding resources");
assert(jobStore.includes("User explicit direction wins over preset/theme wording"), "video job prompts should prioritize explicit user action over theme wording");
assert(jobStore.includes("Cast continuity is mandatory"), "video job prompts should require uploaded people to remain the generated cast");
assert(jobStore.includes("Frame 1 subject is Character A"), "video job prompts should map ordered frames to stable character roles");
assert(!jobStore.includes("Source images win over preset, theme, style, and user-note wording"), "video job prompts should not let source framing erase explicit user direction");
assert(jobStore.includes("videoReferenceContract"), "video job prompt metadata should snapshot the reference contract");
assert(jobStore.includes("const hasPaidCreditRequest = creditsReserved > 0"), "job store should recognize paid credit-backed generation requests");
assert(jobStore.includes("!activeSubscription && !hasPaidCreditRequest"), "job store should only require a subscription when no paid credits are being reserved");
assert(jobStore.includes('asset.role !== "input" || !asset.mimeType.startsWith("image/")'), "video job validation should accept selected customer input images even when old uploads lack a video_frame subjectRole");

const jobsRoute = read("src/app/api/sites/[siteId]/ai/jobs/route.ts");
assert(jobsRoute.includes("...(isVideoJobRequest(body) ? stringArray(fields.frameAssetIds) : [])"), "job API should preserve video frame ids submitted inside fields.frameAssetIds");

const customerCsrf = read("src/lib/customer-csrf.ts");
assert(customerCsrf.includes("ensureCustomerCsrfCookie"), "customer GET APIs should share a CSRF self-heal helper");
assert(customerCsrf.includes("verifyCsrfToken"), "customer CSRF self-heal should verify the existing token before replacing it");
assert(customerCsrf.includes("setCsrfCookie"), "customer CSRF self-heal should issue a fresh token when missing or stale");

const customerBootstrapRoute = read("src/app/api/site-slugs/[siteSlug]/customer/bootstrap/route.ts");
assert(customerBootstrapRoute.includes("ensureCustomerCsrfCookie"), "customer bootstrap should refresh CSRF cookies for authenticated sessions");

const customerRuntimeRoute = read("src/app/api/sites/[siteId]/customer/runtime/route.ts");
assert(customerRuntimeRoute.includes("ensureCustomerCsrfCookie"), "customer runtime refresh should refresh CSRF cookies for authenticated sessions");

const videoThemesRoute = read("src/app/api/sites/[siteId]/video-themes/route.ts");
assert(videoThemesRoute.includes("effectiveMaxFrames"), "video theme API should expose the usable preset frame limit");
assert(videoThemesRoute.includes("providerMaxFrames"), "video theme API should expose provider frame capacity for UI messaging");

const workspaceShell = read("src/components/storefront/customer-workspace-shell.tsx");
assert(workspaceShell.includes("setCurrentCustomerBalance(feedback.customerBalance)"), "workspace shell should apply created job balance updates immediately");
assert(workspaceShell.includes("const workspaceCustomer = useMemo"), "workspace shell should pass a locally refreshed customer object to generation panels");
assert(workspaceShell.includes("function videoJobFrameIds"), "workspace shell should read video frame ids consistently from job request data");
assert(workspaceShell.includes("This video request did not include selected frame images"), "workspace shell should warn when a historical video result has no frame references");
assert(workspaceShell.includes("URL.createObjectURL(file)"), "video frame uploads should use optimistic local previews");
assert(workspaceShell.includes("local:video:"), "video frame uploads should create local optimistic asset ids");
assert(workspaceShell.includes("uploaded and selected"), "video frame uploads should auto-select successful uploads");
assert(workspaceShell.includes("const videoResourceAssets = galleryAssets.filter(isVideoAsset);"), "videos should be split from image resources");
assert(workspaceShell.includes("const imageResourceAssets = galleryAssets.filter((asset) => !isVideoAsset(asset));"), "image resource tabs should exclude videos");
assert(workspaceShell.includes('type WorkspaceResourceTab = "all" | "recent" | "favorites" | "try-on" | "packages";'), "resource tabs should not expose a separate Videos tab");
assert(workspaceShell.includes('type VideoWorkspaceTab = "generate" | "videos";'), "the video workspace should expose only input and result tabs");
assert(workspaceShell.includes('{ id: "generate", label: t(spanishXby, "Input", "Entrada") }'), "the video workspace should label the input module tab");
assert(workspaceShell.includes('{ id: "videos", label: t(spanishXby, "Video results", "Resultados") }'), "the video workspace should label the results module tab");
assert(!workspaceShell.includes('{ id: "themes"'), "the video workspace should not expose a theme tab");
assert(!workspaceShell.includes('{ id: "frames"'), "the video workspace should not expose a frame tab in the top tab bar");
assert(!workspaceShell.includes('chooseVideoWorkspaceTab("frames")'), "frame management should not be a top-level workspace tab");
assert(workspaceShell.includes("onOpenFrameManager={focusVideoFrameManager}"), "frame management should stay available from the input composer");
assert(workspaceShell.includes('aria-label={t(spanishXby, "Clear selected video frames"'), "selected frame list should use an icon-only clear control");
assert(workspaceShell.includes('className="flex shrink-0 items-center gap-1"'), "selected frame row actions should stay on one line");
assert(workspaceShell.includes('aria-label={t(spanishXby, "Remove frame"'), "selected frame removal should be icon-only");
assert(!workspaceShell.includes("col-span-2 grid h-7"), "selected frame row actions should not wrap into a second row");
assert(workspaceShell.includes("const videoRuntimeJobs = recentJobs.filter(isVideoRuntimeJob);"), "video jobs should be scoped to the video workspace");
assert(workspaceShell.includes('id="video-workspace-videos"'), "video workspace should render its own video results panel");
assert(workspaceShell.includes("onJobCreated={showVideoJobStatus}"), "video generation should route to the video workspace Videos tab");
assert(workspaceShell.includes("text-xs font-semibold leading-5 text-red-400"), "video frame sidebar operation messages should render in red for visibility");
assert(workspaceShell.includes("group/video relative block w-full bg-black text-left"), "video resource cards should use the app preview entry instead of native thumbnail controls");
assert(workspaceShell.indexOf("{selectedPreviewAsset ? (") > workspaceShell.indexOf("</main>"), "generated asset preview dialog should render outside panel-specific branches");
assert(workspaceShell.includes('className="aspect-video w-full bg-black object-contain"'), "video previews should preserve the full 16:9 frame without cropping");
assert(workspaceShell.includes("autoPlay"), "video thumbnails should autoplay muted so cards do not render as black frames");
assert(workspaceShell.includes('preload="auto"'), "video thumbnails should preload enough data to show moving previews");
assert(workspaceShell.includes("videoPosterUrlForJob"), "video cards should use the source frame as a poster fallback");
assert(workspaceShell.includes("poster={videoPosterUrl}"), "video thumbnails should render a non-black poster while media loads");
assert(!workspaceShell.includes('className="aspect-[4/5] w-full object-cover"\n                controls'), "video resource thumbnails should not use cropped portrait native controls");
assert(!workspaceShell.includes('resourceTab === "videos"'), "resource overview should not render video-specific tab logic");
assert(workspaceShell.includes("The video provider connection was interrupted"), "video provider network failures should not be described as public frame URL failures");
assert(workspaceShell.includes("function workspaceJobEffectiveStatus"), "workspace job cards should derive an effective status from final job and slot states");
assert(workspaceShell.includes('outputSlots.length > 0 && outputSlots.every((slot) => slot.status === "failed")'), "failed output slots should collapse a stale running job display to failed");
assert(workspaceShell.includes("workspaceJobBody(job, spanishXby, slots)"), "workspace job failure body should use slot errors when final job error has not refreshed yet");
assert(workspaceShell.includes('status === "failed" || status === "partial"'), "partial job states should count as needing attention");

const worker = read("src/lib/worker.ts");
assert(worker.includes("configuredWorkerPublicBaseUrl"), "worker should support a configured public base URL");
assert(worker.includes("AI_WORKER_PUBLIC_BASE_URL"), "worker public base URL should have an explicit env var");
assert(worker.includes('if (isVideoWorkerJob(params.job)) throw new Error("video_frames_required")'), "worker payload builder should not substitute demo images for video jobs with no frames");
assert(worker.includes("...(isVideoWorkerJob(job) ? stringArray(fields.frameAssetIds) : [])"), "worker payload builder should accept video frame ids from fields.frameAssetIds");
assert(worker.includes("CUSTOMER_ASSET_READ_BASE_URL"), "video providers should use the configured public customer asset read base URL");
assert(worker.includes("NEXT_PUBLIC_CUSTOMER_ASSET_READ_BASE_URL"), "video providers should support the public customer asset read base URL used by local storefront config");
assert(worker.includes("isLoopbackBaseUrl"), "worker should expose loopback public URL detection");
assert(worker.includes("const requestBaseUrl = publicBaseUrl.replace"), "worker should keep the request origin separate from the provider public asset base URL");
assert(worker.includes("if (!configuredEndpoint) return { publicBaseUrl: normalizedPublicBaseUrl, callbackBaseUrl: requestBaseUrl };"), "local worker dispatch should use the current request origin for callbacks");

assert(jobsRoute.includes("shouldRequireProviderReachableVideoFrames"), "video job creation should gate public URL preflight by environment");
assert(jobsRoute.includes('process.env.NODE_ENV === "production"'), "video public URL preflight should default to production only");
assert(jobsRoute.includes("shouldRequireProviderReachableVideoFrames() && isVideoJobRequest(body) && isLoopbackBaseUrl"), "local development should not be blocked by the public URL preflight");

const jobCreateForm = read("src/components/app/job-create-form.tsx");
assert(jobCreateForm.includes("customerBalance?: PublicCustomer[\"balance\"]"), "image job form should accept updated customer balance from job creation");
assert(jobCreateForm.includes("customerBalance: result.customerBalance"), "image job creation should return updated balance to the workspace shell");
assert(jobCreateForm.includes("const hasCreditsForRequest = selectionCreditCost > 0 && selectionCreditCost <= customer.balance.available"), "image job form should allow paid requests to start from available credits");
assert(jobCreateForm.includes("const subscriptionHardGate = subscriptionStatus === \"required\" && !hasCreditsForRequest"), "image job form should only hard-gate subscription when credits cannot cover the request");

assert(videoWorkspace.includes("const hasCreditsForSelectedVideo = selectedCreditCost > 0 && selectedCreditCost <= customer.balance.available"), "video workspace should allow paid video requests to start from available credits");
assert(videoWorkspace.includes("subscriptionStatus === \"required\" && !hasCreditsForSelectedVideo"), "video workspace should only hard-gate subscription when credits cannot cover the video");

const localAssetsRoute = read("src/app/api/local-assets/[...path]/route.ts");
assert(localAssetsRoute.includes("parseByteRange"), "local asset proxy should parse browser Range requests for video playback");
assert(localAssetsRoute.includes("status: 206"), "local asset proxy should return partial content for ranged video requests");
assert(localAssetsRoute.includes('"Content-Range"'), "local asset proxy should send Content-Range for ranged video requests");
assert(localAssetsRoute.includes('"Accept-Ranges": "bytes"'), "local asset proxy should advertise byte range support");
assert(localAssetsRoute.includes("verifyWorkerLocalAssetDownload"), "local asset proxy should allow temporary worker-signed reads for provider-only scene references");
assert(localAssetsRoute.includes('url.searchParams.get("worker") === "1"'), "local asset proxy should only accept signed reads through an explicit worker flag");

const dispatchRoute = read("src/app/api/internal/ai-worker/dispatch/route.ts");
assert(dispatchRoute.includes("return inputAssets(payload).slice(0, maxFrames);"), "video worker should use the normalized frame limit");
assert(!/function videoFrameAssets[\s\S]*?slice\(0,\s*4\)/.test(dispatchRoute), "video worker should not truncate frames to 4");
assert(dispatchRoute.includes("shouldRejectLoopbackVideoFrameUrls"), "video worker should gate loopback rejection by environment");
assert(dispatchRoute.includes("shouldRejectLoopbackVideoFrameUrls() && imageUrls.some(isLoopbackUrl)"), "local development should not reject loopback frame URLs");
assert(dispatchRoute.includes("shouldUseVideoFrameDataUriFallback"), "local video worker should support data URI fallback for provider frame URLs");
assert(dispatchRoute.includes("ai_provider_video_frame_data_uri_source_failed"), "video data URI fallback should fetch the signed source frame before provider dispatch");
assert(dispatchRoute.includes("videoProviderDataUriFrameUrls"), "video worker should be able to force frame data URI URLs");
assert(dispatchRoute.includes("shouldRetryVideoTaskWithDataUriFrames"), "video worker should retry video providers with data URI frames when URL-based frame reads fail");
assert(dispatchRoute.includes("shouldCompressVideoReferenceImages"), "video worker should compress multipart video reference images before provider dispatch");
assert(dispatchRoute.includes("LOCAL_AI_WORKER_VIDEO_REFERENCE_MAX_DIMENSION"), "video worker should bound video reference image dimensions");
assert(dispatchRoute.includes("shouldRetryOpenAiVideoTaskWithFirstFrame"), "OpenAI-compatible video worker should retry multi-frame transient failures with the first frame");
assert(dispatchRoute.includes("video_provider_retry_first_frame"), "video worker should report first-frame retry progress");
assert(dispatchRoute.includes("composeVideoSceneReference"), "video worker should compose multiple selected frames into one starter scene");
assert(dispatchRoute.includes("video_scene_composition_started"), "video worker should report scene-composition progress before video dispatch");
assert(dispatchRoute.includes("const providerReferenceLimit = 1;"), "video worker should send one image reference to the upstream video provider");
assert(dispatchRoute.includes("requestedReferenceAssets.length > providerReferenceLimit"), "video worker should compose whenever selected frames exceed the one-image provider contract");
assert(dispatchRoute.includes("composedScene ? [composedScene.asset]"), "video worker should use the composed starter scene as the provider reference");
assert(dispatchRoute.includes("buildVideoSceneImagePrompt"), "video worker should build a dedicated scene-composition prompt");
assert(dispatchRoute.includes("Original selected frame count"), "video prompt should record how many user frames were composed");
assert(dispatchRoute.includes("Identity preservation is the highest requirement"), "video scene composition prompt should prioritize uploaded character identity");
assert(dispatchRoute.includes("generic couple model"), "video scene composition prompt should prevent generic couple recasting");
assert(dispatchRoute.includes("videoFrameReferenceFileLabel"), "video scene image edits should label uploaded frames as character references");
assert(dispatchRoute.includes("video-frame-${frameIndex + 1}-${characterLabel}") && dispatchRoute.includes('"character-a"'), "video scene image edit uploads should label frame 1 as character A");
assert(dispatchRoute.includes("signedLocalAssetUrl"), "video scene reference assets should use signed local asset URLs");
assert(dispatchRoute.includes("signWorkerLocalAssetDownload"), "video scene reference URLs should be signed for provider access without a customer cookie");
assert(dispatchRoute.includes("referenceFrameCount"), "video worker should report how many frame references were actually sent");
assert(dispatchRoute.includes("AI_WORKER_HTTP_PROXY"), "video worker should allow provider requests to use an explicit local proxy");
assert(dispatchRoute.includes("ProxyAgent"), "provider fetches should support an undici proxy dispatcher");
assert(dispatchRoute.includes("videoProviderModelCandidates"), "video worker should retry compatible video model aliases when the provider channel is unavailable");
assert(dispatchRoute.includes("shouldTryNextVideoModel"), "video worker should try the next model when a create channel returns a gateway failure");
assert(dispatchRoute.includes('ai_provider_video_create_failed_502_'), "video worker should recognize provider create 502 responses as model fallback candidates");
assert(dispatchRoute.includes('LOCAL_AI_WORKER_VIDEO_PROVIDER_ATTEMPTS ?? "2"'), "video worker should retry transient provider failures by default");
assert(dispatchRoute.includes('message.includes("failed_502")'), "video worker should treat transient 502 provider failures as retryable");
assert(dispatchRoute.includes("10_000 * attempt"), "video worker should leave enough time between provider create retries");
assert(dispatchRoute.includes("generateLocalFallbackVideo"), "local video worker should keep an explicit development fallback available");
assert(dispatchRoute.includes('if (explicit === "1") return true;'), "local video fallback should require an explicit opt-in");
assert(dispatchRoute.includes("return false;"), "video generation should not silently fall back when the external provider is unavailable");
assert(dispatchRoute.includes("videoSizeForParams"), "video worker should map aspect ratio and resolution to provider size");
assert(dispatchRoute.includes('new Set(["16:9", "4:3", "1:1", "3:4", "9:16", "3:2", "2:3"])'), "video worker should accept every aspect ratio offered by the composer");
assert(dispatchRoute.includes('aspectRatio === "4:3"'), "video worker should map 4:3 output size");
assert(dispatchRoute.includes('aspectRatio === "3:4"'), "video worker should map 3:4 output size");
assert(dispatchRoute.includes("size: params.videoParams.size"), "openai-compatible video requests should send an explicit output size");
assert(dispatchRoute.includes("buildVideoQualitySystemPrompt"), "video prompts should include an internal quality rule system");
assert(dispatchRoute.includes("buildVideoReferenceContractPrompt"), "video provider prompt should include a source-resource reference contract");
assert(dispatchRoute.includes("Highest priority user direction"), "video provider prompt should put explicit user direction ahead of theme wording");
assert(dispatchRoute.includes("Resource priority: frame image content defines visible source subjects"), "video provider prompt should preserve frame resources while respecting user action direction");
assert(dispatchRoute.includes("Cast continuity is mandatory"), "video provider prompt should require uploaded people to remain the generated cast");
assert(dispatchRoute.includes("Direct reference rule"), "video provider prompt should tell the provider to use original frame images as the identity source");
assert(dispatchRoute.includes("Do not output only one person"), "video provider prompt should reject one-person output when the user requested a two-person scene");
assert(dispatchRoute.includes("Do not replace the requested action with walking"), "video provider prompt should reject unrelated walking motion");
assert(dispatchRoute.includes("Do not replace the source subject with a generic actor"), "video provider prompt should block generic subject replacement");
assert(dispatchRoute.includes("Internal video quality system"), "video prompts should mark quality rules as internal mandatory guidance");
assert(dispatchRoute.includes("Prompt hierarchy: ordered frame images and subject identity first"), "video prompts should prioritize reference identity over user notes");
assert(dispatchRoute.includes("Shot plan: generate one coherent continuous scene"), "video prompts should enforce a coherent motion plan");
assert(dispatchRoute.includes("Anatomy and motion guardrails"), "video prompts should protect anatomy and motion quality");
assert(dispatchRoute.includes("Multi-frame rule: use every ordered frame"), "video prompts should force use of ordered frames");
assert(dispatchRoute.includes("Clean output: no subtitles"), "video prompts should block text, watermarks, UI, and collages");
assert(dispatchRoute.includes("ffmpeg-static"), "local video fallback should use the bundled ffmpeg binary");
assert(dispatchRoute.includes("Infer plausible preceding and following action beats"), "video prompt should ask the provider to infer motion beats from the frame and prompt");
assert(dispatchRoute.includes("Preserve natural human body proportions"), "video prompt should protect body proportions and sharpness");
assert(dispatchRoute.includes(".slice(0, 3600)"), "video prompt should stay bounded while leaving room for system rules and user notes");
assert(dispatchRoute.includes('"-frames:v"'), "local video fallback should cap the exact generated frame count");
assert(!dispatchRoute.includes('"-loop",\n      "1",\n      "-t"'), "local video fallback should not loop input frames before zoompan");

const siteStore = read("src/lib/stores/site-store.ts");
assert(siteStore.includes("assetRules: { min: 1, max: DEFAULT_VIDEO_FRAME_LIMIT"), "default video workflow should use shared frame limit");
assert(siteStore.includes("maxFrames: DEFAULT_VIDEO_FRAME_LIMIT"), "default video themes should use shared frame limit");
assert(siteStore.includes('slug: "prompt-directed-motion"'), "default video themes should include a neutral prompt-directed preset");
assert(siteStore.includes("ensurePromptDirectedDefaultVideoThemeRelational"), "existing sites should backfill the neutral prompt-directed video preset");

const schema = read("prisma/schema.prisma");
assert(schema.includes("maxFrames       Int                 @default(30)"), "Prisma schema should default video themes to 30 frames");

const migration = read("prisma/migrations/20260712043000_raise_video_frame_limit/migration.sql");
assert(migration.includes('ALTER TABLE "VideoTheme" ALTER COLUMN "maxFrames" SET DEFAULT 30'), "migration should raise maxFrames default");
assert(migration.includes('WHERE "maxFrames" < 30'), "migration should lift existing legacy limits");

console.log("video workspace regression smoke passed");
