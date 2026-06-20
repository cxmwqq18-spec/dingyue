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
      if (tone && item.tone !== tone) return false;
      if (!normalized) return true;
      return [item.label, item.detail, item.tone].join(" ").toLowerCase().includes(normalized);
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
        event: item.label,
        target: item.detail,
        tone: item.tone,
        occurredAt: item.at
      })),
      ["id", "event", "target", "tone", "occurredAt"]
    );
  }

  return (
    <div className="grid gap-4">
      <WorkbenchSearchRow
        actions={
          <>
            <WorkbenchActionButton label="重置" onClick={reset} quiet />
            <WorkbenchActionButton label="导出 CSV" onClick={exportAudit} />
          </>
        }
        controls={
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_200px]">
            <WorkbenchSearchInput onChange={setQuery} placeholder="搜索事件、对象、状态" value={query} />
            <WorkbenchSelect
              onChange={setTone}
              options={[
                { value: "", label: "全部状态" },
                { value: "good", label: "good" },
                { value: "warn", label: "warn" },
                { value: "bad", label: "bad" },
                { value: "neutral", label: "neutral" }
              ]}
              value={tone}
            />
          </div>
        }
      />

      <WorkbenchTableShell>
        <WorkbenchTableHeader className="md:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_0.36fr_0.56fr]" columns={["事件", "对象", "状态", "时间"]} />
        {filtered.length ? (
          filtered.map((item) => (
            <WorkbenchTableRow className="md:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_0.36fr_0.56fr]" key={item.id}>
              <div className="truncate text-[13px] font-medium text-[#18212f]">{item.label}</div>
              <div className="truncate font-mono text-[12px] text-[#667085]">{item.detail}</div>
              <div>
                <StatusPill label={item.tone} tone={item.tone} />
              </div>
              <div className="font-mono text-[11px] text-[#98a2b3]">
                {new Date(item.at).toLocaleString("en-US", {
                  month: "short",
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
