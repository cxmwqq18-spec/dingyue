"use client";

import { useRef, useState } from "react";
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
  const pendingRef = useRef(false);

  async function openAdmin() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    try {
      const response = await fetch(`/api/platform/sites/${siteId}/admin-bridge`, {
        method: "POST",
        headers: platformJsonHeaders(),
        body: JSON.stringify({ path })
      });
      const result = (await response.json().catch(() => ({}))) as { redirectTo?: string; error?: string };
      if (!response.ok || !result.redirectTo) {
        const message = response.status === 429 ? "操作太频繁，请稍后再试。" : result.error ?? "site_admin_bridge_failed";
        window.alert(message);
        return;
      }
      window.location.href = result.redirectTo;
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <button className={className} disabled={pending} onClick={openAdmin} type="button">
      {pending ? "进入中" : label}
    </button>
  );
}
