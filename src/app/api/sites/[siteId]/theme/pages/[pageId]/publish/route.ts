import { NextResponse } from "next/server";
import { requireSiteMutation } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import { publishDraftPageRelational } from "@/lib/stores/theme-store";
import type { NextRequest } from "next/server";

type DraftVersionPayload = {
  revision?: number;
  etag?: string;
  expectedRevision?: number;
  expectedEtag?: string;
};

function expectedDraftVersion(value?: DraftVersionPayload) {
  if (!value) return undefined;
  return {
    expectedRevision: value.expectedRevision ?? value.revision,
    expectedEtag: value.expectedEtag ?? value.etag
  };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string; pageId: string }> }) {
  const { siteId, pageId } = await params;
  const guard = await requireSiteMutation(request, siteId, { key: `${siteId}:theme-publish` });
  if (!guard.ok) return guard.response;
  const body = (await request.json().catch(() => ({}))) as {
    actor?: string;
    expectedRevision?: number;
    expectedEtag?: string;
    expectedPageVersions?: Record<string, DraftVersionPayload | undefined>;
    expectedSettingsVersion?: DraftVersionPayload;
    expectedPublishedVersion?: number;
    acknowledgedGlobalVisualChanges?: boolean;
  };
  try {
    const expectedPageVersions = body.expectedPageVersions
      ? Object.fromEntries(
          Object.entries(body.expectedPageVersions).map(([id, version]) => [id, expectedDraftVersion(version)])
        )
      : undefined;
    const result = await publishDraftPageRelational(siteId, pageId, body.actor ?? "site_admin_demo", {
      expectedRevision: body.expectedRevision,
      expectedEtag: body.expectedEtag,
      pageVersions: expectedPageVersions,
      settingsVersion: expectedDraftVersion(body.expectedSettingsVersion),
      expectedPublishedVersion: body.expectedPublishedVersion,
      requireSnapshotVersions: true,
      acknowledgedGlobalVisualChanges: body.acknowledgedGlobalVisualChanges === true
    });
    return NextResponse.json({
      ok: true,
      siteId,
      pageId,
      action: "published",
      publishedVersion: result.publishedVersion,
      draftVersion: result.draftVersion,
      pageDraftVersions: result.pageDraftVersions,
      settingsDraftVersion: result.settingsDraftVersion
    });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 404;
    return NextResponse.json({ error: error instanceof Error ? error.message : "publish_failed" }, { status });
  }
}
