import { Crumbs, Img, PageHero } from "./parts";
import { DirectoryRelatedSection } from "./template-directory";
import type { V2Data, V2Image, V2Resolvers } from "./types";
import styles from "./platform-directory.module.css";

/** One current LivePage owns the copy and links; the browser fetches no data. */
export function PlatformDirectory({ data, r }: { data: V2Data; r: V2Resolvers }) {
  const items = data.items as Array<{ label: string; href: string; text: string; image: V2Image }>;
  return <>
    <Crumbs items={data.breadcrumbs} r={r} />
    <PageHero eyebrow={data.eyebrow} title={data.h1} lead={data.lead} />
    <section className="sec" aria-label={String(data.label)}>
      <div className={`wrap ${styles.grid}`} data-platform-directory="true">
        {items.map(item => <article className={styles.card} key={item.href}>
          <a className={styles.media} href={r.href(item.href)} tabIndex={-1} aria-hidden="true"><Img image={item.image} r={r} /></a>
          <div className={styles.copy}><h2><a className="card-title" href={r.href(item.href)}>{item.label}</a></h2><p>{item.text}</p></div>
        </article>)}
      </div>
    </section>
    <DirectoryRelatedSection data={data} r={r} />
  </>;
}
