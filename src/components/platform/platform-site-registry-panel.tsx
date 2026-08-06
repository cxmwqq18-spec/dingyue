"use client";

import { useMemo, useState } from "react";
import { downloadCsv } from "@/components/admin/export-utils";
import {
  SiteRegistryRowCard,
  WorkbenchActionButton,
  WorkbenchSearchInput,
  WorkbenchSearchRow,
  WorkbenchSelect
} from "@/components/admin/design-workbench";
import { PlatformSiteAdminLink } from "@/components/platform/platform-site-admin-link";

type PlatformSiteSnapshot = {
  site: {
    id: string;
    name: string;
    slug: string;
    primaryDomain: string;
    status: string;
    connect: {
      chargesEnabled: boolean;
    };
  };
  ownerEmail: string;
  domains: Array<{ id: string }>;
  customerCount: number;
  activeSubscriptions: number;
  revenueCents: number;
  jobCount: number;
  enabledAppCount: number;
  appCount: number;
  publicationCount: number;
  healthScore: number;
};

function money(amountCents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: amountCents % 100 === 0 ? 0 : 2
  }).format(amountCents / 100);
}

function statusLabel(status: string): string {
  if (status === "active") return "运营";
  if (status === "draft") return "草稿";
  if (status === "suspended") return "停用";
  return status;
}

const emptyFilters = {
  title: "",
  owner: "",
  email: "",
  domain: "",
  status: "",
  chargeState: "all" as "all" | "not_ready"
};

type QuickFilterKey = "all" | "active" | "billing" | "draft" | "suspended";

function PlatformSiteExternalLinkButton({
  href,
  label,
  className
}: {
  href: string;
  label: string;
  className?: string;
}) {
  function openExternalSite() {
    const externalWindow = window.open("about:blank", "_blank");
    if (!externalWindow) {
      window.alert("浏览器拦截了新窗口，请允许弹出窗口后再访问前台。");
      return;
    }
    externalWindow.opener = null;
    externalWindow.location.replace(href);
  }

  return (
    <button className={className} onClick={openExternalSite} type="button">
      {label}
    </button>
  );
}

export function PlatformSiteRegistryPanel({
  snapshots
}: {
  snapshots: PlatformSiteSnapshot[];
}) {
  const [filters, setFilters] = useState(emptyFilters);

  const filteredSnapshots = useMemo(() => {
    const title = filters.title.trim().toLowerCase();
    const owner = filters.owner.trim().toLowerCase();
    const email = filters.email.trim().toLowerCase();
    const domain = filters.domain.trim().toLowerCase();

    return snapshots.filter((snapshot) => {
      if (title && !snapshot.site.name.toLowerCase().includes(title)) return false;
      if (owner && !snapshot.ownerEmail.toLowerCase().includes(owner)) return false;
      if (email && !snapshot.ownerEmail.toLowerCase().includes(email)) return false;
      if (domain && !snapshot.site.primaryDomain.toLowerCase().includes(domain)) return false;
      if (filters.status && snapshot.site.status !== filters.status) return false;
      if (filters.chargeState === "not_ready" && snapshot.site.connect.chargesEnabled) return false;
      return true;
    });
  }, [filters, snapshots]);

  const notReadyCount = filteredSnapshots.filter((snapshot) => !snapshot.site.connect.chargesEnabled).length;
  const quickFilterCounts: Record<QuickFilterKey, number> = {
    all: snapshots.length,
    active: snapshots.filter((snapshot) => snapshot.site.status === "active").length,
    billing: snapshots.filter((snapshot) => !snapshot.site.connect.chargesEnabled).length,
    draft: snapshots.filter((snapshot) => snapshot.site.status === "draft").length,
    suspended: snapshots.filter((snapshot) => snapshot.site.status === "suspended").length
  };

  function applyQuickFilter(key: QuickFilterKey) {
    if (key === "all") {
      setFilters((current) => ({ ...current, status: "", chargeState: "all" }));
      return;
    }
    if (key === "billing") {
      setFilters((current) => ({ ...current, status: "", chargeState: "not_ready" }));
      return;
    }
    setFilters((current) => ({ ...current, status: key, chargeState: "all" }));
  }

  const activeQuickFilter: QuickFilterKey =
    filters.chargeState === "not_ready"
      ? "billing"
      : filters.status === "active"
      ? "active"
      : filters.status === "draft"
      ? "draft"
      : filters.status === "suspended"
      ? "suspended"
      : "all";

  function exportSites() {
    downloadCsv(
      "platform-sites.csv",
      filteredSnapshots.map((snapshot) => ({
        siteId: snapshot.site.id,
        siteName: snapshot.site.name,
        slug: snapshot.site.slug,
        primaryDomain: snapshot.site.primaryDomain,
        status: snapshot.site.status,
        ownerEmail: snapshot.ownerEmail,
        customerCount: snapshot.customerCount,
        activeSubscriptions: snapshot.activeSubscriptions,
        revenueCents: snapshot.revenueCents,
        chargesReady: snapshot.site.connect.chargesEnabled ? "ready" : "blocked",
        publicationCount: snapshot.publicationCount,
        enabledAppCount: snapshot.enabledAppCount,
        appCount: snapshot.appCount,
        healthScore: snapshot.healthScore
      })),
      [
        "siteId",
        "siteName",
        "slug",
        "primaryDomain",
        "status",
        "ownerEmail",
        "customerCount",
        "activeSubscriptions",
        "revenueCents",
        "chargesReady",
        "publicationCount",
        "enabledAppCount",
        "appCount",
        "healthScore"
      ]
    );
  }

  return (
    <div className="grid gap-4">
      <WorkbenchSearchRow
        actions={
          <>
            <WorkbenchActionButton href="#create-site" label="添加店铺" primary />
            <WorkbenchActionButton label="导出 CSV" onClick={exportSites} />
            <WorkbenchActionButton href="#billing" label="收款检查" />
            <WorkbenchActionButton href="#audit" label="查看审计" />
          </>
        }
        controls={
          <div className="grid gap-3 xl:grid-cols-[1fr_220px_220px_220px]">
            <WorkbenchSearchInput
              onChange={(value) => setFilters((current) => ({ ...current, title: value }))}
              placeholder="搜索店铺名称、邮箱、主域名"
              value={filters.title}
            />
            <WorkbenchSearchInput
              onChange={(value) => setFilters((current) => ({ ...current, owner: value }))}
              placeholder="管理员 / 联系人"
              value={filters.owner}
            />
            <WorkbenchSearchInput
              onChange={(value) => setFilters((current) => ({ ...current, email: value }))}
              placeholder="邮箱"
              value={filters.email}
            />
            <WorkbenchSearchInput
              onChange={(value) => setFilters((current) => ({ ...current, domain: value }))}
              placeholder="主域名"
              value={filters.domain}
            />
          </div>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <WorkbenchSelect
            onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
            options={[
              { value: "", label: "全部状态" },
              { value: "active", label: "运营中" },
              { value: "draft", label: "草稿" },
              { value: "suspended", label: "停用" }
            ]}
            value={filters.status}
          />
          <label className="inline-flex h-[40px] items-center gap-2 rounded-[12px] border border-[#d8e0ea] bg-white px-3 text-[13px] text-[#18212f]">
            <input
              checked={filters.chargeState === "not_ready"}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  chargeState: event.target.checked ? "not_ready" : "all"
                }))
              }
              type="checkbox"
            />
            仅看未完成收款
          </label>
          <WorkbenchActionButton label="重置" onClick={() => setFilters(emptyFilters)} quiet />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#667085]">
          <span className="rounded-full border border-[#e4e7ec] bg-white px-3 py-2">{`筛选结果 ${filteredSnapshots.length} 个店铺`}</span>
          <span className="rounded-full border border-[#f5d7ad] bg-[#fff7ed] px-3 py-2 text-[#b4691f]">{`待收款 ${notReadyCount} 个`}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: "all" as const, label: "全部" },
          { key: "active" as const, label: "运营中" },
          { key: "billing" as const, label: "待收款" },
          { key: "draft" as const, label: "待发布" },
          { key: "suspended" as const, label: "已停用" }
        ].map((item) => {
          const active = activeQuickFilter === item.key;
          return (
            <button
              className={`inline-flex h-[34px] items-center gap-2 rounded-[10px] border px-3 text-[12px] transition ${
                active
                  ? "border-[#cddcff] bg-[#eef4ff] text-[#1b77f3]"
                  : "border-[var(--admin-border-soft)] bg-white text-[#667085] hover:border-[#d7dee8] hover:text-[var(--admin-text)]"
              }`}
              key={item.key}
              onClick={() => applyQuickFilter(item.key)}
              type="button"
            >
              <span>{item.label}</span>
              <span className={`rounded-[999px] px-2 py-0.5 font-mono text-[10px] ${active ? "bg-white text-[#1b77f3]" : "bg-[var(--admin-panel)] text-[#98a2b3]"}`}>
                {quickFilterCounts[item.key]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-3">
        {filteredSnapshots.length ? (
          filteredSnapshots.map((snapshot, index) => {
            const storefrontHref = `/site/${snapshot.site.slug}`;
            return (
              <SiteRegistryRowCard
                adminHref={`/api/platform/sites/${snapshot.site.id}/admin-bridge?path=${encodeURIComponent("/admin")}`}
                appCount={snapshot.appCount}
                chargesReady={snapshot.site.connect.chargesEnabled}
                customerCount={snapshot.customerCount}
                domain={snapshot.site.primaryDomain}
                domainCount={snapshot.domains.length}
                enabledAppCount={snapshot.enabledAppCount}
                healthScore={snapshot.healthScore}
                index={index + 1}
                jobCount={snapshot.jobCount}
                key={snapshot.site.id}
                name={snapshot.site.name}
                owner={snapshot.ownerEmail}
                publicationCount={snapshot.publicationCount}
                revenueLabel={money(snapshot.revenueCents)}
                settingsHref={`/api/platform/sites/${snapshot.site.id}/admin-bridge?path=${encodeURIComponent("/admin/settings")}`}
                siteId={snapshot.site.id}
                slug={snapshot.site.slug}
                status={{
                  label: statusLabel(snapshot.site.status),
                  tone:
                    snapshot.site.status === "active"
                      ? "good"
                      : snapshot.site.status === "suspended"
                      ? "bad"
                      : "warn"
                }}
                storefrontHref={storefrontHref}
                subscriptionCount={snapshot.activeSubscriptions}
                themeHref={`/api/platform/sites/${snapshot.site.id}/admin-bridge?path=${encodeURIComponent("/admin/themes")}`}
                actions={
                  <>
                    <PlatformSiteAdminLink
                      className="inline-flex h-[40px] items-center justify-center rounded-[12px] border border-[#edf2f7] bg-white px-4 text-[13px] font-medium text-[#667085] transition hover:text-[#18212f]"
                      label="后台"
                      path="/admin"
                      siteId={snapshot.site.id}
                    />
                    <PlatformSiteExternalLinkButton
                      className="inline-flex h-[40px] items-center justify-center rounded-[12px] border border-[#edf2f7] bg-white px-4 text-[13px] font-medium text-[#667085] transition hover:text-[#18212f]"
                      href={storefrontHref}
                      label="前台"
                    />
                    <PlatformSiteAdminLink
                      className="inline-flex h-[40px] items-center justify-center rounded-[12px] border border-[#d8e0ea] bg-white px-4 text-[13px] font-medium text-[#18212f] transition hover:border-[#bfd0f5] hover:text-[#2f6fed]"
                      label="主题"
                      path="/admin/themes"
                      siteId={snapshot.site.id}
                    />
                    <PlatformSiteAdminLink
                      className="inline-flex h-[40px] items-center justify-center rounded-[12px] border border-[#d8e0ea] bg-white px-4 text-[13px] font-medium text-[#18212f] transition hover:border-[#bfd0f5] hover:text-[#2f6fed]"
                      label="配置"
                      path="/admin/settings"
                      siteId={snapshot.site.id}
                    />
                  </>
                }
              />
            );
          })
        ) : (
          <div className="rounded-[16px] border border-dashed border-[#d8e0ea] bg-white px-6 py-10 text-center text-[13px] text-[#98a2b3]">
            当前筛选条件下没有匹配店铺。
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-[#e6ebf2] bg-[#fbfcfe] px-4 py-3 text-[12px] text-[#667085]">
        <span>{`已显示 ${filteredSnapshots.length} / ${snapshots.length} 个店铺`}</span>
        <span className="font-mono text-[11px] text-[#98a2b3]">platform tenant registry</span>
      </div>
    </div>
  );
}
