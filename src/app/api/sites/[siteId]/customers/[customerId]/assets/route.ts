import { NextResponse } from "next/server";
import { hasCustomerSession } from "@/lib/api-auth";
import { createAssetUpload, getCustomerAssetsFromState, readPlatformState, StoreError, toThemeRuntimeAsset } from "@/lib/server-store";

export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string; customerId: string }> }) {
  const { siteId, customerId } = await params;
  if (!(await hasCustomerSession(siteId, customerId))) {
    return NextResponse.json({ error: "customer_login_required" }, { status: 401 });
  }
  const state = readPlatformState();
  const customer = state.customers.find((item) => item.siteId === siteId && item.id === customerId);
  if (!customer) {
    return NextResponse.json({ error: "customer_not_found_for_site" }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    assets: getCustomerAssetsFromState(state, siteId, customerId).map((asset) => toThemeRuntimeAsset(state, asset))
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ siteId: string; customerId: string }> }) {
  const { siteId, customerId } = await params;
  if (!(await hasCustomerSession(siteId, customerId))) {
    return NextResponse.json({ error: "customer_login_required" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    label?: string;
    mimeType?: string;
    role?: "input" | "output";
    jobId?: string;
  };

  try {
    const result = createAssetUpload({
      siteId,
      customerId,
      label: body.label ?? "",
      mimeType: body.mimeType ?? "image/jpeg",
      role: body.role ?? "input",
      jobId: body.jobId
    });
    const state = readPlatformState();
    return NextResponse.json({ ok: true, asset: toThemeRuntimeAsset(state, result.asset) });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "asset_create_failed" }, { status });
  }
}
