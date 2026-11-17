import "server-only";

import { prisma } from "@/lib/prisma";
import { sendResendEmail } from "@/lib/resend-email";
import {
  toPlatformEmailConfig,
  toPlatformEmailSettings,
  toSiteEmailConfigAssignment
} from "@/lib/stores/prisma-mappers";

/** Decision email for a reviewed partner application. Sent over the same Resend
 * channel as the credit-application decision email; failures only log so a
 * review never blocks. The public page promises "an email within 48 hours" and
 * an approval email with the onboarding materials, so approved and rejected
 * applications both answer by mail. Archived is an ops-only state and stays
 * silent. */
export async function sendPartnerApplicationDecisionEmail(params: {
  siteId: string;
  to: string;
  status: "approved" | "rejected";
  note?: string;
}): Promise<void> {
  try {
    const site = await prisma.site.findUnique({
      where: { id: params.siteId },
      select: { id: true, name: true, branding: true }
    });
    if (!site) return;
    const [emailSettings, emailConfigs, siteEmailConfigAssignments] = await Promise.all([
      prisma.platformEmailSettings.findUnique({ where: { id: "platform_email_settings" } }),
      prisma.platformEmailConfig.findMany({ orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }] }),
      prisma.siteEmailConfigAssignment.findMany({ orderBy: [{ siteId: "asc" }] })
    ]);
    const settingsContext = {
      platformEmailSettings: emailSettings ? toPlatformEmailSettings(emailSettings) : undefined,
      platformEmailConfigs: emailConfigs.map(toPlatformEmailConfig),
      siteEmailConfigAssignments: siteEmailConfigAssignments.map(toSiteEmailConfigAssignment)
    };
    const siteName = (site.branding as { logoText?: string } | null)?.logoText || site.name;
    const escapedName = escapeHtml(siteName);

    if (params.status === "approved") {
      const subject = `${siteName}: you're approved as a partner`;
      const noteLine = params.note?.trim() ? `<p style="color:#374151">Reviewer note: ${escapeHtml(params.note.trim())}</p>` : "";
      await sendResendEmail({
        to: params.to,
        subject,
        site: { id: site.id },
        settingsContext,
        text: `Good news — your ${siteName} partner application was approved. Your tracking link, dashboard invite and creative kit are on their way in the onboarding email.`,
        html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
          <h1 style="font-size:20px;margin:0 0 12px">${escapedName}: you're approved as a partner</h1>
          <p>Good news — a real person reviewed your application and it was <b>approved</b>.</p>
          <p>Your <b>tracking link</b>, <b>dashboard invite</b> and <b>creative kit</b> are being sent in the onboarding email — watch for it in the next 48 hours.${noteLine}</p>
          <p>Until then, nothing else is needed from you. Welcome aboard.</p>
        </div>
      `
      });
      return;
    }

    const subject = `${siteName}: update on your partner application`;
    const reason = params.note?.trim() ? escapeHtml(params.note.trim().slice(0, 500)) : "it does not match the program guidelines right now";
    await sendResendEmail({
      to: params.to,
      subject,
      site: { id: site.id },
      settingsContext,
      text: `Thanks for applying to the ${siteName} partner program. After a manual review we are not able to approve this application: ${reason}. You are welcome to apply again once your channel or audience changes.`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
          <h1 style="font-size:20px;margin:0 0 12px">${escapedName}: update on your partner application</h1>
          <p>Thanks for applying to the ${escapedName} partner program. A real person reviewed your application and this time we are <b>not able to approve it</b>.</p>
          <p style="color:#374151">Reason: ${reason}</p>
          <p>You are welcome to apply again once your channel or audience changes — there is no penalty for reapplying.</p>
        </div>
      `
    });
  } catch (error) {
    console.warn("[partner_application_email] decision email failed:", error instanceof Error ? error.message : error);
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}
