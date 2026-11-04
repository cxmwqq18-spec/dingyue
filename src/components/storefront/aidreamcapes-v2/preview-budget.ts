// Shared mobile playback budget for decorative SSR video grids (scene cards,
// presenter clips, tool demos). Desktop keeps today's play-everything-in-view
// behavior; a phone's media pipeline can only sustain a couple of concurrent
// clip downloads, so on small viewports extra visible cards stay on their
// poster until a slot frees up. Adc2VideoPreview runs its own budget for
// client-gated previews; this covers the plain SSR <video> grids.

const MOBILE_QUERY = "(max-width: 768px)";
const MAX_PLAYING_MOBILE = 2;

const playing = new Set<HTMLVideoElement>();
const waiting = new Map<HTMLVideoElement, () => unknown>();

function isMobile(): boolean {
  return typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches;
}

/** Start `start` for this video, immediately on desktop, budgeted on mobile. */
export function requestDecorationPlay(video: HTMLVideoElement, start: () => unknown): void {
  if (!isMobile()) {
    start();
    return;
  }
  if (playing.has(video)) return;
  if (playing.size < MAX_PLAYING_MOBILE) {
    playing.add(video);
    Promise.resolve(start()).catch(() => releaseDecorationSlot(video));
    return;
  }
  waiting.set(video, start);
}

/** Free this video's slot (scrolled away, paused, dialog closed, failed). */
export function releaseDecorationSlot(video: HTMLVideoElement): void {
  const wasPlaying = playing.delete(video);
  waiting.delete(video);
  if (wasPlaying) pumpWaiting();
}

function pumpWaiting(): void {
  for (const [video, start] of [...waiting]) {
    if (playing.size >= MAX_PLAYING_MOBILE) return;
    waiting.delete(video);
    if (!video.isConnected) continue;
    const rect = video.getBoundingClientRect();
    if (rect.bottom <= 0 || rect.top >= window.innerHeight) continue;
    playing.add(video);
    Promise.resolve(start()).catch(() => releaseDecorationSlot(video));
  }
}
