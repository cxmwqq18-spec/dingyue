"use client";

import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { DesignerPropertyPane } from "@/components/designer/designer-property-pane";
import { PageTree } from "@/components/designer/page-tree";
import { DesignerModeTabs } from "@/components/designer/designer-sidebar-primitives";
import { DesignerWorkspaceNavigator } from "@/components/designer/designer-workspace-navigator";
import {
  DesignerWorkspaceInspector,
  DesignerWorkspaceRail,
  DesignerWorkspaceShell,
  DesignerWorkspaceSplit,
  DesignerWorkspaceTabsBar
} from "@/components/designer/designer-workspace-primitives";
import { GlobalTree } from "@/components/designer/global-tree";
import { SectionTree } from "@/components/designer/section-tree";

export type DesignerWorkspaceTab = "templates" | "global" | "publish";

export function DesignerWorkspacePane({
  activeTab,
  onTabChange,
  headerActions,
  mobileThemeApplyControl,
  mobileActions,
  pageTreeProps,
  sectionTreeProps,
  globalTreeProps,
  propertyPaneProps
}: {
  activeTab: DesignerWorkspaceTab;
  onTabChange: (tab: DesignerWorkspaceTab) => void;
  headerActions?: ReactNode;
  mobileThemeApplyControl?: ReactNode;
  mobileActions?: {
    adminHref: string;
    storefrontHref: string;
    dirtyPagesCount: number;
    currentPageDirty: boolean;
    publishedVersion: number;
    onSaveDraft: () => void;
    onPublishDraft: () => void;
    onRollback: () => void;
  };
  pageTreeProps?: ComponentProps<typeof PageTree>;
  sectionTreeProps: ComponentProps<typeof SectionTree>;
  globalTreeProps: ComponentProps<typeof GlobalTree>;
  propertyPaneProps: ComponentProps<typeof DesignerPropertyPane>;
}) {
  return (
    <DesignerWorkspaceShell>
      {mobileActions ? (
        <div className="saas-mobile-workbench-actions" data-designer-layout="saas-mobile-workbench-actions">
          <div className="min-w-0 flex-1">
            <p>当前页面：{pageTreeProps?.activePage.title ?? sectionTreeProps.activePage.title}</p>
            <span>{mobileActions.currentPageDirty ? "草稿待发布" : "已与线上同步"} · 待发布页面 {mobileActions.dirtyPagesCount} · 线上 v{mobileActions.publishedVersion}</span>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            <Link href={mobileActions.adminHref}>后台</Link>
            <Link href={mobileActions.storefrontHref}>前台</Link>
            <button onClick={mobileActions.onRollback} type="button">回滚</button>
            <button onClick={mobileActions.onSaveDraft} type="button">保存</button>
            <button data-tone="primary" onClick={mobileActions.onPublishDraft} type="button">发布</button>
          </div>
        </div>
      ) : null}
      {mobileThemeApplyControl ? (
        <div className="saas-mobile-theme-package-strip" data-designer-layout="saas-mobile-theme-package-strip">
          {mobileThemeApplyControl}
        </div>
      ) : null}
      <DesignerWorkspaceTabsBar actions={headerActions}>
        <DesignerModeTabs
          active={activeTab}
          items={[
            { key: "templates", label: "当前页面" },
            { key: "global", label: "全局页头/页脚" },
            { key: "publish", label: "发布检查" }
          ]}
          onValueChange={onTabChange}
          surface="bare"
          tone="pill"
        />
      </DesignerWorkspaceTabsBar>

      <div className="min-h-0 flex-1">
        <DesignerWorkspaceSplit>
          <DesignerWorkspaceRail>
            <DesignerWorkspaceNavigator
              activeTab={activeTab}
              globalTreeProps={globalTreeProps}
              pageTreeProps={pageTreeProps}
              sectionTreeProps={sectionTreeProps}
            />
          </DesignerWorkspaceRail>

          <DesignerWorkspaceInspector>
            <DesignerPropertyPane {...propertyPaneProps} />
          </DesignerWorkspaceInspector>
        </DesignerWorkspaceSplit>
      </div>
    </DesignerWorkspaceShell>
  );
}
