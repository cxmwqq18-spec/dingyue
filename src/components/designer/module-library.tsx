"use client";

import { type DragEvent } from "react";
import { GripVertical, Plus } from "lucide-react";
import { moduleGroupLabel } from "@/components/designer/designer-metadata";
import {
  DesignerCatalogItem,
  DesignerEditorSummary,
  DesignerInfoPill,
  DesignerPopoverOptionList,
  DesignerPillGroup,
  DesignerSubpanel,
  DesignerTreeScrollArea
} from "@/components/designer/designer-sidebar-primitives";
import type { SectionType, ThemeSectionSchema } from "@/lib/types";

export type ModuleLibrarySchemaGroup = {
  title: string;
  source: string;
  groups: Array<[string, SectionType[]]>;
};

export function ModuleLibrary({
  categoryOrder,
  labelForSchema,
  onAddSection,
  onDragEnd,
  onLibrarySectionDragStart,
  query = "",
  schemaBlockCount,
  schemaForType,
  schemaGroups,
  selectedSaasSectionSchemas,
  showIntro = true,
  variant = "panel"
}: {
  categoryOrder: string[];
  labelForSchema: (type: SectionType, schemas: Record<string, ThemeSectionSchema>) => string;
  onAddSection: (type: SectionType) => void;
  onDragEnd: () => void;
  onLibrarySectionDragStart: (event: DragEvent<HTMLElement>, type: SectionType) => void;
  query?: string;
  schemaBlockCount: (schema: ThemeSectionSchema) => string;
  schemaForType: (type: SectionType) => ThemeSectionSchema;
  schemaGroups: ModuleLibrarySchemaGroup[];
  selectedSaasSectionSchemas: Record<string, ThemeSectionSchema>;
  showIntro?: boolean;
  variant?: "panel" | "popover";
}) {
  const normalizedQuery = query.trim().toLowerCase();
  const filteredSchemaGroups = normalizedQuery
    ? schemaGroups
        .map((sourceGroup) => ({
          ...sourceGroup,
          groups: sourceGroup.groups
            .map(([group, types]) => {
              const nextTypes = types.filter((type) => {
                const schema = schemaForType(type);
                const label = labelForSchema(type, selectedSaasSectionSchemas).toLowerCase();
                const haystacks = [
                  group,
                  schema.description,
                  schema.category,
                  schema.saasPresetCategory,
                  schema.saasRawName,
                  schema.sourceFile,
                  label
                ]
                  .filter(Boolean)
                  .join(" ")
                  .toLowerCase();
                return haystacks.includes(normalizedQuery);
              });
              return [group, nextTypes] as [string, SectionType[]];
            })
            .filter(([, types]) => types.length > 0)
        }))
        .filter((sourceGroup) => sourceGroup.groups.length > 0)
    : schemaGroups;
  const hasResults = filteredSchemaGroups.some((sourceGroup) => sourceGroup.groups.some(([, types]) => types.length > 0));
  const compact = variant === "popover";

  if (compact) {
    const seenTypes = new Set<string>();
    const flatItems = filteredSchemaGroups.flatMap((sourceGroup) =>
      sourceGroup.groups.flatMap(([group, types]) =>
        types.flatMap((type) => {
          if (seenTypes.has(type)) return [];
          seenTypes.add(type);
          return [{
            type,
            group,
            schema: schemaForType(type)
          }];
        })
      )
    );

    return (
      <div className="max-h-[56dvh] overflow-x-hidden overflow-y-auto bg-white">
        {hasResults ? (
          <div className="popover_inner_content_2e58">
            <DesignerPopoverOptionList
              className="gap-0"
              itemKey={(item) => `${item.group}_${item.type}`}
              itemSelected={() => false}
              itemTitle={(item) => labelForSchema(item.type, selectedSaasSectionSchemas)}
              items={flatItems}
              onItemClick={(item) => onAddSection(item.type)}
              variant="flat"
            />
          </div>
        ) : (
          <div className="rounded-[4px] border border-dashed border-zinc-300 bg-white px-4 py-6 text-center text-sm text-zinc-500">
            没有匹配到模块。
          </div>
        )}
      </div>
    );
  }

  return (
    <DesignerTreeScrollArea
      className={[
        "max-h-[40dvh] border-b border-zinc-200 p-4 pr-0",
        "min-h-0"
      ].join(" ")}
    >
      {showIntro ? (
        <>
          <h2 className="text-base font-semibold">模块库</h2>
          <p className="mt-1 text-xs text-zinc-500">拖入结构区，或直接添加到页面。</p>

          <DesignerEditorSummary
            className="mt-3"
            eyebrow="模块分组"
            summary={
              <DesignerPillGroup>
                {categoryOrder.map((category) => (
                  <DesignerInfoPill key={category} label={category} />
                ))}
                <DesignerInfoPill label="AI 订阅业务积木" />
              </DesignerPillGroup>
            }
          />
        </>
      ) : null}

      <div className={`grid gap-4 ${showIntro ? "mt-4" : "mt-3"} ${compact ? "pr-2" : "pr-4"}`}>
        {hasResults ? filteredSchemaGroups.map((sourceGroup) => (
          <DesignerSubpanel
            className={sourceGroup.source === "dreamshoot" ? "border-zinc-950 ring-1 ring-zinc-950/5" : undefined}
            count={sourceGroup.groups.reduce((total, [, types]) => total + types.length, 0)}
            key={sourceGroup.source}
            title={sourceGroup.title}
          >
            <div className="grid gap-4">
              {sourceGroup.groups.map(([group, types]) => (
                <div key={`${sourceGroup.source}_${group}`}>
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-400">{moduleGroupLabel(group)}</p>
                  <div className="grid gap-2">
                    {types.map((type) => {
                      const schema = schemaForType(type);
                      return (
                        <DesignerCatalogItem
                          action={
                            <button
                              className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] border border-zinc-200 bg-zinc-50 text-zinc-500 transition hover:bg-zinc-950 hover:text-white"
                              onClick={(event) => {
                                event.preventDefault();
                                onAddSection(type);
                              }}
                              title="追加到页面底部"
                              type="button"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          }
                          badges={
                            <>
                              <DesignerInfoPill label={schema.saasPresetCategory || schema.category} />
                              <DesignerInfoPill label={schemaBlockCount(schema)} />
                            </>
                          }
                          className={
                            sourceGroup.source === "dreamshoot" ? "border-zinc-300 hover:border-zinc-950" : "border-zinc-200 hover:border-zinc-300"
                          }
                          description={schema.description.replace(/^Imported from SaaS [^ ]+ /, "").replace(/\.$/, "")}
                          draggable
                          key={type}
                          onDragEnd={onDragEnd}
                          onDragStart={(event) => onLibrarySectionDragStart(event, type)}
                          title={
                            <span className="flex min-w-0 items-center gap-2">
                              <GripVertical className="h-4 w-4 shrink-0 text-zinc-300 transition group-hover:text-zinc-500" strokeWidth={1.8} />
                              <span className="truncate">{labelForSchema(type, selectedSaasSectionSchemas)}</span>
                            </span>
                          }
                        >
                          <span className="mt-1 hidden font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400">
                            {schema.source === "saas-theme" || schema.source === "saas-theme1" ? schema.sourceFile : "ai subscription"}
                          </span>
                          {schema.saasRawName ? (
                            <span className="mt-1 hidden font-mono text-[10px] text-zinc-400">raw section: {schema.saasRawName}</span>
                          ) : null}
                        </DesignerCatalogItem>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </DesignerSubpanel>
        )) : (
          <div className="rounded-[12px] border border-dashed border-zinc-300 bg-white px-4 py-6 text-center text-sm text-zinc-500">
            没有匹配到模块。
          </div>
        )}
      </div>
    </DesignerTreeScrollArea>
  );
}
