"use client";

import { useEffect, useState } from "react";
import { CreditCard, Globe2, ShieldCheck, Users } from "lucide-react";
import { fetchAdminJson } from "@/components/admin/admin-api-client";
import { AuditFeedPanel } from "@/components/admin/audit-feed-panel";
import { ErpSection, ErpStatGrid, ErpToolbar, ErpToolbarAction, ErpToolbarField } from "@/components/admin/erp-primitives";
import { SiteAdminsPanel } from "@/components/admin/site-admins-panel";
import { SiteSettingsEditor } from "@/components/admin/site-settings-editor";
import type { AiGatewayGroup, PublicSiteAdmin, Site, SiteDomain } from "@/lib/types";

type AuditFeedItem = {
  id: string;
  label: string;
  detail: string;
  at: string;
};

type SettingsPagePayload = {
  domains: SiteDomain[];
  siteAdmins: PublicSiteAdmin[];
  feed: AuditFeedItem[];
  auditLogCount: number;
  gateway?: AiGatewayGroup;
  error?: string;
};

function connectStatusLabel(status: string) {
  return {
    not_started: "未开始",
    pending: "待开通",
    enabled: "已开通",
    restricted: "受限"
  }[status] ?? status;
}

function SettingsPageSkeleton() {
  return (
    <div className="grid gap-5" aria-busy="true">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="rounded-[8px] border border-[var(--admin-border-soft)] bg-white p-5" key={index}>
            <div className="h-3 w-24 animate-pulse rounded bg-[#e8edf5]" />
            <div className="mt-8 h-8 w-20 animate-pulse rounded bg-[#e8edf5]" />
            <div className="mt-4 h-3 w-36 animate-pulse rounded bg-[#eef2f7]" />
          </div>
        ))}
      </div>
      <div className="rounded-[8px] border border-[var(--admin-border-soft)] bg-white p-5">
        <div className="h-5 w-40 animate-pulse rounded bg-[#e8edf5]" />
        <div className="mt-5 h-56 w-full animate-pulse rounded bg-[#eef2f7]" />
      </div>
    </div>
  );
}

function modulePath(siteSlug: string, path: string) {
  return `/site/${siteSlug}${path}`;
}

export function SettingsPageClient({ site }: { site: Site }) {
  const [payload, setPayload] = useState<SettingsPagePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function loadSettingsPage() {
      try {
        setError(null);
        const response = await fetchAdminJson<SettingsPagePayload>(`/api/sites/${site.id}/admin/settings-page`, { init: { signal: controller.signal } });
        const result = response.data;
        if (!active) return;
        if (!response.ok) {
          setError(result.error ?? "设置数据加载失败。");
          return;
        }
        setPayload(result);
      } catch (error) {
        if (!active || controller.signal.aborted) return;
        setError(error instanceof Error ? error.message : "设置数据加载失败。");
      }
    }
    void loadSettingsPage();
    return () => {
      active = false;
      controller.abort();
    };
  }, [site.id]);

  if (error) {
    return (
      <div className="rounded-[8px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!payload) {
    return <SettingsPageSkeleton />;
  }

  return (
    <div className="grid gap-5">
      <ErpStatGrid
        items={[
          { label: "域名", value: String(payload.domains.length), detail: `${payload.domains.filter((domain) => domain.status === "active").length} 个已生效域名`, icon: Globe2, tone: payload.domains.length ? "good" : "warn" },
          { label: "收款", value: connectStatusLabel(site.connect.status), detail: site.connect.stripeAccountId, icon: CreditCard, tone: site.connect.chargesEnabled ? "good" : "warn" },
          { label: "管理员", value: String(payload.siteAdmins.length), detail: "本站后台账号", icon: Users, tone: payload.siteAdmins.length ? "good" : "warn" },
          { label: "审计", value: String(payload.auditLogCount), detail: "敏感操作记录", icon: ShieldCheck, tone: payload.auditLogCount ? "good" : "neutral" }
        ]}
      />

      <ErpSection
        action={<ErpToolbarAction href={modulePath(site.slug, "/admin/media")} label="媒体库" />}
        description="站点名称、品牌、域名和 Stripe Connect 都应在本站后台直接维护，而不是只看静态状态表。"
        eyebrow="billing settings"
        title="设置收款与站点资料"
      >
        <ErpToolbar>
          <div className="flex flex-wrap gap-3">
            <ErpToolbarField label="站点" value={site.name} />
            <ErpToolbarField label="主域名" value={site.primaryDomain} />
            <ErpToolbarField label="Connect" value={connectStatusLabel(site.connect.status)} />
            <ErpToolbarField label="币种" value={site.currency} />
          </div>
          <div className="flex flex-wrap gap-2">
            <ErpToolbarAction href={modulePath(site.slug, "/admin/products")} label="商品中心" />
            <ErpToolbarAction href={modulePath(site.slug, "/admin/themes")} label="主题库" />
          </div>
        </ErpToolbar>
        <div className="mt-5">
          <SiteSettingsEditor domains={payload.domains} site={site} />
        </div>
      </ErpSection>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <ErpSection
          description="后台账号只管理当前站点，角色范围不跨站。"
          eyebrow="admins"
          title="后台账号"
        >
          <SiteAdminsPanel admins={payload.siteAdmins} siteId={site.id} />
        </ErpSection>

        <ErpSection
          action={<ErpToolbarAction href={modulePath(site.slug, "/admin/orders")} label="订单与订阅" />}
          description="平台侧敏感查看需要审计；单站后台这里保留本站近期敏感操作轨迹。"
          eyebrow="audit trail"
          title="敏感操作"
        >
          <AuditFeedPanel items={payload.feed} />
        </ErpSection>
      </div>
    </div>
  );
}
