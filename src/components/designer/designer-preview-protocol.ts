import type { ThemePageJson, ThemeSettings } from "@/lib/types";
import { globalTypeFromPreviewId, safeBlocks } from "@/components/designer/designer-theme-utils";
import type { GlobalSettingsNode, Selection } from "@/components/designer/designer-types";
import type { DesignerWorkspaceTab } from "@/components/designer/designer-workspace-pane";

export type PreviewMode = "edit" | "interactive";
export type PreviewViewportPreset = "desktop-1440" | "desktop-1536" | "desktop-1920";

export type PreviewViewportSpec = {
  key: PreviewViewportPreset | "mobile-390";
  label: string;
  width: number;
  height: number;
  chipLabel?: string;
};

export const DESKTOP_PREVIEW_VIEWPORTS: Record<PreviewViewportPreset, PreviewViewportSpec> = {
  "desktop-1440": { key: "desktop-1440", label: "1440×900", width: 1440, height: 900, chipLabel: "推荐" },
  "desktop-1536": { key: "desktop-1536", label: "1536×960", width: 1536, height: 960, chipLabel: "宽屏" },
  "desktop-1920": { key: "desktop-1920", label: "1920×1080", width: 1920, height: 1080, chipLabel: "大屏" }
};

export const DESKTOP_PREVIEW_VIEWPORT_OPTIONS = Object.values(DESKTOP_PREVIEW_VIEWPORTS).map(({ key, label, chipLabel }) => ({
  key,
  label,
  chipLabel
}));

export const MOBILE_PREVIEW_VIEWPORT: PreviewViewportSpec = {
  key: "mobile-390",
  label: "390×844",
  width: 390,
  height: 844,
  chipLabel: "手机"
};

export function previewViewportFor(device: "desktop" | "mobile", preset: PreviewViewportPreset): PreviewViewportSpec {
  return device === "desktop" ? DESKTOP_PREVIEW_VIEWPORTS[preset] : MOBILE_PREVIEW_VIEWPORT;
}

export type IframePatchPayload =
  | { act: "clearSelection" }
  | { act: "reload" }
  | { act: "select"; id: string; blockId?: string; scroll?: boolean }
  | { act: "th1" | "add" | "del"; id: string; html?: string };

export type IframeDesignerMessage = {
  act?: unknown;
  id?: unknown;
  blockId?: unknown;
  sectionType?: unknown;
  href?: unknown;
};

export function isIframePatchPayload(value: unknown): value is IframePatchPayload {
  if (!value || typeof value !== "object") return false;
  const act = (value as { act?: unknown }).act;
  return act === "clearSelection" || act === "reload" || act === "select" || act === "th1" || act === "add" || act === "del";
}

export function previewSectionIdForSelection(selection: Selection): string {
  if (selection.kind === "global" || selection.kind === "globalBlock") {
    return selection.globalType === "header" ? "header_plus" : "footer_plus";
  }
  if (selection.kind === "globalSettings") return "";
  return selection.sectionId;
}

export function syncSelectionToPreview({
  selection,
  previewMode,
  postPatch,
  scroll = true
}: {
  selection: Selection;
  previewMode: PreviewMode;
  postPatch: (payload: IframePatchPayload) => void;
  scroll?: boolean;
}) {
  if (previewMode !== "edit") return;
  const previewId = previewSectionIdForSelection(selection);
  if (!previewId) {
    postPatch({ act: "clearSelection" });
    return;
  }
  postPatch({
    act: "select",
    id: previewId,
    blockId: selection.kind === "block" || selection.kind === "globalBlock" ? selection.blockId : undefined,
    scroll
  });
}

export function selectionForEditorTab({
  nextTab,
  currentSelection,
  firstGlobalNodeId,
  activeSectionId,
  firstSectionId
}: {
  nextTab: DesignerWorkspaceTab;
  currentSelection: Selection;
  firstGlobalNodeId?: GlobalSettingsNode;
  activeSectionId?: string;
  firstSectionId?: string;
}): Selection | null {
  if (nextTab === "publish") return null;
  if (nextTab === "global") {
    if (currentSelection.kind === "global" || currentSelection.kind === "globalBlock" || currentSelection.kind === "globalSettings") return null;
    if (firstGlobalNodeId) return { kind: "globalSettings", node: firstGlobalNodeId };
    return { kind: "global", globalType: "header" };
  }
  if (currentSelection.kind === "section" || currentSelection.kind === "block") return null;
  return { kind: "section", sectionId: activeSectionId ?? firstSectionId ?? "" };
}

export function selectionFromPreviewMessage({
  message,
  draft,
  themeSettings
}: {
  message: IframeDesignerMessage;
  draft: ThemePageJson;
  themeSettings: ThemeSettings;
}): { tab: DesignerWorkspaceTab; selection: Selection; actionLabel: string } | null {
  if (message.act !== "previewSelect" || typeof message.id !== "string") return null;
  const sectionId = message.id;
  const blockId = typeof message.blockId === "string" ? message.blockId : "";
  const globalType = globalTypeFromPreviewId(sectionId);

  if (globalType) {
    const globalBlocks = safeBlocks(themeSettings.globalSections?.[globalType]);
    const selection: Selection =
      blockId && globalBlocks.some((block) => block.id === blockId)
        ? { kind: "globalBlock", globalType, blockId }
        : { kind: "global", globalType };
    return {
      tab: "global",
      selection,
      actionLabel: `已从编辑定位预览选中 ${sectionId}${blockId ? ` / ${blockId}` : ""}。`
    };
  }

  const section = draft.sections[sectionId];
  if (!section) return null;
  const selection: Selection =
    blockId && safeBlocks(section).some((block) => block.id === blockId)
      ? { kind: "block", sectionId, blockId }
      : { kind: "section", sectionId };
  return {
    tab: "templates",
    selection,
    actionLabel: `已从编辑定位预览选中 ${sectionId}${blockId ? ` / ${blockId}` : ""}。`
  };
}
