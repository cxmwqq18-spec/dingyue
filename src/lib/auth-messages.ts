export type AuthScope = "platform" | "site_admin" | "customer";

const defaultMessages: Record<AuthScope, string> = {
  platform: "请输入账号和密码后登录。",
  site_admin: "请输入账号和密码后登录。",
  customer: "请输入邮箱和密码后进入当前站点。"
};

const authMessageMap: Record<string, string> = {
  invalid_platform_credentials: "平台管理员账号或密码错误。",
  invalid_site_admin_credentials: "站点管理员账号或密码错误。",
  invalid_customer_credentials: "客户账号或密码错误。",
  missing_email_or_password: "请输入完整的账号和密码。",
  invalid_email: "邮箱格式不正确。",
  password_min_6_chars: "密码至少需要 6 位。",
  site_not_found: "当前站点不存在或已经被移除。",
  platform_login_failed: "平台登录失败，请稍后重试。",
  site_admin_login_failed: "站点后台登录失败，请稍后重试。",
  customer_login_failed: "客户登录失败，请稍后重试。"
};

export function authMessageForCode(scope: AuthScope, code?: string): string {
  if (!code) return defaultMessages[scope];
  return authMessageMap[code] ?? code.replaceAll("_", " ");
}
