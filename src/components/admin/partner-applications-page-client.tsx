"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Eye, Handshake, Search, ShieldCheck } from "lucide-react";
import { fetchAdminJson } from "@/components/admin/admin-api-client";
import { AdminPagination, clampPage, pageItems } from "@/components/admin/admin-pagination";
import { ErpSection, ErpStatGrid } from "@/components/admin/erp-primitives";
import { downloadCsv } from "@/components/admin/export-utils";
import { PartnerApplicationReviewPanel } from "@/components/admin/partner-application-review-panel";
import type { PartnerApplication, PartnerApplicationStatus } from "@/lib/types";
import { StatusPill } from "@/components/ui";

type StatusFilter = PartnerApplicationStatus | "all";
type Tone = "good" | "warn" | "bad" | "neutral";

type PartnerApplicationsPayload = {
  ok?: boolean;
  applications?: PartnerApplication[];
  stats?: Record<PartnerApplicationStatus | "total", number>;
  error?: string;
};

const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "全部状态" },
  { value: "pending", label: "待审核" },
  { value: "approved", label: "已通过" },
  { value: "rejected", label: "已拒绝" },
  { value: "archived", label: "已归档" }
];

const statusLabels: Record<PartnerApplicationStatus, string> = {
  pending: "待审核",
  approved: "已通过",
  rejected: "已拒绝",
  archived: "已归档"
};

function emptyStats(): Record<PartnerApplicationStatus | "total", number> {
  return { total: 0, pending: 0, approved: 0, rejected: 0, archived: 0 };
}

function statusTone(status: PartnerApplicationStatus): Tone {
  if (status === "approved") return "good";
  if (status === "rejected") return "bad";
  if (status === "pending") return "warn";
  return "neutral";
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function statusLabel(status: PartnerApplicationStatus) {
  return statusLabels[status];
}

function mergeApplication(items: PartnerApplication[], next: PartnerApplication) {
  return items.map((item) => (item.id === next.id ? next : item));
}

function computeStats(items: PartnerApplication[]) {
  const stats = emptyStats();
  for (const item of items) {
    stats.total += 1;
    stats[item.status] += 1;
  }
  return stats;
}

export function PartnerApplicationsPageClient({ siteId }: { siteId: string }) {
  const [applications, setApplications] = useState<PartnerApplication[]>([]);
  const [stats, setStats] = useState(() => emptyStats());
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [message, setMessage] = useState("正在加载推广合作者申请...");
  const [loading, setLoading] = useState(true);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    const controller = new AbortController();
    async function loadApplications() {
      setLoading(true);
      setMessage("正在加载推广合作者申请...");
      const params = new URLSearchParams({
        status: statusFilter,
        take: "100"
      });
      if (query.trim()) params.set("q", query.trim());
      try {
        const response = await fetchAdminJson<PartnerApplicationsPayload>(`/api/sites/${siteId}/admin/partner-applications-page?${params.toString()}`, {
          init: { signal: controller.signal },
          ttlMs: 0
        });
        if (controller.signal.aborted) return;
        if (!response.ok) throw new Error(response.data.error ?? "推广合作者申请加载失败。");
        const nextApplications = response.data.applications ?? [];
        setApplications(nextApplications);
        setStats(response.data.stats ?? computeStats(nextApplications));
        setMessage(nextApplications.length ? `已加载 ${nextApplications.length} 条申请。` : "当前筛选下没有推广合作者申请。");
      } catch (error) {
        if (controller.signal.aborted) return;
        setMessage(error instanceof Error ? error.message : "推广合作者申请加载失败。");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    const timer = window.setTimeout(() => void loadApplications(), query.trim() ? 220 : 0);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, siteId, statusFilter]);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return applications.filter((application) => {
      if (statusFilter !== "all" && application.status !== statusFilter) return false;
      if (!normalized) return true;
      return [
        application.id,
        application.name,
        application.email,
        application.company ?? "",
        application.website ?? "",
        application.audience ?? "",
        application.campaignIdeas ?? "",
        application.message ?? ""
      ].join(" ").toLowerCase().includes(normalized);
    });
  }, [applications, query, statusFilter]);

  const currentPage = clampPage(page, filteredItems.length, pageSize);
  const pagedItems = pageItems(filteredItems, currentPage, pageSize);
  const selectedApplication = selectedApplicationId ? applications.find((item) => item.id === selectedApplicationId) : undefined;

  useEffect(() => setPage(1), [query, statusFilter, pageSize]);
  useEffect(() => {
    if (page !== currentPage) setPage(currentPage);
  }, [currentPage, page]);

  function resetFilters() {
    setQuery("");
    setStatusFilter("pending");
  }

  function exportApplications() {
    downloadCsv(
      `${siteId}-partner-applications.csv`,
      filteredItems.map((application) => ({
        申请ID: application.id,
        姓名: application.name,
        邮箱: application.email,
        公司: application.company ?? "",
        站点: application.website ?? "",
        状态: statusLabel(application.status),
        来源: application.source ?? "",
        提交时间: application.createdAt,
        审核时间: application.reviewedAt ?? "",
        审核备注: application.reviewNote ?? ""
      })),
      ["申请ID", "姓名", "邮箱", "公司", "站点", "状态", "来源", "提交时间", "审核时间", "审核备注"]
    );
    setMessage(`已导出 ${filteredItems.length} 条申请记录。`);
  }

  function handleReviewed(application: PartnerApplication) {
    setApplications((current) => mergeApplication(current, application));
    setStats((current) => {
      if (statusFilter === "all") return computeStats(mergeApplication(applications, application));
      return { ...current, ...computeStats(mergeApplication(applications, application)) };
    });
  }

  return (
    <div className="grid gap-5">
      <ErpStatGrid
        items={[
          { label: "总申请", value: String(stats.total), detail: "本站累计推广合作者申请", icon: Handshake, tone: stats.total ? "good" : "neutral" },
          { label: "待审核", value: String(stats.pending), detail: "需要运营确认的申请", icon: Search, tone: stats.pending ? "warn" : "good" },
          { label: "已通过", value: String(stats.approved), detail: "可进入后续合作流程", icon: ShieldCheck, tone: stats.approved ? "good" : "neutral" },
          { label: "已拒绝/归档", value: String(stats.rejected + stats.archived), detail: "不再推进或暂存归档", icon: Download, tone: stats.rejected ? "bad" : "neutral" }
        ]}
      />

      <ErpSection
        description="查看本站推广合作者提交的渠道、受众、合作节奏和活动想法，并在详情面板里通过、拒绝、归档或退回待审。"
        eyebrow="Partner Applications"
        title="推广合作者申请"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-clay">申请审核</p>
            <h2 className="mt-2 text-xl font-semibold">合作者申请列表</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-500">{message}</p>
          </div>
          <button className="inline-flex shrink-0 items-center whitespace-nowrap rounded-[8px] border border-black/10 px-4 py-2 text-sm active:scale-[0.98]" onClick={exportApplications} type="button">
            <Download className="mr-2 inline h-4 w-4" strokeWidth={1.8} />
            导出 CSV
          </button>
        </div>

        <div className="mt-5 rounded-[12px] border border-zinc-200 bg-zinc-50 p-4">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="whitespace-nowrap rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-zinc-500">共 {stats.total} 条</span>
            <span className="whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-700">{stats.pending} 待审核</span>
            <span className="whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700">{stats.approved} 已通过</span>
            <span className="whitespace-nowrap rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-rose-700">{stats.rejected} 已拒绝</span>
            <span className="whitespace-nowrap rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-zinc-500">{stats.archived} 已归档</span>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(220px,1fr)_170px_auto]">
            <input className="rounded-[8px] border border-black/10 bg-white px-3 py-2 text-sm" onChange={(event) => setQuery(event.target.value)} placeholder="搜索姓名、邮箱、公司、受众" value={query} />
            <select className="rounded-[8px] border border-black/10 bg-white px-3 py-2 text-sm" onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} value={statusFilter}>
              {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <button className="shrink-0 whitespace-nowrap rounded-[8px] border border-black/10 bg-white px-4 py-2 text-sm active:scale-[0.98]" onClick={resetFilters} type="button">重置</button>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-[12px] border border-zinc-200 bg-white">
          <div className="overflow-x-auto">
            <table className="list min-w-[1080px]">
              <thead>
                <tr>
                  <th className="bgtt aleft">申请人</th>
                  <th className="bgtt aleft">公司/渠道</th>
                  <th className="bgtt aleft">受众摘要</th>
                  <th className="bgtt">来源</th>
                  <th className="bgtt">提交时间</th>
                  <th className="bgtt">状态</th>
                  <th className="bgtt">操作</th>
                </tr>
              </thead>
              <tbody>
                {pagedItems.map((application) => (
                  <tr key={application.id}>
                    <td className="aleft">
                      <span className="block max-w-[180px] truncate font-medium text-zinc-950">{application.name}</span>
                      <span className="block max-w-[220px] truncate text-xs text-zinc-500">{application.email}</span>
                      <span className="font-mono text-[11px] text-zinc-400">{application.id}</span>
                    </td>
                    <td className="aleft">
                      <span className="block max-w-[190px] truncate text-zinc-700">{application.company ?? "未填写公司"}</span>
                      <span className="block max-w-[220px] truncate text-[11px] text-zinc-400">{application.website ?? application.socialLinks?.[0] ?? "未填写渠道"}</span>
                    </td>
                    <td className="aleft max-w-[300px] truncate text-zinc-600">{application.audience ?? application.campaignIdeas ?? "未填写"}</td>
                    <td>{application.source ?? "partner-registration"}</td>
                    <td className="font-mono text-[11px] text-zinc-500">{formatDate(application.createdAt)}</td>
                    <td><StatusPill label={statusLabel(application.status)} tone={statusTone(application.status)} /></td>
                    <td>
                      <button className="admin_btn inline-flex h-[30px] items-center gap-1 whitespace-nowrap" onClick={() => setSelectedApplicationId(application.id)} type="button">
                        <Eye className="h-3.5 w-3.5" strokeWidth={1.8} />详情
                      </button>
                    </td>
                  </tr>
                ))}
                {!filteredItems.length ? (
                  <tr>
                    <td className="text-left text-zinc-600" colSpan={7}>
                      <div className="rounded-[10px] border border-dashed border-zinc-300 bg-zinc-50 p-5">
                        <p className="font-semibold text-zinc-900">{loading ? "推广合作者申请加载中..." : "当前筛选下没有推广合作者申请。"}</p>
                        <p className="mt-2 leading-6">申请提交后会进入这里。运营可以先查看渠道链接、受众描述和活动想法，再在详情面板里更新审核状态并记录备注。</p>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
        <AdminPagination page={currentPage} pageSize={pageSize} total={filteredItems.length} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </ErpSection>

      {selectedApplication ? (
        <PartnerApplicationReviewPanel
          application={selectedApplication}
          onClose={() => setSelectedApplicationId(null)}
          onReviewed={handleReviewed}
          siteId={siteId}
        />
      ) : null}
    </div>
  );
}
