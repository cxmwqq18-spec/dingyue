import { NextResponse } from "next/server";
import {
  contentTypeForCustomerAssetPath,
  customerAssetFileExists,
  customerAssetFilePath,
  customerAssetUrl,
  deleteCustomerAssetFile,
  normalizeCustomerAssetStorageKey,
  readCustomerAssetWatermarkMarker,
  writeCustomerAssetFile,
  writeCustomerAssetWatermarkMarker
} from "@/lib/customer-asset-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const defaultMaxTransferBytes = 25 * 1024 * 1024;
const defaultMaxVideoTransferBytes = 250 * 1024 * 1024;

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

function safeWatermarkMarker(params: { version?: unknown; text?: unknown }) {
  const version = typeof params.version === "string" ? params.version.trim().slice(0, 120) : "";
  const text = typeof params.text === "string" ? params.text.trim().slice(0, 120) : "";
  return version && text ? { version, text } : undefined;
}

function watermarkHeaders(storageKey: string): Record<string, string> {
  const marker = readCustomerAssetWatermarkMarker(storageKey);
  return marker
    ? {
        "X-Customer-Asset-Watermark-Version": marker.version,
        "X-Customer-Asset-Watermark-Text": marker.text
      }
    : {};
}

function configuredTransferLimit(envName: string, fallback: number): number {
  const configured = Number(process.env[envName] ?? "");
  return Number.isFinite(configured) && configured > 0 ? Math.trunc(configured) : fallback;
}

function isVideoAsset(params: { mimeType?: unknown; storageKey?: string }): boolean {
  const mimeType = safeMimeType(params.mimeType).toLowerCase();
  const storageKey = params.storageKey?.toLowerCase() ?? "";
  return mimeType.startsWith("video/") || /\.(m4v|mov|mp4|webm)$/.test(storageKey);
}

function maxTransferBytesFor(params: { mimeType?: unknown; storageKey?: string }): number {
  const defaultLimit = configuredTransferLimit("CUSTOMER_ASSET_TRANSFER_MAX_BYTES", defaultMaxTransferBytes);
  if (!isVideoAsset(params)) return defaultLimit;
  return Math.max(
    defaultLimit,
    configuredTransferLimit("CUSTOMER_ASSET_VIDEO_TRANSFER_MAX_BYTES", defaultMaxVideoTransferBytes)
  );
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "customer_asset_transfer_unauthorized" }, { status: 401 });
  }

  try {
    const contentType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() || "";
    if (contentType === "application/octet-stream") {
      const url = new URL(request.url);
      const storageKey = customerScopedStorageKey(
        request.headers.get("x-customer-asset-storage-key") ?? url.searchParams.get("storageKey")
      );
      const mimeType = safeMimeType(
        request.headers.get("x-customer-asset-mime-type") ?? url.searchParams.get("mimeType")
      );
      const bytes = Buffer.from(await request.arrayBuffer());
      if (!bytes.length) {
        return NextResponse.json({ ok: false, error: "asset_data_required" }, { status: 400 });
      }
      const maxTransferBytes = maxTransferBytesFor({ mimeType, storageKey });
      if (bytes.length > maxTransferBytes) {
        return NextResponse.json(
          { ok: false, error: "asset_data_too_large", size: bytes.length, maxBytes: maxTransferBytes },
          { status: 413 }
        );
      }
      writeCustomerAssetFile({ storageKey, bytes });
      const watermark = safeWatermarkMarker({
        version: request.headers.get("x-customer-asset-watermark-version"),
        text: request.headers.get("x-customer-asset-watermark-text")
      });
      if (watermark) writeCustomerAssetWatermarkMarker(storageKey, watermark);
      return NextResponse.json({
        ok: true,
        storageKey,
        mimeType,
        size: bytes.length,
        url: customerAssetUrl(storageKey)
      });
    }

    const body = (await request.json().catch(() => ({}))) as {
      storageKey?: unknown;
      mimeType?: unknown;
      dataBase64?: unknown;
      watermarkText?: unknown;
      watermarkVersion?: unknown;
    };
    const storageKey = customerScopedStorageKey(body.storageKey);
    if (typeof body.dataBase64 !== "string" || !body.dataBase64) {
      return NextResponse.json({ ok: false, error: "asset_data_required" }, { status: 400 });
    }
    const bytes = Buffer.from(body.dataBase64, "base64");
    if (!bytes.length) {
      return NextResponse.json({ ok: false, error: "asset_data_required" }, { status: 400 });
    }
    const maxTransferBytes = maxTransferBytesFor({ mimeType: body.mimeType, storageKey });
    if (bytes.length > maxTransferBytes) {
      return NextResponse.json(
        { ok: false, error: "asset_data_too_large", size: bytes.length, maxBytes: maxTransferBytes },
        { status: 413 }
      );
    }
    writeCustomerAssetFile({ storageKey, bytes });
    const watermark = safeWatermarkMarker({ version: body.watermarkVersion, text: body.watermarkText });
    if (watermark) writeCustomerAssetWatermarkMarker(storageKey, watermark);
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
        "Cache-Control": "private, max-age=30",
        ...watermarkHeaders(storageKey)
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
        "Content-Type": contentTypeForCustomerAssetPath(filePath),
        ...watermarkHeaders(storageKey)
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
