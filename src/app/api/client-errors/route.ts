import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Diagnostic sink for uncaught client-side exceptions.
 *
 * The mobile "Application error" page only says a client exception happened;
 * the console (where the real stack lives) is not reachable on an iPhone from
 * a desktop session. This endpoint records the message, stack, page URL and
 * user agent in the service journal so a reproduction can be diagnosed from
 * the server. It stores nothing in the database and sets no cookies.
 */
const MAX_MESSAGE = 600;
const MAX_STACK = 4000;
const MAX_URL = 300;
const MAX_UA = 300;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const text = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : "");
  const entry = {
    at: new Date().toISOString(),
    kind: text(body.kind, 40),
    message: text(body.message, MAX_MESSAGE),
    stack: text(body.stack, MAX_STACK),
    url: text(body.url, MAX_URL),
    userAgent: text(body.userAgent, MAX_UA)
  };
  console.error(`[client-error] ${JSON.stringify(entry)}`);
  return NextResponse.json({ ok: true });
}
