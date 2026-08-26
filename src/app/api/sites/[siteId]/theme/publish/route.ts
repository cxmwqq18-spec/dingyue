import { NextResponse } from "next/server";

import { requireSiteMutation } from "@/lib/api-auth";
import { databaseIdentityFromUrl } from "@/lib/current-state/backup-receipt";
import { RelationalStoreError } from "@/lib/stores/prisma-mappers";
import { publishCurrentStateRelational } from "@/lib/stores/site-published-state";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const guard = await requireSiteMutation(request, siteId, { key: `${siteId}:theme-site-publish` });
  if (!guard.ok) return guard.response;
  const body = await request.json().catch(() => null) as { approvalId?: string; actor?: string; verifiedBackupReceipt?: Parameters<typeof publishCurrentStateRelational>[0]["verifiedBackupReceipt"] } | null;
  if (!body?.approvalId?.trim()) return NextResponse.json({ error: "publish_approval_required" }, { status: 409 });
  if (!body.verifiedBackupReceipt) return NextResponse.json({ error: "verified_backup_receipt_required" }, { status: 409 });
  try {
    const databaseIdentity = databaseIdentityFromUrl(process.env.DATABASE_URL);
    const result = await publishCurrentStateRelational({
      siteId,
      approvalId: body.approvalId.trim(),
      actor: body.actor ?? "site_admin",
      target: process.env.DATABASE_TARGET?.trim() || "",
      databaseIdentity,
      verifiedBackupReceipt: body.verifiedBackupReceipt
    });
    return NextResponse.json({ ok: true, noOp: result.noOp, currentState: result.state, backupReceipt: result.verifiedBackupReceipt });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "theme_site_publish_failed" }, { status: error instanceof RelationalStoreError ? error.status : 500 });
  }
}
