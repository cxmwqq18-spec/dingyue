import { NextResponse } from "next/server";
import {
  contentTypeForCustomerAssetPath,
  customerAssetFileExists,
  customerAssetFilePath,
  customerAssetUrl,
  deleteCustomerAssetFile,
  normalizeCustomerAssetStorageKey,
  writeCustomerAssetFile
} from "@/lib/customer-asset-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maxTransferBytes = 25 * 1024 * 1024;

function transferSecret(): string {
  return process.env.CUSTOMER_ASSET_TRANSFER_SECRET?.trim() || process.env.AI_WORKER_SECRET?.trim() || "";
}

function isAuthorized(request: Request): boolean {
  const secret = transferSecret();
  if (!secret || secret === "dev-worker-secret") return false;
  const provided =
    request.headers.get("x-customer-asset-transfer-secret")?.trim() ||
    request.headers.get("x-ai-worker-secret")?.trim();
  return Boolean(provided && provided === secret);
}

function customerScopedStorageKey(value: unknown): string {
  if (typeof value !== "string") throw new Error("storage_key_required");
  const storageKey = normalizeCustomerAssetStorageKey(value);
  const parts = storageKey.split("/");
  const customersIndex = parts.indexOf("customers");
  if (parts[0] !== "sites" || customersIndex !== 2 || parts[4] !== "assets") {
    throw new Error("storage_key_must_be_customer_asset_scoped");
  }
  return storageKey;
}

function safeMimeType(value: unknown): string {
  if (typeof value !== "string" || !value.includes("/")) return "application/octet-stream";
  return value.trim().slice(0, 120);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "customer_asset_transfer_unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      storageKey?: unknown;
      mimeType?: unknown;
      dataBase64?: unknown;
    };
    const storageKey = customerScopedStorageKey(body.storageKey);
    if (typeof body.dataBase64 !== "string" || !body.dataBase64) {
      return NextResponse.json({ ok: false, error: "asset_data_required" }, { status: 400 });
    }
    const bytes = Buffer.from(body.dataBase64, "base64");
    if (!bytes.length) {
      return NextResponse.json({ ok: false, error: "asset_data_required" }, { status: 400 });
    }
    if (bytes.length > maxTransferBytes) {
      return NextResponse.json({ ok: false, error: "asset_data_too_large" }, { status: 413 });
    }
    writeCustomerAssetFile({ storageKey, bytes });
    return NextResponse.json({
      ok: true,
      storageKey,
      mimeType: safeMimeType(body.mimeType),
      size: bytes.length,
      url: customerAssetUrl(storageKey)
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "customer_asset_write_failed" },
      { status: 400 }
    );
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "customer_asset_transfer_unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const storageKey = customerScopedStorageKey(url.searchParams.get("storageKey"));
    if (!customerAssetFileExists(storageKey)) {
      return NextResponse.json({ ok: false, error: "asset_not_found" }, { status: 404 });
    }
    const filePath = customerAssetFilePath(storageKey);
    const bytes = await import("fs/promises").then((fs) => fs.readFile(filePath));
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": contentTypeForCustomerAssetPath(filePath),
        "Content-Length": String(bytes.length),
        "Cache-Control": "private, max-age=30"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "customer_asset_read_failed" },
      { status: 400 }
    );
  }
}

export async function HEAD(request: Request) {
  if (!isAuthorized(request)) return new Response(null, { status: 401 });
  try {
    const url = new URL(request.url);
    const storageKey = customerScopedStorageKey(url.searchParams.get("storageKey"));
    if (!customerAssetFileExists(storageKey)) return new Response(null, { status: 404 });
    const filePath = customerAssetFilePath(storageKey);
    return new Response(null, {
      headers: {
        "Content-Type": contentTypeForCustomerAssetPath(filePath)
      }
    });
  } catch {
    return new Response(null, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "customer_asset_transfer_unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { storageKey?: unknown };
    const storageKey = customerScopedStorageKey(body.storageKey);
    const result = deleteCustomerAssetFile(storageKey);
    return NextResponse.json({ ok: true, storageKey, deleted: result.deleted });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "customer_asset_delete_failed" },
      { status: 400 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { Allow: "GET,POST,HEAD,DELETE,OPTIONS" }
  });
}
