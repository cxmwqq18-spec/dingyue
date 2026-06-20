import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { ThemeRenderer } from "@/components/theme-renderer";
import { getPage } from "@/lib/data";
import {
  getCustomerBySessionFromState,
  getCustomerJobAssetsFromState,
  getCustomerLedgerFromState,
  getSiteAppsFromState,
  getSiteCreativePacksFromState,
  getSiteMediaAssetsFromState,
  getSiteProductsFromState,
  getThemeRuntimeForCustomer,
  readPlatformState,
  toThemeRuntimeAsset,
  toThemeRuntimeJob,
  toThemeRuntimeLedgerEntry
} from "@/lib/server-store";
import { customerSessionCookie } from "@/lib/session";
import { themeStyleVars } from "@/lib/theme";
import { metadataForThemePage } from "@/lib/theme/seo";

const jobDetailSlug = "/app/jobs/detail";

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string; jobId: string }> }): Promise<Metadata> {
  const { siteSlug } = await params;
  const state = readPlatformState();
  const site = state.sites.find((item) => item.slug === siteSlug);
  const page = site?.pages.find((item) => item.slug === jobDetailSlug || item.pageType === "job_detail");
  return site && page ? metadataForThemePage(site, page) : {};
}

export default async function JobDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ siteSlug: string; jobId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { siteSlug, jobId } = await params;
  const query = searchParams ? await searchParams : {};
  const state = readPlatformState();
  const site = state.sites.find((item) => item.slug === siteSlug);
  if (!site) notFound();
  const sessionId = (await cookies()).get(customerSessionCookie(site.id))?.value;
  const current = getCustomerBySessionFromState(state, site.id, sessionId);
  if (!current) redirect(`/site/${site.slug}/login`);

  const job = state.jobs.find((item) => item.id === jobId && item.siteId === site.id && item.customerId === current.customer.id);
  if (!job) notFound();

  site.mediaAssets = getSiteMediaAssetsFromState(state, site.id);
  const page = site.pages.find((item) => item.slug === jobDetailSlug || item.pageType === "job_detail") ?? getPage(site, "/app/jobs/progress");
  const settings = site.themeSettings.publishedJson;
  const runtime = {
    ...getThemeRuntimeForCustomer(state, site.id, current.customer.id),
    jobDetail: {
      job: toThemeRuntimeJob(job),
      ledger: getCustomerLedgerFromState(state, site.id, current.customer.id)
        .filter((entry) => entry.sourceId === job.id)
        .map(toThemeRuntimeLedgerEntry),
      assets: getCustomerJobAssetsFromState(state, site.id, current.customer.id, job.id).map((asset) => toThemeRuntimeAsset(state, asset))
    }
  };

  return (
    <div style={themeStyleVars(settings)}>
      <ThemeRenderer
        creativePacks={getSiteCreativePacksFromState(state, site.id)}
        page={page.publishedJson}
        pagePath={`/app/jobs/${job.id}`}
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
