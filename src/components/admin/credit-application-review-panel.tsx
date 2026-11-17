"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { siteAdminJsonHeaders } from "@/lib/client-csrf";
import type { CreditApplication, CreditApplicationReviewContext } from "@/lib/types";
import { StatusPill } from "@/components/ui";

type Tone = "good" | "warn" | "bad" | "neutral";

const statusLabels: Record<CreditApplication["status"], string> = {
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
  new_account_same_ip: "新号同 IP：注册 IP 与提交 IP 相同且注册不足 24 小时",
  ip_cluster: "IP 段聚集：提交/注册 IP 的 /24 与 ≥2 条历史申请相同",
  zero_activity: "零活跃：该账号没有任何生成记录，也没有付费订单"
};

function statusTone(status: CreditApplication["status"]): Tone {
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
    <div className="grid gap-1 sm:grid-cols-[130px_minmax(0,1fr)]">
      <span className="text-zinc-500">{label}</span>
      <span className="min-w-0 break-words text-zinc-800 [overflow-wrap:anywhere]">{value || "未记录"}</span>
    </div>
  );
}

export function CreditApplicationReviewPanel({
  application,
  context,
  grantOptions,
  monthlyRemaining,
  siteId,
  onClose,
  onReviewed
}: {
  application: CreditApplication;
  context?: CreditApplicationReviewContext;
  grantOptions: number[];
  monthlyRemaining: number;
  siteId: string;
  onClose: () => void;
  onReviewed: (application: CreditApplication) => void;
}) {
  const [grantCredits, setGrantCredits] = useState(grantOptions[0] ?? 20);
  const [reviewNote, setReviewNote] = useState(application.reviewNote ?? "");
  const [message, setMessage] = useState("核对风险旗标和账号上下文后选择发放档位。批准即自动发放 credits 并发送邮件。");
  const [submitting, setSubmitting] = useState<string | null>(null);

  const evidencePosts = application.evidencePosts ?? [];
  const riskFlags = application.riskFlags ?? [];
  const canApprove = application.status === "pending";

  async function review(action: "approve" | "reject" | "archive") {
    setSubmitting(action);
    setMessage(action === "approve" ? "正在批准并发放积分..." : "正在更新审核状态...");
    try {
      const response = await fetch(`/api/sites/${siteId}/credit-applications/${application.id}/review`, {
        method: "POST",
        headers: siteAdminJsonHeaders(siteId),
        body: JSON.stringify({ action, grantCredits: action === "approve" ? grantCredits : undefined, note: reviewNote })
      });
      const result = (await response.json().catch(() => ({}))) as { application?: CreditApplication; error?: string };
      if (!response.ok || !result.application) {
        throw new Error(result.error || "credit_application_review_failed");
      }
      onReviewed(result.application);
      setMessage(
        result.application.status === "approved"
          ? `已批准并发放 ${result.application.grantCredits ?? grantCredits} credits，通知邮件已投递。`
          : `已标记为${statusLabels[result.application.status]}。`
      );
    } catch (error) {
      setMessage(error instanceof Error ? `审核失败：${error.message}` : "审核失败，请稍后重试。");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-[12px] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-clay">免费积分申请详情</p>
            <h3 className="mt-1 break-words text-lg font-semibold text-zinc-950">{application.email}</h3>
            <div className="mt-2">
              <StatusPill label={statusLabels[application.status]} tone={statusTone(application.status)} />
            </div>
          </div>
          <button className="rounded-[8px] border border-black/10 px-3 py-1.5 text-sm" onClick={onClose} type="button">关闭</button>
        </div>

        <div className="grid gap-5 p-5">
          {riskFlags.length ? (
            <div className="rounded-[10px] border border-rose-200 bg-rose-50 p-4">
              <p className="text-sm font-semibold text-rose-700">风险旗标（{riskFlags.length}）</p>
              <div className="mt-3 grid gap-2">
                {riskFlags.map((flag) => (
                  <div className="flex items-start gap-2" key={flag}>
                    <span className="shrink-0 rounded-full border border-rose-300 bg-white px-2 py-0.5 text-[11px] font-medium text-rose-700">{flag}</span>
                    <span className="text-sm leading-6 text-rose-700">{riskFlagLabels[flag] ?? "自定义旗标"}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[10px] border border-zinc-200 bg-zinc-50 p-4">
              <div className="grid gap-2 text-sm">
                <DetailRow label="申请 ID" value={application.id} />
                <DetailRow label="邮箱（归一化）" value={`${application.email} → ${application.canonicalEmail}`} />
                <DetailRow label="平台" value={platformLabels[application.platform] ?? application.platform} />
                <DetailRow label="粉丝档位" value={followerTierLabels[application.followerTier] ?? application.followerTier} />
                <DetailRow label="提交时间" value={formatDate(application.createdAt)} />
                <DetailRow label="审核时间" value={formatDate(application.reviewedAt)} />
                <DetailRow label="审核人" value={application.reviewedBy} />
              </div>
            </div>
            <div className="rounded-[10px] border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-sm font-semibold text-zinc-950">账号上下文</p>
              <div className="mt-3 grid gap-2 text-sm">
                <DetailRow label="账号年龄" value={context ? `${context.accountAgeDays} 天` : undefined} />
                <DetailRow label="注册 IP" value={context?.signupIp} />
                <DetailRow label="提交 IP" value={context?.submitIp ?? application.submitIp} />
                <DetailRow label="同 /24 历史申请" value={context ? `${context.sameSubnetHistoryCount} 条` : undefined} />
                <DetailRow label="生成次数" value={context ? `${context.generationCount} 次` : undefined} />
                <DetailRow label="付费订单" value={context ? `${context.paidOrderCount} 笔` : undefined} />
              </div>
            </div>
          </div>

          <div className="rounded-[10px] border border-zinc-200 p-4">
            <p className="text-sm font-semibold text-zinc-950">帖子证据（可点开核对 #AIVideosUGC）</p>
            <div className="mt-3 grid gap-2 text-sm">
              <a className="inline-flex min-w-0 items-center gap-2 break-all text-clay hover:underline" href={application.profileUrl} rel="noreferrer" target="_blank">
                <ExternalLink className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                主页：{application.profileUrl}
              </a>
              {evidencePosts.map((post) => (
                <a className="inline-flex min-w-0 items-center gap-2 break-all text-clay hover:underline" href={post.url} key={post.urlHash} rel="noreferrer" target="_blank">
                  <ExternalLink className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                  {post.url}
                </a>
              ))}
              {!evidencePosts.length ? <span className="text-zinc-500">未填写帖子链接</span> : null}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[10px] border border-zinc-200 bg-white p-4">
              <p className="font-semibold text-zinc-950">受众说明</p>
              <p className="mt-2 whitespace-pre-wrap leading-6 text-zinc-600">{application.audience || "未填写"}</p>
            </div>
            <div className="rounded-[10px] border border-zinc-200 bg-white p-4">
              <p className="font-semibold text-zinc-950">补充留言</p>
              <p className="mt-2 whitespace-pre-wrap leading-6 text-zinc-600">{application.message || "未填写"}</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="grid gap-2 rounded-[10px] border border-zinc-200 p-4">
              <span className="text-sm font-semibold text-zinc-950">发放档位</span>
              <select
                className="rounded-[8px] border border-black/10 bg-white px-3 py-2 text-sm"
                disabled={!canApprove || Boolean(submitting)}
                onChange={(event) => setGrantCredits(Number(event.target.value))}
                value={grantCredits}
              >
                {(grantOptions.length ? grantOptions : [20, 40, 60]).map((option) => (
                  <option key={option} value={option}>{option} credits ＝ {Math.floor(option / 20)} 条 15s 视频</option>
                ))}
              </select>
              <span className="text-xs leading-5 text-zinc-500">单人终身 60 credits 上限；全站本月剩余 {monthlyRemaining} 单。</span>
            </label>
            <label className="grid gap-2 rounded-[10px] border border-zinc-200 p-4">
              <span className="text-sm font-semibold text-zinc-950">审核备注</span>
              <textarea
                className="min-h-[92px] rounded-[8px] border border-black/10 bg-white px-3 py-2 text-sm leading-6"
                onChange={(event) => setReviewNote(event.target.value)}
                placeholder="记录通过或拒绝原因，会随通知邮件发给申请者"
                value={reviewNote}
              />
            </label>
          </div>

          <div className="flex flex-col gap-3 border-t border-zinc-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-zinc-500">{message}</p>
            <div className="flex flex-wrap justify-end gap-2">
              <button className="rounded-[8px] border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 disabled:opacity-50" disabled={!canApprove || Boolean(submitting)} onClick={() => review("approve")} type="button">批准并发放</button>
              <button className="rounded-[8px] border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 disabled:opacity-50" disabled={Boolean(submitting) || application.status === "rejected"} onClick={() => review("reject")} type="button">拒绝</button>
              <button className="rounded-[8px] border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm text-zinc-700 disabled:opacity-50" disabled={Boolean(submitting) || application.status === "archived"} onClick={() => review("archive")} type="button">归档</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
