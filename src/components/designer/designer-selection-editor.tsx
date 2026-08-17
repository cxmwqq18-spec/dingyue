"use client";

import { BlockFields, GlobalSectionFields, GlobalSettingsFields, SectionFields } from "@/components/designer/designer-property-renderers";
import { PropertyActionRow } from "@/components/designer/property-panel";
import type { GlobalLocalField, GlobalSettingsNodeDefinition, PropertyFieldFocusRequest, Selection } from "@/components/designer/designer-types";
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

export function DesignerSelectionEditor({
  selection,
  activeSectionId,
  activeSection,
  activeSectionSchema,
  activeGlobalNode,
  activeGlobalNodeFields,
  activeBlock,
  activeGlobalBlock,
  activeBlockSchema,
  activeGlobalBlockSchema: _activeGlobalBlockSchema,
  selectedBlockSettings,
  fieldOptions,
  site,
  themeSettings,
  mediaAssets: _mediaAssets,
  products: _products,
  siteAiApps: _siteAiApps,
  selectedSaasSectionSchemas: _selectedSaasSectionSchemas,
  labelForSchema: _labelForSchema,
  safeBlocks: _safeBlocks,
  settingLinkString,
  updateSaasGlobalSetting,
  updateThemeColor,
  updateThemeTypography,
  updateThemeRadii,
  updateThemeLinks,
  updateThemeSeo,
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
  addBlock,
  fieldFocusRequest
}: {
  selection: Selection;
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
  labelForSchema: (type: string, schemas: Record<string, ThemeSectionSchema>) => string;
  safeBlocks: (section?: SectionInstance) => SectionBlockInstance[];
  settingLinkString: (links: ThemeSettings["navigation"]["headerLinks"]) => string;
  updateSaasGlobalSetting: (field: ThemeFieldSchema, value: string) => void;
  updateThemeColor: (key: keyof ThemeSettings["colors"], value: string) => void;
  updateThemeTypography: (key: keyof ThemeSettings["typography"], value: string) => void;
  updateThemeRadii: (key: keyof ThemeSettings["radii"], value: string) => void;
  updateThemeLinks: (key: keyof ThemeSettings["navigation"], value: string) => void;
  updateThemeSeo: (field: GlobalLocalField, value: string | boolean) => void;
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
  fieldFocusRequest?: PropertyFieldFocusRequest;
}) {
  if (selection.kind === "globalSettings" && activeGlobalNode) {
    return (
      <GlobalSettingsFields
        activeGlobalNode={activeGlobalNode}
        activeGlobalNodeFields={activeGlobalNodeFields}
        fieldOptions={fieldOptions}
        onUpdateSaasGlobalSetting={updateSaasGlobalSetting}
        settingLinkString={settingLinkString}
        site={site}
        focusRequest={fieldFocusRequest}
        scopeKey={`globalSettings:${selection.node}`}
        themeSettings={themeSettings}
        updateThemeColor={updateThemeColor}
        updateThemeLinks={updateThemeLinks}
        updateThemeRadii={updateThemeRadii}
        updateThemeSeo={updateThemeSeo}
        updateThemeTypography={updateThemeTypography}
      />
    );
  }

  if (selection.kind === "block" && activeBlock && activeBlockSchema) {
    return (
      <BlockFields
        actionRow={
          <PropertyActionRow
            onDelete={() => deleteBlock(activeSectionId ?? "", activeBlock.id)}
            onMoveDown={() => moveBlock(activeSectionId ?? "", activeBlock.id, 1)}
            onMoveUp={() => moveBlock(activeSectionId ?? "", activeBlock.id, -1)}
          />
        }
        fieldOptions={fieldOptions}
        fields={selectedBlockSettings}
        focusRequest={fieldFocusRequest}
        onChange={(field, value) => editBlockSetting(activeSectionId ?? "", activeBlock.id, field, value)}
        scopeKey={`block:${selection.sectionId}:${activeBlock.id}`}
        site={site}
        values={activeBlock.settings}
      />
    );
  }

  if (selection.kind === "global" && activeSection && activeSectionSchema) {
    return (
      <GlobalSectionFields
        fieldOptions={fieldOptions}
        onAddBlock={(blockSchema) => addGlobalBlock(selection.globalType, blockSchema)}
        onChange={(field, value) => editGlobalSetting(selection.globalType, field, value)}
        section={activeSection}
        sectionSchema={activeSectionSchema}
        focusRequest={fieldFocusRequest}
        scopeKey={`global:${selection.globalType}`}
        site={site}
      />
    );
  }

  if (selection.kind === "globalBlock" && activeGlobalBlock && selectedBlockSettings.length) {
    return (
      <BlockFields
        actionRow={
          <PropertyActionRow
            onDelete={() => deleteGlobalBlock(selection.globalType, activeGlobalBlock.id)}
            onMoveDown={() => moveGlobalBlock(selection.globalType, activeGlobalBlock.id, 1)}
            onMoveUp={() => moveGlobalBlock(selection.globalType, activeGlobalBlock.id, -1)}
          />
        }
        fieldOptions={fieldOptions}
        fields={selectedBlockSettings}
        focusRequest={fieldFocusRequest}
        onChange={(field, value) => editGlobalBlockSetting(selection.globalType, activeGlobalBlock.id, field, value)}
        scopeKey={`globalBlock:${selection.globalType}:${activeGlobalBlock.id}`}
        site={site}
        values={activeGlobalBlock.settings}
      />
    );
  }

  if (activeSection && activeSectionSchema) {
    return (
      <SectionFields
        fieldOptions={fieldOptions}
        onAddBlock={(blockSchema) => addBlock(activeSectionId ?? "", blockSchema)}
        onChange={(field, value) => editSectionSetting(activeSectionId ?? "", field, value)}
        onDelete={() => deleteSection(activeSectionId ?? "")}
        onDuplicate={() => duplicateSection(activeSectionId ?? "")}
        onMoveDown={() => moveSection(activeSectionId ?? "", 1)}
        onMoveUp={() => moveSection(activeSectionId ?? "", -1)}
        section={activeSection}
        sectionSchema={activeSectionSchema}
        focusRequest={fieldFocusRequest}
        scopeKey={`section:${activeSectionId ?? ""}`}
        site={site}
      />
    );
  }

  return null;
}
