import crypto from "node:crypto";

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stable(item)])
  );
}

export function currentPublishedContentHash(payload: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(stable(payload))).digest("hex");
}

export function currentPublishedRevision(siteId: string, contentHash: string): string {
  return crypto.createHash("sha256").update(`${siteId}:${contentHash}`).digest("hex").slice(0, 24);
}
