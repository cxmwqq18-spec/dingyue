import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { readSiteContentRevision } from "@/lib/site-content-revision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE_ID = "site_aidreamcapes";
const MIN_TOKEN_LENGTH = 24;

function textResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function configuredToken(): string {
  return process.env.AIDREAMCAPES_HEALTH_TOKEN?.trim() ?? "";
}

function suppliedToken(request: Request): string {
  const headerToken = request.headers.get("x-aidreamcapes-health-token")?.trim();
  if (headerToken) return headerToken;
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  return /^bearer\s+/i.test(authorization) ? authorization.replace(/^bearer\s+/i, "").trim() : "";
}

function authorized(request: Request): boolean {
  const expected = configuredToken();
  if (expected.length < MIN_TOKEN_LENGTH) return false;
  const supplied = suppliedToken(request);
  if (!supplied) return false;
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

/**
 * Private readiness probe for the Aidreamcapes production service.
 *
 * This route is unavailable unless AIDREAMCAPES_HEALTH_TOKEN is configured and
 * the caller supplies it. It deliberately exposes only liveness/readiness
 * metadata, never page content, database URLs or error details. The revision
 * probe is the same cheap read used by the public SSR cache; a null probe is a
 * fail-closed readiness failure rather than a reason to serve stale content.
 */
export async function GET(request: Request): Promise<Response> {
  if (!authorized(request)) return textResponse("Not found\n", 404);
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const revision = await readSiteContentRevision(SITE_ID);
    if (revision === null) {
      return jsonResponse({
        ok: false,
        siteId: SITE_ID,
        database: "ok",
        revisionProbe: "failed",
        probeMs: Date.now() - startedAt
      }, 503);
    }
    const memory = process.memoryUsage();
    return jsonResponse({
      ok: true,
      siteId: SITE_ID,
      database: "ok",
      revision,
      commit: process.env.GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_RELEASE_COMMIT || null,
      uptimeSec: Math.round(process.uptime()),
      rssMb: Math.round(memory.rss / 1024 / 1024),
      probeMs: Date.now() - startedAt
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      siteId: SITE_ID,
      database: "failed",
      error: error instanceof Error ? error.name : "unknown",
      probeMs: Date.now() - startedAt
    }, 503);
  }
}
