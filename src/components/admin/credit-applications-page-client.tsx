"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Eye, Gift, Search, ShieldAlert } from "lucide-react";
import { fetchAdminJson } from "@/components/admin/admin-api-client";
import { AdminPagination, clampPage, pageItems } from "@/components/admin/admin-pagination";
import { ErpSection, ErpStatGrid } from "@/components/admin/erp-primitives";
import { downloadCsv } from "@/components/admin/export-utils";
import { CreditApplicationReviewPanel } from "@/components/admin/credit-application-review-panel";
import type { CreditApplication, CreditApplicationReviewContext, CreditApplicationStatus } from "@/lib/types";
import { StatusPill } from "@/components/ui";

type StatusFilter = CreditApplicationStatus | "all";
type Tone = "good" | "warn" | "bad" | "neutral";

type CreditApplicationsPayload = {
  ok?: boolean;
  applications?: CreditApplication[];
  stats?: Record<CreditApplicationStatus | "total", number>;
  contexts?: Record<string, CreditApplicationReviewContext>;
  quota?: { monthlyApproved: number; monthlyCap: number; grantOptions: number[]; lifetimeCap: number };
  error?: string;
};

const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "全部状态" },
  { value: "pending", label: "待审核" },
  { value: "approved", label: "已通过" },
  { value: "rejected", label: "已拒绝" },
  { value: "archived", label: "已归档" }
];

const statusLabels: Record<CreditApplicationStatus, string> = {
  pending: "待审核",
  approved: "已通过",
  rejected: "已拒绝",
  archived: "已归档"
};

const platformLabels: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  x: "X"
};

const followerTierLabels: Record<string, string> = {
  under_5k: "5K 以下",
  "5k_25k": "5K – 25K",
  "25k_100k": "25K – 100K",
  "100k_plus": "100K+"
};

const riskFlagLabels: Record<string, string> = {
  new_account_same_ip: "新号同 IP",
  ip_cluster: "IP 段聚集",
  zero_activity: "零活跃"
};

function emptyStats(): Record<CreditApplicationStatus | "total", number> {
  return { total: 0, pending: 0, approved: 0, rejected: 0, archived: 0 };
}

function statusTone(status: CreditApplicationStatus): Tone {
  if (status === "approved") return "good";
  if (status === "rejected") return "bad";
  if (status === "pending") return "warn";
  return "neutral";
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function mergeApplication(items: CreditApplication[], next: CreditApplication) {
  return items.map((item) => (item.id === next.id ? next : item));
}

function computeStats(items: CreditApplication[]) {
  const stats = emptyStats();
  for (const item of items) {
    stats.total += 1;
    stats[item.status] += 1;
  }
  return stats;
}

export function CreditApplicationsPageClient({ siteId }: { siteId: string }) {
  const [applications, setApplications] = useState<CreditApplication[]>([]);
  const [contexts, setContexts] = useState<Record<string, CreditApplicationReviewContext>>({});
  const [quota, setQuota] = useState({ monthlyApproved: 0, monthlyCap: 100, grantOptions: [20, 40, 60], lifetimeCap: 60 });
  const [stats, setStats] = useState(() => emptyStats());
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [message, setMessage] = useState("正在加载免费积分申请...");
  const [loading, setLoading] = useState(true);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    const controller = new AbortController();
    async function loadApplications() {
      setLoading(true);
      setMessage("正在加载免费积分申请...");
      const params = new URLSearchParams({
        status: statusFilter,
        take: "100"
      });
      if (query.trim()) params.set("q", query.trim());
      try {
        const response = await fetchAdminJson<CreditApplicationsPayload>(`/api/sites/${siteId}/admin/credit-applications-page?${params.toString()}`, {
          init: { signal: controller.signal },
          ttlMs: 0
        });
        if (controller.signal.aborted) return;
        if (!response.ok) throw new Error(response.data.error ?? "免费积分申请加载失败。");
        const nextApplications = response.data.applications ?? [];
        setApplications(nextApplications);
        setContexts(response.data.contexts ?? {});
        if (response.data.quota) setQuota(response.data.quota);
        setStats(response.data.stats ?? computeStats(nextApplications));
        setMessage(nextApplications.length ? `已加载 ${nextApplications.length} 条申请。` : "当前筛选下没有免费积分申请。");
      } catch (error) {
        if (controller.signal.aborted) return;
        setMessage(error instanceof Error ? error.message : "免费积分申请加载失败。");
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
        application.email,
        application.platform,
        application.profileUrl,
        application.followerTier,
        application.audience ?? "",
        application.message ?? "",
        ...(application.riskFlags ?? [])
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
      `${siteId}-credit-applications.csv`,
      filteredItems.map((application) => ({
        申请ID: application.id,
        邮箱: application.email,
        平台: platformLabels[application.platform] ?? application.platform,
        主页链接: application.profileUrl,
        粉丝档位: followerTierLabels[application.followerTier] ?? application.followerTier,
        风险旗标: (application.riskFlags ?? []).join(" ") || "",
        状态: statusLabels[application.status],
        发放积分: application.grantCredits ?? "",
        提交时间: application.createdAt,
        审核时间: application.reviewedAt ?? "",
        审核备注: application.reviewNote ?? ""
      })),
      ["申请ID", "邮箱", "平台", "主页链接", "粉丝档位", "风险旗标", "状态", "发放积分", "提交时间", "审核时间", "审核备注"]
    );
    setMessage(`已导出 ${filteredItems.length} 条申请记录。`);
  }

  function handleReviewed(application: CreditApplication) {
    setApplications((current) => mergeApplication(current, application));
    setStats((current) => {
      if (statusFilter === "all") return computeStats(mergeApplication(applications, application));
      return { ...current, ...computeStats(mergeApplication(applications, application)) };
    });
    if (application.status === "approved") {
      setQuota((current) => ({ ...current, monthlyApproved: current.monthlyApproved + 1 }));
    }
  }

  const monthlyRemaining = Math.max(0, quota.monthlyCap - quota.monthlyApproved);

  return (
    <div className="grid gap-5">
      <ErpStatGrid
        items={[
          { label: "总申请", value: String(stats.total), detail: "本站累计免费积分申请", icon: Gift, tone: stats.total ? "good" : "neutral" },
          { label: "待审核", value: String(stats.pending), detail: "需要人工确认的申请", icon: Search, tone: stats.pending ? "warn" : "good" },
          { label: "已通过", value: String(stats.approved), detail: "credits 已自动发放", icon: ShieldAlert, tone: stats.approved ? "good" : "neutral" },
          { label: "本月剩余配额", value: `${monthlyRemaining}/${quota.monthlyCap}`, detail: `本月已批准 ${quota.monthlyApproved} 单`, icon: Download, tone: monthlyRemaining ? "good" : "bad" }
        ]}
      />

      <ErpSection
        description="查看创作者提交的平台、主页、粉丝档位和带 #AivideosUGC 的帖子证据，在详情面板里检查风险旗标后批准或拒绝。"
        eyebrow="Free Credit Applications"
        title="免费积分申请"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-clay">积分审核</p>
            <h2 className="mt-2 text-xl font-semibold">创作者申请列表</h2>
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
            <span className="whitespace-nowrap rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-sky-700">本月剩余 {monthlyRemaining} 单</span>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(220px,1fr)_170px_auto]">
            <input className="rounded-[8px] border border-black/10 bg-white px-3 py-2 text-sm" onChange={(event) => setQuery(event.target.value)} placeholder="搜索邮箱、平台、链接、留言" value={query} />
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
                  <th className="bgtt aleft">申请者</th>
                  <th className="bgtt aleft">平台/主页</th>
                  <th className="bgtt aleft">粉丝档位</th>
                  <th className="bgtt aleft">风险旗标</th>
                  <th className="bgtt">提交时间</th>
                  <th className="bgtt">状态</th>
                  <th className="bgtt">操作</th>
                </tr>
              </thead>
              <tbody>
                {pagedItems.map((application) => (
                  <tr key={application.id}>
                    <td className="aleft">
                      <span className="block max-w-[220px] truncate font-medium text-zinc-950">{application.email}</span>
                      <span className="font-mono text-[11px] text-zinc-400">{application.id}</span>
                    </td>
                    <td className="aleft">
                      <span className="block max-w-[120px] truncate text-zinc-700">{platformLabels[application.platform] ?? application.platform}</span>
                      <span className="block max-w-[220px] truncate text-[11px] text-zinc-400">{application.profileUrl}</span>
                    </td>
                    <td className="aleft text-zinc-600">{followerTierLabels[application.followerTier] ?? application.followerTier}</td>
                    <td className="aleft">
                      {(application.riskFlags ?? []).length ? (
                        <div className="flex flex-wrap gap-1">
                          {(application.riskFlags ?? []).map((flag) => (
                            <span className="whitespace-nowrap rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] text-rose-700" key={flag}>{riskFlagLabels[flag] ?? flag}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-zinc-400">无</span>
                      )}
                    </td>
                    <td className="font-mono text-[11px] text-zinc-500">{formatDate(application.createdAt)}</td>
                    <td><StatusPill label={statusLabels[application.status]} tone={statusTone(application.status)} /></td>
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
                        <p className="font-semibold text-zinc-900">{loading ? "免费积分申请加载中..." : "当前筛选下没有免费积分申请。"}</p>
                        <p className="mt-2 leading-6">创作者在 /partners 页提交带 #AivideosUGC 的帖子后会进入这里。运营先核对风险旗标和账号上下文，再在详情面板里选择发放档位并批准。</p>
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
        <CreditApplicationReviewPanel
          application={selectedApplication}
          context={contexts[selectedApplication.id]}
          grantOptions={quota.grantOptions}
          monthlyRemaining={monthlyRemaining}
          onClose={() => setSelectedApplicationId(null)}
          onReviewed={handleReviewed}
          siteId={siteId}
        />
      ) : null}
    </div>
  );
}
