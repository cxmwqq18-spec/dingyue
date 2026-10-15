import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { workspaceResponse, workspaceFailure } from "@/lib/aidreamcapes-workspace/api";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  try { const { siteId } = await params; const auth = await workspaceAuth(request, siteId); if (!auth.ok) return auth.response; const balance = await prisma.creditBalance.findFirst({ where: { siteId, customerId: auth.current.customer.id }, select: { balance: true, reserved: true, updatedAt: true } }); return workspaceResponse({ customerBalance: balance }); }
  catch (error) { return workspaceFailure(error); }
}
