"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CircleStop, FileDown, Loader2, RefreshCw, Search } from "lucide-react";
import { fetchAdminJson } from "@/components/admin/admin-api-client";
import { AdminPagination, adminPageSizeOptions, clampPage } from "@/components/admin/admin-pagination";
import {
  ErpSection,
  ErpStatGrid,
  ErpToolbar,
  ErpToolbarAction,
  ErpToolbarField
} from "@/components/admin/erp-primitives";
import { siteAdminJsonHeaders } from "@/lib/client-csrf";
import type { AdminProcessFilter, AdminProcessView } from "@/lib/admin-processes";
import { StatusPill } from "@/components/ui";

type ProcessesPayload = {
  ok?: boolean;
  error?: string;
  processes: AdminProcessView[];
  pageInfo: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
  summary: {
    activeCount: number;
    queuedCount: number;
    runningCount: number;
    terminatedCount: number;
    failedCount: number;
    activeReservedCredits: number;
  };
};

const filterOptions: Array<{ label: string; value: AdminProcessFilter }> = [
  { label: "执行中", value: "active" },
  { label: "已终止", value: "terminated" },
  { label: "失败", value: "failed" },
  { label: "全部", value: "all" }
];

function processLoadError(error?: unknown, status?: number) {
  if (status === 401) return "后台登录已过期，请重新登录后再打开进程管理。";
  if (status === 403) return "当前账号没有访问进程管理的权限。";
  if (typeof error === "string" && error.trim()) return `进程数据加载失败：${error}`;
  if (error instanceof DOMException && error.name === "AbortError") return "进程数据加载超时，请重试。";
  if (error instanceof Error && error.message) return `进程数据加载失败：${error.message}`;
  return "进程数据加载失败，请重试。";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function progressLabel(process: AdminProcessView) {
  if (process.progress === undefined) return process.status === "queued" ? "等待中" : "进行中";
  return `${Math.round(process.progress)}%`;
}

function emptyPayload(pageSize: number): ProcessesPayload {
  return {
    processes: [],
    pageInfo: { page: 1, pageSize, total: 0, hasMore: false },
    summary: {
      activeCount: 0,
      activeReservedCredits: 0,
      failedCount: 0,
      queuedCount: 0,
      runningCount: 0,
      terminatedCount: 0
    }
  };
}

export function ProcessesPageClient({
  initialOpenJobs,
  initialReservedCredits,
  siteId
}: {
  initialOpenJobs: number;
  initialReservedCredits: number;
  siteId: string;
}) {
  const [filter, setFilter] = useState<AdminProcessFilter>("active");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(adminPageSizeOptions[0]);
  const [payload, setPayload] = useState<ProcessesPayload>(() => ({
    ...emptyPayload(pageSize),
    summary: {
      ...emptyPayload(pageSize).summary,
      activeCount: initialOpenJobs,
      activeReservedCredits: initialReservedCredits
    }
  }));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("执行中的进程可由站点管理员终止，终止后全额释放预扣积分。");
  const [recoveringId, setRecoveringId] = useState<string | null>(null);
  const [terminatingId, setTerminatingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      filter,
      page: String(page),
      pageSize: String(pageSize)
    });
    if (search.trim()) params.set("search", search.trim());
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchAdminJson<ProcessesPayload>(
          `/api/sites/${siteId}/admin/processes-page?${params.toString()}&reload=${reloadKey}`,
          { init: { signal: controller.signal }, timeoutMs: 20_000, ttlMs: 0 }
        );
        const result = response.data;
        if (controller.signal.aborted) return;
        if (!response.ok) {
          setError(processLoadError(result.error, response.status));
          return;
        }
        setPayload(result);
      } catch (loadError) {
        if (!controller.signal.aborted) setError(processLoadError(loadError));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [filter, page, pageSize, reloadKey, search, siteId]);

  const currentPage = clampPage(page, payload.pageInfo.total, pageSize);
  const hasActiveSearch = search.trim().length > 0;
  const rows = payload.processes;
  const summaryItems = useMemo(() => [
    {
      label: "执行中",
      value: String(payload.summary.activeCount),
      detail: "queued + running",
      icon: CircleStop,
      tone: payload.summary.activeCount ? "warn" as const : "good" as const
    },
    {
      label: "排队中",
      value: String(payload.summary.queuedCount),
      detail: "尚未进入 worker",
      icon: Loader2,
      tone: payload.summary.queuedCount ? "warn" as const : "good" as const
    },
    {
      label: "生成中",
      value: String(payload.summary.runningCount),
      detail: "worker 已接手",
      icon: RefreshCw,
      tone: payload.summary.runningCount ? "warn" as const : "good" as const
    },
    {
      label: "已终止",
      value: String(payload.summary.terminatedCount),
      detail: "人工取消并释放",
      icon: AlertTriangle,
      tone: payload.summary.terminatedCount ? "bad" as const : "neutral" as const
    },
    {
      label: "预扣积分",
      value: `${payload.summary.activeReservedCredits}`,
      detail: "执行中仍占用",
      icon: CircleStop,
      tone: payload.summary.activeReservedCredits ? "warn" as const : "good" as const
    }
  ], [payload.summary]);

  async function terminateProcess(process: AdminProcessView) {
    const reason = window.prompt(
      `确认终止该进程？\n\n${process.alias}\n\n终止后会全额释放预扣积分，不交付新结果，晚到 worker 回调会被忽略。\n\n请输入终止原因：`,
      process.stageLabel
    );
    if (reason === null) return;
    setTerminatingId(process.id);
    setMessage(`正在终止进程：${process.shortId}...`);
    try {
      const response = await fetchAdminJson<{
        ok?: boolean;
        error?: string;
        ledgerAction?: { amount?: number; type?: string } | null;
        localWorkerAbort?: { aborted?: boolean; count?: number };
      }>(
        `/api/sites/${siteId}/admin/processes/${process.id}/terminate`,
        {
          init: {
            method: "POST",
            headers: siteAdminJsonHeaders(siteId),
            body: JSON.stringify({ reason })
          },
          timeoutMs: 30_000,
          ttlMs: 0
        }
      );
      const result = response.data;
      if (!response.ok) {
        setMessage(result.error === "generation_job_not_active" ? "该进程已经结束，列表已刷新。" : result.error ?? "终止失败。");
        setReloadKey((key) => key + 1);
        return;
      }
      setMessage(`已终止 ${process.shortId}，释放 ${result.ledgerAction?.amount ?? process.creditsReserved} 点；本地 worker ${result.localWorkerAbort?.aborted ? "已中断" : "无需中断"}。`);
      setReloadKey((key) => key + 1);
    } catch (terminateError) {
      setMessage(processLoadError(terminateError));
    } finally {
      setTerminatingId(null);
    }
  }

  async function recoverVideoProcess(process: AdminProcessView) {
    const recoveryInput = window.prompt(
      [
        "从上游供应商拉取已生成的视频并恢复到前台。",
        "",
        "请输入上游 provider task id 或完整 video URL：",
        process.providerTaskId ? "" : "当前本地 job 没有记录 provider task id，必须粘贴上游 task id 或视频地址。"
      ].filter(Boolean).join("\n"),
      process.providerTaskId ?? ""
    );
    if (recoveryInput === null) return;
    const value = recoveryInput.trim();
    if (!value && !process.providerTaskId) {
      setMessage("恢复失败：缺少上游 task id 或 video URL。");
      return;
    }
    const isUrl = /^https?:\/\//i.test(value);
    setRecoveringId(process.id);
    setMessage(`正在从上游恢复视频：${process.shortId}...`);
    try {
      const response = await fetchAdminJson<{
        ok?: boolean;
        error?: string;
        downloadedBytes?: number;
        mimeType?: string | null;
        providerTaskId?: string | null;
        skipped?: boolean;
        storageKey?: string | null;
      }>(
        `/api/sites/${siteId}/admin/processes/${process.id}/recover-video`,
        {
          init: {
            method: "POST",
            headers: siteAdminJsonHeaders(siteId),
            body: JSON.stringify({
              providerTaskId: isUrl ? undefined : value || process.providerTaskId,
              videoUrl: isUrl ? value : undefined
            })
          },
          timeoutMs: 180_000,
          ttlMs: 0
        }
      );
      const result = response.data;
      if (!response.ok) {
        setMessage(result.error ?? "视频恢复失败。");
        return;
      }
      setMessage(result.skipped
        ? `视频 ${process.shortId} 已经处理过，列表已刷新。`
        : `已恢复 ${process.shortId}：${result.mimeType ?? "video"}，${result.downloadedBytes ?? 0} bytes。`);
      setReloadKey((key) => key + 1);
    } catch (recoverError) {
      setMessage(processLoadError(recoverError));
    } finally {
      setRecoveringId(null);
    }
  }

  return (
    <div className="grid gap-5">
      <ErpStatGrid items={summaryItems} columns={5} />

      <ErpSection
        description="这里只显示当前店铺的 AI 图片/视频生成任务。终止动作会把任务结算为已终止并释放预扣积分，不直接承诺供应商侧退款。"
        eyebrow="process control"
        title="生成进程"
      >
        <ErpToolbar>
          <div className="flex flex-wrap items-center gap-3">
            <ErpToolbarField label="当前视图" value={filterOptions.find((item) => item.value === filter)?.label ?? filter} />
            <ErpToolbarField label="总数" value={String(payload.pageInfo.total)} />
            <ErpToolbarField label="状态" value={loading ? "加载中" : "已同步"} />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#98a2b3]" strokeWidth={1.8} />
              <input
                aria-label="搜索进程"
                className="erp-input h-[34px] w-full min-w-[220px] pl-8 sm:w-[260px]"
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="搜索任务、顾客、工具"
                value={search}
              />
            </div>
            <select
              aria-label="进程状态过滤"
              className="erp-select h-[34px] min-w-[116px]"
              onChange={(event) => {
                setFilter(event.target.value as AdminProcessFilter);
                setPage(1);
              }}
              value={filter}
            >
              {filterOptions.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
            <ErpToolbarAction label="刷新" onClick={() => setReloadKey((key) => key + 1)} />
          </div>
        </ErpToolbar>

        <div className="mt-3 min-h-[24px] text-[12px] text-[#667085]">
          {error ? <span className="text-rose-700">{error}</span> : message}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="list min-w-[1120px]">
            <thead>
              <tr>
                <th className="bgtt aleft">进程别名</th>
                <th className="bgtt aleft">顾客</th>
                <th className="bgtt">类型</th>
                <th className="bgtt">状态</th>
                <th className="bgtt aleft">阶段 / 进度</th>
                <th className="bgtt">预扣</th>
                <th className="bgtt aleft">时间</th>
                <th className="bgtt">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((process) => (
                <tr key={process.id}>
                  <td className="aleft">
                    <span className="block max-w-[360px] truncate font-medium text-[#333]" title={process.alias}>{process.alias}</span>
                    <span className="mt-1 block font-mono text-[11px] text-[#999]">{process.id}</span>
                    {process.providerTaskId ? (
                      <span className="mt-1 block truncate font-mono text-[11px] text-[#777]">provider: {process.providerTaskId}</span>
                    ) : null}
                  </td>
                  <td className="aleft max-w-[180px] truncate text-[#666]">{process.customerEmail}</td>
                  <td><span className="tag_gray">{process.kindLabel}</span></td>
                  <td><StatusPill label={process.displayStatus} tone={process.tone} /></td>
                  <td className="aleft">
                    <span className="block text-[12px] text-[#333]">{process.stageLabel} · {progressLabel(process)}</span>
                    <span className="mt-1 block text-[11px] text-[#777]">{process.outputSlotSummary}</span>
                    <span className="mt-1 block font-mono text-[11px] text-[#999]">运行 {formatDuration(process.runtimeMs)}</span>
                  </td>
                  <td className="font-mono text-[#333]">{process.creditsReserved} 点</td>
                  <td className="aleft text-[11px] text-[#777]">
                    <span className="block">创建 {formatDateTime(process.createdAt)}</span>
                    <span className="mt-1 block">更新 {formatDateTime(process.updatedAt)}</span>
                  </td>
                  <td>
                    <div className="flex flex-wrap justify-center gap-2">
                      {process.canRecoverVideo ? (
                        <button
                          className="admin_btn inline-flex h-[30px] shrink-0 items-center gap-1 whitespace-nowrap disabled:opacity-35"
                          disabled={recoveringId === process.id}
                          onClick={() => recoverVideoProcess(process)}
                          type="button"
                        >
                          {recoveringId === process.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.8} />
                          ) : (
                            <FileDown className="h-3 w-3" strokeWidth={1.8} />
                          )}
                          恢复视频
                        </button>
                      ) : null}
                      <button
                        className="admin_btn inline-flex h-[30px] shrink-0 items-center gap-1 whitespace-nowrap disabled:opacity-35"
                        disabled={!process.canTerminate || terminatingId === process.id}
                        onClick={() => terminateProcess(process)}
                        type="button"
                      >
                        {terminatingId === process.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.8} />
                        ) : (
                          <CircleStop className="h-3 w-3" strokeWidth={1.8} />
                        )}
                        终止
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td className="text-center text-[#999]" colSpan={8}>
                    {loading ? "进程加载中..." : hasActiveSearch ? "没有匹配的进程。" : "暂无进程。"}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <AdminPagination
          total={payload.pageInfo.total}
          page={currentPage}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(1);
          }}
        />
      </ErpSection>
    </div>
  );
}
