"use client";

import { useCallback, useRef, useState } from "react";
import type { DragEvent, HTMLAttributes, ReactNode } from "react";

/** Internal drag type used for reordering list items (thumbnails) inside the workspace. */
export const REORDER_MIME = "application/x-aidreamcapes-reorder";

export type FileKind = "image" | "video" | "audio";

export function fileKind(file: File): FileKind | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return null;
}

export function filesFromTransfer(transfer: DataTransfer | null): File[] {
  return Array.from(transfer?.files ?? []);
}

export function takePasteFiles(event: { clipboardData: DataTransfer | null }): File[] {
  return filesFromTransfer(event.clipboardData).filter((file) => fileKind(file) !== null);
}

/** Reorder by moving one item; returns the original list when the indexes are out of range. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function hasFiles(event: DragEvent) {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

/** Reorder drags carry REORDER_MIME instead of files and must not trigger file import. */
function isReorderDrag(event: DragEvent) {
  return Array.from(event.dataTransfer?.types ?? []).includes(REORDER_MIME);
}

/**
 * Drop-zone state and handlers for importing external files. Returns `active`
 * for the drag-over highlight plus props to spread on the target element.
 */
export function useFileDropZone(onFiles: (files: File[]) => void, disabled = false) {
  const [active, setActive] = useState(false);
  const depth = useRef(0);
  const reset = useCallback(() => { depth.current = 0; setActive(false); }, []);
  const accepts = useCallback((event: DragEvent) => !disabled && hasFiles(event) && !isReorderDrag(event), [disabled]);
  const onDragEnter = useCallback((event: DragEvent) => {
    if (!accepts(event)) return;
    event.preventDefault();
    depth.current += 1;
    setActive(true);
  }, [accepts]);
  const onDragOver = useCallback((event: DragEvent) => {
    if (!accepts(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, [accepts]);
  const onDragLeave = useCallback((event: DragEvent) => {
    if (disabled || isReorderDrag(event)) return;
    depth.current -= 1;
    if (depth.current <= 0) reset();
  }, [disabled, reset]);
  const onDrop = useCallback((event: DragEvent) => {
    if (disabled || isReorderDrag(event)) return;
    event.preventDefault();
    reset();
    const files = filesFromTransfer(event.dataTransfer);
    if (files.length) onFiles(files);
  }, [disabled, onFiles, reset]);
  return { active, dropProps: { onDragEnter, onDragOver, onDragLeave, onDrop } };
}

/** Render-safe wrapper around useFileDropZone for conditional markup. */
export function FileDropZone({ onFiles, disabled = false, className = "", activeClassName = "", children, ...rest }: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  className?: string;
  activeClassName?: string;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, "onDragEnter" | "onDragOver" | "onDragLeave" | "onDrop" | "children">) {
  const { active, dropProps } = useFileDropZone(onFiles, disabled);
  return <div {...dropProps} {...rest} className={`${className} ${active ? activeClassName : ""}`.trim() || undefined}>{children}</div>;
}

/** Handlers that make a list item (e.g. an uploaded thumbnail) draggable to change its position. */
export function reorderHandlers(index: number, disabled: boolean, onMove: (from: number, to: number) => void) {
  if (disabled) return {};
  return {
    draggable: true,
    onDragStart: (event: DragEvent) => {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(REORDER_MIME, String(index));
    },
    onDragOver: (event: DragEvent) => {
      if (!isReorderDrag(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    },
    onDrop: (event: DragEvent) => {
      if (!isReorderDrag(event)) return;
      event.preventDefault();
      event.stopPropagation();
      const from = Number(event.dataTransfer.getData(REORDER_MIME));
      if (Number.isInteger(from) && from !== index) onMove(from, index);
    },
  };
}
