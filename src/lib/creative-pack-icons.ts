import {
  BadgeCheck,
  CalendarHeart,
  Camera,
  Clapperboard,
  Crown,
  Film,
  Flower2,
  Gem,
  Gift,
  Globe2,
  Heart,
  ImageIcon,
  Leaf,
  MapPin,
  Moon,
  Mountain,
  PackageOpen,
  Palette,
  Plane,
  PlayCircle,
  Scissors,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  Snowflake,
  Sparkles,
  Star,
  Sun,
  Tags,
  UserRound,
  Users,
  WandSparkles,
  type LucideIcon
} from "lucide-react";
import { icons } from "lucide-react";

export type CreativePackIconOption = {
  name: string;
  label: string;
  icon: LucideIcon;
};

export const creativePackIconOptions: CreativePackIconOption[] = [
  { name: "camera", label: "Camera", icon: Camera },
  { name: "image", label: "Image", icon: ImageIcon },
  { name: "sparkles", label: "Sparkles", icon: Sparkles },
  { name: "wand-sparkles", label: "Wand", icon: WandSparkles },
  { name: "heart", label: "Heart", icon: Heart },
  { name: "users", label: "Users", icon: Users },
  { name: "user-round", label: "User", icon: UserRound },
  { name: "badge-check", label: "Badge", icon: BadgeCheck },
  { name: "globe", label: "Globe", icon: Globe2 },
  { name: "map-pin", label: "Map", icon: MapPin },
  { name: "plane", label: "Plane", icon: Plane },
  { name: "tags", label: "Tags", icon: Tags },
  { name: "gift", label: "Gift", icon: Gift },
  { name: "calendar-heart", label: "Calendar", icon: CalendarHeart },
  { name: "shirt", label: "Shirt", icon: Shirt },
  { name: "scissors", label: "Scissors", icon: Scissors },
  { name: "palette", label: "Palette", icon: Palette },
  { name: "crown", label: "Crown", icon: Crown },
  { name: "gem", label: "Gem", icon: Gem },
  { name: "flower", label: "Flower", icon: Flower2 },
  { name: "leaf", label: "Leaf", icon: Leaf },
  { name: "mountain", label: "Mountain", icon: Mountain },
  { name: "sun", label: "Sun", icon: Sun },
  { name: "moon", label: "Moon", icon: Moon },
  { name: "snowflake", label: "Snow", icon: Snowflake },
  { name: "package", label: "Package", icon: PackageOpen },
  { name: "shopping-bag", label: "Shopping", icon: ShoppingBag },
  { name: "play-circle", label: "Play", icon: PlayCircle },
  { name: "film", label: "Film", icon: Film },
  { name: "clapperboard", label: "Clapperboard", icon: Clapperboard },
  { name: "shield-check", label: "Shield", icon: ShieldCheck },
  { name: "star", label: "Star", icon: Star }
];

export const creativePackFallbackIconNames = creativePackIconOptions.map((item) => item.name);

function displayNameFromIconKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function kebabFromIconKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

const preferredIconNames = new Set(creativePackIconOptions.map((item) => item.name));

export const allCreativePackIconOptions: CreativePackIconOption[] = [
  ...creativePackIconOptions,
  ...Object.entries(icons)
    .map(([key, icon]) => ({
      name: kebabFromIconKey(key),
      label: displayNameFromIconKey(key),
      icon: icon as LucideIcon
    }))
    .filter((item) => !preferredIconNames.has(item.name))
].sort((a, b) => {
  const aPreferred = preferredIconNames.has(a.name) ? 0 : 1;
  const bPreferred = preferredIconNames.has(b.name) ? 0 : 1;
  return aPreferred - bPreferred || a.label.localeCompare(b.label);
});

export function normalizeCreativePackIconName(name?: string | null): string {
  const normalized = (name ?? "").toLowerCase().trim().replace(/[\s_]+/g, "-");
  if (!normalized) return "camera";
  const match = allCreativePackIconOptions.find((item) => item.name === normalized || item.name.replace(/-/g, "") === normalized.replace(/-/g, ""));
  return match?.name ?? "camera";
}

export function creativePackIconByName(name?: string | null): CreativePackIconOption {
  const normalized = normalizeCreativePackIconName(name);
  return allCreativePackIconOptions.find((item) => item.name === normalized) ?? creativePackIconOptions[0];
}

export function suggestedCreativePackIconName(seed: string): string {
  const normalized = seed.toLowerCase();
  if (normalized.includes("hair")) return "scissors";
  if (normalized.includes("avatar")) return "user-round";
  if (normalized.includes("beauty") || normalized.includes("gala")) return "sparkles";
  if (normalized.includes("boudoir") || normalized.includes("wedding") || normalized.includes("couple") || normalized.includes("valentine") || normalized.includes("engagement")) return "heart";
  if (normalized.includes("creator") || normalized.includes("profile")) return "users";
  if (normalized.includes("cultural")) return "globe";
  if (normalized.includes("travel")) return "plane";
  if (normalized.includes("nature")) return "leaf";
  if (normalized.includes("headshot")) return "badge-check";
  if (normalized.includes("christmas") || normalized.includes("season")) return "gift";
  if (normalized.includes("sport") || normalized.includes("cup")) return "play-circle";
  if (normalized.includes("product")) return "shopping-bag";
  if (normalized.includes("fashion")) return "shirt";
  if (normalized.includes("cyber") || normalized.includes("creative") || normalized.includes("mafia")) return "wand-sparkles";
  return "camera";
}

export function uniqueCreativePackIconName(seed: string, used: Set<string>): string {
  const suggested = suggestedCreativePackIconName(seed);
  if (!used.has(suggested)) {
    used.add(suggested);
    return suggested;
  }
  const fallback = creativePackFallbackIconNames.find((name) => !used.has(name)) ?? suggested;
  used.add(fallback);
  return fallback;
}
