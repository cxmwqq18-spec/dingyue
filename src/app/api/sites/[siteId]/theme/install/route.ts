import { NextResponse } from "next/server";
import { requireSiteMutation } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import { installInternalThemePackageForSiteRelational, installSaasThemeForSiteRelational } from "@/lib/stores/theme-store";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const guard = await requireSiteMutation(request, siteId, { roles: ["owner", "admin"], key: `${siteId}:theme-install` });
  if (!guard.ok) return guard.response;
  const body = (await request.json().catch(() => ({}))) as { name?: string; actor?: string; themeKey?: string; installType?: "saas" | "internal" };
  try {
    const result =
      body.installType === "internal"
        ? await installInternalThemePackageForSiteRelational({
            siteId,
            name: body.name,
            actor: body.actor,
            packageKey: body.themeKey ?? "dreamshoot-ai-studio"
          })
        : await installSaasThemeForSiteRelational({
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
