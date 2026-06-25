import { AdminShell } from "@/components/admin/admin-shell";
import { SeoSettingsEditor } from "@/components/admin/seo-settings-editor";
import {
  getSiteAdminData,
  modulePath,
  siteAdminAccount,
  siteAdminModuleLinks,
  siteAdminNav,
  siteAdminStats,
  siteAdminWorkspace
} from "../../_lib/site-admin-context";

export default async function DesignSeoPage({ params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  const data = await getSiteAdminData(siteSlug, { include: ["themeSettings"], summary: false });
  const pages = data.site.pages.map((page) => ({
    id: page.id,
    title: page.title,
    slug: page.slug,
    pageType: page.pageType
  }));

  return (
    <AdminShell
      activeModuleCode="design"
      account={siteAdminAccount(data.site, data.current)}
      action={{ label: "发布历史", href: modulePath(data.site, "/admin/design/publications") }}
      breadcrumbs={[
        { label: "店铺管理", href: modulePath(data.site, "/admin") },
        { label: "店铺装修", href: modulePath(data.site, "/admin/design") },
        { label: "SEO 设置" }
      ]}
      brand={data.site.branding.logoText}
      eyebrow="search metadata and robots"
      moduleLinks={siteAdminModuleLinks}
      nav={siteAdminNav(data.site, data)}
      siteSlug={data.site.slug}
      stats={siteAdminStats(data)}
      subtitle="SEO 属于主题全局设置。保存只进入草稿；发布整站快照后，前台页面 metadata、canonical、robots 和分享图才读取最新 published SEO。"
      title="SEO 设置"
      titleBadge={String(pages.length)}
      workspace={siteAdminWorkspace(data, "design workspace")}
    >
      <div className="sr-only" aria-hidden="true">
        站点搜索资料
      </div>
      <SeoSettingsEditor
        initialSettings={data.site.themeSettings.draftJson}
        pages={pages}
        publishedSettings={data.site.themeSettings.publishedJson}
        site={data.site}
      />
    </AdminShell>
  );
}
