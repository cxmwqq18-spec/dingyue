import "server-only";
import { NextResponse } from "next/server";
import { WorkspaceError } from "./types";

export function developerResponse(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function developerJsonBody(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (text.length > 128_000) throw new WorkspaceError("request_too_large", 413);
  try {
    const value = JSON.parse(text);
    if (!value || Array.isArray(value) || typeof value !== "object") throw new Error();
    return value as Record<string, unknown>;
  } catch { throw new WorkspaceError("invalid_json", 400); }
}

export function developerFailure(error: unknown) {
  if (error instanceof WorkspaceError) return developerResponse({ error: error.code, details: error.details }, error.status);
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (code === "P2010") return developerResponse({ error: "workspace_database_unavailable" }, 503);
  const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
  return developerResponse({ error: status < 500 && error instanceof Error ? error.message : "workspace_request_failed" }, status);
}
