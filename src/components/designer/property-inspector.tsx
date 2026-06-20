"use client";

import type { ReactNode } from "react";

export function PropertyInspector({
  hasSelection,
  children,
  selectionScope,
  selectedSectionId,
  selectedBlockId,
  selectedGlobalType,
  selectedGlobalNode
}: {
  hasSelection: boolean;
  children: ReactNode;
  selectionScope?: string;
  selectedSectionId?: string;
  selectedBlockId?: string;
  selectedGlobalType?: string;
  selectedGlobalNode?: string;
  products?: unknown[];
  siteAiApps?: unknown[];
  mediaAssets?: unknown[];
}) {
  return (
    <div
      className="widget_layout flex h-full min-h-0 flex-col bg-white text-[#212121]"
      data-designer-layout="saas-property-inspector-panel"
      data-designer-selected-block-id={selectedBlockId}
      data-designer-selected-global-node={selectedGlobalNode}
      data-designer-selected-global-type={selectedGlobalType}
      data-designer-selected-scope={selectionScope}
      data-designer-selected-section-id={selectedSectionId}
    >
      <div className="min-h-0 flex-1 overflow-hidden" data-designer-layout="saas-property-inspector-inline">
        {hasSelection ? (
          children
        ) : (
          <div className="widget_settings p-0">
            <div className="ant-form-item px-5 py-5 text-sm leading-6 text-[#667085]">
              选择左侧模块或子块后，在这里编辑字段。
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
