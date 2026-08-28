"use client";

// Account avatars are private customer media URLs; render them directly.
/* eslint-disable @next/next/no-img-element */

import { useEffect, useLayoutEffect, useMemo, useState, type CSSProperties } from "react";
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
import type { CreativePack, CreativePackCategory, PublicCustomer, PublishedVideoNavigationProjection, Site, ThemeRuntimeData, ToolMenuItem, VideoThemeCategory } from "@/lib/types";
import type { PublishedSaveTheDateGroup } from "@/lib/save-the-date-publication";
import type { LucideIcon } from "lucide-react";

type CustomerAccountSite = Pick<Site, "id" | "slug" | "name" | "branding" | "primaryDomain">;
type AccountNavItem = { id: AccountSection; hash: string; icon: LucideIcon; label: string; description: string };
export type AccountTheme = "midnight" | "soft";
type AccountThemeVars = CSSProperties & Record<`--${string}`, string>;

const accountThemeStorageKey = "mydreamshoots:account-theme:v1";
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const accountThemeVars: Record<AccountTheme, AccountThemeVars> = {
  midnight: {
    "--account-page-bg": "#101724",
    "--account-surface": "#172133",
    "--account-surface-elevated": "#1d2940",
    "--account-panel": "#121b2b",
    "--account-panel-soft": "#202c42",
    "--account-field": "#0f1726",
    "--account-border": "rgba(157, 177, 210, 0.22)",
    "--account-border-strong": "rgba(180, 197, 225, 0.36)",
    "--account-text": "#edf4ff",
    "--account-strong": "#ffffff",
    "--account-muted": "#a9b8cf",
    "--account-faint": "#8190aa",
    "--account-subtle": "#6f7f99",
    "--account-accent": "#8e9cff",
    "--account-accent-strong": "#a9b4ff",
    "--account-accent-bg": "rgba(142, 156, 255, 0.16)",
    "--account-accent-bg-strong": "rgba(142, 156, 255, 0.24)",
    "--account-button-bg": "#6577f2",
    "--account-button-hover": "#7d8bff",
    "--account-button-border": "rgba(151, 165, 255, 0.45)",
    "--account-hover-bg": "rgba(232, 240, 255, 0.07)",
    "--account-skeleton": "rgba(210, 224, 244, 0.12)",
    "--account-skeleton-soft": "rgba(210, 224, 244, 0.07)",
    "--account-shadow": "0 28px 90px -58px rgba(0, 0, 0, 0.9)",
    "--account-success-bg": "rgba(52, 211, 153, 0.12)",
    "--account-success-border": "rgba(110, 231, 183, 0.34)",
    "--account-success-text": "#8bf2c8",
    "--account-warn-bg": "rgba(251, 191, 36, 0.13)",
    "--account-warn-border": "rgba(252, 211, 77, 0.36)",
    "--account-warn-text": "#ffd77a",
    "--account-danger-bg": "rgba(251, 113, 133, 0.13)",
    "--account-danger-border": "rgba(253, 164, 175, 0.36)",
    "--account-danger-text": "#ffadba"
  },
  soft: {
    "--account-page-bg": "#eef3f8",
    "--account-surface": "#ffffff",
    "--account-surface-elevated": "#ffffff",
    "--account-panel": "#f7f9fc",
    "--account-panel-soft": "#eef3f8",
    "--account-field": "#ffffff",
    "--account-border": "#d7e0ea",
    "--account-border-strong": "#cfd9e7",
    "--account-text": "#172033",
    "--account-strong": "#111827",
    "--account-muted": "#536279",
    "--account-faint": "#697890",
    "--account-subtle": "#8a98aa",
    "--account-accent": "#3657d6",
    "--account-accent-strong": "#2846bd",
    "--account-accent-bg": "#e8edff",
    "--account-accent-bg-strong": "#dfe6ff",
    "--account-button-bg": "#3657d6",
    "--account-button-hover": "#2846bd",
    "--account-button-border": "#2e4fcb",
    "--account-hover-bg": "#f4f7fb",
    "--account-skeleton": "#e6edf5",
    "--account-skeleton-soft": "#f4f7fb",
    "--account-shadow": "0 24px 70px -48px rgba(26, 42, 70, 0.42)",
    "--account-success-bg": "#ecfdf5",
    "--account-success-border": "#a7f3d0",
    "--account-success-text": "#047857",
    "--account-warn-bg": "#fffbeb",
    "--account-warn-border": "#fde68a",
    "--account-warn-text": "#b45309",
    "--account-danger-bg": "#fff1f2",
    "--account-danger-border": "#fecdd3",
    "--account-danger-text": "#be123c"
  }
};

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

function storedAccountTheme(): AccountTheme {
  if (typeof window === "undefined") return "midnight";
  const value = window.localStorage.getItem(accountThemeStorageKey);
  return value === "soft" || value === "midnight" ? value : "midnight";
}

export function CustomerAccountShell({
  site,
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
  const [activeSection, setActiveSection] = useState<AccountSection>("overview");
  const [accountTheme, setAccountTheme] = useState<AccountTheme>("midnight");
  const [themeReady, setThemeReady] = useState(false);

  useIsomorphicLayoutEffect(() => {
    if (typeof window === "undefined") return;
    setActiveSection(accountSectionFromHash(window.location.hash));
    const handleHashChange = () => setActiveSection(accountSectionFromHash(window.location.hash));
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    setAccountTheme(storedAccountTheme());
    setThemeReady(true);
  }, []);

  useEffect(() => {
    if (!themeReady || typeof window === "undefined") return;
    window.localStorage.setItem(accountThemeStorageKey, accountTheme);
  }, [accountTheme, themeReady]);

  function selectSection(section: AccountSection, hash: string) {
    setActiveSection(section);
    if (typeof window !== "undefined") window.history.replaceState(null, "", `#${hash}`);
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--account-page-bg)] text-[var(--account-text)]" data-account-theme={accountTheme} style={accountThemeVars[accountTheme]}>
      <CustomerRoutePrefetch paths={prefetchPaths} />
      <StorefrontNavigationFeedback />
      <CustomerShellHeader creativePackCategories={creativePackCategories} creativePacks={creativePacks} customer={runtimeCustomer} publishedSaveTheDateGroups={publishedSaveTheDateGroups} publishedSaveTheDateMenuLabel={publishedSaveTheDateMenuLabel} publishedVideoGenerationTopics={publishedVideoGenerationTopics} site={site} tone="dark" toolMenuItems={toolMenuItems} videoThemeCategories={videoThemeCategories} />

      <main className="mx-auto grid w-full max-w-[1760px] gap-5 px-4 py-5 sm:px-6 xl:grid-cols-[320px_minmax(0,1fr)] xl:px-8">
        <aside className="min-w-0 max-w-full overflow-hidden xl:sticky xl:top-[112px] xl:self-start xl:overflow-visible">
          <section className="w-full rounded-[8px] border border-[var(--account-border)] bg-[var(--account-surface)] p-4 shadow-[var(--account-shadow)]">
            <div className="flex items-center gap-3">
              <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-[8px] border border-[var(--account-border-strong)] bg-[var(--account-panel)]">
                {runtimeCustomer.profile?.avatarUrl ? (
                  <img className="h-full w-full object-cover" src={runtimeCustomer.profile.avatarUrl} alt="" />
                ) : (
                  <UserRound className="h-6 w-6 text-[var(--account-muted)]" strokeWidth={1.8} />
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-[var(--account-strong)]">{accountDisplayName}</p>
                <p className="mt-0.5 truncate text-xs text-[var(--account-muted)]">{shortEmail(runtimeCustomer.email)}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-[8px] border border-[var(--account-border)] bg-[var(--account-panel)] p-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--account-faint)]">Credits</p>
                <p className="mt-1 text-xl font-semibold text-[var(--account-strong)]">{runtimeCustomer.balance.available ?? 0}</p>
              </div>
              <div className="rounded-[8px] border border-[var(--account-border)] bg-[var(--account-panel)] p-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--account-faint)]">Plan</p>
                <p className="mt-1 truncate text-sm font-semibold text-[var(--account-strong)]">{activeSubscription?.productName ?? activeSubscription?.priceLabel ?? "No plan"}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              <StorefrontInstantLink className="inline-flex items-center justify-center gap-2 rounded-[8px] border border-[var(--account-button-border)] bg-[var(--account-button-bg)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--account-button-hover)]" href={`${basePath}/app/create`}>
                Open workspace
                <Sparkles className="h-4 w-4" strokeWidth={1.8} />
              </StorefrontInstantLink>
              <StorefrontInstantLink className="inline-flex items-center justify-center gap-2 rounded-[8px] border border-[var(--account-border-strong)] px-4 py-2 text-sm font-semibold text-[var(--account-text)] transition hover:border-[var(--account-accent)] hover:bg-[var(--account-hover-bg)]" href={`${basePath}/pricing`}>
                View pricing
                <History className="h-4 w-4" strokeWidth={1.8} />
              </StorefrontInstantLink>
            </div>
          </section>

          <nav aria-label="Account modules" className="mt-4 w-full min-w-0 overflow-x-auto rounded-[8px] border border-[var(--account-border)] bg-[var(--account-surface)] p-2 shadow-[var(--account-shadow)] xl:overflow-visible">
            <div className="flex min-w-max gap-1 xl:grid xl:min-w-0">
              {accountNavItems.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                return (
                  <button
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-12 min-w-[10rem] items-center gap-3 rounded-[8px] px-3 py-2 text-left transition xl:min-w-0 ${active ? "bg-[var(--account-accent-bg)] text-[var(--account-accent-strong)]" : "text-[var(--account-muted)] hover:bg-[var(--account-hover-bg)] hover:text-[var(--account-text)]"}`}
                    key={item.id}
                    onClick={() => selectSection(item.id, item.hash)}
                    type="button"
                  >
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{item.label}</span>
                      <span className={`hidden truncate text-[11px] xl:block ${active ? "text-[var(--account-accent-strong)]" : "text-[var(--account-faint)]"}`}>{item.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>
        </aside>

        <section className="min-w-0">
          <div className="mb-5 rounded-[8px] border border-[var(--account-border)] bg-[var(--account-surface)] p-5 shadow-[var(--account-shadow)] sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--account-faint)]">Customer account</p>
                <h1 className="mt-3 max-w-4xl text-3xl font-semibold leading-tight tracking-normal text-[var(--account-strong)] md:text-5xl">
                  {accountDisplayName}&apos;s account center.
                </h1>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--account-muted)]">
                  Manage profile details, password, subscriptions, credits, purchases, generation history, downloads, delivered albums, and private models.
                </p>
              </div>
              <div className="inline-flex rounded-[8px] border border-[var(--account-border-strong)] bg-[var(--account-panel)] p-1" aria-label="Account theme">
                {(["midnight", "soft"] as const).map((theme) => {
                  const active = accountTheme === theme;
                  return (
                    <button
                      aria-label={theme === "midnight" ? "Use Midnight Studio account theme" : "Use Soft Studio account theme"}
                      aria-pressed={active}
                      className={`h-9 rounded-[8px] px-3 text-xs font-semibold transition ${active ? "bg-[var(--account-accent-bg)] text-[var(--account-accent-strong)]" : "text-[var(--account-muted)] hover:bg-[var(--account-hover-bg)] hover:text-[var(--account-text)]"}`}
                      key={theme}
                      onClick={() => setAccountTheme(theme)}
                      type="button"
                    >
                      {theme === "midnight" ? "Dark" : "Light"}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <CustomerAccountDataIsland activeSection={activeSection} basePath={basePath} customer={runtimeCustomer} initialRuntime={initialRuntime} siteId={site.id} siteSlug={site.slug} />
        </section>
      </main>
    </div>
  );
}
