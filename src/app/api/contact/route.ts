import { NextResponse } from "next/server";

import { validateContactRequest } from "@/lib/contact/contact-request";
import { sendContactEmail } from "@/lib/contact/lark-smtp";
import { allowContactRequest } from "@/lib/contact/rate-limit";

export const runtime = "nodejs";

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  return forwarded.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

function originAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!originAllowed(request)) return NextResponse.json({ ok: false, error: "origin_rejected" }, { status: 403 });
  if (!allowContactRequest(clientIp(request))) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }
  const validation = validateContactRequest(body);
  if (!validation.ok) return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
  if (validation.spam) return NextResponse.json({ ok: true });
  try {
    const sent = await sendContactEmail(validation.payload);
    console.info(JSON.stringify({ event: "contact_email_sent", inquiry: validation.payload.inquiry, messageId: sent.messageId }));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error ? error.name : "unknown";
    console.error(JSON.stringify({ event: "contact_email_failed", inquiry: validation.payload.inquiry, code }));
    const status = error instanceof Error && error.name === "ContactMailNotConfiguredError" ? 503 : 502;
    return NextResponse.json({ ok: false, error: "send_failed" }, { status });
  }
}
