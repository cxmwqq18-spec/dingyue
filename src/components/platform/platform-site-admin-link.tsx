"use client";

import { useState } from "react";
import { platformJsonHeaders } from "@/lib/client-csrf";

export function PlatformSiteAdminLink({
  siteId,
  path = "/admin",
  label = "后台",
  className
}: {
  siteId: string;
  path?: string;
  label?: string;
  className?: string;
}) {
  const [pending, setPending] = useState(false);

  async function openAdmin() {
    setPending(true);
    const response = await fetch(`/api/platform/sites/${siteId}/admin-bridge`, {
      method: "POST",
      headers: platformJsonHeaders(),
      body: JSON.stringify({ path })
    });
    const result = (await response.json().catch(() => ({}))) as { redirectTo?: string; error?: string };
    setPending(false);
    if (!response.ok || !result.redirectTo) {
      window.alert(result.error ?? "site_admin_bridge_failed");
      return;
    }
    window.location.href = result.redirectTo;
  }

  return (
    <button className={className} disabled={pending} onClick={openAdmin} type="button">
      {pending ? "进入中" : label}
    </button>
  );
}
