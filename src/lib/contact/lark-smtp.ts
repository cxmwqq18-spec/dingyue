import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

import type { ContactInquiry, ContactPayload } from "./contact-request";

type ContactMailConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  recipients: Record<ContactInquiry, string>;
};

let transporter: Transporter | undefined;

function readConfig(): ContactMailConfig | undefined {
  const host = process.env.CONTACT_SMTP_HOST?.trim() || "smtp.larksuite.com";
  const port = Number(process.env.CONTACT_SMTP_PORT ?? "465");
  const user = process.env.CONTACT_SMTP_USER?.trim();
  const pass = process.env.CONTACT_SMTP_PASS;
  const from = process.env.CONTACT_FROM_EMAIL?.trim() || user;
  if (!host || !Number.isFinite(port) || !user || !pass || !from) return undefined;
  return {
    host,
    port,
    secure: process.env.CONTACT_SMTP_SECURE !== "false" ? port === 465 : false,
    user,
    pass,
    from,
    recipients: {
      support: process.env.CONTACT_TO_SUPPORT?.trim() || "support@aivideosugc.com",
      business: process.env.CONTACT_TO_BUSINESS?.trim() || "business@aivideosugc.com",
      technical: process.env.CONTACT_TO_TECHNICAL?.trim() || "svcs_creator@aivideosugc.com"
    }
  };
}

export class ContactMailNotConfiguredError extends Error {
  constructor() {
    super("contact_mail_not_configured");
    this.name = "ContactMailNotConfiguredError";
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function transportFor(config: ContactMailConfig): Transporter {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    requireTLS: true,
    connectionTimeout: 12_000,
    greetingTimeout: 12_000,
    socketTimeout: 20_000
  });
  return transporter;
}

/** Send one contact-form message through the configured Lark SMTP mailbox.
 * The recipient is chosen from a fixed server-side map; the submitter's email
 * becomes Reply-To, so replies go straight back to them. */
export async function sendContactEmail(payload: ContactPayload): Promise<{ messageId: string; recipient: string }> {
  const config = readConfig();
  if (!config) throw new ContactMailNotConfiguredError();
  const recipient = config.recipients[payload.inquiry];
  const subject = `[AIVideosUGC Contact][${payload.inquiry}] ${payload.subject}`.replace(/[\r\n]+/g, " ").slice(0, 180);
  const lines = [
    `Name: ${payload.name}`,
    `Email: ${payload.email}`,
    `Company: ${payload.company || "(not provided)"}`,
    `Inquiry type: ${payload.inquiry}`,
    `Subject: ${payload.subject}`,
    "",
    payload.message
  ];
  const text = lines.join("\n");
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">${lines
    .map((line) => line ? `<div>${escapeHtml(line)}</div>` : "<br/>")
    .join("")}</div>`;
  const result = await transportFor(config).sendMail({
    from: config.from,
    to: recipient,
    replyTo: payload.email,
    subject,
    text,
    html
  });
  return { messageId: String(result.messageId ?? ""), recipient };
}
