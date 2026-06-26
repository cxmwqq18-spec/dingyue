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
              return (
                <tr key={job.id}>
                  <td className="aleft">
                    <span className="block font-medium text-[#333]">{app?.name ?? job.aiAppId}</span>
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
