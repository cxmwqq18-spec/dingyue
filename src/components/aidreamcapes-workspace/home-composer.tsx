"use client";

import { ArrowRight, ChevronDown, ImageIcon, Monitor, Plus, Ratio, Sparkles, Timer, Upload, UserRound, Video, WandSparkles, X } from "lucide-react";
import { useCallback } from "react";
import type { TaskInput, WorkspaceCatalog } from "@/lib/aidreamcapes-workspace/types";
import { WORKSPACE_PROMPT_MAX_LENGTH } from "@/lib/aidreamcapes-workspace/types";
import type { WorkspaceImageTool } from "./image-tool-picker";
import { WORKSPACE_ASPECTS } from "@/lib/aidreamcapes-workspace/catalogs";
import { fileKind, reorderHandlers, takePasteFiles, useFileDropZone, type FileKind } from "./file-dnd";
import { WorkspaceSelect } from "./workspace-select";
import styles from "./home-composer.module.css";

export type HomeComposerTab = "AI Video Agent" | "AI Video" | "AI Image";
type Aspect = TaskInput["options"]["aspect"];
type Duration = TaskInput["options"]["duration"];
export type HomeComposerImageInput = { prompt: string; assetUrls: string[]; aspect: Aspect; toolId: WorkspaceImageTool };
export type HomeComposerVideoSelection = { modelId?: string; aspect: Aspect; duration: Duration; resolution?: string };

export interface HomeComposerProps {
  tab: string;
  showTabs?: boolean;
  onTabChange: (tab: HomeComposerTab) => void;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  catalog?: WorkspaceCatalog;
  modelId: string;
  onModelChange: (modelId: string) => void;
  aspect: Aspect;
  onAspectChange: (aspect: Aspect) => void;
  duration: Duration;
  onDurationChange: (duration: Duration) => void;
  resolution?: string;
  onResolutionChange?: (resolution: string) => void;
  products: { previewUrl: string; label?: string }[];
  onOpenProduct: () => void;
  onOpenAvatar: () => void;
  avatarName?: string;
  videoReferenceUrls: string[];
  onVideoReferenceUpload: (file: File) => void;
  onVideoReferenceRemove: (index: number) => void;
  onVideoReferenceMove?: (from: number, to: number) => void;
  videoReferenceFiles?: string[];
  onVideoFileUpload?: (file: File) => void;
  onVideoFileRemove?: (index: number) => void;
  onVideoFileMove?: (from: number, to: number) => void;
  audioReferenceFiles?: string[];
  onAudioFileUpload?: (file: File) => void;
  onAudioFileRemove?: (index: number) => void;
  onAudioFileMove?: (from: number, to: number) => void;
  imageInput: HomeComposerImageInput;
  onImageInputChange: (input: HomeComposerImageInput) => void;
  onImageReferenceUpload: (file: File) => void;
  onImageReferenceRemove: (index: number) => void;
  onImageReferenceMove?: (from: number, to: number) => void;
  onImageGenerate?: () => void;
  imageGenerateDisabled?: boolean;
  imageGenerateLabel?: string;
  onContinue: (tab: HomeComposerTab, video: HomeComposerVideoSelection) => void;
  /** 当前模型+参数组合的积分预估文案（由父组件请求报价接口后传入）。 */
  creditsNote?: string;
  onLogin?: () => void;
  disabled?: boolean;
  canUpload?: boolean;
  loginHref?: string;
}

const tabs: { id: HomeComposerTab; label: string; icon: typeof Video }[] = [
  { id: "AI Video Agent", label: "Text to Video", icon: WandSparkles }, { id: "AI Video", label: "AI Video", icon: Video }, { id: "AI Image", label: "AI Image", icon: ImageIcon },
];
const imageStyles: { id: WorkspaceImageTool; label: string }[] = [
  { id: "custom", label: "Custom image" }, { id: "white-background", label: "White background" },
  { id: "change-background", label: "Change background" }, { id: "lifestyle-photos", label: "Lifestyle photo" },
  { id: "model-photos", label: "Model photo" },
];

/** Keep displayed settings and submitted settings inside the selected model's capabilities. */
export function homeComposerVideoOptions(catalog: WorkspaceCatalog | undefined, modelId: string, aspect: Aspect, duration: Duration, resolution?: string) {
  const model = catalog?.models.find((item) => item.id === modelId) ?? catalog?.models.find((item) => item.available) ?? catalog?.models[0];
  const aspects = catalog?.aspects.filter((item) => !model || model.aspects.includes(item)) ?? [];
  const durations = catalog?.durations.filter((item) => !model || model.durations.includes(item.value)) ?? [];
  const resolutions = model?.resolutions ?? [];
  const selectedAspect = aspects.includes(aspect) ? aspect : aspects[0];
  const selectedDuration = durations.some((item) => item.value === duration) ? duration : durations[0]?.value;
  const selectedResolution = resolution && resolutions.includes(resolution) ? resolution : resolutions[0];
  return { model, aspects, durations, resolutions, selectedAspect, selectedDuration, selectedResolution };
}

function References({ urls, max, disabled, canUpload, onUpload, onRemove, onMove, kind, accept = "image/*", addLabel = "Add photo", limitLabel = "Photo limit", countNoun = "photos" }: {
  urls: string[]; max: number; disabled: boolean; canUpload: boolean;
  onUpload: (file: File) => void; onRemove: (index: number) => void; onMove?: (from: number, to: number) => void; kind: "video" | "image";
  accept?: string; addLabel?: string; limitLabel?: string; countNoun?: string;
}) {
  const dropKind: FileKind = accept.startsWith("audio") ? "audio" : accept.startsWith("video") ? "video" : "image";
  const { active: dropActive, dropProps } = useFileDropZone((files) => {
    for (const file of files) {
      if (urls.length >= max) break;
      if (fileKind(file) === dropKind) onUpload(file);
    }
  }, disabled || !canUpload);
  return <div className={`${styles.references} ${kind === "image" ? styles.imageReferences : ""}`}>
    <div className={`${styles.referenceStrip} ${dropActive ? styles.stripActive : ""}`} {...dropProps}>
      <div className={styles.referenceUploadColumn}>
        {urls.length < max ? <label className={`${styles.upload} ${!canUpload || disabled ? styles.uploadDisabled : ""}`}>
          <Upload size={19} aria-hidden="true" /><span>{addLabel}</span>
          <input type="file" accept={accept} aria-label={`Upload ${addLabel.toLowerCase()} reference`} disabled={disabled || !canUpload} onChange={(event) => {
            const file = event.target.files?.[0]; event.target.value = ""; if (file) onUpload(file);
          }} />
        </label> : <div className={`${styles.upload} ${styles.uploadFull}`} aria-hidden="true"><ImageIcon size={19} /><span>{limitLabel}</span></div>}
        <span className={styles.referenceCount} aria-label={`${kind === "video" ? "Video" : "Image"} references: ${urls.length} of ${max}`}>{`${urls.length} / ${max} ${countNoun}`}</span>
      </div>
      {urls.map((url, index) => <div key={`${url}-${index}`} className={styles.thumbnail} {...(onMove && !disabled ? reorderHandlers(index, disabled, onMove) : {})}>
        {/* Customer assets may use private authenticated URLs. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={`${kind === "video" ? "Video" : "Image"} reference ${index + 1}`} decoding="async" loading="lazy" />
        <button type="button" className={styles.remove} disabled={disabled} onClick={() => onRemove(index)} aria-label={`Remove ${kind} reference ${index + 1}`}><X size={13} /></button>
      </div>)}
    </div>
  </div>;
}

export function HomeComposer({ tab, showTabs = true, onTabChange, prompt, onPromptChange, catalog, modelId, onModelChange, aspect, onAspectChange, duration, onDurationChange, resolution, onResolutionChange, products, onOpenProduct, onOpenAvatar, avatarName, videoReferenceUrls, onVideoReferenceUpload, onVideoReferenceRemove, onVideoReferenceMove, videoReferenceFiles = [], onVideoFileUpload, onVideoFileRemove, onVideoFileMove, audioReferenceFiles = [], onAudioFileUpload, onAudioFileRemove, onAudioFileMove, imageInput, onImageInputChange, onImageReferenceUpload, onImageReferenceRemove, onImageReferenceMove, onImageGenerate, imageGenerateDisabled = false, imageGenerateLabel = "Generate image", onContinue, creditsNote, onLogin, disabled = false, canUpload = false, loginHref }: HomeComposerProps) {
  const activeTab: HomeComposerTab = tab === "AI Video" || tab === "AI Image" ? tab : "AI Video Agent";
  const imageMode = activeTab === "AI Image";
  const videoMode = activeTab === "AI Video";
  const draftMode = activeTab === "AI Video Agent";
  const { model, aspects, durations, resolutions, selectedAspect, selectedDuration, selectedResolution } = homeComposerVideoOptions(catalog, modelId, aspect, duration, resolution);
  const referenceLimit = model?.referenceImageMax ?? (model?.multiReference ? 4 : 1);
  const validVideo = Boolean(model?.available && selectedAspect && selectedDuration);
  const tooManyReferences = videoMode && videoReferenceUrls.length > referenceLimit;
  const missingReference = videoMode && !videoReferenceUrls.length;
  const canContinue = !disabled && !(imageMode && onImageGenerate && imageGenerateDisabled) && (imageMode || draftMode || validVideo) && !tooManyReferences && !missingReference;
  const promptValue = imageMode ? imageInput.prompt : prompt;
  const imageAspects = WORKSPACE_ASPECTS;
  const imageStyleOptions = imageStyles.map((style) => ({ value: style.id, label: style.label }));
  const imageAspectOptions = imageAspects.map((value) => ({ value, label: value }));
  const modelOptions = (catalog?.models ?? []).map((item) => ({
    value: item.id,
    label: item.label || item.model,
    disabled: !item.available,
    hint: item.available ? undefined : "Not connected yet"
  }));
  const aspectOptions = aspects.map((value) => ({ value, label: value }));
  const durationOptions = durations.map((item) => ({ value: String(item.value), label: item.label }));
  const videoFileMax = model?.videoReferenceMax ?? 0;
  const audioFileMax = model?.audioReferenceMax ?? 0;
  const imageRefMax = catalog?.imageReferenceMax ?? 4;
  const importEnabled = !disabled && canUpload && (videoMode || imageMode);

  /** Route dropped or pasted files to the matching reference slot (photo / video / audio). */
  const importComposerFiles = useCallback((files: File[]) => {
    if (!importEnabled) return;
    for (const file of files) {
      const kind = fileKind(file);
      if (kind === "video") {
        if (videoMode && videoFileMax > 0 && onVideoFileUpload && videoReferenceFiles.length < videoFileMax) onVideoFileUpload(file);
      } else if (kind === "audio") {
        if (videoMode && audioFileMax > 0 && onAudioFileUpload && audioReferenceFiles.length < audioFileMax) onAudioFileUpload(file);
      } else if (kind === "image") {
        if (imageMode) { if (imageInput.assetUrls.length < imageRefMax) onImageReferenceUpload(file); }
        else if (videoMode && videoReferenceUrls.length < referenceLimit) onVideoReferenceUpload(file);
      }
    }
  }, [importEnabled, imageMode, videoMode, videoFileMax, audioFileMax, imageRefMax, referenceLimit, onVideoReferenceUpload, onVideoFileUpload, onAudioFileUpload, onImageReferenceUpload, videoReferenceFiles.length, audioReferenceFiles.length, imageInput.assetUrls.length, videoReferenceUrls.length]);
  const { active: promptDropActive, dropProps: promptDropProps } = useFileDropZone(importComposerFiles, !importEnabled);

  return <section className={styles.composer} aria-label="Create your next project">
    {showTabs && <div className={styles.tabs} role="tablist" aria-label="Creation tools">
      {tabs.map(({ id, icon: Icon }, index) => <button type="button" key={id} id={`home-tab-${index}`} role="tab" aria-selected={activeTab === id} aria-controls="home-composer-panel" tabIndex={activeTab === id ? 0 : -1} className={`${styles.tab} ${activeTab === id ? styles.activeTab : ""}`} onClick={() => onTabChange(id)} onKeyDown={(event) => {
        const offset = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
        if (!offset && event.key !== "Home" && event.key !== "End") return;
        event.preventDefault();
        const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + offset + tabs.length) % tabs.length;
        onTabChange(tabs[next].id);
        event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
      }}><Icon size={17} aria-hidden="true" /><span>{tabs[index].label}</span></button>)}
    </div>}
    <div id={showTabs ? "home-composer-panel" : undefined} role={showTabs ? "tabpanel" : undefined} aria-labelledby={showTabs ? `home-tab-${tabs.findIndex((item) => item.id === activeTab)}` : undefined}>
      <div className={`${styles.promptField} ${imageMode ? styles.imagePromptField : ""} ${promptDropActive ? styles.dropActive : ""}`} {...promptDropProps}>
        <div className={styles.referenceRow}>
          {videoMode && <References kind="video" urls={videoReferenceUrls} max={referenceLimit} disabled={disabled} canUpload={canUpload} onUpload={onVideoReferenceUpload} onRemove={onVideoReferenceRemove} onMove={onVideoReferenceMove} />}
          {videoMode && (model?.videoReferenceMax ?? 0) > 0 && onVideoFileUpload && onVideoFileRemove && <References kind="video" urls={videoReferenceFiles} max={model!.videoReferenceMax} disabled={disabled} canUpload={canUpload} onUpload={onVideoFileUpload} onRemove={onVideoFileRemove} onMove={onVideoFileMove} accept="video/mp4,video/quicktime,video/webm" addLabel="Add video" limitLabel="Video limit" countNoun="videos" />}
          {videoMode && (model?.audioReferenceMax ?? 0) > 0 && onAudioFileUpload && onAudioFileRemove && <References kind="video" urls={audioReferenceFiles} max={model!.audioReferenceMax} disabled={disabled} canUpload={canUpload} onUpload={onAudioFileUpload} onRemove={onAudioFileRemove} onMove={onAudioFileMove} accept="audio/*" addLabel="Add audio" limitLabel="Audio limit" countNoun="audio files" />}
          {imageMode && <References kind="image" urls={imageInput.assetUrls} max={catalog?.imageReferenceMax ?? 4} disabled={disabled} canUpload={canUpload} onUpload={onImageReferenceUpload} onRemove={onImageReferenceRemove} onMove={onImageReferenceMove} />}
        </div>
        <textarea value={promptValue} disabled={disabled} onChange={(event) => { if (imageMode) onImageInputChange({ ...imageInput, prompt: event.target.value }); else onPromptChange(event.target.value); }} onPaste={(event) => {
          const files = takePasteFiles(event);
          if (!importEnabled || !files.length) return;
          event.preventDefault();
          importComposerFiles(files);
        }} placeholder={imageMode ? "Describe the product image you want to create…" : videoMode ? "Describe your video idea…" : "Describe your product and the story you want to tell…"} aria-label={imageMode ? "Describe your image idea" : "Describe your video idea"} maxLength={WORKSPACE_PROMPT_MAX_LENGTH} />
        <span className={styles.characterCount}>{`${promptValue.length} / ${WORKSPACE_PROMPT_MAX_LENGTH}`}</span>
      </div>
      <div className={styles.footer}>
        <div className={styles.controls}>
          {draftMode && <button type="button" className={styles.controlButton} disabled={disabled} onClick={onOpenAvatar}><UserRound size={16} aria-hidden="true" /><span>{avatarName || "Avatar"}</span><ChevronDown size={13} aria-hidden="true" /></button>}
          {videoMode && <>
            <button type="button" className={styles.controlButton} title={products[0]?.label ? `Selected product: ${products[0].label}` : "Add or import a product"} disabled={disabled} onClick={onOpenProduct}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {products[0]?.previewUrl ? <img className={styles.controlThumbnail} src={products[0].previewUrl} alt={products[0].label ? `Product: ${products[0].label}` : "Selected product"} /> : <Plus size={16} aria-hidden="true" />}
              <span>Product{products.length ? ` · ${products.length} added` : ""}</span><ChevronDown size={13} aria-hidden="true" />
            </button>
          </>}
        {imageMode ? <>
          <div className={styles.setting}><ImageIcon size={15} aria-hidden="true" /><span>Style</span><WorkspaceSelect
            ariaLabel="Image style"
            disabled={disabled}
            value={imageInput.toolId}
            options={imageStyleOptions}
            onChange={(value) => onImageInputChange({ ...imageInput, toolId: value as WorkspaceImageTool })}
            bare
            buttonClassName={styles.settingSelect}
          /></div>
          <div className={styles.setting}><Ratio size={15} aria-hidden="true" /><span>Ratio</span><WorkspaceSelect
            ariaLabel="Image aspect ratio"
            disabled={disabled || !imageAspects.length}
            value={imageInput.aspect}
            options={imageAspectOptions}
            onChange={(value) => onImageInputChange({ ...imageInput, aspect: value as Aspect })}
            bare
            buttonClassName={styles.settingSelect}
          /></div>
        </> : <>
          <div className={`${styles.setting} ${styles.modelSetting}`}><Sparkles size={15} aria-hidden="true" /><WorkspaceSelect
            ariaLabel="Video model"
            disabled={disabled || !catalog?.models.length}
            value={model?.id ?? ""}
            options={modelOptions}
            onChange={onModelChange}
            bare
            buttonClassName={`${styles.settingSelect} ${styles.modelSelect}`}
            placeholder="No model connected"
          /><span className={`${styles.modelDot} ${model?.available ? "" : styles.unavailable}`} aria-label={model?.available ? "Model available" : "Model unavailable"} /></div>
          <div className={styles.setting}><Ratio size={15} aria-hidden="true" /><WorkspaceSelect
            ariaLabel="Video aspect ratio"
            disabled={disabled || !aspects.length}
            value={selectedAspect ?? ""}
            options={aspectOptions}
            onChange={(value) => onAspectChange(value as Aspect)}
            bare
            buttonClassName={styles.settingSelect}
            placeholder="Unavailable"
          /></div>
          <div className={styles.setting}><Timer size={15} aria-hidden="true" /><WorkspaceSelect
            ariaLabel="Video duration"
            disabled={disabled || !durations.length}
            value={selectedDuration != null ? String(selectedDuration) : ""}
            options={durationOptions}
            onChange={(value) => onDurationChange(Number(value) as Duration)}
            bare
            buttonClassName={styles.settingSelect}
            placeholder="Unavailable"
          /></div>
          {onResolutionChange && resolutions.length > 0 && <div className={styles.setting}><Monitor size={15} aria-hidden="true" /><WorkspaceSelect
            ariaLabel="Video resolution"
            disabled={disabled || !resolutions.length}
            value={selectedResolution ?? ""}
            options={resolutions.map((value) => ({ value, label: value }))}
            onChange={(value) => onResolutionChange(value)}
            bare
            buttonClassName={styles.settingSelect}
            placeholder="Unavailable"
          /></div>}
        </>}
        </div>
        <div className={styles.footerActions}>
          {tooManyReferences && <span className={styles.footerNote} role="status">{`Remove photos to fit this model's ${referenceLimit}-photo limit.`}</span>}
          {videoMode && missingReference && <span className={styles.footerNote} role="status">Add a reference photo to start.</span>}
          {videoMode && !validVideo && <span className={styles.footerNote} role="status">Choose an available model.</span>}
          {!imageMode && creditsNote && <span className={styles.footerNote} role="status">{creditsNote}</span>}
          {!canUpload && (videoMode || imageMode) && loginHref && <a className={styles.loginLink} href={loginHref} onClick={(event) => {
            if (!onLogin || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            onLogin();
          }}>Log in to add photos</a>}
          <button type="button" className={`${styles.continue} ${styles.continueWithLabel}`} aria-label={imageMode ? onImageGenerate ? imageGenerateLabel : "Continue to image" : draftMode ? "Start video draft" : "Continue to video"} title={imageMode && onImageGenerate ? imageGenerateLabel : undefined} disabled={!canContinue} onClick={() => imageMode && onImageGenerate ? onImageGenerate() : onContinue(activeTab, { ...(model ? { modelId: model.id } : {}), aspect: selectedAspect ?? aspect, duration: selectedDuration ?? duration, ...(selectedResolution ? { resolution: selectedResolution } : {}) })}><span>{imageMode && onImageGenerate ? imageGenerateLabel : draftMode ? "Generate video" : "Generate"}</span><ArrowRight size={18} aria-hidden="true" /></button>
        </div>
      </div>
    </div>
  </section>;
}
