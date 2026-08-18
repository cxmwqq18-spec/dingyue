import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import { createProductWithPriceRelational } from "@/lib/stores/billing-store";
import type { Price, Product } from "@/lib/types";

type CreateProductPayload = {
  name?: string;
  type?: Product["type"];
  status?: Product["status"];
  metadata?: Product["metadata"];
  price?: Partial<Price>;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as CreateProductPayload | null;
  if (!body?.name || !body.type || !body.status || !body.price) {
    return NextResponse.json({ error: "invalid_product_payload" }, { status: 400 });
  }
  if (!body.price.label || typeof body.price.amountCents !== "number" || !body.price.currency || !body.price.interval || typeof body.price.creditsGranted !== "number") {
    return NextResponse.json({ error: "invalid_price_payload" }, { status: 400 });
  }

  try {
    const result = await createProductWithPriceRelational({
      siteId,
      name: body.name,
      type: body.type,
      status: body.status,
      metadata: body.metadata,
      price: {
        label: body.price.label,
        amountCents: Number(body.price.amountCents),
        currency: body.price.currency,
        interval: body.price.interval,
        creditsGranted: Number(body.price.creditsGranted),
        stripePriceId: body.price.stripePriceId,
        metadata: body.price.metadata
      }
    });
    return NextResponse.json({ ok: true, product: result.product });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "product_create_failed" }, { status });
  }
}
