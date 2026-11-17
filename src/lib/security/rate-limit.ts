/**
 * 限流机制
 * 用于防止API滥用和DDoS攻击
 */

import { NextRequest, NextResponse } from "next/server";

// 内存存储（生产环境应使用Redis）
const rateLimitStore =
  ((globalThis as typeof globalThis & {
    __dingyueRateLimitStore?: Map<string, { count: number; resetTime: number }>;
  }).__dingyueRateLimitStore ??= new Map<string, { count: number; resetTime: number }>());
export interface RateLimitConfig {
  windowMs: number;      // 时间窗口（毫秒）
  maxRequests: number;  // 窗口内最大请求数
  keyPrefix: string;     // 存储键前缀
}

// 预定义的限流配置
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // 生成相关接口 - 每分钟10次
  generation: { windowMs: 60000, maxRequests: 10, keyPrefix: "gen" },

  // 视频提示词优化短时防滥用；正式免费额度由 PlatformAsyncJob 的滚动窗口执行
  videoPromptOptimizationBurst: { windowMs: 60000, maxRequests: 20, keyPrefix: "video_prompt_optimization_burst" },

  // 结账接口 - 每小时5次
  checkout: { windowMs: 3600000, maxRequests: 5, keyPrefix: "checkout" },

  // Credit充值 - 每天3次
  creditPurchase: { windowMs: 86400000, maxRequests: 3, keyPrefix: "credit" },

  // 通用API - 每分钟60次
  api: { windowMs: 60000, maxRequests: 60, keyPrefix: "api" },

  // 登录尝试 - 每分钟 5 次
  //
  // This is the deliberate budget, not an accident: the security drill that saw
  // the sixth attempt answered 429 was observing the design. The counter is
  // keyed per site and per client IP (see getClientIP, which prefers
  // cf-connecting-ip so a visitor cannot rotate x-forwarded-for). Narrowing or
  // widening it changes the brute-force surface of every storefront, so treat a
  // change here as a security decision and update this comment with it.
  login: { windowMs: 60000, maxRequests: 5, keyPrefix: "login" },

  // 注册 - 每小时10次
  register: { windowMs: 3600000, maxRequests: 10, keyPrefix: "register" },

  // 邮箱验证码 - 同一站点/邮箱/来源每60秒1次
  emailCode: { windowMs: 60000, maxRequests: 1, keyPrefix: "email_code" },

  // 文件上传 - 每分钟20次
  upload: { windowMs: 60000, maxRequests: 20, keyPrefix: "upload" },

  // 后台高风险变更 - 每15分钟8次
  adminMutation: { windowMs: 900000, maxRequests: 8, keyPrefix: "admin_mutation" },

  // 平台 AI 供应商配置 - 人工启停/排序需要连续操作，但仍保留后台写入限流
  adminProviderConfig: { windowMs: 60000, maxRequests: 30, keyPrefix: "admin_provider_config" },

  // 后台客户素材清理 - 支持人工连续删除和小批量清理
  adminCustomerAssetDelete: { windowMs: 60000, maxRequests: 60, keyPrefix: "admin_customer_asset_delete" },

  // 平台进入站点后台桥接 - 登录跳转路径，允许频繁切换站点
  adminBridge: { windowMs: 60000, maxRequests: 60, keyPrefix: "admin_bridge" },
};

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfterMs?: number;
}

/**
 * 检查速率限制
 * @param request NextRequest对象
 * @param config 限流配置
 * @param identifier 可选的标识符（如customerId），默认使用IP
 */
export function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig,
  identifier?: string
): RateLimitResult {
  // 获取标识符（优先使用传入的identifier，否则使用IP）
  const key = identifier || getClientIP(request);

  // 生成存储键
  const storageKey = `${config.keyPrefix}:${key}`;
  const now = Date.now();

      // 获取当前记录
      const record = rateLimitStore.get(storageKey);

      // 清理过期记录并初始化
      if (!record || now > record.resetTime) {
        const resetTime = now + config.windowMs;
        rateLimitStore.set(storageKey, {
          count: 1,
          resetTime,
        });
        return {
          allowed: true,
          remaining: config.maxRequests - 1,
          resetTime,
        };
      }

      // 检查是否超过限制
      if (record.count >= config.maxRequests) {
        return {
          allowed: false,
          remaining: 0,
          resetTime: record.resetTime,
          retryAfterMs: record.resetTime - now,
        };
      }

      // 递增计数
      record.count++;
      return {
        allowed: true,
        remaining: config.maxRequests - record.count,
        resetTime: record.resetTime,
      };
}

/**
 * 从请求中获取客户端IP
 */
/**
 * Accept only values that look like a single IPv4/IPv6 address, so a header
 * value cannot inject an arbitrary rate-limit key.
 */
function normalizedIp(value: string | null | undefined): string | undefined {
  const candidate = value?.split(",")[0]?.trim() ?? "";
  if (!candidate || candidate.length > 45) return undefined;
  return /^[0-9a-fA-F:.]+$/.test(candidate) && /[0-9]/.test(candidate) ? candidate : undefined;
}

export function getClientIP(request: NextRequest): string {
  // Cloudflare overwrites CF-Connecting-IP at the edge, so a visitor cannot
  // rotate it to escape a per-visitor limit. X-Forwarded-For still carries
  // whatever the client sent ahead of the real hop, which is why limits keyed
  // on it (and on its first entry) were bypassable by changing the header.
  const cloudflareIp = normalizedIp(request.headers.get("cf-connecting-ip"));
  if (cloudflareIp) return cloudflareIp;

  // The origin allowlist keeps direct-to-origin traffic out, and the origin
  // rewrites X-Real-IP from the proxy-observed address.
  const realIp = normalizedIp(request.headers.get("x-real-ip"));
  if (realIp) return realIp;

  const forwarded = normalizedIp(request.headers.get("x-forwarded-for"));
  if (forwarded) return forwarded;

  return "unknown";
}

export function rateLimitResponse(result: RateLimitResult): NextResponse {
  const retryAfter = Math.max(1, Math.ceil((result.retryAfterMs ?? 0) / 1000));
  return NextResponse.json(
    { error: "rate_limited", retryAfter },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(Math.ceil(result.resetTime / 1000))
      }
    }
  );
}

export function checkRateLimitOrResponse(
  request: NextRequest,
  config: RateLimitConfig,
  identifier?: string
): { allowed: true; result: RateLimitResult } | { allowed: false; response: NextResponse } {
  const result = checkRateLimit(request, config, identifier);
  if (!result.allowed) return { allowed: false, response: rateLimitResponse(result) };
  return { allowed: true, result };
}

/**
 * 清除指定前缀的所有记录（用于测试）
 */
export function clearRateLimitStore(prefix?: string): void {
  if (!prefix) {
    rateLimitStore.clear();
    return;
  }
  for (const key of rateLimitStore.keys()) {
    if (key.startsWith(prefix)) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * 获取当前存储状态（用于监控）
 */
export function getRateLimitStats(): {
  totalKeys: number;
  activeEntries: number;
} {
  const now = Date.now();
  let active = 0;

  for (const record of rateLimitStore.values()) {
    if (now <= record.resetTime) {
      active++;
    }
  }

  return {
    totalKeys: rateLimitStore.size,
    activeEntries: active,
  };
}
