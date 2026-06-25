"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Play, Sparkles, UploadCloud } from "lucide-react";
import type { AiWorkflowConfig, AiWorkflowField, AiWorkflowStep, CreativePack, PublicCustomer, SiteAiApp, ThemeRuntimeAsset } from "@/lib/types";
import { customerJsonHeaders } from "@/lib/client-csrf";
import { invalidateCustomerAssets, loadCustomerAssets } from "@/components/app/customer-assets-client-cache";

function fieldValueDefault(field: AiWorkflowField): string | number | boolean {
  if ("default" in field && field.default !== undefined) return field.default;
  if ((field.type === "select" || field.type === "radio") && field.options[0]) return field.options[0].value;
  if (field.type === "number") return field.min ?? 0;
  if (field.type === "boolean") return false;
  return "";
}

function fieldsFromParameterSchema(app: SiteAiApp): AiWorkflowField[] {
  return app.aiApp.parameterSchema.map((field) => (
    field.type === "select"
      ? {
          id: field.id,
          label: field.label,
          type: "select",
          required: true,
          options: (field.options ?? []).map((option) => ({ label: option, value: option })),
          default: field.options?.[0] ?? ""
        }
      : {
          id: field.id,
          label: field.label,
          type: "text",
          required: true,
          placeholder: field.label,
          default: ""
        }
  ));
}

function defaultWorkflow(app: SiteAiApp): AiWorkflowConfig {
  return {
    version: 1,
    flowName: app.aiApp.name,
    description: app.aiApp.description,
    submitLabel: "Start generation",
    materialRules: [
      "Use clear source photos where the face or product is visible.",
      "Attach 1-4 private uploads before starting the request.",
      "Only files in this signed-in customer account are available here."
    ],
    steps: [
      {
        id: "source_photos",
        title: "Select source photos",
        description: "Choose private uploads for this request.",
        kind: "asset_select",
        assetRules: { min: 1, max: 4, roles: ["input"], accept: ["image/*"], required: true }
      },
      {
        id: "generation_options",
        title: "Set generation options",
        description: "Choose the direction for the generated album.",
        kind: "fields",
        fields: fieldsFromParameterSchema(app)
      },
      {
        id: "review_request",
        title: "Review request",
        description: "Confirm credits, delivery and selected source photos.",
        kind: "review"
      }
    ]
  };
}

function workflowFor(app?: SiteAiApp): AiWorkflowConfig | undefined {
  if (!app) return undefined;
  const config = app.workflowConfig ?? defaultWorkflow(app);
  const hasAsset = config.steps.some((step) => step.kind === "asset_select");
  const hasFields = config.steps.some((step) => step.kind === "fields");
  return {
    ...config,
    steps: [
      ...(hasAsset ? [] : defaultWorkflow(app).steps.filter((step) => step.kind === "asset_select")),
      ...config.steps,
      ...(hasFields ? [] : [defaultWorkflow(app).steps.find((step) => step.kind === "fields") as AiWorkflowStep])
    ]
  };
}

function workflowFields(workflow?: AiWorkflowConfig): AiWorkflowField[] {
  return workflow?.steps.flatMap((step) => step.kind === "fields" ? step.fields ?? [] : []) ?? [];
}

function assetRules(workflow?: AiWorkflowConfig) {
  return workflow?.steps.find((step) => step.kind === "asset_select")?.assetRules ?? { min: 1, max: 4, roles: ["input"] };
}

function valuesFor(app?: SiteAiApp): Record<string, string | number | boolean> {
  return Object.fromEntries(workflowFields(workflowFor(app)).map((field) => [field.id, fieldValueDefault(field)]));
}

function assetsForRules(assets: ThemeRuntimeAsset[], workflow?: AiWorkflowConfig): ThemeRuntimeAsset[] {
  const roles = assetRules(workflow).roles ?? ["input"];
  return assets.filter((asset) => roles.includes(asset.role));
}

function initialSelectedAssets(assets: ThemeRuntimeAsset[], workflow?: AiWorkflowConfig): string[] {
  const maxAssets = assetRules(workflow).max ?? 4;
  return assetsForRules(assets, workflow).slice(0, maxAssets).map((asset) => asset.id);
}

function packsForApp(packs: CreativePack[], aiAppSlug: string): CreativePack[] {
  return packs.filter((pack) => pack.status === "active" && pack.aiAppSlug === aiAppSlug);
}

export function JobCreateForm({
  siteId,
  siteSlug,
  customer,
  siteAiApps,
  creativePacks = [],
  initialCreativePackId,
  initialToolId,
  assets = [],
  emptyTitle = "No enabled album experience.",
  emptyBody = "Enable an album experience for this site before publishing this form."
}: {
  siteId: string;
  siteSlug: string;
  customer: PublicCustomer;
  siteAiApps: SiteAiApp[];
  creativePacks?: CreativePack[];
  initialCreativePackId?: string;
  initialToolId?: string;
  assets?: ThemeRuntimeAsset[];
  emptyTitle?: string;
  emptyBody?: string;
}) {
  const router = useRouter();
  const normalizedInitialToolId = (initialToolId ?? "").replace(/-/g, "_");
  const initialPack =
    creativePacks.find((pack) => pack.status === "active" && pack.id === initialCreativePackId) ??
    creativePacks.find((pack) => pack.status === "active" && (pack.aiAppSlug === normalizedInitialToolId || pack.id === initialToolId));
  const initialApp =
    (initialToolId ? siteAiApps.find((app) => app.aiApp.slug === normalizedInitialToolId || app.aiApp.slug === initialToolId) : undefined) ??
    (initialPack ? siteAiApps.find((app) => app.aiApp.slug === initialPack.aiAppSlug) ?? siteAiApps[0] : siteAiApps[0]);
  const [aiAppSlug, setAiAppSlug] = useState(initialApp?.aiApp.slug ?? "");
  const [creativePackId, setCreativePackId] = useState(() => initialPack?.id ?? packsForApp(creativePacks, initialApp?.aiApp.slug ?? "")[0]?.id ?? "");
  const [formValues, setFormValues] = useState<Record<string, string | number | boolean>>(() => valuesFor(initialApp));
  const [availableAssets, setAvailableAssets] = useState(assets);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>(() => initialSelectedAssets(assets, workflowFor(initialApp)));
  const [message, setMessage] = useState("Choose a theme, confirm material rules, then start a private request.");
  const [pending, setPending] = useState(false);
  const selectedApp = siteAiApps.find((app) => app.aiApp.slug === aiAppSlug) ?? siteAiApps[0];
  const appPacks = packsForApp(creativePacks, selectedApp?.aiApp.slug ?? "");
  const selectedPack = appPacks.find((pack) => pack.id === creativePackId) ?? appPacks[0];
  const selectedWorkflow = workflowFor(selectedApp);
  const sourceAssets = assetsForRules(availableAssets, selectedWorkflow);
  const selectedFields = workflowFields(selectedWorkflow);
  const selectedAssetRules = assetRules(selectedWorkflow);
  const minAssets = selectedAssetRules.min ?? 1;
  const maxAssets = selectedAssetRules.max ?? 4;
  const materialRules = selectedWorkflow?.materialRules?.length ? selectedWorkflow.materialRules : selectedApp ? defaultWorkflow(selectedApp).materialRules ?? [] : [];

  useEffect(() => {
    setAvailableAssets(assets);
  }, [assets]);

  useEffect(() => {
    let cancelled = false;
    const loadAssets = (refresh = false) => {
      if (refresh) invalidateCustomerAssets(siteId, customer.id);
      loadCustomerAssets(siteId, customer.id)
        .then((result) => {
          if (!cancelled) {
            setAvailableAssets(result);
            setSelectedAssetIds((current) => current.filter((id) => result.some((asset) => asset.id === id)));
          }
        })
        .catch(() => undefined);
    };
    const handleAssetsUpdated = () => loadAssets(true);
    loadAssets();
    window.addEventListener("customer-assets:updated", handleAssetsUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener("customer-assets:updated", handleAssetsUpdated);
    };
  }, [customer.id, siteId]);

  function toggleAsset(assetId: string) {
    setSelectedAssetIds((current) =>
      current.includes(assetId)
        ? current.filter((id) => id !== assetId)
        : current.length >= maxAssets
          ? current
          : [...current, assetId]
    );
  }

  function updateAiApp(nextSlug: string) {
    setAiAppSlug(nextSlug);
    const nextApp = siteAiApps.find((app) => app.aiApp.slug === nextSlug);
    setCreativePackId(packsForApp(creativePacks, nextSlug)[0]?.id ?? "");
    setFormValues(valuesFor(nextApp));
    setSelectedAssetIds(initialSelectedAssets(availableAssets, workflowFor(nextApp)));
  }

  function updateCreativePack(pack: CreativePack) {
    setCreativePackId(pack.id);
    if (pack.aiAppSlug !== aiAppSlug) {
      updateAiApp(pack.aiAppSlug);
      setCreativePackId(pack.id);
    }
  }

  function updateField(id: string, value: string | number | boolean) {
    setFormValues((current) => ({ ...current, [id]: value }));
  }

  async function createJob(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sourceAssets.length) {
      setMessage("Upload at least one source photo before starting an album request.");
      return;
    }
    if (selectedAssetIds.length < minAssets) {
      setMessage(`Select at least ${minAssets} source photo${minAssets === 1 ? "" : "s"} for this request.`);
      return;
    }
    const missingField = selectedFields.find((field) => field.required && (formValues[field.id] === "" || formValues[field.id] === undefined || formValues[field.id] === null));
    if (missingField) {
      setMessage(`Complete ${missingField.label} before starting this request.`);
      return;
    }
    setPending(true);
    setMessage("Starting your album request and holding credits...");
    const response = await fetch(`/api/sites/${siteId}/ai/jobs`, {
      method: "POST",
      headers: customerJsonHeaders(siteId),
      body: JSON.stringify({
        customerId: customer.id,
        aiAppSlug,
        params: {
          creativePackId: selectedPack?.id,
          fields: formValues,
          workflowVersion: selectedWorkflow?.version ?? 1,
          assetIds: selectedAssetIds
        }
      })
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string; job?: { id: string } };
    if (!response.ok || !result.job) {
      setPending(false);
      setMessage(result.error ?? "Album request failed.");
      return;
    }
    const href = `/site/${siteSlug}/app/jobs/${result.job.id}`;
    window.dispatchEvent(new CustomEvent("storefront:navigation-start", { detail: { href } }));
    router.push(href);
  }

  if (!siteAiApps.length) {
    return (
      <div className="rounded-[20px] border border-dashed border-white/12 bg-white/[0.03] p-5 text-sm text-white/68">
        <p className="font-semibold text-white">{emptyTitle}</p>
        <p className="mt-2 leading-6">{emptyBody}</p>
      </div>
    );
  }

  return (
    <form className="grid gap-5" onSubmit={createJob}>
      <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/48">Workflow</p>
        <h3 className="mt-2 text-xl font-semibold text-white">{selectedWorkflow?.flowName ?? selectedApp?.aiApp.name ?? "Private generation"}</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/62">{selectedWorkflow?.description ?? selectedApp?.aiApp.description}</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {(selectedWorkflow?.steps ?? []).map((step, index) => (
            <div className="rounded-[16px] border border-white/10 bg-black/15 px-3 py-2" key={step.id}>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/42">Step {String(index + 1).padStart(2, "0")}</p>
              <p className="mt-1 truncate text-sm font-semibold text-white">{step.title}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/48">Step 01</p>
          <h3 className="mt-2 text-xl font-semibold text-white">{creativePacks.length ? "Choose a creative theme" : "Choose a backend-enabled tool"}</h3>
          <p className="mt-2 text-sm leading-6 text-white/62">
            {creativePacks.length
              ? "Each theme carries the generation direction saved by the studio team."
              : "Tools shown here come from the site AI tool configuration. Updating backend tools changes this workspace."}
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {appPacks.length ? appPacks.map((pack) => {
            const active = pack.id === selectedPack?.id;
            return (
              <button
                className={`grid min-h-[156px] grid-cols-[88px_1fr] gap-4 rounded-[20px] border p-3 text-left transition hover:-translate-y-0.5 ${
                  active ? "border-white bg-white text-[#14161a]" : "border-white/10 bg-white/[0.04] text-white"
                }`}
                key={pack.id}
                onClick={() => updateCreativePack(pack)}
                type="button"
              >
                <span className="overflow-hidden rounded-[16px] bg-white/[0.08]">
                  {pack.imageUrl ? (
                    <img className="h-full min-h-[132px] w-full object-cover" src={pack.imageUrl} alt={pack.name} />
                  ) : (
                    <span className="flex h-full min-h-[132px] items-center justify-center">
                      <Sparkles className="h-6 w-6 opacity-60" strokeWidth={1.8} />
                    </span>
                  )}
                </span>
                <span className="min-w-0">
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-base font-semibold">{pack.name}</span>
                      <span className={active ? "mt-2 line-clamp-2 block text-sm leading-6 text-[#5f5a54]" : "mt-2 line-clamp-2 block text-sm leading-6 text-white/62"}>
                        {pack.headline || pack.description}
                      </span>
                    </span>
                    {active ? <CheckCircle2 className="h-5 w-5 shrink-0" strokeWidth={1.8} /> : null}
                  </span>
                  <span className="mt-4 flex flex-wrap gap-2">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${active ? "bg-[#14161a] text-white" : "bg-white/[0.08] text-white/74"}`}>
                      {pack.creditCost} credits
                    </span>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${active ? "bg-[#14161a]/10 text-[#14161a]" : "bg-white/[0.08] text-white/74"}`}>
                      {pack.outputCount} outputs
                    </span>
                  </span>
                </span>
              </button>
            );
          }) : siteAiApps.map((app) => {
            const active = app.aiApp.slug === aiAppSlug;
            return (
              <button
                className={`min-h-[140px] rounded-[20px] border p-4 text-left transition hover:-translate-y-0.5 ${
                  active ? "border-white bg-white text-[#14161a]" : "border-white/10 bg-white/[0.04] text-white"
                }`}
                key={app.id}
                onClick={() => updateAiApp(app.aiApp.slug)}
                type="button"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate text-base font-semibold">{app.aiApp.name}</span>
                    <span className={active ? "mt-2 line-clamp-2 block text-sm leading-6 text-[#5f5a54]" : "mt-2 line-clamp-2 block text-sm leading-6 text-white/62"}>
                      {app.aiApp.description}
                    </span>
                  </span>
                  {active ? <CheckCircle2 className="h-5 w-5 shrink-0" strokeWidth={1.8} /> : null}
                </span>
                <span className={`mt-4 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${active ? "bg-[#14161a] text-white" : "bg-white/[0.08] text-white/74"}`}>
                  {app.creditCost} credits
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/48">Material rules</p>
        <div className="mt-3 grid gap-2">
          {materialRules.map((rule) => (
            <div className="flex gap-2 text-sm leading-6 text-white/68" key={rule}>
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#75d89a]" strokeWidth={1.8} />
              <span>{rule}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {selectedFields.map((field) => (
          <label className="grid gap-2 text-sm font-medium text-white" key={field.id}>
            {field.label}
            {field.type === "select" || field.type === "radio" ? (
              <select
                className="rounded-[18px] border border-white/10 bg-white/[0.05] px-4 py-3 text-white"
                onChange={(event) => updateField(field.id, event.target.value)}
                value={String(formValues[field.id] ?? field.options[0]?.value ?? "")}
              >
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : field.type === "textarea" ? (
              <textarea
                className="min-h-[104px] rounded-[18px] border border-white/10 bg-white/[0.05] px-4 py-3 text-white placeholder:text-white/35"
                onChange={(event) => updateField(field.id, event.target.value)}
                placeholder={field.placeholder ?? field.label}
                value={String(formValues[field.id] ?? "")}
              />
            ) : field.type === "number" ? (
              <input
                className="rounded-[18px] border border-white/10 bg-white/[0.05] px-4 py-3 text-white placeholder:text-white/35"
                max={field.max}
                min={field.min}
                onChange={(event) => updateField(field.id, Number(event.target.value))}
                step={field.step}
                type="number"
                value={Number(formValues[field.id] ?? field.min ?? 0)}
              />
            ) : field.type === "boolean" ? (
              <span className="inline-flex items-center gap-2 rounded-[18px] border border-white/10 bg-white/[0.05] px-4 py-3 text-white">
                <input checked={Boolean(formValues[field.id])} onChange={(event) => updateField(field.id, event.target.checked)} type="checkbox" />
                <span>{field.helpText ?? "Enabled"}</span>
              </span>
            ) : field.type === "text" ? (
              <input
                className="rounded-[18px] border border-white/10 bg-white/[0.05] px-4 py-3 text-white placeholder:text-white/35"
                onChange={(event) => updateField(field.id, event.target.value)}
                placeholder={field.placeholder ?? field.label}
                value={String(formValues[field.id] ?? "")}
              />
            ) : null}
            {field.helpText ? <span className="text-xs leading-5 text-white/52">{field.helpText}</span> : null}
          </label>
        ))}
      </div>
      <div className="grid gap-3 rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/48">Source photos</p>
          <p className="mt-2 text-sm leading-6 text-white/68">
            Select {minAssets}-{maxAssets} uploaded image{maxAssets === 1 ? "" : "s"} for this generation request.
          </p>
        </div>
        {sourceAssets.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {sourceAssets.slice(0, 8).map((asset) => {
              const checked = selectedAssetIds.includes(asset.id);
              return (
                <label className={`grid cursor-pointer grid-cols-[72px_1fr] gap-3 rounded-[18px] border p-3 transition ${checked ? "border-white bg-white text-[#14161a]" : "border-white/10 bg-black/18 text-white"}`} key={asset.id}>
                  <img className="h-[88px] w-[72px] rounded-[14px] object-cover" src={asset.previewUrl} alt={asset.label} />
                  <span className="min-w-0">
                    <span className="flex items-start gap-2">
                      <input checked={checked} className="mt-1" onChange={() => toggleAsset(asset.id)} type="checkbox" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{asset.label}</span>
                        <span className={checked ? "mt-1 block text-xs text-[#5f5a54]" : "mt-1 block text-xs text-white/58"}>{asset.mimeType}</span>
                      </span>
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[18px] border border-dashed border-white/12 bg-black/16 p-4 text-sm leading-6 text-white/68">
            <p>No source photos yet. Upload private photos before creating an AI image request.</p>
            <a className="mt-3 inline-flex items-center gap-2 rounded-[14px] bg-white px-4 py-2 text-xs font-semibold text-[#14161a]" href="#upload_1">
              <UploadCloud className="h-4 w-4" strokeWidth={1.8} />
              Upload source photos
            </a>
          </div>
        )}
      </div>
      <div className="grid gap-3 rounded-[20px] border border-white/10 bg-white/[0.04] p-4 sm:grid-cols-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/48">Credits</p>
          <p className="mt-3 text-2xl font-semibold text-white">{selectedPack?.creditCost ?? selectedApp?.creditCost ?? 0}</p>
          <p className="mt-1 text-xs leading-5 text-white/62">Held while your request is being created</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/48">Theme</p>
          <p className="mt-3 text-sm font-semibold text-white">{selectedPack?.name ?? "Private gallery"}</p>
          <p className="mt-1 text-xs leading-5 text-white/62">{selectedPack ? `${selectedPack.outputCount} outputs` : "Created for this account only"}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/48">Balance</p>
          <p className="mt-3 text-2xl font-semibold text-white">{customer.balance.available}</p>
          <p className="mt-1 text-xs leading-5 text-white/62">Available customer credits</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="rounded-[18px] bg-white px-5 py-3 text-sm font-semibold text-[#14161a] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55" disabled={pending || !aiAppSlug || !sourceAssets.length || selectedAssetIds.length < minAssets}>
          <Play className="mr-2 inline h-4 w-4" strokeWidth={1.8} />
          {pending ? "Starting" : selectedWorkflow?.submitLabel ?? "Start generation"}
        </button>
        <div className="inline-flex items-center gap-2 rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-medium text-white/70">
          <Sparkles className="h-4 w-4" strokeWidth={1.8} />
          Private request form
        </div>
      </div>
      <p className="text-sm leading-6 text-white/68">{message}</p>
    </form>
  );
}
