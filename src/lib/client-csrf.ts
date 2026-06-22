export function csrfHeader(cookieName: string): Record<string, string> {
  if (typeof document === "undefined") return {};
  const token = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
    ?.split("=")
    .slice(1)
    .join("=");
  return token ? { "x-csrf-token": decodeURIComponent(token) } : {};
}

export function jsonHeaders(cookieName: string, headers: HeadersInit = {}): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...csrfHeader(cookieName),
    ...headers
  };
}

export function platformJsonHeaders(headers: HeadersInit = {}): HeadersInit {
  return jsonHeaders("platform_csrf", headers);
}

export function siteAdminJsonHeaders(siteId: string, headers: HeadersInit = {}): HeadersInit {
  return jsonHeaders(`site_admin_csrf_${siteId}`, headers);
}

export function customerJsonHeaders(siteId: string, headers: HeadersInit = {}): HeadersInit {
  return jsonHeaders(`customer_csrf_${siteId}`, headers);
}
