"use client";

import { useEffect, useState } from "react";
import { Download, Trash2, UploadCloud } from "lucide-react";
import type { PublicCustomer, ThemeRuntimeAsset } from "@/lib/types";
import { csrfHeader, customerJsonHeaders } from "@/lib/client-csrf";
import { invalidateCustomerAssets, loadCustomerAssets } from "@/components/app/customer-assets-client-cache";

const PAGE_SIZE = 8;

export function AssetsPanel({
  siteId,
  customer,
  assets,
  emptyTitle = "No private uploads yet.",
  emptyBody = "Add private source photos before creating an album request."
}: {
  siteId: string;
  customer: PublicCustomer;
  assets: ThemeRuntimeAsset[];
  emptyTitle?: string;
  emptyBody?: string;
}) {
  const [items, setItems] = useState(assets);
  const [label, setLabel] = useState("reference portrait");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("Uploads stay private to this account.");
  const [pending, setPending] = useState(false);
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const visibleItems = items.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => {
    setItems(assets);
  }, [assets]);

  useEffect(() => {
    let cancelled = false;
    loadCustomerAssets(siteId, customer.id)
      .then((result) => {
        if (!cancelled) setItems(result);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [customer.id, siteId]);

  useEffect(() => {
    setPage((current) => Math.min(current, Math.max(1, Math.ceil(items.length / PAGE_SIZE))));
  }, [items.length]);

  async function createAsset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setMessage("Choose an image file before uploading.");
      return;
    }
    setPending(true);
    setMessage("Uploading the private source photo...");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("label", label || file.name.replace(/\.[^.]+$/, ""));
    formData.append("role", "input");
    const response = await fetch(`/api/sites/${siteId}/customers/${customer.id}/assets`, {
      method: "POST",
      headers: csrfHeader(`customer_csrf_${siteId}`),
      body: formData
    });
    const result = (await response.json().catch(() => ({}))) as { asset?: ThemeRuntimeAsset; error?: string };
    const createdAsset = result.asset;
    if (response.ok && createdAsset) {
      invalidateCustomerAssets(siteId, customer.id);
      setItems((current) => [createdAsset, ...current]);
      setPage(1);
      setLabel("reference portrait");
      setFile(null);
      setMessage(`${createdAsset.label} uploaded. Continue to tool setup when your source photos are ready.`);
      window.dispatchEvent(new CustomEvent("customer-assets:updated"));
    } else {
      setMessage(result.error ?? "Asset create failed.");
    }
    setPending(false);
  }

  async function deleteAsset(assetId: string) {
    const response = await fetch(`/api/sites/${siteId}/customers/${customer.id}/assets/${assetId}`, { method: "DELETE", headers: customerJsonHeaders(siteId) });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    if (response.ok) {
      invalidateCustomerAssets(siteId, customer.id);
      setItems((current) => current.filter((asset) => asset.id !== assetId));
      setMessage("Upload deleted from this private account.");
      window.dispatchEvent(new CustomEvent("customer-assets:updated"));
    } else {
      setMessage(result.error ?? "Asset delete failed.");
    }
  }

  async function downloadAsset(assetId: string) {
    const response = await fetch(`/api/sites/${siteId}/customers/${customer.id}/assets/${assetId}/download`, { method: "POST", headers: customerJsonHeaders(siteId) });
    const result = (await response.json().catch(() => ({}))) as { downloadUrl?: string; expiresAt?: string; error?: string };
    if (response.ok && result.downloadUrl) {
      setMessage(`Download link ready until ${result.expiresAt}.`);
      window.open(result.downloadUrl, "_blank");
    } else {
      setMessage(result.error ?? "Download link failed.");
    }
  }

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-[#171514]">Private uploads</h2>
          <p className="mt-1 text-sm text-[#6d665f]">{message}</p>
        </div>
      </div>
      <form className="grid gap-3 md:grid-cols-[1fr_auto]" onSubmit={createAsset}>
        <div className="grid gap-3">
          <label className="grid gap-2 text-sm font-medium text-[#171514]">
            Image file
            <input
              accept="image/*"
              className="rounded-[18px] border border-dashed border-[#cdbfae] bg-white px-4 py-3 text-sm text-[#171514] file:mr-4 file:rounded-full file:border-0 file:bg-[#171514] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              type="file"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-[#171514]">
            Upload label
            <input
              className="rounded-[18px] border border-[#ded5ca] bg-white px-4 py-3 text-[#171514] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
              onChange={(event) => setLabel(event.target.value)}
              placeholder={file?.name.replace(/\.[^.]+$/, "") || "reference portrait"}
              value={label}
            />
          </label>
        </div>
        <button className="self-end rounded-[18px] bg-[#171514] px-5 py-3 text-sm font-semibold text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55" disabled={pending || !file}>
          <UploadCloud className="mr-2 inline h-4 w-4" strokeWidth={1.8} />
          {pending ? "Uploading" : "Upload photo"}
        </button>
      </form>
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[18px] border border-[#eadfce] bg-[#fbf7f0] px-4 py-3 text-sm text-[#625d56]">
        <span>After uploading the needed photos, return to the selected tool and start the private request.</span>
        <a className="inline-flex rounded-full bg-[#171514] px-4 py-2 text-xs font-semibold text-white" href="#create">
          Continue to tool setup
        </a>
      </div>
      <div className="mt-5 grid gap-3">
        {visibleItems.length ? (
          visibleItems.map((asset) => (
            <div className="grid gap-3 rounded-[20px] border border-[#e4dace] bg-white p-4 text-sm shadow-[0_16px_48px_-40px_rgba(20,22,26,0.14)] md:grid-cols-[92px_1fr_0.32fr_0.4fr]" key={asset.id}>
              <div className="overflow-hidden rounded-[16px] bg-[#efe6d9]">
                <img className="aspect-[4/5] h-full w-full object-cover" src={asset.previewUrl} alt={asset.label} />
              </div>
              <span className="min-w-0">
                <span className="block font-medium text-[#171514]">{asset.label}</span>
                <span className="mt-1 inline-flex rounded-full border border-[#eadfce] bg-[#fbf7f0] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#8a7a6d]">
                  {asset.role === "input" ? "source photo" : "gallery image"}
                </span>
                <span className="mt-2 block text-xs text-[#8a7a6d]">{asset.role === "input" ? "Private source image" : "Private gallery image"}</span>
              </span>
              <span className="font-mono text-[#625d56]">{asset.mimeType}</span>
              <span className="flex gap-2 md:justify-end">
                <button className="rounded-[14px] border border-[#ded5ca] bg-[#fbf7f0] px-3 py-2 text-[#171514] active:scale-[0.98]" onClick={() => downloadAsset(asset.id)} type="button">
                  <Download className="h-4 w-4" strokeWidth={1.8} />
                </button>
                <button className="rounded-[14px] border border-[#ded5ca] bg-[#fbf7f0] px-3 py-2 text-[#8f4d3a] active:scale-[0.98]" onClick={() => deleteAsset(asset.id)} type="button">
                  <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                </button>
              </span>
            </div>
          ))
        ) : (
          <div className="rounded-[20px] border border-dashed border-[#d8cab9] bg-[#fbf7f0] p-5 text-sm text-[#6d665f]">
            <p className="font-semibold text-[#171514]">{emptyTitle}</p>
            <p className="mt-2 leading-6">{emptyBody}</p>
          </div>
        )}
      </div>
      {totalPages > 1 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-[#6d665f]">
          <span className="whitespace-nowrap">
            Page {safePage} of {totalPages} · {items.length} uploads
          </span>
          <div className="flex items-center gap-2">
            <button
              className="inline-flex min-h-9 items-center justify-center whitespace-nowrap rounded-full border border-[#ded5ca] bg-white px-3 font-semibold text-[#171514] disabled:cursor-not-allowed disabled:opacity-45"
              disabled={safePage <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              type="button"
            >
              Previous
            </button>
            <button
              className="inline-flex min-h-9 items-center justify-center whitespace-nowrap rounded-full border border-[#ded5ca] bg-white px-3 font-semibold text-[#171514] disabled:cursor-not-allowed disabled:opacity-45"
              disabled={safePage >= totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              type="button"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
