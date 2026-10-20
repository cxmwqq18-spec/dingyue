"use client";
import { useEffect } from "react";
import { entryCookieName, workspaceEntryTarget, type WorkspaceEntryTransfer } from "@/lib/aidreamcapes-workspace/entry-transfer";

export function saveWorkspaceEntry(entry: WorkspaceEntryTransfer, pathname: string) {
  const base = pathname.match(/^\/site\/(?:aidreamcapes|aivideosugc)/)?.[0] ?? "";
  const value = { ...entry, expires: Date.now() + 120000 };
  try { sessionStorage.removeItem(entryCookieName(entry.view)); } catch { /* Short entries only require cookies. */ }
  let encoded = encodeURIComponent(JSON.stringify(value));
  if (encoded.length > 3800) {
    sessionStorage.setItem(entryCookieName(entry.view), encoded);
    encoded = encodeURIComponent(JSON.stringify({ ...value, query: { ...value.query, prompt: "", url: "" } }));
  }
  document.cookie = `${entryCookieName(entry.view)}=${encoded}; Path=${base}/app/create; Max-Age=120; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
}

/** No public data requests: only the selection made by this click is handed off. */
export function WorkspaceEntryBehavior() {
  useEffect(() => {
    const click = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest<HTMLAnchorElement>("a[data-workspace-entry]");
      if (!anchor?.dataset.workspaceEntry) return;
      // The anchor already has a canonical SSR href. If storage is blocked,
      // keep that navigation usable instead of making the link inert.
      try { saveWorkspaceEntry(JSON.parse(anchor.dataset.workspaceEntry), new URL(anchor.href).pathname); }
      catch { /* Navigate without the optional selection transfer. */ }
    };
    const submit = (event: SubmitEvent) => {
      if (!(event.target instanceof HTMLFormElement)) return;
      const form = event.target;
      const action = new URL(form.action);
      if (!action.pathname.match(/^(?:\/site\/(?:aidreamcapes|aivideosugc))?\/app\/create(?:\/|$)/)) return;
      if (action.origin !== location.origin) return;
      const query = new URLSearchParams();
      new FormData(form).forEach((value, key) => { if (typeof value === "string") query.set(key, value); });
      const target = workspaceEntryTarget(`${action.pathname}?${query}`);
      if (!target.transfer) return;
      event.preventDefault();
      try { saveWorkspaceEntry(target.transfer, target.href); location.assign(target.href); }
      catch { /* Keep the page and entered values when browser storage is unavailable. */ }
    };
    document.addEventListener("click", click, true);
    document.addEventListener("submit", submit);
    return () => { document.removeEventListener("click", click, true); document.removeEventListener("submit", submit); };
  }, []);
  return null;
}
