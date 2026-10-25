"use client";

// Account avatars are private customer media URLs; render them directly.
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { CreditCard, LayoutDashboard, LogOut, ReceiptText, UserRound } from "lucide-react";
import { dispatchCustomerBootstrapInvalidation } from "@/components/storefront/customer-bootstrap-events";

type MenuCustomer = {
  name: string;
  email: string;
  balance?: { available?: number } | null;
  profile?: { avatarUrl?: string } | null;
};

function initialsFor(customer: MenuCustomer) {
  const words = customer.name.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return `${words[0][0]}${words.at(-1)?.[0] ?? ""}`.toUpperCase();
  if (words[0]) return words[0].slice(0, 2).toUpperCase();
  return customer.email.slice(0, 2).toUpperCase();
}

/**
 * Signed-in avatar menu: account center, credit ledger, receipts, sign out.
 *
 * `surface="workspace"` borrows the workspace CSS variables (`--surface`,
 * `--line`, `--ink`, `--muted`, `--canvas`) so the panel follows the workspace
 * light/dark switch without duplicating its palette. `surface="storefront"`
 * uses the storefront header tones.
 */
export function CustomerAccountMenu({
  accountHref,
  creditsHref,
  customer,
  logoutHref,
  onSignOut,
  receiptsHref,
  redirectHref,
  showName = false,
  siteId,
  surface = "storefront",
  tone = "dark",
  align = "right",
  workspaceHref
}: {
  accountHref: string;
  creditsHref: string;
  customer: MenuCustomer;
  logoutHref?: string;
  onSignOut?: () => Promise<void> | void;
  receiptsHref?: string;
  redirectHref?: string;
  /** Show the customer's name beside the avatar (public storefront header). */
  showName?: boolean;
  siteId: string;
  surface?: "storefront" | "workspace";
  tone?: "light" | "dark";
  align?: "left" | "right";
  workspaceHref?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const initials = initialsFor(customer);
  const workspace = surface === "workspace";

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function signOut() {
    if (pending) return;
    setPending(true);
    if (onSignOut) {
      try {
        await onSignOut();
      } catch {
        setPending(false);
      }
      return;
    }
    dispatchCustomerBootstrapInvalidation({ reason: "logout" });
    const body = new FormData();
    body.set("siteId", siteId);
    await fetch(logoutHref ?? `/api/sites/${siteId}/auth/logout`, { body, credentials: "same-origin", method: "POST" }).catch(() => undefined);
    window.location.replace(redirectHref ?? "/login");
  }

  const triggerClass = workspace
    ? "flex items-center gap-2 rounded-full border py-1 pl-1 pr-2 text-left transition hover:opacity-90"
    : tone === "dark"
      ? "flex items-center gap-1.5 rounded-full border border-white/18 bg-white/[0.04] py-1 pl-1 pr-2 text-left text-white transition hover:border-white/32 hover:bg-white/[0.09]"
      : "flex items-center gap-1.5 rounded-full border border-[#dfd3c4] bg-white py-1 pl-1 pr-2 text-left text-[#171514] transition hover:border-[#bdb0f0]";
  const triggerStyle = workspace
    ? { background: "var(--surface)", borderColor: "var(--line)", color: "var(--ink)" }
    : undefined;
  const avatarClass = "grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full text-[11px] font-bold";
  const avatarStyle = workspace
    ? { background: "var(--purple)", color: "#fff" }
    : { background: "linear-gradient(150deg, #7d5cff, #f26ab4)", color: "#fff" };

  const panelClass = workspace
    ? "absolute top-[calc(100%+8px)] z-[140] w-[272px] overflow-hidden rounded-[10px] border shadow-2xl"
    : `absolute top-[calc(100%+8px)] z-[190] w-[272px] overflow-hidden rounded-[12px] border shadow-2xl ${tone === "dark" ? "border-white/12 bg-[#0b0f17] text-white" : "border-[#e0d5c6] bg-[#fffaf3] text-[#171514]"}`;
  const panelStyle = workspace
    ? { background: "var(--surface)", borderColor: "var(--line)", color: "var(--ink)" }
    : undefined;
  const headClass = workspace
    ? "border-b px-4 py-3"
    : `border-b px-4 py-3 ${tone === "dark" ? "border-white/10" : "border-[#e8ddce]"}`;
  const headStyle = workspace ? { borderColor: "var(--line)" } : undefined;
  const mutedStyle = workspace ? { color: "var(--muted)" } : undefined;
  const mutedClass = workspace ? "text-[12px]" : `text-[12px] ${tone === "dark" ? "text-white/60" : "text-[#706961]"}`;
  const itemClass = workspace
    ? "flex w-full items-center gap-2.5 border-0 bg-transparent px-4 py-2.5 text-left text-[13.5px] transition"
    : `flex w-full items-center gap-2.5 border-0 bg-transparent px-4 py-2.5 text-left text-[13.5px] transition ${tone === "dark" ? "text-white/86 hover:bg-white/[0.07]" : "text-[#2b2830] hover:bg-black/[0.04]"}`;
  const itemStyle = workspace ? { color: "var(--ink)" } : undefined;
  const dividerClass = workspace ? "border-t" : `border-t ${tone === "dark" ? "border-white/10" : "border-[#e8ddce]"}`;
  const dividerStyle = workspace ? { borderColor: "var(--line)" } : undefined;

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account menu for ${customer.name || customer.email}`}
        className={triggerClass}
        onClick={() => setOpen((current) => !current)}
        style={triggerStyle}
        type="button"
      >
        <span className={avatarClass} style={avatarStyle}>
          {customer.profile?.avatarUrl ? (
            <img alt="" className="h-full w-full object-cover" src={customer.profile.avatarUrl} />
          ) : (
            initials
          )}
        </span>
        {showName ? (
          <span className="hidden max-w-[9rem] truncate pl-1.5 pr-0.5 text-[13px] font-semibold sm:block">
            {customer.name || customer.email.split("@")[0]}
          </span>
        ) : null}
        <svg aria-hidden="true" className={`h-3.5 w-3.5 shrink-0 transition ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div
          aria-label="Account menu"
          className={`${panelClass} ${align === "right" ? "right-0" : "left-0"}`}
          role="menu"
          style={panelStyle}
        >
          <div className={headClass} style={headStyle}>
            <strong className="block truncate text-[13.5px] font-semibold">{customer.name}</strong>
            <span className={`mt-0.5 block truncate ${mutedClass}`} style={mutedStyle}>{customer.email}</span>
          </div>
          <a className={itemClass} href={accountHref} onClick={() => setOpen(false)} role="menuitem" style={itemStyle}>
            <UserRound aria-hidden="true" className="h-4 w-4 opacity-70" strokeWidth={1.8} />
            My account
          </a>
          <a className={itemClass} href={creditsHref} onClick={() => setOpen(false)} role="menuitem" style={itemStyle}>
            <CreditCard aria-hidden="true" className="h-4 w-4 opacity-70" strokeWidth={1.8} />
            Credits &amp; billing
            <span className="ml-auto font-mono text-[11px] tabular-nums opacity-60">{customer.balance?.available ?? 0}</span>
          </a>
          {workspaceHref ? (
            <a className={itemClass} href={workspaceHref} onClick={() => setOpen(false)} role="menuitem" style={itemStyle}>
              <LayoutDashboard aria-hidden="true" className="h-4 w-4 opacity-70" strokeWidth={1.8} />
              Open workspace
            </a>
          ) : null}
          {receiptsHref ? (
            <a className={itemClass} href={receiptsHref} onClick={() => setOpen(false)} role="menuitem" style={itemStyle}>
              <ReceiptText aria-hidden="true" className="h-4 w-4 opacity-70" strokeWidth={1.8} />
              Receipts
            </a>
          ) : null}
          <button
            className={`${itemClass} ${dividerClass} ${workspace ? "" : tone === "dark" ? "text-[#ff9d90]" : "text-[#b23a2c]"}`}
            disabled={pending}
            onClick={() => void signOut()}
            role="menuitem"
            style={dividerStyle}
            type="button"
          >
            <LogOut aria-hidden="true" className="h-4 w-4 opacity-80" strokeWidth={1.8} />
            {pending ? "Signing out…" : "Sign out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
