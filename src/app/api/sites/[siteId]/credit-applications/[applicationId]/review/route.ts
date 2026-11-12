import { NextResponse, type NextRequest } from "next/server";
import { requireSiteMutation } from "@/lib/api-auth";
import { sendCreditApplicationDecisionEmail } from "@/lib/credit-application-email";
import { StoreError } from "@/lib/server-store";
import { reviewCreditApplicationRelational } from "@/lib/stores/credit-application-store";

const actions = new Set(["approve", "reject", "archive"]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string; applicationId: string }> }
) {
  const { siteId, applicationId } = await params;
  const guard = await requireSiteMutation(request, siteId, { roles: ["owner", "admin"], key: `${siteId}:credit-application-review` });
  if (!guard.ok) return guard.response;

  const body = (await request.json().catch(() => ({}))) as { action?: string; grantCredits?: number; note?: string };
  if (!body.action || !actions.has(body.action)) {
    return NextResponse.json({ error: "invalid_credit_application_action" }, { status: 400 });
  }

  try {
    const result = await reviewCreditApplicationRelational({
      siteId,
      applicationId,
      action: body.action,
      grantCredits: typeof body.grantCredits === "number" ? body.grantCredits : undefined,
      reviewedBy: guard.current.siteAdmin.id,
      reviewNote: body.note
    });
    // Decision email rides on the same Resend channel; failures only log.
    await sendCreditApplicationDecisionEmail({
      siteId,
      to: result.application.email,
      approved: body.action === "approve",
      grantCredits: result.grantedCredits,
      note: body.note
    });
    return NextResponse.json({ ok: true, application: result.application });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "credit_application_review_failed" }, { status });
  }
}
