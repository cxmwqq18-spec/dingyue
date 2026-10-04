import type { Metadata } from "next";
import Link from "next/link";
import { ContextualLinks } from "@/components/storefront/contextual-links";
import { StorefrontJsonLd } from "@/components/storefront/storefront-json-ld";
import {
  storefrontVideoAssetUrl,
  storefrontVideoBrand,
  mydreamshootsVideoWatchUrl,
  type MyDreamShootsVideoWatchPage
} from "@/lib/mydreamshoots-video-watch";
import { normalizePublicSeoDescription, normalizePublicSeoTitle } from "@/lib/storefront-seo-text";

function videoDuration(seconds: number): string {
  return `PT${Math.max(1, Math.floor(seconds))}S`;
}

function videoJsonLd(video: MyDreamShootsVideoWatchPage) {
  const watchUrl = mydreamshootsVideoWatchUrl(video);
  const thumbnailUrl = storefrontVideoAssetUrl(video, video.thumbnailPath);
  const contentUrl = storefrontVideoAssetUrl(video, video.contentPath);
  const description = normalizePublicSeoDescription(video.description, { brand: video.brand, locale: video.locale, fallbackTopic: video.name });
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "@id": `${watchUrl}#video`,
    name: video.name,
    description,
    thumbnailUrl: [thumbnailUrl],
    uploadDate: video.uploadDate,
    duration: videoDuration(video.durationSeconds),
    contentUrl,
    encodingFormat: /\.webm(?:[?#]|$)/i.test(video.contentPath) ? "video/webm" : "video/mp4",
    inLanguage: video.locale,
    url: watchUrl,
    mainEntityOfPage: { "@type": "WebPage", "@id": watchUrl, inLanguage: video.locale },
    isPartOf: { "@type": "WebSite", "@id": `${video.origin}/#website` },
    publisher: {
      "@type": "Organization",
      "@id": `${video.origin}/#organization`,
      name: storefrontVideoBrand(video),
      url: `${video.origin}/`
    },
    potentialAction: {
      "@type": "WatchAction",
      target: watchUrl
    }
  };
}

function breadcrumbJsonLd(video: MyDreamShootsVideoWatchPage) {
  const watchUrl = mydreamshootsVideoWatchUrl(video);
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: storefrontVideoBrand(video), item: `${video.origin}/` },
      { "@type": "ListItem", position: 2, name: "Watch", item: watchUrl }
    ]
  };
}

export function storefrontVideoWatchMetadata(video: MyDreamShootsVideoWatchPage): Metadata {
  const watchUrl = mydreamshootsVideoWatchUrl(video);
  const thumbnailUrl = storefrontVideoAssetUrl(video, video.thumbnailPath);
  const brand = storefrontVideoBrand(video);
  const title = normalizePublicSeoTitle(video.name, { brand, locale: video.locale, fallbackTopic: "AI video" });
  const description = normalizePublicSeoDescription(video.description, { brand, locale: video.locale, fallbackTopic: video.name });
  return {
    title,
    description,
    alternates: { canonical: watchUrl },
    robots: { index: true, follow: true, "max-image-preview": "large" },
    openGraph: {
      type: "website",
      url: watchUrl,
      title,
      description,
      siteName: brand,
      images: [{ url: thumbnailUrl, alt: video.name }]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [thumbnailUrl]
    }
  };
}

export function StorefrontVideoWatchDocument({ video }: { video: MyDreamShootsVideoWatchPage }) {
  const thumbnailUrl = storefrontVideoAssetUrl(video, video.thumbnailPath);
  const contentUrl = storefrontVideoAssetUrl(video, video.contentPath);
  const brand = storefrontVideoBrand(video);
  const isFrench = video.locale === "fr";
  const isSpanish = video.locale === "es";
  const relatedLabel = video.sourceLabel || (isFrench ? "Voir la page associée →" : isSpanish ? "Ver la página relacionada →" : "View the related myDreamshoots page →");
  const createLabel = isFrench ? "Commencer à créer →" : isSpanish ? "Empieza a crear →" : "Start creating →";
  const WatchLink = video.siteId === "site_dreamshoot" ? "a" : Link;

  return (
    <main style={{ minHeight: "100vh", background: "#090b12", color: "#f8fafc", padding: "clamp(2rem, 6vw, 6rem) 1.25rem" }}>
      <div style={{ maxWidth: "1080px", margin: "0 auto" }}>
        <p style={{ margin: "0 0 0.75rem", color: "#a5b4fc", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>
          {brand} video
        </p>
        <h1 style={{ maxWidth: "820px", margin: "0", fontSize: "clamp(2rem, 5vw, 4.5rem)", lineHeight: 1.05, letterSpacing: "-0.04em" }}>
          {video.name}
        </h1>
        <p style={{ maxWidth: "720px", margin: "1.25rem 0 2rem", color: "#cbd5e1", fontSize: "1.1rem", lineHeight: 1.7 }}>
          {video.description}
        </p>
        <div style={{ overflow: "hidden", border: "1px solid rgba(148, 163, 184, 0.28)", borderRadius: "24px", background: "#111827", boxShadow: "0 24px 80px rgba(0, 0, 0, 0.35)" }}>
          <video
            aria-label={video.name}
            controls
            preload="metadata"
            poster={thumbnailUrl}
            width={1920}
            height={1080}
            style={{ display: "block", width: "100%", height: "auto", aspectRatio: "16 / 9", background: "#020617" }}
          >
            <source src={contentUrl} type={/\.webm(?:[?#]|$)/i.test(video.contentPath) ? "video/webm" : "video/mp4"} />
            {isFrench ? "Votre navigateur ne prend pas en charge la vidéo HTML." : isSpanish ? "Tu navegador no admite vídeo HTML." : "Your browser does not support HTML video."}
          </video>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center", marginTop: "1.5rem" }}>
          <WatchLink href={video.sourcePath} style={{ color: "#c4b5fd", fontWeight: 700, textDecoration: "none" }}>
            {relatedLabel}
          </WatchLink>
          <WatchLink href="/app/create" style={{ color: "#f8fafc", fontWeight: 700, textDecoration: "none" }}>
            {createLabel}
          </WatchLink>
        </div>
        {video.siteId === "site_dreamshoot" ? <ContextualLinks currentPath={video.watchPath} links={video.contextualLinks} /> : null}
      </div>
      <StorefrontJsonLd nodes={[videoJsonLd(video), breadcrumbJsonLd(video)]} preserveBodyMarker />
    </main>
  );
}
