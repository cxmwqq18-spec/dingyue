"use client";

import { useState } from "react";

export type ContactFormField = {
  name: string;
  label: string;
  type: "text" | "email" | "textarea" | "select";
  required?: boolean;
  autocomplete?: string;
  full?: boolean;
  span2?: boolean;
  options?: Array<{ value: string; label: string }>;
};

export type ContactFormConfig = {
  title: string;
  fields: ContactFormField[];
  button: string;
  note: string;
  recipients: Record<string, string>;
};

type Status = "idle" | "sending" | "sent" | "error";

/** Submits the contact form to the isolated /api/contact route. The route picks
 * the recipient; the page keeps a direct mailto fallback for outages. */
export function ContactForm({ form }: { form: ContactFormConfig }) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const fallback = form.recipients.support ?? "support@aivideosugc.com";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending") return;
    const element = event.currentTarget;
    const payload = Object.fromEntries(new FormData(element).entries());
    setStatus("sending");
    setError("");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) {
        setStatus("error");
        setError(result.error === "rate_limited"
          ? "Too many messages from this connection. Try again later."
          : "The message could not be sent. Try again, or email us directly.");
        return;
      }
      element.reset();
      setStatus("sent");
    } catch {
      setStatus("error");
      setError("The message could not be sent. Try again, or email us directly.");
    }
  }

  return (
    <form className="cp-form" onSubmit={onSubmit}>
      <div className="cp-hp" aria-hidden="true">
        <label htmlFor="contact-website">Website</label>
        <input autoComplete="off" id="contact-website" name="website" tabIndex={-1} type="text" />
      </div>
      <div className="cp-form-grid">
        {form.fields.map((field) => {
          const id = `contact-${field.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
          const className = `cp-field${field.full ? " cp-full" : ""}${field.span2 ? " cp-span2" : ""}`;
          return (
            <div className={className} key={field.name}>
              <label htmlFor={id}>{field.label} {field.required ? <span className="cp-req">*</span> : null}</label>
              {field.type === "textarea" ? (
                <textarea id={id} name={field.name} required={field.required} />
              ) : field.type === "select" ? (
                <select id={id} name={field.name} required={field.required}>
                  {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              ) : (
                <input autoComplete={field.autocomplete} id={id} name={field.name} required={field.required} type={field.type} />
              )}
            </div>
          );
        })}
      </div>
      <div className="cp-actions">
        <button className="btn btn-grad" disabled={status === "sending"} type="submit">
          {status === "sending" ? "Sending…" : form.button}
        </button>
      </div>
      {status === "sent" ? <p className="cp-status cp-ok" role="status">Message sent. We will reply by email.</p> : null}
      {status === "error" ? (
        <p className="cp-status cp-error" role="alert">
          {error} <a href={`mailto:${fallback}`}>{fallback}</a>
        </p>
      ) : null}
      <p className="cp-hint">{form.note}</p>
    </form>
  );
}
