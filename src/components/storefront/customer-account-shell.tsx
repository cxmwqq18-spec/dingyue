"use client";

import { useMemo } from "react";
import { CustomerAccountDataIsland } from "@/components/storefront/customer-account-data-island";
import { CustomerShellHeader } from "@/components/storefront/customer-shell-header";
import { CustomerRoutePrefetch } from "@/components/storefront/customer-route-prefetch";
import { StorefrontNavigationFeedback } from "@/components/storefront/navigation-feedback";
import { StorefrontInstantLink } from "@/components/storefront/storefront-instant-link";
import { hostAwareSitePath } from "@/lib/domain-routing";
import type { PublicCustomer, Site, ThemeRuntimeData } from "@/lib/types";

type CustomerAccountSite = Pick<Site, "id" | "slug" | "name" | "branding" | "primaryDomain">;

export function CustomerAccountShell({ site, customer, initialRuntime }: { site: CustomerAccountSite; customer: PublicCustomer; initialRuntime?: ThemeRuntimeData }) {
  const basePath = hostAwareSitePath(site, "/").replace(/\/$/, "");
  const prefetchPaths = useMemo(() => [`${basePath}/app`, `${basePath}/pricing`, `${basePath}/tools`], [basePath]);

  return (
    <div className="min-h-screen bg-[#f6f1e8] text-[#171514]">
      <CustomerRoutePrefetch paths={prefetchPaths} />
      <StorefrontNavigationFeedback />
      <CustomerShellHeader customer={customer} site={site} tone="light" />

      <main className="mx-auto grid max-w-6xl gap-5 px-5 py-7">
        <section className="rounded-[20px] border border-[#eadfce] bg-[#fffaf3] p-5 shadow-[0_14px_36px_-30px_rgba(20,22,26,0.45)] md:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9b6b42]">Customer account</p>
          <div className="mt-3">
            <div>
              <h1 className="max-w-3xl text-3xl font-semibold leading-tight tracking-[-0.02em] md:text-4xl">Your private account center.</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[#625d56]">
                Review your credits, orders, generation progress, delivered albums, and private activity from one place.
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
            <StorefrontInstantLink className="rounded-full border border-[#171514] bg-[#171514] px-4 py-2 text-white" href={`${basePath}/app/create`}>
              Start workspace
            </StorefrontInstantLink>
            <StorefrontInstantLink className="rounded-full border border-[#dfd3c4] bg-white px-4 py-2 text-[#171514]" href={`${basePath}/pricing`}>
              View pricing
            </StorefrontInstantLink>
            <StorefrontInstantLink className="rounded-full border border-[#dfd3c4] bg-white px-4 py-2 text-[#171514]" href={`${basePath}/tools`}>
              Explore tools
            </StorefrontInstantLink>
          </div>
        </section>

        <section className="rounded-[20px] border border-[#eadfce] bg-[#fffaf3] p-5 shadow-[0_14px_36px_-30px_rgba(20,22,26,0.45)] md:p-6">
          <CustomerAccountDataIsland initialRuntime={initialRuntime} siteId={site.id} siteSlug={site.slug} />
        </section>
      </main>
    </div>
  );
}
