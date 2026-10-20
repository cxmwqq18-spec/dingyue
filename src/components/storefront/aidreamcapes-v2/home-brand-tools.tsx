import { WorkspaceEntryLink } from "@/components/aidreamcapes-workspace/entry-link";
import type { CSSProperties, ReactNode } from "react";
import { Img, SecHead } from "./parts";
import type { V2Image, V2Resolvers } from "./types";
import type { HomeBrandTool, HomeBrandToolsDemo } from "./home-brand-tools-types";
import { HomeBrandToolsBehavior } from "./home-brand-tools-behavior";
import { staticDemoForHref } from "@/lib/aidreamcapes-workspace/static-routes";
import "./home-brand-tools.css";

function Icon({ kind }: { kind: "arrow" | "play" | "link" | "spark" | "image" | "person" | "close" }) {
  const paths = { arrow: "M4 12h15m-6-6 6 6-6 6", play: "m9 5 11 7-11 7Z", link: "m10 13 4-4m-6 7-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 1 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0", spark: "m4 20 12-12 4 4L8 24M15 3v4m-2-2h4M5 5v4M3 7h4", image: "M3 3h18v18H3zM3 17l6-6 4 4 3-3 5 5", person: "M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 22v-3a8 8 0 0 1 16 0v3", close: "m6 6 12 12M6 18 18 6" };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]} /></svg>;
}

/** All copy and media come from the homepage LivePage. JS only operates this SSR DOM. */
export function HomeBrandTools({ items, demo, header, r }: { items: HomeBrandTool[]; demo: HomeBrandToolsDemo; header: { eyebrow: string; title: string; lead: string }; r: V2Resolvers }) {
  const c = demo.labels;
  const media = [
    { id: "product", image: demo.product }, { id: "presenter", image: demo.presenter }, { id: "twin", image: demo.twin },
    ...demo.shots.map(shot => ({ id: `shot-${shot.id}`, image: shot.image })),
    ...demo.actors.map(actor => ({ id: `actor-${actor.id}`, image: actor.image }))
  ];
  const openImage = (id: string, image: V2Image, className = "", children?: ReactNode) => <button type="button" className={`adc-tools-photo ${className}`} data-tools-open={id} aria-label={`${c.enlarge}: ${image.alt}`}><Img image={image} r={r} />{children}<span className="adc-tools-enlarge" aria-hidden="true">↗</span></button>;
  const promptQueryHref = `${r.href("/app/create")}?${new URLSearchParams({ view: demo.tabs[0].value, prompt: c.promptValue, aspect: "9:16", duration: "15" }).toString()}`;
  const promptDemo = staticDemoForHref(promptQueryHref);
  const promptHref = promptDemo ? r.href(`/app/create/demo/${promptDemo.slug}`) : promptQueryHref;
  const visual = (item: HomeBrandTool) => {
    switch (item.id) {
      case "url": return <div className="adc-tools-import" data-imported="false">
        <div className="adc-tools-url-field"><Icon kind="link" /><span>{c.urlExample}</span><button type="button" data-tools-import aria-label={c.previewImport} aria-pressed="false" aria-controls="adc-tools-import-result"><Icon kind="arrow" /></button></div>
        <div className="adc-tools-import-result" id="adc-tools-import-result">
          <div className="adc-tools-import-status" role="status"><span aria-hidden="true">✓</span><span data-tools-import-before>{c.importExample}</span><span data-tools-import-after hidden>{c.reviewProduct}</span></div>
          <div className="adc-tools-import-images">{openImage("product", demo.product)}<div>{openImage("product", demo.product, "adc-tools-crop")}{openImage("presenter", demo.presenter)}</div></div>
          <p className="adc-tools-micro" data-tools-import-note>{c.importNote}</p>
        </div>
      </div>;
      case "text": return <div className="adc-tools-text-preview">
        <form className="adc-tools-composer" action={r.href("/app/create")} method="get" data-tools-form aria-label={c.promptLabel}>
          <input type="hidden" name="view" defaultValue={demo.tabs[0].value} data-tools-view />
          <input type="hidden" name="tool" defaultValue="video-ads" data-tools-tool />
          <input type="hidden" name="tool_id" defaultValue="image_generator" disabled data-tools-image-tool />
          <div className="adc-tools-tabs" role="group" aria-label={c.modeLabel}>{demo.tabs.map((tab, index) => <button type="button" data-tools-mode={tab.value} aria-pressed={index === 0} key={tab.value}><Icon kind={index === 0 ? "spark" : "image"} />{tab.label}</button>)}</div>
          <label className="sr-only" htmlFor="adc-tools-prompt">{c.promptLabel}</label><textarea id="adc-tools-prompt" name="prompt" maxLength={2000} rows={4} defaultValue={c.promptValue} placeholder={c.promptPlaceholder} required />
          <output className="adc-tools-count" htmlFor="adc-tools-prompt"><span data-tools-count>{c.promptValue.length}</span> / 2000</output>
          <div className="adc-tools-compose-controls"><details><summary><Icon kind="image" />{c.productLabel}</summary><div className="adc-tools-popover"><Img image={demo.product} r={r} /><p>{c.sampleProduct}</p></div></details><details><summary><Icon kind="person" />{c.avatarLabel}</summary><div className="adc-tools-popover"><Img image={demo.presenter} r={r} /><p>{c.samplePresenter}</p></div></details>
            <label><span className="sr-only">{c.formatLabel}</span><select name="aspect" defaultValue="9:16">{demo.aspects.map(o => <option value={o.value} key={o.value}>{o.label}</option>)}</select></label>
            <label data-tools-duration><span className="sr-only">{c.durationLabel}</span><select name="duration" defaultValue="15">{demo.durations.map(o => <option value={o.value} key={o.value}>{o.label}</option>)}</select></label>
            <button className="adc-tools-purple" type="button" data-tools-brief aria-label={c.previewBrief}><Icon kind="arrow" /></button>
          </div>
        </form>
        <div className="adc-tools-phone">{openImage("presenter", demo.presenter)}<button className="adc-tools-play" data-tools-motion type="button" aria-label={c.playMotion} aria-pressed="false" data-play-label={c.playMotion} data-pause-label={c.pauseMotion}><Icon kind="play" /><span className="adc-tools-pause" aria-hidden="true">Ⅱ</span></button><span className="adc-tools-phone-label">{c.exampleLabel}</span></div>
      </div>;
      case "video": return <div className="adc-tools-editor" data-tools-storyboard>
        <div className="adc-tools-editor-top"><span>{c.storyboardLabel}</span><span className="adc-tools-current-shot" data-tools-shot-label>{demo.shots[0].label}</span><button type="button" data-tools-open={`shot-${demo.shots[0].id}`} data-tools-active-shot aria-label={c.enlarge}>↗</button></div>
        <div className="adc-tools-shots">{demo.shots.map((shot, index) => <button type="button" key={shot.id} data-tools-shot={shot.id} data-tools-shot-name={shot.label} aria-pressed={index === 0}><Img image={shot.image} r={r} /><span>{shot.label}</span><i aria-hidden="true">✓</i></button>)}</div>
        <div className="adc-tools-timeline"><button type="button" data-tools-play-story aria-label={c.playStoryboard} aria-pressed="false" data-play-label={c.playStoryboard} data-pause-label={c.pauseStoryboard}><Icon kind="play" /><span className="adc-tools-pause" aria-hidden="true">Ⅱ</span></button><div className="adc-tools-tracks">{demo.shots.map(shot => <button type="button" data-tools-shot={shot.id} data-tools-shot-name={shot.label} key={shot.id} aria-label={shot.label}><Img image={shot.image} r={r} /><span aria-hidden="true" /></button>)}<i className="adc-tools-playhead" aria-hidden="true" /></div><span>{c.storyDuration}</span></div>
        <div className="adc-tools-wave" aria-hidden="true">{Array.from({ length: 48 }, (_, i) => <i style={{ "--bar": `${20 + ((i * 17) % 80)}%` } as CSSProperties} key={i} />)}</div>
      </div>;
      case "image": return <div className="adc-tools-image-demo">
        <div>{openImage("product", demo.product)}<span>{c.photoLabel}</span></div><span className="adc-tools-transform" aria-hidden="true"><Icon kind="arrow" /></span>
        <div className="adc-tools-result-frame">{openImage("presenter", demo.presenter)}<button className="adc-tools-play" type="button" data-tools-motion aria-label={c.playMotion} aria-pressed="false" data-play-label={c.playMotion} data-pause-label={c.pauseMotion}><Icon kind="play" /><span className="adc-tools-pause" aria-hidden="true">Ⅱ</span></button><span>{c.motionLabel}</span></div>
      </div>;
      case "avatar": return <div className="adc-tools-avatar-demo">
        <div className="adc-tools-actors" role="group" aria-label={c.choosePresenter}>{demo.actors.map((actor, index) => <button type="button" key={actor.id} data-tools-actor={actor.id} data-tools-actor-label={actor.label} aria-label={`${c.choosePresenter}: ${actor.label}`} aria-pressed={index === 0}><Img image={actor.image} r={r} /><span>{actor.label}</span><i aria-hidden="true">✓</i></button>)}</div>
        <div className="adc-tools-script"><label htmlFor="adc-tools-script">{c.scriptLabel}<span data-tools-actor-label>{demo.actors[0].label}</span></label><textarea id="adc-tools-script" maxLength={600} rows={2} defaultValue={c.scriptValue} /><button className="adc-tools-purple" type="button" data-tools-presenter-preview data-tools-selected-actor={demo.actors[0].id} aria-label={c.previewPresenter}><Icon kind="play" /></button></div>
      </div>;
      case "twin": return <div className="adc-tools-twin-demo">
        <div className="adc-tools-compare" style={{ "--compare": "50%" } as CSSProperties}><div className="adc-tools-twin-result"><Img image={demo.twin} r={r} /></div><div className="adc-tools-twin-source"><Img image={demo.twin} r={r} /></div><span className="adc-tools-compare-line" aria-hidden="true">↔</span><span className="adc-tools-compare-left">{c.twinSource}</span><span className="adc-tools-compare-right">{c.twinResult}</span></div>
        <label className="adc-tools-compare-control"><span>{c.compareLabel}</span><input type="range" min="0" max="100" defaultValue="50" data-tools-compare aria-label={c.compareLabel} /></label><WorkspaceEntryLink className="adc-tools-twin-enlarge" href={r.href(item.href)}>{c.previewConcept}<span aria-hidden="true">↗</span></WorkspaceEntryLink>
      </div>;
    }
  };
  return <section className="sec adc-brand-tools" id="home-ai-tools" aria-labelledby="adc-brand-tools-title" data-home-brand-tools>
    <div className="wrap"><SecHead eyebrow={header.eyebrow} lead={header.lead} title={header.title} titleId="adc-brand-tools-title" />
      <div className="adc-brand-tools__grid">{items.map(item => <article className={`adc-brand-tools__card adc-tools-card-${item.id}`} data-tool-kind={item.id} key={item.id}>
        <div className="adc-brand-tools__copy"><h3><WorkspaceEntryLink href={r.href(item.href)} aria-label={item.cta}>{item.t}<span aria-hidden="true">→</span></WorkspaceEntryLink>{item.id === "twin" ? <small><WorkspaceEntryLink href={r.href(item.href)}>{c.conceptBadge}</WorkspaceEntryLink></small> : null}</h3><p>{item.d}</p></div>
        <div className="adc-brand-tools__visual">{visual(item)}</div>
      </article>)}</div><p className="adc-tools-notice">{c.previewNotice}</p>
    </div>
    <dialog className="adc-tools-dialog" id="adc-tools-media-dialog" aria-labelledby="adc-tools-media-title"><div className="adc-tools-dialog-head"><h3 id="adc-tools-media-title">{c.previewTitle}</h3><form method="dialog"><button type="submit" aria-label={c.close}><Icon kind="close" /></button></form></div>{media.map((entry, index) => <figure key={entry.id} data-tools-media={entry.id} hidden={index !== 0}><Img image={entry.image} r={r} /><figcaption>{entry.image.alt}</figcaption></figure>)}<p className="adc-tools-dialog-script" data-tools-script-output hidden /><p>{c.previewNotice}</p></dialog>
    <dialog className="adc-tools-dialog adc-tools-brief-dialog" id="adc-tools-brief-dialog" aria-labelledby="adc-tools-brief-title"><div className="adc-tools-dialog-head"><h3 id="adc-tools-brief-title">{c.briefTitle}</h3><form method="dialog"><button type="submit" aria-label={c.close}><Icon kind="close" /></button></form></div><blockquote data-tools-brief-output>{c.promptValue}</blockquote><p>{c.briefNote}</p><WorkspaceEntryLink className="btn btn-grad" href={promptHref} data-tools-continue>{c.continueLabel}<Icon kind="arrow" /></WorkspaceEntryLink></dialog>
    <HomeBrandToolsBehavior />
  </section>;
}
