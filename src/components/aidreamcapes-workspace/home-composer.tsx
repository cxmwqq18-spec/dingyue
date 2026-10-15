"use client";

import { ArrowRight, ChevronDown, ImageIcon, Plus, Ratio, Sparkles, Timer, Upload, UserRound, Video, WandSparkles, X } from "lucide-react";
import type { TaskInput, WorkspaceCatalog } from "@/lib/aidreamcapes-workspace/types";
import type { WorkspaceImageTool } from "./image-tool-picker";
import { WORKSPACE_ASPECTS } from "@/lib/aidreamcapes-workspace/catalogs";
import styles from "./home-composer.module.css";

export type HomeComposerTab = "AI Video Agent" | "AI Video" | "AI Image";
type Aspect = TaskInput["options"]["aspect"];
type Duration = TaskInput["options"]["duration"];
export type HomeComposerImageInput = { prompt: string; assetUrls: string[]; aspect: Aspect; toolId: WorkspaceImageTool };
export type HomeComposerVideoSelection = { modelId?: string; aspect: Aspect; duration: Duration };

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
  products: { previewUrl: string; label?: string }[];
  onOpenProduct: () => void;
  onOpenAvatar: () => void;
  avatarName?: string;
  videoReferenceUrls: string[];
  onVideoReferenceUpload: (file: File) => void;
  onVideoReferenceRemove: (index: number) => void;
  imageInput: HomeComposerImageInput;
  onImageInputChange: (input: HomeComposerImageInput) => void;
  onImageReferenceUpload: (file: File) => void;
  onImageReferenceRemove: (index: number) => void;
  onImageGenerate?: () => void;
  imageGenerateDisabled?: boolean;
  imageGenerateLabel?: string;
  onContinue: (tab: HomeComposerTab, video: HomeComposerVideoSelection) => void;
  onLogin?: () => void;
  disabled?: boolean;
  canUpload?: boolean;
  loginHref?: string;
}

const tabs: { id: HomeComposerTab; icon: typeof Video }[] = [
  { id: "AI Video Agent", icon: WandSparkles }, { id: "AI Video", icon: Video }, { id: "AI Image", icon: ImageIcon },
];
const imageStyles: { id: WorkspaceImageTool; label: string }[] = [
  { id: "custom", label: "Custom image" }, { id: "white-background", label: "White background" },
  { id: "change-background", label: "Change background" }, { id: "lifestyle-photos", label: "Lifestyle photo" },
  { id: "model-photos", label: "Model photo" },
];

/** Keep displayed settings and submitted settings inside the selected model's capabilities. */
export function homeComposerVideoOptions(catalog: WorkspaceCatalog | undefined, modelId: string, aspect: Aspect, duration: Duration) {
  const model = catalog?.models.find((item) => item.id === modelId) ?? catalog?.models.find((item) => item.available) ?? catalog?.models[0];
  const aspects = catalog?.aspects.filter((item) => !model || model.aspects.includes(item)) ?? [];
  const durations = catalog?.durations.filter((item) => !model || model.durations.includes(item.value)) ?? [];
  const selectedAspect = aspects.includes(aspect) ? aspect : aspects[0];
  const selectedDuration = durations.some((item) => item.value === duration) ? duration : durations[0]?.value;
  return { model, aspects, durations, selectedAspect, selectedDuration };
}

function References({ urls, max, disabled, canUpload, onUpload, onRemove, kind }: {
  urls: string[]; max: number; disabled: boolean; canUpload: boolean;
  onUpload: (file: File) => void; onRemove: (index: number) => void; kind: "video" | "image";
}) {
  return <div className={`${styles.references} ${kind === "image" ? styles.imageReferences : ""}`}>
    <div className={styles.referenceStrip}>
      <div className={styles.referenceUploadColumn}>
        {urls.length < max ? <label className={`${styles.upload} ${!canUpload || disabled ? styles.uploadDisabled : ""}`}>
          <Upload size={19} aria-hidden="true" /><span>Add photo</span>
          <input type="file" accept="image/*" aria-label={`Upload ${kind} reference photo`} disabled={disabled || !canUpload} onChange={(event) => {
            const file = event.target.files?.[0]; event.target.value = ""; if (file) onUpload(file);
          }} />
        </label> : <div className={`${styles.upload} ${styles.uploadFull}`} aria-hidden="true"><ImageIcon size={19} /><span>Photo limit</span></div>}
        <span className={styles.referenceCount} aria-label={`${kind === "video" ? "Video" : "Image"} reference photos: ${urls.length} of ${max}`}>{`${urls.length} / ${max} photos`}</span>
      </div>
      {urls.map((url, index) => <div key={`${url}-${index}`} className={styles.thumbnail}>
        {/* Customer assets may use private authenticated URLs. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={`${kind === "video" ? "Video" : "Image"} reference ${index + 1}`} decoding="async" loading="lazy" />
        <button type="button" className={styles.remove} disabled={disabled} onClick={() => onRemove(index)} aria-label={`Remove ${kind} reference ${index + 1}`}><X size={13} /></button>
      </div>)}
    </div>
  </div>;
}

export function HomeComposer({ tab, showTabs = true, onTabChange, prompt, onPromptChange, catalog, modelId, onModelChange, aspect, onAspectChange, duration, onDurationChange, products, onOpenProduct, onOpenAvatar, avatarName, videoReferenceUrls, onVideoReferenceUpload, onVideoReferenceRemove, imageInput, onImageInputChange, onImageReferenceUpload, onImageReferenceRemove, onImageGenerate, imageGenerateDisabled = false, imageGenerateLabel = "Generate image", onContinue, onLogin, disabled = false, canUpload = false, loginHref }: HomeComposerProps) {
  const activeTab: HomeComposerTab = tab === "AI Video" || tab === "AI Image" ? tab : "AI Video Agent";
  const imageMode = activeTab === "AI Image";
  const videoMode = activeTab === "AI Video";
  const draftMode = activeTab === "AI Video Agent";
  const { model, aspects, durations, selectedAspect, selectedDuration } = homeComposerVideoOptions(catalog, modelId, aspect, duration);
  const referenceLimit = model?.multiReference ? 4 : 1;
  const validVideo = Boolean(model?.available && selectedAspect && selectedDuration);
  const tooManyReferences = videoMode && videoReferenceUrls.length > referenceLimit;
  const canContinue = !disabled && !(imageMode && onImageGenerate && imageGenerateDisabled) && (imageMode || draftMode || validVideo) && !tooManyReferences;
  const promptValue = imageMode ? imageInput.prompt : prompt;
  const imageAspects = WORKSPACE_ASPECTS;

  return <section className={styles.composer} aria-label="Create your next project">
    {showTabs && <div className={styles.tabs} role="tablist" aria-label="Creation tools">
      {tabs.map(({ id, icon: Icon }, index) => <button type="button" key={id} id={`home-tab-${index}`} role="tab" aria-selected={activeTab === id} aria-controls="home-composer-panel" tabIndex={activeTab === id ? 0 : -1} className={`${styles.tab} ${activeTab === id ? styles.activeTab : ""}`} onClick={() => onTabChange(id)} onKeyDown={(event) => {
        const offset = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
        if (!offset && event.key !== "Home" && event.key !== "End") return;
        event.preventDefault();
        const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + offset + tabs.length) % tabs.length;
        onTabChange(tabs[next].id);
        event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
      }}><Icon size={17} aria-hidden="true" /><span>{id}</span></button>)}
    </div>}
    <div id={showTabs ? "home-composer-panel" : undefined} role={showTabs ? "tabpanel" : undefined} aria-labelledby={showTabs ? `home-tab-${tabs.findIndex((item) => item.id === activeTab)}` : undefined}>
      <div className={`${styles.promptField} ${imageMode ? styles.imagePromptField : ""}`}>
        {videoMode && <References kind="video" urls={videoReferenceUrls} max={referenceLimit} disabled={disabled} canUpload={canUpload} onUpload={onVideoReferenceUpload} onRemove={onVideoReferenceRemove} />}
        {imageMode && <References kind="image" urls={imageInput.assetUrls} max={4} disabled={disabled} canUpload={canUpload} onUpload={onImageReferenceUpload} onRemove={onImageReferenceRemove} />}
        <textarea value={promptValue} disabled={disabled} onChange={(event) => { if (imageMode) onImageInputChange({ ...imageInput, prompt: event.target.value }); else onPromptChange(event.target.value); }} placeholder={imageMode ? "Describe the product image you want to create…" : videoMode ? "Describe your video idea…" : "Describe your product and the story you want to tell…"} aria-label={imageMode ? "Describe your image idea" : "Describe your video idea"} maxLength={imageMode ? 4000 : 2000} />
        <span className={styles.characterCount}>{`${promptValue.length} / ${imageMode ? "4000" : "2000"}`}</span>
      </div>
      <div className={styles.footer}>
        <div className={styles.controls}>
          {draftMode && <>
            <button type="button" className={styles.controlButton} title={products[0]?.label ? `Selected product: ${products[0].label}` : "Add or import a product"} disabled={disabled} onClick={onOpenProduct}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {products[0]?.previewUrl ? <img className={styles.controlThumbnail} src={products[0].previewUrl} alt={products[0].label ? `Product: ${products[0].label}` : "Selected product"} /> : <Plus size={16} aria-hidden="true" />}
              <span>Product{products.length ? ` · ${products.length} added` : ""}</span><ChevronDown size={13} aria-hidden="true" />
            </button>
            <button type="button" className={styles.controlButton} disabled={disabled} onClick={onOpenAvatar}><UserRound size={16} aria-hidden="true" /><span>{avatarName || "Avatar"}</span><ChevronDown size={13} aria-hidden="true" /></button>
          </>}
        {imageMode ? <>
          <label className={styles.setting}><ImageIcon size={15} aria-hidden="true" /><span>Style</span><select aria-label="Image style" disabled={disabled} value={imageInput.toolId} onChange={(event) => onImageInputChange({ ...imageInput, toolId: event.target.value as WorkspaceImageTool })}>{imageStyles.map((style) => <option key={style.id} value={style.id}>{style.label}</option>)}</select></label>
          <label className={styles.setting}><Ratio size={15} aria-hidden="true" /><span>Ratio</span><select aria-label="Image aspect ratio" disabled={disabled || !imageAspects.length} value={imageInput.aspect} onChange={(event) => onImageInputChange({ ...imageInput, aspect: event.target.value as Aspect })}>{!imageAspects.length && <option value={imageInput.aspect}>{imageInput.aspect}</option>}{imageAspects.map((value) => <option key={value}>{value}</option>)}</select></label>
        </> : <>
          <label className={`${styles.setting} ${styles.modelSetting}`}><Sparkles size={15} aria-hidden="true" /><select aria-label="Video model" disabled={disabled || !catalog?.models.length} value={model?.id ?? ""} onChange={(event) => onModelChange(event.target.value)}>{!catalog?.models.length && <option value="">No model connected</option>}{catalog?.models.map((item) => <option key={item.id} value={item.id} disabled={!item.available}>{item.label || item.model}</option>)}</select><span className={`${styles.modelDot} ${model?.available ? "" : styles.unavailable}`} aria-label={model?.available ? "Model available" : "Model unavailable"} /></label>
          <label className={styles.setting}><Ratio size={15} aria-hidden="true" /><select aria-label="Video aspect ratio" disabled={disabled || !aspects.length} value={selectedAspect ?? ""} onChange={(event) => onAspectChange(event.target.value as Aspect)}>{!aspects.length && <option value="">Unavailable</option>}{aspects.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label className={styles.setting}><Timer size={15} aria-hidden="true" /><select aria-label="Video duration" disabled={disabled || !durations.length} value={selectedDuration ?? ""} onChange={(event) => onDurationChange(Number(event.target.value) as Duration)}>{!durations.length && <option value="">Unavailable</option>}{durations.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        </>}
        </div>
        <div className={styles.footerActions}>
          {tooManyReferences && <span className={styles.footerNote} role="status">{`Remove photos to fit this model's ${referenceLimit}-photo limit.`}</span>}
          {videoMode && !validVideo && <span className={styles.footerNote} role="status">Choose an available model.</span>}
          {!canUpload && (videoMode || imageMode) && loginHref && <a className={styles.loginLink} href={loginHref} onClick={(event) => {
            if (!onLogin || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            onLogin();
          }}>Log in to add photos</a>}
          <button type="button" className={`${styles.continue} ${imageMode && onImageGenerate ? styles.continueWithLabel : ""}`} aria-label={imageMode ? onImageGenerate ? imageGenerateLabel : "Continue to image" : draftMode ? "Start video draft" : "Continue to video"} title={imageMode && onImageGenerate ? imageGenerateLabel : undefined} disabled={!canContinue} onClick={() => imageMode && onImageGenerate ? onImageGenerate() : onContinue(activeTab, { ...(model ? { modelId: model.id } : {}), aspect: selectedAspect ?? aspect, duration: selectedDuration ?? duration })}>{imageMode && onImageGenerate && <span>{imageGenerateLabel}</span>}<ArrowRight size={18} aria-hidden="true" /></button>
        </div>
      </div>
    </div>
  </section>;
}
