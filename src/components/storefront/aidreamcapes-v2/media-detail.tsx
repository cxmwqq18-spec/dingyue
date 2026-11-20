import type { AidreamcapesV2Navigation } from "@/lib/types";
import { StorefrontJsonLd } from "@/components/storefront/storefront-json-ld";
import { WorkspaceEntryLink } from "@/components/aidreamcapes-workspace/entry-link";
import { WorkspaceEntryBehavior } from "@/components/aidreamcapes-workspace/entry-behavior";
import type { MediaDetail } from "@/lib/aidreamcapes-workspace/media-detail.server";
import type { MediaPlacementGroup } from "@/lib/aidreamcapes-workspace/media-placement";
import {
  MEDIA_DETAIL_PUBLIC_ORIGIN,
  mediaDetailCrumbs,
  mediaDetailIntro,
  mediaDetailParameters,
  mediaDetailPrompt,
  mediaDetailReferences,
  mediaWatchPath,
  type MediaDetailKind
} from "@/lib/aidreamcapes-workspace/media-detail";
import type { V2Resolvers } from "./types";
import type { V2Company } from "./company";
import type { AidreamcapesFooterArticle } from "./latest-articles";
import { AidreamcapesV2Shell, type AidreamcapesHeaderCustomer } from "./shell";
import { MediaDetailPlay } from "./media-detail-play";
import { MediaDetailPromptCopy } from "./media-detail-prompt-copy";

// Public media detail page. Complete server-rendered HTML: the card, its media,
// the owning directory and the single workspace call to action. No client data
// fetching and no workspace chrome.

function MediaFigure({ detail, r }: { detail: MediaDetail; r: V2Resolvers }) {
  const { card } = detail;
  if (card.video) {
    // The detail page is the template/prompt entry, not the watch page. The
    // SSR markup keeps only the poster (a crawlable <video> here made Google
    // report the video as "not on a watch page"); the player mounts on the
    // first click, and /watch/<slug> remains the indexable video page.
    const watchPath = mediaWatchPath("video", detail.slug);
    return (
      <figure className="v-detail-media">
        <MediaDetailPlay
          label={card.label}
          posterAlt={card.video.poster?.alt || card.image.alt || card.label}
          posterSrc={r.asset(card.video.poster?.src ?? card.image.src)}
          videoSrc={r.asset(card.video.src)}
          watchHref={watchPath ? r.href(watchPath) : undefined}
          width={card.video.width ?? card.image.w}
          height={card.video.height ?? card.image.h}
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

/**
 * The assets and settings this result was generated from. Sits under the media
 * so a visitor can see what the example was built with before opening the
 * workspace. Server-rendered: no client data requests.
 */
function ReferenceAssets({ card, r }: { card: MediaDetail["card"]; r: V2Resolvers }) {
  const references = mediaDetailReferences(card);
  const parameters = mediaDetailParameters(card);
  if (!references.images.length && !references.videos.length && !parameters.length) return null;
  const imageCount = references.images.length;
  return (
    <section aria-labelledby="v-detail-refs-title" className="v-detail-refs" data-media-references="true">
      <div className="v-detail-refs-head">
        <h2 id="v-detail-refs-title">Reference assets</h2>
        <span className="v-detail-refs-count">{`${imageCount} ${imageCount === 1 ? "image" : "images"}`}</span>
      </div>
      {references.images.length ? (
        <ul className="v-detail-refs-images">
          {references.images.map((image, index) => (
            <li key={`v-detail-ref-image-${index}`}>
              <img alt={image.alt || card.image.alt || card.label} decoding="async" loading="lazy" src={r.asset(image.src)} />
              <span className="v-detail-refs-index">{index + 1}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {references.videos.length ? (
        <ul className="v-detail-refs-videos">
          {references.videos.map((video, index) => (
            <li key={`v-detail-ref-video-${index}`}>
              {/* Reference clips are inputs, not the page's main video. A
                  poster link keeps them out of the crawlable <video> set. */}
              <a href={r.asset(video.src)} rel="noreferrer" target="_blank" aria-label={`Open reference clip ${index + 1}`}>
                {video.poster ? (
                  <img alt={video.alt || `Reference clip ${index + 1}`} decoding="async" loading="lazy" src={r.asset(video.poster)} />
                ) : (
                  <span>{`Reference clip ${index + 1}`}</span>
                )}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      {parameters.length ? (
        <dl className="v-detail-refs-params">
          {parameters.map((parameter) => (
            <div key={parameter.label}>
              <dt>{parameter.label}</dt>
              <dd>{parameter.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <p className="v-detail-refs-note">{card.kind === "photo" || !card.video?.src
        ? "These are the assets and settings this result used. Open the workspace to build your own version."
        : "These are the assets and settings this result used. The example video is the result, not an input."}</p>
    </section>
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

function PromptPanel({ prompt, kind }: { prompt: string; kind: MediaDetailKind }) {
  return (
    <section aria-labelledby="v-detail-prompt-title" className="v-detail-prompt" data-detail-prompt="true">
      <div className="v-detail-prompt-head">
        <h2 id="v-detail-prompt-title">Prompt</h2>
        <MediaDetailPromptCopy copiedLabel="Copied" failedLabel="Copy failed" label="Copy prompt" />
      </div>
      <p className="v-detail-prompt-text" data-detail-prompt-text="true">{prompt}</p>
      <p className="v-detail-prompt-note">{kind === "photo"
        ? "The workspace opens with this prompt so you can change the shot, product and format before you generate."
        : "The workspace opens with this prompt so you can change the shot, product, format and length before you generate."}</p>
    </section>
  );
}

export function AidreamcapesMediaDetailPage({ detail, navigation, r, company, articles, articlesTitle, placements = [], headerAccount, headerCustomer, siteId }: {
  detail: MediaDetail;
  navigation: AidreamcapesV2Navigation;
  r: V2Resolvers;
  company?: V2Company;
  articles?: AidreamcapesFooterArticle[];
  articlesTitle?: string;
  placements?: MediaPlacementGroup[];
  headerAccount?: { href: string; label: string };
  headerCustomer?: AidreamcapesHeaderCustomer;
  siteId?: string;
}) {
  const { card } = detail;
  const intro = mediaDetailIntro(card);
  const prompt = mediaDetailPrompt(card);
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
      // VideoObject lives on /watch/<slug>. This page is the template/prompt
      // entry, and declaring a video here is what produced the GSC "video not
      // on a watch page" report.
    ],
  };
  const specs = [
    card.aspect ? { label: "Format", value: card.aspect } : undefined,
    card.duration ? { label: "Length", value: `${card.duration}s` } : undefined,
    card.tool ? { label: "Tool", value: card.tool.replace(/-/g, " ") } : undefined,
  ].filter((item): item is { label: string; value: string } => Boolean(item));

  return (
    <AidreamcapesV2Shell articles={articles} articlesTitle={articlesTitle} company={company} headerAccount={headerAccount} headerCustomer={headerCustomer} mainId="media-detail" navigation={navigation} r={r} siteId={siteId}>
      <WorkspaceEntryBehavior />
      <StorefrontJsonLd nodes={[graph]} preserveBodyMarker />
      <style dangerouslySetInnerHTML={{ __html: `
#media-detail .v-detail{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);gap:44px;align-items:start;padding:24px 0 8px}
#media-detail .v-detail-media{margin:0;border-radius:18px;overflow:hidden;background:#0d1220;box-shadow:0 18px 60px rgba(10,16,32,.18)}
#media-detail .v-detail-media img,#media-detail .v-detail-media video{display:block;width:100%;height:auto}
#media-detail .v-detail-play{position:relative}
#media-detail .v-detail-play-poster{display:block;width:100%;padding:0;border:0;background:transparent;cursor:pointer;position:relative}
#media-detail .v-detail-play-poster img{transition:opacity .18s ease}
#media-detail .v-detail-play-poster:hover img{opacity:.92}
#media-detail .v-detail-play-cta{position:absolute;left:16px;bottom:16px;display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border-radius:999px;background:rgba(8,12,24,.78);color:#fff;font-size:13px;font-weight:700;backdrop-filter:blur(8px)}
#media-detail .v-detail-play-poster:hover .v-detail-play-cta{background:rgba(8,12,24,.92)}
#media-detail .v-detail-play-link{display:inline-flex;align-items:center;gap:6px;margin:10px 2px 0;font-size:13px;font-weight:600;color:var(--purple)}
#media-detail .v-detail-play-link:hover{text-decoration:underline;text-underline-offset:3px}
#media-detail .v-detail-media-col{display:grid;gap:18px;align-content:start;min-width:0}
#media-detail .v-detail-refs{padding:16px 18px 18px;border:1px solid var(--line);border-radius:16px;background:var(--card)}
#media-detail .v-detail-refs-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:12px}
#media-detail .v-detail-refs-head h2{margin:0;font-size:13px;font-weight:600;line-height:1.2;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-3)}
#media-detail .v-detail-refs-count{font-size:12.5px;opacity:.6}
#media-detail .v-detail-refs-images,#media-detail .v-detail-refs-videos{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 14px;padding:0;list-style:none}
#media-detail .v-detail-refs-images li,#media-detail .v-detail-refs-videos li{position:relative;width:104px;height:104px;margin:0;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#0d1220}
#media-detail .v-detail-refs-images img,#media-detail .v-detail-refs-videos video{display:block;width:100%;height:100%;object-fit:cover}
#media-detail .v-detail-refs-index{position:absolute;left:6px;bottom:6px;display:grid;place-items:center;width:18px;height:18px;border-radius:50%;background:rgba(8,12,24,.72);color:#fff;font-size:11px;line-height:1}
#media-detail .v-detail-refs-params{display:flex;flex-wrap:wrap;gap:8px 26px;margin:0}
#media-detail .v-detail-refs-params dt{font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;opacity:.6}
#media-detail .v-detail-refs-params dd{margin:2px 0 0;font-weight:600}
#media-detail .v-detail-refs-note{margin:14px 0 0;color:var(--ink-3);font-size:12.5px;line-height:1.5}
#media-detail .v-detail h1{font-size:clamp(1.7rem,2.6vw,2.5rem);line-height:1.15;margin:0 0 14px}
#media-detail .v-detail-lead{font-size:1.03rem;line-height:1.6;margin:0 0 22px;opacity:.85}
#media-detail .v-detail-specs{display:flex;flex-wrap:wrap;gap:10px 26px;margin:0 0 26px;padding:0;list-style:none}
#media-detail .v-detail-specs dt{font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;opacity:.6}
#media-detail .v-detail-specs dd{margin:2px 0 0;font-weight:600}
#media-detail .v-detail-actions{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
#media-detail .v-detail-note{margin:14px 0 0;font-size:.86rem;opacity:.65}
#media-detail .v-detail-prompt{margin:26px 0 0;padding:18px 20px 20px;border:1px solid var(--line);border-radius:16px;background:var(--card)}
#media-detail .v-detail-prompt-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
#media-detail .v-detail-prompt-head h2{margin:0;font-size:13px;font-weight:600;line-height:1.2;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-3)}
#media-detail .v-detail-prompt-copy{flex:none;padding:6px 12px;border:1px solid var(--line-2);border-radius:999px;background:transparent;color:var(--ink-2);font-size:12.5px;font-weight:600;line-height:1.2;cursor:pointer;transition:border-color .16s ease,color .16s ease}
#media-detail .v-detail-prompt-copy:hover{border-color:rgba(255,255,255,.34);color:var(--ink)}
#media-detail .v-detail-prompt-text{margin:0;white-space:pre-wrap;color:var(--ink-2);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;font-size:13px;line-height:1.7;overflow-wrap:anywhere;max-height:620px;overflow-y:auto;overscroll-behavior:contain;padding-right:8px;scrollbar-width:thin;scrollbar-color:rgba(148,140,170,.35) transparent}
#media-detail .v-detail-prompt-text::-webkit-scrollbar{width:6px}
#media-detail .v-detail-prompt-text::-webkit-scrollbar-thumb{border-radius:999px;background:rgba(148,140,170,.35)}
#media-detail .v-detail-prompt-text::-webkit-scrollbar-track{background:transparent}
#media-detail .v-detail-prompt-note{margin:14px 0 0;padding-top:12px;border-top:1px solid var(--line);color:var(--ink-3);font-size:13px;line-height:1.55}
#media-detail .v-detail-categories{margin:0 0 26px;padding-top:18px;border-top:1px solid var(--line)}
#media-detail .v-detail-categories dl{display:grid;gap:10px;margin:10px 0 0}
#media-detail .v-detail-categories dl>div{display:grid;grid-template-columns:92px minmax(0,1fr);gap:12px;align-items:start}
#media-detail .v-detail-categories dt{padding-top:6px;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;opacity:.6}
#media-detail .v-detail-categories dd{display:flex;flex-wrap:wrap;gap:8px;margin:0}
#media-detail .v-detail-categories .chip:hover{border-color:var(--line-2);color:var(--ink)}
#media-detail .v-crumbs{display:flex;flex-wrap:wrap;gap:6px;font-size:.85rem;opacity:.75;padding-top:8px}
#media-detail .v-crumbs a{text-decoration:underline;text-underline-offset:3px}
@media(max-width:880px){#media-detail .v-detail{grid-template-columns:minmax(0,1fr);gap:26px}#media-detail .v-detail-prompt-text{max-height:440px}}
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
          <div className="v-detail-media-col">
            <MediaFigure detail={detail} r={r} />
            <ReferenceAssets card={card} r={r} />
          </div>
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
              {detail.kind === "video" && card.video?.src && mediaWatchPath("video", detail.slug) ? (
                <a className="btn" href={r.href(mediaWatchPath("video", detail.slug)!)}>Watch full video</a>
              ) : null}
              <a className="btn" href={r.href(detail.ownerPath)}>Browse the full directory</a>
            </div>
            <p className="v-detail-note">{detail.kind === "photo"
              ? "Opens the workspace with this template already selected. You can change the product and format."
              : "Opens the workspace with this template already selected. You can change the product, format and length."}</p>
            {prompt ? <PromptPanel kind={detail.kind} prompt={prompt} /> : null}
          </div>
        </div>
      </div>
      <RelatedGrid detail={detail} r={r} />
    </AidreamcapesV2Shell>
  );
}
