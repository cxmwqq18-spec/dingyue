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
  missing_email: "请输入邮箱地址。",
  missing_email_or_code: "请输入邮箱和验证码。",
  missing_email_or_password: "请输入完整的账号和密码。",
  invalid_email: "邮箱格式不正确。",
  invalid_verification_code: "验证码不正确，请检查后重试。",
  verification_code_expired: "验证码已过期，请重新发送。",
  customer_already_exists: "该邮箱已注册，请直接登录。",
  customer_not_found_for_site: "未找到该邮箱对应的客户账号。",
  email_code_send_failed: "验证码邮件发送失败，请稍后重试。",
  email_code_verify_failed: "邮箱验证码验证失败，请稍后重试。",
  email_provider_not_configured: "邮件服务还未配置完成，无法发送验证码。",
  resend_invalid_api_key: "邮件服务 API Key 无效。",
  resend_domain_not_verified: "邮件发送域名尚未验证。",
  resend_rate_limited: "邮件服务触发限流，请稍后重试。",
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
