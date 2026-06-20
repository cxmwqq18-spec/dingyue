import { AdminShell } from "@/components/admin/admin-shell";
import { DesignPagesWorkbench } from "@/components/admin/design-pages-workbench";
import { createDesignerPreviewToken } from "@/lib/designer-preview-auth";
import { runThemePublishPreflight } from "@/lib/theme/publish-preflight";
import type { ThemePage, ThemePageJson } from "@/lib/types";
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

function jsonEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function blockCount(pageJson: ThemePageJson): number {
  return Object.values(pageJson.sections).reduce((sum, section) => sum + (section?.blocks?.length ?? 0), 0);
}

function pageLiveHref(siteSlug: string, page: ThemePage): string {
  if (page.slug === "/" || page.pageType === "home") return `/site/${siteSlug}`;
  if (page.slug.startsWith("/")) return `/site/${siteSlug}${page.slug}`;
  return `/site/${siteSlug}/${page.slug}`;
}

function pageStatus(page: ThemePage) {
  const dirty = !jsonEqual(page.draftJson, page.publishedJson);
  const sectionDelta = page.draftJson.sectionsOrder.length - page.publishedJson.sectionsOrder.length;
  const blockDelta = blockCount(page.draftJson) - blockCount(page.publishedJson);
  return { dirty, sectionDelta, blockDelta };
}

export default async function DesignPagesPage({ params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  const data = await getSiteAdminData(siteSlug);
  const previewToken = createDesignerPreviewToken({
    sessionId: data.current.session.id,
    siteId: data.site.id,
    siteSlug: data.site.slug
  });
  const pageStats = data.site.pages.map((page) => ({ page, ...pageStatus(page) }));
  const preflight = runThemePublishPreflight({
    site: data.site,
    products: data.products,
    siteAiApps: data.apps,
    mediaAssets: data.media
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
    designerHref: modulePath(data.site, `/admin/design?pageId=${encodeURIComponent(page.id)}`),
    previewHref: modulePath(data.site, `/admin/design/preview/${page.id}?previewToken=${encodeURIComponent(previewToken)}`),
    liveHref: pageLiveHref(data.site.slug, page)
  }));

  return (
    <AdminShell
      activeModuleCode="design"
      account={siteAdminAccount(data.site, data.current)}
      action={{ label: "打开装修器", href: modulePath(data.site, "/admin/design") }}
      breadcrumbs={[
        { label: "店铺管理", href: modulePath(data.site, "/admin") },
        { label: "店铺装修", href: modulePath(data.site, "/admin/design") },
        { label: "页面管理" }
      ]}
      brand={data.site.branding.logoText}
      commandActions={siteAdminCommandActions(data.site, data)}
      eyebrow="online store pages"
      moduleLinks={siteAdminModuleLinks}
      nav={siteAdminNav(data.site, data)}
      quickActions={siteAdminQuickActions(data.site, data)}
      siteSlug={data.site.slug}
      stats={siteAdminStats(data)}
      subtitle="按 SaaS 店铺装修模型管理全站模板：每个页面都有 draft_json、published_json、section 顺序和区块数量。"
      title="页面管理"
      titleBadge={String(data.site.pages.length)}
      workspace={siteAdminWorkspace(data, "design workspace")}
    >
      <div className="sr-only" aria-hidden="true">
        全站页面树
      </div>
      <DesignPagesWorkbench pages={workbenchPages} publishBlockers={preflight.summary.blockers} />
    </AdminShell>
  );
}
