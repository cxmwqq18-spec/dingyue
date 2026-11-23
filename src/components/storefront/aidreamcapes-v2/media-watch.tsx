import type { AidreamcapesV2Navigation } from "@/lib/types";
import { StorefrontJsonLd } from "@/components/storefront/storefront-json-ld";
import { WorkspaceEntryLink } from "@/components/aidreamcapes-workspace/entry-link";
import { WorkspaceEntryBehavior } from "@/components/aidreamcapes-workspace/entry-behavior";
import type { MediaDetail } from "@/lib/aidreamcapes-workspace/media-detail.server";
import {
  MEDIA_DETAIL_PUBLIC_ORIGIN,
  mediaDetailDescription,
  mediaWatchPath
} from "@/lib/aidreamcapes-workspace/media-detail";
import type { V2Resolvers } from "./types";
import type { V2Company } from "./company";
import type { AidreamcapesFooterArticle } from "./latest-articles";
import { AidreamcapesV2Shell, type AidreamcapesHeaderCustomer } from "./shell";

// Public watch page for a single AIVideosUGC video.
//
// Google only indexes a video when the page is a watch page: the video is the
// main content, the page exists for that one video, and VideoObject.url points
// at it. The template detail page keeps the prompt, reference assets and
// related cards, so it stays an entry page and links here instead.

function watchUrlFor(detail: MediaDetail): string {
  return `${MEDIA_DETAIL_PUBLIC_ORIGIN}${mediaWatchPath("video", detail.slug)}`;
}

function absoluteAsset(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value, MEDIA_DETAIL_PUBLIC_ORIGIN).href;
  } catch {
    return undefined;
  }
}

function isoDuration(seconds: number | undefined): string | undefined {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return undefined;
  return `PT${Math.round(seconds)}S`;
}

export function AidreamcapesMediaWatchPage({
  detail,
  navigation,
  r,
  company,
  articles,
  articlesTitle,
  headerAccount,
  headerCustomer,
  siteId
}: {
  detail: MediaDetail;
  navigation: AidreamcapesV2Navigation;
  r: V2Resolvers;
  company?: V2Company;
  articles?: AidreamcapesFooterArticle[];
  articlesTitle?: string;
  headerAccount?: { href: string; label: string };
  headerCustomer?: AidreamcapesHeaderCustomer;
  siteId?: string;
}) {
  const { card } = detail;
  if (!card.video?.src) return null;
  const watchUrl = watchUrlFor(detail);
  const detailHref = r.href(detail.path);
  const contentUrl = absoluteAsset(card.video.src) ?? card.video.src;
  const thumbnailUrl = absoluteAsset(card.video.poster?.src ?? card.image.src);
  const duration = isoDuration(Number(card.duration) || undefined);
  const published = detail.ownerUpdatedAt;
  const description = mediaDetailDescription(card, detail.kind, "watch");
  const crumbs = [
    { label: "Home", href: r.href("/") },
    { label: "AI Video Generation", href: r.href("/ai-video-generation") },
    { label: card.label, href: "" }
  ];
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: crumbs.map((crumb, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: crumb.label,
          item: crumb.href ? new URL(crumb.href, MEDIA_DETAIL_PUBLIC_ORIGIN).href : watchUrl
        }))
      },
      {
        "@type": "VideoObject",
        "@id": `${watchUrl}#video`,
        name: card.label,
        description,
        thumbnailUrl: thumbnailUrl ? [thumbnailUrl] : undefined,
        uploadDate: published,
        ...(duration ? { duration } : {}),
        contentUrl,
        embedUrl: watchUrl,
        url: watchUrl,
        mainEntityOfPage: { "@type": "WebPage", "@id": watchUrl },
        isPartOf: { "@type": "WebSite", "@id": `${MEDIA_DETAIL_PUBLIC_ORIGIN}/#website` },
        publisher: {
          "@type": "Organization",
          "@id": `${MEDIA_DETAIL_PUBLIC_ORIGIN}/#organization`,
          name: "AIVideosUGC",
          url: `${MEDIA_DETAIL_PUBLIC_ORIGIN}/`
        },
        potentialAction: { "@type": "WatchAction", target: watchUrl },
        isFamilyFriendly: true,
        inLanguage: "en",
        encodingFormat: "video/mp4"
      }
    ]
  };

  return (
    <AidreamcapesV2Shell
      articles={articles}
      articlesTitle={articlesTitle}
      company={company}
      headerAccount={headerAccount}
      headerCustomer={headerCustomer}
      mainId="media-watch"
      navigation={navigation}
      r={r}
      siteId={siteId}
    >
      <WorkspaceEntryBehavior />
      <StorefrontJsonLd nodes={[graph]} preserveBodyMarker />
      <style dangerouslySetInnerHTML={{ __html: `
#media-watch .v-watch{max-width:1080px;margin:0 auto;padding:28px 20px 8px}
#media-watch .v-watch-crumbs{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 18px;padding:0;list-style:none;font-size:13px;opacity:.65}
#media-watch .v-watch-crumbs li{display:inline-flex;gap:6px;align-items:center}
#media-watch .v-watch-crumbs a{color:inherit;text-decoration:none}
#media-watch .v-watch-crumbs a:hover{text-decoration:underline}
#media-watch .v-watch h1{font-size:clamp(1.7rem,3.2vw,2.6rem);line-height:1.15;margin:0 0 12px}
#media-watch .v-watch-lead{max-width:760px;margin:0 0 22px;font-size:1.03rem;line-height:1.65;opacity:.85}
#media-watch .v-watch-player{margin:0 0 22px;border-radius:18px;overflow:hidden;background:#0d1220;box-shadow:0 18px 60px rgba(10,16,32,.18)}
#media-watch .v-watch-player video{display:block;width:100%;height:auto;max-height:82vh;background:#000;object-fit:contain}
#media-watch .v-watch-meta{display:flex;flex-wrap:wrap;gap:10px 30px;margin:0 0 26px;padding:0;list-style:none}
#media-watch .v-watch-meta dt{font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;opacity:.6}
#media-watch .v-watch-meta dd{margin:2px 0 0;font-weight:600}
#media-watch .v-watch-actions{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
#media-watch .v-watch-note{margin:14px 0 0;font-size:.86rem;opacity:.65}
@media (max-width:640px){#media-watch .v-watch{padding:18px 16px 4px}}
` }} />
      <article className="v-watch">
        <nav aria-label="Breadcrumb">
          <ol className="v-watch-crumbs">
            {crumbs.map((crumb, index) => (
              <li key={`${crumb.label}-${index}`}>
                {crumb.href ? <a href={crumb.href}>{crumb.label}</a> : <span aria-current="page">{crumb.label}</span>}
                {index < crumbs.length - 1 ? <span aria-hidden="true">›</span> : null}
              </li>
            ))}
          </ol>
        </nav>
        <h1>Watch: {card.label}</h1>
        <p className="v-watch-lead">{description}</p>
        <figure className="v-watch-player">
          <video
            aria-label={card.label}
            controls
            height={card.video.height}
            loop
            playsInline
            poster={card.video.poster ? r.asset(card.video.poster.src) : undefined}
            preload="metadata"
            src={r.asset(card.video.src)}
            width={card.video.width}
          />
        </figure>
        <dl className="v-watch-meta">
          {card.duration ? (
            <div>
              <dt>Length</dt>
              <dd>{`${card.duration}s`}</dd>
            </div>
          ) : null}
          {card.aspect ? (
            <div>
              <dt>Format</dt>
              <dd>{card.aspect}</dd>
            </div>
          ) : null}
          <div>
            <dt>Published</dt>
            <dd>{new Date(published).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</dd>
          </div>
        </dl>
        <div className="v-watch-actions">
          <WorkspaceEntryLink className="btn btn-grad" entry={detail.cta.entry} href={r.href(detail.cta.href)}>
            Make a video like this →
          </WorkspaceEntryLink>
          <a className="btn" href={detailHref}>View the template page</a>
        </div>
        <p className="v-watch-note">The workspace opens with this template already selected. You can change the product, format and length.</p>
      </article>
    </AidreamcapesV2Shell>
  );
}
