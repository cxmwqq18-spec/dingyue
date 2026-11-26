export const CONTACT_INQUIRIES = ["support", "business", "technical"] as const;
export type ContactInquiry = (typeof CONTACT_INQUIRIES)[number];

export type ContactPayload = {
  name: string;
  email: string;
  company: string;
  inquiry: ContactInquiry;
  subject: string;
  message: string;
};

export type ContactValidation =
  | { ok: true; payload: ContactPayload; spam: boolean }
  | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\r\n/g, "\n").trim().slice(0, max) : "";
}

export function validateContactRequest(input: unknown): ContactValidation {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, error: "invalid_body" };
  const raw = input as Record<string, unknown>;
  // Bots fill hidden fields; accept the request without sending anything.
  if (typeof raw.website === "string" && raw.website.trim()) {
    return { ok: true, spam: true, payload: { name: "", email: "", company: "", inquiry: "support", subject: "", message: "" } };
  }
  const name = text(raw.name, 120);
  const email = text(raw.email, 254);
  const company = text(raw.company, 160);
  const subject = text(raw.subject, 160).replace(/[\r\n]+/g, " ");
  const message = text(raw.message, 6000);
  const inquiryRaw = text(raw.inquiry, 20);
  if (!name) return { ok: false, error: "name_required" };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "email_invalid" };
  if (!subject) return { ok: false, error: "subject_required" };
  if (message.length < 10) return { ok: false, error: "message_too_short" };
  if (!CONTACT_INQUIRIES.includes(inquiryRaw as ContactInquiry)) return { ok: false, error: "inquiry_invalid" };
  return {
    ok: true,
    spam: false,
    payload: { name, email, company, inquiry: inquiryRaw as ContactInquiry, subject, message }
  };
}
