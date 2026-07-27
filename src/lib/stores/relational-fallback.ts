import "server-only";

let warned = false;
let relationalFallbackCircuitUntil = 0;
const relationalFallbackCircuitMs = Math.max(0, Math.floor(Number(process.env.RELATIONAL_FALLBACK_CIRCUIT_MS ?? 30_000)));

export function shouldFallbackRelationalRead(error: unknown): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.PLATFORM_STATE_POSTGRES_STRICT === "1") return false;
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error);
  return (
    code === "PDB_READ_TIMEOUT" ||
    name === "PrismaReadTimeoutError" ||
    message.includes("Can't reach database server") ||
    message.includes("Authentication failed against database server") ||
    message.includes("provided database credentials") ||
    message.includes("ECONNREFUSED") ||
    message.includes("P1000") ||
    message.includes("P1001") ||
    message.includes("P2024") ||
    message.includes("timed out after") ||
    message.includes("relational_") && message.includes("_unavailable") ||
    message.includes("connection pool") ||
    message.includes("Timed out fetching a new connection")
  );
}

export function shouldUseRelationalReadFallbackCircuit(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.PLATFORM_STATE_POSTGRES_STRICT === "1") return false;
  return relationalFallbackCircuitUntil > Date.now();
}

export function warnRelationalFallback(scope: string, error: unknown): void {
  if (relationalFallbackCircuitMs > 0 && shouldFallbackRelationalRead(error)) {
    relationalFallbackCircuitUntil = Date.now() + relationalFallbackCircuitMs;
  }
  if (warned) return;
  warned = true;
  const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
  console.warn(`[relational-store] ${scope} unavailable; using JSON fallback for local development. ${message}`);
}
