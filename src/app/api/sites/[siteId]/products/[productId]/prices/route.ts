import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import { upsertProductPriceRelational } from "@/lib/stores/billing-store";
import type { Price } from "@/lib/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ siteId: string; productId: string }> }
) {
  const { siteId, productId } = await params;
  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Partial<Price> | null;
  if (!body?.label || typeof body.amountCents !== "number" || !body.currency || !body.interval || typeof body.creditsGranted !== "number") {
    return NextResponse.json({ error: "invalid_price_payload" }, { status: 400 });
  }

  try {
    const result = await upsertProductPriceRelational({
      siteId,
      productId,
      label: body.label,
      amountCents: Number(body.amountCents),
      currency: body.currency,
      interval: body.interval,
      creditsGranted: Number(body.creditsGranted),
      stripePriceId: body.stripePriceId,
      metadata: body.metadata
    });
    return NextResponse.json({ ok: true, price: result.price });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "price_create_failed" }, { status });
  }
}
