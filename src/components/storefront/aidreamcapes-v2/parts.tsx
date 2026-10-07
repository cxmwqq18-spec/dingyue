import type { ReactNode } from "react";
import type { V2Article, V2Card, V2Crumb, V2EnrichmentBlock, V2EnrichmentSection, V2Examples, V2Example, V2Faq, V2FitBlock, V2HeroMedia, V2Image, V2Item, V2Maker, V2Plan, V2Resolvers, V2SpecRow, V2Tool, V2Video, V2GlossaryEntry } from "./types";
import type { V2Company } from "./company";

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

export function Img({ image, r, className, eager }: { image: V2Image; r: V2Resolvers; className?: string; eager?: boolean }) {
  return (
    <img
      alt={image.alt}
      className={className}
      decoding="async"
      fetchPriority={eager ? "high" : undefined}
      height={image.height}
      loading={eager ? "eager" : "lazy"}
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

export function Boxes({ items, className = "ben", r }: { items: V2Item[]; className?: string; r?: V2Resolvers }) {
  if (!items.length) return null;
  return (
    <div className={className}>
      {items.map((item) => (
        <div key={item.t}>
          <b>{item.t}</b>
          <p>{r ? <RichText r={r} text={item.d} /> : item.d}</p>
        </div>
      ))}
    </div>
  );
}

export function Steps({ items }: { items: V2Item[] }) {
  if (!items.length) return null;
  return (
    <div className="steps">
      {items.map((item, index) => (
        <div className="step" key={item.t}>
          <span className="n">{index + 1}</span>
          <h3>{item.t}</h3>
          <p>{item.d}</p>
        </div>
      ))}
    </div>
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

export function Faq({ items, title = "Questions" }: { items: V2Faq[]; title?: string }) {
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
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function TemplateCard({ card, r }: { card: V2Card; r: V2Resolvers }) {
  if (card.cardType === "case") return <CaseCard card={card} r={r} />;
  return (
    <article className="tc" data-ind={card.industries.join(" ")} data-plat={card.platforms.join(" ")} data-type={card.kind}>
      <div className="ti">
        <span className={card.kind === "video" ? "kind v" : "kind"}>{card.kind === "video" ? "Video" : "Photo"}</span>
        <Img image={card.image} r={r} />
      </div>
      <div className="tb">
        <h3><a className="card-title" href={r.href(card.href)}>{card.name}</a></h3>
        <p>{card.line}</p>
        {card.tags.length ? <div className="tags">{card.tags.map((tag) => <span key={tag}>{tag}</span>)}</div> : null}
        <span className="use">Use this template →</span>
      </div>
    </article>
  );
}

/** A page-specific example. Case cards keep the result, format and next action together. */
export function CaseCard({ card, r }: { card: V2Card; r: V2Resolvers }) {
  const video = card.video;
  return (
    <article className="tc case-card" data-ind={card.industries.join(" ")} data-plat={card.platforms.join(" ")} data-type={card.kind}>
      <div className="ti">
        <span className={card.kind === "video" ? "kind v" : "kind"}>{card.label ?? (card.kind === "video" ? "Example clip" : "Example photo")}</span>
        {video ? (
          <video aria-label={video.name ?? card.name} autoPlay controls height={video.height} loop muted playsInline poster={r.asset(video.poster.src)} preload="none" width={video.width}>
            <source src={r.asset(video.src)} type="video/mp4" />
          </video>
        ) : <Img image={card.image} r={r} />}
      </div>
      <div className="tb">
        <h3>{card.name}</h3>
        <p>{card.spec ?? card.line}</p>
        <a className="use" href={r.href(card.href)}>Make a {card.kind === "video" || card.label === "Example scene" ? "video" : "photo"} like this →</a>
      </div>
    </article>
  );
}

export function TemplateGrid({ cards, r, id }: { cards: V2Card[]; r: V2Resolvers; id?: string }) {
  if (!cards.length) return null;
  return <div className="tgrid" id={id}>{cards.map((card) => <TemplateCard card={card} key={card.key} r={r} />)}</div>;
}

function ExampleCard({ item, r }: { item: V2Example; r: V2Resolvers }) {
  return <CaseCard card={{
    key: item.key,
    name: item.title,
    line: item.spec ?? "Photo",
    kind: item.kind === "clip" ? "video" : "photo",
    href: item.href,
    image: item.image,
    tags: [],
    industries: [],
    platforms: [],
    label: item.label,
    spec: item.spec ?? "Photo",
    mediaRef: item.mediaRef,
    ...(item.video ? { video: item.video } : {})
  }} r={r} />;
}

export function ExampleGallery({ examples, r }: { examples?: V2Examples; r: V2Resolvers }) {
  const groups = examples?.groups?.filter((group) => group.items?.length) ?? [];
  if (!examples || !groups.length) return null;
  return (
    <Section eyebrow="Examples" lead={examples.lead} title={examples.h2}>
      <div className="example-gallery">
        {groups.map((group) => (
          <div className="example-group" key={group.label}>
            <h3>{group.label}</h3>
            <div className="tgrid">{group.items.map((item) => <ExampleCard item={item} key={item.key} r={r} />)}</div>
          </div>
        ))}
      </div>
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

// Workspace links (/app/...) open the sign-up form first and continue to the workspace afterwards;
// visitors who are already signed in are sent straight on.
export function withStartLinks(r: V2Resolvers): V2Resolvers {
  if (r.direct) return r;
  return {
    ...r,
    direct: r.href,
    href: (value: string) => (value.startsWith("/app/") ? `${r.href("/login")}?mode=register&next=${encodeURIComponent(r.href(value))}` : r.href(value))
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

export function Single({ image, r, label = "Example" }: { image: V2Image; r: V2Resolvers; label?: string | null }) {
  return (
    <div className="single">
      {label ? <span className="lbl">{label}</span> : null}
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
      <figcaption>Example clip{video.duration ? ` · ${video.duration} seconds` : ""}</figcaption>
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
        <span className="lbl">{media.inset ? "Example video ad" : "Example video ads"}</span>
        {media.inset ? <div className="inset"><span className="lbl">Your product photo</span><Img eager image={media.inset} r={r} /></div> : null}
      </div>
    );
  }
  if (media.kind === "pair") {
    return (
      <figure className="hm hm-pair" data-orient={orientation(media.after)}>
        <Img eager image={media.after} r={r} />
        <span className="lbl">Result</span>
        <div className="inset"><span className="lbl">Your photo</span><Img eager image={media.before} r={r} /></div>
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
          <div className="inset"><span className="lbl">Your photo</span><Img image={pair.before} r={r} /></div>
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
