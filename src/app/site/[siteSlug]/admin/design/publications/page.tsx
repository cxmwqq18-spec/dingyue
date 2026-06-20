import { AdminShell } from "@/components/admin/admin-shell";
import { DesignPublicationsWorkbench } from "@/components/admin/design-publications-workbench";
import { runThemePublishPreflight } from "@/lib/theme/publish-preflight";
import type { ThemePublication } from "@/lib/types";
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
} from "../../_lib/site-admin-context";

function sectionCount(publication: ThemePublication): number {
  return publication.snapshot.pages.reduce((sum, page) => sum + page.publishedJson.sectionsOrder.length, 0);
}

function publicationDate(value: string): string {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

export default async function DesignPublicationsPage({ params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  const data = await getSiteAdminData(siteSlug);
  const publications = [...data.publications].sort((a, b) => b.version - a.version || new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  const latest = publications[0];
  const settingsDirty = JSON.stringify(data.site.themeSettings.draftJson) !== JSON.stringify(data.site.themeSettings.publishedJson);
  const hasDirtyDraft = data.dirtyPages > 0 || settingsDirty;
  const firstPageId = data.site.pages[0]?.id;
  const latestPageCount = latest?.snapshot.pages.length ?? 0;
  const latestSectionCount = latest ? sectionCount(latest) : 0;
  const preflight = runThemePublishPreflight({
    site: data.site,
    products: data.products,
    siteAiApps: data.apps,
    mediaAssets: data.media
  });

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
      commandActions={siteAdminCommandActions(data.site, data)}
      eyebrow="theme publication history"
      moduleLinks={siteAdminModuleLinks}
      nav={siteAdminNav(data.site, data)}
      quickActions={siteAdminQuickActions(data.site, data)}
      siteSlug={data.site.slug}
      stats={siteAdminStats(data)}
      subtitle="发布是整站级 snapshot。草稿保存不会影响线上；只有发布后，前台才读取新的 published_json 和 theme settings。"
      title="发布历史"
      titleBadge={String(publications.length)}
      workspace={siteAdminWorkspace(data, "design workspace")}
    >
      <div className="sr-only" aria-hidden="true">
        草稿发布与历史快照
      </div>
      <DesignPublicationsWorkbench
        canPublish={preflight.canPublish}
        dirtyPages={data.dirtyPages}
        firstPageId={firstPageId}
        hasDirtyDraft={hasDirtyDraft}
        latestPageCount={latestPageCount}
        latestPublishedAt={latest ? publicationDate(latest.publishedAt) : undefined}
        latestSectionCount={latestSectionCount}
        latestVersion={latest?.version}
        preflightScore={preflight.score}
        publications={publications.map((publication) => ({
          id: publication.id,
          version: publication.version,
          isActive: latest?.id === publication.id,
          pageCount: publication.snapshot.pages.length,
          sectionCount: sectionCount(publication),
          publishedAt: publicationDate(publication.publishedAt),
          publishedBy: publication.publishedBy
        }))}
        settingsDirty={settingsDirty}
        siteId={data.site.id}
      />
    </AdminShell>
  );
}
