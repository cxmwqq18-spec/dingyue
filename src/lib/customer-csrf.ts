import { csrfCookieName, setCsrfCookie, verifyCsrfToken, type CsrfScope } from "@/lib/security/csrf";
import type { NextRequest, NextResponse } from "next/server";

type CustomerCsrfSession = {
  sessionId: string;
  session: {
    expiresAt: string;
  };
};

export function ensureCustomerCsrfCookie(
  response: NextResponse,
  request: NextRequest,
  siteId: string,
  current: CustomerCsrfSession
): NextResponse {
  const scope = `customer:${siteId}` as CsrfScope;
  const existingToken = request.cookies.get(csrfCookieName(scope))?.value;
  if (!verifyCsrfToken(scope, current.sessionId, existingToken)) {
    setCsrfCookie(response, scope, current.sessionId, current.session.expiresAt, request);
  }
  return response;
}
