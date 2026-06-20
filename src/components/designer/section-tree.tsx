"use client";

import type { ComponentProps, DragEvent } from "react";
import {
  DesignerStructureEmptyState,
  DesignerStructureSequence,
  DesignerSectionBranchCard,
  DesignerStructureInsertSlot
} from "@/components/designer/designer-structure-primitives";
import { DesignerModuleChooser } from "@/components/designer/designer-module-chooser";
import {
  DesignerPillButton,
  DesignerSidebarPanel
} from "@/components/designer/designer-sidebar-primitives";
import type { DesignerDragState, Selection } from "@/components/designer/designer-types";
import type { ModuleLibrarySchemaGroup } from "@/components/designer/module-library";
import type { SectionBlockInstance, SectionInstance, SectionType, ThemeBlockSchema, ThemePage, ThemeSectionSchema } from "@/lib/types";

export function SectionTree({
  activePage,
  sectionList,
  changedSectionCount,
  dragState,
  selection,
  expandedSections,
  selectedSaasSectionSchemas,
  schemaForType,
  safeBlocks,
  labelForSchema,
  schemaMetaLine,
  categoryLabel,
  schemaBlockCount,
  blockDisplayLabel,
  instanceKey,
  moduleLibraryCategoryOrder,
  moduleLibrarySchemaGroups,
  resolveBlockSchema,
  onInsertSection,
  onSetAllSectionsExpanded,
  onCanvasEmptyDrop,
  onLibrarySectionDragStart,
  onSectionPointerDown,
  onSectionDragStart,
  onSectionDrop,
  onSectionDragTarget,
  onDragEnd,
  onToggleSectionExpanded,
  onChooseSection,
  onBlockDragStart,
  onBlockDrop,
  onBlockDragTarget,
  onChooseBlock,
  onAddBlock,
  chrome = "full"
}: {
  activePage: ThemePage;
  sectionList: Array<{ id: string; section: SectionInstance }>;
  changedSectionCount: number;
  dragState: DesignerDragState | null;
  selection: Selection;
  expandedSections: Record<string, boolean>;
  selectedSaasSectionSchemas: Record<string, ThemeSectionSchema>;
  schemaForType: (type: SectionType) => ThemeSectionSchema;
  safeBlocks: (section?: SectionInstance) => SectionBlockInstance[];
  labelForSchema: (type: SectionType, schemas: Record<string, ThemeSectionSchema>) => string;
  schemaMetaLine: (schema: ThemeSectionSchema) => string;
  categoryLabel: (category?: string) => string;
  schemaBlockCount: (schema: ThemeSectionSchema) => string;
  blockDisplayLabel: (schema: ThemeBlockSchema | undefined, block: SectionBlockInstance, index: number) => string;
  instanceKey: (item: { id?: string; type?: string }, index: number, prefix: string) => string;
  moduleLibraryCategoryOrder: string[];
  moduleLibrarySchemaGroups: ModuleLibrarySchemaGroup[];
  resolveBlockSchema: (schemas: Record<string, ThemeSectionSchema>, section: SectionInstance, blockType: string) => ThemeBlockSchema | undefined;
  onInsertSection: (type: SectionType, targetId?: string, position?: "before" | "after") => void;
  onSetAllSectionsExpanded: (expanded: boolean) => void;
  onCanvasEmptyDrop: (event: DragEvent<HTMLElement>) => void;
  onLibrarySectionDragStart: ComponentProps<typeof DesignerModuleChooser>["moduleLibraryProps"]["onLibrarySectionDragStart"];
  onSectionPointerDown: (sectionId: string) => void;
  onSectionDragStart: (event: DragEvent<HTMLElement>, sectionId: string) => void;
  onSectionDrop: (event: DragEvent<HTMLElement>, targetId: string) => void;
  onSectionDragTarget: (sectionId: string, position: "before" | "after") => void;
  onDragEnd: () => void;
  onToggleSectionExpanded: (sectionId: string) => void;
  onChooseSection: (sectionId: string) => void;
  onBlockDragStart: (event: DragEvent<HTMLElement>, sectionId: string, blockId: string) => void;
  onBlockDrop: (event: DragEvent<HTMLElement>, sectionId: string, targetBlockId: string) => void;
  onBlockDragTarget: (blockId: string) => void;
  onChooseBlock: (sectionId: string, blockId: string) => void;
  onAddBlock: (sectionId: string, blockSchema: ThemeBlockSchema) => void;
  chrome?: "full" | "bare";
}) {
  const moduleLibraryProps = {
    categoryOrder: moduleLibraryCategoryOrder,
    labelForSchema,
    onAddSection: (type: SectionType) => onInsertSection(type),
    onDragEnd,
    onLibrarySectionDragStart,
    schemaBlockCount,
    schemaForType,
    schemaGroups: moduleLibrarySchemaGroups,
    selectedSaasSectionSchemas
  };
  const dragNotice = dragState
    ? dragState.kind === "librarySection"
      ? `正在拖拽 ${labelForSchema(dragState.type, selectedSaasSectionSchemas)}`
      : `正在拖拽 ${dragState.kind}: ${dragState.id}`
    : undefined;

  return (
    <DesignerSidebarPanel
      actions={chrome === "full" ? (
        <>
          <DesignerPillButton onClick={() => onSetAllSectionsExpanded(true)}>展开</DesignerPillButton>
          <DesignerPillButton onClick={() => onSetAllSectionsExpanded(false)}>收起</DesignerPillButton>
        </>
      ) : undefined}
      chrome={chrome}
      meta={chrome === "full" ? `${sectionList.length} 模块 / ${changedSectionCount} 变更` : undefined}
      notice={dragNotice}
      scrollClassName={chrome === "bare" ? "pb-1.5" : undefined}
      summary={`${sectionList.length} 个模块，${changedSectionCount} 处草稿差异`}
      summaryEyebrow="页面结构"
      title={activePage.title}
    >
      <div
        className={dragState?.kind === "librarySection" && !sectionList.length ? "rounded-[8px] border border-dashed border-zinc-400 bg-white/70 p-3" : ""}
        onDragOver={(event) => {
          if (dragState?.kind === "librarySection" && !sectionList.length) event.preventDefault();
        }}
        onDrop={sectionList.length ? undefined : onCanvasEmptyDrop}
      >
        <div className="grid gap-0.5">
          <DesignerStructureSequence
            emptyState={
              <DesignerStructureEmptyState>
                <p>当前页面还没有模块。</p>
                <div className="mt-4">
                  <DesignerStructureInsertSlot
                    moduleLibraryProps={moduleLibraryProps}
                    onInsertSection={(type) => onInsertSection(type)}
                    pageTitle={activePage.title}
                    sectionCount={sectionList.length}
                    variant="inline"
                  />
                </div>
              </DesignerStructureEmptyState>
            }
            itemKey={({ id }) => id}
            items={sectionList}
            renderAfterLast={(item) => (
              <DesignerStructureInsertSlot
                moduleLibraryProps={moduleLibraryProps}
                onInsertSection={(type) => onInsertSection(type, item.id, "after")}
                pageTitle={activePage.title}
                sectionCount={sectionList.length}
              />
            )}
            renderBeforeFirst={() => null}
            renderBetween={() => null}
            renderItem={({ id, section }, index) => {
              const blocks = safeBlocks(section);
              const schema = schemaForType(section.type);
              const isExpanded = expandedSections[id] ?? false;

              return (
                <DesignerSectionBranchCard
                  blockDisplayLabel={blockDisplayLabel}
                  blocks={blocks}
                  categoryLabel={categoryLabel}
                  dragState={dragState}
                  instanceKey={instanceKey}
                  isExpanded={isExpanded}
                  labelForSchema={labelForSchema}
                  onBlockDragStart={onBlockDragStart}
                  onBlockDragTarget={onBlockDragTarget}
                  onBlockDrop={onBlockDrop}
                  onChooseBlock={onChooseBlock}
                  onChooseSection={onChooseSection}
                  onAddBlock={onAddBlock}
                  onDragEnd={onDragEnd}
                  onSectionDragStart={onSectionDragStart}
                  onSectionPointerDown={onSectionPointerDown}
                  onSectionDragTarget={onSectionDragTarget}
                  onSectionDrop={onSectionDrop}
                  onToggleSectionExpanded={onToggleSectionExpanded}
                  resolveBlockSchema={resolveBlockSchema}
                  schema={schema}
                  schemaBlockCount={schemaBlockCount}
                  schemaMetaLine={schemaMetaLine}
                  section={section}
                  sectionId={id}
                  sectionIndex={index}
                  selectedSaasSectionSchemas={selectedSaasSectionSchemas}
                  selection={selection}
                />
              );
            }}
          />
        </div>
      </div>
    </DesignerSidebarPanel>
  );
}
