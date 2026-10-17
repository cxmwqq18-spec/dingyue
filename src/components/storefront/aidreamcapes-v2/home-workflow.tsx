import { Img, RichText } from "./parts";
import type { HomeWorkflowDemo } from "./home-experience-types";
import type { V2Image, V2MoreSection, V2Resolvers } from "./types";
import { HomeWorkflowBehavior } from "./home-workflow-behavior";
import "./home-workflow.css";

function Icon({ kind }: { kind: "upload" | "link" | "play" | "arrow" | "edit" | "file" }) {
  const paths = { upload: "M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5", link: "m10 14 4-4m-6 6-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 1 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0", play: "m8 5 11 7-11 7Z", arrow: "M4 12h16m-6-6 6 6-6 6", edit: "m4 16 12-12 4 4L8 20H4zm10-10 4 4", file: "M6 2h8l5 5v15H6zm8 0v6h5M9 13h7m-7 4h7" };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]} /></svg>;
}

/** Six complete, page-owned SSR cards. The examples operate only on this rendered DOM. */
export function HomeWorkflow({ workflow, demo, media, r }: { workflow: V2MoreSection; demo?: HomeWorkflowDemo; media: Record<string, V2Image>; r: V2Resolvers }) {
  if (!demo || demo.version !== 1 || workflow.items.length !== 6 || demo.shots.length !== 3 || demo.scenes.length !== 3) throw new Error("Six-step workflow requires current LivePage demo content");
  const c = demo.labels;
  for (const key of [...demo.shots, ...demo.scenes].map(item => item.media)) if (!media[key]) throw new Error(`Missing workflow media: ${key}`);
  const photo = (key: string, className?: string) => <Img image={media[key]} r={r} className={className} />;
  const open = (index: number, className?: string) => <button className={className} type="button" data-hx-dialog={`adc-workflow-shot-${index}`} aria-label={`${c.enlarge}: ${demo.shots[index].label}`}>{photo(demo.shots[index].media)}<span>{demo.shots[index].label}<Icon kind="edit" /></span></button>;
  const visual = (index: number) => {
    switch (index) {
      case 0: return <div className="adc-workflow-product">
        <button className="adc-workflow-product-photo" type="button" data-hx-dialog="adc-workflow-shot-0" aria-label={c.enlarge}>{photo(demo.shots[0].media)}<span aria-hidden="true">↗</span></button>
        <div className="adc-workflow-product-actions"><a className="adc-workflow-primary" href={r.href(c.uploadHref)}><Icon kind="upload" />{c.upload}</a><a href={r.href(c.importHref)}><Icon kind="link" />{c.import}</a><div className="adc-workflow-product-note">{photo(demo.shots[0].media)}<span><b>{c.product}</b><small>{c.details}</small><i /><i /></span></div></div>
      </div>;
      case 1: return <div className="adc-workflow-casting">
        <div className="adc-workflow-scene">{photo(demo.shots[0].media)}<span>{c.scene}</span></div>
        <div className="adc-workflow-people" role="group" aria-label={c.choosePresenter}>{demo.scenes.map((scene, i) => <button key={scene.id} type="button" data-hx-select-group="workflow-presenter" data-hx-select-value={scene.id} aria-pressed={i === 0} className={i === 0 ? "is-selected" : undefined}>{photo(scene.media)}<i aria-hidden="true">✓</i><span>{scene.label}</span></button>)}</div>
      </div>;
      case 2: return <form className="adc-workflow-brief" action={r.href("/app/create")} method="get">
        <input type="hidden" name="view" value="home" /><div className="adc-workflow-brief-head"><span aria-hidden="true">✦</span>{c.agent}<small>{c.briefLabel}</small></div>
        <label className="sr-only" htmlFor="workflow-prompt">{c.briefLabel}</label><textarea id="workflow-prompt" name="prompt" defaultValue={c.prompt} maxLength={2000} required rows={3} />
        <div className="adc-workflow-brief-controls"><label><span className="sr-only">{c.format}</span><select name="aspect" defaultValue={demo.aspects[0]}>{demo.aspects.map(value => <option key={value}>{value}</option>)}</select></label><label><span className="sr-only">{c.length}</span><select name="duration" defaultValue={demo.durations[0].value}>{demo.durations.map(value => <option value={value.value} key={value.value}>{value.label}</option>)}</select></label><button className="adc-workflow-primary" type="submit" aria-label={c.continue}><Icon kind="arrow" /></button></div>
      </form>;
      case 3: return <div className="adc-workflow-board"><div className="adc-workflow-shots">{demo.shots.map((shot, i) => <div key={shot.label}>{open(i)}</div>)}</div><div className="adc-workflow-saved"><span aria-hidden="true">✓</span>{c.draftPreview}<a href={r.href(c.libraryHref)} aria-label={c.openLibrary}>↗</a></div></div>;
      case 4: return <div className="adc-workflow-assembly">
        <div className="adc-workflow-clips">{demo.shots.map((shot, i) => <div key={shot.label}>{open(i)}</div>)}</div>
        <div className="adc-workflow-versions"><span>{c.compare}</span>{[0, 1].map(i => <button type="button" key={i} data-hx-select-group="workflow-version" data-hx-select-value={String(i)} aria-pressed={i === 0} className={i === 0 ? "is-selected" : undefined}>{photo(demo.scenes[i].media)}<span>{i === 0 ? c.versionOne : c.versionTwo}</span></button>)}</div>
        <div className="adc-workflow-timeline"><button type="button" data-hx-dialog="adc-workflow-sequence" aria-label={c.previewSequence}><Icon kind="play" /></button><div>{demo.shots.map(shot => <span key={shot.label}>{photo(shot.media)}</span>)}<i /></div></div>
      </div>;
      case 5: return <div className="adc-workflow-review"><button type="button" className="adc-workflow-phone" data-hx-dialog="adc-workflow-sequence" aria-label={c.previewSequence}>{photo(demo.shots[1].media)}<span><Icon kind="play" /></span><small>{c.sequenceLabel}</small></button><div className="adc-workflow-delivery"><Icon kind="file" /><b>{c.finalPreview}</b><small>{c.reviewNote}</small><a className="adc-workflow-primary" href={r.href(c.reviewHref)}>{c.reviewInWorkspace}<Icon kind="arrow" /></a></div></div>;
    }
  };
  return <section className="hx-feature hx-light adc-workflow" id="home-campaign-workflow" data-hx-root data-home-experience="workflow" aria-labelledby="home-campaign-workflow-title">
    <div className="adc-workflow-wrap"><header className="adc-workflow-heading"><div className="hx-tag">{workflow.eyebrow}</div><h2 id="home-campaign-workflow-title">{workflow.h2}</h2><p>{workflow.lead}</p></header>
      <ol className="adc-workflow-grid">{workflow.items.map((item, index) => <li className="adc-workflow-card" key={item.t}><h3><span>{String(index + 1).padStart(2, "0")}</span>{item.t}</h3><div className={`adc-workflow-visual adc-workflow-stage-${index + 1}`}>{visual(index)}</div><p><RichText text={item.d} r={r} /></p></li>)}</ol>
      <footer className="adc-workflow-footer"><p>{c.notice}</p><a className="adc-workflow-primary" href={r.href(c.startHref)}>{c.start}<Icon kind="arrow" /></a></footer>
    </div>
    {demo.shots.map((shot, index) => <dialog className="hx-dialog adc-workflow-dialog" id={`adc-workflow-shot-${index}`} aria-labelledby={`adc-workflow-shot-title-${index}`} key={shot.label}><div className="hx-dialog-head"><h3 id={`adc-workflow-shot-title-${index}`}>{shot.label}</h3><form method="dialog"><button type="submit" data-hx-close>{c.close}<span aria-hidden="true">×</span></button></form></div><figure>{photo(shot.media)}<figcaption>{shot.description}</figcaption></figure><a className="adc-workflow-primary" href={r.href(c.startHref)}>{c.start}<Icon kind="arrow" /></a></dialog>)}
    <dialog className="hx-dialog adc-workflow-dialog" id="adc-workflow-sequence" aria-labelledby="adc-workflow-sequence-title"><div className="hx-dialog-head"><h3 id="adc-workflow-sequence-title">{c.sequenceLabel}</h3><form method="dialog"><button type="submit" data-hx-close>{c.close}<span aria-hidden="true">×</span></button></form></div>
      <div className="adc-workflow-sequence" data-workflow-sequence>{demo.shots.map((shot, i) => <figure data-workflow-frame hidden={i !== 0} key={shot.label}>{photo(shot.media)}<figcaption><b>{shot.label}</b>{shot.description}</figcaption></figure>)}<button type="button" data-workflow-play aria-pressed="false" data-play-label={c.play} data-pause-label={c.pause}><Icon kind="play" /><span>{c.play}</span></button></div><p>{c.sequenceNotice}</p><a className="adc-workflow-primary" href={r.href(c.reviewHref)}>{c.reviewInWorkspace}<Icon kind="arrow" /></a>
    </dialog><HomeWorkflowBehavior />
  </section>;
}
