import assert from "node:assert/strict";

export const AIDREAMCAPES_DIRECTORY_NAV_ITEMS = [
  { label: "Text to Video", href: "/ai-video-generation/text-to-video", description: "Turn a written product brief into an editable video plan.", image: "/assets/sites/site_aidreamcapes/public-media/site-v2/gen/im01-video-hub-og-r1--sha256-3b549a466f941595c849a7e0408ec37686852de1a761003a4fa2df15aa4376d6.webp" },
  { label: "AI Twin", href: "/ai-video-generation/ai-twin", description: "Explore a consistent presenter style for your product stories.", image: "/assets/sites/site_aidreamcapes/public-media/site-v2/guide/img1-video-hub-hero-beauty-r1--640--sha256-c606c4c3481ea49aae7aa1a3e44b0735492187cc4ac5550d3233554dac2ef7b1.webp" },
];

// Append missing directory links while preserving every existing online field.
export function withAidreamcapesDirectoryNavigation(navigation, images = {}) {
  assert.equal(navigation?.version, 2, "Current Aidreamcapes v2 navigation is required.");
  const next = structuredClone(navigation);
  const video = next.menus.find((menu) => menu.label === "Video");
  assert(video?.groups?.[0]?.items, "Current Video menu is required.");
  for (const item of AIDREAMCAPES_DIRECTORY_NAV_ITEMS) {
    const existing = video.groups.flatMap((group) => group.items);
    assert(!existing.some((link) => link.label === item.label && link.href !== item.href), `Conflicting directory navigation: ${item.label}`);
    if (!existing.some((link) => link.href === item.href)) video.groups[0].items.push({ ...item, image: images[item.href] ?? item.image });
    const footer = next.footer?.groups?.find((group) => group.label === "Video");
    if (footer && !footer.items.some((link) => link.href === item.href)) {
      const index = footer.items.findIndex((link) => link.href === "/ai-video-generation");
      footer.items.splice(index < 0 ? footer.items.length : index, 0, { label: item.label, href: item.href });
    }
  }
  return next;
}
