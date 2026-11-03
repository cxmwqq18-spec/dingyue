import { WorkspaceEntryLink } from "@/components/aidreamcapes-workspace/entry-link";
import { aidreamcapesV2ResponsivePosterSrc } from "@/lib/aidreamcapes-v2-responsive-images";
import { Adc2VideoPreview } from "./video-preview-card";
import { Img } from "./parts";
import type { CSSProperties } from "react";
import type { HomeWorkspaceFlowDemo } from "./home-experience-types";
import type { V2Image, V2Resolvers, V2Video } from "./types";
import "./home-workspace-flow.css";

/**
 * "One platform, infinite possibilities" — workspace capability rows rendered
 * as one complete static page section. Every demo below ships its finished
 * state in plain HTML: the conversation, the optimized prompt, the template
 * wall and the caption panel are all readable without JavaScript. The client
 * behavior component only replays them as loops; it never requests content.
 */
export function HomeWorkspaceFlow({ demo, copy, media, videos, r, actions }: {
  demo: HomeWorkspaceFlowDemo;
  copy: Record<string, string>;
  media: Record<string, V2Image>;
  videos: Record<string, V2Video>;
  r: V2Resolvers;
  actions?: Record<string, string>;
}) {
  if (demo.version !== 1) throw new Error("Workspace flow requires demo content v1");
  const c = copy;
  const clip = (key: string) => {
    const video = videos[key];
    if (!video) throw new Error(`Missing workspace flow video: ${key}`);
    return {
      src: r.asset(video.src),
      previewSrc: video.previewSrc ? r.asset(video.previewSrc) : undefined,
      poster: r.asset(aidreamcapesV2ResponsivePosterSrc(video.poster.src)),
      width: video.width,
      height: video.height,
      duration: video.duration,
    };
  };
  const entry = (key: string) => r.href(actions?.[key] ?? "/app/create");
  for (const template of demo.templates) if (!template.video && !media[template.media ?? ""]) throw new Error(`Missing workspace flow media: ${template.media}`);
  const handout = videos[demo.templates.find((t) => t.video)?.video ?? ""];

  const chips = [c.wf029, c.wf030, c.wf031, c.wf032].filter(Boolean);
  const optimizerLines: [string, string][] = [[c.wf038, c.wf039], [c.wf040, c.wf041], [c.wf042, c.wf043], [c.wf044, c.wf045], [c.wf046, c.wf047], [c.wf048, c.wf049]];

  return (
    <section className="hx-feature wf-flow" data-home-experience="features" id="home-experience-features" aria-labelledby="home-experience-features-title">
      <div className="hx-wrap">
        <div className="wf-head">
          <div className="hx-tag">{c.wf001}</div>
          <h2 id="home-experience-features-title">{c.wf002}</h2>
          <p>{c.wf003}</p>
        </div>
        <div className="wf-rail">
          <span><b>01</b> {c.wf004}</span>
          <span><b>02</b> {c.wf005}</span>
          <span><b>03</b> {c.wf006}</span>
          <span><b>04</b> {c.wf007}</span>
          <span><b>+</b> {c.wf008}</span>
        </div>

        {/* 01 · AI assistant */}
        <div className="wf-row">
          <div className="wf-demo">
            <div className="wf-chat" data-wf-chat>
              <div className="wf-panel-head"><i className="wf-dot" aria-hidden="true" /><b>{c.wf012}</b><span>{c.wf013}</span></div>
              <div className="wf-msg wf-user" data-wf-u1><span className="wf-tx">{c.wf014}</span><i className="wf-caret" aria-hidden="true" /></div>
              <div className="wf-typing" aria-hidden="true"><i /><i /><i /></div>
              <div className="wf-msg wf-bot" data-wf-b1>{c.wf015}<ul><li>{c.wf016}</li><li>{c.wf017}</li><li>{c.wf018}</li><li>{c.wf019}</li></ul></div>
              <div className="wf-msg wf-user" data-wf-u2><span className="wf-tx">{c.wf020}</span><i className="wf-caret" aria-hidden="true" /></div>
              <div className="wf-sugg"><span>{c.wf021}</span><span>{c.wf022}</span></div>
              <div className="wf-chat-in"><span className="wf-ph">{c.wf023}</span><span className="wf-send">{c.wf024}</span></div>
            </div>
          </div>
          <div className="wf-copy">
            <div className="wf-tag">{c.wf009}</div>
            <h3>{c.wf010}</h3>
            <p className="wf-lead">{c.wf011}</p>
            <WorkspaceEntryLink className="wf-cta" data-action-block="features" data-home-cta="flow-assistant" href={entry("flowAssistant")}>{c.wf025}</WorkspaceEntryLink>
          </div>
        </div>

        {/* 02 · Prompt optimizer */}
        <div className="wf-row wf-flip">
          <div className="wf-demo">
            <div className="wf-opt" data-wf-opt>
              <div className="wf-chips">{chips.map((chip) => <span key={chip}>{chip}</span>)}</div>
              <div className="wf-idea">
                <span className="wf-idea-copy"><span className="wf-idea-ph">{c.wf033}</span><span className="wf-idea-tx">{c.wf034}</span><i className="wf-caret2" aria-hidden="true" /></span>
                <span className="wf-optbtn"><span className="wf-spark" aria-hidden="true">✦</span><span className="wf-optlbl">{c.wf035}</span><span className="wf-optlblb">{c.wf036}</span></span>
              </div>
              <div className="wf-structured">
                <div className="wf-cap">{c.wf037}</div>
                <div className="wf-skel" aria-hidden="true"><i /><i /><i /></div>
                {optimizerLines.map(([k, v], index) => <div className="wf-optline" style={{ "--wf-i": index } as CSSProperties} key={k}><span className="wf-k">{k}</span><span className="wf-v">{v}</span></div>)}
              </div>
              <div className="wf-quote"><span>{c.wf050}</span><b>{c.wf051}</b></div>
            </div>
          </div>
          <div className="wf-copy">
            <div className="wf-tag">{c.wf026}</div>
            <h3>{c.wf027}</h3>
            <p className="wf-lead">{c.wf028}</p>
            <WorkspaceEntryLink className="wf-cta" data-action-block="features" data-home-cta="flow-editor" href={entry("flowEditor")}>{c.wf052}</WorkspaceEntryLink>
          </div>
        </div>

        {/* 03 · Example templates -> workspace handoff */}
        <div className="wf-row">
          <div className="wf-demo">
            <div className="wf-tmdemo" data-wf-tpl>
              <div className="wf-tmscene wf-grid-scene">
                <div className="wf-tgrid">
                  {demo.templates.map((template, index) => <span className={`wf-tcard${index === 0 ? " is-active" : ""}`} key={template.id}>
                    {template.video
                      ? <Adc2VideoPreview ariaLabel={c[template.label]} media={{ ...clip(template.video), name: c[template.label] }} posterEager={index < 4} />
                      : <Img image={media[template.media ?? ""]} r={r} />}
                    <span className="wf-tnm">{c[template.label]}</span>
                    {index === 0 ? <span className="wf-tuse">{c.wf064}</span> : null}
                  </span>)}
                </div>
              </div>
              <div className="wf-tmscene wf-editor-scene" aria-hidden="true">
                <div className="wf-wpanel">
                  <div className="wf-panel-head"><i className="wf-dot" /><b>{c.wf065}</b><span className="wf-x">✕</span></div>
                  <div className="wf-chips">{chips.map((chip) => <span key={chip}>{chip}</span>)}</div>
                  <div className="wf-wbody">
                    <div className="wf-wslot">{handout ? <Img image={handout.poster} r={r} /> : null}<span className="wf-stag">{c.wf067}</span></div>
                    <div className="wf-wprompt"><span className="wf-wtyped">{c.wf066}</span><i className="wf-caret2" aria-hidden="true" /></div>
                  </div>
                  <div className="wf-wprice"><span>{c.wf068}</span><span className="wf-wgen">{c.wf069}</span></div>
                </div>
              </div>
              {handout ? <Img image={handout.poster} r={r} className="wf-fly" /> : null}
            </div>
          </div>
          <div className="wf-copy">
            <div className="wf-tag">{c.wf053}</div>
            <h3>{c.wf054}</h3>
            <p className="wf-lead">{c.wf055}</p>
            <WorkspaceEntryLink className="wf-cta" data-action-block="features" data-home-cta="flow-examples" href={entry("flowExamples")}>{c.wf070}</WorkspaceEntryLink>
          </div>
        </div>

        {/* 04 · Subtitle Studio */}
        <div className="wf-row wf-flip">
          <div className="wf-demo">
            <div className="wf-capdemo">
              <div className="wf-capphone">
                <Adc2VideoPreview ariaLabel={c.wf007} media={{ ...clip(demo.captionsVideo), name: c.wf007 }} />
                <span className="wf-capline wf-caps0">{c.wf074}</span>
                <span className="wf-capline wf-caps1" aria-hidden="true">{c.wf074}</span>
                <span className="wf-capline wf-caps2" aria-hidden="true">{c.wf074}</span>
              </div>
              <div className="wf-capctl">
                <div className="wf-ctl"><span className="wf-lb">{c.wf075}</span><span className="wf-pill is-on">{c.wf080}</span><span className="wf-pill">{c.wf081}</span><span className="wf-pill">{c.wf082}</span></div>
                <div className="wf-ctl"><span className="wf-lb">{c.wf076}</span><span className="wf-pill">{c.wf083}</span><span className="wf-pill is-on">{c.wf084}</span><span className="wf-pill">{c.wf085}</span></div>
                <div className="wf-ctl"><span className="wf-lb">{c.wf077}</span><span className="wf-pill">{c.wf086}</span><span className="wf-pill">{c.wf087}</span><span className="wf-pill">{c.wf088}</span></div>
                <div className="wf-ctl"><span className="wf-lb">{c.wf078}</span><span className="wf-sw"><i style={{ background: "#fff" }} /><i style={{ background: "#fde047" }} /><i style={{ background: "#22d3ee" }} /><i style={{ background: "#1c1917" }} /></span></div>
                <div className="wf-ctl"><span className="wf-lb">{c.wf079}</span><span className="wf-ctl-note">{c.wf089}</span></div>
              </div>
            </div>
          </div>
          <div className="wf-copy">
            <div className="wf-tag">{c.wf071}</div>
            <h3>{c.wf072}</h3>
            <p className="wf-lead">{c.wf073}</p>
            <WorkspaceEntryLink className="wf-cta" data-action-block="features" data-home-cta="flow-subtitles" href={entry("flowSubtitles")}>{c.wf090}</WorkspaceEntryLink>
          </div>
        </div>

        <div className="wf-morehead">{c.wf091}</div>
        <div className="wf-morestrip">
          <div className="wf-morecard"><span className="wf-ic" aria-hidden="true">▦</span><h4>{c.wf092}</h4><p>{c.wf093}</p></div>
          <div className="wf-morecard"><span className="wf-ic" aria-hidden="true">◔</span><h4>{c.wf094}</h4><p>{c.wf095}</p></div>
          <div className="wf-morecard"><span className="wf-ic" aria-hidden="true">◫</span><h4>{c.wf096}</h4><p>{c.wf097}</p></div>
        </div>

        <div className="wf-foot"><WorkspaceEntryLink className="wf-footbtn" data-action-block="features" data-home-cta="primary" href={entry("flowWorkspace")}>{c.wf098}</WorkspaceEntryLink></div>
      </div>
    </section>
  );
}
