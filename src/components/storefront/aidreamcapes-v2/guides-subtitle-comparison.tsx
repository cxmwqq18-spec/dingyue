"use client";

import { useRef } from "react";

type SubtitleSide = {
  label: string;
  video: { src: string; poster?: string };
  lines: string[];
};

type Props = {
  before: SubtitleSide;
  after: SubtitleSide;
  chips?: string[];
  classNames: { row: string; card: string; bar: string; chips: string };
};

/** Presentation-only comparison: keep the two clips at the same playhead and
 * prevent their audio from playing over one another. All copy and media URLs
 * are rendered from the server-owned LivePage content. */
export function GuidesSubtitleCompare({ before, after, chips, classNames }: Props) {
  const videos = [useRef<HTMLVideoElement>(null), useRef<HTMLVideoElement>(null)];
  const playhead = useRef(0);
  const sides = [before, after];

  function handlePlay(index: number) {
    const active = videos[index].current;
    const other = videos[index === 0 ? 1 : 0].current;
    if (!active) return;
    if (other) {
      const sharedTime = Math.min(playhead.current, Number.isFinite(active.duration) ? active.duration : playhead.current);
      if (active.readyState >= 1 && Math.abs(active.currentTime - sharedTime) > 0.25) active.currentTime = sharedTime;
      other.pause();
    }
  }

  function rememberPlayhead(index: number) {
    const active = videos[index].current;
    if (active && Number.isFinite(active.currentTime)) playhead.current = active.currentTime;
  }

  return (
    <>
      <div className={classNames.row}>
        {sides.map((side, index) => (
          <div className={classNames.card} key={side.label}>
            <video
              aria-label={side.label}
              controls
              playsInline
              preload="metadata"
              poster={side.video.poster}
              src={side.video.src}
              ref={videos[index]}
              onPlay={() => handlePlay(index)}
              onTimeUpdate={() => rememberPlayhead(index)}
              onSeeking={() => rememberPlayhead(index)}
            />
            <div className={classNames.bar}>
              <b>{side.label}</b>
              {side.lines.map((line) => <span key={line}>{line}</span>)}
            </div>
          </div>
        ))}
      </div>
      {chips?.length ? (
        <div className={classNames.chips}>
          {chips.map((chip) => <span key={chip}>{chip}</span>)}
        </div>
      ) : null}
    </>
  );
}
