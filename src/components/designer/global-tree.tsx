"use client";

import { type DragEvent, type ReactNode } from "react";
import {
  DesignerGlobalBranchCard
} from "@/components/designer/designer-structure-primitives";
import {
  DesignerGlobalNodeButton,
  DesignerPillButton,
  DesignerTreeCard,
  DesignerSidebarPanel,
} from "@/components/designer/designer-sidebar-primitives";
import type {
  DesignerDragState,
  GlobalSettingsNodeDefinition,
  GlobalType,
  Selection
} from "@/components/designer/designer-types";
import type { SectionBlockInstance, SectionInstance, ThemeBlockSchema, ThemeNavLink } from "@/lib/types";

function globalLabel(globalType: GlobalType): string {
  return globalType === "header" ? "页眉" : "页脚";
}

function saasGlobalSpecIcon(): ReactNode {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M381.298 418.828h-157.703l-37.575 38.272 155.61 158.377-278.212 345.128 356.04-265.838 154.71 157.41 38.813-39.51 2.407-157.972 238.838-313.29 71.685 73.013 34.695-35.28-310.185-315.743-34.672 35.257 77.287 79.402-311.737 240.773z"
        fill="currentColor"
      />
    </svg>
  );
}

function globalNodeIcon(node: GlobalSettingsNodeDefinition): ReactNode {
  if (node.kind === "globalSection") return saasGlobalSpecIcon();
  return saasGlobalSpecIcon();
}

export function GlobalTree({
  dragState,
  expandedGlobals,
  globalNodes,
  instanceKey,
  onChooseGlobal,
  onChooseGlobalBlock,
  onChooseGlobalSettings,
  onGlobalBlockDragStart,
  onGlobalBlockDragTarget,
  onGlobalBlockDrop,
  onDragEnd,
  onSetAllGlobalsExpanded,
  onToggleGlobalExpanded,
  resolveBlockSchema,
  safeBlocks,
  selection,
  themeSettings,
  chrome = "full"
}: {
  dragState: DesignerDragState | null;
  expandedGlobals: Record<GlobalType, boolean>;
  globalNodes: GlobalSettingsNodeDefinition[];
  instanceKey: (item: { id?: string; type?: string }, index: number, prefix: string) => string;
  onChooseGlobal: (globalType: GlobalType) => void;
  onChooseGlobalBlock: (globalType: GlobalType, blockId: string) => void;
  onChooseGlobalSettings: (node: GlobalSettingsNodeDefinition["id"]) => void;
  onGlobalBlockDragStart: (event: DragEvent<HTMLElement>, globalType: GlobalType, blockId: string) => void;
  onGlobalBlockDragTarget: (blockId: string) => void;
  onGlobalBlockDrop: (event: DragEvent<HTMLElement>, globalType: GlobalType, targetBlockId: string) => void;
  onDragEnd: () => void;
  onSetAllGlobalsExpanded: (expanded: boolean) => void;
  onToggleGlobalExpanded: (globalType: GlobalType) => void;
  resolveBlockSchema: (section: SectionInstance, blockType: string) => ThemeBlockSchema | undefined;
  safeBlocks: (section?: SectionInstance) => SectionBlockInstance[];
  selection: Selection;
  themeSettings: {
    navigation: {
      headerLinks: ThemeNavLink[];
      footerLinks: ThemeNavLink[];
    };
    globalSections?: {
      header?: SectionInstance;
      footer?: SectionInstance;
    };
  };
  chrome?: "full" | "bare";
}) {
  const totalGlobalBlocks =
    safeBlocks(themeSettings.globalSections?.header).length + safeBlocks(themeSettings.globalSections?.footer).length;

  return (
    <DesignerSidebarPanel
      actions={chrome === "full" ? (
        <>
          <DesignerPillButton onClick={() => onSetAllGlobalsExpanded(true)}>展开</DesignerPillButton>
          <DesignerPillButton onClick={() => onSetAllGlobalsExpanded(false)}>收起</DesignerPillButton>
        </>
      ) : undefined}
      chrome={chrome}
      meta={chrome === "full" ? `${globalNodes.length} 个主题节点 / ${totalGlobalBlocks} 个全局子块` : undefined}
      scrollClassName={chrome === "bare" ? "pb-1" : undefined}
      summary="品牌、颜色、字体、按钮、导航、页眉、页脚、SEO 默认项与社媒链接。"
      summaryEyebrow="全局节点"
      title="全局配置"
      className="global_5bc8"
    >
        <div className="grid gap-0.5">
          {globalNodes.map((node) => {
            if (node.kind === "globalSection" && node.globalType) {
              const globalSection = themeSettings.globalSections?.[node.globalType];
              const blocks = safeBlocks(globalSection);
              const isExpanded = expandedGlobals[node.globalType];
              return (
                <DesignerGlobalBranchCard
                  blocks={blocks}
                  dragState={dragState}
                  globalSection={globalSection}
                  globalType={node.globalType}
                  instanceKey={instanceKey}
                  isExpanded={isExpanded}
                  key={node.id}
                  leading={globalNodeIcon(node)}
                  linkCountLabel={
                    chrome === "full"
                      ? node.globalType === "header"
                        ? `${themeSettings.navigation.headerLinks.length} 条导航`
                        : `${themeSettings.navigation.footerLinks.length} 条导航`
                      : ""
                  }
                  onBlockDragStart={onGlobalBlockDragStart}
                  onBlockDragTarget={onGlobalBlockDragTarget}
                  onBlockDrop={onGlobalBlockDrop}
                  onChooseGlobal={onChooseGlobal}
                  onChooseGlobalBlock={onChooseGlobalBlock}
                  onDragEnd={onDragEnd}
                  onToggle={onToggleGlobalExpanded}
                  resolveBlockSchema={resolveBlockSchema}
                  selection={selection}
                  title={globalLabel(node.globalType)}
                />
              );
            }

            const selected = selection.kind === "globalSettings" && selection.node === node.id;
            return (
              <DesignerTreeCard className="mx-0" key={node.id} selected={selected} surface="plain">
                <DesignerGlobalNodeButton
                  leading={globalNodeIcon(node)}
                  onSelect={() => onChooseGlobalSettings(node.id)}
                  selected={selected}
                  title={node.label}
                />
              </DesignerTreeCard>
            );
          })}
        </div>
    </DesignerSidebarPanel>
  );
}
