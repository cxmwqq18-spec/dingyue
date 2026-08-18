import { AdminShell } from "@/components/admin/admin-shell";
import { DesignWorkspaceTabs } from "@/components/admin/design-workspace-tabs";
import { SeoSettingsEditor } from "@/components/admin/seo-settings-editor";
import { getSiteThemePublicationCountRelational } from "@/lib/stores/theme-store";
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
  const publicationCount = await getSiteThemePublicationCountRelational(data.site.id);
  const pages = data.site.pages.map((page) => ({
    id: page.id,
    title: page.title,
    slug: page.slug,
    pageType: page.pageType,
    draftJson: page.draftJson,
    publishedJson: page.publishedJson,
    draftMeta: page.draftMeta
  }));
  const seoReady = Boolean(data.site.themeSettings.draftJson.seo?.siteTitle && data.site.themeSettings.draftJson.seo?.siteDescription);

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
      subtitle="页面 SEO 保存到对应页面草稿；站点默认值保存在主题设置。单页发布后，metadata、canonical、robots、分享图与 JSON-LD 同步更新。"
      title="SEO 设置"
      titleBadge={String(pages.length)}
      workspace={siteAdminWorkspace(data, "design workspace")}
    >
      <div className="grid gap-4">
        <DesignWorkspaceTabs
          activePath="/admin/design/seo"
          mediaCount={data.mediaCount}
          pageCount={pages.length}
          publicationCount={publicationCount}
          seoReady={seoReady}
          siteSlug={data.site.slug}
        />
        <div className="sr-only" aria-hidden="true">
          站点搜索资料
        </div>
        <SeoSettingsEditor
          draftMeta={data.site.themeSettings.draftMeta}
          initialSettings={data.site.themeSettings.draftJson}
          pages={pages}
          publishedSettings={data.site.themeSettings.publishedJson}
          site={data.site}
        />
      </div>
    </AdminShell>
  );
}
