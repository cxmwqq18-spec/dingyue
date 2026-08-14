"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CreditCard,
  Download,
  History,
  KeyRound,
  Layers3,
  PackageCheck,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  UserRound,
  WalletCards
} from "lucide-react";
import { CustomerAccountDataIsland, type AccountSection } from "@/components/storefront/customer-account-data-island";
import { CustomerShellHeader } from "@/components/storefront/customer-shell-header";
import { CustomerRoutePrefetch } from "@/components/storefront/customer-route-prefetch";
import { StorefrontNavigationFeedback } from "@/components/storefront/navigation-feedback";
import { StorefrontInstantLink } from "@/components/storefront/storefront-instant-link";
import { hostAwareSitePath } from "@/lib/domain-routing";
import type { CreativePack, CreativePackCategory, PublicCustomer, Site, ThemeRuntimeData, ToolMenuItem } from "@/lib/types";
import type { LucideIcon } from "lucide-react";

type CustomerAccountSite = Pick<Site, "id" | "slug" | "name" | "branding" | "primaryDomain">;
type AccountNavItem = { id: AccountSection; hash: string; icon: LucideIcon; label: string; description: string };

const accountNavItems: AccountNavItem[] = [
  { id: "overview", hash: "account-overview", icon: WalletCards, label: "Overview", description: "Balance, plan, and recent activity" },
  { id: "profile", hash: "account-profile", icon: UserRound, label: "Profile", description: "Avatar, display name, and email" },
  { id: "security", hash: "account-security", icon: KeyRound, label: "Security", description: "Password and sessions" },
  { id: "subscription", hash: "account-subscription", icon: PackageCheck, label: "Subscription", description: "Plan tier and billing status" },
  { id: "credits", hash: "account-credits", icon: CreditCard, label: "Credits", description: "Balance and ledger" },
  { id: "purchases", hash: "account-purchases", icon: ReceiptText, label: "Purchases", description: "Recharge and order records" },
  { id: "generation", hash: "account-generation", icon: Sparkles, label: "Generation", description: "Photoshoot request history" },
  { id: "downloads", hash: "account-downloads", icon: Download, label: "Downloads", description: "Downloaded asset history" },
  { id: "albums", hash: "account-albums", icon: Layers3, label: "Albums", description: "Delivered photo sets" },
  { id: "models", hash: "account-models", icon: ShieldCheck, label: "Models", description: "Private trained models" }
];

const legacySectionAliases: Record<string, AccountSection> = {
  "account-plan": "subscription",
  plan: "subscription",
  "account-orders": "purchases",
  orders: "purchases",
  "account-progress": "generation",
  jobs: "generation"
};

function accountSectionFromHash(hash: string): AccountSection {
  const normalized = hash.replace(/^#/, "");
  return legacySectionAliases[normalized] ?? accountNavItems.find((item) => item.hash === normalized || item.id === normalized)?.id ?? "overview";
}

function shortEmail(email: string) {
  if (email.length <= 30) return email;
  const [name, domain] = email.split("@");
  if (!domain) return email.slice(0, 27) + "...";
  return `${name.slice(0, 12)}...@${domain}`;
}

export function CustomerAccountShell({
  site,
  customer,
  initialRuntime,
  creativePackCategories = [],
  creativePacks = [],
  toolMenuItems = []
}: {
  site: CustomerAccountSite;
  customer: PublicCustomer;
  initialRuntime?: ThemeRuntimeData;
  creativePackCategories?: CreativePackCategory[];
  creativePacks?: CreativePack[];
  toolMenuItems?: ToolMenuItem[];
}) {
  const basePath = hostAwareSitePath(site, "/").replace(/\/$/, "");
  const prefetchPaths = useMemo(() => [basePath || "/", `${basePath}/account`, `${basePath}/app/create`, `${basePath}/pricing`, `${basePath}/tools`], [basePath]);
  const runtimeCustomer = initialRuntime?.customer ?? customer;
  const accountDisplayName = runtimeCustomer.name?.trim() || runtimeCustomer.email.split("@")[0] || "Your";
  const activeSubscription = initialRuntime?.subscriptions?.find((subscription) => subscription.status === "active" || subscription.status === "trialing") ?? initialRuntime?.subscriptions?.[0];
  const [activeSection, setActiveSection] = useState<AccountSection>("overview");

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
    <div className="min-h-screen bg-[#05070e] text-white">
      <CustomerRoutePrefetch paths={prefetchPaths} />
      <StorefrontNavigationFeedback />
      <CustomerShellHeader creativePackCategories={creativePackCategories} creativePacks={creativePacks} customer={runtimeCustomer} site={site} tone="dark" toolMenuItems={toolMenuItems} />

      <main className="mx-auto grid w-full max-w-[1760px] gap-5 px-4 py-5 sm:px-6 xl:grid-cols-[320px_minmax(0,1fr)] xl:px-8">
        <aside className="min-w-0 xl:sticky xl:top-[112px] xl:self-start">
          <section className="w-full rounded-[8px] border border-white/10 bg-[#0b0f17] p-4 shadow-[0_28px_90px_-62px_rgba(0,0,0,0.95)]">
            <div className="flex items-center gap-3">
              <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-[8px] border border-white/12 bg-white/[0.08]">
                {runtimeCustomer.profile?.avatarUrl ? (
                  <img className="h-full w-full object-cover" src={runtimeCustomer.profile.avatarUrl} alt="" />
                ) : (
                  <UserRound className="h-6 w-6 text-white/72" strokeWidth={1.8} />
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold">{accountDisplayName}</p>
                <p className="mt-0.5 truncate text-xs text-white/50">{shortEmail(runtimeCustomer.email)}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-[8px] border border-white/10 bg-white/[0.045] p-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/38">Credits</p>
                <p className="mt-1 text-xl font-semibold">{runtimeCustomer.balance.available ?? 0}</p>
              </div>
              <div className="rounded-[8px] border border-white/10 bg-white/[0.045] p-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/38">Plan</p>
                <p className="mt-1 truncate text-sm font-semibold">{activeSubscription?.productName ?? activeSubscription?.priceLabel ?? "No plan"}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              <StorefrontInstantLink className="inline-flex items-center justify-center gap-2 rounded-[8px] bg-white px-4 py-2 text-sm font-semibold text-[#0b0d12] transition hover:bg-white/90" href={`${basePath}/app/create`}>
                Open workspace
                <Sparkles className="h-4 w-4" strokeWidth={1.8} />
              </StorefrontInstantLink>
              <StorefrontInstantLink className="inline-flex items-center justify-center gap-2 rounded-[8px] border border-white/12 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.08]" href={`${basePath}/pricing`}>
                View pricing
                <History className="h-4 w-4" strokeWidth={1.8} />
              </StorefrontInstantLink>
            </div>
          </section>

          <nav aria-label="Account modules" className="mt-4 w-full min-w-0 overflow-x-auto rounded-[8px] border border-white/10 bg-[#0b0f17] p-2 shadow-[0_28px_90px_-62px_rgba(0,0,0,0.95)] xl:overflow-visible">
            <div className="flex min-w-max gap-1 xl:grid xl:min-w-0">
              {accountNavItems.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                return (
                  <button
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-12 min-w-[10rem] items-center gap-3 rounded-[8px] px-3 py-2 text-left transition xl:min-w-0 ${active ? "bg-white text-[#0b0d12]" : "text-white/70 hover:bg-white/[0.07] hover:text-white"}`}
                    key={item.id}
                    onClick={() => selectSection(item.id, item.hash)}
                    type="button"
                  >
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{item.label}</span>
                      <span className={`hidden truncate text-[11px] xl:block ${active ? "text-[#0b0d12]/58" : "text-white/38"}`}>{item.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>
        </aside>

        <section className="min-w-0">
          <div className="mb-5 rounded-[8px] border border-white/10 bg-[#0b0f17] p-5 shadow-[0_28px_90px_-62px_rgba(0,0,0,0.95)] sm:p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/42">Customer account</p>
            <h1 className="mt-3 max-w-4xl text-3xl font-semibold leading-tight tracking-normal text-white md:text-5xl">
              {accountDisplayName}&apos;s account center.
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/62">
              Manage profile details, password, subscriptions, credits, purchases, generation history, downloads, delivered albums, and private models.
            </p>
          </div>

          <CustomerAccountDataIsland activeSection={activeSection} basePath={basePath} customer={runtimeCustomer} initialRuntime={initialRuntime} siteId={site.id} siteSlug={site.slug} />
        </section>
      </main>
    </div>
  );
}
