import { AdminShell } from "@/components/admin/admin-shell";
import { ProcessesPageClient } from "@/components/admin/processes-page-client";
import {
  getSiteAdminData,
  modulePath,
  siteAdminAccount,
  siteAdminModuleLinks,
  siteAdminNav,
  siteAdminStats,
  siteAdminWorkspace
} from "../_lib/site-admin-context";

export default async function ProcessesPage({ params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  const data = await getSiteAdminData(siteSlug, { include: [], summary: false, take: 0 });

  return (
    <AdminShell
      activeModuleCode="processes"
      account={siteAdminAccount(data.site, data.current)}
      action={{ label: "打开生成页", href: `/site/${data.site.slug}/tools` }}
      breadcrumbs={[
        { label: "店铺管理", href: modulePath(data.site, "/admin") },
        { label: "进程管理" }
      ]}
      brand={data.site.branding.logoText}
      eyebrow="AI 进程控制"
      moduleLinks={siteAdminModuleLinks}
      nav={siteAdminNav(data.site, data)}
      siteSlug={data.site.slug}
      stats={siteAdminStats(data)}
      subtitle="管理员可以终止排队中或生成中的 AI 图片/视频任务；终止后按本地业务结算全额释放预扣积分，并尽量中断同一 Node 进程内的 worker。"
      title="进程管理"
      titleBadge={String(data.openJobs)}
      workspace={siteAdminWorkspace(data, "进程工作台")}
    >
      <ProcessesPageClient
        initialOpenJobs={data.openJobs}
        initialReservedCredits={data.reservedCredits}
        siteId={data.site.id}
      />
    </AdminShell>
  );
}
