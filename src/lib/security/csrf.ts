import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

export type CsrfScope = "platform" | `site-admin:${string}` | `customer:${string}`;

const csrfSecret = process.env.CSRF_SECRET || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "dev-csrf-secret-change-me";

export function csrfCookieName(scope: CsrfScope): string {
  if (scope === "platform") return "platform_csrf";
  if (scope.startsWith("site-admin:")) return `site_admin_csrf_${scope.slice("site-admin:".length)}`;
  return `customer_csrf_${scope.slice("customer:".length)}`;
}

function sign(scope: CsrfScope, sessionId: string, nonce: string): string {
  return crypto.createHmac("sha256", csrfSecret).update(`${scope}:${sessionId}:${nonce}`).digest("base64url");
}

export function createCsrfToken(scope: CsrfScope, sessionId: string): string {
  const nonce = crypto.randomBytes(24).toString("base64url");
  return `${nonce}.${sign(scope, sessionId, nonce)}`;
}

export function verifyCsrfToken(scope: CsrfScope, sessionId: string, token?: string): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [nonce, mac] = parts;
  if (!nonce || !mac) return false;
  const expected = sign(scope, sessionId, nonce);
  const actualBuffer = Buffer.from(mac);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

export function setCsrfCookie(response: NextResponse, scope: CsrfScope, sessionId: string, expiresAt: string): string {
  const token = createCsrfToken(scope, sessionId);
  response.cookies.set(csrfCookieName(scope), token, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt)
  });
  return token;
}

export function requireCsrfToken(request: NextRequest, scope: CsrfScope, sessionId: string): NextResponse | undefined {
  const cookieToken = request.cookies.get(csrfCookieName(scope))?.value;
  const headerToken = request.headers.get("x-csrf-token") || request.headers.get("x-xsrf-token");
  if (!cookieToken || !headerToken) {
    return NextResponse.json({ error: "csrf_token_required" }, { status: 403 });
  }
  if (cookieToken !== headerToken || !verifyCsrfToken(scope, sessionId, cookieToken)) {
    return NextResponse.json({ error: "csrf_token_mismatch" }, { status: 403 });
  }
  return undefined;
}
