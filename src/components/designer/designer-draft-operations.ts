import { clonePage, cloneSettings, normalizeGlobalSections, safeBlocks } from "@/components/designer/designer-theme-utils";
import type { GlobalType } from "@/components/designer/designer-types";
import type { SectionBlockInstance, SectionInstance, ThemePageJson, ThemeSettings, ThemeSettingValue } from "@/lib/types";

export function movePageSection(page: ThemePageJson, sectionId: string, direction: -1 | 1): ThemePageJson | null {
  const next = clonePage(page);
  const index = next.sectionsOrder.indexOf(sectionId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= next.sectionsOrder.length) return null;
  [next.sectionsOrder[index], next.sectionsOrder[target]] = [next.sectionsOrder[target], next.sectionsOrder[index]];
  return next;
}

export function reorderPageSection(
  page: ThemePageJson,
  draggedId: string,
  targetId: string,
  position: "before" | "after" = "before"
): ThemePageJson | null {
  if (draggedId === targetId) return null;
  const next = clonePage(page);
  const draggedIndex = next.sectionsOrder.indexOf(draggedId);
  const targetIndex = next.sectionsOrder.indexOf(targetId);
  if (draggedIndex < 0 || targetIndex < 0) return null;
  next.sectionsOrder.splice(draggedIndex, 1);
  const insertIndex = next.sectionsOrder.indexOf(targetId);
  next.sectionsOrder.splice(position === "after" ? insertIndex + 1 : insertIndex, 0, draggedId);
  return next;
}

export function insertPageSection(
  page: ThemePageJson,
  sectionId: string,
  section: SectionInstance,
  targetId?: string,
  position: "before" | "after" = "after"
): ThemePageJson {
  const next = clonePage(page);
  next.sections[sectionId] = section;
  const targetIndex = targetId ? next.sectionsOrder.indexOf(targetId) : -1;
  if (targetIndex >= 0) {
    next.sectionsOrder.splice(position === "before" ? targetIndex : targetIndex + 1, 0, sectionId);
  } else {
    next.sectionsOrder.push(sectionId);
  }
  return next;
}

export function removePageSection(page: ThemePageJson, sectionId: string): ThemePageJson {
  const next = clonePage(page);
  next.sectionsOrder = next.sectionsOrder.filter((id) => id !== sectionId);
  delete next.sections[sectionId];
  return next;
}

export function duplicatePageSection(page: ThemePageJson, sectionId: string, copyId: string): ThemePageJson | null {
  const next = clonePage(page);
  const original = next.sections[sectionId];
  if (!original) return null;
  const index = next.sectionsOrder.indexOf(sectionId);
  next.sectionsOrder.splice(index + 1, 0, copyId);
  next.sections[copyId] = JSON.parse(JSON.stringify(original)) as SectionInstance;
  return next;
}

export function updatePageSectionSetting(
  page: ThemePageJson,
  sectionId: string,
  fieldId: string,
  value: ThemeSettingValue
): ThemePageJson | null {
  const next = clonePage(page);
  if (!next.sections[sectionId]) return null;
  next.sections[sectionId].settings[fieldId] = value;
  return next;
}

export function addPageBlock(page: ThemePageJson, sectionId: string, block: SectionBlockInstance): ThemePageJson | null {
  const next = clonePage(page);
  const section = next.sections[sectionId];
  if (!section) return null;
  section.blocks ??= [];
  section.blocks.push(block);
  return next;
}

export function updatePageBlockSetting(
  page: ThemePageJson,
  sectionId: string,
  blockId: string,
  fieldId: string,
  value: ThemeSettingValue
): ThemePageJson | null {
  const next = clonePage(page);
  const block = safeBlocks(next.sections[sectionId]).find((item) => item.id === blockId);
  if (!block) return null;
  block.settings[fieldId] = value;
  return next;
}

export function movePageBlock(
  page: ThemePageJson,
  sectionId: string,
  blockId: string,
  direction: -1 | 1
): ThemePageJson | null {
  const next = clonePage(page);
  const blocks = next.sections[sectionId]?.blocks;
  if (!blocks) return null;
  const index = blocks.findIndex((block) => block.id === blockId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= blocks.length) return null;
  [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
  return next;
}

export function reorderPageBlock(
  page: ThemePageJson,
  sectionId: string,
  draggedBlockId: string,
  targetBlockId: string
): ThemePageJson | null {
  if (draggedBlockId === targetBlockId) return null;
  const next = clonePage(page);
  const blocks = next.sections[sectionId]?.blocks;
  if (!blocks) return null;
  const draggedIndex = blocks.findIndex((block) => block.id === draggedBlockId);
  const targetIndex = blocks.findIndex((block) => block.id === targetBlockId);
  if (draggedIndex < 0 || targetIndex < 0) return null;
  const [dragged] = blocks.splice(draggedIndex, 1);
  blocks.splice(targetIndex, 0, dragged);
  return next;
}

export function removePageBlock(page: ThemePageJson, sectionId: string, blockId: string): ThemePageJson | null {
  const next = clonePage(page);
  const section = next.sections[sectionId];
  if (!section?.blocks) return null;
  section.blocks = section.blocks.filter((block) => block.id !== blockId);
  return next;
}

export function updateGlobalSectionSetting(
  settings: ThemeSettings,
  globalType: GlobalType,
  fieldId: string,
  value: ThemeSettingValue
): ThemeSettings {
  const next = normalizeGlobalSections(cloneSettings(settings));
  const section = next.globalSections?.[globalType];
  if (section) section.settings[fieldId] = value;
  return next;
}

export function addGlobalBlock(settings: ThemeSettings, globalType: GlobalType, block: SectionBlockInstance): ThemeSettings {
  const next = normalizeGlobalSections(cloneSettings(settings));
  const section = next.globalSections?.[globalType];
  if (!section) return next;
  section.blocks ??= [];
  section.blocks.push(block);
  return next;
}

export function updateGlobalBlockSetting(
  settings: ThemeSettings,
  globalType: GlobalType,
  blockId: string,
  fieldId: string,
  value: ThemeSettingValue
): ThemeSettings {
  const next = normalizeGlobalSections(cloneSettings(settings));
  const block = safeBlocks(next.globalSections?.[globalType]).find((item) => item.id === blockId);
  if (block) block.settings[fieldId] = value;
  return next;
}

export function moveGlobalBlock(settings: ThemeSettings, globalType: GlobalType, blockId: string, direction: -1 | 1): ThemeSettings {
  const next = normalizeGlobalSections(cloneSettings(settings));
  const blocks = next.globalSections?.[globalType]?.blocks;
  if (!blocks) return next;
  const index = blocks.findIndex((block) => block.id === blockId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= blocks.length) return next;
  [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
  return next;
}

export function reorderGlobalBlock(
  settings: ThemeSettings,
  globalType: GlobalType,
  draggedBlockId: string,
  targetBlockId: string
): ThemeSettings {
  if (draggedBlockId === targetBlockId) return settings;
  const next = normalizeGlobalSections(cloneSettings(settings));
  const blocks = next.globalSections?.[globalType]?.blocks;
  if (!blocks) return next;
  const draggedIndex = blocks.findIndex((block) => block.id === draggedBlockId);
  const targetIndex = blocks.findIndex((block) => block.id === targetBlockId);
  if (draggedIndex < 0 || targetIndex < 0) return next;
  const [dragged] = blocks.splice(draggedIndex, 1);
  blocks.splice(targetIndex, 0, dragged);
  return next;
}

export function removeGlobalBlock(settings: ThemeSettings, globalType: GlobalType, blockId: string): ThemeSettings {
  const next = normalizeGlobalSections(cloneSettings(settings));
  const section = next.globalSections?.[globalType];
  if (section?.blocks) section.blocks = section.blocks.filter((block) => block.id !== blockId);
  return next;
}
