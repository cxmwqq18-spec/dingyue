import { AdminShell } from "@/components/admin/admin-shell";
import { AiToolsPageClient } from "@/components/admin/ai-tools-page-client";
import {
  getSiteAdminData,
  modulePath,
  siteAdminAccount,
  siteAdminModuleLinks,
  siteAdminNav,
  siteAdminStats,
  siteAdminWorkspace
} from "../_lib/site-admin-context";

export default async function AiToolsPage({ params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  const data = await getSiteAdminData(siteSlug, { include: [], summary: false, take: 0 });

  return (
    <AdminShell
      activeModuleCode="ai"
      account={siteAdminAccount(data.site, data.current)}
      action={{ label: "打开生成页", href: `/site/${data.site.slug}/tools` }}
      breadcrumbs={[
        { label: "店铺管理", href: modulePath(data.site, "/admin") },
        { label: "AI 工具" }
      ]}
      brand={data.site.branding.logoText}
      eyebrow="AI 工厂运营"
      moduleLinks={siteAdminModuleLinks}
      nav={siteAdminNav(data.site, data)}
      siteSlug={data.site.slug}
      stats={siteAdminStats(data)}
      subtitle="AI 工具启用、扣费规则、worker 路由、任务队列和失败重跑都在本站后台处理；N8N 只作为执行器，不决定点数。"
      title="AI 工具"
      titleBadge={`${data.activeAiApps}/${data.appCount}`}
      workspace={siteAdminWorkspace(data, "AI 工作台")}
    >
      <AiToolsPageClient
        initialActiveAiApps={data.activeAiApps}
        initialAppCount={data.appCount}
        initialFailedJobs={data.failedJobs}
        initialOpenJobs={data.openJobs}
        initialReservedCredits={data.reservedCredits}
        siteId={data.site.id}
        siteSlug={data.site.slug}
      />
    </AdminShell>
  );
}
