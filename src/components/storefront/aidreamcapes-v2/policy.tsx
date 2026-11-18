import type { SectionInstance } from "@/lib/types";
import { addHeadingIds, headingsFromHtml } from "@/components/storefront/aidreamcapes-public-section";
import type { V2Company } from "./company";
import { Crumbs } from "./parts";
import type { V2Resolvers } from "./types";

// Aidreamcapes.com v2 layout for the policy pages. The legal text, dates and contact
// details come unchanged from the page's own policy_content (and optional intro)
// section in LivePage.contentJson; only the presentation follows the v2 site.

const POLICY_LINKS = [
  ["Privacy Policy", "/privacy"],
  ["Terms of Service", "/terms"],
  ["Refund Policy", "/refunds"],
  ["Cookie Policy", "/cookies"],
  ["Content Policy", "/content"],
  ["Digital Delivery", "/digital-delivery"],
  ["Children's Privacy", "/children-privacy"],
  ["State Privacy", "/state-privacy"]
] as const;

function text(section: SectionInstance | undefined, key: string): string {
  const value = section?.settings?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function plainText(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function isAidreamcapesV2PolicyPage(sections: SectionInstance[], pagePath: string): boolean {
  return pagePath !== "/contact-us" && sections.some((section) => section.type === "policy_content");
}

export function AidreamcapesV2PolicyPage({ sections, pagePath, supportEmail, r, company }: { sections: SectionInstance[]; pagePath: string; supportEmail?: string; r: V2Resolvers; company?: V2Company }) {
  const policy = sections.find((section) => section.type === "policy_content");
  const intro = sections.find((section) => section.type === "rich_text");
  // The page heading is the more descriptive of the intro and policy titles, which keeps
  // each policy page's existing H1.
  const introTitle = text(intro, "title");
  const policyTitle = text(policy, "title");
  const title = (introTitle.length >= policyTitle.length ? introTitle : policyTitle) || "Policy";
  const eyebrow = text(intro, "eyebrow") || text(policy, "eyebrow") || "Policy";
  const lead = plainText(text(intro, "subtitle") || text(intro, "body"));
  const body = text(policy, "body");
  const bodyHtml = addHeadingIds(body);
  const headings = headingsFromHtml(bodyHtml);
  const lastUpdated = text(policy, "lastUpdated");
  const contactEmail = text(policy, "contactEmail") || supportEmail || "";
  const rawSummary = policy?.settings?.summary;
  const summary: string[] = [];
  if (Array.isArray(rawSummary)) for (const item of rawSummary) if (typeof item === "string" && item.trim()) summary.push(item.trim());
  return (
    <>
      <Crumbs items={[{ label: "Home", href: "/" }, { label: title, href: pagePath }]} r={r} />
      <section className="phero legal-hero">
        <div className="wrap">
          <div className="eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
          {lead ? <p className="lead">{lead}</p> : null}
          <div className="legal-meta">
            {lastUpdated ? <span>Last updated: {lastUpdated}</span> : null}
            {company ? <span>Operated by {[company.name, company.address].filter(Boolean).join(", ")}</span> : null}
            {contactEmail ? <span>Questions: <a href={`mailto:${contactEmail}`}>{contactEmail}</a></span> : null}
          </div>
        </div>
      </section>
      {summary.length ? (
        <section className="legal-glance">
          <div className="wrap">
            <div className="glance">
              <h2>At a glance</h2>
              <p>A plain-language summary. The full policy below is the version that applies.</p>
              <ul className="check">{summary.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          </div>
        </section>
      ) : null}
      <section className="sec legal-sec">
        <div className={headings.length ? "wrap legal-grid" : "wrap"}>
          {headings.length ? (
            <aside className="legal-toc">
              <div className="ph">On this page</div>
              <nav aria-label="Policy contents">
                {headings.map((heading) => <a href={`#${heading.id}`} key={heading.id}>{heading.label}</a>)}
              </nav>
            </aside>
          ) : null}
          <article className="legal-body" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
        </div>
      </section>
      <section className="sec legal-links-sec">
        <div className="wrap">
          <div className="ph">Other policies</div>
          <div className="legal-links">
            {POLICY_LINKS.filter(([, href]) => href !== pagePath).map(([label, href]) => (
              <a href={r.href(href)} key={href}>{label}</a>
            ))}
            <a href={r.href("/contact-us")}>Contact Support</a>
          </div>
        </div>
      </section>
    </>
  );
}
