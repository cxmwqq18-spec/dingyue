import { WorkspaceEntryLink } from "@/components/aidreamcapes-workspace/entry-link";
import { aidreamcapesV2ResponsiveImageProps, aidreamcapesV2ResponsiveImagePropsFor, aidreamcapesV2ResponsivePosterSrc } from "@/lib/aidreamcapes-v2-responsive-images";
import { mediaCardHref } from "@/lib/aidreamcapes-workspace/media-detail";
import { mediaCardCanonicalSlug } from "@/lib/aidreamcapes-workspace/media-card-canonical";
import type { CSSProperties, ReactNode } from "react";
import "./numbered-cards.css";
import "./thematic-links.css";
import { AIDREAMCAPES_V2_COLLAGE_SIZES, AIDREAMCAPES_V2_TEMPLATE_CARD_SIZES } from "./image-sizes";
import type { V2Article, V2BenefitIcon, V2Card, V2CompareTable, V2Crumb, V2Definition, V2EnrichmentBlock, V2EnrichmentSection, V2Examples, V2Example, V2Faq, V2FitBlock, V2HeroMedia, V2Image, V2ImageItem, V2Item, V2Maker, V2MoreSection, V2Plan, V2Resolvers, V2SpecRow, V2TextSection, V2Tool, V2Video, V2GlossaryEntry, V2DirectorySpecs, V2DirectoryScene, V2ActorScenePicker, V2SellerScenarioBlock, V2CardBlock, V2CardBlockItem, V2ReviewBlock, V2ReviewItem, V2TeamIcon, V2ClosingBlock, V2LinkCardBlock } from "./types";
import type { V2Company } from "./company";
import { copyLabel } from "./types";
import { Adc2VideoPreview } from "./video-preview-card";
import { Coins, Captions, DollarSign, Gauge, Calendar, Camera, CircleCheck, Clapperboard, Clock, Copy, Crop, Droplet, Eye, FileText, Film, Gem, Hand, House, Image, Images, Languages, Laptop, Layers, LayoutGrid, Link, Megaphone, MessageCircle, Mic, Music, Package, Palette, PenLine, Play, Ratio, RefreshCw, Repeat, Rocket, Ruler, Scissors, Share2, ShieldCheck, Shirt, ShoppingCart, Smartphone, Sparkles, Star, Store, Sun, Tag, Target, Timer, Type, UserCheck, UserRound, Users, Utensils, WandSparkles, Zap } from "lucide-react";

function SoonLabel({ soon }: { soon?: boolean }) {
  return soon ? <span className="v-soon">Coming soon</span> : null;
}

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

// A generated candidate list adds to the candidates the page already publishes.
// Both lists stay: the stored one may name a wider file than the generated set.
function mergeSrcSets(stored: string | undefined, generated: string | undefined): string | undefined {
  if (!stored) return generated;
  if (!generated) return stored;
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const list of [stored, generated]) {
    for (const part of list.split(",")) {
      const candidate = part.trim();
      if (!candidate || seen.has(candidate)) continue;
      seen.add(candidate);
      parts.push(candidate);
    }
  }
  return parts.join(", ");
}

// `srcSet`/`sizes` are optional. A page that has no generated variant set for an
// image keeps its single source and renders exactly the attributes it rendered before.
export function Img({ image, r, className, eager, style, srcSet, sizes }: { image: V2Image; r: V2Resolvers; className?: string; eager?: boolean; style?: CSSProperties; srcSet?: string; sizes?: string }) {
  const resolvedSrcSet = mergeSrcSets(image.srcSet ? resolveSrcSet(image.srcSet, r) : undefined, srcSet);
  const resolvedSizes = sizes ?? (image.srcSet ? image.sizes : undefined);
  return (
    <img
      alt={image.alt}
      className={className}
      decoding="async"
      fetchPriority={eager ? "high" : undefined}
      height={image.height}
      loading={eager ? "eager" : "lazy"}
      style={style}
      sizes={resolvedSrcSet ? resolvedSizes : undefined}
      src={r.asset(image.src)}
      srcSet={resolvedSrcSet}
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
            {index === items.length - 1 ? <span>{item.label}</span> : <WorkspaceEntryLink href={r.href(item.href)}>{item.label}</WorkspaceEntryLink>}
          </span>
        ))}
      </nav>
    </div>
  );
}

export function SecHead({ eyebrow, title, lead, titleId }: { eyebrow: string; title: string; lead?: string; titleId?: string }) {
  return (
    <div className="sec-head">
      <div className="eyebrow">{eyebrow}</div>
      <h2 id={titleId}>{title}</h2>
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

/** A first-screen, no-network picker shared by the AI actor directory and video tools. */
export function ActorScenePanel({ picker, r, pageId }: { picker: V2ActorScenePicker; r: V2Resolvers; pageId: string }) {
  if (!picker.actors.length || !picker.scenes.length) return null;
  const firstActor = picker.actors.find((actor) => actor.selected) ?? picker.actors[0];
  const firstScene = firstActor.scene || picker.scenes[0];
  const pageCta = picker.cta;
  const formAction = (r.direct ?? r.href)("/app/create");
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .adc2 .actor-scene-panel{margin-top:20px;padding:16px;border:1px solid var(--line-2);border-radius:18px;background:rgba(10,10,12,.7)}
        .adc2 .actor-scene-panel-head{display:flex;flex-direction:column;gap:5px;margin-bottom:13px}
        .adc2 .actor-scene-panel-head h2{font-size:20px;line-height:1.25}
        .adc2 .actor-scene-panel-head p{color:var(--ink-3);font-size:13px;line-height:1.5}
        .adc2 .actor-scene-picker-form{display:flex;flex-direction:column;gap:14px}
        .adc2 .actor-scene-picker-form fieldset{min-width:0;margin:0;padding:0;border:0}
        .adc2 .actor-scene-picker-form legend{margin-bottom:7px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3)}
        .adc2 .actor-scene-choices{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
        .adc2 .actor-scene-choice{position:relative;display:block;min-width:0;overflow:hidden;border:1px solid var(--line);border-radius:10px;background:#0c0c0f;cursor:pointer}
        .adc2 .actor-scene-choice input{position:absolute;width:1px;height:1px;opacity:0}
        .adc2 .actor-scene-choice:has(input:checked){border-color:#c4b5fd;box-shadow:0 0 0 2px rgba(196,181,253,.45)}
        .adc2 .actor-scene-choice img{width:100%;aspect-ratio:1;object-fit:cover;object-position:center top}
        .adc2 .actor-scene-choice span{display:block;padding:5px 6px;color:var(--ink-2);font-size:11px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .adc2 .actor-scene-chips{display:flex;flex-wrap:wrap;gap:6px;max-height:112px;overflow:auto;padding-right:2px}
        .adc2 .actor-scene-chip{position:relative;display:inline-flex;cursor:pointer}
        .adc2 .actor-scene-chip input{position:absolute;width:1px;height:1px;opacity:0}
        .adc2 .actor-scene-chip span{display:inline-flex;padding:6px 9px;border:1px solid var(--line);border-radius:999px;color:var(--ink-2);font-size:12px;line-height:1.2}
        .adc2 .actor-scene-chip:has(input:checked) span{border-color:#c4b5fd;background:rgba(139,92,246,.2);color:var(--ink)}
        .adc2 .actor-scene-picker-form .btn{align-self:flex-start;padding:10px 14px;font-size:13px}
        @media(max-width:500px){.adc2 .actor-scene-choices{grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}.adc2 .actor-scene-choice span{font-size:10px;padding-inline:4px}.adc2 .actor-scene-panel{padding:13px}}
      ` }} />
      <section aria-labelledby={`actor-scene-panel-${pageId}`} className="actor-scene-panel" data-actor-scene-picker>
        <div className="actor-scene-panel-head">
          <h2 id={`actor-scene-panel-${pageId}`}>{picker.title}</h2>
          <p>{picker.lead}</p>
        </div>
        <form action={formAction} className="actor-scene-picker-form" data-page-prompt={pageCta?.prompt} method="get">
          <input name="tool" type="hidden" value={picker.tool} />
          <input name="size" type="hidden" value={picker.size} />
          <input name="length" type="hidden" value={picker.length} />
          <input name="actor" type="hidden" value={firstActor.id} />
          <input name="scene" type="hidden" value={firstScene} />
          <input name="prompt" type="hidden" value={pageCta?.prompt ?? firstActor.promptTemplate.replaceAll("{{scene}}", firstScene)} />
          <fieldset>
            <legend>Choose an avatar</legend>
            <div className="actor-scene-choices" role="radiogroup" aria-label="Choose an avatar">
              {picker.actors.map((actor) => <label className="actor-scene-choice" key={actor.id}>
                <input data-actor-prompt={actor.promptTemplate} defaultChecked={actor.id === firstActor.id} name={`actor-choice-${pageId}`} type="radio" value={actor.id} />
                <Img image={actor.image} r={r} />
                <span>{actor.name}</span>
              </label>)}
            </div>
          </fieldset>
          <fieldset>
            <legend>Choose a scene</legend>
            <div className="actor-scene-chips" role="radiogroup" aria-label="Choose a scene">
              {picker.scenes.map((scene) => <label className="actor-scene-chip" key={scene}>
                <input defaultChecked={scene === firstScene} name={`scene-choice-${pageId}`} type="radio" value={scene} />
                <span>{scene}</span>
              </label>)}
            </div>
          </fieldset>
          <button className="btn btn-grad" type="submit">{pageCta?.label ?? picker.button} →</button>
        </form>
      </section>
    </>
  );
}

/** Illustrative seller workflows; this block intentionally has no testimonial claims. */
export function SellerScenarioSection({ scenarios, r }: { scenarios: V2SellerScenarioBlock; r: V2Resolvers }) {
  if (!scenarios.items.length) return null;
  return (
    <Section eyebrow="Example seller scenes" lead={scenarios.lead} title={scenarios.title}>
      <style dangerouslySetInnerHTML={{ __html: `
        .adc2 .seller-scenario-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
        .adc2 .seller-scenario-card{min-width:0;overflow:hidden;border:1px solid var(--line);border-radius:16px;background:var(--card)}
        .adc2 .seller-scenario-card figure{margin:0;aspect-ratio:1;overflow:hidden;background:#0d0d10}
        .adc2 .seller-scenario-card figure img{width:100%;height:100%;object-fit:cover}
        .adc2 .seller-scenario-copy{display:flex;flex-direction:column;gap:7px;padding:15px}
        .adc2 .seller-scenario-copy h3{font-size:17px;line-height:1.25}
        .adc2 .seller-scenario-tool{font-size:12px;color:#c4b5fd}
        .adc2 .seller-scenario-tool a{text-decoration:underline;text-underline-offset:3px}
        .adc2 .seller-scenario-copy>p:last-child{color:var(--ink-3);font-size:14px;line-height:1.55}
        @media(max-width:900px){.adc2 .seller-scenario-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(max-width:500px){.adc2 .seller-scenario-grid{grid-template-columns:minmax(0,1fr)}}
      ` }} />
      <div className="seller-scenario-grid">
        {scenarios.items.map((item) => <article className="seller-scenario-card" key={`${item.audience}-${item.tool}`}>
          <figure><Img image={item.image} r={r} /></figure>
          <div className="seller-scenario-copy">
            <h3>{item.audience}</h3>
            <p className="seller-scenario-tool">Tool: <WorkspaceEntryLink href={r.href(item.href)}>{item.tool}</WorkspaceEntryLink></p>
            <p>{item.task}</p>
          </div>
        </article>)}
      </div>
    </Section>
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
// Numbering is optional so homepage cards can opt in without changing other pages.
export function MoreSections({ sections, r, numbered = false }: { sections?: V2MoreSection[]; r: V2Resolvers; numbered?: boolean }) {
  const list = (sections ?? []).filter((section) => section?.h2 && section.items?.length);
  if (!list.length) return null;
  return <>{list.map((section) => (
    <Section eyebrow={section.eyebrow} key={`${section.h2}-${section.lead ?? ""}`} lead={section.lead} title={section.h2}>
      <Boxes items={section.items} numbered={numbered} r={r} />
    </Section>
  ))}</>;
}

export function FitSection({ block, r }: { block?: V2FitBlock; r: V2Resolvers }) {
  if (!block) return null;
  const fitList = (items: V2Item[]) => items.map((item) => <li key={item.t}><b>{item.t}<SoonLabel soon={item.soon} /></b>{item.d ? <p>{r ? <RichText r={r} text={item.d} /> : item.d}</p> : null}</li>);
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
      <dd><p>{entry.definition}</p>{entry.related.length ? <p className="glossary-related">Related: {entry.related.map((link, index) => <span key={link.href}>{index > 0 ? ", " : null}<WorkspaceEntryLink href={r.href(link.href)}>{link.label}</WorkspaceEntryLink></span>)}</p> : null}</dd>
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

export function BenefitIcon({ name }: { name: V2BenefitIcon }) {
  return <span aria-hidden="true" className="v-benefit-icon"><svg fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24" width="24">{BENEFIT_ICON_PATHS[name]}</svg></span>;
}

export function ImageItemRows({ items, r, numbered = false }: { items: V2ImageItem[]; r: V2Resolvers; numbered?: boolean }) {
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
    <div className={`v-image-item-rows${numbered ? " v-numbered-rows" : ""}`}>
      {items.map((item, index) => {
        if (!item.img) return null;
        const image = item.alt ? { ...item.img, alt: item.alt } : item.img;
        const frame = item.frame && item.frame !== "none" ? `v-image-frame-${item.frame}` : "v-image-frame-none";
        return <article className="v-image-item-row" key={`${item.t}-${index}`}>
          <div className="v-image-item-copy"><h3>{numbered ? <CardNumber index={index} /> : null}{item.href ? <WorkspaceEntryLink href={r.href(item.href)}>{item.t}</WorkspaceEntryLink> : item.t}<SoonLabel soon={item.soon} /></h3><p>{r ? <RichText r={r} text={item.d} /> : item.d}</p></div>
          <div className="v-image-item-media"><figure className={frame}><Img image={image} r={r} /></figure></div>
        </article>;
      })}
    </div>
  </>;
}

function hasImageItems(items: V2Item[]): items is V2ImageItem[] {
  return items.length > 0 && items.every((item) => item && typeof item.img === "object" && Boolean(item.img.src));
}

function CardNumber({ index }: { index: number }) {
  return <span aria-hidden="true" className="v-card-number">{String(index + 1).padStart(2, "0")}</span>;
}

export function Boxes({ items, className = "ben", r, numbered = false }: { items: V2Item[]; className?: string; r?: V2Resolvers; numbered?: boolean }) {
  if (!items.length) return null;
  if (hasImageItems(items) && r) return <ImageItemRows items={items} numbered={numbered} r={r} />;
  const Title = numbered ? "h3" : "b";
  return <div className={`${className}${numbered ? " v-numbered-cards" : ""}`}>
    {items.map((item, index) => (
      <div key={item.t}>
        {item.icon ? <BenefitIcon name={item.icon} /> : null}
        <Title className={numbered ? "v-numbered-title" : undefined}>{numbered ? <CardNumber index={index} /> : null}{item.t}<SoonLabel soon={item.soon} /></Title>
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
          <h3>{normalizeStepLabel(item.t)}<SoonLabel soon={item.soon} /></h3>
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
          <b>{item.href ? <WorkspaceEntryLink href={r.href(item.href)}>{item.t} →</WorkspaceEntryLink> : item.t}<SoonLabel soon={item.soon} /></b>
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

// Linked card sections (format or category directories). Cards can carry a page-owned
// image above the copy while retaining the original text-only treatment when no image is set.
export function TextSections({ sections, r }: { sections: V2TextSection[]; r: V2Resolvers }) {
  if (!sections?.length) return null;
  return (
    <>
      {sections.filter((section) => section?.title && section.cards?.length).map((section) => (
        <Section eyebrow={section.eyebrow} key={`${section.eyebrow}-${section.title}`} lead={section.lead ?? ""} title={section.title}>
          <style dangerouslySetInnerHTML={{ __html: `
            .adc2 .text-section-grid{grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))}
            .adc2 .text-section-grid .text-section-media{margin:-18px -18px 14px;overflow:hidden;border-radius:14px 14px 0 0;background:#0b0b0d}
            .adc2 .text-section-grid .text-section-media img{display:block;width:100%;height:auto;aspect-ratio:auto;object-fit:contain}
            @media(max-width:560px){.adc2 .text-section-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.adc2 .text-section-grid>div{padding:10px}.adc2 .text-section-grid .text-section-media{margin:-10px -10px 10px;border-radius:10px 10px 0 0}}
          ` }} />
          <div className={section.cards.some((card) => card.img) ? "ideas text-section-grid" : "ideas"}>
            {section.cards.map((card) => (
              <div key={card.t}>
                {card.img ? <div className="text-section-media"><Img image={card.img} r={r} /></div> : null}
                <b>{card.t}<SoonLabel soon={card.soon} /></b>
                <p><RichText r={r} text={card.d} /></p>
                {card.href ? <p className="meta-line"><WorkspaceEntryLink href={r.href(card.href)}>{card.label || card.t} →</WorkspaceEntryLink></p> : null}
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
              ? links.map((link, index) => <span key={link.href}>{index > 0 ? ", " : null}<WorkspaceEntryLink href={r.href(link.href)}>{link.label}</WorkspaceEntryLink></span>)
              : value}
          </b>
        </div>
      ))}
    </div>
  );
}

// The company named in the site profile: name, postal address, phone and email.
export function CompanyDetails({ company, className, labels }: { company: V2Company; className?: string; labels?: Record<string, string> }) {
  return (
    <address className={className ? `company ${className}` : "company"}>
      <b>{company.name}</b>
      {company.address ? <span>{company.address}</span> : null}
      {company.phone ? <span>{copyLabel({ copy: labels }, "Phone:")} <WorkspaceEntryLink href={`tel:${company.phoneHref}`}>{company.phone}</WorkspaceEntryLink></span> : null}
      {company.email ? <span>{copyLabel({ copy: labels }, "Email:")} <WorkspaceEntryLink href={`mailto:${company.email}`}>{company.email}</WorkspaceEntryLink></span> : null}
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

// Inline links support internal paths, email addresses and approved official references.
export function RichText({ text, r }: { text: string; r: V2Resolvers }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(/\[([^\]\n]+)\]\((https:\/\/[^)\s]+|mailto:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\/[^)\s]*)\)/gi)) {
    const at = match.index ?? 0;
    if (at > last) parts.push(text.slice(last, at));
    if (/^mailto:/i.test(match[2])) parts.push(<WorkspaceEntryLink href={match[2]} key={at}>{match[1]}</WorkspaceEntryLink>);
    else if (/^https:\/\//i.test(match[2])) {
      const localPath = localPathFromAbsoluteHref(match[2]);
      if (localPath) parts.push(<WorkspaceEntryLink href={r.href(localPath)} key={at}>{match[1]}</WorkspaceEntryLink>);
      else if (isApprovedExternalHref(match[2])) parts.push(<WorkspaceEntryLink href={match[2]} key={at} rel="noopener noreferrer" target="_blank">{match[1]}</WorkspaceEntryLink>);
      else parts.push(match[0]);
    } else parts.push(<WorkspaceEntryLink href={r.href(match[2])} key={at}>{match[1]}</WorkspaceEntryLink>);
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
            <b><WorkspaceEntryLink className="card-title" href={r.href(item.href)}>{item.title}</WorkspaceEntryLink></b>
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
              <details key={item.q} name="adc2-faq" open={index === 0}>
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
  const href = mediaCardHref(card.kind, mediaCardCanonicalSlug(card), card.href);
  return (
    <article className={`tc${filterIndexes.length ? " v-filter-card" : ""}`} data-filter-indexes={filterIndexes.length ? filterIndexes.join(" ") : undefined} data-ind={card.filterTags && card.filterTags.length ? card.filterTags.join(" ") : card.industries.join(" ")} data-plat={card.platforms.join(" ")} data-type={card.kind}>
      <div className="ti">
        <Img image={card.image} r={r} />
      </div>
      <div className="tb">
        <h3><a className="card-title" href={r.href(href)}>{card.name}</a><SoonLabel soon={card.soon} /></h3>
        {card.line ? <p>{card.line}</p> : null}
        <a className="use" href={r.href(href)}>View template →</a>
      </div>
    </article>
  );
}

/** A page-specific example. Case cards keep the result, format and next action together. */
export function CaseCard({ card, r, filterIndexes = [] }: { card: V2Card; r: V2Resolvers; filterIndexes?: number[] }) {
  const video = card.video;
  const href = mediaCardHref(card.kind, mediaCardCanonicalSlug(card), card.href);
  return (
    <article className={`tc case-card${filterIndexes.length ? " v-filter-card" : ""}`} data-filter-indexes={filterIndexes.length ? filterIndexes.join(" ") : undefined} data-ind={card.industries.join(" ")} data-plat={card.platforms.join(" ")} data-type={card.kind}>
      <div className="ti">
        {video ? (
          <Adc2VideoPreview ariaLabel={video.name ?? card.name} media={{ duration: video.duration, height: video.height, name: video.name, poster: r.asset(aidreamcapesV2ResponsivePosterSrc(video.poster.src)), previewSrc: video.previewSrc ? r.asset(video.previewSrc) : undefined, src: r.asset(video.src), width: video.width }} />
        ) : <Img image={card.image} r={r} {...aidreamcapesV2ResponsiveImageProps(card.image.src, AIDREAMCAPES_V2_TEMPLATE_CARD_SIZES)} />}
      </div>
      <div className="tb">
        <h3>{card.name}<SoonLabel soon={card.soon} /></h3>
        <a className="use" href={r.href(href)}>Make a {card.kind === "video" || card.videoExample ? "video" : "photo"} like this →</a>
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
    // A clip and a scene are moving pictures; only a still example is a photo.
    kind: item.kind === "photo" ? "photo" : "video",
    videoExample: item.kind === "clip" || item.kind === "scene",
    href: item.href,
    image: item.image,
    tags: [],
    industries: [],
    platforms: [],
    mediaRef: item.mediaRef,
    ...(item.publicSlug ? { publicSlug: item.publicSlug } : {}),
    ...(item.prompt ? { prompt: item.prompt } : {}),
    ...(item.aspect ? { aspect: item.aspect } : {}),
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
      {tool.image ? <img {...aidreamcapesV2ResponsiveImagePropsFor(tool.image.src, "46px", r.asset)} alt="" decoding="async" height={46} loading="lazy" src={r.asset(tool.image.src)} width={46} /> : <ToolIcon group={tool.group} />}
      <div>
        <b><WorkspaceEntryLink className="card-title" href={r.href(tool.href)}>{tool.label}</WorkspaceEntryLink></b>
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
        <h4><WorkspaceEntryLink className="card-title" href={r.href(tool.href)}>{tool.label}</WorkspaceEntryLink></h4>
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
          <WorkspaceEntryLink className="btn btn-grad" href={r.href(guide.href)}>{guide.label}</WorkspaceEntryLink>
          <WorkspaceEntryLink className="btn btn-ghost" href={r.href(guide.secondaryHref)}>{guide.secondaryLabel}</WorkspaceEntryLink>
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
        <WorkspaceEntryLink className="make-all" href={r.href(allHref)}>{allLabel} →</WorkspaceEntryLink>
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
export const BRAND_NAME = "AIVIDEOSUGC";
export const BRAND_ICON = "/assets/sites/site_aidreamcapes/brand/aivideosugc-icon-64.png?v=20261011ugc";

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

const AUDIENCE_WORDS = ["DTC", "Agency", "SaaS"];

export function AudienceTag({ labels }: { labels?: Record<string, string> } = {}) {
  return (
    <span className="hero-aud">
      <span className="sr-only">{copyLabel({ copy: labels }, "DTC, Agency, and SaaS")}</span>
      <svg aria-hidden="true" className="hero-aud-spark" fill="currentColor" height="14" viewBox="0 0 16 16" width="14">
        <path d="M8 1.2 9.1 6 13.8 8 9.1 10 8 14.8 6.9 10 2.2 8 6.9 6Z" />
      </svg>
      <span aria-hidden="true" className="hero-aud-rot">
        {AUDIENCE_WORDS.map((word) => <span key={word}>{copyLabel({ copy: labels }, word)}</span>)}
      </span>
    </span>
  );
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
        <WorkspaceEntryLink className="btn btn-grad" href={r.href(maker.href)}>{maker.cta} →</WorkspaceEntryLink>
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
          <Img eager={index === 0} image={card.image} r={r} {...aidreamcapesV2ResponsiveImageProps(card.image.src, AIDREAMCAPES_V2_COLLAGE_SIZES)} />
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
      <video aria-label={video.name ?? video.poster.alt} controls height={video.height} playsInline poster={r.asset(aidreamcapesV2ResponsivePosterSrc(video.poster.src))} preload="none" src={r.asset(video.src)} width={video.width} />
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
        <video aria-label={media.video.poster.alt} autoPlay data-adc2-loop height={media.video.height} loop muted playsInline poster={r.asset(aidreamcapesV2ResponsivePosterSrc(media.video.poster.src))} preload="metadata" src={r.asset(media.video.src)} width={media.video.width} />
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
  return <div className="hero-quick"><WorkspaceEntryLink className="btn btn-grad" href={r.href(href)}>{label} →</WorkspaceEntryLink></div>;
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
          <WorkspaceEntryLink className="btn btn-primary" href={r.href(href)}>{copyLabel(r, "Get started")}</WorkspaceEntryLink>
          <WorkspaceEntryLink className="btn btn-ghost" href={r.href("/templates")}>{copyLabel(r, "Browse templates")}</WorkspaceEntryLink>
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
          <WorkspaceEntryLink className={plan.popular ? "btn btn-grad" : "btn btn-ghost"} href={r.href("/app/create")}>Choose {plan.name}</WorkspaceEntryLink>
        </div>
      ))}
    </div>
  );
}

// Card blocks a page can add through `blockOrder`. Cards show their picture when they
// have one; without it they use a text card with a drawn marker instead of an image.
const cardBlockCss = `
.adc2 .v1-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;counter-reset:v1card}
.adc2 .v1-card{position:relative;min-width:0;overflow:hidden;border:1px solid var(--line);border-radius:16px;background:var(--card);display:flex;flex-direction:column;counter-increment:v1card}
.adc2 .v1-card figure{margin:0;aspect-ratio:4/3;overflow:hidden;background:#0d0d10}
.adc2 .v1-card figure img{width:100%;height:100%;object-fit:cover;display:block}
.adc2 .v1-card-copy{display:flex;flex:1;flex-direction:column;gap:9px;padding:20px 22px 22px}
.adc2 .v1-card h3{margin:0;font-size:18px;line-height:1.3;color:var(--ink)}
.adc2 .v1-card p{margin:0;color:var(--ink-2);font-size:15px;line-height:1.6}
.adc2 .v1-card p a{text-decoration:underline;text-underline-offset:3px}
.adc2 .v1-mark{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;background:linear-gradient(135deg,var(--pink),#8b5cf6);color:#fff;font-size:14px;font-weight:700;margin-bottom:4px}
.adc2 .v1-mark::before{content:counter(v1card,decimal-leading-zero)}
.adc2 .v1-icon{width:48px;height:48px;border-radius:12px;display:grid;place-items:center;margin-bottom:6px;border:1px solid var(--tone-line);background:var(--tone-bg);color:var(--tone)}
.adc2 .v1-tone-0{--tone:#c4b5fd;--tone-bg:rgba(139,92,246,.16);--tone-line:rgba(139,92,246,.38)}
.adc2 .v1-tone-1{--tone:#6ee7b7;--tone-bg:rgba(16,185,129,.14);--tone-line:rgba(16,185,129,.36)}
.adc2 .v1-tone-2{--tone:#f9a8d4;--tone-bg:rgba(236,72,153,.14);--tone-line:rgba(236,72,153,.36)}
.adc2 .v1-tone-3{--tone:#fcd34d;--tone-bg:rgba(245,158,11,.14);--tone-line:rgba(245,158,11,.36)}
.adc2 .v1-tone-4{--tone:#93c5fd;--tone-bg:rgba(59,130,246,.15);--tone-line:rgba(59,130,246,.38)}
.adc2 .v1-tone-5{--tone:#5eead4;--tone-bg:rgba(20,184,166,.14);--tone-line:rgba(20,184,166,.36)}
.adc2 .v1-trust .v1-mark{background:rgba(196,181,253,.14);border:1px solid rgba(196,181,253,.35)}
.adc2 .v1-trust .v1-mark::before{content:"";width:13px;height:7px;border-left:2px solid #c4b5fd;border-bottom:2px solid #c4b5fd;transform:translateY(-2px) rotate(-45deg)}
.adc2 .v1-reviews .v1-mark::before{content:"“";font-size:30px;line-height:1;transform:translateY(6px)}
.adc2 .v1-who{font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#c4b5fd}
.adc2 .v1-badge{position:absolute;top:12px;right:12px;z-index:1;padding:3px 9px;border-radius:999px;background:rgba(13,13,16,.78);border:1px solid var(--line-2);color:var(--ink-2);font-size:11px;font-weight:600;letter-spacing:.03em}
.adc2 .v1-source{font-size:13px;color:var(--ink-3)}
.adc2 .v1-card-link{margin-top:auto;padding-top:6px;font-size:14px;font-weight:600;color:var(--ink);text-decoration:underline;text-underline-offset:3px}
.adc2 .v1-closing .wrap{max-width:780px;text-align:center}
.adc2 .v1-closing h2{margin:0 0 16px}
.adc2 .v1-closing p{margin:0 auto 12px;color:var(--ink-2);font-size:17px;line-height:1.7}
@media(max-width:900px){.adc2 .v1-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:600px){.adc2 .v1-cards{grid-template-columns:minmax(0,1fr)}}
`;

function CardBlockCss() {
  return <style dangerouslySetInnerHTML={{ __html: cardBlockCss }} />;
}

// Reason cards show a small icon tile like the competitor's; the icon name comes from the
// page content (reasons.items[].icon) and must be one of these.
const REASON_ICONS = { Coins, Captions, DollarSign, Gauge, Calendar, Camera, CircleCheck, Clapperboard, Clock, Copy, Crop, Droplet, Eye, FileText, Film, Gem, Hand, House, Image, Images, Languages, Laptop, Layers, LayoutGrid, Link, MessageCircle, Mic, Music, Package, Palette, PenLine, Play, Ratio, RefreshCw, Repeat, Rocket, Ruler, Scissors, Share2, ShieldCheck, Shirt, Smartphone, Sparkles, Star, Store, Sun, Tag, Target, Timer, Type, UserCheck, UserRound, Users, Utensils, WandSparkles, Zap } as const;

function ReasonIcon({ name, tone }: { name?: string; tone: number }) {
  const Icon = name ? REASON_ICONS[name as keyof typeof REASON_ICONS] : undefined;
  if (!Icon) return null;
  return <span aria-hidden="true" className={`v1-icon v1-tone-${tone % 6}`}><Icon fill="currentColor" fillOpacity={0.22} size={24} strokeWidth={2.3} /></span>;
}

function BlockCard({ item, r, children, before, mark }: { item: V2CardBlockItem; r: V2Resolvers; children?: ReactNode; before?: ReactNode; mark?: ReactNode }) {
  return (
    <article className="v1-card">
      {before}
      {item.img?.src ? <figure><Img image={item.img} r={r} /></figure> : null}
      <div className="v1-card-copy">
        {item.img?.src ? null : mark ?? <span aria-hidden="true" className="v1-mark" />}
        <h3>{item.t}<SoonLabel soon={item.soon} /></h3>
        <p><RichText r={r} text={item.d} /></p>
        {children}
      </div>
    </article>
  );
}

export function ReasonsSection({ block, r }: { block?: V2CardBlock; r: V2Resolvers }) {
  const items = block?.items ?? [];
  if (!block || !items.length) return null;
  return (
    <Section eyebrow="Why sellers use it" lead={block.lead} title={block.h2}>
      <CardBlockCss />
      <div className="v1-cards v1-reasons">{items.map((item, i) => <BlockCard item={item} key={item.t} mark={<ReasonIcon name={item.icon} tone={i} />} r={r} />)}</div>
    </Section>
  );
}

// The six homepage assurances retain their current relational copy and order.
const HOME_TRUST_ICONS = [UserCheck, Languages, MessageCircle, Ratio, Eye, Palette] as const;

function TrustTopicIcon({ item, index, isHomeSet }: { item: V2CardBlockItem; index: number; isHomeSet: boolean }) {
  const Icon = isHomeSet ? HOME_TRUST_ICONS[index] : REASON_ICONS[item.icon as keyof typeof REASON_ICONS] ?? ShieldCheck;
  return <span aria-hidden="true" className={`v1-icon v1-tone-${index % 6} v-trust-topic`}><Icon size={25} strokeWidth={1.8} /></span>;
}

/** Decorative icons follow route semantics; labels and destinations stay page-owned. */
function relatedTopicIcon(href: string) {
  if (/url-to|website-to/.test(href)) return Link;
  if (/actor|avatar|presenter/.test(href)) return UserRound;
  if (/voice|speech|audio|dubb|language/.test(href)) return Mic;
  if (/script|caption|subtitle|text-to/.test(href)) return FileText;
  if (/background|eraser|remove/.test(href)) return Scissors;
  if (/upscal|enhanc|restore/.test(href)) return WandSparkles;
  if (/product|ecommerce|shop|commerce/.test(href)) return Package;
  if (/brand/.test(href)) return Palette;
  if (/image|photo/.test(href)) return Image;
  if (/template/.test(href)) return LayoutGrid;
  if (/ugc|ad-generator|ads/.test(href)) return Megaphone;
  if (/video|clip|reel|motion/.test(href)) return Clapperboard;
  if (/guide|help|learn|blog/.test(href)) return FileText;
  return Sparkles;
}

export function ThematicLinkChips({ links, r }: { links: { label: string; href: string }[]; r: V2Resolvers }) {
  return <div className="adc-thematic-links">{links.map((link, index) => {
    const Icon = relatedTopicIcon(link.href);
    return <WorkspaceEntryLink className={`adc-thematic-link adc-topic-${index % 4}`} href={r.href(link.href)} key={link.href}>
      <span aria-hidden="true" className="adc-thematic-icon"><Icon size={21} strokeWidth={1.8} /></span>
      <span>{link.label}</span><span aria-hidden="true" className="adc-thematic-arrow">↗</span>
    </WorkspaceEntryLink>;
  })}</div>;
}

export function TrustCards({ block, r }: { block?: V2CardBlock; r: V2Resolvers }) {
  const items = block?.items ?? [];
  if (!block || !items.length) return null;
  return (
    <Section eyebrow={copyLabel(r, "What you can count on")} lead={block.lead} title={block.h2}>
      <CardBlockCss />
      <div className="v1-cards v1-trust">{items.map((item, index) => <BlockCard item={item} key={item.t} mark={<TrustTopicIcon item={item} index={index} isHomeSet={items.length === 6} />} r={r} />)}</div>
    </Section>
  );
}

// Example cards always carry an "Example" label. A card presented as a real review
// must name its source; without one it is left out.
export function ReviewWall({ block, r, id }: { block?: V2ReviewBlock; r: V2Resolvers; id?: string }) {
  const items = (block?.items ?? []).filter((item) => item.example || Boolean(item.source?.trim()));
  if (!block || !items.length) return null;
  if (items.every((item) => item.srcImg && item.img)) return <ShowcaseWall block={block} items={items} r={r} id={id} />;
  return (
    <Section id={id} eyebrow={items.every((item) => item.example) ? "Seller examples" : "Reviews"} lead={block.lead} title={block.h2}>
      <CardBlockCss />
      <div className="v1-cards v1-reviews">
        {items.map((item) => (
          <BlockCard before={item.example ? <span className="v1-badge">Example</span> : null} item={item} key={`${item.who}-${item.t}`} r={r}>
            <span className="v1-who">{item.who}</span>
            {item.example ? null : <span className="v1-source">{item.source}</span>}
          </BlockCard>
        ))}
      </div>
    </Section>
  );
}

export function ClosingStatement({ block, r }: { block?: V2ClosingBlock; r: V2Resolvers }) {
  const paras = block?.paras ?? [];
  if (!block?.h2 || !paras.length) return null;
  return (
    <section className="sec v1-closing">
      <div className="wrap">
        <CardBlockCss />
        <h2>{block.h2}</h2>
        {paras.map((para) => <p key={para}><RichText r={r} text={para} /></p>)}
      </div>
    </section>
  );
}

// Cards that each lead to another page, such as the channels a page's content runs on.
export function LinkCardsSection({ block, eyebrow, r }: { block?: V2LinkCardBlock; eyebrow: string; r: V2Resolvers }) {
  const items = block?.items ?? [];
  if (!block || !items.length) return null;
  return (
    <Section eyebrow={eyebrow} lead={block.lead} title={block.h2}>
      <CardBlockCss />
      <div className="v1-cards v1-links">
        {items.map((item) => (
          <BlockCard item={item} key={item.t} r={r}>
            {item.href ? <WorkspaceEntryLink className="v1-card-link" href={r.href(item.href)}>{item.label || item.t} →</WorkspaceEntryLink> : null}
          </BlockCard>
        ))}
      </div>
    </Section>
  );
}

// Team cards: a picture of what that team gets, then a colored icon, the team name and the line.
const TEAM_ICONS: Record<V2TeamIcon, { icon: ReactNode; color: string }> = {
  cart: { icon: <ShoppingCart size={20} />, color: "#a78bfa" },
  box: { icon: <Package size={20} />, color: "#4ade80" },
  store: { icon: <Store size={20} />, color: "#f472b6" },
  megaphone: { icon: <Megaphone size={20} />, color: "#facc15" },
  calendar: { icon: <Calendar size={20} />, color: "#fb923c" },
  apps: { icon: <LayoutGrid size={20} />, color: "#22d3ee" }
};

export function TeamCards({ items, r }: { items: V2Item[]; r: V2Resolvers }) {
  return <>
    <style dangerouslySetInnerHTML={{ __html: `
      .adc2 .v-teams{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}
      .adc2 .v-team{display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--line-2);border-radius:18px;background:#0d0d10}
      .adc2 .v-team figure{margin:0;aspect-ratio:3/2;overflow:hidden;background:#0b0b0d}
      .adc2 .v-team figure img{display:block;width:100%;height:100%;object-fit:cover}
      .adc2 .v-team-body{padding:20px 22px 24px}
      .adc2 .v-team-head{display:flex;align-items:center;gap:12px;margin-bottom:10px}
      .adc2 .v-team-icon{display:grid;place-items:center;flex:none;width:40px;height:40px;border-radius:12px;border:1px solid color-mix(in srgb,var(--c) 55%,transparent);background:color-mix(in srgb,var(--c) 16%,transparent);color:var(--c)}
      .adc2 .v-team h3{font-size:19px;line-height:1.25;margin:0}
      .adc2 .v-team p{color:var(--ink-2);font-size:15px;line-height:1.6;margin:0}
      @media(max-width:980px){.adc2 .v-teams{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:640px){.adc2 .v-teams{grid-template-columns:minmax(0,1fr)}}
    ` }} />
    <div className="v-teams">
      {items.map((item) => {
        const icon = item.teamIcon ? TEAM_ICONS[item.teamIcon] : undefined;
        const image = item.img ? (item.alt ? { ...item.img, alt: item.alt } : item.img) : undefined;
        return <article className="v-team" key={item.t}>
          {image ? <figure><Img image={image} r={r} /></figure> : null}
          <div className="v-team-body">
            <div className="v-team-head">{icon ? <span aria-hidden="true" className="v-team-icon" style={{ "--c": icon.color } as CSSProperties}>{icon.icon}</span> : null}<h3>{item.t}</h3></div>
            <p><RichText r={r} text={item.d} /></p>
          </div>
        </article>;
      })}
    </div>
  </>;
}

// Seller showcase: the plain photo a seller uploads, an arrow, and the vertical ad made from it.
function ShowcaseWall({ block, items, r, id }: { block: V2ReviewBlock; items: V2ReviewItem[]; r: V2Resolvers; id?: string }) {
  return (
    <Section id={id} eyebrow={copyLabel(r, "Seller examples")} lead={block.lead} title={block.h2}>
      <style dangerouslySetInnerHTML={{ __html: `
        .adc2 .v-shows{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px}
        .adc2 .v-show{border:1px solid var(--line-2);border-radius:20px;background:#0d0d10;overflow:hidden}
        .adc2 .v-show-stage{display:grid;grid-template-columns:minmax(0,.8fr) auto minmax(0,1fr);align-items:center;gap:14px;padding:22px 22px 8px;background:radial-gradient(ellipse at 70% 40%,rgba(139,92,246,.16),transparent 65%)}
        .adc2 .v-show-src{position:relative;margin:0;border-radius:14px;overflow:hidden;border:1px solid var(--line-2)}
        .adc2 .v-show-src img{display:block;width:100%;aspect-ratio:1;object-fit:cover;filter:saturate(.85)}
        .adc2 .v-show-src figcaption,.adc2 .v-show-ad .v-show-tag{position:absolute;left:8px;top:8px;padding:3px 8px;border-radius:999px;background:rgba(0,0,0,.62);color:#e5e7eb;font-size:11px;font-weight:600;letter-spacing:.02em}
        .adc2 .v-show-arrow{color:#a78bfa;font-size:26px;font-weight:700}
        .adc2 .v-show-ad{position:relative;margin:0 auto;width:min(100%,220px);padding:7px;border-radius:24px;background:#050506;box-shadow:0 16px 40px rgba(0,0,0,.45)}
        .adc2 .v-show-ad img{display:block;width:100%;aspect-ratio:9/16;object-fit:cover;border-radius:17px}
        .adc2 .v-show-ad .v-show-tag{left:15px;top:15px;background:linear-gradient(90deg,#8b5cf6,#ec4899);color:#fff}
        .adc2 .v-show-time{position:absolute;right:15px;top:15px;padding:2px 7px;border-radius:6px;background:rgba(0,0,0,.6);color:#fff;font-size:11px;font-weight:700}
        .adc2 .v-show-cap{position:absolute;left:16px;right:16px;bottom:22px;padding:6px 9px;border-radius:8px;background:rgba(0,0,0,.55);color:#fff;font-size:12px;font-weight:700;line-height:1.3;text-align:center}
        .adc2 .v-show-body{padding:16px 24px 24px}
        .adc2 .v-show-body h3{font-size:20px;margin:6px 0 8px}
        .adc2 .v-show-body p{color:var(--ink-2);font-size:15px;line-height:1.6;margin:0}
        .adc2 .v-show-who{color:#c4b5fd;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
        .adc2 .v-show-actions{display:flex;justify-content:center;margin-top:28px}
        .adc2 .v-show-actions a{text-decoration:none}
        @media(max-width:860px){.adc2 .v-shows{grid-template-columns:minmax(0,1fr)}}
      ` }} />
      <div className="v-shows">
        {items.map((item) => {
          const ad = item.alt && item.img ? { ...item.img, alt: item.alt } : item.img;
          const seconds = item.length ?? 15;
          return <article className="v-show" key={`${item.who}-${item.t}`}>
            <div className="v-show-stage">
              {item.srcImg ? <figure className="v-show-src"><Img image={item.srcImg} r={r} /><figcaption>{copyLabel(r, "Their photo")}</figcaption></figure> : null}
              <span aria-hidden="true" className="v-show-arrow">→</span>
              {ad ? <figure className="v-show-ad"><Img image={ad} r={r} /><span className="v-show-tag">{copyLabel(r, "Ready-to-run ad")}</span><span className="v-show-time">00:{String(seconds).padStart(2, "0")}</span>{item.caption ? <span className="v-show-cap">{item.caption}</span> : null}</figure> : null}
            </div>
            <div className="v-show-body"><span className="v-show-who">{item.who}</span><h3>{item.t}</h3><p><RichText r={r} text={item.d} /></p></div>
          </article>;
        })}
      </div>
      {block.cta?.label && block.cta.href ? <div className="v-show-actions"><WorkspaceEntryLink className="btn btn-grad" href={r.href(block.cta.href)}>{block.cta.label} →</WorkspaceEntryLink></div> : null}
    </Section>
  );
}
