import { WorkspaceEntryLink } from "@/components/aidreamcapes-workspace/entry-link";
import { Adc2VideoPreview } from "./video-preview-card";
import { SeoPosterVideo } from "./seo-poster-video";
import { aidreamcapesV2ResponsiveImageProps, aidreamcapesV2ResponsivePosterSrc } from "@/lib/aidreamcapes-v2-responsive-images";
import type { ReactNode } from "react";
import { Img } from "./parts";
import { AIDREAMCAPES_V2_HOME_PHONE_SIZES, AIDREAMCAPES_V2_HOME_PRODUCT_SIZES } from "./image-sizes";
import type { V2Image, V2Resolvers } from "./types";
import type { HomeCampaignSections, HomeExperienceData, HomeExperienceKind, HomePlatformsFlowDemo } from "./home-experience-types";
import "./home-campaign.css";
import { HomeWorkflow } from "./home-workflow";
import { HomeWorkspaceFlow } from "./home-workspace-flow";

function Preview({ id, title, close, images, r, children }: {
  id: string; title: string; close: string; images: V2Image[]; r: V2Resolvers; children?: ReactNode;
}) {
  return <dialog className="hx-dialog" id={id} aria-labelledby={`${id}-title`}>
    <div className="hx-dialog-head"><h3 id={`${id}-title`}>{title}</h3><form method="dialog"><button type="submit" data-hx-close aria-label={close}><span aria-hidden="true">×</span><span>{close}</span></button></form></div>
    <div className={`hx-dialog-media${images.length > 1 ? " hx-dialog-pair" : ""}`}>{images.map((image, index) => <figure key={`hx-dialog-media-${index}`}><Img image={image} r={r} /><figcaption>{image.alt}</figcaption></figure>)}</div>
    {children ? <div className="hx-dialog-copy">{children}</div> : null}
  </dialog>;
}

/** Complete HTML from LivePage. Ordinary controls only reveal local presentation. */
export function HomeExperienceSection({ experience, after, campaign, r }: {
  experience?: HomeExperienceData; after: HomeExperienceKind; campaign?: HomeCampaignSections; r: V2Resolvers;
}) {
  const block = experience?.blocks.find((item) => item.after === after);
  if (!experience || !block) return null;
  const c = block.copy;
  const m = experience.media;
  // The hero phone loops its example clip once the page provides one; the still stays the fallback.
  const heroVideo = experience.videos?.[block.presentation?.heroVideo ?? ""];
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

  if (after === "audience" && campaign) return <HomeWorkflow workflow={campaign.workflow} demo={block.presentation?.workflowDemo} media={m} videos={experience.videos ?? {}} r={r} />;
  if (after === "features" && block.presentation?.workspaceFlow) return <HomeWorkspaceFlow demo={block.presentation.workspaceFlow} copy={c} media={m} videos={experience.videos ?? {}} r={r} actions={block.actions} />;

  switch (after) {
    case "hero": return (
      <section className="hx-feature hx-signature" data-hx-root data-home-experience="hero" id="home-experience-hero" aria-labelledby="home-experience-hero-title">
        <div className="hx-wrap">
          <div className="hx-layout">
            <div><div className="hx-tag">{c.t001}</div><h2 id="home-experience-hero-title">{c.t002}<br /><em>{c.t003}</em></h2><p className="hx-intro">{c.t004}</p>
              <div className="hx-points">{[[block.actions?.anchorProductPhoto ?? "#home-experience-picker", "t005"], [block.actions?.anchorScenes ?? "#home-experience-picker", "t006"], [block.actions?.anchorPresenters ?? "#home-experience-steps", "t007"], [block.actions?.anchorFormats ?? "#home-experience-reviews", "t008"]].map(([href, text]) => <WorkspaceEntryLink className="hx-chip" data-home-local={text} href={href} key={text}>{c[text]}</WorkspaceEntryLink>)}</div>
              <WorkspaceEntryLink className="hx-button hx-action" data-action-block={after} data-home-cta="primary" href={primary}>{c.t009}</WorkspaceEntryLink>
            </div>
            <div className="hx-story">
              <button type="button" className="hx-source" data-home-local="source" data-hx-dialog={previewId("source")}><div className="hx-photo"><Img image={m.m01} r={r} {...aidreamcapesV2ResponsiveImageProps(m.m01.src, AIDREAMCAPES_V2_HOME_PRODUCT_SIZES)} /></div><span>{c.t010}</span></button>
              <button type="button" className="hx-phone" data-home-local="result" data-hx-dialog={previewId("result")}>{heroVideo ? <Adc2VideoPreview ariaLabel={heroVideo.name ?? c.t011} media={{ src: r.asset(heroVideo.src), previewSrc: heroVideo.previewSrc ? r.asset(heroVideo.previewSrc) : undefined, poster: r.asset(aidreamcapesV2ResponsivePosterSrc(heroVideo.poster?.src ?? "")), width: heroVideo.width, height: heroVideo.height, duration: heroVideo.duration }} posterEager /> : <Img eager image={m.m02} r={r} {...aidreamcapesV2ResponsiveImageProps(m.m02.src, AIDREAMCAPES_V2_HOME_PHONE_SIZES)} />}<span className="hx-play">{c.t011}</span><span className="hx-caption">{c.t012}<br />{c.t013}</span></button>
              <div className="hx-sticker">{c.t014}</div>
              <button type="button" className="hx-mini-version" data-home-local="versions" data-hx-dialog={previewId("versions")}><strong>{c.t015}</strong><p>{c.t016}<br />{c.t017}</p><span aria-hidden="true" className="hx-bars"><i /><i /><i /></span></button>
            </div>
          </div>
          <div className="hx-path">{[[block.actions?.anchorPathProduct ?? "#home-experience-picker", "t018", "t019"], [block.actions?.anchorPathScene ?? "#home-experience-steps", "t020", "t021"], [block.actions?.anchorPathStoryboard ?? "#home-experience-features", "t022", "t023"], [block.actions?.anchorPathReview ?? "#home-experience-reviews", "t024", "t025"]].map(([href, title, description], index) => <WorkspaceEntryLink data-home-local={`step${index + 1}`} href={href} key={title}><b>{c[title]}</b><span>{c[description]}</span></WorkspaceEntryLink>)}</div>
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
            <div className="hx-filters">{(block.presentation?.sceneTabsV3 ?? [["all", "t016"], ["beauty", "t017"], ["clothing", "t018"], ["tech", "t019"], ["home", "t020"]].map(([key, text]) => ({ key, label: c[text] }))).map((tab, index) => <button type="button" aria-pressed={index === 0} className={index === 0 ? "is-selected" : undefined} data-home-local={`filter-${tab.key}`} data-hx-filter={tab.key} key={tab.key}>{tab.label}</button>)}</div>
            <div className="hx-scene-grid">{(block.presentation?.sceneCardsV3 ?? scenes.map(([key, image, title]) => ({ key, title: c[title], category: (block.presentation?.sceneCategories?.[key] ?? []).join(" "), publicSlug: "", image: m[image], video: null as null | { src: string; poster: V2Image }, detailHref: "" }))).map((card, index) => {
              const className = `hx-scene-card${index === 0 ? " is-selected" : ""}`;
              const body = <><span className="photo">{card.video ? <img alt={card.title} decoding="async" loading="lazy" src={r.asset(card.video.poster?.src ?? card.image.src)} /> : <Img image={card.image} r={r} />}{card.category ? <span className="hx-scene-chip">{card.category}</span> : null}</span><b>{card.title}</b></>;
              // A card with a live detail slug is a plain SSR link; the legacy
              // select-and-preview button stays only for cards without one.
              return card.detailHref
                ? <a className={className} href={r.href(card.detailHref)} data-hx-filter-tags={card.category} key={card.key}>{body}</a>
                : <button type="button" className={className} data-home-local={card.key} data-hx-filter-tags={card.category} data-hx-select-group="scene" data-hx-select-value={card.key} aria-pressed={index === 0} key={card.key}>{body}</button>;
            })}</div>
            {(block.presentation?.sceneCardsV3 ?? scenes.map(([key, image, title]) => ({ key, title: c[title], publicSlug: "", image: m[image], video: null as null | { src: string; poster: V2Image }, detailHref: "" }))).map((card, index) => <div className="hx-selector-footer" data-hx-panel-group="scene" data-hx-panel-value={card.key} hidden={index !== 0} key={card.key}>
              <button type="button" className="hx-selected" data-home-local={`preview-${card.key}`} data-hx-dialog={previewId(card.key)}>{card.video ? <img alt={card.title} decoding="async" loading="lazy" src={r.asset(card.video.poster?.src ?? card.image.src)} /> : <Img image={card.image} r={r} />}<span><small>{c.t027}</small>{card.title}</span></button>
              <WorkspaceEntryLink className="hx-button" data-action-block={after} data-home-cta={card.key} href={destination(card.key)}>{c.t029}</WorkspaceEntryLink>
            </div>)}
          </div>
        </div>
        {(block.presentation?.sceneCardsV3 ?? scenes.map(([key, image, title]) => ({ key, title: c[title], image: m[image], video: null as null | { src: string; poster: V2Image }, detailHref: "" }))).map(card => <Preview id={previewId(card.key)} title={card.title} close={c.uiClose} images={card.video ? [] : [card.image]} r={r} key={card.key}>
          {card.video ? <SeoPosterVideo alt={card.title} className="hx-dialog-video" muted poster={card.video.poster ? r.asset(card.video.poster.src) : undefined} src={r.asset(card.video.src)} /> : null}
          <p>{c.t028}</p>
          {card.detailHref ? <WorkspaceEntryLink className="hx-detail-link" href={r.href(card.detailHref)}>Open the video detail page <span aria-hidden="true">→</span></WorkspaceEntryLink> : null}
        </Preview>)}
      </section>
    );
    case "steps": {
      const showcase = block.presentation?.presenterShowcase;
      if (showcase) return (
        <section className="hx-feature hx-presenter-flow" data-hx-root data-home-experience="steps" id="home-experience-steps" aria-labelledby="home-experience-steps-title">
          <div className="hx-wrap">
            <div className="hx-flow-head">
              <div className="hx-tag">{c.t004}</div>
              <h2 id="home-experience-steps-title">{c.t005}<br /><em>{c.t006}</em></h2>
              <p className="hx-intro">{c.t007}</p>
            </div>
            <div className="hx-flow-tabs">
              {showcase.presenters.map((presenter, index) => (
                <button type="button" className={`hx-flow-tab${index === 0 ? " is-active" : ""}`} data-home-local={presenter.key} data-hx-select-group="presenter" data-hx-select-value={presenter.key} aria-pressed={index === 0} key={presenter.key}>
                  <Img image={m[presenter.actorMedia]} r={r} />
                  <span>{c[presenter.tab]}<small>{c[presenter.scene]}</small></span>
                </button>
              ))}
            </div>
            {showcase.presenters.map((presenter, index) => {
              const video = experience?.videos?.[presenter.video];
              return (
                <div className="hx-flow-stage" data-hx-panel-group="presenter" data-hx-panel-value={presenter.key} hidden={index !== 0} key={presenter.key}>
                  <div className="hx-flow">
                    <div className="hx-flow-slot">
                      <div className="hx-flow-shot">
                        <span className="hx-flow-num" aria-hidden="true">1</span>
                        <Img image={m[presenter.actorMedia]} r={r} />
                        <div className="hx-flow-cap"><b>{c[showcase.cards.presenter]}</b><span>{c[presenter.scene]}</span></div>
                      </div>
                    </div>
                    <div className="hx-flow-link" aria-hidden="true">
                      <span className="hx-flow-sym">+</span>
                      <span className="hx-flow-lbl">{c[showcase.connectors.plus]}</span>
                    </div>
                    <div className="hx-flow-slot">
                      <div className="hx-flow-shot hx-flow-shot-product">
                        <span className="hx-flow-num" aria-hidden="true">2</span>
                        <Img image={m[presenter.productMedia]} r={r} />
                        <div className="hx-flow-cap"><b>{c[showcase.cards.product]}</b><span>{c[showcase.cards.productSub]}</span></div>
                      </div>
                    </div>
                    <div className="hx-flow-link" aria-hidden="true">
                      <span className="hx-flow-sym">&#8594;</span>
                      <span className="hx-flow-lbl">{c[showcase.connectors.arrow]}</span>
                    </div>
                    <div className="hx-flow-slot">
                      <div className="hx-flow-shot hx-flow-shot-video">
                        <span className="hx-flow-num" aria-hidden="true">3</span>
                        {video ? <a className="hx-flow-video" href={`/ai-video-generation/${video.src.split("/").pop()?.replace(/\.mp4$/, "") ?? ""}`} aria-label={video.name ?? c[presenter.tab]}>
                          <img alt={video.name ?? c[presenter.tab]} decoding="async" height={video.height} loading={index === 0 ? "eager" : "lazy"} src={r.asset(aidreamcapesV2ResponsivePosterSrc(video.poster?.src ?? ""))} width={video.width} />
                        </a> : <Img image={m[presenter.actorMedia]} r={r} />}
                        <div className="hx-flow-cap"><b>{c[showcase.cards.video]}</b><span>{c[showcase.cards.videoSub]}</span></div>
                      </div>
                    </div>
                  </div>
                  <div className="hx-flow-bar">
                    <p className="hx-flow-quote">&#8220;{c[presenter.quote]}&#8221;<span className="hx-flow-who">{c[presenter.quoteWho]}</span></p>
                    <div className="hx-flow-action">
                      <WorkspaceEntryLink className="hx-button hx-action" data-action-block={after} data-home-cta="primary" href={primary}>{c.t013}</WorkspaceEntryLink>
                      <p className="hx-flow-spec">{c[showcase.spec]}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="hx-flow-how">
              <div className="hx-flow-how-head"><h3>{c[showcase.stepsTitle]}</h3><span aria-hidden="true" /></div>
              <div className="hx-flow-how-steps">
                {showcase.steps.map((step) => (
                  <div className="hx-flow-how-step" key={step.title}>
                    <i aria-hidden="true">{c[step.number]}</i>
                    <div><b>{c[step.title]}</b><p>{c[step.description]}</p></div>
                  </div>
                ))}
              </div>
            </div>
            <p className="hx-note hx-flow-note">{c.t012}</p>
          </div>
        </section>
      );
      return (
      <section className="hx-feature hx-presenter" data-hx-root data-home-experience="steps" id="home-experience-steps" aria-labelledby="home-experience-steps-title">
        <div className="hx-wrap hx-presenter-layout">
          <div className="hx-presenter-visual">
            <div data-hx-panel-group="presenter" data-hx-panel-value="initial"><button type="button" className="hx-presenter-main" data-home-local="main" data-hx-dialog={previewId("main")}><Img image={m.m02} r={r} /></button></div>
            {presenters.map(([key, image]) => <div data-hx-panel-group="presenter" data-hx-panel-value={key} hidden key={key}><button type="button" className="hx-presenter-main" data-home-local={`main-${key}`} data-hx-dialog={previewId(key)}><Img image={m[image]} r={r} /></button></div>)}
            <div className="hx-people">{presenters.map(([key, image, title]) => <button type="button" className="hx-person" data-home-local={key} data-hx-select-group="presenter" data-hx-select-value={key} aria-pressed={false} key={key}><Img image={m[image]} r={r} /><span>{c[title]}</span></button>)}</div>
          </div>
          <div className="hx-presenter-copy"><div className="hx-tag">{c.t004}</div><h2 id="home-experience-steps-title">{c.t005}<br /><em>{c.t006}</em></h2><p className="hx-intro">{c.t007}</p>
            <div className="hx-script"><span>{c.t008}</span><p>{c.t009}</p><details className="hx-voice-details"><summary className="hx-voice" data-home-local="voice"><span>{c.t010}</span><span className="hx-wave" aria-hidden="true">{[9, 16, 25, 12, 21, 30, 17, 9, 22, 27, 14, 19, 9].map((height, index) => <i key={index} style={{ height }} />)}</span><span>{c.t011}</span></summary><div className="hx-voice-information"><strong>{c.uiVoiceTitle}</strong><p>{c.uiVoiceDescription}</p><p>{c.uiVoiceNotice}</p></div></details></div>
            <p className="hx-note">{c.t012}</p><WorkspaceEntryLink className="hx-button hx-action" data-action-block={after} data-home-cta="primary" href={primary}>{c.t013}</WorkspaceEntryLink>
          </div>
        </div>
        <Preview id={previewId("main")} title={c.t008} close={c.uiClose} images={[m.m02]} r={r} />
        {presenters.map(([key, image, title]) => <Preview id={previewId(key)} title={c[title]} close={c.uiClose} images={[m[image]]} r={r} key={key} />)}
      </section>
      );
    }
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
          <WorkspaceEntryLink className="hx-button hx-action" data-action-block={after} data-home-cta="primary" href={primary}>{c.t033}</WorkspaceEntryLink>
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
            {briefs.map(([key, , , title], index) => <div data-hx-panel-group="brief" data-hx-panel-value={key} hidden={index !== 0} key={key}><p className="hx-selected-brief">{c[title]}</p><WorkspaceEntryLink className="hx-button hx-action" data-action-block={after} data-home-cta={key} href={destination(key)}>{c.uiUseBrief}</WorkspaceEntryLink></div>)}
            <p className="hx-note">{c.t009}</p>
          </div>
          <div className="hx-library"><div className="hx-library-head"><span>{c.t010}</span><small>{c.t011}</small></div><div className="hx-library-filter">{[["all", "t012"], ["product", "t013"], ["presenter", "t014"]].map(([key, text], index) => <button type="button" className={index === 0 ? "is-selected" : undefined} data-home-local={`filter-${key}`} data-hx-filter={key} aria-pressed={index === 0} key={key}>{c[text]}</button>)}</div>
            <div className="hx-drafts">{briefs.map(([key, image, state, title, line1, line2, edit, category], index) => <button type="button" className={`hx-draft${index === 0 ? " is-selected" : ""}`} data-home-local={key} data-hx-filter-tags={category} data-hx-select-group="brief" data-hx-select-value={key} data-hx-dialog={previewId(key)} aria-pressed={index === 0} key={key}><span className="hx-draft-photo"><Img image={m[image]} r={r} /><span className="state">{c[state]}</span></span><span className="copy"><strong>{c[title]}</strong><span className="hx-draft-description">{c[line1]}<br />{c[line2]}</span><span className="hx-draft-edit">{c[edit]}</span></span></button>)}</div>
            <p className="hx-local-empty" data-hx-empty hidden>{c.uiEmpty}</p><div className="hx-library-foot">{c.t030}</div>
          </div>
        </div>
        {briefs.map(([key, image, , title, line1, line2]) => <Preview id={previewId(key)} title={c[title]} close={c.uiClose} images={[m[image]]} r={r} key={key}><p>{c[line1]} {c[line2]}</p><p>{c.t009}</p><WorkspaceEntryLink className="hx-button" data-action-block={after} data-home-cta={key} href={destination(key)}>{c.uiUseBrief}</WorkspaceEntryLink></Preview>)}
      </section>
    );
    case "reviews": {
      const platformsFlow = block.presentation?.platformsFlow;
      if (platformsFlow) return <HomePlatformsFlow platformsFlow={platformsFlow} block={block} experience={experience} c={c} r={r} />;
      return (
      <section className="hx-feature hx-formats" data-hx-root data-home-experience="reviews" id="home-experience-reviews" aria-labelledby="home-experience-reviews-title">
        <div className="hx-wrap"><div className="hx-top"><div><div className="hx-tag">{c.t001}</div><h2 id="home-experience-reviews-title">{c.t002}<br /><em>{c.t003}</em></h2></div><p>{c.t004}</p></div>
          <div className="hx-formats-board">
            <button type="button" className="hx-format-phone is-selected" data-home-local="video" data-hx-select-group="format" data-hx-select-value="video" data-hx-dialog={previewId("video")} aria-pressed={true}><Img image={m.m02} r={r} /><span className="caption">{c.t005}<br />{c.t006}</span></button>
            <button type="button" className="hx-format-square" data-home-local="image" data-hx-select-group="format" data-hx-select-value="image" data-hx-dialog={previewId("image")} aria-pressed={false}><span className="photo"><Img image={m.m01} r={r} /></span><span>{c.t007}<br />{c.t008}</span></button>
            <button type="button" className="hx-format-web" data-home-local="productPage" data-hx-select-group="format" data-hx-select-value="productPage" data-hx-dialog={previewId("productPage")} aria-pressed={false}><span className="hx-browser-dots" aria-hidden="true"><i /><i /><i /></span><span className="photo"><Img image={m.m01} r={r} /><Img image={m.m02} r={r} /></span><span>{c.t009}<br />{c.t010}</span></button>
          </div>
          <div className="hx-formats-foot">{["t011", "t012", "t013", "t014", "t015"].map((text) => <span key={text}>{c[text]}</span>)}</div>
          <div className="hx-format-action">{[["video", "t005"], ["image", "t007"], ["productPage", "t009"]].map(([key, title], index) => <div data-hx-panel-group="format" data-hx-panel-value={key} hidden={index !== 0} key={key}><p className="hx-selected-format">{c[title]}</p><WorkspaceEntryLink className="hx-button hx-action" data-action-block={after} data-home-cta={key} href={destination(key)}>{c.t016}</WorkspaceEntryLink></div>)}</div><p className="hx-note">{c.t017}</p>
        </div>
        <Preview id={previewId("video")} title={c.t005} close={c.uiClose} images={[m.m02]} r={r} />
        <Preview id={previewId("image")} title={c.t007} close={c.uiClose} images={[m.m01]} r={r} />
        <Preview id={previewId("productPage")} title={c.t009} close={c.uiClose} images={[m.m01, m.m02]} r={r} />
      </section>
      );
    }
  }
}

const platformGlyphs: Record<string, ReactNode> = {
  tiktok: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.6 3c.4 2.1 1.8 3.6 3.9 3.9v3c-1.5 0-2.8-.4-3.9-1.2v5.6c0 3.6-2.6 5.9-5.8 5.9-3 0-5.4-2.3-5.4-5.3 0-3.1 2.6-5.5 6-5.2v3.1c-1.7-.4-3 .5-3 2 0 1.3 1 2.2 2.4 2.2 1.5 0 2.6-1 2.6-2.9V3h3.2z" /></svg>,
  instagram: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4.2" /><circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none" /></svg>,
  facebook: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12z" /></svg>
};

/** "Native style, platform by platform": one real library clip per platform,
 * each autoplaying in view through the shared preview budget. Presentation-only
 * selection switches the CTA destination; SSR renders the first card selected. */
function HomePlatformsFlow({ platformsFlow, block, experience, c, r }: {
  platformsFlow: HomePlatformsFlowDemo;
  block: NonNullable<HomeExperienceData["blocks"][number]>;
  experience: HomeExperienceData;
  c: Record<string, string>;
  r: V2Resolvers;
}) {
  const destination = (key: string) => r.href(block.actions?.[key] ?? block.href);
  const clipMedia = (key: string, ariaLabel: string) => {
    const video = (experience.videos ?? {})[key];
    if (!video) throw new Error(`Missing platform video: ${key}`);
    return {
      src: r.asset(video.src),
      previewSrc: video.previewSrc ? r.asset(video.previewSrc) : undefined,
      poster: r.asset(aidreamcapesV2ResponsivePosterSrc(video.poster?.src ?? "")),
      width: video.width,
      height: video.height,
      duration: video.duration,
      name: ariaLabel
    };
  };
  return (
    <section className="hx-feature hx-platforms" data-hx-root data-home-experience="reviews" id="home-experience-reviews" aria-labelledby="home-experience-reviews-title">
      <div className="hx-wrap">
        <div className="hx-pf-top">
          <div className="hx-tag">{c.t001}</div>
          <h2 id="home-experience-reviews-title">{c.t002}<br /><em>{c.t003}</em></h2>
          <p className="hx-pf-lead">{c.t004}</p>
        </div>
        <div className="hx-pf-grid">
          {platformsFlow.platforms.map((entry, index) => {
            const className = `hx-pf-card${index === 0 ? " is-selected" : ""}`;
            const body = <>
              <span className="hx-pf-screen">
                <Adc2VideoPreview ariaLabel={c[entry.title]} media={clipMedia(entry.video, c[entry.title])} posterEager={false} />
                <span className="hx-pf-chip">{platformGlyphs[entry.key] ?? null}<b>{entry.platform}</b></span>
              </span>
              <span className="hx-pf-body">
                <strong className="hx-pf-title">{c[entry.title]}</strong>
                <span className="hx-pf-spec">{c[entry.spec]}</span>
                <span className="hx-pf-desc"><b>{c[entry.descriptionLead]}</b> {c[entry.description]}</span>
                <span className="hx-pf-style">{entry.tags.map((tag) => <span key={tag}>{c[tag]}</span>)}</span>
              </span>
            </>;
            // Clicking a card only selects the platform (driving the action
            // panel below); navigation to the public directory happens from
            // the selected-platform label inside the panel, per platform.
            return <button type="button" className={className} data-hx-select-group="platform" data-hx-select-value={entry.key} data-hx-cta-href={destination(entry.ctaKey)} aria-pressed={index === 0} key={entry.key}>{body}</button>;
          })}
        </div>
        <div className="hx-pf-action">
          {platformsFlow.platforms.map((entry, index) => (
            <div data-hx-panel-group="platform" data-hx-panel-value={entry.key} hidden={index !== 0} key={entry.key}>
              {entry.href
                ? <a className="hx-pf-selected" href={r.href(entry.href)}>{c[platformsFlow.selectedLabel]} <b>{entry.platform}</b></a>
                : <p className="hx-pf-selected">{c[platformsFlow.selectedLabel]} <b>{entry.platform}</b></p>}
              <WorkspaceEntryLink className="hx-button hx-action" data-action-block="reviews" data-home-cta={`pf-${entry.key}`} href={destination(entry.ctaKey)}>{c[platformsFlow.ctaLabel].replace("{platform}", entry.platform)}</WorkspaceEntryLink>
            </div>
          ))}
        </div>
        <p className="hx-note">{c.t017}</p>
      </div>
    </section>
  );
}
