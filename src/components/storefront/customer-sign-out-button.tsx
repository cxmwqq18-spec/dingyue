"use client";

import { useState } from "react";

export function CustomerSignOutButton({
  className,
  label = "Sign out",
  logoutHref,
  redirectHref,
  siteId
}: {
  className: string;
  label?: string;
  logoutHref: string;
  redirectHref: string;
  siteId: string;
}) {
  const [pending, setPending] = useState(false);

  async function signOut() {
    if (pending) return;
    setPending(true);
    const body = new FormData();
    body.set("siteId", siteId);
    await fetch(logoutHref, {
      body,
      credentials: "same-origin",
      method: "POST"
    }).catch(() => undefined);
    window.location.replace(redirectHref);
  }

  return (
    <button className={className} disabled={pending} onClick={signOut} type="button">
      {pending ? "Signing out..." : label}
    </button>
  );
}
