import "server-only";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const defaultReadRetryCount = Math.max(0, Math.floor(Number(process.env.PRISMA_READ_TRANSIENT_RETRIES ?? 1)));
const defaultReadRetryDelayMs = Math.max(0, Math.floor(Number(process.env.PRISMA_READ_TRANSIENT_RETRY_DELAY_MS ?? 250)));
const defaultReadTimeoutMs = Math.max(0, Math.floor(Number(process.env.PRISMA_READ_TIMEOUT_MS ?? 8_000)));
const defaultWriteRetryCount = Math.max(0, Math.floor(Number(process.env.PRISMA_WRITE_TRANSIENT_RETRIES ?? 1)));
const defaultWriteRetryDelayMs = Math.max(0, Math.floor(Number(process.env.PRISMA_WRITE_TRANSIENT_RETRY_DELAY_MS ?? 300)));
const disconnectSharedClientOnTransient = process.env.PRISMA_DISCONNECT_ON_TRANSIENT === "1";

const basePrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.PRISMA_QUERY_LOG === "1" ? ["query", "error", "warn"] : ["error", "warn"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = basePrisma;
}

const remoteReadonlyMode = String(process.env.DINGYUE_ENV || "").trim().toLowerCase() === "remote-readonly" ||
  String(process.env.DATABASE_TARGET || "").trim().toLowerCase() === "remote-readonly";

function isWriteMethodName(action: string): boolean {
  return /^(create|update|upsert|delete|deleteMany|updateMany|createMany|executeRaw|executeRawUnsafe)$/i.test(action);
}

function readonlyDelegate<T extends object>(delegate: T, label: string): T {
  return new Proxy(delegate, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof prop !== "string" || typeof value !== "function") return value;
      if (!isWriteMethodName(prop)) return value.bind(target);
      return (..._args: unknown[]) => {
        throw new Error(`Database writes are disabled in remote-readonly mode (${label}.${prop}).`);
      };
    }
  });
}

function readonlyPrismaClient(client: PrismaClient): PrismaClient {
  return new Proxy(client, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof prop === "string") {
        if (prop === "$transaction") {
          return ((...args: unknown[]) => {
            const [operation, options] = args;
            if (typeof operation === "function") {
              return target.$transaction(
                async (tx) => operation(readonlyPrismaClient(tx as PrismaClient)),
                options as never
              );
            }
            return target.$transaction(operation as never, options as never);
          }) as PrismaClient["$transaction"];
        }
        if (prop === "$executeRaw" || prop === "$executeRawUnsafe") {
          return () => {
            throw new Error(`Database writes are disabled in remote-readonly mode (${prop}).`);
          };
        }
        if (typeof value === "function") {
          return value.bind(target);
        }
        if (value && typeof value === "object" && !prop.startsWith("$")) {
          return readonlyDelegate(value as object, prop);
        }
      }
      return value;
    }
  }) as PrismaClient;
}

export const prisma = remoteReadonlyMode ? readonlyPrismaClient(basePrisma) : basePrisma;

class PrismaReadTimeoutError extends Error {
  code = "PDB_READ_TIMEOUT";

  constructor(label: string, timeoutMs: number) {
    super(`${label} timed out after ${timeoutMs}ms`);
    this.name = "PrismaReadTimeoutError";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorCode(error: unknown): string {
  return typeof error === "object" && error && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : "";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isTransientPrismaConnectionError(error: unknown): boolean {
  const code = errorCode(error);
  if (code === "P1001" || code === "P1017" || code === "P2024" || code === "PDB_READ_TIMEOUT") return true;
  const message = errorMessage(error);
  return (
    message.includes("Can't reach database server") ||
    message.includes("Server has closed the connection") ||
    message.includes("Error in PostgreSQL connection") ||
    message.includes("Engine is not yet connected") ||
    message.includes("Response from the Engine was empty") ||
    message.includes("bytes remaining on stream") ||
    message.includes("ECONNREFUSED") ||
    message.includes("connection pool") ||
    message.includes("Timed out fetching a new connection")
  );
}

async function runReadWithTimeout<T>(task: () => Promise<T>, label: string, timeoutMs: number): Promise<T> {
  const operation = task();
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return operation;

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  operation.catch(() => undefined);
  const timeout = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      reject(new PrismaReadTimeoutError(label, timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation, timeout]);
  } catch (error) {
    if (timedOut && disconnectSharedClientOnTransient) await prisma.$disconnect().catch(() => undefined);
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function runPrismaReadWithReconnect<T>(
  task: () => Promise<T>,
  options: { label?: string; retries?: number; retryDelayMs?: number; timeoutMs?: number } = {}
): Promise<T> {
  const label = options.label ?? "prisma read";
  const retries = Math.max(0, Math.floor(options.retries ?? defaultReadRetryCount));
  const retryDelayMs = Math.max(0, Math.floor(options.retryDelayMs ?? defaultReadRetryDelayMs));
  const timeoutMs = Math.max(0, Math.floor(options.timeoutMs ?? defaultReadTimeoutMs));

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await runReadWithTimeout(task, label, timeoutMs);
    } catch (error) {
      if (attempt >= retries || !isTransientPrismaConnectionError(error)) throw error;
      console.warn(`[prisma-read] ${label} failed on attempt ${attempt + 1}; retrying after transient connection error.`);
      if (disconnectSharedClientOnTransient) await prisma.$disconnect().catch(() => undefined);
      if (retryDelayMs > 0) await sleep(retryDelayMs * (attempt + 1));
    }
  }

  return runReadWithTimeout(task, label, timeoutMs);
}

export async function runPrismaWriteWithReconnect<T>(
  task: () => Promise<T>,
  options: { label?: string; retries?: number; retryDelayMs?: number } = {}
): Promise<T> {
  const label = options.label ?? "prisma write";
  if (remoteReadonlyMode) {
    throw new Error(`Database writes are disabled in remote-readonly mode (${label}).`);
  }
  const retries = Math.max(0, Math.floor(options.retries ?? defaultWriteRetryCount));
  const retryDelayMs = Math.max(0, Math.floor(options.retryDelayMs ?? defaultWriteRetryDelayMs));

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      if (attempt >= retries || !isTransientPrismaConnectionError(error)) throw error;
      console.warn(`[prisma-write] ${label} failed on attempt ${attempt + 1}; retrying after transient connection error.`);
      if (disconnectSharedClientOnTransient) await prisma.$disconnect().catch(() => undefined);
      if (retryDelayMs > 0) await sleep(retryDelayMs * (attempt + 1));
    }
  }

  return task();
}
