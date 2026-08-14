"use client";

import { useEffect, useState } from "react";
import { CreditCard, Globe2, ShieldCheck, Users } from "lucide-react";
import { fetchAdminJson, invalidateAdminJson } from "@/components/admin/admin-api-client";
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
  domains?: SiteDomain[];
  siteAdmins?: PublicSiteAdmin[];
  feed?: AuditFeedItem[];
  auditLogCount?: number;
  gateway?: AiGatewayGroup;
  error?: string;
};

type SectionState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
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
  const [auditSection, setAuditSection] = useState<SectionState<Pick<SettingsPagePayload, "feed" | "auditLogCount">>>({ data: null, error: null, loading: false });
  const [domainsSection, setDomainsSection] = useState<SectionState<Pick<SettingsPagePayload, "domains">>>({ data: null, error: null, loading: false });
  const [adminsSection, setAdminsSection] = useState<SectionState<Pick<SettingsPagePayload, "siteAdmins">>>({ data: null, error: null, loading: false });
  const [gatewaySection, setGatewaySection] = useState<SectionState<Pick<SettingsPagePayload, "gateway">>>({ data: null, error: null, loading: false });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    invalidateAdminJson(`/api/sites/${site.id}/`);
    async function loadSettingsPage() {
      try {
        setError(null);
        const response = await fetchAdminJson<SettingsPagePayload>(`/api/sites/${site.id}/admin/settings-page?section=core`, { init: { signal: controller.signal } });
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

  useEffect(() => {
    let active = true;
    const auditController = new AbortController();
    const domainsController = new AbortController();
    const adminsController = new AbortController();
    const gatewayController = new AbortController();

    async function loadSection<T>(
      section: "audit" | "domains" | "admins" | "gateway",
      controller: AbortController,
      setState: (value: SectionState<T>) => void
    ) {
      setState({ data: null, error: null, loading: true });
      try {
        const response = await fetchAdminJson<T & { error?: string }>(
          `/api/sites/${site.id}/admin/settings-page?section=${section}`,
          { init: { signal: controller.signal }, ttlMs: section === "admins" ? 0 : undefined }
        );
        const result = response.data;
        if (!active) return;
        if (!response.ok) {
          setState({ data: null, error: result.error ?? "分段数据加载失败。", loading: false });
          return;
        }
        setState({ data: result, error: null, loading: false });
      } catch (error) {
        if (!active || controller.signal.aborted) return;
        setState({ data: null, error: error instanceof Error ? error.message : "分段数据加载失败。", loading: false });
      }
    }

    void loadSection("audit", auditController, setAuditSection);
    void loadSection("domains", domainsController, setDomainsSection);
    void loadSection("admins", adminsController, setAdminsSection);
    void loadSection("gateway", gatewayController, setGatewaySection);
    return () => {
      active = false;
      auditController.abort();
      domainsController.abort();
      adminsController.abort();
      gatewayController.abort();
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

  const domains = domainsSection.data?.domains ?? payload.domains ?? [];
  const siteAdmins = adminsSection.data?.siteAdmins ?? payload.siteAdmins ?? [];
  const auditFeed = auditSection.data?.feed ?? payload.feed ?? [];
  const auditLogCount = auditSection.data?.auditLogCount ?? payload.auditLogCount ?? 0;
  const gateway = gatewaySection.data?.gateway ?? payload.gateway;
  const domainValue = domainsSection.loading && !domainsSection.data ? "加载中" : String(domains.length);
  const adminValue = adminsSection.loading && !adminsSection.data ? "加载中" : String(siteAdmins.length);

  return (
    <div className="grid gap-5">
      <ErpStatGrid
        items={[
          { label: "域名", value: domainValue, detail: domainsSection.error ? "域名列表加载失败" : `${domains.filter((domain) => domain.status === "active").length} 个已生效域名`, icon: Globe2, tone: domains.length ? "good" : domainsSection.error ? "warn" : "neutral" },
          { label: "收款", value: connectStatusLabel(site.connect.status), detail: site.connect.stripeAccountId, icon: CreditCard, tone: site.connect.chargesEnabled ? "good" : "warn" },
          { label: "管理员", value: adminValue, detail: adminsSection.error ? "后台账号加载失败" : "本站后台账号", icon: Users, tone: siteAdmins.length ? "good" : adminsSection.error ? "warn" : "neutral" },
          { label: "审计", value: auditSection.loading ? "加载中" : String(auditLogCount), detail: "敏感操作记录", icon: ShieldCheck, tone: auditLogCount ? "good" : "neutral" }
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
          <SiteSettingsEditor domains={domains} site={site} />
          {domainsSection.loading && !domainsSection.data ? (
            <div className="mt-3 rounded-[8px] border border-[var(--admin-border-soft)] bg-white p-3 text-[12px] text-[#667085]">域名列表正在异步加载，基础信息与收款设置已可先编辑。</div>
          ) : domainsSection.error ? (
            <div className="mt-3 rounded-[8px] border border-red-200 bg-red-50 p-3 text-[12px] text-red-700">{domainsSection.error}</div>
          ) : null}
        </div>
        <div className="mt-3 text-[12px] text-[#667085]">
          AI 网关：{gatewaySection.loading ? "加载中" : gateway ? gateway.name : "未配置"}
        </div>
      </ErpSection>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <ErpSection
          description="后台账号只管理当前站点，角色范围不跨站。"
          eyebrow="admins"
          title="后台账号"
        >
          {adminsSection.error ? (
            <div className="rounded-[8px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">{adminsSection.error}</div>
          ) : adminsSection.loading && !adminsSection.data ? (
            <div className="rounded-[8px] border border-[var(--admin-border-soft)] bg-white p-4 text-[13px] text-[#667085]">后台账号正在异步加载，站点设置已可先操作。</div>
          ) : (
            <SiteAdminsPanel admins={siteAdmins} siteId={site.id} />
          )}
        </ErpSection>

        <ErpSection
          action={<ErpToolbarAction href={modulePath(site.slug, "/admin/orders")} label="订单与订阅" />}
          description="平台侧敏感查看需要审计；单站后台这里保留本站近期敏感操作轨迹。"
          eyebrow="audit trail"
          title="敏感操作"
        >
          {auditSection.error ? (
            <div className="rounded-[8px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">{auditSection.error}</div>
          ) : auditSection.loading ? (
            <div className="rounded-[8px] border border-[var(--admin-border-soft)] bg-white p-4 text-[13px] text-[#667085]">审计记录正在异步加载，设置与管理员已可先操作。</div>
          ) : (
            <AuditFeedPanel items={auditFeed} />
          )}
        </ErpSection>
      </div>
    </div>
  );
}
