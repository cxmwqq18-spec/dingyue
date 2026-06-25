import { AdminShell } from "@/components/admin/admin-shell";
import { DesignPagesWorkbench } from "@/components/admin/design-pages-workbench";
import { createDesignerPreviewToken } from "@/lib/designer-preview-auth";
import { getThemePublishPreflightBundleRelational } from "@/lib/stores/site-store";
import { runThemePublishPreflight } from "@/lib/theme/publish-preflight";
import type { ThemePage, ThemePageJson } from "@/lib/types";
import {
  getSiteAdminData,
  modulePath,
  siteAdminAccount,
  siteAdminModuleLinks,
  siteAdminNav,
  siteAdminStats,
  siteAdminWorkspace
} from "../../_lib/site-admin-context";

function blockCount(pageJson: ThemePageJson): number {
  return Object.values(pageJson.sections).reduce((sum, section) => sum + (section?.blocks?.length ?? 0), 0);
}

function pageLiveHref(siteSlug: string, page: ThemePage): string {
  if (page.slug === "/" || page.pageType === "home") return `/site/${siteSlug}`;
  if (page.slug.startsWith("/")) return `/site/${siteSlug}${page.slug}`;
  return `/site/${siteSlug}/${page.slug}`;
}

function pageStatus(page: ThemePage, dirtyPageIds: Set<string>) {
  const dirty = dirtyPageIds.has(page.id);
  const sectionDelta = page.draftJson.sectionsOrder.length - page.publishedJson.sectionsOrder.length;
  const blockDelta = blockCount(page.draftJson) - blockCount(page.publishedJson);
  return { dirty, sectionDelta, blockDelta };
}

export default async function DesignPagesPage({ params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  const data = await getSiteAdminData(siteSlug, { include: [], summary: false, take: 0 });
  const preflightBundle = await getThemePublishPreflightBundleRelational(data.site.id);
  const site = preflightBundle.site ?? data.site;
  const shellData = { ...data, site };
  const dirtyPageIds = new Set(preflightBundle.dirtyPageIds);
  const previewToken = createDesignerPreviewToken({
    sessionId: data.current.session.id,
    siteId: site.id,
    siteSlug: site.slug
  });
  const pageStats = site.pages.map((page) => ({ page, ...pageStatus(page, dirtyPageIds) }));
  const preflight = runThemePublishPreflight({
    site,
    products: preflightBundle.products,
    siteAiApps: preflightBundle.siteAiApps,
    mediaAssets: preflightBundle.mediaAssets,
    dirtyPageIds
  });
  const workbenchPages = pageStats.map(({ page, dirty, sectionDelta, blockDelta }) => ({
    id: page.id,
    title: page.title,
    slug: page.slug,
    pageType: page.pageType,
    templateKey: page.templateKey,
    dirty,
    sectionDelta,
    blockDelta,
    draftVersion: page.draftJson.version,
    publishedVersion: page.publishedJson.version,
    sectionCount: page.draftJson.sectionsOrder.length,
    blockCount: blockCount(page.draftJson),
    designerHref: modulePath(site, `/admin/design?pageId=${encodeURIComponent(page.id)}`),
    previewHref: modulePath(site, `/admin/design/preview/${page.id}?previewToken=${encodeURIComponent(previewToken)}`),
    liveHref: pageLiveHref(site.slug, page)
  }));

  return (
    <AdminShell
      activeModuleCode="design"
      account={siteAdminAccount(site, data.current)}
      action={{ label: "打开装修器", href: modulePath(site, "/admin/design/workbench") }}
      breadcrumbs={[
        { label: "店铺管理", href: modulePath(site, "/admin") },
        { label: "店铺装修", href: modulePath(site, "/admin/design") },
        { label: "页面管理" }
      ]}
      brand={site.branding.logoText}
      eyebrow="online store pages"
      moduleLinks={siteAdminModuleLinks}
      nav={siteAdminNav(site, shellData)}
      siteSlug={site.slug}
      stats={siteAdminStats(shellData)}
      subtitle="按 SaaS 店铺装修模型管理全站模板：每个页面都有 draft_json、published_json、section 顺序和区块数量。"
      title="页面管理"
      titleBadge={String(site.pages.length)}
      workspace={siteAdminWorkspace(shellData, "design workspace")}
    >
      <div className="sr-only" aria-hidden="true">
        全站页面树
      </div>
      <DesignPagesWorkbench pages={workbenchPages} publishBlockers={preflight.summary.blockers} />
    </AdminShell>
  );
}
