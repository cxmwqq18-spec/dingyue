import "server-only";
import type { NextRequest } from "next/server";
import { getCurrentCustomerForSite } from "@/lib/api-auth";
import { requireCsrfToken } from "@/lib/security/csrf";
import { checkRateLimitOrResponse, RATE_LIMITS } from "@/lib/security/rate-limit";
import { assertWorkspaceSite } from "./store";
import { WorkspaceError } from "./types";

export async function workspaceAuth(request: NextRequest, siteId: string, mutation = false) {
  assertWorkspaceSite(siteId);
  const current = await getCurrentCustomerForSite(siteId);
  if (!current || current.customer.siteId !== siteId) throw new WorkspaceError("customer_login_required", 401);
  if (mutation) {
    // The relational session has already been checked for this request. Apply
    // the same mutation guards without hydrating the customer a second time.
    const csrf = requireCsrfToken(request, `customer:${siteId}`, current.sessionId);
    if (csrf) return { ok: false as const, response: csrf };
    const limited = checkRateLimitOrResponse(request, RATE_LIMITS.api, `${siteId}:${current.customer.id}`);
    if (!limited.allowed) return { ok: false as const, response: limited.response };
  }
  return { ok: true as const, current };
}
