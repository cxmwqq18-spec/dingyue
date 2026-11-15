import type { V2Resolvers } from "./types";
import styles from "./guides-howto.module.css";

/* Public how-to tutorial pages under /guides/how-do-*. Ships as complete
   static HTML from the relational row — no client data fetching, no client
   behavior. One skeleton for every tool: Hero → Demo + Steps → Tip → FAQ →
   Related. Demo blocks are optional and render in a fixed order; `result`
   puts a finished-clip column next to the demo visuals, otherwise the steps
   sit next to them. */

type HowtoImage = { src: string; alt: string; width: number; height: number };
type DemoFrame = { tag?: string; image?: HowtoImage; video?: { src: string; poster?: string } };
type DemoUrlCard = { label: string; action?: string; status?: string; ok?: boolean; caption?: { text: string; badge?: string } };
type DemoPanel = { tabs?: string[]; activeTab?: number; input?: string; chips?: string[] };
type DemoListItem = { image: HowtoImage; title: string; sub: string; action?: string; primary?: boolean };
type DemoGalleryItem = { image: HowtoImage; caption?: string; ok?: boolean };
type DemoSubtitles = { label: string; video: { src: string; poster?: string }; lines: string[] };
type Demo = {
  title: string;
  lead?: string;
  urlCard?: DemoUrlCard;
  panel?: DemoPanel;
  list?: DemoListItem[];
  gallery?: DemoGalleryItem[];
  frames?: DemoFrame[];
  subtitles?: { before: DemoSubtitles; after: DemoSubtitles; chips?: string[] };
  prompt?: string;
  result?: { frames: DemoFrame[]; prompt?: string };
};
type HowtoData = {
  howto: {
    eyebrow?: string;
    h1: string;
    lead?: string;
    meta?: string[];
    demo?: Demo;
    stepsIntro?: { title: string; lead?: string };
    steps: { title: string; body: string }[];
    tip?: { title: string; body: string };
    faq: { q: string; a: string }[];
    related: { kind: string; label: string; text: string; href: string }[];
  };
};

export function isAidreamcapesGuidesHowtoData(data: unknown): data is HowtoData {
  return Boolean(data && typeof data === "object" && !Array.isArray(data) && (data as HowtoData).howto);
}

function Frames({ frames }: { frames: DemoFrame[] }) {
  return (
    <div className={styles.media}>
      {frames.map((frame, index) => (
        <span key={index} className={styles.mediaRow}>
          {index > 0 ? <span className={styles.transform} aria-hidden="true">→</span> : null}
          <span className={styles.frame}>
            {frame.tag ? <span className={styles.frameTag}>{frame.tag}</span> : null}
            {frame.video ? (
              <video controls muted playsInline preload="metadata" poster={frame.video.poster} src={frame.video.src} />
            ) : frame.image ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={frame.image.src} alt={frame.image.alt} width={frame.image.width} height={frame.image.height} loading="lazy" decoding="async" />
            ) : null}
          </span>
        </span>
      ))}
    </div>
  );
}

function DemoVisuals({ demo }: { demo: Demo }) {
  return (
    <div>
      <h3>{demo.title}</h3>
      {demo.lead ? <p className={styles.demoLead}>{demo.lead}</p> : null}
      {demo.urlCard ? (
        <div className={styles.urlCard}>
          <span className={styles.urlField}>{demo.urlCard.label}</span>
          {demo.urlCard.action ? <span className={styles.urlAction}>{demo.urlCard.action}</span> : null}
        </div>
      ) : null}
      {demo.urlCard?.status ? (
        <div className={styles.import}>
          <p className={styles.importStatus}>
            <i>{demo.urlCard.ok === false ? "!" : "✓"}</i>
            {demo.urlCard.status}
          </p>
          {demo.urlCard.caption ? (
            <p className={styles.importCaption}>
              {demo.urlCard.caption.text}
              {demo.urlCard.caption.badge ? <em>{demo.urlCard.caption.badge}</em> : null}
            </p>
          ) : null}
        </div>
      ) : null}
      {demo.panel ? (
        <div className={styles.panel}>
          {demo.panel.tabs?.length ? (
            <div className={styles.tabs}>
              {demo.panel.tabs.map((tab, index) => (
                <span key={tab} className={index === (demo.panel?.activeTab ?? 0) ? styles.tabOn : undefined}>{tab}</span>
              ))}
            </div>
          ) : null}
          {demo.panel.input ? <div className={styles.input}>{demo.panel.input}</div> : null}
          {demo.panel.chips?.length ? (
            <div className={styles.chips}>
              {demo.panel.chips.map((chip) => (
                <span key={chip}>{chip}</span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {demo.list?.length ? (
        <ul className={styles.list}>
          {demo.list.map((item) => (
            <li key={item.title} className={item.primary ? styles.listPrimary : undefined}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.image.src} alt={item.image.alt} width={item.image.width} height={item.image.height} loading="lazy" decoding="async" />
              <span className={styles.listText}>
                <b>{item.title}</b>
                <span className={styles.listSub}>{item.sub}</span>
              </span>
              {item.action ? <span className={styles.listAction}>{item.action}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {demo.gallery?.length ? (
        <div className={styles.gallery}>
          {demo.gallery.map((item) => (
            <figure key={item.image.src + (item.caption ?? "")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.image.src} alt={item.image.alt} width={item.image.width} height={item.image.height} loading="lazy" decoding="async" />
              {item.ok ? <span className={styles.galleryOk} aria-hidden="true">✓</span> : null}
              {item.caption ? <figcaption>{item.caption}</figcaption> : null}
            </figure>
          ))}
        </div>
      ) : null}
      {demo.frames?.length ? <Frames frames={demo.frames} /> : null}
      {demo.subtitles ? (
        <>
          <div className={styles.subRow}>
            {[demo.subtitles.before, demo.subtitles.after].map((side) => (
              <div className={styles.subCard} key={side.label}>
                <video controls muted playsInline preload="metadata" poster={side.video.poster} src={side.video.src} />
                <div className={styles.subBar}>
                  <b>{side.label}</b>
                  {side.lines.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {demo.subtitles.chips?.length ? (
            <div className={styles.chips}>
              {demo.subtitles.chips.map((chip) => (
                <span key={chip}>{chip}</span>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
      {demo.prompt ? <div className={styles.prompt}>{demo.prompt}</div> : null}
    </div>
  );
}

function Steps({ steps }: { steps: { title: string; body: string }[] }) {
  return (
    <ol className={styles.steps}>
      {steps.map((step) => (
        <li key={step.title}>
          <h3>{step.title}</h3>
          <p>{step.body}</p>
        </li>
      ))}
    </ol>
  );
}

export function GuidesHowtoPage({ data, r }: { data: HowtoData; r: V2Resolvers }) {
  const howto = data.howto;
  const demo = howto.demo;
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        {howto.eyebrow ? <p className={styles.eyebrow}>{howto.eyebrow}</p> : null}
        <h1>{howto.h1}</h1>
        {howto.lead ? <p className={styles.lead}>{howto.lead}</p> : null}
        {howto.meta?.length ? (
          <p className={styles.meta}>
            {howto.meta.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </p>
        ) : null}
      </header>

      {demo ? (
        <section className={styles.demo} aria-label={demo.title}>
          <DemoVisuals demo={demo} />
          {demo.result ? (
            <div className={styles.result}>
              <Frames frames={demo.result.frames} />
              {demo.result.prompt ? <div className={styles.prompt}>{demo.result.prompt}</div> : null}
            </div>
          ) : (
            <div>
              <p className={styles.tutorialTitle}>In this tutorial</p>
              <Steps steps={howto.steps} />
            </div>
          )}
        </section>
      ) : null}

      {demo?.result || !demo ? (
        <section className={demo ? styles.stepsSectionNarrow : styles.stepsSection} aria-label="In this tutorial">
          {howto.stepsIntro ? (
            <div className={styles.secHead}>
              <h2>{howto.stepsIntro.title}</h2>
              {howto.stepsIntro.lead ? <p>{howto.stepsIntro.lead}</p> : null}
            </div>
          ) : null}
          <Steps steps={howto.steps} />
        </section>
      ) : null}

      {howto.tip ? (
        <section className={styles.tipSection}>
          <p className={styles.tip}>
            <b>{howto.tip.title}</b> {howto.tip.body}
          </p>
        </section>
      ) : null}

      {howto.faq.length ? (
        <section className={styles.faqSection} aria-label="Frequently asked questions">
          <div className={styles.secHead}>
            <h2>Questions people ask first.</h2>
          </div>
          <div className={styles.faq}>
            {howto.faq.map((item, index) => (
              <details key={item.q} open={index === 0}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      {howto.related.length ? (
        <section className={styles.relatedSection} aria-label="Related guides">
          <div className={styles.secHead}>
            <h2>Keep going.</h2>
            <p>Same flow, other starting points — or go back to the full workspace guide.</p>
          </div>
          <div className={styles.rel}>
            {howto.related.map((item) => (
              <a href={r.href(item.href)} key={item.href}>
                <span className={styles.relKind}>{item.kind}</span>
                <h3>{item.label}</h3>
                <span>{item.text}</span>
              </a>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
