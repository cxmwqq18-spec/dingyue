import type { ThemePageJson, ThemeSettings } from "@/lib/types";
import { globalTypeFromPreviewId, safeBlocks } from "@/components/designer/designer-theme-utils";
import type { GlobalSettingsNode, Selection } from "@/components/designer/designer-types";
import type { DesignerWorkspaceTab } from "@/components/designer/designer-workspace-pane";

export type PreviewMode = "iframe" | "live";

export type IframePatchPayload =
  | { act: "reload" }
  | { act: "select"; id: string; blockId?: string }
  | { act: "th1" | "add" | "del"; id: string; html?: string };

export type IframeDesignerMessage = {
  act?: unknown;
  id?: unknown;
  blockId?: unknown;
  sectionType?: unknown;
};

export function isIframePatchPayload(value: unknown): value is IframePatchPayload {
  if (!value || typeof value !== "object") return false;
  const act = (value as { act?: unknown }).act;
  return act === "reload" || act === "select" || act === "th1" || act === "add" || act === "del";
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
  postPatch
}: {
  selection: Selection;
  previewMode: PreviewMode;
  postPatch: (payload: IframePatchPayload) => void;
}) {
  if (previewMode !== "iframe") return;
  const previewId = previewSectionIdForSelection(selection);
  if (!previewId) return;
  postPatch({
    act: "select",
    id: previewId,
    blockId: selection.kind === "block" || selection.kind === "globalBlock" ? selection.blockId : undefined
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
      actionLabel: `Selected ${sectionId}${blockId ? ` block ${blockId}` : ""} from iframe preview.`
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
    actionLabel: `Selected ${sectionId}${blockId ? ` block ${blockId}` : ""} from iframe preview.`
  };
}
