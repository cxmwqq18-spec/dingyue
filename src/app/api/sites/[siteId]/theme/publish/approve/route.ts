import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireSiteMutation } from "@/lib/api-auth";
import { prisma, runPrismaWriteWithReconnect } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const guard = await requireSiteMutation(request, siteId, {
    roles: ["owner", "admin"],
    key: `${siteId}:theme-publish-approve`
  });
  if (!guard.ok) return guard.response;
  const body = await request.json().catch(() => null) as { approvalId?: string } | null;
  const approvalId = body?.approvalId?.trim();
  if (!approvalId) return NextResponse.json({ error: "publish_approval_required" }, { status: 400 });

  try {
    const approvedBy = guard.current.siteAdmin.email || guard.current.siteAdmin.id;
    const updated = await runPrismaWriteWithReconnect(
      () => prisma.themePublishApproval.updateMany({
        where: {
          id: approvalId,
          siteId,
          status: "pending",
          consumedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
        },
        data: { status: "approved", approvedBy, approvedAt: new Date() }
      }),
      { label: `approve theme publish ${siteId}` }
    );
    if (updated.count !== 1) return NextResponse.json({ error: "publish_approval_unavailable" }, { status: 409 });
    const approval = await prisma.themePublishApproval.findUnique({ where: { id: approvalId }, select: { id: true, status: true, approvedBy: true, approvedAt: true, expiresAt: true } });
    return NextResponse.json({ ok: true, approval });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "publish_approval_failed" }, { status: 500 });
  }
}
