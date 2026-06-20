"use client";

import type { SectionType, ThemeFieldSchema, ThemeSettings } from "@/lib/types";

export type GlobalType = "header" | "footer";

export type GlobalSettingsNode =
  | "branding"
  | "colors"
  | "typography"
  | "buttons"
  | "navigation"
  | "header"
  | "footer"
  | "seo"
  | "links";

export type Selection =
  | { kind: "section"; sectionId: string }
  | { kind: "block"; sectionId: string; blockId: string }
  | { kind: "global"; globalType: GlobalType }
  | { kind: "globalBlock"; globalType: GlobalType; blockId: string }
  | { kind: "globalSettings"; node: GlobalSettingsNode };

export type DesignerDragState =
  | { kind: "section"; id: string; targetId?: string; position?: "before" | "after" }
  | { kind: "librarySection"; type: SectionType; targetId?: string; position?: "before" | "after" }
  | { kind: "block"; id: string; targetId?: string }
  | { kind: "globalBlock"; id: string; targetId?: string };

export type GlobalSettingsNodeDefinition = {
  id: GlobalSettingsNode;
  label: string;
  description: string;
  kind?: "settings" | "globalSection";
  globalType?: GlobalType;
  badges?: string[];
  fieldIds?: string[];
  localFields?: GlobalLocalField[];
};

export type GlobalLocalField =
  | {
      id: string;
      label: string;
      kind: "color";
      themeKey: keyof ThemeSettings["colors"];
      hint?: string;
    }
  | {
      id: string;
      label: string;
      kind: "font";
      themeKey: keyof ThemeSettings["typography"];
      options?: string[];
      hint?: string;
    }
  | {
      id: string;
      label: string;
      kind: "range";
      themeKey: keyof ThemeSettings["radii"];
      min: number;
      max: number;
      hint?: string;
    }
  | {
      id: string;
      label: string;
      kind: "links";
      themeKey: keyof ThemeSettings["navigation"];
      hint?: string;
      minHeightClassName?: string;
    }
  | {
      id: string;
      label: string;
      kind: "seo_text";
      themeKey: "siteTitle" | "titleTemplate" | "defaultOgImage";
      hint?: string;
    }
  | {
      id: string;
      label: string;
      kind: "seo_textarea";
      themeKey: "siteDescription";
      hint?: string;
      minHeightClassName?: string;
    }
  | {
      id: string;
      label: string;
      kind: "seo_checkbox";
      themeKey: "index" | "follow";
      hint?: string;
    };

export function groupFieldsByIds(fields: ThemeFieldSchema[], fieldIds: string[]) {
  const fieldSet = new Set(fieldIds);
  return fields.filter((field) => field.id && fieldSet.has(field.id));
}
