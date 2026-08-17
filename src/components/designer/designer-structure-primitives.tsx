"use client";

import type { ComponentProps, DragEvent, ReactNode } from "react";
import { blockDisplayLabel } from "@/components/designer/designer-metadata";
import { sectionDropPosition } from "@/components/designer/designer-drag-protocol";
import { DesignerBlockChooser } from "@/components/designer/designer-block-chooser";
import { DesignerModuleChooser } from "@/components/designer/designer-module-chooser";
import { ModuleLibrary } from "@/components/designer/module-library";
import {
  DesignerGlobalNodeButton,
  DesignerTreeCard,
  DesignerTreeBranch,
  DesignerTreeChildButton
} from "@/components/designer/designer-sidebar-primitives";
import type { DesignerDragState, Selection } from "@/components/designer/designer-types";
import type {
  SectionBlockInstance,
  SectionInstance,
  SectionType,
  ThemeBlockSchema,
  ThemeSectionSchema
} from "@/lib/types";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function settingPreviewValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const candidate = record.title ?? record.label ?? record.name ?? record.id ?? record.url;
    return typeof candidate === "string" || typeof candidate === "number" ? String(candidate) : "";
  }
  return "";
}

function sectionPreviewLine(section: SectionInstance): string | undefined {
  const settings = section.settings ?? {};
  const values = [
    settingPreviewValue(settings.anchor) ? `#${settingPreviewValue(settings.anchor)}` : "",
    settingPreviewValue(settings.title),
    settingPreviewValue(settings.headline),
    settingPreviewValue(settings.eyebrow)
  ].filter(Boolean);
  return values[0] || undefined;
}

export function DesignerStructureInsertSlot({
  moduleLibraryProps,
  onInsertSection,
  pageTitle,
  sectionCount,
  variant = "rail"
}: {
  moduleLibraryProps: ComponentProps<typeof ModuleLibrary>;
  onInsertSection: (type: SectionType) => void;
  pageTitle: string;
  sectionCount: number;
  variant?: "inline" | "rail";
}) {
  if (variant === "rail") {
    return (
      <div className="section__add_wrap_f74f" data-designer-layout="xfcart-structure-insert-rail">
        <DesignerModuleChooser
          moduleLibraryProps={moduleLibraryProps}
          onAddSection={onInsertSection}
          pageTitle={pageTitle}
          sectionCount={sectionCount}
          variant="rail"
        />
      </div>
    );
  }

  return (
    <DesignerModuleChooser
      moduleLibraryProps={moduleLibraryProps}
      onAddSection={onInsertSection}
      pageTitle={pageTitle}
      sectionCount={sectionCount}
      variant="inline"
    />
  );
}

export function DesignerStructureEmptyState({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("rounded-[4px] border border-dashed border-[#cfd4db] bg-white p-4 text-center text-[12px] text-[#7c8087]", className)}>
      {children}
    </div>
  );
}

export function DesignerStructureSequence<T>({
  emptyState,
  itemKey,
  items,
  renderAfterLast,
  renderBeforeFirst,
  renderBetween,
  renderItem
}: {
  emptyState: ReactNode;
  itemKey: (item: T, index: number) => string;
  items: T[];
  renderAfterLast: (lastItem: T, lastIndex: number) => ReactNode;
  renderBeforeFirst: (firstItem: T, firstIndex: number) => ReactNode;
  renderBetween: (item: T, index: number) => ReactNode;
  renderItem: (item: T, index: number) => ReactNode;
}) {
  if (!items.length) return <>{emptyState}</>;

  return (
    <>
      {renderBeforeFirst(items[0], 0)}
      {items.map((item, index) => (
        <div className="grid gap-0.5" key={itemKey(item, index)}>
          {renderItem(item, index)}
          {index < items.length - 1 ? renderBetween(item, index) : null}
        </div>
      ))}
      {renderAfterLast(items[items.length - 1], items.length - 1)}
    </>
  );
}

export function DesignerStructureBlockList({
  blocks,
  dataLayout,
  dragKind,
  dragState,
  instanceKey,
  itemKicker,
  itemMeta,
  itemTitle,
  listKeyPrefix,
  onBlockClick,
  onBlockDragStart,
  onBlockDragTarget,
  onBlockDrop,
  onDragEnd,
  selectedBlockId
}: {
  blocks: SectionBlockInstance[];
  dataLayout: string;
  dragKind: "block" | "globalBlock";
  dragState: DesignerDragState | null;
  instanceKey: (item: { id?: string; type?: string }, index: number, prefix: string) => string;
  itemKicker: (block: SectionBlockInstance, index: number) => string;
  itemMeta: (block: SectionBlockInstance, index: number) => string;
  itemTitle: (block: SectionBlockInstance, index: number) => React.ReactNode;
  listKeyPrefix: string;
  onBlockClick: (blockId: string) => void;
  onBlockDragStart: (event: DragEvent<HTMLElement>, blockId: string) => void;
  onBlockDragTarget: (blockId: string) => void;
  onBlockDrop: (event: DragEvent<HTMLElement>, targetBlockId: string) => void;
  onDragEnd: () => void;
  selectedBlockId?: string;
}) {
  return (
    <div className="blocks__items_6849 ml-[14px] grid gap-0 border-l border-[#dfe4ea]" data-designer-layout={dataLayout}>
      <DesignerStructureChildList
        dataLayout={dataLayout}
        dragConfig={{
          dragKind,
          dragState,
          itemId: (blockInstance) => blockInstance.id,
          onDragEnd,
          onItemDragStart: onBlockDragStart,
          onItemDragTarget: onBlockDragTarget,
          onItemDrop: onBlockDrop
        }}
        itemChildren={() => null}
        itemKicker={itemKicker}
        itemKey={(blockInstance, blockIndex) => instanceKey(blockInstance, blockIndex, listKeyPrefix)}
        itemMeta={itemMeta}
        itemSelected={(blockInstance) => selectedBlockId === blockInstance.id}
        itemTestId={(blockInstance) => `block:${blockInstance.id}`}
        itemTitle={itemTitle}
        items={blocks}
        onItemClick={(blockInstance) => onBlockClick(blockInstance.id)}
      />
    </div>
  );
}

export function DesignerStructureChildList<T>({
  items,
  itemKey,
  itemKicker,
  itemTitle,
  itemMeta,
  itemAside,
  itemSelected,
  itemTestId,
  itemChildren,
  onItemClick,
  dragConfig,
  dataLayout
}: {
  items: T[];
  itemKey: (item: T, index: number) => string;
  itemKicker: (item: T, index: number) => string;
  itemTitle: (item: T, index: number) => ReactNode;
  itemMeta: (item: T, index: number) => string;
  itemAside?: (item: T, index: number) => ReactNode;
  itemSelected: (item: T, index: number) => boolean;
  itemTestId?: (item: T, index: number) => string | undefined;
  itemChildren?: (item: T, index: number) => ReactNode;
  onItemClick: (item: T, index: number) => void;
  dragConfig?: {
    dragKind: "block" | "globalBlock";
    dragState: DesignerDragState | null;
    itemId: (item: T, index: number) => string;
    onDragEnd: () => void;
    onItemDragStart: (event: DragEvent<HTMLElement>, itemId: string) => void;
    onItemDragTarget: (itemId: string) => void;
    onItemDrop: (event: DragEvent<HTMLElement>, itemId: string) => void;
  };
  dataLayout?: string;
}) {
  return (
    <div className="grid gap-0" data-designer-layout={dataLayout}>
      {items.map((item, index) => {
        const dragId = dragConfig?.itemId(item, index);
        const dragTarget = Boolean(
          dragConfig &&
            dragId &&
            dragConfig.dragState?.kind === dragConfig.dragKind &&
            dragConfig.dragState.targetId === dragId &&
            dragConfig.dragState.id !== dragId
        );
        return (
          <DesignerTreeChildButton
            aside={itemAside?.(item, index)}
            dragTarget={dragTarget}
            draggable={Boolean(dragConfig && dragId)}
            key={itemKey(item, index)}
            kicker={itemKicker(item, index)}
            meta={itemMeta(item, index)}
            onClick={() => onItemClick(item, index)}
            onDragEnd={dragConfig?.onDragEnd}
            onDragEnter={dragConfig && dragId ? () => dragConfig.onItemDragTarget(dragId) : undefined}
            onDragOver={
              dragConfig && dragId
                ? (event) => {
                    event.preventDefault();
                    dragConfig.onItemDragTarget(dragId);
                  }
                : undefined
            }
            onDragStart={
              dragConfig && dragId
                ? (event) => dragConfig.onItemDragStart(event, dragId)
                : undefined
            }
            onDrop={
              dragConfig && dragId
                ? (event) => dragConfig.onItemDrop(event, dragId)
                : undefined
            }
            selected={itemSelected(item, index)}
            data-designer-tree-id={itemTestId?.(item, index)}
            title={itemTitle(item, index)}
          >
            {itemChildren?.(item, index)}
          </DesignerTreeChildButton>
        );
      })}
    </div>
  );
}

export function DesignerStructureChildBranchCard<T>({
  aside,
  bodyClassName = "pt-0.5",
  dataStateName,
  dataStateValue,
  expanded,
  headerClassName,
  itemChildren,
  itemKey,
  itemKicker,
  itemMeta,
  itemSelected,
  itemTitle,
  items,
  meta,
  metaItems,
  onItemClick,
  onSelect,
  onToggle,
  selected,
  subtitle,
  title
}: {
  aside?: ReactNode;
  bodyClassName?: string;
  dataStateName?: string;
  dataStateValue?: string;
  expanded: boolean;
  headerClassName?: string;
  itemChildren?: (item: T, index: number) => ReactNode;
  itemKey: (item: T, index: number) => string;
  itemKicker: (item: T, index: number) => string;
  itemMeta: (item: T, index: number) => string;
  itemSelected: (item: T, index: number) => boolean;
  itemTitle: (item: T, index: number) => ReactNode;
  items: T[];
  meta?: ReactNode;
  metaItems?: ReactNode[];
  onItemClick: (item: T, index: number) => void;
  onSelect: () => void;
  onToggle: () => void;
  selected: boolean;
  subtitle?: ReactNode;
  title: ReactNode;
}) {
  return (
    <DesignerStructureBranchCard
      aside={aside}
      blockList={
        <div className={bodyClassName}>
          <DesignerStructureChildList
            itemChildren={itemChildren}
            itemKey={itemKey}
            itemKicker={itemKicker}
            itemMeta={itemMeta}
            itemSelected={itemSelected}
            itemTitle={itemTitle}
            items={items}
            onItemClick={onItemClick}
          />
        </div>
      }
      dataStateName={dataStateName}
      dataStateValue={dataStateValue}
      expanded={expanded}
      headerClassName={headerClassName}
      meta={meta}
      metaItems={metaItems}
      onSelect={onSelect}
      onToggle={onToggle}
      selected={selected}
      subtitle={subtitle}
      title={title}
    />
  );
}

export function DesignerStructureBranchCard({
  aside,
  leading,
  beforeContent,
  blockList,
  className,
  dataStateName,
  dataStateValue,
  draggable = false,
  expanded,
  headerClassName,
  meta,
  metaItems,
  onDragEnd,
  onDragEnter,
  onDragOver,
  onDragStart,
  onDrop,
  onPointerDown,
  onSelect,
  onToggle,
  selected,
  subtitle,
  testId,
  title,
  afterContent
}: {
  aside?: ReactNode;
  leading?: ReactNode;
  beforeContent?: ReactNode;
  blockList?: ReactNode;
  className?: string;
  dataStateName?: string;
  dataStateValue?: string;
  draggable?: boolean;
  expanded: boolean;
  headerClassName?: string;
  meta?: ReactNode;
  metaItems?: ReactNode[];
  onDragEnd?: () => void;
  onDragEnter?: (event: DragEvent<HTMLElement>) => void;
  onDragOver?: (event: DragEvent<HTMLElement>) => void;
  onDragStart?: (event: DragEvent<HTMLElement>) => void;
  onDrop?: (event: DragEvent<HTMLElement>) => void;
  onPointerDown?: () => void;
  onSelect: () => void;
  onToggle: () => void;
  selected: boolean;
  subtitle?: ReactNode;
  testId?: string;
  title: ReactNode;
  afterContent?: ReactNode;
}) {
  const dataProps = dataStateName && dataStateValue ? { [dataStateName]: dataStateValue } : {};

  return (
    <DesignerTreeBranch
      {...dataProps}
      aside={aside}
      className={className}
      draggable={draggable}
      expanded={expanded}
      headerClassName={headerClassName}
      leading={leading}
      meta={meta}
      metaItems={metaItems}
      onDragEnd={onDragEnd}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragStart={onDragStart}
      onDrop={onDrop}
      onPointerDown={onPointerDown}
      onSelect={onSelect}
      onToggle={onToggle}
      selected={selected}
      surface="plain"
      subtitle={subtitle}
      testId={testId}
      title={title}
    >
      {beforeContent}
      {blockList}
      {afterContent}
    </DesignerTreeBranch>
  );
}

export function DesignerSectionBranchCard({
  blockDisplayLabel,
  blocks,
  categoryLabel: _categoryLabel,
  dragState,
  instanceKey,
  isExpanded,
  labelForSchema,
  onBlockDragStart,
  onBlockDragTarget,
  onBlockDrop,
  onChooseBlock,
  onChooseSection,
  onAddBlock,
  onDragEnd,
  onSectionPointerDown,
  onSectionDragStart,
  onSectionDragTarget,
  onSectionDrop,
  onToggleSectionExpanded,
  resolveBlockSchema,
  schema,
  schemaBlockCount: _schemaBlockCount,
  schemaMetaLine,
  section,
  sectionId,
  selectedSaasSectionSchemas,
  selection,
  sectionIndex: _sectionIndex
}: {
  blockDisplayLabel: (schema: ThemeBlockSchema | undefined, block: SectionBlockInstance, index: number) => string;
  blocks: SectionBlockInstance[];
  categoryLabel: (category?: string) => string;
  dragState: DesignerDragState | null;
  instanceKey: (item: { id?: string; type?: string }, index: number, prefix: string) => string;
  isExpanded: boolean;
  labelForSchema: (type: SectionType, schemas: Record<string, ThemeSectionSchema>) => string;
  onBlockDragStart: (event: DragEvent<HTMLElement>, sectionId: string, blockId: string) => void;
  onBlockDragTarget: (blockId: string) => void;
  onBlockDrop: (event: DragEvent<HTMLElement>, sectionId: string, targetBlockId: string) => void;
  onChooseBlock: (sectionId: string, blockId: string) => void;
  onChooseSection: (sectionId: string) => void;
  onAddBlock: (sectionId: string, blockSchema: ThemeBlockSchema) => void;
  onDragEnd: () => void;
  onSectionPointerDown: (sectionId: string) => void;
  onSectionDragStart: (event: DragEvent<HTMLElement>, sectionId: string) => void;
  onSectionDragTarget: (sectionId: string, position: "before" | "after") => void;
  onSectionDrop: (event: DragEvent<HTMLElement>, targetId: string) => void;
  onToggleSectionExpanded: (sectionId: string) => void;
  resolveBlockSchema: (schemas: Record<string, ThemeSectionSchema>, section: SectionInstance, blockType: string) => ThemeBlockSchema | undefined;
  schema: ThemeSectionSchema;
  schemaBlockCount: (schema: ThemeSectionSchema) => string;
  schemaMetaLine: (schema: ThemeSectionSchema) => string;
  section: SectionInstance;
  sectionId: string;
  selectedSaasSectionSchemas: Record<string, ThemeSectionSchema>;
  selection: Selection;
  sectionIndex: number;
}) {
  const showSectionDrop =
    (dragState?.kind === "section" && dragState.targetId === sectionId && dragState.id !== sectionId) ||
    (dragState?.kind === "librarySection" && dragState.targetId === sectionId);
  const sectionActive =
    (selection.kind === "section" && selection.sectionId === sectionId) ||
    (selection.kind === "block" && selection.sectionId === sectionId);

  return (
    <DesignerStructureBranchCard
      beforeContent={showSectionDrop && dragState?.position !== "after" ? (
        <div className="section-drop-slot pt-0.5">
          <div className="placeholder_9109 flex items-center">
            <span className="round_7aff h-3 w-3 shrink-0 rounded-full border-2 border-[#3369ff]" />
            <span className="line_3fa2 ml-[-2px] h-[3px] flex-1 bg-[#3369ff]" />
          </div>
        </div>
      ) : null}
      blockList={isExpanded ? (
        <>
          {blocks.length ? (
            <DesignerStructureBlockList
              blocks={blocks}
              dataLayout="xfcart-collapsible-block-tree"
              dragKind="block"
              dragState={dragState}
              instanceKey={instanceKey}
              itemKicker={() => ""}
              itemMeta={() => ""}
              itemTitle={(blockInstance, blockIndex) => {
                const blockSchema = resolveBlockSchema(selectedSaasSectionSchemas, section, blockInstance.type);
                return blockDisplayLabel(blockSchema, blockInstance, blockIndex);
              }}
              listKeyPrefix={sectionId}
              onBlockClick={(blockId) => onChooseBlock(sectionId, blockId)}
              onBlockDragStart={(event, blockId) => onBlockDragStart(event, sectionId, blockId)}
              onBlockDragTarget={onBlockDragTarget}
              onBlockDrop={(event, blockId) => onBlockDrop(event, sectionId, blockId)}
              onDragEnd={onDragEnd}
              selectedBlockId={selection.kind === "block" ? selection.blockId : undefined}
            />
          ) : null}
          {schema.blocks?.length ? (
            <div className="block__add_wrap_0265 pr-2">
              <DesignerBlockChooser
                blockSchemas={schema.blocks}
                onAddBlock={(blockSchema) => onAddBlock(sectionId, blockSchema)}
              />
            </div>
          ) : null}
        </>
      ) : null}
      className="cursor-grab active:cursor-grabbing"
      dataStateName="data-designer-section-expanded"
      dataStateValue={isExpanded ? "true" : "false"}
      draggable
      expanded={isExpanded}
      headerClassName=""
      meta={schemaMetaLine(schema)}
      metaItems={[]}
      onDragEnd={onDragEnd}
      onDragEnter={(event) => onSectionDragTarget(sectionId, sectionDropPosition(event))}
      onDragOver={(event) => {
        event.preventDefault();
        onSectionDragTarget(sectionId, sectionDropPosition(event));
      }}
      onDragStart={(event) => onSectionDragStart(event, sectionId)}
      onDrop={(event) => onSectionDrop(event, sectionId)}
      onPointerDown={() => onSectionPointerDown(sectionId)}
      onSelect={() => onChooseSection(sectionId)}
      onToggle={() => onToggleSectionExpanded(sectionId)}
      selected={sectionActive}
      subtitle={sectionPreviewLine(section)}
      aside={blocks.length > 0 ? `${blocks.length} 子块` : "仅字段"}
      testId={`section:${sectionId}`}
      title={<span className="truncate">{labelForSchema(section.type, selectedSaasSectionSchemas)}</span>}
      afterContent={showSectionDrop && dragState?.position === "after" ? (
        <div className="section-drop-slot pb-0.5">
          <div className="placeholder_9109 flex items-center">
            <span className="round_7aff h-3 w-3 shrink-0 rounded-full border-2 border-[#3369ff]" />
            <span className="line_3fa2 ml-[-2px] h-[3px] flex-1 bg-[#3369ff]" />
          </div>
        </div>
      ) : null}
    />
  );
}

export function DesignerGlobalBranchCard({
  blocks,
  dragState,
  globalSection,
  globalType,
  instanceKey,
  isExpanded,
  leading,
  linkCountLabel,
  onBlockDragStart,
  onBlockDragTarget,
  onBlockDrop,
  onChooseGlobal,
  onChooseGlobalBlock,
  onDragEnd,
  onToggle,
  resolveBlockSchema,
  selection,
  title
}: {
  blocks: SectionBlockInstance[];
  dragState: DesignerDragState | null;
  globalSection?: SectionInstance;
  globalType: "header" | "footer";
  instanceKey: (item: { id?: string; type?: string }, index: number, prefix: string) => string;
  isExpanded: boolean;
  leading?: ReactNode;
  linkCountLabel: string;
  onBlockDragStart: (event: DragEvent<HTMLElement>, globalType: "header" | "footer", blockId: string) => void;
  onBlockDragTarget: (blockId: string) => void;
  onBlockDrop: (event: DragEvent<HTMLElement>, globalType: "header" | "footer", targetBlockId: string) => void;
  onChooseGlobal: (globalType: "header" | "footer") => void;
  onChooseGlobalBlock: (globalType: "header" | "footer", blockId: string) => void;
  onDragEnd: () => void;
  onToggle: (globalType: "header" | "footer") => void;
  resolveBlockSchema: (section: SectionInstance, blockType: string) => ThemeBlockSchema | undefined;
  selection: Selection;
  title: string;
}) {
  const _selected = selection.kind === "global" && selection.globalType === globalType;
  const globalActive =
    (selection.kind === "global" && selection.globalType === globalType) ||
    (selection.kind === "globalBlock" && selection.globalType === globalType);
  const selectedBlockId = selection.kind === "globalBlock" && selection.globalType === globalType ? selection.blockId : undefined;

  return (
    <DesignerTreeCard
      className="mx-0"
      data-designer-global-expanded={isExpanded ? "true" : "false"}
      surface="plain"
      selected={globalActive}
    >
      <DesignerGlobalNodeButton
        aside={linkCountLabel}
        expanded={isExpanded}
        expandable
        leading={leading}
        onSelect={() => onChooseGlobal(globalType)}
        onToggle={() => onToggle(globalType)}
        selected={globalActive}
        title={title}
      />
      {blocks.length > 0 && isExpanded ? (
        <DesignerStructureBlockList
          blocks={blocks}
          dataLayout="xfcart-collapsible-global-block-tree"
          dragKind="globalBlock"
          dragState={dragState}
          instanceKey={instanceKey}
          itemKicker={() => ""}
          itemMeta={() => ""}
          itemTitle={(blockInstance, blockIndex) =>
            globalSection
              ? blockDisplayLabel(resolveBlockSchema(globalSection, blockInstance.type), blockInstance, blockIndex)
              : `${blockInstance.type} ${blockIndex + 1}`
          }
          listKeyPrefix={globalType}
          onBlockClick={(blockId) => onChooseGlobalBlock(globalType, blockId)}
          onBlockDragStart={(event, blockId) => onBlockDragStart(event, globalType, blockId)}
          onBlockDragTarget={onBlockDragTarget}
          onBlockDrop={(event, blockId) => onBlockDrop(event, globalType, blockId)}
          onDragEnd={onDragEnd}
          selectedBlockId={selectedBlockId}
        />
      ) : null}
    </DesignerTreeCard>
  );
}
