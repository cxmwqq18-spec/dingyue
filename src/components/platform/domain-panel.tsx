"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { downloadCsv } from "@/components/admin/export-utils";
import { StatusPill } from "@/components/ui";
import type { PlatformAiProvider, SiteDomain } from "@/lib/types";

type DomainPanelDomain = SiteDomain & {
  siteName?: string;
  siteSlug?: string;
  sitePrimaryDomain?: string;
};

function statusLabel(status: SiteDomain["status"]) {
  return {
    active: "可用",
    pending: "待配置",
    failed: "异常"
  }[status] ?? status;
}

function statusTone(status: SiteDomain["status"]) {
  if (status === "active") return "good";
  if (status === "failed") return "bad";
  return "warn";
}

export function DomainPanel({
  domains,
  providers
}: {
  domains: DomainPanelDomain[];
  providers: Array<Pick<PlatformAiProvider, "id" | "label" | "aiUrl" | "modelType" | "preferred">>;
}) {
  const [items, setItems] = useState(domains);
  const configuredProviders = providers.filter((provider) => provider.aiUrl?.trim());

  useEffect(() => {
    setItems(domains);
  }, [domains]);

  function exportDomains() {
    downloadCsv(
      "platform-ai-gateway-domains.csv",
      items.map((item) => ({
        siteId: item.siteId,
        siteName: item.siteName ?? item.siteId,
        domainId: item.id,
        domain: item.domain,
        status: statusLabel(item.status),
        type: item.isPrimary ? "主域名" : "别名域名",
        availableAiProviders: configuredProviders.map((provider) => provider.label).join("|")
      })),
      ["siteId", "siteName", "domainId", "domain", "status", "type", "availableAiProviders"]
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[#e7edf3] bg-[#f8fafd] px-4 py-3">
        <div className="text-[13px] leading-6 text-[#667085]">
          AI 中转已对所有站点域名开放，域名不再单独保存白名单；供应商启停和优先级在上方供应商列表统一维护。
        </div>
        <button className="admin_btn inline-flex h-[32px] items-center gap-1 whitespace-nowrap" onClick={exportDomains} type="button">
          <Download className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
          导出域名
        </button>
      </div>
      <div className="tixing">当前展示全平台 {items.length} 条域名记录；可用 AI URL 会随平台供应商配置实时生效，无需逐条保存。</div>
      <div className="overflow-x-auto">
        <table className="list">
          <thead>
            <tr>
              <th className="bgtt">站点</th>
              <th className="bgtt">域名</th>
              <th className="bgtt" style={{ width: 110 }}>状态</th>
              <th className="bgtt" style={{ width: 90 }}>类型</th>
              <th className="bgtt">可用 AI URL</th>
              <th className="bgtt" style={{ width: 120 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {items.length ? items.map((item) => (
              <tr key={item.id}>
                <td className="aleft">
                  <span className="block font-semibold text-[#18212f]">{item.siteName ?? item.siteId}</span>
                  <span className="font-mono text-[11px] text-[#98a2b3]">{item.siteSlug ?? item.siteId}</span>
                </td>
                <td className="aleft">
                  <span className="block font-mono">{item.domain}</span>
                  <span className="font-mono text-[11px] text-[#999]">{item.id}</span>
                </td>
                <td>
                  <StatusPill label={statusLabel(item.status)} tone={statusTone(item.status)} />
                </td>
                <td>{item.isPrimary ? "主域名" : "别名"}</td>
                <td className="aleft">
                  <div className="grid gap-2">
                    {configuredProviders.length ? configuredProviders.map((provider) => (
                      <div className="min-w-0 rounded-[8px] border border-[#e7edf3] bg-white px-3 py-2 text-[12px] text-[#475467]" key={`${item.id}:${provider.id}`}>
                        <span className="flex min-w-0 items-center gap-2 font-semibold text-[#18212f]">
                          <span className="truncate">{provider.label}</span>
                          {provider.preferred ? <span className="tag_green shrink-0">优先</span> : null}
                          <StatusPill label="全站可用" tone="good" />
                        </span>
                        <span className="mt-1 block truncate font-mono text-[11px] text-[#667085]">{provider.aiUrl}</span>
                      </div>
                    )) : (
                      <span className="text-[12px] text-[#98a2b3]">暂无 AI URL，请先维护供应商。</span>
                    )}
                  </div>
                </td>
                <td>
                  <StatusPill label="全局继承" tone="neutral" />
                </td>
              </tr>
            )) : (
              <tr>
                <td className="py-8 text-center text-[13px] text-[#98a2b3]" colSpan={6}>暂无域名记录。</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
