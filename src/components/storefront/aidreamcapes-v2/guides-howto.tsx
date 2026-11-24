import type { V2Resolvers } from "./types";
import { BRAND_NAME, Crumbs, CtaBand, Faq, Img, RichText } from "./parts";
import { GuidesSubtitleCompare } from "./guides-subtitle-comparison";
import { SeoPosterVideo } from "./seo-poster-video";
import { storefrontMeaningfulAlt } from "@/lib/storefront-media-alt";
import styles from "./guides-howto.module.css";

/* Public how-to tutorial pages under /guides/how-do-*. Content ships from the
   relational row with no client data fetching. The subtitle comparison adds
   only local player synchronization. The page is a single-column article,
   rendered with the same shell
   classes as /blog/* detail pages (`.ahero` hero, `.wrap prose` body,
   `.article-section-media` figures, `.trybox`, `.check`, `.related`), so the
   reading width, type scale and rhythm match the rest of the site. Visual
   examples sit inline inside the prose column — never beside it. */

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
type SectionMedia = {
  image?: HowtoImage;
  video?: { src: string; poster?: string };
  caption?: string;
};
type InfoCard = {
  tag?: string;
  title: string;
  body: string;
  meta?: string;
  image?: HowtoImage;
  href?: string;
};
type FlowItem = { number?: string; title: string; body: string; note?: string };
type InfoPanel = { title?: string; kicker?: string; rows: { label: string; value: string }[]; foot?: string };
type HowtoSection = {
  h2: string;
  paras?: string[];
  media?: SectionMedia;
  cards?: InfoCard[];
  flow?: { title?: string; lead?: string; items: FlowItem[] };
  panel?: InfoPanel;
  steps?: { title: string; body: string }[];
  bullets?: string[];
  checklist?: string[];
  note?: { title: string; body: string };
};
type HowtoData = {
  howto: {
    eyebrow?: string;
    h1: string;
    subtitle?: string;
    lead?: string;
    tool?: string;
    minutes?: number;
    meta?: string[];
    image?: HowtoImage;
    intro?: string[];
    demo?: Demo;
    sections?: HowtoSection[];
    steps: { title: string; body: string }[];
    stepsIntro?: { title: string; lead?: string };
    tip?: { title: string; body: string };
    checklist?: string[];
    faq: { q: string; a: string }[];
    related: { kind?: string; label: string; text: string; href: string }[];
    toolCta?: { label: string; href: string };
    cta?: { title?: string; lead?: string; note?: string; href?: string };
  };
};

export function isAidreamcapesGuidesHowtoData(data: unknown): data is HowtoData {
  return Boolean(data && typeof data === "object" && !Array.isArray(data) && (data as HowtoData).howto);
}

function cleanTitle(value: string) {
  return value.replace(/\s*→\s*$/, "");
}

// Weak or production-facing alt copy degrades to caller context or an empty
// decorative alt, never to junk copy.
function guideAlt(value: string | undefined, fallback: string): string {
  return storefrontMeaningfulAlt(value) || fallback;
}

function Frames({ frames, r }: { frames: DemoFrame[]; r: V2Resolvers }) {
  return (
    <div className={styles.media}>
      {frames.map((frame, index) => (
        <span key={index} className={styles.mediaRow}>
          {index > 0 ? <span className={styles.transform} aria-hidden="true">→</span> : null}
          <span className={styles.frame}>
            {frame.tag ? <span className={styles.frameTag}>{frame.tag}</span> : null}
            {frame.video ? (
              <SeoPosterVideo alt={guideAlt(frame.image?.alt, frame.tag ?? "Guide example")} poster={frame.video.poster ? r.asset(frame.video.poster) : undefined} src={r.asset(frame.video.src)} />
            ) : frame.image ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={r.asset(frame.image.src)} alt={guideAlt(frame.image.alt, frame.tag ?? "")} width={frame.image.width} height={frame.image.height} loading="lazy" decoding="async" />
            ) : null}
          </span>
        </span>
      ))}
    </div>
  );
}

function DemoVisuals({ demo, r }: { demo: Demo; r: V2Resolvers }) {
  return (
    <div className={styles.demo}>
      <h2>{cleanTitle(demo.title)}</h2>
      {demo.lead ? <p>{demo.lead}</p> : null}
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
              <img src={r.asset(item.image.src)} alt={guideAlt(item.image.alt, item.title)} width={item.image.width} height={item.image.height} loading="lazy" decoding="async" />
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
              <img src={r.asset(item.image.src)} alt={guideAlt(item.image.alt, item.caption ?? demo.title)} width={item.image.width} height={item.image.height} loading="lazy" decoding="async" />
              {item.ok ? <span className={styles.galleryOk} aria-hidden="true">✓</span> : null}
              {item.caption ? <figcaption>{item.caption}</figcaption> : null}
            </figure>
          ))}
        </div>
      ) : null}
      {demo.frames?.length ? <Frames frames={demo.frames} r={r} /> : null}
      {demo.subtitles ? (
        <GuidesSubtitleCompare
          before={{ ...demo.subtitles.before, video: {
            src: r.asset(demo.subtitles.before.video.src),
            poster: demo.subtitles.before.video.poster ? r.asset(demo.subtitles.before.video.poster) : undefined,
          } }}
          after={{ ...demo.subtitles.after, video: {
            src: r.asset(demo.subtitles.after.video.src),
            poster: demo.subtitles.after.video.poster ? r.asset(demo.subtitles.after.video.poster) : undefined,
          } }}
          chips={demo.subtitles.chips}
          classNames={{ row: styles.subRow, card: styles.subCard, bar: styles.subBar, chips: styles.chips }}
        />
      ) : null}
      {demo.prompt ? <div className={styles.prompt}>{demo.prompt}</div> : null}
      {demo.result ? (
        <>
          <Frames frames={demo.result.frames} r={r} />
          {demo.result.prompt ? <blockquote className={styles.quote}><RichText r={r} text={demo.result.prompt} /></blockquote> : null}
        </>
      ) : null}
    </div>
  );
}

function Steps({ steps, r, className }: { steps: { title: string; body: string }[]; r: V2Resolvers; className?: string }) {
  return (
    <ol className={className ?? styles.steps}>
      {steps.map((step) => (
        <li key={step.title}>
          <h3>{step.title}</h3>
          <p><RichText r={r} text={step.body} /></p>
        </li>
      ))}
    </ol>
  );
}

function ReferenceCards({ cards, r }: { cards: InfoCard[]; r: V2Resolvers }) {
  const withMedia = cards.every((card) => Boolean(card.image));
  return (
    <div className={`${styles.cards} ${withMedia ? styles.cardsMedia : ""}`.trim()}>
      {cards.map((card) => (
        <article key={card.title}>
          {card.image ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={r.asset(card.image.src)} alt={guideAlt(card.image.alt, card.title)} width={card.image.width} height={card.image.height} loading="lazy" decoding="async" />
          ) : null}
          {card.tag ? <span className={styles.cardTag}>{card.tag}</span> : null}
          <b className={styles.cardTitle}>{card.title}</b>
          <span className={styles.cardBody}><RichText r={r} text={card.body} /></span>
          {card.meta ? <span className={styles.cardMeta}>{card.meta}</span> : null}
          {card.href ? (
            <a className={styles.cardLink} href={r.href(card.href)}>
              Read more →
            </a>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function ReferenceFlow({ flow, r }: { flow: { title?: string; lead?: string; items: FlowItem[] }; r: V2Resolvers }) {
  return (
    <div className={styles.flowBlock}>
      {flow.title ? <p className={styles.flowTitle}>{flow.title}</p> : null}
      {flow.lead ? <p className={styles.flowLead}>{flow.lead}</p> : null}
      <ol className={styles.flow}>
        {flow.items.map((item, index) => (
          <li key={item.title}>
            <span className={styles.flowNum}>{item.number ?? `0${index + 1}`}</span>
            <b>{item.title}</b>
            <span className={styles.flowBody}><RichText r={r} text={item.body} /></span>
            {item.note ? <em className={styles.flowNote}>{item.note}</em> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

function ReferencePanel({ panel }: { panel: InfoPanel }) {
  return (
    <aside className={styles.panelBox}>
      {panel.kicker ? <p className={styles.panelKicker}>{panel.kicker}</p> : null}
      {panel.title ? <p className={styles.panelTitle}>{panel.title}</p> : null}
      <dl className={styles.panelRows}>
        {panel.rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      {panel.foot ? <p className={styles.panelFoot}>{panel.foot}</p> : null}
    </aside>
  );
}

function SectionMediaFigure({ media, r }: { media: SectionMedia; r: V2Resolvers }) {
  if (media.video) {
    return (
      <figure className={styles.videoFig}>
        <SeoPosterVideo alt={media.caption ?? "Guide example"} poster={media.video.poster ? r.asset(media.video.poster) : undefined} src={r.asset(media.video.src)} />
        {media.caption ? <figcaption className={styles.caption}>{media.caption}</figcaption> : null}
      </figure>
    );
  }
  if (media.image) {
    return (
      <figure className="article-section-media">
        <Img image={media.image} r={r} fallbackAlt={media.caption} />
        {media.caption ? <figcaption className={styles.caption}>{media.caption}</figcaption> : null}
      </figure>
    );
  }
  return null;
}

export function GuidesHowtoPage({ data, r }: { data: HowtoData; r: V2Resolvers }) {
  const howto = data.howto;
  const guideLabel = howto.tool ?? howto.eyebrow?.replace(/^How-to\s*·\s*/, "") ?? "Guides";
  const crumbs = [
    { label: "Home", href: "/" },
    { label: "Guides", href: "/guides" },
    { label: guideLabel, href: "/guides" }
  ];
  return (
    <>
      <article>
        <div className={styles.crumbsCenter}>
          <Crumbs items={crumbs} r={r} />
        </div>
        <section className="ahero">
          <div className={`wrap ${styles.headerCenter}`}>
            {howto.eyebrow ? <div className="eyebrow">{howto.eyebrow}</div> : null}
            <h1>{howto.h1}</h1>
            {howto.subtitle ? <h2 className={styles.subtitle}>{howto.subtitle}</h2> : null}
            {howto.lead ? <p className="lead">{howto.lead}</p> : null}
            <p className="meta-line">{howto.minutes ? `${howto.minutes} min read · ${BRAND_NAME}` : BRAND_NAME}</p>
            {howto.meta?.length ? (
              <p className={styles.meta}>
                {howto.meta.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </p>
            ) : null}
            {howto.toolCta?.label && howto.toolCta.href ? (
              <p className={styles.toolCta}><a href={r.href(howto.toolCta.href)}>{howto.toolCta.label} →</a></p>
            ) : null}
          </div>
        </section>

        {howto.image ? (
          <div className="wrap">
            <figure className={styles.heroFigure}>
              <Img eager image={howto.image} r={r} fallbackAlt={howto.h1} />
            </figure>
          </div>
        ) : null}

        <div className="wrap prose" style={{ paddingBottom: 40 }}>
          {howto.intro?.map((para, index) => (
            <p key={index}><RichText r={r} text={para} /></p>
          ))}

          {howto.demo ? <DemoVisuals demo={howto.demo} r={r} /> : null}

          {howto.sections?.map((section) => (
            <div key={section.h2}>
              <h2>{section.h2}</h2>
              {section.paras?.map((para, index) => (
                <p key={index}><RichText r={r} text={para} /></p>
              ))}
              {section.media ? <SectionMediaFigure media={section.media} r={r} /> : null}
              {section.cards?.length ? <ReferenceCards cards={section.cards} r={r} /> : null}
              {section.flow?.items?.length ? <ReferenceFlow flow={section.flow} r={r} /> : null}
              {section.panel ? <ReferencePanel panel={section.panel} /> : null}
              {section.bullets?.length ? (
                <ul>
                  {section.bullets.map((item) => <li key={item}><RichText r={r} text={item} /></li>)}
                </ul>
              ) : null}
              {section.steps?.length ? <Steps steps={section.steps} r={r} /> : null}
              {section.checklist?.length ? (
                <ul className="check">
                  {section.checklist.map((item) => <li key={item}><RichText r={r} text={item} /></li>)}
                </ul>
              ) : null}
              {section.note ? (
                <aside className="tip"><b>{section.note.title}</b> <RichText r={r} text={section.note.body} /></aside>
              ) : null}
            </div>
          ))}

          <div>
            <h2>{howto.stepsIntro?.title ?? "Step by step"}</h2>
            {howto.stepsIntro?.lead ? <p><RichText r={r} text={howto.stepsIntro.lead} /></p> : null}
            <Steps steps={howto.steps} r={r} />
          </div>

          {howto.tip ? (
            <aside className="tip"><b>{howto.tip.title}</b> <RichText r={r} text={howto.tip.body} /></aside>
          ) : null}

          {howto.checklist?.length ? (
            <>
              <h2>Checklist</h2>
              <ul className="check">
                {howto.checklist.map((item) => <li key={item}><RichText r={r} text={item} /></li>)}
              </ul>
            </>
          ) : null}

          {howto.related.length ? (
            <>
              <h2>Related</h2>
              <div className="related">
                {howto.related.map((item) => (
                  <article className="related-card" key={item.href}>
                    <b><a className="card-title" href={r.href(item.href)}>{item.label}</a></b>
                    <span>{item.text}</span>
                    {item.kind ? <small>{item.kind}</small> : null}
                  </article>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </article>

      <Faq items={howto.faq} title="Questions" r={r} />
      <CtaBand
        href={howto.cta?.href ?? "/app/create"}
        lead={howto.cta?.lead ?? "Upload a product photo, see the price before you start, and keep every version in your library."}
        note={howto.cta?.note}
        r={r}
        secondary={false}
        title={howto.cta?.title ?? `Try ${guideLabel} with your own product`}
      />
    </>
  );
}
