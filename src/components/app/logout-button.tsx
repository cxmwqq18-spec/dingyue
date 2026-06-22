"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";

export function LogoutButton({ siteId, siteSlug }: { siteId: string; siteSlug: string }) {
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    await fetch(`/api/sites/${siteId}/auth/logout`, { method: "POST", credentials: "same-origin" });
    window.location.href = `/site/${siteSlug}/login`;
  }

  return (
    <button className="rounded-full border border-black/10 px-4 py-2 text-sm active:scale-[0.98]" disabled={pending} onClick={logout}>
      <LogOut className="mr-2 inline h-4 w-4" strokeWidth={1.8} />
      {pending ? "Signing out" : "Sign out"}
    </button>
  );
}
