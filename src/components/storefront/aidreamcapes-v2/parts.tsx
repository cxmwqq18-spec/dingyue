import type { CSSProperties, ReactNode } from "react";
import type { V2Article, V2BenefitIcon, V2Card, V2CompareTable, V2Crumb, V2Definition, V2EnrichmentBlock, V2EnrichmentSection, V2Examples, V2Example, V2Faq, V2FitBlock, V2HeroMedia, V2Image, V2ImageItem, V2Item, V2Maker, V2MoreSection, V2Plan, V2Resolvers, V2SpecRow, V2TextSection, V2Tool, V2Video, V2GlossaryEntry, V2DirectorySpecs, V2DirectoryScene } from "./types";
import type { V2Company } from "./company";

export function normalizeStepLabel(label: string): string {
  return ["Product photo", "Your photo", "Photo"].includes(label.trim()) ? "Your product" : label;
}

// Each candidate in a stored srcset goes through the same asset resolver as the main file.
function resolveSrcSet(srcSet: string, r: V2Resolvers): string {
  return srcSet
    .split(",")
    .map((part) => {
      const [url, size] = part.trim().split(/\s+/);
      return `${r.asset(url)} ${size}`;
    })
    .join(", ");
}

export function Img({ image, r, className, eager, style }: { image: V2Image; r: V2Resolvers; className?: string; eager?: boolean; style?: CSSProperties }) {
  return (
    <img
      alt={image.alt}
      className={className}
      decoding="async"
      fetchPriority={eager ? "high" : undefined}
      height={image.height}
      loading={eager ? "eager" : "lazy"}
      style={style}
      sizes={image.srcSet ? image.sizes : undefined}
      src={r.asset(image.src)}
      srcSet={image.srcSet ? resolveSrcSet(image.srcSet, r) : undefined}
      width={image.width}
    />
  );
}

export function Crumbs({ items, r }: { items: V2Crumb[]; r: V2Resolvers }) {
  if (!items.length) return null;
  return (
    <div className="wrap">
      <nav aria-label="Breadcrumb" className="crumbs">
        {items.map((item, index) => (
          <span key={`${item.href}-${index}`} style={{ display: "contents" }}>
            {index > 0 ? <span aria-hidden="true">›</span> : null}
            {index === items.length - 1 ? <span>{item.label}</span> : <a href={r.href(item.href)}>{item.label}</a>}
          </span>
        ))}
      </nav>
    </div>
  );
}

export function SecHead({ eyebrow, title, lead }: { eyebrow: string; title: string; lead?: string }) {
  return (
    <div className="sec-head">
      <div className="eyebrow">{eyebrow}</div>
      <h2>{title}</h2>
      {lead ? <p>{lead}</p> : null}
    </div>
  );
}

export function Section({ eyebrow, title, lead, children, id }: { eyebrow: string; title: string; lead?: string; children: ReactNode; id?: string }) {
  return (
    <section className="sec" id={id}>
      <div className="wrap">
        <SecHead eyebrow={eyebrow} lead={lead} title={title} />
        {children}
      </div>
    </section>
  );
}

export function Intro({ paras, r }: { paras: string[]; r?: V2Resolvers }) {
  if (!paras.length) return null;
  return <div className="intro">{paras.map((para, index) => <p key={index}>{r ? <RichText r={r} text={para} /> : para}</p>)}</div>;
}

export function EnrichmentOverview({ sections, r }: { sections: V2EnrichmentSection[]; r: V2Resolvers }) {
  return <>{(sections ?? []).map((section) => <Section eyebrow="More to know" key={section.h2} title={section.h2}>
    {section.items?.length ? <Boxes className="ideas" items={section.items} r={r} /> : <Intro paras={section.paras} r={r} />}
  </Section>)}</>;
}

export function EnrichmentBlockSection({ block, eyebrow, className = "ideas", r }: { block?: V2EnrichmentBlock; eyebrow: string; className?: string; r: V2Resolvers }) {
  if (!block?.items?.length) return null;
  return <Section eyebrow={eyebrow} title={block.h2}><Boxes className={className} items={block.items} r={r} /></Section>;
}

// Optional page-owned explanation blocks (per platform, per audience, vs traditional shoots).
// They reuse the standard Section + Boxes markup so no new styles are introduced.
export function MoreSections({ sections, r }: { sections?: V2MoreSection[]; r: V2Resolvers }) {
  const list = (sections ?? []).filter((section) => section?.h2 && section.items?.length);
  if (!list.length) return null;
  return <>{list.map((section) => (
    <Section eyebrow={section.eyebrow} key={`${section.h2}-${section.lead ?? ""}`} lead={section.lead} title={section.h2}>
      <Boxes items={section.items} r={r} />
    </Section>
  ))}</>;
}

export function FitSection({ block, r }: { block?: V2FitBlock; r: V2Resolvers }) {
  if (!block) return null;
  const fitList = (items: V2Item[]) => items.map((item) => <li key={item.t}><b>{item.t}</b>{item.d ? <p>{r ? <RichText r={r} text={item.d} /> : item.d}</p> : null}</li>);
  return <Section eyebrow="Good fit" title={block.h2}>
    <div className="two-col enrichment-fit">
      <div><h3>Good matches</h3><ul className="prose check">{fitList(block.good)}</ul></div>
      <div><h3>Less ideal</h3><ul className="prose check">{fitList(block.not_ideal)}</ul></div>
    </div>
  </Section>;
}

function glossaryAnchor(term: string): string {
  return term.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function GlossaryEntries({ entries, r }: { entries: V2GlossaryEntry[]; r: V2Resolvers }) {
  if (!entries.length) return null;
  return <dl className="glossary-list">
    {entries.map((entry) => <div className="glossary-entry" id={glossaryAnchor(entry.term)} key={entry.term}>
      <dt>{entry.term}</dt>
      <dd><p>{entry.definition}</p>{entry.related.length ? <p className="glossary-related">Related: {entry.related.map((link, index) => <span key={link.href}>{index > 0 ? ", " : null}<a href={r.href(link.href)}>{link.label}</a></span>)}</p> : null}</dd>
    </div>)}
  </dl>;
}

const BENEFIT_ICON_PATHS: Record<V2BenefitIcon, ReactNode> = {
  bolt: <path d="M13 2 4.5 13h5L8 22l8.5-11h-5L13 2Z" fill="currentColor" stroke="none" />,
  layers: <><path d="m12 3 8 4-8 4-8-4 8-4Z" /><path d="m4 12 8 4 8-4" /><path d="m4 17 8 4 8-4" /></>,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" /></>,
  coins: <><ellipse cx="9" cy="7" rx="5" ry="2.5" /><path d="M4 7v5c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V7" /><path d="M14 10.5c2.2.2 4 1.1 4 2.5s-1.8 2.5-4 2.5" /><path d="M14 15.5c2.2.2 4 1.1 4 2.5s-1.8 2.5-4 2.5" /></>,
  clock: <><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></>,
  refresh: <><path d="M20 11a8 8 0 0 0-14.8-3L3 11" /><path d="M3 6v5h5" /><path d="M4 13a8 8 0 0 0 14.8 3L21 13" /><path d="M21 18v-5h-5" /></>,
  globe: <><circle cx="12" cy="12" r="8" /><path d="M4 12h16M12 4c2.2 2.3 3.3 5 3.3 8s-1.1 5.7-3.3 8c-2.2-2.3-3.3-5-3.3-8S9.8 6.3 12 4Z" /></>,
  shield: <path d="M12 3 19 6v5c0 4.4-2.9 7.3-7 9-4.1-1.7-7-4.6-7-9V6l7-3Z" />,
  sparkle: <><path d="m12 3 1.4 5.6L19 10l-5.6 1.4L12 17l-1.4-5.6L5 10l5.6-1.4L12 3Z" /><path d="m19 16 .6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6L19 16Z" /></>,
  check: <path d="m5 12 4 4 10-10" />,
  users: <><circle cx="9" cy="9" r="3" /><path d="M3.5 20c.6-3.1 2.4-4.5 5.5-4.5s4.9 1.4 5.5 4.5" /><path d="M15 7.5a3 3 0 0 1 0 5.8M17 15.5c1.7.7 2.8 2.1 3.3 4.5" /></>,
  play: <path d="m9 6 9 6-9 6V6Z" fill="currentColor" stroke="none" />
};

function BenefitIcon({ name }: { name: V2BenefitIcon }) {
  return <span aria-hidden="true" className="v-benefit-icon"><svg fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24" width="24">{BENEFIT_ICON_PATHS[name]}</svg></span>;
}

export function ImageItemRows({ items, r }: { items: V2ImageItem[]; r: V2Resolvers }) {
  return <>
    <style dangerouslySetInnerHTML={{ __html: `
      .adc2 .v-image-item-rows{display:flex;flex-direction:column;gap:22px}
      .adc2 .v-image-item-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,.9fr);gap:48px;align-items:center;padding:26px 0;border-top:1px solid var(--line)}
      .adc2 .v-image-item-row:first-child{border-top:0;padding-top:0}
      .adc2 .v-image-item-row:nth-child(even){grid-template-columns:minmax(300px,.9fr) minmax(0,1fr)}
      .adc2 .v-image-item-row:nth-child(even) .v-image-item-copy{order:2}
      .adc2 .v-image-item-row:nth-child(even) .v-image-item-media{order:1}
      .adc2 .v-image-item-copy{max-width:540px}
      .adc2 .v-image-item-copy h3{font-size:clamp(22px,2.8vw,32px);margin-bottom:10px}
      .adc2 .v-image-item-copy p{color:var(--ink-2);font-size:17px;line-height:1.65}
      .adc2 .v-image-item-media{display:flex;justify-content:center;min-width:0}
      .adc2 .v-image-item-media figure{margin:0;width:min(100%,440px);overflow:hidden;border:1px solid var(--line-2);border-radius:20px;background:#0b0b0d}
      .adc2 .v-image-item-media figure.v-image-frame-none{border-radius:16px}
      .adc2 .v-image-item-media img{display:block;width:100%;height:auto;aspect-ratio:1;object-fit:cover}
      .adc2 .v-image-item-media figure.v-image-frame-phone{width:min(100%,300px);padding:10px;border-radius:28px;background:#070709;box-shadow:0 18px 44px rgba(0,0,0,.38)}
      .adc2 .v-image-item-media figure.v-image-frame-phone img{border-radius:19px;aspect-ratio:9/16}
      .adc2 .v-image-item-media figure.v-image-frame-browser{padding:38px 10px 10px;position:relative}
      .adc2 .v-image-item-media figure.v-image-frame-browser::before{content:"";position:absolute;left:14px;right:14px;top:15px;height:10px;border-radius:999px;background:radial-gradient(circle at 4px 5px,#ef6a83 0 3px,transparent 3.5px),radial-gradient(circle at 18px 5px,#f2c14e 0 3px,transparent 3.5px),radial-gradient(circle at 32px 5px,#55c98a 0 3px,transparent 3.5px);opacity:.9}
      .adc2 .v-image-item-media figure.v-image-frame-browser img{border-radius:10px;aspect-ratio:4/3}
      .adc2 .v-benefit-icon{display:grid;place-items:center;width:38px;height:38px;margin-bottom:4px;border:1px solid rgba(139,92,246,.45);border-radius:12px;background:rgba(139,92,246,.14);color:#c4b5fd}
      @media(max-width:760px){.adc2 .v-image-item-row,.adc2 .v-image-item-row:nth-child(even){grid-template-columns:minmax(0,1fr);gap:20px;padding-block:22px}.adc2 .v-image-item-row:nth-child(even) .v-image-item-copy,.adc2 .v-image-item-row:nth-child(even) .v-image-item-media{order:initial}.adc2 .v-image-item-copy{max-width:none}.adc2 .v-image-item-media{justify-content:flex-start}}
    ` }} />
    <div className="v-image-item-rows">
      {items.map((item, index) => {
        if (!item.img) return null;
        const image = item.alt ? { ...item.img, alt: item.alt } : item.img;
        const frame = item.frame && item.frame !== "none" ? `v-image-frame-${item.frame}` : "v-image-frame-none";
        return <article className="v-image-item-row" key={`${item.t}-${index}`}>
          <div className="v-image-item-copy"><h3>{item.t}</h3><p>{r ? <RichText r={r} text={item.d} /> : item.d}</p></div>
          <div className="v-image-item-media"><figure className={frame}><Img image={image} r={r} /></figure></div>
        </article>;
      })}
    </div>
  </>;
}

function hasImageItems(items: V2Item[]): items is V2ImageItem[] {
  return items.length > 0 && items.every((item) => item && typeof item.img === "object" && Boolean(item.img.src));
}

export function Boxes({ items, className = "ben", r }: { items: V2Item[]; className?: string; r?: V2Resolvers }) {
  if (!items.length) return null;
  if (hasImageItems(items) && r) return <ImageItemRows items={items} r={r} />;
  return <div className={className}>
    {items.map((item) => (
      <div key={item.t}>
        {item.icon ? <BenefitIcon name={item.icon} /> : null}
        <b>{item.t}</b>
        <p>{r ? <RichText r={r} text={item.d} /> : item.d}</p>
      </div>
    ))}
  </div>;
}

export function Steps({ items }: { items: V2Item[] }) {
  if (!items.length) return null;
  return (
    <div className="steps">
      {items.map((item, index) => (
        <div className="step" key={item.t}>
          <span className="n">{index + 1}</span>
          <h3>{normalizeStepLabel(item.t)}</h3>
          <p>{item.d}</p>
        </div>
      ))}
    </div>
  );
}

export function DirectorySpecs({ specs }: { specs: V2DirectorySpecs }) {
  if (!specs?.columns?.length || !specs.rows?.length) return null;
  return (
    <Section eyebrow="Format guide" lead={specs.lead} title={specs.title}>
      <div className="cmp-wrap">
        <table className="cmp directory-specs">
          <caption className="sr-only">{specs.title}</caption>
          <thead><tr>{specs.columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr></thead>
          <tbody>{specs.rows.map((row, rowIndex) => <tr key={`${row[0] ?? "row"}-${rowIndex}`}>{specs.columns.map((_, columnIndex) => <td key={columnIndex}>{row[columnIndex] ?? ""}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </Section>
  );
}

export function DirectoryScenes({ items, r }: { items: V2DirectoryScene[]; r: V2Resolvers }) {
  if (!items.length) return null;
  return (
    <Section eyebrow="Ad moments" lead="Choose a format by the moment you need to show, then open the related page for its examples and tool settings." title="Scenes sellers can put to work">
      <div className="ideas directory-scenes">
        {items.map((item) => <div key={item.t}>
          {item.image ? <Img image={item.image} r={r} className="directory-scene-media" /> : null}
          <b>{item.href ? <a href={r.href(item.href)}>{item.t} →</a> : item.t}</b>
          <p><RichText r={r} text={item.d} /></p>
        </div>)}
      </div>
    </Section>
  );
}

// A plain "what is this tool" definition shown right after the hero: heading plus one or two paragraphs.
export function DefinitionBlock({ definition, r }: { definition: V2Definition; r: V2Resolvers }) {
  if (!definition?.title || !definition.paras?.length) return null;
  return (
    <Section eyebrow="About" title={definition.title}>
      <Intro paras={definition.paras} r={r} />
    </Section>
  );
}

// A three-column comparison table: row label, our product, the traditional alternative.
// Reuses the existing .cmp/.cmp-wrap table styling used by the home page comparison.
export function CompareTableBlock({ block, r }: { block: V2CompareTable; r: V2Resolvers }) {
  if (!block?.title || !block.columns?.length || !block.rows?.length) return null;
  return (
    <Section eyebrow="Compare your options" lead={block.lead ?? ""} title={block.title}>
      <div className="cmp-wrap">
        <table className="cmp">
          <caption className="sr-only">{block.title}</caption>
          <thead>
            <tr>
              {block.columns.map((column, index) => (
                <th key={`${column}-${index}`} scope="col">{index === 0 ? <span className="sr-only">Topic</span> : column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={`${row[0] ?? "row"}-${rowIndex}`}>
                {block.columns.map((_, columnIndex) => (
                  <td key={columnIndex}><RichText r={r} text={row[columnIndex] ?? ""} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// Text-only linked card sections (format or category directories). No images by design;
// each card links to the related tool or collection page so shoppers can act on it.
export function TextSections({ sections, r }: { sections: V2TextSection[]; r: V2Resolvers }) {
  if (!sections?.length) return null;
  return (
    <>
      {sections.filter((section) => section?.title && section.cards?.length).map((section) => (
        <Section eyebrow={section.eyebrow} key={`${section.eyebrow}-${section.title}`} lead={section.lead ?? ""} title={section.title}>
          <div className="ideas">
            {section.cards.map((card) => (
              <div key={card.t}>
                <b>{card.t}</b>
                <p><RichText r={r} text={card.d} /></p>
                {card.href ? <p className="meta-line"><a href={r.href(card.href)}>{card.label || card.t} →</a></p> : null}
              </div>
            ))}
          </div>
        </Section>
      ))}
    </>
  );
}

export function Specs({ rows, r }: { rows: V2SpecRow[]; r: V2Resolvers }) {
  if (!rows.length) return null;
  return (
    <div className="specs" data-n={rows.length}>
      {rows.map(([label, value, links]) => (
        <div key={label}>
          <small>{label}</small>
          <b>
            {links?.length
              ? links.map((link, index) => <span key={link.href}>{index > 0 ? ", " : null}<a href={r.href(link.href)}>{link.label}</a></span>)
              : value}
          </b>
        </div>
      ))}
    </div>
  );
}

// The company named in the site profile: name, postal address, phone and email.
export function CompanyDetails({ company, className }: { company: V2Company; className?: string }) {
  return (
    <address className={className ? `company ${className}` : "company"}>
      <b>{company.name}</b>
      {company.address ? <span>{company.address}</span> : null}
      {company.phone ? <span>Phone: <a href={`tel:${company.phoneHref}`}>{company.phone}</a></span> : null}
      {company.email ? <span>Email: <a href={`mailto:${company.email}`}>{company.email}</a></span> : null}
      {company.taxId ? <span>{company.taxIdLabel}: {company.taxId}</span> : null}
    </address>
  );
}

const OFFICIAL_EXTERNAL_HOSTS = new Set(["ads.tiktok.com", "support.google.com", "help.shopify.com", "help.etsy.com"]);
const OWN_SITE_HOSTS = new Set(["aivideosugc.com", "www.aivideosugc.com"]);
function isApprovedExternalHref(href: string): boolean {
  try {
    const url = new URL(href);
    return url.protocol === "https:" && OFFICIAL_EXTERNAL_HOSTS.has(url.hostname.toLowerCase()) && !url.username && !url.password;
  } catch { return false; }
}
function localPathFromAbsoluteHref(href: string): string | undefined {
  try {
    const url = new URL(href);
    if (url.protocol === "https:" && OWN_SITE_HOSTS.has(url.hostname.toLowerCase()) && !url.username && !url.password) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
  } catch { /* Non-URL targets are handled as local paths below. */ }
  return undefined;
}

// Inline Markdown links support internal paths and the approved official references.
export function RichText({ text, r }: { text: string; r: V2Resolvers }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(/\[([^\]\n]+)\]\((https:\/\/[^)\s]+|\/[^)\s]*)\)/g)) {
    const at = match.index ?? 0;
    if (at > last) parts.push(text.slice(last, at));
    if (/^https:\/\//i.test(match[2])) {
      const localPath = localPathFromAbsoluteHref(match[2]);
      if (localPath) parts.push(<a href={r.href(localPath)} key={at}>{match[1]}</a>);
      else if (isApprovedExternalHref(match[2])) parts.push(<a href={match[2]} key={at} rel="noopener noreferrer" target="_blank">{match[1]}</a>);
      else parts.push(match[0]);
    } else parts.push(<a href={r.href(match[2])} key={at}>{match[1]}</a>);
    last = at + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

// "Keep reading": the guides and articles written for this page's topic.
export function Reading({ items, r }: { items: V2Article[]; r: V2Resolvers }) {
  if (!items.length) return null;
  return (
    <Section eyebrow="Keep reading" title="Guides and articles">
      <div className="related">
        {items.map((item) => (
          <article className="related-card" key={item.href}>
            <b><a className="card-title" href={r.href(item.href)}>{item.title}</a></b>
            <span>{item.text}</span>
            <small>{item.minutes} min read</small>
          </article>
        ))}
      </div>
    </Section>
  );
}

export function Faq({ items, title = "Questions", r }: { items: V2Faq[]; title?: string; r: V2Resolvers }) {
  if (!items.length) return null;
  return (
    <section className="sec" id="faq">
      <div className="wrap">
        <div className="faq">
          <div className="sec-head" style={{ marginBottom: 0 }}>
            <div className="eyebrow">FAQ</div>
            <h2>{title}</h2>
          </div>
          <div className="qa">
            {items.map((item, index) => (
              <details key={item.q} open={index === 0}>
                <summary>{item.q}</summary>
                <p><RichText r={r} text={item.a} /></p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function TemplateCard({ card, r, filterIndexes = [] }: { card: V2Card; r: V2Resolvers; filterIndexes?: number[] }) {
  if (card.cardType === "case") return <CaseCard card={card} r={r} filterIndexes={filterIndexes} />;
  return (
    <article className={`tc${filterIndexes.length ? " v-filter-card" : ""}`} data-filter-indexes={filterIndexes.length ? filterIndexes.join(" ") : undefined} data-ind={card.filterTags && card.filterTags.length ? card.filterTags.join(" ") : card.industries.join(" ")} data-plat={card.platforms.join(" ")} data-type={card.kind}>
      <div className="ti">
        <Img image={card.image} r={r} />
      </div>
      <div className="tb">
        <h3><a className="card-title" href={r.href(card.href)}>{card.name}</a></h3>
        {card.line ? <p>{card.line}</p> : null}
        <span className="use">Use this template →</span>
      </div>
    </article>
  );
}

/** A page-specific example. Case cards keep the result, format and next action together. */
export function CaseCard({ card, r, filterIndexes = [] }: { card: V2Card; r: V2Resolvers; filterIndexes?: number[] }) {
  const video = card.video;
  return (
    <article className={`tc case-card${filterIndexes.length ? " v-filter-card" : ""}`} data-filter-indexes={filterIndexes.length ? filterIndexes.join(" ") : undefined} data-ind={card.industries.join(" ")} data-plat={card.platforms.join(" ")} data-type={card.kind}>
      <div className="ti">
        {video ? (
          <video aria-label={video.name ?? card.name} autoPlay controls height={video.height} loop muted playsInline poster={r.asset(video.poster.src)} preload="none" width={video.width}>
            <source src={r.asset(video.src)} type="video/mp4" />
          </video>
        ) : <Img image={card.image} r={r} />}
      </div>
      <div className="tb">
        <h3>{card.name}</h3>
        <a className="use" href={r.href(card.href)}>Make a {card.kind === "video" || card.videoExample ? "video" : "photo"} like this →</a>
      </div>
    </article>
  );
}

export function TemplateGrid({ cards, r, id, filterChips }: { cards: V2Card[]; r: V2Resolvers; id?: string; filterChips?: { id: string; label: string }[] }) {
  if (!cards.length) return null;
  const indexesFor = (card: V2Card) => (filterChips ?? []).map((chip, index) => ({ chip, index: index + 1 }))
    .filter(({ chip }) => card.filterTags ? card.filterTags.includes(chip.id) : chip.id === card.kind || card.industries.includes(chip.id) || card.platforms.includes(chip.id))
    .map(({ index }) => index);
  return <div className={`tgrid${filterChips?.length ? " v-filter-grid" : ""}`} id={id}>{cards.map((card) => <TemplateCard card={card} filterIndexes={indexesFor(card)} key={card.key} r={r} />)}</div>;
}

function ExampleCard({ item, r }: { item: V2Example; r: V2Resolvers }) {
  return <CaseCard card={{
    key: item.key,
    name: item.title,
    kind: item.kind === "clip" ? "video" : "photo",
    videoExample: item.kind === "clip" || item.kind === "scene",
    href: item.href,
    image: item.image,
    tags: [],
    industries: [],
    platforms: [],
    mediaRef: item.mediaRef,
    ...(item.video ? { video: item.video } : {})
  }} r={r} />;
}

export function ExampleGallery({ examples, r, asSubsection = false, title, lead }: { examples?: V2Examples; r: V2Resolvers; asSubsection?: boolean; title?: string; lead?: string }) {
  const groups = examples?.groups?.filter((group) => group.items?.length) ?? [];
  if (!examples || !groups.length) return null;
  const gallery = <div className="example-gallery">
    {groups.map((group) => (
      <div className="example-group" key={group.label}>
        {group.label ? <h3>{group.label}</h3> : null}
        <div className="tgrid">{group.items.map((item) => <ExampleCard item={item} key={item.key} r={r} />)}</div>
      </div>
    ))}
  </div>;
  if (asSubsection) return <div className="example-gallery-subsection"><h3>{title ?? examples.h2}</h3>{(lead ?? examples.lead) ? <p>{lead ?? examples.lead}</p> : null}{gallery}</div>;
  return (
    <Section eyebrow="Examples" lead={lead ?? examples.lead} title={title ?? examples.h2}>
      {gallery}
    </Section>
  );
}

const ToolIcon = ({ group }: { group?: string }) => (
  <span aria-hidden="true" className="tic">
    {group === "photo" ? (
      <svg fill="none" height="22" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" width="22"><rect height="16" rx="3" width="18" x="3" y="4" /><circle cx="9" cy="10" r="1.6" /><path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5" /></svg>
    ) : (
      <svg fill="none" height="22" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" width="22"><rect height="14" rx="3" width="18" x="3" y="5" /><path d="m10.5 9.5 4 2.5-4 2.5z" /></svg>
    )}
  </span>
);

export function ToolLink({ tool, r }: { tool: V2Tool; r: V2Resolvers }) {
  return (
    <div className="mi">
      {tool.image ? <img alt="" decoding="async" height={46} loading="lazy" src={r.asset(tool.image.src)} width={46} /> : <ToolIcon group={tool.group} />}
      <div>
        <b><a className="card-title" href={r.href(tool.href)}>{tool.label}</a></b>
        <span>{tool.description}</span>
      </div>
    </div>
  );
}

export function ToolRow({ tools, r }: { tools: V2Tool[]; r: V2Resolvers }) {
  if (!tools.length) return null;
  return <div className="toolrow">{tools.map((tool) => <ToolLink key={tool.id} r={r} tool={tool} />)}</div>;
}

type MakeTool = V2Tool;

export function MakeToolCard({ tool, r }: { tool: MakeTool; r: V2Resolvers }) {
  return (
    <article className="make-card">
      {tool.image ? <div className="make-card-media"><Img image={tool.image} r={r} /></div> : null}
      <div className="make-card-body">
        <h4><a className="card-title" href={r.href(tool.href)}>{tool.label}</a></h4>
        <p>{tool.description}</p>
      </div>
    </article>
  );
}

type MakeGuide = { title: string; description: string; href: string; label: string; secondaryHref: string; secondaryLabel: string };

export function MakeToolGuide({ guide, r }: { guide: MakeGuide; r: V2Resolvers }) {
  return (
    <article className="make-guide">
      <div className="make-guide-body">
        <h4>{guide.title}</h4>
        <p>{guide.description}</p>
        <div className="make-guide-actions">
          <a className="btn btn-grad" href={r.href(guide.href)}>{guide.label}</a>
          <a className="btn btn-ghost" href={r.href(guide.secondaryHref)}>{guide.secondaryLabel}</a>
        </div>
      </div>
    </article>
  );
}

export function MakeToolGroup({ title, subtitle, allLabel, allHref, tools, r, guide }: {
  title: string;
  subtitle: string;
  allLabel: string;
  allHref: string;
  tools: V2Tool[];
  r: V2Resolvers;
  guide?: MakeGuide;
}) {
  return (
    <div className="make-group">
      <div className="make-group-head">
        <div><h3>{title}</h3><p>{subtitle}</p></div>
        <a className="make-all" href={r.href(allHref)}>{allLabel} →</a>
      </div>
      <div className="make-grid">
        {tools.map((tool) => <MakeToolCard key={tool.id} r={r} tool={tool} />)}
        {guide ? <MakeToolGuide guide={guide} r={r} /> : null}
      </div>
    </div>
  );
}

const UploadIcon = () => (
  <span aria-hidden="true" className="upl">
    <svg fill="none" height="26" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" width="26">
      <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
    </svg>
  </span>
);

// The storefront's name and icon (the brand was renamed from Aidreamcapes to AIVideosUGC).
export const BRAND_NAME = "AIVideosUGC";
export const BRAND_ICON = "/assets/sites/site_aidreamcapes/brand/aivideosugc-icon-64.png";

// The AIVideosUGC v2 shell is rendered only for site_aidreamcapes. Its
// workspace links are intentionally direct so unsigned visitors can inspect
// the guest create and inspiration routes before authentication is required.
export function withStartLinks(r: V2Resolvers): V2Resolvers {
  if (r.direct) return r;
  return {
    ...r,
    direct: r.href
  };
}

export function StartNote({ note, r }: { note?: string; r: V2Resolvers }) {
  return note ? <p className="start-note"><RichText r={r} text={note} /></p> : null;
}

export function Maker({ maker, r, note }: { maker: V2Maker; r: V2Resolvers; note?: string }) {
  const options = maker.options.slice(0, 3);
  if (maker.urlInput) {
    // Plain GET form: works without JavaScript and sends the link to the workspace.
    return (
      <form action={(r.direct ?? r.href)("/app/create")} className="maker" method="get">
        <input name="tool" type="hidden" value="url-to-video" />
        <input name="size" type="hidden" value="9:16" />
        <input name="length" type="hidden" value="15" />
        <label className="drop" htmlFor="adc2-product-url">
          <UploadIcon />
          <div style={{ flex: 1, minWidth: 0 }}>
            <b>Paste your product page link</b>
            <input
              autoComplete="url"
              className="urlbox"
              id="adc2-product-url"
              inputMode="url"
              maxLength={2048}
              name="url"
              placeholder="https://yourstore.com/products/..."
              required
              type="text"
            />
          </div>
        </label>
        <div className="opts">{options.map(([label, value]) => <span className="opt" key={label}>{label} <b>{value}</b></span>)}</div>
        <div className="maker-foot">
          <button className="btn btn-grad" type="submit">{maker.cta} →</button>
          <small>See the cost before you start</small>
        </div>
        <StartNote note={note} r={r} />
      </form>
    );
  }
  return (
    <div aria-label="Start creating" className="maker" role="group">
      <div className="drop">
        <UploadIcon />
        <div>
          <b>{maker.uploadTitle || "Drop your product photo here"}</b>
          <span>JPG, PNG or WebP · any clear photo works</span>
        </div>
      </div>
      <div className="opts">{options.map(([label, value]) => <span className="opt" key={label}>{label} <b>{value}</b></span>)}</div>
      <div className="maker-foot">
        <a className="btn btn-grad" href={r.href(maker.href)}>{maker.cta} →</a>
        <small>See the cost before you start</small>
      </div>
      <StartNote note={note} r={r} />
    </div>
  );
}

export function Collage({ cards, r }: { cards: V2Card[]; r: V2Resolvers }) {
  if (!cards.length) return null;
  return (
    <div className="collage">
      {cards.slice(0, 3).map((card, index) => (
        <figure key={card.key}>
          <Img eager={index === 0} image={card.image} r={r} />
          <figcaption>{card.name}</figcaption>
        </figure>
      ))}
    </div>
  );
}

export function Single({ image, r }: { image: V2Image; r: V2Resolvers }) {
  return (
    <div className="single">
      <Img eager image={image} r={r} />
    </div>
  );
}

// An example clip: nothing is downloaded until the visitor presses play.
export function VideoPlayer({ video, r }: { video: V2Video; r: V2Resolvers }) {
  return (
    <figure className="vid">
      <video aria-label={video.name ?? video.poster.alt} controls height={video.height} playsInline poster={r.asset(video.poster.src)} preload="none" width={video.width}>
        <source src={r.asset(video.src)} type="video/mp4" />
      </video>
    </figure>
  );
}

const orientation = (image: V2Image) => ((image.width ?? 1) >= (image.height ?? 1) ? "land" : "port");

// The main picture at the top of a page: a before/after pair, one image, an example clip,
// or a short silent loop (home page).
export function HeroMedia({ media, r }: { media: V2HeroMedia; r: V2Resolvers }) {
  if (media.kind === "video") return <div className="hm-video"><VideoPlayer r={r} video={media.video} /></div>;
  if (media.kind === "loop") {
    return (
      <div className="hm hm-loop">
        <video aria-label={media.video.poster.alt} autoPlay data-adc2-loop height={media.video.height} loop muted playsInline poster={r.asset(media.video.poster.src)} preload="metadata" width={media.video.width}>
          <source src={r.asset(media.video.src)} type="video/mp4" />
        </video>
        {media.inset ? <div className="inset"><span className="lbl">Your product</span><Img eager image={media.inset} r={r} /></div> : null}
      </div>
    );
  }
  if (media.kind === "pair") {
    return (
      <figure className="hm hm-pair" data-orient={orientation(media.after)}>
        <Img eager image={media.after} r={r} />
        <span className="lbl">Result</span>
        <div className="inset"><span className="lbl">Your product</span><Img eager image={media.before} r={r} /></div>
      </figure>
    );
  }
  return <figure className="hm" data-orient={orientation(media.image)}><Img eager image={media.image} r={r} /></figure>;
}

export function PairGrid({ pairs, r }: { pairs: { before: V2Image; after: V2Image }[]; r: V2Resolvers }) {
  if (!pairs.length) return null;
  return (
    <div className="pairs" data-n={pairs.length}>
      {pairs.map((pair) => (
        <figure className="hm hm-pair" data-orient="land" key={pair.after.src}>
          <Img image={pair.after} r={r} />
          <span className="lbl">Result</span>
          <div className="inset"><span className="lbl">Your product</span><Img image={pair.before} r={r} /></div>
        </figure>
      ))}
    </div>
  );
}

export function Gallery({ images, r }: { images: V2Image[]; r: V2Resolvers }) {
  if (!images.length) return null;
  const ratio = (images[0].width ?? 16) / (images[0].height ?? 10);
  return <div className="gal" data-n={images.length} data-shape={ratio > 0.9 && ratio < 1.1 ? "square" : "wide"}>{images.map((image) => <figure key={image.src}><Img image={image} r={r} /></figure>)}</div>;
}

// On phones the example picture sits between the lead and the full start box, so a compact start button follows the lead.
export function QuickStart({ label, href, r }: { label: string; href: string; r: V2Resolvers }) {
  return <div className="hero-quick"><a className="btn btn-grad" href={r.href(href)}>{label} →</a></div>;
}

export function PageHero({ eyebrow, title, lead, right, children, quick }: { eyebrow: string; title: string; lead: string; right?: ReactNode; children?: ReactNode; quick?: ReactNode }) {
  return (
    <section className="phero">
      <div className={right ? "wrap phero-grid" : "wrap"}>
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
          <p className="lead">{lead}</p>
          {right ? quick : null}
          {children}
        </div>
        {right}
      </div>
    </section>
  );
}

export function CtaBand({ title, lead, href, r, note }: { title: string; lead: string; href: string; r: V2Resolvers; note?: string }) {
  return (
    <div className="wrap">
      <section className="cta">
        <h2>{title}</h2>
        <p>{lead}</p>
        <div className="row">
          <a className="btn btn-primary" href={r.href(href)}>Get started</a>
          <a className="btn btn-ghost" href={r.href("/templates")}>Browse templates</a>
        </div>
        <StartNote note={note} r={r} />
      </section>
    </div>
  );
}

export function Plans({ plans, r }: { plans: V2Plan[]; r: V2Resolvers }) {
  return (
    <div className="plans">
      {plans.map((plan) => (
        <div className={plan.popular ? "plan pop" : "plan"} key={plan.name}>
          {plan.popular ? <span className="badge">Most popular</span> : null}
          <h3>{plan.name}</h3>
          <div className="price">{plan.price}<small> / month</small></div>
          <p className="who">{plan.who}</p>
          <p className="credits">{plan.credits} credits / month</p>
          <ul>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
          <a className={plan.popular ? "btn btn-grad" : "btn btn-ghost"} href={r.href(`/app/create?plan=${plan.name.toLowerCase()}`)}>Choose {plan.name}</a>
        </div>
      ))}
    </div>
  );
}
