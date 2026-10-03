import type { ReactNode } from "react";
import type { V2Card, V2Crumb, V2Faq, V2Image, V2Item, V2Maker, V2Plan, V2Resolvers, V2Tool } from "./types";

export function Img({ image, r, className, eager }: { image: V2Image; r: V2Resolvers; className?: string; eager?: boolean }) {
  return (
    <img
      alt={image.alt}
      className={className}
      decoding="async"
      height={image.height}
      loading={eager ? "eager" : "lazy"}
      src={r.asset(image.src)}
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

export function Intro({ paras }: { paras: string[] }) {
  if (!paras.length) return null;
  return <div className="intro">{paras.map((para, index) => <p key={index}>{para}</p>)}</div>;
}

export function Boxes({ items, className = "ben" }: { items: V2Item[]; className?: string }) {
  if (!items.length) return null;
  return (
    <div className={className}>
      {items.map((item) => (
        <div key={item.t}>
          <b>{item.t}</b>
          <p>{item.d}</p>
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

export function Specs({ rows }: { rows: [string, string][] }) {
  if (!rows.length) return null;
  return (
    <div className="specs">
      {rows.map(([label, value]) => (
        <div key={label}>
          <small>{label}</small>
          <b>{value}</b>
        </div>
      ))}
    </div>
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
  return (
    <a className="tc" data-ind={card.industries.join(" ")} data-plat={card.platforms.join(" ")} data-type={card.kind} href={r.href(card.href)}>
      <div className="ti">
        <span className={card.kind === "video" ? "kind v" : "kind"}>{card.kind === "video" ? "Video" : "Photo"}</span>
        <Img image={card.image} r={r} />
      </div>
      <div className="tb">
        <h3>{card.name}</h3>
        <p>{card.line}</p>
        {card.tags.length ? <div className="tags">{card.tags.map((tag) => <span key={tag}>{tag}</span>)}</div> : null}
        <span className="use">Use this template →</span>
      </div>
    </a>
  );
}

export function TemplateGrid({ cards, r, id }: { cards: V2Card[]; r: V2Resolvers; id?: string }) {
  if (!cards.length) return null;
  return <div className="tgrid" id={id}>{cards.map((card) => <TemplateCard card={card} key={card.key} r={r} />)}</div>;
}

export function ToolLink({ tool, r }: { tool: V2Tool; r: V2Resolvers }) {
  return (
    <a className="mi" href={r.href(tool.href)}>
      <img alt="" decoding="async" height={46} loading="lazy" src={r.asset(tool.image.src)} width={46} />
      <div>
        <b>{tool.label}</b>
        <span>{tool.description}</span>
      </div>
    </a>
  );
}

export function ToolRow({ tools, r }: { tools: V2Tool[]; r: V2Resolvers }) {
  if (!tools.length) return null;
  return <div className="toolrow">{tools.map((tool) => <ToolLink key={tool.id} r={r} tool={tool} />)}</div>;
}

const UploadIcon = () => (
  <span aria-hidden="true" className="upl">
    <svg fill="none" height="26" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" width="26">
      <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
    </svg>
  </span>
);

export function Maker({ maker, r }: { maker: V2Maker; r: V2Resolvers }) {
  const options = maker.options.slice(0, 3);
  if (maker.urlInput) {
    // Plain GET form: works without JavaScript and sends the link to the workspace.
    return (
      <form action={r.href("/app/create")} className="maker" method="get">
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
      </form>
    );
  }
  return (
    <div aria-label="Start creating" className="maker" role="group">
      <div className="drop">
        <UploadIcon />
        <div>
          <b>Drop your product photo here</b>
          <span>JPG, PNG or WebP · any clear photo works</span>
        </div>
      </div>
      <div className="opts">{options.map(([label, value]) => <span className="opt" key={label}>{label} <b>{value}</b></span>)}</div>
      <div className="maker-foot">
        <a className="btn btn-grad" href={r.href(maker.href)}>{maker.cta} →</a>
        <small>See the cost before you start</small>
      </div>
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
      <span className="lbl">Example</span>
      <Img eager image={image} r={r} />
    </div>
  );
}

export function PageHero({ eyebrow, title, lead, right, children }: { eyebrow: string; title: string; lead: string; right?: ReactNode; children?: ReactNode }) {
  return (
    <section className="phero">
      <div className={right ? "wrap phero-grid" : "wrap"}>
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
          <p className="lead">{lead}</p>
          {children}
        </div>
        {right}
      </div>
    </section>
  );
}

export function CtaBand({ title, lead, href, r }: { title: string; lead: string; href: string; r: V2Resolvers }) {
  return (
    <div className="wrap">
      <section className="cta">
        <h2>{title}</h2>
        <p>{lead}</p>
        <div className="row">
          <a className="btn btn-primary" href={r.href(href)}>Get started</a>
          <a className="btn btn-ghost" href={r.href("/templates")}>Browse templates</a>
        </div>
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
