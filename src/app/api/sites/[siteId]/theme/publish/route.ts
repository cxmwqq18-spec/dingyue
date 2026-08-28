import { NextResponse } from "next/server";

import { requireSiteMutation } from "@/lib/api-auth";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const guard = await requireSiteMutation(request, siteId, { key: `${siteId}:theme-site-publish` });
  if (!guard.ok) return guard.response;
  await request;
  return NextResponse.json({ error: "legacy_publication_route_retired" }, { status: 410 });
}
