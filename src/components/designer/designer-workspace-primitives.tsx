"use client";

import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import {
  DesignerContextCard,
  DesignerInfoPill,
  DesignerPillGroup,
  DesignerPillButton,
  DesignerStatePill
} from "@/components/designer/designer-sidebar-primitives";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function DesignerWorkspaceShell({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <aside
      className={cx("wrapper_right flex h-full w-[454px] shrink-0 flex-col border-l border-[#c4c7cc] bg-[#d7dce4] pl-[6px] shadow-none", className)}
      data-designer-layout="saas-right-editor-pane"
      {...props}
    >
      <div className="saas-mobile-workbench-title" data-designer-layout="saas-mobile-workbench-title">
        <span>店铺装修工作台</span>
        <strong>SaaS section / block editor</strong>
      </div>
      {children}
    </aside>
  );
}

export function DesignerWorkspaceTabsBar({
  children,
  actions,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  actions?: ReactNode;
}) {
  return (
    <div className={cx("tools_tab grid h-[52px] shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-[#c4c7cc] bg-white px-0 py-0 shadow-none", className)} data-designer-layout="saas-editor-tabs-bar" {...props}>
      <div />
      <div className="flex items-center justify-center">{children}</div>
      <div className="flex items-center justify-end gap-1 pr-2">{actions}</div>
    </div>
  );
}

export function DesignerWorkspaceSplit({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("wrap-tabs-content grid h-full min-h-0 grid-cols-[156px_298px]", className)} data-designer-layout="saas-editor-split" {...props}>
      {children}
    </div>
  );
}

export function DesignerWorkspaceRail({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("side_bar_c051 min-h-0 overflow-hidden bg-[#d7dce4] pr-[6px]", className)} data-designer-layout="saas-editor-rail" {...props}>
      {children}
    </div>
  );
}

export function DesignerWorkspaceInspector({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("setting_tabpane my-[6px] min-h-0 overflow-hidden rounded-l-[8px] border border-[#c4c7cc] bg-white shadow-none", className)} data-designer-layout="saas-editor-inspector" {...props}>
      {children}
    </div>
  );
}

export function DesignerWorkspaceContextSummary({
  eyebrow,
  title,
  description,
  stateLabel,
  stateTone = "neutral",
  meta = [],
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  eyebrow: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  stateLabel?: ReactNode;
  stateTone?: "neutral" | "draft" | "live";
  meta?: ReactNode[];
}) {
  return (
    <DesignerContextCard
      aside={stateLabel ? <DesignerStatePill label={stateLabel} tone={stateTone} /> : null}
      className={className}
      description={description}
      eyebrow={eyebrow}
      footer={
        meta.length ? (
          <DesignerPillGroup>
            {meta.map((item, index) => (
              <DesignerInfoPill key={index} label={item} />
            ))}
          </DesignerPillGroup>
        ) : null
      }
      title={title}
      {...props}
    />
  );
}

export function DesignerWorkspaceRailToolbar({
  metrics = [],
  actions,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  metrics?: ReactNode[];
  actions?: ReactNode;
}) {
  const visibleMetrics = metrics.filter(Boolean);
  return (
    <div className={cx("flex items-center justify-between gap-2 px-2 py-1 text-[11px] text-[#6b7282]", className)} {...props}>
      {visibleMetrics.length ? (
        <DesignerPillGroup className="min-w-0 gap-1">
          {visibleMetrics.map((metric, index) => (
            <DesignerInfoPill className="border-0 bg-transparent px-0 py-0" key={index} label={metric} />
          ))}
        </DesignerPillGroup>
      ) : <span />}
      {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
    </div>
  );
}

export function DesignerWorkspaceRailToggleActions({
  onExpandAll,
  onCollapseAll
}: {
  onExpandAll: () => void;
  onCollapseAll: () => void;
}) {
  return (
    <>
      <DesignerPillButton onClick={onExpandAll}>展开</DesignerPillButton>
      <DesignerPillButton onClick={onCollapseAll}>收起</DesignerPillButton>
    </>
  );
}

export function DesignerWorkspaceUtilityButton({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cx(
        "inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-[8px] border border-[#d8dbe1] bg-white px-3 text-[11px] font-medium leading-none text-[#383838] transition hover:bg-[#f7f8fb] focus-visible:outline-none active:scale-[0.98]",
        className
      )}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}
