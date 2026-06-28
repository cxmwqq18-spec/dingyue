import { AdminShell } from "@/components/admin/admin-shell";
import { DesignPublicationsWorkbench } from "@/components/admin/design-publications-workbench";
import { DesignWorkspaceTabs } from "@/components/admin/design-workspace-tabs";
import { getSiteThemePublicationMetaRelational } from "@/lib/stores/theme-store";
import {
  getSiteAdminData,
  modulePath,
  siteAdminAccount,
  siteAdminModuleLinks,
  siteAdminNav,
  siteAdminStats,
  siteAdminWorkspace
} from "../../_lib/site-admin-context";

function publicationDate(value: string): string {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

export default async function DesignPublicationsPage({ params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  const data = await getSiteAdminData(siteSlug, { include: ["themeSettings"], summary: false, take: 0 });
  const publications = await getSiteThemePublicationMetaRelational(data.site.id);
  const latest = publications[0];
  const settingsDirty = JSON.stringify(data.site.themeSettings.draftJson) !== JSON.stringify(data.site.themeSettings.publishedJson);
  const hasDirtyDraft = data.dirtyPages > 0 || settingsDirty;
  const firstPageId = data.site.pages[0]?.id;
  const latestPageCount = latest?.pageCount ?? 0;
  const latestSectionCount = latest?.sectionCount ?? 0;
  const seoReady = Boolean(data.site.themeSettings.draftJson.seo?.siteTitle && data.site.themeSettings.draftJson.seo?.siteDescription);

  return (
    <AdminShell
      activeModuleCode="design"
      account={siteAdminAccount(data.site, data.current)}
      action={{ label: "打开前台", href: modulePath(data.site, "") }}
      breadcrumbs={[
        { label: "店铺管理", href: modulePath(data.site, "/admin") },
        { label: "店铺装修", href: modulePath(data.site, "/admin/design") },
        { label: "发布历史" }
      ]}
      brand={data.site.branding.logoText}
      eyebrow="theme publication history"
      moduleLinks={siteAdminModuleLinks}
      nav={siteAdminNav(data.site, data)}
      siteSlug={data.site.slug}
      stats={siteAdminStats(data)}
      subtitle="发布是整站级 snapshot。草稿保存不会影响线上；只有发布后，前台才读取新的 published_json 和 theme settings。"
      title="发布历史"
      titleBadge={String(publications.length)}
      workspace={siteAdminWorkspace(data, "design workspace")}
    >
      <div className="grid gap-4">
        <DesignWorkspaceTabs
          activePath="/admin/design/publications"
          mediaCount={data.mediaCount}
          pageCount={data.site.pages.length}
          publicationCount={publications.length}
          seoReady={seoReady}
          siteSlug={data.site.slug}
        />
        <div className="sr-only" aria-hidden="true">
          草稿发布与历史快照
        </div>
        <DesignPublicationsWorkbench
          canPublish={hasDirtyDraft}
          dirtyPages={data.dirtyPages}
          firstPageId={firstPageId}
          hasDirtyDraft={hasDirtyDraft}
          latestPageCount={latestPageCount}
          latestPublishedAt={latest ? publicationDate(latest.publishedAt) : undefined}
          latestSectionCount={latestSectionCount}
          latestVersion={latest?.version}
          preflightScore={hasDirtyDraft ? 70 : 100}
          preflightStale
          publications={publications.map((publication) => ({
            id: publication.id,
            version: publication.version,
            isActive: latest?.id === publication.id,
            pageCount: publication.pageCount,
            sectionCount: publication.sectionCount,
            publishedAt: publicationDate(publication.publishedAt),
            publishedBy: publication.publishedBy
          }))}
          settingsDirty={settingsDirty}
          siteId={data.site.id}
        />
      </div>
    </AdminShell>
  );
}
