import "server-only";

import { prisma } from "@/lib/prisma";
import { sendResendEmail } from "@/lib/resend-email";
import { creditLabel } from "@/lib/format-credits";
import {
  toPlatformEmailConfig,
  toPlatformEmailSettings,
  toSiteEmailConfigAssignment
} from "@/lib/stores/prisma-mappers";

/** Decision email for a reviewed credit application. Sent over the same Resend
 * channel as verification codes; failures only log so reviews never block. */
export async function sendCreditApplicationDecisionEmail(params: {
  siteId: string;
  to: string;
  approved: boolean;
  grantCredits?: number;
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

    if (params.approved) {
      const credits = Math.max(0, Math.trunc(Number(params.grantCredits ?? 0)));
      const videos = Math.floor(credits / 20);
      const subject = `${siteName}: your free credits are live`;
      const noteLine = params.note?.trim() ? `<p style="color:#374151">Reviewer note: ${escapeHtml(params.note.trim())}</p>` : "";
      await sendResendEmail({
        to: params.to,
        subject,
        site: { id: site.id },
        settingsContext,
        text: `Good news — your free-credit application was approved. ${creditLabel(credits)} ${credits === 1 ? "was" : "were"} added to your ${siteName} balance (a 15s video costs about 20 credits). Log in to start your next video.${params.note?.trim() ? `\n\nReviewer note: ${params.note.trim()}` : ""}`,
        html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
          <h1 style="font-size:20px;margin:0 0 12px">${escapedName}: your free credits are live</h1>
          <p>Good news — a real person reviewed your application and it was <b>approved</b>.</p>
          <p style="font-size:24px;font-weight:700;margin:20px 0">+${creditLabel(credits)}</p>
          <p>The credits are already on your balance. A 15s video costs about 20 credits, so that is roughly ${videos} ${videos === 1 ? "video" : "videos"} on us.${noteLine}</p>
          <p>Log in and start your next video.</p>
        </div>
      `
      });
      return;
    }

    const subject = `${siteName}: update on your credit application`;
    const reason = params.note?.trim() ? escapeHtml(params.note.trim().slice(0, 500)) : "it does not match the program guidelines right now";
    await sendResendEmail({
      to: params.to,
      subject,
      site: { id: site.id },
      settingsContext,
      text: `Thanks for applying for free credits at ${siteName}. After a manual review we are not able to approve this application: ${reason}. You are welcome to apply again once your situation changes.`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
          <h1 style="font-size:20px;margin:0 0 12px">${escapedName}: update on your credit application</h1>
          <p>Thanks for applying for free credits. A real person reviewed your application and this time we are <b>not able to approve it</b>.</p>
          <p style="color:#374151">Reason: ${reason}</p>
          <p>You are welcome to apply again once your situation changes — for example after posting more #AIVideosUGC content.</p>
        </div>
      `
    });
  } catch (error) {
    console.warn("[credit_application_email] decision email failed:", error instanceof Error ? error.message : error);
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
