"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

type DreamshootShowcaseRailProps = {
  children: ReactNode;
  className?: string;
  trackClassName?: string;
  reverse?: boolean;
  speed?: number;
};

export function DreamshootShowcaseRail({ children, className, trackClassName, reverse = false, speed = 18 }: DreamshootShowcaseRailProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const scrollPositionRef = useRef<number | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches) return;

    let frame = 0;
    let previous = performance.now();
    const pixelsPerSecond = Math.max(12, Math.min(speed, 90));
    scrollPositionRef.current = null;

    const syncScrollPosition = () => {
      scrollPositionRef.current = rail.scrollLeft;
    };
    rail.addEventListener("scroll", syncScrollPosition, { passive: true });

    const tick = (now: number) => {
      const maxScroll = Math.max(0, rail.scrollWidth - rail.clientWidth);
      const delta = ((now - previous) / 1000) * pixelsPerSecond;
      previous = now;

      if (!pausedRef.current && maxScroll > 1) {
        if (scrollPositionRef.current === null || scrollPositionRef.current < 0 || scrollPositionRef.current > maxScroll) {
          scrollPositionRef.current = reverse ? maxScroll : rail.scrollLeft;
          rail.scrollLeft = scrollPositionRef.current;
        }

        let nextScrollPosition = scrollPositionRef.current + (reverse ? -delta : delta);
        if (reverse) {
          if (nextScrollPosition <= 0) nextScrollPosition = maxScroll;
        } else if (nextScrollPosition >= maxScroll) {
          nextScrollPosition = 0;
        }

        scrollPositionRef.current = nextScrollPosition;
        rail.scrollLeft = nextScrollPosition;
      }
      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
      rail.removeEventListener("scroll", syncScrollPosition);
    };
  }, [reverse, speed]);

  const updatePaused = (value: boolean) => {
    pausedRef.current = value;
    setPaused(value);
  };

  return (
    <div
      className={className}
      data-auto-scroll={paused ? "paused" : "running"}
      onBlur={() => updatePaused(false)}
      onFocus={() => updatePaused(true)}
      onMouseEnter={() => updatePaused(true)}
      onMouseLeave={() => updatePaused(false)}
      onPointerDown={() => updatePaused(true)}
      onPointerUp={() => updatePaused(false)}
      ref={railRef}
    >
      <div className={trackClassName}>{children}</div>
    </div>
  );
}
