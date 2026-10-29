// Shapes of the Aidreamcapes.com v2 page payload stored in LivePage.contentJson
// (sections.v2_main.settings.data). Built by scripts/lib/aidreamcapes-site-v2-content.mjs.

export type V2Image = { src: string; alt: string; width?: number; height?: number; srcSet?: string; sizes?: string };
export type V2VisualImage = { src: string; w: number; h: number; alt: string; kind: "photo" | "video"; objectPosition?: string };
export type V2VisualFrame = "1:1" | "9:16" | "16:9" | "4:5";
export type V2VisualStripItem = V2VisualImage;
export type V2VisualActorCard = { image: V2VisualImage; label: string; selected?: boolean };
export type V2ActorSceneChoice = { id: string; name: string; scene: string; image: V2Image; promptTemplate: string; selected?: boolean };
export type V2ActorScenePicker = {
  title: string;
  lead: string;
  button: string;
  tool: string;
  size: string;
  length: number;
  actors: V2ActorSceneChoice[];
  scenes: string[];
  cta?: { label: string; prompt: string };
};
export type V2VisualStep = { source: V2VisualImage; sourceTitle?: string; sourceHint?: string; hideSourceCopy?: boolean; result: V2VisualImage; actorResult?: V2VisualImage; options: [string, string][]; credits: string; prompt?: string; mode?: "photo" | "video"; length?: number; idea?: string; chat?: { q: string; a: string }[]; chips?: string[]; buttonHref?: string; items: V2Item[]; actorCards?: V2VisualActorCard[] };
export type V2VisualTitle = { h2: string; lead?: string; eyebrow?: string };
export type V2VisualTitles = Partial<Record<"m2" | "m3" | "m4" | "m5" | "m6" | "m7" | "m8" | "examples" | "templates" | "faq" | "beforeAfter" | "gallery" | "plan", V2VisualTitle>>;
export type V2VisualPickerCard = { image: V2VisualImage; label: string; chips: string[]; href: string; prompt: string; kind: "photo" | "video"; tool?: string; sceneSlug?: string; publicSlug?: string; detailAliasOf?: string; placement?: string[]; video?: V2Video };
export type V2VisualPicker = { title: string; lead?: string; chips: { id: string; label: string }[]; cards: V2VisualPickerCard[]; button: string; href: string };
export type V2VisualUse = {
  frame?: "phone" | "browser" | "listing" | "post" | "split" | "tiktok" | "reels" | "amazon" | "none";
  image: V2VisualImage;
  imageB?: V2VisualImage;
  img?: V2Image;
  alt?: string;
  href?: string;
  prompt?: string;
  h: string;
  d: string;
};
export type V2VisualInput = { good: V2VisualImage; bad: V2VisualImage; good_label: string; bad_label: string; darkened?: boolean };
export type V2VisualOutput = { image: V2VisualImage; frame: V2VisualFrame; label: string; length?: 6 | 10 | 15; spec: string };
export type V2AfterMock = {
  type: "limited" | "tiktok" | "carousel" | "callout" | "steps";
  badge?: string; countdown?: string; caption?: string; cta?: string;
  title?: string; tag1?: string; tag2?: string; tag3?: string;
  [key: string]: unknown;
};
export type V2VisualAfter = { image: V2VisualImage; zones: string[]; items: string[]; mock?: V2AfterMock };
export type V2VisualSize = { frame: V2VisualFrame; image: V2VisualImage; label: string };
export type V2VisualLimitation = { label: string; detail?: string; supported: boolean };
export type V2Visual = {
  strip: V2VisualStripItem[];
  steps?: V2VisualStep;
  picker: V2VisualPicker;
  uses: V2VisualUse[];
  input: V2VisualInput[];
  outputs: V2VisualOutput[];
  after?: V2VisualAfter;
  sizes?: V2VisualSize[];
  limitations: { h2: string; items: V2VisualLimitation[] };
  titles?: V2VisualTitles;
  overview?: string;
};
export type V2Video = { src: string; width: number; height: number; duration?: number; name?: string; description?: string; uploadDate?: string; poster: V2Image };
export type V2HeroMedia =
  | { kind: "pair"; before: V2Image; after: V2Image }
  | { kind: "image"; image: V2Image }
  | { kind: "video"; video: V2Video }
  | { kind: "loop"; video: V2Video; inset?: V2Image };
export type V2BenefitIcon = "bolt" | "layers" | "target" | "coins" | "clock" | "refresh" | "globe" | "shield" | "sparkle" | "check" | "users" | "play";
export type V2Item = {
  t: string;
  d: string;
  soon?: boolean;
  img?: V2Image;
  alt?: string;
  frame?: "phone" | "browser" | "none";
  icon?: V2BenefitIcon;
  teamIcon?: V2TeamIcon;
};
export type V2TeamIcon = "cart" | "box" | "store" | "megaphone" | "calendar" | "apps";
export type V2ImageItem = V2Item & { href?: string; prompt?: string };
export type V2Faq = { q: string; a: string };
export type V2Crumb = { label: string; href: string };
export type V2ImageAspect = "9:16" | "1:1" | "16:9";
export type V2Card = { key: string; name: string; line?: string; soon?: boolean; kind: "video" | "photo"; href: string; publicSlug?: string; detailAliasOf?: string; sceneSlug?: string; placement?: string[]; image: V2Image; tags: string[]; industries: string[]; platforms: string[]; filterTags?: string[]; cardType?: "template" | "case"; videoExample?: boolean; product?: string; mediaRef?: string; prompt?: string; aspect?: V2ImageAspect; video?: V2Video };
export type V2Example = { key: string; title: string; product: string; kind: "clip" | "scene" | "photo"; href: string; publicSlug?: string; detailAliasOf?: string; sceneSlug?: string; placement?: string[]; mediaRef: string; image: V2Image; prompt?: string; aspect?: V2ImageAspect; video?: V2Video };
export type V2ExampleGroup = { label: string; items: V2Example[] };
export type V2Examples = { h2: string; lead?: string; groups: V2ExampleGroup[] };
export type V2Tool = { id: string; group?: string; label: string; description: string; href: string; image?: V2Image };
export type V2FlowStep = { label: string; image: V2Image; tall?: boolean };
export type V2Flow = { t: string; d: string; steps: V2FlowStep[]; id?: string; filterTags?: string[]; cta?: { label: string; href: string } };
export type V2Maker = { options: [string, string][]; cta: string; href: string; urlInput?: boolean; uploadTitle?: string };
export type V2Plan = { name: string; price: string; credits: string; who: string; features: string[]; popular: boolean };
export type V2MoreSection = { eyebrow: string; h2: string; lead?: string; items: V2ImageItem[] };
export type V2SellerScenario = { audience: string; tool: string; href: string; task: string; image: V2Image };
export type V2SellerScenarioBlock = { title: string; lead: string; items: V2SellerScenario[] };
export type V2Section = { h2: string; paras: string[]; img?: V2Image; alt?: string };
export type V2EnrichmentSection = { h2: string; paras: string[]; items?: V2Item[] };
export type V2EnrichmentBlock = { h2: string; items: V2Item[] };
export type V2FitBlock = { h2: string; good: V2Item[]; not_ideal: V2Item[] };
export type V2CompareBlock = { h2: string; items: V2Item[] };
export type V2GlossaryEntry = { term: string; definition: string; related: { label: string; href: string }[] };
// A row of facts. When `links` is present each name in `value` also leads to its own page.
export type V2SpecRow = [label: string, value: string, links?: { label: string; href: string }[]];
export type V2DirectorySpecs = { title: string; lead?: string; columns: string[]; rows: string[][] };
export type V2DirectoryScene = { t: string; d: string; soon?: boolean; href?: string; image?: V2Image };
// Page-owned text blocks used for competitor parity: a plain definition and a
// three-column comparison table. Neither carries images or internal metadata.
export type V2Definition = { title: string; paras: string[] };
export type V2CompareTable = { title: string; lead?: string; columns: string[]; rows: string[][] };
export type V2TextSectionCard = { t: string; d: string; soon?: boolean; href?: string; label?: string; img?: V2Image };
export type V2TextSection = { eyebrow: string; title: string; lead?: string; cards: V2TextSectionCard[] };
export type V2Article = { title: string; href: string; text: string; minutes: number; section: string };

// Page blocks a page can list in `blockOrder` to set which blocks show and in what order.
// Without `blockOrder` each layout keeps its own default order.
export const V2_BLOCK_IDS = [
  "hero", "definition", "strip", "picker", "reasons", "steps", "benefits", "features", "audience", "uses", "examples",
  "seller_scenarios", "compare", "related", "trust", "reviews", "faq", "closing", "pricing", "templates", "platforms", "directory", "cta",
  // Layout blocks that have no counterpart in the shared list above.
  "plan", "sizes", "input", "outputs", "after", "limitations", "tools"
] as const;
export type V2BlockId = (typeof V2_BLOCK_IDS)[number];
export type V2CardBlockItem = { t: string; d: string; soon?: boolean; img?: V2Image; alt?: string; icon?: string };
export type V2CardBlock = { h2: string; lead?: string; items: V2CardBlockItem[] };
export type V2ReviewItem = V2CardBlockItem & { example: boolean; who: string; source?: string; srcImg?: V2Image; caption?: string; length?: number };
export type V2ReviewBlock = { h2: string; lead?: string; items: V2ReviewItem[]; cta?: { label: string; href: string } };
export type V2ClosingBlock = { h2: string; paras: string[] };
export type V2LinkCardBlock = { h2: string; lead?: string; items: (V2CardBlockItem & { href?: string; label?: string })[] };

export type V2Base = {
  id: string;
  label: string;
  eyebrow: string;
  h1: string;
  lead: string;
  breadcrumbs: V2Crumb[];
  faq: V2Faq[];
};

export type V2Data = V2Base & Record<string, unknown>;

export type V2PricingCard = {
  id: string;
  name: string;
  summary: string;
  badgeLabel?: string;
  features: string[];
  prices: Partial<Record<"month" | "year", {
    amount: string;
    period: string;
    credits: string;
    outputEstimate?: {
      photos: number;
      fifteenSecondVideos: number;
      note: string;
      period: "month" | "year";
    };
    equivalentMonthly?: string;
    savingsLabel?: string;
    checkoutEnabled: boolean;
    checkoutHref: string;
  }>>;
};

export type V2Resolvers = {
  copy?: Record<string, string>;
  href: (value: string) => string;
  asset: (value: string) => string;
  pricingPlans?: V2PricingCard[];
  // The plain link for a workspace address, used where a form must submit there directly.
  direct?: (value: string) => string;
};

export function copyLabel(r: Pick<V2Resolvers, "copy">, value: string): string {
  return r.copy?.[value] ?? value;
}

export function list<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}
