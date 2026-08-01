import Link from "next/link";
import type { ReactNode } from "react";
import type { AdminModuleDefinition, AdminModuleLink } from "@/lib/admin-menu";
import { AdminInstantLink } from "@/components/admin/admin-instant-link";
import { AdminModuleRailLink } from "@/components/admin/admin-module-rail-link";
import { canPrefetchAdminRoute } from "@/components/admin/admin-route-prefetch-policy";
import { StatusPill } from "@/components/ui";
import type { AdminNavItem, AdminWorkspaceSummary } from "./admin-types";

export function scopedAdminHref(href: string, siteSlug?: string): string {
  if (!siteSlug) return href;
  if (href.startsWith("http") || href.startsWith("#") || href.startsWith(`/site/${siteSlug}`)) return href;
  if (href === "/") return `/site/${siteSlug}`;
  return `/site/${siteSlug}${href}`;
}

export function navBelongsToModule(item: AdminNavItem, module: AdminModuleDefinition): boolean {
  const href = item.href.toLowerCase().replace(/^\/site\/[^/]+/, "");
  const text = `${item.label} ${item.group ?? ""}`.toLowerCase();
  if (module.code === "platform_overview") return href === "#overview" || text.includes("overview") || text.includes("总览");
  if (module.code === "sites") return href === "#sites" || text.includes("sites") || text.includes("站点") || text.includes("tenant");
  if (module.code === "billing") return href === "#billing" || text.includes("billing") || text.includes("收款");
  if (module.code === "gateway") return href === "#gateway" || text.includes("gateway") || text.includes("ai");
  if (module.code === "audit") return href === "#audit" || text.includes("audit") || text.includes("审计");
  if (module.code === "overview") return href === "/admin" || href.endsWith("/admin") || text.includes("总览");
  if (module.code === "design") return href.includes("/admin/design") || href.includes("/admin/themes") || href.includes("/admin/media") || text.includes("主题") || text.includes("装修");
  if (module.code === "products") return href.includes("/admin/products") || text.includes("商品") || text.includes("套餐");
  if (module.code === "orders") return href.includes("/admin/orders") || text.includes("订单") || text.includes("订阅");
  if (module.code === "customers") return href.includes("/admin/customers") || text.includes("顾客") || text.includes("客户");
  if (module.code === "processes") return href.includes("/admin/processes") || text.includes("进程") || text.includes("终止");
  if (module.code === "ai") return href.includes("/admin/ai-tools") || text.includes("ai");
  if (module.code === "content") return href.includes("/admin/content") || text.includes("内容") || text.includes("运营");
  if (module.code === "settings") return href.includes("/admin/settings") || text.includes("设置");
  return false;
}

export function moduleHrefMap(moduleLinks: AdminModuleLink[], siteSlug?: string): Map<string, string> {
  return new Map(moduleLinks.map((item) => [item.code, scopedAdminHref(item.href, siteSlug)]));
}

export function MobileAdminModuleSwitcher({
  brand,
  shellLabel,
  workspace,
  modules,
  activeModule,
  moduleHrefByCode,
  siteSlug
}: {
  brand: string;
  shellLabel: string;
  workspace?: AdminWorkspaceSummary;
  modules: AdminModuleDefinition[];
  activeModule: AdminModuleDefinition;
  moduleHrefByCode: Map<string, string>;
  siteSlug?: string;
}) {
  return (
    <div className="border-b border-[#132844] bg-[linear-gradient(180deg,#142742_0%,#0c1c33_100%)] p-3 text-slate-100 lg:hidden" data-admin-layout="saas-mobile-module-switcher">
      <div className="flex items-center justify-between gap-3">
        <Link className="flex min-w-0 items-center gap-3" href="/">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-[#2f6fed] text-sm font-semibold text-white shadow-[0_16px_30px_-18px_rgba(47,111,237,0.95)]">
            {brand.slice(0, 2).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold tracking-[-0.01em]">{brand}</span>
            <span className="mt-0.5 block truncate font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400/80">
              {shellLabel}
            </span>
          </span>
        </Link>
        <StatusPill label={workspace?.statusLabel ?? "已隔离"} tone={workspace?.statusTone ?? "good"} />
      </div>
      <nav className="mt-3 flex gap-2 overflow-x-auto pb-1" data-admin-layout="saas-left-module-rail">
        {modules.map((group) => {
          const isActive = group.code === activeModule.code;
          const href = moduleHrefByCode.get(group.code) ?? scopedAdminHref(group.href, siteSlug);
          return (
            <AdminModuleRailLink
              activeClassName="border-[#2f6fed] bg-[#2f6fed] text-white shadow-[0_14px_24px_-18px_rgba(47,111,237,0.9)]"
              baseClassName="inline-flex min-w-[110px] items-center justify-center gap-2 rounded-[12px] border px-3 py-2 text-xs font-medium transition active:scale-[0.98]"
              href={href}
              inactiveClassName="border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/20 hover:bg-white/[0.08]"
              isActive={isActive}
              key={`mobile-module:${group.label}`}
              moduleCode={group.code}
              moduleHref={scopedAdminHref(group.href, siteSlug)}
              siteSlug={siteSlug}
            >
              <group.icon className="h-3.5 w-3.5" strokeWidth={1.8} />
              <span className="truncate">{group.label}</span>
            </AdminModuleRailLink>
          );
        })}
      </nav>
    </div>
  );
}

export function AdminModuleRail({
  brand,
  shellLabel,
  workspace,
  modules,
  activeModule,
  activeModuleNav,
  moduleHrefByCode,
  siteSlug,
  account
}: {
  brand: string;
  shellLabel: string;
  workspace?: AdminWorkspaceSummary;
  modules: AdminModuleDefinition[];
  activeModule: AdminModuleDefinition;
  activeModuleNav: AdminNavItem[];
  moduleHrefByCode: Map<string, string>;
  siteSlug?: string;
  account?: ReactNode;
}) {
  return (
    <aside className="fixed left-0 top-0 z-[1001] hidden h-[100dvh] w-[216px] border-r border-[#163454] bg-[linear-gradient(180deg,#112846_0%,#0a1c32_52%,#08172a_100%)] text-white shadow-[22px_0_48px_-28px_rgba(15,23,42,0.9)] lg:block">
      <div className="flex h-full flex-col">
        <div className="h-[64px] border-b border-white/10 bg-transparent px-4 shadow-[0_12px_28px_-20px_rgba(0,0,0,.65)]">
          <Link className="flex h-full items-center gap-2 overflow-hidden" href="/">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-[#2f6fed] text-[11px] font-semibold text-white shadow-[0_16px_30px_-18px_rgba(47,111,237,0.95)]">
              {brand.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold leading-[18px] tracking-[-0.01em] text-white/92">{brand}</span>
              <span className="block truncate text-[11px] leading-[14px] text-white/42">{shellLabel}</span>
            </span>
          </Link>
        </div>

        <div className="border-b border-white/10 px-3 py-3">
          <div className="rounded-[12px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.03)_100%)] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/28">workspace</div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="truncate text-[13px] font-semibold text-white/92">{workspace?.name ?? brand}</p>
              <span className="shrink-0 rounded-full border border-[#2f6fed]/25 bg-[#2f6fed]/12 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[#d8e5ff]">
                {workspace?.statusLabel ?? "已隔离"}
              </span>
            </div>
            <p className="mt-1 truncate text-[11px] text-white/38">{workspace?.meta ?? "站点隔离"}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <span className="rounded-[8px] border border-white/8 bg-white/[0.04] px-2.5 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-white/48">
                scoped
              </span>
              <span className="rounded-[8px] border border-white/8 bg-white/[0.04] px-2.5 py-2 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-white/48">
                modules
              </span>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-[10px]" data-admin-layout="saas-left-module-rail">
          <p className="px-5 py-2 text-[11px] uppercase tracking-[0.16em] text-white/28">主导航</p>
          <div>
            {modules.map((group) => {
              const isActive = group.code === activeModule.code;
              const href = moduleHrefByCode.get(group.code) ?? scopedAdminHref(group.href, siteSlug);
              return (
                <AdminModuleRailLink
                  activeClassName="bg-[#2f6fed] text-white shadow-[0_18px_28px_-22px_rgba(47,111,237,0.95)]"
                  baseClassName="relative mx-2 flex min-h-[38px] items-center gap-3 rounded-[8px] px-3 py-2 text-[13px] transition"
                  href={href}
                  inactiveClassName="text-white/72 hover:bg-white/[0.045] hover:text-white"
                  isActive={isActive}
                  key={`module:${group.label}`}
                  moduleCode={group.code}
                  moduleHref={scopedAdminHref(group.href, siteSlug)}
                  siteSlug={siteSlug}
                >
                  <group.icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                  <span className="min-w-0 flex-1 truncate font-medium tracking-[-0.01em]">{group.label}</span>
                  <span className={`rounded-[4px] px-1.5 py-0.5 text-[10px] font-mono ${isActive ? "bg-white/15 text-white" : "bg-white/[0.06] text-white/35"}`}>
                    {group.metric}
                  </span>
                </AdminModuleRailLink>
              );
            })}
          </div>

          {activeModuleNav.length ? (
            <div className="mt-4 border-t border-white/10 pt-3">
              <p className="px-5 pb-2 text-[11px] uppercase tracking-[0.16em] text-white/28">当前模块</p>
              <div>
                {activeModuleNav.map((item) => {
                  const href = scopedAdminHref(item.href, siteSlug);
                  return (
                    <AdminInstantLink
                      className="mx-2 grid min-h-[32px] grid-cols-[16px_1fr_auto] items-center gap-2 rounded-[8px] px-3 py-1.5 text-[12px] text-white/58 transition hover:bg-white/[0.05] hover:text-white"
                      href={href}
                      key={`${activeModule.code}:${item.href}:${item.label}`}
                      prefetch={canPrefetchAdminRoute(href)}
                    >
                      <item.icon className="h-3.5 w-3.5" strokeWidth={1.8} />
                      <span className="truncate">{item.label}</span>
                      {item.badge ? (
                        <span className="rounded-[4px] bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-white/35">
                          {item.badge}
                        </span>
                      ) : null}
                    </AdminInstantLink>
                  );
                })}
              </div>
            </div>
          ) : null}
        </nav>

        {account ? <div className="border-t border-white/10 bg-black/10 px-3 py-3 backdrop-blur-sm">{account}</div> : null}
      </div>
    </aside>
  );
}
