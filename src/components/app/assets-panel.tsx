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
  createHref = "#create",
  emptyTitle = "No private uploads yet.",
  emptyBody = "Add private source photos before creating an album request.",
  tone = "light"
}: {
  siteId: string;
  customer: PublicCustomer;
  assets: ThemeRuntimeAsset[];
  createHref?: string;
  emptyTitle?: string;
  emptyBody?: string;
  tone?: "light" | "dark";
}) {
  const [items, setItems] = useState(assets);
  const [label, setLabel] = useState("reference portrait");
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState("Uploads stay private to this account.");
  const [pending, setPending] = useState(false);
  const [page, setPage] = useState(1);
  const [loadingAssets, setLoadingAssets] = useState(() => assets.length === 0);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const visibleItems = items.slice(pageStart, pageStart + PAGE_SIZE);
  const dark = tone === "dark";
  const textClass = dark ? "text-white" : "text-[#171514]";
  const mutedClass = dark ? "text-white/60" : "text-[#6d665f]";
  const panelClass = dark ? "border-white/10 bg-white/[0.04]" : "border-[#eadfce] bg-[#fbf7f0]";
  const fieldClass = dark
    ? "border-white/12 bg-[#07090d] text-white placeholder:text-white/32 file:bg-white file:text-[#101114]"
    : "border-[#ded5ca] bg-white text-[#171514] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]";
  const dashedFieldClass = dark
    ? "border-white/14 bg-[#07090d] text-white file:bg-white file:text-[#101114]"
    : "border-[#cdbfae] bg-white text-[#171514] file:bg-[#171514] file:text-white";
  const primaryClass = dark
    ? "bg-[linear-gradient(135deg,#ff5ebd,#2f6fed,#31d4ff)] text-white"
    : "bg-[#171514] text-white";
  const cardClass = dark
    ? "border-white/10 bg-[#0f131c] text-white shadow-[0_16px_48px_-40px_rgba(0,0,0,0.92)]"
    : "border-[#e4dace] bg-white text-[#171514] shadow-[0_16px_48px_-40px_rgba(20,22,26,0.14)]";
  const skeletonClass = dark ? "bg-white/[0.08]" : "bg-[#efe6d9]";

  useEffect(() => {
    setItems(assets);
  }, [assets]);

  useEffect(() => {
    let cancelled = false;
    setLoadingAssets(true);
    loadCustomerAssets(siteId, customer.id)
      .then((result) => {
        if (!cancelled) {
          setItems(result);
          setLoadingAssets(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadingAssets(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customer.id, siteId]);

  useEffect(() => {
    setPage((current) => Math.min(current, Math.max(1, Math.ceil(items.length / PAGE_SIZE))));
  }, [items.length]);

  async function createAsset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!files.length) {
      setMessage("Choose one or more image files before uploading.");
      return;
    }
    setPending(true);
    setMessage(files.length === 1 ? "Uploading the private source photo..." : `Uploading ${files.length} private source photos...`);
    const createdAssets: ThemeRuntimeAsset[] = [];
    for (const [index, currentFile] of files.entries()) {
      const formData = new FormData();
      formData.append("file", currentFile);
      formData.append("label", files.length === 1 ? label || currentFile.name.replace(/\.[^.]+$/, "") : currentFile.name.replace(/\.[^.]+$/, "") || `source photo ${index + 1}`);
      formData.append("role", "input");
      const response = await fetch(`/api/sites/${siteId}/customers/${customer.id}/assets`, {
        method: "POST",
        headers: csrfHeader(`customer_csrf_${siteId}`),
        body: formData
      });
      const result = (await response.json().catch(() => ({}))) as { asset?: ThemeRuntimeAsset; error?: string };
      if (!response.ok || !result.asset) {
        setMessage(`We could not upload ${currentFile.name}. Please check the file and try again.`);
        setPending(false);
        return;
      }
      createdAssets.push(result.asset);
    }
    invalidateCustomerAssets(siteId, customer.id);
    setItems((current) => [...createdAssets.reverse(), ...current]);
    setPage(1);
    setLabel("reference portrait");
    setFiles([]);
    setMessage(`${createdAssets.length} source photo${createdAssets.length === 1 ? "" : "s"} uploaded. Continue to tool setup when your source photos are ready.`);
    window.dispatchEvent(new CustomEvent("customer-assets:updated"));
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
      setMessage("We could not delete this upload. Please try again.");
    }
  }

  async function downloadAsset(assetId: string) {
    const response = await fetch(`/api/sites/${siteId}/customers/${customer.id}/assets/${assetId}/download`, { method: "POST", headers: customerJsonHeaders(siteId) });
    const result = (await response.json().catch(() => ({}))) as { downloadUrl?: string; expiresAt?: string; error?: string };
    if (response.ok && result.downloadUrl) {
      setMessage(`Download link ready until ${result.expiresAt}.`);
      window.open(result.downloadUrl, "_blank");
    } else {
      setMessage("We could not prepare this download link. Please try again.");
    }
  }

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className={`text-2xl font-semibold ${textClass}`}>Private uploads</h2>
          <p className={`mt-1 text-sm ${mutedClass}`}>{message}</p>
        </div>
      </div>
      <form className="grid gap-3 md:grid-cols-[1fr_auto]" onSubmit={createAsset}>
        <div className="grid gap-3">
          <label className={`grid gap-2 text-sm font-medium ${textClass}`}>
            Image file
            <input
              accept="image/*"
              className={`rounded-[18px] border border-dashed px-4 py-3 text-sm file:mr-4 file:rounded-full file:border-0 file:px-4 file:py-2 file:text-sm file:font-semibold ${dashedFieldClass}`}
              multiple
              onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
              type="file"
            />
          </label>
          <label className={`grid gap-2 text-sm font-medium ${textClass}`}>
            Upload label
            <input
              className={`rounded-[18px] border px-4 py-3 ${fieldClass}`}
              onChange={(event) => setLabel(event.target.value)}
              placeholder={files[0]?.name.replace(/\.[^.]+$/, "") || "reference portrait"}
              value={label}
            />
            {files.length > 1 ? <span className={`text-xs leading-5 ${mutedClass}`}>Multiple uploads use each file name as its label.</span> : null}
          </label>
        </div>
        <button className={`self-end rounded-[18px] px-5 py-3 text-sm font-semibold active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 ${primaryClass}`} disabled={pending || !files.length}>
          <UploadCloud className="mr-2 inline h-4 w-4" strokeWidth={1.8} />
          {pending ? "Uploading" : files.length > 1 ? "Upload photos" : "Upload photo"}
        </button>
      </form>
      <div className={`mt-4 flex flex-wrap items-center gap-3 rounded-[18px] border px-4 py-3 text-sm ${panelClass} ${mutedClass}`}>
        <span>After uploading the needed photos, return to the selected tool and start the private request.</span>
        <a className={`inline-flex rounded-full px-4 py-2 text-xs font-semibold ${primaryClass}`} href={createHref}>
          Continue to tool setup
        </a>
      </div>
      <div className="mt-5 grid gap-3">
        {visibleItems.length ? (
          visibleItems.map((asset) => (
            <div className={`grid gap-3 rounded-[20px] border p-4 text-sm md:grid-cols-[92px_1fr_0.32fr_0.4fr] ${cardClass}`} key={asset.id}>
              <div className={`overflow-hidden rounded-[16px] ${dark ? "bg-white/[0.06]" : "bg-[#efe6d9]"}`}>
                <img className="aspect-[4/5] h-full w-full object-cover" src={asset.previewUrl} alt={asset.label} />
              </div>
              <span className="min-w-0">
                <span className={`block font-medium ${textClass}`}>{asset.label}</span>
                <span className={`mt-1 inline-flex rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${dark ? "border-white/10 bg-white/[0.06] text-white/54" : "border-[#eadfce] bg-[#fbf7f0] text-[#8a7a6d]"}`}>
                  {asset.role === "input" ? "source photo" : "gallery image"}
                </span>
                <span className={`mt-2 block text-xs ${mutedClass}`}>{asset.role === "input" ? "Private source image" : "Private gallery image"}</span>
              </span>
              <span className={`font-mono ${mutedClass}`}>{asset.mimeType}</span>
              <span className="flex gap-2 md:justify-end">
                <button className={`rounded-[14px] border px-3 py-2 active:scale-[0.98] ${dark ? "border-white/10 bg-white/[0.06] text-white" : "border-[#ded5ca] bg-[#fbf7f0] text-[#171514]"}`} onClick={() => downloadAsset(asset.id)} type="button">
                  <Download className="h-4 w-4" strokeWidth={1.8} />
                </button>
                <button className={`rounded-[14px] border px-3 py-2 active:scale-[0.98] ${dark ? "border-white/10 bg-white/[0.06] text-[#ff8a8a]" : "border-[#ded5ca] bg-[#fbf7f0] text-[#8f4d3a]"}`} onClick={() => deleteAsset(asset.id)} type="button">
                  <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                </button>
              </span>
            </div>
          ))
        ) : loadingAssets ? (
          <div className="grid gap-3" aria-busy="true" aria-label="Loading private uploads">
            {[0, 1, 2].map((item) => (
              <div className={`grid gap-3 rounded-[20px] border p-4 md:grid-cols-[92px_1fr_0.32fr_0.4fr] ${cardClass}`} key={item}>
                <div className={`aspect-[4/5] rounded-[16px] ${skeletonClass}`} />
                <div className="grid content-start gap-3">
                  <div className={`h-4 w-40 rounded-full ${skeletonClass}`} />
                  <div className={`h-6 w-28 rounded-full ${dark ? "bg-white/[0.05]" : "bg-[#fbf7f0]"}`} />
                  <div className={`h-3 w-36 rounded-full ${skeletonClass}`} />
                </div>
                <div className={`h-4 w-24 rounded-full ${skeletonClass}`} />
                <div className="flex gap-2 md:justify-end">
                  <div className={`h-9 w-10 rounded-[14px] ${dark ? "bg-white/[0.05]" : "bg-[#fbf7f0]"}`} />
                  <div className={`h-9 w-10 rounded-[14px] ${dark ? "bg-white/[0.05]" : "bg-[#fbf7f0]"}`} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={`rounded-[20px] border border-dashed p-5 text-sm ${dark ? "border-white/12 bg-white/[0.035] text-white/62" : "border-[#d8cab9] bg-[#fbf7f0] text-[#6d665f]"}`}>
            <p className={`font-semibold ${textClass}`}>{emptyTitle}</p>
            <p className="mt-2 leading-6">{emptyBody}</p>
          </div>
        )}
      </div>
      {totalPages > 1 ? (
        <div className={`mt-4 flex flex-wrap items-center justify-between gap-3 text-xs ${mutedClass}`}>
          <span className="whitespace-nowrap">
            Page {safePage} of {totalPages} · {items.length} uploads
          </span>
          <div className="flex items-center gap-2">
            <button
              className={`inline-flex min-h-9 items-center justify-center whitespace-nowrap rounded-full border px-3 font-semibold disabled:cursor-not-allowed disabled:opacity-45 ${dark ? "border-white/10 bg-white/[0.06] text-white" : "border-[#ded5ca] bg-white text-[#171514]"}`}
              disabled={safePage <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              type="button"
            >
              Previous
            </button>
            <button
              className={`inline-flex min-h-9 items-center justify-center whitespace-nowrap rounded-full border px-3 font-semibold disabled:cursor-not-allowed disabled:opacity-45 ${dark ? "border-white/10 bg-white/[0.06] text-white" : "border-[#ded5ca] bg-white text-[#171514]"}`}
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
