"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { AlertCircle, Bot, Camera, CheckCircle2, ChevronRight, Clock3, Compass, ImageIcon, LayoutGrid, PlaySquare, Search, Sparkles, UploadCloud, WalletCards, X } from "lucide-react";
import { AssetsPanel } from "@/components/app/assets-panel";
import { JobCreateForm } from "@/components/app/job-create-form";
import { CustomerShellHeader } from "@/components/storefront/customer-shell-header";
import { CustomerRoutePrefetch } from "@/components/storefront/customer-route-prefetch";
import { StorefrontNavigationFeedback } from "@/components/storefront/navigation-feedback";
import { CustomerAssetDownloadButton } from "@/components/storefront/customer-asset-download-button";
import { StorefrontInstantLink } from "@/components/storefront/storefront-instant-link";
import { hostAwareSitePath } from "@/lib/domain-routing";
import type { CreativePack, PublicCustomer, Site, SiteAiApp, ThemeRuntimeAsset, ThemeRuntimeData } from "@/lib/types";

type CustomerWorkspaceSite = Pick<Site, "id" | "slug" | "name" | "branding" | "primaryDomain">;
export type CustomerWorkspacePanel = "overview" | "create" | "upload";
type WorkspaceResourceTab = "all" | "videos" | "albums" | "saved" | "explore";
type WorkspaceAnchor = "step-upload" | "step-create" | "source-photos" | "review-request" | `resources-${WorkspaceResourceTab}`;
type WorkspaceCreateMode = "theme" | "tool";
type WorkspaceRuntimeState =
  | { status: "loading"; runtime?: undefined; error?: undefined }
  | { status: "ready"; runtime: ThemeRuntimeData; error?: undefined }
  | { status: "error"; runtime?: undefined; error: string };
const myDreamShootsDisplayName = "ʍʏƉʀɛǟʍֆhoots";

function workspaceJobStatusLabel(status: ThemeRuntimeData["jobs"][number]["status"]): string {
  if (status === "queued") return "Queued";
  if (status === "running") return "Creating";
  if (status === "succeeded") return "Ready";
  if (status === "failed") return "Failed";
  if (status === "refunded") return "Credits returned";
  return "Waiting";
}

function workspaceJobStatusClass(status: ThemeRuntimeData["jobs"][number]["status"]): string {
  if (status === "succeeded") return "border-[#22c55e]/30 bg-[#22c55e]/12 text-[#8df0b5]";
  if (status === "failed") return "border-[#fb7185]/30 bg-[#fb7185]/12 text-[#ff9eb0]";
  if (status === "running") return "border-[#31d4ff]/30 bg-[#31d4ff]/12 text-[#86eaff]";
  if (status === "refunded") return "border-[#f59e0b]/30 bg-[#f59e0b]/12 text-[#ffd18a]";
  return "border-white/12 bg-white/[0.05] text-white/66";
}

function workspaceJobTitle(job: ThemeRuntimeData["jobs"][number], index: number): string {
  const creativePack = job.requestJson?.creativePack;
  if (creativePack && typeof creativePack === "object" && !Array.isArray(creativePack)) {
    const name = (creativePack as Record<string, unknown>).name;
    if (typeof name === "string" && name.trim()) return name.trim();
  }
  const flow = job.requestJson?.flow;
  if (flow && typeof flow === "object" && !Array.isArray(flow)) {
    const flowName = (flow as Record<string, unknown>).flowName;
    if (typeof flowName === "string" && flowName.trim()) return flowName.trim();
  }
  const suffix = job.id.split("_").pop()?.slice(-6);
  return `Generation ${suffix ? suffix.toUpperCase() : String(index + 1).padStart(2, "0")}`;
}

function compactDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

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

const workspaceSteps: Array<{ panel: CustomerWorkspacePanel; anchor: WorkspaceAnchor; title: string; detail: string }> = [
  { panel: "create", anchor: "step-create", title: "Choose package", detail: "Pick a photo package or focused tool and review the credit cost before generation." },
  { panel: "create", anchor: "source-photos", title: "Upload selfies", detail: "Attach private source photos inside the same request before submitting." },
  { panel: "overview", anchor: "review-request", title: "Review results", detail: "Track generation status, private albums, downloads, favorites, and credit activity." }
];

const navItems = [
  { id: "ai-photos", label: "AI Photos", status: "Open", icon: Camera, panel: "create" as const, actions: ["Single portrait", "Couple set", "No-input prompt"] },
  { id: "photo-editor", label: "AI Photo Editor", status: "Open", icon: Sparkles, panel: "create" as const, actions: ["Prompt edit", "Retouch", "Background"] },
  { id: "albums", label: "AI Albums", status: "Ready", icon: ImageIcon, panel: "overview" as const, actions: ["Recent albums", "Delivery status", "Downloads"] },
  { id: "video", label: "AI Video", status: "Concept", icon: PlaySquare, panel: "create" as const, actions: ["Image to video", "Profile clip", "Motion prompt"] },
  { id: "model-studio", label: "Model Studio", status: "Private", icon: Bot, panel: "upload" as const, actions: ["Upload sources", "Training set", "Identity review"] },
  { id: "explore", label: "Explore", status: "Live", icon: Search, panel: "overview" as const, actions: ["Browse ideas", "Saved looks", "Package picks"] }
];

const aidreamcapesNavItems = [
  { id: "travel-portraits", label: "Travel Portraits", status: "Open", icon: Compass, panel: "create" as const, actions: ["Solo route", "Couple route", "No-input scene"] },
  { id: "route-editor", label: "Route Photo Editor", status: "Open", icon: Sparkles, panel: "create" as const, actions: ["Prompt edit", "Light match", "Backdrop"] },
  { id: "route-albums", label: "Route Albums", status: "Ready", icon: ImageIcon, panel: "overview" as const, actions: ["Recent albums", "Delivery status", "Downloads"] },
  { id: "story-clips", label: "Story Clips", status: "Concept", icon: PlaySquare, panel: "create" as const, actions: ["Image to video", "Story cover", "Motion prompt"] },
  { id: "source-library", label: "Source Library", status: "Private", icon: UploadCloud, panel: "upload" as const, actions: ["Upload sources", "Route references", "Identity review"] },
  { id: "explore", label: "Explore", status: "Live", icon: Search, panel: "overview" as const, actions: ["Browse routes", "Saved looks", "Package picks"] }
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
  const pathname = usePathname();
  const pathModeBasePath = pathname.match(/^\/site\/[^/]+/)?.[0];
  const basePath = pathModeBasePath ?? hostAwareSitePath(site, "/").replace(/\/$/, "");
  const prefetchPaths = useMemo(() => [`${basePath}/account`, `${basePath}/pricing`, `${basePath}/tools`], [basePath]);
  const runtimeState = useWorkspaceRuntime(site.id);
  const runtime = runtimeState.status === "ready" ? runtimeState.runtime : undefined;
  const hydratedAssets = runtime?.assets ?? assets;
  const recentJobs = runtime?.jobs ?? [];
  const recentAlbums = runtime?.albums ?? [];
  const customerModels = runtime?.customerModels ?? [];
  const recentLedger = runtime?.ledger ?? [];
  const isAidreamcapes = /aidreamcapes/i.test(`${site.slug} ${site.name} ${site.primaryDomain} ${site.branding.logoText}`);
  const activeNavItems = isAidreamcapes ? aidreamcapesNavItems : navItems;
  const initialNavId = initialPanel === "upload"
    ? isAidreamcapes ? "source-library" : "model-studio"
    : initialPanel === "overview"
      ? isAidreamcapes ? "route-albums" : "albums"
      : activeNavItems[0]?.id ?? "";
  const [activePanel, setActivePanel] = useState<CustomerWorkspacePanel>(initialPanel);
  const [activeNavId, setActiveNavId] = useState(initialNavId);
  const [activeOperationId, setActiveOperationId] = useState<string | null>(null);
  const [resourceTab, setResourceTab] = useState<WorkspaceResourceTab>("all");
  const [activeGuideStep, setActiveGuideStep] = useState(() => initialPanel === "overview" ? 2 : initialPanel === "upload" ? 1 : 0);
  const [preferredCreateMode, setPreferredCreateMode] = useState<WorkspaceCreateMode>("theme");
  const [preferredCreateModeRequest, setPreferredCreateModeRequest] = useState(0);
  const currentStepIndex = activePanel === "overview" ? 2 : activeGuideStep;
  const activeTitle = isAidreamcapes ? "Build a private travel portrait set." : "Create your private AI photo set.";
  const brandLabel = isAidreamcapes ? "Aidreamcapes" : myDreamShootsDisplayName;
  const activeSubtitle = isAidreamcapes
    ? "Choose a route-ready package, attach source photos, then generate and review a private travel portrait set in one workspace."
    : "Choose a photo package, upload selfies or source photos, then generate and review a private AI photo set in one workspace.";
  const tabItems: Array<{ id: WorkspaceResourceTab; label: string }> = useMemo(
    () =>
      isAidreamcapes
        ? [
            { id: "all", label: "All" },
            { id: "videos", label: "Routes" },
            { id: "albums", label: "Albums" },
            { id: "saved", label: "Saved" },
            { id: "explore", label: "Explore" }
          ]
        : [
            { id: "all", label: "All" },
            { id: "videos", label: "Videos" },
            { id: "albums", label: "Photo Album" },
            { id: "saved", label: "Favorites" },
            { id: "explore", label: "Explore" }
          ],
    [isAidreamcapes]
  );
  const galleryAssets = hydratedAssets.filter((asset) => asset.role === "output");
  const sourceAssets = hydratedAssets.filter((asset) => asset.role === "input");
  const readyJobs = recentJobs.filter((job) => job.status === "succeeded").length;
  const activeJobs = recentJobs.filter((job) => job.status === "queued" || job.status === "running").length;
  const failedJobs = recentJobs.filter((job) => job.status === "failed").length;
  const latestOutputsByJobId = new Map<string, ThemeRuntimeAsset>();
  for (const asset of galleryAssets) {
    if (asset.jobId && !latestOutputsByJobId.has(asset.jobId)) latestOutputsByJobId.set(asset.jobId, asset);
  }
  const resourceTitleByTab: Record<WorkspaceResourceTab, string> = {
    all: "Workspace resources",
    videos: isAidreamcapes ? "Route concepts" : "Video concepts",
    albums: isAidreamcapes ? "Travel albums" : "Photo albums",
    saved: "Saved selections",
    explore: "Explore ideas"
  };
  const showUploadStep = activePanel === "upload";
  const showCreateStep = activePanel === "create";
  const showReviewStep = activePanel === "overview";
  const isGuidedShootFlow = activePanel === "create" || activePanel === "upload";
  const heroPreviewPacks = creativePacks.filter((pack) => pack.status === "active" && pack.imageUrl).slice(0, 5);
  const guidedTitle = isAidreamcapes ? "Create a private travel portrait set." : "Create your dream photoshoot.";
  const guidedSubtitle = isAidreamcapes
    ? "Choose a route style, upload travel source photos, confirm credits, and review a private album from the same flow."
    : "Choose a photo package, upload selfies, confirm credits, and review your private AI album from the same flow.";
  const guidedBullets = isAidreamcapes
    ? ["Destination portrait packages", "Private source uploads", "Credit cost shown before generation", "Travel albums and downloads"]
    : ["Upload selfies from this account", "Browse themed photo packages", "Credit cost shown before generation", "Private albums and downloads"];
  const activeOperationItem = activeOperationId ? activeNavItems.find((item) => item.id === activeOperationId) : undefined;

  function scrollToWorkspaceAnchor(anchor: WorkspaceAnchor) {
    if (typeof window === "undefined") return;
    window.history.replaceState(null, "", `#${anchor}`);
    window.setTimeout(() => {
      document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function choosePanel(panel: CustomerWorkspacePanel, anchor: WorkspaceAnchor) {
    if (anchor === "step-create") setActiveGuideStep(0);
    if (anchor === "source-photos" || anchor === "step-upload") setActiveGuideStep(1);
    if (anchor === "review-request" || anchor.startsWith("resources-")) setActiveGuideStep(2);
    setActivePanel(panel);
    scrollToWorkspaceAnchor(anchor);
  }

  function chooseResourceTab(tab: WorkspaceResourceTab) {
    setActivePanel("overview");
    setResourceTab(tab);
    scrollToWorkspaceAnchor(`resources-${tab}`);
  }

  function navAnchorForItem(itemId: string): { panel: CustomerWorkspacePanel; anchor: WorkspaceAnchor; tab?: WorkspaceResourceTab } {
    if (itemId === "albums" || itemId === "route-albums") return { panel: "overview", anchor: "resources-albums", tab: "albums" };
    if (itemId === "video" || itemId === "story-clips") return { panel: "create", anchor: "step-create" };
    if (itemId === "explore") return { panel: "overview", anchor: "resources-explore", tab: "explore" };
    if (itemId === "model-studio" || itemId === "source-library") return { panel: "upload", anchor: "step-upload" };
    return { panel: "create", anchor: "step-create" };
  }

  function createModeForOperation(itemId: string): WorkspaceCreateMode {
    return itemId === "photo-editor" || itemId === "video" || itemId === "route-editor" || itemId === "story-clips" ? "tool" : "theme";
  }

  function mainWindowTargetForOperation(
    itemId: string,
    target = navAnchorForItem(itemId)
  ): { panel: CustomerWorkspacePanel; anchor: WorkspaceAnchor; tab?: WorkspaceResourceTab } {
    if (itemId === "model-studio" || itemId === "source-library") return { panel: "create", anchor: "source-photos" };
    return target;
  }

  function openOperationInMainWindow(itemId: string, target = navAnchorForItem(itemId)) {
    const destination = mainWindowTargetForOperation(itemId, target);
    setActiveOperationId(null);
    setPreferredCreateMode(createModeForOperation(itemId));
    setPreferredCreateModeRequest((current) => current + 1);
    if (destination.tab) setResourceTab(destination.tab);
    choosePanel(destination.panel, destination.anchor);
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const anchor = window.location.hash.replace("#", "") as WorkspaceAnchor | "";
    if (!anchor) return;
    if (anchor === "step-upload") {
      setActivePanel("upload");
      setActiveGuideStep(1);
    }
    if (anchor === "source-photos") {
      setActivePanel("create");
      setActiveGuideStep(1);
    }
    if (anchor === "step-create") {
      setActivePanel("create");
      setActiveGuideStep(0);
    }
    if (anchor === "review-request") {
      setActivePanel("overview");
      setActiveGuideStep(2);
    }
    if (anchor.startsWith("resources-")) {
      const tab = anchor.replace("resources-", "") as WorkspaceResourceTab;
      if (tabItems.some((item) => item.id === tab)) {
        setActivePanel("overview");
        setResourceTab(tab);
      }
    }
    window.setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ block: "start" }), 0);
  }, [tabItems]);

  return (
    <div className="min-h-screen bg-[#07090d] font-sans text-white">
      <CustomerRoutePrefetch paths={prefetchPaths} />
      <StorefrontNavigationFeedback />
      <CustomerShellHeader creativePacks={creativePacks} customer={customer} site={site} tone="dark" />

      <main className="grid min-h-[calc(100vh-97px)] border-t border-white/8 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="border-b border-white/10 bg-[#0b0c0f] px-4 py-5 lg:sticky lg:top-[98px] lg:h-[calc(100vh-98px)] lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <div className="rounded-[18px] border border-white/10 bg-[linear-gradient(145deg,rgba(123,72,255,0.18),rgba(49,212,255,0.06))] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/48">Private workspace</p>
            <p className="mt-2 text-lg font-semibold leading-tight">{brandLabel}</p>
            <p className="mt-2 text-xs leading-5 text-white/56">{customer.email}</p>
          </div>
          {isGuidedShootFlow ? (
            <div className="mt-4 rounded-[18px] border border-white/10 bg-white/[0.035] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/48">Operate</p>
              <p className="mt-2 text-sm leading-6 text-white/66">
                Select a left action to open its controls, then keep choosing packages and tools in the large panel.
              </p>
            </div>
          ) : null}

          <nav className="mt-5 grid gap-1">
            {activeNavItems.map((item) => {
              const Icon = item.icon;
              const active = activeNavId === item.id;
              const target = navAnchorForItem(item.id);
              return (
                <div className="border-b border-white/8 py-1" key={item.id}>
                  <button
                    aria-controls={target.anchor}
                    aria-current={active ? "page" : undefined}
                    className={`group flex min-h-[58px] w-full items-center gap-3 rounded-[14px] px-2 py-3 text-left transition hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#31d4ff] ${active ? "text-white" : "text-white/54"}`}
                    onClick={() => {
                      setActiveNavId(item.id);
                      if (target.tab) setResourceTab(target.tab);
                      if (isGuidedShootFlow) {
                        setActiveOperationId(item.id);
                        return;
                      }
                      choosePanel(target.panel, target.anchor);
                    }}
                    type="button"
                  >
                    <Icon className={`h-5 w-5 shrink-0 ${active ? "text-[#ff5ebd]" : "text-white/42"}`} strokeWidth={1.9} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{item.label}</span>
                      <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${active ? "bg-[#21c06b] text-white" : "bg-white/[0.07] text-white/46"}`}>{item.status}</span>
                    </span>
                    <ChevronRight className={`h-4 w-4 shrink-0 text-white/36 transition ${active ? "translate-x-0.5 text-[#31d4ff]" : ""}`} strokeWidth={1.8} />
                  </button>
                </div>
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
          {isGuidedShootFlow ? (
            <div className="relative overflow-hidden border-b border-white/10 px-5 py-8 xl:px-8">
              <div className="pointer-events-none absolute inset-0 opacity-70">
                <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_70%_20%,rgba(49,212,255,0.28),transparent_34%),radial-gradient(circle_at_42%_54%,rgba(255,94,189,0.22),transparent_42%)]" />
                <div className="absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,#ff9f43,#ff5ebd,#31d4ff)]" />
              </div>
              <div className="relative mx-auto grid max-w-[1500px] gap-7 xl:grid-cols-[minmax(0,1fr)_430px] xl:items-end">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/[0.05] px-4 py-2 text-xs font-semibold text-white/78">
                    <span className="h-2 w-2 rounded-full bg-[#31d4ff]" />
                    AI photo package studio
                  </div>
                  <h1 className="mt-6 max-w-4xl text-5xl font-semibold leading-[0.98] tracking-[-0.03em] text-white md:text-6xl">
                    {guidedTitle}
                  </h1>
                  <p className="mt-5 max-w-2xl text-base leading-8 text-white/70">{guidedSubtitle}</p>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {guidedBullets.map((item) => (
                      <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/76" key={item}>
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-[#31d4ff]" strokeWidth={1.8} />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-[22px] border border-[#31d4ff]/50 bg-[linear-gradient(135deg,rgba(255,94,189,0.2),rgba(49,212,255,0.12)),#10131b] p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#ff9f43]">Signed in</p>
                      <p className="mt-2 text-lg font-semibold text-white">{customer.name || customer.email}</p>
                      <p className="mt-1 text-xs text-white/56">{customer.email}</p>
                    </div>
                    <span className="rounded-full border border-white/12 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white">
                      {customer.balance.available} credits
                    </span>
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-2">
                    {heroPreviewPacks.length ? heroPreviewPacks.slice(0, 3).map((pack) => (
                      <button
                        className="group overflow-hidden rounded-[14px] border border-white/10 bg-black/20 text-left"
                        key={pack.id}
                        onClick={() => choosePanel("create", "step-create")}
                        type="button"
                      >
                        <img alt={pack.name} className="aspect-[4/5] w-full object-cover transition duration-200 group-hover:scale-[1.04]" src={pack.imageUrl ?? ""} />
                      </button>
                    )) : (
                      [0, 1, 2].map((item) => <div className="aspect-[4/5] rounded-[14px] border border-white/10 bg-white/[0.06]" key={item} />)
                    )}
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <button
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-[#101114] transition hover:-translate-y-0.5"
                      onClick={() => choosePanel("create", "step-create")}
                      type="button"
                    >
                      Browse packages
                      <ChevronRight className="h-4 w-4" strokeWidth={1.9} />
                    </button>
                    <button
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-white/18 bg-white/[0.06] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
                      onClick={() => choosePanel("create", "source-photos")}
                      type="button"
                    >
                      Upload selfies
                      <UploadCloud className="h-4 w-4" strokeWidth={1.9} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className={`${isGuidedShootFlow ? "mx-auto max-w-[1500px] border-b border-white/10 px-5 py-5 xl:px-8" : "border-b border-white/10 px-5 py-5 xl:px-8"}`}>
            {!isGuidedShootFlow ? (
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
            ) : null}

            <div className={`${isGuidedShootFlow ? "grid gap-2 md:grid-cols-3" : "mt-6 grid gap-3 xl:grid-cols-3"}`}>
              {workspaceSteps.map((step, index) => {
                const active = index === currentStepIndex;
                const complete = index < currentStepIndex;
                return (
                  <button
                    className={`group grid ${isGuidedShootFlow ? "min-h-[78px] gap-2 rounded-[16px] px-4 py-3" : "min-h-[94px] gap-3 rounded-[18px] p-4"} border text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#31d4ff] ${
                      active
                        ? "border-[#31d4ff]/70 bg-[linear-gradient(135deg,rgba(255,94,189,0.24),rgba(49,212,255,0.14))] text-white shadow-[0_18px_50px_-36px_rgba(49,212,255,0.65)]"
                        : complete
                        ? "border-white/16 bg-white/[0.055] text-white"
                      : "border-white/10 bg-white/[0.025] text-white/58"
                    }`}
                    key={step.title}
                    onClick={() => choosePanel(step.panel, step.anchor)}
                    type="button"
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${active ? "text-[#31d4ff]" : "text-white/42"}`}>
                        Step {String(index + 1).padStart(2, "0")}
                      </span>
                      {complete ? <CheckCircle2 className="h-4 w-4 text-[#21c06b]" strokeWidth={1.8} /> : <span className={`h-2.5 w-2.5 rounded-full ${active ? "bg-[#31d4ff]" : "bg-white/20"}`} />}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{step.title}</span>
                      <span className={`mt-1 block text-xs leading-5 ${active ? "text-white/70" : "text-white/48"} ${isGuidedShootFlow ? "line-clamp-2" : ""}`}>{step.detail}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {!isGuidedShootFlow ? (
            <div className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-5">
              {tabItems.map((tab) => (
                <button
                  className={`inline-flex min-h-12 items-center justify-center rounded-[14px] border px-4 text-sm font-semibold transition ${
                    resourceTab === tab.id
                      ? "border-[#2f6fed] bg-[#2f6fed] text-white"
                      : "border-white/10 bg-[#151b28] text-white/50 hover:border-white/24 hover:text-white"
                  }`}
                  key={tab.id}
                  onClick={() => chooseResourceTab(tab.id)}
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </div>
            ) : null}
          </div>

          <div className={`${isGuidedShootFlow ? "mx-auto grid max-w-[1500px] gap-5 px-5 py-5 xl:px-8" : "grid gap-5 px-5 py-5 xl:px-8"}`}>
            <div className="grid gap-5">
              {showUploadStep ? (
              <section className="scroll-mt-28 rounded-[22px] border border-white/10 bg-[#0c0f16] p-4 shadow-[0_24px_80px_-62px_rgba(0,0,0,0.92)] md:p-5" id="step-upload">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#31d4ff]">Step 01</p>
                    <h2 className="mt-2 text-xl font-semibold">Attach source photos</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-white/58">
                      Upload private selfies or reference images for the selected AI request. These files stay in your signed-in workspace.
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/58">
                    {sourceAssets.length} sources
                  </span>
                </div>
                {runtimeState.status === "loading" ? <WorkspaceInlineLoading label="Loading your private uploads in this panel." /> : null}
                {runtimeState.status === "error" ? (
                  <div className="rounded-[18px] border border-dashed border-white/12 bg-white/[0.035] p-4 text-sm text-white/64">
                    Workspace activity could not load. You can refresh the page or open your account center.
                  </div>
                ) : null}
                <div className={runtimeState.status === "loading" ? "mt-4" : undefined}>
                  <AssetsPanel assets={hydratedAssets} customer={customer} onContinueToCreate={() => choosePanel("create", "step-create")} preferProvidedAssets siteId={site.id} tone="dark" />
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-white/[0.035] p-4">
                  <p className="text-sm leading-6 text-white/58">
                    {sourceAssets.length ? "Your source photos are ready. Continue to choose a package or tool." : "Upload at least one source photo before starting a generation request."}
                  </p>
                  <button
                    className="rounded-full border border-white/12 bg-white px-5 py-2.5 text-sm font-semibold text-[#101114] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
                    disabled={!sourceAssets.length}
                    onClick={() => choosePanel("create", "step-create")}
                    type="button"
                  >
                    Choose package or tool
                  </button>
                </div>
              </section>
              ) : null}

              {showCreateStep ? (
              <section className="scroll-mt-28 overflow-hidden rounded-[22px] border border-white/10 bg-[#0c0f16] shadow-[0_28px_90px_-60px_rgba(0,0,0,0.92)]" id="step-create">
                <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-[linear-gradient(135deg,#ff5ebd,#2f6fed)]">
                      <LayoutGrid className="h-5 w-5" strokeWidth={1.8} />
                    </span>
                    <div>
                      <h2 className="text-base font-semibold">Start your AI photoshoot</h2>
                      <p className="mt-1 text-xs text-white/50">Choose a package, upload or select selfies, review credits, then start your private request.</p>
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
                    onOpenUploadManager={() => choosePanel("upload", "step-upload")}
                    preferProvidedAssets
                    tone="dark"
                  />
                </div>
              </section>
              ) : null}

              {showReviewStep ? (
            <section className="relative grid scroll-mt-28 content-start gap-4 rounded-[22px] border border-white/10 bg-[#0c0f16] p-4" id="review-request">
              {tabItems.map((tab) => (
                <span aria-hidden="true" className="absolute -top-28" id={`resources-${tab.id}`} key={`anchor_${tab.id}`} />
              ))}
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/44">Step 03 · Review request</p>
                <h2 className="mt-2 text-xl font-semibold">Review credits, resources, and delivery</h2>
                <p className="mt-2 text-sm leading-6 text-white/58">
                  Confirm the selected workflow, attached source photos, available credits, and generated resources before you continue.
                </p>
              </div>
              <div className="rounded-[16px] border border-white/10 bg-white/[0.035] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/44">Resource panel</p>
                <h3 className="mt-2 text-base font-semibold">{resourceTitleByTab[resourceTab]}</h3>
                <p className="mt-2 text-sm leading-6 text-white/58">
                  {resourceTab === "all"
                    ? "Review private uploads, recent outputs, and account-ready assets without leaving the workspace."
                    : resourceTab === "albums"
                      ? "Album deliveries appear here after generation jobs finish."
                      : resourceTab === "saved"
                        ? "Saved package choices and favorite looks stay attached to this account."
                        : resourceTab === "explore"
                          ? "Use this area to compare ideas before starting a request."
                          : "Motion concepts and video-ready references will collect here."}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Sources", value: sourceAssets.length },
                  { label: "Ready", value: readyJobs },
                  { label: "Credits", value: customer.balance.available }
                ].map((item) => (
                  <div className="rounded-[14px] border border-white/10 bg-white/[0.04] p-3" key={item.label}>
                    <p className="text-2xl font-semibold">{item.value}</p>
                    <p className="mt-1 text-[11px] font-semibold text-white/44">{item.label}</p>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 rounded-[16px] border border-white/10 bg-white/[0.035] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Recent generations</p>
                    <p className="mt-1 text-xs text-white/44">{activeJobs} active, {failedJobs} need attention</p>
                  </div>
                  <StorefrontInstantLink className="inline-flex shrink-0 rounded-full border border-white/12 px-3 py-1.5 text-xs font-semibold text-white/66 hover:bg-white/[0.07] hover:text-white" href={`${basePath}/app/jobs/progress`}>
                    View all
                  </StorefrontInstantLink>
                </div>
                {runtimeState.status === "loading" ? <WorkspaceInlineLoading label="Loading generation history." /> : null}
                {recentJobs.length ? recentJobs.slice(0, 4).map((job, index) => {
                  const output = latestOutputsByJobId.get(job.id);
                  return (
                    <StorefrontInstantLink
                      className="grid grid-cols-[46px_1fr] gap-3 rounded-[14px] border border-white/10 bg-[#0a0d14] p-2 transition hover:border-white/20 hover:bg-white/[0.05]"
                      href={`${basePath}/app/jobs/${job.id}`}
                      key={job.id}
                    >
                      <div className="grid aspect-square place-items-center overflow-hidden rounded-[11px] border border-white/10 bg-white/[0.04]">
                        {output ? (
                          <img alt={output.label} className="h-full w-full object-cover" src={output.previewUrl} />
                        ) : job.status === "failed" ? (
                          <AlertCircle className="h-4 w-4 text-[#ff9eb0]" strokeWidth={1.8} />
                        ) : (
                          <Clock3 className="h-4 w-4 text-white/50" strokeWidth={1.8} />
                        )}
                      </div>
                      <div className="min-w-0 self-center">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate text-sm font-semibold">{workspaceJobTitle(job, index)}</p>
                          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${workspaceJobStatusClass(job.status)}`}>
                            {workspaceJobStatusLabel(job.status)}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-white/44">{job.creditsReserved} credits · {compactDateTime(job.updatedAt || job.createdAt)}</p>
                      </div>
                    </StorefrontInstantLink>
                  );
                }) : runtimeState.status !== "loading" ? (
                  <div className="rounded-[14px] border border-dashed border-white/14 bg-white/[0.03] p-3 text-sm leading-6 text-white/58">
                    Start a package and every generation will appear here with progress and results.
                  </div>
                ) : null}
              </div>
              <div className="grid gap-3">
                {[...galleryAssets, ...sourceAssets].slice(0, 4).map((asset) => (
                  <div className="grid grid-cols-[56px_1fr] gap-3 rounded-[16px] border border-white/10 bg-white/[0.035] p-2" key={asset.id}>
                    <img alt={asset.label} className="aspect-square rounded-[12px] object-cover" src={asset.previewUrl} />
                    <div className="min-w-0 self-center">
                      <p className="truncate text-sm font-semibold">{asset.label}</p>
                      <p className="mt-1 text-xs text-white/44">{asset.role === "input" ? "Source photo" : "Generated output"}</p>
                    </div>
                    {asset.role === "output" ? (
                      <CustomerAssetDownloadButton
                        assetId={asset.id}
                        className="col-span-2 inline-flex items-center justify-center gap-2 rounded-[12px] border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/[0.1] disabled:cursor-wait disabled:opacity-60"
                        customerId={customer.id}
                        label="Download"
                        siteId={site.id}
                      />
                    ) : null}
                  </div>
                ))}
                {!hydratedAssets.length ? (
                  <div className="rounded-[16px] border border-dashed border-white/14 bg-white/[0.03] p-4 text-sm leading-6 text-white/58">
                    Upload source photos or start a package to populate this resource panel.
                  </div>
                ) : null}
              </div>
              <div className="grid gap-2 rounded-[16px] border border-white/10 bg-white/[0.035] p-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Bot className="h-4 w-4 text-[#31d4ff]" strokeWidth={1.8} />
                  Models and albums
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-[13px] border border-white/10 bg-[#0a0d14] p-3">
                    <p className="text-xl font-semibold">{customerModels.length}</p>
                    <p className="mt-1 text-xs text-white/44">Private models</p>
                  </div>
                  <div className="rounded-[13px] border border-white/10 bg-[#0a0d14] p-3">
                    <p className="text-xl font-semibold">{recentAlbums.length}</p>
                    <p className="mt-1 text-xs text-white/44">Albums</p>
                  </div>
                </div>
                {customerModels.slice(0, 2).map((model) => (
                  <div className="flex items-center justify-between gap-3 rounded-[13px] border border-white/10 bg-[#0a0d14] px-3 py-2" key={model.id}>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold">{model.label}</span>
                      <span className="mt-0.5 block text-[11px] text-white/42">{model.inputAssetCount}/{model.minInputAssets} source photos</span>
                    </span>
                    <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-semibold text-white/56">{model.status}</span>
                  </div>
                ))}
              </div>
              <div className="grid gap-2 rounded-[16px] border border-white/10 bg-white/[0.035] p-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <WalletCards className="h-4 w-4 text-[#ff9f43]" strokeWidth={1.8} />
                  Credit activity
                </div>
                {recentLedger.slice(0, 3).map((entry) => (
                  <div className="flex items-center justify-between gap-3 rounded-[13px] border border-white/10 bg-[#0a0d14] px-3 py-2 text-xs" key={entry.id}>
                    <span className="capitalize text-white/66">{entry.type.replace(/_/g, " ")}</span>
                    <span className={entry.amount >= 0 ? "font-semibold text-[#8df0b5]" : "font-semibold text-white/78"}>
                      {entry.amount > 0 ? "+" : ""}{entry.amount}
                    </span>
                  </div>
                ))}
                {!recentLedger.length ? (
                  <p className="rounded-[13px] border border-dashed border-white/14 bg-white/[0.03] p-3 text-xs leading-5 text-white/54">
                    Credit holds and completed generation charges will appear here.
                  </p>
                ) : null}
              </div>
            </section>
              ) : null}
            </div>
          </div>
        </section>
      </main>
      {activeOperationItem ? (() => {
        const Icon = activeOperationItem.icon;
        const target = navAnchorForItem(activeOperationItem.id);
        const mainTarget = mainWindowTargetForOperation(activeOperationItem.id, target);
        const operationMode = createModeForOperation(activeOperationItem.id);
        const isAlbumOperation = mainTarget.panel === "overview";
        const isUploadOperation = mainTarget.anchor === "step-upload" || mainTarget.anchor === "source-photos";
        return (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/66 px-4 py-6 backdrop-blur-sm" data-workspace-operation-dialog="true" role="dialog" aria-modal="true" aria-labelledby="workspace-operation-title">
            <div className="w-full max-w-xl overflow-hidden rounded-[22px] border border-white/14 bg-[#10131b] text-white shadow-[0_34px_90px_-45px_rgba(0,0,0,0.95)]">
              <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-[14px] border border-white/10 bg-white/[0.06]">
                    <Icon className="h-5 w-5 text-[#31d4ff]" strokeWidth={1.8} />
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#ff9f43]">Workspace action</p>
                    <h2 className="mt-2 text-xl font-semibold" id="workspace-operation-title">{activeOperationItem.label}</h2>
                    <p className="mt-2 text-sm leading-6 text-white/60">
                      Use this action panel for quick edits, then keep the main window focused on package, tool, image, and result selection.
                    </p>
                  </div>
                </div>
                <button
                  aria-label="Close action panel"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-white/70 transition hover:bg-white/[0.1] hover:text-white"
                  onClick={() => setActiveOperationId(null)}
                  type="button"
                >
                  <X className="h-4 w-4" strokeWidth={1.9} />
                </button>
              </div>
              <div className="grid gap-4 p-5">
                <div className="grid gap-2 sm:grid-cols-3">
                  {activeOperationItem.actions.map((action) => (
                    <button
                      className="rounded-[14px] border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-[#31d4ff]/50 hover:bg-white/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#31d4ff]"
                      key={action}
                      onClick={() => openOperationInMainWindow(activeOperationItem.id, target)}
                      type="button"
                    >
                      <p className="text-sm font-semibold">{action}</p>
                      <p className="mt-1 text-xs leading-5 text-white/46">Open this action in the main window.</p>
                    </button>
                  ))}
                </div>
                <div className="rounded-[16px] border border-white/10 bg-white/[0.035] p-4">
                  <p className="text-sm font-semibold">Next step</p>
                  <p className="mt-2 text-sm leading-6 text-white/60">
                    {isAlbumOperation
                      ? "Open the review area to check finished albums, downloads, favorites, and credit activity."
                      : isUploadOperation
                        ? "Open the selfie upload controls inside the same request flow."
                        : operationMode === "tool"
                          ? "Open the large tool image window, choose a focused AI tool, then continue with source photos and review."
                          : "Open the large package image window, choose a themed photo package, then continue with source photos and review."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#101114] transition hover:-translate-y-0.5"
                    onClick={() => openOperationInMainWindow(activeOperationItem.id, target)}
                    type="button"
                  >
                    {isAlbumOperation ? "View results" : isUploadOperation ? "Upload selfies" : operationMode === "tool" ? "Open tool window" : "Open package window"}
                    <ChevronRight className="h-4 w-4" strokeWidth={1.9} />
                  </button>
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-white/14 bg-white/[0.06] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
                    onClick={() => {
                      setActiveOperationId(null);
                      setPreferredCreateMode("theme");
                      setPreferredCreateModeRequest((current) => current + 1);
                      choosePanel("create", "step-create");
                    }}
                    type="button"
                  >
                    Browse themes and tools
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })() : null}
    </div>
  );
}
