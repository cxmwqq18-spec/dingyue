/**
 * 限流机制
 * 用于防止API滥用和DDoS攻击
 */

import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

// 内存存储（生产环境应使用Redis）
const rateLimitStore =
  ((globalThis as typeof globalThis & {
    __dingyueRateLimitStore?: Map<string, { count: number; resetTime: number }>;
  }).__dingyueRateLimitStore ??= new Map<string, { count: number; resetTime: number }>());
const rateLimitFile = path.join(process.cwd(), ".next", "cache", "rate-limit-store.json");
const rateLimitLockDir = `${rateLimitFile}.lock`;
const rateLimitLockTimeoutMs = Number(process.env.RATE_LIMIT_LOCK_TIMEOUT_MS ?? "2000");

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function withRateLimitLock<T>(callback: () => T): T {
  const startedAt = Date.now();
  let lockAcquired = false;
  while (!lockAcquired) {
    try {
      fs.mkdirSync(rateLimitLockDir, { recursive: false });
      lockAcquired = true;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw error;
      try {
        const stat = fs.statSync(rateLimitLockDir);
        if (Date.now() - stat.mtimeMs > rateLimitLockTimeoutMs) {
          fs.rmSync(rateLimitLockDir, { recursive: true, force: true });
          continue;
        }
      } catch {
        continue;
      }
      if (Date.now() - startedAt > rateLimitLockTimeoutMs) {
        throw error;
      }
      sleepSync(10);
    }
  }

  try {
    return callback();
  } finally {
    fs.rmSync(rateLimitLockDir, { recursive: true, force: true });
  }
}

function readRateLimitSnapshot(): Record<string, { count: number; resetTime: number }> {
  try {
    return JSON.parse(fs.readFileSync(rateLimitFile, "utf8")) as Record<string, { count: number; resetTime: number }>;
  } catch {
    return {};
  }
}

function replaceRateLimitStore(snapshot: Record<string, { count: number; resetTime: number }>): void {
  rateLimitStore.clear();
  const now = Date.now();
  for (const [key, value] of Object.entries(snapshot)) {
    if (Number.isFinite(value.count) && Number.isFinite(value.resetTime) && value.resetTime > now) {
      rateLimitStore.set(key, { count: value.count, resetTime: value.resetTime });
    }
  }
}

function loadRateLimitStore(): void {
  try {
    replaceRateLimitStore(readRateLimitSnapshot());
  } catch {
    // Missing or partially written cache files should not block requests.
  }
}

function persistRateLimitStore(): void {
  try {
    fs.mkdirSync(path.dirname(rateLimitFile), { recursive: true });
    const tempFile = `${rateLimitFile}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(Object.fromEntries(rateLimitStore)));
    fs.renameSync(tempFile, rateLimitFile);
  } catch {
    // Rate limiting should degrade to process memory if the cache is unavailable.
  }
}

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

  // 邮箱验证码 - 同一站点/邮箱/来源每60秒1次
  emailCode: { windowMs: 60000, maxRequests: 1, keyPrefix: "email_code" },

  // 文件上传 - 每分钟20次
  upload: { windowMs: 60000, maxRequests: 20, keyPrefix: "upload" },

  // 后台高风险变更 - 每15分钟8次
  adminMutation: { windowMs: 900000, maxRequests: 8, keyPrefix: "admin_mutation" },

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
  try {
    return withRateLimitLock(() => {
      const now = Date.now();
      loadRateLimitStore();

      // 获取当前记录
      const record = rateLimitStore.get(storageKey);

      // 清理过期记录并初始化
      if (!record || now > record.resetTime) {
        const resetTime = now + config.windowMs;
        rateLimitStore.set(storageKey, {
          count: 1,
          resetTime,
        });
        persistRateLimitStore();

        return {
          allowed: true,
          remaining: config.maxRequests - 1,
          resetTime,
        };
      }

      // 检查是否超过限制
      if (record.count >= config.maxRequests) {
        persistRateLimitStore();
        return {
          allowed: false,
          remaining: 0,
          resetTime: record.resetTime,
          retryAfterMs: record.resetTime - now,
        };
      }

      // 递增计数
      record.count++;
      persistRateLimitStore();

      return {
        allowed: true,
        remaining: config.maxRequests - record.count,
        resetTime: record.resetTime,
      };
    });
  } catch {
    const now = Date.now();
    const record = rateLimitStore.get(storageKey);
    if (!record || now > record.resetTime) {
      const resetTime = now + config.windowMs;
      rateLimitStore.set(storageKey, { count: 1, resetTime });
      return { allowed: true, remaining: config.maxRequests - 1, resetTime };
    }
    if (record.count >= config.maxRequests) {
      return { allowed: false, remaining: 0, resetTime: record.resetTime, retryAfterMs: record.resetTime - now };
    }
    record.count++;
    return { allowed: true, remaining: config.maxRequests - record.count, resetTime: record.resetTime };
  }
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
  withRateLimitLock(() => {
    loadRateLimitStore();
    if (!prefix) {
      rateLimitStore.clear();
      persistRateLimitStore();
      return;
    }

    for (const key of rateLimitStore.keys()) {
      if (key.startsWith(prefix)) {
        rateLimitStore.delete(key);
      }
    }
    persistRateLimitStore();
  });
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
