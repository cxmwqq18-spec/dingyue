import { notFound, redirect } from "next/navigation";
import { DesignerClient } from "@/components/designer/designer-client";
import { DesignWorkspaceTabs } from "@/components/admin/design-workspace-tabs";
import { LogoutActionButton } from "@/components/auth/logout-action-button";
import Link from "next/link";
import { ArrowLeft, Layers3 } from "lucide-react";
import { createDesignerPreviewToken } from "@/lib/designer-preview-auth";
import { getSiteAdminData } from "../../_lib/site-admin-context";
import {
  getSiteSaasThemeLabelsRelational,
  getSiteThemePublicationCountRelational,
  getSiteThemeSiteRelational
} from "@/lib/stores/theme-store";

export default async function DesignPage({
  params,
  searchParams
}: {
  params: Promise<{ siteSlug: string }>;
  searchParams?: Promise<{ pageId?: string }>;
}) {
  const { siteSlug } = await params;
  const query = searchParams ? await searchParams : {};
  const data = await getSiteAdminData(siteSlug, { include: [], take: 0, summary: false });
  const { site, current } = data;
  if (!site) notFound();
  if (!current) redirect(`/site/${site.slug}/admin/login`);
  const designerSite = await getSiteThemeSiteRelational(site.id);
  const previewToken = createDesignerPreviewToken({
    sessionId: current.session.id,
    siteId: designerSite.id,
    siteSlug: designerSite.slug
  });
  const [themeLabels, publicationCount] = await Promise.all([
    getSiteSaasThemeLabelsRelational(designerSite.id),
    getSiteThemePublicationCountRelational(designerSite.id)
  ]);
  const activeThemeName = themeLabels.active?.name || `${designerSite.name} live theme`;
  const activeThemeKey = themeLabels.active?.themeKey || `${designerSite.id}_active`;
  const draftThemeName = themeLabels.draft?.name || `${designerSite.name} draft theme`;
  const draftThemeKey = themeLabels.draft?.themeKey || `${designerSite.id}_draft`;

  return (
    <main
      className="flex h-[100dvh] flex-col overflow-hidden bg-[#d7dce4] text-zinc-950"
      data-admin-layout="saas-fullscreen-theme-designer"
      data-designer-layout="saas-store-builder xfcart-fullscreen-section-editor saas-three-pane-builder"
    >
      <div className="border-b border-white/10 bg-[#1f2530] px-3 py-2 shadow-[0_10px_20px_-18px_rgba(0,0,0,0.65)]">
        <DesignWorkspaceTabs
          activePath="/admin/design/workbench"
          mediaCount={data.mediaCount}
          pageCount={designerSite.pages.length}
          publicationCount={publicationCount}
          seoReady={Boolean(designerSite.themeSettings.draftJson.seo?.siteTitle && designerSite.themeSettings.draftJson.seo?.siteDescription)}
          siteSlug={designerSite.slug}
          compact
          tone="dark"
        />
      </div>
      <div className="min-h-0 flex-1 min-w-0 overflow-hidden" id="designer-workspace">
        <DesignerClient
          activeThemeName={activeThemeName}
          activeThemeKey={activeThemeKey}
          draftThemeKey={draftThemeKey}
          draftThemeName={draftThemeName}
          initialPageId={query.pageId}
          initialThemeKey={draftThemeKey}
          creativePacks={data.packs}
          mediaAssets={data.media}
          pages={designerSite.pages}
          previewToken={previewToken}
          products={data.products}
          publicationCount={publicationCount}
          site={designerSite}
          siteAiApps={data.apps}
          toolbarLeading={
            <div className="flex min-w-0 items-center gap-3">
              <Link
                className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-white/10 bg-white/[0.04] text-white/88 transition hover:bg-white/[0.1]"
                href={`/site/${designerSite.slug}/admin/design`}
                title="返回店铺装修"
              >
                <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
              </Link>
              <div className="min-w-0">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/34">visual store designer</div>
                <div className="mt-0.5 flex min-w-0 items-center gap-2">
                  <span className="truncate text-[16px] font-semibold leading-5 text-white/94">{designerSite.name} 店铺装修</span>
                  <span className="inline-flex h-[22px] items-center rounded-[999px] border border-emerald-400/30 bg-emerald-400/12 px-2.5 text-[10px] font-medium uppercase tracking-[0.08em] text-emerald-200">
                    Live
                  </span>
                </div>
              </div>
            </div>
          }
          toolbarTrailing={
            <>
              <Link
                className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-[8px] border border-white/10 bg-white/[0.04] px-3 text-[13px] font-medium text-white/88 transition hover:bg-white/[0.1]"
                href={`/site/${designerSite.slug}/admin/themes`}
              >
                <Layers3 className="h-[15px] w-[15px]" strokeWidth={1.8} />
                主题库
              </Link>
              <Link
                className="inline-flex h-10 items-center whitespace-nowrap rounded-[8px] border border-white/10 bg-white/[0.04] px-3 text-[13px] font-medium text-white/88 transition hover:bg-white/[0.1]"
                href={`/site/${designerSite.slug}`}
                target="_blank"
                rel="noreferrer"
              >
                打开前台
              </Link>
              <LogoutActionButton
                endpoint={`/api/sites/${designerSite.id}/admin/auth/logout`}
                label="退出"
                redirectTo={`/site/${designerSite.slug}/admin/login`}
                tone="dark"
              />
            </>
          }
        />
      </div>
    </main>
  );
}
