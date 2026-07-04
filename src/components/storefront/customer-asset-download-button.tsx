"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { customerJsonHeaders } from "@/lib/client-csrf";

export function CustomerAssetDownloadButton({
  assetId,
  className = "",
  customerId,
  label = "Download",
  siteId
}: {
  assetId: string;
  className?: string;
  customerId: string;
  label?: string;
  siteId: string;
}) {
  const [busy, setBusy] = useState(false);

  async function download() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/sites/${siteId}/customers/${customerId}/assets/${assetId}/download`, {
        method: "POST",
        headers: customerJsonHeaders(siteId)
      });
      const result = (await response.json().catch(() => ({}))) as { downloadUrl?: string };
      if (response.ok && result.downloadUrl) {
        window.open(result.downloadUrl, "_blank", "noopener,noreferrer");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      aria-label={label}
      className={className}
      disabled={busy}
      onClick={download}
      type="button"
    >
      <Download className="h-4 w-4" strokeWidth={1.8} />
      <span>{busy ? "Preparing" : label}</span>
    </button>
  );
}
