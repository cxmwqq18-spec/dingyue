import { NextRequest, NextResponse } from "next/server";
import { requireSiteMutation } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import { updateSiteSignupCreditGrantRelational } from "@/lib/stores/site-store";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const guard = await requireSiteMutation(request, siteId, { roles: ["owner", "admin"], key: `${siteId}:signup-credit-grant` });
  if (!guard.ok) return guard.response;

  const body = (await request.json().catch(() => null)) as { signupCreditGrant?: unknown } | null;
  const signupCreditGrant = Number(body?.signupCreditGrant);
  if (!Number.isFinite(signupCreditGrant) || Math.trunc(signupCreditGrant) < 0) {
    return NextResponse.json({ error: "invalid_signup_credit_grant" }, { status: 400 });
  }

  try {
    const result = await updateSiteSignupCreditGrantRelational({
      siteId,
      actor: guard.current.siteAdmin.id,
      signupCreditGrant
    });
    return NextResponse.json({ ok: true, signupCreditGrant: result.site.signupCreditGrant, site: result.site });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "signup_credit_grant_update_failed" }, { status });
  }
}
