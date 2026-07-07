"use client";

import { useEffect, useMemo, useState } from "react";
import { CustomerAccountDataIsland, type AccountSection } from "@/components/storefront/customer-account-data-island";
import { CustomerShellHeader } from "@/components/storefront/customer-shell-header";
import { CustomerRoutePrefetch } from "@/components/storefront/customer-route-prefetch";
import { StorefrontNavigationFeedback } from "@/components/storefront/navigation-feedback";
import { StorefrontInstantLink } from "@/components/storefront/storefront-instant-link";
import { hostAwareSitePath } from "@/lib/domain-routing";
import type { CreativePack, PublicCustomer, Site, ThemeRuntimeData } from "@/lib/types";

type CustomerAccountSite = Pick<Site, "id" | "slug" | "name" | "branding" | "primaryDomain">;
const accountNavItems = [
  { id: "plan", hash: "account-plan", label: "Plan" },
  { id: "orders", hash: "account-orders", label: "Orders" },
  { id: "jobs", hash: "account-progress", label: "Generation progress" },
  { id: "albums", hash: "account-albums", label: "Albums" },
  { id: "credits", hash: "account-credits", label: "Credits" }
] satisfies Array<{ id: AccountSection; hash: string; label: string }>;

function accountSectionFromHash(hash: string): AccountSection {
  const normalized = hash.replace(/^#/, "");
  return accountNavItems.find((item) => item.hash === normalized || item.id === normalized)?.id ?? "plan";
}

export function CustomerAccountShell({
  site,
  customer,
  initialRuntime,
  creativePacks = []
}: {
  site: CustomerAccountSite;
  customer: PublicCustomer;
  initialRuntime?: ThemeRuntimeData;
  creativePacks?: CreativePack[];
}) {
  const basePath = hostAwareSitePath(site, "/").replace(/\/$/, "");
  const prefetchPaths = useMemo(() => [basePath || "/", `${basePath}/app`, `${basePath}/pricing`, `${basePath}/tools`], [basePath]);
  const accountDisplayName = customer.name?.trim() || customer.email.split("@")[0] || "Your";
  const [activeSection, setActiveSection] = useState<AccountSection>("plan");

  useEffect(() => {
    if (typeof window === "undefined") return;
    setActiveSection(accountSectionFromHash(window.location.hash));
    const handleHashChange = () => setActiveSection(accountSectionFromHash(window.location.hash));
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  function selectSection(section: AccountSection, hash: string) {
    setActiveSection(section);
    if (typeof window !== "undefined") window.history.replaceState(null, "", `#${hash}`);
  }

  return (
    <div className="min-h-screen bg-[#f6f1e8] text-[#171514]">
      <CustomerRoutePrefetch paths={prefetchPaths} />
      <StorefrontNavigationFeedback />
      <CustomerShellHeader creativePacks={creativePacks} customer={customer} site={site} tone="light" />

      <main className="mx-auto grid w-full max-w-[1920px] gap-5 px-4 py-6 sm:px-6 xl:px-8">
        <section className="rounded-[20px] border border-[#eadfce] bg-[#fffaf3] p-5 shadow-[0_14px_36px_-30px_rgba(20,22,26,0.45)] md:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9b6b42]">Customer account</p>
          <div className="mt-3">
            <div>
              <h1 className="max-w-3xl text-3xl font-semibold leading-tight tracking-[-0.02em] md:text-4xl">{accountDisplayName}&apos;s account center.</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[#625d56]">
                Signed in as {customer.email}. Review credits, orders, generation progress, delivered albums, and private activity from one place.
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

        <section className="rounded-[20px] border border-[#eadfce] bg-[#fffaf3] p-4 shadow-[0_14px_36px_-30px_rgba(20,22,26,0.45)] md:p-5">
          <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="lg:sticky lg:top-[116px] lg:self-start">
              <nav aria-label="Account modules" className="rounded-[18px] border border-[#dfd3c4] bg-white p-3">
                <p className="px-2 pb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[#9b8a79]">Account modules</p>
                <div className="grid gap-1">
                  {accountNavItems.map((item) => (
                    <button
                      aria-current={activeSection === item.id ? "page" : undefined}
                      className={`rounded-[12px] px-3 py-2 text-left text-sm font-semibold transition ${activeSection === item.id ? "bg-[#fbf7f0] text-[#171514]" : "text-[#625d56] hover:bg-[#fbf7f0] hover:text-[#171514]"}`}
                      key={item.id}
                      onClick={() => selectSection(item.id, item.hash)}
                      type="button"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </nav>
            </aside>
            <CustomerAccountDataIsland activeSection={activeSection} customerId={customer.id} initialRuntime={initialRuntime} siteId={site.id} siteSlug={site.slug} />
          </div>
        </section>
      </main>
    </div>
  );
}
