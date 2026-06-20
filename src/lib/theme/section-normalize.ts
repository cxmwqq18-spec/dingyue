import { defaultSection } from "@/lib/section-schema";
import type { SectionBlockInstance, SectionInstance, SectionType, ThemeSettingValue } from "@/lib/types";

type SectionLike = {
  type?: SectionType;
  settings?: Record<string, ThemeSettingValue>;
  blocks?: SectionBlockInstance[];
};

function cloneBlocks(blocks: SectionBlockInstance[] | undefined): SectionBlockInstance[] {
  return JSON.parse(JSON.stringify(blocks ?? [])) as SectionBlockInstance[];
}

export function normalizeSectionInstance(type: SectionType, section?: SectionLike): SectionInstance {
  const fallback = defaultSection(type);
  return {
    type,
    settings: {
      ...fallback.settings,
      ...(section?.settings ?? {})
    },
    blocks: section?.blocks ? cloneBlocks(section.blocks) : cloneBlocks(fallback.blocks)
  };
}

export function normalizeGlobalSection(type: "header" | "footer", section?: SectionLike): SectionInstance {
  return normalizeSectionInstance(type, section);
}
