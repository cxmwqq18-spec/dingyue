"use client";

import type { ComponentProps } from "react";
import { GlobalTree } from "@/components/designer/global-tree";
import { PageTree } from "@/components/designer/page-tree";
import { SectionTree } from "@/components/designer/section-tree";
import type { DesignerWorkspaceTab } from "@/components/designer/designer-workspace-pane";

export function DesignerWorkspaceNavigator({
  activeTab,
  pageTreeProps,
  sectionTreeProps,
  globalTreeProps
}: {
  activeTab: DesignerWorkspaceTab;
  pageTreeProps?: ComponentProps<typeof PageTree>;
  sectionTreeProps: ComponentProps<typeof SectionTree>;
  globalTreeProps: ComponentProps<typeof GlobalTree>;
}) {
  if (activeTab === "global") {
    return <GlobalTree {...globalTreeProps} chrome="bare" />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {pageTreeProps ? (
        <div className="shrink-0 px-0 pb-1">
          <PageTree
            {...pageTreeProps}
            density="compact"
            mode="switcher"
            showHeader={false}
            surface="plain"
          />
          <div className="max-h-[38vh] overflow-y-auto border-b border-[#c4c7cc] px-1.5 py-1.5">
            <PageTree
              {...pageTreeProps}
              density="compact"
              mode="directory"
              showHeader
              surface="plain"
            />
          </div>
        </div>
      ) : null}
      <div className="min-h-0 flex-1">
        <SectionTree
          {...sectionTreeProps}
          activePage={pageTreeProps?.activePage ?? sectionTreeProps.activePage}
          chrome="bare"
        />
      </div>
    </div>
  );
}
