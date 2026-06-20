"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Save } from "lucide-react";
import { downloadCsv } from "@/components/admin/export-utils";
import type { CustomerModel, PublicCustomer } from "@/lib/types";
import { ProgressBar, StatusPill } from "@/components/ui";

function tone(status: CustomerModel["status"]): "good" | "warn" | "bad" | "neutral" {
  if (status === "ready") return "good";
  if (status === "failed") return "bad";
  if (status === "archived") return "neutral";
  return "warn";
}

export function ModelTrainingPanel({
  siteId,
  models,
  customers
}: {
  siteId: string;
  models: CustomerModel[];
  customers: PublicCustomer[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(models);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CustomerModel["status"] | "">("");
  const [savingModelId, setSavingModelId] = useState<string | null>(null);
  const [message, setMessage] = useState("Track selfie intake, couple-model training, provider IDs, and failures before generation.");

  useEffect(() => {
    setItems(models);
  }, [models]);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter((model) => {
      if (statusFilter && model.status !== statusFilter) return false;
      if (!normalized) return true;
      const customer = customers.find((item) => item.id === model.customerId);
      return [model.label, model.providerModelId ?? "", model.failureReason ?? "", customer?.email ?? "", customer?.name ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [customers, items, query, statusFilter]);

  function update<K extends keyof CustomerModel>(modelId: string, key: K, value: CustomerModel[K]) {
    setItems((current) => current.map((model) => (model.id === modelId ? { ...model, [key]: value } : model)));
  }

  async function save(model: CustomerModel) {
    setSavingModelId(model.id);
    const response = await fetch(`/api/sites/${siteId}/customer-models/${model.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: model.status,
        providerModelId: model.providerModelId,
        failureReason: model.failureReason,
        inputAssetCount: model.inputAssetCount
      })
    });
    const result = (await response.json().catch(() => ({}))) as { model?: CustomerModel; error?: string };
    setSavingModelId(null);
    if (response.ok && result.model) {
      setItems((current) => current.map((item) => (item.id === result.model?.id ? result.model : item)));
      setMessage(`${result.model.label} saved.`);
      router.refresh();
    } else {
      setMessage(result.error ?? "Model update failed.");
    }
  }

  function resetFilters() {
    setQuery("");
    setStatusFilter("");
  }

  function exportModels() {
    downloadCsv(
      `${siteId}-customer-models.csv`,
      filteredItems.map((model) => {
        const customer = customers.find((item) => item.id === model.customerId);
        return {
          modelId: model.id,
          label: model.label,
          customerEmail: customer?.email ?? model.customerId,
          modelType: model.modelType,
          status: model.status,
          inputAssetCount: model.inputAssetCount,
          minInputAssets: model.minInputAssets,
          providerModelId: model.providerModelId ?? "",
          failureReason: model.failureReason ?? "",
          updatedAt: model.updatedAt
        };
      }),
      [
        "modelId",
        "label",
        "customerEmail",
        "modelType",
        "status",
        "inputAssetCount",
        "minInputAssets",
        "providerModelId",
        "failureReason",
        "updatedAt"
      ]
    );
    setMessage(`Exported ${filteredItems.length} customer models.`);
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-clay">model training</p>
          <h2 className="mt-2 text-2xl font-semibold">Customer AI models</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500">{message}</p>
        </div>
        <button className="rounded-full border border-black/10 px-4 py-2 text-sm active:scale-[0.98]" onClick={exportModels} type="button">
          <Download className="mr-2 inline h-4 w-4" strokeWidth={1.8} />
          Export CSV
        </button>
      </div>
      <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
        <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
          <span className="rounded-full border border-zinc-200 bg-white px-3 py-1.5">{items.length} total</span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700">{items.filter((model) => model.status === "ready").length} ready</span>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-700">{items.filter((model) => model.status === "training").length} training</span>
          <span className="rounded-full border border-zinc-200 bg-white px-3 py-1.5">{filteredItems.length} visible</span>
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_240px_auto]">
          <input
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search model, customer, provider ID..."
            value={query}
          />
          <select className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm" onChange={(event) => setStatusFilter(event.target.value as CustomerModel["status"] | "")} value={statusFilter}>
            <option value="">All status</option>
            <option value="collecting_uploads">collecting_uploads</option>
            <option value="training">training</option>
            <option value="ready">ready</option>
            <option value="failed">failed</option>
            <option value="archived">archived</option>
          </select>
          <button className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm active:scale-[0.98]" onClick={resetFilters} type="button">
            Reset
          </button>
        </div>
      </div>
      <div className="mt-5 grid gap-3">
        {filteredItems.map((model) => {
          const customer = customers.find((item) => item.id === model.customerId);
          const intake = model.minInputAssets ? Math.min(100, Math.round((model.inputAssetCount / model.minInputAssets) * 100)) : 100;
          return (
            <div className="rounded-2xl border border-zinc-200 bg-white p-4" key={model.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{model.label}</h3>
                    <StatusPill label={model.status} tone={tone(model.status)} />
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">{customer?.email ?? model.customerId}</p>
                </div>
                <button className="rounded-full border border-black/10 px-3 py-2 text-xs active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55" disabled={savingModelId === model.id} onClick={() => save(model)} type="button">
                  <Save className="mr-1.5 inline h-3.5 w-3.5" strokeWidth={1.8} />
                  {savingModelId === model.id ? "Saving" : "Save"}
                </button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-[0.52fr_0.48fr]">
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">Upload intake</span>
                    <span className="font-mono">
                      {model.inputAssetCount}/{model.minInputAssets}
                    </span>
                  </div>
                  <div className="mt-2">
                    <ProgressBar value={intake} tone={intake >= 100 ? "good" : "warn"} />
                  </div>
                </div>
                <label className="grid gap-1 text-xs text-zinc-500">
                  Status
                  <select className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-zinc-950" onChange={(event) => update(model.id, "status", event.target.value as CustomerModel["status"])} value={model.status}>
                    <option value="collecting_uploads">collecting_uploads</option>
                    <option value="training">training</option>
                    <option value="ready">ready</option>
                    <option value="failed">failed</option>
                    <option value="archived">archived</option>
                  </select>
                </label>
                <label className="grid gap-1 text-xs text-zinc-500">
                  Provider model ID
                  <input
                    className="rounded-lg border border-black/10 bg-white px-3 py-2 font-mono text-xs text-zinc-950"
                    onChange={(event) => update(model.id, "providerModelId", event.target.value)}
                    placeholder="provider model id"
                    value={model.providerModelId ?? ""}
                  />
                </label>
                <label className="grid gap-1 text-xs text-zinc-500">
                  Input assets
                  <input
                    className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-zinc-950"
                    min={0}
                    onChange={(event) => update(model.id, "inputAssetCount", Number(event.target.value))}
                    type="number"
                    value={model.inputAssetCount}
                  />
                </label>
                <label className="grid gap-1 text-xs text-zinc-500 md:col-span-2">
                  Failure reason
                  <input
                    className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-zinc-950"
                    onChange={(event) => update(model.id, "failureReason", event.target.value)}
                    placeholder="Only needed when failed"
                    value={model.failureReason ?? ""}
                  />
                </label>
              </div>
            </div>
          );
        })}
        {!filteredItems.length ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-5 py-10 text-center text-sm text-zinc-500">
            No customer models match the current filters.
          </div>
        ) : null}
      </div>
    </div>
  );
}
