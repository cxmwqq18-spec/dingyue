export function platformSessionCookie(): string {
  return "platform_session";
}

export function siteAdminSessionCookie(siteId: string): string {
  return `site_admin_session_${siteId}`;
}

export function customerSessionCookie(siteId: string): string {
  return `customer_session_${siteId}`;
}

export function shouldUseSecureCookie(request?: Request): boolean {
  if (!request) return process.env.NODE_ENV === "production";
  const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "").split(",")[0]?.trim().toLowerCase();
  const hostname = host.split(":")[0] ?? "";
  if (hostname === "localhost" || hostname === "127.0.0.1" || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) {
    return false;
  }

  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  if (forwardedProto) return forwardedProto === "https";

  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return process.env.NODE_ENV === "production";
  }
}
