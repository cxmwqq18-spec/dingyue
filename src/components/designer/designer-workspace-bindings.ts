"use client";

import type { ComponentProps, Dispatch, DragEvent, ReactNode, SetStateAction } from "react";
import { GlobalTree } from "@/components/designer/global-tree";
import { PageTree } from "@/components/designer/page-tree";
import { SectionTree } from "@/components/designer/section-tree";
import type {
  DesignerDragState,
  GlobalSettingsNodeDefinition,
  GlobalType,
  Selection
} from "@/components/designer/designer-types";
import type { ModuleLibrarySchemaGroup } from "@/components/designer/module-library";
import type {
  SectionBlockInstance,
  SectionInstance,
  SectionType,
  ThemeBlockSchema,
  ThemePage,
  ThemePageJson,
  ThemeSectionSchema,
  ThemeSettings
} from "@/lib/types";

export function createPageTreeProps({
  activePage,
  currentPageDirty,
  drafts,
  publishedPages,
  onSelectPage,
  pageOptionLabel,
  pages,
  selectedPageId
}: {
  activePage: ThemePage;
  currentPageDirty: boolean;
  drafts: Record<string, ThemePageJson>;
  publishedPages: Record<string, ThemePageJson>;
  onSelectPage: (pageId: string) => void;
  pageOptionLabel: (page: ThemePage) => string;
  pages: ThemePage[];
  selectedPageId: string;
}): ComponentProps<typeof PageTree> {
  return {
    activePage,
    currentPageDirty,
    drafts,
    publishedPages,
    onSelectPage,
    pageOptionLabel,
    pages,
    selectedPageId
  };
}

export function createGlobalTreeProps({
  dragState,
  expandedGlobals,
  globalNodes,
  instanceKey,
  onChooseSelection,
  onGlobalBlockDragStart,
  onGlobalBlockDrop,
  onSetAllGlobalsExpanded,
  onToggleGlobalExpanded,
  resolveBlockSchema,
  safeBlocks,
  selection,
  setDragState,
  themeSettings
}: {
  dragState: DesignerDragState | null;
  expandedGlobals: Record<GlobalType, boolean>;
  globalNodes: GlobalSettingsNodeDefinition[];
  instanceKey: (item: { id?: string; type?: string }, index: number, prefix: string) => string;
  onChooseSelection: (selection: Selection) => void;
  onGlobalBlockDragStart: (event: DragEvent<HTMLElement>, globalType: GlobalType, blockId: string) => void;
  onGlobalBlockDrop: (event: DragEvent<HTMLElement>, globalType: GlobalType, targetBlockId: string) => void;
  onSetAllGlobalsExpanded: (expanded: boolean) => void;
  onToggleGlobalExpanded: (globalType: GlobalType) => void;
  resolveBlockSchema: (section: SectionInstance, blockType: string) => ThemeBlockSchema | undefined;
  safeBlocks: (section?: SectionInstance) => SectionBlockInstance[];
  selection: Selection;
  setDragState: Dispatch<SetStateAction<DesignerDragState | null>>;
  themeSettings: ThemeSettings;
}): ComponentProps<typeof GlobalTree> {
  return {
    dragState,
    expandedGlobals,
    globalNodes,
    instanceKey,
    onChooseGlobal: (globalType) => onChooseSelection({ kind: "global", globalType }),
    onChooseGlobalBlock: (globalType, blockId) => onChooseSelection({ kind: "globalBlock", globalType, blockId }),
    onChooseGlobalSettings: (node) => onChooseSelection({ kind: "globalSettings", node }),
    onDragEnd: () => setDragState(null),
    onGlobalBlockDragStart,
    onGlobalBlockDragTarget: (blockId) => setDragState((current) => current?.kind === "globalBlock" ? { ...current, targetId: blockId } : current),
    onGlobalBlockDrop,
    onSetAllGlobalsExpanded,
    onToggleGlobalExpanded,
    resolveBlockSchema,
    safeBlocks,
    selection,
    themeSettings
  };
}

export function createSectionTreeProps({
  activePage,
  blockDisplayLabel,
  categoryLabel,
  changedSectionCount,
  dragState,
  expandedSections,
  instanceKey,
  labelForSchema,
  moduleLibraryCategoryOrder,
  moduleLibrarySchemaGroups,
  onBlockDragStart,
  onBlockDrop,
  onCanvasEmptyDrop,
  onChooseSelection,
  onAddBlock,
  emptyStateActions,
  onInsertSection,
  onLibrarySectionDragStart,
  onSectionDragEnd,
  onSectionDragTarget,
  onSectionPointerDown,
  onSectionDragStart,
  onSectionDrop,
  onSetAllSectionsExpanded,
  onToggleSectionExpanded,
  resolveBlockSchema,
  safeBlocks,
  schemaBlockCount,
  schemaForType,
  schemaMetaLine,
  sectionList,
  selectedSaasSectionSchemas,
  selection,
  setDragState
}: {
  activePage: ThemePage;
  blockDisplayLabel: (schema: ThemeBlockSchema | undefined, block: SectionBlockInstance, index: number) => string;
  categoryLabel: (category?: string) => string;
  changedSectionCount: number;
  dragState: DesignerDragState | null;
  expandedSections: Record<string, boolean>;
  instanceKey: (item: { id?: string; type?: string }, index: number, prefix: string) => string;
  labelForSchema: (type: SectionType, schemas: Record<string, ThemeSectionSchema>) => string;
  moduleLibraryCategoryOrder: string[];
  moduleLibrarySchemaGroups: ModuleLibrarySchemaGroup[];
  onBlockDragStart: (event: DragEvent<HTMLElement>, sectionId: string, blockId: string) => void;
  onBlockDrop: (event: DragEvent<HTMLElement>, sectionId: string, targetBlockId: string) => void;
  onCanvasEmptyDrop: (event: DragEvent<HTMLElement>) => void;
  onChooseSelection: (selection: Selection) => void;
  onAddBlock: (sectionId: string, blockSchema: ThemeBlockSchema) => void;
  emptyStateActions?: ReactNode;
  onInsertSection: (type: SectionType, targetId?: string, position?: "before" | "after") => void;
  onLibrarySectionDragStart: ComponentProps<typeof SectionTree>["onLibrarySectionDragStart"];
  onSectionDragEnd: () => void;
  onSectionDragTarget: (sectionId: string, position: "before" | "after") => void;
  onSectionPointerDown: (sectionId: string) => void;
  onSectionDragStart: (event: DragEvent<HTMLElement>, sectionId: string) => void;
  onSectionDrop: (event: DragEvent<HTMLElement>, targetId: string) => void;
  onSetAllSectionsExpanded: (expanded: boolean) => void;
  onToggleSectionExpanded: (sectionId: string) => void;
  resolveBlockSchema: (schemas: Record<string, ThemeSectionSchema>, section: SectionInstance, blockType: string) => ThemeBlockSchema | undefined;
  safeBlocks: (section?: SectionInstance) => SectionBlockInstance[];
  schemaBlockCount: (schema: ThemeSectionSchema) => string;
  schemaForType: (type: SectionType) => ThemeSectionSchema;
  schemaMetaLine: (schema: ThemeSectionSchema) => string;
  sectionList: Array<{ id: string; section: SectionInstance }>;
  selectedSaasSectionSchemas: Record<string, ThemeSectionSchema>;
  selection: Selection;
  setDragState: Dispatch<SetStateAction<DesignerDragState | null>>;
}): ComponentProps<typeof SectionTree> {
  return {
    activePage,
    blockDisplayLabel,
    categoryLabel,
    changedSectionCount,
    dragState,
    expandedSections,
    instanceKey,
    labelForSchema,
    moduleLibraryCategoryOrder,
    moduleLibrarySchemaGroups,
    onBlockDragStart,
    onBlockDragTarget: (blockId) => setDragState((current) => current?.kind === "block" ? { ...current, targetId: blockId } : current),
    onBlockDrop,
    onCanvasEmptyDrop,
    onChooseBlock: (sectionId, blockId) => onChooseSelection({ kind: "block", sectionId, blockId }),
    onChooseSection: (sectionId) => onChooseSelection({ kind: "section", sectionId }),
    onAddBlock,
    emptyStateActions,
    onDragEnd: onSectionDragEnd,
    onInsertSection,
    onLibrarySectionDragStart,
    onSectionPointerDown,
    onSectionDragStart,
    onSectionDragTarget,
    onSectionDrop,
    onSetAllSectionsExpanded,
    onToggleSectionExpanded,
    resolveBlockSchema,
    safeBlocks,
    schemaBlockCount,
    schemaForType,
    schemaMetaLine,
    sectionList,
    selectedSaasSectionSchemas,
    selection
  };
}
