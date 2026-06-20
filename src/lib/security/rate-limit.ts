/**
 * 限流机制
 * 用于防止API滥用和DDoS攻击
 */

import { NextRequest } from "next/server";

// 内存存储（生产环境应使用Redis）
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export interface RateLimitConfig {
  windowMs: number;      // 时间窗口（毫秒）
  maxRequests: number;  // 窗口内最大请求数
  keyPrefix: string;     // 存储键前缀
}

// 预定义的限流配置
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // 生成相关接口 - 每分钟10次
  generation: { windowMs: 60000, maxRequests: 10, keyPrefix: "gen" },

  // 结账接口 - 每小时5次
  checkout: { windowMs: 3600000, maxRequests: 5, keyPrefix: "checkout" },

  // Credit充值 - 每天3次
  creditPurchase: { windowMs: 86400000, maxRequests: 3, keyPrefix: "credit" },

  // 通用API - 每分钟60次
  api: { windowMs: 60000, maxRequests: 60, keyPrefix: "api" },

  // 登录尝试 - 每分钟5次
  login: { windowMs: 60000, maxRequests: 5, keyPrefix: "login" },

  // 注册 - 每小时10次
  register: { windowMs: 3600000, maxRequests: 10, keyPrefix: "register" },

  // 文件上传 - 每分钟20次
  upload: { windowMs: 60000, maxRequests: 20, keyPrefix: "upload" },
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
    rateLimitStore.set(storageKey, {
      count: 1,
      resetTime: now + config.windowMs,
    });

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs,
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
export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  if (realIp) {
    return realIp;
  }

  return "unknown";
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