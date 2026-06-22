import { cookies } from "next/headers";
import {
  getCustomerBySessionFromState,
  getPlatformAdminBySessionFromState,
  getSiteAdminBySessionFromState,
  readPlatformState
} from "@/lib/server-store";
import { customerSessionCookie, platformSessionCookie, siteAdminSessionCookie } from "@/lib/session";
import { requireCsrfToken } from "@/lib/security/csrf";
import { checkRateLimitOrResponse, RATE_LIMITS, type RateLimitConfig } from "@/lib/security/rate-limit";
import { getCustomerBySessionRelational } from "@/lib/stores/customer-store";
import { getPlatformAdminBySessionRelational } from "@/lib/stores/platform-store";
import { getSiteAdminBySessionRelational } from "@/lib/stores/site-store";
import { NextRequest, NextResponse } from "next/server";
import type { PlatformAdmin, PublicCustomer, SiteAdmin } from "@/lib/types";

export type CurrentPlatformAdmin = { platformAdmin: PlatformAdmin; sessionId: string };
export type CurrentSiteAdmin = { siteAdmin: SiteAdmin; sessionId: string };
export type CurrentCustomer = { customer: PublicCustomer; sessionId: string };

export async function hasPlatformSession(): Promise<boolean> {
  const sessionId = (await cookies()).get(platformSessionCookie())?.value;
  if (!sessionId) return false;
  if (await getPlatformAdminBySessionRelational(sessionId)) return true;
  const state = readPlatformState();
  return Boolean(getPlatformAdminBySessionFromState(state, sessionId));
}

export async function getCurrentPlatformAdmin(): Promise<CurrentPlatformAdmin | undefined> {
  const sessionId = (await cookies()).get(platformSessionCookie())?.value;
  if (!sessionId) return undefined;
  const relational = await getPlatformAdminBySessionRelational(sessionId);
  if (relational) return { platformAdmin: relational.platformAdmin, sessionId: relational.session.id };
  const state = readPlatformState();
  const current = getPlatformAdminBySessionFromState(state, sessionId);
  return current ? { platformAdmin: current.platformAdmin, sessionId: current.session.id } : undefined;
}

export async function getCurrentSiteAdmin(siteId: string): Promise<CurrentSiteAdmin | undefined> {
  const sessionId = (await cookies()).get(siteAdminSessionCookie(siteId))?.value;
  if (!sessionId) return undefined;
  const relational = await getSiteAdminBySessionRelational({ siteId, sessionId });
  if (relational) return { siteAdmin: relational.siteAdmin, sessionId: relational.session.id };
  const state = readPlatformState();
  const current = getSiteAdminBySessionFromState(state, siteId, sessionId);
  return current ? { siteAdmin: current.siteAdmin, sessionId: current.session.id } : undefined;
}

export async function getCurrentCustomer(siteId: string, customerId: string): Promise<CurrentCustomer | undefined> {
  const sessionId = (await cookies()).get(customerSessionCookie(siteId))?.value;
  if (!sessionId) return undefined;
  const relational = await getCustomerBySessionRelational({ siteId, sessionId });
  if (relational?.customer.id === customerId) {
    return { customer: relational.customer, sessionId: relational.session.id };
  }
  const state = readPlatformState();
  const current = getCustomerBySessionFromState(state, siteId, sessionId);
  return current?.customer.id === customerId ? { customer: current.customer, sessionId: current.session.id } : undefined;
}

export async function hasSiteAdminSession(siteId: string): Promise<boolean> {
  return Boolean(await getCurrentSiteAdmin(siteId));
}

export async function hasCustomerSession(siteId: string, customerId: string): Promise<boolean> {
  return Boolean(await getCurrentCustomer(siteId, customerId));
}

export async function requirePlatformMutation(
  request: NextRequest,
  options: { roles?: PlatformAdmin["role"][]; rateLimit?: RateLimitConfig; key?: string } = {}
): Promise<{ ok: true; current: CurrentPlatformAdmin } | { ok: false; response: NextResponse }> {
  const current = await getCurrentPlatformAdmin();
  if (!current) return { ok: false, response: NextResponse.json({ error: "platform_login_required" }, { status: 401 }) };
  if (options.roles && !options.roles.includes(current.platformAdmin.role)) {
    return { ok: false, response: NextResponse.json({ error: "platform_forbidden" }, { status: 403 }) };
  }
  const csrf = requireCsrfToken(request, "platform", current.sessionId);
  if (csrf) return { ok: false, response: csrf };
  const limited = checkRateLimitOrResponse(request, options.rateLimit ?? RATE_LIMITS.adminMutation, options.key ?? `platform:${current.platformAdmin.id}`);
  if (!limited.allowed) return { ok: false, response: limited.response };
  return { ok: true, current };
}

export async function requireSiteMutation(
  request: NextRequest,
  siteId: string,
  options: { roles?: SiteAdmin["role"][]; rateLimit?: RateLimitConfig; key?: string } = {}
): Promise<{ ok: true; current: CurrentSiteAdmin } | { ok: false; response: NextResponse }> {
  const current = await getCurrentSiteAdmin(siteId);
  if (!current) return { ok: false, response: NextResponse.json({ error: "site_admin_login_required" }, { status: 401 }) };
  if (options.roles && !options.roles.includes(current.siteAdmin.role)) {
    return { ok: false, response: NextResponse.json({ error: "site_admin_forbidden" }, { status: 403 }) };
  }
  const csrf = requireCsrfToken(request, `site-admin:${siteId}`, current.sessionId);
  if (csrf) return { ok: false, response: csrf };
  const limited = checkRateLimitOrResponse(request, options.rateLimit ?? RATE_LIMITS.adminMutation, options.key ?? `${siteId}:${current.siteAdmin.id}`);
  if (!limited.allowed) return { ok: false, response: limited.response };
  return { ok: true, current };
}

export async function requireCustomerMutation(
  request: NextRequest,
  siteId: string,
  customerId: string,
  options: { rateLimit?: RateLimitConfig; key?: string } = {}
): Promise<{ ok: true; current: CurrentCustomer } | { ok: false; response: NextResponse }> {
  const current = await getCurrentCustomer(siteId, customerId);
  if (!current) return { ok: false, response: NextResponse.json({ error: "customer_login_required" }, { status: 401 }) };
  const csrf = requireCsrfToken(request, `customer:${siteId}`, current.sessionId);
  if (csrf) return { ok: false, response: csrf };
  const limited = checkRateLimitOrResponse(request, options.rateLimit ?? RATE_LIMITS.api, options.key ?? `${siteId}:${customerId}`);
  if (!limited.allowed) return { ok: false, response: limited.response };
  return { ok: true, current };
}
