"use client";

import { useEffect, useMemo, useState } from "react";
import { Bot, Camera, CheckCircle2, ChevronRight, Compass, ImageIcon, LayoutGrid, PlaySquare, Search, Sparkles, UploadCloud } from "lucide-react";
import { AssetsPanel } from "@/components/app/assets-panel";
import { JobCreateForm } from "@/components/app/job-create-form";
import { CustomerShellHeader } from "@/components/storefront/customer-shell-header";
import { CustomerRoutePrefetch } from "@/components/storefront/customer-route-prefetch";
import { StorefrontNavigationFeedback } from "@/components/storefront/navigation-feedback";
import { StorefrontInstantLink } from "@/components/storefront/storefront-instant-link";
import { hostAwareSitePath } from "@/lib/domain-routing";
import type { CreativePack, PublicCustomer, Site, SiteAiApp, ThemeRuntimeAsset, ThemeRuntimeData } from "@/lib/types";

type CustomerWorkspaceSite = Pick<Site, "id" | "slug" | "name" | "branding" | "primaryDomain">;
export type CustomerWorkspacePanel = "overview" | "create" | "upload";
type WorkspaceRuntimeState =
  | { status: "loading"; runtime?: undefined; error?: undefined }
  | { status: "ready"; runtime: ThemeRuntimeData; error?: undefined }
  | { status: "error"; runtime?: undefined; error: string };

function useWorkspaceRuntime(siteId: string): WorkspaceRuntimeState {
  const [state, setState] = useState<WorkspaceRuntimeState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/sites/${siteId}/customer/runtime?profile=workspace`, {
      credentials: "same-origin",
      signal: controller.signal
    })
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as { ok?: boolean; runtime?: ThemeRuntimeData; error?: string };
        if (!response.ok || !data.ok || !data.runtime) throw new Error(data.error || "workspace_runtime_unavailable");
        setState({ status: "ready", runtime: data.runtime });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setState({ status: "error", error: error instanceof Error ? error.message : "workspace_runtime_unavailable" });
      });

    return () => controller.abort();
  }, [siteId]);

  return state;
}

function WorkspaceInlineLoading({ label }: { label: string }) {
  return (
    <div aria-busy="true" className="rounded-[18px] border border-white/10 bg-white/[0.04] p-4 text-sm text-white/64" role="status">
      <div className="h-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-1/3 animate-[admin-progress_1.05s_ease-in-out_infinite] rounded-full bg-[#31d4ff]" />
      </div>
      <p className="mt-3">{label}</p>
    </div>
  );
}

const workspaceSteps: Array<{ panel: CustomerWorkspacePanel; title: string; detail: string }> = [
  { panel: "create", title: "Select workflow", detail: "Choose a package or focused tool." },
  { panel: "upload", title: "Attach source photos", detail: "Add private reference images." },
  { panel: "overview", title: "Review request", detail: "Confirm credits and delivery." }
];

const navItems = [
  { id: "ai-photos", label: "AI Photos", status: "Open", icon: Camera, panel: "create" as const },
  { id: "photo-editor", label: "AI Photo Editor", status: "Open", icon: Sparkles, panel: "create" as const },
  { id: "albums", label: "AI Albums", status: "Ready", icon: ImageIcon, panel: "overview" as const },
  { id: "video", label: "AI Video", status: "Concept", icon: PlaySquare, panel: "create" as const },
  { id: "model-studio", label: "Model Studio", status: "Private", icon: Bot, panel: "upload" as const },
  { id: "explore", label: "Explore", status: "Live", icon: Search, panel: "overview" as const }
];

const aidreamcapesNavItems = [
  { id: "travel-portraits", label: "Travel Portraits", status: "Open", icon: Compass, panel: "create" as const },
  { id: "route-editor", label: "Route Photo Editor", status: "Open", icon: Sparkles, panel: "create" as const },
  { id: "route-albums", label: "Route Albums", status: "Ready", icon: ImageIcon, panel: "overview" as const },
  { id: "story-clips", label: "Story Clips", status: "Concept", icon: PlaySquare, panel: "create" as const },
  { id: "source-library", label: "Source Library", status: "Private", icon: UploadCloud, panel: "upload" as const },
  { id: "explore", label: "Explore", status: "Live", icon: Search, panel: "overview" as const }
];

export function CustomerWorkspaceShell({
  site,
  customer,
  assets,
  siteAiApps,
  creativePacks,
  initialCreativePackId,
  initialToolId,
  initialPanel = "overview"
}: {
  site: CustomerWorkspaceSite;
  customer: PublicCustomer;
  assets: ThemeRuntimeAsset[];
  siteAiApps: SiteAiApp[];
  creativePacks: CreativePack[];
  initialCreativePackId?: string;
  initialToolId?: string;
  initialPanel?: CustomerWorkspacePanel;
}) {
  const basePath = hostAwareSitePath(site, "/").replace(/\/$/, "");
  const prefetchPaths = useMemo(() => [`${basePath}/account`, `${basePath}/pricing`, `${basePath}/tools`], [basePath]);
  const runtimeState = useWorkspaceRuntime(site.id);
  const hydratedAssets = runtimeState.status === "ready" ? runtimeState.runtime.assets ?? [] : assets;
  const currentStepIndex = initialPanel === "upload" ? 1 : initialPanel === "overview" ? 2 : 0;
  const showCreate = initialPanel === "overview" || initialPanel === "create";
  const showUpload = initialPanel === "overview" || initialPanel === "upload";
  const isAidreamcapes = /aidreamcapes/i.test(`${site.slug} ${site.name} ${site.primaryDomain} ${site.branding.logoText}`);
  const activeNavItems = isAidreamcapes ? aidreamcapesNavItems : navItems;
  const activeTitle = isAidreamcapes ? "Build a private travel portrait set." : "Create your private AI photo set.";
  const brandLabel = isAidreamcapes ? "Aidreamcapes" : "MyDreamShoots";
  const activeSubtitle = isAidreamcapes
    ? "Select a route-ready package, attach source photos, then start a private travel portrait request from one workspace."
    : "Select a package or tool, attach source photos, then start a private generation request from one workspace.";
  const tabItems = isAidreamcapes
    ? ["All", "Routes", "Albums", "Saved", "Explore"]
    : ["All", "Images", "Albums", "Saved", "Explore"];

  return (
    <div className="min-h-screen bg-[#07090d] font-sans text-white">
      <CustomerRoutePrefetch paths={prefetchPaths} />
      <StorefrontNavigationFeedback />
      <CustomerShellHeader customer={customer} site={site} tone="dark" />

      <main className="grid min-h-[calc(100vh-97px)] border-t border-white/8 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="border-b border-white/10 bg-[#0b0c0f] px-4 py-5 lg:sticky lg:top-[98px] lg:h-[calc(100vh-98px)] lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <div className="rounded-[18px] border border-white/10 bg-[linear-gradient(145deg,rgba(123,72,255,0.18),rgba(49,212,255,0.06))] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/48">Private workspace</p>
            <p className="mt-2 text-lg font-semibold leading-tight">{brandLabel}</p>
            <p className="mt-2 text-xs leading-5 text-white/56">{customer.email}</p>
          </div>

          <nav className="mt-5 grid gap-1">
            {activeNavItems.map((item) => {
              const Icon = item.icon;
              const active = item.panel === initialPanel || (initialPanel === "overview" && item.panel === "overview");
              const href = item.panel === "upload" ? `${basePath}/app/upload` : item.panel === "overview" ? `${basePath}/app` : `${basePath}/app/create`;
              return (
                <StorefrontInstantLink
                  className={`group flex min-h-[58px] items-center gap-3 border-b border-white/8 px-2 py-3 text-left transition hover:bg-white/[0.04] ${active ? "text-white" : "text-white/54"}`}
                  href={href}
                  key={item.id}
                >
                  <Icon className={`h-5 w-5 shrink-0 ${active ? "text-[#ff5ebd]" : "text-white/42"}`} strokeWidth={1.9} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{item.label}</span>
                    <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${active ? "bg-[#21c06b] text-white" : "bg-white/[0.07] text-white/46"}`}>{item.status}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-white/36 transition group-hover:translate-x-0.5" strokeWidth={1.8} />
                </StorefrontInstantLink>
              );
            })}
          </nav>

          <div className="mt-6 rounded-[18px] border border-[#2f6fed]/35 bg-[#101329] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-[#73a7ff]" strokeWidth={1.8} />
              Workspace update
            </div>
            <p className="mt-3 text-xs leading-6 text-white/66">
              Source uploads, package selection, credit hold, and generated albums now use one request flow.
            </p>
          </div>
        </aside>

        <section className="min-w-0 bg-[#080a0f]">
          <div className="border-b border-white/10 px-5 py-5 xl:px-8">
            <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#ff9f43]">Customer studio</p>
                <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight tracking-[-0.02em] md:text-5xl">{activeTitle}</h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/62">{activeSubtitle}</p>
              </div>
              <StorefrontInstantLink className="inline-flex w-fit rounded-full border border-white/14 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white hover:bg-white/[0.08]" href={`${basePath}/account`}>
                Account center
              </StorefrontInstantLink>
            </div>

            <div className="mt-6 grid gap-3 xl:grid-cols-3">
              {workspaceSteps.map((step, index) => {
                const active = index === currentStepIndex;
                const complete = index < currentStepIndex;
                const href = index === 0 ? `${basePath}/app/create` : index === 1 ? `${basePath}/app/upload` : `${basePath}/app`;
                return (
                  <StorefrontInstantLink
                    className={`group grid min-h-[94px] gap-3 rounded-[18px] border p-4 transition ${
                      active
                        ? "border-[#31d4ff]/70 bg-[linear-gradient(135deg,rgba(255,94,189,0.24),rgba(49,212,255,0.14))] text-white shadow-[0_18px_50px_-36px_rgba(49,212,255,0.65)]"
                        : complete
                        ? "border-white/16 bg-white/[0.055] text-white"
                        : "border-white/10 bg-white/[0.025] text-white/58"
                    }`}
                    href={href}
                    key={step.title}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${active ? "text-[#31d4ff]" : "text-white/42"}`}>
                        Step {String(index + 1).padStart(2, "0")}
                      </span>
                      {complete ? <CheckCircle2 className="h-4 w-4 text-[#21c06b]" strokeWidth={1.8} /> : <span className={`h-2.5 w-2.5 rounded-full ${active ? "bg-[#31d4ff]" : "bg-white/20"}`} />}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{step.title}</span>
                      <span className={`mt-1 block text-xs leading-5 ${active ? "text-white/70" : "text-white/48"}`}>{step.detail}</span>
                    </span>
                  </StorefrontInstantLink>
                );
              })}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-5">
              {tabItems.map((tab, index) => (
                <StorefrontInstantLink
                  className={`inline-flex min-h-12 items-center justify-center rounded-[14px] border px-4 text-sm font-semibold transition ${
                    index === 0
                      ? "border-[#2f6fed] bg-[#2f6fed] text-white"
                      : "border-white/10 bg-[#151b28] text-white/50 hover:border-white/24 hover:text-white"
                  }`}
                  href={index === 2 ? `${basePath}/album` : index === 4 ? `${basePath}/collections` : `${basePath}/app`}
                  key={tab}
                >
                  {tab}
                </StorefrontInstantLink>
              ))}
            </div>
          </div>

          <div className="grid gap-5 px-5 py-5 xl:px-8">
            {showCreate ? (
              <section className="scroll-mt-28 overflow-hidden rounded-[22px] border border-white/10 bg-[#0c0f16] shadow-[0_28px_90px_-60px_rgba(0,0,0,0.92)]" id="create">
                <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-[linear-gradient(135deg,#ff5ebd,#2f6fed)]">
                      <LayoutGrid className="h-5 w-5" strokeWidth={1.8} />
                    </span>
                    <div>
                      <h2 className="text-base font-semibold">Generation workspace</h2>
                      <p className="mt-1 text-xs text-white/50">Packages, tools, source photos, and credit review in one flow.</p>
                    </div>
                  </div>
                  <span className="hidden rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/58 sm:inline-flex">
                    {customer.balance.available} credits
                  </span>
                </div>
                <div className="p-4 md:p-5">
                  <JobCreateForm
                    assets={hydratedAssets}
                    creativePacks={creativePacks.map((pack) => ({ ...pack, prompt: undefined }))}
                    customer={customer}
                    initialCreativePackId={initialCreativePackId}
                    initialToolId={initialToolId}
                    siteAiApps={siteAiApps}
                    siteId={site.id}
                    siteSlug={site.slug}
                    tone="dark"
                  />
                </div>
              </section>
            ) : null}

            {showUpload ? (
              <section className="scroll-mt-28 rounded-[22px] border border-white/10 bg-[#0c0f16] p-4 shadow-[0_24px_80px_-62px_rgba(0,0,0,0.92)] md:p-5" id="upload_1">
                {runtimeState.status === "loading" ? <WorkspaceInlineLoading label="Loading your private uploads in this panel." /> : null}
                {runtimeState.status === "error" ? (
                  <div className="rounded-[18px] border border-dashed border-white/12 bg-white/[0.035] p-4 text-sm text-white/64">
                    Workspace activity could not load. You can refresh the page or open your account center.
                  </div>
                ) : null}
                <div className={runtimeState.status === "loading" ? "mt-4" : undefined}>
                  <AssetsPanel assets={hydratedAssets} createHref={`${basePath}/app/create`} customer={customer} siteId={site.id} tone="dark" />
                </div>
              </section>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
