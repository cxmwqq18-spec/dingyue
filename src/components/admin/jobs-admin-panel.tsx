"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { AdminPagination, clampPage, pageItems, adminPageSizeOptions } from "@/components/admin/admin-pagination";
import { siteAdminJsonHeaders } from "@/lib/client-csrf";
import type { AiApp, GenerationJob, JobStatus, PublicCustomer } from "@/lib/types";
import { StatusPill } from "@/components/ui";

const jobStatusLabels: Record<JobStatus, string> = {
  queued: "排队中",
  running: "生成中",
  succeeded: "已完成",
  failed: "失败",
  refunded: "已退款"
};

function tone(status: string): "good" | "warn" | "bad" | "neutral" {
  if (status === "succeeded") return "good";
  if (status === "failed" || status === "refunded") return "bad";
  if (status === "queued" || status === "running") return "warn";
  return "neutral";
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function jobKindLabel(job: GenerationJob): string {
  const request = recordValue(job.requestJson);
  const fields = recordValue(request.fields);
  const flow = recordValue(request.flow);
  const isVideo =
    stringValue(flow.aiAppSlug) === "video_generator" ||
    stringValue(request.mode) === "video" ||
    stringValue(request.outputType) === "video" ||
    stringValue(fields.mode) === "video" ||
    stringValue(fields.outputType) === "video" ||
    Boolean(recordValue(request.videoTheme).id);
  return isVideo ? "视频" : "图片";
}

function jobDetailLabel(job: GenerationJob, appName: string): string {
  const request = recordValue(job.requestJson);
  const fields = recordValue(request.fields);
  const flow = recordValue(request.flow);
  const creativePack = recordValue(request.creativePack);
  const videoTheme = recordValue(request.videoTheme);
  return (
    stringValue(videoTheme.name) ||
    stringValue(creativePack.name) ||
    stringValue(fields.creativePackName) ||
    stringValue(flow.flowName) ||
    appName
  );
}

function outputSlotSummary(job: GenerationJob): string {
  const result = recordValue(job.resultJson);
  const slots = Array.isArray(result.outputSlots) ? result.outputSlots.filter((slot) => slot && typeof slot === "object") : [];
  if (!slots.length) return "";
  const counts = slots.reduce(
    (summary, slot) => {
      const status = stringValue((slot as Record<string, unknown>).status);
      if (status === "succeeded") summary.succeeded += 1;
      if (status === "failed") summary.failed += 1;
      return summary;
    },
    { succeeded: 0, failed: 0 }
  );
  return `输出 ${counts.succeeded}/${slots.length}${counts.failed ? `，失败 ${counts.failed}` : ""}`;
}

export function JobsAdminPanel({
  siteId,
  jobs,
  customers,
  aiApps,
  hasMore = false,
  loadingMore = false,
  onLoadMore
}: {
  siteId: string;
  jobs: GenerationJob[];
  customers: Array<Pick<PublicCustomer, "id" | "email">>;
  aiApps: AiApp[];
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}) {
  const router = useRouter();
  const [items, setItems] = useState(jobs);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(adminPageSizeOptions[0]);
  const [message, setMessage] = useState("失败或已退款的任务可在站点后台重新运行。");

  useEffect(() => {
    setItems(jobs);
  }, [jobs]);

  const currentPage = clampPage(page, items.length, pageSize);
  const visibleItems = useMemo(() => pageItems(items, currentPage, pageSize), [items, currentPage, pageSize]);

  useEffect(() => {
    setPage((current) => clampPage(current, items.length, pageSize));
  }, [items.length, pageSize]);

  async function rerun(jobId: string) {
    const response = await fetch(`/api/sites/${siteId}/ai/jobs/${jobId}/rerun`, {
      method: "POST",
      headers: siteAdminJsonHeaders(siteId),
      body: JSON.stringify({ actor: "site_admin_demo" })
    });
    const result = (await response.json().catch(() => ({}))) as { job?: GenerationJob; error?: string };
    if (response.ok && result.job) {
      setItems((current) => [result.job as GenerationJob, ...current]);
      setPage(1);
      setMessage(`已创建重跑任务：${result.job.id}。`);
      router.refresh();
    } else {
      setMessage(result.error ?? "重跑失败。");
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[16px] font-semibold text-[#333]">生成任务队列</h2>
          <p className="mt-1 text-[12px] text-[#666]">{message}</p>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="list min-w-[880px]">
          <thead>
            <tr>
              <th className="bgtt aleft">工具 / 任务</th>
              <th className="bgtt aleft">顾客</th>
              <th className="bgtt">状态</th>
              <th className="bgtt">预扣</th>
              <th className="bgtt">操作</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((job) => {
              const customer = customers.find((item) => item.id === job.customerId);
              const app = aiApps.find((item) => item.id === job.aiAppId);
              const canRerun = job.status === "failed" || job.status === "refunded";
              const appName = app?.name ?? job.aiAppId;
              const detail = jobDetailLabel(job, appName);
              const slotSummary = outputSlotSummary(job);
              return (
                <tr key={job.id}>
                  <td className="aleft">
                    <span className="block font-medium text-[#333]">{jobKindLabel(job)} · {detail}</span>
                    <span className="block text-[11px] text-[#777]">{appName}{slotSummary ? ` · ${slotSummary}` : ""}</span>
                    <span className="font-mono text-[11px] text-[#999]">{job.id}</span>
                  </td>
                  <td className="aleft truncate text-[#666]">{customer?.email ?? job.customerId}</td>
                  <td><StatusPill label={jobStatusLabels[job.status]} tone={tone(job.status)} /></td>
                  <td className="font-mono text-[#333]">{job.creditsReserved} 点</td>
                  <td>
                    <button
                      className="admin_btn inline-flex shrink-0 items-center gap-1 whitespace-nowrap disabled:opacity-35"
                      disabled={!canRerun}
                      onClick={() => rerun(job.id)}
                      type="button"
                    >
                      <RotateCcw className="h-3 w-3" strokeWidth={1.8} />
                      重跑
                    </button>
                  </td>
                </tr>
              );
            })}
            {!items.length ? (
              <tr>
                <td className="text-center text-[#999]" colSpan={5}>暂无生成任务。</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <AdminPagination
        total={items.length}
        page={currentPage}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(nextPageSize);
          setPage(1);
        }}
      />
      {hasMore && onLoadMore ? (
        <div className="mt-3 flex justify-center">
          <button className="admin_btn inline-flex h-[34px] items-center justify-center px-3 disabled:opacity-55" disabled={loadingMore} onClick={onLoadMore} type="button">
            {loadingMore ? "加载中..." : "加载更多任务"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
