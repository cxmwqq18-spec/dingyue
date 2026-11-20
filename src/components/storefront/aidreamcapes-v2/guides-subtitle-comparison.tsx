"use client";

import { useRef, useState } from "react";

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
  // The comparison players mount only after the visitor asks for them. The
  // server-rendered page carries posters, not <video> elements, so Google does
  // not treat this article as a page with an embedded video.
  const [started, setStarted] = useState(false);

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
            {started ? (
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
            ) : (
              <button
                aria-label={`Load the ${side.label} comparison player`}
                onClick={() => setStarted(true)}
                style={{ position: "relative", display: "block", width: "100%", padding: 0, border: 0, background: "transparent", cursor: "pointer", overflow: "hidden" }}
                type="button"
              >
                {side.video.poster ? (
                  <img alt={side.label} decoding="async" loading="lazy" src={side.video.poster} style={{ display: "block", width: "100%", height: "auto", objectFit: "cover" }} />
                ) : (
                  <span aria-hidden="true" style={{ display: "block", width: "100%", aspectRatio: "16 / 9", background: "#111" }} />
                )}
                <span aria-hidden="true" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(0,0,0,.12)" }}>
                  <span style={{ display: "grid", placeItems: "center", width: 54, height: 54, borderRadius: "50%", background: "rgba(8,12,24,.82)", color: "#fff", fontSize: 20, paddingLeft: 4, backdropFilter: "blur(8px)" }}>▶</span>
                </span>
              </button>
            )}
            <div className={classNames.bar}>
              <b>{side.label}</b>
              {side.lines.map((line) => <span key={line}>{line}</span>)}
            </div>
          </div>
        ))}
      </div>
      {!started ? (
        <p style={{ margin: "14px 0 0" }}>
          <button
            onClick={() => setStarted(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 999, border: "1px solid rgba(255,255,255,.24)", background: "transparent", color: "inherit", fontWeight: 600, cursor: "pointer" }}
            type="button"
          >
            ▶ Load comparison players
          </button>
        </p>
      ) : null}
      {chips?.length ? (
        <div className={classNames.chips}>
          {chips.map((chip) => <span key={chip}>{chip}</span>)}
        </div>
      ) : null}
    </>
  );
}
