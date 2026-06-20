"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { downloadCsv } from "@/components/admin/export-utils";
import {
  WorkbenchActionButton,
  WorkbenchSearchInput,
  WorkbenchSearchRow,
  WorkbenchSelect,
  WorkbenchTableHeader,
  WorkbenchTableRow,
  WorkbenchTableShell
} from "@/components/admin/design-workbench";
import { StatusPill } from "@/components/ui";
import { money } from "@/lib/ops";
import { PlatformSiteAdminLink } from "@/components/platform/platform-site-admin-link";

type PlatformBillingSnapshot = {
  site: {
    id: string;
    name: string;
    slug: string;
    primaryDomain: string;
    connect: {
      stripeAccountId: string;
      status: "not_started" | "pending" | "enabled" | "restricted";
      chargesEnabled: boolean;
      payoutsEnabled: boolean;
    };
  };
  productCount: number;
  activeSubscriptions: number;
  customerCount: number;
  revenueCents: number;
};

export function PlatformBillingPanel({
  snapshots
}: {
  snapshots: PlatformBillingSnapshot[];
}) {
  const [query, setQuery] = useState("");
  const [connectStatus, setConnectStatus] = useState("");
  const [launchState, setLaunchState] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return snapshots.filter((snapshot) => {
      const launchable = snapshot.site.connect.chargesEnabled && snapshot.site.connect.payoutsEnabled;
      if (connectStatus && snapshot.site.connect.status !== connectStatus) return false;
      if (launchState === "ready" && !launchable) return false;
      if (launchState === "blocked" && launchable) return false;
      if (!normalized) return true;
      return [
        snapshot.site.name,
        snapshot.site.slug,
        snapshot.site.primaryDomain,
        snapshot.site.connect.stripeAccountId,
        snapshot.site.connect.status
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [connectStatus, launchState, query, snapshots]);

  function reset() {
    setQuery("");
    setConnectStatus("");
    setLaunchState("");
  }

  function exportBilling() {
    downloadCsv(
      "platform-billing.csv",
      filtered.map((snapshot) => ({
        siteId: snapshot.site.id,
        siteName: snapshot.site.name,
        slug: snapshot.site.slug,
        primaryDomain: snapshot.site.primaryDomain,
        stripeAccountId: snapshot.site.connect.stripeAccountId,
        connectStatus: snapshot.site.connect.status,
        chargesEnabled: snapshot.site.connect.chargesEnabled,
        payoutsEnabled: snapshot.site.connect.payoutsEnabled,
        launchState: snapshot.site.connect.chargesEnabled && snapshot.site.connect.payoutsEnabled ? "ready" : "blocked",
        productCount: snapshot.productCount,
        activeSubscriptions: snapshot.activeSubscriptions,
        customerCount: snapshot.customerCount,
        revenueCents: snapshot.revenueCents
      })),
      [
        "siteId",
        "siteName",
        "slug",
        "primaryDomain",
        "stripeAccountId",
        "connectStatus",
        "chargesEnabled",
        "payoutsEnabled",
        "launchState",
        "productCount",
        "activeSubscriptions",
        "customerCount",
        "revenueCents"
      ]
    );
  }

  return (
    <div className="grid gap-4">
      <WorkbenchSearchRow
        actions={
          <>
            <WorkbenchActionButton label="重置" onClick={reset} quiet />
            <WorkbenchActionButton label="导出 CSV" onClick={exportBilling} />
          </>
        }
        controls={
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_200px_200px]">
            <WorkbenchSearchInput onChange={setQuery} placeholder="搜索店铺、域名、Stripe account" value={query} />
            <WorkbenchSelect
              onChange={setConnectStatus}
              options={[
                { value: "", label: "全部 Connect 状态" },
                { value: "enabled", label: "enabled" },
                { value: "pending", label: "pending" },
                { value: "restricted", label: "restricted" },
                { value: "not_started", label: "not_started" }
              ]}
              value={connectStatus}
            />
            <WorkbenchSelect
              onChange={setLaunchState}
              options={[
                { value: "", label: "全部上线状态" },
                { value: "ready", label: "可上线" },
                { value: "blocked", label: "待处理" }
              ]}
              value={launchState}
            />
          </div>
        }
      />

      <WorkbenchTableShell>
        <WorkbenchTableHeader className="md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.9fr)_0.42fr_0.42fr_180px]" columns={["店铺 / 主域名", "Connect", "套餐/订阅", "收入", "入口"]} />
        {filtered.length ? (
          filtered.map((snapshot) => {
            const launchable = snapshot.site.connect.chargesEnabled && snapshot.site.connect.payoutsEnabled;
            return (
              <WorkbenchTableRow className="md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.9fr)_0.42fr_0.42fr_180px]" key={snapshot.site.id}>
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold text-[#18212f]">{snapshot.site.name}</div>
                  <div className="mt-1 truncate font-mono text-[11px] text-[#98a2b3]">{snapshot.site.primaryDomain}</div>
                  <div className="mt-2 text-[12px] text-[#667085]">{snapshot.customerCount} 位客户</div>
                </div>
                <div className="min-w-0">
                  <div className="truncate font-mono text-[12px] text-[#18212f]">{snapshot.site.connect.stripeAccountId}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusPill label={snapshot.site.connect.status} tone={snapshot.site.connect.status === "enabled" ? "good" : snapshot.site.connect.status === "restricted" ? "bad" : "warn"} />
                    <StatusPill label={launchable ? "launchable" : "needs work"} tone={launchable ? "good" : "warn"} />
                  </div>
                </div>
                <div>
                  <div className="text-[14px] font-semibold text-[#18212f]">{snapshot.productCount}</div>
                  <div className="mt-2 text-[12px] text-[#667085]">{snapshot.activeSubscriptions} 个订阅</div>
                </div>
                <div>
                  <div className="font-mono text-[14px] font-semibold text-[#18212f]">{money(snapshot.revenueCents)}</div>
                  <div className="mt-2 text-[12px] text-[#667085]">{launchable ? "已具备收款条件" : "先完成 Connect"}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <PlatformSiteAdminLink
                    className="inline-flex h-[34px] items-center rounded-[10px] border border-[#d8e0ea] bg-white px-3 text-[12px] text-[#18212f]"
                    label="收款设置"
                    path="/admin/settings"
                    siteId={snapshot.site.id}
                  />
                  <PlatformSiteAdminLink
                    className="inline-flex h-[34px] items-center rounded-[10px] border border-[#d8e0ea] bg-white px-3 text-[12px] text-[#18212f]"
                    label="套餐"
                    path="/admin/products"
                    siteId={snapshot.site.id}
                  />
                </div>
              </WorkbenchTableRow>
            );
          })
        ) : (
          <div className="px-5 py-10 text-center text-[13px] text-[#98a2b3]">没有匹配的收款站点记录。</div>
        )}
      </WorkbenchTableShell>
    </div>
  );
}
