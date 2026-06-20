"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Plus, Save, Star, Trash2 } from "lucide-react";
import type { Site, SiteDomain } from "@/lib/types";
import { downloadCsv } from "@/components/admin/export-utils";
import { StatusPill } from "@/components/ui";
import {
  ErpCheckboxRow,
  ErpField,
  ErpFormGrid,
  ErpInfoList,
  ErpInput,
  ErpSection,
  ErpSelect,
  ErpTextarea,
  ErpToolbar,
  ErpToolbarAction,
  ErpToolbarField
} from "@/components/admin/erp-primitives";

type SiteSettingsForm = {
  name: string;
  status: Site["status"];
  currency: string;
  timezone: string;
  branding: {
    logoText: string;
    market: string;
    description: string;
  };
  connect: {
    stripeAccountId: string;
    status: Site["connect"]["status"];
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
  };
};

function createSiteSettingsForm(site: Site): SiteSettingsForm {
  return {
    name: site.name,
    status: site.status,
    currency: site.currency,
    timezone: site.timezone,
    branding: {
      logoText: site.branding.logoText,
      market: site.branding.market,
      description: site.branding.description
    },
    connect: {
      stripeAccountId: site.connect.stripeAccountId,
      status: site.connect.status,
      chargesEnabled: site.connect.chargesEnabled,
      payoutsEnabled: site.connect.payoutsEnabled
    }
  };
}

function domainStatusTone(status: SiteDomain["status"]) {
  if (status === "active") return "good" as const;
  if (status === "failed") return "bad" as const;
  return "warn" as const;
}

function describeDomainError(code?: string) {
  return {
    missing_domain: "请输入域名。",
    invalid_domain: "域名格式不正确。",
    site_domain_exists: "这个域名已经存在。",
    site_domain_not_found: "域名记录不存在。",
    site_requires_primary_domain: "站点至少需要保留一个主域名。",
    site_admin_login_required: "当前站点后台登录已失效，请重新登录。"
  }[code ?? ""] ?? code ?? "unknown error";
}

export function SiteSettingsEditor({
  site,
  domains
}: {
  site: Site;
  domains: SiteDomain[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<SiteSettingsForm>(() => createSiteSettingsForm(site));
  const [domainItems, setDomainItems] = useState(domains);
  const [newDomain, setNewDomain] = useState("");
  const [newPrimary, setNewPrimary] = useState(false);
  const [message, setMessage] = useState("站点名称、品牌、收款状态和域名现在都可以在站点后台直接维护。");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(createSiteSettingsForm(site));
  }, [site]);

  useEffect(() => {
    setDomainItems(domains);
  }, [domains]);

  const dirty = useMemo(() => {
    return JSON.stringify(form) !== JSON.stringify(createSiteSettingsForm(site));
  }, [form, site]);

  function update<K extends keyof SiteSettingsForm>(key: K, value: SiteSettingsForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateBranding<K extends keyof SiteSettingsForm["branding"]>(
    key: K,
    value: SiteSettingsForm["branding"][K]
  ) {
    setForm((current) => ({
      ...current,
      branding: {
        ...current.branding,
        [key]: value
      }
    }));
  }

  function updateConnect<K extends keyof SiteSettingsForm["connect"]>(
    key: K,
    value: SiteSettingsForm["connect"][K]
  ) {
    setForm((current) => ({
      ...current,
      connect: {
        ...current.connect,
        [key]: value
      }
    }));
  }

  async function save() {
    setSaving(true);
    const response = await fetch(`/api/sites/${site.id}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actor: "site_admin_demo",
        ...form
      })
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string; site?: Site };
    setSaving(false);
    if (!response.ok) {
      setMessage(`保存失败：${result.error ?? "unknown error"}`);
      return;
    }
    if (result.site) {
      setForm(createSiteSettingsForm(result.site));
    }
    setMessage("站点设置已保存。域名、Connect 状态和品牌文案已写入站点主记录。");
    router.refresh();
  }

  async function addDomain() {
    if (!newDomain.trim()) return;
    setSaving(true);
    const response = await fetch(`/api/sites/${site.id}/domains`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        domain: newDomain.trim(),
        isPrimary: newPrimary
      })
    });
    const result = (await response.json().catch(() => ({}))) as { domain?: SiteDomain; error?: string };
    setSaving(false);
    if (!response.ok || !result.domain) {
      setMessage(`域名添加失败：${describeDomainError(result.error)}`);
      return;
    }
    setDomainItems((current) => {
      const next = newPrimary
        ? current.map((item) => ({
            ...item,
            isPrimary: false
          }))
        : current;
      return [...next, result.domain as SiteDomain];
    });
    setNewDomain("");
    setNewPrimary(false);
    setMessage(`${result.domain.domain} 已加入站点域名列表。`);
    router.refresh();
  }

  async function makePrimary(domainId: string) {
    setSaving(true);
    const response = await fetch(`/api/sites/${site.id}/domains/${domainId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPrimary: true })
    });
    const result = (await response.json().catch(() => ({}))) as { domain?: SiteDomain; error?: string };
    setSaving(false);
    if (!response.ok || !result.domain) {
      setMessage(`主域名切换失败：${describeDomainError(result.error)}`);
      return;
    }
    setDomainItems((current) =>
      current.map((item) => ({
        ...item,
        isPrimary: item.id === domainId,
        status: item.id === domainId ? "active" : item.status
      }))
    );
    setMessage(`${result.domain.domain} 已设为主域名。`);
    router.refresh();
  }

  async function updateDomainStatus(domainId: string, status: SiteDomain["status"]) {
    setSaving(true);
    const response = await fetch(`/api/sites/${site.id}/domains/${domainId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    const result = (await response.json().catch(() => ({}))) as { domain?: SiteDomain; error?: string };
    setSaving(false);
    if (!response.ok || !result.domain) {
      setMessage(`域名状态更新失败：${describeDomainError(result.error)}`);
      return;
    }
    setDomainItems((current) => current.map((item) => (item.id === domainId ? { ...item, status: result.domain?.status ?? item.status } : item)));
    setMessage(`${result.domain.domain} 状态已更新为 ${result.domain.status}。`);
    router.refresh();
  }

  async function removeDomain(domainId: string) {
    setSaving(true);
    const response = await fetch(`/api/sites/${site.id}/domains/${domainId}`, {
      method: "DELETE"
    });
    const result = (await response.json().catch(() => ({}))) as { deletedDomain?: SiteDomain; site?: Site; error?: string };
    setSaving(false);
    if (!response.ok || !result.deletedDomain) {
      setMessage(`删除域名失败：${describeDomainError(result.error)}`);
      return;
    }
    setDomainItems((current) => current.filter((item) => item.id !== domainId));
    setMessage(`${result.deletedDomain.domain} 已从站点域名列表移除。`);
    router.refresh();
  }

  function exportDomains() {
    downloadCsv(
      `${site.slug}-domains.csv`,
      domainItems.map((domain) => ({
        domainId: domain.id,
        domain: domain.domain,
        status: domain.status,
        type: domain.isPrimary ? "primary" : "alias"
      })),
      ["domainId", "domain", "status", "type"]
    );
    setMessage(`已导出 ${domainItems.length} 条域名记录。`);
  }

  return (
    <div className="grid gap-5">
      <ErpSection
        description="站点主记录、品牌描述和租户边界在这里维护。保存后会同步后台头部工作区信息。"
        eyebrow="site identity"
        title="站点基础信息"
      >
        <div className="tixing mb-4">{message}</div>
        <ErpToolbar className="mb-5">
          <div className="flex flex-wrap gap-2">
            <ErpToolbarField label="站点" value={form.name} />
            <ErpToolbarField label="状态" value={form.status} />
            <ErpToolbarField label="币种" value={form.currency} />
            <ErpToolbarField label="时区" value={form.timezone} />
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={dirty ? "tag_org" : "tag_green"}>{dirty ? "有未保存修改" : "与当前配置一致"}</span>
            <ErpToolbarAction label={saving ? "保存中" : "保存站点设置"} onClick={save} primary />
          </div>
        </ErpToolbar>
        <ErpFormGrid>
          <ErpField label="站点名称">
            <ErpInput onChange={(event) => update("name", event.target.value)} value={form.name} />
          </ErpField>
          <ErpField label="站点状态">
            <ErpSelect onChange={(event) => update("status", event.target.value as Site["status"])} value={form.status}>
              <option value="active">active</option>
              <option value="draft">draft</option>
              <option value="suspended">suspended</option>
            </ErpSelect>
          </ErpField>
          <ErpField label="品牌简称">
            <ErpInput onChange={(event) => updateBranding("logoText", event.target.value)} value={form.branding.logoText} />
          </ErpField>
          <ErpField label="市场定位">
            <ErpInput onChange={(event) => updateBranding("market", event.target.value)} value={form.branding.market} />
          </ErpField>
          <ErpField label="币种">
            <ErpInput onChange={(event) => update("currency", event.target.value.toUpperCase())} value={form.currency} />
          </ErpField>
          <ErpField label="时区">
            <ErpInput onChange={(event) => update("timezone", event.target.value)} value={form.timezone} />
          </ErpField>
          <ErpField hint="前台描述、登录页文案和后台工作区摘要都会读取这里。" label="品牌说明" span="full">
            <ErpTextarea className="min-h-[132px] resize-y" onChange={(event) => updateBranding("description", event.target.value)} value={form.branding.description} />
          </ErpField>
        </ErpFormGrid>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[var(--admin-border-soft)] bg-[var(--admin-panel)] px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={dirty ? "tag_org" : "tag_green"}>{dirty ? "有未保存修改" : "与当前配置一致"}</span>
            <span className="text-[12px] text-[#667085]">保存后同步站点名称、品牌文案和后台工作区摘要。</span>
          </div>
          <button
            className="input_btn inline-flex h-[34px] items-center gap-1 disabled:cursor-not-allowed disabled:opacity-55"
            disabled={saving}
            onClick={save}
            type="button"
          >
            <Save className="h-3.5 w-3.5" strokeWidth={1.8} />
            {saving ? "保存中" : "保存站点设置"}
          </button>
        </div>
      </ErpSection>

      <ErpSection
        description="站点独立收款能力在这里维护。第一版仍为本地状态管理，但数据流已经按真实 Connect 字段组织。"
        eyebrow="billing connection"
        title="Stripe Connect 与收款状态"
      >
        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <ErpFormGrid>
              <ErpField hint="后续接真实 Stripe Connect 时直接复用。" label="Stripe account" span="full">
                <ErpInput className="font-mono" onChange={(event) => updateConnect("stripeAccountId", event.target.value)} value={form.connect.stripeAccountId} />
              </ErpField>
              <ErpField label="Connect 状态">
                <ErpSelect onChange={(event) => updateConnect("status", event.target.value as Site["connect"]["status"])} value={form.connect.status}>
                  <option value="not_started">not_started</option>
                  <option value="pending">pending</option>
                  <option value="enabled">enabled</option>
                  <option value="restricted">restricted</option>
                </ErpSelect>
              </ErpField>
              <ErpField label="Charges">
                <ErpSelect onChange={(event) => updateConnect("chargesEnabled", event.target.value === "true")} value={String(form.connect.chargesEnabled)}>
                  <option value="true">enabled</option>
                  <option value="false">disabled</option>
                </ErpSelect>
              </ErpField>
              <ErpField label="Payouts">
                <ErpSelect onChange={(event) => updateConnect("payoutsEnabled", event.target.value === "true")} value={String(form.connect.payoutsEnabled)}>
                  <option value="true">enabled</option>
                  <option value="false">disabled</option>
                </ErpSelect>
              </ErpField>
              <ErpField label="上线判定">
                <div className="flex min-h-[38px] items-center">
                  <StatusPill
                    label={form.connect.chargesEnabled && form.connect.payoutsEnabled ? "launchable" : "needs onboarding"}
                    tone={form.connect.chargesEnabled && form.connect.payoutsEnabled ? "good" : "warn"}
                  />
                </div>
              </ErpField>
            </ErpFormGrid>
          </div>
          <div className="grid gap-3">
            <ErpInfoList
              items={[
                { label: "Connect", value: form.connect.status, tone: form.connect.status === "enabled" ? "good" : "warn" },
                { label: "Charges", value: form.connect.chargesEnabled ? "enabled" : "disabled", tone: form.connect.chargesEnabled ? "good" : "warn" },
                { label: "Payouts", value: form.connect.payoutsEnabled ? "enabled" : "disabled", tone: form.connect.payoutsEnabled ? "good" : "warn" },
                {
                  label: "Launch",
                  value: form.connect.chargesEnabled && form.connect.payoutsEnabled ? "ready" : "blocked",
                  tone: form.connect.chargesEnabled && form.connect.payoutsEnabled ? "good" : "warn"
                }
              ]}
            />
            <div className="rounded-[12px] border border-[var(--admin-border-soft)] bg-white px-4 py-4 text-[12px] leading-5 text-[#667085]">
              这里先不接真实 Stripe onboarding，但字段、状态和站点级收款边界已经按最终系统的数据结构布局。
            </div>
          </div>
        </div>
      </ErpSection>

      <ErpSection
        description="域名列表现在可以直接维护。主域名逻辑已与站点主记录分开，后续接真实解析校验也不需要重排页面。"
        eyebrow="domains"
        title="站点域名"
      >
        <ErpToolbar className="mb-5">
          <div className="flex min-w-0 flex-1 flex-col gap-3 xl:flex-row xl:items-center">
            <div className="min-w-0 flex-1">
              <ErpInput onChange={(event) => setNewDomain(event.target.value)} placeholder="studio.example.com" value={newDomain} />
            </div>
            <ErpCheckboxRow checked={newPrimary} label="设为主域名" onChange={setNewPrimary} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="admin_btn inline-flex h-[34px] items-center gap-1" onClick={exportDomains} type="button">
              <Download className="h-3.5 w-3.5" strokeWidth={1.8} />
              导出域名
            </button>
            <button className="admin_btn inline-flex h-[34px] items-center gap-1 disabled:cursor-not-allowed disabled:opacity-55" disabled={saving} onClick={addDomain} type="button">
              <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
              添加域名
            </button>
          </div>
        </ErpToolbar>
        <div className="overflow-x-auto">
          <table className="list">
            <thead>
              <tr>
                <th className="bgtt aleft">域名</th>
                <th className="bgtt">状态</th>
                <th className="bgtt">类型</th>
                <th className="bgtt">操作</th>
              </tr>
            </thead>
            <tbody>
              {domainItems.map((domain) => (
                <tr key={domain.id}>
                  <td className="aleft">
                    <span className="block font-medium text-[#333]">{domain.domain}</span>
                    <span className="font-mono text-[11px] text-[#999]">{domain.id}</span>
                  </td>
                  <td>
                    <div className="flex flex-col items-center gap-2">
                      <StatusPill label={domain.status} tone={domainStatusTone(domain.status)} />
                      <select
                        className="selectmini min-w-[110px]"
                        disabled={saving}
                        onChange={(event) => updateDomainStatus(domain.id, event.target.value as SiteDomain["status"])}
                        value={domain.status}
                      >
                        <option value="active">active</option>
                        <option value="pending">pending</option>
                        <option value="failed">failed</option>
                      </select>
                    </div>
                  </td>
                  <td className="font-mono text-[11px] text-[#666]">{domain.isPrimary ? "primary" : "alias"}</td>
                  <td>
                    <div className="flex flex-wrap justify-center gap-1">
                      {!domain.isPrimary ? (
                        <button className="admin_btn inline-flex items-center gap-1" disabled={saving} onClick={() => makePrimary(domain.id)} type="button">
                          <Star className="h-3.5 w-3.5" strokeWidth={1.8} />
                          设为主域名
                        </button>
                      ) : (
                        <span className="tag_green">当前主域名</span>
                      )}
                      {domainItems.length > 1 ? (
                        <button className="admin_del inline-flex items-center gap-1" disabled={saving} onClick={() => removeDomain(domain.id)} type="button">
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                          删除
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ErpSection>
    </div>
  );
}
