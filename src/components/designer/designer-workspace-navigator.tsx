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
  if (activeTab === "publish") {
    return (
      <div className="flex h-full min-h-0 flex-col bg-[#d7dce4] px-2 py-3 text-[#475467]" data-designer-layout="saas-publish-check-rail">
        <p className="text-[12px] font-semibold text-[#1f2937]">发布检查</p>
        <p className="mt-1 text-[11px] leading-5">
          右侧会列出本次一起上线的范围。保存草稿不会上线，点击发布后才会更新整站线上快照。
        </p>
        <div className="mt-3 grid gap-2 text-[11px] leading-5">
          <span className="rounded-[6px] border border-[#d9dde4] bg-white px-2 py-2">1. 保存页面和全局草稿</span>
          <span className="rounded-[6px] border border-[#d9dde4] bg-white px-2 py-2">2. 确认隐藏草稿数量</span>
          <span className="rounded-[6px] border border-[#d9dde4] bg-white px-2 py-2">3. 发布整站快照</span>
        </div>
      </div>
    );
  }

  if (activeTab === "global") {
    return <GlobalTree {...globalTreeProps} chrome="bare" />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden" data-designer-layout="saas-workspace-navigator-root">
      {pageTreeProps ? (
        <div className="flex min-h-0 shrink-0 basis-[38%] flex-col overflow-hidden px-0 pb-1" data-designer-layout="saas-page-directory-wrapper">
          <div
            className="min-h-0 flex-1 overflow-y-auto border-b border-[#c4c7cc] px-1.5 py-1.5"
            data-designer-layout="saas-page-directory-scroll"
          >
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
