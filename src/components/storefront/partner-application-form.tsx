"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";

export type PartnerApplicationField = {
  id: string;
  label: string;
  placeholder?: string;
  fieldType: "text" | "email" | "textarea" | "checkbox";
  required?: boolean;
};

export function PartnerApplicationForm({
  fields,
  siteId,
  dark
}: {
  fields: PartnerApplicationField[];
  siteId: string;
  dark?: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get("website_url")) return;
    setStatus("submitting");
    setMessage("");
    const payload = {
      name: String(form.get("Full name") ?? ""),
      email: String(form.get("Email address") ?? ""),
      website: String(form.get("Website") ?? ""),
      socialLinks: String(form.get("Primary channel links") ?? ""),
      audience: String(form.get("Audience and niche") ?? ""),
      cadence: String(form.get("Publishing cadence") ?? ""),
      campaignIdeas: String(form.get("Campaign ideas") ?? ""),
      message: String(form.get("Additional notes") ?? ""),
      source: "partner-registration"
    };
    const response = await fetch(`/api/sites/${siteId}/partner-applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result?.error) {
      setStatus("error");
      setMessage(String(result?.error ?? "partner_application_submit_failed"));
      return;
    }
    setStatus("success");
    setMessage("Thanks. Your partner application is in review.");
    event.currentTarget.reset();
  }

  const fieldClass = dark
    ? "w-full rounded-[16px] border border-white/12 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/34 focus:border-white/36"
    : "w-full rounded-[16px] border border-[#ded5ca] bg-white/82 px-4 py-3 text-sm text-[#14161a] outline-none placeholder:text-[#9a8f84] focus:border-[#14161a]/40";
  return (
    <form className="grid gap-4" onSubmit={submit}>
      <input name="website_url" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      {fields.map((field) => (
        <label className={dark ? "grid gap-2 text-sm font-semibold text-white/86" : "grid gap-2 text-sm font-semibold text-[#14161a]"} key={field.id}>
          {field.fieldType === "checkbox" ? (
            <span className={dark ? "flex items-start gap-3 rounded-[16px] border border-white/12 bg-black/18 p-4 text-sm leading-6 text-white/72" : "flex items-start gap-3 rounded-[16px] border border-[#ded5ca] bg-white/70 p-4 text-sm leading-6 text-[#625d56]"}>
              <input className="mt-1 h-4 w-4 shrink-0 accent-[#ec4bdd]" name={field.label} type="checkbox" required={field.required} aria-label={field.label} />
              <span>{field.label}{field.required ? " *" : ""}</span>
            </span>
          ) : (
            <>
              <span>{field.label}{field.required ? " *" : ""}</span>
              {field.fieldType === "textarea" ? (
                <textarea className={`${fieldClass} min-h-[112px] resize-y`} name={field.label} placeholder={field.placeholder} required={field.required} />
              ) : (
                <input className={fieldClass} name={field.label} placeholder={field.placeholder} required={field.required} type={field.fieldType === "email" ? "email" : "text"} />
              )}
            </>
          )}
        </label>
      ))}
      {message ? (
        <p className={status === "success" ? "flex items-center gap-2 text-sm font-semibold text-[#34d399]" : "text-sm font-semibold text-[#ff8a8a]"}>
          {status === "success" ? <CheckCircle2 className="h-4 w-4" /> : null}
          {message}
        </p>
      ) : null}
      <button className={dark ? "inline-flex w-full items-center justify-center gap-2 rounded-[16px] bg-white px-5 py-3 text-sm font-semibold text-[#14161a] transition hover:-translate-y-0.5 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70" : "inline-flex w-full items-center justify-center gap-2 rounded-[16px] bg-[#14161a] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"} type="submit" disabled={status === "submitting"}>
        {status === "submitting" ? "Submitting..." : "Submit application"}
        <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
      </button>
    </form>
  );
}
