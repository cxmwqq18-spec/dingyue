import { NextResponse } from "next/server";

import { requireSiteMutation } from "@/lib/api-auth";
import { RelationalStoreError } from "@/lib/stores/prisma-mappers";
import { publishDraftSiteRelational, type StorefrontPublishManifest } from "@/lib/stores/theme-store";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const guard = await requireSiteMutation(request, siteId, { key: `${siteId}:theme-site-publish` });
  if (!guard.ok) return guard.response;
  const body = await request.json().catch(() => null) as { manifest?: StorefrontPublishManifest; actor?: string } | null;
  if (!body?.manifest) return NextResponse.json({ error: "publish_manifest_required" }, { status: 409 });
  const manifest = body.manifest;
  if (
    !Array.isArray(manifest.pageIds) ||
    !manifest.pageIds.every((pageId) => typeof pageId === "string" && pageId.trim()) ||
    !manifest.pageVersions || typeof manifest.pageVersions !== "object" || Array.isArray(manifest.pageVersions) ||
    typeof manifest.includeThemeSettings !== "boolean" ||
    typeof manifest.includeStorefrontProfile !== "boolean" ||
    typeof manifest.manifestHash !== "string" || !manifest.manifestHash
  ) {
    return NextResponse.json({ error: "publish_manifest_invalid" }, { status: 409 });
  }
  try {
    const result = await publishDraftSiteRelational(siteId, manifest, body.actor ?? "site_admin");
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "theme_site_publish_failed" }, { status: error instanceof RelationalStoreError ? error.status : 500 });
  }
}
