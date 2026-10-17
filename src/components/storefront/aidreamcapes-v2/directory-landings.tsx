import { ArrowDown, ArrowRight, ArrowUpRight, Check, Clapperboard, Film, Play, Sparkles, UserRound } from "lucide-react";
import { Fragment } from "react";
import type { V2Data, V2Resolvers } from "./types";

type LandingLayout = "ai-twin-landing" | "text-to-video-landing";
type LandingImage = { src: string; alt: string };
type LandingCard = { title: string; body: string; image?: LandingImage; href?: string; label?: string; tag?: string };
type LandingSectionData = {
  id: string;
  kind: "statement" | "cards" | "steps" | "split" | "gallery" | "storyboard" | "comparison" | "faq" | "related" | "cta";
  eyebrow?: string;
  title?: string;
  lead?: string;
  image?: LandingImage;
  cards?: LandingCard[];
  items?: string[];
  columns?: string[];
  rows?: string[][];
  href?: string;
  button?: string;
  note?: string;
};

function string(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function image(value: unknown): LandingImage | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const item = value as Record<string, unknown>;
  return typeof item.src === "string" && typeof item.alt === "string" ? { src: item.src, alt: item.alt } : undefined;
}

function cards(value: unknown): LandingCard[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return [];
    const item = candidate as Record<string, unknown>;
    const title = string(item.title);
    const body = string(item.body);
    const cardImage = image(item.image);
    return title && (body || cardImage) ? [{ title, body, image: cardImage, href: string(item.href), label: string(item.label), tag: string(item.tag) }] : [];
  });
}

function section(value: unknown): LandingSectionData | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const item = value as Record<string, unknown>;
  const id = string(item.id);
  const kind = string(item.kind) as LandingSectionData["kind"];
  if (!id || !["statement", "cards", "steps", "split", "gallery", "storyboard", "comparison", "faq", "related", "cta"].includes(kind)) return undefined;
  return {
    id,
    kind,
    eyebrow: string(item.eyebrow),
    title: string(item.title),
    lead: string(item.lead),
    image: image(item.image),
    cards: cards(item.cards),
    items: Array.isArray(item.items) ? item.items.filter((entry): entry is string => typeof entry === "string") : [],
    columns: Array.isArray(item.columns) ? item.columns.filter((entry): entry is string => typeof entry === "string") : [],
    rows: Array.isArray(item.rows) ? item.rows.filter(Array.isArray).map((row) => row.filter((entry): entry is string => typeof entry === "string")) : [],
    href: string(item.href),
    button: string(item.button),
    note: string(item.note)
  };
}

function LandingSection({ item, r }: { item: LandingSectionData; r: V2Resolvers }) {
  const sectionClass = `landing-section landing-section-${item.kind}${item.kind === "split" ? " landing-split" : ""}`;
  const picture = (entry: LandingImage, className = "") => <img alt={entry.alt} className={className} decoding="async" loading="lazy" src={r.asset(entry.src)} />;
  const link = (href: string, label: string, className = "landing-link") => <a className={className} href={r.href(href)}>{label}<ArrowUpRight aria-hidden="true" size={16} /></a>;

  return (
    <section className={sectionClass} id={item.id}>
      <div className="landing-wrap">
        {item.kind === "statement" ? <div className="landing-statement">{item.items?.map((text) => <span key={text}>{text}</span>)}</div> : null}
        {item.kind !== "statement" && item.kind !== "cta" ? <header className="landing-section-head">
          {item.eyebrow ? <p className="landing-eyebrow"><i />{item.eyebrow}</p> : null}
          {item.title ? <h2>{item.title}</h2> : null}
          {item.lead ? <p className="landing-lead">{item.lead}</p> : null}
        </header> : null}

        {item.kind === "cards" ? <div className={`landing-cards ${item.cards?.length === 6 ? "six" : ""}`}>
          {item.cards?.map((card, index) => <article className="landing-card" key={`${card.title}-${index}`}>
            <span className="landing-card-number">{String(index + 1).padStart(2, "0")}</span>
            <h3>{card.title}</h3><p>{card.body}</p>
            {card.image ? picture(card.image, "landing-card-image") : null}
            {card.href && card.label ? link(card.href, card.label) : null}
          </article>)}
        </div> : null}

        {item.kind === "steps" ? <div className="landing-steps">
          {item.cards?.map((card, index) => <article className="landing-step" key={card.title}>
            <div className="landing-step-copy"><span className="landing-card-number">{String(index + 1).padStart(2, "0")}</span><h3>{card.title}</h3><p>{card.body}</p></div>
            {card.image ? picture(card.image, "landing-step-image") : null}
          </article>)}
        </div> : null}

        {item.kind === "split" ? <div className="landing-split-grid">
          <div className="landing-split-copy">
            {item.items?.map((text) => <p className="landing-check" key={text}><Check aria-hidden="true" size={17} />{text}</p>)}
            {item.href && item.button ? link(item.href, item.button, "landing-button") : null}
          </div>
          {item.image ? picture(item.image, "landing-split-image") : null}
        </div> : null}

        {item.kind === "gallery" ? <div className="landing-gallery">
          {item.cards?.map((card, index) => <article className={`landing-gallery-card gallery-${index + 1}`} key={card.title}>
            {card.image ? picture(card.image) : null}<div className="landing-gallery-caption">
              {card.tag ? <span className="landing-pill">{card.tag}</span> : null}<h3>{card.title}</h3><p>{card.body}</p>
            </div>
          </article>)}
        </div> : null}

        {item.kind === "storyboard" ? <div className="landing-storyboard">
          <div className="landing-storyboard-head"><span><Clapperboard size={18} />{item.eyebrow}</span><span>{item.note}</span></div>
          <div className="landing-shot-grid">{item.cards?.map((card, index) => <article className="landing-shot" key={card.title}>
            <div className="landing-shot-image">{card.image ? picture(card.image) : null}<span>{String(index + 1).padStart(2, "0")}</span></div><h3>{card.title}</h3><p>{card.body}</p>
          </article>)}</div>
          <div className="landing-timeline"><Play aria-hidden="true" size={15} />{item.cards?.map((card, index) => <span key={`${card.title}-timeline`} style={{ flexGrow: index === 1 ? 1.2 : 1 }} />)}<small>{item.note}</small></div>
        </div> : null}

        {item.kind === "comparison" ? <div className="landing-comparison">
          <div className="landing-table-head">{item.columns?.map((column) => <b key={column}>{column}</b>)}</div>
          {item.rows?.map((row, index) => <div className="landing-table-row" key={`${row[0]}-${index}`}>{row.map((cell, cellIndex) => <span className={cellIndex === 0 ? "row-label" : ""} key={`${cell}-${cellIndex}`}>{cell}</span>)}</div>)}
          {item.note ? <p className="landing-note"><Sparkles aria-hidden="true" size={18} />{item.note}</p> : null}
        </div> : null}

        {item.kind === "faq" ? <div className="landing-faq">
          {item.cards?.map((card) => <details key={card.title}><summary>{card.title}<ArrowDown aria-hidden="true" size={17} /></summary><p>{card.body}</p></details>)}
        </div> : null}

        {item.kind === "related" ? <div className="landing-related">
          {item.cards?.map((card, index) => <a className="landing-related-card" href={r.href(card.href || "/ai-video-generation")} key={card.title}>
            <span className="landing-related-icon">{index % 3 === 0 ? <Film /> : index % 3 === 1 ? <UserRound /> : <Clapperboard />}</span>
            <span><b>{card.title}</b><small>{card.body}</small></span><ArrowRight aria-hidden="true" size={18} />
          </a>)}
        </div> : null}

        {item.kind === "cta" ? <div className="landing-cta-copy">
          <div><p className="landing-eyebrow"><i />{item.eyebrow}</p><h2>{item.title}</h2><p className="landing-lead">{item.lead}</p>
            {item.href && item.button ? link(item.href, item.button, "landing-button") : null}
          </div>
          <div className="landing-cta-images">{item.cards?.map((card) => card.image ? <Fragment key={card.title}>{picture(card.image)}</Fragment> : null)}</div>
        </div> : null}
      </div>
    </section>
  );
}

export function AidreamcapesDirectoryLanding({ data, layout, r }: { data: V2Data; layout: LandingLayout; r: V2Resolvers }) {
  const twin = layout === "ai-twin-landing";
  const heroImage = image(data.heroImage);
  const secondaryImage = image(data.secondaryImage);
  const sections = Array.isArray(data.landingSections) ? data.landingSections.map(section).filter((item): item is LandingSectionData => Boolean(item)) : [];
  if (!string(data.h1) || !heroImage || sections.length < 8) return null;
  const href = string(data.primaryHref);
  const cta = string(data.primaryCta);
  const secondaryHref = string(data.secondaryHref);
  const secondaryCta = string(data.secondaryCta);

  return <div className={`adc-landing ${twin ? "adc-twin-page" : "adc-text-video-page"}`}>
    <style dangerouslySetInnerHTML={{ __html: landingCss }} />
    <nav aria-label={string(data.breadcrumbLabel)} className="landing-breadcrumb"><a href={r.href("/")}>{string(data.homeLabel)}</a><span>/</span><span>{string(data.label)}</span></nav>
    <header className="landing-hero landing-wrap">
      <div className="landing-hero-copy"><p className="landing-eyebrow"><i />{string(data.eyebrow)}</p><h1>{data.h1}</h1><p className="landing-lead">{string(data.lead)}</p>
        <div className="landing-hero-actions">{href && cta ? <a className="landing-button" href={r.href(href)}>{cta}<ArrowRight aria-hidden="true" size={17} /></a> : null}{secondaryHref && secondaryCta ? <a className="landing-secondary-button" href={secondaryHref.startsWith("#") ? secondaryHref : r.href(secondaryHref)}>{secondaryCta}<ArrowUpRight aria-hidden="true" size={16} /></a> : null}</div>
        {string(data.notice) ? <p className="landing-disclosure">{string(data.notice)}</p> : null}
      </div>
      <div className={`landing-hero-art ${twin ? "twin-art" : "brief-art"}`}>
        <div className="landing-hero-image">{pictureElement(heroImage, r)}</div>
        {secondaryImage ? <div className="landing-hero-inset">{pictureElement(secondaryImage, r)}</div> : null}
        <div className="landing-floating-card"><span>{string(data.demoLabel)}</span>{(Array.isArray(data.heroChips) ? data.heroChips : []).filter((v): v is string => typeof v === "string").map((chip) => <b key={chip}>{chip}</b>)}</div>
      </div>
    </header>
    <div className="landing-content">
      {sections.map((item) => <LandingSection item={item} key={item.id} r={r} />)}
    </div>
  </div>;
}

function pictureElement(entry: LandingImage, r: V2Resolvers) {
  return <img alt={entry.alt} decoding="async" fetchPriority="high" src={r.asset(entry.src)} />;
}

const landingCss = `
.adc2 .adc-landing{--lp-bg:#09080d;--lp-panel:#121018;--lp-panel2:#191522;--lp-line:#302b39;--lp-ink:#f8f5fc;--lp-muted:#b8b1c3;--lp-lav:#c6a8ff;--lp-lav2:#9670e8;background:var(--lp-bg);color:var(--lp-ink);overflow:hidden}
.adc2 .landing-wrap{width:min(1240px,calc(100% - 64px));margin-inline:auto}
.adc2 .landing-breadcrumb{width:min(1240px,calc(100% - 64px));margin:30px auto 4px;display:flex;gap:12px;align-items:center;color:#9891a2;font-size:13px}.adc2 .landing-breadcrumb a{color:#cbc3d3;text-decoration:none}.adc2 .landing-breadcrumb a:hover{color:#fff}
.adc2 .landing-hero{min-height:610px;padding-top:56px;padding-bottom:90px;display:grid;grid-template-columns:.94fr 1.06fr;gap:60px;align-items:center;position:relative}.adc2 .landing-hero:after{content:"";position:absolute;z-index:0;width:560px;height:560px;border:1px solid #3d2f50;border-radius:50%;right:5%;top:20px;pointer-events:none}.adc2 .landing-hero-copy,.adc2 .landing-hero-art{position:relative;z-index:1}.adc2 .landing-eyebrow{display:flex;align-items:center;gap:11px;color:var(--lp-lav);font-size:12px;font-weight:750;letter-spacing:.14em;text-transform:uppercase;margin:0 0 21px}.adc2 .landing-eyebrow i{width:23px;height:2px;background:var(--lp-lav);display:block}.adc2 .landing-hero h1{font-size:clamp(46px,5.5vw,76px);line-height:1.01;letter-spacing:-.045em;max-width:610px;margin:0 0 23px;font-weight:760}.adc2 .landing-hero h1 em{color:var(--lp-lav);font-style:normal}.adc2 .landing-lead{font-size:16px;line-height:1.9;color:var(--lp-muted);max-width:580px;margin:0}.adc2 .landing-hero-actions{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:30px}.adc2 .landing-button{min-height:50px;padding:0 21px;border-radius:8px;background:linear-gradient(110deg,#7548e9,#a34be5 58%,#5177ed);color:#fff!important;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:11px;transition:transform .2s,filter .2s}.adc2 .landing-button:hover{transform:translateY(-2px);filter:brightness(1.12)}.adc2 .landing-secondary-button,.adc2 .landing-link{color:#d6c3ff;text-decoration:none;display:inline-flex;align-items:center;gap:7px;font-weight:650}.adc2 .landing-secondary-button:hover,.adc2 .landing-link:hover{color:#fff}.adc2 .landing-disclosure{font-size:12px;color:#8d8597;max-width:390px;margin:20px 0 0;line-height:1.7}
.adc2 .landing-hero-art{height:480px;display:flex;align-items:center;justify-content:center}.adc2 .landing-hero-image{height:420px;width:min(100%,380px);border-radius:28px;overflow:hidden;border:7px solid #2b2632;box-shadow:0 30px 100px #0009;transform:rotate(2deg)}.adc2 .landing-hero-image img,.adc2 .landing-hero-inset img{height:100%;width:100%;object-fit:cover}.adc2 .landing-hero-inset{position:absolute;left:2%;bottom:25px;width:190px;height:220px;border:6px solid #2c2733;border-radius:20px;overflow:hidden;transform:rotate(-6deg);box-shadow:0 18px 50px #0009}.adc2 .landing-floating-card{position:absolute;right:1%;bottom:24px;background:#211a2a;border:1px solid #59446e;border-radius:15px;padding:17px;display:grid;gap:8px;min-width:220px;box-shadow:0 15px 40px #0008}.adc2 .landing-floating-card span{font-size:12px;color:#bfb4cd}.adc2 .landing-floating-card b{font-size:13px}.adc2 .brief-art .landing-hero-image{width:510px;height:330px;border-radius:20px;transform:rotate(0)}.adc2 .brief-art .landing-hero-inset{left:0;bottom:-5px;width:190px;height:130px}
.adc2 .landing-statement{display:flex;justify-content:center;gap:clamp(20px,6vw,90px);padding:31px 0;border-block:1px solid #292532;color:#ded6e8;font-size:14px;font-weight:650}.adc2 .landing-statement span+span:before{content:"✦";color:var(--lp-lav);padding-right:15px}
.adc2 .landing-section{padding:104px 0;border-top:1px solid #211e28}.adc2 .landing-section:nth-child(odd){background:#0c0b10}.adc2 .landing-section-head{margin-bottom:44px;max-width:760px}.adc2 .landing-section-head h2,.adc2 .landing-cta-copy h2{font-size:clamp(34px,4vw,52px);line-height:1.08;letter-spacing:-.035em;margin:0 0 15px}.adc2 .landing-section-head .landing-lead{max-width:680px}.adc2 .landing-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.adc2 .landing-card{position:relative;background:linear-gradient(145deg,#15121b,#100e15);border:1px solid var(--lp-line);border-radius:16px;padding:25px;min-height:205px;transition:transform .2s,border-color .2s}.adc2 .landing-card:hover{transform:translateY(-3px);border-color:#775997}.adc2 .landing-card-number{display:inline-grid;place-items:center;width:36px;height:36px;border-radius:10px;background:#261d32;color:var(--lp-lav);font-size:13px;font-weight:800}.adc2 .landing-card h3,.adc2 .landing-step h3,.adc2 .landing-gallery-card h3{font-size:19px;line-height:1.3;margin:19px 0 9px}.adc2 .landing-card p,.adc2 .landing-step p,.adc2 .landing-gallery-card p{font-size:14px;line-height:1.8;color:var(--lp-muted);margin:0}.adc2 .landing-card-image{width:100%;height:175px;object-fit:cover;border-radius:10px;margin-top:20px}.adc2 .landing-cards.six{grid-template-columns:repeat(3,minmax(0,1fr))}
.adc2 .landing-steps{display:grid;gap:14px}.adc2 .landing-step{display:grid;grid-template-columns:.8fr 1.2fr;min-height:220px;align-items:center;gap:30px;padding:18px;background:#131119;border:1px solid var(--lp-line);border-radius:17px}.adc2 .landing-step-copy{padding:20px 25px}.adc2 .landing-step-image{width:100%;height:225px;object-fit:cover;border-radius:12px}.adc2 .landing-step:nth-child(even) .landing-step-image{order:-1}.adc2 .landing-split-grid{display:grid;grid-template-columns:.7fr 1.3fr;gap:46px;align-items:center}.adc2 .landing-split-copy{display:grid;gap:14px}.adc2 .landing-check{display:flex;align-items:center;gap:11px;color:#ded6e8;font-size:15px}.adc2 .landing-check svg{color:var(--lp-lav);flex:0 0 auto}.adc2 .landing-split-copy .landing-button{justify-self:start;margin-top:14px}.adc2 .landing-split-image{width:100%;height:470px;object-fit:cover;border-radius:20px;border:1px solid var(--lp-line)}
.adc2 .landing-gallery{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:15px;align-items:stretch}.adc2 .landing-gallery-card{position:relative;min-height:380px;overflow:hidden;border-radius:16px;background:var(--lp-panel);border:1px solid var(--lp-line)}.adc2 .landing-gallery-card img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.8;transition:transform .45s,opacity .3s}.adc2 .landing-gallery-card:hover img{transform:scale(1.04);opacity:1}.adc2 .landing-gallery-caption{position:absolute;left:0;right:0;bottom:0;padding:54px 19px 19px;background:linear-gradient(transparent,#100d16 38%)}.adc2 .landing-gallery-caption h3{margin:12px 0 6px}.adc2 .landing-pill{background:#271f31;border:1px solid #655077;color:#e1d3f6;border-radius:99px;padding:6px 10px;font-size:11px}.adc2 .landing-storyboard{background:#17141e;border:1px solid #393242;border-radius:18px;padding:24px}.adc2 .landing-storyboard-head{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #393242;padding-bottom:18px;color:#beb4cc;font-size:12px}.adc2 .landing-storyboard-head span:first-child{display:flex;align-items:center;gap:9px;color:#f4effa}.adc2 .landing-shot-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px;padding:22px 0}.adc2 .landing-shot{background:#211d29;border:1px solid #383140;border-radius:12px;overflow:hidden}.adc2 .landing-shot-image{position:relative;height:235px}.adc2 .landing-shot-image img{width:100%;height:100%;object-fit:cover}.adc2 .landing-shot-image span{position:absolute;top:12px;left:12px;border-radius:6px;padding:5px 8px;background:#130f19dd;color:var(--lp-lav);font-weight:750}.adc2 .landing-shot h3{font-size:15px;margin:14px 14px 5px}.adc2 .landing-shot p{color:var(--lp-muted);font-size:12px;margin:0 14px 15px;line-height:1.6}.adc2 .landing-timeline{display:flex;align-items:center;gap:10px;padding:14px 4px 0;color:var(--lp-lav)}.adc2 .landing-timeline>span{height:8px;border-radius:10px;background:linear-gradient(90deg,#845cd0,#aa8be5)}.adc2 .landing-timeline small{color:#aaa0b4;white-space:nowrap}
.adc2 .landing-comparison{border:1px solid #3b3442;border-radius:16px;overflow:hidden;background:#121018}.adc2 .landing-table-head,.adc2 .landing-table-row{display:grid;grid-template-columns:1fr 1fr 1fr}.adc2 .landing-table-head{background:#1b1722;color:#e8ddf4}.adc2 .landing-table-head b,.adc2 .landing-table-row span{padding:17px 20px;border-right:1px solid #36303d;border-bottom:1px solid #36303d;font-size:13px}.adc2 .landing-table-row span{color:#c5bdcc;line-height:1.65}.adc2 .landing-table-row .row-label{font-weight:700;color:#fff}.adc2 .landing-note{display:flex;align-items:flex-start;gap:12px;background:#241c2c;color:#dfd2ef;margin:0;padding:19px 22px;font-size:13px;line-height:1.7}.adc2 .landing-note svg{color:var(--lp-lav);flex:0 0 auto}
.adc2 .landing-faq{border-top:1px solid #36303b}.adc2 .landing-faq details{border-bottom:1px solid #36303b;padding:0 5px}.adc2 .landing-faq summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;padding:22px 4px;font-size:16px;font-weight:700}.adc2 .landing-faq summary::-webkit-details-marker{display:none}.adc2 .landing-faq details[open] summary svg{transform:rotate(180deg)}.adc2 .landing-faq details p{max-width:850px;color:var(--lp-muted);font-size:14px;line-height:1.85;margin:0;padding:0 40px 22px 4px}
.adc2 .landing-related{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.adc2 .landing-related-card{display:flex;align-items:center;gap:13px;background:#131119;border:1px solid var(--lp-line);padding:18px;border-radius:14px;text-decoration:none;color:#fff;transition:border-color .2s,transform .2s}.adc2 .landing-related-card:hover{border-color:#8463a5;transform:translateY(-2px)}.adc2 .landing-related-icon{width:42px;height:42px;display:grid;place-items:center;background:#271e33;color:var(--lp-lav);border-radius:12px;flex:0 0 auto}.adc2 .landing-related-icon svg{width:20px}.adc2 .landing-related-card>span:nth-child(2){display:grid;gap:5px;flex:1}.adc2 .landing-related-card b{font-size:14px}.adc2 .landing-related-card small{font-size:12px;line-height:1.5;color:var(--lp-muted)}.adc2 .landing-related-card>svg{color:var(--lp-lav)}
.adc2 .landing-cta{background:radial-gradient(ellipse at 85% 15%,#302240 0,transparent 42%),#100d15}.adc2 .landing-cta-copy{display:grid;grid-template-columns:1.1fr .9fr;gap:45px;align-items:center}.adc2 .landing-cta-copy .landing-lead{margin:0 0 24px}.adc2 .landing-cta-images{height:300px;display:flex;align-items:center;justify-content:center;gap:10px}.adc2 .landing-cta-images img{height:220px;width:32%;object-fit:cover;border-radius:13px;border:3px solid #292331}.adc2 .landing-cta-images img:first-child{transform:translateY(-18px) rotate(-5deg)}.adc2 .landing-cta-images img:last-child{transform:translateY(16px) rotate(5deg)}
@media(max-width:900px){.adc2 .landing-wrap,.adc2 .landing-breadcrumb{width:min(100% - 40px,720px)}.adc2 .landing-hero{grid-template-columns:1fr;gap:28px;padding-top:40px}.adc2 .landing-hero-copy{max-width:700px}.adc2 .landing-hero-art{height:430px}.adc2 .landing-hero:after{right:9%;top:auto;bottom:0}.adc2 .landing-cards,.adc2 .landing-cards.six{grid-template-columns:repeat(2,minmax(0,1fr))}.adc2 .landing-gallery{grid-template-columns:repeat(2,minmax(0,1fr))}.adc2 .landing-gallery-card{min-height:330px}.adc2 .landing-section{padding:78px 0}.adc2 .landing-related{grid-template-columns:1fr 1fr}}
@media(max-width:580px){.adc2 .landing-wrap,.adc2 .landing-breadcrumb{width:calc(100% - 36px)}.adc2 .landing-breadcrumb{margin-top:21px}.adc2 .landing-hero{min-height:0;padding:34px 0 52px}.adc2 .landing-hero h1{font-size:43px}.adc2 .landing-lead{font-size:14px}.adc2 .landing-hero-art{height:350px}.adc2 .landing-hero-image{height:310px;width:72%;border-width:5px;border-radius:20px}.adc2 .landing-hero-inset{width:125px;height:145px;left:-2%;bottom:0;border-width:4px}.adc2 .landing-floating-card{right:-2%;bottom:0;min-width:155px;padding:10px;font-size:11px}.adc2 .brief-art .landing-hero-image{height:245px;width:100%}.adc2 .brief-art .landing-hero-inset{height:95px;width:132px}.adc2 .landing-hero:after{width:320px;height:320px;right:0}.adc2 .landing-statement{justify-content:flex-start;overflow-x:auto;white-space:nowrap;padding:22px 18px;font-size:12px}.adc2 .landing-section{padding:62px 0}.adc2 .landing-section-head{margin-bottom:29px}.adc2 .landing-section-head h2,.adc2 .landing-cta-copy h2{font-size:34px}.adc2 .landing-cards,.adc2 .landing-cards.six,.adc2 .landing-gallery,.adc2 .landing-related{grid-template-columns:1fr}.adc2 .landing-card{min-height:auto}.adc2 .landing-step{grid-template-columns:1fr;padding:12px;gap:15px}.adc2 .landing-step-copy{padding:12px}.adc2 .landing-step-image{height:210px}.adc2 .landing-step:nth-child(even) .landing-step-image{order:0}.adc2 .landing-split-grid,.adc2 .landing-cta-copy{grid-template-columns:1fr;gap:25px}.adc2 .landing-split-image{height:300px}.adc2 .landing-gallery-card{min-height:370px}.adc2 .landing-shot-grid{grid-template-columns:1fr}.adc2 .landing-shot-image{height:230px}.adc2 .landing-storyboard{padding:14px}.adc2 .landing-storyboard-head{align-items:flex-start;gap:8px;flex-direction:column}.adc2 .landing-timeline{flex-wrap:wrap}.adc2 .landing-timeline small{width:100%}.adc2 .landing-table-head,.adc2 .landing-table-row{grid-template-columns:1fr 1fr 1fr}.adc2 .landing-table-head b,.adc2 .landing-table-row span{padding:12px 8px;font-size:11px}.adc2 .landing-table-row .row-label{font-size:10px}.adc2 .landing-faq summary{font-size:14px}.adc2 .landing-cta-images{height:220px}.adc2 .landing-cta-images img{height:155px}.adc2 .landing-cta-images img:nth-child(2){transform:translateY(6px)} }
@media(prefers-reduced-motion:reduce){.adc2 .landing-card,.adc2 .landing-gallery-card img,.adc2 .landing-related-card,.adc2 .landing-button{transition:none}}
`;
