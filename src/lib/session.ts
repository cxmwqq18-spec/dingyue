export function platformSessionCookie(): string {
  return "platform_session";
}

export function siteAdminSessionCookie(siteId: string): string {
  return `site_admin_session_${siteId}`;
}

export function customerSessionCookie(siteId: string): string {
  return `customer_session_${siteId}`;
}
