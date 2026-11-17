import { NextResponse, type NextRequest } from "next/server";
import { requireSiteMutation } from "@/lib/api-auth";
import { sendPartnerApplicationDecisionEmail } from "@/lib/partner-application-email";
import { StoreError } from "@/lib/server-store";
import { updatePartnerApplicationStatusRelational } from "@/lib/stores/partner-application-store";
import type { PartnerApplicationStatus } from "@/lib/types";

const statuses = new Set<PartnerApplicationStatus>(["pending", "approved", "rejected", "archived"]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string; applicationId: string }> }
) {
  const { siteId, applicationId } = await params;
  const guard = await requireSiteMutation(request, siteId, { roles: ["owner", "admin"], key: `${siteId}:partner-application-review` });
  if (!guard.ok) return guard.response;

  const body = (await request.json().catch(() => ({}))) as { status?: PartnerApplicationStatus; reviewNote?: string };
  if (!body.status || !statuses.has(body.status)) {
    return NextResponse.json({ error: "invalid_partner_application_status" }, { status: 400 });
  }

  try {
    const result = await updatePartnerApplicationStatusRelational({
      siteId,
      applicationId,
      status: body.status,
      reviewedBy: guard.current.siteAdmin.id,
      reviewNote: body.reviewNote
    });
    // Decision email rides on the same Resend channel as credit decisions;
    // archived is an ops-only state and stays silent. Failures only log.
    if (body.status === "approved" || body.status === "rejected") {
      await sendPartnerApplicationDecisionEmail({
        siteId,
        to: result.application.email,
        status: body.status,
        note: body.reviewNote
      });
    }
    return NextResponse.json({ ok: true, application: result.application });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "partner_application_review_failed" }, { status });
  }
}
