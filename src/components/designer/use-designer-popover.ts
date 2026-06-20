"use client";

import { useEffect, useRef, type RefObject } from "react";

export function useDesignerPopover(
  open: boolean,
  onClose: () => void,
  ownedRefs: Array<RefObject<HTMLElement | null>> = []
) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      const insideRoot = rootRef.current?.contains(target);
      const insideOwned = ownedRefs.some((ref) => ref.current?.contains(target));
      if (!insideRoot && !insideOwned) onClose();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, ownedRefs]);

  return rootRef;
}
