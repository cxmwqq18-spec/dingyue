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
const platformSessionCache = new Map<string, SessionCacheEntry<CurrentPlatformAdmin>>();
const scopedSessionCacheTtlMs = 30_000;
const siteAdminSessionCache = new Map<string, SessionCacheEntry<CurrentSiteAdmin>>();
const customerSessionCache = new Map<string, SessionCacheEntry<CurrentCustomer>>();
const maxSessionCacheEntries = 500;
const platformSessionInflight = new Map<string, Promise<CurrentPlatformAdmin | undefined>>();
const siteAdminSessionInflight = new Map<string, Promise<CurrentSiteAdmin | undefined>>();
const customerSessionInflight = new Map<string, Promise<CurrentCustomer | undefined>>();
const platformSessionVersions = createSessionVersionState();
const siteAdminSessionVersions = createSessionVersionState();
const customerSessionVersions = createSessionVersionState();

type SessionCacheEntry<T> = {
  current: T;
  cachedAt: number;
  expiresAt: number;
};

export function clearPlatformSessionAuthCache(sessionId?: string): void {
  if (sessionId) {
    bumpSessionVersion(platformSessionVersions, sessionId);
    platformSessionCache.delete(sessionId);
    platformSessionInflight.delete(sessionId);
    return;
  }
  bumpAllSessionVersions(platformSessionVersions);
  platformSessionCache.clear();
  platformSessionInflight.clear();
}

export function clearSiteAdminSessionAuthCache(siteId?: string, sessionId?: string): void {
  if (siteId && sessionId) {
    const cacheKey = scopedSessionKey(siteId, sessionId);
    bumpSessionVersion(siteAdminSessionVersions, cacheKey);
    siteAdminSessionCache.delete(cacheKey);
    siteAdminSessionInflight.delete(cacheKey);
    return;
  }
  bumpAllSessionVersions(siteAdminSessionVersions);
  siteAdminSessionCache.clear();
  siteAdminSessionInflight.clear();
}

export function primeSiteAdminSessionAuthCache(current: CurrentSiteAdmin): void {
  setSessionCache(siteAdminSessionCache, scopedSessionKey(current.session.siteId, current.sessionId), current, scopedSessionCacheTtlMs);
}

export function clearCustomerSessionAuthCache(siteId?: string, customerId?: string, sessionId?: string): void {
  if (siteId && customerId && sessionId) {
    const cacheKey = scopedSessionKey(siteId, sessionId, customerId);
    bumpSessionVersion(customerSessionVersions, cacheKey);
    customerSessionCache.delete(cacheKey);
    customerSessionInflight.delete(cacheKey);
    return;
  }
  if (siteId && customerId) {
    const prefix = `${siteId}:`;
    const affectedSessionIds = new Set<string>();
    for (const [key, entry] of customerSessionCache.entries()) {
      if (key.startsWith(prefix) && entry.current.customer.id === customerId) {
        affectedSessionIds.add(entry.current.sessionId);
        bumpSessionVersion(customerSessionVersions, key);
        customerSessionCache.delete(key);
      }
    }
    for (const sessionId of affectedSessionIds) {
      for (const key of [scopedSessionKey(siteId, sessionId, "current"), scopedSessionKey(siteId, sessionId, customerId)]) {
        bumpSessionVersion(customerSessionVersions, key);
        customerSessionCache.delete(key);
        customerSessionInflight.delete(key);
      }
    }
    for (const key of customerSessionInflight.keys()) {
      if (key.startsWith(prefix) && key.endsWith(`:${customerId}`)) {
        bumpSessionVersion(customerSessionVersions, key);
        customerSessionInflight.delete(key);
      }
    }
    return;
  }
  if (siteId && sessionId) {
    const prefix = `${siteId}:${sessionId}:`;
    for (const key of customerSessionCache.keys()) {
      if (key.startsWith(prefix)) {
        bumpSessionVersion(customerSessionVersions, key);
        customerSessionCache.delete(key);
      }
    }
    for (const key of customerSessionInflight.keys()) {
      if (key.startsWith(prefix)) {
        bumpSessionVersion(customerSessionVersions, key);
        customerSessionInflight.delete(key);
      }
    }
    return;
  }
  bumpAllSessionVersions(customerSessionVersions);
  customerSessionCache.clear();
  customerSessionInflight.clear();
}

export function primeCustomerSessionAuthCache(current: CurrentCustomer): void {
  setSessionCache(customerSessionCache, scopedSessionKey(current.session.siteId, current.sessionId, "current"), current, scopedSessionCacheTtlMs);
  setSessionCache(customerSessionCache, scopedSessionKey(current.session.siteId, current.sessionId, current.customer.id), current, scopedSessionCacheTtlMs);
}

function scopedSessionKey(siteId: string, sessionId: string, extra?: string): string {
  return extra ? `${siteId}:${sessionId}:${extra}` : `${siteId}:${sessionId}`;
}

function sessionExpiresAt(session: PlatformSession | SiteAdminSession | CustomerSession): number {
  const expiresAt = Date.parse(session.expiresAt);
  return Number.isFinite(expiresAt) ? expiresAt : 0;
}

type SessionVersionState = {
  global: number;
  keys: Map<string, number>;
};

function createSessionVersionState(): SessionVersionState {
  return { global: 0, keys: new Map() };
}

function readSessionVersion(state: SessionVersionState, key: string) {
  return { global: state.global, key: state.keys.get(key) ?? 0 };
}

function isSessionVersionCurrent(state: SessionVersionState, key: string, version: ReturnType<typeof readSessionVersion>): boolean {
  return state.global === version.global && (state.keys.get(key) ?? 0) === version.key;
}

function bumpSessionVersion(state: SessionVersionState, key: string): void {
  state.keys.set(key, (state.keys.get(key) ?? 0) + 1);
}

function bumpAllSessionVersions(state: SessionVersionState): void {
  state.global += 1;
  state.keys.clear();
}

function isFresh<T>(cached: SessionCacheEntry<T> | undefined, ttlMs: number): cached is SessionCacheEntry<T> {
  if (!cached) return false;
  const now = Date.now();
  return now < cached.expiresAt && now - cached.cachedAt < ttlMs;
}

function pruneSessionCache<T>(store: Map<string, SessionCacheEntry<T>>, now = Date.now()): void {
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key);
  }
  while (store.size > maxSessionCacheEntries) {
    const first = store.keys().next().value;
    if (!first) break;
    store.delete(first);
  }
}

function setSessionCache<T extends { session: PlatformSession | SiteAdminSession | CustomerSession }>(
  store: Map<string, SessionCacheEntry<T>>,
  key: string,
  current: T,
  ttlMs: number
): void {
  const now = Date.now();
  const expiresAt = Math.min(sessionExpiresAt(current.session), now + ttlMs);
  if (expiresAt <= now) return;
  store.set(key, { current, cachedAt: now, expiresAt });
  pruneSessionCache(store, now);
}

function reuseInflight<T>(store: Map<string, Promise<T>>, key: string, loader: () => Promise<T>): Promise<T> {
  const inflight = store.get(key);
  if (inflight) return inflight;
  const promise = loader().finally(() => {
    if (store.get(key) === promise) store.delete(key);
  });
  store.set(key, promise);
  return promise;
}

export async function hasPlatformSession(): Promise<boolean> {
  return Boolean(await getCurrentPlatformAdmin());
}

export async function getCurrentPlatformAdmin(): Promise<CurrentPlatformAdmin | undefined> {
  const sessionId = (await cookies()).get(platformSessionCookie())?.value;
  if (!sessionId) return undefined;
  const cached = platformSessionCache.get(sessionId);
  if (isFresh(cached, platformSessionCacheTtlMs)) return cached.current;
  return reuseInflight(platformSessionInflight, sessionId, async () => {
    const version = readSessionVersion(platformSessionVersions, sessionId);
    const freshCached = platformSessionCache.get(sessionId);
    if (isFresh(freshCached, platformSessionCacheTtlMs)) return freshCached.current;
    const relational = await getPlatformAdminBySessionRelational(sessionId);
    if (relational) {
      const current = { platformAdmin: relational.platformAdmin, session: relational.session, sessionId: relational.session.id };
      if (isSessionVersionCurrent(platformSessionVersions, sessionId, version)) {
        setSessionCache(platformSessionCache, sessionId, current, platformSessionCacheTtlMs);
      }
      return current;
    }
    return undefined;
  });
}

export async function getCurrentSiteAdmin(siteId: string): Promise<CurrentSiteAdmin | undefined> {
  const sessionId = (await cookies()).get(siteAdminSessionCookie(siteId))?.value;
  if (!sessionId) return undefined;
  const cacheKey = scopedSessionKey(siteId, sessionId);
  const cached = siteAdminSessionCache.get(cacheKey);
  if (isFresh(cached, scopedSessionCacheTtlMs)) return cached.current;
  return reuseInflight(siteAdminSessionInflight, cacheKey, async () => {
    const version = readSessionVersion(siteAdminSessionVersions, cacheKey);
    const freshCached = siteAdminSessionCache.get(cacheKey);
    if (isFresh(freshCached, scopedSessionCacheTtlMs)) return freshCached.current;
    const relational = await getSiteAdminBySessionRelational({ siteId, sessionId });
    if (relational) {
      const current = { siteAdmin: relational.siteAdmin, session: relational.session, sessionId: relational.session.id };
      if (isSessionVersionCurrent(siteAdminSessionVersions, cacheKey, version)) {
        setSessionCache(siteAdminSessionCache, cacheKey, current, scopedSessionCacheTtlMs);
      }
      return current;
    }
    return undefined;
  });
}

export async function getCurrentCustomer(siteId: string, customerId: string): Promise<CurrentCustomer | undefined> {
  const sessionId = (await cookies()).get(customerSessionCookie(siteId))?.value;
  if (!sessionId) return undefined;
  const cacheKey = scopedSessionKey(siteId, sessionId, customerId);
  const cached = customerSessionCache.get(cacheKey);
  if (isFresh(cached, scopedSessionCacheTtlMs)) return cached.current;
  return reuseInflight(customerSessionInflight, cacheKey, async () => {
    const version = readSessionVersion(customerSessionVersions, cacheKey);
    const freshCached = customerSessionCache.get(cacheKey);
    if (isFresh(freshCached, scopedSessionCacheTtlMs)) return freshCached.current;
    const relational = await getCustomerBySessionRelational({ siteId, sessionId });
    if (relational?.customer.id === customerId) {
      const current = { customer: relational.customer, session: relational.session, sessionId: relational.session.id };
      if (isSessionVersionCurrent(customerSessionVersions, cacheKey, version)) {
        setSessionCache(customerSessionCache, cacheKey, current, scopedSessionCacheTtlMs);
      }
      return current;
    }
    return undefined;
  });
}

export async function getCurrentCustomerForSite(siteId: string): Promise<CurrentCustomer | undefined> {
  const sessionId = (await cookies()).get(customerSessionCookie(siteId))?.value;
  if (!sessionId) return undefined;
  const cacheKey = scopedSessionKey(siteId, sessionId, "current");
  const cached = customerSessionCache.get(cacheKey);
  if (isFresh(cached, scopedSessionCacheTtlMs)) return cached.current;
  return reuseInflight(customerSessionInflight, cacheKey, async () => {
    const version = readSessionVersion(customerSessionVersions, cacheKey);
    const customerSpecificVersion = (customerId: string) => readSessionVersion(customerSessionVersions, scopedSessionKey(siteId, sessionId, customerId));
    const freshCached = customerSessionCache.get(cacheKey);
    if (isFresh(freshCached, scopedSessionCacheTtlMs)) return freshCached.current;
    const relational = await getCustomerBySessionRelational({ siteId, sessionId });
    if (relational) {
      const current = { customer: relational.customer, session: relational.session, sessionId: relational.session.id };
      const customerCacheKey = scopedSessionKey(siteId, sessionId, relational.customer.id);
      const specificVersion = customerSpecificVersion(relational.customer.id);
      if (isSessionVersionCurrent(customerSessionVersions, cacheKey, version)) {
        setSessionCache(customerSessionCache, cacheKey, current, scopedSessionCacheTtlMs);
      }
      if (isSessionVersionCurrent(customerSessionVersions, customerCacheKey, specificVersion)) {
        setSessionCache(customerSessionCache, customerCacheKey, current, scopedSessionCacheTtlMs);
      }
      return current;
    }
    return undefined;
  });
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
