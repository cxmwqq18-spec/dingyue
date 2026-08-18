import { NextResponse } from "next/server";

import { requireSiteMutation } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import { updateProductRelational } from "@/lib/stores/billing-store";
import type { Product } from "@/lib/types";
import type { NextRequest } from "next/server";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string; productId: string }> }
) {
  const { siteId, productId } = await params;
  const guard = await requireSiteMutation(request, siteId, { key: `${siteId}:product:${productId}` });
  if (!guard.ok) return guard.response;
  const body = (await request.json().catch(() => null)) as Partial<Product> | null;
  if (!body?.name || !body.status) return NextResponse.json({ error: "invalid_product_payload" }, { status: 400 });
  try {
    const result = await updateProductRelational({
      siteId,
      productId,
      name: body.name,
      status: body.status,
      metadata: body.metadata
    });
    return NextResponse.json({ ok: true, product: result.product });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "product_update_failed" },
      { status: error instanceof StoreError ? error.status : 500 }
    );
  }
}
