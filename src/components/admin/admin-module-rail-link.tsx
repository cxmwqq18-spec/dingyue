"use client";

import { type ReactNode } from "react";
import type { AdminModuleCode } from "@/lib/admin-menu";
import { AdminInstantLink } from "@/components/admin/admin-instant-link";
import { useAdminNavigationSnapshot } from "@/components/admin/admin-navigation-feedback";

type AdminModuleRailLinkProps = {
  activeClassName: string;
  baseClassName: string;
  children: ReactNode;
  href: string;
  inactiveClassName: string;
  isActive: boolean;
  moduleCode: AdminModuleCode;
  moduleHref: string;
  siteSlug?: string;
};

export function AdminModuleRailLink({
  activeClassName,
  baseClassName,
  children,
  href,
  inactiveClassName,
  isActive,
  moduleCode,
  moduleHref,
  siteSlug
}: AdminModuleRailLinkProps) {
  const pendingHref = useAdminNavigationSnapshot().href;
  const active = pendingHref ? pendingHrefBelongsToModule(pendingHref, moduleCode, moduleHref, siteSlug) : isActive;

  return (
    <AdminInstantLink
      className={`${baseClassName} ${active ? activeClassName : inactiveClassName}`}
      href={href}
      prefetch={false}
    >
      {children}
    </AdminInstantLink>
  );
}

function pendingHrefBelongsToModule(href: string, moduleCode: AdminModuleCode, moduleHref: string, siteSlug?: string): boolean {
  const targetPath = normalizeAdminHref(href, siteSlug);
  const modulePath = normalizeAdminHref(moduleHref, siteSlug);
  if (targetPath === modulePath) return true;
  if (moduleCode === "overview") return targetPath === "/admin";
  if (modulePath !== "/admin" && targetPath.startsWith(`${modulePath}/`)) return true;
  return false;
}

function normalizeAdminHref(href: string, siteSlug?: string): string {
  const url = new URL(href, "http://admin.local");
  let pathname = url.pathname.replace(/\/$/, "") || "/";
  if (siteSlug) pathname = pathname.replace(new RegExp(`^/site/${escapeRegExp(siteSlug)}`), "");
  if (pathname === "/platform") {
    const moduleParam = url.searchParams.get("module");
    return moduleParam ? `${pathname}?module=${moduleParam}` : pathname;
  }
  return pathname || "/";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
