import type { V2Resolvers } from "./types";
import "./home-composer.css";

type Choice = { value: string; label: string };
export type HomeComposerData = {
  label: string;
  tabs: { label: string; view: "home" | "video" | "images" }[];
  promptLabel: string;
  placeholder: string;
  productLabel: string;
  productHint: string;
  productPlaceholder: string;
  sceneLabel: string;
  scenes: Choice[];
  modelLabel: string;
  modelHint: string;
  aspectLabel: string;
  aspects: Choice[];
  durationLabel: string;
  durations: Choice[];
  submitLabel: string;
  note: string;
};

/** The entire public form is page-owned SSR content. Only submit leaves this page. */
export function HomeComposer({ data: c, r }: { data?: HomeComposerData; r: V2Resolvers }) {
  if (!c) return null;
  return <form action={r.href("/app/create")} method="get" className="adc-home-composer" data-home-composer aria-label={c.label}>
    <input name="view" type="hidden" defaultValue="home" data-demo-view />
    <input name="tool" type="hidden" defaultValue="video-ads" data-demo-tool />
    <input name="tool_id" type="hidden" defaultValue="image_generator" disabled data-demo-image-tool />
    <div className="adc-demo-tabs" role="group" aria-label={c.label}>
      {c.tabs.map((tab, index) => <button type="button" aria-pressed={index === 0} data-demo-tab={tab.view} key={tab.view}>
        <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7"><path d={index === 0 ? "m4 20 12-12 4 4L8 24M15 3v4m-2-2h4M5 5v4M3 7h4" : index === 1 ? "M3 6h12v12H3zM15 10l6-4v12l-6-4" : "M3 3h18v18H3zM3 17l6-6 4 4 3-3 5 5"} /></svg>
        <span>{tab.label}</span>
      </button>)}
    </div>
    <div className="adc-demo-body">
      <label className="sr-only" htmlFor="adc-home-prompt">{c.promptLabel}</label>
      <textarea id="adc-home-prompt" name="prompt" placeholder={c.placeholder} maxLength={2000} required rows={6} />
      <div className="adc-demo-count"><output htmlFor="adc-home-prompt" data-demo-count>0</output><span> / 2000</span></div>
    </div>
    <div className="adc-demo-toolbar">
      <details className="adc-demo-product">
        <summary><span aria-hidden="true">＋</span> {c.productLabel}<span aria-hidden="true">⌄</span></summary>
        <div className="adc-demo-popover"><label htmlFor="adc-demo-product">{c.productHint}</label><input id="adc-demo-product" data-demo-product placeholder={c.productPlaceholder} maxLength={240} /></div>
      </details>
      <label className="adc-demo-select"><span>{c.sceneLabel}</span><select name="scene" defaultValue={c.scenes[0]?.value}>{c.scenes.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
      <details className="adc-demo-model"><summary>{c.modelLabel}<span className="adc-demo-dot" aria-hidden="true" /><span aria-hidden="true">⌄</span></summary><div className="adc-demo-popover"><p>{c.modelHint}</p></div></details>
      <label className="adc-demo-select"><span>{c.aspectLabel}</span><select name="aspect" defaultValue="9:16">{c.aspects.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
      <label className="adc-demo-select" data-demo-duration><span>{c.durationLabel}</span><select name="duration" defaultValue="15">{c.durations.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
      <button className="adc-demo-submit" type="submit"><span>{c.submitLabel}</span><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 12h15m-6-6 6 6-6 6" /></svg></button>
    </div>
    <p className="adc-demo-note">{c.note}</p>
  </form>;
}
