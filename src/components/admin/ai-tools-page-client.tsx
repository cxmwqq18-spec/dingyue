"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, Bot, CheckCircle2, CreditCard, FileImage, Route, Settings2 } from "lucide-react";
import { fetchAdminJson } from "@/components/admin/admin-api-client";
import { AiBindableToolsList } from "@/components/admin/ai-bindable-tools-list";
import { AiToolsEditor } from "@/components/admin/ai-tools-editor";
import { ErpInfoList, ErpSection, ErpStatGrid, ErpToolbar, ErpToolbarAction, ErpToolbarField } from "@/components/admin/erp-primitives";
import { JobsAdminPanel } from "@/components/admin/jobs-admin-panel";
import { OpsCard, StatusPill } from "@/components/ui";
import type { AiApp, GenerationJob, PublicCustomer, SiteAiApp } from "@/lib/types";

type CustomerOption = Pick<PublicCustomer, "id" | "email">;

type Gateway = {
  name: string;
  status: string;
  usedQuota: number;
  monthlyQuota: number;
  accountPoolMode: string;
  rateLimitPerMinute: number;
} | null;

type AiToolsPagePayload = {
  apps: SiteAiApp[];
  jobs: GenerationJob[];
  customers: CustomerOption[];
  platformAiApps: AiApp[];
  gateway?: Gateway;
  jobCount?: number;
  failedJobs: number;
  openJobs: number;
  completedJobs: number;
  error?: string;
};

const gatewayStatusLabels: Record<string, string> = {
  active: "运行中",
  paused: "已暂停",
  disabled: "已停用",
  draft: "草稿"
};

function tone(status: string): "good" | "warn" | "bad" | "neutral" {
  if (status === "active" || status === "enabled" || status === "succeeded" || status === "fulfilled" || status === "paid" || status === "ready") return "good";
  if (status === "failed" || status === "refunded" || status === "blocked" || status === "canceled") return "bad";
  if (status === "pending" || status === "draft" || status === "past_due" || status === "running" || status === "queued" || status === "processing") return "warn";
  return "neutral";
}

function modulePath(siteSlug: string, path: string): string {
  return `/site/${siteSlug}${path}`;
}

function toolStatusText(activeAiApps: number, appCount: number) {
  if (!appCount) return "还没有可用工具";
  if (!activeAiApps) return "工具已安装，但未开放给前台";
  return `${activeAiApps} 个工具可在前台使用`;
}

function AiToolsSkeleton() {
  return (
    <div className="grid gap-5" aria-busy="true">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {["工具", "任务", "预扣", "重跑"].map((label) => (
          <div className="min-h-[116px] rounded-[8px] border border-[var(--admin-border-soft)] bg-white p-5" key={label}>
            <div className="h-3 w-20 rounded bg-slate-100" />
            <div className="mt-6 h-8 w-16 rounded bg-slate-100" />
            <div className="mt-3 h-3 w-28 rounded bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="rounded-[8px] border border-[var(--admin-border-soft)] bg-white p-6 text-sm text-[#667085]">
        AI 工具数据加载中...
      </div>
    </div>
  );
}

export function AiToolsPageClient({
  siteId,
  siteSlug,
  initialActiveAiApps,
  initialAppCount,
  initialOpenJobs,
  initialFailedJobs,
  initialReservedCredits
}: {
  siteId: string;
  siteSlug: string;
  initialActiveAiApps: number;
  initialAppCount: number;
  initialOpenJobs: number;
  initialFailedJobs: number;
  initialReservedCredits: number;
}) {
  const [payload, setPayload] = useState<AiToolsPagePayload | null>(null);
  const [jobsPayload, setJobsPayload] = useState<AiToolsPagePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobsLoading, setJobsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetchAdminJson<AiToolsPagePayload>(`/api/sites/${siteId}/admin/ai-page?detail=summary`, { init: { signal: controller.signal } });
        const result = response.data;
        if (cancelled) return;
        if (!response.ok) {
          setError(result.error ?? "AI 工具数据加载失败。");
          return;
        }
        setPayload(result);
      } catch {
        if (!cancelled && !controller.signal.aborted) setError("AI 工具数据加载失败。");
      }
    }
    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [siteId]);

  async function loadJobs() {
    setJobsLoading(true);
    try {
      const response = await fetchAdminJson<AiToolsPagePayload>(`/api/sites/${siteId}/admin/ai-page?detail=jobs`);
      const result = response.data;
      if (!response.ok) {
        setError(result.error ?? "AI 任务数据加载失败。");
        return;
      }
      setJobsPayload(result);
      setPayload((current) => current ? { ...current, ...result, apps: current.apps, gateway: current.gateway ?? result.gateway } : result);
    } catch {
      setError("AI 任务数据加载失败。");
    } finally {
      setJobsLoading(false);
    }
  }

  const activeAiApps = payload?.apps.filter((app) => app.enabled).length ?? initialActiveAiApps;
  const appCount = payload?.apps.length ?? initialAppCount;
  const openJobs = payload?.openJobs ?? initialOpenJobs;
  const failedJobs = payload?.failedJobs ?? initialFailedJobs;
  const completedJobs = payload?.completedJobs ?? 0;
  const jobCount = jobsPayload?.jobs.length ?? payload?.jobCount ?? openJobs + failedJobs + completedJobs;
  const reservedCredits = initialReservedCredits;
  const gateway = payload?.gateway ?? null;
  const gatewayUsage = gateway ? Math.round((gateway.usedQuota / Math.max(gateway.monthlyQuota, 1)) * 100) : 0;
  const enabledApps = payload?.apps.filter((app) => app.enabled) ?? [];
  const disabledApps = payload?.apps.filter((app) => !app.enabled) ?? [];
  const primaryApp = enabledApps[0] ?? payload?.apps[0];
  const readyForFrontend = activeAiApps > 0 && Boolean(gateway);
  const actionCards = useMemo(
    () => [
      {
        title: "前台生成页",
        detail: "顾客在这里上传参考图、选择 AI 工具并提交生成请求。",
        href: modulePath(siteSlug, "/tools"),
        icon: FileImage,
        label: "打开生成页"
      },
      {
        title: "顾客进度页",
        detail: "顾客提交后，在这里查看排队、生成中、完成和失败状态。",
        href: modulePath(siteSlug, "/app/jobs/progress"),
        icon: Activity,
        label: "查看进度页"
      },
      {
        title: "表单绑定",
        detail: "把装修器里的生成表单绑定到已启用工具，前台才会出现入口。",
        href: modulePath(siteSlug, "/admin/design"),
        icon: Settings2,
        label: "去绑定表单"
      }
    ],
    [siteSlug]
  );

  if (error) {
    return (
      <div className="rounded-[8px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {error}
      </div>
    );
  }

  if (!payload) {
    return <AiToolsSkeleton />;
  }

  return (
    <div className="grid gap-5">
      <div className="rounded-[8px] border border-[var(--admin-border-soft)] bg-white p-5 shadow-[0_14px_28px_-32px_rgba(15,23,42,0.2)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-[760px]">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill label={readyForFrontend ? "前台可用" : "需要配置"} tone={readyForFrontend ? "good" : "warn"} />
              <span className="rounded-[6px] border border-[var(--admin-border-soft)] bg-[var(--admin-panel)] px-2.5 py-1 font-mono text-[11px] text-[#667085]">
                {toolStatusText(activeAiApps, appCount)}
              </span>
            </div>
            <h2 className="mt-3 text-[20px] font-semibold leading-7 text-[var(--admin-text)]">AI 工厂负责前台生成链路</h2>
            <p className="mt-2 text-[13px] leading-6 text-[#667085]">
              这里维护顾客能用哪个 AI 工具、每次扣多少积分、请求发往哪条 worker 路由，以及失败任务是否需要重跑。前台生成页、进度页和相册交付都读取这些配置。
            </p>
          </div>
          <div className="grid min-w-[280px] gap-2 text-[12px] text-[#667085] sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-[8px] border border-[var(--admin-border-soft)] bg-[var(--admin-panel)] px-3 py-2">
              <span className="block text-[#98a2b3]">当前工具</span>
              <span className="mt-1 block truncate font-medium text-[var(--admin-text)]">{primaryApp?.aiApp.name ?? "未安装工具"}</span>
            </div>
            <div className="rounded-[8px] border border-[var(--admin-border-soft)] bg-[var(--admin-panel)] px-3 py-2">
              <span className="block text-[#98a2b3]">Worker 路由</span>
              <span className="mt-1 block truncate font-mono text-[var(--admin-text)]">{primaryApp?.routeKey ?? "未配置"}</span>
            </div>
          </div>
        </div>
      </div>

      <ErpStatGrid
        items={[
          { label: "前台工具", value: `${activeAiApps}/${appCount}`, detail: activeAiApps ? "顾客可提交生成请求" : "先启用至少一个工具", icon: Bot, tone: activeAiApps ? "good" : "warn" },
          { label: "每次扣费", value: primaryApp ? `${primaryApp.creditCost}` : "0", detail: "顾客提交时扣除的积分", icon: CreditCard, tone: primaryApp?.creditCost ? "good" : "warn" },
          { label: "处理中任务", value: String(openJobs), detail: "排队中或生成中", icon: Activity, tone: openJobs ? "warn" : "good" },
          { label: "需要处理", value: String(failedJobs), detail: "失败任务可加载明细后重跑", icon: CheckCircle2, tone: failedJobs ? "bad" : "good" }
        ]}
      />

      <div className="grid gap-3 xl:grid-cols-3">
        {actionCards.map((item) => (
          <a
            className="group flex min-h-[116px] items-start gap-3 rounded-[8px] border border-[var(--admin-border-soft)] bg-white p-4 transition hover:border-[#bfd5fb] hover:bg-[#fbfdff]"
            href={item.href}
            key={item.title}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] border border-[var(--admin-border-soft)] bg-[var(--admin-panel)] text-[#2f6fed]">
              <item.icon className="h-4 w-4" strokeWidth={1.8} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-[var(--admin-text)]">{item.title}</span>
              <span className="mt-1 block text-[12px] leading-5 text-[#667085]">{item.detail}</span>
              <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-[#2f6fed]">
                {item.label}
                <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" strokeWidth={1.8} />
              </span>
            </span>
          </a>
        ))}
      </div>

      <div className="grid gap-5">
        <ErpSection
          action={<ErpToolbarAction href={modulePath(siteSlug, "/admin/design")} label="前台表单绑定" />}
          description="这里维护当前站点实际会用的 AI 工具配置。工具名称和说明来自平台目录；本站只维护是否开放、扣费积分和 worker 路由。"
          eyebrow="本站维护"
          title="AI 工具开关、扣费和路由"
        >
          <ErpToolbar>
            <div className="flex flex-wrap gap-3">
              <ErpToolbarField label="可用工具" value={`${activeAiApps}/${appCount}`} />
              <ErpToolbarField label="停用工具" value={String(disabledApps.length)} />
              <ErpToolbarField label="默认扣费" value={primaryApp ? `${primaryApp.creditCost} 点` : "未配置"} />
              <ErpToolbarField label="Worker 路由" value={primaryApp?.routeKey ?? "未配置"} />
            </div>
          </ErpToolbar>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {[
              { label: "值从哪里来", detail: "Image Studio 的名称、说明和 slug 来自平台 AiApp 工具目录；表格里的启用、扣费和 routeKey 来自本站 SiteAiApp 配置。" },
              { label: "这些值做什么", detail: "顾客提交生成任务时，系统按扣费值预留积分，并把 routeKey 写入任务请求，交给 worker 或 n8n 执行。" },
              { label: "在哪里维护", detail: "本站配置就在下方表格维护；平台工具目录目前不是本站后台字段，网关账号在平台后台的 AI 网关维护。" }
            ].map((item) => (
              <div className="rounded-[8px] border border-[var(--admin-border-soft)] bg-[var(--admin-panel)] px-3 py-3" key={item.label}>
                <p className="text-[12px] font-semibold text-[var(--admin-text)]">{item.label}</p>
                <p className="mt-1 text-[12px] leading-5 text-[#667085]">{item.detail}</p>
              </div>
            ))}
          </div>
          <div className="mt-5">
            <AiToolsEditor apps={payload.apps} siteId={siteId} />
          </div>
        </ErpSection>

        <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
          <OpsCard className="p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] border border-[var(--admin-border-soft)] bg-[var(--admin-panel)] text-[#2f6fed]">
                <Route className="h-4 w-4" strokeWidth={1.8} />
              </span>
              <span className="min-w-0">
                <h2 className="text-[15px] font-semibold text-[var(--admin-text)]">Worker 路由</h2>
                <p className="mt-1 text-[12px] leading-5 text-[#667085]">
                  后台保存的路由会跟随顾客生成请求发给 worker。路由改错时，前台能提交，但任务会在 worker 侧失败。
                </p>
              </span>
            </div>
            <div className="mt-4">
              <ErpInfoList
                items={[
                  { label: "当前网关", value: gateway?.name ?? "未配置", tone: gateway ? "good" : "warn" },
                  { label: "网关状态", value: gateway ? gatewayStatusLabels[gateway.status] ?? gateway.status : "待配置", tone: gateway ? tone(gateway.status) : "warn" },
                  { label: "每分钟限制", value: gateway ? `${gateway.rateLimitPerMinute} 次` : "未配置", tone: gateway ? "neutral" : "warn" },
                  { label: "本月用量", value: gateway ? `${gateway.usedQuota}/${gateway.monthlyQuota}` : "未配置", tone: gatewayUsage > 85 ? "warn" : gateway ? "good" : "warn" }
                ]}
              />
            </div>
          </OpsCard>

          <OpsCard className="p-5">
            <h2 className="text-[15px] font-semibold text-[var(--admin-text)]">顾客提交后发生什么</h2>
            <div className="mt-4 grid gap-2">
              {[
                { label: "1. 提交", detail: "前台生成页读取已启用工具和扣费点数。" },
                { label: "2. 扣费", detail: "创建任务时先预留积分，防止重复消费。" },
                { label: "3. 生成", detail: "worker 按 routeKey 处理请求，并回写任务结果。" },
                { label: "4. 交付", detail: "成功结果进入顾客相册；失败任务可在后台重跑。" }
              ].map((item) => (
                <div className="rounded-[8px] border border-[var(--admin-border-soft)] bg-[var(--admin-panel)] px-3 py-2" key={item.label}>
                  <span className="text-[12px] font-semibold text-[var(--admin-text)]">{item.label}</span>
                  <span className="ml-2 text-[12px] leading-5 text-[#667085]">{item.detail}</span>
                </div>
              ))}
            </div>
          </OpsCard>
        </div>

        <ErpSection
          action={<ErpToolbarAction href={modulePath(siteSlug, "/admin/customers")} label="顾客列表" />}
          description="进入页面时只加载任务数量。需要排查某个顾客生成失败时，再加载明细表，避免历史任务拖慢页面。"
          eyebrow="任务处理"
          title="生成任务处理"
        >
          <ErpToolbar>
            <div className="flex flex-wrap gap-3">
              <ErpToolbarField label="总任务" value={String(jobCount)} />
              <ErpToolbarField label="运行中" value={String(openJobs)} />
              <ErpToolbarField label="失败" value={String(failedJobs)} />
            </div>
          </ErpToolbar>
          <div className="mt-5">
            {jobsPayload ? (
              <JobsAdminPanel aiApps={jobsPayload.platformAiApps} customers={jobsPayload.customers} jobs={jobsPayload.jobs} siteId={siteId} />
            ) : (
              <div className="rounded-[8px] border border-dashed border-[var(--admin-border-soft)] bg-white px-4 py-6 text-[13px] leading-6 text-[#667085]">
                任务明细按需加载。只有需要查失败原因、确认顾客任务状态或重跑任务时才需要打开。
                <div className="mt-4">
                  <button className="admin_btn inline-flex h-[34px] items-center justify-center whitespace-nowrap px-3 disabled:opacity-55" disabled={jobsLoading} onClick={loadJobs} type="button">
                    {jobsLoading ? "加载中..." : "加载任务明细"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </ErpSection>
      </div>

      <ErpSection
        description="这里是只读预览，用来确认装修器生成表单能绑定哪些工具。实际维护请回到上方“本站 AI 工具维护”。"
        eyebrow="前后端对应"
        title="前台可绑定工具"
      >
        <AiBindableToolsList apps={payload.apps} />
      </ErpSection>
    </div>
  );
}
