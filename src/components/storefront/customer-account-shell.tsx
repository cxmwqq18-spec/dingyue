import { CustomerAccountDataIsland } from "@/components/storefront/customer-account-data-island";
import { StorefrontInstantLink } from "@/components/storefront/storefront-instant-link";
import type { PublicCustomer, Site } from "@/lib/types";

type CustomerAccountSite = Pick<Site, "id" | "slug" | "name" | "branding">;

export function CustomerAccountShell({ site, customer }: { site: CustomerAccountSite; customer: PublicCustomer }) {
  const basePath = `/site/${site.slug}`;

  return (
    <div className="min-h-screen bg-[#f4ede2] text-[#171514]">
      <header className="sticky top-0 z-50 border-b border-[#eadfce] bg-[#fffaf3]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <StorefrontInstantLink className="text-lg font-semibold tracking-tight" href={basePath}>
            {site.branding.logoText || site.name}
          </StorefrontInstantLink>
          <nav className="hidden items-center gap-2 text-sm font-semibold md:flex">
            <StorefrontInstantLink className="rounded-full border border-[#dfd3c4] bg-white px-4 py-2" href={`${basePath}/collections`}>
              Photo Packages
            </StorefrontInstantLink>
            <StorefrontInstantLink className="rounded-full border border-[#dfd3c4] bg-white px-4 py-2" href={`${basePath}/tools`}>
              Tools
            </StorefrontInstantLink>
            <StorefrontInstantLink className="rounded-full border border-[#dfd3c4] bg-white px-4 py-2" href={`${basePath}/pricing`}>
              Pricing
            </StorefrontInstantLink>
          </nav>
          <StorefrontInstantLink className="rounded-full border border-[#171514] bg-[#171514] px-4 py-2 text-sm font-semibold text-white" href={`${basePath}/app#upload_1`}>
            Open workspace
          </StorefrontInstantLink>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-5 py-8">
        <section className="rounded-[32px] border border-[#eadfce] bg-[#fffaf3] p-6 shadow-[0_30px_90px_-70px_rgba(20,22,26,0.35)]">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#b17b47]">Customer account</p>
          <div className="mt-3 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight md:text-5xl">Your private account center.</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[#625d56]">
                Review your credits, orders, generation progress, delivered albums, and private activity from one place.
              </p>
            </div>
            <div className="min-w-0 rounded-[24px] border border-[#dfd3c4] bg-white px-5 py-4 text-sm">
              <p className="font-semibold text-[#171514]">{customer.name}</p>
              <p className="mt-1 truncate text-[#706961]">{customer.email}</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
            <StorefrontInstantLink className="rounded-full border border-[#171514] bg-[#171514] px-4 py-2 text-white" href={`${basePath}/app#upload_1`}>
              Upload photos
            </StorefrontInstantLink>
            <StorefrontInstantLink className="rounded-full border border-[#dfd3c4] bg-white px-4 py-2 text-[#171514]" href={`${basePath}/pricing`}>
              View pricing
            </StorefrontInstantLink>
            <StorefrontInstantLink className="rounded-full border border-[#dfd3c4] bg-white px-4 py-2 text-[#171514]" href={`${basePath}/tools`}>
              Explore tools
            </StorefrontInstantLink>
          </div>
        </section>

        <section className="rounded-[32px] border border-[#eadfce] bg-[#fffaf3] p-6 shadow-[0_24px_80px_-68px_rgba(20,22,26,0.35)]">
          <CustomerAccountDataIsland siteId={site.id} siteSlug={site.slug} />
        </section>
      </main>
    </div>
  );
}
