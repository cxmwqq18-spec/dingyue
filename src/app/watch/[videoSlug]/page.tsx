import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { StorefrontJsonLd } from "@/components/storefront/storefront-json-ld";
import {
  isMydreamshootsVideoHost,
  mydreamshootsVideoAssetUrl,
  mydreamshootsVideoWatchUrl,
  MYDREAMSHOOTS_VIDEO_WATCH_ORIGIN,
  mydreamshootsVideoWatchPageForSlug,
  type MyDreamShootsVideoWatchPage
} from "@/lib/mydreamshoots-video-watch";
import { getMydreamshootsVideoWatchPagesForHost } from "@/lib/seo-indexing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function videoDuration(seconds: number): string {
  return `PT${Math.max(1, Math.floor(seconds))}S`;
}

function videoJsonLd(video: MyDreamShootsVideoWatchPage) {
  const watchUrl = mydreamshootsVideoWatchUrl(video);
  const thumbnailUrl = mydreamshootsVideoAssetUrl(video.thumbnailPath);
  const contentUrl = mydreamshootsVideoAssetUrl(video.contentPath);
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "@id": `${watchUrl}#video`,
    name: video.name,
    description: video.description,
    thumbnailUrl: [thumbnailUrl],
    uploadDate: video.uploadDate,
    duration: videoDuration(video.durationSeconds),
    contentUrl,
    encodingFormat: /\.webm(?:[?#]|$)/i.test(video.contentPath) ? "video/webm" : "video/mp4",
    url: watchUrl,
    mainEntityOfPage: { "@type": "WebPage", "@id": watchUrl },
    isPartOf: { "@type": "WebSite", "@id": `${MYDREAMSHOOTS_VIDEO_WATCH_ORIGIN}/#website` },
    publisher: {
      "@type": "Organization",
      "@id": `${MYDREAMSHOOTS_VIDEO_WATCH_ORIGIN}/#organization`,
      name: "myDreamshoots",
      url: "https://www.mydreamshoots.com/"
    },
    potentialAction: {
      "@type": "WatchAction",
      target: watchUrl
    }
  };
}

async function videoForRequest(slug: string): Promise<MyDreamShootsVideoWatchPage | undefined> {
  const requestHeaders = await headers();
  const hostCandidates = [requestHeaders.get("x-forwarded-host"), requestHeaders.get("host")];
  if (!hostCandidates.some(isMydreamshootsVideoHost)) return undefined;
  const pages = await getMydreamshootsVideoWatchPagesForHost(hostCandidates);
  return mydreamshootsVideoWatchPageForSlug(slug, pages);
}

export async function generateMetadata({ params }: { params: Promise<{ videoSlug: string }> }): Promise<Metadata> {
  const { videoSlug } = await params;
  const video = await videoForRequest(videoSlug);
  if (!video) {
    return { robots: { index: false, follow: false } };
  }
  const watchUrl = mydreamshootsVideoWatchUrl(video);
  const thumbnailUrl = mydreamshootsVideoAssetUrl(video.thumbnailPath);
  return {
    title: `${video.name} | myDreamshoots`,
    description: video.description,
    alternates: { canonical: watchUrl },
    robots: { index: true, follow: true, "max-image-preview": "large" },
    openGraph: {
      type: "website",
      url: watchUrl,
      title: video.name,
      description: video.description,
      siteName: "myDreamshoots",
      images: [{ url: thumbnailUrl, alt: video.name }]
    },
    twitter: {
      card: "summary_large_image",
      title: video.name,
      description: video.description,
      images: [thumbnailUrl]
    }
  };
}

export default async function MyDreamShootsVideoWatchPage({
  params
}: {
  params: Promise<{ videoSlug: string }>;
}) {
  const { videoSlug } = await params;
  const video = await videoForRequest(videoSlug);
  if (!video) notFound();

  const thumbnailUrl = mydreamshootsVideoAssetUrl(video.thumbnailPath);
  const contentUrl = mydreamshootsVideoAssetUrl(video.contentPath);

  return (
    <main style={{ minHeight: "100vh", background: "#090b12", color: "#f8fafc", padding: "clamp(2rem, 6vw, 6rem) 1.25rem" }}>
      <div style={{ maxWidth: "1080px", margin: "0 auto" }}>
        <p style={{ margin: "0 0 0.75rem", color: "#a5b4fc", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>
          myDreamshoots video
        </p>
        <h1 style={{ maxWidth: "820px", margin: "0", fontSize: "clamp(2rem, 5vw, 4.5rem)", lineHeight: 1.05, letterSpacing: "-0.04em" }}>
          {video.name}
        </h1>
        <p style={{ maxWidth: "720px", margin: "1.25rem 0 2rem", color: "#cbd5e1", fontSize: "1.1rem", lineHeight: 1.7 }}>
          {video.description}
        </p>
        <div style={{ overflow: "hidden", border: "1px solid rgba(148, 163, 184, 0.28)", borderRadius: "24px", background: "#111827", boxShadow: "0 24px 80px rgba(0, 0, 0, 0.35)" }}>
          <video
            controls
            preload="metadata"
            poster={thumbnailUrl}
            width={1920}
            height={1080}
            style={{ display: "block", width: "100%", height: "auto", aspectRatio: "16 / 9", background: "#020617" }}
          >
            <source src={contentUrl} type={/\.webm(?:[?#]|$)/i.test(video.contentPath) ? "video/webm" : "video/mp4"} />
            Your browser does not support HTML video.
          </video>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center", marginTop: "1.5rem" }}>
          <Link href={video.sourcePath} style={{ color: "#c4b5fd", fontWeight: 700, textDecoration: "none" }}>
            View the related myDreamshoots page →
          </Link>
          <Link href="/app/create" style={{ color: "#f8fafc", fontWeight: 700, textDecoration: "none" }}>
            Start creating →
          </Link>
        </div>
      </div>
      <StorefrontJsonLd nodes={[videoJsonLd(video)]} preserveBodyMarker />
    </main>
  );
}
