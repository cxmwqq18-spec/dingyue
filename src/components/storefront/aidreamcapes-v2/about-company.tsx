import type { ReactNode } from "react";
import { RichText } from "./parts";
import type { V2Company } from "./company";
import type { V2Resolvers } from "./types";
import "./about-company.css";

type AboutNavLink = { label: string; href: string };
type AboutStat = { num: string; label: string };
type AboutInfoRow = { label: string; value: string; href?: string };
type AboutFeature = { tag: string; title: string; text: string };
type AboutFeatureGroup = { title: string; items: AboutFeature[] };
type AboutMember = {
  name: string;
  role: string;
  bio: string;
  photo: string;
  photoAlt: string;
  width: number;
  height: number;
  initials?: string;
  linkedin?: string;
};
type AboutTeamGroup = { title: string; kind: "leadership" | "specialists" | "support"; members: AboutMember[] };
type AboutFaqItem = { q: string; a: string };

export type AboutCompanyData = {
  eyebrow: string;
  h1: string;
  lede: string;
  heroImage: { src: string; alt: string; width: number; height: number };
  overview: string;
  nav: AboutNavLink[];
  company: {
    id: string;
    kicker: string;
    title: string;
    paragraphs: string[];
    subBlocks: { title: string; paragraphs: string[] }[];
    stats: AboutStat[];
    infoTable: AboutInfoRow[];
  };
  solutions: { id: string; kicker: string; title: string; paragraphs: string[]; groups: AboutFeatureGroup[] };
  process: { id: string; kicker: string; title: string; paragraphs: string[]; listTitle: string; items: string[] };
  audience: { id: string; kicker: string; title: string; items: { title: string; text: string; note: string }[] };
  comparison: {
    id: string;
    kicker: string;
    title: string;
    paragraphs: string[];
    table: { headers: string[]; rows: string[][] };
  };
  team: { id: string; kicker: string; title: string; image: { src: string; alt: string; width: number; height: number }; groups: AboutTeamGroup[] };
  partners: {
    id: string;
    kicker: string;
    title: string;
    lead: string;
    groups: AboutFeatureGroup[];
    criteriaNote?: string;
    stepsTitle: string;
    steps: { title: string; text: string }[];
    benefitCols: { title: string; items: string[]; note?: string }[];
  };
  faq: { id: string; kicker: string; title: string; items: AboutFaqItem[] };
  cta: { title: string; text: string; label: string; href: string };
};

function SectionHead({ kicker, title, id, as = "h2" }: { kicker: string; title: string; id?: string; as?: "h2" }) {
  return (
    <div className="section-head">
      <div className="kicker">{kicker}</div>
      {as === "h2" ? <h2 id={id}>{title}</h2> : <h3 id={id}>{title}</h3>}
    </div>
  );
}

function Paragraphs({ items, r }: { items: string[]; r: V2Resolvers }) {
  if (!items.length) return null;
  return <>{items.map((item, index) => <p key={index}><RichText r={r} text={item} /></p>)}</>;
}

function FeatureList({ items }: { items: AboutFeature[] }) {
  if (!items.length) return null;
  return (
    <div className="feature-list">
      {items.map((item) => (
        <div className="feature" key={`${item.tag}-${item.title}`}>
          <span className="tag">{item.tag}</span>
          <h4>{item.title}</h4>
          <p>{item.text}</p>
        </div>
      ))}
    </div>
  );
}

function TeamMember({ member, r }: { member: AboutMember; r: V2Resolvers }) {
  return (
    <div className="member">
      <img
        alt={member.photoAlt}
        className="preview-portrait"
        decoding="async"
        height={member.height}
        loading="lazy"
        src={r.asset(member.photo)}
        width={member.width}
      />
      {member.initials ? <div aria-hidden="true" className="avatar">{member.initials}</div> : null}
      <h4>{member.name}</h4>
      <div className="role">{member.role}</div>
      <p>{member.bio}</p>
      {member.linkedin ? (
        <a className="linkedin" href={member.linkedin} rel="noopener noreferrer" target="_blank">{`LinkedIn \u2192`}</a>
      ) : null}
    </div>
  );
}

function LeadershipMember({ member, r }: { member: AboutMember; r: V2Resolvers }) {
  return (
    <div className="member-with-photo full-width">
      <div className="member-photo">
        <img
          alt={member.photoAlt}
          className="preview-portrait"
          decoding="async"
          height={member.height}
          loading="lazy"
          src={r.asset(member.photo)}
          width={member.width}
        />
      </div>
      <div className="member-info">
        <h4>{member.name}</h4>
        <div className="role">{member.role}</div>
        <p>{member.bio}</p>
        {member.linkedin ? (
          <a className="linkedin" href={member.linkedin} rel="noopener noreferrer" target="_blank">{`LinkedIn \u2192`}</a>
        ) : null}
      </div>
    </div>
  );
}

function GroupHeading({ children }: { children: ReactNode }) {
  return <h3>{children}</h3>;
}

export function AboutCompanyPage({ data, r, company }: { data: AboutCompanyData; r: V2Resolvers; company?: V2Company }) {
  const { company: companySection, solutions, process, audience, comparison, team, partners, faq, cta } = data;
  // The company name, address and phone are site identity fields. The footer
  // and Organization structured data read the same record, so the About table
  // renders those values instead of a second hand-typed copy.
  const companyRow = (row: AboutInfoRow): { value: string; href?: string } => {
    if (row.label === "Company address" && company?.address) return { value: company.address };
    if (row.label === "Phone" && company?.phone) return { value: company.phone, href: `tel:${company.phoneHref}` };
    if (row.label === "Email" && company?.email) return { value: company.email, href: `mailto:${company.email}` };
    return { value: row.value, href: row.href };
  };
  return (
    <div className="adc-about">
      <div className="page">
        <header className="hero">
          <div className="hero-copy">
            <span className="eyebrow">{data.eyebrow}</span>
            <h1>{data.h1}</h1>
            <p className="lede">{data.lede}</p>
          </div>
          <figure className="office-view">
            <img
              alt={data.heroImage.alt}
              decoding="async"
              fetchPriority="high"
              height={data.heroImage.height}
              src={r.asset(data.heroImage.src)}
              width={data.heroImage.width}
            />
          </figure>
        </header>

        <div className="overview"><RichText r={r} text={data.overview} /></div>

        <nav aria-label="On this page" className="about-nav">
          {data.nav.map((item) => <a href={item.href} key={item.href}>{item.label}</a>)}
        </nav>

        <section id={companySection.id}>
          <SectionHead kicker={companySection.kicker} title={companySection.title} />
          <div className="company-layout">
            <div>
              <Paragraphs items={companySection.paragraphs} r={r} />
              {companySection.subBlocks.map((block) => (
                <div key={block.title}>
                  <GroupHeading>{block.title}</GroupHeading>
                  <Paragraphs items={block.paragraphs} r={r} />
                </div>
              ))}
              {companySection.stats.length ? (
                <div className="origin">
                  {companySection.stats.map((stat) => (
                    <div className="stat" key={stat.label}>
                      <div className="num">{stat.num}</div>
                      <div className="label">{stat.label}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="card" style={{ marginTop: 24 }}>
              <table className="info-table">
                <tbody>
                  {companySection.infoTable.map((row) => {
                    const display = companyRow(row);
                    return (
                      <tr key={row.label}>
                        <th scope="row">{row.label}</th>
                        <td>{display.href ? <a href={display.href}>{display.value}</a> : display.value}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section id={solutions.id}>
          <SectionHead kicker={solutions.kicker} title={solutions.title} />
          <Paragraphs items={solutions.paragraphs} r={r} />
          {solutions.groups.map((group) => (
            <div key={group.title}>
              <GroupHeading>{group.title}</GroupHeading>
              <FeatureList items={group.items} />
            </div>
          ))}
        </section>

        <section id={process.id}>
          <SectionHead kicker={process.kicker} title={process.title} />
          <Paragraphs items={process.paragraphs} r={r} />
          <GroupHeading>{process.listTitle}</GroupHeading>
          <ul className="check-list">
            {process.items.map((item, index) => <li key={index}><RichText r={r} text={item} /></li>)}
          </ul>
        </section>

        <section id={audience.id}>
          <SectionHead kicker={audience.kicker} title={audience.title} />
          <ul className="serve-list">
            {audience.items.map((item) => (
              <li key={item.title}>
                <strong>{item.title}</strong>
                {item.text}
                {item.note ? <em>{item.note}</em> : null}
              </li>
            ))}
          </ul>
        </section>

        <section id={comparison.id}>
          <SectionHead kicker={comparison.kicker} title={comparison.title} id="comparison-heading" />
          <Paragraphs items={comparison.paragraphs} r={r} />
          <div aria-labelledby="comparison-heading" className="compare-wrap" role="region" tabIndex={0}>
            <table className="compare">
              <thead>
                <tr>{comparison.table.headers.map((header) => <th key={header} scope="col">{header}</th>)}</tr>
              </thead>
              <tbody>
                {comparison.table.rows.map((row) => (
                  <tr key={row[0]}>
                    {row.map((cell, index) => index === 0 ? <td key={index}>{cell}</td> : <td key={index}>{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id={team.id}>
          <SectionHead kicker={team.kicker} title={team.title} />
          <figure className="office-view">
            <img
              alt={team.image.alt}
              decoding="async"
              height={team.image.height}
              loading="lazy"
              src={r.asset(team.image.src)}
              width={team.image.width}
            />
          </figure>
          {team.groups.map((group) => (
            <div className={`team-group team-${group.kind}`} key={group.title}>
              <GroupHeading>{group.title}</GroupHeading>
              <div className="team-grid">
                {group.members.map((member) => group.kind === "leadership"
                  ? <LeadershipMember key={member.name} member={member} r={r} />
                  : <TeamMember key={member.name} member={member} r={r} />)}
              </div>
            </div>
          ))}
        </section>

        <section id={partners.id}>
          <SectionHead kicker={partners.kicker} title={partners.title} />
          <p><RichText r={r} text={partners.lead} /></p>
          {partners.groups.map((group) => (
            <div key={group.title}>
              <GroupHeading>{group.title}</GroupHeading>
              <FeatureList items={group.items} />
            </div>
          ))}
          {partners.criteriaNote ? <p style={{ marginTop: 20 }}>{partners.criteriaNote}</p> : null}
          <GroupHeading>{partners.stepsTitle}</GroupHeading>
          <div className="steps">
            {partners.steps.map((step) => (
              <div className="step" key={step.title}>
                <h4>{step.title}</h4>
                <p>{step.text}</p>
              </div>
            ))}
          </div>
          <div className="partner-benefits">
            {partners.benefitCols.map((column) => (
              <div key={column.title}>
                <GroupHeading>{column.title}</GroupHeading>
                <ul className="check-list">
                  {column.items.map((item, index) => <li key={index}><RichText r={r} text={item} /></li>)}
                </ul>
                {column.note ? <p style={{ marginTop: 16 }}>{column.note}</p> : null}
              </div>
            ))}
          </div>
        </section>

        <section id={faq.id}>
          <SectionHead kicker={faq.kicker} title={faq.title} />
          <div className="faq-list">
            {faq.items.map((item, index) => (
              <details className="faq" key={item.q} open={index === 0 || undefined}>
                <summary>{item.q}</summary>
                <div className="answer"><RichText r={r} text={item.a} /></div>
              </details>
            ))}
          </div>
        </section>

        <div className="cta">
          <h2>{cta.title}</h2>
          <p>{cta.text}</p>
          <a className="btn" href={r.href(cta.href)}>{cta.label}</a>
        </div>
      </div>
    </div>
  );
}
