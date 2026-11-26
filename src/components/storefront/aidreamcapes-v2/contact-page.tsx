import type { V2Company } from "./company";
import type { V2Resolvers } from "./types";
import { RichText } from "./parts";
import { ContactForm, type ContactFormConfig } from "./contact-form";
import "./contact-page.css";

export type ContactDirectRow = { role: string; name: string; email: string };
export type ContactPageData = {
  h1: string;
  subtitle: string;
  lead: string;
  form: ContactFormConfig;
  directContacts: ContactDirectRow[];
  footerNote: string;
  faq?: Array<{ q: string; a: string }>;
};

/** /contact-us: the reference page's hero, form and direct contacts, plus the
 * company card and FAQ from the reviewed screenshots. */
export function ContactPage({ data, r, company }: { data: ContactPageData; r: V2Resolvers; company?: V2Company }) {
  return (
    <div className="cp-page">
      <header className="cp-hero">
        <h1>{data.h1}</h1>
        <p className="cp-subtitle">{data.subtitle}</p>
        <p className="cp-lead">{data.lead}</p>
      </header>

      <main className="cp-main">
        <div className="cp-top">
          <section className="cp-card cp-form-card" aria-labelledby="contact-form-title">
            <h2 id="contact-form-title">{data.form.title}</h2>
            <ContactForm form={data.form} />
          </section>

          {company ? (
            <aside className="cp-card cp-company" aria-labelledby="contact-company-title">
              <p className="cp-kicker">Company</p>
              <h2 id="contact-company-title">Company details</h2>
              <p className="cp-company-sub">{company.name} operates AIVIDEOSUGC.</p>
              <div className="cp-company-box">
                <b>{company.name}</b>
                {company.address ? <p>{company.address}</p> : null}
                {company.phone ? <p>Phone: <a href={`tel:${company.phoneHref}`}>{company.phone}</a></p> : null}
                {company.email ? <p>Email: <a href={`mailto:${company.email}`}>{company.email}</a></p> : null}
              </div>
            </aside>
          ) : null}
        </div>

        <section className="cp-card cp-contacts" aria-labelledby="contact-direct-title">
          <h2 id="contact-direct-title">Direct Contacts</h2>
          <div className="cp-table-wrap">
            <table className="cp-table">
              <thead><tr><th>Contact</th><th>Name</th><th>Email</th></tr></thead>
              <tbody>
                {data.directContacts.map((row) => (
                  <tr key={row.role}>
                    <td><span className="cp-label">Contact</span><strong>{row.role}</strong></td>
                    <td><span className="cp-label">Name</span>{row.name}</td>
                    <td><span className="cp-label">Email</span><a href={`mailto:${row.email}`}>{row.email}</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {data.faq?.length ? (
          <section className="cp-faq" aria-labelledby="contact-faq-title">
            <div className="cp-faq-head">
              <p className="cp-kicker">FAQ</p>
              <h2 id="contact-faq-title">Questions</h2>
            </div>
            <div className="cp-faq-list">
              {data.faq.map((item, index) => (
                <details key={item.q} open={index === 0}>
                  <summary>{item.q}<span className="cp-plus" aria-hidden="true">+</span></summary>
                  <div className="cp-answer"><p>{item.a}</p></div>
                </details>
              ))}
            </div>
          </section>
        ) : null}

        <p className="cp-note"><RichText r={r} text={data.footerNote} /></p>
      </main>
    </div>
  );
}
