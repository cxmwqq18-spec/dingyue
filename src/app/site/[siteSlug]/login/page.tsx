import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { ThemeRenderer } from "@/components/theme-renderer";
import { authMessageForCode } from "@/lib/auth-messages";
import { getPage } from "@/lib/data";
import {
  getCustomerBySessionFromState,
  getSiteAppsFromState,
  getSiteCreativePacksFromState,
  getSiteMediaAssetsFromState,
  getSiteProductsFromState,
  getThemeRuntimeFromSession,
  readPlatformState
} from "@/lib/server-store";
import { customerSessionCookie } from "@/lib/session";
import { themeStyleVars } from "@/lib/theme";
import { metadataForThemePage } from "@/lib/theme/seo";

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string }> }): Promise<Metadata> {
  const { siteSlug } = await params;
  const state = readPlatformState();
  const site = state.sites.find((item) => item.slug === siteSlug);
  const page = site?.pages.find((item) => item.slug === "/login");
  return site && page ? metadataForThemePage(site, page) : {};
}

export default async function SiteLoginPage({
  params,
  searchParams
}: {
  params: Promise<{ siteSlug: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const { siteSlug } = await params;
  const state = readPlatformState();
  const site = state.sites.find((item) => item.slug === siteSlug);
  if (!site) notFound();
  const sessionId = (await cookies()).get(customerSessionCookie(site.id))?.value;
  const current = getCustomerBySessionFromState(state, site.id, sessionId);
  if (current) redirect(`/site/${site.slug}/app`);
  const defaultCustomer = state.customers.find((customer) => customer.siteId === site.id) ?? state.customers.find((customer) => customer.email === "mara@northpier.studio");
  const defaultCustomerEmail = defaultCustomer?.email ?? "mara@northpier.studio";
  const defaultCustomerName = defaultCustomer?.name ?? "Mara Voss";
  const defaultCustomerPassword = "mara123";
  const errorCode = (await searchParams)?.error;
  site.mediaAssets = getSiteMediaAssetsFromState(state, site.id);
  const page = getPage(site, "/login");
  const settings = site.themeSettings.publishedJson;
  const runtime = {
    ...getThemeRuntimeFromSession(state, site.id, sessionId),
    auth: {
      defaultEmail: defaultCustomerEmail,
      defaultName: defaultCustomerName,
      defaultPassword: defaultCustomerPassword,
      initialMessage: authMessageForCode("customer", errorCode)
    }
  };

  return (
    <div style={themeStyleVars(settings)}>
      <ThemeRenderer
        creativePacks={getSiteCreativePacksFromState(state, site.id)}
        page={page.publishedJson}
        pagePath="/login"
        products={getSiteProductsFromState(state, site.id)}
        runtime={runtime}
        settings={settings}
        site={site}
        siteAiApps={getSiteAppsFromState(state, site.id)}
      />
    </div>
  );
}
