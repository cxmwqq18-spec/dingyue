"use client";

import { Children, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { Database, Eye, FileCheck2, GitBranch, Monitor, RefreshCw, RotateCcw, Save, Smartphone, UploadCloud } from "lucide-react";
import {
  DesignerToolbarMenu,
  DesignerToolbarButton,
  DesignerToolbarSegmented,
  DesignerToolbarSegmentedButton,
  type DesignerToolbarMenuOption,
  DesignerTopbarRow,
  DesignerTopbarShell
} from "@/components/designer/designer-toolbar-primitives";
import {
  DESKTOP_PREVIEW_VIEWPORT_OPTIONS,
  MOBILE_PREVIEW_VIEWPORT,
  previewViewportFor,
  type PreviewMode,
  type PreviewViewportPreset
} from "@/components/designer/designer-preview-protocol";
import { ThemeRenderer } from "@/components/theme-renderer";
import { themeStyleVars } from "@/lib/theme";
import type { CreativePack, Product, Site, SiteAiApp, ThemePage, ThemePageJson, ThemeSettings } from "@/lib/types";

export function PreviewFrame({
  site,
  pages: _pages,
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
  previewViewportPreset,
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
  onPreviewViewportChange,
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
  previewViewportPreset: PreviewViewportPreset;
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
  onPreviewViewportChange: (preset: PreviewViewportPreset) => void;
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
  const interactiveMode = previewMode === "interactive";
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
  const renderFallbackPreview = device === "desktop" && iframeStatus === "failed";
  const previewViewport = previewViewportFor(device, previewViewportPreset);
  const previewStageRef = useRef<HTMLDivElement | null>(null);
  const [previewStageBounds, setPreviewStageBounds] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const node = previewStageRef.current;
    if (!node) return;
    let disposed = false;
    const update = () => {
      if (disposed) return;
      const rect = node.getBoundingClientRect();
      setPreviewStageBounds({ width: rect.width, height: rect.height });
    };
    update();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => {
        disposed = true;
        window.removeEventListener("resize", update);
      };
    }
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, [device, previewViewportPreset]);
  const previewScale = useMemo(() => {
    if (!previewStageBounds.width || !previewStageBounds.height) return 1;
    const fitScale = Math.min(
      previewStageBounds.width / previewViewport.width,
      previewStageBounds.height / previewViewport.height,
      1
    );
    return Number.isFinite(fitScale) ? Math.max(0.1, fitScale) : 1;
  }, [previewStageBounds.height, previewStageBounds.width, previewViewport.height, previewViewport.width]);
  const previewScaledWidth = Math.round(previewViewport.width * previewScale);
  const previewScaledHeight = Math.round(previewViewport.height * previewScale);
  const previewScaleLabel = previewScale >= 0.995 ? "1:1 实际大小" : `${Math.round(previewScale * 100)}%`;
  const previewModeLabel =
    device === "mobile"
      ? previewScale >= 0.995
        ? `手机真实宽度 · ${previewViewport.label}`
        : `手机真实视口 · ${previewViewport.label} · ${previewScaleLabel}`
      : previewScale >= 0.995
        ? `1:1 实际大小 · ${previewViewport.label}`
        : `桌面缩放预览 · ${previewViewport.label} · ${previewScaleLabel}`;
  const previewInteractionLabel = interactiveMode ? "真实交互预览" : "编辑定位模式";
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
    const block = target?.closest<HTMLElement>("[data-xfcart-block-id], [data-xfcart-block-legacy-id]");
    event.preventDefault();
    event.stopPropagation();
    onLivePreviewSelect(sectionId, block?.getAttribute("data-xfcart-block-id") ?? block?.getAttribute("data-xfcart-block-legacy-id") ?? undefined);
  }

  const onPreviewWheel = useMemo(() => {
    return (event: WheelEvent) => {
      if (renderFallbackPreview) return;
      const frameWindow = iframeRef.current?.contentWindow;
      if (!frameWindow) return;
      const canScroll = Math.abs(event.deltaY) > 0 || Math.abs(event.deltaX) > 0;
      if (!canScroll) return;
      event.preventDefault();
      frameWindow.scrollBy({
        left: event.deltaX,
        top: event.deltaY,
        behavior: "auto"
      });
    };
  }, [iframeRef, renderFallbackPreview]);

  useEffect(() => {
    const node = previewStageRef.current;
    if (!node) return;
    const handleWheel = (event: WheelEvent) => onPreviewWheel(event);
    const options = { passive: false, capture: true } as const;
    node.addEventListener("wheel", handleWheel, options);
    return () => {
      node.removeEventListener("wheel", handleWheel, options);
    };
  }, [onPreviewWheel]);

  return (
    <section className="saas-designer-preview-frame flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#d7dce4]">
      <DesignerTopbarShell data-designer-toolbar="saas-top-editor-toolbar">
        <DesignerTopbarRow>
          <div className="flex h-[64px] min-w-[240px] flex-1 items-center overflow-hidden">
            {toolbarLeadingNodes}
          </div>

          <div className="relative z-10 flex h-[64px] w-[96px] shrink-0 items-center justify-center">
            <DesignerToolbarSegmented className="grid w-[88px] grid-cols-2">
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

          <div className="ml-auto flex h-[64px] min-w-0 shrink items-center justify-end gap-2 overflow-x-auto overflow-y-hidden py-2">
            <ToolbarGroup label="查看">
              <DesignerToolbarButton className="min-w-[72px]" onClick={onReloadPreview} title="刷新预览画面">
                <RefreshCw className="h-[15px] w-[15px]" strokeWidth={1.8} />
                刷新
              </DesignerToolbarButton>
              <DesignerToolbarButton className="min-w-[96px]" onClick={onPreviewModeToggle} title="切换编辑定位和真实交互预览">
                <Eye className="h-[15px] w-[15px]" strokeWidth={1.8} />
                {interactiveMode ? "编辑定位" : "真实交互"}
              </DesignerToolbarButton>
            </ToolbarGroup>
            <ToolbarGroup label="编辑">
              <DesignerToolbarButton aria-label="保存草稿" className="min-w-[78px]" data-designer-action="save-draft" onClick={onSaveDraft} title="保存草稿不会上线，只写入后台草稿区">
                <Save className="h-[15px] w-[15px]" strokeWidth={1.8} />
                保存
              </DesignerToolbarButton>
              <DesignerToolbarButton className="min-w-[78px]" data-designer-action="rollback-draft" onClick={onRollback} title="恢复整站草稿到最近一次线上发布版本">
                <RotateCcw className="h-[15px] w-[15px]" strokeWidth={1.8} />
                回滚
              </DesignerToolbarButton>
            </ToolbarGroup>
            <ToolbarGroup label="发布">
              <DesignerToolbarButton className="min-w-[78px]" data-designer-action="publish-draft" onClick={onPublishDraft} title="发布会更新整站线上快照，隐藏草稿也会一起上线" tone="primary">
                <UploadCloud className="h-[15px] w-[15px]" strokeWidth={1.8} />
                发布
              </DesignerToolbarButton>
            </ToolbarGroup>
            {toolbarTrailingNodes.length ? <ToolbarGroup label="退出">{toolbarTrailingNodes}</ToolbarGroup> : null}
          </div>
        </DesignerTopbarRow>
      </DesignerTopbarShell>

      <div className="border-b border-[#c4c7cc] bg-[#eef1f5] px-4 py-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <DesignerToolbarMenu
              className="!h-[40px] !w-[190px] flex-none"
              onValueChange={onPageSelect}
              options={pageMenuOptions}
              tone="light"
              triggerLabel="页面"
              value={selectedPageId}
            />
            {device === "desktop" ? (
              <div data-designer-preview-viewport-control="desktop">
                <DesignerToolbarMenu
                  className="!h-[40px] !w-[144px]"
                  onValueChange={(value) => {
                    if (isPreviewViewportPreset(value)) onPreviewViewportChange(value);
                  }}
                  options={DESKTOP_PREVIEW_VIEWPORT_OPTIONS}
                  tone="light"
                  triggerLabel="预览视口"
                  value={previewViewportPreset}
                />
              </div>
            ) : (
              <span
                className="inline-flex h-[40px] items-center rounded-[10px] border border-[#d9dde4] bg-white px-3 text-[12px] font-medium text-[#344054]"
                data-designer-preview-viewport-control="mobile"
              >
                {MOBILE_PREVIEW_VIEWPORT.label}
              </span>
            )}
            {templateApplyControl}
            <span className={`inline-flex h-[40px] items-center rounded-[10px] border px-3 text-[12px] font-medium ${syncStateClass}`}>
              {currentPageDirty ? "草稿待发布" : "已与线上同步"}
            </span>
            <span className="hidden h-[40px] items-center rounded-[10px] border border-[#d9dde4] bg-white px-3 text-[12px] text-[#667085] xl:inline-flex">
              {templateDisplayName(currentTemplateName)}
            </span>
            <span className="hidden h-[40px] items-center rounded-[10px] border border-[#d9dde4] bg-white px-3 text-[12px] text-[#667085] 2xl:inline-flex">
              当前主题 {activeThemeName}
            </span>
            <span className={`inline-flex h-[40px] items-center rounded-[10px] border px-3 text-[12px] font-medium ${interactiveMode ? "border-[#d9dde4] bg-white text-[#667085]" : iframeStatusClass}`}>
              {interactiveMode ? "真实交互预览" : iframeStatusLabel}
            </span>
            <span
              className="inline-flex h-[40px] items-center rounded-[10px] border border-[#c9d8f7] bg-[#f4f7ff] px-3 text-[12px] font-medium text-[#2457c5]"
              data-designer-preview-mode-label
            >
              {previewInteractionLabel} · {previewModeLabel}
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

        <div className="mt-2 grid gap-2 xl:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex min-w-0 items-center gap-2 rounded-[10px] border border-[#d9dde4] bg-white px-3 py-2 text-[12px] text-[#667085]">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#2f6fed]" />
            <span className="truncate">{lastAction}</span>
            <span className="ml-auto hidden shrink-0 text-[11px] text-[#909294] xl:inline">
              草稿主题：{draftThemeName || templateDisplayName(draftThemeKey)}
            </span>
          </div>
          <div
            className="hidden items-center gap-1 rounded-[10px] border border-[#d9dde4] bg-white px-2 py-2 text-[11px] text-[#667085] xl:flex"
            data-designer-contract="saas-content-source-guardrail"
          >
            <span className="inline-flex h-[24px] items-center gap-1 rounded-[6px] bg-[#f4f6f9] px-2" title="保存草稿写入 ThemePage.draftJson 和 ThemeSettings.draftJson">
              <Database className="h-3.5 w-3.5" strokeWidth={1.8} />
              DB 草稿区
            </span>
            <span className="inline-flex h-[24px] items-center gap-1 rounded-[6px] bg-[#eef7f0] px-2 text-[#18794e]" title="发布后前台读取 publishedJson">
              <FileCheck2 className="h-3.5 w-3.5" strokeWidth={1.8} />
              线上快照
            </span>
            <span className="inline-flex h-[24px] items-center gap-1 rounded-[6px] bg-[#fff4e6] px-2 text-[#9a5a1f]" title="代码部署只更新渲染逻辑，不自动覆盖数据库发布内容">
              <GitBranch className="h-3.5 w-3.5" strokeWidth={1.8} />
              代码独立
            </span>
          </div>
        </div>
      </div>

      <div className="editor_wrapper_cont min-h-0 flex-1 overflow-hidden bg-[#d7dce4] p-4">
        <div
          className="relative flex h-full min-h-0 min-w-0 items-start justify-center overflow-hidden"
          data-designer-preview-stage
          ref={previewStageRef}
        >
          <div
            className="relative shrink-0"
            data-designer-preview-scaled-shell
            style={{ width: `${previewScaledWidth}px`, height: `${previewScaledHeight}px` }}
          >
            <div
              className={`box_conts absolute left-0 top-0 overflow-hidden rounded-[18px] bg-[#d9dfe7] shadow-none ring-1 ring-[#c4c7cc] ${device === "mobile" ? "mobile_box" : "desktop_box"}`}
              data-designer-preview="saas-center-preview-canvas"
              data-designer-preview-height={previewViewport.height}
              data-designer-preview-scale={previewScale.toFixed(4)}
              data-designer-preview-width={previewViewport.width}
              style={{
                ...themeStyleVars(themeSettings),
                width: `${previewViewport.width}px`,
                height: `${previewViewport.height}px`,
                transform: `scale(${previewScale})`,
                transformOrigin: "top left"
              }}
            >
              {!renderFallbackPreview ? (
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
                    key={`${selectedPageId}:${previewMode}:${iframeReloadKey}`}
                    onLoad={onIframeLoad}
                    ref={iframeRef}
                    src={`/site/${site.slug}/admin/design/preview/${selectedPageId}?previewToken=${encodeURIComponent(previewToken)}&previewMode=${previewMode}&reload=${iframeReloadKey}`}
                    title={`${activePage.title} preview`}
                  />
                </>
              ) : (
                <div className="designer-live-preview h-full overflow-y-auto bg-white" onClickCapture={interactiveMode ? undefined : onLivePreviewClick}>
                  {previewMode === "edit" && iframeStatus === "failed" ? (
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
                        .designer-live-preview .xfcart-section:hover {
                          outline: 2px solid rgba(47, 111, 237, 0.7);
                          outline-offset: -2px;
                          position: relative;
                        }
                        .designer-live-preview .xfcart-section:hover::after {
                          content: "点击编辑 " attr(data-section-type);
                          position: absolute;
                          right: 14px;
                          top: 14px;
                          z-index: 59;
                          border: 1px solid rgba(47, 111, 237, 0.24);
                          border-radius: 999px;
                          background: rgba(255,255,255,0.94);
                          color: #2457c5;
                          font: 600 11px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
                          padding: 7px 10px;
                          pointer-events: none;
                          box-shadow: 0 18px 42px -32px rgba(24, 24, 27, 0.78);
                        }
                        .designer-live-preview [data-xfcart-block-id],
                        .designer-live-preview [data-xfcart-block-legacy-id] {
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
        </div>
      </div>
    </section>
  );
}

function cssAttrValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\A ");
}

function isPreviewViewportPreset(value: string): value is PreviewViewportPreset {
  return DESKTOP_PREVIEW_VIEWPORT_OPTIONS.some((option) => option.key === value);
}

function ToolbarGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex h-10 shrink-0 items-center gap-1 rounded-[10px] border border-white/10 bg-white/[0.03] px-1" data-designer-layout="saas-toolbar-action-group">
      <span className="hidden h-full items-center px-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/38 2xl:inline-flex">
        {label}
      </span>
      <div className="flex h-full items-center gap-1">{children}</div>
    </div>
  );
}
