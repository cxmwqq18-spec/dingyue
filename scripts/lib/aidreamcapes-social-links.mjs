import assert from "node:assert/strict";

export const AIDREAMCAPES_SOCIAL_SITE_ID = "site_aidreamcapes";

/** Current owner-approved destinations, for incremental relational content writes only. */
export const AIDREAMCAPES_SOCIAL_LINKS = [
  { key: "facebook", label: "Facebook", href: "https://www.facebook.com/AiVideosUGC/" },
  { key: "instagram", label: "Instagram", href: "https://www.instagram.com/aivideosugc/" },
  { key: "pinterest", label: "Pinterest", href: "https://www.pinterest.com/AiVideosUGC/" },
  { key: "x", label: "X", href: "https://x.com/AiVideosUGC" },
  { key: "youtube", label: "YouTube", href: "https://www.youtube.com/@AiVideosUGC" },
  { key: "tiktok", label: "TikTok", href: "https://www.tiktok.com/@aivideosugc" },
  { key: "reddit", label: "Reddit", href: "https://www.reddit.com/user/AiVideosUGC/" },
  { key: "whatsapp", label: "WhatsApp", href: "https://whatsapp.com/channel/0029VbEAEkJKbYMG01djdZ36" },
  { key: "discord", label: "Discord", href: "https://discord.gg/F52827j3Nm" }
];

export function withAidreamcapesSocialLinks(settings) {
  assert.ok(settings && typeof settings === "object" && !Array.isArray(settings), "ThemeSettings must be a current JSON object");
  const navigation = settings.aidreamcapesV2Navigation;
  assert.equal(navigation?.version, 2, "current Aidreamcapes v2 navigation is required");
  assert.ok(navigation.footer && typeof navigation.footer === "object", "current footer is required");
  const existing = navigation.footer.socialLinks ?? [];
  assert.ok(Array.isArray(existing), "footer.socialLinks must be an array when present");
  const keys = new Set(AIDREAMCAPES_SOCIAL_LINKS.map((link) => link.key));
  const socialLinks = [
    ...AIDREAMCAPES_SOCIAL_LINKS.map((link) => ({ ...link })),
    ...existing.filter((link) => !keys.has(link?.key))
  ];
  return {
    ...settings,
    aidreamcapesV2Navigation: {
      ...navigation,
      footer: { ...navigation.footer, socialLinks }
    }
  };
}
