// Viewport gating for <video> poster images. Unlike <img loading="lazy"> a
// video poster has no native gate: the browser fetches every poster attribute
// as soon as the HTML parses. A homepage of clip grids would therefore fire
// dozens of image requests before the visitor scrolls. Server render puts the
// poster URL in data-deferred-poster instead; this script assigns it once the
// video nears the viewport (or immediately when its dialog opens).

const NEAR_ROOT_MARGIN = "600px 0px";

export function gateDeferredPosters(root: ParentNode): void {
  const videos = [...root.querySelectorAll<HTMLVideoElement>("video[data-deferred-poster]")];
  if (!videos.length) return;
  if (typeof IntersectionObserver === "undefined") {
    videos.forEach(showDeferredPoster);
    return;
  }
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const video = entry.target as HTMLVideoElement;
      observer.unobserve(video);
      showDeferredPoster(video);
    }
  }, { rootMargin: NEAR_ROOT_MARGIN });
  videos.forEach(video => observer.observe(video));
}

/** Assign the deferred poster right away — used when a hidden container
 * (dialog, tab panel) becomes visible, so the frame never flashes empty. */
export function showDeferredPoster(video: HTMLVideoElement): void {
  const url = video.dataset.deferredPoster;
  if (!url) return;
  video.poster = url;
  delete video.dataset.deferredPoster;
}
