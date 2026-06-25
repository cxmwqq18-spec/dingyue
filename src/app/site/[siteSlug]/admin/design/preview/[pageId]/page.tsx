import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { IframePatchListener } from "@/components/designer/iframe-patch-listener";
import { ThemeRenderer } from "@/components/theme-renderer";
import { verifyDesignerPreviewToken } from "@/lib/designer-preview-auth";
import { siteAdminSessionCookie } from "@/lib/session";
import { getSiteAdminBySessionRelational, getSiteAdminContextRelationalState, getSiteBySlugForAdmin } from "@/lib/stores/site-store";
import { prisma } from "@/lib/prisma";
import { toCreativePack } from "@/lib/stores/prisma-mappers";
import { getSiteThemeStateRelational } from "@/lib/stores/theme-store";
import { themeStyleVars } from "@/lib/theme";
import type { ThemeRuntimeData } from "@/lib/types";

export default async function ThemePreviewPage({
  params,
  searchParams
}: {
  params: Promise<{ siteSlug: string; pageId: string }>;
  searchParams?: Promise<{ previewToken?: string }>;
}) {
  const { siteSlug, pageId } = await params;
  const query = searchParams ? await searchParams : {};
  const stateSite = await getSiteBySlugForAdmin(siteSlug);
  if (!stateSite) notFound();
  const themeState = await getSiteThemeStateRelational(stateSite.id);
  const site = themeState.site;
  site.mediaAssets = themeState.mediaAssets;
  const cookieSessionId = (await cookies()).get(siteAdminSessionCookie(site.id))?.value;
  const tokenPayload = verifyDesignerPreviewToken(query.previewToken, { siteId: site.id, siteSlug: site.slug });
  const cookieSession = await getSiteAdminBySessionRelational({ siteId: site.id, sessionId: cookieSessionId });
  const tokenSession = tokenPayload
    ? await getSiteAdminBySessionRelational({ siteId: site.id, sessionId: tokenPayload.sessionId })
    : undefined;
  if (!cookieSession && !tokenSession) redirect(`/site/${site.slug}/admin/login`);
  const page = site.pages.find((item) => item.id === pageId);
  if (!page) notFound();
  const settings = site.themeSettings.draftJson;
  const relationalState = await getSiteAdminContextRelationalState(site.id, {
    products: true,
    jobs: false,
    apps: true,
    media: false,
    publications: false,
    auditLogs: false,
    domains: false,
    gateways: false,
    siteAdmins: false
  });
  const creativePacks = await prisma.creativePack
    .findMany({ where: { siteId: site.id }, orderBy: [{ status: "asc" }, { createdAt: "asc" }] })
    .then((rows) => rows.map(toCreativePack));
  const runtime: ThemeRuntimeData = {
    jobs: [],
    assets: [],
    albums: [],
    ledger: [],
    subscriptions: [],
    orders: [],
    customerModels: [],
    isPreview: true
  };
  return (
    <div style={themeStyleVars(settings)}>
      <IframePatchListener />
      <ThemeRenderer
        creativePacks={creativePacks}
        mode="preview"
        page={page.draftJson}
        pagePath={page.slug}
        products={relationalState.products ?? []}
        query={query}
        runtime={runtime}
        settings={settings}
        site={site}
        siteAiApps={relationalState.apps ?? []}
      />
    </div>
  );
}
