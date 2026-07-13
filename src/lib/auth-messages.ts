export type AuthScope = "platform" | "site_admin" | "customer";

const defaultMessages: Record<AuthScope, string> = {
  platform: "请输入账号和密码后登录。",
  site_admin: "请输入账号和密码后登录。",
  customer: "Enter your email and password to open this site."
};

const authMessageMap: Record<string, string> = {
  invalid_platform_credentials: "平台管理员账号或密码错误。",
  invalid_site_admin_credentials: "站点管理员账号或密码错误。",
  invalid_customer_credentials: "The customer email or password is incorrect.",
  missing_email: "Enter your email address.",
  missing_email_or_code: "Enter your email and verification code.",
  missing_email_or_password: "Enter both your email and password.",
  invalid_email: "Enter a valid email address.",
  invalid_verification_code: "The verification code is incorrect. Please check it and try again.",
  verification_code_expired: "This verification code has expired. Please send a new one.",
  customer_already_exists: "This email is already registered. Please sign in instead.",
  customer_not_found_for_site: "No customer account was found for this email on this site.",
  email_code_send_failed: "We could not send the verification email. Please try again.",
  email_code_verify_failed: "We could not verify the email code. Please try again.",
  email_provider_not_configured: "Email delivery is not fully configured, so codes cannot be sent yet.",
  resend_invalid_api_key: "The email service API key is invalid.",
  resend_domain_not_verified: "The email sending domain has not been verified.",
  resend_rate_limited: "The email service is rate limited. Please try again later.",
  rate_limited: "Please wait before trying again.",
  password_min_6_chars: "Password must be at least 6 characters.",
  password_required: "Enter a password.",
  password_complexity_required: "Password must be at least 6 characters.",
  password_confirmation_required: "Enter the password again to confirm it.",
  password_confirmation_mismatch: "The two passwords do not match.",
  site_not_found: "This site does not exist or has been removed.",
  platform_login_failed: "平台登录失败，请稍后重试。",
  site_admin_login_failed: "站点后台登录失败，请稍后重试。",
  customer_login_failed: "Customer sign-in failed. Please try again."
};

export function authMessageForCode(scope: AuthScope, code?: string): string {
  if (!code) return defaultMessages[scope];
  return authMessageMap[code] ?? code.replaceAll("_", " ");
}
