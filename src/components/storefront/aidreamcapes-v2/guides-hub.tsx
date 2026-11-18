import type { V2Resolvers } from "./types";
import { Crumbs, RichText } from "./parts";
import { storefrontMeaningfulAlt } from "@/lib/storefront-media-alt";
import styles from "./guides-hub.module.css";

/* Public portal hub for /guides. Ships as complete static HTML from the
   relational row — no client data fetching, no client behavior. Every card
   is a single anchor so the page works without JavaScript. Every section sits
   inside the site content container (`.wrap`, 1240px) so the page aligns with
   the rest of the storefront instead of running to the viewport edges. */

type HubImage = { src: string; alt: string; width: number; height: number };
type HubChapter = { num: string; title: string; note?: string };
type HubRailItem = { num: string; title: string };
type HubHowTo = { href: string; tool: string; minutes: string; title: string; body: string; image: HubImage };
type GuidesHubData = {
  hub: {
    eyebrow?: string;
    h1: string;
    lead?: string;
    meta?: string[];
    workspaceGuide: {
      eyebrow: string;
      title: string;
      lead: string;
      chaptersMini: HubChapter[];
      chaptersMore?: string;
      railPreview: HubRailItem[];
      ctaLabel: string;
      href: string;
    };
    howTos: { title: string; lead?: string; items: HubHowTo[] };
    fieldGuides: { title: string; lead?: string; items: { label: string; href: string }[] };
  };
};

export function isAidreamcapesGuidesHubData(data: unknown): data is GuidesHubData {
  return Boolean(data && typeof data === "object" && !Array.isArray(data) && (data as GuidesHubData).hub);
}

export function GuidesHubPage({ data, r }: { data: GuidesHubData; r: V2Resolvers }) {
  const hub = data.hub;
  const guide = hub.workspaceGuide;
  return (
    <div className={styles.page}>
      <Crumbs items={[{ label: "Home", href: "/" }, { label: "Guides", href: "/guides" }]} r={r} />
      <header className={styles.hero}>
        <div className="wrap">
          <div className={styles.heroInner}>
            {hub.eyebrow ? <p className={styles.eyebrow}>{hub.eyebrow}</p> : null}
            <h1>{hub.h1}</h1>
            {hub.lead ? <p className={styles.lead}>{hub.lead}</p> : null}
            {hub.meta?.length ? (
              <p className={styles.meta}>
                {hub.meta.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <section className={styles.bigSection} aria-label="Workspace guide">
        <div className="wrap">
          <a className={styles.bigCard} href={r.href(guide.href)}>
            <span className={styles.bigPad}>
              <span className={styles.bigEyebrow}>{guide.eyebrow}</span>
              <h2>{guide.title}</h2>
              <span className={styles.bigLead}>{guide.lead}</span>
              <ul className={styles.chaptersMini}>
                {guide.chaptersMini.map((chapter) => (
                  <li key={chapter.num}>
                    <em>{chapter.num}</em>
                    <b>{chapter.title}</b>
                    {chapter.note ? <span className={styles.chapterNote}>{chapter.note}</span> : null}
                  </li>
                ))}
                {guide.chaptersMore ? <li className={styles.chaptersMore}>{guide.chaptersMore}</li> : null}
              </ul>
              <span className={styles.bigCta}>{guide.ctaLabel}</span>
            </span>
            <span className={styles.bigVisual}>
              <span className={styles.stamp}>12 CHAPTERS</span>
              <ul className={styles.railPreview}>
                {guide.railPreview.map((item, index) => (
                  <li key={`${item.num}-${index}`} className={index === 0 ? styles.railHere : undefined}>
                    <em>{item.num}</em> {item.title}
                  </li>
                ))}
              </ul>
            </span>
          </a>
        </div>
      </section>

      <section className={styles.howtos} aria-label="How-to tutorials">
        <div className="wrap">
          <div className={styles.secHead}>
            <h2>{hub.howTos.title}</h2>
            {hub.howTos.lead ? <p>{hub.howTos.lead}</p> : null}
          </div>
          <div className={styles.cards}>
            {hub.howTos.items.map((item) => (
              <a className={styles.card} href={r.href(item.href)} key={item.href}>
                <span className={styles.thumb}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.asset(item.image.src)} alt={storefrontMeaningfulAlt(item.image.alt) || item.title} width={item.image.width} height={item.image.height} loading="lazy" decoding="async" />
                </span>
                <span className={styles.cardPad}>
                  <span className={styles.read}>{item.minutes} read</span>
                  <h3><span className={styles.cardTag}>{item.tool}:</span> {item.title}</h3>
                  <span className={styles.cardBody}><RichText text={item.body} r={r} /></span>
                  <span className={styles.go}>Read the tutorial →</span>
                </span>
              </a>
            ))}
          </div>
          <div className={styles.fieldGuides}>
            <h2>{hub.fieldGuides.title}</h2>
            {hub.fieldGuides.lead ? <p>{hub.fieldGuides.lead}</p> : null}
            <ul className={styles.fieldList}>
              {hub.fieldGuides.items.map((item) => (
                <li key={item.href}>
                  <a href={r.href(item.href)}>{item.label}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
