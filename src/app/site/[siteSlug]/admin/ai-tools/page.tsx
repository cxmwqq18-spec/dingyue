import { Activity, Bot, Database, RotateCcw } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { ErpInfoList, ErpSection, ErpStatGrid, ErpToolbar, ErpToolbarAction, ErpToolbarField } from "@/components/admin/erp-primitives";
import { AiToolsEditor } from "@/components/admin/ai-tools-editor";
import { JobsAdminPanel } from "@/components/admin/jobs-admin-panel";
import { OpsCard, StatusPill } from "@/components/ui";
import {
  getSiteAdminData,
  modulePath,
  siteAdminAccount,
  siteAdminCommandActions,
  siteAdminModuleLinks,
  siteAdminNav,
  siteAdminQuickActions,
  siteAdminStats,
  siteAdminWorkspace
} from "../_lib/site-admin-context";

export default async function AiToolsPage({ params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  const data = await getSiteAdminData(siteSlug);
  const gatewayUsage = data.gateway ? Math.round((data.gateway.usedQuota / Math.max(data.gateway.monthlyQuota, 1)) * 100) : 0;

  return (
    <AdminShell
      activeModuleCode="ai"
      account={siteAdminAccount(data.site, data.current)}
      action={{ label: "打开生成页", href: `/site/${data.site.slug}/tools/image-studio` }}
      breadcrumbs={[
        { label: "店铺管理", href: modulePath(data.site, "/admin") },
        { label: "AI 工具" }
      ]}
      brand={data.site.branding.logoText}
      commandActions={siteAdminCommandActions(data.site, data)}
      eyebrow="AI worker operations"
      moduleLinks={siteAdminModuleLinks}
      nav={siteAdminNav(data.site, data)}
      quickActions={siteAdminQuickActions(data.site, data)}
      siteSlug={data.site.slug}
      stats={siteAdminStats(data)}
      subtitle="AI 工具启用、扣费规则、worker route、任务队列和失败重跑都在本站后台处理；N8N 只作为 worker，不决定 credits。"
      title="AI 工具"
      titleBadge={String(data.apps.length)}
      workspace={siteAdminWorkspace(data, "AI workspace")}
      rightRail={
        <>
          <OpsCard className="p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">gateway</p>
            <h2 className="mt-2 text-lg font-semibold">Provider routing</h2>
            {data.gateway ? (
              <div className="mt-4 rounded-[12px] border border-zinc-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{data.gateway.name}</p>
                  <StatusPill label={data.gateway.status} tone={data.statusTone(data.gateway.status)} />
                </div>
                <p className="mt-2 font-mono text-xs text-zinc-500">{data.gateway.accountPoolMode} / {data.gateway.rateLimitPerMinute} rpm</p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-100">
                  <div className="h-full rounded-full bg-zinc-950" style={{ width: `${gatewayUsage}%` }} />
                </div>
                <p className="mt-2 text-xs text-zinc-500">{data.gateway.usedQuota}/{data.gateway.monthlyQuota} monthly quota</p>
              </div>
            ) : (
              <div className="mt-4 rounded-[12px] border border-zinc-200 bg-white p-4 text-sm text-zinc-600">No gateway group configured.</div>
            )}
          </OpsCard>

          <OpsCard className="p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">worker contract</p>
            <h2 className="mt-2 text-lg font-semibold">任务结算规则</h2>
            <div className="mt-4">
              <ErpInfoList
                items={[
                  { label: "Reserve", value: "创建任务先 reserve credits", tone: "warn" },
                  { label: "Consume", value: "成功回调后 consume 并写相册", tone: "good" },
                  { label: "Release", value: "失败、超时或退款后 release", tone: "neutral" },
                  { label: "Idempotent", value: "重复回调不能重复结算", tone: "good" }
                ]}
              />
            </div>
          </OpsCard>
        </>
      }
    >
      <div className="grid gap-5">
        <ErpStatGrid
          items={[
            { label: "tools", value: `${data.activeAiApps}/${data.apps.length}`, detail: "enabled tools / installed tools", icon: Bot, tone: data.activeAiApps ? "good" : "warn" },
            { label: "jobs", value: String(data.jobs.length), detail: `${data.completedJobs} succeeded`, icon: Activity, tone: data.failedJobs ? "bad" : data.openJobs ? "warn" : "good" },
            { label: "reserved", value: String(data.reservedCredits), detail: "credits reserved", icon: Database, tone: data.reservedCredits ? "warn" : "good" },
            { label: "rerun queue", value: String(data.failedJobs), detail: "failed or refunded jobs", icon: RotateCcw, tone: data.failedJobs ? "bad" : "good" }
          ]}
        />

        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <ErpSection
            action={<ErpToolbarAction href={modulePath(data.site, "/admin/design")} label="前台表单绑定" />}
            description="控制本站 AI 工具是否启用、每次运行消耗多少 credits，以及走哪条 worker route。"
            eyebrow="tool configuration"
            title="工具配置"
          >
            <ErpToolbar>
              <div className="flex flex-wrap gap-3">
                <ErpToolbarField label="已启用" value={`${data.activeAiApps}/${data.apps.length}`} />
                <ErpToolbarField label="路由组" value={data.gateway?.name ?? "missing"} />
              </div>
            </ErpToolbar>
            <div className="mt-5">
              <AiToolsEditor apps={data.apps} siteId={data.site.id} />
            </div>
          </ErpSection>
          <ErpSection
            action={<ErpToolbarAction href={modulePath(data.site, "/admin/customers")} label="顾客列表" />}
            description="失败任务可从本站后台重跑。重跑仍然受到 credits 和 worker route 规则限制。"
            eyebrow="job queue"
            title="任务队列"
          >
            <ErpToolbar>
              <div className="flex flex-wrap gap-3">
                <ErpToolbarField label="总任务" value={String(data.jobs.length)} />
                <ErpToolbarField label="运行中" value={String(data.openJobs)} />
                <ErpToolbarField label="失败" value={String(data.failedJobs)} />
              </div>
            </ErpToolbar>
            <div className="mt-5">
              <JobsAdminPanel aiApps={data.state.aiApps} customers={data.customers} jobs={data.jobs} siteId={data.site.id} />
            </div>
          </ErpSection>
        </div>

        <ErpSection
          description="装修器里的 `generation_form` 只能绑定本站已启用工具；预览用 mock 数据，发布前台用真实工具和扣费规则。"
          eyebrow="enabled tools"
          title="前台可绑定工具"
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.apps.map((app) => (
              <div className="rounded-[14px] border border-zinc-200 bg-white p-4" key={app.id}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-900">{app.aiApp.name}</p>
                  <StatusPill label={app.enabled ? "enabled" : "disabled"} tone={app.enabled ? "good" : "warn"} />
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{app.aiApp.description}</p>
                <div className="mt-4 grid grid-cols-2 gap-2 font-mono text-xs text-slate-500">
                  <span>{app.creditCost} cr/run</span>
                  <span>{app.routeKey}</span>
                </div>
              </div>
            ))}
          </div>
        </ErpSection>
      </div>
    </AdminShell>
  );
}
