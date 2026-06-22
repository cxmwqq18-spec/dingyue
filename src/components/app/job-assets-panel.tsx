"use client";

import { useState } from "react";
import { Download, Trash2 } from "lucide-react";
import type { ThemeRuntimeAsset } from "@/lib/types";
import { customerJsonHeaders } from "@/lib/client-csrf";

function reviewLabel(status: ThemeRuntimeAsset["reviewStatus"]) {
  if (status === "approved") return "Ready";
  if (status === "pending") return "Reviewing";
  return "Needs review";
}

export function JobAssetsPanel({
  siteId,
  customerId,
  assets
}: {
  siteId: string;
  customerId: string;
  assets: ThemeRuntimeAsset[];
}) {
  const [items, setItems] = useState(assets);
  const [message, setMessage] = useState("Delivered images stay private to this account.");

  async function download(assetId: string) {
    const response = await fetch(`/api/sites/${siteId}/customers/${customerId}/assets/${assetId}/download`, { method: "POST", headers: customerJsonHeaders(siteId) });
    const result = (await response.json().catch(() => ({}))) as { downloadUrl?: string; expiresAt?: string; error?: string };
    if (response.ok && result.downloadUrl) {
      setMessage(`Download link ready until ${result.expiresAt}.`);
      window.open(result.downloadUrl, "_blank");
    } else {
      setMessage(result.error ?? "Download link failed.");
    }
  }

  async function remove(assetId: string) {
    const response = await fetch(`/api/sites/${siteId}/customers/${customerId}/assets/${assetId}`, { method: "DELETE", headers: customerJsonHeaders(siteId) });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    if (response.ok) {
      setItems((current) => current.filter((asset) => asset.id !== assetId));
      setMessage("Delivered image deleted.");
    } else {
      setMessage(result.error ?? "Delete failed.");
    }
  }

  return (
    <div>
      <p className="mb-4 text-sm leading-6 text-zinc-600">{message}</p>
      <div className="grid grid-cols-2 gap-3">
        {items.map((asset) => (
          <div className="overflow-hidden rounded-[20px] border border-[#e4dace] bg-[#fffaf3] p-3 text-[#171514]" key={asset.id}>
            <div className="overflow-hidden rounded-[16px] bg-[#efe6d9]">
              <img
                className="aspect-[4/3] w-full object-cover"
                src={asset.previewUrl}
                alt={asset.label}
              />
            </div>
            <div className="mt-3">
              <span className="inline-flex rounded-full border border-[#eadfce] bg-white px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[#8a7a6d]">{reviewLabel(asset.reviewStatus)}</span>
              <span className="mt-2 block font-medium text-[#171514]">{asset.label}</span>
              <span className="mt-1 block text-xs text-[#8a7a6d]">Private gallery image</span>
            </div>
            <div className="mt-3 flex gap-2">
              <button className="rounded-[14px] border border-[#ded5ca] bg-white px-3 py-2 text-[#171514] active:scale-[0.98]" onClick={() => download(asset.id)}>
                <Download className="h-4 w-4" strokeWidth={1.8} />
              </button>
              <button className="rounded-[14px] border border-[#ded5ca] bg-white px-3 py-2 text-[#8f4d3a] active:scale-[0.98]" onClick={() => remove(asset.id)}>
                <Trash2 className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </div>
          </div>
        ))}
        {!items.length ? (
          <div className="col-span-2 rounded-[18px] border border-dashed border-[#d8cab9] bg-[#fbf7f0] p-5 text-sm text-[#6d665f]">
            No delivered images for this request yet.
          </div>
        ) : null}
      </div>
    </div>
  );
}
