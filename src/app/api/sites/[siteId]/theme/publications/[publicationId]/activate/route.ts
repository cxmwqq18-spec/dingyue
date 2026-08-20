import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { requireSiteMutation } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import { activateThemePublicationRelational } from "@/lib/stores/theme-store";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string; publicationId: string }> }
) {
  const { siteId, publicationId } = await params;
  const guard = await requireSiteMutation(request, siteId, { key: `${siteId}:theme-publication-activate` });
  if (!guard.ok) return guard.response;
  const body = (await request.json().catch(() => ({}))) as { actor?: string };
  try {
    const result = await activateThemePublicationRelational(siteId, publicationId, body.actor ?? "site_admin_demo");
    return NextResponse.json({
      ok: true,
      action: "theme_publication_activated",
      publicationId: result.publication.id,
      version: result.publication.version
    });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "theme_publication_activation_failed" }, { status });
  }
}
