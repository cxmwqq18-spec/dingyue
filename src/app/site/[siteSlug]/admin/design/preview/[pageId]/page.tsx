import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { IframePatchListener } from "@/components/designer/iframe-patch-listener";
import { ThemeRenderer } from "@/components/theme-renderer";
import { verifyDesignerPreviewToken } from "@/lib/designer-preview-auth";
import {
  getPreviewThemeRuntime,
  getSiteAdminBySessionFromState,
  getSiteAppsFromState,
  getSiteCreativePacksFromState,
  getSiteMediaAssetsFromState,
  getSiteProductsFromState,
  readPlatformState
} from "@/lib/server-store";
import { siteAdminSessionCookie } from "@/lib/session";
import { getSiteAdminBySessionRelational } from "@/lib/stores/site-store";
import { themeStyleVars } from "@/lib/theme";

export default async function ThemePreviewPage({
  params,
  searchParams
}: {
  params: Promise<{ siteSlug: string; pageId: string }>;
  searchParams?: Promise<{ previewToken?: string }>;
}) {
  const { siteSlug, pageId } = await params;
  const query = searchParams ? await searchParams : {};
  const state = readPlatformState();
  const site = state.sites.find((item) => item.slug === siteSlug);
  if (!site) notFound();
  site.mediaAssets = getSiteMediaAssetsFromState(state, site.id);
  const cookieSessionId = (await cookies()).get(siteAdminSessionCookie(site.id))?.value;
  const tokenPayload = verifyDesignerPreviewToken(query.previewToken, { siteId: site.id, siteSlug: site.slug });
  const cookieSession =
    (await getSiteAdminBySessionRelational({ siteId: site.id, sessionId: cookieSessionId })) ??
    getSiteAdminBySessionFromState(state, site.id, cookieSessionId);
  const tokenSession = tokenPayload
    ? (await getSiteAdminBySessionRelational({ siteId: site.id, sessionId: tokenPayload.sessionId })) ??
      getSiteAdminBySessionFromState(state, site.id, tokenPayload.sessionId)
    : undefined;
  if (!cookieSession && !tokenSession) redirect(`/site/${site.slug}/admin/login`);
  const page = site.pages.find((item) => item.id === pageId);
  if (!page) notFound();
  const settings = site.themeSettings.draftJson;
  const runtime = getPreviewThemeRuntime(state, site.id);
  return (
    <div style={themeStyleVars(settings)}>
      <IframePatchListener />
      <ThemeRenderer
        creativePacks={getSiteCreativePacksFromState(state, site.id)}
        mode="preview"
        page={page.draftJson}
        pagePath={page.slug}
        products={getSiteProductsFromState(state, site.id)}
        query={query}
        runtime={runtime}
        settings={settings}
        site={site}
        siteAiApps={getSiteAppsFromState(state, site.id)}
      />
    </div>
  );
}
