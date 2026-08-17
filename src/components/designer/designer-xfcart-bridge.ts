import { safeBlocks } from "@/components/designer/designer-theme-utils";
import type { IframePatchPayload, PreviewMode } from "@/components/designer/designer-preview-protocol";
import type { GlobalType } from "@/components/designer/designer-types";
import type { SaasThemeAction } from "@/lib/server-store";
import type { ThemeDraftMeta, ThemePage, ThemePageJson, ThemeSettings } from "@/lib/types";

type DesignerXfcartPayload = {
  t: string;
  page: string;
  theme_id: string;
  themeKey: string;
  theme_key: string;
  x?: string;
  i?: string;
  k?: string | number;
  n?: string;
  v?: unknown;
  section?: unknown;
  block?: unknown;
  sectionsOrder?: string[];
};

type XfcartActionContext = {
  pages: ThemePage[];
  selectedPageId: string;
  draft: ThemePageJson;
  themeSettings: ThemeSettings;
  themeId: string;
  themeKey: string;
};

type XfcartActionResponse = {
  types?: "reload" | "th1" | "add" | "del";
  id?: string;
  html?: string;
  state?: string;
  pageDraftVersions?: Record<string, ThemeDraftMeta>;
  settingsDraftVersion?: ThemeDraftMeta;
};

export function resolvePageTemplateName(pageId: string, pages: ThemePage[]): string {
  const page = pages.find((item) => item.id === pageId);
  if (!page) return "index";
  if (page.templateKey) return page.templateKey;
  if (page.pageType === "home") return "index";
  if (page.pageType === "ai_tool") return "product";
  if (page.pageType === "pricing") return "page";
  return page.pageType;
}

function blockIndex(sectionId: string, blockId: string, draft: ThemePageJson): number {
  return (safeBlocks(draft.sections[sectionId]).findIndex((block) => block.id === blockId) + 1) || 0;
}

function globalBlockIndex(globalType: GlobalType, blockId: string, themeSettings: ThemeSettings): number {
  return (safeBlocks(themeSettings.globalSections?.[globalType]).findIndex((block) => block.id === blockId) + 1) || 0;
}

function xfcartSectionKey(action: SaasThemeAction, draft: ThemePageJson): string {
  if ("globalType" in action) return action.globalType === "header" ? "header_plus" : "footer_plus";
  if ("sectionType" in action) return action.sectionType;
  if ("sectionId" in action) return draft.sections[action.sectionId]?.type ?? "";
  return "";
}

export function buildXfcartPayload(action: SaasThemeAction, context: XfcartActionContext): DesignerXfcartPayload {
  const base: DesignerXfcartPayload = {
    page: "pageId" in action ? resolvePageTemplateName(action.pageId, context.pages) : resolvePageTemplateName(context.selectedPageId, context.pages),
    theme_id: context.themeId,
    themeKey: context.themeKey,
    theme_key: context.themeKey,
    t: action.type
  };

  if (action.type === "change") {
    if (action.scope === "global_setting") return { ...base, x: "global_setting", n: action.name, v: action.value };
    if (action.scope === "global") return { ...base, x: xfcartSectionKey(action, context.draft), n: action.name, v: action.value };
    if (action.scope === "global_block") {
      return {
        ...base,
        x: xfcartSectionKey(action, context.draft),
        k: globalBlockIndex(action.globalType, action.blockId, context.themeSettings),
        n: action.name,
        v: action.value
      };
    }
    if (action.scope === "page_block") {
      return {
        ...base,
        x: xfcartSectionKey(action, context.draft),
        i: action.sectionId,
        k: blockIndex(action.sectionId, action.blockId, context.draft),
        n: action.name,
        v: action.value
      };
    }
    return { ...base, x: xfcartSectionKey(action, context.draft), i: action.sectionId, n: action.name, v: action.value };
  }

  if (action.type === "dropition") return { ...base, x: "content_for_page", v: JSON.stringify(action.sectionsOrder) };

  if (action.type === "dropitem") {
    if (action.scope === "global") return { ...base, x: xfcartSectionKey(action, context.draft), v: JSON.stringify(action.blockIds) };
    return { ...base, x: xfcartSectionKey(action, context.draft), i: action.sectionId, v: JSON.stringify(action.blockIds) };
  }

  if (action.type === "delition") return { ...base, x: xfcartSectionKey(action, context.draft), i: action.sectionId };

  if (action.type === "delitem") {
    if (action.scope === "global") {
      return { ...base, x: xfcartSectionKey(action, context.draft), k: globalBlockIndex(action.globalType, action.blockId, context.themeSettings) };
    }
    return { ...base, x: xfcartSectionKey(action, context.draft), i: action.sectionId, k: blockIndex(action.sectionId, action.blockId, context.draft) };
  }

  if (action.type === "addition") {
    return {
      ...base,
      x: action.sectionType,
      i: action.sectionId,
      section: action.section,
      sectionsOrder: action.sectionsOrder
    };
  }

  if (action.scope === "global") {
    return { ...base, x: xfcartSectionKey(action, context.draft), v: action.blockType, block: action.block };
  }
  return { ...base, x: xfcartSectionKey(action, context.draft), i: action.sectionId, v: action.blockType, block: action.block };
}

function applyPreviewPatch(result: XfcartActionResponse, postPatch: (payload: IframePatchPayload) => void) {
  if (result.types === "reload") {
    postPatch({ act: "reload" });
    return;
  }
  if ((result.types === "th1" || result.types === "add") && result.id && result.html) {
    postPatch({ act: result.types, id: result.id, html: result.html });
    return;
  }
  if (result.types === "del" && result.id) {
    postPatch({ act: "del", id: result.id });
  }
}

export async function sendXfcartAction({
  siteId,
  action,
  fallbackMessage,
  context,
  previewMode,
  postPatch,
  setLastAction
}: {
  siteId: string;
  action: SaasThemeAction;
  fallbackMessage: string;
  context: XfcartActionContext;
  previewMode: PreviewMode;
  postPatch: (payload: IframePatchPayload) => void;
  setLastAction: (message: string) => void;
}): Promise<XfcartActionResponse | undefined> {
  const payload = buildXfcartPayload(action, context);
  const response = await fetch(`/api/sites/${siteId}/theme/xfcart-edit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    setLastAction(`${fallbackMessage} 左侧预览暂时没有同步成功，本地草稿未丢失；可以继续编辑或点击保存草稿后刷新预览。`);
    return undefined;
  }
  const result = (await response.json()) as XfcartActionResponse;
  if (previewMode === "edit") applyPreviewPatch(result, postPatch);
  setLastAction(
    previewMode === "edit"
      ? `${fallbackMessage} 已同步到左侧草稿预览；发布整站快照后才上线。`
      : `${fallbackMessage} 已更新草稿；真实交互预览不会自动拦截跳转，发布后才上线。`
  );
  return result;
}
