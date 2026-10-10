import type { ReactNode } from "react";
import { Img, normalizeStepLabel, RichText, Section } from "./parts";
import { AIDREAMCAPES_V2_VISUAL_CSS, AIDREAMCAPES_V2_VISUAL_CSS_POLISH } from "./styles";
import type {
  V2AfterMock,
  V2Resolvers,
  V2Visual,
  V2VisualImage,
  V2VisualInput,
  V2VisualOutput,
  V2VisualUse
} from "./types";
import { TemplateGrid } from "./parts";

const DIRECTORY_FILTER_SELECTORS = Array.from({ length: 16 }, (_, index) => {
  const value = index + 1;
  return `.adc2 .v-filter[data-filter-index="${value}"]:checked~.v-filter-grid .v-filter-card:not([data-filter-indexes~="${value}"])`;
});
const DIRECTORY_FILTER_FOCUS_SELECTORS = Array.from({ length: 16 }, (_, index) => {
  const value = index + 1;
  return `.adc2 .v-filter[data-filter-index="${value}"]:focus-visible~.v-picker-chips label[data-filter-index="${value}"]`;
});
const DIRECTORY_FILTER_CSS = `${DIRECTORY_FILTER_SELECTORS.join(",")}{display:none}
.adc2 .v-filter[data-chip="all"]:focus-visible~.v-picker-chips label[data-filter-chip="all"],${DIRECTORY_FILTER_FOCUS_SELECTORS.join(",")} {outline:3px solid #6e62f2;outline-offset:3px;border-radius:999px}
.adc2 .v-directory-related{margin-top:32px;padding-top:24px;border-top:1px solid rgba(22,34,54,.12)}
.adc2 .v-directory-related ul{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px 24px;list-style:none;margin:12px 0 0;padding:0}
.adc2 .v-directory-related a{color:inherit;text-decoration:underline;text-underline-offset:3px}
@media(max-width:720px){.adc2 .v-directory-related ul{grid-template-columns:repeat(2,minmax(0,1fr))}}`;

function VisualImage({ image, r, className }: { image: V2VisualImage; r: V2Resolvers; className?: string }) {
  return <Img image={{ src: image.src, alt: image.alt, width: image.w, height: image.h }} r={r} className={className} />;
}

function visualRatio(image: V2VisualImage): string {
  const ratio = image.w / image.h;
  if (Math.abs(ratio - 9 / 16) < 0.04) return "9:16";
  if (Math.abs(ratio - 1) < 0.04) return "1:1";
  if (Math.abs(ratio - 16 / 9) < 0.04) return "16:9";
  return image.w < image.h ? "9:16" : "16:9";
}

export function VisualStrip({ visual, r, includeOverview = false }: { visual: V2Visual; r: V2Resolvers; includeOverview?: boolean }) {
  if (!visual.strip.length && !(includeOverview && visual.overview)) return <style dangerouslySetInnerHTML={{ __html: `${AIDREAMCAPES_V2_VISUAL_CSS}\n${AIDREAMCAPES_V2_VISUAL_CSS_POLISH}` }} />;
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `${AIDREAMCAPES_V2_VISUAL_CSS}\n${AIDREAMCAPES_V2_VISUAL_CSS_POLISH}` }} />
      <section aria-label="Product examples" className="sec v-strip-section">
        <div className="wrap">
          <div className="v-strip" data-count={visual.strip.length}>
            {visual.strip.map((item, index) => (
              <figure className="v-strip-card" data-kind={item.kind} data-ratio={visualRatio(item)} key={`${item.src}-${index}`}>
                <VisualImage image={item} r={r} />
              </figure>
            ))}
          </div>
          {includeOverview ? <VisualOverview visual={visual} r={r} /> : null}
        </div>
      </section>
    </>
  );
}

export function VisualOverview({ visual, r }: { visual: V2Visual; r: V2Resolvers }) {
  return visual.overview ? <div className="v-overview"><p><RichText r={r} text={visual.overview} /></p></div> : null;
}

export function VisualSteps({ visual, r, buttonLabel = "Make my video", stepsH2 = "", stepsLead = "" }: {
  visual: V2Visual; r: V2Resolvers; buttonLabel?: string; stepsH2?: string; stepsLead?: string
}) {
  const step = visual.steps;
  if (!step) return null;
  const actorCards = step.actorCards ?? [];
  const actorStepStyles = actorCards.length ? (
    <style dangerouslySetInnerHTML={{ __html: `
      .adc2 .v-step-actor-maker{gap:8px}
      .adc2 .v-step-actor-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
      .adc2 .v-step-actor-card{position:relative;min-width:0;overflow:hidden;border:1px solid var(--line);border-radius:9px;background:#0c0c0f;color:var(--ink-2);font-size:10px;line-height:1.2;text-align:left}
      .adc2 .v-step-actor-card.is-selected{border-color:#c4b5fd;box-shadow:0 0 0 2px rgba(196,181,253,.5)}
      .adc2 .v-step-actor-card.is-selected::after{content:"✓";position:absolute;right:4px;top:4px;width:16px;height:16px;border-radius:50%;display:grid;place-items:center;background:#c4b5fd;color:#17131f;font-size:11px;font-weight:700}
      .adc2 .v-step-actor-card img.v-step-actor-image{width:100%;aspect-ratio:1;object-fit:cover;object-position:center top}
      .adc2 .v-step-actor-card span{display:block;padding:4px 5px 5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    ` }} />
  ) : null;
  return (
    <Section eyebrow="How it works" lead={stepsLead || visual.titles?.m2?.lead} title={stepsH2 || visual.titles?.m2?.h2 || "Three steps"}>
      {actorStepStyles}
      <div className="v-steps">
        <article className="v-step-card">
          <div className="v-step-art v-step-source">
            <div className="drop v-step-drop">
              <VisualImage image={step.source} r={r} className="v-step-thumb" />
              <div><b>{step.sourceTitle ? normalizeStepLabel(step.sourceTitle) : "Drop your product photo here"}</b><span>{step.sourceHint ?? "JPG, PNG or WebP · any clear photo works"}</span></div>
            </div>
          </div>
          <div className="v-step-copy"><span className="v-step-number">Step 01</span><h3>{normalizeStepLabel(step.items[0]?.t ?? "")}</h3><p>{step.items[0]?.d}</p></div>
        </article>
        <article className="v-step-card">
          <div className="v-step-art v-step-options">
            {actorCards.length ? (
              <div aria-label="Choose an actor" className="maker v-step-maker v-step-actor-maker">
                <div className="v-step-actor-grid" role="list">
                  {actorCards.map((card, index) => <div aria-label={`${card.label}${card.selected ? ", selected" : ""}`} className={`v-step-actor-card${card.selected ? " is-selected" : ""}`} key={`${card.image.src}-${index}`} role="listitem">
                    <VisualImage image={card.image} r={r} className="v-step-actor-image" />
                    <span>{card.label}</span>
                  </div>)}
                </div>
                <div className="opts">{step.options.map(([label, value]) => <span className="opt" key={label}>{label} <b>{value}</b></span>)}</div>
                <div className="maker-foot"><small>Cost</small><strong>{step.credits}</strong></div>
                <span aria-hidden="true" className="btn btn-grad v-step-submit">{buttonLabel} →</span>
              </div>
            ) : (
              <div className="maker v-step-maker">
                {step.prompt ? <div aria-label="Example description" className="v-step-prompt"><span className="v-step-prompt-text">{step.prompt}</span></div> : null}
                <div className="opts">{step.options.map(([label, value]) => <span className="opt" key={label}>{label} <b>{value}</b></span>)}</div>
                <div className="maker-foot"><small>Cost</small><strong>{step.credits}</strong></div>
                <span aria-hidden="true" className="btn btn-grad v-step-submit">{buttonLabel} →</span>
              </div>
            )}
          </div>
          <div className="v-step-copy"><span className="v-step-number">Step 02</span><h3>{normalizeStepLabel(step.items[1]?.t ?? "")}</h3><p>{step.items[1]?.d}</p></div>
        </article>
        <article className="v-step-card">
          <div className="v-step-art v-step-result">
            <VisualImage image={step.result} r={r} className={step.result.w < step.result.h ? "v-step-result-portrait" : undefined} />
            <span aria-hidden="true" className="btn btn-ghost v-download">Download</span>
          </div>
          <div className="v-step-copy"><span className="v-step-number">Step 03</span><h3>{normalizeStepLabel(step.items[2]?.t ?? "")}</h3><p>{step.items[2]?.d}</p></div>
        </article>
      </div>
    </Section>
  );
}

export function VisualDirectoryFilter({ visual, pageId, children, eyebrow = "Browse all", title, lead }: {
  visual: V2Visual; pageId: string; children: ReactNode; eyebrow?: string; title?: string; lead?: string;
}) {
  const picker = visual.picker;
  const pickerId = `visual-directory-${pageId.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}`;
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: DIRECTORY_FILTER_CSS }} />
      <Section eyebrow={eyebrow} lead={lead ?? visual.titles?.m3?.lead ?? picker.lead} title={title ?? visual.titles?.m3?.h2 ?? picker.title}>
        <div className="v-picker" id={pickerId}>
          <input aria-label="All" className="v-filter" data-chip="all" defaultChecked id={`${pickerId}-all`} name={`${pickerId}-filter`} type="radio" />
          {picker.chips.map((chip, index) => <input aria-label={chip.label} className="v-filter" data-chip={chip.id} data-filter-index={index + 1} id={`${pickerId}-${chip.id}`} key={chip.id} name={`${pickerId}-filter`} type="radio" />)}
          <div className="v-picker-chips" role="group" aria-label="Filter directory cards">
            <label data-filter-chip="all" htmlFor={`${pickerId}-all`}>All</label>
            {picker.chips.map((chip, index) => <label data-filter-chip={chip.id} data-filter-index={index + 1} htmlFor={`${pickerId}-${chip.id}`} key={chip.id}>{chip.label}</label>)}
          </div>
          {children}
        </div>
      </Section>
    </>
  );
}

export function VisualPicker({ visual, r, pageId, eyebrow = "Choose a scene", relatedGroups = [] }: {
  visual: V2Visual;
  r: V2Resolvers;
  pageId: string;
  eyebrow?: string;
  relatedGroups?: { title: string; links: { label: string; href: string }[] }[];
}) {
  const picker = visual.picker;
  const pickerId = `visual-picker-${pageId.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}`;
  if (!picker.cards.length) return null;
  const isHub = pageId === "video-hub" || pageId === "photo-hub";
  const photoGridStyle = pageId === "photo-hub" ? `#${pickerId} .v-picker-grid{grid-template-columns:repeat(5,minmax(0,1fr))}@media(max-width:1000px){#${pickerId} .v-picker-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:480px){#${pickerId} .v-picker-chips{flex-wrap:wrap;overflow-x:visible}}` : "";
  const pickerFocusCss = isHub ? `#${pickerId} .v-filter[data-chip="all"]:focus-visible~.v-picker-chips label[data-filter-chip="all"],${Array.from({ length: 3 }, (_, index) => `#${pickerId} .v-filter[data-filter-index="${index + 1}"]:focus-visible~.v-picker-chips label[data-filter-index="${index + 1}"]`).join(",")}{outline:3px solid #6e62f2;outline-offset:3px;border-radius:999px}` : "";
  const relatedCss = relatedGroups.length ? `#${pickerId} .v-related-groups{margin-top:30px;padding-top:22px;border-top:1px solid rgba(22,34,54,.12)}#${pickerId} .v-related-group+.v-related-group{margin-top:22px}#${pickerId} .v-related-group ul{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px 22px;list-style:none;margin:10px 0 0;padding:0}#${pickerId} .v-related-group a{color:inherit;text-decoration:underline;text-underline-offset:3px}@media(max-width:720px){#${pickerId} .v-related-group ul{grid-template-columns:repeat(2,minmax(0,1fr))}}` : "";
  return (
    <Section eyebrow={eyebrow} lead={visual.titles?.m3?.lead ?? picker.lead} title={visual.titles?.m3?.h2 ?? picker.title}>
      {photoGridStyle || pickerFocusCss || relatedCss ? <style dangerouslySetInnerHTML={{ __html: `${photoGridStyle}\n${pickerFocusCss}\n${relatedCss}` }} /> : null}
      <div className="v-picker" id={pickerId}>
        <input aria-label={isHub ? "All tools" : "All scenes"} className="v-filter" data-chip="all" defaultChecked id={`${pickerId}-all`} name={`${pickerId}-filter`} type="radio" />
        {picker.chips.map((chip, index) => <input aria-label={chip.label} className="v-filter" data-chip={chip.id} data-filter-index={index + 1} id={`${pickerId}-${chip.id}`} key={chip.id} name={`${pickerId}-filter`} type="radio" />)}
        <div className="v-picker-chips" role="group" aria-label={isHub ? "Filter tools" : "Filter scenes"}>
          <label data-filter-chip="all" htmlFor={`${pickerId}-all`}>All</label>
          {picker.chips.map((chip, index) => <label data-filter-chip={chip.id} data-filter-index={index + 1} htmlFor={`${pickerId}-${chip.id}`} key={chip.id}>{chip.label}</label>)}
        </div>
        <div className="v-picker-grid">
          {picker.cards.map((card, index) => (
            <a className="v-pick-card" data-chips={card.chips.join(" ")} data-filter-indexes={card.chips.map((id) => picker.chips.findIndex((chip) => chip.id === id) + 1).filter((index) => index > 0).join(" ")} href={r.href(card.href)} key={`${card.image.src}-${index}`}>
              <VisualImage image={card.image} r={r} />
              <span>{card.label}</span>
            </a>
          ))}
        </div>
        {relatedGroups.length ? <div className="v-related-groups">
          {relatedGroups.map((group) => <div className="v-related-group" key={group.title}>
            <h3>{group.title}</h3>
            <ul>{group.links.map((link) => <li key={link.href}><a href={r.href(link.href)}>{link.label}</a></li>)}</ul>
          </div>)}
        </div> : null}
        <div className="v-picker-action"><a className="btn btn-grad" href={r.href(picker.href)}>{picker.button} →</a></div>
      </div>
    </Section>
  );
}

function MockFrame({ item, r }: { item: V2VisualUse; r: V2Resolvers }) {
  if (item.frame === "split") {
    return <div className="v-frame v-split"><figure><VisualImage image={item.image} r={r} /><figcaption>A</figcaption></figure><figure><VisualImage image={item.imageB!} r={r} /><figcaption>B</figcaption></figure></div>;
  }
  if (item.frame === "tiktok") {
    return <div className="v-frame v-tiktok"><div className="v-tiktok-screen"><VisualImage image={item.image} r={r} /><div className="v-tiktok-ui"><span className="v-tiktok-actions"><i /><i /><i /><i /></span><span className="v-tiktok-meta"><b /><b /><i /></span></div></div></div>;
  }
  if (item.frame === "reels") {
    return <div className="v-frame v-reels"><div className="v-reels-screen"><VisualImage image={item.image} r={r} /><div className="v-reels-ui"><span className="v-reels-top"><i /><i /></span><span className="v-reels-actions"><i /><i /><i /><i /></span><span className="v-reels-meta"><b /><b /></span></div></div></div>;
  }
  if (item.frame === "amazon") {
    return <div className="v-frame v-amazon"><div className="v-amazon-bar"><i /><span /></div><div className="v-amazon-grid"><figure><VisualImage image={item.image} r={r} /></figure><div className="v-amazon-thumbs"><i /><i /><i /><i /></div></div></div>;
  }
  if (item.frame === "phone") {
    return <div className="v-frame v-phone"><div className="v-phone-screen"><VisualImage image={item.image} r={r} /><div className="v-placeholder-lines"><i /><i /><i /></div></div></div>;
  }
  if (item.frame === "browser") {
    const body = item.imageB ? <div className="v-browser-split"><figure><VisualImage image={item.image} r={r} /><figcaption>A</figcaption></figure><figure><VisualImage image={item.imageB} r={r} /><figcaption>B</figcaption></figure></div> : <VisualImage image={item.image} r={r} />;
    return <div className="v-frame v-browser"><div className="v-browser-bar"><i /><i /><i /><span /></div><div className="v-product-page">{body}<div className="v-product-skeleton"><i /><i /><i /><b /></div></div></div>;
  }
  if (item.frame === "listing") {
    return <div className="v-frame v-listing"><VisualImage image={item.image} r={r} /><i /><i /><i /></div>;
  }
  return <div className="v-frame v-post"><div className="v-post-bar"><i /><b /></div><VisualImage image={item.image} r={r} /><div className="v-placeholder-lines"><i /><i /></div></div>;
}

export function VisualUses({ visual, r }: { visual: V2Visual; r: V2Resolvers }) {
  if (!visual.uses.length) return null;
  return <Section eyebrow="Where to use it" title={visual.titles?.m4?.h2 ?? "Put each result to work"}><div className="v-uses">{visual.uses.map((item, index) => <article className="v-use-row" key={`${item.frame}-${index}`}><div className="v-use-art"><div className="v-use-art-inner"><MockFrame item={item} r={r} /></div></div><div className="v-use-copy"><h3>{item.h}</h3><p>{item.d}</p></div></article>)}</div></Section>;
}

function InputPair({ item, r }: { item: V2VisualInput; r: V2Resolvers }) {
  return <div className="v-input-pair"><figure><div className="v-input-mark is-good">✓</div><VisualImage image={item.good} r={r} /><figcaption>{item.good_label}</figcaption></figure><figure><div className="v-input-mark is-bad">✕</div><VisualImage className={item.darkened ? "v-input-darkened" : undefined} image={item.bad} r={r} /><figcaption>{item.bad_label}</figcaption></figure></div>;
}

export function VisualInput({ visual, r }: { visual: V2Visual; r: V2Resolvers }) {
  if (!visual.input.length) return null;
  const darkened = visual.input.some((item) => item.darkened);
  return <Section eyebrow="Start with a clear photo" title={visual.titles?.m5?.h2 ?? "Choose a photo that shows the product well"}>
    {darkened ? <style dangerouslySetInnerHTML={{ __html: ".adc2 img.v-input-darkened{filter:brightness(.28)}" }} /> : null}
    <div className="v-input-grid">{visual.input.map((item, index) => <InputPair item={item} key={`${item.good.src}-${index}`} r={r} />)}</div>
  </Section>;
}

function OutputCard({ item, r }: { item: V2VisualOutput; r: V2Resolvers }) {
  return <article className="v-output-card" data-frame={item.frame}><figure className="v-output-frame" data-frame={item.frame}><VisualImage image={item.image} r={r} /></figure><div className="v-output-copy"><b>{item.label}</b><span>{item.spec}</span></div></article>;
}

export function VisualOutputs({ visual, r, includeLimitations = false }: { visual: V2Visual; r: V2Resolvers; includeLimitations?: boolean }) {
  if (!visual.outputs.length && !includeLimitations) return null;
  return <Section eyebrow="Your result" title={visual.titles?.m6?.h2 ?? "See the format and cost"}><div className="v-output-grid">{visual.outputs.map((item, index) => <OutputCard item={item} key={`${item.image.src}-${index}`} r={r} />)}</div>{includeLimitations ? <VisualLimitations asSubsection visual={visual} /> : null}</Section>;
}

function MockOverlay({ mock }: { mock: V2AfterMock }) {
  if (!mock || typeof mock !== "object") return null;
  const t = String(mock.type ?? "");
  if (t === "limited") {
    return <div className="v-mock v-mock-limited">
      <span className="v-mock-badge">{mock.badge ?? "LIMITED DROP"}</span>
      <div className="v-mock-count"><b>{mock.countdown ?? "23:59:16"}</b><span>left to order</span></div>
      <div className="v-mock-foot"><span>{mock.caption ?? "Small batch"}</span><b className="v-mock-cta">{mock.cta ?? "Get notified"}</b></div>
    </div>;
  }
  if (t === "tiktok") {
    return <div className="v-mock v-mock-tiktok">
      <div className="v-mock-tt-top"><i /><b>@your.store</b><span>Sponsored</span></div>
      <div className="v-mock-tt-actions"><i className="is-heart" /><i /><i /><i /><i /></div>
      <div className="v-mock-tt-cap"><b>@your.store</b><span>{mock.caption ?? "Real creator post"}</span><div className="v-mock-tt-sound"><i />Original sound</div></div>
    </div>;
  }
  if (t === "carousel") {
    return <div className="v-mock v-mock-carousel">
      <span className="v-mock-panel">1/4</span>
      <b className="v-mock-car-title">{mock.title ?? "Panel one"}</b>
      <div className="v-mock-dots"><i className="is-active" /><i /><i /><i /></div>
    </div>;
  }
  if (t === "callout") {
    return <div className="v-mock v-mock-callout">
      <span className="v-mock-tag t1">{mock.tag1 ?? "Feature"}</span>
      <span className="v-mock-tag t2">{mock.tag2 ?? "Detail"}</span>
      <span className="v-mock-tag t3">{mock.tag3 ?? "Benefit"}</span>
    </div>;
  }
  if (t === "steps") {
    return <div className="v-mock v-mock-steps">
      <span className="v-mock-step s1">Step 1</span>
      <span className="v-mock-step s2">Step 2</span>
      <span className="v-mock-step s3">Step 3</span>
    </div>;
  }
  return null;
}

export function VisualAfter({ visual, r }: { visual: V2Visual; r: V2Resolvers }) {
  if (!visual.after) return null;
  const after = visual.after;
  return <Section eyebrow="After download" title={visual.titles?.m7?.h2 ?? "Add your final details in an editor"}><div className="v-after"><div className="v-after-art"><VisualImage image={after.image} r={r} />{after.mock ? <MockOverlay mock={after.mock} /> : <div className="v-after-zones">{after.zones.map((zone, index) => {
    const role = /headline/i.test(zone) ? "headline" : /price/i.test(zone) ? "price" : `zone-${index}`;
    return <span data-zone-index={index} data-zone-role={role} key={`${zone}-${index}`}>{zone}</span>;
  })}</div>}</div><div className="v-after-copy"><p>These details are added in your editor after download.</p><ul>{after.items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></div></div></Section>;
}

export function VisualSizes({ visual, r }: { visual: V2Visual; r: V2Resolvers }) {
  if (!visual.sizes?.length) return null;
  return <Section eyebrow="Formats" title={visual.titles?.m8?.h2 ?? "Choose a frame for each placement"}><div className="v-size-grid">{visual.sizes.map((item, index) => <figure className="v-size-card" data-frame={item.frame} key={`${item.frame}-${index}`}><div className="v-size-frame" data-frame={item.frame}><VisualImage image={item.image} r={r} /></div><figcaption><b>{item.frame}</b><span>{item.label}</span></figcaption></figure>)}</div></Section>;
}

export function VisualLimitations({ visual, asSubsection = false }: { visual: V2Visual; asSubsection?: boolean }) {
  if (!visual.limitations.items.length) return null;
  const list = <ul className="v-limit-list">{visual.limitations.items.map((item, index) => <li key={`${item.label}-${index}`}><span aria-hidden="true" className={item.supported ? "is-supported" : "is-limited"}>{item.supported ? "✓" : "✕"}</span><span className="v-limit-copy"><b>{item.label}</b>{item.detail ? <small>{item.detail}</small> : null}</span></li>)}</ul>;
  return asSubsection ? <div className="v-limit-inline"><h3>{visual.limitations.h2}</h3>{list}</div> : <Section eyebrow="Before you publish" title={visual.limitations.h2}>{list}</Section>;
}
