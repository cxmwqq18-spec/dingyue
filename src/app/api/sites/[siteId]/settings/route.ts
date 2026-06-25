import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import { updateSiteSettingsRelational } from "@/lib/stores/site-store";
import type { Site } from "@/lib/types";

export async function PUT(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        actor?: string;
        name?: string;
        status?: Site["status"];
        currency?: string;
        timezone?: string;
        signupCreditGrant?: number;
        branding?: {
          logoText?: string;
          market?: string;
          description?: string;
        };
        connect?: {
          stripeAccountId?: string;
          status?: Site["connect"]["status"];
          chargesEnabled?: boolean;
          payoutsEnabled?: boolean;
        };
      }
    | null;

  if (!body?.name || !body.branding || !body.connect || !body.currency || !body.timezone || !body.status) {
    return NextResponse.json({ error: "invalid_site_settings_payload" }, { status: 400 });
  }

  try {
    const result = await updateSiteSettingsRelational({
      siteId,
      actor: body.actor,
      name: body.name,
      status: body.status,
      currency: body.currency,
      timezone: body.timezone,
      signupCreditGrant: body.signupCreditGrant === undefined ? undefined : Number(body.signupCreditGrant),
      branding: {
        logoText: body.branding.logoText ?? "",
        market: body.branding.market ?? "",
        description: body.branding.description ?? ""
      },
      connect: {
        stripeAccountId: body.connect.stripeAccountId ?? "",
        status: body.connect.status ?? "pending",
        chargesEnabled: Boolean(body.connect.chargesEnabled),
        payoutsEnabled: Boolean(body.connect.payoutsEnabled)
      }
    });
    return NextResponse.json({ ok: true, site: result.site });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "site_settings_update_failed" }, { status });
  }
}
