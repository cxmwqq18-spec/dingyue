import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { installInternalThemePackageForSite, installSaasThemeForSite, StoreError } from "@/lib/server-store";

export async function POST(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { name?: string; actor?: string; themeKey?: string; installType?: "saas" | "internal" };
  try {
    const result =
      body.installType === "internal"
        ? installInternalThemePackageForSite({
            siteId,
            name: body.name,
            actor: body.actor,
            packageKey: body.themeKey ?? "dreamshoot-ai-studio"
          })
        : installSaasThemeForSite({
            siteId,
            name: body.name,
            actor: body.actor,
            themeKey: body.themeKey
          });
    return NextResponse.json({ ok: true, action: "theme_installed", ...result });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "theme_install_failed" }, { status });
  }
}
