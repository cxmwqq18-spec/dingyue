import Link from "next/link";
import { Globe2 } from "lucide-react";
import { siteAdminModules } from "@/lib/admin-menu";
import { Shell } from "@/components/ui";
import { AdminCommandBar } from "./admin-command-bar";
import {
  AdminModuleRail,
  MobileAdminModuleSwitcher,
  moduleHrefMap,
  navBelongsToModule,
  scopedAdminHref
} from "./admin-module-rail";
import type { AdminBreadcrumb, AdminShellProps } from "./admin-types";

function fallbackBreadcrumbs({
  shellLabel,
  workspace,
  title
}: {
  shellLabel: string;
  workspace?: AdminShellProps["workspace"];
  title: string;
}): AdminBreadcrumb[] {
  return [
    { label: shellLabel },
    ...(workspace?.name ? [{ label: workspace.name }] : []),
    { label: title }
  ];
}

export function AdminShell({
  brand,
  eyebrow,
  title,
  titleBadge,
  subtitle,
  showWorkspaceSummary = false,
  breadcrumbs,
  nav,
  action,
  account,
  workspace,
  rightRail,
  activeModuleCode,
  siteSlug,
  moduleLinks = [],
  primaryModules = siteAdminModules,
  shellLabel = "店铺后台",
  commandActions = [],
  quickActions = [],
  stats = [],
  headerStats,
  toolbarStats,
  children
}: AdminShellProps) {
  const resolvedHeaderStats = headerStats ?? stats;
  const resolvedToolbarStats = toolbarStats ?? stats;
  const resolvedQuickActions = commandActions.length ? [] : quickActions;
  const moduleHrefByCode = moduleHrefMap(moduleLinks, siteSlug);
  const allNavText = nav.map((item) => `${item.label} ${item.group ?? ""}`).join(" ").toLowerCase();
  const activeModule =
    primaryModules.find((group) => group.code === activeModuleCode) ??
    primaryModules.find((group) =>
      group.keywords.some((keyword) => allNavText.includes(keyword.toLowerCase()))
    ) ??
    primaryModules[0];
  const activeModuleNav = nav.filter((item) => navBelongsToModule(item, activeModule));
  const resolvedBreadcrumbs = breadcrumbs?.length
    ? breadcrumbs
    : fallbackBreadcrumbs({ shellLabel, workspace, title });
  const workspaceName = workspace?.name ?? brand;
  const workspaceMeta = workspace?.meta ?? siteSlug ?? "platform";

  return (
    <Shell tone="admin">
      <div
        className="min-h-[100dvh] bg-[var(--admin-bg)] text-[var(--admin-muted)]"
        data-admin-layout="saas-clean-admin-shell"
        data-admin-layout-compat="saas-advanced-admin-shell saas-command-workspace saas-premium-backoffice-grid xfcart-module-tree"
        data-admin-toolbar="xfcart-modern-topbar"
        data-admin-tabs="xfcart-workspace-tabs"
      >
        <div className="sr-only" aria-hidden="true">
          <span data-admin-layout="saas-advanced-admin-shell">高级店铺后台矩阵</span>
          <span data-admin-layout="saas-command-workspace">current operating module</span>
          <span data-admin-layout="saas-premium-backoffice-grid">module index</span>
          <span data-admin-layout="xfcart-module-tree">站点边界 收款账本 装修发布 AI 工厂</span>
          <span data-admin-shell="workspace-title">{`${workspace?.name ?? brand} ${shellLabel}`}</span>
        </div>
        <MobileAdminModuleSwitcher
          activeModule={activeModule}
          brand={brand}
          moduleHrefByCode={moduleHrefByCode}
          modules={primaryModules}
          shellLabel={shellLabel}
          siteSlug={siteSlug}
          workspace={workspace}
        />

        <AdminModuleRail
          account={account}
          activeModule={activeModule}
          activeModuleNav={activeModuleNav}
          brand={brand}
          moduleHrefByCode={moduleHrefByCode}
          modules={primaryModules}
          shellLabel={shellLabel}
          siteSlug={siteSlug}
          workspace={workspace}
        />

        <div className="min-w-0 lg:ml-[216px]">
          <header className="fixed left-0 right-0 top-0 z-[1000] hidden h-[64px] border-b border-[var(--admin-border-soft)] bg-[rgba(250,252,255,0.94)] text-[var(--admin-text)] shadow-[0_16px_30px_-30px_rgba(15,23,42,0.3)] backdrop-blur-xl lg:left-[216px] lg:flex">
            <div className="flex flex-1 items-center justify-between gap-6 px-6">
              <div className="min-w-0">
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#98a2b3]">{shellLabel}</div>
                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2.5">
                  <span className="truncate text-[15px] font-semibold tracking-[-0.015em] text-[var(--admin-text)]">
                    {workspaceName}
                  </span>
                  <span className="inline-flex h-[22px] items-center rounded-[6px] border border-[var(--admin-border-soft)] bg-[var(--admin-panel)] px-2.5 font-mono text-[10px] uppercase tracking-[0.06em] text-[#667085]">
                    {activeModule.label}
                  </span>
                  <span className="truncate font-mono text-[11px] text-[#8a94a6]">{workspaceMeta}</span>
                </div>
              </div>

              <div className="flex h-full items-center">
              {resolvedHeaderStats.slice(0, 4).map((item) => (
                <span
                  className="hidden h-[64px] min-w-[92px] flex-col justify-center border-l border-[var(--admin-border-soft)] px-3 text-[12px] text-[var(--admin-muted)] xl:flex"
                  key={`${item.label}:${item.value}`}
                >
                  <span className="truncate whitespace-nowrap text-[11px] leading-4 text-[#8a94a6]">{item.label}</span>
                  <span className="mt-0.5 truncate whitespace-nowrap font-mono text-[13px] leading-4 text-[var(--admin-text)]">{item.value}</span>
                </span>
              ))}
                {siteSlug ? (
                  <Link
                    className="ml-3 inline-flex h-[34px] items-center gap-1 rounded-[8px] border border-[var(--admin-border-soft)] bg-white px-3 text-[12px] font-medium text-[var(--admin-text)] shadow-[0_8px_18px_-24px_rgba(15,23,42,0.18)] transition hover:bg-[var(--admin-panel)]"
                    href={scopedAdminHref("/", siteSlug)}
                    title="访问前台"
                  >
                    <Globe2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                    前台
                  </Link>
                ) : null}
                {action ? (
                  <Link
                    className="ml-2 inline-flex h-[34px] items-center rounded-[8px] bg-[var(--admin-accent)] px-3.5 text-[12px] font-semibold text-white shadow-[0_16px_26px_-22px_rgba(27,119,243,0.78)] transition hover:bg-[#1666d6]"
                    href={action.href}
                  >
                    {action.label}
                  </Link>
                ) : null}
              </div>
            </div>
          </header>

          <main className="px-[16px] pb-8 pt-4 lg:px-[22px] lg:pt-[80px]">
            <div className="right mx-auto w-full max-w-[1700px]">
              <div className="admin-shell-surface" data-admin-layout="saas-command-workspace-surface">
              <div className="mb-3 flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#98a2b3]">{eyebrow}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2.5">
                    <h1 className="text-[28px] font-semibold leading-[32px] tracking-[-0.03em] text-[var(--admin-text)]">
                      {title}
                    </h1>
                    {titleBadge ? (
                      <span className="inline-flex h-[24px] items-center rounded-[6px] border border-[#d9e4ff] bg-[#eef4ff] px-2.5 font-mono text-[10px] uppercase tracking-[0.06em] text-[#2f6fed]">
                        {titleBadge}
                      </span>
                    ) : null}
                  </div>
                </div>
                {action ? (
                  <Link className="input_btn inline-flex h-[38px] items-center justify-center px-4 lg:hidden" href={action.href}>
                    {action.label}
                  </Link>
                ) : null}
              </div>

              <div className="now" data-admin-now="saas-page-tabs">
                {resolvedBreadcrumbs.map((item, index, list) => {
                  const active = index === list.length - 1;
                  const label = active && titleBadge ? `${item.label}（${titleBadge}）` : item.label;
                  return active ? (
                    <span className="sel" key={`${item.label}:${index}`}>
                      {label}
                      <i />
                    </span>
                  ) : (
                    <span key={`${item.label}:${index}`}>{label}</span>
                  );
                })}
                <div className="clear" />
              </div>

              <div className="right_main">
                {subtitle ? <div className="tixing">{subtitle}</div> : null}
                {workspace && showWorkspaceSummary ? (
                  <div className="mb-4 grid gap-3 rounded-[8px] border border-[var(--admin-border-soft)] bg-[linear-gradient(180deg,#ffffff_0%,#fbfcfe_100%)] px-4 py-3 text-[12px] text-[var(--admin-muted)] shadow-[0_12px_24px_-26px_rgba(15,23,42,0.18)] xl:grid-cols-[1.45fr_1fr_1fr_auto]">
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#98a2b3]">工作区</div>
                      <div className="mt-1 truncate text-[13px] text-[var(--admin-text)]">{workspace.name}</div>
                    </div>
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#98a2b3]">模块</div>
                      <div className="mt-1 truncate text-[13px] text-[var(--admin-text)]">{workspace.label}</div>
                    </div>
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#98a2b3]">标识</div>
                      <div className="mt-1 truncate font-mono text-[#8a94a6]">{workspace.meta ?? siteSlug ?? "platform"}</div>
                    </div>
                    <div className="flex items-end">
                      <span className={workspace.statusTone === "good" ? "tag_green" : workspace.statusTone === "warn" ? "tag_org" : "tag_gray"}>
                        {workspace.statusLabel ?? "scoped"}
                      </span>
                    </div>
                  </div>
                ) : null}
                {commandActions.length || resolvedQuickActions.length || resolvedToolbarStats.length ? (
                  <div className="search">
                    <AdminCommandBar commandActions={commandActions} quickActions={resolvedQuickActions} stats={resolvedToolbarStats} />
                  </div>
                ) : null}

                {rightRail ? (
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_292px]">
                    <div className="min-w-0">{children}</div>
                    <aside className="grid h-fit gap-3 xl:sticky xl:top-[112px]">{rightRail}</aside>
                  </div>
                ) : (
                  children
                )}
              </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </Shell>
  );
}
