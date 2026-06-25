import { AdminShell } from "@/components/admin/admin-shell";
import { ContentPageClient } from "@/components/admin/content-page-client";
import {
  getSiteAdminData,
  modulePath,
  siteAdminAccount,
  siteAdminModuleLinks,
  siteAdminNav,
  siteAdminStats,
  siteAdminWorkspace
} from "../_lib/site-admin-context";

export default async function ContentPage({
  params
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  const { siteSlug } = await params;
  const data = await getSiteAdminData(siteSlug, {
    include: [],
    summary: false,
    take: 0
  });

  return (
    <AdminShell
      activeModuleCode="content"
      account={siteAdminAccount(data.site, data.current)}
      action={{ label: "打开装修器", href: modulePath(data.site, "/admin/design/workbench") }}
      breadcrumbs={[
        { label: "店铺管理", href: modulePath(data.site, "/admin") },
        { label: "内容运营" }
      ]}
      brand={data.site.branding.logoText}
      eyebrow="内容运营"
      moduleLinks={siteAdminModuleLinks}
      nav={siteAdminNav(data.site, data)}
      siteSlug={data.site.slug}
      stats={siteAdminStats(data)}
      subtitle="政策页、帮助中心、FAQ、博客列表和营销区块都通过同一套主题页面装修，不再散落在代码里。"
      title="内容运营"
      titleBadge={String(data.contentPageCount)}
      workspace={siteAdminWorkspace(data, "content workspace")}
    >
      <ContentPageClient siteId={data.site.id} siteSlug={data.site.slug} />
    </AdminShell>
  );
}
