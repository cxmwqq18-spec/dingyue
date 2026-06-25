import { AssetsPanel } from "@/components/app/assets-panel";
import { JobCreateForm } from "@/components/app/job-create-form";
import { StorefrontInstantLink } from "@/components/storefront/storefront-instant-link";
import type { CreativePack, PublicCustomer, Site, SiteAiApp, ThemeRuntimeAsset } from "@/lib/types";

type CustomerWorkspaceSite = Pick<Site, "id" | "slug" | "name" | "branding">;

export function CustomerWorkspaceShell({
  site,
  customer,
  assets,
  siteAiApps,
  creativePacks,
  initialCreativePackId
}: {
  site: CustomerWorkspaceSite;
  customer: PublicCustomer;
  assets: ThemeRuntimeAsset[];
  siteAiApps: SiteAiApp[];
  creativePacks: CreativePack[];
  initialCreativePackId?: string;
}) {
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
          <StorefrontInstantLink className="min-w-0 rounded-full border border-[#171514] bg-[#171514] px-4 py-2 text-sm font-semibold text-white" href={`${basePath}/account`}>
            <span className="block max-w-[10rem] truncate">{customer.name}</span>
          </StorefrontInstantLink>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-5 py-8">
        <section className="rounded-[32px] border border-[#eadfce] bg-[#fffaf3] p-6 shadow-[0_30px_90px_-70px_rgba(20,22,26,0.35)]">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#b17b47]">Private client flow</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight tracking-tight md:text-5xl">A real customer workspace, not just a landing page.</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#625d56]">
            Upload source photos, choose a package, start a private generation request, and come back to the account center for progress and delivered albums.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
            <a className="rounded-full border border-[#171514] bg-[#171514] px-4 py-2 text-white" href="#create">Choose a tool</a>
            <a className="rounded-full border border-[#dfd3c4] bg-white px-4 py-2 text-[#171514]" href="#upload_1">Upload photos</a>
            <StorefrontInstantLink className="rounded-full border border-[#dfd3c4] bg-white px-4 py-2 text-[#171514]" href={`${basePath}/account`}>
              Account actions
            </StorefrontInstantLink>
          </div>
        </section>

        <section className="scroll-mt-28 rounded-[32px] border border-[#eadfce] bg-white p-6 shadow-[0_24px_80px_-68px_rgba(20,22,26,0.35)]" id="create">
          <JobCreateForm
            assets={assets}
            creativePacks={creativePacks.map((pack) => ({ ...pack, prompt: undefined }))}
            customer={customer}
            initialCreativePackId={initialCreativePackId}
            siteAiApps={siteAiApps}
            siteId={site.id}
            siteSlug={site.slug}
          />
        </section>

        <section className="scroll-mt-28 rounded-[32px] border border-[#eadfce] bg-white p-6 shadow-[0_24px_80px_-68px_rgba(20,22,26,0.35)]" id="upload_1">
          <AssetsPanel assets={assets} customer={customer} siteId={site.id} />
        </section>
      </main>
    </div>
  );
}
