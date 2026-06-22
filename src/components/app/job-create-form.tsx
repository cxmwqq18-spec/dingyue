"use client";

import { useState } from "react";
import { Play, Sparkles } from "lucide-react";
import type { PublicCustomer, SiteAiApp, ThemeRuntimeAsset } from "@/lib/types";
import { customerJsonHeaders } from "@/lib/client-csrf";

export function JobCreateForm({
  siteId,
  siteSlug,
  customer,
  siteAiApps,
  assets = [],
  emptyTitle = "No enabled album experience.",
  emptyBody = "Enable an album experience for this site before publishing this form."
}: {
  siteId: string;
  siteSlug: string;
  customer: PublicCustomer;
  siteAiApps: SiteAiApp[];
  assets?: ThemeRuntimeAsset[];
  emptyTitle?: string;
  emptyBody?: string;
}) {
  const [aiAppSlug, setAiAppSlug] = useState(siteAiApps[0]?.aiApp.slug ?? "");
  const initialApp = siteAiApps[0];
  const [formValues, setFormValues] = useState<Record<string, string>>(() => {
    if (!initialApp) return {};
    return Object.fromEntries(
      initialApp.aiApp.parameterSchema.map((field) => [field.id, field.options?.[0] ?? ""])
    );
  });
  const sourceAssets = assets.filter((asset) => asset.role === "input");
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>(() => sourceAssets.slice(0, 4).map((asset) => asset.id));
  const [message, setMessage] = useState("Choose a style, confirm credits, and start a private album request.");
  const [pending, setPending] = useState(false);
  const selectedApp = siteAiApps.find((app) => app.aiApp.slug === aiAppSlug) ?? siteAiApps[0];

  function toggleAsset(assetId: string) {
    setSelectedAssetIds((current) =>
      current.includes(assetId) ? current.filter((id) => id !== assetId) : [...current, assetId]
    );
  }

  function updateAiApp(nextSlug: string) {
    setAiAppSlug(nextSlug);
    const nextApp = siteAiApps.find((app) => app.aiApp.slug === nextSlug);
    setFormValues(
      Object.fromEntries(
        (nextApp?.aiApp.parameterSchema ?? []).map((field) => [field.id, field.options?.[0] ?? ""])
      )
    );
  }

  function updateField(id: string, value: string) {
    setFormValues((current) => ({ ...current, [id]: value }));
  }

  async function createJob(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sourceAssets.length) {
      setMessage("Upload at least one source photo before starting an album request.");
      return;
    }
    if (!selectedAssetIds.length) {
      setMessage("Select at least one uploaded source photo for this request.");
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
          ...formValues,
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
    window.location.href = `/site/${siteSlug}/app/jobs/${result.job.id}`;
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
    <form className="grid gap-4" onSubmit={createJob}>
      <label className="grid gap-2 text-sm font-medium text-white">
        Album style
        <select
          className="rounded-[18px] border border-white/10 bg-white/[0.05] px-4 py-3 text-white"
          onChange={(event) => updateAiApp(event.target.value)}
          value={aiAppSlug}
        >
          {siteAiApps.map((app) => (
            <option key={app.id} value={app.aiApp.slug}>
              {app.aiApp.name} - {app.creditCost} credits
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        {selectedApp?.aiApp.parameterSchema.map((field) => (
          <label className="grid gap-2 text-sm font-medium text-white" key={field.id}>
            {field.label}
            {field.type === "select" ? (
              <select
                className="rounded-[18px] border border-white/10 bg-white/[0.05] px-4 py-3 text-white"
                onChange={(event) => updateField(field.id, event.target.value)}
                value={formValues[field.id] ?? field.options?.[0] ?? ""}
              >
                {(field.options ?? []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="rounded-[18px] border border-white/10 bg-white/[0.05] px-4 py-3 text-white placeholder:text-white/35"
                onChange={(event) => updateField(field.id, event.target.value)}
                placeholder={field.label}
                value={formValues[field.id] ?? ""}
              />
            )}
          </label>
        ))}
      </div>
      <div className="grid gap-3 rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/48">Source photos</p>
          <p className="mt-2 text-sm leading-6 text-white/68">
            Select uploaded images that should be attached to this generation request.
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
            No source photos yet. Upload private photos in Step 01 before creating an AI image request.
          </div>
        )}
      </div>
      <div className="grid gap-3 rounded-[20px] border border-white/10 bg-white/[0.04] p-4 sm:grid-cols-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/48">Credits</p>
          <p className="mt-3 text-2xl font-semibold text-white">{selectedApp?.creditCost ?? 0}</p>
          <p className="mt-1 text-xs leading-5 text-white/62">Held while your album is being created</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/48">Delivery</p>
          <p className="mt-3 text-sm font-semibold text-white">Private gallery</p>
          <p className="mt-1 text-xs leading-5 text-white/62">Created for this account only</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/48">Balance</p>
          <p className="mt-3 text-2xl font-semibold text-white">{customer.balance.available}</p>
          <p className="mt-1 text-xs leading-5 text-white/62">Available customer credits</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="rounded-[18px] bg-white px-5 py-3 text-sm font-semibold text-[#14161a] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55" disabled={pending || !aiAppSlug || !sourceAssets.length || !selectedAssetIds.length}>
          <Play className="mr-2 inline h-4 w-4" strokeWidth={1.8} />
          {pending ? "Starting" : "Start album request"}
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
