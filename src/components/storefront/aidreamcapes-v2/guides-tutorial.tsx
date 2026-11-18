import { Fragment } from "react";
import type { V2Resolvers } from "./types";
import { RichText } from "./parts";
import { storefrontMeaningfulAlt } from "@/lib/storefront-media-alt";
import styles from "./guides-tutorial.module.css";

/* Public workspace tutorial for /guides. Ships as complete static HTML from
   the relational row — no client data fetching, no client behavior. The
   chapter rail is plain anchor links so the page works without JavaScript.
   Inline copy may use `backticks` around UI labels, **bold** emphasis and
   [text](/link) markdown; RichText renders all three inline. */

type GuideStep = { title: string; body: string };
type GuideMedia = { src: string; alt: string; width: number; height: number; gif?: boolean; video?: boolean; poster?: string; caption?: string };
type GuideChapter = {
  id: string;
  num: string;
  title: string;
  route?: string;
  what?: string;
  steps: GuideStep[];
  media?: GuideMedia[];
  tip?: { title: string; body: string };
};
type GuideData = {
  guide: {
    eyebrow?: string;
    h1: string;
    lead?: string;
    meta?: string[];
    paths?: { label: string; title: string; body: string; chapters?: string[] }[];
    concepts?: { title: string; body: string }[];
    chapters?: GuideChapter[];
    moreGuides?: { title: string; lead?: string; items: { label: string; href: string; note?: string }[] };
  };
};

export function isAidreamcapesGuidesSectionData(data: unknown): data is GuideData {
  return Boolean(data && typeof data === "object" && !Array.isArray(data) && (data as GuideData).guide);
}

export function GuidesTutorialPage({ data, r }: { data: GuideData; r: V2Resolvers }) {
  const guide = data.guide;
  const chapters = guide.chapters ?? [];
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        {guide.eyebrow ? <p className={styles.eyebrow}>{guide.eyebrow}</p> : null}
        <h1>{guide.h1}</h1>
        {guide.lead ? <p className={styles.lead}>{guide.lead}</p> : null}
        {guide.meta?.length ? (
          <p className={styles.meta}>
            {guide.meta.map((item, index) => (
              <span key={index}>{item}</span>
            ))}
          </p>
        ) : null}
      </header>

      <div className={styles.layout}>
        <nav aria-label="Chapters" className={styles.rail}>
          <p className={styles.railTitle}>Chapters</p>
          <ol className={styles.railList}>
            {chapters.map((chapter) => (
              <li key={chapter.id}>
                <a href={`#${chapter.id}`}>
                  <em>{chapter.num}</em> {chapter.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className={styles.main}>
          {guide.paths?.length ? (
            <section className={styles.paths} aria-label="Learning paths">
              <h2 className={styles.sectionTitle}>Pick a path, follow the chapters.</h2>
              <p className={styles.sectionLead}>Most people don&apos;t need all twelve chapters. Three curated paths chain the chapters into the three things the workspace is actually used for.</p>
              <div className={styles.pathGrid}>
                {guide.paths.map((path) => (
                  <div className={styles.pathCard} key={path.title}>
                    <p className={styles.pathLabel}>{path.label}</p>
                    <h3>{path.title}</h3>
                    <p className={styles.pathBody}>{path.body}</p>
                    {path.chapters?.length ? (
                      <p className={styles.pathChapters}>
                        {path.chapters.map((num, index) => (
                          <Fragment key={num}>
                            {index > 0 ? <span aria-hidden="true">→</span> : null}
                            <b>{num}</b>
                          </Fragment>
                        ))}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {guide.concepts?.length ? (
            <section className={styles.concepts} aria-label="Core concepts">
              <h2 className={styles.sectionTitle}>Three ideas that explain every screen.</h2>
              <div className={styles.conceptGrid}>
                {guide.concepts.map((concept) => (
                  <div className={styles.conceptCard} key={concept.title}>
                    <h3>{concept.title}</h3>
                    <p><RichText text={concept.body} r={r} /></p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {chapters.map((chapter) => (
            <section className={styles.chapter} id={chapter.id} key={chapter.id} aria-label={chapter.title}>
              <div className={styles.chapterHead}>
                <span className={styles.chapterNum}>{chapter.num}</span>
                <div>
                  <h2>{chapter.title}</h2>
                  {chapter.route ? <p className={styles.chapterRoute}><RichText text={chapter.route} r={r} /></p> : null}
                  {chapter.what ? <p className={styles.chapterWhat}><RichText text={chapter.what} r={r} /></p> : null}
                </div>
              </div>
              <ol className={styles.steps}>
                {chapter.steps.map((step) => (
                  <li key={step.title}>
                    <h3>{step.title}</h3>
                    <p><RichText text={step.body} r={r} /></p>
                  </li>
                ))}
              </ol>
              {chapter.media?.length ? (
                <div className={styles.media}>
                  {chapter.media.map((item) => (
                    <figure className={styles.figure} key={item.src}>
                      {item.video ? (
                        <video
                          className={styles.video}
                          controls
                          muted
                          playsInline
                          preload="metadata"
                          poster={item.poster}
                          src={item.src}
                        />
                      ) : (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={item.src}
                          alt={storefrontMeaningfulAlt(item.alt) || item.caption || chapter.title}
                          width={item.width}
                          height={item.height}
                          loading="lazy"
                          decoding="async"
                          data-motion={item.gif ? "gif" : undefined}
                        />
                      )}
                      {item.caption ? <figcaption className={styles.caption}>{item.caption}</figcaption> : null}
                    </figure>
                  ))}
                </div>
              ) : null}
              {chapter.tip ? (
                <p className={styles.tip}>
                  <b>{chapter.tip.title}</b> <RichText text={chapter.tip.body} r={r} />
                </p>
              ) : null}
            </section>
          ))}

          {guide.moreGuides?.items?.length ? (
            <section className={styles.more} aria-label={guide.moreGuides.title}>
              <h2 className={styles.sectionTitle}>{guide.moreGuides.title}</h2>
              {guide.moreGuides.lead ? <p className={styles.sectionLead}>{guide.moreGuides.lead}</p> : null}
              <ul className={styles.moreList}>
                {guide.moreGuides.items.map((item) => (
                  <li key={item.href}>
                    <a href={r.href(item.href)}>{item.label}</a>
                    {item.note ? <span>{item.note}</span> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
