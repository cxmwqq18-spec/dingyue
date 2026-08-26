import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string; publicationId: string }> }
) {
  await request;
  await params;
  return NextResponse.json({ error: "legacy_publication_route_retired" }, { status: 410 });
}
