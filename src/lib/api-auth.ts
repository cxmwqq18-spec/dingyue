import { cookies } from "next/headers";
import { customerSessionCookie, platformSessionCookie, siteAdminSessionCookie } from "@/lib/session";
import { requireCsrfToken } from "@/lib/security/csrf";
import { checkRateLimitOrResponse, RATE_LIMITS, type RateLimitConfig } from "@/lib/security/rate-limit";
import { getCustomerBySessionRelational } from "@/lib/stores/customer-store";
import { getPlatformAdminBySessionRelational } from "@/lib/stores/platform-store";
import { getSiteAdminBySessionRelational } from "@/lib/stores/site-store";
import { NextRequest, NextResponse } from "next/server";
import type { CustomerSession, PlatformAdmin, PlatformSession, PublicCustomer, SiteAdmin, SiteAdminSession } from "@/lib/types";

export type CurrentPlatformAdmin = { platformAdmin: PlatformAdmin; session: PlatformSession; sessionId: string };
export type CurrentSiteAdmin = { siteAdmin: SiteAdmin; session: SiteAdminSession; sessionId: string };
export type CurrentCustomer = { customer: PublicCustomer; session: CustomerSession; sessionId: string };

const platformSessionCacheTtlMs = 30_000;
const platformSessionCache = new Map<string, { current: CurrentPlatformAdmin; cachedAt: number }>();
const scopedSessionCacheTtlMs = 30_000;
const siteAdminSessionCache = new Map<string, { current: CurrentSiteAdmin; cachedAt: number }>();
const customerSessionCache = new Map<string, { current: CurrentCustomer; cachedAt: number }>();

export function clearPlatformSessionAuthCache(sessionId?: string): void {
  if (sessionId) {
    platformSessionCache.delete(sessionId);
    return;
  }
  platformSessionCache.clear();
}

export function clearSiteAdminSessionAuthCache(siteId?: string, sessionId?: string): void {
  if (siteId && sessionId) {
    siteAdminSessionCache.delete(scopedSessionKey(siteId, sessionId));
    return;
  }
  siteAdminSessionCache.clear();
}

export function primeSiteAdminSessionAuthCache(current: CurrentSiteAdmin): void {
  siteAdminSessionCache.set(scopedSessionKey(current.session.siteId, current.sessionId), { current, cachedAt: Date.now() });
}

export function clearCustomerSessionAuthCache(siteId?: string, customerId?: string, sessionId?: string): void {
  if (siteId && customerId && sessionId) {
    customerSessionCache.delete(scopedSessionKey(siteId, sessionId, customerId));
    return;
  }
  if (siteId && sessionId) {
    const prefix = `${siteId}:${sessionId}:`;
    for (const key of customerSessionCache.keys()) {
      if (key.startsWith(prefix)) customerSessionCache.delete(key);
    }
    return;
  }
  customerSessionCache.clear();
}

function scopedSessionKey(siteId: string, sessionId: string, extra?: string): string {
  return extra ? `${siteId}:${sessionId}:${extra}` : `${siteId}:${sessionId}`;
}

function isFresh(cachedAt: number, ttlMs: number): boolean {
  return Date.now() - cachedAt < ttlMs;
}

export async function hasPlatformSession(): Promise<boolean> {
  const sessionId = (await cookies()).get(platformSessionCookie())?.value;
  if (!sessionId) return false;
  const cached = platformSessionCache.get(sessionId);
  if (cached && Date.now() - cached.cachedAt < platformSessionCacheTtlMs) return true;
  return Boolean(await getPlatformAdminBySessionRelational(sessionId));
}

export async function getCurrentPlatformAdmin(): Promise<CurrentPlatformAdmin | undefined> {
  const sessionId = (await cookies()).get(platformSessionCookie())?.value;
  if (!sessionId) return undefined;
  const cached = platformSessionCache.get(sessionId);
  if (cached && Date.now() - cached.cachedAt < platformSessionCacheTtlMs) return cached.current;
  const relational = await getPlatformAdminBySessionRelational(sessionId);
  if (relational) {
    const current = { platformAdmin: relational.platformAdmin, session: relational.session, sessionId: relational.session.id };
    platformSessionCache.set(sessionId, { current, cachedAt: Date.now() });
    return current;
  }
  return undefined;
}

export async function getCurrentSiteAdmin(siteId: string): Promise<CurrentSiteAdmin | undefined> {
  const sessionId = (await cookies()).get(siteAdminSessionCookie(siteId))?.value;
  if (!sessionId) return undefined;
  const cacheKey = scopedSessionKey(siteId, sessionId);
  const cached = siteAdminSessionCache.get(cacheKey);
  if (cached && isFresh(cached.cachedAt, scopedSessionCacheTtlMs)) return cached.current;
  const relational = await getSiteAdminBySessionRelational({ siteId, sessionId });
  if (relational) {
    const current = { siteAdmin: relational.siteAdmin, session: relational.session, sessionId: relational.session.id };
    siteAdminSessionCache.set(cacheKey, { current, cachedAt: Date.now() });
    return current;
  }
  return undefined;
}

export async function getCurrentCustomer(siteId: string, customerId: string): Promise<CurrentCustomer | undefined> {
  const sessionId = (await cookies()).get(customerSessionCookie(siteId))?.value;
  if (!sessionId) return undefined;
  const cacheKey = scopedSessionKey(siteId, sessionId, customerId);
  const cached = customerSessionCache.get(cacheKey);
  if (cached && isFresh(cached.cachedAt, scopedSessionCacheTtlMs)) return cached.current;
  const relational = await getCustomerBySessionRelational({ siteId, sessionId });
  if (relational?.customer.id === customerId) {
    const current = { customer: relational.customer, session: relational.session, sessionId: relational.session.id };
    customerSessionCache.set(cacheKey, { current, cachedAt: Date.now() });
    return current;
  }
  return undefined;
}

export async function getCurrentCustomerForSite(siteId: string): Promise<CurrentCustomer | undefined> {
  const sessionId = (await cookies()).get(customerSessionCookie(siteId))?.value;
  if (!sessionId) return undefined;
  const cacheKey = scopedSessionKey(siteId, sessionId, "current");
  const cached = customerSessionCache.get(cacheKey);
  if (cached && isFresh(cached.cachedAt, scopedSessionCacheTtlMs)) return cached.current;
  const relational = await getCustomerBySessionRelational({ siteId, sessionId });
  if (relational) {
    const current = { customer: relational.customer, session: relational.session, sessionId: relational.session.id };
    customerSessionCache.set(cacheKey, { current, cachedAt: Date.now() });
    customerSessionCache.set(scopedSessionKey(siteId, sessionId, relational.customer.id), { current, cachedAt: Date.now() });
    return current;
  }
  return undefined;
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
