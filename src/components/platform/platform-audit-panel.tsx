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
import {
  auditToneOptions,
  formatAuditDateTime,
  labelAuditEvent,
  labelAuditObject,
  labelAuditTone,
  normalizeAuditKey,
  type AuditTone
} from "@/lib/audit-labels";

type PlatformActivityItem = {
  id: string;
  label: string;
  detail: string;
  at: string;
  tone: AuditTone;
};

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
      const toneLabel = labelAuditTone(item.tone);
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
        tone: labelAuditTone(item.tone),
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
            <WorkbenchActionButton label="导出当前筛选 CSV" onClick={exportAudit} />
          </>
        }
        controls={
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_200px]">
            <WorkbenchSearchInput onChange={setQuery} placeholder="搜索事件、对象 ID、状态" value={query} />
            <WorkbenchSelect
              onChange={setTone}
              options={auditToneOptions}
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
                {formatAuditDateTime(item.at)}
              </div>
            </WorkbenchTableRow>
          ))
        ) : (
          <div className="px-5 py-10 text-center">
            <div className="text-[13px] font-medium text-[#475467]">
              {items.length ? "没有匹配的审计记录" : "暂无跨站审计记录"}
            </div>
            <p className="mx-auto mt-2 max-w-[520px] text-[12px] leading-5 text-[#98a2b3]">
              {items.length
                ? "可以重置筛选条件，或搜索原始事件、对象 ID、状态中文名继续定位。"
                : "当平台邮件、Cloudflare、AI 供应商、站点管理员或站点配置发生变更后，这里会记录最近的敏感操作。"}
            </p>
            {items.length ? (
              <button className="mt-4 text-[12px] font-semibold text-[#2f6fed] hover:text-[#1d4ed8]" onClick={reset} type="button">
                重置筛选
              </button>
            ) : null}
          </div>
        )}
      </WorkbenchTableShell>
    </div>
  );
}
