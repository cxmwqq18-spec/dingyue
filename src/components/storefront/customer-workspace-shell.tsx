"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { AssetsPanel } from "@/components/app/assets-panel";
import { JobCreateForm } from "@/components/app/job-create-form";
import { CustomerShellHeader } from "@/components/storefront/customer-shell-header";
import { CustomerRoutePrefetch } from "@/components/storefront/customer-route-prefetch";
import { StorefrontNavigationFeedback } from "@/components/storefront/navigation-feedback";
import { StorefrontInstantLink } from "@/components/storefront/storefront-instant-link";
import type { CreativePack, PublicCustomer, Site, SiteAiApp, ThemeRuntimeAsset, ThemeRuntimeData } from "@/lib/types";

type CustomerWorkspaceSite = Pick<Site, "id" | "slug" | "name" | "branding">;
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
    <div aria-busy="true" className="rounded-[18px] border border-[#eadfce] bg-[#fffaf3] p-4 text-sm text-[#625d56]" role="status">
      <div className="h-1 overflow-hidden rounded-full bg-[#eadfce]">
        <div className="h-full w-1/3 animate-[admin-progress_1.05s_ease-in-out_infinite] rounded-full bg-[#171514]" />
      </div>
      <p className="mt-3">{label}</p>
    </div>
  );
}

const workspaceSteps: Array<{ panel: CustomerWorkspacePanel; title: string; detail: string }> = [
  { panel: "create", title: "Choose package or tool", detail: "Pick the output direction first." },
  { panel: "upload", title: "Upload source photos", detail: "Add the images the workflow needs." },
  { panel: "overview", title: "Review and start", detail: "Confirm options and submit." }
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
  const basePath = `/site/${site.slug}`;
  const prefetchPaths = useMemo(() => [`${basePath}/account`, `${basePath}/pricing`, `${basePath}/tools`], [basePath]);
  const runtimeState = useWorkspaceRuntime(site.id);
  const hydratedAssets = runtimeState.status === "ready" ? runtimeState.runtime.assets ?? [] : assets;
  const currentStepIndex = initialPanel === "upload" ? 1 : initialPanel === "overview" ? 2 : 0;
  const showCreate = initialPanel === "overview" || initialPanel === "create";
  const showUpload = initialPanel === "overview" || initialPanel === "upload";

  return (
    <div className="min-h-screen bg-[#f6f1e8] text-[#171514]">
      <CustomerRoutePrefetch paths={prefetchPaths} />
      <StorefrontNavigationFeedback />
      <CustomerShellHeader customer={customer} site={site} />

      <main className="mx-auto grid max-w-6xl gap-5 px-5 py-7">
        <section className="rounded-[20px] border border-[#eadfce] bg-[#fffaf3] p-5 shadow-[0_14px_36px_-30px_rgba(20,22,26,0.45)] md:p-6">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9b6b42]">Private workspace</p>
              <h1 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight tracking-[-0.02em] md:text-4xl">Create a private photo request.</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[#625d56]">
                Follow the steps in order: choose the package or tool, upload source photos, then review and start the request.
              </p>
            </div>
            <StorefrontInstantLink className="inline-flex w-fit rounded-full border border-[#dfd3c4] bg-white px-4 py-2 text-xs font-semibold text-[#171514]" href={`${basePath}/account`}>
              Account center
            </StorefrontInstantLink>
          </div>
          <div className="mt-6 grid gap-3 lg:grid-cols-3">
            {workspaceSteps.map((step, index) => {
              const active = index === currentStepIndex;
              const complete = index < currentStepIndex;
              const href = index === 0 ? `${basePath}/app/create` : index === 1 ? `${basePath}/app/upload` : `${basePath}/app`;
              return (
                <StorefrontInstantLink
                  className={`group grid min-h-[96px] gap-3 rounded-[18px] border p-4 transition ${
                    active
                      ? "border-[#171514] bg-[#171514] text-white shadow-[0_18px_50px_-36px_rgba(20,22,26,0.65)]"
                      : complete
                      ? "border-[#d8cab9] bg-white text-[#171514]"
                      : "border-[#eadfce] bg-[#fffaf3] text-[#706961]"
                  }`}
                  href={href}
                  key={step.title}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${active ? "text-white/62" : "text-[#9b6b42]"}`}>
                      Step {String(index + 1).padStart(2, "0")}
                    </span>
                    {complete ? <CheckCircle2 className="h-4 w-4 text-[#4a9f68]" strokeWidth={1.8} /> : <span className={`h-2.5 w-2.5 rounded-full ${active ? "bg-white" : "bg-[#d8cab9]"}`} />}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{step.title}</span>
                    <span className={`mt-1 block text-xs leading-5 ${active ? "text-white/62" : "text-[#706961]"}`}>{step.detail}</span>
                  </span>
                </StorefrontInstantLink>
              );
            })}
          </div>
        </section>

        {showCreate ? (
          <section className="scroll-mt-28 rounded-[20px] border border-[#eadfce] bg-[#101114] p-5 text-white shadow-[0_18px_54px_-42px_rgba(20,22,26,0.6)] md:p-6" id="create">
            <JobCreateForm
              assets={hydratedAssets}
              creativePacks={creativePacks.map((pack) => ({ ...pack, prompt: undefined }))}
              customer={customer}
              initialCreativePackId={initialCreativePackId}
              initialToolId={initialToolId}
              siteAiApps={siteAiApps}
              siteId={site.id}
              siteSlug={site.slug}
            />
          </section>
        ) : null}

        {showUpload ? (
          <section className="scroll-mt-28 rounded-[20px] border border-[#eadfce] bg-white p-5 shadow-[0_14px_36px_-30px_rgba(20,22,26,0.45)] md:p-6" id="upload_1">
            {runtimeState.status === "loading" ? <WorkspaceInlineLoading label="Loading your private uploads in this panel." /> : null}
            {runtimeState.status === "error" ? (
              <div className="rounded-[18px] border border-dashed border-[#d8cab9] bg-[#fffaf3] p-4 text-sm text-[#706961]">
                Workspace activity could not load. You can refresh the page or open your account center.
              </div>
            ) : null}
            <div className={runtimeState.status === "loading" ? "mt-4" : undefined}>
              <AssetsPanel assets={hydratedAssets} createHref={`${basePath}/app/create`} customer={customer} siteId={site.id} />
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
