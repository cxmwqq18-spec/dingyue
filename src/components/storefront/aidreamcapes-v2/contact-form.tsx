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

/** The HTML reference form is a mailto: form; the inquiry select swaps the
 * recipient. Nothing is collected server-side in this mode. */
export function ContactForm({ form }: { form: ContactFormConfig }) {
  const inquiry = form.fields.find((field) => field.type === "select");
  const [selected, setSelected] = useState(inquiry?.options?.[0]?.value ?? "support");
  const to = form.recipients[selected] ?? form.recipients.support ?? "support@aivideosugc.com";
  return (
    <form action={`mailto:${to}`} className="cp-form" encType="text/plain" method="post">
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
                <select
                  id={id}
                  name={field.name}
                  onChange={(event) => setSelected(event.target.value)}
                  required={field.required}
                  value={selected}
                >
                  {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              ) : (
                <input
                  autoComplete={field.autocomplete}
                  id={id}
                  name={field.name}
                  required={field.required}
                  type={field.type}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="cp-actions"><button className="btn btn-grad" type="submit">{form.button}</button></div>
      <p className="cp-hint">{form.note}</p>
    </form>
  );
}
