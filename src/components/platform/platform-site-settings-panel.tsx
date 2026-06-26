"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { StatusPill } from "@/components/ui";
import {
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
import type { Site } from "@/lib/types";

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

function createForm(site: Site): SiteSettingsForm {
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

export function PlatformSiteSettingsPanel({
  site,
  compact = false
}: {
  site: Site;
  compact?: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState<SiteSettingsForm>(() => createForm(site));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("平台可直接维护店铺主记录，站点后台会读取同一份配置。");

  useEffect(() => {
    setForm(createForm(site));
  }, [site]);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(createForm(site)), [form, site]);

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
    const response = await fetch(`/api/platform/sites/${site.id}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string; site?: Site };
    setSaving(false);
    if (!response.ok) {
      setMessage(`保存失败：${result.error ?? "unknown error"}`);
      return;
    }
    if (result.site) {
      setForm(createForm(result.site));
    }
    setMessage("平台店铺主配置已保存。站点后台和前台会读取更新后的同一份主记录。");
    router.refresh();
  }

  const launchable = form.connect.chargesEnabled && form.connect.payoutsEnabled;

  if (compact) {
    return (
      <div className="grid gap-4">
        <div className="tixing">{message}</div>
        <ErpToolbar>
          <div className="flex flex-wrap gap-2">
            <ErpToolbarField label="店铺" value={form.name} />
            <ErpToolbarField label="状态" value={form.status} />
            <ErpToolbarField label="Connect" value={form.connect.status} />
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={dirty ? "tag_org" : "tag_green"}>{dirty ? "有未保存修改" : "已同步"}</span>
            <ErpToolbarAction label={saving ? "保存中" : "保存"} onClick={save} primary />
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
          <ErpField label="Stripe account">
            <ErpInput className="font-mono" onChange={(event) => updateConnect("stripeAccountId", event.target.value)} value={form.connect.stripeAccountId} />
          </ErpField>
          <ErpField label="Connect">
            <ErpSelect onChange={(event) => updateConnect("status", event.target.value as Site["connect"]["status"])} value={form.connect.status}>
              <option value="not_started">not_started</option>
              <option value="pending">pending</option>
              <option value="enabled">enabled</option>
              <option value="restricted">restricted</option>
            </ErpSelect>
          </ErpField>
        </ErpFormGrid>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <ErpSection
        description="平台侧直接维护店铺主记录。保存后，站点后台工作台、登录页品牌和前台全局配置读取同一份站点主数据。"
        eyebrow="platform site control"
        title={`${site.name} 主配置`}
      >
        <div className="tixing mb-4">{message}</div>
        <ErpToolbar className="mb-5">
          <div className="flex flex-wrap gap-2">
            <ErpToolbarField label="店铺" value={form.name} />
            <ErpToolbarField label="状态" value={form.status} />
            <ErpToolbarField label="币种" value={form.currency} />
            <ErpToolbarField label="时区" value={form.timezone} />
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={dirty ? "tag_org" : "tag_green"}>{dirty ? "有未保存修改" : "已同步"}</span>
            <ErpToolbarAction label={saving ? "保存中" : "保存店铺配置"} onClick={save} primary />
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
          <ErpField hint="这里的品牌说明会同步到 header/footer 全局字段和默认 SEO 文案。" label="品牌说明" span="full">
            <ErpTextarea className="min-h-[132px] resize-y" onChange={(event) => updateBranding("description", event.target.value)} value={form.branding.description} />
          </ErpField>
        </ErpFormGrid>
      </ErpSection>

      <ErpSection
        description="平台先控制店铺是否具备发布付费套餐的前置条件。支付链路仍是本地状态，但字段结构已经与最终系统一致。"
        eyebrow="connect readiness"
        title="收款与上线状态"
      >
        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <ErpFormGrid>
              <ErpField label="Stripe account" span="full">
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
                  <StatusPill label={launchable ? "launchable" : "needs onboarding"} tone={launchable ? "good" : "warn"} />
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
                { label: "Launch", value: launchable ? "ready" : "blocked", tone: launchable ? "good" : "warn" }
              ]}
            />
            <div className="rounded-[12px] border border-[var(--admin-border-soft)] bg-white px-4 py-4 text-[12px] leading-5 text-[#667085]">
              平台改这里，站点后台的收款设置页会同步反映。当前未接真实支付确认发号，不对外宣称支付已完工。
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[var(--admin-border-soft)] bg-[var(--admin-panel)] px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={dirty ? "tag_org" : "tag_green"}>{dirty ? "有未保存修改" : "已同步"}</span>
            <span className="text-[12px] text-[#667085]">平台保存后，会同步店铺主记录、默认 SEO 与全局 header/footer 文案。</span>
          </div>
          <button
            className="input_btn inline-flex h-[34px] items-center gap-1 disabled:cursor-not-allowed disabled:opacity-55"
            disabled={saving}
            onClick={save}
            type="button"
          >
            <Save className="h-3.5 w-3.5" strokeWidth={1.8} />
            {saving ? "保存中" : "保存店铺配置"}
          </button>
        </div>
      </ErpSection>
    </div>
  );
}
