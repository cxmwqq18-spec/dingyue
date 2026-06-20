"use client";

import { blockSchemaDisplayLabel } from "@/components/designer/designer-metadata";
import { PropertyInspector } from "@/components/designer/property-inspector";
import { PropertyPanelBody, PropertyPanelHeader } from "@/components/designer/property-panel";
import { DesignerSelectionEditor } from "@/components/designer/designer-selection-editor";
import type { GlobalLocalField, GlobalSettingsNodeDefinition, Selection } from "@/components/designer/designer-types";
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

export function DesignerPropertyPane({
  selection,
  selectionMeta,
  onChooseSelection,
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
  selection: Selection;
  selectionMeta: SelectionMeta;
  onChooseSelection: (selection: Selection) => void;
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
  return (
    <div className="h-full min-h-0 overflow-hidden bg-white">
      <PropertyInspector
        hasSelection={hasSelection}
        mediaAssets={mediaAssets}
        products={products}
        selectedBlockId={selection.kind === "block" || selection.kind === "globalBlock" ? selection.blockId : undefined}
        selectedGlobalNode={selection.kind === "globalSettings" ? selection.node : undefined}
        selectedGlobalType={selection.kind === "global" || selection.kind === "globalBlock" ? selection.globalType : undefined}
        selectedSectionId={selection.kind === "section" || selection.kind === "block" ? selection.sectionId : undefined}
        selectionScope={selection.kind}
        siteAiApps={siteAiApps}
      >
        {hasSelection ? (
          <div className="flex h-full min-h-0 flex-col">
            <PropertyPanelHeader
              modeLabel={selectionMeta.scope}
              onBack={backSelection ? () => onChooseSelection(backSelection) : undefined}
              subtitle={selectionMeta.detail}
              title={inspectorTitle}
            />
            <PropertyPanelBody className={isGlobalSelection ? "global-widget-settings" : undefined}>
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
              subtitle="从左侧结构树或中间预览区选择页面节点。"
              title="属性面板"
            />
            <PropertyPanelBody>
              <div className="px-6 py-6 text-[13px] leading-6 text-[#7c8087]">
                当前没有选中可编辑对象。请从左侧页面树、模块树或全局节点中选择一个对象后再编辑字段。
              </div>
            </PropertyPanelBody>
          </div>
        )}
      </PropertyInspector>
    </div>
  );
}
