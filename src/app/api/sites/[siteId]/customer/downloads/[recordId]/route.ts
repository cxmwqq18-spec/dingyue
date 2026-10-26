import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { clearCustomerRuntimeApiCacheForSessions } from "@/lib/customer-runtime-api-cache";
import { getCustomerBySessionRelational } from "@/lib/stores/customer-store";
import { requireCsrfToken } from "@/lib/security/csrf";
import { customerSessionCookie } from "@/lib/session";
import { isTransientPrismaConnectionError, prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Remove one download-history row for the signed-in customer.
 *
 * This only deletes the `CustomerAssetDownload` log entry so the row
 * disappears from the account download list. The uploaded asset, the job and
 * any album data behind it are untouched.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ siteId: string; recordId: string }> }) {
  const { siteId, recordId } = await params;
  // This is the AIVideosUGC account-center control. Other storefronts keep
  // their existing download-history behavior.
  if (siteId !== "site_aidreamcapes") {
    return NextResponse.json({ ok: false, error: "download_record_not_found" }, { status: 404 });
  }
  const sessionId = (await cookies()).get(customerSessionCookie(siteId))?.value;
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "customer_login_required" }, { status: 401 });
  }
  const csrfError = requireCsrfToken(request, `customer:${siteId}`, sessionId);
  if (csrfError) return csrfError;

  const current = await getCustomerBySessionRelational({ siteId, sessionId });
  if (!current?.customer) {
    return NextResponse.json({ ok: false, error: "customer_login_required" }, { status: 401 });
  }

  try {
    const removed = await prisma.customerAssetDownload.deleteMany({
      where: { id: recordId, siteId, customerId: current.customer.id }
    });
    if (!removed.count) {
      return NextResponse.json({ ok: false, error: "download_record_not_found" }, { status: 404 });
    }
    // Forget this session's cached account runtime so the next section load
    // cannot serve the deleted row for up to its 30s TTL.
    clearCustomerRuntimeApiCacheForSessions(siteId, [sessionId]);
    return NextResponse.json({ ok: true, removed: removed.count });
  } catch (error) {
    const transient = isTransientPrismaConnectionError(error);
    console.error("customer_download_record_delete_failed", error);
    return NextResponse.json(
      { ok: false, error: transient ? "customer_runtime_db_unavailable" : "download_record_unavailable" },
      { status: transient ? 503 : 500 }
    );
  }
}
