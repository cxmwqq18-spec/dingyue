"use client";

import { Children } from "react";
import type { ReactNode, RefObject } from "react";
import { Eye, Monitor, RefreshCw, RotateCcw, Save, Smartphone, UploadCloud } from "lucide-react";
import {
  DesignerToolbarMenu,
  DesignerToolbarButton,
  DesignerToolbarSegmented,
  DesignerToolbarSegmentedButton,
  type DesignerToolbarMenuOption,
  DesignerTopbarRow,
  DesignerTopbarShell
} from "@/components/designer/designer-toolbar-primitives";
import type { PreviewMode } from "@/components/designer/designer-preview-protocol";
import { ThemeRenderer } from "@/components/theme-renderer";
import { themeStyleVars } from "@/lib/theme";
import type { CreativePack, Product, Site, SiteAiApp, ThemePage, ThemePageJson, ThemeSettings } from "@/lib/types";

export function PreviewFrame({
  site,
  pages,
  activePage,
  selectedPageId,
  draft,
  previewToken,
  products,
  siteAiApps,
  creativePacks,
  themeSettings,
  pageMenuOptions,
  device,
  previewMode,
  iframeRef,
  iframeReloadKey,
  iframeStatus,
  currentTemplateName,
  currentPageDirty,
  changedSectionCount,
  dirtyPagesCount,
  publishedVersion,
  activeThemeName,
  draftThemeName,
  draftThemeKey,
  lastAction,
  templateDisplayName,
  toolbarLeading,
  toolbarTrailing,
  templateApplyControl,
  onDeviceChange,
  onPageSelect,
  onReloadPreview,
  onPreviewModeToggle,
  onIframeLoad,
  onIframeRetry,
  onLivePreviewSelect,
  onRollback,
  onSaveDraft,
  onPublishDraft,
  selectedPreviewSectionId,
  selectedPreviewBlockId
}: {
  site: Site;
  pages: ThemePage[];
  activePage: ThemePage;
  selectedPageId: string;
  draft: ThemePageJson;
  previewToken: string;
  products: Product[];
  siteAiApps: SiteAiApp[];
  creativePacks: CreativePack[];
  themeSettings: ThemeSettings;
  currentTemplateName: string;
  currentPageDirty: boolean;
  changedSectionCount: number;
  dirtyPagesCount: number;
  publishedVersion: number;
  activeThemeName: string;
  draftThemeName: string;
  draftThemeKey: string;
  lastAction: string;
  pageMenuOptions: DesignerToolbarMenuOption[];
  device: "desktop" | "mobile";
  previewMode: PreviewMode;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  iframeReloadKey: number;
  iframeStatus: "loading" | "ready" | "recovering" | "failed";
  templateDisplayName: (templateName: string) => string;
  toolbarLeading?: ReactNode;
  toolbarTrailing?: ReactNode;
  templateApplyControl?: ReactNode;
  onDeviceChange: (device: "desktop" | "mobile") => void;
  onPageSelect: (pageId: string) => void;
  onReloadPreview: () => void;
  onPreviewModeToggle: () => void;
  onIframeLoad: () => void;
  onIframeRetry: () => void;
  onLivePreviewSelect: (sectionId: string, blockId?: string) => void;
  onRollback: () => void;
  onSaveDraft: () => void;
  onPublishDraft: () => void;
  selectedPreviewSectionId?: string;
  selectedPreviewBlockId?: string;
}) {
  const toolbarLeadingNodes = Children.toArray(toolbarLeading);
  const toolbarTrailingNodes = Children.toArray(toolbarTrailing);
  const liveMode = previewMode === "live";
  const syncStateClass = currentPageDirty
    ? "border-[#f2d3a4] bg-[#fff4e6] text-[#b06d2c]"
    : "border-[#cbe7d5] bg-[#edf7f0] text-[#18794e]";
  const iframeStatusLabel =
    iframeStatus === "ready"
      ? "预览已载入"
      : iframeStatus === "recovering"
        ? "预览恢复中"
        : iframeStatus === "failed"
          ? "预览需刷新"
          : "预览载入中";
  const iframeStatusClass =
    iframeStatus === "ready"
      ? "border-[#cbe7d5] bg-[#edf7f0] text-[#18794e]"
      : iframeStatus === "failed"
        ? "border-[#ffd0d0] bg-[#fff1f1] text-[#b42318]"
        : "border-[#f2d3a4] bg-[#fff4e6] text-[#b06d2c]";
  const renderLivePreview = device === "desktop" && (previewMode === "live" || iframeStatus === "failed");
  const selectedBlockRule = selectedPreviewSectionId && selectedPreviewBlockId
    ? `
      .designer-live-preview .xfcart-section[data-section-id="${cssAttrValue(selectedPreviewSectionId)}"] [data-xfcart-block-id="${cssAttrValue(selectedPreviewBlockId)}"],
      .designer-live-preview .xfcart-section[data-section-id="${cssAttrValue(selectedPreviewSectionId)}"] [data-xfcart-block-legacy-id="${cssAttrValue(selectedPreviewBlockId)}"] {
        outline: 2px dashed rgba(168, 107, 76, 0.92);
        outline-offset: -5px;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,0.8);
        position: relative;
      }
      .designer-live-preview .xfcart-section[data-section-id="${cssAttrValue(selectedPreviewSectionId)}"] [data-xfcart-block-id="${cssAttrValue(selectedPreviewBlockId)}"]::after,
      .designer-live-preview .xfcart-section[data-section-id="${cssAttrValue(selectedPreviewSectionId)}"] [data-xfcart-block-legacy-id="${cssAttrValue(selectedPreviewBlockId)}"]::after {
        content: "Block";
        position: absolute;
        right: 12px;
        top: 12px;
        z-index: 61;
        border-radius: 999px;
        background: #141814;
        color: #fff;
        font: 600 10px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        letter-spacing: 0.1em;
        padding: 6px 8px;
        text-transform: uppercase;
        pointer-events: none;
      }
    `
    : "";

  function onLivePreviewClick(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target instanceof Element ? event.target : null;
    const section = target?.closest<HTMLElement>(".xfcart-section[data-section-id]");
    if (!section) return;
    const sectionId = section.dataset.sectionId;
    if (!sectionId) return;
    const block = target?.closest<HTMLElement>("[data-xfcart-block-id]");
    event.preventDefault();
    event.stopPropagation();
    onLivePreviewSelect(sectionId, block?.getAttribute("data-xfcart-block-id") ?? undefined);
  }

  return (
    <section className="saas-designer-preview-frame flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#d7dce4]">
      <DesignerTopbarShell data-designer-toolbar="saas-top-editor-toolbar">
        <DesignerTopbarRow>
          <div className="flex h-[56px] min-w-0 flex-1 items-center">
            {toolbarLeadingNodes}
          </div>

          <div className="relative z-10 flex h-[56px] w-[144px] shrink-0 items-center justify-center px-4">
            <DesignerToolbarSegmented className="grid w-[112px] grid-cols-2">
              <DesignerToolbarSegmentedButton aria-label="桌面预览" active={device === "desktop"} onClick={() => onDeviceChange("desktop")}>
                <Monitor className="h-5 w-5" strokeWidth={1.8} />
                <span className="sr-only">桌面</span>
              </DesignerToolbarSegmentedButton>
              <DesignerToolbarSegmentedButton aria-label="手机预览" active={device === "mobile"} onClick={() => onDeviceChange("mobile")}>
                <Smartphone className="h-5 w-5" strokeWidth={1.8} />
                <span className="sr-only">手机</span>
              </DesignerToolbarSegmentedButton>
            </DesignerToolbarSegmented>
          </div>

          <div className="ml-auto flex h-[56px] min-w-0 max-w-[calc(100%-176px)] shrink items-center justify-end overflow-x-auto overflow-y-hidden">
            <DesignerToolbarButton className="min-w-[74px] gap-1 border-l border-white/10" onClick={onReloadPreview}>
              <RefreshCw className="h-[15px] w-[15px]" strokeWidth={1.8} />
              刷新
            </DesignerToolbarButton>
            <DesignerToolbarButton className="min-w-[84px] gap-1 border-l border-white/10" onClick={onPreviewModeToggle}>
              <Eye className="h-[15px] w-[15px]" strokeWidth={1.8} />
              {liveMode ? "编辑" : "预览"}
            </DesignerToolbarButton>
            <DesignerToolbarButton aria-label="保存草稿" className="min-w-[108px] gap-1 border-l border-white/10" data-designer-action="save-draft" onClick={onSaveDraft} title="保存草稿">
              <Save className="h-[15px] w-[15px]" strokeWidth={1.8} />
              保存草稿
            </DesignerToolbarButton>
            <DesignerToolbarButton className="min-w-[98px] gap-1 border-l border-white/10" data-designer-action="rollback-draft" onClick={onRollback} title="恢复整站草稿到最近一次线上发布版本">
              <RotateCcw className="h-[15px] w-[15px]" strokeWidth={1.8} />
              回滚全站
            </DesignerToolbarButton>
            <DesignerToolbarButton className="min-w-[108px] gap-1 border-l border-white/10" data-designer-action="publish-draft" onClick={onPublishDraft} title="发布当前所有页面草稿与全局设置" tone="primary">
              <UploadCloud className="h-[15px] w-[15px]" strokeWidth={1.8} />
              发布全站
            </DesignerToolbarButton>
            {toolbarTrailingNodes}
          </div>
        </DesignerTopbarRow>
      </DesignerTopbarShell>

      <div className="border-b border-[#c4c7cc] bg-[#eef1f5] px-4 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <DesignerToolbarMenu
              className="!h-[40px] !w-[180px] flex-none"
              onValueChange={onPageSelect}
              options={pageMenuOptions}
              triggerLabel="页面"
              value={selectedPageId}
            />
            {templateApplyControl}
            <span className={`inline-flex h-[40px] items-center rounded-[10px] border px-3 text-[12px] font-medium ${syncStateClass}`}>
              {currentPageDirty ? "草稿待发布" : "已与线上同步"}
            </span>
            <span className="inline-flex h-[40px] items-center rounded-[10px] border border-[#d9dde4] bg-white px-3 text-[12px] text-[#667085]">
              {templateDisplayName(currentTemplateName)}
            </span>
            <span className="inline-flex h-[40px] items-center rounded-[10px] border border-[#d9dde4] bg-white px-3 text-[12px] text-[#667085]">
              当前主题 {activeThemeName}
            </span>
            <span className={`inline-flex h-[40px] items-center rounded-[10px] border px-3 text-[12px] font-medium ${previewMode === "live" ? "border-[#d9dde4] bg-white text-[#667085]" : iframeStatusClass}`}>
              {previewMode === "live" ? "实时预览" : iframeStatusLabel}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#667085]">
            <span className="inline-flex h-[40px] items-center rounded-[10px] border border-[#d9dde4] bg-white px-3">
              改动模块 {changedSectionCount}
            </span>
            <span className="inline-flex h-[40px] items-center rounded-[10px] border border-[#d9dde4] bg-white px-3">
              待发布页面 {dirtyPagesCount}
            </span>
            <span className="inline-flex h-[40px] items-center rounded-[10px] border border-[#d9dde4] bg-white px-3">
              线上版本 v{publishedVersion}
            </span>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2 rounded-[10px] border border-[#d9dde4] bg-white px-3 py-2 text-[12px] text-[#667085]">
          <span className="h-2 w-2 shrink-0 rounded-full bg-[#2f6fed]" />
          <span className="truncate">{lastAction}</span>
          <span className="ml-auto hidden shrink-0 text-[11px] text-[#909294] xl:inline">
            草稿主题：{draftThemeName || templateDisplayName(draftThemeKey)}
          </span>
        </div>
      </div>

      <div className="editor_wrapper_cont min-h-0 flex-1 overflow-hidden bg-[#d7dce4] p-5">
        <div
          className={`box_conts relative mx-auto h-full overflow-hidden rounded-[18px] border border-[#c4c7cc] bg-[#d9dfe7] shadow-none transition-[width] duration-150 ${device === "mobile" ? "mobile_box w-[390px]" : "desktop_box w-full max-w-none"}`}
          data-designer-preview="saas-center-preview-canvas"
          style={themeStyleVars(themeSettings)}
        >
          {!renderLivePreview ? (
            <>
              {iframeStatus === "loading" || iframeStatus === "recovering" ? (
                <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center p-3">
                  <div className={`pointer-events-auto flex items-center gap-2 rounded-[12px] border px-3 py-2 text-[12px] shadow-[0_18px_46px_-34px_rgba(15,23,42,0.35)] ${iframeStatusClass}`}>
                    <span className="h-2 w-2 rounded-full bg-current opacity-70" />
                    <span>{iframeStatusLabel}</span>
                  </div>
                </div>
              ) : null}
              {device === "mobile" && iframeStatus === "failed" ? (
                <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center p-3">
                  <div className="pointer-events-auto flex items-center gap-2 rounded-[12px] border border-[#ffd0d0] bg-[#fff1f1] px-3 py-2 text-[12px] text-[#b42318] shadow-[0_18px_46px_-34px_rgba(15,23,42,0.35)]">
                    <span className="h-2 w-2 rounded-full bg-current opacity-70" />
                    <span>手机预览需要 iframe 才能准确触发移动端样式。</span>
                    <button className="rounded-[8px] border border-[#f2b8b8] bg-white px-2 py-1 font-medium" onClick={onIframeRetry} type="button">
                      重试
                    </button>
                  </div>
                </div>
              ) : null}
              <iframe
                className="h-full w-full bg-white"
                key={`${selectedPageId}_${iframeReloadKey}`}
                onLoad={onIframeLoad}
                ref={iframeRef}
                src={`/site/${site.slug}/admin/design/preview/${selectedPageId}?previewToken=${encodeURIComponent(previewToken)}&reload=${iframeReloadKey}`}
                title={`${activePage.title} preview`}
              />
            </>
          ) : (
            <div className="designer-live-preview h-full overflow-y-auto bg-white" onClickCapture={onLivePreviewClick}>
              {previewMode === "iframe" && iframeStatus === "failed" ? (
                <div className="sticky top-0 z-50 flex items-center gap-2 border-b border-[#f2d3a4] bg-[#fff7ed] px-4 py-2 text-[12px] text-[#9a5a1f]">
                  <span className="h-2 w-2 rounded-full bg-current opacity-70" />
                  <span>iframe 预览未完成载入，已临时切换为实时预览。</span>
                  <button className="ml-auto rounded-[8px] border border-[#d8a45d] bg-white px-2 py-1 font-medium" onClick={onIframeRetry} type="button">
                    重试 iframe
                  </button>
                </div>
              ) : null}
              <style
                dangerouslySetInnerHTML={{
                  __html: `
                    .designer-live-preview .xfcart-section {
                      cursor: crosshair;
                    }
                    .designer-live-preview [data-xfcart-block-id] {
                      cursor: cell;
                    }
                    .designer-live-preview .xfcart-section[data-xfcart-selected="true"] {
                      outline: 2px solid rgba(20, 24, 20, 0.92);
                      outline-offset: -2px;
                      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.72), 0 0 0 4px rgba(168, 107, 76, 0.18);
                      position: relative;
                    }
                    .designer-live-preview .xfcart-section[data-xfcart-selected="true"]::before {
                      content: "Selected";
                      position: absolute;
                      left: 14px;
                      top: 14px;
                      z-index: 60;
                      border: 1px solid rgba(24, 24, 27, 0.16);
                      border-radius: 999px;
                      background: rgba(255, 255, 255, 0.92);
                      color: #141814;
                      font: 600 11px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
                      letter-spacing: 0.08em;
                      padding: 7px 10px;
                      text-transform: uppercase;
                      pointer-events: none;
                      box-shadow: 0 18px 42px -32px rgba(24, 24, 27, 0.78);
                    }
                    ${selectedBlockRule}
                  `
                }}
              />
              <ThemeRenderer
                creativePacks={creativePacks}
                mode="preview"
                page={draft}
                previewSelection={{ sectionId: selectedPreviewSectionId, blockId: selectedPreviewBlockId }}
                products={products}
                settings={themeSettings}
                site={site}
                siteAiApps={siteAiApps}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function cssAttrValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\A ");
}
