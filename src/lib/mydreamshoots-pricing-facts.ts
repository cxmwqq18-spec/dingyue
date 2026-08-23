export type PricingSidePanelItem = readonly [string, string];

export const MYDREAMSHOOTS_PRICING_SIDE_PANEL_ITEMS: PricingSidePanelItem[] = [
  ["Private photo albums", "Create and keep finished photo sets in your private account gallery."],
  ["AI photo editor with prompts", "Refine approved images with guided prompt-based edits before delivery."],
  ["Special AI photo filters", "Apply supported styles and filters to build a consistent photo set."],
  ["Prompt-based photo creation", "Start a new image direction from a short prompt in seconds."],
  ["AI video generation", "Turn supported photos and prompts into short motion results."],
  ["Magic Upscaler", "Upscale approved images when you need a larger, sharper export."],
  ["No watermark", "Download finished results without a platform watermark."],
  ["4K Ultra-High quality outputs", "Premium exports support higher-resolution delivery where available."]
];

const detailsByFeature = new Map(
  MYDREAMSHOOTS_PRICING_SIDE_PANEL_ITEMS.map(([label, detail]) => [label, detail])
);

export function pricingSidePanelItemsFromMetadata(metadata: { sidePanelItems?: unknown; features?: unknown } | undefined): PricingSidePanelItem[] {
  // An explicit empty array means the page copy intentionally has no feature list.
  // Do not repopulate it from the broader plan features.
  if (Array.isArray(metadata?.sidePanelItems)) {
    return metadata.sidePanelItems.flatMap((item) => {
        if (Array.isArray(item) && item.length >= 2 && typeof item[0] === "string" && typeof item[1] === "string") return [[item[0].trim(), item[1].trim()] as const];
        if (typeof item === "string") {
          const [label, ...detailParts] = item.split("|").map((part) => part.trim());
          if (label && detailParts.join(" | ").trim()) return [[label, detailParts.join(" | ").trim()] as const];
        }
        return [];
      });
  }

  return Array.isArray(metadata?.features)
    ? metadata.features.flatMap((feature) => {
        if (typeof feature !== "string") return [];
        const [label, ...detailParts] = feature.split("|").map((part) => part.trim());
        if (!label) return [];
        const detail = detailParts.join(" | ").trim() || detailsByFeature.get(label) || label;
        return [[label, detail] as const];
      })
    : [];
}
