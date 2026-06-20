import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { DesignerClient } from "@/components/designer/designer-client";
import { LogoutActionButton } from "@/components/auth/logout-action-button";
import Link from "next/link";
import { ArrowLeft, Layers3 } from "lucide-react";
import { createDesignerPreviewToken } from "@/lib/designer-preview-auth";
import {
  getSiteAdminBySessionFromState,
  getSiteAppsFromState,
  getSiteCreativePacksFromState,
  getSiteMediaAssetsFromState,
  getSiteProductsFromState,
  getSiteSaasThemeRecords,
  getSiteThemePublicationsFromState,
  readPlatformState
} from "@/lib/server-store";
import { siteAdminSessionCookie } from "@/lib/session";

export default async function DesignPage({
  params,
  searchParams
}: {
  params: Promise<{ siteSlug: string }>;
  searchParams?: Promise<{ pageId?: string }>;
}) {
  const { siteSlug } = await params;
  const query = searchParams ? await searchParams : {};
  const state = readPlatformState();
  const site = state.sites.find((item) => item.slug === siteSlug);
  if (!site) notFound();
  const sessionId = (await cookies()).get(siteAdminSessionCookie(site.id))?.value;
  const current = getSiteAdminBySessionFromState(state, site.id, sessionId);
  if (!current) redirect(`/site/${site.slug}/admin/login`);
  const previewToken = createDesignerPreviewToken({
    sessionId: current.session.id,
    siteId: site.id,
    siteSlug: site.slug
  });
  const products = getSiteProductsFromState(state, site.id);
  const siteAiApps = getSiteAppsFromState(state, site.id);
  const creativePacks = getSiteCreativePacksFromState(state, site.id);
  const mediaAssets = getSiteMediaAssetsFromState(state, site.id);
  const publications = getSiteThemePublicationsFromState(state, site.id);
  const themeRecords = getSiteSaasThemeRecords(site.id);
  const activeThemeName = themeRecords.active.name || `${site.name} live theme`;
  const activeThemeKey = themeRecords.active.themeKey;
  const draftThemeName = themeRecords.draft.name || `${site.name} draft theme`;
  const draftThemeKey = themeRecords.draft.themeKey;

  return (
    <main
      className="flex h-[100dvh] flex-col overflow-hidden bg-[#d7dce4] text-zinc-950"
      data-admin-layout="saas-fullscreen-theme-designer"
      data-designer-layout="saas-store-builder xfcart-fullscreen-section-editor saas-three-pane-builder"
    >
      <div className="min-h-0 flex-1 min-w-0" id="designer-workspace">
        <DesignerClient
          activeThemeName={activeThemeName}
          activeThemeKey={activeThemeKey}
          creativePacks={creativePacks}
          draftThemeKey={draftThemeKey}
          draftThemeName={draftThemeName}
          initialPageId={query.pageId}
          initialThemeKey={draftThemeKey}
          mediaAssets={mediaAssets}
          pages={site.pages}
          previewToken={previewToken}
          publicationCount={publications.length}
          products={products}
          site={site}
          siteAiApps={siteAiApps}
          toolbarLeading={
            <div className="flex min-w-0 items-center gap-3 pl-3">
              <Link
                className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-white/10 bg-white/[0.04] text-white/88 transition hover:bg-white/[0.1]"
                href={`/site/${site.slug}/admin`}
                title="返回后台"
              >
                <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
              </Link>
              <div className="min-w-0">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/34">visual store designer</div>
                <div className="mt-0.5 flex min-w-0 items-center gap-2">
                  <span className="truncate text-[16px] font-semibold leading-5 text-white/94">{site.name} 店铺装修</span>
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
                className="inline-flex h-[56px] items-center gap-2 border-l border-white/10 px-3 text-[13px] text-white/92 transition hover:bg-[#313747]"
                href={`/site/${site.slug}/admin/themes`}
              >
                <Layers3 className="h-[15px] w-[15px]" strokeWidth={1.8} />
                主题库
              </Link>
              <Link
                className="inline-flex h-[56px] items-center border-l border-white/10 px-3 text-[13px] text-white/92 transition hover:bg-[#313747]"
                href={`/site/${site.slug}`}
              >
                打开前台
              </Link>
              <LogoutActionButton
                endpoint={`/api/sites/${site.id}/admin/auth/logout`}
                label="退出"
                redirectTo={`/site/${site.slug}/admin/login`}
                tone="dark"
              />
            </>
          }
        />
      </div>
    </main>
  );
}
