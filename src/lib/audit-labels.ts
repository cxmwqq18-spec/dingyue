export type AuditTone = "good" | "warn" | "bad" | "neutral";

export const auditToneOptions: Array<{ value: "" | AuditTone; label: string }> = [
  { value: "", label: "全部状态" },
  { value: "good", label: "正常" },
  { value: "warn", label: "待处理" },
  { value: "bad", label: "异常" },
  { value: "neutral", label: "观察" }
];

const auditEventLabels: Record<string, string> = {
  credits_adjusted: "客户积分已调整",
  internal_theme_package_installed: "内置装修包已安装",
  order_failed: "订单支付失败",
  order_fulfilled: "订单已履约",
  order_paid: "订单已支付",
  order_pending: "订单待支付",
  order_refunded: "订单已退款",
  platform_ai_provider_deleted: "平台 AI 供应商已删除",
  platform_cloudflare_account_deleted: "平台 Cloudflare 账号已删除",
  platform_cloudflare_account_upserted: "平台 Cloudflare 账号已保存",
  platform_cloudflare_current_account_changed: "平台当前 Cloudflare 账号已切换",
  platform_cloudflare_current_account_cleared: "平台当前 Cloudflare 账号已清空",
  platform_email_settings_updated: "平台邮件配置已更新",
  site_admin_created: "站点管理员已创建",
  site_admin_deleted: "站点管理员已删除",
  site_admin_updated: "站点管理员已更新",
  site_created: "站点已创建",
  site_settings_updated: "站点设置已更新",
  site_signup_credit_grant_updated: "注册赠送积分已更新",
  theme_activated: "装修主题已启用",
  theme_applied_to_draft: "主题已应用到草稿",
  theme_deleted: "装修主题已删除",
  theme_draft_reset_from_active: "装修草稿已重置",
  theme_draft_restored_from_publication: "装修草稿已从发布版本恢复",
  theme_duplicated: "装修主题已复制",
  theme_installed: "装修主题已安装",
  theme_published: "装修主题已发布",
  theme_saas_addition: "装修区块已新增",
  theme_saas_additem: "装修内容项已新增",
  theme_saas_change: "装修内容已修改",
  theme_saas_delitem: "装修内容项已删除",
  theme_saas_delition: "装修区块已删除",
  theme_saas_dropitem: "装修内容项顺序已调整",
  theme_saas_dropition: "装修区块顺序已调整",
  theme_xfcart_addition: "XFCart 装修区块已新增",
  theme_xfcart_additem: "XFCart 装修内容项已新增",
  theme_xfcart_change: "XFCart 装修内容已修改",
  theme_xfcart_delitem: "XFCart 装修内容项已删除",
  theme_xfcart_delition: "XFCart 装修区块已删除"
};

const auditObjectLabels: Record<string, string> = {
  customer: "客户",
  platform_ai_provider: "平台 AI 供应商",
  platform_cloudflare_account: "平台 Cloudflare 账号",
  platform_email_settings: "平台邮件配置",
  site: "站点",
  site_admin: "站点管理员",
  site_theme: "站点装修主题",
  theme: "装修主题",
  theme_draft: "装修草稿",
  theme_publication: "装修发布版本"
};

const jobStatusLabels: Record<string, string> = {
  failed: "AI 任务失败",
  pending: "AI 任务待处理",
  processing: "AI 任务处理中",
  queued: "AI 任务排队中",
  refunded: "AI 任务已退款",
  running: "AI 任务运行中",
  succeeded: "AI 任务已完成"
};

const orderStatusLabels: Record<string, string> = {
  failed: "订单支付失败",
  fulfilled: "订单已履约",
  paid: "订单已支付",
  pending: "订单待支付",
  refunded: "订单已退款"
};

export function normalizeAuditKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

export function labelAuditEvent(label: string) {
  const key = normalizeAuditKey(label);
  if (auditEventLabels[key]) return auditEventLabels[key];
  if (key.startsWith("job_")) {
    const status = key.replace("job_", "");
    return jobStatusLabels[status] ?? `AI 任务：${status}`;
  }
  if (key.startsWith("order_")) {
    const status = key.replace("order_", "");
    return orderStatusLabels[status] ?? `订单：${status}`;
  }
  return label.replace(/_/g, " ");
}

export function labelAuditObject(detail: string) {
  const separatorIndex = detail.indexOf(":");
  if (separatorIndex === -1) return detail;
  const type = detail.slice(0, separatorIndex);
  const id = detail.slice(separatorIndex + 1);
  const objectLabel = auditObjectLabels[type] ?? type.replace(/_/g, " ");
  return `${objectLabel}：${id}`;
}

export function labelAuditTone(tone: AuditTone) {
  return auditToneOptions.find((option) => option.value === tone)?.label ?? tone;
}

export function formatAuditDateTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}
