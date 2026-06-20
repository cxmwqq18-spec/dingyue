import { cookies } from "next/headers";
import {
  getCustomerBySessionFromState,
  getPlatformAdminBySessionFromState,
  getSiteAdminBySessionFromState,
  readPlatformState
} from "@/lib/server-store";
import { customerSessionCookie, platformSessionCookie, siteAdminSessionCookie } from "@/lib/session";

export async function hasPlatformSession(): Promise<boolean> {
  const state = readPlatformState();
  const sessionId = (await cookies()).get(platformSessionCookie())?.value;
  return Boolean(getPlatformAdminBySessionFromState(state, sessionId));
}

export async function hasSiteAdminSession(siteId: string): Promise<boolean> {
  const state = readPlatformState();
  const sessionId = (await cookies()).get(siteAdminSessionCookie(siteId))?.value;
  return Boolean(getSiteAdminBySessionFromState(state, siteId, sessionId));
}

export async function hasCustomerSession(siteId: string, customerId: string): Promise<boolean> {
  const state = readPlatformState();
  const sessionId = (await cookies()).get(customerSessionCookie(siteId))?.value;
  const current = getCustomerBySessionFromState(state, siteId, sessionId);
  return current?.customer.id === customerId;
}
