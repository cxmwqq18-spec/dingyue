import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { saveThemeSettingsDraftRelational } from "@/lib/stores/theme-store";
import type { ThemeSettings } from "@/lib/types";

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

export async function PUT(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { draftJson?: ThemeSettings } | null;
  if (!body?.draftJson?.colors || !body.draftJson.typography || !body.draftJson.navigation) {
    return NextResponse.json({ error: "invalid_theme_settings_json" }, { status: 400 });
  }
  if (!isValidSeoPayload(body.draftJson.seo)) {
    return NextResponse.json({ error: "invalid_theme_seo_json" }, { status: 400 });
  }
  try {
    await saveThemeSettingsDraftRelational({ siteId, draftJson: body.draftJson });
    return NextResponse.json({ ok: true, siteId, action: "theme_settings_draft_saved" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "theme_settings_save_failed" }, { status: 404 });
  }
}
