import type { AidreamcapesV2Navigation } from "@/lib/types";
import { StorefrontJsonLd } from "@/components/storefront/storefront-json-ld";
import { WorkspaceEntryLink } from "@/components/aidreamcapes-workspace/entry-link";
import { WorkspaceEntryBehavior } from "@/components/aidreamcapes-workspace/entry-behavior";
import type { MediaDetail } from "@/lib/aidreamcapes-workspace/media-detail.server";
import type { MediaPlacementGroup } from "@/lib/aidreamcapes-workspace/media-placement";
import {
  MEDIA_DETAIL_PUBLIC_ORIGIN,
  mediaDetailCrumbs,
  mediaDetailIntro
} from "@/lib/aidreamcapes-workspace/media-detail";
import type { V2Resolvers } from "./types";
import type { V2Company } from "./company";
import type { AidreamcapesFooterArticle } from "./latest-articles";
import { AidreamcapesV2Shell } from "./shell";

// Public media detail page. Complete server-rendered HTML: the card, its media,
// the owning directory and the single workspace call to action. No client data
// fetching and no workspace chrome.

function MediaFigure({ detail, r }: { detail: MediaDetail; r: V2Resolvers }) {
  const { card } = detail;
  if (card.video) {
    return (
      <figure className="v-detail-media">
        <video
          aria-label={card.label}
          autoPlay
          controls
          height={card.video.height}
          loop
          muted
          playsInline
          poster={card.video.poster ? r.asset(card.video.poster.src) : undefined}
          preload="metadata"
          src={r.asset(card.video.src)}
          width={card.video.width}
        />
      </figure>
    );
  }
  return (
    <figure className="v-detail-media">
      <img
        alt={card.image.alt || card.label}
        decoding="async"
        height={card.image.h}
        loading="eager"
        src={r.asset(card.image.src)}
        width={card.image.w}
      />
    </figure>
  );
}

function RelatedGrid({ detail, r }: { detail: MediaDetail; r: V2Resolvers }) {
  if (!detail.related.length) return null;
  return (
    <section className="sec" id="related">
      <div className="wrap">
        <div className="sec-head">
          <div className="eyebrow">More like this</div>
          <h2>{detail.kind === "photo" ? "More photo templates" : "More video templates"}</h2>
        </div>
        <div className="tgrid">
          {detail.related.map((item) => (
            <article className="tc" key={item.href}>
              <div className="ti">
                <img alt={item.image.alt || item.label} decoding="async" loading="lazy" src={r.asset(item.image.src)} />
              </div>
              <div className="tb">
                <h3><a className="card-title" href={r.href(item.href)}>{item.label}</a></h3>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function AidreamcapesMediaDetailPage({ detail, navigation, r, company, articles, articlesTitle, placements = [] }: {
  detail: MediaDetail;
  navigation: AidreamcapesV2Navigation;
  r: V2Resolvers;
  company?: V2Company;
  articles?: AidreamcapesFooterArticle[];
  articlesTitle?: string;
  placements?: MediaPlacementGroup[];
}) {
  const { card } = detail;
  const intro = mediaDetailIntro(card);
  const crumbs = mediaDetailCrumbs(card);
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "BreadcrumbList", itemListElement: crumbs.map((crumb, index) => ({
        "@type": "ListItem", position: index + 1, name: crumb.label,
        item: new URL(crumb.href || detail.path, MEDIA_DETAIL_PUBLIC_ORIGIN).href,
      })) },
      { "@type": "ImageObject", name: card.label, contentUrl: new URL(card.image.src, MEDIA_DETAIL_PUBLIC_ORIGIN).href,
        url: `${MEDIA_DETAIL_PUBLIC_ORIGIN}${detail.path}` },
    ],
  };
  const specs = [
    card.aspect ? { label: "Format", value: card.aspect } : undefined,
    card.duration ? { label: "Length", value: `${card.duration}s` } : undefined,
    card.tool ? { label: "Tool", value: card.tool.replace(/-/g, " ") } : undefined,
  ].filter((item): item is { label: string; value: string } => Boolean(item));

  return (
    <AidreamcapesV2Shell articles={articles} articlesTitle={articlesTitle} company={company} mainId="media-detail" navigation={navigation} r={r}>
      <WorkspaceEntryBehavior />
      <StorefrontJsonLd nodes={[graph]} preserveBodyMarker />
      <style dangerouslySetInnerHTML={{ __html: `
#media-detail .v-detail{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);gap:44px;align-items:start;padding:24px 0 8px}
#media-detail .v-detail-media{margin:0;border-radius:18px;overflow:hidden;background:#0d1220;box-shadow:0 18px 60px rgba(10,16,32,.18)}
#media-detail .v-detail-media img,#media-detail .v-detail-media video{display:block;width:100%;height:auto}
#media-detail .v-detail h1{font-size:clamp(1.7rem,2.6vw,2.5rem);line-height:1.15;margin:0 0 14px}
#media-detail .v-detail-lead{font-size:1.03rem;line-height:1.6;margin:0 0 22px;opacity:.85}
#media-detail .v-detail-specs{display:flex;flex-wrap:wrap;gap:10px 26px;margin:0 0 26px;padding:0;list-style:none}
#media-detail .v-detail-specs dt{font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;opacity:.6}
#media-detail .v-detail-specs dd{margin:2px 0 0;font-weight:600}
#media-detail .v-detail-actions{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
#media-detail .v-detail-note{margin:14px 0 0;font-size:.86rem;opacity:.65}
#media-detail .v-detail-categories{margin:0 0 26px;padding-top:18px;border-top:1px solid var(--line)}
#media-detail .v-detail-categories dl{display:grid;gap:10px;margin:10px 0 0}
#media-detail .v-detail-categories dl>div{display:grid;grid-template-columns:92px minmax(0,1fr);gap:12px;align-items:start}
#media-detail .v-detail-categories dt{padding-top:6px;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;opacity:.6}
#media-detail .v-detail-categories dd{display:flex;flex-wrap:wrap;gap:8px;margin:0}
#media-detail .v-detail-categories .chip:hover{border-color:var(--line-2);color:var(--ink)}
#media-detail .v-crumbs{display:flex;flex-wrap:wrap;gap:6px;font-size:.85rem;opacity:.75;padding-top:8px}
#media-detail .v-crumbs a{text-decoration:underline;text-underline-offset:3px}
@media(max-width:880px){#media-detail .v-detail{grid-template-columns:minmax(0,1fr);gap:26px}}
@media(max-width:520px){#media-detail .v-detail-categories dl>div{grid-template-columns:1fr;gap:4px}#media-detail .v-detail-categories dt{padding-top:0}}
      ` }} />
      <div className="wrap">
        <nav aria-label="Breadcrumb" className="v-crumbs">
          {crumbs.map((crumb, index) => (
            <span key={`${crumb.label}-${index}`}>
              {index > 0 ? <span aria-hidden="true"> / </span> : null}
              {crumb.href ? <a href={r.href(crumb.href)}>{crumb.label}</a> : <span aria-current="page">{crumb.label}</span>}
            </span>
          ))}
        </nav>
        <div className="v-detail">
          <MediaFigure detail={detail} r={r} />
          <div>
            <div className="eyebrow">{detail.ownerLabel || (detail.kind === "photo" ? "Photo template" : "Video template")}</div>
            <h1>{card.label}</h1>
            {intro ? <p className="v-detail-lead">{intro}</p> : null}
            {specs.length ? (
              <dl className="v-detail-specs">
                {specs.map((spec) => (
                  <div key={spec.label}>
                    <dt>{spec.label}</dt>
                    <dd>{spec.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {placements.length ? (
              <nav aria-label="Browse by category" className="v-detail-categories" data-media-categories="true">
                <div className="eyebrow">Browse by category</div>
                <dl>
                  {placements.map((group) => (
                    <div key={group.kind}>
                      <dt>{group.label}</dt>
                      <dd>
                        {group.links.map((link) => (
                          <a className="chip" href={r.href(link.href)} key={link.href}>{link.label}</a>
                        ))}
                      </dd>
                    </div>
                  ))}
                </dl>
              </nav>
            ) : null}
            <div className="v-detail-actions">
              <WorkspaceEntryLink className="btn btn-grad" entry={detail.cta.entry} href={r.href(detail.cta.href)}>
                {`${detail.kind === "photo" ? "Use this template" : "Make a video like this"} →`}
              </WorkspaceEntryLink>
              <a className="btn" href={r.href(detail.ownerPath)}>Browse the full directory</a>
            </div>
            <p className="v-detail-note">{detail.kind === "photo"
              ? "Opens the workspace with this template already selected. You can change the product and format."
              : "Opens the workspace with this template already selected. You can change the product, format and length."}</p>
          </div>
        </div>
      </div>
      <RelatedGrid detail={detail} r={r} />
    </AidreamcapesV2Shell>
  );
}
