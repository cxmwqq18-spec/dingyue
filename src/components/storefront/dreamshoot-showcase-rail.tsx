import type { ReactNode } from "react";

type DreamshootShowcaseRailProps = { children: ReactNode; className?: string; trackClassName?: string; reverse?: boolean; speed?: number };

export function DreamshootShowcaseRail({ children, className, trackClassName }: DreamshootShowcaseRailProps) {
  return <div className={className} data-auto-scroll="native"><div className={trackClassName}>{children}</div></div>;
}
