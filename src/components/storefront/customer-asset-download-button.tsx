"use client";

import { Download } from "lucide-react";

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
  const downloadHref = `/api/sites/${encodeURIComponent(siteId)}/customers/${encodeURIComponent(customerId)}/assets/${encodeURIComponent(assetId)}/download`;

  return (
    <a
      aria-label={label}
      className={className}
      download
      href={downloadHref}
    >
      <Download className="h-4 w-4" strokeWidth={1.8} />
      <span>{label}</span>
    </a>
  );
}
