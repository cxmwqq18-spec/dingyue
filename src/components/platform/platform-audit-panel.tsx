"use client";

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

type PlatformActivityItem = {
  id: string;
  label: string;
  detail: string;
  at: string;
  tone: "good" | "warn" | "bad" | "neutral";
};

const auditEventLabels: Record<string, string> = {
  credits_adjusted: "客户积分已调整",
  internal_theme_package_installed: "内置装修包已安装",
  order_failed: "订单支付失败",
  order_fulfilled: "订单已履约",
  order_paid: "订单已支付",
  order_pending: "订单待支付",
  order_refunded: "订单已退款",
  platform_ai_provider_deleted: "平台 AI 供应商已删除",
  platform_cloudflare_account_deleted: "平台 Cloudflare 账号已删除",
  platform_cloudflare_account_upserted: "平台 Cloudflare 账号已保存",
  platform_cloudflare_current_account_changed: "平台当前 Cloudflare 账号已切换",
  platform_cloudflare_current_account_cleared: "平台当前 Cloudflare 账号已清空",
  platform_email_settings_updated: "平台邮件配置已更新",
  site_admin_created: "站点管理员已创建",
  site_admin_deleted: "站点管理员已删除",
  site_admin_updated: "站点管理员已更新",
  site_created: "站点已创建",
  site_settings_updated: "站点设置已更新",
  site_signup_credit_grant_updated: "注册赠送积分已更新",
  theme_activated: "装修主题已启用",
  theme_applied_to_draft: "主题已应用到草稿",
  theme_deleted: "装修主题已删除",
  theme_draft_reset_from_active: "装修草稿已重置",
  theme_draft_restored_from_publication: "装修草稿已从发布版本恢复",
  theme_duplicated: "装修主题已复制",
  theme_installed: "装修主题已安装",
  theme_published: "装修主题已发布",
  theme_saas_addition: "装修区块已新增",
  theme_saas_additem: "装修内容项已新增",
  theme_saas_change: "装修内容已修改",
  theme_saas_delitem: "装修内容项已删除",
  theme_saas_delition: "装修区块已删除",
  theme_saas_dropitem: "装修内容项顺序已调整",
  theme_saas_dropition: "装修区块顺序已调整",
  theme_xfcart_addition: "XFCart 装修区块已新增",
  theme_xfcart_additem: "XFCart 装修内容项已新增",
  theme_xfcart_change: "XFCart 装修内容已修改",
  theme_xfcart_delitem: "XFCart 装修内容项已删除",
  theme_xfcart_delition: "XFCart 装修区块已删除"
};

const auditObjectLabels: Record<string, string> = {
  customer: "客户",
  platform_ai_provider: "平台 AI 供应商",
  platform_cloudflare_account: "平台 Cloudflare 账号",
  platform_email_settings: "平台邮件配置",
  site: "站点",
  site_admin: "站点管理员",
  site_theme: "站点装修主题",
  theme: "装修主题",
  theme_draft: "装修草稿",
  theme_publication: "装修发布版本"
};

const toneOptions = [
  { value: "", label: "全部状态" },
  { value: "good", label: "正常" },
  { value: "warn", label: "待处理" },
  { value: "bad", label: "异常" },
  { value: "neutral", label: "观察" }
];

function normalizeAuditKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function labelAuditEvent(label: string) {
  const key = normalizeAuditKey(label);
  if (auditEventLabels[key]) return auditEventLabels[key];
  if (key.startsWith("job_")) {
    const status = key.replace("job_", "");
    const jobStatusLabels: Record<string, string> = {
      failed: "AI 任务失败",
      pending: "AI 任务待处理",
      processing: "AI 任务处理中",
      refunded: "AI 任务已退款",
      succeeded: "AI 任务已完成"
    };
    return jobStatusLabels[status] ?? `AI 任务：${status}`;
  }
  if (key.startsWith("order_")) {
    const status = key.replace("order_", "");
    const orderStatusLabels: Record<string, string> = {
      failed: "订单支付失败",
      fulfilled: "订单已履约",
      paid: "订单已支付",
      pending: "订单待支付",
      refunded: "订单已退款"
    };
    return orderStatusLabels[status] ?? `订单：${status}`;
  }
  return label.replace(/_/g, " ");
}

function labelAuditObject(detail: string) {
  const separatorIndex = detail.indexOf(":");
  if (separatorIndex === -1) return detail;
  const type = detail.slice(0, separatorIndex);
  const id = detail.slice(separatorIndex + 1);
  const objectLabel = auditObjectLabels[type] ?? type.replace(/_/g, " ");
  return `${objectLabel}：${id}`;
}

export function PlatformAuditPanel({
  items
}: {
  items: PlatformActivityItem[];
}) {
  const [query, setQuery] = useState("");
  const [tone, setTone] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter((item) => {
      const eventLabel = labelAuditEvent(item.label);
      const objectLabel = labelAuditObject(item.detail);
      const toneLabel = toneOptions.find((option) => option.value === item.tone)?.label ?? item.tone;
      if (tone && item.tone !== tone) return false;
      if (!normalized) return true;
      return [item.label, eventLabel, item.detail, objectLabel, item.tone, toneLabel].join(" ").toLowerCase().includes(normalized);
    });
  }, [items, query, tone]);

  function reset() {
    setQuery("");
    setTone("");
  }

  function exportAudit() {
    downloadCsv(
      "platform-activity.csv",
      filtered.map((item) => ({
        id: item.id,
        event: labelAuditEvent(item.label),
        rawEvent: item.label,
        target: labelAuditObject(item.detail),
        rawTarget: item.detail,
        tone: toneOptions.find((option) => option.value === item.tone)?.label ?? item.tone,
        occurredAt: item.at
      })),
      ["id", "event", "rawEvent", "target", "rawTarget", "tone", "occurredAt"]
    );
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 xl:grid-cols-3">
        <div className="rounded-[8px] border border-[#d7e4f7] bg-[#f7fbff] p-4">
          <div className="text-[13px] font-semibold text-[#1d4ed8]">审计对象是什么</div>
          <p className="mt-2 text-[12px] leading-5 text-[#667085]">
            审计对象就是被操作的数据资源，格式为“资源类型：资源 ID”，例如站点管理员、平台邮件配置、Cloudflare 账号、装修主题或客户记录。
          </p>
        </div>
        <div className="rounded-[8px] border border-[#d8eadf] bg-[#f7fff9] p-4">
          <div className="text-[13px] font-semibold text-[#18794e]">审计风控的作用</div>
          <p className="mt-2 text-[12px] leading-5 text-[#667085]">
            用来追踪谁在什么时间改了什么配置，重点覆盖邮件、DNS、AI 供应商、管理员和站点设置，便于问题排查、回滚判断和责任追溯。
          </p>
        </div>
        <div className="rounded-[8px] border border-[#f2dfc5] bg-[#fffaf2] p-4">
          <div className="text-[13px] font-semibold text-[#b4691f]">运维查看顺序</div>
          <p className="mt-2 text-[12px] leading-5 text-[#667085]">
            先按状态过滤异常或待处理，再搜索站点、账号或配置 ID；导出的 CSV 会同时保留中文标签和原始事件值，方便核对。
          </p>
        </div>
      </div>

      <WorkbenchSearchRow
        actions={
          <>
            <WorkbenchActionButton label="重置" onClick={reset} quiet />
            <WorkbenchActionButton label="导出 CSV" onClick={exportAudit} />
          </>
        }
        controls={
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_200px]">
            <WorkbenchSearchInput onChange={setQuery} placeholder="搜索事件、对象 ID、状态" value={query} />
            <WorkbenchSelect
              onChange={setTone}
              options={toneOptions}
              value={tone}
            />
          </div>
        }
      />

      <WorkbenchTableShell>
        <WorkbenchTableHeader className="md:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_0.36fr_0.56fr]" columns={["操作事件", "影响对象", "状态", "发生时间"]} />
        {filtered.length ? (
          filtered.map((item) => (
            <WorkbenchTableRow className="md:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_0.36fr_0.56fr]" key={item.id}>
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium text-[#18212f]">{labelAuditEvent(item.label)}</div>
                <div className="mt-1 truncate font-mono text-[11px] text-[#98a2b3]">{normalizeAuditKey(item.label)}</div>
              </div>
              <div className="min-w-0">
                <div className="truncate text-[12px] text-[#667085]">{labelAuditObject(item.detail)}</div>
                <div className="mt-1 truncate font-mono text-[11px] text-[#98a2b3]">{item.detail}</div>
              </div>
              <div>
                <StatusPill label={item.tone} tone={item.tone} />
              </div>
              <div className="font-mono text-[11px] text-[#98a2b3]">
                {new Date(item.at).toLocaleString("zh-CN", {
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit"
                })}
              </div>
            </WorkbenchTableRow>
          ))
        ) : (
          <div className="px-5 py-10 text-center text-[13px] text-[#98a2b3]">没有匹配的跨站活动记录。</div>
        )}
      </WorkbenchTableShell>
    </div>
  );
}
