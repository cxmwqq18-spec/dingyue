import "server-only";

let warned = false;

export function shouldFallbackRelationalRead(error: unknown): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.PLATFORM_STATE_POSTGRES_STRICT === "1") return false;
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("Can't reach database server") ||
    message.includes("Authentication failed against database server") ||
    message.includes("provided database credentials") ||
    message.includes("ECONNREFUSED") ||
    message.includes("P1000") ||
    message.includes("P1001") ||
    message.includes("P2024") ||
    message.includes("connection pool") ||
    message.includes("Timed out fetching a new connection")
  );
}

export function warnRelationalFallback(scope: string, error: unknown): void {
  if (warned) return;
  warned = true;
  const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
  console.warn(`[relational-store] ${scope} unavailable; using JSON fallback for local development. ${message}`);
}
