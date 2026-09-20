"use client";

// Account avatars are private customer media URLs; render them directly.
/* eslint-disable @next/next/no-img-element */

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  CreditCard,
  Download,
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
import type { AidreamcapesZipNavigation, CreativePack, CreativePackCategory, PublicCustomer, PublishedVideoNavigationProjection, Site, ThemeRuntimeData, ToolMenuItem, VideoThemeCategory } from "@/lib/types";
import type { PublishedSaveTheDateGroup } from "@/lib/save-the-date-publication";
import type { LucideIcon } from "lucide-react";

type CustomerAccountSite = Pick<Site, "id" | "slug" | "name" | "branding" | "primaryDomain">;
type AccountNavItem = { id: AccountSection; hash: string; icon: LucideIcon; label: string; description: string };
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const accountNavItems: AccountNavItem[] = [
  { id: "overview", hash: "account-overview", icon: WalletCards, label: "Overview", description: "Balance and activity" },
  { id: "profile", hash: "account-profile", icon: UserRound, label: "Profile", description: "Identity and email" },
  { id: "security", hash: "account-security", icon: KeyRound, label: "Security", description: "Password and sessions" },
  { id: "subscription", hash: "account-subscription", icon: PackageCheck, label: "Subscription", description: "Plan and billing" },
  { id: "credits", hash: "account-credits", icon: CreditCard, label: "Credits", description: "Balance and ledger" },
  { id: "purchases", hash: "account-purchases", icon: ReceiptText, label: "Purchases", description: "Orders and receipts" },
  { id: "generation", hash: "account-generation", icon: Sparkles, label: "Generation", description: "Request history" },
  { id: "downloads", hash: "account-downloads", icon: Download, label: "Downloads", description: "Delivered assets" },
  { id: "albums", hash: "account-albums", icon: Layers3, label: "Albums", description: "Private collections" },
  { id: "models", hash: "account-models", icon: ShieldCheck, label: "Models", description: "Private profiles" }
];

const legacySectionAliases: Record<string, AccountSection> = {
  "account-plan": "subscription",
  plan: "subscription",
  "account-orders": "purchases",
  orders: "purchases",
  "account-progress": "generation",
  jobs: "generation"
};

const accountSectionCopy: Record<AccountSection, { kicker: string; title: string; description: string }> = {
  overview: {
    kicker: "Customer account",
    title: "account center.",
    description: "Manage profile details, password, subscriptions, credits, purchases, generation history, downloads, delivered albums, and private models."
  },
  profile: {
    kicker: "Profile",
    title: "Profile details",
    description: "Update identity details and the email connected to your creative account."
  },
  security: {
    kicker: "Security",
    title: "Security controls",
    description: "Review password and active sessions without leaving the account center."
  },
  subscription: {
    kicker: "Subscription",
    title: "Plan and billing",
    description: "Review your plan tier, billing state, and renewal details."
  },
  credits: {
    kicker: "Credits",
    title: "Credit ledger",
    description: "Track available, reserved, used, and returned credits."
  },
  purchases: {
    kicker: "Purchases",
    title: "Orders and receipts",
    description: "Review recharge history, checkout status, and payment records."
  },
  generation: {
    kicker: "Generation",
    title: "Request history",
    description: "Follow every photoshoot request from upload to delivery."
  },
  downloads: {
    kicker: "Downloads",
    title: "Delivered assets",
    description: "Find files downloaded from this account."
  },
  albums: {
    kicker: "Albums",
    title: "Private collections",
    description: "Browse completed photo sets and their output counts."
  },
  models: {
    kicker: "Models",
    title: "Private AI models",
    description: "Review trained or collecting models connected to this account."
  }
};

function accountSectionFromHash(hash: string): AccountSection {
  const normalized = hash.replace(/^#/, "");
  return legacySectionAliases[normalized] ?? accountNavItems.find((item) => item.hash === normalized || item.id === normalized)?.id ?? "overview";
}

function accountInitials(name: string, email: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return `${words[0][0]}${words.at(-1)?.[0] ?? ""}`.toUpperCase();
  if (words[0]) return words[0].slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

export function CustomerAccountShell({
  site,
  aidreamcapesZipNavigation,
  customer,
  initialRuntime,
  creativePackCategories = [],
  creativePacks = [],
  toolMenuItems = [],
  videoThemeCategories = [],
  publishedVideoGenerationTopics,
  publishedSaveTheDateGroups,
  publishedSaveTheDateMenuLabel = "Save the Date"
}: {
  site: CustomerAccountSite;
  aidreamcapesZipNavigation?: AidreamcapesZipNavigation;
  customer: PublicCustomer;
  initialRuntime?: ThemeRuntimeData;
  creativePackCategories?: CreativePackCategory[];
  creativePacks?: CreativePack[];
  toolMenuItems?: ToolMenuItem[];
  videoThemeCategories?: VideoThemeCategory[];
  publishedVideoGenerationTopics?: PublishedVideoNavigationProjection[];
  publishedSaveTheDateGroups?: PublishedSaveTheDateGroup[];
  publishedSaveTheDateMenuLabel?: string;
}) {
  const basePath = hostAwareSitePath(site, "/").replace(/\/$/, "");
  const prefetchPaths = useMemo(() => [basePath || "/", `${basePath}/account`, `${basePath}/app/create`, `${basePath}/pricing`, `${basePath}/tools`], [basePath]);
  const runtimeCustomer = initialRuntime?.customer ?? customer;
  const accountDisplayName = runtimeCustomer.name?.trim() || runtimeCustomer.email.split("@")[0] || "Your";
  const activeSubscription = initialRuntime?.subscriptions?.find((subscription) => subscription.status === "active" || subscription.status === "trialing") ?? initialRuntime?.subscriptions?.[0];
  const planLabel = activeSubscription?.productName ?? activeSubscription?.priceLabel ?? "No plan";
  const [activeSection, setActiveSection] = useState<AccountSection>("overview");
  const [displayMode, setDisplayMode] = useState<"light" | "dark">("light");
  const activeCopy = accountSectionCopy[activeSection];
  const headline = activeSection === "overview" ? `${accountDisplayName}'s ${activeCopy.title}` : activeCopy.title;
  const initials = accountInitials(accountDisplayName, runtimeCustomer.email);

  useIsomorphicLayoutEffect(() => {
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
    <div className={`ac-account-shell ac-classic-account-shell${displayMode === "dark" ? " is-classic-dark" : ""}`} data-aidreamcapes-account-shell="true">
      <CustomerRoutePrefetch paths={prefetchPaths} />
      <StorefrontNavigationFeedback />
      <CustomerShellHeader aidreamcapesZipNavigation={aidreamcapesZipNavigation} creativePackCategories={creativePackCategories} creativePacks={creativePacks} customer={runtimeCustomer} publishedSaveTheDateGroups={publishedSaveTheDateGroups} publishedSaveTheDateMenuLabel={publishedSaveTheDateMenuLabel} publishedVideoGenerationTopics={publishedVideoGenerationTopics} site={site} tone="dark" toolMenuItems={toolMenuItems} videoThemeCategories={videoThemeCategories} />

      <div className="ac-classic-layout">
        <aside className="ac-classic-left-column" aria-label="Account navigation">
          <section className="ac-classic-card ac-classic-profile-card">
            <div className="ac-classic-profile-top">
              <span className="ac-classic-avatar">
                {runtimeCustomer.profile?.avatarUrl ? <img src={runtimeCustomer.profile.avatarUrl} alt="" /> : initials}
              </span>
              <div>
                <strong>{accountDisplayName}</strong>
                <span>{runtimeCustomer.email}</span>
              </div>
            </div>
            <div className="ac-classic-mini-stats">
              <div><span>Credits</span><strong>{runtimeCustomer.balance.available ?? 0}</strong></div>
              <div><span>Plan</span><strong>{planLabel}</strong></div>
            </div>
            <div className="ac-classic-profile-actions">
              <StorefrontInstantLink className="ac-classic-button ac-classic-button-primary" href={`${basePath}/app/create`}>Open workspace <span>↗</span></StorefrontInstantLink>
              <StorefrontInstantLink className="ac-classic-button ac-classic-button-secondary" href={`${basePath}/pricing`}>View pricing <span>↗</span></StorefrontInstantLink>
            </div>
          </section>

          <nav className="ac-classic-card ac-classic-account-nav" role="tablist" aria-label="Account modules">
            <div>
              {accountNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    aria-current={isActive ? "page" : undefined}
                    aria-selected={isActive}
                    className={isActive ? "is-active" : ""}
                    key={item.id}
                    onClick={() => selectSection(item.id, item.hash)}
                    role="tab"
                    type="button"
                  >
                    <span className="ac-classic-nav-icon"><Icon aria-hidden="true" strokeWidth={1.8} /></span>
                    <span><strong>{item.label}</strong><small>{item.description}</small></span>
                  </button>
                );
              })}
            </div>
          </nav>
        </aside>

        <main className="ac-classic-main-column" aria-live="polite">
          <section className="ac-classic-card ac-classic-hero">
            <div>
              <span className="ac-classic-eyebrow">{activeCopy.kicker}</span>
              <h1>{headline}</h1>
              <p>{activeCopy.description}</p>
            </div>
            <div className="ac-classic-theme-switch" aria-label="Display mode">
              <button aria-pressed={displayMode === "light"} className={displayMode === "light" ? "is-active" : ""} onClick={() => setDisplayMode("light")} type="button">Light</button>
              <button aria-pressed={displayMode === "dark"} className={displayMode === "dark" ? "is-active" : ""} onClick={() => setDisplayMode("dark")} type="button">Dark</button>
            </div>
          </section>

          <CustomerAccountDataIsland activeSection={activeSection} basePath={basePath} customer={runtimeCustomer} initialRuntime={initialRuntime} siteId={site.id} siteSlug={site.slug} />

          <p className="ac-classic-prototype-note"><b>Data contract unchanged.</b> Account queries, pagination, permissions, and mutations continue to use the existing data layer.</p>
        </main>
      </div>
    </div>
  );
}
