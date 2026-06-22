import { Activity, Bot, Database, RotateCcw } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { ErpInfoList, ErpSection, ErpStatGrid, ErpToolbar, ErpToolbarAction, ErpToolbarField } from "@/components/admin/erp-primitives";
import { AiBindableToolsList } from "@/components/admin/ai-bindable-tools-list";
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

const gatewayStatusLabels: Record<string, string> = {
  active: "运行中",
  paused: "已暂停",
  disabled: "已停用",
  draft: "草稿"
};

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
      eyebrow="AI 工厂运营"
      moduleLinks={siteAdminModuleLinks}
      nav={siteAdminNav(data.site, data)}
      quickActions={siteAdminQuickActions(data.site, data)}
      siteSlug={data.site.slug}
      stats={siteAdminStats(data)}
      subtitle="AI 工具启用、扣费规则、worker 路由、任务队列和失败重跑都在本站后台处理；N8N 只作为执行器，不决定点数。"
      title="AI 工具"
      titleBadge={String(data.apps.length)}
      workspace={siteAdminWorkspace(data, "AI 工作台")}
      rightRail={
        <>
          <OpsCard className="p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">网关</p>
            <h2 className="mt-2 text-lg font-semibold">模型路由</h2>
            {data.gateway ? (
              <div className="mt-4 rounded-[12px] border border-zinc-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{data.gateway.name}</p>
                  <StatusPill label={gatewayStatusLabels[data.gateway.status] ?? data.gateway.status} tone={data.statusTone(data.gateway.status)} />
                </div>
                <p className="mt-2 font-mono text-xs text-zinc-500">账号池：{data.gateway.accountPoolMode} / 每分钟 {data.gateway.rateLimitPerMinute} 次</p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-100">
                  <div className="h-full rounded-full bg-zinc-950" style={{ width: `${gatewayUsage}%` }} />
                </div>
                <p className="mt-2 text-xs text-zinc-500">本月额度：{data.gateway.usedQuota}/{data.gateway.monthlyQuota}</p>
              </div>
            ) : (
              <div className="mt-4 rounded-[12px] border border-zinc-200 bg-white p-4 text-sm text-zinc-600">暂未配置网关分组。</div>
            )}
          </OpsCard>

          <OpsCard className="p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">任务结算</p>
            <h2 className="mt-2 text-lg font-semibold">任务结算规则</h2>
            <div className="mt-4">
              <ErpInfoList
                items={[
                  { label: "预扣", value: "创建任务时先预扣点数", tone: "warn" },
                  { label: "结算", value: "成功回调后扣除点数并写入相册", tone: "good" },
                  { label: "释放", value: "失败、超时或退款后退回预扣点数", tone: "neutral" },
                  { label: "幂等", value: "重复回调不能重复结算", tone: "good" }
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
            { label: "工具", value: `${data.activeAiApps}/${data.apps.length}`, detail: "已启用 / 已安装", icon: Bot, tone: data.activeAiApps ? "good" : "warn" },
            { label: "任务", value: String(data.jobs.length), detail: `${data.completedJobs} 个已完成`, icon: Activity, tone: data.failedJobs ? "bad" : data.openJobs ? "warn" : "good" },
            { label: "预扣", value: String(data.reservedCredits), detail: "已预扣点数", icon: Database, tone: data.reservedCredits ? "warn" : "good" },
            { label: "重跑", value: String(data.failedJobs), detail: "失败或已退款任务", icon: RotateCcw, tone: data.failedJobs ? "bad" : "good" }
          ]}
        />

        <div className="grid gap-5">
          <ErpSection
            action={<ErpToolbarAction href={modulePath(data.site, "/admin/design")} label="前台表单绑定" />}
            description="控制本站 AI 工具是否启用、每次运行消耗多少点数，以及走哪条 worker 路由。"
            eyebrow="工具配置"
            title="工具配置"
          >
            <ErpToolbar>
              <div className="flex flex-wrap gap-3">
                <ErpToolbarField label="已启用" value={`${data.activeAiApps}/${data.apps.length}`} />
                <ErpToolbarField label="路由组" value={data.gateway?.name ?? "未配置"} />
              </div>
            </ErpToolbar>
            <div className="mt-5">
              <AiToolsEditor apps={data.apps} siteId={data.site.id} />
            </div>
          </ErpSection>
          <ErpSection
            action={<ErpToolbarAction href={modulePath(data.site, "/admin/customers")} label="顾客列表" />}
            description="失败任务可从本站后台重跑。重跑仍然受到点数和 worker 路由规则限制。"
            eyebrow="任务队列"
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
          description="装修器里的 `generation_form` 只能绑定本站已启用工具；预览使用模拟数据，发布前台使用真实工具和扣费规则。"
          eyebrow="可绑定工具"
          title="前台可绑定工具"
        >
          <AiBindableToolsList apps={data.apps} />
        </ErpSection>
      </div>
    </AdminShell>
  );
}
