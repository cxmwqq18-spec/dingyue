"use client";

import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { siteAdminJsonHeaders } from "@/lib/client-csrf";
import type { PartnerApplication, PartnerApplicationStatus } from "@/lib/types";
import { StatusPill } from "@/components/ui";

type Tone = "good" | "warn" | "bad" | "neutral";

const statusLabels: Record<PartnerApplicationStatus, string> = {
  pending: "待审核",
  approved: "已通过",
  rejected: "已拒绝",
  archived: "已归档"
};

function statusTone(status: PartnerApplicationStatus): Tone {
  if (status === "approved") return "good";
  if (status === "rejected") return "bad";
  if (status === "pending") return "warn";
  return "neutral";
}

function formatDate(value?: string) {
  if (!value) return "未记录";
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function DetailRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[110px_minmax(0,1fr)]">
      <span className="text-zinc-500">{label}</span>
      <span className="min-w-0 break-words text-zinc-800 [overflow-wrap:anywhere]">{value || "未填写"}</span>
    </div>
  );
}

export function PartnerApplicationReviewPanel({
  application,
  siteId,
  onClose,
  onReviewed
}: {
  application: PartnerApplication;
  siteId: string;
  onClose: () => void;
  onReviewed: (application: PartnerApplication) => void;
}) {
  const [reviewNote, setReviewNote] = useState(application.reviewNote ?? "");
  const [message, setMessage] = useState("查看渠道、受众和合作想法后更新审核状态。");
  const [submittingStatus, setSubmittingStatus] = useState<PartnerApplicationStatus | null>(null);

  const socialLinks = useMemo(() => application.socialLinks ?? [], [application.socialLinks]);

  async function updateStatus(status: PartnerApplicationStatus) {
    setSubmittingStatus(status);
    setMessage(`正在标记为${statusLabels[status]}...`);
    try {
      const response = await fetch(`/api/sites/${siteId}/partner-applications/${application.id}/status`, {
        method: "POST",
        headers: siteAdminJsonHeaders(siteId),
        body: JSON.stringify({ status, reviewNote })
      });
      const result = (await response.json().catch(() => ({}))) as { application?: PartnerApplication; error?: string };
      if (!response.ok || !result.application) {
        throw new Error(result.error || "partner_application_review_failed");
      }
      onReviewed(result.application);
      setMessage(`已标记为${statusLabels[result.application.status]}。`);
    } catch (error) {
      setMessage(error instanceof Error ? `审核失败：${error.message}` : "审核失败，请稍后重试。");
    } finally {
      setSubmittingStatus(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-[12px] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-clay">合作者申请详情</p>
            <h3 className="mt-1 break-words text-lg font-semibold text-zinc-950">{application.name}</h3>
            <div className="mt-2">
              <StatusPill label={statusLabels[application.status]} tone={statusTone(application.status)} />
            </div>
          </div>
          <button className="rounded-[8px] border border-black/10 px-3 py-1.5 text-sm" onClick={onClose} type="button">关闭</button>
        </div>

        <div className="grid gap-5 p-5">
          <div className="rounded-[10px] border border-zinc-200 bg-zinc-50 p-4">
            <div className="grid gap-2 text-sm">
              <DetailRow label="邮箱" value={application.email} />
              <DetailRow label="公司/团队" value={application.company} />
              <DetailRow label="站点" value={application.website} />
              <DetailRow label="来源" value={application.source} />
              <DetailRow label="提交 IP" value={typeof application.metadata?.ip === "string" ? application.metadata.ip : undefined} />
              <DetailRow label="提交时间" value={formatDate(application.createdAt)} />
              <DetailRow label="更新时间" value={formatDate(application.updatedAt)} />
              <DetailRow label="审核时间" value={formatDate(application.reviewedAt)} />
              <DetailRow label="审核人" value={application.reviewedBy} />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[10px] border border-zinc-200 p-4">
              <p className="text-sm font-semibold text-zinc-950">渠道链接</p>
              <div className="mt-3 grid gap-2 text-sm">
                {application.website ? (
                  <a className="inline-flex min-w-0 items-center gap-2 break-all text-clay hover:underline" href={application.website} rel="noreferrer" target="_blank">
                    <ExternalLink className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                    {application.website}
                  </a>
                ) : null}
                {socialLinks.map((link) => (
                  <a className="inline-flex min-w-0 items-center gap-2 break-all text-clay hover:underline" href={link} key={link} rel="noreferrer" target="_blank">
                    <ExternalLink className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                    {link}
                  </a>
                ))}
                {!application.website && !socialLinks.length ? <span className="text-zinc-500">未填写渠道链接</span> : null}
              </div>
            </div>

            <label className="grid gap-2 rounded-[10px] border border-zinc-200 p-4">
              <span className="text-sm font-semibold text-zinc-950">审核备注</span>
              <textarea
                className="min-h-[132px] rounded-[8px] border border-black/10 bg-white px-3 py-2 text-sm leading-6"
                onChange={(event) => setReviewNote(event.target.value)}
                placeholder="记录通过、拒绝或归档原因"
                value={reviewNote}
              />
            </label>
          </div>

          <div className="grid gap-4 text-sm">
            <div className="rounded-[10px] border border-zinc-200 bg-white p-4">
              <p className="font-semibold text-zinc-950">受众说明</p>
              <p className="mt-2 whitespace-pre-wrap leading-6 text-zinc-600">{application.audience || "未填写"}</p>
            </div>
            <div className="rounded-[10px] border border-zinc-200 bg-white p-4">
              <p className="font-semibold text-zinc-950">合作节奏</p>
              <p className="mt-2 whitespace-pre-wrap leading-6 text-zinc-600">{application.cadence || "未填写"}</p>
            </div>
            <div className="rounded-[10px] border border-zinc-200 bg-white p-4">
              <p className="font-semibold text-zinc-950">活动想法</p>
              <p className="mt-2 whitespace-pre-wrap leading-6 text-zinc-600">{application.campaignIdeas || "未填写"}</p>
            </div>
            <div className="rounded-[10px] border border-zinc-200 bg-white p-4">
              <p className="font-semibold text-zinc-950">补充留言</p>
              <p className="mt-2 whitespace-pre-wrap leading-6 text-zinc-600">{application.message || "未填写"}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-zinc-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-zinc-500">{message}</p>
            <div className="flex flex-wrap justify-end gap-2">
              <button className="rounded-[8px] border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 disabled:opacity-50" disabled={Boolean(submittingStatus) || application.status === "approved"} onClick={() => updateStatus("approved")} type="button">通过</button>
              <button className="rounded-[8px] border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 disabled:opacity-50" disabled={Boolean(submittingStatus) || application.status === "rejected"} onClick={() => updateStatus("rejected")} type="button">拒绝</button>
              <button className="rounded-[8px] border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm text-zinc-700 disabled:opacity-50" disabled={Boolean(submittingStatus) || application.status === "archived"} onClick={() => updateStatus("archived")} type="button">归档</button>
              <button className="rounded-[8px] border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700 disabled:opacity-50" disabled={Boolean(submittingStatus) || application.status === "pending"} onClick={() => updateStatus("pending")} type="button">退回待审</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
