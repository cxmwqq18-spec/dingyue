import { NextResponse } from "next/server";
import { requireSiteMutation } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import { saveThemeSettingsDraftRelational } from "@/lib/stores/theme-store";
import type { ThemeSettings } from "@/lib/types";
import type { NextRequest } from "next/server";

function validOptionalString(value: unknown) {
  return value === undefined || typeof value === "string";
}

function isValidSeoPayload(seo: ThemeSettings["seo"]) {
  if (!seo) return true;
  if (
    typeof seo.siteTitle !== "string" ||
    typeof seo.siteDescription !== "string" ||
    !validOptionalString(seo.siteKeywords) ||
    typeof seo.titleTemplate !== "string" ||
    !validOptionalString(seo.defaultOgImage) ||
    typeof seo.robots?.index !== "boolean" ||
    typeof seo.robots?.follow !== "boolean" ||
    !seo.pages ||
    typeof seo.pages !== "object" ||
    Array.isArray(seo.pages)
  ) {
    return false;
  }
  return Object.values(seo.pages).every((page) =>
    page &&
    typeof page === "object" &&
    typeof page.title === "string" &&
    typeof page.description === "string" &&
    validOptionalString(page.keywords) &&
    validOptionalString(page.ogImage) &&
    validOptionalString(page.canonicalPath) &&
    (page.index === undefined || typeof page.index === "boolean") &&
    (page.follow === undefined || typeof page.follow === "boolean")
  );
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const guard = await requireSiteMutation(request, siteId, { key: `${siteId}:theme-settings-draft` });
  if (!guard.ok) return guard.response;
  const body = (await request.json().catch(() => null)) as { draftJson?: ThemeSettings; expectedRevision?: number; expectedEtag?: string } | null;
  if (!body?.draftJson?.colors || !body.draftJson.typography || !body.draftJson.navigation) {
    return NextResponse.json({ error: "invalid_theme_settings_json" }, { status: 400 });
  }
  if (!isValidSeoPayload(body.draftJson.seo)) {
    return NextResponse.json({ error: "invalid_theme_seo_json" }, { status: 400 });
  }
  try {
    const result = await saveThemeSettingsDraftRelational({
      siteId,
      draftJson: body.draftJson,
      expected: { expectedRevision: body.expectedRevision, expectedEtag: body.expectedEtag },
      requireExpected: true,
      actor: guard.current.siteAdmin.id
    });
    return NextResponse.json({ ok: true, siteId, action: "theme_settings_draft_saved", draftVersion: result.draftVersion });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 404;
    return NextResponse.json({ error: error instanceof Error ? error.message : "theme_settings_save_failed" }, { status });
  }
}
