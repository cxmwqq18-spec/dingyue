import type { NextRequest } from "next/server";
import { assertWorkspaceSite } from "@/lib/aidreamcapes-workspace/store";
import { workspaceResponse, workspaceFailure } from "@/lib/aidreamcapes-workspace/api";
import { getCurrentCustomerForSite } from "@/lib/api-auth";
import { catalogForCustomer } from "@/lib/aidreamcapes-workspace/api";
export const dynamic = "force-dynamic";
export async function GET(_request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  try { const { siteId } = await params; assertWorkspaceSite(siteId); const current = await getCurrentCustomerForSite(siteId); return workspaceResponse({ catalog: await catalogForCustomer(siteId, current?.customer.id) }); }
  catch (error) { return workspaceFailure(error); }
}
