import { AdminShell } from "@/components/admin/admin-shell";
import { NavigationEditor } from "@/components/admin/navigation-editor";
import {
  getSiteAdminData,
  modulePath,
  siteAdminAccount,
  siteAdminModuleLinks,
  siteAdminNav,
  siteAdminStats,
  siteAdminWorkspace
} from "../../_lib/site-admin-context";

export default async function DesignNavigationPage({ params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  const data = await getSiteAdminData(siteSlug, { include: ["themeSettings"], summary: false });
  const draftSettings = data.site.themeSettings.draftJson;
  const publishedSettings = data.site.themeSettings.publishedJson;
  const headerCount = draftSettings.navigation.headerLinks.length;
  const footerCount = draftSettings.navigation.footerLinks.length;

  return (
    <AdminShell
      activeModuleCode="design"
      account={siteAdminAccount(data.site, data.current)}
      action={{ label: "打开装修器", href: modulePath(data.site, "/admin/design/workbench") }}
      breadcrumbs={[
        { label: "店铺管理", href: modulePath(data.site, "/admin") },
        { label: "店铺装修", href: modulePath(data.site, "/admin/design") },
        { label: "导航菜单" }
      ]}
      brand={data.site.branding.logoText}
      eyebrow="navigation and global sections"
      moduleLinks={siteAdminModuleLinks}
      nav={siteAdminNav(data.site, data)}
      siteSlug={data.site.slug}
      stats={siteAdminStats(data)}
      subtitle="导航菜单属于主题全局设置，保存草稿后仍需发布整站快照，前台才读取最新 published theme settings。"
      title="导航菜单"
      titleBadge={String(headerCount + footerCount)}
      workspace={siteAdminWorkspace(data, "design workspace")}
    >
      <div className="sr-only" aria-hidden="true">
        站点导航
      </div>
      <NavigationEditor
        initialSettings={draftSettings}
        liveHref={modulePath(data.site, "")}
        publishHref={modulePath(data.site, "/admin/design/publications")}
        publishedSettings={publishedSettings}
        siteId={data.site.id}
      />
    </AdminShell>
  );
}
