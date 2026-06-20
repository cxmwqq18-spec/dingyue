import type { DragEvent } from "react";
import type { GlobalType } from "@/components/designer/designer-types";
import type { SectionType } from "@/lib/types";

export type DesignerDragToken =
  | { kind: "section"; sectionId: string }
  | { kind: "librarySection"; sectionType: SectionType }
  | { kind: "block"; sectionId: string; blockId: string }
  | { kind: "globalBlock"; globalType: GlobalType; blockId: string };

const dragMimeType = "text/plain";

export function encodeDesignerDragToken(token: DesignerDragToken): string {
  if (token.kind === "section") return `section:${token.sectionId}`;
  if (token.kind === "librarySection") return `librarySection:${token.sectionType}`;
  if (token.kind === "block") return `block:${token.sectionId}:${token.blockId}`;
  return `globalBlock:${token.globalType}:${token.blockId}`;
}

export function decodeDesignerDragToken(value: string): DesignerDragToken | null {
  const [kind, first, second] = value.split(":");
  if (kind === "section" && first) return { kind, sectionId: first };
  if (kind === "librarySection" && first) return { kind, sectionType: first };
  if (kind === "block" && first && second) return { kind, sectionId: first, blockId: second };
  if (kind === "globalBlock" && first && second) return { kind, globalType: first as GlobalType, blockId: second };
  return null;
}

export function writeDesignerDragToken(event: DragEvent<HTMLElement>, token: DesignerDragToken, effectAllowed: DataTransfer["effectAllowed"]) {
  event.dataTransfer.setData(dragMimeType, encodeDesignerDragToken(token));
  event.dataTransfer.effectAllowed = effectAllowed;
}

export function readDesignerDragToken(event: DragEvent<HTMLElement>): DesignerDragToken | null {
  return decodeDesignerDragToken(event.dataTransfer.getData(dragMimeType));
}

export function sectionDropPosition(event: DragEvent<HTMLElement>): "before" | "after" {
  const rect = event.currentTarget.getBoundingClientRect();
  return event.clientY > rect.top + rect.height / 2 ? "after" : "before";
}
