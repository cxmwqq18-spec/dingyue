import { NextResponse } from "next/server";
import crypto from "crypto";
import { hasCustomerSession, requireCustomerMutation } from "@/lib/api-auth";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { StoreError, writeCustomerAssetFile } from "@/lib/server-store";
import { createAssetUploadRelational, getCustomerAssetsRelational, toThemeRuntimeAssetRelational } from "@/lib/stores/asset-store";
import { prisma } from "@/lib/prisma";
import type { NextRequest } from "next/server";

export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string; customerId: string }> }) {
  const { siteId, customerId } = await params;
  if (!(await hasCustomerSession(siteId, customerId))) {
    return NextResponse.json({ error: "customer_login_required" }, { status: 401 });
  }
  const customer = await prisma.customer.findFirst({ where: { id: customerId, siteId }, select: { id: true } });
  if (!customer) {
    return NextResponse.json({ error: "customer_not_found_for_site" }, { status: 404 });
  }
  const result = await getCustomerAssetsRelational({ siteId, customerId });
  return NextResponse.json({
    ok: true,
    assets: result.assets.map(toThemeRuntimeAssetRelational)
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string; customerId: string }> }) {
  const { siteId, customerId } = await params;
  const guard = await requireCustomerMutation(request, siteId, customerId, { rateLimit: RATE_LIMITS.upload, key: `${siteId}:${customerId}:assets` });
  if (!guard.ok) return guard.response;
  const contentType = request.headers.get("content-type") ?? "";
  const isMultipart = contentType.includes("multipart/form-data");
  let body: {
    label?: string;
    mimeType?: string;
    role?: "input" | "output";
    jobId?: string;
    file?: File;
  } = {};

  if (isMultipart) {
    const formData = await request.formData();
    const fileValue = formData.get("file");
    body = {
      label: String(formData.get("label") ?? ""),
      role: formData.get("role") === "output" ? "output" : "input",
      jobId: typeof formData.get("jobId") === "string" ? String(formData.get("jobId")) : undefined,
      file: fileValue instanceof File ? fileValue : undefined
    };
    if (!body.file) {
      return NextResponse.json({ error: "asset_file_required" }, { status: 400 });
    }
    if (!body.file.type.startsWith("image/")) {
      return NextResponse.json({ error: "asset_file_must_be_image" }, { status: 400 });
    }
    if (body.file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "asset_file_too_large" }, { status: 413 });
    }
    body.mimeType = body.file.type || "application/octet-stream";
    body.label = body.label || body.file.name.replace(/\.[^.]+$/, "");
  } else {
    body = (await request.json().catch(() => ({}))) as {
      label?: string;
      mimeType?: string;
      role?: "input" | "output";
      jobId?: string;
    };
  }

  try {
    const result = await createAssetUploadRelational({
      siteId,
      customerId,
      label: body.label ?? "",
      mimeType: body.mimeType ?? "image/jpeg",
      role: body.role ?? "input",
      jobId: body.jobId,
      storageKey: body.file ? `customer-assets/sites/${siteId}/customers/${customerId}/assets/${crypto.randomUUID()}-${body.file.name.replace(/[^a-z0-9._-]+/gi, "-")}` : undefined
    });
    if (body.file) {
      writeCustomerAssetFile({
        storageKey: result.asset.storageKey,
        bytes: Buffer.from(await body.file.arrayBuffer())
      });
    }
    return NextResponse.json({ ok: true, asset: toThemeRuntimeAssetRelational(result.asset) });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "asset_create_failed" }, { status });
  }
}
