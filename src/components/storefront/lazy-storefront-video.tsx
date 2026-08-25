import type { VideoHTMLAttributes } from "react";

type LazyStorefrontVideoProps = Omit<VideoHTMLAttributes<HTMLVideoElement>, "preload" | "src"> & {
  src: string;
  autoPlayOnInteraction?: boolean;
  interactionPreload?: "metadata" | "auto";
  nearViewportPreload?: "metadata" | "auto";
  observerRootMargin?: string;
  posterOverlay?: boolean;
  pauseOverlay?: boolean;
};

export function LazyStorefrontVideo({
  src,
  poster,
  autoPlayOnInteraction: _autoPlayOnInteraction,
  interactionPreload: _interactionPreload,
  nearViewportPreload: _nearViewportPreload,
  observerRootMargin: _observerRootMargin,
  posterOverlay: _posterOverlay,
  pauseOverlay: _pauseOverlay,
  ...props
}: LazyStorefrontVideoProps) {
  return <video {...props} poster={poster} preload="metadata" src={src} />;
}
