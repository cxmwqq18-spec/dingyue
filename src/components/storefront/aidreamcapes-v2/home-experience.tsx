import type { ReactNode } from "react";
import { Img } from "./parts";
import type { V2Image, V2Resolvers } from "./types";
import type { HomeExperienceData, HomeExperienceKind } from "./home-experience-types";

function Preview({ id, title, close, images, r, children }: {
  id: string; title: string; close: string; images: V2Image[]; r: V2Resolvers; children?: ReactNode;
}) {
  return <dialog className="hx-dialog" id={id} aria-labelledby={`${id}-title`}>
    <div className="hx-dialog-head"><h3 id={`${id}-title`}>{title}</h3><form method="dialog"><button type="submit" data-hx-close aria-label={close}><span aria-hidden="true">×</span><span>{close}</span></button></form></div>
    <div className={`hx-dialog-media${images.length > 1 ? " hx-dialog-pair" : ""}`}>{images.map((image, index) => <figure key={`${image.src}-${index}`}><Img image={image} r={r} /><figcaption>{image.alt}</figcaption></figure>)}</div>
    {children ? <div className="hx-dialog-copy">{children}</div> : null}
  </dialog>;
}

/** Complete HTML from LivePage. Ordinary controls only reveal local presentation. */
export function HomeExperienceSection({ experience, after, r }: {
  experience?: HomeExperienceData; after: HomeExperienceKind; r: V2Resolvers;
}) {
  const block = experience?.blocks.find((item) => item.after === after);
  if (!experience || !block) return null;
  const c = block.copy;
  const m = experience.media;
  const destination = (key: string) => r.href(block.actions?.[key] ?? block.href);
  const primary = r.href(block.href);
  const previewId = (key: string) => `hx-${after}-preview-${key}`;
  const scenes = [
    ["presenter", "m02", "t021"], ["earbuds", "m03", "t022"], ["steamer", "m04", "t023"],
    ["tote", "m05", "t024"], ["cardigan", "m06", "t025"], ["fragrance", "m07", "t026"]
  ];
  const presenters = [["presenterHome", "m08", "t001"], ["presenterWork", "m09", "t002"], ["presenterOutdoor", "m10", "t003"]];
  const shots = [
    ["shot1", "m01", "t010", "t011", "t012", "t013", "t014"],
    ["shot2", "m02", "t015", "t016", "t017", "t018", "t019"],
    ["shot3", "m01", "t020", "t021", "t022", "t023", "t024"]
  ];
  const briefs = [
    ["draftDetails", "m01", "t015", "t016", "t017", "t018", "t019", "product"],
    ["draftPresenter", "m02", "t020", "t021", "t022", "t023", "t024", "presenter"],
    ["draftLaunch", "m01", "t025", "t026", "t027", "t028", "t029", "product"]
  ];

  switch (after) {
    case "hero": return (
      <section className="hx-feature hx-signature" data-hx-root data-home-experience="hero" id="home-experience-hero" aria-labelledby="home-experience-hero-title">
        <div className="hx-wrap">
          <div className="hx-layout">
            <div><div className="hx-tag">{c.t001}</div><h2 id="home-experience-hero-title">{c.t002}<br /><em>{c.t003}</em></h2><p className="hx-intro">{c.t004}</p>
              <div className="hx-points">{[["#home-experience-picker", "t005"], ["#home-experience-picker", "t006"], ["#home-experience-steps", "t007"], ["#home-experience-reviews", "t008"]].map(([href, text]) => <a className="hx-chip" data-home-local={text} href={href} key={text}>{c[text]}</a>)}</div>
              <a className="hx-button hx-action" data-action-block={after} data-home-cta="primary" href={primary}>{c.t009}</a>
            </div>
            <div className="hx-story">
              <button type="button" className="hx-source" data-home-local="source" data-hx-dialog={previewId("source")}><div className="hx-photo"><Img image={m.m01} r={r} /></div><span>{c.t010}</span></button>
              <button type="button" className="hx-phone" data-home-local="result" data-hx-dialog={previewId("result")}><Img image={m.m02} r={r} /><span className="hx-play">{c.t011}</span><span className="hx-caption">{c.t012}<br />{c.t013}</span></button>
              <div className="hx-sticker">{c.t014}</div>
              <button type="button" className="hx-mini-version" data-home-local="versions" data-hx-dialog={previewId("versions")}><strong>{c.t015}</strong><p>{c.t016}<br />{c.t017}</p><span aria-hidden="true" className="hx-bars"><i /><i /><i /></span></button>
            </div>
          </div>
          <div className="hx-path">{[["#home-experience-picker", "t018", "t019"], ["#home-experience-steps", "t020", "t021"], ["#home-experience-features", "t022", "t023"], ["#home-experience-reviews", "t024", "t025"]].map(([href, title, description], index) => <a data-home-local={`step${index + 1}`} href={href} key={title}><b>{c[title]}</b><span>{c[description]}</span></a>)}</div>
        </div>
        <Preview id={previewId("source")} title={c.t010} close={c.uiClose} images={[m.m01]} r={r} />
        <Preview id={previewId("result")} title={c.t011} close={c.uiClose} images={[m.m02]} r={r} />
        <Preview id={previewId("versions")} title={c.t015} close={c.uiClose} images={[m.m01, m.m02]} r={r}><p>{c.t016} {c.t017}</p></Preview>
      </section>
    );
    case "picker": return (
      <section className="hx-feature hx-light hx-scenes" data-hx-root data-home-experience="picker" id="home-experience-picker" aria-labelledby="home-experience-picker-title">
        <div className="hx-wrap hx-scene-layout">
          <div><div className="hx-tag">{c.t001}</div><h2 id="home-experience-picker-title">{c.t002}<br /><em>{c.t003}</em></h2><p className="hx-intro">{c.t004}</p>
            <div className={`hx-steps-list${block.presentation?.steps?.length === 6 ? " hx-six-steps" : ""}`}>{(block.presentation?.steps ?? [["t005", "t006", "t007"], ["t008", "t009", "t010"], ["t011", "t012", "t013"]].map(([number, title, description]) => ({ number: c[number], title: c[title], description: c[description] }))).map(step => <div key={step.number}><i aria-hidden="true">{step.number}</i><div><b>{step.title}</b><p>{step.description}</p></div></div>)}</div>
          </div>
          <div className="hx-selector">
            <div className="hx-window-head"><span>{c.t014}</span><small>{c.t015}</small></div>
            <div className="hx-filters">{[["all", "t016"], ["beauty", "t017"], ["clothing", "t018"], ["tech", "t019"], ["home", "t020"]].map(([key, text], index) => <button type="button" aria-pressed={index === 0} className={index === 0 ? "is-selected" : undefined} data-home-local={`filter-${key}`} data-hx-filter={key} key={key}>{c[text]}</button>)}</div>
            <div className="hx-scene-grid">{scenes.map(([key, image, title], index) => <button type="button" className={`hx-scene-card${index === 0 ? " is-selected" : ""}`} data-home-local={key} data-hx-filter-tags={(block.presentation?.sceneCategories?.[key] ?? []).join(" ")} data-hx-select-group="scene" data-hx-select-value={key} aria-pressed={index === 0} key={key}><span className="photo"><Img image={m[image]} r={r} /></span><b>{c[title]}</b></button>)}</div>
            {scenes.map(([key, image, title], index) => <div className="hx-selector-footer" data-hx-panel-group="scene" data-hx-panel-value={key} hidden={index !== 0} key={key}>
              <button type="button" className="hx-selected" data-home-local={`preview-${key}`} data-hx-dialog={previewId(key)}><Img image={m[image]} r={r} /><span><small>{c.t027}</small>{c[title]}</span></button>
              <a className="hx-button" data-action-block={after} data-home-cta={key} href={destination(key)}>{c.t029}</a>
            </div>)}
          </div>
        </div>
        {scenes.map(([key, image, title]) => <Preview id={previewId(key)} title={c[title]} close={c.uiClose} images={[m[image]]} r={r} key={key}><p>{c.t028}</p></Preview>)}
      </section>
    );
    case "steps": return (
      <section className="hx-feature hx-presenter" data-hx-root data-home-experience="steps" id="home-experience-steps" aria-labelledby="home-experience-steps-title">
        <div className="hx-wrap hx-presenter-layout">
          <div className="hx-presenter-visual">
            <div data-hx-panel-group="presenter" data-hx-panel-value="initial"><button type="button" className="hx-presenter-main" data-home-local="main" data-hx-dialog={previewId("main")}><Img image={m.m02} r={r} /></button></div>
            {presenters.map(([key, image]) => <div data-hx-panel-group="presenter" data-hx-panel-value={key} hidden key={key}><button type="button" className="hx-presenter-main" data-home-local={`main-${key}`} data-hx-dialog={previewId(key)}><Img image={m[image]} r={r} /></button></div>)}
            <div className="hx-people">{presenters.map(([key, image, title]) => <button type="button" className="hx-person" data-home-local={key} data-hx-select-group="presenter" data-hx-select-value={key} aria-pressed={false} key={key}><Img image={m[image]} r={r} /><span>{c[title]}</span></button>)}</div>
          </div>
          <div className="hx-presenter-copy"><div className="hx-tag">{c.t004}</div><h2 id="home-experience-steps-title">{c.t005}<br /><em>{c.t006}</em></h2><p className="hx-intro">{c.t007}</p>
            <div className="hx-script"><span>{c.t008}</span><p>{c.t009}</p><details className="hx-voice-details"><summary className="hx-voice" data-home-local="voice"><span>{c.t010}</span><span className="hx-wave" aria-hidden="true">{[9, 16, 25, 12, 21, 30, 17, 9, 22, 27, 14, 19, 9].map((height, index) => <i key={index} style={{ height }} />)}</span><span>{c.t011}</span></summary><div className="hx-voice-information"><strong>{c.uiVoiceTitle}</strong><p>{c.uiVoiceDescription}</p><p>{c.uiVoiceNotice}</p></div></details></div>
            <p className="hx-note">{c.t012}</p><a className="hx-button hx-action" data-action-block={after} data-home-cta="primary" href={primary}>{c.t013}</a>
          </div>
        </div>
        <Preview id={previewId("main")} title={c.t008} close={c.uiClose} images={[m.m02]} r={r} />
        {presenters.map(([key, image, title]) => <Preview id={previewId(key)} title={c[title]} close={c.uiClose} images={[m[image]]} r={r} key={key} />)}
      </section>
    );
    case "features": return (
      <section className="hx-feature hx-board" data-hx-root data-home-experience="features" id="home-experience-features" aria-labelledby="home-experience-features-title">
        <div className="hx-wrap">
          <div className="hx-top"><div><div className="hx-tag">{c.t001}</div><h2 id="home-experience-features-title">{c.t002}<br /><em>{c.t003}</em></h2></div><p>{c.t004}</p></div>
          <div className="hx-editor">
            <div className="hx-editor-toolbar"><strong>{c.t005}</strong><div className="hx-editor-tabs">{[["product", "t006"], ["storyboard", "t007"], ["assembly", "t008"], ["delivery", "t009"]].map(([key, text], index) => <button type="button" className={index === 1 ? "is-selected" : undefined} data-home-local={`stage-${key}`} data-hx-select-group="stage" data-hx-select-value={key} aria-pressed={index === 1} key={key}>{c[text]}</button>)}</div></div>
            <div className="hx-stage-panel" data-hx-panel-group="stage" data-hx-panel-value="product" hidden><button type="button" className="hx-stage-preview" data-home-local="product-preview" data-hx-dialog={previewId("product")}><Img image={m.m01} r={r} /></button><div><h3>{c.t006}</h3><p>{c.uiProductStage}</p></div></div>
            <div data-hx-panel-group="stage" data-hx-panel-value="storyboard">
              <div className="hx-shotgrid">{shots.map(([key, image, duration, title, description, firstCopy, secondCopy], index) => <div className="hx-shot" key={key}>
                {["first", "second"].map((version, versionIndex) => <div className="hx-shot-frame" data-hx-panel-group={key} data-hx-panel-value={version} hidden={versionIndex !== (index === 1 ? 1 : 0)} key={version}><button type="button" className="hx-shot-image" data-home-local={`${key}-${version}-preview`} data-hx-dialog={previewId(`${key}-${version}`)}><Img image={m[image]} r={r} style={{ objectPosition: versionIndex ? "65% 65%" : "50% 35%", transform: versionIndex ? "scale(1.16)" : undefined }} /><small>{c[duration]}</small></button></div>)}
                <div className="hx-shot-body"><strong>{c[title]}</strong><p>{c[description]}</p><div className="hx-versions">{[["first", firstCopy], ["second", secondCopy]].map(([version, text], versionIndex) => <button type="button" className={versionIndex === (index === 1 ? 1 : 0) ? "is-selected" : undefined} data-home-local={`${key}-${version}`} data-hx-select-group={key} data-hx-select-value={version} aria-pressed={versionIndex === (index === 1 ? 1 : 0)} key={version}>{c[text]}</button>)}</div></div>
              </div>)}</div>
              <div className="hx-timeline"><span>{c.t025}</span><i /><i /><i /><span>{c.t026}</span></div>
            </div>
            <div className="hx-stage-panel hx-stage-assembly" data-hx-panel-group="stage" data-hx-panel-value="assembly" hidden><div className="hx-assembly-frames">{["m01", "m02", "m01"].map((image, index) => <button type="button" data-home-local={`assembly-frame-${index + 1}`} data-hx-dialog={previewId(index === 1 ? "result" : "product")} key={index}><Img image={m[image]} r={r} /></button>)}</div><div><h3>{c.t008}</h3><p>{c.uiAssemblyStage}</p><span>{c.t026}</span></div></div>
            <div className="hx-stage-panel" data-hx-panel-group="stage" data-hx-panel-value="delivery" hidden><button type="button" className="hx-stage-preview" data-home-local="delivery-preview" data-hx-dialog={previewId("result")}><Img image={m.m02} r={r} /></button><div><h3>{c.t009}</h3><p>{c.uiDeliveryStage}</p></div></div>
          </div>
          <div className="hx-board-bottom">{[["t027", "t028"], ["t029", "t030"], ["t031", "t032"]].map(([title, description]) => <span key={title}><b>{c[title]}</b>{c[description]}</span>)}</div>
          <a className="hx-button hx-action" data-action-block={after} data-home-cta="primary" href={primary}>{c.t033}</a>
        </div>
        <Preview id={previewId("product")} title={c.t006} close={c.uiClose} images={[m.m01]} r={r} />
        <Preview id={previewId("result")} title={c.t009} close={c.uiClose} images={[m.m02]} r={r} />
        {shots.flatMap(([key, image, , title]) => ["first", "second"].map((version) => <Preview id={previewId(`${key}-${version}`)} title={c[title]} close={c.uiClose} images={[m[image]]} r={r} key={`${key}-${version}`} />))}
      </section>
    );
    case "audience": return (
      <section className="hx-feature hx-light hx-batch" data-hx-root data-home-experience="audience" id="home-experience-audience" aria-labelledby="home-experience-audience-title">
        <div className="hx-wrap hx-batch-layout">
          <div><div className="hx-tag">{c.t001}</div><h2 id="home-experience-audience-title">{c.t002}<br /><em>{c.t003}</em></h2><p className="hx-intro">{c.t004}</p><div className="hx-batch-pills">{["t005", "t006", "t007"].map((text) => <span className="hx-chip" key={text}>{c[text]}</span>)}</div>
            {briefs.map(([key, , , title], index) => <div data-hx-panel-group="brief" data-hx-panel-value={key} hidden={index !== 0} key={key}><p className="hx-selected-brief">{c[title]}</p><a className="hx-button hx-action" data-action-block={after} data-home-cta={key} href={destination(key)}>{c.uiUseBrief}</a></div>)}
            <p className="hx-note">{c.t009}</p>
          </div>
          <div className="hx-library"><div className="hx-library-head"><span>{c.t010}</span><small>{c.t011}</small></div><div className="hx-library-filter">{[["all", "t012"], ["product", "t013"], ["presenter", "t014"]].map(([key, text], index) => <button type="button" className={index === 0 ? "is-selected" : undefined} data-home-local={`filter-${key}`} data-hx-filter={key} aria-pressed={index === 0} key={key}>{c[text]}</button>)}</div>
            <div className="hx-drafts">{briefs.map(([key, image, state, title, line1, line2, edit, category], index) => <button type="button" className={`hx-draft${index === 0 ? " is-selected" : ""}`} data-home-local={key} data-hx-filter-tags={category} data-hx-select-group="brief" data-hx-select-value={key} data-hx-dialog={previewId(key)} aria-pressed={index === 0} key={key}><span className="hx-draft-photo"><Img image={m[image]} r={r} /><span className="state">{c[state]}</span></span><span className="copy"><strong>{c[title]}</strong><span className="hx-draft-description">{c[line1]}<br />{c[line2]}</span><span className="hx-draft-edit">{c[edit]}</span></span></button>)}</div>
            <p className="hx-local-empty" data-hx-empty hidden>{c.uiEmpty}</p><div className="hx-library-foot">{c.t030}</div>
          </div>
        </div>
        {briefs.map(([key, image, , title, line1, line2]) => <Preview id={previewId(key)} title={c[title]} close={c.uiClose} images={[m[image]]} r={r} key={key}><p>{c[line1]} {c[line2]}</p><p>{c.t009}</p><a className="hx-button" data-action-block={after} data-home-cta={key} href={destination(key)}>{c.uiUseBrief}</a></Preview>)}
      </section>
    );
    case "reviews": return (
      <section className="hx-feature hx-formats" data-hx-root data-home-experience="reviews" id="home-experience-reviews" aria-labelledby="home-experience-reviews-title">
        <div className="hx-wrap"><div className="hx-top"><div><div className="hx-tag">{c.t001}</div><h2 id="home-experience-reviews-title">{c.t002}<br /><em>{c.t003}</em></h2></div><p>{c.t004}</p></div>
          <div className="hx-formats-board">
            <button type="button" className="hx-format-phone is-selected" data-home-local="video" data-hx-select-group="format" data-hx-select-value="video" data-hx-dialog={previewId("video")} aria-pressed={true}><Img image={m.m02} r={r} /><span className="caption">{c.t005}<br />{c.t006}</span></button>
            <button type="button" className="hx-format-square" data-home-local="image" data-hx-select-group="format" data-hx-select-value="image" data-hx-dialog={previewId("image")} aria-pressed={false}><span className="photo"><Img image={m.m01} r={r} /></span><span>{c.t007}<br />{c.t008}</span></button>
            <button type="button" className="hx-format-web" data-home-local="productPage" data-hx-select-group="format" data-hx-select-value="productPage" data-hx-dialog={previewId("productPage")} aria-pressed={false}><span className="hx-browser-dots" aria-hidden="true"><i /><i /><i /></span><span className="photo"><Img image={m.m01} r={r} /><Img image={m.m02} r={r} /></span><span>{c.t009}<br />{c.t010}</span></button>
          </div>
          <div className="hx-formats-foot">{["t011", "t012", "t013", "t014", "t015"].map((text) => <span key={text}>{c[text]}</span>)}</div>
          <div className="hx-format-action">{[["video", "t005"], ["image", "t007"], ["productPage", "t009"]].map(([key, title], index) => <div data-hx-panel-group="format" data-hx-panel-value={key} hidden={index !== 0} key={key}><p className="hx-selected-format">{c[title]}</p><a className="hx-button hx-action" data-action-block={after} data-home-cta={key} href={destination(key)}>{c.t016}</a></div>)}</div><p className="hx-note">{c.t017}</p>
        </div>
        <Preview id={previewId("video")} title={c.t005} close={c.uiClose} images={[m.m02]} r={r} />
        <Preview id={previewId("image")} title={c.t007} close={c.uiClose} images={[m.m01]} r={r} />
        <Preview id={previewId("productPage")} title={c.t009} close={c.uiClose} images={[m.m01, m.m02]} r={r} />
      </section>
    );
  }
}
