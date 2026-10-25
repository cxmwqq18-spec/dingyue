"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import styles from "./library.module.css";

export interface LibraryReelItem {
  id: string;
  taskId: string;
  title: string;
  url: string;
  label: string;
  /** How many reference images the task has in total. */
  count: number;
}

/**
 * The reference reel above the library list: every reference image of every
 * visible task in one scrolling strip.
 *
 * Interaction: it advances one frame every few seconds, pauses while the
 * pointer or the keyboard focus is inside it, and responds to the arrow
 * buttons and to manual dragging. Clicking a frame opens the task it belongs
 * to. Reduced motion turns the automatic advance off.
 */
export function LibraryReferenceReel({ items, onOpen }: { items: LibraryReelItem[]; onOpen: (taskId: string) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(158);

  const measure = useCallback(() => {
    const track = trackRef.current;
    const first = track?.firstElementChild as HTMLElement | null;
    if (!track || !first) return;
    const gap = Number.parseFloat(getComputedStyle(track).columnGap || "12") || 12;
    setStep(first.offsetWidth + gap);
  }, []);

  useEffect(() => {
    measure();
    if (typeof window === "undefined") return;
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  // Keep the counter in step with manual scrolling.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const onScroll = () => {
      const next = Math.round(track.scrollLeft / Math.max(1, step));
      setIndex(Math.min(items.length - 1, Math.max(0, next)));
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => track.removeEventListener("scroll", onScroll);
  }, [items.length, step]);

  useEffect(() => {
    if (paused || items.length < 2) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      const track = trackRef.current;
      if (!track) return;
      if (document.hidden) return;
      const max = track.scrollWidth - track.clientWidth;
      if (max <= 8) return;
      const next = track.scrollLeft + step;
      track.scrollTo({ left: next > max - 8 ? 0 : next, behavior: "smooth" });
    }, 3600);
    return () => window.clearInterval(timer);
  }, [paused, items.length, step]);

  if (!items.length) return null;

  const taskCount = new Set(items.map((item) => item.taskId)).size;
  const nudge = (direction: -1 | 1) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * step, behavior: "smooth" });
  };

  return (
    <section
      className={styles.reel}
      aria-label="Reference images from your videos"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className={styles.reelHead}>
        <div className={styles.reelTitle}>
          <h2>Reference images</h2>
          <span>{items.length} frames from {taskCount} {taskCount === 1 ? "video" : "videos"}</span>
        </div>
        <div className={styles.reelTools}>
          <span className={styles.reelCount}>{String(Math.min(index + 1, items.length)).padStart(2, "0")} / {String(items.length).padStart(2, "0")}</span>
          <button type="button" className={styles.reelNav} onClick={() => nudge(-1)} aria-label="Previous reference images">
            <ArrowLeft size={15} />
          </button>
          <button type="button" className={styles.reelNav} onClick={() => nudge(1)} aria-label="Next reference images">
            <ArrowRight size={15} />
          </button>
        </div>
      </div>

      <div className={styles.reelTrack} ref={trackRef} tabIndex={0} aria-label="Reference images, scroll or use the arrow buttons">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={styles.reelItem}
            onClick={() => onOpen(item.taskId)}
            aria-label={`${item.title}: ${item.label || "reference image"}, open this video`}
          >
            <img className={styles.reelBackdrop} src={item.url} alt="" aria-hidden="true" decoding="async" />
            <img className={styles.reelShot} src={item.url} alt="" loading="lazy" decoding="async" />
            {item.count > 1 && <span className={styles.reelBadge}>{item.count} refs</span>}
            <span className={styles.reelMeta}>
              <strong>{item.title}</strong>
              <span>{item.label || "Reference"}</span>
            </span>
          </button>
        ))}
      </div>

      <div className={styles.reelProgress} aria-hidden="true">
        <span style={{ width: `${Math.round(((Math.min(index, items.length - 1) + 1) / items.length) * 100)}%` }} />
      </div>
    </section>
  );
}
