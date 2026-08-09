"use client";

import { blockSchemaDisplayLabel } from "@/components/designer/designer-metadata";
import {
  DesignerCopyLocatorPanel,
  type DesignerCopyLocatorItem,
  type DesignerCopyLocatorQuickTarget
} from "@/components/designer/designer-copy-locator";
import { PropertyInspector } from "@/components/designer/property-inspector";
import { PropertyPanelBody, PropertyPanelHeader } from "@/components/designer/property-panel";
import { DesignerSelectionEditor } from "@/components/designer/designer-selection-editor";
import type { GlobalLocalField, GlobalSettingsNodeDefinition, Selection } from "@/components/designer/designer-types";
import type { DesignerWorkspaceTab } from "@/components/designer/designer-workspace-pane";
import type { FieldOptions } from "@/components/designer/field-editor-types";
import type {
  MediaAsset,
  Product,
  SectionBlockInstance,
  SectionInstance,
  Site,
  SiteAiApp,
  ThemeBlockSchema,
  ThemeFieldSchema,
  ThemeSectionSchema,
  ThemeSettings
} from "@/lib/types";

type SelectionMeta = {
  scope: string;
  detail: string;
};

type PublishCheckSummary = {
  activePageTitle: string;
  currentPageDirty: boolean;
  dirtyPagesCount: number;
  hiddenDraftCount: number;
  globalSettingsDirty: boolean;
  publishedVersion: number;
  publicationCount: number;
  currentDraftRevision: number;
  themeSettingsRevision: number;
};

export function DesignerPropertyPane({
  workspaceTab,
  selection,
  selectionMeta,
  onChooseSelection,
  activePageTitle,
  pageIsEmpty,
  copyLocatorItems,
  locatorBreadcrumb,
  publishSummary,
  onCopyLocatorSelect,
  onCopyQuickSelect,
  activeSectionId,
  activeSection,
  activeSectionSchema,
  activeGlobalNode,
  activeGlobalNodeFields,
  activeBlock,
  activeGlobalBlock,
  activeBlockSchema,
  activeGlobalBlockSchema,
  selectedBlockSettings,
  fieldOptions,
  site,
  themeSettings,
  mediaAssets,
  products,
  siteAiApps,
  selectedSaasSectionSchemas,
  safeBlocks,
  labelForSchema,
  updateSaasGlobalSetting,
  updateThemeColor,
  updateThemeTypography,
  updateThemeRadii,
  updateThemeLinks,
  updateThemeSeo,
  settingLinkString,
  editBlockSetting,
  deleteBlock,
  moveBlock,
  editGlobalSetting,
  addGlobalBlock,
  editGlobalBlockSetting,
  deleteGlobalBlock,
  moveGlobalBlock,
  editSectionSetting,
  deleteSection,
  moveSection,
  duplicateSection,
  addBlock
}: {
  workspaceTab: DesignerWorkspaceTab;
  selection: Selection;
  selectionMeta: SelectionMeta;
  onChooseSelection: (selection: Selection) => void;
  activePageTitle: string;
  pageIsEmpty: boolean;
  copyLocatorItems: DesignerCopyLocatorItem[];
  locatorBreadcrumb?: string;
  publishSummary: PublishCheckSummary;
  onCopyLocatorSelect: (item: DesignerCopyLocatorItem) => void;
  onCopyQuickSelect: (target: DesignerCopyLocatorQuickTarget) => void;
  activeSectionId?: string;
  activeSection?: SectionInstance;
  activeSectionSchema?: ThemeSectionSchema;
  activeGlobalNode?: GlobalSettingsNodeDefinition;
  activeGlobalNodeFields: ThemeFieldSchema[];
  activeBlock?: SectionBlockInstance;
  activeGlobalBlock?: SectionBlockInstance;
  activeBlockSchema?: ThemeBlockSchema;
  activeGlobalBlockSchema?: ThemeBlockSchema;
  selectedBlockSettings: ThemeFieldSchema[];
  fieldOptions: FieldOptions;
  site: Site;
  themeSettings: ThemeSettings;
  mediaAssets: MediaAsset[];
  products: Product[];
  siteAiApps: SiteAiApp[];
  selectedSaasSectionSchemas: Record<string, ThemeSectionSchema>;
  safeBlocks: (section?: SectionInstance) => SectionBlockInstance[];
  labelForSchema: (type: string, schemas: Record<string, ThemeSectionSchema>) => string;
  updateSaasGlobalSetting: (field: ThemeFieldSchema, value: string) => void;
  updateThemeColor: (key: keyof ThemeSettings["colors"], value: string) => void;
  updateThemeTypography: (key: keyof ThemeSettings["typography"], value: string) => void;
  updateThemeRadii: (key: keyof ThemeSettings["radii"], value: string) => void;
  updateThemeLinks: (key: keyof ThemeSettings["navigation"], value: string) => void;
  updateThemeSeo: (field: GlobalLocalField, value: string | boolean) => void;
  settingLinkString: (links: ThemeSettings["navigation"]["headerLinks"]) => string;
  editBlockSetting: (sectionId: string, blockId: string, field: ThemeFieldSchema, value: string) => void;
  deleteBlock: (sectionId: string, blockId: string) => void;
  moveBlock: (sectionId: string, blockId: string, direction: -1 | 1) => void;
  editGlobalSetting: (globalType: "header" | "footer", field: ThemeFieldSchema, value: string) => void;
  addGlobalBlock: (globalType: "header" | "footer", blockSchema: ThemeBlockSchema) => void;
  editGlobalBlockSetting: (globalType: "header" | "footer", blockId: string, field: ThemeFieldSchema, value: string) => void;
  deleteGlobalBlock: (globalType: "header" | "footer", blockId: string) => void;
  moveGlobalBlock: (globalType: "header" | "footer", blockId: string, direction: -1 | 1) => void;
  editSectionSetting: (sectionId: string, field: ThemeFieldSchema, value: string) => void;
  deleteSection: (sectionId: string) => void;
  moveSection: (sectionId: string, direction: -1 | 1) => void;
  duplicateSection: (sectionId: string) => void;
  addBlock: (sectionId: string, blockSchema: ThemeBlockSchema) => void;
}) {
  const hasSelection = Boolean(activeSection || activeGlobalNode);
  const isGlobalSelection =
    selection.kind === "global" ||
    selection.kind === "globalBlock" ||
    selection.kind === "globalSettings";
  const inspectorTitle =
    selection.kind === "globalSettings" && activeGlobalNode
      ? `${activeGlobalNode.label}设置`
      : selection.kind === "globalBlock" && activeGlobalBlockSchema
      ? `${blockSchemaDisplayLabel(activeGlobalBlockSchema)}设置`
      : selection.kind === "block" && activeBlockSchema
      ? `${blockSchemaDisplayLabel(activeBlockSchema)}设置`
      : activeSection
      ? `${labelForSchema(activeSection.type, selectedSaasSectionSchemas)}设置`
      : selectionMeta.scope;
  const bodyHeading =
    selection.kind === "globalSettings" && activeGlobalNode
      ? activeGlobalNode.label
      : selection.kind === "globalBlock" && activeGlobalBlockSchema
      ? blockSchemaDisplayLabel(activeGlobalBlockSchema)
      : selection.kind === "block" && activeBlockSchema
      ? blockSchemaDisplayLabel(activeBlockSchema)
      : selection.kind === "global"
      ? selection.globalType === "header"
        ? "页眉区域"
        : "页脚区域"
      : activeSection
      ? labelForSchema(activeSection.type, selectedSaasSectionSchemas)
      : undefined;
  const backSelection =
    selection.kind === "block" && activeSectionId
      ? { kind: "section" as const, sectionId: activeSectionId }
      : selection.kind === "globalBlock"
      ? { kind: "global" as const, globalType: selection.globalType }
      : undefined;
  const hasPaneContent = hasSelection || workspaceTab === "publish" || pageIsEmpty || copyLocatorItems.length > 0;
  return (
    <div className="h-full min-h-0 overflow-hidden bg-white">
      <PropertyInspector
        hasSelection={hasPaneContent}
        mediaAssets={mediaAssets}
        products={products}
        selectedBlockId={selection.kind === "block" || selection.kind === "globalBlock" ? selection.blockId : undefined}
        selectedGlobalNode={selection.kind === "globalSettings" ? selection.node : undefined}
        selectedGlobalType={selection.kind === "global" || selection.kind === "globalBlock" ? selection.globalType : undefined}
        selectedSectionId={selection.kind === "section" || selection.kind === "block" ? selection.sectionId : undefined}
        selectionScope={selection.kind}
        siteAiApps={siteAiApps}
      >
        {workspaceTab === "publish" ? (
          <div className="flex h-full min-h-0 flex-col">
            <PropertyPanelHeader
              modeLabel="publish"
              subtitle="保存草稿不会上线；发布会更新整站快照。"
              title="发布检查"
            />
            <PropertyPanelBody>
              <PublishCheckPanel summary={publishSummary} />
            </PropertyPanelBody>
          </div>
        ) : hasSelection ? (
          <div className="flex h-full min-h-0 flex-col">
            <PropertyPanelHeader
              modeLabel={selectionMeta.scope}
              onBack={backSelection ? () => onChooseSelection(backSelection) : undefined}
              subtitle={selectionMeta.detail}
              title={inspectorTitle}
            />
            <PropertyPanelBody className={isGlobalSelection ? "global-widget-settings" : undefined}>
              <DesignerCopyLocatorPanel
                activePageTitle={activePageTitle}
                breadcrumb={locatorBreadcrumb}
                items={copyLocatorItems}
                onQuickSelect={onCopyQuickSelect}
                onSelectItem={onCopyLocatorSelect}
                pageIsEmpty={pageIsEmpty}
              />
              {bodyHeading ? <div className="designer-current-widget-title">{bodyHeading}</div> : null}
              <DesignerSelectionEditor
                activeBlock={activeBlock}
                activeBlockSchema={activeBlockSchema}
                activeGlobalBlock={activeGlobalBlock}
                activeGlobalBlockSchema={activeGlobalBlockSchema}
                activeGlobalNode={activeGlobalNode}
                activeGlobalNodeFields={activeGlobalNodeFields}
                activeSection={activeSection}
                activeSectionId={activeSectionId}
                activeSectionSchema={activeSectionSchema}
                addBlock={addBlock}
                addGlobalBlock={addGlobalBlock}
                deleteBlock={deleteBlock}
                deleteGlobalBlock={deleteGlobalBlock}
                deleteSection={deleteSection}
                duplicateSection={duplicateSection}
                editBlockSetting={editBlockSetting}
                editGlobalBlockSetting={editGlobalBlockSetting}
                editGlobalSetting={editGlobalSetting}
                editSectionSetting={editSectionSetting}
                fieldOptions={fieldOptions}
                labelForSchema={labelForSchema}
                mediaAssets={mediaAssets}
                moveBlock={moveBlock}
                moveGlobalBlock={moveGlobalBlock}
                moveSection={moveSection}
                products={products}
                safeBlocks={safeBlocks}
                selectedBlockSettings={selectedBlockSettings}
                selectedSaasSectionSchemas={selectedSaasSectionSchemas}
                selection={selection}
                settingLinkString={settingLinkString}
                site={site}
                siteAiApps={siteAiApps}
                themeSettings={themeSettings}
                updateSaasGlobalSetting={updateSaasGlobalSetting}
                updateThemeColor={updateThemeColor}
                updateThemeLinks={updateThemeLinks}
                updateThemeRadii={updateThemeRadii}
                updateThemeSeo={updateThemeSeo}
                updateThemeTypography={updateThemeTypography}
              />
            </PropertyPanelBody>
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-col">
            <PropertyPanelHeader
              modeLabel="属性检查器"
              subtitle={pageIsEmpty ? "此页当前显示的主要是全局页头和页脚。" : "从左侧结构树或中间预览区选择页面节点。"}
              title={pageIsEmpty ? "此页主体为空" : "属性面板"}
            />
            <PropertyPanelBody>
              <DesignerCopyLocatorPanel
                activePageTitle={activePageTitle}
                breadcrumb={locatorBreadcrumb}
                items={copyLocatorItems}
                onQuickSelect={onCopyQuickSelect}
                onSelectItem={onCopyLocatorSelect}
                pageIsEmpty={pageIsEmpty}
              />
              <div className="px-5 py-5 text-[13px] leading-6 text-[#7c8087]">
                {pageIsEmpty
                  ? "当前页面没有主体模块。请优先使用上方快捷入口修改全局页头、页脚、导航或 SEO；只有页面主体需要独立内容时才添加模块。"
                  : "当前没有选中可编辑对象。请从左侧页面树、模块树、预览区或文案定位器选择一个对象后再编辑字段。"}
              </div>
            </PropertyPanelBody>
          </div>
        )}
      </PropertyInspector>
    </div>
  );
}

function PublishCheckPanel({ summary }: { summary: PublishCheckSummary }) {
  const scopeRows = [
    ["当前页面", summary.activePageTitle],
    ["当前页状态", summary.currentPageDirty ? "草稿待发布" : "已与线上同步"],
    ["待发布页面", `${summary.dirtyPagesCount} 页`],
    ["隐藏草稿", `${summary.hiddenDraftCount} 项`],
    ["全局设置", summary.globalSettingsDirty ? "有变更" : "无变更"]
  ];
  const versionRows = [
    ["当前线上版本", `v${summary.publishedVersion}`],
    ["发布记录", `${summary.publicationCount} 次`],
    ["当前草稿页版本", `v${summary.currentDraftRevision}`],
    ["全局设置草稿版本", `v${summary.themeSettingsRevision}`]
  ];

  return (
    <div className="grid gap-3 px-3 py-3 text-[12px] text-[#344054]" data-designer-layout="saas-publish-check-panel">
      <section className="rounded-[8px] border border-[#d9dde4] bg-[#fafbfc] p-3">
        <p className="font-semibold text-[#101828]">本次会一起上线的内容</p>
        <div className="mt-3 grid gap-2">
          {scopeRows.map(([label, value]) => (
            <div className="flex items-center justify-between gap-3" key={label}>
              <span className="text-[#667085]">{label}</span>
              <span className="min-w-0 truncate font-medium text-[#101828]">{value}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[8px] border border-[#d9dde4] bg-white p-3">
        <p className="font-semibold text-[#101828]">版本保护</p>
        <div className="mt-3 grid gap-2">
          {versionRows.map(([label, value]) => (
            <div className="flex items-center justify-between gap-3" key={label}>
              <span className="text-[#667085]">{label}</span>
              <span className="font-medium text-[#101828]">{value}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[8px] border border-[#f2d3a4] bg-[#fff8ed] p-3 leading-5 text-[#8a5a1f]">
        <p className="font-semibold">上线前请确认</p>
        <p className="mt-2">保存草稿不会上线；发布会先保存草稿，再更新整站线上快照。</p>
        <p className="mt-2">如果确认期间页面、全局设置或线上版本被别人改过，这次发布会被 409 拦住，避免静默覆盖。</p>
      </section>
    </div>
  );
}
